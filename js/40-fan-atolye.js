/* Fan atölyesi — herkesin yazdığı hikâyeler ve kurduğu evrenler.

   Bir eser tek bir dosyadır: "<ad>.tentifor.html". Telefonda doğrudan açılıp okunur;
   içindeki veri bloğu (application/json, çalışmaz) sayesinde bu siteye yüklenince de açılır.
   Sunucu yok: yazılanlar bu cihazda (hesapla eşitlenir), açılan dosyalar yalnızca tarayıcıda okunur.
   Yönetici açtığı bir dosyayı "fanmade" olarak veri.fanEserleri'ne ekler, Kaydet ile yayına alır.

   Dosyadan gelen her şey güvenilmez metindir: yalnızca kacir/paragraf ile ekrana basılır. */

const FAN_ESERLER_ANAHTAR = "tentiforapp_fan_eserlerim";
const FAN_ACILAN_ANAHTAR = "tentiforapp_fan_acilan";    /* hesapla eşitlenmez (28-hesap.js) */
const FAN_BICIM = "tentifor-eser";
const FAN_DOSYA_SINIR = 3 * 1024 * 1024;
const FAN_METIN_SINIR = 120000;

const FAN_KURAL_TURLERI = ["fizik", "zaman", "ışık", "ölüm", "büyü", "dil", "toplum", "biyoloji", "gökyüzü", "enerji", "hafıza", "boyut"];

/* evren dosyasındaki tekrarlanan gruplar; her grup kendi alanlarıyla */
const FAN_EVREN_GRUPLARI = [
  { k: "kurallar", ad: "Evren kuralları", tekil: "kural", not: "Fizik olmak zorunda değil: bu evrende neyin nasıl işlediğini yaz. Türü listede yoksa kendi türünü yaz.",
    alanlar: [["ad", "Kuralın adı"], ["tur", "Türü", "liste"], ["aciklama", "Nasıl işler, neyi değiştirir?", "uzun"]] },
  { k: "kisiler", ad: "Kişiler", tekil: "kişi", alanlar: [["ad", "Adı"], ["rol", "Kim, ne iş yapar?"], ["aciklama", "Hikâyesi", "uzun"]] },
  { k: "yerler", ad: "Yerler", tekil: "yer", alanlar: [["ad", "Adı"], ["aciklama", "Nasıl bir yer?", "uzun"]] },
  { k: "tarih", ad: "Tarih", tekil: "olay", alanlar: [["zaman", "Ne zaman?"], ["olay", "Ne oldu?", "uzun"]] },
  { k: "sozluk", ad: "Sözlük", tekil: "terim", alanlar: [["terim", "Terim"], ["tanim", "Anlamı", "uzun"]] },
  { k: "ozelAlanlar", ad: "Kendi alanların", tekil: "alan", not: "Sitede tanımlı olmayan her şey: \"Gökyüzünün rengi\", \"Para birimi\", \"Ay sayısı\"… Adını da içeriğini de sen koy.",
    alanlar: [["ad", "Alanın adı"], ["deger", "İçeriği", "uzun"]] }
];

const FAN_HIKAYE_ALANLARI = ["baslik", "yazar", "evren", "karakterler", "etiketler", "uyari", "ozet", "metin"];

/* ==================== yardımcılar ==================== */

