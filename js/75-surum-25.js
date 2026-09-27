/* Sürüm 2.5

   Yönetim:   tek kodla verilen yöneticiliğin yetkileri (panel sekmeleri; sunucu da denetler: yonetici_yetki),
              evren yönetici kodunun yetkileri (hangi lorelar, gizli sekmeler, bedava ipucu),
              içerik bildirimleri (okur bildirir, panelde liste), yedek hatırlatması, haftanın evreni.
   Kurucu:    ortak yazarlık (davet koduyla ikinci yazar; son kaydeden kazanır, üstüne yazılan sürüm geçmişine düşer),
              sürüm geçmişi ve geri al (bu cihazda son 20 hâl), evren istatistikleri, ziyaretçi gözüyle önizleme.
   Okur:      okuma listesi ve kaldığın yer, evren yazısı klavyesi (PNG), evren önizleme kartı, bildirim ayarları
              (yeni bölüm, günün kelimesi, takip, sessiz saatler, cihazdaki evrenler).
   Uygulama:  mağaza için ekran görüntüleri ve .well-known (scripts/paketle.mjs), uygulama/README.md. */

const Y25 = { okulmadi: true };

function y25Hesap() { return typeof hesapIstemci !== "undefined" && hesapIstemci && typeof hesapKullanici !== "undefined" && hesapKullanici; }
function y25Durum(sec, m, iyi) { const d = document.querySelector(sec); if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } }
function y25Zaman(t) { const d = new Date(t); return isNaN(d) ? "?" : d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }); }

/* ==================== 1. yönetici yetkileri (tek kod) ==================== */

const Y25_YENI_SEKMELER = { icbildirim: "İçerik bildirimleri", vitrin: "Haftanın evreni" };
if (typeof Y_GRUPLARI !== "undefined") {
  if (Y_GRUPLARI.bakim.sekmeler.indexOf("icbildirim") === -1) { Y_GRUPLARI.bakim.sekmeler.splice(Y_GRUPLARI.bakim.sekmeler.indexOf("hatalar") + 1, 0, "icbildirim"); }
  if (Y_GRUPLARI.icerik.sekmeler.indexOf("vitrin") === -1) { Y_GRUPLARI.icerik.sekmeler.push("vitrin"); }
}
if (typeof SINIRLI_SEKMELER !== "undefined") {
  ["icbildirim", "vitrin"].forEach(function (s) { if (SINIRLI_SEKMELER.indexOf(s) === -1) { SINIRLI_SEKMELER.push(s); } });
}

const Y25_SEKME_ADLARI = { roman: "Roman", basin: "Basın kiti", listeler: "Listeler", hizli: "Hızlı karakter", yapimEkle: "Yapım ekle",
  olayEkle: "Olay ekle", hikayeEkle: "Hikâye ekle", gorselEkle: "Görsel ekle", sesEkle: "Ses ekle", denetim: "Denetim", istatistik: "İstatistik",
  liderlik: "Liderlik", teoriler: "Teoriler", hatalar: "Hatalar", test: "Test", kaydet: "Kaydet (GitHub)", icbildirim: "İçerik bildirimleri", vitrin: "Haftanın evreni" };

/** Tek kodla gelen yöneticiliğin izin verdiği sekmeler; kısıt yoksa null. */
function y25YetkiSekmeleri() {
  if (typeof TEK === "undefined" || !TEK.yoneticiVerdi) { return null; }
  const l = TEK.haklar.filter(function (h) { return h.tur === "yonetici"; });
  if (!l.length || l.some(function (h) { return !h.veri || !Array.isArray(h.veri.yetkiler); })) { return null; }
  const s = {};
  l.forEach(function (h) { h.veri.yetkiler.forEach(function (x) { s[x] = true; }); });
  return Object.keys(s);
}

if (typeof yoneticiSekmeleri === "function") {
  const eskiYS = yoneticiSekmeleri;
  window.yoneticiSekmeleri = function (grup) {
    const l = eskiYS.apply(this, arguments);
    if (typeof yoneticiAcik === "function" && yoneticiAcik()) { return l; }
    const izin = y25YetkiSekmeleri();
    return izin ? l.filter(function (s) { return izin.indexOf(s) !== -1; }) : l;
  };
}

/* panelde üretirken: yönetici koduna verilecek yetkiler */
const TEK25 = { yetkiler: null };
if (typeof yoneticiTekKodlar === "function") {
  const eskiTK = yoneticiTekKodlar;
  window.yoneticiTekKodlar = function () {
    const h = eskiTK.apply(this, arguments);
    if (typeof TEK_PANEL === "undefined" || TEK_PANEL.tur !== "yonetici") { return h; }
    const secili = TEK25.yetkiler || SINIRLI_SEKMELER.slice();
    const kutu = '<label>Yetkiler (sınırlı yönetici yalnızca bu sekmeleri görür; sunucu da denetler)</label><div class="y-alan-izgara">' +
      SINIRLI_SEKMELER.map(function (s) {
        return '<label class="y-alan-secim"><input type="checkbox" data-tek-yetki="' + s + '"' + (secili.indexOf(s) !== -1 ? " checked" : "") + "> " + kacir(Y25_SEKME_ADLARI[s] || s) + "</label>";
      }).join("") + '</div><div class="oyun-sira"><button class="dugme dugme-sade y-kucuk" data-tek-yetki-hepsi="1">Hepsini seç</button>' +
      '<button class="dugme dugme-sade y-kucuk" data-tek-yetki-hepsi="0">Hiçbiri</button></div>';
    return h.replace('<div class="y-kisi-dugmeler"><button class="dugme" data-tek-uret>', kutu + '<div class="y-kisi-dugmeler"><button class="dugme" data-tek-uret>');
  };
}

function tek25YetkiOku() {
  const l = document.querySelectorAll("[data-tek-yetki]");
  if (!l.length) { return; }
  TEK25.yetkiler = Array.prototype.slice.call(l).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-tek-yetki"); });
}
document.addEventListener("change", function (e) { if (e.target && e.target.matches && e.target.matches("[data-tek-yetki]")) { tek25YetkiOku(); } });
document.addEventListener("click", function (e) {
  const b = e.target.closest && e.target.closest("[data-tek-yetki-hepsi]");
  if (b) { TEK25.yetkiler = b.getAttribute("data-tek-yetki-hepsi") === "1" ? SINIRLI_SEKMELER.slice() : []; yoneticiCiz(); return; }
  /* üret: önce yetkileri oku (71'deki dinleyiciden önce, yakalama aşamasında) */
}, false);
document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-tek-uret]")) { tek25YetkiOku(); } }, true);

if (typeof tekKodlariOlustur === "function") {
  const eskiOlustur = tekKodlariOlustur;
  window.tekKodlariOlustur = async function (tur, ad, adet, secim) {
    if (tur !== "yonetici") { return eskiOlustur.apply(this, arguments); }
    const yetkiler = (TEK25.yetkiler || SINIRLI_SEKMELER.slice()).filter(function (s) { return SINIRLI_SEKMELER.indexOf(s) !== -1; });
    if (!yetkiler.length) { throw new Error("En az bir yetki seç."); }
    const kodlar = [], satirlar = [];
    for (let i = 0; i < adet; i++) {
      const kod = kod10();
      kodlar.push(kod);
      satirlar.push({ ozet: tekOzet(kod), tur: tur, ad: ad, veri: { yetkiler: yetkiler }, sure_gun: Number(secim.sure) || null });
    }
    const r = await hesapIstemci.rpc("tek_kod_olustur", { p_kodlar: satirlar });
    if (r.error) { throw r.error; }
    return kodlar;
  };
}

/* ==================== 2. evren yönetici kodunun yetkileri ==================== */

const EVY25 = "tentiforapp_evren_yonetim";   /* { evrenId: true } bu cihazda evren yönetici kodu girildi */

function evy25Acik(eid) { const d = jsonOku(EVY25, {}) || {}; return !!d[eid]; }
function evy25Yetki(e) { return (e && e.yoneticiYetki) || { sekmeler: false, ipucu: false }; }
/** Bu cihazda bu evrenin yönetici kodu girildi ve kod bu yetkiyi veriyor mu? */
function evy25Var(e, yetki) { return !!(e && e.yoneticiOzet && evy25Acik(e.id) && evy25Yetki(e)[yetki]); }

if (typeof evrenEkTemizle === "function") {
  const eskiEk25 = evrenEkTemizle;
  window.evrenEkTemizle = function (ham, e) {
    eskiEk25.apply(this, arguments);
    const y = ham.yoneticiYetki;
    if (y && typeof y === "object") {
      const t = { sekmeler: y.sekmeler === true, ipucu: y.ipucu === true };
      if (Array.isArray(y.lorlar)) { t.lorlar = y.lorlar.map(String).filter(function (x) { return /^[\w-]{1,40}$/.test(x); }).slice(0, 200); }
      e.yoneticiYetki = t;
    }
    if (ham.ortak === true) { e.ortak = true; }
  };
}

if (typeof evrenYoneticiKoduHtml === "function") {
  const eskiEYH = evrenYoneticiKoduHtml;
  window.evrenYoneticiKoduHtml = function (e, kodlar) {
    const h = eskiEYH.apply(this, arguments);
    const y = evy25Yetki(e);
    const lorlar = e.lorlar || [];
    const secili = function (id) { return !Array.isArray(y.lorlar) || y.lorlar.indexOf(id) !== -1; };
    const kutu = '<div class="evy-yetki"><span class="oyun-etiket">Bu kodun yetkileri</span>' +
      (lorlar.length ? '<p class="oyun-not">Açacağı kilitli lorelar:</p><div class="y-alan-izgara">' + lorlar.map(function (l) {
        return '<label class="y-alan-secim"><input type="checkbox" data-evy-lore="' + kacir(l.id) + '"' + (secili(l.id) ? " checked" : "") + "> " + kacir(l.baslik || l.id) + "</label>";
      }).join("") + "</div>" : '<p class="oyun-not">Evrende henüz kilitli lore yok; eklenince bu kod hepsini açar.</p>') +
      '<label class="hf-onay"><input type="checkbox" id="evyYetkiSekme"' + (y.sekmeler ? " checked" : "") + "> Ziyaretçilerden gizlediğin sekmeleri görsün</label>" +
      '<label class="hf-onay"><input type="checkbox" id="evyYetkiIpucu"' + (y.ipucu ? " checked" : "") + "> Lore ipuçlarını parasız alsın</label>" +
      '<p class="oyun-not">Yetkiler, kodu kurunca ya da değiştirince uygulanır.</p></div>';
    return h.replace('<p class="pencere-durum" id="evyDurum"', kutu + '<p class="pencere-durum" id="evyDurum"');
  };
}

