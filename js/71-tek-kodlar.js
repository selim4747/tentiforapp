/* Tek kullanımlık kodlar (2.1) — her kod bir kişi içindir ve ilk giren hesaba bağlanır.

   Türler: evren (seviye 15'i beklemeden evren kurma), evrengezer (seviye 10), yonetici (sınırlı yönetici paneli),
   kisi (seçilen bölüm ve evrenler; istenirse buz katmanları).
   - Kod sunucuda yalnızca özetiyle durur (supabase/kurulum.sql: tek_kodlar). Girilince hesaba bağlanır; aynı hesap
     çıkıp girse de hakkı sürer (her girişte tek_kodlarim ile sunucudan gelir), başka hesap giremez.
   - Yönetici bağı silerse (Panel → Tek kodlar → Bağı sil, ya da Supabase'de kullanici = NULL) hak bir sonraki
     açılışta gider; kişinin yaptıkları silinmez. Kişi kodunun açtığı buz katmanları, her kod gibi ilerlemede kalır.
   - Haklar yalnızca bellekte tutulur: hesapla gelir, hesaptan çıkınca gider; cihaza kalıcı yazılmaz. */

const TEK = { haklar: [], surum: 0, yoneticiVerdi: false };
const TEK_TURLER = { evren: "Evren kurma", evrengezer: "Evrengezer kurma", yonetici: "Sınırlı yönetici", kisi: "Kişi (bölüm ve evren erişimi)" };

function tekOzet(kod) {
  return onaltilik(sha256Bayt(metniBayta(String(kod || "").trim().toUpperCase() + "#tek")));
}

function tekHesapVar() { return typeof hesapIstemci !== "undefined" && hesapIstemci && typeof hesapKullanici !== "undefined" && hesapKullanici; }

function tekDavetBaglantisi(kod) {
  const kok = /^https?:$/.test(location.protocol) ? location.origin + "/" : "https://tentiforapp.pages.dev/";
  return kok + "?kod=" + encodeURIComponent(kod);
}

function tekHakVar(tur) { return TEK.haklar.some(function (h) { return h.tur === tur; }); }

/** Haklar değişince: seviye kapıları, kanon kilidi, yönetici paneli yeniden */
function tekHaklariUygula() {
  TEK.surum++;
  if (typeof SVK !== "undefined") { SVK.onbellek = null; }
  if (typeof kanonSifirla === "function") { try { kanonSifirla(); } catch (_) { /* yok */ } }
  else if (typeof kanonOnbellek !== "undefined") { kanonOnbellek = null; }
  if (tekHakVar("yonetici") && typeof yoneticiAcik === "function" && !yoneticiAcik() && !yoneticiSinirli) {
    yoneticiSinirli = true; TEK.yoneticiVerdi = true;
  } else if (!tekHakVar("yonetici") && TEK.yoneticiVerdi) {
    yoneticiSinirli = false; TEK.yoneticiVerdi = false;
  }
  try {
    if (typeof kanonKilitUygula === "function") { kanonKilitUygula(); }
    if (typeof seviyeKapilariUygula === "function") { seviyeKapilariUygula(); }
    if (typeof yoneticiCiz === "function") { yoneticiCiz(); }
    if (typeof arsiviTazele === "function") { arsiviTazele(); }
  } catch (_) { /* sayfa henüz hazır değil */ }
}

async function tekHaklariYukle() {
  if (!tekHesapVar()) { if (TEK.haklar.length) { TEK.haklar = []; tekHaklariUygula(); } return; }
  try {
    const r = await hesapIstemci.rpc("tek_kodlarim");
    if (r.error) { return; }
    TEK.haklar = Array.isArray(r.data) ? r.data : [];
    tekHaklariUygula();
  } catch (_) { /* çevrimdışı: sonra */ }
}

/* ---------- haklar siteye ---------- */

if (typeof seviyeKoduSeviyesi === "function") {
  const eskiSvk = seviyeKoduSeviyesi;
  window.seviyeKoduSeviyesi = function () {
    return Math.max(eskiSvk.apply(this, arguments), tekHakVar("evren") ? 15 : (tekHakVar("evrengezer") ? 10 : 0));
  };
}

