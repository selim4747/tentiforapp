/* Evren oyunları, evren romanı ve çizimler.

   - Oyunlar: her evren kendi içeriğinden (kişiler, yerler, sözlük, tarih, kurallar, harita) üç oyun kurar:
     Günün kelimesi, Evren sınavı, Harita bulmacası. Kurucu oyunları açıp kapatır, adlarını değiştirir,
     kendi kelimelerini ve sorularını ekler, ödülü (evrenin parasıyla) belirler. Başkasının evreninde kazanan
     o evrenin parasını alır (her oyun günde bir kez); kişinin kendi evreni ve dosyadan açılanlar ödül vermez.
   - Roman: evrenin bölüm bölüm romanı. Kurucu yazar, herkes okur.
   - Çizimler: kurucu görsel yükler (küçültülür). Görseller bu cihazda (IndexedDB) durur, dosya olarak
     indirilince ya da yazara gönderilince içinde gider; yönetici siteye eklerken GitHub'a ayrı dosya olarak yüklenir.

   Dosyadan gelen her şey güvenilmez metindir: kacir/paragraf ile basılır, görseller yalnızca data:image ya da
   sitenin kendi ikon/fan/ yolu olabilir. */

const EVO_OYUNLAR = [
  { id: "kelime", ad: "Günün kelimesi", ozet: "Her gün evrenin adlarından biri, 6 hak." },
  { id: "sinav", ad: "Evren sınavı", ozet: "Kişiler, yerler, sözlük ve tarihten 10 soru." },
  { id: "harita", ad: "Harita bulmacası", ozet: "Adı verilen yeri etiketsiz haritada bul." },
  { id: "dogru", ad: "Doğru mu?", ozet: "8 iddia: evrenin kişileri, yerleri, sözlüğü. Doğru mu, yanlış mı?" },
  { id: "zaman", ad: "Zaman sırası", ozet: "Tarihten 4 olayı sıraya koy; üç turun ikisini bil." }
];
const EVO_EN_AZ = { kelime: 5, sinav: 4, harita: 4, dogru: 4, zaman: 4 };
const EVO_SORU_OYUNU = { sinav: true, dogru: true };
const EVO_ODUL_EG = 1;            /* varsayılan ödül: 1 EG değerinde evren parası */
const EVO_ODUL_TAVAN_EG = 3;      /* kurucu en fazla 3 EG değerinde ödül koyabilir */
const EVO_GUNLUK = 10;            /* günde en fazla bu kadar oyun ödülü (bütün evrenler) */
const EVR_BOLUM_SINIR = 60;
const EVR_METIN_SINIR = 60000;
const EVC_SINIR = 40;
const EVC_VERI_SINIR = 1600000;   /* tek görselin data: adresi (≈1,2 MB) */
const EVC_VERI = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const EVC_YOL = /^ikon\/fan\/[\w-]{1,90}\.(jpg|png|webp)$/;

/* ==================== veri: temizleme ==================== */

function evoMetinListesi(l, adet, sinir) {
  return (Array.isArray(l) ? l : []).slice(0, adet).map(function (x) { return fanMetin(x, sinir).trim(); }).filter(Boolean);
}

/** evrenEkTemizle (45) sonrası: oyun ayarları, roman, çizimler. */
function evrenIcerikTemizle(ham, e) {
  const o = ham.oyunlar;
  if (o && typeof o === "object") {
    const t = {};
    EVO_OYUNLAR.forEach(function (g) {
      const x = o[g.id];
      if (!x || typeof x !== "object") { return; }
      const a = {};
      if (x.acik === false) { a.acik = false; }
      const ad = fanMetin(x.ad, 60).trim();
      if (ad) { a.ad = ad; }
      if (Object.keys(a).length) { t[g.id] = a; }
    });
    const k = evoMetinListesi(o.kelimeler, 200, 20);
    if (k.length) { t.kelimeler = k; }
    const s = (Array.isArray(o.sorular) ? o.sorular : []).slice(0, 60).map(function (x) {
      if (!x || typeof x !== "object") { return null; }
      const q = { soru: fanMetin(x.soru, 300).trim(), dogru: fanMetin(x.dogru, 120).trim(), yanlis: evoMetinListesi(x.yanlis, 3, 120) };
      return q.soru && q.dogru && q.yanlis.length ? q : null;
    }).filter(Boolean);
    if (s.length) { t.sorular = s; }
    const od = Math.round(Number(o.odul));
    if (isFinite(od) && od > 0) { t.odul = Math.min(100000, od); }
    if (Object.keys(t).length) { e.oyunlar = t; }
  }
  const r = ham.roman;
  if (r && typeof r === "object") {
    const t = { baslik: fanMetin(r.baslik, 160), ozet: fanMetin(r.ozet, 1500),
      bolumler: (Array.isArray(r.bolumler) ? r.bolumler : []).slice(0, EVR_BOLUM_SINIR).map(function (b, i) {
        return { id: fanMetin(b && b.id, 40).replace(/[^\w-]/g, "") || ("b" + i), baslik: fanMetin(b && b.baslik, 160), metin: fanMetin(b && b.metin, EVR_METIN_SINIR) };
      }) };
    if (t.baslik.trim() || t.ozet.trim() || t.bolumler.length) { e.roman = t; }
  }
  if (Array.isArray(ham.cizimler)) {
    const c = ham.cizimler.slice(0, EVC_SINIR).map(function (x, i) {
      if (!x || typeof x !== "object") { return null; }
      const t = { id: fanMetin(x.id, 40).replace(/[^\w-]/g, "") || ("c" + i), baslik: fanMetin(x.baslik, 120), aciklama: fanMetin(x.aciklama, 1000) };
      const en = Math.round(Number(x.en)), boy = Math.round(Number(x.boy));
      if (en > 0 && boy > 0) { t.en = Math.min(4000, en); t.boy = Math.min(4000, boy); }
      if (typeof x.v === "string" && x.v.length <= EVC_VERI_SINIR && EVC_VERI.test(x.v)) { t.v = x.v; }
      if (typeof x.yol === "string" && EVC_YOL.test(x.yol)) { t.yol = x.yol; }
      return t;
    }).filter(Boolean);
    if (c.length) { e.cizimler = c; }
  }
}

/* ==================== çizim deposu (IndexedDB + bellek) ==================== */

const CIZIM_BELLEK = {};   /* çizim kimliği → data: adresi */
let cizimDbSoz = null;

function cizimDb() {
  if (!cizimDbSoz) {
    cizimDbSoz = new Promise(function (coz, reddet) {
      try {
        const r = indexedDB.open("tentifor-cizim", 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("c"); };
        r.onsuccess = function () { coz(r.result); };
        r.onerror = function () { reddet(r.error); };
      } catch (hata) { reddet(hata); }
    });
  }
  return cizimDbSoz;
}

async function cizimYaz(id, v) {
  CIZIM_BELLEK[id] = v;
  try {
    const db = await cizimDb();
    await new Promise(function (coz) {
      const t = db.transaction("c", "readwrite");
      t.objectStore("c").put(v, id);
      t.oncomplete = function () { coz(); };
      t.onerror = t.onabort = function () { coz(); };
    });
  } catch (_) { /* yalnızca bellekte kalır */ }
}

async function cizimOku(id) {
  if (CIZIM_BELLEK[id]) { return CIZIM_BELLEK[id]; }
  try {
    const db = await cizimDb();
    const v = await new Promise(function (coz) {
      const r = db.transaction("c", "readonly").objectStore("c").get(id);
      r.onsuccess = function () { coz(r.result || null); };
      r.onerror = function () { coz(null); };
    });
    if (v) { CIZIM_BELLEK[id] = v; }
    return v;
  } catch (_) { return null; }
}

