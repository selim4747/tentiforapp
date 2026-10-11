/* TentiFor 6.4.4 — dayanıklı UX, okuma araçları ve kişisel akışlar. */
(function () {
  'use strict';
  var KEY = 'tentiforapp_644_ux';
  var defaults = { onboarding: { steps: [] }, reading: { scale: 1, sepya: false }, recentSearches: [], wizardDraft: {} };
  var state = load();
  var timer = 0;
  function read() { try { var raw = JSON.parse(localStorage.getItem(KEY) || '{}'); return raw && typeof raw === 'object' ? raw : {}; } catch (_) { return {}; } }
  function load() { var raw = read(); return { onboarding: raw.onboarding && Array.isArray(raw.onboarding.steps) ? { steps: raw.onboarding.steps.filter(function (x) { return Number.isInteger(x) && x >= 0 && x < 20; }) } : { steps: [] }, reading: { scale: Math.max(.9, Math.min(1.3, Number(raw.reading && raw.reading.scale) || 1)), sepya: !!(raw.reading && raw.reading.sepya) }, recentSearches: Array.isArray(raw.recentSearches) ? raw.recentSearches.filter(function (x) { return typeof x === 'string' && x.trim(); }).slice(0, 8) : [], wizardDraft: raw.wizardDraft && typeof raw.wizardDraft === 'object' ? raw.wizardDraft : {} }; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]); }); }
  function announce(text, type) { if (typeof window.tfUxBildirim === 'function') window.tfUxBildirim(text, type || 'bilgi'); else if (typeof window.eckaBildir === 'function') window.eckaBildir(text); }
  function find(selector) { return document.querySelector(selector); }
  function onboarding() {
    var box = find('.tf64-onboarding');
    if (!box || box.dataset.tf644Ready === '1') return;
    box.dataset.tf644Ready = '1';
    var checks = Array.prototype.slice.call(box.querySelectorAll('[data-tf64-step]'));
    checks.forEach(function (input) { input.checked = state.onboarding.steps.indexOf(Number(input.dataset.tf64Step)) >= 0; });
    var progress = document.createElement('div'); progress.className = 'tf644-progress'; progress.setAttribute('role', 'status'); progress.setAttribute('aria-live', 'polite'); box.querySelector('ol') && box.querySelector('ol').before(progress);
    function update() {
      var done = checks.filter(function (x) { return x.checked; }).length;
      progress.textContent = done + ' / ' + checks.length + ' adım tamamlandı';
      progress.style.setProperty('--tf644-progress', (checks.length ? done / checks.length * 100 : 0) + '%');
      state.onboarding.steps = checks.filter(function (x) { return x.checked; }).map(function (x) { return Number(x.dataset.tf64Step); }); save();
    }
    checks.forEach(function (input) { input.addEventListener('change', update); });
    update();
  }
  function readingToolbar() {
    if (!/^#\/(okuma|ev|fan|evren)/.test(location.hash || '') && !find('.okuma-metin, .uzun-metin, .evs-roman, .fan-metin')) return;
    if (find('#tf644ReadingToolbar')) return;
    var host = find('#okuma') || find('#evrenSayfa') || find('main'); if (!host) return;
    var bar = document.createElement('div'); bar.id = 'tf644ReadingToolbar'; bar.className = 'tf644-reading-toolbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Okuma araçları');
    bar.innerHTML = '<span class="tf644-reading-label">Okuma araçları</span><button type="button" data-tf644-reading="minus" aria-label="Yazıyı küçült">A−</button><button type="button" data-tf644-reading="plus" aria-label="Yazıyı büyüt">A+</button><button type="button" data-tf644-reading="sepya" aria-pressed="' + (state.reading.sepya ? 'true' : 'false') + '">Sepya</button><button type="button" data-tf644-reading="save">Kaldığım yeri kaydet</button><span class="tf644-reading-status" data-tf644-reading-status></span>';
    host.insertBefore(bar, host.firstChild);
    applyReading();
  }
  function applyReading() { document.documentElement.style.setProperty('--tf644-reading-scale', String(state.reading.scale)); document.documentElement.toggleAttribute('data-tf644-sepya', state.reading.sepya); var b = find('#tf644ReadingToolbar [data-tf644-reading="sepya"]'); if (b) b.setAttribute('aria-pressed', state.reading.sepya ? 'true' : 'false'); }
  function breadcrumb() {
    var main = find('main'); if (!main || !location.hash || location.hash === '#/' || location.hash === '#/arsiv') { var old = find('#tf644Breadcrumb'); if (old) old.remove(); return; }
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean); if (!parts.length) return;
    var labels = { sen: 'Sen', defter: 'Defterin', fan: 'Keşif', atolye: 'Evren Atölyesi', okuma: 'Okuma', oyunlar: 'Oyunlar', arsiv: 'Arşiv', ev: 'Evren', proje: 'Proje', belgeler: 'Belgeler' };
    var old = find('#tf644Breadcrumb'); if (old && old.dataset.tf644Route === location.hash) return; if (old) old.remove();
    var nav = document.createElement('nav'); nav.id = 'tf644Breadcrumb'; nav.className = 'tf644-breadcrumb'; nav.setAttribute('aria-label', 'Sayfa yolu');
    nav.dataset.tf644Route = location.hash;
    nav.innerHTML = '<a href="#/arsiv">Ana sayfa</a>' + parts.map(function (p, i) { var label = labels[p] || decodeURIComponent(p).replace(/[-_]/g, ' '); return '<span aria-hidden="true">›</span><span' + (i === parts.length - 1 ? ' aria-current="page"' : '') + '>' + esc(label) + '</span>'; }).join('');
    var heading = find('#sayfaBasi') || main.firstElementChild; if (heading) heading.after(nav); else main.prepend(nav);
  }
  function searchEnhancement() {
    var input = find('#tf642-search, [data-tf642-search]'); if (!input || input.dataset.tf644Ready === '1') return;
    input.dataset.tf644Ready = '1'; input.setAttribute('aria-describedby', 'tf644SearchHint');
    var hint = document.createElement('small'); hint.id = 'tf644SearchHint'; hint.className = 'tf644-search-hint'; hint.textContent = 'Enter ile sonucu aç · Esc ile temizle'; input.after(hint);
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); } if (e.key === 'Enter') { var first = find('[data-tf642-results] a, [data-tf642-results] button'); if (first) first.click(); } });
    input.addEventListener('change', function () { var q = input.value.trim(); if (!q) return; state.recentSearches = [q].concat(state.recentSearches.filter(function (x) { return x.toLocaleLowerCase('tr') !== q.toLocaleLowerCase('tr'); })).slice(0, 8); save(); });
  }
  function wizardDraft() {
    var form = find('#tf51-wizard-form, #tf61-wizard-form'); if (!form || form.dataset.tf644Ready === '1') return;
    form.dataset.tf644Ready = '1';
    var fields = Array.prototype.slice.call(form.querySelectorAll('input, textarea, select')).filter(function (x) { return x.type !== 'submit' && x.type !== 'button'; });
    fields.forEach(function (field) { var key = field.id || field.name; if (key && state.wizardDraft[key] && !field.value) field.value = state.wizardDraft[key]; field.addEventListener('input', function () { if (key) { state.wizardDraft[key] = field.value; save(); } }); });
    var status = document.createElement('small'); status.className = 'tf644-draft-status'; status.textContent = Object.keys(state.wizardDraft).length ? 'Taslak bu cihazda geri yüklendi.' : 'İlerledikçe taslak otomatik kaydedilir.'; form.insertBefore(status, form.firstChild);
    form.addEventListener('submit', function () { state.wizardDraft = {}; save(); });
  }
  function syncConflict() {
    var card = find('.tf-esitleme-yeni'); if (!card || card.querySelector('[data-tf644-conflict]')) return;
    var button = document.createElement('button'); button.type = 'button'; button.className = 'dugme dugme-sade'; button.dataset.tf644Conflict = '1'; button.textContent = 'Çakışmayı incele'; card.querySelector('.dugme') && card.querySelector('.dugme').after(button);
  }
  function notificationTools() {
    var area = find('#bildirimAlan'); if (!area || area.querySelector('[data-tf644-read-all]')) return;
    var list = area.querySelector('.bildirim-liste, .v54-bildirim-kutu'); if (!list) return;
    var actions = document.createElement('div'); actions.className = 'tf644-notification-actions'; actions.innerHTML = '<button type="button" class="ic-bag" data-tf644-read-all>Tümünü okundu işaretle</button><span data-tf644-notification-status role="status"></span>'; area.insertBefore(actions, area.firstChild);
  }
  function refresh() { clearTimeout(timer); timer = setTimeout(function () { onboarding(); readingToolbar(); breadcrumb(); searchEnhancement(); wizardDraft(); syncConflict(); notificationTools(); }, 80); }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-tf644-reading], [data-tf644-conflict], [data-tf644-read-all]'); if (!t) return;
    if (t.dataset.tf644Reading) {
      var action = t.dataset.tf644Reading;
      if (action === 'minus') state.reading.scale = Math.max(.9, state.reading.scale - .1);
      if (action === 'plus') state.reading.scale = Math.min(1.3, state.reading.scale + .1);
      if (action === 'sepya') state.reading.sepya = !state.reading.sepya;
      if (action === 'save') { state.resume = { route: location.hash, title: document.title, savedAt: new Date().toISOString() }; announce('Okuma konumu kaydedildi', 'basari'); }
      save(); applyReading(); var status = find('[data-tf644-reading-status]'); if (status) status.textContent = action === 'save' ? 'Kaydedildi' : 'Yazı ayarı güncellendi'; return;
    }
    if (t.dataset.tf644Conflict) { announce('Başka cihazdaki ilerleme bulundu. Tekrar eşitle düğmesiyle güvenli birleştirme başlatabilirsin.', 'bilgi'); return; }
    if (t.dataset.tf644ReadAll) { var status = find('[data-tf644-notification-status]'); if (typeof window.bildirimleriOkundu === 'function') window.bildirimleriOkundu(); else if (status) status.textContent = 'Bildirimler bu cihazda okundu olarak işaretlendi.'; announce('Bildirim merkezi güncellendi', 'basari'); }
  });
  document.addEventListener('DOMContentLoaded', refresh); window.addEventListener('hashchange', refresh); window.addEventListener('online', refresh); window.addEventListener('offline', refresh);
  if (typeof MutationObserver === 'function') { new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true }); }
}());
