import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const read = (file) => fs.readFileSync(file, 'utf8');
const routeSource = read('js/core/00-rota.js');
const navSource = read('js/arayuz/18-gezinme.js');
const mapSource = read('js/arsiv/09-medya-harita.js');
const bundleMapSource = read('js/paket-1.js');
const welcomeSource = read('js/arayuz/31-ux-64.js');
const visitorSource = read('js/engine/sira-6316.js');
const html = read('index.html');
const redirects = read('_redirects');
const server = read('server.js');

function routeWindow(url) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><main id="tepe"></main></body></html>', {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  dom.window.eval(routeSource);
  return dom;
}

// Existing generic route mapping resolves both the clean path and legacy hash to the same app route.
const clean = routeWindow('https://tentifor.test/harita/');
assert.equal(clean.window.rota(), '#/harita');
assert.equal(clean.window.rotadanYol('#/harita'), '/harita/');
assert.equal(clean.window.rotaAdresi('#/harita'), 'https://tentifor.test/harita/');
clean.window.close();

const directHash = routeWindow('https://tentifor.test/#/harita');
assert.equal(directHash.window.rota(), '#/harita');
assert.equal(directHash.window.location.pathname, '/harita/', 'a direct #/harita visit is canonicalized to the clean URL');
assert.equal(directHash.window.location.hash, '');
directHash.window.close();

const archive = routeWindow('https://tentifor.test/tomye/');
assert.equal(archive.window.rota(), '#/tomye');
assert.equal(archive.window.rotadanYol('#/tomye'), '/tomye/');
archive.window.close();

assert.match(redirects, /^\/harita\s+\/index\.html\s+200$/m);
assert.match(redirects, /^\/harita\/\s+\/index\.html\s+200$/m);
assert.match(server, /'basla', 'harita'/);

// The map-specific exception is exercised against real data objects and an access guard that denies every canon universe.
const mapDom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://tentifor.test/harita/' , runScripts: 'outside-only' });
mapDom.window.veri = { haritalar: [
  { id: 'tomye', yerler: [{ id: 'liman', ad: 'Liman' }] },
  { id: 'ax24', yerler: [] },
  { id: 'e25', yerler: [] },
  { id: 'e26', yerler: [] },
  { id: 'e99', yerler: [] },
  { id: 'my-private-world', yerler: [] }
] };
mapDom.window.kanonEvrenErisimi = () => false;
mapDom.window.haritaYonetici = () => false;
mapDom.window.katmanAcik = () => false;
mapDom.window.evrenMeta = () => ({});
mapDom.window.haritaKesfedildi = () => false;
const allowStart = mapSource.indexOf('function haritaKanonErisimi(');
const allowEnd = mapSource.indexOf('function aktifHarita(', allowStart);
const visibleStart = mapSource.indexOf('function haritaEvrenGorunur(', allowEnd);
const visibleEnd = mapSource.indexOf('function haritaYerDurumu(', visibleStart);
assert.ok(allowStart >= 0 && allowEnd > allowStart && visibleEnd > visibleStart, 'map guard and visibility functions exist');
mapDom.window.eval(mapSource.slice(allowStart, allowEnd) + mapSource.slice(visibleStart, visibleEnd));
assert.equal(mapDom.window.haritaKanonErisimi('tomye'), true);
assert.equal(mapDom.window.haritaKanonErisimi('ax24'), true);
for (const id of ['e25', 'e26', 'e99', 'my-private-world']) {
  assert.equal(mapDom.window.haritaKanonErisimi(id), false, `${id} keeps its existing access guard`);
  assert.equal(mapDom.window.haritaEvrenGorunur(mapDom.window.veri.haritalar.find((item) => item.id === id)), false);
}
assert.equal(mapDom.window.haritaGorunenEvrenler().map((item) => item.id).join(','), 'tomye,ax24');
assert.equal(mapDom.window.haritaEvrenGorunur({ id: 'tomye', gizli: 'locked-layer' }), false, 'public maps do not unlock their hidden layers');
mapDom.window.evrenMeta = () => ({ sis: true });
assert.equal(mapDom.window.haritaEvrenGorunur(mapDom.window.veri.haritalar[1]), false, 'public map exception does not bypass fog/spoiler state');
mapDom.window.close();

