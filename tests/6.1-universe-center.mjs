import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'js/engine/101-v61-universe.js'), 'utf8');
const profileSource = fs.readFileSync(path.join(root, 'js/studio/53-evren-kurulum.js'), 'utf8');
const customFieldSource = fs.readFileSync(path.join(root, 'js/studio/40-fan-atolye.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(root, 'veri.json'), 'utf8'));

assert.equal(data.surum, pkg.version);
assert.match(pkg.version, /^\d+\.\d+\.\d+(?:\.\d+)?$/);
assert.match(index, /js\/engine\/101-v61-universe\.js\?v=615/);
for (const token of ['Evren Merkezi', 'Zaman çizelgesi', 'İlişkiler', 'Ansiklopedi', 'Notlar', 'Beni şaşırt', 'Spoilerli kayıtları göster', 'tf61-wizard-form', 'Başlangıç seçenekleri', 'Hazır başlangıç profili', 'Yalnızca boş bölümler', 'tf61-extra-fields']) {
  assert.ok(source.includes(token), `6.1 modülünde eksik sözleşme: ${token}`);
}
assert.match(source, /evtUygula\(id, profileId\)/, 'seçilen dünya profili oluşturulan taslağa aktarılmalı');
assert.match(source, /typeof created === 'string' \? created : created\.id/);
const optionalStart = source.indexOf('<details class=\"tf61-extra\">');
const optionalEnd = source.indexOf('</details>', optionalStart);
assert.ok(optionalStart > source.indexOf('id=\"tf61-ozet\"') && optionalEnd > optionalStart, 'starter fields must follow core identity fields inside a collapsed optional group');
assert.ok(source.includes('id="tf61-profil"') && source.slice(optionalStart, optionalEnd).includes('profilePickerHtml()'), 'profil seçimi kapalı başlangıç bölümünde oluşturulmalı');
for (const field of ['tf61-kisiler', 'tf61-yerler', 'tf61-kurallar', 'tf61-sozluk']) {
  const fieldStart = source.indexOf('id=\"' + field + '\"');
  assert.ok(fieldStart > optionalStart && fieldStart < optionalEnd, field + ' must remain inside the optional starter group');
}
assert.ok(profileSource.includes('Başlangıç profilleri · yalnızca boş bölümler doldurulur; mevcut içerik korunur.'), 'kurucu profilleri içerik varken de açıklamalı biçimde gösterilmeli');
assert.ok(profileSource.indexOf('const profiles=') < profileSource.indexOf('<div class="evk-cubuk" role="progressbar"'), 'profil kartları kurucu adım listesinden önce sunulmalı');
assert.ok(customFieldSource.includes('ad:"Özel alanlar · kendi alanların"'), 'özel alan başlığı amacını açıkça belirtmeli');
for (const token of ['tf61-center', 'tf61-stat-grid', 'tf61-timeline', 'tf61-wizard', 'tf61-form-grid', '.tf61-extra>summary']) {
  assert.ok(css.includes(token), `6.1 stilinde eksik seçici: ${token}`);
}
for (const token of ['.alt-menu.alt-menu-evren{grid-template-columns:repeat(6,1fr)}', 'html:has(.es-katman) .alt-menu', 'html:has(.perde:not([hidden])) .alt-menu', 'html:has(.mobil-menu-katman) .alt-menu']) {
  assert.ok(css.includes(token), `mobil menü katman sözleşmesinde eksik: ${token}`);
}
assert.ok(css.includes('.tf61-profile-picker select{width:100%;min-height:44px'), 'profil seçicisi touch-friendly olmalı');
const cssHash = crypto.createHash('md5').update(css).digest('hex').slice(0, 12);
assert.ok(index.includes(`css/style.css?v=${cssHash}`), 'stylesheet cache-buster current CSS hash’ine eşit olmalı');
console.log('6.1 universe center contracts: PASS');
