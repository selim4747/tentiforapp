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
    /* hesap hatırlatması yalnızca kendi testinde: öbür testlerde alttaki düğmelerin üstüne binmesin */
    if (ad !== "yenilikler") {
      await ctx.addInitScript(function () { try { localStorage.setItem("tentiforapp_hesap_hatirlat", JSON.stringify({ kapat: true })); } catch (e) { /* yok */ } });
    }
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
      return !!h && h.textContent === "Paylaşılan hikâye" && rota() === "#/fanAc" && location.pathname === "/fanAc/";
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
    ok("depodaki veri değişmişse panel Kaydet'le ezmez, sorar", await GU.evaluate(async function () {
      gh = { kullanici: "u", depo: "d", dal: "main", yol: "veri.json", jeton: "t" };
      let d = document.querySelector("#yDurum");
      if (!d) { d = document.createElement("p"); d.id = "yDurum"; document.body.appendChild(d); }
      await githubGonder();
      return /değişmiş/.test(d.textContent) && /99\.0\.0/.test(d.textContent) && !!d.querySelector("[data-y-gh-zorla]") && !!d.querySelector("[data-y-gh-yukle]");
    }) && ghYazildi === 0);
    await GU.evaluate(function () { document.querySelector("#yDurum [data-y-gh-zorla]").click(); }); await bekle(GU, 500);
    ok("“Yine de üzerine yaz” kaydeder ve tabanı günceller", ghYazildi === 1 && await GU.evaluate(function () { return veriTabanOzeti === veriOzeti(veri) && !ghZorla; }));

    /* ---------- her sayfa kendi adresinde ---------- */
    const R = await cihaz("adresler");
    await R.goto(adres + "/evren/e25/"); await bekle(R, 1500);
    ok("/evren/e25/ doğrudan E25'i açar, adres temiz kalır", await R.evaluate(function () {
      return location.pathname === "/evren/e25/" && !location.hash && !!document.querySelector("#evrenSayfa") && EVS && EVS.id === "e25" &&
        document.title.indexOf("—") !== -1;
    }));
    ok("evren sayfasının başlığı evrenin adı", await R.evaluate(function () { return document.title === "E25 — TentiforApp"; }));
    await R.evaluate(function () { window.__ayniBelge = true; location.hash = "#/oyunlar"; }); await bekle(R, 700);
    ok("uygulama içi geçiş gerçek yola yazılır, sayfa yeniden yüklenmez", await R.evaluate(function () {
      return location.pathname === "/oyunlar/" && !location.hash && aktifSayfa === "oyunlar" && !document.querySelector("#evrenSayfa") && window.__ayniBelge === true;
    }));
    await R.goBack(); await bekle(R, 700);
    ok("geri tuşu önceki sayfaya (E25) döner", await R.evaluate(function () {
      return location.pathname === "/evren/e25/" && !!document.querySelector("#evrenSayfa") && window.__ayniBelge === true;
    }));
    await R.goForward(); await bekle(R, 700);
    ok("ileri tuşu da çalışır", await R.evaluate(function () { return location.pathname === "/oyunlar/" && aktifSayfa === "oyunlar"; }));
    await R.evaluate(function () {
      const a = document.createElement("a"); a.href = "#/fan"; a.id = "rotaDeneme"; a.textContent = "fan"; document.body.appendChild(a);
    });
    await R.click("#rotaDeneme"); await bekle(R, 700);
    ok("#/ bağlantıları aynı belgede kalır", await R.evaluate(function () {
      return location.pathname === "/fan/" && aktifSayfa === "fan" && window.__ayniBelge === true;
    }));
    await R.goto(adres + "/dunya/"); await bekle(R, 1500);
    ok("alt sayfa doğrudan açılır (yenileme de aynı yere)", await R.evaluate(function () {
      return location.pathname === "/dunya/" && aktifSayfa === "dunya" && /Dünya/.test(document.title);
    }));
    await R.goto(adres + "/#/okuma"); await bekle(R, 1500);
    ok("eski #/ bağlantıları çalışır ve temiz adrese çevrilir", await R.evaluate(function () {
      return location.pathname === "/okuma/" && !location.hash && aktifSayfa === "okuma";
    }));
    ok("paylaşım adresleri temiz yol", await R.evaluate(function () {
      return rotaAdresi("#/ev/site/e25") === location.origin + "/evren/e25/" && rotaAdresi("#/karakter/feil") === location.origin + "/karakter/feil/" &&
        yoldanRota("/evren/fabc12/") === "#/ev/fan/fabc12" && yoldanRota(rotadanYol("#/ev/benim/fx1")) === "#/ev/benim/fx1" &&
        yoldanRota(rotadanYol("#/fan/hikaye/f1%20a")) === "#/fan/hikaye/f1%20a" && rotaAdresi("#/kartpostal/abc").indexOf("/#/kartpostal/abc") !== -1;
    }));
    await R.goto(adres + "/sen/"); await bekle(R, 1200);
    ok("kişisel sayfa dizinlenmez, diğerleri dizinlenir", await R.evaluate(function () {
      const kisisel = document.querySelector('meta[name="robots"]').content;
      location.hash = "#/dunya";
      return new Promise(function (coz) { setTimeout(function () { coz(kisisel === "noindex, follow" && document.querySelector('meta[name="robots"]').content === "index, follow"); }, 300); });
    }));
    await R.goto(adres + "/basla/"); await bekle(R, 1500);
    ok("/basla/ karşılaması açılır", await R.evaluate(function () {
      const k = document.querySelector("#karsilama");
      return !!k && /Hoş geldin/.test(k.textContent) && /TNTF-BASLA/.test(k.textContent) && document.title.indexOf("Başla") === 0 && location.pathname === "/basla/";
    }));
    await R.click("[data-krs-kod]"); await bekle(R, 900);
    ok("karşılamadan kod tek dokunuşla girilir, Arşiv açılır", await R.evaluate(function () {
      kanonSifirla();
      return !document.querySelector("#karsilama") && location.pathname === "/arsiv/" && bolumErisimi("arsiv") && !bolumErisimi("roman");
    }));
    await R.evaluate(function () { if (typeof perdeKapat === "function") { perdeKapat(); } });
    await R.evaluate(function () { window.__olayTest = true; sessionStorage.clear(); olaySay("giris:deneme"); olaySay("giris:deneme"); olaySay("basla_kod", true); olaySay("Kötü Ad"); });
    await bekle(R, 900);
    ok("ziyaret sayacı: oturumda bir kez, kişisel veri yok", (await sahte.kokSorgu("select sayi from public.olay_sayaclari where ad = 'giris:deneme'")).rows[0].sayi === 1 &&
      (await sahte.kokSorgu("select count(*)::int n from public.olay_sayaclari where ad like '%ötü%'")).rows[0].n === 0);
    ok("başlangıç kodu TNTF-BASLA yalnızca Arşiv ve Evren'i açar", await R.evaluate(function () {
      const gosterilen = veri.baslangicKodu;
      kodPenceresi(); kodDene("TNTF-BASLA");
      kanonSifirla();
      return gosterilen === "TNTF-BASLA" && bolumErisimi("arsiv") && bolumErisimi("evren") && !bolumErisimi("roman") && !bolumErisimi("mektuplar") &&
        !kanonEvrenErisimi("e26") && baslangicProfili().ad === "Başlangıç";
    }));
    const siteHaritasi = readFileSync(dizin + "/sitemap.xml", "utf8");
    ok("site haritası bütün sayfaları ayrı listeler (kişisel sayfa hariç)", ["/arsiv/", "/dunya/", "/oyunlar/", "/basla/", "/evren/e25/", "/evren/e26/", "/evren/e99/"].every(function (y) { return siteHaritasi.indexOf(y + "</loc>") !== -1; }) &&
      siteHaritasi.indexOf("/sen/</loc>") === -1);
    ok("her evrene ve sayfaya ayrı paylaşım görseli", /og:image" content="[^"]*\/ikon\/og\/e25\.png"/.test(readFileSync(dizin + "/evren/e25/index.html", "utf8")) &&
      /og:image" content="[^"]*\/ikon\/og\/dunya\.png"/.test(readFileSync(dizin + "/dunya/index.html", "utf8")));

    const manifest = JSON.parse(readFileSync(dizin + "/manifest.webmanifest", "utf8"));
    ok("_redirects üretilir (Cloudflare Pages vb.)", /\/paylasim-al/.test(readFileSync(dizin + "/_redirects", "utf8")) && !/\/u\/\*/.test(readFileSync(dizin + "/_redirects", "utf8")));
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
      return /^#\/ev\/benim\//.test(rota()) && !!document.querySelector('#evrenSayfa [data-fan-hedef] [data-fan-alan="ad"]');
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
    await Z.fill("#evlYeniKod", "tuzkodu-2024");
    await Z.fill("#evlIpucu", "Denizin dibine bak");
    await Z.fill("#evlIpucuFiyat", "5");
    await Z.click("[data-evl-ekle]"); await bekle(Z, 400);
    ok("kilitli lore şifreli kaydolur, kurucu okur", await Z.evaluate(function (id) {
      const e = evrenBenimBul(id); const l = e.lorlar[0];
      return e.lorlar.length === 1 && !/unutmak/.test(JSON.stringify(e)) && /unutmaktır/.test(document.querySelector("#evrenSayfa .evl-metin").textContent) &&
        /TUZKODU-2024/.test(document.querySelector("#evrenSayfa .evl-kurucu").textContent) && !l.seg;
    }, evId));
    ok("kodlar 10 karakter harf ve rakam; kısa lore kodu reddedilir", await Z.evaluate(async function (id) {
      const k = evKodUret(), p = kod10();
      const kisa = await evrenLoreEkle(evrenBenimBul(id), { baslik: "Kısa", metin: "x", kod: "ABC-123" });
      const yon = evrenYoneticiKoduKur(evrenBenimBul(id), "KISA-1");
      return /^[A-Z0-9]{10}$/.test(k) && /^[A-Z0-9]{10}$/.test(p) && /en az 10/.test(kisa) && /en az 10/.test(yon.hata || "");
    }, evId));
    const loreSonuc = await Z.evaluate(async function (id) {
      const e = evrenBenimBul(id);
      localStorage.removeItem(EVL_ANAHTAR);
      const kilitli = lorIcCoz(e.lorlar[0], evlAcilan(e.id)[e.lorlar[0].id]) === null;
      const yanlis = await evrenKodDene(e, "BASKA-KOD");
      /* başka bir evren aynı kodla kurulur: o evrenin kodu bu evrende, bu evrenin kodu orada çalışmaz */
      const b = fanYeni("evren"); evrenBenimDegistir(b.id, function (x) { x.ad = "Öbür Evren"; });
      await evrenLoreEkle(evrenBenimBul(b.id), { baslik: "Öbür sır", metin: "Burada başka şey var.", kod: "OBURKOD-12345" });
      const obur = await evrenKodDene(e, "OBURKOD-12345");
      const dogru = await evrenKodDene(e, "Tuzkodu-2024");
      const karsi = await evrenKodDene(evrenBenimBul(b.id), "TUZKODU-2024");
      const y = evrenYoneticiKoduKur(evrenBenimBul(id), "EVY-SAHIP12");
      localStorage.removeItem(EVL_ANAHTAR);
      const yon = await evrenKodDene(evrenBenimBul(id), "evy-sahip12");
      const yonKarsi = await evrenKodDene(evrenBenimBul(b.id), "EVY-SAHIP12");
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
      await evrenLoreEkle(evrenBenimBul(id), { baslik: "İkinci sır", metin: "Evrengezer de okur.", kod: "IKINCI-12345" });
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
    ok("evren sayfası kapanır", await Z.evaluate(function () { return !document.querySelector("#evrenSayfa") && rota() === "#/fan"; }));
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
    /* ---------- E25 kişileri: herkes ekler, kişilik yaratanın imzasında, başka evrene götürülür ---------- */
    await Z.evaluate(function () { location.hash = "#/ev/site/e25"; }); await bekle(Z, 600);
    ok("E25 kilitliyken de herkes kişi ekleyebilir", await Z.evaluate(function () {
      return !!document.querySelector("#evrenSayfa [data-evs-kod]") && !!document.querySelector("#evrenSayfa .e25-kisiler #kisiAd");
    }));
    await Z.fill("#kisiAd", "Taşsız Mira");
    await Z.fill("#kisiUnvan", "Kaçak gezgin");
    await Z.fill("#kisiOzet", "Taşını kaybetmiş ama içgüdüsünü değil.");
    await Z.fill("#kisiHaller", "Sakin: Tehlikede bile sesi titremez.\nÖfkeli: Evrenler çatırdar.");
    await Z.fill("#kisiYazar", "Deneyen");
    await Z.click('[data-kisi-kaydet=""]'); await bekle(Z, 700);
    const kisiId = await Z.evaluate(function () { const k = fanEserlerim().find(function (x) { return x.tur === "kisi"; }); return k && k.id; });
    ok("kişi eklenir ve yaratanın anahtarıyla imzalanır", !!kisiId && await Z.evaluate(function (id) {
      const k = fanEserlerim().find(function (x) { return x.id === id; });
      return k.kisilik.length === 2 && k.kisilik[1].ad === "Öfkeli" && !!k.imza && benimYaratigimMi(k) &&
        /yaratıcısının imzası/.test(document.querySelector("#evrenSayfa .e25-kisiler .kisi-imza").textContent);
    }, kisiId));
    ok("kişilik başkasınca değiştirilirse imza tutmaz; yalnızca yaratıcı değiştirir", await Z.evaluate(async function (id) {
      const k = fanEserlerim().find(function (x) { return x.id === id; });
      const oynanmis = JSON.parse(JSON.stringify(k)); oynanmis.kisilik[0].aciklama = "Aslında hep bağırır.";
      const l = fanEserlerim(); const z = l.find(function (x) { return x.id === id; }); const asil = z.imza.a;
      z.imza.a = "BAAAAA"; fanEserlerimYaz(l);
      const baskasi = await kisiKaydet(id, { ad: "Mira", haller: "Neşeli: hep güler" });
      z.imza.a = asil; fanEserlerimYaz(l);
      return (await kisiDogrula(k)) === "gecerli" && (await kisiDogrula(oynanmis)) === "degismis" && /yaratıcısı/.test(baskasi);
    }, kisiId));
    ok("kişi başka evrene konuk olarak götürülür, dosyada imzasıyla taşınır", await Z.evaluate(async function (a) {
      const k = fanEserlerim().find(function (x) { return x.id === a[0]; });
      const s = kisiGotur(k, "evren:" + a[1]);
      const ev = evrenBenimBul(a[1]);
      const dosya = fanMetindenEser(fanDosyaHtml(fanTemizle(ev)));
      return s && s.id === a[1] && ev.konuklar[0].ad === "Taşsız Mira" && dosya.konuklar[0].kisilik.length === 2 &&
        (await kisiDogrula(dosya.konuklar[0])) === "gecerli" && /Konuk kişiler/.test(fanDosyaHtml(fanTemizle(ev)));
    }, [kisiId, evId]));
    await Z.click('[data-kisi-gotur="benim:' + kisiId + '"]'); await bekle(Z, 200);
    await Z.selectOption("#kisiHedef", "yeni-hikaye");
    await Z.click("[data-kisi-gotur-onay]"); await bekle(Z, 700);
    ok("kişiyle yeni hikâye yazılır, kişiliği hikâyede salt okunur", await Z.evaluate(function () {
      const h = fanEserlerim().filter(function (x) { return x.tur === "hikaye"; }).pop();
      return rota() === "#/fan" && h.konuklar[0].ad === "Taşsız Mira" && /Taşsız Mira/.test(h.karakterler) &&
        !!document.querySelector("#fanHikayeAlan .konuk-duzen") && !document.querySelector("#fanHikayeAlan .konuk-duzen textarea");
    }));
    ok("kişi kartı Instagram hikâyesi boyutunda", await Z.evaluate(async function (id) {
      const t = await kisiKartUret(fanEserlerim().find(function (x) { return x.id === id; }));
      return !!t && t.width === 1080 && t.height === 1920;
    }, kisiId));
    ok("EG mağazası: alınır, iki kez alınmaz, yetmezse alınmaz", await Z.evaluate(function () {
      const c = egYukle(); c.eg = 30;
      const a = egMagazaAl("desen_neon"), b = egMagazaAl("desen_neon"), y = egMagazaAl("desen_yildiz");
      return a === "" && /Zaten/.test(b) && /Yetmez/.test(y) && egYukle().eg === 15 && egSahipMi("desen_neon") && !egSahipMi("desen_yildiz") &&
        /evh-yildizlar/.test(evrenHaritaSvg({ yerler: [], stil: { desen: "yildiz" } }, {}));
    }));
    ok("günün evren turu: 3 farklı evren = EG ödülü, bir kez", await Z.evaluate(function () {
      const c = egYukle(); c.ziyaret = { gun: bugununAdi(), l: ["site:x", "fan:y"] };
      const once = c.eg, eskiEVS = EVS;
      EVS = { kaynak: "e99", id: "e99", sekme: "harita", secili: null, mod: "sec", cizim: [] };
      evrenZiyaretOdulu();
      const sonra = egYukle().eg;
      EVS = eskiEVS;
      return sonra === once + 3 && egYukle().ziyaret.tur === true;
    }));
    ok("yönetici okur kişisini sitede yayımlar", await Z.evaluate(function (id) {
      const eski = window.panelAcik; window.panelAcik = function () { return true; };
      const k = fanTemizle(fanEserlerim().find(function (x) { return x.id === id; }));
      const eskiListe = (veri.fanEserleri.kisiler || []).slice(), onceSite = eskiListe.length, onceE25 = e25Kisileri().length;
      const tamam = fanSiteyeEkle(k) && fanSiteListesi("kisi").length === onceSite + 1 && e25Kisileri().length === onceE25;
      veri.fanEserleri.kisiler = eskiListe; window.panelAcik = eski;
      return tamam;
    }, kisiId));
    ok("sayfa paylaş düğmesi", await Z.locator("#sayfaBasi [data-sayfa-paylas]").count() === 1);
    await Z.evaluate(function () { location.hash = "#/mektuplar"; }); await bekle(Z, 800);
    ok("uzun metinlerde Dinle düğmesi", await Z.locator(".sesli-dugme").count() > 0);

    /* ---------- günün kelimesi (kolay), hesap hatırlatması, evren oyunları, roman, çizimler ---------- */
    console.log("kelime ve evren oyunları");
    const N = await cihaz("yenilikler");
    await N.goto(adres + "/"); await bekle(N, 1500);
    await N.evaluate(function () { window.__ilkFanEvrenler = JSON.parse(JSON.stringify(veri.fanEserleri.evrenler)); });
    ok("ana sayfada E25 vitrini: örnek kişi", /Orlan Ivo/.test(await N.textContent("#e25VitrinAlan")));
    ok("kişi yoksa vitrin çağrısı", await N.evaluate(function () {
      const eski = veri.fanEserleri.kisiler; veri.fanEserleri.kisiler = []; e25VitrinCiz();
      const t = document.querySelector("#e25VitrinAlan").textContent; veri.fanEserleri.kisiler = eski; return /Evrengezerini ekle/.test(t);
    }));
    ok("örnek E25 kişisi imzalı ve geçerli", await N.evaluate(async function () { return await kisiDogrula(veri.fanEserleri.kisiler[0]) === "gecerli"; }));
    await N.evaluate(function () {
      veri.fanEserleri.kisiler = [{ bicim: FAN_BICIM, surum: 1, tur: "kisi", id: "vitrin1", evren: "e25", ad: "Orlan Gezgin", unvan: "haritacı", ozet: "Kıyıdan kıyıya.", yazar: "okur", kisilik: [] }];
      e25VitrinCiz();
    });
    ok("haftanın Evrengezeri ana sayfada", /Orlan Gezgin/.test(await N.textContent("#e25VitrinAlan")) && await N.locator('#e25VitrinAlan [data-kisi-kart="site:vitrin1"]').count() === 1);
    await N.evaluate(function () { location.hash = "#/yarislar"; }); await bekle(N, 1500);
    ok("hesapsız okurda günün kelimesi kolay modda, girişsiz oynanır", await N.locator('#gkAlan [data-gk-mod="kolay"][aria-selected="true"]').count() === 1 &&
      await N.locator("#gkIc [data-ko-form]").count() === 1);
    const kolay = await N.evaluate(function () { const o = KO_OYUNLAR["tomye-kolay"]; return { c: koCevap(o, koKayit(o.anahtar)), l: o.kelimeler }; });
    ok("kolay mod yalnızca karakter ve yer adları", kolay.l.length > 10 && kolay.l.indexOf("eçka") === -1 && kolay.l.indexOf("niraz") === -1 && kolay.l.indexOf(kolay.c) !== -1, kolay.l);
    ok("tahmin karşılaştırması sunucudakiyle aynı", await N.evaluate(function () {
      return koKarsilastir("aaba", "abca").join("") === "dyvd" && koKarsilastir("eçka", "eçka").join("") === "dddd" && koKarsilastir("kaka", "akka").join("") === "vvdd";
    }));
    const kolayEckaOnce = await N.evaluate(function () { return cuzdan.ecka; });
    await N.fill("#gkIc [data-ko-giris]", "x".repeat(Array.from(kolay.c).length)); await N.press("#gkIc [data-ko-giris]", "Enter"); await bekle(N, 200);
    await N.fill("#gkIc [data-ko-giris]", kolay.c); await N.press("#gkIc [data-ko-giris]", "Enter"); await bekle(N, 400);
    ok("kolay kelime bulunur, eçka verilir", /Buldun! 2\/6/.test(await N.textContent("#gkIc .gk-son")) && await N.evaluate(function () { return cuzdan.ecka; }) === kolayEckaOnce + 5);
    ok("bitince kelimenin kartı (kodsuz okura kilitli)", /başlangıç koduyla/.test(await N.textContent("#gkIc .ko-bilgi")) || /Haritada|Kaydı aç/.test(await N.textContent("#gkIc .ko-bilgi")));
    ok("seri ve dağılım", /1\s*seri/.test(await N.textContent("#gkIc .ko-sayilar")) && await N.locator("#gkIc .ko-dag-satir").count() === 6);
    ok("yeniden çizilince durum korunur", await N.evaluate(function () { gunKelimesiYukle(); return /Buldun/.test(document.querySelector("#gkIc").textContent); }));
    ok("kelime hikâye kartı 1080×1920", await N.evaluate(async function () {
      const t = await kelimeHikayeKartUret({ baslik: "Tentiforverse", gun: "2026-09-26", satirlar: [["y", "v", "d", "d"], ["d", "d", "d", "d"]], cozuldu: true, seri: 3 });
      return !!t && t.width === 1080 && t.height === 1920;
    }));
    await bekle(N, 2800);
    ok("hesapsız okura ilerlemesi için hesap hatırlatması", await N.locator("#hesapHatirlat [data-hh-ac]").count() === 1);
    await N.click("#hesapHatirlat [data-hh-sonra]"); await bekle(N, 100);
    ok("hatırlatma üç günde bir", await N.evaluate(function () { hesapHatirlat("kart"); return new Promise(function (c) { setTimeout(function () { c(!document.querySelector("#hesapHatirlat")); }, 2800); }); }));
    ok("arşiv kartı hikâye kartı", await N.evaluate(async function () {
      kartKazan("rolde", "test");
      const t = await arsivKartHikayeUret("rolde");
      location.hash = "#/koleksiyon";
      koleksiyonCiz();
      return !!t && t.height === 1920 && !!document.querySelector("[data-kol-hikaye]");
    }));

    const nEv = await N.evaluate(function () {
      const id = evrenYeniKur();
      evrenBenimDegistir(id, function (e) {
        e.ad = "Kıyı Evreni";
        e.kisiler = [{ ad: "Arvel", rol: "kaptan", aciklama: "" }, { ad: "Bosra", rol: "aşçı", aciklama: "" }, { ad: "Cimen", rol: "haritacı", aciklama: "" }, { ad: "Dolun", rol: "gözcü", aciklama: "" }];
        e.sozluk = [{ terim: "Kavra", tanim: "Kıyı rüzgârı" }];
        e.harita = { yerler: [{ id: "a", ad: "Norak", x: 10, y: 10 }, { id: "b", ad: "Pelin", x: 30, y: 30 }, { id: "c", ad: "Rusta", x: 60, y: 20 }, { id: "d", ad: "Tavir", x: 80, y: 50 }] };
      });
      return id;
    });
    await N.evaluate(function (id) { location.hash = "#/ev/benim/" + id; }, nEv); await bekle(N, 900);
    ok("kendi evreninde Oyunlar, Roman, Çizimler sekmeleri", await N.evaluate(function () {
      const t = Array.from(document.querySelectorAll("#evrenSayfa [data-evs-sekme]")).map(function (x) { return x.dataset.evsSekme; });
      return ["oyunlar", "roman", "cizim"].every(function (s) { return t.indexOf(s) !== -1; });
    }));
    await N.click('#evrenSayfa [data-evs-sekme="oyunlar"]'); await bekle(N, 200);
    ok("evrenin kendi kelimeleri, kendi evreninde ödülsüz", /ödül vermez/.test(await N.textContent("#evrenSayfa .evs-govde")) &&
      await N.evaluate(function () { return KO_OYUNLAR[evoAnahtar()].kelimeler.join(","); }) === "arvel,bosra,cimen,dolun,kavra,norak,pelin,rusta,tavir");
    await N.fill("#evoOdul", "20"); await N.dispatchEvent("#evoOdul", "change");
    await N.fill("#evoSorular", "Kor kaç saat yanar? | Yirmi | On | Kırk"); await N.dispatchEvent("#evoSorular", "change");
    await N.uncheck('[data-evo-ayar="acik"][data-evo-oyun="harita"]'); await bekle(N, 200);
    ok("kurucu oyunu evrenine göre ayarlar", await N.evaluate(function (id) {
      const o = evrenBenimBul(id).oyunlar;
      return o.odul === 20 && o.sorular.length === 1 && o.sorular[0].yanlis.length === 2 && o.harita.acik === false;
    }, nEv) && await N.locator('#evrenSayfa [data-evo-basla="harita"]').count() === 0);
    await N.check('[data-evo-ayar="acik"][data-evo-oyun="harita"]'); await bekle(N, 200);
    await N.click('#evrenSayfa [data-evo-basla="sinav"]'); await bekle(N, 100);
    ok("sınav soruları evrenden ve kurucudan", await N.evaluate(function () { return EVO.sorular.length === 5 && EVO.sorular.every(function (q) { return q.secenekler.indexOf(q.dogru) !== -1; }); }));
    for (let i = 0; i < 5; i++) {
      await N.evaluate(function () { const q = EVO.sorular[EVO.i]; document.querySelector('#evrenSayfa [data-evo-sec="' + q.secenekler.indexOf(q.dogru) + '"]').click(); });
      await N.click("#evrenSayfa [data-evo-sonraki]");
    }
    ok("sınav biter, kendi evreninde ödül yok", /5 \/ 5/.test(await N.textContent("#evrenSayfa .evo-oyun")) && /ödül vermez/.test(await N.textContent("#evrenSayfa .evo-oyun")));
    await N.click("#evrenSayfa [data-evo-kapat]");
    await N.click('#evrenSayfa [data-evo-basla="harita"]'); await bekle(N, 100);
    ok("harita bulmacası etiketsiz", await N.locator("#evrenSayfa .evo-harita text").count() === 0 && await N.locator("#evrenSayfa .evo-harita [data-evo-yer]").count() === 4);
    await N.evaluate(function () { document.querySelector('#evrenSayfa [data-evo-yer="' + EVO.hedefler[0] + '"]').dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    ok("doğru yere dokununca sayılır", await N.evaluate(function () { return EVO.dogru === 1 && EVO.cevap === "d"; }));
    await N.click("#evrenSayfa [data-evo-kapat]");

    await N.click('#evrenSayfa [data-evs-sekme="roman"]');
    await N.click("#evrenSayfa [data-evr-ekle]");
    await N.fill("#evrBolumBaslik", "Kıyıda"); await N.fill("#evrBolumMetin", "Norak kıyısında bir gemi vardı.");
    await N.click('#evrenSayfa [data-evs-sekme="harita"]'); await bekle(N, 100);
    ok("roman bölümü hemen kaydedilir (sekme değişse de)", await N.evaluate(function (id) { const r = evrenBenimBul(id).roman; return r.bolumler.length === 1 && r.bolumler[0].baslik === "Kıyıda" && /gemi/.test(r.bolumler[0].metin); }, nEv));
    await N.click('#evrenSayfa [data-evs-sekme="roman"]'); await N.click('#evrenSayfa [data-evr-onizle="1"]');
    ok("okur görünümü", /1\. Kıyıda/.test(await N.textContent("#evrenSayfa .evr-oku")));

    await N.click('#evrenSayfa [data-evs-sekme="cizim"]');
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");
    await N.setInputFiles("#evrenSayfa [data-evc-yukle]", { name: "kiyi-cizimi.png", mimeType: "image/png", buffer: png }); await bekle(N, 1200);
    ok("çizim yüklenir, küçültülür, görünür", await N.evaluate(function (id) {
      const c = evrenBenimBul(id).cizimler;
      const img = document.querySelector("#evrenSayfa img[data-evc-resim]");
      return c.length === 1 && c[0].baslik === "kiyi-cizimi" && !c[0].v && img && /^data:image\/jpeg/.test(img.getAttribute("src"));
    }, nEv));
    ok("görsel yerel listeye değil ayrı depoya yazılır", await N.evaluate(function () { return localStorage.getItem("tentiforapp_fan_eserlerim").indexOf("data:image") === -1; }));
    const nDosya = await N.evaluate(async function (id) { const e = evrenBenimBul(id); await cizimleriIsit(e); return fanDosyaHtml(e); }, nEv);
    ok("dosyada roman ve çizim gömülü", /data:image\/jpeg/.test(nDosya) && /Norak kıyısında/.test(nDosya));
    ok("dosyadan geri açılır", await N.evaluate(function (h) {
      const e = fanMetindenEser(h);
      return e.cizimler.length === 1 && !!e.cizimler[0].v && e.roman.bolumler.length === 1 && e.oyunlar.odul === 20;
    }, nDosya));
    ok("zararlı görsel adresi temizlenir", await N.evaluate(function () {
      const e = fanTemizle({ bicim: FAN_BICIM, tur: "evren", ad: "x", cizimler: [{ id: "a", v: "javascript:alert(1)", yol: "../gizli.jpg" }, { id: "b", yol: "ikon/fan/x-b.jpg" }] });
      return !e.cizimler[0].v && !e.cizimler[0].yol && e.cizimler[1].yol === "ikon/fan/x-b.jpg";
    }));

    /* başkasının (sitedeki fanmade) evreninde oyun o evrenin parasını verir, günde bir kez */
    const fanOdul = await N.evaluate(function (id) {
      const e = JSON.parse(JSON.stringify(evrenBenimBul(id)));
      e.id = "fsitedeki1"; e.ad = "Sitedeki Kıyı"; e.para = { ad: "kavuk", simge: "", kur: 0.5 };
      veri.fanEserleri.evrenler = [e];
      return true;
    }, nEv);
    await N.evaluate(function () { location.hash = "#/ev/fan/fsitedeki1"; }); await bekle(N, 900);
    await N.click('#evrenSayfa [data-evs-sekme="oyunlar"]');
    const bakiye0 = await N.evaluate(function () { return egBakiye("ev:fsitedeki1"); });
    const sinavOyna = async function () {
      await N.click('#evrenSayfa [data-evo-basla="sinav"]');
      for (let i = 0; i < 5; i++) {
        await N.evaluate(function () { const q = EVO.sorular[EVO.i]; document.querySelector('#evrenSayfa [data-evo-sec="' + q.secenekler.indexOf(q.dogru) + '"]').click(); });
        await N.click("#evrenSayfa [data-evo-sonraki]");
      }
    };
    await sinavOyna();
    ok("fanmade evrende kazanınca o evrenin parası (kurucunun ödülü, tavanla)", fanOdul && await N.evaluate(function () { return egBakiye("ev:fsitedeki1"); }) === bakiye0 + 6 &&
      /kavuk/.test(await N.textContent("#evrenSayfa .evo-oyun")));
    await N.click('#evrenSayfa [data-evo-basla="sinav"]');
    for (let i = 0; i < 5; i++) {
      await N.evaluate(function () { const q = EVO.sorular[EVO.i]; document.querySelector('#evrenSayfa [data-evo-sec="' + q.secenekler.indexOf(q.dogru) + '"]').click(); });
      await N.click("#evrenSayfa [data-evo-sonraki]");
    }
    ok("aynı oyun günde bir kez ödül verir", await N.evaluate(function () { return egBakiye("ev:fsitedeki1"); }) === bakiye0 + 6 && /bugünkü ödülünü aldın/.test(await N.textContent("#evrenSayfa .evo-oyun")));
    await N.click("#evrenSayfa [data-evo-kapat]");
    ok("okur romanı ve çizimleri okur", await N.evaluate(function () {
      const t = Array.from(document.querySelectorAll("#evrenSayfa [data-evs-sekme]")).map(function (x) { return x.dataset.evsSekme; });
      return t.indexOf("roman") !== -1 && t.indexOf("cizim") !== -1 && t.indexOf("defter") !== -1 && t.indexOf("stil") === -1;
    }));

    /* ---------- evren kurma: boş taslak birikmez, ilk adımlar, hazır harita ---------- */
    const bosEv = await N.evaluate(function () { evrenSayfaKapat(); return evrenYeniKur(); });
    ok("yeni evren: dokunulmamış taslak tekrar kullanılır", await N.evaluate(function (id) { return evrenYeniKur() === id; }, bosEv));
    await N.evaluate(function (id) { location.hash = "#/ev/benim/" + id; }, bosEv); await bekle(N, 700);
    ok("adsız evren Bilgiler sekmesiyle ve ilk adımlarla açılır", await N.evaluate(function () {
      return EVS.sekme === "bilgi" && /0 \/ 6/.test(document.querySelector("#evrenSayfa .evk-sayi").textContent);
    }));
    await N.fill('#evrenSayfa [data-fan-alan="ad"]', "Rehberli Evren"); await bekle(N, 1100);
    ok("ad yazılınca ilk adımlar ve başlık güncellenir", /1 \/ 6/.test(await N.textContent("#evrenSayfa .evk-sayi")) &&
      (await N.textContent("#evrenSayfa .evs-baslik h2")) === "Rehberli Evren");
    await N.click('#evrenSayfa [data-evk-git="kisi"]'); await bekle(N, 300);
    ok("adım ilgili alana götürür", await N.evaluate(function () { return document.activeElement && /^kisiler\.\d+\.ad$/.test(document.activeElement.dataset.fanAlan || ""); }));
    await N.click('#evrenSayfa [data-evs-sekme="harita"]'); await bekle(N, 200);
    await N.click('#evrenSayfa [data-evk-sablon="iki"]'); await bekle(N, 300);
    ok("hazır harita konur", await N.evaluate(function () { return evrenBenimBul(EVS.id).harita.yerler.length === 5; }) &&
      await N.locator('#evrenSayfa [data-evk-sablon]').count() === 0);
    /* bir evrende birden fazla gezegen */
    await N.click("#evrenSayfa [data-evg-ekle]"); await bekle(N, 300);
    await N.fill("#evrenSayfa [data-evg-ad]", "Kızıl Ay"); await N.dispatchEvent("#evrenSayfa [data-evg-ad]", "change"); await bekle(N, 200);
    await N.click('#evrenSayfa [data-evk-sablon="takimada"]'); await bekle(N, 300);
    ok("ikinci gezegen kendi haritasıyla", await N.evaluate(function () {
      const e = evrenBenimBul(EVS.id);
      return e.harita.yerler.length === 5 && e.gezegenler.length === 1 && e.gezegenler[0].ad === "Kızıl Ay" && e.gezegenler[0].harita.yerler.length === 5 &&
        e.gezegenler[0].harita.yerler[0].ad === "Büyük Ada";
    }));
    await N.click('#evrenSayfa [data-evg-sec=""]'); await bekle(N, 200);
    ok("gezegenler arasında geçiş", /Batı Kıtası/.test(await N.textContent("#evrenSayfa .evh-kutu")) && !/Büyük Ada/.test(await N.textContent("#evrenSayfa .evh-kutu")));
    ok("gezegenler dosyaya girer ve geri açılır", await N.evaluate(function () {
      const x = fanMetindenEser(fanDosyaHtml(evrenBenimBul(EVS.id)));
      return x.gezegenler.length === 1 && x.gezegenler[0].harita.yerler.length === 5;
    }));
    ok("kelime oyunu iki kelimelik adları birleştirmez", await N.evaluate(function () { return evoKelimeler(evrenBenimBul(EVS.id)).indexOf("büyükada") === -1; }));
    await N.click("#evrenSayfa [data-evk-gizle]"); await bekle(N, 200);
    ok("ilk adımlar gizlenebilir", await N.locator("#evrenSayfa .evk-kart").count() === 0);
    ok("Ax-24, Tentiforverse'ün (Tömye'nin evreni) gezegeni", await N.evaluate(function () {
      const l = evrenSeciciListesi().site;
      const t = l.find(function (x) { return /Tentiforverse/.test(x.ad); });
      return !l.some(function (x) { return x.ad === "Ax-24"; }) && !!t && t.alt.map(function (x) { return x.ad; }).join() === "Tömye,Ax-24" && kanonUstEvren("ax24") === "tomye";
    }));
    ok("sekme şeridi tek satır", await N.evaluate(function () { const s = document.querySelector("#evrenSayfa .evs-sekmeler"); return getComputedStyle(s).flexWrap === "nowrap"; }));
    ok("dolu evrenden sonra yeni evren yeni taslak", await N.evaluate(function () { return evrenYeniKur() !== EVS.id; }));

    /* ---------- yayın akışı: okurun dosyası → yönetici açar, siteye ekler, görsel GitHub'a, Kaydet ---------- */
    const ghPut = [];
    await N.route("https://api.github.com/**", function (r) {
      const u = r.request().url();
      if (r.request().method() === "GET") {
        return /contents\/veri\.json/.test(u)
          ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sha: "abc", encoding: "base64", content: Buffer.from(readFileSync(dizin + "/veri.json")).toString("base64") }) })
          : r.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      }
      ghPut.push({ u: u, govde: JSON.parse(r.request().postData() || "{}") });
      return r.fulfill({ status: 201, contentType: "application/json", body: "{}" });
    });
    await N.evaluate(async function (id) {
      const e = evrenBenimBul(id);
      await cizimleriIsit(e);
      const k = JSON.parse(JSON.stringify(e)); k.id = "fyayintest1"; k.ad = "Yayın Evreni";
      window.__yayinDosyasi = fanDosyaHtml(cizimGomulu(Object.assign(k, { cizimler: e.cizimler })));
      window.__panelAcik = window.panelAcik; window.panelAcik = function () { return true; };
      window.__yoneticiAcik = window.yoneticiAcik; window.yoneticiAcik = function () { return true; };
      gh = { kullanici: "u", depo: "d", dal: "main", yol: "veri.json", jeton: "t" };
      evrenSayfaKapat();
      const x = fanMetindenEser(window.__yayinDosyasi);
      fanAcilanEkle(x);
      fanPencere(x, "acilan");
    }, nEv); await bekle(N, 300);
    ok("yönetici önizlemesinde roman ve çizim görünür", await N.evaluate(function () {
      const t = document.querySelector(".fan-pencere").innerHTML;
      return /Norak kıyısında/.test(t) && /<img[^>]+data:image\/jpeg/.test(t);
    }));
    await N.click('[data-fan-p="siteye"]'); await bekle(N, 1500);
    ok("siteye eklenince çizim GitHub'a ayrı dosya olarak yüklenir", await N.evaluate(function () {
      const e = EVD_BELLEK["fyayintest1"];
      return !!e && /^ikon\/fan\/fyayintest1-/.test(e.cizimler[0].yol) && !e.cizimler[0].v && e.roman.bolumler.length === 1;
    }) && ghPut.some(function (p) { return /contents\/ikon\/fan\/fyayintest1-/.test(p.u); }));
    const evPut = ghPut.find(function (p) { return /contents\/evrenler\/fyayintest1\.json/.test(p.u); });
    ok("evrenin tamamı GitHub'a ayrı dosya, veri.json'da yalnızca özeti", !!evPut && await N.evaluate(function (icerik) {
      const tam = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(icerik), function (c) { return c.charCodeAt(0); })));
      const o = veri.fanEserleri.evrenler.find(function (x) { return x.id === "fyayintest1"; });
      return tam.roman.bolumler.length === 1 && /^ikon\/fan\//.test(tam.cizimler[0].yol) && o.dosya === "evrenler/fyayintest1.json" && !o.roman && !o.kisiler &&
        o.sayilar.bolum === 1 && o.sayilar.cizim === 1 && /^ikon\/fan\//.test(o.kapak);
    }, evPut.govde.content));
    await N.evaluate(async function () {
      let d = document.querySelector("#yDurum"); if (!d) { d = document.createElement("p"); d.id = "yDurum"; document.body.appendChild(d); }
      document.querySelector("#perde").hidden = true;
      await githubGonder();
    }); await bekle(N, 500);
    const vPut = ghPut.find(function (p) { return /contents\/veri\.json/.test(p.u); });
    const vYeni = vPut ? Buffer.from(vPut.govde.content, "base64").toString("utf8") : "";
    ok("Kaydet: veri.json evreni taşır, gömülü görsel taşımaz", /Yayın Evreni/.test(vYeni) && vYeni.indexOf("data:image") === -1);
    await N.evaluate(function () {
      window.panelAcik = window.__panelAcik; window.yoneticiAcik = window.__yoneticiAcik;
      veri.fanEserleri.evrenler = veri.fanEserleri.evrenler.filter(function (x) { return x.id !== "fyayintest1"; });
    });

    /* ---------- sitedeki evren dosyası, geçit, çevrimdışı, takip ---------- */
    await N.evaluate(function () { veri.fanEserleri.evrenler = JSON.parse(JSON.stringify(window.__ilkFanEvrenler)); location.hash = "#/ev/fan/fornek-sis"; }); await bekle(N, 1500);
    ok("sitedeki evren özetten açılır, dosyası inince tamamı görünür", await N.evaluate(function () {
      return EVS.kaynak === "fan" && !!EVD_BELLEK["fornek-sis"] && !!document.querySelector('#evrenSayfa [data-evs-sekme="roman"]') &&
        !!document.querySelector("#evrenSayfa .evg-serit") && document.querySelectorAll("#evrenSayfa .evh-cizgi").length === 2 && !!document.querySelector("#evrenSayfa .evh-olcek");
    }));
    await N.evaluate(function () { document.querySelector('#evrenSayfa .evh-svg [data-evh-yer="sisgecidi"]').dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await bekle(N, 200);
    ok("okur haritada yere dokununca anlatımı ve geçidi görür", /Sisin en koyu/.test(await N.textContent("#evrenSayfa .evh-bilgi")) && await N.locator("#evrenSayfa .evh-gecit-git").count() === 1);
    await N.click("#evrenSayfa .evh-gecit-git"); await bekle(N, 1500);
    ok("geçitten öbür evrene geçilir", await N.evaluate(function () { return EVS.kaynak === "fan" && EVS.id === "fornek-kul" && /Kül Ormanı/.test(document.querySelector("#evrenSayfa h2").textContent); }));
    await N.evaluate(function () { location.hash = "#/ev/fan/fornek-sis"; }); await bekle(N, 800);
    await N.click('#evrenSayfa [data-evs-sekme="bilgi"]'); await bekle(N, 200);
    await N.click("#evrenSayfa [data-evd-indir]"); await bekle(N, 1500);
    ok("evren telefona indirilir (kalıcı önbellek)", await N.evaluate(async function () {
      const c = await caches.open("tf-evrenler");
      return (await c.keys()).some(function (r) { return /\/evrenler\/fornek-sis\.json$/.test(r.url); }) && !!evdIndirilenler()["fornek-sis"];
    }));
    await N.click("#evrenSayfa [data-tkp]"); await bekle(N, 400);
    ok("evren takip edilir", await N.evaluate(function () { return tkpListe()["fornek-sis"] === 2 && /Takibi bırak/.test(document.querySelector("#evrenSayfa .tkp-kutu").textContent); }));
    ok("takip edilen evrende yeni bölüm ana sayfada", await N.evaluate(function () {
      const l = tkpListe(); l["fornek-sis"] = 1; jsonYaz(TKP_ANAHTAR, l);
      evrenSayfaKapat(); takipCiz();
      return /Sis Denizi/.test(document.querySelector("#takipAlan").textContent) && /1 yeni bölüm/.test(document.querySelector("#takipAlan").textContent);
    }));
    ok("servis çalışanı ayarı takibi bilir", await N.evaluate(async function () {
      await swAyarEsitle(); const c = await caches.open("tf-ayar"); const a = await (await c.match("/__tf-ayar")).json(); return a.takip["fornek-sis"] >= 1;
    }));

    /* ---------- tür şablonu, nehir/yol, ölçek, geçit, PNG ---------- */
    const turEv = await N.evaluate(function () { return evrenYeniKur(); });
    await N.evaluate(function (id) { evrenSonrakiSekme = "bilgi"; location.hash = "#/ev/benim/" + id; }, turEv); await bekle(N, 700);
    await N.click('#evrenSayfa [data-evt-tur="su"]'); await bekle(N, 300);
    ok("türle başla: kurallar, sözlük, para, stil ve harita dolar", await N.evaluate(function (id) {
      const e = evrenBenimBul(id); return e.kurallar.length === 2 && e.sozluk.length === 2 && e.para.ad === "inci" && e.stil.ana === "#1D6FA5" && e.harita.yerler.length === 5;
    }, turEv));
    await N.click('#evrenSayfa [data-evs-sekme="harita"]'); await bekle(N, 200);
    await N.click('#evrenSayfa [data-evh-mod="cizgi"]'); await bekle(N, 100);
    await N.click('#evrenSayfa [data-evh-cizgi-tur="yol"]'); await bekle(N, 100);
    const hk = await N.locator("#evrenSayfa .evh-svg").boundingBox();
    await N.mouse.click(hk.x + hk.width * 0.1, hk.y + hk.height * 0.5); await N.mouse.click(hk.x + hk.width * 0.8, hk.y + hk.height * 0.3);
    await N.click("#evrenSayfa [data-evh-cizgi-bitir]"); await bekle(N, 200);
    await N.fill("#evhCizgiAd", "Kıyı Yolu"); await bekle(N, 150);
    await N.fill('[data-evh-olcek="deger"]', "120"); await N.dispatchEvent('[data-evh-olcek="deger"]', "change"); await bekle(N, 200);
    ok("yol çizilir, adlanır; ölçek konur", await N.evaluate(function (id) {
      const h = evrenBenimBul(id).harita; return h.cizgiler.length === 1 && h.cizgiler[0].tur === "yol" && h.cizgiler[0].ad === "Kıyı Yolu" && h.olcek.deger === 120;
    }, turEv) && await N.locator("#evrenSayfa .evh-olcek").count() === 1);
    await N.evaluate(function (id) { EVS.secili = evrenBenimBul(id).harita.yerler[1].id; evrenSayfaCiz(); }, turEv);
    await N.selectOption("#evhGecit", "#/ev/fan/fornek-kul"); await bekle(N, 200);
    ok("yere geçit konur, dosyada kalır", await N.evaluate(function (id) {
      const e = evrenBenimBul(id); const x = fanMetindenEser(fanDosyaHtml(e));
      return e.harita.yerler[1].gecit === "#/ev/fan/fornek-kul" && x.harita.yerler[1].gecit === "#/ev/fan/fornek-kul" && x.harita.cizgiler.length === 1 && x.harita.olcek.deger === 120;
    }, turEv));
    ok("zararlı geçit ve çizgi temizlenir", await N.evaluate(function () {
      const x = fanTemizle({ bicim: FAN_BICIM, tur: "evren", ad: "x", harita: { yerler: [{ ad: "a", gecit: "javascript:alert(1)" }], cizgiler: [{ tur: "<b>", noktalar: [[1, 2]] }] } });
      return !x.harita.yerler[0].gecit && !x.harita.cizgiler;
    }));
    const [pngInd] = await Promise.all([N.waitForEvent("download"), N.click("#evrenSayfa [data-evh-png]")]);
    ok("harita PNG olarak iner", /-harita\.png$/.test(pngInd.suggestedFilename()));

    ok("konuk haritası: kişinin gittiği yerler", await N.evaluate(function () {
      const l = fanEserlerim();
      l.push({ bicim: FAN_BICIM, surum: 1, tur: "hikaye", id: "hk1", baslik: "Orlan kıyıda", metin: "…", konuklar: [{ bicim: FAN_BICIM, tur: "kisi", id: "vitrin1", ad: "Orlan Gezgin", kisilik: [] }] });
      fanEserlerimYaz(l);
      const y = konukYerleri("vitrin1");
      const svg = konukHaritasiSvg({ ad: "Orlan Gezgin" }, y);
      return y.length === 1 && y[0].ad === "Orlan kıyıda" && (svg.match(/<circle/g) || []).length === 2;
    }));
    await N.evaluate(function () { location.hash = "#/ev/site/e25"; }); await bekle(N, 900);
    await N.click('#evrenSayfa [data-konuk-harita="site:vitrin1"]'); await bekle(N, 200);
    ok("E25'te “Nerelere gitti?” haritası", await N.locator("#evrenSayfa .konuk-harita").count() === 1 && /Orlan kıyıda/.test(await N.textContent("#evrenSayfa .konuk-harita-kutu")));
    await N.close();

    /* ---------- 2. paylaşım adresi ve PWA ---------- */
    const kisa = await (await fetch(adres + "/dunya/")).text();
    ok("/dunya/ kendi başlığıyla ayrı sayfa", /<title>Dünya — TentiforApp<\/title>/.test(kisa) && /og:title" content="Dünya — TentiforApp"/.test(kisa) &&
      /rel="canonical" href="[^"]*\/dunya\/"/.test(kisa));
    ok("/dunya/ yönlendirmez, uygulamanın kendisi", !/location\.replace|http-equiv="refresh"/.test(kisa) && /<base href="\/">/.test(kisa) && /js\/00-rota\.js/.test(kisa));
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

    /* ---------- günün kelimesi (zor): sunucudaki kelime, kelimenin kartı, istatistik ---------- */
    await B.evaluate(function () { location.hash = "#/yarislar"; }); await bekle(B, 1500);
    ok("hesaplı okurda günün kelimesi zor modla açılır", await B.evaluate(function () { return gkModu(); }) === "zor" &&
      await B.locator('#gkAlan [data-gk-mod="zor"][aria-selected="true"]').count() === 1);
    const gkCevap = (await sahte.kokSorgu("select public.gk_cevap((now() at time zone 'utc')::date) c")).rows[0].c;
    await B.fill("#gkGiris", gkCevap); await B.press("#gkGiris", "Enter"); await bekle(B, 1500);
    ok("zor mod bitince kelimenin kartı ve hikâye düğmesi", await B.locator("#gkIc .ko-bilgi").count() === 1 && await B.locator("#gkIc [data-gk-hikaye]").count() === 1,
      await B.textContent("#gkIc"));
    ok("sunucudaki seri ve dağılım", /1\s*oynanan/.test(await B.textContent("#gkIc [data-gk-istat]")), await B.textContent("#gkIc"));
    await B.click('#gkAlan [data-gk-mod="kolay"]'); await bekle(B, 300);
    ok("kolay moda geçilir ve hatırlanır", await B.locator("#gkIc [data-ko-form], #gkIc .gk-son").count() === 1 && await B.evaluate(function () { return gkModu(); }) === "kolay");

    /* ---------- evren ziyaretçi defteri ---------- */
    await B.evaluate(function () { location.hash = "#/ev/e99"; }); await bekle(B, 800);
    await B.click('#evrenSayfa [data-evs-sekme="defter"]'); await bekle(B, 1200);
    await B.fill("#defterNot", "Buraya uğradım, en çok boş haritası aklımda kaldı.");
    await B.click("#evrenSayfa [data-defter-yaz]"); await bekle(B, 1500);
    ok("defter notu onaya düşer", (await sahte.kokSorgu("select count(*)::int n from public.evren_defteri where evren = 'e99' and not onayli")).rows[0].n === 1);
    ok("yazan kendi notunu onay bekliyor diye görür", /onay bekliyor/.test(await B.textContent("#evrenSayfa .evren-defter")));

    /* ---------- hesapsız kurulan evren, var olan hesaba girince kaybolmaz ---------- */
    const M = await cihaz("misafir-evren");
    await M.goto(adres + "/"); await bekle(M, 1200);
    const mEv = await M.evaluate(function () { return evrenYeniKur(); });
    await M.evaluate(function (id) { evrenSonrakiSekme = "bilgi"; location.hash = "#/ev/benim/" + id; }, mEv); await bekle(M, 600);
    await M.fill('#evrenSayfa [data-fan-alan="ad"]', "Misafir Evreni"); await bekle(M, 900);
    await M.evaluate(function () { evrenSayfaKapat(); location.hash = "#/sen"; }); await bekle(M, 1500);
    await M.click("#hesapBtn"); await bekle(M, 300);
    if (await M.locator("#hGirisEposta").count() === 0) { await M.click('#perde [data-hesap-pencere="giris"]'); await bekle(M, 300); }
    await M.fill("#hGirisEposta", "b@ornek.test"); await M.fill("#hGirisSifre", "tomye-2026");
    await M.click('[data-hesap-form="giris"] button[type=submit]'); await bekle(M, 4000);
    ok("hesapsız kurulan evren hesaba girince cihazda kalır", await M.evaluate(function () {
      return fanEserlerim().some(function (e) { return e.tur === "evren" && e.ad === "Misafir Evreni"; });
    }));
    await M.evaluate(function () { return hesapEsitle(); }); await bekle(M, 1200);
    const bVeri = (await sahte.kokSorgu("select veri from public.ilerlemeler i join auth.users u on u.id = i.id where u.email = 'b@ornek.test'")).rows[0].veri;
    ok("birleşen evren hesaba da yazılır", /Misafir Evreni/.test(bVeri.tentiforapp_fan_eserlerim || ""));
    /* aynı cihazda iki hesap: çıkınca cihaz misafire döner, ikinci hesap birincinin ilerlemesini görmez */
    await M.evaluate(function () { cuzdan.ecka += 123; cuzdanKaydet(); return hesapEsitle(true); }); await bekle(M, 800);
    const mEcka = await M.evaluate(function () { return cuzdan.ecka; });
    await M.evaluate(function () { hesapCikis(); }); await bekle(M, 3500);
    ok("çıkınca cihaz misafire döner (evren ve eçka cihazda kalmaz)", await M.evaluate(function () {
      return !hesapKullanici && !fanEserlerim().some(function (e) { return e.ad === "Misafir Evreni"; }) && cuzdan.ecka < 123;
    }));
    await kayitOl(M, "Cem", "cemal", "cem2@ornek.test");
    ok("aynı cihazda açılan ikinci hesap ilkinin ilerlemesini görmez", await M.evaluate(function () {
      return !!hesapKullanici && !fanEserlerim().some(function (e) { return e.ad === "Misafir Evreni"; }) && cuzdan.ecka < 123;
    }));
    const bVeri2 = (await sahte.kokSorgu("select veri from public.ilerlemeler i join auth.users u on u.id = i.id where u.email = 'b@ornek.test'")).rows[0].veri;
    ok("ilk hesabın ilerlemesi hesabında durur", /Misafir Evreni/.test(bVeri2.tentiforapp_fan_eserlerim || "") &&
      JSON.parse(bVeri2.tentiforapp_cuzdan || "{}").ecka === mEcka);
    await M.close();
    await B.click("#evrenSayfa [data-evs-kapat]"); await bekle(B, 300);

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
    ok("koleksiyon çizilir (koleksiyona girmeyen kayıt hariç)", await A.locator("#koleksiyonAlan .kol-kart").count() === await A.evaluate(function () { return veri.karakterler.filter(function (k) { return k.kart !== false; }).length; }));
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
    ok("istatistik kutuları", await A.evaluate(function () { return document.querySelectorAll("#yIstAlan > .ist-kutular .ist-kutu").length; }) === 5);
    ok("bu hafta özeti: ziyaret, kayıt, günün kelimesi, bekleyen", /Bu hafta/.test(await A.textContent("#yHaftaAlan")) &&
      await A.locator("#yHaftaAlan .ist-kutu").count() === 5);
    ok("onay bekleyen defter notu panelde", /Buraya uğradım/.test(await A.textContent("#yHaftaAlan")));
    await A.click('#yHaftaAlan [data-y-defter$=":1"]'); await bekle(A, 1200);
    ok("yönetici notu onaylar", (await sahte.kokSorgu("select count(*)::int n from public.evren_defteri where onayli")).rows[0].n === 1);
    ok("üç günlük grafik", await A.locator(".ist-coklu svg").count() === 3);
    ok("tablo görünümü", await A.locator(".ist-tablo tbody tr").count() === 14);
    ok("günün kelimesi yalnızca lore adları (kısaltma ve sıradan kelime yok)", await A.evaluate(function () {
      const l = yarisPaketiUret().banka.gunun_kelimesi.map(function (x) { return x.cevap.kelime; });
      return l.length > 20 && ["gtbt", "görevli", "sabıka", "dost", "kıyı", "yerin"].every(function (k) { return l.indexOf(k) === -1; }) &&
        ["eçka", "tömye", "blero", "lebga"].every(function (k) { return l.indexOf(k) !== -1; });
    }));
    ok("İstatistik'te ziyaret sayacı", /Giriş: \/deneme\//.test(await A.textContent("#yOlayAlan")));
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

    ok("panelde başlangıç profiline geniş erişim onay ister", await A.evaluate(function () {
      const p = veri.profiller.find(function (x) { return x.id === veri.baslangicProfil; });
      const once = JSON.stringify(p.erisim);
      yoneticiKisiTaslak = kisiTaslakProfilden(p); yoneticiKisiTaslak.bolumler.roman = true;
      yoneticiKisiKaydet();
      return JSON.stringify(p.erisim) === once && /herkese gösteriliyor/.test(document.querySelector("#yDurum").textContent);
    }));
    await A.evaluate(function () { yoneticiBaslangicOnay = null; yoneticiKisiTaslak = null; });

    /* ---------- E25: Evrengezerler kendi evreninde, melezler ortak ---------- */
    await A.evaluate(function () { location.hash = "#/arsiv"; }); await bekle(A, 900);
    await A.evaluate(function () { cizKarakterler(); evrenFiltre = "hepsi"; cizEvren(); });
    ok("Tömye arşivinde Evrengezerler yok, melezler var", await A.evaluate(function () {
      const k = Array.from(document.querySelectorAll("#karakterIzgara .kart-ad")).map(function (x) { return x.textContent; });
      const e = Array.from(document.querySelectorAll("#evrenListe .madde-baslik")).map(function (x) { return x.textContent; }).join("|");
      return k.indexOf("Gri") === -1 && k.indexOf("Yejen") === -1 && k.indexOf("Feil Luyot") !== -1 && k.indexOf("Kaelan Luyot") !== -1 &&
        !/Beyaz Taşlar/.test(e) && /Sabıka Soyu/.test(e) && !!document.querySelector('#evrenListe [data-evren-git="#/ev/site/e25"]');
    }));
    await A.click('#evrenListe [data-evren-git="#/ev/site/e25"]'); await bekle(A, 700);
    ok("E25 kendi sayfasında: Evrengezerler, ortak melezler, maddeler, sözlük", await A.evaluate(function () {
      const s = document.querySelector("#evrenSayfa");
      if (!s || rota() !== "#/ev/site/e25") { return false; }
      const t = s.textContent;
      const gri = veri.karakterler.findIndex(function (k) { return k.id === "gri"; });
      return !!s.querySelector('[data-karakter="' + gri + '"]') && !!s.querySelector('.kart-ortak [data-evren-git="#/karakter/feil"]') &&
        /Beyaz Taşlar/.test(t) && /Sabıka Soyu/.test(t) && /Tömye ile ortak/.test(t) && !!s.querySelector(".evs-sozluk") &&
        !!s.querySelector('.madde .buzul') && !/Yaşam Gücü Almadı/.test(t);
    }));
    await A.click('#evrenSayfa .kart-ortak [data-evren-git="#/karakter/feil"]'); await bekle(A, 900);
    ok("melezin anıları Tömye'de açılır", await A.evaluate(function () { return !document.querySelector("#evrenSayfa") && /karakter\/feil/.test(rota()); }));
    await A.evaluate(function () { if (typeof perdeKapat === "function") { perdeKapat(); } location.hash = "#/sen"; }); await bekle(A, 500);

    /* ---------- Nıraz: Tömye'de adıyla, E25'te isimsiz; iki metin birbirini işaret etmez ---------- */
    const YASAK = /Evrengezer|gezgin|taş|Yansıma|Selim|yazar|izdüşüm|E25|başka evren/i;
    ok("Nıraz Tömye'de: Müdavim, Egir'in yanında, Evrengezer yok", await A.evaluate(function (yasak) {
      location.hash = "#/arsiv"; cizKarakterler();
      const kartlar = Array.from(document.querySelectorAll("#karakterIzgara .kart"));
      const adlar = kartlar.map(function (k) { return k.querySelector(".kart-ad").textContent; });
      const i = adlar.indexOf("Nıraz");
      const kart = kartlar[i];
      const k = veri.karakterler.find(function (x) { return x.id === "niraz"; });
      const re = new RegExp(yasak, "i");
      return i > 0 && adlar[i - 1] === "Egir" && /Müdavim/.test(kart.textContent) && !re.test(kart.textContent) &&
        !k.gizli && !k.evrenler && !re.test(JSON.stringify(k));
    }, YASAK.source));
    ok("Nıraz'ın kaydı açılınca da Evrengezer yazmaz", await A.evaluate(function (yasak) {
      karakterAc(veri.karakterler.findIndex(function (x) { return x.id === "niraz"; }));
      const t = document.querySelector("#perde").textContent;
      perdeKapat();
      return /Müdavim/.test(t) && /Kendini anlatmaz/.test(t) && !new RegExp(yasak, "i").test(t.replace(/Tentiforverse/g, ""));
    }, YASAK.source));
    ok("Nıraz kart koleksiyonuna ve yarış sorularına girmez", await A.evaluate(function () {
      kartKazan("niraz", "okuma");
      const setler = kartSetleri();
      return !kartSahip("niraz") && !Object.keys(setler).some(function (g) { return setler[g].some(function (x) { return x.k.id === "niraz"; }); });
    }));
    await A.evaluate(function () { location.hash = "#/ev/site/e25"; }); await bekle(A, 700);
    ok("E25'te isimsiz kutu: isim satırı yok, aynı kişilik, ad yok", await A.evaluate(function (yasak) {
      const s = document.querySelector("#evrenSayfa");
      const kutu = s && s.querySelector(".kisi-kutu");
      if (!kutu) { return false; }
      const t = kutu.textContent;
      return !kutu.querySelector("h1,h2,h3,h4,dt,b,strong") && /önce işleyişi öğrenir/.test(t) && /Kendini anlatmaz/.test(t) &&
        !/—|Adsız|\?\?\?/.test(kutu.innerHTML) && !/Nıraz/.test(s.textContent) && !new RegExp(yasak, "i").test(t) &&
        veri.kanonEvrenleri.e25.kisiler.length === 1;
    }, YASAK.source));
    await A.evaluate(function () { location.hash = "#/sen"; }); await bekle(A, 400);
    ok("Gündüz Vardiyası: iki kısa replik, sıraya ve puana sayılmaz", await A.evaluate(function () {
      const m = veri.musteriler.find(function (x) { return x.ad === "Nıraz"; });
      let alan = document.querySelector("#vardiyaAlan");
      const yapay = !alan;
      if (yapay) { alan = document.createElement("div"); alan.id = "vardiyaAlan"; document.body.appendChild(alan); }
      V = { sira: 3, toplam: 10, kazanc: 0, memnun: 0, sabir: 5, bitti: false, musteri: m, secim: null };
      vardiyaCiz();
      const once = alan.textContent;
      alan.querySelector("[data-vardiya-anlat]").click();
      const sonra = alan.textContent;
      const tamam = /Burası nasıl işliyor\?/.test(once) && /Anladım\./.test(sonra) && V.sira === 3 && V.sabir === 5 && !/taş|evren|gezi/i.test(JSON.stringify(m));
      V = null; if (yapay) { alan.remove(); }
      return tamam;
    }));

    ok("E25 evren seçicide, kodsuz ziyaretçiye kilitli", await Z.evaluate(function () {
      const e = evrenSeciciListesi().site.find(function (x) { return x.ad === "E25"; });
      return !!e && e.kilitli && e.git === "#/ev/site/e25";
    }));
    ok("her evrenin kendi sayfası ve site haritası", /E25/.test(readFileSync(dizin + "/evren/e25/index.html", "utf8")) &&
      /rel="canonical" href="[^"]*\/evren\/e25\/"/.test(readFileSync(dizin + "/evren/e25/index.html", "utf8")) &&
      /kodla açılır/.test(readFileSync(dizin + "/evren/e26/index.html", "utf8")) &&
      /\/evren\/e25\//.test(readFileSync(dizin + "/sitemap.xml", "utf8")) && /Sitemap:/.test(readFileSync(dizin + "/robots.txt", "utf8")));

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
