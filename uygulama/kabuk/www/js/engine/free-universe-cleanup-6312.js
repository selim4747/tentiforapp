/* TentiforApp 6.3.12 — boş evren silme ve güvenli ücretsiz kota iadesi. */
(function () {
  'use strict';
  var INDIRILEN = 'tentiforapp_indirilen_evrenler';
  function current() {
    var id = typeof EVS !== 'undefined' && EVS && EVS.kaynak === 'benim' ? EVS.id : '';
    return id && typeof fanEserlerim === 'function' ? fanEserlerim().find(function (e) { return e && e.id === id && e.tur === 'evren'; }) : null;
  }
  function hasValue(value) {
    if (value == null || value === false) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.some(hasValue);
    if (typeof value === 'object') return Object.keys(value).some(function (key) { return hasValue(value[key]); });
    return true;
  }
  function bosMu(essay) {
    if (!essay) return false;
    var alanlar = ['ozet', 'metin', 'kurallar', 'kisiler', 'karakterler', 'yerler', 'sozluk', 'tarih', 'harita', 'gezegenler', 'cizimler', 'uygulamalar', 'rehber', 'hikayeler', 'bolumler', 'oneriler', 'icEvren', 'baloncuk'];
    return !alanlar.some(function (key) { return hasValue(essay[key]); });
  }
  function isaretli(essay) {
    if (!essay) return true;
    var paylasim = essay.tf312Paylasildi || essay.tf312Indirildi || essay.paylasildi || essay.paylasim || essay.paylasimlar || essay.paylasimId || essay.paylasim_id;
    if (paylasim) return true;
    try {
      var indirilen = JSON.parse(localStorage.getItem(INDIRILEN) || '{}');
      return !!indirilen[essay.id];
    } catch (_) { return true; }
  }
  function guncel(essay, key) {
    if (!essay) return;
    essay[key] = true;
    if (typeof fanEserlerimYaz === 'function') fanEserlerimYaz(fanEserlerim());
  }
  function buttonEkle() {
    var panel = document.querySelector('.fan-form[data-fan-form="evren"]');
    if (!panel || !(typeof EVS !== 'undefined' && EVS && EVS.kaynak === 'benim') || panel.querySelector('[data-tf312-evren-sil]')) return;
    var row = panel.querySelector('.oyun-sira'); if (!row) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'dugme dugme-sade tf312-share'; b.dataset.tf312EvrenSil = ''; b.textContent = 'Boş evreni sil';
    b.title = 'Yalnızca hiç içerik eklenmemiş, indirilmemiş ve paylaşılmamış evrenler silinebilir'; row.appendChild(b);
  }
  document.addEventListener('click', function (event) {
    var share = event.target.closest && event.target.closest('[data-fan-paylas], [data-fan-indir]');
    if (share) { var e = current(); if (e) guncel(e, share.hasAttribute('data-fan-paylas') ? 'tf312Paylasildi' : 'tf312Indirildi'); return; }
    var b = event.target.closest && event.target.closest('[data-tf312-evren-sil]');
    if (!b) return;
    event.preventDefault(); event.stopImmediatePropagation();
    var e = current();
    if (!e) return;
    if (!bosMu(e)) { if (typeof eckaBildir === 'function') eckaBildir('Bu evrende içerik var; yalnızca boş evrenler silinebilir.'); return; }
    if (isaretli(e)) { if (typeof eckaBildir === 'function') eckaBildir('İndirilmiş veya paylaşılmış evrenin ücretsiz plan kotası geri alınmaz.'); return; }
    if (b.dataset.onay !== '1') { b.dataset.onay = '1'; b.textContent = 'Emin misin? Sil'; return; }
    var liste = fanEserlerim().filter(function (item) { return item.id !== e.id; });
    fanEserlerimYaz(liste);
    var iade = typeof window.tf4EvrenKotasiIade === 'function' && window.tf4EvrenKotasiIade();
    if (typeof eckaBildir === 'function') eckaBildir(iade ? 'Boş evren silindi; ücretsiz evren kotan geri alındı.' : 'Boş evren silindi.');
    location.hash = '#/fan';
  }, true);
  var observer = new MutationObserver(buttonEkle);
  function boot() { buttonEkle(); if (document.body) observer.observe(document.body, { childList: true, subtree: true }); }
  document.addEventListener('DOMContentLoaded', boot, { once: true });
  document.addEventListener('tf-veri-hazir', buttonEkle);
}());
