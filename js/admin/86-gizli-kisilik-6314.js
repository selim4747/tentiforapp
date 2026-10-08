(function () {
  'use strict';

  var FLAG = '__TENTIFOR_GIZLI_KISILIK_6314__';
  if (window[FLAG]) return;
  window[FLAG] = true;

  function escapeHtml(value) {
    if (typeof kacir === 'function') return kacir(value == null ? '' : String(value));
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function cleanIdentities(value) {
    var seen = {};
    return (Array.isArray(value) ? value : []).slice(0, 12).map(function (item) {
      return {
        ad: String(item && item.ad || '').trim().slice(0, 80),
        aciklama: String(item && item.aciklama || '').trim().slice(0, 1000)
      };
    }).filter(function (item) {
      if (!item.ad && !item.aciklama) return false;
      var key = item.ad.toLocaleLowerCase('tr');
      if (key && seen[key]) return false;
      if (key) seen[key] = true;
      return true;
    });
  }

  function parseLines(value) {
    return cleanIdentities(String(value || '').split(/\n+/).map(function (line) {
      line = line.trim();
      if (!line) return null;
      var colon = line.indexOf(':');
      return colon < 0
        ? { ad: line, aciklama: '' }
        : { ad: line.slice(0, colon).trim(), aciklama: line.slice(colon + 1).trim() };
    }).filter(Boolean));
  }

  function serialize(value) {
    return cleanIdentities(value).map(function (item) {
      return item.ad + (item.aciklama ? ': ' + item.aciklama : '');
    }).join('\n');
  }

  function currentRecord() {
    if (typeof yoneticiSekme === 'undefined' || yoneticiSekme !== 'karakterler' ||
        typeof yoneticiKayitlar !== 'function' || typeof yoneticiSecili === 'undefined' || yoneticiSecili === null) return null;
    var index = Number(yoneticiSecili);
    if (!Number.isInteger(index)) return null;
    return (yoneticiKayitlar() || [])[index] || null;
  }

  function renderEditor() {
    var root = document.querySelector('#yoneticiAlan');
    var target = root && root.querySelector('#yDurum');
    var title = root && root.querySelector('#yMetin');
    var record = currentRecord();
    if (!root || !target || !title || !record || root.querySelector('#yGizliKisilikler')) return;

    var html = '<section class="kutu-y y-gizli-kimlik-editor" aria-labelledby="yGizliKisilikBaslik">' +
      '<h3 id="yGizliKisilikBaslik">Gizli kimlikler ve kişilikler · spoiler</h3>' +
      '<label for="yGizliKisilikler">Her satır: kimlik veya kişilik: açıklama</label>' +
      '<textarea class="kod-giris arac-giris" id="yGizliKisilikler" rows="4" maxlength="13000" ' +
      'placeholder="Star Saver: L25’in gerçek kimliği.&#10;Yaşam: Feil’in diğer kimliği.&#10;Bilim insanı: L25 ile birlikte çalışır.">' +
      escapeHtml(serialize(record.gizliKimlikler)) + '</textarea>' +
      '<p class="oyun-not">Kaydedilenler karakter kartında kapalı spoiler olarak görünür. Bunlar gizli/şifreli erişim bilgisi değildir: veri.json içinde düz metin olarak bulunur.</p>' +
      '</section>';
    target.insertAdjacentHTML('beforebegin', html);
  }

  var originalRender = window.yoneticiTemelCiz;
  if (typeof originalRender === 'function') {
    window.yoneticiTemelCiz = function () {
      var result = originalRender.apply(this, arguments);
      renderEditor();
      return result;
    };
  }

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest && event.target.closest('#yoneticiAlan [data-yonetici="kaydet"]');
    if (!button) return;
    var field = document.querySelector('#yGizliKisilikler');
    var record = currentRecord();
    if (field && record) record.gizliKimlikler = parseLines(field.value);
  }, true);

  window.yoneticiGizliKisilikHazir = function () { return true; };
}());
