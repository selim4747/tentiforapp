/* TentiforApp 6.3.12 — taşmasız profil ve bağlamlı alıntı paylaşımı. */
(function () {
  'use strict';
  var mounted = false;
  function clean(value, max) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 600); }
  function esc(value) { return clean(value, 600).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function shareUrl() { return window.location.href.split('#')[0] + window.location.hash; }
  async function copy(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(value);
    var area = document.createElement('textarea'); area.value = value; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(area); area.select(); var ok = false; try { ok = document.execCommand('copy'); } finally { area.remove(); }
    if (!ok) throw new Error('clipboard-unavailable');
  }
  async function deliver(payload, button) {
    if (button) button.disabled = true;
    try {
      if (navigator.share) { await navigator.share(payload); }
      else { await copy(payload.url + (payload.text ? '\n\n' + payload.text : '')); }
      if (button) { button.textContent = 'Paylaşıldı'; setTimeout(function () { if (button.isConnected) button.textContent = button.dataset.tf312Label || 'Paylaş'; }, 1800); }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      if (button) { button.textContent = 'Kopyala başarısız'; setTimeout(function () { if (button.isConnected) button.textContent = button.dataset.tf312Label || 'Paylaş'; }, 1800); }
    } finally { if (button) button.disabled = false; }
  }
  function button(label, kind, text, title) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'dugme dugme-sade tf312-share'; b.dataset.tf312Share = kind; b.dataset.tf312Text = clean(text, 600); b.dataset.tf312Title = clean(title, 140); b.dataset.tf312Label = label; b.textContent = label; b.setAttribute('aria-label', label + ': ' + clean(title, 100)); return b;
  }
  function profileButton(panel) {
    if (!panel || panel.querySelector('[data-tf312-share="profil"]')) return;
    var node = panel.querySelector('.hesap-kadi');
    var username = clean(node && node.textContent || '', 40).replace(/^@/, '');
    if (!username) return;
    var actions = panel.querySelector('.tf312-profile-actions');
    if (!actions) { actions = document.createElement('div'); actions.className = 'tf312-profile-actions'; panel.insertBefore(actions, panel.firstChild); }
    var b = button('Profilimi paylaş', 'profil', 'TentiforApp profili: @' + username, 'Profilim');
    b.dataset.tf312Url = window.location.href.split('#')[0] + '#/u/' + encodeURIComponent(username);
    actions.appendChild(b);
  }
  function mountProfiles() { document.querySelectorAll('.hesap-profil').forEach(profileButton); }
  function quoteScope(node) { return node && node.closest('.karakter-kart, .kisi-kart, .evr-kisi-sayfa, .fan-metin, .hikaye-metin, .detay-metin, .olay-kart, .kisa-hikaye-kart, [data-karakter], [data-hikaye]'); }
  function selectionTitle(scope) {
    if (!scope) return 'TentiforApp alıntısı';
    var heading = scope.querySelector('h1,h2,h3,h4,.olay-baslik,.kisi-bas b,.kisi-bas strong');
    return clean(heading && heading.textContent || 'TentiforApp alıntısı', 140);
  }
  function mountSelectionShare() {
    var selection = window.getSelection && window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    var text = clean(selection.toString(), 420); if (text.length < 10) return;
    var range = selection.getRangeAt(0), scope = quoteScope(range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement);
    if (!scope) return;
    var old = document.querySelector('[data-tf312-selection]'); if (old) old.remove();
    var box = document.createElement('div'); box.className = 'tf312-selection'; box.setAttribute('data-tf312-selection', '');
    var b = button('Alıntıyı paylaş', 'alinti', text, selectionTitle(scope)); b.dataset.tf312Url = shareUrl(); box.appendChild(b); document.body.appendChild(box);
    var rect = range.getBoundingClientRect(); box.style.left = Math.max(8, Math.min(window.innerWidth - 190, rect.left + window.scrollX)) + 'px'; box.style.top = Math.max(8, rect.bottom + window.scrollY + 8) + 'px';
  }
  document.addEventListener('mouseup', function () { setTimeout(mountSelectionShare, 0); });
  document.addEventListener('touchend', function () { setTimeout(mountSelectionShare, 80); }, { passive: true });
  document.addEventListener('click', function (event) {
    var b = event.target.closest && event.target.closest('[data-tf312-share]');
    if (!b) { if (!event.target.closest('[data-tf312-selection]')) { var old = document.querySelector('[data-tf312-selection]'); if (old) old.remove(); } return; }
    event.preventDefault();
    var url = b.dataset.tf312Url || shareUrl(), title = b.dataset.tf312Title || 'TentiforApp alıntısı', text = b.dataset.tf312Text || '';
    deliver({ title: title + ' — TentiforApp', text: text, url: url }, b);
  });
  function boot() {
    mountProfiles();
    if (mounted) return; mounted = true;
    new MutationObserver(function () { mountProfiles(); }).observe(document.body, { childList: true, subtree: true });
  }
  document.addEventListener('DOMContentLoaded', boot, { once: true });
  document.addEventListener('tf-veri-hazir', boot);
}());
