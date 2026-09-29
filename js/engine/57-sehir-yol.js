/* Şehir haritaları ve kişilerin gezi çizelgesi.

   Şehir haritası: bir yerin (şehir, köy, ada, üs…) kendi planı. Dünya haritasının aksine binalar vardır:
   türüne göre renklenen binalar (ev, kule, tapınak, pazar, han, kütüphane, liman…), caddeler ve sokaklar,
   park, su, meydan ve sur alanları. Bütün evrenlerde: kendi evreninde, E99 katkında, sitedeki kanon
   evrenlerde (yönetici) ve Tömye'nin haritasında (yönetici düzenler, herkes görür).
   Veri: yer.sehir = { binalar: [{id, ad, tur, x, y, en, boy, not}], sokaklar: [{id, ad, tur, noktalar}],
   alanlar: [{id, ad, tur, sekil}] } — koordinatlar x 0–100, y 0–70.

   Gezi çizelgesi: kendi evrenindeki bir kişinin yerden yere yolu. Harita sekmesinde kişiyi seç,
   "Haritada yol çiz" ile yerlere sırayla dokun; her adıma zaman ve not yazılır; gezegenler arası da olur.
   Veri: kisi.yol = [{ g: gezegen ("" ana), yer, zaman, not }]. Okurlar yolu ve çizelgeyi görür. */

const BINA_TURLERI = {
  ev: ["Ev", "#D9C3A5"], konak: ["Konak", "#C9A27E"], kule: ["Kule", "#9C8F80"], tapinak: ["Tapınak", "#E7D48A"],
  pazar: ["Pazar", "#E6A66B"], han: ["Han", "#C98C6B"], kutuphane: ["Kütüphane", "#8FA9C9"], liman: ["Liman", "#7FA7B8"],
  kisla: ["Kışla", "#A08C8C"], atolye: ["Atölye", "#B8A47E"], okul: ["Okul", "#A9C48F"], saray: ["Saray", "#D8B4D8"],
  sifahane: ["Şifahane", "#E9B7B7"], diger: ["Diğer", "#CCCCCC"]
};
const SOKAK_TURLERI = { cadde: "Cadde", sokak: "Sokak" };
const ALAN_TURLERI = { park: ["Park", "#BCD9A6"], su: ["Su", "#9CC7E6"], meydan: ["Meydan", "#EADFC6"], sur: ["Sur", "none"] };

/* ==================== veri ==================== */

function shSayi(v, en, boy) { const n = Number(v); return isFinite(n) ? Math.max(en, Math.min(boy, Math.round(n * 100) / 100)) : en; }
function shNok(n) { return [shSayi(n && n[0], 0, 100), shSayi(n && n[1], 0, 70)]; }
function shMetin(v, n) { return String(v == null ? "" : v).slice(0, n); }
function shId(v, yedek) { return shMetin(v, 40).replace(/[^\w-]/g, "") || yedek; }

/** Dosyadan gelen şehir haritasını sınırlar; boşsa null. */
function sehirTemizle(s) {
  if (!s || typeof s !== "object") { return null; }
  const o = {
    binalar: (Array.isArray(s.binalar) ? s.binalar : []).slice(0, 300).map(function (b, i) {
      if (!b || typeof b !== "object") { return null; }
      return { id: shId(b.id, "b" + i), ad: shMetin(b.ad, 60), tur: BINA_TURLERI[b.tur] ? b.tur : "diger",
        x: shSayi(b.x, 0, 100), y: shSayi(b.y, 0, 70), en: b.en == null ? 4 : shSayi(b.en, 1, 40), boy: b.boy == null ? 3 : shSayi(b.boy, 1, 40), not: shMetin(b.not, 1000) };
    }).filter(Boolean),
    sokaklar: (Array.isArray(s.sokaklar) ? s.sokaklar : []).slice(0, 150).map(function (k, i) {
      if (!k || !Array.isArray(k.noktalar) || k.noktalar.length < 2) { return null; }
      return { id: shId(k.id, "s" + i), ad: shMetin(k.ad, 60), tur: SOKAK_TURLERI[k.tur] ? k.tur : "sokak", noktalar: k.noktalar.slice(0, 100).map(shNok) };
    }).filter(Boolean),
    alanlar: (Array.isArray(s.alanlar) ? s.alanlar : []).slice(0, 80).map(function (a, i) {
      if (!a || !Array.isArray(a.sekil) || a.sekil.length < 3) { return null; }
      return { id: shId(a.id, "a" + i), ad: shMetin(a.ad, 60), tur: ALAN_TURLERI[a.tur] ? a.tur : "park", sekil: a.sekil.slice(0, 100).map(shNok) };
    }).filter(Boolean)
  };
  return o.binalar.length || o.sokaklar.length || o.alanlar.length ? o : null;
}

const GZ_SINIR = 365;   /* bir yıl boyunca her gün bir adım */

function yolTemizle(l) {
  return (Array.isArray(l) ? l : []).slice(0, GZ_SINIR).map(function (a) {
    if (!a || typeof a !== "object") { return null; }
    const yer = shId(a.yer, "");
    if (!yer) { return null; }
    const o = { g: shId(a.g, ""), yer: yer, zaman: shMetin(a.zaman, 60), not: shMetin(a.not, 300) };
    const gun = Math.round(Number(a.gun));
    if (gun >= 1 && gun <= 99999) { o.gun = gun; }
    return o;
  }).filter(Boolean);
}

/* kişilerin yolu: fanTemizle kişileri alan alan kurar; yolu buradan eklenir (aynı sıra) */
if (typeof evrenEkTemizle === "function") {
  const eskiEk = evrenEkTemizle;
  window.evrenEkTemizle = function (ham, e) {
    eskiEk.apply(this, arguments);
    (Array.isArray(ham.kisiler) ? ham.kisiler : []).slice(0, 120).forEach(function (k, i) {
      const y = yolTemizle(k && k.yol);
      if (y.length && e.kisiler && e.kisiler[i]) { e.kisiler[i].yol = y; }
      const c = gzCanliTemizle(k && k.canli);
      if (c && e.kisiler && e.kisiler[i]) { e.kisiler[i].canli = c; }
    });
    const st = ham.saat && typeof ham.saat === "object" ? ham.saat : null;
    if (st && Number(st.gunSaat) > 0) {
      e.saat = { gunSaat: Math.min(10000, Math.max(0.1, Math.round(Number(st.gunSaat) * 100) / 100)) };
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(st.baslangic || ""))) { e.saat.baslangic = st.baslangic; }
    }
  };
}

/* ==================== şehir haritası: çizim ==================== */

