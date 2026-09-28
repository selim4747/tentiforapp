/* Sürüm 3.0 — evren araçları ve Evrengezerler (hepsi cihazda; sunucuya yük yok).

   Kurucu için: tutarlılık denetçisi (kişiler, bağlar, aile, takvim, tarih, belgeler), evrenin kendi seslerinden isim
   üretici, fan-made evrende Evrengezer izni kodu (sahip verir, geri alır).
   Okur için: evren turu (5 adım), "Bu evrende yazılanlar" rafı, evren kartı (1080×1920), Evren Atölyesi'nde evrenler
   arası geçitler haritası.
   Evrengezerler: nerede yaratılırsa yaratılsın ya da hangi esere konuk olursa olsun hepsi E25'te görünür (doğdukları
   yer orası); kartlarında göründükleri eserler. */

/* ==================== 1. tutarlılık denetçisi ==================== */

function evrSayi(s) { const n = parseFloat(String(s == null ? "" : s).replace(",", ".")); return isFinite(n) ? n : null; }

/** [{ seviye: "hata" | "uyari" | "bilgi", mesaj, adim }] */
function evrDenetim(e) {
  const l = [];
  const ekle = function (seviye, mesaj, adim) { l.push({ seviye: seviye, mesaj: mesaj, adim: adim }); };
  const kisiler = evrListe(e, "kisiler");
  const adlar = kisiler.map(function (k) { return evaAd(k.ad); }).filter(Boolean);
  const kisiVar = function (ad) { return adlar.indexOf(evaAd(ad)) !== -1; };
  adlar.forEach(function (a, i) { if (adlar.indexOf(a) !== i) { ekle("uyari", "“" + kisiler[i].ad + "” adında iki kişi var: okur karıştırabilir.", "kisiler"); } });
  kisiler.forEach(function (k) { if (!String(k.ad || "").trim()) { ekle("uyari", "Adı boş bir kişi kaydı var.", "kisiler"); } });

  /* bağlar ve aile */
  const baglar = Array.isArray(e.baglar) ? e.baglar : [];
  const yok = {};
  baglar.forEach(function (b) { [b.a, b.b].forEach(function (x) { if (!kisiVar(x) && !yok[x]) { yok[x] = true; ekle("bilgi", "Bağlarda geçen “" + x + "” kişiler arasında yok.", "kisiler"); } }); });
  const aile = evrAile(e);
  const yas = function (ad) { const k = kisiler.find(function (x) { return evaAd(x.ad) === evaAd(ad); }); return k ? evrSayi(k.yas) : null; };
  Object.keys(aile.ebeveyn).forEach(function (c) {
    aile.ebeveyn[c].forEach(function (p) {
      const yp = yas(p), yc = yas(c);
      if (yp !== null && yc !== null && yp <= yc) { ekle("hata", p + ", " + c + "’nın ebeveyni ama yaşı (" + yp + ") çocuğundan (" + yc + ") büyük değil.", "kisiler"); }
      if ((aile.ebeveyn[p] || []).indexOf(c) !== -1) { ekle("hata", p + " ile " + c + " birbirinin ebeveyni görünüyor.", "kisiler"); }
    });
    if (aile.ebeveyn[c].length > 2) { ekle("uyari", c + " için ikiden çok ebeveyn yazılmış.", "kisiler"); }
  });

  /* kişilerin yaşadığı yerler */
  const yerAdlari = evrListe(e, "yerler").map(function (y) { return evaAd(y.ad); })
    .concat((((e.harita || {}).yerler) || []).map(function (y) { return evaAd(y.ad); }));
  const soruldu = {};
  kisiler.forEach(function (k) {
    const y = evaAd(k.yer);
    if (y && yerAdlari.length && yerAdlari.indexOf(y) === -1 && !soruldu[y]) { soruldu[y] = true; ekle("bilgi", "“" + k.yer + "” (" + k.ad + "’nın yeri) ne yerlerde ne haritada var.", "dunya"); }
  });

  /* takvim */
  const aylar = evrListe(e, "aylar");
  aylar.forEach(function (a) { if (String(a.gun || "").trim() && !(evrSayi(a.gun) > 0)) { ekle("uyari", "“" + (a.ad || "Adsız ay") + "” ayının gün sayısı sayı değil.", "zaman"); } });
  evrListe(e, "etkinlikler").forEach(function (x) {
    if (aylar.length && String(x.ay || "").trim() && evrAyBul(aylar, x.ay) === -1) { ekle("hata", "“" + (x.ad || "Özel gün") + "” takvimde olmayan bir ayda: " + x.ay + ".", "zaman"); }
    const i = evrAyBul(aylar, x.ay), g = evrSayi(x.gun);
    if (i !== -1 && g !== null) { const en = evrSayi(aylar[i].gun) || 30; if (g < 1 || g > en) { ekle("hata", "“" + (x.ad || "Özel gün") + "” " + aylar[i].ad + " ayının " + g + ". gününde ama o ay " + en + " gün.", "zaman"); } }
  });

  /* tarih sırası: çağ içinde sayısal zamanlar geriye gitmesin */
  const tarih = evrListe(e, "tarih");
  let onceki = null, cag = null;
  tarih.forEach(function (x) {
    const c = String(x.cag || "").trim(), z = evrSayi(x.zaman);
    if (c !== cag) { cag = c; onceki = null; }
    if (z !== null && onceki !== null && z < onceki) { ekle("uyari", "Tarihte “" + (x.zaman) + "” bir önceki olaydan önce ama listede sonra: sırayı kontrol et.", "zaman"); }
    if (z !== null) { onceki = z; }
  });

  /* belgeler */
  evrListe(e, "belgeler").forEach(function (b) {
    if (!String(b.metin || "").trim()) { ekle("uyari", "“" + (b.baslik || b.tur || "Belge") + "” belgesinin metni boş.", "belgeler"); }
    [b.kimden, b.kime].forEach(function (x) { if (String(x || "").trim() && adlar.length && !kisiVar(x) && !yok["b:" + x]) { yok["b:" + x] = true; ekle("bilgi", "Belgelerde geçen “" + x + "” kişiler arasında yok.", "belgeler"); } });
  });
  if (!String(e.ozet || "").trim()) { ekle("uyari", "Evrenin anlatımı boş: gezginler ilk bunu okur.", "temel"); }
  return l;
}

