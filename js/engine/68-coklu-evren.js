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
  const html = '<div class="es-boyut-cubuk" style="margin-bottom:8px;">' +
    '<button type="button" class="dugme dugme-sade" data-boyut-ac style="width:100%; border:1px solid #48CAE4; background:linear-gradient(135deg,rgba(58,124,165,0.25),rgba(123,44,191,0.3)); color:#ADE8F4; font-weight:700; text-shadow:0 0 8px rgba(72,202,228,0.5); padding:8px 12px; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:8px;">' +
      '<span>🌌</span> <b>4. Boyut Galaktik Seyrüsefer</b> <span style="font-size:11px; opacity:.8;">(Uzayda Kaydır)</span>' +
    '</button></div>' +
    '<div class="es-ara"><input class="kod-giris arac-giris" id="esAra" type="search" autocomplete="off" placeholder="Evren ara…" aria-label="Evren ara"></div>' +
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
    '<button class="es-serit-oge es-serit-boyut" data-boyut-ac style="border-color:#48CAE4; color:#48CAE4; font-weight:700;">🌌 4. Boyut Seyrüsefer</button>' +
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

/* ==================== 4.4: 4. Boyut Galaktik Seyrüsefer & Gezegen Kaydırıcı ==================== */

const BOYUT_EVREN_TANIMLARI = {
  tentifor: {
    w: "W: 0.00 [Kanon]",
    ad: "Tentiforverse",
    renk: "#3A7CA5",
    parlaklik: "#81C3D7",
    ozet: "Tömye sistemi: Tömye ana dünyası ve Ax-24 kardeş gezegeni."
  },
  e25: {
    w: "W: +1.00 [Kanon]",
    ad: "E25 Evrengezer Yurdu",
    renk: "#48CAE4",
    parlaklik: "#ADE8F4",
    ozet: "Evrengezerlerin evreni: Beyaz Taşlar, evrenler arası geçiş ve Evrengezer halkı."
  },
  e26: {
    w: "W: +2.00 [Kanon]",
    ad: "E26 Evreni",
    renk: "#00F5D4",
    parlaklik: "#7B2CBF",
    ozet: "Herkesin saçına bağlı birkaç konuşma topu vardır; sesler bu toplardan yayılır."
  },
  claude: {
    w: "W: -1.00 [Test]",
    ad: "Claude Evreni",
    renk: "#7209B7",
    parlaklik: "#4CC9F0",
    ozet: "Şomdo: Işığın yürüme hızında gittiği tek bir dünya."
  }
};

