/* Yönetici modu.

   Statik sitede dosya yazılamaz. Bu panel değişiklikleri tarayıcıda yapar ve
   sonucu dışa aktarır; sen GitHub'a yapıştırırsın.

   Yönetici kodu dosyada düz metin DURMAZ, yalnızca SHA-256 özeti durur.
   Gizli bloklar düz metin durur; panel açıkken her şey okunabilir ve düzenlenebilir. */

const YONETICI_ANAHTAR = "tentiforapp_yonetici";

let yoneticiKod = null;      // oturum boyunca bellekte
/* İkinci (sınırlı) yönetici kodu: panel açılır ama buz katmanları ve gizli bloklar kilitli kalır;
   kişi onları oynayarak açar. Kod hiçbir şeyin şifresini çözmez; yalnızca özeti veride durur. */
let yoneticiSinirli = false;
const SINIRLI_SEKMELER = ["roman", "basin", "listeler",
  "hizli", "yapimEkle", "olayEkle", "hikayeEkle", "gorselEkle", "sesEkle",
  "denetim", "istatistik", "liderlik", "teoriler", "hatalar", "test", "kaydet"];
let yoneticiSekme = "karakterler";
let yoneticiSecili = null;
let yoneticiBlokIndeksi = null;   /* null: kapalı, sayı: o bloğu düzenliyor, "yeni": yeni blok ekliyor */

function yoneticiAcik() {
  return yoneticiKod !== null;
}

/** Panel açık mı (tam ya da sınırlı yönetici). Kilit aşan her şey yoneticiAcik()'e bakar. */
function panelAcik() {
  return yoneticiAcik() || yoneticiSinirli;
}

function sinirliKodMu(kod) {
  return !!(veri && veri.sinirliYoneticiOzet && dogrulamaOzeti(String(kod || "").trim()) === veri.sinirliYoneticiOzet);
}

function yoneticiHatirla() {
  githubYukle();
  const ham = kayitOku(YONETICI_ANAHTAR);
  if (!ham) { return; }
  if (veri && veri.yoneticiOzet && dogrulamaOzeti(ham) === veri.yoneticiOzet) {
    yoneticiKod = ham;
  } else if (sinirliKodMu(ham)) {
    yoneticiSinirli = true;
  }
}

/** Gizli bloğun metnini yönetici oturumu açıkken verir (metin düz durur; kilit arayüzdedir). */
function yoneticiCoz(g) {
  if (!yoneticiAcik() || !g || g.metin === undefined) { return null; }
  return g.metin;
}

/** Bir kaydın TÜM kilitli bloklarını (dizi) yönetici koduyla çözüp birleştirir.
    Denetim araçları (çelişki avcısı, alıntı toplayıcı) tek bloklu içerikle
    çoklu bloklu içeriği aynı şekilde tarayabilsin diye. */
function yoneticiCozTumu(dizi) {
  if (!dizi || !dizi.length) { return ""; }
  return dizi.map(function (g) { return yoneticiCoz(g) || ""; }).join(" ");
}

/** Bir kaydın kilitli bloklarından en az biri açılmış mı? */
function herhangiBirAcik(dizi) {
  if (!dizi || !dizi.length) { return false; }
  return dizi.some(function (g) { return !!cozulenler[g.dogrulama]; });
}

/** Bir kaydın kilidi yoksa ya da TÜM blokları açılmışsa true döner. */
function hepsiAcikMi(dizi) {
  if (!dizi || !dizi.length) { return true; }
  return dizi.every(function (g) { return !!cozulenler[g.dogrulama]; });
}

function yoneticiGiris(kod) {
  const temiz = String(kod).trim();

  if (sinirliKodMu(temiz)) {
    yoneticiKod = null;
    yoneticiSinirli = true;
    kayitYaz(YONETICI_ANAHTAR, temiz);
    return "sinirli";
  }

  if (!veri.yoneticiOzet || dogrulamaOzeti(temiz) !== veri.yoneticiOzet) {
    return false;
  }

  yoneticiKod = temiz;
  yoneticiSinirli = false;
  kayitYaz(YONETICI_ANAHTAR, temiz);
  return true;
}

function yoneticiCikis() {
  if (typeof ustaTemizle === "function") { ustaTemizle(); }
  yoneticiKod = null;
  yoneticiSinirli = false;
  if (typeof kanonSifirla === "function") { kanonSifirla(); }
  kayitYaz(YONETICI_ANAHTAR, "");
  yoneticiCiz();
  arsiviTazele();
}

/* ---------- katman yardımcıları ---------- */

function katmanListesi() {
  return veri.katmanlar || [];
}

function katmanBul(id) {
  return katmanListesi().find(function (k) { return k.id === id; });
}

/** Yönetici oturumundaki katman kodlarını tutar (yalnızca bu cihazda). */
const KATMAN_ANAHTAR = "tentiforapp_katman_kodlari";
let katmanKodlari = {};

function katmanKodlariYukle() {
  const ham = kayitOku(KATMAN_ANAHTAR);
  if (!ham) { return; }
  try { katmanKodlari = JSON.parse(ham) || {}; } catch (e) { katmanKodlari = {}; }
}

function katmanKoduKaydet(id, kod) {
  const k = katmanBul(id);
  if (!k || dogrulamaOzeti(kod) !== k.dogrulama) { return false; }

  katmanKodlari[id] = kod;
  kayitYaz(KATMAN_ANAHTAR, JSON.stringify(katmanKodlari));
  return true;
}

/* ---------- düzenleme ---------- */

function yoneticiKayitlar() {
  return yoneticiSekme === "karakterler" ? veri.karakterler : veri.evren;
}

function yoneticiKaydet() {
  const liste = yoneticiKayitlar();
  const o = liste[yoneticiSecili];
  const karakterMi = yoneticiSekme === "karakterler";

  const ad = document.querySelector("#yAd").value.trim();
  const alt = document.querySelector("#yAlt").value.trim();
  const ozet = document.querySelector("#yOzet").value.trim();
  const metin = document.querySelector("#yMetin").value;

  if (!ad) { yoneticiDurum("Ad boş olamaz", false); return; }

  if (karakterMi) { o.ad = ad; o.unvan = alt; o.grup = o.grup || "Diğer"; }
  else { o.baslik = ad; o.bolum = alt; }

  o.ozet = ozet;
  if (karakterMi) { o.detay = metin; } else { o.metin = metin; }
  /* hangi evrende görünür: boş ya da yalnızca "tomye" ise alan hiç yazılmaz */
  const ev = document.querySelector("#yEvrenler");
  if (ev) {
    const l = ev.value.toLocaleLowerCase("tr").split(/[,\s]+/).map(function (x) { return x.replace(/[^a-z0-9]/g, ""); })
      .filter(function (x, i, d) { return x && d.indexOf(x) === i; });
    if (!l.length || (l.length === 1 && l[0] === "tomye")) { delete o.evrenler; } else { o.evrenler = l; }
  }

  yoneticiDurum("Ana metin kaydedildi", true);
  arsiviTazele();
  yoneticiCiz();
}

