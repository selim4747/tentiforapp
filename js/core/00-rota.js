const ROTA_HASH_KALIR = /^#\/(kartpostal\/|fan\/paylasim|evren\/e126(?:\/|$))/;
const TF4_PUBLIC_ORIGIN = 'https://tentifor.com';

function yoldanRota(yol) {
  const parcalar = String(yol || '').split('/').filter((parca) => parca && parca !== 'index.html').map((parca) => {
    try { return decodeURIComponent(parca); } catch { return parca; }
  });
  if (!parcalar.length) return '';
  const ilk = String(parcalar[0]).toLocaleLowerCase('tr-TR');
  if (ilk === 'yonetici' || ilk === 'yönetici') return '#/yonetici';
  if (parcalar[0] === 'evren' && parcalar[1]) {
    if (['benim', 'acilan', 'fan', 'site', 'onizle'].includes(parcalar[1])) return '#/ev/' + parcalar.slice(1).join('/');
    if (parcalar[1] === 'e126') return '#/evren/e126';
    if (parcalar[1] === 'e99') return '#/ev/e99';
    if (parcalar[1] === 'e25') return '#/ev/site/e25';
    if (/^e\d+$/.test(parcalar[1])) return '#/ev/' + parcalar[1];
    return '#/ev/fan/' + parcalar[1];
  }
  return '#/' + parcalar.join('/');
}

function rotadanYol(rotaMetni) {
  const parcalar = String(rotaMetni || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!parcalar.length) return '/';
  const yol = (bolumler) => '/' + bolumler.map(encodeURIComponent).join('/') + '/';
  if (parcalar[0] === 'evren' && parcalar[1] === 'e126' && parcalar.length === 2) return yol(['evren', 'e126']);
  if (parcalar[0] === 'yonetici' || parcalar[0] === 'yönetici') return '/yonetici/';
  if (parcalar[0] === 'ev') {
    if (parcalar[1] === 'e99' && parcalar.length === 2) return '/evren/e99/';
    if (parcalar.length === 2 && /^e\d+$/.test(parcalar[1])) return yol(['evren', parcalar[1]]);
    if (parcalar[1] === 'site' && parcalar[2] && /^e\d+$/.test(parcalar[2]) && parcalar[2] !== 'e99') return yol(['evren', parcalar[2]]);
    if (parcalar[1] === 'fan' && parcalar[2] && (!/^e\d+$/.test(parcalar[2]) || !['e25', 'e99'].includes(parcalar[2])) && !['benim', 'acilan', 'fan', 'site'].includes(parcalar[2])) return yol(['evren', parcalar[2]]);
    return yol(['evren'].concat(parcalar.slice(1)));
  }
  return yol(parcalar);
}

function rotaHashDuzelt(hash) {
  // Router hashes begin with #/; ordinary #section fragments remain DOM anchors.
  return String(hash || '');
}

function testFanEvrenRota(rotaMetni) {
  const match = /^#\/ev\/fan\/([^/]+)$/.exec(String(rotaMetni || ''));
  if (!match || typeof veri === 'undefined' || !veri) return null;
  let id;
  try { id = decodeURIComponent(match[1]); } catch { id = match[1]; }
  const evrenler = veri.fanEserleri && veri.fanEserleri.evrenler;
  if (!Array.isArray(evrenler)) return null;
  return evrenler.find((evren) => evren && evren.test === true && String(evren.id || '') === id) || null;
}

function rotaHashKalir(rotaMetni) {
  return ROTA_HASH_KALIR.test(String(rotaMetni || '')) || /^#\/ev\/(benim|acilan)(\/|$)/.test(String(rotaMetni || '')) || !!testFanEvrenRota(rotaMetni);
}

function rota() {
  const hash = rotaHashDuzelt(location.hash);
  if (hash && hash.indexOf('#/') === 0) return hash;
  return yoldanRota(location.pathname);
}

