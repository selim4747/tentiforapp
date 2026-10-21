import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { approvedCanonicalUniversePages, fetchPublicSeoPages, renderSeoNotFound, renderStandaloneAdminPage, seoMetadata, writeSeoRoutes } from './public-seo.mjs';
import { syncTerminalRoutes } from './sync-terminal-routes.mjs';
import { copyPublicAsset, isHiddenUniverseAssetPath, stripHiddenUniverseSections } from './visibility.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🚀 TentiFor paketleme başlatılıyor...');

// 1. Sürüm ve veri kontrolü. package.json tek canonical sürüm kaynağıdır.
const veriPath = path.join(ROOT_DIR, 'veri.json');
const packagePath = path.join(ROOT_DIR, 'package.json');
if (!fs.existsSync(veriPath)) {
  console.error('❌ veri.json bulunamadı!');
  process.exit(1);
}
let packageMeta;
try {
  packageMeta = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
} catch (e) {
  console.error('❌ package.json JSON ayrıştırma hatası:', e);
  process.exit(1);
}
const canonicalVersion = String(packageMeta.version || '');
if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(canonicalVersion)) {
  console.error('❌ package.json geçerli bir semver sürümü taşımıyor.');
  process.exit(1);
}

const veriIcerik = fs.readFileSync(veriPath, 'utf-8');
let veri;
try {
  veri = JSON.parse(veriIcerik);
  console.log(`✓ veri.json doğrulandı (Sürüm: ${veri.surum || '4.5.0'})`);
} catch (e) {
  console.error('❌ veri.json JSON ayrıştırma hatası:', e);
  process.exit(1);
}
if (veri.surum !== canonicalVersion) {
  console.error(`❌ Sürüm uyuşmazlığı: package.json=${canonicalVersion}, veri.json=${veri.surum || '(boş)'}`);
  process.exit(1);
}

