/* Sürüm 2.6 — sunucuya yük bindirmeden:

   Okuma yolları: bir karakter ya da Claude evreni kişisi hakkındaki kutular sırayla ("Kyldo'yu tanı: 6 kutu, 12 dk").
     Yollar kutu bağlarından (76-rozet-baglari.js) kurulur; ilerleme okunan kutulardan gelir. Yol bitince o konunun
     rozeti de gelmiş olur (aynı kutular). Hepsi cihazda; sunucuya hiçbir şey gitmez.
   Çevrimdışı okuma paketi: sitedeki bütün fan evrenleri tek dokunuşla cihaza (Cloudflare'den iner, Supabase'e değil);
     kullanılan alan gösterilir. Arşiv, Claude'un Evreni ve kanon evrenler zaten sayfa verisiyle cihazda.
   Ortak yazarlık işaretleri: kim, ne zaman, hangi sekmede değiştirdi; değişen bölümlerin günlüğü; sürüm geçmişinde
     kimin değişikliğinden önceki hâl olduğu. Canlı yoklama yok: bilgi zaten giden/gelen kayıtla taşınır, sekmeye
     dönünce (en çok dakikada bir) yenilenir.
   Panel sağlık ekranı: kurulum sürümü, son 24 saatin hataları, bekleyen içerik bildirimleri, yedek yaşı, yayındaki
     sürüm, çevrimdışı paket ve cihaz alanı — hepsi zaten alınan bilgilerden. */

/* ==================== okuma yolları ==================== */

const YOL_AKTIF = "tentiforapp_okuma_yolu";   /* seçilen yol: { id } */

function yolKelime(anahtar) {
  try { const d = rbAg().get(anahtar); return d ? rbKelime(d.kutu.metin) : 0; } catch (_) { return 0; }
}

/** Bütün okuma yolları: [{ id, ad, adimlar: [{ anahtar, ad, git }], dakika }] */
function okumaYollari() { return okumaYollariKaynak(); }

function okumaYollariKaynak(karSec, ceSec) {
  const l = [];
  const dakika = function (adimlar) {
    const sn = adimlar.reduce(function (t, a) { return t + yolKelime(a.anahtar) * (typeof okuSaniyeKelime === "function" ? okuSaniyeKelime() : 0.25); }, 0);
    return Math.max(1, Math.round(sn / 60));
  };
  (karSec === null ? [] : (veri.karakterler || []).filter(karSec || function () { return true; })).forEach(function (k) {
    if (!k.id || k.kart === false || (typeof okuErisim === "function" && !okuErisim(null, k.gizli))) { return; }
    const adimlar = karakterKutulari(k).filter(function (x) { return !x.kilitli; });
    if (adimlar.length < 3) { return; }
    l.push({ id: "kar:" + k.id, ad: k.ad + "'i tanı", adimlar: adimlar, dakika: dakika(adimlar) });
  });
  (ceSec === null ? [] : ((veri.claudeEvreni || {}).kisiler || []).filter(ceSec || function () { return true; })).forEach(function (k) {
    const bas = "madde:ce-" + k.id;
    let baglar = [];
    try { baglar = rbBaglar(bas); } catch (_) { baglar = []; }
    if (baglar.length < 2) { return; }
    const adimlar = [{ anahtar: bas, ad: "Kişi: " + k.ad, git: "#/claude" }].concat(baglar.map(function (b) { return { anahtar: b.anahtar, ad: b.ad, git: b.git }; }));
    l.push({ id: "ce:" + k.id, ad: k.ad + " (Claude'un Evreni)", adimlar: adimlar, dakika: dakika(adimlar) });
  });
  return l.sort(function (a, b) { return b.adimlar.length - a.adimlar.length; });
}

function yolIlerleme(y) {
  const okunan = y.adimlar.filter(function (a) { return okunduMu(a.anahtar); }).length;
  return { okunan: okunan, toplam: y.adimlar.length, sonraki: y.adimlar.find(function (a) { return !okunduMu(a.anahtar); }) || null };
}

