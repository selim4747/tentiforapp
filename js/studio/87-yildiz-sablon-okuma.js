/* Sürüm 3.3 — Tömye bağlantıları, yıldızlı evrenler, okuma ayarları, evren doluluğu, şablonla başla,
   tüm evrenler süzgeci, Evrengezer yolculuk şablonu. Hepsi cihazda: sunucuya yük yok. */

/* 1. Tömye bağlantıları 3.2.2'de (js/arayuz/86-sade-arayuz.js) */

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

/* ==================== 5. şablonla başla: türler kişi, tarih ve belgeyle gelir ==================== */
if (typeof EVT_TURLER !== "undefined") {
  EVT_TURLER.push(
    { id: "kiyamet", ad: "Kıyamet sonrası", ozet: "Yıkılmış şehirler, kıt su, yeniden kurulan topluluklar.",
      kurallar: [["Su", "kaynak", "Temiz su para yerine geçer; kuyuların yeri sır olarak saklanır."],
        ["Eski dünya", "tarih", "Yıkımdan önceki şeyler kutsal sayılır ama kimse nasıl çalıştıklarını bilmez."]],
      para: { ad: "matara", simge: "", kur: 0.1 }, sozluk: [["Önce", "Yıkımdan önceki dünya."], ["Kül", "Yıkımın bıraktığı, hâlâ tehlikeli bölgeler."]],
      ozelAlanlar: [["Gökyüzü", "Hep sarımsı; güneş nadiren net görünür."]], stil: { ana: "#8A5A2B", zemin: "#F6F1EA" }, harita: "kita" },
    { id: "mitoloji", ad: "Mitoloji", ozet: "Tanrılar, kahramanlar, kehanetler.",
      kurallar: [["Tanrıların payı", "din", "Her hasadın onda biri tanrılara bırakılır; bırakılmazsa kıtlık gelir."],
        ["Kehanet", "kader", "Kehanetler hep doğru çıkar ama hiçbiri söylendiği gibi anlaşılmaz."]],
      para: { ad: "sikke", simge: "", kur: 0.1 }, sozluk: [["Sunak", "Tanrılara adak bırakılan taş."], ["Kâhin", "Kehanetleri dile getiren kişi."]],
      ozelAlanlar: [["Takvim", "Yıl, tanrıların on iki şölenine göre sayılır."]], stil: { ana: "#9A6B12", zemin: "#FAF5EA", font: "serif" }, harita: "takimada" }
  );
}

const EVT_DERIN = {
  _genel: {
    kisiler: [["Anlatıcı", "tanık", "Olayların çoğunu gören ama hiçbirine karışmayan biri."], ["Kurucu", "ata", "Bu dünyanın ilk düzenini kuran kişi; adı her yerde anılır."], ["Yabancı", "gelen", "Başka bir yerden gelen ve her şeyi değiştiren kişi."]],
    tarih: [["0", "Kuruluş", "Dünyanın bilinen düzeni kurulur."], ["120", "Bölünme", "İlk büyük kavga: topluluk ikiye ayrılır."], ["300", "Bugün", "Hikâyelerin geçtiği zaman."]],
    belgeler: [["Mektup", "İlk mektup", "Anlatıcı", "Kurucu", "Buraya geldiğimizde hiçbir şey yoktu. Şimdi her şey var ve hiçbirinin sahibi yok."]]
  },
  fantastik: { kisiler: [["Yaşlı büyücü", "öğretmen", "Çok büyü yaptığı için adını unutmuş; herkes ona Usta der."], ["Genç kraliçe", "hükümdar", "Tahta erken çıktı; eski dili okuyabilen son kişi."], ["Kule bekçisi", "koruyucu", "Kulenin kapısını yüz yıldır aynı aile korur."]] },
  bilimkurgu: { kisiler: [["Kaptan", "gemi", "Uykudan her uyandığında dünyayı biraz daha yabancı bulur."], ["Gemi aklı", "yapay akıl", "Yedi kaptan tanıdı; hepsini hatırlıyor."], ["İstasyon yöneticisi", "yönetim", "Havayı ve suyu dağıtan kişi, yani yasanın ta kendisi."]] },
  kiyamet: { kisiler: [["Kuyu bilen", "rehber", "Temiz kuyuların yerini bilen son kişi."], ["Önceci", "bilge", "Yıkımdan önceki dünyayı hatırladığını söyler."], ["Kervan başı", "tüccar", "Su ve haber taşır, ikisini de pahalıya satar."]] },
  mitoloji: { kisiler: [["Kâhin", "kehanet", "Kehaneti söyler ama anlamını bilmez."], ["Yarı tanrı", "kahraman", "Annesi tanrıça, babası çoban; iki dünyaya da ait değil."], ["Unutulan tanrı", "tanrı", "Adına sunak kalmamış; yine de dinliyor."]] }
};