function evrDenetimHtml(e) {
  const l = evrDenetim(e);
  const ikon = { hata: "⛔", uyari: "⚠", bilgi: "ℹ" };
  return '<details class="evr-denetim"' + (l.some(function (x) { return x.seviye === "hata"; }) ? " open" : "") + '><summary><b>Tutarlılık denetimi</b> · ' +
    (l.length ? l.length + " not" : "her şey yerli yerinde") + "</summary>" +
    (l.length ? '<ul class="evr-denetim-liste">' + l.map(function (x) {
      return '<li class="evr-denetim-' + x.seviye + '"><span aria-hidden="true">' + ikon[x.seviye] + "</span> " + kacir(x.mesaj) +
        ' <button type="button" class="ic-bag" data-evr-adim="' + x.adim + '">düzelt</button></li>';
    }).join("") + "</ul>" : '<p class="oyun-not">Kişiler, bağlar, takvim, tarih ve belgeler birbiriyle çelişmiyor.</p>') + "</details>";
}

/* ==================== 2. isim üretici ==================== */

const EVR_HECE = ["ka", "ri", "lo", "ve", "sa", "mir", "ta", "na", "el", "or", "zu", "ba", "len", "ki", "ro", "sel", "dan", "ya", "ol", "in", "mar", "tu", "er", "ae"];

/** Evrenin kendi adlarından hece çıkarır, onlarla yeni adlar kurar. */
function evrIsimler(e, n) {
  const kaynak = evrListe(e, "kisiler").map(function (k) { return k.ad; }).concat(evrListe(e, "yerler").map(function (y) { return y.ad; }))
    .concat((((e.harita || {}).yerler) || []).map(function (y) { return y.ad; })).concat(evrListe(e, "sozluk").map(function (s) { return s.terim; }));
  const heceler = [];
  kaynak.forEach(function (ad) {
    String(ad || "").toLocaleLowerCase("tr").split(/[^a-zçğıöşü]+/).forEach(function (s) {
      const p = s.match(/[^aeıioöuü]*[aeıioöuü]+(?:[^aeıioöuü](?![aeıioöuü]))?/g) || [];
      p.forEach(function (h) { if (h.length >= 2 && h.length <= 4 && heceler.indexOf(h) === -1) { heceler.push(h); } });
    });
  });
  const havuz = heceler.length >= 6 ? heceler : heceler.concat(EVR_HECE);
  const l = [];
  let tur = 0;
  while (l.length < (n || 8) && tur++ < 200) {
    const say = 2 + (Math.random() < 0.35 ? 1 : 0);
    let ad = "";
    for (let i = 0; i < say; i++) { ad += havuz[Math.floor(Math.random() * havuz.length)]; }
    ad = ad.replace(/(.)\1\1+/g, "$1$1");
    if (ad.length < 3 || ad.length > 11) { continue; }
    ad = ad.charAt(0).toLocaleUpperCase("tr") + ad.slice(1);
    if (l.indexOf(ad) === -1 && kaynak.map(evaAd).indexOf(evaAd(ad)) === -1) { l.push(ad); }
  }
  return l;
}

function evrIsimHtml(e) {
  return '<div class="evr-isim" data-evr-isim-kutu><button type="button" class="dugme dugme-sade" data-evr-isim>🎲 İsim öner</button>' +
    '<span class="oyun-not">Evreninin kendi adlarının seslerinden. Birine dokun: ilk boş “Adı” kutusuna yazılır.</span><div class="evr-isim-liste"></div></div>';
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evr-isim], [data-evr-isim-sec]");
  if (!b || typeof EVS === "undefined" || !EVS || EVS.kaynak !== "benim") { return; }
  if (b.hasAttribute("data-evr-isim")) {
    const e = evrenBenimBul(EVS.id);
    const l = b.parentNode.querySelector(".evr-isim-liste");
    if (e && l) { l.innerHTML = evrIsimler(e, 8).map(function (a) { return '<button type="button" class="evg-cip" data-evr-isim-sec="' + kacir(a) + '">' + kacir(a) + "</button>"; }).join(""); }
    return;
  }
  const ad = b.getAttribute("data-evr-isim-sec");
  const bos = Array.from(document.querySelectorAll('#evrenSayfa .evr-kurucu [data-fan-alan$=".ad"]')).find(function (g) { return !g.value.trim(); });
  if (bos) {
    bos.value = ad;
    bos.dispatchEvent(new Event("input", { bubbles: true }));
    bos.focus();
    if (typeof eckaBildir === "function") { eckaBildir("“" + ad + "” yazıldı"); }
  } else if (typeof panoyaKopyala === "function") {
    panoyaKopyala(ad).then(function () { if (typeof eckaBildir === "function") { eckaBildir("“" + ad + "” kopyalandı (boş ad kutusu yok: önce + ekle)"); } });
  }
});

