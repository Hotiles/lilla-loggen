const { test, expect } = require('@playwright/test');
const { freshPage } = require('./helpers');
const fs = require('fs');

test.beforeEach(async ({ page }) => {
  await freshPage(page);
});

async function setBirthDate(page, iso) {
  await page.locator('#nav-settings').click();
  await page.fill('#birthDateInput', iso);
  await page.locator('#birthDateInput').dispatchEvent('change');
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}

test('parent tab is reachable and shows the local-first trust signal', async ({ page }) => {
  await page.locator('#nav-foraldrar').click();
  await expect(page.locator('#view-foraldrar')).toHaveClass(/show/);
  await expect(page.locator('.sgi-trust')).toContainText('bara på den här enheten');
});

test('Lager 1 profile is saved and survives reload', async ({ page }) => {
  await page.locator('#nav-foraldrar').click();
  const etikett = page.locator('#foraldrarContent .row').first().locator('input:not([type=number])');
  const arbetstid = page.locator('#foraldrarContent .row').first().locator('input[type=number]');

  await etikett.fill('Mamma');
  await etikett.dispatchEvent('change');
  await arbetstid.fill('80');
  await arbetstid.dispatchEvent('change');

  await page.reload();
  await page.waitForSelector('#feedList');
  await page.locator('#nav-foraldrar').click();

  await expect(page.locator('#foraldrarContent .row').first().locator('input:not([type=number])')).toHaveValue('Mamma');
  await expect(page.locator('#foraldrarContent .row').first().locator('input[type=number]')).toHaveValue('80');
});

test('antal-väljaren döljer den andra föräldern', async ({ page }) => {
  await page.locator('#nav-foraldrar').click();
  await expect(page.locator('#foraldrarContent .row')).toHaveCount(2);

  await page.locator('#foraldrarContent .chip', { hasText: '1' }).click();
  await expect(page.locator('#foraldrarContent .row')).toHaveCount(1);
});

test('status visar auto-skydd när barnet är under ett år', async ({ page }) => {
  await setBirthDate(page, daysAgoIso(60));
  await page.locator('#nav-foraldrar').click();

  const status = page.locator('#foraldrarContent .sgi-status');
  await expect(status).toHaveClass(/auto/);
  await expect(status).toContainText('Auto-skyddad');
});

test('status varnar när barnet är över ett år', async ({ page }) => {
  await setBirthDate(page, daysAgoIso(400));
  await page.locator('#nav-foraldrar').click();

  const status = page.locator('#foraldrarContent .sgi-status');
  await expect(status).toHaveClass(/warn/);
  await expect(status).toContainText('över 1 år');
});

test('status uppmanar att lägga till födelsedatum när det saknas', async ({ page }) => {
  await page.locator('#nav-foraldrar').click();
  await expect(page.locator('#foraldrarContent .sgi-status')).toContainText('födelsedatum');
});

test('checklista och disclaimer länkar till Försäkringskassan', async ({ page }) => {
  await page.locator('#nav-foraldrar').click();
  await expect(page.locator('#foraldrarContent .sgi-check')).toHaveCount(4);
  await expect(page.locator('.sgi-disclaimer')).toContainText('forsakringskassan.se');
  await expect(page.locator('.sgi-disclaimer a')).toHaveAttribute('href', /forsakringskassan\.se/);
});

test('profil-datan följer med export', async ({ page }) => {
  await page.locator('#nav-foraldrar').click();
  const arbetstid = page.locator('#foraldrarContent .row').first().locator('input[type=number]');
  await arbetstid.fill('100');
  await arbetstid.dispatchEvent('change');

  await page.locator('#nav-settings').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('button').filter({ hasText: 'Exportera' }).click();
  const download = await downloadPromise;
  const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));

  expect(data.foraldrar).toBeTruthy();
  expect(data.foraldrar.foraldrar[0].arbetstid).toBe(100);
});

test('profil-datan återställs vid import', async ({ page }) => {
  const backup = {
    app: 'lillaloggen',
    exported: new Date().toISOString(),
    foraldrar: { antal: 2, foraldrar: [
      { id: 'p1', etikett: 'Pappa', arbetstid: 50 },
      { id: 'p2', etikett: 'Mamma', arbetstid: 100 },
    ] },
    events: [],
  };
  const tmpPath = '/tmp/lilla-loggen-foraldrar-import.json';
  fs.writeFileSync(tmpPath, JSON.stringify(backup));

  await page.locator('#nav-settings').click();
  await page.locator('#importFile').setInputFiles(tmpPath);
  await expect(page.locator('#toast')).toContainText('Data importerad');

  await page.locator('#nav-foraldrar').click();
  await expect(page.locator('#foraldrarContent .row').first().locator('input:not([type=number])')).toHaveValue('Pappa');
  await expect(page.locator('#foraldrarContent .row').first().locator('input[type=number]')).toHaveValue('50');

  fs.unlinkSync(tmpPath);
});
