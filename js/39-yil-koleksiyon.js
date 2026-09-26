/* Yıl, kart ve takvim — Tömye Yılım özeti, karakter kartı koleksiyonu,
   Tömye takvimi etkinlikleri, yarış sonucu kartı ve İlk hafta yolu.

   Hepsi bu cihazda tutulur (tentiforapp_* kayıtları hesapla eşitlenir).
   Rastgele ödül ve satın alma yok: her kart belli bir şey yapılarak kazanılır. */

const YIL_ANAHTAR = "tentiforapp_yillik";
const KOLEKSIYON_ANAHTAR = "tentiforapp_kart_koleksiyon";
const ILK_HAFTA_ANAHTAR = "tentiforapp_ilk_hafta";

function tomyeBugun() {
  return (typeof dunyadanTomyeye === "function" && veri && veri.takvim) ? dunyadanTomyeye(new Date()) : null;
}

/** Dünya günü (YYYY-MM-DD) hangi Tömye yılına düşer. */
function dunyaGunuYili(gun) {
  const d = dunyadanTomyeye(new Date(gun + "T12:00:00Z"));
  return d ? d.yil : null;
}

/* ==================== TÖMYE YILIM ==================== */

function yilBos() {
  return { gunler: [], ecka: 0, madalya: [], okuma: 0, okunan: {}, oyun: {}, yaris: 0, enIyi: null, kart: [], etkinlik: [] };
}

function yillikOku() { return jsonOku(YIL_ANAHTAR, {}) || {}; }

/** Bu yılın kaydını değiştirir. Kayıt ilk kez açılıyorsa uğradığın eski günler geriye doldurulur. */
function yilGuncelle(fn) {
  const d = tomyeBugun();
  if (!d) { return; }
  const t = yillikOku();
  const anahtar = String(d.yil);
  if (!t[anahtar]) {
    t[anahtar] = yilBos();
    yilGeriDoldur(t);
  }
  const y = t[anahtar];
  const bugun = bugununAdi();
  if (y.gunler.indexOf(bugun) === -1) { y.gunler.push(bugun); }
  if (fn) { fn(y, d); }
  jsonYaz(YIL_ANAHTAR, t);
}

/** Yıllık kayıt başlamadan önceki ziyaret günleri (cüzdandaki son 400 gün). */
function yilGeriDoldur(t) {
  const gunler = (typeof cuzdan !== "undefined" && cuzdan.ist && cuzdan.ist.gunler) || [];
  gunler.forEach(function (g) {
    const yil = dunyaGunuYili(g);
    if (!yil) { return; }
    const k = String(yil);
    if (!t[k]) { t[k] = yilBos(); t[k].eksik = true; }
    if (t[k].gunler.indexOf(g) === -1) { t[k].gunler.push(g); }
  });
}

/** Özeti gösterilecek yıl: yılın ilk 30 gününde biten yıl, sonra süren yıl. */
function yilimVarsayilan() {
  const d = tomyeBugun();
  if (!d) { return null; }
  const gunNo = d.toplamGun % tomyeYilGun();
  const t = yillikOku();
  if (gunNo < 30 && t[String(d.yil - 1)]) { return d.yil - 1; }
  return d.yil;
}

let yilimSecili = null;

function yilimVerisi(yil) {
  const y = yillikOku()[String(yil)] || yilBos();
  const okunanlar = Object.keys(y.okunan || {}).sort(function (a, b) { return y.okunan[b] - y.okunan[a]; });
  const enCok = okunanlar.length && bolumErisimi("arsiv")
    ? (veri.karakterler || []).find(function (k) { return k.id === okunanlar[0]; }) : null;
  const oyunSayi = Object.keys(y.oyun || {}).reduce(function (s, k) { return s + y.oyun[k]; }, 0);
  const enSevilenOyun = Object.keys(y.oyun || {}).sort(function (a, b) { return y.oyun[b] - y.oyun[a]; })[0];
  const d = tomyeBugun();
  return {
    yil: yil,
    suruyor: d && d.yil === yil,
    eksik: !!y.eksik,
    gun: y.gunler.length,
    ecka: y.ecka || 0,
    madalya: (y.madalya || []).length,
    okuma: y.okuma || 0,
    enCok: enCok,
    oyun: oyunSayi,
    oyunAd: enSevilenOyun ? (OYUN_ADLARI[enSevilenOyun] || enSevilenOyun) : "",
    yaris: y.yaris || 0,
    enIyi: y.enIyi,
    kart: (y.kart || []).length,
    etkinlik: (y.etkinlik || []).length
  };
}

const OYUN_ADLARI = {
  nobet: "Nöbet", cevirmen: "Gırı Çevirmeni", vardiya: "Gündüz Vardiyası",
  boyut: "Boyut", yazi: "Kyldo yazısı", baloncuk: "Baloncuk evren"
};