// Both the readable source and shipped bundle explain an empty Ax-24 map instead of opening an empty globe.
for (const [name, source] of [['source', mapSource], ['bundle', bundleMapSource]]) {
  const renderStart = source.indexOf('function haritaCiz(){');
  const renderEnd = source.indexOf('function haritaTamKur()', renderStart);
  assert.ok(renderStart >= 0 && renderEnd > renderStart, `${name} map renderer exists`);
  const dom = new JSDOM('<!doctype html><html><body><div id="haritaAlan"></div></body></html>', { runScripts: 'outside-only' });
  let selected = 'ax24';
  dom.window.veri = { haritalar: [
    { id: 'tomye', ad: 'Tömye', aciklama: 'Tömye açıklaması', yerler: [{ id: 'liman' }] },
    { id: 'ax24', ad: 'Ax-24', aciklama: 'Ax-24 açıklaması', yerler: [] }
  ] };
  dom.window.aktifHarita = () => dom.window.veri.haritalar.find((item) => item.id === selected);
  dom.window.haritaEvrenGorunur = () => true;
  dom.window.haritaGorunenEvrenler = () => dom.window.veri.haritalar;
  dom.window.kacir = (value) => String(value ?? '');
  dom.window.HARITA_IKON_BUYUT = '↗';
  dom.window.haritaOnizlemeGozle = () => {};
  dom.window.HT = { acik: false };
  dom.window.gzkHaritaSatiri = () => {};
  dom.window.eval(source.slice(renderStart, renderEnd));
  dom.window.haritaCiz();
  assert.match(dom.window.document.querySelector('#haritaAlan').textContent, /Ax-24 haritasında henüz yer yok/);
  assert.equal(dom.window.document.querySelector('#haritaAlan .harita-onizleme'), null, `${name} must not offer an empty full-screen map`);
  assert.ok(dom.window.document.querySelector('#haritaAlan [data-harita-sec="tomye"]'));
  selected = 'tomye';
  dom.window.haritaCiz();
  assert.ok(dom.window.document.querySelector('#haritaAlan .harita-onizleme'), `${name} keeps the populated Tömye map interactive`);
  dom.window.close();
}

// The production breadcrumb function is executed against route/map state, not just searched as text.
const labelDom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://tentifor.test/' , runScripts: 'outside-only' });
let activeMap = 'tomye';
labelDom.window.rota = () => '#/harita';
labelDom.window.aktifHarita = () => ({ id: activeMap });
const labelStart = navSource.indexOf('function aktifKonumEtiketi(');
const labelEnd = navSource.indexOf('function aktifBolumIsaretle(', labelStart);
assert.ok(labelStart >= 0 && labelEnd > labelStart, 'active-location function exists');
labelDom.window.eval(navSource.slice(labelStart, labelEnd));
assert.equal(labelDom.window.aktifKonumEtiketi(), 'Tentiforverse · 24. Evren · Tömye · Harita');
activeMap = 'ax24';
assert.equal(labelDom.window.aktifKonumEtiketi(), 'Tentiforverse · 24. Evren · Ax-24 · Harita');
labelDom.window.rota = () => '#/tomye';
assert.equal(labelDom.window.aktifKonumEtiketi(), 'Tentiforverse · 24. Evren · Tömye · Arşiv');
labelDom.window.rota = () => '#/arsiv';
assert.equal(labelDom.window.aktifKonumEtiketi(), 'Tentiforverse · 24. Evren · Tömye');
labelDom.window.rota = () => '#/ev/site/e25';
assert.equal(labelDom.window.aktifKonumEtiketi(), 'E25 · kanon evren');
labelDom.window.rota = () => '#/ev/site/e26';
assert.equal(labelDom.window.aktifKonumEtiketi(), 'E26 · kanon evren');
labelDom.window.close();

// The page route keeps the two distinct actions and the map section is explicitly named in Tömye context.
assert.match(html, /data-evren-git="harita:tomye"/);
assert.match(html, /href="#\/tomye">Tömye arşivi</);
assert.match(html, /Tömye haritasını keşfet/);
assert.match(html, /hero-diger-yollar/);
assert.match(html, /aria-label="Ana sayfa bölümlerine atla"/);
for (const target of ['#kesif', '#anaEvrenler', '#/harita', '#/dunya', '#/oyunlar']) {
  assert.ok(html.includes(`href="${target}"`), `quick navigation target ${target} exists`);
}
assert.doesNotMatch(html, /id="surumNotuAlan"/);
assert.match(html, /Tömye ve Ax-24 gezegen haritaları/);
assert.match(navSource, /id:"dunya",ad:"Tömye dünyası"/);

