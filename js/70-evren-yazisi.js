/* Evren yazısı — kurucu evreninin yazısını kendi eliyle çizer.

   Üç tür:
     alfabe   : her harfe bir işaret (29 harf)
     hece     : her heceye bir işaret; heceleri kurucu belirler (ka, ke, tor…)
     birlesik : ünsüz ve ünlü ayrı çizilir, hecede tek blokta üst üste biner (24. Evren'in Kyldo yazısı gibi:
                ünsüz çizgi, ünlü işaret); tek kalan ünsüz ya da ünlü kendi başına yazılır.
   İşaretler 100×100'lük bir kutuda çizgi yolları olarak durur (yalnızca M/L komutları ve sayılar).
   Evren sayfasında "Yazı" sekmesi: kurucu çizer; okur işaretleri görür ve istediği metni o yazıyla yazar.
   "Başlıkta göster" açıksa evrenin adı başlığın altında kendi yazısıyla görünür. */

const EY_UNLULER = "aeıioöuü";
const EY_TURLER = [
  ["alfabe", "Alfabe", "Her harfe bir işaret."],
  ["hece", "Hece yazısı", "Her heceye bir işaret; heceleri sen belirlersin."],
  ["birlesik", "Birleşik", "Ünsüz ve ünlü ayrı çizilir, hecede tek blokta birleşir (24. Evren'in Kyldo yazısı gibi)."]
];
const EY_YOL = /^[ML0-9 .-]{1,2400}$/;
const EY_HECE = /^[a-zçğıöşü]{1,4}$/;
const EY = { secili: null, cizgi: null, deneme: "" };

/* ==================== veri ==================== */

function eyTemizle(h) {
  if (!h || typeof h !== "object") { return null; }
  const tur = EY_TURLER.some(function (t) { return t[0] === h.tur; }) ? h.tur : "alfabe";
  const heceler = tur === "hece" ? (Array.isArray(h.heceler) ? h.heceler : []).map(function (x) { return String(x || "").toLocaleLowerCase("tr").trim(); })
    .filter(function (x, i, l) { return EY_HECE.test(x) && l.indexOf(x) === i; }).slice(0, 150) : [];
  const gecerli = function (k) { return tur === "hece" ? heceler.indexOf(k) !== -1 : (k.length === 1 && ALFABE_HARFLER.indexOf(k) !== -1); };
  const isaretler = {};
  Object.keys(h.isaretler || {}).slice(0, 200).forEach(function (k) {
    const v = String(h.isaretler[k] || "");
    if (gecerli(k) && EY_YOL.test(v)) { isaretler[k] = v; }
  });
  const y = { tur: tur, isaretler: isaretler, baslik: !!h.baslik };
  if (heceler.length) { y.heceler = heceler; }
  return (Object.keys(isaretler).length || heceler.length || h.tur) ? y : null;
}

if (typeof evrenEkTemizle === "function") {
  const eskiEkY = evrenEkTemizle;
  window.evrenEkTemizle = function (ham, e) {
    eskiEkY.apply(this, arguments);
    const y = eyTemizle(ham.yazi);
    if (y) { e.yazi = y; } else { delete e.yazi; }
  };
}

function eyAnahtarlar(y) {
  if (!y) { return []; }
  if (y.tur === "hece") { return (y.heceler || []).slice(); }
  if (y.tur === "birlesik") {
    return ALFABE_HARFLER.split("").filter(function (c) { return EY_UNLULER.indexOf(c) === -1; })
      .concat(EY_UNLULER.split(""));
  }
  return ALFABE_HARFLER.split("");
}

function eyDolu(y) { return !!(y && Object.keys(y.isaretler || {}).length); }

/* ==================== metni yazıya çevirme ==================== */

/** Metni işaret gruplarına böler: [{ isaret: [anahtar…] } | { harf: "x" } | { bosluk: true }] */
function eyParcala(metin, y) {
  const i_ = (y && y.isaretler) || {};
  const harfler = Array.from(String(metin || "").toLocaleLowerCase("tr"));
  const l = [];
  for (let i = 0; i < harfler.length; i++) {
    const c = harfler[i];
    if (/\s/.test(c)) { l.push({ bosluk: true }); continue; }
    if (y.tur === "hece") {
      let bulundu = null;
      for (let n = 4; n >= 1 && !bulundu; n--) {
        const p = harfler.slice(i, i + n).join("");
        if (p.length === n && i_[p]) { bulundu = p; }
      }
      if (bulundu) { l.push({ isaret: [bulundu] }); i += Array.from(bulundu).length - 1; } else { l.push({ harf: c }); }
      continue;
    }
    if (y.tur === "birlesik" && EY_UNLULER.indexOf(c) === -1 && i_[c]) {
      const s = harfler[i + 1];
      if (s && EY_UNLULER.indexOf(s) !== -1 && i_[s]) { l.push({ isaret: [c, s] }); i++; continue; }
    }
    l.push(i_[c] ? { isaret: [c] } : { harf: c });
  }
  return l;
}

