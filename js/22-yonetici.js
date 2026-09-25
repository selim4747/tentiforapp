/* Yönetici modu.

   Statik sitede dosya yazılamaz. Bu panel değişiklikleri tarayıcıda yapar ve
   sonucu dışa aktarır; sen GitHub'a yapıştırırsın.

   Yönetici kodu dosyada düz metin DURMAZ, yalnızca SHA-256 özeti durur.
   Gizli bloklar düz metin durur; panel açıkken her şey okunabilir ve düzenlenebilir. */

const YONETICI_ANAHTAR = "tentiforapp_yonetici";

let yoneticiKod = null;      // oturum boyunca bellekte
let yoneticiSekme = "karakterler";
let yoneticiSecili = null;
let yoneticiBlokIndeksi = null;   /* null: kapalı, sayı: o bloğu düzenliyor, "yeni": yeni blok ekliyor */

function yoneticiAcik() {
  return yoneticiKod !== null;
}

function yoneticiHatirla() {
  githubYukle();
  const ham = kayitOku(YONETICI_ANAHTAR);
  if (!ham) { return; }
  if (veri && veri.yoneticiOzet && dogrulamaOzeti(ham) === veri.yoneticiOzet) {
    yoneticiKod = ham;
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

  if (!veri.yoneticiOzet || dogrulamaOzeti(temiz) !== veri.yoneticiOzet) {
    return false;
  }

  yoneticiKod = temiz;
  kayitYaz(YONETICI_ANAHTAR, temiz);
  return true;
}

function yoneticiCikis() {
  if (typeof ustaTemizle === "function") { ustaTemizle(); }
  yoneticiKod = null;
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
  icerik: { ad: "İçerik", sekmeler: ["karakterler", "evren", "haritaDuzen", "yollar", "kisiler", "anahtarlar", "bosluklar"] },
  ekle:   { ad: "Ekle",   sekmeler: ["hizli", "yapimEkle", "olayEkle", "hikayeEkle", "gorselEkle", "dosyaEkle"] },
  bakim:  { ad: "Bakım",  sekmeler: ["denetim", "yayilma", "araclar", "test", "kaydet"] },
};

let yoneticiGrup = "icerik";

function yoneticiSekmeleri() {
  return Y_GRUPLARI[yoneticiGrup].sekmeler;
}

function yoneticiCiz() {
  const alan = document.querySelector("#yoneticiAlan");
  if (!alan) { return; }

  if (!yoneticiAcik()) {
    alan.innerHTML =
      '<p class="oyun-giris">Bu bölüm siteyi yöneten kişi içindir. ' +
      "İçeriği canlı düzenler, kilitleri değiştirir ve sonucu dışa aktarır.</p>" +
      '<input class="kod-giris arac-giris" id="yGiris" type="password" ' +
        'placeholder="yönetici kodu" autocomplete="off">' +
      '<button class="dugme" data-yonetici="giris">Gir</button>' +
      '<p class="pencere-durum" id="yDurum"></p>';
    return;
  }

  const sekmeler =
    '<div class="filtre y-grup-secici">' +
      Object.keys(Y_GRUPLARI).map(function (g) {
        return '<button class="filtre-btn' + (yoneticiGrup === g ? " secili" : "") +
               '" data-y-grup="' + g + '">' + kacir(Y_GRUPLARI[g].ad) + "</button>";
      }).join("") +
    "</div>" +
    '<div class="oyun-sekme">' +
      yoneticiSekmeleri().map(function (s) {
        const ad = { karakterler: "Karakterler", evren: "Evren", hizli: "Hızlı Karakter",
                     yapimEkle: "Yapım Ekle", haritaDuzen: "Evren / Harita", yollar: "Yollar", kisiler: "Kişiler",
                     olayEkle: "Olay Ekle", hikayeEkle: "Hikâye Ekle", gorselEkle: "Görsel Ekle",
                     dosyaEkle: "Kilitli Dosya Ekle",
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
  else if (yoneticiSecili === null) { govde = yoneticiListe(); }
  else { govde = yoneticiForm(); }

  alan.innerHTML =
    '<div class="y-ust">' +
      '<span class="y-rozet">yönetici</span>' +
      '<button class="dugme dugme-sade y-kucuk" data-duzenleme="ac">' +
        ((typeof duzenlemeAcikMi === "function" && duzenlemeAcikMi())
          ? "Düzenleme açık" : "Yerinde düzenle") + "</button>" +
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
  return { sha: bilgi.sha };
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
      yoneticiDurum("Kaydedildi. Site 30–60 saniye içinde güncellenir.", true);
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

function yoneticiGithub() {
  const alan = function (id, etiket, deger, tur, ipucu) {
    return "<label>" + etiket + "</label>" +
           '<input class="kod-giris arac-giris" id="gh_' + id + '"' +
             (tur ? ' type="' + tur + '"' : "") +
             ' value="' + kacir(deger) + '" placeholder="' + kacir(ipucu || "") +
             '" autocomplete="off" spellcheck="false">';
  };

  return '<p class="oyun-not">Doldurduğun bilgiler yalnızca bu cihazda saklanır, ' +
    "siteye yazılmaz. Erişim anahtarını kimseyle paylaşma.</p>" +

    '<div class="kutu-y">' +
      alan("kullanici", "GitHub kullanıcı adı", gh.kullanici, "", "kullaniciadin") +
      alan("depo", "Depo adı", gh.depo, "", "tentiforapp") +
      alan("dal", "Dal", gh.dal, "", "main") +
      alan("yol", "Dosya yolu", gh.yol, "", "veri.json") +
      alan("jeton", "Erişim anahtarı (token)", gh.jeton, "password", "github_pat_...") +
      '<button class="dugme dugme-sade" data-yonetici="ghAyar">Ayarları kaydet</button>' +
    "</div>" +

    '<button class="dugme" data-yonetici="ghGonder">GitHub\'a kaydet</button>' +

    '<div class="kutu-y">' +
      "<label>Anahtar nasıl alınır</label>" +
      '<ol class="y-adim">' +
        "<li>github.com → sağ üst profil → <b>Settings</b></li>" +
        "<li>En altta <b>Developer settings</b></li>" +
        "<li><b>Personal access tokens → Fine-grained tokens → Generate new token</b></li>" +
        "<li><b>Repository access:</b> Only select repositories → " + (gh.depo || "tentiforapp") + "</li>" +
        "<li><b>Permissions → Repository permissions → Contents:</b> Read and write</li>" +
        "<li>Süreyi 1 yıl seç, üret ve buraya yapıştır</li>" +
      "</ol>" +
      '<p class="oyun-not">Anahtar kaybolursa yenisini üretirsin; eskisini silmen yeter.</p>' +
    "</div>";
}

/* ==================== TUTARLILIK DENETÇİSİ ====================
   Metinlerde geçen ama arşivde olmayan isimler, kısa kartlar, kopuk bağlar.
   Yazarken gözden kaçan şeyleri bulur. */

function denetimYap() {
  const bulgular = [];
  const ekle = function (tur, nerede, mesaj) { bulgular.push({ tur: tur, nerede: nerede, mesaj: mesaj }); };

  const karakterler = veri.karakterler || [];
  const adlar = karakterler.map(function (k) { return k.ad.split(" ")[0]; });

  /* 1. metinlerde geçen ama arşivde olmayan büyük harfli isimler.
     Eskiden "Ona", "Ama", "Adı" gibi cümle başı kelimeleri de isim sanıyordu —
     62 sahte bulgunun kaynağı buydu. Artık iki filtre var: bilinen bir durak
     listesi, ve kelimenin en az bir kez CÜMLE ORTASINDA geçmiş olması şartı
     (yalnızca cümle başında geçen kelimeler büyük ihtimalle isim değildir). */
  const DURAK_KELIMELER = new Set([
    "ama", "ancak", "adı", "ada", "ona", "onun", "onu", "bunun", "bunu", "bu",
    "bir", "her", "hiç", "şu", "bazı", "sonra", "önce", "belki", "yine",
    "kendi", "artık", "işte", "tam", "en", "çok", "az", "daha", "fakat",
    "çünkü", "eğer", "ya", "yani", "veya", "gibi", "kadar", "göre", "diye",
    "hem", "ise", "de", "da", "ki", "mi", "mu", "mı", "mü", "ne", "nasıl",
    "neden", "niçin", "kim", "hangi", "kaç", "böyle", "şöyle", "öyle",
    "aynı", "tek", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz",
    "romanda", "oyunda", "evrende", "kütüphanede", "kyldolar", "gırılar",
    "türler", "hayal", "hayaller",
  ]);

  /* Kalan 25 sahte alarmın tamamı zaten belgelenmiş şeylerdi — evren madde
     başlıklarının, sözlük terimlerinin, yer ve isim sözlüğü girdilerinin tek
     kelimelik parçaları ("Taş", "Evren", "Yegim", "Zarın" gibi). Bunların
     hepsini de bilinen kelime havuzuna ekleyince gerçek eksikler öne çıkıyor. */
  const parcala = function (metin) {
    return String(metin || "").split(/\s+/).map(function (k) {
      return k.replace(/[.,;:!?"'’()]/g, "");
    }).filter(Boolean);
  };

  let bilinenKelimeler = adlar.concat(veri.sifresiz || []);
  (veri.evren || []).forEach(function (e) { bilinenKelimeler = bilinenKelimeler.concat(parcala(e.baslik)); });
  (veri.sozluk || []).forEach(function (t) { bilinenKelimeler = bilinenKelimeler.concat(parcala(t.terim)); });
  (typeof tumHaritaYerleri === "function" ? tumHaritaYerleri() : []).forEach(function (y) { bilinenKelimeler = bilinenKelimeler.concat(parcala(y.ad)); });
  (veri.isimSozluk || []).forEach(function (i) { bilinenKelimeler = bilinenKelimeler.concat(parcala(i.isim)); });
  (veri.yapimlar || []).forEach(function (y) { bilinenKelimeler = bilinenKelimeler.concat(parcala(y.ad)); });

  const bilinen = new Set(bilinenKelimeler.map(function (a) { return a.toLocaleLowerCase("tr"); }));

  const gecen = {};       /* ad -> [nerede...] */
  const ortaGorulen = {}; /* ad -> true (cümle ortasında en az bir kez görüldü) */

  const tara = function (metin, nerede) {
    const m = String(metin || "");
    const regex = /([.!?]\s+|^)?([\s(])?([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})/g;
    let esleme;

    while ((esleme = regex.exec(m)) !== null) {
      const cumleBasi = !!esleme[1] || esleme.index === 0;
      const ad = esleme[3];
      const kucuk = ad.toLocaleLowerCase("tr");

      if (bilinen.has(kucuk) || DURAK_KELIMELER.has(kucuk)) { continue; }

      if (!cumleBasi) { ortaGorulen[ad] = true; }

      if (!gecen[ad]) { gecen[ad] = []; }
      if (gecen[ad].indexOf(nerede) === -1) { gecen[ad].push(nerede); }
    }
  };

  karakterler.forEach(function (k) { tara(k.detay + " " + k.ozet, k.ad); });
  (veri.evren || []).forEach(function (e) { tara(e.metin + " " + e.ozet, e.baslik); });

  Object.keys(gecen).forEach(function (ad) {
    /* yalnızca cümle ortasında en az bir kez geçen VE en az iki yerde
       tekrarlayan kelimeler öneri olarak gösterilir */
    if (gecen[ad].length >= 2 && ortaGorulen[ad]) {
      ekle("isim", gecen[ad].slice(0, 3).join(", "),
           "\"" + ad + "\" birden çok yerde geçiyor ama arşivde kartı yok");
    }
  });

  /* 2. kısa kartlar */
  karakterler.forEach(function (k) {
    if ((k.detay || "").length < 400) {
      ekle("kisa", k.ad, "biyografi " + (k.detay || "").length + " karakter (hedef 800+)");
    }
    if (!k.gorsel) { ekle("gorsel", k.ad, "görseli yok"); }
    /* "bekliyor" gibi genel kelimeler diyalog cümlelerinde de geçtiği için
       (ör. Saek'in "Kyldo'yu bekliyordun" repliği) yanlış alarm veriyordu.
       Artık yalnızca gerçek yer tutucu imleri ve yazarın bilinçli bıraktığı
       "henüz yazılmadı" notları ayrı kategoride işaretleniyor. */
    if (/\[.*\]|TODO|XXX|PLACEHOLDER|YAZILACAK|DOLDURULACAK/i.test(k.detay || "")) {
      ekle("sablon", k.ad, "gerçek bir yer tutucu işareti var");
    }
    if (/henüz yazılmadı|buraya (?:.{0,20})?yazılacak/i.test(k.detay || "")) {
      ekle("eksikNotu", k.ad, "metin içinde bu bilginin eksik olduğu belirtilmiş");
    }
  });

  (veri.evren || []).forEach(function (e) {
    if ((e.metin || "").length < 300) {
      ekle("kisa", e.baslik, "metin " + (e.metin || "").length + " karakter");
    }
  });

  /* 3. ilişki ağında kartı olmayan düğüm */
  const kimlikler = new Set(karakterler.map(function (k) { return k.id; }));
  ((veri.ag && veri.ag.dugumler) || []).forEach(function (d) {
    if (!kimlikler.has(d.id)) { ekle("ag", d.ad, "ağda var ama arşivde kartı yok"); }
  });

  /* 4. hiçbir bağı olmayan karakter.
     Rolde, Gırı, Kyldo gibi "Türler" grubundaki kartlar birey değil, tür
     tanımıdır — ilişki ağına girmeleri beklenmez, o yüzden hariç tutulur. */
  const bagli = new Set();
  ((veri.ag && veri.ag.baglar) || []).forEach(function (b) { bagli.add(b.a); bagli.add(b.b); });
  karakterler.forEach(function (k) {
    if (k.grup === "Türler") { return; }
    if (!bagli.has(k.id)) { ekle("kopuk", k.ad, "ilişki ağında hiçbir bağı yok"); }
  });

  /* 5. boş içerik alanları */
  (veri.galeri || []).forEach(function (g) {
    if (!g.gorsel) { ekle("gorsel", g.baslik, "galeri görseli eklenmemiş"); }
  });
  ((veri.roman && veri.roman.bolumler) || []).forEach(function (b) {
    if (!String(b.metin || "").trim()) { ekle("bos", b.baslik, "roman bölümü boş"); }
  });

  return bulgular;
}

function denetimCiz() {
  const bulgular = denetimYap();

  const turAdi = { isim: "Eksik kart", kisa: "Kısa metin", gorsel: "Görsel yok",
                   sablon: "Gerçek yer tutucu", eksikNotu: "Yazar notu (eksik)",
                   ag: "Ağ uyuşmazlığı", kopuk: "Kopuk", bos: "Boş" };

  const gruplu = {};
  bulgular.forEach(function (b) {
    if (!gruplu[b.tur]) { gruplu[b.tur] = []; }
    gruplu[b.tur].push(b);
  });

  const k = veri.karakterler || [];
  const ortBio = k.length ? Math.round(k.reduce(function (t, x) {
    return t + (x.detay || "").length; }, 0) / k.length) : 0;

  return '<div class="kutu-y">' +
      "<label>İçerik sağlığı</label>" +
      '<div class="saglik">' +
        "<span>karakter <b>" + k.length + "</b></span>" +
        "<span>ort. biyografi <b>" + ortBio + "</b></span>" +
        "<span>görselli <b>" + k.filter(function (x) { return x.gorsel; }).length +
          "/" + k.length + "</b></span>" +
        "<span>galeri dolu <b>" + (veri.galeri || []).filter(function (g) { return g.gorsel; }).length +
          "/" + (veri.galeri || []).length + "</b></span>" +
        "<span>roman <b>" + ((veri.roman && veri.roman.bolumler) || [])
          .filter(function (b) { return String(b.metin || "").trim(); }).length +
          "/" + ((veri.roman && veri.roman.bolumler) || []).length + "</b></span>" +
      "</div>" +
    "</div>" +

    '<div class="kutu-y">' +
      "<label>Denetim — " + bulgular.length + " bulgu</label>" +
      (bulgular.length
        ? Object.keys(gruplu).map(function (t) {
            return '<div class="denetim-grup">' +
                     '<div class="denetim-tur">' + (turAdi[t] || t) +
                       " (" + gruplu[t].length + ")</div>" +
                     "<ul class=\"y-bosluk\">" +
                       gruplu[t].slice(0, 12).map(function (b) {
                         return "<li><b>" + kacir(b.nerede) + "</b> — " + kacir(b.mesaj) + "</li>";
                       }).join("") +
                       (gruplu[t].length > 12
                         ? "<li>… ve " + (gruplu[t].length - 12) + " tane daha</li>" : "") +
                     "</ul>" +
                   "</div>";
          }).join("")
        : '<p class="oyun-not">Hiçbir sorun bulunamadı.</p>') +
    "</div>";
}


/* ==================== TEST ARAÇLARI ====================
   Yalnızca yönetici modunda. Oyunu denerken elle ilerlemek zorunda kalma. */

function yoneticiTest() {
  return '<div class="kutu-y">' +
      "<label>Cüzdan</label>" +
      '<p class="oyun-not">Şu an: <b>' + cuzdan.ecka + " " + birim() + "</b></p>" +
      '<input class="kod-giris arac-giris" id="tEcka" inputmode="numeric" placeholder="miktar">' +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-test="ayarla">Ayarla</button>' +
        '<button class="dugme dugme-sade" data-test="ekle">+1000</button>' +
        '<button class="dugme dugme-sade" data-test="sifirla">Sıfırla</button>' +
      "</div>" +
    "</div>" +

    '<div class="kutu-y">' +
      "<label>Günlük tavanlar</label>" +
      '<p class="oyun-not">Bugünkü kazanç sınırlarını sıfırlar, tekrar oynayabilirsin.</p>' +
      '<button class="dugme dugme-sade" data-test="tavan">Tavanları sıfırla</button>' +
    "</div>" +

    '<div class="kutu-y">' +
      "<label>İlerleme</label>" +
      '<div class="oyun-sira">' +
        '<button class="dugme dugme-sade" data-test="oyunlar">Tüm oyunları bitmiş say</button>' +
        '<button class="dugme dugme-sade" data-test="kilitler">Tüm kilitleri aç</button>' +
      "</div>" +
      '<div class="oyun-sira" style="margin-top:9px">' +
        '<button class="dugme dugme-sade" data-test="katmanlar">Tüm katmanları çöz</button>' +
        '<button class="dugme dugme-sade" data-test="gun">Seriye 30 gün ekle</button>' +
      "</div>" +
    "</div>" +

    '<div class="kutu-y">' +
      "<label>Temizlik</label>" +
      '<p class="oyun-not">Her şeyi siler: cüzdan, kilitler, istatistik, tur. Geri alınamaz.</p>' +
      '<button class="dugme sil" data-test="hepsini-sil">Tüm ilerlemeyi sıfırla</button>' +
    "</div>";
}

function testUygula(eylem) {
  if (eylem === "ayarla") {
    const g = document.querySelector("#tEcka");
    const d = parseInt(g ? g.value : "", 10);
    if (isNaN(d) || d < 0) { yoneticiDurum("Geçerli bir sayı gir", false); return; }
    cuzdan.ecka = d;
    cuzdanKaydet();
    yoneticiDurum("Cüzdan " + d + " yapıldı", true);
  } else if (eylem === "ekle") {
    cuzdan.ecka += 1000;
    cuzdanKaydet();
    yoneticiDurum("+1000 eklendi", true);
  } else if (eylem === "sifirla") {
    cuzdan.ecka = 0;
    cuzdanKaydet();
    yoneticiDurum("Cüzdan sıfırlandı", true);
  } else if (eylem === "tavan") {
    cuzdan.gunluk = {};
    cuzdanKaydet();
    yoneticiDurum("Günlük tavanlar sıfırlandı", true);
  } else if (eylem === "oyunlar") {
    OYUNLAR.forEach(function (o) {
      if (cuzdan.acilan.indexOf("bitirdi_" + o) === -1) { cuzdan.acilan.push("bitirdi_" + o); }
    });
    cuzdanKaydet();
    yoneticiDurum("Tüm oyunlar bitmiş sayıldı", true);
  } else if (eylem === "kilitler") {
    (veri.galeri || []).forEach(function (g) {
      if (cuzdan.acilan.indexOf("galeri_" + g.id) === -1) { cuzdan.acilan.push("galeri_" + g.id); }
    });
    (veri.temalar || []).forEach(function (t) {
      if (cuzdan.acilan.indexOf("tema_" + t.id) === -1) { cuzdan.acilan.push("tema_" + t.id); }
    });
    (veri.siteTemalari || []).forEach(function (t) {
      if (cuzdan.acilan.indexOf("sitetema_" + t.id) === -1) { cuzdan.acilan.push("sitetema_" + t.id); }
    });
    if (cuzdan.acilan.indexOf("oyun_boyut") === -1) { cuzdan.acilan.push("oyun_boyut"); }
    cuzdanKaydet();
    yoneticiDurum("Galeri, temalar ve Boyut açıldı", true);
  } else if (eylem === "katmanlar") {
    Object.keys(katmanKodlari).forEach(function (id) {
      const k = katmanBul(id);
      if (k) { cozulenler[k.dogrulama] = katmanKodlari[id]; }
    });
    acilanlariKaydet();
    const kac = Object.keys(katmanKodlari).length;
    yoneticiDurum(kac ? kac + " katman çözüldü" : "Önce Anahtarlar sekmesine kodları gir", kac > 0);
  } else if (eylem === "gun") {
    istatistikHazirla();
    const bugun = new Date();
    for (let i = 29; i >= 0; i--) {
      const t = new Date(bugun.getTime() - i * 86400000).toISOString().slice(0, 10);
      if (cuzdan.ist.gunler.indexOf(t) === -1) { cuzdan.ist.gunler.push(t); }
    }
    cuzdan.ist.gunler.sort();
    cuzdanKaydet();
    yoneticiDurum("30 günlük seri eklendi", true);
  } else if (eylem === "hepsini-sil") {
    if (!confirm("Tüm ilerleme silinecek. Emin misin?")) { return; }
    ["tentiforapp_cuzdan", "tentiforapp_cozulen", "tentiforapp_nobet",
     "tentiforapp_evrenler", "tentiforapp_rol_gecmis", "tentiforapp_tur",
     "tentiforapp_spoiler", "tentiforapp_nobet_skor", "tentiforapp_gunun"]
      .forEach(function (a) { kayitYaz(a, ""); });
    location.reload();
    return;
  }

  arsiviTazele();
  if (typeof arsivciCiz === "function") { arsivciCiz(); }
  if (typeof temaMagazaCiz === "function") { temaMagazaCiz(); }
  if (typeof siteTemaMagazaCiz === "function") { siteTemaMagazaCiz(); }
  if (typeof seriCiz === "function") { seriCiz(); }
  if (typeof gecmisCiz === "function") { gecmisCiz(); }
  yoneticiCiz();
}

/* ==================== İÇERİK ARAÇLARI ==================== */

function yoneticiAraclar() {
  return '<div class="kutu-y">' +
      "<label>Karakter şablonu</label>" +
      '<p class="oyun-not">Dört öğeyi doldur, biyografi taslağı üretilsin. ' +
        "Kanca cümlesi, ne istediği, ne engellediği ve somut bir sahne detayı.</p>" +
      '<input class="kod-giris arac-giris" id="sAd" placeholder="ad">' +
      '<textarea class="kod-giris arac-giris" id="sKanca" rows="2" placeholder="kanca cümlesi"></textarea>' +
      '<textarea class="kod-giris arac-giris" id="sIstek" rows="2" placeholder="ne istiyor"></textarea>' +
      '<textarea class="kod-giris arac-giris" id="sEngel" rows="2" placeholder="ne engelliyor"></textarea>' +
      '<textarea class="kod-giris arac-giris" id="sSahne" rows="3" placeholder="somut bir sahne detayı"></textarea>' +
      '<button class="dugme" data-arac="sablon">Taslak üret</button>' +
      '<textarea class="kod-giris arac-giris" id="sCikti" rows="8"></textarea>' +
    "</div>" +

    '<div class="kutu-y">' +
      "<label>Alıntı toplayıcı</label>" +
      '<p class="oyun-not">Metinlerdeki tırnak içi cümleleri bulur. Beğendiğini ' +
        "Alıntılar bölümüne elle ekleyebilirsin.</p>" +
      '<button class="dugme dugme-sade" data-arac="alinti">Tara</button>' +
      '<div id="alintiBulgu"></div>' +
    "</div>" +

    '<div class="kutu-y">' +
      "<label>Özet önerici</label>" +
      '<p class="oyun-not">Özeti boş ya da çok uzun olan kayıtlar için ilk cümleden öneri.</p>' +
      '<button class="dugme dugme-sade" data-arac="ozet">Öner</button>' +
      '<div id="ozetBulgu"></div>' +
    "</div>" +

    '<div class="kutu-y">' +
      "<label>Sürüm karşılaştırma</label>" +
      '<p class="oyun-not">Eski bir veri.json yapıştır, neyin değiştiğini gör.</p>' +
      '<textarea class="kod-giris arac-giris" id="eskiVeri" rows="4" placeholder="{ ... }"></textarea>' +
      '<button class="dugme dugme-sade" data-arac="fark">Karşılaştır</button>' +
      '<div id="farkBulgu"></div>' +
    "</div>";
}

function aracUygula(ad) {
  if (ad === "sablon") {
    const al = function (id) { const e = document.querySelector(id); return e ? e.value.trim() : ""; };
    const parcalar = [al("#sKanca"), al("#sIstek"), al("#sEngel"), al("#sSahne")]
      .filter(function (p) { return p; });

    const c = document.querySelector("#sCikti");
    if (c) { c.value = parcalar.join("\n\n"); }
    yoneticiDurum(parcalar.length + "/4 öğe dolu", parcalar.length === 4);
    return;
  }

  if (ad === "alinti") {
    const bulunan = [];
    const tara = function (metin, nerede) {
      const m = String(metin || "").match(/["“]([^"”]{10,120})["”]/g) || [];
      m.forEach(function (x) { bulunan.push({ metin: x.replace(/["“”]/g, ""), nerede: nerede }); });
    };
    (veri.karakterler || []).forEach(function (k) {
      tara(k.detay, k.ad);
      if (k.gizli) { tara(yoneticiCozTumu(k.gizli), k.ad); }
    });
    (veri.evren || []).forEach(function (e) {
      tara(e.metin, e.baslik);
      if (e.gizli) { tara(yoneticiCozTumu(e.gizli), e.baslik); }
    });

    const kutu = document.querySelector("#alintiBulgu");
    const mevcut = (veri.alintilar || []).map(function (a) { return a.metin; });
    const yeni = bulunan.filter(function (b) { return mevcut.indexOf(b.metin) === -1; });

    if (kutu) {
      kutu.innerHTML = yeni.length
        ? "<ul class=\"y-bosluk\">" + yeni.slice(0, 20).map(function (b) {
            return "<li>“" + kacir(b.metin) + "” <b>" + kacir(b.nerede) + "</b></li>";
          }).join("") + "</ul>"
        : '<p class="oyun-not">Yeni aday bulunamadı.</p>';
    }
    return;
  }

  if (ad === "ozet") {
    const oneriler = [];
    (veri.karakterler || []).forEach(function (k) {
      if (!k.ozet || k.ozet.length > 120) {
        const ilk = String(k.detay || "").split(/(?<=[.!?])\s/)[0] || "";
        if (ilk) { oneriler.push({ ad: k.ad, oneri: ilk.slice(0, 110) }); }
      }
    });

    const kutu = document.querySelector("#ozetBulgu");
    if (kutu) {
      kutu.innerHTML = oneriler.length
        ? "<ul class=\"y-bosluk\">" + oneriler.map(function (o) {
            return "<li><b>" + kacir(o.ad) + "</b> — " + kacir(o.oneri) + "</li>";
          }).join("") + "</ul>"
        : '<p class="oyun-not">Tüm özetler uygun.</p>';
    }
    return;
  }

  if (ad === "fark") {
    const g = document.querySelector("#eskiVeri");
    const kutu = document.querySelector("#farkBulgu");
    if (!g || !kutu) { return; }

    let eski;
    try { eski = JSON.parse(g.value); } catch (e) {
      kutu.innerHTML = '<p class="pencere-durum kotu">Geçersiz JSON</p>';
      return;
    }

    const kiyas = function (a, b, alan) {
      const ai = new Set((a || []).map(function (x) { return x.id; }));
      const bi = new Set((b || []).map(function (x) { return x.id; }));
      const eklenen = (b || []).filter(function (x) { return !ai.has(x.id); });
      const silinen = (a || []).filter(function (x) { return !bi.has(x.id); });
      const degisen = (b || []).filter(function (x) {
        const e = (a || []).find(function (y) { return y.id === x.id; });
        return e && JSON.stringify(e) !== JSON.stringify(x);
      });
      return { alan: alan, eklenen: eklenen, silinen: silinen, degisen: degisen };
    };

    const sonuc = [kiyas(eski.karakterler, veri.karakterler, "Karakter"),
                   kiyas(eski.evren, veri.evren, "Evren")];

    kutu.innerHTML =
      '<p class="oyun-not">sürüm ' + kacir(eski.surum || "?") + " → " + kacir(veri.surum) + "</p>" +
      sonuc.map(function (s) {
        const ad = function (x) { return x.ad || x.baslik || x.id; };
        return '<div class="denetim-grup"><div class="denetim-tur">' + s.alan + "</div>" +
               "<ul class=\"y-bosluk\">" +
                 (s.eklenen.length ? "<li><b>eklenen:</b> " + s.eklenen.map(ad).map(kacir).join(", ") + "</li>" : "") +
                 (s.silinen.length ? "<li><b>silinen:</b> " + s.silinen.map(ad).map(kacir).join(", ") + "</li>" : "") +
                 (s.degisen.length ? "<li><b>değişen:</b> " + s.degisen.map(ad).map(kacir).join(", ") + "</li>" : "") +
                 (!s.eklenen.length && !s.silinen.length && !s.degisen.length ? "<li>fark yok</li>" : "") +
               "</ul></div>";
      }).join("");
  }
}

document.addEventListener("click", function (e) {
  const t = e.target.closest("[data-test]");
  if (t) { testUygula(t.dataset.test); return; }

  const a = e.target.closest("[data-arac]");
  if (a) { aracUygula(a.dataset.arac); }
});

/* ==================== YAYILMA DENETÇİSİ ====================
   Bir şeyi bir yere ekleyip diğer yerleri unutmak bu projenin en sık hatasıydı.
   Bu denetim onu otomatik yakalar. */

function yayilmaDenetimi() {
  const bulgular = [];
  const ekle = function (tur, ne, nerede) { bulgular.push({ tur: tur, ne: ne, nerede: nerede }); };

  const karakterler = veri.karakterler || [];
  const agDugum = new Set(((veri.ag && veri.ag.dugumler) || []).map(function (d) { return d.id; }));
  const agBagli = new Set();
  ((veri.ag && veri.ag.baglar) || []).forEach(function (b) { agBagli.add(b.a); agBagli.add(b.b); });

  /* 1. ana karakterler ağda var mı */
  const turler = new Set(["rolde", "giri", "kyldo"]);
  karakterler.forEach(function (k) {
    if (turler.has(k.id)) { return; }
    if (!agDugum.has(k.id)) { ekle("ağ", k.ad, "ilişki ağında düğümü yok"); }
    else if (!agBagli.has(k.id)) { ekle("ağ", k.ad, "ağda var ama hiç bağı yok"); }
  });

  /* 2. metinlerde geçen yer adları haritada var mı */
  const haritaAd = (typeof tumHaritaYerleri === "function" ? tumHaritaYerleri() : []).map(function (y) { return y.ad; });
  const tumMetin = karakterler.map(function (k) { return k.detay + " " + k.ozet; })
    .concat((veri.evren || []).map(function (e) { return e.metin + " " + e.ozet; })).join(" ");

  /* bilinen yer adlarını topla: büyük harfle başlayıp "'de/'da/'ye" ekiyle gelenler */
  const yerAdaylari = {};
  (tumMetin.match(/([A-ZÇĞİÖŞÜ][a-zçğıöşü-]{2,}(?:-\d+)?)'(?:de|da|te|ta|ye|ya|den|dan)\b/g) || [])
    .forEach(function (m) {
      const ad = m.split("'")[0];
      yerAdaylari[ad] = (yerAdaylari[ad] || 0) + 1;
    });

  const kisiAd = new Set(karakterler.map(function (k) { return k.ad.split(" ")[0]; }));

  Object.keys(yerAdaylari).forEach(function (ad) {
    if (yerAdaylari[ad] < 2) { return; }
    if (kisiAd.has(ad)) { return; }
    if (haritaAd.indexOf(ad) !== -1) { return; }
    if ((veri.sifresiz || []).indexOf(ad) !== -1) { return; }
    ekle("harita", ad, yerAdaylari[ad] + " kez geçiyor, haritada yok");
  });

  /* 3. isim sözlüğü: kanon isimler tanımlı mı */
  const sozlukAd = new Set(((veri.isimSozluk) || []).map(function (i) { return i.isim; }));
  karakterler.forEach(function (k) {
    const ilk = k.ad.split(" ")[0];
    if (!sozlukAd.has(ilk) && k.ad.length < 14 && !turler.has(k.id)) {
      ekle("isim", ilk, "isim sözlüğünde yok");
    }
  });

  /* 4. sözlük: sık geçen büyük harfli kavramlar tanımlı mı */
  const terimler = new Set((veri.sozluk || []).map(function (t) { return t.terim; }));
  const sayac = {};
  (tumMetin.match(/\b[A-ZÇĞİÖŞÜ]{2,}\b/g) || []).forEach(function (t) {
    sayac[t] = (sayac[t] || 0) + 1;
  });
  Object.keys(sayac).forEach(function (t) {
    if (sayac[t] >= 3 && !terimler.has(t) && t.length <= 6) {
      ekle("sözlük", t, sayac[t] + " kez geçiyor, sözlükte yok");
    }
  });

  /* 5. zaman çizelgesi: numara sırası */
  const nolar = (veri.zamanCizelgesi || []).map(function (z) { return z.no; });
  for (let i = 1; i < nolar.length; i++) {
    if (nolar[i] <= nolar[i - 1]) {
      ekle("zaman", nolar[i] + ". adım", "numara sırası bozuk");
      break;
    }
  }

  /* 6. SAYFALAMA: her bölüm bir sayfaya atanmış mı?
     Bu kontrol olmadığı için Başarımlar ve Değişiklik günlüğü bir süre
     tamamen erişilemez kalmıştı. */
  if (typeof sayfaKimlikleri === "function") {
    const atanmis = new Set();
    const m = sayfaKimlikleri();
    Object.keys(m).forEach(function (sf) {
      m[sf].forEach(function (id) { atanmis.add(id); });
    });

    document.querySelectorAll("section.bolum").forEach(function (s) {
      if (s.id === "yokSayfa") { return; }
      if (!atanmis.has(s.id)) {
        ekle("sayfa", s.id, "hiçbir sayfaya atanmamış — erişilemez");
      }
    });

    /* tersi: gezinmede olup HTML'de olmayan */
    atanmis.forEach(function (id) {
      if (!document.getElementById(id)) {
        ekle("sayfa", id, "gezinmede var ama bölümü yok");
      }
    });

    /* geç çizim listesinde olmayan ağır bölümler */
    if (typeof GEC_CIZILENLER !== "undefined") {
      Object.keys(GEC_CIZILENLER).forEach(function (id) {
        if (!document.getElementById(id)) {
          ekle("sayfa", id, "geç çizim listesinde ama bölümü yok");
        }
      });
    }
  }

  /* Not: "başlangıç zinciri ile geç çizim listesinde aynı bölümün çift kayıtlı
     olması" hatası ("aile" bölümünde SVG çizgilerinin silinmesine yol açmıştı)
     tarayıcıda çalışan bu denetimden yapılamıyor — kaynak kodun kendisini
     okumak gerekiyor. kontrol_cakisma.py dosyası bunu yapıyor; yeni bir bölüm
     eklerken onu çalıştır. */

  /* 7. yapımlarda sınıf eksikliği */
  (veri.yapimlar || []).forEach(function (y) {
    if (!y.sinif) { ekle("yapım", y.ad, "UH/UD sınıfı yok"); }
  });

  /* 8. Olaylar/Hikâyeler: etiketlenen kişiler hâlâ arşivde var mı.
     Bir karakter silinince ilgili id'ler otomatik temizleniyor ama elle
     düzenlemeyle kopabilir — burada yakalanır. */
  const karakterId = new Set(karakterler.map(function (k) { return k.id; }));
  (veri.anlatiOlaylari || []).forEach(function (o) {
    (o.kisiler || []).forEach(function (id) {
      if (!karakterId.has(id)) { ekle("olay", o.baslik, "'" + id + "' artık arşivde yok"); }
    });
  });
  (veri.kisaHikayeler || []).forEach(function (hk) {
    (hk.karakterler || []).forEach(function (id) {
      if (!karakterId.has(id)) { ekle("hikâye", hk.baslik, "'" + id + "' artık arşivde yok"); }
    });
  });

  /* 9. Crossover: baglı yapımlar hâlâ var mı */
  const yapimAdlari = new Set((veri.yapimlar || []).map(function (y) {
    return typeof yapimGorunenAd === "function" ? yapimGorunenAd(y) : y.ad;
  }));
  (veri.crossoverlar || []).forEach(function (c) {
    if (!yapimAdlari.has(c.a)) { ekle("crossover", c.a + " × " + c.b, "'" + c.a + "' yapımı artık yok"); }
    if (!yapimAdlari.has(c.b)) { ekle("crossover", c.a + " × " + c.b, "'" + c.b + "' yapımı artık yok"); }
  });

  /* 10. Kilitli dosyalar: bağlı olduğu katman hâlâ var mı */
  const katmanId = new Set((veri.katmanlar || []).map(function (k) { return k.id; }));
  (veri.kilitliDosyalar || []).forEach(function (dosya) {
    if (!katmanId.has(dosya.katman)) { ekle("dosya", dosya.ad, "'" + dosya.katman + "' katmanı artık yok"); }
  });

  /* 11. Karakterlerin "yaşadığı şehir"i hâlâ haritada var mı */
  const tumSehirAdlari = new Set((typeof tumHaritaYerleri === "function" ? tumHaritaYerleri() : [])
    .filter(function (y) { return y.tur === "Şehir"; })
    .map(function (y) { return typeof yerGorunenAd === "function" ? yerGorunenAd(y) : y.ad; }));
  karakterler.forEach(function (k) {
    if (k.ozellikler && k.ozellikler.sehir && !tumSehirAdlari.has(k.ozellikler.sehir)) {
      ekle("şehir", k.ad, "'" + k.ozellikler.sehir + "' artık haritada yok");
    }
  });

  /* 12. Haritadaki noktaların konumu 0-100 sınırları içinde mi */
  (veri.haritalar || []).forEach(function (h) {
    (h.yerler || []).forEach(function (y) {
      if (y.x < 0 || y.x > 100 || y.y < 0 || y.y > 100) {
        ekle("harita", h.ad + " / " + y.ad, "konum 0-100 sınırının dışında");
      }
    });
  });

  return bulgular;
}

/* ==================== ÇELİŞKİ AVCISI ====================
   Aynı olayın iki yerde farklı anlatılması bu projede birkaç kez oldu.
   Kural listesi: bir ifade varsa, çelişeni olmamalı. */

const CELISKI_KURALLARI = [
  { ad: "Büyükbabanın ölümü", olmali: /eceliyle öldü|taşının işlevsizleş/i,
    olmamali: /Gri(?:'nin)? (?:onu )?öldürdü|Gri'nin kurbanlarından/i },
  { ad: "Pileg ziyaretinin yeri", olmali: /post-credit'i değildir|son sahnelerinde/i,
    olmamali: /post-credit(?: sahnesi)?(?:dir| olarak)/i },
  { ad: "Yaşam gücü almadı", olmali: /istemediği için/i,
    olmamali: /alamadığı için(?! değil)|gücü emmeyi başaramadı/i },
  { ad: "Kyldo'nun profesyonelliğe geçişi", olmali: /öldürmeye gitti/i,
    olmamali: /Saek onu (?:buna )?ikna etti/i },
  { ad: "Annenin ölüm zamanı", olmali: /altı yıl önce/i,
    olmamali: /deneylerden üç yıl sonra/i },
  { ad: "Kyldo ve Saek aynı şehir", olmali: /aynı şehirde|Yegim'de/i,
    olmamali: /farklı şehirlerde yaşa/i },
  { ad: "Tarı'nın kurtuluşu", olmali: /protokol meleği/i,
    olmamali: /bir hata sonucu|tesadüfen kurtuldu/i },
];

function celiskiDenetimi() {
  const bulgular = [];

  /* çözülebilen tüm metni topla (yönetici modunda hepsi açık) */
  let hepsi = "";
  const topla = function (o) {
    hepsi += " " + (o.metin || "") + " " + (o.detay || "") + " " + (o.ozet || "");
    if (o.gizli && typeof yoneticiCozTumu === "function") {
      const c = yoneticiCozTumu(o.gizli);
      if (c) { hepsi += " " + c; }
    }
  };
  (veri.karakterler || []).forEach(topla);
  (veri.evren || []).forEach(topla);
  (veri.yapimlar || []).forEach(function (y) { hepsi += " " + (y.not || ""); });
  (veri.zamanCizelgesi || []).forEach(function (z) { hepsi += " " + (z.metin || ""); });
  (veri.anlatiOlaylari || []).forEach(function (o) { hepsi += " " + (o.anlatim || "") + " " + (o.yasanmaSekli || ""); });
  (veri.kisaHikayeler || []).forEach(function (hk) { hepsi += " " + (hk.metin || ""); });
  (veri.crossoverlar || []).forEach(function (c) { hepsi += " " + (c.gidisat || "") + " " + (c.neden || ""); });

  CELISKI_KURALLARI.forEach(function (k) {
    const var_ = k.olmali.test(hepsi);
    const celisen = k.olmamali.test(hepsi);
    if (var_ && celisen) {
      bulgular.push({ ad: k.ad, durum: "ÇELİŞKİ", not: "hem yeni hem eski anlatım var" });
    } else if (!var_ && celisen) {
      bulgular.push({ ad: k.ad, durum: "ESKİ", not: "yalnızca eski anlatım var" });
    }
  });

  return bulgular;
}

function yayilmaCiz() {
  const y = yayilmaDenetimi();
  const c = celiskiDenetimi();

  const grup = {};
  y.forEach(function (b) { if (!grup[b.tur]) { grup[b.tur] = []; } grup[b.tur].push(b); });

  return '<div class="kutu-y">' +
      "<label>Çelişki avcısı</label>" +
      (c.length
        ? c.map(function (x) {
            return '<div class="celiski"><b>' + kacir(x.durum) + "</b> " +
                   kacir(x.ad) + ' <span class="oyun-not">' + kacir(x.not) + "</span></div>";
          }).join("")
        : '<p class="oyun-not">Bilinen çelişkilerin hiçbiri bulunamadı.</p>') +
    "</div>" +

    '<div class="kutu-y">' +
      "<label>Yayılma denetimi — " + y.length + " bulgu</label>" +
      '<p class="oyun-not">Bir şey eklendi ama başka bölümlere yayılmadıysa burada çıkar.</p>' +
      (y.length
        ? Object.keys(grup).map(function (t) {
            return '<div class="denetim-grup">' +
                     '<div class="denetim-tur">' + kacir(t) + " (" + grup[t].length + ")</div>" +
                     '<ul class="y-bosluk">' +
                       grup[t].slice(0, 10).map(function (b) {
                         return "<li><b>" + kacir(b.ne) + "</b> — " + kacir(b.nerede) + "</li>";
                       }).join("") +
                       (grup[t].length > 10 ? "<li>… " + (grup[t].length - 10) + " tane daha</li>" : "") +
                     "</ul>" +
                   "</div>";
          }).join("")
        : '<p class="oyun-not">Her şey yayılmış görünüyor.</p>') +
    "</div>" +

    iliskiOneriCiz();
}


/* Yönetici sekme grubu değiştirici. (Önce yanlış blokta duruyordu ve hiç
   tetiklenmiyordu; bağımsız yakalayıcıya taşındı.) */
document.addEventListener("click", function (e) {
  const g = e.target.closest("[data-y-grup]");
  if (!g) { return; }

  yoneticiGrup = g.dataset.yGrup;
  yoneticiSekme = Y_GRUPLARI[yoneticiGrup].sekmeler[0];
  yoneticiCiz();
});


/* ==================== İLİŞKİ ÖNERİCİSİ ====================
   Bir karakterin metninde başka bir karakterin adı geçiyor ama ikisi
   arasında ilişki ağında hiçbir bağ yoksa, burada öneri olarak listelenir.
   Not: yalnızca METİNDE GEÇEN isimleri yakalar — "Faralt, Tamıs'ın iş
   arkadaşı" gibi unvandan çıkarılan ama metne hiç yazılmamış bağları
   yakalayamaz. Onlar hâlâ elle eklenmeli. */

function iliskiOnerileriBul() {
  const karakterler = veri.karakterler || [];
  const baglar = ((veri.ag && veri.ag.baglar) || []);

  const bagliMi = function (idA, idB) {
    return baglar.some(function (b) {
      return (b.a === idA && b.b === idB) || (b.a === idB && b.b === idA);
    });
  };

  const adlar = karakterler.map(function (k) {
    return { id: k.id, ad: k.ad, ilk: k.ad.split(" ")[0] };
  });

  const bulunan = {};   /* "a|b" -> {a, b, kaynaklar:[]} */

  karakterler.forEach(function (kaynak) {
    const metin = (kaynak.detay || "") + " " + (kaynak.ozet || "");

    adlar.forEach(function (hedef) {
      if (hedef.id === kaynak.id) { return; }
      if (hedef.ilk.length < 3) { return; }

      const kacKarakter = hedef.ilk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const kalip = new RegExp("(^|[^\\wçğıöşüÇĞİÖŞÜ])" + kacKarakter +
        "([^\\wçğıöşüÇĞİÖŞÜ]|$)", "u");
      if (!kalip.test(metin)) { return; }

      if (bagliMi(kaynak.id, hedef.id)) { return; }

      const anahtar = [kaynak.id, hedef.id].sort().join("|");
      if (!bulunan[anahtar]) {
        bulunan[anahtar] = { a: kaynak.id, b: hedef.id, aAd: kaynak.ad, bAd: hedef.ad, kaynaklar: [] };
      }
      if (bulunan[anahtar].kaynaklar.indexOf(kaynak.ad) === -1) {
        bulunan[anahtar].kaynaklar.push(kaynak.ad);
      }
    });
  });

  return Object.values(bulunan);
}

function iliskiOneriCiz() {
  const oneriler = iliskiOnerileriBul();

  return '<div class="kutu-y">' +
      "<label>İlişki önericisi — " + oneriler.length + " öneri</label>" +
      '<p class="oyun-not">Metinde birbirinin adını geçiren ama ağda bağı olmayan ' +
        "çiftler. Yalnızca metne yazılmış isimleri yakalar — unvandan çıkarılan " +
        "bağları (ör. \"meslektaş\") yakalamaz, onlar elle eklenmeli.</p>" +
      (oneriler.length
        ? '<ul class="y-bosluk">' +
            oneriler.slice(0, 20).map(function (o) {
              return "<li><b>" + kacir(o.aAd) + " ↔ " + kacir(o.bAd) + "</b> — " +
                     kacir(o.kaynaklar.join(", ")) + " metninde geçiyor</li>";
            }).join("") +
            (oneriler.length > 20 ? "<li>… " + (oneriler.length - 20) + " tane daha</li>" : "") +
          "</ul>"
        : '<p class="oyun-not">Metinde geçip ağda bağı olmayan çift yok.</p>') +
    "</div>";
}
/* ==================== HIZLI KARAKTER ====================
   Serbest metin yerine, önceden tanımlı özellik taslaklarından (yaş, soyad,
   meslek, hikâyedeki rolü, bulunduğu hikâyeler ve benzeri) hangilerini
   dolduracağını seçip hızlıca karakter kartı oluşturur. */

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

const HIZLI_ALAN_TIPLERI = [
  { id: "yas", ad: "Yaş" },
  { id: "soyad", ad: "Soyad" },
  { id: "meslek", ad: "Meslek" },
  { id: "boy", ad: "Boy" },
  { id: "aile", ad: "Aile" },
  { id: "hikayedeRol", ad: "Hikâyedeki rolü" },
  { id: "hikayeler", ad: "Bulunduğu hikâyeler" },
  { id: "sehir", ad: "Yaşadığı şehir" },
];

let yoneticiHizliAd = "";         /* girilen isim */
let yoneticiHizliAlanlar = {};    /* { yas: true, meslek: true, ... } */
let yoneticiHizliYapimlar = {};   /* { 0: true, 3: true, ... } — secilen yapim INDEKSLERI.
                                       Isme gore anahtarlamak "Delilik" (Oyun) ile "Delilik"
                                       (Roman) gibi ayni adli farkli yapimlari tek secim
                                       sayardi; indeks bu carpismayi onluyor. */
let yoneticiHizliSehir = "";           /* secilen sehrin gorunen adi */
let yoneticiHizliSehirYeni = false;    /* "+ Yeni sehir ekle" formu acik mi */
let yoneticiHizliSehirYeniAd = "";
let yoneticiHizliSehirYeniHarita = "0";
let yoneticiHizliIliskiler = [];       /* [{hedefId, etiket, gizli}, ...] eklenmis iliskiler */
let yoneticiHizliIliskiHedef = "";
let yoneticiHizliIliskiEtiket = "";
let yoneticiHizliIliskiGizli = false;
let yoneticiHizliGrupGiris = "";       /* "Grup" alani — yeniden cizimde kaybolmasin diye */

function yoneticiHizliKarakter() {
  const govde = (!yoneticiHizliAd)
    ? '<div class="kutu-y">' +
        "<label>1. Karakterin adı</label>" +
        '<input class="kod-giris arac-giris" id="yHizliAd" placeholder="ör. yeni bir isim">' +
        '<button class="dugme" data-y-hizli-ad-devam="1">Devam et</button>' +
      "</div>"
    : yoneticiHizliForm();

  return '<p class="oyun-not">Serbest metin yazmak yerine önceden tanımlı özellik ' +
    "taslaklarından hangilerini dolduracağını seç. Detaylı metni sonra Karakterler " +
    "sekmesinden genişletebilirsin.</p>" +
    govde;
}

function yoneticiHizliForm() {
  const alanSecici = HIZLI_ALAN_TIPLERI.map(function (a) {
    const secili = !!yoneticiHizliAlanlar[a.id];
    return '<label class="y-alan-secim">' +
             '<input type="checkbox" data-y-hizli-alan="' + a.id + '"' + (secili ? " checked" : "") + "> " +
             kacir(a.ad) +
           "</label>";
  }).join("");

  const yapimlar = veri.yapimlar || [];

  const girdiler = HIZLI_ALAN_TIPLERI.filter(function (a) { return yoneticiHizliAlanlar[a.id]; })
    .map(function (a) {
      /* "Bulunduğu hikâyeler" serbest metin değil, var olan yapımlardan seçim. */
      if (a.id === "hikayeler") {
        const yapimSecici = yapimlar.length
          ? '<div class="y-alan-izgara y-karakter-izgara">' +
              yapimlar.map(function (y, i) {
                const secili = !!yoneticiHizliYapimlar[i];
                return '<label class="y-alan-secim">' +
                         '<input type="checkbox" data-y-hizli-yapim="' + i + '"' +
                           (secili ? " checked" : "") + "> " + kacir(y.ad) +
                           ' <span class="oyun-not">(' + kacir(y.tur) + ")</span>" +
                       "</label>";
              }).join("") +
            "</div>"
          : '<p class="oyun-not">Henüz yapım eklenmedi — Yapım Ekle sekmesinden ekleyebilirsin.</p>';
        return "<label>" + kacir(a.ad) + "</label>" + yapimSecici;
      }

      /* "Yaşadığı şehir" var olan yerlerden seçilir, ya da yenisi eklenir. */
      if (a.id === "sehir") {
        const tumSehirler = tumHaritaYerleri().filter(function (y) { return y.tur === "Şehir"; });
        const haritalar = veri.haritalar || [];

        const sehirIcerik = yoneticiHizliSehirYeni
          ? '<input class="kod-giris arac-giris" id="yHizliSehirYeniAd" placeholder="yeni şehir adı" ' +
              'value="' + kacir(yoneticiHizliSehirYeniAd) + '">' +
            (haritalar.length > 1
              ? '<select class="kod-giris arac-giris" id="yHizliSehirYeniHarita">' +
                  haritalar.map(function (h, i) {
                    return '<option value="' + i + '"' +
                           (String(i) === yoneticiHizliSehirYeniHarita ? " selected" : "") + ">" +
                           kacir(h.ad) + "</option>";
                  }).join("") +
                "</select>"
              : "") +
            '<button class="dugme dugme-sade" data-y-hizli-sehir-iptal="1">İptal, listeden seç</button>'
          : '<select class="kod-giris arac-giris" id="yHizliSehirSec">' +
              '<option value="">— seçilmedi —</option>' +
              tumSehirler.map(function (y) {
                const gorunen = yerGorunenAd(y);
                return '<option value="' + kacir(gorunen) + '"' +
                       (gorunen === yoneticiHizliSehir ? " selected" : "") + ">" + kacir(gorunen) + "</option>";
              }).join("") +
            "</select>" +
            '<button class="dugme dugme-sade" data-y-hizli-sehir-yeni="1">+ Yeni şehir ekle</button>';

        return "<label>" + kacir(a.ad) + "</label>" + sehirIcerik;
      }

      return "<label>" + kacir(a.ad) + "</label>" +
             '<input class="kod-giris arac-giris" data-y-hizli-deger="' + a.id + '" ' +
               'id="yHizli_' + a.id + '">';
    }).join("");

  return '<div class="kutu-y">' +
      "<label>Karakter: <b>" + kacir(yoneticiHizliAd) + "</b></label>" +
      '<button class="dugme dugme-sade" data-y-hizli-ad-degistir="1">İsmi değiştir</button>' +
    "</div>" +
    '<div class="kutu-y">' +
      "<label>2. Taslaktan özellik seç</label>" +
      '<p class="oyun-not">Hiçbirini seçmesen de sadece isimle hızlıca ekleyebilirsin.</p>' +
      '<div class="y-alan-izgara">' + alanSecici + "</div>" +
    "</div>" +
    '<div class="kutu-y">' +
      "<label>3. Grup ve varsa bilgiler</label>" +
      "<label>Grup</label>" +
      '<input class="kod-giris arac-giris" id="yHizliGrup" value="' + kacir(yoneticiHizliGrupGiris) +
        '" placeholder="ör. Blero, Kütüphane, Luyot">' +
      girdiler +
      '<button class="dugme" data-y-hizli-ekle="1">Hızlıca ekle</button>' +
    "</div>" +
    yoneticiHizliIliskiBolumu();
}

/** Henüz kaydedilmemiş karakter için, var olan başka karakterlerle ilişki
    tanımlamayı sağlar. Birden fazla ilişki eklenebilir; hepsi karakterle
    birlikte kaydedilir. */
function yoneticiHizliIliskiBolumu() {
  const digerKarakterler = veri.karakterler || [];
  if (!digerKarakterler.length) { return ""; }

  const secenek = digerKarakterler.map(function (k) {
    return '<option value="' + kacir(k.id) + '"' + (k.id === yoneticiHizliIliskiHedef ? " selected" : "") + ">" +
           kacir(k.ad) + "</option>";
  }).join("");

  const listeHtml = yoneticiHizliIliskiler.length
    ? '<div class="y-blok-liste">' +
        yoneticiHizliIliskiler.map(function (item, i) {
          const hedef = digerKarakterler.find(function (k) { return k.id === item.hedefId; });
          return '<div class="y-blok-satir">' +
                   '<span class="y-blok-baslik">' + kacir(hedef ? hedef.ad : item.hedefId) + "</span>" +
                   '<span class="y-blok-katman">' + kacir(item.etiket) + (item.gizli ? " · gizli" : "") + "</span>" +
                   '<button class="dugme dugme-sade y-sil" data-y-hizli-iliski-sil="' + i + '">sil</button>' +
                 "</div>";
        }).join("") +
      "</div>"
    : "";

  return '<div class="kutu-y">' +
      "<label>4. İlişki ekle (opsiyonel)</label>" +
      listeHtml +
      '<select class="kod-giris arac-giris" id="yHizliIliskiHedef">' + secenek + "</select>" +
      '<input class="kod-giris arac-giris" id="yHizliIliskiEtiket" value="' + kacir(yoneticiHizliIliskiEtiket) +
        '" placeholder="ör. kuzeni, arkadaşı, düşmanı">' +
      '<label class="y-alan-secim"><input type="checkbox" id="yHizliIliskiGizli"' +
        (yoneticiHizliIliskiGizli ? " checked" : "") + "> Gizli (spoiler) bağ</label>" +
      '<button class="dugme dugme-sade" data-y-hizli-iliski-ekle="1">+ İlişki ekle</button>' +
    "</div>";
}

/** Girilen alanlardan otomatik bir özet cümlesi kurar. */
function hizliOzetKur(ad, degerler) {
  const parca = [];
  if (degerler.hikayedeRol) { parca.push(degerler.hikayedeRol); }
  if (degerler.meslek) { parca.push(degerler.meslek); }
  if (degerler.yas) { parca.push(degerler.yas + " yaşında"); }
  return parca.length ? parca.join(", ") + "." : "Henüz ayrıntı eklenmedi.";
}

/** Girilen alanlardan okunabilir bir taslak paragraf kurar. Admin sonra
    Karakterler sekmesinden bunu genişletebilir. */
function hizliDetayKur(ad, degerler, yapimListesi) {
  const cumleler = [];
  if (degerler.soyad) { cumleler.push("Tam adı " + ad + " " + degerler.soyad + "."); }
  if (degerler.aile) { cumleler.push(ad + " — " + degerler.aile + "."); }
  if (degerler.boy) { cumleler.push("Boyu " + degerler.boy + "."); }
  if (degerler.sehir) { cumleler.push(degerler.sehir + " şehrinde yaşıyor."); }
  if (yapimListesi && yapimListesi.length) { cumleler.push(yapimListesi.join(", ") + " içinde geçiyor."); }
  return cumleler.join(" ") || "";
}

function yoneticiHizliEkle() {
  const ad = yoneticiHizliAd;
  const grup = yoneticiHizliGrupGiris;

  const degerler = {};
  HIZLI_ALAN_TIPLERI.forEach(function (a) {
    if (!yoneticiHizliAlanlar[a.id] || a.id === "hikayeler" || a.id === "sehir") { return; }
    const el = document.querySelector('[data-y-hizli-deger="' + a.id + '"]');
    if (el && el.value.trim()) { degerler[a.id] = el.value.trim(); }
  });

  /* Sehir: ya var olan bir yerden secildi, ya da burada yeni bir yer olarak
     kuruldu. Yeni sehir, secilen (ya da tek varsa ilk) haritaya eklenir;
     konumu sonradan Harita Duzenle'den ayarlanabilir. */
  if (yoneticiHizliAlanlar.sehir) {
    if (yoneticiHizliSehirYeni) {
      const yeniSehirAd = (document.querySelector("#yHizliSehirYeniAd") || {}).value || "";
      if (yeniSehirAd.trim()) {
        const haritaIndeks = parseInt((document.querySelector("#yHizliSehirYeniHarita") || {}).value || "0", 10);
        const h = (veri.haritalar || [])[haritaIndeks] || (veri.haritalar || [])[0];
        if (h) {
          if (!h.yerler) { h.yerler = []; }
          const yeniYer = {
            id: "y_" + yeniSehirAd.trim().toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]+/gi, "").slice(0, 20),
            ad: yeniSehirAd.trim(), tur: "Şehir", x: 50, y: 50, not: "",
          };
          h.yerler.push(yeniYer);
          degerler.sehir = yerGorunenAd(yeniYer);
        }
      }
    } else {
      const secilenSehir = (document.querySelector("#yHizliSehirSec") || {}).value || "";
      if (secilenSehir) { degerler.sehir = secilenSehir; }
    }
  }

  const secilenIndeksler = Object.keys(yoneticiHizliYapimlar).filter(function (i) { return yoneticiHizliYapimlar[i]; });
  const tumYapimlar = veri.yapimlar || [];
  const secilenYapimlar = [];
  secilenIndeksler.forEach(function (i) {
    const y = tumYapimlar[parseInt(i, 10)];
    if (y) { secilenYapimlar.push(yapimGorunenAd(y)); }
  });

  const id = "k_" + ad.toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]+/gi, "").slice(0, 24);

  if ((veri.karakterler || []).some(function (k) { return k.id === id; })) {
    yoneticiDurum("Bu isimde bir kart zaten var", false);
    return;
  }

  const yeni = {
    id: id,
    ad: ad,
    unvan: degerler.hikayedeRol || "",
    grup: grup || "Diğer",
    ozet: hizliOzetKur(ad, degerler),
    detay: hizliDetayKur(ad, degerler, secilenYapimlar),
    ozellikler: Object.keys(degerler).length ? degerler : undefined,
    yapimlar: secilenYapimlar.length ? secilenYapimlar : undefined,
    gizli: null,
    gorsel: null,
    ses: null,
  };

  veri.karakterler.push(yeni);

  /* Bekleyen iliskileri de ekle. */
  if (yoneticiHizliIliskiler.length) {
    agDugumSagla(yeni);
    yoneticiHizliIliskiler.forEach(function (item) {
      const hedef = (veri.karakterler || []).find(function (k) { return k.id === item.hedefId; });
      if (!hedef) { return; }
      agDugumSagla(hedef);
      if (!veri.ag.baglar) { veri.ag.baglar = []; }
      const bag = { a: yeni.id, b: hedef.id, etiket: item.etiket };
      if (item.gizli) { bag.gizli = true; }
      veri.ag.baglar.push(bag);
    });
  }

  yoneticiHizliAd = "";
  yoneticiHizliAlanlar = {};
  yoneticiHizliYapimlar = {};
  yoneticiHizliSehir = ""; yoneticiHizliSehirYeni = false; yoneticiHizliSehirYeniAd = "";
  yoneticiHizliGrupGiris = "";
  yoneticiHizliIliskiler = []; yoneticiHizliIliskiHedef = ""; yoneticiHizliIliskiEtiket = ""; yoneticiHizliIliskiGizli = false;
  yoneticiDurum("\"" + ad + "\" eklendi — Karakterler sekmesinden genişletebilirsin", true);
  arsiviTazele();
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-hizli-ad-devam]")) {
    const el = document.querySelector("#yHizliAd");
    const ad = el ? el.value.trim() : "";
    if (!ad) { yoneticiDurum("İsim gerekli", false); return; }
    yoneticiHizliAd = ad;
    yoneticiCiz();
    return;
  }

  if (e.target.closest("[data-y-hizli-ad-degistir]")) {
    yoneticiHizliAd = "";
    yoneticiHizliAlanlar = {};
    yoneticiHizliYapimlar = {};
    yoneticiHizliSehir = ""; yoneticiHizliSehirYeni = false; yoneticiHizliSehirYeniAd = "";
    yoneticiHizliGrupGiris = "";
    yoneticiHizliIliskiler = []; yoneticiHizliIliskiHedef = ""; yoneticiHizliIliskiEtiket = ""; yoneticiHizliIliskiGizli = false;
    yoneticiCiz();
    return;
  }

  if (e.target.closest("[data-y-hizli-sehir-yeni]")) { yoneticiHizliSehirYeni = true; yoneticiCiz(); return; }
  if (e.target.closest("[data-y-hizli-sehir-iptal]")) {
    yoneticiHizliSehirYeni = false; yoneticiHizliSehirYeniAd = ""; yoneticiCiz(); return;
  }

  if (e.target.closest("[data-y-hizli-iliski-ekle]")) {
    const hedefId = (document.querySelector("#yHizliIliskiHedef") || {}).value || "";
    const etiket = ((document.querySelector("#yHizliIliskiEtiket") || {}).value || "").trim();
    const gizli = (document.querySelector("#yHizliIliskiGizli") || {}).checked;

    if (!hedefId || !etiket) { yoneticiDurum("Hedef karakter ve ilişki etiketi gerekli", false); return; }

    yoneticiHizliIliskiler.push({ hedefId: hedefId, etiket: etiket, gizli: gizli });
    yoneticiHizliIliskiEtiket = "";
    yoneticiHizliIliskiGizli = false;
    yoneticiCiz();
    return;
  }

  const iliskiSil = e.target.closest("[data-y-hizli-iliski-sil]");
  if (iliskiSil) {
    yoneticiHizliIliskiler.splice(parseInt(iliskiSil.dataset.yHizliIliskiSil, 10), 1);
    yoneticiCiz();
    return;
  }

  if (e.target.closest("[data-y-hizli-ekle]")) { yoneticiHizliEkle(); }
});

document.addEventListener("change", function (e) {
  const alan = e.target.closest("[data-y-hizli-alan]");
  if (alan) { yoneticiHizliAlanlar[alan.dataset.yHizliAlan] = alan.checked; yoneticiCiz(); return; }

  const yapim = e.target.closest("[data-y-hizli-yapim]");
  if (yapim) { yoneticiHizliYapimlar[yapim.dataset.yHizliYapim] = yapim.checked; return; }

  if (e.target.id === "yHizliSehirSec") { yoneticiHizliSehir = e.target.value; return; }
  if (e.target.id === "yHizliSehirYeniHarita") { yoneticiHizliSehirYeniHarita = e.target.value; return; }
  if (e.target.id === "yHizliIliskiHedef") { yoneticiHizliIliskiHedef = e.target.value; return; }
  if (e.target.id === "yHizliIliskiGizli") { yoneticiHizliIliskiGizli = e.target.checked; }
});

document.addEventListener("input", function (e) {
  if (e.target.id === "yHizliSehirYeniAd") { yoneticiHizliSehirYeniAd = e.target.value; return; }
  if (e.target.id === "yHizliGrup") { yoneticiHizliGrupGiris = e.target.value; return; }
  if (e.target.id === "yHizliIliskiEtiket") { yoneticiHizliIliskiEtiket = e.target.value; }
});

/* ==================== YAPIM EKLE ====================
   Kitap, Roman, Seri, Çizgi Roman, Animasyon, Film seçeneklerinden hızlıca
   yeni bir yapım ekler ve içinde geçen karakterleri işaretler. İşaretlenen
   karakterlerin kartına "yer aldığı yapımlar" olarak yansır. */

const YAPIM_TURLERI = ["Kitap", "Roman", "Seri", "Çizgi Roman", "Çizgi Dizi", "Animasyon", "Dizi", "Film", "Oyun"];
const YAPIM_DURUMLARI = ["Fikir", "Planda", "Yazımda", "Yapımda", "Yayında"];

let yoneticiYapimTurler = {};    /* { Kitap: true, Roman: true, ... } */
let yoneticiYapimKarakterler = {}; /* { karakterId: true, ... } */

function yoneticiYapimEkle() {
  const karakterler = veri.karakterler || [];

  const turSecici = YAPIM_TURLERI.map(function (t) {
    const secili = !!yoneticiYapimTurler[t];
    return '<label class="y-alan-secim">' +
             '<input type="checkbox" data-y-yapim-tur="' + kacir(t) + '"' + (secili ? " checked" : "") + "> " +
             kacir(t) +
           "</label>";
  }).join("");

  const durumSecenek = YAPIM_DURUMLARI.map(function (d) {
    return '<option value="' + kacir(d) + '">' + kacir(d) + "</option>";
  }).join("");

  const karakterSecici = karakterler.map(function (k) {
    const secili = !!yoneticiYapimKarakterler[k.id];
    return '<label class="y-alan-secim">' +
             '<input type="checkbox" data-y-yapim-karakter="' + kacir(k.id) + '"' +
               (secili ? " checked" : "") + "> " +
             kacir(k.ad) +
           "</label>";
  }).join("");

  return '<p class="oyun-not">Yeni bir yapım ekle ve içinde geçen karakterleri işaretle. ' +
    "İşaretlenen karakterlerin kartında \"yer aldığı yapımlar\" olarak görünür.</p>" +
    '<div class="kutu-y">' +
      "<label>1. Tür — birden fazla seçebilirsin</label>" +
      '<div class="y-alan-izgara">' + turSecici + "</div>" +
    "</div>" +
    '<div class="kutu-y">' +
      "<label>2. Ad</label>" +
      '<input class="kod-giris arac-giris" id="yYapimAd" placeholder="ör. Delilik 3">' +
      "<label>Sınıf</label>" +
      '<select class="kod-giris arac-giris" id="yYapimSinif">' +
        '<option value="UH">UH — ana evren</option>' +
        '<option value="UD">UD — Uzaylı Günlükleri</option>' +
      "</select>" +
      "<label>Durum</label>" +
      '<select class="kod-giris arac-giris" id="yYapimDurum">' + durumSecenek + "</select>" +
      "<label>Not</label>" +
      '<textarea class="kod-giris arac-giris" id="yYapimNot" rows="3" ' +
        'placeholder="kısa açıklama"></textarea>' +
    "</div>" +
    '<div class="kutu-y">' +
      "<label>3. İçinde geçen karakterler</label>" +
      '<div class="y-alan-izgara y-karakter-izgara">' + (karakterSecici || "<p class=\"oyun-not\">Henüz karakter yok.</p>") + "</div>" +
    "</div>" +
    '<button class="dugme" data-y-yapim-ekle="1">Hızlıca ekle</button>' +

    yoneticiYapimListesi() +
    yoneticiCrossoverAlani();
}

/** Var olan yapımları listeler, silinebilir yapar. Silme, o yapımı
    etiketleyen karakterlerin "yer aldığı yapımlar" listesinden de temizler
    ve o yapımı kullanan crossoverları da kaldırır — kopuk referans kalmasın. */
function yoneticiYapimListesi() {
  const yapimlar = veri.yapimlar || [];
  if (!yapimlar.length) { return ""; }

  return '<div class="kutu-y">' +
      "<label>Var olan yapımlar — " + yapimlar.length + " adet</label>" +
      '<div class="y-blok-liste">' +
        yapimlar.map(function (y, i) {
          return '<div class="y-blok-satir">' +
                   '<span class="y-blok-katman">' + kacir(y.tur) + "</span>" +
                   '<span class="y-blok-baslik">' + kacir(y.ad) + "</span>" +
                   '<button class="dugme dugme-sade y-sil" data-y-yapim-sil="' + i + '">sil</button>' +
                 "</div>";
        }).join("") +
      "</div>" +
    "</div>";
}

function yoneticiYapimSil(indeks) {
  const yapimlar = veri.yapimlar || [];
  const y = yapimlar[indeks];
  if (!y) { return; }

  const gorunenAd = typeof yapimGorunenAd === "function" ? yapimGorunenAd(y) : y.ad;

  veri.yapimlar.splice(indeks, 1);
  (veri.karakterler || []).forEach(function (k) {
    if (k.yapimlar) { k.yapimlar = k.yapimlar.filter(function (ad) { return ad !== gorunenAd; }); }
  });
  if (veri.crossoverlar) {
    veri.crossoverlar = veri.crossoverlar.filter(function (c) { return c.a !== gorunenAd && c.b !== gorunenAd; });
  }

  yoneticiDurum("\"" + y.ad + "\" silindi", true);
  arsiviTazele();
  if (typeof cizYapimlar === "function") { cizYapimlar(); }
  yoneticiCiz();
}

/* ==================== CROSSOVER ====================
   İki ayrı yapım arasında bağ kurar: bölümün gidişatı ve crossover nedeni
   gibi anlatısal bilgilerle. */

let yoneticiCrossoverA = "";   /* secili yapimin INDEKSI (string), isim degil */
let yoneticiCrossoverB = "";
let yoneticiCrossoverDuzenle = null;   /* duzenlenen crossover'in indeksi, ya da null */

function yoneticiCrossoverAlani() {
  const yapimlar = veri.yapimlar || [];
  const crossoverlar = veri.crossoverlar || [];

  if (yapimlar.length < 2) {
    return '<div class="kutu-y">' +
        "<label>Crossover ekle</label>" +
        '<p class="oyun-not">Crossover eklemek için en az iki yapım gerekiyor.</p>' +
      "</div>";
  }

  const secenek = function (seciliIndeks) {
    return yapimlar.map(function (y, i) {
      return '<option value="' + i + '"' + (String(i) === seciliIndeks ? " selected" : "") + ">" +
             kacir(y.ad) + " (" + kacir(y.tur) + ")</option>";
    }).join("");
  };

  const listeHtml = crossoverlar.length
    ? '<div class="y-blok-liste">' +
        crossoverlar.map(function (c, i) {
          if (yoneticiCrossoverDuzenle === i) {
            return '<div class="y-blok-editor">' +
                "<label>" + kacir(c.a) + " × " + kacir(c.b) + "</label>" +
                "<label>Bölümün gidişatı</label>" +
                '<textarea class="kod-giris arac-giris" id="yCrossDuzenleGidisat" rows="3">' +
                  kacir(c.gidisat) + "</textarea>" +
                "<label>Crossover nedeni</label>" +
                '<textarea class="kod-giris arac-giris" id="yCrossDuzenleNeden" rows="2">' +
                  kacir(c.neden || "") + "</textarea>" +
                '<div class="oyun-sira">' +
                  '<button class="dugme" data-y-cross-duzenle-kaydet="' + i + '">Kaydet</button>' +
                  '<button class="dugme dugme-sade" data-y-cross-duzenle-iptal="1">İptal</button>' +
                "</div>" +
              "</div>";
          }
          return '<div class="y-blok-satir">' +
                   '<span class="y-blok-baslik">' + kacir(c.a) + " × " + kacir(c.b) + "</span>" +
                   '<button class="dugme dugme-sade" data-y-cross-duzenle="' + i + '">düzenle</button>' +
                   '<button class="dugme dugme-sade y-sil" data-y-cross-sil="' + i + '">sil</button>' +
                 "</div>";
        }).join("") +
      "</div>"
    : "";

  return '<div class="kutu-y">' +
      "<label>Crossover ekle — iki yapımı birbirine bağla</label>" +
      '<div class="sohbet-secim">' +
        '<select class="kod-giris arac-giris" id="yCrossA">' + secenek(yoneticiCrossoverA) + "</select>" +
        '<select class="kod-giris arac-giris" id="yCrossB">' + secenek(yoneticiCrossoverB) + "</select>" +
      "</div>" +
      "<label>Bölümün gidişatı</label>" +
      '<textarea class="kod-giris arac-giris" id="yCrossGidisat" rows="3" ' +
        'placeholder="crossover sırasında ne oluyor, hikâye nasıl ilerliyor"></textarea>' +
      "<label>Crossover nedeni</label>" +
      '<textarea class="kod-giris arac-giris" id="yCrossNeden" rows="2" ' +
        'placeholder="bu iki yapım neden bir araya geliyor"></textarea>' +
      '<button class="dugme" data-y-cross-ekle="1">Crossover ekle</button>' +
    "</div>" +

    (crossoverlar.length
      ? '<div class="kutu-y">' +
          "<label>Var olan crossoverlar — " + crossoverlar.length + "</label>" +
          listeHtml +
        "</div>"
      : "");
}

function yoneticiCrossoverDuzenleKaydet(i) {
  const c = (veri.crossoverlar || [])[i];
  if (!c) { return; }

  const gidisat = (document.querySelector("#yCrossDuzenleGidisat") || {}).value || "";
  if (!gidisat.trim()) { yoneticiDurum("Bölümün gidişatı gerekli", false); return; }

  c.gidisat = gidisat.trim();
  c.neden = ((document.querySelector("#yCrossDuzenleNeden") || {}).value || "").trim();

  yoneticiCrossoverDuzenle = null;
  yoneticiDurum("Crossover güncellendi", true);
  arsiviTazele();
  if (typeof cizYapimlar === "function") { cizYapimlar(); }
  yoneticiCiz();
}

function yoneticiCrossoverKaydet() {
  const aIndeks = (document.querySelector("#yCrossA") || {}).value || "";
  const bIndeks = (document.querySelector("#yCrossB") || {}).value || "";
  const gidisat = (document.querySelector("#yCrossGidisat") || {}).value || "";
  const neden = (document.querySelector("#yCrossNeden") || {}).value || "";

  const yapimlar = veri.yapimlar || [];
  const yA = yapimlar[parseInt(aIndeks, 10)];
  const yB = yapimlar[parseInt(bIndeks, 10)];

  if (!yA || !yB || aIndeks === bIndeks) { yoneticiDurum("İki farklı yapım seç", false); return; }
  if (!gidisat.trim()) { yoneticiDurum("Bölümün gidişatı gerekli", false); return; }

  const a = yapimGorunenAd(yA), b = yapimGorunenAd(yB);

  if (!veri.crossoverlar) { veri.crossoverlar = []; }
  veri.crossoverlar.push({ a: a, b: b, gidisat: gidisat.trim(), neden: neden.trim() });

  yoneticiCrossoverA = aIndeks; yoneticiCrossoverB = bIndeks;
  yoneticiDurum("\"" + a + "\" × \"" + b + "\" crossover'ı eklendi", true);
  arsiviTazele();
  if (typeof cizYapimlar === "function") { cizYapimlar(); }
  yoneticiCiz();
}

function yoneticiCrossoverSil(indeks) {
  if (!veri.crossoverlar) { return; }
  veri.crossoverlar.splice(indeks, 1);
  yoneticiDurum("Crossover silindi", true);
  arsiviTazele();
  if (typeof cizYapimlar === "function") { cizYapimlar(); }
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-cross-ekle]")) { yoneticiCrossoverKaydet(); return; }

  const sil = e.target.closest("[data-y-cross-sil]");
  if (sil) { yoneticiCrossoverSil(parseInt(sil.dataset.yCrossSil, 10)); return; }

  const duzenle = e.target.closest("[data-y-cross-duzenle]");
  if (duzenle) { yoneticiCrossoverDuzenle = parseInt(duzenle.dataset.yCrossDuzenle, 10); yoneticiCiz(); return; }

  const duzenleKaydet = e.target.closest("[data-y-cross-duzenle-kaydet]");
  if (duzenleKaydet) { yoneticiCrossoverDuzenleKaydet(parseInt(duzenleKaydet.dataset.yCrossDuzenleKaydet, 10)); return; }

  if (e.target.closest("[data-y-cross-duzenle-iptal]")) { yoneticiCrossoverDuzenle = null; yoneticiCiz(); return; }

  const yapimSil = e.target.closest("[data-y-yapim-sil]");
  if (yapimSil) { yoneticiYapimSil(parseInt(yapimSil.dataset.yYapimSil, 10)); }
});

let yoneticiYapimAyniIsimOnay = "";  /* ayni-isim uyarisi sonrasi "yine de ekle" onayi bekleyen ad */

function yoneticiYapimKaydet() {
  const ad = (document.querySelector("#yYapimAd") || {}).value || "";
  const sinif = (document.querySelector("#yYapimSinif") || {}).value || "UH";
  const durum = (document.querySelector("#yYapimDurum") || {}).value || "Fikir";
  const not_ = (document.querySelector("#yYapimNot") || {}).value || "";

  if (!ad.trim()) { yoneticiDurum("Yapımın adı gerekli", false); return; }

  const turler = YAPIM_TURLERI.filter(function (t) { return yoneticiYapimTurler[t]; });
  if (!turler.length) { yoneticiDurum("En az bir tür seç", false); return; }

  const mevcutAyniIsim = (veri.yapimlar || []).find(function (y) { return y.ad === ad.trim(); });
  if (mevcutAyniIsim && yoneticiYapimAyniIsimOnay !== ad.trim()) {
    yoneticiYapimAyniIsimOnay = ad.trim();
    yoneticiDurum("\"" + ad.trim() + "\" adında zaten bir yapım var (" + mevcutAyniIsim.tur +
      "). Yine de eklemek için \"Hızlıca ekle\"ye tekrar bas.", false);
    return;
  }
  yoneticiYapimAyniIsimOnay = "";

  const karakterIdleri = Object.keys(yoneticiYapimKarakterler).filter(function (id) {
    return yoneticiYapimKarakterler[id];
  });

  if (!veri.yapimlar) { veri.yapimlar = []; }
  const yeniYapim = { ad: ad.trim(), tur: turler.join(" + "), sinif: sinif, durum: durum, not: not_.trim() };
  veri.yapimlar.push(yeniYapim);

  const etiketAdi = yapimGorunenAd(yeniYapim);
  karakterIdleri.forEach(function (id) {
    const k = (veri.karakterler || []).find(function (x) { return x.id === id; });
    if (!k) { return; }
    if (!k.yapimlar) { k.yapimlar = []; }
    if (k.yapimlar.indexOf(etiketAdi) === -1) { k.yapimlar.push(etiketAdi); }
  });

  yoneticiYapimTurler = {};
  yoneticiYapimKarakterler = {};
  yoneticiYapimAyniIsimOnay = "";

  yoneticiDurum("\"" + ad.trim() + "\" eklendi" +
    (karakterIdleri.length ? " — " + karakterIdleri.length + " karaktere işlendi" : ""), true);
  arsiviTazele();
  if (typeof cizYapimlar === "function") { cizYapimlar(); }
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-yapim-ekle]")) { yoneticiYapimKaydet(); }
});

document.addEventListener("change", function (e) {
  const tur = e.target.closest("[data-y-yapim-tur]");
  if (tur) { yoneticiYapimTurler[tur.dataset.yYapimTur] = tur.checked; return; }

  const kar = e.target.closest("[data-y-yapim-karakter]");
  if (kar) { yoneticiYapimKarakterler[kar.dataset.yYapimKarakter] = kar.checked; }
});

/* ==================== HARİTA DÜZENLE ====================
   Yönetici panelinden ayrı haritalar (Tömye dışında başka gezegen/bölge
   haritaları) eklenebilir; her haritaya kendi noktaları (şehir, kaynak,
   kıta vb.) ve haklarında bilgi girilebilir. */

const HARITA_TURLERI = ["Şehir", "Bölge", "Kıta", "Ada", "Su", "Kaynak", "Uzak"];

let yoneticiHaritaId = null;      /* düzenlenen haritanın id'si, null = liste görünümü */
let yoneticiHaritaYeniAd = "";    /* yeni harita oluşturma girişi */
let yoneticiHaritaNoktaDuzenle = null; /* null: kapalı, sayı: nokta indeksi, "yeni": yeni nokta */

function yoneticiHaritaDuzen() {
  if (!yoneticiHaritaId) { return yoneticiHaritaListesi(); }

  const h = (veri.haritalar || []).find(function (x) { return x.id === yoneticiHaritaId; });
  if (!h) { yoneticiHaritaId = null; return yoneticiHaritaListesi(); }

  return yoneticiHaritaIcerik(h);
}

let yoneticiHaritaSilOnay = null;

function yoneticiHaritaListesi() {
  const haritalar = veri.haritalar || [];

  return '<p class="oyun-not">Tömye dışında başka bir gezegen ya da bölge için ayrı bir ' +
    "harita ekleyebilirsin. Her haritanın kendi noktaları ve notları olur.</p>" +
    '<div class="y-blok-liste">' +
      haritalar.map(function (h) {
        return '<div class="y-blok-satir">' +
                 '<span class="y-blok-baslik">' + kacir(h.ad) + "</span>" +
                 '<span class="y-blok-katman">' + (h.yerler || []).length + " nokta</span>" +
                 '<button class="dugme dugme-sade" data-y-harita-ac="' + kacir(h.id) + '">düzenle</button>' +
                 (haritalar.length > 1
                   ? '<button class="dugme dugme-sade y-sil" data-y-harita-sil="' + kacir(h.id) + '">' +
                       (yoneticiHaritaSilOnay === h.id ? "emin misin?" : "sil") +
                     "</button>"
                   : "") +
               "</div>";
      }).join("") +
    "</div>" +
    '<div class="kutu-y">' +
      "<label>Yeni harita ekle</label>" +
      '<input class="kod-giris arac-giris" id="yHaritaYeniAd" placeholder="ör. Ax-24, Evrengezer evreni">' +
      '<button class="dugme" data-y-harita-yeni="1">Harita oluştur</button>' +
    "</div>";
}

/** Bir haritayı komple siler. En az bir harita her zaman kalmalı — site
    haritasız çalışamaz, o yüzden son haritanın silinmesine izin verilmez.
    Silinen haritadaki bir şehri "yaşadığı şehir" olarak gösteren karakterler
    varsa, referans kopmasın diye önce uyarır. */
function yoneticiHaritaSil(id) {
  const haritalar = veri.haritalar || [];
  if (haritalar.length <= 1) { yoneticiDurum("Son harita silinemez", false); return; }

  const h = haritalar.find(function (x) { return x.id === id; });
  if (!h) { return; }

  if (yoneticiHaritaSilOnay !== id) {
    const sehirAdlari = (h.yerler || []).filter(function (y) { return y.tur === "Şehir"; })
      .map(function (y) { return typeof yerGorunenAd === "function" ? yerGorunenAd(y) : y.ad; });
    const etkilenenKarakter = (veri.karakterler || []).filter(function (k) {
      return k.ozellikler && sehirAdlari.indexOf(k.ozellikler.sehir) !== -1;
    });

    yoneticiHaritaSilOnay = id;
    yoneticiDurum(
      etkilenenKarakter.length
        ? etkilenenKarakter.length + " karakterin yaşadığı şehir bu haritada. Yine de silmek için tekrar bas."
        : "\"" + h.ad + "\" silinecek. Emin isen tekrar bas.",
      false
    );
    yoneticiCiz();
    return;
  }

  veri.haritalar = haritalar.filter(function (x) { return x.id !== id; });
  if (yoneticiHaritaId === id) { yoneticiHaritaId = null; }
  yoneticiHaritaSilOnay = null;

  yoneticiDurum("\"" + h.ad + "\" haritası silindi", true);
  arsiviTazele();
  if (typeof haritaCiz === "function") { haritaCiz(); }
  yoneticiCiz();
}

function yoneticiHaritaIcerik(h) {
  const yerler = h.yerler || [];

  const noktaListesi = yerler.length
    ? '<div class="y-blok-liste">' +
        yerler.map(function (y, i) {
          return '<div class="y-blok-satir">' +
                   '<span class="y-blok-katman">' + kacir(y.tur) + "</span>" +
                   '<span class="y-blok-baslik">' + kacir(y.ad) + "</span>" +
                   '<button class="dugme dugme-sade" data-y-nokta-duzenle="' + i + '">düzenle</button>' +
                   '<button class="dugme dugme-sade y-sil" data-y-nokta-sil="' + i + '">sil</button>' +
                 "</div>";
        }).join("") +
      "</div>"
    : '<p class="oyun-not">Bu haritada henüz nokta yok.</p>';

  const editor = (yoneticiHaritaNoktaDuzenle !== null) ? yoneticiHaritaNoktaEditoru(h) : "";

  return '<button class="dugme dugme-sade" data-y-harita-geri="1">← Harita listesine dön</button>' +
    '<div class="kutu-y">' +
      "<label>Harita: <b>" + kacir(h.ad) + "</b></label>" +
      "<label>Açıklama</label>" +
      '<textarea class="kod-giris arac-giris" id="yHaritaAciklama" rows="2">' +
        kacir(h.aciklama || "") + "</textarea>" +
      '<button class="dugme dugme-sade" data-y-harita-aciklama-kaydet="1">Açıklamayı kaydet</button>' +
    "</div>" +
    yoneticiEvrenAyarKutusu(h) +
    '<div class="kutu-y">' +
      "<label>Noktalar — " + yerler.length + " adet</label>" +
      noktaListesi +
      (yoneticiHaritaNoktaDuzenle === null
        ? '<button class="dugme dugme-sade" data-y-nokta-yeni="1">+ Yeni nokta ekle</button>'
        : "") +
    "</div>" +
    editor;
}

function yoneticiHaritaOlustur() {
  const ad = (document.querySelector("#yHaritaYeniAd") || {}).value || "";
  if (!ad.trim()) { yoneticiDurum("Harita adı gerekli", false); return; }

  const id = "h_" + ad.trim().toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]+/gi, "").slice(0, 20);

  if (!veri.haritalar) { veri.haritalar = []; }
  if (veri.haritalar.some(function (h) { return h.id === id; })) {
    yoneticiDurum("Bu isimde bir harita zaten var", false);
    return;
  }

  veri.haritalar.push({ id: id, ad: ad.trim(), aciklama: "", yerler: [] });
  yoneticiHaritaId = id;
  yoneticiDurum("\"" + ad.trim() + "\" haritası oluşturuldu", true);
  arsiviTazele();
  if (typeof haritaCiz === "function") { haritaCiz(); }
  yoneticiCiz();
}

function yoneticiHaritaAciklamaKaydet() {
  const h = (veri.haritalar || []).find(function (x) { return x.id === yoneticiHaritaId; });
  if (!h) { return; }

  h.aciklama = (document.querySelector("#yHaritaAciklama") || {}).value || "";
  yoneticiDurum("Açıklama kaydedildi", true);
  arsiviTazele();
  if (typeof haritaCiz === "function") { haritaCiz(); }
}

/* ==================== EVREN AYARLARI ====================
   Her harita bir evrendir: türü, yatayda dönüp dönmediği, gün uzunluğu (gece gölgesi
   için), evrenin üç parçası (Evren Kitabı'ndaki kural / içerik / okuyucu), kilit ve sis. */

function yoneticiEvrenAyarKutusu(h) {
  const e = h.evren || {};
  const m = evrenMeta(h);
  const sayi = function (id, etiket, v, ipucu) {
    return '<label class="hf-alan"><span>' + etiket + '</span><input class="kod-giris arac-giris" type="number" step="any" id="' + id +
           '" value="' + (haritaSayi(v) ? v : "") + '" placeholder="' + kacir(ipucu) + '"></label>';
  };
  const metin = function (id, etiket, v, ipucu) {
    return "<label>" + etiket + '</label><textarea class="kod-giris arac-giris" id="' + id + '" rows="2" placeholder="' + kacir(ipucu) + '">' + kacir(v || "") + "</textarea>";
  };
  return '<div class="kutu-y">' +
    "<label>Evren ayarları</label>" +
    '<p class="oyun-not">Bu harita bir evren: gezegen, ayrı bir evren ya da bölge. Gün uzunluğu verirsen haritada gündüz–gece gölgesi çıkar.</p>' +
    '<label class="hf-alan"><span>Tür</span><select class="kod-giris arac-giris" id="yEvTur">' +
      Object.keys(HARITA_EVREN_TURLERI).map(function (t) {
        return '<option value="' + t + '"' + (m.tur === t ? " selected" : "") + ">" + HARITA_EVREN_TURLERI[t] + "</option>";
      }).join("") + "</select></label>" +
    '<label class="hf-onay"><input type="checkbox" id="yEvDonen"' + (m.donen ? " checked" : "") + "> Yatayda dönsün (dünya haritası gibi; kapalıysa düz harita)</label>" +
    '<label class="hf-onay"><input type="checkbox" id="yEvTakvim"' + (e.takvim === "tomye" ? " checked" : "") + "> Tömye takvimini kullan (gün ve yıl uzunluğu takvimden gelir)</label>" +
    '<div class="hf-cift">' +
      sayi("yEvGun", "Gün uzunluğu (saat)", e.gunSaat, "ör. 25") +
      sayi("yEvYil", "Yıl uzunluğu (gün)", e.yilGun, "ör. 310") +
    "</div>" +
    '<div class="hf-cift">' +
      sayi("yEvEgim", "Eksen eğikliği (°, görsel)", e.egim, "8") +
      sayi("yEvBoylam", "Saatin geçerli olduğu boylam (x)", e.saatBoylami, "ilk şehir") +
    "</div>" +
    '<p class="oyun-not">Her evren üç parçadan oluşur: kuralları, içeriği ve ikisini okuyup işleyen üçüncü parça. Boş bırakabilirsin.</p>' +
    metin("yEvKurallar", "Kurallar", e.kurallar, "bu evrenin kuralları") +
    metin("yEvIcerik", "İçerik", e.icerik, "bu evrenin içeriği") +
    metin("yEvOkuyucu", "Okuyucu", e.okuyucu, "ikisini okuyup işleyen parça") +
    '<label class="hf-alan"><span>Gizli (katman açılınca görünür)</span><select class="kod-giris arac-giris" id="yEvGizli">' +
      '<option value="">— herkese açık —</option>' +
      (veri.katmanlar || []).concat(veri.kisiselKatmanlar || []).map(function (k) {
        return '<option value="' + kacir(k.id) + '"' + (h.gizli === k.id ? " selected" : "") + ">" + kacir(k.ad) + "</option>";
      }).join("") + "</select></label>" +
    '<label class="hf-onay"><input type="checkbox" id="yEvSis"' + (e.sis ? " checked" : "") + "> Sisli: bir kapıdan geçilene kadar görünmez</label>" +
    '<button class="dugme" data-y-evren-kaydet="1">Evren ayarlarını kaydet</button>' +
  "</div>";
}

function yoneticiEvrenAyarKaydet() {
  const h = (veri.haritalar || []).find(function (x) { return x.id === yoneticiHaritaId; });
  if (!h) { return; }
  const al = function (id) { return document.querySelector("#" + id); };
  const sayi = function (id) { const v = parseFloat((al(id) || {}).value); return isNaN(v) ? null : v; };
  const e = { tur: al("yEvTur").value, donen: al("yEvDonen").checked };
  if (al("yEvTakvim").checked) { e.takvim = "tomye"; }
  [["gunSaat", "yEvGun"], ["yilGun", "yEvYil"], ["egim", "yEvEgim"], ["saatBoylami", "yEvBoylam"]].forEach(function (p) {
    const v = sayi(p[1]);
    if (v !== null) { e[p[0]] = v; }
  });
  [["kurallar", "yEvKurallar"], ["icerik", "yEvIcerik"], ["okuyucu", "yEvOkuyucu"]].forEach(function (p) {
    const v = al(p[1]).value.trim();
    if (v) { e[p[0]] = v; }
  });
  if (al("yEvSis").checked) { e.sis = true; }
  h.evren = e;
  const g = al("yEvGizli").value;
  if (g) { h.gizli = g; } else { delete h.gizli; }
  yoneticiDurum("Evren ayarları kaydedildi", true);
  arsiviTazele();
  if (typeof haritaCiz === "function") { haritaCiz(); }
  yoneticiCiz();
}

/* ---- nokta düzenleyicisi: yeni alanlar (yıl aralığı, gizli, sis, kapı) ---- */

let yoneticiNoktaTaslak = null;   /* kapı evreni seçilince form değerlerini korur */

function yoneticiNoktaFormOku() {
  const al = function (id) { return document.querySelector("#" + id); };
  const v = function (id) { return al(id) ? al(id).value : ""; };
  return {
    ad: v("yNoktaAd"), tur: v("yNoktaTur"), x: v("yNoktaX"), y: v("yNoktaY"), not: v("yNoktaNot"),
    baslangic: v("yNoktaBas"), bitis: v("yNoktaBit"), gizli: v("yNoktaGizli"),
    sis: al("yNoktaSis") ? al("yNoktaSis").checked : false,
    gecitH: v("yNoktaGecitH"), gecitY: v("yNoktaGecitY")
  };
}

function yoneticiHaritaNoktaEditoru(h) {
  const mevcut = (yoneticiHaritaNoktaDuzenle === "yeni")
    ? null : (h.yerler || [])[yoneticiHaritaNoktaDuzenle];
  const t = yoneticiNoktaTaslak || {
    ad: mevcut ? mevcut.ad : "", tur: mevcut ? mevcut.tur : "Şehir",
    x: mevcut ? mevcut.x : "50", y: mevcut ? mevcut.y : "50", not: mevcut ? mevcut.not : "",
    baslangic: mevcut && haritaSayi(mevcut.baslangic) ? mevcut.baslangic : "",
    bitis: mevcut && haritaSayi(mevcut.bitis) ? mevcut.bitis : "",
    gizli: mevcut ? (mevcut.gizli || "") : "", sis: !!(mevcut && mevcut.sis),
    gecitH: mevcut && mevcut.gecit ? mevcut.gecit.harita : "", gecitY: mevcut && mevcut.gecit ? (mevcut.gecit.yer || "") : ""
  };

  const turListesiTam = HARITA_TURLERI.concat(["Küçük Yerleşim"]).concat(
    t.tur && HARITA_TURLERI.indexOf(t.tur) === -1 && t.tur !== "Küçük Yerleşim" ? [t.tur] : []
  );
  const turSecenek = turListesiTam.map(function (x) {
    return '<option value="' + kacir(x) + '"' + (t.tur === x ? " selected" : "") + ">" + kacir(x) + "</option>";
  }).join("");
  const katmanlar = (veri.katmanlar || []).concat(veri.kisiselKatmanlar || []);
  const hedefH = (veri.haritalar || []).find(function (x) { return x.id === t.gecitH; });

  return '<div class="y-blok-editor">' +
      "<label>" + (mevcut ? "Nokta adı" : "Yeni nokta — adı") + "</label>" +
      '<input class="kod-giris arac-giris" id="yNoktaAd" value="' + kacir(t.ad) + '">' +
      "<label>Tür</label>" +
      '<select class="kod-giris arac-giris" id="yNoktaTur">' + turSecenek + "</select>" +
      '<p class="oyun-not">Konum (0–100 aralığında, haritanın sol-üstü 0,0). Haritada sürükleyerek de ayarlayabilirsin (Geliştirici modu).</p>' +
      '<div class="sohbet-secim">' +
        '<input class="kod-giris arac-giris" id="yNoktaX" type="number" step="any" min="0" max="100" placeholder="x" value="' + kacir(t.x) + '">' +
        '<input class="kod-giris arac-giris" id="yNoktaY" type="number" step="any" min="0" max="100" placeholder="y" value="' + kacir(t.y) + '">' +
      "</div>" +
      "<label>Not (hakkında bilgi)</label>" +
      '<textarea class="kod-giris arac-giris" id="yNoktaNot" rows="3">' + kacir(t.not) + "</textarea>" +
      '<p class="oyun-not">Zaman kaydırıcısı için: yer hangi yıllar arasında var? (Tömye yılı, boş = hep vardı / hâlâ var)</p>' +
      '<div class="sohbet-secim">' +
        '<input class="kod-giris arac-giris" id="yNoktaBas" type="number" step="1" placeholder="başlangıç yılı" value="' + kacir(t.baslangic) + '">' +
        '<input class="kod-giris arac-giris" id="yNoktaBit" type="number" step="1" placeholder="bitiş yılı" value="' + kacir(t.bitis) + '">' +
      "</div>" +
      "<label>Gizli (katman açılınca görünür)</label>" +
      '<select class="kod-giris arac-giris" id="yNoktaGizli"><option value="">— herkese açık —</option>' +
        katmanlar.map(function (k) { return '<option value="' + kacir(k.id) + '"' + (t.gizli === k.id ? " selected" : "") + ">" + kacir(k.ad) + "</option>"; }).join("") +
      "</select>" +
      '<label class="hf-onay"><input type="checkbox" id="yNoktaSis"' + (t.sis ? " checked" : "") + "> Sisli: yaklaşıp bakana kadar görünmez</label>" +
      "<label>Kapı: bu yer başka bir evrene açılır mı?</label>" +
      '<select class="kod-giris arac-giris" id="yNoktaGecitH"><option value="">— kapı değil —</option>' +
        (veri.haritalar || []).map(function (x) { return '<option value="' + kacir(x.id) + '"' + (x.id === t.gecitH ? " selected" : "") + ">" + kacir(x.ad) + "</option>"; }).join("") +
      "</select>" +
      (hedefH
        ? '<select class="kod-giris arac-giris" id="yNoktaGecitY"><option value="">— evrenin başı —</option>' +
            (hedefH.yerler || []).filter(function (p) { return p.tur !== "Kıta"; }).map(function (p) {
              return '<option value="' + kacir(p.id) + '"' + (t.gecitY === p.id ? " selected" : "") + ">" + kacir(p.ad) + "</option>";
            }).join("") + "</select>"
        : "") +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-y-nokta-kaydet="1">Kaydet</button>' +
        '<button class="dugme dugme-sade" data-y-nokta-iptal="1">İptal</button>' +
      "</div>" +
    "</div>";
}

/** Noktayı yerinde günceller; kıta şekli, etiket konumu gibi bu formda olmayan alanlar korunur. */
function yoneticiHaritaNoktaKaydet() {
  const h = (veri.haritalar || []).find(function (x) { return x.id === yoneticiHaritaId; });
  if (!h) { return; }

  const f = yoneticiNoktaFormOku();
  const x = parseFloat(f.x), y = parseFloat(f.y);
  if (!f.ad.trim()) { yoneticiDurum("Noktanın adı gerekli", false); return; }
  if (isNaN(x) || isNaN(y) || x < 0 || x > 100 || y < 0 || y > 100) {
    yoneticiDurum("Konum 0-100 arasında iki sayı olmalı", false);
    return;
  }

  if (!h.yerler) { h.yerler = []; }
  const yeni = yoneticiHaritaNoktaDuzenle === "yeni";
  const yer = yeni ? { id: haritaYerId(f.ad) } : h.yerler[yoneticiHaritaNoktaDuzenle];
  const eskiGorunen = yeni ? null : yerGorunenAd(yer);

  yer.ad = f.ad.trim(); yer.tur = f.tur || "Şehir"; yer.x = x; yer.y = y; yer.not = f.not.trim();
  const opsiyonel = function (anahtar, deger, sayiMi) {
    const d = sayiMi ? parseFloat(deger) : deger;
    if (sayiMi ? isNaN(d) : !d) { delete yer[anahtar]; } else { yer[anahtar] = d; }
  };
  opsiyonel("baslangic", f.baslangic, true);
  opsiyonel("bitis", f.bitis, true);
  opsiyonel("gizli", f.gizli, false);
  if (f.sis) { yer.sis = true; } else { delete yer.sis; }
  if (f.gecitH) { yer.gecit = { harita: f.gecitH, yer: f.gecitY || "" }; } else { delete yer.gecit; }

  if (yeni) { h.yerler.push(yer); }
  else if (eskiGorunen !== null) {
    const yeniGorunen = yerGorunenAd(yer);
    if (yeniGorunen !== eskiGorunen) {
      (veri.karakterler || []).forEach(function (k) {
        if (k.ozellikler && k.ozellikler.sehir === eskiGorunen) { k.ozellikler.sehir = yeniGorunen; }
      });
    }
  }

  yoneticiHaritaNoktaDuzenle = null;
  yoneticiNoktaTaslak = null;
  yoneticiDurum("Nokta kaydedildi", true);
  arsiviTazele();
  if (typeof haritaCiz === "function") { haritaCiz(); }
  yoneticiCiz();
}

/* ==================== YOLLAR ====================
   Bir karakterin gezdiği yerler, sırayla. Haritada numaralı çizgi olarak görünür;
   evren değiştiren adımlar kapı olarak işaretlenir. */

let yoneticiYolKarakter = null;
let yoneticiYolYeniH = "";

function yoneticiYerSecenekleri(haritaId, secili, bosMetin) {
  const h = (veri.haritalar || []).find(function (x) { return x.id === haritaId; });
  return '<option value="">' + kacir(bosMetin) + "</option>" +
    ((h && h.yerler) || []).filter(function (p) { return p.tur !== "Kıta"; }).map(function (p) {
      return '<option value="' + kacir(p.id) + '"' + (p.id === secili ? " selected" : "") + ">" + kacir(p.ad) + "</option>";
    }).join("");
}

function yoneticiYollar() {
  const karlar = veri.karakterler || [];
  const kar = karlar.find(function (k) { return k.id === yoneticiYolKarakter; }) || null;
  const evrenler = veri.haritalar || [];
  const evrenSecenek = function (secili) {
    return evrenler.map(function (x) { return '<option value="' + kacir(x.id) + '"' + (x.id === secili ? " selected" : "") + ">" + kacir(x.ad) + "</option>"; }).join("");
  };
  if (!yoneticiYolYeniH && evrenler.length) { yoneticiYolYeniH = evrenler[0].id; }

  let s = '<p class="oyun-not">Bir karakterin izlediği yolu adım adım yaz. Haritada numaralı bir çizgi olur; ' +
    "evren değiştiren adımlar kapı olarak işaretlenir. Haritada da çizebilirsin: Geliştirici modu ▸ Yol çiz.</p>" +
    '<div class="kutu-y"><label>Karakter</label>' +
    '<select class="kod-giris arac-giris" id="yYolKar"><option value="">— seç —</option>' +
      karlar.map(function (k) {
        return '<option value="' + kacir(k.id) + '"' + (k.id === yoneticiYolKarakter ? " selected" : "") + ">" + kacir(k.ad) +
               (k.yol && k.yol.length ? " (" + k.yol.length + ")" : "") + "</option>";
      }).join("") + "</select>";

  if (kar) {
    const yol = kar.yol || [];
    s += yol.length
      ? '<div class="y-blok-liste">' + yol.map(function (a, i) {
          return '<div class="y-yol-satir">' +
            '<span class="y-blok-katman">' + (i + 1) + "</span>" +
            '<select class="kod-giris arac-giris" data-y-yol-alan="harita" data-i="' + i + '">' + evrenSecenek(a.harita) + "</select>" +
            '<select class="kod-giris arac-giris" data-y-yol-alan="yer" data-i="' + i + '">' + yoneticiYerSecenekleri(a.harita, a.yer, "— yer —") + "</select>" +
            '<input class="kod-giris arac-giris" type="number" step="1" data-y-yol-alan="yil" data-i="' + i + '" value="' + (haritaSayi(a.yil) ? a.yil : "") + '" placeholder="yıl">' +
            '<input class="kod-giris arac-giris" data-y-yol-alan="not" data-i="' + i + '" value="' + kacir(a.not || "") + '" placeholder="not">' +
            '<span class="y-yol-arac">' +
              '<button class="dugme dugme-sade y-kucuk" data-y-yol-yukari="' + i + '" aria-label="Yukarı">↑</button>' +
              '<button class="dugme dugme-sade y-kucuk" data-y-yol-asagi="' + i + '" aria-label="Aşağı">↓</button>' +
              '<button class="dugme dugme-sade y-kucuk y-sil" data-y-yol-sil="' + i + '" aria-label="Sil">✕</button>' +
            "</span></div>";
        }).join("") + "</div>"
      : '<p class="oyun-not">Bu karakterin henüz yolu yok.</p>';

    s += "<label>Yeni adım</label>" +
      '<select class="kod-giris arac-giris" id="yYolYeniH">' + evrenSecenek(yoneticiYolYeniH) + "</select>" +
      '<select class="kod-giris arac-giris" id="yYolYeniY">' + yoneticiYerSecenekleri(yoneticiYolYeniH, "", "— yer seç —") + "</select>" +
      '<div class="sohbet-secim">' +
        '<input class="kod-giris arac-giris" id="yYolYeniYil" type="number" step="1" placeholder="yıl (isteğe bağlı)">' +
        '<input class="kod-giris arac-giris" id="yYolYeniNot" placeholder="not (isteğe bağlı)">' +
      "</div>" +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-y-yol-ekle="1">Adımı ekle</button>' +
        (yol.length ? '<button class="dugme dugme-sade" data-y-yol-goster="1">Haritada göster</button>' : "") +
      "</div>";
  }
  return s + "</div>";
}

/* ---- olaylar: evren ayarı, yollar, kişiler ---- */

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-evren-kaydet]")) { yoneticiEvrenAyarKaydet(); return; }

  /* yollar */
  const kar = function () { return (veri.karakterler || []).find(function (k) { return k.id === yoneticiYolKarakter; }); };
  if (e.target.closest("[data-y-yol-ekle]")) {
    const k = kar(); if (!k) { return; }
    const h = document.querySelector("#yYolYeniH").value, y = document.querySelector("#yYolYeniY").value;
    if (!h || !y) { yoneticiDurum("Evren ve yer seç", false); return; }
    const a = { harita: h, yer: y };
    const yil = parseFloat(document.querySelector("#yYolYeniYil").value);
    const not_ = document.querySelector("#yYolYeniNot").value.trim();
    if (!isNaN(yil)) { a.yil = Math.round(yil); }
    if (not_) { a.not = not_; }
    if (!k.yol) { k.yol = []; }
    k.yol.push(a);
    yoneticiDurum("Adım eklendi", true);
    yoneticiCiz();
    return;
  }
  const yukari = e.target.closest("[data-y-yol-yukari]"), asagi = e.target.closest("[data-y-yol-asagi]"), sil = e.target.closest("[data-y-yol-sil]");
  if (yukari || asagi || sil) {
    const k = kar(); if (!k || !k.yol) { return; }
    if (sil) { k.yol.splice(parseInt(sil.getAttribute("data-y-yol-sil"), 10), 1); }
    else {
      const i = parseInt((yukari || asagi).getAttribute(yukari ? "data-y-yol-yukari" : "data-y-yol-asagi"), 10);
      const j = yukari ? i - 1 : i + 1;
      if (j >= 0 && j < k.yol.length) { const g = k.yol[i]; k.yol[i] = k.yol[j]; k.yol[j] = g; }
    }
    yoneticiCiz();
    return;
  }
  if (e.target.closest("[data-y-yol-goster]")) {
    if (typeof haritaTamAc === "function" && yoneticiYolKarakter) { haritaTamAc({ yol: yoneticiYolKarakter }); }
    return;
  }
});

document.addEventListener("change", function (e) {
  const t = e.target;
  if (t.id === "yYolKar") { yoneticiYolKarakter = t.value || null; yoneticiCiz(); return; }
  if (t.id === "yYolYeniH") { yoneticiYolYeniH = t.value; yoneticiCiz(); return; }
  if (t.id === "yNoktaGecitH") { yoneticiNoktaTaslak = yoneticiNoktaFormOku(); yoneticiNoktaTaslak.gecitY = ""; yoneticiCiz(); return; }
  const alan = t.getAttribute && t.getAttribute("data-y-yol-alan");
  if (alan) {
    const k = (veri.karakterler || []).find(function (x) { return x.id === yoneticiYolKarakter; });
    const a = k && (k.yol || [])[parseInt(t.getAttribute("data-i"), 10)];
    if (!a) { return; }
    if (alan === "yil") { const n = parseFloat(t.value); if (isNaN(n)) { delete a.yil; } else { a.yil = Math.round(n); } }
    else if (alan === "not") { if (t.value.trim()) { a.not = t.value.trim(); } else { delete a.not; } }
    else if (alan === "harita") { a.harita = t.value; a.yer = ""; yoneticiCiz(); }
    else { a.yer = t.value; }
  }
});

let yoneticiHaritaNoktaSilOnay = null;

function yoneticiHaritaNoktaSil(indeks) {
  const h = (veri.haritalar || []).find(function (x) { return x.id === yoneticiHaritaId; });
  if (!h || !h.yerler) { return; }

  const yer = h.yerler[indeks];
  if (!yer) { return; }

  if (yer.tur === "Şehir" && yoneticiHaritaNoktaSilOnay !== indeks) {
    const gorunenAd = typeof yerGorunenAd === "function" ? yerGorunenAd(yer) : yer.ad;
    const etkilenenKarakter = (veri.karakterler || []).filter(function (k) {
      return k.ozellikler && k.ozellikler.sehir === gorunenAd;
    });

    if (etkilenenKarakter.length) {
      yoneticiHaritaNoktaSilOnay = indeks;
      yoneticiDurum(
        etkilenenKarakter.map(function (k) { return k.ad; }).join(", ") +
        " burada yaşıyor olarak işaretli. Yine de silmek için tekrar bas.",
        false
      );
      yoneticiCiz();
      return;
    }
  }

  h.yerler.splice(indeks, 1);
  yoneticiHaritaNoktaSilOnay = null;
  yoneticiDurum("Nokta silindi", true);
  arsiviTazele();
  if (typeof haritaCiz === "function") { haritaCiz(); }
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  const ac = e.target.closest("[data-y-harita-ac]");
  if (ac) { yoneticiHaritaId = ac.dataset.yHaritaAc; yoneticiHaritaNoktaDuzenle = null; yoneticiCiz(); return; }

  const haritaSil = e.target.closest("[data-y-harita-sil]");
  if (haritaSil) { yoneticiHaritaSil(haritaSil.dataset.yHaritaSil); return; }

  if (e.target.closest("[data-y-harita-geri]")) {
    yoneticiHaritaId = null; yoneticiHaritaNoktaDuzenle = null; yoneticiCiz(); return;
  }

  if (e.target.closest("[data-y-harita-yeni]")) { yoneticiHaritaOlustur(); return; }

  if (e.target.closest("[data-y-harita-aciklama-kaydet]")) { yoneticiHaritaAciklamaKaydet(); return; }

  if (e.target.closest("[data-y-nokta-yeni]")) { yoneticiHaritaNoktaDuzenle = "yeni"; yoneticiNoktaTaslak = null; yoneticiCiz(); return; }

  const duzenle = e.target.closest("[data-y-nokta-duzenle]");
  if (duzenle) { yoneticiHaritaNoktaDuzenle = parseInt(duzenle.dataset.yNoktaDuzenle, 10); yoneticiNoktaTaslak = null; yoneticiCiz(); return; }

  const sil = e.target.closest("[data-y-nokta-sil]");
  if (sil) { yoneticiHaritaNoktaSil(parseInt(sil.dataset.yNoktaSil, 10)); return; }

  if (e.target.closest("[data-y-nokta-kaydet]")) { yoneticiHaritaNoktaKaydet(); return; }

  if (e.target.closest("[data-y-nokta-iptal]")) { yoneticiHaritaNoktaDuzenle = null; yoneticiNoktaTaslak = null; yoneticiCiz(); }
});

/* ==================== OLAY EKLE ====================
   Başlık, yaşanma şekli, anlatım ve olaydaki kişiler. */

let yoneticiOlayKisiler = {};

function yoneticiOlayEkle() {
  const karakterler = veri.karakterler || [];

  const kisiSecici = karakterler.map(function (k) {
    const secili = !!yoneticiOlayKisiler[k.id];
    return '<label class="y-alan-secim">' +
             '<input type="checkbox" data-y-olay-kisi="' + kacir(k.id) + '"' + (secili ? " checked" : "") + "> " +
             kacir(k.ad) +
           "</label>";
  }).join("");

  return '<p class="oyun-not">Bir olay ekle: ne oldu, nasıl oldu, kimler vardı.</p>' +
    '<div class="kutu-y">' +
      "<label>Başlık</label>" +
      '<input class="kod-giris arac-giris" id="yOlayBaslik" placeholder="olayın adı">' +
      "<label>Yaşanma şekli</label>" +
      '<input class="kod-giris arac-giris" id="yOlaySekil" placeholder="kısaca nasıl oldu">' +
      "<label>Anlatım</label>" +
      '<textarea class="kod-giris arac-giris" id="yOlayAnlatim" rows="6" ' +
        'placeholder="olayı ayrıntılı anlat"></textarea>' +
      "<label>Olaydaki kişiler</label>" +
      '<div class="y-alan-izgara y-karakter-izgara">' + (kisiSecici || "<p class=\"oyun-not\">Henüz karakter yok.</p>") + "</div>" +
      '<button class="dugme" data-y-olay-ekle="1">Olayı ekle</button>' +
    "</div>" +
    yoneticiOlayListesi();
}

let yoneticiOlayDuzenle = null;

function yoneticiOlayListesi() {
  const liste = veri.anlatiOlaylari || [];
  if (!liste.length) { return ""; }

  return '<div class="kutu-y">' +
      "<label>Eklenmiş olaylar — " + liste.length + " adet</label>" +
      '<div class="y-blok-liste">' +
        liste.map(function (o, i) {
          if (yoneticiOlayDuzenle === i) {
            return '<div class="y-blok-editor">' +
                "<label>Başlık</label>" +
                '<input class="kod-giris arac-giris" id="yOlayDuzenleBaslik" value="' + kacir(o.baslik) + '">' +
                "<label>Yaşanma şekli</label>" +
                '<input class="kod-giris arac-giris" id="yOlayDuzenleSekil" value="' + kacir(o.yasanmaSekli || "") + '">' +
                "<label>Anlatım</label>" +
                '<textarea class="kod-giris arac-giris" id="yOlayDuzenleAnlatim" rows="6">' + kacir(o.anlatim) + "</textarea>" +
                '<div class="oyun-sira">' +
                  '<button class="dugme" data-y-olay-duzenle-kaydet="' + i + '">Kaydet</button>' +
                  '<button class="dugme dugme-sade" data-y-olay-duzenle-iptal="1">İptal</button>' +
                "</div>" +
              "</div>";
          }
          return '<div class="y-blok-satir">' +
                   '<span class="y-blok-baslik">' + kacir(o.baslik) + "</span>" +
                   '<button class="dugme dugme-sade" data-y-olay-duzenle="' + i + '">düzenle</button>' +
                   '<button class="dugme dugme-sade y-sil" data-y-olay-sil="' + i + '">sil</button>' +
                 "</div>";
        }).join("") +
      "</div>" +
    "</div>";
}

function yoneticiOlayDuzenleKaydet(i) {
  const o = (veri.anlatiOlaylari || [])[i];
  if (!o) { return; }

  const baslik = (document.querySelector("#yOlayDuzenleBaslik") || {}).value || "";
  const anlatim = (document.querySelector("#yOlayDuzenleAnlatim") || {}).value || "";
  if (!baslik.trim() || !anlatim.trim()) { yoneticiDurum("Başlık ve anlatım gerekli", false); return; }

  o.baslik = baslik.trim();
  o.yasanmaSekli = ((document.querySelector("#yOlayDuzenleSekil") || {}).value || "").trim();
  o.anlatim = anlatim.trim();

  yoneticiOlayDuzenle = null;
  yoneticiDurum("Olay güncellendi", true);
  arsiviTazele();
  if (typeof olaylarCiz === "function") { olaylarCiz(); }
  yoneticiCiz();
}

function yoneticiOlaySil(i) {
  if (!veri.anlatiOlaylari) { return; }
  veri.anlatiOlaylari.splice(i, 1);
  yoneticiDurum("Olay silindi", true);
  arsiviTazele();
  if (typeof olaylarCiz === "function") { olaylarCiz(); }
  yoneticiCiz();
}

function yoneticiOlayKaydet() {
  const baslik = (document.querySelector("#yOlayBaslik") || {}).value || "";
  const sekil = (document.querySelector("#yOlaySekil") || {}).value || "";
  const anlatim = (document.querySelector("#yOlayAnlatim") || {}).value || "";

  if (!baslik.trim()) { yoneticiDurum("Olayın başlığı gerekli", false); return; }
  if (!anlatim.trim()) { yoneticiDurum("Anlatım gerekli", false); return; }

  const kisiler = Object.keys(yoneticiOlayKisiler).filter(function (id) { return yoneticiOlayKisiler[id]; });
  const id = "o_" + baslik.trim().toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]+/gi, "").slice(0, 24);

  if (!veri.anlatiOlaylari) { veri.anlatiOlaylari = []; }
  veri.anlatiOlaylari.push({ id: id, baslik: baslik.trim(), yasanmaSekli: sekil.trim(),
    anlatim: anlatim.trim(), kisiler: kisiler });

  yoneticiOlayKisiler = {};
  yoneticiDurum("\"" + baslik.trim() + "\" olayı eklendi", true);
  arsiviTazele();
  if (typeof olaylarCiz === "function") { olaylarCiz(); }
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-olay-ekle]")) { yoneticiOlayKaydet(); return; }

  const olaySil = e.target.closest("[data-y-olay-sil]");
  if (olaySil) { yoneticiOlaySil(parseInt(olaySil.dataset.yOlaySil, 10)); return; }

  const olayDuzenle = e.target.closest("[data-y-olay-duzenle]");
  if (olayDuzenle) { yoneticiOlayDuzenle = parseInt(olayDuzenle.dataset.yOlayDuzenle, 10); yoneticiCiz(); return; }

  const olayDuzenleKaydet = e.target.closest("[data-y-olay-duzenle-kaydet]");
  if (olayDuzenleKaydet) { yoneticiOlayDuzenleKaydet(parseInt(olayDuzenleKaydet.dataset.yOlayDuzenleKaydet, 10)); return; }

  if (e.target.closest("[data-y-olay-duzenle-iptal]")) { yoneticiOlayDuzenle = null; yoneticiCiz(); }
});
document.addEventListener("change", function (e) {
  const kisi = e.target.closest("[data-y-olay-kisi]");
  if (kisi) { yoneticiOlayKisiler[kisi.dataset.yOlayKisi] = kisi.checked; }
});

