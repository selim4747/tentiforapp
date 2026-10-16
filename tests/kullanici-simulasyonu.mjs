import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

console.log('🤖 === KULLANICI ETKİLEŞİMİ VE DERİN SİMÜLASYON TESTİ BAŞLATILIYOR ===\n');

const virtualConsole = new VirtualConsole();
const loglar = [];
const hatalar = [];

virtualConsole.on('error', (...args) => {
  const msg = args.map((err) => typeof err === 'string' ? err : err && (err.stack || err.message) || String(err)).join(' ');
  hatalar.push(msg);
});

virtualConsole.on('warn', (msg) => {
  loglar.push(`[WARN] ${msg}`);
});

virtualConsole.on('log', (msg) => {
  loglar.push(`[LOG] ${msg}`);
});

async function main() {
  const dom = await JSDOM.fromURL('http://localhost:3000/', {
    runScripts: 'dangerously',
    resources: 'usable',
    virtualConsole,
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = (input, init) => globalThis.fetch(new URL(String(input), window.location.href), init);
      window.scrollTo = () => {};
      window.matchMedia = window.matchMedia || function() {
        return { matches: false, addListener() {}, removeListener() {} };
      };
      if (window.performance && !window.performance.getEntriesByType) {
        window.performance.getEntriesByType = () => [];
      }
    }
  });

  const { window } = dom;
  const { document } = window;

  const adimGec = (ad) => console.log(`✓ [BAŞARILI] ${ad}`);
  const adimHata = (ad, err) => {
    console.error(`❌ [HATA] ${ad}:`, err.message || err);
    process.exitCode = 1;
  };

  // 1. Sayfa Yüklenmesi ve Başlangıç Verisi
  console.log('--- Adım 1: Sayfa Başlatma ve Veri Yüklenmesi ---');
  await new Promise(r => setTimeout(r, 1500));

  try {
    if (!document.title.includes('TentiFor')) {
      throw new Error(`Beklenmeyen başlık: ${document.title}`);
    }
    adimGec(`Sayfa başlığı doğrulandı: "${document.title}"`);

    const gezinme = document.querySelector('#gezinme') || document.querySelector('header');
    if (!gezinme) throw new Error('Navigasyon menüsü bulunamadı');
    adimGec('Üst menü ve navigasyon hazır');

    if (window.veri) {
      adimGec(`Arşiv verisi hafızaya yüklendi (Sürüm: ${window.veri.surum})`);
    } else {
      console.log('ℹ window.veri henüz atanmadı, DOM içeriği inceleniyor');
    }
  } catch (e) {
    adimHata('Adım 1', e);
  }

  // 2. Karakter Arama Simülasyonu
  console.log('\n--- Adım 2: Arama ve Filtreleme Simülasyonu ---');
  try {
    const aramaGiris = document.querySelector('#karakterArama') || document.querySelector('input[type="search"]');
    if (aramaGiris) {
      aramaGiris.value = 'Ax';
      aramaGiris.dispatchEvent(new window.Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      adimGec('Arama kutusuna "Ax" yazıldı ve arama tetiklendi');
    } else {
      console.log('ℹ Arama kutusu mevcut sayfada yok veya dinamik açılıyor');
    }
  } catch (e) {
    adimHata('Adım 2', e);
  }

  // 3. Rota Değiştirme Simülasyonu
  console.log('\n--- Adım 3: Sayfa Rotaları Arasında Gezinme ---');
  try {
    window.location.hash = '#/arsiv';
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await new Promise(r => setTimeout(r, 400));
    adimGec('#/arsiv rotasına geçiş simüle edildi');

    window.location.hash = '#/oyunlar';
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await new Promise(r => setTimeout(r, 400));
    adimGec('#/oyunlar rotasına geçiş simüle edildi');

    window.location.hash = '#/ev/site/e25';
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await new Promise(r => setTimeout(r, 400));
    adimGec('E25 Evren sayfası rotasına geçiş simüle edildi');
  } catch (e) {
    adimHata('Adım 3', e);
  }

  // 4. Tema ve Ayar Değişikliği Simülasyonu
  console.log('\n--- Adım 4: Tema ve Kullanıcı Tercihleri ---');
  try {
    const htmlEl = document.documentElement;
    const ilkTema = htmlEl.getAttribute('data-ayar-tema');
    htmlEl.setAttribute('data-ayar-tema', ilkTema === 'gece' ? 'buz' : 'gece');
    adimGec(`Tema değişimi simüle edildi (Yeni tema: ${htmlEl.getAttribute('data-ayar-tema')})`);
  } catch (e) {
    adimHata('Adım 4', e);
  }

  // 5. Konsol Hata Analizi
  console.log('\n--- Adım 5: Çalışma Zamanı Hata Analizi ---');
  const kritikHatalar = hatalar.filter(h => 
    !h.includes('Could not parse CSS') &&
    !h.includes('Error: Not implemented') &&
    !h.includes('navigation') &&
    !h.includes('fetch') &&
    !h.includes('beacon')
  );

  if (kritikHatalar.length === 0) {
    adimGec('Simülasyon süresince hiçbir JavaScript runtime çökmesi yaşanmadı!');
  } else {
    console.error('Yakalanan kritik çalışma zamanı hataları:', kritikHatalar);
    process.exitCode = 1;
  }

  console.log('\n🎉 === KULLANICI SİMÜLASYONU VE DERİN TEST TAMAMLANDI ===');
  dom.window.close();
  // JSDOM kaynakları bazı sürümlerde event loop'u açık bırakabiliyor;
  // koşucuya sonucu deterministik biçimde bildir.
  process.exit(process.exitCode === 1 ? 1 : 0);
}

main().catch(err => {
  console.error('Simülasyon testinde beklenmeyen hata:', err);
  process.exit(1);
});
