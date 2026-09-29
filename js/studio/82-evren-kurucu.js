/* Sürüm 3.0 — Evren Kurucu: kendi evrenin 24. Evren (Tömye) kadar derin olabilsin.

   Yeni bilgi türleri (js/studio/40-fan-atolye.js, FAN_EVREN_GRUPLARI): zengin kişi kayıtları (yaş, yer, söz, etiket),
   çağlara ayrılan tarih, belgeler (mektup, günlük, alıntı…), evrenin kendi takvimi (aylar, özel günler, yıl sayımı).
   Okur için: kişi kartları, bağlardan aile ağacı, çağlara göre zaman çizelgesi, takvim, belge kâğıtları ve
   evrenin içindekiler şeridi. Kurucu için: "🧭 Kurucu" sekmesi — adım adım (Temel, Dünya, Kişiler, Zaman, Belgeler,
   Görünüm, Paylaş), her adımda yalnızca o adımın alanları, üstte "Tömye ölçeği": evreninin her yönü 24. Evren'in
   aynı yönüyle karşılaştırılır (hedefler sitenin kendi verisinden hesaplanır, Tömye büyüdükçe hedef de büyür). */

/* ==================== takvim bilgisi (yıl sayımı, hafta, bugün) ==================== */

function evrTakvimTemizle(t) {
  if (!t || typeof t !== "object") { return null; }
  const o = { yil: fanMetin(t.yil, 120), hafta: fanMetin(t.hafta, 300), bugun: fanMetin(t.bugun, 80) };
  return (o.yil.trim() || o.hafta.trim() || o.bugun.trim()) ? o : null;
}

/* ==================== yardımcılar ==================== */

function evrDolu(x) { return !!x && Object.keys(x).some(function (k) { return typeof x[k] === "string" && x[k].trim(); }); }
function evrListe(e, k) { return (Array.isArray(e && e[k]) ? e[k] : []).filter(evrDolu); }
function evrSlug(s) {
  return String(s || "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}
function evrKisa(s, n) { s = String(s || "").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

/* ---------- aile: bağlardan ebeveyn, eş, kardeş ---------- */

const EVR_EBEVEYN = /^(anne|annesi|baba|babası|ebeveyn|ebeveyni|ana|anası)$/i;
const EVR_ES = /^(eş|eşi|karısı|kocası|karı|koca|sevgili|nişanlı)$/i;
const EVR_KARDES = /^(kardeş|kardeşi|abla|ablası|abi|abisi|ağabey|ikiz|ikizi)$/i;
const EVR_COCUK = /^(çocuk|çocuğu|oğul|oğlu|kız|kızı|evlat|evladı)$/i;

/** Bağlardan aile: { ebeveyn: {çocuk: [ebeveynler]}, esler: [[a,b]], kisiler: [ad] }.
    "A — anne — B": A, B'nin annesi. "A — oğlu — B": A, B'nin oğlu (B ebeveyn). */
function evrAile(e) {
  const eb = {}, esler = [], kardes = [], kisiler = [];
  const ekle = function (ad) { if (kisiler.indexOf(ad) === -1) { kisiler.push(ad); } };
  (Array.isArray(e.baglar) ? e.baglar : []).forEach(function (b) {
    const et = String(b.etiket || "").trim();
    if (EVR_EBEVEYN.test(et)) { (eb[b.b] = eb[b.b] || []).push(b.a); ekle(b.a); ekle(b.b); }
    else if (EVR_COCUK.test(et)) { (eb[b.a] = eb[b.a] || []).push(b.b); ekle(b.a); ekle(b.b); }
    else if (EVR_ES.test(et)) { esler.push([b.a, b.b]); ekle(b.a); ekle(b.b); }
    else if (EVR_KARDES.test(et)) { kardes.push([b.a, b.b]); ekle(b.a); ekle(b.b); }
  });
  return { ebeveyn: eb, esler: esler, kardes: kardes, kisiler: kisiler };
}

/** Aile ağacı (SVG): kuşaklar satır satır, ebeveyn → çocuk çizgileri, eşler arası çift çizgi. */
function evrAileSvg(e) {
  const a = evrAile(e);
  if (!Object.keys(a.ebeveyn).length && !a.esler.length) { return ""; }
  /* kuşak: ebeveyni olmayan 0; çocuk = en büyük ebeveyn kuşağı + 1; eşler ve kardeşler aynı kuşağa çekilir */
  const kusak = {};
  a.kisiler.forEach(function (k) { kusak[k] = 0; });
  for (let tur = 0; tur < 12; tur++) {
    let degisti = false;
    Object.keys(a.ebeveyn).forEach(function (c) {
      a.ebeveyn[c].forEach(function (p) { if (kusak[c] <= kusak[p]) { kusak[c] = kusak[p] + 1; degisti = true; } });
    });
    a.esler.concat(a.kardes).forEach(function (s) {
      const m = Math.max(kusak[s[0]], kusak[s[1]]);
      if (kusak[s[0]] !== m || kusak[s[1]] !== m) { kusak[s[0]] = kusak[s[1]] = m; degisti = true; }
    });
    if (!degisti) { break; }
  }
  const satirlar = [];
  a.kisiler.forEach(function (k) { (satirlar[kusak[k]] = satirlar[kusak[k]] || []).push(k); });
  /* eşler yan yana */
  satirlar.forEach(function (s) {
    if (!s) { return; }
    s.sort(function (x, y) {
      const ex = a.esler.find(function (p) { return p[0] === x || p[1] === x; }), ey = a.esler.find(function (p) { return p[0] === y || p[1] === y; });
      const kx = ex ? ex.slice().sort().join("|") : x, ky = ey ? ey.slice().sort().join("|") : y;
      return kx.localeCompare(ky, "tr") || x.localeCompare(y, "tr");
    });
  });
  const G = 118, Y = 70, en = Math.max.apply(null, satirlar.map(function (s) { return s ? s.length : 0; }));
  const W = Math.max(1, en) * G + 20, H = satirlar.length * Y + 10;
  const yer = {};
  satirlar.forEach(function (s, i) {
    if (!s) { return; }
    const bas = (W - s.length * G) / 2;
    s.forEach(function (k, j) { yer[k] = { x: bas + j * G + G / 2, y: 10 + i * Y + 18 }; });
  });
  const esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };
  let cizgi = "";
  Object.keys(a.ebeveyn).forEach(function (c) {
    a.ebeveyn[c].forEach(function (p) {
      const u = yer[p], v = yer[c];
      if (!u || !v) { return; }
      const orta = (u.y + v.y) / 2;
      cizgi += '<path class="evr-aile-cizgi" d="M' + u.x.toFixed(1) + " " + (u.y + 14) + " V" + orta.toFixed(1) + " H" + v.x.toFixed(1) + " V" + (v.y - 14) + '"/>';
    });
  });
  a.esler.forEach(function (s) {
    const u = yer[s[0]], v = yer[s[1]];
    if (u && v && u.y === v.y) { cizgi += '<line class="evr-aile-es" x1="' + u.x.toFixed(1) + '" y1="' + u.y + '" x2="' + v.x.toFixed(1) + '" y2="' + v.y + '"/>'; }
  });
  const kutular = Object.keys(yer).map(function (k) {
    const p = yer[k];
    return '<g class="evr-aile-kisi"><rect x="' + (p.x - 52).toFixed(1) + '" y="' + (p.y - 14) + '" width="104" height="28" rx="8"/>' +
      '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 4) + '" text-anchor="middle">' + esc(evrKisa(k, 16)) + "</text><title>" + esc(k) + "</title></g>";
  }).join("");
  return '<figure class="evr-aile"><figcaption>Aile ağacı</figcaption><div class="evr-aile-kaydir"><svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Aile ağacı: ' +
    esc(a.kisiler.join(", ")) + '">' + cizgi + kutular + "</svg></div></figure>";
}

/* ==================== okur görünümleri ==================== */

/** Kişi kartları; evren sayfasında adına dokununca kişi sayfası açılır (dosyada düz ad). */
function evrKisilerCiz(liste, e, dosya) {
  if (!liste.length) { return ""; }
  if (liste.some(function (x) { return x.kutu; })) { return null; }   /* E25 konuk kutuları: eski görünüm */
  const baglar = Array.isArray(e.baglar) ? e.baglar : [];
  const kart = function (x) {
    const ust = [x.rol, x.yas ? "yaş " + x.yas : "", x.yer].map(function (s) { return String(s || "").trim(); }).filter(Boolean);
    const b = baglar.filter(function (g) { return g.a === x.ad || g.b === x.ad; }).slice(0, 6).map(function (g) {
      return (g.a === x.ad ? g.b : g.a) + (g.etiket ? " (" + g.etiket + ")" : "");
    });
    const et = String(x.etiketler || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 8);
    const ad = kacir(x.ad || "Adsız");
    return '<article class="evr-kisi"><h3>' + (dosya ? ad : '<button type="button" class="evr-kisi-ad" data-evr-kisi="' + ad + '">' + ad + "</button>") + "</h3>" +
      (ust.length ? '<p class="evr-kisi-ust">' + ust.map(kacir).join(" · ") + "</p>" : "") +
      paragraf(x.aciklama) +
      (String(x.soz || "").trim() ? '<blockquote class="evr-soz">“' + kacir(x.soz.trim()) + "”</blockquote>" : "") +
      (et.length ? '<p class="evr-etiketler">' + et.map(function (t) { return "<span>" + kacir(t) + "</span>"; }).join("") + "</p>" : "") +
      (b.length ? '<p class="evr-kisi-bag"><b>Bağları:</b> ' + b.map(kacir).join(" · ") + "</p>" : "") + "</article>";
  };
  return '<div class="evr-kisiler">' + liste.map(kart).join("") + "</div>" + evrAileSvg(e);
}

function evrTarihCiz(liste) {
  if (!liste.length) { return ""; }
  const gruplar = [];
  liste.forEach(function (x) {
    const c = String(x.cag || "").trim();
    let g = gruplar.find(function (y) { return y.cag === c; });
    if (!g) { g = { cag: c, l: [] }; gruplar.push(g); }
    g.l.push(x);
  });
  return '<div class="evr-zaman">' + gruplar.map(function (g) {
    return (g.cag ? '<h3 class="evr-cag">' + kacir(g.cag) + "</h3>" : "") +
      '<ol class="evr-zaman-liste">' + g.l.map(function (x) {
        return '<li><span class="evr-zaman-an">' + kacir(x.zaman || "—") + "</span><div>" + paragraf(x.olay) + "</div></li>";
      }).join("") + "</ol>";
  }).join("") + "</div>";
}

function evrBelgelerCiz(liste) {
  if (!liste.length) { return ""; }
  return '<div class="evr-belgeler">' + liste.map(function (x) {
    const tur = String(x.tur || "Belge").trim() || "Belge";
    const kim = [x.kimden ? String(x.kimden).trim() : "", x.kime ? "→ " + String(x.kime).trim() : ""].filter(Boolean).join(" ");
    const alinti = /^al[ıi]nt[ıi]$/i.test(tur);
    return '<article class="evr-belge evr-belge-' + evrSlug(tur) + '"><header><span class="evr-belge-tur">' + kacir(tur) + "</span>" +
      (String(x.baslik || "").trim() ? "<h3>" + kacir(x.baslik) + "</h3>" : "") +
      ((kim || x.tarih) ? '<p class="evr-belge-kim">' + kacir(kim) + (kim && x.tarih ? " · " : "") + kacir(x.tarih || "") + "</p>" : "") + "</header>" +
      (alinti ? '<blockquote class="evr-belge-metin">' + paragraf(x.metin) + "</blockquote>" : '<div class="evr-belge-metin">' + paragraf(x.metin) + "</div>") +
      "</article>";
  }).join("") + "</div>";
}

/** Özel günün ayı: ay adı ya da sırası (1'den). */
function evrAyBul(aylar, ay) {
  const s = String(ay || "").trim();
  if (!s) { return -1; }
  const n = parseInt(s, 10);
  if (String(n) === s && n >= 1 && n <= aylar.length) { return n - 1; }
  const k = s.toLocaleLowerCase("tr");
  return aylar.findIndex(function (a) { return String(a.ad || "").trim().toLocaleLowerCase("tr") === k; });
}

function evrTakvimCiz(aylar, e) {
  const etk = evrListe(e, "etkinlikler");
  const t = e.takvim || {};
  if (!aylar.length && !etk.length && !evrTakvimTemizle(t)) { return ""; }
  const gunSay = function (a) { const n = parseInt(a.gun, 10); return n > 0 && n < 1000 ? n : 30; };
  const yilGun = aylar.reduce(function (s, a) { return s + gunSay(a); }, 0);
  const hafta = String(t.hafta || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  const bilgi = [
    t.yil ? "<div><b>Yıl sayımı:</b> " + kacir(t.yil) + "</div>" : "",
    aylar.length ? "<div><b>Bir yıl:</b> " + aylar.length + " ay, " + yilGun + " gün</div>" : "",
    hafta.length ? "<div><b>Hafta:</b> " + hafta.length + " gün (" + hafta.map(kacir).join(", ") + ")</div>" : "",
    t.bugun ? "<div><b>Evrenin bugünü:</b> " + kacir(t.bugun) + "</div>" : ""
  ].join("");
  const kalan = etk.filter(function (x) { return evrAyBul(aylar, x.ay) === -1; });
  return '<div class="evr-takvim">' + (bilgi ? '<div class="bilgi evr-takvim-bilgi">' + bilgi + "</div>" : "") +
    (aylar.length ? '<ol class="evr-aylar">' + aylar.map(function (a, i) {
      const gunler = etk.filter(function (x) { return evrAyBul(aylar, x.ay) === i; })
        .sort(function (x, y) { return (parseInt(x.gun, 10) || 0) - (parseInt(y.gun, 10) || 0); });
      return '<li class="evr-ay"><div class="evr-ay-bas"><span class="evr-ay-no">' + (i + 1) + "</span><b>" + kacir(a.ad || (i + 1) + ". ay") + "</b>" +
        '<span class="evr-ay-gun">' + gunSay(a) + " gün</span></div>" +
        (String(a.not || "").trim() ? '<p class="evr-ay-not">' + kacir(a.not) + "</p>" : "") +
        (gunler.length ? '<ul class="evr-ozel">' + gunler.map(function (x) {
          return "<li><b>" + kacir(x.gun ? x.gun + ". gün" : "") + (x.gun ? " · " : "") + kacir(x.ad || "") + "</b>" + (String(x.metin || "").trim() ? " — " + kacir(evrKisa(x.metin, 220)) : "") + "</li>";
        }).join("") + "</ul>" : "") + "</li>";
    }).join("") + "</ol>" : "") +
    (kalan.length ? '<h3 class="evr-cag">Özel günler</h3><ul class="evr-ozel">' + kalan.map(function (x) {
      return "<li><b>" + kacir([x.ay, x.gun ? x.gun + ". gün" : ""].filter(Boolean).join(" · ") || "Tarihsiz") + " · " + kacir(x.ad || "") + "</b>" +
        (String(x.metin || "").trim() ? " — " + kacir(evrKisa(x.metin, 220)) : "") + "</li>";
    }).join("") + "</ul>" : "") + "</div>";
}

/* grupların okur görünümleri (40-fan-atolye.js fanEserGovde bunları kullanır; null → eski görünüm) */
(function () {
  if (typeof FAN_EVREN_GRUPLARI === "undefined") { return; }
  const g = function (k) { return FAN_EVREN_GRUPLARI.find(function (x) { return x.k === k; }); };
  if (g("kisiler")) { g("kisiler").ciz = evrKisilerCiz; }
  if (g("tarih")) { g("tarih").ciz = function (l) { return evrTarihCiz(l); }; }
  if (g("belgeler")) { g("belgeler").ciz = function (l) { return evrBelgelerCiz(l); }; }
  if (g("aylar")) { g("aylar").ciz = function (l, e) { return evrTakvimCiz(l, e); }; g("aylar").ad = "Takvim"; }
  /* özel günler takvimin içinde gösterilir */
  if (g("etkinlikler")) { g("etkinlikler").ciz = function () { return ""; }; }
})();

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evr-git]");
  if (!b) { return; }
  const kap = b.closest(".fan-oku, #evrenSayfa, .pencere") || document;
  const s = kap.querySelector('section.fan-grup[data-grup="' + b.getAttribute("data-evr-git") + '"]');
  if (s) { s.scrollIntoView({ behavior: "smooth", block: "start" }); }
});