/* ==================== HİKÂYE EKLE ====================
   Düz, dallanmayan kısa bir hikâye ekler — sitedeki etkileşimli "Gece
   Vardiyası"ndan farklı, tek parça bir anlatı. */

let yoneticiHikayeKarakterler = {};

function yoneticiHikayeEkle() {
  const karakterler = veri.karakterler || [];

  const kisiSecici = karakterler.map(function (k) {
    const secili = !!yoneticiHikayeKarakterler[k.id];
    return '<label class="y-alan-secim">' +
             '<input type="checkbox" data-y-hikaye-kisi="' + kacir(k.id) + '"' + (secili ? " checked" : "") + "> " +
             kacir(k.ad) +
           "</label>";
  }).join("");

  return '<p class="oyun-not">Basit bir kısa hikâye ekle — başlık ve düz metin.</p>' +
    '<div class="kutu-y">' +
      "<label>Başlık</label>" +
      '<input class="kod-giris arac-giris" id="yHikayeBaslik" placeholder="hikâyenin adı">' +
      "<label>Metin</label>" +
      '<textarea class="kod-giris arac-giris" id="yHikayeMetin" rows="8" ' +
        'placeholder="hikâyeyi buraya yaz"></textarea>' +
      "<label>Geçen karakterler (opsiyonel)</label>" +
      '<div class="y-alan-izgara y-karakter-izgara">' + (kisiSecici || "<p class=\"oyun-not\">Henüz karakter yok.</p>") + "</div>" +
      '<button class="dugme" data-y-hikaye-ekle="1">Hikâyeyi ekle</button>' +
    "</div>" +
    yoneticiHikayeListesi();
}

