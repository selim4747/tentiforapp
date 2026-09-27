/* Yayın paketi: siteyi dist/ klasörüne kopyalar, her JS ve CSS dosyasını ayrı ayrı küçültür,
   her sayfa için paylaşım önizlemeli kısa adres (/dunya/ gibi) üretir ve servis çalışanının
   önbellek adını içeriğe göre günceller. Dosyalar ayrı kaldığı için davranış değişmez.

   Kullanım: npm run paketle   (Cloudflare Pages bunu kendisi çalıştırır) */

import { transform } from "esbuild";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KOK = new URL("..", import.meta.url).pathname;
const HEDEF = join(KOK, "dist");
/* Sitenin kalıcı adresi: Cloudflare Pages'teki SITE_URL ortam değişkeni. */
const SITE = (process.env.SITE_URL || "https://tentiforapp.pages.dev").replace(/\/$/, "");
const KOPYALA = ["index.html", "veri.json", "sw.js", "manifest.webmanifest", "paylasim.png", "robots.txt", "_headers", "css", "js", "ikon", "evrenler", ".well-known"];   /* .well-known/assetlinks.json: Play Store (TWA) uygulaması siteyle eşleşsin (uygulama/README.md) */
/* evrenler/: sitedeki fan evrenlerinin ayrı dosyaları (js/54-evren-dosyalari.js) */

rmSync(HEDEF, { recursive: true, force: true });
mkdirSync(HEDEF, { recursive: true });
for (const ad of KOPYALA) {
  try { statSync(join(KOK, ad)); } catch { continue; }
  cpSync(join(KOK, ad), join(HEDEF, ad), { recursive: true });
}

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
const YONETICI_BETIKLERI = ["js/25-panel-roman-ses-basin.js", "js/43-kurulum.js"];
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
/* paket kimliği: içerik özeti. Açık sayfa kendi kimliğini (index.html'deki etiket) surum.json'dakiyle
   karşılaştırır; farklıysa yeni sürüm yayındadır (js/46-guncelleme.js). */
const paket = ozet.digest("hex").slice(0, 12);
const veriSurum = JSON.parse(readFileSync(join(HEDEF, "veri.json"), "utf8")).surum || "";
writeFileSync(join(HEDEF, "surum.json"), JSON.stringify({ paket: paket, surum: veriSurum }));

const yukleYol = join(HEDEF, "js/65-yonetici-yukle.js");
writeFileSync(yukleYol, surumle(readFileSync(yukleYol, "utf8")));

const anaYol = join(HEDEF, "index.html");
writeFileSync(anaYol, surumle(readFileSync(anaYol, "utf8")).replace("</head>", '<meta name="tentifor-paket" content="' + paket + '">\n</head>'));

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
