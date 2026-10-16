import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";

console.log("🔍 Güncelleme Doğrulama Testi Başlatılıyor...\n");

// 1. Dosya kontrolleri
const files = [
  "js/engine/73-evren-kod-stil.js",
  "js/engine/69-evren-uygulama.js",
  "js/engine/45-evrengezer.js",
  "js/engine/51-evren-oyunlari.js"
];

for (const f of files) {
  assert.ok(fs.existsSync(f), `Dosya bulunmalı: ${f}`);
  console.log(`✓ Dosya mevcut: ${f}`);
}

// 2. JSDOM ortamı kurup motor dosyalarını yükleyelim
const dom = new JSDOM(`<!doctype html><html><body><div id="ana"></div></body></html>`, {
  url: "https://tentifor.test/",
  runScripts: "outside-only"
});

const ctx = dom.window;
ctx.veri = {
  surum: "6.4.4.0",
  kanonEvrenleri: {},
  haritalar: []
};
ctx.kacir = function(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};
ctx.fanMetin = function(s, max) {
  return String(s || "").slice(0, max || 100);
};
ctx.onizlemeMi = function() { return false; };
ctx.evrenBenimBul = function() { return null; };
ctx.fanBul = function() { return null; };
ctx.fanSiteListesi = function() { return []; };
ctx.evdDosyali = function() { return false; };
ctx.jsonOku = function(k, def) { return def; };
ctx.jsonYaz = function() {};
ctx.birim = function() { return "EG"; };
ctx.gunlukToplamKazanc = function() { return 0; };
ctx.egYukle = function() { return { eg: 100, ipucu: [] }; };
ctx.egKaydet = function() {};
ctx.egBakiye = function() { return 100; };
ctx.egBakiyeDegistir = function() {};
ctx.egTutar = function(n) { return n + " EG"; };
ctx.egParaHatirla = function() {};
ctx.evrenParasi = function() { return { ad: "Akçe", simge: "A", kur: 1 }; };
ctx.evrenCuzdanAnahtari = function() { return "test-cuzdan"; };
ctx.evrenDefterAnahtari = function() { return "defter-key"; };
ctx.evrenOyunSayisi = function() { return 3; };
ctx.evrenRehberi = function() { return [{ ad: "Giriş", metin: "Hoş geldiniz." }]; };
ctx.evrenOyunlarBolumu = function() { return '<div class="oyunlar-alani">Oyunlar Listesi</div>'; };
ctx.eyDolu = function() { return false; };

vm.createContext(ctx);

// Kodları context içinde çalıştırırken global scope exportlarını bağlayalım
const kodStilCode = fs.readFileSync("js/engine/73-evren-kod-stil.js", "utf8") + `
;window.EKS_BILESENLER = EKS_BILESENLER;
window.EKS_BILESEN_SABLONLARI = EKS_BILESEN_SABLONLARI;
window.EKS_MODULER_BLOKLAR = EKS_MODULER_BLOKLAR;
window.eksBilesenleriAyristir = eksBilesenleriAyristir;
window.eksBilesenleriBirlestir = eksBilesenleriBirlestir;
window.eksKodBolumu = eksKodBolumu;
window.eksVitrinBolumu = eksVitrinBolumu;
`;
const evuCode = fs.readFileSync("js/engine/69-evren-uygulama.js", "utf8") + `
;window.evuSrcdoc = evuSrcdoc;
window.EVU_ORNEK = EVU_ORNEK;
window.evuBolum = evuBolum;
window.evuCalistir = evuCalistir;
`;
const evrengezerCode = fs.readFileSync("js/engine/45-evrengezer.js", "utf8") + `
;window.evrenEkSekmeler = evrenEkSekmeler;
window.evrenEkBolum = evrenEkBolum;
window.evrenOkuBolumu = evrenOkuBolumu;
window.evrenOynaBolumu = evrenOynaBolumu;
`;

vm.runInContext(kodStilCode, ctx);
vm.runInContext(evuCode, ctx);
vm.runInContext(evrengezerCode, ctx);

