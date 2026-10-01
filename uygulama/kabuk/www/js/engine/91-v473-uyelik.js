/* 5.4.2 — EvrenGezer / EvrenYazar üyelik politikası */
(function () {
  'use strict';
  var SURUM = '5.4.2';
  var AYAR = 'tf4_uyelik_kullanimi';
  var PLAN = {
    ucretsiz: { ad: 'Ücretsiz', evren: 1, gezgin: 0, hikaye: 0, gezegen: 0, takim: 0 },
    evrengezer: { ad: 'EvrenGezer', evren: 5, gezgin: 12, hikaye: 42, gezegen: 5, takim: 2 },
    evrenyazar: { ad: 'EvrenYazar', evren: Infinity, gezgin: Infinity, hikaye: Infinity, gezegen: Infinity, takim: Infinity }
  };
  function plan() {
    var t = typeof TF4 !== 'undefined' && TF4.uyelik && TF4.uyelik.tip;
    t = String(t || 'ucretsiz').toLocaleLowerCase('tr');
    return t === 'pro' ? 'evrengezer' : (PLAN[t] ? t : 'ucretsiz');
  }
  function ustPlan() { return plan() === 'evrenyazar'; }
  function gezerPlan() { return plan() === 'evrengezer'; }
  function sinirliPlan() { return gezerPlan(); }
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
    bildir(plan() + ' planında bu ay ' + l + ' ' + ad + ' sınırına ulaştın. EvrenYazar ile sınır kalkar.');
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
  function evrenKotaAcik() { return evrenSinirsiz() || (gezerPlan() ? say('evren') < limit('evren') : evrenSayisi() < 1); }
  function gezegenKotaAcik(eser) { return !gezerPlan() || !eser || (eser.gezegenler || []).length < limit('gezegen'); }
  function planEtiketi() { return plan() === 'ucretsiz' ? 'Ücretsiz' : PLAN[plan()].ad; }
  function ortakKullanimNotu() { return 'Ortak evrenler Supabase kimlik ve davet kontrolüyle, içerik ise GitHub private deposuyla korunur.'; }
  function planKartHtml() {
    var p = plan(), aktif = p !== 'ucretsiz';
    return '<div class="kutu-y pro-kart" data-uyelik-kart><b>' + (aktif ? planEtiketi() + ' üyesisin ✓' : 'Üyelik planları') + '</b>' +
      '<p class="oyun-not">' + (p === 'evrenyazar' ? 'Sınırsız evren, Evrengezer, fan hikâyesi ve yerel takım paketi üyesi; tüm arayüz ve kod editörleri açık.' : p === 'evrengezer' ? '30 günde bir 5 evren, 12 Evrengezer, 42 fan hikâyesi; yerel co-op paketinde sahibi dahil en fazla 2 kişi ve evren başına 5 gezegen. Arayüz/görünüm/kod editörleri kapalı.' : '1 evren taslağı; kanon evrenleri gezme ve okuma ücretsiz.') + '</p>' +
      '<div class="oyun-sira"><button type="button" class="dugme" data-uyelik-ac>Planları gör</button></div></div>';
  }
  function planPencere() {
    var p = plan();
    var rozet = function (id) { return p === id ? '<span class="plan-aktif">Şu an sende</span>' : ''; };
    return '<div class="pencere pro-pencere" role="dialog" aria-modal="true" aria-label="Üyelik planları">' +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      '<h3>Planlar</h3><p class="pencere-alt">Aktif planın: <b>' + planEtiketi() + '</b>. Aşağıda her planın tam sınırlarını ve açık özelliklerini görebilirsin.</p>' +
      '<div class="pro-katmanlar plan-karsilastirma">' +
      '<div class="pro-katman ' + (p === 'ucretsiz' ? 'plan-secili' : '') + '"><b>Ücretsiz</b>' + rozet('ucretsiz') +
        '<ul><li>1 evren taslağı</li><li>Kanon evrenleri gezme ve okuma</li><li>Temel arşiv, oyun ve hikâye deneyimi</li><li>Ortak evren başlatma ve davet sistemi kapalı</li><li>Evren düzenleyicisi ve gelişmiş editörler kapalı</li></ul></div>' +
      '<div class="pro-katman ' + (p === 'evrengezer' ? 'plan-secili' : '') + '"><b>EvrenGezer</b>' + rozet('evrengezer') +
        '<p><strong>Ayda 5 evren · 12 Evrengezer · 42 fan hikâyesi</strong></p>' +
        '<ul><li>Co-op evren: sahibi dahil en fazla 2 kişi</li><li>GitHub private evreninde ortak çalışma; sahip dahil en fazla 2 kişi</li><li>Her evrende en fazla 5 gezegen</li><li>Yalnızca 1 baloncuk evren</li><li>Çoklu ve iç içe evren kullanılamaz</li><li>Arayüz, görünüm ve kod editörleri kapalı</li><li>Gezme, okuma ve kendi evrenlerini temel düzeyde oluşturma</li></ul>' +
        '<button type="button" class="dugme dugme-sade" data-uyelik-ode="evrengezer">EvrenGezer’e geç</button></div>' +
      '<div class="pro-katman pro-one ' + (p === 'evrenyazar' ? 'plan-secili' : '') + '"><b>EvrenYazar · 249 TL / ay</b>' + rozet('evrenyazar') +
        '<ul><li>Evren, Evrengezer, fan hikâyesi ve takım üyesi sınırı yok</li><li>GitHub private evreninde sınırsız ortak çalışma</li><li>Gezegen, baloncuk, çoklu ve iç içe evren sınırı yok</li><li>Arayüz, görünüm ve kod editörleri açık</li><li>Tam evren özelleştirme ve gelişmiş üretim araçları</li></ul>' +
        '<button type="button" class="dugme" data-uyelik-ode="evrenyazar">EvrenYazar’a geç</button></div>' +
      '</div><p class="oyun-not">Yönetici, kullanıcı adını kullanarak EvrenGezer veya EvrenYazar planını ücretsiz hediye edebilir.</p><p class="pencere-durum" id="uyelikDurum" role="status"></p></div>';
  }
  function ac() { var e = document.querySelector('#perde'); if (!e) return; e.innerHTML = planPencere(); e.hidden = false; }
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
    if (o) { var d = document.querySelector('#uyelikDurum'); if (d) d.textContent = 'Ödeme sayfası hazırlanıyor…'; typeof window.tf4Fonksiyon === 'function' && window.tf4Fonksiyon('odeme-baslat', { tip: o.getAttribute('data-uyelik-ode') }).then(function (r) { if (r && r.adres) location.href = r.adres; else if (d) d.textContent = 'Ödeme bağlantısı henüz yapılandırılmadı.'; }).catch(function (x) { if (d) d.textContent = x.message || String(x); }); return; }
    var h = e.target.closest && e.target.closest('[data-pro-ver]');
    if (h && h.closest('.mod-yonetici')) { e.preventDefault(); e.stopImmediatePropagation(); var kutu = h.closest('.mod-yonetici'); var tip = (kutu.querySelector('[data-uyelik-tip]') || {}).value || 'evrengezer'; var kadi = String((kutu.querySelector('#proKadi') || {}).value || '').trim(); var gun = Math.max(1, Math.min(3650, Number((kutu.querySelector('#proGun') || {}).value) || 30)); var d = kutu.querySelector('#modKodDurum'); var yazDurum = function (metin, iyi) { if (d) { d.className = 'pencere-durum ' + (iyi ? 'iyi' : 'kotu'); d.textContent = metin; } }; if (!kadi) { yazDurum('Hediye edilecek kullanıcı adını yaz.', false); return; } if (typeof hesapIstemci === 'undefined' || !hesapIstemci) { yazDurum('Hesap bağlantısı hazır değil; yönetici hesabınla giriş yapıp tekrar dene.', false); return; } h.disabled = true; yazDurum('@' + kadi + ' için hediye kontrol ediliyor…', true); hesapIstemci.rpc('abonelik_hediye', { p_kullanici_adi: kadi, p_tip: tip, p_gun: gun }).then(function (r) { var sonuc = r && r.data || {}; if (r && r.error) { yazDurum('Hediye verilemedi: ' + (r.error.message || 'Supabase RPC hatası'), false); return; } var mesaj = { yok: 'Bu kullanıcı adıyla kayıtlı hesap bulunamadı.', yetki: 'Bu işlem için tam yönetici yetkisi gerekli.', baslik_yok: 'Plan bilgisi eksik.', gecersiz: 'Geçersiz hediye bilgisi.' }[sonuc.durum]; if (sonuc.durum === 'tamam') { var tarih = sonuc.bitis ? new Date(sonuc.bitis).toLocaleDateString('tr-TR') : ''; yazDurum('@' + kadi + ' hesabına ' + (tip === 'evrenyazar' ? 'EvrenYazar' : 'EvrenGezer') + ' başarıyla hediye edildi' + (tarih ? ' · bitiş: ' + tarih : '') + '.', true); } else yazDurum('Hediye verilemedi: ' + (mesaj || sonuc.durum || 'bilinmeyen hata'), false); }).catch(function (x) { yazDurum('Hediye isteği başarısız: ' + (x && x.message || x || 'ağ hatası'), false); }).finally(function () { h.disabled = false; }); }
  }, true);
  document.addEventListener('tf4-uyelik', function () { var a = document.querySelector('#proAlan'); if (a) a.innerHTML = planKartHtml(); });
  document.addEventListener('tf-veri-hazir', function () { setTimeout(function () { var a = document.querySelector('#proAlan'); if (a) a.innerHTML = planKartHtml(); hediyeAraciniEkle(); }, 0); });
  var oldCiz = window.anaEvrenlerCiz;
  if (typeof oldCiz === 'function') window.anaEvrenlerCiz = function () { oldCiz.apply(this, arguments); var a = document.querySelector('#anaEvrenler .ana-kur'); if (a && gezerPlan()) a.querySelector('.ana-evren-not') && (a.querySelector('.ana-evren-not').textContent = 'EvrenGezer: bu ay ' + say('evren') + ' / 5 evren hakkı kullanıldı.'); };
  fanYeniSar();
  if (typeof window.evrenTabanAcik === 'function') window.evrenTabanAcik = evrenKotaAcik;
  window.tf4Plan = plan; window.tf4PlanAdi = planEtiketi; window.tf4PlanLimit = limit; window.tf4TakimLimit = takimLimit; window.tf4TakimKisiSayisi = takimKisiSayisi; window.tf4TakimKotaAcik = takimKotaAcik; window.tf4UyelikDongu = dongu; window.tf4UyelikDonguBaslangic = donguBaslangic; window.tf4EvrenGezerMi = gezerPlan; window.tf4EvrenYazarMi = ustPlan; window.tf4EvrenKotaAcik = evrenKotaAcik; window.tf4GezegenKotaAcik = gezegenKotaAcik; window.tf4EvrenSinirsiz = evrenSinirsiz; window.tf4UyelikPolitikasi = { SURUM: SURUM, PLAN: PLAN, kota: kota, kullanim: kullanim };
  var observer = new MutationObserver(function () { fanYeniSar(); hediyeAraciniEkle(); });
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
})();
