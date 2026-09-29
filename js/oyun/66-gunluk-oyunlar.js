/* Günlük oyunlar ve oyun XP'si.

   - Oyun XP'si: kazanılan her günlük oyun 10 XP; her oyun günde bir kez, bütün oyunlarda günde en çok 80 XP.
     Tömye'nin günlük oyunları, günün kelimesi (kolay) ve bütün evrenlerin oyunları (51-evren-oyunlari.js)
     aynı havuzdan yer. Kayıtlar cuzdan.acilan'da "oxp_<gün>_<oyun>" olarak durur: hesapla eşitlenir, sunucuya
     toplam olarak gider (istatistik_gonder: oyun_xp; sunucu gelinen günle sınırlar).
   - Tömye'nin günlük oyunları: Kim bu?, Madde bilmecesi, Doğru mu? Sorular güne göre seçilir: aynı gün
     herkese aynı sorular; tekrar oynanır ama XP günde bir kez. Başlangıç koduyla açılan içerikten kurulur. */

const OYUN_XP = 10;
const OYUN_XP_GUNLUK = 80;

function oyunXpGunu() { return typeof koGun === "function" ? koGun() : new Date().toISOString().slice(0, 10); }

function oyunXpKayitlari() {
  return (typeof cuzdan !== "undefined" && cuzdan.acilan ? cuzdan.acilan : []).filter(function (x) { return /^oxp_/.test(x); });
}

function oyunXpToplam() { return OYUN_XP * oyunXpKayitlari().length; }

function oyunXpBugun() {
  const on = "oxp_" + oyunXpGunu() + "_";
  return OYUN_XP * oyunXpKayitlari().filter(function (x) { return x.indexOf(on) === 0; }).length;
}

function oyunXpAnahtari(oyun) { return "oxp_" + oyunXpGunu() + "_" + String(oyun || "").replace(/[^\w:|.-]/g, "").slice(0, 80); }

function oyunXpAlindi(oyun) { return oyunXpKayitlari().indexOf(oyunXpAnahtari(oyun)) !== -1; }

/** Günde bir kez: kazanılan XP (0 = bugün alındı ya da günlük tavan doldu). */
function oyunXpVer(oyun) {
  setTimeout(oyunBugunCiz, 0);          /* "bugün" kutusu */
  setTimeout(hatirlatmalariKur, 0);     /* hatırlatmalar yeniden kurulur */
  if (typeof cuzdan === "undefined" || !oyun) { return 0; }
  const k = oyunXpAnahtari(oyun);
  if (cuzdan.acilan.indexOf(k) !== -1 || oyunXpBugun() >= OYUN_XP_GUNLUK) { return 0; }
  cuzdan.acilan.push(k);
  if (typeof cuzdanKaydet === "function") { cuzdanKaydet(); }
  if (typeof SVK !== "undefined") { SVK.onbellek = null; }
  if (typeof eckaBildir === "function") { eckaBildir("+" + OYUN_XP + " XP · günlük oyun"); }
  return OYUN_XP;
}

function oyunXpDurumMetni() {
  const b = oyunXpBugun();
  return b >= OYUN_XP_GUNLUK ? "Bugünkü oyun XP'si doldu (" + OYUN_XP_GUNLUK + "). Yarın yine."
    : "Bugün oyunlardan " + b + " / " + OYUN_XP_GUNLUK + " XP. Kazandığın her oyun günde bir kez " + OYUN_XP + " XP.";
}

/* ==================== Tömye'nin günlük oyunları ==================== */

/* evren: XP anahtarının öneki ("tomye|kim", "claude|kim") ve oyunun çizildiği alan */
const GO_OYUNLAR = [
  { id: "kim", evren: "tomye", ad: "Kim bu?", ozet: "Kısa tanımdan karakteri bul. 5 soru, 4 doğru yeter.", bolum: "arsiv", n: 5, esik: 4 },
  { id: "madde", evren: "tomye", ad: "Madde bilmecesi", ozet: "Özetten evren maddesini bul. 5 soru, 4 doğru yeter.", bolum: "evren", n: 5, esik: 4 },
  { id: "dogru", evren: "tomye", ad: "Doğru mu?", ozet: "8 iddia: karakter ve unvanı eşleşiyor mu? 7 doğru yeter.", bolum: "arsiv", n: 8, esik: 7 }
];
const GO_ALANLAR = { tomye: "#gunlukOyunAlan", claude: "#ceGunlukAlan" };

let GO = null;   /* açık oyun: { id, evren, i, dogru, secim, sorular } */

function goTanim(evren, id) { return GO_OYUNLAR.find(function (x) { return x.evren === evren && x.id === id; }); }

