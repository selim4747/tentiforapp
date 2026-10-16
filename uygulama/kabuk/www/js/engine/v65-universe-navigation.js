/* TentiforApp 6.5.3 — evren bağlamlı bilgi ve okuma rotaları. */
(function () {
  'use strict';
  // `veri` ve `EVS` klasik script'lerde let ile tanımlıdır; window özelliği olmazlar.
  // Bu dosya window.veri / window.EVS okuduğu için, ikisini canlı değerlere bağlayan köprü kurulur.
  function bridgeGlobal(name, read, write) {
    if (Object.prototype.hasOwnProperty.call(window, name)) return;
    try {
      Object.defineProperty(window, name, { get: read, set: write, configurable: true });
    } catch (error) { /* köprü kurulamazsa eski davranış sürer */ }
  }
  bridgeGlobal('veri',
    function () { try { return veri; } catch (error) { return undefined; } },
    function (value) { try { veri = value; } catch (error) { /* yok say */ } });
  bridgeGlobal('EVS',
    function () { try { return EVS; } catch (error) { return undefined; } },
    function (value) { try { EVS = value; } catch (error) { /* yok say */ } });
  var previousGuide = window.evrenRehberi;
  var previousPage = window.evrenSayfaVerisi;
  var previousTabs = window.evrenEkSekmeler;
  var previousSection = window.evrenEkBolum;

  function array(value) { return Array.isArray(value) ? value : []; }
  function text(value) { return String(value == null ? '' : value).trim(); }
  function hasContent(value) {
    if (typeof value === 'string') return !!value.trim();
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.some(hasContent);
    if (value && typeof value === 'object') return Object.keys(value).some(function (key) { return hasContent(value[key]); });
    return false;
  }
  function pushGuide(list, title, target) {
    if (!title || !target || list.some(function (item) { return item.dosya === target; })) return;
    list.push({ sira: list.length + 1, baslik: title, dosya: target, kilitli: false, kod_gerekli: false });
  }
  function worldGroups(world) {
    var groups = typeof FAN_EVREN_GRUPLARI !== 'undefined' && Array.isArray(FAN_EVREN_GRUPLARI) ? FAN_EVREN_GRUPLARI : [
      { k: 'kurallar', ad: 'Kurallar' }, { k: 'kisiler', ad: 'Kişiler' },
      { k: 'yerler', ad: 'Yerler' }, { k: 'tarih', ad: 'Tarih' },
      { k: 'sozluk', ad: 'Sözlük' }, { k: 'belgeler', ad: 'Belgeler' },
      { k: 'aylar', ad: 'Takvim' }, { k: 'etkinlikler', ad: 'Etkinlikler' }
    ];
    return groups.filter(function (group) { return array(world && world[group.k]).some(hasContent); });
  }
  function canonicalGuide(world) {
    var data = window.veri || {};
    var id = window.EVS && window.EVS.kaynak === 'site' ? String(window.EVS.id || '') : '';
    var guide = [];
    if (text(world && world.ozet)) pushGuide(guide, 'Evrene giriş · ' + (world.ad || id), 'bolum:ozet');
    array(data.evren).forEach(function (entry, index) {
      var belongs = typeof window.evrendeMi === 'function' ? window.evrendeMi(entry, id) : array(entry && entry.evrenler).includes(id) || (!entry || !Array.isArray(entry.evrenler)) && id === 'tomye';
      if (belongs) pushGuide(guide, (entry.bolum ? entry.bolum + ' · ' : '') + (entry.baslik || 'Evren bilgisi'), 'bolum:kanon-' + index);
    });
    worldGroups(world).forEach(function (group) { pushGuide(guide, group.ad, 'bolum:' + group.k); });
    return guide;
  }
  function generatedGuide(world) {
    var guide = [];
    if (text(world && world.ozet)) pushGuide(guide, 'Evrene giriş · ' + (world.ad || 'Evren'), 'bolum:ozet');
    worldGroups(world).forEach(function (group) { pushGuide(guide, group.ad, 'bolum:' + group.k); });
    array(world && world.roman && world.roman.bolumler).forEach(function (chapter, index) {
      if (chapter && chapter.id) pushGuide(guide, chapter.baslik || 'Bölüm ' + (index + 1), 'roman:' + chapter.id);
    });
    array(world && world.lorlar).forEach(function (lore) {
      if (lore && lore.id) guide.push({ sira: guide.length + 1, baslik: lore.baslik || 'Lore', dosya: 'lore:' + lore.id, kilitli: !!lore.kilitli, kod_gerekli: !!lore.kod_gerekli });
    });
    return guide;
  }
  window.evrenRehberi = function (world) {
    if (!world || typeof world !== 'object') return [];
    if (array(world.okuma_rehberi).length) return world.okuma_rehberi;
    if (window.EVS && window.EVS.kaynak === 'site') return canonicalGuide(world);
    var generated = generatedGuide(world);
    if (generated.length) return generated;
    return typeof previousGuide === 'function' ? previousGuide(world) || [] : [];
  };

  window.evrenSayfaVerisi = function () {
    var page = typeof previousPage === 'function' ? previousPage.apply(this, arguments) : null;
    if (page || !window.EVS || window.EVS.kaynak !== 'site' || !window.veri) return page;
    var id = String(window.EVS.id || '');
    var map = array(window.veri.haritalar).find(function (item) { return item && String(item.id) === id; });
    var rootMap = array(window.veri.haritalar)[0];
    if (!map || !rootMap || String(rootMap.id) !== id) return page;
    var articles = array(window.veri.evren).filter(function (entry) {
      return typeof window.evrendeMi === 'function' ? window.evrendeMi(entry, id) : array(entry && entry.evrenler).includes(id) || (!entry || !Array.isArray(entry.evrenler)) && id === 'tomye';
    });
    var intro = articles.find(function (entry) { return entry && entry.ozet; });
    var world = {
      bicim: 'tentifor-evren-v1', surum: 1, tur: 'evren', id: id,
      ad: map.evrenAdi || map.ad || id,
      yazar: 'TentiFor', ozet: map.aciklama || intro && intro.ozet || '',
      kurallar: [], kisiler: [], yerler: [], tarih: [], sozluk: [],
      okuma_rehberi: [], harita: { yerler: array(map.yerler), renk: map.renk }
    };
    return { eser: world, duzenle: false, site: map, kilitli: false, rozet: 'Kanon evren' };
  };

  window.aktifEvrenHedefi = function (kind) {
    var hash = String(window.location && window.location.hash || '');
    var current = null;
    var routeContext = /^#\/(?:ev\/|legacy-universe)/.test(hash) || hash === '#/harita' || hash === '#/arsiv';
    if (routeContext && typeof window.simdikiEvren === 'function') current = window.simdikiEvren();
    if (!current && typeof window.aktifEvren === 'function') current = window.aktifEvren();
    if (!current && typeof window.simdikiEvren === 'function') current = window.simdikiEvren();
    if (!current) {
      var first = array(window.veri && window.veri.haritalar)[0];
      current = { git: first ? 'harita:' + first.id : '#/arsiv', ad: first && (first.evrenAdi || first.ad) || 'Tentiforverse' };
    }
    // Ana sayfa, başlangıç evreninin kısa yolu; alt menü ana sayfaya değil lore sayfasına gitmeli.
    if (current.git === '#/arsiv') {
      var root = array(window.veri && window.veri.haritalar)[0];
      if (root) current = { git: 'harita:' + root.id, ad: root.evrenAdi || root.ad || 'Evren' };
    }
    var git = String(current.git || '');
    if (git === '#/legacy-universe') return { git: git, ad: current.ad || 'Eski arşiv', ce: kind === 'oyna' ? 'oyunlar' : 'roman' };
    if (git === '#/arsiv') {
      var rootMap = array(window.veri && window.veri.haritalar)[0];
      git = rootMap ? '#/ev/site/' + rootMap.id : '#/arsiv';
    } else if (git.indexOf('harita:') === 0) {
      git = '#/ev/site/' + git.slice(7);
    }
    var tab = kind === 'oku' ? 'oku' : kind === 'evren' ? 'bilgi' : 'oyunlar';
    return { git: git, ad: current.ad || 'Evren', sekme: tab };
  };

  if (typeof previousTabs === 'function') {
    window.evrenEkSekmeler = function (page) {
      var tabs = previousTabs.apply(this, arguments) || [];
      if (!Array.isArray(tabs)) tabs = [];
      if (page && !page.kilitli && !tabs.some(function (tab) { return tab && tab[0] === 'oku'; })) tabs.unshift(['oku', '📖 Oku']);
      return tabs;
    };
  }
  if (typeof previousSection === 'function') {
    window.evrenEkBolum = function (page) {
      if (window.EVS && window.EVS.sekme === 'oku' && window.__tf65ForceGuideOnce) {
        window.__tf65ForceGuideOnce = false;
        return typeof window.evrenRehberBolumu === 'function' ? window.evrenRehberBolumu(page) : '<p class="oyun-not">Okuma rotası hazırlanıyor.</p>';
      }
      return previousSection.apply(this, arguments);
    };
  }

  var originalDock = window.altMenuCiz;
  if (typeof originalDock === 'function') {
    window.altMenuCiz = function () {
      var result = originalDock.apply(this, arguments);
      var button = document.querySelector('#altMenu [data-evren-sec]');
      var target = typeof window.altMenuEvrenHedefi === 'function'
        ? window.altMenuEvrenHedefi('evren')
        : window.aktifEvrenHedefi('evren');
      if (!button || !target) return result;
      var link = document.createElement('a');
      link.className = button.className;
      link.href = target.git;
      link.setAttribute('data-alt-hedef', 'evren');
      link.setAttribute('aria-label', (target.ad || 'Evren') + ' bilgisi ve lore');
      if (String(window.location.hash || '') === target.git && window.EVS && window.EVS.sekme === 'bilgi') {
        link.classList.add('bu');
        link.setAttribute('aria-current', 'page');
      }
      link.innerHTML = button.innerHTML;
      button.replaceWith(link);
      return result;
    };
  }
  document.addEventListener('click', function (event) {
    if (event.target && event.target.closest && event.target.closest('[data-alt-hedef]') && typeof window.mobilMenuKapat === 'function') {
      window.mobilMenuKapat();
    }
    var readLink = event.target && event.target.closest && event.target.closest('[data-alt-hedef="oku"]');
    if (readLink) window.__tf65ForceGuideOnce = true;
  }, true);
  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest && event.target.closest('[data-rehber-git]');
    if (!button || !window.EVS) return;
    var match = /^bolum:kanon-(\d+)$/.exec(button.getAttribute('data-rehber-git') || '');
    if (!match) return;
    var index = String(Number(match[1]));
    window.setTimeout(function () {
      var article = document.querySelector('#evrenSayfa .madde[data-madde="' + index + '"]');
      if (!article) return;
      var header = article.querySelector('.madde-bas');
      if (header && header.getAttribute('aria-expanded') !== 'true') header.click();
      if (article.scrollIntoView) article.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  });

}());
