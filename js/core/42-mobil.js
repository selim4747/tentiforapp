/* Mobil ve uygulama deneyimi.

   - Dar ekranda (≤760px) altta sabit bir menü: Arşiv, Oku, Oyna, Fan ve "Menü".
     Menü sayfası bütün sayfaları, aramayı, gece modunu, ortam sesini, rastgele keşfi,
     Kod'u ve uygulamayı yüklemeyi tek yerde toplar; üstteki kalabalık küçülür.
   - Uygulama olarak yükleme: Android/masaüstünde tarayıcının yükleme penceresi,
     iPhone'da "Ana Ekrana Ekle" yönergesi.
   - Paylaşılan / açılan dosyalar: telefonda bir .tentifor.html dosyasını
     (WhatsApp'tan, dosyalardan) "Paylaş → TentiforApp" ile göndermek ya da masaüstünde
     dosyaya çift tıklamak onu doğrudan Fan → Dosya aç'ta açar (manifest share_target / file_handlers). */

const ALT_MENU = [
  ["arsiv", "Ana sayfa", "▤"], ["okuma", "Oku", "▧"], ["oyunlar", "Oyna", "▩"], ["evren", "Evren", "◎"]
];
const MOBIL_ENI = 760;

function mobilMi() { return window.matchMedia ? window.matchMedia("(max-width: " + MOBIL_ENI + "px)").matches : window.innerWidth <= MOBIL_ENI; }

function uygulamaKurulu() {
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
}

/* ==================== alt menü ==================== */

function altMenuCiz() {
  let n = document.querySelector("#altMenu");
  if (!n) {
    n = document.createElement("nav");
    n.id = "altMenu";
    n.className = "alt-menu";
    n.setAttribute("aria-label", "Hızlı gezinme");
    document.body.appendChild(n);
    document.documentElement.classList.add("alt-menulu");
  }
  const bu = typeof aktifSayfa !== "undefined" ? aktifSayfa : "";
  const acik = !!document.querySelector("#mobilMenu");
  n.innerHTML = ALT_MENU.map(function (m) {
    if (m[0] === "evren") {
      const ev = rota().indexOf("#/ev/") === 0 || !!document.querySelector("#evrenSecici");
      return '<button class="alt-oge' + (ev ? " bu" : "") + '" data-evren-sec aria-haspopup="dialog">' +
        '<span class="alt-ikon" aria-hidden="true">' + m[2] + "</span><span>" + kacir(m[1]) + "</span></button>";
    }
    const yeni = (typeof ziyaretSayfaSayisi === "function") ? ziyaretSayfaSayisi(m[0]) : 0;
    return '<a class="alt-oge' + (bu === m[0] ? " bu" : "") + '" href="#/' + m[0] + '"' + (bu === m[0] ? ' aria-current="page"' : "") + ">" +
      '<span class="alt-ikon" aria-hidden="true">' + m[2] + "</span><span>" + kacir(m[1]) + "</span>" +
      (yeni ? '<span class="alt-yeni" aria-label="' + yeni + ' yenilik"></span>' : "") + "</a>";
  }).join("") +
    '<button class="alt-oge' + (acik || ALT_MENU.every(function (m) { return m[0] !== bu; }) ? " bu" : "") + '" data-mobil-menu aria-haspopup="dialog" aria-expanded="' + acik + '">' +
      '<span class="alt-ikon" aria-hidden="true">☰</span><span>Menü</span></button>';
}

/* ==================== menü sayfası ==================== */

let kurulumOlayi = null;   /* beforeinstallprompt */

function mobilMenuAc() {
  if (document.querySelector("#mobilMenu")) { mobilMenuKapat(); return; }
  const m = document.createElement("div");
  m.id = "mobilMenu";
  m.className = "mobil-menu-katman";
  document.body.appendChild(m);
  mobilMenuCiz();
  document.documentElement.classList.add("menu-acik");
  altMenuCiz();
  const ilk = m.querySelector("[data-mobil-ara]");
  if (ilk) { ilk.focus({ preventScroll: true }); }
}

function mobilMenuKapat() {
  const m = document.querySelector("#mobilMenu");
  if (m) { m.remove(); }
  document.documentElement.classList.remove("menu-acik");
  altMenuCiz();
}