/** Güne ve oyuna bağlı tekrarlanabilir rastgele sayı üreteci (mulberry32). */
function goRastgele(tohum) {
  let h = 1779033703;
  for (let i = 0; i < tohum.length; i++) { h = Math.imul(h ^ tohum.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return function () {
    h |= 0; h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function goKaristir(l, r) {
  const d = l.slice();
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const x = d[i]; d[i] = d[j]; d[j] = x; }
  return d;
}

function goGizle(metin, ad) {
  const c = String(ad || "").trim();
  return c ? String(metin).replace(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "…") : String(metin);
}

function goKarakterler() {
  return (veri.karakterler || []).filter(function (k) {
    return k.ad && k.unvan && k.ozet && k.kart !== false && !k.gizli && (typeof evrendeMi !== "function" || evrendeMi(k, "tomye"));
  });
}

function goMaddeler() {
  return (veri.evren || []).filter(function (m) {
    return m.baslik && m.ozet && (typeof evrendeMi !== "function" || evrendeMi(m, "tomye"));
  });
}

/** Başka evrenlerin soru üreticileri: GO_URETICI[evren](id, r, kisa) → sorular */
const GO_URETICI = {};

function goSorular(id, evren) {
  if (evren && evren !== "tomye" && GO_URETICI[evren]) {
    const rc = goRastgele(oyunXpGunu() + "|" + evren + "|" + id);
    return GO_URETICI[evren](id, rc, function (s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; });
  }
  const r = goRastgele(oyunXpGunu() + "|" + id);
  const kisa = function (s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  if (id === "kim" || id === "madde") {
    const l = id === "kim" ? goKarakterler() : goMaddeler();
    const ad = function (x) { return id === "kim" ? x.ad : x.baslik; };
    return goKaristir(l, r).slice(0, 5).map(function (x) {
      const yanlis = goKaristir(l.filter(function (y) { return ad(y) !== ad(x); }), r).slice(0, 3).map(ad);
      return { soru: "“" + kisa(goGizle(x.ozet, ad(x)), 220) + "” — " + (id === "kim" ? "bu kim?" : "hangi madde?"), dogru: ad(x),
        secenekler: goKaristir([ad(x)].concat(yanlis), r) };
    });
  }
  const l = goKarakterler();
  return goKaristir(l, r).slice(0, 8).map(function (x) {
    const baska = l.filter(function (y) { return y.unvan !== x.unvan; });
    const yanlis = baska.length && r() < 0.5;
    const unvan = yanlis ? goKaristir(baska, r)[0].unvan : x.unvan;
    return { soru: x.ad + " — “" + unvan + "”", dogru: yanlis ? "Yanlış" : "Doğru", secenekler: ["Doğru", "Yanlış"] };
  });
}

function goAcikMi(o) { return !o.bolum || typeof bolumErisimi !== "function" || bolumErisimi(o.bolum); }

function goOyunHtml() {
  const o = goTanim(GO.evren, GO.id);
  const n = GO.sorular.length;
  if (GO.i >= n) {
    return '<div class="evo-oyun"><span class="oyun-etiket">' + kacir(o.ad) + "</span>" +
      '<p class="evo-skor">' + GO.dogru + " / " + n + "</p>" +
      '<p class="oyun-not">' + (GO.dogru >= o.esik ? "Geçtin! " : "Geçmek için en az " + o.esik + " doğru gerekiyor. ") + kacir(GO.mesaj || "") + "</p>" +
      '<div class="oyun-sira"><button class="dugme" data-go-basla="' + o.id + '" data-go-evren="' + o.evren + '">Tekrar</button><button class="dugme dugme-sade" data-go-kapat>Oyunlara dön</button></div></div>';
  }
  const q = GO.sorular[GO.i];
  const cevaplandi = GO.secim !== null;
  return '<div class="evo-oyun"><div class="gk-ust"><span class="oyun-etiket">' + kacir(o.ad) + '</span><span class="oyun-not">' + (GO.i + 1) + " / " + n + " · " + GO.dogru + " doğru</span></div>" +
    '<p class="evo-soru">' + kacir(q.soru) + "</p>" +
    '<div class="evo-secenekler">' + q.secenekler.map(function (s, j) {
      const sinif = cevaplandi ? (s === q.dogru ? " dogru" : (j === GO.secim ? " yanlis" : "")) : "";
      return '<button class="evo-secenek' + sinif + '" data-go-sec="' + j + '"' + (cevaplandi ? " disabled" : "") + ">" + kacir(s) + "</button>";
    }).join("") + "</div>" +
    (cevaplandi ? '<div class="oyun-sira"><button class="dugme" data-go-sonraki>' + (GO.i + 1 < n ? "Sonraki" : "Bitir") + "</button></div>" : "") +
    '<div class="oyun-sira"><button class="dugme dugme-sade" data-go-kapat>Bırak</button></div></div>';
}

/** Bir evrenin günlük oyun kartları (Tömye dışındakiler: Claude'un Evreni) */
function goKartlarHtml(evren) {
  return GO_OYUNLAR.filter(function (o) { return o.evren === evren; }).map(function (o) {
    const alindi = oyunXpAlindi(evren + "|" + o.id);
    return '<div class="yaris-kart evo-kart go-kart" data-go-kart="' + o.id + '"><h4>' + kacir(o.ad) + (alindi ? " · bugün ✓" : "") + "</h4>" +
      '<p class="oyun-not">' + kacir(o.ozet) + "</p>" +
      '<div class="yaris-kart-alt"><span></span><button class="dugme" data-go-basla="' + o.id + '" data-go-evren="' + evren + '">Başla</button></div></div>';
  }).join("");
}

function goEvrenCiz(evren) {
  if (evren === "tomye") { gunlukOyunlarCiz(); return; }
  const alan = document.querySelector(GO_ALANLAR[evren] || "#yok");
  if (!alan) { return; }
  if (GO && GO.evren === evren) { alan.innerHTML = goOyunHtml(); return; }
  alan.innerHTML = '<p class="oyun-not go-durum">' + kacir(oyunXpDurumMetni()) + "</p>" + goKartlarHtml(evren);
}

function gunlukOyunlarCiz() {
  const alan = document.querySelector("#gunlukOyunAlan");
  if (!alan) { return; }
  if (GO && GO.evren === "tomye") { alan.innerHTML = goOyunHtml(); } else { alan.innerHTML = gunlukOyunKartlari(); }
  try { haviCiz(); } catch (e) { console.error("[TentiforApp] Harita Avı:", e); }
  try { haftaBulmacaCiz(); } catch (e) { console.error("[TentiforApp] bulmaca:", e); }
}

function gunlukOyunKartlari() {
  return '<p class="oyun-giris">Her gün yeni sorular. Kazandığın her oyun günde bir kez ' + OYUN_XP + " XP verir; " +
      "başka evrenlerin oyunları da aynı havuzdan sayılır.</p>" +
    '<p class="oyun-not go-durum">' + kacir(oyunXpDurumMetni()) + "</p>" +
    GO_OYUNLAR.filter(function (o) { return o.evren === "tomye"; }).map(function (o) {
      const acik = goAcikMi(o);
      const alindi = oyunXpAlindi("tomye|" + o.id);
      return '<div class="yaris-kart evo-kart go-kart" data-go-kart="' + o.id + '"><h4>' + kacir(o.ad) + (alindi ? " · bugün ✓" : "") + "</h4>" +
        '<p class="oyun-not">' + kacir(acik ? o.ozet : "Başlangıç koduyla açılan içerikten kurulur.") + "</p>" +
        '<div class="yaris-kart-alt"><span></span>' + (acik ? '<button class="dugme" data-go-basla="' + o.id + '" data-go-evren="tomye">Başla</button>'
          : '<a class="dugme dugme-sade" href="#/basla">Kodu al</a>') + "</div></div>";
    }).join("") +
    '<div class="yaris-kart evo-kart go-kart"><h4>Günün kelimesi · kolay' + (oyunXpAlindi("tomye|kelime") ? " · bugün ✓" : "") + "</h4>" +
      '<p class="oyun-not">Bir karakterin ya da yerin adı; 6 hak. Çözünce ' + OYUN_XP + " XP.</p>" +
      '<div class="yaris-kart-alt"><span></span><a class="dugme" href="#/yarislar">Oyna</a></div></div>';
}

function goBitir() {
  const o = goTanim(GO.evren, GO.id);
  if (GO.dogru < o.esik) { GO.mesaj = ""; return; }
  const xp = oyunXpVer(o.evren + "|" + o.id);
  GO.mesaj = xp ? "+" + xp + " XP." : (oyunXpAlindi(o.evren + "|" + o.id) ? "Bugünün XP'sini aldın; yarın yeni sorular." : "Bugünkü oyun XP'si doldu.");
  if (typeof olaySay === "function") { olaySay("gunluk_oyun:" + o.evren + ":" + o.id); }
}

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-go-basla], [data-go-sec], [data-go-sonraki], [data-go-kapat]");
  if (!h) { return; }
  const d = h.dataset;
  let evren = GO ? GO.evren : "tomye";
  if (d.goBasla) {
    const o = goTanim(d.goEvren || "tomye", d.goBasla);
    if (!o || !goAcikMi(o)) { return; }
    evren = o.evren;
    GO = { id: o.id, evren: o.evren, i: 0, dogru: 0, secim: null, sorular: goSorular(o.id, o.evren) };
  } else if (h.hasAttribute("data-go-kapat")) {
    GO = null;
  } else if (d.goSec !== undefined && GO && GO.secim === null) {
    GO.secim = Number(d.goSec);
    const q = GO.sorular[GO.i];
    if (q.secenekler[GO.secim] === q.dogru) { GO.dogru++; }
  } else if (h.hasAttribute("data-go-sonraki") && GO) {
    GO.i++; GO.secim = null;
    if (GO.i >= GO.sorular.length) { goBitir(); }
  }
  goEvrenCiz(evren);
});

/* sekmeye geçince güncel durum */
document.addEventListener("click", function (ev) {
  if (ev.target.closest('[data-oyun-sekme="gunluk"]')) { gunlukOyunlarCiz(); }
});

/* günün kelimesi (kolay) çözülünce XP */
if (typeof gkKolayOyunu === "function") {
  const eskiGkKolay = gkKolayOyunu;
  window.gkKolayOyunu = function () {
    const o = eskiGkKolay.apply(this, arguments);
    const eskiBitince = o.bitince;
    o.bitince = function (cozuldu) {
      if (typeof eskiBitince === "function") { eskiBitince.apply(this, arguments); }
      if (cozuldu) { oyunXpVer("tomye|kelime"); }
    };
    return o;
  };
}

document.addEventListener("DOMContentLoaded", function () { gunlukOyunlarCiz(); });

/* ==================== Google ile girenlere: kullanıcı adı seç ====================
   Google hesabıyla açılan hesapta kullanıcı adı yok; kullanıcı adı olmadan liderlik ve seviye listesinde görünmez. */

function kadiUyarisiCiz() {
  const eksik = typeof hesapKullanici !== "undefined" && hesapKullanici && typeof hesapProfil !== "undefined" && hesapProfil && !hesapProfil.kullanici_adi;
  let el = document.querySelector("#kadiUyari");
  if (!eksik) { if (el) { el.remove(); } return; }
  if (el) { return; }
  el = document.createElement("div");
  el.id = "kadiUyari";
  el.className = "kadi-uyari";
  el.setAttribute("role", "status");
  el.innerHTML = "<span>Hesabın hazır. Liderlikte ve seviye listesinde görünmek için bir <b>kullanıcı adı</b> seç.</span>" +
    '<a class="dugme" href="#/hesap" data-kadi-sec>Kullanıcı adı seç</a>';
  document.body.appendChild(el);
}

if (typeof hesapProfilKaydet === "function") {
  const eskiProfilKaydet = hesapProfilKaydet;
  window.hesapProfilKaydet = async function () {
    const r = await eskiProfilKaydet.apply(this, arguments);
    kadiUyarisiCiz();
    return r;
  };
}
document.addEventListener("click", function (ev) {
  if (!ev.target.closest("[data-kadi-sec]")) { return; }
  setTimeout(function () { const i = document.querySelector("#hpKadi"); if (i) { i.focus(); i.scrollIntoView({ block: "center" }); } }, 300);
});

/* ==================== bağlantıyla açılan bölüm yerinde kalsın ====================
   /gizlilik/ gibi bir bölüm adresiyle gelince üstteki bölümler sonradan çizilip sayfayı itebiliyor;
   ziyaretçi kendisi kaydırmadıysa bölüme yeniden hizalanır. Sayfa adresleri (/arsiv/) hizalanmaz. */
(function () {
  let dokundu = false;
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (o) {
    window.addEventListener(o, function () { dokundu = true; }, { passive: true, once: true });
  });
  const hizala = function () {
    if (dokundu || typeof rota !== "function") { return; }
    const p = rota().replace(/^#\//, "").split("/");
    if (p.length !== 1 || !p[0]) { return; }
    /* /arsiv/, /oyunlar/ sayfa adresidir (aynı adlı bölüm de var): sayfa başında kalsın */
    if (typeof sayfaVarMi === "function" && sayfaVarMi(p[0])) { return; }
    const el = document.getElementById(p[0]);
    if (!el || !el.classList.contains("bolum") || el.offsetParent === null) { return; }
    if (Math.abs(el.getBoundingClientRect().top) > 40) { el.scrollIntoView({ block: "start" }); }
  };
  window.addEventListener("load", function () { setTimeout(hizala, 1200); setTimeout(hizala, 2600); });
})();
