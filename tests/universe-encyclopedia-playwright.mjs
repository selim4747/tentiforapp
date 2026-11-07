import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.TF_UNIVERSE_WIKI_PORT || 3198);
const baseURL = process.env.TF_UNIVERSE_WIKI_URL || `http://127.0.0.1:${port}`;
let server;
let browser;
let output = '';
const png = { name: 'wiki-pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/1sgAAAAASUVORK5CYII=', 'base64') };

async function ready() {
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`${baseURL}/`)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error(`Local app server did not start: ${output}`);
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  // Isolate only Cloudflare RUM; app requests and JavaScript errors remain observable.
  await context.route('https://static.cloudflareinsights.com/beacon.min.js*', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript; charset=utf-8', body: ''
  }));
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  const pageErrors = [];
  const consoleErrors = [];
  const requests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));

  const response = await page.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200, 'app shell responds successfully');
  await page.waitForFunction(() => typeof window.fanYeni === 'function' && typeof window.fanEserlerim === 'function' && typeof window.fanEserlerimYaz === 'function');
  await delay(350);
  const startupExternal = requests.filter((request) => new URL(request.url).origin !== baseURL && !request.url.startsWith('https://static.cloudflareinsights.com/'));
  assert.deepEqual(startupExternal, [], `local-only test must not contact external services: ${JSON.stringify(startupExternal)}`);

  const worldId = await page.evaluate(() => {
    const created = window.fanYeni('evren');
    const id = typeof created === 'string' ? created : created && created.id;
    const list = window.fanEserlerim();
    const world = list.find((item) => item.id === id);
    if (!world) throw new Error('Local universe creation API did not return a draft.');
    world.ad = 'PW Ansiklopedi Evreni';
    world.ozet = 'Bitki ve hayvan maddeleri için yalnızca bu test profiline ait yerel evren.';
    window.fanEserlerimYaz(list);
    return id;
  });
  await page.evaluate((id) => { location.hash = '#/ev/benim/' + encodeURIComponent(id); }, worldId);
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.id === id, worldId, { timeout: 15000 });
  await page.waitForSelector('#evrenSayfa [data-evs-sekme="ansiklopedi"]', { timeout: 15000 });
  await page.locator('#evrenSayfa [data-evs-sekme="ansiklopedi"]').click();
  await page.waitForSelector('#evrenSayfa [data-eaw-new]', { timeout: 10000 });

  async function createEntry(type, title, summary, description, habitat, tags, publish = true) {
    await page.locator('#evrenSayfa [data-eaw-new]').click();
    try {
      await page.waitForFunction((expected) => {
        const entries = window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri || [];
        return entries.some((entry) => !entry.baslik && entry.durum === 'taslak');
      }, null, { timeout: 10000 });
    } catch (error) {
      console.error('Encyclopedia creation diagnostic:', await page.evaluate(() => ({ state: window.EVS, world: window.evrenSayfaVerisi(), errors: document.querySelector('#evrenSayfa')?.innerText })));
      throw error;
    }
    const id = await page.evaluate((expected) => {
      return window.evrenSayfaVerisi().eser.ansiklopediMaddeleri.find((entry) => !entry.baslik && entry.durum === 'taslak').id;
    });
    await page.locator(`[data-eaw-field="${id}:tur"]`).selectOption(type);
    await page.locator(`[data-eaw-field="${id}:baslik"]`).fill(title);
    await page.locator(`[data-eaw-field="${id}:ozet"]`).fill(summary);
    await page.locator(`[data-eaw-field="${id}:aciklama"]`).fill(description);
    await page.locator(`[data-eaw-field="${id}:habitat"]`).fill(habitat);
    await page.locator(`[data-eaw-field="${id}:etiketler"]`).fill(tags);
    await page.waitForFunction(([entryId, expectedTitle]) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.some((entry) => entry.id === entryId && entry.baslik === expectedTitle), [id, title], { timeout: 10000 });
    if (publish) await page.locator(`[data-eaw-field="${id}:durum"]`).selectOption('yayinda');
    return id;
  }

  const plantId = await createEntry('bitki', 'PW Ayçiçeği', 'Geceleri açan kıyı bitkisi.', 'Gümüş Göl kıyısında yetişir ve suyu arındırır.', 'Gümüş Göl', 'gece, arındırıcı');
  const animalId = await createEntry('hayvan', 'PW Göl Tilkisi', 'Geceleri kıyıda avlanan küçük hayvan.', 'Ayçiçeğinin tohumlarını taşır.', 'Gümüş Göl', 'gece, tilki');
  await page.locator(`[data-eaw-field="${plantId}:ilgiliIds"]`).selectOption(animalId);
  await page.waitForFunction(([entryId, targetId]) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((entry) => entry.id === entryId)?.ilgiliIds?.includes(targetId), [plantId, animalId], { timeout: 10000 });
  await page.locator(`[data-eaw-image="${plantId}"]`).setInputFiles(png);
  await page.waitForFunction((entryId) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((entry) => entry.id === entryId)?.gorsel?.kaynak === 'indexeddb', plantId, { timeout: 15000 });
  await page.waitForSelector('#evrenSayfa [data-eaw-export]', { timeout: 10000 });
  let download;
  try { [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.locator('#evrenSayfa [data-eaw-export]').click()]); }
  catch (error) { console.error('Portable-export diagnostic:', await page.evaluate((entryId) => ({ status: document.querySelector('[data-eaw-status]')?.textContent, button: document.querySelector('[data-eaw-export]')?.outerHTML, image: window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((entry) => entry.id === entryId)?.gorsel, adapter: typeof window.evrenGorselVarlik?.disaAktar, sanitizer: typeof window.evrenVarlikGorselTemizle, source: Array.from(document.scripts).map((script) => script.src).filter((src) => src.includes('104-evren')) }), plantId), pageErrors); throw error; }
  const backupPath = await download.path();
  const backupBuffer = await import('node:fs/promises').then((fs) => fs.readFile(backupPath));
  const backup = JSON.parse(backupBuffer.toString('utf8'));
  assert.equal(backup.format, 'tentifor-evren-ansiklopedi', 'portable wiki backup declares its versioned format');
  assert.ok(backup.maddeler.find((entry) => entry.id === plantId).gorsel.veri.startsWith('data:image/'), 'backup embeds local image bytes');
  const cleared = await page.evaluate(async (entryId) => {
    const world = window.evrenSayfaVerisi().eser;
    const entry = world.ansiklopediMaddeleri.find((item) => item.id === entryId);
    const meta = entry.gorsel;
    await window.evrenGorselVarlik.sil(meta);
    window.evrenBenimDegistir(world.id, (draft) => { draft.ansiklopediMaddeleri.find((item) => item.id === entryId).gorsel = null; });
    const gone = await window.evrenGorselVarlik.oku(meta, { kaynak: 'indexeddb' });
    return !gone;
  }, plantId);
  assert.equal(cleared, true, 'original local image is deleted before import to prove portable restore');
  await page.locator('[data-eaw-import]').setInputFiles({ name: 'wiki-backup.json', mimeType: 'application/json', buffer: backupBuffer });
  await page.waitForFunction((entryId) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((entry) => entry.id === entryId)?.gorsel?.kaynak === 'indexeddb', plantId, { timeout: 20000 });
  const restoredBytes = await page.evaluate(async (entryId) => {
    const meta = window.evrenSayfaVerisi().eser.ansiklopediMaddeleri.find((entry) => entry.id === entryId).gorsel;
    const record = await window.evrenGorselVarlik.oku(meta, { kaynak: 'indexeddb' });
    const size = record && record.blob && record.blob.size || 0;
    if (record && record.url) URL.revokeObjectURL(record.url);
    return size;
  }, plantId);
  assert.ok(restoredBytes > 0, 'portable import restores image bytes into local IndexedDB');
  await page.locator('#evrenSayfa [data-eaw-preview]').click();
  await page.waitForSelector('#evrenSayfa .eaw-reader', { timeout: 10000 });
  assert.equal(await page.locator('#evrenSayfa .eaw-card').count(), 2, 'owner preview shows published entries and excludes drafts');
  assert.ok((await page.locator('#evrenSayfa .eaw-reader').innerText()).includes('taslak maddeler görünmez'), 'owner preview explains draft privacy');
  await page.locator('#evrenSayfa [data-eaw-edit]').click();
  await page.waitForSelector('#evrenSayfa [data-eaw-export]', { timeout: 10000 });

  const snapshot = await page.evaluate(() => {
    const world = window.evrenSayfaVerisi().eser;
    return world.ansiklopediMaddeleri.map((entry) => ({ id: entry.id, type: entry.tur, title: entry.baslik, status: entry.durum, tags: entry.etiketler }));
  });
  assert.deepEqual(snapshot.map((entry) => [entry.type, entry.title, entry.status]), [
    ['bitki', 'PW Ayçiçeği', 'yayinda'],
    ['hayvan', 'PW Göl Tilkisi', 'yayinda']
  ], 'both articles persist as published, typed custom-world records');

  const publicMarkup = await page.evaluate(() => {
    const world = window.evrenSayfaVerisi().eser;
    window.EVS.kaynak = 'public';
    window.EVS.sekme = 'ansiklopedi';
    window.evrenSayfaVerisi = () => ({ eser: world, kaynak: 'public' });
    return window.evrenEkBolum({ eser: world, kaynak: 'public' });
  });
  await page.locator('#evrenSayfa').evaluate((root, markup) => { root.innerHTML = markup; }, publicMarkup);
  assert.equal(await page.locator('#evrenSayfa [data-eaw-card]').count(), 2, 'public index renders both published cards');
  await page.locator('#evrenSayfa [data-eaw-search]').fill('tilki');
  assert.equal(await page.locator('#evrenSayfa [data-eaw-card]:visible').count(), 1, 'reader search filters the article index');
  await page.locator('#evrenSayfa [data-eaw-search]').fill('');
  await page.locator('#evrenSayfa [data-eaw-open="' + plantId + '"]').click();
  await page.waitForSelector('#evrenSayfa .eaw-article', { timeout: 5000 });
  assert.ok((await page.locator('#evrenSayfa .eaw-article').innerText()).includes('PW Ayçiçeği'), 'reader can open a plant article');
  await page.locator('#evrenSayfa .eaw-related [data-eaw-open="' + animalId + '"]').click();
  assert.ok((await page.locator('#evrenSayfa .eaw-article').innerText()).includes('PW Göl Tilkisi'), 'related article IDs open the connected animal entry');

  assert.deepEqual(pageErrors, [], `unhandled app exceptions: ${pageErrors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);
  const external = requests.filter((request) => new URL(request.url).origin !== baseURL && !request.url.startsWith('https://static.cloudflareinsights.com/'));
  assert.deepEqual(external, [], `unexpected external requests: ${JSON.stringify(external)}`);
  const writes = requests.filter((request) => /api\.github\.com|uploads\.github\.com|\/api\//i.test(new URL(request.url).pathname) && !['GET', 'HEAD'].includes(request.method));
  assert.deepEqual(writes, [], `disposable local test must not write to remote APIs: ${JSON.stringify(writes)}`);
  await context.close();
  console.log('Universe encyclopedia Playwright: PASS (390px mobile, local draft, flora/fauna editing, published reader index, search and cross-links).');
} catch (error) {
  console.error(error.stack || error);
  if (output) console.error(`Local server output:\n${output}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server && !server.killed) server.kill('SIGTERM');
}