/* Sadece evren külliyatında ve verisinde gerçekten var olan gezegenler */
const BOYUT_GEZEGENLERI = {
  tentifor: [
    {
      id: "tomye",
      ad: "Tömye",
      sinif: "Karasal Gezegen",
      unvan: "Neot Kıtası & Başkent Blero",
      renk: "#3A7CA5",
      hale: "#81C3D7",
      halka: false,
      atmosfer: "1.02 atm (Oksijen/Azot)",
      yercekimi: "0.98 g",
      tehlike: "Kanon Dünya",
      ozet: "Tentiforverse'ün kalbi. Aysız bir gezegen, ayları 28 gün çeker. Neot kıtası, antik kütüphaneler ve Blero, Yegim, Oseg şehirleri.",
      git: "harita:tomye"
    },
    {
      id: "ax24",
      ad: "Ax-24",
      sinif: "Kardeş Gezegen",
      unvan: "Tömye Sistemi",
      renk: "#8E9AAF",
      hale: "#CBC0D3",
      halka: true,
      atmosfer: "0.14 atm",
      yercekimi: "0.41 g",
      tehlike: "Sıradan Hayat",
      ozet: "Tömye ile aynı sistemdeki başka bir gezegen. Gücünü bırakan biri burada sıradan bir hayat sürüyor.",
      git: "harita:ax24"
    }
  ],
  e25: [
    {
      id: "e25",
      ad: "E25",
      sinif: "Evrengezerler Dünyası",
      unvan: "Beyaz Taşlar",
      renk: "#48CAE4",
      hale: "#ADE8F4",
      halka: false,
      atmosfer: "Geçitler Biyosferi",
      yercekimi: "1.00 g",
      tehlike: "Kanon",
      ozet: "Evrengezerlerin evreni: Beyaz Taşlar, evrenler arası geçiş ve Evrengezer halkı. Melezlerin (Sabıka soyu) bilgileri burada ve Tömye'de ortaktır; anıları ve hikâyeleri Tömye arşivinde kalır.",
      git: "#/ev/site/e25"
    }
  ],
  e26: [
    {
      id: "e26",
      ad: "E26",
      sinif: "Kanon Evren Dünyası",
      unvan: "Konuşma Topları",
      renk: "#00F5D4",
      hale: "#7B2CBF",
      halka: false,
      atmosfer: "Ses Biyosferi",
      yercekimi: "1.00 g",
      tehlike: "Kanon",
      ozet: "Herkesin saçına bağlı birkaç konuşma topu vardır; sesler bu toplardan yayılır. Biriyle konuşmak için top ona dokunur; karşıdaki sesi bu dokunuşla algılar.",
      git: "harita:e26"
    }
  ],
  claude: [
    {
      id: "somdo",
      ad: "Şomdo",
      sinif: "Işığın Yürüdüğü Dünya",
      unvan: "Yekin Kıtası & Gecikme Denizi",
      renk: "#7209B7",
      hale: "#4CC9F0",
      halka: true,
      atmosfer: "Işık Hızı: 5 km/s",
      yercekimi: "1.00 g",
      tehlike: "Test Evreni",
      ozet: "Şomdo adlı tek bir dünya: ortada Yekin kıtası, çevresinde Gecikme Denizi, dışta hilal biçimli Üzek kıtası ve en dışta ışığın döküldüğü Kıyı. Dört şehir, aynacılar, şafak yürüyücüleri ve gecikmede avlanan Yeveşler.",
      git: "#/claude"
    }
  ]
};

let boyutTesseractAnimasyonId = null;
let boyutAktifEvrenId = "tentifor";
let boyutAktifGezegenIndex = 0;

/** Yalnızca açık (kilitli olmayan) evrenleri 4. boyut listesine getirir */
function boyutAcikEvrenleriGetir() {
  const l = typeof evrenSeciciListesi === "function" ? evrenSeciciListesi() : { site: [], benim: [], fan: [] };
  const chipler = [];

  // 1. Sitedeki açık evrenler
  (l.site || []).forEach(function(s, idx) {
    if (s.kilitli) { return; }
    let id = "tentifor";
    let w = "W: 0.00";
    let ad = s.ad.replace(" · 24. Evren", "");

    if (s.git === "#/arsiv" || s.git === "harita:tomye") {
      id = "tentifor";
      w = "W: 0.00 [Kanon]";
      ad = "Tentiforverse";
    } else if (s.git.indexOf("e25") !== -1) {
      id = "e25";
      w = "W: +1.00 [Kanon]";
      ad = "E25";
    } else if (s.git.indexOf("e26") !== -1) {
      id = "e26";
      w = "W: +2.00 [Kanon]";
      ad = "E26";
    } else if (s.git.indexOf("claude") !== -1) {
      id = "claude";
      w = "W: -1.00 [Test]";
      ad = "Şomdo (Claude)";
    } else if (s.git.indexOf("e99") !== -1) {
      id = "e99";
      w = "W: +9.90 [Ortak]";
      ad = "E99";
    } else {
      id = s.git.replace(/^#\/ev\/(site|fan|benim)\//, "").replace(/^harita:/, "");
      w = "W: +" + (idx + 1) + ".00";
    }

    if (!chipler.some(function(c) { return c.id === id; })) {
      chipler.push({ id: id, ad: ad, w: w, git: s.git });
    }
  });

  // 2. Kullanıcının açık evrenleri (benim)
  (l.benim || []).forEach(function(b, i) {
    const id = b.git.replace("#/ev/benim/", "");
    if (!chipler.some(function(c) { return c.id === id; })) {
      chipler.push({ id: id, ad: b.ad, w: "W: +1." + (i + 4) + " [Senin]", git: b.git });
    }
  });

  // 3. Okurların açık fan evrenleri
  (l.fan || []).forEach(function(f, i) {
    const id = f.git.replace("#/ev/fan/", "");
    if (!chipler.some(function(c) { return c.id === id; })) {
      chipler.push({ id: id, ad: f.ad, w: "W: +3." + (i + 1) + " [Fan]", git: f.git });
    }
  });

  return chipler;
}

/** Web Audio prosedürel uzay hiper-atlama sesi */
function boyutProsedurelWarpSesi() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) { return; }
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") { ctx.resume(); }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(4000, now + 0.3);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch (_) { /* sessiz geç */ }
}

