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

async function logManualFeedSide(page, from, to, side) {
  await page.locator('#feedRetroBtn').click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#fFrom', from);
  await page.fill('#fTo', to);
  if (side) await page.locator(`#sheet [data-v="${side}"]`).click();
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });
}

async function setBirthData(page, isoDate, grams) {
  await page.locator('#nav-settings').click();
  await page.fill('#birthDateInput', isoDate);
  await page.locator('#birthDateInput').dispatchEvent('change');
  if (grams != null) {
    await page.fill('#birthWeightInput', String(grams));
    await page.locator('#birthWeightInput').dispatchEvent('change');
  }
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

test('diaper breakdown surfaces wet, poop and dry counts', async ({ page }) => {
  await logDiaper(page, 'Kiss');
  await logDiaper(page, 'Bajs');
  await logDiaper(page, 'Båda');
  await logDiaper(page, 'Torr');

  await page.locator('#nav-stats').click();

  // våta = Kiss + Båda, bajs = Bajs + Båda, torra = Torr
  await expect(page.locator('#diaperBreakdown')).toContainText('2 våta');
  await expect(page.locator('#diaperBreakdown')).toContainText('2 bajs');
  await expect(page.locator('#diaperBreakdown')).toContainText('1 torra');
});

// ── Feeding rhythm ───────────────────────────────────────────────────────────

test('rhythm shows average interval and longest pause between feeds', async ({ page }) => {
  await logManualFeed(page, '08:00', '08:10'); // start 08:00
  await logManualFeed(page, '10:00', '10:30'); // +2 h
  await logManualFeed(page, '13:00', '13:20'); // +3 h

  await page.locator('#nav-stats').click();

  const rhythm = page.locator('#rhythmSection');
  await expect(rhythm.locator('.stat').filter({ hasText: 'Snitt mellan' }).locator('.n')).toHaveText('2 h 30 min');
  await expect(rhythm.locator('.stat').filter({ hasText: 'Längsta paus' }).locator('.n')).toHaveText('3 h 0 min');
  await expect(rhythm.locator('.stat').filter({ hasText: 'Tid vid bröstet' }).locator('.n')).toHaveText('1 h 0 min');
});

test('rhythm asks for more feeds when there are none', async ({ page }) => {
  await page.locator('#nav-stats').click();

  await expect(page.locator('#rhythmSection')).toContainText('Logga fler amningar');
});

// ── Side balance ─────────────────────────────────────────────────────────────

test('side balance counts left and right feeds', async ({ page }) => {
  await logManualFeedSide(page, '08:00', '08:15', 'Vänster');
  await logManualFeedSide(page, '10:00', '10:15', 'Vänster');
  await logManualFeedSide(page, '12:00', '12:15', 'Höger');

  await page.locator('#nav-stats').click();

  const legend = page.locator('#sideBalance .sidebar-legend');
  await expect(legend).toContainText('Vänster 2');
  await expect(legend).toContainText('1 Höger');
});

test('side balance hidden when no sided feeds exist', async ({ page }) => {
  await page.locator('#nav-stats').click();

  await expect(page.locator('#sideBalance')).toBeEmpty();
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

test('weight shows gain rate and status against birth weight', async ({ page }) => {
  const born = new Date();
  born.setDate(born.getDate() - 14);
  await setBirthData(page, born.toISOString().slice(0, 10), 3500);

  await page.locator('#nav-home').click();
  await page.locator('.q').filter({ hasText: 'Vikt' }).click();
  await page.waitForSelector('#sheet.show');
  await page.fill('#wVal', '4000');
  await page.locator('.save').click();
  await page.locator('#sheet').waitFor({ state: 'hidden' });

  await page.locator('#nav-stats').click();

  await expect(page.locator('#weightStat')).toContainText('g/vecka');
  await expect(page.locator('#weightStat')).toContainText('Över födelsevikten (+500 g)');
});

// ── Range selector drives the summary ─────────────────────────────────────────

test('range buttons update the summary heading', async ({ page }) => {
  await page.locator('#nav-stats').click();

  await expect(page.locator('#statHeading')).toHaveText('Senaste 7 dagarna');
  await page.locator('#chartRangeRow [data-r="dag"]').click();
  await expect(page.locator('#statHeading')).toHaveText('Senaste 24h');
  await page.locator('#chartRangeRow [data-r="manad"]').click();
  await expect(page.locator('#statHeading')).toHaveText('Senaste 30 dagarna');
});

test('summary counts follow the selected range window', async ({ page }) => {
  // en amning 3 dygn tillbaka: inom veckan men utanför senaste 24h
  await page.evaluate(async () => {
    const ts = Date.now() - 3 * 864e5;
    await put(STORE, { id: 'old1', type: 'feed', ts, end: ts + 6e5, durMs: 6e5, side: 'Vänster' });
    await render();
  });
  await page.locator('#nav-stats').click();

  const amningar = page.locator('#statGrid .stat').filter({ hasText: 'Amningar' }).locator('.n');
  await expect(amningar).toHaveText('1'); // standard = vecka
  await page.locator('#chartRangeRow [data-r="dag"]').click();
  await expect(amningar).toHaveText('0'); // senaste 24h utesluter den
});

// ── Day/night pattern ─────────────────────────────────────────────────────────

test('dygnsrytm shows the night share of feeds', async ({ page }) => {
  await page.evaluate(async () => {
    const mk = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.getTime(); };
    await put(STORE, { id: 'n1', type: 'feed', ts: mk(2), end: mk(2) + 6e5, durMs: 6e5, side: 'Vänster' }); // natt
    await put(STORE, { id: 'd1', type: 'feed', ts: mk(14), end: mk(14) + 6e5, durMs: 6e5, side: 'Höger' }); // dag
    await render();
  });
  await page.locator('#nav-stats').click();

  await expect(page.locator('#nightShare')).toContainText('1 av 2 amningar på natten');
  await expect(page.locator('#nightShare')).toContainText('50%');
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
