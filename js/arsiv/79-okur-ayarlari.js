/* Sürüm 2.7 — okurun ve oyuncunun zevkine; sunucuya yük bindirmeden (hepsi cihazda).
   Okuma ayarları: uzun metinlerin üstünde "Aa": yazı boyutu, satır aralığı, yazı tipi, zemin (kâğıt, gece), genişlik.
     Bu cihazda saklanır (tf27_okuma; tentiforapp_ ile başlamaz, eşitlemeye girmez).
   Odak modu: "⤢ Odak" üst/alt çubukları ve öbür bölümleri gizler, ekran kararmaz (tarayıcıda Wake Lock, uygulamada
     KeepAwake eklentisi). Çıkış: köşedeki düğme, Esc ya da telefonun geri tuşu.
   İsme dokun: metinde geçen karakter, kişi, madde ve yer adlarının altı noktalı çizilir (CSS Custom Highlight; metne
     dokunulmaz); ada dokununca kısa kart: kim, okudun mu, kaydına git, okuma yolu. Adlar kutu bağlarından
     (76-rozet-baglari.js) ve yalnızca okunan metnin evreninden gelir.
   Altını çiz ve Defterin: vurgulama bütün okuma metinlerinde çalışır; vurgular metinde işaretli görünür, Defterin'de
     kaynağına dönülür, alıntı kartı (PNG) olarak paylaşılır, silinir. Vurgular eskisi gibi tentiforapp_vurgular'da.
   Bugün kartı ve seri: Oyunlar sayfasının başında günün oyunları (✓ oynadıkların) ve üst üste oynanan gün serisi.
     Seri kazanılan günlük oyunların kayıtlarından (oxp_<gün>_…) hesaplanır: yeni kayıt yok. Haftada bir kaçırılan gün
     seriyi bozmaz (buz kalıbı).
   Harita Avı: ipucundan haritada yeri bul; 5 hak, yaklaştıkça sıcak/soğuk. Güne göre herkese aynı yer; kazanınca oyun XP'si. */

const OKUMA_SECICI = ".okuma, .okuma-metin, .mektup-metin, .hikaye-metin, .detay-metin, .roman-metin, .kayit-metin";
const VURGU_SECICI = OKUMA_SECICI + ", .madde-govde";
const HARF27 = "0-9A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû";

/** İç içe olmayan okuma metinleri (içteki ayrıca sayılmaz). */
function okumaAlanlari(kok) {
  return Array.prototype.filter.call((kok || document).querySelectorAll(OKUMA_SECICI), function (el) {
    return !(el.parentElement && el.parentElement.closest(OKUMA_SECICI)) && !el.closest("[contenteditable], .y-panel, #yoneticiAlan");
  });
}

/** Metin düğümleri (okuma çubuğu, düğmeler hariç). */
function metinDugumleri(el) {
  const l = [];
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      const p = n.parentElement;
      /* metnin içindeki bağlantı düğmeleri (terim, çapraz bağ) metnin parçasıdır; öbür düğmeler değil */
      if (!p || !n.data.trim() || p.closest(".oku-cubuk, .oku-yazi, .ok-arac, .rb-serit, button:not([data-terim]):not(.capraz):not(.ic-bag), script, style, svg")) { return NodeFilter.FILTER_REJECT; }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (w.nextNode()) { l.push(w.currentNode); }
  return l;
}

