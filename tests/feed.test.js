const { test, expect } = require('@playwright/test');
const { freshPage } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await freshPage(page);
});

test('timer starts idle', async ({ page }) => {
  await expect(page.locator('#timer')).toHaveText('––:––');
  await expect(page.locator('#timer')).toHaveClass(/idle/);
  await expect(page.locator('#stopBtn')).toBeHidden();
  await expect(page.locator('#feedRetroBtn')).toBeVisible();
});

test('clicking Vänster starts the timer', async ({ page }) => {
  await page.locator('#btnL').click();

  await expect(page.locator('#btnL')).toHaveClass(/active/);
  await expect(page.locator('#btnR')).not.toHaveClass(/active/);
  await expect(page.locator('#stopBtn')).toBeVisible();
  await expect(page.locator('#feedRetroBtn')).toBeHidden();
  await page.waitForFunction(() => document.getElementById('timer').textContent !== '––:––');
  await expect(page.locator('#timer')).not.toHaveClass(/idle/);
});

test('clicking Höger starts the timer', async ({ page }) => {
  await page.locator('#btnR').click();

  await expect(page.locator('#btnR')).toHaveClass(/active/);
  await expect(page.locator('#btnL')).not.toHaveClass(/active/);
  await expect(page.locator('#stopBtn')).toBeVisible();
});

test('switching sides keeps the timer running', async ({ page }) => {
  await page.locator('#btnL').click();
  await page.waitForFunction(() => document.getElementById('timer').textContent !== '––:––');

  await page.locator('#btnR').click();

  await expect(page.locator('#btnR')).toHaveClass(/active/);
  await expect(page.locator('#btnL')).not.toHaveClass(/active/);
  await expect(page.locator('#stopBtn')).toBeVisible();
  await expect(page.locator('#timer')).not.toHaveText('––:––');
});

test('stop button saves feed and resets UI', async ({ page }) => {
  await page.locator('#btnL').click();
  await page.waitForTimeout(1100);
  await page.locator('#stopBtn').click();

  await expect(page.locator('#toast')).toContainText('Amning sparad');
  // after stopping, the hero leaves the running state and the feed retro button returns
  await expect(page.locator('#stopBtn')).toBeHidden();
  await expect(page.locator('#feedRetroBtn')).toBeVisible();
  await expect(page.locator('#timer')).not.toHaveClass(/idle/);

  await expect(page.locator('#feedList .ev')).toHaveCount(1);
  await expect(page.locator('#feedList .ev .a').first()).toHaveText('Amning');
  await expect(page.locator('#feedList .ev .b').first()).toContainText('Vänster');
});

test('clicking the active side button keeps the session running (no accidental stop)', async ({ page }) => {
  await page.locator('#btnL').click();
  await expect(page.locator('#stopBtn')).toBeVisible();

  await page.locator('#btnL').click();

  // tapping the active side again must NOT stop the feed
  await expect(page.locator('#stopBtn')).toBeVisible();
  await expect(page.locator('#btnL')).toHaveClass(/active/);
  await expect(page.locator('#timer')).not.toHaveText('––:––');
  await expect(page.locator('#feedList .ev')).toHaveCount(0);
});

test('feed is shown in the list after stopping', async ({ page }) => {
  await page.locator('#btnR').click();
  await page.waitForTimeout(1100);
  await page.locator('#stopBtn').click();

  const feedItem = page.locator('#feedList .ev').first();
  await expect(feedItem.locator('.a')).toHaveText('Amning');
  await expect(feedItem.locator('.b')).toContainText('Höger');
});

test('manual feed: saves with correct duration', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');

  await page.fill('#fFrom', '10:00');
  await page.fill('#fTo', '10:30');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Amning sparad');
  await expect(page.locator('#feedList .ev .b').first()).toContainText('30:00');
});

test('manual feed overnight: crossing midnight gives correct duration', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');

  await page.fill('#fFrom', '23:50');
  await page.fill('#fTo', '00:10');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Amning sparad');
  // 20 minutes, not ~23h40m
  await expect(page.locator('#feedList .ev .b').first()).toContainText('20:00');
});

