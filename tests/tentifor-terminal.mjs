import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

console.log('🧪 Tentifor Özel Arşiv Terminali Derinlemesine Özellik Testi Başlatılıyor...');

// 1. Dosya Varlık Kontrolleri
const root = process.cwd();
const terminalJsPath = path.join(root, 'js/engine/tentifor-terminal.js');
const terminalCssPath = path.join(root, 'css/terminal.css');

assert.ok(fs.existsSync(terminalJsPath), 'tentifor-terminal.js modülü mevcut olmalı');
assert.ok(fs.existsSync(terminalCssPath), 'terminal.css stil dosyası mevcut olmalı');

const jsContent = fs.readFileSync(terminalJsPath, 'utf8');
const cssContent = fs.readFileSync(terminalCssPath, 'utf8');

assert.ok(cssContent.includes('.tema-tentifor'), 'CSS Tentifor teması tanımlanmalı');
assert.ok(cssContent.includes('.tema-amber'), 'CSS Amber teması tanımlanmalı');
assert.ok(cssContent.includes('.crt-aktif'), 'CSS CRT tarama efekti tanımlanmalı');

// 2. JSDOM DOM ve Tarayıcı Ortamı Simülasyonu
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="css/terminal.css">
</head>
<body>
  <main>
    <section id="yokSayfa" class="bolum yok-sayfa">
      <div class="yok-ic">
        <div class="yok-kod">404</div>
        <h2>Bu sayfa yok</h2>
      </div>
    </section>
  </main>
