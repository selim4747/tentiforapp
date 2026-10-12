import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'veri.json'), 'utf8'));
const packaged = JSON.parse(fs.readFileSync(path.join(root, 'uygulama/kabuk/www/veri.json'), 'utf8'));
assert.deepEqual(packaged, canonical, 'Web/uygulama JSON kopyası kök kanon verisiyle aynı olmalı');

const calendar = canonical.takvim;
assert.ok(calendar, 'Kanon takvim ayarları bulunmalı');
assert.equal(calendar.aylar.length, 11, 'Tömye takvimi 11 ay içermeli');
assert.equal(calendar.yilGun, 310, 'Tömye yılı 310 gün olmalı');
assert.equal(calendar.gunSaat, 25, 'Tömye günü 25 saat olmalı');
assert.equal(calendar.haftaGun, 6, 'Tömye haftası 6 gün olmalı');
assert.equal(calendar.gunler.length, 6, 'Altı hafta günü adı bulunmalı');
assert.deepEqual(calendar.aylar.map((ay) => ay.gun), [28, 28, 28, 29, 28, 28, 29, 28, 28, 28, 28]);
assert.equal(calendar.aylar.reduce((sum, ay) => sum + ay.gun, 0), calendar.yilGun, 'Ayların toplamı yıl uzunluğuna eşit olmalı');
assert.match(calendar.epokDunya, /^\d{4}-\d{2}-\d{2}$/, 'Dünya epoch tarihi ISO tarih biçiminde olmalı');
assert.equal(new Date(`${calendar.epokDunya}T00:00:00Z`).toISOString().slice(0, 10), calendar.epokDunya, 'Dünya epoch tarihi geçerli olmalı');
assert.ok(Number.isInteger(calendar.epokYil), 'Düzenlenebilir başlangıç Tömye yılı tam sayı olmalı');

const staff = canonical.evren.find((item) => item.id === 'gorevliSilsilesi')?.gizli?.[0]?.metin || '';
assert.match(staff, /Kurucu Feil\/Yaşam[^\n]*624 yıl/, 'Feil’in 624 yıllık kurucu dönemi kanonda kalmalı');
assert.match(staff, /Külaf — ilk resmî görevli; 95 yıl kaldı\./, 'Külaf ilk resmî görevli ve 95 yıl olarak kalmalı');
assert.match(staff, /Gize — 6\. görevli; 8 yıl, 3 ay, 9 gün/, 'Gize’nin görev sırası ve süresi kanonda kalmalı');
assert.match(staff, /Tarı — 7\. görevli/);
assert.match(staff, /Necale — 8\. görevli/);
assert.match(staff, /Afor — 9\. görevli/);

const feil = canonical.karakterler.find((item) => item.id === 'feil');
const afor = canonical.karakterler.find((item) => item.id === 'afor');
assert.ok(feil && afor, 'Feil ve Afor karakter kayıtları bulunmalı');
assert.match(feil.detay, /klon bedenleriyle 624 yıl/);
assert.match(feil.detay, /24 gün kala kütüphaneyi ve mülkü Necale/);
assert.match(afor.ozet, /kütüphaneyi işleten.*mülk sahibi Necale/i);

const loop = canonical.evren.find((item) => item.id === 'boyut')?.gizli?.[0]?.metin || '';
assert.match(loop, /24 gün \(dört hafta\) kala kütüphaneyi ve mülkü Necale/);
assert.match(loop, /kalan (?:diğer )?mallarını satar/);
assert.match(loop, /Kütüphanecilik görevini daha sonra Afor yürütür/);

const calendarUi = fs.readFileSync(path.join(root, 'js/arsiv/04-araclar-isim-takvim.js'), 'utf8');
assert.ok(calendarUi.includes('duzenlenebilir("takvim.epokDunya")'), 'Dünya epoch tarihi site editöründe düzenlenebilir olmalı');
assert.ok(calendarUi.includes('duzenlenebilir("takvim.epokYil")'), 'Tömye başlangıç yılı site editöründe düzenlenebilir olmalı');

console.log('Kanon takvim/veri kopyası/kütüphane invariant testleri başarılı.');