function yilimCiz() {
  const alan = document.querySelector("#yilimAlan");
  if (!alan) { return; }
  yilGuncelle();
  const yillar = Object.keys(yillikOku()).map(Number).sort(function (a, b) { return b - a; });
  if (yilimSecili === null || yillar.indexOf(yilimSecili) === -1) { yilimSecili = yilimVarsayilan(); }
  const v = yilimVerisi(yilimSecili);

  const kutu = function (sayi, ad) {
    return '<div class="yilim-olcu"><b>' + kacir(String(sayi)) + "</b><span>" + kacir(ad) + "</span></div>";
  };
  alan.innerHTML =
    (yillar.length > 1
      ? '<div class="yilim-yillar">' + yillar.map(function (y) {
          return '<button class="dugme' + (y === yilimSecili ? "" : " dugme-sade") + '" data-yilim="' + y + '">' + y + ". yıl</button>";
        }).join("") + "</div>" : "") +
    '<div class="yilim-baslik"><span class="oyun-etiket">Tömye yılı</span>' +
      "<h3>" + v.yil + ' <span class="yilim-tomye">' + kacir(tomyeSayi(v.yil)) + "</span></h3>" +
      '<p class="oyun-not">' + (v.suruyor ? "Yıl sürüyor; özet her gün büyür." : "Bu yıl kapandı.") +
        (v.eksik ? " Bu yıl kayıt tutulmadan önce başladığı için yalnızca uğradığın günler biliniyor." : "") + "</p></div>" +
    '<div class="yilim-izgara">' +
      kutu(v.gun, "gün uğradın") + kutu(v.ecka, "eçka kazandın") + kutu(v.madalya, "madalya") +
      kutu(v.okuma, "kayıt okudun") + kutu(v.oyun, "oyun bitirdin") + kutu(v.yaris, "yarış") +
      kutu(v.kart, "yeni kart") + kutu(v.etkinlik, "takvim görevi") +
    "</div>" +
    (v.enCok ? '<p class="yilim-not">En çok uğradığın kayıt: <b>' + kacir(v.enCok.ad) + "</b></p>" : "") +
    (v.oyunAd ? '<p class="yilim-not">En çok oynadığın: <b>' + kacir(v.oyunAd) + "</b></p>" : "") +
    (v.enIyi ? '<p class="yilim-not">En iyi yarışın: <b>' + kacir(v.enIyi.ad) + " · " + Number(v.enIyi.puan) + " puan</b></p>" : "") +
    '<div class="oyun-sira"><button class="dugme" data-yilim-paylas="1">Kartı paylaş</button>' +
      '<button class="dugme dugme-sade" data-yilim-indir="1">İndir</button></div>' +
    '<p class="pencere-durum" id="yilimDurum"></p>' +
    '<div class="kart-onizleme" id="yilimOnizleme"></div>';
  yilimOnizle();
}

async function yilimOnizle() {
  const kutu = document.querySelector("#yilimOnizleme");
  if (!kutu) { return; }
  const t = await yilimKartUret(yilimSecili);
  if (t) { kartOnizle(kutu, t); t.setAttribute("aria-label", "Tömye Yılım kartı önizlemesi"); }
}

async function yilimKartUret(yil) {
  await kartFontlariHazir();
  const v = yilimVerisi(yil);
  const t = document.createElement("canvas");
  t.width = KART_EN; t.height = KART_BOY;
  const c = t.getContext && t.getContext("2d");
  if (!c) { return null; }
  kartZemin(c, KART_EN, KART_BOY);
  const sol = 110, sag = KART_EN - 110, gen = sag - sol;

  c.fillStyle = KART_RENK.deniz;
  c.fillRect(sol, 118, 6, 64);
  kartEtiket(c, v.suruyor ? "Tömye yılım · sürüyor" : "Tömye yılım", sol + 26, 162, KART_RENK.murekkep2, 24);

  c.fillStyle = KART_RENK.murekkep;
  c.font = KART_FONT.baslik(190);
  c.fillText(String(v.yil), sol, 390);
  c.font = KART_FONT.yazi(44, true);
  c.fillStyle = KART_RENK.deniz;
  c.fillText(tomyeSayi(v.yil) + ". yıl", sol, 450);

  const olculer = [
    [v.gun, "gün"], [v.ecka, "eçka"], [v.madalya, "madalya"],
    [v.okuma, "kayıt"], [v.oyun, "oyun"], [v.yaris, "yarış"]
  ];
  let y = 560;
  olculer.forEach(function (o, i) {
    const x = sol + (i % 3) * (gen / 3);
    const yy = y + Math.floor(i / 3) * 150;
    c.fillStyle = KART_RENK.murekkep;
    c.font = KART_FONT.baslik(72);
    c.fillText(String(o[0]), x, yy);
    kartEtiket(c, o[1], x, yy + 42, KART_RENK.yarik, 20);
  });

  y = 900;
  c.font = KART_FONT.yazi(34, true);
  c.fillStyle = KART_RENK.murekkep2;
  const satirlar = [];
  if (v.enCok) { satirlar.push("En çok uğradığım kayıt: " + v.enCok.ad); }
  if (v.oyunAd) { satirlar.push("En çok oynadığım: " + v.oyunAd); }
  if (v.enIyi) { satirlar.push("En iyi yarışım: " + v.enIyi.ad + " · " + v.enIyi.puan + " puan"); }
  if (!satirlar.length && typeof arsivciKisilik === "function") { satirlar.push("Kişiliğim: " + arsivciKisilik().ad); }
  satirlar.slice(0, 3).forEach(function (s) {
    kartSar(c, s, gen).slice(0, 1).forEach(function (l) { c.fillText(l, sol, y); y += 48; });
  });

  kartEtiket(c, "TentiforApp · " + KART_ADRES, sol, KART_BOY - 70, KART_RENK.yarik, 20);
  return t;
}