let yoneticiHikayeDuzenle = null;

function yoneticiHikayeListesi() {
  const liste = veri.kisaHikayeler || [];
  if (!liste.length) { return ""; }

  return '<div class="kutu-y">' +
      "<label>Eklenmiş hikâyeler — " + liste.length + " adet</label>" +
      '<div class="y-blok-liste">' +
        liste.map(function (hk, i) {
          if (yoneticiHikayeDuzenle === i) {
            return '<div class="y-blok-editor">' +
                "<label>Başlık</label>" +
                '<input class="kod-giris arac-giris" id="yHikayeDuzenleBaslik" value="' + kacir(hk.baslik) + '">' +
                "<label>Metin</label>" +
                '<textarea class="kod-giris arac-giris" id="yHikayeDuzenleMetin" rows="8">' + kacir(hk.metin) + "</textarea>" +
                '<div class="oyun-sira">' +
                  '<button class="dugme" data-y-hikaye-duzenle-kaydet="' + i + '">Kaydet</button>' +
                  '<button class="dugme dugme-sade" data-y-hikaye-duzenle-iptal="1">İptal</button>' +
                "</div>" +
              "</div>";
          }
          return '<div class="y-blok-satir">' +
                   '<span class="y-blok-baslik">' + kacir(hk.baslik) + "</span>" +
                   '<button class="dugme dugme-sade" data-y-hikaye-duzenle="' + i + '">düzenle</button>' +
                   '<button class="dugme dugme-sade y-sil" data-y-hikaye-sil="' + i + '">sil</button>' +
                 "</div>";
        }).join("") +
      "</div>" +
    "</div>";
}