/** Metni evrenin yazısıyla SVG olarak çizer. boy: piksel yükseklik. */
function eyYaziSvg(metin, y, boy) {
  if (!eyDolu(y)) { return ""; }
  const p = eyParcala(metin, y);
  let x = 0;
  const govde = p.map(function (g) {
    if (g.bosluk) { x += 60; return ""; }
    const bas = x;
    x += 110;
    if (g.harf) { return '<text x="' + (bas + 50) + '" y="72" text-anchor="middle" font-size="64" fill="currentColor" opacity=".45">' + kacir(g.harf) + "</text>"; }
    return '<g transform="translate(' + bas + ',0)">' + g.isaret.map(function (k) {
      return EY_YOL.test(y.isaretler[k] || "") ? '<path d="' + y.isaretler[k] + '"/>' : "";
    }).join("") + "</g>";
  }).join("");
  const en = Math.max(10, x - 10);
  return '<svg class="ey-yazi" viewBox="-6 -6 ' + (en + 12) + ' 112" height="' + (boy || 32) + '" role="img" aria-label="' + kacir(metin) + '" ' +
    'fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' + govde + "</svg>";
}

function eyTekSvg(yol, silik) {
  return '<svg class="ey-tek" viewBox="-6 -6 112 112" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    (silik && EY_YOL.test(silik) ? '<path d="' + silik + '" opacity=".22"/>' : "") + (yol && EY_YOL.test(yol) ? '<path d="' + yol + '"/>' : "") + "</svg>";
}

/* ==================== sekme ==================== */

function eyBolum(v) {
  const e = v.eser;
  const benim = EVS && EVS.kaynak === "benim";
  const y = e.yazi || null;
  if (!benim) {
    if (!eyDolu(y)) { return '<p class="oyun-not">Bu evrenin henüz çizilmiş bir yazısı yok.</p>'; }
    return eyOkurHtml(e, y);
  }
  const tur = (y && y.tur) || "alfabe";
  const anahtarlar = eyAnahtarlar(y || { tur: tur });
  if (!EY.secili || anahtarlar.indexOf(EY.secili) === -1) { EY.secili = anahtarlar[0] || null; }
  const i_ = (y && y.isaretler) || {};
  const k = EY.secili;
  /* birleşikte kılavuz: ünlü çizerken bir ünsüz, ünsüz çizerken bir ünlü silik görünür */
  let kilavuz = "";
  if (tur === "birlesik" && k) {
    const unluMu = EY_UNLULER.indexOf(k) !== -1;
    const es = anahtarlar.find(function (x) { return (EY_UNLULER.indexOf(x) !== -1) !== unluMu && i_[x]; });
    kilavuz = es ? i_[es] : "";
  }
  return '<div class="kutu-y ey-duzen">' +
    '<p class="oyun-not">Evreninin yazısını çiz. Kutuya parmağınla ya da fareyle çiz; her çizgi hemen kaydedilir.</p>' +
    '<div class="ey-turler" role="radiogroup" aria-label="Yazı türü">' + EY_TURLER.map(function (t) {
      return '<label class="ey-tur"><input type="radio" name="eyTur" value="' + t[0] + '"' + (tur === t[0] ? " checked" : "") + " data-ey-tur> <b>" + kacir(t[1]) + "</b> <span>" + kacir(t[2]) + "</span></label>";
    }).join("") + "</div>" +
    (tur === "hece" ? '<div class="ey-hece-ekle"><label for="eyHeceler">Heceler (virgülle): ka, ke, tor…</label>' +
      '<div class="oyun-sira"><input class="kod-giris arac-giris" id="eyHeceler" placeholder="ka, ke, ki, tor"><button class="dugme dugme-sade" data-ey-hece-ekle>Ekle</button></div></div>' : "") +
    '<div class="ey-anahtarlar" role="list">' + anahtarlar.map(function (a) {
      return '<button class="ey-anahtar' + (a === k ? " secili" : "") + (i_[a] ? " dolu" : "") + '" role="listitem" data-ey-sec="' + kacir(a) + '" aria-label="' + kacir(a) + '">' +
        (i_[a] ? eyTekSvg(i_[a]) : "") + '<span class="ey-harf">' + kacir(a) + "</span></button>";
    }).join("") + (!anahtarlar.length ? '<p class="oyun-not">Önce hece ekle.</p>' : "") + "</div>" +
    (k ? '<div class="ey-cizim"><div class="ey-cizim-ust"><b class="ey-simdi">' + kacir(k) + "</b>" +
        (tur === "birlesik" ? '<span class="oyun-not">' + (EY_UNLULER.indexOf(k) !== -1 ? "ünlü — ünsüzün üstüne biner" : "ünsüz") + "</span>" : "") + "</div>" +
      '<svg id="eyPad" class="ey-pad" viewBox="0 0 100 100" aria-label="Çizim alanı: ' + kacir(k) + '">' +
        '<g class="ey-izgara"><path d="M33.3 0V100M66.6 0V100M0 33.3H100M0 66.6H100"/></g>' +
        (kilavuz && EY_YOL.test(kilavuz) ? '<path class="ey-kilavuz" d="' + kilavuz + '"/>' : "") +
        '<path id="eyYol" class="ey-yol" d="' + kacir(i_[k] || "") + '"/></svg>' +
      '<div class="oyun-sira"><button class="dugme dugme-sade" data-ey-geri>Geri al</button><button class="dugme dugme-sade" data-ey-temizle>Temizle</button>' +
        '<button class="dugme dugme-sade" data-ey-kay="-1">← Önceki</button><button class="dugme" data-ey-kay="1">Sonraki →</button></div></div>' : "") +
    '<label class="ey-baslik"><input type="checkbox" data-ey-baslik' + (y && y.baslik ? " checked" : "") + "> Evrenin adını başlıkta bu yazıyla göster</label>" +
    '<label for="eyDeneme">Dene</label><input class="kod-giris arac-giris" id="eyDeneme" value="' + kacir(EY.deneme || e.ad || "") + '">' +
    '<div class="ey-onizle" id="eyOnizle">' + eyYaziSvg(EY.deneme || e.ad || "", y, 40) + "</div></div>";
}

