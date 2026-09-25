/* Yedinci dalga — gezinme ve konfor.

   33 bölüm ve 32 bağlantı bir şeritte duruyordu; kimse tarayamaz.
   Bu dosya gezinmeyi gruplar, içindekiler paneli açar, nerede olduğunu gösterir. */

/* ==================== BÖLÜM GRUPLARI ==================== */

const GEZINME = [
  { ad: "Arşiv", ikon: "▤", bolumler: [
    ["arsiv", "Karakterler"], ["evren", "Evren"], ["aile", "Aile ağacı"],
    ["ag", "İlişki ağı"], ["zaman", "Zaman çizelgesi"], ["harita", "Harita"],
    ["yankilar", "Yankılar"], ["karsi", "Karşılaştır"] ] },

  { ad: "Okuma", ikon: "▥", bolumler: [
    ["roman", "Roman"], ["mektuplar", "Mektuplar"], ["alintilar", "Alıntılar"],
    ["hikaye", "Gece Vardiyası"], ["kisaHikayeler", "Kısa Hikâyeler"], ["olaylar", "Olaylar"],
    ["kayip", "Kayıp"], ["notlar", "Yazar notları"],
    ["sira", "Nereden başlamalı"], ["sohbet", "Karakter sohbeti"] ] },

  { ad: "Oyunlar", ikon: "▦", bolumler: [
    ["oyunlar", "Altı oyun"], ["galeri", "Galeri"], ["test", "Hangi karaktersin?"],
    ["kimlik", "Kimlik Sınavı"], ["bag", "Oyuna taşı"] ] },

  { ad: "Araçlar", ikon: "▧", bolumler: [
    ["isim", "İsim sistemi"], ["takvim", "Tömye takvimi"], ["yazi", "Kyldo yazısı"],
    ["sozluk", "Sözlük"], ["dosyalar", "Dosyalar"], ["bilinmeyenler", "Bilinmeyenler"] ] },

  { ad: "Sen", ikon: "▨", bolumler: [
    ["arsivci", "Arşivci kartın"], ["moodboard", "Moodboard"], ["defter", "Defterin"],
    ["basarim", "Başarımlar"], ["kesif", "Keşif"], ["delilik", "Delilik"],
    ["yapimlar", "Yapımlar"], ["basin", "Basın kiti"], ["degisiklik", "Değişiklik günlüğü"] ] },
];

let menuAcik = null;

function gezinmeCiz() {
  const alan = document.querySelector("#gezinme");
  if (!alan) { return; }

  alan.innerHTML =
    '<button class="gez-btn" id="icindekilerBtn" aria-label="İçindekiler">☰ İçindekiler</button>' +
    GEZINME.map(function (g, i) {
      const sayfaId = ["arsiv", "okuma", "oyunlar", "araclar", "sen"][i];
      const bu = aktifSayfa === sayfaId;
      return '<div class="gez-grup">' +
               '<button class="gez-btn' + (menuAcik === i ? " acik" : "") +
                 (bu ? " bu-sayfa" : "") +
                 '" data-gez-grup="' + i + '" aria-expanded="' +
                 (menuAcik === i ? "true" : "false") + '">' +
                 kacir(g.ad) + "</button>" +
               (menuAcik === i
                 ? '<div class="gez-liste">' +
                     g.bolumler.map(function (b) {
                       return '<button class="gez-oge" data-gez-git="' + b[0] + '">' +
                              kacir(b[1]) + kanonKilitIsareti(b[0]) + "</button>";
                     }).join("") +
                   "</div>"
                 : "") +
             "</div>";
    }).join("");
}

/* ==================== İÇİNDEKİLER PANELİ ==================== */

