/* TentiforApp — arşiv mantığı
   İçerik icerik.py ile üretilir. Bu dosyaya nadiren dokunursun. */

const KAYIT_ANAHTAR = "tentiforapp_cozulen";

let veri = null;
let cozulenler = {};   // { dogrulamaOzeti: kod }
let evrenFiltre = "hepsi";

const bellek = {};

function kayitOku(anahtar) {
  try {
    return window.localStorage.getItem(anahtar);
  } catch (e) {
    return bellek[anahtar] || null;
  }
}

function kayitYaz(anahtar, deger) {
  try {
    window.localStorage.setItem(anahtar, deger);
  } catch (e) {
    bellek[anahtar] = deger;
  }
}

const $ = function (s) { return document.querySelector(s); };

function kacir(m) {
  const d = document.createElement("div");
  d.textContent = m == null ? "" : m;
  return d.innerHTML;
}

function paragraf(metin) {
  return String(metin || "")
    .split(/\n\s*\n/)
    .filter(function (p) { return p.trim(); })
    .map(function (p) { return "<p>" + kacir(p.trim()) + "</p>"; })
    .join("");
}

function acilanlariYukle() {
  const ham = kayitOku(KAYIT_ANAHTAR);
  if (!ham) { return; }
  try {
    const d = JSON.parse(ham);
    if (d && typeof d === "object" && !Array.isArray(d)) { cozulenler = d; }
  } catch (e) { /* bozuk kayıt, sıfırdan başla */ }
}

function acilanlariKaydet() {
  kayitYaz(KAYIT_ANAHTAR, JSON.stringify(cozulenler));
}

/* Kilitli bölümlerin doğrulama özetleri. Kodun kendisi veride yoktur. */
function tumKilitler() {
  const set = new Set();
  (veri.katmanlar || []).forEach(function (k) { set.add(k.dogrulama); });
  return set;
}

function acikSayisi() {
  let n = 0;
  tumKilitler().forEach(function (o) { if (cozulenler[o]) { n++; } });
  return n;
}

/* ---------- buz bloğu ---------- */
function buzulEtiket(g) {
  if (!g) { return ""; }
  const acik = cozulenler[g.dogrulama];
  return ' aria-label="' + kacir(g.baslik) + " — " +
    (acik ? "çözüldü" : g.katmanAd + " katmanı, henüz çözülmedi") + '"';
}

function buzul(g) {
  if (!g) { return ""; }

  /* Metin düz durur; katman koduyla (ya da yönetici oturumuyla) açılana kadar çizilmez. */
  const acik = !!cozulenler[g.dogrulama];
  const yMetin = (typeof yoneticiCoz === "function") ? yoneticiCoz(g) : null;
  const metin = acik ? (g.metin !== undefined ? g.metin : null) : yMetin;
  const rozet = g.katmanAd
    ? '<span class="katman-rozet">' + kacir(g.katmanAd) + " katmanı</span>"
    : "";

  if (metin !== null && metin !== undefined) {
    return '<div class="buzul cozuldu"' + buzulEtiket(g) + ">" +
             '<div class="buzul-ic">' +
               '<div class="buzul-etiket">çözüldü ' + rozet + "</div>" +
               '<div class="buzul-baslik">' + kacir(g.baslik) + "</div>" +
               '<div class="buzul-metin">' + paragraf(metin) + "</div>" +
             "</div>" +
           "</div>";
  }

  return '<div class="buzul"' + buzulEtiket(g) + ">" +
           '<div class="buzul-ic">' +
             '<div class="buzul-etiket">buz altında ' + rozet + "</div>" +
             '<div class="buzul-baslik">' + kacir(g.baslik) + "</div>" +
             '<p class="buzul-not">Bu bölüm hikâyenin sonunu açık ediyor. ' +
               "Kodu bulduysan çözebilirsin.</p>" +
             '<button class="dugme" data-kod-ac="1">Kod gir</button>' +
           "</div>" +
         "</div>";
}

/** Bir kaydın TÜM kilitli bloklarını (birden fazla olabilir) art arda çizer.
    Her blok kendi katmanıyla ayrı ayrı açılır. */
function buzulListesi(dizi) {
  if (!dizi || !dizi.length) { return ""; }
  return dizi.map(buzul).join("");
}

/** Bir kaydın (karakter ya da evren maddesi) kilitli içerik rozetini üretir.
    Kilitli bilgi varsa gösterir; yoksa boş döner. Karakter kartlarında ve
    evren madde başlıklarında kullanılır — daha önce yalnızca karakterlerde
    vardı, evren maddelerinde kilitli olduğu hiç işaretlenmiyordu. */
function kilitRozeti(o) {
  if (!o.gizli || !o.gizli.length) { return ""; }

  const acikSayi = o.gizli.filter(function (g) { return !!cozulenler[g.dogrulama]; }).length;
  const hepsiAcik = acikSayi === o.gizli.length;
  const cokMu = o.gizli.length > 1;

  return '<span class="kart-kilit' + (hepsiAcik ? " acildi" : "") + '">' +
    (hepsiAcik
      ? (cokMu ? acikSayi + " gizli bölüm açık" : "gizli bölüm açık")
      : (cokMu ? acikSayi + "/" + o.gizli.length + " gizli bölüm açık" : "gizli bölüm var")) +
    "</span>";
}

