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
          Browser: { open: async function (o) { window.__acilan.push(o.url); } },
          Share: { share: async function (x) { window.__paylasilan = x; } },
          Filesystem: { writeFile: async function (o) { window.__yazilan = o; return { uri: "file:///cache/" + o.path }; } },
          Haptics: { vibrate: async function (o) { window.__titrek = o; } },
          TextToSpeech: { speak: async function (o) { (window.__konusulan = window.__konusulan || []).push(o); }, stop: async function () { window.__sustu = true; } },
          LocalNotifications: {
            checkPermissions: async function () { return { display: "granted" }; }, requestPermissions: async function () { return { display: "granted" }; },
            schedule: async function (o) { window.__kurulan = o.notifications; }, cancel: async function (o) { window.__iptal = o.notifications; },
            addListener: function () { return { remove: function () {} }; } },
          App: { getInfo: async function () { return { build: String(build), version: "2.5.0" }; },
            exitApp: function () { window.__cikti = true; },
            addListener: function (ad, f) { (window.__dinle = window.__dinle || {})[ad] = f; return { remove: function () {} }; } } } };
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
    ok("sesli okuma telefonun sesiyle (sırayla, iptal edilebilir)", await P.evaluate(async function () {
      sesliOku("Merhaba Tömye"); await new Promise(function (c) { setTimeout(c, 50); });
      const k = window.__konusulan || [];
      return sesliDestek() && k.length === 1 && k[0].text === "Merhaba Tömye" && k[0].lang === "tr-TR";
    }));
    ok("indirme: dosya kaydedilir, Kaydet/Paylaş menüsü açılır", await P.evaluate(async function () {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["deneme"], { type: "text/plain" })); a.download = "not.txt";
      a.click(); URL.revokeObjectURL(a.href);
      await new Promise(function (c) { setTimeout(c, 300); });
      return !!window.__yazilan && window.__yazilan.path === "not.txt" && atob(window.__yazilan.data) === "deneme" &&
        window.__paylasilan && (window.__paylasilan.files || [])[0] === "file:///cache/not.txt";
    }));
    const bg = await P.evaluate(function () {
      window.__acilan = [];
      const d = document.createElement("a"); d.href = "https://ornek.com/x"; d.target = "_blank"; d.textContent = "d"; document.body.appendChild(d);
      d.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      const i = document.createElement("a"); i.href = "#/sen"; i.target = "_blank"; document.body.appendChild(i);
      i.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      d.remove(); i.remove();
      return window.__acilan.length === 1 && window.__acilan[0] === "https://ornek.com/x" || JSON.stringify([window.__acilan, location.hash]);
    });
    ok("başka siteye bağlantı telefonun tarayıcısında, aynı sitenin bağlantısı uygulamada kalır", bg === true, bg);
    ok("titreşim telefonun motoruyla", await P.evaluate(function () { TentiforKopru.titret(20); return window.__titrek && window.__titrek.duration === 20; }));
    ok("e-posta dönüşü uygulamayı açan adrese", await P.evaluate(function () { return /\/uygulama\/ac\/\?hesap=onay$/.test(hesapDonusAdresi("onay")); }));
    const geri = await P.evaluate(async function () {
      const r = [];
      const pd = document.querySelector("#perde"); pd.innerHTML = '<div class="pencere"><p>x</p></div>'; pd.hidden = false; r.push(kabukGeri(true), !document.querySelector("#perde").hidden);
      location.hash = "#/sen"; await new Promise(function (c) { setTimeout(c, 100); });
      r.push(kabukGeri(false)); await new Promise(function (c) { setTimeout(c, 100); }); r.push(rota());
      r.push(kabukGeri(false), kabukGeri(false), !!window.__cikti);
      return r;
    });
    ok("geri tuşu: önce pencere, sonra sayfa, ana sayfada iki basışta çıkış", geri[0] === "kapat" && geri[1] === false && geri[2] === "geri" && (geri[3] === "" || geri[3] === "#/") && geri[4] === "uyar" && geri[5] === "cik" && geri[6] === true, geri);
    ok("geri tuşu dinleniyor", await P.evaluate(function () { return typeof (window.__dinle || {}).backButton === "function" && typeof window.__dinle.appUrlOpen === "function"; }));
    const hat = await P.evaluate(async function () {
      const h = await gunlukKontrolKaydet(true);
      const ilk = (window.__kurulan || []).length;
      window.__kurulan = null;
      await swAyarEsitle({ oynanan: koGun() }); await new Promise(function (c) { setTimeout(c, 100); });
      const sonra = window.__kurulan;
      return { h: h, ilk: ilk, bugunYok: !sonra || !sonra.some(function (n) { return n.id === 7100; }), saat: ((window.__kurulan || [])[0] || {}).schedule };
    });
    ok("günün kelimesi hatırlatması telefon bildirimiyle (7 gün, oynanınca o gün susar)", hat.h === "" && hat.ilk >= 6 && hat.bugunYok, hat);
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