test('manual feed: a past date can be chosen and is used for the timestamp', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');

  const yesterday = await page.evaluate(() => toDateInput(new Date(Date.now() - 864e5)));
  await page.fill('#fDate', yesterday);
  await page.fill('#fFrom', '20:00');
  await page.fill('#fTo', '20:20');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Amning sparad');
  const ts = await page.evaluate(async () => (await allEvents())[0].ts);
  const saved = await page.evaluate((t) => toDateInput(new Date(t)), ts);
  expect(saved).toBe(yesterday);
});

test('manual feed: date defaults to today', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');

  const today = await page.evaluate(() => toDateInput(new Date()));
  await expect(page.locator('#fDate')).toHaveValue(today);
});

test('manual feed: under one minute duration is rejected', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');

  await page.fill('#fFrom', '10:00');
  await page.fill('#fTo', '10:00');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Starttid och sluttid kan inte vara samma');
  await expect(page.locator('#sheet')).toHaveClass(/show/);
});

test('manual feed: empty times are rejected', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');

  await page.evaluate(() => {
    document.getElementById('fFrom').value = '';
    document.getElementById('fTo').value = '';
  });
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Fyll i båda tiderna');
  await expect(page.locator('#sheet')).toHaveClass(/show/);
});

test('manual feed: cancel closes sheet without saving', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');

  await page.locator('.cancel').click();

  await expect(page.locator('#sheet')).not.toHaveClass(/show/);
  await expect(page.locator('#feedList .ev')).toHaveCount(0);
});

test('adjust row is hidden when idle and visible while running', async ({ page }) => {
  await expect(page.locator('#adjustRow')).toBeHidden();

  await page.locator('#btnL').click();
  await expect(page.locator('#adjustRow')).toBeVisible();

  await page.locator('#stopBtn').click();
  await expect(page.locator('#adjustRow')).toBeHidden();
});

test('+30 s increases elapsed time, −30 s decreases it', async ({ page }) => {
  await page.locator('#btnL').click();
  await page.waitForFunction(() => document.getElementById('timer').textContent !== '––:––');

  // freeze start so the comparison is deterministic, then add 60 s
  await page.evaluate(() => { activeFeed.start = Date.now(); tickFeed(); });
  await page.locator('.adj-btn:has-text("+30 s")').click();
  await page.locator('.adj-btn:has-text("+30 s")').click();
  await expect(page.locator('#timer')).toHaveText('01:00');

  await page.locator('.adj-btn:has-text("−30 s")').click();
  await expect(page.locator('#timer')).toHaveText('00:30');
});

test('−30 s never drives elapsed time below zero', async ({ page }) => {
  await page.locator('#btnL').click();
  await page.evaluate(() => { activeFeed.start = Date.now(); tickFeed(); });

  await page.locator('.adj-btn:has-text("−30 s")').click();
  await expect(page.locator('#timer')).toHaveText('00:00');
});

test('editing a logged feed updates its duration', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fFrom', '10:00');
  await page.fill('#fTo', '10:10');
  await page.locator('.save').click();
  await expect(page.locator('#feedList .ev .b').first()).toContainText('10:00');

  await page.locator('#feedList .ev').first().locator('button[title="Ändra"]').click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#efTo', '10:25');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Amning ändrad');
  await expect(page.locator('#feedList .ev .b').first()).toContainText('25:00');
});

test('editing a logged feed can move it to an earlier date', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fFrom', '10:00');
  await page.fill('#fTo', '10:10');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await page.locator('#feedList .ev').first().locator('button[title="Ändra"]').click();
  await page.waitForSelector('#sheet.show');
  const twoDaysAgo = await page.evaluate(() => toDateInput(new Date(Date.now() - 2 * 864e5)));
  await page.fill('#efDate', twoDaysAgo);
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Amning ändrad');
  const ts = await page.evaluate(async () => (await allEvents())[0].ts);
  const saved = await page.evaluate((t) => toDateInput(new Date(t)), ts);
  expect(saved).toBe(twoDaysAgo);
});

test('an active feed survives a reload', async ({ page }) => {
  await page.locator('#btnL').click();
  await expect(page.locator('#stopBtn')).toBeVisible();
  await page.waitForFunction(() => document.getElementById('timer').textContent !== '––:––');

  await page.reload();
  await page.waitForSelector('#feedList');

  await expect(page.locator('#stopBtn')).toBeVisible();
  await expect(page.locator('#btnL')).toHaveClass(/active/);
  await page.waitForFunction(() => document.getElementById('timer').textContent !== '––:––');
});