/** Hızlı Karakter aracıyla eklenen yapılandırılmış alanları (yaş, meslek,
    boy, aile, önemli rol, hikâyeler) küçük bir tabloda gösterir. */
function ozellikTablosu(k) {
  if (!k.ozellikler) { return ""; }

  const ADLAR = { yas: "Yaş", soyad: "Soyad", meslek: "Meslek", boy: "Boy", aile: "Aile",
                   hikayedeRol: "Hikâyedeki rolü", hikayeler: "Hikâyeler", sehir: "Yaşadığı şehir" };

  const satirlar = Object.keys(k.ozellikler)
    .filter(function (id) { return k.ozellikler[id]; })
    .map(function (id) {
      const deger = id === "sehir"
        ? '<button class="ozellik-deger ozellik-sehir" data-sehir-git="' + kacir(k.ozellikler[id]) + '">' +
            kacir(k.ozellikler[id]) + "</button>"
        : '<span class="ozellik-deger">' + kacir(k.ozellikler[id]) + "</span>";

      return '<div class="ozellik-satir">' +
               '<span class="ozellik-ad">' + kacir(ADLAR[id] || id) + "</span>" +
               deger +
             "</div>";
    }).join("");

  if (!satirlar) { return ""; }
  return '<div class="ozellik-tablo">' + satirlar + "</div>";
}

/** "Yaşadığı şehir" satırına tıklayınca haritaya gidip o noktayı seçili
    hâle getirir. */
function sehreGit(gorunenAd) {
  const liste = veri.haritalar || [];
  for (let i = 0; i < liste.length; i++) {
    const h = liste[i];
    const yer = (h.yerler || []).find(function (y) {
      return (typeof yerGorunenAd === "function" ? yerGorunenAd(y) : y.ad) === gorunenAd;
    });
    if (yer) {
      if (typeof haritaSeciliId !== "undefined") { haritaSeciliId = h.id; }
      if (typeof haritaSecili !== "undefined") { haritaSecili = yer.id; }
      break;
    }
  }

  if (typeof perdeKapat === "function") { perdeKapat(); }

  const m = (typeof sayfaKimlikleri === "function") ? sayfaKimlikleri() : null;
  const capraz = m && Object.keys(m).some(function (x) {
    return m[x].indexOf("harita") !== -1 && x !== aktifSayfa;
  });

  if (capraz) {
    location.hash = "#/harita";
    /* Harita bölümü daha önce çizilmişse hash değişimi onu yeniden
       tetiklemeyebilir (geç çizim yalnızca ilk görünürlükte çalışır) —
       seçimin kesin yansıması için kısa bir gecikmeyle kendimiz çiziyoruz. */
    setTimeout(function () { if (typeof haritaCiz === "function") { haritaCiz(); } }, 200);
    return;
  }

  if (typeof bolumeGit === "function") { bolumeGit("harita"); }
  if (typeof haritaCiz === "function") { haritaCiz(); }
}

document.addEventListener("click", function (e) {
  const sehir = e.target.closest("[data-sehir-git]");
  if (sehir) { sehreGit(sehir.dataset.sehirGit); }
});

/** Yönetici panelindeki Yapım Ekle aracıyla işaretlenen yapımları
    karakter kartında küçük bir liste olarak gösterir. */
function yapimListesi(k) {
  if (!k.yapimlar || !k.yapimlar.length) { return ""; }

  return '<div class="yapim-liste-mini">' +
      '<span class="oyun-etiket">yer aldığı yapımlar</span>' +
      k.yapimlar.map(function (y) { return '<span class="yapim-mini-rozet">' + kacir(y) + "</span>"; }).join("") +
    "</div>";
}

/** Bir karakterin etiketlendiği olayları ve kısa hikâyeleri gösterir —
    olaylarCiz/kisaHikayelerCiz "kisiler"e karakter etiketlerken, bu fonksiyon
    tersini yapıp karakterden o kayıtlara geri bağlantı kurar. Okuma
    sayfasındaki ilgili bölüme tıklanınca gidilir. */
function olayHikayeListesi(k) {
  const olaylar = (veri.anlatiOlaylari || []).filter(function (o) {
    return (o.kisiler || []).indexOf(k.id) !== -1;
  });
  const hikayeler = (veri.kisaHikayeler || []).filter(function (hk) {
    return (hk.karakterler || []).indexOf(k.id) !== -1;
  });

  if (!olaylar.length && !hikayeler.length) { return ""; }

  const rozet = function (baslik, hedefBolum) {
    return '<button class="yapim-mini-rozet" data-gunluk-git="' + hedefBolum + '">' +
           kacir(baslik) + "</button>";
  };

  return '<div class="yapim-liste-mini">' +
      (olaylar.length
        ? '<span class="oyun-etiket">geçtiği olaylar</span>' +
          olaylar.map(function (o) { return rozet(o.baslik, "olaylar"); }).join("")
        : "") +
      (hikayeler.length
        ? '<span class="oyun-etiket">geçtiği hikâyeler</span>' +
          hikayeler.map(function (hk) { return rozet(hk.baslik, "kisaHikayeler"); }).join("")
        : "") +
    "</div>";
}

