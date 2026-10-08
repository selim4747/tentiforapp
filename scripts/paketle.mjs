import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { approvedCanonicalUniversePages, fetchPublicSeoPages, renderSeoNotFound, writeSeoRoutes } from './public-seo.mjs';
import { syncTerminalRoutes } from './sync-terminal-routes.mjs';

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
if (!/^\d+\.\d+\.\d+$/.test(canonicalVersion)) {
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

// 2. Paket karması hesapla. Tarih kullanılmaz; aynı girdiler aynı cache adını üretir.
syncTerminalRoutes(ROOT_DIR);
const hashGirdileri = [
  'index.html', 'manifest.webmanifest', 'package.json', 'veri.json',
  'veri-degisiklik.json', 'paylasim.png', 'favicon.ico', 'css', 'js', 'ikon', 'yazitipi', 'evrenler'
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

console.log(`✓ Yeni paket karması: ${karma}`);

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
  indexIcerik = indexIcerik.replace(/css\/style\.css\?v=[^"']+/g, 'css/style.css?v=be2f302c44ec');
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
    'veri-degisiklik.json'
  ];

  for (const oge of dosyalarVeDizinler) {
    const kaynak = path.join(ROOT_DIR, oge);
    const hedef = path.join(wwwDir, oge);
    if (fs.existsSync(kaynak)) {
      const stats = fs.statSync(kaynak);
      if (stats.isDirectory()) {
        fs.cpSync(kaynak, hedef, { recursive: true });
      } else {
        fs.copyFileSync(kaynak, hedef);
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
  'veri-degisiklik.json',
  'surum.json',
  'manifest.webmanifest',
  'favicon.ico',
  'sw.js',
  'robots.txt',
  'sitemap.xml',
  'paylasim.png',
  'google-dogrulama.txt',
  '_headers',
  'css',
  'js',
  'ikon',
  'yazitipi',
  'evrenler'
];

// APK dağıtımı ve Android App Links de production çıktısına aittir.
// Native/Termux kaynak kodu ve bundled www production web çıktısına taşınmaz.
for (const oge of ['uygulama/indir', 'uygulama/ac', '.well-known']) {
  const kaynak = path.join(ROOT_DIR, oge);
  const hedef = path.join(distDir, oge);
  if (fs.existsSync(kaynak)) fs.cpSync(kaynak, hedef, { recursive: true });
}
console.log('✓ APK, APK metadatası ve Android App Links dist içine kopyalandı');

for (const oge of distDosyalarVeDizinler) {
  const kaynak = path.join(ROOT_DIR, oge);
  const hedef = path.join(distDir, oge);
  if (fs.existsSync(kaynak)) {
    const stats = fs.statSync(kaynak);
    if (stats.isDirectory()) {
      fs.cpSync(kaynak, hedef, { recursive: true });
    } else {
      fs.copyFileSync(kaynak, hedef);
    }
  }
}
const seoIndex = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
// Crawlers/social bots receive a static page snapshot. Database entries come only from the
// privacy-filtered public RPC; local universe pages require an approved registry record and a
// matching evrenler/{id}.json file. Private/draft database rows are never copied into output.
const staticSeoPages = [
  { tur: 'sayfa', path: '/tomye/', title: 'Tömye — TentiFor', description: 'Tömye evreni ve Tentiforverse arşiv içerikleri.' },
  { tur: 'sayfa', path: '/fan/', title: 'Fan evrenleri — TentiFor', description: 'TentiFor’te yayınlanmış fan evrenleri ve hikâyeler.' },
  { tur: 'sayfa', path: '/oyunlar/', title: 'Oyunlar — TentiFor', description: 'TentiFor oyunları ve yarışları.' },
  { tur: 'sayfa', path: '/atolye/', title: 'Atölye — TentiFor', description: 'TentiFor evren ve hikâye atölyesi.' },
  { tur: 'sayfa', path: '/okuma/', title: 'Okuma — TentiFor', description: 'TentiFor okuma alanı ve okuma rotaları.' },
  { tur: 'evren', slug: 'e25', baslik: veri.kanonEvrenleri?.e25?.ad || 'E25', ozet: typeof veri.kanonEvrenleri?.e25?.ozet === 'string' ? veri.kanonEvrenleri.e25.ozet : '' },
  { tur: 'evren', slug: 'e99', baslik: veri.e99?.ad || 'E99', ozet: typeof veri.e99?.ozet === 'string' ? veri.e99.ozet : '' },
  ...approvedCanonicalUniversePages(ROOT_DIR, veri)
];
const appRoutes = [
  { path: '/moderasyon/', title: 'Moderasyon — TentiFor', description: 'TentiFor moderasyon paneli. Erişim için moderatör kodu gerekir.' }
];
let publicSeoPages = [];
if (process.env.TF_SEO_STATIC_ONLY !== '1') {
  try {
    publicSeoPages = await fetchPublicSeoPages(ROOT_DIR);
    console.log(`✓ Public SEO snapshot alındı (${publicSeoPages.length} yayınlanabilir profil/evren/okuma rotası)`);
  } catch {
    console.warn('⚠ Public SEO snapshot alınamadı; açık statik ve onaylı yerel kanon rotaları üretildi. Gizli/taslak veriler fallback’e eklenmez.');
  }
}
const routeCount = writeSeoRoutes({ indexHtml: seoIndex, distDir, items: publicSeoPages, staticPages: staticSeoPages, appRoutes });
fs.writeFileSync(path.join(distDir, '404.html'), renderSeoNotFound(seoIndex), 'utf8');
console.log(`✓ ${routeCount} public SEO sayfası ve yalnızca açık rotaları içeren sitemap üretildi`);
console.log('✓ dist üretim dizini senkronize edildi (Cloudflare Pages uyumlu)');

console.log('✨ Paketleme başarıyla tamamlandı.');
