import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/core/42-mobil.js', 'utf8');
const bundle = fs.readFileSync('js/paket-2.js', 'utf8');
const css = fs.readFileSync('css/style.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const paket = JSON.parse(fs.readFileSync('surum.json', 'utf8')).paket;
const menuBundleUrl = `js/paket-2.js?v=${paket}`;
const copies = [
  'uygulama/kabuk/www/js/core/42-mobil.js',
  'uygulama/kabuk/www/js/paket-2.js',
  'uygulama/kabuk/www/css/style.css',
  'uygulama/kabuk/www/index.html',
  'uygulama/kabuk/www/sw.js'
].map((file) => [file, fs.readFileSync(file, 'utf8')]);

for (const [name, code] of [['source', source], ['bundle', bundle]]) {
  assert.equal((code.match(/function mobilMenuAc\(/g) || []).length, 1, `${name}: tek açma fonksiyonu`);
  assert.equal((code.match(/function mobilMenuKapat\(/g) || []).length, 1, `${name}: tek kapatma fonksiyonu`);
  assert.match(code, /classList\.toggle\("menu-ustu",t\)/, `${name}: alt menü durumu`);
  assert.match(code, /setAttribute\("aria-hidden",String\(t\)\)/, `${name}: aria durumu`);
  assert.match(code, /try\{mobilMenuCiz\(\),altMenuCiz\(\)\}/, `${name}: açma hata koruması`);
  assert.match(code, /try\{altMenuCiz\(\)\}catch\(a\)\{console\.error\("Mobil Menü kapatılamadı",a\)\}/, `${name}: kapatma hata koruması`);
  assert.match(code, /data-mobil-menu.*stopImmediatePropagation\(\).*mobilMenuAc/, `${name}: Menü event izolasyonu`);
}

assert.match(css, /\.mobil-menu-katman\{z-index:120!important;isolation:isolate;\}/);
assert.match(css, /Menü erişilebilirliği:/, 'overlay erişilebilirlik koruması');
assert.match(css, /html:has\(\.mobil-menu-katman\) \.alt-menu[\s\S]*pointer-events:auto!important/, 'mobil menü düğmesi dokunulabilir');
assert.doesNotMatch(source, /Menü tıklaması bir üst Evren seçici katmanında kaybolmasın/, 'eski capture kilidi kaldırıldı');
assert.match(source, /evrenSeciciKapat\(\).*mobilMenuAc\(\)/, 'evren seçici açıkken Menü tek dokunuşta açılır');
assert.match(index, new RegExp(menuBundleUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(sw, new RegExp(menuBundleUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
for (const [file, content] of copies) {
  if (file.endsWith('style.css')) assert.match(content, /\.alt-menu\.menu-ustu\{visibility:hidden!important/);
  if (file.endsWith('index.html') || file.endsWith('sw.js')) assert.match(content, new RegExp(menuBundleUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  if (file.endsWith('paket-2.js')) assert.match(content, /classList\.toggle\("menu-ustu",t\)/);
}

console.log('mobile menu regression contracts: PASS');