function yoneticiHikayeDuzenleKaydet(i) {
  const hk = (veri.kisaHikayeler || [])[i];
  if (!hk) { return; }

  const baslik = (document.querySelector("#yHikayeDuzenleBaslik") || {}).value || "";
  const metin = (document.querySelector("#yHikayeDuzenleMetin") || {}).value || "";
  if (!baslik.trim() || !metin.trim()) { yoneticiDurum("Başlık ve metin gerekli", false); return; }

  hk.baslik = baslik.trim();
  hk.metin = metin.trim();

  yoneticiHikayeDuzenle = null;
  yoneticiDurum("Hikâye güncellendi", true);
  arsiviTazele();
  if (typeof kisaHikayelerCiz === "function") { kisaHikayelerCiz(); }
  yoneticiCiz();
}

function yoneticiHikayeSil(i) {
  if (!veri.kisaHikayeler) { return; }
  veri.kisaHikayeler.splice(i, 1);
  yoneticiDurum("Hikâye silindi", true);
  arsiviTazele();
  if (typeof kisaHikayelerCiz === "function") { kisaHikayelerCiz(); }
  yoneticiCiz();
}

function yoneticiHikayeKaydet() {
  const baslik = (document.querySelector("#yHikayeBaslik") || {}).value || "";
  const metin = (document.querySelector("#yHikayeMetin") || {}).value || "";

  if (!baslik.trim()) { yoneticiDurum("Hikâyenin başlığı gerekli", false); return; }
  if (!metin.trim()) { yoneticiDurum("Metin gerekli", false); return; }

  const karakterler = Object.keys(yoneticiHikayeKarakterler).filter(function (id) { return yoneticiHikayeKarakterler[id]; });
  const id = "kh_" + baslik.trim().toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]+/gi, "").slice(0, 24);

  if (!veri.kisaHikayeler) { veri.kisaHikayeler = []; }
  veri.kisaHikayeler.push({ id: id, baslik: baslik.trim(), metin: metin.trim(), karakterler: karakterler });

  yoneticiHikayeKarakterler = {};
  yoneticiDurum("\"" + baslik.trim() + "\" hikâyesi eklendi", true);
  arsiviTazele();
  if (typeof kisaHikayelerCiz === "function") { kisaHikayelerCiz(); }
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-hikaye-ekle]")) { yoneticiHikayeKaydet(); return; }

  const hikayeSil = e.target.closest("[data-y-hikaye-sil]");
  if (hikayeSil) { yoneticiHikayeSil(parseInt(hikayeSil.dataset.yHikayeSil, 10)); return; }

  const hikayeDuzenle = e.target.closest("[data-y-hikaye-duzenle]");
  if (hikayeDuzenle) { yoneticiHikayeDuzenle = parseInt(hikayeDuzenle.dataset.yHikayeDuzenle, 10); yoneticiCiz(); return; }

  const hikayeDuzenleKaydet = e.target.closest("[data-y-hikaye-duzenle-kaydet]");
  if (hikayeDuzenleKaydet) { yoneticiHikayeDuzenleKaydet(parseInt(hikayeDuzenleKaydet.dataset.yHikayeDuzenleKaydet, 10)); return; }

  if (e.target.closest("[data-y-hikaye-duzenle-iptal]")) { yoneticiHikayeDuzenle = null; yoneticiCiz(); }
});
document.addEventListener("change", function (e) {
  const kisi = e.target.closest("[data-y-hikaye-kisi]");
  if (kisi) { yoneticiHikayeKarakterler[kisi.dataset.yHikayeKisi] = kisi.checked; }
});

