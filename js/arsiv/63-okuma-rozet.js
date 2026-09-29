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
  rbSeritleriZamanla();   /* bağlı kutu şeritleri (76) */
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
  /* veri.json gelmeden (sayfa açılırken) etiketlenecek bir şey yok */
  okuTaraZaman = setTimeout(function () { okuTaraZaman = null; if (typeof veri === "undefined" || !veri) { return; } okuEtiketle(); okuTara(); }, 300);
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
  const yol = yolAktif();                              /* seçili okuma yolu */
  const yolOnce = yol ? yolIlerleme(yol).okunan : 0;
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
  if (GUNUN_BEKLER && Date.now() - GUNUN_BEKLER < 30 * 60000) {
    GUNUN_BEKLER = 0;
    gununOdulu();
  }
  rozetleriDenetle();
  /* açık karakter penceresindeki rozet durumu tazelensin */
  const rk = document.querySelector("#perde:not([hidden]) .rozet-kutu");
  const km = document.querySelector('#perde:not([hidden]) [data-oku^="kar:"]');
  if (rk && km) {
    const k = (veri.karakterler || []).find(function (x) { return "kar:" + x.id === km.getAttribute("data-oku"); });
    if (k) { rk.outerHTML = rozetKutusuHtml(k); }
  }
  try { rbSeritleriTazele(); } catch (_) { /* yok */ }  /* kutu rozeti şeritleri */
  /* okuma yolu bittiyse */
  if (yol) {
    const o = yolIlerleme(yol);
    if (o.okunan > yolOnce && !o.sonraki) {
      jsonYaz(YOL_AKTIF, null);
      eckaBildir("Yol bitti: " + yol.ad + " ✓");
    }
    yolCubuguCiz();
  }
  /* günlük okuma sayısı (okur istatistiği) */
  const g = tf28Oku(TF28.kutu, {}) || {};
  const bugun = yerelGun();
  g[bugun] = (g[bugun] || 0) + 1;
  tf28Yaz(TF28.kutu, gunleriBuda(g));
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
  if (typeof veri === "undefined" || !veri) { return; }
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
  esle(".ce-hikaye[id] > .detay-metin", function (el) { return "madde:" + el.parentNode.id; });
  /* Claude'un Evreni: mektuplar, yankılar, sözlüğün tamamı, roman bölümleri */
  esle("#claudeEvrenAlan .mektup[id] > .mektup-metin", function (el) { return "madde:" + el.parentNode.id; });
  esle("#claudeEvrenAlan .ce-yanki[id]", function (el) { return "madde:" + el.id; });
  esle("#claudeEvrenAlan #ce-sozluk", function () { return "madde:ce-sozluk"; });
  esle("#claudeEvrenAlan .ce-roman-metin[data-bolum]", function (el) { return "madde:ce-roman-" + el.getAttribute("data-bolum"); });
  /* evren maddeleri (data-madde: veri.evren sırası). Tömye listesinde de E25 gibi kanon evren sayfalarında da
     aynı anahtar: iki yerde görünen madde tek kutudur, XP'si bir kez gelir */
  esle(".madde[data-madde] > .madde-govde", function (el) {
    const m = (veri.evren || [])[Number(el.parentNode.getAttribute("data-madde"))];
    return m && m.id ? "evren:" + m.id : null;
  });
  esle("#notlarAlan .madde[data-not] > .madde-govde", function (el) { return "not:" + el.parentNode.getAttribute("data-not"); });
  /* diğer evrenler (sitedeki fan evrenleri, kanon evren sayfaları, E99): bilgi bölümleri ve roman bölümleri.
     Kendi evrenin ve dosyadan açtıkların sayılmaz (oyun ödülleriyle aynı kural); 30 kelimeden kısa bölüm kutu değildir. */
  const evs = okuEvrenOnEki();
  if (evs) {
    const yeter = function (el) { return okuKelimeSay(el.textContent) >= 30; };
    esle("#evrenSayfa .fan-grup[data-grup]", function (el) { return yeter(el) ? evs + el.getAttribute("data-grup") : null; });
    esle("#evrenSayfa .evr-oku .okuma-metin", function (el) {
      const b = typeof evrDurum === "function" ? evrDurum().secili : null;
      return b && yeter(el) ? evs + "roman:" + b : null;
    });
  }
}

/** "ev:fan:<id>:" gibi önek; okuma XP'si vermeyen evrende (kendi evrenin, dosyadan açılan) null. */
function okuEvrenOnEki() {
  if (typeof EVS === "undefined" || !EVS || !document.querySelector("#evrenSayfa")) { return null; }
  if (EVS.kaynak === "benim" || EVS.kaynak === "acilan") { return null; }
  if (EVS.kaynak === "fan" && typeof evrenKendisininMi === "function" && evrenKendisininMi(EVS.id)) { return null; }
  return "ev:" + EVS.kaynak + ":" + EVS.id + ":";
}

