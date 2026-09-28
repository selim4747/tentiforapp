/* Yedinci dalga — gezinme ve konfor.

   33 bölüm ve 32 bağlantı bir şeritte duruyordu; kimse tarayamaz.
   Bu dosya gezinmeyi gruplar, içindekiler paneli açar, nerede olduğunu gösterir. */

/* ==================== BÖLÜM GRUPLARI ==================== */

const GEZINME = [
  { id: "arsiv", ad: "Arşiv", ikon: "▤", bolumler: [
    ["kesif", "Keşif ve arama"], ["arsiv", "Karakterler"], ["evren", "Evren"], ["kayip", "Kayıp"],
    ["bilinmeyenler", "Bilinmeyenler"] ] },

  { id: "baglar", ad: "Bağlar", ikon: "▥", bolumler: [
    ["aile", "Aile ağacı"], ["ag", "İlişki ağı"], ["karsi", "Karşılaştır"],
    ["yankilar", "Yankılar"] ] },

  { id: "dunya", ad: "Dünya", ikon: "▦", bolumler: [
    ["harita", "Harita"], ["zaman", "Zaman çizelgesi"], ["takvim", "Tömye takvimi"] ] },

  /* her evrenin kendi sayfası: Claude'un evreni kanon dışı, herkese açık */
  { id: "claude", ad: "Claude'un Evreni", ikon: "◐", bolumler: [
    ["claudeEvren", "Şomdo"] ] },

  { id: "okuma", ad: "Okuma", ikon: "▧", bolumler: [
    ["sira", "Nereden başlamalı"], ["roman", "Roman"], ["olaylar", "Olaylar"],
    ["hikaye", "Gece Vardiyası"], ["kisaHikayeler", "Kısa Hikâyeler"], ["ortakDefter", "Kütüphane Defteri"] ] },

  { id: "fan", ad: "Fan", ikon: "✎", bolumler: [
    ["fanHikaye", "Fan hikâyeleri"], ["fanEvren", "Fan evrenleri"], ["fanAc", "Dosya aç"] ] },

  { id: "belgeler", ad: "Belgeler", ikon: "▨", bolumler: [
    ["mektuplar", "Mektuplar"], ["alintilar", "Alıntılar"], ["notlar", "Yazar notları"],
    ["sohbet", "Karakter sohbeti"] ] },

  { id: "oyunlar", ad: "Oyunlar", ikon: "▩", bolumler: [
    ["oyunlar", "Yedi oyun"], ["yarislar", "Yarışlar"], ["av", "Arşiv avı"], ["kulup", "Kulübün"], ["okurBulmaca", "Okur bulmacaları"], ["liderlik", "Liderlik"], ["galeri", "Galeri"], ["bag", "Oyuna taşı"] ] },

  { id: "testler", ad: "Testler", ikon: "▪", bolumler: [
    ["test", "Hangi karaktersin?"], ["kimlik", "Kimlik Sınavı"] ] },

  { id: "araclar", ad: "Araçlar", ikon: "▫", bolumler: [
    ["isim", "İsim sistemi"], ["yazi", "Kyldo yazısı"], ["kartpostal", "Kartpostal"], ["sozluk", "Sözlük"],
    ["dosyalar", "Dosyalar"] ] },

  { id: "proje", ad: "Proje", ikon: "▬", bolumler: [
    ["delilik", "Delilik"], ["yapimlar", "Yapımlar"], ["basin", "Basın kiti"],
    ["moodboard", "Moodboard"], ["yazaraSor", "Yazara sor"] ] },

  /* 3.0: değişiklik günlüğü kendi sayfasında (/surumler/) */
  { id: "surumler", ad: "Değişiklikler", ikon: "▣", bolumler: [
    ["degisiklik", "Değişiklik günlüğü"] ] },

  { id: "sen", ad: "Sen", ikon: "▭", bolumler: [
    ["hesap", "Hesabın"], ["arsivci", "Arşivci kartın"], ["yilim", "Tömye Yılım"], ["koleksiyon", "Kart koleksiyonu"], ["defter", "Defterin"], ["basarim", "Başarımlar"],
    ["gizlilik", "Gizlilik"] ] },
];

