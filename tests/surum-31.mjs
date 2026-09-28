/* Sürüm 3.1 testleri: tek seferlik evren kurma kodu (sunucuda harcanır), ana sayfada evrenler ve kilitli "Evrenini kur",
   E25 (doğum sahnesi, pasaport, Kapılar Salonu, karşılaşma, sıralamalar), kişi sayfası, sürüm karşılaştırma,
   haritada zaman, panelde kanona aday evrenler, bütün sayfalarda erişilebilirlik ve telefon taraması.
   tests/calistir.mjs çağırır. */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { yeniSahte } = require("./supabase-taklidi.cjs");
const TEST_URL = "https://test.supabase.co";

/** Sayfadaki erişilebilirlik ve telefon sorunları (tarayıcıda çalışır). */
function erisimTara(kok) {
  const k = kok ? document.querySelector(kok) : document;
  const sorun = [];
  const gorunur = function (el) { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const ad = function (el) {
    if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title")) { return true; }
    if ((el.textContent || "").trim()) { return true; }
    if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) { return true; }
    if (el.closest("label")) { return true; }
    if (el.getAttribute("placeholder")) { return true; }
    const img = el.querySelector("img[alt]"); return !!(img && img.alt.trim());
  };
  k.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button]").forEach(function (el) {
    if (!gorunur(el)) { return; }
    if (!ad(el)) { sorun.push("adsız " + el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "") + " " + el.outerHTML.slice(0, 80)); }
  });
  k.querySelectorAll("img").forEach(function (el) { if (gorunur(el) && !el.hasAttribute("alt")) { sorun.push("alt yok: " + el.outerHTML.slice(0, 80)); } });
  const idler = {};
  document.querySelectorAll("[id]").forEach(function (el) { idler[el.id] = (idler[el.id] || 0) + 1; });
  Object.keys(idler).forEach(function (i) { if (idler[i] > 1) { sorun.push("aynı kimlik ×" + idler[i] + ": #" + i); } });
  const tasma = document.documentElement.scrollWidth - window.innerWidth;
  if (tasma > 0) { sorun.push("yana taşma " + tasma + " px"); }
  const ev = document.querySelector("#evrenSayfa");
  if (ev && ev.scrollWidth - ev.clientWidth > 1) { sorun.push("evren sayfası yana taşıyor " + (ev.scrollWidth - ev.clientWidth) + " px"); }
  return sorun;
}

