/* Sitenin haritalarında (Tömye, Claude'un evreni…) nehir, yol ve sınır çizgileri ile ölçek — kendi evren
   haritalarındakiyle aynı veri: harita.cizgiler = [{ id, ad, tur: nehir|yol|sinir, noktalar: [[x, y]] }],
   harita.olcek = { deger, birim }  (koordinatlar sitenin haritasındaki gibi 0–100).
   Yönetici tam ekran haritada "Çizgi" aracıyla çizer, ölçeği yazar; Kaydet ile yayına girer. */

const HE_CIZGI_RENK = { nehir: "#3B7BB8", yol: "#8A6A3E", sinir: "#6B2A2A" };
const HE_CIZGI_AD = { nehir: "Nehir", yol: "Yol", sinir: "Sınır" };

let HE = { cizim: [], tur: "yol", secili: null };

/** Görünen dünya kopyaları (dönen dünyada harita yatayda tekrar eder). */
function heKopyalar(h, w, cx, k) {
  const m = evrenMeta(h);
  const yarim = w / (2 * k), pay = 90 / k;
  return m.donen ? [Math.floor((cx - yarim - pay) / 100), Math.floor((cx + yarim + pay) / 100)] : [0, 0];
}

function heCizgilerSvg(h, w, hh, cx, cy, k) {
  const l = (h.cizgiler || []).filter(function (c) { return c && Array.isArray(c.noktalar) && c.noktalar.length > 1; });
  const taslak = HT.duzen && HT.arac === "cizgi" && HE.cizim.length ? HE.cizim : null;
  if (!l.length && !taslak) { return ""; }
  const t = heKopyalar(h, w, cx, k);
  let s = "";
  for (let i = t[0]; i <= t[1]; i++) {
    s += '<g transform="translate(' + (100 * i) + ' 0)">' + l.map(function (c) {
      const nok = c.noktalar.map(function (n) { return n[0] + "," + n[1]; }).join(" ");
      const sec = HT.duzen && HE.secili === c.id;
      return '<polyline class="hm-cizgi" points="' + nok + '" fill="none" stroke="' + (sec ? "#C0392B" : (HE_CIZGI_RENK[c.tur] || HE_CIZGI_RENK.yol)) + '"' +
        ' stroke-width="' + (c.tur === "nehir" ? 3 : 2) + '" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"' +
        (c.tur === "yol" ? ' stroke-dasharray="7 4"' : (c.tur === "sinir" ? ' stroke-dasharray="2 4"' : "")) + ">" + (c.ad ? "<title>" + kacir(c.ad) + "</title>" : "") + "</polyline>";
    }).join("") +
    (taslak ? '<polyline points="' + taslak.map(function (n) { return n[0] + "," + n[1]; }).join(" ") + '" fill="none" stroke="#C0392B" stroke-width="2" vector-effect="non-scaling-stroke" stroke-dasharray="4 3"></polyline>' : "") +
    "</g>";
  }
  return '<g class="hm-cizgiler" pointer-events="none" transform="translate(' + (w / 2 - cx * k).toFixed(2) + " " + (hh / 2 - cy * k).toFixed(2) + ") scale(" + k.toFixed(4) + ')">' + s + "</g>";
}

/** Ekranın sol altında ölçek çubuğu: uygun uzunlukta (1, 2, 5, 10, 20, 50 birim). */
function heOlcekSvg(h, w, hh, k) {
  const ol = h.olcek;
  if (!ol || !(Number(ol.deger) > 0)) { return ""; }
  const secenek = [1, 2, 5, 10, 20, 50];
  let n = secenek.find(function (x) { return x * k >= 60; }) || 50;
  if (n * k > w * 0.45) { n = secenek.filter(function (x) { return x * k <= w * 0.45; }).pop() || 1; }
  const L = n * k;
  const deger = Math.round(Number(ol.deger) * n / 10 * 100) / 100;
  const yazi = String(deger).replace(".", ",") + " " + (ol.birim || "km");
  return '<g class="hm-olcek" transform="translate(16 ' + (hh - 22) + ')" pointer-events="none">' +
    '<rect x="-6" y="-16" width="' + (L + 12 + Math.max(0, yazi.length * 7 - L)) + '" height="24" rx="5" fill="var(--beyaz,#fff)" opacity="0.8"></rect>' +
    '<path d="M0 -4V2H' + L.toFixed(1) + 'V-4" fill="none" stroke="currentColor" stroke-width="1.6"></path>' +
    '<text x="0" y="-6" font-size="11" font-family="var(--mono,monospace)" fill="currentColor">' + kacir(yazi) + "</text></g>";
}