async function yilimDisari(tur) {
  const durum = document.querySelector("#yilimDurum");
  const t = await yilimKartUret(yilimSecili);
  if (!t) { if (durum) { durum.textContent = "Tarayıcı görsel üretmeyi desteklemiyor"; } return; }
  const ad = "tentifor-yil-" + yilimSecili + ".png";
  let sonuc;
  if (tur === "indir") { kartIndir(await kartBlob(t), ad); sonuc = "İndirildi"; }
  else { sonuc = await kartPaylas(t, ad, "Tömye'de " + yilimSecili + ". yılım"); }
  if (durum) { durum.textContent = sonuc; durum.className = "pencere-durum iyi"; }
}

/* ==================== KARAKTER KARTI KOLEKSİYONU ==================== */

function koleksiyonOku() { return jsonOku(KOLEKSIYON_ANAHTAR, {}) || {}; }

function kartSahip(id) { return !!koleksiyonOku()[id]; }

/** Parlak kart: kaydı üç farklı günde okumak. */
function kartParlak(k) { return !!k && (k.gunler || []).length >= ((veri.koleksiyon && veri.koleksiyon.parlakGun) || 3); }

/** Kart kazanma/ilerletme. kaynak: okuma | test | nobet */
function kartKazan(id, kaynak) {
  const kar = (veri.karakterler || []).find(function (k) { return k.id === id; });
  if (!kar || kar.kart === false) { return; }
  const t = koleksiyonOku();
  const bugun = bugununAdi();
  const yeni = !t[id];
  const k = t[id] || { kaynak: kaynak, gunler: [] };
  const parlakti = kartParlak(k);
  if (kaynak === "okuma" && k.gunler.indexOf(bugun) === -1) { k.gunler.push(bugun); }
  t[id] = k;
  jsonYaz(KOLEKSIYON_ANAHTAR, t);

  if (yeni) {
    eckaKazan(5, "Karakter kartı: " + kar.ad);
    yilGuncelle(function (y) { if (y.kart.indexOf(id) === -1) { y.kart.push(id); } });
    ilkHaftaIsaretle("kart");
  } else if (!parlakti && kartParlak(k)) {
    eckaKazan(10, "Parlak kart: " + kar.ad);
  }
  setKontrol();
  if (document.querySelector("#koleksiyonAlan")) { koleksiyonCiz(); }
}

function kartSetleri() {
  const setler = {};
  (veri.karakterler || []).forEach(function (k, i) {
    if (k.kart === false) { return; }   /* koleksiyona girmeyen kayıt */
    const g = k.grup || "Diğer";
    (setler[g] = setler[g] || []).push({ k: k, i: i });
  });
  return setler;
}

function setUnvani(grup) {
  const s = ((veri.koleksiyon && veri.koleksiyon.setler) || []).find(function (x) { return x.grup === grup; });
  return s ? s.unvan : grup + " Koleksiyoncusu";
}

function tamamlananSetler() {
  const t = koleksiyonOku();
  const setler = kartSetleri();
  return Object.keys(setler).filter(function (g) {
    return setler[g].every(function (x) { return !!t[x.k.id]; });
  });
}

function setKontrol() {
  const tamam = tamamlananSetler();
  if (tamam.length && typeof madalyaVer === "function") { madalyaVer("setTamam"); }
  if (tamam.length && tamam.length === Object.keys(kartSetleri()).length) { madalyaVer("tamKoleksiyon"); }
}

