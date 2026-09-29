/* İlk deneyim ve geri gelme.
   1. Okuma yolu: "Okumaya başla" açık olan ilk adıma gider; okuma sırasının her adımı açık mı, nasıl açılır, yazar.
   2. Kilitli bölümde önizleme: ilk satırlar soluk; nasıl açıldığı. Sayfada açık içerik varsa kilit kartı küçük kalır.
   3. Başlangıç kodu ilk ziyarette kendiliğinden girilir (arşiv açık gelir).
   4. Tanıtım turu ekranı kapatmaz: altta küçük ipucu kartı.
   5. İçeriği olmayan bölümler (ör. kısa hikâyeler) kilitli görünmez; ilk kayıt gelince belirir.
   6. Terimler: eçka, Kyldo, Evrengezer, E25, E99, buz ilk geçtikleri yerde dokununca açıklanır.
   7. eçka göstergesi ilk kazanca kadar gizli; ilk kazançta ne işe yaradığı söylenir.
   8. eçka penceresi: en üstte "neler alabilirsin"; yedek kodu bir düğmenin arkasında.
   9. Ana sayfa: en üstte "Bugün" kartı (kaldığın yer, kilit ilerlemesi); vitrin aşağıda.
  10. Kaldığın yerden devam: son okuduğun kayıt.
  11. Hesap: ne kazandırdığı ve Google ile giriş.
  12. Kilit ilerlemesi: arşivin ne kadarı açık, sıradaki kilit.
  15. Geri bildirim: "Bir sorun mu var?" — panelde hata kayıtlarının arasında görünür. */

/** 24-arsiv-mantigi.js en son yüklenir: onun fonksiyonları bütün betikler çalıştıktan sonra sarılır (veri ondan da sonra gelir). */
function sonraSar(ad, kur) {
  const yap = function () { if (typeof window[ad] === "function") { window[ad] = kur(window[ad]); } };
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", yap); } else { yap(); }
}

/* ==================== 3. başlangıç kodu kendiliğinden ==================== */

const BASLANGIC_OTO = "tentiforapp_baslangic_oto";

function baslangicKendiliginden() {
  try {
    if (!veri || !veri.baslangicKodu || !veri.baslangicProfil || typeof kanonProfilIdleri !== "function") { return; }
    if (kayitOku(BASLANGIC_OTO)) { return; }            /* bir kez; kişi çıkardıysa bir daha zorlanmaz */
    kayitYaz(BASLANGIC_OTO, "1");
    if (kanonProfilIdleri().length) { return; }         /* zaten bir kodu var */
    const p = (veri.profiller || []).find(function (x) { return x.id === veri.baslangicProfil; });
    if (!p) { return; }
    Object.keys(p.anahtarlar || {}).forEach(function (id) {
      const k = typeof katmanBulHepsi === "function" ? katmanBulHepsi(id) : null;
      if (!k) { return; }
      try { const kk = sifreCoz(p.anahtarlar[id], veri.baslangicKodu); if (dogrulamaOzeti(kk) === k.dogrulama) { cozulenler[k.dogrulama] = kk; } } catch (_) { /* geç */ }
    });
    if (typeof acilanlariKaydet === "function") { acilanlariKaydet(); }
    kayitYaz("tentiforapp_profil", p.id);
    kanonProfilEkle(p.id);
    if (typeof olaySay === "function") { olaySay("baslangic_oto"); }
  } catch (_) { /* kilit düzeni hazır değil */ }
}

/* ==================== 5. boş bölümler ==================== */

const BOS_BOLUMLER = {
  kisaHikayeler: function () { return (veri.kisaHikayeler || []).length; },
  olaylar: function () { return (veri.anlatiOlaylari || []).length; },
  dosyalar: function () { return (veri.kilitliDosyalar || []).length; }
};

function bolumBosMu(id) {
  if (!BOS_BOLUMLER[id] || !veri) { return false; }
  if (typeof yoneticiAcik === "function" && yoneticiAcik()) { return false; }   /* yönetici içerik ekleyebilsin */
  try { return !BOS_BOLUMLER[id](); } catch (_) { return false; }
}

