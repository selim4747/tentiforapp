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
  function cleanIds(value, parentId) {
    var source = Array.isArray(value) ? value : [];
    var seen = Object.create(null);
    var available = typeof veri !== 'undefined' && veri && Array.isArray(veri.karakterler) ? veri.karakterler : [];
    return source.map(function (item) {
      return typeof item === 'string' ? item.trim().slice(0, 80) : '';
    }).filter(function (id) {
      if (!/^[A-Za-z0-9_-]+$/.test(id) || seen[id]) return false;
      var identity = available.find(function (person) { return person && person.id === id; });
      if (!identity || identity.gizliKimlikAnaId !== parentId) return false;
      seen[id] = true;
      return true;
    }).slice(0, 12);
  }
  function parseLines(value, parentId) {
    return cleanIds(String(value || '').split(/\n+/), parentId);
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
    var record = currentRecord();
    if (!root || !target || !record || root.querySelector('#yGizliKisilikler')) return;
    var ids = cleanIds(record.gizliKimlikler, record.id);
    var available = (typeof veri !== 'undefined' && veri && Array.isArray(veri.karakterler) ? veri.karakterler : [])
      .filter(function (person) { return person && person.gizliKimlikAnaId === record.id; });
    var listing = available.map(function (person) { return person.id + ' — ' + person.ad; }).join('\n') || 'Bu karaktere bağlı kimlik kaydı yok.';
    var html = '<section class="kutu-y y-gizli-kimlik-editor" aria-labelledby="yGizliKisilikBaslik">' +
      '<h3 id="yGizliKisilikBaslik">Gizli kimlik panelleri · rozet sırası</h3>' +
      '<label for="yGizliKisilikler">Her satıra ayrı karakter kaydının ID’si yazılır; satır sırası kilit sırasıdır.</label>' +
      '<textarea class="kod-giris arac-giris" id="yGizliKisilikler" rows="4" maxlength="1000" placeholder="feil-yasam&#10;feil-kutuphane&#10;feil-bilim-insani">' +
      escapeHtml(ids.join('\n')) + '</textarea>' +
      '<p class="oyun-not"><b>Bu karakterin kimlik kayıtları:</b><br>' + escapeHtml(listing).replace(/\n/g, '<br>') +
      '<br>Önce ana karakterin altın rozeti, sonra listedeki her kimliğin altın rozeti sıradaki paneli açar. Kimlik kayıtları veri.json’da düz metindir; bu arayüz şifreleme sağlamaz.</p>' +
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
    if (field && record) record.gizliKimlikler = parseLines(field.value, record.id);
  }, true);
  window.yoneticiGizliKisilikHazir = function () { return true; };
}());
