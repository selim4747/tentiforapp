/* TentiforApp 6.3.2 — takip akışı ve topluluk güvenliği. */
(function () {
  'use strict';
  var mounted = false;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  function c() { return typeof hesapIstemci !== 'undefined' && hesapIstemci && hesapIstemci.rpc ? hesapIstemci : null; }
  function status(root, text, good) { var n = root.querySelector('[data-tf632-status]'); if (n) { n.textContent = text; n.className = 'pencere-durum ' + (good ? 'iyi' : 'kotu'); } }
  function card(x) { return '<article class="kutu-y tf632-akis-kart"><div class="oyun-etiket">' + esc(x.tur) + ' · @' + esc(x.kullanici_adi || '') + '</div><a href="' + esc(x.adres || '#/kesif') + '"><b>' + esc(x.baslik || '') + '</b><span class="oyun-not">' + esc(x.metin || '') + '</span></a><button class="ic-bag" data-tf632-report="' + esc(x.tur) + '" data-tf632-target="' + esc(x.id) + '">bildir</button></article>'; }
  async function loadFeed(box) {
    var r = await c().rpc('takip_akisi'), target = box.querySelector('[data-tf632-feed]');
    if (r.error) { target.innerHTML = '<p class="oyun-not">Akış yüklenemedi.</p>'; return; }
    var rows = Array.isArray(r.data) ? r.data : [];
    target.innerHTML = rows.length ? rows.map(card).join('') : '<p class="oyun-not">Takip ettiğin arşivciler henüz yeni public içerik yayınlamadı.</p>';
  }
  function mount() {
    var root = document.querySelector('#hesapTopluluk');
    if (!root || mounted || typeof hesapKullanici === 'undefined' || !hesapKullanici || !c()) return;
    mounted = true;
    var box = document.createElement('section'); box.className = 'hesap-kutu tf632-topluluk';
    box.innerHTML = '<span class="oyun-etiket">Topluluk · 6.3.2</span><h3>Takip akışın</h3><p class="oyun-not">Takip ettiğin arşivcilerin public evrenleri, teorileri ve defter cümleleri burada görünür.</p><div data-tf632-feed><p class="oyun-not">Akış yükleniyor…</p></div><p data-tf632-status class="pencere-durum"></p>';
    root.appendChild(box); loadFeed(box);
  }
  async function report(button) {
    var reason = window.prompt('Bu içeriği neden bildirmek istiyorsun? (3–400 karakter)');
    if (!reason) return;
    button.disabled = true;
    try {
      var r = await c().rpc('sosyal_sikayet_et', { p_tur: button.dataset.tf632Report, p_hedef: button.dataset.tf632Target, p_neden: reason });
      if (r.error) throw r.error;
      button.textContent = r.data && r.data.durum === 'tamam' ? 'bildirildi' : 'tekrar dene';
    } catch (_) { button.textContent = 'tekrar dene'; }
    button.disabled = false;
  }
  async function profileActivity(panel) {
    if (!panel || panel.dataset.tf632) return;
    var n = panel.querySelector('.hesap-kadi'); if (!n || !c()) return;
    var username = String(n.textContent || '').replace(/^@/, '').trim(); if (!username) return;
    panel.dataset.tf632 = '1';
    var slot = document.createElement('div'); slot.className = 'tf632-profil-etkinlik'; slot.innerHTML = '<h4>Public etkinlik</h4><p class="oyun-not">Yükleniyor…</p>'; panel.appendChild(slot);
    try {
      var r = await c().rpc('public_profil_etkinlikleri', { p_kullanici_adi: username }); if (r.error) throw r.error;
      var rows = Array.isArray(r.data) ? r.data : [];
      slot.innerHTML = '<h4>Public etkinlik</h4>' + (rows.length ? rows.map(function (x) { return '<div class="tf632-etkinlik"><span class="oyun-etiket">' + esc(x.tur) + '</span><a href="' + esc(x.adres || '#/kesif') + '"><b>' + esc(x.baslik || '') + '</b><span class="oyun-not">' + esc(x.metin || '') + '</span></a></div>'; }).join('') : '<p class="oyun-not">Henüz public etkinlik yok.</p>');
    } catch (_) { slot.innerHTML = '<h4>Public etkinlik</h4><p class="oyun-not">Etkinlik yüklenemedi.</p>'; }
  }
  document.addEventListener('click', function (event) {
    var b = event.target.closest && event.target.closest('[data-tf632-report]'); if (b) { event.preventDefault(); report(b); return; }
  });
  function boot() { mount(); document.querySelectorAll('.hesap-profil').forEach(profileActivity); }
  document.addEventListener('DOMContentLoaded', boot, { once: true }); document.addEventListener('tf-veri-hazir', boot);
  new MutationObserver(boot).observe(document.body, { childList: true, subtree: true });
}());