function bosBolumleriUygula() {
  Object.keys(BOS_BOLUMLER).forEach(function (id) {
    const b = document.getElementById(id);
    if (b) { b.classList.toggle("bos-bolum", bolumBosMu(id)); }
  });
  if (typeof GEZINME !== "undefined") {
    GEZINME.forEach(function (g) {
      if (!g.__tum) { g.__tum = g.bolumler.slice(); }
      g.bolumler = g.__tum.filter(function (b) { return !bolumBosMu(b[0]); });
    });
  }
}

/* ==================== 2. kilit önizlemesi ==================== */

function onizlemeMetni(id) {
  const v = veri || {};
  const ilk = function (l, f) { const x = (l || []).find(function (o) { return o && !o.gizli && f(o); }); return x ? f(x) : ""; };
  const m = {
    roman: function () { return (v.roman && v.roman.giris) || ilk(v.roman && v.roman.bolumler, function (b) { return b.ozet; }); },
    hikaye: function () { return v.hikaye && v.hikaye.giris; },
    mektuplar: function () { return ilk(v.mektuplar, function (x) { return x.metin; }); },
    alintilar: function () { return ilk(v.alintilar, function (x) { return "“" + x.metin + "” — " + x.kim; }); },
    notlar: function () { return ilk(v.yazarNotlari, function (x) { return x.metin || x.ozet; }); },
    arsiv: function () { return ilk(v.karakterler, function (x) { return x.ad + ": " + x.ozet; }); },
    evren: function () { return ilk(v.evren, function (x) { return (x.baslik ? x.baslik + ": " : "") + (x.ozet || x.metin || ""); }); },
    zaman: function () { return ilk(v.zamanCizelgesi, function (x) { return x.baslik + " — " + x.metin; }); },
    bilinmeyenler: function () { return ilk(v.bilinmeyenler, function (x) { return x.soru; }); },
    yankilar: function () { return ilk(v.yankilar, function (x) { return x.metin || x.baslik; }); },
    sozluk: function () { return ilk(v.sozluk, function (x) { return x.terim + ": " + x.tanim; }); },
    yapimlar: function () { return ilk(v.yapimlar, function (x) { return x.ad + " — " + x.not; }); }
  };
  try { return String((m[id] && m[id]()) || "").replace(/\s+/g, " ").trim().slice(0, 190); } catch (_) { return ""; }
}

function kilitNasilAcilir(id) {
  if (typeof baslangicKapsar === "function" && baslangicKapsar(id)) { return "Başlangıç kodu (" + veri.baslangicKodu + ") bu bölümü açar."; }
  return "Bu bölümün kodu yazardan gelir: QR kart, duyuru ya da etkinlik. Arşivde okudukça ve oynadıkça yeni yollar açılır.";
}

/* ==================== 1. okuma yolu ==================== */

function siraHedefi(ad) {
  const t = String(ad).toLocaleLowerCase("tr");
  const kIndeks = (veri.karakterler || []).findIndex(function (k) { return k.ad && t.indexOf(String(k.ad).toLocaleLowerCase("tr")) !== -1; });
  if (kIndeks !== -1) { return { tur: "karakter", i: kIndeks, bolum: "arsiv" }; }
  const kurallar = [[/roman/, "roman"], [/oyun/, "oyunlar"], [/zaman/, "zaman"], [/takvim|tömye/, "evren"], [/aile|silsile/, "aile"],
    [/harita/, "harita"], [/mektup/, "mektuplar"], [/sözlük/, "sozluk"]];
  for (let i = 0; i < kurallar.length; i++) { if (kurallar[i][0].test(t)) { return { tur: "bolum", bolum: kurallar[i][1] }; } }
  /* evren maddesi */
  const m = (veri.evren || []).find(function (x) { return x.baslik && t.indexOf(String(x.baslik).toLocaleLowerCase("tr").slice(0, 10)) !== -1; });
  if (m) { return { tur: "bolum", bolum: "evren" }; }
  return null;
}

