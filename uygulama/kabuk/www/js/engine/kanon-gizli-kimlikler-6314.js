(function () {
  'use strict';

  var FLAG = '__TENTIFOR_KANON_GIZLI_KIMLIK_6314__';
  if (window[FLAG]) return;
  window[FLAG] = true;

  function escapeHtml(value) {
    if (typeof kacir === 'function') return kacir(value == null ? '' : String(value));
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function hiddenIdentitiesHtml(value) {
    var identities = (Array.isArray(value) ? value : []).slice(0, 12).map(function (item) {
      return {
        ad: String(item && item.ad || '').trim().slice(0, 80),
        aciklama: String(item && item.aciklama || '').trim().slice(0, 1000)
      };
    }).filter(function (item) { return item.ad || item.aciklama; });
    if (!identities.length) return '';
    return '<details class="kanon-gizli-kimlikler"><summary>Gizli kimlikler ve kişilikler · spoiler (' + identities.length + ')</summary><dl>' +
      identities.map(function (item) {
        return '<dt>' + escapeHtml(item.ad || 'Adsız kimlik') + '</dt>' +
          (item.aciklama ? '<dd>' + escapeHtml(item.aciklama).replace(/\n/g, '<br>') + '</dd>' : '');
      }).join('') + '</dl></details>';
  }

  var originalOpen = window.karakterAc;
  if (typeof originalOpen === 'function') {
    window.karakterAc = function (index) {
      var result = originalOpen.apply(this, arguments);
      try {
        var records = typeof veri !== 'undefined' && veri && Array.isArray(veri.karakterler) ? veri.karakterler : [];
        var person = records[Number(index)];
        var modal = document.querySelector('#perde .pencere');
        if (modal) {
          var old = modal.querySelector('.kanon-gizli-kimlikler');
          if (old) old.remove();
          var html = hiddenIdentitiesHtml(person && person.gizliKimlikler);
          if (html) modal.insertAdjacentHTML('beforeend', html);
        }
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) console.warn('Gizli kimlik spoiler bölümü gösterilemedi.', error);
      }
      return result;
    };
  }
}());
