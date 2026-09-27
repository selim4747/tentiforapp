/* Çevrimdışı deneyim: gerçek service worker ile yayın paketi (dist/).
   Öbür tarayıcı testleri service worker'ı kapatır; burada açık. tests/calistir.mjs çağırır. */

import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"));

const TURLER = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };

/** Kendi sunucusu: zayıf bağlantıyı sunucu tarafında taklit eder (service worker'ın isteklerine test aracının yönlendirmesi ulaşmaz). */
function sunucuKur(dizin, durum) {
  return createServer(function (istek, yanit) {
    /* internet yok: bağlantı kesilir (tarayıcının çevrimdışı ayarı service worker'ın isteklerini her zaman kesmiyor) */
    if (durum.kapali) { istek.socket.destroy(); return; }
    let yol = decodeURIComponent(new URL(istek.url, "http://x").pathname);
    if (yol.endsWith("/")) { yol += "index.html"; }
    const dosya = join(dizin, yol);
    const gonder = function () {
      try {
        if (!dosya.startsWith(dizin)) { throw new Error("dışarı"); }
        if (statSync(dosya).isDirectory()) { yanit.writeHead(301, { Location: yol + "/" }); yanit.end(); return; }
        yanit.writeHead(200, { "Content-Type": TURLER[extname(dosya)] || "application/octet-stream" });
        yanit.end(readFileSync(dosya));
      } catch (e) {
        if (!extname(yol)) { yanit.writeHead(200, { "Content-Type": TURLER[".html"] }); yanit.end(readFileSync(join(dizin, "index.html"))); return; }
        yanit.writeHead(404); yanit.end();
      }
    };
    const agir = durum.yavas && (/\.html$/.test(yol) || /\/veri\.json$/.test(yol));
    if (agir) { setTimeout(gonder, 12000); } else { gonder(); }
  });
}

