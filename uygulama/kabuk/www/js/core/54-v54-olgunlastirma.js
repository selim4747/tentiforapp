/* TentiforApp 5.4 — profil, bildirim, rozet, okuma ve hediye deneyimi */
(function () {
  'use strict';
  var V54 = { surum: '5.4.2', timer: 0, filtre: 'hepsi', donem: 'hepsi' };
  var esc = window.kacir || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  function bildirimKategorisi(n) {
    if (n && /^(profil|rozet|okuma|hediye|evren|duyuru)$/.test(String(n.kategori || ''))) return String(n.kategori);
    var s = String((n && (n.baslik || n.metin)) || '').toLocaleLowerCase('tr');
    if (/hediye|üyelik|abonelik|evrengezer|evrenyazar/.test(s)) return 'hediye';
    if (/rozet|madalya|kazandın|kilit/.test(s)) return 'rozet';
    if (/okuma|bölüm|roman|kaldığın|ilerleme/.test(s)) return 'okuma';
    if (/evren|ortak|davet|konuk/.test(s)) return 'evren';
    if (/yönetici|duyuru|bakım/.test(s)) return 'duyuru';
    return 'profil';
  }
  function bildirimTarihi(n) { var d = new Date(n && n.zaman || 0); return isNaN(d.getTime()) ? 0 : d.getTime(); }
  function bildirimleriCiz54() {
    var el = document.querySelector('#tf4BildirimAlan');
    if (!el || typeof TF4_BILDIRIM === 'undefined') return;
    var all = Array.isArray(TF4_BILDIRIM.liste) ? TF4_BILDIRIM.liste : [];
    var now = Date.now(), list = all.filter(function (n) {
      var cat = bildirimKategorisi(n), age = now - bildirimTarihi(n), ok = !!n.okundu;
      return (V54.filtre === 'hepsi' || (V54.filtre === 'okunmamis' && !ok) || V54.filtre === cat) &&
        (V54.donem === 'hepsi' || (V54.donem === '7' && age <= 7 * 864e5) || (V54.donem === '30' && age <= 30 * 864e5) || (V54.donem === 'eski' && age > 30 * 864e5));
    });
    var unread = all.filter(function (n) { return !n.okundu; }).length;
    document.documentElement.toggleAttribute('data-bildirim-var', unread > 0);
    var cats = [['hepsi','Tümü'],['okunmamis','Okunmamış'],['profil','Profil'],['rozet','Rozet'],['okuma','Okuma'],['hediye','Hediye'],['evren','Evren'],['duyuru','Duyuru']];
    if (!all.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="kutu-y v54-bildirim-kutu"><div class="v54-panel-bas"><div><span class="oyun-etiket">Bildirimler</span><b>' + (unread ? unread + ' okunmamış' : 'Güncel') + '</b></div>' + (unread ? '<button class="ic-bag" data-v54-bildirim-okundu>Tümünü okundu yap</button>' : '') + '</div>' +
      '<div class="v54-filtreler" role="toolbar" aria-label="Bildirim filtreleri">' + cats.map(function (c) { return '<button class="filtre-btn ' + (V54.filtre === c[0] ? 'secili' : '') + '" data-v54-bildirim-filtre="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '<select class="kod-giris v54-donem" data-v54-bildirim-donem aria-label="Bildirim dönemi"><option value="hepsi"' + (V54.donem === 'hepsi' ? ' selected' : '') + '>Her zaman</option><option value="7"' + (V54.donem === '7' ? ' selected' : '') + '>Son 7 gün</option><option value="30"' + (V54.donem === '30' ? ' selected' : '') + '>Son 30 gün</option><option value="eski"' + (V54.donem === 'eski' ? ' selected' : '') + '>Eski</option></select></div>' +
      '<ul class="bildirim-liste v54-bildirim-liste">' + (list.length ? list.map(function (n) { var cat = bildirimKategorisi(n), d = bildirimTarihi(n), label = d ? new Date(d).toLocaleString('tr-TR', {dateStyle:'medium', timeStyle:'short'}) : ''; return '<li class="bildirim-satiri v54-bildirim-satiri ' + (n.okundu ? '' : 'yeni') + '"><span class="v54-bildirim-kategori">' + esc(cat) + '</span>' + (n.baglanti ? '<a href="' + esc(n.baglanti) + '" data-v54-bildirim-link data-bildirim-no="' + esc(n.no || '') + '">' + esc(n.metin) + '</a>' : '<span>' + esc(n.metin) + '</span>') + (label ? '<time class="bildirim-zaman">' + esc(label) + '</time>' : '') + '</li>'; }).join('') : '<li class="oyun-not">Bu filtrede bildirim yok.</li>') + '</ul></div>';
  }
  function bildirimOku54() {
    if (typeof TF4_BILDIRIM === 'undefined') return;
    TF4_BILDIRIM.liste.forEach(function (n) { n.okundu = true; });
    if (typeof hesapIstemci !== 'undefined' && hesapIstemci) hesapIstemci.rpc('bildirimleri_okundu').catch(function () {});
    bildirimleriCiz54();
  }
  function hediyeGecmisi() { try { return JSON.parse(localStorage.getItem('tf54_hediye_gecmisi') || '[]'); } catch (_) { return []; } }
  function hediyeGecmisiYaz(a) { try { localStorage.setItem('tf54_hediye_gecmisi', JSON.stringify(a.slice(0, 30))); } catch (_) {} }
  function hediyeGecmisiCiz() {
    var host = document.querySelector('.mod-yonetici');
    if (!host || host.querySelector('[data-v54-hediye-gecmisi]')) return;
    var rows = hediyeGecmisi();
    var box = document.createElement('div'); box.className = 'kutu-y v54-hediye-gecmisi'; box.setAttribute('data-v54-hediye-gecmisi', '1');
    box.innerHTML = '<span class="oyun-etiket">5.4 hediye teslim geçmişi</span><p class="oyun-not">Bu tarayıcıdaki son hediye denemeleri. Kalıcı ortak geçmiş için 5.4 SQL migration’ını Supabase’de çalıştır.</p><div class="v54-hediye-liste">' + (rows.length ? rows.map(function (r) { return '<div><b>@' + esc(r.kullanici) + '</b> · ' + esc(r.tip) + ' · ' + esc(r.gun) + ' gün <span class="' + (r.ok ? 'iyi' : 'kotu') + '">' + (r.ok ? 'başarılı' : 'başarısız') + '</span><small>' + esc(r.zaman) + '</small></div>'; }).join('') : '<p class="oyun-not">Henüz hediye işlemi kaydı yok.</p>') + '</div>';
    host.appendChild(box);
  }
  function okurIstatistikleri() {
    var chars = (typeof veri !== 'undefined' && veri.karakterler) || [], badges = 0, read = 0;
    chars.forEach(function (c) { if (typeof kilitAcik === 'function' && (kilitAcik('rozet_' + c.id) || kilitAcik('rozet_altin_' + c.id))) badges++; if (typeof karakterOkunanlar === 'function') { var x = karakterOkunanlar(c); read += x.okunan.length; } });
    var ev = typeof vitrinEvrenIlerlemeleri === 'function' ? (vitrinEvrenIlerlemeleri() || {}) : {};
    return { evren: Object.keys(ev).filter(function (k) { return ev[k].okunan > 0; }).length, rozet: badges, okunan: read };
  }
  function rozetKoleksiyonuCiz() {
    var host = document.querySelector('#koleksiyonAlan'); if (!host || typeof veri === 'undefined' || !veri) return;
    var chars = (veri.karakterler || []).filter(function (c) { return c && c.kart !== false && (!c.gizli || typeof okuErisim !== 'function' || okuErisim(null, c.gizli)); }), unlocked = 0;
    var cards = chars.map(function (c) { var gumus = typeof kilitAcik === 'function' && kilitAcik('rozet_' + c.id), altin = typeof kilitAcik === 'function' && kilitAcik('rozet_altin_' + c.id), state = altin ? 'altın' : gumus ? 'gümüş' : 'kilitli'; if (gumus || altin) unlocked++; return '<article class="v54-rozet-kart ' + (state === 'kilitli' ? 'kilitli' : '') + '">' + (typeof karakterPortreHtml === 'function' ? karakterPortreHtml(c, 'kart') : '') + '<div><b>' + esc(c.ad) + '</b><span>' + state + ' rozet</span><small>' + (altin ? 'Karakteri tamamla ve fan hikâyesi yazıldı.' : gumus ? 'Karaktere ait içeriklerin tamamı okundu.' : 'Karaktere ait kayıtları oku; rozet burada görünecek.') + '</small></div></article>'; }).join('');
    var old = host.querySelector('[data-v54-rozet-panel]'); if (old) old.remove();
    var box = document.createElement('div'); box.setAttribute('data-v54-rozet-panel', '1'); box.className = 'kutu-y v54-rozet-panel'; box.innerHTML = '<div class="v54-panel-bas"><div><span class="oyun-etiket">Rozet koleksiyonu</span><b>' + unlocked + ' / ' + chars.length + ' kazanıldı</b></div></div><div class="v54-rozet-grid">' + cards + '</div>'; host.appendChild(box);
  }
  function okumaPaneliCiz() {
    var host = document.querySelector('#hesapAlan'); if (!host || !document.querySelector('#hesapTopluluk')) return;
    var old = host.querySelector('[data-v54-okuma-panel]'); if (old) old.remove();
    var st = okurIstatistikleri(), active = typeof yolAktif === 'function' ? yolAktif() : null;
    var box = document.createElement('div'); box.setAttribute('data-v54-okuma-panel', '1'); box.className = 'kutu-y v54-okuma-panel'; box.innerHTML = '<span class="oyun-etiket">Okur özeti</span><div class="v54-ozet-grid"><b>' + st.evren + '<small>evren okunuyor</small></b><b>' + st.rozet + '<small>karakter rozeti</small></b><b>' + st.okunan + '<small>kayıt okundu</small></b></div>' + (active ? '<p class="oyun-not">Kaldığın okuma yolu kaydedildi. <button class="ic-bag" data-v54-okumaya-devam>Devam et</button></p>' : '<p class="oyun-not">Bir okuma yolunu açtığında kaldığın yer burada görünecek.</p>'); host.appendChild(box);
  }
  function profilGelistir() {
    var p = document.querySelector('#profilTopluluk'); if (!p || p.querySelector('[data-v54-profil-ozet]')) return;
    var st = okurIstatistikleri(), box = document.createElement('div'); box.setAttribute('data-v54-profil-ozet', '1'); box.className = 'v54-profil-ozet'; box.innerHTML = '<span class="oyun-etiket">Okur özeti</span><span>' + st.evren + ' evren</span><span>' + st.rozet + ' karakter rozeti</span><span>' + st.okunan + ' kayıt</span>'; p.appendChild(box);
  }
  function yenile() { bildirimleriCiz54(); rozetKoleksiyonuCiz(); okumaPaneliCiz(); profilGelistir(); hediyeGecmisiCiz(); }
  document.addEventListener('click', function (e) {
    var gift = e.target.closest && e.target.closest('[data-pro-ver]');
    if (gift) {
      var host = gift.closest('.mod-yonetici'), input = host && host.querySelector('#proKadi'), type = host && host.querySelector('[data-uyelik-tip]');
      var item = { kullanici: String(input && input.value || '').trim().toLowerCase(), tip: String(type && type.value || 'evrengezer'), gun: Number(host && (host.querySelector('#proGun') || {}).value) || 30, zaman: new Date().toLocaleString('tr-TR'), ok: false };
      setTimeout(function () {
        var status = host && host.querySelector('#modKodDurum'), text = String(status && status.textContent || '');
        item.ok = /başarıyla hediye edildi|başarılı/.test(text);
        if (item.kullanici) { var h = hediyeGecmisi(); h.unshift(item); hediyeGecmisiYaz(h); hediyeGecmisiCiz(); }
      }, 700);
    }
  }, true);
  document.addEventListener('click', function (e) {
    var f = e.target.closest && e.target.closest('[data-v54-bildirim-filtre]'); if (f) { V54.filtre = f.getAttribute('data-v54-bildirim-filtre'); bildirimleriCiz54(); return; }
    var d = e.target.closest && e.target.closest('[data-v54-bildirim-donem]'); if (d) { V54.donem = d.value; bildirimleriCiz54(); return; }
    if (e.target.closest && e.target.closest('[data-v54-bildirim-okundu]')) { bildirimOku54(); return; }
    if (e.target.closest && e.target.closest('[data-v54-bildirim-link]')) { var n = e.target.closest('[data-v54-bildirim-link]').getAttribute('data-bildirim-no'); var row = (typeof TF4_BILDIRIM !== 'undefined' && TF4_BILDIRIM.liste || []).find(function (x) { return String(x.no) === String(n); }); if (row) row.okundu = true; setTimeout(bildirimleriCiz54, 80); return; }
    if (e.target.closest && e.target.closest('[data-v54-okumaya-devam]')) { var y = typeof yolAktif === 'function' ? yolAktif() : null; if (y && y.sonraki && typeof yolAdimaGit === 'function') yolAdimaGit(y.sonraki); return; }
  });
  document.addEventListener('tf-veri-hazir', function () { setTimeout(yenile, 250); });
  document.addEventListener('tf-hesap-hazir', function () { setTimeout(yenile, 250); });
  document.addEventListener('tf4-uyelik', function () { setTimeout(yenile, 100); });
  var oldCiz = window.bildirimleriCiz;
  window.bildirimleriCiz = function () { if (typeof oldCiz === 'function') oldCiz.apply(this, arguments); bildirimleriCiz54(); };
  var oldHediye = window.hediyeAraciniEkle;
  if (typeof oldHediye === 'function') window.hediyeAraciniEkle = function () { oldHediye.apply(this, arguments); hediyeGecmisiCiz(); };
  var oldTop = window.toplulukProfilEk;
  if (typeof oldTop === 'function') window.toplulukProfilEk = async function () { var r = await oldTop.apply(this, arguments); profilGelistir(); return r; };
  var oldHesap = window.hesapCiz;
  if (typeof oldHesap === 'function') window.hesapCiz = function () { oldHesap.apply(this, arguments); setTimeout(okumaPaneliCiz, 20); };
  setInterval(function () { var p = document.querySelector('.mod-yonetici'); if (p) hediyeGecmisiCiz(); }, 2000);
  setTimeout(yenile, 500);
  window.TF54 = { yenile: yenile, bildirimleriCiz: bildirimleriCiz54, rozetKoleksiyonuCiz: rozetKoleksiyonuCiz };
})();