if (typeof haritaSahne === "function") {
  const eskiSahne = haritaSahne;
  window.haritaSahne = function (h, w, hh, cx, cy, k, sec) {
    const s = eskiSahne.apply(this, arguments);
    const c = heCizgilerSvg(h, w, hh, cx, cy, k);
    const ol = sec && sec.kimlik === "tam" ? heOlcekSvg(h, w, hh, k) : "";
    if (!c && !ol) { return s; }
    /* çizgiler zeminin (kıtalar, gece) üstünde, işaretlerin ve adların altında */
    const im = 'fill="url(#hmKa-' + sec.kimlik + ')"/></g>';
    const i = s.indexOf(im);
    return (i === -1 ? s + c : s.slice(0, i + im.length) + c + s.slice(i + im.length)) + ol;
  };
}

/* ---------- düzenleme: "Çizgi" aracı ---------- */

function heNokta(px, py) {
  const r = HT.kutu.querySelector("#htSahne").getBoundingClientRect();
  const X = HT.cx + (px - r.left - HT.w / 2) / HT.k;
  const Y = HT.cy + (py - r.top - HT.h / 2) / HT.k;
  return [+(HT.donen ? haritaSar(X) : haritaKis(X, 0, 100)).toFixed(2), +haritaKis(Y, 0, 100).toFixed(2)];
}

function heKirli() { if (typeof haritaKirli === "function") { haritaKirli(); } }

if (typeof haritaDuzenCubuguCiz === "function") {
  const eskiCubuk = haritaDuzenCubuguCiz;
  window.haritaDuzenCubuguCiz = function () {
    eskiCubuk.apply(this, arguments);
    const el = HT.kutu && HT.kutu.querySelector("#htDuzen");
    if (!el) { return; }
    el.classList.toggle("he-acik", !el.hidden && HT.arac === "cizgi");
    if (el.hidden) { return; }
    const kaydet = el.querySelector(".kaydet");
    const dugme = '<button type="button" class="hl-oge' + (HT.arac === "cizgi" ? " secili" : "") + '" data-he="arac" aria-pressed="' + (HT.arac === "cizgi") + '">Çizgi</button>';
    if (kaydet) { kaydet.insertAdjacentHTML("beforebegin", dugme); } else { el.insertAdjacentHTML("beforeend", dugme); }
    if (HT.arac !== "cizgi") { return; }
    const h = aktifHarita();
    const l = h.cizgiler || [];
    const sec = l.find(function (c) { return c.id === HE.secili; });
    const ol = h.olcek || {};
    el.insertAdjacentHTML("beforeend", '<div class="he-arac">' +
      Object.keys(HE_CIZGI_AD).map(function (t) { return '<button type="button" class="hl-oge' + (HE.tur === t ? " secili" : "") + '" data-he-tur="' + t + '">' + HE_CIZGI_AD[t] + "</button>"; }).join("") +
      '<button type="button" class="hl-oge kaydet" data-he="bitir"' + (HE.cizim.length < 2 ? " disabled" : "") + ">Bitir (" + HE.cizim.length + ")</button>" +
      (HE.cizim.length ? '<button type="button" class="hl-oge" data-he="vazgec">Vazgeç</button>' : "") +
      (l.length ? '<select class="he-sec" data-he-sec aria-label="Çizgiler"><option value="">Çizgiler (' + l.length + ")</option>" +
        l.map(function (c) { return '<option value="' + kacir(c.id) + '"' + (c.id === HE.secili ? " selected" : "") + ">" + kacir((c.ad || "Adsız") + " · " + (HE_CIZGI_AD[c.tur] || "")) + "</option>"; }).join("") + "</select>" : "") +
      (sec ? '<input class="he-giris" data-he-ad maxlength="80" value="' + kacir(sec.ad || "") + '" placeholder="Adı" aria-label="Çizginin adı"><button type="button" class="hl-oge" data-he="sil">Sil</button>' : "") +
      '<label class="he-olcek">Ölçek: 10 birim = <input class="he-giris" type="number" min="0" step="any" data-he-olcek="deger" value="' + kacir(ol.deger || "") + '" placeholder="?">' +
        '<input class="he-giris he-birim" maxlength="24" data-he-olcek="birim" value="' + kacir(ol.birim || "km") + '" aria-label="Birim"></label>' +
      '<span class="he-not">Haritaya sırayla dokun, sonra Bitir.</span></div>');
  };
}

