import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync('js/arayuz/32-ux-642.js', 'utf8');
const data = {
  fanEserleri: { evrenler: [{ tur: 'evren', id: 'safe-world', kanon: true, ad: 'Safe World', ozet: 'Public evren' }] },
  kanonEvrenleri: {},
  karakterler: [{ id: 'ada', ad: 'Ada', unvan: 'Arşivci', ozet: 'Karakter sonucu' }],
  mektuplar: [{ id: 'm1', kimden: 'Ada', kime: 'Lio', metin: 'Belge sonucu' }],
  sozluk: [{ terim: 'Sözlük terimi', tanim: 'Tanım sonucu' }],
  profiller: [{ id: 'p1', ad: 'Public profil', selamlama: 'Profil sonucu' }]
};
function boot(storage) {
  const dom = new JSDOM('<!doctype html><html><body><header class="ust"></header></body></html>', {
    url: 'https://tentifor.com/', runScripts: 'outside-only'
  });
  const { window } = dom;
  window.veri = data;
  window.localStorage.setItem('tentiforapp_642', storage);
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
  window.eval(source);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return window;
}

const malformed = boot(JSON.stringify({ collection: 'not-an-array' }));
malformed.document.querySelector('.tf642-trigger').click();
assert.ok(malformed.document.querySelectorAll('[data-tf642-panel] .tf642-card').length > 0, 'bozuk koleksiyon verisi paneli kırmamalı');

const window = boot(JSON.stringify({ collection: [] }));
window.document.querySelector('.tf642-trigger').click();
const panel = window.document.querySelector('[data-tf642-panel]');
const search = panel.querySelector('[data-tf642-search]');
function searchFor(value) {
  search.value = value;
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  return panel.querySelector('[data-tf642-results]').textContent;
}
assert.match(searchFor('Ada'), /Karakter sonucu/);
assert.match(searchFor('Belge sonucu'), /Belge/);
assert.match(searchFor('Sözlük terimi'), /Sözlük/);
assert.match(searchFor('Public profil'), /Public profil/);
console.log('6.4.2.1 UX fixes: PASS (malformed local state and expanded content search)');
