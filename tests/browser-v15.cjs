const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('playwright');

async function advanceToDecade(page) {
  return page.evaluate(() => {
    while (S.month < 120) {
      const previous = S.month;
      document.querySelector('#step').click();
      if (S.month !== previous + 1) throw Error('The step button did not advance one month');
    }
    return {
      month: S.month,
      year: gameDate(S.month).getUTCFullYear(),
      finiteOutput: S.nations.every(nation => Number.isFinite(nation.gdp)),
    };
  });
}

async function main() {
  const url = process.argv[2] ?? 'http://127.0.0.1:8015/play/';
  const executablePath = process.env.SOVEREIGN_CHROMIUM;
  const temp = await mkdtemp(join(tmpdir(), 'sovereign-browser-'));
  let browser;
  try {
    browser = await chromium.launch({ executablePath });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('#countrySearch').fill('Jordan');
    await page.locator('[data-pick="JOR"]').click();
    await page.locator('[data-era-start="e1970"] button').click();
    for (let month = 1; month <= 11; month++) {
      await page.locator('#step').click();
    }
    await page.locator('#saveTop').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sovereign-save-v1')));
    assert.equal(saved.month, 11);

    await page.reload();
    await page.locator('#startLoad2').click();
    assert.deepEqual(await page.evaluate(() => S), saved);
    await page.locator('#step').click();
    assert.equal(await page.evaluate(() => S.month), 12);
    assert.match(await page.locator('#date').innerText(), /1971/);
    for (const view of ['economy', 'cities', 'settings']) {
      await page.locator(`[data-view="${view}"]`).click();
    }
    await page.locator('[data-speed="12"]').click();
    await page.locator('#play').click();
    await page.waitForFunction(() => S.month >= 13);
    await page.locator('#play').click();
    assert.equal(await page.evaluate(() => playing), false);

    assert.deepEqual(await advanceToDecade(page), { month: 120, year: 1980, finiteOutput: true });
    assert(await page.evaluate(() => paths.some(path => path.id === 'VNM')));

    const pendingDownload = page.waitForEvent('download');
    await page.locator('[data-action="export"]').click();
    const download = await pendingDownload;
    const saveFile = join(temp, download.suggestedFilename());
    await download.saveAs(saveFile);

    const fresh = await browser.newPage();
    fresh.on('pageerror', error => errors.push(error.message));
    await fresh.goto(url);
    await fresh.locator('#closeModal').click();
    await fresh.locator('[data-view="settings"]').click();
    await fresh.locator('#importFile').setInputFiles(saveFile);
    await fresh.waitForFunction(() => S.month === 120);
    assert.equal(await fresh.evaluate(() => S.player), 'JOR');
    const kingdom = await browser.newPage();
    kingdom.on('pageerror', error => errors.push(error.message));
    await kingdom.goto(url);
    await kingdom.locator('#startKingdom').click();
    assert.equal(await kingdom.evaluate(() => S.player), 'UHK');
    assert.equal(await kingdom.locator('#royalRegion option').count(), 28);
    const mapped = await kingdom.evaluate(() => {
      const scale = transform();
      return [[34.4, 31.43], [50.55, 26.1]].map(([lon, lat]) => {
        const [x, y] = project(lon, lat);
        return hitMap(scale.x + x * scale.scale, scale.y + y * scale.scale);
      });
    });
    assert.deepEqual(mapped, ['UHK', 'UHK'], 'Gaza and Bahrain belong to the Crown on the actual canvas');
    const gaza = await kingdom.evaluate(() => {
      const t = transform();
      const [x, y] = project(34.4, 31.43);
      const box = document.querySelector('#map').getBoundingClientRect();
      return { x: box.left + t.x + x * t.scale, y: box.top + t.y + y * t.scale };
    });
    await kingdom.mouse.click(gaza.x, gaza.y);
    assert.equal(await kingdom.locator('#royalRegion').inputValue(), 'PSE');
    await kingdom.locator('#royalRegionCities').click();
    assert.match(await kingdom.locator('#citySelect option:checked').innerText(), /Gaza City/);
    const hospital = kingdom.locator('#panel [data-build="hospital"]');
    await hospital.locator('xpath=ancestor::details').locator('summary').click();
    await hospital.click();
    assert(await kingdom.evaluate(() => player().cities.find(city => city.id === 'PSE-0').queue.length === 1));
    await kingdom.evaluate(() => {
      S.options.freeReforms = true;
      S.options.fastReforms = true;
      enact({ ...player().targets, taxMode: 'simple', tax: 55 });
    });
    await kingdom.locator('#step').click();
    await kingdom.locator('[data-view="economy"]').click();
    const opening = await kingdom.evaluate(() => S.kingdom.treasury.cash);
    assert(opening > 0);
    await kingdom.locator('#royalTransferAmount').fill(String(opening / 2));
    await kingdom.locator('#royalDeposit').click();
    const savedFinances = await kingdom.evaluate(() => ({
      fund: player().fund, cash: S.kingdom.treasury.cash, orders: S.kingdom.treasury.transfers.length,
    }));
    assert.deepEqual(savedFinances, { fund: opening / 2, cash: opening / 2, orders: 1 });
    await kingdom.locator('#saveTop').click();
    await kingdom.reload();
    await kingdom.locator('#startLoad2').click();
    assert.equal(await kingdom.locator('#royalRegion').inputValue(), 'PSE');
    assert.equal(await kingdom.evaluate(() => player().fund), savedFinances.fund);
    assert(await kingdom.evaluate(() => player().cities.find(city => city.id === 'PSE-0').queue.length === 1));
    assert.deepEqual(await advanceToDecade(kingdom), { month: 120, year: 2000, finiteOutput: true });
    await kingdom.locator('#saveTop').click();
    await kingdom.reload();
    await kingdom.locator('#startLoad2').click();
    assert.equal(await kingdom.evaluate(() => S.month), 120);
    assert(await kingdom.evaluate(() => player().cities.find(city => city.id === 'PSE-0').levels.hospital === 1));
    assert.deepEqual(errors, []);
    console.log('PASS: 120 browser months in both scenarios, map selection, city project, saved sovereign transfer and save imports.');
  } finally {
    try {
      await browser?.close();
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
