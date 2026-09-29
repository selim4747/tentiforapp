/* Üçüncü dalga — arşivci kartı (rol + kişilik), tema mağazası, günün görevi,
   etkileşimli hikâye, zaman dalları ve erişim ayarları. */

/* ==================== ARŞİVCİ KARTI ==================== */

/** Karttaki sayıları tek yerden toplar. */
function arsivciOlculeri() {
  istatistikHazirla();

  let katman = 0;
  (veri.katmanlar || []).forEach(function (k) { if (cozulenler[k.dogrulama]) { katman++; } });

  const galeri = (veri.galeri || []).filter(function (g) {
    return g.fiyat === 0 || kilitAcik("galeri_" + g.id);
  }).length;

  const kaynak = cuzdan.ist.kaynak || {};
  const toplamKaynak = Object.keys(kaynak).reduce(function (t, k) { return t + kaynak[k]; }, 0);

  return {
    oyun: bitirilenSayisi(),
    oyunToplam: OYUNLAR.length,
    katman: katman,
    katmanToplam: (veri.katmanlar || []).length,
    galeri: galeri,
    galeriToplam: (veri.galeri || []).length,
    gun: (cuzdan.ist.gunler || []).length,
    kayit: cuzdan.ist.kayit || 0,
    rastgele: cuzdan.ist.rastgele || 0,
    ipucu: cuzdan.ist.ipucu || 0,
    kazanilan: cuzdan.kazanilan || 0,
    harcanan: cuzdan.harcanan || 0,
    kaynak: kaynak,
    toplamKaynak: toplamKaynak,
    bitirdi: function (o) { return basariVar(o); }
  };
}

/** Rol: ne kadar ilerlediğin. Koşullar zordan kolaya denenir. */
function arsivciRol() {
  const o = arsivciOlculeri();

  const uyar = function (k) {
    if (k.oyun !== undefined && o.oyun < k.oyun) { return false; }
    if (k.katman !== undefined && o.katman < k.katman) { return false; }
    if (k.galeri !== undefined && o.galeri < k.galeri) { return false; }
    if (k.gun !== undefined && o.gun < k.gun) { return false; }

    const oyunlar = ["nobet", "cevirmen", "vardiya", "boyut", "yazi", "baloncuk"];
    for (let i = 0; i < oyunlar.length; i++) {
      if (k[oyunlar[i]] === true && !o.bitirdi(oyunlar[i])) { return false; }
    }

    return true;
  };

  const bulunan = (veri.roller || []).find(function (r) { return uyar(r.kosul || {}); });
  return bulunan || { ad: "Ziyaretçi", not: "" };
}

/** Kişilik: nasıl oynadığın. En yüksek puanı alan kazanır. */
function arsivciKisilik() {
  const o = arsivciOlculeri();
  const k = o.kaynak;
  const t = Math.max(1, o.toplamKaynak);

  const oran = function (ad) { return (k[ad] || 0) / t; };

  /* Oynayış biçimini ölçen kaynak tabanlı arketipler daha ağır basar;
     kilit sayısı tek başına kişiliği belirlememeli. */
  const puan = {
    aksiyon: oran("nobet") * 1.2 + oran("boyut") * 1.3,
    sozcuk: oran("cevirmen") * 1.2 + oran("yazi") * 1.4,
    kurucuRuh: oran("baloncuk") * 1.5,
    karanlik: (o.katman / Math.max(1, o.katmanToplam)) * 0.8 +
              (spoilerSeviye === "hepsi" ? 0.15 : 0),
    koleksiyoncu: (o.galeri / Math.max(1, o.galeriToplam)) * 1.1,
    yalnizlik: Math.min(1.15, o.gun / 10),
    tuccar: o.kazanilan > 0
      ? Math.min(1.0, (o.kazanilan - o.harcanan) / Math.max(1, o.kazanilan)) : 0,
    kasif: Math.min(1.1, o.rastgele / 12) + Math.min(0.5, o.kayit / 40),
    sabirli: Math.min(1.0, o.kayit / 25) - Math.min(0.5, o.toplamKaynak / 500),
    yasam: 0.55
  };

  let enIyi = "yasam";
  Object.keys(puan).forEach(function (p) { if (puan[p] > puan[enIyi]) { enIyi = p; } });

  const bulunan = (veri.kisilikler || []).find(function (x) { return x.id === enIyi; });
  return bulunan || { ad: "Yaşam", not: "" };
}