/* ==================== Tömye ölçeği ==================== */

/** Hedefler 24. Evren'in (Tömye) kendi verisinden: Tömye büyüdükçe hedef de büyür. */
function evrOlcekHedefleri() {
  const v = typeof veri !== "undefined" && veri ? veri : {};
  const n = function (l) { return Array.isArray(l) ? l.length : 0; };
  const yer = (v.haritalar || []).reduce(function (s, h) { return s + n(h && h.yerler); }, 0);
  return {
    kisiler: Math.max(8, (v.karakterler || []).filter(function (k) { return k.kart !== false; }).length),
    dunya: Math.max(8, n(v.evren)),
    yerler: Math.max(6, yer),
    tarih: Math.max(6, n(v.zamanCizelgesi)),
    baglar: Math.max(6, n((v.ag || {}).baglar)),
    belgeler: Math.max(6, n(v.mektuplar) + n(v.gunlukler) + n(v.alintilar)),
    sozluk: Math.max(6, n(v.sozluk)),
    takvim: Math.max(4, n((v.takvim || {}).aylar) + n(v.takvimEtkinlikleri)),
    gizli: Math.max(3, n(v.katmanlar)),
    anlati: Math.max(2, n((v.roman || {}).bolumler))
  };
}

function evrOlcek(e) {
  const h = evrOlcekHedefleri();
  const yerler = (((e.harita || {}).yerler) || []).length + (e.gezegenler || []).reduce(function (s, g) { return s + (((g.harita || {}).yerler) || []).length; }, 0);
  const satir = [
    ["kisiler", "Kişiler", evrListe(e, "kisiler").length, "kisiler"],
    ["dunya", "Dünya (kurallar, yerler, kendi alanların)", evrListe(e, "kurallar").length + evrListe(e, "ozelAlanlar").length + evrListe(e, "yerler").length, "dunya"],
    ["yerler", "Haritadaki yerler", yerler, "harita"],
    ["tarih", "Tarih", evrListe(e, "tarih").length, "zaman"],
    ["baglar", "Bağlar (ilişki ağı)", (Array.isArray(e.baglar) ? e.baglar : []).length, "ag"],
    ["belgeler", "Belgeler", evrListe(e, "belgeler").length, "belgeler"],
    ["sozluk", "Sözlük", evrListe(e, "sozluk").length, "belgeler"],
    ["takvim", "Takvim (ay ve özel gün)", evrListe(e, "aylar").length + evrListe(e, "etkinlikler").length, "zaman"],
    ["gizli", "Gizli katmanlar (kilitli lore)", (e.lorlar || []).length, "lore"],
    ["anlati", "Anlatı (roman bölümleri)", (((e.roman || {}).bolumler) || []).length, "roman"]
  ].map(function (r) { return { id: r[0], ad: r[1], n: r[2], hedef: h[r[0]], adim: r[3], oran: Math.min(1.5, r[2] / h[r[0]]) }; });
  const yuzde = Math.round(100 * satir.reduce(function (s, r) { return s + Math.min(1, r.oran); }, 0) / satir.length);
  const ustun = satir.every(function (r) { return r.oran >= 1; });
  return { satir: satir, yuzde: ustun ? Math.round(100 * satir.reduce(function (s, r) { return s + r.oran; }, 0) / satir.length) : yuzde, ustun: ustun };
}