/** Metin içinde (boşluklar tek boşluğa indirgenerek) arama: bulunan yerin Range'i ya da null. */
function metinAraligi(el, aranan) {
  const hedef = String(aranan || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr");
  if (hedef.length < 2) { return null; }
  const dugumler = metinDugumleri(el);
  let s = "";
  const harita = [];   /* s'deki her karakter → [düğüm, offset] */
  let oncekiBlok = null;
  dugumler.forEach(function (n) {
    const blok = n.parentElement.closest("p, li, blockquote, div, h1, h2, h3, h4, figure") || el;
    if (oncekiBlok && blok !== oncekiBlok && s && s[s.length - 1] !== " ") { s += " "; harita.push(harita[harita.length - 1]); }
    oncekiBlok = blok;
    const t = n.data;
    for (let i = 0; i < t.length; i++) {
      const c = /\s/.test(t[i]) ? " " : t[i];
      if (c === " " && (!s || s[s.length - 1] === " ")) { continue; }
      s += c; harita.push([n, i]);
    }
  });
  const i = s.toLocaleLowerCase("tr").indexOf(hedef);
  if (i === -1) { return null; }
  const bas = harita[i], son = harita[i + hedef.length - 1];
  if (!bas || !son) { return null; }
  const r = document.createRange();
  try { r.setStart(bas[0], bas[1]); r.setEnd(son[0], son[1] + 1); } catch (_) { return null; }
  return r;
}

function isaretDestek() { return typeof CSS !== "undefined" && CSS.highlights && typeof Highlight === "function"; }

function gorunurMu(el) { return !!(el.offsetParent || el.closest("#perde:not([hidden])") || el.getClientRects().length); }

/* ==================== okuma ayarları ==================== */

const OKA_ANAHTAR = "tf27_okuma";
const OKA_OLCEK = [0.9, 1, 1.12, 1.25, 1.4, 1.6];
const OKA_SECENEK = {
  aralik: [["", "Sitenin"], ["1.5", "Sık"], ["1.75", "Rahat"], ["2", "Geniş"]],
  yazi: [["", "Sitenin"], ["tirnakli", "Tırnaklı"], ["tirnaksiz", "Tırnaksız"]],
  zemin: [["", "Sitenin"], ["kagit", "Kâğıt"], ["gece", "Gece"]],
  genislik: [["", "Normal"], ["dar", "Dar"], ["genis", "Geniş"]]
};

function okaOku() {
  let a = {};
  try { a = JSON.parse(localStorage.getItem(OKA_ANAHTAR) || "{}") || {}; } catch (_) { a = {}; }
  return { boyut: OKA_OLCEK[a.boyut] ? a.boyut : 1, aralik: a.aralik || "", yazi: a.yazi || "", zemin: a.zemin || "", genislik: a.genislik || "" };
}

function okaYaz(a) {
  try { localStorage.setItem(OKA_ANAHTAR, JSON.stringify(a)); } catch (_) { /* dolu */ }
  okaUygula();
}

function okaUygula() {
  const a = okaOku();
  const h = document.documentElement;
  const olcek = OKA_OLCEK[a.boyut];
  if (olcek !== 1) { h.setAttribute("data-ok-olcek", ""); h.style.setProperty("--ok-olcek", String(olcek)); } else { h.removeAttribute("data-ok-olcek"); h.style.removeProperty("--ok-olcek"); }
  if (a.aralik) { h.setAttribute("data-ok-aralik", ""); h.style.setProperty("--ok-aralik", a.aralik); } else { h.removeAttribute("data-ok-aralik"); h.style.removeProperty("--ok-aralik"); }
  ["yazi", "zemin", "genislik"].forEach(function (k) { if (a[k]) { h.setAttribute("data-ok-" + k, a[k]); } else { h.removeAttribute("data-ok-" + k); } });
  const p = document.querySelector("#okaPanel");
  if (p) { p.innerHTML = okaPanelIc(); }
}

/** Okuma metinlerini hazırlar: temel yazı boyutu (ölçek bunun üstüne) ve uzun metinlerde Aa / Odak düğmeleri. */
function okaHazirla() {
  okumaAlanlari().forEach(function (el) {
    if (!el.hasAttribute("data-ok-temel")) {
      const px = parseFloat(getComputedStyle(el).fontSize) || 17;
      el.style.setProperty("--ok-temel", px + "px");
      el.setAttribute("data-ok-temel", "");
    }
    if (el.hasAttribute("data-ok-arac") || (el.textContent || "").trim().length < 280) { return; }
    el.setAttribute("data-ok-arac", "");
    const a = document.createElement("div");
    a.className = "ok-arac";
    a.innerHTML = '<button type="button" data-oka-ac aria-label="Okuma ayarları" title="Okuma ayarları">Aa</button>' +
      '<button type="button" data-odak-ac aria-label="Odak modu" title="Odak modu: çubuklar gizlenir, ekran kararmaz">⤢ Odak</button>';
    const once = el.previousElementSibling;
    el.parentNode.insertBefore(a, once && once.classList.contains("sesli-dugme") ? once : el);
  });
}

function okaPanelIc() {
  const a = okaOku();
  const sira = function (k, ad) {
    return '<div class="oka-satir"><span class="oka-ad">' + ad + '</span><div class="oka-secim">' + OKA_SECENEK[k].map(function (s) {
      return '<button type="button" class="' + (a[k] === s[0] ? "secili" : "") + '" data-oka="' + k + '" data-deger="' + s[0] + '" aria-pressed="' + (a[k] === s[0]) + '">' + s[1] + "</button>";
    }).join("") + "</div></div>";
  };
  return '<div class="oka-ust"><b>Okuma ayarları</b><button type="button" class="pencere-kapat" data-oka-kapat aria-label="Kapat">✕</button></div>' +
    '<div class="oka-satir"><span class="oka-ad">Yazı boyutu</span><div class="oka-secim">' +
      '<button type="button" data-oka-boyut="-1" aria-label="Küçült"' + (a.boyut <= 0 ? " disabled" : "") + '>A−</button>' +
      '<span class="oka-deger">%' + Math.round(OKA_OLCEK[a.boyut] * 100) + "</span>" +
      '<button type="button" data-oka-boyut="1" aria-label="Büyüt"' + (a.boyut >= OKA_OLCEK.length - 1 ? " disabled" : "") + '>A+</button></div></div>' +
    sira("aralik", "Satır aralığı") + sira("yazi", "Yazı tipi") + sira("zemin", "Zemin") + sira("genislik", "Genişlik") +
    '<p class="oyun-not">Bütün okuma metinlerine uygulanır, bu cihazda saklanır. <button type="button" class="ic-bag" data-oka-sifirla>Sıfırla</button></p>';
}

function okaPanelAc() {
  okaPanelKapat();
  const p = document.createElement("div");
  p.id = "okaPanel";
  p.className = "oka-panel";
  p.setAttribute("role", "dialog");
  p.setAttribute("aria-label", "Okuma ayarları");
  p.innerHTML = okaPanelIc();
  ODAK27.once = document.activeElement;
  document.body.appendChild(p);
  const ilk = p.querySelector("button:not([data-oka-kapat])");
  if (ilk) { ilk.focus({ preventScroll: true }); }
}
function okaPanelKapat() { const p = document.querySelector("#okaPanel"); if (p) { p.remove(); odakGeriVer(); return true; } return false; }

/* açılan kart ve panel kapanınca odak, açan düğmeye döner (klavye, ekran okuyucu) */
const ODAK27 = { once: null };
function odakGeriVer() {
  const o = ODAK27.once;
  ODAK27.once = null;
  if (o && o.isConnected && typeof o.focus === "function") { try { o.focus({ preventScroll: true }); } catch (_) { /* yok */ } }
}

/* ==================== odak modu ==================== */

const ODAK = { acik: false, el: null, kilit: null };

async function ekranAcikTut(ac) {
  const ka = typeof kabukEklenti === "function" ? kabukEklenti("KeepAwake") : null;
  if (ka) {
    try { if (ac) { await ka.keepAwake(); } else { await ka.allowSleep(); } } catch (_) { /* yok */ }
    return;
  }
  if (!navigator.wakeLock) { return; }
  if (ac) {
    try { ODAK.kilit = await navigator.wakeLock.request("screen"); } catch (_) { ODAK.kilit = null; }
  } else if (ODAK.kilit) {
    ODAK.kilit.release().catch(function () { /* bırakıldı */ });
    ODAK.kilit = null;
  }
}

function odakHedef(dugme) {
  let s = dugme.closest(".ok-arac");
  s = s && s.nextElementSibling;
  while (s && !s.matches(OKUMA_SECICI)) { s = s.nextElementSibling; }
  return s;
}

function odakAc(el) {
  if (!el) { return; }
  odakKapat();
  ODAK.acik = true; ODAK.el = el;
  document.documentElement.setAttribute("data-odak", "");
  const bolum = el.closest("main section.bolum");
  if (bolum) { bolum.classList.add("odak-bolum"); }
  el.classList.add("odak-hedef");
  const c = document.createElement("button");
  c.type = "button";
  c.className = "odak-cik";
  c.setAttribute("data-odak-cik", "");
  c.textContent = "✕ Odaktan çık";
  document.body.appendChild(c);
  ekranAcikTut(true);
  requestAnimationFrame(function () { el.scrollIntoView({ block: "start" }); });
}

function odakKapat() {
  if (!ODAK.acik) { return false; }
  ODAK.acik = false;
  document.documentElement.removeAttribute("data-odak");
  document.querySelectorAll(".odak-bolum").forEach(function (b) { b.classList.remove("odak-bolum"); });
  const el = ODAK.el;
  ODAK.el = null;
  if (el) { el.classList.remove("odak-hedef"); }
  const c = document.querySelector(".odak-cik");
  if (c) { c.remove(); }
  ekranAcikTut(false);
  if (el && el.isConnected) { requestAnimationFrame(function () { el.scrollIntoView({ block: "start" }); }); }
  return true;
}

document.addEventListener("visibilitychange", function () { if (ODAK.acik && document.visibilityState === "visible") { ekranAcikTut(true); } });
window.addEventListener("hashchange", function () { odakKapat(); adKartKapat(); okaPanelKapat(); });

/* ==================== isme dokun ==================== */

const ADK = { ag: null, dizin: new Map(), acik: null };

/** Okuma metninin evreni: kutu bağlarındaki alan ("tomye", "claude", "ev:fan:<id>:"). */
function adkAlan(el) {
  const k = el.getAttribute("data-oku") || ((el.closest("[data-oku]") || el.querySelector("[data-oku]") || { getAttribute: function () { return ""; } }).getAttribute("data-oku") || "");
  const m = /^(ev:[^:]+:[^:]+:)/.exec(k);
  if (m) { return m[1]; }
  if (/^madde:ce-/.test(k) || el.closest("#claudeEvrenAlan")) { return "claude"; }
  if (el.closest("#evrenSayfa")) { return typeof okuEvrenOnEki === "function" ? okuEvrenOnEki() : null; }
  return "tomye";
}

function adkDizin(alan) {
  if (typeof rbAg !== "function" || !alan) { return null; }
  let ag;
  try { ag = rbAg(); } catch (_) { return null; }
  if (ADK.ag !== ag) { ADK.ag = ag; ADK.dizin = new Map(); }
  if (ADK.dizin.has(alan)) { return ADK.dizin.get(alan); }
  const gizli = typeof rbGizliAdlar === "function" ? rbGizliAdlar() : [];
  const harita = new Map();
  const ekle = function (ad, kayit) {
    const l = String(ad || "").trim().toLocaleLowerCase("tr");
    if (l.length < 3 || l.length > 40 || gizli.indexOf(l) !== -1 || harita.has(l)) { return; }
    harita.set(l, kayit);
  };
  const ilkAdlar = {};
  ag.forEach(function (d) {
    const k = d.kutu;
    if (k.alan !== alan || (typeof rbErisir === "function" && !rbErisir(k))) { return; }
    (k.adlar || []).forEach(function (ad) {
      ad = String(ad || "").trim();
      if (!ad) { return; }
      ekle(ad, { ad: ad, kutu: k });
      /* kişi ve yer adı "Kyldo Zarın" metinde çoğu kez "Kyldo" diye geçer (madde başlıkları kısaltılmaz) */
      const ilk = ad.split(/\s+/)[0];
      if (ilk !== ad && ilk.length >= 4 && /^[A-Za-zÇĞİÖŞÜçğıöşü]+$/.test(ilk) && (/^kar:/.test(k.anahtar) || k.kisiId || /:(kisiler|yerler)$/.test(k.anahtar))) { (ilkAdlar[ilk.toLocaleLowerCase("tr")] = ilkAdlar[ilk.toLocaleLowerCase("tr")] || []).push({ ad: ad, kutu: k }); }
    });
  });
  Object.keys(ilkAdlar).forEach(function (l) { if (ilkAdlar[l].length === 1) { ekle(l, ilkAdlar[l][0]); } });
  const adlar = Array.from(harita.keys()).sort(function (a, b) { return b.length - a.length; });
  const kac = typeof rbKac === "function" ? rbKac : function (s) { return s; };
  const d = {
    harita: harita,
    desen: adlar.length ? new RegExp("(^|[^" + HARF27 + "])(" + adlar.map(kac).join("|") + ")(?=$|[^" + HARF27 + "])", "gi") : null
  };
  ADK.dizin.set(alan, d);
  return d;
}

/** Metindeki eşleşmenin kaydı; özel ad büyük harfle başlar ("zincir" sözcüğü değil "Zincir" maddesi). */
function adkBul(d, metin) {
  const m = String(metin);
  if (m.charAt(0) === m.charAt(0).toLocaleLowerCase("tr")) { return null; }
  return d.harita.get(m.toLocaleLowerCase("tr")) || d.harita.get(m.toLowerCase()) || null;
}

/** Görünen okuma metinlerinde adların ilk geçtiği yerin altını çizer (metne dokunmadan). */
function adkIsaretle() {
  if (!isaretDestek()) { return; }
  const h = new Highlight();
  okumaAlanlari().forEach(function (el) {
    if (!gorunurMu(el)) { return; }
    const d = adkDizin(adkAlan(el));
    if (!d || !d.desen) { return; }
    const kendi = el.getAttribute("data-oku") || "";
    const gorulen = new Set();
    metinDugumleri(el).forEach(function (n) {
      if (n.parentElement.closest("button")) { return; }   /* bağlantı düğmesindeki ad zaten dokunulur */
      d.desen.lastIndex = 0;
      let m;
      while ((m = d.desen.exec(n.data))) {
        const kayit = adkBul(d, m[2]);
        const l = m[2].toLocaleLowerCase("tr");
        if (!kayit || gorulen.has(l) || kayit.kutu.anahtar === kendi) { continue; }
        gorulen.add(l);
        const r = document.createRange();
        const bas = m.index + m[1].length;
        r.setStart(n, bas); r.setEnd(n, bas + m[2].length);
        h.add(r);
      }
    });
  });
  CSS.highlights.set("tf-ad", h);
}

function noktadakiMetin(x, y) {
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    return p && p.offsetNode && p.offsetNode.nodeType === 3 ? { n: p.offsetNode, o: p.offset } : null;
  }
  if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    return r && r.startContainer.nodeType === 3 ? { n: r.startContainer, o: r.startOffset } : null;
  }
  return null;
}