if (typeof evrenYoneticiKoduKur === "function") {
  const eskiEYK = evrenYoneticiKoduKur;
  window.evrenYoneticiKoduKur = function (e, kod) {
    const kutular = document.querySelectorAll("[data-evy-lore]");
    const lorlar = kutular.length ? Array.prototype.slice.call(kutular).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-evy-lore"); }) : null;
    const yetki = { sekmeler: !!(document.querySelector("#evyYetkiSekme") || {}).checked, ipucu: !!(document.querySelector("#evyYetkiIpucu") || {}).checked };
    if (lorlar && lorlar.length < (e.lorlar || []).length) { yetki.lorlar = lorlar; }
    const s = eskiEYK.apply(this, arguments);
    if (s && s.hata) { return s; }
    let cikan = 0;
    evrenBenimDegistir(e.id, function (x) {
      x.yoneticiYetki = yetki;
      if (yetki.lorlar) { (x.lorlar || []).forEach(function (l) { if (yetki.lorlar.indexOf(l.id) === -1 && l.sy) { delete l.sy; cikan++; } }); }
    });
    if (s) { s.sarilan = Math.max(0, (s.sarilan || 0) - cikan); }
    return s;
  };
}

if (typeof evrenKodDene === "function") {
  const eskiEKD = evrenKodDene;
  window.evrenKodDene = async function (e) {
    const s = await eskiEKD.apply(this, arguments);
    if (s && s.tur === "evren" && e && e.id) { const d = jsonOku(EVY25, {}) || {}; d[e.id] = true; jsonYaz(EVY25, d); }
    return s;
  };
}

/* gizli sekmeler: yetkili evren yöneticisine görünür */
if (typeof evrenEkSekmeler === "function") {
  const eskiSek25 = evrenEkSekmeler;
  window.evrenEkSekmeler = function (v) {
    if (v && v.eser && v.eser.sekmeDuzen && evy25Var(v.eser, "sekmeler")) {
      const e2 = Object.assign({}, v.eser); delete e2.sekmeDuzen;
      return eskiSek25.call(this, Object.assign({}, v, { eser: e2 }));
    }
    return eskiSek25.apply(this, arguments);
  };
}
if (typeof evrenDuzeni === "function") {
  const eskiDuz25 = evrenDuzeni;
  window.evrenDuzeni = function () {
    const d = eskiDuz25.apply(this, arguments);
    const v = typeof evrenSayfaVerisi === "function" ? evrenSayfaVerisi() : null;
    if (d && v && evy25Var(v.eser, "sekmeler")) { return d.ilk ? { ilk: d.ilk } : null; }
    return d;
  };
}
/* bedava ipucu */
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evl-ipucu]");
  if (!b || typeof EVS === "undefined" || !EVS) { return; }
  const v = evrenSayfaVerisi();
  if (!v || !evy25Var(v.eser, "ipucu")) { return; }
  ev.stopImmediatePropagation(); ev.preventDefault();
  const id = b.getAttribute("data-evl-ipucu");
  const eg = egYukle();
  if (eg.ipucu.indexOf(v.eser.id + "/" + id) === -1) { eg.ipucu.push(v.eser.id + "/" + id); egKaydet(); }
  evrenSayfaCiz();
}, true);

/* ==================== 3. içerik bildirimi ==================== */

const IB_TURLER = { evren: "Evren", uygulama: "Evren uygulaması", defter: "Ziyaretçi defteri notu", teori: "Teori", yorum: "Yorum", diger: "Diğer" };

function icerikBildirAc(tur, hedef, ad) {
  const p = document.querySelector("#perde");
  if (!p) { return; }
  p.innerHTML = '<div class="pencere" role="dialog" aria-modal="true" aria-labelledby="ibBaslik">' +
    '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
    '<h3 id="ibBaslik">İçeriği bildir</h3>' +
    '<p class="pencere-alt">' + kacir(IB_TURLER[tur] || "İçerik") + (ad ? " · " + kacir(ad) : "") + "</p>" +
    (y25Hesap() ? '<label for="ibNeden">Neden? (yönetici görür)</label>' +
      '<textarea class="kod-giris arac-giris" id="ibNeden" rows="4" maxlength="500" placeholder="Örneğin: hakaret, kişisel bilgi, telif, uygunsuz görsel…"></textarea>' +
      '<button class="dugme" data-ib-gonder data-tur="' + kacir(tur) + '" data-hedef="' + kacir(hedef) + '">Bildir</button>'
      : '<p class="oyun-not">Bildirmek için giriş yap: kötüye kullanımı önlemek için bildirimler hesaba bağlıdır.</p>' +
        '<button class="dugme" data-hesap-pencere="giris">Giriş yap</button>') +
    '<p class="pencere-durum" id="ibDurum" role="status"></p></div>';
  p.hidden = false;
}

document.addEventListener("click", async function (ev) {
  const a = ev.target.closest && ev.target.closest("[data-ib-ac]");
  if (a) { icerikBildirAc(a.dataset.tur, a.dataset.hedef, a.dataset.ad || ""); return; }
  const g = ev.target.closest && ev.target.closest("[data-ib-gonder]");
  if (!g || !y25Hesap()) { return; }
  g.disabled = true;
  try {
    const r = await hesapIstemci.rpc("icerik_bildir", { p_tur: g.dataset.tur, p_hedef: g.dataset.hedef,
      p_neden: (document.querySelector("#ibNeden") || {}).value || "", p_adres: location.pathname + location.hash });
    const d = (!r.error && r.data && r.data.durum) || "hata";
    y25Durum("#ibDurum", { tamam: "Teşekkürler, bildirimin yöneticiye ulaştı.", zaten: "Bunu zaten bildirmişsin; inceleniyor.",
      sinir: "Bugün çok bildirim yaptın; yarın yeniden dene.", giris: "Önce giriş yap." }[d] || "Gönderilemedi; biraz sonra dene.", d === "tamam" || d === "zaten");
  } catch (_) { y25Durum("#ibDurum", "Gönderilemedi; biraz sonra dene.", false); }
  g.disabled = false;
});

function ibDugme(tur, hedef, ad) {
  return '<button class="ic-bag ib-dugme" data-ib-ac data-tur="' + kacir(tur) + '" data-hedef="' + kacir(hedef) + '" data-ad="' + kacir(ad || "") + '">⚑ Bildir</button>';
}