/** Tek yol (bütün yolları hesaplamadan). */
/** Kimliğe göre okuma yolu: kar:<karakter>, ce:<Claude'un Evreni kişisi>, oz:<okurun kendi yolu>. */
function okumaYolu(id) {
  const oz = /^oz:(.+)$/.exec(id || "");
  if (oz) { const y = ozelYollar().find(function (x) { return x.id === oz[1]; }); return y ? ozelYolNesnesi(y) : null; }
  const m = /^(kar|ce):(.+)$/.exec(id || "");
  if (!m) { return null; }
  const l = okumaYollariKaynak(m[1] === "kar" ? function (k) { return k.id === m[2]; } : null, m[1] === "ce" ? function (k) { return k.id === m[2]; } : null);
  return l[0] || null;
}
function yolAktif() { const d = jsonOku(YOL_AKTIF, null); return d && d.id ? okumaYolu(d.id) : null; }

function yollarHtml() {
  let l;
  try { l = okumaYollari(); } catch (_) { l = []; }
  if (!l.length) { return '<p class="oyun-not">Okuma yolları, kodlarla açtığın bölümlerdeki kutulardan kurulur.</p>' + ozelYolHtml(); }
  const aktif = jsonOku(YOL_AKTIF, null);
  return '<p class="oyun-not">Bir konuyu baştan sona okumak için sıralı kutular. Yol bitince o konunun rozeti de gelir.</p>' +
    '<ul class="yol-liste">' + l.slice(0, 30).map(function (y) {
      const o = yolIlerleme(y);
      const bitti = o.okunan === o.toplam;
      const secili = aktif && aktif.id === y.id;
      return '<li class="' + (bitti ? "bitti" : "") + (secili ? " secili" : "") + '"><span><b>' + kacir(y.ad) + "</b>" +
        '<span class="oyun-not"> · ' + o.toplam + " kutu · ~" + y.dakika + " dk · " + (bitti ? "✓ bitti" : o.okunan + " okundu") + "</span></span>" +
        (bitti ? "" : '<button class="dugme dugme-sade y-kucuk" data-yol-basla="' + kacir(y.id) + '">' + (secili ? "Sıradaki →" : (o.okunan ? "Devam et" : "Başla")) + "</button>") + "</li>";
    }).join("") + "</ul>" + ozelYolHtml();   /* okurun kendi yolları (80) */
}

/** Yol çubuğu: seçili yol varken altta küçük bir düğme (sıradaki kutu). */
function yolCubuguCiz() {
  let c = document.querySelector("#yolCubugu");
  const y = yolAktif();
  const o = y ? yolIlerleme(y) : null;
  if (!y || !o.sonraki || document.querySelector("#evrenSayfa")) { if (c) { c.remove(); } return; }
  if (!c) { c = document.createElement("div"); c.id = "yolCubugu"; c.className = "yol-cubugu"; document.body.appendChild(c); }
  c.innerHTML = '<button class="yol-cubugu-git" data-yol-sonraki title="' + kacir(o.sonraki.ad) + '"><span class="oyun-not">' + kacir(y.ad) + " · " + o.okunan + "/" + o.toplam + "</span>" +
    "<b>Sıradaki: " + kacir(o.sonraki.ad.slice(0, 40)) + " →</b></button>" +
    '<button class="yol-cubugu-kapat" data-yol-birak aria-label="Yolu bırak">✕</button>';
}

function yolAdimaGit(a) {
  if (!a || !a.git) { return; }
  /* sitenin kendi bağlantı yönlendirmesi (00-rota.js): "#/…" rotaları ve "#bolum" bağlantıları aynı yoldan */
  const b = document.createElement("a");
  b.href = a.git;
  b.style.display = "none";
  document.body.appendChild(b);
  b.click();
  b.remove();
  if (typeof eckaBildir === "function") { eckaBildir("Sıradaki: " + a.ad + " — sonuna kadar oku"); }
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-yol-basla], [data-yol-sonraki], [data-yol-birak]");
  if (!b) { return; }
  if (b.hasAttribute("data-yol-birak")) { jsonYaz(YOL_AKTIF, null); yolCubuguCiz(); if (typeof ayar25Ciz === "function") { ayar25Ciz(); } return; }
  if (b.dataset.yolBasla) { jsonYaz(YOL_AKTIF, { id: b.dataset.yolBasla }); }
  const y = yolAktif();
  if (typeof perdeKapat === "function" && !document.querySelector("#perde").hidden) { perdeKapat(); }
  yolAdimaGit(y && yolIlerleme(y).sonraki);
  setTimeout(yolCubuguCiz, 400);
});

