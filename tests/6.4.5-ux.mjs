import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(new URL('../js/arayuz/34-ux-645.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20261012_645_device_sessions.sql', import.meta.url), 'utf8');
assert.match(migration, /create table if not exists public\.hesap_cihazlari/);
assert.match(migration, /cihaz_heartbeat/);
assert.match(migration, /cihazlarim/);
assert.match(source, /cihaz_heartbeat/);
assert.match(source, /son 15 dakikadaki gerçek kalp atışlarından/);

const dom = new JSDOM('<!doctype html><body><main><div id="evrenSayfa"><div class="evs-roman"><p>Uzun okuma</p></div><div id="tf644ReadingToolbar"></div></div><details class="kutu-y cihazlarim"></details></main></body>', {
  url: 'https://tentifor.com/#/ev/fan/demo', runScripts: 'outside-only', pretendToBeVisual: true
});
const { window } = dom;
window.hesapKullanici = { id: 'user-1' };
window.hesapIstemci = { rpc: async (name) => name === 'cihaz_heartbeat' ? { data: { durum: 'tamam', aktif: 2 }, error: null } : { data: { aktif: 2, cihazlar: [{ ad: 'Android · Chrome', son_gorulme: '2026-10-11T21:00:00Z', bu_mu: true }] }, error: null } };
window.eval(source);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
await new Promise((resolve) => setTimeout(resolve, 100));
assert.ok(window.document.querySelector('[data-tf645-share-reading]'));
await new Promise((resolve) => setTimeout(resolve, 100));
assert.match(window.document.querySelector('.cihazlarim').textContent, /2 aktif/);
assert.match(window.document.querySelector('.cihazlarim').textContent, /Android/);
window.scrollTo(0, 20);
window.dispatchEvent(new window.Event('scroll'));
await new Promise((resolve) => setTimeout(resolve, 700));
assert.match(window.localStorage.getItem('tentiforapp_645_ux'), /"resume"/);
console.log('6.4.5 UX: PASS (okuma konumu, paylaşım kartı ve gerçek cihaz oturumu sayısı)');
window.close();