if (typeof kanonErisim === "function") {
  const eskiErisim = kanonErisim;
  let onb = null;
  window.kanonErisim = function () {
    const e = eskiErisim.apply(this, arguments);
    const kisiler = TEK.haklar.filter(function (h) { return h.tur === "kisi"; });
    if (!kisiler.length || e.hepsi) { return e; }
    if (onb && onb.taban === e && onb.surum === TEK.surum) { return onb.e; }
    const k = { hepsi: e.hepsi, tumEvren: e.tumEvren, bolumler: new Set(e.bolumler), evrenler: new Set(e.evrenler) };
    kisiler.forEach(function (h) {
      const er = (h.veri && h.veri.erisim) || {};
      (er.bolumler || []).forEach(function (b) { k.bolumler.add(b); });
      (er.evrenler || []).forEach(function (x) { k.evrenler.add(x); });
    });
    onb = { taban: e, surum: TEK.surum, e: k };
    return k;
  };
}

/* ---------- kod girişi ---------- */

/** Bu kod sitenin kendi kodlarından biri mi? (öyleyse sunucuya hiç sorulmaz) */
function tekYerelKodMu(kod) {
  if (typeof dogrulamaOzeti !== "function" || !veri) { return true; }
  const oz = dogrulamaOzeti(kod);
  return oz === veri.yoneticiOzet || oz === veri.sinirliYoneticiOzet ||
    (veri.profiller || []).some(function (p) { return p.dogrulama === oz; }) ||
    (veri.seviyeKodlari || []).some(function (k) { return k.ozet === oz; }) ||
    (typeof cozulenler !== "undefined" && !!cozulenler[oz]) ||
    (typeof tumKilitler === "function" && tumKilitler().has(oz));
}

