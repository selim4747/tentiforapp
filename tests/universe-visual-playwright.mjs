import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.TF_UNIVERSE_VISUAL_PORT || 3197);
const baseURL = process.env.TF_UNIVERSE_VISUAL_URL || `http://127.0.0.1:${port}`;
let server;
let browser;
let output = '';
const png = {
  name: 'test-pixel.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/1sgAAAAASUVORK5CYII=', 'base64')
};

async function ready() {
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`${baseURL}/`)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error(`Local app server did not start: ${output}`);
}

async function waitForRecord(page, name) {
  await page.waitForFunction((expected) => {
    const current = typeof window.evrenSayfaVerisi === 'function' ? window.evrenSayfaVerisi() : null;
    return !!(current && current.eser && Array.isArray(current.eser.varliklar) && current.eser.varliklar.some((record) => record.baslik === expected));
  }, name, { timeout: 15000 });
  return page.evaluate((expected) => {
    const current = window.evrenSayfaVerisi();
    return current.eser.varliklar.find((record) => record.baslik === expected).id;
  }, name);
}

try {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  await ready();

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  // This is the only isolated request. No app routes, APIs, fetches or console errors are suppressed.
  await context.route('https://static.cloudflareinsights.com/beacon.min.js*', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript; charset=utf-8', body: ''
  }));

  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const requests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));

  // The admin route intentionally avoids homepage discovery/leaderboard sync; all test data stays local.
  const response = await page.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200, 'app shell responds successfully');
  await page.waitForFunction(() => typeof window.fanYeni === 'function' && typeof window.fanEserlerim === 'function' && typeof window.fanEserlerimYaz === 'function');
  await delay(350);
  const startupExternal = requests.filter((request) => new URL(request.url).origin !== baseURL && !request.url.startsWith('https://static.cloudflareinsights.com/'));
  assert.deepEqual(startupExternal, [], `the local-only test shell must not contact external services: ${JSON.stringify(startupExternal)}`);
  const worldId = await page.evaluate(() => {
    const created = window.fanYeni('evren');
    const id = typeof created === 'string' ? created : created && created.id;
    const list = window.fanEserlerim();
    const world = list.find((item) => item.id === id);
    if (!world) throw new Error('Local universe creation API did not return the new draft.');
    world.ad = 'PW Görsel Evreni';
    world.ozet = 'Yalnızca bu Playwright profiline ait yerel taslak.';
    world.kisiler = [{ ad: 'Ada', rol: '', aciklama: '' }, { ad: 'Rüzgâr Bekçisi', rol: '', aciklama: '' }];
    window.fanEserlerimYaz(list);
    return id;
  });
  await page.evaluate((id) => { location.hash = '#/ev/benim/' + encodeURIComponent(id); }, worldId);
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.id === id, worldId, { timeout: 15000 });
  await page.waitForSelector('#evrenSayfa [data-evs-sekme="varliklar"]', { timeout: 15000 });
  await page.locator('#evrenSayfa [data-evs-sekme="varliklar"]').click();
  await page.waitForSelector('#evrenSayfa [data-eva-varlik-yeni="esya"]', { timeout: 10000 });

  // Character portrait upload uses the local IndexedDB adapter; metadata only is kept with the universe.
  await page.locator('#evrenSayfa [data-eva-portre="0"]').setInputFiles(png);
  await page.waitForFunction(() => {
    const current = window.evrenSayfaVerisi();
    return current?.eser?.kisiler?.[0]?.portre?.kaynak === 'indexeddb';
  }, null, { timeout: 15000 });

  async function createAsset(type, title, description, price) {
    await page.locator(`#evrenSayfa [data-eva-varlik-yeni="${type}"]`).click();
    await page.waitForFunction((expected) => {
      const current = window.evrenSayfaVerisi();
      return current?.eser?.varliklar?.some((record) => record.tur === expected && !record.baslik);
    }, type);
    const id = await page.evaluate((expected) => {
      const records = window.evrenSayfaVerisi().eser.varliklar;
      return records.find((record) => record.tur === expected && !record.baslik).id;
    }, type);
    await page.locator(`[data-eva-varlik-alan="${id}:baslik"]`).fill(title);
    await page.locator(`[data-eva-varlik-alan="${id}:aciklama"]`).fill(description);
    if (type === 'cizim') await page.locator(`[data-eva-varlik-alan="${id}:fiyat"]`).fill(String(price));
    await page.locator(`[data-eva-varlik-gorsel="${id}"]`).setInputFiles(png);
    await page.waitForFunction((assetId) => {
      const current = window.evrenSayfaVerisi();
      const record = current?.eser?.varliklar?.find((item) => item.id === assetId);
      return !!(record && record.gorsel && record.gorsel.kaynak === 'indexeddb');
    }, id, { timeout: 15000 });
    return id;
  }

  const itemId = await createAsset('esya', 'PW Ay Çekirdeği', 'Geceyi aydınlatan <özel> eşya.', 0);
  const buildingId = await createAsset('bina', 'PW Kırık Kule', 'Üç katlı & taş bina.', 0);
  const freeDrawingId = await createAsset('cizim', 'PW Ücretsiz çizim', 'Ücretsiz yerel çizim.', 0);
  const paidDrawingId = await createAsset('cizim', 'PW Kilitli çizim', '17 eçkalık test çizimi.', 17);

  const localSnapshot = await page.evaluate(() => {
    const world = window.evrenSayfaVerisi().eser;
    return {
      portraits: world.kisiler.filter((person) => person.portre && person.portre.kaynak === 'indexeddb').length,
      assets: world.varliklar.map((record) => ({ type: record.tur, title: record.baslik, price: record.fiyat, source: record.gorsel?.kaynak, imageId: record.gorsel?.id })),
      idbAvailable: typeof indexedDB !== 'undefined'
    };
  });
  assert.equal(localSnapshot.portraits, 1, 'character portrait metadata is attached to the new local universe');
  assert.equal(localSnapshot.idbAvailable, true, 'image bytes are stored in browser IndexedDB, not a remote service');
  assert.deepEqual(localSnapshot.assets.map((x) => [x.type, x.title, x.price, x.source]), [
    ['esya', 'PW Ay Çekirdeği', 0, 'indexeddb'],
    ['bina', 'PW Kırık Kule', 0, 'indexeddb'],
    ['cizim', 'PW Ücretsiz çizim', 0, 'indexeddb'],
    ['cizim', 'PW Kilitli çizim', 17, 'indexeddb']
  ]);
  assert.ok(localSnapshot.assets.every((record) => /^[a-z0-9_-]+$/.test(record.imageId)), 'images use stable local image IDs');

  // Verify reader rendering includes the portrait and all cards; the paid drawing stays locked before purchase.
  const publicMarkup = await page.evaluate(() => {
    const world = window.evrenSayfaVerisi().eser;
    const previousSource = window.EVS && window.EVS.kaynak;
    if (window.EVS) window.EVS.kaynak = 'public';
    const html = window.evrenEkBolum({ eser: world, kaynak: 'public' });
    if (window.EVS) window.EVS.kaynak = previousSource;
    const root = document.createElement('div'); root.id = 'pw-public-assets'; root.innerHTML = html; document.body.appendChild(root);
    return { cardCount: root.querySelectorAll('.galeri-kart').length, imageCount: root.querySelectorAll('img').length, buyButtons: root.querySelectorAll('[data-eva-varlik-al]').length, text: root.innerText };
  });
  assert.ok(publicMarkup.cardCount >= 4, 'reader mode renders custom items, buildings and drawings as cards');
  assert.ok(publicMarkup.imageCount >= 4, 'reader mode displays the portrait, item, building and free drawing image while the paid drawing remains locked');
  assert.equal(publicMarkup.buyButtons, 1, 'the paid drawing has one purchase control while free content is directly available');
  assert.ok(publicMarkup.text.includes('PW Ay Çekirdeği') && publicMarkup.text.includes('PW Kırık Kule'), 'reader mode shows the custom item and building titles');

  // The portable JSON contains embedded image bytes so it can be restored on another browser/device.
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-eva-gorsel-disari]').click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  assert.ok(backupPath, 'portable export should produce a downloadable file');
  const backupBuffer = await fs.readFile(backupPath);
  const backup = JSON.parse(backupBuffer.toString('utf8'));
  assert.equal(backup.format, 'tentifor-evren-gorselleri');
  assert.ok(JSON.stringify(backup).includes('base64'), 'portable export embeds the local image bytes');
  assert.ok(JSON.stringify(backup).includes(worldId), 'portable export is associated with the selected universe');

  // A reload restores the universe and its IndexedDB images without a network write.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#evrenSayfa [data-evs-sekme="varliklar"]', { timeout: 15000 });
  await page.waitForFunction(() => {
    const world = window.evrenSayfaVerisi()?.eser;
    return world?.varliklar?.length === 4 && world.kisiler?.[0]?.portre?.kaynak === 'indexeddb';
  }, null, { timeout: 15000 });
  await page.locator('#evrenSayfa [data-evs-sekme="varliklar"]').click();
  await page.waitForSelector('#evrenSayfa [data-eva-varlik-yeni="esya"]');
  assert.equal(await page.locator('#evrenSayfa [data-eva-varlik-kart]').count(), 4, 'all asset editor cards return after a reload');

  // Emulate a new device: delete the original local image blobs and metadata before restoring the portable file.
  const cleanStore = await page.evaluate(async () => {
    const pageData = window.evrenSayfaVerisi();
    const list = window.fanEserlerim();
    const world = list.find((item) => item.id === pageData.eser.id);
    const metas = world.varliklar.map((record) => record.gorsel).concat(world.kisiler.map((person) => person && person.portre).filter(Boolean));
    await Promise.all(metas.map(async (meta) => {
      const url = window.EVH_GORSEL_URL && window.EVH_GORSEL_URL[meta.id];
      if (url) URL.revokeObjectURL(url);
      if (window.EVH_GORSEL_URL) delete window.EVH_GORSEL_URL[meta.id];
      await window.evrenGorselVarlik.sil(meta);
    }));
    const absent = (await Promise.all(metas.map((meta) => window.evrenGorselVarlik.oku(meta, { kaynak: 'indexeddb', evrenId: world.id })))).every((record) => !record);
    world.varliklar = [];
    world.kisiler.forEach((person) => { delete person.portre; });
    window.fanEserlerimYaz(list);
    window.evrenSayfaCiz();
    return { count: metas.length, absent };
  });
  assert.deepEqual(cleanStore, { count: 5, absent: true }, 'all original image blobs are removed before import to prevent false-positive restoration');
  await page.waitForFunction(() => window.evrenSayfaVerisi()?.eser?.varliklar?.length === 0);
  await page.locator('#evrenSayfa [data-evs-sekme="varliklar"]').click();
  await page.waitForSelector('[data-eva-gorsel-iceri]', { state: 'attached' });
  await page.locator('[data-eva-gorsel-iceri]').setInputFiles({ name: 'visual-backup.json', mimeType: 'application/json', buffer: backupBuffer });
  await page.waitForFunction(() => {
    const world = window.evrenSayfaVerisi()?.eser;
    return world?.varliklar?.length === 4 && world.kisiler?.[0]?.portre?.kaynak === 'indexeddb';
  }, null, { timeout: 20000 });
  assert.equal(await page.locator('#evrenSayfa [data-eva-varlik-kart]').count(), 4, 'portable import restores all custom item, building and drawing records');
  const importedIds = await page.evaluate(() => window.evrenSayfaVerisi().eser.varliklar.map((record) => record.id));
  assert.deepEqual(importedIds, [itemId, buildingId, freeDrawingId, paidDrawingId], 'portable import preserves stable asset identifiers');
  const restoredImages = await page.evaluate(async () => {
    const world = window.evrenSayfaVerisi().eser;
    const metas = world.varliklar.map((record) => record.gorsel).concat(world.kisiler.map((person) => person && person.portre).filter(Boolean));
    const restored = await Promise.all(metas.map((meta) => window.evrenGorselVarlik.oku(meta, { kaynak: 'indexeddb', evrenId: world.id })));
    const sizes = restored.map((record) => record && record.blob ? record.blob.size : 0);
    const types = restored.map((record) => record && record.blob ? record.blob.type : '');
    restored.forEach((record) => { if (record && record.url) URL.revokeObjectURL(record.url); });
    return { count: restored.length, nonEmpty: sizes.filter((size) => size > 0).length, imageTypes: types.every((type) => /^image\/(png|jpeg|webp)$/.test(type)) };
  });
  assert.deepEqual(restoredImages, { count: 5, nonEmpty: 5, imageTypes: true }, 'portable import restores all image bytes into a clean local IndexedDB store');

  // Only Cloudflare RUM is isolated; app failures, broken images and unexpected writes remain visible.
  assert.deepEqual(pageErrors, [], `unhandled application exceptions: ${pageErrors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `browser console errors: ${consoleErrors.join(' | ')}`);
  const external = requests.filter((request) => new URL(request.url).origin !== baseURL && !request.url.startsWith('https://static.cloudflareinsights.com/'));
  assert.deepEqual(external, [], `unexpected external requests: ${JSON.stringify(external)}`);
  const writes = requests.filter((request) => /api\.github\.com|uploads\.github\.com|\/api\//i.test(new URL(request.url).pathname) && !['GET', 'HEAD'].includes(request.method));
  assert.deepEqual(writes, [], `the disposable visual test must not write to GitHub or any application API: ${JSON.stringify(writes)}`);

  await context.close();
  console.log('Custom universe visual Playwright: PASS (local draft creation, Varlıklar tab, portrait/item/building/drawing uploads, reader cards, reload and portable JSON restore).');
} catch (error) {
  console.error(error.stack || error);
  if (output) console.error(`Local server output:\n${output}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server && !server.killed) server.kill('SIGTERM');
}