function adkBilgi(kayit) {
  const k = kayit.kutu;
  const a = k.anahtar;
  let m;
  if ((m = /^kar:(.+)$/.exec(a))) {
    const kr = (veri.karakterler || []).find(function (x) { return x.id === m[1]; }) || {};
    return { tur: "Karakter", alt: kr.unvan || "", ozet: kr.ozet || "", yol: "kar:" + m[1] };
  }
  if ((m = /^madde:ce-(.+)$/.exec(a))) {
    const c = veri.claudeEvreni || {};
    const ks = (c.kisiler || []).find(function (x) { return x.id === m[1]; });
    if (ks) { return { tur: "Kişi · Claude'un Evreni", alt: ks.unvan || "", ozet: ks.ozet || "", yol: "ce:" + ks.id }; }
    const md = (c.maddeler || []).find(function (x) { return x.id === m[1]; });
    if (md) { return { tur: "Madde · Claude'un Evreni", alt: "", ozet: md.ozet || "" }; }
    const hk = (c.hikayeler || []).find(function (x) { return x.id === m[1]; });
    return { tur: "Hikâye · Claude'un Evreni", alt: "", ozet: hk ? String(hk.metin || "").slice(0, 200) : "" };
  }
  if ((m = /^evren:(.+)$/.exec(a))) {
    const e = (veri.evren || []).find(function (x) { return x.id === m[1]; }) || {};
    return { tur: "Evren maddesi", alt: e.bolum || "", ozet: e.ozet || "" };
  }
  if ((m = /^ev:([^:]+):([^:]+):(\w+)$/.exec(a))) {
    const kaynak = m[1] === "site" ? (veri.kanonEvrenleri || {})[m[2]]
      : ((typeof EVD_BELLEK !== "undefined" && EVD_BELLEK[m[2]]) || ((veri.fanEserleri || {}).evrenler || []).find(function (x) { return x.id === m[2]; }));
    const grup = (typeof FAN_EVREN_GRUPLARI !== "undefined" ? FAN_EVREN_GRUPLARI : []).find(function (g) { return g.k === m[3]; });
    const l = kaynak && Array.isArray(kaynak[m[3]]) ? kaynak[m[3]] : [];
    const ad = kayit.ad.toLocaleLowerCase("tr");
    const o = l.find(function (x) { return x && [x.ad, x.terim, x.baslik].some(function (v) { return v && String(v).toLocaleLowerCase("tr") === ad; }); }) || {};
    const ozet = o.aciklama || o.tanim || o.deger || o.olay || o.ozet || o.metin || "";
    return { tur: (grup ? grup.tekil || grup.ad : "Madde") + " · " + ((kaynak && kaynak.ad) || m[2]), alt: o.rol || o.tur || "", ozet: ozet };
  }
  return { tur: "Kutu", alt: "", ozet: "" };
}

