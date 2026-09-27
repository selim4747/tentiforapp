/* Okuyarak kazanmak: bir kutuya dokunmak artık ödül vermez; kutuda okuması kadar durmak verir.
   - Süre: kutudaki her kelime çeyrek saniye (veri.cuzdan.okumaSaniye: 0.25; dakikada ~240 kelime). Kutu ekranın yarısından çoğunda
     görünürken, sekme açıkken ve kişi son 45 saniyede ekranla ilgilenmişken sayılır. Kutunun altında ince çubuk.
   - Karakter kaydı okununca kart (ve eçka) gelir; bugünün kaydının ödülü de okununca. Öbür kutular (mektup, günlük,
     alıntı, zaman çizelgesi, evren maddesi) okuma tavanına kadar eçka verir.
   - Karakter rozeti: bir karakter hakkındaki bütün kutular (kaydı, mektupları, günlükleri, alıntıları, adının geçtiği
     zaman çizelgesi adımları — görebildiklerin) okununca gümüş rozet. O karaktere fan hikâyesi yazınca altın rozet;
     hepsini okumadan yazdıysan altın için kalanları okuman istenir.
   Okunan kutular cüzdanda ("oku_<anahtar>") durur: hesapla cihazlar arası eşitlenir. */

const OKU_BOSTA_SN = 45;
const OKU = { kayit: new Map(), sonEtkinlik: Date.now(), gozcu: null, bugunKart: null };

function okuSaniyeKelime() {
  let s = Number(veri && veri.cuzdan && veri.cuzdan.okumaSaniye) || 0.25;
  /* yalnızca yerel testte hızlandırılabilir */
  try { if (/^(localhost|127\.)/.test(location.hostname)) { const h = Number(localStorage.getItem("tentiforapp_okuma_hiz")); if (h > 0) { s = s / h; } } } catch (_) { /* yok */ }
  return s;
}

