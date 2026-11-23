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
    await kingdom.locator('#kingdomStartMonth').fill('2005-07');
    await kingdom.locator('#startKingdom').click();
    assert.equal(await kingdom.evaluate(() => gameDate(0).toISOString()), '2005-07-01T00:00:00.000Z');
    assert.equal(await kingdom.evaluate(() => S.player), 'UHK');
    assert.equal(await kingdom.locator('#royalRegion option').count(), 28);
    await kingdom.getByRole('heading',{name:'خط الإنتاج الأول',exact:true}).waitFor();
    await kingdom.locator('#planBudget').click();
    await kingdom.getByText('الإنفاق الدفاعي',{exact:true}).first().waitFor();
    await kingdom.locator('[data-view="overview"]').click();
    await kingdom.locator('#openIndustrialPlan').click();
    await kingdom.getByRole('heading',{name:'الإنتاج الصناعي',exact:true}).waitFor();
    await kingdom.locator('[data-view="overview"]').click();
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
    await kingdom.locator('#citySelect option:checked').filter({hasText:'غزة'}).waitFor({state:'attached'});
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
    assert.equal(await kingdom.locator('html').getAttribute('dir'), 'rtl');
    assert.equal(await kingdom.locator('[data-view="economy"] .navlabel').innerText(), 'الاقتصاد');
    assert.equal(await kingdom.getByText('غير محدود', {exact:true}).count(), 7);
    await kingdom.locator('#royalFacility').selectOption('oil');
    await kingdom.locator('#royalApproveFacility').click();
    assert(await kingdom.evaluate(() => S.kingdom.industry.facilities.some(x=>x.type==='oil'&&x.region==='PSE')));
    await kingdom.locator('#saveTop').click();
    await kingdom.reload();
    await kingdom.locator('#startLoad2').click();
    assert.equal(await kingdom.locator('#royalRegion').inputValue(), 'PSE');
    assert.equal(await kingdom.evaluate(() => player().fund), savedFinances.fund);
    assert.equal(await kingdom.evaluate(() => S.kingdom.industry.facilities.length), 1);
    await kingdom.locator('[data-view="economy"]').click();
    await kingdom.getByRole('heading',{name:'الحسابات الوطنية',exact:true}).waitFor();
    await kingdom.locator('[data-view="policies"]').click();
    await kingdom.getByText('الإنفاق الدفاعي', {exact:true}).first().waitFor();
    await kingdom.locator('[data-view="agencies"]').click();
    await kingdom.getByRole('heading',{name:'زايد والوكلاء',exact:true}).waitFor();
    await kingdom.getByText('أمّن هذه المدخلات قبل الاعتماد: خام الحديد، الكهرباء',{exact:true}).waitFor();
    assert.equal(await kingdom.locator('[data-zayed][disabled]').count(),1);
    const beforeOrders = await kingdom.evaluate(() => S.kingdom.council.orders.length);
    await kingdom.locator('[data-zayed]:not([disabled])').first().click();
    assert(await kingdom.evaluate(count => S.kingdom.council.orders.length === count + 1 &&
      S.kingdom.council.orders.at(-1).source === 'zayed', beforeOrders));
    await kingdom.locator('[data-royal-transfer-site="oil:PSE"]').click();
    assert(await kingdom.evaluate(() => S.kingdom.industry.facilities.some(f=>f.type==='oil'&&f.region==='PSE'&&f.company==='energy')));
    await kingdom.locator('#royalOrderSector').selectOption('industry');
    await kingdom.locator('#royalOrderAmount').fill('0.4');
    await kingdom.locator('#royalAppropriate').click();
    await kingdom.locator('#royalOrderSector').selectOption('industry');
    await kingdom.locator('#royalOrderAmount').fill('0.3');
    await kingdom.locator('#royalCapitalize').click();
    await kingdom.locator('#royalOrderProject').selectOption('steel');
    await kingdom.locator('#royalOrderRegion').selectOption('SAU');
    await kingdom.locator('#royalConstruct').click();
    await kingdom.locator('[data-council-site="steel:SAU"]').click();
    await kingdom.locator('#royalOrderAmount').fill('0.02');
    await kingdom.locator('#royalCompanyReturn').click();
    await kingdom.locator('#royalOrderAmount').fill('0.05');
    await kingdom.locator('#royalMinistryReturn').click();
    assert(await kingdom.evaluate(() => S.kingdom.council.orders.slice(-2)
      .map(order=>order.kind).join(',')==='companyReturn,ministryReturn'));
    assert(await kingdom.evaluate(() => S.kingdom.industry.facilities.some(f=>f.type==='steel'&&f.company==='industry'&&f.paused)));
    await kingdom.locator('#saveTop').click();
    await kingdom.reload();
    await kingdom.locator('#startLoad2').click();
    assert(await kingdom.evaluate(() => S.kingdom.council.orders.some(o=>o.source==='zayed')&&
      S.kingdom.industry.facilities.some(f=>f.type==='steel'&&f.company==='industry'&&f.paused)));
    assert(await kingdom.evaluate(() => player().cities.find(city => city.id === 'PSE-0').queue.length === 1));
    assert.deepEqual(await advanceToDecade(kingdom), { month: 120, year: 2015, finiteOutput: true });
    await kingdom.locator('#saveTop').click();
    await kingdom.reload();
    await kingdom.locator('#startLoad2').click();
    assert.equal(await kingdom.evaluate(() => S.month), 120);
    assert(await kingdom.evaluate(() => player().cities.find(city => city.id === 'PSE-0').levels.hospital === 1));
    await kingdom.locator('[data-view="settings"]').click();
    await kingdom.locator('[data-era="e1970"]').click();
    await kingdom.getByRole('heading',{name:'بدء المملكة في ١٩٧٠؟',exact:true}).waitFor();
    await kingdom.locator('#closeModal').click();
    assert.equal(await kingdom.evaluate(() => S.month), 120);
    await kingdom.locator('[data-era="e1970"]').click();
    await kingdom.locator('#confirmEra').click();
    assert.deepEqual(await kingdom.evaluate(() => ({
      player:S.player, year:S.startYear, month:S.month, language:document.documentElement.lang,
      regions:player().regions.length, companies:Object.keys(S.kingdom.council.companies).length,
    })), {player:'UHK',year:1970,month:0,language:'ar',regions:28,companies:3});
    assert.equal(await kingdom.evaluate(() => JSON.parse(localStorage.getItem('sovereign-save-v1')).startYear),2005);
    const preset = await browser.newPage();
    preset.on('pageerror',error=>errors.push(error.message));
    await preset.goto(url);
    await preset.locator('[data-kingdom-start="e1970"]').click();
    assert.equal(await preset.evaluate(() => S.player+':'+S.startYear+':'+document.documentElement.lang),'UHK:1970:ar');
    assert.deepEqual(errors, []);
    console.log('PASS: 120 browser months in both scenarios, map selection, city project, Arabic policy and accounts, royal orders, Zayed approvals, 1970 Kingdom restart and save imports.');
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
