/* Altıncı dalga — çapraz bağlantılar ve aile ağacı.

   Kartlar birbirini tanımıyordu: Pileg'i okurken Ax-24'e, Saek'i okurken Yegim'e
   tıklayamıyordun. Bu dosya metinlerdeki bilinen adları otomatik bağlantıya çevirir. */

/* ==================== ÇAPRAZ BAĞLANTI ==================== */

let bagDizini = null;

/** Bilinen adları tek bir dizinde toplar: karakter, evren maddesi, yer, terim. */
function baglantiDizini() {
  if (bagDizini) { return bagDizini; }

  const d = [];

  (veri.karakterler || []).forEach(function (k) {
    const ilk = k.ad.split(" ")[0];
    if (ilk.length >= 4) { d.push({ ad: ilk, tur: "karakter", hedef: k.id }); }
  });

  (typeof tumHaritaYerleri === "function" ? tumHaritaYerleri() : []).forEach(function (y) {
    if (y.ad.length >= 4) { d.push({ ad: y.ad, tur: "yer", hedef: y.id }); }
  });

  (veri.sozluk || []).forEach(function (t) {
    if (t.terim.length >= 3) { d.push({ ad: t.terim, tur: "terim", hedef: t.terim }); }
  });

  /* uzun adlar önce eşleşsin: "Kyldo Zarın" > "Kyldo" */
  d.sort(function (a, b) { return b.ad.length - a.ad.length; });
  bagDizini = d;
  return d;
}

/** Bir metindeki bilinen adları tıklanabilir hâle getirir.
    Metin zaten kaçırılmış (escape) olarak gelir. */
function baglantiEkle(kacirilmisMetin, harictut) {
  if (typeof veri === "undefined" || !veri.karakterler) { return kacirilmisMetin; }

  let m = kacirilmisMetin;
  const kullanilan = {};

  baglantiDizini().forEach(function (o) {
    if (harictut && o.hedef === harictut) { return; }
    if (kullanilan[o.ad]) { return; }

    /* Türkçe ek alabilir: Yegim'de, Blero'ya, Tarı'nın */
    const kalip = new RegExp("(^|[\\s(>—,.])(" + o.ad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
                             ")(?=$|['\\s.,;:!?)—])", "u");
    if (!kalip.test(m)) { return; }

    kullanilan[o.ad] = true;
    m = m.replace(kalip, function (tam, on, ad) {
      return on + '<button class="ic-bag capraz" data-capraz="' + o.tur + ":" +
             kacir(o.hedef) + '">' + ad + "</button>";
    });
  });

  return m;
}

function caprazAc(veriDegeri) {
  const p = String(veriDegeri).split(":");
  const tur = p[0];
  const hedef = p.slice(1).join(":");

  if (tur === "karakter") {
    const i = (veri.karakterler || []).findIndex(function (k) { return k.id === hedef; });
    if (i !== -1) { karakterAc(i); }
    return;
  }

  if (tur === "yer") {
    const p2 = document.querySelector("#perde");
    if (p2) { p2.hidden = true; }
    bolumeGit("harita");
    const y = (typeof tumHaritaYerleri === "function" ? tumHaritaYerleri() : [])
      .find(function (x) { return x.id === hedef; });
    if (y) { eckaBildir(y.ad + " — " + (y.not || "")); }
    return;
  }

  if (tur === "terim") {
    const t = (veri.sozluk || []).find(function (x) { return x.terim === hedef; });
    if (t) { eckaBildir(t.terim + ": " + t.tanim); }
  }
}

/* ==================== AİLE AĞACI ====================
   Üç kuşak ve bir sessizlik. Kim Evrengezer, kim değil — ve kim bilmiyordu. */

const AILE = {
  kusaklar: [
    { ad: "Birinci kuşak", kisiler: [
      { ad: "Geceg Luyot", not: "Evrengezer. Kaçtı ve sakladı.", evrengezer: true, gizli: "kimlik" },
      { ad: "Afrı Bura", not: "Evlenince Afrı Luyot. Bilmiyordu.", bilmez: true } ] },

    { ad: "İkinci kuşak", kisiler: [
      { ad: "Yulkom Luyot", not: "Evrengezer. Taşı tükendi, gerçekten öldü.",
        evrengezer: true, gizli: "kimlik" },
      { ad: "Nudhal Sarı", not: "Sıradan Kyldo. Deneylerden altı yıl önce öldü.", bilmez: true },
      { ad: "Pıda Luyot", not: "Kaelan'ın babası. Bir kazada öldü." },
      { ad: "Ültö Sanu", not: "Kaelan'ın annesi. Aynı kazada." } ] },

    { ad: "Üçüncü kuşak", kisiler: [
      { ad: "Feil Luyot", not: "Beyaz. Melez Evrengezer.", renk: "beyaz", evrengezer: true },
      { ad: "Saek Luyot", not: "Kırmızı. Melez Evrengezer.", renk: "kirmizi", evrengezer: true },
      { ad: "Kaelan Luyot", not: "Siyah. Melez Evrengezer.", renk: "siyah", evrengezer: true },
      { ad: "Pileg", not: "Renksiz. Taşını bıraktı.", evrengezer: false, gizli: "kimlik" } ] },

    { ad: "Dördüncü kuşak", kisiler: [
      { ad: "İki çocuk", not: "Pileg'in çocukları. Melez Evrengezer; adları henüz yok.",
        gizli: "kimlik" } ] },
  ],
  not: "Feil ve Saek kardeştir. Kaelan ve Pileg kuzenleridir; kuzenlik baba tarafındandır."
};

