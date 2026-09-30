import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🚀 TentiforApp paketleme başlatılıyor...');

// 1. Veri kontrolü
const veriPath = path.join(ROOT_DIR, 'veri.json');
if (!fs.existsSync(veriPath)) {
  console.error('❌ veri.json bulunamadı!');
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

// 2. Paket karması hesapla
const karma = crypto.createHash('md5')
  .update(veriIcerik)
  .update(Date.now().toString())
  .digest('hex')
  .substring(0, 12);

console.log(`✓ Yeni paket karması: ${karma}`);

// 3. surum.json güncelle
const surumVeri = {
  paket: karma,
  surum: veri.surum || '4.5.0',
  kuruldu: new Date().toISOString()
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
  fs.writeFileSync(indexPath, indexIcerik, 'utf-8');
  console.log(`✓ index.html meta paketi güncellendi (${karma})`);
}

// 5. Capacitor kabuk için www dizinini senkronize et
const wwwDir = path.join(ROOT_DIR, 'uygulama', 'kabuk', 'www');
if (fs.existsSync(path.dirname(wwwDir))) {
  fs.mkdirSync(wwwDir, { recursive: true });
  
  const dosyalarVeDizinler = [
    'index.html',
    'veri.json',
    'surum.json',
    'manifest.webmanifest',
    'sw.js',
    'robots.txt',
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
  console.log('✓ uygulama/kabuk/www yerel APK varlıkları güncellendi');
}

// 6. Cloudflare Pages uyumluluğu için dist dizinini senkronize et
const distDir = path.join(ROOT_DIR, 'dist');
fs.mkdirSync(distDir, { recursive: true });

const distDosyalarVeDizinler = [
  'index.html',
  'veri.json',
  'veri-degisiklik.json',
  'surum.json',
  'manifest.webmanifest',
  'sw.js',
  'robots.txt',
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
for (const oge of ['uygulama', '.well-known']) {
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
console.log('✓ dist üretim dizini senkronize edildi (Cloudflare Pages uyumlu)');

console.log('✨ Paketleme başarıyla tamamlandı.');