function mobilMenuCiz() {
  const m = document.querySelector("#mobilMenu");
  if (!m) { return; }
  const bu = typeof aktifSayfa !== "undefined" ? aktifSayfa : "";
  const gece = document.documentElement.getAttribute("data-ayar-tema") === "gece";
  const sesAcik = typeof ortamSesAcikMi === "function" && ortamSesAcikMi();
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  /* 3.0: Android'de menü Chrome'un kısayol uygulamasını değil, sitenin kendi Android uygulamasını (APK) indirir */
  const android = /Android/i.test(navigator.userAgent) && !(typeof kabukMu === "function" && kabukMu());
  if (android && APK_BILGI.durum === "") { apkBilgiYukle(); }
  const apk = android && APK_BILGI.durum !== "yok"
    ? '<a class="mm-eylem mm-yukle" href="/uygulama/indir/tentiforapp.apk' + (APK_BILGI.kod ? "?v=" + encodeURIComponent(APK_BILGI.kod) : "") + '" download data-apk-indir>' +
        '<span aria-hidden="true">⤓</span>Android uygulamasını indir' + (APK_BILGI.surum ? " · " + kacir(APK_BILGI.surum) : "") + (APK_BILGI.boyut ? " · " + (APK_BILGI.boyut / 1048576).toFixed(1) + " MB" : "") + "</a>" +
      '<div class="mm-ipucu">İnince dosyayı aç ve “Yükle”ye dokun. Android ilk seferde bu kaynağa izin vermeni isteyebilir.</div>'
    : "";
  const yukle = apk || (uygulamaKurulu() ? "" : (kurulumOlayi
    ? '<button class="mm-eylem mm-yukle" data-mobil-yukle><span aria-hidden="true">⤓</span>Uygulamayı yükle</button>'
    : (ios ? '<div class="mm-ipucu">Uygulama gibi kullanmak için: Safari\'de <b>Paylaş</b> → <b>Ana Ekrana Ekle</b>. Bildirimler de ancak böyle çalışır.</div>' : "")));

  m.innerHTML =
    '<div class="mobil-menu" role="dialog" aria-modal="true" aria-label="Menü">' +
      '<div class="mm-ust"><b>Menü</b><button class="pencere-kapat" data-mobil-kapat aria-label="Kapat">✕</button></div>' +
      '<button class="mm-ara" data-mobil-ara><span aria-hidden="true">⌕</span> Arşivde ara…</button>' +
      '<div class="mm-sayfalar">' + GEZINME.map(function (g) {
        const yeni = (typeof ziyaretSayfaSayisi === "function") ? ziyaretSayfaSayisi(g.id) : 0;
        return '<a class="mm-sayfa' + (g.id === bu ? " bu" : "") + '" href="#/' + g.id + '"' + (g.id === bu ? ' aria-current="page"' : "") + ">" +
          '<span class="mm-ikon" aria-hidden="true">' + kacir(g.ikon || "▪") + "</span>" +
          '<span class="mm-ad">' + kacir(g.ad) + "</span>" +
          (yeni ? '<span class="alt-yeni" aria-label="' + yeni + ' yenilik"></span>' : "") + "</a>";
      }).join("") + "</div>" +
      '<div class="mm-eylemler">' +
        '<button class="mm-eylem" data-mobil-eylem="icindekiler"><span aria-hidden="true">☰</span>İçindekiler</button>' +
        '<button class="mm-eylem" data-mobil-eylem="tema" aria-pressed="' + gece + '"><span aria-hidden="true">' + (gece ? "☾" : "☀") + "</span>" + (gece ? "Gece modu açık" : "Gece modu") + "</button>" +
        '<button class="mm-eylem" data-mobil-eylem="ses" aria-pressed="' + sesAcik + '"><span aria-hidden="true">♪</span>' + (sesAcik ? "Ortam sesi açık" : "Ortam sesi") + "</button>" +
        '<button class="mm-eylem" data-mobil-eylem="rastgele"><span aria-hidden="true">⤳</span>Rastgele keşif</button>' +
        '<button class="mm-eylem" data-mobil-eylem="kod"><span aria-hidden="true">⌗</span>Kod gir</button>' +
        '<button class="mm-eylem" data-mobil-eylem="dosya"><span aria-hidden="true">⇪</span>Dosya aç</button>' +
      "</div>" +
      yukle +
    "</div>";
}

/* ==================== uygulama yükleme ==================== */