/* ==================== Kurucu sekmesi ==================== */

/* ---------- 4.5: Kalıcı Kurucu Kimliği & Uzaktan Cihazlar Arası Kontrol ---------- */

const KURUCU_ANAHTAR_DEPO = "tentiforapp_kurucu_anahtarlar";

function evrenKurucuKimligi() {
  if (typeof hesapProfil !== "undefined" && hesapProfil && hesapProfil.kullanici_adi) {
    return "kullanici:@" + hesapProfil.kullanici_adi;
  }
  let kimlik = "";
  try {
    kimlik = localStorage.getItem("tentiforapp_kurucu_kimlik") || "";
    if (!kimlik) {
      kimlik = "yazar-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
      localStorage.setItem("tentiforapp_kurucu_kimlik", kimlik);
    }
  } catch (_) {
    kimlik = typeof buCihazId === "function" ? ("cihaz:" + buCihazId()) : "yazar-gecici";
  }
  return kimlik;
}

function evrenKurucuAnahtarUret(evrenId) {
  let anahtarlar = {};
  try { anahtarlar = JSON.parse(localStorage.getItem(KURUCU_ANAHTAR_DEPO) || "{}"); } catch (_) {}
  if (anahtarlar[evrenId]) { return anahtarlar[evrenId]; }
  const anahtar = "t4k_" + evrenId + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  anahtarlar[evrenId] = anahtar;
  try { localStorage.setItem(KURUCU_ANAHTAR_DEPO, JSON.stringify(anahtarlar)); } catch (_) {}
  return anahtar;
}

function evrenKurucuKimlikDamgala(e) {
  if (!e || e.tur !== "evren") { return; }
  e.kurucuKimligi = e.kurucuKimligi || evrenKurucuKimligi();
  e.kurucuAnahtari = e.kurucuAnahtari || evrenKurucuAnahtarUret(e.id);
  e.cihazKimligi = typeof buCihazId === "function" ? buCihazId() : "c-yerel";
  try {
    const anahtarlar = JSON.parse(localStorage.getItem(KURUCU_ANAHTAR_DEPO) || "{}");
    anahtarlar[e.id] = e.kurucuAnahtari;
    localStorage.setItem(KURUCU_ANAHTAR_DEPO, JSON.stringify(anahtarlar));
  } catch (_) {}
}

function evrenKurucuDosyaKontrol(e) {
  if (!e || e.tur !== "evren") { return false; }
  const benimKimlik = evrenKurucuKimligi();
  let anahtarlar = {};
  try { anahtarlar = JSON.parse(localStorage.getItem(KURUCU_ANAHTAR_DEPO) || "{}"); } catch (_) {}

  const ayniKimlik = e.kurucuKimligi && (e.kurucuKimligi === benimKimlik);
  const ayniAnahtar = e.kurucuAnahtari && (anahtarlar[e.id] === e.kurucuAnahtari);
  const dosyaAnahtariVar = !!(e.kurucuAnahtari && e.kurucuKimligi);

  if (ayniKimlik || ayniAnahtar || dosyaAnahtariVar) {
    if (e.kurucuAnahtari) {
      anahtarlar[e.id] = e.kurucuAnahtari;
      try { localStorage.setItem(KURUCU_ANAHTAR_DEPO, JSON.stringify(anahtarlar)); } catch (_) {}
    }
    const liste = typeof fanEserlerim === "function" ? fanEserlerim() : [];
    const idx = liste.findIndex(function (x) { return x.id === e.id; });
    if (idx !== -1) {
      liste[idx] = e;
    } else {
      liste.push(e);
    }
    if (typeof fanEserlerimYaz === "function") {
      fanEserlerimYaz(liste);
    }
    if (typeof eckaBildir === "function") {
      eckaBildir("🔑 Kurucu Kimliğin Doğrulandı: Bu evrenin tam yöneticisi sensin! Evren 'Senin Evrenlerin' altına eklendi.");
    }
    setTimeout(function() {
      location.hash = "#/ev/benim/" + e.id;
    }, 200);
    return true;
  }
  return false;
}

/* ---------- 4.5: Yerel Güvenlik Hafızası & Zaman Makinesi (Undo) ---------- */

const EVR_UNDO_ANAHTAR = "tentiforapp_evren_undo_";
const EVR_UNDO_LIMIT = 20;

function evrUndoKaydet(e) {
  if (!e || !e.id) { return; }
  try {
    const k = EVR_UNDO_ANAHTAR + e.id;
    const stack = JSON.parse(sessionStorage.getItem(k) || "[]");
    const kopya = JSON.stringify(e);
    if (stack.length && stack[stack.length - 1] === kopya) { return; }
    stack.push(kopya);
    if (stack.length > EVR_UNDO_LIMIT) { stack.shift(); }
    sessionStorage.setItem(k, JSON.stringify(stack));
  } catch (_) {}
}

function evrGeriAl(evrenId) {
  try {
    const k = EVR_UNDO_ANAHTAR + evrenId;
    const stack = JSON.parse(sessionStorage.getItem(k) || "[]");
    if (stack.length <= 1) {
      if (typeof eckaBildir === "function") { eckaBildir("Daha önceki bir düzenleme geçmişi bulunamadı."); }
      return;
    }
    stack.pop();
    const onceki = JSON.parse(stack[stack.length - 1]);
    sessionStorage.setItem(k, JSON.stringify(stack));
    evrenBenimDegistir(evrenId, function (x) {
      Object.assign(x, onceki);
    });
    if (typeof eckaBildir === "function") { eckaBildir("↶ Önceki düzenlemeye başarıyla geri dönüldü!"); }
    if (typeof evrenSayfaCiz === "function") { evrenSayfaCiz(); }
  } catch (err) {
    if (typeof eckaBildir === "function") { eckaBildir("Geri alma hatası: " + err.message); }
  }
}

/* ---------- 4.5: Dünya Fısıltısı (İlham Zarı) ---------- */

const DUNYA_FISILTILARI = [
  "Bu dünyada gece olunca gökyüzünde yıldız yerine ne parlar?",
  "Burada ışık veya ses nasıl yayılır; yavaşlayan ya da hızlanan bir şey var mı?",
  "İnsanlar burada birbirine selam verirken hangi tuhaf geleneği uygular?",
  "Bu coğrafyada yaşayanların en büyük korkusu hangi doğa veya gök olayıdır?",
  "Bu evrende paranın yerine geçen en değerli ve kadim takas nesnesi nedir?",
  "Burada herkesin bildiği ama asla yüksek sesle söylenmeyen gizemli yasak nedir?",
  "Herkesin saçına, bileğine veya boynuna bağlı olan konuşan/titreşen nesne nedir?",
  "Bu gezegenin merkezinde asılı duran ve asla sönmeyen kadim ışık kaynağı nedir?",
  "Yılda yalnızca bir gün su yüzüne çıkan ya da görünür olan kayıp kıta neresidir?",
  "Bu evrende bir yalan söylendiğinde fiziksel olarak ne renk bir duman çıkar?",
  "Ölenlerin anıları burada nereye gömülür; taşlara mı, ağaç kabuklarına mı?",
  "Rüzgar estiğinde sokaklarda hangi enstrümanın melodisi yankılanır?"
];

let evrSonFisilti = "";

function evrFisiltiSec() {
  const i = Math.floor(Math.random() * DUNYA_FISILTILARI.length);
  evrSonFisilti = DUNYA_FISILTILARI[i];
  return evrSonFisilti;
}

function evrFisiltiHtml(e) {
  const f = evrSonFisilti || evrFisiltiSec();
  return '<div class="evr-fisilti-kutu">' +
    '<div class="evr-fisilti-ust"><span>🎲 DÜNYA FISILTISI (İlham Zarı)</span><button type="button" class="dugme dugme-sade" style="font-size:11px; padding:3px 8px;" data-evr-fisilti-zar="1">Yeniden Fısılda 🎲</button></div>' +
    '<div class="evr-fisilti-metin">“' + kacir(f) + '”</div>' +
    '<div class="evr-fisilti-aksiyonlar">' +
      '<button type="button" class="dugme dugme-sade" style="font-size:12px; padding:4px 10px;" data-evr-fisilti-kullan="' + kacir(f) + '">+ Bu Soruyu Kural/Not Olarak Ekle</button>' +
    '</div>' +
  '</div>';
}

/* ---------- 4.5: 4D Gezegen Tasarımcısı (Galaktik Seyrüsefer Entegrasyonu) ---------- */

const EVR_RENK_PALETI = [
  { renk: "#3A7CA5", hale: "#81C3D7", ad: "Okyanus / Arşiv" },
  { renk: "#48CAE4", hale: "#ADE8F4", ad: "Buzul / Geçit" },
  { renk: "#00F5D4", hale: "#7B2CBF", ad: "Sibernetik / Neon" },
  { renk: "#7209B7", hale: "#4CC9F0", ad: "Kozmik / Şomdo" },
  { renk: "#9D4EDD", hale: "#C77DFF", ad: "Ametist / Kristal" },
  { renk: "#FB8500", hale: "#023047", ad: "Çift-Yüz / Termal" },
  { renk: "#E09F3E", hale: "#FFF3B0", ad: "Gaz Devi / Altın" }
];

