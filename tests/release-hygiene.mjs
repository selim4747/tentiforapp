import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const pkg = readJson('package.json');
const data = readJson('veri.json');
const manifest = readJson('manifest.webmanifest');
const shellPkg = readJson('uygulama/kabuk/package.json');

assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
assert.equal(data.surum, pkg.version, 'veri.json package.json ile aynı sürümü taşımalı');
assert.equal(manifest.version, pkg.version, 'manifest package.json ile aynı sürümü taşımalı');
assert.equal(shellPkg.version, pkg.version, 'APK kabuğu package.json ile aynı sürümü taşımalı');
assert.match(manifest.name, new RegExp(` ${pkg.version.replaceAll('.', '\\.')}`));
assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf8').split('\n')[0], new RegExp(`v${pkg.version.replaceAll('.', '\\.')}`));
assert.match(fs.readFileSync(path.join(root, 'js/engine/91-v473-uyelik.js'), 'utf8'), new RegExp(`SURUM = '${pkg.version.replaceAll('.', '\\.')}'`));

const runBuild = () => execFileSync(process.execPath, ['scripts/paketle.mjs'], { cwd: root, encoding: 'utf8' });
runBuild();
const first = readJson('surum.json');
const firstHash = first.paket;
runBuild();
const second = readJson('surum.json');
assert.equal(second.paket, firstHash, 'aynı girdiler deterministik paket hash üretmeli');
assert.equal(second.kuruldu, first.kuruldu, 'aynı hash yeniden build edilince kurulum tarihi değişmemeli');

const compare = (a, b) => {
  assert.equal(fs.readFileSync(path.join(root, a), 'utf8'), fs.readFileSync(path.join(root, b), 'utf8'), `${a} ve ${b} senkron olmalı`);
};
for (const file of ['index.html', 'veri.json', 'surum.json', 'manifest.webmanifest', 'sw.js', 'veri-degisiklik.json']) {
  compare(file, path.join('uygulama/kabuk/www', file));
  compare(file, path.join('dist', file));
}
assert.equal(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const ONBELLEK = "tentiforapp-([^"]+)"/)[1], second.paket);
const indexText = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const swText = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const setupSql = fs.readFileSync(path.join(root, 'supabase/kurulum.sql'), 'utf8');
for (const fn of ['kurulum_surumu', 'abonelik_hediye', 'kullaniciya_bildir', 'bildirimlerim']) {
  const count = (setupSql.match(new RegExp(`create or replace function public\\.${fn}\\b`, 'g')) || []).length;
  assert.equal(count, 1, `kurulum.sql içinde ${fn} tek kez tanımlı olmalı`);
}
assert.match(swText, /yedekKopya\(istek, true\)/, 'sürümlü asset eski query kopyasına düşmemeli');
assert.match(fs.readFileSync(path.join(root, 'js/core/46-guncelleme.js'), 'utf8'), /getRegistration\("\/"\)/, 'güncelleme worker kaydını kökten almalı');
for (const asset of ['js/paket-2.js', 'js/engine/92-v51-dashboard.js']) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(indexText, new RegExp(`${escaped}\\?v=${second.paket}`), `${asset} index cache sürümü güncel olmalı`);
  assert.match(swText, new RegExp(`${escaped}\\?v=${second.paket}`), `${asset} service worker cache sürümü güncel olmalı`);
}
console.log('Release hygiene: PASS (version sync, deterministic hash, APK/dist sync)');
