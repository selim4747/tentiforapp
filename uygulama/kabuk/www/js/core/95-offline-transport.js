/* 6.2.10 — authenticated, idempotent offline transport. */
(function () {
  'use strict';
  function kurul() {
    if (!window.tf4OfflineQueue || typeof window.tf4OfflineQueue.ayarla !== 'function') return;
    window.tf4OfflineQueue.ayarla(async function (item) {
      if (typeof window.tf4Istemci !== 'function') throw new Error('offline istemci hazır değil');
      var client = await window.tf4Istemci();
      if (!client || !client.rpc) throw new Error('offline RPC hazır değil');
      var result = await client.rpc('offline_islem_kaydet', {
        p_istemci_id: item.id,
        p_tur: item.tur,
        p_veri: item.veri
      });
      if (result && result.error) throw result.error;
      if (!result || !result.data || result.data.durum !== 'tamam') {
        throw new Error(result && result.data && result.data.durum || 'offline işlem reddedildi');
      }
      return result.data;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kurul, { once: true });
  else kurul();
  window.addEventListener('tf-hesap-hazir', kurul);
}());
