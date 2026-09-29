/* Android uygulaması (Capacitor kabuğu) içindeyken.
   - Uygulama siteyi internetten açar: içerik her Yayınla'da kendiliğinden güncel.
   - Kabuğun kendisi (APK) yenilenince: /uygulama/indir/apk.json'daki sürüm kodu kurulu olandan büyükse
     "Yeni uygulama sürümü" çubuğu; İndir, APK'yı telefonun tarayıcısında açar (Android kurulumu onaylatır).
     Günde en çok bir kez bakılır; Supabase'e gitmez.
   - Google girişi: Google uygulama içi (WebView) girişe izin vermez; düğme ne yapılacağını söyler.
   Tarayıcıda bu dosya hiçbir şey yapmaz. */

const KABUK = { kontrol: "tentiforapp_apk_kontrol" };

function kabukMu() { return typeof TentiforKopru !== "undefined" && TentiforKopru.ortam() === "capacitor"; }
function kabukEklenti(ad) { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[ad]; }

/* 3.0 — uygulamanın açılış ekranı (APK'da @capacitor/splash-screen): sayfa hazır olunca kalkar; bir şey ters
   giderse en geç 6 sn sonra kendiliğinden kalkar (uygulama/kabuk/capacitor.config.json). */
function kabukAcilisKapat() {
  const s = kabukEklenti("SplashScreen");
  if (s && s.hide) { try { s.hide({ fadeOutDuration: 200 }); } catch (_) { /* yok */ } }
}
document.addEventListener("tf-veri-hazir", kabukAcilisKapat);
if (document.documentElement.classList.contains("veri-hazir")) { kabukAcilisKapat(); }

function kabukDisAc(url) {
  const b = kabukEklenti("Browser");
  if (b) { return b.open({ url: url }); }
  window.open(url, "_blank");
  return Promise.resolve();
}

async function kabukGuncellemeBak(zorla) {
  if (!kabukMu()) { return null; }
  try {
    const son = Number(localStorage.getItem(KABUK.kontrol)) || 0;
    if (!zorla && Date.now() - son < 12 * 3600000) { return null; }
    localStorage.setItem(KABUK.kontrol, String(Date.now()));
  } catch (_) { /* yok */ }
  let uzak = null, kurulu = null;
  try { const y = await fetch("/uygulama/indir/apk.json", { cache: "no-store" }); uzak = y.ok ? await y.json() : null; } catch (_) { uzak = null; }
  const app = kabukEklenti("App");
  try { kurulu = app ? await app.getInfo() : null; } catch (_) { kurulu = null; }
  if (!uzak || !kurulu || !(Number(uzak.kod) > Number(kurulu.build))) { return null; }
  kabukGuncellemeCiz(uzak);
  return uzak;
}

function kabukGuncellemeCiz(u) {
  if (document.querySelector("#kabukGuncelleme")) { return; }
  const d = document.createElement("div");
  d.id = "kabukGuncelleme";
  d.className = "kabuk-guncelleme";
  d.setAttribute("role", "status");
  const mb = u.boyut ? " · " + (u.boyut / 1048576).toFixed(1) + " MB" : "";
  d.innerHTML = '<div><b>Uygulamanın yeni sürümü hazır</b><span class="oyun-not"> ' + kacir(String(u.surum || "")) + mb + "</span>" +
    (u.not ? '<p class="oyun-not">' + kacir(u.not) + "</p>" : "") + "</div>" +
    '<button class="dugme" data-kabuk-indir>İndir</button><button class="kabuk-kapat" data-kabuk-kapat aria-label="Sonra">✕</button>';
  d.dataset.adres = location.origin + "/uygulama/indir/tentiforapp.apk?v=" + encodeURIComponent(String(u.kod));
  document.body.appendChild(d);
}