async function cizimSil(id) {
  delete CIZIM_BELLEK[id];
  try {
    const db = await cizimDb();
    db.transaction("c", "readwrite").objectStore("c").delete(id);
  } catch (_) { /* yok */ }
}

function blobVeri(b) {
  return new Promise(function (coz) {
    const r = new FileReader();
    r.onload = function () { coz(String(r.result || "")); };
    r.onerror = function () { coz(""); };
    r.readAsDataURL(b);
  });
}

/** Görselin gösterilecek adresi: dosyadaki veri, bellekteki veri ya da sitedeki yol. */
function cizimKaynak(c) {
  if (c.v && EVC_VERI.test(c.v)) { return c.v; }
  if (CIZIM_BELLEK[c.id]) { return CIZIM_BELLEK[c.id]; }
  if (c.yol && EVC_YOL.test(c.yol)) { return c.yol; }
  return "";
}

/** Eserin bütün çizimlerini belleğe alır (dosyaya gömmek için). */
async function cizimleriIsit(e) {
  const l = (e && e.cizimler) || [];
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (c.v || CIZIM_BELLEK[c.id]) { continue; }
    const v = await cizimOku(c.id);
    if (v || !c.yol || !EVC_YOL.test(c.yol)) { continue; }
    try {
      const r = await fetch(c.yol);
      if (r.ok) { const d = await blobVeri(await r.blob()); if (EVC_VERI.test(d)) { CIZIM_BELLEK[c.id] = d; } }
    } catch (_) { /* çevrimdışı */ }
  }
}

/** Eserin görselleri gömülmüş kopyası (dosyaya yazmak için). */
function cizimGomulu(e) {
  if (!e || e.tur !== "evren" || !(e.cizimler || []).length) { return e; }
  const k = Object.assign({}, e);
  k.cizimler = e.cizimler.map(function (c) {
    const v = c.v || CIZIM_BELLEK[c.id];
    const t = Object.assign({}, c);
    if (v) { t.v = v; }
    return t;
  });
  return k;
}

/** Yerel listelere yazarken görseller IndexedDB'ye taşınır: localStorage şişmesin. */
function cizimleriAyir(l) {
  (Array.isArray(l) ? l : [l]).forEach(function (e) {
    if (!e || !Array.isArray(e.cizimler)) { return; }
    e.cizimler.forEach(function (c) {
      if (c && c.v) { cizimYaz(c.id, c.v); delete c.v; }
    });
  });
}

async function cizimleriSiteyeYukle(eserId) {
  const kayit = ((veri.fanEserleri || {}).evrenler || []).find(function (x) { return x.id === eserId; });
  if (!kayit || typeof githubGorselYukle !== "function") { return; }
  await cizimleriIsit(kayit);
  let yuklenen = 0, hata = "";
  for (let i = 0; i < kayit.cizimler.length; i++) {
    const c = kayit.cizimler[i];
    const v = c.v || CIZIM_BELLEK[c.id];
    if (!v) { continue; }
    const m = v.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
    if (!m) { continue; }
    const yol = "ikon/fan/" + fanSlug(eserId) + "-" + fanSlug(c.id) + "." + (m[1] === "jpeg" ? "jpg" : m[1]);
    const r = await githubGorselYukle(yol, m[2]);
    if (r.ok) { c.yol = yol; delete c.v; yuklenen++; } else { hata = r.sebep; c.v = v; }
  }
  if (typeof fanPDurum === "function") {
    fanPDurum(hata ? "Çizimler GitHub'a yüklenemedi (" + hata + "); veride gömülü kaldılar. Kaydet ve Yayınla."
      : yuklenen + " çizim GitHub'a yüklendi. Şimdi Kaydet, sonra Yayınla.", !hata);
  }
}