// Exercise the date strip's actual calendar/render functions with missing and then loaded data.
const dateDom = new JSDOM('<!doctype html><html><body><p class="hero-metin">Hero</p></body></html>', {
  url: 'https://tentifor.test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
dateDom.window.veri = { takvim: { aylar: [] } };
dateDom.window.kac = (value) => String(value ?? '');
dateDom.window.kalaniOku = () => null;
const calendarStart = visitorSource.indexOf('  function tomyeBugun()');
const calendarEnd = visitorSource.indexOf('  function kalaniYaz(', calendarStart);
const stripStart = visitorSource.indexOf('  function tarihSeridi()', calendarEnd);
const stripEnd = visitorSource.indexOf('  function fanTaslak()', stripStart);
assert.ok(calendarStart >= 0 && calendarEnd > calendarStart && stripEnd > stripStart, 'calendar and strip render functions exist');
dateDom.window.eval(visitorSource.slice(calendarStart, calendarEnd) + visitorSource.slice(stripStart, stripEnd));
dateDom.window.tarihSeridi();
let dateStrip = dateDom.window.document.querySelector('#siraTarih');
assert.equal(dateStrip.textContent, 'Tömye takvimi şu anda kullanılamıyor.');
assert.doesNotMatch(dateStrip.textContent, /Tömye'de bugün\s*\./);
dateDom.window.veri.takvim = { epokDunya: new Date().toISOString().slice(0, 10), epokYil: 1, yilGun: 1, aylar: [{ ad: 'Test Ayı', gun: 1 }] };
dateDom.window.tarihSeridi();
dateStrip = dateDom.window.document.querySelector('#siraTarih');
assert.match(dateStrip.textContent, /Tömye'de bugün 1 Test Ayı 1\./);
dateDom.window.veri.takvim = undefined;
dateDom.window.tarihSeridi();
assert.equal(dateStrip.textContent, 'Tömye takvimi yükleniyor…');
const RealDate = dateDom.window.Date;
const fixedNow = Date.UTC(2000, 0, 1) + 49 * 60 * 60 * 1000;
dateDom.window.Date = class FixedDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
  static now() { return fixedNow; }
};
dateDom.window.veri.takvim = { epokDunya: '2000-01-01', epokYil: 1, yilGun: 310, gunSaat: 25, aylar: [{ ad: 'Test Ayı', gun: 310 }] };
dateDom.window.tarihSeridi();
assert.match(dateDom.window.document.querySelector('#siraTarih').textContent, /2 Test Ayı 1/, '49 Earth hours equal one 25-hour Tömye day');
dateDom.window.veri.takvim.gunSaat = 24;
dateDom.window.tarihSeridi();
assert.match(dateDom.window.document.querySelector('#siraTarih').textContent, /3 Test Ayı 1/, 'the displayed day follows the configured planetary day length');
dateDom.window.close();

// Onboarding remains inline and provides an explicit skip button in the real DOM.
const welcomeDom = new JSDOM('<!doctype html><html><body><button data-evren-git="harita:tomye">24. Evreni keşfet</button><details><div id="baslangicAlan"></div></details></body></html>', { runScripts: 'outside-only' });
welcomeDom.window.ONBOARD = 'tentiforapp_64_onboarding';
welcomeDom.window.read = () => ({});
welcomeDom.window.esc = (value) => String(value ?? '');
const welcomeStart = welcomeSource.indexOf('  function onboarding()');
const welcomeEnd = welcomeSource.indexOf('  function personalArchive()', welcomeStart);
assert.ok(welcomeStart >= 0 && welcomeEnd > welcomeStart);
welcomeDom.window.eval(welcomeSource.slice(welcomeStart, welcomeEnd));
welcomeDom.window.onboarding();
const skip = welcomeDom.window.document.querySelector('[data-tf64-onboard-close][aria-label="Rehberi atla"]');
assert.ok(skip);
assert.equal(skip.textContent, 'Atla');
assert.equal(skip.tagName, 'BUTTON');
assert.equal(skip.closest('[role="dialog"]'), null, 'the first-visit guide does not cover the primary CTA as a modal');
assert.equal(welcomeDom.window.document.querySelector('[data-evren-git="harita:tomye"]').closest('.tf64-onboarding'), null);
welcomeDom.window.close();

// npm test runs with the local server; this catches deploy-style clean-path 404 regressions.
const response = await fetch('http://127.0.0.1:3000/harita/');
assert.equal(response.status, 200, '/harita/ is served by the app fallback');
assert.match(await response.text(), /<main\s+id="tepe"/);
const queryResponse = await fetch('http://127.0.0.1:3000/harita/?harita=ax24');
assert.equal(queryResponse.status, 200, 'direct clean map URL with selection query is served');
assert.match(await queryResponse.text(), /<main\s+id="tepe"/);

console.log('map route UX: PASS (clean/hash paths, map-only public access, breadcrumb state, date fallback, inline keyboard skip, HTTP rewrite)');
