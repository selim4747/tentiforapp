/* Bütün testler: npm test
   Gerekenler: PostgreSQL (psql komutu dahil) ve Playwright'ın Chromium'u.
   Bağlantı PGHOST / PGPORT / PGUSER / PGPASSWORD ortam değişkenlerinden okunur.
   Sıra: veritabanını sıfırdan kur → kurulum.sql'i iki kez çalıştır (tekrar çalıştırılabilir mi?)
         → veritabanı testleri → yayın paketini üret → paketi tarayıcıda test et. */

import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { tarayiciTestleri } from "./tarayici.mjs";
import { bildirimFonksiyonTestleri } from "./bildirim-fonksiyonu.mjs";
import { cevrimdisiTestleri } from "./cevrimdisi.mjs";
import { surum25Testleri } from "./surum-25.mjs";
import { sunucuYukuTestleri } from "./sunucu-yuku.mjs";
import { surum26Testleri } from "./surum-26.mjs";
import { uygulamaKabuguTestleri } from "./uygulama-kabugu.mjs";
import { surum27Testleri } from "./surum-27.mjs";
import { surum28Testleri } from "./surum-28.mjs";
import { surum30Testleri } from "./surum-30.mjs";
import { surum31Testleri } from "./surum-31.mjs";

const KOK = new URL("..", import.meta.url).pathname;

/* Tek takım çalıştırmak için: TAKIM=s31 npm test  ya da  npm run test:takim -- s31,tarayici
   Takımlar: vt, fonksiyon, tarayici, cevrimdisi, s25, yuk, s26, s27, s28, s30, s31, kabuk. Boşsa hepsi. */
const TAKIMLAR = ["vt", "fonksiyon", "tarayici", "cevrimdisi", "s25", "yuk", "s26", "s27", "s28", "s30", "s31", "kabuk"];
const SECILI = (process.env.TAKIM || process.argv.slice(2).join(",")).split(",").map(function (x) { return x.trim(); }).filter(Boolean);
SECILI.forEach(function (t) { if (TAKIMLAR.indexOf(t) === -1) { console.error("Bilinmeyen takım: " + t + " (seçenekler: " + TAKIMLAR.join(", ") + ")"); process.exit(2); } });
const calis = function (t) { return !SECILI.length || SECILI.indexOf(t) !== -1; };
if (SECILI.length) { console.log("Yalnızca: " + SECILI.join(", ")); }
const DB = process.env.TEST_DB || "tentifor_test";

