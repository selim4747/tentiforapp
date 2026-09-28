/* Araçlar — isim sistemi ve Tömye takvimi.
   İsim haritası belgedeki 8 kanon isminden türetildi; 7'si birebir tutuyor. */

/* ---------------- İSİM SİSTEMİ ---------------- */

const SES_CIFTI = {
  b: "p", p: "b", c: "ç", "ç": "c", d: "t", t: "d", g: "k", k: "g",
  v: "f", f: "v", z: "s", s: "z", j: "ş", "ş": "j",
  r: "l", l: "r", n: "m", m: "n",
  a: "e", e: "a", "ı": "i", i: "ı", o: "u", u: "o", "ö": "ü", "ü": "ö",
  y: "y", h: "h"
};

function harfCevir(metin, unluKoru) {
  const UNLU = "aeıioöuü";
  let cikti = "";

  for (const harf of String(metin).toLocaleLowerCase("tr")) {
    if (unluKoru && UNLU.indexOf(harf) !== -1) { cikti += harf; continue; }
    cikti += SES_CIFTI[harf] || harf;
  }

  return cikti;
}

function tersCevir(metin) {
  return Array.from(String(metin)).reverse().join("");
}

function basHarf(metin) {
  if (!metin) { return metin; }
  return metin.charAt(0).toLocaleUpperCase("tr") + metin.slice(1);
}

/** Bir kelimeden dört ayrı üretim yolu döner. */
function isimUret(kelime) {
  const k = String(kelime).trim().toLocaleLowerCase("tr");
  if (!k) { return []; }

  return [
    { yol: "harf çevirisi", sonuc: basHarf(harfCevir(k, false)),
      not: "Her harfin ses karşılığı. Tömye, Tarı, Yejen böyle üretildi." },
    { yol: "ters + harf", sonuc: basHarf(harfCevir(tersCevir(k), false)),
      not: "Önce kelime tersten okunur, sonra harfler çevrilir. Gırı böyle." },
    { yol: "harf, ünlüler korunur", sonuc: basHarf(harfCevir(k, true)),
      not: "Afor'daki esneklik. Kulağa daha yumuşak gelir." },
    { yol: "sadece ters", sonuc: basHarf(tersCevir(k)),
      not: "Şifresiz, en basit yol." }
  ];
}

/** Tentiforverse ismini Türkçeye geri çözer. Çevirim kendi tersidir. */
function isimCoz(isim) {
  const k = String(isim).trim().toLocaleLowerCase("tr");
  if (!k) { return []; }

  return [
    { yol: "harf çevirisi", sonuc: basHarf(harfCevir(k, false)) },
    { yol: "harf sonra ters", sonuc: basHarf(tersCevir(harfCevir(k, false))) },
    { yol: "sadece ters", sonuc: basHarf(tersCevir(k)) }
  ];
}

/** Kanonla çakışma var mı? */
function isimCakisiyor(aday) {
  const a = String(aday).toLocaleLowerCase("tr");
  const kanon = (veri.isimSozluk || []).map(function (s) { return s.isim.toLocaleLowerCase("tr"); })
    .concat((veri.sifresiz || []).map(function (s) { return s.toLocaleLowerCase("tr"); }))
    .concat((veri.karakterler || []).map(function (s) { return s.ad.toLocaleLowerCase("tr"); }));

  return kanon.indexOf(a) !== -1;
}

/* ---------------- TÖMYE TAKVİMİ ---------------- */

function takvimAyar() {
  return veri.takvim;
}

function tomyeYilGun() {
  return takvimAyar().aylar.reduce(function (t, a) { return t + a.gun; }, 0);
}

/** Dünya tarihinden Tömye tarihine. */
function dunyadanTomyeye(tarih) {
  const t = takvimAyar();
  const epok = new Date(t.epokDunya + "T00:00:00Z");
  const gecenSaat = (tarih.getTime() - epok.getTime()) / 3600000;

  if (gecenSaat < 0) { return null; }

  const toplamGun = Math.floor(gecenSaat / t.gunSaat);
  const saat = Math.floor(gecenSaat % t.gunSaat);
  const yilGun = tomyeYilGun();

  const yil = Math.floor(toplamGun / yilGun) + t.epokYil;
  let kalan = toplamGun % yilGun;

  let ayIndeks = 0;
  while (kalan >= t.aylar[ayIndeks].gun) {
    kalan -= t.aylar[ayIndeks].gun;
    ayIndeks++;
  }

  return {
    yil: yil,
    ay: t.aylar[ayIndeks].ad,
    ayKoken: t.aylar[ayIndeks].koken,
    ayNo: ayIndeks + 1,
    gun: kalan + 1,
    saat: saat,
    haftaGunu: t.gunler[toplamGun % t.gunler.length],
    toplamGun: toplamGun
  };
}

