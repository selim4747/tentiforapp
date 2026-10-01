/* 5.4.1 — düşük trafikli istemci offline queue */
(function () {
  'use strict';
  var ANAHTAR = 'tf4_offline_queue_v1';
  var MAX = 100;
  var durum = { calisiyor: false };
  function oku() {
    try {
      var deger = JSON.parse(localStorage.getItem(ANAHTAR) || '[]');
      return Array.isArray(deger) ? deger : [];
    } catch (_) { return []; }
  }
  function yaz(liste) {
    try { localStorage.setItem(ANAHTAR, JSON.stringify(liste.slice(-MAX))); } catch (_) {}
  }
  function kimlik() { return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function ekle(tur, veri) {
    if (!tur || !veri || typeof veri !== 'object') throw new TypeError('offline queue kaydı geçersiz');
    var liste = oku();
    var kayit = { id: kimlik(), tur: String(tur).slice(0, 80), veri: veri, deneme: 0, olusturuldu: Date.now(), sonraki: 0 };
    liste.push(kayit); yaz(liste); return kayit;
  }
  function bekleyen() { return oku(); }
  function temizle() { yaz([]); }
  function beklemeSuresi(deneme) { return Math.min(30 * 60 * 1000, 1000 * Math.pow(2, Math.max(0, deneme - 1))); }
  async function gonder(transport, secenek) {
    if (typeof transport !== 'function') throw new TypeError('transport function gerekli');
    if (durum.calisiyor) return { atlandi: true, kalan: oku().length };
    durum.calisiyor = true;
    var simdi = Date.now(), liste = oku(), kalan = [], sonuc = { gonderildi: 0, bekledi: 0, basarisiz: 0 };
    try {
      for (var i = 0; i < liste.length; i += 1) {
        var kayit = liste[i];
        if ((secenek && secenek.zorla) || !kayit.sonraki || kayit.sonraki <= simdi) {
          try {
            await transport(kayit);
            sonuc.gonderildi += 1;
          } catch (_) {
            kayit.deneme += 1;
            kayit.sonraki = Date.now() + beklemeSuresi(kayit.deneme);
            kalan.push(kayit); sonuc.basarisiz += 1;
          }
        } else { kalan.push(kayit); sonuc.bekledi += 1; }
      }
      yaz(kalan);
      return Object.assign(sonuc, { kalan: kalan.length });
    } finally { durum.calisiyor = false; }
  }
  window.tf4OfflineQueue = { ekle: ekle, bekleyen: bekleyen, temizle: temizle, gonder: gonder, beklemeSuresi: beklemeSuresi };
  window.addEventListener('online', function () {
    var transport = window.tf4OfflineTransport;
    if (typeof transport === 'function') setTimeout(function () { gonder(transport); }, 1200);
  });
}());