function eyOkurHtml(e, y) {
  const i_ = y.isaretler;
  const t = EY_TURLER.find(function (x) { return x[0] === y.tur; }) || EY_TURLER[0];
  return '<div class="kutu-y"><p class="oyun-not"><b>' + kacir(t[1]) + "</b> · " + kacir(t[2]) + "</p>" +
    '<div class="ey-anahtarlar ey-okur">' + eyAnahtarlar(y).filter(function (a) { return i_[a]; }).map(function (a) {
      return '<div class="ey-anahtar dolu">' + eyTekSvg(i_[a]) + '<span class="ey-harf">' + kacir(a) + "</span></div>";
    }).join("") + "</div>" +
    '<label for="eyDeneme">Kendi adını bu yazıyla yaz</label><input class="kod-giris arac-giris" id="eyDeneme" value="' + kacir(EY.deneme || e.ad || "") + '">' +
    '<div class="ey-onizle" id="eyOnizle">' + eyYaziSvg(EY.deneme || e.ad || "", y, 40) + "</div></div>";
}

function eyDegistir(fn) {
  if (!EVS || EVS.kaynak !== "benim" || typeof evrenBenimDegistir !== "function") { return; }
  evrenBenimDegistir(EVS.id, function (e) {
    const y = e.yazi ? JSON.parse(JSON.stringify(e.yazi)) : { tur: "alfabe", isaretler: {} };
    if (!y.isaretler) { y.isaretler = {}; }
    fn(y);
    const t = eyTemizle(y);
    if (t) { e.yazi = t; } else { delete e.yazi; }
  });
}

function eyVeri() {
  const v = typeof evrenSayfaVerisi === "function" ? evrenSayfaVerisi() : null;
  return v && v.eser ? v.eser : null;
}

if (typeof evrenEkSekmeler === "function") {
  const eskiSekY = evrenEkSekmeler;
  window.evrenEkSekmeler = function (v) {
    const l = eskiSekY.apply(this, arguments);
    if (!EVS || EVS.kaynak === "site") { return l; }
    if (EVS.kaynak === "benim" || eyDolu(v.eser.yazi)) { l.push(["yazi", "Yazı"]); }
    return l;
  };
  const eskiBolY = evrenEkBolum;
  window.evrenEkBolum = function (v) {
    if (EVS && EVS.sekme === "yazi") { return eyBolum(v); }
    return eskiBolY.apply(this, arguments);
  };
}
if (typeof evrenSayfaCiz === "function") {
  const eskiCizY = evrenSayfaCiz;
  window.evrenSayfaCiz = function () {
    const r = eskiCizY.apply(this, arguments);
    const e = eyVeri();
    const b = document.querySelector("#evrenSayfa .evs-baslik");
    if (e && b && e.yazi && e.yazi.baslik && eyDolu(e.yazi) && !b.querySelector(".evs-yazi-ad")) {
      b.insertAdjacentHTML("beforeend", '<div class="evs-yazi-ad" aria-hidden="true">' + eyYaziSvg(e.ad || "", e.yazi, 26) + "</div>");
    }
    return r;
  };
}

