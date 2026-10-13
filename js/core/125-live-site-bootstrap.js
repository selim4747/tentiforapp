/* Native startup: keep the packaged shell as an offline fallback, but prefer the live site when reachable. */
(function (root) {
  'use strict';

  var LIVE_HOST = 'tentifor.com';
  var LIVE_ORIGIN = 'https://' + LIVE_HOST;
  var PROBE_TIMEOUT_MS = 2200;
  var CAPACITOR_WAIT_MS = 1500;
  var started = false;

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

  function liveTarget() {
    var target = new URL(root.location.href);
    target.protocol = 'https:';
    target.host = LIVE_HOST;
    return target.href;
  }

  function checkLiveSite() {
    if (started || !localHost() || root.navigator.onLine === false || !nativeApp() || typeof root.Image !== 'function') return;
    started = true;

    var probe = new root.Image();
    var settled = false;
    var timer = root.setTimeout(function () {
      settle(false);
    }, PROBE_TIMEOUT_MS);

    function settle(reachable) {
      if (settled) return;
      settled = true;
      root.clearTimeout(timer);
      probe.onload = null;
      probe.onerror = null;
      probe.src = 'data:,';
      if (reachable && localHost() && nativeApp()) root.location.replace(liveTarget());
    }

    probe.onload = function () { settle(true); };
    probe.onerror = function () { settle(false); };
    probe.src = LIVE_ORIGIN + '/favicon.ico?apk-check=' + Date.now();
  }

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

  waitForNativeBridge();
}(window));