function sehirSvg(s, o) {
  o = o || {};
  const esc = function (x) { return String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };
  const nok = function (l) { return l.map(function (n) { return n[0] + "," + n[1]; }).join(" "); };
  const sec = o.secili || {};
  const izgara = [10, 20, 30, 40, 50, 60, 70, 80, 90].map(function (x) { return '<line x1="' + x + '" y1="0" x2="' + x + '" y2="70"></line>'; }).join("") +
    [10, 20, 30, 40, 50, 60].map(function (y) { return '<line x1="0" y1="' + y + '" x2="100" y2="' + y + '"></line>'; }).join("");
  const alanlar = (s.alanlar || []).map(function (a) {
    const t = ALAN_TURLERI[a.tur] || ALAN_TURLERI.park;
    const s2 = sec.tur === "alan" && sec.id === a.id;
    return '<polygon data-sh-alan="' + esc(a.id) + '" points="' + nok(a.sekil) + '" fill="' + t[1] + '"' +
      (a.tur === "sur" ? ' stroke="#5B4A36" stroke-width="1.1" stroke-linejoin="round"' : ' stroke="' + (s2 ? "#A33" : "rgba(0,0,0,.18)") + '" stroke-width="' + (s2 ? 0.5 : 0.2) + '"') + ">" +
      (a.ad ? "<title>" + esc(a.ad) + "</title>" : "") + "</polygon>";
  }).join("");
  const sokaklar = (s.sokaklar || []).map(function (k) {
    const g = k.tur === "cadde" ? 1.8 : 1;
    const s2 = sec.tur === "sokak" && sec.id === k.id;
    return '<g data-sh-sokak="' + esc(k.id) + '">' + (k.ad ? "<title>" + esc(k.ad) + "</title>" : "") +
      '<polyline points="' + nok(k.noktalar) + '" fill="none" stroke="' + (s2 ? "#A33" : "#BFB39A") + '" stroke-width="' + (g + 0.5) + '" stroke-linecap="round" stroke-linejoin="round"></polyline>' +
      '<polyline points="' + nok(k.noktalar) + '" fill="none" stroke="#FBF8F1" stroke-width="' + g + '" stroke-linecap="round" stroke-linejoin="round"></polyline>' +
      '<polyline points="' + nok(k.noktalar) + '" fill="none" stroke="transparent" stroke-width="4"></polyline></g>';
  }).join("");
  const binalar = (s.binalar || []).map(function (b) {
    const t = BINA_TURLERI[b.tur] || BINA_TURLERI.diger;
    const s2 = sec.tur === "bina" && sec.id === b.id;
    const x = b.x - b.en / 2, y = b.y - b.boy / 2;
    const fs = Math.max(1.3, Math.min(2.2, Math.min(b.en, b.boy) * 0.55));
    return '<g class="sh-bina" data-sh-bina="' + esc(b.id) + '">' + "<title>" + esc((b.ad ? b.ad + " · " : "") + t[0]) + "</title>" +
      '<rect x="' + (x + 0.35) + '" y="' + (y + 0.35) + '" width="' + b.en + '" height="' + b.boy + '" fill="rgba(60,45,30,.25)"></rect>' +
      '<rect x="' + x + '" y="' + y + '" width="' + b.en + '" height="' + b.boy + '" fill="' + t[1] + '" stroke="' + (s2 ? "#A33" : "#5B4A36") + '" stroke-width="' + (s2 ? 0.45 : 0.22) + '" rx="0.3"></rect>' +
      '<text x="' + b.x + '" y="' + (b.y + fs * 0.35) + '" text-anchor="middle" font-size="' + fs + '" font-family="ui-monospace,monospace" fill="#3A2E22">' + esc(t[0].charAt(0)) + "</text>" +
      (b.ad ? '<text x="' + b.x + '" y="' + (y - 0.8) + '" text-anchor="middle" font-size="1.9" font-family="Georgia,serif" fill="#1D2530" stroke="#FBF8F1" stroke-width="0.45" paint-order="stroke">' + esc(b.ad) + "</text>" : "") +
      "</g>";
  }).join("");
  const etiketler = (s.sokaklar || []).filter(function (k) { return k.ad; }).map(function (k) {
    const n = k.noktalar[Math.floor(k.noktalar.length / 2)];
    return '<text x="' + n[0] + '" y="' + (n[1] - 1.2) + '" text-anchor="middle" font-size="1.7" font-style="italic" font-family="Georgia,serif" fill="#5B4A36" stroke="#FBF8F1" stroke-width="0.4" paint-order="stroke">' + esc(k.ad) + "</text>";
  }).join("") + (s.alanlar || []).filter(function (a) { return a.ad; }).map(function (a) {
    const cx = a.sekil.reduce(function (t, n) { return t + n[0]; }, 0) / a.sekil.length, cy = a.sekil.reduce(function (t, n) { return t + n[1]; }, 0) / a.sekil.length;
    return '<text x="' + cx.toFixed(1) + '" y="' + cy.toFixed(1) + '" text-anchor="middle" font-size="2" font-family="Georgia,serif" fill="#3A5530" opacity="0.85">' + esc(a.ad) + "</text>";
  }).join("");
  const taslak = (o.cizim && o.cizim.length)
    ? '<polyline points="' + nok(o.cizim) + '" fill="none" stroke="#A33" stroke-width="0.4" stroke-dasharray="1 0.5"></polyline>' +
      o.cizim.map(function (n) { return '<circle cx="' + n[0] + '" cy="' + n[1] + '" r="0.6" fill="#A33"></circle>'; }).join("") : "";
  return '<svg class="sh-svg' + (o.duzenle ? " duzenle" : "") + '" viewBox="0 0 100 70" role="img" aria-label="Şehir haritası" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="0" y="0" width="100" height="70" fill="#EFE6D2"></rect>' +
    '<g stroke="#D8CBB0" stroke-width="0.1">' + izgara + "</g>" + alanlar + sokaklar + binalar + etiketler + taslak + "</svg>";
}

/* ==================== şehir haritası: pencere ==================== */

let SH = null;   /* { ad, sehir, salt, kaydet(fn), mod: sec|bina|sokak|alan, binaTur, sokakTur, alanTur, secili: {tur,id}, cizim: [], surukle } */

function sehirAc(ad, sehir, salt, kaydet) {
  SH = { ad: ad || "Şehir", sehir: JSON.parse(JSON.stringify(sehir || { binalar: [], sokaklar: [], alanlar: [] })), salt: !!salt, kaydet: kaydet,
    mod: "sec", binaTur: "ev", sokakTur: "sokak", alanTur: "park", secili: null, cizim: [] };
  ["binalar", "sokaklar", "alanlar"].forEach(function (k) { if (!Array.isArray(SH.sehir[k])) { SH.sehir[k] = []; } });
  if (!salt && !SH.sehir.binalar.length && !SH.sehir.sokaklar.length && !SH.sehir.alanlar.length) { SH.mod = "bina"; }
  sehirCiz();
}

function sehirKapat() {
  const s = document.querySelector("#sehirSayfa");
  if (s) { s.remove(); }
  SH = null;
  /* altta kalan sayfa düğmesini tazelesin ("çiz" → "düzenle") */
  if (typeof EVS !== "undefined" && EVS && document.querySelector("#evrenSayfa") && typeof evrenSayfaCiz === "function") { evrenSayfaCiz(); }
  try { if (typeof HT !== "undefined" && HT.kutu && HT.acik) { haritaBilgiCiz(); } } catch (_) { /* harita kapalı */ }
}

function sehirDegisti() {
  if (SH && !SH.salt && typeof SH.kaydet === "function") { SH.kaydet(sehirTemizle(SH.sehir)); }
}

function sehirSecilen() {
  if (!SH || !SH.secili) { return null; }
  const l = SH.sehir[{ bina: "binalar", sokak: "sokaklar", alan: "alanlar" }[SH.secili.tur]] || [];
  return l.find(function (x) { return x.id === SH.secili.id; }) || null;
}

function sehirFormu() {
  const x = sehirSecilen();
  if (!x) { return ""; }
  const t = SH.secili.tur;
  if (SH.salt) {
    const tad = t === "bina" ? (BINA_TURLERI[x.tur] || BINA_TURLERI.diger)[0] : (t === "sokak" ? SOKAK_TURLERI[x.tur] : ALAN_TURLERI[x.tur][0]);
    return '<div class="kutu-y sh-bilgi"><b>' + kacir(x.ad || tad) + '</b> <span class="oyun-not">' + kacir(tad) + "</span>" + (x.not ? paragraf(x.not) : "") + "</div>";
  }
  const secenek = function (l, v) { return Object.keys(l).map(function (k) { return '<option value="' + k + '"' + (k === v ? " selected" : "") + ">" + kacir(Array.isArray(l[k]) ? l[k][0] : l[k]) + "</option>"; }).join(""); };
  return '<div class="kutu-y sh-bilgi">' +
    '<label for="shAd">Adı</label><input class="kod-giris arac-giris" id="shAd" data-sh-alan="ad" maxlength="60" value="' + kacir(x.ad) + '" placeholder="Adsız">' +
    '<label for="shTur">Türü</label><select class="kod-giris arac-giris" id="shTur" data-sh-alan="tur">' +
      secenek(t === "bina" ? BINA_TURLERI : (t === "sokak" ? SOKAK_TURLERI : ALAN_TURLERI), x.tur) + "</select>" +
    (t === "bina" ? '<div class="sh-cift"><label>Genişlik<input class="kod-giris" type="number" min="1" max="40" step="0.5" data-sh-alan="en" value="' + x.en + '"></label>' +
        '<label>Derinlik<input class="kod-giris" type="number" min="1" max="40" step="0.5" data-sh-alan="boy" value="' + x.boy + '"></label></div>' +
        '<label for="shNot">Anlatım</label><textarea class="kod-giris arac-giris" id="shNot" data-sh-alan="not" rows="2" maxlength="1000">' + kacir(x.not) + "</textarea>" : "") +
    '<button class="dugme dugme-sade y-sil" data-sh-sil>Sil</button></div>';
}