function koleksiyonCiz() {
  const alan = document.querySelector("#koleksiyonAlan");
  if (!alan) { return; }
  const t = koleksiyonOku();
  const arsivAcik = bolumErisimi("arsiv");
  const setler = kartSetleri();
  const toplam = (veri.karakterler || []).filter(function (k) { return k.kart !== false; }).length;
  const sahip = Object.keys(t).length;
  const tamam = tamamlananSetler();

  alan.innerHTML =
    '<p class="oyun-giris">Bir karakterin kaydını açtığında kartı senin olur; üç farklı günde açarsan kart parlar. ' +
      "“Hangi karaktersin?” testinin sonucu ve Nöbet'i bitirdiğin görevli de kart verir. Bir seti tamamlayınca o setin unvanını alırsın.</p>" +
    '<p class="oyun-not">' + sahip + " / " + toplam + " kart · " + tamam.length + " / " + Object.keys(setler).length + " set</p>" +
    (tamam.length ? '<div class="kol-unvanlar">' + tamam.map(function (g) {
      return '<span class="kol-unvan">' + kacir(setUnvani(g)) + "</span>";
    }).join("") + "</div>" : "") +
    Object.keys(setler).map(function (g) {
      const liste = setler[g];
      const bilinen = liste.some(function (x) { return t[x.k.id]; });
      const adet = liste.filter(function (x) { return t[x.k.id]; }).length;
      return '<div class="kol-set">' +
        '<div class="kol-set-ust"><span class="oyun-etiket">' + (bilinen && arsivAcik ? kacir(g) : "Bilinmeyen set") + "</span>" +
          '<span class="oyun-not">' + adet + " / " + liste.length + (adet === liste.length ? " · " + kacir(setUnvani(g)) : "") + "</span></div>" +
        '<div class="kol-izgara">' + liste.map(function (x) { return kartHtml(x.k, x.i, t[x.k.id], arsivAcik); }).join("") + "</div></div>";
    }).join("");
}

function kartHtml(k, i, kayit, arsivAcik) {
  const no = tomyeSayi(i + 1);
  if (!kayit) {
    return '<div class="kol-kart kapali" aria-label="Kapalı kart ' + (i + 1) + '"><span class="kol-no">' + kacir(no) + "</span>" +
      '<span class="kol-soru">?</span><span class="kol-ipucu">' + (arsivAcik ? "kaydını aç" : "arşivle açılır") + "</span></div>";
  }
  const parlak = kartParlak(kayit);
  const icerik = '<span class="kol-no">' + kacir(no) + "</span>" +
    '<span class="kol-ad">' + kacir(k.ad) + "</span>" +
    (arsivAcik ? '<span class="kol-unvan-k">' + kacir(k.unvan || "") + "</span>" : "") +
    '<span class="kol-ipucu">' + (parlak ? "parlak" : ({ test: "testten", nobet: "Nöbet'ten" })[kayit.kaynak] || ((kayit.gunler || []).length + " / 3 gün")) + "</span>";
  return arsivAcik
    ? '<button class="kol-kart' + (parlak ? " parlak" : "") + '" data-kol-ac="' + i + '">' + icerik + "</button>"
    : '<div class="kol-kart' + (parlak ? " parlak" : "") + '">' + icerik + "</div>";
}

/* ==================== TÖMYE TAKVİMİ ETKİNLİKLERİ ==================== */

/** "Leg, 21" → { ay, gun } */
function tomyeTarihAyir(metin) {
  const m = String(metin || "").match(/^\s*([^,\d]+?)\s*,?\s*(\d{1,2})\s*$/);
  if (!m) { return null; }
  const ay = (veri.takvim.aylar || []).findIndex(function (a) { return a.ad.toLocaleLowerCase("tr") === m[1].toLocaleLowerCase("tr"); });
  return ay === -1 ? null : { ayNo: ay + 1, gun: Number(m[2]) };
}

/** Bütün etkinlikler: elle yazılanlar + günlük yıldönümleri + doğum günleri (görülebilenler). */
function takvimEtkinlikleri() {
  const liste = [];
  (veri.takvimEtkinlikleri || []).forEach(function (e) {
    const ay = (veri.takvim.aylar || []).findIndex(function (a) { return a.ad === e.ay; });
    if (ay !== -1) { liste.push(Object.assign({}, e, { ayNo: ay + 1, sure: e.sure || 1 })); }
  });
  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();
  if (bolumErisimi("mektuplar")) {
    (veri.gunlukler || []).forEach(function (g, i) {
      const t = tomyeTarihAyir(g.tarih);
      if (!t) { return; }
      if (!yonetici && !(katmanAcik(g.gizli) && spoilerUygun(g.gizli))) { return; }
      liste.push({ id: "gunluk" + i, ad: g.kim + "'nin günlüğü", ayNo: t.ayNo, gun: t.gun, sure: 1,
        metin: g.tarih + " günü yazılmış bir sayfa. Bugün, yıllar sonra aynı gün.", alinti: String(g.metin || "").split("\n")[0], git: "mektuplar" });
    });
  }
  if (bolumErisimi("arsiv")) {
    (veri.karakterler || []).forEach(function (k, i) {
      const t = tomyeTarihAyir(k.dogum);
      if (t) { liste.push({ id: "dogum_" + k.id, ad: k.ad + "'in doğum günü", ayNo: t.ayNo, gun: t.gun, sure: 1, tema: "dogum", metin: k.ozet || "", karakter: i }); }
    });
  }
  return liste;
}

/** Yılın kaçıncı günü (0'dan). */
function tomyeYilGunNo(ayNo, gun) {
  let n = 0;
  for (let i = 0; i < ayNo - 1; i++) { n += veri.takvim.aylar[i].gun; }
  return n + gun - 1;
}