/** Yeni bir kilitli blok editörünü açar (boş). */
function yoneticiBlokYeni() {
  yoneticiBlokIndeksi = "yeni";
  yoneticiCiz();
}

/** Var olan bir bloğu düzenlemek için editörü açar, çözülmüş metni doldurur. */
function yoneticiBlokDuzenle(indeks) {
  yoneticiBlokIndeksi = indeks;
  yoneticiCiz();
}

function yoneticiBlokIptal() {
  yoneticiBlokIndeksi = null;
  yoneticiCiz();
}

/** Editördeki bloğu kaydeder — yeniyse diziye ekler, mevcutsa
    aynı indekste değiştirir. Aynı konu içinde birden fazla katmana bağlı
    blok bulunabilir; her biri bağımsız açılır. */
function yoneticiBlokKaydet() {
  const liste = yoneticiKayitlar();
  const o = liste[yoneticiSecili];

  const katmanId = document.querySelector("#yBlokKatman").value;
  const baslik = document.querySelector("#yBlokBaslik").value.trim();
  const metin = document.querySelector("#yBlokMetin").value;

  if (!baslik || !metin.trim()) {
    yoneticiDurum("Bloğun başlığı ve metni gerekli", false);
    return;
  }

  const k = katmanBul(katmanId);
  const blok = {
    katman: katmanId,
    katmanAd: k.ad,
    baslik: baslik,
    dogrulama: k.dogrulama,
    metin: metin,
  };

  if (!o.gizli) { o.gizli = []; }

  if (yoneticiBlokIndeksi === "yeni") { o.gizli.push(blok); }
  else { o.gizli[yoneticiBlokIndeksi] = blok; }

  yoneticiBlokIndeksi = null;
  yoneticiDurum("Blok kaydedildi", true);
  arsiviTazele();
  yoneticiCiz();
}

function yoneticiBlokSil(indeks) {
  const liste = yoneticiKayitlar();
  const o = liste[yoneticiSecili];
  if (!o.gizli) { return; }

  o.gizli.splice(indeks, 1);
  if (!o.gizli.length) { o.gizli = null; }

  yoneticiDurum("Blok silindi", true);
  arsiviTazele();
  yoneticiCiz();
}

function yoneticiDurum(mesaj, iyi) {
  const el = document.querySelector("#yDurum");
  if (!el) { return; }
  el.textContent = mesaj;
  el.className = "pencere-durum " + (iyi ? "iyi" : "kotu");
}

