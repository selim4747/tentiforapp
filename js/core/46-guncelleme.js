/* Güncelleme: açık kalan sayfa da yeni sürümü kendiliğinden alır.

   Telefonda sekme ya da ana ekrana eklenen uygulama arka planda açık kalır; geri dönünce sayfa
   yeniden yüklenmediği için eski sürüm görünmeye devam ediyordu. Yayın paketi (scripts/paketle.mjs)
   index.html'e bir paket kimliği yazar ve surum.json'a da aynısını koyar. Sayfa açıldığında,
   görünür hâle geldiğinde ve açık kaldıkça arada bir surum.json'a (küçük, önbelleksiz) bakar:
     - kimlik farklıysa ve sayfa bir süre arka plandaysa, yazı yazılmıyorsa ve panelde
       kaydedilmemiş iş yoksa kendini yeniler;
     - yoksa üstte "Yeni sürüm hazır · Yenile" çubuğu çıkar.
   Yerelde (paketlenmemiş) kimlik etiketi olmadığı için hiçbir şey yapmaz. */

const GUNCELLEME_ARALIK = 15 * 60 * 1000;     /* açık kaldıkça bu sıklıkla bakar */
const GUNCELLEME_ARKA_PLAN = 2 * 60 * 1000;   /* bu kadar arka planda kaldıysa dönünce kendiliğinden yenile */

let guncellemeYeni = null;       /* { paket, surum } — yayında daha yeni paket varsa */
let guncellemeSonBakis = 0;
let guncellemeGizlendi = 0;

function sayfaPaketi() {
  const m = document.querySelector('meta[name="tentifor-paket"]');
  return m ? m.getAttribute("content") : "";
}

async function yayindakiPaket() {
  const y = await fetch("surum.json?t=" + Date.now(), { cache: "no-store" });
  if (!y.ok) { return null; }
  const d = await y.json();
  return d && typeof d.paket === "string" ? d : null;
}

/** Yenilemek bir şey kaybettirir mi? (yazı alanında imleç, panelde kaydedilmemiş değişiklik) */
function guncellemeBekletir() {
  const a = document.activeElement;
  if (a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && !/^(button|submit|checkbox|radio|range|color)$/.test(a.type)) || a.isContentEditable)) { return true; }
  if (typeof panelAcik === "function" && panelAcik()) { return true; }
  return false;
}

function guncellemeUygula() {
  try { sessionStorage.setItem("tentiforapp_guncellendi", guncellemeYeni ? guncellemeYeni.surum || "1" : "1"); } catch (_) { /* yok */ }
  location.reload();
}

function guncellemeCubugu() {
  if (!guncellemeYeni || document.querySelector("#guncellemeCubugu")) { return; }
  const c = document.createElement("div");
  c.id = "guncellemeCubugu";
  c.className = "guncelleme-cubugu";
  c.setAttribute("role", "status");
  c.innerHTML = "<span>Yeni sürüm hazır" + (guncellemeYeni.surum ? " (" + kacir(guncellemeYeni.surum) + ")" : "") + "</span>" +
    '<button class="dugme" data-guncelle>Yenile</button>' +
    '<button class="pencere-kapat" data-guncelle-kapat aria-label="Sonra">✕</button>';
  document.body.appendChild(c);
}

async function guncellemeBak(donus) {
  const benim = sayfaPaketi();
  if (!benim || !navigator.onLine) { return; }
  if (Date.now() - guncellemeSonBakis < 30000 && !donus) { return; }
  guncellemeSonBakis = Date.now();
  let yayin = null;
  try { yayin = await yayindakiPaket(); } catch (_) { return; }
  if (!yayin || yayin.paket === benim) { return; }
  guncellemeYeni = yayin;
  /* arka planda uzun kaldıysa ve kaybolacak bir şey yoksa sessizce yenile */
  if (donus && !guncellemeBekletir()) { guncellemeUygula(); return; }
  guncellemeCubugu();
}

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") { guncellemeGizlendi = Date.now(); return; }
  const uzun = guncellemeGizlendi && Date.now() - guncellemeGizlendi > GUNCELLEME_ARKA_PLAN;
  guncellemeGizlendi = 0;
  guncellemeBak(uzun);
});

window.addEventListener("pageshow", function (e) {
  /* geri/ileri önbelleğinden dönen sayfa da eski olabilir */
  if (e.persisted) { guncellemeBak(true); }
});

document.addEventListener("click", function (ev) {
  const h = ev.target.closest && ev.target.closest("[data-guncelle], [data-guncelle-kapat]");
  if (!h) { return; }
  if (h.hasAttribute("data-guncelle")) { guncellemeUygula(); return; }
  const c = document.querySelector("#guncellemeCubugu");
  if (c) { c.remove(); }
});

/* 3.0 — sayfa cihazdaki kopyadan anında açılır (sw.js); yayında yeni paket varsa kullanıcı daha bir şeye
   dokunmadan bir kez sessizce yenilenir. Aynı paket için ikinci kez yenilemez (döngü olmasın), çubuk çıkar. */
let guncellemeDokunuldu = false;
["pointerdown", "keydown", "scroll"].forEach(function (t) { window.addEventListener(t, function () { guncellemeDokunuldu = true; }, { once: true, passive: true }); });

async function guncellemeAcilisBak() {
  const benim = sayfaPaketi();
  if (!benim || !navigator.onLine || !navigator.serviceWorker || !navigator.serviceWorker.controller) { return guncellemeBak(false); }
  guncellemeSonBakis = Date.now();
  let yayin = null;
  try { yayin = await yayindakiPaket(); } catch (_) { return; }
  if (!yayin || yayin.paket === benim) { return; }
  guncellemeYeni = yayin;
  let once = "";
  try { once = sessionStorage.getItem("tentiforapp_acilis_yenilendi") || ""; } catch (_) { /* yok */ }
  if (once !== yayin.paket && !guncellemeDokunuldu && !guncellemeBekletir()) {
    try { sessionStorage.setItem("tentiforapp_acilis_yenilendi", yayin.paket); } catch (_) { /* yok */ }
    /* servis çalışanı yeni sayfayı arka planda indirsin diye kısa bekleme */
    setTimeout(guncellemeUygula, 600);
    return;
  }
  guncellemeCubugu();
}

window.addEventListener("load", function () {
  setTimeout(guncellemeAcilisBak, 1200);
  setInterval(function () { if (document.visibilityState === "visible") { guncellemeBak(false); } }, GUNCELLEME_ARALIK);
  try {
    const s = sessionStorage.getItem("tentiforapp_guncellendi");
    if (s) {
      sessionStorage.removeItem("tentiforapp_guncellendi");
      setTimeout(function () { if (typeof eckaBildir === "function") { eckaBildir("Site güncellendi" + (s !== "1" ? " · " + s : "")); } }, 1500);
    }
  } catch (_) { /* yok */ }
});

/* ---------- panel: eski sürümdeyken Kaydet yeni veriyi ezmesin ---------- */

/** "1.7.0" > "1.6.1" gibi karşılaştırır. */
function surumBuyukMu(a, b) {
  const x = String(a || "0").split(".").map(Number), y = String(b || "0").split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] || 0, q = y[i] || 0;
    if (p !== q) { return p > q; }
  }
  return false;
}
