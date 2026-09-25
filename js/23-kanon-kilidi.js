/* ==================== KANON KİLİDİ ====================
   Kolay kilit: kanon içerik (karakterler, evren, harita, zaman, okuma bölümleri...) kodsuz
   görünmez. Bu, arayüz düzeyinde bir kilittir — veri sayfada gömülü durduğu için kararlı
   biri kaynağı okuyabilir. Gerçekten gizli metin için katman şifresi (buz) kullanılır.
   Oyunlar ve araçlar her zaman açıktır.

   Erişim üç yerden gelir:
   1. Yönetici kodu ("Kod" düğmesine yazılır): her şey açılır, buz katmanları da.
   2. Kişiye özel kod: kişinin profilindeki `erisim` (bölümler + evrenler) kadarı açılır.
   3. Kodsuz ziyaretçi: yalnızca oyunlar ve araçlar. */

const KANON_GRUPLARI = [
  { ad: "Arşiv", bolumler: ["arsiv", "evren", "aile", "ag", "zaman", "harita", "yankilar", "karsi", "sozluk", "bilinmeyenler", "yapimlar"] },
  { ad: "Okuma", bolumler: ["roman", "mektuplar", "alintilar", "hikaye", "kisaHikayeler", "olaylar", "kayip", "notlar", "sohbet"] }
];
const KANON_BOLUMLERI = KANON_GRUPLARI.reduce(function (a, g) { return a.concat(g.bolumler); }, []);
const KANON_PAKETLER = [
  { ad: "Okuyucu", bolumler: KANON_GRUPLARI[1].bolumler },
  { ad: "Arşiv gezgini", bolumler: KANON_GRUPLARI[0].bolumler },
  { ad: "Her şey", bolumler: KANON_BOLUMLERI },
  { ad: "Hiçbiri", bolumler: [] }
];

const KANON_PROFIL_ANAHTAR = "tentiforapp_kanon_profiller";
const USTA_ACILAN = "tentiforapp_usta_acilan";
const KANON_KILIT_SVG = '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7h-1A1.5 1.5 0 0 0 2 8.5v5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 12.5 7h-1V4.5A3.5 3.5 0 0 0 8 1zM6 4.5a2 2 0 1 1 4 0V7H6V4.5z"/></svg>';

let kanonOnbellek = null;
let kanonOnbellekYonetici = false;

function kanonSifirla() { kanonOnbellek = null; }

function kanonProfilIdleri() {
  try {
    const a = JSON.parse(kayitOku(KANON_PROFIL_ANAHTAR) || "[]");
    return Array.isArray(a) ? a : [];
  } catch (e) { return []; }
}

function kanonProfilEkle(id) {
  const l = kanonProfilIdleri();
  if (l.indexOf(id) === -1) { l.push(id); kayitYaz(KANON_PROFIL_ANAHTAR, JSON.stringify(l)); }
  kanonSifirla();
}

/** { hepsi, tumEvren, bolumler:Set, evrenler:Set } — bu cihazdaki erişim. */
function kanonErisim() {
  const yon = (typeof yoneticiAcik === "function") && yoneticiAcik();
  if (kanonOnbellek && kanonOnbellekYonetici === yon) { return kanonOnbellek; }

  const e = { hepsi: false, tumEvren: false, bolumler: new Set(), evrenler: new Set() };
  if (yon) { e.hepsi = true; e.tumEvren = true; }
  else if (typeof veri !== "undefined" && veri) {
    const idler = kanonProfilIdleri();
    (veri.profiller || []).forEach(function (p) {
      if (idler.indexOf(p.id) === -1) { return; }
      if (!p.erisim) { e.hepsi = true; e.tumEvren = true; return; }   /* erişim tanımsız eski kişi: kısıtsız */
      (p.erisim.bolumler || []).forEach(function (b) { e.bolumler.add(b); });
      if (Array.isArray(p.erisim.evrenler)) { p.erisim.evrenler.forEach(function (x) { e.evrenler.add(x); }); }
      else { e.tumEvren = true; }
    });
  }
  kanonOnbellek = e;
  kanonOnbellekYonetici = yon;
  return e;
}

/** Kanon olmayan bölümler (oyun, araç) hep açıktır. */
function bolumErisimi(id) {
  if (KANON_BOLUMLERI.indexOf(id) === -1) { return true; }
  const e = kanonErisim();
  return e.hepsi || e.bolumler.has(id);
}