/* panel: içerik bildirimleri */
const IB_PANEL = { liste: null, hata: "" };
function ibPanelYukle() {
  if (!y25Hesap()) { return; }
  hesapIstemci.rpc("icerik_bildirimleri_listesi").then(function (r) {
    IB_PANEL.liste = r.error ? [] : (r.data || []);
    IB_PANEL.hata = r.error ? ((typeof hesapHataMetni === "function" && hesapHataMetni(r.error)) || "okunamadı") : "";
    if (yoneticiSekme === "icbildirim") { yoneticiCiz(); }
  });
}
function yoneticiIcerikBildirimleri() {
  if (!y25Hesap()) { return '<p class="oyun-not">Bildirimler sunucuda durur: önce yönetici hesabınla giriş yap (Sen → Hesabın).</p>'; }
  if (IB_PANEL.liste === null) { IB_PANEL.liste = []; ibPanelYukle(); return '<p class="oyun-not">Yükleniyor…</p>'; }
  if (IB_PANEL.hata) { return '<p class="pencere-durum kotu">' + kacir(IB_PANEL.hata) + "</p>"; }
  const l = IB_PANEL.liste;
  const yeni = l.filter(function (x) { return x.durum === "yeni"; }).length;
  return '<p class="oyun-not">Okurların bildirdiği içerikler. İçeriği kaldırmak için evreni/uygulamayı düzenle ya da yayından çıkar, sonra “kaldırıldı” olarak işaretle.</p>' +
    '<div class="gk-ust"><span class="oyun-etiket">' + yeni + " yeni · " + l.length + ' toplam</span><button class="dugme dugme-sade" data-ib-yenile>Yenile</button></div>' +
    (l.length ? '<div class="y-blok-liste">' + l.map(function (x) {
      return '<div class="y-kisi-satir ib-satir ib-' + kacir(x.durum) + '"><div class="y-kisi-ust"><span class="y-blok-baslik">' + kacir(IB_TURLER[x.tur] || x.tur) + " · " + kacir(x.hedef) + "</span>" +
        '<span class="oyun-not">' + kacir(y25Zaman(x.zaman)) + (x.bildiren ? " · @" + kacir(x.bildiren) : "") + " · " + kacir(x.durum) + "</span></div>" +
        (x.neden ? '<p class="ib-neden">' + kacir(x.neden) + "</p>" : "") +
        '<div class="y-kisi-dugmeler">' + (x.adres ? '<a class="dugme dugme-sade" href="' + kacir(/^\/[^\s"<>]*$/.test(x.adres) ? x.adres : "/") + '" target="_blank" rel="noopener">Aç</a>' : "") +
          ["incelendi", "kaldirildi", "yeni"].filter(function (d) { return d !== x.durum; }).map(function (d) {
            return '<button class="dugme dugme-sade" data-ib-karar="' + x.no + '" data-durum="' + d + '">' + ({ incelendi: "İncelendi", kaldirildi: "Kaldırıldı", yeni: "Yeniden aç" })[d] + "</button>";
          }).join("") + "</div></div>";
    }).join("") + "</div>" : '<p class="oyun-not">Henüz bildirim yok.</p>');
}
document.addEventListener("click", function (ev) {
  const k = ev.target.closest && ev.target.closest("[data-ib-karar], [data-ib-yenile]");
  if (!k || !y25Hesap()) { return; }
  if (k.hasAttribute("data-ib-yenile")) { IB_PANEL.liste = null; yoneticiCiz(); return; }
  hesapIstemci.rpc("icerik_bildirim_karar", { p_no: Number(k.dataset.ibKarar), p_durum: k.dataset.durum }).then(function () { IB_PANEL.liste = null; yoneticiCiz(); });
});

/* ==================== 4. haftanın evreni ==================== */

function haftaninEvreni() {
  const h = veri && veri.haftaninEvreni;
  if (!h || !h.id) { return null; }
  const e = ((veri.fanEserleri || {}).evrenler || []).find(function (x) { return x.id === h.id; });
  return e ? { e: e, not: h.not || "", tarih: h.tarih || "" } : null;
}

function haftaninEvreniHtml() {
  const h = haftaninEvreni();
  if (!h) { return ""; }
  return '<div class="hafta-evren"><span class="oyun-etiket">Haftanın evreni</span>' +
    '<button class="hafta-evren-kart" data-evren-git="#/ev/fan/' + kacir(h.e.id) + '"><b>' + kacir(h.e.ad || "Adsız evren") + "</b>" +
      (h.e.yazar ? '<span class="oyun-not">' + kacir(h.e.yazar) + "</span>" : "") +
      "<span>" + kacir(h.not || String(h.e.ozet || "").slice(0, 180)) + "</span></button></div>";
}

function haftaninEvreniCiz() {
  const k = document.querySelector("#kesif");
  if (!k || !veri) { return; }
  let a = document.querySelector("#haftaEvrenAlan");
  const h = haftaninEvreniHtml();
  if (!h) { if (a) { a.remove(); } return; }
  if (!a) { a = document.createElement("div"); a.id = "haftaEvrenAlan"; const s = k.querySelector("#surumNotuAlan"); k.insertBefore(a, s || null); }
  a.innerHTML = h;
}

function yoneticiVitrin() {
  const l = (veri.fanEserleri || {}).evrenler || [];
  const h = veri.haftaninEvreni || {};
  if (!l.length) { return '<p class="oyun-not">Sitede henüz fan evreni yok. Önce bir evreni siteye ekle.</p>'; }
  return '<p class="oyun-not">Seçtiğin evren ana sayfada ve Fan evrenleri keşfinde öne çıkar. Kaydet, sonra Yayınla.</p>' +
    '<div class="kutu-y"><label for="hvSec">Evren</label><select class="kod-giris arac-giris" id="hvSec"><option value="">— yok —</option>' +
      l.map(function (e) { return '<option value="' + kacir(e.id) + '"' + (h.id === e.id ? " selected" : "") + ">" + kacir(e.ad || e.id) + (e.yazar ? " · " + kacir(e.yazar) : "") + "</option>"; }).join("") + "</select>" +
    '<label for="hvNot">Kısa not (isteğe bağlı; boşsa evrenin özeti)</label><textarea class="kod-giris arac-giris" id="hvNot" rows="3" maxlength="240">' + kacir(h.not || "") + "</textarea>" +
    '<button class="dugme" data-hv-kaydet>Haftanın evreni yap</button></div>' +
    (h.id ? '<p class="oyun-not">Şu an: <b>' + kacir((l.find(function (e) { return e.id === h.id; }) || {}).ad || h.id) + "</b>" + (h.tarih ? " · " + kacir(h.tarih) : "") + "</p>" : "");
}
document.addEventListener("click", function (ev) {
  if (!ev.target.closest || !ev.target.closest("[data-hv-kaydet]")) { return; }
  const id = (document.querySelector("#hvSec") || {}).value || "";
  const not = String((document.querySelector("#hvNot") || {}).value || "").trim().slice(0, 240);
  if (id) { veri.haftaninEvreni = { id: id, not: not, tarih: new Date().toISOString().slice(0, 10) }; } else { delete veri.haftaninEvreni; }
  haftaninEvreniCiz();
  if (typeof kesifCiz === "function") { kesifCiz(); }
  yoneticiCiz();
  if (typeof yoneticiDurum === "function") { yoneticiDurum(id ? "Haftanın evreni seçildi — Kaydet, sonra Yayınla" : "Haftanın evreni kaldırıldı — Kaydet, sonra Yayınla", true); }
});

/* ==================== panel: yeni sekmeler, yedek hatırlatması ==================== */

const YEDEK25 = "tentiforapp_son_yedek";   /* bu cihazda son yedek (hesapla eşitlenmez) */
document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-y-yedek-al]")) { try { localStorage.setItem(YEDEK25, String(Date.now())); } catch (_) { /* yok */ } } }, true);

if (typeof yon24Serit === "function") {
  const eskiSerit = yon24Serit;
  window.yon24Serit = function () {
    let h = eskiSerit.apply(this, arguments);
    if (typeof yoneticiAcik === "function" && yoneticiAcik()) {
      let son = 0;
      try { son = Number(localStorage.getItem(YEDEK25)) || 0; } catch (_) { son = 0; }
      const gun = son ? Math.floor((Date.now() - son) / 86400000) : null;
      if (gun === null || gun >= 7) {
        h += '<div class="y-uyari"><b>' + (gun === null ? "Bu cihazdan hiç yedek alınmadı." : gun + " gündür yedek alınmadı.") + "</b> Haftada bir yedek al: " +
          '<button class="dugme dugme-sade y-kucuk" data-y25-yedek>Yedeğe git</button></div>';
      }
    }
    if (IB_SAYI.yeni > 0 && typeof yoneticiSekmeleri === "function" && yoneticiSekmeleri("bakim").indexOf("icbildirim") !== -1) {
      h += '<div class="y-uyari"><b>' + IB_SAYI.yeni + " yeni içerik bildirimi</b> " +
        '<button class="dugme dugme-sade y-kucuk" data-y25-ib>Bak</button></div>';
    }
    return h;
  };
}
const IB_SAYI = { yeni: 0, soruldu: false };
function ibSayiSor() {
  if (IB_SAYI.soruldu || !y25Hesap()) { return; }
  IB_SAYI.soruldu = true;
  hesapIstemci.rpc("icerik_bildirimleri_listesi").then(function (r) {
    if (r.error) { return; }
    IB_SAYI.yeni = (r.data || []).filter(function (x) { return x.durum === "yeni"; }).length;
    if (IB_SAYI.yeni && typeof yon24SeritKoy === "function") { yon24SeritKoy(); }
  });
}
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-y25-yedek], [data-y25-ib]");
  if (!b) { return; }
  yoneticiGrup = "bakim"; yoneticiSekme = b.hasAttribute("data-y25-yedek") ? "yedek" : "icbildirim";
  yoneticiCiz();
});

/* yeni sekmelerin gövdesi (22'deki zincir bilmediği sekmede listeye düşer) ve adları */
if (typeof yoneticiListe === "function") {
  const eskiListe = yoneticiListe;
  window.yoneticiListe = function () {
    if (yoneticiSekme === "icbildirim") { return yoneticiIcerikBildirimleri(); }
    if (yoneticiSekme === "vitrin") { return yoneticiVitrin(); }
    return eskiListe.apply(this, arguments);
  };
}
if (typeof yoneticiForm === "function") {
  const eskiForm = yoneticiForm;
  window.yoneticiForm = function () {
    if (yoneticiSekme === "icbildirim") { return yoneticiIcerikBildirimleri(); }
    if (yoneticiSekme === "vitrin") { return yoneticiVitrin(); }
    return eskiForm.apply(this, arguments);
  };
}
if (typeof yoneticiCiz === "function") {
  const eskiYC25 = yoneticiCiz;
  window.yoneticiCiz = function () {
    if (yoneticiSekme === "icbildirim" || yoneticiSekme === "vitrin") { yoneticiSecili = null; }
    const r = eskiYC25.apply(this, arguments);
    Object.keys(Y25_YENI_SEKMELER).forEach(function (s) {
      const b = document.querySelector('#yoneticiAlan [data-y-sekme="' + s + '"]');
      if (b) { b.textContent = Y25_YENI_SEKMELER[s]; }
    });
    if (typeof panelAcik === "function" && panelAcik()) { ibSayiSor(); }
    return r;
  };
}

/* ==================== 5. sürüm geçmişi (bu cihazda, IndexedDB) ==================== */

const GCM = { db: null, son: {}, EN_COK: 20, ARALIK: 10 * 60 * 1000 };

function gcmDb() {
  if (GCM.db) { return GCM.db; }
  GCM.db = new Promise(function (coz, red) {
    try {
      const i = indexedDB.open("tf-evren-gecmis", 1);
      i.onupgradeneeded = function () { i.result.createObjectStore("evren", { keyPath: "id" }); };
      i.onsuccess = function () { coz(i.result); };
      i.onerror = function () { red(i.error); };
    } catch (e) { red(e); }
  });
  GCM.db.catch(function () { GCM.db = null; });
  return GCM.db;
}

async function gcmListe(id) {
  try {
    const db = await gcmDb();
    return await new Promise(function (coz) {
      const r = db.transaction("evren").objectStore("evren").get(id);
      r.onsuccess = function () { coz((r.result && r.result.liste) || []); };
      r.onerror = function () { coz([]); };
    });
  } catch (_) { return []; }
}

/** Evrenin şu anki hâlini geçmişe koyar. neden: "otomatik" (10 dakikada bir), "geri al", "ortak yazar" … */
async function gcmKaydet(id, neden, zorla) {
  const e = typeof evrenBenimBul === "function" ? evrenBenimBul(id) : null;
  if (!e) { return; }
  if (!zorla && GCM.son[id] && Date.now() - GCM.son[id] < GCM.ARALIK) { return; }
  GCM.son[id] = Date.now();
  const metin = JSON.stringify(e);
  try {
    const db = await gcmDb();
    const liste = await gcmListe(id);
    if (liste.length && liste[0].veri === metin) { return; }
    liste.unshift({ zaman: Date.now(), neden: neden || "otomatik", veri: metin, ad: e.ad || "" });
    await new Promise(function (coz) {
      const t = db.transaction("evren", "readwrite");
      t.objectStore("evren").put({ id: id, liste: liste.slice(0, GCM.EN_COK) });
      t.oncomplete = coz; t.onerror = coz; t.onabort = coz;
    });
  } catch (_) { /* depolama kapalı: geçmiş tutulmaz */ }
}

/** Geçmişteki bir hâle döner (şu anki hâl önce geçmişe konur). */
async function gcmGeriAl(id, zaman) {
  const l = await gcmListe(id);
  const k = l.find(function (x) { return x.zaman === zaman; });
  if (!k) { return false; }
  let eski;
  try { eski = JSON.parse(k.veri); } catch (_) { return false; }
  await gcmKaydet(id, "geri almadan önce", true);
  ORTAK.uyguluyor = true;
  try {
    const liste = fanEserlerim();
    const i = liste.findIndex(function (x) { return x.id === id && x.tur === "evren"; });
    if (i === -1) { return false; }
    eski.id = id;
    if (liste[i].ortak) { eski.ortak = true; }
    eski.guncelleme = new Date().toISOString();
    liste[i] = eski;
    fanEserlerimYaz(liste);
  } finally { ORTAK.uyguluyor = false; }
  ortakYazZamanla(id);
  return true;
}

