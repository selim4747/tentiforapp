/* Sürüm 3.3 — Tömye bağlantıları, yıldızlı evrenler, okuma ayarları, evren doluluğu, şablonla başla,
   tüm evrenler süzgeci, Evrengezer yolculuk şablonu. Hepsi cihazda: sunucuya yük yok. */

/* ==================== 1. Tömye bağlantıları ====================
   Tentiforverse (24. Evren) kartları "#/arsiv" taşır (seçici, E25 kapısı, atölye): 3.2'den beri
   arşiv Tömye sayfasında; tıklanınca oraya gidilir. Değer korunur (karşılaştırmalar ona bakıyor). */
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest('[data-evren-git="#/arsiv"]');
  if (!b || b.closest("#anaEvrenler")) { return; }
  ev.preventDefault(); ev.stopImmediatePropagation();
  if (typeof evrenSeciciKapat === "function" && document.querySelector("#evrenSecici")) { evrenSeciciKapat(); }
  if (typeof evrenSayfaKapat === "function" && document.querySelector("#evrenSayfa")) { evrenSayfaKapat(); }
  location.hash = "#/tomye";
}, true);

/* ==================== 8. yıldızlı evrenler ==================== */
const YILDIZ_ANAHTAR = "tf33_yildizli";

function yildizlilar() { try { const l = JSON.parse(localStorage.getItem(YILDIZ_ANAHTAR) || "[]"); return Array.isArray(l) ? l : []; } catch (_) { return []; } }
function yildizliMi(git) { return yildizlilar().indexOf(git) !== -1; }
function yildizDegistir(git) {
  const l = yildizlilar(), i = l.indexOf(git);
  if (i === -1) { l.unshift(git); } else { l.splice(i, 1); }
  try { localStorage.setItem(YILDIZ_ANAHTAR, JSON.stringify(l.slice(0, 40))); } catch (_) { /* yok */ }
  return i === -1;
}

/* ana sayfa: her evren kartına yıldız; yıldızlılar en üstte ayrı grupta */
if (typeof anaEvrenlerCiz === "function") {
  const eskiAEC33 = anaEvrenlerCiz;
  window.anaEvrenlerCiz = function () {
    const r = eskiAEC33.apply(this, arguments);
    const alan = document.querySelector("#anaEvrenler");
    if (!alan) { return r; }
    alan.querySelectorAll(".ana-evren[data-evren-git]").forEach(function (k) {
      if (k.parentNode.classList.contains("ana-evren-sar")) { return; }
      const git = k.getAttribute("data-evren-git");
      const s = document.createElement("div"); s.className = "ana-evren-sar";
      k.parentNode.insertBefore(s, k); s.appendChild(k);
      const y = yildizliMi(git);
      s.insertAdjacentHTML("beforeend", '<button type="button" class="ana-yildiz' + (y ? " acik" : "") + '" data-yildiz="' + kacir(git) + '" aria-pressed="' + y + '" aria-label="' +
        kacir((y ? "Yıldızı kaldır: " : "Yıldızla: ") + (k.querySelector(".ana-evren-ad") || k).textContent.replace(/^🔒\s*/, "")) + '">' + (y ? "★" : "☆") + "</button>");
    });
    const l = yildizlilar();
    if (l.length) {
      const kartlar = l.map(function (git) {
        const k = alan.querySelector('.ana-evren-sar > .ana-evren[data-evren-git="' + (window.CSS && CSS.escape ? CSS.escape(git) : git) + '"]');
        return k ? k.parentNode.outerHTML : "";
      }).filter(Boolean);
      if (kartlar.length) {
        alan.insertAdjacentHTML("afterbegin", '<div class="ana-evren-grup ana-yildizli"><span class="ana-etiket">★ Yıldızladıkların</span><div class="ana-evren-liste">' + kartlar.join("") + "</div></div>");
      }
    }
    return r;
  };
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-yildiz]");
  if (!b) { return; }
  ev.preventDefault(); ev.stopPropagation();
  const acik = yildizDegistir(b.getAttribute("data-yildiz"));
  if (typeof eckaBildir === "function") { eckaBildir(acik ? "★ Yıldızlandı: ana sayfada üstte" : "Yıldız kaldırıldı"); }
  if (typeof anaEvrenlerCiz === "function") { anaEvrenlerCiz(); }
  if (typeof tumEvrenlerCiz === "function" && document.querySelector("#tumEvrenler")) { tumEvrenlerCiz(); }
});

/* ==================== 7. tüm evrenler: süzgeç, arama, sıralama ==================== */
const TUM_EV = { tur: "hepsi", ara: "", sira: "ad" };

