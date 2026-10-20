/* 5.4.2 — düşük trafikli istemci offline queue */
(function () {
  'use strict';
  var ANAHTAR = 'tf4_offline_queue_v1';
  var MAX = 100;
  var durum = { calisiyor: false };
  function listeyiBirlestir(ilkIds, kalan) {
    var anlik = oku(), sonuc = [], gorulen = {};
    anlik.forEach(function (kayit) {
      if (!ilkIds[kayit.id] && !gorulen[kayit.id]) { sonuc.push(kayit); gorulen[kayit.id] = true; }
    });
    kalan.forEach(function (kayit) {
      if (!gorulen[kayit.id]) { sonuc.push(kayit); gorulen[kayit.id] = true; }
    });
    return sonuc;
  }
  function oku() {
    try {
      var deger = JSON.parse(localStorage.getItem(ANAHTAR) || '[]');
      return Array.isArray(deger) ? deger : [];
    } catch (_) { return []; }
  }
  function yaz(liste) {
    try {
      if (liste.length > MAX) {
        window.dispatchEvent(new CustomEvent('tf4-offline-queue-full', { detail: { dropped: liste.length - MAX } }));
      }
      localStorage.setItem(ANAHTAR, JSON.stringify(liste.slice(-MAX)));
      try { window.dispatchEvent(new CustomEvent('tf4-offline-queue-change', { detail: { kalan: Math.min(liste.length, MAX) } })); } catch (_) {}
      return true;
    } catch (_) {
      window.dispatchEvent(new CustomEvent('tf4-offline-queue-storage-error'));
      return false;
    }
  }
  function sahipIdOku() {
    try {
      var id = window.hesapKullanici && window.hesapKullanici.id;
      return id == null || id === '' ? null : String(id);
    } catch (_) { return null; }
  }
  function kimlik() { return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function ekle(tur, veri) {
    if (!tur || !veri || typeof veri !== 'object') throw new TypeError('offline queue kaydı geçersiz');
    var liste = oku();
    var sahipId = sahipIdOku();
    var kayit = { id: kimlik(), sahipId: sahipId, tur: String(tur).slice(0, 80), veri: veri, deneme: 0, olusturuldu: Date.now(), sonraki: 0 };
    liste.push(kayit); yaz(liste); return kayit;
  }
  function bekleyen() { return oku(); }
  function temizle() { yaz([]); }
  function beklemeSuresi(deneme) { return Math.min(30 * 60 * 1000, 1000 * Math.pow(2, Math.max(0, deneme - 1))); }
  async function gonder(transport, secenek) {
    if (typeof transport !== 'function') throw new TypeError('transport function gerekli');
    if (durum.calisiyor) return { atlandi: true, kalan: oku().length };
    durum.calisiyor = true;
    var simdi = Date.now(), liste = oku(), kalan = [], ilkIds = {}, sonuc = { gonderildi: 0, bekledi: 0, basarisiz: 0, kaliciHata: 0 };
    liste.forEach(function (kayit) { ilkIds[kayit.id] = true; });
    try {
      for (var i = 0; i < liste.length; i += 1) {
        var kayit = liste[i];
        var mevcutSahip = sahipIdOku();
        var kayitSahibi = kayit.sahipId == null || kayit.sahipId === '' ? null : String(kayit.sahipId);
        if (kayitSahibi !== mevcutSahip) {
          kayit.durum = 'hesap-degisikligi';
          kalan.push(kayit); sonuc.bekledi += 1; continue;
        }
        if ((secenek && secenek.zorla) || !kayit.sonraki || kayit.sonraki <= simdi) {
          try {
            await transport(kayit);
            sonuc.gonderildi += 1;
          } catch (_) {
            kayit.deneme += 1;
            if (_.tfKalici) {
              kayit.durum = 'kalici-hata';
              kayit.hata = String(_.message || _).slice(0, 240);
              kayit.sonraki = Number.MAX_SAFE_INTEGER;
              sonuc.kaliciHata += 1;
            } else {
              kayit.sonraki = Date.now() + beklemeSuresi(kayit.deneme);
            }
            kalan.push(kayit); sonuc.basarisiz += 1;
          }
        } else { kalan.push(kayit); sonuc.bekledi += 1; }
      }
      /* RPC beklerken eklenen kayıtları silmemek için yalnızca ilk snapshot
         kayıtlarının ACK durumunu uygula; yeni kayıtları mevcut kuyruktan koru. */
      kalan = listeyiBirlestir(ilkIds, kalan);
      yaz(kalan);
      var tamamlanan = Object.assign(sonuc, { kalan: kalan.length });
      try { window.dispatchEvent(new CustomEvent('tf4-offline-sync-result', { detail: tamamlanan })); } catch (_) {}
      return tamamlanan;
    } finally { durum.calisiyor = false; }
  }
  function ayarla(transport) { if (transport != null && typeof transport !== 'function') throw new TypeError('transport function gerekli'); window.tf4OfflineTransport = transport || null; return !!window.tf4OfflineTransport; }
  window.tf4OfflineQueue = { ekle: ekle, bekleyen: bekleyen, temizle: temizle, gonder: gonder, ayarla: ayarla, beklemeSuresi: beklemeSuresi };
  window.addEventListener('online', function () {
    var transport = window.tf4OfflineTransport;
    if (typeof transport === 'function') setTimeout(function () { gonder(transport); }, 1200); else if (oku().length) window.dispatchEvent(new CustomEvent('tf4-offline-transport-yok', { detail: { kalan: oku().length } }));
  });
}());
