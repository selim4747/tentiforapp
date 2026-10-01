import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const root = process.cwd();
const source = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const dom = (html = '<!doctype html><html><body></body></html>') => new JSDOM(html, {
  url: 'https://tentifor.test/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
function evalScript(page, code) { const script = page.window.document.createElement('script'); script.textContent = code; page.window.document.head.appendChild(script); script.remove(); }
const failures = [];
async function scenario(name, run) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
function universePage(universe, html = '<!doctype html><html><body><div id="evrenSayfa"><div class="evs-govde"></div></div><div id="perde" hidden></div><button data-es-yeni></button></body></html>') {
  const page = dom(html);
  page.window.__activeUniverse = universe;
  page.window.evrenSayfaVerisi = () => ({ eser: page.window.__activeUniverse });
  return page;
}
function drawUniverse(page) {
  evalScript(page, source('js/engine/101-v61-universe.js'));
  page.window.document.dispatchEvent(new page.window.Event('tf-veri-hazir'));
}

await scenario('dashboard menu actions remain unique after repeated observer refresh', () => {
  const page = dom('<!doctype html><html><body><div id="mobilMenu"><input class="mm-ara"><div class="mm-eylemler"><button data-evren-sec>Evrenler</button><button data-uyelik-ac>Planlar</button></div><div class="mm-sayfalar"></div></div></body></html>');
  try {
    const { window } = page;
    let observer;
    window.MutationObserver = class { constructor(callback) { observer = callback; } observe() {} disconnect() {} };
    window.TF4 = { uyelik: { tip: 'ucretsiz' } };
    window.fanEserlerim = () => [];
    evalScript(page, source('js/engine/92-v51-dashboard.js'));
    window.TF51.refresh();
    observer([]);
    observer([]);
    assert.equal(window.document.querySelectorAll('#mobilMenu [data-evren-sec]').length, 1, 'universe actions');
    assert.equal(window.document.querySelectorAll('#mobilMenu [data-uyelik-ac]').length, 1, 'plan actions');
    assert.equal(window.document.querySelectorAll('#mobilMenu [data-tf51-bildirimler]').length, 1, 'notification actions');
  } finally { page.window.close(); }
});

const mirroredPlaces = () => ({
  id: 'e25', ad: 'Fixture', kisiler: [],
  yerler: [{ id: 'y1', ad: 'North Station', aciklama: 'A place' }],
  harita: { yerler: [{ id: 'y1', ad: 'North Station', not: 'A place', x: 10, y: 20 }] },
  tarih: [], sozluk: []
});
await scenario('6.1 summary counts mirrored workshop places once', () => {
  const page = universePage(mirroredPlaces());
  try {
    drawUniverse(page);
    const placeStat = [...page.window.document.querySelectorAll('#tf61-center .tf61-stat-grid > div')].find((el) => el.textContent.includes('yer'));
    assert.equal(placeStat.querySelector('b').textContent, '1');
  } finally { page.window.close(); }
});
await scenario('6.1 map lists mirrored workshop places once', () => {
  const page = universePage(mirroredPlaces());
  try {
    drawUniverse(page);
    page.window.document.querySelector('[data-tf61-tab="harita"]').click();
    assert.equal(page.window.document.querySelectorAll('#tf61-center .tf61-list article').length, 1);
  } finally { page.window.close(); }
});
await scenario('6.1 E25 timeline fallback reads lexical archive data', () => {
  const page = universePage({ ...mirroredPlaces(), tarih: [] });
  try {
    evalScript(page, 'let veri = { zamanCizelgesi: [{ no: "archive-1", baslik: "ARCHIVE TIMELINE ROW", metin: "archive" }] };');
    drawUniverse(page);
    page.window.document.querySelector('[data-tf61-tab="zaman"]').click();
    assert.match(page.window.document.querySelector('#tf61-center .tf61-body').textContent, /ARCHIVE TIMELINE ROW/);
  } finally { page.window.close(); }
});
await scenario('6.1 personal notes use active-universe-specific storage keys', () => {
  const page = universePage({ ...mirroredPlaces(), id: 'e25' });
  try {
    drawUniverse(page);
    page.window.document.querySelector('[data-tf61-tab="notlar"]').click();
    page.window.document.querySelector('#tf61-note').value = 'E25-only note';
    page.window.document.querySelector('[data-tf61-note-save]').click();
    assert.equal(page.window.localStorage.getItem('tf61-notes-e25'), 'E25-only note');
    page.window.__activeUniverse = { id: 'e26', ad: 'Other', kisiler: [], yerler: [], harita: { yerler: [] }, tarih: [], sozluk: [] };
    page.window.document.dispatchEvent(new page.window.Event('tf-veri-hazir'));
    page.window.document.querySelector('[data-tf61-tab="notlar"]').click();
    assert.equal(page.window.document.querySelector('#tf61-note').value, '', 'another universe must not inherit the saved note');
  } finally { page.window.close(); }
});
const hiddenFixture = () => ({
  id: 'e25', ad: 'Fixture',
  kisiler: [{ id: 'p1', ad: 'SECRET PERSON', detay: 'SECRET DETAIL', gizli: ['hidden'] }],
  yerler: [{ id: 'y1', ad: 'SECRET PLACE', not: 'SECRET PLACE NOTE', gizli: ['hidden'] }],
  harita: { yerler: [{ id: 'y1', ad: 'SECRET PLACE', not: 'SECRET PLACE NOTE', gizli: ['hidden'], x: 1, y: 2 }] },
  tarih: [{ no: 't1', baslik: 'SECRET EVENT', metin: 'SECRET EVENT TEXT', gizli: ['hidden'] }], sozluk: []
});
await scenario('6.1 daily universe note respects spoiler hiding', () => {
  const page = universePage(hiddenFixture());
  try {
    drawUniverse(page);
    assert.doesNotMatch(page.window.document.querySelector('#tf61-center').textContent, /SECRET PERSON|SECRET DETAIL|SECRET PLACE|SECRET EVENT/);
  } finally { page.window.close(); }
});
await scenario('6.1 map view respects spoiler hiding', () => {
  const page = universePage(hiddenFixture());
  try {
    drawUniverse(page);
    page.window.document.querySelector('[data-tf61-tab="harita"]').click();
    assert.doesNotMatch(page.window.document.querySelector('#tf61-center .tf61-body').textContent, /SECRET PLACE|SECRET PLACE NOTE/);
  } finally { page.window.close(); }
});
await scenario('6.1 surprise discovery respects spoiler hiding', () => {
  const page = universePage(hiddenFixture());
  try {
    page.window.Math.random = () => 0;
    drawUniverse(page);
    page.window.document.querySelector('[data-tf61-surprise]').click();
    assert.doesNotMatch(page.window.document.querySelector('#tf61-center').textContent, /SECRET PERSON|SECRET DETAIL/);
  } finally { page.window.close(); }
});

await scenario('6.1 workshop reports failed durable storage and does not route', () => {
  const page = universePage(null);
  try {
    const { window } = page;
    const draft = { id: 'draft-1', tur: 'evren', yerler: [], kisiler: [], kurallar: [], sozluk: [] };
    window.fanYeni = () => draft;
    window.fanEserlerim = () => [draft];
    window.fanEserlerimYaz = () => false;
    window.perdeKapat = () => {};
    drawUniverse(page);
    window.document.querySelector('[data-es-yeni]').click();
    window.document.querySelector('#tf61-ad').value = 'Temporary draft';
    window.document.querySelector('#tf61-wizard-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    assert.match(window.document.querySelector('#tf61-status').textContent, /kaydedilemedi|depolama/i);
    assert.doesNotMatch(window.location.hash, /\/ev\/benim\//);
  } finally { page.window.close(); }
});

await scenario('6.1.1 free plan rejects a second universe draft', () => {
  const page = dom();
  try {
    const { window } = page;
    let drafts = [];
    let nextId = 0;
    window.MutationObserver = class { constructor() {} observe() {} };
    window.TF4 = { uyelik: { tip: 'ucretsiz' } };
    window.fanEserlerim = () => drafts;
    window.fanEserlerimYaz = () => true;
    window.fanYeni = (tur) => { const item = { id: `draft-${++nextId}`, tur }; drafts.push(item); return item; };
    evalScript(page, source('js/engine/91-v473-uyelik.js'));
    assert.ok(window.fanYeni('evren'), 'the first free draft is allowed');
    assert.equal(window.fanYeni('evren'), null, 'a second free draft must be rejected');
    assert.equal(drafts.length, 1);
  } finally { page.window.close(); }
});

await scenario('5.4.2 resume opens the first unread step', () => {
  const page = dom('<!doctype html><html><body><button data-v54-okumaya-devam>Devam et</button></body></html>');
  try {
    const { window } = page;
    let destination = null;
    window.yolAktif = () => ({ id: 'kar:fixture' });
    window.yolIlerleme = () => ({ sonraki: { git: '#/roman', ad: 'İlk okunmamış adım' } });
    window.yolAdimaGit = (step) => { destination = step && step.git; };
    window.setInterval = () => 0;
    evalScript(page, source('js/core/54-v54-olgunlastirma.js'));
    window.document.querySelector('[data-v54-okumaya-devam]').click();
    assert.equal(destination, '#/roman');
  } finally { page.window.close(); }
});

await scenario('5.3.4 inbox ignores stale cross-account responses', async () => {
  const page = dom('<!doctype html><html><body><div id="bildirimMerkezi"></div></body></html>');
  try {
    const { window } = page;
    const pending = [];
    window.kacir = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    window.hesapKullanici = { id: 'account-A' };
    window.hesapIstemci = { rpc: () => new Promise((resolve) => pending.push(resolve)) };
    evalScript(page, source('js/topluluk/41-bildirim.js'));
    const requestA = window.bildirimMerkeziCiz();
    window.hesapKullanici = { id: 'account-B' };
    const requestB = window.bildirimMerkeziCiz();
    pending[1]({ data: [{ no: 'B', metin: 'Account B notification' }], error: null });
    await requestB;
    pending[0]({ data: [{ no: 'A', metin: 'Account A private notification' }], error: null });
    await requestA;
    assert.match(window.document.querySelector('#bildirimMerkezi').textContent, /Account B notification/);
    assert.doesNotMatch(window.document.querySelector('#bildirimMerkezi').textContent, /Account A private notification/);
  } finally { page.window.close(); }
});
await scenario('5.3.4 inbox safely ignores a response after its UI is removed', async () => {
  const page = dom('<!doctype html><html><body><div id="bildirimMerkezi"></div></body></html>');
  try {
    const { window } = page;
    let resolveRequest;
    window.kacir = (value) => String(value ?? '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    window.hesapKullanici = { id: 'account-A' };
    window.hesapIstemci = { rpc: () => new Promise((resolve) => { resolveRequest = resolve; }) };
    evalScript(page, source('js/topluluk/41-bildirim.js'));
    const request = window.bildirimMerkeziCiz();
    window.document.querySelector('#bildirimMerkezi').remove();
    resolveRequest({ data: [{ no: 'late', metin: 'late response' }], error: null });
    await assert.doesNotReject(request);
  } finally { page.window.close(); }
});

await scenario('6.1 timeline hides the event title and text when spoilers are disabled', () => {
  const page = universePage(hiddenFixture());
  try {
    drawUniverse(page);
    page.window.document.querySelector('[data-tf61-tab="zaman"]').click();
    assert.doesNotMatch(page.window.document.querySelector('#tf61-center .tf61-body').textContent, /SECRET EVENT|SECRET EVENT TEXT/);
  } finally { page.window.close(); }
});
await scenario('6.1 relationships hide spoiler-tagged relationship labels and people', () => {
  const fixture = hiddenFixture(); fixture.baglar = [{ a: 'SECRET PERSON', b: 'PUBLIC PERSON', etiket: 'SECRET RELATION', gizli: ['hidden'] }];
  const page = universePage(fixture);
  try {
    drawUniverse(page);
    page.window.document.querySelector('[data-tf61-tab="baglar"]').click();
    assert.doesNotMatch(page.window.document.querySelector('#tf61-center .tf61-body').textContent, /SECRET PERSON|PUBLIC PERSON|SECRET RELATION/);
  } finally { page.window.close(); }
});
await scenario('6.1 encyclopedia hides spoiler-tagged record names and descriptions', () => {
  const page = universePage(hiddenFixture());
  try {
    drawUniverse(page);
    page.window.document.querySelector('[data-tf61-tab="ansiklopedi"]').click();
    assert.doesNotMatch(page.window.document.querySelector('#tf61-center .tf61-body').textContent, /SECRET PERSON|SECRET DETAIL|SECRET PLACE|SECRET EVENT/);
  } finally { page.window.close(); }
});
await scenario('6.1 spoiler toggle reveals records deliberately', () => {
  const page = universePage(hiddenFixture());
  try {
    drawUniverse(page);
    page.window.document.querySelector('[data-tf61-spoiler]').click();
    page.window.document.querySelector('[data-tf61-tab="harita"]').click();
    assert.match(page.window.document.querySelector('#tf61-center .tf61-body').textContent, /SECRET PLACE/);
  } finally { page.window.close(); }
});
await scenario('6.1.1 EvrenYazar remains unlimited after free-tier enforcement', () => {
  const page = dom();
  try {
    const { window } = page;
    const drafts = [];
    window.MutationObserver = class { constructor() {} observe() {} };
    window.TF4 = { uyelik: { tip: 'evrenyazar' } };
    window.fanEserlerim = () => drafts;
    window.fanEserlerimYaz = () => true;
    window.fanYeni = (tur) => { const item = { id: `draft-${drafts.length + 1}`, tur }; drafts.push(item); return item; };
    evalScript(page, source('js/engine/91-v473-uyelik.js'));
    for (let i = 0; i < 8; i += 1) assert.ok(window.fanYeni('evren'));
    assert.equal(drafts.length, 8);
  } finally { page.window.close(); }
});
await scenario('shared JSON persistence reports a failed localStorage write', () => {
  const page = dom();
  try {
    const { window } = page;
    Object.defineProperty(window, 'localStorage', { configurable: true, value: { setItem() { throw new Error('storage quota'); } } });
    const kayitWriter = source('js/core/24-arsiv-mantigi.js').match(/function kayitYaz\(e,i\)\{try\{[^}]*\}catch\{[^}]*\}\}/);
    const jsonWriter = source('js/arsiv/15-ziyaretci-notlar.js').match(/function jsonYaz\(a,n\)\{[^}]*\}/);
    assert.ok(kayitWriter && jsonWriter, 'storage writer definitions must be discoverable');
    evalScript(page, 'const bellek={};' + kayitWriter[0]);
    evalScript(page, jsonWriter[0]);
    assert.equal(window.jsonYaz('quota-test', { saved: false }), false);
  } finally { page.window.close(); }
});

if (failures.length) {
  console.error(`\n${failures.length} focused pre-fix regression(s) failed as expected:`);
  for (const { name } of failures) console.error(`- ${name}`);
  process.exitCode = 1;
} else {
  console.log('Deep post-5.3.0 focused regressions: PASS');
}