function tumEvrenListesi() {
  const l = typeof evrenSeciciListesi === "function" ? evrenSeciciListesi() : { site: [], fan: [], benim: [] };
  const o = [];
  l.site.forEach(function (x) { o.push({ ad: x.ad, git: x.git, not: x.not || "", tur: x.git === "#/claude" ? "test" : "kanon", kilitli: !!x.kilitli }); });
  l.fan.forEach(function (x) { o.push({ ad: x.ad, git: x.git, not: x.not || "", tur: /^kanon/.test(x.not || "") ? "kanon" : (/^test/.test(x.not || "") ? "test" : "fan") }); });
  l.benim.forEach(function (x) { o.push({ ad: x.ad, git: x.git, not: "senin", tur: "benim" }); });
  const gez = (function () { try { return JSON.parse(localStorage.getItem("tf33_gezi_sayac") || "{}"); } catch (_) { return {}; } })();
  o.forEach(function (x) { x.gez = gez[x.git] || 0; x.yildiz = yildizliMi(x.git); });
  return o;
}

function tumEvrenlerHtml() {
  const q = String(TUM_EV.ara || "").trim().toLocaleLowerCase("tr");
  let l = tumEvrenListesi().filter(function (x) {
    return (TUM_EV.tur === "hepsi" || x.tur === TUM_EV.tur || (TUM_EV.tur === "yildiz" && x.yildiz)) &&
      (!q || (x.ad + " " + x.not).toLocaleLowerCase("tr").indexOf(q) !== -1);
  });
  l = l.sort(function (a, b) {
    if (TUM_EV.sira === "gezi") { return b.gez - a.gez || a.ad.localeCompare(b.ad, "tr"); }
    return a.ad.localeCompare(b.ad, "tr");
  });
  const sec = function (k, ad) { return '<button type="button" class="tev-sec' + (TUM_EV.tur === k ? " secili" : "") + '" data-tev-tur="' + k + '" aria-pressed="' + (TUM_EV.tur === k) + '">' + ad + "</button>"; };
  return '<div class="tev-ust"><label class="sr-yalniz" for="tevAra">Evrenlerde ara</label><input type="search" class="arac-giris tev-ara" id="tevAra" placeholder="Evren ara…" value="' + kacir(TUM_EV.ara) + '">' +
      '<label class="sr-yalniz" for="tevSira">Sırala</label><select class="kod-giris tev-sira" id="tevSira"><option value="ad"' + (TUM_EV.sira === "ad" ? " selected" : "") + '>A–Z</option><option value="gezi"' + (TUM_EV.sira === "gezi" ? " selected" : "") + ">En çok gezdiğin</option></select></div>" +
    '<div class="tev-secimler" role="group" aria-label="Evren türü">' + sec("hepsi", "Hepsi") + sec("kanon", "Kanon") + sec("fan", "Fan-made") + sec("test", "Test") + sec("benim", "Senin") + sec("yildiz", "★ Yıldızlı") + "</div>" +
    (l.length ? '<div class="tev-liste">' + l.map(function (x) {
      return '<div class="ana-evren-sar"><button type="button" class="ana-evren ' + x.tur + (x.kilitli ? " kilitli" : "") + '" data-evren-git="' + kacir(x.git) + '"><b class="ana-evren-ad">' + (x.kilitli ? "🔒 " : "") + kacir(x.ad) + "</b>" +
        '<span class="ana-evren-not">' + kacir(x.not || ({ kanon: "kanon", fan: "fan-made", test: "test evreni", benim: "senin" })[x.tur]) + (x.gez ? " · " + x.gez + " kez girdin" : "") + "</span></button>" +
        '<button type="button" class="ana-yildiz' + (x.yildiz ? " acik" : "") + '" data-yildiz="' + kacir(x.git) + '" aria-pressed="' + x.yildiz + '" aria-label="' + kacir((x.yildiz ? "Yıldızı kaldır: " : "Yıldızla: ") + x.ad) + '">' + (x.yildiz ? "★" : "☆") + "</button></div>";
    }).join("") + "</div>" : '<p class="oyun-not">Bu süzgeçte evren yok.</p>');
}

function tumEvrenlerCiz() {
  const a = document.querySelector("#tumEvrenler");
  if (!a) { return; }
  const odak = document.activeElement && document.activeElement.id === "tevAra";
  a.innerHTML = tumEvrenlerHtml();
  if (odak) { const g = a.querySelector("#tevAra"); g.focus(); g.setSelectionRange(g.value.length, g.value.length); }
}

