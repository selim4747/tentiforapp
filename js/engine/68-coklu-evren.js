/* Sürüm 2.0 — çoklu evren sitesi.

   - Seviye kodları: seviyeyi beklemeden Evrengezer (Sv10) ya da evren (Sv15) kurma. Kodun kendisi hiçbir yerde
     durmaz; veri.seviyeKodlari'nda yalnızca özeti var. Girilince cuzdan.acilan'a "svkod_<seviye>" yazılır
     (hesapla eşitlenir). Bir kod kendi seviyesine kadarki bütün kapıları açar.
   - Altın rozet katmanı açar: bir karakterde altın rozet kazanıldıysa o karakterin kaydındaki buz katmanları
     açılır (yalnızca kendi kaydı; kartı olmayan gizli karakterler hariç).
   - Evrenler arası hızlı geçiş: başlıkta o anki evrenin adı; seçicide arama, son girdiklerin, klavye
     (E ya da Ctrl+K, oklar, Enter); ana sayfada evren şeridi; fan evreninin dosyası üstüne gelince önceden iner. */

/* ==================== seviye kodları ==================== */

/** Girilmiş seviye kodlarının en yükseği (yoksa 0). */
function seviyeKoduSeviyesi() {
  if (typeof cuzdan === "undefined" || !Array.isArray(cuzdan.acilan)) { return 0; }
  let s = 0;
  cuzdan.acilan.forEach(function (x) { const m = /^svkod_(\d+)$/.exec(x); if (m) { s = Math.max(s, Number(m[1])); } });
  return s;
}

function seviyeKoduDene(kod, durum) {
  const l = (veri && veri.seviyeKodlari) || [];
  if (!l.length || typeof dogrulamaOzeti !== "function") { return false; }
  const oz = dogrulamaOzeti(kod);
  const k = l.find(function (x) { return x.ozet === oz; });
  if (!k) { return false; }
  const a = "svkod_" + k.seviye;
  if (cuzdan.acilan.indexOf(a) === -1) { cuzdan.acilan.push(a); cuzdanKaydet(); }
  if (typeof SVK !== "undefined") { SVK.onbellek = null; }
  if (durum) {
    durum.textContent = k.ad + " açıldı: seviyeyi beklemeden kurabilirsin." + (k.seviye >= 15 ? " (Evrengezer ve fan hikâyesi de açık.)" : " (Fan hikâyesi de açık.)");
    durum.className = "pencere-durum iyi";
  }
  if (typeof olaySay === "function") { olaySay("seviye_kodu:" + k.seviye); }
  setTimeout(function () {
    if (typeof perdeKapat === "function") { perdeKapat(); }
    if (typeof seviyeKapilariUygula === "function") { seviyeKapilariUygula(); }
    if (typeof fanBolumleriCiz === "function") { fanBolumleriCiz(); }
  }, 1200);
  return true;
}

if (typeof sonraSar === "function") {
  sonraSar("kodDene", function (eski) {
    return function (ham) {
      const kod = String(ham || "").trim().toUpperCase();
      if (kod && seviyeKoduDene(kod, document.querySelector("#kodDurum"))) { return; }
      return eski.apply(this, arguments);
    };
  });
}

/* ==================== altın rozet katman açar ==================== */

let rozetKatmanOnbellek = null;

/** Altın rozetli karakterlerin kendi kayıtlarındaki katmanlar: dogrulama → karakter adı */
function rozetAcikKatmanlar() {
  if (rozetKatmanOnbellek && Date.now() - rozetKatmanOnbellek.zaman < 1500) { return rozetKatmanOnbellek.m; }
  const m = {};
  if (typeof rozetDurumu === "function") {
    (veri.karakterler || []).forEach(function (k) {
      if (!k.id || k.kart === false || !(k.gizli || []).length || rozetDurumu(k) !== "altin") { return; }
      k.gizli.forEach(function (g) { if (g && g.dogrulama && g.metin !== undefined) { m[g.dogrulama] = k.ad; } });
    });
  }
  rozetKatmanOnbellek = { zaman: Date.now(), m: m };
  return m;
}

if (typeof sonraSar === "function") {
  sonraSar("buzul", function (eski) {
    return function (g) {
      if (!g || !g.dogrulama || cozulenler[g.dogrulama]) { return eski.apply(this, arguments); }
      const ad = rozetAcikKatmanlar()[g.dogrulama];
      if (!ad) { return eski.apply(this, arguments); }
      cozulenler[g.dogrulama] = "rozet";
      try {
        return eski.apply(this, arguments).replace('<div class="buzul-etiket">çözüldü',
          '<div class="buzul-etiket">altın rozetle açıldı · ' + kacir(ad));
      } finally { delete cozulenler[g.dogrulama]; }
    };
  });
}