window.addEventListener("hashchange", function () { setTimeout(yolCubuguCiz, 300); });

/* ==================== çevrimdışı okuma paketi ==================== */

function paketEvrenleri() { return ((veri.fanEserleri || {}).evrenler || []).filter(function (e) { return typeof evdDosyali === "function" && evdDosyali(e); }); }

async function paketIndir(durum) {
  const l = paketEvrenleri();
  let tamam = 0, hata = "";
  for (let i = 0; i < l.length; i++) {
    if (durum) { durum.textContent = "İndiriliyor: " + (l[i].ad || l[i].id) + " (" + (i + 1) + "/" + l.length + ")"; }
    let h = "";
    try { h = await evdCevrimdisiIndir(l[i].id); } catch (e) { h = (e && e.message) || "İndirilemedi"; }
    if (h) { hata = h; if (/İnternet yok/.test(h)) { break; } } else { tamam++; }
  }
  return { tamam: tamam, toplam: l.length, hata: hata };
}

async function paketAlanHtml() {
  let kullanilan = "";
  try { if (navigator.storage && navigator.storage.estimate) { const t = await navigator.storage.estimate(); kullanilan = (t.usage / 1048576).toFixed(1) + " MB"; } } catch (_) { kullanilan = ""; }
  return kullanilan ? "Bu site cihazında " + kullanilan + " yer kullanıyor." : "";
}

function paketKutusuHtml() {
  const l = paketEvrenleri();
  const indirilen = typeof evdIndirilenler === "function" ? evdIndirilenler() : {};
  const kalan = l.filter(function (e) { return !indirilen[e.id]; });
  const kb = Math.max(1, Math.round(kalan.reduce(function (t, e) { return t + (Number(e.boyut) || 0); }, 0) / 1024));
  setTimeout(function () { paketAlanHtml().then(function (h) { const a = document.querySelector("#paketAlan"); if (a) { a.textContent = h; } }); }, 0);
  return '<div class="paket-kutu"><p class="oyun-not">Arşiv, Claude\'un Evreni ve kanon evrenler zaten internetsiz açılır. ' +
      (l.length ? (kalan.length ? "Sitedeki " + kalan.length + " fan evreni daha indirilebilir (~" + kb + " KB)." : "Sitedeki bütün fan evrenleri cihazda.") : "Sitede ayrı dosyalı fan evreni yok.") + "</p>" +
    (kalan.length ? '<button class="dugme" data-paket-indir>Hepsini cihaza indir</button>' : (l.length ? '<button class="dugme dugme-sade" data-paket-indir>Hepsini güncelle</button>' : "")) +
    '<p class="oyun-not" id="paketAlan"></p><p class="pencere-durum" id="paketDurum" role="status"></p></div>';
}

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-paket-indir]");
  if (!b) { return; }
  b.disabled = true;
  const d = document.querySelector("#paketDurum");
  const s = await paketIndir(d);
  if (d) {
    d.textContent = s.hata && !s.tamam ? s.hata : (s.tamam + " / " + s.toplam + " evren cihazda" + (s.hata ? " · " + s.hata : ""));
    d.className = "pencere-durum " + (s.hata && !s.tamam ? "kotu" : "iyi");
  }
  b.disabled = false;
  setTimeout(function () { if (typeof ayar25Ciz === "function" && ayar25Gorunur()) { ayar25Ciz(); } }, 1500);
});

/* ==================== ortak yazarlık işaretleri ==================== */