function siraAcikMi(h) {
  if (!h) { return false; }
  return typeof bolumErisimi !== "function" || bolumErisimi(h.bolum);
}

/** Okuma sırasında her adımın kilit durumu ve "Oku →"; üstte kilit ilerlemesi. */
function siraKilitleriIsaretle(alan, s) {
  alan.querySelectorAll(".sira-liste li").forEach(function (li, i) {
    const h = siraHedefi(s.adimlar[i]);
    if (!h) { return; }
    const acik = siraAcikMi(h);
    li.classList.add(acik ? "sira-acik" : "sira-kilitli");
    li.insertAdjacentHTML("beforeend", acik
      ? '<button type="button" class="ic-bag sira-git" data-sira-git="' + i + '">Oku →</button>'
      : '<span class="sira-kilit" title="' + kacir(kilitNasilAcilir(h.bolum)) + '">🔒 ' +
        (typeof baslangicKapsar === "function" && baslangicKapsar(h.bolum) ? "başlangıç kodu açar" : "kod ister") + "</span>");
  });
  alan.insertAdjacentHTML("afterbegin", kilitIlerlemesiHtml());
}

function siraAdimaGit(i) {
  const s = veri.okumaSirasi && veri.okumaSirasi[siraSecim];
  const h = s && siraHedefi(s.adimlar[i]);
  if (!h) { return false; }
  if (!siraAcikMi(h)) { if (typeof kodPenceresi === "function") { kodPenceresi(); } return true; }
  if (h.tur === "karakter" && typeof karakterAc === "function") { karakterAc(h.i); return true; }
  location.hash = "#" + h.bolum;
  return true;
}

document.addEventListener("click", function (ev) {
  const g = ev.target.closest && ev.target.closest("[data-sira-git]");
  if (g) { siraAdimaGit(Number(g.dataset.siraGit)); return; }
  /* "Okumaya başla": önerilen yolda açık olan ilk adım */
  const b = ev.target.closest && ev.target.closest('.hero-eylem [data-gez-git="sira"]');
  if (b && veri && veri.okumaSirasi) {
    const s = veri.okumaSirasi.onerilen || veri.okumaSirasi[Object.keys(veri.okumaSirasi)[0]];
    const i = (s.adimlar || []).findIndex(function (a) { return siraAcikMi(siraHedefi(a)); });
    if (i !== -1) {
      ev.preventDefault(); ev.stopImmediatePropagation();
      siraSecim = veri.okumaSirasi.onerilen ? "onerilen" : Object.keys(veri.okumaSirasi)[0];
      siraAdimaGit(i);
    }
  }
}, true);

/* ==================== 12. kilit ilerlemesi ==================== */

function kilitIlerlemesi() {
  const bolumler = (typeof KANON_BOLUMLERI !== "undefined" ? KANON_BOLUMLERI : []).filter(function (b) { return !bolumBosMu(b) && document.getElementById(b); });
  const acikB = bolumler.filter(function (b) { return bolumErisimi(b); });
  const katmanlar = veri.katmanlar || [];
  const acikK = katmanlar.filter(function (k) { return typeof cozulenler !== "undefined" && cozulenler[k.dogrulama]; });
  const toplam = bolumler.length + katmanlar.length;
  const acik = acikB.length + acikK.length;
  const siradaki = bolumler.find(function (b) { return !bolumErisimi(b); });
  return { yuzde: toplam ? Math.round(100 * acik / toplam) : 100, bolum: acikB.length + "/" + bolumler.length, katman: acikK.length + "/" + katmanlar.length, siradaki: siradaki };
}

function kilitIlerlemesiHtml() {
  const d = kilitIlerlemesi();
  return '<div class="kilit-ilerleme"><div class="kilit-ilerleme-ust"><b>Tömye arşivinin %' + d.yuzde + "'ini açtın</b>" +
    '<span class="oyun-not">' + d.bolum + " bölüm · " + d.katman + " buz katmanı</span></div>" +
    '<span class="svk-cubuk"><i style="width:' + Math.max(2, d.yuzde) + '%"></i></span>' +
    (d.siradaki ? '<p class="oyun-not">Sıradaki kilit: <b>' + kacir(typeof kanonBolumAdi === "function" ? kanonBolumAdi(d.siradaki) : d.siradaki) + "</b> — " +
      kacir(kilitNasilAcilir(d.siradaki)) + "</p>" : '<p class="oyun-not">Bütün bölümler açık; buz katmanları oyunlarla ve kodlarla çözülür.</p>') + "</div>";
}

