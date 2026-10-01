import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const pkg = readJson('package.json');
const data = readJson('veri.json');
const manifest = readJson('manifest.webmanifest');
const changelog = readJson('veri-degisiklik.json');

assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
assert.equal(data.surum, pkg.version, 'veri.json package.json ile aynı sürümü taşımalı');
assert.equal(manifest.version, pkg.version, 'manifest package.json ile aynı sürümü taşımalı');
assert.equal(changelog[0].surum, pkg.version, 'değişiklik günlüğünün ilk sürümü package.json ile aynı olmalı');
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
for (const file of ['index.html', 'veri.json', 'surum.json', 'manifest.webmanifest', 'sw.js', 'veri-degisiklik.json']) compare(file, path.join('dist', file));
assert.equal(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const ONBELLEK = "tentiforapp-([^"]+)"/)[1], second.paket);
console.log('Release hygiene: PASS (version sync, deterministic hash, dist sync)');
