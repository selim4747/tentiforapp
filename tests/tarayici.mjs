/* Tarayıcı testleri: yayın paketini (dist/) gerçek bir Chromium'da açar.
   Supabase istekleri tests/supabase-taklidi.cjs üzerinden gerçek PostgreSQL'e gider.
   tests/calistir.mjs tarafından çağrılır: tarayiciTestleri({ adres, veritabani }). */

import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { yeniSahte } = require("./supabase-taklidi.cjs");

const TEST_URL = "https://test.supabase.co";

function b64urlBaytUzunluk(s) { return Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64").length; }

export async function tarayiciTestleri({ adres, veritabani, dizin }) {
  const sahte = yeniSahte(veritabani);
  const hesapKod = readFileSync(dizin + "/js/28-hesap.js", "utf8").replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, TEST_URL);
  const hatalar = [];
  let gecen = 0;
  const ok = function (ad, kosul, ek) {
    if (!kosul) { throw new Error("BAŞARISIZ: " + ad + (ek !== undefined ? " → " + JSON.stringify(ek) : "")); }
    gecen++;
    console.log("  tamam: " + ad);
  };

  const sayfalar = [];
  const tarayici = await chromium.launch(process.env.CHROMIUM_YOLU ? { executablePath: process.env.CHROMIUM_YOLU } : {});

  async function cihaz(ad, secenek) {
    const ctx = await tarayici.newContext(Object.assign({ viewport: { width: 420, height: 1000 }, serviceWorkers: "block", acceptDownloads: true }, secenek || {}));
    await ctx.addInitScript(function () { try { localStorage.setItem("tentiforapp_tur", "bitti"); } catch (e) { /* yok */ } });
    await ctx.route(/\/js\/28-hesap\.js(\?|$)/, function (r) { return r.fulfill({ status: 200, contentType: "application/javascript", body: hesapKod }); });
    await ctx.route(TEST_URL + "/**", function (r) { return sahte.isle(r); });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, function (r) { return r.abort(); });
    const p = await ctx.newPage();
    sayfalar.push([ad, p]);
    p.on("pageerror", function (e) { hatalar.push(ad + ": " + e.message); });
    p.on("console", function (m) {
      if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|fonts\.g/.test(m.text())) { hatalar.push(ad + " konsol: " + m.text()); }
    });
    return p;
  }
  const bekle = function (p, ms) { return p.waitForTimeout(ms || 600); };

  async function kayitOl(p, ad, kadi, eposta) {
    await p.goto(adres + "/"); await bekle(p, 1200);
    await p.click("#hesapBtn");
    await p.click('#perde [data-hesap-pencere="kayit"]');
    await p.fill("#hKayitAd", ad); await p.fill("#hKayitKullanici", kadi);
    await p.fill("#hKayitEposta", eposta); await p.fill("#hKayitSifre", "tomye-2026");
    await p.click('[data-hesap-form="kayit"] button[type=submit]'); await bekle(p, 800);
    /* taklit, e-posta onay kodu olarak adresin kendisini kabul eder */
    await p.goto(adres + "/?code=" + encodeURIComponent(eposta) + "&hesap=onay#/sen"); await bekle(p, 2500);
  }

  try {
    /* ---------- 1. on sayfa, hatasız ---------- */
    console.log("sayfalar");
    const Z = await cihaz("ziyaretçi");
    const zIstek = [];
    Z.on("request", function (r) { zIstek.push(r.url()); });
    await Z.goto(adres + "/"); await bekle(Z, 1500);

    /* ---------- performans ---------- */
    ok("veri.json tek kez iner", zIstek.filter(function (u) { return /\/veri\.json/.test(u); }).length === 1,
      zIstek.filter(function (u) { return /veri\.json/.test(u); }));
    ok("betik ve stil adresleri sürümlü", zIstek.filter(function (u) { return /\/(js|css)\/[^?]+$/.test(u) && !/vendor/.test(u); }).length === 0,
      zIstek.filter(function (u) { return /\/(js|css)\/[^?]+$/.test(u); }));
    await Z.evaluate(function () { location.hash = "#/bilinmeyenler"; }); await bekle(Z, 800);
    await Z.evaluate(function () { location.hash = "#/mektuplar"; }); await bekle(Z, 800);
    await Z.evaluate(function () { location.hash = "#/harita"; }); await bekle(Z, 800);
    /* Proje/Oyunlar sayfalarındaki topluluk alanları görününce kütüphaneyi ister; bunun dışında inmemeli */
    ok("hesap kütüphanesi ziyaretçiye inmez (kilitli bölümler dahil)", !zIstek.some(function (u) { return /supabase-2/.test(u); }));
    ok("bölümler ekran dışındayken çizilmez", await Z.evaluate(function () {
      return getComputedStyle(document.querySelector("section.bolum")).contentVisibility === "auto";
    }));
    /* ekran dışı çizim (content-visibility) kaydırma hedefini kaydırmamalı: kapalı hâliyle aynı yere inmeli */
    const Zk = await cihaz("ziyaretçi-cv-kapalı");
    await Zk.addInitScript(function () {
      document.addEventListener("DOMContentLoaded", function () { document.documentElement.classList.add("bolum-olc"); });
      window.requestAnimationFrame = (function (r) { return function (f) { return r(function (t) { document.documentElement.classList.add("bolum-olc"); f(t); }); }; })(window.requestAnimationFrame);
    });
    for (const hedef of ["claudeEvren", "liderlik", "gizlilik", "mektuplar"]) {
      await Z.goto(adres + "/#/" + hedef); await bekle(Z, 2500);
      await Zk.goto(adres + "/#/" + hedef); await bekle(Zk, 2500);
      const ust = function (h) { return Math.round(document.getElementById(h).getBoundingClientRect().top); };
      const a = await Z.evaluate(ust, hedef), b = await Zk.evaluate(ust, hedef);
      ok("doğrudan bağlantı aynı yere iner: " + hedef, Math.abs(a - b) < 40, [a, b]);
    }
    await Zk.close();
    const sayfaIdleri = await Z.evaluate(function () { return GEZINME.map(function (g) { return g.id; }); });
    ok("12 sayfa tanımlı", sayfaIdleri.length === 12, sayfaIdleri);
    for (const s of sayfaIdleri) {
      await Z.evaluate(function (s) { location.hash = "#/" + s; }, s); await bekle(Z, 500);
      const gorunen = await Z.evaluate(function () {
        return document.querySelectorAll("section.bolum:not([hidden])").length;
      });
      ok("#/" + s + " açılır (" + gorunen + " bölüm)", gorunen > 0);
      const tasma = await Z.evaluate(function () { return document.documentElement.scrollWidth - window.innerWidth; });
      ok("#/" + s + " telefonda yana taşmaz", tasma <= 0, tasma);
    }

    /* ---------- mobil gezinme ---------- */
    console.log("mobil");
    ok("alt menü görünür", await Z.evaluate(function () { const m = document.querySelector("#altMenu"); return !!m && getComputedStyle(m).display !== "none" && m.querySelectorAll(".alt-oge").length === 5; }));
    ok("üst başlık telefonda sığar", await Z.evaluate(function () { const u = document.querySelector(".ust"); return u.scrollWidth <= u.clientWidth + 1; }));
    await Z.evaluate(function () { location.hash = "#/arsiv"; }); await bekle(Z, 500);
    await Z.click("[data-mobil-menu]"); await bekle(Z, 300);
    ok("menü sayfası bütün sayfaları listeler", await Z.locator("#mobilMenu .mm-sayfa").count() === 12);
    await Z.click('#mobilMenu .mm-sayfa[href="#/fan"]'); await bekle(Z, 600);
    ok("menüden sayfaya gidilir, menü kapanır", await Z.evaluate(function () { return aktifSayfa === "fan" && !document.querySelector("#mobilMenu"); }));
    ok("alt menüde Evren düğmesi", await Z.evaluate(function () { return !!document.querySelector("#altMenu [data-evren-sec]"); }));
    const acikBaslik = await Z.evaluate(function () { return getComputedStyle(document.querySelector(".ust")).backgroundColor; });
    await Z.click("[data-mobil-menu]"); await bekle(Z, 300);
    await Z.click('[data-mobil-eylem="tema"]'); await bekle(Z, 200);
    const geceBaslik = await Z.evaluate(function () { return getComputedStyle(document.querySelector(".ust")).backgroundColor; });
    ok("menüden gece modu; başlık da koyulaşır", await Z.evaluate(function () { return document.documentElement.getAttribute("data-ayar-tema") === "gece"; }) &&
      geceBaslik !== acikBaslik, [acikBaslik, geceBaslik]);
    await Z.click('[data-mobil-eylem="tema"]'); await Z.click("[data-mobil-kapat]"); await bekle(Z, 200);
    ok("girdiler telefonda 16px (iPhone yakınlaştırmaz)", await Z.evaluate(function () {
      location.hash = "#/isim";
      const g = document.querySelector("#isimGiris");
      return parseFloat(getComputedStyle(g).fontSize) >= 16;
    }));

    /* paylaşım hedefinden gelen dosya (servis çalışanının önbelleğe koyduğu) açılır */
    await Z.evaluate(async function () {
      const e = { bicim: "tentifor-eser", surum: 1, tur: "hikaye", id: "paylasimtest", baslik: "Paylaşılan hikâye", metin: "Gelen dosya." };
      const c = await caches.open("tf-paylasim");
      await c.put("/__paylasilan", new Response(fanDosyaHtml(e), { headers: { "Content-Type": "text/html" } }));
      location.hash = "#/fan/paylasim";
    });
    await bekle(Z, 900);
    ok("paylaşılan dosya Fan'da açılır", await Z.evaluate(function () {
      const h = document.querySelector(".fan-pencere h1");
      return !!h && h.textContent === "Paylaşılan hikâye" && location.hash === "#/fanAc";
    }));
    await Z.evaluate(function () { document.querySelector("#perde").hidden = true; });
    /* ---------- güncelleme: açık kalan sayfa yeni sürümü alır ---------- */
    const GU = await cihaz("güncelleme");
    let ghYazildi = 0;
    await GU.route("https://api.github.com/**", function (r) {
      if (r.request().method() !== "GET") { ghYazildi++; return r.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
      return r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ sha: "abc", encoding: "base64", content: Buffer.from(JSON.stringify({ surum: "99.0.0" })).toString("base64") }) });
    });
    await GU.goto(adres + "/#/oyunlar"); await bekle(GU, 1500);
    const surumDosyasi = JSON.parse(readFileSync(dizin + "/surum.json", "utf8"));
    ok("yayın paketi sürüm kimliği taşır", await GU.evaluate(function (d) {
      return /^[0-9a-f]{12}$/.test(sayfaPaketi()) && sayfaPaketi() === d.paket && d.surum === veri.surum;
    }, surumDosyasi));
    await GU.evaluate(async function () { document.querySelector('meta[name="tentifor-paket"]').content = "eskipaket000"; guncellemeSonBakis = 0; await guncellemeBak(false); });
    ok("yayında yeni sürüm varsa çubuk çıkar", await GU.locator("#guncellemeCubugu").count() === 1 && /Yeni sürüm hazır/.test(await GU.textContent("#guncellemeCubugu")));
    await Promise.all([GU.waitForNavigation(), GU.click("[data-guncelle]")]); await bekle(GU, 1800);
    ok("Yenile sayfayı yeni sürümle açar ve haber verir", await GU.evaluate(function (d) {
      return !document.querySelector("#guncellemeCubugu") && sayfaPaketi() === d.paket && /güncellendi/.test((document.querySelector("#eckaBildirim") || {}).textContent || "");
    }, surumDosyasi));
    await GU.evaluate(function () { document.querySelector('meta[name="tentifor-paket"]').content = "eskipaket000"; window.__eskiSayfa = true; });
    await Promise.all([GU.waitForNavigation(), GU.evaluate(function () { guncellemeBak(true); })]); await bekle(GU, 1200);
    ok("uzun süre arka planda kalan sayfa dönünce kendiliğinden yenilenir", await GU.evaluate(function () { return !window.__eskiSayfa; }));
    ok("yazı yazılırken kendiliğinden yenilemez, çubuk çıkar", await GU.evaluate(async function () {
      document.querySelector('meta[name="tentifor-paket"]').content = "eskipaket000"; window.__eskiSayfa = true;
      const t = document.createElement("textarea"); document.body.appendChild(t); t.focus();
      await guncellemeBak(true);
      const sonuc = window.__eskiSayfa === true && !!document.querySelector("#guncellemeCubugu");
      t.remove(); document.querySelector("#guncellemeCubugu").remove();
      return sonuc;
    }));
    ok("eski sürümdeki panel Kaydet'le yeni veriyi ezmez", await GU.evaluate(async function () {
      gh = { kullanici: "u", depo: "d", dal: "main", yol: "veri.json", jeton: "t" };
      let mesaj = ""; const eski = window.yoneticiDurum;
      window.yoneticiDurum = function (m) { mesaj = m; };
      await githubGonder();
      window.yoneticiDurum = eski;
      return /daha yeni bir sürüm var \(99\.0\.0\)/.test(mesaj);
    }) && ghYazildi === 0);

    const manifest = JSON.parse(readFileSync(dizin + "/manifest.webmanifest", "utf8"));
    ok("_redirects üretilir (Cloudflare Pages vb.)", /\/u\/\*\s+\/\?profil=:splat\s+302/.test(readFileSync(dizin + "/_redirects", "utf8")));
    ok("manifest: paylaşım hedefi ve kısayollar", manifest.share_target && manifest.share_target.params.files[0].name === "dosya" && manifest.shortcuts.length >= 4);
    ok("aramada Claude'un evreni ve bölümler", await Z.evaluate(function () {
      const d = aramaDizini();
      return d.some(function (k) { return k.tur === "Claude'un evreni"; }) && d.some(function (k) { return k.tur === "Şomdo kişisi"; });
    }));
    await Z.evaluate(function () { location.hash = "#/gizlilik"; }); await bekle(Z, 600);
    ok("gizlilik sayfası yazılı", /KVKK/.test(await Z.textContent("#gizlilikAlan")));

    /* ---------- evren sayfaları ve fan atölyesi ---------- */
    console.log("fan atölyesi");
    await Z.evaluate(function () { location.hash = "#/claude"; }); await bekle(Z, 700);
    ok("Claude'un evreni kendi sayfasında", await Z.evaluate(function () {
      const acik = Array.from(document.querySelectorAll("section.bolum:not([hidden])")).map(function (b) { return b.id; });
      return acik.join() === "claudeEvren" && document.querySelector("#claudeEvrenAlan").textContent.length > 100;
    }));
    ok("Dünya sayfasında artık yok", await Z.evaluate(function () { return sayfaBolumleri("dunya").indexOf("claudeEvren") === -1; }));

    await Z.evaluate(function () { location.hash = "#/fanHikaye"; }); await bekle(Z, 700);
    await Z.evaluate(function () { document.querySelector('[data-fan-sekme="hikaye:yaz"]').click(); }); await bekle(Z, 200);
    await Z.evaluate(function () { document.querySelector('[data-fan-yeni="hikaye"]').click(); }); await bekle(Z, 200);
    const zararli = '<img src=x onerror="window.__xss=1">Buz </script> & "tırnak"';
    await Z.fill("#fanA_baslik", zararli);
    await Z.fill("#fanA_metin", "Birinci paragraf.\n\nİkinci paragraf, Tömye'de.");
    await Z.fill("#fanA_evren", "Tömye");
    await bekle(Z, 500);
    ok("taslak kendiliğinden kaydolur", await Z.evaluate(function (z) { const l = fanEserlerim(); return l.length === 1 && l[0].baslik === z && /İkinci/.test(l[0].metin); }, zararli));
    const [hInd] = await Promise.all([Z.waitForEvent("download"), Z.evaluate(function () { document.querySelector('[data-fan-indir="hikaye"]').click(); })]);
    ok("hikâye dosyası iner", /\.tentifor\.html$/.test(hInd.suggestedFilename()), hInd.suggestedFilename());
    const hYol = await hInd.path();
    const hHtml = readFileSync(hYol, "utf8");
    ok("dosya kendi başına okunur, veri bloğu kaçırılmış", /<h1>&lt;img/.test(hHtml) && !/<\/script> &/.test(hHtml.split("tentifor-eser")[1] || "") && /İkinci paragraf/.test(hHtml));

    await Z.evaluate(function () { location.hash = "#/fanAc"; }); await bekle(Z, 700);
    await Z.setInputFiles("[data-fan-dosya]", hYol); await bekle(Z, 600);
    ok("yüklenen dosya açılır", await Z.evaluate(function (z) { const p = document.querySelector(".fan-pencere h1"); return !!p && p.textContent === z; }, zararli));
    ok("dosyadaki kod çalışmaz", await Z.evaluate(function () { return window.__xss === undefined && !document.querySelector(".fan-pencere img"); }));
    ok("son açılanlarda", await Z.evaluate(function (z) { return fanAcilanlar().some(function (x) { return x.baslik === z; }); }, zararli));
    ok("yanlış dosya reddedilir", await Z.evaluate(function () { try { fanMetindenEser("<html><body>merhaba</body></html>"); return false; } catch (e) { return /değil/.test(e.message); } }));
    ok("uydurma alanlar temizlenir", await Z.evaluate(function () {
      const e = fanTemizle({ bicim: "tentifor-eser", tur: "evren", id: "a b<>", ad: "X", kurallar: [{ ad: "k", tur: "renk", aciklama: "a", zarar: "<b>" }], gizli: 1 });
      return e.id === "ab" && !("gizli" in e) && !("zarar" in e.kurallar[0]) && e.kurallar[0].tur === "renk";
    }));

    await Z.evaluate(function () { document.querySelector("#perde").hidden = true; location.hash = "#/fanEvren"; }); await bekle(Z, 700);
    await Z.evaluate(function () { document.querySelector('[data-fan-sekme="evren:yaz"]').click(); }); await bekle(Z, 200);
    await Z.evaluate(function () { document.querySelector('[data-fan-yeni="evren"]').click(); }); await bekle(Z, 200);
    await Z.fill("#fanA_ad", "Tuz Evreni");
    await Z.fill("#fanA_kurallar_0_ad", "Tuz hafızadır");
    await Z.fill("#fanA_kurallar_0_tur", "hafıza-kimya");
    await bekle(Z, 450);
    await Z.evaluate(function () { document.querySelector('[data-fan-ekle="ozelAlanlar"]').click(); }); await bekle(Z, 200);
    await Z.fill("#fanA_ozelAlanlar_0_ad", "Gökyüzünün rengi");
    await Z.fill("#fanA_ozelAlanlar_0_deger", "Tuz beyazı");
    await bekle(Z, 450);
    const ev = await Z.evaluate(function () { return fanEserlerim().find(function (x) { return x.tur === "evren"; }); });
    ok("evren kuralları ve kendi alanları kaydolur", ev.ad === "Tuz Evreni" && ev.kurallar[0].tur === "hafıza-kimya" && ev.ozelAlanlar[0].deger === "Tuz beyazı", ev);
    await Z.evaluate(function () { document.querySelector('[data-fan-onizle="evren"]').click(); }); await bekle(Z, 300);
    ok("evren önizlemesi", /Gökyüzünün rengi/.test(await Z.textContent(".fan-pencere")) && await Z.locator(".fan-pencere dt").count() === 2);

    /* yönetici: fanmade olarak ekler */
    await Z.evaluate(function () { window.__panelAcik = window.panelAcik; window.panelAcik = function () { return true; }; fanPencere(fanAcilanlar().filter(function (x) { return x.tur === "hikaye" && x.id !== "paylasimtest"; }).pop(), "acilan"); }); await bekle(Z, 200);
    await Z.evaluate(function () { document.querySelector('[data-fan-p="siteye"]').click(); }); await bekle(Z, 200);
    ok("yönetici siteye ekler", await Z.evaluate(function () { return veri.fanEserleri.hikayeler.length === 1; }));
    const fid = await Z.evaluate(function () { return veri.fanEserleri.hikayeler[0].id; });
    await Z.evaluate(function () { document.querySelector("#perde").hidden = true; fanSekme.hikaye = "oku"; fanHikayeCiz(); });
    ok("fanmade listesinde görünür", await Z.locator("#fanHikayeAlan .fan-kart").count() === 1);
    await Z.evaluate(function (id) { location.hash = "#/fan/hikaye/" + id; }, fid); await bekle(Z, 500);
    ok("fanmade bağlantısı açılır", await Z.evaluate(function () { return !document.querySelector("#perde").hidden && !!document.querySelector(".fan-pencere"); }));
    await Z.evaluate(function () { veri.fanEposta = "fan@ornek.test"; document.querySelector("#perde").hidden = true; fanAcCiz(); });
    ok("gönderim adresi ve e-posta bağlantısı", await Z.evaluate(function () { const a = document.querySelector('#fanAcAlan a[href^="mailto:fan@ornek.test"]'); return !!a; }));
    await Z.evaluate(function () { window.panelAcik = window.__panelAcik; });
    ok("fan kapak kartı üretilir", await Z.evaluate(async function () {
      const t = await fanKapakUret({ bicim: "tentifor-eser", tur: "hikaye", id: "k1", baslik: "Buz altındaki kitap", yazar: "Okur", evren: "Tömye", metin: "Bir paragraf." });
      return !!t && t.width === 1080 && t.height === 1350;
    }));
    await Z.evaluate(function () { localStorage.setItem("tentiforapp_gorulen_surum", "0.0.1"); location.hash = "#/kesif"; surumNotuCiz(); });
    ok("güncellemeden sonra \"Neler yeni\" kartı", await Z.locator("#surumNotuAlan .surum-notu li").count() > 0);
    await Z.evaluate(function () { document.querySelector("[data-surum-kapat]").click(); });
    ok("kart kapatılınca bir daha çıkmaz", await Z.evaluate(function () { surumNotuCiz(); return !document.querySelector(".surum-notu") && localStorage.getItem("tentiforapp_gorulen_surum") === veri.surum; }));

    /* ---------- evren seçici, kendi evreni ve haritası ---------- */
    console.log("evrenler");
    await Z.evaluate(function () { location.hash = "#/oyunlar"; }); await bekle(Z, 500);
    await Z.click("#altMenu [data-evren-sec]"); await bekle(Z, 300);
    ok("evren seçici açılır ve E99'u listeler", await Z.evaluate(function () {
      const t = document.querySelector("#evrenSecici").textContent;
      return /E99/.test(t) && /Claude/.test(t) && /Senin evrenlerin/.test(t);
    }));
    await Z.click("[data-es-yeni]"); await bekle(Z, 600);
    ok("yeni evren kendi sayfasında, bilgi sekmesiyle açılır", await Z.evaluate(function () {
      return /^#\/ev\/benim\//.test(location.hash) && !!document.querySelector('#evrenSayfa [data-fan-hedef] [data-fan-alan="ad"]');
    }));
    await Z.fill('#evrenSayfa [data-fan-alan="ad"]', "Deneme Evreni"); await bekle(Z, 450);
    const evId = await Z.evaluate(function () { return EVS.id; });
    ok("evren adı kişinin verisine yazılır", await Z.evaluate(function (id) { return evrenBenimBul(id).ad === "Deneme Evreni"; }, evId));
    await Z.click('[data-evs-sekme="harita"]'); await bekle(Z, 200);
    await Z.click('[data-evh-mod="yer"]'); await bekle(Z, 100);
    let kutu = await Z.locator("#evrenSayfa .evh-svg").boundingBox();
    await Z.mouse.click(kutu.x + kutu.width * 0.3, kutu.y + kutu.height * 0.3); await bekle(Z, 200);
    await Z.fill("#evhAd", "Tuzkent"); await bekle(Z, 100);
    ok("haritaya yer eklenir", await Z.evaluate(function (id) {
      const y = evrenBenimBul(id).harita.yerler; return y.length === 1 && y[0].ad === "Tuzkent" && Math.abs(y[0].x - 30) < 2 && Math.abs(y[0].y - 30) < 2;
    }, evId));
    await Z.click('[data-evh-mod="cizim"]'); await bekle(Z, 100);
    kutu = await Z.locator("#evrenSayfa .evh-svg").boundingBox();
    for (const n of [[0.6, 0.2], [0.9, 0.3], [0.8, 0.8]]) { await Z.mouse.click(kutu.x + kutu.width * n[0], kutu.y + kutu.height * n[1]); await bekle(Z, 80); }
    await Z.click("[data-evh-bitir]"); await bekle(Z, 200);
    ok("alan (kıta) çizilir", await Z.evaluate(function (id) { const y = evrenBenimBul(id).harita.yerler; return y.length === 2 && y[1].sekil.length === 3; }, evId));
    kutu = await Z.locator("#evrenSayfa .evh-svg").boundingBox();
    await Z.click('[data-evh-mod="sec"]'); await bekle(Z, 100);
    kutu = await Z.locator("#evrenSayfa .evh-svg").boundingBox();
    await Z.mouse.move(kutu.x + kutu.width * 0.3, kutu.y + kutu.height * 0.3);
    await Z.mouse.down(); await Z.mouse.move(kutu.x + kutu.width * 0.45, kutu.y + kutu.height * 0.5, { steps: 6 }); await Z.mouse.up(); await bekle(Z, 200);
    ok("yer sürüklenerek taşınır", await Z.evaluate(function (id) { const y = evrenBenimBul(id).harita.yerler[0]; return y.x > 40 && y.y > 42; }, evId));
    ok("harita dosyaya girer, dışarıdan gelen harita sınırlanır", await Z.evaluate(function (id) {
      const html = fanDosyaHtml(fanTemizle(evrenBenimBul(id)));
      const t = fanTemizle({ bicim: "tentifor-eser", tur: "evren", id: "h", ad: "H", harita: { yerler: [{ ad: "<b>", x: 500, y: -3, sekil: [[1, 2], [3, 4]] }], renk: "red" } });
      return /Tuzkent/.test(html) && /<svg class="evh-svg/.test(html) && t.harita.yerler[0].x === 100 && t.harita.yerler[0].y === 0 && !t.harita.yerler[0].sekil && !t.harita.renk;
    }, evId));
    /* ---------- Evrengezer: stil, alfabe, kod, kilitli lore ---------- */
    ok("kendi evreninde lore, stil ve kod sekmeleri", await Z.evaluate(function () {
      return ["lore", "stil", "kod"].every(function (k) { return !!document.querySelector('#evrenSayfa [data-evs-sekme="' + k + '"]'); });
    }));
    ok("kendi evrenini gezmek para vermez", await Z.evaluate(function () { return egYukle().ziyaret.l.length === 0; }));
    await Z.click('[data-evs-sekme="stil"]'); await bekle(Z, 200);
    await Z.fill('#evrenSayfa [data-evst="para.ad"]', "Tuz tanesi"); await bekle(Z, 100);
    await Z.fill('#evrenSayfa [data-evst="para.kur"]', "0.5"); await bekle(Z, 100);
    await Z.selectOption('#evrenSayfa [data-evst="harita.stil.desen"]', "gece"); await bekle(Z, 250);
    await Z.evaluate(function () { const i = document.querySelector('#evrenSayfa [data-evst="stil.zemin"]'); i.value = "#112233"; i.dispatchEvent(new Event("change", { bubbles: true })); }); await bekle(Z, 200);
    await Z.click("[data-evst-alfabe-uret]"); await bekle(Z, 200);
    await Z.check('#evrenSayfa [data-evst="alfabe.baslik"]'); await bekle(Z, 250);
    ok("evren parası, harita deseni, sayfa stili ve alfabe kaydolur", await Z.evaluate(function (id) {
      const e = evrenBenimBul(id);
      return e.para.ad === "Tuz tanesi" && e.para.kur === 0.5 && e.harita.stil.desen === "gece" && e.stil.zemin === "#112233" &&
        Object.keys(e.alfabe.harfler).length === 29 && e.alfabe.baslik === true;
    }, evId));
    ok("sayfa stili ve alfabeli ad uygulanır, harita gece deseninde", await Z.evaluate(function () {
      const s = document.querySelector("#evrenSayfa");
      return /--kar:#112233/.test(s.getAttribute("style")) && !!s.querySelector(".evs-alfabe-ad") &&
        s.querySelector(".evst-onizleme .evh-deniz").getAttribute("fill") === "#0F1D2E";
    }));
    ok("stil, para ve alfabe dosyaya girer; zararlı değerler temizlenir", await Z.evaluate(function (id) {
      const t = fanTemizle(evrenBenimBul(id));
      const k = fanTemizle({ bicim: "tentifor-eser", tur: "evren", id: "k", ad: "K", para: { ad: "x", kur: 99 }, stil: { zemin: "red;background:url(x)", font: "comic" },
        harita: { yerler: [], stil: { desen: "yok", kara: "javascript:" } }, alfabe: { harfler: { a: "<script>alert(1)</script>", q: "Q" } } });
      return t.para.ad === "Tuz tanesi" && t.harita.stil.desen === "gece" && t.alfabe.baslik &&
        k.para.kur === 1 && !k.stil && !k.harita.stil && k.alfabe.harfler.a === "<scr" && !k.alfabe.harfler.q && evrenSayfaStili(k) === "";
    }, evId));
    await Z.click('[data-evs-sekme="kod"]'); await bekle(Z, 200);
    await Z.evaluate(function () { const t = document.querySelector("#evKodMetin"); t.value = "{ bozuk"; }); await Z.click("[data-evkod-uygula]"); await bekle(Z, 150);
    ok("bozuk kod reddedilir", /okunamadı/.test(await Z.textContent("#evKodDurum")));
    await Z.click("[data-evkod-geri]"); await bekle(Z, 150);
    await Z.evaluate(function () {
      const t = document.querySelector("#evKodMetin"); const o = JSON.parse(t.value);
      o.ad = "Kodla Değişen"; o.kurallar = [{ ad: "Tuz konuşur", tur: "fizik", aciklama: "Her tane bir kelime." }]; o.uydurma = "<img onerror=x>";
      t.value = JSON.stringify(o);
    });
    await Z.click("[data-evkod-uygula]"); await bekle(Z, 200);
    ok("evrenin kodu açılıp değiştirilir, uydurma alan temizlenir", await Z.evaluate(function (id) {
      const e = evrenBenimBul(id); return e.ad === "Kodla Değişen" && e.kurallar[0].ad === "Tuz konuşur" && !("uydurma" in e) && e.harita.yerler.length === 2;
    }, evId));
    /* gerçek veride Evrengezer anahtarı kurulu olabilir; bu testler anahtarsız başlar, sonra kendi anahtarını kurar */
    await Z.evaluate(function () { window.__egGercek = veri.evrengezer; delete veri.evrengezer; egGizliOnbellek = null; });
    await Z.click('[data-evs-sekme="lore"]'); await bekle(Z, 200);
    await Z.fill("#evlBaslik", "Tuzun sırrı");
    await Z.fill("#evlMetin", "Tuz aslında unutmaktır.");
    await Z.fill("#evlYeniKod", "tuz-2024");
    await Z.fill("#evlIpucu", "Denizin dibine bak");
    await Z.fill("#evlIpucuFiyat", "5");
    await Z.click("[data-evl-ekle]"); await bekle(Z, 400);
    ok("kilitli lore şifreli kaydolur, kurucu okur", await Z.evaluate(function (id) {
      const e = evrenBenimBul(id); const l = e.lorlar[0];
      return e.lorlar.length === 1 && !/unutmak/.test(JSON.stringify(e)) && /unutmaktır/.test(document.querySelector("#evrenSayfa .evl-metin").textContent) &&
        /TUZ-2024/.test(document.querySelector("#evrenSayfa .evl-kurucu").textContent) && !l.seg;
    }, evId));
    const loreSonuc = await Z.evaluate(async function (id) {
      const e = evrenBenimBul(id);
      localStorage.removeItem(EVL_ANAHTAR);
      const kilitli = lorIcCoz(e.lorlar[0], evlAcilan(e.id)[e.lorlar[0].id]) === null;
      const yanlis = await evrenKodDene(e, "BASKA-KOD");
      /* başka bir evren aynı kodla kurulur: o evrenin kodu bu evrende, bu evrenin kodu orada çalışmaz */
      const b = fanYeni("evren"); evrenBenimDegistir(b.id, function (x) { x.ad = "Öbür Evren"; });
      await evrenLoreEkle(evrenBenimBul(b.id), { baslik: "Öbür sır", metin: "Burada başka şey var.", kod: "OBUR-KOD" });
      const obur = await evrenKodDene(e, "OBUR-KOD");
      const dogru = await evrenKodDene(e, "Tuz-2024");
      const karsi = await evrenKodDene(evrenBenimBul(b.id), "TUZ-2024");
      const y = evrenYoneticiKoduKur(evrenBenimBul(id), "EVY-SAHIP1");
      localStorage.removeItem(EVL_ANAHTAR);
      const yon = await evrenKodDene(evrenBenimBul(id), "evy-sahip1");
      const yonKarsi = await evrenKodDene(evrenBenimBul(b.id), "EVY-SAHIP1");
      const tomyeKodu = await evrenKodDene(evrenBenimBul(id), "SAFAK");
      fanEserlerimYaz(fanEserlerim().filter(function (x) { return x.id !== b.id; }));
      return { kilitli: kilitli, yanlis: yanlis.tur, obur: obur.tur, dogru: dogru.tur + dogru.n, karsi: karsi.tur, y: y.sarilan, yon: yon.tur + yon.n, yonKarsi: yonKarsi.tur, tomye: tomyeKodu.tur };
    }, evId);
    ok("lore kodu yalnızca kendi evreninde çalışır", loreSonuc.kilitli && loreSonuc.yanlis === "" && loreSonuc.obur === "" && loreSonuc.dogru === "lore1" && loreSonuc.karsi === "" && loreSonuc.tomye === "", loreSonuc);
    ok("evren yönetici kodu bütün loreları açar, başka evrende çalışmaz", loreSonuc.y === 1 && loreSonuc.yon === "evren1" && loreSonuc.yonKarsi === "", loreSonuc);
    const egSonuc = await Z.evaluate(async function (id) {
      const eskiOzet = veri.yoneticiOzet;
      veri.yoneticiOzet = dogrulamaOzeti("TEST-EVRENGEZER");
      yoneticiGiris("TEST-EVRENGEZER");
      const kur = await evrengezerAnahtariKur("");
      await evrenLoreEkle(evrenBenimBul(id), { baslik: "İkinci sır", metin: "Evrengezer de okur.", kod: "IKINCI-1" });
      const sarildi = await evrenEgSarEksik(evrenBenimBul(id));
      const e = evrenBenimBul(id);
      const hepsiSarili = e.lorlar.every(function (l) { return !!l.seg; });
      yoneticiKod = null; yoneticiSinirli = false; kayitYaz(YONETICI_ANAHTAR, ""); egGizliOnbellek = null;
      localStorage.removeItem(EVL_ANAHTAR);
      const kapali = Object.keys(evlAcilan(e.id)).length === 0;
      const eg = await evrenKodDene(e, "TEST-EVRENGEZER");
      const acilan = Object.keys(evlAcilan(e.id)).length;
      yoneticiCikis(); veri.yoneticiOzet = eskiOzet; delete veri.evrengezer; egGizliOnbellek = null;
      if (window.__egGercek) { veri.evrengezer = window.__egGercek; }
      for (const k in EVL_OTURUM) { delete EVL_OTURUM[k]; }
      return { kur: kur, sarildi: sarildi, hepsiSarili: hepsiSarili, kapali: kapali, eg: eg.tur + eg.n, acilan: acilan };
    }, evId);
    ok("Evrengezer yönetici kodu her evrende bütün loreları açar", egSonuc.kur === "" && egSonuc.sarildi === 1 && egSonuc.hepsiSarili && egSonuc.kapali && egSonuc.eg === "evrengezer2" && egSonuc.acilan === 2, egSonuc);
    ok("kopyalanan evren başkasının lorelarını ve kodunu taşımaz", await Z.evaluate(function (id) {
      EVS = { kaynak: "acilan", id: id, sekme: "bilgi", secili: null, mod: "sec", cizim: [] };
      fanAcilanEkle(fanTemizle(evrenBenimBul(id)));
      evrenSayfaCiz();
      document.querySelector("[data-evs-kopyala]").click();
      const k = fanEserlerim()[fanEserlerim().length - 1];
      window.__kopyaId = k.id;
      return k.id !== id && !k.lorlar && !k.yoneticiOzet && k.ad === "Kodla Değişen";
    }, evId));
    await bekle(Z, 300);
    await Z.evaluate(function (id) { location.hash = "#/ev/benim/" + id; }, evId); await bekle(Z, 400);
    await Z.evaluate(function () { fanEserlerimYaz(fanEserlerim().filter(function (x) { return x.id !== window.__kopyaId; })); });
    await Z.click("[data-evs-kapat]"); await bekle(Z, 300);
    ok("evren sayfası kapanır", await Z.evaluate(function () { return !document.querySelector("#evrenSayfa") && location.hash === "#/fan"; }));
    ok("kendi evreni seçicide", await Z.evaluate(function () { return evrenSeciciListesi().benim.some(function (x) { return x.ad === "Kodla Değişen"; }); }));
    ok("E99 katkısı fan taslaklarında görünmez", await Z.evaluate(function () { e99Katki(); fanSekme.evren = "yaz"; fanEvrenCiz(); return !/E99 katkım/.test(document.querySelector("#fanEvrenAlan").textContent); }));

    await Z.evaluate(function () { location.hash = "#/ev/e99"; }); await bekle(Z, 500);
    await Z.click('[data-evs-sekme="bilgi"]'); await bekle(Z, 200);
    await Z.click('#evrenSayfa [data-fan-hedef="e99-katkim"] [data-fan-ekle="kurallar"]'); await bekle(Z, 200);
    await Z.fill('#evrenSayfa [data-fan-hedef="e99-katkim"] [data-fan-alan="kurallar.0.ad"]', "Tuz hafızadır"); await bekle(Z, 450);
    ok("başka evreni gezmek o evrenin parasını verir (günde bir kez)", await Z.evaluate(function () {
      const ilk = egBakiye("e99");
      const tekrar = evrenZiyaretOdulu();
      return ilk === 40 && tekrar === 0 && /E99 jetonu/.test(document.querySelector("#evrenSayfa [data-evs-cuzdan]").textContent);
    }));
    await Z.click("#evrenSayfa [data-eg-buro]"); await bekle(Z, 200);
    await Z.evaluate(function () { document.querySelector('#perde [data-eg-satir="e99"] input').value = "1"; }); 
    await Z.click('#perde [data-eg-al="e99"]'); await bekle(Z, 200);
    ok("Evrengezer bürosu: evren parası EG'ye çevrilir (kesintiyle)", await Z.evaluate(function () { return egBakiye("e99") === 19 && egYukle().eg === 1; }));
    const egEckaOnce = await Z.evaluate(function () { return cuzdan.ecka; });
    await Z.click('#perde [data-eg-sat="tomye"]'); await bekle(Z, 200);
    ok("EG başka evrenin parasına (eçka) çevrilir", await Z.evaluate(function (o) { return egYukle().eg === 0 && cuzdan.ecka === o + 9; }, egEckaOnce));
    await Z.click('#perde [data-eg-sat="tomye"]'); await bekle(Z, 150);
    ok("EG yetmezse çevrilmez", /Yetmez/.test(await Z.textContent("#egDurum")) && await Z.evaluate(function (o) { return cuzdan.ecka === o + 9; }, egEckaOnce));
    await Z.evaluate(function () { document.querySelector("#perde").hidden = true; });
    ok("Tömye: oyunların toplam günlük tavanı", await Z.evaluate(function () {
      const eski = cuzdan.gunluk;
      cuzdan.gunluk = { cevirmen: 90, vardiya: 100, boyut: 90, yazi: 10 };
      const k = gunlukKalan("baloncuk"), y = gunlukKalan("yazi");
      cuzdan.gunluk = eski;
      return k === 10 && y === 10 && gunlukKalan("baloncuk") > 0;
    }));
    ok("E99 katkısı yalnızca bu cihazda tutulur", await Z.evaluate(function () { return e99Katki().kurallar[0].ad === "Tuz hafızadır" && veri.e99.kurallar.length === 0; }));
    const [zE99] = await Promise.all([Z.waitForEvent("download"), Z.click("[data-e99-gonder]")]); await bekle(Z, 300);
    ok("E99 katkısı girişsiz dosya olur, sunucuya gitmez", /\.tentifor\.html$/.test(zE99.suggestedFilename()) &&
      await Z.evaluate(function () { return e99Katki().kurallar.length === 0 && /^e99k/.test(e99Gonderilenler()[0].id); }), zE99.suggestedFilename());
    ok("E99 dosyası yazarın e-postasına gönderilir", await Z.evaluate(function () {
      return /fan@ornek\.test/.test(document.querySelector(".e99-katki").textContent) && !!document.querySelector('.e99-katki a[href^="mailto:fan@ornek.test"]') &&
        !!document.querySelector("[data-e99-indir]");
    }));
    await Z.evaluate(function () { const p = document.querySelector("#perde"); if (p) { p.hidden = true; } evrenSayfaKapat(); });
    ok("sayfa paylaş düğmesi", await Z.locator("#sayfaBasi [data-sayfa-paylas]").count() === 1);
    await Z.evaluate(function () { location.hash = "#/mektuplar"; }); await bekle(Z, 800);
    ok("uzun metinlerde Dinle düğmesi", await Z.locator(".sesli-dugme").count() > 0);

    /* ---------- 2. paylaşım adresi ve PWA ---------- */
    const kisa = await (await fetch(adres + "/dunya/")).text();
    ok("/dunya/ önizleme etiketi", /og:title" content="TentiforApp — Dünya"/.test(kisa));
    ok("/dunya/ yönlendirir", /location\.replace\("\/#\/dunya"/.test(kisa));
    const man = await (await fetch(adres + "/manifest.webmanifest")).json();
    ok("manifest simgeleri", man.icons.length >= 2 && (await fetch(adres + "/" + man.icons[0].src)).ok);

    /* ---------- 3. gece modu cihaz ayarını izler ---------- */
    const G = await cihaz("gece", { colorScheme: "dark" });
    await G.goto(adres + "/"); await bekle(G, 1200);
    ok("karanlık cihazda gece teması", await G.evaluate(function () { return document.documentElement.getAttribute("data-ayar-tema"); }) === "gece");
    await G.close();

    /* ---------- 3b. sınırlı yönetici kodu (testte kendi kodumuz) ---------- */
    const Y = await cihaz("sinirli");
    await Y.goto(adres + "/"); await bekle(Y, 1200);
    const giris = await Y.evaluate(function () {
      veri.sinirliYoneticiOzet = dogrulamaOzeti("YRD-TESTKOD1");
      const d = { textContent: "", className: "" };
      return [ustaGiris("YRD-TESTKOD1", d), yoneticiAcik(), panelAcik()];
    });
    ok("sınırlı kod paneli açar ama tam yönetici yapmaz", giris[0] === true && giris[1] === false && giris[2] === true, giris);
    await bekle(Y, 1200);
    await Y.evaluate(function () { location.hash = "#/sen"; }); await bekle(Y, 600);
    const sekmeAdlari = await Y.evaluate(function () {
      return Object.keys(Y_GRUPLARI).map(function (g) { return yoneticiSekmeleri(g).join(","); }).join("|");
    });
    ok("kişiler, anahtarlar ve yedek sınırlı kodda yok", !/kisiler|anahtarlar|yedek|karakterler/.test(sekmeAdlari), sekmeAdlari);
    ok("buz katmanları kilitli kalır", await Y.evaluate(function () {
      return (veri.katmanlar || []).every(function (k) { return !cozulenler[k.dogrulama]; });
    }));
    ok("kanon bölümleri açılır", await Y.evaluate(function () { return bolumErisimi("evren"); }));
    await Y.evaluate(function () { yoneticiGrup = "bakim"; yoneticiSekme = "yedek"; yoneticiCiz(); });
    ok("izinsiz sekmeye zorla gidilemez", await Y.evaluate(function () { return yoneticiSekme !== "yedek"; }));
    await Y.close();

    /* ---------- 3c. Claude tarafından yapılan evren: kanon dışı, kodsuz ziyaretçiye açık ---------- */
    await Z.evaluate(function () { location.hash = "#/claudeEvren"; }); await bekle(Z, 900);
    ok("evren bölümü kodsuz ziyaretçiye açık", await Z.evaluate(function () {
      const b = document.querySelector("#claudeEvren");
      return !b.hidden && !b.classList.contains("kanon-kilitli") && getComputedStyle(b).display !== "none";
    }));
    ok("canon listelerine karışmıyor", await Z.evaluate(function () {
      return !(veri.karakterler || []).some(function (k) { return /^cl_/.test(k.id); }) &&
             !(veri.evren || []).some(function (e) { return /^cl/.test(e.id); });
    }));
    const ceSay = await Z.evaluate(function () { return veri.claudeEvreni.maddeler.filter(function (m) { return m.tur === "fizik"; }).length; });
    ok("fizik kuralları genelde listelenir", await Z.locator("#claudeEvrenAlan .ce-kurallar li").count() === ceSay && ceSay >= 10, ceSay);
    for (const sekme of ["fizik", "dunya", "toplum", "tarih", "kisiler", "hikayeler", "belgeler", "sozluk", "sorular"]) {
      await Z.click('[data-ce-sekme="' + sekme + '"]'); await bekle(Z, 150);
      const dolu = await Z.evaluate(function () { return document.querySelector("#claudeEvrenAlan .ce-govde").textContent.trim().length; });
      ok("sekme dolu: " + sekme, dolu > 100, dolu);
    }
    /* Şomdo oyunları */
    await Z.click('[data-ce-sekme="oyunlar"]'); await bekle(Z, 200);
    ok("isim kayması", await Z.evaluate(function () { return [isimKaydir("şimdi"), isimKaydir("Şomdo", -1), isimKaydir("Özlem")].join(" "); }) === "şomdo Şimdi Uzlım");
    await Z.click('[data-sf="basla"]');
    const yb = await Z.locator('[data-sf="yuru"]').boundingBox();
    await Z.mouse.move(yb.x + 10, yb.y + 10); await Z.mouse.down(); await bekle(Z, 1500);
    await Z.mouse.move(yb.x + 10, yb.y - 300); await Z.mouse.up();
    await bekle(Z, 300);
    ok("şafak: parmak kayarak kalksa da yürüyüş durur", await Z.evaluate(function () { return SF && !SF.tus.yuru; }));
    ok("tanık ayna: her karede tam bir sahte, kural gerçekten çiğnenmiş", await Z.evaluate(function () {
      let bozuk = 0;
      for (let n = 0; n < 200; n++) {
        aynaDava = n % 7;
        const k = aynaUret(); const s = k.filter(function (x) { return x.sahte; });
        if (s.length !== 1) { bozuk++; continue; }
        const f = s[0], i = k.indexOf(f);
        if (!(f.golgeSag !== f.korSol || f.renk !== f.hareket || (i > 0 && f.parlak > k[i - 1].parlak))) { bozuk++; }
        k.forEach(function (x) { if (!x.sahte && (x.golgeSag !== x.korSol || x.renk !== x.hareket)) { bozuk++; } });
      }
      return bozuk === 0;
    }));
    await Z.click('[data-so-oyun="isim"]'); await bekle(Z, 150);
    await Z.click('[data-ce-sekme="genel"]'); await bekle(Z, 150);
    await Z.click("[data-ce-harita]"); await bekle(Z, 900);
    ok("harita kodsuz açılır", await Z.evaluate(function () { return HT.acik && aktifHarita().id === "claude"; }));
    await Z.keyboard.press("Escape"); await bekle(Z, 300);

    /* ---------- 4. hesaplar, teori, oylama, takip ---------- */
    console.log("topluluk");
    const A = await cihaz("A");
    await kayitOl(A, "Yönetici", "yonetici", "a@ornek.test");
    await sahte.kokSorgu("insert into public.yoneticiler (id) select id from auth.users where email = 'a@ornek.test'");
    await A.evaluate(function () { return yarisIcerikEsitle(); }); await bekle(A, 1200);
    const oylanabilir = await sahte.kokSorgu("select count(*)::int n from public.oylanabilir");
    ok("yönetici girişinde yapımlar oylamaya yüklenir", oylanabilir.rows[0].n > 0, oylanabilir.rows[0]);

    const B = await cihaz("B");
    await kayitOl(B, "Ayşe", "ayse", "b@ornek.test");
    /* bilinmeyenler ve yapımlar kanon kilidinin arkasında: kodu olan okur gibi aç */
    await B.evaluate(function () {
      window.kanonErisim = function () { return { hepsi: true, tumEvren: true, bolumler: new Set(), evrenler: new Set() }; };
      kanonKilitUygula();
    });
    await B.evaluate(function () { location.hash = "#/bilinmeyenler"; }); await bekle(B, 1500);
    await B.fill("#teoriMetin", "Bence Gırı saniyesi Tömye gününün yirmi beşte biriydi; yine 25.");
    await B.click('[data-teori-form] button[type=submit]'); await bekle(B, 1200);
    ok("teori panoda görünür", /yirmi beşte/.test(await B.textContent("#teoriAlan")));

    await B.evaluate(function () { location.hash = "#/yapimlar"; }); await bekle(B, 1500);
    const ilkOy = B.locator("[data-oyla]").first();
    ok("oylama düğmeleri", await B.locator("[data-oyla]").count() > 0);
    await ilkOy.click(); await bekle(B, 900);
    ok("oy kaydedilir", (await sahte.kokSorgu("select count(*)::int n from public.yapim_oylari")).rows[0].n === 1);

    await B.evaluate(function () { location.hash = "#/u/yonetici"; }); await bekle(B, 1800);
    await B.click('[data-takip="yonetici"]'); await bekle(B, 900);
    ok("takip kaydedilir", (await sahte.kokSorgu("select count(*)::int n from public.takipler")).rows[0].n === 1);

    /* ---------- kartpostal ---------- */
    await B.evaluate(function () { location.hash = "#/kartpostal"; }); await bekle(B, 600);
    await B.fill("#kpMesaj", "Işığın geldiği yerde buluşalım.");
    await B.check('input[name="kpKilit"][value="sifre"]'); await B.fill("#kpSifre", "tomye");
    await B.click('[data-kp-form] button[type=submit]'); await bekle(B, 200);
    const kpAdres = await B.inputValue("#kpAdres");
    ok("kartpostal bağlantısı mesajı açık taşımaz", /#\/kartpostal\//.test(kpAdres) && kpAdres.indexOf("buluşalım") === -1);
    const K = await cihaz("kartpostal-alıcı");
    await K.goto(kpAdres.replace(/^[^#]+/, adres + "/")); await bekle(K, 1800);
    await K.fill("#kpCozKod", "yanlis"); await K.click("[data-kp-coz] button"); await bekle(K, 100);
    ok("yanlış şifre açmaz", /tutmadı/.test(await K.textContent("#kpMetin")));
    await K.fill("#kpCozKod", "tomye"); await K.click("[data-kp-coz] button"); await bekle(K, 100);
    ok("doğru şifre açar", /buluşalım/.test(await K.textContent("#kpMetin")));
    await K.close();

    /* ---------- arşiv avı ---------- */
    await B.evaluate(function () { location.hash = "#/av"; }); await bekle(B, 600);
    for (const cevap of ["Kor", "an", "yol", "Ilat", "Tömye"]) {
      await B.fill("#avCevap", cevap); await B.click("[data-av-form] button[type=submit]"); await bekle(B, 150);
    }
    ok("beş ipucu çözülünce son soru çıkar", await B.locator("[data-av-son]").count() === 1);
    await B.fill("#avSon", "KAYIT"); await B.click("[data-av-son] button"); await bekle(B, 1200);
    ok("son cevap sunucuda doğrulanır", /1\. çözensin/.test(await B.textContent("#avDurum")), await B.textContent("#avDurum"));

    /* ---------- Kor'un Hıçkırığı ---------- */
    await sahte.kokSorgu("delete from public.hickirik_olaylari");
    await sahte.kokSorgu("insert into public.hickirik_olaylari (gun, bas) values ((now() at time zone 'Europe/Istanbul')::date, now() - interval '30 seconds')");
    await B.evaluate(function () { try { localStorage.removeItem("tentiforapp_hickirik_gun"); } catch (e) {} return hickirikSor(); }); await bekle(B, 600);
    ok("hıçkırık herkese görünür", await B.locator("#hickirik").count() === 1);
    await B.click('[data-hickirik="tanik"]'); await bekle(B, 1000);
    ok("erişilebilirlikteki sesli okuma fonksiyonu ezilmiyor", await B.evaluate(function () {
      return typeof sesliOku === "function" && sesliOku.toString().indexOf("speechSynthesis.cancel") !== -1 && typeof sesliDugmeOku === "function";
    }));
    ok("tanıklık kaydedilir", (await sahte.kokSorgu("select count(*)::int n from public.hickirik_taniklari")).rows[0].n === 1);
    await B.click('[data-hickirik="kapat"]');

    /* ---------- tepkiler, kenar notları, ortam sesi ---------- */
    await B.evaluate(function () { location.hash = "#/claudeEvren"; }); await bekle(B, 800);
    await B.click('[data-ce-sekme="hikayeler"]'); await bekle(B, 200);
    await B.evaluate(function () { document.querySelector(".ce-hikaye").open = true; }); await bekle(B, 1200);
    const tAlan = B.locator(".ce-hikaye .tepki-alan").first();
    await tAlan.locator('[data-tepki="kalp"]').click(); await bekle(B, 900);
    ok("tepki kaydedilir ve sayılır", /1/.test(await tAlan.locator('[data-tepki="kalp"]').textContent()));
    await tAlan.locator("[data-not-form] textarea").fill("Uzlım'ın beklemesi içime dokundu.");
    await tAlan.locator("[data-not-form] button").click(); await bekle(B, 900);
    ok("kenar notu görünür", /içime dokundu/.test(await tAlan.textContent()));
    await B.evaluate(function () { document.querySelector("#claudeEvren").scrollIntoView({ behavior: "instant", block: "start" }); }); await bekle(B, 500);
    await B.evaluate(function () { document.querySelector("#ortamSes").click(); }); await bekle(B, 300);
    const ortamDurum = await B.evaluate(function () {
      const r = document.querySelector("#claudeEvren").getBoundingClientRect();
      return { var: !!ortamSesi, mod: ortamSesi && ortamSesi.mod, ust: Math.round(r.top), alt: Math.round(r.bottom), gizli: document.querySelector("#claudeEvren").hidden, h: innerHeight,
        y: Math.round(scrollY), boy: document.documentElement.scrollHeight, perde: !document.querySelector("#perde").hidden,
        tasma: getComputedStyle(document.body).overflow + "/" + getComputedStyle(document.documentElement).overflow, sinif: document.documentElement.className };
    });
    ok("ortam sesi açılır, Şomdo bölümünde Şomdo sesi", ortamDurum.var && ortamDurum.mod === "somdo", ortamDurum);
    await B.evaluate(function () { window.scrollTo({ top: 0, behavior: "instant" }); }); await bekle(B, 500);
    ok("Claude'un sayfasının başında da Şomdo sesi", await B.evaluate(function () { return ortamSesi.mod === "somdo"; }));
    await B.evaluate(function () { location.hash = "#/okuma"; }); await bekle(B, 700);
    ok("başka sayfaya geçince Tömye sesine döner", await B.evaluate(function () { return ortamSesi.mod === "tomye"; }));
    await B.evaluate(function () { document.querySelector("#ortamSes").click(); }); await bekle(B, 200);
    ok("ortam sesi kapanır", await B.evaluate(function () { return ortamSesi === null; }));

    /* ---------- Topluluk II ---------- */
    await B.evaluate(function () { location.hash = "#/ortakDefter"; }); await bekle(B, 1200);
    await B.fill("[data-defter-form] textarea", "Kapının arkasında biri Kyldo dilinde fısıldıyordu.");
    await B.click("[data-defter-form] button"); await bekle(B, 900);
    ok("defter cümlesi sayfada", /fısıldıyordu/.test(await B.textContent("#ortakDefterAlan")));
    await B.evaluate(function () { location.hash = "#/yazaraSor"; }); await bekle(B, 1200);
    await B.fill("[data-soru-form] textarea", "Gırılar neden kitapları yaktı?");
    await B.click("[data-soru-form] button"); await bekle(B, 900);
    await A.evaluate(function () { location.hash = "#/yazaraSor"; }); await bekle(A, 1500);
    await A.evaluate(function () { document.querySelector(".yazar-cevapla").open = true; });
    await A.fill(".yazar-cevapla textarea", "Çünkü geçmişlerini kimsenin okumasını istemediler.");
    await A.click("[data-soru-cevapla]"); await bekle(A, 900);
    await B.evaluate(function () { return yazaraSorCiz(); }); await bekle(B, 700);
    ok("yazar cevabı soranda görünür", /kimsenin okumasını/.test(await B.textContent("#yazaraSorAlan")));
    /* kulüp, eşitlemenin yazdığı arşivci kişiliğidir: cihazdaki hesabın kişiliğini sunucuya gönder */
    const bKulup = await B.evaluate(function () { return liderlikGonder(true).then(function () { return arsivciKisilik().ad; }); });
    await bekle(B, 600);
    ok("kulüp eşitlemeyle sunucuya yazılır", (await sahte.kokSorgu("select kisilik from public.istatistikler s join auth.users u on u.id = s.id where u.email = 'b@ornek.test'")).rows[0].kisilik === bKulup, bKulup);
    await B.evaluate(function () { location.hash = "#/kulup"; }); await bekle(B, 1200);
    await B.fill("[data-kulup-form] input", "Karanlık Ruhlar, bu hafta arşivi bitiriyoruz.");
    await B.click("[data-kulup-form] button"); await bekle(B, 900);
    ok("kulüp duvarına yazılır", /arşivi bitiriyoruz/.test(await B.textContent("#kulupAlan")));
    await A.evaluate(function () { location.hash = "#/okurBulmaca"; }); await bekle(A, 1200);
    await A.evaluate(function () { document.querySelector("#okurBulmacaAlan details").open = true; });
    await A.fill("#obCevap", "buz"); await A.click("[data-ob-form] button"); await bekle(A, 900);
    await B.evaluate(function () { location.hash = "#/okurBulmaca"; }); await bekle(B, 1200);
    ok("okur bulmacası Kyldo yazısıyla görünür", await B.locator(".ob-kart .yz-hece").count() > 0);
    await B.fill("[data-ob-coz] input", "BUZ"); await B.click("[data-ob-coz] button"); await bekle(B, 900);
    ok("okur bulmacası çözülür", /Çözdün/.test(await B.textContent("#okurBulmacaAlan")));

    /* davet: yeni gelen, davet bağlantısıyla hesap açar */
    const D = await cihaz("davetli");
    await D.goto(adres + "/?davet=ayse#/arsiv"); await bekle(D, 1000);
    ok("davet adresten alınıp saklanır", await D.evaluate(function () { return localStorage.getItem("tentiforapp_davet") === "ayse" && location.search === ""; }));
    await D.click("#hesapBtn"); await D.click('#perde [data-hesap-pencere="kayit"]');
    await D.fill("#hKayitAd", "Davetli"); await D.fill("#hKayitKullanici", "davetli"); await D.fill("#hKayitEposta", "d@ornek.test"); await D.fill("#hKayitSifre", "tomye-2026");
    await D.click('[data-hesap-form="kayit"] button[type=submit]'); await bekle(D, 800);
    await D.goto(adres + "/?code=" + encodeURIComponent("d@ornek.test") + "&hesap=onay#/hesap"); await bekle(D, 3000);
    ok("davet sunucuda kaydedilir", (await sahte.kokSorgu("select count(*)::int n from public.davetler d join public.profiller p on p.id = d.davet_eden where p.kullanici_adi = 'ayse'")).rows[0].n === 1);
    ok("hesapta davet kutusu", await D.locator(".davet-kutu").count() === 1);
    await D.close();

    /* ---------- 5. hata bildirimi ---------- */
    await B.evaluate(function () { window.__hataYereldeGonder = true; window.hataGonder({ baslik: "Hata", mesaj: "test hatası", yigin: "a.js:1" }); });
    await bekle(B, 900);
    ok("hata sunucuya düşer", (await sahte.kokSorgu("select count(*)::int n from public.hata_kayitlari where mesaj like '%test hatası%'")).rows[0].n === 1);

    /* ---------- 6. yönetici paneli ---------- */
    /* ---------- seviyeler ---------- */
    ok("Tömye rakamları", await A.evaluate(function () { return [1, 7, 10, 11, 20, 21, 110, 111].map(tomyeSayi).join(" "); }) ===
      "Neo İdey Net Neo·Neo Neo·Net Vot·Neo Net·Net Neo·Neo·Neo");
    await sahte.kokSorgu("update public.istatistikler set tamlik = 10 where id = (select id from auth.users where email = 'a@ornek.test')");
    await A.evaluate(function () { location.hash = "#/hesap"; }); await bekle(A, 300);
    const eckaOnce = await A.evaluate(function () { return cuzdan.kazanilan; });
    await A.evaluate(function () { return toplulukHesapEk(); }); await bekle(A, 800);
    ok("hesapta iki seviye sistemi", await A.locator("#hesapTopluluk .basamak-sayi").count() === 1 && await A.locator("#hesapTopluluk .seviye-rozet").count() === 1);
    ok("XP dökümü görünür", /Arşiv tamlığı/.test(await A.textContent("#hesapTopluluk .xp-dokum")));
    const eckaSonra = await A.evaluate(function () { return cuzdan.kazanilan; });
    ok("seviye atlayınca eçka ödülü", eckaSonra > eckaOnce, [eckaOnce, eckaSonra]);
    await A.evaluate(function () { return toplulukHesapEk(); }); await bekle(A, 800);
    ok("ödül ikinci kez verilmez", await A.evaluate(function () { return cuzdan.kazanilan; }) === eckaSonra);

    /* ---------- yıl, kart, takvim, ilk hafta ---------- */
    console.log("yıl ve koleksiyon");
    ok("ilk hafta yolu yeni ziyaretçide başlar", await A.evaluate(function () { return !!ilkHaftaOku().bas; }));
    ok("yolun yedi adımı", await A.locator("#ilkHaftaAlan li").count() === 7);
    const ih = await A.evaluate(function () { ilkHaftaIsaretle("yazi"); ilkHaftaIsaretle("oyun"); return ilkHaftaOku(); });
    ok("açık adım ödüllenir, yarının adımı beklenir", ih.odul.join() === "yazi" && ih.yapilan.indexOf("oyun") !== -1, ih);

    await A.evaluate(function () { testBaslat(); while (!T.sonuc) { testSec(0); } });
    const testKart = await A.evaluate(function () { return T.sonuc; });
    ok("test sonucu kart verir", await A.evaluate(function (id) { return kartSahip(id); }, testKart));
    ok("kart ilk hafta adımını işaretler", await A.evaluate(function () { return ilkHaftaOku().yapilan.indexOf("kart") !== -1; }));
    await A.evaluate(function () { ["rolde", "giri", "kyldo"].forEach(function (id) { kartKazan(id, "test"); }); });
    ok("set tamamlanınca madalya", await A.evaluate(function () { return madalyaVar("setTamam"); }));
    await A.evaluate(function () { location.hash = "#/koleksiyon"; }); await bekle(A, 500);
    await A.evaluate(function () { koleksiyonCiz(); });
    ok("koleksiyon çizilir", await A.locator("#koleksiyonAlan .kol-kart").count() === await A.evaluate(function () { return veri.karakterler.length; }));
    ok("kodsuz ziyaretçi kart unvanı ve set adını görmez", await A.locator("#koleksiyonAlan .kol-unvan-k").count() === 0 &&
      !/Luyot/.test(await A.textContent("#koleksiyonAlan")));

    ok("Tömye tarihi ayrıştırılır", await A.evaluate(function () { const t = tomyeTarihAyir("Leg, 21"); return t.ayNo === 1 && t.gun === 21; }));
    ok("yaklaşan etkinlikler", await A.evaluate(function () { const l = yaklasanEtkinlikler(3); return l.length === 3 && l.every(function (e) { return e.kalan > 0; }); }));
    await A.evaluate(function () {
      const d = tomyeBugun();
      veri.takvimEtkinlikleri.push({ id: "testgunu", ad: "Test günü", ay: d.ay, gun: d.gun, sure: 1, tema: "kurtulus", metin: "deneme", gorev: { id: "yazi4", adet: 1, ad: "bir kelime", odul: 5 } });
      location.hash = "#/"; etkinlikSeritCiz();
    });
    ok("bugünkü etkinlik ana sayfada", /Test günü/.test(await A.textContent("#etkinlikAlan")));
    ok("geçici tema", await A.evaluate(function () { return document.documentElement.getAttribute("data-etkinlik"); }) === "kurtulus");
    await A.evaluate(function () { gorevIlerle("yazi4"); });
    ok("etkinlik görevi ödüllenir", await A.evaluate(function () { return kilitAcik(etkinlikOdulAnahtari({ id: "testgunu" })) && madalyaVar("takvimTanigi"); }));

    await A.evaluate(function () { location.hash = "#/yilim"; }); await bekle(A, 600);
    await A.evaluate(function () { yilimCiz(); }); await bekle(A, 300);
    ok("Tömye Yılım ölçüleri", await A.locator("#yilimAlan .yilim-olcu").count() === 8);
    const yil = await A.evaluate(function () { return yilimVerisi(tomyeBugun().yil); });
    ok("yıl kaydı eçkayı, madalyayı ve kartları sayar", yil.ecka > 0 && yil.madalya >= 2 && yil.kart >= 4 && yil.gun >= 1, yil);
    ok("Yılım kartı üretilir", await A.evaluate(async function () { const t = await yilimKartUret(tomyeBugun().yil); return t.width === 1080 && t.height === 1350; }));

    ok("yarış sonucu kartı", await A.evaluate(async function () {
      Y2 = { yaris: "alinti", sonuc: { durum: "tamam", puan: 42, dogru: 5, sure_ms: 30000, sonuclar: [] } };
      const t = await yarisKartUret();
      const html = yarisSonucHtml();
      Y2 = null;
      return !!t && t.width === 1080 && /data-yaris-kart/.test(html);
    }));

    console.log("panel");
    await A.evaluate(function () { location.hash = "#/sen"; }); await bekle(A, 600);
    const panel = async function (grup, sekme, ms) {
      await A.evaluate(function (a) { window.yoneticiAcik = function () { return true; }; yoneticiGrup = a[0]; yoneticiSekme = a[1]; yoneticiCiz(); }, [grup, sekme]);
      await bekle(A, ms || 1200);
    };
    await panel("bakim", "istatistik", 1800);
    ok("istatistik kutuları", await A.locator(".ist-kutu").count() === 5);
    ok("üç günlük grafik", await A.locator(".ist-coklu svg").count() === 3);
    ok("tablo görünümü", await A.locator(".ist-tablo tbody tr").count() === 14);
    await panel("bakim", "hatalar");
    ok("hatalar listelenir", /test hatası/.test(await A.textContent("#yHataAlan")));
    await panel("bakim", "yedek", 400);
    const [indirme] = await Promise.all([A.waitForEvent("download"), A.click("[data-y-yedek-al]")]);
    ok("yedek iner", /tentifor-yedek-/.test(indirme.suggestedFilename()));

    /* ---------- kurulum yardımcısı ---------- */
    await panel("bakim", "kurulum", 2500);
    ok("kurulum: bütün özellikler kurulu görünür", await A.evaluate(function () {
      const l = document.querySelectorAll("#yKurulumDenetim li");
      return l.length >= 12 && document.querySelectorAll("#yKurulumDenetim li.eksik").length === 0;
    }), await A.textContent("#yKurulumDenetim"));
    const parcalar = await A.evaluate(async function () {
      await kurulumDosyalariYukle();
      return { parcalar: kurulumParcala(kurulumMetin), tam: kurulumMetin, dugme: document.querySelectorAll("[data-y-kurulum-parca]").length };
    });
    ok("kurulum parçalara bölünür, hiçbir şey kaybolmaz", parcalar.parcalar.length >= 5 && parcalar.parcalar.join("\n") === parcalar.tam.replace(/\r\n/g, "\n") &&
      parcalar.dugme === parcalar.parcalar.length, parcalar.parcalar.length);
    ok("her parça telefonda kopyalanabilir boyutta", parcalar.parcalar.every(function (p) { return p.length < 25000; }), parcalar.parcalar.map(function (p) { return p.length; }));
    for (let i = 0; i < parcalar.parcalar.length; i++) { await sahte.kokSorgu(parcalar.parcalar[i]); }
    ok("parçalar sırayla çalıştırılınca kurulum tamamlanır", true);
    await A.evaluate(function () { navigator.clipboard.writeText = async function (m) { window.__pano = m; }; document.querySelector('[data-y-kurulum-parca="0"]').click(); });
    await bekle(A, 300);
    ok("parça tek dokunuşla panoya", await A.evaluate(function () { return window.__pano === kurulumParcala(kurulumMetin)[0]; }));
    ok("kopyalanan parça işaretlenir", /✓/.test(await A.textContent('[data-y-kurulum-parca="0"]')));
    ok("fonksiyon kodu da kopyalanabilir", await A.locator("[data-y-kurulum-fonksiyon]").count() === 1);

    /* ---------- E99: okur gönderir, yönetici onaylar ---------- */
    await B.evaluate(function () { location.hash = "#/ev/e99"; }); await bekle(B, 700);
    await B.evaluate(function () {
      const l = fanEserlerim(); const k = e99Katki(); const t = fanEserlerim();
      const e = t.find(function (x) { return x.id === "e99-katkim"; });
      e.kurallar = [{ ad: "Kuzey hiç yoktur", tur: "yön", aciklama: "Pusulalar döner durur." }];
      e.harita = { yerler: [{ id: "k1", ad: "Dönen Liman", tur: "Şehir", not: "", x: 40, y: 40 }] };
      fanEserlerimYaz(t); EVS.sekme = "bilgi"; evrenSayfaCiz(); void l; void k;
    });
    const [bE99] = await Promise.all([B.waitForEvent("download"), B.evaluate(function () { document.querySelector("[data-e99-gonder]").click(); })]);
    const e99Yol = await bE99.path(); await bekle(B, 300);
    ok("gönderince katkı sıfırlanır, dosyası gönderilenlerde durur", await B.evaluate(function () { return e99Katki().kurallar.length === 0 && e99Gonderilenler().length === 1; }));
    await panel("bakim", "e99", 500);
    await A.setInputFiles("#yE99Dosya", e99Yol); await bekle(A, 600);
    ok("yönetici e-postayla gelen dosyayı açar", /Kuzey hiç yoktur/.test(await A.textContent("#yE99Alan")));
    await A.evaluate(function () { document.querySelector("[data-y-e99-onay]").click(); }); await bekle(A, 500);
    const e99 = await A.evaluate(function () { return JSON.parse(JSON.stringify(veri.e99)); });
    ok("onaylanan katkı E99'a eklenir", e99.kurallar.length === 1 && e99.harita.yerler.length === 1 && e99.oneriler.length === 1, e99);
    ok("E99 dosyası Fan → Aç ile açılınca da E99'a eklenebilir", await A.evaluate(function () {
      fanPencere({ bicim: "tentifor-eser", tur: "evren", id: "e99kdeneme", ad: "E99 katkısı", harita: { yerler: [] } }, "acilan");
      const var_ = !!document.querySelector('[data-fan-p="e99"]') && !document.querySelector('[data-fan-p="siteye"]');
      document.querySelector("#perde").hidden = true;
      return var_;
    }));
    ok("aynı katkı iki kez eklenmez", await A.evaluate(function (id) { return e99Birlestir({ id: id, tur: "evren" }) === false && veri.e99.kurallar.length === 1; }, e99.oneriler[0]));
    ok("yayınlanınca okurun cihazındaki kopya kalkar", await B.evaluate(function (y) { veri.e99 = y; return e99GonderilenleriTemizle().length === 0; }, e99));

    /* ---------- Evrengezer paneli ---------- */
    await panel("bakim", "evrengezer", 300);
    ok("Evrengezer sekmesi: anahtar, evren paraları, Tömye tavanları", /Evrengezer anahtarı/.test(await A.textContent("#yoneticiAlan")) &&
      await A.locator('[data-y-para="e99"]').count() === 1 && await A.locator('[data-y-tavan="*"]').count() === 1);
    await A.fill('[data-y-para="e99"] [data-y-para-alan="kur"]', "0.2");
    await A.fill('[data-y-tavan="*"]', "280");
    await A.click("[data-y-ekonomi-kaydet]"); await bekle(A, 200);
    ok("evren kuru ve toplam tavan veriye yazılır", await A.evaluate(function () {
      const tamam = veri.evrenParalari.e99.kur === 0.2 && veri.evrenParalari.e99.ad === "E99 jetonu" && veri.cuzdan.genelTavan === 280;
      veri.evrenParalari.e99.kur = 0.05; veri.cuzdan.genelTavan = 300;
      return tamam;
    }));

    /* ---------- elle yayın ---------- */
    await panel("bakim", "yayinla", 400);
    await A.fill("#yYayinKanca", "https://ornek.com/kanca");
    await A.evaluate(function () { document.querySelector("[data-y-yayin-kaydet]").click(); }); await bekle(A, 200);
    ok("yanlış yayın adresi reddedilir", await A.evaluate(function () { return !localStorage.getItem("tentiforapp_yayin_kancasi"); }));
    const kanca = "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/test-kanca-123";
    let yayinIstegi = null;
    await A.route(kanca, function (r) { yayinIstegi = r.request().method(); return r.fulfill({ status: 200, body: "{}" }); });
    await A.fill("#yYayinKanca", kanca);
    await A.evaluate(function () { document.querySelector("[data-y-yayin-kaydet]").click(); }); await bekle(A, 300);
    await A.evaluate(function () { document.querySelector("[data-y-yayinla]").click(); }); await bekle(A, 800);
    ok("Yayınla düğmesi Cloudflare'e istek atar", yayinIstegi === "POST", yayinIstegi);
    ok("yayın bağlantısı hesapla eşitlenmez", await A.evaluate(function () { return ESITLEME_DISI.indexOf("tentiforapp_yayin_kancasi") !== -1; }));

    /* ---------- E26: kanon evren sayfası ---------- */
    await Z.evaluate(function () { location.hash = "#/ev/site/e26"; }); await bekle(Z, 500);
    ok("E26 sayfası kodsuz ziyaretçiye kilitli", await Z.evaluate(function () { return !!document.querySelector("#evrenSayfa [data-evs-kod]") && !/Gearem/.test(document.querySelector("#evrenSayfa").textContent); }));
    await Z.evaluate(function () { evrenSayfaKapat(); });
    await A.evaluate(function () { location.hash = "#/ev/site/e26"; }); await bekle(A, 500);
    await A.evaluate(function () { document.querySelector('[data-evs-sekme="bilgi"]').click(); }); await bekle(A, 200);
    ok("E26 sayfası bilgileri toplar", await A.evaluate(function () {
      const t = document.querySelector("#evrenSayfa").textContent; return /Gearem/.test(t) && /konuşma topu/i.test(t) && /Kanon evren/.test(t);
    }));
    await A.evaluate(function () { document.querySelector('[data-evs-sekme="harita"]').click(); }); await bekle(A, 200);
    await A.evaluate(function () { document.querySelector('[data-evh-mod="yer"]').click(); }); await bekle(A, 100);
    const e26k = await A.locator("#evrenSayfa .evh-svg").boundingBox();
    await A.mouse.click(e26k.x + e26k.width * 0.5, e26k.y + e26k.height * 0.5); await bekle(A, 200);
    ok("yönetici E26 haritasına yer ekler (sitenin haritasına)", await A.evaluate(function () {
      return veri.haritalar.find(function (h) { return h.id === "e26"; }).yerler.length === 1;
    }));
    await A.evaluate(function () { evrenSayfaKapat(); location.hash = "#/sen"; }); await bekle(A, 600);

    /* ---------- Web Push ---------- */
    await panel("bakim", "bildirim", 1200);
    await A.evaluate(function () { document.querySelector("[data-y-bildirim-uret]").click(); }); await bekle(A, 600);
    const anahtar = await A.evaluate(function () { return { acik: veri.bildirim.acikAnahtar, gizli: document.querySelector("#yBildirimGizli").value }; });
    ok("VAPID anahtarı: açık 65, gizli 32 bayt", b64urlBaytUzunluk(anahtar.acik) === 65 && b64urlBaytUzunluk(anahtar.gizli) === 32, anahtar.acik.length);
    ok("açık anahtar P-256 noktası (0x04 ile başlar)", await A.evaluate(function (a) { return b64urlBayt(a)[0] === 4; }, anahtar.acik));
    ok("gizli anahtar veriye yazılmaz", await A.evaluate(function (g) { return JSON.stringify(veri).indexOf(g) === -1; }, anahtar.gizli));
    ok("abone sayısı görünür", /^\d+$/.test((await A.textContent("#yBildirimSayi")).trim()), await A.textContent("#yBildirimSayi"));
    let gonderilenGovde = null;
    await A.route(TEST_URL + "/functions/v1/bildirim-gonder", function (r) {
      gonderilenGovde = r.request().postDataJSON();
      return r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ durum: "tamam", gonderilen: 3, silinen: 1, hata: 0 }) });
    });
    await A.fill("#yBildirimBaslik", "Yeni bölüm: Kitap");
    await A.evaluate(function () { document.querySelector("[data-y-bildirim-gonder]").click(); }); await bekle(A, 1200);
    ok("bildirim gönderilir", /3 cihaza gönderildi/.test(await A.textContent("#yBildirimSonuc")), await A.textContent("#yBildirimSonuc"));
    ok("gönderim gövdesi", gonderilenGovde && gonderilenGovde.baslik === "Yeni bölüm: Kitap" && gonderilenGovde.adres === "/#/roman", gonderilenGovde);

    /* ziyaretçi abone olur ve çıkar (tarayıcının itme servisi taklit) */
    await Z.evaluate(function (acik) {
      veri.bildirim = { acikAnahtar: acik };
      window.__abone = null;
      /* izin durumu tarayıcıya göre değişir (CI'daki Chromium'da "denied"): testte sabitlenir */
      window.__izin = "default";
      if (!("PushManager" in window)) { window.PushManager = function () {}; }
      Object.defineProperty(Notification, "permission", { configurable: true, get: function () { return window.__izin; } });
      Notification.requestPermission = async function () { window.__izin = "granted"; return "granted"; };
      window.bildirimKaydi = async function () {
        return { pushManager: {
          getSubscription: async function () { return window.__abone; },
          subscribe: async function (o) {
            if (!(o.applicationServerKey instanceof Uint8Array) || o.applicationServerKey.length !== 65) { throw new Error("anahtar bozuk"); }
            window.__abone = { endpoint: "https://fcm.googleapis.com/fcm/send/test-cihaz",
              toJSON: function () { return { endpoint: this.endpoint, keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } }; },
              unsubscribe: async function () { window.__abone = null; return true; } };
            return window.__abone;
          } } };
      };
      location.hash = "#/roman";
    }, anahtar.acik);
    await bekle(Z, 700);
    await Z.evaluate(function () { bildirimKutusuCiz(); }); await bekle(Z, 100);
    ok("bildirim düğmesi görünür", await Z.locator('[data-bildirim="ac"]').count() === 1, await Z.textContent("#bildirimAlan"));
    await Z.evaluate(function () { document.querySelector('[data-bildirim="ac"]').click(); }); await bekle(Z, 1500);
    ok("ziyaretçi bildirime abone olur", (await sahte.kokSorgu("select count(*)::int n from public.bildirim_abonelikleri where endpoint like '%test-cihaz'")).rows[0].n === 1,
      await Z.textContent("#bildirimAlan"));
    ok("abone olunca kapatma düğmesi", await Z.locator('[data-bildirim="kapat"]').count() === 1);
    await Z.evaluate(function () { document.querySelector('[data-bildirim="kapat"]').click(); }); await bekle(Z, 1200);
    ok("bildirim kapatılınca abonelik silinir", (await sahte.kokSorgu("select count(*)::int n from public.bildirim_abonelikleri")).rows[0].n === 0);

    await panel("icerik", "listeler", 400);
    await A.click('[data-y-liste="sozluk"]'); await bekle(A, 300);
    const once = await A.evaluate(function () { return veri.sozluk.length; });
    await A.click("[data-y-liste-yeni]"); await bekle(A, 300);
    await A.fill('[data-y-alan="terim"]', "Deneme terimi");
    await A.fill('[data-y-alan="tanim"]', "Testlerin eklediği terim.");
    await A.click("[data-y-liste-kaydet]"); await bekle(A, 300);
    ok("listeye kayıt eklenir", await A.evaluate(function () { return veri.sozluk[veri.sozluk.length - 1].terim; }) === "Deneme terimi");
    ok("liste bir büyür", await A.evaluate(function () { return veri.sozluk.length; }) === once + 1);
    await A.click('[data-y-liste="degisiklik"]'); await bekle(A, 300);
    ok("değişiklik özeti yalnızca gerçek değişikliği yazar (onaylanan E99 katkısı dahil)", await A.inputValue("#yDegMaddeler") ===
      "1 yeni sözlük terimi: Deneme terimi\n1 yeni E99 kuralı: Kuzey hiç yoktur\n1 yeni E99 harita yeri: Dönen Liman",
      await A.inputValue("#yDegMaddeler"));
    const surum = await A.evaluate(function () { return veri.surum; });
    await A.click("[data-y-deg-ekle]"); await bekle(A, 300);
    const yeniSurum = await A.evaluate(function () { return veri.surum; });
    ok("sürüm yükselir", yeniSurum !== surum, [surum, yeniSurum]);

    /* ---------- 7. hesap silme ---------- */
    console.log("hesap silme");
    await B.evaluate(function () { location.hash = "#/sen"; }); await bekle(B, 800);
    await B.click("[data-hesap-sil]"); await bekle(B, 300);
    await B.fill("#hSilOnay", "ayse");
    await B.click("[data-hesap-sil-form] button[type=submit]"); await bekle(B, 1500);
    ok("hesap veritabanından silinir", (await sahte.kokSorgu("select count(*)::int n from auth.users where email = 'b@ornek.test'")).rows[0].n === 0);
    ok("teorisi de silinir", (await sahte.kokSorgu("select count(*)::int n from public.teoriler")).rows[0].n === 0);

    ok("sayfa hatası yok", hatalar.length === 0, hatalar);
  } catch (e) {
    /* başarısızlıkta ekran görüntüleri: CI bunları yükler */
    const klasor = process.env.TEST_EKRAN || "test-sonuclari";
    mkdirSync(klasor, { recursive: true });
    for (const [ad, p] of sayfalar) {
      if (!p.isClosed()) { await p.screenshot({ path: klasor + "/" + ad + ".png", fullPage: false }).catch(function () {}); }
    }
    throw e;
  } finally {
    await tarayici.close();
    await sahte.pool.end();
  }
  return gecen;
}
