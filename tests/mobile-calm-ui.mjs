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
    let rumMocks = 0;
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('https://static.cloudflareinsights.com/**', async (route) => {
      rumMocks += 1;
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ana-tomye', { timeout: 15000 });
    await page.waitForSelector('#altMenu', { timeout: 15000 });
    await page.waitForSelector('#anaEvrenler .ana-evren-sar .ana-yildiz', { timeout: 15000 });
    await page.waitForSelector('#tfDockTetik', { timeout: 15000 });
    await page.waitForSelector('#rastgeleEvrenHero', { timeout: 15000 });
    await page.waitForFunction(() => { const button = document.querySelector('#rastgeleEvrenHero'); return !!button?.dataset.rastgeleEvren && /^#\/ev\/site\/(e24|ax24)$/i.test(button.getAttribute('href') || ''); }, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('#turIpucu')?.nextElementSibling?.matches('.hero-eylem'), { timeout: 15000 });

    const mobile = await page.evaluate(() => {
      const hero = document.querySelector('.ana-tomye');
      const primary = document.querySelector('#rastgeleEvrenHero');
      const random = document.querySelector('#rastgeleEvrenHero');
      const more = document.querySelector('.hero-diger-yollar, .hero-baslangic-yollari');
      const nav = document.querySelector('#altMenu');
      const tip = document.querySelector('#turIpucu');
      const toolbar = document.querySelector('.tf644-reading-toolbar');
      const intro = document.querySelector('.ana-giris');
      const codeButton = document.querySelector('#btnKod');
      const quickAccess = document.querySelector('#tfDockTetik');
      const visibleStarCards = [...document.querySelectorAll('#anaEvrenler .ana-evren-sar')]
        .filter((card) => card.getBoundingClientRect().width > 0 && card.querySelector('.ana-yildiz'));
      const starsAnchored = visibleStarCards.length > 0 && visibleStarCards.every((wrapper) => {
        const box = wrapper.getBoundingClientRect();
        const star = wrapper.querySelector('.ana-yildiz').getBoundingClientRect();
        return getComputedStyle(wrapper).position === 'relative'
          && star.left >= box.left - 1 && star.right <= box.right + 1
          && star.top >= box.top - 1 && star.bottom <= box.bottom + 1;
      });
      const rect = (element) => element.getBoundingClientRect();
      const primaryBox = rect(primary);
      const tipBox = tip ? rect(tip) : null;
      const navBox = rect(nav);
      const quickAccessBox = rect(quickAccess);
      const tourPoint = tipBox && document.elementFromPoint(tipBox.left + tipBox.width / 2, tipBox.top + tipBox.height / 2);
      return {
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        background: getComputedStyle(document.documentElement).getPropertyValue('--kar').trim().toLowerCase(),
        heroRadius: parseFloat(getComputedStyle(hero).borderTopLeftRadius),
        primaryHeight: Math.round(primaryBox.height),
        primaryWidth: Math.round(primaryBox.width),
        randomWidth: Math.round(rect(random).width),
        randomTarget: random?.getAttribute('href') || '',
        randomId: random?.dataset.rastgeleEvren || '',
        moreVisible: Boolean(more && rect(more).height > 0),
        starsAnchored,
        navHeight: Math.round(navBox.height),
        navBottom: Math.round(navBox.bottom),
        navTop: Math.round(navBox.top),
        primaryBottom: Math.round(primaryBox.bottom),
        primaryAboveNav: primaryBox.bottom <= navBox.top + 1,
        tipBottom: tip ? Math.round(rect(tip).bottom) : null,
        tourTag: tip?.tagName || null,
        tourOpen: Boolean(tip?.open),
        tourModal: Boolean(tip?.matches(':modal')),
        tourHeight: tip ? Math.round(rect(tip).height) : 0,
        tourCoversPrimary: Boolean(tipBox && tipBox.left < primaryBox.right && tipBox.right > primaryBox.left && tipBox.top < primaryBox.bottom && tipBox.bottom > primaryBox.top),
        tourOwnsHitTest: Boolean(tip && tourPoint && (tourPoint === tip || tip.contains(tourPoint))),
        tourTitle: tip?.querySelector('#turBaslik')?.innerText.trim() || '',
        tourSkipText: tip?.querySelector('.tur-kapat')?.innerText.trim() || '',
        tourSkipLabel: tip?.querySelector('.tur-kapat')?.getAttribute('aria-label') || '',
        codeButtonText: codeButton?.innerText.trim() || '',
        codeButtonHidden: Boolean(codeButton && getComputedStyle(codeButton).display === 'none'),
        quickAccessWidth: Math.round(quickAccessBox.width),
        quickAccessHeight: Math.round(quickAccessBox.height),
        quickAccessLabel: quickAccess?.getAttribute('aria-label') || '',
        quickAccessCoversPrimary: quickAccessBox.left < primaryBox.right && quickAccessBox.right > primaryBox.left && quickAccessBox.top < primaryBox.bottom && quickAccessBox.bottom > primaryBox.top,
        toolbarDisplay: toolbar ? getComputedStyle(toolbar).display : 'absent',
        introText: intro?.innerText.trim() || '',
      };
    });

    assert.equal(mobile.width, 390, `${name}: mobile viewport was not applied`);
    assert.ok(mobile.documentWidth <= mobile.width + 1, `${name}: horizontal overflow ${JSON.stringify(mobile)}`);
    assert.equal(mobile.background, '#f5f7f4', `${name}: light mobile palette should be calm and consistent`);
    assert.ok(mobile.heroRadius >= 18, `${name}: hero card should have a soft rounded shape`);
    assert.ok(mobile.primaryHeight >= 44, `${name}: primary action should meet touch target minimum`);
    assert.ok(mobile.primaryAboveNav, `${name}: fixed bottom navigation must not cover the primary discovery action (${mobile.primaryBottom}px vs nav ${mobile.navTop}px)`);
    assert.match(mobile.randomTarget, /^#\/ev\/site\/(e24|ax24)$/i, `${name}: per-visit discovery must target a content-rich site universe and exclude E25`);
    assert.equal(mobile.randomId.toLowerCase(), mobile.randomTarget.split('/').at(-1).toLowerCase(), `${name}: selected universe ID must match the action target`);
    assert.equal(mobile.moreVisible, false, `${name}: duplicate homepage discovery controls should be removed`);
    assert.ok(mobile.starsAnchored, `${name}: each visible favorite star must stay inside its own universe card`);
    assert.ok(mobile.quickAccessWidth >= 40 && mobile.quickAccessWidth <= 48 && mobile.quickAccessHeight >= 40 && mobile.quickAccessHeight <= 48, `${name}: floating quick access must remain a compact touch target`);
    assert.equal(mobile.quickAccessCoversPrimary, false, `${name}: floating quick access must not overlap the primary CTA`);
    assert.match(mobile.quickAccessLabel, /Hızlı Erişim/, `${name}: compact quick access remains screen-reader discoverable`);
    assert.ok(mobile.navHeight >= 60, `${name}: bottom navigation should include safe-area space`);
    if (mobile.tipBottom !== null) assert.ok(mobile.tipBottom <= mobile.navTop + 1, `${name}: onboarding tip must not cover bottom navigation`);
    assert.equal(mobile.tourTag, 'DIALOG', `${name}: first-visit tour must use an accessible dialog`);
    assert.ok(mobile.tourOpen && !mobile.tourModal, `${name}: first-visit tour must remain a non-modal accessible dialog`);
    assert.equal(mobile.tourCoversPrimary, false, `${name}: first-visit tour must not cover the primary CTA`);
    assert.ok(mobile.tourOwnsHitTest, `${name}: first-visit tour must be visible and receive pointer hits above sticky controls`);
    assert.ok(mobile.tourHeight <= 240, `${name}: first-visit tour should stay compact, got ${mobile.tourHeight}px`);
    assert.ok(mobile.tourTitle, `${name}: tour must have a labelled heading`);
    assert.equal(mobile.tourSkipText, 'Atla', `${name}: tour skip action must be visible and explicit`);
    assert.equal(mobile.tourSkipLabel, 'Turu atla', `${name}: tour skip action must have an accessible label`);
    assert.equal(mobile.codeButtonText, 'Kod gir', `${name}: code action must remain available in the menu`);
    assert.ok(mobile.codeButtonHidden, `${name}: duplicate header code control should be removed on mobile`);
    assert.ok(['none', 'absent'].includes(mobile.toolbarDisplay), `${name}: reading-only controls should not clutter the mobile home screen`);
    assert.equal(mobile.introText, 'Evrenleri keşfet; oku, oyna ya da kendi evrenini kur.', `${name}: home intro should avoid unexplained jargon`);

    const menuButton = page.locator('[data-mobil-menu]:visible').first();
    assert.ok(await menuButton.count(), `${name}: mobile menu trigger should be visible`);
    await menuButton.click();
    await page.waitForFunction(() => {
      const menu = document.querySelector('#mobilMenu');
      return !!menu && !menu.hidden && menu.getBoundingClientRect().height > 0;
    });
    const menuState = await page.evaluate(() => {
      const menu = document.querySelector('#mobilMenu');
      const panel = menu?.querySelector('.mobil-menu');
      const nav = document.querySelector('#altMenu');
      return {
        navHidden: nav?.getAttribute('aria-hidden') === 'true' || getComputedStyle(nav).visibility === 'hidden' || getComputedStyle(nav).display === 'none',
        scrollable: Boolean(panel && ['auto', 'scroll'].includes(getComputedStyle(panel).overflowY)),
        groups: [...(menu?.querySelectorAll('.mm-eylemler .mm-grup-baslik') || [])].map((item) => item.textContent.trim()),
      };
    });
    assert.ok(menuState.navHidden, `${name}: bottom navigation must not remain visible over the open menu`);
    assert.ok(menuState.scrollable, `${name}: long mobile menu must scroll inside its own panel`);
    for (const group of ['Ziyaretçi alanları', 'Görünüm', 'Keşif', 'Üretim ve araçlar', 'Yönetim']) {
      assert.ok(menuState.groups.includes(group), `${name}: menu must group ${group}`);
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#mobilMenu')?.hidden !== false);

    await page.locator('#rastgeleEvrenHero').click();
    await page.waitForFunction(() => /^\/evren\/(e24|ax24)\/$/i.test(location.pathname), null, { timeout: 15000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#turIpucu'));
    const tourDismissed = await page.evaluate(() => localStorage.getItem('tentiforapp_tur'));
    assert.equal(tourDismissed, 'bitti', `${name}: Escape should dismiss and remember the tour`);

    await page.evaluate(() => document.documentElement.setAttribute('data-ayar-tema', 'gece'));
    const darkBackground = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--kar').trim().toLowerCase());
    assert.equal(darkBackground, '#0b1017', `${name}: mobile palette must preserve the existing night theme`);
    assert.equal(pageErrors.length, 0, `${name}: runtime errors ${pageErrors.join('; ')}`);
    results.push(`${name}: PASS (390px, safe CTA/nav spacing, random E24/Ax24 discovery, grouped scrollable menu, visible first-visit tour, no homepage clutter, Cloudflare RUM mocked, night theme; ${rumMocks} RUM request(s) mocked)`);
    await page.close();
  } catch (error) {
    results.push(`${name}: FAIL (${error.stack || error})`);
  } finally {
    await browser.close();
  }
}

for (const result of results) console.log(result);
if (results.some((result) => result.includes(': FAIL'))) process.exitCode = 1;