const APK_BILGI = { durum: "", surum: "", boyut: 0, kod: "" };
function apkBilgiYukle() {
  APK_BILGI.durum = "yukleniyor";
  fetch("/uygulama/indir/apk.json", { cache: "no-cache" }).then(function (y) { return y.ok ? y.json() : null; }).then(function (d) {
    if (!d || !d.kod) { APK_BILGI.durum = "yok"; } else { APK_BILGI.durum = "var"; APK_BILGI.surum = String(d.surum || ""); APK_BILGI.boyut = Number(d.boyut) || 0; APK_BILGI.kod = String(d.kod); }
    mobilMenuCiz();
  }).catch(function () { APK_BILGI.durum = "var"; });
}

window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  kurulumOlayi = e;
  mobilMenuCiz();
});
window.addEventListener("appinstalled", function () { kurulumOlayi = null; mobilMenuCiz(); });

async function uygulamaYukle() {
  if (!kurulumOlayi) { return; }
  const o = kurulumOlayi;
  kurulumOlayi = null;
  try { o.prompt(); await o.userChoice; } catch (_) { /* vazgeçti */ }
  mobilMenuCiz();
}

/* ==================== paylaşılan / açılan dosya ==================== */

const PAYLASIM_ONBELLEK = "tf-paylasim";

/** Servis çalışanı paylaşılan dosyayı önbelleğe koyup #/fan/paylasim'a yönlendirir; burada açılır. */
async function paylasilanDosyaAc() {
  if (rota().indexOf("#/fan/paylasim") !== 0) { return; }
  history.replaceState(null, "", rotadanYol("#/fanAc") + location.search);
  if (typeof sayfaYonlendir === "function") { sayfaYonlendir(); }
  if (!("caches" in window)) { return; }
  try {
    const c = await caches.open(PAYLASIM_ONBELLEK);
    const y = await c.match("/__paylasilan");
    if (!y) { return; }
    await c.delete("/__paylasilan");
    const metin = await y.text();
    const e = fanMetindenEser(metin);
    fanAcilanEkle(e);
    if (typeof fanAcCiz === "function") { fanAcCiz(); }
    fanPencere(e, "acilan");
  } catch (hata) {
    const d = document.querySelector("#fanAcDurum");
    if (d) { d.textContent = "Paylaşılan dosya açılamadı: " + ((hata && hata.message) || hata); d.className = "pencere-durum kotu"; }
  }
}

/* Masaüstü: yüklü uygulamada dosyaya çift tıklama */
if ("launchQueue" in window && window.launchQueue && window.launchQueue.setConsumer) {
  window.launchQueue.setConsumer(function (p) {
    if (!p || !p.files || !p.files.length) { return; }
    p.files[0].getFile().then(function (f) {
      if (typeof sayfayaGit === "function") { sayfayaGit("fan"); }
      if (typeof fanDosyaAc === "function") { fanDosyaAc(f); }
    }).catch(function () { /* okunamadı */ });
  });
}

/* ==================== bağlama ==================== */

/* gezinme her çizildiğinde alt menü de güncellensin */
(function () {
  const eski = window.gezinmeCiz;
  if (typeof eski !== "function") { return; }
  window.gezinmeCiz = function () {
    const r = eski.apply(this, arguments);
    try { altMenuCiz(); } catch (e) { /* alt menü asıl gezinmeyi bozmasın */ }
    return r;
  };
})();

window.addEventListener("hashchange", function () {
  if (rota().indexOf("#/fan/paylasim") === 0) { paylasilanDosyaAc(); }
  if (document.querySelector("#mobilMenu")) { mobilMenuKapat(); }
});

document.addEventListener("click", function (e) {
  const h = e.target.closest("[data-mobil-menu], [data-mobil-kapat], [data-mobil-ara], [data-mobil-eylem], [data-mobil-yukle], .mobil-menu-katman, .mm-sayfa");
  if (!h) { return; }
  if (h.classList.contains("mobil-menu-katman")) { if (e.target === h) { mobilMenuKapat(); } return; }
  if (h.classList.contains("mm-sayfa")) {
    /* aynı sayfaya dokununca da kapansın */
    if (h.getAttribute("href") === rota()) { mobilMenuKapat(); }
    return;
  }
  const d = h.dataset;
  if (h.hasAttribute("data-mobil-menu")) { mobilMenuAc(); return; }
  if (h.hasAttribute("data-mobil-kapat")) { mobilMenuKapat(); return; }
  if (h.hasAttribute("data-mobil-yukle")) { uygulamaYukle(); return; }
  if (h.hasAttribute("data-mobil-ara")) { mobilMenuKapat(); if (typeof komutPaletiAc === "function") { komutPaletiAc(); } return; }
  const eylem = d.mobilEylem;
  if (eylem === "tema") { if (typeof temaDegistir === "function") { temaDegistir(); } mobilMenuCiz(); return; }
  if (eylem === "ses") { const b = document.querySelector("#ortamSes"); if (b) { b.click(); } setTimeout(mobilMenuCiz, 50); return; }
  mobilMenuKapat();
  if (eylem === "icindekiler" && typeof icindekilerAc === "function") { icindekilerAc(); }
  else if (eylem === "rastgele" && typeof rastgeleKesif === "function") { rastgeleKesif(); }
  else if (eylem === "kod") { const b = document.querySelector("#btnKod"); if (b) { b.click(); } }
  else if (eylem === "dosya") { location.hash = "#/fanAc"; }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && document.querySelector("#mobilMenu")) { mobilMenuKapat(); }
});