function icindekilerAc() {
  let p = document.querySelector("#icindekiler");

  if (p) { p.remove(); return; }

  p = document.createElement("div");
  p.id = "icindekiler";
  p.className = "ic-katman";

  const kilitSayisi = function (id) {
    /* bölümde kaç kilitli kayıt var */
    if (!bolumErisimi(id)) { return 0; }
    if (id === "arsiv") {
      return (veri.karakterler || []).filter(function (k) { return k.gizli; }).length;
    }
    if (id === "evren") {
      return (veri.evren || []).filter(function (e) { return e.gizli; }).length;
    }
    return 0;
  };

  const adet = function (id) {
    const m = { arsiv: (veri.karakterler || []).length, evren: (veri.evren || []).length,
                zaman: (veri.zamanCizelgesi || []).length, harita: (typeof tumHaritaYerleri === "function" ? tumHaritaYerleri().length : 0),
                mektuplar: (veri.mektuplar || []).length, alintilar: (veri.alintilar || []).length,
                sozluk: (veri.sozluk || []).length, yankilar: (veri.yankilar || []).length,
                yapimlar: (veri.yapimlar || []).length, galeri: (veri.galeri || []).length,
                bilinmeyenler: (veri.bilinmeyenler || []).length, oyunlar: 6 };
    return bolumErisimi(id) ? m[id] : undefined;
  };

  p.innerHTML =
    '<div class="ic-panel" role="dialog" aria-modal="true" aria-label="İçindekiler">' +
      '<div class="ic-ust">' +
        "<h3>İçindekiler</h3>" +
        '<button class="pencere-kapat" data-ic-kapat="1" aria-label="Kapat">✕</button>' +
      "</div>" +
      GEZINME.map(function (g) {
        return '<div class="ic-grup">' +
                 '<div class="ic-grup-ad">' + kacir(g.ad) + "</div>" +
                 g.bolumler.map(function (b) {
                   const n = adet(b[0]);
                   const k = kilitSayisi(b[0]);
                   return '<button class="ic-satir" data-gez-git="' + b[0] + '">' +
                            '<span class="ic-ad">' + kacir(b[1]) + kanonKilitIsareti(b[0]) + "</span>" +
                            (n !== undefined ? '<span class="ic-sayi">' + n + "</span>" : "") +
                            (k ? '<span class="ic-kilit">' + k + " kilitli</span>" : "") +
                          "</button>";
                 }).join("") +
               "</div>";
      }).join("") +
    "</div>";

  document.body.appendChild(p);
}

/* ==================== İLERLEME ÇUBUĞU ve YUKARI ÇIK ==================== */

function ilerlemeKur() {
  if (document.querySelector("#ilerleme")) { return; }

  const c = document.createElement("div");
  c.id = "ilerleme";
  c.className = "ilerleme";
  c.innerHTML = "<span></span>";
  document.body.appendChild(c);

  const y = document.createElement("button");
  y.id = "yukariBtn";
  y.className = "yukari-btn";
  y.setAttribute("aria-label", "Başa dön");
  y.textContent = "↑";
  document.body.appendChild(y);

  const tik = function () {
    const h = document.documentElement;
    const en = (h.scrollHeight - h.clientHeight) || 1;
    const oran = Math.min(100, Math.max(0, (h.scrollTop / en) * 100));

    const ic = c.firstChild;
    if (ic) { ic.style.width = oran + "%"; }

    y.classList.toggle("gorunur", h.scrollTop > 600);
    aktifBolumIsaretle();
  };

  window.addEventListener("scroll", tik, { passive: true });
  tik();
}

/** Görünen bölümün adını üst şeride yazar. */
function aktifBolumIsaretle() {
  const et = document.querySelector("#aktifBolum");
  if (!et) { return; }

  const bolumler = document.querySelectorAll("section.bolum");
  let aktif = null;

  for (let i = 0; i < bolumler.length; i++) {
    const k = bolumler[i].getBoundingClientRect ? bolumler[i].getBoundingClientRect() : null;
    if (!k) { continue; }
    if (k.top <= 120) { aktif = bolumler[i]; }
  }

  if (!aktif) { et.textContent = ""; return; }

  const b = aktif.querySelector("h2");
  et.textContent = b ? b.textContent : "";
}

/* ==================== GERİ DÜĞMESİ ====================
   Çapraz bağlantıdan sonra nereden geldiğine dönmek için. */

const gezGecmis = [];

function gecmiseEkle(tur, kimlik) {
  gezGecmis.push({ tur: tur, id: kimlik });
  if (gezGecmis.length > 20) { gezGecmis.shift(); }
}

function geriGit() {
  gezGecmis.pop();                    /* şu anki */
  const onceki = gezGecmis.pop();     /* bir öncesi */

  if (!onceki) {
    const p = document.querySelector("#perde");
    if (p) { p.hidden = true; }
    return;
  }

  if (onceki.tur === "karakter") {
    const i = (veri.karakterler || []).findIndex(function (k) { return k.id === onceki.id; });
    if (i !== -1) { karakterAc(i); }
  }
}