/** 4D Tesseract (Hiperküp) stereografik projeksiyon çizimi */
function boyutTesseractBaslat(canvas) {
  if (!canvas) { return; }
  const ctx = canvas.getContext("2d");
  if (!ctx) { return; }
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;

  const vertices = [];
  for (let i = 0; i < 16; i++) {
    vertices.push([
      (i & 1) ? 1 : -1,
      (i & 2) ? 1 : -1,
      (i & 4) ? 1 : -1,
      (i & 8) ? 1 : -1
    ]);
  }

  const edges = [];
  for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
      let diff = i ^ j;
      if ((diff & (diff - 1)) === 0) {
        edges.push([i, j]);
      }
    }
  }

  let aci = 0;
  function ciz() {
    aci += 0.02;
    ctx.clearRect(0, 0, w, h);

    const cosA = Math.cos(aci), sinA = Math.sin(aci);
    const cosB = Math.cos(aci * 0.7), sinB = Math.sin(aci * 0.7);

    const projected = vertices.map(function(v) {
      let x = v[0], y = v[1], z = v[2], w4 = v[3];
      let x1 = x * cosA - w4 * sinA;
      let w1 = x * sinA + w4 * cosA;
      let y1 = y * cosB - z * sinB;
      let z1 = y * sinB + z * cosB;

      const d4 = 2.4;
      const f4 = 1 / (d4 - w1);
      let x2 = x1 * f4;
      let y2 = y1 * f4;
      let z2 = z1 * f4;

      const d3 = 2.8;
      const f3 = 1 / (d3 - z2);
      return [
        cx + x2 * f3 * (w * 0.9),
        cy + y2 * f3 * (h * 0.9)
      ];
    });

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(72, 202, 228, 0.7)";
    ctx.beginPath();
    edges.forEach(function(pair) {
      ctx.moveTo(projected[pair[0]][0], projected[pair[0]][1]);
      ctx.lineTo(projected[pair[1]][0], projected[pair[1]][1]);
    });
    ctx.stroke();

    ctx.fillStyle = "#ADE8F4";
    projected.forEach(function(p) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    boyutTesseractAnimasyonId = requestAnimationFrame(ciz);
  }
  ciz();
}

/** Evrenin gerçek gezegen listesini getirir */
function boyutGezegenlerListesi(evrenId) {
  if (BOYUT_GEZEGENLERI[evrenId]) {
    return BOYUT_GEZEGENLERI[evrenId];
  }
  if (evrenId === "tomye") {
    return BOYUT_GEZEGENLERI.tentifor;
  }
  const evren = (typeof evrenBul === "function" ? evrenBul(evrenId) : null) || { ad: evrenId || "Evren" };
  const anaAd = evren.ad || "Evren Dünyası";
  const git = evren.git || (evren.id ? (evren.id.indexOf("fork-") === 0 ? "#/ev/benim/" + evren.id : "#/ev/site/" + evren.id) : "#/");
  return [
    {
      id: evren.id || "dunya",
      ad: anaAd,
      sinif: "Özgün Dünya",
      unvan: evren.yazar || "Evren Dünyası",
      renk: "#9D4EDD",
      hale: "#C77DFF",
      halka: false,
      atmosfer: "Doğal",
      yercekimi: "1.00 g",
      tehlike: "Açık",
      ozet: evren.ozet || "Bu evrenin kurucusu tarafından tanımlanmış bağımsız dünyası.",
      git: git
    }
  ];
}