/* ==================== çizim ==================== */

function eyNokta(svg, ev) {
  const r = svg.getBoundingClientRect();
  return [Math.max(0, Math.min(100, Math.round((ev.clientX - r.left) / r.width * 100))), Math.max(0, Math.min(100, Math.round((ev.clientY - r.top) / r.height * 100)))];
}

document.addEventListener("pointerdown", function (ev) {
  const svg = ev.target.closest && ev.target.closest("#eyPad");
  if (!svg || !EY.secili) { return; }
  ev.preventDefault();
  try { svg.setPointerCapture(ev.pointerId); } catch (_) { /* yoksay */ }
  const p = eyNokta(svg, ev);
  EY.cizgi = { svg: svg, noktalar: [p], once: (document.querySelector("#eyYol") || {}).getAttribute ? document.querySelector("#eyYol").getAttribute("d") : "" };
});

document.addEventListener("pointermove", function (ev) {
  if (!EY.cizgi) { return; }
  const p = eyNokta(EY.cizgi.svg, ev);
  const l = EY.cizgi.noktalar, s = l[l.length - 1];
  if (Math.abs(p[0] - s[0]) + Math.abs(p[1] - s[1]) < 2) { return; }
  l.push(p);
  const yol = document.querySelector("#eyYol");
  if (yol) { yol.setAttribute("d", (EY.cizgi.once ? EY.cizgi.once + " " : "") + eyCizgiYolu(l)); }
});

function eyCizgiYolu(l) {
  return "M" + l[0][0] + " " + l[0][1] + (l.length === 1 ? "L" + (l[0][0] + 0.1) + " " + l[0][1] : "") +
    l.slice(1).map(function (p) { return "L" + p[0] + " " + p[1]; }).join("");
}

document.addEventListener("pointerup", function () {
  if (!EY.cizgi) { return; }
  const c = EY.cizgi;
  EY.cizgi = null;
  const yeni = ((c.once ? c.once + " " : "") + eyCizgiYolu(c.noktalar)).slice(0, 2400);
  const k = EY.secili;
  eyDegistir(function (y) { y.isaretler[k] = yeni; });
  evrenSayfaCiz();
});

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-ey-sec], [data-ey-geri], [data-ey-temizle], [data-ey-kay], [data-ey-hece-ekle]");
  if (!h || !EVS) { return; }
  const e = eyVeri();
  const y = (e && e.yazi) || { tur: "alfabe", isaretler: {} };
  const d = h.dataset;
  if (d.eySec) { EY.secili = d.eySec; }
  else if (d.eyKay) {
    const l = eyAnahtarlar(y);
    const i = l.indexOf(EY.secili) + Number(d.eyKay);
    if (l.length) { EY.secili = l[(i + l.length) % l.length]; }
  } else if (h.hasAttribute("data-ey-geri") && EY.secili) {
    const k = EY.secili;
    eyDegistir(function (x) {
      const p = String(x.isaretler[k] || "").split(/(?=M)/);
      p.pop();
      const kalan = p.join("").trim();
      if (kalan) { x.isaretler[k] = kalan; } else { delete x.isaretler[k]; }
    });
  } else if (h.hasAttribute("data-ey-temizle") && EY.secili) {
    const k = EY.secili;
    eyDegistir(function (x) { delete x.isaretler[k]; });
  } else if (h.hasAttribute("data-ey-hece-ekle")) {
    const el = document.querySelector("#eyHeceler");
    const yeni = String(el ? el.value : "").split(/[,\s]+/).map(function (x) { return x.toLocaleLowerCase("tr").trim(); }).filter(Boolean);
    eyDegistir(function (x) { x.tur = "hece"; x.heceler = (x.heceler || []).concat(yeni); });
    if (yeni.length) { EY.secili = yeni[0]; }
  }
  evrenSayfaCiz();
});

document.addEventListener("change", function (ev) {
  const t = ev.target;
  if (!EVS || !t) { return; }
  if (t.matches && t.matches("[data-ey-tur]")) {
    eyDegistir(function (y) { y.tur = t.value; });
    EY.secili = null;
    evrenSayfaCiz();
  } else if (t.matches && t.matches("[data-ey-baslik]")) {
    eyDegistir(function (y) { y.baslik = t.checked; });
    evrenSayfaCiz();
  }
});

document.addEventListener("input", function (ev) {
  if (!ev.target || ev.target.id !== "eyDeneme") { return; }
  EY.deneme = ev.target.value;
  const e = eyVeri();
  const o = document.querySelector("#eyOnizle");
  if (o && e) { o.innerHTML = eyYaziSvg(EY.deneme, e.yazi, 40); }
});
