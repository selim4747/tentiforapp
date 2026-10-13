import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync('js/engine/v65-universe-publication-check.js', 'utf8');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
dom.window.eval(source);
const validate = dom.window.tf65EvrenYayinDenetle;
assert.equal(typeof validate, 'function');

const complete = {
  bicim: 'tentifor-evren-v1', surum: 1, tur: 'evren', id: 'kiyi-kralligi', ad: 'Kıyı Krallığı',
  ozet: 'Bu evrende kıyı şehirleri, gelgit takvimi ve unutulmuş deniz yolları toplumun bütün düzenini belirler.',
  kurallar: [{ ad: 'Gelgit yasası', aciklama: 'Şehirlerin sınırı her 28 günde bir değişir.' }],
  roman: { bolumler: [{ id: 'giris', baslik: 'İlk kıyı' }] },
  harita: { yerler: [{ ad: 'Mavi Liman', x: 20, y: 70 }] },
  okuma_rehberi: [
    { baslik: 'Kurallar', dosya: 'bolum:kurallar' },
    { baslik: 'İlk kıyı', dosya: 'roman:giris' }
  ]
};
const result = validate(complete);
assert.equal(result.ok, true, result.errors.join('; '));
assert.ok(result.byteSize > 0);

const missing = validate({ tur: 'evren', ad: '', ozet: '', kurallar: [] });
assert.equal(missing.ok, false);
assert.ok(missing.errors.some((item) => item.includes('Evren adı')));
assert.ok(missing.errors.some((item) => item.includes('Özet')));
assert.ok(missing.errors.some((item) => item.includes('yazılı bölüm')));

const brokenGuide = structuredClone(complete);
brokenGuide.okuma_rehberi.push({ baslik: 'Olmayan bölüm', dosya: 'roman:yok' });
assert.equal(validate(brokenGuide).ok, false, 'bozuk roman bağlantısı yakalanmalı');

const badMap = structuredClone(complete);
badMap.harita.yerler[0].x = 101;
assert.ok(validate(badMap).errors.some((item) => item.includes('0–100')));

const tooLarge = structuredClone(complete);
tooLarge.kurallar.push({ ad: 'Büyük ek', aciklama: 'x'.repeat(960000) });
assert.ok(validate(tooLarge).errors.some((item) => item.includes('950 KB')));

const builder = fs.readFileSync('js/engine/evren-kurucu-calisma-alani.js', 'utf8');
assert.match(builder, /fd\.get\('durum'\) === 'onizleme'/, 'önizleme kaydı denetimi çalıştırmalı');
assert.match(builder, /page && page\.eser/, 'Mevcut editörü doldur gerçek evren verisini almalı');
assert.match(builder, /data-tf65-check/, 'kurucu formunda elle denetim düğmesi olmalı');
dom.window.close();
console.log('6.5 publication check tests passed');
