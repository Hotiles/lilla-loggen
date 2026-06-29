const { test, expect } = require('@playwright/test');
const { freshPage } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await freshPage(page);
});

// ── Tupplurar (dagsömn, snabbräkning) ────────────────────────────────────────

test('nap: one tap logs a nap and shows it in the feed', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Tupplur' }).click();

  await expect(page.locator('#toast')).toContainText('Tupplur loggad');
  await expect(page.locator('#feedList .ev')).toHaveCount(1);
  await expect(page.locator('#feedList .ev .a').first()).toHaveText('Tupplur');
});

test('nap: count appears in 24h stats and survives reload', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Tupplur' }).click();
  await page.locator('.q').filter({ hasText: 'Tupplur' }).click();
  // wait for both writes to persist + render before reloading
  await expect(page.locator('#feedList .ev')).toHaveCount(2);

  await page.reload();
  await page.waitForSelector('#feedList');
  await expect(page.locator('#feedList .ev')).toHaveCount(2);

  await page.locator('#nav-stats').click();
  const napStat = page.locator('#statGrid .stat').filter({ hasText: 'Tupplurar' });
  await expect(napStat.locator('.n')).toHaveText('2');
});

// ── Nattsömn (dagbok med betyg) ──────────────────────────────────────────────

test('nightsleep: state and comment are logged and shown in the feed', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Nattsömn' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('#nsChips [data-v="4"]').click();
  await page.fill('#noteV', 'Vaknade en gång, somnade om snabbt');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Nattsömn loggad');
  const body = page.locator('#feedList .ev .b').first();
  await expect(body).toContainText('Lugn natt');
  await expect(body).toContainText('Vaknade en gång');
});

test('nightsleep: quality states are single-select with a neutral default', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Nattsömn' }).click();
  await page.waitForSelector('#sheet.show');

  await expect(page.locator('#nsChips .chip.active')).toHaveCount(1);
  await expect(page.locator('#nsChips .chip.active')).toHaveAttribute('data-v', '3');

  await page.locator('#nsChips [data-v="1"]').click();
  await expect(page.locator('#nsChips .chip.active')).toHaveCount(1);
  await expect(page.locator('#nsChips .chip.active')).toHaveAttribute('data-v', '1');
});

test('nightsleep: can be edited afterwards', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Nattsömn' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('.save').click(); // default: Helt okej
  await expect(page.locator('#feedList .ev .b').first()).toContainText('Helt okej');

  // first ✎ button on the row opens the edit sheet
  await page.locator('#feedList .ev').first().locator('.del').first().click();
  await page.waitForSelector('#sheet.show');
  await page.locator('#ensChips [data-v="1"]').click();
  await page.locator('.save').click();

  await expect(page.locator('#feedList .ev .b').first()).toContainText('Tuff natt');
});

test('nightsleep: latest rating is summarised in stats', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Nattsömn' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('#nsChips [data-v="2"]').click();
  await page.locator('.save').click();

  await page.locator('#nav-stats').click();
  await expect(page.locator('#sleepStat')).toContainText('Orolig');
  await expect(page.locator('#sleepStat')).toContainText('snitt 1 nätter');
});