function adKartAc(kayit) {
  adKartKapat();
  const k = kayit.kutu;
  const b = adkBilgi(kayit);
  const okundu = typeof okunduMu === "function" && okunduMu(k.anahtar);
  let yol = null;
  try { yol = b.yol && typeof okumaYolu === "function" ? okumaYolu(b.yol) : null; } catch (_) { yol = null; }
  const yolAcik = yol && typeof yolIlerleme === "function" && yolIlerleme(yol).sonraki;
  const ozet = String(b.ozet || "").replace(/\s+/g, " ").trim();
  const div = document.createElement("div");
  div.className = "ad-kart";
  div.setAttribute("role", "dialog");
  div.setAttribute("aria-label", kayit.ad);
  div.innerHTML = '<button type="button" class="pencere-kapat" data-ad-kart-kapat aria-label="Kapat">✕</button>' +
    '<span class="oyun-etiket">' + kacir(b.tur) + "</span>" +
    "<h4>" + kacir(kayit.ad) + "</h4>" +
    (b.alt ? '<p class="ad-kart-alt">' + kacir(b.alt) + "</p>" : "") +
    (ozet ? "<p>" + kacir(ozet.length > 240 ? ozet.slice(0, 237) + "…" : ozet) + "</p>" : "") +
    '<p class="oyun-not">' + (okundu ? "✓ Kaydını okudun." : "Kaydını henüz okumadın.") + "</p>" +
    '<div class="oyun-sira"><button type="button" class="dugme y-kucuk" data-ad-kart-git>' + (okundu ? "Kaydına git" : "Kaydını oku") + "</button>" +
      (yolAcik ? '<button type="button" class="dugme dugme-sade y-kucuk" data-yol-basla="' + kacir(yol.id) + '">📖 Okuma yolu · ' + yol.adimlar.length + " kutu</button>" : "") +
    "</div>";
  ODAK27.once = document.activeElement;
  document.body.appendChild(div);
  ADK.acik = { div: div, kutu: k };
  const ilk = div.querySelector("[data-ad-kart-git]");
  if (ilk) { ilk.focus({ preventScroll: true }); }
}

function adKartKapat() {
  const a = ADK.acik;
  ADK.acik = null;
  if (!a || !a.div.isConnected) { return false; }
  a.div.remove();
  odakGeriVer();
  return true;
}

