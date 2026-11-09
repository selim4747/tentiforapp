import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.TF_UNIVERSE_WIKI_PORT || 3198);
const baseURL = process.env.TF_UNIVERSE_WIKI_URL || `http://127.0.0.1:${port}`;
let server;
let browser;
let output = '';
const pixel = { name: 'wiki-pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/1sgAAAAASUVORK5CYII=', 'base64') };
const types = [
  { id: 'bitki', title: 'PW Ayçiçeği', field: 'yasamDongusu', value: 'Geceleri açar.' },
  { id: 'hayvan', title: 'PW Göl Tilkisi', field: 'beslenme', value: 'Tarçınlı meyve ve kıyı balıkları.' },
  { id: 'esya', title: 'PW Bakır Fener', field: 'malzeme', value: 'Bakır ve mavi cam.' },
  { id: 'ozel-esya', title: 'PW Gelgit Anahtarı', field: 'guc', value: 'Gelgiti kısa süre durdurur.' },
  { id: 'bina', title: 'PW Mavi Liman', field: 'yapi', value: 'Kireç taşı iskele.' },
  { id: 'ozel-bina', title: 'PW Sessiz Kule', field: 'savunma', value: 'Yankı kalkanı.' },
  { id: 'ozel-guc', title: 'PW Su Hafızası', field: 'sinirlar', value: 'Tuzlu suda zayıflar.' },
  { id: 'diger', title: 'PW Kırmızı Fırtına', field: 'nitelikler', value: 'Tarçın kokulu mevsim olayı.' }
];
const liveReadMethods = new Map([
  ['/rest/v1/rpc/hickirik_durum', 'POST'], ['/rest/v1/rpc/kesif_akisi', 'POST'], ['/rest/v1/rpc/kesif_one_cikanlar', 'POST'],
  ['/rest/v1/rpc/evren_gorsel_haritayi_yukle', 'POST'], ['/rest/v1/rpc/evren_zaman_cizelgesi_yukle', 'POST'],
  ['/rest/v1/liderlik', 'GET'], ['/rest/v1/kulup_savasi', 'GET']
]);
function isObservedAppRead(request) {
  const parsed = new URL(request.url);
  return parsed.hostname.endsWith('.supabase.co') && liveReadMethods.get(parsed.pathname) === request.method;
}
async function waitForObservedReads(requests, responses) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const count = requests.filter(isObservedAppRead).length;
    if (count === responses.length) return;
    await delay(100);
  }
}
async function ready(url) {
  await delay(100);
  if (server && server.exitCode !== null) throw new Error(`Local app server exited before readiness (code=${server.exitCode}): ${output}`);
  for (let i = 0; i < 120; i += 1) {
    if (server && server.exitCode !== null) throw new Error(`Local app server exited before readiness (code=${server.exitCode}): ${output}`);
    try { if ((await fetch(url)).ok) { if (server && server.exitCode === null) return; } } catch {}
    await delay(100);
  }
  throw new Error(`Local app server did not start: ${output}`);
}
async function configureTelemetryOnly(context) {
  // Isolate Cloudflare RUM only. App requests and runtime errors stay observable.
  await context.route('https://static.cloudflareinsights.com/beacon.min.js*', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript; charset=utf-8', body: ''
  }));
}

