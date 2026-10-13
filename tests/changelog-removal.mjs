import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.version, '6.4.10', 'uygulama sürümü tam olarak 6.4.10 olmalı');
assert.equal(JSON.parse(read('veri.json')).surum, pkg.version);
assert.equal(JSON.parse(read('manifest.webmanifest')).version, pkg.version);
assert.equal(JSON.parse(read('uygulama/kabuk/package.json')).version, pkg.version);
const androidGradle = read('uygulama/kabuk/android/app/build.gradle');
assert.ok(androidGradle.includes(`versionName "${pkg.version}"`));
assert.match(androidGradle, new RegExp(`versionCode\\s+${Number(pkg.version.replaceAll('.', ''))}\\b`), 'Android versionCode should stay monotonic with the app release');

const index = read('index.html');
assert.doesNotMatch(index, /id="yenilikAlan"|id="surumNotuAlan"|yenilikler · günün kaydı|26-ziyaret-yenilikleri/);
assert.equal(fs.existsSync('js/arsiv/26-ziyaret-yenilikleri.js'), false, 'changelog modülü kaynaklardan kaldırılmalı');
const bundle1 = read('js/paket-1.js');
const bundle2 = read('js/paket-2.js');
assert.equal(bundle1.includes('["surumler","Değişiklik günlüğü"]'), false, 'paketlenmiş gezinme sürüm günlüğüne yönlendirmemeli');
assert.equal(bundle1.includes('Değişiklik günlüğü'), false, 'paketlenmiş menü eski günlüğü göstermemeli');
for (const term of ['26-ziyaret-yenilikleri.js', 'ZIYARET_IZ_ANAHTAR', 'ziyaretSayfaSayisi', 'yeniliklerCiz', 'data-yenilik-git']) {
  assert.equal(bundle1.includes(term), false, `birinci bundle changelog işareti taşımamalı: ${term}`);
}
for (const term of ['ziyaretSayfaSayisi', 'alt-yeni']) {
  assert.equal(bundle2.includes(term), false, `mobil navigasyon changelog işareti taşımamalı: ${term}`);
}
assert.doesNotMatch(read('js/core/24-arsiv-mantigi.js'), /ziyaretKarsilastir|yeniliklerCiz/);
assert.doesNotMatch(read('js/core/24-arsiv-mantigi.js'), /surumNotuCiz|sürüm notu/);
assert.doesNotMatch(read('js/arayuz/18-gezinme.js'), /ziyaretSayfaSayisi|gez-yeni/);
assert.doesNotMatch(read('js/core/42-mobil.js'), /ziyaretSayfaSayisi|alt-yeni/);
console.log('Changelog removal + app version: PASS');