/** Tömye tarihinden Dünya tarihine. */
function tomyedenDunyaya(yil, ayNo, gun) {
  const t = takvimAyar();
  const yilGun = tomyeYilGun();

  let toplam = (yil - t.epokYil) * yilGun;
  for (let i = 0; i < ayNo - 1; i++) { toplam += t.aylar[i].gun; }
  toplam += gun - 1;

  const epok = new Date(t.epokDunya + "T00:00:00Z");
  return new Date(epok.getTime() + toplam * t.gunSaat * 3600000);
}

/** Dünya yaşını Tömye yaşına ve tersine çevirir. */
function yasCevir(deger, yon) {
  const t = takvimAyar();
  const tomyeYilSaat = tomyeYilGun() * t.gunSaat;
  const dunyaYilSaat = 365.2425 * 24;

  if (yon === "dunyadan") {
    return deger * dunyaYilSaat / tomyeYilSaat;
  }

  return deger * tomyeYilSaat / dunyaYilSaat;
}

function tomyeMetin(d) {
  if (!d) { return "—"; }
  return d.gun + " " + d.ay + " " + d.yil + " · " + d.haftaGunu + " · " +
         String(d.saat).padStart(2, "0") + ". saat";
}

/* ---------------- ARAÇ ARAYÜZÜ ---------------- */

let isimYon = "uret";   // "uret" = türkçe→tentifor, "coz" = tentifor→türkçe

function isimCiz() {
  const alan = document.querySelector("#isimAlan");
  if (!alan) { return; }

  const sozluk = (veri.isimSozluk || []).map(function (s) {
    return "<tr><td><b>" + kacir(s.isim) + "</b></td><td>" + kacir(s.koken) +
           "</td><td>" + kacir(s.anlam) + "</td></tr>";
  }).join("");

  alan.innerHTML =
    '<div class="arac-secim">' +
      '<button class="filtre-btn' + (isimYon === "uret" ? " secili" : "") +
        '" data-isim-yon="uret">Türkçe → Tentifor</button>' +
      '<button class="filtre-btn' + (isimYon === "coz" ? " secili" : "") +
        '" data-isim-yon="coz">Tentifor → Türkçe</button>' +
    "</div>" +

    '<input class="kod-giris arac-giris" id="isimGiris" autocomplete="off" spellcheck="false" ' +
      'placeholder="' + (isimYon === "uret" ? "kelime yaz (ör. çatlak)" : "isim yaz (ör. Tömye)") + '">' +
    '<button class="dugme" data-isim-calistir="1">Çevir</button>' +

    '<div id="isimSonuc"></div>' +

    '<div class="arac-blok">' +
      '<div class="oyun-etiket">Ses tablosu</div>' +
      '<div class="ses-tablo">' +
        '<div><b>b p</b> · <b>c ç</b> · <b>d t</b> · <b>g k</b> · <b>v f</b> · <b>z s</b> · <b>j ş</b></div>' +
        '<div><b>r l</b> · <b>n m</b></div>' +
        '<div><b>a e</b> · <b>ı i</b> · <b>o u</b> · <b>ö ü</b></div>' +
        '<div class="ses-not">y ve h değişmez</div>' +
      "</div>" +
    "</div>" +

    '<div class="arac-blok">' +
      '<div class="oyun-etiket">Kanon sözlüğü</div>' +
      '<table class="sozluk"><thead><tr><th>İsim</th><th>Kökeni</th><th>Anlam</th></tr></thead>' +
      "<tbody>" + sozluk + "</tbody></table>" +
    "</div>" +

    '<div class="arac-blok">' +
      '<div class="oyun-etiket">Ad önerici</div>' +
      '<p class="oyun-not">Belgende 11 ay adı ve 2 şehir adı boş. Bir anlam yaz, ' +
        "sisteme uygun adaylar çıksın.</p>" +
      '<div class="oyun-sira">' +
        '<button class="dugme dugme-sade" data-oner="ay">Ay adı</button>' +
        '<button class="dugme dugme-sade" data-oner="sehir">Şehir adı</button>' +
        '<button class="dugme dugme-sade" data-oner="karakter">Karakter adı</button>' +
      "</div>" +
      '<div id="oneriSonuc"></div>' +
    "</div>";
}