function yoneticiDisaAktar() {
  const metin = JSON.stringify(veri, null, 2);

  panoyaKopyala(metin).then(function () {
    yoneticiDurum("veri.json panoya kopyalandı", true);
  }).catch(function () {
    const blob = new Blob([metin], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "veri.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    yoneticiDurum("veri.json indirildi", true);
  });
}

/* ---------- çizim ---------- */

/* Dokuz sekme bir şeritte sığmıyordu; iki gruba ayrıldı. */
const Y_GRUPLARI = {
  icerik: { ad: "İçerik", sekmeler: ["karakterler", "evren", "roman", "haritaDuzen", "yollar", "kisiler", "basin", "listeler", "anahtarlar", "bosluklar"] },
  ekle:   { ad: "Ekle",   sekmeler: ["hizli", "yapimEkle", "olayEkle", "hikayeEkle", "gorselEkle", "sesEkle", "dosyaEkle"] },
  bakim:  { ad: "Bakım",  sekmeler: ["denetim", "istatistik", "liderlik", "teoriler", "hatalar", "kurulum", "bildirim", "e99", "evrengezer", "tekkod", "yayinla", "yedek", "yayilma", "araclar", "test", "kaydet"] },
};

let yoneticiGrup = "icerik";

function yoneticiSekmeleri(grup) {
  const l = Y_GRUPLARI[grup || yoneticiGrup].sekmeler;
  return yoneticiAcik() ? l : l.filter(function (s) { return SINIRLI_SEKMELER.indexOf(s) !== -1; });
}

function yoneticiCiz() {
  const alan = document.querySelector("#yoneticiAlan");
  if (!alan) { return; }

  if (!panelAcik()) {
    alan.innerHTML =
      '<p class="oyun-giris">Bu bölüm siteyi yöneten kişi içindir. ' +
      "İçeriği canlı düzenler, kilitleri değiştirir ve sonucu dışa aktarır.</p>" +
      '<input class="kod-giris arac-giris" id="yGiris" type="password" ' +
        'placeholder="yönetici kodu" autocomplete="off">' +
      '<button class="dugme" data-yonetici="giris">Gir</button>' +
      '<p class="pencere-durum" id="yDurum"></p>';
    return;
  }

  /* sınırlı yönetici izinli olmayan sekmede kalmasın */
  if (!yoneticiAcik()) {
    if (!yoneticiSekmeleri().length) { yoneticiGrup = "icerik"; }
    if (yoneticiSekmeleri().indexOf(yoneticiSekme) === -1) { yoneticiSekme = yoneticiSekmeleri()[0]; }
  }

  const sekmeler =
    '<div class="filtre y-grup-secici">' +
      Object.keys(Y_GRUPLARI).filter(function (g) { return yoneticiSekmeleri(g).length; }).map(function (g) {
        return '<button class="filtre-btn' + (yoneticiGrup === g ? " secili" : "") +
               '" data-y-grup="' + g + '">' + kacir(Y_GRUPLARI[g].ad) + "</button>";
      }).join("") +
    "</div>" +
    '<div class="oyun-sekme">' +
      yoneticiSekmeleri().map(function (s) {
        const ad = { karakterler: "Karakterler", evren: "Evren", hizli: "Hızlı Karakter",
                     yapimEkle: "Yapım Ekle", haritaDuzen: "Evren / Harita", yollar: "Yollar", kisiler: "Kişiler",
                     olayEkle: "Olay Ekle", hikayeEkle: "Hikâye Ekle", gorselEkle: "Görsel Ekle",
                     dosyaEkle: "Kilitli Dosya Ekle", roman: "Roman", sesEkle: "Ses Ekle", basin: "Basın Kiti", liderlik: "Liderlik",
                     listeler: "Listeler", istatistik: "İstatistik", teoriler: "Teoriler", hatalar: "Hatalar", bildirim: "Bildirim", kurulum: "Kurulum", e99: "E99 katkıları", evrengezer: "Evrengezer", tekkod: "Tek kodlar", yayinla: "Yayınla", yedek: "Yedek",
                     anahtarlar: "Anahtarlar", bosluklar: "Boşluklar",
                     denetim: "Denetim", yayilma: "Yayılma", araclar: "Araçlar",
                     test: "Test", kaydet: "Kaydet" }[s];
        return '<button data-y-sekme="' + s + '"' +
               (yoneticiSekme === s ? ' class="secili"' : "") + ">" + ad + "</button>";
      }).join("") +
    "</div>";

  let govde = "";

  if (yoneticiSekme === "kaydet") { govde = yoneticiGithub(); }
  else if (yoneticiSekme === "denetim") { govde = denetimCiz(); }
  else if (yoneticiSekme === "yayilma") { govde = yayilmaCiz(); }
  else if (yoneticiSekme === "araclar") { govde = yoneticiAraclar(); }
  else if (yoneticiSekme === "test") { govde = yoneticiTest(); }
  else if (yoneticiSekme === "anahtarlar") { govde = yoneticiAnahtarlar(); }
  else if (yoneticiSekme === "bosluklar") { govde = yoneticiBosluklar(); }
  else if (yoneticiSekme === "hizli") { govde = yoneticiHizliKarakter(); }
  else if (yoneticiSekme === "yapimEkle") { govde = yoneticiYapimEkle(); }
  else if (yoneticiSekme === "haritaDuzen") { govde = yoneticiHaritaDuzen(); }
  else if (yoneticiSekme === "yollar") { govde = yoneticiYollar(); }
  else if (yoneticiSekme === "kisiler") { govde = yoneticiKisiler(); }
  else if (yoneticiSekme === "olayEkle") { govde = yoneticiOlayEkle(); }
  else if (yoneticiSekme === "hikayeEkle") { govde = yoneticiHikayeEkle(); }
  else if (yoneticiSekme === "gorselEkle") { govde = yoneticiGorselEkle(); }
  else if (yoneticiSekme === "dosyaEkle") { govde = yoneticiDosyaEkle(); }
  else if (yoneticiSekme === "roman") { govde = yoneticiRoman(); }
  else if (yoneticiSekme === "sesEkle") { govde = yoneticiSesEkle(); }
  else if (yoneticiSekme === "basin") { govde = yoneticiBasin(); }
  else if (yoneticiSekme === "liderlik") { govde = yoneticiLiderlik(); }
  else if (yoneticiSekme === "listeler") { govde = yoneticiListeler(); }
  else if (yoneticiSekme === "istatistik") { govde = yoneticiIstatistik(); }
  else if (yoneticiSekme === "teoriler") { govde = yoneticiTeoriler(); }
  else if (yoneticiSekme === "hatalar") { govde = yoneticiHatalar(); }
  else if (yoneticiSekme === "yedek") { govde = yoneticiYedek(); }
  else if (yoneticiSekme === "bildirim") { govde = yoneticiBildirim(); }
  else if (yoneticiSekme === "kurulum") { govde = yoneticiKurulum(); }
  else if (yoneticiSekme === "e99") { govde = yoneticiE99(); }
  else if (yoneticiSekme === "yayinla") { govde = yoneticiYayinla(); }
  else if (yoneticiSekme === "evrengezer") { govde = yoneticiEvrengezer(); }
  else if (yoneticiSekme === "tekkod") { govde = typeof yoneticiTekKodlar === "function" ? yoneticiTekKodlar() : ""; }
  else if (yoneticiSecili === null) { govde = yoneticiListe(); }
  else { govde = yoneticiForm(); }

  alan.innerHTML =
    '<div class="y-ust">' +
      '<span class="y-rozet">' + (yoneticiAcik() ? "yönetici" : "sınırlı yönetici") + "</span>" +
      (yoneticiAcik() ? '<button class="dugme dugme-sade y-kucuk" data-duzenleme="ac">' +
        ((typeof duzenlemeAcikMi === "function" && duzenlemeAcikMi())
          ? "Düzenleme açık" : "Yerinde düzenle") + "</button>" : "") +
      '<button class="dugme dugme-sade y-kucuk" data-yonetici="cikis">Çık</button>' +
    "</div>" +
    sekmeler + govde +
    '<p class="pencere-durum" id="yDurum"></p>' +
    (yoneticiSekme === "kaydet" ? "" :
      '<button class="dugme dugme-sade" data-yonetici="aktar">veri.json dışa aktar</button>' +
      '<p class="oyun-not">Otomatik kaydetmek için <b>Kaydet</b> sekmesini kullan. ' +
        "Bu düğme elle yapıştırmak içindir.</p>");
}

function yoneticiListe() {
  const liste = yoneticiKayitlar();
  const karakterMi = yoneticiSekme === "karakterler";

  return '<div class="y-liste">' + liste.map(function (o, i) {
    const ad = karakterMi ? o.ad : o.baslik;
    const alt = karakterMi ? o.unvan : o.bolum;
    const rozet = (o.gizli && o.gizli.length)
      ? '<span class="y-kilit">' +
          (o.gizli.length > 1 ? o.gizli.length + " kilitli blok" : kacir(o.gizli[0].katmanAd)) +
        "</span>"
      : '<span class="y-acik">açık</span>';

    return '<button class="y-satir" data-y-ac="' + i + '">' +
             '<span class="y-satir-govde">' +
               '<span class="y-satir-ad">' + kacir(ad) + "</span>" +
               '<span class="y-satir-alt">' + kacir(alt) + "</span>" +
             "</span>" + rozet +
           "</button>";
  }).join("") + "</div>";
}

function yoneticiForm() {
  const liste = yoneticiKayitlar();
  const o = liste[yoneticiSecili];
  const karakterMi = yoneticiSekme === "karakterler";
  const bloklar = o.gizli || [];

  return '<button class="dugme dugme-sade" data-y-geri="1">← Listeye dön</button>' +
    '<div class="kutu-y">' +
      "<label>" + (karakterMi ? "Ad" : "Başlık") + "</label>" +
      '<input class="kod-giris arac-giris" id="yAd" value="' +
        kacir(karakterMi ? o.ad : o.baslik) + '">' +
      "<label>" + (karakterMi ? "Unvan" : "Bölüm") + "</label>" +
      '<input class="kod-giris arac-giris" id="yAlt" value="' +
        kacir(karakterMi ? o.unvan : o.bolum) + '">' +
      "<label>Özet</label>" +
      '<textarea class="kod-giris arac-giris" id="yOzet" rows="2">' + kacir(o.ozet) + "</textarea>" +
      '<label for="yEvrenler">Hangi evrende (virgülle: tomye, e25, e26…)</label>' +
      '<input class="kod-giris arac-giris" id="yEvrenler" value="' + kacir((Array.isArray(o.evrenler) && o.evrenler.length ? o.evrenler : ["tomye"]).join(", ")) + '">' +
      "<label>Açık metin</label>" +
      '<textarea class="kod-giris arac-giris" id="yMetin" rows="10">' +
        kacir(karakterMi ? o.detay : o.metin) + "</textarea>" +
      '<button class="dugme" data-yonetici="kaydet">Ana metni kaydet</button>' +
    "</div>" +

    (karakterMi ? yoneticiOzelliklerBlogu(o) : "") +
    (karakterMi ? yoneticiIliskilerBlogu(o) : "") +

    yoneticiBloklarCiz(bloklar) +

    '<div class="kutu-y">' +
      '<button class="dugme dugme-sade y-sil" data-y-kayit-sil="1">' +
        (yoneticiKayitSilOnay === o.id ? "Emin misin? Tekrar bas" : (karakterMi ? "Karakteri sil" : "Evren maddesini sil")) +
      "</button>" +
    "</div>";
}

/** Bir karakterin yapılandırılmış özelliklerini (yaş, meslek, boy, aile,
    hikâyedeki rolü, yaşadığı şehir) düzenlemeyi sağlar. Daha önce bunlar
    yalnızca Hızlı Karakter'de OLUŞTURMA anında girilebiliyordu; sonradan
    değiştirmenin hiçbir yolu yoktu. */
function yoneticiOzelliklerBlogu(karakter) {
  const o = karakter.ozellikler || {};
  const METIN_ALANLAR = [
    { id: "yas", ad: "Yaş" }, { id: "soyad", ad: "Soyad" }, { id: "meslek", ad: "Meslek" },
    { id: "boy", ad: "Boy" }, { id: "aile", ad: "Aile" }, { id: "hikayedeRol", ad: "Hikâyedeki rolü" },
  ];

  const tumSehirler = (typeof tumHaritaYerleri === "function" ? tumHaritaYerleri() : [])
    .filter(function (y) { return y.tur === "Şehir"; });
  const sehirSecenek = '<option value="">— seçilmedi —</option>' +
    tumSehirler.map(function (y) {
      const g = typeof yerGorunenAd === "function" ? yerGorunenAd(y) : y.ad;
      return '<option value="' + kacir(g) + '"' + (g === o.sehir ? " selected" : "") + ">" + kacir(g) + "</option>";
    }).join("");

  return '<div class="kutu-y">' +
      "<label>Özellikler</label>" +
      METIN_ALANLAR.map(function (a) {
        return "<label>" + kacir(a.ad) + "</label>" +
               '<input class="kod-giris arac-giris" id="yOzellik_' + a.id + '" value="' + kacir(o[a.id] || "") + '">';
      }).join("") +
      "<label>Yaşadığı şehir</label>" +
      '<select class="kod-giris arac-giris" id="yOzellikSehir">' + sehirSecenek + "</select>" +
      '<button class="dugme dugme-sade" data-y-ozellik-kaydet="1">Özellikleri kaydet</button>' +
    "</div>";
}

function yoneticiOzelliklerKaydet() {
  const liste = yoneticiKayitlar();
  const karakter = liste[yoneticiSecili];
  const alanlar = ["yas", "soyad", "meslek", "boy", "aile", "hikayedeRol"];

  const yeniOzellikler = {};
  alanlar.forEach(function (id) {
    const el = document.querySelector("#yOzellik_" + id);
    if (el && el.value.trim()) { yeniOzellikler[id] = el.value.trim(); }
  });
  const sehir = (document.querySelector("#yOzellikSehir") || {}).value || "";
  if (sehir) { yeniOzellikler.sehir = sehir; }

  karakter.ozellikler = Object.keys(yeniOzellikler).length ? yeniOzellikler : undefined;
  yoneticiDurum("Özellikler güncellendi", true);
  arsiviTazele();
  if (typeof haritaCiz === "function") { haritaCiz(); }
  yoneticiCiz();
}

let yoneticiKayitSilOnay = null;   /* silme onayi bekleyen kaydin id'si */

/** Karakter ya da evren maddesini siler. Karakterse ilişki ağı, olaylar ve
    kısa hikâyelerdeki referansları da temizler — kopuk referans kalmasın. */
function yoneticiKayitSil() {
  const liste = yoneticiKayitlar();
  const o = liste[yoneticiSecili];
  const karakterMi = yoneticiSekme === "karakterler";
  if (!o) { return; }

  if (yoneticiKayitSilOnay !== o.id) {
    yoneticiKayitSilOnay = o.id;
    yoneticiCiz();
    return;
  }

  const id = o.id;
  const ad = karakterMi ? o.ad : o.baslik;

  if (karakterMi) {
    veri.karakterler = veri.karakterler.filter(function (k) { return k.id !== id; });
    if (veri.ag) {
      veri.ag.dugumler = (veri.ag.dugumler || []).filter(function (d) { return d.id !== id; });
      veri.ag.baglar = (veri.ag.baglar || []).filter(function (b) { return b.a !== id && b.b !== id; });
    }
    (veri.anlatiOlaylari || []).forEach(function (olay) {
      olay.kisiler = (olay.kisiler || []).filter(function (k) { return k !== id; });
    });
    (veri.kisaHikayeler || []).forEach(function (hk) {
      hk.karakterler = (hk.karakterler || []).filter(function (k) { return k !== id; });
    });
  } else {
    veri.evren = veri.evren.filter(function (e) { return e.id !== id; });
  }

  yoneticiSecili = null;
  yoneticiKayitSilOnay = null;
  yoneticiDurum("\"" + ad + "\" silindi", true);
  arsiviTazele();
  yoneticiCiz();
}

/** Bir karakterin ilişki ağındaki bağlarını listeler, silinebilir yapar ve
    yeni bir bağ eklemeyi sağlar. Daha önce bu tamamen elle, kaynak koduna
    yazılıyordu — panelden hiç eklenemiyordu. */
function yoneticiIliskilerBlogu(karakter) {
  if (!veri.ag) { veri.ag = { dugumler: [], baglar: [] }; }
  const tumBaglar = veri.ag.baglar || [];
  const ilgiliBaglar = [];
  tumBaglar.forEach(function (b, i) {
    if (b.a === karakter.id || b.b === karakter.id) { ilgiliBaglar.push({ bag: b, indeks: i }); }
  });

  const digerKarakterler = (veri.karakterler || []).filter(function (k) { return k.id !== karakter.id; });

  const listeHtml = ilgiliBaglar.length
    ? '<div class="y-blok-liste">' +
        ilgiliBaglar.map(function (item) {
          const b = item.bag;
          const otekiId = b.a === karakter.id ? b.b : b.a;
          const oteki = (veri.karakterler || []).find(function (k) { return k.id === otekiId; });
          return '<div class="y-blok-satir">' +
                   '<span class="y-blok-baslik">' + kacir(oteki ? oteki.ad : otekiId) + "</span>" +
                   '<span class="y-blok-katman">' + kacir(b.etiket) + (b.gizli ? " · gizli" : "") + "</span>" +
                   '<button class="dugme dugme-sade y-sil" data-y-bag-sil="' + item.indeks + '">sil</button>' +
                 "</div>";
        }).join("") +
      "</div>"
    : '<p class="oyun-not">Henüz ilişki eklenmedi.</p>';

  const karakterSecenek = digerKarakterler.map(function (k) {
    return '<option value="' + kacir(k.id) + '">' + kacir(k.ad) + "</option>";
  }).join("");

  return '<div class="kutu-y">' +
      "<label>İlişkiler</label>" +
      listeHtml +
      (digerKarakterler.length
        ? "<label>Yeni ilişki ekle</label>" +
          '<select class="kod-giris arac-giris" id="yBagHedef">' + karakterSecenek + "</select>" +
          '<input class="kod-giris arac-giris" id="yBagEtiket" placeholder="ör. kuzeni, arkadaşı, düşmanı">' +
          '<label class="y-alan-secim"><input type="checkbox" id="yBagGizli"> Gizli (spoiler) bağ</label>' +
          '<button class="dugme dugme-sade" data-y-bag-ekle="1">İlişki ekle</button>'
        : "") +
    "</div>";
}

/** Bir karakterin ag.dugumler içinde karşılığı yoksa oluşturur. */
function agDugumSagla(karakter) {
  if (!veri.ag) { veri.ag = { dugumler: [], baglar: [] }; }
  if (!veri.ag.dugumler) { veri.ag.dugumler = []; }
  const mevcut = veri.ag.dugumler.find(function (d) { return d.id === karakter.id; });
  if (mevcut) { return mevcut; }
  const yeni = { id: karakter.id, ad: karakter.ad, grup: karakter.grup || "Diğer" };
  veri.ag.dugumler.push(yeni);
  return yeni;
}

function yoneticiBagEkle() {
  const liste = yoneticiKayitlar();
  const karakter = liste[yoneticiSecili];
  const hedefId = (document.querySelector("#yBagHedef") || {}).value || "";
  const etiket = ((document.querySelector("#yBagEtiket") || {}).value || "").trim();
  const gizli = (document.querySelector("#yBagGizli") || {}).checked;

  const hedef = (veri.karakterler || []).find(function (k) { return k.id === hedefId; });
  if (!hedef) { yoneticiDurum("Hedef karakter bulunamadı", false); return; }
  if (!etiket) { yoneticiDurum("İlişki etiketi gerekli", false); return; }

  agDugumSagla(karakter);
  agDugumSagla(hedef);
  if (!veri.ag.baglar) { veri.ag.baglar = []; }
  const bag = { a: karakter.id, b: hedef.id, etiket: etiket };
  if (gizli) { bag.gizli = true; }
  veri.ag.baglar.push(bag);

  yoneticiDurum("\"" + hedef.ad + "\" ile ilişki eklendi", true);
  arsiviTazele();
  yoneticiCiz();
}

function yoneticiBagSil(indeks) {
  if (!veri.ag || !veri.ag.baglar) { return; }
  veri.ag.baglar.splice(indeks, 1);
  yoneticiDurum("İlişki silindi", true);
  arsiviTazele();
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-bag-ekle]")) { yoneticiBagEkle(); return; }
  const sil = e.target.closest("[data-y-bag-sil]");
  if (sil) { yoneticiBagSil(parseInt(sil.dataset.yBagSil, 10)); }
});