/** Bir kutuya git: sitenin bağlantı yönlendirmesiyle sayfasını aç, sonra kutuyu bulup göster. */
function kutuyaGit(k) {
  if (!k || !k.git) { return; }
  const p = document.querySelector("#perde");
  if (p && !p.hidden && !/^#\/karakter\//.test(k.git) && typeof perdeKapat === "function") { perdeKapat(); }
  const a = document.createElement("a");
  a.href = k.git;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () {
    const el = document.querySelector('[data-oku="' + String(k.anahtar).replace(/["\\]/g, "\\$&") + '"]') ||
      (/^madde:/.test(k.anahtar) ? document.getElementById(k.anahtar.slice(6)) : null);
    if (!el) { return; }
    const d = el.closest("details");
    if (d && !d.open) { d.open = true; }
    el.scrollIntoView({ block: "start", behavior: "smooth" });
  }, 700);
}

/* ==================== altını çiz ve Defterin ==================== */

/* vurgulama artık bütün okuma metinlerinde (eski sürüm yalnızca dört türde çalışıyordu) */
window.vurguSecimDenetle = function () {
  const secim = window.getSelection ? window.getSelection() : null;
  if (!secim || secim.isCollapsed || !secim.toString().trim()) { vurguBalonuKapat(); return; }
  const metin = secim.toString().replace(/\s+/g, " ").trim();
  if (metin.length < 4 || metin.length > 400) { vurguBalonuKapat(); return; }
  const kapsayici = secim.anchorNode && (secim.anchorNode.nodeType === 1 ? secim.anchorNode : secim.anchorNode.parentElement);
  const okumaAlani = kapsayici && kapsayici.closest && kapsayici.closest(VURGU_SECICI);
  if (!okumaAlani || okumaAlani.closest("[contenteditable], textarea")) { vurguBalonuKapat(); return; }
  const kutu = secim.getRangeAt(0).getBoundingClientRect();
  vurguBalonuKapat();
  const b = document.createElement("button");
  b.className = "vurgu-balon";
  b.textContent = "✎ altını çiz";
  b.style.top = Math.max(window.scrollY + 4, window.scrollY + kutu.top - 42) + "px";
  b.style.left = Math.max(8, Math.min(window.scrollX + kutu.left + kutu.width / 2 - 48, window.scrollX + document.documentElement.clientWidth - 110)) + "px";
  b.dataset.vurguMetin = metin;
  document.body.appendChild(b);
  vurguBalonu = b;
};

/** Seçimin nereden geldiği: sayfa rotası, kutu anahtarı, başlık; roman penceresinde bölüm no. */
function vurguBaglami() {
  const secim = window.getSelection ? window.getSelection() : null;
  const n = secim && secim.anchorNode;
  const el = n && (n.nodeType === 1 ? n : n.parentElement);
  if (!el) { return {}; }
  const b = { git: typeof rota === "function" ? rota() : location.hash };
  const kutu = el.closest("[data-oku]");
  if (kutu) { b.oku = kutu.getAttribute("data-oku"); }
  const perde = el.closest("#perde");
  if (perde) {
    const h = perde.querySelector("h3");
    const alt = perde.querySelector(".pencere-alt");
    b.baslik = [h && h.textContent, alt && alt.textContent].filter(Boolean).join(" · ");
    const r = perde.querySelector('.tepki-alan[data-hedef^="roman:"]');
    if (r) { b.roman = Number(r.getAttribute("data-hedef").slice(6)); }
    if (!b.oku) { b.git = b.git || ""; }
  } else {
    const ev = el.closest("#evrenSayfa");
    const h = ev ? ev.querySelector("h2, h1") : (el.closest("section.bolum") || { querySelector: function () { return null; } }).querySelector("h2");
    if (h) { b.baslik = h.textContent.trim(); }
  }
  return b;
}

if (typeof vurguKaydet === "function") {
  const eskiVK27 = vurguKaydet;
  window.vurguKaydet = function (metin, kaynak) {
    const b = vurguBaglami();
    const r = eskiVK27.call(this, metin, kaynak || b.baslik || "");
    const l = vurguListesi();
    const v = l.find(function (x) { return x.metin === metin; });
    if (v && !v.git && !v.roman) {
      if (b.git) { v.git = b.git; }
      if (b.oku) { v.oku = b.oku; }
      if (b.roman) { v.roman = b.roman; }
      if (!v.kaynak && b.baslik) { v.kaynak = b.baslik; }
      kayitYaz(VURGU_ANAHTAR, JSON.stringify(l));
      vurgularimCiz();
    }
    setTimeout(isaretleriTazele, 50);
    return r;
  };
}

function vurguBul(t) { return vurguListesi().find(function (v) { return String(v.t) === String(t); }) || null; }

/** Vurguların metindeki yerleri (işaretli görünür). */
function vurguIsaretle() {
  if (!isaretDestek()) { return; }
  const l = vurguListesi();
  const h = new Highlight();
  if (l.length) {
    document.querySelectorAll(VURGU_SECICI).forEach(function (el) {
      if ((el.parentElement && el.parentElement.closest(VURGU_SECICI)) || !gorunurMu(el)) { return; }
      const kendi = el.getAttribute("data-oku");
      l.forEach(function (v) {
        if (v.oku && kendi && v.oku !== kendi) { return; }
        const r = metinAraligi(el, v.metin);
        if (r) { h.add(r); }
      });
    });
  }
  CSS.highlights.set("tf-vurgu", h);
}

window.vurgularimCiz = function () {
  const alan = document.querySelector("#vurguAlan");
  if (!alan) { return; }
  const liste = vurguListesi().slice().reverse();
  alan.innerHTML = liste.length
    ? '<div class="alinti-izgara vurgu-liste">' + liste.map(function (v) {
        const tarih = v.t ? new Date(v.t).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "";
        return '<figure class="alinti vurgu-kart"><blockquote>' + kacir(v.metin) + "</blockquote>" +
          "<figcaption>" + kacir([v.kaynak, tarih].filter(Boolean).join(" · ")) + "</figcaption>" +
          '<div class="vurgu-eylem">' +
            (v.git || v.roman ? '<button type="button" class="dugme dugme-sade y-kucuk" data-vurgu-git="' + kacir(v.t) + '">↗ Yerinde oku</button>' : "") +
            '<button type="button" class="dugme dugme-sade y-kucuk" data-vurgu-kart="' + kacir(v.t) + '">🖼 Kart</button>' +
            '<button type="button" class="dugme dugme-sade y-kucuk" data-vurgu-sil="' + kacir(v.t) + '" aria-label="Vurguyu sil">✕</button>' +
          "</div></figure>";
      }).join("") + "</div>"
    : '<p class="oyun-not">Okurken bir cümle seç, çıkan "✎ altını çiz" düğmesine bas. Vurguların metinde işaretli görünür, buradan yerine dönersin.</p>';
};

function vurguSil(t) {
  kayitYaz(VURGU_ANAHTAR, JSON.stringify(vurguListesi().filter(function (v) { return String(v.t) !== String(t); })));
  vurgularimCiz();
  isaretleriTazele();
}

function vurguyaGit(v) {
  if (!v) { return; }
  const bul = function (kalan) {
    const els = Array.prototype.filter.call(document.querySelectorAll(VURGU_SECICI), function (el) { return gorunurMu(el) && (!v.oku || !el.getAttribute("data-oku") || el.getAttribute("data-oku") === v.oku); });
    for (let i = 0; i < els.length; i++) {
      const r = metinAraligi(els[i], v.metin);
      if (r) {
        const d = els[i].closest("details");
        if (d && !d.open) { d.open = true; }
        const k = r.getBoundingClientRect();
        const kap = els[i].closest("#perde .pencere, #evrenSayfa");
        if (kap && kap.scrollHeight > kap.clientHeight) { kap.scrollBy({ top: k.top - kap.getBoundingClientRect().top - 120, behavior: "smooth" }); }
        else { window.scrollBy({ top: k.top - 140, behavior: "smooth" }); }
        isaretleriTazele();
        return;
      }
    }
    if (kalan > 0) { setTimeout(function () { bul(kalan - 1); }, 500); }
  };
  if (v.roman && typeof romanAc === "function") { romanAc(v.roman); setTimeout(function () { bul(4); }, 300); return; }
  if (v.oku && /^kar:/.test(v.oku)) { location.hash = "#/karakter/" + v.oku.slice(4); setTimeout(function () { bul(4); }, 600); return; }
  const a = document.createElement("a");
  a.href = v.git || "#/";
  a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { bul(6); }, 700);
}

/** Alıntı kartı: 1080×1350 PNG (paylaş ya da indir). */
async function vurguKartiUret(v) {
  if (typeof kartZemin !== "function") { return null; }
  if (typeof kartFontlariHazir === "function") { await kartFontlariHazir(); }
  const en = 1080, boy = 1350;
  const t = document.createElement("canvas");
  t.width = en; t.height = boy;
  const c = t.getContext("2d");
  kartZemin(c, en, boy);
  c.fillStyle = KART_RENK.deniz || "#1c5c96";
  c.font = KART_FONT.baslik(220);
  c.fillText("“", 80, 290);
  let px = 58;
  let satirlar;
  do {
    c.font = KART_FONT.yazi(px, true);
    satirlar = kartSar(c, v.metin, en - 200);
    px -= 4;
  } while (satirlar.length * px * 1.45 > 640 && px > 30);
  px += 4;
  c.fillStyle = KART_RENK.murekkep || "#0d2438";
  c.font = KART_FONT.yazi(px, true);
  satirlar.forEach(function (s, i) { c.fillText(s, 100, 330 + i * px * 1.45); });
  const y = 330 + satirlar.length * px * 1.45 + 30;
  c.fillStyle = KART_RENK.deniz || "#1c5c96";
  c.font = KART_FONT.mono(28, true);
  kartSar(c, "— " + (v.kaynak || "TentiforApp"), en - 200).slice(0, 2).forEach(function (s, i) { c.fillText(s, 100, y + i * 40); });
  c.font = KART_FONT.mono(26);
  c.fillText(KART_ADRES, 100, boy - 70);
  return t;
}

/* ==================== bugün kartı ve seri ==================== */

const SERI_ESIKLER = [[3, "Kıvılcım"], [7, "Bir hafta"], [28, "Bir Tömye ayı"], [100, "Yüz gün"], [310, "Bir Tömye yılı"]];

function gunKaydir(gun, n) { return new Date(Date.parse(gun + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10); }

function oynananGunler() {
  const s = new Set();
  (typeof oyunXpKayitlari === "function" ? oyunXpKayitlari() : []).forEach(function (x) {
    const m = /^oxp_(\d{4}-\d{2}-\d{2})_/.exec(x);
    if (m) { s.add(m[1]); }
  });
  return s;
}

/** Seri: bugünden (bugün oynanmadıysa dünden) geriye, oynanan günler. Kaçırılan bir gün, öncesi oynanmışsa ve
    son 7 günde başka gün bağışlanmadıysa seriyi bozmaz (buz kalıbı). En uzun seri aynı kuralla bütün günlerden. */
function seriDurumu() {
  const g = oynananGunler();
  const bugun = typeof oyunXpGunu === "function" ? oyunXpGunu() : new Date().toISOString().slice(0, 10);
  const bugunOynandi = g.has(bugun);
  let d = bugunOynandi ? bugun : gunKaydir(bugun, -1);
  let seri = 0, af = null;
  for (let i = 0; i < 4000; i++) {
    if (g.has(d)) { seri++; d = gunKaydir(d, -1); continue; }
    const onceki = gunKaydir(d, -1);
    if (g.has(onceki) && (af === null || Date.parse(af) - Date.parse(d) >= 7 * 86400000)) { af = d; d = onceki; continue; }
    break;
  }
  const sirali = Array.from(g).sort();
  let enUzun = 0, cari = 0, sonAf = null, onceki = null;
  sirali.forEach(function (gun) {
    if (onceki && gunKaydir(onceki, 1) === gun) { cari++; }
    else if (onceki && gunKaydir(onceki, 2) === gun && (sonAf === null || Date.parse(gun) - Date.parse(sonAf) > 7 * 86400000)) { cari++; sonAf = gunKaydir(onceki, 1); }
    else { cari = 1; sonAf = null; }
    enUzun = Math.max(enUzun, cari);
    onceki = gun;
  });
  enUzun = Math.max(enUzun, seri);
  const unvan = SERI_ESIKLER.filter(function (e) { return enUzun >= e[0]; }).pop() || null;
  const sonraki = SERI_ESIKLER.find(function (e) { return seri < e[0]; }) || null;
  return { seri: seri, enUzun: enUzun, bugunOynandi: bugunOynandi, buzKalibi: af, unvan: unvan, sonraki: sonraki };
}

function bugunOyunlari() {
  const l = [{ id: "tomye|kelime", ad: "Günün kelimesi", git: "gk" }];
  (typeof GO_OYUNLAR !== "undefined" ? GO_OYUNLAR : []).forEach(function (o) {
    if (o.evren === "tomye" && (typeof goAcikMi !== "function" || goAcikMi(o))) { l.push({ id: "tomye|" + o.id, ad: o.ad, git: "gunluk" }); }
  });
  const h = haviHarita();
  if (h) { l.push({ id: "harita|" + h.id, ad: "Harita Avı", git: "havi" }); }
  return l.map(function (o) { o.bitti = typeof oyunXpAlindi === "function" && oyunXpAlindi(o.id); return o; });
}

function oyunBugunCiz() {
  const bolum = document.querySelector("#oyunlar");
  if (!bolum || typeof veri === "undefined" || !veri) { return; }
  let k = document.querySelector("#oyunBugun");
  if (!k) {
    k = document.createElement("div");
    k.id = "oyunBugun";
    k.className = "oyun-bugun";
    const bas = bolum.querySelector(".bolum-basi");
    bolum.insertBefore(k, bas ? bas.nextSibling : bolum.firstChild);
  }
  const l = bugunOyunlari();
  const s = seriDurumu();
  const biten = l.filter(function (o) { return o.bitti; }).length;
  k.innerHTML = '<div class="ob-ust"><span class="oyun-etiket">Bugün</span>' +
      '<span class="ob-seri' + (s.seri ? "" : " sonmus") + '" title="Üst üste günlük oyun kazandığın günler">🔥 ' + s.seri + " gün</span></div>" +
    '<div class="ob-liste">' + l.map(function (o) {
      return '<button type="button" class="ob-oyun' + (o.bitti ? " bitti" : "") + '" data-bugun-git="' + o.git + '">' +
        '<span class="ob-tik" aria-hidden="true">' + (o.bitti ? "✓" : "○") + "</span>" + kacir(o.ad) + "</button>";
    }).join("") + "</div>" +
    '<p class="oyun-not">' +
      (biten === l.length ? "Bugünün bütün oyunları bitti. Yarın yenileri gelir." : biten + " / " + l.length + " oyun bitti.") +
      (s.seri && !s.bugunOynandi ? " Seri bugün bir oyun kazanınca sürer." : "") +
      (s.buzKalibi ? " Kaçırdığın bir günü buz kalıbı kurtardı (haftada bir)." : "") +
      (s.unvan ? " Unvan: <b>" + kacir(s.unvan[1]) + "</b>." : "") +
      (s.sonraki ? " Sıradaki: " + s.sonraki[0] + " gün, " + kacir(s.sonraki[1]) + "." : "") +
      (s.enUzun > s.seri ? " En uzun serin " + s.enUzun + " gün." : "") +
    "</p>";
}

function oyunSekmesiAc(ad) {
  const b = document.querySelector('[data-oyun-sekme="' + ad + '"]');
  if (b) { b.click(); }
}

function bugunGit(hedef) {
  if (typeof rota === "function" && rota().indexOf("#/oyunlar") !== 0) { location.hash = "#/oyunlar"; }
  setTimeout(function () {
    let el = null;
    if (hedef === "gk") { el = document.querySelector("#gkAlan"); }
    else {
      oyunSekmesiAc("gunluk");
      el = hedef === "havi" ? (document.querySelector("#haviAlan") || document.querySelector("#panel-gunluk")) : document.querySelector("#panel-gunluk");
    }
    if (el) { el.scrollIntoView({ block: "start", behavior: "smooth" }); }
  }, 250);
}

/* ==================== Harita Avı ==================== */

const HAVI_ANAHTAR = "tf27_harita_avi";
const HAVI_IZGARA = { acik: false };
const HAVI_YON = ["kuzeyin", "kuzeyin ortası", "orta", "güneyin ortası", "güneyin"];
const HAVI_YON2 = ["batısı", "batıya yakın", "ortası", "doğuya yakın", "doğusu"];
const HAVI_HAK = 5;

/** Bugünün haritası: Tömye (haritası açıksa) ve Claude'un Evreni gün aşırı. */
function haviHarita() {
  const l = (typeof veri !== "undefined" && veri && veri.haritalar) || [];
  const uygun = l.filter(function (h) {
    if (!Array.isArray(h.yerler) || h.yerler.filter(haviAdayMi).length < 4) { return false; }
    if (h.id === "tomye" && typeof bolumErisimi === "function" && !bolumErisimi("harita")) { return false; }
    return true;
  });
  if (!uygun.length) { return null; }
  const gun = typeof oyunXpGunu === "function" ? oyunXpGunu() : new Date().toISOString().slice(0, 10);
  return uygun[Math.floor(Date.parse(gun) / 86400000) % uygun.length];
}

function haviAdayMi(y) {
  return y && typeof y.x === "number" && typeof y.y === "number" && y.not && !y.gizli && ["Kıta", "Uzak"].indexOf(y.tur) === -1;
}

function haviDurum() {
  const h = haviHarita();
  if (!h) { return null; }
  const gun = typeof oyunXpGunu === "function" ? oyunXpGunu() : new Date().toISOString().slice(0, 10);
  let d = typeof jsonOku === "function" ? jsonOku(HAVI_ANAHTAR, null) : null;
  if (!d || d.gun !== gun || d.harita !== h.id) {
    const adaylar = h.yerler.filter(haviAdayMi);
    const r = typeof goRastgele === "function" ? goRastgele(gun + "|harita|" + h.id) : Math.random;
    d = { gun: gun, harita: h.id, yer: adaylar[Math.floor(r() * adaylar.length)].id, tahmin: [], bitti: false, kazandi: false };
  }
  d.h = h;
  d.y = h.yerler.find(function (x) { return x.id === d.yer; });
  return d.y ? d : null;
}

function haviKaydet(d) {
  jsonYaz(HAVI_ANAHTAR, { gun: d.gun, harita: d.harita, yer: d.yer, tahmin: d.tahmin, bitti: d.bitti, kazandi: d.kazandi });
}

function haviSicaklik(uz) {
  if (uz <= 6) { return ["Buldun!", "bulundu"]; }
  if (uz <= 12) { return ["Kaynıyor", "kaynar"]; }
  if (uz <= 22) { return ["Sıcak", "sicak"]; }
  if (uz <= 35) { return ["Ilık", "ilik"]; }
  return ["Soğuk", "soguk"];
}

function haviYon(t, y) {
  const dx = y.x - t[0], dy = y.y - t[1];
  const l = [];
  if (Math.abs(dy) > 6) { l.push(dy < 0 ? "kuzeyde" : "güneyde"); }
  if (Math.abs(dx) > 6) { l.push(dx < 0 ? "batıda" : "doğuda"); }
  return l.length ? "Aradığın yer daha " + l.join(" ve ") + "." : "";
}

function haviIpucu(d) {
  let not = String(d.y.not || "");
  if (typeof goGizle === "function") { not = goGizle(not, d.y.ad); }
  return not;
}

function haviSvg(d) {
  const h = d.h;
  const kara = h.yerler.filter(function (y) { return Array.isArray(y.sekil) && y.sekil.length > 2; }).map(function (y) {
    return '<polygon class="havi-kara" points="' + y.sekil.map(function (p) { return p[0] + "," + p[1]; }).join(" ") + '"/>';
  }).join("");
  const isaretler = d.tahmin.map(function (t, i) {
    return '<circle class="havi-tahmin ' + haviSicaklik(t[2])[1] + '" cx="' + t[0] + '" cy="' + t[1] + '" r="2.2"/>' +
      '<text class="havi-no" x="' + (t[0] + 2.8) + '" y="' + (t[1] - 2.2) + '">' + (i + 1) + "</text>";
  }).join("");
  const hedef = d.bitti ? '<circle class="havi-hedef" cx="' + d.y.x + '" cy="' + d.y.y + '" r="6"/><text class="havi-ad" x="' + d.y.x + '" y="' + (d.y.y - 7.5) + '">' + kacir(d.y.ad) + "</text>" : "";
  return '<svg class="havi-svg" viewBox="0 0 100 100" role="img" aria-label="' + kacir(h.ad) + ' haritası: tahmin için dokun"' + (d.bitti ? "" : ' data-havi-harita=""') + ">" +
    '<rect class="havi-deniz" x="0" y="0" width="100" height="100"/>' + kara + isaretler + hedef + "</svg>";
}

function haviCiz() {
  const alan = document.querySelector("#gunlukOyunAlan");
  if (!alan) { return; }
  let k = document.querySelector("#haviAlan");
  const d = haviDurum();
  if (!d) { if (k) { k.remove(); } return; }
  if (!k || !alan.contains(k)) {
    k = document.createElement("div");
    k.id = "haviAlan";
    k.className = "yaris-kart evo-kart havi-kart";
    alan.appendChild(k);
  }
  const kalan = HAVI_HAK - d.tahmin.length;
  const son = d.tahmin[d.tahmin.length - 1];
  let durum;
  if (d.kazandi) { durum = "✓ " + kacir(d.y.ad) + " — " + d.tahmin.length + ". tahminde buldun. Yarın yeni bir yer."; }
  else if (d.bitti) { durum = "Haklar bitti. Aradığın yer: <b>" + kacir(d.y.ad) + "</b>. Yarın yeni bir yer."; }
  else if (son) { durum = "<b>" + haviSicaklik(son[2])[0] + ".</b> " + (d.tahmin.length >= 2 ? kacir(haviYon(son, d.y)) + " " : "") + kalan + " hakkın kaldı."; }
  else { durum = "Haritada bu yerin olduğunu düşündüğün noktaya dokun. " + HAVI_HAK + " hakkın var; yaklaştıkça ısınır."; }
  const izgara = !d.bitti && HAVI_IZGARA.acik ? '<div class="havi-izgara" role="group" aria-label="Haritayı ızgarada seç: 5 satır, 5 sütun; kuzey yukarıda">' +
    [0, 1, 2, 3, 4].map(function (r) {
      return [0, 1, 2, 3, 4].map(function (c) {
        return '<button type="button" data-havi-hucre="' + (c * 20 + 10) + "," + (r * 20 + 10) + '" aria-label="' + HAVI_YON[r] + " " + HAVI_YON2[c] + " (satır " + (r + 1) + ", sütun " + (c + 1) + ')">' + (r + 1) + "·" + (c + 1) + "</button>";
      }).join("");
    }).join("") + "</div>" : "";
  k.innerHTML = "<h4>Harita Avı · " + kacir(d.h.ad) + (d.kazandi ? " · bugün ✓" : "") + "</h4>" +
    '<p class="havi-ipucu"><span class="oyun-etiket">' + kacir(d.y.tur || "Yer") + "</span> " + kacir(haviIpucu(d)) + "</p>" +
    haviSvg(d) + izgara +
    '<p class="oyun-not havi-durum" role="status" aria-live="polite">' + durum + "</p>" +
    (d.bitti ? "" : '<button type="button" class="ic-bag" data-havi-izgara aria-pressed="' + HAVI_IZGARA.acik + '">' + (HAVI_IZGARA.acik ? "Izgarayı gizle" : "Izgarayla seç (klavye, ekran okuyucu)") + "</button>");
}

function haviTahmin(svg, x, y) {
  const m = svg.getScreenCTM();
  if (!m) { return; }
  const p = new DOMPoint(x, y).matrixTransform(m.inverse());
  haviTahminNokta(p.x, p.y);
}

/** Haritada (0–100) bir noktaya tahmin: dokunuş, ızgara ya da klavye. */
function haviTahminNokta(hx, hy) {
  const d = haviDurum();
  if (!d || d.bitti) { return; }
  const t = [Math.round(Math.max(0, Math.min(100, hx)) * 10) / 10, Math.round(Math.max(0, Math.min(100, hy)) * 10) / 10];
  const uz = Math.hypot(t[0] - d.y.x, t[1] - d.y.y);
  d.tahmin.push([t[0], t[1], Math.round(uz * 10) / 10]);
  if (uz <= 6) {
    d.bitti = true; d.kazandi = true;
    if (typeof oyunXpVer === "function") { oyunXpVer("harita|" + d.h.id); }
    if (typeof TentiforKopru !== "undefined" && TentiforKopru.titret) { try { TentiforKopru.titret(40); } catch (_) { /* yok */ } }
  } else if (d.tahmin.length >= HAVI_HAK) {
    d.bitti = true;
  }
  haviKaydet(d);
  haviCiz();
  oyunBugunCiz();
}

/* Günlük oyunlar alanı yeniden çizilince Harita Avı da altına gelsin */
if (typeof gunlukOyunlarCiz === "function") {
  const eskiGOC27 = gunlukOyunlarCiz;
  window.gunlukOyunlarCiz = function () {
    const r = eskiGOC27.apply(this, arguments);
    try { haviCiz(); } catch (e) { console.error("[TentiforApp] Harita Avı:", e); }
    return r;
  };
}
/* bir oyun kazanılınca Bugün kartı tazelensin */
if (typeof oyunXpVer === "function") {
  const eskiOXV27 = oyunXpVer;
  window.oyunXpVer = function () {
    const r = eskiOXV27.apply(this, arguments);
    setTimeout(oyunBugunCiz, 0);
    return r;
  };
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const t = e.target;
  if (!t.closest) { return; }

  if (t.closest("[data-oka-ac]")) { okaPanelAc(); return; }
  if (t.closest("[data-oka-kapat]")) { okaPanelKapat(); return; }
  const ob = t.closest("[data-oka-boyut]");
  if (ob) { const a = okaOku(); a.boyut = Math.max(0, Math.min(OKA_OLCEK.length - 1, a.boyut + Number(ob.getAttribute("data-oka-boyut")))); okaYaz(a); return; }
  const os = t.closest("[data-oka]");
  if (os) { const a = okaOku(); a[os.getAttribute("data-oka")] = os.getAttribute("data-deger"); okaYaz(a); return; }
  if (t.closest("[data-oka-sifirla]")) { okaYaz({ boyut: 1 }); return; }

  const oa = t.closest("[data-odak-ac]");
  if (oa) { okaPanelKapat(); odakAc(odakHedef(oa)); return; }
  if (t.closest("[data-odak-cik]")) { odakKapat(); return; }

  if (t.closest("[data-ad-kart-kapat]")) { adKartKapat(); return; }
  if (t.closest("[data-ad-kart-git]")) { const k = ADK.acik && ADK.acik.kutu; adKartKapat(); odakKapat(); kutuyaGit(k); return; }
  if (t.closest(".ad-kart [data-yol-basla]")) { setTimeout(adKartKapat, 0); odakKapat(); return; }

  const vg = t.closest("[data-vurgu-git]");
  if (vg) { vurguyaGit(vurguBul(vg.getAttribute("data-vurgu-git"))); return; }
  const vs = t.closest("[data-vurgu-sil]");
  if (vs) { vurguSil(vs.getAttribute("data-vurgu-sil")); return; }
  const vk = t.closest("[data-vurgu-kart]");
  if (vk) {
    const v = vurguBul(vk.getAttribute("data-vurgu-kart"));
    if (!v) { return; }
    vurguKartiUret(v).then(function (tuval) {
      if (!tuval) { return ""; }
      return kartPaylas(tuval, "tentiforapp-alinti.png", "“" + v.metin + "”" + (v.kaynak ? " — " + v.kaynak : ""));
    }).then(function (m) { if (m && typeof eckaBildir === "function") { eckaBildir(m); } });
    return;
  }

  const bg = t.closest("[data-bugun-git]");
  if (bg) { bugunGit(bg.getAttribute("data-bugun-git")); return; }

  const hh = t.closest("[data-havi-hucre]");
  if (hh) { const p = hh.getAttribute("data-havi-hucre").split(","); haviTahminNokta(Number(p[0]), Number(p[1])); const n = document.querySelector("#haviAlan [data-havi-hucre]"); if (n) { n.focus(); } return; }
  if (t.closest("[data-havi-izgara]")) { HAVI_IZGARA.acik = !HAVI_IZGARA.acik; haviCiz(); const n = document.querySelector("#haviAlan [data-havi-hucre], #haviAlan [data-havi-izgara]"); if (n) { n.focus(); } return; }
  const hv = t.closest("[data-havi-harita]");
  if (hv) { haviTahmin(hv, e.clientX, e.clientY); return; }

  /* isme dokun: okuma metninde, seçim yokken, bağlantı ya da düğme değilse */
  if (ADK.acik && !t.closest(".ad-kart")) { adKartKapat(); }
  const el = t.closest(OKUMA_SECICI);
  if (!el || t.closest("a, button, input, textarea, select, summary, label, .vurgu-balon")) { return; }
  const s = window.getSelection && window.getSelection();
  if (s && !s.isCollapsed) { return; }
  const yer = noktadakiMetin(e.clientX, e.clientY);
  if (!yer || !el.contains(yer.n)) { return; }
  const kok = okumaAlanlari().find(function (x) { return x.contains(el); }) || el;
  const d = adkDizin(adkAlan(kok));
  if (!d || !d.desen) { return; }
  d.desen.lastIndex = 0;
  let m;
  while ((m = d.desen.exec(yer.n.data))) {
    const bas = m.index + m[1].length;
    if (yer.o >= bas && yer.o <= bas + m[2].length) {
      const kayit = adkBul(d, m[2]);
      if (kayit && kayit.kutu.anahtar !== (kok.getAttribute("data-oku") || "")) { adKartAc(kayit); }
      return;
    }
  }
});

/* Esc (ve uygulamada geri tuşu): önce ad kartı, sonra ayar paneli, sonra odak modu kapanır */
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") { return; }
  if (adKartKapat() || okaPanelKapat() || odakKapat()) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);

