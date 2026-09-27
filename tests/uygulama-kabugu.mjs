/* Android uygulaması (Capacitor kabuğu) içindeki site davranışı: sahte bir Capacitor köprüsüyle.
   Yeni APK haberi, indirme, paylaşım, Google girişi açıklaması; tarayıcıda hiçbirinin görünmemesi. */

import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const require = createRequire(import.meta.url);

export async function uygulamaKabuguTestleri({ dizin }) {
  const { chromium } = require("playwright");
  const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
  const apk = { kod: 105, surum: "2.6.0", boyut: 4200000, not: "Yeni simge" };
  const sunucu = createServer(function (q, r) {
    let y = decodeURIComponent(new URL(q.url, "http://x").pathname);
    if (y === "/uygulama/indir/apk.json") { r.writeHead(200, { "Content-Type": "application/json" }); r.end(JSON.stringify(apk)); return; }
    if (y.endsWith("/")) { y += "index.html"; }
    try { const d = join(dizin, y); if (statSync(d).isDirectory()) { throw new Error("klasör"); } r.writeHead(200, { "Content-Type": T[extname(d)] || "application/octet-stream" }); r.end(readFileSync(d)); }
    catch (e) { r.writeHead(200, { "Content-Type": T[".html"] }); r.end(readFileSync(join(dizin, "index.html"))); }
  });
  await new Promise(function (c) { sunucu.listen(0, "127.0.0.1", c); });
  const adres = "http://127.0.0.1:" + sunucu.address().port;
  const tarayici = await chromium.launch(process.env.CHROMIUM_YOLU ? { executablePath: process.env.CHROMIUM_YOLU } : {});
  let sayi = 0;
  const ok = function (ad, kosul, ek) { if (!kosul) { throw new Error("BAŞARISIZ: " + ad + (ek !== undefined ? " → " + JSON.stringify(ek) : "")); } sayi++; console.log("  tamam: " + ad); };
  const hatalar = [];
  try {
    const sayfa = async function (kurulu) {
      const ctx = await tarayici.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: "block" });
      await ctx.route(/supabase\.co|fonts\./, function (r) { return r.abort(); });
      await ctx.addInitScript(function (build) {
        localStorage.setItem("tentiforapp_tur", "bitti"); localStorage.setItem("tentiforapp_baslangic_oto", "kapali");
        if (build === null) { return; }
        window.__acilan = []; window.__paylasilan = null;
        window.Capacitor = { isNativePlatform: function () { return true; }, Plugins: {
          App: { getInfo: async function () { return { build: String(build), version: "2.5.0" }; } },
          Browser: { open: async function (o) { window.__acilan.push(o.url); } },
          Share: { share: async function (x) { window.__paylasilan = x; } } } };
      }, kurulu);
      const p = await ctx.newPage();
      p.on("pageerror", function (e) { hatalar.push(e.message); });
      await p.goto(adres + "/"); await p.waitForTimeout(1800);
      return p;
    };
    /* eski APK kurulu: haber çıkar */
    const P = await sayfa(101);
    ok("uygulama içinde ortam 'capacitor' tanınır", await P.evaluate(function () { return TentiforKopru.ortam() === "capacitor" && document.documentElement.classList.contains("kabuk"); }));
    await P.evaluate(function () { return kabukGuncellemeBak(true); }); await P.waitForTimeout(300);
    ok("yeni APK sürümü haber verilir (sürüm, boyut, not)", await P.evaluate(function () {
      const d = document.querySelector("#kabukGuncelleme"); return !!d && /2\.6\.0/.test(d.textContent) && /4\.0 MB/.test(d.textContent) && /Yeni simge/.test(d.textContent);
    }));
    await P.click("#kabukGuncelleme [data-kabuk-indir]"); await P.waitForTimeout(200);
    ok("İndir, APK'yı telefonun tarayıcısında açar", await P.evaluate(function () { return window.__acilan.length === 1 && /\/uygulama\/indir\/tentiforapp\.apk\?v=105$/.test(window.__acilan[0]); }));
    ok("paylaşım telefonun paylaşım menüsünden", await P.evaluate(async function () { await TentiforKopru.paylas({ title: "T", url: "https://x/" }); return !!window.__paylasilan && window.__paylasilan.url === "https://x/"; }));
    ok("günde bir kez bakılır (zorlanmadan ikinci bakış yok)", await P.evaluate(async function () { document.querySelector("#kabukGuncelleme").remove(); const r = await kabukGuncellemeBak(false); return r === null && !document.querySelector("#kabukGuncelleme"); }));
    ok("Google girişi uygulamada açıklama gösterir", await P.evaluate(function () {
      const p = document.querySelector("#perde");
      p.innerHTML = '<div class="pencere"><button data-google-giris>Google</button></div>'; p.hidden = false;
      p.querySelector("[data-google-giris]").click();
      const t = (p.querySelector(".kabuk-google") || {}).textContent || "";
      p.hidden = true; p.innerHTML = "";
      return /e-postayla/.test(t);
    }));
    /* güncel APK kurulu: haber yok */
    const G = await sayfa(105);
    await G.evaluate(function () { return kabukGuncellemeBak(true); }); await G.waitForTimeout(300);
    ok("güncel APK kuruluysa haber yok", await G.evaluate(function () { return !document.querySelector("#kabukGuncelleme"); }));
    /* tarayıcıda: hiçbiri */
    const W = await sayfa(null);
    ok("tarayıcıda uygulama davranışı yok", await W.evaluate(async function () { const r = await kabukGuncellemeBak(true); return r === null && !document.documentElement.classList.contains("kabuk") && TentiforKopru.ortam() === "web"; }));
    ok("uygulama testlerinde sayfa hatası yok", hatalar.length === 0, hatalar);
  } finally { await tarayici.close(); sunucu.close(); }
  return sayi;
}
