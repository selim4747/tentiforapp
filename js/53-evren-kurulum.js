/* Evren kurma: yeni evrende "İlk adımlar" rehberi, hazır harita şablonları, sekme şeridi.

   Kendi evreninin Harita ve Bilgiler sekmelerinin üstünde, eksik adımları gösteren bir kart durur:
   ad, anlatım, ilk kural, ilk kişi, haritada bir yer, para. Her adım tek dokunuşla ilgili alana götürür.
   Haritası boş evrene hazır bir harita (tek kıta, takımada, iki kıta) konabilir; adlarını sonra değiştirir. */

const EVK_GIZLI_ANAHTAR = "tentiforapp_evren_ilk_gizli";

function evkDolu(l, alan) {
  return (l || []).some(function (x) { return x && String(x[alan] || "").trim(); });
}

function evkAdimlar(e) {
  return [
    { id: "ad", ad: "Adını koy", ipucu: "Evrenin adı her yerde görünür.", tamam: !!String(e.ad || "").trim() },
    { id: "ozet", ad: "Bir iki cümleyle anlat", ipucu: "Gezginler evrene girince ilk bunu okur.", tamam: !!String(e.ozet || "").trim() },
    { id: "kural", ad: "İlk kuralını yaz", ipucu: "Bu evrende neyin nasıl işlediği.", tamam: evkDolu(e.kurallar, "ad") || evkDolu(e.kurallar, "aciklama") },
    { id: "kisi", ad: "Bir kişi ekle", ipucu: "Evreninde yaşayan biri.", tamam: evkDolu(e.kisiler, "ad") },
    { id: "harita", ad: "Haritaya bir yer koy", ipucu: "Boş haritaya dokun ya da hazır haritayla başla.", tamam: (((e.harita || {}).yerler) || []).length > 0 },
    { id: "para", ad: "Paranın adını seç", ipucu: "Gezginler bu parayla ödüllenir.", tamam: !!(e.para && String(e.para.ad || "").trim()) }
  ];
}

function evkGizliler() {
  const l = jsonOku(EVK_GIZLI_ANAHTAR, []);
  return Array.isArray(l) ? l : [];
}

/** kisa: harita sekmesinde yalnızca ilerleme ve sıradaki adım (harita aşağı itilmesin). */
function evkKartHtml(e, kisa) {
  const adimlar = evkAdimlar(e);
  const biten = adimlar.filter(function (a) { return a.tamam; }).length;
  if (biten === adimlar.length || evkGizliler().indexOf(e.id) !== -1) { return ""; }
  const haritaBos = !(((e.harita || {}).yerler) || []).length;
  const siradaki = adimlar.find(function (a) { return !a.tamam; });
  const sablonlar = haritaBos ? '<div class="evk-sablon"><span class="oyun-not">Hazır haritayla başla:</span>' +
      EVK_SABLONLAR.map(function (s) { return '<button class="evk-sablon-dugme" data-evk-sablon="' + s.id + '">' + evkSablonSvg(s) + "<span>" + kacir(s.ad) + "</span></button>"; }).join("") +
      "</div>" : "";
  if (kisa) {
    return '<section class="evk-kart kisa" aria-label="İlk adımlar">' +
      '<div class="evk-ust"><div><span class="evs-rozet">İlk adımlar · ' + biten + " / " + adimlar.length + "</span>" +
        '<div class="evk-cubuk" aria-hidden="true"><i style="width:' + Math.round(100 * biten / adimlar.length) + '%"></i></div></div>' +
        (siradaki.id === "harita" ? "" : '<button class="dugme dugme-sade evk-sonraki" data-evk-git="' + siradaki.id + '">Sıradaki: ' + kacir(siradaki.ad) + " →</button>") +
        '<button class="evk-gizle" data-evk-gizle aria-label="İlk adımları gizle">Gizle</button></div>' +
      sablonlar + "</section>";
  }
  return '<section class="evk-kart" aria-label="İlk adımlar">' +
    '<div class="evk-ust"><div><span class="evs-rozet">Evrenini kur</span><b>İlk adımlar</b></div>' +
      '<span class="evk-sayi">' + biten + " / " + adimlar.length + "</span>" +
      '<button class="evk-gizle" data-evk-gizle aria-label="İlk adımları gizle">Gizle</button></div>' +
    '<div class="evk-cubuk" role="progressbar" aria-valuemin="0" aria-valuemax="' + adimlar.length + '" aria-valuenow="' + biten + '"><i style="width:' +
      Math.round(100 * biten / adimlar.length) + '%"></i></div>' +
    '<ol class="evk-adimlar">' + adimlar.map(function (a) {
      return '<li class="' + (a.tamam ? "tamam" : "") + '"><button data-evk-git="' + a.id + '"' + (a.tamam ? ' aria-label="' + kacir(a.ad) + ' (tamam)"' : "") + ">" +
        '<span class="evk-isaret" aria-hidden="true">' + (a.tamam ? "✓" : "") + "</span>" +
        '<span class="evk-yazi"><b>' + kacir(a.ad) + "</b><small>" + kacir(a.ipucu) + "</small></span>" +
        '<span class="evk-ok" aria-hidden="true">→</span></button></li>';
    }).join("") + "</ol>" +
    "</section>";
}