/* ---------- çizim ---------- */
function cizHero() {
  const kilitler = tumKilitler();

  $("#heroSayac").innerHTML =
    "<span>kayıt <b>" + (veri.karakterler || []).length + "</b></span>" +
    "<span>evren maddesi <b>" + (veri.evren || []).length + "</b></span>" +
    "<span>buz altında <b>" + (kilitler.size - acikSayisi()) + "/" + kilitler.size + "</b></span>";

  const s = $("#surumNo");
  if (s) { s.textContent = (veri.surum || "—") + (veri.guncelleme ? " · " + veri.guncelleme : ""); }
}

function cizDelilik() {
  const d = veri.delilik;
  if (!d) { return; }

  $("#delilikBaslik").textContent = d.baslik;
  $("#delilikIcerik").innerHTML = paragraf(d.metin);
}

function cizKarakterler() {
  const liste = veri.karakterler || [];

  if (!liste.length) {
    $("#karakterIzgara").innerHTML = '<div class="bos">icerik.py içine karakter ekle</div>';
    return;
  }

  $("#karakterIzgara").innerHTML = liste.map(function (k, i) {
    /* başka evrene ait kayıtlar (ör. E25'in Evrengezerleri) Tömye arşivinde çizilmez; ortak olanlar çizilir */
    if (typeof evrendeMi === "function" && !evrendeMi(k, "tomye")) { return ""; }
    const rozet = kilitRozeti(k);

    return '<button class="kart" data-karakter="' + i + '">' +
             '<span class="kart-unvan">' + kacir(k.unvan) + yeniRozet(k) + "</span>" +
             '<span class="kart-ad">' + kacir(k.ad) + "</span>" +
             '<span class="kart-ozet">' + kacir(k.ozet) + "</span>" +
             rozet +
             (typeof yeniRozeti === "function" ? yeniRozeti(k) : "") +
             (typeof kartOnizleme === "function" ? kartOnizleme(k) : "") +
           "</button>";
  }).join("");
}

function cizEvren() {
  const liste = veri.evren || [];

  if (!liste.length) {
    $("#evrenListe").innerHTML = '<div class="bos">icerik.py içine evren maddesi ekle</div>';
    return;
  }

  const bolumler = [];
  const tomye = liste.filter(function (e) { return typeof evrendeMi !== "function" || evrendeMi(e, "tomye"); });
  const baska = liste.length - tomye.length;
  tomye.forEach(function (e) {
    if (bolumler.indexOf(e.bolum) === -1) { bolumler.push(e.bolum); }
  });

  $("#evrenFiltre").innerHTML =
    '<button data-filtre="hepsi" class="' + (evrenFiltre === "hepsi" ? "secili" : "") + '">Hepsi</button>' +
    bolumler.map(function (b) {
      return '<button data-filtre="' + kacir(b) + '" class="' + (evrenFiltre === b ? "secili" : "") + '">' +
             kacir(b) + "</button>";
    }).join("");

  const gosterilen = tomye.filter(function (e) {
    return evrenFiltre === "hepsi" || e.bolum === evrenFiltre;
  });

  $("#evrenListe").innerHTML = (baska && (evrenFiltre === "hepsi" || evrenFiltre === "Evrengezer")
    ? '<p class="oyun-not evren-tasindi">Evrengezerlere özgü ' + baska + ' madde kendi evrenlerinde: <button class="dugme dugme-sade" data-evren-git="#/ev/site/e25">E25\'e git →</button></p>'
    : "") + gosterilen.map(function (e) {
    const i = liste.indexOf(e);

    return '<div class="madde" data-madde="' + i + '">' +
             '<button class="madde-bas" aria-expanded="false">' +
               '<span class="madde-bolum">' + kacir(e.bolum) + "</span>" +
               '<span class="madde-baslik">' + kacir(e.baslik) + yeniRozet(e) + kilitRozeti(e) + "</span>" +
               '<span class="madde-ok">›</span>' +
             "</button>" +
             '<div class="madde-ozet">' + kacir(e.ozet) + "</div>" +
             '<div class="madde-govde">' +
               ((typeof duzenlemeAcikMi === "function" && duzenlemeAcikMi())
                 ? '<div class="duzenlenir-blok"' + duzenlenebilir("evren." + i + ".metin") + ">" +
                   kacir(e.metin) + "</div>"
                 : paragraf(e.metin)) +
               buzulListesi(e.gizli) + "</div>" +
           "</div>";
  }).join("");
}