function gcmKutusu(e) {
  return '<details class="kutu-y gcm-kutu" data-gcm-kutu="' + kacir(e.id) + '"><summary><b>Sürüm geçmişi</b> · geri al</summary>' +
    '<p class="oyun-not">Evreninin son ' + GCM.EN_COK + " hâli bu cihazda saklanır (en çok 10 dakikada bir; geri almadan ve ortak yazarın değişikliğinden önce her zaman). " +
    "Bir hâle dönünce şu anki hâl de geçmişe konur; yani geri almak da geri alınabilir.</p>" +
    '<div class="gcm-liste" id="gcmListe"><p class="oyun-not">Yükleniyor…</p></div></details>';
}

async function gcmListeCiz(id) {
  const k = document.querySelector("#gcmListe");
  if (!k) { return; }
  const l = await gcmListe(id);
  k.innerHTML = l.length ? "<ol>" + l.map(function (x) {
    let ozet = "";
    try { const o = JSON.parse(x.veri); ozet = [((o.kisiler || []).length) + " kişi", (((o.harita || {}).yerler || []).length) + " yer", ((((o.roman || {}).bolumler) || []).length) + " bölüm"].join(" · "); } catch (_) { ozet = ""; }
    return '<li><span><b>' + kacir(y25Zaman(x.zaman)) + "</b> · " + kacir(x.neden) + '<span class="oyun-not"> · ' + kacir(x.ad || "Adsız") + " · " + kacir(ozet) + "</span></span>" +
      '<button class="dugme dugme-sade y-kucuk" data-gcm-don="' + x.zaman + '">Bu hâle dön</button></li>';
  }).join("") + "</ol>" : '<p class="oyun-not">Henüz kayıtlı hâl yok. Evrenini değiştirdikçe burada birikir.</p>';
}

document.addEventListener("toggle", function (ev) {
  const d = ev.target;
  if (d && d.matches && d.matches("[data-gcm-kutu]") && d.open) { gcmListeCiz(d.getAttribute("data-gcm-kutu")); }
}, true);

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-gcm-don]");
  if (!b || typeof EVS === "undefined" || !EVS || EVS.kaynak !== "benim") { return; }
  if (b.dataset.onay !== "1") { b.dataset.onay = "1"; b.textContent = "Emin misin? Dön"; return; }
  const ok = await gcmGeriAl(EVS.id, Number(b.getAttribute("data-gcm-don")));
  if (ok) { evrenSayfaCiz(); if (typeof eckaBildir === "function") { eckaBildir("Evren o hâline döndü · önceki hâl de geçmişte"); } }
});

/* ==================== 6. ortak yazarlık ==================== */

const ORTAK = { uyguluyor: false, zamanlayici: {}, bekleyen: {}, uyeler: {}, davet: {} };
const ORTAK_TABAN = "tentiforapp_ortak_taban";   /* { evrenId: sunucudaki hâlin zamanı } — cihaza özel */

if (typeof ESITLEME_DISI !== "undefined" && ESITLEME_DISI.indexOf(ORTAK_TABAN) === -1) { ESITLEME_DISI.push(ORTAK_TABAN); }

function ortakTaban(id, deger) {
  const d = jsonOku(ORTAK_TABAN, {}) || {};
  if (deger === undefined) { return d[id] || null; }
  if (deger === null) { delete d[id]; } else { d[id] = deger; }
  jsonYaz(ORTAK_TABAN, d);
  return deger;
}

/** Sunucuya giden hâl: evrenin kendisi (yerel işaretler hariç). */
function ortakGonderim(e) { const o = JSON.parse(JSON.stringify(e)); delete o.ortak; return o; }

/** Sunucudan gelen hâl: sitedeki fan evrenleri gibi temizlenir. */
function ortakTemizle(ham, id) {
  const t = typeof fanTemizle === "function" ? fanTemizle(Object.assign({}, ham, { bicim: typeof FAN_BICIM !== "undefined" ? FAN_BICIM : ham.bicim, tur: "evren" })) : null;
  if (!t) { return null; }
  t.id = id; t.ortak = true;
  return t;
}

function ortakYerelYaz(id, t) {
  ORTAK.uyguluyor = true;
  try {
    const l = fanEserlerim();
    const i = l.findIndex(function (x) { return x.id === id && x.tur === "evren"; });
    if (i === -1) { l.unshift(t); } else { l[i] = t; }
    fanEserlerimYaz(l);
  } finally { ORTAK.uyguluyor = false; }
}

function ortakYazZamanla(id) {
  const e = evrenBenimBul(id);
  if (!e || !e.ortak || !y25Hesap()) { return; }
  ORTAK.bekleyen[id] = true;
  clearTimeout(ORTAK.zamanlayici[id]);
  ORTAK.zamanlayici[id] = setTimeout(function () { ortakYaz(id); }, 2500);
}

async function ortakYaz(id) {
  const e = evrenBenimBul(id);
  if (!e || !e.ortak || !y25Hesap()) { return; }
  try {
    const r = await hesapIstemci.rpc("ortak_evren_yaz", { p_id: id, p_veri: ortakGonderim(e), p_taban: ortakTaban(id) });
    const d = (!r.error && r.data) || {};
    if (d.durum === "tamam") { ORTAK.bekleyen[id] = false; ortakTaban(id, d.guncelleme); ortakDurumYaz("Kaydedildi · ortak yazarlar görür", true); return; }
    if (d.durum === "catisma") { await ortakUzaktanUygula(id, d, true); return; }
    if (d.durum === "yetki") {
      ORTAK.uyguluyor = true;
      try { evrenBenimDegistir(id, function (x) { delete x.ortak; }); } finally { ORTAK.uyguluyor = false; }
      ortakTaban(id, null);
      if (typeof eckaBildir === "function") { eckaBildir("Bu evrenin ortak yazarlığı kapandı; kopyası sende kaldı."); }
      if (EVS && EVS.id === id) { evrenSayfaCiz(); }
    }
  } catch (_) { ortakDurumYaz("Kaydedilemedi (çevrimdışı?); bağlantı gelince yeniden denenecek", false); }
}

/** Başka yazarın hâlini uygular; bu cihazdaki hâl önce sürüm geçmişine konur. */
async function ortakUzaktanUygula(id, d, catisma) {
  const t = ortakTemizle(d.veri || {}, id);
  if (!t) { return; }
  await gcmKaydet(id, "ortak yazardan önce", true);
  ortakYerelYaz(id, t);
  ORTAK.bekleyen[id] = false;
  ortakTaban(id, d.guncelleme);
  if (typeof eckaBildir === "function" && catisma) {
    eckaBildir((d.guncelleyen ? d.guncelleyen : "Ortak yazar") + " bu arada değiştirmiş: onun hâli yüklendi, seninki sürüm geçmişinde.");
  }
  if (typeof EVS !== "undefined" && EVS && EVS.id === id && EVS.kaynak === "benim") { evrenSayfaCiz(); }
}

async function ortakCek(id) {
  if (!y25Hesap()) { return; }
  try {
    const r = await hesapIstemci.rpc("ortak_evren_getir", { p_id: id });
    const d = (!r.error && r.data) || {};
    if (d.durum !== "tamam") { return; }
    const taban = ortakTaban(id);
    if (!taban || new Date(d.guncelleme) > new Date(taban)) {
      if (ORTAK.bekleyen[id]) { return; }   /* gönderilmemiş değişiklik var: gönderince çatışma olarak çözülür */
      await ortakUzaktanUygula(id, d, false);
    }
  } catch (_) { /* çevrimdışı */ }
}

function ortakDurumYaz(m, iyi) { y25Durum("#ortakDurum", m, iyi); }

if (typeof evrenBenimDegistir === "function") {
  const eskiBD = evrenBenimDegistir;
  window.evrenBenimDegistir = function (id) {
    if (!ORTAK.uyguluyor) { gcmKaydet(id, "otomatik"); }
    const r = eskiBD.apply(this, arguments);
    if (!ORTAK.uyguluyor) { ortakYazZamanla(id); }
    return r;
  };
}

async function ortakAc(id) {
  const e = evrenBenimBul(id);
  if (!e || !y25Hesap()) { return "Önce giriş yap."; }
  const r = await hesapIstemci.rpc("ortak_evren_ac", { p_id: id, p_veri: ortakGonderim(e) });
  const d = (!r.error && r.data) || {};
  if (d.durum !== "tamam") { return ({ baskasinin: "Bu kimlikte başka birinin ortak evreni var.", sinir: "En çok 20 evreni ortak yazarlığa açabilirsin.", giris: "Önce giriş yap." })[d.durum] || "Açılamadı (kurulum.sql güncel mi?)"; }
  ORTAK.uyguluyor = true;
  try { eskiDegistirDogrudan(id, function (x) { x.ortak = true; }); } finally { ORTAK.uyguluyor = false; }
  ortakTaban(id, d.guncelleme);
  return "";
}
function eskiDegistirDogrudan(id, fn) {
  const l = fanEserlerim();
  const e = l.find(function (x) { return x.id === id && x.tur === "evren"; });
  if (!e) { return; }
  fn(e);
  fanEserlerimYaz(l);
}

function ortakDavetKodu() { return "ORT-" + kod10(); }
function ortakDavetOzet(kod) { return onaltilik(sha256Bayt(metniBayta(String(kod || "").trim().toUpperCase() + "#ortak"))); }

