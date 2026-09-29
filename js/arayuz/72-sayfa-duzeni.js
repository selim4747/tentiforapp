/* Sürüm 2.2 — apayrı sayfalar ve evren görünümü.

   - Sayfalar apayrı: "Sayfa 3 / 10" etiketi, alttaki numaralı sayfalama çubuğu (önceki/sonraki) ve 1–9 tuşlarıyla
     sayfa atlama kaldırıldı. Her sayfa kendi başına durur; sayfalar arası geçiş menüden.
   - Evren kurucusu kendi evreninin görünümünü değiştirir: "Görünüm" sekmesi öne alındı; hazır görünümler, zemin
     deseni, yazı boyutu, başlık hizası eklendi (renk, yazı tipi, köşe zaten vardı). "Yazı" sekmesi de öne alındı ve
     evren bilgi sayfasında "Evrenini kişiselleştir" kutusu var: görünüm, yazı çizimi, uygulamalar. */

/* ==================== apayrı sayfalar ==================== */

if (typeof sayfalamaCiz === "function") {
  window.sayfalamaCiz = function () {
    const c = document.querySelector("#sayfalama");
    if (c) { c.hidden = true; c.innerHTML = ""; }
  };
}
if (typeof sayfaBasiCiz === "function") {
  const eskiBas = sayfaBasiCiz;
  window.sayfaBasiCiz = function () {
    const r = eskiBas.apply(this, arguments);
    document.querySelectorAll("#sayfaBasi .sayfa-no").forEach(function (p) { p.remove(); });
    return r;
  };
}
/* 1–9 tuşlarıyla sayfa atlama: sayfalar birbirinin devamı değil (18-gezinme.js'teki dinleyiciden önce) */
document.addEventListener("keydown", function (e) {
  const a = document.activeElement;
  if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) { return; }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[0-9]$/.test(e.key)) { e.stopImmediatePropagation(); }
}, true);

/* ==================== evren görünümü ==================== */

const EVG_DESENLER = {
  "": "Düz",
  nokta: "Noktalı",
  cizgi: "Çizgili",
  izgara: "Izgara",
  yildiz: "Yıldızlı",
  dalga: "Dalgalı"
};
const EVG_BOYUT = { "": "Normal", kucuk: "Küçük", buyuk: "Büyük" };
const EVG_HIZA = { "": "Sola", orta: "Ortaya" };
const EVG_HAZIR = [
  { ad: "Gece", stil: { zemin: "#0E1522", yazi: "#E6EDF5", ana: "#7FB2E5", font: "sans", kose: 10, desen: "yildiz" } },
  { ad: "Parşömen", stil: { zemin: "#F3E9D2", yazi: "#3B2F1E", ana: "#8A5A2B", font: "serif", kose: 2, desen: "" } },
  { ad: "Okyanus", stil: { zemin: "#E6F4F7", yazi: "#0C2E3A", ana: "#127A8F", font: "sans", kose: 14, desen: "dalga" } },
  { ad: "Orman", stil: { zemin: "#EEF3E6", yazi: "#1E2B16", ana: "#3E6B2A", font: "serif", kose: 6, desen: "nokta" } },
  { ad: "Neon", stil: { zemin: "#12061F", yazi: "#F5E9FF", ana: "#E040FB", font: "mono", kose: 0, desen: "izgara" } },
  { ad: "Kül", stil: { zemin: "#E9E7E4", yazi: "#232120", ana: "#8B3A2E", font: "serif", kose: 4, desen: "cizgi" } }
];

function evgDesenArka(desen, ana) {
  const r = /^#[0-9a-fA-F]{6}$/.test(ana || "") ? ana : "#1C5C96";
  const svg = {
    nokta: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="2" cy="2" r="1.3" fill="' + r + '" fill-opacity=".22"/></svg>',
    cizgi: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M0 14L14 0" stroke="' + r + '" stroke-opacity=".14"/></svg>',
    izgara: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M24 0H0V24" fill="none" stroke="' + r + '" stroke-opacity=".14"/></svg>',
    yildiz: '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><circle cx="8" cy="12" r="1" fill="' + r + '" fill-opacity=".5"/><circle cx="40" cy="30" r=".8" fill="' + r + '" fill-opacity=".4"/><circle cx="22" cy="50" r="1.2" fill="' + r + '" fill-opacity=".35"/></svg>',
    dalga: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="16"><path d="M0 8Q10 0 20 8T40 8" fill="none" stroke="' + r + '" stroke-opacity=".16"/></svg>'
  }[desen];
  return svg ? "url(\"data:image/svg+xml," + encodeURIComponent(svg) + "\")" : "";
}

if (typeof evrenEkTemizle === "function") {
  const eskiEkG = evrenEkTemizle;
  window.evrenEkTemizle = function (ham, e) {
    eskiEkG.apply(this, arguments);
    const s = ham.stil;
    if (!s || typeof s !== "object") { return; }
    const ek = {};
    if (EVG_DESENLER[s.desen] && s.desen) { ek.desen = s.desen; }
    if (EVG_BOYUT[s.boyut] && s.boyut) { ek.boyut = s.boyut; }
    if (EVG_HIZA[s.hiza] && s.hiza) { ek.hiza = s.hiza; }
    if (Object.keys(ek).length) { e.stil = Object.assign({}, e.stil || {}, ek); }
  };
}