function psql(veritabani, argumanlar) {
  return execFileSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", veritabani].concat(argumanlar),
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function adim(ad, fn) {
  process.stdout.write("• " + ad + "\n");
  try { return fn(); } catch (e) {
    console.error((e.stderr || "") + (e.stdout || "") + (e.message || e));
    process.exit(1);
  }
}

/* Betikler aynı küresel alanı paylaşır: iki dosyada aynı üst düzey ad sessizce birbirini ezer
   (fonksiyon) ya da ikinci dosyayı hiç çalıştırmaz (let/const). */
adim("üst düzey ad çakışması", function () {
  const ad = {}, cakisan = [];
  const dosyalar = readFileSync(join(KOK, "index.html"), "utf8").match(/js\/(?!vendor\/)[^"?]+\.js/g);
  for (const f of dosyalar) {
    const s = readFileSync(join(KOK, f), "utf8");
    for (const m of s.matchAll(/^(?:let|const|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (ad[m[1]] && ad[m[1]] !== f) { cakisan.push(m[1] + " (" + ad[m[1]] + " / " + f + ")"); } else { ad[m[1]] = f; }
    }
  }
  if (cakisan.length) { throw new Error("Aynı ad iki dosyada: " + cakisan.join(", ")); }
  console.log("  " + Object.keys(ad).length + " üst düzey ad, çakışma yok");
});

/* 4.1: index.html'deki her betik dosyası var ve bağımlılık sırası doğru: çekirdek (core) önce, 4.0 modülleri
   (supabase → state → auth → odeme) motor, stüdyo ve yönetim modüllerinden önce; hepsi eski dosyalardan sonra */
adim("betik bloğu: dosyalar ve sıra", function () {
  const l = [...readFileSync(join(KOK, "index.html"), "utf8").matchAll(/<script src="(js\/[^"?]+)"/g)].map(function (m) { return m[1]; });
  const eksik = l.filter(function (f) { try { statSync(join(KOK, f)); return false; } catch (_) { return true; } });
  if (eksik.length) { throw new Error("index.html'de olmayan dosya: " + eksik.join(", ")); }
  const sira = ["js/core/00-rota.js", "js/core/supabase.js", "js/core/state.js", "js/core/auth.js", "js/core/odeme.js", "js/engine/evren-motoru.js", "js/studio/editor.js", "js/studio/paketleyici.js", "js/admin/moderasyon.js"];
  const yer = sira.map(function (f) { return l.indexOf(f); });
  if (yer.some(function (i) { return i === -1; }) || yer.some(function (i, k) { return k && i < yer[k - 1]; })) { throw new Error("betik sırası bozuk: " + sira.join(" → ")); }
  const sonEski = Math.max.apply(null, l.map(function (f, i) { return /\/\d/.test(f) && !/24-arsiv-mantigi/.test(f) ? i : -1; }));
  if (sonEski > l.indexOf("js/core/supabase.js")) { throw new Error("4.0 modülleri eski dosyalardan sonra yüklenmeli"); }
  console.log("  " + l.length + " betik, hepsi var, sıra doğru");
});

adim("veritabanı sıfırlanıyor", function () {
  psql("postgres", ["-c", "drop database if exists " + DB, "-c", "create database " + DB]);
  psql(DB, ["-c", "create extension if not exists pgcrypto"]);
  psql(DB, ["-f", join(KOK, "tests/auth-taklidi.sql")]);
});
adim("kurulum.sql (1. kez)", function () { psql(DB, ["-f", join(KOK, "supabase/kurulum.sql")]); });
adim("kurulum.sql (2. kez, tekrar çalıştırılabilir olmalı)", function () { psql(DB, ["-f", join(KOK, "supabase/kurulum.sql")]); });
if (calis("vt")) adim("veritabanı testleri", function () {
  const cikti = execFileSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-d", DB, "-f", join(KOK, "tests/veritabani.sql")],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  void cikti;
});
/* notice'ları ayrıca göstermek yerine sayıyı raporla */
const sqlSayisi = calis("vt") ? (readFileSync(join(KOK, "tests/veritabani.sql"), "utf8").match(/test\.ok\(/g) || []).length : 0;
if (calis("vt")) { console.log("  " + sqlSayisi + " veritabanı kontrolü geçti"); }

/* test için temiz veritabanı: tarayıcı testleri kendi kullanıcılarını açar */
adim("tarayıcı testleri için veritabanı", function () {
  psql("postgres", ["-c", "drop database if exists " + DB + "_e2e", "-c", "create database " + DB + "_e2e"]);
  psql(DB + "_e2e", ["-c", "create extension if not exists pgcrypto"]);
  psql(DB + "_e2e", ["-f", join(KOK, "tests/auth-taklidi.sql")]);
  psql(DB + "_e2e", ["-f", join(KOK, "supabase/kurulum.sql")]);
});

adim("yayın paketi", function () { execFileSync("node", [join(KOK, "scripts/paketle.mjs")], { stdio: "inherit" }); });

const DIZIN = join(KOK, "dist");
const TURLER = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".txt": "text/plain" };
const sunucu = createServer(function (istek, yanit) {
  let yol = decodeURIComponent(new URL(istek.url, "http://x").pathname);
  if (yol.endsWith("/")) { yol += "index.html"; }
  const dosya = join(DIZIN, yol);
  if (!dosya.startsWith(DIZIN)) { yanit.writeHead(403); yanit.end(); return; }
  try {
    if (statSync(dosya).isDirectory()) { yanit.writeHead(301, { Location: yol + "/" }); yanit.end(); return; }
    yanit.writeHead(200, { "Content-Type": TURLER[extname(dosya)] || "application/octet-stream" });
    yanit.end(readFileSync(dosya));
  } catch (e) {
    /* Cloudflare Pages gibi: uzantısız bilinmeyen yollarda ana sayfa (rota yoldan okunur) */
    if (!extname(yol)) { yanit.writeHead(200, { "Content-Type": TURLER[".html"] }); yanit.end(readFileSync(join(DIZIN, "index.html"))); return; }
    yanit.writeHead(404); yanit.end("yok");
  }
});
await new Promise(function (r) { sunucu.listen(0, "127.0.0.1", r); });
const adres = "http://127.0.0.1:" + sunucu.address().port;

const ortak = { adres, veritabani: DB + "_e2e", dizin: DIZIN };
const TAKIM_ISLERI = [
  ["fonksiyon", "bildirim fonksiyonu (Edge Function)", function () { return bildirimFonksiyonTestleri(KOK); }],
  ["tarayici", "tarayıcı testleri (" + adres + ")", function () { return tarayiciTestleri(ortak); }],
  ["cevrimdisi", "çevrimdışı (service worker)", function () { return cevrimdisiTestleri({ dizin: DIZIN }); }],
  ["s25", "sürüm 2.5", function () { return surum25Testleri(ortak); }],
  ["yuk", "sunucu yükü", function () { return sunucuYukuTestleri(ortak); }],
  ["s26", "sürüm 2.6", function () { return surum26Testleri(ortak); }],
  ["s27", "sürüm 2.7", function () { return surum27Testleri(Object.assign({ kok: KOK }, ortak)); }],
  ["s28", "sürüm 2.8", function () { return surum28Testleri(ortak); }],
  ["s30", "sürüm 3.0", function () { return surum30Testleri(Object.assign({ kok: KOK }, ortak)); }],
  ["s31", "sürüm 3.1 ve 4.0", function () { return surum31Testleri(ortak); }],
  ["kabuk", "Android uygulama kabuğu", function () { return uygulamaKabuguTestleri({ dizin: DIZIN }); }]
];
try {
  const say = { fonksiyon: 0, tarayici: 0, cevrimdisi: 0 };
  for (const [ad, baslik, fn] of TAKIM_ISLERI) {
    if (!calis(ad)) { continue; }
    console.log("• " + baslik);
    const n = await fn();
    if (ad === "fonksiyon" || ad === "cevrimdisi") { say[ad] += n; } else { say.tarayici += n; }
  }
  console.log("\n" + (SECILI.length ? "Seçilen takımlar geçti: " : "Hepsi geçti: ") + sqlSayisi + " veritabanı + " + say.fonksiyon + " fonksiyon + " + say.tarayici + " tarayıcı + " + say.cevrimdisi + " çevrimdışı kontrolü.");
} catch (e) {
  console.error("\n" + (e.stack || e.message || e));
  process.exitCode = 1;
} finally {
  sunucu.close();
}
