async function freshPage(page) {
  await page.goto('/');
  await page.waitForSelector('#feedList');
  await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('lillaloggen');
    req.onsuccess = resolve;
    req.onerror = resolve;
    req.onblocked = resolve;
  }));
  await page.reload();
  await page.waitForSelector('#feedList');
}

module.exports = { freshPage };
