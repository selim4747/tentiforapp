/* Native startup 6.4.10: local-first, safe origin bridge, resumable live-site probe. */
(function (root) {
  'use strict';
  var LIVE_HOST = 'tentifor.com';
  var LIVE_ORIGIN = 'https://' + LIVE_HOST;
  var PROBE_TIMEOUT_MS = 2200;
  var CAPACITOR_WAIT_MS = 1500;
  var BRIDGE_PARAM = 'tf_bridge';
  var BRIDGE_VERSION = 1;
  var state = 'idle';
  var retryTimer = null;
  function localHost() {
    var host = String(root.location && root.location.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  }
  function nativeApp() {
    try {
      return !!(root.Capacitor && typeof root.Capacitor.isNativePlatform === 'function' && root.Capacitor.isNativePlatform());
    } catch (_) {
      return false;
    }
  }
  function safeStorage() { try { return root.localStorage; } catch (_) { return null; } }
  function hasAuthStorage() {
    var storage = safeStorage();
    if (!storage) return false;
    for (var i = 0; i < storage.length; i += 1) {
      var key = String(storage.key(i) || '').toLowerCase();
      if (/^sb-[a-z0-9-]+-auth-token$/.test(key) || /auth|token|session|password|secret/.test(key)) return true;
    }
    return false;
  }
  function bridgeKeyAllowed(key) {
    key = String(key || '');
    return /^(tentiforapp_|tf4_offline_queue_v1$)/.test(key) && !/(auth|token|session|password|secret|tf4_uyelik|tf4_bildirim)/i.test(key);
  }
  function encode(value) {
    try {
      var bytes = new TextEncoder().encode(JSON.stringify(value)), binary = '';
      for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (_) { return ''; }
  }
  function decode(value) {
    try {
      var text = String(value), binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4)), bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (_) { return null; }
  }
  function exportBridge() {
    var storage = safeStorage(), data = { v: BRIDGE_VERSION, keys: {}, queue: [] };
    if (!storage || hasAuthStorage()) return null;
    for (var i = 0; i < storage.length; i += 1) {
      var key = storage.key(i);
      if (bridgeKeyAllowed(key)) { var value = storage.getItem(key); if (value && value.length <= 16000) data.keys[key] = value; }
    }
    try { var queue = JSON.parse(storage.getItem('tf4_offline_queue_v1') || '[]'); data.queue = Array.isArray(queue) ? queue.slice(-100) : []; } catch (_) {}
    var encoded = encode(data);
    return encoded && encoded.length <= 48000 ? encoded : null;
  }
  function mergeQueue(existing, incoming) {
    var all = (Array.isArray(existing) ? existing : []).concat(Array.isArray(incoming) ? incoming : []), seen = {}, result = [];
    all.forEach(function (item) { if (item && item.id && !seen[item.id]) { seen[item.id] = true; result.push(item); } });
    return result.slice(-100);
  }
  function importBridge() {
    if (typeof URLSearchParams !== 'function') return;
    var params = new URLSearchParams(root.location.search || ''), encoded = params.get(BRIDGE_PARAM), data = encoded && decode(encoded), storage = safeStorage();
    if (!data || data.v !== BRIDGE_VERSION || !storage) return;
    Object.keys(data.keys || {}).forEach(function (key) { if (bridgeKeyAllowed(key) && !storage.getItem(key)) storage.setItem(key, String(data.keys[key])); });
    if (Array.isArray(data.queue)) {
      var current = []; try { current = JSON.parse(storage.getItem('tf4_offline_queue_v1') || '[]'); } catch (_) {}
      storage.setItem('tf4_offline_queue_v1', JSON.stringify(mergeQueue(current, data.queue)));
    }
    try { params.delete(BRIDGE_PARAM); root.history.replaceState(null, '', root.location.pathname + (params.toString() ? '?' + params.toString() : '') + root.location.hash); } catch (_) {}
    root.dispatchEvent(new CustomEvent('tf-native-origin-bridge-imported', { detail: { keys: Object.keys(data.keys || {}).length, queue: data.queue.length } }));
  }
  function hasUnsavedInput() {
    var active = root.document && root.document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return true;
    return !!(root.document && root.document.querySelector('[data-tf-unsaved="1"], [data-tf-dirty="1"]'));
  }
  function liveTarget() {
    var target = new URL(root.location.href); target.protocol = 'https:'; target.host = LIVE_HOST;
    var bridge = exportBridge(); if (bridge) target.searchParams.set(BRIDGE_PARAM, bridge);
    return target.href;
  }
  function emitBlocked(reason) { if (typeof root.dispatchEvent === 'function' && typeof CustomEvent === 'function') root.dispatchEvent(new CustomEvent('tf-native-live-blocked', { detail: { reason: reason } })); }
  function checkLiveSite() {
    if (state === 'pending' || state === 'done' || !localHost() || root.navigator.onLine === false || !nativeApp() || typeof root.Image !== 'function') return;
    if (hasAuthStorage()) { state = 'done'; emitBlocked('auth-session-local'); return; }
    if (hasUnsavedInput()) { emitBlocked('unsaved-input'); return; }
    state = 'pending'; var probe = new root.Image(), settled = false;
    var timer = root.setTimeout(function () { settle(false); }, PROBE_TIMEOUT_MS);
    function settle(reachable) {
      if (settled) return; settled = true; root.clearTimeout(timer); probe.onload = null; probe.onerror = null; probe.src = 'data:,';
      if (reachable && localHost() && nativeApp() && !hasAuthStorage() && !hasUnsavedInput()) { state = 'done'; root.location.replace(liveTarget()); }
      else { state = 'idle'; emitBlocked(reachable ? 'safe-point-required' : 'site-unreachable'); }
    }
    probe.onload = function () { settle(true); };
    probe.onerror = function () { settle(false); };
    probe.src = LIVE_ORIGIN + '/favicon.ico?apk-check=' + Date.now();
  }
  function retry(reason) { if (state === 'pending' || state === 'done') return; if (retryTimer) root.clearTimeout(retryTimer); retryTimer = root.setTimeout(function () { retryTimer = null; checkLiveSite(); }, reason === 'resume' ? 250 : 900); }
  function waitForNativeBridge() {
    if (!localHost()) return;
    var deadline = Date.now() + CAPACITOR_WAIT_MS;
    (function poll() {
      if (root.navigator.onLine === false) return;
      if (nativeApp()) {
        checkLiveSite();
        return;
      }
      if (Date.now() < deadline) root.setTimeout(poll, 50);
    }());
  }
  importBridge();
  root.TentiforNativeBridge = { retryLiveSite: function () { state = 'idle'; checkLiveSite(); }, status: function () { return state; } };
  if (typeof root.addEventListener === 'function') {
    root.addEventListener('online', function () { retry('online'); });
    root.addEventListener('resume', function () { retry('resume'); });
    root.addEventListener('capacitorResume', function () { retry('resume'); });
  }
  root.document && root.document.addEventListener('focusin', function () { if (state === 'idle') retry('focus'); });
  waitForNativeBridge();
}(window));
