/* TentiFor 6.4.5 — okuma devamlılığı, keşif, paylaşım ve gerçek cihaz oturumları. */
(function () {
  'use strict';
  var KEY = 'tentiforapp_645_ux';
  var state = {};
  var deviceTimer = 0;
  var scrollTimer = 0;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]); }); }
  function load() { try { state = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { state = {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function route() { return location.hash || '#/arsiv'; }
  function isReading() { return !!document.querySelector('.okuma-metin, .uzun-metin, .evs-roman, .fan-metin, #evrenSayfa'); }
  function announce(text, type) { if (typeof window.tfUxBildirim === 'function') window.tfUxBildirim(text, type || 'bilgi'); else if (typeof window.eckaBildir === 'function') window.eckaBildir(text); }
  function readingPosition() {
    if (!isReading()) return;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    state.resume = { route: route(), title: document.title, percent: Math.max(0, Math.min(100, Math.round(window.scrollY / max * 100))), savedAt: new Date().toISOString() };
    save();
  }
  function restorePosition() {
    var r = state.resume;
    if (!r || r.route !== route() || typeof r.percent !== 'number' || r.percent < 2) return;
    setTimeout(function () { var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); window.scrollTo(0, Math.round(max * r.percent / 100)); }, 180);
  }
  function addReadingActions() {
    var bar = document.querySelector('#tf644ReadingToolbar');
    if (!bar || bar.querySelector('[data-tf645-share-reading]')) return;
    var share = document.createElement('button'); share.type = 'button'; share.className = 'ic-bag'; share.dataset.tf645ShareReading = '1'; share.textContent = 'Okuma kartını paylaş';
    bar.appendChild(share);
    var saveButton = bar.querySelector('[data-tf644-reading="save"]');
    if (saveButton) saveButton.addEventListener('click', function () { readingPosition(); });
  }
  async function shareReading(button) {
    readingPosition();
    var title = document.title || 'TentiFor okuma kartı';
    var text = title + '\n' + 'TentiFor’da okuduğum yer: %' + String(state.resume && state.resume.percent || 0) + '\n' + location.href;
    try {
      if (navigator.share) await navigator.share({ title: title, text: text, url: location.href });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
      else window.prompt('Okuma kartını kopyala:', text);
      button.textContent = 'Kart hazır'; announce('Okuma kartı paylaşım için hazır', 'basari');
    } catch (e) { if (!e || e.name !== 'AbortError') announce('Okuma kartı hazırlanamadı', 'hata'); }
    setTimeout(function () { if (button.isConnected) button.textContent = 'Okuma kartını paylaş'; }, 1600);
  }
  function enhanceSearch() {
    var input = document.querySelector('[data-tf642-search], #tf642-search');
    if (!input || input.dataset.tf645Ready === '1') return;
    input.dataset.tf645Ready = '1'; input.setAttribute('aria-keyshortcuts', 'Control+K Meta+K');
    var box = input.parentElement;
    if (!box) return;
    var filters = document.createElement('div'); filters.className = 'tf645-search-filters'; filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Arama türü');
    filters.innerHTML = '<button type="button" class="ic-bag secili" data-tf645-filter="hepsi">Tümü</button><button type="button" class="ic-bag" data-tf645-filter="Evren">Evrenler</button><button type="button" class="ic-bag" data-tf645-filter="Karakter">Karakterler</button><button type="button" class="ic-bag" data-tf645-filter="İçerik">İçerikler</button>';
    input.after(filters);
    input.addEventListener('input', function () { var q = input.value.trim(); if (q) { state.searches = [q].concat((state.searches || []).filter(function (x) { return x.toLocaleLowerCase('tr') !== q.toLocaleLowerCase('tr'); })).slice(0, 8); save(); } });
    filters.addEventListener('click', function (e) { var b = e.target.closest('[data-tf645-filter]'); if (!b) return; filters.querySelectorAll('button').forEach(function (x) { x.classList.toggle('secili', x === b); }); var kind = b.dataset.tf645Filter; document.querySelectorAll('[data-tf642-results] .tf642-result').forEach(function (x) { x.hidden = kind !== 'hepsi' && (x.textContent || '').indexOf(kind) < 0; }); });
  }
  function keyboardSearch(e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { var input = document.querySelector('[data-tf642-search], #tf642-search'); if (input) { e.preventDefault(); input.focus(); } } }
  function deviceName() { var ua = navigator.userAgent || ''; var os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Cihaz'; var browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'tarayıcı'; return os + ' · ' + browser; }
  function deviceId() { try { var k = 'tentiforapp_cihaz_id', v = localStorage.getItem(k); if (!v) { v = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem(k, v); } return v; } catch (_) { return 'gecici'; } }
  async function devices() {
    if (typeof hesapIstemci === 'undefined' || !hesapIstemci || typeof hesapKullanici === 'undefined' || !hesapKullanici) return;
    var result = await hesapIstemci.rpc('cihaz_heartbeat', { p_cihaz: deviceId(), p_ad: deviceName(), p_platform: navigator.platform || '' });
    if (result && result.error) return;
    var list = await hesapIstemci.rpc('cihazlarim', { p_cihaz: deviceId() });
    if (list && !list.error) renderDevices(list.data);
  }
  function renderDevices(data) {
    var root = document.querySelector('.cihazlarim'); if (!root) return;
    var rows = Array.isArray(data && data.cihazlar) ? data.cihazlar : [];
    var count = Number(data && data.aktif) || 0;
    root.innerHTML = '<summary><b>Oturum açılan cihazlar</b> · ' + count + ' aktif</summary>' + (rows.length ? '<ul>' + rows.map(function (x) { return '<li><b>' + esc(x.ad || 'Cihaz') + '</b>' + (x.bu_mu ? ' · bu cihaz' : '') + '<span class="oyun-not"> · son görülme ' + esc(x.son_gorulme ? new Date(x.son_gorulme).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '?') + '</span></li>'; }).join('') + '</ul>' : '<p class="oyun-not">Aktif cihaz bulunamadı.</p>') + '<p class="oyun-not">Aktif sayı, son 15 dakikadaki gerçek kalp atışlarından hesaplanır.</p>';
  }
  function conflictDialog() {
    var remote = typeof hesapCatismaUzak !== 'undefined' ? hesapCatismaUzak : null;
    var local = typeof hesapAnlikGoruntu === 'function' ? hesapAnlikGoruntu() : {};
    var rows = remote && remote.veri && window.tf4Cakisma ? window.tf4Cakisma.fark(local, remote.veri, {}) : [];
    var html = '<div class="pencere tf645-conflict-dialog" role="dialog" aria-modal="true"><button class="pencere-kapat" data-tf645-close aria-label="Kapat">×</button><h3>Eşitleme çakışmasını incele</h3><p class="pencere-alt">Bu cihaz ve hesap farklı kayıtlar içeriyor. Önce karşılaştır, sonra eşitleme seçimini yap.</p>';
    html += rows.length ? '<div class="tf645-conflict-grid"><b>Alan</b><b>Bu cihaz</b><b>Hesap</b>' + rows.map(function (r) { return '<span>' + esc(r.alan) + '</span><code>' + esc(JSON.stringify(r.yerel)) + '</code><code>' + esc(JSON.stringify(r.uzak)) + '</code>'; }).join('') + '</div>' : '<p class="oyun-not">Karşılaştırılacak çakışma ayrıntısı henüz yüklenmedi.</p>';
    html += '<div class="oyun-sira"><button class="dugme dugme-sade" data-hesap-catisma="uzak">Hesaptakini kullan</button><button class="dugme dugme-sade" data-hesap-catisma="yerel">Bu cihazdakini kullan</button></div></div>';
    var host = document.querySelector('#perde'); if (!host) return; host.innerHTML = html; host.hidden = false;
  }
  function syncConflict() {
    var card = document.querySelector('.tf-esitleme-yeni, .hesap-esit'); if (!card || card.querySelector('[data-tf645-conflict]')) return;
    var button = document.createElement('button'); button.type = 'button'; button.className = 'dugme dugme-sade'; button.dataset.tf645Conflict = '1'; button.textContent = 'Çakışmayı incele'; card.appendChild(button);
  }
  function enhanceSearchShortcut() {
    var nav = document.querySelector('#gezinme'); if (!nav) return;
    var button = nav.querySelector('#komutTetikBtn');
    if (!button) {
      button = document.createElement('button'); button.type = 'button'; button.id = 'komutTetikBtn'; button.className = 'gez-btn gez-ara';
      button.setAttribute('aria-label', 'Hızlı arama'); button.title = 'Hızlı ara · Ctrl/⌘ K';
      button.innerHTML = '<span aria-hidden="true">⌕</span> <span>Ara</span>';
      var contents = nav.querySelector('#icindekilerBtn');
      if (contents) contents.insertAdjacentElement('afterend', button); else nav.insertBefore(button, nav.firstChild);
    }
  }
  function enhanceArchiveSearch() {
    var section = document.querySelector('#arsiv'), grid = document.querySelector('#karakterIzgara');
    var heading = section && section.querySelector('.bolum-basi'); if (!heading || !grid) return;
    var wrap = document.querySelector('#tf654ArchiveSearch');
    if (!wrap) {
      wrap = document.createElement('div'); wrap.id = 'tf654ArchiveSearch'; wrap.className = 'tf654-archive-search';
      wrap.innerHTML = '<label for="tf654CharacterQuery">Karakter ara</label><input id="tf654CharacterQuery" type="search" autocomplete="off" spellcheck="false" placeholder="Ad, unvan veya kısa tanım"><span class="tf654-archive-count" role="status" aria-live="polite"></span>';
      heading.insertAdjacentElement('afterend', wrap);
    }
    var input = wrap.querySelector('input'), status = wrap.querySelector('.tf654-archive-count');
    if (!input) return;
    function filterCards() {
      var query = input.value.trim().toLocaleLowerCase('tr-TR');
      var cards = Array.prototype.slice.call(grid.querySelectorAll('.kart[data-karakter]'));
      var visible = 0;
      cards.forEach(function (card) { var match = !query || (card.textContent || '').toLocaleLowerCase('tr-TR').indexOf(query) !== -1; card.hidden = !match; if (match) visible++; });
      if (status) status.textContent = query ? (visible ? visible + ' / ' + cards.length + ' eşleşme' : 'Eşleşme bulunamadı') : cards.length + ' karakter';
    }
    if (input.dataset.tf654Ready !== '1') { input.dataset.tf654Ready = '1'; input.addEventListener('input', filterCards); }
    filterCards();
  }
  function enhanceCharacterModal() {
    var modal = document.querySelector('#perde .pencere');
    if (!modal || !modal.querySelector('[data-oku^="kar:"]')) return;
    var badge = modal.querySelector('.rozet-kutu'); if (!badge) return;
    modal.classList.add('tf654-character-modal');
    var list = badge.querySelector('.rozet-liste');
    if (list && !list.closest('.tf654-rozet-list-toggle')) {
      var detail = document.createElement('details'); detail.className = 'tf654-rozet-list-toggle';
      var summary = document.createElement('summary'); summary.textContent = 'Okuma listesi · ' + list.querySelectorAll('li').length + ' kutu';
      detail.appendChild(summary); list.parentNode.insertBefore(detail, list); detail.appendChild(list);
      var hasOpenState = Object.prototype.hasOwnProperty.call(modal.dataset, 'tf654BadgeOpen');
      detail.open = hasOpenState ? modal.dataset.tf654BadgeOpen === '1' : list.querySelectorAll('li').length <= 4;
      detail.addEventListener('toggle', function () { modal.dataset.tf654BadgeOpen = detail.open ? '1' : '0'; });
      modal.dataset.tf654BadgeOpen = detail.open ? '1' : '0';
    }
    if (list) list.querySelectorAll('li').forEach(function (row) { row.classList.add('tf654-badge-row'); var link = row.querySelector('a'); if (link) link.classList.add('tf654-badge-link'); });
    var bar = modal.querySelector('.tf654-modal-tools');
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'tf654-modal-tools'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Karakter penceresi araçları');
      var back = modal.querySelector('.pencere-geri'), close = modal.querySelector('.pencere-kapat');
      if (back) bar.appendChild(back);
      var progress = document.createElement('span'); progress.className = 'tf654-modal-progress'; progress.dataset.tf654Progress = '1'; progress.setAttribute('role', 'status'); progress.setAttribute('aria-live', 'polite'); bar.appendChild(progress);
      var jump = document.createElement('button'); jump.type = 'button'; jump.className = 'tf654-modal-jump'; jump.dataset.tf654RozetJump = '1'; jump.textContent = 'Kutular'; jump.setAttribute('aria-label', 'Okuma kutularını göster'); bar.appendChild(jump);
      if (close) bar.appendChild(close);
      modal.insertBefore(bar, modal.firstChild);
    }
    var source = badge.querySelector('.oyun-etiket'), progressText = bar.querySelector('[data-tf654-progress]');
    var nextText = source ? source.textContent.trim() : '';
    if (progressText && nextText && progressText.textContent !== nextText) progressText.textContent = nextText;
  }
  function watchDynamicUi() {
    var grid = document.querySelector('#karakterIzgara');
    if (grid && grid.dataset.tf654Observed !== '1' && typeof MutationObserver === 'function') {
      grid.dataset.tf654Observed = '1'; new MutationObserver(enhanceArchiveSearch).observe(grid, { childList: true, subtree: true });
    }
    var host = document.querySelector('#perde');
    if (host && host.dataset.tf654Observed !== '1' && typeof MutationObserver === 'function') {
      host.dataset.tf654Observed = '1'; new MutationObserver(enhanceCharacterModal).observe(host, { childList: true, subtree: true });
    }
  }
  function refresh() { addReadingActions(); enhanceSearch(); enhanceSearchShortcut(); enhanceArchiveSearch(); enhanceCharacterModal(); watchDynamicUi(); syncConflict(); devices().catch(function () {}); }

  function boot() { load(); refresh(); restorePosition(); if (!deviceTimer) deviceTimer = setInterval(function () { devices().catch(function () {}); }, 5 * 60 * 1000); }
  window.addEventListener('scroll', function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(readingPosition, 600); }, { passive: true });
  document.addEventListener('click', function (e) {
    var tools = document.querySelector('#ustAraclar'), toggle = e.target.closest && e.target.closest('[data-tf654-tools-toggle]');
    if (toggle && tools) { var open = !tools.classList.contains('acik'); tools.classList.toggle('acik', open); toggle.setAttribute('aria-expanded', String(open)); return; }
    if (tools && !e.target.closest('#ustAraclar')) { tools.classList.remove('acik'); var toolToggle = tools.querySelector('[data-tf654-tools-toggle]'); if (toolToggle) toolToggle.setAttribute('aria-expanded', 'false'); }
    else if (tools && e.target.closest('#ustAraclarPanel')) { tools.classList.remove('acik'); var panelToggle = tools.querySelector('[data-tf654-tools-toggle]'); if (panelToggle) panelToggle.setAttribute('aria-expanded', 'false'); }
    if (e.target.closest && e.target.closest('[data-tf654-rozet-jump]')) { var pane = document.querySelector('#perde .pencere'), target = pane && pane.querySelector('.tf654-rozet-list-toggle'); if (target) { target.open = true; if (pane) pane.dataset.tf654BadgeOpen = '1'; if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'start', behavior: 'smooth' }); } return; }
    var b = e.target.closest && e.target.closest('[data-tf645-share-reading]'); if (b) { shareReading(b); return; } if (e.target.closest && e.target.closest('[data-tf645-conflict]')) { conflictDialog(); return; } if (e.target.closest && e.target.closest('[data-tf645-close]')) { var p = document.querySelector('#perde'); if (p) { p.hidden = true; p.innerHTML = ''; } }
  });
  document.addEventListener('keydown', keyboardSearch);
  document.addEventListener('DOMContentLoaded', boot); document.addEventListener('tf-veri-hazir', refresh); document.addEventListener('tf-hesap-hazir', refresh); window.addEventListener('hashchange', function () { setTimeout(function () { refresh(); restorePosition(); }, 120); });
  window.tf645 = { refresh: refresh, devices: devices, version: '6.5.6' };
}());
