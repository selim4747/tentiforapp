import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { JSDOM } from 'jsdom';

const root = process.cwd();
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const serverCode = read('server.js');
const clientCode = read('js/engine/102-icerik-alim.js');
const walletCode = read('js/core/03-cuzdan.js');
const planCode = read('js/engine/91-v473-uyelik.js');
const romanCode = read('js/arsiv/09-medya-harita.js');
const galleryCode = read('js/arsiv/07-kisilik-ag-galeri.js');
const packerCode = read('scripts/paketle.mjs');

console.log('Eçka yerel alım akışı ve premium plan istisnası test ediliyor...');

assert.doesNotMatch(serverCode, /\/api\/alim(?:lar)?/, 'sunucuda içerik alım REST endpointi kalmamalı');
assert.doesNotMatch(serverCode, /ALIMLAR_FILE|getAlimlarDb|saveAlimlarDb/, 'sunucu alım geçmişi dosyasını yönetmemeli');
assert.doesNotMatch(clientCode, /fetch\s*\(|\/api\//, 'içerik alım modülü API/fetch çağırmamalı');
assert.match(walletCode, /function birim\(\)\{return"eçka"\}/, 'uygulama içi cüzdan ve kilitlerde para birimi eçka olmalı');
assert.doesNotMatch(clientCode, /Satış Geliri|Alımlar & Gelir|Son Alımlar Geçmişi/, 'satış ve sunucu gelir panelleri kaldırılmalı');
assert.doesNotMatch(romanCode, /alimKaydet/, 'roman alımı sunucuya kaydedilmemeli');
assert.doesNotMatch(galleryCode, /alimKaydet/, 'galeri alımı sunucuya kaydedilmemeli');
assert.doesNotMatch(packerCode, /alimlar\.json/, 'eski alım geçmişi web/Android paketlerine eklenmemeli');
assert.match(planCode, /EvrenYazar · 249 TL \/ ay/, 'premium planın TL fiyatı korunmalı');
assert.match(planCode, /data-uyelik-ode="evrenyazar" disabled/, 'ödeme entegrasyonu olmadığı için premium düğmesi mevcut disabled/Yakında durumunda kalmalı');
console.log('PASS Alım API/gelir paneli kaldırıldı; premium planın gerçek para fiyatı ve mevcut ödeme durumu korundu.');

// Tarayıcı ortamında gerçek uygulama cüzdanı işlevlerini taklit et: satın alma yalnızca kilit açıp cihaz bakiyesini düşürür.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/', runScripts: 'outside-only' });
const { window } = dom;
const wallet = { ecka: 50, harcanan: 0, acilan: [] };
const notices = [];
let fetchCalls = 0;
window.cuzdan = wallet;
window.eckaVar = (amount) => wallet.ecka >= amount;
window.kilitAcik = (id) => wallet.acilan.includes(id);
window.kilitAc = (id, amount) => {
  const price = Math.max(0, Number(amount) || 0);
  if (wallet.ecka < price) return false;
  wallet.ecka -= price;
  wallet.harcanan += price;
  wallet.acilan.push(id);
  return true;
};
window.eckaBildir = (message) => notices.push(message);
window.fetch = () => { fetchCalls += 1; return Promise.reject(new Error('fetch kullanılamaz')); };
window.evrenEkSekmeler = undefined;
window.evrenEkBolum = undefined;
window.eval(clientCode);

let callbackCount = 0;
assert.equal(window.icerikSatinAl({ id: 'roman-1', fiyat: 12, onBasarili: () => { callbackCount += 1; } }), true);
assert.equal(wallet.ecka, 38, '12 eçka cihaz cüzdanından düşmeli');
assert.equal(wallet.harcanan, 12);
assert.ok(window.kilitAcik('roman-1'), 'roman kilidi yerel olarak açılmalı');
assert.equal(callbackCount, 1);
assert.match(notices.at(-1), /12 eçka/);
assert.equal(fetchCalls, 0, 'yerel eçka alımı hiçbir API/fetch çağrısı yapmamalı');
console.log('PASS Roman içeriği yerel cüzdandan eçka düşerek açılıyor; API çağrısı yok.');

assert.equal(window.icerikSatinAl({ id: 'cizim-pahali', fiyat: 100 }), false, 'yetersiz bakiye ile alım başarısız olmalı');
assert.equal(wallet.ecka, 38, 'başarısız alım bakiyeyi değiştirmemeli');
assert.ok(!window.kilitAcik('cizim-pahali'));
assert.equal(window.icerikSatinAl({ id: 'ucretsiz-bolum', fiyat: 0 }), true);
assert.equal(wallet.ecka, 38, 'ücretsiz içerik bakiyeyi değiştirmemeli');
assert.ok(window.kilitAcik('ucretsiz-bolum'));
console.log('PASS Yetersiz bakiye güvenle reddediliyor; ücretsiz içerik eçka harcamadan açılıyor.');

const sayfa = {
  eser: {
    id: 'demo', ad: 'Demo Evren',
    roman: { baslik: 'Demo Roman', bolumler: [{ id: 'c1', baslik: 'Birinci Bölüm', fiyat: 4, metin: 'Deneme metni' }] },
    cizimler: [{ id: 'i1', baslik: 'Demo Çizim', fiyat: 3, gorsel: '/demo.png' }]
  }
};
const tabs = window.evrenEkSekmeler(sayfa).map((item) => item[0]);
assert.ok(tabs.includes('roman') && tabs.includes('cizim'));
assert.ok(!tabs.includes('alimlar'), 'satıcı gelir sekmesi gösterilmemeli');
window.EVS = { id: 'demo', sekme: 'roman', seciliBolum: 'c1' };
assert.match(window.evrenEkBolum(sayfa), /data-evren-bolum-al/);
window.EVS.sekme = 'cizim';
assert.match(window.evrenEkBolum(sayfa), /data-evren-cizim-al/);
assert.equal(fetchCalls, 0);
window.close();
console.log('PASS Roman/çizim kilitleri eçka olarak gösteriliyor; satıcı gelir sekmesi yok.');

// Sunucu düzeyinde eski uç noktalar 404, POST ise genel 405 almalı; legacy JSON da sunulmamalı.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tentifor-no-alim-api-'));
const probe = net.createServer();
await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
fs.copyFileSync(path.join(root, 'server.js'), path.join(tempDir, 'server.js'));
fs.copyFileSync(path.join(root, 'index.html'), path.join(tempDir, 'index.html'));
fs.writeFileSync(path.join(tempDir, 'alimlar.json'), '{}');
fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }));
const server = spawn(process.execPath, ['server.js'], { cwd: tempDir, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Test sunucusu erken kapandı: ${output}`);
    try { const response = await fetch(`${base}/`); if (response.ok) { ready = true; break; } } catch {}
    await wait(100);
  }
  assert.ok(ready, `Geçici test sunucusu başlamadı: ${output}`);
  for (const endpoint of ['/api/alimlar', '/api/alim']) {
    const response = await fetch(base + endpoint);
    assert.equal(response.status, 404, `${endpoint} artık tanımlı olmamalı`);
  }
  const post = await fetch(base + '/api/alimlar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(post.status, 405, 'eski POST endpointi genel yöntem engeline düşmeli');
  assert.equal((await fetch(base + '/alimlar.json')).status, 404, 'alım geçmişi dosyası HTTP ile sunulmamalı');
  console.log('PASS Eski alım API uçları ve JSON geçmişi HTTP üzerinden erişilemiyor.');
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    server.once('exit', resolve);
    setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 1000).unref();
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
}
