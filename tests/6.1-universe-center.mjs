import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'js/engine/101-v61-universe.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(root, 'veri.json'), 'utf8'));

assert.equal(pkg.version, '6.2.6');
assert.equal(data.surum, '6.2.6');
assert.match(index, /js\/engine\/101-v61-universe\.js\?v=612/);
for (const token of ['Evren Merkezi', 'Zaman çizelgesi', 'İlişkiler', 'Ansiklopedi', 'Notlar', 'Beni şaşırt', 'Spoilerli kayıtları göster', 'tf61-wizard-form']) {
  assert.ok(source.includes(token), `6.1 modülünde eksik sözleşme: ${token}`);
}
assert.match(source, /typeof created === 'string' \? created : created\.id/);
for (const token of ['tf61-center', 'tf61-stat-grid', 'tf61-timeline', 'tf61-wizard', 'tf61-form-grid']) {
  assert.ok(css.includes(token), `6.1 stilinde eksik seçici: ${token}`);
}
for (const token of ['.alt-menu.alt-menu-evren{grid-template-columns:repeat(6,1fr)}', 'html:has(.es-katman) .alt-menu', 'html:has(.perde:not([hidden])) .alt-menu', 'html:has(.mobil-menu-katman) .alt-menu']) {
  assert.ok(css.includes(token), `mobil menü katman sözleşmesinde eksik: ${token}`);
}
assert.match(index, /css\/style\.css\?v=be2f302c44ec/);
console.log('6.1 universe center contracts: PASS');