function bugunkuEtkinlikler() {
  const d = tomyeBugun();
  if (!d) { return []; }
  const bugun = tomyeYilGunNo(d.ayNo, d.gun);
  return takvimEtkinlikleri().filter(function (e) {
    const bas = tomyeYilGunNo(e.ayNo, e.gun);
    return bugun >= bas && bugun < bas + e.sure;
  });
}

/** Sıradaki etkinlikler (Dünya tarihiyle). */
function yaklasanEtkinlikler(adet) {
  const d = tomyeBugun();
  if (!d) { return []; }
  const yilGun = tomyeYilGun();
  const bugun = tomyeYilGunNo(d.ayNo, d.gun);
  return takvimEtkinlikleri().map(function (e) {
    const bas = tomyeYilGunNo(e.ayNo, e.gun);
    const yil = bas + e.sure <= bugun ? d.yil + 1 : d.yil;
    const kalan = (bas - bugun + (yil > d.yil ? yilGun : 0));
    return Object.assign({ yil: yil, kalan: kalan, dunya: tomyedenDunyaya(yil, e.ayNo, e.gun) }, e);
  }).filter(function (e) { return e.kalan > 0; })
    .sort(function (a, b) { return a.kalan - b.kalan; }).slice(0, adet || 5);
}

function etkinlikOdulAnahtari(e) { const d = tomyeBugun(); return "etkinlik_" + e.id + "_" + (d ? d.yil : 0); }

/** Görev tamamlandıysa ödülü bir kez verir. */
function etkinlikGorevKontrol() {
  bugunkuEtkinlikler().forEach(function (e) {
    if (!e.gorev || typeof gorevDurum !== "function") { return; }
    const anahtar = etkinlikOdulAnahtari(e);
    if (kilitAcik(anahtar) || gorevDurum(e.gorev.id) < (e.gorev.adet || 1)) { return; }
    cuzdan.acilan.push(anahtar);
    eckaKazan(e.gorev.odul || 30, e.ad);
    yilGuncelle(function (y) { if (y.etkinlik.indexOf(anahtar) === -1) { y.etkinlik.push(anahtar); } });
    madalyaVer("takvimTanigi");
  });
}

function etkinlikTemasiUygula() {
  const e = bugunkuEtkinlikler().find(function (x) { return x.tema; });
  if (e) { document.documentElement.setAttribute("data-etkinlik", e.tema); }
  else { document.documentElement.removeAttribute("data-etkinlik"); }
}

function etkinlikKartHtml(e) {
  const gorev = e.gorev;
  const bitti = gorev && kilitAcik(etkinlikOdulAnahtari(e));
  const ilerleme = gorev && typeof gorevDurum === "function" ? Math.min(gorevDurum(gorev.id), gorev.adet || 1) : 0;
  return '<div class="etkinlik-kart' + (e.tema ? " et-" + kacir(e.tema) : "") + '">' +
    '<span class="oyun-etiket">Bugün Tömye\'de</span>' +
    "<h3>" + kacir(e.ad) + "</h3>" +
    (e.metin ? '<p class="oyun-not">' + kacir(e.metin) + "</p>" : "") +
    (e.alinti ? '<blockquote class="etkinlik-alinti">' + kacir(e.alinti) + "</blockquote>" : "") +
    (gorev ? '<p class="etkinlik-gorev' + (bitti ? " bitti" : "") + '">' + (bitti ? "✓ " : "◇ ") + kacir(gorev.ad) +
      " · " + (bitti ? "tamamlandı" : ilerleme + " / " + (gorev.adet || 1) + " · " + (gorev.odul || 30) + " " + birim()) + "</p>" : "") +
    (e.git ? '<button class="dugme dugme-sade" data-gez-git="' + kacir(e.git) + '">Oku</button>' : "") +
    (e.karakter !== undefined ? '<button class="dugme dugme-sade" data-kol-ac="' + e.karakter + '">Kaydı aç</button>' : "") +
  "</div>";
}

/** Ana sayfadaki şerit: bugünkü etkinlikler, yıl dönümü, ilk hafta yolu. */
function etkinlikSeritCiz() {
  const alan = document.querySelector("#etkinlikAlan");
  if (!alan || !veri.takvim) { return; }
  etkinlikGorevKontrol();
  etkinlikTemasiUygula();
  const bugun = bugunkuEtkinlikler();
  const d = tomyeBugun();
  let yilNotu = "";
  if (d) {
    const gunNo = d.toplamGun % tomyeYilGun();
    const kalan = tomyeYilGun() - gunNo;
    if (gunNo < 14 && yillikOku()[String(d.yil - 1)]) {
      yilNotu = '<div class="etkinlik-kart et-yil"><span class="oyun-etiket">Yıl döndü</span><h3>' + (d.yil - 1) +
        ". yılın özeti hazır</h3>" + '<button class="dugme" data-gez-git="yilim">Tömye Yılım</button></div>';
    } else if (kalan <= 14) {
      yilNotu = '<div class="etkinlik-kart et-yil"><span class="oyun-etiket">Yıl bitiyor</span><h3>' + d.yil +
        ". yılın bitmesine " + kalan + " gün</h3>" + '<button class="dugme" data-gez-git="yilim">Özetine bak</button></div>';
    }
  }
  alan.innerHTML = bugun.map(etkinlikKartHtml).join("") + yilNotu;
}