/** Yüklenen görseli küçültür: en uzun kenar 1600 px, JPEG, ≈1,2 MB'ı geçmez. */
function cizimKucult(dosya) {
  return new Promise(function (coz, reddet) {
    if (!dosya || !/^image\//.test(dosya.type || "")) { reddet(new Error("Bu bir görsel değil")); return; }
    if (dosya.size > 30 * 1024 * 1024) { reddet(new Error("Görsel çok büyük (en fazla 30 MB)")); return; }
    const url = URL.createObjectURL(dosya);
    const img = new Image();
    img.onerror = function () { URL.revokeObjectURL(url); reddet(new Error("Görsel açılamadı")); };
    img.onload = function () {
      URL.revokeObjectURL(url);
      try {
        let olcek = Math.min(1, 1600 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        for (let deneme = 0; deneme < 5; deneme++) {
          const en = Math.max(1, Math.round((img.naturalWidth || 1) * olcek));
          const boy = Math.max(1, Math.round((img.naturalHeight || 1) * olcek));
          const t = document.createElement("canvas");
          t.width = en; t.height = boy;
          const c = t.getContext("2d");
          c.fillStyle = "#fff";
          c.fillRect(0, 0, en, boy);
          c.drawImage(img, 0, 0, en, boy);
          let q = 0.86, v = t.toDataURL("image/jpeg", q);
          while (v.length > EVC_VERI_SINIR * 0.75 && q > 0.5) { q -= 0.12; v = t.toDataURL("image/jpeg", q); }
          if (v.length <= EVC_VERI_SINIR && EVC_VERI.test(v)) { coz({ v: v, en: en, boy: boy }); return; }
          olcek *= 0.7;
        }
        reddet(new Error("Görsel küçültülemedi"));
      } catch (_) { reddet(new Error("Bu görsel işlenemedi")); }
    };
    img.src = url;
  });
}

/* ==================== oyunlar: içerik ==================== */

function evoDolu(x) { return String(x || "").trim(); }
function evoKisa(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function evoTekil(l) { const g = {}; return l.filter(function (x) { const k = koNormal(x); if (!k || g[k]) { return false; } g[k] = true; return true; }); }

function evoAyar(e, id) { return ((e.oyunlar || {})[id]) || {}; }
function evoAd(e, id) { const g = EVO_OYUNLAR.find(function (x) { return x.id === id; }); return evoAyar(e, id).ad || (g ? g.ad : id); }

function evoHaritaYerleri(e) {
  return (((e.harita || {}).yerler) || []).filter(function (y) { return evoDolu(y.ad); });
}

/** Bütün gezegenlerin adlandırılmış yerleri (kelime ve sınav için; harita bulmacası yalnızca ana haritada). */
function evoTumYerler(e) {
  let l = evoHaritaYerleri(e);
  (e.gezegenler || []).forEach(function (g) { l = l.concat((((g.harita || {}).yerler) || []).filter(function (y) { return evoDolu(y.ad); })); });
  return l;
}

function evoKelimeler(e) {
  const adlar = [];
  (e.kisiler || []).forEach(function (x) { if (!x.kutu) { adlar.push(x.ad); } });
  (e.yerler || []).forEach(function (x) { adlar.push(x.ad); });
  (e.sozluk || []).forEach(function (x) { adlar.push(x.terim); });
  (e.kurallar || []).forEach(function (x) { adlar.push(x.ad); });
  evoTumYerler(e).forEach(function (y) { adlar.push(y.ad); });
  (e.gezegenler || []).forEach(function (g) { adlar.push(g.ad); });
  ((e.oyunlar || {}).kelimeler || []).forEach(function (k) { adlar.push(k); });
  return koListe(adlar);
}

/** Sorunun metninde cevabın kendisi geçmesin. */
function evoGizle(metin, cevap) {
  const c = String(cevap || "").trim();
  if (!c) { return metin; }
  return String(metin).replace(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "…");
}

/** Soru havuzu: { soru, dogru, havuz (yanlış seçenek adayları) } */
function evoSoruHavuzu(e) {
  const l = [];
  const grup = function (liste, soruAl, cevapAl, kalip) {
    const uygun = (liste || []).filter(function (x) { return evoDolu(cevapAl(x)) && evoDolu(soruAl(x)); });
    const cevaplar = evoTekil(uygun.map(function (x) { return String(cevapAl(x)).trim(); }));
    if (cevaplar.length < 4) { return; }
    uygun.forEach(function (x) {
      const d = String(cevapAl(x)).trim();
      l.push({ soru: kalip(evoKisa(evoGizle(soruAl(x), d), 200)), dogru: d,
        havuz: cevaplar.filter(function (c) { return koNormal(c) !== koNormal(d); }) });
    });
  };
  grup((e.kisiler || []).filter(function (x) { return !x.kutu; }), function (x) { return x.rol || x.aciklama; }, function (x) { return x.ad; },
    function (s) { return "“" + s + "” — bu kim?"; });
  grup(e.yerler, function (x) { return x.aciklama; }, function (x) { return x.ad; }, function (s) { return "“" + s + "” — burası neresi?"; });
  grup(evoTumYerler(e), function (x) { return x.not; }, function (x) { return x.ad; }, function (s) { return "Haritada: “" + s + "” — neresi?"; });
  grup(e.sozluk, function (x) { return x.tanim; }, function (x) { return x.terim; }, function (s) { return "“" + s + "” — hangi terim?"; });
  grup(e.tarih, function (x) { return x.olay; }, function (x) { return x.zaman; }, function (s) { return "“" + s + "” — ne zaman oldu?"; });
  grup(e.kurallar, function (x) { return x.aciklama; }, function (x) { return x.ad; }, function (s) { return "“" + s + "” — hangi kural?"; });
  ((e.oyunlar || {}).sorular || []).forEach(function (q) { l.push({ soru: q.soru, dogru: q.dogru, havuz: q.yanlis.slice(), kendi: true }); });
  return l;
}

/** Hangi oyun oynanabilir: açık mı, yeterli içerik var mı? */
function evoDurumlari(e) {
  return EVO_OYUNLAR.map(function (g) {
    const sayi = g.id === "kelime" ? evoKelimeler(e).length : (EVO_SORU_OYUNU[g.id] ? evoSoruHavuzu(e).length
      : (g.id === "zaman" ? evoZamanOlaylari(e).length : evoHaritaYerleri(e).length));
    return { id: g.id, ad: evoAd(e, g.id), ozet: g.ozet, acik: evoAyar(e, g.id).acik !== false, sayi: sayi, yeter: sayi >= EVO_EN_AZ[g.id] };
  });
}

function evoOynanabilir(e) { return evoDurumlari(e).filter(function (d) { return d.acik && d.yeter; }); }

/* ==================== oyunlar: ödül ==================== */

function evoOdulMiktari(e, p) {
  const tavan = Math.max(1, Math.floor(EVO_ODUL_TAVAN_EG / p.kur));
  const od = Number((e.oyunlar || {}).odul);
  return od > 0 ? Math.min(tavan, Math.round(od)) : Math.max(1, Math.round(EVO_ODUL_EG / p.kur));
}

/** Ödül verilmeyen durumun nedeni; verilebiliyorsa "". */
function evoOdulEngeli() {
  if (!EVS) { return "Evren açık değil."; }
  if (EVS.kaynak === "benim" || (EVS.kaynak === "fan" && evrenKendisininMi(EVS.id))) { return "Kendi evreninde oyunlar ödül vermez; deneme için oynayabilirsin."; }
  if (EVS.kaynak === "acilan") { return "Dosyadan açılan evrenlerde ödül yok; evren sitede yayımlanınca verir."; }
  return "";
}

function evoOdulVer(oyunId, oyunAd) {
  const engel = evoOdulEngeli();
  if (engel) { return engel; }
  const v = evrenSayfaVerisi();
  if (!v || v.kilitli) { return ""; }
  const a = evrenCuzdanAnahtari();
  const p = evrenParasi(a, v.eser);
  egYukle();
  const bugun = bugununAdi();
  if (!egCuzdan.oyun || egCuzdan.oyun.gun !== bugun) { egCuzdan.oyun = { gun: bugun, l: [] }; }
  const k = a + "|" + oyunId;
  if (egCuzdan.oyun.l.indexOf(k) !== -1) { return "Bu oyunun bugünkü ödülünü aldın; yarın yine."; }
  if (egCuzdan.oyun.l.length >= EVO_GUNLUK) { return "Bugünlük oyun ödüllerin doldu."; }
  const n = evoOdulMiktari(v.eser, p);
  egCuzdan.oyun.l.push(k);
  const xp = typeof oyunXpVer === "function" ? oyunXpVer(k) : 0;
  egParaHatirla(a, p);
  egKaydet();
  egBakiyeDegistir(a, n, "Evren oyunu: " + oyunAd);
  if (typeof eckaBildir === "function") { eckaBildir("+" + n + " " + p.ad + " · " + oyunAd); }
  if (typeof hesapHatirlat === "function") { hesapHatirlat("evren"); }
  return "Kazandın: " + egTutar(n, p) + (xp ? " ve " + xp + " XP" : "") + ".";
}

/* ==================== oyunlar: oynanış ==================== */

let EVO = null;   /* { evren, oyun, … } açık oyun */

function evoAnahtar() { return "evo|" + evrenCuzdanAnahtari(); }

function evoKelimeOyunu(v) {
  const e = v.eser;
  const ad = evoAd(e, "kelime");
  return {
    anahtar: evoAnahtar(), ad: ad, paylasAd: (e.ad || "Evren") + " · " + ad,
    not: "Bu evrenin kişilerinden, yerlerinden ya da sözlüğünden bir ad.",
    kelimeler: evoKelimeler(e),
    bosNot: "Bu oyun için en az " + EVO_EN_AZ.kelime + " uygun ad (4–7 harf) gerekiyor.",
    hikayeUst: ad, hikayeBaslik: e.ad || "Evren", hikayeAdres: KART_ADRES + rotadanYol(rota()),
    bilgi: function (k) { return evoKelimeBilgi(e, k); },
    bitince: function (cozuldu) {
      if (!cozuldu) { return; }
      const m = evoOdulVer("kelime", ad);
      if (m) { setTimeout(function () { const d = document.querySelector("#evoDurum"); if (d) { d.textContent = m; } }, 50); }
    }
  };
}

function evoKelimeBilgi(e, k) {
  const esit = function (a) { return koNormal(a) === k; };
  const kisi = (e.kisiler || []).find(function (x) { return esit(x.ad); });
  if (kisi) { return koBilgiKutu("Kişi" + (kisi.rol ? " · " + kisi.rol : ""), kisi.ad, kisi.aciklama, "", ""); }
  const yer = (e.yerler || []).find(function (x) { return esit(x.ad); }) || evoTumYerler(e).find(function (x) { return esit(x.ad); });
  if (yer) { return koBilgiKutu("Yer" + (yer.tur ? " · " + yer.tur : ""), yer.ad, yer.aciklama || yer.not, "", ""); }
  const s = (e.sozluk || []).find(function (x) { return esit(x.terim); });
  if (s) { return koBilgiKutu("Sözlük", s.terim, s.tanim, "", ""); }
  const kural = (e.kurallar || []).find(function (x) { return esit(x.ad); });
  if (kural) { return koBilgiKutu("Kural" + (kural.tur ? " · " + kural.tur : ""), kural.ad, kural.aciklama, "", ""); }
  return "";
}

function evoKaristir(l) {
  const d = l.slice();
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = d[i]; d[i] = d[j]; d[j] = x; }
  return d;
}

function evoSinavBaslat(e) {
  const havuz = evoKaristir(evoSoruHavuzu(e)).slice(0, 10);
  EVO = { oyun: "sinav", evren: EVS.kaynak + ":" + EVS.id, i: 0, dogru: 0, secim: null, mesaj: "",
    sorular: havuz.map(function (q) {
      return { soru: q.soru, dogru: q.dogru, secenekler: evoKaristir([q.dogru].concat(evoKaristir(q.havuz).slice(0, 3))) };
    }) };
}

function evoHaritaBaslat(e) {
  const yerler = evoKaristir(evoTekilYerler(e)).slice(0, 5);
  EVO = { oyun: "harita", evren: EVS.kaynak + ":" + EVS.id, i: 0, dogru: 0, hedefler: yerler.map(function (y) { return y.id; }), cevap: null, mesaj: "" };
}

/** Doğru mu?: soru havuzundan 8 iddia; yarısı kadarı yanlış cevapla kurulur. */
function evoDogruBaslat(e) {
  const havuz = evoKaristir(evoSoruHavuzu(e)).slice(0, 8);
  EVO = { oyun: "dogru", evren: EVS.kaynak + ":" + EVS.id, i: 0, dogru: 0, secim: null, mesaj: "",
    sorular: havuz.map(function (q) {
      const yanlis = q.havuz.length && Math.random() < 0.5;
      const cevap = yanlis ? evoKaristir(q.havuz)[0] : q.dogru;
      return { soru: q.soru + " → " + cevap, dogru: yanlis ? "Yanlış" : "Doğru", secenekler: ["Doğru", "Yanlış"] };
    }) };
}

/** Tarih olayları, evrenin yazıldığı sırayla (yazar tarihi eskiden yeniye dizer). */
function evoZamanOlaylari(e) {
  return (e.tarih || []).filter(function (x) { return evoDolu(x.olay); });
}

/** Zaman sırası: üç tur, her turda 4 olay; ikisini tam sırasıyla bilen geçer. */
function evoZamanBaslat(e) {
  const l = evoZamanOlaylari(e).map(function (x, i) { return { i: i, olay: evoKisa(x.olay, 140), zaman: x.zaman || "" }; });
  const turlar = [];
  for (let t = 0; t < 3; t++) {
    turlar.push(evoKaristir(evoKaristir(l).slice(0, 4)));
  }
  EVO = { oyun: "zaman", evren: EVS.kaynak + ":" + EVS.id, i: 0, dogru: 0, turlar: turlar, secilen: [], cevap: null, mesaj: "" };
}

/** Aynı adı taşıyan yerlerden yalnızca biri sorulur (hangisi olduğu belirsiz kalmasın). */
function evoTekilYerler(e) {
  const say = {};
  evoHaritaYerleri(e).forEach(function (y) { const k = koNormal(y.ad); say[k] = (say[k] || 0) + 1; });
  return evoHaritaYerleri(e).filter(function (y) { return say[koNormal(y.ad)] === 1; });
}

function evoGecerli() { return EVO && EVS && EVO.evren === EVS.kaynak + ":" + EVS.id; }

function evoSinavHtml(e) {
  const ad = evoAd(e, EVO.oyun);
  const n = EVO.sorular.length;
  if (EVO.i >= n) {
    const esik = evoEsik(n);
    return '<div class="evo-oyun"><span class="oyun-etiket">' + kacir(ad) + "</span>" +
      '<p class="evo-skor">' + EVO.dogru + " / " + n + "</p>" +
      '<p class="oyun-not">' + (EVO.dogru >= esik ? "Geçtin! " : "Geçmek için en az " + esik + " doğru gerekiyor. ") + kacir(EVO.mesaj) + "</p>" +
      '<div class="oyun-sira"><button class="dugme" data-evo-basla="' + EVO.oyun + '">Tekrar</button><button class="dugme dugme-sade" data-evo-kapat>Oyunlara dön</button></div></div>';
  }
  const q = EVO.sorular[EVO.i];
  const cevaplandi = EVO.secim !== null;
  return '<div class="evo-oyun"><div class="gk-ust"><span class="oyun-etiket">' + kacir(ad) + '</span><span class="oyun-not">' + (EVO.i + 1) + " / " + n + " · " + EVO.dogru + " doğru</span></div>" +
    '<p class="evo-soru">' + (q.soruHtml || kacir(q.soru)) + "</p>" +
    '<div class="evo-secenekler">' + q.secenekler.map(function (s, j) {
      const sinif = cevaplandi ? (s === q.dogru ? " dogru" : (j === EVO.secim ? " yanlis" : "")) : "";
      return '<button class="evo-secenek' + sinif + '" data-evo-sec="' + j + '"' + (cevaplandi ? " disabled" : "") + ">" + kacir(s) + "</button>";
    }).join("") + "</div>" +
    (cevaplandi ? '<div class="oyun-sira"><button class="dugme" data-evo-sonraki>' + (EVO.i + 1 < n ? "Sonraki" : "Bitir") + "</button></div>" : "") +
    '<div class="oyun-sira"><button class="dugme dugme-sade" data-evo-kapat>Bırak</button></div></div>';
}

function evoHaritaHtml(e) {
  const ad = evoAd(e, "harita");
  const n = EVO.hedefler.length;
  const yerler = evoHaritaYerleri(e);
  if (EVO.i >= n) {
    return '<div class="evo-oyun"><span class="oyun-etiket">' + kacir(ad) + "</span>" +
      '<p class="evo-skor">' + EVO.dogru + " / " + n + "</p>" +
      '<p class="oyun-not">' + (EVO.dogru >= 3 ? "Haritayı biliyorsun! " : "Geçmek için en az 3 doğru gerekiyor. ") + kacir(EVO.mesaj) + "</p>" +
      '<div class="oyun-sira"><button class="dugme" data-evo-basla="harita">Tekrar</button><button class="dugme dugme-sade" data-evo-kapat>Oyunlara dön</button></div></div>';
  }
  const hedef = yerler.find(function (y) { return y.id === EVO.hedefler[EVO.i]; }) || {};
  const svg = evrenHaritaSvg({ yerler: yerler, renk: (e.harita || {}).renk, stil: (e.harita || {}).stil },
    { etiketsiz: true, secili: EVO.cevap ? hedef.id : null }).replace(/data-evh-yer=/g, "data-evo-yer=");
  return '<div class="evo-oyun"><div class="gk-ust"><span class="oyun-etiket">' + kacir(ad) + '</span><span class="oyun-not">' + (EVO.i + 1) + " / " + n + " · " + EVO.dogru + " doğru</span></div>" +
    '<p class="evo-soru">' + (EVO.cevap ? (EVO.cevap === "d" ? "Doğru! " : "Olmadı. ") + "<b>" + kacir(hedef.ad) + "</b> işaretli yerde." : "<b>" + kacir(hedef.ad) + "</b> nerede? Haritada dokun.") + "</p>" +
    '<div class="evo-harita' + (EVO.cevap ? " bitti" : "") + '">' + svg + "</div>" +
    (EVO.cevap ? '<div class="oyun-sira"><button class="dugme" data-evo-sonraki>' + (EVO.i + 1 < n ? "Sonraki" : "Bitir") + "</button></div>" : "") +
    '<div class="oyun-sira"><button class="dugme dugme-sade" data-evo-kapat>Bırak</button></div></div>';
}

function evoZamanHtml(e) {
  const ad = evoAd(e, "zaman");
  const n = EVO.turlar.length;
  if (EVO.i >= n) {
    return '<div class="evo-oyun"><span class="oyun-etiket">' + kacir(ad) + "</span>" +
      '<p class="evo-skor">' + EVO.dogru + " / " + n + "</p>" +
      '<p class="oyun-not">' + (EVO.dogru >= 2 ? "Tarihi biliyorsun! " : "Geçmek için iki turu tam bilmelisin. ") + kacir(EVO.mesaj) + "</p>" +
      '<div class="oyun-sira"><button class="dugme" data-evo-basla="zaman">Tekrar</button><button class="dugme dugme-sade" data-evo-kapat>Oyunlara dön</button></div></div>';
  }
  const tur = EVO.turlar[EVO.i];
  const dogruSira = tur.slice().sort(function (a, b) { return a.i - b.i; });
  return '<div class="evo-oyun"><div class="gk-ust"><span class="oyun-etiket">' + kacir(ad) + '</span><span class="oyun-not">Tur ' + (EVO.i + 1) + " / " + n + " · " + EVO.dogru + " doğru</span></div>" +
    '<p class="evo-soru">' + (EVO.cevap ? (EVO.cevap === "d" ? "Doğru sıra! " : "Olmadı. Doğrusu:") : "En eskiden en yeniye dokun.") + "</p>" +
    (EVO.cevap
      ? '<ol class="evo-zaman-liste">' + dogruSira.map(function (x) { return "<li>" + (x.zaman ? "<b>" + kacir(x.zaman) + "</b> · " : "") + kacir(x.olay) + "</li>"; }).join("") + "</ol>"
      : '<div class="evo-secenekler">' + tur.map(function (x, j) {
          const s = EVO.secilen.indexOf(j);
          return '<button class="evo-secenek' + (s !== -1 ? " secili" : "") + '" data-evo-zaman="' + j + '"' + (s !== -1 ? " disabled" : "") + ">" +
            (s !== -1 ? "<b>" + (s + 1) + ".</b> " : "") + kacir(x.olay) + "</button>";
        }).join("") + "</div>") +
    (EVO.cevap ? '<div class="oyun-sira"><button class="dugme" data-evo-sonraki>' + (EVO.i + 1 < n ? "Sonraki tur" : "Bitir") + "</button></div>" : "") +
    '<div class="oyun-sira"><button class="dugme dugme-sade" data-evo-kapat>Bırak</button></div></div>';
}

function evoEsik(n) { return EVO.oyun === "dogru" ? n - 1 : Math.ceil(n * 0.7); }

function evoTurSayisi() { return EVO_SORU_OYUNU[EVO.oyun] ? EVO.sorular.length : (EVO.oyun === "zaman" ? EVO.turlar.length : EVO.hedefler.length); }

function evoBitir(e) {
  const n = evoTurSayisi();
  const esik = EVO_SORU_OYUNU[EVO.oyun] ? evoEsik(n) : (EVO.oyun === "zaman" ? 2 : 3);
  if (EVO.dogru >= esik) { EVO.mesaj = evoOdulVer(EVO.oyun, evoAd(e, EVO.oyun)); }
  if (typeof olaySay === "function") { olaySay("evren_oyun:" + EVO.oyun); }
}

/* ==================== oyunlar sekmesi ==================== */

function evrenOyunlarBolumu(v) {
  const e = v.eser;
  if (evoGecerli() && EVO_SORU_OYUNU[EVO.oyun]) { return evoSinavHtml(e); }
  if (evoGecerli() && EVO.oyun === "zaman") { return evoZamanHtml(e); }
  if (evoGecerli() && EVO.oyun === "harita") { return evoHaritaHtml(e); }
  const durum = evoDurumlari(e);
  const a = evrenCuzdanAnahtari();
  const p = evrenParasi(a, e);
  const engel = evoOdulEngeli();
  const oynanir = durum.filter(function (d) { return d.acik && d.yeter; });
  const kelime = oynanir.some(function (d) { return d.id === "kelime"; }) ? evoKelimeOyunu(v) : null;
  if (kelime) { KO_OYUNLAR[kelime.anahtar] = kelime; kelime.alan = null; }
  return (engel ? '<p class="oyun-not">' + kacir(engel) + "</p>"
      : '<p class="oyun-not">Kazanırsan her oyun günde bir kez <b>' + kacir(egTutar(evoOdulMiktari(e, p), p)) + "</b> verir. Evrengezer bürosunda EG'ye çevirebilirsin.</p>") +
    '<p class="pencere-durum iyi" id="evoDurum" role="status"></p>' +
    (kelime ? '<div data-ko-kap>' + koOyunHtml(kelime) + "</div>" : "") +
    oynanir.filter(function (d) { return d.id !== "kelime"; }).map(function (d) {
      return '<div class="yaris-kart evo-kart"><h4>' + kacir(d.ad) + '</h4><p class="oyun-not">' + kacir(d.ozet) + "</p>" +
        '<div class="yaris-kart-alt"><span></span><button class="dugme" data-evo-basla="' + d.id + '">Başla</button></div></div>';
    }).join("") +
    (!oynanir.length ? '<p class="oyun-not">Bu evrende henüz oynanacak oyun yok.</p>' : "") +
    (EVS.kaynak === "benim" ? evoAyarHtml(e, durum) : "");
}

function evoAyarHtml(e, durum) {
  const o = e.oyunlar || {};
  const p = evrenParasi("ev:" + e.id, e);
  return '<details class="kutu-y evo-ayar" open><summary><b>Oyunları evrenine göre ayarla</b></summary>' +
    '<p class="oyun-not">Oyunlar evreninin içeriğinden kurulur. Kişi, yer, sözlük, tarih ve harita ekledikçe çoğalırlar. ' +
      "Başkaları evrenini sitede (fanmade) oynayınca kazananlar senin evreninin parasını alır.</p>" +
    durum.map(function (d) {
      return '<div class="evo-ayar-oyun"><label class="evo-onay"><input type="checkbox" data-evo-ayar="acik" data-evo-oyun="' + d.id + '"' + (d.acik ? " checked" : "") + "> " +
          "<b>" + kacir(d.ad) + "</b></label>" +
        '<span class="oyun-not">' + d.sayi + (d.id === "kelime" ? " uygun kelime" : (EVO_SORU_OYUNU[d.id] ? " soru" : (d.id === "zaman" ? " tarih olayı" : " adlandırılmış yer"))) +
          (d.yeter ? "" : " · en az " + EVO_EN_AZ[d.id] + " gerekiyor") + "</span>" +
        '<input class="kod-giris arac-giris" maxlength="60" data-evo-ayar="ad" data-evo-oyun="' + d.id + '" aria-label="' + kacir(d.ad) + ' adı" placeholder="Oyunun adı: ' +
          kacir(EVO_OYUNLAR.find(function (g) { return g.id === d.id; }).ad) + '" value="' + kacir(evoAyar(e, d.id).ad || "") + '"></div>';
    }).join("") +
    '<label for="evoKelimeler">Ek kelimeler (her satıra bir; 4–7 harf)</label>' +
    '<textarea class="kod-giris arac-giris" id="evoKelimeler" rows="4" data-evo-ayar="kelimeler">' + kacir((o.kelimeler || []).join("\n")) + "</textarea>" +
    '<label for="evoSorular">Kendi soruların (her satır: Soru | doğru cevap | yanlış | yanlış | yanlış)</label>' +
    '<textarea class="kod-giris arac-giris" id="evoSorular" rows="5" data-evo-ayar="sorular" placeholder="Kor kaç saat yanar? | Yirmi | On | Kırk | Altı">' +
      kacir((o.sorular || []).map(function (q) { return [q.soru, q.dogru].concat(q.yanlis).join(" | "); }).join("\n")) + "</textarea>" +
    '<label for="evoOdul">Ödül (' + kacir(p.ad) + ", kazanana günde bir kez; en fazla " + Math.max(1, Math.floor(EVO_ODUL_TAVAN_EG / p.kur)) + ")</label>" +
    '<input class="kod-giris arac-giris" id="evoOdul" type="number" min="1" max="' + Math.max(1, Math.floor(EVO_ODUL_TAVAN_EG / p.kur)) + '" data-evo-ayar="odul" value="' + (o.odul || evoOdulMiktari(e, p)) + '">' +
    '<p class="oyun-not" data-fan-kayit="evo">Değişiklikler kendiliğinden kaydedilir.</p></details>';
}

function evoAyarYaz(el) {
  if (!EVS || EVS.kaynak !== "benim") { return; }
  const alan = el.dataset.evoAyar, oyun = el.dataset.evoOyun;
  evrenBenimDegistir(EVS.id, function (e) {
    const o = e.oyunlar && typeof e.oyunlar === "object" ? e.oyunlar : {};
    if (alan === "acik" || alan === "ad") {
      const a = o[oyun] && typeof o[oyun] === "object" ? o[oyun] : {};
      if (alan === "acik") { if (el.checked) { delete a.acik; } else { a.acik = false; } }
      else { const t = el.value.trim().slice(0, 60); if (t) { a.ad = t; } else { delete a.ad; } }
      if (Object.keys(a).length) { o[oyun] = a; } else { delete o[oyun]; }
    } else if (alan === "kelimeler") {
      const l = el.value.split(/\n+/).map(function (s) { return s.trim().slice(0, 20); }).filter(Boolean).slice(0, 200);
      if (l.length) { o.kelimeler = l; } else { delete o.kelimeler; }
    } else if (alan === "sorular") {
      const l = el.value.split(/\n+/).map(function (s) {
        const p = s.split("|").map(function (x) { return x.trim(); });
        return p.length >= 3 && p[0] && p[1] ? { soru: p[0].slice(0, 300), dogru: p[1].slice(0, 120), yanlis: p.slice(2, 5).filter(Boolean).map(function (x) { return x.slice(0, 120); }) } : null;
      }).filter(function (q) { return q && q.yanlis.length; }).slice(0, 60);
      if (l.length) { o.sorular = l; } else { delete o.sorular; }
    } else if (alan === "odul") {
      const n = Math.round(Number(el.value));
      if (n > 0) { o.odul = n; } else { delete o.odul; }
    }
    if (Object.keys(o).length) { e.oyunlar = o; } else { delete e.oyunlar; }
  });
}

/* ==================== roman ==================== */

let EVR = { evren: "", secili: null, onizle: false };
let evrKayitZaman = null;
let evrBekleyen = null;   /* { id, alan, bolum, deger } */

function evrDurum() {
  const a = EVS ? EVS.kaynak + ":" + EVS.id : "";
  if (EVR.evren !== a) { EVR = { evren: a, secili: null, onizle: false }; }
  return EVR;
}

function evrenRomanBolumu(v) {
  const e = v.eser;
  const r = e.roman || { baslik: "", ozet: "", bolumler: [] };
  const d = evrDurum();
  const bolumler = r.bolumler || [];
  if (EVS.kaynak === "benim" && !d.onizle) {
    const b = bolumler.find(function (x) { return x.id === d.secili; }) || bolumler[0] || null;
    if (b) { d.secili = b.id; }
    return '<div class="evr-duzen">' +
      '<div class="kutu-y"><label for="evrBaslik">Romanın adı</label><input class="kod-giris arac-giris" id="evrBaslik" maxlength="160" data-evr-alan="baslik" value="' + kacir(r.baslik || "") + '" placeholder="' + kacir(e.ad || "") + '">' +
        '<label for="evrOzet">Kısa özet</label><textarea class="kod-giris arac-giris" id="evrOzet" rows="3" maxlength="1500" data-evr-alan="ozet">' + kacir(r.ozet || "") + "</textarea></div>" +
      '<div class="evr-bolumler" role="list">' + bolumler.map(function (x, i) {
        return '<button class="dugme' + (b && x.id === b.id ? "" : " dugme-sade") + '" role="listitem" data-evr-sec="' + kacir(x.id) + '">' + kacir(evoKisa(evrBolumAdi(x, i), 30)) + "</button>";
      }).join("") +
        (bolumler.length < EVR_BOLUM_SINIR ? '<button class="dugme dugme-sade" data-evr-ekle>+ Bölüm ekle</button>' : "") + "</div>" +
      (b ? '<div class="kutu-y evr-bolum">' +
          '<label for="evrBolumBaslik">Bölümün adı</label><input class="kod-giris arac-giris" id="evrBolumBaslik" maxlength="160" data-evr-bolum-alan="baslik" value="' + kacir(b.baslik || "") + '" placeholder="Başlıksız bırakırsan: Bölüm ' + (bolumler.indexOf(b) + 1) + '">' +
          '<label for="evrBolumMetin">Metin</label><textarea class="kod-giris arac-giris fan-uzun evr-metin" id="evrBolumMetin" rows="18" maxlength="' + EVR_METIN_SINIR + '" data-evr-bolum-alan="metin">' + kacir(b.metin || "") + "</textarea>" +
          '<p class="oyun-not"><span id="evrSayac">' + fanKelime(b.metin) + "</span> kelime · kendiliğinden kaydedilir</p>" +
          '<div class="oyun-sira"><button class="dugme dugme-sade" data-evr-tasi="-1">↑ Öne al</button><button class="dugme dugme-sade" data-evr-tasi="1">↓ Sona al</button>' +
            '<button class="dugme dugme-sade y-sil" data-evr-sil="' + kacir(b.id) + '">' + (evrSilOnay === b.id ? "Emin misin? Sil" : "Bölümü sil") + "</button></div></div>"
        : '<p class="oyun-not">Romanın ilk bölümünü ekle. Her bölüm en fazla ' + EVR_METIN_SINIR.toLocaleString("tr-TR") + " harf.</p>") +
      (bolumler.length ? '<div class="oyun-sira"><button class="dugme dugme-sade" data-evr-onizle="1">Okur gibi gör</button></div>' : "") +
    "</div>";
  }
  if (!bolumler.length) { return '<p class="oyun-not">Bu evrenin henüz romanı yok.</p>'; }
  const i = Math.max(0, bolumler.findIndex(function (x) { return x.id === d.secili; }));
  const b = bolumler[i];
  d.secili = b.id;
  return '<div class="evr-oku">' +
    (EVS.kaynak === "benim" ? '<div class="oyun-sira"><button class="dugme dugme-sade" data-evr-onizle="0">← Yazmaya dön</button></div>' : "") +
    "<h3 class=\"evr-baslik\">" + kacir(r.baslik || e.ad || "Roman") + "</h3>" +
    (r.ozet ? '<p class="oyun-not">' + kacir(r.ozet) + "</p>" : "") +
    '<details class="evr-icindekiler"><summary>İçindekiler · ' + bolumler.length + " bölüm</summary><ol>" + bolumler.map(function (x, j) {
      return '<li><button class="ic-bag" data-evr-sec="' + kacir(x.id) + '">' + kacir(x.baslik || "Bölüm " + (j + 1)) + "</button></li>";
    }).join("") + "</ol></details>" +
    '<h4 class="evr-bolum-baslik">' + kacir(evrBolumAdi(b, i)) + "</h4>" +
    '<div class="okuma-metin fan-metin">' + paragraf(b.metin) + "</div>" +
    '<div class="oyun-sira evr-gez">' +
      (i > 0 ? '<button class="dugme dugme-sade" data-evr-sec="' + kacir(bolumler[i - 1].id) + '">← Önceki</button>' : "") +
      (i + 1 < bolumler.length ? '<button class="dugme" data-evr-sec="' + kacir(bolumler[i + 1].id) + '">Sonraki bölüm →</button>' : "") +
    "</div></div>";
}

let evrSilOnay = null;

/** "3. Kıyıda" ya da başlıksızsa "Bölüm 3" */
function evrBolumAdi(b, i) { return b.baslik ? (i + 1) + ". " + b.baslik : "Bölüm " + (i + 1); }

function evrDegistir(fn) {
  if (!EVS || EVS.kaynak !== "benim") { return; }
  evrenBenimDegistir(EVS.id, function (e) {
    const r = e.roman && typeof e.roman === "object" ? e.roman : { baslik: "", ozet: "", bolumler: [] };
    if (!Array.isArray(r.bolumler)) { r.bolumler = []; }
    fn(r);
    e.roman = r;
  });
}

function evrBekleyeniYaz() {
  if (evrKayitZaman) { clearTimeout(evrKayitZaman); evrKayitZaman = null; }
  const b = evrBekleyen;
  evrBekleyen = null;
  if (!b || !EVS || EVS.kaynak !== "benim" || EVS.id !== b.id) { return; }
  evrDegistir(function (r) {
    if (b.bolum) {
      const x = r.bolumler.find(function (y) { return y.id === b.bolum; });
      if (x) { x[b.alan] = b.alan === "metin" ? b.deger.slice(0, EVR_METIN_SINIR) : b.deger.slice(0, 160); }
    } else {
      r[b.alan] = b.alan === "ozet" ? b.deger.slice(0, 1500) : b.deger.slice(0, 160);
    }
  });
}

window.addEventListener("pagehide", evrBekleyeniYaz);

/* ==================== çizimler ==================== */

let evcSilOnay = null;

function evrenCizimBolumu(v) {
  const e = v.eser;
  const l = e.cizimler || [];
  const sahip = EVS.kaynak === "benim";
  setTimeout(function () { evcDoldur(e); }, 0);
  const resim = function (c) {
    const src = cizimKaynak(c);
    return '<img class="evc-resim" data-evc-resim="' + kacir(c.id) + '" alt="' + kacir(c.baslik || "Çizim") + '"' +
      (c.en && c.boy ? ' width="' + c.en + '" height="' + c.boy + '"' : "") + ' loading="lazy"' + (src ? ' src="' + kacir(src) + '"' : "") + ">";
  };
  return (sahip
      ? '<div class="kutu-y"><label class="fan-birak evc-yukle"><input type="file" accept="image/*" multiple data-evc-yukle>' +
          "<b>Çizim yükle</b><span>fotoğraf, taslak, harita çizimi · en fazla " + EVC_SINIR + " görsel</span></label>" +
          '<p class="oyun-not">Görseller küçültülüp bu cihazda saklanır. Evreni dosya olarak indirince ya da yazara gönderince içinde gider.</p>' +
          '<p class="pencere-durum" id="evcDurum" role="status"></p></div>'
      : "") +
    (l.length ? '<div class="evc-izgara">' + l.map(function (c) {
      return '<figure class="evc-kart">' +
        '<button class="evc-buyut" data-evc-buyut="' + kacir(c.id) + '" aria-label="Büyüt: ' + kacir(c.baslik || "çizim") + '">' + resim(c) + "</button>" +
        (sahip
          ? '<input class="kod-giris arac-giris" maxlength="120" data-evc-alan="baslik" data-evc-id="' + kacir(c.id) + '" value="' + kacir(c.baslik || "") + '" placeholder="Başlık" aria-label="Başlık">' +
            '<textarea class="kod-giris arac-giris" rows="2" maxlength="1000" data-evc-alan="aciklama" data-evc-id="' + kacir(c.id) + '" placeholder="Açıklama" aria-label="Açıklama">' + kacir(c.aciklama || "") + "</textarea>" +
            '<button class="dugme dugme-sade y-sil" data-evc-sil="' + kacir(c.id) + '">' + (evcSilOnay === c.id ? "Emin misin? Sil" : "Sil") + "</button>"
          : (c.baslik || c.aciklama ? "<figcaption>" + (c.baslik ? "<b>" + kacir(c.baslik) + "</b>" : "") + (c.aciklama ? "<span>" + kacir(c.aciklama) + "</span>" : "") + "</figcaption>" : "")) +
        "</figure>";
    }).join("") + "</div>"
    : '<p class="oyun-not">' + (sahip ? "Henüz çizim yok." : "Bu evrende çizim yok.") + "</p>");
}

/** Kaynağı sonradan bulunan görselleri doldurur (IndexedDB ya da sitedeki dosya). */
async function evcDoldur(e) {
  await cizimleriIsit(e);
  (e.cizimler || []).forEach(function (c) {
    const img = document.querySelector('#evrenSayfa img[data-evc-resim="' + CSS.escape(c.id) + '"]');
    const src = cizimKaynak(c);
    if (img && src && !img.getAttribute("src")) { img.setAttribute("src", src); }
  });
}

async function evcYukle(dosyalar) {
  const durum = document.querySelector("#evcDurum");
  const yaz = function (m, iyi) { if (durum) { durum.textContent = m; durum.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };
  const v = evrenSayfaVerisi();
  if (!v || EVS.kaynak !== "benim") { return; }
  const bos = EVC_SINIR - (v.eser.cizimler || []).length;
  const l = Array.from(dosyalar || []).slice(0, Math.max(0, bos));
  if (!l.length) { yaz(bos <= 0 ? "En fazla " + EVC_SINIR + " çizim." : "Görsel seçilmedi.", false); return; }
  let eklenen = 0, hata = "";
  for (let i = 0; i < l.length; i++) {
    yaz((i + 1) + " / " + l.length + " hazırlanıyor…", true);
    try {
      const r = await cizimKucult(l[i]);
      const id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await cizimYaz(id, r.v);
      evrenBenimDegistir(EVS.id, function (e) {
        if (!Array.isArray(e.cizimler)) { e.cizimler = []; }
        e.cizimler.push({ id: id, baslik: String(l[i].name || "").replace(/\.[^.]+$/, "").slice(0, 120), aciklama: "", en: r.en, boy: r.boy });
      });
      eklenen++;
    } catch (h) { hata = (h && h.message) || "Yüklenemedi"; }
  }
  evrenSayfaCiz();
  const d = document.querySelector("#evcDurum");
  if (d) { d.textContent = eklenen + " çizim eklendi." + (hata ? " Biri eklenemedi: " + hata : ""); d.className = "pencere-durum " + (hata ? "kotu" : "iyi"); }
}

function evcBuyut(id) {
  const v = evrenSayfaVerisi();
  const c = v && (v.eser.cizimler || []).find(function (x) { return x.id === id; });
  const perde = document.querySelector("#perde");
  if (!c || !perde) { return; }
  const src = cizimKaynak(c);
  perde.innerHTML = '<div class="pencere pencere-genis evc-pencere" role="dialog" aria-modal="true" aria-label="' + kacir(c.baslik || "Çizim") + '">' +
    '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
    (src ? '<img class="evc-buyuk" src="' + kacir(src) + '" alt="' + kacir(c.baslik || "Çizim") + '">' : '<p class="oyun-not">Görsel bu cihazda bulunamadı.</p>') +
    (c.baslik ? "<h3>" + kacir(c.baslik) + "</h3>" : "") + (c.aciklama ? paragraf(c.aciklama) : "") + "</div>";
  perde.hidden = false;
}

/* ==================== dosya görünümü: roman ve çizimler ==================== */

/* ==================== evren sayfası: sekmeler ==================== */

/* ==================== olaylar ==================== */

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-evo-basla], [data-evo-sec], [data-evo-sonraki], [data-evo-kapat], [data-evo-yer], [data-evo-zaman], " +
    "[data-evr-sec], [data-evr-ekle], [data-evr-sil], [data-evr-tasi], [data-evr-onizle], [data-evc-sil], [data-evc-buyut]");
  if (!h || !EVS) { return; }
  const d = h.dataset;
  const v = evrenSayfaVerisi();
  if (!v) { return; }
  const e = v.eser;

  if (d.evoBasla) {
    if (d.evoBasla === "sinav") { evoSinavBaslat(e); } else if (d.evoBasla === "harita") { evoHaritaBaslat(e); }
    else if (d.evoBasla === "dogru") { evoDogruBaslat(e); } else if (d.evoBasla === "zaman") { evoZamanBaslat(e); }
    evrenSayfaCiz();
    return;
  }
  if (h.hasAttribute("data-evo-kapat")) { EVO = null; evrenSayfaCiz(); return; }
  if (d.evoSec !== undefined && evoGecerli() && EVO_SORU_OYUNU[EVO.oyun] && EVO.secim === null) {
    EVO.secim = Number(d.evoSec);
    const q = EVO.sorular[EVO.i];
    if (q.secenekler[EVO.secim] === q.dogru) { EVO.dogru++; }
    evrenSayfaCiz();
    return;
  }
  if (h.hasAttribute("data-evo-sonraki") && evoGecerli()) {
    EVO.i++; EVO.secim = null; EVO.cevap = null;
    EVO.secilen = [];
    if (EVO.i >= evoTurSayisi()) { evoBitir(e); }
    evrenSayfaCiz();
    return;
  }
  if (d.evoZaman !== undefined && evoGecerli() && EVO.oyun === "zaman" && !EVO.cevap) {
    const j = Number(d.evoZaman);
    if (EVO.secilen.indexOf(j) === -1) { EVO.secilen.push(j); }
    const tur = EVO.turlar[EVO.i];
    if (EVO.secilen.length === tur.length) {
      const dogru = EVO.secilen.every(function (x, k) { return k === 0 || tur[EVO.secilen[k - 1]].i < tur[x].i; });
      EVO.cevap = dogru ? "d" : "y";
      if (dogru) { EVO.dogru++; }
    }
    evrenSayfaCiz();
    return;
  }
  if (d.evoYer && evoGecerli() && EVO.oyun === "harita" && !EVO.cevap) {
    const hedef = EVO.hedefler[EVO.i];
    const dogru = d.evoYer === hedef;
    EVO.cevap = dogru ? "d" : "y";
    if (dogru) { EVO.dogru++; }
    evrenSayfaCiz();
    return;
  }

  if (d.evrSec) { evrBekleyeniYaz(); evrDurum().secili = d.evrSec; evrSilOnay = null; evrenSayfaCiz(); if (EVS.kaynak !== "benim" || EVR.onizle) { const s = document.querySelector("#evrenSayfa .evr-bolum-baslik"); if (s) { s.scrollIntoView({ block: "start" }); } } return; }
  if (d.evrOnizle !== undefined) { evrBekleyeniYaz(); evrDurum().onizle = d.evrOnizle === "1"; evrenSayfaCiz(); return; }
  if (h.hasAttribute("data-evr-ekle")) {
    evrBekleyeniYaz();
    const id = "b" + Date.now().toString(36);
    evrDegistir(function (r) { r.bolumler.push({ id: id, baslik: "", metin: "" }); });
    evrDurum().secili = id;
    evrenSayfaCiz();
    const t = document.querySelector("#evrBolumMetin");
    if (t) { t.focus(); }
    return;
  }
  if (d.evrSil) {
    if (evrSilOnay !== d.evrSil) { evrSilOnay = d.evrSil; evrenSayfaCiz(); return; }
    evrSilOnay = null;
    evrBekleyen = null;
    evrDegistir(function (r) { r.bolumler = r.bolumler.filter(function (x) { return x.id !== d.evrSil; }); });
    evrDurum().secili = null;
    evrenSayfaCiz();
    return;
  }
  if (d.evrTasi) {
    evrBekleyeniYaz();
    const s = evrDurum().secili;
    evrDegistir(function (r) {
      const i = r.bolumler.findIndex(function (x) { return x.id === s; });
      const j = i + Number(d.evrTasi);
      if (i === -1 || j < 0 || j >= r.bolumler.length) { return; }
      const x = r.bolumler[i]; r.bolumler[i] = r.bolumler[j]; r.bolumler[j] = x;
    });
    evrenSayfaCiz();
    return;
  }

  if (d.evcBuyut) { evcBuyut(d.evcBuyut); return; }
  if (d.evcSil) {
    if (evcSilOnay !== d.evcSil) { evcSilOnay = d.evcSil; evrenSayfaCiz(); return; }
    evcSilOnay = null;
    evrenBenimDegistir(EVS.id, function (x) { x.cizimler = (x.cizimler || []).filter(function (c) { return c.id !== d.evcSil; }); if (!x.cizimler.length) { delete x.cizimler; } });
    cizimSil(d.evcSil);
    evrenSayfaCiz();
  }
});

