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

test('dark theme can be selected and persists across reload', async ({ page }) => {
  await page.locator('#nav-settings').click();
  await page.locator('#themeChips .chip[data-v="dark"]').click();

  await expect(page.locator('body')).toHaveClass(/theme-dark/);

  await page.reload();
  await page.waitForSelector('#feedList');

  await expect(page.locator('body')).toHaveClass(/theme-dark/);
});

test('light theme forces a light background regardless of time', async ({ page }) => {
  await page.locator('#nav-settings').click();
  await page.locator('#themeChips .chip[data-v="light"]').click();

  await expect(page.locator('body')).not.toHaveClass(/theme-dark/);
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