function arsivciCiz() {
  const alan = document.querySelector("#arsivciAlan");
  if (!alan) { return; }

  const o = arsivciOlculeri();
  const rol = arsivciRol();
  const kis = arsivciKisilik();

  alan.innerHTML =
    '<div class="arsivci">' +
      '<div class="arsivci-ust">' +
        '<span class="arsivci-etiket">arşivci kartı</span>' +
        '<span class="arsivci-surum">' + kacir(veri.surum || "") + "</span>" +
      "</div>" +
      '<div class="arsivci-rol">' + kacir(rol.ad) + "</div>" +
      '<div class="arsivci-not">' + kacir(rol.not || "") + "</div>" +
      '<div class="arsivci-kisilik">' +
        '<span class="arsivci-alt">kişilik</span>' + kacir(kis.ad) +
      "</div>" +
      '<div class="arsivci-not">' + kacir(kis.not || "") + "</div>" +
      '<div class="arsivci-olcu">' +
        "<span>oyun <b>" + o.oyun + "/" + o.oyunToplam + "</b></span>" +
        "<span>katman <b>" + o.katman + "/" + o.katmanToplam + "</b></span>" +
        "<span>galeri <b>" + o.galeri + "/" + o.galeriToplam + "</b></span>" +
        "<span>gün <b>" + o.gun + "</b></span>" +
        "<span>kayıt <b>" + o.kayit + "</b></span>" +
      "</div>" +
    "</div>" +
    '<div class="kart-onizleme" id="arsivciOnizleme" hidden></div>' +
    '<div class="oyun-sira">' +
      '<button class="dugme" data-arsivci="paylas">' +
        ((typeof kartPaylasilabilir === "function" && kartPaylasilabilir()) ? "Kartı paylaş" : "Kartı görsel olarak indir") + "</button>" +
      ((typeof kartPaylasilabilir === "function" && kartPaylasilabilir())
        ? '<button class="dugme dugme-sade" data-arsivci="indir">İndir</button>' : "") +
    "</div>" +
    '<p class="pencere-durum" id="arsivciDurum"></p>';

  if (typeof tamlikCiz === "function") { tamlikCiz(); }
  if (typeof arsivciKartOnizle === "function") { arsivciKartOnizle(); }
}

/* Kartın görseli (önizleme, paylaş, indir) 27-kartlar.js'te çizilir. */

/* ==================== TEMA MAĞAZASI ==================== */

function temaSahip(t) {
  return t.fiyat === 0 || kilitAcik("tema_" + t.id);
}

function temaMagazaCiz() {
  const alan = document.querySelector("#temaAlan");
  if (!alan || !veri.temalar) { return; }

  const simdi = document.documentElement.getAttribute("data-ayar-tema") || "buz";

  alan.innerHTML = '<div class="tema-izgara">' + veri.temalar.map(function (t) {
    const sahip = temaSahip(t);
    const aktif = simdi === t.id;
    const carpan = (typeof temaIndirimi === "function") ? temaIndirimi(t.id) : 1;
    const fiyat = Math.round(t.fiyat * carpan);

    return '<div class="tema-kart' + (aktif ? " aktif" : "") + '">' +
             '<div class="tema-onizleme t-' + kacir(t.id) + '"><span></span><span></span><span></span></div>' +
             '<div class="tema-ad">' + kacir(t.ad) + "</div>" +
             '<div class="tema-not">' + kacir(t.not) + "</div>" +
             (sahip
               ? '<button class="dugme' + (aktif ? " dugme-sade" : "") + '" data-tema-sec="' +
                 kacir(t.id) + '">' + (aktif ? "kullanılıyor" : "Kullan") + "</button>"
               : '<button class="dugme' + (eckaVar(fiyat) ? "" : " pasif") +
                 '" data-tema-al="' + kacir(t.id) + '" data-fiyat="' + fiyat + '">' +
                 (carpan < 1 ? '<s>' + t.fiyat + "</s> " : "") + fiyat + " " + birim() +
                 "</button>") +
           "</div>";
  }).join("") + "</div>";
}