function karakterAc(i) {
  const k = veri.karakterler[i];
  if (!bolumErisimi("arsiv")) { kodPenceresi(); return; }
  if (typeof gecmiseEkle === "function") { gecmiseEkle("karakter", k.id); }
  if (typeof istArtir === "function") { istArtir("kayit"); gorevIlerle("arsiv3"); }
  if (typeof okumaKaydet === "function") {
    okumaKaydet("karakter", k.id, k.ad);
    if (typeof okumaGecmisiCiz === "function") { okumaGecmisiCiz(); }
  }
  if (typeof gorulduIsaretle === "function") { gorulduIsaretle(k.id); }

  const dz = (typeof duzenlenebilir === "function") ? duzenlenebilir : function () { return ""; };
  const acik = (typeof duzenlemeAcikMi === "function") && duzenlemeAcikMi();
  const yol = "karakterler." + i + ".";

  const gorselKutu = acik
    ? '<div class="karakter-gorsel birak" data-birak="' + yol + 'gorsel" data-birak-ad="' +
        kacir(k.id) + '">' +
        (k.gorsel
          ? '<img src="' + kacir(k.gorsel) + '" alt="" loading="lazy" decoding="async">'
          : '<span class="birak-ipucu">görseli buraya sürükle</span>') +
        '<input type="file" accept="image/*" data-birak-giris="' + yol + 'gorsel">' +
      "</div>"
    : (k.gorsel ? '<div class="karakter-gorsel"><img src="' + kacir(k.gorsel) + '" alt=""></div>' : "");

  $("#perde").innerHTML =
    '<div class="pencere pencere-genis" role="dialog" aria-modal="true">' +
      (typeof geriDugmesi === "function" ? geriDugmesi() : "") +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      gorselKutu +
      "<h3" + dz(yol + "ad") + ' data-tek-satir="1">' + kacir(k.ad) + "</h3>" +
      '<p class="pencere-alt"' + dz(yol + "unvan") + ' data-tek-satir="1">' +
        kacir(k.unvan) + "</p>" +
      (typeof sesDugmesi === "function" ? sesDugmesi(k) : "") +
      '<p class="pencere-ozet"' + dz(yol + "ozet") + ">" + kacir(k.ozet) + "</p>" +
      (typeof ozellikTablosu === "function" ? ozellikTablosu(k) : "") +
      (typeof yapimListesi === "function" ? yapimListesi(k) : "") +
      (typeof olayHikayeListesi === "function" ? olayHikayeListesi(k) : "") +
      (acik
        ? '<div class="detay-metin duzenlenir-blok"' + dz(yol + "detay") + ">" +
          kacir(k.detay) + "</div>"
        : '<div class="detay-metin">' +
          (typeof baglantiEkle === "function"
            ? baglantiEkle(paragraf(k.detay), k.id) : paragraf(k.detay)) + "</div>") +
      (typeof okumaSuresi === "function" ? okumaSuresi(k.detay) : "") +
      (typeof karakterZamani === "function" ? karakterZamani(k) : "") +
      (typeof karakterYoluDugmesi === "function" ? karakterYoluDugmesi(k) : "") +
      buzulListesi(k.gizli) +
      (typeof notKutusu === "function" ? notKutusu(k.id) : "") +
    "</div>";

  $("#perde").hidden = false;
}

function cuzdanPenceresi() {
  const t = (veri.cuzdan && veri.cuzdan.gunlukTavan) || {};
  const adlar = { cevirmen: "Gırı Çevirmeni", vardiya: "Gündüz Vardiyası",
                  boyut: "Boyut Sürüklenmesi", yazi: "Yazı Çözme", baloncuk: "Baloncuk Evren" };

  const satirlar = Object.keys(t).map(function (k) {
    const kalan = gunlukKalan(k);
    const oran = t[k] ? Math.round((kalan / t[k]) * 100) : 0;

    return '<div class="tavan-satir">' +
             "<span>" + kacir(adlar[k] || k) + "</span>" +
             '<span class="tavan-deger">' + kalan + " / " + t[k] + "</span>" +
             '<div class="tavan-cubuk"><span style="width:' + oran + '%"></span></div>' +
           "</div>";
  }).join("");

  $("#perde").innerHTML =
    '<div class="pencere" role="dialog" aria-modal="true">' +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      "<h3>" + cuzdan.ecka + " " + birim() + "</h3>" +
      '<p class="pencere-alt">toplam kazanç ' + (cuzdan.kazanilan || 0) +
        " · harcama " + (cuzdan.harcanan || 0) + "</p>" +

      '<div class="oyun-etiket">Bugün kalan kazanç</div>' +
      satirlar +
      '<p class="oyun-not">Nöbet tavansız — orada harcadığın gerçekten gidiyor.</p>' +

      '<div class="arac-blok">' +
        '<div class="oyun-etiket">Yedekleme</div>' +
        '<p class="oyun-not">Tarayıcı verilerini temizlersen ilerleme gider. ' +
          "Bu kodu bir yere kaydet.</p>" +
        '<textarea class="kod-giris arac-giris" id="yedekKutu" rows="3" ' +
          'spellcheck="false">' + kacir(yedekUret()) + "</textarea>" +
        '<button class="dugme" data-yedek="kopyala">Kodu kopyala</button>' +
        '<button class="dugme dugme-sade" data-yedek="yukle">Yapıştırdığım kodu yükle</button>' +
        '<p class="pencere-durum" id="yedekDurum"></p>' +
      "</div>" +
    "</div>";

  $("#perde").hidden = false;
}