/* ==================== GÖRSEL EKLE ====================
   Basit bir görsel yükleme aracı. Görseller en fazla 256×256 boyuta
   küçültülür ve düşük kalitede sıkıştırılır — site hafif kalsın diye. */

let yoneticiGorselHedefTur = "karakter";  /* "karakter" | "galeri" */
let yoneticiGorselHedefId = "";
let yoneticiGorselDosya = null;
let yoneticiGorselOnizleme = null;        /* { veri, tur } base64 onizleme */
let yoneticiGorselYeniGaleri = false;     /* "+ Yeni galeri karti ekle" formu acik mi */
let yoneticiGorselYeniGaleriBaslik = "";
let yoneticiGorselYeniGaleriAciklama = "";

function yoneticiGorselEkle() {
  const karakterler = veri.karakterler || [];
  const galeri = veri.galeri || [];

  /* Dropdown ilk açıldığında tarayıcı otomatik olarak ilk seçeneği gösterir
     ama yoneticiGorselHedefId hâlâ boş kalabilir — kullanıcı hiç dokunmazsa
     "Kaydet" sessizce başarısız olurdu. İlk öğeyi burada senkronize ediyoruz. */
  if (!yoneticiGorselHedefId) {
    if (yoneticiGorselHedefTur === "karakter" && karakterler.length) { yoneticiGorselHedefId = karakterler[0].id; }
    else if (yoneticiGorselHedefTur === "galeri" && galeri.length) { yoneticiGorselHedefId = "0"; }
  }

  const hedefSecenek = yoneticiGorselHedefTur === "karakter"
    ? karakterler.map(function (k) {
        return '<option value="' + kacir(k.id) + '"' + (k.id === yoneticiGorselHedefId ? " selected" : "") + ">" +
               kacir(k.ad) + (k.gorsel ? " (görseli var)" : "") + "</option>";
      }).join("")
    : galeri.map(function (g, i) {
        return '<option value="' + i + '"' + (String(i) === yoneticiGorselHedefId ? " selected" : "") + ">" +
               kacir(g.baslik) + (g.gorsel ? " (görseli var)" : "") + "</option>";
      }).join("");

  return '<p class="oyun-not">Görseller yüklenirken otomatik olarak en fazla 256×256 ' +
    "piksele küçültülür ve düşük kalitede sıkıştırılır — site hafif kalsın diye.</p>" +
    '<div class="kutu-y">' +
      "<label>1. Nereye ekleyeceksin?</label>" +
      '<div class="sohbet-secim">' +
        '<button class="dugme' + (yoneticiGorselHedefTur === "karakter" ? "" : " dugme-sade") +
          '" data-y-gorsel-tur="karakter">Karakter kartı</button>' +
        '<button class="dugme' + (yoneticiGorselHedefTur === "galeri" ? "" : " dugme-sade") +
          '" data-y-gorsel-tur="galeri">Galeri kartı</button>' +
      "</div>" +
      (yoneticiGorselHedefTur === "galeri"
        ? (yoneticiGorselYeniGaleri
            ? "<label>Yeni galeri kartı — başlık</label>" +
              '<input class="kod-giris arac-giris" id="yGorselYeniGaleriBaslik" value="' +
                kacir(yoneticiGorselYeniGaleriBaslik) + '">' +
              "<label>Açıklama</label>" +
              '<input class="kod-giris arac-giris" id="yGorselYeniGaleriAciklama" value="' +
                kacir(yoneticiGorselYeniGaleriAciklama) + '">' +
              '<button class="dugme dugme-sade" data-y-gorsel-galeri-olustur="1">Kartı oluştur</button>' +
              '<button class="dugme dugme-sade" data-y-gorsel-galeri-iptal="1">İptal</button>'
            : '<button class="dugme dugme-sade" data-y-gorsel-galeri-yeni="1">+ Yeni galeri kartı ekle</button>')
        : "") +
      "<label>Hangisi?</label>" +
      '<select class="kod-giris arac-giris" id="yGorselHedef">' + hedefSecenek + "</select>" +
    "</div>" +
    '<div class="kutu-y">' +
      "<label>2. Görsel seç</label>" +
      '<input type="file" accept="image/*" id="yGorselDosya">' +
      (yoneticiGorselOnizleme
        ? '<div class="y-gorsel-onizleme">' +
            '<img src="data:' + yoneticiGorselOnizleme.tur + ";base64," + yoneticiGorselOnizleme.veri + '" alt="">' +
            '<span class="oyun-not">' + yoneticiGorselOnizleme.en + "×" + yoneticiGorselOnizleme.boy + " piksel</span>" +
          "</div>"
        : "") +
      '<button class="dugme' + (yoneticiGorselOnizleme ? "" : " pasif") +
        '" data-y-gorsel-kaydet="1">Kaydet</button>' +
    "</div>";
}