function kanonEvrenErisimi(id) {
  const e = kanonErisim();
  return e.hepsi || e.tumEvren || e.evrenler.has(id);
}

/** "#/karakter/x", "#zaman", "#/evren/y" gibi bir adresin bölümüne erişim var mı? */
function kanonGitErisimi(git) {
  const h = String(git || "").replace(/^#\/?/, "").split("/")[0];
  if (h === "karakter") { return bolumErisimi("arsiv"); }
  return bolumErisimi(h);
}

function kanonBolumAdi(id) {
  let ad = id;
  if (typeof GEZINME !== "undefined") {
    GEZINME.forEach(function (g) { g.bolumler.forEach(function (b) { if (b[0] === id) { ad = b[1]; } }); });
  }
  return ad;
}

/** Menülerde kilitli bölümün yanına küçük kilit koyar. */
function kanonKilitIsareti(id) {
  return bolumErisimi(id) ? "" : ' <span class="gez-kilit" title="Kilitli">' + KANON_KILIT_SVG + "</span>";
}

/** Herkese açık başlangıç profili (veri.baslangicKodu). */
function baslangicProfili() {
  if (!veri.baslangicKodu) { return null; }
  return (veri.profiller || []).find(function (p) { return p.id === veri.baslangicProfil; }) || null;
}

/** Başlangıç kodu bu kilitli bölümü (bölümId yoksa: sayfadaki en az birini) açar mı? */
function baslangicKapsar(bolumId) {
  const p = baslangicProfili();
  if (!p || !p.erisim) { return false; }
  const b = p.erisim.bolumler || [];
  return bolumId ? b.indexOf(bolumId) !== -1 : b.some(function (x) { return !bolumErisimi(x); });
}

function baslangicUygula() {
  if (!veri.baslangicKodu) { return; }
  kodPenceresi();
  const g = document.querySelector("#kodGiris");
  if (g) { g.value = veri.baslangicKodu; }
  kodDene(veri.baslangicKodu);
}

function kanonKartHtml(baslik, bolumId) {
  const uye = kanonProfilIdleri().length > 0;
  const basla = baslangicKapsar(bolumId);
  return '<div class="kanon-ic">' +
    '<span class="kanon-ikon">' + KANON_KILIT_SVG.replace('width="11" height="11"', 'width="26" height="26"') + "</span>" +
    '<h3 class="kanon-baslik">' + kacir(baslik) + "</h3>" +
    '<p class="kanon-metin">' + (uye ? "Bu bölüm senin kodunda yok." : "Bu bölüm kod ister. Sana bir kod verildiyse buradan gir.") + "</p>" +
    (basla ? '<p class="kanon-ipucu">Yeni misin? Başlangıç kodu: <b>' + kacir(veri.baslangicKodu) + "</b></p>" : "") +
    '<div class="kanon-dugmeler">' +
      '<button type="button" class="dugme" data-kod-ac="1">Kod gir</button>' +
      (basla ? '<button type="button" class="dugme dugme-sade" data-baslangic-uygula="1">Başlangıç kodunu kullan</button>' : "") +
    "</div>" +
  "</div>";
}

/** Kilitli kanon bölümlerini gizler, yerine kod isteyen bir kart koyar. */
function kanonKilitUygula() {
  if (typeof veri === "undefined" || !veri) { return; }

  document.querySelectorAll(".kanon-yer, #kanonSayfaKilit").forEach(function (n) { n.remove(); });

  const hepsi = Array.prototype.slice.call(document.querySelectorAll("section.bolum"));
  const kilitli = function (b) { return KANON_BOLUMLERI.indexOf(b.id) !== -1 && !bolumErisimi(b.id); };

  hepsi.forEach(function (b) {
    b.classList.remove("kanon-kilitli", "kanon-toplu");
    if (kilitli(b)) { b.classList.add("kanon-kilitli"); }
  });

  const ortak = (typeof HER_SAYFADA !== "undefined") ? HER_SAYFADA : [];
  const gorunen = hepsi.filter(function (b) { return !b.hidden && b.id !== "yokSayfa" && ortak.indexOf(b.id) === -1; });
  const kilitliler = gorunen.filter(kilitli);
  if (!kilitliler.length) { return; }

  /* sayfadaki her bölüm kilitliyse tek bir büyük kart yeter */
  if (kilitliler.length > 1 && kilitliler.length === gorunen.length) {
    kilitliler.forEach(function (b) { b.classList.add("kanon-toplu"); });
    const kart = document.createElement("section");
    kart.id = "kanonSayfaKilit";
    kart.className = "kanon-sayfa";
    const sf = (typeof SAYFA_BASLIK !== "undefined" && typeof aktifSayfa !== "undefined") ? SAYFA_BASLIK[aktifSayfa] : "";
    kart.innerHTML = kanonKartHtml((sf ? sf + " sayfası" : "Bu sayfa") + " kilitli");
    kilitliler[0].parentNode.insertBefore(kart, kilitliler[0]);
    return;
  }

  kilitliler.forEach(function (b) {
    const y = document.createElement("div");
    y.className = "kanon-yer";
    y.innerHTML = kanonKartHtml(kanonBolumAdi(b.id) + " kilitli", b.id);
    b.appendChild(y);
  });
}

/* ---------- yönetici: tek kodla her şey ---------- */

/** Yönetici koduna sarılı katman anahtarlarını açar ve bu cihazda çözülmüş sayar. */
function ustaAnahtarlariYukle() {
  if (typeof yoneticiAcik !== "function" || !yoneticiAcik() || !veri) { return 0; }

  const sarili = veri.katmanAnahtarlari || {};
  let izle = [];
  try { izle = JSON.parse(kayitOku(USTA_ACILAN) || "[]"); } catch (e) { izle = []; }
  if (!Array.isArray(izle)) { izle = []; }

  let yeni = 0;
  Object.keys(sarili).forEach(function (id) {
    const k = katmanBulHepsi(id);
    if (!k) { return; }
    let kod;
    try { kod = sifreCoz(sarili[id], yoneticiKod); } catch (e) { return; }
    if (dogrulamaOzeti(kod) !== k.dogrulama) { return; }
    katmanKodlari[id] = kod;
    if (!cozulenler[k.dogrulama]) {
      cozulenler[k.dogrulama] = kod;
      yeni++;
      if (izle.indexOf(k.dogrulama) === -1) { izle.push(k.dogrulama); }
    }
  });

  ustaAnahtarSarmala();
  kayitYaz(KATMAN_ANAHTAR, JSON.stringify(katmanKodlari));
  kayitYaz(USTA_ACILAN, JSON.stringify(izle));
  if (yeni) { acilanlariKaydet(); }
  return yeni;
}

/** Elle girilmiş katman kodlarından henüz sarılmamış olanları yönetici koduna sarar. */
function ustaAnahtarSarmala() {
  if (typeof yoneticiAcik !== "function" || !yoneticiAcik() || !veri) { return 0; }
  if (!veri.katmanAnahtarlari) { veri.katmanAnahtarlari = {}; }
  let n = 0;
  Object.keys(katmanKodlari).forEach(function (id) {
    const k = katmanBulHepsi(id);
    if (!k || dogrulamaOzeti(katmanKodlari[id]) !== k.dogrulama) { return; }
    if (veri.katmanAnahtarlari[id]) { return; }
    veri.katmanAnahtarlari[id] = sifrele(katmanKodlari[id], yoneticiKod);
    n++;
  });
  return n;
}

/** Yönetici çıkışında, yönetici girişiyle açılan katmanları bu cihazda geri kapatır. */
function ustaTemizle() {
  let izle = [];
  try { izle = JSON.parse(kayitOku(USTA_ACILAN) || "[]"); } catch (e) { izle = []; }
  if (Array.isArray(izle)) { izle.forEach(function (d) { delete cozulenler[d]; }); }
  Object.keys((veri && veri.katmanAnahtarlari) || {}).forEach(function (id) { delete katmanKodlari[id]; });
  kayitYaz(KATMAN_ANAHTAR, JSON.stringify(katmanKodlari));
  kayitYaz(USTA_ACILAN, "[]");
  acilanlariKaydet();
}

/** "Kod" penceresine yazılan yönetici kodu. */
function ustaGiris(kod, durum) {
  if (!yoneticiGiris(kod)) { return false; }
  kanonSifirla();
  const yeni = ustaAnahtarlariYukle();
  durum.textContent = "Yönetici girişi · her şey açıldı" + (yeni ? " (" + yeni + " buz katmanı)" : "");
  durum.className = "pencere-durum iyi";
  setTimeout(function () {
    perdeKapat();
    if (typeof yoneticiCiz === "function") { yoneticiCiz(); }
    arsiviTazele();
    if (typeof haritaCiz === "function") { haritaCiz(); }
  }, 900);
  return true;
}

/* ==================== KİŞİLER (basit kod üretimi) ====================
   Ad yaz, ne göreceğini seç, kodu üret. Kodun kendisi veride yalnızca yönetici koduna sarılı
   (kodSifreli) durur; yönetici olarak istediğin zaman tekrar görebilirsin. */

let yoneticiKisiTaslak = null;        /* { duzenle, ad, selamlama, bolumler:{}, evrenler:{}, katmanMod, katmanlar:{}, ozel } */
let yoneticiKisiGoster = null;        /* kodu ekranda açık olan kişinin kimliği */

function yoneticiKodUret(onek) {
  const harfler = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = new Uint8Array(6);
  (window.crypto || window.msCrypto).getRandomValues(b);
  return onek + Array.from(b).map(function (n) { return harfler[n % harfler.length]; }).join("");
}

function kisiTaslakYeni() {
  const t = { duzenle: null, ad: "", selamlama: "", ozelKod: "", bolumler: {}, evrenler: {}, katmanMod: "hepsi", katmanlar: {}, ozel: false };
  KANON_PAKETLER[0].bolumler.forEach(function (b) { t.bolumler[b] = true; });
  (veri.haritalar || []).forEach(function (h) { t.evrenler[h.id] = true; });
  return t;
}

function kisiTaslakProfilden(p) {
  const t = kisiTaslakYeni();
  t.duzenle = p.id;
  t.ad = p.ad;
  t.selamlama = p.selamlama || "";
  t.bolumler = {};
  t.evrenler = {};
  const e = p.erisim || {};
  (Array.isArray(e.bolumler) ? e.bolumler : (p.erisim ? [] : KANON_BOLUMLERI)).forEach(function (b) { t.bolumler[b] = true; });
  (Array.isArray(e.evrenler) ? e.evrenler : (veri.haritalar || []).map(function (h) { return h.id; })).forEach(function (x) { t.evrenler[x] = true; });
  const idler = Object.keys(p.anahtarlar || {}).filter(function (id) { return id !== p.ozelKatman; });
  const ana = (veri.katmanlar || []).map(function (k) { return k.id; });
  if (!idler.length) { t.katmanMod = "yok"; }
  else if (ana.every(function (id) { return idler.indexOf(id) !== -1; })) { t.katmanMod = "hepsi"; }
  else { t.katmanMod = "sec"; idler.forEach(function (id) { t.katmanlar[id] = true; }); }
  t.ozel = !!p.ozelKatman;
  return t;
}

function kisiKodunuCoz(p) {
  if (!p || !p.kodSifreli || !yoneticiAcik()) { return null; }
  try {
    const kod = sifreCoz(p.kodSifreli, yoneticiKod);
    return dogrulamaOzeti(kod) === p.dogrulama ? kod : null;
  } catch (e) { return null; }
}

function kisiErisimOzeti(p) {
  if (!p.erisim) { return "her şey"; }
  const b = (p.erisim.bolumler || []).length;
  const n = Array.isArray(p.erisim.evrenler) ? p.erisim.evrenler.length : (veri.haritalar || []).length;
  return b + " bölüm · " + n + " evren";
}

function yoneticiKisiMesaj(p, kod) {
  const url = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : "";
  return "Merhaba " + p.ad + "! Tentiforverse arşivi için sana özel kodun: " + kod + "\n" +
    (url ? "Siteyi aç: " + url + "\n" : "") +
    "Sayfanın üstündeki \"Kod\" düğmesine bu kodu yaz; sana ayrılan bölümler açılır.";
}

function yoneticiKisiler() {
  if (!yoneticiKisiTaslak) { yoneticiKisiTaslak = kisiTaslakYeni(); }
  const t = yoneticiKisiTaslak;
  const profiller = veri.profiller || [];
  const cek = function (anahtar, secili, ad, veriAttr) {
    return '<label class="y-alan-secim"><input type="checkbox" ' + veriAttr + '="' + kacir(anahtar) + '"' + (secili ? " checked" : "") + "> " + kacir(ad) + "</label>";
  };

  const liste = profiller.length
    ? '<div class="y-blok-liste">' + profiller.map(function (p) {
        const acik = yoneticiKisiGoster === p.id;
        const kod = acik ? kisiKodunuCoz(p) : null;
        return '<div class="y-kisi-satir">' +
          '<div class="y-kisi-ust"><span class="y-blok-baslik">' + kacir(p.ad) + "</span>" +
            '<span class="oyun-not">' + kacir(kisiErisimOzeti(p)) + "</span></div>" +
          '<div class="y-kisi-dugmeler">' +
            (p.kodSifreli ? '<button class="dugme dugme-sade" data-y-kisi-goster="' + kacir(p.id) + '">' + (acik ? "kodu gizle" : "kodu göster") + "</button>" : "") +
            '<button class="dugme dugme-sade" data-y-kisi-duzenle="' + kacir(p.id) + '">düzenle</button>' +
            '<button class="dugme dugme-sade" data-y-kisi-yenile="' + kacir(p.id) + '">yeni kod</button>' +
            '<button class="dugme dugme-sade y-sil" data-y-kisi-sil="' + kacir(p.id) + '">sil</button>' +
          "</div>" +
          (acik ? (kod
            ? '<div class="y-kod-kutu"><input class="kod-giris arac-giris" readonly value="' + kacir(kod) + '" data-y-kisi-kod-kutu="1">' +
              '<div class="y-kisi-dugmeler"><button class="dugme dugme-sade" data-y-kisi-kopyala="' + kacir(p.id) + '">Kodu kopyala</button>' +
              '<button class="dugme dugme-sade" data-y-kisi-mesaj="' + kacir(p.id) + '">Mesajı kopyala</button></div></div>'
            : '<p class="oyun-not">Bu kişinin kodu saklı değil. "yeni kod"la üret.</p>') : "") +
        "</div>";
      }).join("") + "</div>"
    : '<p class="oyun-not">Henüz kişi yok.</p>';

  const paketler = '<div class="y-paket">' + KANON_PAKETLER.map(function (pk, i) {
    return '<button type="button" class="dugme dugme-sade" data-y-kisi-paket="' + i + '">' + kacir(pk.ad) + "</button>";
  }).join("") + "</div>";

  const bolumler = KANON_GRUPLARI.map(function (g) {
    return '<div class="y-kisi-grup"><span class="oyun-not">' + kacir(g.ad) + "</span>" +
      '<div class="y-alan-izgara">' + g.bolumler.map(function (b) {
        return cek(b, !!t.bolumler[b], kanonBolumAdi(b), "data-y-kisi-bolum");
      }).join("") + "</div></div>";
  }).join("");

  const evrenler = (veri.haritalar || []).length
    ? '<div class="y-alan-izgara">' + veri.haritalar.map(function (h) {
        return cek(h.id, !!t.evrenler[h.id], h.ad, "data-y-kisi-evren");
      }).join("") + "</div>"
    : '<p class="oyun-not">Henüz evren yok.</p>';

  const katmanSecim = (veri.katmanlar || []).map(function (k) {
    const kodVar = !!katmanKodlari[k.id];
    return '<label class="y-alan-secim"><input type="checkbox" data-y-kisi-katman="' + kacir(k.id) + '"' +
      (t.katmanlar[k.id] ? " checked" : "") + (kodVar ? "" : " disabled") + "> " + kacir(k.ad) +
      (kodVar ? "" : ' <em class="oyun-not">(kod yok)</em>') + "</label>";
  }).join("");

  const radyo = function (v, ad) {
    return '<label class="y-alan-secim"><input type="radio" name="yKisiKatmanMod" data-y-kisi-katmanmod="' + v + '"' +
      (t.katmanMod === v ? " checked" : "") + "> " + ad + "</label>";
  };

  return '<p class="oyun-not">Ad yaz, ne göreceğini seç, kodu üret. Kod sende saklı kalır; ' +
    "istediğin zaman \"kodu göster\"le tekrar görebilirsin. Oyunlar ve araçlar herkese açıktır.</p>" +
    liste +
    '<div class="kutu-y y-kisi-form"><label>' + (t.duzenle ? "Kişiyi düzenle" : "Yeni kişi") + "</label>" +
      '<input class="kod-giris arac-giris" id="yKisiAd" placeholder="ad" value="' + kacir(t.ad) + '">' +
      '<label>Hazır paket</label>' + paketler +
      '<label>Görebileceği bölümler</label>' + bolumler +
      '<label>Görebileceği evrenler</label>' + evrenler +
      '<details class="y-kisi-gelismis"' + ((t.katmanMod !== "hepsi" || t.ozel || t.selamlama || t.ozelKod) ? " open" : "") + "><summary>Gelişmiş</summary>" +
        '<input class="kod-giris arac-giris" id="yKisiSelam" placeholder="karşılama mesajı (isteğe bağlı)" value="' + kacir(t.selamlama) + '">' +
        '<input class="kod-giris arac-giris" id="yKisiKodOzel" maxlength="24" autocomplete="off" spellcheck="false" placeholder="' +
          (t.duzenle ? "yeni kod (boşsa aynı kalır)" : "kodu kendin yaz (boşsa rastgele üretilir)") + '" value="' + kacir(t.ozelKod) + '">' +
        '<p class="oyun-not">Kısa, akılda kalan kodlar tahmin edilebilir; yalnızca herkese açık bir başlangıç gibi düşük değerli erişimde kullan.</p>' +
        '<label>Buz katmanları</label><div class="y-alan-izgara">' +
          radyo("hepsi", "Hepsi açılsın") + radyo("yok", "Kapalı kalsın") + radyo("sec", "Seçerek") + "</div>" +
        (t.katmanMod === "sec" ? '<div class="y-alan-izgara">' + katmanSecim + "</div>" : "") +
        '<label class="hf-onay"><input type="checkbox" id="yKisiOzel"' + (t.ozel ? " checked" : "") + "> Bu kişiye özel gizli bir katman da oluştur</label>" +
      "</details>" +
      '<div class="y-kisi-dugmeler"><button class="dugme" data-y-kisi-olustur="1">' + (t.duzenle ? "Kaydet" : "Kodu üret") + "</button>" +
        (t.duzenle ? '<button class="dugme dugme-sade" data-y-kisi-vazgec="1">Vazgeç</button>' : "") + "</div>" +
    "</div>";
}

function yoneticiKisiTaslakOku() {
  const t = yoneticiKisiTaslak;
  if (!t) { return; }
  const al = function (id) { return document.querySelector("#" + id); };
  if (al("yKisiAd")) { t.ad = al("yKisiAd").value; }
  if (al("yKisiSelam")) { t.selamlama = al("yKisiSelam").value; }
  if (al("yKisiKodOzel")) { t.ozelKod = al("yKisiKodOzel").value; }
  if (al("yKisiOzel")) { t.ozel = al("yKisiOzel").checked; }
  const topla = function (sec, hedef) {
    const dugumler = document.querySelectorAll("[" + sec + "]");
    if (!dugumler.length) { return; }
    const yeni = {};
    dugumler.forEach(function (c) { if (c.checked) { yeni[c.getAttribute(sec)] = true; } });
    return yeni;
  };
  const b = topla("data-y-kisi-bolum"); if (b) { t.bolumler = b; }
  const e = topla("data-y-kisi-evren"); if (e) { t.evrenler = e; }
  const k = topla("data-y-kisi-katman"); if (k) { t.katmanlar = k; }
}

function yoneticiKisiKatmanSar(kod, idler) {
  const a = {};
  idler.forEach(function (id) { a[id] = sifrele(katmanKodlari[id], kod); });
  return a;
}

function yoneticiKisiKaydet() {
  yoneticiKisiTaslakOku();
  const t = yoneticiKisiTaslak;
  const ad = t.ad.trim();
  if (!ad) { yoneticiDurum("Kişinin adı gerekli", false); return; }

  const bolumler = KANON_BOLUMLERI.filter(function (b) { return t.bolumler[b]; });
  const evrenler = (veri.haritalar || []).map(function (h) { return h.id; }).filter(function (id) { return t.evrenler[id]; });
  if (!bolumler.length) { yoneticiDurum("En az bir bölüm seç (ya da Hazır paketlerden birini)", false); return; }

  if (!veri.profiller) { veri.profiller = []; }
  const p = t.duzenle ? veri.profiller.find(function (x) { return x.id === t.duzenle; }) : null;

  /* kod: düzenlemede aynı kalır (saklıysa); yeni kişide üretilir */
  let kod = p ? kisiKodunuCoz(p) : null;
  const istenen = (t.ozelKod || "").trim().toUpperCase();
  if (istenen) {
    if (!/^[A-Z0-9][A-Z0-9-]{3,23}$/.test(istenen)) { yoneticiDurum("Kod 4-24 karakter olmalı: harf, rakam ve tire", false); return; }
    const oz = dogrulamaOzeti(istenen);
    const cakisma = oz === veri.yoneticiOzet ||
      (veri.katmanlar || []).concat(veri.kisiselKatmanlar || []).some(function (k) { return k.dogrulama === oz; }) ||
      veri.profiller.some(function (x) { return x.dogrulama === oz && x !== p; });
    if (cakisma) { yoneticiDurum("Bu kod başka bir yerde kullanılıyor, başka bir kod dene", false); return; }
    kod = istenen;
  }
  const yeniKod = !kod;
  if (!kod) { kod = yoneticiKodUret("TNTF-K-"); }

  /* buz katmanları */
  const ana = (veri.katmanlar || []).map(function (k) { return k.id; });
  let idler = t.katmanMod === "hepsi" ? ana.slice()
    : t.katmanMod === "sec" ? ana.filter(function (id) { return t.katmanlar[id]; }) : [];
  const eksik = idler.filter(function (id) { return !katmanKodlari[id]; });
  idler = idler.filter(function (id) { return !!katmanKodlari[id]; });

  /* kişiye özel katman */
  let ozelId = p && p.ozelKatman ? p.ozelKatman : null;
  if (t.ozel && !ozelId) {
    const slug = ad.toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]+/gi, "").slice(0, 16) || "kisi";
    ozelId = "ks_" + slug;
    let n = 2;
    while (katmanBulHepsi(ozelId)) { ozelId = "ks_" + slug + n++; }
    const ozelKod = yoneticiKodUret("TNTF-KS-");
    if (!veri.kisiselKatmanlar) { veri.kisiselKatmanlar = []; }
    veri.kisiselKatmanlar.push({ id: ozelId, ad: ad + " için", dogrulama: dogrulamaOzeti(ozelKod), kisisel: true });
    katmanKodlari[ozelId] = ozelKod;
    kayitYaz(KATMAN_ANAHTAR, JSON.stringify(katmanKodlari));
    ustaAnahtarSarmala();
  }
  if (ozelId && (t.ozel || (p && p.ozelKatman)) && idler.indexOf(ozelId) === -1 && katmanKodlari[ozelId]) { idler.push(ozelId); }

  const kayit = p || { id: null };
  if (!p) {
    let id = "p_" + (ad.toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]+/gi, "").slice(0, 16) || "kisi");
    let n = 2;
    while (veri.profiller.some(function (x) { return x.id === id; })) { id = id.replace(/\d+$/, "") + n++; }
    kayit.id = id;
  }
  kayit.ad = ad;
  if (t.selamlama.trim()) { kayit.selamlama = t.selamlama.trim(); } else { delete kayit.selamlama; }
  kayit.dogrulama = dogrulamaOzeti(kod);
  kayit.anahtarlar = yoneticiKisiKatmanSar(kod, idler);
  kayit.erisim = { bolumler: bolumler, evrenler: evrenler };
  kayit.kodSifreli = sifrele(kod, yoneticiKod);
  if (veri.baslangicProfil === kayit.id) { veri.baslangicKodu = kod; }
  if (ozelId) { kayit.ozelKatman = ozelId; }
  if (!p) { veri.profiller.push(kayit); }

  kanonSifirla();
  yoneticiKisiGoster = kayit.id;
  yoneticiKisiTaslak = kisiTaslakYeni();
  yoneticiCiz();
  const kodKutusu = document.querySelector("[data-y-kisi-kod-kutu]");
  if (kodKutusu && kodKutusu.scrollIntoView) { kodKutusu.scrollIntoView({ block: "center", behavior: "smooth" }); }
  yoneticiDurum(ad + (p ? " kaydedildi" : " için kod hazır") + (eksik.length ? " · bazı buz katmanlarının kodu yok, atlandı" : "") +
    (p && yeniKod ? " · eski kod saklı değildi, yeni kod üretildi" : "") +
    " · kalıcı olması için Bakım → Kaydet sekmesinden GitHub'a kaydet", !eksik.length);
}