/* Üst şerit: her düğme kendi sayfasını açar. Bölüm listesi İçindekiler'de. */
let gezinmeSonHtml = "";
let gezinmeKaydirSira = 0;

function gezinmeCiz() {
  const alan = document.querySelector("#gezinme");
  if (!alan) { return; }

  const html =
    '<button class="gez-btn" id="icindekilerBtn" aria-label="İçindekiler">☰ İçindekiler</button>' +
    GEZINME.map(function (g, i) {
      const bu = aktifSayfa === g.id;
      const yeni = (typeof ziyaretSayfaSayisi === "function") ? ziyaretSayfaSayisi(g.id) : 0;
      return '<a class="gez-btn' + (bu ? " bu-sayfa" : "") + '" href="#/' + g.id + '"' +
               ' title="' + (i + 1) + ". sayfa" + (yeni ? " · " + yeni + " yenilik" : "") + '"' +
               (bu ? ' aria-current="page"' : "") + ">" +
               kacir(g.ad) + (yeni ? '<span class="gez-yeni" aria-label="' + yeni + ' yenilik"></span>' : "") + "</a>";
    }).join("") +
    '<button class="komut-tetik" id="komutTetikBtn" aria-label="Hızlı arama (Ctrl+K)" title="Hızlı arama (Ctrl+K)">⌘K</button>';

  /* 3.0: aynı menü yeniden kurulmaz (açılışta birkaç kez çağrılıyordu, her seferinde düzen ölçülüyordu) */
  if (html === gezinmeSonHtml && alan.firstChild) { return; }
  gezinmeSonHtml = html;
  alan.innerHTML = html;

  /* seçili sayfa şeritte görünür kalsın (mobilde şerit yatay kayar); ölçüm bir sonraki karede, tek sefer */
  if (gezinmeKaydirSira) { return; }
  gezinmeKaydirSira = requestAnimationFrame(function () {
    gezinmeKaydirSira = 0;
    const bu = alan.querySelector(".bu-sayfa");
    if (bu && alan.scrollWidth > alan.clientWidth) {
      alan.scrollLeft = Math.max(0, bu.offsetLeft - (alan.clientWidth - bu.offsetWidth) / 2);
    }
  });
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

  /* kaydırma başına en çok bir kez, bir sonraki karede ölçülür (zorunlu yerleşimi önler) */
  let bekliyor = false;
  const tikIste = function () {
    if (bekliyor) { return; }
    bekliyor = true;
    requestAnimationFrame(function () { bekliyor = false; tik(); });
  };

  const tik = function () {
    const h = document.documentElement;
    const en = (h.scrollHeight - h.clientHeight) || 1;
    const oran = Math.min(100, Math.max(0, (h.scrollTop / en) * 100));

    const ic = c.firstChild;
    if (ic) { ic.style.width = oran + "%"; }

    y.classList.toggle("gorunur", h.scrollTop > 600 && !yukariAltiDolu());
    aktifBolumIsaretle();
  };

  /* altında düğme, bağlantı ya da yazı alanı varsa (ör. oyunun "Dene"si) ya da klavye açıksa gizlenir */
  const ETKILESIMLI = "button,a[href],input,textarea,select,label,[role=button],[contenteditable=true]";
  const yukariAltiDolu = function () {
    const o = document.activeElement;
    if (o && o !== y && o.matches && o.matches("input,textarea,select,[contenteditable=true]")) { return true; }
    if (!document.elementsFromPoint) { return false; }
    const r = y.getBoundingClientRect();
    const noktalar = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4]];
    return noktalar.some(function (n) {
      return document.elementsFromPoint(n[0], n[1]).some(function (el) {
        return el !== y && !el.closest(".alt-menu,#ilerleme") && getComputedStyle(el).position !== "fixed" && el.closest(ETKILESIMLI);
      });
    });
  };

  window.addEventListener("scroll", tikIste, { passive: true });
  document.addEventListener("focusin", tikIste);
  document.addEventListener("focusout", tikIste);
  tikIste();
}

