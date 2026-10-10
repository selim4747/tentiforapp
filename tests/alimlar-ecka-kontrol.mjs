import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const root = process.cwd();

console.log('🧪 Ekça İçerik Alımları ve Evren Sahibi Gelir Sistemi Doğrulanıyor...');

// 1. Dosya kontrolleri
const serverCode = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const clientCode = fs.readFileSync(path.join(root, 'js/engine/102-icerik-alim.js'), 'utf8');
const indexCode = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const romanCode = fs.readFileSync(path.join(root, 'js/arsiv/09-medya-harita.js'), 'utf8');
const galeriCode = fs.readFileSync(path.join(root, 'js/arsiv/07-kisilik-ag-galeri.js'), 'utf8');
const paketleCode = fs.readFileSync(path.join(root, 'scripts/paketle.mjs'), 'utf8');

// 2. Kod kontratları kontrolleri
assert.ok(serverCode.includes('/api/alimlar'), 'server.js /api/alimlar endpointini içermeli');
assert.ok(serverCode.includes('ALIMLAR_FILE'), 'server.js alimlar dosyasını yönetmeli');
assert.ok(serverCode.includes('POST, HEAD, OPTIONS'), 'server.js POST metoduna izin vermeli');
console.log('✓ server.js API sözleşmeleri doğrulandı');

assert.ok(indexCode.includes('js/engine/102-icerik-alim.js'), 'index.html 102-icerik-alim.js scriptini yüklemeli');
console.log('✓ index.html script entegrasyonu doğrulandı');

assert.ok(clientCode.includes('tfAlimServisi'), '102-icerik-alim.js tfAlimServisi API taşımalı');
assert.ok(clientCode.includes('icerikSatinAl'), '102-icerik-alim.js icerikSatinAl metodunu içermeli');
assert.ok(clientCode.includes('evrenAlimlarHtml'), '102-icerik-alim.js evren sahibi gelir paneli HTML fonksiyonunu içermeli');
assert.ok(clientCode.includes('evrenRomanHtml'), '102-icerik-alim.js evren roman okuma ve alım arayüzünü içermeli');
assert.ok(clientCode.includes('evrenCizimlerHtml'), '102-icerik-alim.js evren çizimler galeri ve alım arayüzünü içermeli');
console.log('✓ 102-icerik-alim.js istemci fonksiyonları doğrulandı');

assert.ok(romanCode.includes('alimKaydet'), '09-medya-harita.js roman açıldığında alım kaydetmeli');
assert.ok(galeriCode.includes('alimKaydet'), '07-kisilik-ag-galeri.js çizim açıldığında alım kaydetmeli');
console.log('✓ Roman ve çizim arşivleri alım kaydetme çağrıları doğrulandı');

assert.ok(paketleCode.includes('alimlar.json'), 'scripts/paketle.mjs alimlar.json senkronizasyonunu içermeli');
console.log('✓ paketle.mjs yapılandırması doğrulandı');

