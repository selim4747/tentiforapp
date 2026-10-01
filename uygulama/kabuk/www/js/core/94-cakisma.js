/* 5.3.4 — alan bazlı ortak evren çakışma yardımcıları */
(function () {
  'use strict';
  function kopyala(deger) {
    return deger && typeof deger === 'object' ? JSON.parse(JSON.stringify(deger)) : deger;
  }
  function esit(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function alanlar(...nesneler) {
    var set = new Set();
    nesneler.forEach(function (nesne) {
      if (nesne && typeof nesne === 'object') Object.keys(nesne).forEach(function (alan) { set.add(alan); });
    });
    return Array.from(set).sort();
  }
  function fark(yerel, uzak, temel) {
    return alanlar(yerel, uzak, temel).map(function (alan) {
      var y = yerel && yerel[alan], u = uzak && uzak[alan], b = temel && temel[alan];
      return { alan: alan, temel: kopyala(b), yerel: kopyala(y), uzak: kopyala(u), yerelDegisti: !esit(y, b), uzakDegisti: !esit(u, b), cakisma: !esit(y, u) && !esit(y, b) && !esit(u, b) };
    }).filter(function (kayit) { return kayit.yerelDegisti || kayit.uzakDegisti; });
  }
  function birlestir(yerel, uzak, secimler) {
    var sonuc = kopyala(uzak || {}) || {};
    fark(yerel, uzak, {}).forEach(function (kayit) {
      var tercih = secimler && secimler[kayit.alan];
      if (tercih === 'yerel') sonuc[kayit.alan] = kopyala(kayit.yerel);
      if (tercih === 'uzak' || !tercih) sonuc[kayit.alan] = kopyala(kayit.uzak);
    });
    return sonuc;
  }
  window.tf4Cakisma = { fark: fark, birlestir: birlestir, esit: esit };
}());