document.addEventListener("click", function (ev) {
  const i = ev.target.closest && ev.target.closest("[data-kabuk-indir]");
  if (i) {
    const d = document.querySelector("#kabukGuncelleme");
    kabukDisAc(d.dataset.adres);
    d.querySelector("div").innerHTML = "<b>İndiriliyor…</b><p class=\"oyun-not\">İnince açıp “Yükle”ye dokun. Android ilk seferde bu kaynağa izin vermeni isteyebilir. İlerlemen kaybolmaz.</p>";
    return;
  }
  if (ev.target.closest && ev.target.closest("[data-kabuk-kapat]")) { const d = document.querySelector("#kabukGuncelleme"); if (d) { d.remove(); } }
});

/* Google girişi uygulama içinde çalışmaz (Google'ın kuralı) */
document.addEventListener("click", function (ev) {
  if (!kabukMu() || !ev.target.closest || !ev.target.closest("[data-google-giris]")) { return; }
  ev.preventDefault(); ev.stopImmediatePropagation();
  const f = document.querySelector("#perde .pencere");
  if (!f || f.querySelector(".kabuk-google")) { return; }
  const n = document.createElement("p");
  n.className = "pencere-durum kabuk-google";
  n.innerHTML = "Google, uygulama içinden girişe izin vermiyor. Burada <b>e-postayla</b> gir; hesabın Google ile açıldıysa önce tarayıcıda " +
    "“Şifremi unuttum” ile bir şifre belirle, sonra aynı e-postayla buradan gir.";
  f.appendChild(n);
}, true);

document.addEventListener("DOMContentLoaded", function () {
  if (!kabukMu()) { return; }
  document.documentElement.classList.add("kabuk");
  setTimeout(function () { kabukGuncellemeBak(false); }, 4000);
});

/* ==================== sesli okuma: WebView'da yok, telefonun kendi sesiyle ==================== */
/* Site speechSynthesis / SpeechSynthesisUtterance kullanır (js/13, js/32); uygulamada aynı adlarla
   TextToSpeech eklentisine bağlanır. Sıra, iptal ve onend site nasıl bekliyorsa öyle. */
(function () {
  const tts = kabukEklenti("TextToSpeech");
  if (!tts || !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) { return; }
  const sira = [];
  let calisan = null, nesil = 0;
  function Soz(metin) { this.text = String(metin || ""); this.lang = "tr-TR"; this.rate = 1; this.voice = null; this.onend = null; this.onerror = null; this.onstart = null; }
  function sonraki() {
    if (calisan || !sira.length) { return; }
    const u = sira.shift(), n = nesil;
    calisan = u;
    if (typeof u.onstart === "function") { u.onstart({}); }
    tts.speak({ text: u.text, lang: u.lang || "tr-TR", rate: Math.max(0.1, Math.min(2, Number(u.rate) || 1)), category: "playback" })
      .then(function () { if (n !== nesil) { return; } calisan = null; if (typeof u.onend === "function") { u.onend({}); } sonraki(); })
      .catch(function (e) { if (n !== nesil) { return; } calisan = null; if (typeof u.onerror === "function") { u.onerror({ error: String(e) }); } sonraki(); });
  }
  const ses = {
    speak: function (u) { sira.push(u); sonraki(); },
    cancel: function () { nesil++; sira.length = 0; calisan = null; tts.stop().catch(function () { /* yok */ }); },
    getVoices: function () { return []; },
    pause: function () { /* yok */ }, resume: function () { /* yok */ },
    addEventListener: function () { /* yok */ }, removeEventListener: function () { /* yok */ }
  };
  Object.defineProperty(ses, "speaking", { get: function () { return !!calisan || sira.length > 0; } });
  try { Object.defineProperty(window, "speechSynthesis", { value: ses, configurable: true, writable: true }); } catch (_) { /* yok */ }
  try { Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Soz, configurable: true, writable: true }); } catch (_) { /* yok */ }
})();

