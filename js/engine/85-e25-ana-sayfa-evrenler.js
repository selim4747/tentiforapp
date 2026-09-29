/* Sürüm 3.1 — E25 Evrengezerlerin yurdu, evrenler ana sayfada, derin evrenler (hepsi cihazda; sunucuya yük yok).

   E25: Evrengezer doğum sahnesi (hangi kapıdan çıktı, ilk sözü), pasaport (damgalar: gezdiği evrenler), Kapılar Salonu
   (bütün evrenlere kapılar; yeni kurulan her evren bir kapı), iki Evrengezeri bir hikâyede buluşturma, E25 sıralamaları.
   Evren: kişi sayfası (aile, bağlar, belgeler, tarih, hikâyeler), sürüm geçmişinde karşılaştırma, haritada zaman
   (tarih olayına yer bağlanır, kaydırıcıyla çağlar gezilir).
   Site: ana sayfada evrenler, en altta kilitli "Evrenini kur" (seviye 15 ya da tek seferlik evren kodu: evren1),
   panelde kanona aday evrenler. */

/* ==================== 1. tek seferlik evren kurma kodu (evren1) ==================== */

const EVR1_BEKLEYEN = "tf31_evren1_harca";   /* çevrimdışı kurulduysa: bağlanınca harcanır */

function evren1Var() { return typeof tekHakVar === "function" && tekHakVar("evren1"); }

async function evren1Harca() {
  if (typeof tekHesapVar !== "function" || !tekHesapVar()) { try { localStorage.setItem(EVR1_BEKLEYEN, "1"); } catch (_) { /* yok */ } return false; }
  try {
    const r = await hesapIstemci.rpc("tek_kod_harca", { p_tur: "evren1" });
    if (r.error) { throw r.error; }
    try { localStorage.removeItem(EVR1_BEKLEYEN); } catch (_) { /* yok */ }
    return r.data === true;
  } catch (_) { try { localStorage.setItem(EVR1_BEKLEYEN, "1"); } catch (__) { /* yok */ } return false; }
}

/** Seviye ya da kalıcı seviye kodu evren kurmaya yetiyor mu (tek seferlik hak sayılmadan). */
/** Tek seferlik hak harcamadan evren kurulabilir mi: sınırsız (Pro, yönetici, seviye kodu) ya da ücretsiz ilk taslak (studio/editor). */
function evrenTabanAcik() { return tf4EvrenSinirsiz() || tf4EvrenSayisi() < 1; }

function evren1Kullan() {
  TEK.haklar = TEK.haklar.filter(function (h, i, l) { return !(h.tur === "evren1" && l.findIndex(function (x) { return x.tur === "evren1"; }) === i); });
  if (typeof tekHaklariUygula === "function") { tekHaklariUygula(); }
  evren1Harca();
  if (typeof eckaBildir === "function") { eckaBildir("Tek seferlik evren kurma hakkın kullanıldı: bu evren senin."); }
}

function evrenSayisi() { return fanEserlerim().filter(function (x) { return x.tur === "evren" && !x.e99; }).length; }

/* evren kopyalamak da yeni evren kurmaktır: kapıdan geçer, gerekirse tek seferlik hakkı harcar */
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest('[data-evs-kopyala], [data-fan-p="kopyala"]');
  if (!b) { return; }
  const evren = b.hasAttribute("data-evs-kopyala") || (typeof fanAcik !== "undefined" && fanAcik && fanAcik.eser && fanAcik.eser.tur === "evren");
  if (!evren || evrenTabanAcik()) { return; }
  if (!evren1Var()) {
    ev.stopImmediatePropagation(); ev.preventDefault();
    if (typeof seviyeUyari === "function") { seviyeUyari("evren"); }
    return;
  }
  const once = evrenSayisi();
  setTimeout(function () { if (evrenSayisi() > once && evren1Var()) { evren1Kullan(); } }, 0);
}, true);

/* ==================== 2. ana sayfa: evrenler ==================== */