console.log("\n--- TEST 1: Görünüm Editörü Bileşenleri Doğrulaması ---");
assert.ok(Array.isArray(ctx.EKS_BILESENLER), "EKS_BILESENLER bir dizi olmalı");
const bilesenIdleri = ctx.EKS_BILESENLER.map(b => b.id);
console.log("Tanımlı bileşenler:", bilesenIdleri.join(", "));

assert.ok(bilesenIdleri.includes("buton"), "Buton stili bileşeni mevcut olmalı");
assert.ok(bilesenIdleri.includes("duzen"), "Sayfa düzeni bileşeni mevcut olmalı");
assert.ok(bilesenIdleri.includes("arkaplan"), "Arka plan bileşeni mevcut olmalı");
assert.ok(bilesenIdleri.includes("tipografi"), "Tipografi (font/harf) bileşeni mevcut olmalı");
assert.ok(bilesenIdleri.includes("kartlar"), "Kartlar & Çerçeveler bileşeni mevcut olmalı");
assert.ok(bilesenIdleri.includes("efektler"), "Efektler & Animasyon bileşeni mevcut olmalı");
assert.ok(bilesenIdleri.includes("serbest"), "Serbest CSS bileşeni mevcut olmalı");
console.log("✓ Tüm istenen görünüm bileşenleri ve fazlası eksiksiz tanımlı!");

// Ayrıştırma ve birleştirme testi
const ornekBilesenCss = `
/* === [buton] === */
.dugme { background: #000; color: #fff; border-radius: 8px; }

/* === [arkaplan] === */
#evrenSayfa { background: #111; color: #eee; }
`.trim();

const ayrismis = ctx.eksBilesenleriAyristir(ornekBilesenCss);
assert.equal(ayrismis.buton.trim(), ".dugme { background: #000; color: #fff; border-radius: 8px; }");
assert.equal(ayrismis.arkaplan.trim(), "#evrenSayfa { background: #111; color: #eee; }");
console.log("✓ Bileşen bazlı CSS ayrıştırması başarıyla çalışıyor.");

const birlestirilmis = ctx.eksBilesenleriBirlestir(ayrismis);
assert.ok(birlestirilmis.includes("/* === [buton] === */"), "Birleştirilmiş CSS buton etiketini içermeli");
assert.ok(birlestirilmis.includes("/* === [arkaplan] === */"), "Birleştirilmiş CSS arkaplan etiketini içermeli");
console.log("✓ Bileşenlerin derlenmesi ve birleştirilmesi başarıyla çalışıyor.");

console.log("\n--- TEST 2: Özellik Editörü (Mevcut Özellikleri Değiştirme) Doğrulaması ---");
// evuSrcdoc içine enjekte edilen fonksiyonların kontrolü
const sahteEvren = {
  id: "test1",
  ad: "Test Evreni",
  kisiler: [{ ad: "Axion", rol: "Kaşif" }],
  yerler: [{ ad: "Sis Vadisi", aciklama: "Gizemli vadi" }],
  kurallar: [{ ad: "Zaman Akışı", aciklama: "Tersine akar" }],
  ozelAlanlar: [{ ad: "Enerji", deger: "100" }]
};
const sahteUygulama = { id: "u1", ad: "Test Özellik", tur: "ozellik", kod: "<p>test</p>" };
const srcdoc = ctx.evuSrcdoc(sahteEvren, sahteUygulama);

assert.ok(srcdoc.includes("evren.ozellikDegistir"), "evren.ozellikDegistir API'si bulunmalı");
assert.ok(srcdoc.includes("evren.kisiGuncelle"), "evren.kisiGuncelle API'si bulunmalı");
assert.ok(srcdoc.includes("evren.yerGuncelle"), "evren.yerGuncelle API'si bulunmalı");
assert.ok(srcdoc.includes("evren.kuralGuncelle"), "evren.kuralGuncelle API'si bulunmalı");
assert.ok(srcdoc.includes("evren.alanGuncelle"), "evren.alanGuncelle API'si bulunmalı");
assert.ok(srcdoc.includes("evren.paraGuncelle"), "evren.paraGuncelle API'si bulunmalı");
console.log("✓ İframe SDK'sında tüm özellik değiştirme ve güncelleme API'leri mevcut.");