/** Kilitli blokların listesini ve düzenleme editörünü çizer.
    Bir konu artık BİRDEN FAZLA kilitli blok taşıyabilir — biri "kenar"
    katmanında az gizli bir ayrıntı, diğeri "son" katmanında çok gizli bir
    gerçek olabilir. Her blok kendi katmanıyla ayrı ayrı açılır. */
function yoneticiBloklarCiz(bloklar) {
  const duzenlenen = yoneticiBlokIndeksi;
  const duzenlemeAcik = duzenlenen !== null;
  const duzenlenenBlok = (typeof duzenlenen === "number" && duzenlenen >= 0) ? bloklar[duzenlenen] : null;

  return '<div class="kutu-y kilitli-kutu">' +
      '<label class="y-anahtar-baslik">Kilitli bölümler — ' + bloklar.length + " adet</label>" +
      (bloklar.length
        ? '<div class="y-blok-liste">' +
            bloklar.map(function (g, i) {
              const kodVar = !!katmanKodlari[g.katman];
              return '<div class="y-blok-satir">' +
                       '<span class="y-blok-katman">' + kacir(g.katmanAd) + "</span>" +
                       '<span class="y-blok-baslik">' + kacir(g.baslik) + "</span>" +
                       (kodVar ? "" : '<span class="y-blok-uyari">kod yok</span>') +
                       '<button class="dugme dugme-sade" data-y-blok-duzenle="' + i + '">düzenle</button>' +
                       '<button class="dugme dugme-sade y-sil" data-y-blok-sil="' + i + '">sil</button>' +
                     "</div>";
            }).join("") +
          "</div>"
        : '<p class="oyun-not">Bu kayıtta henüz kilitli bölüm yok.</p>') +

      (duzenlemeAcik
        ? yoneticiBlokEditoru(duzenlenenBlok, duzenlenen)
        : '<button class="dugme dugme-sade" data-y-blok-yeni="1">+ Yeni kilitli blok ekle</button>') +
    "</div>";
}

