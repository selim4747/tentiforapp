/* 6.2.4 — EvrenGezer / EvrenYazar üyelik politikası */
(function () {
  'use strict';
  var SURUM = '6.5.6';
  var AYAR = 'tf4_uyelik_kullanimi';
  var PLAN = {
    ucretsiz: { ad: 'Ücretsiz', evren: 1, gezgin: 3, hikaye: 10, gezegen: 1, takim: 0 },
    evrengezer: { ad: 'EvrenGezer', evren: 5, gezgin: 12, hikaye: 42, gezegen: 5, takim: 2 },
    evrenyazar: { ad: 'EvrenYazar', evren: Infinity, gezgin: Infinity, hikaye: Infinity, gezegen: Infinity, takim: Infinity }
  };
  var PLAN_EG_BEDELI = { evrengezer: 250, evrenyazar: 750 };
  var UYELIK_ONBELLEK = 'tf4_uyelik_onbellek_';
  var satinAlmaIstekleri = {};
  function aktifKullaniciId() {
    try { return typeof hesapKullanici !== 'undefined' && hesapKullanici && hesapKullanici.id || ''; } catch (_) { return ''; }
  }
  function yerelUyelikOku() {
    var id = aktifKullaniciId(); if (!id) return null;
    try {
      var raw = localStorage.getItem(UYELIK_ONBELLEK + id), value = raw && JSON.parse(raw);
      if (!value || value.userId !== id || !value.plan) return null;
      if (value.bitis && Date.now() > new Date(value.bitis).getTime()) return null;
      return value;
    } catch (_) { return null; }
  }
  function yerelUyelikYaz(value) {
    var id = aktifKullaniciId(); if (!id || !value) return;
    try { localStorage.setItem(UYELIK_ONBELLEK + id, JSON.stringify(Object.assign({}, value, { userId: id, alindi: new Date().toISOString() }))); } catch (_) {}
  }
  window.tf4UyelikOnbellekYaz = yerelUyelikYaz;
  window.tf4UyelikOnbellekOku = yerelUyelikOku;
  function plan() {
    var t = typeof TF4 !== 'undefined' && TF4.uyelik && TF4.uyelik.tip;
    if (!t) { var cached = yerelUyelikOku(); t = cached && cached.plan; }
    t = String(t || 'ucretsiz').toLocaleLowerCase('tr');
    return t === 'pro' ? 'evrengezer' : (PLAN[t] ? t : 'ucretsiz');
  }
  function ustPlan() { return plan() === 'evrenyazar'; }
  function gezerPlan() { return plan() === 'evrengezer'; }
  function sinirliPlan() { return plan() !== 'evrenyazar'; }
  function kacir(s) { return typeof window.kacir === 'function' ? window.kacir(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function bildir(s) { typeof window.eckaBildir === 'function' && window.eckaBildir(s); }
  function oku() { try { return JSON.parse(localStorage.getItem(AYAR) || '{}') || {}; } catch (_) { return {}; } }
  function yaz(v) { try { localStorage.setItem(AYAR, JSON.stringify(v)); } catch (_) {} }
  function donguBaslangic() { var tf = typeof TF4 !== 'undefined' && TF4.uyelik || {}; var aday = tf.baslangic || tf.baslangic_tarihi || tf.baslangicTarihi || tf.created_at; var planAdi = plan(); var eskiPlan = ''; try { eskiPlan = localStorage.getItem(AYAR + '_plan') || ''; } catch (_) {} if (eskiPlan && eskiPlan !== planAdi) aday = null; var d = aday ? new Date(aday) : null; if (!d || isNaN(d.getTime())) { try { var kayit = localStorage.getItem(AYAR + '_baslangic'); if (kayit) d = new Date(kayit); } catch (_) {} } if (!d || isNaN(d.getTime()) || (eskiPlan && eskiPlan !== planAdi)) { d = new Date(); try { localStorage.setItem(AYAR + '_baslangic', d.toISOString()); localStorage.setItem(AYAR + '_plan', planAdi); } catch (_) {} } try { localStorage.setItem(AYAR + '_plan', planAdi); } catch (_) {} return d; }
  function dongu() { var gecen = Math.max(0, Date.now() - donguBaslangic().getTime()); return 'd30-' + Math.floor(gecen / (30 * 24 * 60 * 60 * 1000)); }
  function kullanim() { var v = oku(); v[dongu()] = v[dongu()] || { evren: 0, gezgin: 0, hikaye: 0 }; return v; }
  function say(kind) { var v = kullanim(); return Number(v[dongu()][kind] || 0); }
  function arttir(kind) { var v = kullanim(); v[dongu()][kind] = say(kind) + 1; yaz(v); }
  function takimLimit() { return PLAN[plan()].takim; }
  function takimKisiSayisi(eser) { var ortak = eser && Array.isArray(eser.ortaklar) ? eser.ortaklar : []; return 1 + ortak.filter(function (x) { return x && (x.kullanici_adi || x.kullaniciAdi || x.id); }).length; }
  function takimKotaAcik(eser, eklenecek) { var limit = takimLimit(), adet = Number(eklenecek) || 1; return limit === Infinity || (limit > 0 && takimKisiSayisi(eser) + adet <= limit); }
  function limit(kind) { return PLAN[plan()][kind]; }
  function kota(kind) { return limit(kind) !== Infinity && say(kind) >= limit(kind); }
  function kotaUyari(kind) {
    var ad = { evren: 'evren', gezgin: 'Evrengezer', hikaye: 'fan hikâyesi' }[kind] || kind;
    var l = limit(kind);
    bildir(plan() + ' planında bu cihazdaki 30 günlük dilimde ' + l + ' ' + ad + ' sınırına ulaştın. Satın alma yakında; sınır hesap sunucusuna bağlanana kadar bu tarayıcıda durur.');
    if (typeof window.proPencereAc === 'function') window.proPencereAc('Daha fazla ' + ad.toLocaleLowerCase('tr') + ' için EvrenYazar planına geçebilirsin.');
  }
  function yeniIzin(kind) {
    if (!sinirliPlan()) return true;
    if (!kota(kind)) return true;
    kotaUyari(kind); return false;
  }
  function asliFanYeni() { return window.__tf4AsliFanYeni || window.fanYeni; }
  function fanYeniSar() {
    if (typeof window.fanYeni !== 'function' || window.fanYeni.__tf473) return;
    window.__tf4AsliFanYeni = window.fanYeni;
    var eski = window.fanYeni;
    var sar = function (tur) {
      var kind = tur === 'evren' ? 'evren' : (tur === 'kisi' ? 'gezgin' : (tur === 'hikaye' ? 'hikaye' : null));
      if (kind && !yeniIzin(kind)) return null;
      var sonuc = eski.apply(this, arguments);
      if (sonuc && kind) arttir(kind);
      return sonuc;
    };
    sar.__tf473 = true;
    window.fanYeni = sar;
  }
  function evrenSayisi() {
    if (typeof window.fanEserlerim !== 'function') return 0;
    return window.fanEserlerim().filter(function (e) { return e && e.tur === 'evren' && !e.e99 && !e.icEvrenMi && e.ustEvrenId == null; }).length;
  }
  function evrenSinirsiz() { return ustPlan() || (typeof window.tf4TestSinirsiz === 'function' && window.tf4TestSinirsiz()) || (typeof window.svkYonetici === 'function' && window.svkYonetici()); }
  function evrenKotaAcik() { return evrenSinirsiz() || say('evren') < limit('evren'); }
  function gezegenKotaAcik(eser) { return ustPlan() || !eser || (eser.gezegenler || []).length < limit('gezegen'); }
  function planEtiketi() { return plan() === 'ucretsiz' ? 'Ücretsiz' : PLAN[plan()].ad; }
  function ortakKullanimNotu() { return 'Ortak evrenler Supabase kimlik ve davet kontrolüyle, içerik ise GitHub private deposuyla korunur.'; }
  function planKartHtml() {
    var p = plan(), aktif = p !== 'ucretsiz', u = typeof TF4 !== 'undefined' && TF4.uyelik && TF4.uyelik.hediye, sonraki = u && u.sonraki_tip;
    var hediye = u && u.aktif ? '<p class="tf-hediye-notu"><b>Yeni hesap hediyesi</b> · İlk 2 gün EvrenYazar açık' + (sonraki ? ', ardından 5 gün EvrenGezer otomatik başlayacak.' : '.') + '</p>' : '';
    return '<div class="kutu-y pro-kart" data-uyelik-kart><b>' + (aktif ? planEtiketi() + ' üyesisin ✓' : 'Üyelik planları') + '</b>' + hediye +
      '<p class="oyun-not">' + (p === 'evrenyazar' ? 'Sınırsız evren, Evrengezer, fan hikâyesi ve yerel takım paketi üyesi; tüm arayüz ve kod editörleri açık.' : p === 'evrengezer' ? '30 günde bir 5 evren, 12 EvrenGezer, 42 fan hikâyesi; yerel co-op paketinde sahibi dahil en fazla 2 kişi ve evren başına 5 gezegen. Arayüz/görünüm/kod editörleri kapalı.' : '30 günde 1 evren, 3 EvrenGezer, 10 fan hikâyesi ve evren başına 1 ek gezegen; evrenle gelen başlangıç gezegeni bu limite dahil değildir. Kanon evrenleri gezme ve okuma ücretsiz.') + '</p>' +
      '<div class="oyun-sira"><button type="button" class="dugme" data-uyelik-ac>Planları gör</button></div></div>';
  }
  function egIstekId(tip) {
    var kullanici = typeof hesapKullanici !== 'undefined' && hesapKullanici && hesapKullanici.id || 'hesap-yok';
    var anahtar = 'tf4-eg-satin-alma-' + kullanici + '-' + tip;
    if (satinAlmaIstekleri[anahtar]) return satinAlmaIstekleri[anahtar];
    try { satinAlmaIstekleri[anahtar] = sessionStorage.getItem(anahtar) || ''; } catch (_) {}
    if (satinAlmaIstekleri[anahtar]) return satinAlmaIstekleri[anahtar];
    var cryptoApi = window.crypto;
    if (!cryptoApi || !cryptoApi.getRandomValues) return '';
    var bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    satinAlmaIstekleri[anahtar] = hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    try { sessionStorage.setItem(anahtar, satinAlmaIstekleri[anahtar]); } catch (_) {}
    return satinAlmaIstekleri[anahtar];
  }
  function egCuzdanYukle() {
    var durum = document.querySelector('#egCuzdanDurum');
    if (!durum) return;
    if (typeof hesapIstemci === 'undefined' || !hesapIstemci || typeof hesapKullanici === 'undefined' || !hesapKullanici) {
      durum.textContent = 'EG cüzdanını görmek ve plan almak için hesabına giriş yap.';
      return;
    }
    durum.textContent = 'Bulutta kayıtlı eski EG bakiyesi bir defa güvenli cüzdana aktarılıyor…';
    hesapIstemci.functions.invoke('evren-gezer-eg-aktar').then(function (aktarim) {
      if (aktarim && aktarim.error) throw new Error('aktarim_hatasi');
      var aktarimSonucu = aktarim && aktarim.data || {};
      if (aktarimSonucu.durum === 'senkron_bekleniyor') {
        var senkronHatasi = new Error('senkron_bekleniyor');
        senkronHatasi.kod = 'senkron_bekleniyor';
        throw senkronHatasi;
      }
      if (aktarimSonucu.durum !== 'aktarildi' && aktarimSonucu.durum !== 'zaten_aktarildi') throw new Error('aktarim_hatasi');
      return hesapIstemci.rpc('evren_gezer_cuzdanim');
    }).then(function (r) {
      if (!r) return;
      if (r && r.error) throw r.error;
      var sonuc = r && r.data || {};
      if (sonuc.durum === 'giris') { durum.textContent = 'Plan almak için hesabına giriş yap.'; return; }
      if (sonuc.durum !== 'tamam') throw new Error('EG bakiyesi alınamadı.');
      durum.dataset.bakiye = String(Number(sonuc.bakiye) || 0);
      durum.textContent = 'Sunucu bakiyesi: ' + (Number(sonuc.bakiye) || 0) + ' EG';
    }).catch(function (hata) {
      durum.textContent = hata && hata.kod === 'senkron_bekleniyor'
        ? 'Eski EG bakiyen bulutta bulunamadı. Önce hesabını eşitle; sonra plan penceresini yeniden aç.'
        : 'Eski EG aktarımı ya da güvenli cüzdan okunamadı. Supabase 6.4.6 kurulumu ve evren-gezer-eg-aktar Edge Function’ı hazır olunca tekrar dene.';
    });
  }
  async function egPlanSatinAl(buton, tip) {
    var durum = document.querySelector('#uyelikDurum');
    var bakiyeDurum = document.querySelector('#egCuzdanDurum');
    if (typeof hesapIstemci === 'undefined' || !hesapIstemci || typeof hesapKullanici === 'undefined' || !hesapKullanici) {
      if (durum) durum.textContent = 'EG ile plan almak için hesabına giriş yap.';
      return;
    }
    var istekId = egIstekId(tip);
    if (!istekId) {
      if (durum) durum.textContent = 'Güvenli satın alma isteği oluşturulamadı; bu tarayıcıda kriptografik rastgelelik desteklenmiyor.';
      return;
    }
    buton.disabled = true;
    if (durum) durum.textContent = 'Satın alma sunucuda güvenli biçimde doğrulanıyor…';
    try {
      var r = await hesapIstemci.rpc('evren_gezer_plan_satin_al', { p_plan: tip, p_istek_id: istekId });
      if (r && r.error) throw r.error;
      var sonuc = r && r.data || {};
      var mesaj = {
        giris: 'Plan almak için hesabına giriş yap.',
        gecersiz: 'Geçersiz plan veya satın alma isteği.',
        bakiye_yetersiz: 'Yetersiz EG bakiyesi. Gerekli: ' + (sonuc.gerekli || PLAN_EG_BEDELI[tip]) + ' EG · mevcut: ' + (sonuc.bakiye || 0) + ' EG.',
        dusurme_yok: 'Aktif EvrenYazar planı EvrenGezer planına düşürülemez; bakiyenden EG alınmadı.',
        zaten_aktif: 'EvrenYazar erişimin zaten etkin; bakiyenden EG alınmadı.',
        istek_cakismasi: 'Satın alma isteği kimliği daha önce farklı bir işlemde kullanılmış; yeniden dene.'
      }[sonuc.durum];
      if (sonuc.durum !== 'tamam') {
        if (durum) durum.textContent = mesaj || 'Satın alma tamamlanamadı; bakiyenden EG alınmadı.';
        try {
          var kullanici = typeof hesapKullanici !== 'undefined' && hesapKullanici && hesapKullanici.id || 'hesap-yok';
          sessionStorage.removeItem('tf4-eg-satin-alma-' + kullanici + '-' + tip);
        } catch (_) {}
        delete satinAlmaIstekleri['tf4-eg-satin-alma-' + (typeof hesapKullanici !== 'undefined' && hesapKullanici && hesapKullanici.id || 'hesap-yok') + '-' + tip];
        return;
      }
      try {
        var kullaniciId = typeof hesapKullanici !== 'undefined' && hesapKullanici && hesapKullanici.id || 'hesap-yok';
        sessionStorage.removeItem('tf4-eg-satin-alma-' + kullaniciId + '-' + tip);
      } catch (_) {}
      delete satinAlmaIstekleri['tf4-eg-satin-alma-' + (typeof hesapKullanici !== 'undefined' && hesapKullanici && hesapKullanici.id || 'hesap-yok') + '-' + tip];
      if (bakiyeDurum) { bakiyeDurum.dataset.bakiye = String(sonuc.bakiye); bakiyeDurum.textContent = 'Sunucu bakiyesi: ' + sonuc.bakiye + ' EG'; }
      if (durum) durum.textContent = (sonuc.plan === 'evrenyazar' ? 'EvrenYazar' : 'EvrenGezer') + ' planın etkinleştirildi: 30 gün · bitiş ' + new Date(sonuc.bitis).toLocaleDateString('tr-TR') + '. Kalan: ' + sonuc.bakiye + ' EG.';
      try {
        if (typeof TF4 !== 'undefined' && TF4) {
          TF4.uyelik = TF4.uyelik || {};
          TF4.uyelik.tip = sonuc.plan;
          TF4.uyelik.bitis = sonuc.bitis;
          TF4.uyelik.baslangic = new Date().toISOString();
        }
        document.dispatchEvent(new Event('tf4-uyelik'));
      } catch (_) {}
      hesapIstemci.rpc('abonelik_durumum').then(function (guncel) {
        if (!guncel || guncel.error || !guncel.data || typeof TF4 === 'undefined' || !TF4) return;
        TF4.uyelik = Object.assign({}, TF4.uyelik || {}, guncel.data);
        document.dispatchEvent(new Event('tf4-uyelik'));
      }).catch(function () {});
    } catch (hata) {
      if (durum) durum.textContent = 'Satın alma yanıtı alınamadı. Güvenli tekrar denemede aynı işlem kimliği kullanılır; destek için oturum durumunu kontrol et.';
    } finally {
      buton.disabled = false;
    }
  }
  function planPencere() {
    var p = plan();
    var rozet = function (id) { return p === id ? '<span class="plan-aktif">Şu an sende</span>' : ''; };
    return '<div class="pencere pro-pencere" role="dialog" aria-modal="true" aria-label="Üyelik planları">' +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      '<h3>Planlar</h3><p class="pencere-alt">Aktif planın: <b>' + planEtiketi() + '</b>. Aşağıda her planın tam sınırlarını ve açık özelliklerini görebilirsin.</p>' +
      '<div class="pro-katmanlar plan-karsilastirma">' +
      '<div class="pro-katman ' + (p === 'ucretsiz' ? 'plan-secili' : '') + '"><b>Ücretsiz</b>' + rozet('ucretsiz') +
        '<ul><li>1 evren taslağı</li><li>Evren başına 1 ek gezegen (evrenle gelen başlangıç gezegeni sayılmaz)</li><li>Kanon evrenleri gezme ve okuma</li><li>Temel arşiv, oyun ve hikâye deneyimi</li><li>Ortak evren başlatma ve davet sistemi kapalı</li><li>Evren düzenleyicisi ve gelişmiş editörler kapalı</li></ul></div>' +
      '<div class="pro-katman ' + (p === 'evrengezer' ? 'plan-secili' : '') + '"><b>EvrenGezer · 250 EG / 30 gün</b>' + rozet('evrengezer') +
        '<p><strong>Ayda 5 evren · 12 Evrengezer · 42 fan hikâyesi</strong></p>' +
        '<ul><li>Co-op evren: sahibi dahil en fazla 2 kişi</li><li>GitHub private evreninde ortak çalışma; sahip dahil en fazla 2 kişi</li><li>Her evrende en fazla 5 gezegen</li><li>Yalnızca 1 baloncuk evren</li><li>Çoklu ve iç içe evren kullanılamaz</li><li>Arayüz, görünüm ve kod editörleri kapalı</li><li>Gezme, okuma ve kendi evrenlerini temel düzeyde oluşturma</li></ul>' +
        '<button type="button" class="dugme dugme-sade" data-uyelik-ode="evrengezer">250 EG ile 30 gün al</button></div>' +
      '<div class="pro-katman pro-one ' + (p === 'evrenyazar' ? 'plan-secili' : '') + '"><b>EvrenYazar · 750 EG / 30 gün</b>' + rozet('evrenyazar') +
        '<ul><li>Evren, Evrengezer, fan hikâyesi ve takım üyesi sınırı yok</li><li>GitHub private evreninde sınırsız ortak çalışma</li><li>Gezegen, baloncuk, çoklu ve iç içe evren sınırı yok</li><li>Arayüz, görünüm ve kod editörleri açık</li><li>Tam evren özelleştirme ve gelişmiş üretim araçları</li></ul>' +
        '<button type="button" class="dugme" data-uyelik-ode="evrenyazar">750 EG ile 30 gün al</button></div>' +
      '</div><p class="oyun-not">Gerçek parayla EG yüklemesi ayrı bir entegrasyondur ve şu an bu satın alma akışında tahsilat yapılmaz. Yönetici, kullanıcı adını kullanarak planı ücretsiz hediye edebilir.</p><p id="egCuzdanDurum" class="oyun-not" role="status">Güvenli sunucu EG bakiyesi yükleniyor…</p><p class="pencere-durum" id="uyelikDurum" role="status"></p></div>';
  }
  function ac() { var e = document.querySelector('#perde'); if (!e) return; e.innerHTML = planPencere(); e.hidden = false; if (typeof window.tfPanelUste === 'function') window.tfPanelUste(e); egCuzdanYukle(); }
  function editorKapali() { return sinirliPlan(); }
  function engelle(n) {
    if (!editorKapali()) return false;
    var a = n.closest && n.closest('[data-evs-sekme], [data-fan-sekme], [data-evst], [data-evu], [data-evr-adim]');
    if (!a) return false;
    var x = String(a.getAttribute('data-evs-sekme') || a.getAttribute('data-fan-sekme') || a.getAttribute('data-evst') || a.getAttribute('data-evu') || a.getAttribute('data-evr-adim') || '').toLocaleLowerCase('tr');
    if (!/(stil|görünüm|gorunum|kod|edit|uygulama|arac)/.test(x)) return false;
    bildir('Bu arayüz ve editör EvrenGezer planında kapalıdır. EvrenYazar ile açılır.'); return true;
  }
  function hediyeAraciniEkle() {
    var k = document.querySelector('.mod-yonetici'); if (!k || k.querySelector('[data-uyelik-tip]')) return;
    var b = k.querySelector('[data-pro-ver]'); if (!b) return;
    var s = document.createElement('select'); s.className = 'arac-giris'; s.setAttribute('data-uyelik-tip', ''); s.innerHTML = '<option value="evrengezer">EvrenGezer</option><option value="evrenyazar">EvrenYazar</option>';
    b.parentNode.insertBefore(s, b); b.textContent = 'Planı hediye et';
    var l = k.querySelector('label[for="proKadi"]'); if (l) l.textContent = 'Plan hediye et: kullanıcı adı';
  }
  document.addEventListener('click', function (e) {
    if (engelle(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    var u = e.target.closest && e.target.closest('[data-uyelik-ac], [data-pro-ac]');
    if (u) { e.preventDefault(); ac(); return; }
    var o = e.target.closest && e.target.closest('[data-uyelik-ode]');
    if (o) { e.preventDefault(); egPlanSatinAl(o, o.getAttribute('data-uyelik-ode')); return; }
    var h = e.target.closest && e.target.closest('[data-pro-ver]');
    if (h && h.closest('.mod-yonetici')) { e.preventDefault(); e.stopImmediatePropagation(); var kutu = h.closest('.mod-yonetici'); var tip = (kutu.querySelector('[data-uyelik-tip]') || {}).value || 'evrengezer'; var kadi = String((kutu.querySelector('#proKadi') || {}).value || '').trim(); var gun = Math.max(1, Math.min(3650, Number((kutu.querySelector('#proGun') || {}).value) || 30)); var d = kutu.querySelector('#modKodDurum'); var yazDurum = function (metin, iyi) { if (d) { d.className = 'pencere-durum ' + (iyi ? 'iyi' : 'kotu'); d.textContent = metin; } }; if (!kadi) { yazDurum('Hediye edilecek kullanıcı adını yaz.', false); return; } if (typeof hesapIstemci === 'undefined' || !hesapIstemci) { yazDurum('Hesap bağlantısı hazır değil; yönetici hesabınla giriş yapıp tekrar dene.', false); return; } h.disabled = true; yazDurum('@' + kadi + ' için yönetici yetkisi kontrol ediliyor…', true); Promise.resolve().then(function () { return hesapIstemci.rpc('tam_yonetici_mi'); }).then(function (yetki) { if (yetki && yetki.error) throw yetki.error; if (!yetki || yetki.data !== true) { throw new Error('Bu oturum Supabase’de tam yönetici olarak tanınmıyor. Çıkış yapıp yönetici hesabıyla yeniden giriş yapın.'); } yazDurum('@' + kadi + ' için hediye kontrol ediliyor…', true); return hesapIstemci.rpc('abonelik_hediye', { p_kullanici_adi: kadi, p_tip: tip, p_gun: gun }); }).then(function (r) { var sonuc = r && r.data || {}; if (r && r.error) { var er = r.error; yazDurum('Hediye verilemedi: ' + (er.message || 'Supabase RPC hatası') + (er.code ? ' [' + er.code + ']' : '') + (er.details ? ' · ' + er.details : ''), false); return; } var mesaj = { yok: 'Bu kullanıcı adıyla kayıtlı hesap bulunamadı.', yetki: 'Bu işlem için tam yönetici yetkisi gerekli.', baslik_yok: 'Plan bilgisi eksik.', gecersiz: 'Geçersiz hediye bilgisi.', dusurme_yok: 'EvrenYazar planı EvrenGezer’e düşürülemez.' }[sonuc.durum]; if (sonuc.durum === 'tamam') { var tarih = sonuc.bitis ? new Date(sonuc.bitis).toLocaleDateString('tr-TR') : ''; yazDurum('@' + kadi + ' hesabına ' + (sonuc.tip === 'evrenyazar' ? 'EvrenYazar' : 'EvrenGezer') + ' başarıyla hediye edildi' + (tarih ? ' · bitiş: ' + tarih : '') + '.', true); } else yazDurum('Hediye verilemedi: ' + (mesaj || sonuc.durum || 'bilinmeyen hata'), false); }).catch(function (x) { yazDurum('Hediye isteği başarısız: ' + (x && x.message || x || 'ağ hatası'), false); }).finally(function () { h.disabled = false; }); }
  }, true);
  document.addEventListener('tf4-uyelik', function () {
    try {
      var u = typeof TF4 !== 'undefined' && TF4 && TF4.uyelik;
      if (u && u.tip && typeof window.tf4UyelikOnbellekYaz === 'function') window.tf4UyelikOnbellekYaz({ plan: u.tip, baslangic: u.baslangic || null, bitis: u.bitis || null });
    } catch (_) {}
    var a = document.querySelector('#proAlan'); if (a) a.innerHTML = planKartHtml();
  });
  document.addEventListener('tf-veri-hazir', function () { setTimeout(function () { var a = document.querySelector('#proAlan'); if (a) a.innerHTML = planKartHtml(); hediyeAraciniEkle(); }, 0); });
  var oldCiz = window.anaEvrenlerCiz;
  if (typeof oldCiz === 'function') window.anaEvrenlerCiz = function () { oldCiz.apply(this, arguments); var a = document.querySelector('#anaEvrenler .ana-kur'); if (a && gezerPlan()) a.querySelector('.ana-evren-not') && (a.querySelector('.ana-evren-not').textContent = 'EvrenGezer: bu ay ' + say('evren') + ' / 5 evren hakkı kullanıldı.'); };
  fanYeniSar();
  if (typeof window.evrenTabanAcik === 'function') window.evrenTabanAcik = evrenKotaAcik;
  window.tf4EvrenKotasiIade = function () {
    if (plan() !== 'ucretsiz') return false;
    var v = kullanim(), key = dongu(), onceki = Number(v[key].evren || 0);
    if (onceki <= 0) return false;
    v[key].evren = onceki - 1;
    yaz(v);
    return true;
  };
  window.tf4Plan = plan; window.tf4PlanAdi = planEtiketi; window.tf4PlanLimit = limit; window.tf4TakimLimit = takimLimit; window.tf4TakimKisiSayisi = takimKisiSayisi; window.tf4TakimKotaAcik = takimKotaAcik; window.tf4UyelikDongu = dongu; window.tf4UyelikDonguBaslangic = donguBaslangic; window.tf4EvrenGezerMi = gezerPlan; window.tf4EvrenYazarMi = ustPlan; window.tf4EvrenKotaAcik = evrenKotaAcik; window.tf4GezegenKotaAcik = gezegenKotaAcik; window.tf4EvrenSinirsiz = evrenSinirsiz; window.tf4UyelikPolitikasi = { SURUM: SURUM, PLAN: PLAN, kota: kota, kullanim: kullanim };
  var observer = new MutationObserver(function () { fanYeniSar(); hediyeAraciniEkle(); });
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
})();