function rotaAdresi(rotaMetni) {
  return location.protocol.indexOf('http') !== 0
    ? location.href.split('#')[0] + rotaMetni
    : location.origin + (rotaHashKalir(rotaMetni) ? '/' + rotaMetni : rotadanYol(rotaMetni));
}

function rotaYolaCevir() {
  const hash = location.hash;
  if (!hash || hash.indexOf('#/') !== 0 || rotaHashKalir(hash) || location.protocol.indexOf('http') !== 0) return;
  if (/^#\/(yonetici|yönetici)$/.test(hash) && location.pathname !== '/yonetici/') {
    location.replace(location.origin + '/yonetici/' + location.search);
    return;
  }
  const yol = rotadanYol(hash);
  const eRota = hash.match(/^#\/ev\/site\/(e\d+)$/);
  if (yoldanRota(yol) === (hash === '#/' ? '' : hash) || (eRota && eRota[1] !== 'e25' && eRota[1] !== 'e99')) {
    try { history.replaceState(history.state, '', yol + location.search); } catch {}
  }
}

let rotaSon = '';
const ROTA_KISISEL = /^#\/(moderasyon(?:\/|$)|sen|yonetici(?:\/|$)|u\/|ev\/(benim|acilan)|kartpostal|fanAc|fan\/paylasim)/;
function rotaRobotlar() {
  const robots = document.querySelector('meta[name="robots"]');
  if (document.body && document.body.hasAttribute('data-seo-not-found')) {
    robots && robots.setAttribute('content', 'noindex, follow');
    return;
  }
  const aktifRota = rota();
  robots && robots.setAttribute('content', ROTA_KISISEL.test(aktifRota) || testFanEvrenRota(aktifRota) ? 'noindex, follow' : 'index, follow');
}

window.addEventListener('hashchange', rotaRobotlar);
document.addEventListener('DOMContentLoaded', rotaRobotlar);
window.addEventListener('hashchange', function () {
  rotaYolaCevir();
  rotaSon = rota();
});
window.addEventListener('popstate', function () {
  const guncel = rota();
  if (guncel !== rotaSon) {
    rotaSon = guncel;
    try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch { window.dispatchEvent(new Event('hashchange')); }
  }
});
document.addEventListener('click', function (event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest && event.target.closest('a[href^="#"]');
  if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
  const hedef = link.getAttribute('href');
  if (!hedef || hedef === '#') return;
  if (!hedef.startsWith('#/')) {
    let fragmentId = hedef.slice(1);
    try { fragmentId = decodeURIComponent(fragmentId); } catch {}
    if (document.getElementById(fragmentId)) return;
  }
  if (!hedef.startsWith('#/') && !/^#[A-Za-z0-9_-]+$/.test(hedef)) return;
  event.preventDefault();
  if (hedef !== rota()) location.hash = hedef;
}, true);
rotaYolaCevir();
rotaSon = rota();
document.addEventListener('DOMContentLoaded', function () {
  if (rota() === '#/yonetici' && typeof window.sayfaYonlendir === 'function') window.sayfaYonlendir();
});

/* Public route metadata: keeps title/canonical/OG in sync after SPA navigation. */
(function () {
  const map = {
    arsiv: ['Ana sayfa — TentiFor', 'Tentiforverse arşivi', true],
    '': ['Ana sayfa — TentiFor', 'Tentiforverse arşivi', true],
    tomye: ['Tömye — TentiFor', 'Tömye evreni ve arşiv içerikleri', true],
    harita: ['Harita — TentiFor', 'Tömye ve Ax-24 gezegen haritaları', true],
    fan: ['Fan evrenleri — TentiFor', 'TentiFor fan evrenleri ve hikâyeleri', true],
    oyunlar: ['Oyunlar — TentiFor', 'TentiFor oyunları', true],
    atolye: ['Atölye — TentiFor', 'TentiFor üretim atölyesi', true],
    okuma: ['Okuma — TentiFor', 'TentiFor okuma alanı', true],
    yonetici: ['Yönetici paneli — TentiFor', 'TentiFor yönetim paneli. Erişim için yönetici kodu gerekir.', false]
  };
  window.tf4RouteHead = function () {
    const hashRoute = location.hash.startsWith('#/');
    const pathParts = location.pathname.split('/').filter(Boolean);
    const routeParts = hashRoute ? location.hash.replace(/^#\//, '').split('/') : pathParts;
    let bolum = routeParts[0] || '';
    try { bolum = decodeURIComponent(bolum); } catch {}
    bolum = String(bolum).toLocaleLowerCase('tr-TR');
    if (bolum === 'yönetici') bolum = 'yonetici';
    const metadata = map[bolum];
    const notFound = document.body && document.body.hasAttribute('data-seo-not-found');
    const dynamicPublicPath = !hashRoute && !notFound && /^\/(?:u\/[^/]+|evren\/[^/]+|okuma-yolu\/[^/]+)\/?$/.test(location.pathname);
    if (dynamicPublicPath) return;
    if (hashRoute && bolum === 'evren' && routeParts[1] === 'e126') {
      document.title = 'E126 · e126 | TentiFor';
      const description = document.querySelector('meta[name="description"]');
      if (description) description.content = 'Fantastik · Bazı kişilerin bedenlerinin iki evren arasinda gezmesi';
      const robots = document.querySelector('meta[name="robots"]');
      if (robots) robots.setAttribute('content', 'index, follow');
      const canonicalUrl = TF4_PUBLIC_ORIGIN + '/evren/e126/';
      const canonical = document.querySelector('link[rel="canonical"]');
      const openGraph = document.querySelector('meta[property="og:url"]');
      const twitterUrl = document.querySelector('meta[name="twitter:url"]');
      if (canonical) canonical.href = canonicalUrl;
      if (openGraph) openGraph.content = canonicalUrl;
      if (twitterUrl) twitterUrl.content = canonicalUrl;
      return;
    }
    if (hashRoute && bolum === 'ev') return; // Other universe metadata belongs to the universe SEO handler.
    const publicRoute = !!(metadata && metadata[2] !== false);
    document.title = notFound ? 'Sayfa bulunamadı — TentiFor' : (metadata ? metadata[0] : 'TentiFor — Uygulama');
    const description = document.querySelector('meta[name="description"]');
    const canonical = document.querySelector('link[rel="canonical"]');
    const openGraph = document.querySelector('meta[property="og:url"]');
    const twitterUrl = document.querySelector('meta[name="twitter:url"]');
    const robots = document.querySelector('meta[name="robots"]');
    if (description) description.content = notFound
      ? 'Bu TentiFor sayfası yayında olmayabilir veya adresi değişmiş olabilir.'
      : (metadata ? metadata[1] : 'Tentiforverse arşivi ve kişisel alan.');
    if (robots) robots.setAttribute('content', publicRoute && !notFound ? 'index, follow' : 'noindex, follow');
    if (publicRoute && !notFound) {
      const path = bolum === 'yonetici' ? '/yonetici/' : '/' + (bolum || '') + '/';
      if (canonical) canonical.href = TF4_PUBLIC_ORIGIN + path;
      if (openGraph) openGraph.content = TF4_PUBLIC_ORIGIN + path;
      if (twitterUrl) twitterUrl.content = TF4_PUBLIC_ORIGIN + path;
    } else {
      if (canonical) canonical.removeAttribute('href');
      if (openGraph) openGraph.removeAttribute('content');
      if (twitterUrl) twitterUrl.removeAttribute('content');
    }
  };
  addEventListener('hashchange', window.tf4RouteHead);
  addEventListener('popstate', window.tf4RouteHead);
  setTimeout(window.tf4RouteHead, 0);
})();