document.addEventListener("input", function (ev) {
  const t = ev.target;
  if (!t || !t.closest || !t.closest("#evrenSayfa") || !EVS || EVS.kaynak !== "benim") { return; }
  if (t.dataset.evrAlan || t.dataset.evrBolumAlan) {
    const yeni = { id: EVS.id, alan: t.dataset.evrAlan || t.dataset.evrBolumAlan, bolum: t.dataset.evrBolumAlan ? evrDurum().secili : null, deger: t.value };
    if (evrBekleyen && (evrBekleyen.alan !== yeni.alan || evrBekleyen.bolum !== yeni.bolum)) { evrBekleyeniYaz(); }
    evrBekleyen = yeni;
    if (evrKayitZaman) { clearTimeout(evrKayitZaman); }
    evrKayitZaman = setTimeout(evrBekleyeniYaz, 500);
    if (t.id === "evrBolumMetin") { const s = document.querySelector("#evrSayac"); if (s) { s.textContent = fanKelime(t.value); } }
  }
});

document.addEventListener("change", function (ev) {
  const t = ev.target;
  if (!t || !t.closest || !t.closest("#evrenSayfa") || !EVS) { return; }
  if (t.dataset.evoAyar) {
    evoAyarYaz(t);
    /* onay kutusu anında görünsün; yazı alanları odak kaybolmasın diye yeniden çizilmez */
    if (t.type === "checkbox") { evrenSayfaCiz(); }
    return;
  }
  if (t.dataset.evrAlan || t.dataset.evrBolumAlan) { evrBekleyeniYaz(); return; }
  if (t.hasAttribute("data-evc-yukle")) { evcYukle(t.files); return; }
  if (t.dataset.evcAlan && EVS.kaynak === "benim") {
    const id = t.dataset.evcId, alan = t.dataset.evcAlan, deger = t.value;
    evrenBenimDegistir(EVS.id, function (x) {
      const c = (x.cizimler || []).find(function (y) { return y.id === id; });
      if (c) { c[alan] = deger.slice(0, alan === "baslik" ? 120 : 1000); }
    });
  }
});

/* Oyunlar sekmesindeki günün kelimesi: kutusu yeniden çizilince tahmin formu kendi kutusunu bulur */
document.addEventListener("submit", function (ev) {
  const f = ev.target.closest && ev.target.closest("#evrenSayfa [data-ko-form]");
  if (!f) { return; }
  const o = KO_OYUNLAR[f.dataset.koForm];
  if (o && (!o.alan || !o.alan.isConnected)) { o.alan = f.closest("[data-ko-kap]"); }
}, true);