try {
  server = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  server.on('error', (error) => { output += `spawn error: ${error.message}\n`; });
  await ready(`${baseURL}/`);

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await configureTelemetryOnly(context);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const requests = [];
  const requestFailures = [];
  const inAppReads = [];
  const localHttpErrors = [];
  const dialogs = [];
  page.on('dialog', async (dialog) => { dialogs.push(dialog.message()); await dialog.accept(); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));
  page.on('requestfailed', (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  // These are live app read APIs (not telemetry); leave them live and inspect their HTTP results.
  page.on('response', (response) => {
    const request = { url: response.url(), method: response.request().method() };
    if (isObservedAppRead(request)) inAppReads.push({ ...request, status: response.status() });
    const url = new URL(response.url());
    if (url.origin === baseURL && response.status() >= 400 && url.pathname !== '/favicon.ico') localHttpErrors.push({ url: response.url(), status: response.status() });
  });

  const response = await page.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200, 'app shell responds successfully');
  await page.waitForFunction(() => typeof window.fanYeni === 'function' && typeof window.fanEserlerim === 'function' && typeof window.fanEserlerimYaz === 'function');
  await page.waitForFunction(() => window.EVREN_ANSIKLOPEDI_SCHEMA?.categories?.length === 8);
  await delay(250);
  const startupExternal = requests.filter((request) => new URL(request.url).origin !== baseURL && !request.url.startsWith('https://static.cloudflareinsights.com/'));
  assert.deepEqual(startupExternal, [], `local-only test must not contact external services: ${JSON.stringify(startupExternal)}`);

  const worldId = await page.evaluate(() => {
    const created = window.fanYeni('evren');
    const id = typeof created === 'string' ? created : created && created.id;
    const list = window.fanEserlerim();
    const world = list.find((item) => item.id === id);
    if (!world) throw new Error('Local universe creation API did not return a draft.');
    world.ad = 'PW Ansiklopedi Evreni';
    world.ozet = 'Bitki, hayvan, eşya, bina ve özel güç maddeleri için bu teste ait yerel evren.';
    window.fanEserlerimYaz(list);
    return id;
  });
  await page.evaluate((id) => { location.hash = '#/ev/benim/' + encodeURIComponent(id); }, worldId);
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.id === id, worldId, { timeout: 15000 });
  await page.waitForSelector('#evrenSayfa [data-evs-sekme="ansiklopedi"]', { timeout: 15000 });
  await page.locator('#evrenSayfa [data-evs-sekme="ansiklopedi"]').click();
  await page.waitForSelector('#evrenSayfa [data-eaw-new]', { timeout: 10000 });

  async function createEntry(type, title, field, fieldValue, publish = true) {
    await page.locator('#evrenSayfa [data-eaw-new]').click();
    await page.waitForFunction(() => (window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri || []).some((entry) => !entry.baslik && entry.durum === 'taslak'), null, { timeout: 10000 });
    const entryId = await page.evaluate(() => window.evrenSayfaVerisi().eser.ansiklopediMaddeleri.find((entry) => !entry.baslik && entry.durum === 'taslak').id);
    const categoryField = page.locator(`[data-eaw-field="${entryId}:tur"]`);
    if (await categoryField.count() === 0) {
      // A full page redraw avoids a race between the legacy shell and the encyclopedia extension after local persistence.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.id === id, worldId, { timeout: 15000 });
      await page.locator('#evrenSayfa [data-evs-sekme="ansiklopedi"]').click();
      await page.waitForSelector(`[data-eaw-field="${entryId}:tur"]`, { timeout: 10000 });
    }
    await page.locator(`[data-eaw-field="${entryId}:tur"]`).selectOption(type);
    const specific = page.locator(`[data-eaw-field="${entryId}:ozellikler.${field}"]`);
    await specific.waitFor({ state: 'visible', timeout: 5000 });
    await specific.fill(fieldValue);
    await page.locator(`[data-eaw-field="${entryId}:baslik"]`).fill(title);
    await page.locator(`[data-eaw-field="${entryId}:ozet"]`).fill(`${title} hakkında kısa, okur için anlaşılır tanıtım.`);
    await page.locator(`[data-eaw-field="${entryId}:giris"]`).fill(`${title} için giriş bilgisi.`);
    await page.locator(`[data-eaw-field="${entryId}:aciklama"]`).fill(`${title} kıyı dünyasında önemli bir kayıt ve yapılandırılmış ayrıntı: ${fieldValue}`);
    await page.locator(`[data-eaw-field="${entryId}:habitat"]`).fill('Gümüş Göl kıyısı');
    await page.locator(`[data-eaw-field="${entryId}:etiketler"]`).fill('gece, kıyı');
    if (publish) await page.locator(`[data-eaw-field="${entryId}:durum"]`).selectOption('yayinda');
    await page.waitForFunction(([id, expectedTitle, expectedStatus]) => {
      const entry = window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((item) => item.id === id);
      return entry && entry.baslik === expectedTitle && entry.durum === expectedStatus;
    }, [entryId, title, publish ? 'yayinda' : 'taslak'], { timeout: 10000 });
    await page.locator(`[data-eaw-save="${entryId}"]`).click();
    await page.waitForFunction((id) => document.querySelector(`[data-eaw-entry-status="${id}"]`)?.textContent.includes('kaydedildi'), entryId);
    return entryId;
  }

  const articleIds = {};
  for (const type of types) articleIds[type.id] = await createEntry(type.id, type.title, type.field, type.value);
  const historyId = articleIds.esya;
  const revisedTitle = page.locator(`[data-eaw-field="${historyId}:baslik"]`);
  await revisedTitle.fill('PW Bakır Fener Revize');
  await revisedTitle.blur();
  await page.waitForFunction(([id, title]) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((entry) => entry.id === id)?.baslik === title, [historyId, 'PW Bakır Fener Revize']);
  await page.locator(`[data-eaw-entry="${historyId}"] .eaw-history summary`).click();
  await page.locator(`[data-eaw-entry="${historyId}"] [data-eaw-revert]`).first().click();
  await page.waitForFunction((id) => {
    const entry = window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((item) => item.id === id);
    return entry && entry.baslik === 'PW Bakır Fener' && entry.durum === 'taslak';
  }, historyId, { timeout: 10000 });
  await page.locator(`[data-eaw-field="${historyId}:durum"]`).selectOption('yayinda');
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((entry) => entry.id === id)?.durum === 'yayinda', historyId);

  const deletedId = articleIds.diger;
  await page.locator(`[data-eaw-delete="${deletedId}"]`).click();
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.ansiklopediSilinenMaddeler?.some((entry) => entry.id === id), deletedId);
  await page.locator('#evrenSayfa .eaw-trash summary').click();
  await page.locator(`[data-eaw-restore="${deletedId}"]`).click();
  await page.waitForFunction((id) => {
    const world = window.evrenSayfaVerisi()?.eser;
    const entry = world?.ansiklopediMaddeleri?.find((item) => item.id === id);
    return entry && entry.durum === 'taslak' && !world.ansiklopediSilinenMaddeler?.some((item) => item.id === id);
  }, deletedId, { timeout: 10000 });
  await page.locator(`[data-eaw-field="${deletedId}:durum"]`).selectOption('yayinda');
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((entry) => entry.id === id)?.durum === 'yayinda', deletedId);
  const plantId = articleIds.bitki;
  const animalId = articleIds.hayvan;
  await page.locator(`[data-eaw-field="${plantId}:ilgiliIds"]`).selectOption(animalId);
  await page.waitForFunction(([from, to]) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((item) => item.id === from)?.ilgiliIds?.includes(to), [plantId, animalId], { timeout: 10000 });

  await page.locator(`[data-eaw-add-source="${plantId}"]`).click();
  let sourceTitle = page.locator(`[data-eaw-source-field="${plantId}:0:baslik"]`);
  let sourceDescription = page.locator(`[data-eaw-source-field="${plantId}:0:aciklama"]`);
  let sourceUrl = page.locator(`[data-eaw-source-field="${plantId}:0:url"]`);
  await sourceTitle.fill('Kıyı atlası');
  await sourceDescription.fill('Gümüş Göl kaynak notu');
  await sourceUrl.fill('javascript:alert(1)');
  await sourceUrl.blur();
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((item) => item.id === id)?.kaynakca?.[0]?.url === '', plantId);
  await sourceUrl.fill('https://example.invalid/kiyi-atlasi');
  await sourceUrl.blur();
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((item) => item.id === id)?.kaynakca?.[0]?.url === 'https://example.invalid/kiyi-atlasi', plantId);

  const backupDeletedId = articleIds.bina;
  await page.locator(`[data-eaw-delete="${backupDeletedId}"]`).click();
  await page.waitForFunction((id) => {
    const world = window.evrenSayfaVerisi()?.eser;
    return world?.ansiklopediSilinenMaddeler?.some((entry) => entry.id === id) && !world.ansiklopediMaddeleri?.some((entry) => entry.id === id);
  }, backupDeletedId, { timeout: 10000 });

  const imageArticleId = await createEntry('diger', 'PW Yerel Görsel', 'nitelikler', 'Profilde saklanan test görseli.', false);
  await page.locator(`[data-eaw-image="${imageArticleId}"]`).setInputFiles(pixel);
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((entry) => entry.id === id)?.gorsel?.kaynak === 'indexeddb', imageArticleId, { timeout: 15000 });
  await page.locator(`[data-eaw-field="${imageArticleId}:durum"]`).selectOption('yayinda');
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((entry) => entry.id === id)?.durum === 'yayinda', imageArticleId, { timeout: 10000 });
  assert.ok(dialogs.some((message) => message.includes('yalnızca bu tarayıcı profilindeki IndexedDB')), 'publishing a local-only image requires explicit user confirmation');
  const publicationWarnings = await page.evaluate(() => window.tf65EvrenYayinDenetle(window.evrenSayfaVerisi().eser).warnings);
  assert.ok(publicationWarnings.some((warning) => warning.includes('PW Yerel Görsel') && warning.includes('IndexedDB')), 'publication checker names the article with a local-only image');
  const redPng = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const context = canvas.getContext('2d'); context.fillStyle = '#ff0000'; context.fillRect(0, 0, 1, 1);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator(`[data-eaw-image="${plantId}"]`).setInputFiles({ name: 'wiki-red.png', mimeType: 'image/png', buffer: Buffer.from(redPng, 'base64') });
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((entry) => entry.id === id)?.gorsel?.kaynak === 'indexeddb', plantId, { timeout: 15000 });

  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#evrenSayfa [data-eaw-export]').click()]);
  const backupPath = await download.path();
  const backupBuffer = await import('node:fs/promises').then((fs) => fs.readFile(backupPath));
  const backup = JSON.parse(backupBuffer.toString('utf8'));
  assert.equal(backup.format, 'tentifor-evren-ansiklopedi', 'portable backup declares its format');
  assert.equal(backup.version, 2, 'portable backup includes the extended schema version');
  assert.deepEqual(backup.kategoriler, types.map((type) => type.id), 'portable backup preserves the eight verified categories');
  assert.equal(backup.maddeler.length, 8, 'active backup excludes the soft-deleted category record');
  assert.equal(backup.silinenMaddeler.length, 1, 'portable backup round-trips a soft-deleted article');
  assert.equal(backup.silinenMaddeler[0].id, backupDeletedId, 'deleted backup entry keeps its stable ID');
  const backupEntries = backup.maddeler.concat(backup.silinenMaddeler);
  for (const type of types) {
    const entry = backupEntries.find((candidate) => candidate.id === articleIds[type.id]);
    assert.equal(entry?.tur, type.id, `${type.id}: category survives portable serialization`);
    assert.equal(entry?.ozellikler?.[type.field], type.value, `${type.id}: category-specific value survives portable serialization`);
  }
  assert.ok(backup.maddeler.find((entry) => entry.id === imageArticleId).gorsel.veri.startsWith('data:image/'), 'backup embeds local image bytes');
  assert.ok(backup.maddeler.find((entry) => entry.id === plantId).gorsel.veri.startsWith('data:image/'), 'a second distinct local image is embedded for partial-restore rollback coverage');
  assert.equal(backup.maddeler.find((entry) => entry.id === plantId).kaynakca[0].url, 'https://example.invalid/kiyi-atlasi', 'backup preserves validated source links');
  assert.ok(backup.maddeler.find((entry) => entry.id === plantId).gecmis.length > 0, 'backup includes per-article edit history');
  assert.deepEqual(backup.maddeler.find((entry) => entry.id === plantId).ilgiliIds, [animalId], 'backup preserves stable article relationships');

  const cleared = await page.evaluate(async (entryId) => {
    const world = window.evrenSayfaVerisi().eser;
    const entry = world.ansiklopediMaddeleri.find((item) => item.id === entryId);
    const meta = entry.gorsel;
    await window.evrenGorselVarlik.sil(meta);
    window.evrenBenimDegistir(world.id, (draft) => { draft.ansiklopediMaddeleri.find((item) => item.id === entryId).gorsel = null; });
    return !(await window.evrenGorselVarlik.oku(meta, { kaynak: 'indexeddb' }));
  }, imageArticleId);
  assert.equal(cleared, true, 'local image is deleted before import to prove the backup restores actual image bytes');
  const replacedPlantAssetId = await page.evaluate((id) => window.evrenSayfaVerisi().eser.ansiklopediMaddeleri.find((entry) => entry.id === id).gorsel.id, plantId);
  const stateBeforeRejectedImports = await page.evaluate(() => JSON.stringify({
    active: window.evrenSayfaVerisi().eser.ansiklopediMaddeleri,
    deleted: window.evrenSayfaVerisi().eser.ansiklopediSilinenMaddeler
  }));
  async function rejectImport(name, payload, expectedMessage) {
    const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
    await page.locator('[data-eaw-import]').setInputFiles({ name, mimeType: 'application/json', buffer });
    await page.waitForFunction((fragment) => document.querySelector('#evrenSayfa [data-eaw-status]')?.textContent.includes(fragment), expectedMessage, { timeout: 10000 });
    const after = await page.evaluate(() => JSON.stringify({
      active: window.evrenSayfaVerisi().eser.ansiklopediMaddeleri,
      deleted: window.evrenSayfaVerisi().eser.ansiklopediSilinenMaddeler
    }));
    assert.equal(after, stateBeforeRejectedImports, `${name}: rejected import must leave active and deleted records byte-for-byte unchanged`);
  }
  const badBackup = structuredClone(backup);
  badBackup.maddeler[1].id = badBackup.maddeler[0].id;
  await rejectImport('duplicate-id.json', badBackup, 'yinelenen madde kimliği');
  const badCategoryBackup = structuredClone(backup);
  badCategoryBackup.maddeler[0].tur = 'dragon';
  await rejectImport('invalid-category.json', badCategoryBackup, 'kategorisi geçersiz');
  const brokenLinkBackup = structuredClone(backup);
  brokenLinkBackup.maddeler[0].ilgiliIds = ['missing-article'];
  await rejectImport('broken-link.json', brokenLinkBackup, 'bulunmayan bağlantı hedefini');
  const badImageBackup = structuredClone(backup);
  badImageBackup.maddeler.find((entry) => entry.id === imageArticleId).gorsel.veri = 'data:image/png;base64,not-base64';
  await rejectImport('invalid-image.json', badImageBackup, 'görseli geçersiz');
  const wrongSchemaBackup = structuredClone(backup);
  wrongSchemaBackup.schemaVersion = 99;
  await rejectImport('wrong-schema.json', wrongSchemaBackup, 'şeması bu sürümle uyumlu değil');
  const incompletePublishedBackup = structuredClone(backup);
  incompletePublishedBackup.maddeler.find((entry) => entry.id === plantId).ozet = '';
  await rejectImport('missing-published-summary.json', incompletePublishedBackup, 'kısa tanıtımı eksik');
  const truncatedHistoryBackup = structuredClone(backup);
  truncatedHistoryBackup.maddeler.find((entry) => entry.id === plantId).gecmis = Array.from({ length: 21 }, () => ({ versiyon: 1, madde: {} }));
  await rejectImport('oversized-history.json', truncatedHistoryBackup, '20 sürüm sınırını aşıyor');
  const incompleteCategoryListBackup = structuredClone(backup);
  incompleteCategoryListBackup.kategoriler.pop();
  await rejectImport('incomplete-category-list.json', incompleteCategoryListBackup, 'şeması bu sürümle uyumlu değil');
  const wrongVersionBackup = structuredClone(backup);
  wrongVersionBackup.version = 99;
  await rejectImport('wrong-version.json', wrongVersionBackup, 'geçerli TentiFor ansiklopedi yedeği değil');
  await rejectImport('oversized.json', Buffer.alloc(20 * 1024 * 1024 + 1, 0x20), '20 MB sınırını aşıyor');

  await page.evaluate(() => {
    window.__eawOriginalGomuluAktar = window.evrenGorselVarlik.gomuluAktar;
    window.__eawStagedAssetIds = [];
    window.__eawRestoreCalls = 0;
    window.evrenGorselVarlik.gomuluAktar = async function (...args) {
      window.__eawRestoreCalls += 1;
      if (window.__eawRestoreCalls === 2) throw new Error('simulated image restore failure after one staged image');
      const restored = await window.__eawOriginalGomuluAktar.apply(this, args);
      window.__eawStagedAssetIds.push(restored.id);
      return restored;
    };
  });
  await page.locator('[data-eaw-import]').setInputFiles({ name: 'restore-failure.json', mimeType: 'application/json', buffer: backupBuffer });
  await page.waitForFunction(() => document.querySelector('#evrenSayfa [data-eaw-status]')?.textContent.includes('simulated image restore failure'), null, { timeout: 10000 });
  const afterPartialFailure = await page.evaluate(async () => {
    const world = window.evrenSayfaVerisi().eser;
    const snapshot = JSON.stringify({ active: world.ansiklopediMaddeleri, deleted: world.ansiklopediSilinenMaddeler });
    const staged = await Promise.all(window.__eawStagedAssetIds.map(async (id) => !!(await window.evrenGorselVarlik.oku({ id }, { kaynak: 'indexeddb' }))));
    window.evrenGorselVarlik.gomuluAktar = window.__eawOriginalGomuluAktar;
    delete window.__eawOriginalGomuluAktar;
    return { snapshot, staged, calls: window.__eawRestoreCalls };
  });
  assert.equal(afterPartialFailure.snapshot, stateBeforeRejectedImports, 'failure after a successful partial staging leaves active and deleted JSON exactly unchanged');
  assert.equal(afterPartialFailure.calls, 2, 'restore test fails only after one image has been staged');
  assert.deepEqual(afterPartialFailure.staged, [false], 'partially staged IndexedDB image is rolled back, not leaked');

  await page.locator('[data-eaw-import]').setInputFiles({ name: 'wiki-backup.json', mimeType: 'application/json', buffer: backupBuffer });
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri?.find((entry) => entry.id === id)?.gorsel?.kaynak === 'indexeddb', imageArticleId, { timeout: 20000 });
  assert.ok(dialogs.some((message) => message.includes('mevcut ansiklopedi maddelerini')), 'valid import asks for explicit confirmation before replacing existing records');
  const restoredBytes = await page.evaluate(async (id) => {
    const meta = window.evrenSayfaVerisi().eser.ansiklopediMaddeleri.find((entry) => entry.id === id).gorsel;
    const record = await window.evrenGorselVarlik.oku(meta, { kaynak: 'indexeddb' });
    const size = record && record.blob && record.blob.size || 0;
    if (record && record.url) URL.revokeObjectURL(record.url);
    return size;
  }, imageArticleId);
  assert.ok(restoredBytes > 0, 'portable import restores image bytes into local IndexedDB');
  const oldPlantImageRemains = await page.evaluate(async (id) => {
    const record = await window.evrenGorselVarlik.oku({ id }, { kaynak: 'indexeddb' });
    if (record && record.url) URL.revokeObjectURL(record.url);
    return !!record;
  }, replacedPlantAssetId);
  assert.equal(oldPlantImageRemains, false, 'successful replacement cleans old local blobs that are no longer referenced by articles or revisions');
  const afterImportState = await page.evaluate((id) => {
    const world = window.evrenSayfaVerisi().eser;
    return { active: world.ansiklopediMaddeleri.length, deleted: world.ansiklopediSilinenMaddeler.map((entry) => entry.id), restoredActive: world.ansiklopediMaddeleri.some((entry) => entry.id === id) };
  }, backupDeletedId);
  assert.deepEqual(afterImportState, { active: 8, deleted: [backupDeletedId], restoredActive: false }, 'valid import restores the soft-deleted record to trash, never the public article list');

  await page.locator('#evrenSayfa [data-eaw-new]').click();
  await page.waitForFunction(() => (window.evrenSayfaVerisi()?.eser?.ansiklopediMaddeleri || []).some((entry) => !entry.baslik && entry.durum === 'taslak'));
  const incompleteDraftId = await page.evaluate(() => window.evrenSayfaVerisi().eser.ansiklopediMaddeleri.find((entry) => !entry.baslik && entry.durum === 'taslak').id);
  const incompleteTitle = page.locator(`[data-eaw-field="${incompleteDraftId}:baslik"]`);
  await incompleteTitle.fill('PW Eksik Tanıtım'); await incompleteTitle.blur();
  await page.locator(`[data-eaw-field="${incompleteDraftId}:durum"]`).selectOption('yayinda');
  await page.waitForFunction((id) => document.querySelector(`[data-eaw-entry-status="${id}"]`)?.textContent.includes('kısa tanıtım'), incompleteDraftId);
  assert.equal(await page.evaluate((id) => window.evrenSayfaVerisi().eser.ansiklopediMaddeleri.find((entry) => entry.id === id).durum, incompleteDraftId), 'taslak', 'UI publication guard keeps an entry private when its short summary is missing');

  await createEntry('bitki', 'PW Gizli Taslak', 'yasamDongusu', 'Henüz yayınlanmayan taslak.', false);
  await page.locator('#evrenSayfa [data-eaw-preview]').click();
  await page.waitForSelector('#evrenSayfa .eaw-reader', { timeout: 10000 });
  assert.equal(await page.locator('#evrenSayfa [data-eaw-open]').count(), 8, 'preview lists published articles but omits drafts and soft-deleted records');
  assert.ok(!(await page.locator('#evrenSayfa .eaw-reader').innerText()).includes('PW Gizli Taslak'), 'private draft is absent from reader text');

  const worldSnapshot = await page.evaluate((id) => JSON.parse(JSON.stringify(window.evrenBenimBul(id))), worldId);
  worldSnapshot.ansiklopediMaddeleri = worldSnapshot.ansiklopediMaddeleri.filter((entry) => entry.durum === 'yayinda');
  assert.equal(worldSnapshot.ansiklopediMaddeleri.length, 8, 'clean-profile fixture contains published records only, without local drafts');
  const publicMarkup = await page.evaluate(() => {
    const world = window.evrenSayfaVerisi().eser;
    window.EVS.kaynak = 'public';
    window.EVS.sekme = 'ansiklopedi';
    window.evrenSayfaVerisi = () => ({ eser: world, kaynak: 'public' });
    return window.evrenEkBolum({ eser: world, kaynak: 'public' });
  });
  await page.locator('#evrenSayfa').evaluate((root, markup) => { root.innerHTML = markup; }, publicMarkup);
  assert.equal(await page.locator('#evrenSayfa [data-eaw-open]').count(), 8, 'public index renders published articles but excludes drafts and soft-deleted records');
  assert.equal(await page.locator('#evrenSayfa [data-eaw-category]').count(), 9, 'reader has all categories plus the all-items filter');

  await page.locator('#evrenSayfa [data-eaw-search]').fill('Tarçınlı');
  assert.equal(await page.locator('#evrenSayfa [data-eaw-open]').count(), 1, 'full-text search matches a structured animal field');
  assert.ok(await page.locator('#evrenSayfa [data-eaw-open]').textContent().then((text) => text.includes('PW Göl Tilkisi')));
  await page.locator('#evrenSayfa [data-eaw-search]').fill('kaynak notu');
  assert.equal(await page.locator('#evrenSayfa [data-eaw-open]').count(), 1, 'full-text search includes citation title and description');
  await page.locator('#evrenSayfa [data-eaw-search]').fill('kelime-yok');
  assert.ok(await page.locator('#evrenSayfa .eaw-empty').isVisible(), 'empty state explains when the search has no results');
  await page.locator('#evrenSayfa [data-eaw-search]').fill('');
  for (const type of types) {
    await page.locator(`#evrenSayfa [data-eaw-category="${type.id}"]`).click();
    const expected = backup.maddeler.filter((entry) => entry.tur === type.id && entry.durum === 'yayinda').length;
    assert.equal(await page.locator('#evrenSayfa [data-eaw-open]').count(), expected, `${type.id}: category navigation returns the correct published entries`);
  }
  await page.locator('#evrenSayfa [data-eaw-category=""]').click();
  await page.locator('#evrenSayfa [data-eaw-view="alfabetik"]').click();
  assert.ok(await page.locator('#evrenSayfa .eaw-alpha-index').isVisible(), 'alphabetic index is available independently of the card view');
  await page.locator('#evrenSayfa [data-eaw-view="izgara"]').click();
  assert.ok(await page.locator('#evrenSayfa .eaw-card-grid').isVisible(), 'optional card view remains available');
  await page.locator('#evrenSayfa [data-eaw-view="liste"]').click();

  const mobileLayout = await page.evaluate(() => ({
    rootWidth: document.querySelector('#evrenSayfa').scrollWidth,
    rootClientWidth: document.querySelector('#evrenSayfa').clientWidth,
    categoryHeight: document.querySelector('.eaw-category-button').getBoundingClientRect().height,
    listHeight: document.querySelector('.eaw-list-entry').getBoundingClientRect().height
  }));
  assert.ok(mobileLayout.rootWidth <= mobileLayout.rootClientWidth + 1, `390px Wiki view has no horizontal overflow: ${JSON.stringify(mobileLayout)}`);
  assert.ok(mobileLayout.categoryHeight >= 44 && mobileLayout.listHeight >= 44, 'mobile category and article controls meet touch-target minimums');
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopColumns = await page.locator('#evrenSayfa .eaw-index-layout').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
  assert.ok(desktopColumns >= 2, 'desktop reader separates category navigation and article content');
  await page.setViewportSize({ width: 390, height: 844 });

  await page.locator('#evrenSayfa [data-eaw-open="' + plantId + '"]').click();
  await page.waitForFunction((id) => new URL(location.href).searchParams.get('wiki') === id, plantId);
  await page.waitForSelector('#evrenSayfa .eaw-article h1', { timeout: 5000 });
  await page.waitForFunction(() => { const image = document.querySelector('#evrenSayfa .eaw-article-image img'); return image && image.complete && image.naturalWidth > 0; }, null, { timeout: 15000 });
  assert.equal(await page.locator('#evrenSayfa .eaw-article h1').textContent(), 'PW Ayçiçeği', 'article link selects the stable record ID');
  assert.equal(await page.locator('#evrenSayfa .eaw-article .eaw-summary').textContent().then((text) => text.includes('tanıtım')), true, 'detail shows its short summary');
  assert.ok(await page.locator('#evrenSayfa .eaw-infobox').isVisible(), 'article detail has a wiki infobox');
  const renderedPixel = await page.locator('#evrenSayfa .eaw-article-image img').evaluate((image) => {
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  });
  assert.ok(renderedPixel[0] > 200 && renderedPixel[1] < 40 && renderedPixel[2] < 40, `author reader renders the restored red IndexedDB image: ${renderedPixel}`);
  assert.ok(await page.locator('#evrenSayfa .eaw-related [data-eaw-open="' + animalId + '"]').isVisible(), 'stable related ID links to a published article');
  const sourceLink = page.locator('#evrenSayfa .eaw-bibliography a');
  assert.equal(await sourceLink.getAttribute('href'), 'https://example.invalid/kiyi-atlasi', 'citation renders only a validated HTTPS URL');
  assert.equal(await sourceLink.getAttribute('rel'), 'noopener noreferrer', 'external citation uses safe link attributes');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__eawCopied = text; } } }));
  await page.locator('#evrenSayfa [data-eaw-copy="' + plantId + '"]').click();
  await page.waitForFunction(() => !!window.__eawCopied);
  assert.equal(new URL(await page.evaluate(() => window.__eawCopied)).searchParams.get('wiki'), plantId, 'copy-link action includes the stable article ID');

  await page.locator('#evrenSayfa .eaw-article [data-eaw-back]').click();
  await page.waitForFunction(() => !new URL(location.href).searchParams.has('wiki'));
  await page.waitForSelector('#evrenSayfa .eaw-index-layout', { timeout: 5000 });
  await page.goForward();
  await page.waitForFunction((id) => new URL(location.href).searchParams.get('wiki') === id, plantId);
  await page.waitForSelector('#evrenSayfa .eaw-article h1', { timeout: 5000 });
  assert.equal(await page.locator('#evrenSayfa .eaw-article h1').textContent(), 'PW Ayçiçeği', 'browser Forward restores the selected article');

  // Reload the real app route, then use owner preview to verify that the direct article URL hydrates.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.id === id, worldId, { timeout: 15000 });
  assert.equal(await page.evaluate(() => new URL(location.href).searchParams.get('wiki')), plantId, 'deep-link query survives a page refresh');
  await page.locator('#evrenSayfa [data-evs-sekme="ansiklopedi"]').click();
  await page.locator('#evrenSayfa [data-eaw-preview]').click();
  await page.waitForFunction((title) => document.querySelector('#evrenSayfa .eaw-article h1')?.textContent === title, 'PW Ayçiçeği', { timeout: 10000 });
  await page.locator('#evrenSayfa [data-eaw-edit]').click();
  const restoredDraftId = await createEntry('bitki', 'PW Gizli Taslak', 'yasamDongusu', 'Henüz yayınlanmayan taslak.', false);
  await page.goto(`${baseURL}/?wiki=${encodeURIComponent(restoredDraftId)}#/ev/benim/${encodeURIComponent(worldId)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.id === id, worldId, { timeout: 15000 });
  await page.locator('#evrenSayfa [data-evs-sekme="ansiklopedi"]').click();
  await page.locator('#evrenSayfa [data-eaw-preview]').click();
  await page.waitForSelector('#evrenSayfa .eaw-reader', { timeout: 10000 });
  assert.equal(await page.locator('#evrenSayfa .eaw-article').count(), 0, 'a guessed draft ID never opens an article, even with a direct URL');
  assert.ok(!(await page.locator('#evrenSayfa .eaw-reader').innerText()).includes('PW Gizli Taslak'), 'direct draft URL never reveals private text');

  // A clean browser profile has the world JSON but not the author's IndexedDB image bytes.
  const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await configureTelemetryOnly(secondContext);
  const secondPage = await secondContext.newPage();
  const secondErrors = [];
  const secondRequests = [];
  const secondFailures = [];
  const secondInAppReads = [];
  const secondLocalHttpErrors = [];
  const secondDialogs = [];
  secondPage.on('pageerror', (error) => secondErrors.push(error.message));
  secondPage.on('console', (message) => { if (message.type() === 'error') secondErrors.push(message.text()); });
  secondPage.on('dialog', async (dialog) => { secondDialogs.push(dialog.message()); await dialog.accept(); });
  secondPage.on('request', (request) => secondRequests.push({ url: request.url(), method: request.method() }));
  secondPage.on('requestfailed', (request) => secondFailures.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  secondPage.on('response', (response) => {
    const request = { url: response.url(), method: response.request().method() };
    if (isObservedAppRead(request)) secondInAppReads.push({ ...request, status: response.status() });
    const url = new URL(response.url());
    if (url.origin === baseURL && response.status() >= 400 && url.pathname !== '/favicon.ico') secondLocalHttpErrors.push({ url: response.url(), status: response.status() });
  });
  await secondPage.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  await secondPage.waitForFunction(() => typeof window.fanEserlerim === 'function' && typeof window.fanEserlerimYaz === 'function');
  await secondPage.evaluate((copy) => {
    const worlds = window.fanEserlerim();
    worlds.push(copy);
    window.fanEserlerimYaz(worlds);
  }, worldSnapshot);
  await secondPage.goto(`${baseURL}/?wiki=${encodeURIComponent(imageArticleId)}#/ev/benim/${encodeURIComponent(worldId)}`, { waitUntil: 'domcontentloaded' });
  await secondPage.waitForFunction((id) => window.evrenSayfaVerisi()?.eser?.id === id, worldId, { timeout: 15000 });
  await secondPage.locator('#evrenSayfa [data-evs-sekme="ansiklopedi"]').click();
  await secondPage.locator('#evrenSayfa [data-eaw-preview]').click();
  await secondPage.waitForSelector('#evrenSayfa .eaw-article h1', { timeout: 10000 });
  await secondPage.waitForSelector('#evrenSayfa .eaw-image-empty', { timeout: 10000 });
  assert.match(await secondPage.locator('#evrenSayfa .eaw-image-empty').textContent(), /yalnızca yazarın tarayıcı profilinde/, 'a second reader without the IndexedDB blob receives an explicit unavailable-image notice');
  const emptySecondImageStore = await secondPage.evaluate(async (ids) => {
    const world = window.evrenSayfaVerisi().eser;
    for (const id of ids) {
      const meta = world.ansiklopediMaddeleri.find((entry) => entry.id === id)?.gorsel;
      if (!meta) return false;
      const record = await window.evrenGorselVarlik.oku(meta, { kaynak: 'indexeddb' });
      if (record?.url) URL.revokeObjectURL(record.url);
      if (record?.blob?.size) return false;
    }
    return true;
  }, [imageArticleId, plantId]);
  assert.equal(emptySecondImageStore, true, 'second profile starts with article metadata but no IndexedDB image bytes');
  await secondPage.locator('#evrenSayfa [data-eaw-edit]').click();
  await secondPage.locator('#evrenSayfa [data-eaw-import]').setInputFiles({ name: 'clean-profile-backup.json', mimeType: 'application/json', buffer: backupBuffer });
  await secondPage.waitForFunction(async ({ ids, deletedId }) => {
    const world = window.evrenSayfaVerisi()?.eser;
    if (!world) return false;
    for (const id of ids) {
      const meta = world.ansiklopediMaddeleri?.find((entry) => entry.id === id)?.gorsel;
      if (!meta) return false;
      const record = await window.evrenGorselVarlik.oku(meta, { kaynak: 'indexeddb' });
      if (record?.url) URL.revokeObjectURL(record.url);
      if (!record?.blob?.size) return false;
    }
    return world.ansiklopediMaddeleri.length === 8 && world.ansiklopediSilinenMaddeler.some((entry) => entry.id === deletedId);
  }, { ids: [imageArticleId, plantId], deletedId: backupDeletedId }, { timeout: 20000 });
  assert.ok(secondDialogs.some((message) => message.includes('mevcut ansiklopedi maddelerini')), 'clean-profile import also requires explicit replacement confirmation');
  const cleanImportState = await secondPage.evaluate(() => {
    const world = window.evrenSayfaVerisi().eser;
    return { count: world.ansiklopediMaddeleri.length, deleted: world.ansiklopediSilinenMaddeler.map((entry) => entry.id), titles: world.ansiklopediMaddeleri.map((entry) => entry.baslik), status: document.querySelector('#evrenSayfa [data-eaw-status]')?.textContent || '' };
  });
  assert.equal(cleanImportState.count, 8, `portable backup imports into a second profile with empty image storage: ${JSON.stringify(cleanImportState)}`);
  await waitForObservedReads(secondRequests, secondInAppReads);
  await secondContext.close();

  assert.deepEqual(pageErrors, [], `unhandled app exceptions: ${pageErrors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);
  assert.deepEqual(secondErrors, [], `second-reader runtime errors: ${secondErrors.join(' | ')}`);
  await waitForObservedReads(requests, inAppReads);
  const allRequests = requests.concat(secondRequests);
  const external = allRequests.filter((request) => {
    const url = new URL(request.url);
    const rum = url.hostname === 'static.cloudflareinsights.com';
    const observedAppRead = isObservedAppRead(request);
    return url.origin !== baseURL && !rum && !observedAppRead;
  });
  assert.deepEqual(external, [], `unexpected external requests: ${JSON.stringify(external)}`);
  const realAppReads = inAppReads.concat(secondInAppReads);
  const observedReadRequests = allRequests.filter(isObservedAppRead);
  assert.ok(observedReadRequests.length > 0, 'at least one real, method-allowlisted application read is observed; the network check is not vacuous');
  assert.ok(realAppReads.every((read) => read.status >= 200 && read.status < 300), `live in-app read API failed: ${JSON.stringify(realAppReads)}`);
  const missingReadResponses = observedReadRequests.filter((request) => !realAppReads.some((response) => response.url === request.url && response.method === request.method));
  assert.equal(realAppReads.length, observedReadRequests.length, `every live in-app read API request must produce an observable response: ${JSON.stringify(missingReadResponses)}`);
  assert.deepEqual(localHttpErrors.concat(secondLocalHttpErrors), [], 'same-origin app responses must not hide HTTP 4xx/5xx failures');
  assert.deepEqual(requestFailures.concat(secondFailures), [], 'real application network requests must not be hidden or fail');
  const writes = allRequests.filter((request) => new URL(request.url).origin !== baseURL && !['GET', 'HEAD'].includes(request.method) && !isObservedAppRead(request) && new URL(request.url).hostname !== 'static.cloudflareinsights.com');
  assert.deepEqual(writes, [], `disposable local test must not write to remote APIs: ${JSON.stringify(writes)}`);
  await context.close();
  console.log('Universe encyclopedia Playwright: PASS (eight categories, 390px/desktop Wiki layout, sources, clean-profile image import/visibility, JSON rollback, stable deep links, refresh, Back/Forward and private drafts).');
} catch (error) {
  console.error(error.stack || error);
  if (output) console.error(`Local server output:\n${output}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server && !server.killed) server.kill('SIGTERM');
}