/** Site temaları — renk temasından bağımsız, kapalı kutuların şeklini
    değiştiren ikinci katman. Renk temasıyla aynı anda uygulanır; ikisi
    farklı bir <html> özniteliğinde tutulur (data-site-tema), bu yüzden
    "Kütüphane" renk + "Delilik" site teması gibi kombinasyonlar mümkün. */
function siteTemaSahip(t) {
  return t.fiyat === 0 || kilitAcik("sitetema_" + t.id);
}

function siteTemaMagazaCiz() {
  const alan = document.querySelector("#siteTemaAlan");
  if (!alan || !veri.siteTemalari) { return; }

  const simdi = (document.documentElement.getAttribute("data-site-tema") || "yok").split(" ");

  alan.innerHTML = '<div class="tema-izgara">' + veri.siteTemalari.map(function (t) {
    const sahip = siteTemaSahip(t);
    const aktif = simdi.indexOf(t.id) !== -1;

    return '<div class="tema-kart' + (aktif ? " aktif" : "") + '">' +
             '<div class="tema-onizleme ts-' + kacir(t.id) + '"><span></span><span></span><span></span></div>' +
             '<div class="tema-ad">' + kacir(t.ad) + "</div>" +
             '<div class="tema-not">' + kacir(t.not) + "</div>" +
             (sahip
               ? '<button class="dugme' + (aktif ? " dugme-sade" : "") + '" data-sitetema-sec="' +
                 kacir(t.id) + '">' + (aktif ? "kullanılıyor" : "Kullan") + "</button>"
               : '<button class="dugme' + (eckaVar(t.fiyat) ? "" : " pasif") +
                 '" data-sitetema-al="' + kacir(t.id) + '" data-fiyat="' + t.fiyat + '">' +
                 t.fiyat + " " + birim() + "</button>") +
           "</div>";
  }).join("") + "</div>";
}

/* ==================== GÜNÜN GÖREVİ ==================== */

/** Günün tohumu: tarihten türetilen sabit sayı. Herkeste aynı görev çıkar. */
function gorevTohumu() {
  const bugun = bugununAdi();
  let t = 0;
  for (let i = 0; i < bugun.length; i++) { t = (t * 31 + bugun.charCodeAt(i)) >>> 0; }
  return t;
}

function gununGorevi() {
  const liste = veri.gunlukGorevler || [];
  if (!liste.length) { return null; }
  return liste[gorevTohumu() % liste.length];
}

const GOREV_HEDEF = { nobet3: 3, cevirmen5: 5, vardiya8: 8, yazi4: 4,
                      baloncuk1: 1, arsiv3: 3, rastgele2: 2 };

/** Her görevin nerede yapılacağını ve nasıl yapılacağını anlatır.
    "Göreve git" düğmesi ve Günlük Özet kartı bunu kullanır. */
const GOREV_REHBER = {
  nobet3: { sayfa: "oyunlar", sekme: "nobet",
    nasil: "Nöbet'i aç, bir görevli seç ve üç gün hayatta kal." },
  cevirmen5: { sayfa: "oyunlar", sekme: "cevirmen",
    nasil: "Gırı Çevirmeni'ni aç ve beş kelimeyi doğru çevir." },
  vardiya8: { sayfa: "oyunlar", sekme: "vardiya",
    nasil: "Gündüz Vardiyası'nı aç ve sekiz müşteriye doğru kitabı ver." },
  yazi4: { sayfa: "oyunlar", sekme: "yazi",
    nasil: "Yazı Çözme'yi aç ve dört kelimeyi oku ya da yaz." },
  baloncuk1: { sayfa: "oyunlar", sekme: "baloncuk",
    nasil: "Baloncuk Evren'i aç, en az üç kural seç ve bir evren kur." },
  supheli1: { sayfa: "oyunlar", sekme: "supheli",
    nasil: "Şüpheli Tahtası'nı aç, ipuçlarını oku ve doğru ikiliyi bul." },
  arsiv3: { sayfa: "arsiv",
    nasil: "Arşivden herhangi üç karakter ya da evren kaydı aç." },
  rastgele2: { sayfa: "arsiv", bolum: "kesif",
    nasil: "Rastgele keşfet düğmesine iki kez bas." },
};