function takvimEtkinlikCiz() {
  const alan = document.querySelector("#takvimEtkinlikAlan");
  if (!alan || !veri.takvim) { return; }
  const yakin = yaklasanEtkinlikler(6);
  alan.innerHTML = bugunkuEtkinlikler().map(etkinlikKartHtml).join("") +
    (yakin.length ? '<div class="oyun-etiket">Yaklaşan günler</div><ul class="etkinlik-liste">' + yakin.map(function (e) {
      const ay = veri.takvim.aylar[e.ayNo - 1].ad;
      return "<li><b>" + e.gun + " " + kacir(ay) + "</b> · " + kacir(e.ad) +
        ' <span class="oyun-not">' + e.kalan + " Tömye günü sonra · Dünya'da " +
        e.dunya.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) + "</span></li>";
    }).join("") + "</ul>" : "");
}

/* ==================== YARIŞ SONUCU KARTI ==================== */

async function yarisKartUret() {
  if (typeof Y2 === "undefined" || !Y2 || !Y2.sonuc || Y2.sonuc.durum !== "tamam") { return null; }
  await kartFontlariHazir();
  const s = Y2.sonuc;
  const t = document.createElement("canvas");
  t.width = KART_EN; t.height = KART_BOY;
  const c = t.getContext && t.getContext("2d");
  if (!c) { return null; }
  kartZemin(c, KART_EN, KART_BOY);
  const sol = 110, sag = KART_EN - 110, gen = sag - sol;

  c.fillStyle = KART_RENK.deniz;
  c.fillRect(sol, 118, 6, 64);
  kartEtiket(c, "Yarış sonucu", sol + 26, 162, KART_RENK.murekkep2, 24);

  c.fillStyle = KART_RENK.murekkep;
  let px = 84;
  const ad = YARIS_AD[Y2.yaris] || Y2.yaris;
  c.font = KART_FONT.baslik(px);
  while (c.measureText(ad).width > gen && px > 48) { px -= 4; c.font = KART_FONT.baslik(px); }
  c.fillText(ad, sol, 300);

  const e = (typeof tomyeEtkinligi === "function") ? tomyeEtkinligi() : null;
  if (e && e.yaris === Y2.yaris) {
    c.font = KART_FONT.yazi(34, true);
    c.fillStyle = KART_RENK.deniz;
    c.fillText(e.ay + " ayının yarışı · " + e.tema, sol, 356);
  }

  c.fillStyle = KART_RENK.yarik;
  c.font = KART_FONT.baslik(300);
  c.textAlign = "center";
  c.fillText(String(s.puan), KART_EN / 2, 700);
  kartEtiket(c, "puan", KART_EN / 2 - 40, 760, KART_RENK.murekkep2, 26);
  c.textAlign = "left";

  c.font = KART_FONT.yazi(40, true);
  c.fillStyle = KART_RENK.murekkep2;
  c.textAlign = "center";
  c.fillText(s.dogru + " doğru · " + Math.round((s.sure_ms || 0) / 1000) + " saniye", KART_EN / 2, 850);
  c.textAlign = "left";

  const kim = (typeof hesapProfil !== "undefined" && hesapProfil && (hesapProfil.gorunen_ad || hesapProfil.kullanici_adi)) || "";
  const buzY = KART_BOY * 0.72;
  if (kim) {
    kartEtiket(c, "Arşivci", sol, buzY + 110, KART_RENK.yarik, 20);
    c.fillStyle = KART_RENK.murekkep;
    c.font = KART_FONT.baslik(56);
    c.fillText(String(kim).slice(0, 28), sol, buzY + 180);
  }
  const d = tomyeBugun();
  kartEtiket(c, "TentiforApp · " + KART_ADRES, sol, KART_BOY - 70, KART_RENK.yarik, 20);
  if (d) {
    c.font = KART_FONT.yazi(26, true);
    c.fillStyle = KART_RENK.murekkep2;
    c.textAlign = "right";
    c.fillText(d.gun + " " + d.ay + " " + d.yil, sag, KART_BOY - 70);
    c.textAlign = "left";
  }
  return t;
}

async function yarisKartPaylas(dugme) {
  const t = await yarisKartUret();
  if (!t) { return; }
  const sonuc = await kartPaylas(t, "tentifor-yaris-" + Y2.yaris + ".png", (YARIS_AD[Y2.yaris] || "Yarış") + ": " + Y2.sonuc.puan + " puan");
  if (dugme && sonuc) { dugme.textContent = sonuc; }
}

/* ==================== İLK HAFTA YOLU ==================== */