function fanId() {
  return "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fanMetin(x, sinir) { return String(x == null ? "" : x).slice(0, sinir || 300); }

/** Dışarıdan gelen bir eseri doğrular ve yalnızca bilinen alanları, sınırlı uzunlukta bırakır. */
function fanTemizle(ham) {
  if (!ham || typeof ham !== "object" || ham.bicim !== FAN_BICIM) { return null; }
  if (ham.tur === "kisi") { return typeof kisiTemizle === "function" ? kisiTemizle(ham) : null; }
  const e = { bicim: FAN_BICIM, surum: 1, tur: ham.tur === "evren" ? "evren" : (ham.tur === "hikaye" ? "hikaye" : ""),
    id: fanMetin(ham.id, 40).replace(/[^\w-]/g, "") || fanId(),
    olusturma: fanMetin(ham.olusturma, 30), guncelleme: fanMetin(ham.guncelleme, 30) };
  if (!e.tur) { return null; }
  if (e.tur === "hikaye") {
    e.baslik = fanMetin(ham.baslik, 160); e.yazar = fanMetin(ham.yazar, 80); e.evren = fanMetin(ham.evren, 120);
    e.karakterler = fanMetin(ham.karakterler, 400); e.etiketler = fanMetin(ham.etiketler, 300); e.uyari = fanMetin(ham.uyari, 300);
    e.ozet = fanMetin(ham.ozet, 1500); e.metin = fanMetin(ham.metin, FAN_METIN_SINIR);
    if (!e.baslik.trim() && !e.metin.trim()) { return null; }
    const konuk = typeof konukTemizle === "function" ? konukTemizle(ham.konuklar) : [];
    if (konuk.length) { e.konuklar = konuk; }
  } else {
    e.ad = fanMetin(ham.ad, 160); e.yazar = fanMetin(ham.yazar, 80); e.ozet = fanMetin(ham.ozet, 6000);
    FAN_EVREN_GRUPLARI.forEach(function (g) {
      e[g.k] = (Array.isArray(ham[g.k]) ? ham[g.k] : []).slice(0, 120).map(function (x) {
        const o = {};
        g.alanlar.forEach(function (a) { o[a[0]] = fanMetin(x && x[a[0]], a[2] === "uzun" ? 8000 : 200); });
        return o;
      });
    });
    e.harita = fanHaritaTemizle(ham.harita);
    if (typeof evrenEkTemizle === "function") { evrenEkTemizle(ham, e); }
    const konuk = typeof konukTemizle === "function" ? konukTemizle(ham.konuklar) : [];
    if (konuk.length) { e.konuklar = konuk; }
    if (!e.ad.trim()) { return null; }
  }
  return e;
}

/** Evren haritası: yerler (0–100 koordinat), isteğe bağlı alan çokgenleri, deniz rengi. */
function fanHaritaTemizle(h) {
  const sayi = function (v) { const n = Number(v); return isFinite(n) ? Math.max(0, Math.min(100, Math.round(n * 100) / 100)) : 50; };
  const kaynak = (h && Array.isArray(h.yerler)) ? h.yerler : [];
  const o = { yerler: kaynak.slice(0, 400).map(function (y, i) {
    const t = { id: fanMetin(y && y.id, 40).replace(/[^\w-]/g, "") || ("y" + i), ad: fanMetin(y && y.ad, 80),
      tur: fanMetin(y && y.tur, 40), not: fanMetin(y && y.not, 2000), x: sayi(y && y.x), y: sayi(y && y.y) };
    if (y && Array.isArray(y.sekil) && y.sekil.length >= 3) {
      t.sekil = y.sekil.slice(0, 120).map(function (n) { return [sayi(n && n[0]), sayi(n && n[1])]; });
    }
    return t;
  }) };
  if (h && /^#[0-9a-fA-F]{6}$/.test(h.renk || "")) { o.renk = h.renk; }
  const stil = h && typeof evrenHaritaStilTemizle === "function" ? evrenHaritaStilTemizle(h.stil) : null;
  if (stil) { o.stil = stil; }
  return o;
}

function fanAd(e) { return (e.tur === "hikaye" ? e.baslik : e.ad) || "Adsız"; }   /* evren ve kişi: ad */

function fanKelime(metin) { return (String(metin || "").match(/\S+/g) || []).length; }

function fanSlug(s) {
  const t = String(s || "eser").toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, function (h) { return { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u" }[h]; })
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return t || "eser";
}

function fanDosyaAdi(e) { return fanSlug(fanAd(e)) + ".tentifor.html"; }

/** Eser dosyası: kendi başına okunabilen bir HTML sayfası + sitenin okuduğu veri bloğu. */
function fanDosyaHtml(e) {
  const veriBlok = JSON.stringify(e).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  const baslik = kacir(fanAd(e)) + (e.tur === "hikaye" ? " — fan hikâyesi" : (e.tur === "kisi" ? " — E25 Evrengezeri" : " — fan evreni"));
  return "<!DOCTYPE html>\n<html lang=\"tr\"><head><meta charset=\"utf-8\">\n" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
    "<title>" + baslik + "</title>\n" +
    "<style>body{margin:0;background:#F4F9FD;color:#0A0F14;font:18px/1.7 Georgia,serif}" +
    "main{max-width:680px;margin:0 auto;padding:32px 18px 60px}h1{font-weight:400;font-size:34px;line-height:1.2;margin:0 0 6px}" +
    "h2{font-weight:400;font-size:22px;margin:32px 0 8px;border-bottom:1px solid #B8D6EC;padding-bottom:4px}" +
    ".ust{font:12px/1.5 ui-monospace,monospace;color:#1C5C96;text-transform:uppercase;letter-spacing:.08em}" +
    ".bilgi{font:14px/1.6 system-ui,sans-serif;color:#3D4A57}.uyari{background:#DFEDF8;padding:8px 12px;font:14px system-ui,sans-serif}" +
    "dl{margin:0}dt{font-weight:bold;margin-top:14px}dd{margin:2px 0 0}footer{margin-top:48px;font:13px/1.6 system-ui,sans-serif;color:#3D4A57;border-top:1px solid #B8D6EC;padding-top:12px}" +
    "@media (prefers-color-scheme:dark){body{background:#0B1017;color:#E8EEF4}.uyari{background:#1C2733}.bilgi,footer{color:#9AAABB}.ust{color:#7FB2DC}}</style>\n" +
    "</head><body><main>\n" + fanEserGovde(e, true) +
    "\n<footer>TentiforApp fan eseri · kanon dışı. Bu dosyayı " + kacir(KART_ADRES) +
    " adresinde Fan → Dosya aç ile de açabilirsin.</footer>\n</main>\n" +
    "<script type=\"application/json\" id=\"tentifor-eser\">" + veriBlok + "</script>\n</body></html>\n";
}

/** Okuma görünümü (sitede ve dosyada aynı). Her alan kaçırılır. */
function fanEserGovde(e, dosya) {
  const bilgi = function (etiket, deger) { return deger && String(deger).trim() ? "<div><b>" + kacir(etiket) + ":</b> " + kacir(deger) + "</div>" : ""; };
  if (e.tur === "kisi") { return typeof kisiGovde === "function" ? kisiGovde(e, dosya) : "<h1>" + kacir(e.ad) + "</h1>"; }
  const konuk = typeof konukGovde === "function" ? konukGovde(e, dosya) : "";
  if (e.tur === "hikaye") {
    const kelime = fanKelime(e.metin);
    return '<p class="ust">Fan hikâyesi · kanon dışı</p>' +
      "<h1>" + kacir(e.baslik || "Adsız") + "</h1>" +
      '<div class="bilgi">' + bilgi("Yazan", e.yazar) + bilgi("Evren", e.evren) + bilgi("Karakterler", e.karakterler) +
        bilgi("Etiketler", e.etiketler) + "<div>" + kelime + " kelime · yaklaşık " + Math.max(1, Math.round(kelime / 200)) + " dk</div></div>" +
      (e.uyari ? '<p class="uyari">Uyarı: ' + kacir(e.uyari) + "</p>" : "") +
      (e.ozet ? "<p><i>" + kacir(e.ozet) + "</i></p>" : "") +
      '<div class="' + (dosya ? "" : "okuma-metin fan-metin") + '">' + paragraf(e.metin) + "</div>" + konuk;
  }
  return '<p class="ust">' + kacir(e.etiket || "Fan evreni · kanon dışı") + "</p>" +
    "<h1>" + kacir(e.ad || "Adsız evren") + "</h1>" +
    '<div class="bilgi">' + bilgi("Kuran", e.yazar) + "</div>" +
    (e.ozet ? paragraf(e.ozet) : "") +
    (e.harita && e.harita.yerler && e.harita.yerler.length && typeof evrenHaritaSvg === "function"
      ? "<h2>Harita</h2>" + evrenHaritaSvg(e.harita, { alfabe: e.alfabe }) : "") +
    ((e.lorlar || []).length ? "<h2>Kilitli lore</h2><ul>" + e.lorlar.map(function (l) { return "<li>" + kacir(l.baslik) + " · kodla açılır</li>"; }).join("") + "</ul>" : "") +
    FAN_EVREN_GRUPLARI.map(function (g) {
      const liste = (e[g.k] || []).filter(function (x) { return Object.keys(x).some(function (k) { return String(x[k] || "").trim(); }); });
      if (!liste.length) { return ""; }
      return "<h2>" + kacir(g.ad) + "</h2><dl>" + liste.map(function (x) {
        const bas = g.k === "tarih" ? x.zaman : (g.k === "sozluk" ? x.terim : x.ad);
        const ek = g.k === "kurallar" ? x.tur : (g.k === "kisiler" ? x.rol : "");
        const govde = g.k === "tarih" ? x.olay : (g.k === "sozluk" ? x.tanim : (g.k === "ozelAlanlar" ? x.deger : x.aciklama));
        return "<dt>" + kacir(bas || "—") + (ek ? ' <span class="bilgi">· ' + kacir(ek) + "</span>" : "") + "</dt>" +
          "<dd>" + paragraf(govde) + "</dd>";
      }).join("") + "</dl>";
    }).join("") + konuk;
}

/* ==================== kendi eserlerin ==================== */

function fanEserlerim() {
  const l = jsonOku(FAN_ESERLER_ANAHTAR, []);
  return Array.isArray(l) ? l : [];
}

function fanEserlerimYaz(l) {
  try { jsonYaz(FAN_ESERLER_ANAHTAR, l); return true; }
  catch (e) { return false; }   /* depolama doldu */
}

const fanSecili = { hikaye: null, evren: null };
const fanSekme = { hikaye: "oku", evren: "oku" };

function fanDuzenlenen(tur) {
  return fanEserlerim().find(function (x) { return x.id === fanSecili[tur] && x.tur === tur; }) || null;
}

function fanYeni(tur) {
  const simdi = new Date().toISOString();
  const yazar = (typeof hesapProfil !== "undefined" && hesapProfil && (hesapProfil.gorunen_ad || hesapProfil.kullanici_adi)) || "";
  const e = { bicim: FAN_BICIM, surum: 1, tur: tur, id: fanId(), olusturma: simdi, guncelleme: simdi, yazar: yazar };
  if (tur === "hikaye") { FAN_HIKAYE_ALANLARI.forEach(function (k) { if (!(k in e)) { e[k] = ""; } }); }
  else {
    e.ad = ""; e.ozet = "";
    FAN_EVREN_GRUPLARI.forEach(function (g) { e[g.k] = []; });
    e.kurallar.push({ ad: "", tur: "", aciklama: "" });
    e.harita = { yerler: [] };
  }
  const l = fanEserlerim();
  l.push(e);
  fanEserlerimYaz(l);
  fanSecili[tur] = e.id;
  return e;
}

/** "kurallar.2.ad" gibi bir yola değer yazar ve kaydeder. */
/** hedef: formun data-fan-hedef'i (evren sayfası kendi taslağını belirtir); yoksa seçili taslak. */
function fanAlanYaz(tur, yol, deger, hedef) {
  const l = fanEserlerim();
  const id = hedef || fanSecili[tur];
  const e = l.find(function (x) { return x.id === id; });
  if (!e) { return; }
  const p = yol.split(".");
  let o = e;
  for (let i = 0; i < p.length - 1; i++) { o = o[p[i]]; if (!o) { return; } }
  o[p[p.length - 1]] = deger;
  e.guncelleme = new Date().toISOString();
  const tamam = fanEserlerimYaz(l);
  const d = document.querySelector('[data-fan-kayit="' + tur + '"]');
  if (d) { d.textContent = tamam ? "Taslak bu cihaza kaydedildi" : "Kaydedilemedi: tarayıcının alanı doldu. Dosya olarak indir."; }
  if (yol === "metin") {
    const s = document.querySelector("[data-fan-sayac]");
    if (s) { s.textContent = fanKelime(deger) + " kelime"; }
  }
}

/* ==================== çizim ==================== */

function fanSekmeler(tur) {
  const s = fanSekme[tur];
  const ad = tur === "hikaye" ? ["Fanmade hikâyeler", "Hikâye yaz"] : ["Fanmade evrenler", "Evrenini kur"];
  return '<div class="fan-sekmeler" role="tablist">' +
    '<button class="dugme' + (s === "oku" ? "" : " dugme-sade") + '" data-fan-sekme="' + tur + ':oku" role="tab" aria-selected="' + (s === "oku") + '">' + ad[0] + "</button>" +
    '<button class="dugme' + (s === "yaz" ? "" : " dugme-sade") + '" data-fan-sekme="' + tur + ':yaz" role="tab" aria-selected="' + (s === "yaz") + '">' + ad[1] + "</button></div>";
}

function fanSiteListesi(tur) {
  const f = veri.fanEserleri || {};
  return (tur === "hikaye" ? f.hikayeler : (tur === "kisi" ? f.kisiler : f.evrenler)) || [];
}

function fanKartHtml(e, kaynak) {
  const alt = e.tur === "kisi" ? ["E25 Evrengezeri", e.yazar, (e.kisilik || []).length + " kişilik hali"].filter(Boolean).join(" · ") : e.tur === "hikaye"
    ? [e.yazar, e.evren, fanKelime(e.metin) + " kelime"].filter(Boolean).join(" · ")
    : [e.yazar, (e.kurallar || []).length + " kural", (e.kisiler || []).length + " kişi"].filter(Boolean).join(" · ");
  return '<button class="fan-kart" data-fan-ac="' + kaynak + ":" + kacir(e.tur) + ":" + kacir(e.id) + '">' +
    '<span class="fan-kart-ad">' + kacir(fanAd(e)) + "</span>" +
    '<span class="oyun-not">' + kacir(alt) + "</span>" +
    (e.ozet ? '<span class="fan-kart-ozet">' + kacir(String(e.ozet).slice(0, 160)) + "</span>" : "") + "</button>";
}

function fanHikayeCiz() { fanCiz("hikaye"); }
function fanEvrenCiz() { fanCiz("evren"); }

function fanCiz(tur) {
  const alan = document.querySelector(tur === "hikaye" ? "#fanHikayeAlan" : "#fanEvrenAlan");
  if (!alan) { return; }
  if (fanSekme[tur] === "oku") {
    const liste = fanSiteListesi(tur);
    alan.innerHTML = fanSekmeler(tur) +
      (liste.length
        ? '<div class="fan-liste">' + liste.map(function (e) { return fanKartHtml(e, "site"); }).join("") + "</div>"
        : '<p class="oyun-not">Henüz siteye eklenmiş bir fan ' + (tur === "hikaye" ? "hikâyesi" : "evreni") +
          " yok. İlki senin olabilir: yaz, dosyayı indir ve yazara gönder.</p>");
    return;
  }
  alan.innerHTML = fanSekmeler(tur) + fanDuzenleyici(tur);
}

function fanBolumleriCiz() { fanHikayeCiz(); fanEvrenCiz(); fanAcCiz(); }

function fanEvrenOnerileri() {
  const adlar = (veri.haritalar || []).filter(function (h) {
    return typeof kanonEvrenErisimi !== "function" || kanonEvrenErisimi(h.id);
  }).map(function (h) { return h.ad; });
  fanEserlerim().concat(fanSiteListesi("evren")).forEach(function (e) { if (e.tur === "evren" && e.ad && !e.e99) { adlar.push(e.ad); } });
  if (veri.e99) { adlar.push("E99"); }
  return adlar.filter(function (x, i, a) { return a.indexOf(x) === i; });
}

function fanGirdi(yol, deger, etiket, tip, ek) {
  const id = "fanA_" + yol.replace(/\W/g, "_");
  const ortak = ' id="' + id + '" data-fan-alan="' + kacir(yol) + '"';
  return '<label for="' + id + '">' + kacir(etiket) + "</label>" +
    (tip === "uzun"
      ? '<textarea class="kod-giris arac-giris fan-uzun"' + ortak + ' rows="' + ((ek && ek.satir) || 3) + '">' + kacir(deger || "") + "</textarea>"
      : '<input class="kod-giris arac-giris"' + ortak + ' value="' + kacir(deger || "") + '"' + (ek && ek.liste ? ' list="' + ek.liste + '"' : "") +
          (ek && ek.ipucu ? ' placeholder="' + kacir(ek.ipucu) + '"' : "") + ">");
}

function fanDuzenleyici(tur) {
  const benim = fanEserlerim().filter(function (x) { return x.tur === tur && !x.e99; });
  let e = fanDuzenlenen(tur);
  if (e && e.e99) { e = null; }
  if (!e && benim.length) { fanSecili[tur] = benim[benim.length - 1].id; e = benim[benim.length - 1]; }

  const ust = '<div class="fan-eserlerim">' +
    (benim.length ? '<span class="oyun-etiket">Taslakların</span>' + benim.map(function (x) {
      return '<button class="dugme' + (e && x.id === e.id ? "" : " dugme-sade") + '" data-fan-sec="' + tur + ":" + kacir(x.id) + '">' + kacir(fanAd(x)) + "</button>";
    }).join("") : "") +
    '<button class="dugme dugme-sade" data-fan-yeni="' + tur + '">+ Yeni ' + (tur === "hikaye" ? "hikâye" : "evren") + "</button></div>";

  if (!e) {
    return ust + '<p class="oyun-not">Taslakların bu cihazda saklanır (hesabın varsa onunla da eşitlenir). ' +
      "Bitirince dosya olarak indirip istediğin kişiye gönderebilir, dilersen yazara yollayıp sitede fanmade olarak yayımlanmasını isteyebilirsin.</p>";
  }

  let form;
  if (tur === "hikaye") {
    form = fanGirdi("baslik", e.baslik, "Başlık") +
      fanGirdi("yazar", e.yazar, "Yazan (takma ad olabilir)") +
      fanGirdi("evren", e.evren, "Hangi evrende geçiyor?", "", { liste: "fanEvrenOneri", ipucu: "Tömye, Claude'un evreni, kendi evrenin…" }) +
      fanGirdi("karakterler", e.karakterler, "Karakterler", "", { ipucu: "virgülle ayır" }) +
      fanGirdi("etiketler", e.etiketler, "Etiketler", "", { ipucu: "macera, gizem, kısa…" }) +
      fanGirdi("uyari", e.uyari, "Okura uyarı (isteğe bağlı)") +
      fanGirdi("ozet", e.ozet, "Kısa özet", "uzun", { satir: 2 }) +
      fanGirdi("metin", e.metin, "Hikâye", "uzun", { satir: 16 }) +
      '<p class="oyun-not"><span data-fan-sayac>' + fanKelime(e.metin) + " kelime</span> · paragrafları boş satırla ayır · en fazla " +
        FAN_METIN_SINIR.toLocaleString("tr-TR") + " karakter</p>";
  } else {
    form = fanEvrenFormHtml(e, true);
  }

  return ust +
    '<datalist id="fanEvrenOneri">' + fanEvrenOnerileri().map(function (a) { return '<option value="' + kacir(a) + '">'; }).join("") + "</datalist>" +
    '<div class="fan-form kutu-y" data-fan-form="' + tur + '">' + form + "</div>" +
    (typeof konukDuzenleyiciHtml === "function" ? konukDuzenleyiciHtml(e) : "") +
    (tur === "evren" ? '<p class="oyun-not"><a href="#/ev/benim/' + kacir(e.id) + '">Evren sayfasını ve haritasını aç →</a></p>' : "") +
    '<p class="oyun-not" data-fan-kayit="' + tur + '">Taslak bu cihaza kaydediliyor</p>' +
    '<div class="oyun-sira">' +
      '<button class="dugme" data-fan-indir="' + tur + '">Dosya olarak indir</button>' +
      '<button class="dugme dugme-sade" data-fan-paylas="' + tur + '">Paylaş</button>' +
      '<button class="dugme dugme-sade" data-fan-onizle="' + tur + '">Önizle</button>' +
      '<button class="dugme dugme-sade" data-fan-gonder="' + tur + '">Yazara gönder</button>' +
      '<button class="dugme dugme-sade y-sil" data-fan-sil="' + tur + '">' + (fanSilOnay === e.id ? "Emin misin? Sil" : "Taslağı sil") + "</button>" +
    "</div>" +
    '<div data-fan-gonder-alan="' + tur + '"></div>';
}

/** Evren formu: ad/yazar/özet (isteğe bağlı) ve bütün gruplar. Evren sayfası (44-evrenler.js) da kullanır. */
function fanEvrenFormHtml(e, basliklar) {
  return (basliklar
      ? fanGirdi("ad", e.ad, "Evrenin adı") +
        fanGirdi("yazar", e.yazar, "Kuran (takma ad olabilir)") +
        fanGirdi("ozet", e.ozet, "Evreni anlat", "uzun", { satir: 4 })
      : "") +
    FAN_EVREN_GRUPLARI.map(function (g) {
      return '<fieldset class="fan-grup"><legend>' + kacir(g.ad) + "</legend>" +
        (g.not ? '<p class="oyun-not">' + kacir(g.not) + "</p>" : "") +
        (e[g.k] || []).map(function (x, i) {
          return '<div class="fan-oge">' + g.alanlar.map(function (a) {
            return fanGirdi(g.k + "." + i + "." + a[0], x[a[0]], a[1], a[2] === "uzun" ? "uzun" : "", a[2] === "liste" ? { liste: "fanKuralTur" } : { satir: 2 });
          }).join("") +
            '<button class="dugme dugme-sade y-sil" data-fan-cikar="' + g.k + ":" + i + '">Bu ' + g.tekil + "i kaldır</button></div>";
        }).join("") +
        '<button class="dugme dugme-sade" data-fan-ekle="' + g.k + '">+ ' + kacir(g.tekil) + " ekle</button></fieldset>";
    }).join("") +
    '<datalist id="fanKuralTur">' + FAN_KURAL_TURLERI.map(function (a) { return '<option value="' + kacir(a) + '">'; }).join("") + "</datalist>";
}

let fanSilOnay = null;

/* ==================== dosya açma ==================== */

function fanAcilanlar() {
  const l = jsonOku(FAN_ACILAN_ANAHTAR, []);
  return Array.isArray(l) ? l.map(fanTemizle).filter(Boolean) : [];
}

function fanAcilanEkle(e) {
  const l = fanAcilanlar().filter(function (x) { return x.id !== e.id; });
  l.push(e);
  while (l.length > 6) { l.shift(); }
  try { jsonYaz(FAN_ACILAN_ANAHTAR, l); } catch (_) { /* alan dolduysa yalnızca listede kalmaz */ }
}

function fanAcCiz() {
  const alan = document.querySelector("#fanAcAlan");
  if (!alan) { return; }
  const acilan = fanAcilanlar().slice().reverse();
  alan.innerHTML =
    '<label class="fan-birak" data-fan-birak>' +
      '<input type="file" accept=".html,.htm,.json,text/html,application/json" data-fan-dosya>' +
      "<b>Dosya seç</b><span>ya da buraya bırak · .tentifor.html</span></label>" +
    '<p class="pencere-durum" id="fanAcDurum" role="status"></p>' +
    (acilan.length ? '<div class="oyun-etiket">Son açtıkların</div><div class="fan-liste">' +
      acilan.map(function (e) { return fanKartHtml(e, "acilan"); }).join("") + "</div>" : "") +
    fanGonderBilgi();
}

/** Dosyayı okur, içindeki eseri çıkarır. */
function fanDosyaOku(dosya) {
  return new Promise(function (coz, reddet) {
    if (!dosya) { reddet(new Error("Dosya seçilmedi")); return; }
    if (dosya.size > FAN_DOSYA_SINIR) { reddet(new Error("Dosya çok büyük (en fazla 3 MB)")); return; }
    const r = new FileReader();
    r.onerror = function () { reddet(new Error("Dosya okunamadı")); };
    r.onload = function () {
      try { coz(fanMetindenEser(String(r.result || ""))); }
      catch (e) { reddet(e); }
    };
    r.readAsText(dosya);
  });
}

function fanMetindenEser(metin) {
  let ham = null;
  const t = metin.trim();
  if (t.charAt(0) === "{") { ham = JSON.parse(t); }
  else {
    const belge = new DOMParser().parseFromString(metin, "text/html");
    const blok = belge.getElementById("tentifor-eser");
    if (!blok) { throw new Error("Bu bir TentiforApp eser dosyası değil"); }
    ham = JSON.parse(blok.textContent);
  }
  const e = fanTemizle(ham);
  if (!e) { throw new Error("Dosyadaki eser okunamadı ya da boş"); }
  return e;
}

async function fanDosyaAc(dosya) {
  const durum = document.querySelector("#fanAcDurum");
  try {
    const e = await fanDosyaOku(dosya);
    fanAcilanEkle(e);
    fanAcCiz();
    fanPencere(e, "acilan");
  } catch (hata) {
    if (durum) { durum.textContent = (hata && hata.message) || "Açılamadı"; durum.className = "pencere-durum kotu"; }
  }
}

/* ==================== okuma penceresi ==================== */

let fanAcik = null;   /* { eser, kaynak } */

function fanBul(kaynak, tur, id) {
  const liste = kaynak === "site" ? fanSiteListesi(tur) : (kaynak === "benim" ? fanEserlerim() : fanAcilanlar());
  return liste.find(function (x) { return x.id === id && x.tur === tur; }) || null;
}

/** #/fan/hikaye/<id> bağlantısı */
function fanSiteEserAc(tur, id) {
  const e = fanBul("site", tur === "evren" ? "evren" : (tur === "kisi" ? "kisi" : "hikaye"), id);
  if (e) { fanPencere(e, "site"); }
}

function fanPencere(e, kaynak) {
  fanAcik = { eser: e, kaynak: kaynak };
  const perde = document.querySelector("#perde");
  if (!perde) { return; }
  const yonetici = typeof panelAcik === "function" && panelAcik();
  const sitede = fanSiteListesi(e.tur).some(function (x) { return x.id === e.id; });
  /* okurun gönderdiği E99 katkısı: tam yönetici onu E99'a ekler */
  const e99Dosyasi = e.tur === "evren" && /^e99k/.test(e.id) && kaynak !== "site" && typeof yoneticiAcik === "function" && yoneticiAcik() && typeof e99Birlestir === "function";
  perde.innerHTML =
    '<div class="pencere pencere-genis fan-pencere" role="dialog" aria-modal="true" aria-label="' + kacir(fanAd(e)) + '">' +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      '<div class="fan-oku">' + fanEserGovde(e, false) + "</div>" +
      '<div class="oyun-sira fan-pencere-eylem">' +
        '<button class="dugme" data-fan-p="indir">İndir</button>' +
        '<button class="dugme dugme-sade" data-fan-p="kapak">Kapak kartı</button>' +
        '<button class="dugme dugme-sade" data-fan-p="paylas">Paylaş</button>' +
        (kaynak === "site" ? '<button class="dugme dugme-sade" data-fan-p="baglanti">Bağlantıyı kopyala</button>' : "") +
        (kaynak !== "benim" ? '<button class="dugme dugme-sade" data-fan-p="kopyala">Taslaklarıma ekle</button>' : "") +
        (e99Dosyasi ? '<button class="dugme" data-fan-p="e99">E99\'a ekle</button>' : "") +
        (yonetici && kaynak !== "site" && !e99Dosyasi ? '<button class="dugme" data-fan-p="siteye">' + (sitede ? "Sitedekini bununla güncelle" : "Siteye fanmade olarak ekle") + "</button>" : "") +
        (yonetici && kaynak === "site" ? '<button class="dugme dugme-sade y-sil" data-fan-p="kaldir">Siteden kaldır</button>' : "") +
      "</div>" +
      '<p class="pencere-durum" id="fanPDurum" role="status"></p>' +
      (kaynak === "site" && sitede ? '<div class="tepki-alan" data-hedef="fan:' + kacir(e.id) + '"></div>' : "") +
    "</div>";
  perde.hidden = false;
  /* sitedeki fanmade esere okurlar tepki ve kenar notu bırakabilir (bölüm tepkileriyle aynı altyapı) */
  if (kaynak === "site" && typeof tepkiAlanlariKur === "function") { tepkiAlanlariKur(perde); }
}

function fanPDurum(m, iyi) {
  const d = document.querySelector("#fanPDurum");
  if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); }
}

/** Yönetici: eseri veri.fanEserleri'ne koyar; Kaydet ile yayına çıkar. */
function fanSiteyeEkle(e) {
  if (!(typeof panelAcik === "function" && panelAcik())) { return false; }
  if (!veri.fanEserleri) { veri.fanEserleri = { hikayeler: [], evrenler: [] }; }
  const k = e.tur === "hikaye" ? "hikayeler" : (e.tur === "kisi" ? "kisiler" : "evrenler");
  if (!Array.isArray(veri.fanEserleri[k])) { veri.fanEserleri[k] = []; }
  const kopya = JSON.parse(JSON.stringify(e));
  kopya.eklenme = bugununAdi();
  const i = veri.fanEserleri[k].findIndex(function (x) { return x.id === e.id; });
  if (i === -1) { veri.fanEserleri[k].push(kopya); } else { veri.fanEserleri[k][i] = kopya; }
  fanBolumleriCiz();
  return true;
}

function fanSitedenKaldir(e) {
  if (!(typeof panelAcik === "function" && panelAcik()) || !veri.fanEserleri) { return; }
  const k = e.tur === "hikaye" ? "hikayeler" : (e.tur === "kisi" ? "kisiler" : "evrenler");
  veri.fanEserleri[k] = (veri.fanEserleri[k] || []).filter(function (x) { return x.id !== e.id; });
  fanBolumleriCiz();
}

/* ==================== kapak kartı ==================== */

/** Instagram/WhatsApp için 1080×1350 kapak: başlık Kyldo yazısıyla ve Latin harfleriyle, ilk satırlar, yazar. */
async function fanKapakUret(e) {
  if (typeof kartFontlariHazir !== "function") { return null; }
  await kartFontlariHazir();
  const t = document.createElement("canvas");
  t.width = KART_EN; t.height = KART_BOY;
  const c = t.getContext && t.getContext("2d");
  if (!c) { return null; }
  kartZemin(c, KART_EN, KART_BOY);
  const sol = 110, sag = KART_EN - 110, gen = sag - sol;
  c.fillStyle = KART_RENK.deniz;
  c.fillRect(sol, 118, 6, 64);
  kartEtiket(c, e.tur === "hikaye" ? "Fan hikâyesi · kanon dışı" : "Fan evreni · kanon dışı", sol + 26, 162, KART_RENK.murekkep2, 24);

  /* başlığın ilk kelimesi Kyldo yazısıyla (Türkçe harfler dışında kalanlar çizilmez) */
  const ilk = String(fanAd(e)).split(/\s+/)[0].toLocaleLowerCase("tr").replace(/[^a-zçğıöşü]/g, "");
  let y = 250;
  if (ilk && typeof kyldoSatirCiz === "function" && veri.alfabe) {
    try { y = kyldoSatirCiz(c, ilk, KART_EN / 2, 230, gen, 120) + 30; } catch (_) { y = 250; }
  }

  c.fillStyle = KART_RENK.murekkep;
  let px = 92;
  c.font = KART_FONT.baslik(px);
  let satirlar = kartSar(c, fanAd(e), gen);
  while (satirlar.length > 3 && px > 52) { px -= 6; c.font = KART_FONT.baslik(px); satirlar = kartSar(c, fanAd(e), gen); }
  y += px;
  satirlar.slice(0, 3).forEach(function (s) { c.fillText(s, sol, y); y += px * 1.08; });

  c.font = KART_FONT.yazi(32, true);
  c.fillStyle = KART_RENK.deniz;
  const bilgi = [e.yazar, e.tur === "hikaye" ? e.evren : ((e.kurallar || []).length + " kural")].filter(Boolean).join(" · ");
  if (bilgi) { c.fillText(bilgi.slice(0, 60), sol, y + 10); y += 70; }

  const govde = e.tur === "hikaye" ? (e.ozet || e.metin) : (e.ozet || ((e.kurallar || [])[0] || {}).aciklama);
  c.font = KART_FONT.yazi(34);
  c.fillStyle = KART_RENK.murekkep2;
  kartSar(c, String(govde || "").replace(/\s+/g, " ").slice(0, 400), gen).slice(0, 6).forEach(function (s, i, l) {
    if (y > KART_BOY * 0.72 - 40) { return; }
    c.fillText(i === l.length - 1 && String(govde).length > 400 ? s + "…" : s, sol, y + 20); y += 46;
  });

  kartEtiket(c, "TentiforApp · " + KART_ADRES + " · Fan", sol, KART_BOY - 70, KART_RENK.yarik, 20);
  return t;
}

/* ==================== indirme, paylaşma, gönderme ==================== */

function fanBlob(e) { return new Blob([fanDosyaHtml(e)], { type: "text/html" }); }

function fanIndir(e) { kartIndir(fanBlob(e), fanDosyaAdi(e)); }

/** Telefonda paylaşım menüsü (WhatsApp, e-posta…); yoksa indirir. */
async function fanPaylas(e, metin) {
  try {
    const f = new File([fanBlob(e)], fanDosyaAdi(e), { type: "text/html" });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) {
      await navigator.share({ files: [f], title: fanAd(e), text: metin || fanAd(e) + " — TentiforApp fan eseri" });
      return "Paylaşıldı";
    }
  } catch (hata) {
    if (hata && hata.name === "AbortError") { return ""; }
  }
  fanIndir(e);
  return "Bu tarayıcı dosya paylaşamıyor; indirildi";
}

function fanEposta() {
  const a = String(veri.fanEposta || "").trim();
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(a) ? a : "";
}

function fanGonderBilgi(e) {
  const adres = fanEposta();
  if (!adres) {
    return '<div class="kutu-y fan-gonder"><p class="oyun-not">Fanmade olarak sitede yayımlanmasını istiyorsan dosyayı indirip yazara ulaştır. ' +
      "(Yazar bir gönderim adresi tanımladığında burada görünecek.)</p></div>";
  }
  const konu = e ? "TentiforApp fan " + (e.tur === "hikaye" ? "hikâyesi" : "evreni") + ": " + fanAd(e) : "TentiforApp fan eseri";
  const govde = "Merhaba,\n\nTentiforApp için bir fan " + (e ? (e.tur === "hikaye" ? "hikâyesi" : "evreni") : "eseri") +
    " gönderiyorum" + (e ? ": " + fanAd(e) : "") + ". Dosya ekte.\n\n";
  return '<div class="kutu-y fan-gonder">' +
    "<label>Yazara gönder</label>" +
    '<p class="oyun-not">Sitede fanmade olarak yayımlanması için dosyayı şu adrese gönder: <b class="fan-adres">' + kacir(adres) + "</b></p>" +
    '<ol class="fan-adimlar"><li>Dosyayı indir' + (e ? " ya da Paylaş ile e-posta uygulamasını seç" : "") + ".</li>" +
      "<li>E-postayı aç ve dosyayı ekle — e-posta bağlantısı dosyayı kendisi ekleyemez.</li>" +
      "<li>Yazar dosyayı açıp beğenirse sitede fanmade olarak yayımlar.</li></ol>" +
    '<div class="oyun-sira">' +
      (e ? '<button class="dugme" data-fan-eposta-paylas="' + e.tur + '">Dosyayla e-posta at</button>' : "") +
      '<a class="dugme dugme-sade" href="mailto:' + adres + "?subject=" + encodeURIComponent(konu) + "&body=" + encodeURIComponent(govde) + '">E-postayı aç</a>' +
      '<button class="dugme dugme-sade" data-fan-adres-kopyala>Adresi kopyala</button>' +
    "</div></div>";
}

/* ==================== olaylar ==================== */

let fanKayitZaman = null;
let fanBekleyen = {};   /* "tur|yol" → { tur, yol, deger }: hızlı alan değiştirmede hiçbir yazım kaybolmasın */

document.addEventListener("input", function (ev) {
  const el = ev.target.closest && ev.target.closest("[data-fan-alan]");
  if (!el) { return; }
  const form = el.closest("[data-fan-form]");
  if (!form) { return; }
  const tur = form.dataset.fanForm;
  const yol = el.dataset.fanAlan;
  const hedef = form.dataset.fanHedef || "";
  fanBekleyen[tur + "|" + hedef + "|" + yol] = { tur: tur, yol: yol, deger: el.value, hedef: hedef };
  clearTimeout(fanKayitZaman);
  fanKayitZaman = setTimeout(fanBekleyeniYaz, 300);
  /* sayaç hemen tepki versin */
  if (yol === "metin") { const s = document.querySelector("[data-fan-sayac]"); if (s) { s.textContent = fanKelime(el.value) + " kelime"; } }
});

/** Bekleyen yazımları hemen kaydeder (düğmeye basmadan, sayfadan çıkmadan önce). */
function fanBekleyeniYaz() {
  clearTimeout(fanKayitZaman);
  fanKayitZaman = null;
  const b = fanBekleyen;
  fanBekleyen = {};
  Object.keys(b).forEach(function (k) { fanAlanYaz(b[k].tur, b[k].yol, b[k].deger, b[k].hedef); });
}

window.addEventListener("pagehide", fanBekleyeniYaz);

document.addEventListener("change", function (ev) {
  if (ev.target.matches && ev.target.matches("[data-fan-dosya]")) {
    fanDosyaAc(ev.target.files && ev.target.files[0]);
    ev.target.value = "";
  }
});

document.addEventListener("dragover", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-fan-birak]");
  if (b) { ev.preventDefault(); b.classList.add("uzerinde"); }
});
document.addEventListener("dragleave", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-fan-birak]");
  if (b) { b.classList.remove("uzerinde"); }
});
document.addEventListener("drop", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-fan-birak]");
  if (!b) { return; }
  ev.preventDefault();
  b.classList.remove("uzerinde");
  fanDosyaAc(ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]);
});

