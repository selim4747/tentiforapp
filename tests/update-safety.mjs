import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/core/46-guncelleme.js', import.meta.url), 'utf8');

async function run({ online = true, updateFails = false, activate = true, editing = false } = {}) {
  let reloads = 0;
  let updates = 0;
  const stored = new Map();
  const listeners = new Map();
  let currentStatus = null;
  const button = { disabled: false, textContent: 'Yenile' };
  const banner = {
    querySelector(selector) {
      if (selector === '[data-guncelle-durum]') return currentStatus;
      if (selector === '[data-guncelle]') return button;
      return null;
    },
    appendChild(element) { currentStatus = element; }
  };
  const document = {
    activeElement: editing ? { tagName: 'INPUT', type: 'text', isContentEditable: false } : { tagName: 'BUTTON', type: 'button', isContentEditable: false },
    querySelector(selector) {
      if (selector === '#guncellemeCubugu') return banner;
      if (selector === '#guncellemeCubugu [data-guncelle]') return button;
      return null;
    },
    createElement() { return { setAttribute() {}, textContent: '' }; },
    addEventListener() {}
  };
  const waiting = {
    state: 'installed',
    postMessage() { if (activate) listeners.get('controllerchange')?.(); }
  };
  const registration = {
    waiting,
    installing: null,
    async update() { updates++; if (updateFails) throw new Error('offline'); }
  };
  const serviceWorker = {
    async getRegistration() { return registration; },
    addEventListener(name, callback) { listeners.set(name, callback); }
  };
  const context = vm.createContext({
    document,
    navigator: { onLine: online, serviceWorker },
    location: { reload() { reloads++; } },
    window: { addEventListener() {} },
    localStorage: { setItem(key, value) { stored.set(`local:${key}`, value); }, getItem() { return null; } },
    sessionStorage: { setItem(key, value) { stored.set(`session:${key}`, value); } },
    setTimeout(callback) { return setTimeout(callback, 1); },
    clearTimeout,
    Date,
    Promise
  });
  vm.runInContext(source, context, { filename: '46-guncelleme.js' });
  vm.runInContext('guncellemeYeni = { paket: "paket-test", surum: "6.6.2" }', context);
  await vm.runInContext('guncellemeUygula()', context);
  return { reloads, updates, stored, statusMessage: currentStatus?.textContent || '', button };
}

const success = await run();
assert.equal(success.reloads, 1, 'the user-confirmed successful update reloads only once');
assert.equal(success.updates, 1, 'the waiting worker is checked and activated');

const offline = await run({ online: false });
assert.equal(offline.reloads, 0, 'offline update leaves the current page running');
assert.match(offline.statusMessage, /Bağlantı yok/);

const failed = await run({ updateFails: true });
assert.equal(failed.reloads, 0, 'failed worker update does not reload');
assert.match(failed.statusMessage, /mevcut sürüm çalışmaya devam ediyor/);
assert.equal(failed.button.disabled, false, 'failed update remains retryable');

const unactivated = await run({ activate: false });
assert.equal(unactivated.reloads, 0, 'an unactivated waiting worker does not trigger a reload');
assert.match(unactivated.statusMessage, /mevcut sürüm çalışmaya devam ediyor/);

const editing = await run({ editing: true });
assert.equal(editing.reloads, 0, 'focused edits defer refresh');
assert.equal(editing.updates, 0, 'worker activation is not attempted during editing');
assert.match(editing.statusMessage, /Kaydedilmemiş düzenleme/);

console.log('Update safety regressions: PASS (confirmed single reload, offline/failure fallback, worker activation, edit protection)');