function kodPenceresi() {
  $("#perde").innerHTML =
    '<div class="pencere" role="dialog" aria-modal="true">' +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      "<h3>Kod gir</h3>" +
      '<p class="pencere-alt">Sana verilen kod bölümleri açar; buz kodları kilitli kayıtları çözer</p>' +
      '<input class="kod-giris" id="kodGiris" placeholder="Kodunu yaz" ' +
        'autocomplete="off" spellcheck="false" maxlength="40">' +
      '<button class="dugme dugme-tam" data-coz="1">Aç</button>' +
      '<p class="pencere-durum" id="kodDurum"></p>' +
      ((typeof yoneticiAcik === "function" && yoneticiAcik())
        ? '<p class="oyun-not">Yönetici oturumu açık: her şey sana açık. ' +
          '<button class="dugme dugme-sade" data-usta-cikis="1">Oturumu kapat</button></p>'
        : "") +
    "</div>";

  $("#perde").hidden = false;
  $("#kodGiris").focus();
}

function perdeKapat() {
  $("#perde").hidden = true;
  $("#perde").innerHTML = "";
}

/** Kişiye özel kod: sarılmış katman kodlarını açar, her birini doğrular ve çözülenlere ekler. */
function profilUygula(profil, kod, durum) {
  let acilan = 0;
  if (veri.baslangicProfil === profil.id && typeof olaySay === "function") { olaySay("baslangic_kodu"); }
  Object.keys(profil.anahtarlar || {}).forEach(function (id) {
    const katman = katmanBulHepsi(id);
    if (!katman) { return; }
    try {
      const katmanKodu = sifreCoz(profil.anahtarlar[id], kod);
      if (dogrulamaOzeti(katmanKodu) === katman.dogrulama) {
        if (!cozulenler[katman.dogrulama]) { acilan++; }
        cozulenler[katman.dogrulama] = katmanKodu;
      }
    } catch (e) { /* bozuk anahtar: bu katman açılmaz */ }
  });
  acilanlariKaydet();
  kayitYaz("tentiforapp_profil", profil.id);
  kanonProfilEkle(profil.id);

  const nb = profil.erisim ? (profil.erisim.bolumler || []).length : 0;
  durum.textContent = (profil.selamlama || "Merhaba, " + profil.ad) +
    (nb ? " · " + nb + " bölüm açıldı" : "") + (acilan ? " · " + acilan + " buz katmanı" : "");
  durum.className = "pencere-durum iyi";
  setTimeout(function () {
    perdeKapat();
    arsiviTazele();
    if (typeof haritaCiz === "function") { haritaCiz(); }
  }, 1400);
}

function kodDene(ham) {
  const kod = String(ham || "").trim().toUpperCase();
  const durum = $("#kodDurum");

  if (!kod) {
    durum.textContent = "Kod gir";
    durum.className = "pencere-durum kotu";
    return;
  }

  const ozet = dogrulamaOzeti(kod);

  /* yönetici kodu: her şeyi açar (bölümler, evrenler, buz katmanları) */
  if (veri.yoneticiOzet && ozet === veri.yoneticiOzet) { ustaGiris(kod, durum); return; }
  /* sınırlı yönetici kodu: panel açılır, katmanlar kilitli kalır */
  if (veri.sinirliYoneticiOzet && ozet === veri.sinirliYoneticiOzet) { ustaGiris(kod, durum); return; }

  const profil = (veri.profiller || []).find(function (p) { return p.dogrulama === ozet; });
  if (profil) { profilUygula(profil, kod, durum); return; }

  if (cozulenler[ozet]) {
    durum.textContent = "Bu kayıt zaten çözülmüş";
    durum.className = "pencere-durum";
    return;
  }

  if (!tumKilitler().has(ozet)) {
    durum.textContent = "Bu kod hiçbir kaydı açmıyor";
    durum.className = "pencere-durum kotu";
    return;
  }

  cozulenler[ozet] = kod;
  acilanlariKaydet();

  durum.textContent = "Buz çözüldü";
  durum.className = "pencere-durum iyi";

  setTimeout(function () {
    perdeKapat();
    arsiviTazele();
  }, 800);
}