/* ==================== 3. Evrengezer izni kodu (fan-made evrende) ==================== */

const EVR_EG_IZIN = "tf30_eg_izin";   /* { evrenId: true } bu cihazda Evrengezer izni kodu girildi */

function evrEgIzinOzeti(eid, kod) { return dogrulamaOzeti("egizin|" + eid + "|" + String(kod || "").trim().toUpperCase()); }
function evrEgIzinVar(eid) { const d = jsonOku(EVR_EG_IZIN, {}) || {}; return !!d[eid]; }

if (typeof evrenEkTemizle === "function") {
  const eskiEk30c = evrenEkTemizle;
  window.evrenEkTemizle = function (ham, e) {
    eskiEk30c.apply(this, arguments);
    const l = (Array.isArray(ham.egIzinleri) ? ham.egIzinleri : []).slice(0, 20).filter(function (x) { return x && /^[0-9a-f]{64}$/.test(x.oz || ""); })
      .map(function (x) { return { oz: x.oz, not: fanMetin(x.not, 40), t: fanMetin(x.t, 30) }; });
    if (l.length) { e.egIzinleri = l; }
  };
}

/* izin kodu girmiş kişi de "yetkili" sayılır (83-evren-atolyesi.js) */
if (typeof evaYetkili === "function") {
  const eskiYet30 = evaYetkili;
  window.evaYetkili = function (s) { return eskiYet30.apply(this, arguments) || !!(s && s.id && evrEgIzinVar(s.id)); };
}

function evrEgIzinYonetHtml(e) {
  if (e.durum === "kanonAday") { return ""; }
  const l = e.egIzinleri || [];
  return '<div class="evr-izin"><h4>Evrengezer izni</h4><p class="oyun-not">Fan-made evrenine Evrengezerleri yalnızca sen getirirsin. Birine izin vermek için kod üret ve ona gönder: ' +
      "kodu evrenin sayfasında girince Evrengezer hikâyesi yazabilir. İstediğin zaman geri alırsın (sonraki dosya sürümünde geçersiz olur).</p>" +
    (l.length ? '<ul class="evr-izin-liste">' + l.map(function (x, i) {
      return "<li>" + kacir(x.not || "İzin " + (i + 1)) + ' <span class="oyun-not">' + kacir(String(x.t || "").slice(0, 10)) + '</span> <button type="button" class="ic-bag y-sil" data-evr-izin-sil="' + i + '">geri al</button></li>';
    }).join("") + "</ul>" : "") +
    '<div class="oyun-sira"><input class="kod-giris" id="evrIzinNot" maxlength="40" placeholder="Kime? (ör. Ayşe)" aria-label="İzin kimin için">' +
    '<button type="button" class="dugme dugme-sade" data-evr-izin-uret>İzin kodu üret</button></div><p class="pencere-durum" id="evrIzinDurum" role="status"></p></div>';
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evr-izin-uret], [data-evr-izin-sil], [data-evr-izin-gir]");
  if (!b || typeof EVS === "undefined" || !EVS) { return; }
  if (b.hasAttribute("data-evr-izin-gir")) {
    const g = document.querySelector("#evrIzinKod");
    const e = fanSiteListesi("evren").find(function (x) { return x.id === EVS.id; }) || (typeof fanAcilanlar === "function" ? fanAcilanlar() : []).find(function (x) { return x.id === EVS.id; });
    const d = document.querySelector("#evrIzinGirDurum");
    if (!e || !g) { return; }
    const oz = evrEgIzinOzeti(e.id, g.value);
    if ((e.egIzinleri || []).some(function (x) { return x.oz === oz; })) {
      const k = jsonOku(EVR_EG_IZIN, {}) || {}; k[e.id] = true; jsonYaz(EVR_EG_IZIN, k);
      if (d) { d.className = "pencere-durum iyi"; d.textContent = "İzin açıldı: bu evrende Evrengezer hikâyesi yazabilirsin."; }
      setTimeout(evrenSayfaCiz, 900);
    } else if (d) { d.className = "pencere-durum kotu"; d.textContent = "Bu kod bu evren için geçerli değil."; }
    return;
  }
  if (EVS.kaynak !== "benim") { return; }
  if (b.hasAttribute("data-evr-izin-uret")) {
    const harf = "ABCDEFGHJKLMNPRSTUVYZ23456789";
    const r = new Uint32Array(8); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : r.forEach(function (_, i) { r[i] = Math.floor(Math.random() * 1e9); });
    const kod = "EG-" + Array.from(r).map(function (x) { return harf[x % harf.length]; }).join("").replace(/^(.{4})/, "$1-");
    const not = ((document.querySelector("#evrIzinNot") || {}).value || "").trim().slice(0, 40);
    evrenBenimDegistir(EVS.id, function (e) { e.egIzinleri = (e.egIzinleri || []).concat([{ oz: evrEgIzinOzeti(e.id, kod), not: not, t: new Date().toISOString() }]).slice(-20); });
    evrenSayfaCiz();
    const d = document.querySelector("#evrIzinDurum");
    if (d) { d.className = "pencere-durum iyi"; d.innerHTML = "Kod: <b>" + kacir(kod) + "</b> — bunu yalnızca bir kez görürsün; şimdi kopyala ve gönder. Evrenini yeniden yayınlayınca (dosya ya da yazara gönder) geçerli olur."; }
    if (typeof panoyaKopyala === "function") { panoyaKopyala(kod).catch(function () { /* elle kopyalar */ }); }
    return;
  }
  const i = Number(b.getAttribute("data-evr-izin-sil"));
  evrenBenimDegistir(EVS.id, function (e) { (e.egIzinleri || []).splice(i, 1); if (!(e.egIzinleri || []).length) { delete e.egIzinleri; } });
  evrenSayfaCiz();
});