function anaEvrenlerCiz() {
  const alan = document.querySelector("#anaEvrenler");
  if (!alan || typeof veri === "undefined" || !veri || typeof evrenSeciciListesi !== "function") { return; }
  const l = evrenSeciciListesi();
  const kart = function (x, sinif) {
    return '<button type="button" class="ana-evren' + (sinif ? " " + sinif : "") + (x.kilitli ? " kilitli" : "") + '" data-evren-git="' + kacir(x.git) + '">' +
      '<b class="ana-evren-ad">' + (x.kilitli ? '<span aria-hidden="true">🔒 </span>' : "") + kacir(x.ad) + "</b>" +
      (x.not ? '<span class="ana-evren-not">' + kacir(x.not) + "</span>" : "") + "</button>";
  };
  /* ilk kart (Tentiforverse · 24. Evren) sayfada zaten büyük kart olarak duruyor */
  const site = l.site.filter(function (x) { return x.git !== "#/arsiv" && x.git !== "#/claude"; });
  /* test evrenleri: Claude'un Evreni ve sitenin örnek fan evrenleri (kanon değil) */
  const test = l.site.filter(function (x) { return x.git === "#/claude"; }).concat(l.fan.filter(function (x) { return /^test/.test(x.not || ""); }));
  const fan = l.fan.filter(function (x) { return !/^test/.test(x.not || ""); });
  const acik = uretimAcik("evren"), pro = tf4ProMu();
  alan.innerHTML =
    (site.length ? '<div class="ana-evren-grup"><span class="ana-etiket">Kanon evrenler</span><div class="ana-evren-liste">' + site.map(function (x) { return kart(x, "kanon"); }).join("") + "</div></div>" : "") +
    (fan.length ? '<div class="ana-evren-grup"><span class="ana-etiket">Okurların evrenleri</span><div class="ana-evren-liste">' + fan.map(function (x) { return kart(x, "fan"); }).join("") + "</div></div>" : "") +
    (test.length ? '<div class="ana-evren-grup"><span class="ana-etiket">Test evrenleri · özellikleri gör ve dene</span><div class="ana-evren-liste">' + test.map(function (x) { return kart(x, "test"); }).join("") + "</div></div>" : "") +
    (l.benim.length ? '<div class="ana-evren-grup"><span class="ana-etiket">Senin evrenlerin</span><div class="ana-evren-liste">' + l.benim.map(function (x) { return kart(x, "benim"); }).join("") + "</div></div>" : "") +
    /* bütün evrenler: ara, süz, sırala (açılınca çizilir) */
    '<details class="kesif-daha tev-kutu" id="tumEvrenlerKutu"><summary><span class="kesif-daha-ad">Tüm evrenler</span><span class="kesif-daha-not">ara · süz · sırala · yıldızla</span></summary><div class="kesif-daha-ic" id="tumEvrenler"></div></details>' +
    /* evren kurma: ücretsiz 1 taslak, Pro sınırsız, tek seferlik kod */
    '<div class="ana-kur' + (acik ? "" : " kilitli") + '">' + (acik
      ? '<b>Evrenini kur</b><span class="ana-evren-not">' + (pro ? "Yaratıcı Pro: sınırsız evren." : (tf4EvrenSayisi() < 1 ? "Ücretsiz: ilk evren taslağın hazır seni bekliyor." : "Tek seferlik hakkınla bir evren daha.")) +
          ' Tömye kadar derin bir evren: adım adım Kurucu.</span><button type="button" class="dugme" data-es-yeni>+ Yeni evren kur</button>'
      : '<b><span aria-hidden="true">🔒 </span>Evrenini kur</b><span class="ana-evren-not">Ücretsiz plandaki 1 evren taslağını kullandın. Yaratıcı Pro ile sınırsız evren kurarsın; tek seferlik bir evren kodun varsa girişten sonra gir.</span>' +
        '<div class="oyun-sira"><button type="button" class="dugme" data-pro-ac>Pro’ya geç · ' + TF4_PRO_FIYAT + '</button><button type="button" class="dugme dugme-sade" data-kod-ac="1">Kodum var</button></div>') +
    "</div>";
  const d = alan.querySelector("#tumEvrenlerKutu");
  d.addEventListener("toggle", function () { if (d.open) { tumEvrenlerCiz(); } });

  /* her kartın yanında yıldız; yıldızlananlar en üstte */
  alan.querySelectorAll(".ana-evren[data-evren-git]").forEach(function (k) {
    const git = k.getAttribute("data-evren-git");
    const sar = document.createElement("div"); sar.className = "ana-evren-sar";
    k.parentNode.insertBefore(sar, k); sar.appendChild(k);
    const y = yildizliMi(git);
    sar.insertAdjacentHTML("beforeend", '<button type="button" class="ana-yildiz' + (y ? " acik" : "") + '" data-yildiz="' + kacir(git) + '" aria-pressed="' + y + '" aria-label="' +
      kacir((y ? "Yıldızı kaldır: " : "Yıldızla: ") + (k.querySelector(".ana-evren-ad") || k).textContent.replace(/^🔒\s*/, "")) + '">' + (y ? "★" : "☆") + "</button>");
  });
  const yk = yildizlilar().map(function (git) {
    const k = alan.querySelector('.ana-evren-sar > .ana-evren[data-evren-git="' + CSS.escape(git) + '"]');
    return k ? k.parentNode.outerHTML : "";
  }).filter(Boolean);
  if (yk.length) {
    alan.insertAdjacentHTML("afterbegin", '<div class="ana-evren-grup ana-yildizli"><span class="ana-etiket">★ Yıldızladıkların</span><div class="ana-evren-liste">' + yk.join("") + "</div></div>");
  }
}

