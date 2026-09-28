/* Yayın paketi: siteyi dist/ klasörüne kopyalar, her JS ve CSS dosyasını ayrı ayrı küçültür,
   her sayfa için paylaşım önizlemeli kısa adres (/dunya/ gibi) üretir ve servis çalışanının
   önbellek adını içeriğe göre günceller. Dosyalar ayrı kaldığı için davranış değişmez.

   Kullanım: npm run paketle   (Cloudflare Pages bunu kendisi çalıştırır) */

import { transform } from "esbuild";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KOK = new URL("..", import.meta.url).pathname;
const HEDEF = process.env.PAKET_HEDEF || join(KOK, "dist");   /* PAKET_HEDEF: testler başka klasöre de üretebilsin */
/* Sitenin kalıcı adresi: Cloudflare Pages'teki SITE_URL ortam değişkeni. */
const SITE = (process.env.SITE_URL || "https://tentiforapp.pages.dev").replace(/\/$/, "");
const KOPYALA = ["index.html", "veri.json", "sw.js", "manifest.webmanifest", "paylasim.png", "robots.txt", "_headers", "css", "js", "ikon", "yazitipi", "evrenler", ".well-known"];   /* .well-known/assetlinks.json: Play Store (TWA) uygulaması siteyle eşleşsin (uygulama/README.md) */
/* evrenler/: sitedeki fan evrenlerinin ayrı dosyaları (js/54-evren-dosyalari.js) */

rmSync(HEDEF, { recursive: true, force: true });
mkdirSync(HEDEF, { recursive: true });
for (const ad of KOPYALA) {
  try { statSync(join(KOK, ad)); } catch { continue; }
  cpSync(join(KOK, ad), join(HEDEF, ad), { recursive: true });
}

/* Android uygulaması: GitHub Actions'ın derlediği APK (uygulama/indir/) sitede /uygulama/indir/ adresinden iner */
try { statSync(join(KOK, "uygulama/indir/apk.json")); mkdirSync(join(HEDEF, "uygulama"), { recursive: true }); cpSync(join(KOK, "uygulama/indir"), join(HEDEF, "uygulama/indir"), { recursive: true }); } catch { /* henüz APK yok */ }

/* Android uygulamasının e-posta dönüş sayfası (/uygulama/ac/): bağlantı uygulamayı açar, yoksa siteye döner */
mkdirSync(join(HEDEF, "uygulama/ac"), { recursive: true });
cpSync(join(KOK, "uygulama/ac/index.html"), join(HEDEF, "uygulama/ac/index.html"));