/* ==================== 4. Kurucu'ya bağlama ==================== */

if (typeof evrKurucuHtml === "function") {
  const eskiKH30b = evrKurucuHtml;
  window.evrKurucuHtml = function (v) {
    let h = eskiKH30b.apply(this, arguments);
    const e = v.eser;
    const adim = EVR_ADIM[e.id] || "temel";
    /* başlıkta denetim sayısı */
    const n = evrDenetim(e).filter(function (x) { return x.seviye !== "bilgi"; }).length;
    if (n) { h = h.replace('<nav class="evr-adimlar"', '<button type="button" class="evr-denetim-rozet" data-evr-adim="paylas">⚠ ' + n + " tutarlılık notu</button><nav class=\"evr-adimlar\""); }
    if (adim === "kisiler" || adim === "dunya") { h = h.replace('<div class="fan-form evr-form"', evrIsimHtml(e) + '<div class="fan-form evr-form"'); }
    if (adim === "paylas") {
      const i = h.indexOf('<div class="eva-yollar">');
      const ek = evrDenetimHtml(e) + '<div class="oyun-sira"><button type="button" class="dugme dugme-sade" data-evr-kart="benim:' + kacir(e.id) + '">🖼 Evren kartı (hikâye)</button></div>';
      h = i === -1 ? h + ek : h.slice(0, i) + ek + h.slice(i);
      const j = h.indexOf('<div class="oyun-sira"><button class="dugme" data-fan-onizle');
      if (j !== -1 && e.durum !== "kanonAday") { h = h.slice(0, j) + evrEgIzinYonetHtml(e) + h.slice(j); }
    }
    return h;
  };
}

/* ==================== 5. okur: evren turu, yazılanlar rafı, izin kodu, kart ==================== */

const EVR_TUR_GORULEN = "tf30_tur_gorulen";
let evrTurAdim = 0;

function evrTurAdimlari(e) {
  const kisiler = evrListe(e, "kisiler");
  const baglar = Array.isArray(e.baglar) ? e.baglar : [];
  const onemli = kisiler.slice().sort(function (a, b) {
    const n = function (k) { return baglar.filter(function (x) { return x.a === k.ad || x.b === k.ad; }).length; };
    return n(b) - n(a);
  })[0];
  const yer = (((e.harita || {}).yerler) || []).length;
  const belge = evrListe(e, "belgeler")[0], olay = evrListe(e, "tarih")[0];
  const l = [];
  if (String(e.ozet || "").trim()) { l.push({ b: "Bu evren", m: evrKisa(String(e.ozet).replace(/\s+/g, " "), 240) }); }
  if (onemli) { l.push({ b: "Tanışman gereken biri", m: onemli.ad + (onemli.rol ? " — " + onemli.rol : "") + (onemli.aciklama ? ". " + evrKisa(onemli.aciklama, 160) : ""), git: "bilgi" }); }
  if (yer) { l.push({ b: "Harita", m: yer + " yer var. Haritada bir yere dokununca hikâyesini okursun.", git: "harita" }); }
  if (belge) { l.push({ b: "Evrenin içinden bir yazı", m: (belge.tur ? belge.tur + ": " : "") + evrKisa(belge.metin, 200) }); }
  else if (olay) { l.push({ b: "Bir an", m: (olay.zaman ? olay.zaman + " — " : "") + evrKisa(olay.olay, 200) }); }
  const lore = (e.lorlar || []).length;
  if (lore) { l.push({ b: "Gizli katmanlar", m: lore + " kilitli katman var. Kodları evrenin içinde, dikkatli okuyana saklı.", git: "lore" }); }
  return l;
}

function evrTurHtml(v) {
  const l = evrTurAdimlari(v.eser);
  if (l.length < 3) { return ""; }
  const i = Math.max(0, Math.min(evrTurAdim, l.length - 1));
  const a = l[i];
  return '<section class="evr-tur" aria-label="Evren turu"><div class="evr-tur-ust"><span class="evs-rozet">Evren turu · ' + (i + 1) + " / " + l.length + "</span>" +
      '<button type="button" class="pencere-kapat" data-evr-tur="kapat" aria-label="Turu kapat">✕</button></div>' +
    "<h3>" + kacir(a.b) + "</h3><p>" + kacir(a.m) + "</p>" +
    '<div class="oyun-sira">' + (i > 0 ? '<button type="button" class="dugme dugme-sade" data-evr-tur="geri">← Önceki</button>' : "") +
      (a.git ? '<button type="button" class="dugme dugme-sade" data-evr-tur-git="' + a.git + '">Git</button>' : "") +
      (i < l.length - 1 ? '<button type="button" class="dugme" data-evr-tur="ileri">Sonraki →</button>' : '<button type="button" class="dugme" data-evr-tur="kapat">Turu bitir</button>') +
    "</div></section>";
}

function evrTurKey() { return EVS ? EVS.kaynak + ":" + EVS.id : ""; }
function evrTurGoruldu() { const d = jsonOku(EVR_TUR_GORULEN, {}) || {}; return !!d[evrTurKey()]; }

