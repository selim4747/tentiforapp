const GUNCELLEME_ARALIK = 9e5, GUNCELLEME_ARKA_PLAN = 12e4;
let guncellemeYeni = null, guncellemeSonBakis = 0, guncellemeGizlendi = 0;

function sayfaPaketi() {
  const e = document.querySelector('meta[name="tentifor-paket"]');
  return e ? e.getAttribute("content") : "";
}

function yerelSurum() {
  return (typeof veri !== "undefined" && veri && veri.surum) ||
         (document.querySelector('meta[name="tentifor-surum"]') || {}).content || "5.3.1";
}

async function guncellemeFetch(url) {
  const denetleyici = typeof AbortController === "function" ? new AbortController() : null;
  const zaman = setTimeout(function () { denetleyici && denetleyici.abort(); }, 2500);
  try {
    return await fetch(url, { cache: "no-store", signal: denetleyici && denetleyici.signal });
  } finally { clearTimeout(zaman); }
}

async function yayindakiPaket() {
  try {
    const e = await guncellemeFetch("surum.json?t=" + Date.now());
    if (!e.ok) return null;
    const t = await e.json();
    return t && typeof t.paket === "string" ? t : null;
  } catch {
    return null;
  }
}


function guncellemeBekletir() {
  const e = document.activeElement;
  return !!(e && (e.tagName === "TEXTAREA" || e.tagName === "INPUT" && !/^(button|submit|checkbox|radio|range|color)$/.test(e.type) || e.isContentEditable) || typeof panelAcik === "function" && panelAcik());
}

function guncellemeGorulen(paket) {
  try {
    return localStorage.getItem("tentifor_gorulen_paket") === paket;
  } catch {
    return false;
  }
}

function guncellemeGorulduIsaretle(paket) {
  try {
    localStorage.setItem("tentifor_gorulen_paket", paket);
  } catch {}
}

function guncellemeUygula() {
  if (guncellemeYeni && guncellemeYeni.paket) {
    guncellemeGorulduIsaretle(guncellemeYeni.paket);
    try {
      sessionStorage.setItem("tentiforapp_guncellendi", guncellemeYeni.surum || yerelSurum());
    } catch {}
  }
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({ action: "skipWaiting" });
    } catch {}
  }
  location.reload();
}

function guncellemeBildirimiGonder(baslik, metin) {
  try {
    const izin = localStorage.getItem("tentiforapp_ayar_guncelleme_bildirim");
    if (izin === "0") return;
  } catch {}
  if (typeof kabukEklenti === "function" && typeof kabukMu === "function" && kabukMu()) {
    const localNotif = kabukEklenti("LocalNotifications");
    if (localNotif) {
      try {
        localNotif.schedule({ notifications: [{ id: 991122, title: baslik, body: metin, extra: { adres: "#/sen" } }] });
        return;
      } catch {}
    }
  }
  if ("Notification" in window && Notification.permission === "granted") {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then(function (kayit) { return kayit.showNotification(baslik, { body: metin, icon: "ikon/ikon-192.png", tag: "tentiforapp-guncelleme" }); })
        .catch(function () {});
    }
  }
}

function guncellemeCubugu() {
  if (!guncellemeYeni || document.querySelector("#guncellemeCubugu")) return;
  if (guncellemeGorulen(guncellemeYeni.paket)) return;
  const suankiSurum = yerelSurum();
  const uzakSurum = guncellemeYeni.surum || suankiSurum;
  const surumFarki = uzakSurum && suankiSurum && uzakSurum !== suankiSurum;
  const mesaj = surumFarki ? "Yeni sürüm yayında (v" + uzakSurum + ")" : "Yeni içerik eklendi";
  const aciklama = surumFarki ? "Yeni özellikler için yenile." : "Yönetici yeni evren veya içerik ekledi; görmek için yenile.";
  const e = document.createElement("div");
  e.id = "guncellemeCubugu";
  e.className = "guncelleme-cubugu";
  e.setAttribute("role", "status");
  e.innerHTML = "<span><b>" + kacir(mesaj) + "</b> · " + kacir(aciklama) + "</span>" +
                '<button class="dugme" data-guncelle>Yenile</button>' +
                '<button class="pencere-kapat" data-guncelle-kapat aria-label="Sonra">✕</button>';
  document.body.appendChild(e);
  guncellemeBildirimiGonder(mesaj, aciklama);
  if (navigator.onLine && !guncellemeDokunuldu && !guncellemeBekletir()) setTimeout(function () { guncellemeYeni && guncellemeUygula(); }, 1800);
}

async function guncellemeBak(e) {
  const t = sayfaPaketi();
  if (!navigator.onLine || (Date.now() - guncellemeSonBakis < 3e4 && !e)) return;
  guncellemeSonBakis = Date.now();
  let n = null;
  try { n = await yayindakiPaket(); } catch { return; }
  if (!n) return;
  if (t && n.paket === t && n.surum === yerelSurum()) return;
  if (guncellemeGorulen(n.paket)) return;
  guncellemeYeni = n;
  guncellemeCubugu();
}

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") { guncellemeGizlendi = Date.now(); return; }
  const e = guncellemeGizlendi && Date.now() - guncellemeGizlendi > 12e4;
  guncellemeGizlendi = 0;
  guncellemeBak(e);
});
window.addEventListener("pageshow", function (e) { e.persisted && guncellemeBak(!0); });
window.addEventListener("online", function () { setTimeout(function () { guncellemeBak(!0); }, 900); });
document.addEventListener("click", function (e) {
  const t = e.target.closest && e.target.closest("[data-guncelle], [data-guncelle-kapat]");
  if (!t) return;
  if (t.hasAttribute("data-guncelle")) { guncellemeUygula(); return; }
  if (guncellemeYeni && guncellemeYeni.paket) guncellemeGorulduIsaretle(guncellemeYeni.paket);
  const n = document.querySelector("#guncellemeCubugu"); n && n.remove();
});

let guncellemeDokunuldu = !1;
["pointerdown", "keydown", "scroll"].forEach(function (e) {
  window.addEventListener(e, function () { guncellemeDokunuldu = !0; }, { once: !0, passive: !0 });
});

async function guncellemeAcilisBak() {
  const e = sayfaPaketi();
  if (!e || !navigator.onLine) return guncellemeBak(!1);
  guncellemeSonBakis = Date.now();
  let t = null;
  try { t = await yayindakiPaket(); } catch { return; }
  if (!t || t.paket === e || guncellemeGorulen(t.paket)) return;
  guncellemeYeni = t;
  guncellemeCubugu();
}

window.addEventListener("load", function () {
  setTimeout(guncellemeAcilisBak, 1500);
  setInterval(function () { document.visibilityState === "visible" && guncellemeBak(!1); }, 9e5);
  try {
    const e = sessionStorage.getItem("tentiforapp_guncellendi");
    if (e) {
      sessionStorage.removeItem("tentiforapp_guncellendi");
      setTimeout(function () { typeof eckaBildir === "function" && eckaBildir("Site güncellendi" + (e !== "1" ? " · " + e : "")); }, 1500);
    }
  } catch {}
});