export async function surum31Testleri({ adres, veritabani, dizin }) {
  const sahte = yeniSahte(veritabani);
  const hatalar = [];
  let gecen = 0;
  const ok = function (ad, kosul, ek) {
    if (!kosul) { throw new Error("BAŞARISIZ: " + ad + (ek !== undefined ? " → " + JSON.stringify(ek) : "")); }
    gecen++; console.log("  tamam: " + ad);
  };
  const tarayici = await chromium.launch(process.env.CHROMIUM_YOLU ? { executablePath: process.env.CHROMIUM_YOLU } : {});
  const bekle = function (p, ms) { return p.waitForTimeout(ms || 600); };
  const veriVar = function () { return typeof veri !== "undefined" && !!veri && document.documentElement.classList.contains("veri-hazir"); };

  async function cihaz(ad, secenek) {
    const s = secenek || {};
    const ctx = await tarayici.newContext(Object.assign({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" }, s.ctx || {}));
    await ctx.addInitScript(function (o) {
      try {
        localStorage.setItem("tentiforapp_tur", "bitti"); localStorage.setItem("tentiforapp_baslangic_oto", "kapali");
        localStorage.setItem("tentiforapp_hesap_hatirlat", JSON.stringify({ kapat: true }));
        if (o.seviye) { localStorage.setItem("tentiforapp_seviye_test", String(o.seviye)); }
      } catch (e) { /* yok */ }
      window.__okumaOnbellegiKapali = true;
    }, { seviye: s.seviye === undefined ? 20 : s.seviye });
    await ctx.route(/\/js\/(?:28-hesap|paket-\d+)\.js(\?|$)/, function (r) { return r.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(dizin + new URL(r.request().url()).pathname, "utf8").replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, TEST_URL) }); });
    await ctx.route(TEST_URL + "/**", function (r) { return sahte.isle(r); });
    const p = await ctx.newPage();
    p.on("pageerror", function (e) { hatalar.push(ad + ": " + e.message); });
    return p;
  }
  async function kayitOl(p, ad, kadi, eposta) {
    await p.goto(adres + "/"); await bekle(p, 1200);
    await p.click("#hesapBtn");
    await p.click('#perde [data-hesap-pencere="kayit"]');
    await p.fill("#hKayitAd", ad); await p.fill("#hKayitKullanici", kadi);
    await p.fill("#hKayitEposta", eposta); await p.fill("#hKayitSifre", "tomye-2026");
    await p.click('[data-hesap-form="kayit"] button[type=submit]'); await bekle(p, 800);
    await p.goto(adres + "/?code=" + encodeURIComponent(eposta) + "&hesap=onay#/sen"); await bekle(p, 2500);
  }

  try {
    /* ---------- 1. ana sayfa: evrenler ve kilitli evren kurma ---------- */
    console.log("3.1 ana sayfa evrenler");
    const Y = await cihaz("yeni", { seviye: 0 });
    await Y.goto(adres + "/"); await Y.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(Y, 500);
    ok("ana sayfada evrenler: Tömye büyük kart, kanon ve okurların evrenleri", await Y.evaluate(function () {
      const a = document.querySelector("#anaEvrenler");
      return aktifSayfa === "arsiv" && !!document.querySelector(".hero .ana-tomye .hero-baslik") && a.querySelectorAll(".ana-evren.kanon").length >= 3 && /E25/.test(a.textContent);
    }));
    ok("Claude'un evreni ve örnek fan evrenleri kanon değil, test evreni olarak görünür", await Y.evaluate(function () {
      const a = document.querySelector("#anaEvrenler");
      const kanon = Array.from(a.querySelectorAll(".ana-evren.kanon")).map(function (x) { return x.textContent; }).join("|");
      const test = Array.from(a.querySelectorAll(".ana-evren.test")).map(function (x) { return x.getAttribute("data-evren-git"); });
      const sis = fanSiteListesi("evren").find(function (x) { return x.id === "fornek-sis"; });
      return !/Claude/.test(kanon) && test.indexOf("#/claude") !== -1 && test.indexOf("#/ev/fan/fornek-sis") !== -1 && test.indexOf("#/ev/fan/fornek-kul") !== -1 &&
        evaStatu("Claude'un Evreni").tur === "test" && evaStatu(sis.ad).tur === "fan" && evaStatu(sis.ad).test === true &&
        /Test · fan-made/.test(evaStatuRozeti(evaStatu(sis.ad))) && !evaEvrengezerIzni(sis.ad).izin && evaEvrengezerIzni("Claude'un Evreni").izin &&
        !/Kanon evrende yeni hikâye: Claude/.test(kisiGoturHtml({}, "a:b")) && /Test evreninde deneme hikâyesi/.test(kisiGoturHtml({}, "a:b"));
    }));
    ok("en altta kilitli 'Evrenini kur': seviye kapısı ve kod girişi", await Y.evaluate(function () {
      const k = document.querySelector("#anaEvrenler .ana-kur");
      return !!k && k === document.querySelector("#anaEvrenler").lastElementChild && k.classList.contains("kilitli") && !!k.querySelector("[data-kod-ac]") && !k.querySelector("[data-es-yeni]") && /Seviye 15/.test(k.textContent);
    }));
    /* 3.2: sade arayüz */
    ok("3.2: ikincil kutular kapalı 'Bugün sitede' bölümünde, bugün kartı ve arama dışarıda", await Y.evaluate(function () {
      const d = document.querySelector("#kesifDaha");
      return !!d && !d.open && !!d.querySelector("#gununAlan") && !!d.querySelector("#brifingAlan") && !!d.querySelector("#e25VitrinAlan") &&
        !document.querySelector("#bugunKartAlan").closest("#kesifDaha") && !document.querySelector(".arama-kutu").closest("#kesifDaha");
    }));
    ok("3.2: karakter kartında ad, unvan ve özet alt alta", await Y.evaluate(function () {
      cizKarakterler();
      const k = document.querySelector("#karakterIzgara .kart");
      return !!k && ["kart-unvan", "kart-ad", "kart-ozet"].every(function (c) { const e = k.querySelector("." + c); return !e || getComputedStyle(e).display === "block"; });
    }));
    ok("3.2: ana sayfada tekrar eden evren şeridi ve boş cüzdan görünmez", await Y.evaluate(function () {
      const s = document.querySelector("#evrenSerit");
      return (!s || getComputedStyle(s).display === "none") && getComputedStyle(document.querySelector("#rastgeleBtn")).display === "none";
    }));
    await Y.evaluate(function () { location.hash = "#/tomye"; }); await bekle(Y, 900);
    ok("3.2: Tömye arşivi kendi sayfasında; ana sayfada yok, şeritte ana sayfalar", await Y.evaluate(function () {
      const kar = document.querySelector("#arsiv");
      return aktifSayfa === "tomye" && !kar.hidden && document.querySelectorAll("#karakterIzgara .kart").length > 3 && !!document.querySelector("#sayfaBasi h1") &&
        GEZINME.find(function (g) { return g.id === "arsiv"; }).bolumler.length === 1 && document.querySelectorAll("#gezinme a.gez-btn").length <= 8 &&
        !!document.querySelector('.hero a[href="#/tomye"]');
    }));
    await Y.evaluate(function () { location.hash = "#/oyunlar"; }); await bekle(Y, 900);
    ok("3.2: sayfa başlığı ile ilk bölüm başlığı aynıysa ikincisi gizli", await Y.evaluate(function () {
      const s = document.querySelector("#oyunlar");
      return s.classList.contains("baslik-tekrar") && getComputedStyle(s.querySelector(".bolum-basi h2")).display === "none" && getComputedStyle(document.querySelector("#sayfaBasi h1")).display !== "none";
    }));
    await Y.evaluate(function () { location.hash = "#/arsiv"; }); await bekle(Y, 700);
    await Y.click('#anaEvrenler [data-evren-git="#/ev/site/e25"]'); await bekle(Y, 800);
    ok("ana sayfadaki evren kartı evrene götürür", await Y.evaluate(function () { return !!EVS && EVS.kaynak === "site" && EVS.id === "e25"; }));

    /* ---------- 2. tek seferlik evren kurma kodu ---------- */
    console.log("3.1 tek seferlik evren kodu");
    await sahte.kokSorgu("insert into public.tek_kodlar (ozet, tur, ad) values (public.tek_kod_ozet('BIREVREN31'), 'evren1', 'Test') on conflict do nothing");
    const U = await cihaz("uye", { seviye: 0 });
    await kayitOl(U, "Tek Evren", "tekevren31", "te31@ornek.test");
    await U.goto(adres + "/arsiv/"); await U.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(U, 1500);
    await U.evaluate(function () { return tekKodDene("birevren31", null); }); await bekle(U, 1800);
    ok("kod hesaba bağlanır, kilit açılır (seviye 15 değil)", await U.evaluate(function () {
      const k = document.querySelector("#anaEvrenler .ana-kur");
      return tekHakVar("evren1") && uretimAcik("evren") && !seviyeYeter(15) && !!k && !k.classList.contains("kilitli") && !!k.querySelector("[data-es-yeni]");
    }));
    await U.click("#anaEvrenler [data-es-yeni]"); await bekle(U, 1500);
    ok("bir evren kurulur, hak harcanır ve kilit geri gelir", await U.evaluate(function () {
      return /^#\/ev\/benim\//.test(rota()) && !tekHakVar("evren1") && !uretimAcik("evren");
    }));
    ok("sunucuda hak harcandı olarak işaretli", (await sahte.kokSorgu("select harcama is not null h from public.tek_kodlar where ozet = public.tek_kod_ozet('BIREVREN31')")).rows[0].h === true);
    ok("ikinci evren kurulamaz", await U.evaluate(function () { const n = fanEserlerim().filter(function (x) { return x.tur === "evren"; }).length; evrenYeniKur(); return fanEserlerim().filter(function (x) { return x.tur === "evren"; }).length === n; }));
    await U.evaluate(function () { if (typeof perdeKapat === "function") { perdeKapat(); } });

    /* 3.1.1: hak Kurucu dışındaki yollarda da harcanır; kopyalamak da kapıdan geçer */
    console.log("3.1.1 tek seferlik kod başka yollardan");
    await sahte.kokSorgu("insert into public.tek_kodlar (ozet, tur, ad) values (public.tek_kod_ozet('IKIEVREN311'), 'evren1', 'Test') on conflict do nothing");
    const U2 = await cihaz("uye2", { seviye: 0 });
    await kayitOl(U2, "İki Evren", "ikievren311", "ie311@ornek.test");
    await U2.goto(adres + "/arsiv/"); await U2.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(U2, 1500);
    await U2.evaluate(function () { return tekKodDene("ikievren311", null); }); await bekle(U2, 1800);
    ok("Fan sayfasındaki '+ Yeni evren' de hakkı harcar; ikincisi açılmaz", await U2.evaluate(function () {
      const vardi = tekHakVar("evren1");
      const e = fanYeni("evren");
      const r = vardi && !!e && !tekHakVar("evren1") && !uretimAcik("evren") && fanYeni("evren") === null;
      perdeKapat();
      return r;
    }));
    await bekle(U2, 1200);
    ok("fanYeni ile harcanan hak sunucuda da harcandı", (await sahte.kokSorgu("select harcama is not null h from public.tek_kodlar where ozet = public.tek_kod_ozet('IKIEVREN311')")).rows[0].h === true);
    ok("hak yokken evren kopyalamak kapıya takılır", await U2.evaluate(function () {
      const n = fanEserlerim().filter(function (x) { return x.tur === "evren"; }).length;
      const b = document.createElement("button"); b.setAttribute("data-evs-kopyala", ""); document.body.appendChild(b); b.click(); b.remove();
      const r = fanEserlerim().filter(function (x) { return x.tur === "evren"; }).length === n && !!document.querySelector("#perde .svk-pencere");
      perdeKapat();
      return r;
    }));
    ok("kacir tırnakları da kaçırır (nitelik değerleri güvenli)", await U2.evaluate(function () { return kacir("a\"b'c<d") === "a&quot;b&#39;c&lt;d"; }));

    /* ---------- 3. E25 ---------- */
    console.log("3.1 E25");
    const E = await cihaz("e25");
    await E.goto(adres + "/"); await E.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(E, 400);
    await E.evaluate(function () { window.kanonErisim = function () { return { hepsi: true, tumEvren: true, bolumler: new Set(), evrenler: new Set() }; }; location.hash = "#/ev/site/e25"; }); await bekle(E, 900);
    await E.evaluate(function () { EVS.sekme = "bilgi"; evrenSayfaCiz(); }); await bekle(E, 300);
    ok("Kapılar Salonu: bütün evrenlere kapı, E25'in kendisi hariç", await E.evaluate(function () {
      const k = Array.from(document.querySelectorAll("#evrenSayfa .e25-kapi")).map(function (x) { return x.getAttribute("data-evren-git"); });
      return k.length >= 5 && k.indexOf("#/ev/site/e25") === -1 && k.indexOf("#/arsiv") !== -1 && k.some(function (g) { return /^#\/ev\/fan\//.test(g); });
    }));
    ok("yeni Evrengezer formunda doğum: kapı ve ilk söz", await E.evaluate(function () {
      const d = document.querySelector("#evrenSayfa .e25-kisiler details"); if (d) { d.open = true; }
      return !!document.querySelector("#kisiKapi") && !!document.querySelector("#kisiIlkSoz") && document.querySelectorAll("#kisiKapi option").length >= 5;
    }));
    await E.fill("#kisiAd", "Varra"); await E.fill("#kisiUnvan", "Kapı bekçisi"); await E.fill("#kisiOzet", "E25'in sisinden çıktı.");
    await E.selectOption("#kisiKapi", { index: 1 }); await E.fill("#kisiIlkSoz", "Burası soğuk.");
    await E.click("#evrenSayfa [data-kisi-kaydet]"); await bekle(E, 800);
    const dogum = await E.evaluate(function () {
      const e = fanEserlerim().find(function (x) { return x.tur === "kisi" && x.ad === "Varra"; });
      return { d: e && e.dogum, sahne: !!document.querySelector("#evrenSayfa .e25-dogum"), metin: (document.querySelector("#evrenSayfa .e25-dogum") || {}).textContent || "", dosya: e ? (kisiTemizle(e).dogum || {}).soz : "" };
    });
    ok("Evrengezer doğar: kapı ve ilk söz kaydedilir, dosyaya girer, doğum sahnesi görünür", !!dogum.d && !!dogum.d.kapi && dogum.d.soz === "Burası soğuk." && dogum.dosya === "Burası soğuk." && dogum.sahne && /Varra/.test(dogum.metin) && /Burası soğuk/.test(dogum.metin), dogum);
    await E.evaluate(function () {
      const l = fanEserlerim();
      const v = l.find(function (x) { return x.tur === "kisi" && x.ad === "Varra"; });
      l.push({ bicim: "tentifor-eser", surum: 1, tur: "kisi", id: "egLune", evren: "e25", ad: "Lune", unvan: "Gezgin", kisilik: [] });
      l.push({ bicim: "tentifor-eser", surum: 1, tur: "hikaye", id: "hBuz", baslik: "Buzda", evren: "Tömye", metin: "x", konuklar: [JSON.parse(JSON.stringify(v))] });
      l.push({ bicim: "tentifor-eser", surum: 1, tur: "hikaye", id: "hE26", baslik: "Kıyıda", evren: "E26", metin: "x", konuklar: [JSON.parse(JSON.stringify(v))] });
      fanEserlerimYaz(l);
      evrDogumSon = null; evrenSayfaCiz();
    }); await bekle(E, 300);
    ok("pasaport: gezdiği her evren için bir damga", await E.evaluate(function () {
      const v = fanEserlerim().find(function (x) { return x.tur === "kisi" && x.ad === "Varra"; });
      const d = e25Damgalar(v.id).map(function (x) { return x.ad; }).sort().join("|");
      const kart = kisiKartHtml({ e: v, kaynak: "benim" });
      return d === "E26|Tömye" && /Pasaport · 2 damga/.test(kart) && (kart.match(/e25-damga /g) || []).length === 2;
    }));
    ok("Kapılar Salonu: kapıdan geçen Evrengezerler sayılır", await E.evaluate(function () {
      return /1 Evrengezer geçti/.test(document.querySelector('#evrenSayfa .e25-kapi[data-evren-git="#/arsiv"]').textContent);
    }));
    ok("E25 sıralamaları: en çok gezen, en çok hikâyede, bu ay doğanlar", await E.evaluate(function () {
      const s = e25Siralama();
      return s.gezgin[0].ad === "Varra" && s.gezgin[0].gez === 2 && s.hikaye[0].ad === "Varra" && s.yeni.some(function (x) { return x.ad === "Varra"; }) && !!document.querySelector("#evrenSayfa .e25-sira");
    }));
    await E.evaluate(function () {
      const a = document.querySelector("#e25BulusA"), b = document.querySelector("#e25BulusB");
      a.value = Array.from(a.options).find(function (o) { return /Varra/.test(o.textContent); }).value;
      b.value = Array.from(b.options).find(function (o) { return /Lune/.test(o.textContent); }).value;
      document.querySelector("#e25BulusEvren").value = "Tömye";
    });
    await E.click("#evrenSayfa [data-e25-bulus]"); await bekle(E, 800);
    ok("karşılaşma: iki Evrengezer yeni bir hikâye taslağında, seçilen evrende", await E.evaluate(function () {
      const h = fanDuzenlenen("hikaye");
      return aktifSayfa === "fan" && !!h && h.evren === "Tömye" && (h.konuklar || []).map(function (k) { return k.ad; }).sort().join("|") === "Lune|Varra" && /Varra ile Lune karşılaşıyor/.test(h.baslik);
    }));

    /* ---------- 4. evren: kişi sayfası, sürüm farkı, haritada zaman ---------- */
    console.log("3.1 kişi sayfası, sürüm farkı, haritada zaman");
    await E.evaluate(function () { location.hash = "#/oyunlar"; }); await bekle(E, 300);
    await E.evaluate(function () { evrenSeciciAc(); }); await bekle(E, 200);
    await E.click("#evrenSecici [data-es-yeni]"); await bekle(E, 700);
    const evId = await E.evaluate(function () { return EVS.id; });
    await E.evaluate(function (id) {
      evrenBenimDegistir(id, function (e) {
        e.ad = "Tuz Denizi"; e.ozet = "Tuzun hafıza olduğu deniz.";
        e.kisiler = [{ ad: "Mira", rol: "Tuz okuyucu", yas: "34", aciklama: "Denizi okur." }, { ad: "Oren", yas: "60", aciklama: "Balıkçı." }, { ad: "Lia", yas: "8", aciklama: "Çırak." }];
        e.baglar = [{ a: "Oren", b: "Mira", etiket: "baba" }, { a: "Mira", b: "Lia", etiket: "anne" }];
        e.tarih = [{ zaman: "12", cag: "Tuz Çağı", yer: "Tuzkent", olay: "Mira Tuzkent'te doğdu." }, { zaman: "40", yer: "Liman", olay: "Oren limanı kurdu." }];
        e.belgeler = [{ tur: "Mektup", kimden: "Oren", kime: "Mira", metin: "Kızım Mira, deniz adını söyledi." }];
        e.harita = { yerler: [{ id: "y1", ad: "Tuzkent", x: 30, y: 30 }, { id: "y2", ad: "Liman", x: 70, y: 60 }] };
      });
    }, evId);
    ok("tarih olayına yer yazılabilir ve dosyaya girer", await E.evaluate(function (id) { return fanTemizle(evrenBenimBul(id)).tarih[0].yer === "Tuzkent" && FAN_EVREN_GRUPLARI.find(function (g) { return g.k === "tarih"; }).alanlar.some(function (a) { return a[0] === "yer"; }); }, evId));
    await E.evaluate(async function (id) { await gcmKaydet(id, "test", true); evrenBenimDegistir(id, function (e) { e.kisiler.push({ ad: "Kael", aciklama: "Yabancı." }); e.ad = "Tuz Denizi II"; }); }, evId);
    await E.evaluate(function (id) { EVS.sekme = "bilgi"; evrenSayfaCiz(); const d = document.querySelector("#evrenSayfa [data-gcm-kutu]"); d.open = true; d.dispatchEvent(new Event("toggle")); }, evId); await bekle(E, 600);
    await E.click("#evrenSayfa [data-gcm-fark]"); await bekle(E, 400);
    ok("sürüm geçmişi: şimdikiyle karşılaştırılır (eklenen kişi, ad değişikliği; değişmeyen belge yok)", await E.evaluate(function () {
      const t = document.querySelector("#evrenSayfa .gcm-fark").textContent;
      return /kişi eklendi: Kael/.test(t) && /Tuz Denizi II/.test(t) && !/belge/.test(t);
    }));
    await E.evaluate(function (id) { location.hash = "#/ev/onizle/" + id; }, evId); await bekle(E, 700);
    await E.evaluate(function () { EVS.sekme = "harita"; evrenSayfaCiz(); }); await bekle(E, 300);
    await E.evaluate(function () { const r = document.querySelector("#evrZamanAralik"); r.value = 1; r.dispatchEvent(new Event("input", { bubbles: true })); }); await bekle(E, 200);
    ok("haritada zaman: kaydırınca olayın yeri yanar ve olay yazılır", await E.evaluate(function () {
      const g = document.querySelector("#evrenSayfa .evh-yer.zaman-isik");
      return !!g && g.getAttribute("data-evh-yer") === "y2" && /Oren limanı kurdu/.test(document.querySelector("#evrZamanOlay").textContent);
    }));
    await E.evaluate(function () { EVS.sekme = "bilgi"; evrenSayfaCiz(); }); await bekle(E, 300);
    await E.click('#evrenSayfa [data-evr-kisi="Mira"]'); await bekle(E, 300);
    ok("kişi sayfası: aile, bağlar, tarih, belgeler; ailedeki ada dokununca onun sayfası", await E.evaluate(function () {
      const p = document.querySelector("#perde");
      const t = p.textContent;
      const ilk = !p.hidden && /Ebeveyni: Oren/.test(t) && /Çocukları: Lia/.test(t) && /Mira Tuzkent'te doğdu/.test(t) && /Mektup/.test(t);
      p.querySelector('[data-evr-kisi="Oren"]').click();
      return ilk && /Oren/.test(p.querySelector("h3").textContent) && /Çocukları: Mira/.test(p.textContent);
    }));
    await E.evaluate(function () { perdeKapat(); });

    /* ---------- 5. panel: kanona aday evrenler ---------- */
    ok("panelde kanona aday evrenler: kanona al", await E.evaluate(function () {
      const f = fanSiteListesi("evren")[0];
      f.durum = "kanonAday";
      window.yoneticiAcik = function () { return true; }; window.panelAcik = function () { return true; };
      evrenSayfaKapat(); location.hash = "#/sen"; yoneticiGrup = "icerik"; yoneticiSekme = "listeler"; yListe = "kanonAday"; yoneticiCiz();
      const var_ = !!document.querySelector('[data-kanon-aday-al="' + f.id + '"]') && /Tömye ölçeği %/.test(document.querySelector("#yoneticiAlan").textContent);
      document.querySelector('[data-kanon-aday-al="' + f.id + '"]').click();
      const r = var_ && f.kanon === true && !document.querySelector('[data-kanon-aday-al="' + f.id + '"]');
      delete f.kanon; delete f.durum;
      return r;
    }));

    /* ---------- 6. erişilebilirlik ve telefon taraması ---------- */
    console.log("3.1 erişilebilirlik ve telefon taraması");
    const T = await cihaz("tarama");
    await T.goto(adres + "/"); await T.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(T, 600);
    const sayfalar = await T.evaluate(function () { return GEZINME.map(function (g) { return g.id; }); });
    const hepsi = [];
    for (const s of sayfalar) {
      await T.evaluate(function (s) { location.hash = "#/" + s; }, s); await bekle(T, 700);
      await T.evaluate(function () { window.scrollTo(0, document.body.scrollHeight); }); await bekle(T, 500);   /* geç çizilen bölümler */
      const r = await T.evaluate(erisimTara, null);
      r.forEach(function (x) { hepsi.push(s + ": " + x); });
    }
    ok("15 sayfada adsız düğme/bağlantı/alan yok, yinelenen kimlik yok, yana taşma yok", hepsi.length === 0, hepsi.slice(0, 12));
    const evrenSorun = [];
    for (const yol of ["#/ev/site/e25", "#/ev/fan/" + (await T.evaluate(function () { return fanSiteListesi("evren")[0].id; }))]) {
      await T.evaluate(function (y) { location.hash = y; }, yol); await bekle(T, 1200);
      for (const sk of ["harita", "bilgi"]) {
        await T.evaluate(function (sk) { EVS.sekme = sk; evrenSayfaCiz(); }, sk); await bekle(T, 400);
        (await T.evaluate(erisimTara, "#evrenSayfa")).forEach(function (x) { evrenSorun.push(yol + " " + sk + ": " + x); });
      }
      await T.evaluate(function () { evrenSayfaKapat(); });
    }
    ok("evren sayfalarında (E25, fan evreni) adsız öğe ve taşma yok", evrenSorun.length === 0, evrenSorun.slice(0, 12));

    ok("3.1 testlerinde sayfa hatası yok", hatalar.length === 0, hatalar);
  } finally {
    await tarayici.close();
    await sahte.pool.end().catch(function () { /* kapalı */ });
  }
  return gecen;
}