export async function cevrimdisiTestleri({ dizin }) {
  const { chromium } = require("playwright");
  const durum = { yavas: false, kapali: false };
  const sunucu = sunucuKur(dizin, durum);
  await new Promise(function (r) { sunucu.listen(0, "127.0.0.1", r); });
  const adres = "http://127.0.0.1:" + sunucu.address().port;
  const tarayici = await chromium.launch(process.env.CHROMIUM_YOLU ? { executablePath: process.env.CHROMIUM_YOLU } : {});
  let sayi = 0;
  const ok = function (ad, kosul, ayrinti) {
    if (!kosul) { throw new Error("BAŞARISIZ: " + ad + (ayrinti !== undefined ? " — " + JSON.stringify(ayrinti) : "")); }
    sayi++;
    console.log("  tamam: " + ad);
  };
  const veriVar = function () { return typeof veri !== "undefined" && !!veri && !!veri.surum; };
  try {
    const ctx = await tarayici.newContext();
    await ctx.route(/(fonts\.(googleapis|gstatic)\.com|supabase\.co|jsdelivr)/, function (r) { return r.abort(); });
    const p = await ctx.newPage();
    const hatalar = [];
    p.on("pageerror", function (e) { hatalar.push(e.message); });
    p.on("console", function (m) {
      if (m.type() === "error" && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_FAILED|net::|fonts\.g/.test(m.text())) { hatalar.push("konsol: " + m.text()); }
    });

    await p.goto(adres + "/");
    await p.evaluate(function () { return navigator.serviceWorker.ready; });
    await p.reload(); await p.waitForFunction(veriVar, null, { timeout: 15000 });
    ok("service worker sayfayı denetler", await p.evaluate(function () { return !!navigator.serviceWorker.controller; }));
    ok("sürümlü dosyalar önceden önbellekte", await p.evaluate(async function () {
      const k = (await caches.keys()).find(function (x) { return /^tentiforapp-[0-9a-f]{12}$/.test(x); });
      const l = k ? (await (await caches.open(k)).keys()).map(function (r) { return r.url; }) : [];
      return l.some(function (u) { return /js\/74-surum-24\.js\?v=[0-9a-f]{10}$/.test(u); }) && l.some(function (u) { return /veri\.json$/.test(u); });
    }));

    durum.kapali = true; await ctx.setOffline(true);
    await p.reload(); await p.waitForFunction(veriVar, null, { timeout: 15000 });
    ok("internetsiz yeniden açılır, veri gelir", await p.evaluate(function () { return document.querySelectorAll("script").length > 50; }));
    ok("çevrimdışı şeridi görünür", await p.locator("#cevrimdisi").count() === 1);
    await p.goto(adres + "/oyunlar/"); await p.waitForFunction(veriVar, null, { timeout: 15000 });
    ok("hiç açılmamış sayfa da internetsiz açılır (rota yoldan)", await p.evaluate(function () { return rota().indexOf("#/oyunlar") === 0; }));
    durum.kapali = false; await ctx.setOffline(false);
    await p.waitForTimeout(400);
    ok("bağlantı gelince şerit kalkar", await p.locator("#cevrimdisi").count() === 0);

    /* zayıf bağlantı: ağ cevap vermiyor gibi; son kopya beklemeden gelir */
    durum.yavas = true;
    const bas = Date.now();
    await p.goto(adres + "/", { waitUntil: "domcontentloaded", timeout: 20000 });
    await p.waitForFunction(veriVar, null, { timeout: 20000 });
    const sure = Date.now() - bas;
    durum.yavas = false;
    /* en az sayfanın bekleme süresi (3,5 sn) geçer: gecikme gerçekten uygulandı; ama 12 sn beklenmez */
    ok("zayıf bağlantıda sayfa ve veri son kopyadan gelir (ağı 12 sn beklemez)", sure > 3000 && sure < 8000, sure);

    /* ---------- çevrimdışı senaryolar ---------- */
    const git = async function (yol) { await p.goto(adres + yol); await p.waitForFunction(veriVar, null, { timeout: 15000 }); await p.waitForTimeout(700); };
    /* 1. evreni internet varken cihaza indir, internetsiz aç */
    await git("/");
    const indir = await p.evaluate(async function () { return await evdCevrimdisiIndir("fornek-sis"); });
    ok("fan evreni cihaza indirilir", indir === "", indir);
    durum.kapali = true; await ctx.setOffline(true);
    await git("/evren/fornek-sis/");
    ok("indirilen evren internetsiz tam açılır", await p.evaluate(function () {
      return !!EVS && EVS.id === "fornek-sis" && !!EVD_BELLEK["fornek-sis"] && !document.querySelector("#evrenSayfa .evd-not.kotu");
    }), await p.evaluate(function () { return { evs: EVS && EVS.id, bellek: Object.keys(EVD_BELLEK), not: (document.querySelector("#evrenSayfa .evd-not") || {}).textContent }; }));
    await p.click('#evrenSayfa [data-evs-sekme="roman"]').catch(function () { /* yoksa geç */ }); await p.waitForTimeout(300);
    ok("indirilen evrenin romanı internetsiz okunur", await p.evaluate(function () { return !!document.querySelector("#evrenSayfa .evr-oku .okuma-metin"); }));
    /* 2. cihazda hiç olmayan evren: anlaşılır uyarı, çökme yok */
    await p.evaluate(async function () {
      for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) { if (/fornek-kul\.json/.test(r.url)) { await c.delete(r); } } }
    });
    await git("/evren/fornek-kul/");
    ok("indirilmemiş evren internetsiz açılınca anlaşılır uyarı", await p.evaluate(function () {
      const n = document.querySelector("#evrenSayfa .evd-not"); return !!n && /bağlantı|internet/i.test(n.textContent);
    }), await p.evaluate(async function () {
      const l = []; for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) { if (/evrenler\//.test(r.url)) { l.push(k + " " + r.url); } } }
      return { bellek: Object.keys(EVD_BELLEK), onbellek: l, not: (document.querySelector("#evrenSayfa .evd-not") || {}).textContent || null };
    }));
    /* 3. hiç açılmamış kanon sayfaları */
    await git("/evren/e25/");
    ok("hiç açılmamış kanon evren sayfası internetsiz açılır", await p.evaluate(function () { return !!EVS && EVS.id === "e25" && !!document.querySelector("#evrenSayfa .evs-govde"); }));
    await git("/claude/");
    ok("Claude'un Evreni internetsiz açılır", await p.evaluate(function () { return rota().indexOf("#/claude") === 0 && !!document.querySelector("#claudeEvrenAlan") && document.querySelector("#claudeEvrenAlan").textContent.length > 200; }));
    /* 4. kendi evreni: internetsiz kur, değiştir, sayfa yenilenince dursun; sürüm geçmişi çalışsın */
    await p.evaluate(function () { localStorage.setItem("tentiforapp_seviye_test", "20"); });
    await git("/");
    const eid = await p.evaluate(function () {
      const id = evrenYeniKur();
      evrenBenimDegistir(id, function (e) { e.ad = "Çevrimdışı Evren"; });
      GCM.son = {};
      evrenBenimDegistir(id, function (e) { e.ozet = "İnternetsiz yazıldı."; });
      return id;
    });
    await p.waitForTimeout(500);
    await git("/");
    ok("internetsiz kurulan evren yenileyince durur, geçmişi tutulur", await p.evaluate(async function (id) {
      const e = evrenBenimBul(id); const l = await gcmListe(id);
      return !!e && e.ad === "Çevrimdışı Evren" && e.ozet === "İnternetsiz yazıldı." && l.length >= 1;
    }, eid), await p.evaluate(async function (id) { const e = evrenBenimBul(id); return { id: id, var: !!e, ad: e && e.ad, ozet: e && e.ozet, gecmis: (await gcmListe(id)).length }; }, eid));
    /* 5. kod girişi internetsiz (sitenin kendi kodları) */
    ok("başlangıç kodu internetsiz girilir", await p.evaluate(function () {
      kodPenceresi(); kodDene("TNTF-BASLA");
      const d = document.querySelector("#kodDurum"); const t = d ? d.textContent : "";
      perdeKapat();
      return typeof bolumErisimi === "function" && bolumErisimi("arsiv") && !/sunucu/i.test(t);
    }), await p.evaluate(function () { return (document.querySelector("#kodDurum") || {}).textContent; }));
    /* 6. hesap düğmesi internetsiz: anlaşılır, çökmez */
    await p.waitForTimeout(2000);   /* kod penceresinin kendini kapatma zamanlayıcısı bitsin */
    await p.click("#hesapBtn"); await p.waitForTimeout(1500);
    ok("hesap penceresi internetsiz anlaşılır bir şey söyler", await p.evaluate(function () {
      const t = (document.querySelector("#perde") || {}).textContent || "";
      return /Çevrimdışısın/.test(t) && /internet gerekir/.test(t);
    }), await p.evaluate(function () { return { metin: ((document.querySelector("#perde") || {}).textContent || "").slice(0, 300), online: navigator.onLine, kut: !!(window.supabase && window.supabase.createClient), istemci: typeof hesapIstemci !== "undefined" && !!hesapIstemci, sarili: String(window.hesapPencere).slice(0, 80), perdeGizli: document.querySelector("#perde").hidden }; }));
    await p.evaluate(function () { if (typeof perdeKapat === "function") { perdeKapat(); } });
    /* 7. internetsizken okuma ve oyun ilerlemesi cihazda kalır */
    const once = await p.evaluate(function () { return cuzdan.acilan.length; });
    await p.evaluate(function () { okunduIsaretle("zaman:cd-test"); });
    await git("/oyunlar/");
    ok("internetsiz kazanılan ilerleme yenileyince durur", await p.evaluate(function (n) { return cuzdan.acilan.length === n + 1 && okunduMu("zaman:cd-test"); }, once));
    durum.kapali = false; await ctx.setOffline(false); await p.waitForTimeout(500);
    /* ---------- ek kaynak indirme ---------- */
    /* 1. service worker'ın önceden indirdiği her dosya pakette var (biri eksikse kurulum bütünüyle düşer) */
    const ilk = await p.evaluate(async function () {
      const y = await (await fetch("/sw.js", { cache: "no-store" })).text();
      const m = /const ILK = (\[[^\]]*\])/.exec(y);
      const l = m ? JSON.parse(m[1]) : [];
      const eksik = [];
      for (const u of l) { const r = await fetch(new URL(u, location.origin + "/").href, { cache: "no-store" }); if (!r.ok) { eksik.push(u + " " + r.status); } }
      return { sayi: l.length, eksik: eksik };
    });
    ok("önceden indirilen bütün dosyalar pakette var", ilk.sayi > 70 && ilk.eksik.length === 0, ilk);
    /* 2. sonradan inen yönetici betikleri ve hesap kütüphanesi */
    await git("/");
    ok("yönetici betikleri sonradan iner", await p.evaluate(async function () { await yoneticiBetikleriYukle(); return yoneticiBetikleriHazir(); }));
    ok("hesap kütüphanesi sonradan iner", await p.evaluate(async function () { await hesapKutuphaneYukle(); return !!(window.supabase && window.supabase.createClient); }));
    ok("sonradan inen dosyalar da önbelleğe girer", await p.evaluate(async function () {
      const u = ["js/vendor/supabase-2.117.2.js", "js/25-panel-roman-ses-basin.js", "js/43-kurulum.js"];
      const var_ = [];
      for (const x of u) { const r = await caches.match(new URL(x, location.origin + "/").href, { ignoreSearch: true }); var_.push(!!r); }
      return var_.every(Boolean);
    }));
    /* 3. internetsizken: önbellekteki kütüphane iner, giriş formu açılır; önbellekte olmayan betik çökertmez */
    durum.kapali = true; await ctx.setOffline(true);
    await git("/");
    ok("internetsiz: önbellekteki hesap kütüphanesi yüklenir", await p.evaluate(async function () { await hesapKutuphaneYukle(); return !!window.supabase; }));
    ok("internetsiz: olmayan betik yüklenemeyince hata sayfaya taşmaz", await p.evaluate(async function () {
      try { await new Promise(function (c, r) { const s = document.createElement("script"); s.src = "js/yok-" + Date.now() + ".js"; s.onload = c; s.onerror = r; document.head.appendChild(s); }); return false; } catch (_) { return true; }
    }));
    /* 4. internetsizken "cihaza indir": anlaşılır Türkçe hata, çökme yok */
    const indirHata = await p.evaluate(async function () {
      let h = ""; try { h = await evdCevrimdisiIndir("fornek-kul"); } catch (e) { h = "FIRLATTI: " + e.message; }
      return h;
    });
    ok("internetsiz cihaza indir: anlaşılır uyarı", /internet|bağlan/i.test(indirHata) && !/FIRLATTI|Failed to fetch/.test(indirHata), indirHata);
    await p.evaluate(function () { location.hash = "#/fan"; kesifCiz(); }); await p.waitForTimeout(500);
    await p.evaluate(function () { kesif25Onizle("fornek-kul"); }); await p.waitForTimeout(500);
    ok("internetsizken sayfa kaymaz, pencere ekranın içinde açılır", await p.evaluate(function () {
      const r = document.querySelector("#perde .pencere").getBoundingClientRect();
      return getComputedStyle(document.documentElement).transform === "none" && getComputedStyle(document.body).position !== "fixed" &&
        r.top >= 0 && r.bottom <= innerHeight + 1 && document.documentElement.classList.contains("cevrimdisi-mod");
    }));
    await p.click("#perde [data-ko-indir]"); await p.waitForTimeout(800);
    ok("keşif önizlemesinde internetsiz indir: uyarı gösterilir", /internet|bağlan/i.test(await p.textContent("#koDurum")), await p.textContent("#koDurum"));
    await p.evaluate(function () { perdeKapat(); });
    /* 5. cihazdan kaldırmak internetsiz de çalışır */
    ok("internetsiz cihazdan kaldırılır", await p.evaluate(async function () {
      await evdCevrimdisiSil("fornek-sis");
      return !evdIndirilenler()["fornek-sis"] && !(await caches.match(new URL("evrenler/fornek-sis.json", location.origin + "/").href, { cacheName: "tf-evrenler" }));
    }));
    durum.kapali = false; await ctx.setOffline(false); await p.waitForTimeout(400);
    /* 6. sunucuda olmayan evren dosyası: anlaşılır uyarı */
    ok("sunucuda olmayan evren dosyası: anlaşılır uyarı", await p.evaluate(async function () {
      const oz = { tur: "evren", id: "yokevren", dosya: "evrenler/yokevren.json" };
      try { await evdYukle(oz); return false; } catch (e) { return /inemedi|404/.test(e.message); }
    }));

    ok("çevrimdışı testlerinde sayfa hatası yok", hatalar.length === 0, hatalar);
    await ctx.close();
  } finally {
    await tarayici.close();
    sunucu.closeAllConnections();
    sunucu.close();
  }
  return sayi;
}
