/* TentiforApp 6.0 native bridge: safe no-op on ordinary web/PWA. */
(function () {
  'use strict';
  var nativePlugin = function () {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TentiforNative;
  };
  var isNative = function () {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  };
  var notify = function (message) {
    if (typeof window.eckaBildir === 'function') window.eckaBildir(message);
    else if (typeof window.alert === 'function') window.alert(message);
  };
  window.TentiforNative6 = {
    available: isNative,
    capabilities: function () {
      var plugin = nativePlugin();
      return plugin && plugin.capabilities ? plugin.capabilities() : Promise.resolve({});
    },
    authenticate: function () {
      var plugin = nativePlugin();
      if (!plugin || !plugin.authenticate) return Promise.reject(new Error('Native doğrulama bu ortamda yok.'));
      return plugin.authenticate({
        title: 'Gizli Tentifor içeriği',
        subtitle: 'Devam etmek için cihaz kilidini doğrula.'
      });
    },
    keepScreenOn: function (enabled) {
      var plugin = nativePlugin();
      if (!plugin || !plugin.keepScreenOn) return Promise.resolve({ enabled: false });
      return plugin.keepScreenOn({ enabled: !!enabled });
    }
  };

  window.addEventListener('tentifor-native-route', function (event) {
    var detail = event && event.detail || {};
    var route = detail.route;
    if (typeof route === 'string' && /^#\//.test(route)) window.location.hash = route;
    if (detail.text || detail.uri) {
      window.dispatchEvent(new CustomEvent('tentifor-native-share', { detail: detail }));
    }
  });

  function addNativeTools() {
    if (!isNative()) return;
    var menu = document.querySelector('#mobilMenu .mm-eylemler');
    if (!menu || menu.querySelector('[data-tf60-action]')) return;
    var box = document.createElement('div');
    box.className = 'tf60-native-tools';
    box.innerHTML = '<button class="mm-eylem" type="button" data-tf60-action="biometric">▣ Gizli içeriği aç</button>' +
      '<button class="mm-eylem" type="button" data-tf60-action="screen">▤ Ekranı açık tut</button>';
    menu.appendChild(box);
  }
  new MutationObserver(addNativeTools).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', function (event) {
    var action = event.target.closest && event.target.closest('[data-tf60-action]');
    if (!action) return;
    if (action.dataset.tf60Action === 'biometric') {
      TentiforNative6.authenticate().then(function () { notify('Biyometrik doğrulama başarılı.'); }).catch(function (error) {
        notify(error && error.message ? error.message : 'Doğrulama başarısız.');
      });
    }
    if (action.dataset.tf60Action === 'screen') {
      var enabled = action.dataset.enabled !== '1';
      TentiforNative6.keepScreenOn(enabled).then(function () {
        action.dataset.enabled = enabled ? '1' : '0';
        action.textContent = enabled ? '▤ Ekranı açık tut (açık)' : '▤ Ekranı açık tut';
        notify(enabled ? 'Ekran kapanması engellendi.' : 'Ekran kapanması yeniden etkin.');
      }).catch(function () { notify('Ekran ayarı bu cihazda kullanılamıyor.'); });
    }
  });
}());
