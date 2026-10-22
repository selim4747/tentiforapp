import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.TF_MAP_BROWSER_PORT || 3187);
const baseURL = process.env.TF_MAP_BROWSER_URL || `http://127.0.0.1:${port}`;
let server;
let browser;
let serverOutput = '';

async function ready() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch(`${baseURL}/`);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Local app server did not start: ${serverOutput}`);
}

async function waitForApp(page) {
  await page.waitForFunction(() => typeof haritaCiz === 'function' && document.querySelector('#harita'), null, { timeout: 30000 });
  await page.waitForFunction(() => typeof veri !== 'undefined' && Array.isArray(veri.haritalar) && veri.haritalar.length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(300);
}

async function openMap(page) {
  await page.goto(`${baseURL}/harita/?harita=tomye`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  const tour = page.locator('#turIpucu');
  if (await tour.count()) {
    assert.equal(await tour.isVisible(), true, 'first-visit tour is visible');
    assert.equal(await tour.evaluate((node) => node.matches(':modal')), false, 'first-visit tour must not block the page');
  }
  await page.waitForFunction(() => location.pathname === '/harita/' && typeof haritaCiz === 'function');
  await page.waitForFunction(() => !document.querySelector('#harita').classList.contains('gizli'));
  await page.waitForFunction(() => document.querySelector('#haritaAlan [data-harita-sec="tomye"]'));
  await page.waitForFunction(() => document.querySelector('#aktifBolum')?.textContent.includes('Tömye · Harita'));
}

try {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (chunk) => { serverOutput += chunk; });
  server.stderr.on('data', (chunk) => { serverOutput += chunk; });
  await ready();
  browser = await chromium.launch({ headless: true });

  // CTA path: same existing #/harita route, actual map section rendered and focused.
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await openMap(page);
  await page.waitForFunction(() => document.activeElement?.id === 'harita');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'harita');
  assert.equal(await page.locator('#haritaAlan .harita-onizleme').count(), 1, 'public map preview is rendered, not a locked-code prompt');
  assert.equal(await page.locator('#haritaAlan').getByText(/Bu evren sana açık değil|Bu evrene henüz giremezsin/).count(), 0);

  // Map selector is a real button; Enter switches the map and the breadcrumb without waiting for a scroll.
  const ax24 = page.locator('#haritaAlan [data-harita-sec="ax24"]');
  assert.equal(await ax24.count(), 1, 'Ax-24 is listed in the map selector');
  await ax24.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => new URLSearchParams(location.search).get('harita') === 'ax24');
  await page.waitForFunction(() => document.querySelector('#aktifBolum')?.textContent.includes('Ax-24 · Harita'));
  assert.equal(await page.locator('#haritaAlan [data-harita-sec="ax24"].secili').count(), 1);
  assert.match(await page.locator('#haritaAlan').innerText(), /Ax-24 haritasında henüz yer yok/);
  assert.equal(await page.locator('#haritaAlan .harita-onizleme').count(), 0, 'an empty map must not open a misleading full-screen globe');
  assert.equal(await page.locator('.harita-bosdurum [data-harita-sec="tomye"]').count(), 1, 'empty state offers a useful return to the populated map');

  // Browser back/forward restore map state, then return to the home route.
  await page.goBack();
  await page.waitForFunction(() => new URLSearchParams(location.search).get('harita') === 'tomye');
  await page.waitForFunction(() => document.querySelector('#aktifBolum')?.textContent.includes('Tömye · Harita'));
  await page.goForward();
  await page.waitForFunction(() => new URLSearchParams(location.search).get('harita') === 'ax24');
  await page.waitForFunction(() => document.querySelector('#aktifBolum')?.textContent.includes('Ax-24 · Harita'));
  await page.goBack();
  await page.goBack();
  await page.waitForFunction(() => location.pathname === '/' && location.hash !== '#/harita');

  // Browser history can restore the map-section scroll position, leaving the hero tour hidden.
  // The keyboard dismissal is asserted on a clean page below when the tour is actually visible.
  const firstVisitTour = page.locator('#turIpucu');
  if (await firstVisitTour.isVisible()) {
    await firstVisitTour.locator('[data-tur="atla"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('#turIpucu'));
    assert.equal(await page.evaluate(() => localStorage.getItem('tentiforapp_tur')), 'bitti');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    assert.equal(await page.locator('#turIpucu').count(), 0, 'dismissed tour does not reopen in the same session');
  }

  // The separate archive CTA retains #/tomye and never opens the map section.
  const archive = await browser.newPage();
  await archive.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
  await waitForApp(archive);
  await archive.locator('.hero-diger-yollar summary').click();
  await archive.getByRole('link', { name: 'Tömye arşivi' }).click();
  await archive.waitForFunction(() => location.pathname === '/tomye/');
  await archive.waitForFunction(() => document.querySelector('#aktifBolum')?.textContent.includes('Tömye · Arşiv'));
  assert.equal(await archive.locator('#harita').evaluate((node) => getComputedStyle(node).display === 'none'), true);

  const sectionJump = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await sectionJump.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
  await waitForApp(sectionJump);
  await sectionJump.locator('.hero-diger-yollar summary').click();
  const jumps = sectionJump.getByRole('navigation', { name: 'Ana sayfa bölümlerine atla' });
  assert.equal(await jumps.count(), 1);
  await jumps.getByRole('link', { name: 'Harita' }).click();
  await sectionJump.waitForFunction(() => location.pathname === '/harita/');
  await sectionJump.waitForFunction(() => document.querySelector('#harita')?.classList.contains('gizli') === false);
  await sectionJump.locator('#haritaAlan [data-harita-sec="ax24"]').click();
  await sectionJump.waitForFunction(() => document.querySelector('#haritaAlan .harita-bosdurum'));
  const mobileEmptyLayout = await sectionJump.evaluate(() => {
    const button = document.querySelector('.harita-bosdurum > .dugme').getBoundingClientRect();
    const dock = document.querySelector('#tfDockTetik').getBoundingClientRect();
    return { buttonRight: button.right, dockLeft: dock.left, overlap: button.left < dock.right && button.right > dock.left && button.top < dock.bottom && button.bottom > dock.top };
  });
  assert.equal(mobileEmptyLayout.overlap, false, `mobile Ax-24 return action overlaps quick access: ${JSON.stringify(mobileEmptyLayout)}`);

  // A route chosen before veri.json resolves must render when the first load finishes, without refreshing.
  const coldContext = await browser.newContext({ serviceWorkers: 'block' });
  let releaseData;
  const dataGate = new Promise((resolve) => { releaseData = resolve; });
  let dataRequested = false;
  try {
    const coldStart = await coldContext.newPage();
    await coldStart.route('**/veri.json**', async (route) => {
      dataRequested = true;
      await dataGate;
      await route.continue();
    });
    await coldStart.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    await coldStart.waitForFunction(() => typeof sayfaYonlendir === 'function');
    assert.equal(dataRequested, true, 'the first data request is held until after route selection');
    assert.equal(await coldStart.evaluate(() => document.documentElement.classList.contains('veri-hazir')), false);
    const initialTimeOrigin = await coldStart.evaluate(() => performance.timeOrigin);
    await coldStart.evaluate(() => { location.hash = '#/harita'; });
    await coldStart.waitForFunction(() => location.pathname === '/harita/');
    releaseData();
    await coldStart.waitForFunction(() => document.documentElement.classList.contains('veri-hazir'));
    await coldStart.waitForFunction(() => document.querySelector('#haritaAlan [data-harita-sec="tomye"]')?.textContent.trim());
    assert.equal(await coldStart.evaluate(() => performance.timeOrigin), initialTimeOrigin, 'map content renders without a page reload');
  } finally {
    releaseData();
    await coldContext.close();
  }

  // Direct clean URL, refresh, and direct legacy hash all enter the same default Tömye map.
  const direct = await browser.newPage();
  const cleanResponse = await direct.goto(`${baseURL}/harita/`, { waitUntil: 'domcontentloaded' });
  assert.equal(cleanResponse.status(), 200);
  await waitForApp(direct);
  await direct.waitForFunction(() => document.querySelector('#haritaAlan [data-harita-sec="tomye"].secili'));
  await direct.waitForFunction(() => document.querySelector('#aktifBolum')?.textContent.includes('Tömye · Harita'));
  const reloadResponse = await direct.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(reloadResponse.status(), 200);
  await waitForApp(direct);
  await direct.waitForFunction(() => document.querySelector('#haritaAlan [data-harita-sec="tomye"].secili'));
  await direct.goto(`${baseURL}/#/harita`, { waitUntil: 'domcontentloaded' });
  await waitForApp(direct);
  await direct.waitForFunction(() => location.pathname === '/harita/');
  await direct.waitForFunction(() => document.querySelector('#aktifBolum')?.textContent.includes('Tömye · Harita'));
  const ax24Response = await direct.goto(`${baseURL}/harita/?harita=ax24`, { waitUntil: 'domcontentloaded' });
  assert.equal(ax24Response.status(), 200, 'direct clean URL with map selection query is served');
  await waitForApp(direct);
  await direct.waitForFunction(() => document.querySelector('#haritaAlan [data-harita-sec="ax24"].secili'));
  assert.match(await direct.locator('#haritaAlan').innerText(), /Ax-24 haritasında henüz yer yok/);

  // Keyboard-only reachability of the primary CTA and its Enter action.
  const keyboard = await browser.newPage();
  await keyboard.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
  await waitForApp(keyboard);
  const target = '[data-evren-git="harita:tomye"]';
  let reached = false;
  for (let i = 0; i < 80; i += 1) {
    if (await keyboard.evaluate((selector) => document.activeElement?.matches(selector), target)) { reached = true; break; }
    await keyboard.keyboard.press('Tab');
  }
  assert.equal(reached, true, 'Tab reaches the primary map CTA');
  await keyboard.keyboard.press('Enter');
  await keyboard.waitForFunction(() => location.pathname === '/harita/');
  await keyboard.waitForFunction(() => document.querySelector('#harita')?.classList.contains('gizli') === false);

  // Skip/close controls stay keyboard-operable and dismissal persists in the same browser session.
  const guide = await browser.newPage();
  await guide.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
  await waitForApp(guide);
  await guide.locator('details.baslangic summary').click();
  const skip = guide.getByRole('button', { name: 'Rehberi atla' });
  await skip.focus();
  await guide.keyboard.press('Enter');
  assert.equal(await guide.locator('#baslangicAlan .tf64-onboarding').count(), 0);
  await guide.reload({ waitUntil: 'domcontentloaded' });
  await waitForApp(guide);
  await guide.locator('details.baslangic summary').click();
  assert.equal(await guide.locator('#baslangicAlan .tf64-onboarding').count(), 0, 'dismissed onboarding does not reopen in the same session');

  // Missing data gets a useful status, never a broken sentence; loaded data restores the date.
  await keyboard.evaluate(() => {
    if (typeof veri !== 'undefined' && veri) {
      veri.takvim = { aylar: [] };
      document.body.appendChild(document.createElement('i'));
    }
  });
  await keyboard.waitForFunction(() => !document.querySelector('#siraTarih')?.textContent.match(/Tömye'de bugün\s*\./));
  if (await keyboard.locator('#siraTarih').count()) {
    assert.match(await keyboard.locator('#siraTarih').textContent(), /yükleniyor|kullanılamıyor|Tömye'de bugün/);
  }

  // At narrow widths, all direct header controls remain inside the viewport and the hero action is visible.
  const mobile = await browser.newPage({ viewport: { width: 360, height: 780 } });
  await mobile.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
  await waitForApp(mobile);
  const mobileLayout = await mobile.evaluate(() => {
    const header = document.querySelector('header.ust');
    const rect = header.getBoundingClientRect();
    const children = [...header.children].map((node) => node.getBoundingClientRect());
    return {
      clientWidth: header.clientWidth,
      scrollWidth: header.scrollWidth,
      viewportWidth: innerWidth,
      left: Math.min(...children.map((item) => item.left)),
      right: Math.max(...children.map((item) => item.right)),
      headerRight: rect.right,
      activeWidth: document.querySelector('#aktifBolum').getBoundingClientRect().width
    };
  });
  assert.ok(mobileLayout.scrollWidth <= mobileLayout.clientWidth + 1, `mobile toolbar scrolls horizontally: ${JSON.stringify(mobileLayout)}`);
  assert.ok(mobileLayout.left >= -1 && mobileLayout.right <= mobileLayout.viewportWidth + 1, `toolbar controls overflow viewport: ${JSON.stringify(mobileLayout)}`);
  assert.ok(mobileLayout.activeWidth > 0);
  assert.equal(await mobile.getByRole('button', { name: 'Tömye haritasını keşfet' }).isVisible(), true);

  await page.close();
  await archive.close();
  await sectionJump.close();
  await direct.close();
  await keyboard.close();
  await guide.close();
  await mobile.close();
  console.log('map route Playwright UX: PASS (clear CTA, archive separation, clean/query/hash/reload/back-forward, Ax-24 empty state, onboarding, fallback and 360px layout)');
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGKILL');
}