if (typeof evrenSayfaCiz === "function") {
  const eskiESC30 = evrenSayfaCiz;
  window.evrenSayfaCiz = function () {
    const r = eskiESC30.apply(this, arguments);
    try {
      if (!EVS || ["fan", "acilan"].indexOf(EVS.kaynak) === -1 || (EVS.turAcik !== true && evrTurGoruldu())) { return r; }
      const v = evrenSayfaVerisi();
      const g = document.querySelector("#evrenSayfa .evs-govde");
      if (!v || v.kilitli || !g || g.querySelector(".evr-tur")) { return r; }
      const h = evrTurHtml(v);
      if (h) { g.insertAdjacentHTML("afterbegin", h); }
    } catch (_) { /* tur olmadan devam */ }
    return r;
  };
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evr-tur], [data-evr-tur-ac], [data-evr-tur-git]");
  if (!b || !EVS) { return; }
  if (b.hasAttribute("data-evr-tur-git")) { EVS.sekme = b.getAttribute("data-evr-tur-git"); evrenSayfaCiz(); return; }
  if (b.hasAttribute("data-evr-tur-ac")) { EVS.turAcik = true; evrTurAdim = 0; evrenSayfaCiz(); return; }
  const y = b.getAttribute("data-evr-tur");
  if (y === "kapat") {
    const d = jsonOku(EVR_TUR_GORULEN, {}) || {}; d[evrTurKey()] = true; jsonYaz(EVR_TUR_GORULEN, d);
    EVS.turAcik = false; evrTurAdim = 0;
  } else { evrTurAdim += y === "ileri" ? 1 : -1; }
  evrenSayfaCiz();
});

/** Bu evrende geçen hikâyeler: sitedekiler ve senin taslakların. */
function evrYazilanlar(ad) {
  const a = evaAd(ad);
  if (!a) { return []; }
  const l = [];
  fanSiteListesi("hikaye").forEach(function (h) { if (evaAd(h.evren) === a) { l.push({ h: h, git: "#/fan/hikaye/" + encodeURIComponent(h.id), kaynak: "site" }); } });
  fanEserlerim().forEach(function (h) { if (h.tur === "hikaye" && evaAd(h.evren) === a) { l.push({ h: h, kaynak: "benim" }); } });
  return l;
}

function evrRafHtml(ad) {
  const l = evrYazilanlar(ad);
  if (!l.length) { return '<p class="oyun-not">Bu evrende henüz hikâye yok. İlkini sen yaz.</p>'; }
  return '<div class="evr-raf"><div class="oyun-etiket">Bu evrende yazılanlar · ' + l.length + "</div><ul>" + l.slice(0, 12).map(function (x) {
    const kon = (x.h.konuklar || []).length;
    return "<li>" + (x.git ? '<a href="' + kacir(x.git) + '">' + kacir(fanAd(x.h)) + "</a>" : '<button type="button" class="ic-bag" data-evr-taslak="' + kacir(x.h.id) + '">' + kacir(fanAd(x.h)) + "</button> <span class=\"oyun-not\">taslağın</span>") +
      (x.h.yazar ? ' <span class="oyun-not">· ' + kacir(x.h.yazar) + "</span>" : "") + (kon ? ' <span class="eva-rozet benim">Evrengezer</span>' : "") + "</li>";
  }).join("") + "</ul></div>";
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evr-taslak]");
  if (!b) { return; }
  fanSecili.hikaye = b.getAttribute("data-evr-taslak"); fanSekme.hikaye = "yaz";
  if (typeof evrenSayfaKapat === "function") { evrenSayfaKapat(); }
  location.hash = "#/fan";
  setTimeout(function () { fanHikayeCiz(); const a = document.querySelector("#fanHikayeAlan"); if (a) { a.scrollIntoView({ block: "start" }); } }, 150);
});

if (typeof evaEylemHtml === "function") {
  const eskiEE30 = evaEylemHtml;
  window.evaEylemHtml = function (v) {
    const h = eskiEE30.apply(this, arguments);
    if (!h) { return h; }
    const ad = evaEvrenAdi(v);
    const s = EVS.kaynak === "fan" ? evaStatu(ad) : { tur: "kanon" };
    const izin = s.tur === "fan" && !evaYetkili(s) && (s.eser && (s.eser.egIzinleri || []).length)
      ? '<details class="evr-izin-gir"><summary>Evrengezer izni kodun var mı?</summary><div class="oyun-sira"><input class="kod-giris" id="evrIzinKod" placeholder="EG-…" aria-label="Evrengezer izni kodu">' +
        '<button type="button" class="dugme dugme-sade" data-evr-izin-gir>Gir</button></div><p class="pencere-durum" id="evrIzinGirDurum" role="status"></p></details>'
      : (s.tur === "fan" && evaYetkili(s) ? '<p class="oyun-not">✓ Bu evrene Evrengezer getirme iznin var.</p>' : "");
    const ek = '<div class="oyun-sira">' + (EVS.kaynak === "fan" ? '<button type="button" class="dugme dugme-sade" data-evr-tur-ac>🧭 Evren turu</button>' : "") +
      '<button type="button" class="dugme dugme-sade" data-evr-kart="' + kacir(EVS.kaynak + ":" + EVS.id) + '">🖼 Evren kartı</button></div>';
    return h.replace(/<\/div>$/, izin + evrRafHtml(ad) + ek + "</div>");
  };
}

