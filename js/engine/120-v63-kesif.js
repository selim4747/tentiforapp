/* TentiforApp 6.3.0 — evrensel keşif ve arşivci profilleri. */
(function () {
  'use strict';
  var timer = 0;
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c];
    });
  }
  async function client() {
    if (window.hesapIstemci && window.hesapIstemci.rpc) return window.hesapIstemci;
    if (typeof window.tf4Istemci === 'function') {
      try { return await window.tf4Istemci(); } catch (_) { return null; }
    }
    return null;
  }
  function resultBox() {
    var root = document.querySelector('#aramaSonuc');
    if (!root) return null;
    var box = root.querySelector('#tf63Sonuc');
    if (!box) {
      box = document.createElement('div');
      box.id = 'tf63Sonuc';
      box.className = 'tf63-sonuc';
      box.setAttribute('aria-live', 'polite');
      root.appendChild(box);
    }
    return box;
  }
  function resultCard(item) {
    var href = /^#\//.test(item.adres || '') ? item.adres : '#/kesif';
    return '<a class="kutu-y tf63-kart" href="' + esc(href) + '">' +
      '<span class="oyun-etiket">' + esc(item.tur === 'kullanici' ? 'Arşivci' : 'Evren') + '</span>' +
      '<b>' + esc(item.baslik || item.gorunen_ad || '') + '</b>' +
      (item.alt ? '<span class="oyun-not">' + esc(item.alt) + '</span>' : '') + '</a>';
  }
  async function search(value) {
    var box = resultBox();
    if (!box) return;
    var q = String(value || '').trim();
    if (q.length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = '<p class="oyun-not">Kullanıcılar ve yayınlanmış evrenler aranıyor…</p>';
    var c = await client();
    if (!c) { box.innerHTML = '<p class="oyun-not">Keşif bağlantısı henüz hazır değil.</p>'; return; }
    try {
      var response = await c.rpc('kesif_ara', { p_sorgu: q, p_limit: 30 });
      if (response.error) throw response.error;
      var rows = Array.isArray(response.data) ? response.data : [];
      box.innerHTML = rows.length ? '<div class="tf63-baslik">Kullanıcılar ve yayınlanmış evrenler</div>' + rows.map(resultCard).join('') : '<p class="oyun-not">Bu arama için public sonuç bulunamadı.</p>';
    } catch (error) {
      box.innerHTML = '<p class="oyun-not">Keşif şu anda yüklenemedi. Lütfen tekrar dene.</p>';
      if (window.tf4HataKaydet) window.tf4HataKaydet(error, '6.3 keşif araması');
    }
  }
  function observeSearch() {
    var input = document.querySelector('#aramaGiris');
    if (!input || input.dataset.tf63) return;
    input.dataset.tf63 = '1';
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { search(input.value); }, 360);
    });
  }
  async function enhanceProfile(panel) {
    if (!panel || panel.dataset.tf63) return;
    var kadiNode = panel.querySelector('.hesap-kadi');
    if (!kadiNode) return;
    var username = String(kadiNode.textContent || '').replace(/^@/, '').trim();
    if (!username) return;
    panel.dataset.tf63 = '1';
    var slot = document.createElement('div');
    slot.className = 'tf63-profil-alan';
    slot.innerHTML = '<p class="oyun-not">Yayınlanmış içerikler yükleniyor…</p>';
    panel.appendChild(slot);
    var c = await client();
    if (!c) { slot.textContent = 'İçerik bağlantısı henüz hazır değil.'; return; }
    try {
      var response = await c.rpc('public_kullanici_profili', { p_kullanici_adi: username });
      if (response.error || !response.data) throw (response.error || new Error('profil yok'));
      var data = response.data;
      var profile = data.profil || {};
      var worlds = Array.isArray(data.evrenler) ? data.evrenler : [];
      slot.innerHTML = '<div class="tf63-profil-baslik"><span class="oyun-etiket">6.3 keşif profili</span><span class="oyun-not">' +
        esc(data.takipci || 0) + ' takipçi · ' + esc(data.takip || 0) + ' takip</span></div>' +
        '<button type="button" class="dugme dugme-sade" data-tf63-follow="' + esc(username) + '">' +
        (data.takip_ediliyor ? 'Takibi bırak' : 'Takip et') + '</button>' +
        (profile.profil_icerik_gorunur === false ? '<p class="oyun-not">Bu arşivci içeriklerini gizli tutuyor.</p>' :
          '<h4>Yayınlanmış evrenler</h4>' + (worlds.length ? '<div class="tf63-liste">' + worlds.map(function (world) {
            return '<a class="kutu-y tf63-kart" href="#/ev/fan/' + esc(world.id) + '"><b>' + esc(world.baslik) + '</b><span class="oyun-not">' + esc(String(world.ozet || '').slice(0, 160)) + '</span></a>';
          }).join('') + '</div>' : '<p class="oyun-not">Henüz yayınlanmış evren yok.</p>'));
    } catch (_) {
      slot.innerHTML = '<p class="oyun-not">Public profil içerikleri şu anda yüklenemedi.</p>';
    }
  }
  function watchProfiles() {
    document.querySelectorAll('.hesap-profil').forEach(enhanceProfile);
    if (watchProfiles.started) return;
    watchProfiles.started = true;
    new MutationObserver(function () { document.querySelectorAll('.hesap-profil').forEach(enhanceProfile); }).observe(document.body, { childList: true, subtree: true });
  }
  document.addEventListener('click', async function (event) {
    var button = event.target.closest && event.target.closest('[data-tf63-follow]');
    if (!button) return;
    event.preventDefault();
    button.disabled = true;
    var c = await client();
    if (!c) { button.disabled = false; return; }
    try {
      var response = await c.rpc('takip_et', { p_ad: button.getAttribute('data-tf63-follow') });
      if (response.error) throw response.error;
      button.textContent = response.data ? 'Takibi bırak' : 'Takip et';
    } catch (_) { button.textContent = 'Tekrar dene'; }
    button.disabled = false;
  });
  function boot() { observeSearch(); watchProfiles(); }
  document.addEventListener('DOMContentLoaded', boot, { once: true });
  document.addEventListener('tf-veri-hazir', boot);
}());