async function ortakKatil(kod, durum) {
  const yaz = function (m, iyi) { if (durum) { durum.textContent = m; durum.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };
  if (!y25Hesap()) { yaz("Ortak yazar davet kodu: önce giriş yap, kod hesabına bağlanır.", false); return; }
  yaz("Davet denetleniyor…", true);
  try {
    const r = await hesapIstemci.rpc("ortak_evren_katil", { p_kod: kod });
    const d = (!r.error && r.data) || {};
    if (d.durum !== "tamam") {
      yaz(({ yok: "Bu davet kodu geçersiz.", dolu: "Bu davet başka bir hesapta kullanıldı.", sinir: "Çok deneme yaptın; bir saat sonra dene.", giris: "Önce giriş yap." })[d.durum] || "Davet denetlenemedi.", false);
      return;
    }
    const t = ortakTemizle(d.veri || {}, d.id);
    if (!t) { yaz("Evren okunamadı.", false); return; }
    ortakYerelYaz(d.id, t);
    ortakTaban(d.id, d.guncelleme);
    yaz("Artık “" + (t.ad || "evren") + "” evreninin ortak yazarısın.", true);
    setTimeout(function () { if (typeof perdeKapat === "function") { perdeKapat(); } location.hash = "#/ev/benim/" + d.id; }, 1100);
  } catch (_) { yaz("Sunucuya ulaşılamadı.", false); }
}

if (typeof sonraSar === "function") {
  sonraSar("kodDene", function (eski) {
    return function (ham) {
      const kod = String(ham || "").trim().toUpperCase();
      if (/^ORT-[A-Z0-9]{8,}$/.test(kod)) { ortakKatil(kod, document.querySelector("#kodDurum")); return; }
      return eski.apply(this, arguments);
    };
  });
}

/* girişte: başka cihazda katıldığın ortak evrenler bu cihaza da gelsin */
if (typeof hesapProfilYukle === "function") {
  const eskiPY25 = hesapProfilYukle;
  window.hesapProfilYukle = async function () {
    const r = await eskiPY25.apply(this, arguments);
    setTimeout(ortakEvrenlerimiCek, 1500);
    return r;
  };
}
async function ortakEvrenlerimiCek() {
  if (!y25Hesap()) { return; }
  try {
    const r = await hesapIstemci.rpc("ortak_evrenlerim");
    if (r.error || !Array.isArray(r.data)) { return; }
    for (const x of r.data) { if (!evrenBenimBul(x.id) || !ortakTaban(x.id)) { await ortakCek(x.id); } }
  } catch (_) { /* yok */ }
}

async function ortakUyeleriYukle(id) {
  if (!y25Hesap()) { return; }
  try {
    const r = await hesapIstemci.rpc("ortak_evren_uyeler", { p_id: id });
    ORTAK.uyeler[id] = r.error ? [] : (r.data || []);
  } catch (_) { ORTAK.uyeler[id] = []; }
  /* kurucu mu yazar mı artık belli: kutunun düğmeleri de ona göre */
  const k = document.querySelector("#evrenSayfa .ortak-kutu");
  const e = evrenBenimBul(id);
  if (k && e && typeof EVS !== "undefined" && EVS && EVS.id === id) { k.outerHTML = ortakKutusu(e); }
}

function ortakSahipMi(id) { return (ORTAK.uyeler[id] || []).some(function (u) { return u.ben && u.rol === "sahip"; }); }

function ortakUyelerHtml(id) {
  const l = ORTAK.uyeler[id];
  if (!l) { return '<p class="oyun-not">Yazarlar yükleniyor…</p>'; }
  const sahip = ortakSahipMi(id);
  return "<ul>" + l.map(function (u) {
    return "<li><b>" + kacir(u.ad) + "</b>" + (u.kullanici_adi ? ' <span class="oyun-not">@' + kacir(u.kullanici_adi) + "</span>" : "") +
      ' <span class="oyun-not">· ' + (u.rol === "sahip" ? "kurucu" : "yazar") + (u.ben ? " · sen" : "") + "</span>" +
      (sahip && !u.ben ? ' <button class="ic-bag" data-ortak-cikar="' + kacir(u.id) + '">çıkar</button>' : "") + "</li>";
  }).join("") + "</ul>";
}

function ortakKutusu(e) {
  if (!y25Hesap()) {
    return '<div class="kutu-y ortak-kutu"><span class="oyun-etiket">Ortak yazarlık</span><p class="oyun-not">Evrenini başka biriyle birlikte yazmak için giriş yap.</p></div>';
  }
  if (!e.ortak) {
    return '<div class="kutu-y ortak-kutu"><span class="oyun-etiket">Ortak yazarlık</span>' +
      '<p class="oyun-not">Evrenini bir arkadaşınla birlikte yaz: ona tek kullanımlık bir davet kodu verirsin, evren onun hesabına da gelir. ' +
      "İkiniz de değiştirebilirsiniz; aynı anda değiştirirseniz son kaydeden kazanır, öbür hâl sürüm geçmişine düşer.</p>" +
      '<button class="dugme" data-ortak-ac>Ortak yazarlığa aç</button><p class="pencere-durum" id="ortakDurum" role="status"></p></div>';
  }
  if (!ORTAK.uyeler[e.id]) { setTimeout(function () { ortakUyeleriYukle(e.id); }, 0); }
  const sahip = ortakSahipMi(e.id);
  const davet = ORTAK.davet[e.id];
  return '<div class="kutu-y ortak-kutu"><span class="oyun-etiket">Ortak yazarlık · açık</span>' +
    '<div id="ortakUyeler">' + ortakUyelerHtml(e.id) + "</div>" +
    '<div class="oyun-sira">' + (sahip ? '<button class="dugme" data-ortak-davet>Davet kodu üret</button>' : "") +
      '<button class="dugme dugme-sade" data-ortak-cek>Şimdi eşitle</button>' +
      '<button class="dugme dugme-sade y-sil" data-ortak-ayril>' + (sahip ? "Ortaklığı kapat" : "Ortaklıktan ayrıl") + "</button></div>" +
    (davet ? '<div class="y-kod-kutu"><p class="oyun-not"><b>Kod yalnızca şimdi görünür.</b> Tek kişi içindir.</p>' +
      '<input class="kod-giris arac-giris" readonly value="' + kacir(davet) + '" id="ortakDavetKod">' +
      '<input class="kod-giris arac-giris" readonly value="' + kacir(typeof tekDavetBaglantisi === "function" ? tekDavetBaglantisi(davet) : davet) + '" id="ortakDavetBag">' +
      '<button class="dugme dugme-sade" data-ortak-kopyala>Bağlantıyı kopyala</button></div>' : "") +
    '<p class="pencere-durum" id="ortakDurum" role="status"></p></div>';
}

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-ortak-ac], [data-ortak-davet], [data-ortak-cek], [data-ortak-ayril], [data-ortak-cikar], [data-ortak-kopyala]");
  if (!b || typeof EVS === "undefined" || !EVS || EVS.kaynak !== "benim") { return; }
  const id = EVS.id;
  if (b.hasAttribute("data-ortak-ac")) {
    b.disabled = true;
    const h = await ortakAc(id);
    if (h) { ortakDurumYaz(h, false); b.disabled = false; return; }
    ORTAK.uyeler[id] = null;
    evrenSayfaCiz();
    return;
  }
  if (b.hasAttribute("data-ortak-davet")) {
    const kod = ortakDavetKodu();
    const r = await hesapIstemci.rpc("ortak_evren_davet", { p_id: id, p_ozet: ortakDavetOzet(kod) });
    const d = (!r.error && r.data) || {};
    if (d.durum !== "tamam") { ortakDurumYaz(({ sinir: "Kullanılmamış 20 davet var; önce onlar kullanılsın.", yetki: "Davet yalnızca kurucudan." })[d.durum] || "Davet üretilemedi.", false); return; }
    ORTAK.davet[id] = kod;
    evrenSayfaCiz();
    return;
  }
  if (b.hasAttribute("data-ortak-kopyala")) { if (typeof panoyaKopyala === "function") { panoyaKopyala((document.querySelector("#ortakDavetBag") || {}).value || ""); } return; }
  if (b.hasAttribute("data-ortak-cek")) { await ortakCek(id); if (ORTAK.bekleyen[id]) { await ortakYaz(id); } ortakDurumYaz("Eşitlendi", true); return; }
  if (b.hasAttribute("data-ortak-ayril") || b.dataset.ortakCikar) {
    if (b.dataset.onay !== "1") { b.dataset.onay = "1"; b.textContent = "Emin misin?"; return; }
    const hedef = b.dataset.ortakCikar || hesapKullanici.id;
    await hesapIstemci.rpc("ortak_evren_cikar", { p_id: id, p_kullanici: hedef });
    if (!b.dataset.ortakCikar) {
      ORTAK.uyguluyor = true;
      try { eskiDegistirDogrudan(id, function (x) { delete x.ortak; }); } finally { ORTAK.uyguluyor = false; }
      ortakTaban(id, null);
    }
    ORTAK.uyeler[id] = null;
    evrenSayfaCiz();
  }
});

/* ==================== 7. evren istatistikleri ==================== */

const EVI = { sayilan: {}, onbellek: {} };

function evrenSay(ad) {
  try {
    if (typeof EVS === "undefined" || !EVS || EVS.kaynak !== "fan" || onizlemeMi()) { return; }
    if (typeof evrenKendisininMi === "function" && evrenKendisininMi(EVS.id)) { return; }
    if (typeof HESAP_AYAR === "undefined" || !HESAP_AYAR.url || !HESAP_AYAR.anahtar) { return; }
    if (location.protocol.indexOf("http") !== 0 || /^(localhost|127\.)/.test(location.hostname) && !window.__olayTest) { return; }
    const evren = "ev:" + EVS.id;
    const k = evren + "|" + ad;
    try { if (sessionStorage.getItem("tf-evi|" + k)) { return; } sessionStorage.setItem("tf-evi|" + k, "1"); } catch (_) { if (EVI.sayilan[k]) { return; } EVI.sayilan[k] = true; }
    fetch(HESAP_AYAR.url + "/rest/v1/rpc/evren_say", {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", apikey: HESAP_AYAR.anahtar, Authorization: "Bearer " + HESAP_AYAR.anahtar },
      body: JSON.stringify({ p_evren: evren, p_ad: ad })
    }).catch(function () { /* kurulmamış */ });
  } catch (_) { /* sayaç hiçbir şeyi bozmasın */ }
}

let eviSonSekme = "";
if (typeof evrenSayfaCiz === "function") {
  const eskiCiz25 = evrenSayfaCiz;
  window.evrenSayfaCiz = function () {
    const r = eskiCiz25.apply(this, arguments);
    if (typeof EVS !== "undefined" && EVS) {
      const k = EVS.kaynak + ":" + EVS.id + ":" + EVS.sekme;
      if (k !== eviSonSekme) { eviSonSekme = k; evrenSay("ziyaret"); evrenSay("sekme:" + String(EVS.sekme).replace(/[^a-z0-9]/g, "").slice(0, 30)); }
      y25EvrenEkleri();
    } else { eviSonSekme = ""; }
    return r;
  };
}
document.addEventListener("click", function (ev) {
  const o = ev.target.closest && ev.target.closest("[data-evo-basla], [data-evu-ac]");
  if (!o) { return; }
  if (o.dataset.evoBasla) { evrenSay("oyun:" + o.dataset.evoBasla.replace(/[^a-z0-9]/g, "").slice(0, 30)); } else { evrenSay("uygulama"); }
});