function isimCalistir() {
  const g = document.querySelector("#isimGiris");
  const kutu = document.querySelector("#isimSonuc");
  if (!g || !kutu) { return; }

  const kelime = g.value.trim();

  if (!kelime) {
    kutu.innerHTML = '<p class="oyun-not">Bir kelime yaz.</p>';
    return;
  }

  const sonuclar = isimYon === "uret" ? isimUret(kelime) : isimCoz(kelime);

  kutu.innerHTML = '<div class="isim-liste">' + sonuclar.map(function (s) {
    const cakisma = isimYon === "uret" && isimCakisiyor(s.sonuc);

    return '<div class="isim-satir">' +
             '<div class="isim-sonuc">' + kacir(s.sonuc) +
               (cakisma ? '<span class="isim-uyari">kanonda var</span>' : "") + "</div>" +
             '<div class="isim-yol">' + kacir(s.yol) + "</div>" +
             (s.not ? '<div class="isim-not">' + kacir(s.not) + "</div>" : "") +
           "</div>";
  }).join("") + "</div>";
}

const ONERI_TOHUM = {
  ay: ["kar", "buz", "don", "çatlak", "derin", "uzak", "ışık", "yıldız", "sabır",
       "gece", "hasat", "sessiz", "rüzgar", "şafak", "dönüş", "yanık", "kök"],
  sehir: ["liman", "kıyı", "geçit", "kule", "demir", "tuz", "köprü", "sur", "pazar",
          "çukur", "yamaç", "kavşak", "ocak"],
  karakter: ["umut", "korku", "sabır", "öfke", "sessizlik", "hatıra", "borç", "vaat",
             "gölge", "iz", "yara", "tanık", "kayıp", "başlangıç"]
};

function oneriUret(tur) {
  const kutu = document.querySelector("#oneriSonuc");
  if (!kutu) { return; }

  const tohum = ONERI_TOHUM[tur].slice();

  for (let i = tohum.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = tohum[i]; tohum[i] = tohum[j]; tohum[j] = t;
  }

  const secilen = tohum.slice(0, 6);

  kutu.innerHTML = '<div class="oneri-izgara">' + secilen.map(function (k) {
    const a = basHarf(harfCevir(k, false));
    const b = basHarf(harfCevir(tersCevir(k), false));
    const secim = isimCakisiyor(a) ? b : a;
    const diger = secim === a ? b : a;

    return '<div class="oneri-kart">' +
             '<div class="oneri-ad">' + kacir(secim) + "</div>" +
             '<div class="oneri-koken">' + kacir(k) + "</div>" +
             '<div class="oneri-alt">diğer yol: ' + kacir(diger) + "</div>" +
           "</div>";
  }).join("") + "</div>";
}

/* ---------------- TAKVİM ARAYÜZÜ ---------------- */

