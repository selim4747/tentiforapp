/* TentiforApp 6.3.12 — küçük taslak evren silme ve güvenli ücretsiz kota iadesi. */
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
  function taslakBoyutu(value) {
    if (value == null || value === false) return { metin: 0, parca: 0 };
    if (typeof value === 'string') return { metin: value.trim().length, parca: value.trim() ? 1 : 0 };
    if (Array.isArray(value)) return value.reduce(function (total, item) { var n = taslakBoyutu(item); return { metin: total.metin + n.metin, parca: total.parca + n.parca }; }, { metin: 0, parca: 0 });
    if (typeof value === 'object') return Object.keys(value).reduce(function (total, key) { var n = taslakBoyutu(value[key]); return { metin: total.metin + n.metin, parca: total.parca + n.parca }; }, { metin: 0, parca: 0 });
    return { metin: 0, parca: 1 };
  }
  function taslakMi(essay) {
    if (!essay || essay.icEvrenMi || essay.baloncuk || essay.ortak) return false;
    var alanlar = ['ozet', 'metin', 'kurallar', 'kisiler', 'karakterler', 'yerler', 'sozluk', 'tarih', 'harita', 'gezegenler', 'cizimler', 'uygulamalar', 'rehber', 'hikayeler', 'bolumler', 'oneriler'];
    var boyut = taslakBoyutu(alanlar.map(function (key) { return essay[key]; }));
    return boyut.metin <= 600 && boyut.parca <= 6;
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
    var b = document.createElement('button'); b.type = 'button'; b.className = 'dugme dugme-sade tf312-share'; b.dataset.tf312EvrenSil = ''; b.textContent = 'Taslak evreni sil';
    b.title = 'En fazla 600 karakterlik küçük taslaklar da silinebilir; indirilmiş veya paylaşılmış evren korunur'; row.appendChild(b);
  }
  document.addEventListener('click', function (event) {
    var share = event.target.closest && event.target.closest('[data-fan-paylas], [data-fan-indir]');
    if (share) { var e = current(); if (e) guncel(e, share.hasAttribute('data-fan-paylas') ? 'tf312Paylasildi' : 'tf312Indirildi'); return; }
    var b = event.target.closest && event.target.closest('[data-tf312-evren-sil]');
    if (!b) return;
    event.preventDefault(); event.stopImmediatePropagation();
    var e = current();
    if (!e) return;
    if (!taslakMi(e)) { if (typeof eckaBildir === 'function') eckaBildir('Bu evren küçük taslak sınırını aşıyor; yalnızca 600 karaktere ve 6 küçük parçaya kadar taslaklar silinebilir.'); return; }
    if (isaretli(e)) { if (typeof eckaBildir === 'function') eckaBildir('İndirilmiş veya paylaşılmış evrenin ücretsiz plan kotası geri alınmaz.'); return; }
    if (b.dataset.onay !== '1') { b.dataset.onay = '1'; b.textContent = 'Emin misin? Sil'; return; }
    var liste = fanEserlerim().filter(function (item) { return item.id !== e.id; });
    fanEserlerimYaz(liste);
    var iade = typeof window.tf4EvrenKotasiIade === 'function' && window.tf4EvrenKotasiIade();
    if (typeof eckaBildir === 'function') eckaBildir(iade ? 'Taslak evren silindi; ücretsiz evren kotan geri alındı.' : 'Taslak evren silindi.');
    location.hash = '#/fan';
  }, true);
  var observer = new MutationObserver(buttonEkle);
  function boot() { buttonEkle(); if (document.body) observer.observe(document.body, { childList: true, subtree: true }); }
  document.addEventListener('DOMContentLoaded', boot, { once: true });
  document.addEventListener('tf-veri-hazir', buttonEkle);
}());