/* ---------- olaylar ---------- */
document.addEventListener("click", function (e) {
  if (e.target.closest("[data-kapat]") || e.target === $("#perde")) { perdeKapat(); return; }
  if (e.target.closest("#btnKod") || e.target.closest("[data-kod-ac]")) { kodPenceresi(); return; }
  if (e.target.closest("[data-usta-cikis]")) { perdeKapat(); yoneticiCikis(); return; }
  if (e.target.closest("#cuzdanRozet")) { cuzdanPenceresi(); return; }

  const yedek = e.target.closest("[data-yedek]");
  if (yedek) {
    const kutu = $("#yedekKutu");
    const durum = $("#yedekDurum");

    if (yedek.dataset.yedek === "kopyala") {
      kutu.select();
      panoyaKopyala(kutu.value).then(function () {
        durum.textContent = "Kopyalandı";
        durum.className = "pencere-durum iyi";
      }).catch(function () {
        durum.textContent = "Kopyalanamadı, elle seç";
        durum.className = "pencere-durum kotu";
      });
      return;
    }

    const hata = yedekYukle(kutu.value);

    if (hata) {
      durum.textContent = hata;
      durum.className = "pencere-durum kotu";
      return;
    }

    durum.textContent = "İlerleme geri yüklendi";
    durum.className = "pencere-durum iyi";
    setTimeout(function () {
      perdeKapat();
      cizHero(); cizKarakterler(); cizEvren(); agCiz();
      galeriCiz(); boyutCiz(); testCiz();
      if (typeof kimlikCiz === "function") { KS = null; kimlikCiz(); }
    }, 800);
    return;
  }
  if (e.target.closest("[data-coz]")) { kodDene($("#kodGiris").value); return; }

  const kart = e.target.closest("[data-karakter]");
  if (kart) { karakterAc(parseInt(kart.dataset.karakter, 10)); return; }

  const f = e.target.closest("[data-filtre]");
  if (f) { evrenFiltre = f.dataset.filtre; cizEvren(); return; }

  const os = e.target.closest("[data-oyun-sekme]");
  if (os) {
    document.querySelectorAll("[data-oyun-sekme]").forEach(function (b) {
      b.classList.remove("secili");
    });
    os.classList.add("secili");
    document.querySelectorAll(".oyun-panel").forEach(function (p) { p.classList.add("gizli"); });
    const panel = document.querySelector("#panel-" + os.dataset.oyunSekme);
    if (panel) { panel.classList.remove("gizli"); }
    return;
  }

  const bas = e.target.closest(".madde-bas");
  if (bas) {
    const acildi = bas.parentElement.classList.toggle("acik");
    bas.setAttribute("aria-expanded", acildi ? "true" : "false");
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !$("#perde").hidden) { perdeKapat(); }
  if (e.key === "Enter" && document.activeElement && document.activeElement.id === "kodGiris") {
    kodDene(document.activeElement.value);
  }
});


/* ---------- zaman çizelgesi ---------- */

function katmanOzeti(katmanId) {
  const k = (veri.katmanlar || []).find(function (x) { return x.id === katmanId; });
  return k ? k.dogrulama : null;
}

function cizZaman() {
  const alan = $("#zamanAlan");
  if (!alan || !veri.zamanCizelgesi) { return; }

  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();

  alan.innerHTML = '<ol class="zaman">' + veri.zamanCizelgesi.map(function (o) {
    const ozet = o.gizli ? katmanOzeti(o.gizli) : null;
    const kilitli = !!ozet && !cozulenler[ozet] && !yonetici;

    return '<li class="zaman-madde' + (kilitli ? " kilitli" : "") + '">' +
             '<span class="zaman-no">' + o.no + "</span>" +
             '<div class="zaman-govde">' +
               '<span class="zaman-cag">' + kacir(o.cag) + "</span>" +
               '<span class="zaman-baslik">' + kacir(o.baslik) + "</span>" +
               '<span class="zaman-metin">' +
                 (kilitli ? "Bu adım buz altında." : kacir(o.metin)) + "</span>" +
             "</div>" +
           "</li>";
  }).join("") + "</ol>";

  if (typeof zamanSvgCiz === "function") { zamanSvgCiz(); }
}


/* ---------- yapımlar ---------- */

function cizYapimlar() {
  const alan = $("#yapimAlan");
  if (!alan || !veri.yapimlar) { return; }

  const siniflar = veri.siniflar || {};
  const gruplar = ["UH", "UD"];

  alan.innerHTML = gruplar.map(function (s) {
    const liste = veri.yapimlar.filter(function (y) { return y.sinif === s; });
    if (!liste.length) { return ""; }

    const bilgi = siniflar[s] || { ad: s, aciklama: "" };

    return '<div class="sinif-blok">' +
             '<div class="sinif-bas"><span class="sinif-kod">' + kacir(s) + "</span>" +
               '<span class="sinif-ad">' + kacir(bilgi.ad) + "</span></div>" +
             '<p class="sinif-aciklama">' + kacir(bilgi.aciklama) + "</p>" +
             '<div class="yapim-izgara">' + liste.map(function (y) {
               const sinif = y.durum.toLocaleLowerCase("tr").replace(/\s+/g, "");
               const gorunenAd = (typeof yapimGorunenAd === "function") ? yapimGorunenAd(y) : y.ad;
               const kisiler = (veri.karakterler || []).filter(function (k) {
                 return (k.yapimlar || []).indexOf(gorunenAd) !== -1;
               });
               return '<div class="yapim-kart">' +
                        '<span class="yapim-tur">' + kacir(y.tur) + "</span>" +
                        '<span class="yapim-ad">' + kacir(y.ad) + "</span>" +
                        '<span class="yapim-durum d-' + kacir(sinif) + '">' + kacir(y.durum) + "</span>" +
                        '<span class="yapim-not">' + kacir(y.not) + "</span>" +
                        (kisiler.length
                          ? '<div class="yapim-kisiler">' +
                              kisiler.map(function (k) { return '<span class="olay-kisi">' + kacir(k.ad) + "</span>"; }).join("") +
                            "</div>"
                          : "") +
                      "</div>";
             }).join("") + "</div>" +
           "</div>";
  }).join("") + crossoverListesiCiz();
}

