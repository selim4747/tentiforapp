import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const arsiv = fs.readFileSync('js/core/24-arsiv-mantigi.js', 'utf8');
const e25 = fs.readFileSync('js/engine/44-evrenler.js', 'utf8');
const stil = fs.readFileSync('css/style.css', 'utf8');
assert(arsiv.includes('function karakterGorselKaynak'), 'karakter görsel alanları ortak yardımcıdan okunmalı');
assert(arsiv.includes('karakterPortreHtml(i,"kart")'), 'ana karakter kartları portre göstermeli');
assert(arsiv.includes('karakterPortreHtml(i,"profil")'), 'karakter profilinde ortak portre bileşeni kullanılmalı');
assert(e25.includes('karakterPortreHtml(a,"kart")'), 'E25 karakter kartları portre göstermeli');
assert(stil.includes('object-position:50% 35%'), 'portre kadrajı tanımlı olmalı');
assert(stil.includes('karakter-portre-fallback'), 'eksik/hatalı portre için fallback tanımlı olmalı');

const bildirim = fs.readFileSync('js/engine/88-v46-yenilikler.js', 'utf8');
assert(!bildirim.includes('new Notification('), 'bildirim testi illegal Notification constructor kullanmamalı');
assert(bildirim.includes('showNotification('), 'bildirim testi ServiceWorkerRegistration.showNotification kullanmalı');
const guncellemeBildirimi = fs.readFileSync('js/core/46-guncelleme.js', 'utf8');
assert(!guncellemeBildirimi.includes('new Notification('), 'güncelleme bildirimi illegal Notification constructor kullanmamalı');
assert(guncellemeBildirimi.includes('showNotification('), 'güncelleme bildirimi ServiceWorkerRegistration.showNotification kullanmalı');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://tentiforapp.pages.dev/', runScripts: 'outside-only' });
const { window } = dom;
window.TF4 = { uyelik: { tip: 'evrengezer' } };
window.tf4UyelikDongu = () => 'd30-0';
window.fanEserlerim = () => [
  { id: 'eski-evren', tur: 'evren' },
  { id: 'eski-hikaye', tur: 'hikaye' }
];
window.localStorage.setItem('tf4_uyelik_kullanimi', JSON.stringify({
  'd30-0': { evren: 0, gezgin: 0, hikaye: 0 }
}));
window.eval(fs.readFileSync('js/engine/92-v51-dashboard.js', 'utf8'));
const kullan = window.TF51.usage();
assert.equal(JSON.stringify(kullan), JSON.stringify({ evren: 0, gezgin: 0, hikaye: 0 }), 'ücretli planda sıfır aylık sayaç eski toplam içeriğe düşmemeli');

dom.window.close();
console.log('5.3 regressions: PASS (Service Worker notification + paid-plan zero counters)');
