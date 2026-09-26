/* Kelime oyunu: Günün Kelimesi'nin kolay modu, seri ve dağılım, bitince kelimenin kartı, hikâye kartları
   ve hesapsız ilerleme hatırlatması.

   - Zor mod: sunucudaki Günün Kelimesi (30-yarislar.js). Hesapla oynanır, herkes aynı kelimeyi arar,
     liderliğe sayılır. İstatistiği sunucu tutar (gk_istatistik).
   - Kolay mod: yalnızca karakter ve yer adları. Hesapsız oynanır; cevap ve ilerleme bu cihazda.
   - Aynı motor (koCiz) evren oyunlarında da kullanılır (51-evren-oyunlari.js): her evren kendi kelimeleriyle. */

const KO_ANAHTAR = "tentiforapp_kelime_oyunlari";
const GK_MOD_ANAHTAR = "tentiforapp_gk_mod";
const HH_ANAHTAR = "tentiforapp_hesap_hatirlat";
const KO_HAK = 6;
const KO_OYUNLAR = {};    /* anahtar → açık oyunun tanımı (çizildikçe kaydolur) */
const KO_RENK = { d: "#1C5C96", v: "#E2B93B", y: "#C9D3DD" };

/* ==================== motor ==================== */

function koNormal(m) { return String(m == null ? "" : m).trim().toLocaleLowerCase("tr").replace(/\s+/g, ""); }
function koHarf(k) { return Array.from(String(k || "")); }
function koGecerli(k) { return /^\p{L}+$/u.test(k); }
function koGun() { return new Date().toISOString().slice(0, 10); }   /* UTC: sunucudaki günle aynı */
function koGunFarki(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

/** d = doğru yerde, v = kelimede var, y = yok. Tekrarlı harfler sunucudaki gibi sayılır. */
function koKarsilastir(tahmin, cevap) {
  const t = koHarf(tahmin), c = koHarf(cevap);
  const s = t.map(function () { return "y"; });
  const kalan = [];
  t.forEach(function (h, i) { if (h === c[i]) { s[i] = "d"; } else { kalan.push(c[i]); } });
  t.forEach(function (h, i) {
    if (s[i] === "d") { return; }
    const j = kalan.indexOf(h);
    if (j !== -1) { s[i] = "v"; kalan.splice(j, 1); }
  });
  return s;
}

/** 4–7 harfli, tekrarsız, yalnızca harften oluşan adlar. */
function koListe(adlar, yasak) {
  const l = [];
  (adlar || []).forEach(function (a) {
    if (/\s/.test(String(a == null ? "" : a).trim())) { return; }   /* "Ana Kıta" gibi iki kelimelik adlar birleşip anlamsızlaşmasın */
    const k = koNormal(a);
    const n = koHarf(k).length;
    if (n >= 4 && n <= 7 && koGecerli(k) && l.indexOf(k) === -1 && !(yasak && yasak.indexOf(k) !== -1)) { l.push(k); }
  });
  return l.sort();
}

function koGununKelimesi(anahtar, liste) {
  if (!liste.length) { return ""; }
  const k = yarisKaristir(liste, metinTohumu("ko|" + anahtar));
  const n = koGunFarki("2026-01-01", koGun());
  return k[((n % k.length) + k.length) % k.length];
}

function koOku() {
  const d = jsonOku(KO_ANAHTAR, {});
  return d && typeof d === "object" && !Array.isArray(d) ? d : {};
}

/** Bugünün kaydı ve genel istatistik: { gun, c (bugünün cevabı), t: [tahmin], cozuldu, i: {…} } */
function koKayit(anahtar) {
  const d = koOku();
  const k = d[anahtar] && typeof d[anahtar] === "object" ? d[anahtar] : {};
  if (k.gun !== koGun()) { k.gun = koGun(); k.t = []; k.cozuldu = false; k.c = ""; }
  if (!Array.isArray(k.t)) { k.t = []; }
  const i = k.i && typeof k.i === "object" ? k.i : {};
  k.i = { oynanan: Number(i.oynanan) || 0, cozulen: Number(i.cozulen) || 0, seri: Number(i.seri) || 0, enUzun: Number(i.enUzun) || 0,
    son: typeof i.son === "string" ? i.son : "",
    dagilim: Array.isArray(i.dagilim) && i.dagilim.length === KO_HAK ? i.dagilim.map(function (x) { return Number(x) || 0; }) : [0, 0, 0, 0, 0, 0] };
  return k;
}

function koKaydet(anahtar, k) {
  const d = koOku();
  d[anahtar] = k;
  jsonYaz(KO_ANAHTAR, d);
}

/** Seri bugün ya da dün bulunduysa sürer. */
function koSeri(i) { return i.son && koGunFarki(i.son, koGun()) <= 1 ? i.seri : 0; }

function koBitti(k) { return k.cozuldu || k.t.length >= KO_HAK; }

/** Bugünün cevabı: gün içinde liste değişse de ilk tahminde sabitlenen kelime kalır. */
function koCevap(o, k) { return k.c || koGununKelimesi(o.anahtar, o.kelimeler); }

function koTahmin(o, girdi) {
  const k = koKayit(o.anahtar);
  const cevap = koCevap(o, k);
  if (!cevap || koBitti(k)) { return ""; }
  const t = koNormal(girdi);
  if (koHarf(t).length !== koHarf(cevap).length || !koGecerli(t)) { return koHarf(cevap).length + " harfli bir kelime yaz (yalnızca harf)"; }
  k.c = cevap;
  k.t.push(t);
  let bitti = false;
  if (t === cevap) {
    k.cozuldu = true; bitti = true;
    k.i.cozulen++;
    k.i.dagilim[k.t.length - 1]++;
    k.i.seri = k.i.son && koGunFarki(k.i.son, k.gun) === 1 ? k.i.seri + 1 : 1;
    k.i.son = k.gun;
    k.i.enUzun = Math.max(k.i.enUzun, k.i.seri);
  } else if (k.t.length >= KO_HAK) {
    bitti = true;
    k.i.seri = 0;
  }
  if (bitti) { k.i.oynanan++; }
  koKaydet(o.anahtar, k);
  if (bitti && typeof o.bitince === "function") { o.bitince(k.cozuldu, k.t.length); }
  return "";
}

/* ==================== çizim ==================== */

function koIzgaraHtml(satirlar, uzunluk) {
  const l = [];
  for (let i = 0; i < KO_HAK; i++) {
    const t = satirlar[i];
    let hucre = "";
    for (let j = 0; j < uzunluk; j++) {
      const h = t ? koHarf(t.kelime)[j] : "";
      const s = t ? t.sonuc[j] : "";
      hucre += '<span class="gk-hucre ' + (s === "d" ? "dogru" : s === "v" ? "var" : s === "y" ? "yok" : "") + '">' + kacir((h || "").toLocaleUpperCase("tr")) + "</span>";
    }
    l.push('<div class="gk-satir">' + hucre + "</div>");
  }
  return '<div class="gk-izgara">' + l.join("") + "</div>";
}

/** Oynanan · bulunan · seri · en uzun seri + kaçıncı tahminde bulunduğu. */
function koIstatHtml(i) {
  const enCok = Math.max.apply(null, i.dagilim.concat([1]));
  const sayi = function (n, ad) { return '<div class="ko-sayi"><b>' + n + "</b><span>" + ad + "</span></div>"; };
  return '<div class="ko-istat">' +
    '<div class="ko-sayilar">' + sayi(i.oynanan, "oynanan") +
      sayi(i.oynanan ? Math.round(100 * i.cozulen / i.oynanan) + "%" : "–", "bulunan") +
      sayi(i.seri, "seri") + sayi(i.enUzun, "en uzun") + "</div>" +
    '<div class="ko-dagilim" aria-label="Kaçıncı tahminde buldun">' + i.dagilim.map(function (n, j) {
      return '<div class="ko-dag-satir"><span>' + (j + 1) + '</span><span class="ko-dag-cubuk"><i style="width:' +
        Math.max(6, Math.round(100 * n / enCok)) + '%"></i></span><b>' + n + "</b></div>";
    }).join("") + "</div></div>";
}

function koBilgiKutu(tur, baslik, metin, git, gitAd) {
  return '<div class="ko-bilgi"><span class="oyun-etiket">' + kacir(tur) + "</span>" +
    "<b>" + kacir(baslik) + "</b>" +
    (metin ? "<p>" + kacir(String(metin).slice(0, 400)) + "</p>" : "") +
    (git ? '<a class="dugme dugme-sade" href="' + kacir(git) + '">' + kacir(gitAd || "Aç") + "</a>" : "") + "</div>";
}

function koOyunHtml(o) {
  const k = koKayit(o.anahtar);
  const cevap = koCevap(o, k);
  if (!cevap) {
    return '<div class="gk"><span class="oyun-etiket">' + kacir(o.ad) + '</span><p class="oyun-not">' +
      kacir(o.bosNot || "Bu oyun için yeterli kelime yok.") + "</p></div>";
  }
  const n = koHarf(cevap).length;
  const satirlar = k.t.map(function (t) { return { kelime: t, sonuc: koKarsilastir(t, cevap) }; });
  const bitti = koBitti(k);
  const i = Object.assign({}, k.i, { seri: koSeri(k.i) });
  return '<div class="gk" data-ko="' + kacir(o.anahtar) + '">' +
    '<div class="gk-ust"><span class="oyun-etiket">' + kacir(o.ad) + '</span><span class="oyun-not">' + n + " harf · " +
      (KO_HAK - k.t.length) + " hak</span></div>" +
    koIzgaraHtml(satirlar, n) +
    (bitti
      ? '<p class="gk-son">' + (k.cozuldu ? "Buldun! " + k.t.length + "/" + KO_HAK : "Bugünkü kelime: <b>" + kacir(cevap.toLocaleUpperCase("tr")) + "</b>") + "</p>" +
        (typeof o.bilgi === "function" ? o.bilgi(cevap) : "") +
        koIstatHtml(i) +
        '<div class="oyun-sira ko-paylas"><button class="dugme dugme-sade" data-ko-paylas="' + kacir(o.anahtar) + '">Sonucu paylaş</button>' +
          '<button class="dugme" data-ko-hikaye="' + kacir(o.anahtar) + '">Hikâyende paylaş</button></div>' +
        '<p class="oyun-not">Yeni kelime yarın (' + kacir(yarinSaati()) + ").</p>"
      : '<form data-ko-form="' + kacir(o.anahtar) + '" class="yaris-form"><input class="kod-giris yaris-giris" data-ko-giris maxlength="' + n + '" ' +
          'autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Tahmin" placeholder="' + n + ' harfli bir kelime"><button class="dugme" type="submit">Dene</button></form>' +
        '<p class="oyun-not">Mavi: doğru yerde · sarı: kelimede var · gri: yok. ' + kacir(o.not || "") + "</p>" +
        (k.i.oynanan ? '<p class="oyun-not">Seri: <b>' + i.seri + "</b> · en uzun: " + i.enUzun + "</p>" : "")) +
    (o.uyari ? '<p class="pencere-durum kotu">' + kacir(o.uyari) + "</p>" : "") +
    "</div>";
}

/** Yeni kelimenin geleceği yerel saat (UTC gece yarısı). */
function yarinSaati() {
  const d = new Date(); d.setUTCHours(24, 0, 0, 0);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function koCiz(alan, o) {
  if (!alan || !o) { return; }
  KO_OYUNLAR[o.anahtar] = o;
  o.alan = alan;
  alan.innerHTML = koOyunHtml(o);
}

function koYenidenCiz(o, odak) {
  if (!o || !o.alan || !o.alan.isConnected) { return; }
  o.alan.innerHTML = koOyunHtml(o);
  const g = odak && o.alan.querySelector("[data-ko-giris]");
  if (g) { g.focus({ preventScroll: true }); }
}

function koPaylasMetni(ad, gun, satirlar, cozuldu, seri) {
  const kare = { d: "🟦", v: "🟨", y: "⬜" };
  return "TentiforApp · " + ad + " " + gun + " — " + (cozuldu ? satirlar.length : "X") + "/" + KO_HAK +
    (seri > 1 ? " · seri " + seri : "") + "\n" +
    satirlar.map(function (s) { return s.map(function (x) { return kare[x] || "⬜"; }).join(""); }).join("\n") + "\n" + location.origin + "/yarislar/";
}

function koMetinPaylas(metin) {
  const tamam = function () { eckaBildir("Sonuç panoya kopyalandı"); };
  if (navigator.share) { navigator.share({ text: metin }).catch(function () {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(metin).then(tamam, function () { prompt("Sonuç:", metin); }); }
  else { prompt("Sonuç:", metin); }
}

/* ==================== hikâye kartı (1080×1920) ==================== */

/** { ust, baslik, gun, satirlar: [[d|v|y…]], cozuldu, seri, adres } */
async function kelimeHikayeKartUret(b) {
  if (typeof kartFontlariHazir !== "function") { return null; }
  await kartFontlariHazir();
  const EN = 1080, BOY = 1920;
  const t = document.createElement("canvas");
  t.width = EN; t.height = BOY;
  const c = t.getContext && t.getContext("2d");
  if (!c) { return null; }
  kartZemin(c, EN, BOY);
  const cerceve = typeof egKartCercevesi === "function" ? egKartCercevesi() : null;
  if (cerceve) { c.strokeStyle = cerceve.renk; c.lineWidth = 18; c.strokeRect(34, 34, EN - 68, BOY - 68); }
  const sol = 110, gen = EN - 220;
  c.fillStyle = KART_RENK.deniz;
  c.fillRect(sol, 170, 6, 64);
  kartEtiket(c, b.ust || "Günün kelimesi", sol + 26, 214, KART_RENK.murekkep2, 26);
  c.fillStyle = KART_RENK.murekkep;
  let px = 104;
  c.font = KART_FONT.baslik(px);
  while (c.measureText(b.baslik).width > gen && px > 56) { px -= 6; c.font = KART_FONT.baslik(px); }
  c.fillText(b.baslik, sol, 360);
  c.font = KART_FONT.yazi(40, true);
  c.fillStyle = KART_RENK.deniz;
  c.fillText(b.gun, sol, 430);

  const uz = Math.max(1, (b.satirlar[0] || []).length);
  const bosluk = 16;
  const hucre = Math.min(128, Math.floor((gen - bosluk * (uz - 1)) / uz));
  const genislik = hucre * uz + bosluk * (uz - 1);
  const x0 = (EN - genislik) / 2;
  let y = 520;
  b.satirlar.forEach(function (s) {
    s.forEach(function (d, j) {
      c.fillStyle = KO_RENK[d] || KO_RENK.y;
      c.fillRect(x0 + j * (hucre + bosluk), y, hucre, hucre);
    });
    y += hucre + bosluk;
  });

  y += 70;
  c.fillStyle = KART_RENK.yarik;
  c.font = KART_FONT.baslik(150);
  c.textAlign = "center";
  c.fillText((b.cozuldu ? b.satirlar.length : "X") + "/" + KO_HAK, EN / 2, y + 110);
  if (b.seri > 1) {
    c.font = KART_FONT.yazi(44, true);
    c.fillStyle = KART_RENK.murekkep2;
    c.fillText(b.seri + " gündür üst üste", EN / 2, y + 190);
  }
  c.textAlign = "left";
  kartEtiket(c, "Sen de bul · " + (b.adres || KART_ADRES + "/yarislar/"), sol, BOY - 130, KART_RENK.yarik, 24);
  return t;
}

async function koHikayePaylas(dugme, b, dosya) {
  const t = await kelimeHikayeKartUret(b);
  if (!t) { return; }
  const s = await kartPaylas(t, dosya, b.baslik + ": " + (b.cozuldu ? b.satirlar.length : "X") + "/" + KO_HAK);
  if (dugme && s) { dugme.textContent = s; }
  if (typeof olaySay === "function") { olaySay("hikaye_kelime"); }
}

/* ==================== Tömye: kolay mod ve kelimenin kartı ==================== */

function gkModu() {
  const m = jsonOku(GK_MOD_ANAHTAR, "");
  if (m === "kolay" || m === "zor") { return m; }
  return typeof hesapKullanici !== "undefined" && hesapKullanici ? "zor" : "kolay";
}

function gkKolayKelimeleri() {
  const adlar = [];
  (veri.karakterler || []).forEach(function (k) { if (k.ad && k.unvan && k.kart !== false && !k.gizli) { adlar.push(k.ad); } });
  (veri.haritalar || []).forEach(function (h) {
    if (h.id === "claude") { return; }   /* kanon değil */
    (h.yerler || []).forEach(function (y) { if (!y.gizli) { adlar.push(y.ad); } });
  });
  return koListe(adlar, typeof GK_GENEL_KELIMELER !== "undefined" ? GK_GENEL_KELIMELER : []);
}

function gkKolayOyunu() {
  return {
    anahtar: "tomye-kolay", ad: "Günün kelimesi · kolay", paylasAd: "Günün Kelimesi (kolay)",
    not: "Bir karakterin ya da bir yerin adı. Hesapsız oynanır.",
    kelimeler: gkKolayKelimeleri(),
    bilgi: gkKelimeBilgi,
    bitince: function (cozuldu) {
      if (!cozuldu) { return; }
      const a = "ko_tomye_" + koGun();
      if (typeof kilitAcik === "function" && !kilitAcik(a)) { cuzdan.acilan.push(a); eckaKazan(5, "Günün kelimesi (kolay)"); }
      hesapHatirlat("kelime");
    }
  };
}

/** Bitince kelimenin kartı: nereden geldiği ve (açıksa) kaydına bağlantı. */
function gkKelimeBilgi(k) {
  const esit = function (a) { return koNormal(a) === k; };
  const kilitli = function (tur, ad, ne) {
    return koBilgiKutu(tur, ad, ne + " Kaydı başlangıç koduyla açılır.", "#/basla", "Kodu al");
  };
  const kar = (veri.karakterler || []).find(function (x) { return esit(x.ad); });
  if (kar) {
    if (kar.gizli || !bolumErisimi("arsiv")) { return kilitli("Karakter", kar.ad, "Tömye arşivinde bir karakter."); }
    return koBilgiKutu("Karakter", kar.ad, [kar.unvan, kar.ozet].filter(Boolean).join(" · "), "#/karakter/" + kar.id, "Kaydı aç");
  }
  let yer = null;
  (veri.haritalar || []).some(function (h) {
    if (h.id === "claude") { return false; }
    yer = (h.yerler || []).find(function (y) { return !y.gizli && esit(y.ad); }) || null;
    return !!yer;
  });
  if (yer) {
    if (!bolumErisimi("harita")) { return kilitli("Yer", yer.ad, "Tömye haritasında bir " + (yer.tur ? yer.tur.toLocaleLowerCase("tr") : "yer") + "."); }
    return koBilgiKutu("Yer" + (yer.tur ? " · " + yer.tur : ""), yer.ad, yer.not, "#/harita", "Haritada gör");
  }
  const s = (veri.sozluk || []).find(function (x) { return esit(x.terim); });
  if (s) {
    if (!bolumErisimi("sozluk")) { return kilitli("Sözlük", s.terim, "Tentiforverse sözlüğünde bir terim."); }
    return koBilgiKutu("Sözlük", s.terim, s.tanim, "#/sozluk", "Sözlükte aç");
  }
  const is = (veri.isimSozluk || []).find(function (x) { return esit(x.isim); });
  if (is) { return koBilgiKutu("İsim sözlüğü", is.isim, is.anlam ? "Tentifor dilinde “" + is.anlam + "” demek." : "", "#/isim", "İsim sistemi"); }
  const ay = (((veri.takvim || {}).aylar) || []).find(function (x) { return esit(x.ad); });
  if (ay) { return koBilgiKutu("Takvim", ay.ad, "Tömye takviminde bir ay" + (ay.gun ? " (" + ay.gun + " gün)" : "") + ".", "", ""); }
  return "";
}

/* Günün Kelimesi bölümü: üstte mod seçimi, altında seçilen mod */
if (typeof gunKelimesiYukle === "function") {
  const eskiGkYukle = gunKelimesiYukle;
  window.gunKelimesiYukle = function () {
    const dis = document.querySelector("#gkAlan");
    if (!dis) { return; }
    const mod = gkModu();
    const dugme = function (m, ad) {
      return '<button class="dugme' + (mod === m ? "" : " dugme-sade") + '" role="tab" aria-selected="' + (mod === m) + '" data-gk-mod="' + m + '">' + ad + "</button>";
    };
    dis.innerHTML = '<div class="gk-modlar" role="tablist" aria-label="Günün kelimesi modu">' +
      dugme("kolay", "Kolay · karakter ve yer adları") + dugme("zor", "Zor · herkesle aynı kelime") + "</div>" +
      '<div id="gkIc"><div class="gk"><span class="oyun-etiket">Günün kelimesi</span><p class="oyun-not">Yükleniyor…</p></div></div>';
    if (mod === "kolay") { koCiz(document.querySelector("#gkIc"), gkKolayOyunu()); return; }
    return eskiGkYukle.apply(this, arguments);
  };
}

/* Zor mod bitince: kelimenin kartı, sunucudaki istatistik ve hikâye kartı */
if (typeof gunKelimesiCiz === "function") {
  const eskiGkCiz = gunKelimesiCiz;
  window.gunKelimesiCiz = function () {
    const r = eskiGkCiz.apply(this, arguments);
    const d = typeof gkDurum !== "undefined" ? gkDurum : null;
    const kutu = document.querySelector("#gkIc .gk") || document.querySelector("#gkAlan .gk");
    if (!d || !d.bitti || !kutu || kutu.querySelector(".ko-bilgi, [data-gk-istat]")) { return r; }
    const ek = document.createElement("div");
    ek.innerHTML = (d.cevap ? gkKelimeBilgi(koNormal(d.cevap)) : "") + '<div data-gk-istat></div>' +
      '<div class="oyun-sira ko-paylas"><button class="dugme" data-gk-hikaye>Hikâyende paylaş</button></div>';
    const paylas = kutu.querySelector("[data-gk-paylas]");
    while (ek.firstChild) { kutu.insertBefore(ek.firstChild, paylas ? paylas.nextSibling : null); }
    gkIstatistikYukle();
    return r;
  };
}

async function gkIstatistikYukle() {
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) { return; }
  const { data, error } = await hesapIstemci.rpc("gk_istatistik");
  const alan = document.querySelector("[data-gk-istat]");
  if (error || !data || !alan) { return; }   /* kurulum.sql yenilenmemişse sessizce yok */
  const dag = Array.isArray(data.dagilim) ? data.dagilim.map(Number) : [0, 0, 0, 0, 0, 0];
  alan.innerHTML = koIstatHtml({ oynanan: Number(data.oynanan) || 0, cozulen: Number(data.cozulen) || 0,
    seri: Number(data.seri) || 0, enUzun: Number(data.en_uzun) || 0, dagilim: dag });
  gkSonSeri = Number(data.seri) || 0;
}

let gkSonSeri = 0;

/* ==================== arşiv kartı: hikâye ==================== */

async function arsivKartHikayeUret(id) {
  const i = (veri.karakterler || []).findIndex(function (k) { return k.id === id; });
  const k = veri.karakterler[i];
  const kayit = koleksiyonOku()[id];
  if (!k || !kayit || typeof kartFontlariHazir !== "function") { return null; }
  await kartFontlariHazir();
  const EN = 1080, BOY = 1920;
  const t = document.createElement("canvas");
  t.width = EN; t.height = BOY;
  const c = t.getContext && t.getContext("2d");
  if (!c) { return null; }
  kartZemin(c, EN, BOY);
  const parlak = kartParlak(kayit);
  const acik = bolumErisimi("arsiv");
  const sol = 150, gen = EN - 300;
  /* kart: ortada, çerçeveli */
  c.fillStyle = "rgba(255,255,255,.72)";
  c.fillRect(110, 260, EN - 220, 1080);
  c.strokeStyle = parlak ? "#E2B93B" : KART_RENK.deniz;
  c.lineWidth = parlak ? 14 : 6;
  c.strokeRect(110, 260, EN - 220, 1080);
  kartEtiket(c, "Arşiv kartı" + (parlak ? " · parlak" : ""), 110, 200, KART_RENK.murekkep2, 26);
  c.fillStyle = KART_RENK.deniz;
  c.font = KART_FONT.mono(44, true);
  c.fillText(tomyeSayi(i + 1), sol, 360);
  c.fillStyle = KART_RENK.murekkep;
  let px = 130;
  c.font = KART_FONT.baslik(px);
  while (c.measureText(k.ad).width > gen && px > 60) { px -= 6; c.font = KART_FONT.baslik(px); }
  c.fillText(k.ad, sol, 560);
  if (acik) {
    c.font = KART_FONT.yazi(48, true);
    c.fillStyle = KART_RENK.deniz;
    kartSar(c, k.unvan || "", gen).slice(0, 2).forEach(function (s, j) { c.fillText(s, sol, 650 + j * 60); });
    c.font = KART_FONT.yazi(38);
    c.fillStyle = KART_RENK.murekkep2;
    kartSar(c, String(k.ozet || "").replace(/\s+/g, " ").slice(0, 260), gen).slice(0, 6).forEach(function (s, j) { c.fillText(s, sol, 800 + j * 54); });
  }
  if (k.grup && acik) { kartEtiket(c, "Set · " + k.grup, sol, 1290, KART_RENK.yarik, 24); }
  const t2 = Object.keys(koleksiyonOku()).length;
  const toplam = (veri.karakterler || []).filter(function (x) { return x.kart !== false; }).length;
  c.font = KART_FONT.yazi(44, true);
  c.fillStyle = KART_RENK.murekkep2;
  c.textAlign = "center";
  c.fillText("Koleksiyonumda " + t2 + " / " + toplam + " kart", EN / 2, 1480);
  c.textAlign = "left";
  kartEtiket(c, "TentiforApp · " + KART_ADRES + "/koleksiyon/", sol - 40, BOY - 130, KART_RENK.yarik, 24);
  return t;
}

if (typeof koleksiyonCiz === "function") {
  const eskiKolCiz = koleksiyonCiz;
  window.koleksiyonCiz = function () {
    const r = eskiKolCiz.apply(this, arguments);
    const alan = document.querySelector("#koleksiyonAlan");
    const t = koleksiyonOku();
    const sahip = (veri.karakterler || []).filter(function (k) { return t[k.id] && k.kart !== false; });
    if (alan && sahip.length) {
      const d = document.createElement("div");
      d.className = "kutu-y kol-hikaye";
      d.innerHTML = '<label for="kolHikayeSec">Bir kartını hikâyende paylaş</label>' +
        '<div class="oyun-sira"><select id="kolHikayeSec" class="kod-giris">' + sahip.map(function (k) {
          return '<option value="' + kacir(k.id) + '">' + kacir(k.ad) + (kartParlak(t[k.id]) ? " ✦" : "") + "</option>";
        }).join("") + '</select><button class="dugme" data-kol-hikaye>Hikâye kartı</button></div>';
      alan.insertBefore(d, alan.children[1] || null);
    }
    return r;
  };
}

/* ==================== hesapsız ilerleme hatırlatması ==================== */

const HH_METIN = {
  madalya: "İlk madalyanı kazandın.",
  kart: "İlk arşiv kartın senin.",
  evren: "İlk evren paranı kazandın.",
  kelime: "Günün kelimesini buldun."
};

/** Hesabı olmayan birine, bir şey kazandığında hesap açmayı önerir. Üç günde bir, en fazla üç kez. */
function hesapHatirlat(neden) {
  try {
    if (typeof hesapEtkin !== "function" || !hesapEtkin()) { return; }
    if (typeof hesapKullanici !== "undefined" && hesapKullanici) { return; }
    const d = jsonOku(HH_ANAHTAR, {}) || {};
    if (d.kapat || (d.n || 0) >= 3 || (d.t && Date.now() - d.t < 3 * 86400000)) { return; }
    if (document.querySelector("#hesapHatirlat")) { return; }
    d.n = (d.n || 0) + 1; d.t = Date.now();
    jsonYaz(HH_ANAHTAR, d);
    setTimeout(function () {
      if (document.querySelector("#hesapHatirlat") || document.querySelector("#karsilama")) { return; }
      const k = document.createElement("div");
      k.id = "hesapHatirlat";
      k.className = "hesap-hatirlat";
      k.setAttribute("role", "status");
      k.innerHTML = "<p><b>" + kacir(HH_METIN[neden] || "Bir şey kazandın.") + "</b> Şu an yalnızca bu cihazda duruyor. " +
        "Hesap açarsan eçkan, kartların ve madalyaların telefon değişse de kaybolmaz.</p>" +
        '<div class="oyun-sira"><button class="dugme" data-hh-ac>Hesap aç</button>' +
        '<button class="dugme dugme-sade" data-hh-sonra>Sonra</button>' +
        '<button class="dugme dugme-sade" data-hh-kapat>Bir daha gösterme</button></div>';
      document.body.appendChild(k);
      /* kendiliğinden çekilir: altındaki düğmeleri uzun süre kapatmasın */
      setTimeout(function () { if (k.isConnected && !k.contains(document.activeElement)) { k.remove(); } }, 15000);
      if (typeof olaySay === "function") { olaySay("hesap_hatirlat"); }
    }, 2600);
  } catch (_) { /* hatırlatma hiçbir şeyi bozmasın */ }
}

document.addEventListener("DOMContentLoaded", function () {
  if (typeof madalyaVer === "function") {
    const eskiMadalya = madalyaVer;
    window.madalyaVer = function (id) {
      const yeni = typeof madalyaVar === "function" && !madalyaVar(id);
      const r = eskiMadalya.apply(this, arguments);
      if (yeni) { hesapHatirlat("madalya"); }
      return r;
    };
  }
  if (typeof kartKazan === "function") {
    const eskiKart = kartKazan;
    window.kartKazan = function (id) {
      const once = typeof kartSahip === "function" && kartSahip(id);
      const r = eskiKart.apply(this, arguments);
      if (!once && typeof kartSahip === "function" && kartSahip(id)) { hesapHatirlat("kart"); }
      return r;
    };
  }
  if (typeof evrenZiyaretOdulu === "function") {
    const eskiZiyaret = evrenZiyaretOdulu;
    window.evrenZiyaretOdulu = function () {
      const n = eskiZiyaret.apply(this, arguments);
      if (n) { hesapHatirlat("evren"); }
      return n;
    };
  }
});

/* ==================== olaylar ==================== */

document.addEventListener("click", async function (ev) {
  const h = ev.target.closest("[data-gk-mod], [data-ko-paylas], [data-ko-hikaye], [data-gk-hikaye], [data-kol-hikaye], [data-hh-ac], [data-hh-sonra], [data-hh-kapat]");
  if (!h) { return; }
  const d = h.dataset;
  if (d.gkMod) {
    jsonYaz(GK_MOD_ANAHTAR, d.gkMod);
    window.gunKelimesiYukle();
    return;
  }
  if (d.koPaylas || d.koHikaye) {
    const o = KO_OYUNLAR[d.koPaylas || d.koHikaye];
    if (!o) { return; }
    const k = koKayit(o.anahtar);
    const cevap = koCevap(o, k);
    const satirlar = k.t.map(function (t) { return koKarsilastir(t, cevap); });
    if (d.koPaylas) { koMetinPaylas(koPaylasMetni(o.paylasAd || o.ad, k.gun, satirlar, k.cozuldu, koSeri(k.i))); return; }
    h.disabled = true;
    await koHikayePaylas(h, { ust: o.hikayeUst || "Günün kelimesi · kolay", baslik: o.hikayeBaslik || "Tentiforverse", gun: k.gun,
      satirlar: satirlar, cozuldu: k.cozuldu, seri: koSeri(k.i), adres: o.hikayeAdres }, "tentifor-kelime-" + k.gun + ".png");
    h.disabled = false;
    return;
  }
  if (h.hasAttribute("data-gk-hikaye")) {
    const g = typeof gkDurum !== "undefined" ? gkDurum : null;
    if (!g) { return; }
    h.disabled = true;
    await koHikayePaylas(h, { ust: "Günün kelimesi · zor", baslik: "Tentiforverse", gun: String(g.gun || koGun()).slice(0, 10),
      satirlar: (g.tahminler || []).map(function (t) { return t.sonuc; }), cozuldu: !!g.cozuldu, seri: g.cozuldu ? gkSonSeri : 0 },
      "tentifor-kelime-" + String(g.gun || koGun()).slice(0, 10) + ".png");
    h.disabled = false;
    return;
  }
  if (h.hasAttribute("data-kol-hikaye")) {
    const s = document.querySelector("#kolHikayeSec");
    if (!s) { return; }
    h.disabled = true;
    const t = await arsivKartHikayeUret(s.value);
    if (t) {
      const k = (veri.karakterler || []).find(function (x) { return x.id === s.value; });
      const sonuc = await kartPaylas(t, "tentifor-kart-" + s.value + ".png", "Arşiv kartım: " + (k ? k.ad : ""));
      if (sonuc) { h.textContent = sonuc; }
      if (typeof olaySay === "function") { olaySay("hikaye_kart"); }
    }
    h.disabled = false;
    return;
  }
  const kutu = document.querySelector("#hesapHatirlat");
  if (kutu) { kutu.remove(); }
  if (h.hasAttribute("data-hh-kapat")) { const x = jsonOku(HH_ANAHTAR, {}) || {}; x.kapat = true; jsonYaz(HH_ANAHTAR, x); return; }
  if (h.hasAttribute("data-hh-ac")) {
    if (typeof olaySay === "function") { olaySay("hesap_hatirlat_ac"); }
    if (typeof hesapPencere === "function") { hesapPencere("kayit"); }
  }
});

document.addEventListener("submit", function (ev) {
  const f = ev.target.closest("[data-ko-form]");
  if (!f) { return; }
  ev.preventDefault();
  const o = KO_OYUNLAR[f.dataset.koForm];
  const g = f.querySelector("[data-ko-giris]");
  if (!o || !g || !g.value.trim()) { return; }
  o.uyari = koTahmin(o, g.value);
  koYenidenCiz(o, true);
});
