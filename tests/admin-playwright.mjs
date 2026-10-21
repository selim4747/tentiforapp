import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.TF_ADMIN_BROWSER_PORT || 3191);
const baseURL = process.env.TF_ADMIN_BROWSER_URL || `http://127.0.0.1:${port}`;
let server;
let output = '';

async function ready() {
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`${baseURL}/`)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error(`Local app server did not start: ${output}`);
}

async function makeAdmin(page) {
  await page.waitForFunction(() => typeof veri !== 'undefined' && typeof dogrulamaOzeti === 'function');
  await page.locator('#yGiris').fill('playwright-regresyon-kodu');
  await page.locator('[data-yonetici="giris"]').click();
  await page.waitForSelector('[data-y-sekme="karakterler"]');
}

try {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  await ready();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('https://static.cloudflareinsights.com/beacon.min.js*', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript; charset=utf-8', body: ''
  }));
  const fixtureDigest = crypto.createHash('sha256').update('playwright-regresyon-kodu#dogrula').digest('hex');
  await context.route('**/veri.json*', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.yoneticiOzet = fixtureDigest;
    await route.fulfill({ response, body: JSON.stringify(data) });
  });
  let page = await context.newPage();

  // Cold admin entry must render its initial panel without a user-triggered reload.
  const response = await page.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200);
  await page.evaluate(() => yoneticiCiz());
  await page.waitForFunction(() => (document.querySelector('#yoneticiAlan')?.textContent || '').trim().length > 0, null, { timeout: 15000 });
  assert.ok(await page.locator('#yGiris').count() || await page.locator('[data-y-sekme="karakterler"]').count(), 'cold admin panel should render after data/modules are ready');

  // A second unauthenticated admin tab must update when the first tab logs in.
  const otherTab = await context.newPage();
  await otherTab.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  await otherTab.waitForSelector('#yGiris', { timeout: 15000 });

  // Remember admin status in this browser profile across tabs and later visits.
  await makeAdmin(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('tentiforapp_yonetici')), 'playwright-regresyon-kodu', 'remembered admin session is stored for the browser profile');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('tentiforapp_yonetici')), null, 'the admin code is no longer tab-scoped');
  await otherTab.waitForSelector('[data-y-sekme="karakterler"]', { timeout: 15000 });
  assert.equal(await otherTab.locator('#yGiris').count(), 0, 'login is synchronized to an already-open tab');
  await page.goto(`${baseURL}/#/yonetici`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-y-sekme="karakterler"]', { timeout: 15000 });
  assert.equal(await page.locator('#yGiris').count(), 0, 'hash-based admin startup restores the same-tab session');
  assert.equal(await page.evaluate(() => rota()), '#/yonetici');
  await page.goto(`${baseURL}/sen/`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-y-sekme="karakterler"]'), null, { timeout: 15000 });
  assert.equal(await page.locator('#yGiris').count(), 0, 'admin session survives same-tab navigation');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-y-sekme="karakterler"]', { timeout: 15000 });
  assert.equal(await page.locator('#yGiris').count(), 0, 'admin session survives reload in the same tab');
  assert.equal(await page.evaluate(() => localStorage.getItem('tentiforapp_yonetici')), 'playwright-regresyon-kodu', 'admin status remains persistent after refresh');
  assert.equal(await page.evaluate(() => localStorage.getItem('tentiforapp_github')), null, 'GitHub token/settings remain outside local browser storage');
  await page.locator('[data-y-ac="0"]').click();
  const edited = 'Playwright yerel taslak testi';
  await page.locator('#yAd').fill(edited);
  await page.locator('[data-yonetici="kaydet"]').click();
  await page.waitForFunction(() => (localStorage.getItem('tentiforapp_yonetici_taslak_v1') || '').includes('Playwright yerel taslak testi'), null, { timeout: 10000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-y-sekme="karakterler"]', { timeout: 15000 });
  await page.locator('[data-y-ac="0"]').click();
  await page.waitForFunction((value) => document.querySelector('#yAd')?.value === value, edited, { timeout: 10000 });
  assert.equal(await page.locator('#yAd').inputValue(), edited, 'local draft should restore after browser reload');
  await page.close();
  page = await context.newPage();
  await page.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-y-sekme="karakterler"]', { timeout: 15000 });
  assert.equal(await page.locator('#yGiris').count(), 0, 'closing and reopening the admin tab preserves the browser-profile session');
  await page.evaluate(() => yoneticiCikis());
  assert.equal(await page.evaluate(() => localStorage.getItem('tentiforapp_yonetici')), null, 'logout clears the persistent admin session');
  assert.equal(await page.locator('#yGiris').count(), 1, 'logout returns to the code prompt');
  await otherTab.waitForSelector('#yGiris', { timeout: 15000 });
  assert.equal(await otherTab.locator('[data-y-sekme="karakterler"]').count(), 0, 'logout is synchronized to every other open tab');

  // Custom item/building records and all images use a fresh, disposable browser profile.
  // Only the explicitly out-of-scope Cloudflare RUM script is isolated; application errors remain visible.
  const visualContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await visualContext.route('https://static.cloudflareinsights.com/beacon.min.js*', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript; charset=utf-8', body: ''
  }));
  await visualContext.route('**/veri.json*', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.yoneticiOzet = fixtureDigest;
    await route.fulfill({ response, body: JSON.stringify(data) });
  });
  const visualPage = await visualContext.newPage();
  const visualPageErrors = [];
  const visualConsoleErrors = [];
  const visualRequests = [];
  visualPage.on('pageerror', (error) => visualPageErrors.push(error.message));
  visualPage.on('console', (message) => { if (message.type() === 'error') visualConsoleErrors.push(message.text()); });
  visualPage.on('request', (request) => visualRequests.push({ url: request.url(), method: request.method() }));
  await visualPage.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  await visualPage.waitForFunction(() => typeof veri !== 'undefined' && typeof dogrulamaOzeti === 'function');
  assert.equal(await visualPage.evaluate(() => typeof gh !== 'undefined' && !!(gh.kullanici && gh.depo && gh.jeton)), false, 'visual tests must never have GitHub write credentials');
  await visualPage.evaluate((digest) => {
    veri.yoneticiOzet = dogrulamaOzeti(digest);
    veri.karakterler = [{ id: 'pw-visual-character', ad: 'TEST Karakter', gorsel: '' }];
    veri.galeri = [];
  }, 'playwright-regresyon-kodu');
  await visualPage.locator('#yGiris').fill('playwright-regresyon-kodu');
  await visualPage.locator('[data-yonetici="giris"]').click();
  await visualPage.waitForSelector('[data-y-sekme="karakterler"]');
  await visualPage.locator('#yoneticiAlan [data-y-grup="ekle"]').click();
  await visualPage.locator('#yoneticiAlan [data-y-sekme="gorselEkle"]').click();

  const imageFixture = {
    name: 'test-pixel.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/1sgAAAAASUVORK5CYII=', 'base64')
  };
  async function uploadCharacterPortrait() {
    await visualPage.locator('[data-y-gorsel-tur="karakter"]').click();
    await visualPage.locator('#yGorselHedef').selectOption('pw-visual-character');
    await visualPage.locator('#yGorselDosya').setInputFiles(imageFixture);
    await visualPage.locator('.y-gorsel-onizleme img').waitFor({ state: 'visible', timeout: 10000 });
    await visualPage.locator('[data-y-gorsel-kaydet="1"]').click();
    await visualPage.waitForFunction(() => String(veri.karakterler[0].gorsel || '').startsWith('data:image/'));
  }
  async function createAndUploadGalleryCard(type, title, description, price) {
    await visualPage.locator('[data-y-gorsel-tur="galeri"]').click();
    await visualPage.locator('[data-y-gorsel-galeri-yeni="1"]').click();
    await visualPage.locator('#yGorselYeniGaleriTur').selectOption(type);
    await visualPage.locator('#yGorselYeniGaleriBaslik').fill(title);
    await visualPage.locator('#yGorselYeniGaleriAciklama').fill(description);
    await visualPage.locator('#yGorselYeniGaleriFiyat').fill(String(price));
    await visualPage.locator('[data-y-gorsel-galeri-olustur="1"]').click();
    await visualPage.waitForFunction((value) => veri.galeri.some((item) => item.baslik === value), title);
    const index = await visualPage.evaluate((value) => veri.galeri.findIndex((item) => item.baslik === value), title);
    await visualPage.locator('#yGorselHedef').selectOption(String(index));
    await visualPage.locator('#yGorselDosya').setInputFiles(imageFixture);
    await visualPage.locator('.y-gorsel-onizleme img').waitFor({ state: 'visible', timeout: 10000 });
    await visualPage.locator('[data-y-gorsel-kaydet="1"]').click();
    await visualPage.waitForFunction((i) => String(veri.galeri[i]?.gorsel || '').startsWith('data:image/'), index);
    return visualPage.evaluate((i) => ({
      id: veri.galeri[i].id, type: veri.galeri[i].tur, title: veri.galeri[i].baslik,
      description: veri.galeri[i].aciklama, price: veri.galeri[i].fiyat,
      image: String(veri.galeri[i].gorsel).slice(0, 11)
    }), index);
  }

  await visualPage.locator('[data-y-gorsel-tur="galeri"]').click();
  await visualPage.locator('[data-y-gorsel-galeri-yeni="1"]').click();
  await visualPage.locator('#yGorselYeniGaleriBaslik').fill('TEST Geçersiz fiyat');
  await visualPage.locator('#yGorselYeniGaleriFiyat').fill('-1');
  await visualPage.locator('[data-y-gorsel-galeri-olustur="1"]').click();
  assert.equal(await visualPage.evaluate(() => veri.galeri.some((record) => record.baslik === 'TEST Geçersiz fiyat')), false, 'negative prices are rejected before a gallery record is created');
  await visualPage.locator('[data-y-gorsel-galeri-iptal="1"]').click();
  await uploadCharacterPortrait();
  const item = await createAndUploadGalleryCard('Özel Eşya', 'TEST Ay Çekirdeği', 'Geceyi aydınlatan <özel> eşya.', 0);
  const building = await createAndUploadGalleryCard('Özel Bina', 'TEST Kırık Kule', 'Üç katlı & taş bina.', 0);
  const freeDrawing = await createAndUploadGalleryCard('Çizim', 'TEST Ücretsiz çizim', 'Yerel ücretsiz çizim.', 0);
  const paidDrawing = await createAndUploadGalleryCard('Çizim', 'TEST Ücretli çizim', 'Yerel ücretli çizim.', 17);
  assert.equal(item.type, 'Özel Eşya');
  assert.equal(item.description, 'Geceyi aydınlatan <özel> eşya.');
  assert.equal(item.price, 0);
  assert.equal(building.type, 'Özel Bina');
  assert.equal(building.description, 'Üç katlı & taş bina.');
  assert.equal(building.price, 0);
  assert.equal(freeDrawing.price, 0);
  assert.equal(paidDrawing.price, 17);
  assert.ok([item, building, freeDrawing, paidDrawing].every((record) => record.image === 'data:image/'), 'each custom record retains its selected image');
  assert.ok([item, building, freeDrawing, paidDrawing].every((record) => /^[a-z0-9_-]+$/.test(record.id)), 'record IDs are stable ASCII-safe asset identifiers');
  await visualPage.evaluate(() => {
    const root = document.createElement('div'); root.id = 'galeriAlan'; document.body.appendChild(root); galeriCiz();
  });
  assert.equal(await visualPage.locator('#galeriAlan .galeri-kart').count(), 4, 'all new custom cards render through the existing public gallery component');
  const galleryText = await visualPage.locator('#galeriAlan').innerText();
  assert.ok(galleryText.includes('Geceyi aydınlatan <özel> eşya.'), 'special characters remain readable as text in the gallery');
  assert.equal(await visualPage.locator('#galeriAlan .galeri-aciklama img').count(), 0, 'descriptions cannot inject markup into gallery cards');
  const draftSummary = await visualPage.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => name.toLowerCase().includes('yonetici') && name.toLowerCase().includes('taslak'));
    const draft = key && JSON.parse(localStorage.getItem(key));
    const records = draft?.veri?.galeri;
    return Array.isArray(records) ? { count: records.length, images: records.filter((record) => String(record.gorsel || '').startsWith('data:image/')).length } : null;
  });
  assert.deepEqual(draftSummary, { count: 4, images: 4 }, 'new records and images are saved to the existing local admin draft');
  await visualPage.reload({ waitUntil: 'domcontentloaded' });
  await visualPage.waitForSelector('#yoneticiAlan [data-y-sekme="karakterler"]', { timeout: 15000 });
  await visualPage.waitForFunction(() => Array.isArray(veri?.galeri) && veri.galeri.length === 4 && veri.galeri.every((record) => String(record.gorsel || '').startsWith('data:image/')));
  await visualPage.evaluate(() => { const root = document.createElement('div'); root.id = 'galeriAlan'; document.body.appendChild(root); galeriCiz(); });
  assert.equal(await visualPage.locator('#galeriAlan .galeri-kart').count(), 4, 'all custom records and images restore after same-profile reload');
  assert.deepEqual(visualPageErrors, [], `unhandled visual-flow application errors: ${visualPageErrors.join(' | ')}`);
  assert.deepEqual(visualConsoleErrors, [], `application console errors on the standalone admin route: ${visualConsoleErrors.join(' | ')}`);
  const disallowedWrites = visualRequests.filter((request) => /api\.github\.com|uploads\.github\.com|\/api\/evren-gorsel(?:\?|$)/i.test(request.url) && request.method !== 'GET');
  assert.deepEqual(disallowedWrites, [], 'visual tests must not upload to GitHub or write to production APIs');
  const unexpectedExternal = visualRequests.filter((request) => new URL(request.url).origin !== baseURL && !request.url.startsWith('https://static.cloudflareinsights.com/'));
  assert.deepEqual(unexpectedExternal, [], 'only the explicitly isolated Cloudflare RUM script may be external');
  await visualContext.close();
  await context.close();
  await browser.close();
  console.log('Admin Playwright regressions: PASS (cross-tab login/logout, reload/tab-reopen, local draft, character portrait, custom item/building details and images, free/paid artwork; RUM-only isolation)');
} finally {
  if (server) server.kill('SIGTERM');
}