function aileCiz() {
  const alan = document.querySelector("#aileAlan");
  if (!alan) { return; }

  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();

  alan.innerHTML =
    '<p class="oyun-giris">Üç kuşak, bir sessizlik. Bir adamın sakladığı şey torunlarının ' +
    "hayatını belirledi.</p>" +
    '<div class="aile">' +
      AILE.kusaklar.map(function (k) {
        return '<div class="aile-kusak">' +
                 '<div class="aile-etiket">' + kacir(k.ad) + "</div>" +
                 '<div class="aile-satir">' +
                   k.kisiler.map(function (p) {
                     const acik = yonetici || (katmanAcik(p.gizli) && spoilerUygun(p.gizli));
                     const sinif = "aile-kisi" +
                       (p.renk ? " r-" + p.renk : "") +
                       (p.evrengezer && acik ? " gezer" : "") +
                       (p.bilmez ? " bilmez" : "");

                     return '<div class="' + sinif + '">' +
                              '<span class="aile-ad">' + kacir(p.ad) + "</span>" +
                              '<span class="aile-not">' +
                                (acik ? kacir(p.not) : "— buz altında —") + "</span>" +
                            "</div>";
                   }).join("") +
                 "</div>" +
               "</div>";
      }).join("") +
    "</div>" +
    '<div class="aile-aciklama">' +
      '<span class="a-gezer">Evrengezer</span>' +
      '<span class="a-bilmez">bilmiyordu</span>' +
    "</div>" +
    '<p class="oyun-not">' + kacir(AILE.not) + "</p>";
}

/* ==================== KESİŞMELER ====================
   İki karakterin farkında olmadan aynı şeyi paylaştığı yerler. */

const KESISMELER = [
  { a: "tari", b: "kaelan", ne: "Geçiş Deresi",
    not: "İkisi de aynı derede huzur arar ve birbirlerinden habersizdir. Biri hayal kurmak " +

         "için gelir, diğeri pişmanlık için." },
  { a: "saek", b: "kyldozarin", ne: "Yegim",
    not: "Yıllarca aynı sokakları paylaştılar. Biri diğerini öldürmeye gidene kadar " +

         "birbirlerinin ne olduğunu bilmiyorlardı." },
  { a: "tari", b: "afor", ne: "Hayal kurma yeteneği",
    not: "Aynı yetenek, iki farklı sonuç. Fark, yanında birinin olmasıydı.", gizli: "son" },
  { a: "gize", b: "necale", ne: "Sıkılıp bırakmak",
    not: "Kütüphane iki görevlisini de aynı şekilde kaybetti: yenilgiyle değil, yorgunlukla." },
  { a: "kaelan", b: "dorduncu", ne: "Taşı bırakmak",
    not: "Biri bir buluşma için bıraktı, diğeri bir aile için. İkisi de meleklere gitti.",
    gizli: "kimlik" },
  { a: "l25", b: "yejen", ne: "Herkesini kaybetmek",
    not: "Biri oğlunu ve karısını, diğeri halkını ve eşini. İkisi de geriye yalnızca işle kaldı.",
    gizli: "kitap" },
];

function kesismeCiz() {
  const alan = document.querySelector("#kesismeAlan");
  if (!alan) { return; }

  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();
  const ad = function (id) {
    const k = (veri.karakterler || []).find(function (x) { return x.id === id; });
    return k ? k.ad : id;
  };

  alan.innerHTML =
    '<p class="oyun-giris">Bu evrende insanlar birbirine değmeden aynı şeyi yaşar. ' +
    "Kesişmeler tesadüf değil, tekrarın kendisidir.</p>" +
    '<div class="kesisme-liste">' +
      KESISMELER.map(function (k) {
        const acik = yonetici || (katmanAcik(k.gizli) && spoilerUygun(k.gizli));

        if (!acik) {
          return '<div class="kesisme kapali"><div class="kesisme-ne">— buz altında —</div></div>';
        }

        return '<div class="kesisme">' +
                 '<div class="kesisme-ne">' + kacir(k.ne) + "</div>" +
                 '<div class="kesisme-kim">' +
                   '<button class="ic-bag" data-capraz="karakter:' + kacir(k.a) + '">' +
                     kacir(ad(k.a)) + "</button>" +
                   "<span>·</span>" +
                   '<button class="ic-bag" data-capraz="karakter:' + kacir(k.b) + '">' +
                     kacir(ad(k.b)) + "</button>" +
                 "</div>" +
                 '<div class="kesisme-not">' + kacir(k.not) + "</div>" +
               "</div>";
      }).join("") +
    "</div>";
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const c = e.target.closest("[data-capraz]");
  if (c) { caprazAc(c.dataset.capraz); }
});

/** aileCiz() ve SVG bağ çizgilerini tek adımda çalıştırır.
    İki ayrı sistemde (başlangıç ve geç çizim) aynı isimle kayıtlı olduğundan
    tek fonksiyon kullanmak, birinin diğerinin SVG'sini silmesini önler. */
function aileCizTam() {
  aileCiz();
  if (typeof aileCizgileriCiz === "function") { setTimeout(aileCizgileriCiz, 30); }
}