async function yoneticiGorselSecildi(dosya) {
  if (!dosya) { return; }
  yoneticiGorselDosya = dosya;
  yoneticiDurum("Görsel işleniyor...", true);

  try {
    const sonuc = await gorselKucult(dosya, 256, 0.6);
    yoneticiGorselOnizleme = sonuc;
    yoneticiDurum("Önizleme hazır — " + sonuc.en + "×" + sonuc.boy, true);
  } catch (e) {
    yoneticiDurum("Görsel okunamadı", false);
    yoneticiGorselOnizleme = null;
  }
  yoneticiCiz();
}

/** Yeni bir galeri kartı oluşturur (başlık + açıklama, görsel sonradan
    eklenir) ve hemen hedef olarak seçer. Daha önce yalnızca var olan 7
    sabit karta görsel konabiliyordu, yeni kart eklemenin yolu yoktu. */
function yoneticiGaleriKartiOlustur() {
  const baslik = (document.querySelector("#yGorselYeniGaleriBaslik") || {}).value || "";
  if (!baslik.trim()) { yoneticiDurum("Kartın başlığı gerekli", false); return; }

  const aciklama = (document.querySelector("#yGorselYeniGaleriAciklama") || {}).value || "";
  const id = "c_" + baslik.trim().toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]+/gi, "").slice(0, 20);

  if (!veri.galeri) { veri.galeri = []; }
  veri.galeri.push({ id: id, tur: "Çizim", baslik: baslik.trim(), aciklama: aciklama.trim(), gorsel: "", fiyat: 0 });

  yoneticiGorselHedefId = String(veri.galeri.length - 1);
  yoneticiGorselYeniGaleri = false;
  yoneticiGorselYeniGaleriBaslik = ""; yoneticiGorselYeniGaleriAciklama = "";
  yoneticiDurum("\"" + baslik.trim() + "\" galeri kartı oluşturuldu", true);
  arsiviTazele();
  if (typeof galeriCiz === "function") { galeriCiz(); }
  yoneticiCiz();
}

