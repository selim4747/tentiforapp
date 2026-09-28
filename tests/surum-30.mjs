/* Sürüm 3.0 testleri: betik paketleri (ayrı dosyalarla birebir aynı davranış), hız bütçesi, kritik CSS ve iskelet,
   kendi sunucudaki yazı tipleri, veri parçaları (panel asla eksik veri kaydetmez), Değişiklikler sayfası,
   "Sıradaki ne olsun" listesi, üyenin sunucu yükü, uygulamanın açılış ekranı, Evren Kurucu ve zengin evren görünümleri,
   hata yerinin asıl dosya adıyla yazılması. tests/calistir.mjs çağırır. */

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { yeniSahte } = require("./supabase-taklidi.cjs");
const TEST_URL = "https://test.supabase.co";

/* hız bütçesi (CPU 4 kat yavaş): aşılırsa test düşer — açılışı ağırlaştıran değişiklik fark edilsin */
const BUTCE = {
  betikIstegi: 6,            /* ilk açılışta indirilen betik dosyası */
  ayniKokenIstek: 10,        /* ilk açılışta sitenin kendisinden istek (sayfa, CSS, betik, veri; yazı tipleri hariç) */
  yaziTipi: 10,              /* ilk açılışta inen yazı tipi dosyası */
  betikBayt: 1700 * 1024,    /* betiklerin toplam boyu (sıkıştırmasız) */
  veriBayt: 330 * 1024,      /* veri.json (sıkıştırmasız) */
  kritikCss: 48 * 1024,      /* sayfaya gömülü kritik CSS */
  hazirMs: 6000              /* veri çizilip arama kutusu hazır olana kadar (CPU×4) */
};

const TURLER = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2" };
function statikSunucu(dizin) {
  return createServer(function (istek, yanit) {
    let yol = decodeURIComponent(new URL(istek.url, "http://x").pathname);
    if (yol.endsWith("/")) { yol += "index.html"; }
    const dosya = join(dizin, yol);
    try {
      if (statSync(dosya).isDirectory()) { yanit.writeHead(301, { Location: yol + "/" }); yanit.end(); return; }
      yanit.writeHead(200, { "Content-Type": TURLER[extname(dosya)] || "application/octet-stream" }); yanit.end(readFileSync(dosya));
    } catch (e) {
      if (!extname(yol)) { yanit.writeHead(200, { "Content-Type": TURLER[".html"] }); yanit.end(readFileSync(join(dizin, "index.html"))); return; }
      yanit.writeHead(404); yanit.end("yok");
    }
  });
}

