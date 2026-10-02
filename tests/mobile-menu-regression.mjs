import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/core/42-mobil.js', 'utf8');
const bundle = fs.readFileSync('js/paket-2.js', 'utf8');
const css = fs.readFileSync('css/style.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const paket = JSON.parse(fs.readFileSync('surum.json', 'utf8')).paket;
const menuBundleUrl = `js/paket-2.js?v=${paket}`;

// Kaynak arşivinde APK/diğer özellikler korunur; web runtime bundle'ında alt Menü yoktur.
assert.match(source, /function mobilMenuAc\(/);
assert.match(bundle, /function altMenuCiz\(\)\{\}function mobilMenuKapat\(\)\{\}/);
assert.doesNotMatch(bundle, /const ALT_MENU=/);
assert.doesNotMatch(bundle, /function mobilMenuAc\(/);
assert.match(css, /\.alt-menu,\.mobil-menu-katman\{display:none!important\}/);
assert.match(css, /body\{padding-bottom:0!important\}/);
for (const text of [index, sw]) {
  assert.match(text, new RegExp(menuBundleUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
const webCopy = fs.readFileSync('uygulama/kabuk/www/js/paket-2.js', 'utf8');
assert.match(webCopy, /function altMenuCiz\(\)\{\}function mobilMenuKapat\(\)\{\}/);
assert.match(fs.readFileSync('uygulama/kabuk/www/css/style.css', 'utf8'), /display:none!important/);
console.log('mobile menu disabled experiment contracts: PASS');