document.addEventListener("tf-veri-hazir", function () { setTimeout(anaEvrenlerCiz, 0); });
window.addEventListener("hashchange", function () { if (typeof aktifSayfa !== "undefined" && aktifSayfa === "arsiv") { anaEvrenlerCiz(); } });
/* ==================== 3. E25: doğum, pasaport, Kapılar Salonu, eşleştirme, sıralamalar ==================== */

let evrDogumSon = null;   /* az önce doğan Evrengezer: sahne gösterilir */

/** E25'in kapıları: bütün evrenler (kanon, okurların, senin). Yeni kurulan her evren bir kapı. */
function e25Kapilar() {
  const l = typeof evrenSeciciListesi === "function" ? evrenSeciciListesi() : { site: [], fan: [], benim: [] };
  const kapilar = [];
  l.site.forEach(function (x) { if (!/^#\/ev\/site\/e25$/.test(x.git)) { kapilar.push({ ad: x.ad.replace(" · 24. Evren", ""), git: x.git, tur: x.git === "#/claude" ? "test" : "kanon", kilitli: x.kilitli }); } });
  l.fan.forEach(function (x) { kapilar.push({ ad: x.ad, git: x.git, tur: /^kanon/.test(x.not || "") ? "kanon" : (/^test/.test(x.not || "") ? "test" : "fan") }); });
  l.benim.forEach(function (x) { kapilar.push({ ad: x.ad, git: x.git, tur: "benim" }); });
  return kapilar;
}

/** Evrengezerin damgaları: konuk olduğu eserlerin evrenleri. */
function e25Damgalar(kisiId) {
  const l = [];
  (typeof evrKonukHavuzu === "function" ? evrKonukHavuzu() : []).forEach(function (x) {
    if (!x.k || x.k.id !== kisiId) { return; }
    const ad = x.eser.tur === "evren" ? x.eser.ad : x.eser.evren;
    if (!ad || l.some(function (d) { return evaAd(d.ad) === evaAd(ad); })) { return; }
    l.push({ ad: ad, tur: typeof evaStatu === "function" ? evaStatu(ad).tur : "serbest" });
  });
  return l;
}

function e25DamgaHtml(d) {
  const bas = String(d.ad || "?").replace(/[^A-Za-zÇĞİÖŞÜçğıöşü0-9]/g, "").slice(0, 2).toLocaleUpperCase("tr") || "?";
  return '<span class="e25-damga ' + kacir(d.tur) + '" title="' + kacir(d.ad) + '"><b>' + kacir(bas) + "</b><small>" + kacir(evrKisa(d.ad, 12)) + "</small></span>";
}

function e25Siralama() {
  const kisiler = typeof e25Kisileri === "function" ? e25Kisileri() : [];
  const havuz = typeof evrKonukHavuzu === "function" ? evrKonukHavuzu() : [];
  const ay = new Date().toISOString().slice(0, 7);
  const l = kisiler.map(function (x) {
    const eserler = {};
    havuz.forEach(function (h) { if (h.k && h.k.id === x.e.id) { eserler[h.eser.tur + ":" + h.eser.id] = true; } });
    const dogum = (x.e.dogum && x.e.dogum.t) || x.e.olusturma || "";
    return { ad: x.e.ad, gez: e25Damgalar(x.e.id).length, hikaye: Object.keys(eserler).length, buAy: String(dogum).slice(0, 7) === ay };
  });
  const ilk = function (a, k) { return a.filter(function (x) { return x[k] > 0; }).sort(function (x, y) { return y[k] - x[k] || x.ad.localeCompare(y.ad, "tr"); }).slice(0, 5); };
  return { gezgin: ilk(l, "gez"), hikaye: ilk(l, "hikaye"), yeni: l.filter(function (x) { return x.buAy; }).slice(0, 8) };
}

function e25SalonHtml() {
  const kapilar = e25Kapilar();
  const havuz = typeof evrKonukHavuzu === "function" ? evrKonukHavuzu() : [];
  const gecen = function (k) {
    /* Tentiforverse kapısı Tömye'ye açılır: hikâyelerde çoğu "Tömye" yazar */
    const adlar = k.git === "#/arsiv" ? ["tentiforverse", "tömye", "24. evren", "e24"] : [evaAd(k.ad)];
    const s = {};
    havuz.forEach(function (h) { const ad = h.eser.tur === "evren" ? h.eser.ad : h.eser.evren; if (adlar.indexOf(evaAd(ad)) !== -1 && h.k) { s[h.k.id] = true; } });
    return Object.keys(s).length;
  };
  const kisiler = typeof e25Kisileri === "function" ? e25Kisileri() : [];
  const sr = e25Siralama();
  const liste = function (l, k, bos) { return l.length ? "<ol>" + l.map(function (x) { return "<li>" + kacir(x.ad) + (k ? ' <span class="oyun-not">· ' + x[k] + "</span>" : "") + "</li>"; }).join("") + "</ol>" : '<p class="oyun-not">' + bos + "</p>"; };
  const secim = function (id, n) { return '<select class="e25-secim" id="' + id + '">' + kisiler.map(function (x, i) { return '<option value="' + kacir(x.kaynak + ":" + x.e.id) + '"' + (i === n ? " selected" : "") + ">" + kacir(x.e.ad) + "</option>"; }).join("") + "</select>"; };
  const kanon = kapilar.filter(function (k) { return k.tur === "kanon" && !k.kilitli; }).map(function (k) { return k.ad; });
  return '<section class="e25-salon" aria-label="Kapılar Salonu"><h3 class="evs-ara-baslik">Kapılar Salonu</h3>' +
      '<p class="oyun-not">E25 Evrengezerlerin doğduğu yer: her kapı bir evrene açılır. Yeni kurulan her evren buraya bir kapı olarak eklenir.</p>' +
      '<div class="e25-kapilar">' + kapilar.map(function (k) {
        const n = gecen(k);
        return '<button type="button" class="e25-kapi ' + kacir(k.tur) + (k.kilitli ? " kilitli" : "") + '" data-evren-git="' + kacir(k.git) + '">' +
          '<span class="e25-kapi-kemer" aria-hidden="true"></span><b>' + (k.kilitli ? "🔒 " : "") + kacir(evrKisa(k.ad, 22)) + "</b>" +
          '<span class="oyun-not">' + (n ? n + " Evrengezer geçti" : ({ kanon: "kanon", fan: "fan-made", benim: "senin evrenin", test: "test evreni" })[k.tur]) + "</span></button>";
      }).join("") + "</div></section>" +
    (kisiler.length >= 2 ? '<section class="e25-bulus" aria-label="İki Evrengezeri buluştur"><h3 class="evs-ara-baslik">Karşılaşma</h3>' +
      '<p class="oyun-not">İki Evrengezer bir hikâyede karşılaşsa? Seç, evrenini seç: ikisi de konuk olarak yeni bir hikâye taslağına girer.</p>' +
      '<div class="e25-bulus-satir"><label class="sr-yalniz" for="e25BulusA">Birinci Evrengezer</label>' + secim("e25BulusA", 0) + "<span>×</span>" +
        '<label class="sr-yalniz" for="e25BulusB">İkinci Evrengezer</label>' + secim("e25BulusB", 1) + "</div>" +
      '<label for="e25BulusEvren">Nerede karşılaşsınlar?</label><select class="e25-secim" id="e25BulusEvren">' +
        kanon.concat((typeof fanEserlerim === "function" ? fanEserlerim() : []).filter(function (x) { return x.tur === "evren" && !x.e99 && x.ad; }).map(function (x) { return x.ad; }))
          .filter(function (x, i, a) { return a.indexOf(x) === i; }).map(function (a) { return '<option value="' + kacir(a) + '">' + kacir(a) + "</option>"; }).join("") + "</select>" +
      '<div class="oyun-sira"><button type="button" class="dugme" data-e25-bulus>Karşılaştır ve yazmaya başla</button></div><p class="pencere-durum" id="e25BulusDurum" role="status"></p></section>' : "") +
    '<section class="e25-sira" aria-label="E25 sıralamaları"><h3 class="evs-ara-baslik">E25 sıralamaları</h3><div class="e25-sira-kutular">' +
      '<div><b>En çok gezen</b>' + liste(sr.gezgin, "gez", "Henüz kimse başka bir evrene gitmedi.") + "</div>" +
      '<div><b>En çok hikâyede</b>' + liste(sr.hikaye, "hikaye", "Henüz hikâye yok.") + "</div>" +
      '<div><b>Bu ay doğanlar</b>' + liste(sr.yeni, "", "Bu ay henüz doğan yok.") + "</div>" +
    "</div></section>";
}

function e25DogumSahnesiHtml() {
  if (!evrDogumSon) { return ""; }
  const e = fanEserlerim().find(function (x) { return x.tur === "kisi" && x.id === evrDogumSon; });
  if (!e) { return ""; }
  const d = e.dogum || {};
  return '<section class="e25-dogum" role="status"><span class="e25-dogum-isik" aria-hidden="true"></span>' +
    '<p class="e25-dogum-ust">E25 · bir Evrengezer doğdu</p><h3>' + kacir(e.ad) + "</h3>" +
    "<p>" + kacir(d.kapi ? d.kapi + " kapısından çıktı." : "E25'in sisinden çıktı.") + (e.unvan ? " " + kacir(e.unvan) + "." : "") + "</p>" +
    (d.soz ? '<blockquote>“' + kacir(d.soz) + "”</blockquote>" : "") +
    '<div class="oyun-sira"><button type="button" class="dugme" data-kisi-kart="benim:' + kacir(e.id) + '">Doğum kartını paylaş</button>' +
    '<button type="button" class="dugme dugme-sade" data-kisi-gotur="benim:' + kacir(e.id) + '">İlk yolculuğuna çıkar</button>' +
    '<button type="button" class="pencere-kapat" data-e25-dogum-kapat aria-label="Kapat">✕</button></div></section>';
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-e25-bulus], [data-e25-dogum-kapat]");
  if (!b) { return; }
  if (b.hasAttribute("data-e25-dogum-kapat")) { evrDogumSon = null; if (typeof evrenSayfaCiz === "function" && EVS) { evrenSayfaCiz(); } return; }
  const a = (document.querySelector("#e25BulusA") || {}).value, c = (document.querySelector("#e25BulusB") || {}).value;
  const evren = (document.querySelector("#e25BulusEvren") || {}).value || "Tömye";
  const d = document.querySelector("#e25BulusDurum");
  const yaz = function (m) { if (d) { d.className = "pencere-durum kotu"; d.textContent = m; } };
  if (!a || !c || a === c) { yaz("İki farklı Evrengezer seç."); return; }
  const k1 = kisiBul(a.split(":")[0], a.split(":").slice(1).join(":")), k2 = kisiBul(c.split(":")[0], c.split(":").slice(1).join(":"));
  if (!k1 || !k2) { yaz("Evrengezer bulunamadı."); return; }
  const g = evaEvrengezerIzni(evren);
  if (!g.izin) { yaz(g.neden); return; }
  const r = kisiGotur(k1, "yeni-hikaye@" + evren);
  if (!r) { yaz("Hikâye açılamadı (seviye kapısı ya da depolama)."); return; }
  kisiGotur(k2, "hikaye:" + r.id);
  const l = fanEserlerim(), h = l.find(function (x) { return x.id === r.id; });
  if (h) { h.baslik = k1.ad + " ile " + k2.ad + " karşılaşıyor"; fanEserlerimYaz(l); }
  fanSecili.hikaye = r.id; fanSekme.hikaye = "yaz";
  if (typeof evrenSayfaKapat === "function") { evrenSayfaKapat(); }
  location.hash = "#/fan";
  setTimeout(function () { fanHikayeCiz(); const x = document.querySelector("#fanHikayeAlan"); if (x) { x.scrollIntoView({ block: "start" }); } }, 150);
  if (typeof eckaBildir === "function") { eckaBildir(k1.ad + " ve " + k2.ad + " " + evren + "'de karşılaşıyor: yazmaya başla"); }
});

/* ==================== 4. kişi sayfası (fan evrenlerinde) ==================== */

function evrKisiSayfasiHtml(e, ad) {
  const k = evrListe(e, "kisiler").find(function (x) { return evaAd(x.ad) === evaAd(ad); });
  if (!k) { return ""; }
  const a = evrAile(e);
  const n = evaAd(ad);
  const ebeveyn = (a.ebeveyn[k.ad] || []);
  const cocuk = Object.keys(a.ebeveyn).filter(function (c) { return a.ebeveyn[c].some(function (p) { return evaAd(p) === n; }); });
  const es = a.esler.filter(function (s) { return evaAd(s[0]) === n || evaAd(s[1]) === n; }).map(function (s) { return evaAd(s[0]) === n ? s[1] : s[0]; });
  const kardes = a.kardes.filter(function (s) { return evaAd(s[0]) === n || evaAd(s[1]) === n; }).map(function (s) { return evaAd(s[0]) === n ? s[1] : s[0]; });
  const baglar = (Array.isArray(e.baglar) ? e.baglar : []).filter(function (b) { return evaAd(b.a) === n || evaAd(b.b) === n; });
  const gecer = function (t) { return new RegExp("(^|[^A-Za-zÇĞİÖŞÜçğıöşü])" + String(k.ad).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[^A-Za-zÇĞİÖŞÜçğıöşü])", "i").test(String(t || "")); };
  const belgeler = evrListe(e, "belgeler").filter(function (b) { return evaAd(b.kimden) === n || evaAd(b.kime) === n || gecer(b.metin) || gecer(b.baslik); });
  const olaylar = evrListe(e, "tarih").filter(function (t) { return gecer(t.olay) || evaAd(t.yer) === n; });
  const hikayeler = (typeof evrYazilanlar === "function" ? evrYazilanlar(e.ad) : []).filter(function (x) { return gecer(x.h.karakterler) || gecer(x.h.metin); });
  const ad2 = function (l) { return l.map(function (x) { return '<button type="button" class="ic-bag" data-evr-kisi="' + kacir(x) + '">' + kacir(x) + "</button>"; }).join(", "); };
  const ust = [k.rol, k.yas ? "yaş " + k.yas : "", k.yer].map(function (s) { return String(s || "").trim(); }).filter(Boolean);
  return '<div class="pencere evr-kisi-sayfa" role="dialog" aria-modal="true" aria-label="' + kacir(k.ad) + '">' +
    '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
    '<p class="evs-rozet">' + kacir(e.ad || "") + " · kişi</p><h3>" + kacir(k.ad) + "</h3>" +
    (ust.length ? '<p class="pencere-alt">' + ust.map(kacir).join(" · ") + "</p>" : "") +
    paragraf(k.aciklama) + (String(k.soz || "").trim() ? '<blockquote class="evr-soz">“' + kacir(k.soz) + "”</blockquote>" : "") +
    ((ebeveyn.length || cocuk.length || es.length || kardes.length) ? '<h4>Ailesi</h4><ul class="evr-kisi-aile">' +
      (ebeveyn.length ? "<li><b>Ebeveyni:</b> " + ad2(ebeveyn) + "</li>" : "") + (es.length ? "<li><b>Eşi:</b> " + ad2(es) + "</li>" : "") +
      (kardes.length ? "<li><b>Kardeşi:</b> " + ad2(kardes) + "</li>" : "") + (cocuk.length ? "<li><b>Çocukları:</b> " + ad2(cocuk) + "</li>" : "") + "</ul>" : "") +
    (baglar.length ? "<h4>Bağları</h4><ul>" + baglar.map(function (b) { const o = evaAd(b.a) === n ? b.b : b.a; return "<li>" + ad2([o]) + (b.etiket ? " — " + kacir(b.etiket) : "") + "</li>"; }).join("") + "</ul>" : "") +
    (olaylar.length ? "<h4>Tarihte</h4><ul>" + olaylar.map(function (t) { return "<li><b>" + kacir(t.zaman || "—") + "</b>" + (t.cag ? ' <span class="oyun-not">' + kacir(t.cag) + "</span>" : "") + " " + kacir(evrKisa(t.olay, 180)) + "</li>"; }).join("") + "</ul>" : "") +
    (belgeler.length ? "<h4>Belgelerde</h4><ul>" + belgeler.map(function (b) { return "<li><b>" + kacir(b.tur || "Belge") + "</b> " + kacir(b.baslik || evrKisa(b.metin, 80)) + "</li>"; }).join("") + "</ul>" : "") +
    (hikayeler.length ? "<h4>Hikâyelerde</h4><ul>" + hikayeler.map(function (x) { return "<li>" + (x.git ? '<a href="' + kacir(x.git) + '">' + kacir(fanAd(x.h)) + "</a>" : kacir(fanAd(x.h)) + ' <span class="oyun-not">taslağın</span>') + "</li>"; }).join("") + "</ul>" : "") +
    "</div>";
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evr-kisi]");
  if (!b || typeof EVS === "undefined" || !EVS) { return; }
  const v = evrenSayfaVerisi();
  if (!v || !v.eser) { return; }
  const ad = b.getAttribute("data-evr-kisi");   /* getAttribute varlıkları zaten çözer */
  const h = evrKisiSayfasiHtml(v.eser, ad);
  if (!h) { if (typeof eckaBildir === "function") { eckaBildir("“" + ad + "” bu evrenin kişileri arasında yok."); } return; }
  const p = document.querySelector("#perde");
  p.innerHTML = h; p.hidden = false; p.classList.add("evr-perde-ust");
  const k = p.querySelector(".pencere-kapat"); if (k) { k.focus(); }
});