function yoneticiBlokEditoru(mevcutBlok, indeks) {
  const gMetin = mevcutBlok ? (yoneticiCoz(mevcutBlok) || "") : "";
  const yeniMi = indeks === "yeni";

  const katmanSecenek = katmanListesi().map(function (k) {
    const secili = mevcutBlok ? mevcutBlok.katman === k.id : false;
    return '<option value="' + k.id + '"' + (secili ? " selected" : "") + ">" +
           k.sira + ". " + kacir(k.ad) + "</option>";
  }).join("");

  return '<div class="y-blok-editor">' +
      '<label>' + (yeniMi ? "Yeni blok — katman" : "Katman") + "</label>" +
      '<select class="kod-giris arac-giris" id="yBlokKatman">' + katmanSecenek + "</select>" +
      "<label>Bölüm başlığı</label>" +
      '<input class="kod-giris arac-giris" id="yBlokBaslik" value="' +
        kacir(mevcutBlok ? mevcutBlok.baslik : "") + '">' +
      "<label>Kilitli metin</label>" +
      '<textarea class="kod-giris arac-giris" id="yBlokMetin" rows="8">' + kacir(gMetin) + "</textarea>" +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-y-blok-kaydet="1">Bu bloğu kaydet</button>' +
        '<button class="dugme dugme-sade" data-y-blok-iptal="1">İptal</button>' +
      "</div>" +
    "</div>";
}