/* ana sayfada "Tüm evrenler" katlı bölümü: evrenlerin altında, kurma kartının üstünde */
if (typeof anaEvrenlerCiz === "function") {
  const eskiAEC33b = anaEvrenlerCiz;
  window.anaEvrenlerCiz = function () {
    const r = eskiAEC33b.apply(this, arguments);
    const alan = document.querySelector("#anaEvrenler");
    const kur = alan && alan.querySelector(".ana-kur");
    if (kur && !alan.querySelector("#tumEvrenlerKutu")) {
      kur.insertAdjacentHTML("beforebegin", '<details class="kesif-daha tev-kutu" id="tumEvrenlerKutu"><summary><span class="kesif-daha-ad">Tüm evrenler</span><span class="kesif-daha-not">ara · süz · sırala · yıldızla</span></summary><div class="kesif-daha-ic" id="tumEvrenler"></div></details>');
      const d = alan.querySelector("#tumEvrenlerKutu");
      d.addEventListener("toggle", function () { if (d.open) { tumEvrenlerCiz(); } });
    }
    return r;
  };
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-tev-tur]");
  if (!b) { return; }
  TUM_EV.tur = b.getAttribute("data-tev-tur"); tumEvrenlerCiz();
});
document.addEventListener("input", function (ev) { if (ev.target && ev.target.id === "tevAra") { TUM_EV.ara = ev.target.value; tumEvrenlerCiz(); } });
document.addEventListener("change", function (ev) { if (ev.target && ev.target.id === "tevSira") { TUM_EV.sira = ev.target.value; tumEvrenlerCiz(); } });

/* gezi sayacı: hangi evrene kaç kez girdin (cihazda) */
window.addEventListener("hashchange", function () {
  const r = typeof rota === "function" ? rota() : location.hash;
  const git = /^#\/ev\/(site|fan|benim)\/[\w-]+$/.test(r) || r === "#/claude" ? r : (r === "#/tomye" ? "#/arsiv" : "");
  if (!git) { return; }
  try { const s = JSON.parse(localStorage.getItem("tf33_gezi_sayac") || "{}"); s[git] = (s[git] || 0) + 1; localStorage.setItem("tf33_gezi_sayac", JSON.stringify(s)); } catch (_) { /* yok */ }
});

/* ==================== 11. okuma ayarları ==================== */
const OKUMA_AYAR_ANAHTAR = "tf33_okuma_ayar";
const OKUMA_VARSAYILAN = { boyut: 100, aralik: 165, sepya: false };

function okumaAyari() { try { return Object.assign({}, OKUMA_VARSAYILAN, JSON.parse(localStorage.getItem(OKUMA_AYAR_ANAHTAR) || "{}")); } catch (_) { return Object.assign({}, OKUMA_VARSAYILAN); } }
function okumaAyarUygula() {
  const a = okumaAyari(), h = document.documentElement;
  h.style.setProperty("--okuma-boyut", (a.boyut / 100).toFixed(2));
  h.style.setProperty("--okuma-aralik", (a.aralik / 100).toFixed(2));
  h.toggleAttribute("data-okuma-sepya", !!a.sepya);
  h.toggleAttribute("data-okuma-ozel", a.boyut !== OKUMA_VARSAYILAN.boyut || a.aralik !== OKUMA_VARSAYILAN.aralik);
}
function okumaAyarKaydet(d) { const a = Object.assign(okumaAyari(), d); try { localStorage.setItem(OKUMA_AYAR_ANAHTAR, JSON.stringify(a)); } catch (_) { /* yok */ } okumaAyarUygula(); return a; }
okumaAyarUygula();

