const assert = require('node:assert/strict');
const { chromium, webkit, devices } = require('playwright');

const iPhoneSizes = ['iPhone SE', 'iPhone 14', 'iPhone 14 landscape'];

async function assertFits(page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    workspace: document.querySelector('.workspace').getBoundingClientRect().width,
    inspector: document.querySelector('.inspector').getBoundingClientRect().width,
  }));
  assert(layout.content <= layout.viewport + 1, `horizontal overflow: ${JSON.stringify(layout)}`);
  assert(layout.workspace >= layout.viewport - 2, 'the map and events use the full viewport width');
  assert(layout.inspector >= layout.viewport - 2, 'the inspector uses the full viewport width');
}

async function testDevice(browser, name, url) {
  const context = await browser.newContext(devices[name]);
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('[data-kingdom-start="e1970"]').tap();
    await page.getByText('أحداث العالم', {exact:true}).first().waitFor();
    await page.locator('#mapFocusBtn').filter({hasText:'استكشاف الخريطة'}).waitFor();
    assert.match(await page.locator('#legend').innerText(), /دولتك/);
    assert(!/[A-Za-z]/.test(await page.locator('#legend').innerText()), 'map key is Arabic');
    await page.locator('#mapmode').selectOption('stability');
    assert.match(await page.locator('#legend').innerText(), /الأخضر للاستقرار/);
    await page.locator('#mapmode').selectOption('political');
    assert(await page.locator('#saveTop').isVisible(), 'saving is available in the phone header');
    await page.locator('#saveTop').tap();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sovereign-save-v1')).player), 'UHK');
    await assertFits(page);

    await page.evaluate(() => {
      addEvent('Difficulty set','Easy rules are in force. '+DIFFICULTY.easy.blurb,'model');
      renderEvents();
    });
    await page.locator('#events').getByText('النموذج', {exact:true}).first().waitFor();
    assert.match(await page.locator('#events .event').first().innerText(), /الدين العام معطّل/);
    assert(!/rules are in force|MODEL|National debt/.test(await page.locator('#events .event').first().innerText()));

    const picker = page.locator('#mobileViewSelect');
    for (const view of ['history', 'economy', 'agencies', 'policies', 'settings']) {
      await picker.selectOption(view);
      assert.equal(await picker.inputValue(), view);
      await assertFits(page);
    }
    await picker.selectOption('economy');
    await page.locator('#royalUnlimitedIncome').check();
    assert(await page.locator('#royalUnlimitedIncome').isChecked());
    assert(await page.evaluate(()=>S.kingdom.treasury.unlimitedIncome===true));
    await page.locator('#saveTop').tap();
    assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('sovereign-save-v1')).kingdom.treasury.unlimitedIncome===true));
    await picker.selectOption('history');
    assert(await page.getByRole('heading', {name:'أرشيف الأحداث', exact:true}).isVisible());
    assert(!/rules are in force/.test(await page.locator('#panel').innerText()));

    await page.locator('#mapFocusBtn').tap();
    assert(await page.locator('body').evaluate(el=>el.classList.contains('mapfocus')));
    const close = page.locator('#mapFocusBtn').filter({hasText:'إغلاق الخريطة'});
    await close.waitFor();
    const zoom = page.locator('.zoom');
    const [closeBox, zoomBox] = await Promise.all([close.boundingBox(),zoom.boundingBox()]);
    assert(closeBox && zoomBox && zoomBox.y + zoomBox.height <= closeBox.y, 'zoom must not cover the map exit');
    await page.locator('#zoomIn').tap();
    await close.tap();
    assert(await picker.isVisible(), 'the view selector returns after closing the map');
    await assertFits(page);
    assert.deepEqual(errors, []);
    console.log(`PASS: ${name} · RTL layout, translated report and map, section navigation, save control`);
  } finally {
    await context.close();
  }
}

async function main(){
  const useWebkit=process.env.SOVEREIGN_MOBILE_ENGINE==='webkit';
  const browser=await (useWebkit?webkit:chromium).launch({
    executablePath:useWebkit?process.env.SOVEREIGN_WEBKIT:process.env.SOVEREIGN_CHROMIUM,
  });
  try {
    const url=process.argv[2]??'http://127.0.0.1:8047/play/';
    for(const name of iPhoneSizes)await testDevice(browser,name,url);
  } finally {
    await browser.close();
  }
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