/* ==================== 9 + 10. ana sayfa: "Bugün" kartı, kaldığın yer ==================== */

function sonOkunan() {
  const g = (typeof jsonOku === "function" ? jsonOku(typeof GECMIS_OKUMA_ANAHTAR !== "undefined" ? GECMIS_OKUMA_ANAHTAR : "tentiforapp_okuma_gecmis", []) : []) || [];
  return g.length ? g[g.length - 1] : null;
}

function onceNe(t) {
  const d = Math.round((Date.now() - (t || 0)) / 60000);
  if (d < 2) { return "az önce"; }
  if (d < 60) { return d + " dakika önce"; }
  if (d < 1440) { return Math.round(d / 60) + " saat önce"; }
  return Math.round(d / 1440) + " gün önce";
}

function bugunKartiCiz() {
  const kesif = document.querySelector("#kesif");
  if (!kesif || !veri) { return; }
  let k = document.querySelector("#bugunKartAlan");
  if (!k) {
    k = document.createElement("div");
    k.id = "bugunKartAlan";
    const arama = kesif.querySelector(".arama-kutu");
    if (arama) { arama.insertAdjacentElement("afterend", k); } else { kesif.prepend(k); }
    /* vitrin ve brifing aşağıya: önce bugün, sonra keşif */
    const vitrin = document.querySelector("#e25VitrinAlan"), bas = kesif.querySelector("details.baslangic");
    /* 3.2: vitrin artık "Bugün sitede" bölümünde; oradaysa yerinde kalır */
    if (vitrin && bas && !vitrin.closest("#kesifDaha")) { bas.insertAdjacentElement("afterend", vitrin); }
  }
  const son = sonOkunan();
  let devam = "";
  if (son) {
    const i = son.tur === "karakter" ? (veri.karakterler || []).findIndex(function (x) { return x.id === son.id; }) : -1;
    devam = '<div class="devam-kart"><span class="oyun-etiket">Kaldığın yer · ' + kacir(onceNe(son.t)) + "</span>" +
      "<b>" + kacir(son.ad || "Son okuduğun") + "</b>" +
      (i !== -1 ? '<button type="button" class="dugme" data-devam-kar="' + i + '">Devam et</button>'
        : '<a class="dugme" href="#' + kacir(son.tur === "madde" ? "evren" : "arsiv") + '">Devam et</a>') + "</div>";
  }
  k.innerHTML = '<section class="bugun-kart" aria-label="Bugün">' + devam + kilitIlerlemesiHtml() + "</section>";
}

document.addEventListener("click", function (ev) {
  const d = ev.target.closest && ev.target.closest("[data-devam-kar]");
  if (d && typeof karakterAc === "function") { karakterAc(Number(d.dataset.devamKar)); }
});

sonraSar("arsiviTazele", function (eskiTazele) {
  return function () {
    const r = eskiTazele.apply(this, arguments);
    try { bugunKartiCiz(); } catch (_) { /* yok */ }
    return r;
  };
});

/* ==================== 4. tanıtım turu: ekranı kapatmayan ipucu ==================== */

/* ==================== 6. terimler ==================== */

const TERIMLER = {
  "eçka": "Sitenin parası. Okuyarak, oynayarak ve görevlerle kazanılır; temaları, galeriyi ve kilitli oyunu açar.",
  "Kyldo": "Tömye'nin eski yazısı. Araçlar → Kyldo yazısı'nda harf harf okumayı öğrenebilirsin.",
  "Evrengezer": "Evrenler arasında gezen kişiler. E25 onların evreni; 10. seviyede kendi Evrengezerini yaratırsın.",
  "E25": "25. evren: Evrengezerlerin evreni. Okurların Evrengezerleri de burada.",
  "E99": "99. evren: bomboş, herkesin birlikte yazdığı evren.",
  "buz": "Kilitli kayıt ya da katman. Kodla, oyun ödülleriyle ya da okudukça çözülür."
};
const TERIM_ANAHTAR = "tentiforapp_terimler_goruldu";

