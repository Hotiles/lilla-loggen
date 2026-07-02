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

test('diaper: date defaults to today and a past date can be chosen', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Blöja' }).click();
  await page.waitForSelector('#sheet.show');

  const today = await page.evaluate(() => toDateInput(new Date()));
  await expect(page.locator('#dDate')).toHaveValue(today);

  const yesterday = await page.evaluate(() => toDateInput(new Date(Date.now() - 864e5)));
  await page.fill('#dDate', yesterday);
  await page.fill('#dTime', '23:50');
  await page.locator('.save').click();

  const ts = await page.evaluate(async () => (await allEvents())[0].ts);
  const saved = await page.evaluate((t) => toDateInput(new Date(t)), ts);
  expect(saved).toBe(yesterday);
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

// ── Formula (ersättning) ────────────────────────────────────────────────────

test('formula: empty amount is rejected', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Ersättning' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Ange mängd i ml');
  await expect(page.locator('#sheet')).toHaveClass(/show/);
});

test('formula: amount in ml is saved and shown in feed', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Ersättning' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fmVal', '90');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Ersättning loggad');
  await expect(page.locator('#feedList .ev .b').first()).toContainText('90 ml');
});

test('formula: time defaults to now', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Ersättning' }).click();
  await page.waitForSelector('#sheet.show');

  const val = await page.locator('#fmTime').inputValue();
  expect(val).toMatch(/^\d{2}:\d{2}$/);
});

test('formula: custom time is reflected in feed', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Ersättning' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fmVal', '120');
  await page.fill('#fmTime', '03:30');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await expect(page.locator('#feedList .ev .time').first()).toContainText('03:30');
});

test('formula: a past date can be chosen', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Ersättning' }).click();
  await page.waitForSelector('#sheet.show');

  const twoDaysAgo = await page.evaluate(() => toDateInput(new Date(Date.now() - 2 * 864e5)));
  await page.fill('#fmVal', '100');
  await page.fill('#fmDate', twoDaysAgo);
  await page.fill('#fmTime', '02:00');
  await page.locator('.save').click();

  const ts = await page.evaluate(async () => (await allEvents())[0].ts);
  const saved = await page.evaluate((t) => toDateInput(new Date(t)), ts);
  expect(saved).toBe(twoDaysAgo);
});

test('formula: note is shown in feed', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Ersättning' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fmVal', '60');
  await page.fill('#noteV', 'Extra hungrig');
  await page.locator('.save').click();

  await expect(page.locator('#feedList .ev .b').first()).toContainText('Extra hungrig');
});

// ── Pump (pumpat) ───────────────────────────────────────────────────────────

test('pump: empty amount is rejected', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Pumpat' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Ange mängd i ml');
  await expect(page.locator('#sheet')).toHaveClass(/show/);
});

test('pump: side and amount in ml are saved and shown in feed', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Pumpat' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('[data-v="Höger"]').click();
  await page.fill('#pVal', '70');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Pumpning loggad');
  await expect(page.locator('#feedList .ev .a').first()).toHaveText('Pumpat');
  await expect(page.locator('#feedList .ev .b').first()).toContainText('Höger');
  await expect(page.locator('#feedList .ev .b').first()).toContainText('70 ml');
});

test('pump: side defaults to Vänster', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Pumpat' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#pVal', '50');
  await page.locator('.save').click();

  await expect(page.locator('#feedList .ev .b').first()).toContainText('Vänster');
});

test('pump: Båda can be selected', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Pumpat' }).click();
  await page.waitForSelector('#sheet.show');
  await page.locator('[data-v="Båda"]').click();
  await page.fill('#pVal', '120');
  await page.locator('.save').click();

  await expect(page.locator('#feedList .ev .b').first()).toContainText('Båda');
});

test('pump: time defaults to now', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Pumpat' }).click();
  await page.waitForSelector('#sheet.show');

  const val = await page.locator('#pTime').inputValue();
  expect(val).toMatch(/^\d{2}:\d{2}$/);
});

test('pump: a past date can be chosen', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Pumpat' }).click();
  await page.waitForSelector('#sheet.show');

  const twoDaysAgo = await page.evaluate(() => toDateInput(new Date(Date.now() - 2 * 864e5)));
  await page.fill('#pVal', '80');
  await page.fill('#pDate', twoDaysAgo);
  await page.fill('#pTime', '02:00');
  await page.locator('.save').click();

  const ts = await page.evaluate(async () => (await allEvents())[0].ts);
  const saved = await page.evaluate((t) => toDateInput(new Date(t)), ts);
  expect(saved).toBe(twoDaysAgo);
});

test('pump: note is shown in feed', async ({ page }) => {
  await page.locator('.q').filter({ hasText: 'Pumpat' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#pVal', '40');
  await page.fill('#noteV', 'Efter frukost');
  await page.locator('.save').click();

  await expect(page.locator('#feedList .ev .b').first()).toContainText('Efter frukost');
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
