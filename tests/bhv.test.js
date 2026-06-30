const { test, expect } = require('@playwright/test');
const { freshPage } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await freshPage(page);
});

// ---------- rena funktioner (summarizeForVisit, getVisitForAge, childAgeInDays) ----------

test('summarizeForVisit: normalfall räknar per dygn ur befintlig data', async ({ page }) => {
  const res = await page.evaluate(() => {
    const day = 864e5;
    const now = 1000 * day; // godtyckligt "nu" i ms
    const period = { from: now - 2 * day, to: now };
    const events = [
      // 2 amningar: 10 och 20 min
      { type: 'feed', ts: now - day, durMs: 10 * 60000 },
      { type: 'feed', ts: now - day + 3600e3, durMs: 20 * 60000 },
      // blöjor
      { type: 'diaper', ts: now - day, val: 'Kiss' },
      { type: 'diaper', ts: now - day, val: 'Båda' }, // räknas som både våt och bajs
      { type: 'diaper', ts: now - day, val: 'Bajs' },
      // tupplurar
      { type: 'nap', ts: now - day },
      { type: 'nap', ts: now - day },
      // nattsömn (rating 4 + 2 => snitt 3)
      { type: 'nightsleep', ts: now - day, rating: 4 },
      { type: 'nightsleep', ts: now - day, rating: 2 },
      // vikt
      { type: 'weight', ts: now - 2 * day, val: 6000 },
      { type: 'weight', ts: now - day, val: 6300 },
      // utanför intervallet – ska ignoreras
      { type: 'feed', ts: now - 10 * day, durMs: 99 * 60000 },
    ];
    return summarizeForVisit(events, period, now);
  });

  expect(res.feeding.perDay).toBe(1); // 2 amningar / 2 dygn
  expect(res.feeding.avgMinutesPerFeed).toBe(15);
  expect(res.diapers.wetPerDay).toBe(1); // (Kiss + Båda) / 2
  expect(res.diapers.dirtyPerDay).toBe(1); // (Bajs + Båda) / 2
  expect(res.naps.perDay).toBe(1);
  expect(res.nightSleep.avgRating).toBe(3);
  expect(res.nightSleep.nights).toBe(2);
  expect(res.weight.latest).toBe(6300);
  expect(res.weight.deltaSincePeriodStart).toBe(300);
});

test('summarizeForVisit: tomt intervall ger null per block (ingen krasch)', async ({ page }) => {
  const res = await page.evaluate(() => {
    const now = 1000 * 864e5;
    return summarizeForVisit([], { from: now - 864e5, to: now }, now);
  });
  expect(res.feeding).toBeNull();
  expect(res.diapers).toBeNull();
  expect(res.naps).toBeNull();
  expect(res.nightSleep).toBeNull();
  expect(res.weight).toBeNull();
});

test('summarizeForVisit: en enda vikt ger null delta', async ({ page }) => {
  const res = await page.evaluate(() => {
    const now = 1000 * 864e5;
    const events = [{ type: 'weight', ts: now - 60000, val: 5000 }];
    return summarizeForVisit(events, { from: now - 864e5, to: now }, now);
  });
  expect(res.weight.latest).toBe(5000);
  expect(res.weight.deltaSincePeriodStart).toBeNull();
});

test('childAgeInDays och getVisitForAge mot födelsedatum', async ({ page }) => {
  const res = await page.evaluate(() => {
    const now = new Date(2026, 5, 30, 12).getTime();
    const birth = '2026-05-19'; // 42 dagar tidigare => 6-veckorsbesöket
    const age = childAgeInDays(birth, now);
    return { age, visit: getVisitForAge(age).age, none: childAgeInDays(null, now) };
  });
  expect(res.age).toBe(42);
  expect(res.visit).toBe('6v');
  expect(res.none).toBeNull();
});

// ---------- UI-flöden ----------

async function setBirthDate(page, iso) {
  await page.locator('#nav-settings').click();
  await page.fill('#birthDateInput', iso);
  await page.locator('#birthDateInput').dispatchEvent('change');
}

// barn fött ~6 veckor sedan så att schemat har kommande besök
function sixWeeksAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 42);
  return d.toISOString().slice(0, 10);
}

test('BVC-vyn ber om födelsedatum när det saknas', async ({ page }) => {
  await page.locator('#nav-bhv').click();
  await expect(page.locator('#bhvContent')).toContainText('födelsedatum');
});

test('lägg till fundering hänger på nästa besök och överlever omladdning', async ({ page }) => {
  await setBirthDate(page, sixWeeksAgoIso());
  await page.locator('#nav-bhv').click();
  await expect(page.locator('.bhv-card')).not.toHaveCount(0);

  await page.fill('#bhvQuickPrep', 'Fråga om D-vitamin');
  await page.locator('#bhvQuickPrep + button').click();
  await expect(page.locator('#bhvContent')).toContainText('fundering');

  await page.reload();
  await page.waitForSelector('#feedList');
  await page.locator('#nav-bhv').click();
  await expect(page.locator('#bhvContent')).toContainText('fundering');
});

test('bocka av milstolpe sparas och överlever omladdning', async ({ page }) => {
  await setBirthDate(page, sixWeeksAgoIso());
  await page.locator('#nav-bhv').click();
  await page.locator('.bhv-card').first().click();
  await expect(page.locator('.ms-chip')).not.toHaveCount(0);

  await page.locator('.ms-chip').first().click();
  await expect(page.locator('.ms-chip.checked')).toHaveCount(1);

  await page.reload();
  await page.waitForSelector('#feedList');
  await page.locator('#nav-bhv').click();
  await page.locator('.bhv-card').first().click();
  await expect(page.locator('.ms-chip.checked')).toHaveCount(1);
});

test('spara utfall flyttar besöket till Tidigare', async ({ page }) => {
  await setBirthDate(page, sixWeeksAgoIso());
  await page.locator('#nav-bhv').click();
  await page.locator('.bhv-card').first().click();

  await page.fill('#ocWeight', '4800');
  await page.fill('#ocNotes', 'Allt såg bra ut');
  await page.locator('.save').click();

  await expect(page.locator('#bhvContent')).toContainText('Tidigare');
  await expect(page.locator('#bhvContent')).toContainText('Genomfört');
});

test('export → wipe → import återställer BVC-data', async ({ page }) => {
  await setBirthDate(page, sixWeeksAgoIso());
  await page.locator('#nav-bhv').click();
  await page.fill('#bhvQuickPrep', 'Fråga om sömn');
  await page.locator('#bhvQuickPrep + button').click();
  await expect(page.locator('#bhvContent')).toContainText('fundering');

  // exportera till JSON i minnet
  const json = await page.evaluate(async () => JSON.stringify(await collectData()));
  expect(json).toContain('Fråga om sömn');

  // wipe
  await page.locator('#nav-settings').click();
  page.once('dialog', (d) => d.accept());
  await page.locator('button:has-text("Radera all data")').click();
  await expect(page.locator('#babyName')).toHaveText('Bebis');

  // importera igen
  await page.evaluate(async (raw) => { await applyData(JSON.parse(raw)); }, json);

  await page.locator('#nav-bhv').click();
  await expect(page.locator('#bhvContent')).toContainText('fundering');
});