function okumaAyarHtml() {
  const a = okumaAyari();
  return '<details class="okuma-ayar"><summary>Aa · Okuma ayarları</summary><div class="okuma-ayar-ic">' +
    '<label for="okBoyut">Yazı boyutu <b id="okBoyutD">%' + a.boyut + "</b></label>" +
    '<input type="range" id="okBoyut" min="85" max="140" step="5" value="' + a.boyut + '">' +
    '<label for="okAralik">Satır aralığı <b id="okAralikD">' + (a.aralik / 100).toFixed(2) + "</b></label>" +
    '<input type="range" id="okAralik" min="140" max="210" step="5" value="' + a.aralik + '">' +
    '<label class="okuma-sepya"><input type="checkbox" id="okSepya"' + (a.sepya ? " checked" : "") + "> Sepya (göz yormayan kâğıt rengi)</label>" +
    '<button type="button" class="dugme dugme-sade" data-ok-sifirla>Varsayılana dön</button></div></details>';
}
document.addEventListener("input", function (ev) {
  const t = ev.target;
  if (!t || (t.id !== "okBoyut" && t.id !== "okAralik")) { return; }
  const a = okumaAyarKaydet(t.id === "okBoyut" ? { boyut: Number(t.value) } : { aralik: Number(t.value) });
  const d1 = document.querySelector("#okBoyutD"), d2 = document.querySelector("#okAralikD");
  if (d1) { d1.textContent = "%" + a.boyut; } if (d2) { d2.textContent = (a.aralik / 100).toFixed(2); }
});
document.addEventListener("change", function (ev) { if (ev.target && ev.target.id === "okSepya") { okumaAyarKaydet({ sepya: ev.target.checked }); } });
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-ok-sifirla]");
  if (!b) { return; }
  try { localStorage.removeItem(OKUMA_AYAR_ANAHTAR); } catch (_) { /* yok */ }
  okumaAyarUygula();
  const k = b.closest(".okuma-ayar"); if (k) { const o = k.open; k.outerHTML = okumaAyarHtml(); const y = document.querySelector(".okuma-ayar"); if (y) { y.open = o; } }
});
/* Okuma sayfasının başında ve açılan metin pencerelerinde */
function okumaAyarYerlestir() {
  const s = document.querySelector("#sira");
  if (s && !s.hidden && !document.querySelector("#okumaAyarAlan")) {
    const b = s.querySelector(".bolum-basi");
    if (b) { b.insertAdjacentHTML("afterend", '<div id="okumaAyarAlan">' + okumaAyarHtml() + "</div>"); }
  }
}
window.addEventListener("hashchange", function () { setTimeout(okumaAyarYerlestir, 50); });
document.addEventListener("tf-veri-hazir", function () { setTimeout(okumaAyarYerlestir, 50); });

/* ==================== 6. evren doluluğu ==================== */
const DOLULUK_ADIMLARI = [
  ["ad ve özet", function (e) { return String(e.ad || "").trim() && String(e.ozet || "").trim().length >= 40; }, "temel"],
  ["kurallar", function (e) { return (e.kurallar || []).filter(function (x) { return String(x.ad || "").trim(); }).length >= 2; }, "dunya"],
  ["harita", function (e) { return ((e.harita || {}).yerler || []).length >= 3; }, "dunya"],
  ["kişiler", function (e) { return (e.kisiler || []).filter(function (x) { return String(x.ad || "").trim(); }).length >= 3; }, "kisiler"],
  ["tarih", function (e) { return (e.tarih || []).filter(function (x) { return String(x.olay || "").trim(); }).length >= 3; }, "zaman"],
  ["belgeler", function (e) { return (e.belgeler || []).filter(function (x) { return String(x.metin || "").trim(); }).length >= 1; }, "belgeler"],
  ["bağlar", function (e) { return (Array.isArray(e.baglar) ? e.baglar : []).length >= 2; }, "kisiler"],
  ["roman ya da hikâye", function (e) { return !!(e.roman && (e.roman.bolumler || []).length); }, "paylas"]
];

function evrenDoluluk(e) {
  if (!e) { return { oran: 0, eksik: [] }; }
  const dolu = DOLULUK_ADIMLARI.filter(function (a) { try { return !!a[1](e); } catch (_) { return false; } });
  const eksik = DOLULUK_ADIMLARI.filter(function (a) { return dolu.indexOf(a) === -1; });
  return { oran: Math.round(100 * dolu.length / DOLULUK_ADIMLARI.length), eksik: eksik.map(function (a) { return { ad: a[0], adim: a[2] }; }) };
}

function evrenDolulukHtml(e) {
  const d = evrenDoluluk(e);
  const s = d.eksik[0];
  return '<div class="ev-doluluk" role="group" aria-label="Evrenin doluluğu"><div class="ev-doluluk-ust"><b>Evrenin %' + d.oran + "’i dolu</b>" +
    (s ? '<button type="button" class="ic-bag" data-evr-adim="' + s.adim + '">Sıradaki: ' + kacir(s.ad) + " →</button>" : "<span>Tamam: her bölümü dolu ✓</span>") + "</div>" +
    '<span class="svk-cubuk" aria-hidden="true"><i style="width:' + Math.max(3, d.oran) + '%"></i></span></div>';
}

if (typeof evrKurucuHtml === "function") {
  const eskiEKH33 = evrKurucuHtml;
  window.evrKurucuHtml = function (v) {
    const h = eskiEKH33.apply(this, arguments);
    try { return evrenDolulukHtml(v && v.eser) + h; } catch (_) { return h; }
  };
}