async function eviYukle(id) {
  if (typeof HESAP_AYAR === "undefined" || !HESAP_AYAR.url) { return null; }
  if (EVI.onbellek[id] && Date.now() - EVI.onbellek[id].t < 60000) { return EVI.onbellek[id].l; }
  try {
    const y = await fetch(HESAP_AYAR.url + "/rest/v1/rpc/evren_istatistik", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: HESAP_AYAR.anahtar, Authorization: "Bearer " + HESAP_AYAR.anahtar },
      body: JSON.stringify({ p_evren: "ev:" + id, p_gun: 30 })
    });
    const l = y.ok ? await y.json() : null;
    EVI.onbellek[id] = { t: Date.now(), l: Array.isArray(l) ? l : [] };
    return EVI.onbellek[id].l;
  } catch (_) { return null; }
}

function eviHtml(l) {
  if (l === null) { return '<p class="oyun-not">İstatistik şu an alınamadı (sunucu kurulu değil ya da çevrimdışısın).</p>'; }
  if (!l.length) { return '<p class="oyun-not">Son 30 günde kayıt yok. Evrenin sitede yayımlanınca ziyaretler burada görünür (kendi ziyaretlerin sayılmaz).</p>'; }
  const gunler = {}, adlar = {};
  l.forEach(function (x) {
    if (x.ad === "ziyaret") { gunler[x.gun] = (gunler[x.gun] || 0) + x.sayi; }
    adlar[x.ad] = (adlar[x.ad] || 0) + x.sayi;
  });
  const toplam = adlar.ziyaret || 0;
  const bugun = new Date();
  const seri = [];
  for (let i = 29; i >= 0; i--) { const g = new Date(bugun.getTime() - i * 86400000).toISOString().slice(0, 10); seri.push([g, gunler[g] || 0]); }
  const enCok = Math.max(1, Math.max.apply(null, seri.map(function (x) { return x[1]; })));
  const sutun = seri.map(function (x, i) {
    const y = Math.round((x[1] / enCok) * 56);
    return '<rect x="' + (i * 10 + 1) + '" y="' + (60 - y) + '" width="8" height="' + Math.max(y, x[1] ? 2 : 0) + '" rx="2" fill="var(--deniz)"><title>' + x[0] + ": " + x[1] + " ziyaret</title></rect>";
  }).join("");
  const ad = function (k) { return k.replace(/^sekme:/, "Sekme · ").replace(/^oyun:/, "Oyun · ").replace(/^uygulama$/, "Uygulama açıldı").replace(/^ziyaret$/, "Ziyaret"); };
  const en = Object.keys(adlar).filter(function (k) { return k !== "ziyaret"; }).sort(function (a, b) { return adlar[b] - adlar[a]; }).slice(0, 6);
  return '<p class="evi-toplam"><b>' + toplam + "</b> ziyaret · son 30 gün</p>" +
    '<svg class="evi-grafik" viewBox="0 0 300 62" role="img" aria-label="Son 30 günün günlük ziyaretleri">' + '<line x1="0" y1="60.5" x2="300" y2="60.5" stroke="var(--sig)"/>' + sutun + "</svg>" +
    (en.length ? '<table class="evi-tablo"><tbody>' + en.map(function (k) { return "<tr><td>" + kacir(ad(k)) + "</td><td>" + adlar[k] + "</td></tr>"; }).join("") + "</tbody></table>" : "");
}

function eviKutusu(e) {
  setTimeout(function () {
    eviYukle(e.id).then(function (l) { const k = document.querySelector("#eviAlan"); if (k) { k.innerHTML = eviHtml(l); } });
  }, 0);
  return '<div class="kutu-y evi-kutu"><span class="oyun-etiket">İstatistik</span><div id="eviAlan"><p class="oyun-not">Yükleniyor…</p></div></div>';
}

/* ==================== 8. evren önizleme ==================== */

/* Önizleme: evren, sitedeki bir fan evreni gibi (kaynak "fan") ama kurucunun bu cihazdaki hâliyle açılır.
   Böylece ziyaretçiye özel her dal (gizli sekmeler, ödül engeli, bağlar, şehir yolları) kendiliğinden işler.
   Adres: #/ev/onizle/<id> */
const ONZ = { bekleyen: null };
function onizlemeMi() { return typeof EVS !== "undefined" && !!EVS && EVS.kaynak === "fan" && (EVS.onizle === true || ONZ.bekleyen === EVS.id); }

if (typeof evrenSayfaVerisi === "function") {
  const eskiSV = evrenSayfaVerisi;
  window.evrenSayfaVerisi = function () {
    if (onizlemeMi()) {
      const e = evrenBenimBul(EVS.id);
      return e ? { eser: e, duzenle: false, rozet: "Önizleme · ziyaretçiler böyle görür", onizle: true } : null;
    }
    return eskiSV.apply(this, arguments);
  };
}
if (typeof evrenSayfaAc === "function") {
  const eskiAcOnz = evrenSayfaAc;
  window.evrenSayfaAc = function (kaynak, id) {
    if (kaynak !== "onizle") { return eskiAcOnz.apply(this, arguments); }
    if (!evrenBenimBul(id)) { return eskiAcOnz.call(this, "benim", id); }
    ONZ.bekleyen = id;
    try { eskiAcOnz.call(this, "fan", id); } finally { ONZ.bekleyen = null; }
    if (EVS && EVS.id === id) { EVS.onizle = true; evrenSayfaCiz(); }
  };
}
if (typeof evoOdulEngeli === "function") {
  const eskiOE = evoOdulEngeli;
  window.evoOdulEngeli = function () {
    if (onizlemeMi()) { return "Önizlemede ödül yok; ziyaretçiler oynayınca kazanır."; }
    return eskiOE.apply(this, arguments);
  };
}

/** Evren sayfasına 2.5 kutuları: kurucuya (bilgi sekmesi) ve okura. */
function y25EvrenEkleri() {
  const g = document.querySelector("#evrenSayfa .evs-govde");
  if (!g || typeof EVS === "undefined" || !EVS) { return; }
  const v = evrenSayfaVerisi();
  if (!v || !v.eser) { return; }
  const e = v.eser;
  if (onizlemeMi() && !g.querySelector(".onizle-serit")) {
    g.insertAdjacentHTML("afterbegin", '<div class="onizle-serit" role="status"><b>Önizleme</b> · evrenin ziyaretçilere böyle görünür (gizlediğin sekmeler yok, ödül yok) ' +
      '<button class="dugme dugme-sade y-kucuk" data-ev-onizle-cik>Düzenlemeye dön</button></div>');
  }
  if (EVS.sekme !== "bilgi") { return; }
  if (EVS.kaynak === "benim" && !g.querySelector(".y25-kurucu")) {
    g.insertAdjacentHTML("beforeend", '<div class="y25-kurucu">' +
      '<div class="kutu-y"><span class="oyun-etiket">Ziyaretçi gözüyle</span><p class="oyun-not">Evrenini ziyaretçilerin göreceği gibi aç: gizlediğin sekmeler görünmez, düzenleme araçları yoktur.</p>' +
        '<button class="dugme dugme-sade" data-ev-onizle>👁 Önizle</button></div>' +
      ortakKutusu(e) + gcmKutusu(e) + eviKutusu(e) + "</div>");
  }
  if (EVS.kaynak === "fan" && !onizlemeMi() && !g.querySelector(".ib-evren")) {
    g.insertAdjacentHTML("beforeend", '<p class="oyun-not ib-evren">Bu evrende uygunsuz bir şey mi var? ' + ibDugme("evren", "fan:" + e.id, e.ad) + "</p>");
  }
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-ev-onizle], [data-ev-onizle-cik]");
  if (!b || typeof EVS === "undefined" || !EVS) { return; }
  const id = EVS.id;
  if (b.hasAttribute("data-ev-onizle") && EVS.kaynak !== "benim") { return; }
  evrenSonrakiSekme = EVS.sekme;   /* önizlemeye girip çıkarken aynı sekmede kal */
  evrenSayfaAc(b.hasAttribute("data-ev-onizle") ? "onizle" : "benim", id);
  const s = document.querySelector("#evrenSayfa"); if (s) { s.scrollTop = 0; }
});

/* kişiselleştir kutusuna önizleme düğmesi */
if (typeof evrenBilgiBolumu === "function") {
  const eskiBilgi25 = evrenBilgiBolumu;
  window.evrenBilgiBolumu = function () {
    const h = eskiBilgi25.apply(this, arguments);
    return h.replace('<button class="dugme dugme-sade" data-evs-sekme="uygulama">⌨ Uygulama ekle</button>',
      '<button class="dugme dugme-sade" data-evs-sekme="uygulama">⌨ Uygulama ekle</button><button class="dugme dugme-sade" data-ev-onizle>👁 Ziyaretçi gibi gör</button>');
  };
}

/* uygulama çerçevesinin altında bildir */
if (typeof evuCalistir === "function") {
  const eskiEvu = evuCalistir;
  window.evuCalistir = function (kap, e, u) {
    const r = eskiEvu.apply(this, arguments);
    if (typeof EVS !== "undefined" && EVS && EVS.kaynak === "fan" && !onizlemeMi() && kap && kap.parentNode && !kap.parentNode.querySelector(".ib-uygulama")) {
      kap.insertAdjacentHTML("afterend", '<p class="oyun-not ib-uygulama">' + ibDugme("uygulama", "fan:" + EVS.id + "/" + u.id, u.ad) + "</p>");
    }
    return r;
  };
}