function yoneticiAnahtarlar() {
  return '<p class="oyun-not">Yönetici koduyla girince katman kodları kendiliğinden yüklenir; ' +
    "yeni bir katman eklersen kodunu buraya bir kez gir, yönetici kodunla birlikte saklanır.</p>" +
    '<div class="y-liste">' + katmanListesi().map(function (k) {
      const varMi = !!katmanKodlari[k.id];
      return '<div class="kutu-y">' +
               "<label>" + k.sira + ". " + kacir(k.ad) +
                 (varMi ? ' <span class="y-acik">girildi</span>' : "") + "</label>" +
               '<input class="kod-giris arac-giris" data-katman-kod="' + k.id + '" ' +
                 'placeholder="TNTF-00-XXXX" value="' + kacir(katmanKodlari[k.id] || "") + '">' +
             "</div>";
    }).join("") + "</div>" +
    '<button class="dugme dugme-sade" data-yonetici="anahtarKaydet">Anahtarları doğrula ve kaydet</button>';
}

function yoneticiBosluklar() {
  const liste = veri.bosluklar || [];
  const alanlar = [];

  liste.forEach(function (b) { if (alanlar.indexOf(b.alan) === -1) { alanlar.push(b.alan); } });

  return '<p class="oyun-not">Belgende işaretlenmiş, henüz yazılmamış maddeler. ' +
    "Yalnızca yönetici modunda görünür.</p>" +
    alanlar.map(function (a) {
      return '<div class="kutu-y">' +
               "<label>" + kacir(a) + "</label>" +
               '<div class="y-blok-liste">' +
                 liste.map(function (b, i) { return { b: b, i: i }; })
                   .filter(function (item) { return item.b.alan === a; })
                   .map(function (item) {
                     return '<div class="y-blok-satir">' +
                              '<span class="y-blok-baslik">' + kacir(item.b.madde) + "</span>" +
                              '<button class="dugme dugme-sade y-sil" data-y-bosluk-sil="' + item.i + '">sil</button>' +
                            "</div>";
                   }).join("") +
               "</div>" +
             "</div>";
    }).join("") +
    '<div class="kutu-y">' +
      "<label>Yeni not ekle</label>" +
      '<input class="kod-giris arac-giris" id="yBoslukAlan" placeholder="alan, ör. Görsel, Gize">' +
      '<input class="kod-giris arac-giris" id="yBoslukMadde" placeholder="ne eksik ya da yapılacak">' +
      '<button class="dugme dugme-sade" data-y-bosluk-ekle="1">Not ekle</button>' +
    "</div>";
}

function yoneticiBoslukEkle() {
  const alan = ((document.querySelector("#yBoslukAlan") || {}).value || "").trim();
  const madde = ((document.querySelector("#yBoslukMadde") || {}).value || "").trim();
  if (!alan || !madde) { yoneticiDurum("Alan ve madde ikisi de gerekli", false); return; }

  if (!veri.bosluklar) { veri.bosluklar = []; }
  veri.bosluklar.push({ alan: alan, madde: madde });
  yoneticiDurum("Not eklendi", true);
  yoneticiCiz();
}

function yoneticiBoslukSil(i) {
  if (!veri.bosluklar) { return; }
  veri.bosluklar.splice(i, 1);
  yoneticiDurum("Not silindi", true);
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-bosluk-ekle]")) { yoneticiBoslukEkle(); return; }
  const bSil = e.target.closest("[data-y-bosluk-sil]");
  if (bSil) { yoneticiBoslukSil(parseInt(bSil.dataset.yBoslukSil, 10)); }
});

/* ---------- olaylar ---------- */

document.addEventListener("click", function (e) {
  const y = e.target.closest("[data-yonetici]");

  if (y) {
    const eylem = y.dataset.yonetici;

    if (eylem === "giris") {
      const g = document.querySelector("#yGiris");
      if (yoneticiGiris(g.value)) {
        katmanKodlariYukle();
        if (typeof ustaAnahtarlariYukle === "function") { ustaAnahtarlariYukle(); }
        yoneticiSecili = null;
        yoneticiCiz();
        arsiviTazele();
      } else {
        yoneticiDurum("Kod yanlış", false);
      }
      return;
    }

    if (eylem === "cikis") {
      if (typeof duzenlemeModu !== "undefined" && duzenlemeModu) { duzenlemeDegistir(); }
      yoneticiCikis();
      return;
    }
    if (eylem === "kaydet") { yoneticiKaydet(); return; }
    if (eylem === "aktar") { yoneticiDisaAktar(); return; }
    if (eylem === "ghAyar") { githubKaydetAyar(); return; }
    if (eylem === "ghGonder") { githubGonder(); return; }

    if (eylem === "anahtarKaydet") {
      let sayi = 0;
      document.querySelectorAll("[data-katman-kod]").forEach(function (el) {
        const kod = el.value.trim().toUpperCase();
        if (kod && katmanKoduKaydet(el.dataset.katmanKod, kod)) { sayi++; }
      });
      ustaAnahtarSarmala();
      yoneticiDurum(sayi + " anahtar doğrulandı", sayi > 0);
      yoneticiCiz();
      return;
    }
  }

  const sekme = e.target.closest("[data-y-sekme]");
  if (sekme) {
    yoneticiSekme = sekme.dataset.ySekme; yoneticiSecili = null; yoneticiBlokIndeksi = null;
    yoneticiHizliAd = ""; yoneticiHizliAlanlar = {};
    yoneticiYapimTurler = {}; yoneticiYapimKarakterler = {};
    yoneticiYapimAyniIsimOnay = "";
    yoneticiDosyaDuzenle = null;
    yoneticiCiz();
    return;
  }

  const ac = e.target.closest("[data-y-ac]");
  if (ac) { yoneticiSecili = parseInt(ac.dataset.yAc, 10); yoneticiBlokIndeksi = null; yoneticiKayitSilOnay = null; yoneticiCiz(); return; }

  if (e.target.closest("[data-y-geri]")) { yoneticiSecili = null; yoneticiBlokIndeksi = null; yoneticiKayitSilOnay = null; yoneticiCiz(); return; }

  if (e.target.closest("[data-y-kayit-sil]")) { yoneticiKayitSil(); return; }
  if (e.target.closest("[data-y-ozellik-kaydet]")) { yoneticiOzelliklerKaydet(); return; }

  const blokYeni = e.target.closest("[data-y-blok-yeni]");
  if (blokYeni) { yoneticiBlokYeni(); return; }

  const blokDuzenle = e.target.closest("[data-y-blok-duzenle]");
  if (blokDuzenle) { yoneticiBlokDuzenle(parseInt(blokDuzenle.dataset.yBlokDuzenle, 10)); return; }

  const blokSil = e.target.closest("[data-y-blok-sil]");
  if (blokSil) { yoneticiBlokSil(parseInt(blokSil.dataset.yBlokSil, 10)); return; }

  if (e.target.closest("[data-y-blok-kaydet]")) { yoneticiBlokKaydet(); return; }

  if (e.target.closest("[data-y-blok-iptal]")) { yoneticiBlokIptal(); return; }
});