/** Uzayda seçili gezegeni odaklar ve Holo-HUD panelini günceller */
function boyutGezegenSec(index) {
  const gezegenler = boyutGezegenlerListesi(boyutAktifEvrenId);
  if (!gezegenler.length) { return; }
  boyutAktifGezegenIndex = Math.max(0, Math.min(gezegenler.length - 1, index));
  const g = gezegenler[boyutAktifGezegenIndex];

  const ogeler = document.querySelectorAll(".boyut-gezegen-oge");
  ogeler.forEach(function(el, i) {
    el.classList.toggle("aktif", i === boyutAktifGezegenIndex);
  });

  const ray = document.querySelector("#boyutGezegenRayi");
  const alani = document.querySelector("#boyutKaydiriciAlani");
  const seciliEl = ogeler[boyutAktifGezegenIndex];
  if (gezegenler.length <= 1 && ray) {
    ray.style.transform = "translateX(0px)";
  } else if (ray && alani && seciliEl) {
    const merkez = alani.offsetWidth / 2;
    const elMerkez = seciliEl.offsetLeft + (seciliEl.offsetWidth / 2);
    ray.style.transform = "translateX(" + (merkez - elMerkez) + "px)";
  } else if (ray) {
    const ofset = -1 * (boyutAktifGezegenIndex - Math.floor(gezegenler.length / 2)) * 140;
    ray.style.transform = "translateX(" + ofset + "px)";
  }

  const hud = document.querySelector("#boyutHudPanel");
  if (hud && g) {
    hud.innerHTML =
      '<div class="boyut-hud-sol">' +
        '<div class="boyut-hud-baslik-sira">' +
          '<span class="boyut-hud-ad">' + kacir(g.ad) + '</span>' +
          '<span class="boyut-hud-sinif">' + kacir(g.sinif) + '</span>' +
        '</div>' +
        '<div class="boyut-hud-metrikler">' +
          '<span class="boyut-metrik-oge">💨 ' + kacir(g.atmosfer) + '</span>' +
          '<span class="boyut-metrik-oge">⚖️ ' + kacir(g.yercekimi) + '</span>' +
          '<span class="boyut-metrik-oge">⚠️ ' + kacir(g.tehlike) + '</span>' +
        '</div>' +
        '<div class="boyut-hud-ozet">' + kacir(g.ozet) + '</div>' +
      '</div>' +
      '<button type="button" class="boyut-inis-btn" data-boyut-inis="' + kacir(g.git) + '">' +
        '<span>🚀</span> <b>' + (gezegenler.length > 1 ? "Gezegene İniş Yap" : "Dünyaya İniş Yap") + '</b>' +
      '</button>';
  }
}

/** Gezegenleri yatayda bir adım kaydırır (yalnızca 1den fazla gezegen varsa) */
function boyutGezegenKaydir(yon) {
  const gezegenler = boyutGezegenlerListesi(boyutAktifEvrenId);
  if (gezegenler.length <= 1) { return; }
  let yeni = boyutAktifGezegenIndex + yon;
  if (yeni < 0) { yeni = gezegenler.length - 1; }
  if (yeni >= gezegenler.length) { yeni = 0; }
  boyutGezegenSec(yeni);
}

