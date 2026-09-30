(function () {
  'use strict';

  var SURUM = '4.7.0';
  var ICE_STIL_ID = 'v47IcEvrenStil';

  function icePro() {
    return typeof tf4EvrenYazarMi === 'function' && tf4EvrenYazarMi();
  }

  function iceKacir(s) {
    if (typeof kacir === 'function') return kacir(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function iceBildir(s) {
    if (typeof eckaBildir === 'function') eckaBildir(s);
  }

  function iceEser() {
    var v = typeof evrenSayfaVerisi === 'function' ? evrenSayfaVerisi() : null;
    return v && v.eser ? v.eser : null;
  }

  function iceBos() {
    return {
      acik: true,
      ad: '',
      ozet: '',
      fizik: [
        { ad: 'Hafif yerçekimi', aciklama: 'Cisimler yavaş düşer; sıçrayış daha uzun sürer.' },
        { ad: 'Rüya zamanı', aciklama: 'Dış evrende bir gece, iç evrende birkaç güne yayılabilir.' }
      ],
      bedenler: []
    };
  }

  function iceAl(eser) {
    if (!eser || typeof eser !== 'object') return null;
    var ic = eser.icEvren;
    if (!ic || typeof ic !== 'object') return null;
    return {
      acik: ic.acik !== false,
      ad: String(ic.ad || '').slice(0, 80),
      ozet: String(ic.ozet || '').slice(0, 800),
      fizik: Array.isArray(ic.fizik) ? ic.fizik.slice(0, 24).map(function (k) {
        return {
          ad: String((k && k.ad) || '').slice(0, 80),
          aciklama: String((k && k.aciklama) || '').slice(0, 400)
        };
      }).filter(function (k) { return k.ad || k.aciklama; }) : [],
      bedenler: Array.isArray(ic.bedenler) ? ic.bedenler.slice(0, 80).map(function (b) {
        return {
          id: String((b && (b.id || b.kisiId)) || '').slice(0, 40),
          ad: String((b && (b.ad || b.kisiAd)) || '').slice(0, 80),
          ustHal: b && b.ustHal === 'uyuyor' ? 'uyuyor' : 'uyanik',
          icHal: b && b.icHal === 'uyuyor' ? 'uyuyor' : 'uyanik',
          izler: Array.isArray(b && b.izler) ? b.izler.slice(0, 20).map(function (z) {
            return {
              yer: String((z && z.yer) || '').slice(0, 40),
              metin: String((z && z.metin) || '').slice(0, 160),
              kaynak: z && z.kaynak === 'ic' ? 'ic' : 'ust'
            };
          }).filter(function (z) { return z.yer || z.metin; }) : []
        };
      }).filter(function (b) { return b.id || b.ad; }) : []
    };
  }

  function iceYaz(degistir) {
    if (typeof EVS === 'undefined' || !EVS || EVS.kaynak !== 'benim') return;
    if (!icePro()) {
      iceBildir('İç evren EvrenYazar özelliği.');
      if (typeof proPencereAc === 'function') proPencereAc('İç evren kurmak Pro ister. Yuva hakkı harcanmaz.');
      return;
    }
    if (typeof evrenBenimDegistir !== 'function') return;
    evrenBenimDegistir(EVS.id, function (eser) {
      var ic = iceAl(eser) || iceBos();
      degistir(ic, eser);
      if (!ic.acik && !String(ic.ad || '').trim() && !(ic.bedenler || []).length && !(ic.fizik || []).length) {
        delete eser.icEvren;
      } else {
        eser.icEvren = ic;
      }
    });
  }

  function iceKisiler(eser) {
    var liste = [];
    (eser && eser.kisiler || []).forEach(function (k) {
      if (!k || k.kutu) return;
      liste.push({
        id: String(k.id || k.ad || '').slice(0, 40),
        ad: String(k.ad || 'Adsız').slice(0, 80)
      });
    });
    return liste;
  }

  function iceBedenBul(ic, id, ad) {
    return (ic.bedenler || []).find(function (b) {
      return (id && b.id === id) || (ad && b.ad === ad);
    }) || null;
  }

  function iceStil() {
    if (document.getElementById(ICE_STIL_ID)) return;
    var s = document.createElement('style');
    s.id = ICE_STIL_ID;
    s.textContent = [
      '.ice-kutu{margin:12px 0;padding:14px 16px;border:1px solid var(--sig,#B8D6EC);border-radius:4px;background:color-mix(in srgb,var(--beyaz,#fff) 86%,transparent)}',
      'html.gece .ice-kutu,html[data-tema="gece"] .ice-kutu,.gece .ice-kutu{background:color-mix(in srgb,var(--murekkep,#0A0F14) 55%,transparent);border-color:color-mix(in srgb,var(--sig,#B8D6EC) 40%,transparent)}',
      '.ice-kutu h3,.ice-kutu h4{font-family:var(--display,Georgia,serif);font-weight:600;margin:0 0 8px}',
      '.ice-grid{display:grid;gap:12px}',
      '@media(min-width:720px){.ice-iki{grid-template-columns:1fr 1fr}}',
      '.ice-beden{border:1px solid var(--buz,#DFEDF8);border-radius:4px;padding:12px;background:var(--kar,#F4F9FD)}',
      'html.gece .ice-beden,html[data-tema="gece"] .ice-beden,.gece .ice-beden{background:color-mix(in srgb,var(--murekkep,#0A0F14) 70%,transparent);border-color:#2a3540}',
      '.ice-hal{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}',
      '.ice-hal b{font-size:12px;letter-spacing:.04em}',
      '.ice-iz{font-size:13.5px;margin:4px 0;color:var(--murekkep-2,#3D4A57)}',
      'html.gece .ice-iz,html[data-tema="gece"] .ice-iz,.gece .ice-iz{color:color-mix(in srgb,var(--kar,#F4F9FD) 78%,transparent)}',
      '.ice-kilit{border-left:4px solid var(--deniz,#1C5C96)}',
      '.ice-pro{font-family:var(--mono,ui-monospace,monospace);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--deniz,#1C5C96)}'
    ].join('');
    document.head.appendChild(s);
  }

  function iceKilitHtml() {
    var fiyat = typeof TF4_PRO_FIYAT !== 'undefined' ? TF4_PRO_FIYAT : '99 TL / ay';
    return (
      '<div class="ice-kutu ice-kilit">' +
        '<span class="ice-pro">EvrenYazar · v' + SURUM + '</span>' +
        '<h3>İç evren</h3>' +
        '<p class="oyun-not">Karakterlerin dış evrende uyuyup iç evrende uyanık olduğu iç içe evren. Aynı bedeni paylaşırlar: rüyada bedene bırakılan iz, uyanınca da durur. İki evrenin fizik kuralları ayrıdır. İç evren ayrı evren hakkı harcamaz.</p>' +
        '<p class="oyun-not">Ücretsiz planda iç evren yok. Pro’da evren sınırın olsa bile iç evren o sınırın içinde, tek yuva olarak durur.</p>' +
        '<div class="oyun-sira">' +
          '<button type="button" class="dugme" data-pro-ac="İç evren kurmak EvrenYazar ister.">Pro’ya geç · ' + iceKacir(fiyat) + '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function iceDisFizik(eser) {
    var kurallar = (eser && eser.kurallar || []).filter(function (k) {
      return k && (k.ad || k.aciklama);
    });
    if (!kurallar.length) return '<p class="oyun-not">Dış evrenin henüz yazılı bir fizik kuralı yok. İç evreninki ondan bağımsız işler.</p>';
    return '<ul>' + kurallar.slice(0, 12).map(function (k) {
      return '<li><b>' + iceKacir(k.ad || 'Kural') + '</b>' + (k.aciklama ? ' — ' + iceKacir(k.aciklama) : '') + '</li>';
    }).join('') + '</ul>';
  }

  function iceOkurHtml(eser, ic) {
    var ad = ic.ad || ((eser.ad || 'Evren') + ' — iç evren');
    var fizik = (ic.fizik || []).map(function (k) {
      return '<li><b>' + iceKacir(k.ad || 'Kural') + '</b>' + (k.aciklama ? ' — ' + iceKacir(k.aciklama) : '') + '</li>';
    }).join('');
    var bedenler = (ic.bedenler || []).map(function (b) {
      var iz = (b.izler || []).map(function (z) {
        return '<div class="ice-iz">● ' + iceKacir(z.yer || 'beden') + ': ' + iceKacir(z.metin || '') +
          ' <span class="oyun-not">(' + (z.kaynak === 'ic' ? 'iç evrende bırakıldı' : 'dış evrende bırakıldı') + ', her iki evrende görünür)</span></div>';
      }).join('');
      return (
        '<div class="ice-beden">' +
          '<h4>' + iceKacir(b.ad || 'Adsız') + '</h4>' +
          '<div class="ice-hal">' +
            '<span class="oyun-etiket">Dış evren</span> <b>' + (b.ustHal === 'uyuyor' ? 'uyuyor' : 'uyanık') + '</b>' +
            '<span class="oyun-etiket">İç evren</span> <b>' + (b.icHal === 'uyuyor' ? 'uyuyor' : 'uyanık') + '</b>' +
          '</div>' +
          (iz || '<p class="oyun-not">Bu bedende henüz iz yok.</p>') +
        '</div>'
      );
    }).join('');
    return (
      '<div class="ice-kutu">' +
        '<span class="ice-pro">İç içe evren · tek yuva</span>' +
        '<h3>' + iceKacir(ad) + '</h3>' +
        '<p class="oyun-not">' + iceKacir(ic.ozet || 'Karakterler dışarıda uyurken burada uyanıklar. Aynı beden, ayrı fizik.') + '</p>' +
      '</div>' +
      '<div class="ice-grid ice-iki">' +
        '<div class="ice-kutu"><h4>Dış evren fiziği</h4>' + iceDisFizik(eser) + '</div>' +
        '<div class="ice-kutu"><h4>İç evren fiziği</h4>' + (fizik ? '<ul>' + fizik + '</ul>' : '<p class="oyun-not">Henüz ayrı bir kural yazılmamış.</p>') + '</div>' +
      '</div>' +
      '<div class="ice-kutu"><h4>Paylaşılan bedenler</h4>' +
        (bedenler || '<p class="oyun-not">Henüz bağlanmış beden yok.</p>') +
      '</div>'
    );
  }

  function iceDuzenHtml(eser, ic) {
    var kisiler = iceKisiler(eser);
    var bagliId = {};
    (ic.bedenler || []).forEach(function (b) { bagliId[b.id || b.ad] = true; });
    var secenek = kisiler.filter(function (k) { return !bagliId[k.id] && !bagliId[k.ad]; })
      .map(function (k) {
        return '<option value="' + iceKacir(k.id) + '">' + iceKacir(k.ad) + '</option>';
      }).join('');
    var fizikSatir = (ic.fizik || []).map(function (k, i) {
      return (
        '<div class="ice-grid ice-iki" style="margin-bottom:8px">' +
          '<input class="kod-giris arac-giris" data-ice-fizik-ad="' + i + '" maxlength="80" value="' + iceKacir(k.ad || '') + '" placeholder="Kural adı">' +
          '<input class="kod-giris arac-giris" data-ice-fizik-acik="' + i + '" maxlength="400" value="' + iceKacir(k.aciklama || '') + '" placeholder="Bu evrende nasıl işler?">' +
        '</div>'
      );
    }).join('');
    var bedenler = (ic.bedenler || []).map(function (b) {
      var iz = (b.izler || []).map(function (z, zi) {
        return (
          '<div class="ice-iz">' +
            '● ' + iceKacir(z.yer || 'beden') + ': ' + iceKacir(z.metin || '') +
            ' <span class="oyun-not">(' + (z.kaynak === 'ic' ? 'iç' : 'dış') + ')</span> ' +
            '<button type="button" class="ic-bag" data-ice-iz-sil="' + iceKacir(b.id || b.ad) + '" data-ice-iz-i="' + zi + '">sil</button>' +
          '</div>'
        );
      }).join('');
      var anahtar = iceKacir(b.id || b.ad);
      return (
        '<div class="ice-beden">' +
          '<h4>' + iceKacir(b.ad || 'Adsız') + '</h4>' +
          '<div class="ice-hal">' +
            '<span class="oyun-etiket">Dış</span>' +
            '<button type="button" class="dugme dugme-sade y-kucuk" data-ice-hal="ust" data-ice-beden="' + anahtar + '">' +
              (b.ustHal === 'uyuyor' ? 'Uyuyor → uyandır' : 'Uyanık → uyut') +
            '</button>' +
            '<span class="oyun-etiket">İç</span>' +
            '<button type="button" class="dugme dugme-sade y-kucuk" data-ice-hal="ic" data-ice-beden="' + anahtar + '">' +
              (b.icHal === 'uyuyor' ? 'Uyuyor → uyandır' : 'Uyanık → uyut') +
            '</button>' +
          '</div>' +
          '<p class="oyun-not">Biri uyanıksa diğeri uyur. Aynı beden; iz iki tarafta da durur.</p>' +
          (iz || '<p class="oyun-not">İz yok.</p>') +
          '<div class="ice-grid ice-iki">' +
            '<input class="kod-giris arac-giris" id="iceYer-' + anahtar + '" maxlength="40" placeholder="Nereye? (el, boyun, sırt…)">' +
            '<input class="kod-giris arac-giris" id="iceMetin-' + anahtar + '" maxlength="160" placeholder="Ne bırakıldı? (yara, mürekkep, damga…)">' +
          '</div>' +
          '<div class="oyun-sira" style="margin-top:8px">' +
            '<button type="button" class="dugme y-kucuk" data-ice-iz-ekle="' + anahtar + '" data-ice-iz-kaynak="ust">Dışarıda işaretle</button>' +
            '<button type="button" class="dugme dugme-sade y-kucuk" data-ice-iz-ekle="' + anahtar + '" data-ice-iz-kaynak="ic">Rüyada işaretle</button>' +
            '<button type="button" class="dugme dugme-sade y-sil y-kucuk" data-ice-beden-sil="' + anahtar + '">Bedeni çıkar</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    return (
      '<div class="ice-kutu">' +
        '<span class="ice-pro">EvrenYazar · v' + SURUM + ' · tek evren hakkı</span>' +
        '<h3>İç evren</h3>' +
        '<p class="oyun-not">Bu katman evreninin içinde durur. Ayrı evren sayılmaz; Pro evren sınırın olsa bile burası yuva harcamaz. Ücretsiz planda yoktur.</p>' +
        '<label for="iceAd">İç evrenin adı</label>' +
        '<input class="kod-giris arac-giris" id="iceAd" maxlength="80" value="' + iceKacir(ic.ad || '') + '" placeholder="ör. Rüya Katmanı">' +
        '<label for="iceOzet">Nasıl işler?</label>' +
        '<textarea class="kod-giris arac-giris" id="iceOzet" rows="3" maxlength="800" placeholder="Dışarıda uyuyan, burada uyanır. Aynı beden, ayrı fizik.">' + iceKacir(ic.ozet || '') + '</textarea>' +
        '<div class="oyun-sira" style="margin-top:10px">' +
          '<button type="button" class="dugme" data-ice-kaydet>Adı ve özeti kaydet</button>' +
          '<button type="button" class="dugme dugme-sade y-sil" data-ice-kapat>' + (ic.acik ? 'İç evreni kapat' : 'İç evreni aç') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="ice-grid ice-iki">' +
        '<div class="ice-kutu"><h4>Dış evren fiziği</h4>' + iceDisFizik(eser) + '<p class="oyun-not">Bu kurallar dış katmanda kalır.</p></div>' +
        '<div class="ice-kutu"><h4>İç evren fiziği</h4>' +
          (fizikSatir || '<p class="oyun-not">Henüz kural yok.</p>') +
          '<div class="oyun-sira"><button type="button" class="dugme dugme-sade" data-ice-fizik-ekle>+ Fizik kuralı</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="ice-kutu"><h4>Paylaşılan bedenler</h4>' +
        '<p class="oyun-not">Kişiler listenden birini bağla. Uyku hali tersine döner; bedendeki iz her iki evrende görünür.</p>' +
        (bedenler || '<p class="oyun-not">Henüz beden bağlanmadı.</p>') +
        (secenek
          ? '<div class="oyun-sira"><select class="kod-giris arac-giris" id="iceKisiSec"><option value="">Kişi seç…</option>' + secenek + '</select>' +
            '<button type="button" class="dugme" data-ice-beden-ekle>Bedeni bağla</button></div>'
          : (kisiler.length ? '<p class="oyun-not">Bütün kişiler bağlandı.</p>' : '<p class="oyun-not">Önce evrenine kişi ekle.</p>')) +
      '</div>'
    );
  }

  function iceHtml(sayfa) {
    iceStil();
    var eser = sayfa && sayfa.eser;
    var ic = iceAl(eser);
    var benim = typeof EVS !== 'undefined' && EVS && EVS.kaynak === 'benim';
    if (benim && !icePro() && !ic) return iceKilitHtml();
    if (benim && icePro() && !ic) ic = iceBos();
    if (!ic) {
      return '<div class="ice-kutu"><h3>İç evren yok</h3><p class="oyun-not">Kurucu bu evrene iç katman bağlamamış.</p></div>';
    }
    if (benim && icePro()) return iceDuzenHtml(eser, ic);
    return iceOkurHtml(eser, ic);
  }

  function iceSekmeEkle(sayfa, liste) {
    var eser = sayfa && sayfa.eser;
    var ic = iceAl(eser);
    var benim = typeof EVS !== 'undefined' && EVS && EVS.kaynak === 'benim';
    if (benim || ic) {
      var varMi = liste.some(function (s) { return s && s[0] === 'icevren'; });
      if (!varMi) liste.push(['icevren', 'İç evren']);
    }
    return liste;
  }

  var oncekiSekme = window.evrenEkSekmeler;
  var oncekiBolum = window.evrenEkBolum;
  window.evrenEkSekmeler = function (sayfa) {
    var liste = typeof oncekiSekme === 'function' ? (oncekiSekme(sayfa) || []) : [];
    if (!Array.isArray(liste)) liste = [];
    return iceSekmeEkle(sayfa, liste.slice());
  };
  window.evrenEkBolum = function (sayfa) {
    if (typeof EVS !== 'undefined' && EVS && EVS.sekme === 'icevren') return iceHtml(sayfa);
    return typeof oncekiBolum === 'function' ? oncekiBolum(sayfa) : null;
  };

  function iceEvrenSayisiniSar() {
    if (typeof window.evrenSayisi !== 'function' || window.evrenSayisi._iceSarildi) return;
    var eski = window.evrenSayisi;
    window.evrenSayisi = function () {
      if (typeof fanEserlerim !== 'function') return eski();
      return fanEserlerim().filter(function (e) {
        return e && e.tur === 'evren' && !e.e99 && !e.icEvrenMi && e.ustEvrenId == null;
      }).length;
    };
    window.evrenSayisi._iceSarildi = true;
  }

  function iceSurumYaz() {
    try {
      if (typeof veri !== 'undefined' && veri && veri.surum) veri.surum = SURUM;
    } catch (e) {}
  }

  document.addEventListener('click', function (ev) {
    var n = ev.target && ev.target.closest && ev.target.closest(
      '[data-ice-kaydet], [data-ice-kapat], [data-ice-fizik-ekle], [data-ice-beden-ekle], [data-ice-beden-sil], [data-ice-hal], [data-ice-iz-ekle], [data-ice-iz-sil]'
    );
    if (!n) return;
    if (typeof EVS === 'undefined' || !EVS || EVS.kaynak !== 'benim') return;
    ev.preventDefault();

    if (n.hasAttribute('data-ice-kaydet')) {
      var adEl = document.querySelector('#iceAd');
      var ozetEl = document.querySelector('#iceOzet');
      var fizikAd = document.querySelectorAll('[data-ice-fizik-ad]');
      iceYaz(function (ic) {
        ic.acik = true;
        ic.ad = adEl ? adEl.value.trim().slice(0, 80) : ic.ad;
        ic.ozet = ozetEl ? ozetEl.value.trim().slice(0, 800) : ic.ozet;
        ic.fizik = [];
        fizikAd.forEach(function (inp) {
          var i = Number(inp.getAttribute('data-ice-fizik-ad'));
          var ac = document.querySelector('[data-ice-fizik-acik="' + i + '"]');
          var satir = {
            ad: String(inp.value || '').trim().slice(0, 80),
            aciklama: ac ? String(ac.value || '').trim().slice(0, 400) : ''
          };
          if (satir.ad || satir.aciklama) ic.fizik.push(satir);
        });
      });
      iceBildir('İç evren kaydedildi. Evren hakkı harcanmadı.');
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-kapat')) {
      iceYaz(function (ic) { ic.acik = !ic.acik; });
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-fizik-ekle')) {
      iceYaz(function (ic) {
        ic.fizik = ic.fizik || [];
        ic.fizik.push({ ad: '', aciklama: '' });
      });
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-beden-ekle')) {
      var sel = document.querySelector('#iceKisiSec');
      var eser = iceEser();
      var kisi = iceKisiler(eser).find(function (k) { return sel && k.id === sel.value; });
      if (!kisi) return;
      iceYaz(function (ic) {
        if (iceBedenBul(ic, kisi.id, kisi.ad)) return;
        ic.bedenler.push({
          id: kisi.id,
          ad: kisi.ad,
          ustHal: 'uyuyor',
          icHal: 'uyanik',
          izler: []
        });
      });
      iceBildir(kisi.ad + ' bağlandı: dışarıda uyuyor, iç evrende uyanık.');
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-beden-sil')) {
      var silId = n.getAttribute('data-ice-beden-sil');
      iceYaz(function (ic) {
        ic.bedenler = (ic.bedenler || []).filter(function (b) {
          return (b.id || b.ad) !== silId;
        });
      });
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-hal')) {
      var taraf = n.getAttribute('data-ice-hal');
      var bedenId = n.getAttribute('data-ice-beden');
      iceYaz(function (ic) {
        var b = iceBedenBul(ic, bedenId, bedenId);
        if (!b) return;
        if (taraf === 'ust') {
          b.ustHal = b.ustHal === 'uyuyor' ? 'uyanik' : 'uyuyor';
          b.icHal = b.ustHal === 'uyuyor' ? 'uyanik' : 'uyuyor';
        } else {
          b.icHal = b.icHal === 'uyuyor' ? 'uyanik' : 'uyuyor';
          b.ustHal = b.icHal === 'uyuyor' ? 'uyanik' : 'uyuyor';
        }
      });
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-iz-ekle')) {
      var izId = n.getAttribute('data-ice-iz-ekle');
      var kaynak = n.getAttribute('data-ice-iz-kaynak') === 'ic' ? 'ic' : 'ust';
      var yerEl = document.querySelector('#iceYer-' + CSS.escape(izId));
      var metEl = document.querySelector('#iceMetin-' + CSS.escape(izId));
      var yer = yerEl ? yerEl.value.trim() : '';
      var metin = metEl ? metEl.value.trim() : '';
      if (!yer && !metin) {
        iceBildir('İz için bir yer ya da açıklama yaz.');
        return;
      }
      iceYaz(function (ic) {
        var b = iceBedenBul(ic, izId, izId);
        if (!b) return;
        b.izler = b.izler || [];
        b.izler.push({ yer: yer || 'beden', metin: metin || 'işaret', kaynak: kaynak });
      });
      iceBildir('İz her iki evrende de görünüyor.');
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-iz-sil')) {
      var izSilId = n.getAttribute('data-ice-iz-sil');
      var izI = Number(n.getAttribute('data-ice-iz-i'));
      iceYaz(function (ic) {
        var b = iceBedenBul(ic, izSilId, izSilId);
        if (!b || !b.izler) return;
        b.izler.splice(izI, 1);
      });
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
    }
  });

  function baslat() {
    iceSurumYaz();
    iceEvrenSayisiniSar();
    iceStil();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();
  document.addEventListener('tf-veri-hazir', function () {
    iceSurumYaz();
    iceEvrenSayisiniSar();
  });
  document.addEventListener('tf4-uyelik', function () {
    if (typeof EVS !== 'undefined' && EVS && EVS.sekme === 'icevren' && typeof evrenSayfaCiz === 'function') {
      evrenSayfaCiz();
    }
  });
})();
