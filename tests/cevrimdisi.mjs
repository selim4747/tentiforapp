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
  const durum = { yavas: false };
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

    await p.goto(adres + "/");
    await p.evaluate(function () { return navigator.serviceWorker.ready; });
    await p.reload(); await p.waitForFunction(veriVar, null, { timeout: 15000 });
    ok("service worker sayfayı denetler", await p.evaluate(function () { return !!navigator.serviceWorker.controller; }));
    ok("sürümlü dosyalar önceden önbellekte", await p.evaluate(async function () {
      const k = (await caches.keys()).find(function (x) { return /^tentiforapp-[0-9a-f]{12}$/.test(x); });
      const l = k ? (await (await caches.open(k)).keys()).map(function (r) { return r.url; }) : [];
      return l.some(function (u) { return /js\/74-surum-24\.js\?v=[0-9a-f]{10}$/.test(u); }) && l.some(function (u) { return /veri\.json$/.test(u); });
    }));

    await ctx.setOffline(true);
    await p.reload(); await p.waitForFunction(veriVar, null, { timeout: 15000 });
    ok("internetsiz yeniden açılır, veri gelir", await p.evaluate(function () { return document.querySelectorAll("script").length > 50; }));
    ok("çevrimdışı şeridi görünür", await p.locator("#cevrimdisiSerit").count() === 1);
    await p.goto(adres + "/oyunlar/"); await p.waitForFunction(veriVar, null, { timeout: 15000 });
    ok("hiç açılmamış sayfa da internetsiz açılır (rota yoldan)", await p.evaluate(function () { return rota().indexOf("#/oyunlar") === 0; }));
    await ctx.setOffline(false);
    await p.waitForTimeout(400);
    ok("bağlantı gelince şerit kalkar", await p.locator("#cevrimdisiSerit").count() === 0);

    /* zayıf bağlantı: ağ cevap vermiyor gibi; son kopya beklemeden gelir */
    durum.yavas = true;
    const bas = Date.now();
    await p.goto(adres + "/", { waitUntil: "domcontentloaded", timeout: 20000 });
    await p.waitForFunction(veriVar, null, { timeout: 20000 });
    const sure = Date.now() - bas;
    durum.yavas = false;
    /* en az sayfanın bekleme süresi (3,5 sn) geçer: gecikme gerçekten uygulandı; ama 12 sn beklenmez */
    ok("zayıf bağlantıda sayfa ve veri son kopyadan gelir (ağı 12 sn beklemez)", sure > 3000 && sure < 8000, sure);
    ok("çevrimdışı testlerinde sayfa hatası yok", hatalar.length === 0, hatalar);
    await ctx.close();
  } finally {
    await tarayici.close();
    sunucu.closeAllConnections();
    sunucu.close();
  }
  return sayi;
}