/* ==================== 5. sürüm geçmişi: karşılaştır ==================== */

/** İki evren hâli arasındaki fark: [{ tur: "+"|"-"|"~", metin }] */
function evrFark(eski, yeni) {
  const l = [];
  const ad = function (x) {
    const a = String((x && (x.ad || x.terim || x.baslik || x.zaman)) || "").trim();
    if (a) { return a; }
    const b = x && x.kimden ? ((x.tur || "Belge") + ": " + x.kimden).trim() : "";
    return b || evrKisa(String((x && (x.metin || x.olay || x.aciklama)) || ""), 30);
  };
  if ((eski.ad || "") !== (yeni.ad || "")) { l.push({ tur: "~", metin: "Evrenin adı: “" + (eski.ad || "") + "” → “" + (yeni.ad || "") + "”" }); }
  if ((eski.ozet || "") !== (yeni.ozet || "")) { l.push({ tur: "~", metin: "Anlatım değişti" }); }
  (typeof FAN_EVREN_GRUPLARI !== "undefined" ? FAN_EVREN_GRUPLARI : []).forEach(function (g) {
    const a = evrListe(eski, g.k), b = evrListe(yeni, g.k);
    const an = a.map(ad), bn = b.map(ad);
    b.forEach(function (x, i) {
      const n = bn[i];
      const j = n ? an.indexOf(n) : -1;
      if (j === -1) { l.push({ tur: "+", metin: g.tekil + " eklendi: " + (n || "(adsız)") }); }
      else if (JSON.stringify(a[j]) !== JSON.stringify(x)) { l.push({ tur: "~", metin: g.tekil + " değişti: " + n }); }
    });
    a.forEach(function (x, i) { if (!an[i] || bn.indexOf(an[i]) === -1) { l.push({ tur: "-", metin: g.tekil + " silindi: " + (an[i] || "(adsız)") }); } });
  });
  const yer = function (e) { return (((e.harita || {}).yerler) || []).map(function (y) { return y.ad || y.id; }); };
  const ya = yer(eski), yb = yer(yeni);
  yb.forEach(function (y) { if (ya.indexOf(y) === -1) { l.push({ tur: "+", metin: "haritaya yer eklendi: " + y }); } });
  ya.forEach(function (y) { if (yb.indexOf(y) === -1) { l.push({ tur: "-", metin: "haritadan yer silindi: " + y }); } });
  const bag = function (e) { return (Array.isArray(e.baglar) ? e.baglar : []).map(function (x) { return x.a + " — " + (x.etiket || "") + " — " + x.b; }); };
  const ba = bag(eski), bb = bag(yeni);
  bb.forEach(function (x) { if (ba.indexOf(x) === -1) { l.push({ tur: "+", metin: "bağ eklendi: " + x }); } });
  ba.forEach(function (x) { if (bb.indexOf(x) === -1) { l.push({ tur: "-", metin: "bağ silindi: " + x }); } });
  const sayi = function (e, f) { try { return f(e); } catch (_) { return 0; } };
  [["roman bölümü", function (e) { return e.roman.bolumler.length; }], ["kilitli lore", function (e) { return e.lorlar.length; }]].forEach(function (x) {
    const p = sayi(eski, x[1]) || 0, q = sayi(yeni, x[1]) || 0;
    if (p !== q) { l.push({ tur: q > p ? "+" : "-", metin: x[0] + ": " + p + " → " + q }); }
  });
  return l;
}

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-gcm-fark]");
  if (!b || typeof EVS === "undefined" || !EVS || EVS.kaynak !== "benim") { return; }
  const li = b.closest("li");
  const var_ = li.querySelector(".gcm-fark");
  if (var_) { var_.remove(); return; }
  const l = await gcmListe(EVS.id);
  const k = l.find(function (x) { return x.zaman === Number(b.getAttribute("data-gcm-fark")); });
  if (!k) { return; }
  let eski;
  try { eski = JSON.parse(k.veri); } catch (_) { return; }
  const f = evrFark(eski, evrenBenimBul(EVS.id) || {});
  li.insertAdjacentHTML("beforeend", '<div class="gcm-fark">' + (f.length ? "<ul>" + f.slice(0, 60).map(function (x) {
    return '<li class="gcm-fark-' + ({ "+": "ek", "-": "sil", "~": "deg" })[x.tur] + '"><b aria-hidden="true">' + x.tur + "</b> " + kacir(x.metin) + "</li>";
  }).join("") + (f.length > 60 ? "<li>… ve " + (f.length - 60) + " değişiklik daha</li>" : "") + "</ul>" : '<p class="oyun-not">Bu hâlle şimdiki arasında fark yok.</p>') + "</div>");
});