function okuKelimeSay(t) { return String(t || "").split(/\s+/).filter(Boolean).length; }

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

/** Karakterin metinlerde geçen adları: tam adı ve (başka karakterle çakışmıyorsa) ilk adı.
    Mektuplar ve alıntılar "Saek", "Feil" diye imzalanır; kayıtta tam ad "Saek Luyot"tur. */
function karakterAdlari(k) {
  const l = [k.ad];
  const ilk = String(k.ad || "").split(/\s+/)[0];
  if (ilk && ilk !== k.ad && ilk.length >= 3 &&
      (veri.karakterler || []).filter(function (x) { return String(x.ad || "").split(/\s+/)[0] === ilk; }).length === 1) { l.push(ilk); }
  return l;
}
function karakterAnilir(metin, k) { return karakterAdlari(k).some(function (a) { return okuAdVar(metin, a); }); }

/** Karakter hakkındaki kutular: [{ anahtar, ad, git, kilitli }]. Kodla kilitli bölümdekiler de sayılır (rozet için
    hepsi okunmalı; o bölüm açılınca okunur); buz altındaki gizli kayıtlar sayılmaz, varlığı da belli edilmez. */
function karakterKutulari(k) {
  const buzAcik = function (gizli) { return okuErisim(null, gizli); };
  const kodKilitli = function (bolum) { return !(typeof yoneticiAcik === "function" && yoneticiAcik()) && typeof bolumErisimi === "function" && !bolumErisimi(bolum); };
  const adlar = karakterAdlari(k);
  const l = [{ anahtar: "kar:" + k.id, ad: "Kaydı: " + k.ad, git: "#/karakter/" + k.id, kilitli: kodKilitli("arsiv") }];
  (veri.mektuplar || []).forEach(function (m, i) {
    if ((adlar.indexOf(m.kimden) !== -1 || adlar.indexOf(m.kime) !== -1) && buzAcik(m.gizli)) { l.push({ anahtar: "mektup:" + (m.id || i), ad: "Mektup: " + m.kimden + " → " + m.kime, git: "#mektuplar", kilitli: kodKilitli("mektuplar") }); }
  });
  (veri.gunlukler || []).forEach(function (g, i) {
    if (adlar.indexOf(g.kim) !== -1 && buzAcik(g.gizli)) { l.push({ anahtar: "gunluk:" + i, ad: "Günlük: " + (g.tarih || i + 1), git: "#gunluk", kilitli: kodKilitli("mektuplar") }); }
  });
  (veri.alintilar || []).forEach(function (a, i) {
    if (karakterAnilir(a.kim, k) && buzAcik(a.gizli)) { l.push({ anahtar: "alinti:" + i, ad: "Alıntı: “" + String(a.metin).slice(0, 30) + "…”", git: "#alintilar", kilitli: kodKilitli("alintilar") }); }
  });
  (veri.zamanCizelgesi || []).forEach(function (z, i) {
    if ((karakterAnilir(z.metin, k) || karakterAnilir(z.baslik, k)) && buzAcik(z.gizli)) { l.push({ anahtar: "zaman:" + (z.no || i), ad: "Zaman: " + z.baslik, git: "#zaman", kilitli: kodKilitli("zaman") }); }
  });
  /* bağ ağında karaktere bağlı kutular (başka karakterin kaydı onun rozetidir) (76-rozet-baglari) */
  const var_ = {};
  l.forEach(function (x) { var_[x.anahtar] = true; });
  rbBaglar("kar:" + k.id).forEach(function (b) {
    if (!var_[b.anahtar] && !/^kar:/.test(b.anahtar)) { l.push({ anahtar: b.anahtar, ad: b.ad, git: b.git, kilitli: false }); }
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
  try { rbRozetleriDenetle(); } catch (_) { /* kutu rozetleri (76); rozet hesabı hiçbir şeyi bozmasın */ }
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
          : "Hakkındaki her kutuyu okuyunca gümüş rozet; ona bir fan hikâyesi de yazınca altın."))) + "</p>" +
    rozetYoluHtml(k) + "</div>";
}

/** Karakterin okuma yolu varsa: "Okuma yolu: 3/8 · ~20 dk". */
function rozetYoluHtml(k) {
  const y = okumaYolu("kar:" + k.id);
  const o = y ? yolIlerleme(y) : null;
  if (!o || !o.sonraki) { return ""; }
  return '<div class="oyun-sira"><button class="dugme dugme-sade y-kucuk" data-yol-basla="' + kacir(y.id) + '">📖 Okuma yolu: ' +
    o.okunan + "/" + o.toplam + " · ~" + y.dakika + " dk</button></div>";
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-rozet-kar]");
  if (!b) { return; }
  const i = (veri.karakterler || []).findIndex(function (k) { return k.id === b.dataset.rozetKar; });
  if (i !== -1 && typeof karakterAc === "function") { karakterAc(i); }
});