function geriDugmesi() {
  if (gezGecmis.length < 2) { return ""; }
  return '<button class="pencere-geri" data-gez-geri="1" aria-label="Geri">← geri</button>';
}

/* ==================== OKUMA SÜRESİ ==================== */

/** Ortalama 200 kelime/dakika. Kısa metinlerde gösterilmez. */
function okumaSuresi(metin) {
  const kelime = String(metin || "").trim().split(/\s+/).filter(Boolean).length;
  if (kelime < 80) { return ""; }

  const dk = Math.max(1, Math.round(kelime / 200));
  return '<span class="okuma-sure">' + dk + " dk okuma · " + kelime + " kelime</span>";
}

/* ==================== KART ÖNİZLEMESİ ==================== */

/** Kartta kaç bölüm var, kaçı kilitli. */
function kartOnizleme(o) {
  const parca = [];
  const kelime = String(o.detay || o.metin || "").trim().split(/\s+/).filter(Boolean).length;

  if (kelime >= 80) { parca.push(Math.max(1, Math.round(kelime / 200)) + " dk"); }

  if (o.gizli && o.gizli.length) {
    const acikSayi = o.gizli.filter(function (g) { return katmanAcik(g.katman); }).length;
    if (acikSayi === o.gizli.length) {
      parca.push(o.gizli.length > 1 ? o.gizli.length + " kilit çözüldü" : "kilit çözüldü");
    } else if (o.gizli.length > 1) {
      parca.push(acikSayi + "/" + o.gizli.length + " kilitli bölüm");
    } else {
      parca.push("1 kilitli bölüm");
    }
  }

  if (!parca.length) { return ""; }
  return '<span class="kart-onizleme">' + parca.map(kacir).join(" · ") + "</span>";
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  if (e.target.closest("#icindekilerBtn")) { icindekilerAc(); return; }

  if (e.target.closest("[data-ic-kapat]") ||
      (e.target.id === "icindekiler")) {
    const p = document.querySelector("#icindekiler");
    if (p) { p.remove(); }
    return;
  }

  const gg = e.target.closest("[data-gez-grup]");
  if (gg) {
    const i = parseInt(gg.dataset.gezGrup, 10);
    menuAcik = (menuAcik === i) ? null : i;
    gezinmeCiz();
    return;
  }

  const git = e.target.closest("[data-gez-git]");
  if (git) {
    const p = document.querySelector("#icindekiler");
    if (p) { p.remove(); }
    menuAcik = null;
    gezinmeCiz();

    const perde = document.querySelector("#perde");
    if (perde) { perde.hidden = true; }

    /* hedef bölüm başka sayfadaysa önce o sayfayı aç */
    const hedef = git.dataset.gezGit;
    const m = sayfaKimlikleri();
    const sahip = Object.keys(m).find(function (x) { return m[x].indexOf(hedef) !== -1; });

    if (sahip && sahip !== aktifSayfa) {
      location.hash = "#/" + hedef;
    } else {
      bolumeGit(hedef);
    }
    return;
  }

  if (e.target.closest("#yukariBtn")) {
    if (window.scrollTo) { window.scrollTo({ top: 0, behavior: "smooth" }); }
    return;
  }

  if (e.target.closest("[data-gez-geri]")) { geriGit(); }
});

document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") { return; }
  const p = document.querySelector("#icindekiler");
  if (p) { p.remove(); }
});

/* ==================== GEÇ ÇİZİM (lazy render) ====================
   33 bölümün hepsini açılışta çizmek mobilde yavaştı. Artık ağır bölümler
   ekrana yaklaşınca çiziliyor. Kaydırma çubuğu zıplamasın diye yer tutulur. */