function sehirCiz() {
  if (!SH) { return; }
  let s = document.querySelector("#sehirSayfa");
  if (!s) {
    s = document.createElement("div");
    s.id = "sehirSayfa";
    s.className = "sehir-sayfa";
    s.setAttribute("role", "dialog");
    s.setAttribute("aria-modal", "true");
    document.body.appendChild(s);
  }
  s.setAttribute("aria-label", SH.ad + " şehir haritası");
  const mod = function (id, ad) { return '<button class="evg-cip' + (SH.mod === id ? " secili" : "") + '" data-sh-mod="' + id + '">' + ad + "</button>"; };
  const cip = function (veri2, secili, attr) {
    return Object.keys(veri2).map(function (k) {
      const v = veri2[k];
      return '<button class="evg-cip sh-tur' + (secili === k ? " secili" : "") + '" ' + attr + '="' + k + '">' +
        (Array.isArray(v) && v[1] !== "none" ? '<span class="sh-renk" style="background:' + v[1] + '"></span>' : "") + kacir(Array.isArray(v) ? v[0] : v) + "</button>";
    }).join("");
  };
  const b = SH.sehir;
  const bos = !b.binalar.length && !b.sokaklar.length && !b.alanlar.length;
  s.innerHTML =
    '<div class="evs-ust"><button class="evs-ikon" data-sh-kapat aria-label="Kapat" title="Kapat"><span aria-hidden="true">←</span></button>' +
      '<div class="evs-baslik"><span class="evs-rozet">Şehir haritası' + (SH.salt ? "" : " · düzenliyorsun") + "</span><h2>" + kacir(SH.ad) + "</h2></div>" +
      '<button class="evs-ikon evs-ikon-yazi" data-sh-png aria-label="PNG indir" title="PNG indir"><span aria-hidden="true">⤓</span><span class="evs-ikon-ad">PNG</span></button></div>' +
    '<div class="sh-govde">' +
    (SH.salt ? "" : '<div class="sh-arac">' + mod("sec", "Seç / taşı") + mod("bina", "+ Bina") + mod("sokak", "Cadde / sokak") + mod("alan", "Alan") + "</div>" +
      (SH.mod === "bina" ? '<div class="sh-turler">' + cip(BINA_TURLERI, SH.binaTur, "data-sh-bina-tur") + "</div>" : "") +
      (SH.mod === "sokak" ? '<div class="sh-turler">' + cip(SOKAK_TURLERI, SH.sokakTur, "data-sh-sokak-tur") +
        '<button class="dugme" data-sh-bitir' + (SH.cizim.length < 2 ? " disabled" : "") + ">Bitir (" + SH.cizim.length + " nokta)</button>" + "</div>" : "") +
      (SH.mod === "alan" ? '<div class="sh-turler">' + cip(ALAN_TURLERI, SH.alanTur, "data-sh-alan-tur") +
        '<button class="dugme" data-sh-bitir' + (SH.cizim.length < 3 ? " disabled" : "") + ">Bitir (" + SH.cizim.length + " nokta)</button>" + "</div>" : "") +
      '<p class="oyun-not">' + ({ sec: "Binaya, caddeye ya da alana dokun: seç. Binayı basılı tutup sürükle: taşı.",
        bina: "Türü seç, sonra haritada binanın yerine dokun.", sokak: "Caddenin geçtiği yerlere sırayla dokun, sonra Bitir.",
        alan: "Parkın, suyun, meydanın ya da surun köşelerine dokun (en az 3), sonra Bitir." })[SH.mod] + "</p>") +
    '<div class="sh-kutu">' + sehirSvg(b, { duzenle: !SH.salt, secili: SH.secili, cizim: SH.cizim }) + "</div>" +
    (bos ? '<p class="oyun-not">' + (SH.salt ? "Bu şehrin haritası henüz boş." : "Boş bir şehir: önce birkaç cadde çiz, sonra kenarlarına binalar diz.") + "</p>" : "") +
    sehirFormu() +
    '<div class="sh-lejant">' + Object.keys(BINA_TURLERI).filter(function (k) { return b.binalar.some(function (x) { return x.tur === k; }); }).map(function (k) {
      return '<span><i style="background:' + BINA_TURLERI[k][1] + '"></i>' + kacir(BINA_TURLERI[k][0]) + " (" + b.binalar.filter(function (x) { return x.tur === k; }).length + ")</span>";
    }).join("") + "</div>" +
    "</div>";
}

function sehirNokta(svg, ev) {
  const r = svg.getBoundingClientRect();
  return [Math.round(Math.max(0, Math.min(100, (ev.clientX - r.left) / r.width * 100)) * 100) / 100,
    Math.round(Math.max(0, Math.min(70, (ev.clientY - r.top) / r.height * 70)) * 100) / 100];
}

document.addEventListener("pointerdown", function (ev) {
  const svg = ev.target.closest && ev.target.closest("#sehirSayfa .sh-svg");
  if (!svg || !SH) { return; }
  const n = sehirNokta(svg, ev);
  const bina = ev.target.closest("[data-sh-bina]"), sokak = ev.target.closest("[data-sh-sokak]"), alan = ev.target.closest("[data-sh-alan]");
  if (SH.salt) {
    SH.secili = bina ? { tur: "bina", id: bina.getAttribute("data-sh-bina") } : (sokak ? { tur: "sokak", id: sokak.getAttribute("data-sh-sokak") } : (alan ? { tur: "alan", id: alan.getAttribute("data-sh-alan") } : null));
    sehirCiz();
    return;
  }
  if (SH.mod === "sokak" || SH.mod === "alan") { SH.cizim.push(n); sehirCiz(); return; }
  if (SH.mod === "bina") {
    const id = "b" + Date.now().toString(36);
    SH.sehir.binalar.push({ id: id, ad: "", tur: SH.binaTur, x: n[0], y: n[1], en: SH.binaTur === "ev" ? 4 : 6, boy: SH.binaTur === "ev" ? 3 : 4.5, not: "" });
    SH.secili = { tur: "bina", id: id };
    sehirDegisti();
    sehirCiz();
    return;
  }
  if (bina) {
    const id = bina.getAttribute("data-sh-bina");
    const b = SH.sehir.binalar.find(function (x) { return x.id === id; });
    SH.secili = { tur: "bina", id: id };
    if (b) {
      SH.surukle = { id: id, bas: n, nokta: [b.x, b.y], oynadi: false };
      try { svg.setPointerCapture(ev.pointerId); } catch (_) { /* yok */ }
      ev.preventDefault();
    }
    sehirCiz();
    return;
  }
  SH.secili = sokak ? { tur: "sokak", id: sokak.getAttribute("data-sh-sokak") } : (alan ? { tur: "alan", id: alan.getAttribute("data-sh-alan") } : null);
  sehirCiz();
});

document.addEventListener("pointermove", function (ev) {
  if (!SH || !SH.surukle) { return; }
  const svg = document.querySelector("#sehirSayfa .sh-svg");
  if (!svg) { return; }
  const n = sehirNokta(svg, ev);
  const s = SH.surukle;
  const dx = n[0] - s.bas[0], dy = n[1] - s.bas[1];
  if (!s.oynadi && Math.abs(dx) + Math.abs(dy) < 0.6) { return; }
  s.oynadi = true;
  const b = SH.sehir.binalar.find(function (x) { return x.id === s.id; });
  if (!b) { return; }
  b.x = Math.round(Math.max(0, Math.min(100, s.nokta[0] + dx)) * 100) / 100;
  b.y = Math.round(Math.max(0, Math.min(70, s.nokta[1] + dy)) * 100) / 100;
  const g = svg.querySelector('g[data-sh-bina="' + CSS.escape(b.id) + '"]');
  if (g) { g.setAttribute("transform", "translate(" + (b.x - s.nokta[0]) + "," + (b.y - s.nokta[1]) + ")"); }
});

document.addEventListener("pointerup", function () {
  if (!SH || !SH.surukle) { return; }
  const oynadi = SH.surukle.oynadi;
  SH.surukle = null;
  if (oynadi) { sehirDegisti(); }
  sehirCiz();
});

