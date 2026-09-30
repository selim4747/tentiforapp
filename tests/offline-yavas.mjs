import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { setTimeout as sleep } from 'node:timers/promises';

const swSource = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8')
  .replace('const AG_BEKLEME = 3500;', 'const AG_BEKLEME = 35;')
  .replace('const AG_BEKLEME_YAVAS = 800;', 'const AG_BEKLEME_YAVAS = 10;')
  .replace('const AG_ISTEK_ZAMAN_ASIMI = 8000;', 'const AG_ISTEK_ZAMAN_ASIMI = 45;');

class FakeCache {
  constructor() { this.items = new Map(); this.failAdds = new Set(); }
  async add(url) {
    if (this.failAdds.has(url)) throw new Error('simulated slow install resource');
    this.items.set(new URL(url, 'https://app.test/').href, new Response('cached:' + url));
  }
  async put(request, response) { this.items.set(new URL(request, 'https://app.test/').href, response); }
  async match(request) { return this.items.get(new URL(request.url || request, 'https://app.test/').href) || undefined; }
}

async function makeHarness(fetchImpl) {
  const handlers = {};
  const cache = new FakeCache();
  const cachesApi = {
    open: async () => cache,
    keys: async () => ['tentiforapp-old'],
    delete: async () => true,
    match: (request) => cache.match(request)
  };
  const self = {
    location: { origin: 'https://app.test' },
    registration: { showNotification: async () => {} },
    addEventListener: (name, fn) => { handlers[name] = fn; },
    skipWaiting: async () => { self.skipped = true; },
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} }
  };
  const context = vm.createContext({
    self, location: self.location, caches: cachesApi, fetch: fetchImpl, URL, Request, Response,
    AbortController, setTimeout, clearTimeout, Promise, console,
    Date, Object, String, Number, Array, JSON, Math
  });
  vm.runInContext(swSource, context);
  return { handlers, cache, self };
}

function request(url, mode = 'same-origin') {
  return { url, mode, method: 'GET' };
}

async function eventResponse(handler, request) {
  let responsePromise;
  const event = {
    request,
    respondWith: (p) => { responsePromise = Promise.resolve(p); },
    waitUntil: () => {}
  };
  handler(event);
  assert.ok(responsePromise, 'fetch event must call respondWith');
  return responsePromise;
}

// 1. A single failed/slow precache resource must not abort SW installation.
{
  const h = await makeHarness(async () => new Response('network'));
  h.cache.failAdds.add('veri.json');
  let installPromise;
  h.handlers.install({ waitUntil: (p) => { installPromise = p; } });
  await installPromise;
  assert.equal(h.self.skipped, true);
  assert.equal(h.cache.items.has('https://app.test/index.html'), true);
}

// 2. A cached navigation must return immediately even if the network hangs forever.
{
  const h = await makeHarness(() => new Promise(() => {}));
  await h.cache.put('https://app.test/', new Response('offline shell'));
  const started = Date.now();
  const response = await eventResponse(h.handlers.fetch, request('https://app.test/', 'navigate'));
  assert.equal(await response.text(), 'offline shell');
  assert.ok(Date.now() - started < 25, 'cached navigation must not wait for slow network');
}

// 3. A first open without a cache must return a bounded offline response, not hang forever.
{
  const h = await makeHarness(() => new Promise(() => {}));
  const started = Date.now();
  const response = await eventResponse(h.handlers.fetch, request('https://app.test/new/', 'navigate'));
  assert.equal(response.status, 504);
  assert.ok(Date.now() - started < 150, 'uncached slow navigation must have a bounded response');
}

// 4. A slow but successful network response wins before the fallback deadline.
{
  const h = await makeHarness(async () => { await sleep(8); return new Response('fresh'); });
  const response = await eventResponse(h.handlers.fetch, request('https://app.test/fresh/', 'navigate'));
  assert.equal(await response.text(), 'fresh');
}

// 5. The source must retain APK metadata locally and use a bounded request timeout.
{
  const mobil = fs.readFileSync(new URL('../js/core/42-mobil.js', import.meta.url), 'utf8');
  assert.match(mobil, /tf4_apk_bilgi/);
  assert.match(mobil, /metadata-timeout/);
  assert.match(mobil, /localStorage\.setItem\(k/);
  const state = fs.readFileSync(new URL('../js/core/state.js', import.meta.url), 'utf8');
  assert.match(state, /Promise\.race\(\[hesapIstemci\.rpc\("bildirimlerim"/);
  assert.match(state, /bildirim-zaman-asimi/);
}

console.log('PASS install tolerates partial precache');
console.log('PASS cached navigation is instant during a hanging network');
console.log('PASS uncached slow navigation has a bounded offline response');
console.log('PASS slow successful network response is accepted');
console.log('PASS APK metadata and notification RPC paths are timeout/cache hardened');
console.log('5.0.3 offline and slow-network regression tests: PASS');