</body>
</html>
`, {
  url: 'http://127.0.0.1:3000/#/gecersiz-rota-404',
  runScripts: 'outside-only'
});

const { window } = dom;
const { document } = window;

// LocalStorage mock
try {
  window.localStorage.clear();
} catch {
  const storageMap = new Map();
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key) => storageMap.get(key) || null,
      setItem: (key, val) => storageMap.set(key, String(val)),
      removeItem: (key) => storageMap.delete(key),
      clear: () => storageMap.clear()
    },
    writable: true,
    configurable: true
  });
}

// Web Audio API Mock
window.AudioContext = class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        linearRampToValueAtTime: () => {}
      },
      connect: () => {},
      start: () => {},
      stop: () => {}
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {}
      },
      connect: () => {}
    };
  }
  resume() {
    return Promise.resolve();
  }
};

// Veri Nesnesi Mock
window.veri = {
  surum: '6.3.13',
  karakterler: [
    { id: 'necale', ad: 'Necale', unvan: 'Baş Arşivci', ozet: 'Kütüphane bekçisi.' },
    { id: 'ozan', ad: 'Ozan', unvan: 'Gezgin', ozet: 'Buzun altındaki yankıları arar.' }
  ],
  evren: [
    { id: 'eterya', baslik: 'Eterya', bolum: 'Model Evreni', ozet: 'Kristalize enerji hatları.' },
    { id: 'somdo', baslik: 'Şomdo', bolum: 'Claude Evreni', ozet: 'Kadim yankılar.' },
    { id: 'e25', baslik: 'E-25 Tömye', bolum: 'Kanon', ozet: 'Ana Tömye evreni.' }
  ]
};

// Scripti JSDOM içinde çalıştır
window.eval(jsContent);

assert.ok(window.TentiforTerminal, 'window.TentiforTerminal global nesnesi tanımlanmalı');
const term = window.TentiforTerminal;

console.log('✓ Terminal motoru ve DOM ortamı başarıyla kuruldu.');

// 3. Ses Motoru Testleri
assert.equal(typeof term.ses.tus, 'function', 'Klavye tuş sesi metodu mevcut olmalı');
assert.equal(typeof term.ses.onay, 'function', 'Onay sesi metodu mevcut olmalı');
assert.equal(typeof term.ses.hata, 'function', 'Hata sesi metodu mevcut olmalı');
assert.equal(typeof term.ses.zil, 'function', 'Zil sesi metodu mevcut olmalı');
term.ses.tus();
term.ses.onay();
term.ses.hata();
term.ses.zil();
term.ses.ayar(false);
assert.equal(term.ses.aktif, false, 'Ses kapatılabilmeli');
term.ses.ayar(true);
assert.equal(term.ses.aktif, true, 'Ses açılabilmeli');
console.log('✓ Web Audio ses sentezleyici testleri geçti.');

// 4. Modal Terminal Kurulumu ve Pencere Testleri
term.ac();
const modal = document.querySelector('#tentifor-terminal-modal-kapsayici');
assert.ok(modal, 'Modal terminal DOM elementi oluşturulmalı');
assert.equal(modal.classList.contains('gizli'), false, 'Açıldığında gizli sınıfı kalkmalı');

const ekran = modal.querySelector('#term-modal-ekran');
const istemiEl = modal.querySelector('#term-modal-istemi');
const rozetEl = modal.querySelector('#term-modal-rozet');
assert.ok(ekran, 'Terminal ekranı mevcut olmalı');
assert.ok(istemiEl, 'Terminal istemi mevcut olmalı');

// 5. Site komut yüzeyi
function run(cmd) {
  term.komutCalistir(cmd, ekran, istemiEl, rozetEl, modal);
  return ekran.textContent || '';
}
for (const komut of ['ls', 'cd', 'cat', 'pwd', 'uname', 'whoami', 'ps', 'ping', 'curl', 'fetch', 'cowsay', 'matrix', 'sudo']) {
  const out = run(komut);
  assert.ok(out.includes('Komut bulunamadı'), `${komut} Termux/site dışı komut olarak kaldırılmış olmalı`);
}
console.log('✓ Termux ve site dışı komutlar terminal yüzeyinden kaldırıldı.');
let out = '';
// 6. Tömye Kozmolojisi ve Evren Motoru Komutları
out = run('tarih');
assert.ok(out.includes('Tömye Yılı') && out.includes('28 günlük döngü'), 'Tömye takvim koordinatları hesaplanmalı');

out = run('takvim');
assert.ok(out.includes('Pzt Sal Çar Per Cum Cmt Paz'), 'Aylık Tömye takvim matrisi çizilmeli');

out = run('isim çatlak');
assert.ok(out.includes('Gerdec') || out.includes('Kyldo İsim Üretim Matrisi'), 'Kyldo isim algoritması çalışmalı');

out = run('alinti');
assert.ok(out.length > 10, 'Alıntı komutu metin üretmeli');

out = run('evren list');
assert.ok(out.includes('Eterya') && out.includes('Şomdo'), 'Evren listesi listelenmeli');

out = run('evren bilgi eterya');
assert.ok(out.includes('Eterya'), 'Evren detay bilgisi dönmeli');

out = run('karakter list');
assert.ok(out.includes('Necale') && out.includes('Ozan'), 'Karakter listesi dönmeli');

console.log('✓ Kozmoloji ve Arşiv motoru komutları doğrulandı.');

// 7. 404 Kurtarma Motoru ve Gömülü 404 Ekranı
term.mount404('/tomyee');
const term404Kutu = document.querySelector('#term-404-konteyner');
assert.ok(term404Kutu, '404 sayfasında gömülü terminal konteyneri oluşturulmalı');

out = run('404');
assert.ok(out.includes('404 KESİNTİ ANALİZ RAPORU') || out.includes('Bulunulan sayfanın 404'), '404 durum analizi gösterilmeli');

out = run('kurtar tomyee');
assert.ok(out.includes('#/tomye'), 'Levenshtein benzerlik kurtarma ile #/tomye rotasını önermeli');

out = run('rotalar');
assert.ok(out.includes('#/arsiv') && out.includes('#/okuma'), 'Sistem rotaları listelenmeli');

console.log('✓ 404 Entegrasyonu ve Otomatik Kurtarma motoru doğrulandı.');

// 8. Siteye Özgü Edebiyat, Kozmoloji ve Arşiv Komutları
out = run('roman liste');
assert.ok(out.includes('TÖMYE ROMANI') || out.includes('Mevcut Bölümler'), 'roman liste bölümleri listelemeli');

out = run('roman son');
assert.ok(out.includes('BÖLÜM') || out.includes('Son Bölüm'), 'roman son en son bölümü göstermeli');

out = run('harita yerler');
assert.ok(out.includes('TÖMYE HARİTASI') || out.includes('BÖLGELER'), 'harita yerler Tömye lokasyonlarını dökmeli');

out = run('fankitap koru');
assert.ok(out.includes('TOPLULUK FAN HİKÂYELERİ') && out.includes('KORUMA AKTİF'), 'fankitap koru fan hikâyeli evrenlerin korumasını doğrulamalı');

out = run('kanon');
assert.ok(out.includes('KANON EVRENLER') && out.includes('E-25 Tömye'), 'kanon evrenleri ve durumunu listelemeli');

out = run('anomali');
assert.ok(out.includes('ANOMALİ') && out.includes('Delilik İndeksi'), 'anomali kozmik denge ve delilik analizini hesaplamalı');

out = run('gorevler');
assert.ok(out.includes('GÜNLÜK OKUR') && out.includes('Akçe'), 'gorevler günlük arşiv görevlerini göstermeli');

out = run('muzik cal buzul');
assert.ok(out.includes('Çalınıyor') && out.includes('Buzul Fısıltısı'), 'muzik Web Audio ile Tömye melodisini çalmalı');

out = run('cuzdan');
assert.ok(out.includes('TENTİFOR ARŞİV CÜZDANI') && out.includes('Akçe'), 'cuzdan Akçe bakiyesini göstermeli');

out = run('rozetler');
assert.ok(out.includes('OKUR ROZETLERİ') && out.includes('Buzul Kâşifi'), 'rozetler okur unvanlarını dökmeli');

out = run('buzul');
assert.ok(out.includes('7 DONMUŞ KOZMİK KATMANI'), 'buzul 7 donmuş katmanı listelemeli');

out = run('sozluk');
assert.ok(out.includes('TÖMYE KADİM SÖZLÜĞÜ'), 'sozluk sözlük maddelerini listelemeli');

out = run('kyldo Tentifor');
assert.ok(out.includes('Kyldo Kodlama Çıktısı'), 'kyldo ses dönüşüm matrisini üretmeli');

out = run('bulmaca');
assert.ok(out.includes('GÜNLÜK TÖMYE BİLGİ BULMACASI'), 'bulmaca interaktif soru üretmeli');

console.log('✓ Siteye özgü roman, harita, fan-kitap koruma, anomali, müzik, cüzdan ve buzul komutları doğrulandı.');

// 9. Yönetici / Admin Özel Konsol Komutları
out = run('admin durum');
assert.ok(out.includes('YETKİ GEREKLİ') || out.includes('ERİŞİM REDDEDİLDİ'), 'Yetkisiz admin komutu engellenmeli');

out = run('admin giris root');
assert.ok(out.includes('BAŞARILI') && out.includes('ROOT'), 'Yönetici girişi kabul edilmeli ve ROOT moduna geçilmeli');
assert.equal(term.adminOturumu, true, 'Terminal admin oturumu aktif olmalı');
assert.ok(term.istemiMetni().includes('root@tentifor-core'), 'İstem root olarak değişmeli');

out = run('admin durum');
assert.ok(out.includes('ROOT (Full Administrator)'), 'Admin durum bilgisi görüntülenmeli');

out = run('admin kanon ac');
assert.ok(out.includes('Kanon kilitleri açıldı'), 'Admin kanon kilitlerini açabilmeli');

out = run('admin karantina');
assert.ok(out.includes('MODERASYON & KARANTİNA'), 'Karantina havuzu kontrol edilebilmeli');

out = run('admin loglar');
assert.ok(out.includes('YÖNETİM GÜVENLİK GÜNLÜĞÜ'), 'Güvenlik logları listelenebilmeli');

out = run('admin cikis');
assert.ok(out.includes('Standart moda dönüldü'), 'Admin çıkışı başarılı olmalı');
assert.equal(term.adminOturumu, false, 'Terminal admin oturumu kapatılmalı');
assert.ok(term.istemiMetni().includes('tentifor@arsiv'), 'İstem kullanıcı moduna dönmeli');

console.log('✓ Yönetici özel terminal içerikleri ve güvenlik katmanı doğrulandı.');

// 10. Otomatik Tamamlama (Tab) ve Tema Testleri
assert.equal(term.otomatikTamamla('ka'), 'karakter ', 'ka -> karakter olarak tamamlanmalı');
assert.equal(term.otomatikTamamla('ev'), 'evren ', 'ev -> evren olarak tamamlanmalı');
assert.equal(term.otomatikTamamla('ku'), 'kurtar ', 'ku -> kurtar olarak tamamlanmalı');

term.temaAyarla('amber', modal);
assert.ok(modal.classList.contains('tema-amber'), 'Tema amber olarak ayarlanmalı');


console.log('✓ Otomatik tamamlama (Tab) ve tema motoru testleri geçti.');

// 11. Kapatma & Geçiş Kontrolleri
term.kapat();
assert.ok(modal.classList.contains('gizli'), 'Kapatılınca gizli olmalı');
term.gecis();
assert.equal(modal.classList.contains('gizli'), false, 'Geçiş yapılınca tekrar görünür olmalı');

console.log('🎉 TENTİFOR ÖZEL ARŞİV TERMİNALİ TÜM ÖZELLİK TESTLERİ EKSİKSİZ BAŞARIYLA TAMAMLANDI!');
