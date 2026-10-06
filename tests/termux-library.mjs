import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { takvim, isim, arsiv, eser, termux } from '../uygulama/termux/tentifor.js';

console.log('Testing Tentifor Termux Library & CLI...');

// 1. Takvim kontrolleri
const suan = takvim.suan();
assert.ok(suan, 'Takvim şu anki zamanı döndürmeli');
assert.ok(suan.yil >= 1, 'Tömye yılı pozitif olmalı');
assert.ok(suan.saat >= 0 && suan.saat <= 25, 'Tömye saati 0-25 aralığında olmalı');
assert.equal(typeof suan.ay, 'string');
assert.equal(typeof suan.haftaGunu, 'string');

const yas = takvim.yasCevir(25, 'dunyadan');
assert.ok(yas > 0, 'Yaş çevirisi pozitif olmalı');

// 2. İsim sistemi kontrolleri
const catlakSonuclari = isim.uret('çatlak');
assert.ok(catlakSonuclari.length >= 4, '4 yöntemle isim üretmeli');
const gerdec = catlakSonuclari.find((x) => x.yol === 'ters + harf');
assert.equal(gerdec?.sonuc, 'Gerdec', 'çatlak ters+harf ile Gerdec üretmeli');

const oneriler = isim.oneri('karakter', 3);
assert.equal(oneriler.length, 3, 'İstenen adet kadar öneri dönmeli');

// 3. Arşiv kontrolleri
const karakterler = arsiv.karakterler();
assert.ok(karakterler.length > 0, 'Karakterler listesi dolu olmalı');

const necale = arsiv.karakterBul('Necale');
assert.ok(necale, 'Necale bulunabilmeli');
assert.equal(necale.id, 'necale');

const evrenler = arsiv.evrenler();
assert.ok(evrenler.length > 0, 'Evrenler listesi dolu olmalı');

const arama = arsiv.ara('Ax');
assert.ok(arama.length > 0, 'Arama sonuç dönmeli');

// 4. Eser doğrulama ve paketleme
const testEser = {
  bicim: 'tentifor-eser',
  tur: 'evren',
  id: 'test-evren-termux',
  ad: 'Termux Test Evreni',
  ozet: 'Termux testi için oluşturulmuş örnek evren.'
};
assert.ok(eser.dogrula(testEser).gecerli, 'Geçerli eser doğrulanmalı');

const invalidEser = { bicim: 'yanlis' };
assert.equal(eser.dogrula(invalidEser).gecerli, false, 'Geçersiz eser reddedilmeli');

const tempOut = path.join(process.cwd(), 'node_modules', '.test-termux.tentifor.html');
eser.paketleHtml(testEser, tempOut);
assert.ok(fs.existsSync(tempOut), 'HTML çıktı dosyası oluşturulmalı');

const okunan = eser.dosyadanOku(tempOut);
assert.equal(okunan.id, testEser.id, 'Paketlenen eser geri okunabilmeli');
try { fs.unlinkSync(tempOut); } catch {}

// 5. CLI Entegrasyon kontrolleri
const cliPath = path.resolve('uygulama/termux/bin/tentifor.mjs');
const runCli = (args) => execFileSync(process.execPath, [cliPath, ...args], { encoding: 'utf8' });

const saatCikti = runCli(['saat']);
assert.match(saatCikti, /TÖMYE ZAMANI/, 'CLI saat çıktısı doğru olmalı');
assert.match(saatCikti, /SAAT/, 'CLI saat birimi içermeli');

const takvimCikti = runCli(['takvim']);
assert.match(takvimCikti, /TÖMYE TAKVİM DÜZENİ/, 'CLI takvim başlığı içermeli');

const isimCikti = runCli(['isim', 'çatlak']);
assert.match(isimCikti, /Gerdec/, 'CLI isim üretiminde Gerdec bulunmalı');

console.log('Tentifor Termux Library & CLI tests: PASS');