function terimleriIsaretle() {
  const kok = document.querySelector("main");
  if (!kok || !veri) { return; }
  const goruldu = jsonOku(TERIM_ANAHTAR, {}) || {};
  const kalan = Object.keys(TERIMLER).filter(function (t) { return !goruldu[t]; });
  if (!kalan.length) { return; }
  const ilk = {};
  document.querySelectorAll("main .terim").forEach(function (x) { ilk[x.dataset.terim] = true; });
  const re = new RegExp("(^|[^0-9A-Za-zÇĞİÖŞÜçğıöşü])(" + kalan.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")(?=$|[^0-9A-Za-zÇĞİÖŞÜçğıöşü])");
  const yuru = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      const p = n.parentElement;
      if (!p || p.closest("a, button, input, textarea, select, svg, code, .terim, [contenteditable], [hidden], .kanon-onizleme, script, style, label, summary")) { return NodeFilter.FILTER_REJECT; }
      return re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  const dugumler = [];
  while (yuru.nextNode()) { dugumler.push(yuru.currentNode); }
  dugumler.forEach(function (n) {
    const m = n.nodeValue.match(re);
    if (!m || ilk[m[2]]) { return; }
    const p = n.parentElement;
    if (!p || !p.offsetParent) { return; }   /* görünmeyen yerde işaretleme */
    ilk[m[2]] = true;
    const bas = m.index + m[1].length;
    const once = document.createTextNode(n.nodeValue.slice(0, bas));
    const sonra = document.createTextNode(n.nodeValue.slice(bas + m[2].length));
    const b = document.createElement("button");
    b.type = "button"; b.className = "terim"; b.dataset.terim = m[2]; b.textContent = m[2];
    b.setAttribute("aria-label", m[2] + ": ne demek?");
    n.parentNode.insertBefore(once, n); n.parentNode.insertBefore(b, n); n.parentNode.insertBefore(sonra, n); n.remove();
  });
}

function terimGoster(el) {
  document.querySelectorAll(".terim-balon").forEach(function (x) { x.remove(); });
  const t = el.dataset.terim;
  const b = document.createElement("div");
  b.className = "terim-balon";
  b.setAttribute("role", "tooltip");
  b.innerHTML = "<b>" + kacir(t) + "</b><p>" + kacir(TERIMLER[t] || "") + '</p><button type="button" class="ic-bag" data-terim-kapat>Anladım</button>';
  document.body.appendChild(b);
  const r = el.getBoundingClientRect();
  const gen = Math.min(300, window.innerWidth - 24);
  b.style.width = gen + "px";
  b.style.left = Math.max(12, Math.min(window.innerWidth - gen - 12, r.left + window.scrollX - 20)) + "px";
  b.style.top = (r.bottom + window.scrollY + 8) + "px";
  const g = jsonOku(TERIM_ANAHTAR, {}) || {};
  g[t] = 1;
  jsonYaz(TERIM_ANAHTAR, g);
}

document.addEventListener("click", function (ev) {
  const t = ev.target.closest && ev.target.closest(".terim");
  if (t) { ev.preventDefault(); terimGoster(t); return; }
  if (ev.target.closest && (ev.target.closest("[data-terim-kapat]") || !ev.target.closest(".terim-balon"))) {
    document.querySelectorAll(".terim-balon").forEach(function (x) { x.remove(); });
  }
});

/* ==================== 7. eçka göstergesi ilk kazanca kadar gizli ==================== */

function eckaYeniMi() { return typeof cuzdan !== "undefined" && !(cuzdan.kazanilan > 0) && !(cuzdan.harcanan > 0); }

function eckaGostergesiAyarla() {
  document.documentElement.classList.toggle("ecka-yeni", eckaYeniMi());
}