export async function surum30Testleri({ adres, veritabani, dizin, kok }) {
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
        localStorage.setItem("tentiforapp_seviye_test", "20"); localStorage.setItem("tentiforapp_hesap_hatirlat", JSON.stringify({ kapat: true }));
      } catch (e) { /* yok */ }
      if (!o.onbellek) { window.__okumaOnbellegiKapali = true; }
      if (o.uygulama) {
        window.__splash = [];
        window.Capacitor = { isNativePlatform: function () { return true; }, getPlatform: function () { return "android"; }, Plugins: {
          App: { addListener: function () {}, getLaunchUrl: async function () { return null; }, getInfo: async function () { return { build: "999" }; } },
          SplashScreen: { hide: async function (x) { window.__splash.push(Object.assign({ zaman: performance.now() }, x || {})); } }
        } };
      }
    }, { uygulama: !!s.uygulama, onbellek: !!s.onbellek });
    await ctx.route(/\/js\/(?:28-hesap|paket-\d+)\.js(\?|$)/, function (r) { return r.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(dizin + new URL(r.request().url()).pathname, "utf8").replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, TEST_URL) }); });
    await ctx.route(TEST_URL + "/**", function (r) { if (s.istekler) { s.istekler.push(r.request().method() + " " + new URL(r.request().url()).pathname.replace("/rest/v1", "")); } return sahte.isle(r); });
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

  const ayriDizin = mkdtempSync(join(tmpdir(), "tf-ayri-"));
  let ayriSunucu = null;
  try {
    /* ---------- 1. betik paketleri ---------- */
    console.log("3.0 betik paketleri");
    const ana = readFileSync(dizin + "/index.html", "utf8");
    const betikler = [...ana.matchAll(/<script src="(js\/[^"?]+)/g)].map(function (m) { return m[1]; });
    ok("ilk açılışta en çok " + BUTCE.betikIstegi + " betik dosyası (" + betikler.length + ")", betikler.length <= BUTCE.betikIstegi && betikler.some(function (b) { return /paket-1\.js$/.test(b); }), betikler);
    ok("yönetici araçları paketlerde yok, sonradan iner", ![1, 2, 3, 4].some(function (n) { return /YONETICI_BIRLESTIR|function yoneticiGithub\(/.test(readFileSync(dizin + "/js/paket-" + n + ".js", "utf8")); }));
    /* aynı kaynak, paketsiz: iki sürümde bütün fonksiyonlar birebir aynı olmalı */
    execFileSync("node", [join(kok, "scripts/paketle.mjs")], { env: Object.assign({}, process.env, { PAKETSIZ: "1", PAKET_HEDEF: ayriDizin }), stdio: "ignore" });
    ayriSunucu = statikSunucu(ayriDizin);
    await new Promise(function (r) { ayriSunucu.listen(0, "127.0.0.1", r); });
    const ayriAdres = "http://127.0.0.1:" + ayriSunucu.address().port;
    const fonksiyonlar = async function (taban, yol) {
      const ctx = await tarayici.newContext({ serviceWorkers: "block" });
      await ctx.addInitScript(function () { localStorage.setItem("tentiforapp_tur", "bitti"); localStorage.setItem("tentiforapp_baslangic_oto", "kapali"); });
      await ctx.route(/supabase\.co/, function (r) { return r.abort(); });
      const p = await ctx.newPage();
      await p.goto(taban + yol); await p.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(p, 2500);
      const f = await p.evaluate(function () {
        const o = {};
        Object.getOwnPropertyNames(window).forEach(function (k) {
          let v; try { v = window[k]; } catch (_) { return; }
          if (typeof v !== "function") { return; }
          const m = Function.prototype.toString.call(v);
          if (!/\{\s*\[native code\]\s*\}$/.test(m)) { o[k] = m.length + ":" + m.slice(0, 60); }
        });
        return o;
      });
      await ctx.close();
      return f;
    };
    for (const yol of ["/", "/evren/e25/", "/surumler/"]) {
      const a = await fonksiyonlar(ayriAdres, yol), b = await fonksiyonlar(adres, yol);
      const fark = Object.keys(Object.assign({}, a, b)).filter(function (k) { return a[k] !== b[k]; });
      ok("paketli ve ayrı dosyalı sürüm aynı (" + yol + ", " + Object.keys(b).length + " fonksiyon)", fark.length === 0 && Object.keys(b).length > 1500, fark.slice(0, 8));
    }

    /* ---------- 2. hız bütçesi ---------- */
    console.log("3.0 hız bütçesi");
    {
      const ctx = await tarayici.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers: "block" });
      await ctx.addInitScript(function () { localStorage.setItem("tentiforapp_tur", "bitti"); localStorage.setItem("tentiforapp_baslangic_oto", "kapali"); });
      const istek = [];
      await ctx.route(/supabase\.co|fonts\.g/, function (r) { istek.push("DIŞ " + r.request().url()); return r.abort(); });
      const p = await ctx.newPage();
      p.on("request", function (r) { if (r.url().indexOf(adres) === 0) { istek.push(r.url().slice(adres.length)); } });
      const c = await ctx.newCDPSession(p);
      await c.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      const bas = Date.now();
      await p.goto(adres + "/");
      await p.waitForFunction(function () { return typeof veri !== "undefined" && veri && document.documentElement.classList.contains("veri-hazir") && document.querySelector("#kesif .arama-kutu, #aramaGiris"); }, null, { timeout: 30000 });
      const sure = Date.now() - bas;
      await bekle(p, 1500);
      const olcum = await p.evaluate(function () {
        const r = performance.getEntriesByType("resource");
        const boy = function (f) { return r.filter(f).reduce(function (s, x) { return s + (x.decodedBodySize || 0); }, 0); };
        const k = document.getElementById("kritikCss");
        return { js: boy(function (x) { return /\/js\/.*\.js/.test(x.name); }), veri: boy(function (x) { return /\/veri\.json/.test(x.name); }), kritik: k ? k.textContent.length : -1 };
      });
      const ilk = istek.filter(function (u) { return !/^DIŞ/.test(u) && !/\/yazitipi\//.test(u); });
      const yt = istek.filter(function (u) { return /\/yazitipi\//.test(u); });
      ok("ilk açılışta sitenin kendisinden en çok " + BUTCE.ayniKokenIstek + " istek (" + ilk.length + ") ve " + BUTCE.yaziTipi + " yazı tipi (" + yt.length + ")", ilk.length <= BUTCE.ayniKokenIstek && yt.length <= BUTCE.yaziTipi, istek);
      ok("Google yazı tiplerine istek yok", !istek.some(function (u) { return /fonts\.g/.test(u); }) && istek.some(function (u) { return /\/yazitipi\/.+\.woff2$/.test(u); }), istek.filter(function (u) { return /font|yazitipi/.test(u); }));
      ok("betikler bütçede (" + Math.round(olcum.js / 1024) + " KB)", olcum.js > 0 && olcum.js <= BUTCE.betikBayt, olcum);
      ok("veri.json bütçede (" + Math.round(olcum.veri / 1024) + " KB)", olcum.veri > 0 && olcum.veri <= BUTCE.veriBayt, olcum);
      ok("kritik CSS bütçede (" + Math.round(olcum.kritik / 1024) + " KB)", olcum.kritik > 1000 && olcum.kritik <= BUTCE.kritikCss, olcum);
      ok("CPU 4 kat yavaşken " + BUTCE.hazirMs + " ms içinde hazır (" + sure + " ms)", sure <= BUTCE.hazirMs, sure);
      await ctx.close();
    }

    /* ---------- 3. kritik CSS, iskelet, erken tema ---------- */
    console.log("3.0 kritik CSS ve iskelet");
    {
      const ctx = await tarayici.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers: "block", colorScheme: "dark" });
      await ctx.addInitScript(function () { localStorage.setItem("tentiforapp_tur", "bitti"); localStorage.setItem("tentiforapp_baslangic_oto", "kapali"); });
      await ctx.route(/supabase\.co/, function (r) { return r.abort(); });
      let cssBirak = null, veriBirak = null;
      await ctx.route(/\/css\/style\.css/, function (r) { return new Promise(function (c) { cssBirak = function () { c(r.continue()); }; }); });
      await ctx.route(/\/veri\.json$/, function (r) { return new Promise(function (c) { veriBirak = function () { c(r.continue()); }; }); });
      const p = await ctx.newPage();
      await p.goto(adres + "/", { waitUntil: "commit" }); await bekle(p, 1500);
      const once = await p.evaluate(function () {
        const h = document.querySelector(".hero-baslik"), iz = document.querySelector("#karakterIzgara");
        return { font: h ? getComputedStyle(h).fontFamily : "", tema: document.documentElement.getAttribute("data-ayar-tema"),
          iskelet: iz ? getComputedStyle(iz).minHeight : "", hazir: document.documentElement.classList.contains("veri-hazir"), tam: document.documentElement.classList.contains("css-tam") };
      });
      ok("tam CSS gelmeden ilk ekran biçimli (kritik CSS), tema betikten önce", /Bodoni/.test(once.font) && once.tema === "gece" && !once.tam, once);
      ok("veri gelmeden iskelet görünür", /px/.test(once.iskelet) && parseInt(once.iskelet, 10) > 200 && !once.hazir, once);
      veriBirak(); await bekle(p, 1200);
      ok("veri geldi ama tam CSS yok: çizim CSS'i bekler (biçimsiz içerik görünmez)", await p.evaluate(function () { return !document.documentElement.classList.contains("veri-hazir") && !document.querySelector("#karakterIzgara .karakter-kart, #karakterIzgara > *"); }));
      cssBirak(); await p.waitForFunction(veriVar, null, { timeout: 15000 }); await bekle(p, 500);
      ok("CSS gelince çizilir, iskelet kalkar", await p.evaluate(function () { return document.documentElement.classList.contains("css-tam") && document.querySelectorAll("#karakterIzgara > *").length > 3; }));
      await p.goto(adres + "/dunya/", { waitUntil: "commit" }); await bekle(p, 300);
      await ctx.close();
      const ctx2 = await tarayici.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
      await ctx2.route(/\/veri\.json$/, function () { /* hiç gelmez */ });
      await ctx2.route(/supabase\.co/, function (r) { return r.abort(); });
      const d = await ctx2.newPage();
      await d.goto(adres + "/dunya/", { waitUntil: "commit" }); await bekle(d, 1500);
      ok("başka sayfa açılırken arşivin içeriği görünmez, iskelet görünür", await d.evaluate(function () {
        const h = document.querySelector(".hero");
        return document.documentElement.getAttribute("data-ilk-sayfa") === "baska" && (!h || getComputedStyle(h).display === "none") && getComputedStyle(document.querySelector("main"), "::before").content !== "none";
      }));
      await ctx2.close();
    }

    /* ---------- 4. hata yeri ---------- */
    const O = await cihaz("okur");
    await O.goto(adres + "/"); await O.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(O, 500);
    ok("paketteki hata satırı asıl dosyanın adıyla yazılır", await O.evaluate(function () {
      const t = window.__PAKET__["paket-2.js"];
      const son = t[t.length - 1];
      const s = hataYeriCevir("at f (http://x/js/paket-2.js?v=abc1234567:" + son[0] + ":17)");
      return t.length > 5 && s.indexOf(son[1] + " (paket-2.js:" + son[0] + ":17)") !== -1 && hataYeriCevir("yok.js:3") === "yok.js:3";
    }));

    /* ---------- 5. veri parçaları ve Değişiklikler sayfası ---------- */
    console.log("3.0 değişiklikler sayfası ve veri parçaları");
    const kaynakVeri = JSON.parse(readFileSync(join(kok, "veri.json"), "utf8"));
    ok("açılışta değişiklik günlüğünün yalnızca başı iner", await O.evaluate(function (n) {
      return !!veri.__parcalar && veri.degisiklik.length === 3 && veri.__parcalar.degisiklik.toplam === n;
    }, kaynakVeri.degisiklik.length));
    ok("GEZINME'de 14 sayfa, değişiklikler kendi sayfasında", await O.evaluate(function () {
      const p = GEZINME.find(function (g) { return g.id === "surumler"; });
      return GEZINME.length === 14 && !!p && p.bolumler[0][0] === "degisiklik" && !GEZINME.find(function (g) { return g.id === "proje"; }).bolumler.some(function (b) { return b[0] === "degisiklik"; });
    }));
    await O.evaluate(function () { localStorage.setItem("tf30_degisiklik_son", "2.7.0"); });
    await O.goto(adres + "/surumler/"); await O.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(O, 1200);
    ok("Değişiklikler sayfası bütün sürümleri indirir ve gösterir", await O.evaluate(function (n) {
      return aktifSayfa === "surumler" && document.querySelectorAll("#degisiklikAlan .dg-surum").length === n && !veri.__parcalar && !document.querySelector(".dg-yukleniyor");
    }, kaynakVeri.degisiklik.length));
    ok("son ziyaretten beri gelen sürümler işaretli", await O.evaluate(function () {
      const y = Array.from(document.querySelectorAll("#degisiklikAlan .dg-surum.yeni .dg-no")).map(function (x) { return x.textContent; });
      return y.length >= 1 && y.indexOf("2.7.0") === -1 && y.indexOf(veri.degisiklik[0].surum) !== -1 && localStorage.getItem("tf30_degisiklik_son") === veri.degisiklik[0].surum;
    }));
    await O.evaluate(function () { window.__dgKutu = document.querySelector("#dgAra"); document.querySelector("#dgAra").focus(); });
    await O.keyboard.type("harita", { delay: 30 }); await bekle(O, 200);
    ok("arama: yazarken kutu yerinde kalır, eşleşenler işaretli", await O.evaluate(function () {
      const k = document.querySelector("#dgAra");
      const m = document.querySelectorAll("#degisiklikAlan .dg-maddeler mark");
      return k === window.__dgKutu && document.activeElement === k && m.length > 0 && Array.from(m).every(function (x) { return /harita/i.test(x.textContent); });
    }));
    await O.fill("#dgAra", ""); await O.click('[data-dg-seri="1"]'); await bekle(O, 200);
    ok("seri süzgeci: yalnızca 1.x", await O.evaluate(function () {
      const l = Array.from(document.querySelectorAll("#degisiklikAlan .dg-no")).map(function (x) { return x.textContent; });
      return l.length > 0 && l.every(function (s) { return /^1\./.test(s); });
    }));
    ok("panel kaydederken parçalar yerinde: veri tam, özet GitHub'daki tam veriyle aynı", await O.evaluate(async function (tamMetin) {
      await veriParcalariTam();
      veriTabanOzeti = null;
      veriTabanHam = await (await fetch("veri.json")).text();
      const ozet = tabanOzeti();
      const tam = JSON.parse(tamMetin);
      return ozet === veriOzeti(tam) && JSON.stringify(veri).indexOf("__parcalar") === -1 && veri.degisiklik.length === tam.degisiklik.length;
    }, readFileSync(join(kok, "veri.json"), "utf8")));
    const T = await cihaz("taze");
    await T.goto(adres + "/"); await T.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(T, 400);
    ok("dışa aktarma ve GitHub'a kaydetme önce parçaları yerine koyar", await T.evaluate(async function () {
      const once = !!veri.__parcalar;
      let pano = "";
      window.panoyaKopyala = function (m) { pano = m; return Promise.resolve(); };
      await yoneticiDisaAktar();
      return once && !veri.__parcalar && JSON.parse(pano).degisiklik.length > 3 && pano.indexOf("__parcalar") === -1;
    }));

    /* ---------- 6. Sıradaki ne olsun ---------- */
    console.log("3.0 sıradaki ne olsun");
    ok("oylama listesi panelden: başlangıçta boş, yarış paketi yalnız onu gönderir", await T.evaluate(function () {
      return Array.isArray(veri.oylama) && veri.oylama.length === 0 && yarisPaketiUret().yapimlar.length === 0;
    }));
    await T.evaluate(function () {
      window.yoneticiAcik = function () { return true; }; window.panelAcik = function () { return true; };
      location.hash = "#/sen"; yoneticiGrup = "icerik"; yoneticiSekme = "listeler"; yListe = "oylama"; yoneticiCiz();
    }); await bekle(T, 800);
    await T.fill("#yOylamaMetin", "Delilik 2. kitap\nTuz Denizi dizisi\n\nDelilik 2. kitap"); await T.click("[data-y-oylama-kaydet]"); await bekle(T, 400);
    ok("panelde yazılan seçenekler kaydedilir (tekrar ve boş satır atılır)", await T.evaluate(function () {
      return JSON.stringify(veri.oylama) === JSON.stringify(["Delilik 2. kitap", "Tuz Denizi dizisi"]) && JSON.stringify(yarisPaketiUret().yapimlar) === JSON.stringify(veri.oylama);
    }));

    /* ---------- 7. üyenin sunucu yükü ---------- */
    console.log("3.0 sunucu yükü");
    const istekler = [];
    const U = await cihaz("uye", { onbellek: true, istekler: istekler });
    await kayitOl(U, "Yük Ölçen", "yukolcen30", "y30@ornek.test");
    await U.goto(adres + "/"); await bekle(U, 4000);
    istekler.length = 0;
    await U.goto(adres + "/oyunlar/"); await bekle(U, 4000);
    const say = function (d) { return istekler.filter(function (x) { return d.test(x); }).length; };
    ok("sayfa yenilenince kendi verin sunucuya yeniden sorulmaz (seviye, yarış, yönetici)",
      say(/^GET \/arsivci_seviyeleri/) === 0 && say(/^GET \/yaris_tablolari/) === 0 && say(/rpc\/yonetici_mi/) === 0, istekler);
    /* eşitleme yazmaları gerekli; liderlik ve kulüp tabloları yayında Cloudflare'den gelir (functions/api/pano.js) */
    const okumalar = istekler.filter(function (x) { return !/^(POST|PATCH) \/(ilerlemeler|profiller|rpc\/istatistik_gonder|rpc\/sayac_toplu)/.test(x) && !/^GET \/(liderlik|kulup_savasi)$/.test(x); });
    ok("sayfa açılışında 10'dan az sunucu okuması (" + okumalar.length + "; 2.8'de ~20)", okumalar.length < 10, okumalar);
    await U.evaluate(function () { return hesapIstemci.from("profiller").update({ gorunen_ad: "Yük Ölçen 2" }).eq("id", hesapKullanici.id); }); await bekle(U, 300);
    ok("profil yazması profil okumalarını eskitir, eşitleme yazmaları önbelleği boşaltmaz", await U.evaluate(function () {
      const t = JSON.parse(sessionStorage.getItem("tf30_okuma") || "{}");
      return !Object.keys(t).some(function (k) { return /\/rest\/v1\/profiller\?/.test(k); }) && Object.keys(t).length > 0;
    }));
    await U.evaluate(function () { return hesapIstemci.rpc("teori_bildir", { p_id: 0 }); }); await bekle(U, 300);
    ok("tanınmayan bir yazma bütün kalıcı önbelleği boşaltır", await U.evaluate(function () { return !sessionStorage.getItem("tf30_okuma"); }));

    /* ---------- 8. uygulamanın açılış ekranı ---------- */
    console.log("3.0 uygulama açılış ekranı");
    const A = await cihaz("uygulama", { uygulama: true });
    await A.goto(adres + "/"); await A.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(A, 500);
    ok("uygulamada açılış ekranı veri çizilince kalkar", await A.evaluate(function () { return window.__splash.length >= 1 && window.__splash[0].fadeOutDuration === 200; }));
    const kabuk = JSON.parse(readFileSync(join(kok, "uygulama/kabuk/capacitor.config.json"), "utf8"));
    const paketJ = JSON.parse(readFileSync(join(kok, "uygulama/kabuk/package.json"), "utf8"));
    const apk = readFileSync(join(kok, ".github/workflows/apk.yml"), "utf8");
    ok("açılış ekranı eklentisi, en çok 6 sn, sitenin ikonuyla", !!paketJ.dependencies["@capacitor/splash-screen"] && kabuk.plugins.SplashScreen.launchShowDuration === 6000 &&
      kabuk.plugins.SplashScreen.launchAutoHide === true && /splash\.png/.test(apk) && /ikon-512\.png/.test(apk));

    /* ---------- 9. Evren Kurucu ---------- */
    console.log("3.0 Evren Kurucu");
    const K = await cihaz("kurucu");
    await K.goto(adres + "/"); await K.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(K, 400);
    await K.evaluate(function () { window.kanonErisim = function () { return { hepsi: true, tumEvren: true, bolumler: new Set(), evrenler: new Set() }; }; location.hash = "#/oyunlar"; }); await bekle(K, 300);
    await K.evaluate(function () { evrenSeciciAc(); }); await bekle(K, 200);
    await K.click("#evrenSecici [data-es-yeni]"); await bekle(K, 700);
    ok("yeni evren Kurucu'yla açılır: adımlar ve Tömye ölçeği", await K.evaluate(function () {
      return EVS.sekme === "kurucu" && document.querySelectorAll("#evrenSayfa .evr-adim").length === 7 && !!document.querySelector("#evrenSayfa .evr-olcek-halka") &&
        !!document.querySelector('#evrenSayfa .evs-sekmeler [data-evs-sekme="kurucu"].secili');
    }));
    const evId = await K.evaluate(function () { return EVS.id; });
    await K.fill('#evrenSayfa .evr-kurucu [data-fan-alan="ad"]', "Tuz Denizi"); await bekle(K, 450);
    await K.click('#evrenSayfa [data-evr-adim="kisiler"]'); await bekle(K, 300);
    await K.click('#evrenSayfa .evr-kurucu [data-fan-ekle="kisiler"]'); await bekle(K, 300);
    await K.fill('#evrenSayfa [data-fan-alan="kisiler.0.ad"]', "Mira"); await K.fill('#evrenSayfa [data-fan-alan="kisiler.0.yas"]', "34");
    await K.fill('#evrenSayfa [data-fan-alan="kisiler.0.soz"]', "Tuz unutmaz."); await bekle(K, 450);
    ok("Kişiler adımı: yalnızca kişiler, yeni alanlar kaydedilir", await K.evaluate(function (id) {
      const e = evrenBenimBul(id);
      return e.ad === "Tuz Denizi" && e.kisiler[0].ad === "Mira" && e.kisiler[0].yas === "34" && e.kisiler[0].soz === "Tuz unutmaz." &&
        !document.querySelector('#evrenSayfa [data-fan-ekle="kurallar"]') && !!document.querySelector('#evrenSayfa [data-evs-sekme="ag"]');
    }, evId));
    await K.click('#evrenSayfa .evr-alt [data-evr-adim="zaman"]'); await bekle(K, 300);
    await K.fill('#evrenSayfa [data-fan-alan="takvim.yil"]', "Fırtınadan sonra"); await bekle(K, 450);
    await K.click('#evrenSayfa [data-fan-ekle="aylar"]'); await bekle(K, 300);
    await K.fill('#evrenSayfa [data-fan-alan="aylar.0.ad"]', "Kar"); await K.fill('#evrenSayfa [data-fan-alan="aylar.0.gun"]', "30"); await bekle(K, 450);
    ok("Zaman adımı: takvim (yıl sayımı, aylar) kaydedilir ve dosyaya girer", await K.evaluate(function (id) {
      const e = evrenBenimBul(id), t = fanTemizle(e);
      return e.takvim.yil === "Fırtınadan sonra" && t.takvim.yil === "Fırtınadan sonra" && t.aylar[0].ad === "Kar" && /Fırtınadan sonra/.test(fanDosyaHtml(t));
    }, evId));
    await K.evaluate(function (id) {
      evrenBenimDegistir(id, function (e) {
        e.kisiler.push({ ad: "Oren", rol: "Balıkçı", aciklama: "Mira'nın babası." }, { ad: "Lia", rol: "Çırak", aciklama: "Mira'nın kızı." });
        e.baglar = [{ a: "Oren", b: "Mira", etiket: "baba" }, { a: "Mira", b: "Lia", etiket: "anne" }, { a: "Mira", b: "Kael", etiket: "eş" }];
        e.tarih = [{ zaman: "0", cag: "Tuzdan önce", olay: "Deniz tatlıydı." }, { zaman: "12", cag: "Tuz Çağı", olay: "İlk tuz fırtınası." }];
        e.etkinlikler = [{ ad: "Hafıza Günü", ay: "Kar", gun: "7", metin: "Denize bir anı fısıldanır." }];
        e.belgeler = [{ tur: "Mektup", baslik: "Kıyıdan", kimden: "Oren", kime: "Mira", tarih: "411", metin: "Kızım, deniz bu sabah adını söyledi." }];
      });
      EVR_ADIM[id] = "paylas"; evrenSayfaCiz();
    }, evId); await bekle(K, 300);
    ok("Tömye ölçeği hedefleri 24. Evren'in kendi verisinden", await K.evaluate(function (id) {
      const o = evrOlcek(evrenBenimBul(id));
      const k = o.satir.find(function (r) { return r.id === "kisiler"; });
      return k.n === 3 && k.hedef === veri.karakterler.filter(function (x) { return x.kart !== false; }).length && o.yuzde > 0 && o.yuzde < 100 &&
        document.querySelectorAll("#evrenSayfa .evr-olcek-satir").length === 10;
    }, evId));
    await K.evaluate(function (id) { location.hash = "#/ev/onizle/" + id; }, evId); await bekle(K, 700);
    await K.evaluate(function () { EVS.sekme = "bilgi"; evrenSayfaCiz(); }); await bekle(K, 400);
    ok("okur görünümü: kişi kartları, aile ağacı, çağlı zaman çizelgesi, takvim, belge, içindekiler", await K.evaluate(function () {
      const s = document.querySelector("#evrenSayfa");
      const aile = s.querySelector(".evr-aile svg");
      return s.querySelectorAll(".evr-kisi").length === 3 && /Tuz unutmaz/.test(s.querySelector(".evr-soz").textContent) &&
        !!aile && aile.querySelectorAll(".evr-aile-kisi").length === 4 && aile.querySelectorAll(".evr-aile-cizgi").length === 2 && aile.querySelectorAll(".evr-aile-es").length === 1 &&
        Array.from(s.querySelectorAll(".evr-cag")).map(function (x) { return x.textContent; }).join("|") === "Tuzdan önce|Tuz Çağı" &&
        /Hafıza Günü/.test(s.querySelector(".evr-ay").textContent) && !!s.querySelector(".evr-belge-mektup") &&
        s.querySelectorAll(".evr-icindekiler [data-evr-git]").length >= 3 && s.scrollWidth <= s.clientWidth + 1;
    }));
    ok("zengin görünümde de okuma kutusu bölümleri yerinde", await K.evaluate(function () {
      return ["kisiler", "tarih", "belgeler", "aylar"].every(function (k) { return !!document.querySelector('#evrenSayfa section.fan-grup[data-grup="' + k + '"]'); });
    }));

    /* ---------- 10. kanon ve fan-made evrenler, Evren Atölyesi ---------- */
    console.log("3.0 kanon ve fan-made evrenler");
    ok("statü: sitenin evrenleri kanon, fan evreni fan-made, kendi evrenin senin", await K.evaluate(function (id) {
      const f = fanSiteListesi("evren")[0];
      return evaStatu("Tömye").tur === "kanon" && evaStatu("E25").tur === "kanon" && evaStatu(f.ad).tur === "fan" && evaStatu("Tuz Denizi").tur === "benim" && evaStatu("").tur === "serbest";
    }, evId));
    ok("fan-made evrene Evrengezer yalnızca sahibi ve yetkilileri getirir; kanonda herkes", await K.evaluate(function () {
      const f = fanSiteListesi("evren")[0];
      const h = fanYeni("hikaye"); const l = fanEserlerim(); const x = l.find(function (y) { return y.id === h.id; });
      x.evren = f.ad; x.baslik = "Deneme"; x.metin = "metin"; x.konuklar = [{ bicim: "tentifor-eser", tur: "kisi", id: "k1", ad: "Gezgin" }]; fanEserlerimYaz(l);
      const yasak = !!evaHikayeDenetle(fanEserlerim().find(function (y) { return y.id === h.id; }));
      let indi = false; const eski = window.kartIndir; window.kartIndir = function () { indi = true; };
      fanIndir(fanEserlerim().find(function (y) { return y.id === h.id; }));
      const engel = !indi;
      const gotur = kisiGotur({ bicim: "tentifor-eser", tur: "kisi", id: "k2", ad: "Gezgin 2" }, "hikaye:" + h.id) === null;
      const yetki = JSON.parse(localStorage.getItem("tentiforapp_evren_yonetim") || "{}"); yetki[f.id] = true; localStorage.setItem("tentiforapp_evren_yonetim", JSON.stringify(yetki));
      const yetkili = !evaHikayeDenetle(fanEserlerim().find(function (y) { return y.id === h.id; }));
      delete yetki[f.id]; localStorage.setItem("tentiforapp_evren_yonetim", JSON.stringify(yetki));
      f.kanon = true; const kanonda = !evaHikayeDenetle(fanEserlerim().find(function (y) { return y.id === h.id; })); delete f.kanon;
      window.kartIndir = eski;
      return yasak && engel && gotur && yetkili && kanonda && /Kanon evrende yeni hikâye: Tömye/.test(kisiGoturHtml({}, "a:b"));
    }));
    ok("sahibi kapattıysa fan-made evrende başkası hikâye yazamaz", await K.evaluate(function () {
      const f = fanSiteListesi("evren")[0]; f.izinler = { hikaye: "sahip" };
      const r = !evaHikayeIzni(f.ad).izin && evaHikayeIzni("Tömye").izin; delete f.izinler; return r;
    }));
    await K.evaluate(function () { if (EVS) { evrenSayfaKapat(); } location.hash = "#/ev/benim/" + arguments[0]; }, evId); await bekle(K, 500);
    await K.evaluate(function (id) { EVS.sekme = "kurucu"; EVR_ADIM[id] = "paylas"; evrenSayfaCiz(); }, evId); await bekle(K, 300);
    await K.click('#evrenSayfa [data-eva-durum="kanonAday"]'); await bekle(K, 300);
    ok("Kurucu → Paylaş: evrenin yolu seçilir (kanona aday), rozet ve dosyada", await K.evaluate(function (id) {
      const e = evrenBenimBul(id);
      return e.durum === "kanonAday" && fanTemizle(e).durum === "kanonAday" && /kanona aday/.test(document.querySelector("#evrenSayfa .evs-rozet").textContent);
    }, evId));
    await K.evaluate(function () { evrenSayfaKapat(); location.hash = "#/atolye"; }); await bekle(K, 700);
    ok("Evren Atölyesi: yeni evren, kendi evrenlerin (Tömye ölçeği), kanon ve fan-made listeleri", await K.evaluate(function () {
      const a = document.querySelector("#evrenAtolyeAlan");
      return aktifSayfa === "atolye" && !!a.querySelector("[data-es-yeni]") && /Tuz Denizi/.test(a.textContent) && /Tömye ölçeği %/.test(a.textContent) &&
        a.querySelectorAll(".eva-rozet.kanon").length >= 3 && a.querySelectorAll("[data-eva-hikaye]").length >= 3;
    }));
    await K.click('#evrenAtolyeAlan [data-eva-hikaye="Tömye"]'); await bekle(K, 600);
    ok("kanon evrende hikâye yaz: yeni hikâye evreni seçili açılır", await K.evaluate(function () {
      const h = fanDuzenlenen("hikaye"); return aktifSayfa === "fan" && !!h && h.evren === "Tömye" && /Kanon evren/.test((document.querySelector(".eva-not") || {}).textContent || "");
    }));

    /* ---------- 11. menüde Android uygulaması ---------- */
    const AN = await cihaz("android", { ctx: { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36" } });
    await AN.route("**/uygulama/indir/apk.json", function (r) { return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ kod: 142, surum: "2.9.0", boyut: 5242880 }) }); });
    await AN.goto(adres + "/"); await AN.waitForFunction(veriVar, null, { timeout: 20000 }); await bekle(AN, 400);
    await AN.click("[data-mobil-menu]"); await bekle(AN, 600);
    ok("Android'de menü sitenin APK'sını indirir (Chrome kısayolu değil)", await AN.evaluate(function () {
      const a = document.querySelector("#mobilMenu [data-apk-indir]");
      return !!a && /\/uygulama\/indir\/tentiforapp\.apk\?v=142$/.test(a.getAttribute("href")) && /2\.9\.0/.test(a.textContent) && /5\.0 MB/.test(a.textContent) && !document.querySelector("#mobilMenu [data-mobil-yukle]");
    }));

    ok("3.0 testlerinde sayfa hatası yok", hatalar.length === 0, hatalar);
  } finally {
    if (ayriSunucu) { ayriSunucu.close(); }
    try { rmSync(ayriDizin, { recursive: true, force: true }); } catch (_) { /* yok */ }
    await tarayici.close();
    await sahte.pool.end().catch(function () { /* kapalı */ });
  }
  return gecen;
}