const GEC_CIZILENLER = {
  ag: "agCiz", harita: "haritaCiz", zaman: "cizZaman", yankilar: "yankiCiz",
  aile: "aileCizTam", karsi: "karsiCiz", roman: "romanCiz", mektuplar: "mektupCiz",
  alintilar: "alintiCiz", notlar: "notlarCiz", basin: "basinCiz",
  degisiklik: "degisiklikCiz", galeri: "galeriCiz", test: "testCiz",
  sozluk: "sozlukCiz", bilinmeyenler: "bilinmeyenCiz", yazi: "yaziCiz",
  kimlik: "kimlikCiz", sohbet: "sohbetCiz", moodboard: "moodboardCiz",
  olaylar: "olaylarCiz", kisaHikayeler: "kisaHikayelerCiz", dosyalar: "dosyalarCiz",
  hikaye: "hikayeCiz", defter: "defterCiz", arsivci: "arsivciCiz",
  bag: "bagCiz", sira: "siraCiz", basarim: "basarimCiz",
  degisiklik: "degisiklikCiz", kayip: "kayipCiz", yapimlar: "cizYapimlar",
};

const cizildi = {};

/** Bir bölümü bir kez çizer. Zaten çizilmişse dokunmaz. */
function bolumuCiz(id) {
  if (cizildi[id]) { return; }

  const ad = GEC_CIZILENLER[id];
  const f = ad && window[ad];
  if (typeof f !== "function") { cizildi[id] = true; return; }

  try {
    f();
    cizildi[id] = true;
  } catch (hata) {
    console.error("[TentiforApp] " + id + " çizilemedi:", hata);
    cizildi[id] = true;   /* tekrar denemesin */
  }
}

/** Tazeleme sonrası yeniden çizilebilsin diye işaretleri temizler. */
function gecCizimSifirla() {
  Object.keys(cizildi).forEach(function (k) { delete cizildi[k]; });
}

function gecCizimKur() {
  const idler = Object.keys(GEC_CIZILENLER);

  /* IntersectionObserver yoksa hepsini hemen çiz — eski tarayıcı güvenliği */
  if (typeof IntersectionObserver !== "function") {
    idler.forEach(bolumuCiz);
    return;
  }

  const gozcu = new IntersectionObserver(function (girdiler) {
    girdiler.forEach(function (g) {
      if (!g.isIntersecting) { return; }
      bolumuCiz(g.target.id);
      gozcu.unobserve(g.target);
    });
  }, { rootMargin: "600px 0px" });

  idler.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) { return; }
    if (cizildi[id]) { return; }
    gozcu.observe(el);
  });

  /* Adresle ya da menüyle bir bölüme atlanırsa gözcüyü beklemeden çiz. */
  const hemen = function () {
    const hedef = location.hash.replace("#", "").split("/")[0];
    if (hedef) { bolumuCiz(hedef); }
  };
  window.addEventListener("hashchange", hemen);
  hemen();
}

/* Menüden atlarken hedef bölüm çizilmemişse önce çiz. */
document.addEventListener("click", function (e) {
  const g = e.target.closest("[data-gez-git]");
  if (g) { bolumuCiz(g.dataset.gezGit); }
}, true);

/* ==================== SAYFALAMA ====================
   Tek dosya kalıyor; sayfalar adres parçasıyla değişir. Sunucu isteği yok,
   bu yüzden file:// ile açılan tek dosya sürümünde de çalışır.

   Sayfa dışı bölümler DOM'dan silinmez, gizlenir — ama çizilmemişse hiç
   çizilmez, geç çizimle birlikte çalışır. */

/* Her sayfanın hangi bölümleri taşıdığı GEZINME'den türetilir. */
const SAYFA_BASLIK = {
  arsiv: "Arşiv", okuma: "Okuma", oyunlar: "Oyunlar", araclar: "Araçlar", sen: "Sen"
};

const SAYFA_ANAHTARI = "tentiforapp_sayfa";

/* Her sayfada kalıcı olarak görünenler: hero, keşif, yönetici. */
const HER_SAYFADA = ["kesif", "yonetici"];

let aktifSayfa = null;

function sayfaKimlikleri() {
  const m = {};
  GEZINME.forEach(function (g, i) {
    const kimlik = ["arsiv", "okuma", "oyunlar", "araclar", "sen"][i];
    m[kimlik] = g.bolumler.map(function (b) { return b[0]; });
  });
  return m;
}

function sayfaBolumleri(sayfa) {
  const m = sayfaKimlikleri();
  return (m[sayfa] || []).concat(HER_SAYFADA);
}

/** Bilinen sayfa mı? */
function sayfaVarMi(s) {
  return Object.prototype.hasOwnProperty.call(SAYFA_BASLIK, s);
}

