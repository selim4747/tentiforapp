/* Yayın paketi: siteyi dist/ klasörüne kopyalar, her JS ve CSS dosyasını ayrı ayrı küçültür,
   her sayfa için paylaşım önizlemeli kısa adres (/dunya/ gibi) üretir ve servis çalışanının
   önbellek adını içeriğe göre günceller. Dosyalar ayrı kaldığı için davranış değişmez.

   Kullanım: npm run paketle   (Netlify bunu kendisi çalıştırır) */

import { transform } from "esbuild";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KOK = new URL("..", import.meta.url).pathname;
const HEDEF = join(KOK, "dist");
/* Sitenin kalıcı adresi: SITE_URL (Cloudflare Pages vb. için elle), yoksa Netlify'ın URL'i. */
const SITE = (process.env.SITE_URL || process.env.URL || "https://tentifor.netlify.app").replace(/\/$/, "");
const KOPYALA = ["index.html", "veri.json", "sw.js", "manifest.webmanifest", "paylasim.png", "robots.txt", "_headers", "css", "js", "ikon"];

rmSync(HEDEF, { recursive: true, force: true });
mkdirSync(HEDEF, { recursive: true });
for (const ad of KOPYALA) {
  try { statSync(join(KOK, ad)); } catch { continue; }
  cpSync(join(KOK, ad), join(HEDEF, ad), { recursive: true });
}

/* Yönlendirmeler: Netlify netlify.toml'u, Cloudflare Pages ve diğerleri _redirects dosyasını okur. */
writeFileSync(join(HEDEF, "_redirects"),
  "# Profil kısa adresi: /u/kullaniciadi\n/u/*  /?profil=:splat  302\n" +
  "# Paylaşım hedefi: servis çalışanı yoksa sayfaya dön\n/paylasim-al  /#/fanAc  303\n");

/* Panelin kurulum yardımcısı (js/43-kurulum.js) telefondan kopyalayabilsin diye; gizli bilgi içermezler. */
mkdirSync(join(HEDEF, "kurulum"), { recursive: true });
cpSync(join(KOK, "supabase/kurulum.sql"), join(HEDEF, "kurulum/kurulum.sql"));
cpSync(join(KOK, "supabase/functions/bildirim-gonder/index.ts"), join(HEDEF, "kurulum/bildirim-gonder.ts"));

const ozet = createHash("sha256");
let once = 0, sonra = 0;

/* JS: her dosya kendi başına küçültülür. Düz betik olarak kalır; üst düzey adlar
   (dosyalar arası paylaşılan fonksiyonlar) değişmez. */
for (const ad of readdirSync(join(HEDEF, "js"))) {
  if (!ad.endsWith(".js")) { continue; }
  const yol = join(HEDEF, "js", ad);
  const kaynak = readFileSync(yol, "utf8");
  const { code } = await transform(kaynak, { loader: "js", minify: true, target: "es2019", charset: "utf8", legalComments: "none" });
  writeFileSync(yol, code);
  once += Buffer.byteLength(kaynak); sonra += Buffer.byteLength(code);
  ozet.update(code);
}

for (const ad of readdirSync(join(HEDEF, "css"))) {
  if (!ad.endsWith(".css")) { continue; }
  const yol = join(HEDEF, "css", ad);
  const kaynak = readFileSync(yol, "utf8");
  const { code } = await transform(kaynak, { loader: "css", minify: true, charset: "utf8" });
  writeFileSync(yol, code);
  once += Buffer.byteLength(kaynak); sonra += Buffer.byteLength(code);
  ozet.update(code);
}
ozet.update(readFileSync(join(HEDEF, "index.html")));
ozet.update(readFileSync(join(HEDEF, "veri.json")));

/* veri.json: boşluksuz (panel GitHub'a biçimli kaydeder; yayında gerek yok) */
const veriYol = join(HEDEF, "veri.json");
writeFileSync(veriYol, JSON.stringify(JSON.parse(readFileSync(veriYol, "utf8"))));

/* sürümlü adresler: js/css adreslerine içerik özeti eklenir; _headers bunları bir yıl önbellekte tutar.
   index.html her açılışta tazelenir (no-cache), yani eski bir adres asla istenmez. */
const surum = function (yol) {
  return createHash("sha256").update(readFileSync(join(HEDEF, yol))).digest("hex").slice(0, 10);
};
const surumle = function (metin) {
  return metin.replace(/((?:js|css)\/[A-Za-z0-9._\/-]+\.(?:js|css))(?=["'])/g, function (tam, yol) {
    if (yol.indexOf("js/vendor/") === 0) { return yol; }   /* adında sürüm var, lazy yüklenir */
    try { return yol + "?v=" + surum(yol); } catch (e) { return yol; }
  });
};
const anaYol = join(HEDEF, "index.html");
writeFileSync(anaYol, surumle(readFileSync(anaYol, "utf8")));

/* servis çalışanı: aynı sürümlü adresleri önceden indirir; yeni paket = yeni önbellek adı */
const sw = join(HEDEF, "sw.js");
writeFileSync(sw, surumle(readFileSync(sw, "utf8")).replace(/tentiforapp-[^"]+"/, "tentiforapp-" + ozet.digest("hex").slice(0, 12) + '"'));

/* paylaşım adresleri: /dunya/ → önizleme etiketleri + #/dunya'ya yönlendirme */
const gez = readFileSync(join(KOK, "js/18-dalga-7-gezinme.js"), "utf8");
const blok = gez.slice(gez.indexOf("const GEZINME"), gez.indexOf("];", gez.indexOf("const GEZINME")));
const sayfalar = [...blok.matchAll(/\{\s*id:\s*"([^"]+)",\s*ad:\s*"([^"]+)"[\s\S]*?bolumler:\s*\[([\s\S]*?)\]\s*\}/g)]
  .map(function (m) {
    return { id: m[1], ad: m[2], bolumler: [...m[3].matchAll(/\[\s*"[^"]+",\s*"([^"]+)"\s*\]/g)].map(function (b) { return b[1]; }) };
  });
if (sayfalar.length < 5) { throw new Error("Sayfa listesi okunamadı (" + sayfalar.length + ")"); }

const kacir = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };
for (const s of sayfalar) {
  const baslik = "TentiforApp — " + s.ad;
  const aciklama = s.bolumler.join(", ") + ". Tentiforverse evren arşivi.";
  mkdirSync(join(HEDEF, s.id), { recursive: true });
  writeFileSync(join(HEDEF, s.id, "index.html"), `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${kacir(baslik)}</title>
<meta name="description" content="${kacir(aciklama)}">
<link rel="canonical" href="${SITE}/${s.id}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TentiforApp">
<meta property="og:title" content="${kacir(baslik)}">
<meta property="og:description" content="${kacir(aciklama)}">
<meta property="og:url" content="${SITE}/${s.id}/">
<meta property="og:image" content="${SITE}/paylasim.png">
<meta property="og:locale" content="tr_TR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${kacir(baslik)}">
<meta name="twitter:description" content="${kacir(aciklama)}">
<meta name="twitter:image" content="${SITE}/paylasim.png">
<meta http-equiv="refresh" content="0; url=/#/${s.id}">
<script>location.replace("/#/${s.id}" + (location.hash ? "/" + location.hash.replace(/^#\\/?/, "") : ""));</script>
</head><body><p><a href="/#/${s.id}">${kacir(baslik)}</a></p></body></html>
`);
}

console.log("Paket hazır: " + sayfalar.length + " sayfa adresi, JS+CSS " +
  Math.round(once / 1024) + " KB → " + Math.round(sonra / 1024) + " KB");
