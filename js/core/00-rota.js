const ROTA_HASH_KALIR = /^#\/(kartpostal\/|fan\/paylasim)/;

function yoldanRota(yol) {
  const parcalar = String(yol || '').split('/').filter((parca) => parca && parca !== 'index.html').map((parca) => {
    try { return decodeURIComponent(parca); } catch { return parca; }
  });
  if (!parcalar.length) return '';
  const ilk = String(parcalar[0]).toLocaleLowerCase('tr-TR');
  if (ilk === 'yonetici') return '#/yonetici';
  if (parcalar[0] === 'evren' && parcalar[1]) {
    if (['benim', 'acilan', 'fan', 'site', 'onizle'].includes(parcalar[1])) return '#/ev/' + parcalar.slice(1).join('/');
    if (parcalar[1] === 'e99') return '#/ev/e99';
    if (parcalar[1] === 'e25') return '#/ev/site/e25';
    if (/^e\d+$/.test(parcalar[1])) return '#/ev/site/' + parcalar[1];
    return '#/ev/fan/' + parcalar[1];
  }
  return '#/' + parcalar.join('/');
}

function rotadanYol(rotaMetni) {
  const parcalar = String(rotaMetni || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!parcalar.length) return '/';
  const yol = (bolumler) => '/' + bolumler.map(encodeURIComponent).join('/') + '/';
  if (parcalar[0] === 'ev') {
    if (parcalar[1] === 'e99' && parcalar.length === 2) return '/evren/e99/';
    if (parcalar[1] === 'site' && parcalar[2] && /^e\d+$/.test(parcalar[2]) && parcalar[2] !== 'e99') return yol(['evren', parcalar[2]]);
    if (parcalar[1] === 'fan' && parcalar[2] && (!/^e\d+$/.test(parcalar[2]) || !['e25', 'e99'].includes(parcalar[2])) && !['benim', 'acilan', 'fan', 'site'].includes(parcalar[2])) return yol(['evren', parcalar[2]]);
    return yol(['evren'].concat(parcalar.slice(1)));
  }
  return yol(parcalar);
}

function rotaHashDuzelt(hash) {
  const metin = String(hash || '');
  return /^#[A-Za-z0-9_-]+$/.test(metin) ? '#/' + metin.slice(1) : metin;
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
  event.preventDefault();
  const hedef = link.getAttribute('href');
  if (hedef !== '#' && hedef !== rota()) location.hash = hedef;
}, true);
rotaYolaCevir();
rotaSon = rota();

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
    yonetici: ['Yönetici — TentiFor', 'TentiFor yönetim ve içerik paneli.', false]
  };
  window.tf4RouteHead = function () {
    const bolum = (location.pathname.split('/')[1] || location.hash.replace(/^#\/?/, '').split('/')[0] || '').toLowerCase();
    const metadata = map[bolum];
    if (!metadata) return;
    document.title = metadata[0];
    const description = document.querySelector('meta[name="description"]');
    const canonical = document.querySelector('link[rel="canonical"]');
    const openGraph = document.querySelector('meta[property="og:url"]');
    const robots = document.querySelector('meta[name="robots"]');
    if (description) description.content = metadata[1];
    const path = '/' + (bolum || '') + '/';
    if (canonical) canonical.href = location.origin + path;
    if (openGraph) openGraph.content = location.origin + path;
    if (robots && metadata.length > 2 && metadata[2] === false) robots.setAttribute('content', 'noindex, follow');
  };
  addEventListener('hashchange', window.tf4RouteHead);
  addEventListener('popstate', window.tf4RouteHead);
  setTimeout(window.tf4RouteHead, 0);
})();