/* ==================== dosya indirme: WebView <a download>'u yok sayar ==================== */
/* Dosya uygulamanın önbelleğine yazılır, telefonun "Kaydet / Paylaş" menüsü açılır. */
function kabukBase64(blob) {
  return new Promise(function (tamam, hata) {
    const r = new FileReader();
    r.onload = function () { tamam(String(r.result).replace(/^data:[^,]*,/, "")); };
    r.onerror = function () { hata(r.error); };
    r.readAsDataURL(blob);
  });
}

async function kabukDosyaKaydet(href, ad) {
  const fs = kabukEklenti("Filesystem"), sh = kabukEklenti("Share");
  const cevap = fetch(href);   /* hemen: sayfa blob adresini birazdan geri alabilir */
  try {
    const blob = await (await cevap).blob();
    const dosya = String(ad || "tentiforapp").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120) || "tentiforapp";
    const y = await fs.writeFile({ path: dosya, data: await kabukBase64(blob), directory: "CACHE" });
    await sh.share({ title: dosya, dialogTitle: "Kaydet ya da paylaş", files: [y.uri] });
    return true;
  } catch (e) {
    if (e && /cancel/i.test(String(e.message || e))) { return false; }
    if (typeof eckaBildir === "function") { eckaBildir("Dosya kaydedilemedi"); }
    return false;
  }
}

function kabukIndirmeMi(a) {
  return kabukMu() && a && a.hasAttribute && a.hasAttribute("download") && a.href && kabukEklenti("Filesystem") && kabukEklenti("Share");
}

(function () {
  const asil = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (kabukIndirmeMi(this)) { kabukDosyaKaydet(this.href, this.getAttribute("download") || ""); return; }
    return asil.apply(this, arguments);
  };
})();

/* ==================== bağlantılar ==================== */
/* Yeni sekme ya da başka site: telefonun tarayıcısı. Aynı siteye yeni sekme: uygulamanın içinde. */
function kabukBaglantiYonet(href, yeniSekme) {
  let u;
  try { u = new URL(href, location.href); } catch (_) { return false; }
  if (!/^https?:$/.test(u.protocol)) { return false; }            /* mailto:, tel:, blob:, data: kendi yoluyla */
  if (u.host !== location.host) { kabukDisAc(u.href); return true; }
  if (yeniSekme) { location.href = u.href; return true; }
  return false;
}

document.addEventListener("click", function (ev) {
  if (!kabukMu() || ev.defaultPrevented || !ev.target.closest) { return; }
  const a = ev.target.closest("a[href]");
  if (!a) { return; }
  if (kabukIndirmeMi(a)) { ev.preventDefault(); kabukDosyaKaydet(a.href, a.getAttribute("download") || ""); return; }
  if (kabukBaglantiYonet(a.getAttribute("href"), a.target === "_blank")) { ev.preventDefault(); }
});

(function () {
  const asil = window.open;
  window.open = function (url) {
    if (kabukMu() && url && kabukBaglantiYonet(String(url), true)) { return null; }
    return asil.apply(window, arguments);
  };
})();

/* ==================== geri tuşu ==================== */
/* Önce açık pencere/menü kapanır (sitenin Escape davranışı), sonra bir önceki sayfa;
   ana sayfada iki kez basınca uygulamadan çıkılır. */
let kabukCikisIste = 0;

/* site "#/sen"i adres çubuğunda /sen/ yapar (js/core/00-rota.js): rota() ikisini de okur */
function kabukRota() { return typeof rota === "function" ? rota() : location.hash; }

function kabukKatmanIzi() {
  const p = document.querySelector("#perde");
  return kabukRota() + "|" + (p && !p.hidden ? 1 : 0) + "|" +
    document.querySelectorAll("#mobilMenu, #karsilama, #geziSayfa, .ic-katman:not([hidden]), [role=dialog]:not([hidden])").length + "|" +
    document.body.childElementCount;
}

