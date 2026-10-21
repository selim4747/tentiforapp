import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const read = (file) => fs.readFileSync(file, 'utf8');
const routeSource = read('js/core/00-rota.js');
const seoSource = read('js/engine/seo-meta.js');
const selectorSource = read('js/engine/44-evrenler.js');
const multiUniverseSource = read('js/engine/68-coklu-evren.js');
const selectorBundle = read('js/paket-2.js');
const multiUniverseBundle = read('js/paket-3.js');
const styleSource = read('css/style.css');
const indexSource = read('index.html');
const navigationSource = read('js/arayuz/18-gezinme.js');
const routeNavigationSource = read('js/engine/44-evrenler.js');
const mapSource = read('js/paket-1.js');
const baseHtml = '<!doctype html><html><head><meta name="robots" content="index, follow"></head><body><button id="evrenSecBtn">Evren seç</button><main id="tepe"><section id="evrenSayfa"><div class="evs-govde"></div></section></main></body></html>';

function routeWindow(registry = { fanEserleri: { evrenler: [] } }) {
  const dom = new JSDOM(baseHtml, { url: 'https://tentifor.com/', runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.veri = registry;
  dom.window.eval(routeSource);
  return dom;
}

assert.match(indexSource, /data-evren-git="harita:tomye"/);
assert.match(indexSource, />Tömye haritasını keşfet</);
assert.match(indexSource, /href="#\/tomye">Tömye arşivi</);
assert.match(routeNavigationSource, /function evrenGit\(e\)/);
assert.match(routeNavigationSource, /e\.indexOf\("harita:"\)===0/);
assert.match(mapSource, /data-harita-sec/);
assert.match(navigationSource, /Tentiforverse · 24\. Evren ·/);
assert.match(navigationSource, /Tömye · Arşiv/);
assert.match(navigationSource, /Ax-24/);
assert.match(navigationSource, /E25 · kanon evren/);
assert.match(navigationSource, /E26 · kanon evren/);

const mapNavigation = new JSDOM(baseHtml, { url: 'https://tentifor.com/', runScripts: 'outside-only', pretendToBeVisual: true });
mapNavigation.window.CSS = { escape: (value) => String(value) };
mapNavigation.window.veri = { haritalar: [
  { id: 'tomye', ad: 'Tömye', evrenAdi: 'Tentiforverse' },
  { id: 'ax24', ad: 'Ax-24', ustEvren: 'tomye' }
] };
mapNavigation.window.rota = () => mapNavigation.window.location.hash || '#/';
mapNavigation.window.aktifEvrenSec = () => {};
mapNavigation.window.evrenSeciciKapat = () => {};
mapNavigation.window.haritaDurumUrlGuncelle = (id) => {
  const url = new URL(mapNavigation.window.location.href);
  url.searchParams.set('harita', id);
  mapNavigation.window.history.replaceState({}, '', url.pathname + url.search + url.hash);
};
let mapDraws = 0;
mapNavigation.window.haritaCiz = () => { mapDraws += 1; };
mapNavigation.window.haritaBolumuOdakla = () => {};
mapNavigation.window.aktifBolumIsaretle = () => {};
const mapNavigationStart = selectorSource.indexOf('function evrenGit(e){');
const mapNavigationEnd = selectorSource.indexOf('function evrenDugmesiKur()', mapNavigationStart);
assert.ok(mapNavigationStart >= 0 && mapNavigationEnd > mapNavigationStart, 'universe navigation handler exists');
mapNavigation.window.eval(selectorSource.slice(mapNavigationStart, mapNavigationEnd));
mapNavigation.window.evrenGit('harita:tomye');
assert.equal(mapNavigation.window.location.hash, '#/harita');
assert.equal(mapNavigation.window.location.search, '?harita=tomye');
await new Promise((resolve) => setTimeout(resolve, 140));
assert.ok(mapDraws > 0, 'Tömye map is redrawn after its navigation completes');
const currentResolverStart = multiUniverseSource.indexOf('function simdikiEvren(){');
const currentResolverEnd = multiUniverseSource.indexOf('function baslangicEvrenAdi()', currentResolverStart);
mapNavigation.window.eval(multiUniverseSource.slice(currentResolverStart, currentResolverEnd));
assert.deepEqual(
  { ...mapNavigation.window.simdikiEvren() },
  { ad: 'Tömye', git: 'harita:tomye' },
  'navigation from the 24th-universe hero must remain selected in the universe menu'
);
mapNavigation.window.close();

const activeUniverseStart = multiUniverseSource.indexOf('function simdikiEvren(){');
const activeUniverseEnd = multiUniverseSource.indexOf('function baslangicEvrenAdi()', activeUniverseStart);
assert.ok(activeUniverseStart >= 0 && activeUniverseEnd > activeUniverseStart, 'active universe resolver exists');
const mapSelection = new JSDOM(baseHtml, { url: 'https://tentifor.com/harita/?harita=tomye', runScripts: 'outside-only' });
mapSelection.window.veri = { haritalar: [
  { id: 'tomye', ad: 'Tömye', evrenAdi: 'Tentiforverse' },
  { id: 'ax24', ad: 'Ax-24', ustEvren: 'tomye' }
] };
mapSelection.window.rota = () => '#/harita';
mapSelection.window.eval(multiUniverseSource.slice(activeUniverseStart, activeUniverseEnd));
assert.deepEqual(
  { ...mapSelection.window.simdikiEvren() },
  { ad: 'Tömye', git: 'harita:tomye' },
  'Tömye map route must be active in the universe selector'
);
mapSelection.window.history.replaceState(null, '', '/harita/?harita=ax24');
assert.deepEqual(
  { ...mapSelection.window.simdikiEvren() },
  { ad: 'Ax-24', git: 'harita:ax24' },
  'Ax-24 map route must be active in the universe selector'
);
mapSelection.window.close();

const privateRoute = routeWindow();
privateRoute.window.location.hash = '#/ev/benim/my-world-1';
privateRoute.window.rotaYolaCevir();
assert.equal(privateRoute.window.location.pathname, '/', 'private universe navigation remains on the app shell');
assert.equal(privateRoute.window.location.hash, '#/ev/benim/my-world-1');
assert.equal(privateRoute.window.rota(), '#/ev/benim/my-world-1');
assert.equal(privateRoute.window.rotaAdresi('#/ev/benim/my-world-1'), 'https://tentifor.com/#/ev/benim/my-world-1');
privateRoute.window.rotaRobotlar();
assert.equal(privateRoute.window.document.querySelector('meta[name="robots"]').content, 'noindex, follow');
privateRoute.window.location.hash = '#/ev/acilan/file-1';
privateRoute.window.rotaYolaCevir();
assert.equal(privateRoute.window.location.pathname, '/', 'opened local universe files also stay on the app shell');
privateRoute.window.close();

const sampleRegistry = { fanEserleri: { evrenler: [{ id: 'fornek-kul', tur: 'evren', ad: 'Kül Ormanı', test: true, ozet: 'Örnek dünya' }] } };
const sampleRoute = routeWindow(sampleRegistry);
sampleRoute.window.location.hash = '#/ev/fan/fornek-kul';
sampleRoute.window.rotaYolaCevir();
assert.equal(sampleRoute.window.location.pathname, '/', 'test fixtures remain reloadable through the app shell');
assert.equal(sampleRoute.window.rota(), '#/ev/fan/fornek-kul');
sampleRoute.window.rotaRobotlar();
assert.equal(sampleRoute.window.document.querySelector('meta[name="robots"]').content, 'noindex, follow');
let seoFetches = 0;
sampleRoute.window.fetch = () => { seoFetches += 1; return Promise.reject(new Error('unexpected public lookup')); };
sampleRoute.window.eval(seoSource);
sampleRoute.window.dispatchEvent(new sampleRoute.window.HashChangeEvent('hashchange'));
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(sampleRoute.window.document.title, 'Kül Ormanı · Örnek evren — TentiFor');
assert.equal(sampleRoute.window.document.querySelector('meta[name="robots"]').content, 'noindex, follow');
assert.equal(seoFetches, 0, 'local test fixtures must not be sent to the public SEO lookup');
sampleRoute.window.close();

const publicRoute = routeWindow();
publicRoute.window.location.hash = '#/evren/e126';
publicRoute.window.rotaYolaCevir();
assert.equal(publicRoute.window.location.pathname, '/', 'the E126 app route remains a hash route during client navigation');
assert.equal(publicRoute.window.rota(), '#/evren/e126', 'client navigation uses the exact supported E126 route');
publicRoute.window.close();

const modal = new JSDOM(baseHtml, { url: 'https://tentifor.com/', runScripts: 'outside-only', pretendToBeVisual: true });
modal.window.simdikiEvren = () => ({ git: '#/ev/benim/my-world-1', ad: 'Benim Evrenim' });
modal.window.evrenSeciciListesi = () => ({
  site: [{ ad: 'E25', git: '#/ev/site/e25' }],
  benim: [{ ad: 'Benim Evrenim', git: '#/ev/benim/my-world-1', not: 'Senin evrenin' }],
  fan: [],
  acilan: []
});
modal.window.kacir = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
modal.window.evrenSeciciZenginlestir = () => {};
const selectorStart = selectorSource.indexOf('function evrenSeciciAc(){');
const selectorEnd = selectorSource.indexOf('function evrenSeciciKapat()', selectorStart);
const closeEnd = selectorSource.indexOf('function evrenDugmesiKur()', selectorEnd);
assert.ok(selectorStart >= 0 && selectorEnd > selectorStart && closeEnd > selectorEnd, 'selector open/close functions exist');
modal.window.eval(selectorSource.slice(selectorStart, closeEnd));
modal.window.evrenSeciciAc();
const current = modal.window.document.querySelector('[data-evren-git="#/ev/benim/my-world-1"]');
assert.ok(current, 'personal universe is listed');
assert.equal(current.getAttribute('aria-current'), 'true');
assert.match(current.getAttribute('aria-label'), /şu anki evren/i);
assert.match(current.textContent, /Şu an/);
assert.equal(modal.window.document.querySelector('#evrenSecici .es-panel').getAttribute('aria-modal'), 'true');
assert.match(modal.window.document.querySelectorAll('.es-grup .oyun-etiket')[1].textContent, /· 1$/, 'personal universe count is shown');
const filterStart = multiUniverseSource.indexOf('function evrenSeciciSuz(');
const filterEnd = multiUniverseSource.indexOf('function evrenSeritHtml()', filterStart);
assert.ok(filterStart >= 0 && filterEnd > filterStart, 'selector filter exists');
modal.window.eval(multiUniverseSource.slice(filterStart, filterEnd));
modal.window.evrenSeciciSuz('no-matching-universe');
assert.equal(modal.window.document.querySelector('.es-bulunamadi').hidden, false, 'empty search results are announced');
modal.window.evrenSeciciSuz('');
assert.equal(modal.window.document.querySelector('.es-bulunamadi').hidden, true, 'empty-results message clears with the search');
const keyboardStart = multiUniverseSource.indexOf('document.addEventListener("keydown",function(e){const n=document.querySelector("#evrenSecici")');
const keyboardEnd = multiUniverseSource.indexOf(',window.addEventListener("hashchange"', keyboardStart);
assert.ok(keyboardStart >= 0 && keyboardEnd > keyboardStart, 'selector keyboard handler exists');
modal.window.eval(multiUniverseSource.slice(keyboardStart, keyboardEnd));
const dialog = modal.window.document.querySelector('#evrenSecici');
const firstFocusable = dialog.querySelector('[data-es-kapat]');
const lastFocusable = dialog.querySelector('.es-yeni');
lastFocusable.focus();
lastFocusable.dispatchEvent(new modal.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
assert.equal(modal.window.document.activeElement, firstFocusable, 'Tab wraps to the first dialog control');
firstFocusable.focus();
firstFocusable.dispatchEvent(new modal.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
assert.equal(modal.window.document.activeElement, lastFocusable, 'Shift+Tab wraps to the last dialog control');
modal.window.evrenSeciciKapat();
assert.equal(modal.window.document.activeElement.id, 'evrenSecBtn', 'closing the selector restores focus to its trigger');
assert.match(styleSource, /\.es-oge\.es-etkin/);
assert.match(styleSource, /\.es-bulunamadi/);
assert.match(selectorBundle, /aria-current="true"/);
assert.match(selectorBundle, /es-etkin-etiket/);
assert.match(multiUniverseBundle, /Bu aramayla eşleşen evren bulunamadı/);
assert.match(multiUniverseBundle, /if\(e\.key==="Tab"\)/);
modal.window.close();

console.log('universe navigation UX: PASS (private/test hash routes, public clean routes, noindex, selector active state and focus return)');