// 3. Server HTTP API doğrudan testleri (Port 3000 üzerinden)
async function testApiEndpoints() {
  const testPort = 3000;
  
  // GET /api/alimlar testi
  const getRes = await fetch(`http://127.0.0.1:${testPort}/api/alimlar`);
  assert.equal(getRes.status, 200, 'GET /api/alimlar 200 dönmeli');
  const getJson = await getRes.json();
  assert.equal(getJson.durum, 'ok', 'GET yanıtı durum ok olmalı');
  assert.ok(typeof getJson.toplamAlim === 'number', 'toplamAlim sayı olmalı');
  assert.ok(typeof getJson.toplamEcka === 'number', 'toplamEcka sayı olmalı');
  assert.ok(Array.isArray(getJson.alimlar), 'alimlar dizi olmalı');
  assert.ok(typeof getJson.evrenler === 'object', 'evrenler nesne olmalı');
  console.log(`✓ GET /api/alimlar testi başarılı (Kayıtlı alım: ${getJson.toplamAlim}, Toplam eçka: ${getJson.toplamEcka})`);

  // POST /api/alimlar roman satın alma testi
  const romanAlimVerisi = {
    icerikTur: 'roman',
    icerikId: 'evr_test_roman_1',
    icerikBaslik: '1. Bölüm · Başlangıç',
    evrenId: 'evr_test_yeni',
    evrenAd: 'Yıldızlar Evreni',
    evrenSahip: 'yazar_ahmet',
    alici: 'okur_mehmet',
    tutar: 120,
    birim: 'eçka'
  };

  const postRes1 = await fetch(`http://127.0.0.1:${testPort}/api/alimlar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(romanAlimVerisi)
  });
  assert.equal(postRes1.status, 200, 'POST roman alımı 200 dönmeli');
  const postJson1 = await postRes1.json();
  assert.equal(postJson1.durum, 'ok');
  assert.equal(postJson1.alim.tutar, 120);
  assert.equal(postJson1.alim.evrenId, 'evr_test_yeni');
  console.log('✓ POST /api/alimlar roman alımı başarıyla sunucuya kaydedildi');

  // POST /api/alimlar çizim satın alma testi
  const cizimAlimVerisi = {
    icerikTur: 'cizim',
    icerikId: 'evr_test_cizim_1',
    icerikBaslik: 'Buz Çölü Manzarası',
    evrenId: 'evr_test_yeni',
    evrenAd: 'Yıldızlar Evreni',
    evrenSahip: 'yazar_ahmet',
    alici: 'sanatsever_ayse',
    tutar: 80,
    birim: 'eçka'
  };

  const postRes2 = await fetch(`http://127.0.0.1:${testPort}/api/alimlar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cizimAlimVerisi)
  });
  assert.equal(postRes2.status, 200, 'POST çizim alımı 200 dönmeli');
  const postJson2 = await postRes2.json();
  assert.equal(postJson2.durum, 'ok');
  assert.equal(postJson2.alim.tutar, 80);
  console.log('✓ POST /api/alimlar çizim alımı başarıyla sunucuya kaydedildi');

  // GET /api/alimlar?evren=evr_test_yeni (Evren sahibinin kendi evrenini sorgulaması)
  const evrenRes = await fetch(`http://127.0.0.1:${testPort}/api/alimlar?evren=evr_test_yeni`);
  assert.equal(evrenRes.status, 200);
  const evrenJson = await evrenRes.json();
  assert.equal(evrenJson.durum, 'ok');
  assert.equal(evrenJson.evrenId, 'evr_test_yeni');
  assert.ok(evrenJson.evrenOzeti.toplamAlim >= 2, 'Evrenin toplam alımı en az 2 olmalı');
  assert.ok(evrenJson.evrenOzeti.toplamEcka >= 200, 'Evrenin toplam eçka geliri en az 200 olmalı');
  assert.ok(evrenJson.evrenOzeti.roman.adet >= 1, 'Roman alım adedi en az 1 olmalı');
  assert.ok(evrenJson.evrenOzeti.cizim.adet >= 1, 'Çizim alım adedi en az 1 olmalı');
  console.log(`✓ GET /api/alimlar?evren=evr_test_yeni filtreleme başarılı! Sahip geliri: ${evrenJson.evrenOzeti.toplamEcka} eçka (${evrenJson.evrenOzeti.toplamAlim} alım)`);

  // GET /api/alimlar?sahip=yazar_ahmet (Yazarın toplam gelirini sorgulaması)
  const sahipRes = await fetch(`http://127.0.0.1:${testPort}/api/alimlar?sahip=yazar_ahmet`);
  assert.equal(sahipRes.status, 200);
  const sahipJson = await sahipRes.json();
  assert.equal(sahipJson.durum, 'ok');
  assert.equal(sahipJson.sahip, 'yazar_ahmet');
  assert.ok(sahipJson.sahipOzeti.toplamEcka >= 200);
  console.log(`✓ GET /api/alimlar?sahip=yazar_ahmet filtreleme başarılı! Yazar toplam geliri: ${sahipJson.sahipOzeti.toplamEcka} eçka`);

  // Disk kontrolü: alimlar.json dosyası güncellendi mi?
  const diskDb = JSON.parse(fs.readFileSync(path.join(root, 'alimlar.json'), 'utf8'));
  assert.ok(diskDb.alimlar.some((a) => a.id === postJson1.alim.id), 'Disk dosyasında roman alımı bulunmalı');
  assert.ok(diskDb.alimlar.some((a) => a.id === postJson2.alim.id), 'Disk dosyasında çizim alımı bulunmalı');
  console.log('✓ alimlar.json disk dosyası verileri doğrulandı');
}

// Dev server hazır olunca testi tamamla veya port kontrolü yap
try {
  await testApiEndpoints();
  console.log('\n🎉 TÜM EÇKA İÇERİK ALIMLARI VE EVREN GELİR TESTLERİ BAŞARIYLA GEÇTİ! (%100 PASS)');
} catch (err) {
  // Eğer port 3000 henüz bu ortamda açılmadıysa bağımsız sunucu simülasyonu çalıştır
  console.log('Canlı sunucu testinde hata veya port bekleme, yerel denetim sürdürülüyor:', err.message);
  process.exit(1);
}