/* ==================== 6. haritada zaman ==================== */

/* tarih olayına yer: "Nerede?" (haritadaki yerin adı) */
(function () {
  const g = typeof FAN_EVREN_GRUPLARI !== "undefined" && FAN_EVREN_GRUPLARI.find(function (x) { return x.k === "tarih"; });
  if (g && !g.alanlar.some(function (a) { return a[0] === "yer"; })) {
    g.alanlar.splice(2, 0, ["yer", "Nerede? (haritadaki yerin adı)", "kisa"]);
    g.not = "Çağ yazarsan zaman çizelgesi çağlara ayrılır; yer yazarsan olay haritada zaman kaydırıcısıyla görünür.";
  }
})();

function evrZamanOlaylari(e) {
  const yerler = (((e.harita || {}).yerler) || []);
  return evrListe(e, "tarih").map(function (t) {
    const y = yerler.find(function (x) { return evaAd(x.ad) === evaAd(t.yer); });
    return y ? { t: t, yer: y } : null;
  }).filter(Boolean);
}

function evrZamanHtml(e) {
  const l = evrZamanOlaylari(e);
  if (!l.length) { return ""; }
  return '<div class="evr-zaman-kaydir" data-evr-zaman><label for="evrZamanAralik"><b>Haritada zaman</b> · kaydır, olayın yeri haritada yanar</label>' +
    '<input type="range" id="evrZamanAralik" min="0" max="' + (l.length - 1) + '" value="0" step="1">' +
    '<p class="evr-zaman-olay" id="evrZamanOlay" aria-live="polite"></p></div>';
}