/** İlk eçkan kazanılınca cüzdanın altında açıklama balonu. */
function eckaIlkBalon() {
  const el = document.querySelector("#cuzdanTutar");
  if (!el) { return; }
  const b = document.createElement("div");
  b.className = "terim-balon ecka-ilk";
  b.setAttribute("role", "status");
  b.innerHTML = "<b>İlk eçkan geldi!</b><p>" + kacir(TERIMLER["eçka"]) + " Buna dokununca neler alabileceğini görürsün.</p>" +
    '<button type="button" class="ic-bag" data-terim-kapat>Tamam</button>';
  document.body.appendChild(b);
  const r2 = el.getBoundingClientRect();
  const gen = Math.min(290, window.innerWidth - 24);
  b.style.width = gen + "px";
  b.style.left = Math.max(12, Math.min(window.innerWidth - gen - 12, r2.left + window.scrollX - 40)) + "px";
  b.style.top = (r2.bottom + window.scrollY + 8) + "px";
}

/* ==================== 8. eçka penceresi ==================== */

sonraSar("cuzdanPenceresi", function (eskiPencere) {
  return function () {
    const r = eskiPencere.apply(this, arguments);
    const p = document.querySelector("#perde .pencere");
    if (!p) { return r; }
    const baslik = p.querySelector("h3");
    const alt = p.querySelector(".pencere-alt");
    const bilgi = '<div class="ecka-neler"><div class="oyun-etiket">eçka ile neler alabilirsin</div><ul>' +
      '<li><a href="#galeri" data-kapat="1">Galeri</a> — kilitli görseller</li>' +
      '<li><a href="#temalar" data-kapat="1">Temalar</a> — sitenin rengi, yazı tipleri</li>' +
      '<li><a href="#oyunlar" data-kapat="1">Boyut Sürüklenmesi</a> — kilitli oyun</li>' +
      "<li>Evrengezer bürosu — başka evrenlerin parası</li></ul>" +
      '<p class="oyun-not">Kazanmak için: kutuları sonuna kadar oku, oyna, günün görevini yap.</p></div>';
    (alt || baslik).insertAdjacentHTML("afterend", bilgi);
    /* yedek kodu: düğmenin arkasında */
    Array.prototype.forEach.call(p.querySelectorAll(".oyun-etiket"), function (e) {
      if (!/^Yedekleme$/i.test(e.textContent.trim())) { return; }
      const blok = e.closest(".arac-blok");
      if (!blok || blok.closest("details")) { return; }
      const d = document.createElement("details");
      d.className = "ecka-yedek";
      d.innerHTML = "<summary>Yedek kodu · ilerlemeni başka cihaza taşı</summary>";
      blok.parentNode.insertBefore(d, blok);
      d.appendChild(blok);
      e.remove();
    });
    return r;
  };
});

/* ==================== 11. hesap: ne kazandırır, Google ile giriş ==================== */

const HESAP_FAYDA = ["İlerlemen her cihazda seninle: okuduğun, eçka, rozetler, kendi evrenlerin",
  "XP sunucuda sayılır: seviye atlarsın, liderlikte yer alırsın", "Kulüplere katıl, teori yaz, evrenleri takip et"];

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-google-giris]");
  if (!b || typeof hesapIstemci === "undefined" || !hesapIstemci) { return; }
  b.disabled = true;
  try {
    const { error } = await hesapIstemci.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
    if (error) { throw error; }
  } catch (e) {
    b.disabled = false;
    const m = String((e && e.message) || e);
    b.insertAdjacentHTML("afterend", '<p class="pencere-durum kotu">' + kacir(/provider is not enabled|Unsupported provider/i.test(m)
      ? "Google girişi henüz açılmadı (yönetici Supabase'de Google'ı etkinleştirmeli). E-postayla devam edebilirsin." : "Google'a bağlanılamadı: " + m) + "</p>");
  }
});

/* ==================== 15. geri bildirim ==================== */

