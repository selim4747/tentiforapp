/* Evren haritası araçları ve tür şablonları.

   - Nehir / yol / sınır çizgileri: harita sekmesinde "Nehir / yol" modu; noktalara dokun, "Çizgiyi bitir".
     Çizgiye dokununca seçilir: adı değiştirilir ya da silinir.
   - Ölçek: "10 birim = … km" (birim serbest: km, mil, gün…); haritanın köşesinde çubuk.
   - PNG: haritayı görsel olarak indir.
   - Geçit: bir yer başka bir evrene kapı olur. Okur o yere dokununca "Geçitten geç" ile öbür evrene gider.
   - Okur (başkasının evreninde) haritadaki bir yere dokununca anlatımını görür.
   - Tür şablonları: fantastik, bilimkurgu, su dünyası, buz çağı, karanlık masal. Yalnızca boş alanları doldurur. */

/* ==================== geçit ==================== */

function gecitSecenekleri(haricId) {
  const l = [["#/arsiv", "Tentiforverse (Tömye)"]];
  Object.keys(veri.kanonEvrenleri || {}).forEach(function (id) { l.push(["#/ev/site/" + id, (veri.kanonEvrenleri[id].ad || id.toUpperCase()) + " (kanon)"]); });
  if (veri.e99) { l.push(["#/ev/e99", "E99"]); }
  ((veri.fanEserleri || {}).evrenler || []).forEach(function (e) { if (e.id !== haricId) { l.push(["#/ev/fan/" + e.id, (e.ad || "Fan evreni") + " (fanmade)"]); } });
  fanEserlerim().filter(function (e) { return e.tur === "evren" && !e.e99 && e.id !== haricId && String(e.ad || "").trim(); })
    .forEach(function (e) { l.push(["#/ev/benim/" + e.id, e.ad + " (senin)"]); });
  return l;
}

function gecitAdi(git) {
  const s = gecitSecenekleri(null).find(function (x) { return x[0] === git; });
  return s ? s[1].replace(/ \((kanon|fanmade|senin)\)$/, "") : "başka bir evren";
}

