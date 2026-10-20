/* 6.2.10 — authenticated, idempotent offline transport. */
(function () {
  'use strict';
  function zamanAsimli(promise, ms, controller) {
    var timer;
    var timeout = new Promise(function (_, reject) { timer = setTimeout(function () {
      if (controller) controller.abort();
      var hata = new Error('offline RPC zaman aşımına uğradı');
      hata.tfZamanAsimi = true;
      reject(hata);
    }, ms); });
    return Promise.race([promise, timeout]).finally(function () { clearTimeout(timer); });
  }
  function kaliciHataMi(hata) {
    var status = Number(hata && (hata.status || hata.code));
    return status >= 400 && status < 500 && status !== 408 && status !== 409 && status !== 429;
  }
  function kurul() {
    if (!window.tf4OfflineQueue || typeof window.tf4OfflineQueue.ayarla !== 'function') return;
    window.tf4OfflineQueue.ayarla(async function (item) {
      if (typeof window.tf4Istemci !== 'function') throw new Error('offline istemci hazır değil');
      var client = await window.tf4Istemci();
      if (!client || !client.rpc) throw new Error('offline RPC hazır değil');
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var rpc = client.rpc('offline_islem_kaydet', {
        p_istemci_id: item.id,
        p_tur: item.tur,
        p_veri: item.veri
      }, controller ? { signal: controller.signal } : undefined);
      var result;
      try { result = await zamanAsimli(rpc, 15000, controller); }
      catch (hata) { if (kaliciHataMi(hata)) hata.tfKalici = true; throw hata; }
      if (result && result.error) { var rpcHata = result.error; if (kaliciHataMi(rpcHata)) rpcHata.tfKalici = true; throw rpcHata; }
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