function geriBildirimPenceresi() {
  const p = document.querySelector("#perde");
  if (!p) { return; }
  p.innerHTML = '<div class="pencere" role="dialog" aria-modal="true" aria-label="Geri bildirim">' +
    '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
    "<h3>Bir sorun mu var?</h3>" +
    '<p class="pencere-alt">Bozuk bir şey, anlaşılmayan bir yer ya da bir fikir — yazara doğrudan gider.</p>' +
    '<textarea class="kod-giris arac-giris" id="gbMetin" rows="5" maxlength="480" placeholder="Ne oldu? Hangi sayfada?"></textarea>' +
    '<input class="kod-giris arac-giris" id="gbIletisim" maxlength="80" placeholder="Cevap istersen: e-posta ya da Instagram (isteğe bağlı)">' +
    '<button class="dugme dugme-tam" data-gb-gonder>Gönder</button><p class="pencere-durum" id="gbDurum" role="status"></p></div>';
  p.hidden = false;
  const t = document.querySelector("#gbMetin");
  if (t) { t.focus(); }
}

async function geriBildirimGonder() {
  const metin = (document.querySelector("#gbMetin") || {}).value || "";
  const ilet = (document.querySelector("#gbIletisim") || {}).value || "";
  const d = document.querySelector("#gbDurum");
  if (metin.trim().length < 3) { if (d) { d.textContent = "Birkaç kelime yaz"; d.className = "pencere-durum kotu"; } return; }
  const govde = { p_mesaj: "[Geri bildirim] " + metin.trim().slice(0, 440) + (ilet.trim() ? " · iletişim: " + ilet.trim().slice(0, 60) : ""),
    p_kaynak: "geri-bildirim", p_adres: String(location.pathname + location.hash).slice(0, 280), p_tarayici: String(navigator.userAgent || "").slice(0, 280),
    p_surum: String((veri && veri.surum) || "") };
  try {
    if (typeof HESAP_AYAR === "undefined" || !HESAP_AYAR.url) { throw new Error("sunucu yok"); }
    const y = await fetch(HESAP_AYAR.url + "/rest/v1/rpc/hata_kaydet", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: HESAP_AYAR.anahtar, Authorization: "Bearer " + HESAP_AYAR.anahtar },
      body: JSON.stringify(govde)
    });
    if (!y.ok) { throw new Error("HTTP " + y.status); }
    if (d) { d.textContent = "Gönderildi, teşekkürler!"; d.className = "pencere-durum iyi"; }
    const b = document.querySelector("[data-gb-gonder]"); if (b) { b.disabled = true; }
  } catch (e) {
    if (d) { d.textContent = "Gönderilemedi (internet?). Biraz sonra yeniden dene."; d.className = "pencere-durum kotu"; }
  }
}

document.addEventListener("click", function (ev) {
  if (ev.target.closest && ev.target.closest("[data-geri-bildirim]")) { ev.preventDefault(); geriBildirimPenceresi(); return; }
  if (ev.target.closest && ev.target.closest("[data-gb-gonder]")) { geriBildirimGonder(); }
});

function geriBildirimBaglantisi() {
  const f = document.querySelector("footer");
  if (f && !f.querySelector("[data-geri-bildirim]")) {
    f.insertAdjacentHTML("afterbegin", '<p class="geri-bildirim-satir"><button type="button" class="ic-bag" data-geri-bildirim>Bir sorun mu var? Yaz</button></p>');
  }
}

/* ==================== sayfa hazır olunca ==================== */

let ilkDenZaman = null;
new MutationObserver(function () {
  if (ilkDenZaman) { return; }
  ilkDenZaman = setTimeout(function () {
    /* 3.0: işaretleme tarayıcı boşken */
    (window.requestIdleCallback || setTimeout)(function () {
      ilkDenZaman = null;
      try { terimleriIsaretle(); } catch (_) { /* yok */ }
    }, { timeout: 1500 });
  }, 700);
}).observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener("load", function () {
  setTimeout(function () {
    try { geriBildirimBaglantisi(); eckaGostergesiAyarla(); bugunKartiCiz(); } catch (_) { /* yok */ }
  }, 300);
});