const ORTAK_GUNLUK = "tentiforapp_ortak_gunluk";   /* { evrenId: [{ kim, zaman, sekme, alanlar }] } bu cihazda */
const ORTAK_ALANLAR = { ad: "Ad", ozet: "Özet", kurallar: "Kurallar", kisiler: "Kişiler", yerler: "Yerler", tarih: "Tarih", sozluk: "Sözlük",
  ozelAlanlar: "Kendi alanlar", harita: "Harita", roman: "Roman", cizimler: "Çizimler", oyunlar: "Oyunlar", uygulamalar: "Uygulamalar",
  yazi: "Yazı", stil: "Görünüm", stilKodu: "Stil kodu", gorunumKodu: "Görünüm kodu", lorlar: "Kilitli lore", para: "Para", alfabe: "Alfabe", sekmeDuzen: "Sekmeler" };
const OI_SEKME = { harita: "Harita", bilgi: "Bilgiler", roman: "Roman", oyunlar: "Oyunlar", cizim: "Çizimler", stil: "Görünüm", kodstil: "Kod ile stil",
  yazi: "Yazı", lore: "Kilitli lore", uygulama: "Uygulamalar", vitrin: "Vitrin", ag: "Bağlar ve zaman", kod: "Kod" };

function oiBenimAdim() {
  const p = typeof hesapProfil !== "undefined" && hesapProfil ? hesapProfil : null;
  return String((p && (p.gorunen_ad || p.kullanici_adi)) || "Bir yazar").slice(0, 40);
}

function oiDegisenAlanlar(eski, yeni) {
  return Object.keys(ORTAK_ALANLAR).filter(function (k) { return JSON.stringify((eski || {})[k]) !== JSON.stringify((yeni || {})[k]); });
}

function oiNeZaman(t) {
  const d = (Date.now() - new Date(t).getTime()) / 60000;
  if (!isFinite(d)) { return ""; }
  if (d < 1) { return "az önce"; }
  if (d < 60) { return Math.round(d) + " dk önce"; }
  if (d < 1440) { return Math.round(d / 60) + " saat önce"; }
  return new Date(t).toLocaleDateString("tr-TR");
}

function oiSeritHtml(e) {
  const iz = e.ortakIz;
  const g = ((jsonOku(ORTAK_GUNLUK, {}) || {})[e.id] || []);
  if (!iz && !g.length) { return ""; }
  const son = iz && iz.kim && iz.kim !== oiBenimAdim() ? iz : (g[0] || null);
  if (!son) { return ""; }
  return '<div class="oi-serit" role="status">✎ <b>' + kacir(son.kim) + "</b> " + kacir(oiNeZaman(son.zaman)) +
    (son.sekme && OI_SEKME[son.sekme] ? " · " + kacir(OI_SEKME[son.sekme]) + " sekmesinde" : "") + " değiştirdi</div>";
}

function oiGunlukHtml(id) {
  const g = ((jsonOku(ORTAK_GUNLUK, {}) || {})[id] || []);
  if (!g.length) { return ""; }
  return '<details class="oi-gunluk"><summary>Değişiklik günlüğü · ' + g.length + "</summary><ul>" + g.slice(0, 15).map(function (x) {
    return "<li><b>" + kacir(x.kim) + "</b> · " + kacir(oiNeZaman(x.zaman)) + " · " + kacir(x.alanlar.map(function (a) { return ORTAK_ALANLAR[a] || a; }).join(", ")) + "</li>";
  }).join("") + '</ul><p class="oyun-not">Bir değişikliği geri almak için Sürüm geçmişinde o kişinin adının geçtiği “… değişikliğinden önce” kaydına dön.</p></details>';
}

/* sekmeye dönünce (en çok dakikada bir) açık ortak evrenin güncel hâli — canlı yoklama yok */
let oiSonCekim = 0;
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState !== "visible" || Date.now() - oiSonCekim < 60000) { return; }
  if (typeof EVS === "undefined" || !EVS || EVS.kaynak !== "benim" || typeof ortakCek !== "function") { return; }
  const e = evrenBenimBul(EVS.id);
  if (!e || !e.ortak) { return; }
  oiSonCekim = Date.now();
  ortakCek(EVS.id);
});

