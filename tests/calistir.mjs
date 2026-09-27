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

const KOK = new URL("..", import.meta.url).pathname;
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
  const dosyalar = readFileSync(join(KOK, "index.html"), "utf8").match(/js\/[0-9][^"?]+\.js/g);
  for (const f of dosyalar) {
    const s = readFileSync(join(KOK, f), "utf8");
    for (const m of s.matchAll(/^(?:let|const|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (ad[m[1]] && ad[m[1]] !== f) { cakisan.push(m[1] + " (" + ad[m[1]] + " / " + f + ")"); } else { ad[m[1]] = f; }
    }
  }
  if (cakisan.length) { throw new Error("Aynı ad iki dosyada: " + cakisan.join(", ")); }
  console.log("  " + Object.keys(ad).length + " üst düzey ad, çakışma yok");
});

adim("veritabanı sıfırlanıyor", function () {
  psql("postgres", ["-c", "drop database if exists " + DB, "-c", "create database " + DB]);
  psql(DB, ["-c", "create extension if not exists pgcrypto"]);
  psql(DB, ["-f", join(KOK, "tests/auth-taklidi.sql")]);
});
adim("kurulum.sql (1. kez)", function () { psql(DB, ["-f", join(KOK, "supabase/kurulum.sql")]); });
adim("kurulum.sql (2. kez, tekrar çalıştırılabilir olmalı)", function () { psql(DB, ["-f", join(KOK, "supabase/kurulum.sql")]); });
adim("veritabanı testleri", function () {
  const cikti = execFileSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-d", DB, "-f", join(KOK, "tests/veritabani.sql")],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  void cikti;
});
/* notice'ları ayrıca göstermek yerine sayıyı raporla */
const sqlSayisi = (readFileSync(join(KOK, "tests/veritabani.sql"), "utf8").match(/test\.ok\(/g) || []).length;
console.log("  " + sqlSayisi + " veritabanı kontrolü geçti");

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

console.log("• bildirim fonksiyonu (Edge Function)");
try {
  const f = await bildirimFonksiyonTestleri(KOK);
  console.log("• tarayıcı testleri (" + adres + ")");
  const n = await tarayiciTestleri({ adres, veritabani: DB + "_e2e", dizin: DIZIN });
  console.log("• çevrimdışı (service worker)");
  const c = await cevrimdisiTestleri({ dizin: DIZIN });
  console.log("\nHepsi geçti: " + sqlSayisi + " veritabanı + " + f + " fonksiyon + " + n + " tarayıcı + " + c + " çevrimdışı kontrolü.");
} catch (e) {
  console.error("\n" + (e.stack || e.message || e));
  process.exitCode = 1;
} finally {
  sunucu.close();
}