/** 4. Boyut aksında evren değiştirir ve uzay sahnesini o evrenin dünyasına yönlendirir */
function boyutEvrenSec(evrenId) {
  boyutAktifEvrenId = evrenId;
  boyutAktifGezegenIndex = 0;

  document.querySelectorAll(".boyut-cip").forEach(function(el) {
    el.classList.toggle("aktif", el.dataset.boyutEvren === evrenId);
  });

  const chipler = boyutAcikEvrenleriGetir();
  const c = chipler.find(function(x) { return x.id === evrenId; });
  const t = BOYUT_EVREN_TANIMLARI[evrenId] || (c ? { w: c.w } : { w: "W: +1.42 [Açık Evren]" });
  const koord = document.querySelector("#boyutKoordinatMetin");
  if (koord) {
    koord.innerHTML = "<b>" + kacir(t.w) + "</b><br>Kuantum Kararlılık: %99.8";
  }

  const gezegenler = boyutGezegenlerListesi(evrenId);
  const birdenFazla = gezegenler.length > 1;

  // Sadece 1'den fazla gezegen olan evrenlerde okları göster
  const solOk = document.querySelector("#boyutOkSol");
  const sagOk = document.querySelector("#boyutOkSag");
  if (solOk) { solOk.style.display = birdenFazla ? "grid" : "none"; }
  if (sagOk) { sagOk.style.display = birdenFazla ? "grid" : "none"; }

  const alani = document.querySelector("#boyutKaydiriciAlani");
  if (alani) {
    alani.style.cursor = birdenFazla ? "grab" : "default";
  }

  const ray = document.querySelector("#boyutGezegenRayi");
  if (ray) {
    ray.innerHTML = gezegenler.map(function(g, idx) {
      return '<div class="boyut-gezegen-oge' + (idx === 0 ? " aktif" : "") + '" data-gezegen-idx="' + idx + '">' +
        '<div class="boyut-gezegen-kure" style="background: radial-gradient(circle at 32% 32%, ' + g.hale + ' 0%, ' + g.renk + ' 55%, #0B132B 95%); --gezegen-hale:' + g.hale + ';">' +
          (g.halka ? '<div class="boyut-gezegen-halka"></div>' : '') +
        '</div>' +
        '<div class="boyut-gezegen-ad-etiket">' + kacir(g.ad) + '</div>' +
      '</div>';
    }).join("");
  }

  boyutGezegenSec(0);
}

/** Gezegen sahnesinde dokunarak/sürükleyerek kaydırma dinleyicisi (sadece birden fazla gezegen varsa) */
function boyutKaydiriciSurukleKur(alani) {
  if (!alani) { return; }
  let baslaX = 0, kaydiriyor = false;

  const basla = function(clientX) {
    const gezegenler = boyutGezegenlerListesi(boyutAktifEvrenId);
    if (gezegenler.length <= 1) { return; }
    kaydiriyor = true;
    baslaX = clientX;
  };
  const bitir = function(clientX) {
    if (!kaydiriyor) { return; }
    kaydiriyor = false;
    const fark = clientX - baslaX;
    if (Math.abs(fark) > 35) {
      if (fark < 0) {
        boyutGezegenKaydir(1);
      } else {
        boyutGezegenKaydir(-1);
      }
    }
  };

  alani.addEventListener("pointerdown", function(e) { basla(e.clientX); });
  alani.addEventListener("pointerup", function(e) { bitir(e.clientX); });
  alani.addEventListener("pointercancel", function() { kaydiriyor = false; });

  alani.addEventListener("touchstart", function(e) { if (e.touches && e.touches[0]) { basla(e.touches[0].clientX); } }, { passive: true });
  alani.addEventListener("touchend", function(e) { if (e.changedTouches && e.changedTouches[0]) { bitir(e.changedTouches[0].clientX); } }, { passive: true });
}