function kabukGeri(gidebilir) {
  const once = kabukKatmanIzi();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  if (kabukKatmanIzi() !== once) { return "kapat"; }
  const h = kabukRota();
  if (h && h !== "#" && h !== "#/") {
    if (gidebilir) { history.back(); } else { location.hash = "#/"; }
    return "geri";
  }
  if (Date.now() - kabukCikisIste < 2000) {
    const app = kabukEklenti("App");
    if (app) { app.exitApp(); }
    return "cik";
  }
  kabukCikisIste = Date.now();
  if (typeof eckaBildir === "function") { eckaBildir("Çıkmak için bir daha bas"); }
  return "uyar";
}

/* ==================== günün kelimesi hatırlatması: telefon bildirimi ==================== */
/* Web bildirimi WebView'da yok; önümüzdeki 7 günün 19:00'una yerel bildirim kurulur, uygulama her
   açılışta yeniden kurar. O gün kelime oynandıysa o günün bildirimi kalkar. Sunucu yok. */
const KABUK_BLD = { ilk: 7100, gun: 7, saat: 19, oynanan: "tentiforapp_gk_oynanan_yerel" };

function kabukBugun() { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }

async function kabukHatirlatmaKur() {
  const ln = kabukEklenti("LocalNotifications");
  if (!ln) { return "Bu telefonda bildirim eklentisi yok."; }
  const eski = []; for (let i = 0; i < KABUK_BLD.gun; i++) { eski.push({ id: KABUK_BLD.ilk + i }); }
  try { await ln.cancel({ notifications: eski }); } catch (_) { /* yok */ }
  if (typeof HTR_ANAHTAR === "undefined" || jsonOku(HTR_ANAHTAR, false) !== true) { return ""; }
  let oynandi = false;
  try { oynandi = localStorage.getItem(KABUK_BLD.oynanan) === kabukBugun(); } catch (_) { /* yok */ }
  const liste = [];
  for (let i = 0; i < KABUK_BLD.gun; i++) {
    const t = new Date(); t.setDate(t.getDate() + i); t.setHours(KABUK_BLD.saat, 0, 0, 0);
    if (t.getTime() <= Date.now() + 60000 || (i === 0 && oynandi)) { continue; }
    liste.push({ id: KABUK_BLD.ilk + i, title: "Günün kelimesi hazır", body: "Bugünkü Tömye kelimesini daha çözmedin.", schedule: { at: t, allowWhileIdle: true }, extra: { bolum: "yarislar" } });
  }
  if (!liste.length) { return ""; }
  try { await ln.schedule({ notifications: liste }); return ""; } catch (e) { return "Bildirim kurulamadı: " + ((e && e.message) || e); }
}

if (typeof gunlukKontrolKaydet === "function") {
  const eskiGkk = gunlukKontrolKaydet;
  window.gunlukKontrolKaydet = async function (izinIste) {
    const ln = kabukEklenti("LocalNotifications");
    if (!kabukMu() || !ln) { return eskiGkk.apply(this, arguments); }
    try {
      let d = await ln.checkPermissions();
      if (d.display !== "granted") {
        if (!izinIste) { return "Bildirim izni yok."; }
        d = await ln.requestPermissions();
        if (d.display !== "granted") { return "Bildirim izni verilmedi (Ayarlar → Uygulamalar → TentiforApp → Bildirimler)."; }
      }
    } catch (_) { /* sorulamadı; kurmayı dene */ }
    /* ayar bu çağrıdan sonra yazılır (js/55): önce işaretleyip kur */
    jsonYaz(HTR_ANAHTAR, true);
    return kabukHatirlatmaKur();
  };
}
if (typeof gunlukKontrolKaldirGerekirse === "function") {
  const eskiKal = gunlukKontrolKaldirGerekirse;
  window.gunlukKontrolKaldirGerekirse = function () { if (kabukMu()) { kabukHatirlatmaKur(); } return eskiKal.apply(this, arguments); };
}
if (typeof swAyarEsitle === "function") {
  const eskiSw = swAyarEsitle;
  window.swAyarEsitle = function (ek) {
    if (kabukMu() && ek && ek.oynanan) {
      try { localStorage.setItem(KABUK_BLD.oynanan, kabukBugun()); } catch (_) { /* yok */ }
      kabukHatirlatmaKur();
    }
    return eskiSw.apply(this, arguments);
  };
}