function evrGezegenTasarimHtml(e) {
  const go = e.gezegenOzellikleri || {};
  const aktifRenk = go.renk || "#9D4EDD";
  const aktifHale = go.hale || "#C77DFF";
  const halkaVar = !!go.halka;
  const coklu = Array.isArray(e.gezegenler) && e.gezegenler.length > 0;

  return '<div class="evr-gezegen-tasarim">' +
    '<div class="evr-gt-baslik"><span>🪐</span> 4. BOYUT GEZEGEN & SİSTEM TASARIMI</div>' +
    '<div class="evr-gt-grid">' +
      '<div>' +
        '<label><b>Sistem Yapısı</b></label>' +
        '<div class="oyun-sira" style="margin-top:4px;">' +
          '<button type="button" class="dugme ' + (!coklu ? "" : "dugme-sade") + '" data-evr-gt-sistem="tek">Tek Dünyalı Evren</button>' +
          '<button type="button" class="dugme ' + (coklu ? "" : "dugme-sade") + '" data-evr-gt-sistem="coklu">Çok Gezegenli Sistem</button>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<label><b>Gezegen Yüzey & Atmosfer Rengi</b></label>' +
        '<div class="evr-renk-paleti">' +
          EVR_RENK_PALETI.map(function(p) {
            return '<button type="button" class="evr-renk-dugme' + (aktifRenk === p.renk ? " secili" : "") + '" style="background:' + p.renk + ';" title="' + p.ad + '" data-evr-gt-renk="' + p.renk + '" data-evr-gt-hale="' + p.hale + '"></button>';
          }).join("") +
        '</div>' +
      '</div>' +
      '<div>' +
        '<label><b>Kozmik Halka</b></label>' +
        '<div class="oyun-sira" style="margin-top:4px;">' +
          '<button type="button" class="dugme ' + (halkaVar ? "" : "dugme-sade") + '" data-evr-gt-halka="1">Halka Var</button>' +
          '<button type="button" class="dugme ' + (!halkaVar ? "" : "dugme-sade") + '" data-evr-gt-halka="0">Halkasız</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="evr-gt-onizleme-kutu">' +
      '<div class="evr-gt-kure" style="background: radial-gradient(circle at 32% 32%, ' + aktifHale + ' 0%, ' + aktifRenk + ' 55%, #0B132B 95%);">' +
        (halkaVar ? '<div class="evr-gt-halka"></div>' : '') +
      '</div>' +
      '<div>' +
        '<div style="font-weight:700; color:#fff; font-size:14px;">' + kacir(e.anaGezegen || e.ad || "Ana Dünya") + '</div>' +
        '<div style="font-size:12px; color:#ADE8F4; margin-top:2px;">' + (coklu ? ((e.gezegenler.length + 1) + " Gezegenli Sistem · 4D Seyrüseferde Kaydırılabilir") : "Tek Dünyalı Sistem · Merkez Sabit") + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* ---------- 4.5: Zen Modu & Web Audio Kozmik Ambiyans ---------- */

let evrZenSesCtx = null;
let evrZenOsc1 = null;
let evrZenOsc2 = null;
let evrZenGain = null;
let evrZenSesAcik = false;

function evrZenSesToggle() {
  if (evrZenSesAcik) {
    if (evrZenGain && evrZenSesCtx) {
      evrZenGain.gain.linearRampToValueAtTime(0.0001, evrZenSesCtx.currentTime + 0.4);
      setTimeout(function() {
        if (evrZenOsc1) { try { evrZenOsc1.stop(); } catch(_) {} evrZenOsc1 = null; }
        if (evrZenOsc2) { try { evrZenOsc2.stop(); } catch(_) {} evrZenOsc2 = null; }
        evrZenSesCtx = null;
      }, 500);
    }
    evrZenSesAcik = false;
    const btn = document.querySelector("#evrZenSesBtn");
    if (btn) { btn.innerHTML = "🔇 Ambiyans: Kapalı"; btn.classList.remove("caliyor"); }
  } else {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) { return; }
      evrZenSesCtx = new AudioCtx();
      if (evrZenSesCtx.state === "suspended") { evrZenSesCtx.resume(); }

      const now = evrZenSesCtx.currentTime;
      evrZenOsc1 = evrZenSesCtx.createOscillator();
      evrZenOsc2 = evrZenSesCtx.createOscillator();
      const filter = evrZenSesCtx.createBiquadFilter();
      evrZenGain = evrZenSesCtx.createGain();

      evrZenOsc1.type = "sine";
      evrZenOsc1.frequency.setValueAtTime(108, now);

      evrZenOsc2.type = "triangle";
      evrZenOsc2.frequency.setValueAtTime(162, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(260, now);

      evrZenGain.gain.setValueAtTime(0.0001, now);
      evrZenGain.gain.linearRampToValueAtTime(0.025, now + 1.2);

      evrZenOsc1.connect(filter);
      evrZenOsc2.connect(filter);
      filter.connect(evrZenGain);
      evrZenGain.connect(evrZenSesCtx.destination);

      evrZenOsc1.start(now);
      evrZenOsc2.start(now);
      evrZenSesAcik = true;

      const btn = document.querySelector("#evrZenSesBtn");
      if (btn) { btn.innerHTML = "🌌 Ambiyans: Açık"; btn.classList.add("caliyor"); }
    } catch (_) {
      evrZenSesAcik = false;
    }
  }
}

function evrZenModuAc(evrenId) {
  if (document.querySelector("#evrZenModal")) { return; }
  const e = typeof evrenBenimBul === "function" ? evrenBenimBul(evrenId) : null;
  if (!e) { return; }

  const modal = document.createElement("div");
  modal.id = "evrZenModal";
  modal.className = "evr-zen-modal";
  modal.innerHTML =
    '<div class="evr-zen-ust">' +
      '<div style="font-weight:700; font-size:16px; color:#48CAE4;">🕊️ ZEN & ODAK YAZIM MODU · ' + kacir(e.ad || "Evren") + '</div>' +
      '<div class="oyun-sira">' +
        '<button type="button" class="dugme dugme-sade" id="evrZenSesBtn" data-evr-zen-ses="1">🔇 Ambiyans: Kapalı</button>' +
        '<button type="button" class="dugme" data-evr-zen-kapat="' + kacir(e.id) + '">Kaydet ve Çık ✕</button>' +
      '</div>' +
    '</div>' +
    '<div class="evr-zen-govde">' +
      '<p class="oyun-not" style="color:#ADE8F4;">Sadece sen ve kurduğun dünya. Menüler ve gürültüler susturuldu. Aklındaki hikayeyi veya doğa kurallarını dilediğince yaz.</p>' +
      '<textarea class="evr-zen-yazi" id="evrZenMetin" placeholder="Bu dünyada gökyüzü nasıldır? Kimler yaşar, nasıl kurallar işler?">' + kacir(e.ozet || "") + '</textarea>' +
    '</div>';

  document.body.appendChild(modal);
}

function evrZenModuKapat(evrenId) {
  if (evrZenSesAcik) { evrZenSesToggle(); }
  const textarea = document.querySelector("#evrZenMetin");
  if (textarea && evrenId) {
    const val = textarea.value;
    evrenBenimDegistir(evrenId, function(e) {
      e.ozet = val;
    });
  }
  const modal = document.querySelector("#evrZenModal");
  if (modal) { modal.remove(); }
  if (typeof evrenSayfaCiz === "function") { evrenSayfaCiz(); }
}

/* ---------- 4.5: Serbest Not Ayrıştırıcısı (Not Defterinden Evrene) ---------- */

