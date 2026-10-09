/* TentiforApp 6.3.9 — privacy-filtered route metadata and client-side public share cards. */
(function () {
  'use strict';
  var SITE = 'https://tentifor.com';
  var IMAGE = SITE + '/paylasim.png';
  var lastKey = '';
  var requestNo = 0;
  var deferredMountObserver = null;
  var cardMaintenanceObserver = null;
  var pendingMount = null;
  var pageCache = new Map();
  var localRegistryPromise = null;

  function safeText(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || 600);
  }
  function pathFor(type, id) {
    var value = safeText(id, 120).normalize('NFC').toLocaleLowerCase('tr-TR');
    if (type === 'profil' && /^[a-z0-9_]{3,20}$/.test(value)) return '/u/' + encodeURIComponent(value) + '/';
    if (type === 'evren' && /^[\p{L}\p{N}][\p{L}\p{N}-]{2,59}$/u.test(value)) return '/evren/' + encodeURIComponent(value) + '/';
    if (type === 'okuma' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) return '/okuma-yolu/' + value + '/';
    return null;
  }
  function canonicalUniverseFrom(data, value) {
    var entries = data && data.fanEserleri && data.fanEserleri.evrenler;
    if (!Array.isArray(entries)) return null;
    var entry = entries.find(function (item) {
      return item && item.tur === 'evren' && item.kanon === true && String(item.id || '').toLowerCase() === value && item.dosya === 'evrenler/' + value + '.json';
    });
    return entry ? { tur: 'evren', slug: value, baslik: entry.ad || value.toUpperCase(), ozet: entry.ozet || '', yazar_adi: entry.yazar_kadi || entry.yazar || 'TentiFor' } : null;
  }
  async function approvedCanonicalUniverse(id) {
    var value = String(id || '').toLowerCase();
    if (!/^e\d{1,6}$/.test(value)) return null;
    var item = typeof veri !== 'undefined' ? canonicalUniverseFrom(veri, value) : null;
    if (item) return item;
    if (!localRegistryPromise) localRegistryPromise = fetch('/veri.json', { cache: 'no-store' }).then(function (response) {
      if (!response.ok) return null;
      return response.json();
    }).catch(function () { return null; });
    return canonicalUniverseFrom(await localRegistryPromise, value);
  }
  function ensureMeta(selector, attrs) {
    var node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('meta');
      Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
      document.head.appendChild(node);
    }
    return node;
  }
  function setMeta(data) {
    document.title = safeText(data.title, 100) || 'TentiFor — Tentiforverse Arşivi';
    var description = ensureMeta('meta[name="description"]', { name: 'description' });
    description.setAttribute('content', safeText(data.description, 180));
    var robots = ensureMeta('meta[name="robots"]', { name: 'robots' });
    robots.setAttribute('content', data.public === false ? 'noindex, follow' : 'index, follow');
    var canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = SITE + data.path;
    [
      ['og:type', data.ogType || 'website'], ['og:title', data.title], ['og:description', data.description],
      ['og:url', SITE + data.path], ['og:image', IMAGE]
    ].forEach(function (item) {
      var node = ensureMeta('meta[property="' + item[0] + '"]', { property: item[0] });
      node.setAttribute('content', safeText(item[1], 180));
    });
    [['twitter:card', 'summary_large_image'], ['twitter:title', data.title], ['twitter:url', SITE + data.path], ['twitter:description', data.description], ['twitter:image', IMAGE]].forEach(function (item) {
      var node = ensureMeta('meta[name="' + item[0] + '"]', { name: item[0] });
      node.setAttribute('content', safeText(item[1], 180));
    });
  }
  function metadata(item, path) {
    if (!item || !path) return null;
    if (item.tur === 'profil') {
      var handle = safeText(item.kullanici_adi, 20).toLowerCase();
      var display = safeText(item.gorunen_ad || handle, 80);
      var description = safeText(item.hakkinda, 280);
      if (item.icerik_gorunur === false) description = display + ' (@' + handle + ') için TentiFor’te herkese açık profil.';
      else if (!description) description = display + ' (@' + handle + ') için TentiFor’teki herkese açık profil ve yayınlanmış evrenler.';
      else description = display + ' (@' + handle + '): ' + description;
      return { path: path, title: display.slice(0, 22) + ' (@' + handle + ') | TentiFor', description: description.slice(0, 155), author: display, kind: 'Profil', ogType: 'profile' };
    }
    if (item.tur === 'evren') {
      var slug = safeText(item.slug, 60).normalize('NFC').toLocaleLowerCase('tr-TR');
      var name = safeText(item.baslik || slug, 120);
      return { path: path, title: name.slice(0, 30) + ' · ' + slug.slice(0, 10) + ' | TentiFor', description: safeText(item.ozet, 155) || (name + ' — TentiFor’te yayımlanmış bir evren.'), author: safeText(item.yazar_adi || item.yazar || 'TentiFor', 80), kind: 'Evren', ogType: 'article' };
    }
    var readTitle = safeText(item.baslik || 'Okuma yolu', 120);
    return { path: path, title: readTitle.slice(0, 32) + ' · Okuma yolu | TentiFor', description: safeText(item.aciklama, 155) || (readTitle + ' — ' + safeText(item.yazar_adi || item.yazar || 'TentiFor', 80) + ' tarafından paylaşılan herkese açık okuma rotası.'), author: safeText(item.yazar_adi || item.yazar || 'TentiFor', 80), kind: 'Okuma yolu', ogType: 'article' };
  }
  function announcePublicItem(item, meta) {
    var pending = { item: item, meta: meta };
    pendingMount = pending;
    function mountTarget() {
      if (pendingMount !== pending) return true;
      var mounted = item.tur === 'profil' ? mountProfileCard(item, meta) : item.tur === 'evren' ? mountUniverseCard(item, meta) : item.tur === 'okuma' ? (document.querySelector('#tf639ReadPathView') ? true : showReadPath(item, meta)) : false;
      if (!mounted) return false;
      pendingMount = null;
      if (deferredMountObserver) { deferredMountObserver.disconnect(); deferredMountObserver = null; }
      var fallback = document.querySelector('[data-seo-fallback]');
      if (fallback && (item.tur === 'okuma' || document.querySelector('.hesap-profil, #evrenSayfa'))) fallback.hidden = true;
      if (item.tur === 'evren') maintainUniverseCard(item, meta);
      unhideApp();
      window.dispatchEvent(new CustomEvent('tf639-public-item', { detail: { item: item, meta: meta } }));
      return true;
    }
    if (mountTarget()) return;
    if (!deferredMountObserver && document.documentElement) {
      deferredMountObserver = new MutationObserver(function () {
        if (pendingMount === pending && mountTarget()) { deferredMountObserver = null; }
      });
      deferredMountObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  }
  async function publicRpc(type, id) {
    var key = type + ':' + id;
    if (pageCache.has(key)) return pageCache.get(key);
    if (typeof HESAP_AYAR === 'undefined' || !HESAP_AYAR.url || !HESAP_AYAR.anahtar) return null;
    var response = await fetch(HESAP_AYAR.url.replace(/\/$/, '') + '/rest/v1/rpc/public_seo_sayfa', {
      method: 'POST', headers: { apikey: HESAP_AYAR.anahtar, 'content-type': 'application/json' },
      body: JSON.stringify({ p_tur: type, p_id: id })
    });
    if (!response.ok) throw new Error('SEO verisi yüklenemedi');
    var data = await response.json();
    if (data) pageCache.set(key, data);
    return data;
  }
  function shareButton(parent, item, meta) {
    if (!parent || parent.querySelector('[data-tf639-card]')) return;
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'dugme dugme-sade tf639-card-button';
    button.setAttribute('data-tf639-card', '');
    button.setAttribute('data-type', meta.kind);
    button.setAttribute('data-title', meta.title);
    button.setAttribute('data-author', meta.author);
    button.setAttribute('data-description', meta.description);
    button.setAttribute('data-url', SITE + meta.path);
    button.setAttribute('aria-label', meta.kind + ' paylaşım kartını indir');
    button.textContent = 'Paylaşım kartını indir';
    parent.insertBefore(button, parent.firstChild);
  }
  function maintainUniverseCard(item, meta) {
    if (cardMaintenanceObserver) cardMaintenanceObserver.disconnect();
    if (!document.body) return;
    cardMaintenanceObserver = new MutationObserver(function () {
      var panel = document.querySelector('#evrenSayfa');
      var slot = panel && panel.querySelector('.evs-govde');
      if (slot && !slot.querySelector('[data-tf639-card]')) shareButton(slot, item, meta);
      var fallback = document.querySelector('[data-seo-fallback]');
      if (fallback && panel) fallback.hidden = true;
    });
    cardMaintenanceObserver.observe(document.body, { childList: true, subtree: true });
  }
  function mountProfileCard(item, meta) {
    var panel = document.querySelector('.hesap-profil');
    if (!panel) return false;
    var slot = panel.querySelector('.tf63-profil-alan') || panel;
    shareButton(slot, item, meta);
    return true;
  }
  function mountUniverseCard(item, meta) {
    var panel = document.querySelector('#evrenSayfa');
    if (!panel) return false;
    var slot = panel.querySelector('.evs-govde');
    if (!slot) return false;
    shareButton(slot, item, meta);
    return true;
  }
  function showReadPath(item, meta) {
    document.querySelector('#tf639ReadPathView')?.remove();
    var panel = document.createElement('section');
    panel.id = 'tf639ReadPathView'; panel.className = 'tf639-read-path';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'tf639ReadPathTitle');
    var close = document.createElement('button'); close.type = 'button'; close.className = 'dugme dugme-sade';
    close.textContent = 'Kapat'; close.setAttribute('aria-label', 'Okuma yolunu kapat');
    close.addEventListener('click', function () { history.length > 1 ? history.back() : (location.hash = '#/okuma'); });
    var label = document.createElement('p'); label.className = 'tf639-seo-kind'; label.textContent = 'Herkese açık okuma yolu';
    var title = document.createElement('h1'); title.id = 'tf639ReadPathTitle'; title.textContent = safeText(item.baslik || 'Okuma yolu', 120);
    var byline = document.createElement('p'); byline.className = 'tf639-seo-author'; byline.textContent = 'Yazar: ' + meta.author;
    panel.append(close, label, title, byline);
    if (item.aciklama) { var description = document.createElement('p'); description.textContent = safeText(item.aciklama, 600); panel.appendChild(description); }
    var steps = Array.isArray(item.adimlar) ? item.adimlar.slice(0, 100) : [];
    var list = document.createElement('ol'); list.setAttribute('aria-label', 'Okuma sırası');
    steps.forEach(function (step) { var li = document.createElement('li'); li.textContent = safeText(step && step.baslik || 'Başlıksız adım', 160); list.appendChild(li); });
    panel.appendChild(list);
    shareButton(panel, item, meta);
    document.body.appendChild(panel);
    document.documentElement.classList.add('tf639-read-path-open');
    return true;
  }
  function unhideApp() {
    var main = document.querySelector('main#tepe[data-seo-route-background]');
    if (main) main.hidden = false;
  }
  async function handleRoute() {
    if (cardMaintenanceObserver) { cardMaintenanceObserver.disconnect(); cardMaintenanceObserver = null; }
    if (deferredMountObserver) { deferredMountObserver.disconnect(); deferredMountObserver = null; }
    pendingMount = null;
    document.querySelector('#tf639ReadPathView')?.remove();
    document.documentElement.classList.remove('tf639-read-path-open');
    var route = (typeof rota === 'function' ? rota() : location.hash).replace(/^#\/?/, '').split('/').filter(Boolean).map(function (part) {
      try { return decodeURIComponent(part); } catch (_) { return part; }
    });
    var type = ''; var id = ''; var path = '';
    if (route[0] === 'u' && route[1]) { type = 'profil'; id = route[1].toLowerCase(); path = pathFor(type, id); }
    else if (route[0] === 'ev' && route[1] === 'fan' && route[2]) { type = 'evren'; id = route[2].normalize('NFC'); path = pathFor(type, id); }
    else if (route[0] === 'okuma-yolu' && route[1]) { type = 'okuma'; id = route[1].toLowerCase(); path = pathFor(type, id); }
    else if (route[0] === 'ev' && route[1] === 'site' && ['e25', 'e99'].includes(String(route[2] || '').toLowerCase())) {
      var staticId = String(route[2]).toLowerCase();
      var staticData = typeof veri !== 'undefined' && veri && (staticId === 'e25' ? veri.kanonEvrenleri && veri.kanonEvrenleri.e25 : veri.e99);
      if (staticData) {
        var staticItem = { tur: 'evren', slug: staticId, baslik: staticData.ad || staticId.toUpperCase(), ozet: typeof staticData.ozet === 'string' ? staticData.ozet : '' };
        var staticPath = pathFor('evren', staticId);
        var staticMeta = metadata(staticItem, staticPath);
        setMeta({ ...staticMeta, public: true }); unhideApp(); mountUniverseCard(staticItem, staticMeta); announcePublicItem(staticItem, staticMeta);
      }
      return;
    } else return;
    if (!path) return;
    var current = ++requestNo; lastKey = type + ':' + id;
    setMeta({ path: path, title: 'TentiFor — herkese açık içerik', description: 'Yayınlanabilir içerik doğrulanıyor.', public: false });
    try {
      var item = type === 'evren' ? await approvedCanonicalUniverse(id) : null;
      if (!item) item = await publicRpc(type, id);
      if (current !== requestNo || lastKey !== type + ':' + id) return;
      var meta = item && item.tur === type ? metadata(item, path) : null;
      if (!item || !meta) { setMeta({ path: path, title: 'İçerik bulunamadı — TentiFor', description: 'Bu profil veya içerik herkese açık değil.', public: false }); return; }
      setMeta({ ...meta, public: true });
      if (type === 'profil') { if (mountProfileCard(item, meta)) unhideApp(); }
      else if (type === 'evren') { if (mountUniverseCard(item, meta)) unhideApp(); }
      else { showReadPath(item, meta); unhideApp(); }
      announcePublicItem(item, meta);
      var fallback = document.querySelector('[data-seo-fallback]');
      if (fallback && (type === 'okuma' || document.querySelector('.hesap-profil, #evrenSayfa'))) fallback.hidden = true;
    } catch (_) {
      if (current !== requestNo) return;
      setMeta({ path: path, title: 'İçerik doğrulanamadı — TentiFor', description: 'İçeriğin yayın durumu doğrulanamadı.', public: false });
    }
  }

  function wrappedLines(ctx, text, x, y, width, lineHeight, maxLines) {
    var words = String(text || '').split(/\s+/); var line = ''; var lines = 0;
    words.forEach(function (word) {
      var candidate = line ? line + ' ' + word : word;
      if (line && ctx.measureText(candidate).width > width) {
        if (lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
        lines += 1; line = word;
      } else line = candidate;
    });
    if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
  }
  async function downloadCard(button) {
    var canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
    var ctx = canvas.getContext('2d');
    if (!ctx || !canvas.toBlob) throw new Error('Bu tarayıcı görsel kart üretimini desteklemiyor.');
    var gradient = ctx.createLinearGradient(0, 0, 1200, 630); gradient.addColorStop(0, '#10263b'); gradient.addColorStop(1, '#14635d');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 630);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.arc(1080, 80, 250, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bde8dc'; ctx.fillRect(82, 88, 76, 8);
    ctx.fillStyle = '#d4fff2'; ctx.font = '700 27px Arial, sans-serif'; ctx.fillText(safeText(button.dataset.type || 'TentiFor', 24).toLocaleUpperCase('tr'), 82, 145);
    ctx.fillStyle = '#fff'; ctx.font = '700 54px Arial, sans-serif';
    wrappedLines(ctx, safeText(button.dataset.title, 100), 82, 238, 1036, 66, 2);
    ctx.fillStyle = '#d4fff2'; ctx.font = '600 28px Arial, sans-serif'; ctx.fillText(safeText(button.dataset.author, 70), 82, 405);
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '25px Arial, sans-serif';
    wrappedLines(ctx, safeText(button.dataset.description, 180), 82, 458, 1036, 36, 3);
    ctx.fillStyle = '#fff'; ctx.font = '700 24px Arial, sans-serif'; ctx.fillText('TentiFor', 82, 586);
    ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.font = '20px Arial, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('Tentiforverse Arşivi', 1118, 586); ctx.textAlign = 'left';
    var objectUrl = canvas.toDataURL('image/png'); var link = document.createElement('a');
    var slug = (button.dataset.url || 'tentiforapp').split('/').filter(Boolean).pop() || 'kart';
    link.href = objectUrl; link.download = 'tentiforapp-' + slug.replace(/[^a-z0-9_-]/gi, '-').slice(0, 50) + '.png';
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
  }
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-tf639-card]');
    if (!button) return;
    button.disabled = true;
    downloadCard(button).then(function () { button.textContent = 'Kart indirildi'; }).catch(function (error) { button.textContent = safeText(error.message, 100); }).finally(function () { setTimeout(function () { button.disabled = false; button.textContent = 'Paylaşım kartını indir'; }, 1800); });
  });
  function start() {
    var first = (typeof rota === 'function' ? rota() : location.hash);
    if (first) handleRoute();
  }
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);
  document.addEventListener('DOMContentLoaded', start, { once: true });
  document.addEventListener('tf-veri-hazir', start);
}());
