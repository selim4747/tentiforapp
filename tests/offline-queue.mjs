import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/core/93-offline-queue.js', 'utf8');
const store = new Map();
const handlers = {};
const window = {
  addEventListener(name, fn) { handlers[name] = fn; },
  setTimeout
};
const context = vm.createContext({
  window,
  localStorage: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key)
  },
  Date, Math, JSON, String, Number, Array, TypeError, setTimeout, Promise
});
vm.runInContext(source, context);
const queue = window.tf4OfflineQueue;
assert.ok(queue);
assert.equal(queue.bekleyen().length, 0);
const first = queue.ekle('okuma-ilerleme', { evren: 'e25', bolum: '1' });
const second = queue.ekle('ayar', { tema: 'gece' });
assert.equal(queue.bekleyen().length, 2);
let delivered = [];
const result = await queue.gonder(async (item) => { delivered.push(item.tur); });
assert.equal(result.gonderildi, 2);
assert.deepEqual(delivered, ['okuma-ilerleme', 'ayar']);
assert.equal(queue.bekleyen().length, 0);

queue.ekle('retry', { n: 1 });
const failed = await queue.gonder(async () => { throw new Error('mock network'); });
assert.equal(failed.basarisiz, 1);
assert.equal(queue.bekleyen()[0].deneme, 1);
assert.ok(queue.bekleyen()[0].sonraki > Date.now());
const skipped = await queue.gonder(async () => { throw new Error('must not run'); });
assert.equal(skipped.bekledi, 1);
assert.equal(queue.bekleyen().length, 1);
assert.equal(first.id.startsWith('q_'), true);
assert.equal(second.id.startsWith('q_'), true);
assert.equal(typeof handlers.online, 'function');
queue.temizle();
console.log('Offline queue local persistence, retry/backoff and online hook: PASS');