/** Yönetici panelindeki Crossover aracıyla eklenen, iki yapımı birbirine
    bağlayan kayıtları çizer. */
function crossoverListesiCiz() {
  const liste = veri.crossoverlar || [];
  if (!liste.length) { return ""; }

  return '<div class="crossover-blok">' +
      '<div class="oyun-etiket">Crossoverlar</div>' +
      liste.map(function (c) {
        return '<div class="crossover-kart">' +
                 '<div class="crossover-baslik">' + kacir(c.a) + " × " + kacir(c.b) + "</div>" +
                 (c.neden ? '<p class="crossover-neden">' + kacir(c.neden) + "</p>" : "") +
                 '<p class="crossover-gidisat">' + kacir(c.gidisat) + "</p>" +
               "</div>";
      }).join("") +
    "</div>";
}

/** Kilit durumu değiştiğinde arşivle ilgili her şeyi yeniden çizer. */
/** Kilit, spoiler seviyesi ya da düzenleme modu değişince etkilenen HER bölümü
    yeniden çizer. Liste hâlinde ve korumalı: biri patlarsa diğerleri yaşar.
    Eskiden yarısı eksikti ve bölümler eski hâlinde kalıyordu. */
function arsiviTazele() {
  /* Geç çizilen bölümler yeniden çizilebilsin. */
  if (typeof gecCizimSifirla === "function") { gecCizimSifirla(); }

  const adimlar = [
    ["hero", "cizHero"], ["karakterler", "cizKarakterler"], ["evren", "cizEvren"],
    ["zaman", "cizZaman"], ["ağ", "agCiz"], ["kayıp", "kayipCiz"],
    ["alıntılar", "alintiCiz"], ["roman", "romanCiz"], ["günün kaydı", "gununCiz"],
    ["başarım", "basarimCiz"], ["yankılar", "yankiCiz"], ["dallar", "dalCiz"],
    ["mektuplar", "mektupCiz"], ["günlükler", "gunlukCiz"], ["kayıtlar", "kayitCiz"],
    ["arşivci", "arsivciCiz"], ["rol yolu", "rolYoluCiz"], ["galeri", "galeriCiz"],
    ["karşılaştırma", "karsiHesapla"], ["aile", "aileCizTam"],
      ["kesişmeler", "kesismeCiz"],
    ["defter", "defterCiz"], ["vurgular", "vurgularimCiz"],
    ["okuma geçmişi", "okumaGecmisiCiz"], ["madalyalar", "madalyaCiz"],
    ["dosyalar", "dosyalarCiz"], ["brifing", "brifingCiz"]
  ];

  adimlar.forEach(function (a) {
    const f = window[a[1]];
    if (typeof f !== "function") { return; }
    try { f(); } catch (hata) { console.error("[TentiforApp] " + a[0] + " tazelenemedi:", hata); }
  });

  /* kilit durumu değişmiş olabilir: kanon bölümlerini ve menüyü yeniden kur */
  if (typeof kanonSifirla === "function") { kanonSifirla(); }
  if (typeof kanonKilitUygula === "function") { kanonKilitUygula(); }
  if (typeof gezinmeCiz === "function") { try { gezinmeCiz(); } catch (hata) { console.error("[TentiforApp] menü tazelenemedi:", hata); } }
}


/* ---------- başlat ---------- */
acilanlariYukle();

/* Tek dosya sürümünde veri sayfaya gömülüdür; sunucu gerekmez.
   Çok dosyalı sürümde veri.json ağdan çekilir. */
const veriKaynak = window.__VERI__
  ? Promise.resolve(window.__VERI__)
  /* Tazeliği sunucu sağlar (veri.json için Cache-Control: no-cache): değişmediyse 304 döner, yeniden inmez.
     (Ön yükleme denendi: içeriği 0,1 sn hızlandırıp ilk çizimi 0,1 sn geciktirdiği için kullanılmadı.) */
  : fetch("veri.json").then(function (y) {
      if (!y.ok) { throw new Error("veri.json okunamadı"); }
      return y.json();
    });