document.addEventListener("DOMContentLoaded", function () {
  try { altMenuCiz(); } catch (e) { /* veri gelince gezinmeyle birlikte çizilir */ }
  /* paylaşılan dosya: veri yüklenince aç (fanMetindenEser veri gerektirmez ama sayfa gezinmesi gerektirir) */
  if (rota().indexOf("#/fan/paylasim") === 0) {
    const bekle = setInterval(function () {
      if (typeof veri !== "undefined" && veri) { clearInterval(bekle); paylasilanDosyaAc(); }
    }, 100);
    setTimeout(function () { clearInterval(bekle); }, 15000);
  }
});

/* ==================== çevrimdışı ==================== */
/* Metro, uçak, zayıf çekim: site son görülen kopyayla çalışmaya devam eder; hesap işleri bekler. */
function baglantiDurumuCiz() {
  let b = document.querySelector("#cevrimdisi");
  if (navigator.onLine !== false) { if (b) { b.remove(); } return; }
  if (!b) {
    b = document.createElement("div");
    b.id = "cevrimdisi";
    b.className = "cevrimdisi";
    b.setAttribute("role", "status");
    b.textContent = "Çevrimdışısın · okuma, oyunlar ve kendi evrenlerin çalışır; kazandıkların cihazda durur, bağlantı gelince hesabına eşitlenir.";
    document.body.appendChild(b);
  }
}
window.addEventListener("offline", baglantiDurumuCiz);
window.addEventListener("online", function () {
  baglantiDurumuCiz();
  if (typeof eckaBildir === "function") { eckaBildir("Bağlantı geri geldi"); }
  if (typeof hesapEsitle === "function" && typeof hesapKullanici !== "undefined" && hesapKullanici) { hesapEsitle(); }
});
document.addEventListener("DOMContentLoaded", baglantiDurumuCiz);

/* ==================== sürüm notu ==================== */
/* Site güncellenince geri gelen ziyaretçiye bir kez "Neler yeni" kartı; ilk gelen görmez. */
const SURUM_ANAHTAR = "tentiforapp_gorulen_surum";

function surumNotuCiz() {
  const alan = document.querySelector("#surumNotuAlan");
  if (!alan || typeof veri === "undefined" || !veri || !veri.surum) { return; }
  const gorulen = kayitOku(SURUM_ANAHTAR);
  if (!gorulen) { kayitYaz(SURUM_ANAHTAR, veri.surum); alan.innerHTML = ""; return; }
  if (gorulen === veri.surum) { alan.innerHTML = ""; return; }
  const son = (veri.degisiklik || [])[0];
  if (!son) { alan.innerHTML = ""; return; }
  alan.innerHTML = '<div class="surum-notu" role="region" aria-label="Neler yeni">' +
    '<div class="surum-ust"><span class="oyun-etiket">Neler yeni · ' + kacir(son.surum) + '</span>' +
      '<button class="pencere-kapat" data-surum-kapat aria-label="Kapat">✕</button></div>' +
    "<ul>" + (son.maddeler || []).slice(0, 6).map(function (m) { return "<li>" + kacir(m) + "</li>"; }).join("") + "</ul>" +
    '<button class="dugme dugme-sade" data-gez-git="degisiklik">Bütün değişiklikler</button></div>';
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-surum-kapat], .surum-notu [data-gez-git]")) {
    kayitYaz(SURUM_ANAHTAR, veri.surum);
    const a = document.querySelector("#surumNotuAlan");
    if (a) { a.innerHTML = ""; }
  }
});