function takvimCiz() {
  const alan = document.querySelector("#takvimAlan");
  if (!alan) { return; }

  const t = takvimAyar();
  const simdi = dunyadanTomyeye(new Date());

  const aylar = t.aylar.map(function (a, i) {
    return '<div class="ay-kart"><span class="ay-no">' + (i + 1) + "</span>" +
           '<span class="ay-ad">' + kacir(a.ad) + "</span>" +
           '<span class="ay-koken">' + kacir(a.koken) + " · " + a.gun + " gün</span></div>";
  }).join("");

  alan.innerHTML =
    '<div class="takvim-bugun">' +
      '<div class="oyun-etiket">Tömye\'de şu an</div>' +
      '<div class="takvim-buyuk">' + kacir(tomyeMetin(simdi)) + "</div>" +
      '<div class="saat" id="tomyeSaat">—</div>' +
      '<div class="saat-cubuk"><span id="saatOran"></span></div>' +
      '<div class="oyun-not">Gün 25 saat. Çubuk günün ne kadarının geçtiğini gösterir.</div>' +
    "</div>" +

    '<div class="arac-blok">' +
      '<div class="oyun-etiket">Dünya tarihi → Tömye</div>' +
      '<input type="date" class="kod-giris arac-giris" id="tarihGiris" aria-label="Dünya tarihi" value="' +
        new Date().toISOString().slice(0, 10) + '">' +
      '<button class="dugme" data-takvim="cevir">Çevir</button>' +
      '<div id="tarihSonuc"></div>' +
    "</div>" +

    '<div class="arac-blok">' +
      '<div class="oyun-etiket">Yaş çevirici</div>' +
      '<input class="kod-giris arac-giris" id="yasGiris" inputmode="numeric" placeholder="yaş">' +
      '<div class="oyun-sira">' +
        '<button class="dugme dugme-sade" data-yas="dunyadan">Dünya → Tömye</button>' +
        '<button class="dugme dugme-sade" data-yas="tomyeden">Tömye → Dünya</button>' +
      "</div>" +
      '<div id="yasSonuc"></div>' +
    "</div>" +

    '<div class="arac-blok">' +
      '<div class="oyun-etiket">Yapı</div>' +
      '<div class="takvim-ozet">' +
        "<span>gün <b>" + t.gunSaat + " saat</b></span>" +
        "<span>yıl <b>" + tomyeYilGun() + " gün</b></span>" +
        "<span>hafta <b>" + t.haftaGun + " gün</b></span>" +
        "<span>ay <b>" + t.aylar.length + "</b></span>" +
      "</div>" +
      '<div class="gun-serit">' + t.gunler.map(function (g) {
        return "<span>" + kacir(g) + "</span>";
      }).join("") + "</div>" +
      '<div class="ay-izgara">' + aylar + "</div>" +
      '<p class="oyun-not">' + kacir(t.not) + "</p>" +
    "</div>";

  if (typeof saatiBaslat === "function") { saatiBaslat(); }
}

function takvimCevir() {
  const g = document.querySelector("#tarihGiris");
  const kutu = document.querySelector("#tarihSonuc");
  if (!g || !kutu) { return; }

  const d = new Date(g.value + "T12:00:00Z");

  if (isNaN(d.getTime())) {
    kutu.innerHTML = '<p class="oyun-not">Geçerli bir tarih seç.</p>';
    return;
  }

  const s = dunyadanTomyeye(d);

  kutu.innerHTML = s
    ? '<div class="takvim-sonuc">' + kacir(tomyeMetin(s)) +
      '<span class="takvim-detay">başlangıçtan bu yana ' + s.toplamGun + " Tömye günü</span></div>"
    : '<p class="oyun-not">Bu tarih takvimin başlangıcından önce.</p>';
}

function yasCevirGoster(yon) {
  const g = document.querySelector("#yasGiris");
  const kutu = document.querySelector("#yasSonuc");
  if (!g || !kutu) { return; }

  const deger = parseFloat(g.value);

  if (isNaN(deger) || deger < 0) {
    kutu.innerHTML = '<p class="oyun-not">Bir sayı yaz.</p>';
    return;
  }

  const sonuc = yasCevir(deger, yon);
  const etiket = yon === "dunyadan" ? "Tömye yılı" : "Dünya yılı";

  kutu.innerHTML = '<div class="takvim-sonuc">' + sonuc.toFixed(1) + " " + etiket +
    '<span class="takvim-detay">Kyldo ortalama ömrü 250 Tömye yılı ≈ 220 Dünya yılı</span></div>';
}

/* ---------------- olaylar ---------------- */

document.addEventListener("click", function (e) {
  const yon = e.target.closest("[data-isim-yon]");
  if (yon) { isimYon = yon.dataset.isimYon; isimCiz(); return; }

  if (e.target.closest("[data-isim-calistir]")) { isimCalistir(); return; }

  const oner = e.target.closest("[data-oner]");
  if (oner) { oneriUret(oner.dataset.oner); return; }

  if (e.target.closest("[data-takvim]")) { takvimCevir(); return; }

  const yas = e.target.closest("[data-yas]");
  if (yas) { yasCevirGoster(yas.dataset.yas); }
});

document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter") { return; }
  const a = document.activeElement;
  if (!a) { return; }
  if (a.id === "isimGiris") { isimCalistir(); }
  if (a.id === "yasGiris") { yasCevirGoster("dunyadan"); }
});