/* ---------- hazır haritalar (0–100 koordinat; adlar sonra değiştirilir) ---------- */

const EVK_SABLONLAR = [
  { id: "kita", ad: "Tek kıta", yerler: [
    { ad: "Ana Kıta", tur: "Kıta", x: 30, y: 62, sekil: [[18, 30], [34, 16], [56, 14], [76, 22], [86, 42], [80, 66], [62, 82], [38, 84], [20, 70], [12, 50]] },
    { ad: "Başkent", tur: "Şehir", x: 54, y: 46 },
    { ad: "Yüksek Dağ", tur: "Dağ", x: 64, y: 32 },
    { ad: "Kuzey Ormanı", tur: "Orman", x: 34, y: 30 },
    { ad: "Güney Kıyısı", tur: "Küçük Yerleşim", x: 44, y: 76 }
  ] },
  { id: "takimada", ad: "Takımada", yerler: [
    { ad: "Büyük Ada", tur: "Ada", x: 32, y: 32, sekil: [[20, 30], [30, 22], [44, 26], [48, 40], [40, 52], [26, 50], [18, 42]] },
    { ad: "Doğu Adası", tur: "Ada", x: 70, y: 30, sekil: [[62, 24], [74, 18], [82, 26], [78, 38], [66, 38]] },
    { ad: "Güney Adası", tur: "Ada", x: 62, y: 72, sekil: [[52, 66], [62, 60], [74, 66], [72, 80], [58, 82]] },
    { ad: "Küçük Ada", tur: "Ada", x: 22, y: 74, sekil: [[16, 70], [24, 66], [30, 74], [22, 80]] },
    { ad: "Liman", tur: "Şehir", x: 40, y: 47 }
  ] },
  { id: "iki", ad: "İki kıta", yerler: [
    { ad: "Batı Kıtası", tur: "Kıta", x: 22, y: 68, sekil: [[8, 26], [24, 16], [40, 24], [44, 50], [36, 78], [16, 82], [6, 58]] },
    { ad: "Doğu Kıtası", tur: "Kıta", x: 78, y: 68, sekil: [[58, 20], [78, 14], [94, 28], [92, 60], [80, 84], [60, 76], [56, 46]] },
    { ad: "Ara Deniz", tur: "Su", x: 50, y: 52 },
    { ad: "Batı Şehri", tur: "Şehir", x: 24, y: 46 },
    { ad: "Doğu Şehri", tur: "Şehir", x: 76, y: 42 }
  ] }
];

function evkSablonSvg(s) {
  return '<svg viewBox="0 0 100 70" aria-hidden="true" class="evk-sablon-svg"><rect width="100" height="70" fill="#BFD8EC"/>' +
    s.yerler.filter(function (y) { return y.sekil; }).map(function (y) {
      return '<polygon points="' + y.sekil.map(function (n) { return n[0] + "," + (n[1] * 0.7).toFixed(1); }).join(" ") + '" fill="#E6DCC3" stroke="#8A7B5E" stroke-width="0.8"/>';
    }).join("") + "</svg>";
}

function evkSablonUygula(id, sablonId) {
  const s = EVK_SABLONLAR.find(function (x) { return x.id === sablonId; });
  if (!s) { return; }
  evrenBenimDegistir(id, function (e) {
    if (!e.harita || typeof e.harita !== "object") { e.harita = { yerler: [] }; }
    if ((e.harita.yerler || []).length) { return; }   /* dolu haritanın üstüne yazılmaz */
    e.harita.yerler = s.yerler.map(function (y, i) {
      const t = { id: "y" + Date.now().toString(36) + i, ad: y.ad, tur: y.tur, not: "", x: y.x, y: y.y };
      if (y.sekil) { t.sekil = y.sekil.map(function (n) { return [n[0], n[1]]; }); }
      return t;
    });
  });
}

/* ---------- adıma git ---------- */

function evkOdakla(secici) {
  const el = document.querySelector("#evrenSayfa " + secici);
  if (!el) { return; }
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
}

