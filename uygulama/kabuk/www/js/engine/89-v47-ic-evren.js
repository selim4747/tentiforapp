(function () {
  'use strict';

  var SURUM = '4.8.0';
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
      kisiler: []
    };
  }

  function iceAl(eser) {
    if (!eser || typeof eser !== 'object') return null;
    var ic = eser.icEvren;
    if (!ic || typeof ic !== 'object') return null;
    var eskiKisiler = Array.isArray(ic.kisiler) ? ic.kisiler : (Array.isArray(ic.bedenler) ? ic.bedenler : []);
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
      kisiler: eskiKisiler.slice(0, 80).map(function (k, index) {
        var legacyId = String((k && (k.id || k.kisiId)) || '').slice(0, 40);
        var localId = String((k && (k.yerelId || k.localId || k.id || k.kisiId)) || ('eski-' + index)).slice(0, 60);
        var eskiOlaylar = Array.isArray(k && k.olaylar) ? k.olaylar : (Array.isArray(k && k.izler) ? k.izler.map(function (z) {
          return { ad: String((z && z.yer) || 'Önceki iz'), aciklama: String((z && z.metin) || '') };
        }) : []);
        return {
          id: localId,
          kaynakKisiId: String(k && Object.prototype.hasOwnProperty.call(k, 'kaynakKisiId') ? (k.kaynakKisiId || '') : ((k && (k.kisiId || legacyId)) || '')).slice(0, 60),
          ad: String((k && (k.ad || k.kisiAd)) || '').slice(0, 80),
          unvan: String((k && k.unvan) || '').slice(0, 80),
          kisilik: iceKisilikleriTemizle(k && k.kisilik),
          gizliKimlikler: iceGizliKimlikleriTemizle(k && k.gizliKimlikler),
          yanKisi: iceYanKisiTemizle(k && k.yanKisi),
          olaylar: iceOlaylariTemizle(eskiOlaylar)
        };
      }).filter(function (k) { return k.ad; })
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
      if (!ic.acik && !String(ic.ad || '').trim() && !(ic.kisiler || []).length && !(ic.fizik || []).length) {
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
        ad: String(k.ad || 'Adsız').slice(0, 80),
        gizliKimlikler: iceGizliKimlikleriTemizle(k.gizliKimlikler)
      });
    });
    return liste;
  }

  function iceGizliKimlikleriTemizle(value) {
    return (Array.isArray(value) ? value : []).slice(0, 8).map(function (item) {
      return {
        ad: String(item && item.ad || '').trim().slice(0, 80),
        aciklama: String(item && item.aciklama || '').trim().slice(0, 800)
      };
    }).filter(function (item) { return item.ad || item.aciklama; });
  }


  function iceKisilikleriTemizle(value) {
    return (Array.isArray(value) ? value : []).slice(0, 12).map(function (item) {
      return {
        ad: String(item && item.ad || '').trim().slice(0, 80),
        aciklama: String(item && item.aciklama || '').trim().slice(0, 800)
      };
    }).filter(function (item) { return item.ad || item.aciklama; });
  }

  function iceYanKisiTemizle(value) {
    if (!value || typeof value !== 'object') return null;
    var evrenId = String(value.evrenId || '').trim().slice(0, 80);
    var kisiId = String(value.kisiId || '').trim().slice(0, 60);
    return evrenId && kisiId ? { evrenId: evrenId, kisiId: kisiId } : null;
  }

  function iceOlaylariTemizle(value) {
    return (Array.isArray(value) ? value : []).slice(0, 20).map(function (item) {
      return {
        ad: String(item && (item.ad || item.baslik || item.yer) || '').trim().slice(0, 100),
        aciklama: String(item && (item.aciklama || item.metin) || '').trim().slice(0, 1000)
      };
    }).filter(function (item) { return item.ad || item.aciklama; });
  }

  function iceSatirKayitlariniAyir(value, limit, adLimit, aciklamaLimit) {
    return String(value || '').split(/\n+/).map(function (line) {
      line = line.trim();
      if (!line) return null;
      var colon = line.indexOf(':');
      return colon > -1
        ? { ad: line.slice(0, colon).trim().slice(0, adLimit), aciklama: line.slice(colon + 1).trim().slice(0, aciklamaLimit) }
        : { ad: line.slice(0, adLimit), aciklama: '' };
    }).filter(Boolean).slice(0, limit);
  }

  function iceKisilikleriAyir(value) {
    return iceKisilikleriTemizle(iceSatirKayitlariniAyir(value, 12, 80, 800));
  }

  function iceOlaylariAyir(value) {
    return iceOlaylariTemizle(iceSatirKayitlariniAyir(value, 20, 100, 1000));
  }

  function iceKisiYeniId() {
    return 'ic-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function iceKisiBul(ic, id) {
    return (ic.kisiler || []).find(function (k) { return k.id === id; }) || null;
  }

  function iceKisilikMetni(value) {
    return iceKisilikleriTemizle(value).map(function (item) {
      return item.ad + (item.aciklama ? ': ' + item.aciklama : '');
    }).join('\n');
  }

  function iceOlayMetni(value) {
    return iceOlaylariTemizle(value).map(function (item) {
      return item.ad + (item.aciklama ? ': ' + item.aciklama : '');
    }).join('\n');
  }

  function iceKisilikHtml(value) {
    var rows = iceKisilikleriTemizle(value);
    return rows.length ? '<h5>Kişilik halleri · bu iç evrene özel</h5><dl class="ice-kisilik">' +
      rows.map(function (item) { return '<dt>' + iceKacir(item.ad) + '</dt><dd>' + iceKacir(item.aciklama).replace(/\n/g, '<br>') + '</dd>'; }).join('') + '</dl>' : '';
  }

  function iceOlaylarHtml(value) {
    var rows = iceOlaylariTemizle(value);
    return rows.length ? '<h5>Bu iç evrenin olayları</h5><ol class="ice-olaylar">' +
      rows.map(function (item) { return '<li><b>' + iceKacir(item.ad) + '</b>' + (item.aciklama ? '<p>' + iceKacir(item.aciklama).replace(/\n/g, '<br>') + '</p>' : ''); }).join('') + '</ol>' : '<p class="oyun-not">Bu iç evrene ait olay henüz eklenmedi.</p>';
  }

  function iceTumEvrenler(aktifEser) {
    var kaynaklar = [];
    try { if (typeof fanEserlerim === 'function') kaynaklar = kaynaklar.concat(fanEserlerim() || []); } catch (e) { void e; }
    try { if (typeof fanSiteListesi === 'function') kaynaklar = kaynaklar.concat(fanSiteListesi('evren') || []); } catch (e) { void e; }
    var gorulen = {};
    return kaynaklar.filter(function (eser) {
      if (!eser || eser.tur !== 'evren' || !eser.id || eser.id === (aktifEser && aktifEser.id) || gorulen[eser.id]) return false;
      var ic = iceAl(eser);
      if (!ic || !ic.kisiler.length) return false;
      gorulen[eser.id] = true;
      return true;
    });
  }

  function iceYanKisiSecenekleri(eser, kisi) {
    var rows = [];
    iceTumEvrenler(eser).forEach(function (other) {
      var ic = iceAl(other);
      (ic && ic.kisiler || []).forEach(function (otherPerson) {
        if (other.id === eser.id && otherPerson.id === kisi.id) return;
        rows.push({
          value: JSON.stringify({ evrenId: other.id, kisiId: otherPerson.id }),
          label: String(other.ad || other.baslik || 'Adsız evren') + ' · ' + otherPerson.ad
        });
      });
    });
    return rows;
  }

  function iceYanBaglantisiHtml(eser, kisi) {
    var link = iceYanKisiTemizle(kisi && kisi.yanKisi);
    if (!link) return '';
    var other = iceTumEvrenler(eser).find(function (item) { return item.id === link.evrenId; });
    var linked = other && (iceAl(other).kisiler || []).find(function (item) { return item.id === link.kisiId; });
    return '<p class="ice-baglanti"><b>Yan evrendeki karşılığı:</b> ' +
      (other && linked ? iceKacir(other.ad || other.baslik || 'Evren') + ' · ' + iceKacir(linked.ad) : 'Bağlantı hedefi artık erişilebilir değil.') +
      '<span class="oyun-not"> · yalnızca bağlantı; kişilik ve olaylar birleşmez</span></p>';
  }

  function iceKaynakKisiHtml(eser, kisi) {
    var sourceId = String(kisi && kisi.kaynakKisiId || '');
    if (!sourceId) return '';
    var source = iceKisiler(eser).find(function (item) { return item.id === sourceId; });
    return '<p class="oyun-not ice-baglanti"><b>Ana evren bağlantısı:</b> ' +
      (source ? iceKacir(source.ad) : 'Özgün kişi kaydı artık bulunamıyor') +
      ' <span>· bu kartın kişiliği ve olayları ayrı kalır</span></p>';
  }

  function iceGizliKimlikleriAyir(value) {
    return iceGizliKimlikleriTemizle(String(value || '').split(/\n+/).map(function (line) {
      line = line.trim();
      if (!line) return null;
      var colon = line.indexOf(':');
      return colon > -1
        ? { ad: line.slice(0, colon).trim(), aciklama: line.slice(colon + 1).trim() }
        : { ad: line, aciklama: '' };
    }).filter(Boolean));
  }

  function iceGizliKimlikMetni(value) {
    return iceGizliKimlikleriTemizle(value).map(function (item) {
      return item.ad + (item.aciklama ? ': ' + item.aciklama : '');
    }).join('\n');
  }

  function iceGizliKimlikHtml(value) {
    var identities = iceGizliKimlikleriTemizle(value);
    if (!identities.length) return '';
    return '<details class="ice-gizli-kimlik"><summary>Gizli kimlik · spoiler (' + identities.length + ')</summary><dl>' +
      identities.map(function (item) {
        return '<dt>' + iceKacir(item.ad || 'Adsız kimlik') + '</dt>' +
          (item.aciklama ? '<dd>' + iceKacir(item.aciklama).replace(/\n/g, '<br>') + '</dd>' : '');
      }).join('') + '</dl></details>';
  }

  function iceKisiBul(ic, id) {
    return (ic.kisiler || []).find(function (k) { return k.id === id; }) || null;
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
      '.ice-pro{font-family:var(--mono,ui-monospace,monospace);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--deniz,#1C5C96)}',
      '.ice-kisi-karti{min-width:0;overflow-wrap:anywhere;margin:12px 0}',
      '.ice-kisi-karti input,.ice-kisi-karti textarea,.ice-kisi-karti select,.ice-kisi-ekle input,.ice-kisi-ekle select{box-sizing:border-box;width:100%;max-width:100%;min-width:0;margin:5px 0 10px}',
      '.ice-kisi-karti label,.ice-kisi-ekle label{display:block;margin-top:10px;font-weight:600}',
      '.ice-kisilik,.ice-kisi-karti dl{display:grid;grid-template-columns:minmax(90px,.45fr) minmax(0,1fr);gap:4px 12px}',
      '.ice-kisilik dt,.ice-kisi-karti dt{font-weight:600}',
      '.ice-kisilik dd,.ice-kisi-karti dd{margin:0;min-width:0;overflow-wrap:anywhere}',
      '.ice-olaylar{padding-left:22px}',
      '.ice-olaylar li{margin:8px 0}',
      '.ice-olaylar p{margin:3px 0 0}',
      '.ice-baglanti{overflow-wrap:anywhere}',
      '.ice-kisi-ekle{margin-top:14px;padding-top:10px;border-top:1px solid color-mix(in srgb,var(--sig,#B8D6EC) 45%,transparent)}',
      '.ice-kisi-karti .oyun-sira{display:flex;flex-wrap:wrap;gap:8px}',
      '.ice-kisi-karti .oyun-sira .dugme{flex:1 1 160px;min-height:44px}',
      '@media(max-width:600px){.ice-kutu{padding:12px;min-width:0}.ice-grid.ice-iki{grid-template-columns:minmax(0,1fr)}.ice-kisi-karti .ice-hal{display:grid;grid-template-columns:1fr;align-items:stretch}.ice-kisi-karti .oyun-sira .dugme{flex:1 1 100%;width:100%}.ice-kisilik,.ice-kisi-karti dl{grid-template-columns:minmax(0,1fr)}.ice-kisilik dd,.ice-kisi-karti dd{margin-bottom:8px}}'
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
    var kisiler = (ic.kisiler || []).map(function (kisi) {
      return '<article class="ice-beden ice-kisi-karti"><h4>' + iceKacir(kisi.ad || 'Adsız') + '</h4>' +
        (kisi.unvan ? '<p class="oyun-not">' + iceKacir(kisi.unvan) + '</p>' : '') +
        iceKaynakKisiHtml(eser, kisi) + iceYanBaglantisiHtml(eser, kisi) +
        iceKisilikHtml(kisi.kisilik) + iceGizliKimlikHtml(kisi.gizliKimlikler) + iceOlaylarHtml(kisi.olaylar) +
        '</article>';
    }).join('');
    return (
      '<div class="ice-kutu">' +
        '<span class="ice-pro">İç evren · bağımsız kişi kartları</span>' +
        '<h3>' + iceKacir(ad) + '</h3>' +
        '<p class="oyun-not">' + iceKacir(ic.ozet || 'Bu evrenin kişi kartları, kişilikleri, gizli kimlikleri ve olayları yalnızca bu iç evrene aittir. Yan evren bağlantıları kayıtları birleştirmez.') + '</p>' +
      '</div>' +
      '<div class="ice-grid ice-iki">' +
        '<div class="ice-kutu"><h4>Dış evren fiziği</h4>' + iceDisFizik(eser) + '</div>' +
        '<div class="ice-kutu"><h4>İç evren fiziği</h4>' + (fizik ? '<ul>' + fizik + '</ul>' : '<p class="oyun-not">Henüz ayrı bir kural yazılmamış.</p>') + '</div>' +
      '</div>' +
      '<section class="ice-kutu"><h4>Bu iç evrenin kişi kartları</h4>' +
        (kisiler || '<p class="oyun-not">Henüz bu iç evrene özel kişi kartı yok.</p>') +
      '</section>'
    );
  }

  function iceDuzenHtml(eser, ic) {
    var kaynakKisiler = iceKisiler(eser);
    var kaynakIdleri = {};
    (ic.kisiler || []).forEach(function (k) { if (k.kaynakKisiId) kaynakIdleri[k.kaynakKisiId] = true; });
    var secenek = kaynakKisiler.filter(function (k) { return !kaynakIdleri[k.id]; })
      .map(function (k) { return '<option value="' + iceKacir(k.id) + '">' + iceKacir(k.ad) + '</option>'; }).join('');
    var fizikSatir = (ic.fizik || []).map(function (k, i) {
      return '<div class="ice-grid ice-iki ice-fizik-satir" style="margin-bottom:8px">' +
        '<input class="kod-giris arac-giris" data-ice-fizik-ad="' + i + '" maxlength="80" value="' + iceKacir(k.ad || '') + '" placeholder="Kural adı">' +
        '<input class="kod-giris arac-giris" data-ice-fizik-acik="' + i + '" maxlength="400" value="' + iceKacir(k.aciklama || '') + '" placeholder="Bu evrende nasıl işler?">' +
      '</div>';
    }).join('');
    var kisiKartlari = (ic.kisiler || []).map(function (kisi) {
      var id = iceKacir(kisi.id);
      var links = iceYanKisiSecenekleri(eser, kisi);
      var currentLink = iceYanKisiTemizle(kisi.yanKisi);
      var options = '<option value="">Bağlantı yok</option>' + links.map(function (option) {
        var parsed = JSON.parse(option.value);
        var selected = currentLink && parsed.evrenId === currentLink.evrenId && parsed.kisiId === currentLink.kisiId;
        return '<option value="' + iceKacir(option.value) + '"' + (selected ? ' selected' : '') + '>' + iceKacir(option.label) + '</option>';
      }).join('');
      return '<article class="ice-beden ice-kisi-karti">' +
        '<h4>İç evren kişi kartı · ' + iceKacir(kisi.ad || 'Adsız') + '</h4>' +
        '<label>Bu iç evrendeki adı</label><input class="kod-giris arac-giris" data-ice-kisi-ad="' + id + '" maxlength="80" value="' + iceKacir(kisi.ad) + '">' +
        '<label>Unvanı</label><input class="kod-giris arac-giris" data-ice-kisi-unvan="' + id + '" maxlength="80" value="' + iceKacir(kisi.unvan) + '" placeholder="Bu evrendeki rolü, unvanı…">' +
        '<label>Kişilik halleri · satır başına “Hal: açıklama”</label><textarea class="kod-giris arac-giris" data-ice-kisilik="' + id + '" maxlength="10600" rows="3" placeholder="Sakin: Burada kimseye güvenmez.">' + iceKacir(iceKisilikMetni(kisi.kisilik)) + '</textarea>' +
        '<label>Gizli kimlikler · spoiler · satır başına “Kimlik: açıklama”</label><textarea class="kod-giris arac-giris" data-ice-gizli-kimlikler="' + id + '" maxlength="7080" rows="3" placeholder="Kod adı: bu iç evrendeki karşılığı">' + iceKacir(iceGizliKimlikMetni(kisi.gizliKimlikler)) + '</textarea>' +
        '<p class="oyun-not">Kişilik ve kimlik bu iç evrene özeldir; bağlı başka kişi kartlarından kopyalanmaz. Spoiler metni yayınlanan evren verisinde düz metindir.</p>' +
        '<div class="oyun-sira"><button type="button" class="dugme" data-ice-kisi-kaydet="' + id + '">Kişi kartını kaydet</button>' +
          '<button type="button" class="dugme dugme-sade y-sil y-kucuk" data-ice-kisi-sil="' + id + '">Bu evrenden çıkar</button></div>' +
        '<label>Yan evrendeki karşılığı · yalnızca bağlantı</label><select class="kod-giris arac-giris" data-ice-yan-kisi="' + id + '">' + options + '</select>' +
        '<button type="button" class="dugme dugme-sade" data-ice-yan-kisi-kaydet="' + id + '">Karşılık bağlantısını kaydet</button>' +
        '<p class="oyun-not">Bağlantı yalnızca hangi kartın karşılık olduğunu gösterir; kişi, beden, kişilik ve olaylar birleştirilmez.</p>' +
        '<label>Bu iç evrenin olayları · her satır “Olay: açıklama”</label><textarea class="kod-giris arac-giris" data-ice-olaylar="' + id + '" maxlength="22000" rows="4" placeholder="L25 ile buluşma: Laboratuvarda ilk kez karşılaştılar.">' + iceKacir(iceOlayMetni(kisi.olaylar)) + '</textarea>' +
        '<button type="button" class="dugme dugme-sade" data-ice-olaylar-kaydet="' + id + '">Bu evrenin olaylarını kaydet</button>' +
      '</article>';
    }).join('');
    return (
      '<div class="ice-kutu">' +
        '<span class="ice-pro">EvrenYazar · v' + SURUM + ' · bu evrene özel kayıt</span>' +
        '<h3>İç evren</h3>' +
        '<p class="oyun-not">Her iç evrende kişi kartı, kişilik, gizli kimlik ve olaylar ayrıdır. Bir kişi başka evrende de bulunsa kayıtlar veya bedenler birleştirilmez; karşılık bağlantısı yalnızca başvurudur.</p>' +
        '<label for="iceAd">İç evrenin adı</label>' +
        '<input class="kod-giris arac-giris" id="iceAd" maxlength="80" value="' + iceKacir(ic.ad || '') + '" placeholder="ör. Rüya Katmanı">' +
        '<label for="iceOzet">Nasıl işler?</label>' +
        '<textarea class="kod-giris arac-giris" id="iceOzet" rows="3" maxlength="800" placeholder="Bu iç evrenin kendine ait kuralları vardır.">' + iceKacir(ic.ozet || '') + '</textarea>' +
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
      '<section class="ice-kutu"><h4>Bu iç evrenin kişi kartları</h4>' +
        '<p class="oyun-not">Ana evrendeki bir kişiden bağımsız kart oluşturabilir veya yalnızca bu iç evrende yaşayan yeni biri ekleyebilirsin. Kişilik ve olay alanları başka evrenlere yazılmaz.</p>' +
        (kisiKartlari || '<p class="oyun-not">Henüz bu iç evrende kişi kartı yok.</p>') +
        (secenek ? '<div class="ice-kisi-ekle"><label for="iceKisiSec">Ana evrendeki kişiden ayrı kart oluştur</label><select class="kod-giris arac-giris" id="iceKisiSec"><option value="">Kişi seç…</option>' + secenek + '</select><button type="button" class="dugme" data-ice-kisi-ekle>Ayrı kişi kartı oluştur</button></div>' : (kaynakKisiler.length ? '<p class="oyun-not">Ana evrendeki tüm kişiler için bu evrende zaten ayrı kart var.</p>' : '')) +
        '<div class="ice-kisi-ekle"><label for="iceYeniKisiAd">Yalnızca bu iç evrende bulunan yeni kişi</label><input class="kod-giris arac-giris" id="iceYeniKisiAd" maxlength="80" placeholder="Kişinin adı"><button type="button" class="dugme dugme-sade" data-ice-yerel-kisi-ekle>İç evrende kişi oluştur</button></div>' +
      '</section>'
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
      void 0;
    } catch (e) { void e; }
  }

  document.addEventListener('click', function (ev) {
    var n = ev.target && ev.target.closest && ev.target.closest(
      '[data-ice-kaydet], [data-ice-kapat], [data-ice-fizik-ekle], [data-ice-kisi-ekle], [data-ice-yerel-kisi-ekle], [data-ice-kisi-sil], [data-ice-kisi-kaydet], [data-ice-yan-kisi-kaydet], [data-ice-olaylar-kaydet]'
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
          var satir = { ad: String(inp.value || '').trim().slice(0, 80), aciklama: ac ? String(ac.value || '').trim().slice(0, 400) : '' };
          if (satir.ad || satir.aciklama) ic.fizik.push(satir);
        });
      });
      iceBildir('İç evren kaydedildi. Kişi ve olay kayıtları bu evrende kalır.');
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-kapat')) {
      iceYaz(function (ic) { ic.acik = !ic.acik; });
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-fizik-ekle')) {
      iceYaz(function (ic) { ic.fizik.push({ ad: '', aciklama: '' }); });
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-kisi-ekle')) {
      var sel = document.querySelector('#iceKisiSec');
      var eser = iceEser();
      var kaynak = iceKisiler(eser).find(function (k) { return sel && k.id === sel.value; });
      if (!kaynak) return;
      iceYaz(function (ic) {
        if ((ic.kisiler || []).some(function (k) { return k.kaynakKisiId === kaynak.id; })) return;
        ic.kisiler.push({ id: iceKisiYeniId(), kaynakKisiId: kaynak.id, ad: kaynak.ad, unvan: '', kisilik: [], gizliKimlikler: [], yanKisi: null, olaylar: [] });
      });
      iceBildir(kaynak.ad + ' için bu iç evrende ayrı bir kişi kartı oluşturuldu.');
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-yerel-kisi-ekle')) {
      var yeniAd = document.querySelector('#iceYeniKisiAd');
      var ad = String(yeniAd && yeniAd.value || '').trim().slice(0, 80);
      if (!ad) { iceBildir('Yeni kişi kartı için bir ad yaz.'); return; }
      iceYaz(function (ic) {
        ic.kisiler.push({ id: iceKisiYeniId(), kaynakKisiId: '', ad: ad, unvan: '', kisilik: [], gizliKimlikler: [], yanKisi: null, olaylar: [] });
      });
      iceBildir(ad + ' için bu iç evrene özel kişi kartı oluşturuldu.');
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-kisi-sil')) {
      var silId = n.getAttribute('data-ice-kisi-sil');
      iceYaz(function (ic) { ic.kisiler = (ic.kisiler || []).filter(function (k) { return k.id !== silId; }); });
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-kisi-kaydet')) {
      var kisiId = n.getAttribute('data-ice-kisi-kaydet');
      var readField = function (attribute) {
        var all = document.querySelectorAll('[' + attribute + ']');
        for (var i = 0; i < all.length; i += 1) if (all[i].getAttribute(attribute) === kisiId) return all[i];
        return null;
      };
      var nameField = readField('data-ice-kisi-ad');
      var titleField = readField('data-ice-kisi-unvan');
      var personalityField = readField('data-ice-kisilik');
      var identityField = readField('data-ice-gizli-kimlikler');
      var name = String(nameField && nameField.value || '').trim().slice(0, 80);
      if (!name) { iceBildir('Bu iç evrenin kişi kartında ad gerekli.'); return; }
      iceYaz(function (ic) {
        var person = iceKisiBul(ic, kisiId);
        if (!person) return;
        person.ad = name;
        person.unvan = String(titleField && titleField.value || '').trim().slice(0, 80);
        person.kisilik = iceKisilikleriAyir(personalityField && personalityField.value);
        person.gizliKimlikler = iceGizliKimlikleriAyir(identityField && identityField.value);
      });
      iceBildir('Bu evrenin kişi kartı kaydedildi.');
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-yan-kisi-kaydet')) {
      var linkId = n.getAttribute('data-ice-yan-kisi-kaydet');
      var selectors = document.querySelectorAll('[data-ice-yan-kisi]');
      var linkField = null;
      for (var li = 0; li < selectors.length; li += 1) if (selectors[li].getAttribute('data-ice-yan-kisi') === linkId) linkField = selectors[li];
      var link = null;
      try { link = iceYanKisiTemizle(JSON.parse(linkField && linkField.value || 'null')); } catch (e) { link = null; }
      var active = iceEser();
      var valid = link && iceYanKisiSecenekleri(active, { id: linkId }).some(function (option) {
        try { var value = JSON.parse(option.value); return value.evrenId === link.evrenId && value.kisiId === link.kisiId; } catch (e) { return false; }
      });
      if (link && !valid) { iceBildir('Yan evren kişi kartı bağlantısı doğrulanamadı.'); return; }
      iceYaz(function (ic) {
        var person = iceKisiBul(ic, linkId);
        if (person) person.yanKisi = link;
      });
      iceBildir(link ? 'Yan evrendeki kişi kartına bağlantı kaydedildi; kayıtlar birleştirilmedi.' : 'Yan evren bağlantısı kaldırıldı.');
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }

    if (n.hasAttribute('data-ice-olaylar-kaydet')) {
      var olayId = n.getAttribute('data-ice-olaylar-kaydet');
      var olayAlanlari = document.querySelectorAll('[data-ice-olaylar]');
      var olayAlani = null;
      for (var oi = 0; oi < olayAlanlari.length; oi += 1) if (olayAlanlari[oi].getAttribute('data-ice-olaylar') === olayId) olayAlani = olayAlanlari[oi];
      var olaylar = iceOlaylariAyir(olayAlani && olayAlani.value);
      iceYaz(function (ic) {
        var person = iceKisiBul(ic, olayId);
        if (person) person.olaylar = olaylar;
      });
      iceBildir('Olaylar yalnızca bu iç evrenin kişi kartına kaydedildi.');
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
