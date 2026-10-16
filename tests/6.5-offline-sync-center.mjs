import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const queueSource = fs.readFileSync('js/core/93-offline-queue.js', 'utf8');
const centerSource = fs.readFileSync('js/core/v65-offline-sync-center.js', 'utf8');
const dom = new JSDOM('<!doctype html><html><body><header><button id="cuzdanRozet">cüzdan</button></header></body></html>', {
  url: 'https://tentifor.test/', runScripts: 'outside-only', pretendToBeVisual: true
});
const { window } = dom;
let queueEvents = 0;
window.addEventListener('tf4-offline-queue-change', () => { queueEvents += 1; });
window.eval(queueSource);
window.hesapKullanici = { id: 'hesap-b' };
window.tf4OfflineQueue.ekle('okuma-ilerleme', { gizliMetin: 'KULLANICI-VERİSİ-GİZLİ' });
window.hesapKullanici = { id: 'hesap-a' };
window.tf4OfflineQueue.ekle('ayar', { tema: 'gece' });
assert.equal(queueEvents, 2, 'kuyruk yazımı değişiklik olayı yayımlamalı');

let sent = 0;
window.tf4OfflineTransport = async () => { sent += 1; };
window.eval(centerSource);
window.tf65OfflineSyncCenter.refresh();
const syncButton = window.document.querySelector('#tf65SyncButton');
assert.ok(syncButton, 'başlıkta eşitleme merkezi düğmesi bulunmalı');
assert.equal(syncButton.querySelector('[data-tf65-sync-count]').textContent, '2');
syncButton.click();
const dialog = window.document.querySelector('[role="dialog"][aria-modal="true"]');
assert.ok(dialog, 'erişilebilir modal açılmalı');
assert.match(dialog.textContent, /Başka hesaba ait/);
assert.match(dialog.textContent, /Bu hesaba ait/);
assert.equal(dialog.textContent.includes('KULLANICI-VERİSİ-GİZLİ'), false, 'işlem payload içeriği ekranda açığa çıkmamalı');
assert.equal(window.document.querySelector('[data-tf65-sync-retry]').disabled, false);

await window.tf65OfflineSyncCenter.retry();
assert.equal(sent, 1, 'yalnızca oturum hesabına ait kayıt gönderilmeli');
assert.equal(window.tf4OfflineQueue.bekleyen().length, 1, 'başka hesaba ait kayıt yerel kuyrukta kalmalı');
assert.equal(window.tf4OfflineQueue.bekleyen()[0].sahipId, 'hesap-b');
assert.match(window.document.querySelector('[role="dialog"]').textContent, /1 gönderildi/);
assert.ok(window.localStorage.getItem('tf65_offline_sync_last_success'));
window.close();
console.log('6.5 offline sync center tests passed');