/* okur: haritada bir yere dokununca anlatımı (ve varsa geçidi) */
document.addEventListener("click", function (ev) {
  const g = ev.target.closest && ev.target.closest("#evrenSayfa .evh-kutu .evh-svg:not(.duzenle) [data-evh-yer]");
  if (!g || !EVS) { return; }
  EVS.secili = EVS.secili === g.getAttribute("data-evh-yer") ? null : g.getAttribute("data-evh-yer");
  evrenSayfaCiz();
  const f = document.querySelector("#evrenSayfa .evh-bilgi");
  if (f) { f.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
});

/* ==================== PNG ==================== */

async function haritaPngIndir() {
  /* ekrandakinden değil, temiz çizimden: seçim ve düzenleme işaretleri görselde olmasın */
  const v = evrenSayfaVerisi();
  if (!v) { return; }
  const hv = evrenHaritaVerisi(v);
  const h = hv.duzen || hv.yayin || { yerler: [] };
  const d = document.createElement("div");
  d.innerHTML = evrenHaritaSvg({ yerler: (hv.yayin.yerler || []).concat(hv.duzen && hv.duzen !== hv.yayin ? hv.duzen.yerler : []), renk: h.renk, stil: h.stil,
    cizgiler: ((hv.yayin || {}).cizgiler || []).concat(hv.duzen && hv.duzen !== hv.yayin ? (hv.duzen.cizgiler || []) : []), olcek: h.olcek }, { alfabe: v.eser.alfabe });
  const kopya = d.querySelector("svg");
  if (!kopya) { return; }
  kopya.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  kopya.setAttribute("width", "2000");
  kopya.setAttribute("height", "1400");
  const metin = new XMLSerializer().serializeToString(kopya);
  const img = new Image();
  await new Promise(function (coz, reddet) {
    img.onload = coz; img.onerror = function () { reddet(new Error("Harita çizilemedi")); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(metin);
  });
  const t = document.createElement("canvas");
  t.width = 2000; t.height = 1400;
  const c = t.getContext("2d");
  c.fillStyle = "#fff";
  c.fillRect(0, 0, t.width, t.height);
  c.drawImage(img, 0, 0, t.width, t.height);
  const ad = fanSlug((v.eser && v.eser.ad) || "evren") + "-harita.png";
  const blob = await new Promise(function (coz) { t.toBlob(coz, "image/png"); });
  if (blob) { kartIndir(blob, ad); }
}

/* ==================== olaylar: çizgi, ölçek, geçit ==================== */

document.addEventListener("click", async function (ev) {
  const h = ev.target.closest("[data-evh-cizgi-tur], [data-evh-cizgi-bitir], [data-evh-cizgi-sil], [data-evh-png]");
  if (!h || !EVS) { return; }
  const d = h.dataset;
  if (d.evhCizgiTur) { EVS.cizgiTur = d.evhCizgiTur; evrenSayfaCiz(); return; }
  if (h.hasAttribute("data-evh-cizgi-bitir")) {
    if ((EVS.cizim || []).length < 2) { return; }
    const nok = EVS.cizim.slice();
    const id = "c" + Date.now().toString(36);
    const tur = EVS.cizgiTur || "nehir";
    evrenHaritaDegistir(function (hh) {
      if (!Array.isArray(hh.cizgiler)) { hh.cizgiler = []; }
      hh.cizgiler.push({ id: id, tur: tur, ad: "", noktalar: nok });
    });
    EVS.mod = "sec"; EVS.cizim = []; EVS.seciliCizgi = id; EVS.secili = null;
    evrenSayfaCiz();
    const a = document.querySelector("#evhCizgiAd");
    if (a) { a.focus(); }
    return;
  }
  if (h.hasAttribute("data-evh-cizgi-sil")) {
    const id = EVS.seciliCizgi;
    evrenHaritaDegistir(function (hh) { hh.cizgiler = (hh.cizgiler || []).filter(function (c) { return c.id !== id; }); if (!hh.cizgiler.length) { delete hh.cizgiler; } });
    EVS.seciliCizgi = null;
    evrenSayfaCiz();
    return;
  }
  if (h.hasAttribute("data-evh-png")) {
    h.disabled = true;
    try { await haritaPngIndir(); } catch (e) { if (typeof eckaBildir === "function") { eckaBildir((e && e.message) || "İndirilemedi"); } }
    h.disabled = false;
  }
});

document.addEventListener("change", function (ev) {
  const t = ev.target;
  if (!t || !t.closest || !t.closest("#evrenSayfa") || !EVS) { return; }
  if (t.hasAttribute("data-evh-gecit")) {
    const id = EVS.secili, deger = t.value;
    evrenHaritaDegistir(function (hh) {
      const y = hh.yerler.find(function (x) { return x.id === id; });
      if (!y) { return; }
      if (deger && FAN_GECIT.test(deger)) { y.gecit = deger; } else { delete y.gecit; }
    });
    evrenSayfaCiz();
    return;
  }
  if (t.dataset.evhOlcek) {
    const kutu = t.closest(".evh-olcek-giris");
    const deger = Number((kutu.querySelector('[data-evh-olcek="deger"]') || {}).value);
    const birim = String((kutu.querySelector('[data-evh-olcek="birim"]') || {}).value || "km").trim().slice(0, 12) || "km";
    evrenHaritaDegistir(function (hh) {
      if (isFinite(deger) && deger > 0) { hh.olcek = { deger: Math.round(deger * 100) / 100, birim: birim }; } else { delete hh.olcek; }
    });
    evrenSayfaCiz();
  }
});

document.addEventListener("input", function (ev) {
  const t = ev.target;
  if (!t || !t.matches || !t.matches("#evrenSayfa [data-evh-cizgi-alan]") || !EVS) { return; }
  const id = t.closest("[data-evh-cizgi-form]").getAttribute("data-evh-cizgi-form");
  evrenHaritaDegistir(function (hh) {
    const c = (hh.cizgiler || []).find(function (x) { return x.id === id; });
    if (c) { c.ad = String(t.value).slice(0, 80); }
  });
});

/* ==================== tür şablonları ==================== */

const EVT_TURLER = [
  { id: "fantastik", ad: "Fantastik", ozet: "Büyü, eski krallıklar, unutulmuş diller.",
    kurallar: [["Büyünün bedeli", "büyü", "Her büyü, yapanın bir anısını alır. Güçlü büyücüler çok şey unutmuştur."],
      ["Eski dil", "dil", "Taşlara kazınmış eski dil yüksek sesle okununca uyuyan şeyler uyanır."],
      ["Ölülerin yolu", "ölüm", "Ölenler üç gün boyunca yakınlarının rüyasında yürür, sonra gider."]],
    para: { ad: "gümüş", simge: "◈", kur: 0.1 }, sozluk: [["Ateşdili", "Büyünün yazıldığı eski dil."], ["Kule", "Büyücülerin toplandığı yer; her şehirde bir tane vardır."]],
    ozelAlanlar: [["Mevsimler", "Dört mevsim; kışın büyü zayıflar."]], stil: { ana: "#6B3FA0", font: "serif" }, harita: "kita" },
  { id: "bilimkurgu", ad: "Bilimkurgu", ozet: "Gemiler, istasyonlar, uzak gezegenler.",
    kurallar: [["Işıktan hızlı yol yok", "fizik", "Gemiler yıllarca yol alır; yolcular uyku kapsüllerinde yaşlanmadan bekler."],
      ["İstasyon yasası", "toplum", "Her istasyon kendi yasasını yapar; yasayı hava ve su verenler koyar."],
      ["Yapay akıl", "hafıza", "Gemi akılları kaptanlarını hatırlar; bir kaptanı unutmak onlar için ölümdür."]],
    para: { ad: "kredi", simge: "¢", kur: 0.05 }, sozluk: [["Uyku", "Uzun yolculukta kapsülde geçen zaman."], ["Rıhtım", "İstasyonun gemilerin yanaştığı halkası."]],
    ozelAlanlar: [["Gökyüzü", "İki güneş; biri kızıl, biri beyaz."]], stil: { ana: "#1B7F8C", zemin: "#EEF6F7", font: "mono" }, harita: "iki" },
  { id: "su", ad: "Su dünyası", ozet: "Kıtasız okyanus, yüzen şehirler.",
    kurallar: [["Kara yok", "fizik", "Dünyada kara yoktur; herkes yüzen şehirlerde ya da gemilerde yaşar."],
      ["Akıntılar", "zaman", "Takvim akıntılarla sayılır: büyük akıntı bir yıl, küçük akıntı bir aydır."]],
    para: { ad: "inci", simge: "◌", kur: 0.1 }, sozluk: [["Sal", "Yüzen şehirlerin en küçüğü."], ["Derin", "Işığın ulaşmadığı su; oraya inenler geri dönmez."]],
    ozelAlanlar: [["Hava", "Her akşam kısa bir yağmur yağar."]], stil: { ana: "#1D6FA5", zemin: "#EEF5FB" }, harita: "takimada" },
  { id: "buz", ad: "Buz çağı", ozet: "Donmuş topraklar, sıcak kaynakların etrafında şehirler.",
    kurallar: [["Soğuk", "biyoloji", "Açıkta bir gece geçiren donar; yolculuklar gündüzden gündüze yapılır."],
      ["Sıcak kaynak", "enerji", "Şehirler yalnızca sıcak kaynakların çevresine kurulur; kaynak sönerse şehir göç eder."]],
    para: { ad: "tuz", simge: "", kur: 0.1 }, sozluk: [["Göç", "Kaynağı sönen şehrin yeni kaynak araması."], ["Ak", "Kar fırtınası."]],
    ozelAlanlar: [["Gün", "Gündüzler kısa, geceler uzun."]], stil: { ana: "#3E6A8A", zemin: "#F2F7FB", font: "serif" }, harita: "kita" },
  { id: "masal", ad: "Karanlık masal", ozet: "Ormanlar, lanetler, pazarlık eden varlıklar.",
    kurallar: [["Pazarlık", "büyü", "Ormandaki varlıklar her dileği yerine getirir, karşılığında bir şey ister; asla altın istemezler."],
      ["Ad", "dil", "Birinin gerçek adını bilen ona bir kez emir verebilir."]],
    para: { ad: "düğme", simge: "", kur: 0.1 }, sozluk: [["Eşik", "Köyle orman arasındaki çizgi; gece geçilmez."], ["Yarım", "Pazarlıkta bir şeyini vermiş kişi."]],
    ozelAlanlar: [["Gece", "Geceler iki kat uzundur ve ay hiç doğmaz."]], stil: { ana: "#5A3A2E", zemin: "#F7F2EE", font: "serif" }, harita: "kita" }
];

function evtUygula(id, turId) {
  const t = EVT_TURLER.find(function (x) { return x.id === turId; });
  if (!t) { return; }
  evrenBenimDegistir(id, function (e) {
    const bos = function (l, alan) { return !(l || []).some(function (x) { return x && String(x[alan] || "").trim(); }); };
    if (bos(e.kurallar, "ad") && bos(e.kurallar, "aciklama")) { e.kurallar = t.kurallar.map(function (k) { return { ad: k[0], tur: k[1], aciklama: k[2] }; }); }
    if (bos(e.sozluk, "terim")) { e.sozluk = t.sozluk.map(function (k) { return { terim: k[0], tanim: k[1] }; }); }
    if (bos(e.ozelAlanlar, "ad")) { e.ozelAlanlar = t.ozelAlanlar.map(function (k) { return { ad: k[0], deger: k[1] }; }); }
    if (!e.para || !String(e.para.ad || "").trim()) { e.para = Object.assign({}, t.para); }
    if (!e.stil) { e.stil = Object.assign({}, t.stil); }
    if (!String(e.ozet || "").trim()) { e.ozet = t.ozet; }
    if (!(((e.harita || {}).yerler) || []).length) {
      const s = EVK_SABLONLAR.find(function (x) { return x.id === t.harita; });
      if (s) {
        e.harita = e.harita || {};
        e.harita.yerler = s.yerler.map(function (y, i) {
          const o = { id: "y" + Date.now().toString(36) + i, ad: y.ad, tur: y.tur, not: "", x: y.x, y: y.y };
          if (y.sekil) { o.sekil = y.sekil.map(function (n) { return [n[0], n[1]]; }); }
          return o;
        });
      }
    }
  });
}

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-evt-tur]");
  if (!h || !EVS || EVS.kaynak !== "benim") { return; }
  if (typeof fanBekleyeniYaz === "function") { fanBekleyeniYaz(); }
  evtUygula(EVS.id, h.dataset.evtTur);
  evrenSayfaCiz();
  if (typeof eckaBildir === "function") { eckaBildir("Tür uygulandı: kuralları, sözlüğü ve parayı istediğin gibi değiştir"); }
});