/* evren kartı: Instagram hikâyesi (1080×1920) */
async function evrKartUret(e) {
  if (typeof kartFontlariHazir !== "function") { return null; }
  await kartFontlariHazir();
  const EN = 1080, BOY = 1920;
  const t = document.createElement("canvas");
  t.width = EN; t.height = BOY;
  const c = t.getContext && t.getContext("2d");
  if (!c) { return null; }
  kartZemin(c, EN, BOY);
  const sol = 110, gen = EN - 220;
  c.fillStyle = KART_RENK.deniz; c.fillRect(sol, 170, 6, 64);
  const s = evaStatu(e.ad);
  const etiket = e.kanon === true || s.tur === "kanon" ? "Kanon evren" : (s.tur === "test" ? "Test evreni" : ((e.test === true || s.test) ? "Test · fan-made evren" : "Fan-made evren"));
  kartEtiket(c, etiket + (e.yazar ? " · " + e.yazar : ""), sol + 26, 214, KART_RENK.murekkep2, 26);
  let y = 330, px = 124;
  c.fillStyle = KART_RENK.murekkep; c.font = KART_FONT.baslik(px);
  let sat = kartSar(c, e.ad || "Adsız evren", gen);
  while (sat.length > 2 && px > 64) { px -= 8; c.font = KART_FONT.baslik(px); sat = kartSar(c, e.ad || "", gen); }
  sat.slice(0, 2).forEach(function (x) { y += px; c.fillText(x, sol, y); });
  y += 40; c.font = KART_FONT.yazi(42, true); c.fillStyle = KART_RENK.deniz;
  kartSar(c, String(e.ozet || "").replace(/\s+/g, " ").slice(0, 220), gen).slice(0, 4).forEach(function (x) { y += 56; c.fillText(x, sol, y); });
  /* haritanın küçük hâli: yerler nokta olarak */
  const yerler = (((e.harita || {}).yerler) || []).slice(0, 80);
  const hy = y + 70, hb = 560;
  c.strokeStyle = KART_RENK.deniz; c.lineWidth = 3; c.strokeRect(sol, hy, gen, hb);
  c.fillStyle = "rgba(28,92,150,.08)"; c.fillRect(sol, hy, gen, hb);
  yerler.forEach(function (p) {
    const x = sol + 20 + (gen - 40) * (Number(p.x) || 50) / 100, yy = hy + 20 + (hb - 40) * (Number(p.y) || 50) / 100;
    c.fillStyle = KART_RENK.deniz; c.beginPath(); c.arc(x, yy, 9, 0, Math.PI * 2); c.fill();
  });
  if (!yerler.length) { kartEtiket(c, "Harita henüz çizilmedi", sol + 30, hy + hb / 2, KART_RENK.murekkep2, 26); }
  y = hy + hb + 90;
  const o = evrOlcek(e);
  c.font = KART_FONT.mono(34, true); c.fillStyle = KART_RENK.murekkep;
  c.fillText("TÖMYE ÖLÇEĞİ %" + o.yuzde, sol, y);
  y += 60; c.font = KART_FONT.yazi(34); c.fillStyle = KART_RENK.murekkep2;
  const sayilar = o.satir.filter(function (r) { return r.n; }).slice(0, 6).map(function (r) { return r.n + " " + r.ad.split(" (")[0].toLocaleLowerCase("tr"); }).join(" · ");
  kartSar(c, sayilar || "Yeni kuruluyor", gen).slice(0, 2).forEach(function (x) { c.fillText(x, sol, y); y += 48; });
  kartEtiket(c, "Evren Atölyesi", sol, BOY - 190, KART_RENK.murekkep2, 22);
  kartEtiket(c, "TentiforApp · " + KART_ADRES, sol, BOY - 130, KART_RENK.yarik, 24);
  return t;
}

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evr-kart]");
  if (!b) { return; }
  const p = b.getAttribute("data-evr-kart").split(":");
  /* açık evren sayfasında tam veri (sitedeki fan evreninin özeti değil, inmiş dosyası) */
  const acik = typeof EVS !== "undefined" && EVS && EVS.kaynak === p[0] && EVS.id === p[1] ? (evrenSayfaVerisi() || {}).eser : null;
  const e = acik || (p[0] === "benim" ? evrenBenimBul(p[1]) : (p[0] === "fan" ? fanSiteListesi("evren").find(function (x) { return x.id === p[1]; }) : null));
  if (!e) { return; }
  const t = await evrKartUret(e);
  if (!t) { if (typeof eckaBildir === "function") { eckaBildir("Tarayıcı görsel üretmeyi desteklemiyor"); } return; }
  const s = await kartPaylas(t, (typeof fanSlug === "function" ? fanSlug(e.ad || "evren") : "evren") + "-kart.png", (e.ad || "Evren") + " — TentiforApp evreni");
  if (s && typeof eckaBildir === "function") { eckaBildir(s); }
});

/* ==================== 6. Evrengezerler: hepsi E25'te ==================== */

/** Bütün eserlerdeki konuk Evrengezerler (sitedeki hikâye ve evrenler, senin taslakların, açtığın dosyalar). */
function evrKonukHavuzu() {
  const l = [];
  const tara = function (liste, nerede) {
    (liste || []).forEach(function (x) { (x.konuklar || []).forEach(function (k) { l.push({ k: k, eser: x, nerede: nerede }); }); });
  };
  tara(fanSiteListesi("hikaye"), "site"); tara(fanSiteListesi("evren"), "site");
  tara(fanEserlerim().filter(function (x) { return x.tur !== "kisi"; }), "benim");
  tara(typeof fanAcilanlar === "function" ? fanAcilanlar() : [], "acilan");
  return l;
}