function evrZamanUygula(i) {
  const v = typeof evrenSayfaVerisi === "function" ? evrenSayfaVerisi() : null;
  if (!v) { return; }
  const l = evrZamanOlaylari(v.eser);
  const x = l[Math.max(0, Math.min(l.length - 1, Number(i) || 0))];
  if (!x) { return; }
  document.querySelectorAll("#evrenSayfa .evh-yer.zaman-isik").forEach(function (g) { g.classList.remove("zaman-isik"); });
  const g = document.querySelector('#evrenSayfa .evh-yer[data-evh-yer="' + (window.CSS && CSS.escape ? CSS.escape(x.yer.id) : x.yer.id) + '"]');
  if (g) { g.classList.add("zaman-isik"); }
  const o = document.querySelector("#evrZamanOlay");
  if (o) { o.innerHTML = "<b>" + kacir(x.t.zaman || "—") + "</b>" + (x.t.cag ? ' <span class="oyun-not">' + kacir(x.t.cag) + "</span>" : "") + " · " + kacir(x.yer.ad) + " — " + kacir(evrKisa(x.t.olay, 200)); }
}

document.addEventListener("input", function (ev) { if (ev.target && ev.target.id === "evrZamanAralik") { evrZamanUygula(ev.target.value); } });

/* ==================== 7. panel: kanona aday evrenler ==================== */

