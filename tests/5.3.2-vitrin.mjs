import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/topluluk/31-topluluk.js', 'utf8');
const data = JSON.parse(fs.readFileSync('veri.json', 'utf8'));
const changes = JSON.parse(fs.readFileSync('veri-degisiklik.json', 'utf8'));

assert.match(source, /function vitrinEvrenIlerlemeleri\(\)/);
assert.match(source, /typeof rbAg!=="function"/);
assert.match(source, /a\.okunan\/a\.toplam>=\.35/);
assert.match(source, /vitrinKanonKisileri\(\)/);
assert.match(source, /id:"kanon:"\+n\+":"/);
assert.match(source, /d=u\.karakter\?vitrinKarakterListesi\(\)/);
assert.match(source, /e\.evren\|\|e\.evrenId\|\|e\.kanonEvreni/);
assert.equal(data.surum, '5.3.2');
assert.equal(changes[0].surum, '5.3.2');
assert.ok(changes[0].maddeler.some((x) => x.includes('%35')));
console.log('5.3.2 vitrin: dış evren ilerleme/rozet filtresi ve profil çözümleme kontrolleri geçti.');