document.addEventListener("click", async function (ev) {
  const h = ev.target.closest("[data-sh-kapat], [data-sh-mod], [data-sh-bina-tur], [data-sh-sokak-tur], [data-sh-alan-tur], [data-sh-bitir], [data-sh-sil], [data-sh-png]");
  if (!h || !SH) { return; }
  const d = h.dataset;
  if (h.hasAttribute("data-sh-kapat")) { sehirKapat(); return; }
  if (d.shMod) { SH.mod = d.shMod; SH.cizim = []; if (d.shMod !== "sec") { SH.secili = null; } sehirCiz(); return; }
  if (d.shBinaTur) { SH.binaTur = d.shBinaTur; sehirCiz(); return; }
  if (d.shSokakTur) { SH.sokakTur = d.shSokakTur; sehirCiz(); return; }
  if (d.shAlanTur) { SH.alanTur = d.shAlanTur; sehirCiz(); return; }
  if (h.hasAttribute("data-sh-bitir")) {
    const id = (SH.mod === "sokak" ? "s" : "a") + Date.now().toString(36);
    if (SH.mod === "sokak" && SH.cizim.length >= 2) { SH.sehir.sokaklar.push({ id: id, ad: "", tur: SH.sokakTur, noktalar: SH.cizim.slice() }); SH.secili = { tur: "sokak", id: id }; }
    else if (SH.mod === "alan" && SH.cizim.length >= 3) { SH.sehir.alanlar.push({ id: id, ad: "", tur: SH.alanTur, sekil: SH.cizim.slice() }); SH.secili = { tur: "alan", id: id }; }
    else { return; }
    SH.cizim = []; SH.mod = "sec";
    sehirDegisti();
    sehirCiz();
    const a = document.querySelector("#shAd"); if (a) { a.focus(); }
    return;
  }
  if (h.hasAttribute("data-sh-sil") && SH.secili) {
    const k = { bina: "binalar", sokak: "sokaklar", alan: "alanlar" }[SH.secili.tur];
    SH.sehir[k] = SH.sehir[k].filter(function (x) { return x.id !== SH.secili.id; });
    SH.secili = null;
    sehirDegisti();
    sehirCiz();
    return;
  }
  if (h.hasAttribute("data-sh-png")) {
    const kap = document.createElement("div");
    kap.innerHTML = sehirSvg(SH.sehir, {});
    const k = kap.querySelector("svg");
    k.setAttribute("width", "2000"); k.setAttribute("height", "1400");
    const img = new Image();
    img.onload = function () {
      const t = document.createElement("canvas"); t.width = 2000; t.height = 1400;
      t.getContext("2d").drawImage(img, 0, 0, 2000, 1400);
      t.toBlob(function (bl) { if (bl) { kartIndir(bl, fanSlug(SH.ad) + "-sehir.png"); } }, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(k));
  }
});

document.addEventListener("input", function (ev) {
  const t = ev.target;
  if (!t || !t.matches || !t.matches("#sehirSayfa [data-sh-alan]") || !SH || SH.salt) { return; }
  const x = sehirSecilen();
  if (!x) { return; }
  const a = t.dataset.shAlan;
  if (a === "en" || a === "boy") { const n = Number(t.value); if (!(n >= 1 && n <= 40)) { return; } x[a] = n; }
  else if (a === "tur") { x.tur = t.value; }
  else { x[a] = String(t.value).slice(0, a === "not" ? 1000 : 60); }
  sehirDegisti();
  /* adı yazarken formu yeniden çizme (imleç kaçmasın); haritayı güncelle */
  const kutu = document.querySelector("#sehirSayfa .sh-kutu");
  if (kutu) { kutu.innerHTML = sehirSvg(SH.sehir, { duzenle: true, secili: SH.secili, cizim: SH.cizim }); }
});

/* Esc yalnızca şehir penceresini kapatsın (altındaki harita ya da evren sayfası açık kalır) */
window.addEventListener("keydown", function (e) {
  if (e.key !== "Escape" || !SH) { return; }
  e.stopImmediatePropagation();
  e.preventDefault();
  sehirKapat();
}, true);

/* ==================== bağlantılar: evren sayfası, Tömye haritası ==================== */

/* evren sayfasında seçili yer: şehir haritasını aç / düzenle */
if (typeof evrenSeciliFormu === "function") {
  const eskiForm = evrenSeciliFormu;
  window.evrenSeciliFormu = function (v, hv) {
    const h = eskiForm.apply(this, arguments);
    if (!EVS.secili || !h) { return h; }
    const b = evrenYerBul(hv, EVS.secili);
    if (!b) { return h; }
    const dugme = b.duzenlenir
      ? '<button class="dugme dugme-sade sh-ac" data-sh-evren="' + kacir(b.yer.id) + '">🏙 ' + (b.yer.sehir ? "Şehir haritasını düzenle" : "Şehir haritası çiz") + "</button>"
      : (b.yer.sehir ? '<button class="dugme sh-ac" data-sh-evren="' + kacir(b.yer.id) + '">🏙 Şehir haritasını aç</button>' : "");
    return dugme ? h.replace(/<\/div>$/, dugme + "</div>") : h;
  };
}

/* Tömye (ve kanon) haritası: yer kartında şehir haritası; yönetici düzenlerken oluşturur */
if (typeof haritaBilgiCiz === "function") {
  const eskiBilgi = haritaBilgiCiz;
  window.haritaBilgiCiz = function () {
    const r = eskiBilgi.apply(this, arguments);
    try {
      const el = HT.kutu && HT.kutu.querySelector("#htBilgi");
      const s = haritaSeciliYer();
      if (el && s && !el.hidden && (s.sehir || HT.duzen)) {
        const d = '<button type="button" class="dugme ' + (HT.duzen ? "dugme-sade " : "") + 'sh-ac" data-sh-kanon="1">🏙 ' +
          (HT.duzen ? (s.sehir ? "Şehir haritasını düzenle" : "Şehir haritası çiz") : "Şehir haritasını aç") + "</button>";
        /* düzenleme kartı uzun: düğme en üstte (kapat düğmesinin ardından) */
        const kapat = HT.duzen && el.querySelector(".ht-bilgi-kapat");
        if (kapat) { kapat.insertAdjacentHTML("afterend", d); } else { el.insertAdjacentHTML("beforeend", d); }
      }
    } catch (_) { /* harita açık değil */ }
    return r;
  };
}

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-sh-evren], [data-sh-kanon]");
  if (!h) { return; }
  if (h.dataset.shEvren && typeof EVS !== "undefined" && EVS) {
    const v = evrenSayfaVerisi();
    const hv = evrenHaritaVerisi(v);
    const b = evrenYerBul(hv, h.dataset.shEvren);
    if (!b) { return; }
    const id = b.yer.id;
    sehirAc((b.yer.ad || "Şehir") + (v.eser.ad ? " · " + v.eser.ad : ""), b.yer.sehir, !b.duzenlenir, function (s) {
      evrenHaritaDegistir(function (hh) {
        const y = hh.yerler.find(function (x) { return x.id === id; });
        if (!y) { return; }
        if (s) { y.sehir = s; } else { delete y.sehir; }
      });
    });
    return;
  }
  if (h.dataset.shKanon) {
    const s = haritaSeciliYer();
    if (!s) { return; }
    const yonetici = !!HT.duzen;
    sehirAc((s.ad || "Şehir") + " · " + (aktifHarita() || {}).ad, s.sehir, !yonetici, function (d) {
      if (d) { s.sehir = d; } else { delete s.sehir; }
      if (typeof yoneticiDurum === "function") { yoneticiDurum("Şehir haritası değişti — yayına almak için Kaydet, sonra Yayınla", true); }
    });
  }
});


/* ==================== gezi çizelgesi: ortak bileşen ==================== */
/* Bir "bağlam" çizelgenin nerede olduğunu anlatır (evren sayfası ya da kanon haritanın gezi penceresi):
   { kisiler: [{i, ad, yol}], secili, duzenle, yerler: [{id, ad, g}], gruplar: [{g, ad}], yerBul(adim), gAd(g),
     degistir(fn(yol)), ciz(), ustEk, bos }
   Adım: { g: gezegen, yer, gun, zaman, not }. Gün yoksa sıradan sayılır. */

const GZ = { gun: null, ayni: false, zaman: null, kimlik: "", bagla: null };

/* ---------- canlı yolculuk: evren saatine göre "şu an nerede" ---------- */
/* kisi.canli = { tur: "dongu" }              → yol bitince baştan (ulak, kervan…)
                { tur: "baslangic", gun: D }   → yolun 1. günü evrenin D. günüydü */

function gzCanliTemizle(c) {
  if (!c || typeof c !== "object") { return null; }
  if (c.tur === "dongu") { return { tur: "dongu" }; }
  const g = Math.round(Number(c.gun));
  return c.tur === "baslangic" && isFinite(g) && Math.abs(g) < 1e7 ? { tur: "baslangic", gun: g } : null;
}

/** Evrenin şu anki günü (sıfırdan sayılır): başlangıçtan beri geçen gerçek saat / bir evren gününün saati. */
function gzEvrenGunu(baslangicMs, gunSaat) {
  const gs = gunSaat > 0 ? gunSaat : 24;
  return Math.floor((Date.now() - baslangicMs) / 3600000 / gs);
}