document.addEventListener("change", function (e) {
  if (e.target.id === "yKilitVar") {
    const alan = document.querySelector("#yKilitAlan");
    if (alan) { alan.style.display = e.target.checked ? "" : "none"; }
  }
});

/* ==================== GITHUB'A DOĞRUDAN KAYDETME ====================
   GitHub Pages salt okunurdur, ama GitHub REST API tarayıcıdan yazmaya izin
   verir. Erişim anahtarı yalnızca senin cihazında saklanır; dosyaya yazılmaz. */

const GH_ANAHTAR = "tentiforapp_github";

let gh = { kullanici: "", depo: "", dal: "main", yol: "veri.json", jeton: "" };

function githubYukle() {
  const ham = kayitOku(GH_ANAHTAR);
  if (!ham) { return; }
  try {
    const d = JSON.parse(ham);
    if (d && typeof d === "object") { gh = Object.assign(gh, d); }
  } catch (e) { /* bozuk kayıt */ }
}

function githubKaydetAyar() {
  ["kullanici", "depo", "dal", "yol", "jeton"].forEach(function (alan) {
    const el = document.querySelector("#gh_" + alan);
    if (el) { gh[alan] = el.value.trim(); }
  });

  kayitYaz(GH_ANAHTAR, JSON.stringify(gh));
  yoneticiDurum("Ayarlar bu cihaza kaydedildi", true);
}

function githubHazir() {
  return gh.kullanici && gh.depo && gh.jeton;
}

function base64Utf8(metin) {
  const bayt = new TextEncoder().encode(metin);
  let ikili = "";
  for (let i = 0; i < bayt.length; i++) { ikili += String.fromCharCode(bayt[i]); }
  return btoa(ikili);
}

function githubUrl() {
  return "https://api.github.com/repos/" + gh.kullanici + "/" + gh.depo +
         "/contents/" + gh.yol;
}

function githubBaslik() {
  return {
    "Authorization": "Bearer " + gh.jeton,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

/* Kaydet koruması: sayfa açıldığında (ya da son başarılı kayıtta) GitHub'la aynı sayılan verinin özeti.
   Depodaki veri bundan farklıysa (başka bir cihazdan kaydedilmiş, ya da bu sayfa eski) üzerine yazmadan sorulur. */
let veriTabanOzeti = null;
let veriTabanHam = null;   /* açılışta inen veri.json metni; özet yalnızca gerektiğinde çıkarılır */

function tabanOzeti() {
  if (!veriTabanOzeti && veriTabanHam) {
    /* yayında veri parçalı iner (js/81-surum-30.js): özet GitHub'daki tam hâlinden çıkarılır */
    try {
      const o = JSON.parse(veriTabanHam);
      if (o.__parcalar && typeof veriParcalariUygula === "function") { veriParcalariUygula(o); }
      veriTabanOzeti = o.__parcalar ? null : veriOzeti(o);
    } catch (_) { /* yok */ }
    veriTabanHam = null;
  }
  return veriTabanOzeti;
}
let ghZorla = false;
let ghUzakBekleyen = null;

function veriOzeti(o) { return onaltilik(sha256Bayt(metniBayta(JSON.stringify(o)))); }

function yoneticiCakisma(uzakSurum) {
  const el = document.querySelector("#yDurum");
  if (!el) { return; }
  el.className = "pencere-durum kotu";
  el.innerHTML = "Kaydedilmedi: GitHub'daki veri bu sayfa açıldıktan sonra değişmiş" + (uzakSurum ? " (depoda " + kacir(uzakSurum) + ", bu sayfa " + kacir(veri.surum) + ")" : "") +
    ". Kaydedersen oradaki değişiklikler silinir. " +
    '<span class="oyun-sira"><button class="dugme dugme-sade" data-y-gh-yukle>GitHub\'dakini yükle</button>' +
    '<button class="dugme dugme-sade y-sil" data-y-gh-zorla>Yine de üzerine yaz</button></span>' +
    '<span class="oyun-not">“GitHub\'dakini yükle” bu sayfada kaydetmediğin değişiklikleri atar; önce “veri.json dışa aktar” ile yedek alabilirsin.</span>';
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-gh-zorla]")) { ghZorla = true; githubGonder(); return; }
  if (e.target.closest("[data-y-gh-yukle]") && ghUzakBekleyen) {
    veri = ghUzakBekleyen;
    ghUzakBekleyen = null;
    veriTabanOzeti = veriOzeti(veri);
    if (typeof kanonSifirla === "function") { kanonSifirla(); }
    if (typeof arsiviTazele === "function") { arsiviTazele(); }
    yoneticiCiz();
    yoneticiDurum("GitHub'daki veri yüklendi; değişikliklerini şimdi yapıp kaydedebilirsin", true);
  }
});

/** Dosyanın güncel sha'sını okur. GitHub bu yanıtı ~60 sn önbelleğe aldırdığı için tarayıcı
    eski sha döndürüp "dosya aynı değil" (409) hatasına yol açabiliyordu; bu yüzden her
    okuma önbelleksiz ve benzersiz adresle yapılır. */