document.addEventListener("click", async function (ev) {
  const h = ev.target.closest("[data-fan-sekme], [data-fan-yeni], [data-fan-sec], [data-fan-ekle], [data-fan-cikar], [data-fan-indir], " +
    "[data-fan-paylas], [data-fan-onizle], [data-fan-gonder], [data-fan-sil], [data-fan-ac], [data-fan-p], [data-fan-eposta-paylas], [data-fan-adres-kopyala]");
  if (!h) { return; }
  const d = h.dataset;
  fanBekleyeniYaz();

  if (d.fanSekme) {
    const p = d.fanSekme.split(":");
    fanSekme[p[0]] = p[1];
    fanCiz(p[0]);
    return;
  }
  if (d.fanYeni) { fanYeni(d.fanYeni); fanSekme[d.fanYeni] = "yaz"; fanCiz(d.fanYeni); return; }
  if (d.fanSec) { const p = d.fanSec.split(":"); fanSecili[p[0]] = p[1]; fanSilOnay = null; fanCiz(p[0]); return; }
  if (d.fanEkle || d.fanCikar) {
    const l = fanEserlerim();
    const formu = h.closest("[data-fan-form]");
    const hedefId = (formu && formu.dataset.fanHedef) || fanSecili.evren;
    const e = l.find(function (x) { return x.id === hedefId; });
    if (!e) { return; }
    if (d.fanEkle) {
      const g = FAN_EVREN_GRUPLARI.find(function (x) { return x.k === d.fanEkle; });
      const o = {};
      g.alanlar.forEach(function (a) { o[a[0]] = ""; });
      (e[g.k] = e[g.k] || []).push(o);
    } else {
      const p = d.fanCikar.split(":");
      (e[p[0]] || []).splice(Number(p[1]), 1);
    }
    fanEserlerimYaz(l);
    fanCiz("evren");
    return;
  }
  if (d.fanSil) {
    const e = fanDuzenlenen(d.fanSil);
    if (!e) { return; }
    if (fanSilOnay !== e.id) { fanSilOnay = e.id; fanCiz(d.fanSil); return; }
    fanSilOnay = null;
    fanEserlerimYaz(fanEserlerim().filter(function (x) { return x.id !== e.id; }));
    fanSecili[d.fanSil] = null;
    fanCiz(d.fanSil);
    return;
  }

  const tur = d.fanIndir || d.fanPaylas || d.fanOnizle || d.fanGonder || d.fanEpostaPaylas;
  if (tur) {
    const e = fanTemizle(fanDuzenlenen(tur));
    const durum = document.querySelector('[data-fan-kayit="' + tur + '"]');
    if (!e) { if (durum) { durum.textContent = tur === "hikaye" ? "Önce bir başlık ya da metin yaz" : "Önce evrenine bir ad ver"; } return; }
    if (d.fanIndir) { fanIndir(e); if (durum) { durum.textContent = "İndirildi: " + fanDosyaAdi(e); } }
    else if (d.fanPaylas) { const s = await fanPaylas(e); if (durum && s) { durum.textContent = s; } }
    else if (d.fanOnizle) { fanPencere(e, "benim"); }
    else if (d.fanGonder) { const a = document.querySelector('[data-fan-gonder-alan="' + tur + '"]'); if (a) { a.innerHTML = fanGonderBilgi(e); } }
    else if (d.fanEpostaPaylas) { const s = await fanPaylas(e, fanAd(e) + " — TentiforApp fan eseri. Alıcı: " + fanEposta()); if (durum && s) { durum.textContent = s; } }
    return;
  }
  if (d.fanAdresKopyala !== undefined) {
    if (typeof panoyaKopyala === "function") { panoyaKopyala(fanEposta()).then(function () { h.textContent = "Kopyalandı"; }); }
    return;
  }
  if (d.fanAc) {
    const p = d.fanAc.split(":");
    const e = fanBul(p[0], p[1], p.slice(2).join(":"));
    if (e) { fanPencere(e, p[0]); }
    return;
  }
  if (d.fanP && fanAcik) {
    const e = fanAcik.eser;
    if (d.fanP === "indir") { fanIndir(e); fanPDurum("İndirildi: " + fanDosyaAdi(e), true); }
    else if (d.fanP === "kapak") {
      const t = await fanKapakUret(e);
      if (!t) { fanPDurum("Tarayıcı görsel üretmeyi desteklemiyor", false); return; }
      const s = await kartPaylas(t, fanSlug(fanAd(e)) + "-kapak.png", fanAd(e) + " — " + (e.tur === "hikaye" ? "fan hikâyesi" : "fan evreni"));
      if (s) { fanPDurum(s, true); }
    }
    else if (d.fanP === "paylas") { const s = await fanPaylas(e); if (s) { fanPDurum(s, true); } }
    else if (d.fanP === "baglanti") {
      const adres = rotaAdresi("#/fan/" + e.tur + "/" + encodeURIComponent(e.id));
      if (typeof panoyaKopyala === "function") { panoyaKopyala(adres).then(function () { fanPDurum("Bağlantı kopyalandı", true); }); }
    } else if (d.fanP === "kopyala") {
      const l = fanEserlerim();
      const kopya = JSON.parse(JSON.stringify(e));
      if (l.some(function (x) { return x.id === kopya.id; })) { kopya.id = fanId(); }
      kopya.guncelleme = new Date().toISOString();
      delete kopya.eklenme;
      l.push(kopya);
      if (!fanEserlerimYaz(l)) { fanPDurum("Tarayıcının alanı doldu", false); return; }
      fanSecili[e.tur] = kopya.id;
      fanSekme[e.tur] = "yaz";
      fanCiz(e.tur);
      fanPDurum("Taslaklarına eklendi — " + (e.tur === "hikaye" ? "Fan hikâyeleri" : "Fan evrenleri") + " → düzenle", true);
    } else if (d.fanP === "e99") {
      fanPDurum(e99Birlestir(e) ? "E99'a eklendi. Yayına almak için panelde Bakım → Kaydet, sonra Yayınla." : "Bu katkı zaten E99'da.", true);
    } else if (d.fanP === "siteye") {
      if (fanSiteyeEkle(e)) { fanPDurum("Fanmade olarak eklendi. Yayına almak için panelde Bakım → Kaydet.", true); }
    } else if (d.fanP === "kaldir") {
      fanSitedenKaldir(e);
      fanPDurum("Siteden kaldırıldı. Yayına almak için Bakım → Kaydet.", true);
    }
  }
});