function evrNotAyristir(metin) {
  if (!metin || typeof metin !== "string") { return { yerler: [], kisiler: [], kurallar: [] }; }
  const sonuc = { yerler: [], kisiler: [], kurallar: [] };
  const cumleler = metin.split(/[\n.!?]+/).map(function(s) { return s.trim(); }).filter(Boolean);

  const kuralKelimeleri = /yasak|işler|kural|ışık|hız|gece|saat|zaman|dokun|büyü|uçar|batmaz|doğan|aylar|takvim|enerji|akım|topu/i;
  cumleler.forEach(function(c) {
    if (c.length > 15 && c.length < 240 && kuralKelimeleri.test(c)) {
      if (!sonuc.kurallar.includes(c)) { sonuc.kurallar.push(c); }
    }
  });

  const yerReg = /([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)\s+(Kıtası|Şehri|Limanı|Dağı|Dağları|Denizi|Vadisi|Ormanı|Adası|Kalesi|Tapınağı|Bölgesi|Çölü)/g;
  let yerMatch;
  while ((yerMatch = yerReg.exec(metin)) !== null) {
    const tamAd = (yerMatch[1] + " " + yerMatch[2]).trim();
    if (!sonuc.yerler.some(function(y) { return y.ad === tamAd; })) {
      sonuc.yerler.push({ ad: tamAd, tur: yerMatch[2].replace(/ı|i$/,"") });
    }
  }

  const kisiReg = /(?:adlı|isimli|soyu|kralı|usta|bekçi|avcı|lider|yolcu)\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)|([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\s+(?:adlı|isimli|soyu|usta|bekçi)/g;
  let kisiMatch;
  while ((kisiMatch = kisiReg.exec(metin)) !== null) {
    const ad = (kisiMatch[1] || kisiMatch[2] || "").trim();
    if (ad.length > 2 && !sonuc.kisiler.includes(ad) && !sonuc.yerler.some(function(y) { return y.ad.includes(ad); })) {
      sonuc.kisiler.push(ad);
    }
  }

  return sonuc;
}

function evrNotModalAc(evrenId) {
  if (document.querySelector("#evrNotModal")) { return; }
  const modal = document.createElement("div");
  modal.id = "evrNotModal";
  modal.className = "evr-not-modal";
  modal.innerHTML =
    '<div class="evr-not-kart">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
        '<b style="font-size:16px; color:#1C5C96;">📋 Not Defterinden Evrene Aktar</b>' +
        '<button type="button" class="pencere-kapat" data-evr-not-kapat="1">✕</button>' +
      '</div>' +
      '<p class="oyun-not">Telefonunda ya da not defterinde karaladığın paragrafı buraya yapıştır. Sistem içindeki yerleri, kişileri ve kuralları otomatik sezip tek tıkla evrenine eklemeni sağlar.</p>' +
      '<textarea class="kod-giris" id="evrNotGirdi" rows="6" placeholder="Örnek: Kaelen, Sis Dağları ardındaki Oray Limanı fener bekçisidir. Bu evrende gölgeler asla tek başına hareket etmez..."></textarea>' +
      '<div style="margin-top:10px; display:flex; justify-content:flex-end;">' +
        '<button type="button" class="dugme" data-evr-not-analiz="' + kacir(evrenId) + '">🔍 Metni Ayrıştır</button>' +
      '</div>' +
      '<div id="evrNotSonucAlan"></div>' +
    '</div>';
  document.body.appendChild(modal);
}

/* ---------- 4.5: Kademeli Derinlik & Üst Araçlar ---------- */

const EVR_KADEMELER = [
  { id: "kademe_1", ad: "1. 🌟 Ruh (Temel & Gezegen)", alt: "Ad, tek kural & 4D dünya tasarımı", adimlar: ["temel", "dunya"] },
  { id: "kademe_2", ad: "2. 👥 Yaşam (Kişiler & Şehir)", alt: "Karakterler, aile ağacı & başkent", adimlar: ["kisiler"] },
  { id: "kademe_3", ad: "3. 📜 Külliyat (Zaman & Paylaşım)", alt: "Takvim, sözlük, oyunlar & dosya", adimlar: ["zaman", "belgeler", "gorunum", "paylas"] }
];

function evrKademeBul(adimId) {
  const k = EVR_KADEMELER.find(function(kad) { return kad.adimlar.includes(adimId); });
  return k ? k.id : "kademe_1";
}

function evrKademeBarHtml(e, seciliAdim) {
  const seciliKademe = evrKademeBul(seciliAdim);
  return '<div class="evr-kademe-bar">' +
    EVR_KADEMELER.map(function(k) {
      const aktif = k.id === seciliKademe;
      return '<button type="button" class="evr-kademe-btn' + (aktif ? " aktif" : "") + '" data-evr-kademe="' + k.adimlar[0] + '">' +
        '<span class="evr-kademe-ad">' + kacir(k.ad) + '</span>' +
        '<span class="evr-kademe-alt">' + kacir(k.alt) + '</span>' +
      '</button>';
    }).join("") +
  '</div>';
}

function evrUstAraclarHtml(e) {
  const kimlik = evrenKurucuKimligi();
  return '<div class="evr-ust-araclar">' +
    '<div class="evr-ust-sol">' +
      '<span class="evr-guvende-rozet"><span class="evr-nabiz-nokta"></span> 🛡️ Evren Cihazında Güvende (Yerel Kayıt)</span>' +
      '<button type="button" class="dugme dugme-sade" style="font-size:12px; padding:4px 10px;" data-evr-geri-al="' + kacir(e.id) + '" title="Son adımı geri alır">↶ Geri Al</button>' +
    '</div>' +
    '<div class="evr-ust-sag">' +
      '<button type="button" class="dugme dugme-sade" style="font-size:12px; padding:4px 10px;" data-evr-zen-ac="' + kacir(e.id) + '">🕊️ Zen Modu</button>' +
      '<button type="button" class="dugme dugme-sade" style="font-size:12px; padding:4px 10px;" data-evr-not-ac="' + kacir(e.id) + '">📋 Not Defterinden Evrene</button>' +
      '<button type="button" class="dugme dugme-sade" style="font-size:11px; padding:4px 8px; font-family:ui-monospace,monospace;" data-evr-kimlik-kopyala="' + kacir(kimlik) + '" title="Kurucu kimlik kodun (başka cihazlarda evrenini tanır)">🔑 ' + kacir(kimlik.slice(0, 16)) + '… [Kopyala]</button>' +
    '</div>' +
  '</div>';
}

const EVR_ADIMLAR = [
  { id: "temel", ad: "Temel & Gezegen", ikon: "①", not: "Evreninin adı ve bir iki cümlelik anlatımı: gezginler evrene girince ilk bunu okur." },
  { id: "dunya", ad: "Dünya & Kurallar", ikon: "②", gruplar: ["kurallar", "yerler", "ozelAlanlar"], not: "Bu evrende ne nasıl işler? Fizik olmak zorunda değil: büyü, gelenek, yasa, tuhaflık…" },
  { id: "kisiler", ad: "Kişiler & Aile", ikon: "③", gruplar: ["kisiler"], not: "Evreninde yaşayanlar. Yaş, yer, söz ve etiket isteğe bağlı; ne kadar doluysa kart o kadar canlı." },
  { id: "zaman", ad: "Zaman & Takvim", ikon: "④", gruplar: ["tarih", "aylar", "etkinlikler"], not: "Olan biten ve evrenin kendi takvimi: aylar, özel günler, yıl sayımı." },
  { id: "belgeler", ad: "Belgeler & Sözlük", ikon: "⑤", gruplar: ["belgeler", "sozluk"], not: "Evrenin içinden yazılar ve kendi sözcükleri. Okur bunları evrenin sesinden okur." },
  { id: "gorunum", ad: "Görünüm & Oyun", ikon: "⑥", not: "Sayfanın rengi, yazın, alfabe, para, gizli katmanlar, oyunlar, roman." },
  { id: "paylas", ad: "Paylaş & İndir", ikon: "⑦", not: "Okur gözüyle bak, dosya olarak indir ya da paylaş." }
];
const EVR_ADIM = {};   /* evren kimliği → adım */

function evrGrup(k) { return FAN_EVREN_GRUPLARI.find(function (g) { return g.k === k; }); }

function evrAdimSayi(e, a) {
  if (a.id === "temel") { return (String(e.ad || "").trim() ? 1 : 0) + (String(e.ozet || "").trim() ? 1 : 0); }
  return (a.gruplar || []).reduce(function (s, k) { return s + evrListe(e, k).length; }, 0);
}

function evrOlcekHtml(e, genis) {
  const o = evrOlcek(e);
  const ozet = '<div class="evr-olcek-ust"><div class="evr-olcek-halka" style="--oran:' + Math.min(100, o.yuzde) + '" aria-hidden="true"><span>%' + o.yuzde + "</span></div>" +
    "<div><b>Tömye ölçeği</b><p class=\"oyun-not\">" + (o.ustun
      ? "Evrenin her yönüyle 24. Evren kadar derin — ve geçiyor."
      : "Evreninin 24. Evren (Tömye) kadar derin olması için her yönün hedefi, Tömye'nin kendisinden.") + "</p></div></div>";
  if (!genis) { return '<div class="evr-olcek">' + ozet + "</div>"; }
  return '<div class="evr-olcek">' + ozet + '<ul class="evr-olcek-liste">' + o.satir.map(function (r) {
    return '<li><button type="button" class="evr-olcek-satir" data-evr-adim="' + r.adim + '"><span>' + kacir(r.ad) + "</span><b>" + r.n + " / " + r.hedef + "</b>" +
      '<i class="evr-olcek-cubuk" aria-hidden="true"><i style="width:' + Math.round(100 * Math.min(1, r.oran)) + '%"></i></i></button></li>';
  }).join("") + "</ul></div>";
}

function evrSekmeDugmesi(id, ad, var_) {
  return var_ ? '<button type="button" class="dugme dugme-sade" data-evs-sekme="' + id + '">' + ad + "</button>" : "";
}

function evrKurucuHtml(v) {
  const e = v.eser;
  if (typeof fanSecili !== "undefined") { fanSecili.evren = e.id; }
  evrUndoKaydet(e);
  evrenKurucuKimlikDamgala(e);

  const adim = EVR_ADIM[e.id] || "temel";
  const a = EVR_ADIMLAR.find(function (x) { return x.id === adim; }) || EVR_ADIMLAR[0];
  const i = EVR_ADIMLAR.indexOf(a);
  const sekmeler = (typeof evrenEkSekmeler === "function" ? evrenEkSekmeler(v) : []).map(function (x) { return x[0]; });
  const var_ = function (id) { return sekmeler.indexOf(id) !== -1 || id === "harita" || id === "bilgi"; };
  const form = function (ic) { return '<div class="fan-form evr-form" data-fan-form="evren" data-fan-hedef="' + kacir(e.id) + '">' + ic + fanEvrenListeleri() + "</div>"; };

  let govde = "";
  if (a.id === "temel") {
    govde = form(fanGirdi("ad", e.ad, "Evrenin adı") + fanGirdi("yazar", e.yazar, "Kuran (takma ad olabilir)") + fanGirdi("ozet", e.ozet, "Evreni anlat", "uzun", { satir: 4 })) +
      evrFisiltiHtml(e) +
      evrGezegenTasarimHtml(e) +
      '<div class="oyun-sira" style="margin:16px 0 20px;">' +
        '<button type="button" class="dugme" data-evr-hizli-baslat="' + kacir(e.id) + '">🚀 Evreni Hemen Başlat & Gez</button>' +
      '</div>' +
      (typeof evkKartHtml === "function" ? evkKartHtml(e) : "") +
      evrOlcekHtml(e, true);
  } else if (a.gruplar) {
    const ek = a.id === "dunya"
      ? '<div class="oyun-sira">' + evrSekmeDugmesi("harita", "🗺 Haritayı çiz", true) + evrSekmeDugmesi("lore", "🔒 Gizli katman ekle", var_("lore")) + "</div>" +
        evrFisiltiHtml(e)
      : a.id === "kisiler"
        ? '<div class="oyun-sira">' + evrSekmeDugmesi("ag", "🕸 Bağları ve aile ağacını kur", var_("ag")) + "</div>" +
          '<p class="oyun-not">Aile ağacı için bağ etiketi: <b>anne</b>, <b>baba</b>, <b>eş</b>, <b>kardeş</b> ya da <b>oğlu/kızı</b> (ilk yazılan kişi o kişidir: “Ayşe — anne — Ali”).</p>' +
          evrAileSvg(e)
        : a.id === "zaman"
          ? form('<fieldset class="fan-grup"><legend>Yıl ve hafta</legend>' +
              fanGirdi("takvim.yil", (e.takvim || {}).yil, "Yıl sayımı (ör. “Buzdan sonra”, “Kuruluştan beri”)") +
              fanGirdi("takvim.hafta", (e.takvim || {}).hafta, "Haftanın günleri (virgülle)") +
              fanGirdi("takvim.bugun", (e.takvim || {}).bugun, "Evrenin bugünü (ör. “412, Kar ayının 3. günü”)") + "</fieldset>") +
            (evrListe(e, "aylar").length || evrListe(e, "etkinlikler").length ? '<details class="evr-onizleme"><summary>Takvimin okurdaki görünümü</summary>' + evrTakvimCiz(evrListe(e, "aylar"), e) + "</details>" : "")
          : "";
    govde = ek + (a.id === "kisiler" || a.id === "dunya" ? evrIsimHtml(e) : "") +   /* isim üretici */
      form(a.gruplar.map(function (k) { return fanEvrenGrupHtml(e, evrGrup(k), { katla: true }); }).join(""));
  } else if (a.id === "gorunum") {
    govde = '<div class="evr-kartlar">' +
      [["stil", "🎨 Görünüm", "Renk, desen, yazı tipi, para"], ["yazi", "✎ Yazı çiz", "Kendi harflerini çiz"], ["lore", "🔒 Kilitli lore", "Kodla açılan gizli katmanlar"],
        ["rehber", "📖 Okuma rehberi", "Okurlar için sıra"], ["oyunlar", "🎲 Oyunlar", "Evrenine özel oyunlar"], ["roman", "📖 Roman", "Bölüm bölüm anlatı"], ["cizim", "🖌 Çizimler", "Evreninden görseller"],
        ["uygulama", "⌨ Uygulamalar", "Kodla küçük uygulamalar"], ["kod", "🔑 Kod", "Yönetici kodu ve paylaşım"]]
        .filter(function (x) { return var_(x[0]); })
        .map(function (x) { return '<button type="button" class="evr-kart" data-evs-sekme="' + x[0] + '"><b>' + x[1] + "</b><span>" + x[2] + "</span></button>"; }).join("") + "</div>";
  } else {
    const o = evrOlcek(e);
    const zayif = o.satir.filter(function (r) { return r.oran < 1; }).sort(function (x, y) { return x.oran - y.oran; }).slice(0, 3);
    govde = evrDenetimHtml(e) + '<div class="oyun-sira"><button type="button" class="dugme dugme-sade" data-evr-kart="benim:' + kacir(e.id) + '">🖼 Evren kartı (hikâye)</button></div>' +
      evaYolHtml(e) + (e.durum !== "kanonAday" ? evrEgIzinYonetHtml(e) : "") +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-fan-onizle="evren">👁 Okur gözüyle bak</button>' +
        '<button class="dugme dugme-sade" data-fan-indir="evren">Dosya olarak indir</button>' +
        '<button class="dugme dugme-sade" data-evren-indir-offline="' + kacir(e.id) + '">💾 Çevrimdışı İndir (.tentifor)</button>' +
        '<button class="dugme dugme-sade" data-fan-paylas="evren">Paylaş</button>' +
        '<button class="dugme dugme-sade" data-fan-gonder="evren">Yazara gönder</button></div>' +
      '<p class="oyun-not" data-fan-kayit="evren"></p><div data-fan-gonder-alan="evren"></div>' +
      (zayif.length ? '<div class="evr-ipucu"><b>Sıradaki en çok katkı:</b> ' + zayif.map(function (r) {
        return '<button type="button" class="ic-bag" data-evr-adim="' + r.adim + '">' + kacir(r.ad) + " (" + r.n + "/" + r.hedef + ")</button>";
      }).join(" · ") + "</div>" : "") + evrOlcekHtml(e, true);
  }

  const denetim = evrDenetim(e).filter(function (x) { return x.seviye !== "bilgi"; }).length;
  let doluluk = "";
  try { doluluk = evrenDolulukHtml(e); } catch (_) { /* doluluk olmadan */ }
  const h = doluluk + '<section class="evr-kurucu" aria-label="Evren Kurucu">' +
    evrUstAraclarHtml(e) +
    evrKademeBarHtml(e, a.id) +
    '<div class="evr-kurucu-ust">' + evrOlcekHtml(e, false) +
      (denetim ? '<button type="button" class="evr-denetim-rozet" data-evr-adim="paylas">⚠ ' + denetim + " tutarlılık notu</button>" : "") +
      '<nav class="evr-adimlar" aria-label="Kurma adımları">' + EVR_ADIMLAR.map(function (x) {
        const n = evrAdimSayi(e, x);
        return '<button type="button" class="evr-adim' + (x.id === a.id ? " secili" : "") + (n ? " dolu" : "") + '" data-evr-adim="' + x.id + '"' +
          (x.id === a.id ? ' aria-current="step"' : "") + '><span class="evr-adim-ikon" aria-hidden="true">' + x.ikon + "</span>" + kacir(x.ad) +
          (n && x.gruplar ? ' <span class="evr-adim-sayi">' + n + "</span>" : "") + "</button>";
      }).join("") + "</nav></div>" +
    '<h3 class="evr-adim-baslik">' + kacir(a.ad) + "</h3>" + '<p class="oyun-not">' + kacir(a.not) + "</p>" + govde +
    '<div class="evr-alt">' +
      (i > 0 ? '<button type="button" class="dugme dugme-sade" data-evr-adim="' + EVR_ADIMLAR[i - 1].id + '">← ' + kacir(EVR_ADIMLAR[i - 1].ad) + "</button>" : "<span></span>") +
      (i < EVR_ADIMLAR.length - 1 ? '<button type="button" class="dugme" data-evr-adim="' + EVR_ADIMLAR[i + 1].id + '">' + kacir(EVR_ADIMLAR[i + 1].ad) + " →</button>" : "") +
    "</div></section>";

  if (a.id === "temel" && h.indexOf("data-evt-tur") === -1 &&
      !(e.kurallar || []).some(function (x) { return x && String(x.ad || "").trim(); }) && !(e.kisiler || []).some(function (x) { return x && String(x.ad || "").trim(); })) {
    return h + '<div class="evt-turler"><span class="oyun-not">Şablonla başla: kurallar, kişiler, tarih, belge ve harita gelir; yalnızca boş alanları doldurur, hepsini sonra değiştirirsin.</span>' +
      EVT_TURLER.map(function (t) { return '<button class="evt-tur" data-evt-tur="' + t.id + '"><b>' + kacir(t.ad) + "</b><small>" + kacir(t.ozet) + "</small></button>"; }).join("") + "</div>";
  }
  return a.id === "paylas" ? h + teslimHtml() : h;
}

/* takvim alanları yazılabilsin: fanAlanYaz "takvim.yil" için nesnenin var olmasını ister */
function evrTakvimHazirla(id) {
  const e = typeof evrenBenimBul === "function" ? evrenBenimBul(id) : null;
  if (e && (!e.takvim || typeof e.takvim !== "object") && typeof evrenBenimDegistir === "function") {
    evrenBenimDegistir(id, function (x) { x.takvim = { yil: "", hafta: "", bugun: "" }; });
  }
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evr-adim], [data-evr-kademe], [data-evr-fisilti-zar], [data-evr-fisilti-kullan], " +
    "[data-evr-gt-renk], [data-evr-gt-halka], [data-evr-gt-sistem], [data-evr-hizli-baslat], [data-evr-geri-al], [data-evr-zen-ac], " +
    "[data-evr-zen-kapat], [data-evr-zen-ses], [data-evr-not-ac], [data-evr-not-kapat], [data-evr-not-analiz], [data-evr-not-aktar], [data-evr-kimlik-kopyala]");
  if (!b) { return; }

  // 1. Kademe Butonları
  if (b.dataset.evrKademe) {
    const hedef = b.dataset.evrKademe;
    if (EVS && EVS.kaynak === "benim") {
      EVR_ADIM[EVS.id] = hedef;
      EVS.sekme = "kurucu";
      evrenSayfaCiz();
    }
    return;
  }

  // 2. Dünya Fısıltısı (İlham Zarı)
  if (b.dataset.evrFisiltiZar) {
    evrFisiltiSec();
    const metinEl = document.querySelector(".evr-fisilti-metin");
    if (metinEl) { metinEl.textContent = "“" + evrSonFisilti + "”"; }
    const btnKullan = document.querySelector("[data-evr-fisilti-kullan]");
    if (btnKullan) { btnKullan.dataset.evrFisiltiKullan = evrSonFisilti; }
    return;
  }
  if (b.dataset.evrFisiltiKullan && EVS && EVS.kaynak === "benim") {
    const soru = b.dataset.evrFisiltiKullan;
    evrenBenimDegistir(EVS.id, function (e) {
      if (!Array.isArray(e.kurallar)) { e.kurallar = []; }
      e.kurallar.push({ ad: "Kadim Bilgi", tur: "Fısıltı", aciklama: soru });
    });
    if (typeof eckaBildir === "function") { eckaBildir("✓ Fısıltı kural olarak evrenine eklendi!"); }
    evrenSayfaCiz();
    return;
  }

  // 3. 4D Gezegen Tasarımcısı Olayları
  if (b.dataset.evrGtRenk && EVS && EVS.kaynak === "benim") {
    const r = b.dataset.evrGtRenk;
    const h = b.dataset.evrGtHale;
    evrenBenimDegistir(EVS.id, function (e) {
      e.gezegenOzellikleri = e.gezegenOzellikleri || {};
      e.gezegenOzellikleri.renk = r;
      e.gezegenOzellikleri.hale = h;
    });
    evrenSayfaCiz();
    return;
  }
  if (b.dataset.evrGtHalka !== undefined && EVS && EVS.kaynak === "benim") {
    const halka = b.dataset.evrGtHalka === "1";
    evrenBenimDegistir(EVS.id, function (e) {
      e.gezegenOzellikleri = e.gezegenOzellikleri || {};
      e.gezegenOzellikleri.halka = halka;
    });
    evrenSayfaCiz();
    return;
  }
  if (b.dataset.evrGtSistem && EVS && EVS.kaynak === "benim") {
    const tip = b.dataset.evrGtSistem;
    evrenBenimDegistir(EVS.id, function (e) {
      if (tip === "coklu") {
        if (!Array.isArray(e.gezegenler) || !e.gezegenler.length) {
          e.gezegenler = [{
            id: "g" + Date.now().toString(36),
            ad: "Kardeş Dünya",
            renk: "#00F5D4",
            hale: "#7B2CBF",
            halka: false,
            harita: { yerler: [] }
          }];
        }
      } else {
        delete e.gezegenler;
      }
    });
    evrenSayfaCiz();
    return;
  }

  // 4. Hızlı Başlat Butonu
  if (b.dataset.evrHizliBaslat && EVS && EVS.kaynak === "benim") {
    const id = b.dataset.evrHizliBaslat;
    evrenBenimDegistir(id, function(e) {
      if (!String(e.ad || "").trim()) { e.ad = "Yeni Keşif Evreni"; }
    });
    if (typeof boyutSeyruseferAc === "function") {
      boyutSeyruseferAc(id);
    } else {
      location.hash = "#/ev/benim/" + id;
    }
    return;
  }

  // 5. Geri Al (Undo / Zaman Makinesi)
  if (b.dataset.evrGeriAl) {
    evrGeriAl(b.dataset.evrGeriAl);
    return;
  }

  // 6. Zen Modu
  if (b.dataset.evrZenAc) {
    evrZenModuAc(b.dataset.evrZenAc);
    return;
  }
  if (b.dataset.evrZenKapat) {
    evrZenModuKapat(b.dataset.evrZenKapat);
    return;
  }
  if (b.dataset.evrZenSes) {
    evrZenSesToggle();
    return;
  }

  // 7. Not Defterinden Evrene Aktarıcı
  if (b.dataset.evrNotAc) {
    evrNotModalAc(b.dataset.evrNotAc);
    return;
  }
  if (b.dataset.evrNotKapat) {
    const m = document.querySelector("#evrNotModal");
    if (m) { m.remove(); }
    return;
  }
  if (b.dataset.evrNotAnaliz) {
    const evrenId = b.dataset.evrNotAnaliz;
    const txt = (document.querySelector("#evrNotGirdi") || {}).value || "";
    const res = evrNotAyristir(txt);
    const alan = document.querySelector("#evrNotSonucAlan");
    if (alan) {
      alan.innerHTML =
        '<div class="evr-not-chipler">' +
          '<div style="font-weight:700; margin-top:12px; font-size:13px; color:#1C5C96;">Ayrıştırılan Öğeler (Tek tıkla evrenine aktar):</div>' +
          (!res.yerler.length && !res.kisiler.length && !res.kurallar.length ? '<p class="oyun-not">Belirgin bir yer veya kural kalıbı bulunamadı. Cümleleri biraz daha detaylandırabilirsin.</p>' : '') +
          res.yerler.map(function(y) {
            return '<div class="evr-not-cip-satir"><span>📍 <b>' + kacir(y.ad) + '</b> (' + kacir(y.tur) + ')</span><button type="button" class="dugme dugme-sade" style="font-size:11px; padding:3px 8px;" data-evr-not-aktar="yer:' + kacir(y.ad) + ':' + kacir(evrenId) + '">+ Haritaya Ekle</button></div>';
          }).join("") +
          res.kisiler.map(function(k) {
            return '<div class="evr-not-cip-satir"><span>👤 <b>' + kacir(k) + '</b></span><button type="button" class="dugme dugme-sade" style="font-size:11px; padding:3px 8px;" data-evr-not-aktar="kisi:' + kacir(k) + ':' + kacir(evrenId) + '">+ Kişilere Ekle</button></div>';
          }).join("") +
          res.kurallar.map(function(kr) {
            return '<div class="evr-not-cip-satir"><span style="max-width:400px; font-size:12px;">📜 ' + kacir(kr) + '</span><button type="button" class="dugme dugme-sade" style="font-size:11px; padding:3px 8px;" data-evr-not-aktar="kural:' + kacir(kr) + ':' + kacir(evrenId) + '">+ Kural Yap</button></div>';
          }).join("") +
        '</div>';
    }
    return;
  }
  if (b.dataset.evrNotAktar) {
    const parca = b.dataset.evrNotAktar.split(":");
    const tip = parca[0];
    const deger = parca[1];
    const evrenId = parca[2];
    evrenBenimDegistir(evrenId, function(e) {
      if (tip === "yer") {
        e.harita = e.harita || { yerler: [] };
        e.harita.yerler = e.harita.yerler || [];
        e.harita.yerler.push({ id: "y" + Date.now().toString(36), ad: deger, tur: "Şehir", x: 45, y: 50 });
      } else if (tip === "kisi") {
        e.kisiler = e.kisiler || [];
        e.kisiler.push({ ad: deger, rol: "Önemli Kişi", aciklama: "" });
      } else if (tip === "kural") {
        e.kurallar = e.kurallar || [];
        e.kurallar.push({ ad: "Doğa Kuralı", tur: "Fizik", aciklama: deger });
      }
    });
    b.disabled = true;
    b.textContent = "✓ Eklendi";
    if (typeof eckaBildir === "function") { eckaBildir("✓ " + deger + " evrenine kaydedildi!"); }
    return;
  }

  // 8. Kurucu Kimliği Kopyalama
  if (b.dataset.evrKimlikKopyala) {
    const k = b.dataset.evrKimlikKopyala;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(k);
    }
    if (typeof eckaBildir === "function") { eckaBildir("🔑 Kurucu Kimliğin Kopyalandı: " + k); }
    return;
  }

  // Standart Adım Geçişi
  const hedefAdim = b.getAttribute("data-evr-adim");
  if (!hedefAdim || typeof EVS === "undefined" || !EVS || EVS.kaynak !== "benim") { return; }
  if (typeof fanBekleyeniYaz === "function") { fanBekleyeniYaz(); }
  if (["harita", "ag", "lore", "roman"].indexOf(hedefAdim) !== -1) { EVS.sekme = hedefAdim; evrenSayfaCiz(); return; }
  EVR_ADIM[EVS.id] = hedefAdim;
  EVS.sekme = "kurucu";
  if (hedefAdim === "zaman") { evrTakvimHazirla(EVS.id); }
  evrenSayfaCiz();
  const s = document.querySelector("#evrenSayfa .evr-adim-baslik");
  if (s && s.scrollIntoView) { s.scrollIntoView({ block: "start" }); }
});