veriKaynak
  .then(function (d) {
    veri = d;
    /* panelin Kaydet koruması: bu sayfanın GitHub'la aynı saydığı veri (22-yonetici.js) */
    if (typeof veriOzeti === "function") { try { veriTabanOzeti = veriOzeti(d); } catch (_) { /* yok */ } }

    /* Her çizim ayrı korumada: biri patlarsa sayfanın kalanı yaşamaya devam eder.
       Eskiden tek bir hata bütün siteyi boşaltıyordu. */
    const adimlar = [
      ["tema", function () { temaYukle(); siteTemaYukle(); sesYukle(); okumaYukle(); spoilerYukle(); erisimYukle(); sesDugmesiTazele(); }],
      ["cüzdan", function () { cuzdanYukle(); cuzdanGoster(); }],
      ["yönetici", function () { yoneticiHatirla(); katmanKodlariYukle(); ustaAnahtarlariYukle(); yoneticiCiz();
        duzenlemeYukle(); duzenlemeCubugu(); }],
      ["yenilikler", function () { if (typeof ziyaretKarsilastir === "function") { ziyaretKarsilastir(); yeniliklerCiz(); } }],
      ["hero", cizHero], ["delilik", cizDelilik], ["karakterler", cizKarakterler],
      ["evren", cizEvren], ["isim", isimCiz], ["isim kartı", function () { if (typeof isimKartCiz === "function") { isimKartCiz(); } }], ["takvim", function () { takvimCiz(); if (typeof takvimEtkinlikCiz === "function") { takvimEtkinlikCiz(); } }], ["nöbet", oyunCiz], ["çevirmen", cevirmenCiz],
      ["vardiya", vardiyaCiz], ["boyut", boyutCiz], ["günün kaydı", gununCiz], ["başlangıç", baslangicCiz], ["başarım", basarimCiz], ["kesişmeler", kesismeCiz],
      ["spoiler", spoilerCiz],
      ["yazı oyunu", yaziOyunCiz], ["baloncuk", baloncukCiz], ["görev", gorevCiz],
      ["şüpheli", supheliCiz],
      ["temalar", temaMagazaCiz], ["site temaları", siteTemaMagazaCiz], ["dallar", dalCiz],
      ["erişim", erisimCiz], ["rol yolu", rolYoluCiz], ["seri", seriCiz],
      ["geçmiş", gecmisCiz], ["sezon", sezonCiz], ["bulmaca", bulmacaCiz],
      ["günlükler", gunlukCiz], ["kayıtlar", kayitCiz],
      ["evren galerisi", evrenGalerisiCiz],
      ["ansiklopedi", function () { if (typeof ansiklopediCiz === "function") { ansiklopediCiz(); } }],
      ["okuma geçmişi", okumaGecmisiCiz], ["madalyalar", madalyaCiz],
      ["rekorlar", rekorCiz], ["meydan", meydanCiz], ["kısayollar", kisayolCiz],
      ["sıfırlama", sifirlamaCiz],
      ["yazı tipi", function () { yaziTipiYukle(); yaziTipiCiz(); }],
      ["meydan bağlantısı", meydanUygula],
      ["tur", function () { if (turGerekli() && rota().indexOf("#/meydan/") !== 0) { turBaslat(); } }],
      ["saat", saatiBaslat],
      ["brifing", function () { if (typeof brifingCiz === "function") { brifingCiz(); } }],
      ["günlük özet", function () { if (typeof gunlukOzetCiz === "function") { gunlukOzetCiz(); } }],
      ["sürüm notu", function () { if (typeof surumNotuCiz === "function") { surumNotuCiz(); } }],
      ["bildirim", function () { if (typeof bildirimKutusuCiz === "function") { bildirimKutusuCiz(); } }],
      ["yıl ve koleksiyon", function () { if (typeof yilKoleksiyonBasla === "function") { yilKoleksiyonBasla(); } }],
      ["e25 vitrini", function () { if (typeof e25VitrinCiz === "function") { e25VitrinCiz(); } }],
      ["gezinme", function () { gezinmeCiz(); ilerlemeKur(); gecCizimKur(); }],
      ["sayfalama", sayfaYonlendir],
      ["hesap", function () { if (typeof hesapBaslat === "function") { hesapBaslat(); } }],
      ["bakım", function () { if (typeof bakimBaslat === "function") { bakimBaslat(); } }],
      ["bağlantı", baglantiyiUygula]
    ];

    const patlayan = [];

    adimlar.forEach(function (a) {
      try {
        a[1]();
      } catch (hata) {
        patlayan.push(a[0]);
        console.error("[TentiforApp] " + a[0] + " çizilemedi:", hata);
      }
    });

    if (patlayan.length) {
      console.warn("[TentiforApp] çizilemeyen bölümler: " + patlayan.join(", "));
      if (typeof tanilamaGoster === "function") { tanilamaGoster("Çizilemeyen bölümler", patlayan.join(", ")); }
    }
  })
  .catch(function (hata) {
    if (typeof tanilamaGoster === "function") { tanilamaGoster("Veri yüklenemedi", String((hata && hata.message) || hata), hata && hata.stack); }
    $("#karakterIzgara").innerHTML =
      '<div class="bos">veri.json yüklenemedi.<br>' +
      "Sayfayı bir sunucu üzerinden aç (GitHub Pages veya yerel sunucu).</div>";
  });


/* çevrimdışı destek — yalnızca sunucudan açıldığında çalışır */
if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () { /* devre dışı */ });
  });
}