const ILK_HAFTA_ADIMLARI = [
  { id: "yazi", ad: "Kyldo yazısında bir kelime oku", git: "yazi" },
  { id: "oyun", ad: "Bir oyunu sonuna kadar oyna", git: "oyunlar" },
  { id: "isim", ad: "İsim sistemiyle adını Tentifor'a çevir", git: "isim" },
  { id: "kart", ad: "İlk karakter kartını kazan (testi çöz ya da bir kayıt aç)", git: "test" },
  { id: "kartpostal", ad: "Birine şifreli kartpostal hazırla", git: "kartpostal" },
  { id: "yaris", ad: "Bir yarışı ya da haftalık meydan okumayı bitir", git: "yarislar" },
  { id: "defter", ad: "Kütüphane Defteri'ne bir cümle yaz ya da bir fan hikâyesi başlat", git: "ortakDefter" }
];
const ILK_HAFTA_ADIM_ODUL = 15, ILK_HAFTA_SON_ODUL = 70;

function ilkHaftaOku() { return jsonOku(ILK_HAFTA_ANAHTAR, {}) || {}; }

/** Yeni ziyaretçi ya da yeni hesap: yol kendiliğinden başlar. */
function ilkHaftaBaslatDene() {
  const h = ilkHaftaOku();
  if (h.bas) { return; }
  const gunSayisi = (typeof cuzdan !== "undefined" && cuzdan.ist && cuzdan.ist.gunler) ? cuzdan.ist.gunler.length : 0;
  const yeniHesap = typeof hesapKullanici !== "undefined" && hesapKullanici && hesapKullanici.created_at &&
    (Date.now() - new Date(hesapKullanici.created_at).getTime()) < 7 * 864e5;
  if (gunSayisi <= 1 || yeniHesap) {
    jsonYaz(ILK_HAFTA_ANAHTAR, { bas: bugununAdi(), gunler: [bugununAdi()], yapilan: [], odul: [] });
  }
}

/** Yolun kaçıncı günündesin: yol başladıktan sonra uğradığın farklı günler. */
function ilkHaftaGun(h) {
  if (!h.bas) { return 0; }
  const bugun = bugununAdi();
  if (h.gunler.indexOf(bugun) === -1) { h.gunler.push(bugun); jsonYaz(ILK_HAFTA_ANAHTAR, h); }
  return h.gunler.length;
}

function ilkHaftaIsaretle(id) {
  const h = ilkHaftaOku();
  if (!h.bas || h.bitti) { return; }
  if (h.yapilan.indexOf(id) === -1) { h.yapilan.push(id); jsonYaz(ILK_HAFTA_ANAHTAR, h); }
  ilkHaftaOdulKontrol();
  ilkHaftaCiz();
}

function ilkHaftaOdulKontrol() {
  const h = ilkHaftaOku();
  if (!h.bas || h.bitti) { return; }
  const gun = ilkHaftaGun(h);
  let degisti = false;
  ILK_HAFTA_ADIMLARI.forEach(function (a, i) {
    if (i < gun && h.yapilan.indexOf(a.id) !== -1 && h.odul.indexOf(a.id) === -1) {
      h.odul.push(a.id);
      degisti = true;
      eckaKazan(ILK_HAFTA_ADIM_ODUL, "İlk hafta · " + (i + 1) + ". gün");
    }
  });
  if (h.odul.length === ILK_HAFTA_ADIMLARI.length) {
    h.bitti = bugununAdi();
    degisti = true;
    eckaKazan(ILK_HAFTA_SON_ODUL, "İlk hafta yolu");
    madalyaVer("ilkHafta");
  }
  if (degisti) { jsonYaz(ILK_HAFTA_ANAHTAR, h); }
}

function ilkHaftaCiz() {
  const alan = document.querySelector("#ilkHaftaAlan");
  if (!alan) { return; }
  const h = ilkHaftaOku();
  /* bittikten üç gün sonra ana sayfadan kalkar */
  if (!h.bas || (h.bitti && (Date.now() - new Date(h.bitti + "T00:00:00Z").getTime()) > 3 * 864e5)) { alan.innerHTML = ""; return; }
  const gun = ilkHaftaGun(h);
  alan.innerHTML = '<div class="ilk-hafta">' +
    '<div class="ilk-hafta-ust"><span class="oyun-etiket">İlk hafta yolu</span><span class="oyun-not">' +
      (h.bitti ? "Tamamlandı · Yol Arkadaşı rozeti senin" : h.odul.length + " / 7 · her gün bir adım açılır") + "</span></div>" +
    '<ol class="ilk-hafta-adimlar">' + ILK_HAFTA_ADIMLARI.map(function (a, i) {
      const acik = i < gun, bitti = h.odul.indexOf(a.id) !== -1, yapildi = h.yapilan.indexOf(a.id) !== -1;
      const durum = bitti ? "bitti" : (acik ? "acik" : "kilitli");
      return '<li class="' + durum + '"><span class="ih-gun">' + kacir(tomyeSayi(i + 1)) + "</span>" +
        "<span>" + (acik || yapildi ? kacir(a.ad) : (i === gun ? "yarın açılır" : (i + 1) + ". gün açılır")) + "</span>" +
        (acik && !bitti ? '<button class="dugme dugme-sade" data-gez-git="' + a.git + '">Git</button>' : "") +
        (bitti ? '<span class="ih-tik">✓</span>' : "") + "</li>";
    }).join("") + "</ol></div>";
}