if (typeof evrenSayfaStili === "function") {
  const eskiStil = evrenSayfaStili;
  window.evrenSayfaStili = function (e) {
    const p = [eskiStil.apply(this, arguments)];
    const s = (e && e.stil) || {};
    const d = EVG_DESENLER[s.desen] && s.desen ? evgDesenArka(s.desen, s.ana) : "";
    if (d) { p.push("background-image:" + d); }
    if (s.boyut === "kucuk") { p.push("font-size:15px"); } else if (s.boyut === "buyuk") { p.push("font-size:19px"); }
    if (s.hiza === "orta") { p.push("--evs-hiza:center"); }
    return p.filter(Boolean).join(";");
  };
}

function evgGorunumKutusu(e) {
  const st = e.stil || {};
  const secim = function (yol, deger, l) {
    return '<select class="kod-giris arac-giris" data-evst="' + yol + '">' + Object.keys(l).map(function (k) {
      return '<option value="' + k + '"' + (String(deger || "") === k ? " selected" : "") + ">" + kacir(l[k]) + "</option>";
    }).join("") + "</select>";
  };
  return '<div class="kutu-y evg-kutu"><label>Hazır görünümler</label>' +
      '<p class="oyun-not">Birine dokun, evreninin rengi, yazı tipi ve deseni birden değişsin; sonra aşağıdan ince ayar yap.</p>' +
      '<div class="evg-hazir">' + EVG_HAZIR.map(function (h, i) {
        const s = h.stil;
        return '<button class="evg-hazir-oge" data-evg-hazir="' + i + '" style="background:' + s.zemin + ";color:" + s.yazi + ";border-color:" + s.ana +
          ";border-radius:" + s.kose + 'px"><b style="color:' + s.ana + '">' + kacir(h.ad) + "</b></button>";
      }).join("") + "</div>" +
      '<div class="evst-izgara">' +
        "<label>Zemin deseni" + secim("stil.desen", st.desen, EVG_DESENLER) + "</label>" +
        "<label>Yazı boyutu" + secim("stil.boyut", st.boyut, EVG_BOYUT) + "</label>" +
        "<label>Başlık hizası" + secim("stil.hiza", st.hiza, EVG_HIZA) + "</label>" +
      "</div></div>";
}

if (typeof evrenStilBolumu === "function") {
  const eskiStilBol = evrenStilBolumu;
  window.evrenStilBolumu = function (v) {
    return evgGorunumKutusu(v.eser) + eskiStilBol.apply(this, arguments);
  };
}

/* sekmeler: kendi evreninde Görünüm ve Yazı öne; adlar açık */
if (typeof evrenEkSekmeler === "function") {
  const eskiSek22 = evrenEkSekmeler;
  window.evrenEkSekmeler = function (v) {
    const l = eskiSek22.apply(this, arguments);
    if (!EVS || EVS.kaynak !== "benim") { return l; }
    const al = function (id) { const i = l.findIndex(function (x) { return x[0] === id; }); return i === -1 ? null : l.splice(i, 1)[0]; };
    const stil = al("stil"), yazi = al("yazi");
    const on = [];
    if (stil) { on.push(["stil", "🎨 Görünüm"]); }
    if (yazi) { on.push(["yazi", "✎ Yazı çiz"]); }
    return on.concat(l);
  };
}

/* bilgi sayfasında: kişiselleştirme kısayolları */
if (typeof evrenBilgiBolumu === "function") {
  const eskiBilgi = evrenBilgiBolumu;
  window.evrenBilgiBolumu = function (v) {
    const h = eskiBilgi.apply(this, arguments);
    if (!EVS || EVS.kaynak !== "benim") { return h; }
    return '<div class="kutu-y evg-kisisel"><span class="oyun-etiket">Evrenini kişiselleştir</span>' +
      '<p class="oyun-not">Evreninin sayfası senin: rengini, desenini ve yazı tipini değiştir, kendi yazını harf harf çiz, kodla oyun ekle.</p>' +
      '<div class="oyun-sira"><button class="dugme" data-evs-sekme="stil">🎨 Görünümü değiştir</button>' +
      '<button class="dugme dugme-sade" data-evs-sekme="kodstil">{ } Stil ve görünüm kodu</button>' +
      '<button class="dugme dugme-sade" data-evs-sekme="yazi">✎ Yazını çiz</button>' +
      '<button class="dugme dugme-sade" data-evs-sekme="uygulama">⌨ Uygulama ekle</button></div></div>' + h;
  };
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evg-hazir]");
  if (!b || !EVS || EVS.kaynak !== "benim" || typeof evrenBenimDegistir !== "function") { return; }
  const h = EVG_HAZIR[Number(b.getAttribute("data-evg-hazir"))];
  if (!h) { return; }
  evrenBenimDegistir(EVS.id, function (e) { e.stil = Object.assign({}, e.stil || {}, h.stil); });
  evrenSayfaCiz();
});