async function githubShaOku() {
  const ref = gh.dal ? "ref=" + encodeURIComponent(gh.dal) + "&" : "";
  const oku = await fetch(githubUrl() + "?" + ref + "_=" + Date.now(),
    { headers: githubBaslik(), cache: "no-store" });

  if (oku.status === 401) { return { hata: "Anahtar geçersiz veya süresi dolmuş" }; }
  if (oku.status === 404) { return { sha: null };      /* dosya henüz yok — yeni oluşturulacak */ }
  if (!oku.ok) { return { hata: "GitHub yanıtı: " + oku.status }; }

  const bilgi = await oku.json();
  /* depodaki veri.json'un sürümü: eski sürümde açık kalmış bir sayfa yeni veriyi ezmesin */
  let surum = "", uzak = null, ozet = null;
  try {
    if (bilgi.content && bilgi.encoding === "base64") {
      const ikili = atob(String(bilgi.content).replace(/\s/g, ""));
      const bayt = new Uint8Array(ikili.length);
      for (let i = 0; i < ikili.length; i++) { bayt[i] = ikili.charCodeAt(i); }
      uzak = JSON.parse(new TextDecoder("utf-8").decode(bayt));
      surum = uzak.surum || "";
      ozet = veriOzeti(uzak);
    }
  } catch (_) { /* okunamadı: karşılaştırma yapılmaz */ }
  return { sha: bilgi.sha, surum: surum, uzak: uzak, ozet: ozet };
}

/** veri.json'u doğrudan depoya yazar. Çakışma (409) olursa dosyayı yeniden okuyup bir kez daha dener. */
async function githubGonder() {
  if (!githubHazir()) {
    yoneticiDurum("Önce kullanıcı adı, depo ve anahtar gir", false);
    return;
  }

  if (location.protocol.indexOf("http") !== 0) {
    yoneticiDurum("Bu özellik yalnızca yayındaki sitede çalışır (file:// değil)", false);
    return;
  }

  const icerik = base64Utf8(JSON.stringify(veri, null, 2));
  let sonMesaj = "";

  for (let deneme = 1; deneme <= 2; deneme++) {
    yoneticiDurum(deneme === 1 ? "Mevcut dosya okunuyor..." : "Çakışma oldu, dosya yeniden okunuyor...", true);

    let sha = null;
    try {
      const okunan = await githubShaOku();
      if (okunan.hata) { yoneticiDurum(okunan.hata, false); return; }
      /* depodaki veri bu sayfanın bildiğinden farklıysa (ve kaydedeceğimizle aynı değilse) sormadan ezme */
      if (deneme === 1 && okunan.ozet && tabanOzeti() && okunan.ozet !== veriTabanOzeti && okunan.ozet !== veriOzeti(veri) && !ghZorla) {
        ghUzakBekleyen = okunan.uzak;
        yoneticiCakisma(okunan.surum);
        return;
      }
      sha = okunan.sha;
    } catch (e) {
      yoneticiDurum("Ağ hatası: " + e.message, false);
      return;
    }

    yoneticiDurum("Gönderiliyor...", true);

    const govde = { message: "veri.json güncellendi (yönetici paneli)", content: icerik };
    if (gh.dal) { govde.branch = gh.dal; }
    if (sha) { govde.sha = sha; }

    let yaz;
    try {
      yaz = await fetch(githubUrl(), {
        method: "PUT",
        headers: Object.assign({ "Content-Type": "application/json" }, githubBaslik()),
        body: JSON.stringify(govde),
        cache: "no-store"
      });
    } catch (e) {
      yoneticiDurum("Ağ hatası: " + e.message, false);
      return;
    }

    if (yaz.ok) {
      ghZorla = false;
      veriTabanOzeti = veriOzeti(veri);
      yoneticiDurum("Kaydedildi. Siteye çıkması için Bakım → Yayınla.", true);
      return;
    }

    if (yaz.status === 403) {
      yoneticiDurum("Yetki yok. Anahtarda 'Contents: Read and write' izni açık mı?", false);
      return;
    }

    const hata = await yaz.json().catch(function () { return {}; });
    sonMesaj = hata.message || "";

    /* 409: okuduğumuz sürüm artık güncel değil. 422 + "sha": dosya var ama sha gönderilmemiş. */
    const cakisma = yaz.status === 409 || (yaz.status === 422 && /sha/i.test(sonMesaj));
    if (!cakisma) {
      yoneticiDurum("Kaydedilemedi (" + yaz.status + "): " + sonMesaj, false);
      return;
    }
  }

  /* Sayfayı yenilemek önerilmez: yönetici düzenlemeleri bellekte durur, yenileyince gider. */
  yoneticiDurum("Çakışma sürüyor (GitHub: " + (sonMesaj || "dosya aynı değil") + "). " +
    "Sayfayı yenileme, değişiklikler bellekte duruyor. Birkaç saniye sonra tekrar Kaydet'e bas; " +
    "olmazsa önce \"veri.json dışa aktar\" ile yedek al.", false);
}

/* başka dosyaların da kullandığı adlar (araçlar dosyası panel açılınca yüklenir) */
const HARITA_TURLERI = ["Şehir", "Bölge", "Kıta", "Ada", "Su", "Kaynak", "Uzak"];

/** Yapımın gösterilecek adını döner. Aynı isimde birden fazla yapım varsa
    (ör. "Delilik" hem oyun hem roman olarak var) türünü parantez içinde
    ekleyip ayırt eder; tekse düz adı döner. Hızlı Karakter, Crossover ve
    Yapım Ekle bu tek fonksiyonu paylaşarak tutarlı kalıyor. */
function yapimGorunenAd(yapim) {
  const ayniIsimSayisi = (veri.yapimlar || []).filter(function (y) { return y.ad === yapim.ad; }).length;
  return ayniIsimSayisi > 1 ? yapim.ad + " (" + yapim.tur + ")" : yapim.ad;
}

/** Bir yerin (şehir, bölge vb.) gösterilecek adını döner. Birden fazla
    haritada aynı isimli yer varsa harita adını parantez içinde ekler. */
function yerGorunenAd(yer) {
  const tumYerler = tumHaritaYerleri();
  const ayniIsimSayisi = tumYerler.filter(function (y) { return y.ad === yer.ad; }).length;
  if (ayniIsimSayisi <= 1) { return yer.ad; }

  const sahipHarita = (veri.haritalar || []).find(function (h) {
    return (h.yerler || []).indexOf(yer) !== -1;
  });
  return yer.ad + (sahipHarita ? " (" + sahipHarita.ad + ")" : "");
}
