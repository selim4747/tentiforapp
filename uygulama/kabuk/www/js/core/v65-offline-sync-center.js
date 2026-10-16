/* TentiforApp 6.5.2 — çevrimdışı eşitleme merkezi. */
(function () {
  'use strict';
  var LAST_SUCCESS = 'tf65_offline_sync_last_success';
  var layerId = 'tf65SyncLayer';
  var resultMessage = '';
  var busy = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  function queue() { return window.tf4OfflineQueue || null; }
  function records() {
    try { return queue() && typeof queue().bekleyen === 'function' ? queue().bekleyen() : []; }
    catch (_) { return []; }
  }
  function ownerId() {
    try {
      var id = window.hesapKullanici && window.hesapKullanici.id;
      return id == null || id === '' ? null : String(id);
    } catch (_) { return null; }
  }
  function dateLabel(value) {
    var time = Number(value);
    if (!Number.isFinite(time) || time <= 0) return '—';
    try { return new Date(time).toLocaleString('tr-TR'); } catch (_) { return '—'; }
  }
  function lastSuccess() {
    try { return Number(localStorage.getItem(LAST_SUCCESS)) || 0; } catch (_) { return 0; }
  }
  function queueLabel(type) {
    var labels = { 'okuma-ilerleme': 'Okuma ilerlemesi', 'ayar': 'Ayar', 'evren-taslak': 'Evren taslağı' };
    return labels[type] || String(type || 'İşlem').slice(0, 80);
  }
  function recordStatus(item, currentOwner) {
    var recordOwner = item && item.sahipId != null && item.sahipId !== '' ? String(item.sahipId) : null;
    if (!recordOwner) return 'Hesap bilgisi yok · güvenlik için bekletiliyor';
    if (!currentOwner) return 'Giriş yaptığında eşitlenebilir';
    if (recordOwner !== currentOwner) return 'Başka hesaba ait · bu hesaba aktarılmaz';
    if (!navigator.onLine) return 'Bağlantı bekleniyor';
    return 'Bu hesaba ait · gönderilmeyi bekliyor';
  }
  function ensureButton() {
    var existing = document.getElementById('tf65SyncButton');
    if (existing) return existing;
    var wallet = document.querySelector('#cuzdanRozet');
    if (!wallet || !wallet.parentNode) return null;
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'tf65SyncButton';
    button.className = 'ust-ikon tf65-sync-button';
    button.setAttribute('data-tf65-sync-open', '1');
    button.innerHTML = '<span aria-hidden="true">⇅</span><span class="tf65-sync-badge" data-tf65-sync-count hidden></span>';
    wallet.insertAdjacentElement('afterend', button);
    return button;
  }
  function updateBadge() {
    var button = ensureButton();
    if (!button) return;
    var count = records().length;
    var badge = button.querySelector('[data-tf65-sync-count]');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = count === 0;
    }
    button.title = count ? count + ' bekleyen çevrimdışı işlem · eşitleme merkezini aç' : 'Çevrimdışı eşitleme merkezini aç';
    button.setAttribute('aria-label', count ? count + ' bekleyen çevrimdışı işlem. Eşitleme merkezini aç.' : 'Çevrimdışı eşitleme merkezini aç.');
  }
  function panelHtml() {
    var list = records();
    var user = ownerId();
    var online = navigator.onLine !== false;
    var rows = list.slice(0, 40).map(function (item) {
      return '<li class="tf65-sync-row"><div><b>' + escapeHtml(queueLabel(item && item.tur)) + '</b><span>' + escapeHtml(recordStatus(item, user)) + '</span></div><time>' + escapeHtml(dateLabel(item && item.olusturuldu)) + '</time></li>';
    }).join('');
    var remainder = list.length > 40 ? '<p class="oyun-not">İlk 40 kayıt gösteriliyor; toplam ' + list.length + ' kayıt var.</p>' : '';
    var status = resultMessage || (!online ? 'Çevrimdışı: işlemler cihazında bekliyor.' : !user && list.length ? 'Gönderim için hesabına giriş yap.' : list.length ? 'Gönderime hazır kayıtlar aşağıda.' : 'Bekleyen işlem yok.');
    return '<div class="tf65-sync-backdrop" data-tf65-sync-backdrop><section class="tf65-sync-panel kutu-y" role="dialog" aria-modal="true" aria-labelledby="tf65SyncTitle" tabindex="-1">' +
      '<header class="tf65-sync-head"><div><span class="oyun-etiket">6.5 · Çevrimdışı</span><h2 id="tf65SyncTitle">Eşitleme merkezi</h2></div><button type="button" class="pencere-kapat" data-tf65-sync-close aria-label="Kapat">✕</button></header>' +
      '<p class="tf65-sync-status" role="status" aria-live="polite">' + escapeHtml(status) + '</p>' +
      '<div class="tf65-sync-summary"><span><b>' + list.length + '</b> bekleyen işlem</span><span>Son başarılı eşitleme: ' + escapeHtml(dateLabel(lastSuccess())) + '</span><span>' + (online ? 'Bağlantı var' : 'Çevrimdışı') + '</span></div>' +
      (list.length ? '<ul class="tf65-sync-list">' + rows + '</ul>' + remainder : '<p class="oyun-not tf65-sync-empty">Kuyruk temiz. Yeni çevrimdışı işlemler burada görünür.</p>') +
      '<footer class="oyun-sira tf65-sync-actions"><button type="button" class="dugme" data-tf65-sync-retry' + (busy || !online || !user || !list.length ? ' disabled' : '') + '>' + (busy ? 'Eşitleniyor…' : 'Şimdi eşitle') + '</button><span class="oyun-not">Hesaplar arası kayıt aktarılmaz; işlem içerikleri bu listede gösterilmez.</span></footer>' +
      '</section></div>';
  }
  function renderPanel() {
    var layer = document.getElementById(layerId);
    if (layer) layer.innerHTML = panelHtml();
    updateBadge();
  }
  function open() {
    if (document.getElementById(layerId)) { close(); return; }
    var layer = document.createElement('div');
    layer.id = layerId;
    document.body.appendChild(layer);
    renderPanel();
    var panel = layer.querySelector('.tf65-sync-panel');
    var closeButton = layer.querySelector('[data-tf65-sync-close]');
    if (panel) panel.focus({ preventScroll: true });
    if (closeButton) closeButton.focus({ preventScroll: true });
  }
  function close() {
    var layer = document.getElementById(layerId);
    if (layer) layer.remove();
    var button = document.getElementById('tf65SyncButton');
    if (button) button.focus({ preventScroll: true });
  }
  async function retry() {
    if (busy) return;
    if (navigator.onLine === false) { resultMessage = 'İnternet bağlantısı geldiğinde yeniden dene.'; renderPanel(); return; }
    if (!ownerId()) { resultMessage = 'Eşitlemeden önce hesabına giriş yap.'; renderPanel(); return; }
    var transport = window.tf4OfflineTransport;
    if (typeof transport !== 'function' || !queue() || typeof queue().gonder !== 'function') {
      resultMessage = 'Eşitleme servisi henüz hazır değil.'; renderPanel(); return;
    }
    busy = true;
    resultMessage = 'Bekleyen kayıtlar güvenli biçimde deneniyor…';
    renderPanel();
    try {
      var result = await queue().gonder(transport, { zorla: true });
      if (result && Number(result.gonderildi) > 0) {
        try { localStorage.setItem(LAST_SUCCESS, String(Date.now())); } catch (_) {}
      }
      resultMessage = result ? result.gonderildi + ' gönderildi · ' + result.kalan + ' bekliyor.' : 'Eşitleme tamamlandı.';
    } catch (error) {
      resultMessage = 'Eşitleme tamamlanamadı: ' + String(error && error.message || error).slice(0, 160);
    } finally {
      busy = false;
      renderPanel();
    }
  }
  function handleClick(event) {
    var openButton = event.target.closest && event.target.closest('[data-tf65-sync-open]');
    if (openButton) { event.preventDefault(); open(); return; }
    if (event.target.closest && event.target.closest('[data-tf65-sync-close]')) { event.preventDefault(); close(); return; }
    if (event.target.closest && event.target.closest('[data-tf65-sync-retry]')) { event.preventDefault(); retry(); return; }
    if (event.target && event.target.matches && event.target.matches('[data-tf65-sync-backdrop]')) close();
  }
  function handleKeydown(event) {
    var layer = document.getElementById(layerId);
    if (!layer) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    var focusable = layer.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) { event.preventDefault(); return; }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function mount() { updateBadge(); }
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('tf4-offline-queue-change', renderPanel);
  window.addEventListener('tf4-offline-sync-result', function (event) {
    var result = event.detail || {};
    if (Number(result.gonderildi) > 0) { try { localStorage.setItem(LAST_SUCCESS, String(Date.now())); } catch (_) {} }
    resultMessage = Number(result.gonderildi) > 0 ? result.gonderildi + ' işlem eşitlendi.' : resultMessage;
    renderPanel();
  });
  window.addEventListener('online', renderPanel);
  window.addEventListener('offline', renderPanel);
  window.addEventListener('storage', function (event) { if (!event.key || event.key === 'tf4_offline_queue_v1') renderPanel(); });
  window.addEventListener('tf-veri-hazir', mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  window.tf65OfflineSyncCenter = { open: open, close: close, refresh: renderPanel, retry: retry };
}());