/* ==================== panel: site sağlığı ==================== */

const SAGLIK = { yayin: null, alan: null, soruldu: false, acik: false };
document.addEventListener("toggle", function (e) { if (e.target && e.target.classList && e.target.classList.contains("saglik-kutu")) { SAGLIK.acik = e.target.open; } }, true);

function saglikSor() {
  if (SAGLIK.soruldu) { return; }
  SAGLIK.soruldu = true;
  fetch("/surum.json?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { SAGLIK.yayin = d; if (typeof yon24SeritKoy === "function") { yon24SeritKoy(); } }).catch(function () { SAGLIK.yayin = false; });
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(function (t) { SAGLIK.alan = t; if (typeof yon24SeritKoy === "function") { yon24SeritKoy(); } }).catch(function () { /* yok */ });
  }
}

function saglikHtml() {
  saglikSor();
  const satir = function (durum, ad, deger) { return '<div class="sg-satir sg-' + durum + '"><span class="sg-nokta" aria-hidden="true"></span><span>' + ad + "</span><b>" + deger + "</b></div>"; };
  const l = [];
  const kurulum = typeof YON24 !== "undefined" ? YON24.surum : null;
  l.push(satir(kurulum === null ? "bilinmez" : (kurulum === (typeof KURULUM_BEKLENEN !== "undefined" ? KURULUM_BEKLENEN : kurulum) ? "iyi" : "kotu"), "Supabase kurulumu",
    kurulum === null ? "giriş yapınca" : kacir(kurulum === "yok" ? "eski" : kurulum)));
  const hata = typeof YON24 !== "undefined" && YON24.hata ? YON24.hata.reduce(function (t, x) { return t + (Number(x.sayi) || 0); }, 0) : null;
  l.push(satir(hata === null ? "bilinmez" : (hata === 0 ? "iyi" : (hata < 20 ? "uyari" : "kotu")), "Hatalar (24 saat)", hata === null ? "—" : String(hata)));
  const ib = typeof IB_SAYI !== "undefined" && IB_SAYI.soruldu ? IB_SAYI.yeni : null;
  l.push(satir(ib === null ? "bilinmez" : (ib ? "uyari" : "iyi"), "Bekleyen içerik bildirimi", ib === null ? "—" : String(ib)));
  let son = 0;
  try { son = Number(localStorage.getItem("tentiforapp_son_yedek")) || 0; } catch (_) { son = 0; }
  const gun = son ? Math.floor((Date.now() - son) / 86400000) : null;
  l.push(satir(gun === null ? "kotu" : (gun < 7 ? "iyi" : "uyari"), "Son yedek (bu cihaz)", gun === null ? "hiç" : (gun === 0 ? "bugün" : gun + " gün önce")));
  const y = SAGLIK.yayin;
  const ayni = y && y.surum && veri && y.surum === veri.surum;
  l.push(satir(y === null ? "bilinmez" : (y === false ? "uyari" : (ayni ? "iyi" : "uyari")), "Yayındaki sürüm",
    y === null ? "…" : (y === false ? "okunamadı" : kacir((y.surum || "?") + (ayni ? "" : " (paneldeki: " + (veri && veri.surum) + " — Kaydet/Yayınla?)")))));
  const indirilen = typeof evdIndirilenler === "function" ? Object.keys(evdIndirilenler()).length : 0;
  const alan = SAGLIK.alan ? (SAGLIK.alan.usage / 1048576).toFixed(1) + " MB" : "…";
  l.push(satir("iyi", "Çevrimdışı (bu cihaz)", indirilen + " evren indirili · " + alan));
  return '<details class="kutu-y saglik-kutu"' + (SAGLIK.acik ? " open" : "") + '><summary><b>Site sağlığı</b></summary><div class="sg-izgara">' + l.join("") + "</div></details>";
}

document.addEventListener("DOMContentLoaded", function () {
  const bekle = typeof veriHazirOlunca === "function" ? veriHazirOlunca : function (f) { setTimeout(f, 1500); };
  bekle(function () { setTimeout(yolCubuguCiz, 800); });
});