function kanonAdaylari() {
  const l = [];
  (typeof fanSiteListesi === "function" ? fanSiteListesi("evren") : []).forEach(function (e) {
    if (e.durum === "kanonAday" && e.kanon !== true) { l.push({ e: (typeof EVD_BELLEK !== "undefined" && EVD_BELLEK[e.id]) || e, ozet: e, kaynak: "site" }); }
  });
  (typeof fanAcilanlar === "function" ? fanAcilanlar() : []).forEach(function (e) {
    if (e.tur === "evren" && e.durum === "kanonAday") { l.push({ e: e, ozet: e, kaynak: "acilan" }); }
  });
  /* önizlenen ya da paylaşım adresinden açılan evrenin cihazdaki kopyası aday sayılmaz */
  return l.filter(function (x) { return !(x.kaynak === "acilan" && /^(yayin|onizle|acilan)-/.test(x.e.id || "")); });
}

function yListeKanonAday() {
  const l = kanonAdaylari();
  return '<div class="kutu-y"><p class="oyun-not">Yazarları “Kanona katılsın” diyerek gönderdi. Sitede yayındakileri buradan kanona al ya da fan-made bırak; ' +
      "dosya olarak gelenleri önce Fan → Dosya aç ile açıp siteye ekle, sonra burada karar ver. Karardan sonra GitHub'a Kaydet.</p>" +
    (l.length ? l.map(function (x) {
      const o = typeof evrOlcek === "function" ? evrOlcek(x.e) : { yuzde: 0 };
      const d = typeof evrDenetim === "function" ? evrDenetim(x.e).filter(function (y) { return y.seviye !== "bilgi"; }).length : 0;
      return '<div class="y-kisi-satir"><div class="y-kisi-ust"><span class="y-blok-baslik">' + kacir(x.e.ad || "Adsız") + "</span>" +
        '<span class="oyun-not">' + kacir(x.e.yazar || "") + " · Tömye ölçeği %" + o.yuzde + " · " + d + " tutarlılık notu · " + (x.kaynak === "site" ? "sitede" : "dosyadan") + "</span></div>" +
        '<div class="y-kisi-dugmeler"><button class="dugme dugme-sade" data-fan-ac="' + x.kaynak + ":evren:" + kacir(x.e.id) + '">Önizle</button>' +
        (x.kaynak === "site" ? '<button class="dugme" data-kanon-aday-al="' + kacir(x.e.id) + '">Kanona al</button><button class="dugme dugme-sade" data-kanon-aday-fan="' + kacir(x.e.id) + '">Fan-made bırak</button>' : "") +
        "</div></div>";
    }).join("") : '<p class="oyun-not">Şu an kanona aday evren yok.</p>') + "</div>";
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-kanon-aday-al], [data-kanon-aday-fan]");
  if (!b || typeof yoneticiAcik !== "function" || !yoneticiAcik()) { return; }
  const id = b.getAttribute("data-kanon-aday-al") || b.getAttribute("data-kanon-aday-fan");
  const e = fanSiteListesi("evren").find(function (x) { return x.id === id; });
  if (!e) { return; }
  if (b.hasAttribute("data-kanon-aday-al")) { e.kanon = true; } else { e.durum = "fan"; delete e.kanon; }
  if (typeof yoneticiDurum === "function") { yoneticiDurum((e.kanon ? "Kanona alındı: " : "Fan-made bırakıldı: ") + e.ad + ". Kalıcı olması için GitHub'a Kaydet.", true); }
  if (typeof yoneticiCiz === "function") { yoneticiCiz(); }
});