/** Yolun şu anki günü; { gun } ya da { once: kaç gün sonra başlıyor } ya da { bitti: true }. */
function gzCanliGun(yol, canli, D) {
  if (!canli || !yol.length || D === null || D === undefined) { return null; }
  const g = gzGunler(yol);
  const ilk = Math.min.apply(null, g), son = Math.max.apply(null, g);
  if (canli.tur === "dongu") { const n = son - ilk + 1; return { gun: ilk + (((D % n) + n) % n) }; }
  const gun = ilk + (D - canli.gun);
  if (gun < ilk) { return { once: ilk - gun }; }
  if (gun > son) { return { bitti: true }; }
  return { gun: gun };
}

/** Her adımın günü: yazılmışsa o; yazılmamışsa bir öncekiyle aynı gün (hiçbirinde yoksa sıra numarası). */
function gzGunler(yol) {
  const var_ = yol.some(function (a) { return a.gun >= 1; });
  let son = 0;
  return yol.map(function (a, i) {
    if (!var_) { return i + 1; }
    if (a.gun >= 1) { son = a.gun; return a.gun; }
    return son || 1;
  });
}

/** Oynatıcıda seçili güne göre adımların durumu: şu anki adımın sırası (gün seçilmemişse -1). */
function gzSimdi(yol) {
  if (GZ.gun === null) { return -1; }
  const g = gzGunler(yol);
  let s = -1;
  g.forEach(function (d, i) { if (d <= GZ.gun) { s = i; } });
  return s;
}

function gzOynatDurdur() { if (GZ.zaman) { clearInterval(GZ.zaman); GZ.zaman = null; } }

/** Bağlam değişince (başka kişi, başka evren) oynatıcı başa döner. */
function gzKimlik(k) {
  if (GZ.kimlik !== k) { GZ.kimlik = k; GZ.gun = null; gzOynatDurdur(); }
}

/** Haritaya çizilecek noktalar: yalnızca o gezegendekiler; aynı yere birden çok uğrama tek işarette. */
function gzNoktalar(b, g) {
  const k = b.kisiler.find(function (x) { return x.i === b.secili; });
  if (!k || !(k.yol || []).length) { return null; }
  const simdi = gzSimdi(k.yol);
  const sira = [];
  k.yol.forEach(function (a, j) {
    if ((a.g || "") !== (g || "")) { return; }
    const y = b.yerBul(a);
    if (!y) { return; }
    sira.push({ x: y.x, y: y.y, n: j + 1, yer: a.yer, durum: simdi === -1 ? "gecti" : (j < simdi ? "gecti" : (j === simdi ? "simdi" : "gelecek")) });
  });
  return sira.length ? sira : null;
}

function gzGunYazi(yol, j) {
  return gzGunler(yol)[j] + ". gün";
}