/* ==================== evrenler arası hızlı geçiş ==================== */

const SON_EVRENLER = "tentiforapp_son_evrenler";

function sonEvrenler() {
  const l = typeof jsonOku === "function" ? jsonOku(SON_EVRENLER, []) : [];
  return Array.isArray(l) ? l.filter(function (x) { return x && x.git && x.ad; }) : [];
}

function sonEvrenEkle(ad, git) {
  if (!ad || !git || typeof jsonYaz !== "function") { return; }
  const l = sonEvrenler().filter(function (x) { return x.git !== git; });
  l.unshift({ ad: String(ad).slice(0, 60), git: git });
  jsonYaz(SON_EVRENLER, l.slice(0, 5));
}

/** Şu an hangi evrendeyiz? { ad, git } — evren sayfası açıksa o, Claude'un Evreni'ndeyse o, yoksa başlangıç evreni. */
function simdikiEvren() {
  if (typeof veri === "undefined" || !veri) { return { ad: "Tentiforverse", git: "#/arsiv" }; }
  if (typeof EVS !== "undefined" && EVS && typeof evrenSayfaVerisi === "function") {
    const v = evrenSayfaVerisi();
    if (v && v.eser) { return { ad: v.eser.ad || "Adsız evren", git: "#/ev/" + EVS.kaynak + "/" + EVS.id }; }
  }
  const r = typeof rota === "function" ? rota() : location.hash;
  if (/^#\/claude/.test(r)) { return { ad: "Claude'un Evreni", git: "#/claude" }; }
  return { ad: baslangicEvrenAdi(), git: "#/arsiv" };
}

function baslangicEvrenAdi() {
  const h = (veri && veri.haritalar || [])[0];
  return (h && (h.evrenAdi || h.ad)) || "Tentiforverse";
}

function evrenDugmesiGuncelle() {
  const b = document.querySelector("#evrenSecBtn");
  if (!b) { return; }
  const e = simdikiEvren();
  const yeni = '<span aria-hidden="true">◎</span> <span class="es-simdiki">' + kacir(e.ad) + '</span> <span aria-hidden="true">▾</span>';
  if (b.innerHTML !== yeni) { b.innerHTML = yeni; }
  b.title = "Evren değiştir (E)";
  b.setAttribute("aria-label", "Şu anki evren: " + e.ad + ". Evren değiştir");
}

/** Evren seçicisine: arama, son girdiklerin, klavye. */
function evrenSeciciZenginlestir() {
  const panel = document.querySelector("#evrenSecici .es-panel");
  if (!panel || panel.querySelector("#esAra")) { return; }
  const son = sonEvrenler().filter(function (x) { return x.git !== simdikiEvren().git; }).slice(0, 4);
  const ust = panel.querySelector(".es-ust");
  const html = '<div class="es-ara"><input class="kod-giris arac-giris" id="esAra" type="search" autocomplete="off" placeholder="Evren ara…" aria-label="Evren ara"></div>' +
    (son.length ? '<div class="es-grup es-son"><div class="oyun-etiket">Son girdiklerin</div>' + son.map(function (x) {
      return '<button class="es-oge" data-evren-git="' + kacir(x.git) + '"><span class="es-ad">' + kacir(x.ad) + "</span></button>";
    }).join("") + "</div>" : "");
  if (ust) { ust.insertAdjacentHTML("afterend", html); }
  const ara = panel.querySelector("#esAra");
  if (ara && !(window.matchMedia && window.matchMedia("(pointer: coarse)").matches)) { ara.focus({ preventScroll: true }); }
}

function evrenSeciciSuz(q) {
  const s = String(q || "").toLocaleLowerCase("tr").trim();
  document.querySelectorAll("#evrenSecici .es-oge").forEach(function (b) {
    b.hidden = !!s && b.textContent.toLocaleLowerCase("tr").indexOf(s) === -1;
  });
  document.querySelectorAll("#evrenSecici .es-grup").forEach(function (g) {
    const var_ = g.querySelector(".es-oge:not([hidden])");
    g.hidden = !!s && !var_;
  });
}

if (typeof evrenSeciciAc === "function") {
  const eskiAc = evrenSeciciAc;
  window.evrenSeciciAc = function () {
    const r = eskiAc.apply(this, arguments);
    evrenSeciciZenginlestir();
    return r;
  };
}
if (typeof evrenGit === "function") {
  const eskiGit = evrenGit;
  window.evrenGit = function (git) {
    const b = document.querySelector('#evrenSecici [data-evren-git="' + (window.CSS && CSS.escape ? CSS.escape(git) : git) + '"] .es-ad, .evren-serit [data-evren-git="' + (window.CSS && CSS.escape ? CSS.escape(git) : git) + '"] .es-ad');
    if (b && git.indexOf("harita:") !== 0) { sonEvrenEkle(b.textContent.trim(), git); }
    return eskiGit.apply(this, arguments);
  };
}

/* ana sayfa: evren şeridi */
function evrenSeritHtml() {
  if (typeof evrenSeciciListesi !== "function") { return ""; }
  const l = evrenSeciciListesi();
  const simdi = simdikiEvren().git;
  const oge = function (x, not) {
    return '<button class="es-serit-oge' + (x.kilitli ? " kilitli" : "") + (x.git === simdi ? " bu" : "") + '" data-evren-git="' + kacir(x.git) + '">' +
      '<span class="es-ad">' + kacir(x.ad) + "</span>" + (not ? '<span class="es-not">' + kacir(not) + "</span>" : "") + "</button>";
  };
  const site = l.site.map(function (x, i) { return oge(x, i === 0 ? "başlangıç evreni" : (x.not || (x.kilitli ? "kodla açılır" : ""))); }).join("");
  const benim = l.benim.slice(0, 3).map(function (x) { return oge(x, "senin"); }).join("");
  const fan = l.fan.slice(0, 4).map(function (x) { return oge(x, "fanmade"); }).join("");
  return '<div class="evren-serit-ic"><span class="oyun-etiket">Evrenler</span><div class="evren-serit-liste">' + site + benim + fan +
    '<button class="es-serit-oge es-serit-tum" data-evren-sec>Hepsi · ara ◎</button></div></div>';
}

function evrenSeritCiz() {
  const hero = document.querySelector("main .hero");
  if (!hero) { return; }
  let s = document.querySelector("#evrenSerit");
  if (!s) {
    s = document.createElement("section");
    s.id = "evrenSerit";
    s.className = "evren-serit";
    s.setAttribute("aria-label", "Evrenler");
    hero.insertAdjacentElement("afterend", s);
  }
  s.innerHTML = evrenSeritHtml();
}

/* fan evreninin dosyası: üstüne gelince / dokunmaya başlayınca önceden iner (açılış anında beklenmesin) */
function evrenOnYukle(git) {
  const m = /^#\/ev\/fan\/([\w-]+)$/.exec(git || "");
  if (!m || typeof evdYukle !== "function") { return; }
  const oz = ((veri.fanEserleri || {}).evrenler || []).find(function (x) { return x.id === m[1]; });
  if (oz && typeof evdHazir === "function" && !evdHazir(oz)) { evdYukle(oz).catch(function () { /* açılışta yeniden denenir */ }); }
}

["pointerenter", "focusin", "touchstart"].forEach(function (o) {
  document.addEventListener(o, function (e) {
    const b = e.target && e.target.closest && e.target.closest("[data-evren-git]");
    if (b) { evrenOnYukle(b.getAttribute("data-evren-git")); }
  }, { passive: true, capture: o === "pointerenter" });
});

document.addEventListener("input", function (e) {
  if (e.target && e.target.id === "esAra") { evrenSeciciSuz(e.target.value); }
});

document.addEventListener("keydown", function (e) {
  const k = document.querySelector("#evrenSecici");
  if (k) {
    const gorunen = Array.prototype.slice.call(k.querySelectorAll(".es-oge:not([hidden])"));
    const i = gorunen.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const j = e.key === "ArrowDown" ? Math.min(gorunen.length - 1, i + 1) : Math.max(0, i - 1);
      if (gorunen[j]) { gorunen[j].focus(); }
    } else if (e.key === "Enter" && e.target.id === "esAra" && gorunen[0]) {
      e.preventDefault(); gorunen[0].click();
    } else if (e.key === "Escape" && typeof evrenSeciciKapat === "function") {
      evrenSeciciKapat();
    }
    return;
  }
  const yaziyor = e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
  if (yaziyor || e.altKey) { return; }
  if (((e.key === "e" || e.key === "E") && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K"))) {
    if (document.querySelector("#perde:not([hidden]) .pencere")) { return; }
    e.preventDefault();
    if (typeof evrenSeciciAc === "function") { evrenSeciciAc(); }
  }
});

window.addEventListener("hashchange", function () { setTimeout(evrenDugmesiGuncelle, 0); });
/** veri.json geldikten sonra (24-arsiv-mantigi.js onu ağdan çeker) */
function veriHazirOlunca(fn) {
  let n = 0;
  const bak = function () {
    if (typeof veri !== "undefined" && veri && typeof cuzdan !== "undefined" && Array.isArray(cuzdan.acilan)) { fn(); return; }
    if (++n < 300) { setTimeout(bak, 100); }
  };
  bak();
}

document.addEventListener("DOMContentLoaded", function () {
  veriHazirOlunca(function () { setTimeout(function () { evrenDugmesiGuncelle(); evrenSeritCiz(); }, 0); });
});