/* ==================== 4.3: okuma rehberi ve oyun listesi düzenleyicileri ====================
   Rehber: okuma_rehberi (evren-motoru). Oyun listesi: oyun_listesi (51-evren-oyunlari). İkisi de evrenin JSON'una yazılır;
   paketleyici fanTemizle → evrenEkTemizle ile ikisini de pakete koyar. Yazı alanları "change"te kaydedilir (yazarken sayfa yeniden çizilmez). */

function evrRehberHedefleri(e) {
  const l = [["", "— Yalnızca başlık —"]];
  if (String(e.ozet || "").trim()) { l.push(["bolum:ozet", "Giriş (özet)"]); }
  FAN_EVREN_GRUPLARI.forEach(function (g) { if ((e[g.k] || []).length) { l.push(["bolum:" + g.k, "Bilgi · " + g.ad]); } });
  (((e.roman || {}).bolumler) || []).forEach(function (b, i) { l.push(["roman:" + b.id, "Roman · " + (b.baslik || "Bölüm " + (i + 1))]); });
  (e.lorlar || []).forEach(function (x) { l.push(["lore:" + x.id, "Lore · " + (x.baslik || "Kilitli lore")]); });
  return l;
}

function evrRehberDuzenHtml(e) {
  const l = e.okuma_rehberi || [];
  const hedef = evrRehberHedefleri(e);
  return '<details class="kutu-y evr-rehber-duzen"' + (l.length ? "" : " open") + "><summary><b>Okuma rehberini düzenle</b></summary>" +
    '<p class="oyun-not">Okurların hangi sırayla okuyacağını sen seç. Boş bırakırsan rehber romanından kendiliğinden kurulur. ' +
      "“Kod ister” lore açılınca okunur; “kilitli” madde hiç açılmaz (yakında).</p>" +
    l.map(function (x, i) {
      const sec = hedef.some(function (h) { return h[0] === x.dosya; }) ? hedef : hedef.concat([[x.dosya, x.dosya]]);
      return '<div class="evo-ayar-oyun" data-rehber-sira="' + i + '"><b>' + (i + 1) + ".</b> " +
        '<input class="kod-giris arac-giris" maxlength="120" data-rehber-alan="baslik" aria-label="Başlık" placeholder="Başlık" value="' + kacir(x.baslik) + '">' +
        '<select class="kod-giris arac-giris" data-rehber-alan="dosya" aria-label="Neyi açar">' + sec.map(function (h) {
          return '<option value="' + kacir(h[0]) + '"' + (h[0] === x.dosya ? " selected" : "") + ">" + kacir(h[1]) + "</option>";
        }).join("") + "</select>" +
        '<label class="evo-onay"><input type="checkbox" data-rehber-alan="kilitli"' + (x.kilitli ? " checked" : "") + "> kilitli</label>" +
        '<label class="evo-onay"><input type="checkbox" data-rehber-alan="kod_gerekli"' + (x.kod_gerekli ? " checked" : "") + "> kod ister</label>" +
        '<span class="oyun-sira"><button type="button" class="ic-bag" data-rehber-is="yukari" aria-label="Yukarı"' + (i ? "" : " disabled") + ">↑</button>" +
          '<button type="button" class="ic-bag" data-rehber-is="asagi" aria-label="Aşağı"' + (i < l.length - 1 ? "" : " disabled") + ">↓</button>" +
          '<button type="button" class="ic-bag" data-rehber-is="sil">Sil</button></span></div>';
    }).join("") +
    '<div class="oyun-sira"><button type="button" class="dugme dugme-sade" data-rehber-is="ekle">+ Madde ekle</button>' +
      '<button type="button" class="dugme dugme-sade" data-rehber-is="doldur">Otomatik doldur</button></div></details>';
}