function sayfaGoster(sayfa, kaydirma) {
  if (!sayfaVarMi(sayfa)) { sayfa = "arsiv"; }

  /* ayrılırken bulunduğun yeri sakla */
  if (aktifSayfa && aktifSayfa !== sayfa && typeof konumKaydet === "function") {
    konumKaydet();
  }

  /* arama kutusu sayfa değişince temizlenir; sonuçlar başka sayfaya ait olabilir */
  const ag = document.querySelector("#aramaGiris");
  if (ag && ag.value) { ag.value = ""; if (typeof aramaCiz === "function") { aramaCiz(""); } }

  aktifSayfa = sayfa;
  kayitYaz(SAYFA_ANAHTARI, sayfa);

  const gorunur = sayfaBolumleri(sayfa);
  const hero = document.querySelector(".hero");

  document.querySelectorAll("section.bolum").forEach(function (b) {
    const ait = gorunur.indexOf(b.id) !== -1;
    b.hidden = !ait;
    if (ait) { bolumuCiz(b.id); }
  });

  /* hero yalnızca arşiv sayfasında */
  if (hero) { hero.hidden = sayfa !== "arsiv"; }

  document.title = SAYFA_BASLIK[sayfa] + " — TentiforApp";
  hataSayfasiKapat();
  if (typeof kanonKilitUygula === "function") { kanonKilitUygula(); }
  gezinmeCiz();

  if (typeof gecisAnimasyonu === "function") { gecisAnimasyonu(); }

  if (kaydirma !== false && window.scrollTo) {
    /* kaldığın yer varsa oraya dön, yoksa başa */
    const dondu = (typeof konumGeriYukle === "function") && konumGeriYukle(sayfa);
    if (!dondu) { window.scrollTo({ top: 0, behavior: "auto" }); }
  }

  aktifBolumIsaretle();
}

/** Adresi okur ve sayfayı açar. Bilinmeyen adres 404'e gider. */
function sayfaYonlendir() {
  const h = location.hash.replace(/^#\/?/, "");

  if (!h) { sayfaGoster(kayitOku(SAYFA_ANAHTARI) || "arsiv", false); return; }

  const parca = h.split("/");
  const bas = parca[0];

  /* derin bağlantılar: #/karakter/tari, #/evren/xxx, #/meydan/... */
  if (["karakter", "evren", "meydan"].indexOf(bas) !== -1) {
    const hedefSayfa = bas === "karakter" ? "arsiv" : (bas === "meydan" ? "oyunlar" : "arsiv");
    if (aktifSayfa !== hedefSayfa) { sayfaGoster(hedefSayfa, false); }
    return;
  }

  /* sayfa adı */
  if (sayfaVarMi(bas)) { sayfaGoster(bas); return; }

  /* bölüm adı verilmişse hangi sayfada olduğunu bul */
  const m = sayfaKimlikleri();
  const sahip = Object.keys(m).find(function (s) { return m[s].indexOf(bas) !== -1; });

  if (sahip) {
    sayfaGoster(sahip, false);
    bolumeGit(bas);
    return;
  }

  hataSayfasiAc(bas);
}

/** Sayfaya git. Adres değişir, tarayıcı geçmişi çalışır. */
function sayfayaGit(sayfa) {
  if (location.hash === "#/" + sayfa) { sayfaGoster(sayfa); return; }
  location.hash = "#/" + sayfa;
}

/* ==================== 404 ==================== */

const YOK_METINLERI = [
  { baslik: "Bu sayfa buz altında değil. Sadece yok.",
    metin: "Aradığın adres hiçbir katmana ait değil, hiçbir QR kodu onu açmıyor. " +
           "Kütüphanede böyle bir raf yok — Necale kontrol etti, iki kez." },
  { baslik: "Dördüncü boyutta bir yere sapmış olabilirsin.",
    metin: "Bu adres bir baloncuk evrende olabilir ama bu evrende değil. " +
           "Yaşam'ın defterine baktık; böyle bir deney kaydı yok." },
  { baslik: "Oyunbozan burada bir not bırakmamış.",
    metin: "\"Beni Yakala\" yazan bir kâğıt bile yok. Yani gerçekten yanlış yerdesin." },
  { baslik: "Bu adres bir isim sisteminden geçmemiş.",
    metin: "Tersten de okuduk, harflerini de çevirdik. Hiçbir şey çıkmadı. " +
           "Bazı şeyler sadece yanlış yazılmıştır." },
  { baslik: "Gırılar bunu da yakmış olabilir.",
    metin: "İsyanda çok kitap yandı. Bu sayfa da onlardan biri olabilir — " +
           "ya da hiç var olmadı. İkisini ayırt etmenin bir yolu kalmadı." },
];

function hataSayfasiAc(istenen) {
  hataSayfasiKapat();

  const s = YOK_METINLERI[Math.floor(Math.random() * YOK_METINLERI.length)];

  const k = document.createElement("section");
  k.id = "yokSayfa";
  k.className = "bolum yok-sayfa";
  k.innerHTML =
    '<div class="yok-ic">' +
      '<div class="yok-kod">404</div>' +
      "<h2>" + kacir(s.baslik) + "</h2>" +
      "<p>" + kacir(s.metin) + "</p>" +
      '<p class="oyun-not">Aradığın adres: <code>' + kacir(String(istenen).slice(0, 60)) +
        "</code></p>" +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-sayfa="arsiv">Arşive dön</button>' +
        '<button class="dugme dugme-sade" id="yokRastgele">Rastgele bir şey göster</button>' +
      "</div>" +
    "</div>";

  const ana = document.querySelector("main");
  if (ana) { ana.appendChild(k); }

  document.querySelectorAll("section.bolum").forEach(function (b) {
    if (b.id !== "yokSayfa") { b.hidden = true; }
  });
  const hero = document.querySelector(".hero");
  if (hero) { hero.hidden = true; }

  document.title = "404 — TentiforApp";
}

function hataSayfasiKapat() {
  const k = document.querySelector("#yokSayfa");
  if (k) { k.remove(); }
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const s = e.target.closest("[data-sayfa]");
  if (s) { sayfayaGit(s.dataset.sayfa); return; }

  if (e.target.closest("#yokRastgele")) {
    hataSayfasiKapat();
    sayfaGoster("arsiv", false);
    if (typeof rastgeleKesif === "function") { rastgeleKesif(); }
  }
});