// Source route handlers live in core/00-rota.js and are shipped inside paket-1.js.
// Keep the serving bundle in sync; otherwise production silently runs the stale route map.
const routeSource = fs.readFileSync(path.join(ROOT_DIR, 'js/core/00-rota.js'), 'utf8');
const routeBundlePath = path.join(ROOT_DIR, 'js/paket-1.js');
let routeBundle = fs.readFileSync(routeBundlePath, 'utf8');
const tourSource = fs.readFileSync(path.join(ROOT_DIR, 'js/arsiv/14-rol-yolu-mektuplar.js'), 'utf8');
if (!routeSource.includes("ilk === 'yonetici' || ilk === 'yönetici'") || !routeSource.includes('yonetici(?:\\/|$)') || !routeSource.includes('yonetici:') || !routeSource.includes('DOMContentLoaded') || !routeSource.includes('window.sayfaYonlendir')) {
  throw new Error('core/00-rota.js içinde yönetici route/metadata koruması bulunamadı; paket üretimi durduruldu.');
}
if (!tourSource.includes('hasAttribute("data-standalone-admin")')) {
  throw new Error('Admin sayfası için onboarding turu koruması kaynakta bulunamadı; paket üretimi durduruldu.');
}
function replaceRouteBundleFragment(bundle, current, replacement, label) {
  if (bundle.includes(replacement)) return bundle;
  const first = bundle.indexOf(current);
  if (first < 0 || bundle.indexOf(current, first + current.length) >= 0) {
    const alreadyCanonical = {
      'admin path': routeSource.includes("ilk === 'yonetici' || ilk === 'yönetici'"),
      'private route noindex': routeSource.includes('yonetici(?:\\/|$)'),
      'admin metadata': routeSource.includes('yonetici:'),
      'admin direct-route boot': routeSource.includes('window.sayfaYonlendir')
    }[label];
    if (alreadyCanonical) return bundle;
    throw new Error(`paket-1.js ${label} rota parçası beklenen biçimde değil; paket üretimi durduruldu.`);
  }
  return bundle.slice(0, first) + replacement + bundle.slice(first + current.length);
}
routeBundle = replaceRouteBundleFragment(
  routeBundle,
  "if (!parcalar.length) return '';\n  if (parcalar[0] === 'evren' && parcalar[1]) {",
  "if (!parcalar.length) return ''; const ilk = String(parcalar[0]).toLocaleLowerCase('tr-TR'); if (ilk === 'yonetici' || ilk === 'yönetici') return '#/yonetici'; if (parcalar[0] === 'evren' && parcalar[1]) {",
  'admin path'
);
routeBundle = replaceRouteBundleFragment(
  routeBundle,
  'const ROTA_KISISEL = /^#\\/(moderasyon(?:\\/|$)|sen|u\\/|ev\\/(benim|acilan)|kartpostal|fanAc|fan\\/paylasim)/;',
  'const ROTA_KISISEL = /^#\\/(moderasyon(?:\\/|$)|sen|yonetici(?:\\/|$)|u\\/|ev\\/(benim|acilan)|kartpostal|fanAc|fan\\/paylasim)/;',
  'private route noindex'
);
routeBundle = replaceRouteBundleFragment(
  routeBundle,
  "okuma: ['Okuma — TentiFor', 'TentiFor okuma alanı']",
  "okuma: ['Okuma — TentiFor', 'TentiFor okuma alanı'], yonetici: ['Yönetici paneli — TentiFor', 'TentiFor yönetim paneli. Erişim için yönetici kodu gerekir.', false]",
  'admin metadata'
);
routeBundle = replaceRouteBundleFragment(
  routeBundle,
  'rotaYolaCevir();\nrotaSon = rota();',
  "rotaYolaCevir();\nrotaSon = rota(); document.addEventListener('DOMContentLoaded',function(){if(rota()==='#/yonetici'&&typeof window.sayfaYonlendir==='function')window.sayfaYonlendir()});",
  'admin direct-route boot'
);
routeBundle = replaceRouteBundleFragment(
  routeBundle,
  'function turGerekli(){return kayitOku(TUR_ANAHTAR)!=="bitti"}function turBaslat(){turAdim=0,turCiz()}',
  'function turGerekli(){return !document.documentElement.hasAttribute("data-standalone-admin")&&kayitOku(TUR_ANAHTAR)!=="bitti"}function turBaslat(){if(document.documentElement.hasAttribute("data-standalone-admin"))return;turAdim=0,turCiz()}',
  'admin onboarding guard'
);
function functionRange(text, signature, label) {
  const start = text.indexOf(signature);
  if (start < 0 || text.indexOf(signature, start + signature.length) >= 0) {
    throw new Error(`${label} fonksiyonu tekil değil; paket üretimi durduruldu.`);
  }
  const opening = text.indexOf('{', start + signature.length);
  if (opening < 0) throw new Error(`${label} fonksiyon başlangıcı bulunamadı.`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = opening; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (lineComment) { if (char === '\n') lineComment = false; continue; }
    if (blockComment) { if (char === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; i++; continue; }
    if (char === '/' && next === '*') { blockComment = true; i++; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return { start, end: i + 1 };
  }
  throw new Error(`${label} fonksiyonu kapanmıyor; paket üretimi durduruldu.`);
}
const tourFunction = 'function turCiz()';
const sourceTourRange = functionRange(tourSource, tourFunction, 'Onboarding kaynak');
const bundleTourRange = functionRange(routeBundle, tourFunction, 'Onboarding paket');
const sourceTour = tourSource.slice(sourceTourRange.start, sourceTourRange.end);
if (routeBundle.slice(bundleTourRange.start, bundleTourRange.end) !== sourceTour) {
  routeBundle = routeBundle.slice(0, bundleTourRange.start) + sourceTour + routeBundle.slice(bundleTourRange.end);
}
// Keep both path directions identical to the canonical source. The older
// fragment patch above only updated yoldanRota(), leaving rotadanYol() stale.
const routeStart = 'function yoldanRota(yol)';
const routeEnd = 'function rota()';
function routeRange(text, label) {
  const start = text.indexOf(routeStart);
  const end = text.indexOf(routeEnd, start + routeStart.length);
  if (start < 0 || end <= start || text.indexOf(routeStart, start + routeStart.length) >= 0) {
    throw new Error(`${label} içinde kanonik rota aralığı tekil değil; paket üretimi durduruldu.`);
  }
  return { start, end };
}
const sourceRouteRange = routeRange(routeSource, 'core/00-rota.js');
const bundleRouteRange = routeRange(routeBundle, 'paket-1.js');
routeBundle = routeBundle.slice(0, bundleRouteRange.start)
  + routeSource.slice(sourceRouteRange.start, sourceRouteRange.end)
  + routeBundle.slice(bundleRouteRange.end);
const routerBundleStart = routeBundle.indexOf('const ROTA_HASH_KALIR =');
const routerBundleEnd = routeBundle.indexOf('(function(){var c={};', routerBundleStart);
if (routerBundleStart < 0 || routerBundleEnd <= routerBundleStart || !routeSource.startsWith('const ROTA_HASH_KALIR =')) {
  throw new Error('paket-1.js tam router bölümü bulunamadı; paket üretimi durduruldu.');
}
routeBundle = routeBundle.slice(0, routerBundleStart)
  + routeSource.trimEnd() + '\n\n'
  + routeBundle.slice(routerBundleEnd);
const mapSource = fs.readFileSync(path.join(ROOT_DIR, 'js/arsiv/09-medya-harita.js'), 'utf8');
const mapSourceStart = mapSource.indexOf('let haritaURLVeriBekliyor=false;');
const mapSourceEnd = mapSource.indexOf('function haritaYerDurumu(', mapSourceStart);
const mapBundleStart = routeBundle.includes('let haritaURLVeriBekliyor=false;')
  ? routeBundle.indexOf('let haritaURLVeriBekliyor=false;')
  : routeBundle.indexOf('function haritaURLSeciminiYukle()');
const mapBundleEnd = routeBundle.indexOf('function haritaYerDurumu(', mapBundleStart);
const mapBundleFunctionStart = routeBundle.indexOf('function haritaURLSeciminiYukle()', mapBundleStart);
if (mapSourceStart < 0 || mapSourceEnd <= mapSourceStart || mapBundleStart < 0 || mapBundleEnd <= mapBundleStart
  || mapSource.indexOf('let haritaURLVeriBekliyor=false;', mapSourceStart + 1) >= 0
  || mapBundleFunctionStart < 0
  || routeBundle.indexOf('function haritaURLSeciminiYukle()', mapBundleFunctionStart + 1) >= 0) {
  throw new Error('Map URL hydration source/bundle boundary is not unique; build stopped.');
}
routeBundle = routeBundle.slice(0, mapBundleStart)
  + mapSource.slice(mapSourceStart, mapSourceEnd)
  + routeBundle.slice(mapBundleEnd);
fs.writeFileSync(routeBundlePath, routeBundle, 'utf8');
const universeSource = fs.readFileSync(path.join(ROOT_DIR, 'js/engine/44-evrenler.js'), 'utf8');
const universeBundlePath = path.join(ROOT_DIR, 'js/paket-2.js');
let universeBundle = fs.readFileSync(universeBundlePath, 'utf8');
for (const signature of ['function evrenSayfaKur(e,n)', 'function evrenAdresiAc()']) {
  const sourceRange = functionRange(universeSource, signature, `Universe source ${signature}`);
  const bundleRange = functionRange(universeBundle, signature, `Universe bundle ${signature}`);
  const sourceFunction = universeSource.slice(sourceRange.start, sourceRange.end);
  if (universeBundle.slice(bundleRange.start, bundleRange.end) !== sourceFunction) {
    universeBundle = universeBundle.slice(0, bundleRange.start) + sourceFunction + universeBundle.slice(bundleRange.end);
  }
}
const oldUniverseBoot = 'if(evrenDugmesiKur(),rota().indexOf("#/ev/")===0)';
const newUniverseBoot = 'if(evrenDugmesiKur(),rota()==="#/evren/e126"||rota().indexOf("#/ev/")===0)';
if (universeBundle.includes(oldUniverseBoot)) universeBundle = universeBundle.replace(oldUniverseBoot, newUniverseBoot);
else if (!universeBundle.includes(newUniverseBoot)) throw new Error('paket-2.js E126 cold-route bootstrap guard bulunamadı; paket üretimi durduruldu.');
fs.writeFileSync(universeBundlePath, universeBundle, 'utf8');
const updateSource = fs.readFileSync(path.join(ROOT_DIR, 'js/core/46-guncelleme.js'), 'utf8');
const updateBundlePath = path.join(ROOT_DIR, 'js/paket-3.js');
let updateBundle = fs.readFileSync(updateBundlePath, 'utf8');
for (const signature of ['function guncellemeBekletir()', 'async function guncellemeUygula()']) {
  const sourceRange = functionRange(updateSource, signature, `Update source ${signature}`);
  const bundleRange = functionRange(updateBundle, signature, `Update bundle ${signature}`);
  const sourceFunction = updateSource.slice(sourceRange.start, sourceRange.end);
  if (updateBundle.slice(bundleRange.start, bundleRange.end) !== sourceFunction) {
    updateBundle = updateBundle.slice(0, bundleRange.start) + sourceFunction + updateBundle.slice(bundleRange.end);
  }
}
fs.writeFileSync(updateBundlePath, updateBundle, 'utf8');

// 2. Paket karması hesapla. Tarih kullanılmaz; aynı girdiler aynı cache adını üretir.
syncTerminalRoutes(ROOT_DIR);
const navigationSource = fs.readFileSync(path.join(ROOT_DIR, 'js/arayuz/18-gezinme.js'), 'utf8');
routeBundle = fs.readFileSync(routeBundlePath, 'utf8');
function balancedInitializer(text, name, opening, closing) {
  const marker = `${name}=`;
  const markerAt = text.indexOf(marker);
  if (markerAt < 0 || text.indexOf(marker, markerAt + marker.length) >= 0) {
    throw new Error(`Navigation initializer ${name} tekil değil; paket üretimi durduruldu.`);
  }
  let start = markerAt + marker.length;
  while (/\s/.test(text[start] || '')) start++;
  if (text[start] !== opening) throw new Error(`Navigation initializer ${name} beklenen ${opening} ile başlamıyor.`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === opening) depth++;
    else if (char === closing && --depth === 0) return { start, end: i + 1, value: text.slice(start, i + 1) };
  }
  throw new Error(`Navigation initializer ${name} kapanmıyor; paket üretimi durduruldu.`);
}
for (const [name, opening, closing] of [
  ['GEZINME', '[', ']'],
  ['GEZINME_ANA', '[', ']'],
  ['SAYFA_GIZLI_BOLUMLER', '{', '}'],
  ['YARDIMCI_BOLUMLER', '[', ']']
]) {
  const sourceValue = balancedInitializer(navigationSource, name, opening, closing).value;
  const bundleValue = balancedInitializer(routeBundle, name, opening, closing);
  if (bundleValue.value !== sourceValue) {
    routeBundle = routeBundle.slice(0, bundleValue.start) + sourceValue + routeBundle.slice(bundleValue.end);
  }
}
// Lock controls are part of the legacy paket-1 runtime. Keep the served copy
// in sync with their canonical sources, including the GitHub-versioned config.
function replaceSourceRange(bundle, source, sourceStart, sourceEnd, bundleStart, bundleEnd, label) {
  const a = source.indexOf(sourceStart);
  const b = source.indexOf(sourceEnd, a + sourceStart.length);
  const c = bundle.indexOf(bundleStart);
  const d = bundle.indexOf(bundleEnd, c + bundleStart.length);
  if (a < 0 || b <= a || c < 0 || d <= c) {
    throw new Error(`${label} kaynak/paket sınırları bulunamadı; paket üretimi durduruldu.`);
  }
  return bundle.slice(0, c) + source.slice(a, b) + bundle.slice(d);
}
const lockSource = fs.readFileSync(path.join(ROOT_DIR, 'js/arsiv/23-kanon-kilidi.js'), 'utf8');
const walletSource = fs.readFileSync(path.join(ROOT_DIR, 'js/core/03-cuzdan.js'), 'utf8');
const adminSource = fs.readFileSync(path.join(ROOT_DIR, 'js/admin/22-yonetici.js'), 'utf8');
const kanonStart = 'function kilitAyarlariniHazirla()';
const kanonEnd = 'const KANON_GRUPLARI=';
if (routeBundle.includes(kanonStart)) {
  routeBundle = replaceSourceRange(routeBundle, lockSource, kanonStart, kanonEnd, kanonStart, kanonEnd, 'kilit config');
} else {
  const a = lockSource.indexOf(kanonStart);
  const b = lockSource.indexOf(kanonEnd, a + kanonStart.length);
  const c = routeBundle.indexOf(kanonEnd);
  if (a < 0 || b <= a || c < 0) throw new Error('Kilit config ilk paket enjeksiyonu için sınırlar bulunamadı; paket üretimi durduruldu.');
  routeBundle = routeBundle.slice(0, c) + lockSource.slice(a, b) + routeBundle.slice(c);
}
routeBundle = replaceSourceRange(routeBundle, lockSource, 'function bolumErisimi(i)', 'const KANON_DISI_EVRENLER=', 'function bolumErisimi(i)', 'const KANON_DISI_EVRENLER=', 'page lock gate');
routeBundle = replaceSourceRange(routeBundle, walletSource, 'function kilitAcik(n)', 'function cuzdanGoster()', 'function kilitAcik(n)', 'function cuzdanGoster()', 'product lock gate');
routeBundle = replaceSourceRange(routeBundle, adminSource, 'const YONETICI_ANAHTAR=', 'function katmanListesi()', 'const YONETICI_ANAHTAR=', 'function katmanListesi()', 'admin session persistence');
fs.writeFileSync(routeBundlePath, routeBundle, 'utf8');
const hashGirdileri = [
  'index.html', 'manifest.webmanifest', 'package.json', 'veri.json',
  'paylasim.png', 'favicon.ico', 'css', 'js', 'ikon', 'yazitipi', 'evrenler'
];
function hashGirdisi(relative) {
  const full = path.join(ROOT_DIR, relative);
  if (!fs.existsSync(full)) return;
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(full).sort()) hashGirdisi(path.join(relative, child));
    return;
  }
  let content = fs.readFileSync(full);
  if (relative === 'index.html') {
    content = Buffer.from(content.toString('utf8')
      .replace(/<meta name="tentifor-paket" content="[^"]*">/, '<meta name="tentifor-paket" content="<paket>">')
      .replace(/((?:js|css)\/(?!style\.css\?v=|engine\/101-v61-universe\.js\?v=)[^"'\s?]+\?v=)[^"'&\s]+/g, '$1<paket>'));
  }
  paketHash.update(relative).update('\0').update(content).update('\0');
}
const paketHash = crypto.createHash('md5');
hashGirdileri.forEach(hashGirdisi);
const karma = paketHash.digest('hex').substring(0, 12);
const cssPath = path.join(ROOT_DIR, 'css', 'style.css');
const cssHash = crypto.createHash('md5').update(fs.readFileSync(cssPath)).digest('hex').substring(0, 12);

console.log(`✓ Yeni paket karması: ${karma}`);
console.log(`✓ CSS cache hash’i: ${cssHash}`);

// 3. surum.json güncelle
let eskiSurum = null;
try { eskiSurum = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'surum.json'), 'utf8')); } catch {}
const surumVeri = {
  paket: karma,
  surum: veri.surum || '4.5.0',
  kuruldu: eskiSurum && eskiSurum.paket === karma && eskiSurum.kuruldu ? eskiSurum.kuruldu : new Date().toISOString()
};