function evrRehberYaz(fn, ciz) {
  if (!EVS || EVS.kaynak !== "benim") { return; }
  evrenBenimDegistir(EVS.id, function (e) {
    const l = Array.isArray(e.okuma_rehberi) ? e.okuma_rehberi.slice() : [];
    fn(l, e);
    const t = rehberTemizle(l);
    if (t.length) { e.okuma_rehberi = t; } else { delete e.okuma_rehberi; }
  });
  if (ciz) { evrenSayfaCiz(); }
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-rehber-is]");
  if (!b || !EVS || EVS.kaynak !== "benim") { return; }
  const is = b.getAttribute("data-rehber-is");
  const s = b.closest("[data-rehber-sira]");
  const i = s ? Number(s.getAttribute("data-rehber-sira")) : -1;
  evrRehberYaz(function (l, e) {
    if (is === "ekle") { l.push({ baslik: "Yeni madde", dosya: "" }); }
    else if (is === "doldur") {
      const eski = e.okuma_rehberi; delete e.okuma_rehberi;
      const o = evrenRehberi(e); e.okuma_rehberi = eski;
      l.splice.apply(l, [0, l.length].concat(o.length ? o : [{ baslik: "Evrene giriş", dosya: String(e.ozet || "").trim() ? "bolum:ozet" : "" }]));
    }
    else if (is === "sil") { l.splice(i, 1); }
    else if (is === "yukari" && i > 0) { l.splice(i - 1, 0, l.splice(i, 1)[0]); }
    else if (is === "asagi" && i < l.length - 1) { l.splice(i + 1, 0, l.splice(i, 1)[0]); }
  }, true);
});