/* ==================== başlangıç ==================== */

function isaretleriTazele() {
  try { adkIsaretle(); } catch (e) { console.error("[TentiforApp] ad işaretleri:", e); }
  try { vurguIsaretle(); } catch (e) { console.error("[TentiforApp] vurgu işaretleri:", e); }
}

let tara27 = null;
function tara27Iste() {
  if (tara27) { return; }
  tara27 = setTimeout(function () {
    tara27 = null;
    if (typeof veri === "undefined" || !veri) { return; }
    okaHazirla();
    isaretleriTazele();
  }, 400);
}
/* yalnızca yeni öğeler taramayı tetikler: metin değişiklikleri (okuma sayacı her saniye) ve kendi eklediklerimiz değil */
const KENDI27 = ".ok-arac, .ad-kart, .oka-panel, .odak-cik, .vurgu-balon, .oku-cubuk, .oku-yazi, .rb-serit, .ecka-bildirim";
new MutationObserver(function (l) {
  const ilgili = function (n) { return n.nodeType === 1 && !n.matches(KENDI27); };
  if (!l.some(function (m) { return Array.prototype.some.call(m.addedNodes, ilgili) || Array.prototype.some.call(m.removedNodes, ilgili); })) { return; }
  tara27Iste();
}).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("toggle", tara27Iste, true);
window.addEventListener("hashchange", function () { setTimeout(oyunBugunCiz, 300); tara27Iste(); });

okaUygula();
(function bekle27(n) {
  if (typeof veri === "undefined" || !veri) { if (n > 0) { setTimeout(function () { bekle27(n - 1); }, 300); } return; }
  oyunBugunCiz();
  tara27Iste();
})(60);