/* ==================== KANCALAR ==================== */

/* Tanımları 24-arsiv-mantigi.js'ten sonra da geçerli kalsın diye sarmalama sayfa yüklenince yapılır. */
function yilKancalariKur() {
  const sar = function (ad, sonra) {
    const eski = window[ad];
    if (typeof eski !== "function") { return; }
    window[ad] = function () {
      const r = eski.apply(this, arguments);
      try { sonra.apply(this, [r].concat(Array.prototype.slice.call(arguments))); } catch (e) { /* kanca asıl işi bozmasın */ }
      return r;
    };
  };

  sar("eckaKazan", function (r, miktar) {
    if (miktar > 0) { yilGuncelle(function (y) { y.ecka += miktar; }); }
  });
  sar("madalyaVer", function (r, id) {
    yilGuncelle(function (y) { if (y.madalya.indexOf(id) === -1) { y.madalya.push(id); } });
  });
  sar("karakterAc", function (r, i) {
    const k = veri.karakterler[i];
    if (!k || !bolumErisimi("arsiv")) { return; }
    yilGuncelle(function (y) { y.okuma++; y.okunan[k.id] = (y.okunan[k.id] || 0) + 1; });
    kartKazan(k.id, "okuma");
  });
  sar("oyunBitti", function (r, oyun) {
    yilGuncelle(function (y) { y.oyun[oyun] = (y.oyun[oyun] || 0) + 1; });
    ilkHaftaIsaretle("oyun");
    if (oyun === "nobet" && typeof O !== "undefined" && O && O.gorevli) { kartKazan(O.gorevli, "nobet"); }
  });
  sar("testSec", function () {
    if (typeof T !== "undefined" && T && T.sonuc && !kartSahip(T.sonuc)) { kartKazan(T.sonuc, "test"); }
  });
  sar("yarisOdul", function (r, id, puan) {
    if (!puan) { return; }
    yilGuncelle(function (y) {
      y.yaris++;
      if (!y.enIyi || puan > y.enIyi.puan) { y.enIyi = { ad: YARIS_AD[id] || id, puan: puan }; }
    });
    ilkHaftaIsaretle("yaris");
  });
  sar("gorevIlerle", function (r, id) {
    if (id === "yazi4") { ilkHaftaIsaretle("yazi"); }
    etkinlikGorevKontrol();
  });
  sar("isimCalistir", function () {
    const g = document.querySelector("#isimGiris");
    if (g && g.value.trim()) { ilkHaftaIsaretle("isim"); }
  });
  sar("meydanBitir", function () { ilkHaftaIsaretle("yaris"); });
  sar("fanYeni", function (r, tur) { if (tur === "hikaye") { ilkHaftaIsaretle("defter"); } });
  sar("kartpostalOlustur", function () {
    if (document.querySelector("#kpAdres")) { ilkHaftaIsaretle("kartpostal"); }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  if (typeof veri === "undefined") { return; }
  yilKancalariKur();
});

/** Veri yüklenince (24-arsiv-mantigi.js hepsiniCiz'den sonra çağırır). */
function yilKoleksiyonBasla() {
  if (!veri || !veri.takvim) { return; }
  yilGuncelle();
  ilkHaftaBaslatDene();
  ilkHaftaOdulKontrol();
  etkinlikSeritCiz();
  ilkHaftaCiz();
}

document.addEventListener("click", function (e) {
  const h = e.target.closest("[data-yilim], [data-yilim-paylas], [data-yilim-indir], [data-kol-ac], [data-yaris-kart]");
  if (!h) { return; }
  const d = h.dataset;
  if (d.yilim) { yilimSecili = Number(d.yilim); yilimCiz(); }
  else if (d.yilimPaylas) { yilimDisari("paylas"); }
  else if (d.yilimIndir) { yilimDisari("indir"); }
  else if (d.kolAc !== undefined) { karakterAc(Number(d.kolAc)); }
  else if (d.yarisKart) { yarisKartPaylas(h); }
});

/* Yerel bölümler adresle gidildiğinde tazelenir (koleksiyon başka sayfada büyümüş olabilir). */
window.addEventListener("hashchange", function () {
  const ad = rota().replace(/^#\/?/, "").split("/")[0];
  if (ad === "yilim" && document.querySelector("#yilimAlan").innerHTML) { yilimCiz(); }
  else if (ad === "koleksiyon" && document.querySelector("#koleksiyonAlan").innerHTML) { koleksiyonCiz(); }
  else if (ad === "takvim") { takvimEtkinlikCiz(); }
  else if (ad === "" || ad === "arsiv") { etkinlikSeritCiz(); ilkHaftaCiz(); }
});
