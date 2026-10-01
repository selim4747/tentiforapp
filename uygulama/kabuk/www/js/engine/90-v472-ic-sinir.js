(function () {
  'use strict';

  var SURUM = '4.7.2';

  function ustPlanMu() {
    return (typeof tf4EvrenYazarMi === 'function' && tf4EvrenYazarMi()) || (typeof tf4EvrenGezerMi === 'function' && tf4EvrenGezerMi());
  }

  function icKatmanMi(eser) {
    return !!(eser && (eser.icEvrenMi || eser.baloncuk || eser.ustEvrenId != null || eser.katman === 'ic'));
  }

  function icEvrenAktif(eser) {
    var ic = eser && eser.icEvren;
    if (!ic || typeof ic !== 'object') return false;
    if (ic.acik === false) return false;
    return !!(String(ic.ad || '').trim() || (ic.bedenler || []).length || (ic.fizik || []).length || ic.acik);
  }

  function evrenKotaSay() {
    if (typeof fanEserlerim !== 'function') return 0;
    var n = 0;
    fanEserlerim().forEach(function (e) {
      if (!e || e.tur !== 'evren' || e.e99) return;
      n += 1;
      if (icEvrenAktif(e)) n += 1;
    });
    return n;
  }

  function sayaciSar() {
    if (typeof window.evrenSayisi === 'function' && !window.evrenSayisi._v472) {
      window.evrenSayisi = evrenKotaSay;
      window.evrenSayisi._v472 = true;
    }
    if (typeof window.tf4EvrenSayisi === 'function' && !window.tf4EvrenSayisi._v472) {
      var eskiTf = window.tf4EvrenSayisi;
      window.tf4EvrenSayisi = function () {
        return Math.max(eskiTf(), evrenKotaSay());
      };
      window.tf4EvrenSayisi._v472 = true;
    } else if (typeof window.tf4EvrenSayisi !== 'function') {
      window.tf4EvrenSayisi = evrenKotaSay;
      window.tf4EvrenSayisi._v472 = true;
    }
  }

  function kilitHtml(baslik, metin) {
    var fiyat = typeof TF4_PRO_FIYAT !== 'undefined' ? TF4_PRO_FIYAT : '99 TL / ay';
    return (
      '<div class="ice-kutu ice-kilit">' +
        '<span class="ice-pro">EvrenYazar · v' + SURUM + '</span>' +
        '<h3>' + baslik + '</h3>' +
        '<p class="oyun-not">' + metin + '</p>' +
        '<p class="oyun-not">Ücretsiz planda yok. Yalnızca en üst planda (EvrenYazar) ve yalnızca en üst evrende açılır. İç evren ve baloncuk evren evren sınırına dahildir.</p>' +
        '<div class="oyun-sira">' +
          '<button type="button" class="dugme" data-pro-ac="' + baslik + ' en üst plan ister.">Pro’ya geç · ' +
            String(fiyat).replace(/&/g, '&amp;').replace(/</g, '&lt;') +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function baloncuklar(eser) {
    if (typeof fanEserlerim !== 'function' || !eser) return [];
    return fanEserlerim().filter(function (e) {
      return e && e.tur === 'evren' && !e.e99 && (e.ustEvrenId === eser.id || e.ustEvren === eser.id) && (e.baloncuk || e.icEvrenMi || e.ustEvrenId);
    });
  }

  function baloncukKur() {
    if (!ustPlanMu() && !(typeof tf4EvrenGezerMi === 'function' && tf4EvrenGezerMi())) {
      if (typeof proPencereAc === 'function') proPencereAc('Baloncuk evren yalnızca en üst planda.');
      return;
    }
    var eser = typeof evrenSayfaVerisi === 'function' ? (evrenSayfaVerisi() || {}).eser : null;
    if (!eser || icKatmanMi(eser)) {
      if (typeof eckaBildir === 'function') eckaBildir('Baloncuk evren yalnızca en üst evrene eklenir.');
      return;
    }
    if (typeof uretimAcik === 'function' && !uretimAcik('evren')) {
      if (typeof seviyeUyari === 'function') seviyeUyari('evren');
      return;
    }
    if (typeof fanYeni !== 'function') return;
    if (baloncuklar(eser).length >= 1) { if (typeof eckaBildir === 'function') eckaBildir('Bu planda her üst evrende yalnızca 1 baloncuk evren olabilir.'); return; }
    var n = fanYeni('evren');
    var id = n && n.id;
    if (!id) return;
    var liste = fanEserlerim();
    var cocuk = liste.find(function (e) { return e.id === id; });
    if (!cocuk) return;
    cocuk.baloncuk = true;
    cocuk.icEvrenMi = true;
    cocuk.ustEvrenId = eser.id;
    cocuk.ad = cocuk.ad || ((eser.ad || 'Evren') + ' — baloncuk');
    cocuk.ozet = cocuk.ozet || 'Bu evren, üst evrenin içinde duran bir baloncuk evrendir. Evren sınırına dahildir.';
    if (typeof fanEserlerimYaz === 'function') fanEserlerimYaz(liste);
    if (typeof eckaBildir === 'function') eckaBildir('Baloncuk evren kuruldu. Evren sınırına eklendi.');
    location.hash = '#/ev/benim/' + id;
  }

  function baloncukHtml(sayfa) {
    var eser = sayfa && sayfa.eser;
    var benim = typeof EVS !== 'undefined' && EVS && EVS.kaynak === 'benim';
    if (icKatmanMi(eser)) {
      return '<div class="ice-kutu"><h3>Baloncuk evren</h3><p class="oyun-not">Bu katman zaten bir iç / baloncuk evren. Yeni baloncuk yalnızca en üst evrene eklenir.</p></div>';
    }
    if (benim && !ustPlanMu()) {
      return kilitHtml('Baloncuk evren', 'Evren-içi evren (baloncuk): üst evrenin içinde ayrı fizikle duran küçük bir evren. Evren hakkına dahildir.');
    }
    var liste = baloncuklar(eser);
    var kartlar = liste.map(function (e) {
      return '<div class="ice-beden"><h4>' + String(e.ad || 'Adsız baloncuk').replace(/</g, '&lt;') + '</h4>' +
        '<p class="oyun-not">' + String(e.ozet || 'İç evren / baloncuk').replace(/</g, '&lt;') + '</p>' +
        '<div class="oyun-sira"><button type="button" class="dugme y-kucuk" data-evren-git="#/ev/benim/' + String(e.id).replace(/"/g, '') + '">Aç</button></div></div>';
    }).join('');
    return (
      '<div class="ice-kutu">' +
        '<span class="ice-pro">EvrenYazar · v' + SURUM + ' · evren sınırına dahil</span>' +
        '<h3>Baloncuk evrenler</h3>' +
        '<p class="oyun-not">Üst evrenin içinde duran evren-içi evrenler. Her baloncuk evren hakkı harcar. Yalnızca en üst planda ve en üst evrende kurulur.</p>' +
        (benim ? '<div class="oyun-sira"><button type="button" class="dugme" data-baloncuk-kur>+ Baloncuk evren kur</button></div>' : '') +
      '</div>' +
      '<div class="ice-kutu"><h4>Bu evrenin baloncukları</h4>' +
        (kartlar || '<p class="oyun-not">Henüz baloncuk evren yok.</p>') +
      '</div>'
    );
  }

  var oncekiSekme = window.evrenEkSekmeler;
  var oncekiBolum = window.evrenEkBolum;
  window.evrenEkSekmeler = function (sayfa) {
    var liste = typeof oncekiSekme === 'function' ? (oncekiSekme(sayfa) || []) : [];
    if (!Array.isArray(liste)) liste = [];
    var eser = sayfa && sayfa.eser;
    var benim = typeof EVS !== 'undefined' && EVS && EVS.kaynak === 'benim';
    if (icKatmanMi(eser)) {
      liste = liste.filter(function (s) { return !s || (s[0] !== 'icevren' && s[0] !== 'baloncuk'); });
    } else if (benim || (eser && (icEvrenAktif(eser) || baloncuklar(eser).length))) {
      if (!liste.some(function (s) { return s && s[0] === 'baloncuk'; })) {
        liste.push(['baloncuk', 'Baloncuk evren']);
      }
    }
    return liste;
  };
  window.evrenEkBolum = function (sayfa) {
    if (typeof EVS !== 'undefined' && EVS && EVS.sekme === 'baloncuk') return baloncukHtml(sayfa);
    if (typeof EVS !== 'undefined' && EVS && EVS.sekme === 'icevren') {
      var eser = sayfa && sayfa.eser;
      var benim = EVS.kaynak === 'benim';
      if (icKatmanMi(eser)) {
        return '<div class="ice-kutu"><h3>İç evren</h3><p class="oyun-not">İç evren özelliği yalnızca en üst evrende açılır.</p></div>';
      }
      if (benim && !ustPlanMu() && !icEvrenAktif(eser)) {
        return kilitHtml('İç evren', 'Karakterler dışarıda uyurken burada uyanık. Aynı beden, ayrı fizik. Evren sınırına dahildir.');
      }
    }
    return typeof oncekiBolum === 'function' ? oncekiBolum(sayfa) : null;
  };

  document.addEventListener('click', function (ev) {
    var n = ev.target && ev.target.closest && ev.target.closest('[data-baloncuk-kur]');
    if (!n) return;
    ev.preventDefault();
    baloncukKur();
  });

  function kartNotu() {
    var a = document.querySelector('#proAlan .pro-kart p.oyun-not, #proAlan .oyun-not');
    if (!a || a.getAttribute('data-v472')) return;
    a.setAttribute('data-v472', '1');
    a.textContent = (a.textContent || '') + ' İç evren ve baloncuk evren yalnızca Pro’da; her biri evren sınırına sayılır.';
  }

  function baslat() {
    sayaciSar();
    kartNotu();
    try {
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();
  document.addEventListener('tf-veri-hazir', baslat);
  document.addEventListener('tf4-uyelik', function () {
    sayaciSar();
    if (typeof EVS !== 'undefined' && EVS && typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
  });
})();