if (typeof e25Kisileri === "function") {
  window.e25Kisileri = function () {
    const gorulen = {};
    const l = [];
    const ekle = function (e, kaynak, konuk) {
      if (!e || e.tur !== "kisi" || !e.id || gorulen[e.id]) { return; }
      gorulen[e.id] = true;
      l.push({ e: e, kaynak: kaynak, konuk: !!konuk });
    };
    /* nerede yaratılmış olursa olsun (e.evren) her Evrengezer E25'te doğar ve burada görünür */
    fanEserlerim().forEach(function (e) { ekle(e, "benim"); });
    fanSiteListesi("kisi").forEach(function (e) { ekle(e, "site"); });
    fanAcilanlar().forEach(function (e) { ekle(e, "acilan"); });
    evrKonukHavuzu().forEach(function (x) { ekle(typeof kisiTemizle === "function" ? kisiTemizle(x.k) : x.k, "site", true); });
    return l;
  };
}

/* konuk olarak bulunan Evrengezer: kisiBul onu da bulsun (götür, kart) */
if (typeof kisiBul === "function") {
  const eskiKB30 = kisiBul;
  window.kisiBul = function (kaynak, id) {
    const e = eskiKB30.apply(this, arguments);
    if (e) { return e; }
    const x = evrKonukHavuzu().find(function (y) { return y.k && y.k.id === id; });
    return x ? (typeof kisiTemizle === "function" ? kisiTemizle(x.k) : x.k) : null;
  };
}

function evrKonukYerleri(id) {
  const l = [];
  evrKonukHavuzu().forEach(function (x) {
    if (!x.k || x.k.id !== id) { return; }
    const ad = fanAd(x.eser) + (x.eser.tur === "hikaye" && x.eser.evren ? " (" + x.eser.evren + ")" : "");
    if (l.indexOf(ad) === -1) { l.push(ad); }
  });
  return l;
}

if (typeof kisiKartHtml === "function") {
  const eskiKK30 = kisiKartHtml;
  window.kisiKartHtml = function (x) {
    let h = eskiKK30.apply(this, arguments);
    if (x.konuk) { h = h.replace(" · sitede · ", " · bir esere konuk olarak geldi · "); }
    const yerler = evrKonukYerleri(x.e.id);
    const dogdu = '<p class="oyun-not evr-dogdu">E25’te doğdu' + (x.e.evren && x.e.evren !== "e25" ? " · ilk göründüğü evren: " + kacir(String(x.e.evren).toUpperCase()) : "") + "</p>";
    const gez = yerler.length ? '<p class="oyun-not evr-gezdi"><b>Göründüğü yerler:</b> ' + yerler.slice(0, 8).map(kacir).join(" · ") + (yerler.length > 8 ? " …" : "") + "</p>" : "";
    return h.replace(/<\/div>$/, dogdu + gez + "</div>");
  };
}

/* E25 listesi kalabalıklaşınca: ara */
if (typeof e25KisilerHtml === "function") {
  const eskiE25H = e25KisilerHtml;
  window.e25KisilerHtml = function () {
    const h = eskiE25H.apply(this, arguments);
    const n = e25Kisileri().length;
    if (n < 6) { return h; }
    return h.replace('<h3 class="evs-ara-baslik">Okurların Evrengezerleri</h3>', '<h3 class="evs-ara-baslik">Okurların Evrengezerleri · ' + n + "</h3>" +
      '<input class="kod-giris e25-ara" id="e25Ara" type="search" placeholder="Evrengezer ara (ad, unvan, yaratan)" aria-label="Evrengezer ara">');
  };
}
document.addEventListener("input", function (ev) {
  if (!ev.target || ev.target.id !== "e25Ara") { return; }
  const q = ev.target.value.trim().toLocaleLowerCase("tr");
  document.querySelectorAll(".e25-kisiler .kisi-kart").forEach(function (k) { k.hidden = !!q && k.textContent.toLocaleLowerCase("tr").indexOf(q) === -1; });
});

/* ==================== 7. evrenler arası geçitler haritası (Evren Atölyesi) ==================== */