async function yoneticiGorselKaydet() {
  if (!yoneticiGorselDosya || !yoneticiGorselHedefId) {
    yoneticiDurum("Önce hedef seç ve bir görsel yükle", false);
    return;
  }

  const hedefYol = yoneticiGorselHedefTur === "karakter"
    ? "karakterler." + (veri.karakterler || []).findIndex(function (k) { return k.id === yoneticiGorselHedefId; }) + ".gorsel"
    : "galeri." + yoneticiGorselHedefId + ".gorsel";

  const adOneri = yoneticiGorselHedefTur === "karakter" ? yoneticiGorselHedefId : "galeri" + yoneticiGorselHedefId;

  await gorselBirakildi(yoneticiGorselDosya, hedefYol, adOneri, 256, 0.6);

  yoneticiGorselDosya = null;
  yoneticiGorselOnizleme = null;
  arsiviTazele();
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  const tur = e.target.closest("[data-y-gorsel-tur]");
  if (tur) {
    yoneticiGorselHedefTur = tur.dataset.yGorselTur;
    yoneticiGorselHedefId = "";
    yoneticiCiz();
    return;
  }

  if (e.target.closest("[data-y-gorsel-galeri-yeni]")) { yoneticiGorselYeniGaleri = true; yoneticiCiz(); return; }
  if (e.target.closest("[data-y-gorsel-galeri-iptal]")) {
    yoneticiGorselYeniGaleri = false; yoneticiGorselYeniGaleriBaslik = ""; yoneticiGorselYeniGaleriAciklama = "";
    yoneticiCiz();
    return;
  }
  if (e.target.closest("[data-y-gorsel-galeri-olustur]")) { yoneticiGaleriKartiOlustur(); return; }

  if (e.target.closest("[data-y-gorsel-kaydet]")) { yoneticiGorselKaydet(); }
});

