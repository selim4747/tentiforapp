/* Sürüm 2.5 — kutuların bağları ve kutu rozetleri.

   Bütün evrenlerde her okunabilir kutu (karakter kaydı, mektup, günlük, alıntı, zaman adımı, evren maddesi; Claude'un
   Evreni'nin maddeleri, kişileri, hikâyeleri, mektupları, roman bölümleri; kanon ve fan evrenlerinin bilgi grupları ve
   roman bölümleri) aynı evrendeki başka kutulara bağlanır:
     - açık bağ: mektubun yazanı/alanı, günlüğün ve alıntının sahibi, hikâyenin kişileri, Claude evrenindeki kişi bağları;
     - ad bağı: bir kutunun metni öbür kutunun adını (karakter, evren maddesi başlığı, kişi, yer, terim…) anıyorsa.
   Rozet: kutuyu ve bağlı olduğu bütün kutuları süresi dolana kadar okuyunca gümüş; konusuna (kutunun ya da bağlı
   kutularının adına) en az 300 harflik bir fan hikâyesi de yazınca altın. Karakter rozetleri aynı kuralla genişledi:
   artık evren maddeleri de sayılır. Gizli karakterler (kart: false) hiçbir yerde bağ olarak görünmez. */

const RB = { ag: null, iz: "" };
const RB_ODUL = { gumus: 5, altin: 15 };

