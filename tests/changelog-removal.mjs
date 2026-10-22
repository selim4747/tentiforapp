import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const pkg = JSON.parse(read('package.json'));
assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'uygulama sürümü geçerli semver olmalı');
assert.equal(JSON.parse(read('veri.json')).surum, pkg.version);
assert.equal(JSON.parse(read('manifest.webmanifest')).version, pkg.version);
assert.equal(JSON.parse(read('uygulama/kabuk/package.json')).version, pkg.version);
const androidGradle = read('uygulama/kabuk/android/app/build.gradle');
assert.ok(androidGradle.includes(`versionName "${pkg.version}"`));
const [major, minor, patch] = pkg.version.split('.').map(Number);
// 6.5.1 starts at versionCode 6500; each following patch release increments it once.
const expectedVersionCode = major * 1000 + minor * 100 + patch - 1;
assert.match(androidGradle, new RegExp(`versionCode\\s+${expectedVersionCode}\\b`), 'Android versionCode should stay monotonic with the app release');
const apkMeta = JSON.parse(read('uygulama/indir/apk.json'));
assert.ok(apkMeta.versionCode <= expectedVersionCode, 'APK metadata must not advertise a version code newer than the Android app');
if (apkMeta.versionCode < expectedVersionCode) assert.notEqual(apkMeta.version, pkg.version, 'a stale APK must not be relabeled as the current app release');
else assert.equal(apkMeta.version, pkg.version, 'a current APK metadata version must match the app');

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