/* keşif: önizleme kartı, cihazda işareti, haftanın evreni */
function kesif25Onizle(id) {
  const oz = ((veri.fanEserleri || {}).evrenler || []).find(function (x) { return x.id === id; });
  const p = document.querySelector("#perde");
  if (!oz || !p) { return; }
  const ciz = function (tam) {
    const s = (oz.sayilar || {});
    const h = tam && tam.harita && (tam.harita.yerler || []).length && typeof evrenHaritaSvg === "function" ? evrenHaritaSvg(tam.harita, { alfabe: tam.alfabe }) : "";
    const bolumler = tam && tam.roman && Array.isArray(tam.roman.bolumler) ? tam.roman.bolumler : [];
    const indirildi = typeof evdIndirilenler === "function" && evdIndirilenler()[id];
    p.innerHTML = '<div class="pencere pencere-genis kesif-onizle" role="dialog" aria-modal="true" aria-labelledby="koBaslik">' +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      '<h3 id="koBaslik">' + kacir(oz.ad || "Adsız evren") + "</h3>" +
      '<p class="pencere-alt">' + kacir(oz.yazar || "") + (indirildi ? " · 📥 cihazda" : "") + "</p>" +
      (oz.ozet ? "<p>" + kacir(oz.ozet) + "</p>" : "") +
      (h ? '<div class="ko-harita">' + h + "</div>" : (tam ? "" : '<p class="oyun-not">Harita yükleniyor…</p>')) +
      '<p class="kesif-sayi">' + [[s.kisi, "kişi"], [s.yer, "yer"], [s.kural, "kural"], [s.bolum, "bölüm"], [s.cizim, "çizim"]].filter(function (x) { return x[0]; }).map(function (x) { return x[0] + " " + x[1]; }).join(" · ") + "</p>" +
      (bolumler.length ? '<p class="oyun-not">İlk bölüm: <b>' + kacir(bolumler[0].baslik || "Bölüm 1") + "</b></p>" : "") +
      '<div class="oyun-sira"><button class="dugme" data-kapat="1" data-evren-git="#/ev/fan/' + kacir(id) + '">Evrene gir</button>' +
        (typeof evdDosyali === "function" && evdDosyali(oz) ? '<button class="dugme dugme-sade" data-ko-indir="' + kacir(id) + '">' + (indirildi ? "Cihazda güncelle" : "📥 Cihaza indir") + "</button>" : "") + "</div>" +
      '<p class="pencere-durum" id="koDurum" role="status"></p></div>';
    p.hidden = false;
  };
  ciz(typeof evdDosyali === "function" && evdDosyali(oz) ? (typeof EVD_BELLEK !== "undefined" ? EVD_BELLEK[id] : null) : oz);
  if (typeof evdDosyali === "function" && evdDosyali(oz) && !(typeof EVD_BELLEK !== "undefined" && EVD_BELLEK[id])) {
    evdYukle(oz).then(function (t) { if (!p.hidden && p.querySelector(".kesif-onizle")) { ciz(t); } }, function () { /* çevrimdışı */ });
  }
}
document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-kesif-onizle], [data-ko-indir]");
  if (!b) { return; }
  ev.preventDefault();
  if (b.dataset.kesifOnizle) { kesif25Onizle(b.dataset.kesifOnizle); return; }
  b.disabled = true;
  let h = "";
  try { h = await evdCevrimdisiIndir(b.dataset.koIndir); } catch (e) { h = (e && e.message) || "İndirilemedi"; }
  y25Durum("#koDurum", h || "Cihaza indirildi: internet yokken de açılır.", !h);
  b.disabled = false;
  if (typeof kesifCiz === "function") { kesifCiz(); }
});

if (typeof kesifCiz === "function") {
  const eskiKC = kesifCiz;
  window.kesifCiz = function () {
    const r = eskiKC.apply(this, arguments);
    const indirilen = typeof evdIndirilenler === "function" ? evdIndirilenler() : {};
    document.querySelectorAll("#evrenKesif .kesif-kart").forEach(function (k) {
      const m = /#\/ev\/fan\/([\w-]+)$/.exec(k.getAttribute("data-evren-git") || "");
      if (!m || k.parentNode.classList.contains("kesif-sar")) { return; }
      const sar = document.createElement("div");
      sar.className = "kesif-sar";
      k.parentNode.insertBefore(sar, k);
      sar.appendChild(k);
      sar.insertAdjacentHTML("beforeend", '<div class="kesif-alt">' + (indirilen[m[1]] ? '<span class="oyun-not">📥 cihazda</span>' : "<span></span>") +
        '<button class="ic-bag" data-kesif-onizle="' + kacir(m[1]) + '">Önizle</button></div>');
    });
    const kutu = document.querySelector("#evrenKesif");
    if (kutu) {
      const eski = kutu.querySelector(".hafta-evren"); if (eski) { eski.remove(); }
      const h = haftaninEvreniHtml();
      if (h) { kutu.insertAdjacentHTML("afterbegin", h); }
    }
    return r;
  };
}

/* ==================== 9. okuma listesi ve kaldığın yer ==================== */

const OKL = "tentiforapp_okuma_listem";   /* { anahtar: { ad, git, bolum, sira, toplam, zaman, liste, bitti } } */
if (typeof ESIT_BIRLESIM !== "undefined" && ESIT_BIRLESIM.indexOf(OKL) === -1) { ESIT_BIRLESIM.push(OKL); }

let oklAcilis = null, oklDevamBolum = null;
if (typeof evrenSayfaKapat === "function") {
  const eskiKapatOkl = evrenSayfaKapat;
  window.evrenSayfaKapat = function () { oklAcilis = null; return eskiKapatOkl.apply(this, arguments); };
}

function oklOku() { const d = jsonOku(OKL, {}); return d && typeof d === "object" && !Array.isArray(d) ? d : {}; }
function oklAnahtar() { return EVS.kaynak + ":" + EVS.id; }

if (typeof evrenRomanBolumu === "function") {
  const eskiRB = evrenRomanBolumu;
  window.evrenRomanBolumu = function (v) {
    const okur = (EVS.kaynak !== "benim" || (typeof evrDurum === "function" && evrDurum().onizle));
    const kaydet = !onizlemeMi() && EVS.kaynak !== "benim";
    if (!okur || EVS.kaynak === "e99") { return eskiRB.apply(this, arguments); }
    const d = evrDurum();
    const k = oklAnahtar();
    const l = oklOku();
    const bolumler = ((v.eser.roman || {}).bolumler) || [];
    if (d.secili === null && l[k] && l[k].bolum && bolumler.some(function (b) { return b.id === l[k].bolum; })) { d.secili = l[k].bolum; }
    /* evren her açıldığında ilk roman görünümünde: kaldığın yer */
    if (oklAcilis !== k) {
      oklAcilis = k;
      oklDevamBolum = kaydet && l[k] && l[k].bolum === d.secili && l[k].sira > 0 ? d.secili : null;
    }
    const devam = !!oklDevamBolum && oklDevamBolum === d.secili;   /* başka bölüme geçene kadar */
    const h = eskiRB.apply(this, arguments);
    if (!bolumler.length) { return h; }
    const i = Math.max(0, bolumler.findIndex(function (b) { return b.id === d.secili; }));
    const o = l[k] || {};
    const kayit = { ad: v.eser.ad || "Evren", git: "#/ev/" + EVS.kaynak + "/" + EVS.id, bolum: bolumler[i].id, sira: i, toplam: bolumler.length,
      zaman: Date.now(), liste: !!o.liste, bitti: !!o.bitti || i === bolumler.length - 1 };
    if (kaydet && (o.bolum !== kayit.bolum || o.toplam !== kayit.toplam || o.bitti !== kayit.bitti)) { l[k] = kayit; jsonYaz(OKL, l); }
    const listede = !!(l[k] && l[k].liste);
    return '<div class="okl-serit">' + (devam ? '<span class="oyun-not">📖 Kaldığın yerden: ' + (i + 1) + ". bölüm</span>" : '<span class="oyun-not">' + (i + 1) + " / " + bolumler.length + "</span>") +
      (!kaydet ? "" : '<button class="dugme dugme-sade y-kucuk" data-okl-liste>' + (listede ? "✓ Okuma listende" : "+ Okuma listeme ekle") + "</button>") + "</div>" + h;
  };
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-okl-liste], [data-okl-cikar], [data-okl-devam]");
  if (!b) { return; }
  const l = oklOku();
  if (b.hasAttribute("data-okl-liste") && typeof EVS !== "undefined" && EVS) {
    const k = oklAnahtar();
    if (!l[k]) { const v = evrenSayfaVerisi(); l[k] = { ad: (v && v.eser.ad) || "Evren", git: "#/ev/" + EVS.kaynak + "/" + EVS.id, zaman: Date.now() }; }
    l[k].liste = !l[k].liste;
    jsonYaz(OKL, l);
    evrenSayfaCiz();
    return;
  }
  if (b.dataset.oklCikar) { if (l[b.dataset.oklCikar]) { l[b.dataset.oklCikar].liste = false; jsonYaz(OKL, l); } ayar25Ciz(); return; }
  if (b.dataset.oklDevam) {
    const x = l[b.dataset.oklDevam];
    if (x && x.git) { evrenSonrakiSekme = "roman"; location.hash = x.git; }
  }
});

function oklHtml() {
  const l = oklOku();
  const k = Object.keys(l).filter(function (x) { return l[x] && (l[x].liste || (l[x].bolum && !l[x].bitti)); })
    .sort(function (a, b) { return (l[b].zaman || 0) - (l[a].zaman || 0); }).slice(0, 20);
  if (!k.length) { return '<p class="oyun-not">Bir evrenin romanını açınca kaldığın yer burada tutulur; “Okuma listeme ekle” ile sonra okuyacaklarını biriktir.</p>'; }
  return '<ul class="okl-liste">' + k.map(function (x) {
    const o = l[x];
    return "<li><span><b>" + kacir(o.ad) + "</b>" + (o.toplam ? ' <span class="oyun-not">· ' + ((o.sira || 0) + 1) + " / " + o.toplam + (o.bitti ? " · bitti" : "") + "</span>" : "") + "</span>" +
      '<span class="oyun-sira"><button class="dugme dugme-sade y-kucuk" data-okl-devam="' + kacir(x) + '">' + (o.bolum ? "Devam et" : "Oku") + "</button>" +
      (o.liste ? '<button class="ic-bag" data-okl-cikar="' + kacir(x) + '">listeden çıkar</button>' : "") + "</span></li>";
  }).join("") + "</ul>";
}

/* ==================== 10. bildirim ayarları (Sen sayfası) ==================== */

const SESSIZ25 = "tentiforapp_sessiz_saat";   /* { bas: 22, bit: 8 } */