if (typeof haritaDokun === "function") {
  const eskiDokun = haritaDokun;
  window.haritaDokun = function (px, py) {
    if (HT.duzen && HT.arac === "cizgi" && haritaYonetici()) {
      HE.cizim.push(heNokta(px, py));
      haritaDuzenCubuguCiz();
      haritaCizHemen();
      return;
    }
    return eskiDokun.apply(this, arguments);
  };
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest("#htDuzen [data-he], #htDuzen [data-he-tur]");
  if (!b || !HT.kutu) { return; }
  ev.stopPropagation();
  const h = aktifHarita();
  const ne = b.dataset.he;
  if (b.dataset.heTur) { HE.tur = b.dataset.heTur; }
  else if (ne === "arac") { HT.arac = HT.arac === "cizgi" ? "tasi" : "cizgi"; HE.cizim = []; HE.secili = null; }
  else if (ne === "vazgec") { HE.cizim = []; }
  else if (ne === "bitir" && HE.cizim.length > 1) {
    if (!Array.isArray(h.cizgiler)) { h.cizgiler = []; }
    const id = "c" + Date.now().toString(36);
    h.cizgiler.push({ id: id, ad: "", tur: HE.tur, noktalar: HE.cizim.slice() });
    HE.cizim = []; HE.secili = id;
    heKirli();
    if (typeof haritaToast === "function") { haritaToast(HE_CIZGI_AD[HE.tur] + " eklendi — adını yazabilirsin"); }
  } else if (ne === "sil" && HE.secili) {
    h.cizgiler = (h.cizgiler || []).filter(function (c) { return c.id !== HE.secili; });
    if (!h.cizgiler.length) { delete h.cizgiler; }
    HE.secili = null;
    heKirli();
  }
  haritaDuzenCubuguCiz();
  haritaCizHemen();
  const a = HT.kutu.querySelector("[data-he-ad]");
  if (a && ne === "bitir") { a.focus(); }
}, true);

document.addEventListener("change", function (ev) {
  const t = ev.target;
  if (!t || !t.closest || !t.closest("#htDuzen")) { return; }
  const h = aktifHarita();
  if (t.matches("[data-he-sec]")) { HE.secili = t.value || null; haritaDuzenCubuguCiz(); haritaCizHemen(); return; }
  if (t.matches("[data-he-olcek]")) {
    const ol = Object.assign({}, h.olcek || {});
    if (t.dataset.heOlcek === "deger") { const n = Number(t.value); if (n > 0) { ol.deger = n; } else { delete ol.deger; } }
    else { ol.birim = String(t.value).slice(0, 24); }
    if (ol.deger > 0) { h.olcek = ol; } else { delete h.olcek; }
    heKirli(); haritaCizHemen();
  }
});

document.addEventListener("input", function (ev) {
  const t = ev.target;
  if (!t || !t.matches || !t.matches("#htDuzen [data-he-ad]")) { return; }
  const c = (aktifHarita().cizgiler || []).find(function (x) { return x.id === HE.secili; });
  if (c) { c.ad = String(t.value).slice(0, 80); HT.kirli = HT.kirli || 1; }
});

/* başka araç seçilince yarım çizgi bırakılır */
document.addEventListener("click", function (ev) {
  const b = ev.target.closest('#htDuzen [data-ht="arac"]');
  if (b) { HE.cizim = []; HE.secili = null; }
}, true);