/* ==================== aşağı çekip yenileme ==================== */
const KABUK_CEK = { y: null, mesafe: 0, esik: 90 };

function kabukCekilebilir(hedef) {
  if (window.scrollY > 0 || !hedef || !hedef.closest) { return false; }
  const p = document.querySelector("#perde");
  if (p && !p.hidden) { return false; }
  return !hedef.closest("input, textarea, select, [contenteditable], svg, canvas, .pencere, .ic-katman, #mobilMenu, [data-cekme-yok]");
}

document.addEventListener("touchstart", function (ev) {
  KABUK_CEK.y = kabukMu() && ev.touches.length === 1 && kabukCekilebilir(ev.target) ? ev.touches[0].clientY : null;
  KABUK_CEK.mesafe = 0;
}, { passive: true });

document.addEventListener("touchmove", function (ev) {
  if (KABUK_CEK.y === null) { return; }
  if (window.scrollY > 0) { KABUK_CEK.y = null; kabukCekGoster(0); return; }
  KABUK_CEK.mesafe = Math.max(0, ev.touches[0].clientY - KABUK_CEK.y);
  kabukCekGoster(KABUK_CEK.mesafe);
}, { passive: true });

document.addEventListener("touchend", function () {
  if (KABUK_CEK.y === null) { return; }
  const yenile = KABUK_CEK.mesafe >= KABUK_CEK.esik;
  KABUK_CEK.y = null;
  kabukCekGoster(yenile ? KABUK_CEK.esik : 0, yenile);
  if (yenile) { setTimeout(function () { location.reload(); }, 150); }
}, { passive: true });

function kabukCekGoster(m, yenileniyor) {
  let g = document.querySelector("#kabukCek");
  if (!m) { if (g) { g.remove(); } return; }
  if (!g) { g = document.createElement("div"); g.id = "kabukCek"; g.className = "kabuk-cek"; g.setAttribute("aria-hidden", "true"); g.textContent = "↻"; document.body.appendChild(g); }
  const o = Math.min(1, m / KABUK_CEK.esik);
  g.style.transform = "translate(-50%, " + Math.round(o * 56) + "px) rotate(" + Math.round(o * 270) + "deg)";
  g.style.opacity = String(o);
  g.classList.toggle("hazir", o >= 1);
  g.classList.toggle("donuyor", !!yenileniyor);
}

/* ==================== açılışta ==================== */
document.addEventListener("DOMContentLoaded", function () {
  if (!kabukMu()) { return; }
  const app = kabukEklenti("App");
  if (app && app.addListener) {
    app.addListener("backButton", function (d) { kabukGeri(!!(d && d.canGoBack)); });
    /* e-postadaki bağlantı uygulamayı açtı (uygulama/ac/): siteye ?code=... ile dön, giriş burada tamamlanır */
    app.addListener("appUrlOpen", function (d) {
      try { const u = new URL(d.url); if (u.host === location.host) { location.replace("/" + u.search + u.hash); } } catch (_) { /* yok */ }
    });
  }
  const ln = kabukEklenti("LocalNotifications");
  if (ln && ln.addListener) {
    ln.addListener("localNotificationActionPerformed", function (d) {
      const b = d && d.notification && d.notification.extra && d.notification.extra.bolum;
      if (b && typeof bolumeGit === "function") { setTimeout(function () { bolumeGit(b); }, 600); }
    });
  }
  kabukHatirlatmaKur();
});
