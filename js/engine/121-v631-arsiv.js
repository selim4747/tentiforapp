/* TentiforApp 6.3.1 — kişisel arşiv araçları. */
(function () {
  'use strict';
  var mounted = false;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  function c() { return typeof hesapIstemci !== 'undefined' && hesapIstemci && hesapIstemci.rpc ? hesapIstemci : null; }
  function status(root, text, good) { var n = root.querySelector('[data-tf631-status]'); if (n) { n.textContent = text; n.className = 'pencere-durum ' + (good ? 'iyi' : 'kotu'); } }
  function mount() {
    var root = document.querySelector('#hesapTopluluk');
    if (!root || mounted || typeof hesapKullanici === 'undefined' || !hesapKullanici || !c()) return;
    mounted = true;
    var box = document.createElement('section');
    box.className = 'hesap-kutu tf631-arsiv';
    box.innerHTML = '<span class="oyun-etiket">Kişisel arşiv · 6.3.1</span>' +
      '<h3>Rafların</h3><p class="oyun-not">Arama sonuçlarını, evrenleri ve okuma bağlantılarını kendi raflarında tut.</p>' +
      '<form data-tf631-raf><div class="oyun-sira"><input class="kod-giris arac-giris" name="raf" value="okuyacaklarim" maxlength="40" pattern="[a-z0-9_-]{1,40}" aria-label="Raf adı" placeholder="raf adı"><input class="kod-giris arac-giris" name="adres" required maxlength="240" aria-label="İçerik adresi" placeholder="#/ev/fan/... veya /u/..." autocomplete="off"></div><input class="kod-giris arac-giris" name="baslik" maxlength="160" placeholder="kısa başlık (isteğe bağlı)"><button class="dugme" type="submit">Rafa ekle</button></form>' +
      '<div data-tf631-raflar><p class="oyun-not">Raflar yükleniyor…</p></div>' +
      '<h3>Okuma yolların</h3><p class="oyun-not">Birden fazla içeriği sıraya koy, spoiler seviyesini işaretle ve yolu paylaş.</p>' +
      '<form data-tf631-yol><input class="kod-giris arac-giris" name="baslik" required maxlength="120" placeholder="okuma yolu başlığı"><textarea class="kod-giris" name="aciklama" maxlength="600" rows="2" placeholder="kısa açıklama"></textarea><label class="oyun-not"><input type="checkbox" name="public"> Herkese açık yap</label><button class="dugme" type="submit">Okuma yolu oluştur</button></form>' +
      '<div data-tf631-yollar><p class="oyun-not">Okuma yolları yükleniyor…</p></div>' +
      '<h3>Evren ilişkileri</h3><p class="oyun-not">Karakter, yer ve hikâye düğümlerini basit bağlantılarla kaydet.</p>' +
      '<form data-tf631-graf><div class="oyun-sira"><input class="kod-giris arac-giris" name="evren" required maxlength="80" placeholder="evren"><input class="kod-giris arac-giris" name="kaynak" required maxlength="120" placeholder="kaynak düğüm"><input class="kod-giris arac-giris" name="hedef" required maxlength="120" placeholder="hedef düğüm"></div><input class="kod-giris arac-giris" name="iliski" maxlength="60" value="bağlı" placeholder="ilişki adı"><button class="dugme" type="submit">Bağlantı ekle</button></form><div data-tf631-graf-list><p class="oyun-not">Grafik bağlantıları hazır.</p></div><p data-tf631-status class="pencere-durum"></p>';
    root.appendChild(box);
    loadShelves(box); loadPaths(box);
    box.addEventListener('submit', submit);
  }
  async function loadShelves(box) {
    var r = await c().rpc('raf_listele'); if (r.error) { status(box, 'Raflar yüklenemedi.', false); return; }
    var rows = Array.isArray(r.data) ? r.data : [], target = box.querySelector('[data-tf631-raflar]');
    var groups = {}; rows.forEach(function (x) { (groups[x.raf] || (groups[x.raf] = [])).push(x); });
    target.innerHTML = Object.keys(groups).length ? Object.keys(groups).map(function (key) { return '<div class="tf631-raf"><b>' + esc(key) + '</b>' + groups[key].map(function (x) { return '<div class="tf631-satir"><a href="' + esc(x.adres) + '">' + esc(x.baslik || x.adres) + '</a><button class="ic-bag" data-tf631-raf-sil="' + esc(key) + '" data-tf631-adres="' + esc(x.adres) + '" aria-label="Raf kaydını sil">sil</button></div>'; }).join('') + '</div>'; }).join('') : '<p class="oyun-not">Henüz kişisel raf kaydın yok.</p>';
  }
  async function loadPaths(box) {
    var r = await c().rpc('okuma_yollari_listele', { p_kullanici_adi: null }); if (r.error) { status(box, 'Okuma yolları yüklenemedi.', false); return; }
    var rows = Array.isArray(r.data) ? r.data : [], target = box.querySelector('[data-tf631-yollar]');
    target.innerHTML = rows.length ? rows.map(function (x) { return '<article class="kutu-y tf631-yol"><b>' + esc(x.baslik) + '</b><span class="oyun-not">' + esc(x.aciklama || '') + ' · ' + Number(x.adim || 0) + ' adım' + (x.public ? ' · public' : '') + '</span><a class="dugme dugme-sade" href="#/okuma/' + esc(x.id) + '">Yolu aç</a><form data-tf631-adim="' + esc(x.id) + '"><input class="kod-giris arac-giris" name="adres" required maxlength="240" placeholder="sonraki içerik adresi"><input class="kod-giris arac-giris" name="baslik" maxlength="160" placeholder="adım başlığı"><button class="dugme dugme-sade" type="submit">Adım ekle</button></form></article>'; }).join('') : '<p class="oyun-not">Henüz okuma yolu oluşturmadın.</p>';
  }
  async function submit(event) {
    var form = event.target; if (!form.matches('[data-tf631-raf], [data-tf631-yol], [data-tf631-adim], [data-tf631-graf]')) return; event.preventDefault();
    var fd = new FormData(form), box = form.closest('.tf631-arsiv');
    try {
      var r;
      if (form.matches('[data-tf631-raf]')) r = await c().rpc('raf_kaydet', { p_raf: fd.get('raf'), p_adres: fd.get('adres'), p_baslik: fd.get('baslik') || '' });
      else if (form.matches('[data-tf631-yol]')) r = await c().rpc('okuma_yolu_olustur', { p_baslik: fd.get('baslik'), p_aciklama: fd.get('aciklama') || '', p_public: fd.get('public') === 'on' });
      else if (form.matches('[data-tf631-adim]')) r = await c().rpc('okuma_yolu_adim_ekle', { p_yol: form.dataset.tf631Adim, p_adres: fd.get('adres'), p_baslik: fd.get('baslik') || '', p_tur: 'icerik', p_spoiler: 'yok' });
      else r = await c().rpc('evren_baglantisi_ekle', { p_evren: fd.get('evren'), p_kaynak: fd.get('kaynak'), p_hedef: fd.get('hedef'), p_iliski: fd.get('iliski') || 'bağlı', p_public: false });
      if (r.error) throw r.error;
      status(box, 'Kaydedildi.', true); form.reset();
      if (form.matches('[data-tf631-raf]')) loadShelves(box); else if (form.matches('[data-tf631-yol], [data-tf631-adim]')) loadPaths(box); else loadGraph(box, fd.get('evren'));
    } catch (error) { status(box, 'Kaydedilemedi: ' + (error.message || 'bağlantı hatası'), false); }
  }
  async function loadGraph(box, evren) {
    if (!evren) return; var r = await c().rpc('evren_grafigi', { p_evren: evren }); if (r.error) return;
    var rows = Array.isArray(r.data) ? r.data : []; var target = box.querySelector('[data-tf631-graf-list]');
    target.innerHTML = rows.length ? '<span class="oyun-etiket">' + esc(evren) + ' bağlantıları</span>' + rows.map(function (x) { return '<div class="tf631-satir">' + esc(x.kaynak) + ' — <span class="oyun-not">' + esc(x.iliski) + '</span> → ' + esc(x.hedef) + '</div>'; }).join('') : '<p class="oyun-not">Bu evren için bağlantı yok.</p>';
  }
  async function openPath(id) {
    var r = await c().rpc('okuma_yolu_detay', { p_yol: id }); if (r.error || !r.data) return;
    var cover = document.querySelector('#perde'); if (!cover) return;
    var x = r.data; cover.innerHTML = '<div class="pencere" role="dialog" aria-modal="true"><button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button><span class="oyun-etiket">Okuma yolu · @' + esc(x.sahibi || '') + '</span><h2>' + esc(x.baslik) + '</h2><p class="oyun-not">' + esc(x.aciklama || '') + '</p><ol class="tf631-adimlar">' + (x.adim || []).map(function (a) { return '<li><a class="dugme dugme-sade" href="' + esc(a.adres) + '">' + esc(a.baslik || a.adres) + '</a><span class="oyun-not">' + esc(a.spoiler) + '</span></li>'; }).join('') + '</ol></div>'; cover.hidden = false;
  }
  document.addEventListener('click', function (event) {
    var b = event.target.closest && event.target.closest('[data-tf631-raf-sil]'); if (!b) return;
    var box = b.closest('.tf631-arsiv'); c().rpc('raf_sil', { p_raf: b.dataset.tf631RafSil, p_adres: b.dataset.tf631Adres }).then(function () { loadShelves(box); });
  });
  function route() { var m = String(location.hash).match(/^#\/okuma\/([^/]+)/); if (m && c()) openPath(decodeURIComponent(m[1])); }
  function boot() { mount(); route(); }
  window.addEventListener('hashchange', route); document.addEventListener('DOMContentLoaded', boot, { once: true }); document.addEventListener('tf-veri-hazir', boot);
  new MutationObserver(function () { mount(); }).observe(document.body, { childList: true, subtree: true });
}());
