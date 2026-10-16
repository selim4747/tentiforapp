/* TentiforApp 6.3.6 — haftalık görevler ve okuma serisi. */
(function () {
  'use strict';
  var lastDay = '';
  var drawInFlight = false;
  var drawQueued = false;
  var mountedRoot = null;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  function api() { return typeof hesapIstemci !== 'undefined' && hesapIstemci && hesapIstemci.rpc ? hesapIstemci : null; }
  async function visit() {
    var a = api();
    if (!a || typeof hesapKullanici === 'undefined' || !hesapKullanici) return;
    var key = new Date().toISOString().slice(0, 10);
    if (lastDay === key) return;
    lastDay = key;
    try { await a.rpc('okuma_serisi_kaydet', { p_adres: location.hash.slice(0, 240) }); } catch (_) {}
  }
  async function draw() {
    var root = document.querySelector('#hesapTopluluk'), a = api();
    if (!root || !a || typeof hesapKullanici === 'undefined' || !hesapKullanici) return;
    var existing = root.querySelector('[data-tf636]');
    // The observer also sees this module's own DOM updates. Never refetch an already mounted box.
    if (existing && existing.isConnected) { mountedRoot = root; return; }
    if (drawInFlight) return;
    drawInFlight = true;
    var box = document.createElement('section');
    box.className = 'hesap-kutu tf636-gorevler';
    box.setAttribute('data-tf636', '1');
    box.innerHTML = '<span class="oyun-etiket">Haftalık keşif · 6.3.6</span><h3>Görevlerin</h3><div data-tf636-liste><p class="oyun-not">Görevler yükleniyor…</p></div>';
    root.appendChild(box);
    mountedRoot = root;
    try {
      var r = await a.rpc('kesif_gorevlerim');
      if (r.error || !r.data || r.data.durum !== 'tamam') return;
      var rows = r.data.gorevler || [];
      var list = box.querySelector('[data-tf636-liste]');
      if (list) list.innerHTML = rows.map(function (x) {
        var done = Number(x.ilerleme) >= Number(x.hedef);
        return '<div class="tf636-gorev"><b>' + esc(x.ad) + '</b><span class="oyun-not">' + esc(x.aciklama) + '</span><progress max="' + Number(x.hedef) + '" value="' + Number(x.ilerleme) + '"></progress><small>' + Number(x.ilerleme) + '/' + Number(x.hedef) + ' · +' + Number(x.xp) + ' XP' + (done ? ' · tamamlandı' : '') + '</small></div>';
      }).join('');
    } finally { drawInFlight = false; }
  }
  function scheduleDraw() {
    if (drawQueued) return;
    drawQueued = true;
    setTimeout(function () { drawQueued = false; draw(); }, 120);
  }
  document.addEventListener('DOMContentLoaded', function () { visit(); draw(); }, { once: true });
  window.addEventListener('hashchange', function () { visit(); });
  document.addEventListener('tf-veri-hazir', function () { visit(); scheduleDraw(); });
  if (document.body) new MutationObserver(scheduleDraw).observe(document.body, { childList: true, subtree: true });
}());