if (typeof evtUygula === "function") {
  const eskiEvtUygula33 = evtUygula;
  window.evtUygula = function (id, turId) {
    const r = eskiEvtUygula33.apply(this, arguments);
    const d = Object.assign({}, EVT_DERIN._genel, EVT_DERIN[turId] || {});
    evrenBenimDegistir(id, function (e) {
      const bos = function (l, alan) { return !(l || []).some(function (x) { return x && String(x[alan] || "").trim(); }); };
      if (bos(e.kisiler, "ad")) { e.kisiler = d.kisiler.map(function (k) { return { ad: k[0], rol: k[1], aciklama: k[2] }; }); }
      if (bos(e.tarih, "olay")) { e.tarih = d.tarih.map(function (k) { return { zaman: k[0], cag: k[1], olay: k[2] }; }); }
      if (bos(e.belgeler, "metin")) { e.belgeler = d.belgeler.map(function (k) { return { tur: k[0], baslik: k[1], kimden: k[2], kime: k[3], metin: k[4] }; }); }
    });
    return r;
  };
}

/* Kurucu'nun ilk adımında da tür seçimi (boş evrende) */
if (typeof evrKurucuHtml === "function") {
  const eskiEKH33b = evrKurucuHtml;
  window.evrKurucuHtml = function (v) {
    const h = eskiEKH33b.apply(this, arguments);
    const e = v && v.eser;
    if (!e || typeof EVT_TURLER === "undefined" || h.indexOf("data-evt-tur") !== -1) { return h; }
    if ((typeof EVR_ADIM !== "undefined" ? EVR_ADIM[e.id] || "temel" : "temel") !== "temel") { return h; }
    const bos = !(e.kurallar || []).some(function (x) { return x && String(x.ad || "").trim(); }) && !(e.kisiler || []).some(function (x) { return x && String(x.ad || "").trim(); });
    if (!bos) { return h; }
    return h + '<div class="evt-turler"><span class="oyun-not">Şablonla başla: kurallar, kişiler, tarih, belge ve harita gelir; yalnızca boş alanları doldurur, hepsini sonra değiştirirsin.</span>' +
      EVT_TURLER.map(function (t) { return '<button class="evt-tur" data-evt-tur="' + t.id + '"><b>' + kacir(t.ad) + "</b><small>" + kacir(t.ozet) + "</small></button>"; }).join("") + "</div>";
  };
}

/* ==================== 9. Evrengezer yolculuk şablonu ==================== */
function yolculukIskeleti(kisi, evren) {
  const ad = (kisi && kisi.ad) || "Evrengezer", yer = evren || "yeni bir evren";
  return "1. Kapı\n" + ad + " E25’in sisinde bir kapının aralandığını görür. Kapının öbür yanından " + yer + "’in kokusu gelir: …\n\n" +
    "2. Varış\n" + ad + " " + yer + "’e adım atar. İlk gördüğü şey …; kimse onun başka bir evrenden geldiğini bilmiyor.\n\n" +
    "3. Kural\n" + yer + "’in bir kuralı " + ad + "’ın bildiği her şeye ters düşer: …\n\n" +
    "4. Karşılaşma\n" + ad + " burada biriyle tanışır: … Onun istediği şey: …\n\n" +
    "5. Bedel\nGeri dönmek için " + ad + " bir şeyini burada bırakmak zorunda: …\n\n" +
    "6. Dönüş\nE25’e döndüğünde pasaportunda yeni bir damga var: " + yer + ". Ama yanında getirdiği şey …";
}

if (typeof kisiGotur === "function") {
  const eskiKG33 = kisiGotur;
  window.kisiGotur = function (kisi, hedef) {
    const r = eskiKG33.apply(this, arguments);
    if (r && r.id && /^yeni-hikaye@/.test(String(hedef || ""))) {
      const l = fanEserlerim(), h = l.find(function (x) { return x.id === r.id; });
      if (h && !String(h.metin || "").trim()) {
        h.metin = yolculukIskeleti(kisi, String(hedef).slice("yeni-hikaye@".length) || h.evren);
        if (!String(h.baslik || "").trim()) { h.baslik = ((kisi && kisi.ad) || "Evrengezer") + "’ın yolculuğu"; }
        fanEserlerimYaz(l);
      }
    }
    return r;
  };
}
