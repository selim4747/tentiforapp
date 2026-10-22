import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const raceSource = read('js/oyun/30-yarislar.js');
const dataSource = read('js/core/24-arsiv-mantigi.js');
const mapSource = read('js/arsiv/09-medya-harita.js');
const routeBundle = read('js/paket-1.js');
const index = read('index.html');
const start = raceSource.indexOf('async function kulupSavasiCiz(');
const end = raceSource.indexOf('function kesifKaydet(', start);
assert.ok(start >= 0 && end > start, 'club-war renderer must remain independently testable');
const renderer = raceSource.slice(start, end);

function harness({ fail = false } = {}) {
  const listeners = new Map();
  const element = { dataset: {}, innerHTML: '', isConnected: true };
  const errors = [];
  let requests = 0;
  let personalityReads = 0;
  const context = vm.createContext({
    document: {
      querySelector: () => element,
      addEventListener(name, callback, options) { listeners.set(name, { callback, once: options?.once }); },
      removeEventListener(name) { listeners.delete(name); }
    },
    console: { error: (...args) => errors.push(args) },
    yarisHazirMi: () => true,
    veri: null,
    liderlikPano: async () => { requests += 1; if (fail) throw new Error('offline fixture'); return []; },
    arsivciKisilik: () => { personalityReads += 1; return { ad: 'Test kulübü' }; },
    kacir: (value) => String(value ?? '')
  });
  vm.runInContext(`${renderer}\nglobalThis.__kulupSavasiCiz = kulupSavasiCiz;`, context, { filename: '30-yarislar.js' });
  return { context, element, listeners, errors, get requests() { return requests; }, get personalityReads() { return personalityReads; } };
}

const delayed = harness();
await delayed.context.__kulupSavasiCiz();
await delayed.context.__kulupSavasiCiz();
assert.equal(delayed.requests, 0, 'leaderboard must not start while app data is still null');
assert.equal(delayed.listeners.size, 1, 'only one readiness callback should be registered');
assert.match(delayed.element.innerHTML, /yükleniyor/);
delayed.context.veri = { katmanlar: [], galeri: [] };
const ready = delayed.listeners.get('tf-veri-hazir');
assert.equal(ready?.once, true, 'readiness callback must be one-shot');
await ready.callback();
assert.equal(delayed.requests, 1, 'leaderboard starts once data is ready');
assert.equal(delayed.personalityReads, 1, 'personality calculation only runs after data readiness');
assert.match(delayed.element.innerHTML, /Test kulübü/);

const failedRequest = harness({ fail: true });
failedRequest.context.veri = { katmanlar: [], galeri: [] };
await assert.doesNotReject(() => failedRequest.context.__kulupSavasiCiz());
assert.equal(failedRequest.errors.length, 1, 'failed leaderboard is recorded for diagnostics');
assert.match(failedRequest.element.innerHTML, /Sıralama şu anda yüklenemedi/);

const removed = harness();
await removed.context.__kulupSavasiCiz();
removed.context.veri = { katmanlar: [], galeri: [] };
removed.element.isConnected = false;
await removed.listeners.get('tf-veri-hazir').callback();
assert.equal(removed.requests, 0, 'detached placeholder must not issue a leaderboard request');

const mapStart = mapSource.indexOf('let haritaURLVeriBekliyor=false;function haritaURLSeciminiYukle()');
const mapEnd = mapSource.indexOf('function haritaYerDurumu(', mapStart);
assert.ok(mapStart >= 0 && mapEnd > mapStart, 'map URL hydration must remain independently testable');
const mapListeners = new Map();
const mapContext = vm.createContext({
  URLSearchParams,
  location: { search: '' },
  document: { addEventListener(name, callback, options) { mapListeners.set(name, { callback, once: options?.once }); } },
  window: { addEventListener() {} },
  veri: null,
  haritaSeciliId: null,
  haritaSecili: null,
  haritaEvrenGorunur: () => true,
  rota: () => '#/harita',
  setTimeout: (callback) => callback(),
  haritaCiz() {},
  aktifBolumIsaretle() {}
});
vm.runInContext(`${mapSource.slice(mapStart, mapEnd)}\nglobalThis.__haritaURLSeciminiYukle = haritaURLSeciminiYukle;`, mapContext, { filename: '09-medya-harita.js' });
assert.doesNotThrow(() => mapContext.__haritaURLSeciminiYukle());
assert.equal(mapListeners.size, 1, 'map popstate hydration registers one data-ready callback');
mapContext.veri = { haritalar: [] };
await mapListeners.get('tf-veri-hazir').callback();
assert.equal(mapContext.haritaSeciliId, 'tomye', 'map selection initializes after archive data is ready');
assert.match(routeBundle, /let haritaURLVeriBekliyor=false;function haritaURLSeciminiYukle\(\)\{if\(typeof veri==="undefined"\|\|!veri\)/);

assert.match(index, /__TF_APP_BOOT_TIMEOUT_MS/);
assert.match(index, /id="tfAppBootStatus"[^>]*role="alert"/);
assert.match(dataSource, /window\.tf4AppBootResult\(a\.length/);
assert.match(dataSource, /İçerik verisi yüklenemedi/);
assert.match(dataSource, /const n=\$\("#karakterIzgara"\);n&&/);

console.log('Startup/readiness regressions: PASS (deferred club/map rendering, single readiness callbacks, detached placeholders, visible failures and boot timeout)');
