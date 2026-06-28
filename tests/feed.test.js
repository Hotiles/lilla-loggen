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
  await expect(page.locator('#timer')).toHaveText('––:––');
  await expect(page.locator('#timer')).toHaveClass(/idle/);
  await expect(page.locator('#stopBtn')).toBeHidden();

  await expect(page.locator('#feedList .ev')).toHaveCount(1);
  await expect(page.locator('#feedList .ev .a').first()).toHaveText('Amning');
  await expect(page.locator('#feedList .ev .b').first()).toContainText('Vänster');
});

test('clicking the active side button stops the session', async ({ page }) => {
  await page.locator('#btnL').click();
  await expect(page.locator('#stopBtn')).toBeVisible();

  await page.locator('#btnL').click();

  await expect(page.locator('#stopBtn')).toBeHidden();
  await expect(page.locator('#timer')).toHaveText('––:––');
  await expect(page.locator('#feedList .ev')).toHaveCount(1);
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