fs.writeFileSync(
  path.join(ROOT_DIR, 'surum.json'),
  JSON.stringify(surumVeri, null, 2),
  'utf-8'
);
console.log('✓ surum.json güncellendi');

// 4. sw.js güncelle
const swPath = path.join(ROOT_DIR, 'sw.js');
if (fs.existsSync(swPath)) {
  let swIcerik = fs.readFileSync(swPath, 'utf-8');
  swIcerik = swIcerik.replace(
    /const ONBELLEK = ["'][^"']+["'];/,
    `const ONBELLEK = "tentiforapp-${karma}";`
  );
  swIcerik = swIcerik.replace(/css\/style\.css\?v=[^"'\s]+/g, `css/style.css?v=${cssHash}`);
  swIcerik = swIcerik.replace(/((?:js|css)\/(?!style\.css\?v=|engine\/101-v61-universe\.js\?v=)[^"'\s?]+\?v=)[^"'&\s]+/g, `$1${karma}`);
  fs.writeFileSync(swPath, swIcerik, 'utf-8');
  console.log(`✓ sw.js önbellek anahtarı güncellendi (tentiforapp-${karma})`);
}

// 4.1 index.html meta etiketlerini güncelle (Sonsuz güncelle döngüsünü bitirir)
const indexPath = path.join(ROOT_DIR, 'index.html');
if (fs.existsSync(indexPath)) {
  let indexIcerik = fs.readFileSync(indexPath, 'utf-8');
  indexIcerik = indexIcerik.replace(
    /<meta name="tentifor-paket" content="[^"]*">/,
    `<meta name="tentifor-paket" content="${karma}">`
  );
  if (indexIcerik.includes('name="tentifor-surum"')) {
    indexIcerik = indexIcerik.replace(
      /<meta name="tentifor-surum" content="[^"]*">/,
      `<meta name="tentifor-surum" content="${veri.surum || '4.6.1'}">`
    );
  }
  indexIcerik = indexIcerik.replace(/((?:js|css)\/(?!style\.css\?v=|engine\/101-v61-universe\.js\?v=)[^"'\s?]+\?v=)[^"'&\s]+/g, `$1${karma}`);
  indexIcerik = indexIcerik.replace(/js\/engine\/101-v61-universe\.js\?v=[^"']+/g, 'js/engine/101-v61-universe.js?v=612');
  indexIcerik = indexIcerik.replace(/css\/style\.css\?v=[^"']+/g, `css/style.css?v=${cssHash}`);
  indexIcerik = indexIcerik.replace(/js\/arayuz\/33-ux-644\.js(?:\?v=[^"']+)?/g, `js/arayuz/33-ux-644.js?v=${karma}`);
  indexIcerik = indexIcerik.replace(/js\/arayuz\/34-ux-645\.js(?:\?v=[^"']+)?/g, `js/arayuz/34-ux-645.js?v=${karma}`);
  fs.writeFileSync(indexPath, indexIcerik, 'utf-8');
  console.log(`✓ index.html meta paketi güncellendi (${karma})`);
}

// 5. Capacitor kabuk için www dizinini senkronize et
const wwwDir = path.join(ROOT_DIR, 'uygulama', 'kabuk', 'www');
if (fs.existsSync(path.dirname(wwwDir))) {
  const hataSayfasi = path.join(wwwDir, 'hata.html');
  const hataIcerigi = fs.existsSync(hataSayfasi) ? fs.readFileSync(hataSayfasi) : null;
  fs.rmSync(wwwDir, { recursive: true, force: true });
  fs.mkdirSync(wwwDir, { recursive: true });
  
  const dosyalarVeDizinler = [
    'index.html',
    'veri.json',
    'surum.json',
    'manifest.webmanifest',
    'favicon.ico',
    'sw.js',
    'robots.txt',
    'sitemap.xml',
    'paylasim.png',
    'css',
    'js',
    'ikon',
    'yazitipi',
    'evrenler',
  ];

  for (const oge of dosyalarVeDizinler) {
    const kaynak = path.join(ROOT_DIR, oge);
    const hedef = path.join(wwwDir, oge);
    if (fs.existsSync(kaynak)) {
      const stats = fs.statSync(kaynak);
      if (stats.isDirectory()) {
        fs.cpSync(kaynak, hedef, { recursive: true, filter: (src) => !isHiddenUniverseAssetPath(path.relative(ROOT_DIR, src)) });
      } else {
        copyPublicAsset(kaynak, hedef, oge);
      }
    }
  }
  if (hataIcerigi) fs.writeFileSync(hataSayfasi, hataIcerigi);
  console.log('✓ uygulama/kabuk/www yerel APK varlıkları güncellendi');
}

// 6. Cloudflare Pages uyumluluğu için dist dizinini senkronize et
const distDir = path.join(ROOT_DIR, 'dist');
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const distDosyalarVeDizinler = [
  'index.html',
  'veri.json',
  'surum.json',
  'manifest.webmanifest',
  'favicon.ico',
  'sw.js',
  'robots.txt',
  'sitemap.xml',
  'paylasim.png',
  'google-dogrulama.txt',
  '_headers',
  '_redirects',
  'css',
  'js',
  'ikon',
  'yazitipi',
  'evrenler',
];

// Web-only release, sürümü farklı veya hash'i uyuşmayan eski APK'yı production
// çıktısına taşımaz. Native artifact ancak aynı canonical sürüm ve metadata
// doğrulaması birlikte sağlanırsa dağıtılır; aksi halde web build güvenle devam eder.
const apkDir = path.join(ROOT_DIR, 'uygulama', 'indir');
let nativeApkReady = false;
try {
  const apkMeta = JSON.parse(fs.readFileSync(path.join(apkDir, 'apk.json'), 'utf8'));
  const apkPath = path.join(apkDir, 'tentiforapp.apk');
  const apkHash = crypto.createHash('sha256').update(fs.readFileSync(apkPath)).digest('hex');
  nativeApkReady = apkMeta.version === canonicalVersion
    && Number(apkMeta.sizeBytes) === fs.statSync(apkPath).size
    && apkMeta.sha256 === apkHash;
} catch {}
if (nativeApkReady) {
  const kaynak = path.join(ROOT_DIR, 'uygulama/indir');
  fs.cpSync(kaynak, path.join(distDir, 'uygulama/indir'), { recursive: true });
  console.log('✓ Sürüm uyumlu APK ve metadata dist içine kopyalandı');
} else {
  console.log('⚠ Web-only build: sürümü/hash’i uyuşmayan APK dist içine kopyalanmadı');
}
// Native/Termux kaynak kodu ve bundled www production web çıktısına taşınmaz.
for (const oge of ['uygulama/ac', '.well-known']) {
  const kaynak = path.join(ROOT_DIR, oge);
  const hedef = path.join(distDir, oge);
  if (fs.existsSync(kaynak)) fs.cpSync(kaynak, hedef, { recursive: true });
}

for (const oge of distDosyalarVeDizinler) {
  const kaynak = path.join(ROOT_DIR, oge);
  const hedef = path.join(distDir, oge);
  if (fs.existsSync(kaynak)) {
    const stats = fs.statSync(kaynak);
    if (stats.isDirectory()) {
      fs.cpSync(kaynak, hedef, { recursive: true, filter: (src) => !isHiddenUniverseAssetPath(path.relative(ROOT_DIR, src)) });
    } else {
      copyPublicAsset(kaynak, hedef, oge);
    }
  }
}
const seoIndex = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
// Crawlers/social bots receive a static page snapshot. Database entries come only from the
// privacy-filtered public RPC; local universe pages require an approved registry record and a
// matching evrenler/{id}.json file. Private/draft database rows are never copied into output.
// Deneme has no runtime catalog/payload; E126's generated path currently points to the
// unsupported #/ev/site/e126 route. Exclude only these broken URLs until their routes are fixed.
const excludedUnopenableWorldSlugs = new Set(['deneme']);
const seoRouteAllowed = (item) => !(item && item.tur === 'evren' && excludedUnopenableWorldSlugs.has(String(item.slug || '').toLowerCase()));
const staticSeoPages = [
  { tur: 'sayfa', path: '/tomye/', title: 'Tömye — TentiFor', description: 'Tömye evreni ve Tentiforverse arşiv içerikleri.' },
  { tur: 'sayfa', path: '/fan/', title: 'Fan evrenleri — TentiFor', description: 'TentiFor’te yayınlanmış fan evrenleri ve hikâyeler.' },
  { tur: 'sayfa', path: '/oyunlar/', title: 'Oyunlar — TentiFor', description: 'TentiFor oyunları ve yarışları.' },
  { tur: 'sayfa', path: '/atolye/', title: 'Atölye — TentiFor', description: 'TentiFor evren ve hikâye atölyesi.' },
  { tur: 'sayfa', path: '/yonetici/', title: 'Yönetici paneli — TentiFor', description: 'TentiFor yönetici paneli ve evren yönetim araçları.' },
  { tur: 'sayfa', path: '/okuma/', title: 'Okuma — TentiFor', description: 'TentiFor okuma alanı ve okuma rotaları.' },
  { tur: 'evren', slug: 'e25', baslik: veri.kanonEvrenleri?.e25?.ad || 'E25', ozet: typeof veri.kanonEvrenleri?.e25?.ozet === 'string' ? veri.kanonEvrenleri.e25.ozet : '' },
  { tur: 'evren', slug: 'e99', baslik: veri.e99?.ad || 'E99', ozet: typeof veri.e99?.ozet === 'string' ? veri.e99.ozet : '' },
  ...approvedCanonicalUniversePages(ROOT_DIR, veri)
].filter(seoRouteAllowed);
const appRoutes = [
  { path: '/sen/', title: 'Sen — TentiFor', description: 'TentiFor kullanıcı alanı, arşivci kartı, defter ve ayarlar.' },
  { path: '/arsiv/', title: 'Ana sayfa — TentiFor', description: 'Tentiforverse arşiv ana sayfası ve karakterler.' },
  { path: '/moderasyon/', title: 'Moderasyon — TentiFor', description: 'TentiFor moderasyon paneli. Erişim için moderatör kodu gerekir.' },
  { path: '/baglar/', title: 'Bağlar — TentiFor', description: 'TentiFor bağlar, aile ağacı ve ilişki ağı.' },
  { path: '/dunya/', title: 'Dünya — TentiFor', description: 'TentiFor dünya haritası ve zaman çizelgesi.' },
  { path: '/harita/', title: 'Harita — TentiFor', description: 'Tömye ve Ax-24 gezegen haritalarını keşfet.' },
  { path: '/belgeler/', title: 'Belgeler — TentiFor', description: 'TentiFor mektuplar, alıntılar ve belgeler.' },
  { path: '/testler/', title: 'Testler — TentiFor', description: 'TentiFor karakter ve kimlik testleri.' },
  { path: '/araclar/', title: 'Araçlar — TentiFor', description: 'TentiFor isim sistemi, yazılar ve araçlar.' },
  { path: '/proje/', title: 'Proje — TentiFor', description: 'TentiFor proje bilgileri, basın kiti ve moodboard.' },
];
let publicSeoPages = [];
if (process.env.TF_SEO_STATIC_ONLY !== '1') {
  try {
    publicSeoPages = (await fetchPublicSeoPages(ROOT_DIR)).filter(seoRouteAllowed);
    console.log(`✓ Public SEO snapshot alındı (${publicSeoPages.length} yayınlanabilir profil/evren/okuma rotası)`);
  } catch {
    console.warn('⚠ Public SEO snapshot alınamadı; açık statik ve onaylı yerel kanon rotaları üretildi. Gizli/taslak veriler fallback’e eklenmez.');
  }
}
const routeCount = writeSeoRoutes({ indexHtml: seoIndex, distDir, items: publicSeoPages, staticPages: staticSeoPages, appRoutes });
// dist temiz kurulur; kök dizindeki önceki derleme kopyalarını da yalnızca
// SEO üreticisinin işaretli evren HTML dosyaları için güncel kayıtlarla eşitle.
const currentPublicWorldSlugs = new Set([...publicSeoPages, ...staticSeoPages]
  .filter((item) => item && item.tur === 'evren' && typeof item.slug === 'string')
  .map((item) => item.slug.toLowerCase()));
for (const root of [ROOT_DIR, wwwDir]) {
  const worldDir = path.join(root, 'evren');
  if (!fs.existsSync(worldDir)) continue;
  for (const entry of fs.readdirSync(worldDir, { withFileTypes: true })) {
    const slug = entry.isDirectory()
      ? entry.name
      : (entry.isFile() && entry.name.toLowerCase().endsWith('.html') ? entry.name.slice(0, -5) : '');
    if (!slug || currentPublicWorldSlugs.has(slug.toLowerCase())) continue;
    if (entry.isDirectory()) {
      const routeDir = path.join(worldDir, entry.name);
      const routeIndex = path.join(routeDir, 'index.html');
      if (fs.existsSync(routeIndex) && fs.readFileSync(routeIndex, 'utf8').includes('data-seo-fallback')) {
        fs.unlinkSync(routeIndex);
        try { fs.rmdirSync(routeDir); } catch { /* preserve non-generated files */ }
      }
    }
    const flatPage = path.join(worldDir, `${slug}.html`);
    if (fs.existsSync(flatPage) && fs.readFileSync(flatPage, 'utf8').includes('data-seo-fallback')) fs.unlinkSync(flatPage);
  }
}
// Yönetici paneli kendi HTML rotasında çalışır; genel SEO fallback'i içindeki
// içerik bölümlerini gizleyen stil burada kullanılmaz. Panel Sen kabuğuna girmez.
const yoneticiHtml = renderStandaloneAdminPage(seoIndex);
for (const root of [distDir, ROOT_DIR, wwwDir]) {
  if (!root || !fs.existsSync(root)) continue;
  const targets = [path.join(root, 'yonetici', 'index.html'), path.join(root, 'yonetici.html')];
  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, yoneticiHtml, 'utf8');
  }
}
// Public SEO sayfalarını da kök dizin ve www ile eşitle; eski profil snapshot'ı
// silinmiş yayın kayıtlarını taşımaya devam etmesin.
for (const route of [...staticSeoPages, ...publicSeoPages, ...appRoutes]) {
  const routePath = route.path || seoMetadata(route)?.route || '';
  const rel = routePath.replace(/^\/+|\/+$/g, '');
  if (!rel) continue;
  const distRoute = path.join(distDir, rel);
  const rootRoute = path.join(ROOT_DIR, rel);
  if (fs.existsSync(distRoute)) {
    fs.cpSync(distRoute, rootRoute, { recursive: true });
    if (fs.existsSync(wwwDir)) fs.cpSync(distRoute, path.join(wwwDir, rel), { recursive: true });
  }
  const distFlat = path.join(distDir, `${rel}.html`);
  const rootFlat = path.join(ROOT_DIR, `${rel}.html`);
  if (fs.existsSync(distFlat)) {
    fs.copyFileSync(distFlat, rootFlat);
    if (fs.existsSync(wwwDir)) fs.copyFileSync(distFlat, path.join(wwwDir, `${rel}.html`));
  }
}
// SEO ve uygulama sayfalarının sabit HTML'sinde gizli evren başlıkları kalmasın.
for (const root of [ROOT_DIR, distDir, wwwDir]) {
  if (!root || !fs.existsSync(root)) continue;
  for (const file of fs.readdirSync(root, { recursive: true })) {
    if (typeof file !== 'string' || !file.endsWith('.html')) continue;
    const full = path.join(root, file);
    if (!fs.statSync(full).isFile()) continue;
    const html = fs.readFileSync(full, 'utf8');
    const cleaned = stripHiddenUniverseSections(html);
    if (cleaned !== html) fs.writeFileSync(full, cleaned, 'utf8');
  }
}
const seo404Content = renderSeoNotFound(seoIndex);
fs.writeFileSync(path.join(distDir, '404.html'), seo404Content, 'utf8');
fs.writeFileSync(path.join(ROOT_DIR, '404.html'), seo404Content, 'utf8');
if (fs.existsSync(wwwDir)) {
  fs.writeFileSync(path.join(wwwDir, '404.html'), seo404Content, 'utf8');
}
if (fs.existsSync(path.join(distDir, 'sitemap.xml'))) {
  fs.copyFileSync(path.join(distDir, 'sitemap.xml'), path.join(ROOT_DIR, 'sitemap.xml'));
}
console.log(`✓ ${routeCount} public SEO sayfası ve yalnızca açık rotaları içeren sitemap üretildi`);
console.log('✓ dist üretim dizini senkronize edildi (Cloudflare Pages uyumlu)');

console.log('✨ Paketleme başarıyla tamamlandı.');
process.exit(0);
