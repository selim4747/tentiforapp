import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.version, '6.4.7', 'uygulama sürümü tam olarak 6.4.7 olmalı');
assert.equal(JSON.parse(read('veri.json')).surum, pkg.version);
assert.equal(JSON.parse(read('manifest.webmanifest')).version, pkg.version);
assert.equal(JSON.parse(read('uygulama/kabuk/package.json')).version, pkg.version);
assert.ok(read('uygulama/kabuk/android/app/build.gradle').includes(`versionName "${pkg.version}"`));

const index = read('index.html');
assert.doesNotMatch(index, /id="yenilikAlan"|yenilikler · günün kaydı|26-ziyaret-yenilikleri/);
assert.equal(fs.existsSync('js/arsiv/26-ziyaret-yenilikleri.js'), false, 'changelog modülü kaynaklardan kaldırılmalı');
const bundle1 = read('js/paket-1.js');
const bundle2 = read('js/paket-2.js');
for (const term of ['26-ziyaret-yenilikleri.js', 'ZIYARET_IZ_ANAHTAR', 'ziyaretSayfaSayisi', 'yeniliklerCiz', 'data-yenilik-git']) {
  assert.equal(bundle1.includes(term), false, `birinci bundle changelog işareti taşımamalı: ${term}`);
}
for (const term of ['ziyaretSayfaSayisi', 'alt-yeni']) {
  assert.equal(bundle2.includes(term), false, `mobil navigasyon changelog işareti taşımamalı: ${term}`);
}
assert.doesNotMatch(read('js/core/24-arsiv-mantigi.js'), /ziyaretKarsilastir|yeniliklerCiz/);
assert.doesNotMatch(read('js/arayuz/18-gezinme.js'), /ziyaretSayfaSayisi|gez-yeni/);
assert.doesNotMatch(read('js/core/42-mobil.js'), /ziyaretSayfaSayisi|alt-yeni/);
console.log('Changelog removal + app version: PASS');