async function tekKodDene(kod, durum) {
  const yaz = function (m, iyi) { if (durum) { durum.textContent = m; durum.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };
  if (!tekHesapVar()) { yaz("Bu kod hiçbir kaydı açmıyor. Tek kullanımlık bir kodsa önce giriş yap: kod hesabına bağlanır.", false); return; }
  yaz("Kod denetleniyor…", true);
  let r;
  try { r = await hesapIstemci.rpc("tek_kod_kullan", { p_kod: kod }); } catch (e) { yaz("Sunucuya ulaşılamadı; biraz sonra dene.", false); return; }
  const d = (r && r.data) || {};
  if (r.error || d.durum !== "tamam") {
    yaz(({ yok: "Bu kod hiçbir kaydı açmıyor", dolu: "Bu kod başka bir hesaba bağlı. Tek kullanımlık kodlar yalnızca ilk girenindir.",
      sinir: "Çok fazla deneme yaptın; bir saat sonra yeniden dene.", giris: "Önce giriş yap",
      sure_doldu: "Bu kodun süresi doldu." })[d.durum] || "Kod denetlenemedi", false);
    return;
  }
  if (!TEK.haklar.some(function (h) { return h.tur === d.tur && h.ad === d.ad; })) { TEK.haklar.push({ tur: d.tur, ad: d.ad, veri: d.veri || {} }); }
  /* kişi kodu: buz katmanı anahtarları bu kodla sarılı; çözülenler her kod gibi ilerlemeye (ve hesaba) yazılır */
  let katman = 0;
  if (d.tur === "kisi" && d.veri && d.veri.anahtarlar && typeof katmanBulHepsi === "function") {
    Object.keys(d.veri.anahtarlar).forEach(function (id) {
      const k = katmanBulHepsi(id);
      if (!k) { return; }
      try {
        const kk = sifreCoz(d.veri.anahtarlar[id], kod);
        if (dogrulamaOzeti(kk) === k.dogrulama && !cozulenler[k.dogrulama]) { cozulenler[k.dogrulama] = kk; katman++; }
      } catch (_) { /* bozuk anahtar */ }
    });
    if (katman && typeof acilanlariKaydet === "function") { acilanlariKaydet(); }
  }
  yaz((d.veri && d.veri.selamlama) || ({ evren: "Evren kurma açıldı: seviyeyi beklemeden kurabilirsin.",
    evrengezer: "Evrengezer kurma açıldı: seviyeyi beklemeden kurabilirsin.",
    yonetici: "Sınırlı yönetici paneli açıldı (Sen → Yönetici).",
    kisi: "Sana ayrılan bölümler açıldı." + (katman ? " · " + katman + " buz katmanı" : "") })[d.tur] + " Kod hesabına bağlandı.", true);
  if (typeof olaySay === "function") { olaySay("tek_kod:" + d.tur); }
  setTimeout(function () { if (typeof perdeKapat === "function") { perdeKapat(); } tekHaklariUygula(); }, 1300);
}

if (typeof sonraSar === "function") {
  sonraSar("kodDene", function (eski) {
    return function (ham) {
      const kod = String(ham || "").trim().toUpperCase();
      if (!kod || tekYerelKodMu(kod)) { return eski.apply(this, arguments); }
      tekKodDene(kod, document.querySelector("#kodDurum"));
    };
  });
}

/* hesaba girince / açılışta haklar sunucudan */
if (typeof hesapProfilYukle === "function") {
  const eskiPY = hesapProfilYukle;
  window.hesapProfilYukle = async function () {
    const r = await eskiPY.apply(this, arguments);
    tekHaklariYukle();
    return r;
  };
}

/* ==================== panel: Tek kodlar (tam yönetici) ==================== */

const TEK_PANEL = { tur: "kisi", ad: "", adet: 1, sure: "", bolumler: {}, evrenler: {}, katman: false, yeni: null, liste: null, durum: "" };

function tekPanelListeYukle() {
  if (!tekHesapVar()) { return; }
  hesapIstemci.rpc("tek_kod_listesi").then(function (r) {
    TEK_PANEL.liste = r.error ? { hata: hesapHataMetni ? hesapHataMetni(r.error) : "okunamadı" } : (r.data || []);
    if (typeof yoneticiCiz === "function" && typeof yoneticiSekme !== "undefined" && yoneticiSekme === "tekkod") { yoneticiCiz(); }
  });
}

function yoneticiTekKodlar() {
  if (!(typeof yoneticiAcik === "function" && yoneticiAcik())) { return '<p class="oyun-not">Bu sekme yalnızca tam yöneticiye açık.</p>'; }
  if (!tekHesapVar()) { return '<p class="oyun-not">Tek kullanımlık kodlar sunucuda durur: önce yönetici hesabınla giriş yap (Sen → Hesabın). ' +
    "Hesabın Supabase'de yoneticiler tablosunda olmalı.</p>"; }
  if (TEK_PANEL.liste === null) { TEK_PANEL.liste = []; tekPanelListeYukle(); }
  const t = TEK_PANEL;
  const cek = function (attr, anahtar, secili, ad) {
    return '<label class="y-alan-secim"><input type="checkbox" ' + attr + '="' + kacir(anahtar) + '"' + (secili ? " checked" : "") + "> " + kacir(ad) + "</label>";
  };
  const kisiAlanlari = t.tur !== "kisi" ? "" :
    "<label>Görebileceği bölümler</label>" + (typeof KANON_GRUPLARI !== "undefined" ? KANON_GRUPLARI.map(function (g) {
      return '<div class="y-kisi-grup"><span class="oyun-not">' + kacir(g.ad) + '</span><div class="y-alan-izgara">' +
        g.bolumler.map(function (b) { return cek("data-tek-bolum", b, t.bolumler[b], typeof kanonBolumAdi === "function" ? kanonBolumAdi(b) : b); }).join("") + "</div></div>";
    }).join("") : "") +
    "<label>Görebileceği evrenler</label><div class=\"y-alan-izgara\">" + (veri.haritalar || []).filter(function (h) { return !h.ustEvren; }).map(function (h) {
      return cek("data-tek-evren", h.id, t.evrenler[h.id], h.evrenAdi || h.ad);
    }).join("") + "</div>" +
    '<label class="hf-onay"><input type="checkbox" id="tekKatman"' + (t.katman ? " checked" : "") + "> Bütün buz katmanları da açılsın</label>";
  const liste = t.liste && t.liste.hata ? '<p class="pencere-durum kotu">' + kacir(t.liste.hata) + "</p>" :
    (t.liste && t.liste.length ? '<div class="y-blok-liste">' + t.liste.map(function (x) {
      return '<div class="y-kisi-satir"><div class="y-kisi-ust"><span class="y-blok-baslik">' + kacir(TEK_TURLER[x.tur] || x.tur) + (x.ad ? " · " + kacir(x.ad) : "") + "</span>" +
        '<span class="oyun-not">' + (x.sure_gun ? x.sure_gun + " gün · " : "") + (x.bitis ? "bitiş " + kacir(new Date(x.bitis).toLocaleDateString("tr-TR")) + " · " : "") + (x.iptal ? "iptal edildi" : (x.bagli ? "bağlı: @" + kacir(x.kullanici_adi || "?") + (x.baglanma ? " · " + kacir(new Date(x.baglanma).toLocaleDateString("tr-TR")) : "") : "henüz kullanılmadı")) +
        " · …" + kacir(String(x.ozet).slice(0, 6)) + "</span></div>" +
        '<div class="y-kisi-dugmeler">' + (x.bagli ? '<button class="dugme dugme-sade" data-tek-bagsil="' + kacir(x.ozet) + '">Bağı sil</button>' : "") +
        '<button class="dugme dugme-sade' + (x.iptal ? "" : " y-sil") + '" data-tek-iptal="' + kacir(x.ozet) + '" data-deger="' + (x.iptal ? "0" : "1") + '">' + (x.iptal ? "Yeniden aç" : "İptal et") + "</button></div></div>";
    }).join("") + "</div>" : '<p class="oyun-not">Henüz tek kullanımlık kod yok.</p>');
  return '<p class="oyun-not">Tek kullanımlık kod ilk girenin hesabına bağlanır; o kişi çıkıp girse de hakkı sürer, başka biri giremez. ' +
      "Bağı silersen hakkı gider ama yaptıkları silinmez. Kodların kendisi yalnızca şimdi, üretirken görünür; sunucuda yalnızca özetleri durur.</p>" +
    '<div class="kutu-y"><label for="tekTur">Tür</label><select class="kod-giris arac-giris" id="tekTur">' + Object.keys(TEK_TURLER).map(function (k) {
        return '<option value="' + k + '"' + (t.tur === k ? " selected" : "") + ">" + kacir(TEK_TURLER[k]) + "</option>";
      }).join("") + "</select>" +
      '<label for="tekAd">Kimin için (not)</label><input class="kod-giris arac-giris" id="tekAd" maxlength="80" value="' + kacir(t.ad) + '">' +
      '<label for="tekAdet">Kaç kod (her biri ayrı kişi için)</label><input class="kod-giris arac-giris" id="tekAdet" type="number" min="1" max="20" value="' + t.adet + '">' +
      '<label for="tekSure">Geçerlilik (bağlandıktan sonra kaç gün; boşsa süresiz)</label><input class="kod-giris arac-giris" id="tekSure" type="number" min="1" max="3650" value="' + kacir(t.sure) + '" placeholder="süresiz">' +
      kisiAlanlari +
      '<div class="y-kisi-dugmeler"><button class="dugme" data-tek-uret>Kodları üret</button></div>' +
      (t.durum ? '<p class="pencere-durum">' + kacir(t.durum) + "</p>" : "") +
      (t.yeni ? '<div class="y-kod-kutu"><p class="oyun-not"><b>Kodlar yalnızca şimdi görünür; kopyala ve sakla.</b></p>' +
        '<textarea class="kod-giris arac-giris" rows="' + Math.min(10, t.yeni.length + 1) + '" readonly id="tekYeniKodlar">' + kacir(t.yeni.join("\n")) + "</textarea>" +
        '<button class="dugme dugme-sade" data-tek-kopyala>Kopyala</button>' +
        '<p class="oyun-not">Davet bağlantısı: kişi tıklar, giriş yapar, kod kendiliğinden hesabına bağlanır.</p>' +
        '<textarea class="kod-giris arac-giris" rows="' + Math.min(10, t.yeni.length + 1) + '" readonly id="tekYeniBaglantilar">' + kacir(t.yeni.map(tekDavetBaglantisi).join("\n")) + "</textarea>" +
        '<button class="dugme dugme-sade" data-tek-kopyala="baglanti">Bağlantıları kopyala</button></div>' : "") +
    "</div>" +
    '<div class="gk-ust"><span class="oyun-etiket">Kodlar</span><button class="dugme dugme-sade" data-tek-yenile>Yenile</button></div>' + liste;
}

function tekPanelOku() {
  const t = TEK_PANEL;
  const al = function (s) { return document.querySelector(s); };
  if (al("#tekTur")) { t.tur = al("#tekTur").value; }
  if (al("#tekAd")) { t.ad = al("#tekAd").value; }
  if (al("#tekAdet")) { t.adet = Math.max(1, Math.min(20, Math.round(Number(al("#tekAdet").value) || 1))); }
  if (al("#tekSure")) { const n = Math.round(Number(al("#tekSure").value)); t.sure = n > 0 ? String(Math.min(3650, n)) : ""; }
  if (al("#tekKatman")) { t.katman = al("#tekKatman").checked; }
  const topla = function (attr) { const o = {}; document.querySelectorAll("[" + attr + "]").forEach(function (c) { if (c.checked) { o[c.getAttribute(attr)] = true; } }); return o; };
  if (document.querySelector("[data-tek-bolum]")) { t.bolumler = topla("data-tek-bolum"); t.evrenler = topla("data-tek-evren"); }
}

/** Kodları üretir, sunucuya yalnızca özetlerini yollar; düz kodları döndürür. */
async function tekKodlariOlustur(tur, ad, adet, secim) {
  const kodlar = [], satirlar = [];
  for (let i = 0; i < adet; i++) {
    const kod = kod10();
    const veriK = {};
    if (tur === "kisi") {
      veriK.erisim = { bolumler: secim.bolumler || [], evrenler: secim.evrenler || [] };
      if (secim.katman && typeof katmanKodlari !== "undefined") {
        const idler = Object.keys(katmanKodlari).filter(function (id) { return katmanKodlari[id]; });
        if (idler.length && typeof yoneticiKisiKatmanSar === "function") { veriK.anahtarlar = yoneticiKisiKatmanSar(kod, idler); }
      }
    }
    kodlar.push(kod);
    satirlar.push({ ozet: tekOzet(kod), tur: tur, ad: ad, veri: veriK, sure_gun: Number(secim.sure) || null });
  }
  const r = await hesapIstemci.rpc("tek_kod_olustur", { p_kodlar: satirlar });
  if (r.error) { throw r.error; }
  return kodlar;
}

document.addEventListener("change", function (e) {
  if (e.target && e.target.id === "tekTur") { tekPanelOku(); TEK_PANEL.yeni = null; if (typeof yoneticiCiz === "function") { yoneticiCiz(); } }
});

document.addEventListener("click", function (e) {
  const h = e.target.closest && e.target.closest("[data-tek-uret], [data-tek-kopyala], [data-tek-yenile], [data-tek-bagsil], [data-tek-iptal]");
  if (!h) { return; }
  const t = TEK_PANEL;
  if (h.hasAttribute("data-tek-uret")) {
    tekPanelOku();
    const secim = { bolumler: Object.keys(t.bolumler), evrenler: Object.keys(t.evrenler), katman: t.katman, sure: t.sure };
    if (t.tur === "kisi" && !secim.bolumler.length) { t.durum = "Kişi kodu için en az bir bölüm seç."; yoneticiCiz(); return; }
    t.durum = "Üretiliyor…"; yoneticiCiz();
    tekKodlariOlustur(t.tur, t.ad.trim(), t.adet, secim).then(function (k) {
      t.yeni = k; t.durum = k.length + " kod üretildi."; t.liste = null; yoneticiCiz();
    }).catch(function (er) { t.durum = "Üretilemedi: " + ((typeof hesapHataMetni === "function" && hesapHataMetni(er)) || er.message || er); yoneticiCiz(); });
  } else if (h.hasAttribute("data-tek-kopyala")) {
    if (typeof panoyaKopyala === "function") { panoyaKopyala((t.yeni || []).map(h.dataset.tekKopyala === "baglanti" ? tekDavetBaglantisi : function (x) { return x; }).join("\n")); }
  } else if (h.hasAttribute("data-tek-yenile")) {
    t.liste = null; yoneticiCiz();
  } else if (h.dataset.tekBagsil) {
    hesapIstemci.rpc("tek_kod_bag_sil", { p_ozet: h.dataset.tekBagsil }).then(function () { t.liste = null; yoneticiCiz(); });
  } else if (h.dataset.tekIptal) {
    hesapIstemci.rpc("tek_kod_iptal", { p_ozet: h.dataset.tekIptal, p_iptal: h.dataset.deger === "1" }).then(function () { t.liste = null; yoneticiCiz(); });
  }
});
