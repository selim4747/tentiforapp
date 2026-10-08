import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';

const engines = [['Chromium', chromium], ['Firefox', firefox], ['WebKit', webkit]];
const results = [];

for (const [name, engine] of engines) {
  let browser;
  try {
    browser = await engine.launch({ headless: true });
  } catch (error) {
    results.push(`${name}: SKIP (${String(error.message).split('\n')[0]})`);
    continue;
  }

  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ana-tomye', { timeout: 15000 });
    await page.waitForSelector('#altMenu', { timeout: 15000 });

    const mobile = await page.evaluate(() => {
      const hero = document.querySelector('.ana-tomye');
      const primary = document.querySelector('.hero-eylem .dugme');
      const nav = document.querySelector('#altMenu');
      const tip = document.querySelector('#turIpucu');
      const r = (element) => element.getBoundingClientRect();
      return {
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        background: getComputedStyle(document.documentElement).getPropertyValue('--kar').trim().toLowerCase(),
        heroRadius: parseFloat(getComputedStyle(hero).borderTopLeftRadius),
        primaryHeight: Math.round(r(primary).height),
        navHeight: Math.round(r(nav).height),
        navBottom: Math.round(r(nav).bottom),
        tipBottom: tip ? Math.round(r(tip).bottom) : null,
        navTop: Math.round(r(nav).top),
      };
    });
    assert.equal(mobile.width, 390, `${name}: mobile viewport was not applied`);
    assert.ok(mobile.documentWidth <= mobile.width + 1, `${name}: horizontal overflow ${JSON.stringify(mobile)}`);
    assert.equal(mobile.background, '#f5f7f4', `${name}: light mobile palette should be calm and consistent`);
    assert.ok(mobile.heroRadius >= 18, `${name}: hero card should have a soft rounded shape`);
    assert.ok(mobile.primaryHeight >= 44, `${name}: primary action should meet touch target minimum`);
    assert.ok(mobile.navHeight >= 60, `${name}: bottom navigation should include safe-area space`);
    if (mobile.tipBottom !== null) assert.ok(mobile.tipBottom <= mobile.navTop + 1, `${name}: onboarding tip must not cover bottom navigation`);

    await page.evaluate(() => document.documentElement.setAttribute('data-ayar-tema', 'gece'));
    const darkBackground = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--kar').trim().toLowerCase());
    assert.equal(darkBackground, '#0b1017', `${name}: mobile palette must preserve the existing night theme`);
    assert.equal(pageErrors.length, 0, `${name}: runtime errors ${pageErrors.join('; ')}`);
    results.push(`${name}: PASS (390px home, calm mobile palette, no horizontal overflow, touch CTA, safe bottom navigation, onboarding clearance, night theme)`);
    await page.close();
  } catch (error) {
    results.push(`${name}: FAIL (${error.stack || error})`);
  } finally {
    await browser.close();
  }
}

for (const result of results) console.log(result);
if (results.some((result) => result.includes(': FAIL'))) process.exitCode = 1;