function kelimeSay(metin) { return (String(metin || "").match(/[0-9A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû'’-]+/g) || []).length; }

function okunduMu(anahtar) { return typeof kilitAcik === "function" && kilitAcik("oku_" + anahtar); }

function okunduIsaretle(anahtar) {
  if (okunduMu(anahtar) || typeof cuzdan === "undefined") { return false; }
  cuzdan.acilan.push("oku_" + anahtar);
  if (typeof cuzdanKaydet === "function") { cuzdanKaydet(); }
  return true;
}

/* ---------- motor ---------- */

document.addEventListener("scroll", function () { OKU.sonEtkinlik = Date.now(); }, { passive: true, capture: true });
["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (t) {
  document.addEventListener(t, function () { OKU.sonEtkinlik = Date.now(); }, { passive: true, capture: true });
});

function okuGozcu() {
  if (OKU.gozcu || typeof IntersectionObserver !== "function") { return OKU.gozcu; }
  OKU.gozcu = new IntersectionObserver(function (girdiler) {
    girdiler.forEach(function (g) {
      const k = OKU.kayit.get(g.target);
      if (!k) { return; }
      const ekran = window.innerHeight || 800;
      k.gorunur = g.isIntersecting && (g.intersectionRatio >= 0.5 || g.intersectionRect.height >= ekran * 0.6);
    });
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  return OKU.gozcu;
}

/** [data-oku] taşıyan yeni kutuları izlemeye alır. */
function okuTara() {
  const gz = okuGozcu();
  document.querySelectorAll("[data-oku]:not([data-oku-izle])").forEach(function (el) {
    const anahtar = el.getAttribute("data-oku");
    el.setAttribute("data-oku-izle", "1");
    if (okunduMu(anahtar) && !/^kar:/.test(anahtar)) { el.classList.add("oku-tamam"); return; }
    const kelime = Number(el.getAttribute("data-oku-kelime")) || kelimeSay(el.innerText);
    if (kelime < 1) { return; }
    const gerek = Math.max(2, Math.round(kelime * okuSaniyeKelime()));
    const kayit = { anahtar: anahtar, gerek: gerek, sure: 0, gorunur: false, bitti: false };
    /* karakter kaydı her gün yeniden okunabilir (parlak kart üç ayrı günde okumayla gelir) */
    if (/^kar:/.test(anahtar) && okuBugunOkundu(anahtar)) { el.classList.add("oku-tamam"); return; }
    OKU.kayit.set(el, kayit);
    if (!el.querySelector(":scope > .oku-cubuk")) {
      el.insertAdjacentHTML("beforeend", '<span class="oku-cubuk" aria-hidden="true"><i></i></span><span class="oku-yazi" aria-live="polite"></span>');
    }
    if (gz) { gz.observe(el); }
  });
}

setInterval(function () {
  if (document.visibilityState !== "visible" || Date.now() - OKU.sonEtkinlik > OKU_BOSTA_SN * 1000) { return; }
  OKU.kayit.forEach(function (k, el) {
    if (!el.isConnected) { OKU.kayit.delete(el); return; }
    if (k.bitti || !k.gorunur) { return; }
    k.sure++;
    const c = el.querySelector(":scope > .oku-cubuk > i"), y = el.querySelector(":scope > .oku-yazi");
    if (c) { c.style.width = Math.min(100, Math.round(100 * k.sure / k.gerek)) + "%"; }
    if (y && k.sure >= 2) { y.textContent = k.sure >= k.gerek ? "" : "okunuyor · " + Math.max(0, k.gerek - k.sure) + " sn"; }
    if (k.sure >= k.gerek) { k.bitti = true; okumaBitti(k.anahtar, el); }
  });
}, 1000);

let okuTaraZaman = null;
new MutationObserver(function () {
  if (okuTaraZaman) { return; }
  okuTaraZaman = setTimeout(function () { okuTaraZaman = null; okuEtiketle(); okuTara(); }, 300);
}).observe(document.documentElement, { childList: true, subtree: true });

/* ---------- ödüller ---------- */

function okuBugun() { return typeof bugununAdi === "function" ? bugununAdi() : new Date().toISOString().slice(0, 10); }

function okuBugunOkundu(anahtar) {
  const g = (typeof jsonOku === "function" ? jsonOku("tentiforapp_oku_bugun", {}) : {}) || {};
  return g.gun === okuBugun() && (g.l || []).indexOf(anahtar) !== -1;
}

function okuBugunEkle(anahtar) {
  let g = jsonOku("tentiforapp_oku_bugun", {}) || {};
  if (g.gun !== okuBugun()) { g = { gun: okuBugun(), l: [] }; }
  if (g.l.indexOf(anahtar) === -1) { g.l.push(anahtar); }
  jsonYaz("tentiforapp_oku_bugun", g);
}

let GUNUN_BEKLER = 0;

function okumaBitti(anahtar, el) {
  el.classList.add("oku-tamam");
  const ilk = okunduIsaretle(anahtar);
  const m = anahtar.match(/^kar:(.+)$/);
  if (m) {
    okuBugunEkle(anahtar);
    OKU.okumaIzni = true;
    try { if (typeof kartKazan === "function") { kartKazan(m[1], "okuma"); } } finally { OKU.okumaIzni = false; }
  } else if (ilk && typeof gunlukKazan === "function") {
    const kelime = Number(el.getAttribute("data-oku-kelime")) || kelimeSay(el.innerText);
    gunlukKazan("okuma", Math.max(1, Math.round(kelime / 40)), "Okuma");
  }
  /* bugünün kaydı: okununca ödül */
  if (GUNUN_BEKLER && Date.now() - GUNUN_BEKLER < 30 * 60000 && typeof OKU.gununOrijinal === "function") {
    GUNUN_BEKLER = 0;
    OKU.gununOrijinal();
  }
  rozetleriDenetle();
  /* açık karakter penceresindeki rozet durumu tazelensin */
  const rk = document.querySelector("#perde:not([hidden]) .rozet-kutu");
  const km = document.querySelector('#perde:not([hidden]) [data-oku^="kar:"]');
  if (rk && km) {
    const k = (veri.karakterler || []).find(function (x) { return "kar:" + x.id === km.getAttribute("data-oku"); });
    if (k) { rk.outerHTML = rozetKutusuHtml(k); }
  }
}

if (typeof gununOkundu === "function") {
  OKU.gununOrijinal = gununOkundu;
  window.gununOkundu = function () {
    GUNUN_BEKLER = Date.now();
    if (typeof eckaBildir === "function") { eckaBildir("Bugünün kaydı: sonuna kadar oku, ödülü okuyunca al"); }
  };
}

/* dokununca kart vermesin: kart okumayla gelir (39-yil-koleksiyon.js karakterAc sarmalı) */
if (typeof kartKazan === "function") {
  const eskiKart = kartKazan;
  window.kartKazan = function (id, kaynak) {
    if (kaynak === "okuma" && !OKU.okumaIzni) { return; }
    return eskiKart.apply(this, arguments);
  };
}

/* ---------- kutuları etiketlemek ---------- */

function okuErisim(bolum, gizli) {
  const yon = typeof yoneticiAcik === "function" && yoneticiAcik();
  if (yon) { return true; }
  if (bolum && typeof bolumErisimi === "function" && !bolumErisimi(bolum)) { return false; }
  if (!gizli) { return true; }
  return typeof katmanAcik === "function" && katmanAcik(gizli) && (typeof spoilerUygun !== "function" || spoilerUygun(gizli));
}

/** Sayfadaki bilinen kutuları [data-oku] ile işaretler (karakterlerle bağları rozet için). */
function okuEtiketle() {
  const esle = function (sec, fn) {
    document.querySelectorAll(sec).forEach(function (el, i) {
      if (el.hasAttribute("data-oku")) { return; }
      const a = fn(el, i);
      if (a) { el.setAttribute("data-oku", a); }
    });
  };
  esle("#mektupAlan .mektup", function (el, i) { const m = (veri.mektuplar || [])[i]; return m && !el.classList.contains("kapali") ? "mektup:" + (m.id || i) : null; });
  esle("#gunlukAlan .gunluk", function (el, i) { const g = (veri.gunlukler || [])[i]; return g && !el.classList.contains("kapali") ? "gunluk:" + i : null; });
  const alintilar = okuAlintiGorunur();
  esle("#alintiAlan figure.alinti", function (el, i) { const a = alintilar[i]; return a ? "alinti:" + a.i : null; });
  esle("#zamanAlan .zaman-madde", function (el, i) { const z = (veri.zamanCizelgesi || [])[i]; return z && !el.classList.contains("kilitli") ? "zaman:" + (z.no || i) : null; });
  /* açılır maddeler (evren maddeleri, Claude'un evreni, yazar notları): gövde açıkken görünür */
  esle(".madde[id] > .madde-govde", function (el) { return "madde:" + el.parentNode.id; });
  esle(".ce-kisi[id] > .detay-metin", function (el) { return "madde:" + el.parentNode.id; });
}

function okuAlintiGorunur() {
  const yon = typeof yoneticiAcik === "function" && yoneticiAcik();
  return (veri.alintilar || []).map(function (a, i) { return { a: a, i: i }; }).filter(function (x) { return yon || (typeof katmanAcik === "function" && katmanAcik(x.a.gizli)); });
}

/* karakter penceresi: özet ve anlatım bir kutu; altında rozet durumu */
sonraSar("karakterAc", function (eskiAc) {
  return function (i) {
    const r = eskiAc.apply(this, arguments);
    const k = veri.karakterler[i];
    const p = document.querySelector("#perde .pencere");
    if (k && p && !document.querySelector("#perde").hidden) {
      const d = p.querySelector(".detay-metin");
      const hedef = d || p;
      hedef.setAttribute("data-oku", "kar:" + k.id);
      hedef.setAttribute("data-oku-kelime", String(kelimeSay(k.ozet) + kelimeSay(k.detay)));
      p.insertAdjacentHTML("beforeend", rozetKutusuHtml(k));
      okuTara();
    }
    return r;
  };
});

/* ---------- karakter rozetleri ---------- */

function okuAdVar(metin, ad) {
  if (!ad || !metin) { return false; }
  const kac = String(ad).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^0-9A-Za-zÇĞİÖŞÜçğıöşü])" + kac + "(?=$|[^0-9A-Za-zÇĞİÖŞÜçğıöşü])", "i").test(String(metin));
}

/** Karakter hakkındaki kutular: [{ anahtar, ad, git, kilitli }]. Kodla kilitli bölümdekiler de sayılır (rozet için
    hepsi okunmalı; o bölüm açılınca okunur); buz altındaki gizli kayıtlar sayılmaz, varlığı da belli edilmez. */
function karakterKutulari(k) {
  const buzAcik = function (gizli) { return okuErisim(null, gizli); };
  const kodKilitli = function (bolum) { return !(typeof yoneticiAcik === "function" && yoneticiAcik()) && typeof bolumErisimi === "function" && !bolumErisimi(bolum); };
  const l = [{ anahtar: "kar:" + k.id, ad: "Kaydı: " + k.ad, git: "#/karakter/" + k.id, kilitli: kodKilitli("arsiv") }];
  (veri.mektuplar || []).forEach(function (m, i) {
    if ((m.kimden === k.ad || m.kime === k.ad) && buzAcik(m.gizli)) { l.push({ anahtar: "mektup:" + (m.id || i), ad: "Mektup: " + m.kimden + " → " + m.kime, git: "#mektuplar", kilitli: kodKilitli("mektuplar") }); }
  });
  (veri.gunlukler || []).forEach(function (g, i) {
    if (g.kim === k.ad && buzAcik(g.gizli)) { l.push({ anahtar: "gunluk:" + i, ad: "Günlük: " + (g.tarih || i + 1), git: "#gunluk", kilitli: kodKilitli("mektuplar") }); }
  });
  (veri.alintilar || []).forEach(function (a, i) {
    if (okuAdVar(a.kim, k.ad) && buzAcik(a.gizli)) { l.push({ anahtar: "alinti:" + i, ad: "Alıntı: “" + String(a.metin).slice(0, 30) + "…”", git: "#alintilar", kilitli: kodKilitli("alintilar") }); }
  });
  (veri.zamanCizelgesi || []).forEach(function (z, i) {
    if ((okuAdVar(z.metin, k.ad) || okuAdVar(z.baslik, k.ad)) && buzAcik(z.gizli)) { l.push({ anahtar: "zaman:" + (z.no || i), ad: "Zaman: " + z.baslik, git: "#zaman", kilitli: kodKilitli("zaman") }); }
  });
  return l;
}

function karakterOkunanlar(k) {
  const l = karakterKutulari(k);
  return { l: l, okunan: l.filter(function (x) { return okunduMu(x.anahtar); }) };
}

/** Karakter hakkında yazılmış fan hikâyesi (kişiler listesinde adı geçen, en az 300 harf). */
function karakterFanHikayesi(k) {
  const l = typeof fanEserlerim === "function" ? fanEserlerim() : [];
  return l.find(function (e) {
    if (e.tur !== "hikaye" || String(e.metin || "").length < 300) { return false; }
    return String(e.karakterler || "").split(",").some(function (s) { return s.trim().toLocaleLowerCase("tr") === String(k.ad).toLocaleLowerCase("tr"); });
  }) || null;
}

function rozetDurumu(k) {
  if (typeof kilitAcik !== "function") { return ""; }
  return kilitAcik("rozet_altin_" + k.id) ? "altin" : (kilitAcik("rozet_" + k.id) ? "gumus" : "");
}

/** Her okumadan ve her fan hikâyesi kaydından sonra: hak edilen rozetler verilir. */
function rozetleriDenetle() {
  if (typeof cuzdan === "undefined" || typeof kilitAcik !== "function") { return; }
  const haber = [];
  let ecka = 0;
  (veri.karakterler || []).forEach(function (k) {
    if (!k.id || k.kart === false || !okuErisim(null, k.gizli)) { return; }
    const o = karakterOkunanlar(k);
    const hepsi = o.okunan.length === o.l.length;
    if (hepsi && !kilitAcik("rozet_" + k.id)) { cuzdan.acilan.push("rozet_" + k.id); ecka += 20; haber.push("Gümüş rozet: " + k.ad); }
    if (hepsi && karakterFanHikayesi(k) && !kilitAcik("rozet_altin_" + k.id)) { cuzdan.acilan.push("rozet_altin_" + k.id); ecka += 50; haber.push("Altın rozet: " + k.ad); }
  });
  if (!haber.length) { return; }
  if (typeof eckaKazan === "function") { eckaKazan(ecka, haber.join(" · ")); } else if (typeof cuzdanKaydet === "function") { cuzdanKaydet(); }
  if (typeof hesapBildir === "function") { hesapBildir(haber.join(" · ") + " (+" + ecka + " eçka)"); }
  else if (typeof eckaBildir === "function") { eckaBildir(haber.join(" · ")); }
  if (document.querySelector("#koleksiyonAlan") && typeof koleksiyonCiz === "function") { koleksiyonCiz(); }
}

const ROZET_SIMGE = { gumus: "🥈", altin: "🥇" };

function rozetKutusuHtml(k) {
  const o = karakterOkunanlar(k);
  const r = rozetDurumu(k);
  const hikaye = karakterFanHikayesi(k);
  const kalan = o.l.length - o.okunan.length;
  return '<div class="kutu-y rozet-kutu">' +
    '<div class="oyun-etiket">' + (r ? ROZET_SIMGE[r] + " " + (r === "altin" ? "Altın rozet" : "Gümüş rozet") : "Karakter rozeti") + " · " + o.okunan.length + " / " + o.l.length + " kutu okundu</div>" +
    '<ul class="rozet-liste">' + o.l.map(function (x) {
      const ok = okunduMu(x.anahtar);
      return '<li class="' + (ok ? "ok" : (x.kilitli ? "kilitli" : "")) + '">' + (ok ? "✓" : (x.kilitli ? "🔒" : "○")) + " " +
        (x.anahtar.indexOf("kar:") === 0 ? kacir(x.ad) + (ok ? "" : ' <span class="oyun-not">(bu pencere · sonuna kadar oku)</span>')
          : (x.kilitli && !ok ? kacir(x.ad) + ' <span class="oyun-not">(bölümü kodla açılır)</span>' : '<a href="' + kacir(x.git) + '" data-kapat="1">' + kacir(x.ad) + "</a>")) + "</li>";
    }).join("") + "</ul>" +
    '<p class="oyun-not">' + (r === "altin" ? "Hakkındaki her şeyi okudun ve ona bir hikâye yazdın."
      : (r === "gumus" ? (hikaye ? "" : "Altın rozet: " + kacir(k.ad) + " hakkında bir fan hikâyesi yaz (hikâyenin kişilerine adını ekle).")
        : (hikaye ? "Ona bir hikâye yazdın — altın rozet için hakkındaki her şeyi oku (" + kalan + " kutu kaldı)."
          : "Hakkındaki her kutuyu okuyunca gümüş rozet; ona bir fan hikâyesi de yazınca altın."))) + "</p></div>";
}

/* fan hikâyesi kaydedilince rozetler; düzenleyicide adı geçen karakterlerin durumu */
if (typeof fanEserlerimYaz === "function") {
  const eskiYaz = fanEserlerimYaz;
  window.fanEserlerimYaz = function () {
    const r = eskiYaz.apply(this, arguments);
    setTimeout(rozetleriDenetle, 0);
    return r;
  };
}

if (typeof fanCiz === "function") {
  const eskiFanCiz = fanCiz;
  window.fanCiz = function (tur) {
    const r = eskiFanCiz.apply(this, arguments);
    if (tur === "hikaye" && typeof fanDuzenlenen === "function" && !(typeof fanSekme !== "undefined" && fanSekme.hikaye === "oku")) {
      const e = fanDuzenlenen("hikaye");
      const alan = document.querySelector("#fanHikayeAlan, [data-fan-alan='hikaye']");
      if (e && alan) {
        const adlar = String(e.karakterler || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        const kl = adlar.map(function (a) { return (veri.karakterler || []).find(function (k) { return String(k.ad).toLocaleLowerCase("tr") === a.toLocaleLowerCase("tr"); }); }).filter(Boolean);
        if (kl.length) {
          alan.insertAdjacentHTML("beforeend", '<div class="kutu-y rozet-kutu fan-rozet"><div class="oyun-etiket">Altın rozet</div>' + kl.map(function (k) {
            const o = karakterOkunanlar(k), r = rozetDurumu(k);
            const kalan = o.l.length - o.okunan.length;
            return "<p>" + (r === "altin" ? "🥇 " : "") + "<b>" + kacir(k.ad) + "</b>: " +
              (r === "altin" ? "altın rozetin var." : (kalan ? "altın rozet için hakkındaki her şeyi oku — " + kalan + " kutu kaldı." : "hikâyen en az 300 harf olunca altın rozet gelir.")) + "</p>";
          }).join("") + "</div>");
        }
      }
    }
    return r;
  };
}

/* koleksiyonda rozetler */
if (typeof koleksiyonCiz === "function") {
  const eskiKol = koleksiyonCiz;
  window.koleksiyonCiz = function () {
    const r = eskiKol.apply(this, arguments);
    const alan = document.querySelector("#koleksiyonAlan");
    if (alan) {
      const l = (veri.karakterler || []).filter(function (k) { return k.id && k.kart !== false && okuErisim(null, k.gizli); });
      const kazanilan = l.filter(function (k) { return rozetDurumu(k); });
      alan.insertAdjacentHTML("afterbegin", '<div class="kutu-y rozet-ozet"><div class="oyun-etiket">Karakter rozetleri · ' + kazanilan.length + " / " + l.length + "</div>" +
        '<div class="rozet-izgara">' + l.map(function (k) {
          const r = rozetDurumu(k), o = karakterOkunanlar(k);
          return '<button type="button" class="rozet-oge ' + (r || "yok") + '" data-rozet-kar="' + kacir(k.id) + '" title="' + kacir(k.ad + " · " + o.okunan.length + "/" + o.l.length) + '">' +
            '<span class="rozet-simge" aria-hidden="true">' + (r ? ROZET_SIMGE[r] : "○") + "</span><span>" + kacir(k.ad) + "</span>" +
            '<small>' + o.okunan.length + "/" + o.l.length + "</small></button>";
        }).join("") + "</div></div>");
    }
    return r;
  };
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-rozet-kar]");
  if (!b) { return; }
  const i = (veri.karakterler || []).findIndex(function (k) { return k.id === b.dataset.rozetKar; });
  if (i !== -1 && typeof karakterAc === "function") { karakterAc(i); }
});
