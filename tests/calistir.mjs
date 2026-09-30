import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🧪 TentiforApp testleri çalıştırılıyor...');

// 1. Dosya varlık testleri
const zorunluDosyalar = [
  'index.html',
  'veri.json',
  'css/style.css',
  'manifest.webmanifest',
  'sw.js',
  'server.js',
  'package.json'
];

let basarisiz = false;
for (const d of zorunluDosyalar) {
  if (!fs.existsSync(path.join(ROOT_DIR, d))) {
    console.error(`❌ Zorunlu dosya eksik: ${d}`);
    basarisiz = true;
  } else {
    console.log(`✓ Dosya mevcut: ${d}`);
  }
}

// 2. veri.json bütünlük testi
try {
  const veri = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'veri.json'), 'utf-8'));
  if (!veri.surum) throw new Error('Sürüm alanı eksik');
  console.log(`✓ veri.json geçerli (Sürüm: ${veri.surum})`);
} catch (e) {
  console.error('❌ veri.json test hatası:', e.message);
  basarisiz = true;
}

if (basarisiz) {
  process.exit(1);
} else {
  console.log('🎉 Tüm testler başarıyla geçti!');
}
