import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { setTimeout as delay } from 'node:timers/promises';

const source = fs.readFileSync(path.join(process.cwd(), 'js/core/125-live-site-bootstrap.js'), 'utf8');

class FakeStorage {
  constructor(seed = {}) { this.data = new Map(Object.entries(seed)); }
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.has(String(key)) ? this.data.get(String(key)) : null; }
  setItem(key, value) { this.data.set(String(key), String(value)); }
  removeItem(key) { this.data.delete(String(key)); }
  clear() { this.data.clear(); }
}

async function boot(persisted, storage) {
  const saved = [];
  const listeners = {};
  const location = { href: 'https://localhost/harita/', hostname: 'localhost', search: '', pathname: '/harita/', hash: '', replace() {} };
  const plugin = {
    loadAppState: async () => ({ value: JSON.stringify(persisted) }),
    saveAppState: async ({ value }) => saved.push(JSON.parse(value)),
    loadBridge: async () => ({ value: '' }),
    saveBridge: async () => {}
  };
  const root = {
    location,
    localStorage: storage,
    Storage: FakeStorage,
    navigator: { onLine: false },
    Capacitor: { isNativePlatform: () => true, Plugins: { TentiforNative: plugin } },
    document: { activeElement: null, querySelector: () => null, addEventListener() {} },
    addEventListener(type, fn) { listeners[type] = fn; },
    dispatchEvent() {},
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    CustomEvent,
    Image: class {}
  };
  vm.runInNewContext(source, { window: root, URL, URLSearchParams, TextEncoder, TextDecoder, CustomEvent, setTimeout, clearTimeout, Date });
  await delay(320);
  return { storage, saved, listeners };
}

const owner = 'owner-account-42';
const largeUniverse = 'x'.repeat(250_000);
const persisted = {
  v: 1,
  keys: {
    'sb-tentiforapp-oturum': JSON.stringify({ access_token: 'access', refresh_token: 'refresh', user: { id: owner } }),
    tentiforapp_fan_eserlerim: JSON.stringify([{ id: 'world-owned-by-42', sahibi: owner, ad: 'Kayıp Kıta', veri: largeUniverse }]),
    tf65_evren_taslak_bekleyen: JSON.stringify([{ id: 'draft-1', owner, type: 'evren-taslak', payload: { p_evren_id: 'world-owned-by-42' } }])
  }
};

const restored = await boot(persisted, new FakeStorage());
assert.equal(JSON.parse(restored.storage.getItem('sb-tentiforapp-oturum')).user.id, owner, 'hesap oturumu geri yüklenmeli');
assert.equal(JSON.parse(restored.storage.getItem('tentiforapp_fan_eserlerim'))[0].sahibi, owner, 'evren sahibi korunmalı');
assert.equal(JSON.parse(restored.storage.getItem('tentiforapp_fan_eserlerim'))[0].veri.length, largeUniverse.length, 'büyük evren verisi korunmalı');
assert.equal(JSON.parse(restored.storage.getItem('tf65_evren_taslak_bekleyen'))[0].owner, owner, 'çevrimdışı taslak hesabına bağlı kalmalı');
assert.ok(restored.saved.length >= 1, 'geri yüklenen durum yeniden kalıcı dosyaya yazılmalı');

restored.storage.setItem('tf65_evren_taslak_bekleyen', JSON.stringify([{ owner, id: 'new-draft' }]));
await delay(320);
assert.equal(JSON.parse(restored.saved.at(-1).keys.tf65_evren_taslak_bekleyen)[0].owner, owner, 'yeni çevrimdışı kayıt dosyaya yazılmalı');

console.log('Native durable state feature test: PASS (cache-clear restore, account identity, large universe ownership and offline draft persistence)');
