import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HIDDEN_UNIVERSE_IDS, HIDDEN_UNIVERSE_ROUTES, HIDDEN_UNIVERSE_FILES, isHiddenUniversePath, isHiddenUniverseAssetPath } from '../scripts/visibility.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANNED = /claude|eterya|fornek-eterya|modelEvren|claudeEvren/i;
const deletedFiles = [
  'claude.html',
  'claude/index.html',
  'eterya.html',
  'eterya/index.html',
  'evrenler/fornek-eterya.json',
  'ikon/og/claude.png',
  'js/arsiv/33-claude-evreni.js',
  'js/arsiv/34b-model-evreni.js',
  'js/arsiv/35-somdo-oyunlari.js',
  'js/arsiv/67-claude-evreni-ii.js'
];

for (const relative of deletedFiles) {
  assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `Silinen dosya hâlâ mevcut: ${relative}`);
}

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'veri.json'), 'utf8'));
assert.equal(Object.prototype.hasOwnProperty.call(data, 'claudeEvreni'), false, 'veri.json içinde silinen evren anahtarı kaldı');
assert.equal(JSON.stringify(data).match(BANNED), null, 'veri.json içinde silinen evren metni kaldı');

assert.equal(HIDDEN_UNIVERSE_IDS.size, 0, 'Silme sonrası gizleme filtresi hâlâ kimlik saklıyor');
assert.equal(HIDDEN_UNIVERSE_ROUTES.size, 0, 'Silme sonrası gizleme filtresi hâlâ route saklıyor');
assert.equal(HIDDEN_UNIVERSE_FILES.size, 0, 'Silme sonrası gizleme filtresi hâlâ dosya saklıyor');
assert.equal(isHiddenUniversePath('evrenler/ornek.json'), false, 'Görünürlük filtresi beklenmedik biçimde aktif');
assert.equal(isHiddenUniverseAssetPath('js/paket-1.js'), false, 'Asset görünürlük filtresi beklenmedik biçimde aktif');

const scanRoots = ['index.html', '404.html', '_redirects', 'js', 'scripts', 'dist', 'uygulama/kabuk/www'];
const excluded = new Set(['raporlar', '.git', 'node_modules']);
function filesUnder(relative) {
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  const result = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    result.push(...filesUnder(path.join(relative, entry.name)));
  }
  return result;
}

for (const absolute of scanRoots.flatMap(filesUnder)) {
  const relative = path.relative(ROOT, absolute).replaceAll('\\', '/');
  if (!/\.(html?|js|mjs|json|txt|xml|css)$/.test(relative)) continue;
  const content = fs.readFileSync(absolute, 'utf8');
  assert.equal(BANNED.test(content), false, `Üretim/kaynak yüzeyinde silinen evren referansı: ${relative}`);
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const module of ['33-claude-evreni.js', '34b-model-evreni.js', '35-somdo-oyunlari.js', '67-claude-evreni-ii.js']) {
  assert.equal(html.includes(module), false, `index.html silinen modülü yüklemeye devam ediyor: ${module}`);
}
const sitemap = fs.readFileSync(path.join(ROOT, 'dist/sitemap.xml'), 'utf8');
assert.equal(BANNED.test(sitemap), false, 'Sitemap silinen evren route’u içeriyor');

console.log('6.4.3 emekli evren kaldırma: PASS (kaynak, bundle, route, veri, dist, sitemap ve görünürlük filtresi)');