/** Seçili gezegene/dünyaya hiperuzay atlaması yaparak iniş yapar */
function boyutGezegeneInisYap(git) {
  boyutProsedurelWarpSesi();

  const perde = document.querySelector("#boyutWarpPerdesi");
  if (perde) {
    perde.classList.add("warp-aktif");
  }

  if (typeof aktifEvrenSec === "function") {
    aktifEvrenSec(git, boyutAktifEvrenId);
  }

  setTimeout(function() {
    boyutSeyruseferKapat();
    if (git.indexOf("harita:") === 0) {
      const hid = git.slice(7);
      if (typeof haritaSeciliId !== "undefined") { haritaSeciliId = hid; }
      if (location.hash !== "#/harita") {
        location.hash = "#/harita";
      } else if (typeof haritaCiz === "function") {
        try { haritaCiz(); } catch (_) {}
      }
      setTimeout(function () { if (typeof haritaCiz === "function") { try { haritaCiz(); } catch (_) {} } }, 60);
    } else {
      if (location.hash === git) {
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } else {
        location.hash = git;
      }
    }
  }, 320);
}

/** 4. Boyut Galaktik Seyrüsefer ve Gezegen Kaydırıcı modalını açar */
function boyutSeyruseferAc(varsayilanEvrenId) {
  if (document.querySelector("#boyutSeyruseferModal")) { return; }
  if (typeof evrenSeciciKapat === "function") { evrenSeciciKapat(); }
  if (typeof mobilMenuKapat === "function") { mobilMenuKapat(); }

  const chipler = boyutAcikEvrenleriGetir();
  boyutAktifEvrenId = varsayilanEvrenId || (typeof state !== "undefined" && state.aktifEvrenId) || "tentifor";
  if (!chipler.some(function(c) { return c.id === boyutAktifEvrenId; })) {
    boyutAktifEvrenId = chipler[0] ? chipler[0].id : "tentifor";
  }

  const modal = document.createElement("div");
  modal.id = "boyutSeyruseferModal";
  modal.className = "boyut-modal-katman";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-label", "4. Boyut Galaktik Seyrüsefer");

  modal.innerHTML =
    '<div class="boyut-warp-perdesi" id="boyutWarpPerdesi"></div>' +
    '<div class="boyut-ust-bar">' +
      '<div class="boyut-baslik-kutu">' +
        '<div class="boyut-ana-baslik"><span>🌌</span> 4. BOYUT GALAKTİK SEYRÜSEFER</div>' +
        '<div class="boyut-alt-bilgi">Zaman Çizgisi Koordinatları: W-Aksı & Açık Evrenler Arası Geçiş</div>' +
      '</div>' +
      '<div class="boyut-ust-butonlar">' +
        '<button type="button" class="dugme dugme-sade" id="boyutKlasikListeBtn" style="font-size:12px; padding:6px 12px; border-color:rgba(72,202,228,0.4); color:#ADE8F4;">📋 Liste Görünümü</button>' +
        '<button type="button" class="boyut-kapat-btn" id="boyutKapatBtn" aria-label="Kapat">✕</button>' +
      '</div>' +
    '</div>' +
    '<div class="boyut-4d-alan">' +
      '<div class="boyut-tesseract-kutu">' +
        '<canvas class="boyut-tesseract-canvas" id="boyutTesseractCanvas" width="44" height="44"></canvas>' +
        '<div class="boyut-koordinat-bilgi" id="boyutKoordinatMetin"><b>W: 0.00 [Kanon]</b><br>Kuantum Kararlılık: %99.8</div>' +
      '</div>' +
      '<div class="boyut-zaman-cizgileri">' +
        chipler.map(function(c) {
          return '<button type="button" class="boyut-cip' + (c.id === boyutAktifEvrenId ? " aktif" : "") + '" data-boyut-evren="' + kacir(c.id) + '">' +
            '<span>' + kacir(c.w) + '</span> <b>' + kacir(c.ad) + '</b>' +
          '</button>';
        }).join("") +
      '</div>' +
    '</div>' +
    '<div class="boyut-uzay-sahnesi" id="boyutUzaySahnesi">' +
      '<div class="boyut-yildiz-nebulasi"></div>' +
      '<button type="button" class="boyut-ok boyut-ok-sol" id="boyutOkSol" aria-label="Önceki Gezegen">‹</button>' +
      '<div class="boyut-kaydirici-alani" id="boyutKaydiriciAlani">' +
        '<div class="boyut-yorunge-cizgisi"></div>' +
        '<div class="boyut-gezegen-rayi" id="boyutGezegenRayi"></div>' +
      '</div>' +
      '<button type="button" class="boyut-ok boyut-ok-sag" id="boyutOkSag" aria-label="Sonraki Gezegen">›</button>' +
    '</div>' +
    '<div class="boyut-hud-panel" id="boyutHudPanel"></div>';

  document.body.appendChild(modal);

  const canvas = modal.querySelector("#boyutTesseractCanvas");
  if (canvas) { boyutTesseractBaslat(canvas); }

  boyutEvrenSec(boyutAktifEvrenId);

  const kaydirici = modal.querySelector("#boyutKaydiriciAlani");
  if (kaydirici) { boyutKaydiriciSurukleKur(kaydirici); }
}

