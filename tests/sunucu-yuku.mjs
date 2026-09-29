/* Sunucu yükünü azaltan değişikliklerin testleri (2.5): sayaçlar tek istekte, okuma önbelleği ve yazmada boşalması,
   aynı hatanın bir kez gönderilmesi, seyrek eşitleme. tests/calistir.mjs çağırır. */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { yeniSahte } = require("./supabase-taklidi.cjs");
const TEST_URL = "https://test.supabase.co";

export async function sunucuYukuTestleri({ adres, veritabani, dizin }) {
  const sahte = yeniSahte(veritabani);
  let gecen = 0;
  const ok = function (ad, kosul, ek) {
    if (!kosul) { throw new Error("BAŞARISIZ: " + ad + (ek !== undefined ? " → " + JSON.stringify(ek) : "")); }
    gecen++; console.log("  tamam: " + ad);
  };
  const tarayici = await chromium.launch(process.env.CHROMIUM_YOLU ? { executablePath: process.env.CHROMIUM_YOLU } : {});
  const istekler = [];
  const hatalar = [];
  try {
    const ctx = await tarayici.newContext({ serviceWorkers: "block" });
    await ctx.addInitScript(function () {
      try { localStorage.setItem("tentiforapp_tur", "bitti"); localStorage.setItem("tentiforapp_baslangic_oto", "kapali"); localStorage.setItem("tentiforapp_hesap_hatirlat", JSON.stringify({ kapat: true })); } catch (e) { /* yok */ }
      window.__olayTest = true; window.__hataYereldeGonder = true;
    });
    await ctx.route(/\/js\/(?:core\/28-hesap|paket-\d+)\.js(\?|$)/, function (r) { return r.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(dizin + new URL(r.request().url()).pathname, "utf8").replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, TEST_URL) }); });
    await ctx.route(TEST_URL + "/**", function (r) { istekler.push(r.request().method() + " " + new URL(r.request().url()).pathname); return sahte.isle(r); });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, function (r) { return r.abort(); });
    const p = await ctx.newPage();
    p.on("pageerror", function (e) { hatalar.push(e.message); });
    const bekle = function (ms) { return p.waitForTimeout(ms || 600); };
    await p.goto(adres + "/"); await bekle(2000);

    /* sayaçlar */
    istekler.length = 0;
    await p.evaluate(function () { olaySay("yuk_test_a", true); olaySay("yuk_test_b", true); sayacEkle({ tur: "evren", evren: "ev:yuktest", ad: "ziyaret" }); });
    await bekle(800);
    const toplu = istekler.filter(function (x) { return /rpc\/sayac_toplu$/.test(x); }).length;
    const tek = istekler.filter(function (x) { return /rpc\/(olay_say|evren_say)$/.test(x); }).length;
    ok("sayaçlar tek istekte gider", toplu === 1 && tek === 0, istekler);
    const say = (await sahte.kokSorgu("select coalesce(sum(sayi),0)::int n from public.olay_sayaclari where ad in ('yuk_test_a','yuk_test_b')")).rows[0].n;
    const esay = (await sahte.kokSorgu("select coalesce(sum(sayi),0)::int n from public.evren_sayaclari where evren = 'ev:yuktest'")).rows[0].n;
    ok("tek istekteki sayaçlar sunucuda sayılır", say === 2 && esay === 1, [say, esay]);

    /* aynı hata bir kez */
    istekler.length = 0;
    await p.evaluate(function () { hataGonder({ baslik: "Deneme", mesaj: "yinelenen hata" }); hataGonder({ baslik: "Deneme", mesaj: "yinelenen hata" }); hataGonder({ baslik: "Deneme", mesaj: "başka hata" }); });
    await bekle(600);
    ok("aynı hata oturumda bir kez gönderilir", istekler.filter(function (x) { return /rpc\/hata_kaydet$/.test(x); }).length === 2, istekler);

    /* okuma önbelleği (hesap istemcisi) */
    await p.evaluate(function () { return typeof hesapGerekli === "function" ? hesapGerekli() : null; }); await bekle(1500);
    ok("eşitleme 5 dakikada bir", await p.evaluate(function () { return ESIT_ARALIK === 300000; }));
    istekler.length = 0;
    const r1 = await p.evaluate(async function () {
      const a = await hesapIstemci.from("teori_listesi").select("*").limit(5);
      const b = await hesapIstemci.from("teori_listesi").select("*").limit(5);
      return [!a.error, !b.error, JSON.stringify(a.data) === JSON.stringify(b.data)];
    });
    await bekle(200);
    const oku1 = istekler.filter(function (x) { return /GET \/rest\/v1\/teori_listesi/.test(x); }).length;
    ok("aynı okuma 90 saniye içinde sunucuya bir kez gider, sonuç aynı", r1.every(Boolean) && oku1 === 1, [r1, istekler]);
    istekler.length = 0;
    await p.evaluate(async function () {
      await hesapIstemci.rpc("yapim_oyla", { p_yapim: "yazma_deneme" });   /* bir yazma (sayaçlar gibi eşitleme yazmaları önbelleği boşaltmaz) */
      await hesapIstemci.from("teori_listesi").select("*").limit(5);
    });
    ok("yazmadan sonra önbellek boşalır, okuma sunucudan gelir", istekler.filter(function (x) { return /GET \/rest\/v1\/teori_listesi/.test(x); }).length === 1, istekler);
    istekler.length = 0;
    await p.evaluate(async function () { await hesapIstemci.from("ilerlemeler").select("guncelleme").limit(1); await hesapIstemci.from("ilerlemeler").select("guncelleme").limit(1); });
    ok("ilerleme hiç önbelleğe girmez", istekler.filter(function (x) { return /\/rest\/v1\/ilerlemeler/.test(x); }).length === 2, istekler);
    ok("sunucu yükü testlerinde sayfa hatası yok", hatalar.length === 0, hatalar);
  } finally {
    await tarayici.close();
    await sahte.pool.end().catch(function () { /* kapalı */ });
  }
  return gecen;
}