/** Görünen bölümün adını üst şeride yazar. */
function aktifBolumIsaretle() {
  const et = document.querySelector("#aktifBolum");
  if (!et) { return; }

  const bolumler = document.querySelectorAll("section.bolum");
  let aktif = null;

  for (let i = 0; i < bolumler.length; i++) {
    if (bolumler[i].hidden) { continue; }   /* başka sayfanın bölümü */
    const k = bolumler[i].getBoundingClientRect ? bolumler[i].getBoundingClientRect() : null;
    /* kilitli ya da gizlenmiş (yüksekliği olmayan) bölüm "buradasın" diye görünmesin */
    if (!k || k.height < 2) { continue; }
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

  const git = e.target.closest("[data-gez-git]");
  if (git) {
    const p = document.querySelector("#icindekiler");
    if (p) { p.remove(); }

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
  degisiklik: "degisiklikCiz", kayip: "kayipCiz", yapimlar: "cizYapimlar", liderlik: "liderlikCiz", yarislar: "yarislarCiz", claudeEvren: "claudeEvrenCiz", av: "avCiz", kartpostal: "kartpostalCiz", ortakDefter: "ortakDefterCiz", yazaraSor: "yazaraSorCiz", kulup: "kulupCiz", okurBulmaca: "okurBulmacaCiz", yilim: "yilimCiz", koleksiyon: "koleksiyonCiz", fanHikaye: "fanHikayeCiz", fanEvren: "fanEvrenCiz", fanAc: "fanAcCiz",
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
    const hedef = rota().replace("#", "").split("/")[0];
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

/* Her sayfanın kimliği, başlığı ve hangi bölümleri taşıdığı GEZINME'den türetilir. */
const SAYFA_BASLIK = {};
GEZINME.forEach(function (g) { SAYFA_BASLIK[g.id] = g.ad; });

const SAYFA_ANAHTARI = "tentiforapp_sayfa";

/* Menüde listelenmeyen ama bir sayfaya ait bölümler. Yönetici girişi
   yalnızca "Sen" sayfasının sonunda durur, her sayfada tekrar etmez. */
const SAYFA_GIZLI_BOLUMLER = { sen: ["yonetici"] };

/* Kendi içeriği olmayan yardımcı bölümler: kanon kilidi sayımına girmez. */
const YARDIMCI_BOLUMLER = ["kesif", "yonetici"];

let aktifSayfa = null;

function sayfaKimlikleri() {
  const m = {};
  GEZINME.forEach(function (g) {
    m[g.id] = g.bolumler.map(function (b) { return b[0]; })
      .concat(SAYFA_GIZLI_BOLUMLER[g.id] || []);
  });
  return m;
}

function sayfaBolumleri(sayfa) {
  const m = sayfaKimlikleri();
  return m[sayfa] || [];
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

  /* evren sayfası açıksa başlık evrenin adı (sekme ve arama motorları için) */
  document.title = (typeof evrenSayfaBasligi === "function" && evrenSayfaBasligi()) || (SAYFA_BASLIK[sayfa] + " — TentiforApp");
  hataSayfasiKapat();
  sayfaBasiCiz(sayfa);
  sayfalamaCiz(sayfa);
  if (typeof kanonKilitUygula === "function") { kanonKilitUygula(); }
  gezinmeCiz();

  if (typeof gecisAnimasyonu === "function") { gecisAnimasyonu(); }

  if (kaydirma !== false && window.scrollTo) {
    /* kaldığın yer varsa oraya dön, yoksa başa */
    const dondu = (typeof konumGeriYukle === "function") && konumGeriYukle(sayfa);
    if (!dondu) { window.scrollTo({ top: 0, behavior: "auto" }); }
  }

  /* ölçüm bir sonraki karede: sayfa kurulurken düzeni zorla hesaplatmasın */
  requestAnimationFrame(aktifBolumIsaretle);

  /* tarayıcı boşalınca bu sayfanın bölümlerini bir kez ölç: sonraki kaydırmalar doğru yere gitsin */
  (window.requestIdleCallback || function (f) { return setTimeout(f, 300); })(bolumleriOlc);
}

/** Adresi okur ve sayfayı açar. Bilinmeyen adres 404'e gider. */
function sayfaYonlendir() {
  const h = rota().replace(/^#\/?/, "");

  if (!h) { sayfaGoster(kayitOku(SAYFA_ANAHTARI) || "arsiv", false); return; }

  const parca = h.split("/");
  const bas = parca[0];

  /* herkese açık profil: #/u/kullaniciadi — bulunduğun sayfanın üstünde açılır */
  if (bas === "u") {
    if (!aktifSayfa) { sayfaGoster("arsiv", false); }
    if (typeof hesapProfilAc === "function") { hesapProfilAc(parca[1] || ""); }
    return;
  }

  /* kartpostal: #/kartpostal/<bağlantıdaki veri> — Araçlar sayfasının üstünde açılır */
  if (bas === "kartpostal" && parca[1]) {
    if (aktifSayfa !== "araclar") { sayfaGoster("araclar", false); }
    if (typeof kartpostalAc === "function") { kartpostalAc(parca.slice(1).join("/")); }
    return;
  }

  /* karşılama: #/basla — Arşiv'in üstünde açılır (48-karsilama.js) */
  if (bas === "basla") {
    if (!aktifSayfa) { sayfaGoster("arsiv", false); }
    if (typeof karsilamaAc === "function") { karsilamaAc(); }
    return;
  }

  /* evren sayfası: #/ev/benim/<id>, #/ev/fan/<id>, #/ev/e99 — Fan sayfasının üstünde açılır (44-evrenler.js) */
  if (bas === "ev") {
    if (!aktifSayfa) { sayfaGoster("fan", false); }
    return;
  }

  /* fan eseri: #/fan/hikaye/<id> ya da #/fan/evren/<id> — Fan sayfasının üstünde açılır */
  if (bas === "fan" && parca[1] && parca[2]) {
    if (aktifSayfa !== "fan") { sayfaGoster("fan", false); }
    if (typeof fanSiteEserAc === "function") { fanSiteEserAc(parca[1], decodeURIComponent(parca[2])); }
    return;
  }

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
  if (rota() === "#/" + sayfa) { sayfaGoster(sayfa); return; }
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
  const sc = document.querySelector("#sayfalama");
  if (sc) { sc.hidden = true; }
  const sb = document.querySelector("#sayfaBasi");
  if (sb) { sb.hidden = true; }

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

/* Bölümler ekran dışındayken çizilmiyor (content-visibility: auto); yükseklikleri o sırada tahmindir.
   Bir yere programla kaydırmadan önce hepsi bir kez gerçek boyutuyla ölçülür; tarayıcı bu boyutları hatırlar
   (contain-intrinsic-size: auto), sonra bölümler yine ekran dışındayken çizilmez. */
function bolumleriOlc() {
  const kok = document.documentElement;
  kok.classList.add("bolum-olc");
  void document.body.offsetHeight;
  requestAnimationFrame(function () { requestAnimationFrame(function () { kok.classList.remove("bolum-olc"); }); });
}

function konumGeriYukle(sayfa) {
  const k = jsonOku(KONUM_ANAHTARI, {}) || {};
  const y = k[sayfa];

  if (!y || y < 100 || !window.scrollTo) { return false; }

  /* geç çizim bölümleri yerleştirsin diye bir tur bekle */
  setTimeout(function () { bolumleriOlc(); window.scrollTo({ top: y, behavior: "auto" }); }, 60);
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

/* ==================== SAYFALAMA ÇUBUĞU ====================
   Her sayfanın sonunda: önceki / numaralar / sonraki. */

const SAYFA_SIRASI = GEZINME.map(function (g) { return g.id; });

/** Sayfanın en üstündeki başlık: "3 / 10 · Dünya" ve bu sayfadaki bölümler.
    Arşiv sayfasında hero bu işi gördüğü için gösterilmez. */
function sayfaBasiCiz(sayfa) {
  let c = document.querySelector("#sayfaBasi");
  if (!c) {
    const ana = document.querySelector("main");
    if (!ana) { return; }
    c = document.createElement("header");
    c.id = "sayfaBasi";
    c.className = "sayfa-basi";
    ana.insertBefore(c, ana.firstChild);
  }

  const i = SAYFA_SIRASI.indexOf(sayfa);
  const g = GEZINME[i];
  c.hidden = !g || sayfa === "arsiv";
  if (c.hidden) { return; }

  c.innerHTML =
    '<div class="sayfa-bas-ust"><div class="sayfa-bas-yazi">' +
      '<p class="sayfa-no">Sayfa ' + (i + 1) + " / " + SAYFA_SIRASI.length + "</p>" +
      "<h1>" + kacir(g.ad) + "</h1></div>" +
      '<button class="dugme dugme-sade sayfa-paylas" data-sayfa-paylas="' + sayfa + '"><span aria-hidden="true">↗</span> Paylaş</button></div>' +
    '<div class="sayfa-icerik" role="navigation" aria-label="Bu sayfada">' +
      g.bolumler.map(function (b) {
        return '<button class="sayfa-icerik-oge" data-gez-git="' + b[0] + '">' +
                 kacir(b[1]) + kanonKilitIsareti(b[0]) + "</button>";
      }).join("") +
    "</div>";
}

function sayfalamaCiz(sayfa) {
  let c = document.querySelector("#sayfalama");
  if (!c) {
    const ana = document.querySelector("main");
    if (!ana) { return; }
    c = document.createElement("nav");
    c.id = "sayfalama";
    c.className = "sayfalama";
    c.setAttribute("aria-label", "Sayfalar");
    ana.appendChild(c);
  }
  c.hidden = false;

  const i = SAYFA_SIRASI.indexOf(sayfa);
  const onceki = SAYFA_SIRASI[i - 1];
  const sonraki = SAYFA_SIRASI[i + 1];

  c.innerHTML =
    (onceki
      ? '<button class="sayfalama-yon" data-sayfa="' + onceki + '">← ' + kacir(SAYFA_BASLIK[onceki]) + "</button>"
      : '<span class="sayfalama-yon bos"></span>') +
    '<div class="sayfalama-no">' +
      SAYFA_SIRASI.map(function (s, n) {
        return '<button class="sayfalama-sayi' + (s === sayfa ? " bu" : "") + '" data-sayfa="' + s + '"' +
               ' title="' + kacir(SAYFA_BASLIK[s]) + '"' +
               (s === sayfa ? ' aria-current="page"' : "") + ">" + (n + 1) + "</button>";
      }).join("") +
    "</div>" +
    (sonraki
      ? '<button class="sayfalama-yon" data-sayfa="' + sonraki + '">' + kacir(SAYFA_BASLIK[sonraki]) + " →</button>"
      : '<span class="sayfalama-yon bos"></span>');
}

/* ==================== KLAVYE İLE SAYFA GEÇİŞİ ====================
   1–9 ilk dokuz sayfa, 0 onuncu sayfa. */

document.addEventListener("keydown", function (e) {
  const a = document.activeElement;
  const yaziyor = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" ||
                        a.tagName === "SELECT" || a.isContentEditable);
  if (yaziyor || e.ctrlKey || e.metaKey || e.altKey) { return; }

  const n = parseInt(e.key, 10);
  if (isNaN(n)) { return; }
  const sira = n === 0 ? 10 : n;
  if (sira >= 1 && sira <= SAYFA_SIRASI.length) {
    e.preventDefault();
    sayfayaGit(SAYFA_SIRASI[sira - 1]);
  }
});

window.addEventListener("beforeunload", konumKaydet);
