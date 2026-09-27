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