window.addEventListener("hashchange", sayfaYonlendir);

/* ==================== SAYFA HAFIZASI (bölüm düzeyinde) ====================
   Şu ana kadar yalnızca sayfa hatırlanıyordu; artık o sayfada nerede
   kaldığın da hatırlanıyor. */

const KONUM_ANAHTARI = "tentiforapp_konum";

function konumKaydet() {
  if (!aktifSayfa) { return; }

  const k = jsonOku(KONUM_ANAHTARI, {}) || {};
  k[aktifSayfa] = Math.round(document.documentElement.scrollTop || 0);
  jsonYaz(KONUM_ANAHTARI, k);
}

function konumGeriYukle(sayfa) {
  const k = jsonOku(KONUM_ANAHTARI, {}) || {};
  const y = k[sayfa];

  if (!y || y < 100 || !window.scrollTo) { return false; }

  /* geç çizim bölümleri yerleştirsin diye bir tur bekle */
  setTimeout(function () { window.scrollTo({ top: y, behavior: "auto" }); }, 60);
  return true;
}

/* ==================== SAYFA GEÇİŞ ANIMASYONU ==================== */

function gecisAnimasyonu() {
  const ana = document.querySelector("main");
  if (!ana) { return; }

  ana.classList.remove("sayfa-girdi");
  /* sınıfın yeniden uygulanması için bir kare bekle */
  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(function () { ana.classList.add("sayfa-girdi"); });
  } else {
    ana.classList.add("sayfa-girdi");
  }
}

/* ==================== KLAVYE İLE SAYFA GEÇİŞİ ==================== */

const SAYFA_SIRASI = ["arsiv", "okuma", "oyunlar", "araclar", "sen"];

document.addEventListener("keydown", function (e) {
  const a = document.activeElement;
  const yaziyor = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" ||
                        a.tagName === "SELECT" || a.isContentEditable);
  if (yaziyor || e.ctrlKey || e.metaKey || e.altKey) { return; }

  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= SAYFA_SIRASI.length) {
    e.preventDefault();
    sayfayaGit(SAYFA_SIRASI[n - 1]);
  }
});

window.addEventListener("beforeunload", konumKaydet);
