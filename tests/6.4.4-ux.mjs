import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const source31 = read('js/arayuz/31-ux-64.js');
const source32 = read('js/arayuz/32-ux-642.js');
const source33 = read('js/arayuz/33-ux-644.js');
const html = read('index.html');
const css = read('css/style.css');
const packageVersion = JSON.parse(read('package.json')).version.replaceAll('.', '\\.');

assert.match(source31, /data-tf64-onboard-close/);
assert.match(source31, /data-tf64-export/);
assert.match(source31, /data-tf64-payment/);
assert.match(source31, /data-tf64-mute/);
assert.match(source31, /data-tf64-block/);
assert.doesNotMatch(source31, /hasAttribute\("data-tf64(?:OnboardClose|Export|Payment|Mute|Block)"\)/);
assert.match(html, /js\/arayuz\/33-ux-644\.js/);
assert.match(source33, /tf644ReadingToolbar/);
assert.match(source33, /tf644Breadcrumb/);
assert.match(source33, /tf644-progress/);
assert.match(source33, /wizardDraft/);
assert.match(source33, /data-tf644-read-all/);
for (const selector of ['.tf644-reading-toolbar', '.tf644-breadcrumb', '.tf644-progress', '.tf644-notification-actions']) assert.match(css, new RegExp(selector.replace(/[.]/g, '\\.') + '[{,]'));
for (const file of ['package.json', 'manifest.webmanifest', 'surum.json', 'veri.json', 'README.md']) assert.match(read(file), new RegExp(packageVersion));
assert.match(source32, new RegExp(packageVersion));

console.log('6.4.4 UX contracts: PASS (handler adları, script bağlantısı, onboarding, okuma araçları, breadcrumb, bildirim araçları ve sürüm)');
