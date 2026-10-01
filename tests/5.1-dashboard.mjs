import assert from 'node:assert/strict';
import fs from 'node:fs';

const module = fs.readFileSync('js/engine/92-v51-dashboard.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const data = JSON.parse(fs.readFileSync('veri.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const marker of [
  'Evren merkezi',
  'İndirilenlerim',
  'Evren oluşturma sihirbazı',
  'Bu ayki kullanımın',
  'Bildirim merkezi',
  'cihaz ve eşitleme durumu',
  'Yerel yedek oluştur',
  'data-tf51-offline',
]) assert(module.includes(marker), `missing 5.1 feature: ${marker}`);

assert.match(index, /js\/engine\/92-v51-dashboard\.js\?v=\d+/);
assert.equal(data.surum, pkg.version);
console.log('5.1 dashboard feature assertions: PASS');