// Örnek şablonda özellik değiştirme örneği kontrolü
assert.ok(ctx.EVU_ORNEK.ozellik_degistir, "EVU_ORNEK.ozellik_degistir şablonu bulunmalı");
assert.ok(ctx.EVU_ORNEK.ozellik_degistir.kod.includes("evren.kisiGuncelle"), "Örnekte kisiGuncelle kullanımı bulunmalı");
assert.ok(ctx.EVU_ORNEK.ozellik_degistir.kod.includes("evren.alanGuncelle"), "Örnekte alanGuncelle kullanımı bulunmalı");
console.log("✓ 'Evren Durum Değiştirici' hazır şablonu mevcut özellikleri değiştirme kodunu içeriyor.");

// Özellik değiştirme postMessage işleyicisi testi
ctx.EVS = { kaynak: "benim", id: "test1" };
let guncellenmisEvren = JSON.parse(JSON.stringify(sahteEvren));
ctx.evrenBenimBul = function() { return guncellenmisEvren; };
ctx.evrenBenimDegistir = function(id, fn) {
  fn(guncellenmisEvren);
};

const appContainer = ctx.document.createElement("div");
ctx.document.body.appendChild(appContainer);

// evuCalistir iframe'i kurar ve evuCerceve'yi tanımlar
ctx.evuCalistir(appContainer, guncellenmisEvren, sahteUygulama);
const iframe = appContainer.querySelector("iframe");

// Kişi güncelleme çağrısı simülasyonu
const eventMock = {
  source: iframe.contentWindow,
  data: {
    tip: "ozellik_degistir",
    tur: "kisiler",
    anahtar: "Axion",
    degerler: { rol: "Yüce Muhafız" }
  }
};

// Window message dinleyicisi tetiklensin
ctx.window.dispatchEvent(new ctx.MessageEvent("message", eventMock));

assert.equal(guncellenmisEvren.kisiler[0].rol, "Yüce Muhafız", "Axion'un rolü başarıyla güncellenmeli");
console.log("✓ Koddan mevcut kişi özelliği başarıyla değiştirildi (Axion rolü -> 'Yüce Muhafız').");

console.log("\n--- TEST 3: Evrenler İçin Oku ve Oyna Sayfaları Doğrulaması ---");
// evrenEkSekmeler testi
const sekmeler = ctx.evrenEkSekmeler({ eser: sahteEvren });
const sekmeAnahtarlari = sekmeler.map(s => s[0]);
console.log("Evren sekmeleri:", sekmeAnahtarlari.join(", "));

assert.ok(sekmeAnahtarlari.includes("oku"), "Evrende 'oku' sekmesi bulunmalı");
assert.ok(sekmeAnahtarlari.includes("oyna"), "Evrende 'oyna' sekmesi bulunmalı");
console.log("✓ Evren detay sayfasında 'oku' ve 'oyna' sekmeleri tanımlı.");

// Oku bölümü HTML çıktısı
ctx.EVS = { kaynak: "benim", id: "test1", sekme: "oku" };
const okuHtml = ctx.evrenOkuBolumu({ eser: sahteEvren });
assert.ok(okuHtml.includes("Roman &amp; Bölümler") || okuHtml.includes("Roman & Bölümler"), "Oku bölümünde Roman alt sekmesi olmalı");
assert.ok(okuHtml.includes("Okuma Rehberi") || okuHtml.includes("Rehber"), "Oku bölümünde Okuma Rehberi alt sekmesi olmalı");
console.log("✓ 'Oku' sayfası bölüm ve rehber okuma içeriklerini eksiksiz render ediyor.");

// Oyna bölümü HTML çıktısı
ctx.EVS = { kaynak: "benim", id: "test1", sekme: "oyna" };
const oynaHtml = ctx.evrenOynaBolumu({ eser: sahteEvren });
assert.ok(oynaHtml.includes("oyunlar-alani") || oynaHtml.includes("Oyun"), "Oyna bölümü oyunları çalıştırmalı");
console.log("✓ 'Oyna' sayfası etkileşimli evren oyunlarını başarıyla render ediyor.");

console.log("\n🎉 TÜM GÜNCELLEME DOĞRULAMA TESTLERİ %100 BAŞARIYLA GEÇTİ!");