/** Görevin bulunduğu sayfaya (gerekirse) geçer, oyunsa ilgili sekmeyi açar. */
function goreveGit() {
  const g = gununGorevi();
  if (!g) { return; }

  const rehber = GOREV_REHBER[g.id];
  if (!rehber) { return; }

  const git = function () {
    if (rehber.sekme) {
      const btn = document.querySelector('[data-oyun-sekme="' + rehber.sekme + '"]');
      if (btn) { btn.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
    }
  };

  if (typeof aktifSayfa !== "undefined" && aktifSayfa !== rehber.sayfa) {
    location.hash = "#/" + rehber.sayfa;
    setTimeout(git, 150);
  } else {
    git();
  }
}

function gorevCiz() {
  const alan = document.querySelector("#gorevAlan");
  if (!alan) { return; }

  const g = gununGorevi();
  if (!g) { return; }

  const hedef = GOREV_HEDEF[g.id] || 1;
  const simdi = Math.min(hedef, gorevDurum(g.id));
  const alindi = kilitAcik("gorev_" + bugununAdi());
  const tamam = simdi >= hedef;
  const rehber = GOREV_REHBER[g.id];

  alan.innerHTML =
    '<div class="gorev">' +
      '<div class="gorev-etiket">günün görevi</div>' +
      '<div class="gorev-ad">' + kacir(g.ad) + "</div>" +
      (rehber ? '<p class="gorev-nasil">' + kacir(rehber.nasil) + "</p>" : "") +
      '<div class="pano-cubuk"><span style="width:' +
        Math.round((simdi / hedef) * 100) + '%"></span></div>' +
      '<div class="gorev-alt">' + simdi + " / " + hedef + "</div>" +
      '<div class="oyun-sira">' +
        (!tamam && !alindi && rehber
          ? '<button class="dugme dugme-sade" data-gorev-git="1">Göreve git</button>'
          : "") +
        (alindi
          ? '<div class="gunun-alindi">bugünkü ödülü aldın</div>'
          : '<button class="dugme' + (tamam ? "" : " pasif") + '" data-gorev="al">' +
            (tamam ? g.odul + " " + birim() + " al" : "henüz tamamlanmadı") + "</button>") +
      "</div>" +
    "</div>";
}

function gorevOdulAl() {
  const g = gununGorevi();
  if (!g) { return; }

  const hedef = GOREV_HEDEF[g.id] || 1;
  if (gorevDurum(g.id) < hedef) { return; }

  const anahtar = "gorev_" + bugununAdi();
  if (kilitAcik(anahtar)) { return; }

  cuzdan.acilan.push(anahtar);
  eckaKazan(g.odul, "Günün görevi");
  gorevCiz();
  if (typeof gunlukOzetCiz === "function") { gunlukOzetCiz(); }
}

/* ==================== ETKİLEŞİMLİ HİKÂYE ==================== */

let H = null;

function hikayeBaslat() {
  H = { dugum: "bas", gecmis: [] };
  hikayeCiz();
}

function hikayeSec(hedef) {
  if (!H) { return; }
  H.gecmis.push(H.dugum);
  H.dugum = hedef;

  const d = veri.hikaye.dugumler[hedef];
  if (d && d.son) {
    const anahtar = "hikaye_" + d.son;
    if (!kilitAcik(anahtar)) {
      cuzdan.acilan.push(anahtar);
      eckaKazan(d.odul || 10, "Gece Vardiyası");
    }
  }

  hikayeCiz();
}

function hikayeCiz() {
  const alan = document.querySelector("#hikayeAlan");
  if (!alan || !veri.hikaye) { return; }

  const hk = veri.hikaye;

  if (!H) {
    const bulunan = Object.keys(hk.sonlar).filter(function (s) {
      return kilitAcik("hikaye_" + s);
    }).length;

    alan.innerHTML =
      '<p class="oyun-giris">' + kacir(hk.giris) + "</p>" +
      '<p class="oyun-not">bulunan son: ' + bulunan + " / " +
        Object.keys(hk.sonlar).length + "</p>" +
      '<button class="dugme" data-hikaye="basla">' + kacir(hk.baslik) + "</button>";
    return;
  }

  const d = hk.dugumler[H.dugum];
  if (!d) { H = null; hikayeCiz(); return; }

  if (d.son) {
    alan.innerHTML =
      '<div class="hikaye-metin okuma-metin"><p>' + kacir(d.metin) + "</p></div>" +
      '<div class="hikaye-son">' + kacir(hk.sonlar[d.son]) + "</div>" +
      '<button class="dugme" data-hikaye="basla">Baştan oku</button>';
    return;
  }

  alan.innerHTML =
    '<div class="hikaye-metin okuma-metin"><p>' + kacir(d.metin) + "</p></div>" +
    '<div class="test-secenekler">' +
      d.secenekler.map(function (s) {
        return '<button class="test-btn" data-hikaye-sec="' + kacir(s.hedef) + '">' +
               kacir(s.metin) + "</button>";
      }).join("") +
    "</div>";
}

/* ==================== ZAMAN DALLARI ==================== */

function dalCiz() {
  const alan = document.querySelector("#dalAlan");
  if (!alan || !veri.dallar) { return; }

  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();

  alan.innerHTML =
    '<p class="oyun-giris">Olmayan yollar. Kanon değil — ama kanonu anlamanın en hızlı yolu.</p>' +
    '<div class="dal-liste">' +
      veri.dallar.map(function (d, i) {
        const acik = yonetici || (katmanAcik(d.gizli) && spoilerUygun(d.gizli));

        return '<div class="dal' + (acik ? "" : " kapali") + '">' +
                 '<button class="dal-soru" data-dal="' + i + '" aria-expanded="false">' +
                   (acik ? kacir(d.soru) : "— buz altında —") + "</button>" +
                 (acik ? '<div class="dal-cevap">' + kacir(d.cevap) + "</div>" : "") +
               "</div>";
      }).join("") +
    "</div>";
}

/* ==================== ERİŞİM AYARLARI ==================== */

const ERISIM_ANAHTAR = "tentiforapp_erisim";

let erisim = { disleksi: false, kontrast: false };

function erisimYukle() {
  const h = kayitOku(ERISIM_ANAHTAR);
  if (h) {
    try { erisim = Object.assign(erisim, JSON.parse(h)); } catch (e) { /* yoksay */ }
  }
  erisimUygula();
}

function erisimUygula() {
  const k = document.documentElement;
  k.setAttribute("data-ayar-disleksi", erisim.disleksi ? "1" : "0");
  k.setAttribute("data-ayar-kontrast", erisim.kontrast ? "1" : "0");
  erisimCiz();
}

function erisimDegistir(alan) {
  erisim[alan] = !erisim[alan];
  kayitYaz(ERISIM_ANAHTAR, JSON.stringify(erisim));
  erisimUygula();
}

/** Seçili bölümü sesli okur. Tarayıcı desteklemiyorsa düğme çıkmaz. */
function sesliOku(metin) {
  if (!window.speechSynthesis) { eckaBildir("Tarayıcı sesli okumayı desteklemiyor"); return; }

  window.speechSynthesis.cancel();
  const s = new SpeechSynthesisUtterance(String(metin).slice(0, 4000));
  s.lang = "tr-TR";
  s.rate = 0.95;
  window.speechSynthesis.speak(s);
}

function erisimCiz() {
  const alan = document.querySelector("#erisimAlan");
  if (!alan) { return; }

  alan.innerHTML =
    '<div class="erisim-liste">' +
      '<button class="spoiler-btn' + (erisim.disleksi ? " secili" : "") + '" data-erisim="disleksi">' +
        '<span class="spoiler-ad">Disleksi dostu yazı</span>' +
        '<span class="spoiler-not">Harf aralığı açılır, süslü yazı tipleri kapanır.</span>' +
      "</button>" +
      '<button class="spoiler-btn' + (erisim.kontrast ? " secili" : "") + '" data-erisim="kontrast">' +
        '<span class="spoiler-ad">Yüksek kontrast</span>' +
        '<span class="spoiler-not">Soluk renkler koyulaşır, kenarlar belirginleşir.</span>' +
      "</button>" +
      (window.speechSynthesis
        ? '<button class="spoiler-btn" data-erisim="oku">' +
          '<span class="spoiler-ad">Açık bölümü sesli oku</span>' +
          '<span class="spoiler-not">Ekrandaki metni Türkçe olarak okur. Durdurmak için tekrar bas.</span>' +
          "</button>"
        : "") +
    "</div>";
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const ak = e.target.closest("[data-arsivci]");
  if (ak) { arsivciKartDisari(ak.dataset.arsivci); return; }

  const ts = e.target.closest("[data-tema-sec]");
  if (ts) {
    document.documentElement.setAttribute("data-ayar-tema", ts.dataset.temaSec);
    kayitYaz(TEMA_ANAHTAR, ts.dataset.temaSec);
    siteTemaUygula();   /* renk degisince gizli kombo (oyunbozan+katiller) tetiklenebilir/sonebilir */
    temaDugmesiTazele();
    temaMagazaCiz();
    if (typeof siteTemaMagazaCiz === "function") { siteTemaMagazaCiz(); }
    return;
  }

  const ta = e.target.closest("[data-tema-al]");
  if (ta) {
    const f = parseInt(ta.dataset.fiyat, 10);
    if (kilitAc("tema_" + ta.dataset.temaAl, f)) { eckaBildir("Tema açıldı"); }
    temaMagazaCiz();
    return;
  }

  const ts2 = e.target.closest("[data-sitetema-sec]");
  if (ts2) {
    kayitYaz(SITE_TEMA_ANAHTAR, ts2.dataset.sitetemaSec);
    siteTemaUygula();   /* yeni tek bir tema secmek her zaman onceki iki-temali durumu kapatir */
    siteTemaMagazaCiz();
    return;
  }

  const ta2 = e.target.closest("[data-sitetema-al]");
  if (ta2) {
    const f2 = parseInt(ta2.dataset.fiyat, 10);
    if (kilitAc("sitetema_" + ta2.dataset.sitetemaAl, f2)) { eckaBildir("Site teması açıldı"); }
    siteTemaMagazaCiz();
    return;
  }

  if (e.target.closest("[data-gorev]")) { gorevOdulAl(); return; }
  if (e.target.closest("[data-gorev-git]")) { goreveGit(); return; }

  const hb = e.target.closest("[data-hikaye]");
  if (hb) { hikayeBaslat(); return; }

  const hs = e.target.closest("[data-hikaye-sec]");
  if (hs) { hikayeSec(hs.dataset.hikayeSec); return; }

  const dl = e.target.closest("[data-dal]");
  if (dl) {
    const kutu = dl.parentElement;
    const acildi = kutu.classList.toggle("acik");
    dl.setAttribute("aria-expanded", acildi ? "true" : "false");
    return;
  }

  const er = e.target.closest("[data-erisim]");
  if (er) {
    if (er.dataset.erisim === "oku") {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      } else {
        const ana = document.querySelector("main");
        sesliOku(ana ? ana.innerText : "");
      }
      return;
    }
    erisimDegistir(er.dataset.erisim);
  }
});