function evrGecitAgi() {
  const dugum = {}, bag = [];
  const d = function (id, ad, tur) { if (!dugum[id]) { dugum[id] = { id: id, ad: ad, tur: tur }; } return id; };
  const hedef = function (g) {
    if (/^#\/arsiv$/.test(g)) { return d("site:tomye", "Tömye", "kanon"); }
    if (/^#\/ev\/e99$/.test(g)) { return d("e99", "E99", "kanon"); }
    if (/^#\/claude$/.test(g)) { return d("site:claude", "Claude'un Evreni", "test"); }   /* 3.1.1: test evreni, kanon değil */
    const m = /^#\/ev\/(site|fan|benim)\/([\w-]+)$/.exec(g || "");
    if (!m) { return null; }
    if (m[1] === "site") { const k = (veri.kanonEvrenleri || {})[m[2]]; return d("site:" + m[2], (k && k.ad) || m[2].toUpperCase(), "kanon"); }
    if (m[1] === "fan") { const e = fanSiteListesi("evren").find(function (x) { return x.id === m[2]; }); return e ? d("fan:" + e.id, e.ad, e.kanon === true ? "kanon" : (e.test ? "test" : "fan")) : null; }
    const b = evrenBenimBul(m[2]); return b ? d("benim:" + b.id, b.ad || "Adsız evren", "benim") : null;
  };
  const yerler = function (e) { const l = ((e.harita || {}).yerler || []).slice(); (e.gezegenler || []).forEach(function (g) { (((g.harita || {}).yerler) || []).forEach(function (y) { l.push(y); }); }); return l; };
  const isle = function (id, e) { yerler(e).forEach(function (y) { if (y.gecit) { const h = hedef(y.gecit); if (h && h !== id) { bag.push({ a: id, b: h, etiket: y.ad || "geçit", tur: "gecit" }); } } }); };
  /* sitedeki fan evreninin haritası ayrı dosyasında: inmişse (EVD_BELLEK) ondan */
  fanSiteListesi("evren").forEach(function (e) { isle(d("fan:" + e.id, e.ad, e.kanon === true ? "kanon" : (e.test ? "test" : "fan")), (typeof EVD_BELLEK !== "undefined" && EVD_BELLEK[e.id]) || e); });
  fanEserlerim().filter(function (e) { return e.tur === "evren" && !e.e99; }).forEach(function (e) { isle(d("benim:" + e.id, e.ad || "Adsız evren", "benim"), e); });
  /* Evrengezer yolculukları: E25 → konuk olduğu evren */
  const e25 = d("site:e25", "E25", "kanon");
  evrKonukHavuzu().forEach(function (x) {
    let h = null;
    if (x.eser.tur === "evren") { h = x.nerede === "benim" ? hedef("#/ev/benim/" + x.eser.id) : hedef("#/ev/fan/" + x.eser.id); }
    else if (x.eser.evren) {
      const s = evaStatu(x.eser.evren);
      h = s.tur === "benim" ? hedef("#/ev/benim/" + s.id) : (s.id ? hedef("#/ev/fan/" + s.id) : (s.tur === "kanon" ? d("kanon:" + evaAd(s.ad), s.ad, "kanon") : null));
    }
    if (h && h !== e25 && !bag.some(function (b) { return b.a === e25 && b.b === h && b.etiket === x.k.ad; })) { bag.push({ a: e25, b: h, etiket: x.k.ad, tur: "gezgin" }); }
  });
  const kullanilan = {};
  bag.forEach(function (b) { kullanilan[b.a] = kullanilan[b.b] = true; });
  return { dugumler: Object.keys(dugum).filter(function (k) { return kullanilan[k]; }).map(function (k) { return dugum[k]; }), baglar: bag };
}

function evrGecitSvg() {
  const g = evrGecitAgi();
  if (!g.baglar.length) { return '<p class="oyun-not">Henüz evrenler arasında geçit yok. Haritanda bir yere “geçit” ekle ya da bir Evrengezeri başka bir evrene götür.</p>'; }
  const n = g.dugumler.length, W = 360, H = 300, cx = W / 2, cy = H / 2, R = Math.min(120, 50 + n * 10);
  const yer = {};
  g.dugumler.forEach(function (x, i) { const a = -Math.PI / 2 + i / n * Math.PI * 2; yer[x.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
  const esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };
  const cizgi = g.baglar.map(function (b) {
    const p = yer[b.a], q = yer[b.b];
    return '<line class="evr-gecit-' + b.tur + '" x1="' + p.x.toFixed(1) + '" y1="' + p.y.toFixed(1) + '" x2="' + q.x.toFixed(1) + '" y2="' + q.y.toFixed(1) + '"><title>' + esc(b.etiket) + "</title></line>";
  }).join("");
  const dug = g.dugumler.map(function (x) {
    const p = yer[x.id];
    return '<g class="evr-gecit-dugum ' + x.tur + '"><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="9"/><text x="' + p.x.toFixed(1) + '" y="' + (p.y + 24).toFixed(1) + '" text-anchor="middle">' + esc(evrKisa(x.ad, 18)) + "</text></g>";
  }).join("");
  return '<figure class="evr-gecit"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Evrenler arası geçitler: ' + esc(g.dugumler.map(function (x) { return x.ad; }).join(", ")) + '">' + cizgi + dug + "</svg>" +
    '<figcaption class="oyun-not"><span class="evr-gecit-anahtar gecit"></span> geçit (haritadaki kapı) · <span class="evr-gecit-anahtar gezgin"></span> Evrengezer yolculuğu (E25’ten)</figcaption>' +
    '<ul class="evr-gecit-liste">' + g.baglar.slice(0, 30).map(function (b) {
      const a = g.dugumler.find(function (x) { return x.id === b.a; }), c = g.dugumler.find(function (x) { return x.id === b.b; });
      return "<li>" + esc(a.ad) + " → " + esc(c.ad) + ' <span class="oyun-not">· ' + (b.tur === "gezgin" ? "Evrengezer " : "geçit ") + esc(b.etiket) + "</span></li>";
    }).join("") + "</ul></figure>";
}

if (typeof evrenAtolyeCiz === "function") {
  const eskiAC30 = evrenAtolyeCiz;
  window.evrenAtolyeCiz = function () {
    eskiAC30.apply(this, arguments);
    const a = document.querySelector("#evrenAtolyeAlan");
    if (a && !a.querySelector(".evr-gecit, .evr-gecit-bos")) { a.insertAdjacentHTML("beforeend", '<h3 class="eva-bolum">Evrenler arası geçitler</h3><div class="evr-gecit-bos">' + evrGecitSvg() + "</div>"); }
  };
  if (typeof GEC_CIZILENLER !== "undefined") { GEC_CIZILENLER.evrenAtolye = "evrenAtolyeCiz"; }
}
