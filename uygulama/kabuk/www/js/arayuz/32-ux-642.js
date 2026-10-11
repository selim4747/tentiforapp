/* TentiFor 6.4.2.1 — kişisel merkez ve keşif araçları. Yerel, geri alınabilir UX katmanı. */
(function () {
  'use strict';

  var KEY = 'tentiforapp_642';
  var defaults = {
    fontScale: 1,
    contrast: false,
    reduceMotion: false,
    dyslexia: false,
    readingTheme: 'normal',
    collection: [],
    resume: null,
    daily: null
  };
  var state = load();
  var panel;
  var searchIndex = null;

  function normalizeState(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var result = Object.assign({}, defaults);
    result.fontScale = Number.isFinite(Number(raw.fontScale)) ? Math.max(.9, Math.min(1.3, Number(raw.fontScale))) : 1;
    result.contrast = raw.contrast === true;
    result.reduceMotion = raw.reduceMotion === true;
    result.dyslexia = raw.dyslexia === true;
    result.readingTheme = raw.readingTheme === 'sepya' ? 'sepya' : 'normal';
    result.collection = Array.isArray(raw.collection) ? raw.collection.filter(function (item) {
      return item && typeof item === 'object' && typeof item.route === 'string' && typeof item.title === 'string';
    }).map(function (item) {
      return { route: text(item.route, 240), title: text(item.title, 120), savedAt: text(item.savedAt, 40) };
    }).filter(function (item) { return item.route && item.title; }).slice(0, 30) : [];
    result.resume = raw.resume && typeof raw.resume === 'object' && typeof raw.resume.route === 'string' ? {
      route: text(raw.resume.route, 240), title: text(raw.resume.title, 120), savedAt: text(raw.resume.savedAt, 40)
    } : null;
    if (!result.resume || !result.resume.route) result.resume = null;
    result.daily = raw.daily && typeof raw.daily === 'object' && raw.daily.item && typeof raw.daily.item === 'object' ? {
      day: text(raw.daily.day, 12), item: { kind: text(raw.daily.item.kind, 40), title: text(raw.daily.item.title, 120), description: text(raw.daily.item.description, 180), route: text(raw.daily.item.route, 240) }
    } : null;
    return result;
  }
  function load() {
    try { return normalizeState(JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return normalizeState({}); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function text(value, max) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max || 160); }
  function routeFor(item) {
    var id = text(item && (item.slug || item.id), 80).toLowerCase();
    return item && item.tur === 'evren' && /^[\p{L}\p{N}][\p{L}\p{N}-]{2,59}$/u.test(id) ? '/evren/' + encodeURIComponent(id) + '/' : null;
  }
  function makeIndex() {
    if (searchIndex && searchIndex.length) return searchIndex;
    var out = [];
    var data = window.veri || {};
    function addList(list, kind, route, titleOf, descriptionOf) {
      (Array.isArray(list) ? list : []).forEach(function (item) {
        if (!item || typeof item !== 'object' || item.gizli || item.kilitli || item.kodSifreli) return;
        var title = text(titleOf(item), 100);
        if (!title) return;
        out.push({ kind: kind, title: title, description: text(descriptionOf(item), 180), route: route(item) });
      });
    }
    var worlds = (data.fanEserleri && data.fanEserleri.evrenler) || [];
    worlds.forEach(function (item) {
      var route = routeFor(item);
      if (route && (item.kanon === true || item.public_mu === true || item.yayinda === true)) out.push({ kind: 'Evren', title: text(item.ad || item.id, 100), description: text(item.ozet, 180), route: route });
    });
    Object.keys(data.kanonEvrenleri || {}).forEach(function (id) {
      var item = data.kanonEvrenleri[id] || {};
      var route = routeFor({ tur: 'evren', id: id });
      if (route && !out.some(function (x) { return x.route === route; })) out.push({ kind: 'Kanon evren', title: text(item.ad || id, 100), description: text(item.ozet, 180), route: route });
    });
    addList(data.karakterler, 'Karakter', function () { return '#/arsiv'; }, function (item) { return item.ad || item.id; }, function (item) { return [item.unvan, item.ozet].filter(Boolean).join(' · '); });
    addList(data.evren, 'İçerik', function () { return '#/okuma'; }, function (item) { return item.baslik || item.id; }, function (item) { return item.ozet || item.metin; });
    addList(data.mektuplar, 'Belge', function () { return '#/belgeler'; }, function (item) { return [item.kimden, item.kime].filter(Boolean).join(' → ') || item.id; }, function (item) { return item.not || item.metin; });
    addList(data.galeri, 'Oyun/görsel', function () { return '#/oyunlar'; }, function (item) { return item.baslik || item.id; }, function (item) { return item.aciklama; });
    addList(data.yapimlar, 'Yapım', function () { return '#/proje'; }, function (item) { return item.ad; }, function (item) { return [item.tur, item.not].filter(Boolean).join(' · '); });
    addList(data.sozluk, 'Sözlük', function () { return '#/araclar'; }, function (item) { return item.terim; }, function (item) { return item.tanim; });
    addList(data.profiller, 'Public profil', function () { return '#/sen'; }, function (item) { return item.ad || item.id; }, function (item) { return item.selamlama; });
    addList(data.yazarNotlari, 'Yazar notu', function () { return '#/proje'; }, function (item) { return item.baslik; }, function (item) { return item.metin; });
    searchIndex = out;
    return out;
  }
  function applyPrefs() {
    var root = document.documentElement;
    root.setAttribute('data-tf642-font', String(state.fontScale));
    root.toggleAttribute('data-tf642-kontrast', !!state.contrast);
    root.toggleAttribute('data-tf642-az-hareket', !!state.reduceMotion);
    root.toggleAttribute('data-tf642-disleksi', !!state.dyslexia);
    root.setAttribute('data-tf642-okuma-zemin', state.readingTheme);
  }
  function currentItem() {
    var route = location.hash || location.pathname || '/';
    return { route: route, title: text(document.title || 'TentiFor', 120), savedAt: new Date().toISOString() };
  }
  function setResume() { var item = currentItem(); if (item.route !== '#/' && item.route !== '/') { state.resume = item; save(); } }
  function pickDaily() {
    var list = makeIndex();
    if (!list.length) return null;
    var day = new Date().toISOString().slice(0, 10);
    if (!state.daily || state.daily.day !== day) { state.daily = { day: day, item: list[Math.floor(Math.random() * list.length)] }; save(); }
    return state.daily.item;
  }
  function openPanel() { if (!panel) return; panel.hidden = false; panel.querySelector('[data-tf642-close]').focus(); renderPanel(); }
  function closePanel() { if (panel) panel.hidden = true; }
  function copy(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).catch(function () {});
    else { var area = document.createElement('textarea'); area.value = value; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); }
  }
  function renderSearch(query) {
    var box = panel.querySelector('[data-tf642-results]');
    if (!box) return;
    var q = text(query, 80).toLocaleLowerCase('tr-TR');
    if (!q) { box.innerHTML = '<p class="tf642-muted">Evren, karakter veya içerik ara.</p>'; return; }
    var results = makeIndex().filter(function (x) { return (x.title + ' ' + x.description).toLocaleLowerCase('tr-TR').indexOf(q) >= 0; }).slice(0, 12);
    box.innerHTML = results.length ? results.map(function (x) { return '<a class="tf642-result" href="' + esc(x.route) + '"><span>' + esc(x.kind) + '</span><strong>' + esc(x.title) + '</strong><small>' + esc(x.description) + '</small></a>'; }).join('') : '<p class="tf642-muted">Sonuç bulunamadı.</p>';
  }
  function renderPanel() {
    var daily = pickDaily();
    var resume = state.resume;
    var collection = state.collection || [];
    var status = navigator.onLine ? 'Çevrimiçi' : 'Çevrimdışı — değişiklikler cihazda tutuluyor';
    panel.querySelector('[data-tf642-body]').innerHTML =
      '<div class="tf642-grid">' +
      '<section class="tf642-card"><h3>Kişisel merkez</h3>' +
      (resume ? '<p><strong>Kaldığın yer:</strong> ' + esc(resume.title) + '</p><a class="dugme" href="' + esc(resume.route) + '">Devam et</a>' : '<p class="tf642-muted">Okuduğun son içerik burada görünecek.</p>') +
      '<p class="tf642-status" data-tf642-status>' + esc(status) + '</p></section>' +
      '<section class="tf642-card"><h3>Günün keşfi</h3>' + (daily ? '<p><strong>' + esc(daily.title) + '</strong></p><p>' + esc(daily.description || 'Yeni bir evren keşfet.') + '</p><a class="dugme dugme-sade" href="' + esc(daily.route) + '">Keşfet</a>' : '<p class="tf642-muted">Henüz öneri bulunamadı.</p>') + '</section>' +
      '</div>' +
      '<section class="tf642-card"><h3>Evrensel arama</h3><input class="tf642-search" type="search" placeholder="Evren, karakter veya içerik ara" aria-label="Evrensel arama" data-tf642-search><div class="tf642-results" data-tf642-results><p class="tf642-muted">Evren, karakter veya içerik ara.</p></div></section>' +
      '<section class="tf642-card"><h3>Okuma ve erişilebilirlik</h3><div class="tf642-controls">' +
      '<button class="dugme dugme-sade" data-tf642-font="-">Yazıyı küçült</button><button class="dugme dugme-sade" data-tf642-font="+">Yazıyı büyüt</button>' +
      '<button class="dugme dugme-sade" data-tf642-toggle="contrast">' + (state.contrast ? 'Kontrastı kapat' : 'Yüksek kontrast') + '</button>' +
      '<button class="dugme dugme-sade" data-tf642-toggle="dyslexia">' + (state.dyslexia ? 'Standart yazı tipi' : 'Okuma dostu yazı') + '</button>' +
      '<button class="dugme dugme-sade" data-tf642-toggle="reduceMotion">' + (state.reduceMotion ? 'Hareketi aç' : 'Hareketi azalt') + '</button>' +
      '<button class="dugme dugme-sade" data-tf642-reading="sepya">' + (state.readingTheme === 'sepya' ? 'Normal zemin' : 'Sepya zemin') + '</button>' +
      '</div></section>' +
      '<section class="tf642-card"><h3>Koleksiyonum</h3><p class="tf642-muted">Favori rotalarını cihazında tut.</p><div class="tf642-collection">' + (collection.length ? collection.map(function (x) { return '<a class="tf642-result" href="' + esc(x.route) + '"><strong>' + esc(x.title) + '</strong><small>' + esc(x.route) + '</small></a>'; }).join('') : '<p class="tf642-muted">Henüz kayıt yok.</p>') + '</div><button class="dugme dugme-sade" data-tf642-save-current>Bu sayfayı koleksiyona ekle</button></section>' +
      '<section class="tf642-card tf642-actions"><button class="dugme dugme-sade" data-tf642-share>Bağlantıyı kopyala</button><a class="dugme dugme-sade" href="mailto:destek@tentifor.com?subject=TentiFor%206.4.2.1%20hata%20bildirimi">Hata bildir</a><span class="tf642-muted">Sürüm 6.4.2.1</span></section>';
    panel.querySelector('[data-tf642-search]').addEventListener('input', function (e) { renderSearch(e.target.value); });
    panel.querySelectorAll('[data-tf642-font]').forEach(function (button) { button.addEventListener('click', function () { state.fontScale = Math.max(.9, Math.min(1.3, state.fontScale + (button.dataset.tf642Font === '+' ? .1 : -.1))); save(); applyPrefs(); renderPanel(); }); });
    panel.querySelectorAll('[data-tf642-toggle]').forEach(function (button) { button.addEventListener('click', function () { var key = button.dataset.tf642Toggle; state[key] = !state[key]; save(); applyPrefs(); renderPanel(); }); });
    panel.querySelector('[data-tf642-reading]').addEventListener('click', function () { state.readingTheme = state.readingTheme === 'sepya' ? 'normal' : 'sepya'; save(); applyPrefs(); renderPanel(); });
    panel.querySelector('[data-tf642-save-current]').addEventListener('click', function () { var item = currentItem(); if (!state.collection.some(function (x) { return x.route === item.route; })) state.collection.unshift(item); state.collection = state.collection.slice(0, 30); save(); renderPanel(); });
    panel.querySelector('[data-tf642-share]').addEventListener('click', function () { copy(location.href); });
  }
  function mount() {
    if (document.querySelector('[data-tf642-panel]')) return;
    applyPrefs();
    var button = document.createElement('button');
    button.className = 'tf642-trigger'; button.type = 'button'; button.textContent = 'Kişisel merkez'; button.setAttribute('aria-label', 'Kişisel merkez ve erişilebilirlik araçlarını aç');
    var host = document.querySelector('.ust') || document.body; host.appendChild(button);
    panel = document.createElement('aside'); panel.className = 'tf642-panel'; panel.hidden = true; panel.dataset.tf642Panel = 'true'; panel.setAttribute('aria-label', 'Kişisel merkez');
    panel.innerHTML = '<div class="tf642-head"><div><span class="etiket">6.4.2.1</span><h2>Kişisel merkez</h2></div><button class="pencere-kapat" type="button" data-tf642-close aria-label="Kapat">×</button></div><div data-tf642-body></div>';
    document.body.appendChild(panel);
    button.addEventListener('click', openPanel); panel.querySelector('[data-tf642-close]').addEventListener('click', closePanel);
    panel.addEventListener('click', function (e) { if (e.target === panel) closePanel(); });
    window.addEventListener('online', renderPanel); window.addEventListener('offline', renderPanel);
    window.addEventListener('hashchange', setResume); window.addEventListener('popstate', setResume);
    document.addEventListener('keydown', function (e) { if (e.key === '?' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openPanel(); } if (e.key === 'Escape') closePanel(); });
    setResume();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.tf642 = { open: openPanel, close: closePanel, resetSearch: function () { searchIndex = null; }, version: '6.4.2.1' };
}());