function evkGit(adim) {
  if (!EVS || EVS.kaynak !== "benim") { return; }
  const id = EVS.id;
  if (adim === "kural" || adim === "kisi") {
    const g = adim === "kural" ? "kurallar" : "kisiler";
    let n = 0;
    evrenBenimDegistir(id, function (e) {
      if (!Array.isArray(e[g])) { e[g] = []; }
      const bos = e[g].findIndex(function (x) { return !String((x && x.ad) || "").trim(); });
      if (bos !== -1) { n = bos; return; }
      e[g].push(g === "kurallar" ? { ad: "", tur: "", aciklama: "" } : { ad: "", rol: "", aciklama: "" });
      n = e[g].length - 1;
    });
    EVS.sekme = "bilgi";
    evrenSayfaCiz();
    evkOdakla('[data-fan-alan="' + g + "." + n + '.ad"]');
    return;
  }
  if (adim === "harita") { EVS.sekme = "harita"; EVS.mod = "yer"; evrenSayfaCiz(); evkOdakla(".evh-kutu"); return; }
  if (adim === "para") { EVS.sekme = "stil"; evrenSayfaCiz(); evkOdakla('[data-evst="para.ad"]'); return; }
  EVS.sekme = "bilgi";
  evrenSayfaCiz();
  evkOdakla('[data-fan-alan="' + (adim === "ozet" ? "ozet" : "ad") + '"]');
}

/* ---------- evren sayfasına bağlama ---------- */

if (typeof evrenSayfaCiz === "function") {
  const eskiCiz = evrenSayfaCiz;
  window.evrenSayfaCiz = function () {
    const r = eskiCiz.apply(this, arguments);
    const s = document.querySelector("#evrenSayfa");
    if (!s || !EVS) { return r; }
    /* seçili sekme şeritte görünsün */
    const serit = s.querySelector(".evs-sekmeler");
    const secili = serit && serit.querySelector(".evs-sekme.secili");
    if (secili && serit.scrollWidth > serit.clientWidth) {
      serit.scrollLeft = Math.max(0, secili.offsetLeft - (serit.clientWidth - secili.offsetWidth) / 2);
    }
    if (EVS.kaynak === "benim" && (EVS.sekme === "bilgi" || EVS.sekme === "harita")) {
      const e = evrenBenimBul(EVS.id);
      const govde = s.querySelector(".evs-govde");
      const kart = e ? evkKartHtml(e, EVS.sekme === "harita") : "";
      if (govde && kart) { govde.insertAdjacentHTML("afterbegin", kart); }
    }
    return r;
  };
}

/* İlk adımlar kartı ad ve anlatım yazılırken güncellensin (sayfa yeniden çizilmeden) */
let evkTazeleZaman = null;
document.addEventListener("input", function (ev) {
  const t = ev.target;
  if (!t || !t.closest || !t.closest("#evrenSayfa [data-fan-form]") || !EVS || EVS.kaynak !== "benim") { return; }
  if (evkTazeleZaman) { clearTimeout(evkTazeleZaman); }
  evkTazeleZaman = setTimeout(function () {
    if (typeof fanBekleyeniYaz === "function") { fanBekleyeniYaz(); }
    const eski = document.querySelector("#evrenSayfa .evk-kart");
    const e = evrenBenimBul(EVS && EVS.id);
    if (!eski || !e) { return; }
    const yeni = evkKartHtml(e, eski.classList.contains("kisa"));
    if (!yeni) { eski.remove(); return; }
    const d = document.createElement("div");
    d.innerHTML = yeni;
    eski.replaceWith(d.firstChild);
    /* başlıktaki ad da */
    const h = document.querySelector("#evrenSayfa .evs-baslik h2");
    if (h) { h.textContent = e.ad || "Adsız evren"; }
  }, 700);
});

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-evk-git], [data-evk-gizle], [data-evk-sablon]");
  if (!h || !EVS || EVS.kaynak !== "benim") { return; }
  if (typeof fanBekleyeniYaz === "function") { fanBekleyeniYaz(); }
  if (h.dataset.evkGit) { evkGit(h.dataset.evkGit); return; }
  if (h.hasAttribute("data-evk-gizle")) {
    const l = evkGizliler();
    if (l.indexOf(EVS.id) === -1) { l.push(EVS.id); jsonYaz(EVK_GIZLI_ANAHTAR, l.slice(-50)); }
    evrenSayfaCiz();
    return;
  }
  if (h.dataset.evkSablon) {
    evkSablonUygula(EVS.id, h.dataset.evkSablon);
    EVS.sekme = "harita"; EVS.mod = "sec";
    evrenSayfaCiz();
    if (typeof eckaBildir === "function") { eckaBildir("Harita hazır: bir yere dokun, adını değiştir"); }
  }
});

/* Çıkışta ilerleme hesaba yazılamadıysa cihazda bırakıldı: söyle */
document.addEventListener("DOMContentLoaded", function () {
  let uyari = null;
  try { uyari = window.sessionStorage.getItem("tentiforapp_cikis_uyari"); window.sessionStorage.removeItem("tentiforapp_cikis_uyari"); } catch (_) { uyari = null; }
  if (uyari && typeof eckaBildir === "function") {
    setTimeout(function () { eckaBildir("Çıkış yapıldı. İlerlemen hesaba yazılamadığı için bu cihazda bırakıldı."); }, 1500);
  }
});