function yoneticiKisiYenile(id) {
  const p = (veri.profiller || []).find(function (x) { return x.id === id; });
  if (!p) { return; }
  const idler = Object.keys(p.anahtarlar || {}).filter(function (k) { return !!katmanKodlari[k]; });
  const kod = yoneticiKodUret("TNTF-K-");
  p.dogrulama = dogrulamaOzeti(kod);
  p.anahtarlar = yoneticiKisiKatmanSar(kod, idler);
  p.kodSifreli = sifrele(kod, yoneticiKod);
  if (veri.baslangicProfil === p.id) { veri.baslangicKodu = kod; }
  yoneticiKisiGoster = p.id;
  yoneticiCiz();
  yoneticiDurum("Yeni kod üretildi; eskisi artık çalışmaz", true);
}

function yoneticiKisiPanoya(metin, tamam) {
  panoyaKopyala(metin).then(function () { yoneticiDurum(tamam, true); })
    .catch(function () { yoneticiDurum("Kopyalanamadı, kutudan elle seç", false); });
}

document.addEventListener("click", function (e) {
  const bul = function (id) { return (veri.profiller || []).find(function (x) { return x.id === id; }); };

  if (e.target.closest("[data-y-kisi-olustur]")) { yoneticiKisiKaydet(); return; }
  if (e.target.closest("[data-y-kisi-vazgec]")) { yoneticiKisiTaslak = kisiTaslakYeni(); yoneticiCiz(); return; }

  const paket = e.target.closest("[data-y-kisi-paket]");
  if (paket) {
    yoneticiKisiTaslakOku();
    yoneticiKisiTaslak.bolumler = {};
    KANON_PAKETLER[parseInt(paket.getAttribute("data-y-kisi-paket"), 10)].bolumler.forEach(function (b) { yoneticiKisiTaslak.bolumler[b] = true; });
    yoneticiCiz();
    return;
  }

  const goster = e.target.closest("[data-y-kisi-goster]");
  if (goster) {
    const id = goster.getAttribute("data-y-kisi-goster");
    yoneticiKisiGoster = yoneticiKisiGoster === id ? null : id;
    yoneticiCiz();
    return;
  }
  const duzenle = e.target.closest("[data-y-kisi-duzenle]");
  if (duzenle) {
    const p = bul(duzenle.getAttribute("data-y-kisi-duzenle"));
    if (p) { yoneticiKisiTaslak = kisiTaslakProfilden(p); yoneticiCiz(); }
    return;
  }
  const yenile = e.target.closest("[data-y-kisi-yenile]");
  if (yenile) { yoneticiKisiYenile(yenile.getAttribute("data-y-kisi-yenile")); return; }

  const sil = e.target.closest("[data-y-kisi-sil]");
  if (sil) {
    const id = sil.getAttribute("data-y-kisi-sil");
    if (sil.dataset.onay !== "1") { sil.dataset.onay = "1"; sil.textContent = "emin misin?"; return; }
    veri.profiller = (veri.profiller || []).filter(function (p) { return p.id !== id; });
    if (veri.baslangicProfil === id) { delete veri.baslangicProfil; delete veri.baslangicKodu; }
    if (yoneticiKisiGoster === id) { yoneticiKisiGoster = null; }
    if (yoneticiKisiTaslak && yoneticiKisiTaslak.duzenle === id) { yoneticiKisiTaslak = kisiTaslakYeni(); }
    kanonSifirla();
    yoneticiCiz();
    yoneticiDurum("Kişi silindi", true);
    return;
  }

  const kopya = e.target.closest("[data-y-kisi-kopyala]");
  if (kopya) {
    const p = bul(kopya.getAttribute("data-y-kisi-kopyala"));
    const kod = p && kisiKodunuCoz(p);
    if (kod) { yoneticiKisiPanoya(kod, "Kod kopyalandı"); }
    return;
  }
  const mesaj = e.target.closest("[data-y-kisi-mesaj]");
  if (mesaj) {
    const p = bul(mesaj.getAttribute("data-y-kisi-mesaj"));
    const kod = p && kisiKodunuCoz(p);
    if (kod) { yoneticiKisiPanoya(yoneticiKisiMesaj(p, kod), "Mesaj kopyalandı"); }
  }
});

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-baslangic-uygula]")) { baslangicUygula(); }
});

document.addEventListener("change", function (e) {
  const t = e.target;
  if (!t || !t.hasAttribute) { return; }
  if (t.hasAttribute("data-y-kisi-katmanmod")) {
    yoneticiKisiTaslakOku();
    yoneticiKisiTaslak.katmanMod = t.getAttribute("data-y-kisi-katmanmod");
    yoneticiCiz();
    return;
  }
  if (t.hasAttribute("data-y-kisi-bolum") || t.hasAttribute("data-y-kisi-evren") || t.hasAttribute("data-y-kisi-katman") ||
      t.id === "yKisiAd" || t.id === "yKisiSelam" || t.id === "yKisiOzel" || t.id === "yKisiKodOzel") { yoneticiKisiTaslakOku(); }
});