/** 4. Boyut Galaktik Seyrüsefer modalını kapatır */
function boyutSeyruseferKapat() {
  if (boyutTesseractAnimasyonId) {
    cancelAnimationFrame(boyutTesseractAnimasyonId);
    boyutTesseractAnimasyonId = null;
  }
  const modal = document.querySelector("#boyutSeyruseferModal");
  if (modal) { modal.remove(); }
}

/* 4. Boyut arayüz tıklama dinleyicileri */
document.addEventListener("click", function(ev) {
  if (ev.target.closest("[data-boyut-ac]") || ev.target.closest("#boyutSeyruseferBtn")) {
    ev.preventDefault();
    boyutSeyruseferAc();
    return;
  }
  if (ev.target.closest("#boyutKapatBtn")) {
    boyutSeyruseferKapat();
    return;
  }
  if (ev.target.closest("#boyutKlasikListeBtn")) {
    boyutSeyruseferKapat();
    if (typeof evrenSeciciAc === "function") { evrenSeciciAc(); }
    return;
  }
  const cip = ev.target.closest("[data-boyut-evren]");
  if (cip) {
    const eid = cip.getAttribute("data-boyut-evren");
    boyutEvrenSec(eid);
    return;
  }
  const gOge = ev.target.closest(".boyut-gezegen-oge");
  if (gOge) {
    const idx = parseInt(gOge.getAttribute("data-gezegen-idx"), 10);
    if (!isNaN(idx)) { boyutGezegenSec(idx); }
    return;
  }
  if (ev.target.closest("#boyutOkSol")) {
    boyutGezegenKaydir(-1);
    return;
  }
  if (ev.target.closest("#boyutOkSag")) {
    boyutGezegenKaydir(1);
    return;
  }
  const inisBtn = ev.target.closest("[data-boyut-inis]");
  if (inisBtn) {
    const git = inisBtn.getAttribute("data-boyut-inis");
    boyutGezegeneInisYap(git);
    return;
  }
});

/* Klavye okları & ESC desteği */
window.addEventListener("keydown", function(e) {
  const modal = document.querySelector("#boyutSeyruseferModal");
  if (!modal) { return; }
  if (e.key === "Escape") {
    boyutSeyruseferKapat();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const gezegenler = boyutGezegenlerListesi(boyutAktifEvrenId);
    if (gezegenler.length > 1) {
      boyutGezegenKaydir(e.key === "ArrowLeft" ? -1 : 1);
    }
  }
});

/* #/boyut veya #/seyrusefer rotası desteği */
window.addEventListener("hashchange", function() {
  if (location.hash === "#/boyut" || location.hash === "#/seyrusefer") {
    boyutSeyruseferAc();
  }
});
if (typeof window !== "undefined" && (location.hash === "#/boyut" || location.hash === "#/seyrusefer")) {
  setTimeout(function() { boyutSeyruseferAc(); }, 120);
}