document.addEventListener("change", function (ev) {
  const el = ev.target.closest && ev.target.closest("[data-rehber-alan]");
  const s = el && el.closest("[data-rehber-sira]");
  if (!s || !EVS || EVS.kaynak !== "benim") { return; }
  const i = Number(s.getAttribute("data-rehber-sira")), alan = el.getAttribute("data-rehber-alan");
  evrRehberYaz(function (l) {
    if (!l[i]) { return; }
    l[i][alan] = el.type === "checkbox" ? el.checked : el.value;
    if (alan === "baslik" && !String(el.value).trim()) { l[i].baslik = "Adsız madde"; }
  }, el.tagName !== "INPUT" || el.type === "checkbox");
});

/* ---------- oyun listesi ---------- */

function evrOyunListesiHtml(e) {
  const l = e.oyun_listesi || [];
  const soru = function (g) { return (g.ayarlar.sorular || []).map(function (q) { return [q.soru, q.dogru].concat(q.yanlis).join(" | "); }).join("\n"); };
  return '<details class="kutu-y evo-ayar evr-oyun-liste"' + (l.length ? " open" : "") + "><summary><b>Oyun listesi (kurallarıyla)</b></summary>" +
    '<p class="oyun-not">Liste doluysa Oyna yalnızca bu oyunları gösterir; her oyunun adı ve kendi kelimeleri/soruları olur. ' +
      "Boşsa oyunlar içerikten kendiliğinden kurulur.</p>" +
    l.map(function (g, i) {
      return '<div class="evo-ayar-oyun" data-oyunl-sira="' + i + '">' +
        '<select class="kod-giris arac-giris" data-oyunl-alan="tur" aria-label="Oyun türü">' + EVO_OYUNLAR.map(function (t) {
          return '<option value="' + t.id + '"' + (t.id === g.tur ? " selected" : "") + ">" + kacir(t.ad) + "</option>";
        }).join("") + "</select>" +
        '<input class="kod-giris arac-giris" maxlength="60" data-oyunl-alan="ad" aria-label="Oyunun adı" placeholder="Oyunun adı" value="' + kacir(g.ad) + '">' +
        (g.tur === "kelime" ? '<textarea class="kod-giris arac-giris" rows="3" data-oyunl-alan="kelimeler" aria-label="Kelimeler" placeholder="Her satıra bir kelime (4–7 harf)">' +
          kacir((g.ayarlar.kelimeler || []).join("\n")) + "</textarea>" : "") +
        (g.tur === "sinav" || g.tur === "dogru" ? '<textarea class="kod-giris arac-giris" rows="4" data-oyunl-alan="sorular" aria-label="Sorular" placeholder="Soru | doğru cevap | yanlış | yanlış | yanlış">' +
          kacir(soru(g)) + "</textarea>" : "") +
        '<span class="oyun-not">' + kacir(EVO_OYUNLAR.find(function (t) { return t.id === g.tur; }).ozet) + "</span>" +
        '<button type="button" class="ic-bag" data-oyunl-is="sil">Sil</button></div>';
    }).join("") +
    (l.length < 20 ? '<div class="oyun-sira"><button type="button" class="dugme dugme-sade" data-oyunl-is="ekle">+ Oyun ekle</button></div>' : "") + "</details>";
}

function evrOyunListesiYaz(fn, ciz) {
  if (!EVS || EVS.kaynak !== "benim") { return; }
  evrenBenimDegistir(EVS.id, function (e) {
    const l = Array.isArray(e.oyun_listesi) ? e.oyun_listesi.slice() : [];
    fn(l);
    const t = oyunListesiTemizle(l);
    if (t.length) { e.oyun_listesi = t; } else { delete e.oyun_listesi; }
  });
  if (ciz) { evrenSayfaCiz(); }
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-oyunl-is]");
  if (!b || !EVS || EVS.kaynak !== "benim") { return; }
  const s = b.closest("[data-oyunl-sira]");
  const i = s ? Number(s.getAttribute("data-oyunl-sira")) : -1;
  evrOyunListesiYaz(function (l) {
    if (b.getAttribute("data-oyunl-is") === "ekle") { l.push({ id: "o" + Date.now().toString(36), tur: "sinav", ad: "", ayarlar: {} }); }
    else { l.splice(i, 1); }
  }, true);
});

document.addEventListener("change", function (ev) {
  const el = ev.target.closest && ev.target.closest("[data-oyunl-alan]");
  const s = el && el.closest("[data-oyunl-sira]");
  if (!s || !EVS || EVS.kaynak !== "benim") { return; }
  const i = Number(s.getAttribute("data-oyunl-sira")), alan = el.getAttribute("data-oyunl-alan");
  evrOyunListesiYaz(function (l) {
    const g = l[i];
    if (!g) { return; }
    g.ayarlar = Object.assign({}, g.ayarlar);
    if (alan === "tur") { g.tur = el.value; if (!g.ad || EVO_OYUNLAR.some(function (t) { return t.ad === g.ad; })) { g.ad = ""; } }
    else if (alan === "ad") { g.ad = el.value; }
    else if (alan === "kelimeler") { g.ayarlar.kelimeler = el.value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); }
    else if (alan === "sorular") {
      g.ayarlar.sorular = el.value.split(/\n+/).map(function (x) {
        const p = x.split("|").map(function (y) { return y.trim(); });
        return p.length >= 3 && p[0] && p[1] ? { soru: p[0], dogru: p[1], yanlis: p.slice(2, 5).filter(Boolean) } : null;
      }).filter(Boolean);
    }
  }, alan === "tur");
});