document.addEventListener("change", function (e) {
  if (e.target.id === "yGorselHedef") { yoneticiGorselHedefId = e.target.value; return; }
  if (e.target.id === "yGorselDosya") { yoneticiGorselSecildi(e.target.files[0]); }
});

/* ==================== KİLİTLİ DOSYA EKLE ====================
   Herhangi bir dosyayı (PDF, ses, görsel paketi, ne olursa) seçilen
   katmanın koduyla şifreleyip GitHub'a yükler. Şifresiz hâli hiçbir yerde
   durmaz — yalnızca tarayıcıda, kod doğrulandıktan sonra, anlık olarak
   üretilir. Katman zaten başka bir yerde açılmışsa dosya da otomatik
   erişilebilir olur; aynı kilit sistemini paylaşırlar. */

let yoneticiDosyaKatman = null;
let yoneticiDosyaBaytlar = null;   /* Uint8Array, secilen dosyanin ham icerigi */
let yoneticiDosyaAd = "";          /* orijinal dosya adi */
let yoneticiDosyaBoyut = 0;
let yoneticiDosyaAdGiris = "";     /* "Ad" alanina yazilan metin — yeniden cizimde kaybolmasin diye */
let yoneticiDosyaAciklamaGiris = "";
let yoneticiDosyaDuzenle = null;   /* duzenlenen kaydin indeksi, ya da null */

function yoneticiDosyaEkle() {
  /* Dropdown ilk açıldığında tarayıcı otomatik ilk katmanı gösterir ama
     yoneticiDosyaKatman hâlâ null kalabilir. Dosya seçilince tetiklenen
     yeniden çizimde bu durum görünürdeki seçimi sessizce sıfırlıyordu —
     kullanıcı "Kenar" seçtiğini sanırken dosya "Son" koduyla kilitlenebilirdi. */
  if (!yoneticiDosyaKatman) {
    const ilkKatman = katmanListesi()[0];
    if (ilkKatman) { yoneticiDosyaKatman = ilkKatman.id; }
  }

  const katmanSecenek = katmanListesi().map(function (k) {
    const kodVar = !!katmanKodlari[k.id];
    return '<option value="' + k.id + '"' + (k.id === yoneticiDosyaKatman ? " selected" : "") + ">" +
           k.sira + ". " + kacir(k.ad) + (kodVar ? "" : " (kod yok)") + "</option>";
  }).join("");

  return '<p class="oyun-not">Bir dosya seç, hangi katmanın koduyla kilitleneceğini belirle. ' +
    "Dosyanın şifresiz hâli hiçbir yerde saklanmaz — yalnızca doğru kod girildiğinde, " +
    "tarayıcıda anlık olarak çözülür.</p>" +
    '<div class="kutu-y">' +
      "<label>1. Hangi katmanın koduyla kilitlensin?</label>" +
      '<select class="kod-giris arac-giris" id="yDosyaKatman">' + katmanSecenek + "</select>" +
      "<label>2. Ad</label>" +
      '<input class="kod-giris arac-giris" id="yDosyaAd" value="' + kacir(yoneticiDosyaAdGiris) +
        '" placeholder="ör. Delilik — 1. Bölüm">' +
      "<label>Açıklama</label>" +
      '<textarea class="kod-giris arac-giris" id="yDosyaAciklama" rows="2">' +
        kacir(yoneticiDosyaAciklamaGiris) + "</textarea>" +
      "<label>3. Dosya seç</label>" +
      '<input type="file" id="yDosyaGiris">' +
      (yoneticiDosyaBaytlar
        ? '<p class="oyun-not">' + kacir(yoneticiDosyaAd) + " — " +
            Math.round(yoneticiDosyaBoyut / 1024) + " KB</p>"
        : "") +
      '<button class="dugme' + (yoneticiDosyaBaytlar ? "" : " pasif") +
        '" data-y-dosya-kaydet="1">Şifrele ve yükle</button>' +
    "</div>" +
    yoneticiDosyaListesi();
}

function yoneticiDosyaListesi() {
  const liste = veri.kilitliDosyalar || [];
  if (!liste.length) { return ""; }

  return '<div class="kutu-y">' +
      "<label>Yüklenmiş kilitli dosyalar — " + liste.length + " adet</label>" +
      '<div class="y-blok-liste">' +
        liste.map(function (d, i) {
          if (yoneticiDosyaDuzenle === i) {
            return '<div class="y-blok-editor">' +
                "<label>Ad</label>" +
                '<input class="kod-giris arac-giris" id="yDosyaDuzenleAd" value="' + kacir(d.ad) + '">' +
                "<label>Açıklama</label>" +
                '<textarea class="kod-giris arac-giris" id="yDosyaDuzenleAciklama" rows="2">' +
                  kacir(d.aciklama || "") + "</textarea>" +
                '<p class="oyun-not">Katman değiştirilemez — bunun için dosyayı silip yeniden ' +
                  "yüklemen gerekir, çünkü şifreli içerik o katmanın koduna bağlıdır.</p>" +
                '<div class="oyun-sira">' +
                  '<button class="dugme" data-y-dosya-duzenle-kaydet="' + i + '">Kaydet</button>' +
                  '<button class="dugme dugme-sade" data-y-dosya-duzenle-iptal="1">İptal</button>' +
                "</div>" +
              "</div>";
          }

          return '<div class="y-blok-satir">' +
                   '<span class="y-blok-katman">' + kacir(d.katmanAd) + "</span>" +
                   '<span class="y-blok-baslik">' + kacir(d.ad) + "</span>" +
                   '<button class="dugme dugme-sade" data-y-dosya-duzenle="' + i + '">düzenle</button>' +
                   '<button class="dugme dugme-sade y-sil" data-y-dosya-sil="' + i + '">sil</button>' +
                 "</div>";
        }).join("") +
      "</div>" +
    "</div>";
}

function yoneticiDosyaDuzenleKaydet(i) {
  const d = (veri.kilitliDosyalar || [])[i];
  if (!d) { return; }

  const ad = (document.querySelector("#yDosyaDuzenleAd") || {}).value || "";
  if (!ad.trim()) { yoneticiDurum("Dosyanın adı gerekli", false); return; }

  d.ad = ad.trim();
  d.aciklama = ((document.querySelector("#yDosyaDuzenleAciklama") || {}).value || "").trim();

  yoneticiDosyaDuzenle = null;
  yoneticiDurum("Dosya bilgileri güncellendi", true);
  arsiviTazele();
  if (typeof dosyalarCiz === "function") { dosyalarCiz(); }
  yoneticiCiz();
}

function yoneticiDosyaSecildi(dosya) {
  if (!dosya) { return; }
  yoneticiDurum("Dosya okunuyor...", true);

  const okuyucu = new FileReader();
  okuyucu.onerror = function () { yoneticiDurum("Dosya okunamadı", false); };
  okuyucu.onload = function () {
    yoneticiDosyaBaytlar = new Uint8Array(okuyucu.result);
    yoneticiDosyaAd = dosya.name;
    yoneticiDosyaBoyut = dosya.size;
    yoneticiDurum("Hazır — \"Şifrele ve yükle\" ile devam et", true);
    yoneticiCiz();
  };
  okuyucu.readAsArrayBuffer(dosya);
}

async function yoneticiDosyaKaydet() {
  const katmanId = (document.querySelector("#yDosyaKatman") || {}).value || "";
  const ad = yoneticiDosyaAdGiris;
  const aciklama = yoneticiDosyaAciklamaGiris;
  const kod = katmanKodlari[katmanId];

  if (!kod) { yoneticiDurum("Bu katmanın kodu girilmemiş — Anahtarlar sekmesinden ekle", false); return; }
  if (!ad.trim()) { yoneticiDurum("Dosyanın adı gerekli", false); return; }
  if (!yoneticiDosyaBaytlar) { yoneticiDurum("Önce bir dosya seç", false); return; }

  const k = katmanBul(katmanId);
  const id = "d_" + ad.trim().toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]+/gi, "").slice(0, 24);

  yoneticiDurum("Şifreleniyor ve yükleniyor...", true);

  const sifreliBayt = dosyaXOR(yoneticiDosyaBaytlar, kod);
  const base64 = bayttanBase64(sifreliBayt);
  const dosyaYolu = "kilitli/" + id + ".enc";

  const sonuc = await githubDosyaYukle(dosyaYolu, base64);

  if (!sonuc.ok) {
    const boyutKb = Math.round(base64.length * 0.75 / 1024);
    yoneticiDurum("GitHub'a yüklenemedi (" + sonuc.sebep + ") — " + boyutKb +
      " KB. GitHub ayarlarını Anahtarlar/GitHub sekmesinden kontrol et.", false);
    return;
  }

  if (!veri.kilitliDosyalar) { veri.kilitliDosyalar = []; }
  veri.kilitliDosyalar.push({
    id: id, ad: ad.trim(), aciklama: aciklama.trim(),
    katman: katmanId, katmanAd: k.ad, dogrulama: k.dogrulama,
    dosyaYolu: dosyaYolu, orijinalAd: yoneticiDosyaAd, boyut: yoneticiDosyaBoyut,
  });

  yoneticiDosyaBaytlar = null; yoneticiDosyaAd = ""; yoneticiDosyaBoyut = 0;
  yoneticiDosyaAdGiris = ""; yoneticiDosyaAciklamaGiris = "";
  yoneticiDurum("\"" + ad.trim() + "\" şifrelenip yüklendi", true);
  arsiviTazele();
  if (typeof dosyalarCiz === "function") { dosyalarCiz(); }
  yoneticiCiz();
}

function yoneticiDosyaSil(indeks) {
  if (!veri.kilitliDosyalar) { return; }
  veri.kilitliDosyalar.splice(indeks, 1);
  yoneticiDurum("Dosya kaydı silindi (GitHub'daki şifreli dosya elle silinmeli)", true);
  arsiviTazele();
  if (typeof dosyalarCiz === "function") { dosyalarCiz(); }
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-dosya-kaydet]")) { yoneticiDosyaKaydet(); return; }
  const sil = e.target.closest("[data-y-dosya-sil]");
  if (sil) { yoneticiDosyaSil(parseInt(sil.dataset.yDosyaSil, 10)); return; }
  const duzenle = e.target.closest("[data-y-dosya-duzenle]");
  if (duzenle) { yoneticiDosyaDuzenle = parseInt(duzenle.dataset.yDosyaDuzenle, 10); yoneticiCiz(); return; }
  const duzenleKaydet = e.target.closest("[data-y-dosya-duzenle-kaydet]");
  if (duzenleKaydet) { yoneticiDosyaDuzenleKaydet(parseInt(duzenleKaydet.dataset.yDosyaDuzenleKaydet, 10)); return; }
  if (e.target.closest("[data-y-dosya-duzenle-iptal]")) { yoneticiDosyaDuzenle = null; yoneticiCiz(); }
});
document.addEventListener("change", function (e) {
  if (e.target.id === "yDosyaKatman") { yoneticiDosyaKatman = e.target.value; return; }
  if (e.target.id === "yDosyaGiris") { yoneticiDosyaSecildi(e.target.files[0]); }
});
document.addEventListener("input", function (e) {
  if (e.target.id === "yDosyaAd") { yoneticiDosyaAdGiris = e.target.value; return; }
  if (e.target.id === "yDosyaAciklama") { yoneticiDosyaAciklamaGiris = e.target.value; return; }
  if (e.target.id === "yGorselYeniGaleriBaslik") { yoneticiGorselYeniGaleriBaslik = e.target.value; return; }
  if (e.target.id === "yGorselYeniGaleriAciklama") { yoneticiGorselYeniGaleriAciklama = e.target.value; }
});
