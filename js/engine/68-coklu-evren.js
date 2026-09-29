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
  /* tek kullanımlık kodlar: evren kodu 15, Evrengezer kodu 10 sayılır */
  return Math.max(s, tekHakVar("evren") ? 15 : (tekHakVar("evrengezer") ? 10 : 0));
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

/* ==================== 4.4: ÇOKLU EVREN ÇATALLAMA (MULTIVERSE FORKING) ==================== */

/** Bir evrenin kayıtlı tüm paralel boyutlarını / dallarını bulur */
function evrenParalelDallari(evrenId) {
  if (!evrenId) { return []; }
  const liste = [];
  const kaynaklar = [
    typeof fanEserlerim === "function" ? fanEserlerim() : [],
    (typeof veri !== "undefined" && veri.fanEserleri && veri.fanEserleri.evrenler) || []
  ];
  kaynaklar.forEach(function (kaynak) {
    (Array.isArray(kaynak) ? kaynak : []).forEach(function (e) {
      if (e && e.ana_evren_id === evrenId && !liste.some(function (x) { return x.id === e.id; })) {
        liste.push(e);
      }
    });
  });
  return liste;
}

/** Evrenden yeni bir alternatif zaman çizgisi (fork) türetir */
function evrenCatalla(orijinalEvren, dalAdi, yazarNotu) {
  if (!orijinalEvren || !orijinalEvren.id) { throw new Error("Çatallanacak evren bulunamadı."); }
  const yeniId = "fork-" + String(orijinalEvren.id).replace(/^fork-/, "").slice(0, 16) + "-" + Math.random().toString(36).slice(2, 7);
  const kopya = JSON.parse(JSON.stringify(orijinalEvren));
  kopya.id = yeniId;
  kopya.tur = "evren";
  kopya.ana_evren_id = orijinalEvren.id;
  kopya.kok_zaman_cizgisi = orijinalEvren.kok_zaman_cizgisi || orijinalEvren.ad || "Kanon";
  kopya.paralel_dal = String(dalAdi || "Alternatif Çizgi").trim();
  kopya.ad = (orijinalEvren.ad || "Evren") + " [" + kopya.paralel_dal + "]";
  kopya.ozet = (orijinalEvren.ozet || "") + (yazarNotu ? "\n\n[Alternatif Zaman Notu]: " + yazarNotu : "");
  kopya.yazar_notu = String(yazarNotu || "").trim();
  kopya.catallanma_tarihi = new Date().toISOString();

  /* fan eserlerime kaydet */
  if (typeof fanEseriKaydet === "function") {
    fanEseriKaydet(kopya);
  } else {
    try {
      const a = JSON.parse(localStorage.getItem("tentiforapp_fan_eserlerim") || "[]");
      a.push(kopya);
      localStorage.setItem("tentiforapp_fan_eserlerim", JSON.stringify(a));
    } catch (_) {}
  }
  return kopya;
}

/** Evren kartı / sayfası için "Paralel Boyutlar" sekmesi HTML'i */
function evrenParalelBoyutlarHtml(e) {
  if (!e) { return ""; }
  const dallar = evrenParalelDallari(e.id);
  const kokAd = e.kok_zaman_cizgisi || e.ad || "Ana Kanon";
  const anaId = e.ana_evren_id || null;
  const yetkili = typeof evrenCatallayabilirMi === "function" ? evrenCatallayabilirMi(e) : true;

  let h = '<div class="evs-paralel-boyutlar">' +
    '<div class="kutu-y" style="border-left: 3px solid #3A7CA5; margin-bottom: 1rem;">' +
      '<h4>🌌 Paralel Boyutlar & Çatallanma (Multiverse)</h4>' +
      '<p class="oyun-not">Bu evrenin farklı olasılıklara göre ayrılan bağımsız alternatif zaman çizgileri.</p>' +
      (anaId ? '<p class="oyun-not"><b>Kök Zaman Çizgisi:</b> <a href="#/ev/site/' + kacir(anaId) + '">#' + kacir(kokAd) + '</a></p>' : '<p class="oyun-not"><b>Durum:</b> Bu evren kök zaman çizgisidir (Kanon).</p>') +
      (yetkili ? '<button type="button" class="dugme" data-evren-catalla="' + kacir(e.id) + '" style="margin-top: .5rem;">⚡ Bu Evrenden Alternatif Çizgi Yarat (Fork)</button>' : '<p class="oyun-not" style="opacity:.7;">Alternatif çizgi yaratmak için giriş yap veya Sv10 rozetine ulaş.</p>') +
    '</div>';

  if (dallar.length) {
    h += '<h4>Dallanan Zaman Çizgileri (' + dallar.length + ')</h4><ul class="evs-dal-liste" style="list-style:none; padding-left: 1rem; border-left: 2px dashed #3A7CA5;">';
    dallar.forEach(function (d) {
      h += '<li style="margin-bottom: .8rem; position: relative;">' +
        '<span style="display:inline-block; width:12px; height:2px; background:#3A7CA5; vertical-align:middle; margin-right:6px;"></span>' +
        '<b>' + kacir(d.paralel_dal || d.ad) + '</b>' +
        (d.yazar_notu ? ' <span class="oyun-not">— ' + kacir(d.yazar_notu) + '</span>' : '') +
        ' <a class="ic-bag" href="#/ev/benim/' + kacir(d.id) + '">Boyuta Git →</a>' +
      '</li>';
    });
    h += '</ul>';
  } else {
    h += '<p class="oyun-not" style="font-style: italic;">Henüz bu evrenden çatallanmış bir alternatif boyut yok.</p>';
  }
  h += '</div>';
  return h;
}

/* Çatallama buton dinleyicisi */
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evren-catalla]");
  if (!b) { return; }
  const id = b.getAttribute("data-evren-catalla");
  const evren = (typeof EVS !== "undefined" && EVS && EVS.veri) ? EVS.veri : (typeof evrenBul === "function" ? evrenBul(id) : { id: id, ad: id });
  const dalAdi = prompt("Yeni alternatif zaman çizgisinin dal adı ne olsun? (Örn: Saek İsyanı Başarılı, Karanlık Çağ):", "Alternatif Çizgi");
  if (!dalAdi) { return; }
  const not = prompt("Bu zaman çizgisine bir kurucu notu eklemek ister misin? (İsteğe bağlı):", "");
  try {
    const yeni = evrenCatalla(evren, dalAdi, not);
    alert("Paralel boyut oluşturuldu! Yeni evren: " + yeni.ad);
    location.hash = "#/ev/benim/" + yeni.id;
  } catch (err) {
    alert("Çatallama başarısız: " + (err.message || err));
  }
});
