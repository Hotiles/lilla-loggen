const { test, expect } = require('@playwright/test');
const { freshPage } = require('./helpers');
const fs = require('fs');

test.beforeEach(async ({ page }) => {
  await freshPage(page);
});

test('baby name is saved and shown in header', async ({ page }) => {
  await page.locator('#nav-settings').click();
  await page.fill('#nameInput', 'Alma');
  await page.locator('#nameInput').dispatchEvent('change');

  await expect(page.locator('#babyName')).toHaveText('Alma');
});

test('baby name persists after reload', async ({ page }) => {
  await page.locator('#nav-settings').click();
  await page.fill('#nameInput', 'Alma');
  await page.locator('#nameInput').dispatchEvent('change');

  await page.reload();
  await page.waitForSelector('#feedList');

  await expect(page.locator('#babyName')).toHaveText('Alma');
});

test('export produces JSON with correct structure', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Vikt' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#wVal', '4250');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await page.locator('#nav-settings').click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('button').filter({ hasText: 'Exportera' }).click();
  const download = await downloadPromise;
  const exportPath = await download.path();

  const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  expect(data.app).toBe('lillaloggen');
  expect(data.events).toHaveLength(1);
  expect(data.events[0].type).toBe('weight');
  expect(data.events[0].val).toBe(4250);
});

test('import restores events and baby name from backup', async ({ page }) => {
  const backup = {
    app: 'lillaloggen',
    exported: new Date().toISOString(),
    name: 'Testbebis',
    events: [
      { id: 'test1', type: 'weight', ts: Date.now(), val: 3500, note: '' },
    ],
  };
  const tmpPath = '/tmp/lilla-loggen-test-import.json';
  fs.writeFileSync(tmpPath, JSON.stringify(backup));

  await page.locator('#nav-settings').click();
  await page.locator('#importFile').setInputFiles(tmpPath);

  await expect(page.locator('#toast')).toContainText('Data importerad');
  await expect(page.locator('#babyName')).toHaveText('Testbebis');

  await page.locator('#nav-home').click();
  await expect(page.locator('#feedList .ev')).toHaveCount(1);
  await expect(page.locator('#feedList .ev .b').first()).toContainText('3500 g');

  fs.unlinkSync(tmpPath);
});

test('import of malformed JSON shows error toast', async ({ page }) => {
  const tmpPath = '/tmp/lilla-loggen-bad-import.json';
  fs.writeFileSync(tmpPath, 'not valid json {{{');

  await page.locator('#nav-settings').click();
  await page.locator('#importFile').setInputFiles(tmpPath);

  await expect(page.locator('#toast')).toContainText('Kunde inte läsa filen');

  fs.unlinkSync(tmpPath);
});

test('backup status warns when no backup has ever been exported', async ({ page }) => {
  await page.locator('#nav-settings').click();
  const status = page.locator('#backupStatus');
  await expect(status).toHaveClass(/warn/);
  await expect(status).toContainText('aldrig');
});

test('exporting clears the overdue warning and records last backup', async ({ page }) => {
  await page.locator('#nav-settings').click();
  await expect(page.locator('#backupStatus')).toHaveClass(/warn/);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('button').filter({ hasText: 'Exportera' }).click();
  await downloadPromise;

  const status = page.locator('#backupStatus');
  await expect(status).not.toHaveClass(/warn/);
  await expect(status).toContainText('Senaste export');

  // persists across reload
  await page.reload();
  await page.waitForSelector('#feedList');
  await page.locator('#nav-settings').click();
  await expect(page.locator('#backupStatus')).toContainText('Senaste export');
});

test('automatic local snapshot is written and can be restored after data loss', async ({ page }) => {
  // log a weight so there is something to protect
  await page.locator('.q').filter({ hasText: 'Vikt' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#wVal', '4250');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  // the redundant snapshot is debounced – wait until it lands in localStorage
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('lillaloggen_snapshot');
    return raw ? JSON.parse(raw).events.length : 0;
  })).toBe(1);

  // simulate IndexedDB loss (snapshot in localStorage survives)
  await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('lillaloggen');
    req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve;
  }));
  await page.reload();
  await page.waitForSelector('#feedList');
  await expect(page.locator('#feedList .ev')).toHaveCount(0);

  // restore from the local copy
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#nav-settings').click();
  await page.locator('button').filter({ hasText: 'Återställ lokal kopia' }).click();
  await expect(page.locator('#toast')).toContainText('Återställd');

  await page.locator('#nav-home').click();
  await expect(page.locator('#feedList .ev')).toHaveCount(1);
  await expect(page.locator('#feedList .ev .b').first()).toContainText('4250 g');
});

test('restore with no local copy shows a friendly message', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('lillaloggen_snapshot'));
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#nav-settings').click();
  await page.locator('button').filter({ hasText: 'Återställ lokal kopia' }).click();
  await expect(page.locator('#toast')).toContainText('Ingen lokal kopia');
});

test('wipe clears all data and resets the header name', async ({ page }) => {
  await page.locator('#nav-settings').click();
  await page.fill('#nameInput', 'Alma');
  await page.locator('#nameInput').dispatchEvent('change');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('button').filter({ hasText: 'Radera all data' }).click();

  await expect(page.locator('#toast')).toContainText('Allt raderat');
  await expect(page.locator('#babyName')).toHaveText('Bebis');

  await page.locator('#nav-home').click();
  await expect(page.locator('#feedList .ev')).toHaveCount(0);
});