function gzGovde(b) {
  const k = b.kisiler.find(function (x) { return x.i === b.secili; });
  const ust = '<div class="gz-ust"><b>Gezi çizelgesi</b>' +
    (b.kisiler.length ? '<select class="kod-giris" data-gz-kisi aria-label="Kişi">' + b.kisiler.map(function (x) {
      return '<option value="' + x.i + '"' + (x.i === b.secili ? " selected" : "") + ">" + kacir(x.ad || "Adsız") + ((x.yol || []).length ? " (" + x.yol.length + ")" : "") + "</option>";
    }).join("") + "</select>" : "") + (b.ustEk || "") + "</div>";
  if (!k) { return ust + (b.bos ? '<p class="oyun-not">' + b.bos + "</p>" : ""); }
  const yol = k.yol || [];
  const gunler = gzGunler(yol);
  const simdi = gzSimdi(yol);

  /* ekleme: yerlere sırayla dokun, her dokunuş ertesi gün */
  let ekle = "";
  if (b.duzenle) {
    const grupSayisi = b.gruplar.filter(function (gr) { return b.yerler.some(function (y) { return y.g === gr.g; }); }).length;
    ekle = '<div class="gz-ekle">' +
      '<p class="oyun-not">' + kacir(k.ad || "Bu kişi") + " nereye gitti? Yerlere sırayla dokun: " + (GZ.ayni ? "<b>hepsi aynı güne</b> eklenir." : "her dokunuş <b>ertesi gün</b>.") + "</p>" +
      '<div class="gz-yerler">' + b.gruplar.map(function (gr) {
        const l = b.yerler.filter(function (y) { return y.g === gr.g; });
        if (!l.length) { return ""; }
        return (grupSayisi > 1 ? '<span class="gz-grup">' + kacir(gr.ad) + "</span>" : "") + l.map(function (y) {
          return '<button type="button" class="evg-cip gz-yer" data-gz-yer="' + kacir(y.id) + '" data-gz-g="' + kacir(y.g) + '">' + kacir(y.ad || "Adsız yer") + "</button>";
        }).join("");
      }).join("") + "</div>" +
      '<div class="gz-secenek"><label class="gz-ayni"><input type="checkbox" data-gz-ayni' + (GZ.ayni ? " checked" : "") + "> Aynı gün (bir günde birkaç yer)</label>" +
        (yol.length ? '<button type="button" class="dugme dugme-sade" data-gz-bekle>Bir gün daha kal</button>' +
          '<button type="button" class="dugme dugme-sade" data-gz-numarala>Günleri 1, 2, 3… diye diz</button>' +
          '<button type="button" class="ic-bag y-sil" data-gz-temizle>Yolu sil</button>' : "") + "</div></div>";
  }

  /* gün gün izle */
  let oyn = "";
  if (yol.length) {
    const ilk = Math.min.apply(null, gunler), sonGun = Math.max.apply(null, gunler);
    const a = simdi >= 0 ? yol[simdi] : null;
    const y = a ? b.yerBul(a) : null;
    const yazi = GZ.gun === null
      ? "Bütün yol: " + yol.length + " adım, " + (sonGun - ilk + 1) + " gün"
      : GZ.gun + ". gün · " + (a ? (y ? y.ad || "Adsız yer" : "(yer yok)") + (b.gAd(a.g) ? " (" + b.gAd(a.g) + ")" : "") + (a.zaman ? " · " + a.zaman : "") + (a.not ? " — " + a.not : "") : "henüz yola çıkmadı");
    const D = typeof b.simdiGun === "function" ? b.simdiGun() : null;
    const cg = gzCanliGun(yol, k.canli, D);
    let canliYazi = "";
    if (cg && cg.gun !== undefined) {
      const j = (function () { const g = gzGunler(yol); let s2 = -1; g.forEach(function (d, i) { if (d <= cg.gun) { s2 = i; } }); return s2; })();
      const ya = j >= 0 ? yol[j] : null, yy = ya ? b.yerBul(ya) : null;
      canliYazi = '<span class="gz-canli-nokta" aria-hidden="true"></span><b>Şu an:</b> ' + cg.gun + ". gün" + (yy ? " · " + kacir(yy.ad || "Adsız yer") : "") +
        (ya && b.gAd(ya.g) ? " (" + kacir(b.gAd(ya.g)) + ")" : "") + ' <button type="button" class="ic-bag" data-gz-simdi="' + cg.gun + '">Şu ana git</button>';
    } else if (cg && cg.once) { canliYazi = "Yolculuk " + cg.once + " gün sonra başlıyor."; }
    else if (cg && cg.bitti) { canliYazi = "Yolculuk bitti."; }
    oyn = (canliYazi ? '<p class="gz-canli" role="status">' + canliYazi + "</p>" : "") +
      (b.duzenle && typeof b.canliYaz === "function" ? '<div class="gz-canli-ayar"><label>Canlı: <select class="kod-giris" data-gz-canli aria-label="Canlı yolculuk">' +
        [["", "kapalı"], ["dongu", "döngü — bitince baştan"], ["baslangic", k.canli && k.canli.tur === "baslangic" ? "başladı (evren günü " + k.canli.gun + ")" : "bugün başlasın"]].map(function (o) {
          return '<option value="' + o[0] + '"' + (((k.canli && k.canli.tur) || "") === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
        }).join("") + "</select></label>" +
        (typeof b.saatYaz === "function" ? '<label>1 evren günü = <input class="kod-giris gz-saat" type="number" min="0.1" max="10000" step="any" data-gz-saat value="' + kacir(b.gunSaat()) + '" aria-label="Bir evren günü kaç gerçek saat"> gerçek saat</label>' : "") +
        "</div>" : "") +
      '<div class="gz-oynatici">' +
      '<button type="button" class="dugme" data-gz-oynat>' + (GZ.zaman ? "❚❚ Durdur" : "▶ Gün gün izle") + "</button>" +
      (sonGun > ilk ? '<input type="range" class="gz-kaydir" data-gz-gun min="' + ilk + '" max="' + sonGun + '" step="1" value="' + (GZ.gun === null ? sonGun : GZ.gun) + '" aria-label="Gün">' : "") +
      (GZ.gun !== null ? '<button type="button" class="ic-bag" data-gz-tumu>Bütün yol</button>' : "") +
      '<button type="button" class="ic-bag" data-gz-kart>Paylaş (kart)</button>' +
      '<output class="gz-gun-yaz" role="status">' + kacir(yazi) + "</output></div>";
  }

  const liste = yol.length ? '<ol class="gz-liste">' + yol.map(function (a, j) {
    const y = b.yerBul(a);
    const yerAd = y ? y.ad || "Adsız yer" : "(silinmiş yer)";
    const gAd = b.gAd(a.g) ? '<small class="gz-gezegen">' + kacir(b.gAd(a.g)) + "</small>" : "";
    const ayniGun = j > 0 && gunler[j] === gunler[j - 1];
    const kaldi = j > 0 && yol[j - 1].yer === a.yer && (yol[j - 1].g || "") === (a.g || "");
    return '<li class="' + (j === simdi ? "simdi" : (simdi !== -1 && j > simdi ? "gelecek" : "")) + '">' +
      '<span class="gz-no">' + (j + 1) + '</span><div class="gz-adim">' +
      '<span class="gz-gun' + (ayniGun ? " ayni" : "") + '">' + gzGunYazi(yol, j) + "</span> <b>" + kacir(yerAd) + "</b>" + gAd + (kaldi ? ' <small class="oyun-not">(kaldı)</small>' : "") +
      (b.duzenle ? '<div class="gz-alanlar"><input class="kod-giris gz-gun-giris" type="number" min="1" max="99999" data-gz-alan="gun" data-gz-i="' + j + '" value="' + (a.gun || "") + '" placeholder="' + gunler[j] + '" aria-label="Gün">' +
          '<input class="kod-giris" maxlength="60" data-gz-alan="zaman" data-gz-i="' + j + '" value="' + kacir(a.zaman) + '" placeholder="Saat, mevsim…" aria-label="Zaman">' +
          '<input class="kod-giris" maxlength="300" data-gz-alan="not" data-gz-i="' + j + '" value="' + kacir(a.not) + '" placeholder="Orada ne oldu?" aria-label="Not"></div>'
        : (a.zaman || a.not ? '<div class="oyun-not">' + kacir([a.zaman, a.not].filter(Boolean).join(" · ")) + "</div>" : "")) + "</div>" +
      (b.duzenle ? '<span class="gz-arac"><button class="ic-bag" data-gz-tasi="' + j + ':-1" aria-label="Yukarı">↑</button><button class="ic-bag" data-gz-tasi="' + j + ':1" aria-label="Aşağı">↓</button>' +
        '<button class="ic-bag y-sil" data-gz-sil="' + j + '" aria-label="Sil">✕</button></span>' : "") + "</li>";
  }).join("") + "</ol>" : '<p class="oyun-not">' + kacir(k.ad || "Bu kişi") + " henüz hiçbir yere gitmedi.</p>";

  return ust + ekle + oyn + liste;
}

/** Yeni adım: ertesi gün (ya da "aynı gün" seçiliyse aynı gün). */
function gzEkle(b, yer, g) {
  b.degistir(function (yol) {
    if (yol.length >= GZ_SINIR) { return; }
    const son = yol[yol.length - 1];
    const sonGun = yol.length ? gzGunler(yol)[yol.length - 1] : 0;
    const gun = GZ.ayni && son ? sonGun : sonGun + 1;
    /* aynı yere art arda dokunmak (çift dokunma) sayılmaz; orada kalmak için "Bir gün daha kal" */
    if (son && son.yer === yer && (son.g || "") === (g || "")) { return; }
    /* eski (günsüz) yola gün eklenince önceki adımlar da sıradan numaralansın */
    if (son && !yol.some(function (a) { return a.gun >= 1; })) { yol.forEach(function (a, i) { a.gun = i + 1; }); }
    yol.push({ g: g || "", yer: yer, gun: gun, zaman: "", not: "" });
  });
  GZ.gun = null;
}

function gzBaglam() { return typeof GZ.bagla === "function" ? GZ.bagla() : null; }

document.addEventListener("click", function (ev) {
  const h = ev.target.closest(".gz-kutu [data-gz-yer], .gz-kutu [data-gz-bekle], .gz-kutu [data-gz-numarala], .gz-kutu [data-gz-temizle], .gz-kutu [data-gz-tasi], .gz-kutu [data-gz-sil], .gz-kutu [data-gz-oynat], .gz-kutu [data-gz-tumu], .gz-kutu [data-gz-simdi]");
  if (!h) { return; }
  const b = gzBaglam();
  if (!b) { return; }
  const d = h.dataset;
  if (h.hasAttribute("data-gz-oynat")) {
    if (GZ.zaman) { gzOynatDurdur(); b.ciz(); return; }
    const k = b.kisiler.find(function (x) { return x.i === b.secili; });
    if (!k || !(k.yol || []).length) { return; }
    const gunler = gzGunler(k.yol).filter(function (x, i, l) { return l.indexOf(x) === i; }).sort(function (x, y) { return x - y; });
    GZ.gun = GZ.gun === null || GZ.gun >= gunler[gunler.length - 1] ? gunler[0] : GZ.gun;
    GZ.zaman = setInterval(function () {
      const bb = gzBaglam();
      if (!bb || !document.querySelector(".gz-kutu")) { gzOynatDurdur(); return; }
      const sonraki = gunler.find(function (x) { return x > GZ.gun; });
      if (sonraki === undefined) { gzOynatDurdur(); } else { GZ.gun = sonraki; }
      bb.ciz();
    }, 1100);
    b.ciz();
    return;
  }
  if (h.hasAttribute("data-gz-tumu")) { gzOynatDurdur(); GZ.gun = null; b.ciz(); return; }
  if (d.gzSimdi) { gzOynatDurdur(); GZ.gun = Number(d.gzSimdi); b.ciz(); return; }
  if (!b.duzenle) { return; }
  if (d.gzYer) { gzEkle(b, d.gzYer, d.gzG || ""); b.ciz(); return; }
  if (h.hasAttribute("data-gz-temizle")) {
    if (!confirm("Bu kişinin bütün yolu silinsin mi?")) { return; }
    b.degistir(function (yol) { yol.length = 0; });
    GZ.gun = null; b.ciz(); return;
  }
  b.degistir(function (yol) {
    if (h.hasAttribute("data-gz-bekle")) {
      const son = yol[yol.length - 1];
      if (son && yol.length < GZ_SINIR) {
        if (!yol.some(function (a) { return a.gun >= 1; })) { yol.forEach(function (a, i) { a.gun = i + 1; }); }
        yol.push({ g: son.g || "", yer: son.yer, gun: gzGunler(yol)[yol.length - 1] + 1, zaman: "", not: "" });
      }
    }
    if (h.hasAttribute("data-gz-numarala")) { yol.forEach(function (a, i) { a.gun = i + 1; }); }
    if (d.gzSil !== undefined) { yol.splice(Number(d.gzSil), 1); }
    if (d.gzTasi) {
      const p = d.gzTasi.split(":"), a = Number(p[0]), c = a + Number(p[1]);
      /* yer değişir, gün sırası yerinde kalır (1. gün hep başta) */
      if (c >= 0 && c < yol.length) {
        const ga = yol[a].gun, gc = yol[c].gun;
        const x = yol[a]; yol[a] = yol[c]; yol[c] = x;
        if (ga !== undefined || gc !== undefined) { yol[a].gun = ga; yol[c].gun = gc; if (ga === undefined) { delete yol[a].gun; } if (gc === undefined) { delete yol[c].gun; } }
      }
    }
  });
  GZ.gun = null;
  b.ciz();
});

document.addEventListener("change", function (ev) {
  const t = ev.target;
  if (!t || !t.closest || !t.closest(".gz-kutu")) { return; }
  const b = gzBaglam();
  if (!b) { return; }
  /* change, alan odağını kaybederken de gelir (sayfa yeniden çizilirken): çizimi bir sonraki adıma bırak */
  const ciz = function () { setTimeout(function () { const bb = gzBaglam(); if (bb) { bb.ciz(); } }, 0); };
  if (t.matches("[data-gz-kisi]")) { b.sec(Number(t.value)); ciz(); return; }
  if (t.matches("[data-gz-ayni]")) { GZ.ayni = t.checked; ciz(); return; }
  if (t.matches("[data-gz-gun]")) { gzOynatDurdur(); GZ.gun = Number(t.value); ciz(); return; }
  if (t.matches("[data-gz-canli]") && b.duzenle) {
    b.canliYaz(t.value === "dongu" ? { tur: "dongu" } : (t.value === "baslangic" ? { tur: "baslangic", gun: b.simdiGun() } : null));
    ciz(); return;
  }
  if (t.matches("[data-gz-saat]") && b.duzenle) { const n = Number(t.value); if (n > 0 && n <= 10000) { b.saatYaz(n); ciz(); } return; }
  if (t.matches("[data-gz-alan]") && b.duzenle) {
    const j = Number(t.dataset.gzI), alan = t.dataset.gzAlan;
    b.degistir(function (yol) {
      const a = yol[j];
      if (!a) { return; }
      if (alan === "gun") {
        const n = Math.round(Number(t.value));
        if (t.value === "" ) { delete a.gun; } else if (n >= 1 && n <= 99999) { a.gun = n; }
      } else { a[alan] = String(t.value).slice(0, alan === "not" ? 300 : 60); }
    });
    if (alan === "gun") { ciz(); }
  }
});

/* kaydırıcı sürüklenirken yalnızca yazı değişsin; bırakınca harita */
document.addEventListener("input", function (ev) {
  const t = ev.target;
  if (!t || !t.matches || !t.matches(".gz-kutu [data-gz-gun]")) { return; }
  const o = t.closest(".gz-kutu").querySelector(".gz-gun-yaz");
  if (o) { o.textContent = t.value + ". gün…"; }
});

/* haritaya seçili kişinin yolu: geçilen adımlar koyu, sıradakiler soluk, bugünkü yer halkalı */
if (typeof evrenHaritaSvg === "function") {
  const eskiSvg = evrenHaritaSvg;
  window.evrenHaritaSvg = function () {
    const s = eskiSvg.apply(this, arguments);
    const l = window.__gzYol;
    if (!l || !l.length) { return s; }
    const k = 0.7;
    const nok = function (p) { return p.x + "," + (p.y * k).toFixed(2); };
    const gecen = l.filter(function (p) { return p.durum !== "gelecek"; });
    const simdiIdx = l.findIndex(function (p) { return p.durum === "simdi"; });
    const gelen = simdiIdx === -1 ? l.filter(function (p) { return p.durum === "gelecek"; }) : l.slice(simdiIdx);
    const cizgi = (gecen.length > 1 ? '<polyline points="' + gecen.map(nok).join(" ") + '" fill="none" stroke="#C0392B" stroke-width="0.45" stroke-dasharray="1.2 0.7" stroke-linecap="round"></polyline>' : "") +
      (gelen.length > 1 ? '<polyline points="' + gelen.map(nok).join(" ") + '" fill="none" stroke="#C0392B" stroke-opacity="0.3" stroke-width="0.35" stroke-dasharray="0.6 0.8" stroke-linecap="round"></polyline>' : "");
    /* aynı yere birden çok uğrama tek işarette: "1,4" */
    const gruplar = [];
    l.forEach(function (p) {
      let g = gruplar.find(function (x) { return x.yer === p.yer; });
      if (!g) { g = { yer: p.yer, x: p.x, y: p.y, n: [], durum: "gelecek" }; gruplar.push(g); }
      g.n.push(p.n);
      if (p.durum === "simdi" || (p.durum === "gecti" && g.durum === "gelecek")) { g.durum = p.durum; }
    });
    const noktalar = gruplar.map(function (g) {
      const yazi = g.n.length > 3 ? g.n[0] + "…" + g.n[g.n.length - 1] : g.n.join(",");
      const r = Math.max(1.5, 0.55 + yazi.length * 0.45);
      return '<g class="gz-nokta' + (g.durum === "simdi" ? " simdi" : "") + '" transform="translate(' + g.x + "," + (g.y * k).toFixed(2) + ')"' + (g.durum === "gelecek" ? ' opacity="0.4"' : "") + ">" +
        (g.durum === "simdi" ? '<circle class="gz-halka" r="3.2" fill="none" stroke="#C0392B" stroke-width="0.35"></circle>' : "") +
        '<rect x="' + (-r) + '" y="-1.5" width="' + (2 * r) + '" height="3" rx="1.5" fill="#C0392B" stroke="#fff" stroke-width="0.3"></rect>' +
        '<text y="0.55" text-anchor="middle" font-size="1.5" font-family="ui-monospace,monospace" fill="#fff">' + yazi + "</text></g>";
    }).join("");
    return s.replace(/<\/svg>$/, '<g class="gz-yol" pointer-events="none">' + cizgi + noktalar + "</g></svg>");
  };
}

/* ==================== gezi çizelgesi: evren sayfası ==================== */

function gzKisiler(e) { return (e.kisiler || []).map(function (k, i) { return { k: k, i: i }; }).filter(function (x) { return x.k && String(x.k.ad || "").trim() && !x.k.kutu; }); }

function gzGezegenAdi(e, g) {
  if (!g) { return typeof evgAnaAd === "function" ? evgAnaAd(e) : "Ana gezegen"; }
  const x = (e.gezegenler || []).find(function (y) { return y.id === g; });
  return x ? x.ad : "?";
}

function gzYer(e, adim) {
  const h = adim.g ? (((e.gezegenler || []).find(function (x) { return x.id === adim.g; }) || {}).harita || {}) : (e.harita || {});
  return (h.yerler || []).find(function (y) { return y.id === adim.yer; }) || null;
}

/** Evren sayfasındaki çizelgenin bağlamı. */
function gzEvrenBaglami(v) {
  const e = v.eser;
  const sahip = EVS.kaynak === "benim";
  const l = gzKisiler(e).filter(function (x) { return sahip || (x.k.yol || []).length; });
  if (l.length && (EVS.yolKisi === undefined || EVS.yolKisi === null || !l.some(function (x) { return x.i === EVS.yolKisi; }))) { EVS.yolKisi = l[0].i; }
  if (!l.length) { EVS.yolKisi = null; }
  const coklu = (e.gezegenler || []).length > 0;
  const gruplar = [{ g: "", ad: gzGezegenAdi(e, "") }].concat((e.gezegenler || []).map(function (g) { return { g: g.id, ad: g.ad || "Gezegen" }; }));
  const yerler = [];
  gruplar.forEach(function (gr) {
    const h = gr.g ? ((e.gezegenler || []).find(function (x) { return x.id === gr.g; }) || {}).harita : e.harita;
    ((h && h.yerler) || []).forEach(function (y) { if (y && y.id) { yerler.push({ id: y.id, ad: y.ad, g: gr.g }); } });
  });
  const id = EVS.id;
  return {
    kisiler: l.map(function (x) { return { i: x.i, ad: x.k.ad, yol: x.k.yol || [], canli: x.k.canli || null }; }),
    evrenAd: e.ad || "",
    simdiGun: function () {
      const st = e.saat || {};
      const bas = Date.parse(st.baslangic || String(e.olusturma || "").slice(0, 10) || "2026-01-01");
      return gzEvrenGunu(isFinite(bas) ? bas : Date.parse("2026-01-01"), st.gunSaat);
    },
    gunSaat: function () { return (e.saat && e.saat.gunSaat) || 24; },
    canliYaz: function (c) {
      const i = EVS.yolKisi;
      evrenBenimDegistir(id, function (ee) { const k = (ee.kisiler || [])[i]; if (!k) { return; } if (c) { k.canli = c; } else { delete k.canli; } });
    },
    saatYaz: function (n) {
      evrenBenimDegistir(id, function (ee) { ee.saat = Object.assign({}, ee.saat || {}, { gunSaat: n }); });
    },
    secili: EVS.yolKisi, duzenle: sahip, yerler: yerler, gruplar: gruplar,
    yerBul: function (a) { return gzYer(e, a); },
    gAd: function (g) { return coklu ? gzGezegenAdi(e, g) : ""; },
    sec: function (i) { EVS.yolKisi = i; },
    degistir: function (fn) {
      const i = EVS.yolKisi;
      evrenBenimDegistir(id, function (ee) {
        const k = (ee.kisiler || [])[i];
        if (!k) { return; }
        if (!Array.isArray(k.yol)) { k.yol = []; }
        fn(k.yol);
        if (!k.yol.length) { delete k.yol; }
      });
    },
    ciz: function () { gzEvrenCiz(); },
    ustEk: sahip && l.length ? '<button class="dugme' + (EVS.mod === "yol" ? "" : " dugme-sade") + '" data-gz-ciz>' + (EVS.mod === "yol" ? "Haritada dokunmayı bitir" : "Haritada dokunarak ekle") + "</button>" : "",
    bos: sahip ? "Önce Bilgiler sekmesinde bir kişi ekle; sonra onun gün gün yolunu burada çizersin." : ""
  };
}

/** Oynatıcı başka gezegendeki güne geçince harita o gezegene döner. */
function gzEvrenCiz() {
  const v = typeof evrenSayfaVerisi === "function" ? evrenSayfaVerisi() : null;
  if (v && GZ.gun !== null && EVS.yolKisi !== null && EVS.yolKisi !== undefined) {
    const k = (v.eser.kisiler || [])[EVS.yolKisi];
    const j = k && k.yol ? gzSimdi(k.yol) : -1;
    if (j >= 0) {
      const g = k.yol[j].g || "";
      if (!g || (v.eser.gezegenler || []).some(function (x) { return x.id === g; })) { EVS.gezegen = g || null; }
    }
  }
  evrenSayfaCiz();
}

/** Harita sekmesinin altındaki "Gezi çizelgesi". */
function gziBolumu(v) {
  if (!EVS || ["benim", "fan", "acilan"].indexOf(EVS.kaynak) === -1) { return ""; }
  const b = gzEvrenBaglami(v);
  if (!b.kisiler.length && !b.bos) { return ""; }
  return '<section class="gz-kutu" aria-label="Gezi çizelgesi">' + gzGovde(b) + "</section>";
}

if (typeof evrenHaritaBolumu === "function") {
  const eskiBolum = evrenHaritaBolumu;
  window.evrenHaritaBolumu = function (v) {
    let yolNok = null;
    if (EVS && ["benim", "fan", "acilan"].indexOf(EVS.kaynak) !== -1) {
      const b = gzEvrenBaglami(v);
      gzKimlik("evren:" + EVS.kaynak + ":" + EVS.id + ":" + b.secili);
      GZ.bagla = function () { const vv = evrenSayfaVerisi(); return vv ? gzEvrenBaglami(vv) : null; };
      yolNok = gzNoktalar(b, EVS.gezegen || "");
    }
    window.__gzYol = yolNok;
    let h;
    try { h = eskiBolum.apply(this, arguments); } finally { window.__gzYol = null; }
    return h + gziBolumu(v);
  };
}

/* "Haritada dokunarak ekle": yere dokunmak adım ekler (sürükleme ve seçim yerine) */
document.addEventListener("pointerdown", function (ev) {
  if (!EVS || EVS.mod !== "yol" || EVS.kaynak !== "benim") { return; }
  const hedef = ev.target.closest && ev.target.closest("#evrenSayfa .evh-svg.duzenle [data-evh-yer]");
  if (!hedef) { return; }
  ev.stopImmediatePropagation();
  ev.preventDefault();
  const b = gzBaglam();
  if (!b || EVS.yolKisi === null) { return; }
  gzEkle(b, hedef.getAttribute("data-evh-yer"), EVS.gezegen || "");
  evrenSayfaCiz();
}, true);

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("#evrenSayfa [data-gz-ciz]");
  if (!h || !EVS || EVS.kaynak !== "benim") { return; }
  EVS.mod = EVS.mod === "yol" ? "sec" : "yol"; EVS.secili = null; EVS.cizim = [];
  evrenSayfaCiz();
});