function ayar25Html() {
  const sessiz = jsonOku(SESSIZ25, null) || {};
  const saat = function (id, d) {
    return '<select class="kod-giris arac-giris" id="' + id + '">' + ['<option value="">—</option>'].concat(Array.from({ length: 24 }, function (_, i) {
      return '<option value="' + i + '"' + (d === i ? " selected" : "") + ">" + String(i).padStart(2, "0") + ":00</option>";
    })).join("") + "</select>";
  };
  const push = typeof bildirimAcikAnahtar === "function" && bildirimAcikAnahtar();
  const aboneMi = typeof bildirimAboneMi === "function" && bildirimAboneMi();
  const htr = typeof HTR_ANAHTAR !== "undefined" && jsonOku(HTR_ANAHTAR, false) === true;
  const takip = typeof tkpListe === "function" ? tkpListe() : {};
  const indirilen = typeof evdIndirilenler === "function" ? evdIndirilenler() : {};
  const evAd = function (id) { const e = ((veri.fanEserleri || {}).evrenler || []).find(function (x) { return x.id === id; }); return e ? e.ad : id; };
  return '<details class="kutu-y ayar25" open><summary><b>Okuma listem</b></summary>' + oklHtml() + "</details>" +
    '<details class="kutu-y ayar25"><summary><b>Bildirimler</b></summary>' +
      '<div class="ayar25-satir"><span>Yeni roman bölümü</span>' + (!push ? '<span class="oyun-not">site henüz kurmadı</span>' :
        (aboneMi ? '<button class="dugme dugme-sade y-kucuk" data-bildirim="kapat">Kapat</button>' : '<button class="dugme y-kucuk" data-bildirim="ac">Aç</button>')) + "</div>" +
      '<div class="ayar25-satir"><span>Günün kelimesi hatırlatması</span>' + (htr ? '<button class="dugme dugme-sade y-kucuk" data-htr="kapat">Kapat</button>' : '<button class="dugme y-kucuk" data-htr="ac">Aç</button>') + "</div>" +
      '<div class="ayar25-satir"><span>Takip ettiğin evrenler</span><span class="oyun-not">' + (Object.keys(takip).length || "yok") + "</span></div>" +
      (Object.keys(takip).length ? '<ul class="ayar25-liste">' + Object.keys(takip).map(function (id) {
        return "<li>" + kacir(evAd(id)) + ' <button class="ic-bag" data-tkp="' + kacir(id) + '">takibi bırak</button></li>';
      }).join("") + "</ul>" : "") +
      '<div class="ayar25-satir"><span>Sessiz saatler</span><span class="ayar25-saat">' + saat("sessizBas", sessiz.bas) + " – " + saat("sessizBit", sessiz.bit) + "</span></div>" +
      '<p class="oyun-not">Sessiz saatlerde günlük hatırlatma gelmez; yeni bölüm bildirimi sessiz (titreşimsiz) gelir.</p>' +
      "</details>" +
    '<details class="kutu-y ayar25"><summary><b>Cihazdaki evrenler</b> · ' + Object.keys(indirilen).length + "</summary>" +
      (Object.keys(indirilen).length ? '<ul class="ayar25-liste">' + Object.keys(indirilen).map(function (id) {
        return "<li>" + kacir(evAd(id)) + ' <span class="oyun-not">· ' + kacir(new Date(indirilen[id]).toLocaleDateString("tr-TR")) + '</span> <button class="ic-bag" data-ayar25-evd-sil="' + kacir(id) + '">kaldır</button></li>';
      }).join("") + "</ul>" : '<p class="oyun-not">Fan evrenleri keşfinde “Önizle → Cihaza indir” ile bir evreni internetsiz okumak için indirebilirsin.</p>') +
    "</details>";
}

function ayar25Ciz() {
  const h = document.querySelector("#hesap");
  const alan = document.querySelector("#hesapAlan");
  if (!h || !alan || !veri) { return; }
  let k = document.querySelector("#ayar25Alan");
  if (!k) { k = document.createElement("div"); k.id = "ayar25Alan"; alan.insertAdjacentElement("afterend", k); }
  const acik = Array.prototype.slice.call(k.querySelectorAll("details")).map(function (d) { return d.open; });
  k.innerHTML = ayar25Html();
  k.querySelectorAll("details").forEach(function (d, i) { if (acik[i] !== undefined) { d.open = acik[i]; } });
}

document.addEventListener("change", function (e) {
  if (!e.target || (e.target.id !== "sessizBas" && e.target.id !== "sessizBit")) { return; }
  const bas = document.querySelector("#sessizBas").value, bit = document.querySelector("#sessizBit").value;
  const s = bas !== "" && bit !== "" && bas !== bit ? { bas: Number(bas), bit: Number(bit) } : null;
  jsonYaz(SESSIZ25, s);
  if (typeof swAyarEsitle === "function") { swAyarEsitle({ sessiz: s }); }
});
document.addEventListener("click", async function (e) {
  const b = e.target.closest && e.target.closest("#ayar25Alan [data-bildirim], #ayar25Alan [data-htr], #ayar25Alan [data-tkp], [data-ayar25-evd-sil]");
  if (!b) { return; }
  if (b.dataset.ayar25EvdSil) { await evdCevrimdisiSil(b.dataset.ayar25EvdSil); ayar25Ciz(); return; }
  setTimeout(ayar25Ciz, 1600);   /* 41/55'teki işleyiciler işini bitirsin */
});

/* Sen sayfasına her gelişte güncel (okuma listesi, takip, indirilenler başka sayfalarda değişir) */
window.addEventListener("hashchange", function () { if (typeof rota === "function" && rota().indexOf("#/sen") === 0) { setTimeout(ayar25Ciz, 60); } });

if (typeof hesapCiz === "function") {
  const eskiHC25 = hesapCiz;
  window.hesapCiz = function () { const r = eskiHC25.apply(this, arguments); ayar25Ciz(); return r; };
}

/* ==================== 11. evren yazısı klavyesi ==================== */

if (typeof evrenEkBolum === "function") {
  const eskiEB25 = evrenEkBolum;
  window.evrenEkBolum = function (v) {
    const h = eskiEB25.apply(this, arguments);
    if (!EVS || EVS.sekme !== "yazi" || !v || !v.eser || typeof eyDolu !== "function" || !eyDolu(v.eser.yazi)) { return h; }
    return (h || "") + '<div class="kutu-y yk-kutu"><label for="ykMetin">Yazı klavyesi · kendi mesajını bu evrenin yazısıyla yaz</label>' +
      '<textarea class="kod-giris arac-giris" id="ykMetin" rows="2" maxlength="160" placeholder="' + kacir(v.eser.ad || "Merhaba") + '"></textarea>' +
      '<div class="yk-onizle" id="ykOnizle">' + eyYaziSvg(v.eser.ad || "", v.eser.yazi, 48) + "</div>" +
      '<div class="oyun-sira"><button class="dugme" data-yk-png>PNG indir</button><button class="dugme dugme-sade" data-yk-paylas>Paylaş</button></div>' +
      '<p class="oyun-not">Çizilmemiş harfler soluk görünür.</p></div>';
  };
}

document.addEventListener("input", function (e) {
  if (!e.target || e.target.id !== "ykMetin") { return; }
  const v = evrenSayfaVerisi();
  const o = document.querySelector("#ykOnizle");
  if (v && o) { o.innerHTML = eyYaziSvg(e.target.value || v.eser.ad || "", v.eser.yazi, 48); }
});

/** SVG'yi beyaz zeminli PNG'ye çevirir. */
function ykPng(svg) {
  return new Promise(function (coz, red) {
    const g = document.createElement("div");
    g.innerHTML = svg;
    const s = g.querySelector("svg");
    if (!s) { red(new Error("yazı yok")); return; }
    const vb = (s.getAttribute("viewBox") || "0 0 100 112").split(/\s+/).map(Number);
    const olcek = 3, yuk = 160, gen = Math.max(1, Math.round(vb[2] / vb[3] * yuk));
    s.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    s.setAttribute("width", gen); s.setAttribute("height", yuk);
    s.setAttribute("color", "#10161d");
    const metin = new XMLSerializer().serializeToString(s).replace(/currentColor/g, "#10161d");
    const img = new Image();
    img.onload = function () {
      const c = document.createElement("canvas");
      const pay = 40;
      c.width = (gen + pay * 2) * olcek; c.height = (yuk + pay * 2) * olcek;
      const x = c.getContext("2d");
      x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, pay * olcek, pay * olcek, gen * olcek, yuk * olcek);
      c.toBlob(function (b) { if (b) { coz(b); } else { red(new Error("çizilemedi")); } }, "image/png");
    };
    img.onerror = function () { red(new Error("çizilemedi")); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(metin);
  });
}

document.addEventListener("click", async function (e) {
  const b = e.target.closest && e.target.closest("[data-yk-png], [data-yk-paylas]");
  if (!b) { return; }
  const o = document.querySelector("#ykOnizle");
  if (!o || !o.innerHTML.trim()) { return; }
  let blob;
  try { blob = await ykPng(o.innerHTML); } catch (_) { if (typeof eckaBildir === "function") { eckaBildir("Görsel oluşturulamadı"); } return; }
  const v = evrenSayfaVerisi();
  const ad = String((v && v.eser.ad) || "evren").toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, "-").slice(0, 30) + "-yazi.png";
  if (b.hasAttribute("data-yk-paylas") && navigator.canShare) {
    const f = new File([blob], ad, { type: "image/png" });
    if (navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: (v && v.eser.ad) || "Evren yazısı" }); return; } catch (_) { return; } }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = ad;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
});

/* ==================== başlangıç ==================== */

document.addEventListener("DOMContentLoaded", function () {
  const bekle = typeof veriHazirOlunca === "function" ? veriHazirOlunca : function (f) { setTimeout(f, 1500); };
  bekle(function () { haftaninEvreniCiz(); ayar25Ciz(); });
});
/* açık bir ortak evrene girince güncel hâli çek */
if (typeof evrenSayfaAc === "function") {
  const eskiAc25 = evrenSayfaAc;
  window.evrenSayfaAc = function (kaynak, id) {
    const r = eskiAc25.apply(this, arguments);
    if (kaynak === "benim") { const e = evrenBenimBul(id); if (e && e.ortak) { ortakCek(id); } }
    return r;
  };
}
/* bağlantı gelince bekleyen ortak kayıtlar */
window.addEventListener("online", function () { Object.keys(ORTAK.bekleyen).forEach(function (id) { if (ORTAK.bekleyen[id]) { ortakYaz(id); } }); });