test('idle hero suggests the opposite breast after a feed', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fFrom', '10:00');
  await page.fill('#fTo', '10:15'); // default side is Vänster
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await expect(page.locator('#heroLabel')).toHaveText('Sedan senaste amning');
  await expect(page.locator('#btnR')).toHaveClass(/suggest/);
  await expect(page.locator('#sideTag')).toContainText('Höger');
});

test('idle hero still suggests the opposite breast after a bottle in between', async ({ page }) => {
  // Senaste bröstamningen var vänster ...
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fFrom', '10:00');
  await page.fill('#fTo', '10:15'); // default side is Vänster
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  // ... sedan gavs en flaska. Klockan följer flaskan, men sidförslaget minns bröstet.
  await page.locator('.q').filter({ hasText: 'Ersättning' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fmVal', '90');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await expect(page.locator('#heroLabel')).toHaveText('Sedan senaste matning');
  await expect(page.locator('#btnR')).toHaveClass(/suggest/);
  await expect(page.locator('#sideTag')).toContainText('Höger');
});

test('idle hero clock counts from the feed end, not the start', async ({ page }) => {
  // Amning som startade för 70 min sedan och slutade för 30 min sedan.
  // Från start = "Ca 1 tim", från slut = "Ca 30 min" – hinkarna skiljer sig åt.
  await page.evaluate(async () => {
    const now = Date.now();
    await put(STORE, { id: uid(), type: 'feed', ts: now - 70 * 60000, end: now - 30 * 60000, durMs: 40 * 60000, side: 'Vänster', method: 'bröst' });
    await render();
  });

  await expect(page.locator('#heroLabel')).toHaveText('Sedan senaste amning');
  await expect(page.locator('#timer')).toHaveText('Ca 30 min');
});

test('active feed shows a mini indicator on other tabs', async ({ page }) => {
  await page.locator('#btnL').click();
  await expect(page.locator('#feedMini')).toBeHidden();

  await page.locator('#nav-stats').click();
  await expect(page.locator('#feedMini')).toBeVisible();

  await page.locator('#feedMini').click();
  await expect(page.locator('#view-home')).toHaveClass(/show/);
});

test('manual feed: method defaults to Bröst and side is shown in feed', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');

  await page.fill('#fFrom', '10:00');
  await page.fill('#fTo', '10:15');
  await page.locator('.save').click();

  await expect(page.locator('#feedList .ev .b').first()).toContainText('Vänster');
});

test('manual feed: Flaska can be chosen and shows instead of side', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');

  await page.locator('#fMethodChips [data-v="flaska"]').click();
  await page.fill('#fFrom', '10:00');
  await page.fill('#fTo', '10:15');
  await page.locator('.save').click();

  await expect(page.locator('#feedList .ev .b').first()).toContainText('Flaska');
  await expect(page.locator('#feedList .ev .b').first()).not.toContainText('Vänster');
});

test('a feed started via the live timer is saved with method Bröst', async ({ page }) => {
  await page.locator('#btnL').click();
  await page.waitForTimeout(1100);
  await page.locator('#stopBtn').click();

  const method = await page.evaluate(async () => (await allEvents())[0].method);
  expect(method).toBe('bröst');
});

test('editing a feed: method can be changed to Flaska', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fFrom', '10:00');
  await page.fill('#fTo', '10:10');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await page.locator('#feedList .ev').first().locator('button[title="Ändra"]').click();
  await page.waitForSelector('#sheet.show');
  await page.locator('#efMethodChips [data-v="flaska"]').click();
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Amning ändrad');
  await expect(page.locator('#feedList .ev .b').first()).toContainText('Flaska');
});

test('editing a feed: under one minute is rejected', async ({ page }) => {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fFrom', '10:00');
  await page.fill('#fTo', '10:10');
  await page.locator('.save').click();

  await page.locator('#feedList .ev').first().locator('button[title="Ändra"]').click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#efTo', '10:00');
  await page.locator('.save').click();

  await expect(page.locator('#toast')).toContainText('Starttid och sluttid kan inte vara samma');
  await expect(page.locator('#sheet')).toHaveClass(/show/);
});
