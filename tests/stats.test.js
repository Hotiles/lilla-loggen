const { test, expect } = require('@playwright/test');
const { freshPage } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await freshPage(page);
});

async function logManualFeed(page, from, to) {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fFrom', from);
  await page.fill('#fTo', to);
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });
}

async function logDiaper(page, type) {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');
  if (type !== 'Kiss') await page.locator(`[data-v="${type}"]`).click();
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });
}

// ── Feed stats ───────────────────────────────────────────────────────────────

test('stats show zeros when no events', async ({ page }) => {
  await page.locator('#nav-stats').click();

  await expect(page.locator('#statGrid .stat').filter({ hasText: 'Amningar' }).locator('.n')).toHaveText('0');
  await expect(page.locator('#statGrid .stat').filter({ hasText: 'Blöjbyten' }).locator('.n')).toHaveText('0');
  await expect(page.locator('#weightStat')).toContainText('Ingen vikt loggad');
});

test('stats count feeds within 24h', async ({ page }) => {
  await logManualFeed(page, '08:00', '08:20');
  await logManualFeed(page, '11:00', '11:15');

  await page.locator('#nav-stats').click();

  await expect(page.locator('#statGrid .stat').filter({ hasText: 'Amningar' }).locator('.n')).toHaveText('2');
});

test('stats show average feed duration', async ({ page }) => {
  await logManualFeed(page, '08:00', '08:20'); // 20 min
  await logManualFeed(page, '11:00', '11:40'); // 40 min

  await page.locator('#nav-stats').click();

  await expect(page.locator('#statGrid .stat').filter({ hasText: 'Snitt' }).locator('.n')).toHaveText('30 min');
});

// ── Diaper stats ─────────────────────────────────────────────────────────────

test('stats count Kiss as blöjbyte but not bajsblöja', async ({ page }) => {
  await logDiaper(page, 'Kiss');

  await page.locator('#nav-stats').click();

  await expect(page.locator('#statGrid .stat').filter({ hasText: 'Blöjbyten' }).locator('.n')).toHaveText('1');
  await expect(page.locator('#statGrid .stat').filter({ hasText: 'Bajsblöjor' }).locator('.n')).toHaveText('0');
});

test('stats count Bajs and Båda as bajsblöjor, not Kiss or Torr', async ({ page }) => {
  await logDiaper(page, 'Kiss');
  await logDiaper(page, 'Bajs');
  await logDiaper(page, 'Torr');
  await logDiaper(page, 'Båda');

  await page.locator('#nav-stats').click();

  await expect(page.locator('#statGrid .stat').filter({ hasText: 'Blöjbyten' }).locator('.n')).toHaveText('4');
  await expect(page.locator('#statGrid .stat').filter({ hasText: 'Bajsblöjor' }).locator('.n')).toHaveText('2');
});

// ── Weight stats ─────────────────────────────────────────────────────────────

test('latest weight is shown in stats', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Vikt' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#wVal', '4250');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await page.locator('#nav-stats').click();

  await expect(page.locator('#weightStat .n')).toHaveText('4250 g');
});

test('weight trend shows difference from previous measurement', async ({ page }) => {
  for (const grams of ['4000', '4250']) {
    await page.locator('.q').filter({ hasText: 'Vikt' }).click();
    await page.waitForSelector('#sheet.show');
    await page.fill('#wVal', grams);
    await page.locator('.save').click();
    await page.locator('#sheet').waitFor({ state: 'hidden' });
  }

  await page.locator('#nav-stats').click();

  await expect(page.locator('#weightStat')).toContainText('+250 g sedan förra');
});

// ── Birth data ───────────────────────────────────────────────────────────────

test('birth date shows age in weeks and days', async ({ page }) => {
  await page.locator('#nav-settings').click();

  const born = new Date();
  born.setDate(born.getDate() - 14);
  await page.fill('#birthDateInput', born.toISOString().slice(0, 10));
  await page.locator('#birthDateInput').dispatchEvent('change');

  await page.locator('#nav-stats').click();

  await expect(page.locator('#birthStatSection')).toContainText('2 v 0 d');
});

test('future birth date is clamped to 0 days', async ({ page }) => {
  await page.locator('#nav-settings').click();

  const future = new Date();
  future.setDate(future.getDate() + 7);
  await page.fill('#birthDateInput', future.toISOString().slice(0, 10));
  await page.locator('#birthDateInput').dispatchEvent('change');

  await page.locator('#nav-stats').click();

  await expect(page.locator('#birthStatSection')).toContainText('0 v 0 d');
});