/* evren sayfası kapanınca oynatıcı durur */
if (typeof evrenSayfaKapat === "function") {
  const eskiKapat = evrenSayfaKapat;
  window.evrenSayfaKapat = function () { gzOynatDurdur(); GZ.gun = null; return eskiKapat.apply(this, arguments); };
}

/* ==================== yolculuk kartı (1080×1920, Instagram hikâyesi) ==================== */

function gzSvgResmi(svg) {
  return new Promise(function (coz) {
    if (!svg) { coz(null); return; }
    const k = svg.cloneNode(true);
    k.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    k.setAttribute("width", "1000"); k.setAttribute("height", "700");
    k.querySelectorAll(".gz-halka").forEach(function (x) { x.remove(); });
    const img = new Image();
    img.onload = function () { coz(img); };
    img.onerror = function () { coz(null); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(k));
  });
}

/** Kişinin bütün yolu: harita (rotayla), gün gün liste. */
async function gzKartUret(b, kok) {
  const k = b.kisiler.find(function (x) { return x.i === b.secili; });
  if (!k || !(k.yol || []).length || typeof kartZemin !== "function") { return null; }
  if (typeof kartFontlariHazir === "function") { await kartFontlariHazir(); }
  /* kartta bütün yol görünsün */
  const eski = GZ.gun;
  gzOynatDurdur(); GZ.gun = null; b.ciz();
  const svg = (kok && kok.isConnected ? kok : document).querySelector(".gzk-harita svg, .evh-kutu svg");
  const resim = await gzSvgResmi(svg);
  GZ.gun = eski; if (eski !== null) { b.ciz(); }
  const EN = 1080, BOY = 1920, sol = 90, gen = EN - 180;
  const t = document.createElement("canvas");
  t.width = EN; t.height = BOY;
  const c = t.getContext && t.getContext("2d");
  if (!c) { return null; }
  kartZemin(c, EN, BOY);
  c.fillStyle = "#C0392B"; c.fillRect(sol, 150, 6, 60);
  kartEtiket(c, "Yolculuk · " + (b.evrenAd || ""), sol + 24, 192, KART_RENK.murekkep2, 26);
  c.fillStyle = KART_RENK.murekkep;
  let px = 110;
  c.font = KART_FONT.baslik(px);
  while (c.measureText(k.ad).width > gen && px > 56) { px -= 6; c.font = KART_FONT.baslik(px); }
  c.fillText(k.ad, sol, 320);
  const gunler = gzGunler(k.yol);
  const gunSay = Math.max.apply(null, gunler) - Math.min.apply(null, gunler) + 1;
  c.font = KART_FONT.yazi(42, true); c.fillStyle = KART_RENK.deniz;
  c.fillText(gunSay + " gün · " + k.yol.length + " durak", sol, 385);
  let y = 440;
  if (resim) {
    const h = gen * 0.7;
    c.save(); c.beginPath(); c.rect(sol, y, gen, h); c.clip();
    c.drawImage(resim, sol, y, gen, h); c.restore();
    c.strokeStyle = KART_RENK.sig; c.lineWidth = 3; c.strokeRect(sol, y, gen, h);
    y += h + 70;
  }
  /* gün gün: sığdığı kadar, fazlası "…ve N durak daha" */
  const satir = 62, sigan = Math.floor((BOY - 230 - y) / satir);
  const l = k.yol.slice(0, k.yol.length > sigan ? sigan - 1 : sigan);
  l.forEach(function (a, j) {
    const yer = b.yerBul(a);
    c.font = KART_FONT.mono(26, true); c.fillStyle = "#8A6A3E";
    c.fillText(gunler[j] + ". gün", sol, y);
    c.font = KART_FONT.yazi(40); c.fillStyle = KART_RENK.murekkep;
    let ad = (yer ? yer.ad || "Adsız yer" : "—") + (b.gAd(a.g) ? " · " + b.gAd(a.g) : "");
    while (c.measureText(ad).width > gen - 170 && ad.length > 4) { ad = ad.slice(0, -2) + "…"; }
    c.fillText(ad, sol + 170, y);
    y += satir;
  });
  if (l.length < k.yol.length) {
    c.font = KART_FONT.yazi(36, true); c.fillStyle = KART_RENK.murekkep2;
    c.fillText("…ve " + (k.yol.length - l.length) + " durak daha", sol + 170, y);
  }
  kartEtiket(c, "Gün gün izle · " + KART_ADRES, sol, BOY - 120, KART_RENK.yarik, 24);
  return t;
}

document.addEventListener("click", async function (ev) {
  const h = ev.target.closest && ev.target.closest(".gz-kutu [data-gz-kart]");
  if (!h) { return; }
  const b = gzBaglam();
  if (!b) { return; }
  h.disabled = true;
  const kok = h.closest("#evrenSayfa, .gzk-kok");
  const t = await gzKartUret(b, kok);
  const k = b.kisiler.find(function (x) { return x.i === b.secili; });
  const yeni = document.querySelector(".gz-kutu [data-gz-kart]");
  if (!t) { if (yeni) { yeni.disabled = false; } return; }
  const sonuc = await kartPaylas(t, (typeof fanSlug === "function" ? fanSlug(k.ad) : "yolculuk") + "-yolculuk.png", k.ad + " · " + (b.evrenAd || "") + " yolculuğu");
  const d = document.querySelector(".gz-kutu [data-gz-kart]");
  if (d) { d.disabled = false; if (sonuc) { d.textContent = sonuc; } }
  if (typeof olaySay === "function") { olaySay("hikaye_yolculuk"); }
});
