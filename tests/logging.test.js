const { test, expect } = require('@playwright/test');
const { freshPage } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await freshPage(page);
});

// ── Diaper ──────────────────────────────────────────────────────────────────

test('diaper: Kiss (default chip) is logged', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Blöja loggad');
  await expect(page.locator('#feedList .ev')).toHaveCount(1);
  await expect(page.locator('#feedList .ev .b').first()).toContainText('Kiss');
});

test('diaper: Bajs type can be selected', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('[data-v="Bajs"]').click();
  await page.locator('.save').click();

  await expect(page.locator('#feedList .ev .b').first()).toContainText('Bajs');
});

test('diaper: chips are single-select', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');

  await page.locator('[data-v="Bajs"]').click();
  await page.locator('[data-v="Torr"]').click();

  await expect(page.locator('#dChips .chip.active')).toHaveCount(1);
  await expect(page.locator('#dChips .chip.active')).toHaveAttribute('data-v', 'Torr');
});

test('diaper: time defaults to now', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');

  const val = await page.locator('#dTime').inputValue();
  expect(val).toMatch(/^\d{2}:\d{2}$/);
});

test('diaper: custom time is reflected in feed', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#dTime', '07:15');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await expect(page.locator('#feedList .ev .time').first()).toContainText('07:15');
});

test('diaper: note is shown in feed', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#noteV', 'Kräktes lite');
  await page.locator('.save').click();

  await expect(page.locator('#feedList .ev .b').first()).toContainText('Kräktes lite');
});

// ── Note ────────────────────────────────────────────────────────────────────

test('note: empty text is rejected', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Anteckning' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Skriv något först');
  await expect(page.locator('#sheet')).toHaveClass(/show/);
});

test('note: text is saved and shown in feed', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Anteckning' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#noteV', 'Sov bra i natt');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Anteckning sparad');
  await expect(page.locator('#feedList .ev .b').first()).toContainText('Sov bra i natt');
});

test('note: HTML tags are escaped and not rendered', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Anteckning' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#noteV', '<b>fetstil</b>');
  await page.locator('.save').click();

  const feedBody = page.locator('#feedList .ev .b').first();
  await expect(feedBody).toContainText('<b>fetstil</b>');
  await expect(page.locator('#feedList .ev .b b')).toHaveCount(0);
});

// ── Weight ──────────────────────────────────────────────────────────────────

test('weight: empty value is rejected', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Vikt' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Ange vikt i gram');
  await expect(page.locator('#sheet')).toHaveClass(/show/);
});

test('weight: value in grams is saved and shown in feed', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Vikt' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#wVal', '4250');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Vikt sparad');
  await expect(page.locator('#feedList .ev .b').first()).toContainText('4250 g');
});

// ── Event management ────────────────────────────────────────────────────────

test('event can be deleted via undo-toast', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await expect(page.locator('#feedList .ev')).toHaveCount(1);

  await page.locator('#feedList .ev').first().locator('.del').last().click();

  await expect(page.locator('#feedList .ev')).toHaveCount(0);
  await expect(page.locator('#undoToast')).toHaveClass(/show/);
});

test('deleting an event can be undone', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await page.locator('#feedList .ev').first().locator('.del').last().click();
  await expect(page.locator('#feedList .ev')).toHaveCount(0);

  await page.locator('#undoBtn').click();

  await expect(page.locator('#feedList .ev')).toHaveCount(1);
  await expect(page.locator('#feedList .ev .b').first()).toContainText('Kiss');
});

test('note can be edited on an existing event', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await page.locator('#feedList .ev').first().locator('.del').first().click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#editNoteV', 'Redigerad kommentar');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Kommentar sparad');
  await expect(page.locator('#feedList .ev .b').first()).toContainText('Redigerad kommentar');
});

test('sheet closes when tapping outside', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');

  await page.locator('#sheet').click({ position: { x: 5, y: 5 } });

  await expect(page.locator('#sheet')).not.toHaveClass(/show/);
  await expect(page.locator('#feedList .ev')).toHaveCount(0);
});