/* Yönlendirmeler: Cloudflare Pages (ve benzerleri) _redirects dosyasını okur. */
writeFileSync(join(HEDEF, "_redirects"),
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

/* Yalnızca yöneticinin kullandığı betikler ziyaretçiye inmez: index.html'den ve servis çalışanının listesinden çıkar,
   panel açılınca js/65-yonetici-yukle.js yükler. (Tek dosyada birleştirmek denendi: satır içi çalışan kod tarayıcının
   akışlı derlemesini ve kod önbelleğini kullanamadığı için soğuk açılışta ~%5 yavaştı; ayrı dosyalar kaldı.) */
const YONETICI_BETIKLERI = ["js/22b-yonetici-araclari.js", "js/25-panel-roman-ses-basin.js", "js/43-kurulum.js"];
{
  const anaYol0 = join(HEDEF, "index.html");
  let ana = readFileSync(anaYol0, "utf8");
  YONETICI_BETIKLERI.forEach(function (y) { ana = ana.replace('<script src="' + y + '"></script>\n', "").replace('<script src="' + y + '"></script>', ""); });
  writeFileSync(anaYol0, ana);
  const swYol0 = join(HEDEF, "sw.js");
  let sw0 = readFileSync(swYol0, "utf8");
  YONETICI_BETIKLERI.forEach(function (y) { sw0 = sw0.replace('"' + y + '", ', ""); });
  writeFileSync(swYol0, sw0);
}

/* 3.0 — betik paketleri: ziyaretçinin 79 ayrı isteği birkaç dosyada birleşir (aynı sıra, aynı kod; her parça
   kendi satırında başlar). Her dosya ayrı küçültüldüğü ve sıra korunduğu için davranış aynı kalır; bunu
   tests/paketler.mjs birleşik ve ayrı sürümde bütün fonksiyonları karşılaştırarak denetler.
   Paket içindeki hata satırı hangi dosyaya ait: window.__PAKET__ tablosu (js/01-tanilama.js okur).
   PAKETSIZ=1 ile eski düzen (her dosya ayrı) üretilir. */
/* panel betiklerinin yükleyicisi paketin içine girmeden önce sürümlü adresleri alır */
{
  const yukleYol = join(HEDEF, "js/65-yonetici-yukle.js");
  writeFileSync(yukleYol, readFileSync(yukleYol, "utf8").replace(/(js\/[A-Za-z0-9._\/-]+\.js)(?=["'])/g, function (tam, yol) {
    if (yol.indexOf("js/vendor/") === 0) { return yol; }
    try { return yol + "?v=" + createHash("sha256").update(readFileSync(join(HEDEF, yol))).digest("hex").slice(0, 10); } catch (e) { return yol; }
  }));
}
const PAKET_SAYISI = 4;
if (!process.env.PAKETSIZ) {
  const anaYolP = join(HEDEF, "index.html");
  let ana = readFileSync(anaYolP, "utf8");
  /* js/24-arsiv-mantigi.js en sonda ayrı kalır: veri'yi ve paylaşılan adları o tanımlar; önceki dosyalar onları
     "typeof" ile yoklar. Aynı betikte olsalar tanım henüz çalışmadan yoklama hata verirdi (let/const). */
  const SON_AYRI = "js/24-arsiv-mantigi.js";
  const betikler = [...ana.matchAll(/<script src="(js\/[^"]+\.js)"><\/script>\n?/g)].map(function (m) { return m[1]; }).filter(function (y) { return y !== SON_AYRI; });
  const boyut = betikler.map(function (y) { return statSync(join(HEDEF, y)).size; });
  const toplam = boyut.reduce(function (a, b) { return a + b; }, 0);
  const gruplar = [[]];
  let birikmis = 0;
  betikler.forEach(function (y, i) {
    const g = gruplar[gruplar.length - 1];
    if (g.length && birikmis + boyut[i] / 2 > toplam * gruplar.length / PAKET_SAYISI && gruplar.length < PAKET_SAYISI) { gruplar.push([]); }
    gruplar[gruplar.length - 1].push(y);
    birikmis += boyut[i];
  });
  const paketYollari = [];
  gruplar.forEach(function (g, i) {
    const ad = "paket-" + (i + 1) + ".js";
    const govde = g.map(function (y) { return readFileSync(join(HEDEF, y), "utf8").replace(/\s*$/, "") + "\n;"; });
    /* her dosya hangi satırda başlıyor (1. satır tablonun kendisi); ";" kendi satırında, önceki ifade yarım kalmasın */
    const tablo2 = [];
    let s2 = 2;
    g.forEach(function (y, j) { tablo2.push([s2, y.replace(/^js\//, "")]); s2 += govde[j].split("\n").length; });
    const bas = "(window.__PAKET__=window.__PAKET__||{})[" + JSON.stringify(ad) + "]=" + JSON.stringify(tablo2) + ";";
    writeFileSync(join(HEDEF, "js", ad), bas + "\n" + govde.join("\n") + "\n");
    paketYollari.push("js/" + ad);
  });
  /* index.html: ilk betiğin yerine paketler, diğerleri silinir */
  let ilk = true;
  ana = ana.replace(/<script src="(js\/[^"]+\.js)"><\/script>\n?/g, function (tam, y) {
    if (betikler.indexOf(y) === -1) { return tam; }
    if (!ilk) { return ""; }
    ilk = false;
    return paketYollari.map(function (p) { return '<script src="' + p + '"></script>\n'; }).join("");
  });
  writeFileSync(anaYolP, ana);
  /* servis çalışanı: paketleri önceden indirir, ayrı dosyaları değil */
  const swP = join(HEDEF, "sw.js");
  let swm = readFileSync(swP, "utf8");
  betikler.forEach(function (y) { swm = swm.replace('"' + y + '", ', "").replace(', "' + y + '"', ""); });
  swm = swm.replace('"veri.json", ', '"veri.json", ' + paketYollari.map(function (p) { return JSON.stringify(p); }).join(", ") + ", ");
  writeFileSync(swP, swm);
  console.log("Betik paketleri: " + betikler.length + " dosya → " + paketYollari.length + " (" + gruplar.map(function (g) { return g.length; }).join("+") + ")");
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
/* 3.0 — veri parçaları: açılışta gerekmeyen uzun listeler ayrı dosyaya çıkar (veri-<ad>.json). veri.json'da
   yerinde ilk birkaç kaydı kalır ve __parcalar hangi dosyada tamamının olduğunu söyler. Site gerekince indirir;
   panel kaydetmeden ve dışa aktarmadan önce hepsini yerine koyar (js/81-surum-30.js). Anahtar sırası değişmez. */
const VERI_PARCALARI = { degisiklik: 3 };
{
  const v = JSON.parse(readFileSync(veriYol, "utf8"));
  const parcalar = {};
  for (const [ad, kalan] of Object.entries(VERI_PARCALARI)) {
    if (!Array.isArray(v[ad]) || v[ad].length <= kalan) { continue; }
    const metin = JSON.stringify(v[ad]);
    const dosya = "veri-" + ad + ".json";
    writeFileSync(join(HEDEF, dosya), metin);
    parcalar[ad] = { dosya: dosya + "?v=" + createHash("sha256").update(metin).digest("hex").slice(0, 10), toplam: v[ad].length };
    v[ad] = v[ad].slice(0, kalan);
  }
  if (Object.keys(parcalar).length) { v.__parcalar = parcalar; }
  writeFileSync(veriYol, JSON.stringify(v));
  /* servis çalışanı parçaları da önceden indirir (internetsiz de tam günlük) */
  const swV = join(HEDEF, "sw.js");
  writeFileSync(swV, readFileSync(swV, "utf8").replace('"veri.json", ', '"veri.json", ' + Object.values(parcalar).map(function (p) { return JSON.stringify(p.dosya); }).join(", ") + (Object.keys(parcalar).length ? ", " : "")));
}

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
/* paket kimliği: içerik özeti. Açık sayfa kendi kimliğini (index.html'deki etiket) surum.json'dakiyle
   karşılaştırır; farklıysa yeni sürüm yayındadır (js/46-guncelleme.js). */
const paket = ozet.digest("hex").slice(0, 12);
const veriSurum = JSON.parse(readFileSync(join(HEDEF, "veri.json"), "utf8")).surum || "";
writeFileSync(join(HEDEF, "surum.json"), JSON.stringify({ paket: paket, surum: veriSurum }));

/* (js/65-yonetici-yukle.js'in sürümlü adresleri paketlerden önce yazıldı) */

const anaYol = join(HEDEF, "index.html");
writeFileSync(anaYol, surumle(readFileSync(anaYol, "utf8")).replace("</head>", '<meta name="tentifor-paket" content="' + paket + '">\n</head>'));

/* 3.0 — kritik CSS: ilk ekranın (betikler çalışmadan görünen HTML'in) kuralları sayfaya gömülür, tam CSS bekletmeden
   iner. Kurallar index.html'deki sınıf/kimlik/etiketlerden kendiliğinden seçilir (CSS değişince elle güncellenmez).
   Tekrar ziyarette (servis çalışanı varken) CSS önbellekten gelir: eskisi gibi hemen uygulanır.
   Veri çizimi tam CSS'i bekler (js/24-arsiv-mantigi.js cssBekle): biçimsiz içerik bir an bile görünmez. */
{
  let ana = readFileSync(anaYol, "utf8");
  const m = /<link rel="stylesheet" href="(css\/style\.css\?v=\w+)">/.exec(ana);
  if (m && !process.env.KRITIKSIZ) {
    const css = readFileSync(join(HEDEF, "css/style.css"), "utf8");
    const govde = ana.slice(ana.indexOf("<body"), ana.indexOf('<script src="js/')).replace(/<script[\s\S]*?<\/script>/g, "");
    const sinif = new Set(["alt-menu", "alt-oge", "alt-ikon", "alt-ad", "sayfa-basi", "sayfa-bas-ust", "sayfa-no", "gez-btn", "bu-sayfa", "komut-tetik", "evren-sayfa", "evren-sec-btn"]);
    const kimlik = new Set(), etiket = new Set(["html", "body"]);
    for (const x of govde.matchAll(/class="([^"]+)"/g)) { x[1].split(/\s+/).forEach(function (c) { sinif.add(c); }); }
    for (const x of govde.matchAll(/id="([^"]+)"/g)) { kimlik.add(x[1]); }
    for (const x of govde.matchAll(/<([a-z][a-z0-9]*)/g)) { etiket.add(x[1]); }
    const bloklar = function (s) {
      const l = [];
      let i = 0;
      while (i < s.length) {
        const a = s.indexOf("{", i);
        if (a === -1) { break; }
        let d = 1, j = a + 1;
        while (d && j < s.length) { if (s[j] === "{") { d++; } else if (s[j] === "}") { d--; } j++; }
        l.push([s.slice(i, a).trim(), s.slice(a + 1, j - 1)]);
        i = j;
      }
      return l;
    };
    const uyar = function (secici) {
      return secici.split(",").some(function (p) {
        if (/:not\(\.veri-hazir\)|data-ilk-sayfa/.test(p)) { return true; }
        const q = p.replace(/::?[a-z-]+(\([^)]*\))?/g, "").replace(/\[[^\]]*\]/g, "");
        return [...q.matchAll(/\.([\w-]+)/g)].every(function (x) { return sinif.has(x[1]); }) &&
          [...q.matchAll(/#([\w-]+)/g)].every(function (x) { return kimlik.has(x[1]); }) &&
          [...q.matchAll(/(?:^|[\s>+~])([a-z][a-z0-9]*)/g)].every(function (x) { return etiket.has(x[1]); });
      });
    };
    const sec = function (s) {
      return bloklar(s).map(function (b) {
        const bas = b[0], ic = b[1];
        if (bas.indexOf("@keyframes") === 0) { return /iskelet/.test(bas) ? bas + "{" + ic + "}" : ""; }
        if (bas.indexOf("@media") === 0 || bas.indexOf("@supports") === 0) { const x = sec(ic); return x ? bas + "{" + x + "}" : ""; }
        if (bas.indexOf("@font-face") === 0) { return bas + "{" + ic.replace(/url\(\.\.\//g, "url(") + "}"; }   /* sayfaya gömülünce adres kökten */
        if (bas.indexOf("@") === 0) { return ""; }
        return uyar(bas) ? bas + "{" + ic + "}" : "";
      }).join("");
    };
    /* tam CSS gelene kadar üst şeritte yalnızca marka ve Kod: betiğin eklediği düğmeler biçimsiz görünmesin */
    const kritik = (sec(css) + "html:not(.css-tam) .ust>:not(.marka):not(.kod-btn){visibility:hidden}").replace(/<\/style/gi, "<\\/style");
    ana = ana.replace(m[0],
      "<style id=\"kritikCss\">" + kritik + "</style>\n" +
      '<link rel="preload" href="' + m[1] + '" as="style" id="anaCss">\n' +
      '<script>(function(){var l=document.getElementById("anaCss");function t(){l.onload=null;l.rel="stylesheet";document.documentElement.classList.add("css-tam")}' +
      'if(navigator.serviceWorker&&navigator.serviceWorker.controller){t()}else{l.onload=t;l.onerror=t}})();</script>\n' +
      '<noscript><link rel="stylesheet" href="' + m[1] + '"></noscript>');
    writeFileSync(anaYol, ana);
    console.log("Kritik CSS: " + Math.round(kritik.length / 1024) + " KB sayfada, " + Math.round(css.length / 1024) + " KB bekletmeden");
  }
}

/* servis çalışanı: aynı sürümlü adresleri önceden indirir; yeni paket = yeni önbellek adı */
const sw = join(HEDEF, "sw.js");
writeFileSync(sw, surumle(readFileSync(sw, "utf8")).replace(/tentiforapp-[^"]+"/, "tentiforapp-" + paket + '"'));

/* Her sayfa kendi adresinde: /arsiv/, /dunya/, /evren/e25/, /fan/hikaye/<id>/ …
   Her biri uygulamanın tam bir kopyasıdır (yönlendirme yok): kendi başlığı, açıklaması ve kanonik adresi
   vardır; uygulama rotayı yoldan okur (js/00-rota.js). Böylece arama motorları her sayfayı ayrı dizinler. */
const gez = readFileSync(join(KOK, "js/18-dalga-7-gezinme.js"), "utf8");
const blok = gez.slice(gez.indexOf("const GEZINME"), gez.indexOf("];", gez.indexOf("const GEZINME")));
const sayfalar = [...blok.matchAll(/\{\s*id:\s*"([^"]+)",\s*ad:\s*"([^"]+)"[\s\S]*?bolumler:\s*\[([\s\S]*?)\]\s*\}/g)]
  .map(function (m) {
    return { id: m[1], ad: m[2], bolumler: [...m[3].matchAll(/\[\s*"[^"]+",\s*"([^"]+)"\s*\]/g)].map(function (b) { return b[1]; }) };
  });
if (sayfalar.length < 5) { throw new Error("Sayfa listesi okunamadı (" + sayfalar.length + ")"); }

const kacir = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };
const anaHtml = readFileSync(anaYol, "utf8");
const veriPaket = JSON.parse(readFileSync(join(HEDEF, "veri.json"), "utf8"));
const meta = function (ad, deger) { return new RegExp('(<meta (?:name|property)="' + ad.replace(/[:.]/g, "\\$&") + '" content=")[^"]*(")'); };
function sayfaHtml(yol, baslik, aciklama, dizinleme) {
  const a = kacir(String(aciklama || "").replace(/\s+/g, " ").trim().slice(0, 280));
  const b = kacir(baslik);
  let h = anaHtml
    .replace(/<title>[^<]*<\/title>/, "<title>" + b + "</title>")
    .replace(meta("description"), "$1" + a + "$2")
    .replace(meta("og:title"), "$1" + b + "$2").replace(meta("og:description"), "$1" + a + "$2")
    .replace(meta("twitter:title"), "$1" + b + "$2").replace(meta("twitter:description"), "$1" + a + "$2")
    .replace(/<meta property="og:image" content="paylasim.png">/, '<meta property="og:image" content="' + SITE + '/paylasim.png">')
    .replace(/<meta name="twitter:image" content="paylasim.png">/, '<meta name="twitter:image" content="' + SITE + '/paylasim.png">');
  h = h.replace("</head>", '<link rel="canonical" href="' + SITE + yol + '">\n<meta property="og:url" content="' + SITE + yol + '">\n</head>');
  /* kişiye özel sayfalar (Sen) dizinlenmez */
  if (dizinleme === false) { h = h.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, follow">'); }
  /* sayfaya özel paylaşım görseli (ikon/og/<ad>.png varsa) */
  const gorsel = ogGorseli(yol);
  if (gorsel) { h = h.replace(new RegExp(SITE.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + "/paylasim\\.png", "g"), SITE + "/" + gorsel); }
  return h;
}
/** /evren/e25/ → ikon/og/e25.png · /dunya/ → ikon/og/dunya.png (dosya varsa) */
function ogGorseli(yol) {
  const p = yol.split("/").filter(Boolean);
  const ad = !p.length ? "" : (p[0] === "evren" ? p[1] : (p[0] === "fan" ? "" : p[0]));
  if (!ad) { return ""; }
  try { statSync(join(HEDEF, "ikon", "og", ad + ".png")); return "ikon/og/" + ad + ".png"; } catch (e) { return ""; }
}
const sayfaYaz = function (yol, baslik, aciklama, dizinleme) {
  const dizin = join(HEDEF, ...yol.split("/").filter(Boolean));
  mkdirSync(dizin, { recursive: true });
  writeFileSync(join(dizin, "index.html"), sayfaHtml(yol, baslik, aciklama, dizinleme));
};
/* ana sayfanın kanonik adresi */
writeFileSync(anaYol, sayfaHtml("/", "TentiforApp — Tentiforverse Arşivi",
  (anaHtml.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ""));

const adresler = ["/"];
const KISISEL_SAYFALAR = ["sen"];
for (const s of sayfalar) {
  const kisisel = KISISEL_SAYFALAR.indexOf(s.id) !== -1;
  sayfaYaz("/" + s.id + "/", s.ad + " — TentiforApp", s.bolumler.join(", ") + ". Tentiforverse evren arşivi.", !kisisel);
  if (!kisisel) { adresler.push("/" + s.id + "/"); }
}
/* gizlilik: Google giriş ekranının istediği kalıcı adres. Metin betik çalışmadan da okunur (site açılınca tam hâli çizilir). */
{
  const dizin = join(HEDEF, "gizlilik");
  mkdirSync(dizin, { recursive: true });
  const statik = "<h3>Gizlilik politikası</h3>" +
    "<p>TentiforApp reklam göstermez, izleme çerezi ve üçüncü taraf analiz aracı kullanmaz.</p>" +
    "<p><b>Hesapsız:</b> okuma ilerlemen, cüzdanın ve tercihlerin yalnızca tarayıcının yerel deposunda durur; hiçbir sunucuya gitmez.</p>" +
    "<p><b>Hesap açarsan (Supabase):</b> e-posta adresin ve şifrenin güvenli özeti yalnızca giriş için kullanılır ve gösterilmez. " +
    "Kullanıcı adın, görünen adın ve profil vitrinin herkese açıktır; ilerlemen yalnızca sana görünür.</p>" +
    "<p><b>Google ile girersen:</b> Google yalnızca adını, e-posta adresini ve profil fotoğrafının adresini paylaşır; Google şifren bu siteye gelmez. " +
    "Bu bilgiler yalnızca hesabını açmak için kullanılır ve kimseyle paylaşılmaz.</p>" +
    "<p><b>Hata bildirimleri:</b> bir hata olursa hata metni, sayfa adresi ve tarayıcı bilgisi yalnızca hatayı düzeltmek için kaydedilir.</p>" +
    "<p><b>Silmek:</b> Sen → Hesabın → Hesabımı sil, hesabını ve bütün verilerini kalıcı olarak siler.</p>";
  writeFileSync(join(dizin, "index.html"), sayfaHtml("/gizlilik/", "Gizlilik — TentiforApp",
    "TentiforApp hangi bilgiyi nerede tutar: hesapsız kullanım, hesap, Google ile giriş, hata bildirimleri ve verilerini silme.")
    .replace('<div id="gizlilikAlan"></div>', '<div id="gizlilikAlan">' + statik + "</div>"));
  adresler.push("/gizlilik/");
}
/* karşılama: Instagram gibi dışarıdan gelenler için */
sayfaYaz("/basla/", "Tentiforverse'e hoş geldin — TentiforApp",
  "Tömye'nin gökyüzünde ay yoktur, ama ayları 28 gün çeker. Başlangıç koduyla arşivi aç; evrenleri, kilitli kayıtları ve oyunları keşfet.");
adresler.push("/basla/");

/* evrenler: kanon evrenler (kodla açılanların özeti yazılmaz), E99, fanmade evrenler */
let evrenSayisi = 0;
for (const [id, k] of Object.entries(veriPaket.kanonEvrenleri || {})) {
  sayfaYaz("/evren/" + id + "/", (k.ad || id.toUpperCase()) + (id === "e25" ? " · Evrengezerlerin evreni" : "") + " — TentiforApp",
    k.erisim ? (k.ozet || "") : "Tentiforverse'ün kanon evrenlerinden biri. İçeriği kodla açılır.");
  adresler.push("/evren/" + id + "/"); evrenSayisi++;
}
if (veriPaket.e99) {
  sayfaYaz("/evren/e99/", "E99 · herkesin evreni — TentiforApp", veriPaket.e99.ozet || "Herkesin yazabildiği boş evren.");
  adresler.push("/evren/e99/"); evrenSayisi++;
}
const guvenli = function (x) { return String(x || "").replace(/[^A-Za-z0-9_-]/g, ""); };
for (const e of ((veriPaket.fanEserleri || {}).evrenler || [])) {
  const id = guvenli(e.id);
  if (!id || /^e\d+$/.test(id)) { continue; }
  sayfaYaz("/evren/" + id + "/", (e.ad || "Fan evreni") + " · fan evreni — TentiforApp",
    (e.ozet || "Tentiforverse okurlarının kurduğu bir evren.") + (e.yazar ? " Kuran: " + e.yazar + "." : ""));
  adresler.push("/evren/" + id + "/"); evrenSayisi++;
}
/* fanmade hikâyeler ve okur Evrengezerleri */
let eserSayisi = 0;
for (const [tur, liste, ek] of [["hikaye", (veriPaket.fanEserleri || {}).hikayeler, "fan hikâyesi"], ["kisi", (veriPaket.fanEserleri || {}).kisiler, "E25 Evrengezeri"]]) {
  for (const e of (liste || [])) {
    const id = guvenli(e.id);
    if (!id) { continue; }
    sayfaYaz("/fan/" + tur + "/" + id + "/", (tur === "hikaye" ? e.baslik : e.ad) + " · " + ek + " — TentiforApp",
      (e.ozet || "") + (e.yazar ? " Yazan: " + e.yazar + "." : ""));
    adresler.push("/fan/" + tur + "/" + id + "/"); eserSayisi++;
  }
}

/* site haritası */
writeFileSync(join(HEDEF, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  adresler.map(function (u) { return "  <url><loc>" + kacir(SITE + u) + "</loc></url>"; }).join("\n") + "\n</urlset>\n");
writeFileSync(join(HEDEF, "robots.txt"), readFileSync(join(HEDEF, "robots.txt"), "utf8").replace(/\s*$/, "\n") + "Sitemap: " + SITE + "/sitemap.xml\n");

console.log("Paket hazır: " + sayfalar.length + " sayfa, " + evrenSayisi + " evren, " + eserSayisi + " fan eseri adresi, JS+CSS " +
  Math.round(once / 1024) + " KB → " + Math.round(sonra / 1024) + " KB");
