(function () {
  'use strict';
  var FLAG = '__TENTIFOR_KANON_GIZLI_KIMLIK_6314__';
  if (window[FLAG]) return;
  window[FLAG] = true;

  function records() {
    return typeof veri !== 'undefined' && veri && Array.isArray(veri.karakterler) ? veri.karakterler : [];
  }
  function byId(id) {
    return records().find(function (person) { return person && person.id === id; }) || null;
  }
  function identityIds(parent) {
    return parent && Array.isArray(parent.gizliKimlikler)
      ? parent.gizliKimlikler.filter(function (id) { return typeof id === 'string' && !!byId(id); }).slice(0, 12)
      : [];
  }
  function identityParent(person) {
    return person && person.gizliKimlikAnaId ? byId(person.gizliKimlikAnaId) : null;
  }
  function goldBadge(id) {
    var key = 'rozet_altin_' + id;
    if (typeof window.kilitAcik === 'function') return !!window.kilitAcik(key);
    return !!(window.cuzdan && Array.isArray(window.cuzdan.acilan) && window.cuzdan.acilan.indexOf(key) !== -1);
  }
  function identityUnlocked(person) {
    if (!person || !person.gizliKimlikAnaId) return true;
    var parent = identityParent(person);
    if (!parent || !goldBadge(parent.id)) return false;
    var ids = identityIds(parent);
    var index = ids.indexOf(person.id);
    if (index < 0) return false;
    return index === 0 || goldBadge(ids[index - 1]);
  }
  function visibleInArchive(person) {
    return !person || !person.gizliKimlikAnaId || identityUnlocked(person);
  }
  function visibleInUniverse(person) {
    if (!person || !person.gizliKimlikAnaId) return true;
    var parent = identityParent(person);
    return !!parent && goldBadge(parent.id);
  }
  function identityForBadge(person) {
    return !person || !person.gizliKimlikAnaId || identityUnlocked(person);
  }
  function htmlEscape(value) {
    if (typeof window.kacir === 'function') return window.kacir(value == null ? '' : String(value));
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function progressHtml(parent) {
    var ids = identityIds(parent);
    if (!ids.length) return '';
    var unlocked = goldBadge(parent.id);
    var rows = ids.map(function (id, index) {
      var identity = byId(id);
      var personIndex = records().findIndex(function (person) { return person && person.id === id; });
      var ready = unlocked && (index === 0 || goldBadge(ids[index - 1]));
      var label = htmlEscape(identity && identity.ad || id);
      var step = index + 1;
      if (ready && personIndex >= 0) {
        return '<button type="button" class="dugme dugme-sade y-kucuk" data-karakter="' + personIndex + '" aria-label="' + step + '. gizli kimliği aç: ' + label + '">' + step + '. ' + label + ' →</button>';
      }
      var previous = index === 0 ? null : byId(ids[index - 1]);
      var prerequisite = index === 0 ? 'ana karakterin altın rozeti' : (previous && previous.ad || 'önceki kimliğin') + ' altın rozeti';
      return '<button type="button" class="dugme dugme-sade y-kucuk" disabled aria-disabled="true">🔒 ' + step + '. ' + label + ' · önce ' + htmlEscape(prerequisite) + '</button>';
    }).join('');
    return '<section class="kanon-gizli-kimlikler" aria-label="Gizli kimlik panelleri">' +
      '<h4>Gizli kimlikler · ' + htmlEscape(parent.ad || 'karakter') + '</h4>' +
      (unlocked
        ? '<p class="oyun-not">Kimlikler sırayla açılır. Sonraki panel için önce açık kimliğin altın rozetini kazan.</p><div class="kanon-gizli-kimlik-dugmeleri">' + rows + '</div>'
        : '<p class="oyun-not">Bu karakterin altın rozeti kazanılınca gizli kimlik panelleri burada görünür.</p>') +
      '</section>';
  }
  function appendProgress(person, modal) {
    if (!person || !modal) return;
    var old = modal.querySelector('.kanon-gizli-kimlikler');
    if (old) old.remove();
    var parent = identityParent(person) || person;
    var html = progressHtml(parent);
    if (html) modal.insertAdjacentHTML('beforeend', html);
    modal.dataset.kanonKimlikKarakterId = person.id;
  }

  window.kanonKimlikErisilebilir = identityUnlocked;
  window.kanonKimlikListedeGorunur = visibleInArchive;
  window.kanonKimlikEvrenGorunur = visibleInUniverse;
  window.kanonKimlikRozetKazanabilir = identityForBadge;

  var originalOpen = window.karakterAc;
  if (typeof originalOpen === 'function') {
    window.karakterAc = function (index) {
      var list = records();
      var person = list[Number(index)];
      if (person && person.gizliKimlikAnaId && !identityUnlocked(person)) {
        var parent = identityParent(person);
        var parentIndex = parent && list.findIndex(function (item) { return item && item.id === parent.id; });
        if (parentIndex >= 0) return window.karakterAc.call(this, parentIndex);
        return undefined;
      }
      var result = originalOpen.apply(this, arguments);
      try {
        var modal = document.querySelector('#perde .pencere');
        if (modal && person) appendProgress(person, modal);
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) console.warn('Gizli kimlik panelleri gösterilemedi.', error);
      }
      return result;
    };
  }

  var originalBadgeCheck = window.rozetleriDenetle;
  if (typeof originalBadgeCheck === 'function') {
    window.rozetleriDenetle = function () {
      var result = originalBadgeCheck.apply(this, arguments);
      try {
        var modal = document.querySelector('#perde .pencere');
        var id = modal && modal.dataset.kanonKimlikKarakterId;
        var person = id && byId(id);
        if (person) appendProgress(person, modal);
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) console.warn('Kimlik zinciri güncellenemedi.', error);
      }
      return result;
    };
  }
}());