function rbKac(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function rbDesen(adlar) {
  const l = (adlar || []).map(function (a) { return String(a || "").trim(); }).filter(function (a) { return a.length >= 3 && a.length <= 40; });
  if (!l.length) { return null; }
  return new RegExp("(^|[^0-9A-Za-zÇĞİÖŞÜçğıöşü])(" + l.map(rbKac).join("|") + ")(?=$|[^0-9A-Za-zÇĞİÖŞÜçğıöşü])", "i");
}
function rbKelime(t) { return String(t || "").split(/\s+/).filter(Boolean).length; }

/* Düzenli ifadenin "i" bayrağıyla aynı büyük/küçük harf eşlemesi (ı ile I, İ ile i eşleşmez) */
function rbKatla(t) {
  let o = "";
  for (let i = 0; i < t.length; i++) {
    const c = t[i], u = c.toUpperCase();
    o += (u.length !== 1 || (c.charCodeAt(0) >= 128 && u.charCodeAt(0) < 128)) ? c : u;
  }
  return o;
}
const RB_HARF = "0-9A-Za-zÇĞİÖŞÜçğıöşü";

/** Bir alanın ad bağları: [a, b] çiftleri — a'nın metni b'nin adlarından birini anıyor (rbDesen'le aynı kural). */
function rbAdBaglari(l) {
  const adlar = new Map();   /* katlanmış ad → { ad, kutular: [anahtar] } */
  l.forEach(function (b) {
    if (!b.desen) { return; }
    (b.adlar || []).map(function (a) { return String(a || "").trim(); }).filter(function (a) { return a.length >= 3 && a.length <= 40; }).forEach(function (a) {
      const k = rbKatla(a);
      if (!adlar.has(k)) { adlar.set(k, { ad: a, kutular: [] }); }
      if (adlar.get(k).kutular.indexOf(b.anahtar) === -1) { adlar.get(k).kutular.push(b.anahtar); }
    });
  });
  if (!adlar.size) { return []; }
  const liste = Array.from(adlar.values());
  const sonra = "(?=$|[^" + RB_HARF + "])";
  const tum = new RegExp("(?<![" + RB_HARF + "])(?:" + liste.map(function (x) { return rbKac(x.ad); }).join("|") + ")" + sonra, "gi");
  /* aynı yerde başlayan başka adlar da (kısa/uzun) sayılsın: ilk harfe göre kovalar */
  const kova = new Map();
  liste.forEach(function (x) {
    const h = rbKatla(x.ad[0]);
    if (!kova.has(h)) { kova.set(h, []); }
    kova.get(h).push(x);
  });
  const cift = [];
  l.forEach(function (a) {
    const t = String(a.metin == null ? "" : a.metin);
    const bulunan = new Set();
    tum.lastIndex = 0;
    let m;
    while ((m = tum.exec(t))) {
      (kova.get(rbKatla(t[m.index])) || []).forEach(function (x) {
        if (!x.ys) { x.ys = new RegExp(rbKac(x.ad) + sonra, "iy"); }
        x.ys.lastIndex = m.index;
        if (x.ys.test(t)) { bulunan.add(x); }
      });
      tum.lastIndex = m.index + 1;
    }
    bulunan.forEach(function (x) { x.kutular.forEach(function (b) { if (b !== a.anahtar) { cift.push([a.anahtar, b]); } }); });
  });
  return cift;
}

/** Gizli (kartsız) karakterlerin adları: bağlarda ve eşleşmede hiç kullanılmaz. */
function rbGizliAdlar() {
  const l = [];
  (veri.karakterler || []).filter(function (k) { return k.kart === false; }).forEach(function (k) {
    (typeof karakterAdlari === "function" ? karakterAdlari(k) : [k.ad]).forEach(function (a) { l.push(String(a || "").toLocaleLowerCase("tr")); });
  });
  return l;
}

/** Bütün kutular: anahtar → { anahtar, alan, ad, adlar, metin, acik: [bağlanacak ad], git, gizli } */
function rbKutular() {
  const l = [];
  const ekle = function (o) { if (o.anahtar) { l.push(o); } };
  const gizliAd = rbGizliAdlar();
  const gizliMi = function (ad) { return gizliAd.indexOf(String(ad || "").toLocaleLowerCase("tr")) !== -1; };

  /* Tömye (başlangıç evreni) */
  (veri.karakterler || []).forEach(function (k) {
    if (!k.id || k.kart === false) { return; }
    ekle({ anahtar: "kar:" + k.id, alan: "tomye", ad: "Kaydı: " + k.ad, adlar: typeof karakterAdlari === "function" ? karakterAdlari(k) : [k.ad], metin: (k.ozet || "") + " " + (k.detay || ""), git: "#/karakter/" + k.id, gizli: k.gizli });
  });
  (veri.mektuplar || []).forEach(function (m, i) {
    if (gizliMi(m.kimden) || gizliMi(m.kime)) { return; }
    ekle({ anahtar: "mektup:" + (m.id || i), alan: "tomye", ad: "Mektup: " + m.kimden + " → " + m.kime, adlar: [], metin: (m.not || "") + " " + (m.metin || ""), acik: [m.kimden, m.kime], git: "#mektuplar", gizli: m.gizli });
  });
  (veri.gunlukler || []).forEach(function (g, i) {
    if (gizliMi(g.kim)) { return; }
    ekle({ anahtar: "gunluk:" + i, alan: "tomye", ad: "Günlük: " + (g.tarih || i + 1), adlar: [], metin: g.metin || "", acik: [g.kim], git: "#gunluk", gizli: g.gizli });
  });
  (veri.alintilar || []).forEach(function (a, i) {
    if (gizliMi(a.kim)) { return; }
    ekle({ anahtar: "alinti:" + i, alan: "tomye", ad: "Alıntı: “" + String(a.metin || "").slice(0, 30) + "…”", adlar: [], metin: a.metin || "", acik: [a.kim], git: "#alintilar", gizli: a.gizli });
  });
  (veri.zamanCizelgesi || []).forEach(function (z, i) {
    ekle({ anahtar: "zaman:" + (z.no || i), alan: "tomye", ad: "Zaman: " + (z.baslik || ""), adlar: [], metin: (z.baslik || "") + " " + (z.metin || ""), git: "#zaman", gizli: z.gizli });
  });
  (veri.evren || []).forEach(function (m) {
    if (!m.id) { return; }
    ekle({ anahtar: "evren:" + m.id, alan: "tomye", ad: "Evren: " + (m.baslik || m.id), adlar: [m.baslik], metin: (m.ozet || "") + " " + (m.metin || ""), git: "#/evren", gizli: m.gizli });
  });

  /* Claude'un Evreni */
  const c = veri.claudeEvreni || {};
  (c.maddeler || []).forEach(function (m) { ekle({ anahtar: "madde:ce-" + m.id, alan: "claude", ad: "Madde: " + (m.baslik || ""), adlar: [m.baslik], metin: (m.ozet || "") + " " + (m.metin || ""), git: "#/claude" }); });
  (c.kisiler || []).forEach(function (k) { ekle({ anahtar: "madde:ce-" + k.id, alan: "claude", ad: "Kişi: " + k.ad, adlar: [k.ad], metin: (k.ozet || "") + " " + (k.detay || ""), git: "#/claude", kisiId: k.id }); });
  (c.hikayeler || []).forEach(function (h) {
    const kisiler = Array.isArray(h.karakterler) ? h.karakterler : String(h.karakterler || "").split(",");
    ekle({ anahtar: "madde:ce-" + h.id, alan: "claude", ad: "Hikâye: " + (h.baslik || ""), adlar: [h.baslik], metin: h.metin || "", acik: kisiler, git: "#/claude" });
  });
  (c.mektuplar || []).forEach(function (m) { ekle({ anahtar: "madde:ce-" + m.id, alan: "claude", ad: "Mektup: " + m.kimden + " → " + m.kime, adlar: [], metin: (m.not || "") + " " + (m.metin || ""), acik: [m.kimden, m.kime], git: "#/claude" }); });
  ((c.roman || {}).bolumler || []).forEach(function (b, i) {
    if (!b || b.id === undefined) { return; }
    ekle({ anahtar: "madde:ce-roman-" + b.id, alan: "claude", ad: "Roman: " + (b.baslik || "Bölüm " + (i + 1)), adlar: [], metin: b.metin || "", git: "#/claude" });
  });

  /* kanon evren sayfaları (E25, E26) ve sitedeki fan evrenleri: bilgi grupları ve roman bölümleri */
  const evrenKutulari = function (kaynak, id, e) {
    if (!e) { return; }
    const on = "ev:" + kaynak + ":" + id + ":";
    const git = "#/ev/" + kaynak + "/" + id;
    const gruplar = typeof FAN_EVREN_GRUPLARI !== "undefined" ? FAN_EVREN_GRUPLARI : [];
    gruplar.forEach(function (g) {
      const ogeler = Array.isArray(e[g.k]) ? e[g.k] : [];
      const metin = ogeler.map(function (x) { return Object.keys(x || {}).map(function (a) { return typeof x[a] === "string" ? x[a] : ""; }).join(" "); }).join(" ");
      if (rbKelime(metin) < 30) { return; }
      const adlar = ogeler.map(function (x) { return x && (x.ad || x.terim || x.baslik); }).filter(Boolean);
      ekle({ anahtar: on + g.k, alan: on, ad: (e.ad || id) + " · " + g.ad, adlar: adlar, metin: metin, git: git });
    });
    ((e.roman || {}).bolumler || []).forEach(function (b, i) {
      if (!b || !b.id || rbKelime(b.metin) < 30) { return; }
      ekle({ anahtar: on + "roman:" + b.id, alan: on, ad: (e.ad || id) + " · " + (b.baslik ? (i + 1) + ". " + b.baslik : "Bölüm " + (i + 1)), adlar: [], metin: b.metin || "", git: git });
    });
  };
  Object.keys(veri.kanonEvrenleri || {}).forEach(function (id) { evrenKutulari("site", id, veri.kanonEvrenleri[id]); });
  ((veri.fanEserleri || {}).evrenler || []).forEach(function (oz) {
    const tam = typeof EVD_BELLEK !== "undefined" && EVD_BELLEK[oz.id] ? EVD_BELLEK[oz.id] : (oz.dosya ? null : oz);
    evrenKutulari("fan", oz.id, tam);
  });
  return l;
}

/** Bağ ağı: anahtar → { kutu, baglar: Set(anahtar) }. Aynı evrenin kutuları arasında; veri değişince yeniden kurulur. */
function rbAg() {
  const fanIz = ((veri.fanEserleri || {}).evrenler || []).map(function (e) { return e.id + (typeof EVD_BELLEK !== "undefined" && EVD_BELLEK[e.id] ? "+" : ""); }).join(",");
  const iz = (veri.surum || "") + "|" + fanIz + "|" + (veri.evren || []).length + "|" + (veri.karakterler || []).length;
  if (RB.ag && RB.iz === iz && RB.veri === veri) { return RB.ag; }
  const kutular = rbKutular();
  const ag = new Map();
  kutular.forEach(function (k) { k.desen = rbDesen(k.adlar); ag.set(k.anahtar, { kutu: k, baglar: new Set() }); });
  const bagla = function (a, b) { if (a !== b && ag.has(a) && ag.has(b)) { ag.get(a).baglar.add(b); ag.get(b).baglar.add(a); } };
  const alanlar = {};
  kutular.forEach(function (k) { (alanlar[k.alan] = alanlar[k.alan] || []).push(k); });
  Object.keys(alanlar).forEach(function (alan) {
    const l = alanlar[alan];
    l.forEach(function (a) {
      /* açık bağlar: adı geçen kişinin kutusu */
      (a.acik || []).forEach(function (ad) {
        const hedef = String(ad || "").trim().toLocaleLowerCase("tr");
        if (!hedef) { return; }
        l.forEach(function (b) { if ((b.adlar || []).some(function (x) { return String(x || "").toLocaleLowerCase("tr") === hedef; })) { bagla(a.anahtar, b.anahtar); } });
      });
    });
    /* ad bağları: her kutunun metni bir kez taranır (eskiden her kutu çifti için ayrı düzenli ifade: açılışta en ağır iş) */
    rbAdBaglari(l).forEach(function (c) { bagla(c[0], c[1]); });
  });
  /* Claude'un Evreni: kişiler arası bağlar */
  ((veri.claudeEvreni || {}).baglar || []).forEach(function (x) { bagla("madde:ce-" + x.a, "madde:ce-" + x.b); });
  RB.ag = ag; RB.iz = iz; RB.veri = veri;
  return ag;
}

/** Okur bu kutuyu görebilir mi (buz altındakiler, gizli karakterler sayılmaz). */
function rbErisir(k) {
  if (!k) { return false; }
  if (typeof okuErisim === "function" && k.gizli && !okuErisim(null, k.gizli)) { return false; }
  return true;
}

/** Kutunun bağlı kutuları (görebildiklerin). */
function rbBaglar(anahtar) {
  const ag = rbAg();
  const d = ag.get(anahtar);
  if (!d) { return []; }
  return Array.from(d.baglar).map(function (a) { return ag.get(a).kutu; }).filter(rbErisir);
}

/** Kutunun konusu: adları; adsız kutuda (mektup, zaman…) bağlı kutularının adları. */
function rbKonu(anahtar) {
  const ag = rbAg();
  const d = ag.get(anahtar);
  if (!d) { return []; }
  const k = d.kutu;
  const kendi = (k.adlar || []).filter(Boolean);
  if (kendi.length) { return kendi; }
  const l = [];
  rbBaglar(anahtar).forEach(function (b) { (b.adlar || []).forEach(function (a) { if (a && l.indexOf(a) === -1) { l.push(a); } }); });
  return l;
}

function rbFanHikayesi(adlar) {
  if (!adlar.length || typeof fanEserlerim !== "function") { return null; }
  const d = rbDesen(adlar);
  if (!d) { return null; }
  return fanEserlerim().find(function (e) {
    return e.tur === "hikaye" && String(e.metin || "").length >= 300 && (d.test(e.metin) || d.test(e.karakterler || "") || d.test(e.baslik || ""));
  }) || null;
}

function rbDurum(anahtar) {
  if (typeof kilitAcik !== "function") { return ""; }
  return kilitAcik("rozetk_altin:" + anahtar) ? "altin" : (kilitAcik("rozetk:" + anahtar) ? "gumus" : "");
}

function rbIlerleme(anahtar) {
  const l = [anahtar].concat(rbBaglar(anahtar).map(function (b) { return b.anahtar; }));
  return { l: l, okunan: l.filter(function (a) { return okunduMu(a); }) };
}

/** Kutu rozetlerini verir (karakter kutuları hariç: onların karakter rozeti var). */
function rbRozetleriDenetle() {
  if (typeof cuzdan === "undefined" || typeof kilitAcik !== "function") { return; }
  const ag = rbAg();
  const haber = [];
  let ecka = 0;
  ag.forEach(function (d, anahtar) {
    if (/^kar:/.test(anahtar) || !rbErisir(d.kutu) || !okunduMu(anahtar)) { return; }
    const baglar = rbBaglar(anahtar);
    if (!baglar.length) { return; }
    if (!baglar.every(function (b) { return okunduMu(b.anahtar); })) { return; }
    if (!kilitAcik("rozetk:" + anahtar)) { cuzdan.acilan.push("rozetk:" + anahtar); ecka += RB_ODUL.gumus; haber.push("Kutu rozeti: " + d.kutu.ad); }
    if (!kilitAcik("rozetk_altin:" + anahtar) && rbFanHikayesi(rbKonu(anahtar))) { cuzdan.acilan.push("rozetk_altin:" + anahtar); ecka += RB_ODUL.altin; haber.push("Altın kutu rozeti: " + d.kutu.ad); }
  });
  if (!haber.length) { return; }
  const ozet = haber.length > 2 ? haber.length + " kutu rozeti" : haber.join(" · ");
  if (typeof eckaKazan === "function") { eckaKazan(ecka, ozet); } else if (typeof cuzdanKaydet === "function") { cuzdanKaydet(); }
  if (typeof eckaBildir === "function") { eckaBildir(ozet + " (+" + ecka + " eçka)"); }
  rbSeritleriTazele();
}

/* ---------- kutunun altında: bağlı kutular ve rozet durumu ---------- */

function rbSeritHtml(anahtar) {
  const baglar = rbBaglar(anahtar);
  if (!baglar.length) { return ""; }
  const o = rbIlerleme(anahtar);
  const r = rbDurum(anahtar);
  const hikaye = r === "gumus" && !rbFanHikayesi(rbKonu(anahtar));
  const konu = rbKonu(anahtar).slice(0, 3).join(", ");
  return '<details class="rb-serit" data-rb="' + kacir(anahtar) + '"><summary>' + (r === "altin" ? "🥇 " : (r === "gumus" ? "🥈 " : "🔗 ")) +
    baglar.length + " bağlı kutu · " + o.okunan.length + " / " + o.l.length + " okundu</summary>" +
    '<ul class="rozet-liste">' + baglar.map(function (b) {
      const ok = okunduMu(b.anahtar);
      return '<li class="' + (ok ? "okundu" : "") + '">' + (ok ? "✓ " : "○ ") + (b.git ? '<a href="' + kacir(b.git) + '">' + kacir(b.ad) + "</a>" : kacir(b.ad)) + "</li>";
    }).join("") + "</ul>" +
    '<p class="oyun-not">' + (r === "altin" ? "Altın rozetin var." : (r === "gumus" ? (hikaye && konu ? "Altın için " + kacir(konu) + " hakkında bir fan hikâyesi yaz (en az 300 harf)." : "Gümüş rozetin var.")
      : "Bu kutuyu ve bağlı her kutuyu sonuna kadar okuyunca rozet; konusuna bir fan hikâyesi de yazınca altın.")) + "</p></details>";
}

function rbSeritleriEkle() {
  if (typeof veri === "undefined" || !veri) { return; }
  let ag;
  try { ag = rbAg(); } catch (_) { return; }
  document.querySelectorAll("[data-oku]:not([data-rb-bakildi])").forEach(function (el) {
    el.setAttribute("data-rb-bakildi", "1");
    const a = el.getAttribute("data-oku");
    if (/^kar:/.test(a) || !ag.has(a)) { return; }
    const h = rbSeritHtml(a);
    if (!h) { return; }
    /* okuma süresi şeridin yazısını saymasın */
    if (!el.hasAttribute("data-oku-kelime")) { el.setAttribute("data-oku-kelime", String(kelimeSay(el.innerText || el.textContent))); }
    el.insertAdjacentHTML("beforeend", h);
  });
}

function rbSeritleriTazele() {
  document.querySelectorAll(".rb-serit[data-rb]").forEach(function (s) {
    const h = rbSeritHtml(s.getAttribute("data-rb"));
    if (!h) { s.remove(); return; }
    const acik = s.open;
    s.outerHTML = h;
    if (acik) { const y = document.querySelector('.rb-serit[data-rb="' + (window.CSS && CSS.escape ? CSS.escape(s.getAttribute("data-rb")) : s.getAttribute("data-rb")) + '"]'); if (y) { y.open = true; } }
  });
}

/* 3.0: bağ ağı ilk kez kurulurken ağır; şeritler tarayıcı boşalınca eklenir */
let rbBoslukSira = 0;
function rbSeritleriZamanla() {
  if (rbBoslukSira) { return; }
  rbBoslukSira = (window.requestIdleCallback || setTimeout)(function () { rbBoslukSira = 0; try { rbSeritleriEkle(); } catch (_) { /* yok */ } }, { timeout: 1200 });
}

