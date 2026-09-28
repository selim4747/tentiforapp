/* Hesaplar — kayıt, giriş, çıkış, şifre sıfırlama, profil ve ilerleme eşitleme.

   Arka uç Supabase (supabase/kurulum.sql). Hesap zorunlu değil: hesabı olmayan
   ziyaretçi siteyi eskisi gibi kullanır. Kod sistemi aynen durur; girilen kodlar
   (çözülen katmanlar, kişiye özel erişim) ilerlemenin parçası olarak hesapla
   birlikte eşitlenir.

   İki tablo:
     profiller   — herkese açık: kullanıcı adı, görünen ad, hakkında, Tentiforverse adı, özet
     ilerlemeler — yalnızca sahibi: tentiforapp_* kayıtlarının anlık görüntüsü

   HESAP_AYAR boşken hiçbir şey yüklenmez ve hesap düğmesi çıkmaz. */

const HESAP_AYAR = {
  url: "https://wlgtjbrlquefnzavwein.supabase.co",        /* Supabase → Project Settings → Data API → Project URL */
  anahtar: "sb_publishable_CHM9EAA3V5nZeQcmKtR0UQ__Xyb4b_F"  /* publishable key — gizli değildir, sitede görünmesi normal */
};

const HESAP_KUTUPHANE = "js/vendor/supabase-2.117.2.js";
const HESAP_OTURUM_ANAHTAR = "sb-tentiforapp-oturum";   /* tentiforapp_ ile başlamaz: eşitlenmez, sıfırlamada silinmez */
const HESAP_ESIT_ANAHTAR = "sb-tentiforapp-esitleme";   /* { [kullanıcıId]: { iz, zaman } } bu cihazın son eşitlemesi */

/* Asla buluta gitmeyenler: yönetici bilgileri ve bu cihaza özgü kayıtlar. */
const ESITLEME_DISI = [
  "tentiforapp_github", "tentiforapp_yonetici", "tentiforapp_katman_kodlari", "tentiforapp_duzenleme",
  "tentiforapp_konum", "tentiforapp_sayfa", "tentiforapp_tur",
  "tentiforapp_ziyaret_izleri", "tentiforapp_ziyaret_fark", "tentiforapp_fan_acilan", "tentiforapp_bildirim", "tentiforapp_yayin_kancasi",
  "tentiforapp_cihaz_id"
];

/* Bu anahtarlardan biri varsa cihazda "gerçek" ilerleme var sayılır. (rol_gecmis ilk
   açılışta kendiliğinden yazıldığı için burada yok; cüzdan yalnızca eçka oynayınca yazılır.) */
const ILERLEME_ISARETLERI = [
  "tentiforapp_cuzdan", "tentiforapp_cozulen", "tentiforapp_madalyalar", "tentiforapp_kanon_profiller",
  "tentiforapp_okuma_gecmis", "tentiforapp_defter", "tentiforapp_notlar", "tentiforapp_vurgular", "tentiforapp_nobet_skor"
];

let hesapIstemci = null;
let hesapKullanici = null;     /* Supabase kullanıcısı */
let hesapProfil = null;        /* kendi profiller satırı */
let hesapHazir = false;        /* ilk oturum kontrolü bitti mi */
let hesapEsitDurum = "";       /* ekranda gösterilen eşitleme durumu */
let hesapEsitZamanlayici = 0;

function hesapEtkin() { return !!(HESAP_AYAR.url && HESAP_AYAR.anahtar); }

/* ==================== kurulum ==================== */

function hesapKutuphaneYukle() {
  if (window.supabase && window.supabase.createClient) { return Promise.resolve(); }
  return new Promise(function (coz, reddet) {
    const s = document.createElement("script");
    s.src = HESAP_KUTUPHANE;
    s.onload = coz;
    s.onerror = function () { reddet(new Error("hesap kütüphanesi yüklenemedi")); };
    document.head.appendChild(s);
  });
}

/* Okuma önbelleği: tablolar, liderlik, listeler 90 saniye cihazda tutulur; sayfalar arasında gidip gelince
   sunucu yeniden sorulmaz. Herhangi bir yazma (oy, teori, kayıt…) önbelleği boşaltır, yazdığın hemen görünür.
   İlerleme (ilerlemeler) ve giriş işleri hiç önbelleğe girmez. */
const OKUMA_ONBELLEK = new Map();
const OKUMA_SURE = 90000;
const OKUMA_RPC = ["uygulama_skor_tablosu", "gk_istatistik", "evren_defter_oku", "takip_ettiklerim", "tepkilerim", "oylarim", "haftalik_ilerleme", "evren_istatistik",
  "yonetici_mi", "tek_kodlarim", "gk_durum", "gk_seri", "davet_durumum", "ortak_evrenlerim"];

/* 3.0 — kendi verin sayfa yenilense de 5 dakika bu sekmede kalır (sessionStorage): her sayfa açılışında ~20 okuma
   yerine yalnızca değişenler gider. Yalnızca senin satırların (id/kullanıcı adın süzgeçte) ve yalnızca senin
   işlemlerinle değişen RPC'ler; herhangi bir yazma yine hepsini boşaltır, çıkışta silinir. */
const OKUMA_KALICI = "tf30_okuma";
const OKUMA_KALICI_SURE = 5 * 60000;
const OKUMA_KALICI_RPC = ["yonetici_mi", "tek_kodlarim", "gk_durum", "gk_seri", "haftalik_ilerleme"];

function okumaKaliciMi(url, yontem, rpc) {
  if (rpc) { return yontem === "POST" && OKUMA_KALICI_RPC.indexOf(rpc) !== -1; }
  if (yontem !== "GET" || !/\/rest\/v1\/(?:profiller|arsivci_seviyeleri|yaris_tablolari|kyldo_toplam|kasif_sayilari|istatistikler|liderlik)\?/.test(url)) { return false; }
  const ben = [];
  if (typeof hesapKullanici !== "undefined" && hesapKullanici && hesapKullanici.id) { ben.push("id=eq." + hesapKullanici.id); }
  if (typeof hesapProfil !== "undefined" && hesapProfil && hesapProfil.kullanici_adi) { ben.push("kullanici_adi=eq." + encodeURIComponent(hesapProfil.kullanici_adi)); }
  return ben.some(function (b) { return url.indexOf(b) !== -1 && /(?:^|[?&])(?:id|kullanici_adi)=eq\./.test(url); });
}
function okumaKaliciOku() {
  try { return JSON.parse(sessionStorage.getItem(OKUMA_KALICI) || "{}") || {}; } catch (_) { return {}; }
}
function okumaKaliciYaz(anahtar, r) {
  try {
    const t = okumaKaliciOku();
    const simdi = Date.now();
    Object.keys(t).forEach(function (k) { if (simdi - t[k].zaman > OKUMA_KALICI_SURE) { delete t[k]; } });
    t[anahtar] = { zaman: simdi, govde: r.govde, durum: r.durum, basliklar: r.basliklar };
    sessionStorage.setItem(OKUMA_KALICI, JSON.stringify(t));
  } catch (_) { /* dolu ya da kapalı: yalnızca bellek */ }
}
function okumaKaliciTemizle() { try { sessionStorage.removeItem(OKUMA_KALICI); } catch (_) { /* yok */ } }

/* 3.0: hangi yazma hangi okumaları eskitir. Açılıştaki eşitleme yazmaları (ilerleme, istatistik, sayaç, hata)
   bütün önbelleği silmesin: yoksa her sayfa açılışında hepsi yeniden sorulurdu. Tanınmayan yazma hepsini siler. */
const OKUMA_YAZMA_ETKI = {
  ilerlemeler: [], sayac_toplu: [], sayac_artir: [], hata_kaydet: [], olay_say: [],
  profiller: ["profiller", "liderlik"],   /* eşitlemede profil özeti */
  istatistik_gonder: ["istatistikler", "arsivci_seviyeleri", "liderlik"]
};
function okumaYazmaTemizle(url, rpc) {
  const tablo = rpc || (/\/rest\/v1\/([a-z0-9_]+)/.exec(url) || [])[1] || "";
  const hedefler = OKUMA_YAZMA_ETKI[tablo];
  if (!hedefler) { OKUMA_ONBELLEK.clear(); okumaKaliciTemizle(); return; }
  if (!hedefler.length) { return; }
  const eski = function (k) { return hedefler.some(function (t) { return k.indexOf("/rest/v1/" + t + "?") !== -1 || k.indexOf("/rest/v1/rpc/" + t) !== -1; }); };
  Array.from(OKUMA_ONBELLEK.keys()).forEach(function (k) { if (eski(k)) { OKUMA_ONBELLEK.delete(k); } });
  try {
    const t = okumaKaliciOku();
    Object.keys(t).forEach(function (k) { if (eski(k)) { delete t[k]; } });
    sessionStorage.setItem(OKUMA_KALICI, JSON.stringify(t));
  } catch (_) { /* yok */ }
}

function hesapOnbellekliFetch(girdi, secenek) {
  const url = typeof girdi === "string" ? girdi : (girdi && girdi.url) || "";
  const yontem = String((secenek && secenek.method) || (girdi && girdi.method) || "GET").toUpperCase();
  const rest = url.indexOf("/rest/v1/") !== -1;
  const rpc = (/\/rest\/v1\/rpc\/([a-z0-9_]+)/.exec(url) || [])[1];
  const okuma = rest && !window.__okumaOnbellegiKapali && !/\/rest\/v1\/ilerlemeler/.test(url) &&
    ((yontem === "GET" || yontem === "HEAD") ? !rpc : (yontem === "POST" && OKUMA_RPC.indexOf(rpc) !== -1));
  if (rest && !okuma && yontem !== "GET" && yontem !== "HEAD") { okumaYazmaTemizle(url, rpc); }   /* yazma: ilgili okumalar boşalır */
  if (!okuma) { return fetch(girdi, secenek); }
  let yetki = "";
  try { yetki = new Headers((secenek && secenek.headers) || {}).get("Authorization") || ""; } catch (_) { yetki = ""; }
  const anahtar = yontem + " " + url + " " + ((secenek && typeof secenek.body === "string") ? secenek.body : "") + " " + yetki.slice(-24);
  const yanit = function (r) { return new Response(r.govde, { status: r.durum, headers: r.basliklar }); };
  const kalici = okumaKaliciMi(url, yontem, rpc);
  if (kalici && !OKUMA_ONBELLEK.has(anahtar)) {
    const kk = okumaKaliciOku()[anahtar];
    if (kk && Date.now() - kk.zaman < OKUMA_KALICI_SURE) { return Promise.resolve(yanit(kk)); }
  }
  const k = OKUMA_ONBELLEK.get(anahtar);
  if (k && Date.now() - k.zaman < OKUMA_SURE) {
    /* yoldaki istek de paylaşılır: aynı anda iki okuma tek istek olur */
    return k.soz.then(function (r) { return r ? yanit(r) : fetch(girdi, secenek); });
  }
  let coz;
  const kayit = { zaman: Date.now(), soz: new Promise(function (c) { coz = c; }) };
  OKUMA_ONBELLEK.set(anahtar, kayit);
  if (OKUMA_ONBELLEK.size > 200) { OKUMA_ONBELLEK.delete(OKUMA_ONBELLEK.keys().next().value); }
  return fetch(girdi, secenek).then(function (y) {
    if (!y.ok) { OKUMA_ONBELLEK.delete(anahtar); coz(null); return y; }
    return y.text().then(function (govde) {
      const b = {}; y.headers.forEach(function (v, a) { b[a] = v; });
      const r = { govde: govde, durum: y.status, basliklar: b };
      coz(r);
      if (kalici) { okumaKaliciYaz(anahtar, r); }
      return yanit(r);
    });
  }, function (e) { OKUMA_ONBELLEK.delete(anahtar); coz(null); throw e; });
}

let hesapKuruluyor = null;   /* hesapIstemciKur sözü: kütüphane bir kez yüklenir */

/** 24-arsiv-mantigi.js çizimden sonra bir kez çağırır.
    Hız için hesap kütüphanesi (218 KB) yalnızca gerekince yüklenir: oturumu olan
    ya da e-posta bağlantısından dönen ziyaretçide hemen; diğerlerinde giriş,
    liderlik, yarış ya da profil açıldığında (hesapGerekli). */
async function hesapBaslat() {
  hesapDugmesiCiz();
  if (!hesapEtkin()) { hesapHazir = true; hesapCiz(); return; }

  /* /u/kullaniciadi paylaşım adresi (_redirects → ?profil=) */
  const q = new URLSearchParams(location.search);
  if (q.get("profil")) {
    const ad = q.get("profil");
    try { history.replaceState(null, "", rotadanYol("#/u/" + encodeURIComponent(ad))); } catch (_) { /* yoksay */ }
    if (typeof hesapProfilAc === "function") { hesapProfilAc(ad); }
  }

  let oturumVar = false;
  try { oturumVar = !!window.localStorage.getItem(HESAP_OTURUM_ANAHTAR); } catch (_) { oturumVar = false; }
  const donus = q.get("code") || q.get("hesap") || q.get("error");
  if (oturumVar || donus) { await hesapGerekli(); return; }

  hesapHazir = true;
  hesapDugmesiCiz();
  hesapCiz();
}

/** Hesap kütüphanesi ve istemci hazır olsun; hazır olunca çözülür. */
function hesapGerekli() {
  if (!hesapEtkin()) { return Promise.resolve(); }
  if (!hesapKuruluyor) { hesapKuruluyor = hesapIstemciKur(); }
  return hesapKuruluyor;
}

/** Kütüphaneyi ancak alan ekrana yaklaşınca yükler; kod kilidinin arkasındaki (görünmeyen) alanlar hiç yüklemez.
    Hesap açmamış ziyaretçi 213 KB'lık kütüphaneyi yalnızca gerçekten kullanacağı bir bölüme gelince indirir. */
const hesapGozlenen = new WeakSet();
function hesapGorununce(el, fn) {
  if (!el || !hesapEtkin()) { return; }
  if (el.closest(".kanon-kilitli")) { return; }
  if (typeof IntersectionObserver !== "function") { hesapGerekli().then(fn); return; }
  if (hesapGozlenen.has(el)) { return; }
  hesapGozlenen.add(el);
  const g = new IntersectionObserver(function (girdiler) {
    if (!girdiler.some(function (x) { return x.isIntersecting; })) { return; }
    g.disconnect();
    hesapGozlenen.delete(el);
    hesapGerekli().then(fn);
  }, { rootMargin: "400px 0px" });
  g.observe(el);
}

async function hesapIstemciKur() {
  try {
    await hesapKutuphaneYukle();
    hesapIstemci = window.supabase.createClient(HESAP_AYAR.url, HESAP_AYAR.anahtar, {
      auth: {
        flowType: "pkce",             /* e-posta dönüşü ?code= ile gelir; sitenin #/ adresleriyle çakışmaz */
        detectSessionInUrl: false,     /* dönüşü aşağıda kendimiz karşılıyoruz */
        persistSession: true,
        autoRefreshToken: true,
        storageKey: HESAP_OTURUM_ANAHTAR
      },
      global: { fetch: hesapOnbellekliFetch }
    });
  } catch (e) {
    console.error("[TentiforApp] hesap:", e);
    hesapHazir = true;
    hesapDugmesiCiz();
    return;
  }

  await hesapDonusKarsila();

  const { data } = await hesapIstemci.auth.getSession();
  await hesapOturumAyarla(data && data.session ? data.session.user : null, "baslangic");

  hesapIstemci.auth.onAuthStateChange(function (olay, oturum) {
    if (olay === "PASSWORD_RECOVERY") { hesapPencere("yenisifre"); return; }
    if (olay === "SIGNED_IN" || olay === "SIGNED_OUT" || olay === "USER_UPDATED") {
      /* supabase-js bu geri çağrı içinde başka auth çağrısı beklenmesini sevmez */
      setTimeout(function () { hesapOturumAyarla(oturum ? oturum.user : null, olay); }, 0);
    }
  });
}

/** E-posta bağlantısından dönüş: ?code=...&hesap=onay|yenisifre ya da ?error=... */
async function hesapDonusKarsila() {
  const q = new URLSearchParams(location.search);
  const kod = q.get("code");
  const tur = q.get("hesap");
  const hata = q.get("error_description") || q.get("error");
  if (!kod && !hata && !tur) { return; }

  /* adresi temizle: yenilenince ya da paylaşılınca kod tekrar kullanılmasın */
  try { history.replaceState(null, "", location.pathname + location.hash); } catch (_) { /* yoksay */ }

  if (hata) { hesapBildir("Bağlantı geçersiz ya da süresi dolmuş. Yeniden dene."); return; }
  if (!kod) { return; }

  const { error } = await hesapIstemci.auth.exchangeCodeForSession(kod);
  if (error) {
    /* Bağlantı başka bir tarayıcıda açıldıysa oturum kurulamaz, ama e-posta onaylanmıştır. */
    if (tur === "onay") { hesapBildir("E-postan onaylandı. Şimdi giriş yapabilirsin."); hesapPencere("giris"); }
    else { hesapBildir("Bağlantı bu tarayıcıda açılamadı. Şifre sıfırlamayı yeniden iste."); }
    return;
  }
  if (tur === "yenisifre") { hesapPencere("yenisifre"); }
  else { hesapBildir("E-postan onaylandı, hoş geldin!"); }
}

async function hesapOturumAyarla(kullanici, olay) {
  const onceki = hesapKullanici && hesapKullanici.id;
  hesapKullanici = kullanici || null;

  if (!hesapKullanici) {
    hesapProfil = null;
    clearInterval(hesapEsitZamanlayici);
    hesapEsitDurum = "";
  } else if (onceki !== hesapKullanici.id || olay === "baslangic") {
    await hesapProfilYukle();
    await hesapIlkEsitleme();
    clearInterval(hesapEsitZamanlayici);
    hesapEsitZamanlayici = setInterval(function () { if (document.visibilityState === "visible") { hesapEsitle(); } }, ESIT_ARALIK);
  }

  hesapHazir = true;
  hesapDugmesiCiz();
  hesapCiz();
  if (typeof liderlikCiz === "function") { liderlikCiz(); }
  if (hesapKullanici && typeof liderlikGonder === "function") { liderlikGonder(); }
  if (typeof yarislarCiz === "function") { yarislarCiz(); }
  if (hesapKullanici && typeof yarisIcerikEsitle === "function") { yarisIcerikEsitle(); }
}

async function hesapProfilYukle() {
  if (!hesapKullanici) { return; }
  const { data } = await hesapIstemci.from("profiller").select("*").eq("id", hesapKullanici.id).maybeSingle();
  hesapProfil = data || { id: hesapKullanici.id };
}

/* ==================== yardımcılar ==================== */

function hesapBildir(m) { if (typeof eckaBildir === "function") { eckaBildir(m); } }

function kullaniciAdiGecerli(a) { return /^[a-z0-9_]{3,20}$/.test(a); }

/** Yazılan kullanıcı adını sadeleştirir: "Selİm" → "selim", "Şule" → "sule". */
function kullaniciAdiSade(a) { return trNormal(String(a || "").trim()); }

/** Türkçe harfleri sadeleştirip kullanıcı adı önerir: "Selim K." → "selim_k" */
function kullaniciAdiOner(ad) {
  return trNormal(String(ad || "")).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);
}

/** Supabase'in İngilizce hata mesajlarını okunur Türkçeye çevirir. */
function hesapHataMetni(hata) {
  const m = String((hata && (hata.message || hata.error_description)) || hata || "");
  const esle = [
    [/invalid login credentials/i, "E-posta ya da şifre hatalı."],
    [/email not confirmed/i, "E-postanı henüz onaylamadın. Gelen kutunu (ve gereksiz klasörünü) kontrol et."],
    [/already registered|already been registered/i, "Bu e-postayla zaten bir hesap var. Giriş yapmayı dene."],
    [/password should be at least|password is too short/i, "Şifre çok kısa: en az 8 karakter olmalı."],
    [/weak password|password is known to be weak/i, "Bu şifre çok zayıf. Daha uzun ve tahmin edilmesi zor bir şifre seç."],
    [/rate limit|too many requests|security purposes/i, "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene."],
    [/unable to validate email|invalid email|email address .* is invalid/i, "Geçerli bir e-posta adresi yaz."],
    [/same password|should be different/i, "Yeni şifre eskisiyle aynı olamaz."],
    [/database error saving new user|duplicate key|profiller_kullanici_adi_key/i, "Bu kullanıcı adı alınmış. Başka bir ad seç."],
    [/failed to fetch|network/i, "Bağlantı kurulamadı. İnternetini kontrol et."],
    [/schema cache|could not find the (table|column|function)|relation .* does not exist|function .* does not exist|PGRST20[25]/i,
      (typeof panelAcik === "function" && panelAcik())
        ? "Veritabanı kurulumu eksik: panelde Bakım → Kurulum'dan SQL'i çalıştır."
        : "Bu özellik henüz açılmadı; çok yakında burada."]
  ];
  for (let i = 0; i < esle.length; i++) { if (esle[i][0].test(m)) { return esle[i][1]; } }
  return m || "Bir şeyler ters gitti.";
}

function hesapDonusAdresi(tur) {
  /* Android uygulaması: e-postadaki bağlantı uygulamanın kendisini açsın (js/78, uygulama/ac/) */
  if (typeof kabukMu === "function" && kabukMu()) { return location.origin + "/uygulama/ac/?hesap=" + tur; }
  return location.origin + location.pathname + "?hesap=" + tur;
}

/** Paylaşılan profil adresi: canlı sitede kısa /u/ad (_redirects yönlendirir), yerelde #/u/ad. */
function hesapProfilAdresi(ad) {
  if (location.protocol === "https:") { return location.origin + "/u/" + encodeURIComponent(ad); }
  return rotaAdresi("#/u/" + encodeURIComponent(ad));
}

/** Avatar: görünen adın ilk hecesi Kyldo yazısıyla, yuvarlak içinde. */
function hesapAvatar(p, boyut) {
  const ad = (p && (p.gorunen_ad || p.kullanici_adi)) || "?";
  const b = boyut || 40;
  const hece = (typeof heceleraAyir === "function" && veri && veri.alfabe) ? heceleraAyir(ad.split(/\s+/)[0])[0] : null;
  return '<span class="hesap-avatar" style="width:' + b + "px;height:" + b + 'px" aria-hidden="true">' +
           (hece ? heceSvg(hece, Math.round(b * 0.8)) : kacir(ad.charAt(0).toLocaleUpperCase("tr"))) +
         "</span>";
}

function hesapGorunenAd() {
  return (hesapProfil && (hesapProfil.gorunen_ad || hesapProfil.kullanici_adi)) ||
         (hesapKullanici && hesapKullanici.email) || "";
}

/* ==================== üst şeritteki düğme ==================== */

function hesapDugmesiCiz() {
  const ust = document.querySelector("header.ust");
  if (!ust) { return; }
  let b = document.querySelector("#hesapBtn");

  if (!hesapEtkin()) { if (b) { b.remove(); } document.documentElement.removeAttribute("data-hesap"); return; }
  document.documentElement.setAttribute("data-hesap", hesapKullanici ? "acik" : "kapali");

  if (!b) {
    b = document.createElement("button");
    b.id = "hesapBtn";
    b.className = "hesap-btn";
    ust.appendChild(b);
  }

  if (hesapKullanici) {
    b.innerHTML = hesapAvatar(hesapProfil, 30);
    b.setAttribute("aria-label", "Hesabın: " + hesapGorunenAd());
    b.title = hesapGorunenAd();
  } else {
    b.innerHTML = '<span class="hesap-btn-yazi">Giriş</span>';
    b.setAttribute("aria-label", "Giriş yap ya da hesap oluştur");
    b.title = "Giriş yap";
  }
}

/* ==================== pencereler ==================== */

let hesapKayitAdKontrol = 0;

function hesapPencere(tur) {
  const perde = document.querySelector("#perde");
  if (!perde) { return; }
  if (!hesapIstemci) { hesapGerekli().then(function () { if (hesapIstemci) { hesapPencere(tur); } }); return; }

  const alan = function (id, etiket, tip, oz) {
    return "<label class=\"hesap-etiket\" for=\"" + id + "\">" + etiket + "</label>" +
           '<input class="kod-giris" id="' + id + '" type="' + tip + '" ' + (oz || "") + ">";
  };
  const alt = function (baglantilar) {
    return '<p class="hesap-alt">' + baglantilar.map(function (b) {
      return '<button class="ic-bag" data-hesap-pencere="' + b[0] + '">' + b[1] + "</button>";
    }).join(" · ") + "</p>";
  };

  let govde = "";
  if (tur === "giris") {
    govde = "<h3>Giriş yap</h3>" +
      '<p class="pencere-alt">İlerlemen hesabınla birlikte her cihazda seninle gelir.</p>' +
      '<form data-hesap-form="giris">' +
        alan("hGirisEposta", "E-posta", "email", 'autocomplete="email" required') +
        alan("hGirisSifre", "Şifre", "password", 'autocomplete="current-password" required') +
        '<button class="dugme dugme-tam" type="submit">Giriş yap</button>' +
      "</form>" + alt([["kayit", "Hesap oluştur"], ["unuttum", "Şifremi unuttum"]]);
  } else if (tur === "kayit") {
    govde = "<h3>Hesap oluştur</h3>" +
      '<p class="pencere-alt">Profilin herkese açık olur; ilerlemen yalnızca sana görünür.</p>' +
      '<form data-hesap-form="kayit">' +
        alan("hKayitAd", "Görünen ad", "text", 'maxlength="40" autocomplete="nickname" required') +
        alan("hKayitKullanici", "Kullanıcı adı", "text",
             'maxlength="20" autocomplete="username" spellcheck="false" required placeholder="küçük harf, rakam, _"') +
        '<p class="hesap-ipucu" id="hKayitKullaniciDurum"></p>' +
        alan("hKayitEposta", "E-posta", "email", 'autocomplete="email" required') +
        alan("hKayitSifre", "Şifre", "password", 'autocomplete="new-password" minlength="8" required placeholder="en az 8 karakter"') +
        '<button class="dugme dugme-tam" type="submit">Hesap oluştur</button>' +
      "</form>" + alt([["giris", "Zaten hesabım var"]]);
  } else if (tur === "unuttum") {
    govde = "<h3>Şifremi unuttum</h3>" +
      '<p class="pencere-alt">E-postana şifre sıfırlama bağlantısı gönderelim.</p>' +
      '<form data-hesap-form="unuttum">' +
        alan("hUnuttumEposta", "E-posta", "email", 'autocomplete="email" required') +
        '<button class="dugme dugme-tam" type="submit">Bağlantı gönder</button>' +
      "</form>" + alt([["giris", "Girişe dön"]]);
  } else if (tur === "yenisifre") {
    govde = "<h3>Yeni şifre</h3>" +
      '<p class="pencere-alt">Hesabın için yeni bir şifre belirle.</p>' +
      '<form data-hesap-form="yenisifre">' +
        alan("hYeniSifre", "Yeni şifre", "password", 'autocomplete="new-password" minlength="8" required') +
        alan("hYeniSifre2", "Yeni şifre (tekrar)", "password", 'autocomplete="new-password" minlength="8" required') +
        '<button class="dugme dugme-tam" type="submit">Şifreyi kaydet</button>' +
      "</form>";
  } else if (tur === "catisma") {
    govde = hesapCatismaGovde();
  }

  perde.innerHTML =
    '<div class="pencere hesap-pencere" role="dialog" aria-modal="true">' +
      (tur === "catisma" ? "" : '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>') +
      govde +
      '<p class="pencere-durum" id="hesapDurum" role="status"></p>' +
    "</div>";
  perde.hidden = false;

  const ilk = perde.querySelector("input");
  if (ilk) { ilk.focus(); }
}

function hesapDurum(m, iyi) {
  const d = document.querySelector("#hesapDurum");
  if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); }
}

function hesapFormMesgul(form, mesgul) {
  const b = form.querySelector('button[type="submit"]');
  if (b) { b.disabled = mesgul; b.classList.toggle("pasif", mesgul); }
}

async function hesapKullaniciAdiBos(ad) {
  const { data, error } = await hesapIstemci.from("profiller").select("id").eq("kullanici_adi", ad).maybeSingle();
  if (error) { return null; }     /* bilinmiyor: kaydı engelleme, veritabanı zaten çakışmayı reddeder */
  return !data || !!(hesapKullanici && data.id === hesapKullanici.id);
}

async function hesapFormGonder(tur, form) {
  const al = function (id) { const el = form.querySelector("#" + id); return el ? el.value.trim() : ""; };
  hesapFormMesgul(form, true);
  try {
    if (tur === "giris") {
      const { error } = await hesapIstemci.auth.signInWithPassword({ email: al("hGirisEposta"), password: form.querySelector("#hGirisSifre").value });
      if (error) { hesapDurum(hesapHataMetni(error)); return; }
      if (typeof perdeKapat === "function") { perdeKapat(); }
      hesapBildir("Giriş yapıldı");
      return;
    }

    if (tur === "kayit") {
      const ad = al("hKayitAd");
      const kadi = kullaniciAdiSade(al("hKayitKullanici"));
      const sifre = form.querySelector("#hKayitSifre").value;
      if (!ad) { hesapDurum("Görünen ad gerekli."); return; }
      if (!kullaniciAdiGecerli(kadi)) { hesapDurum("Kullanıcı adı 3–20 karakter olmalı: küçük harf, rakam ya da _."); return; }
      if (sifre.length < 8) { hesapDurum("Şifre en az 8 karakter olmalı."); return; }
      if ((await hesapKullaniciAdiBos(kadi)) === false) { hesapDurum("Bu kullanıcı adı alınmış. Başka bir ad seç."); return; }

      const { data, error } = await hesapIstemci.auth.signUp({
        email: al("hKayitEposta"), password: sifre,
        options: { emailRedirectTo: hesapDonusAdresi("onay"), data: { gorunen_ad: ad, kullanici_adi: kadi } }
      });
      if (error) { hesapDurum(hesapHataMetni(error)); return; }
      /* Var olan e-postada Supabase hata vermez, kimliksiz bir kullanıcı döner. */
      if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        hesapDurum("Bu e-postayla zaten bir hesap var. Giriş yapmayı dene."); return;
      }
      if (data && data.session) { if (typeof perdeKapat === "function") { perdeKapat(); } hesapBildir("Hesabın oluşturuldu"); return; }
      form.innerHTML = '<p class="hesap-bilgi">Neredeyse bitti! <b>' + kacir(al("hKayitEposta") || "E-postana") +
        "</b> adresine bir onay bağlantısı gönderdik. Bağlantıya tıklayınca hesabın açılır.</p>" +
        '<p class="oyun-not">Birkaç dakika içinde gelmezse gereksiz klasörüne bak.</p>';
      return;
    }

    if (tur === "unuttum") {
      const { error } = await hesapIstemci.auth.resetPasswordForEmail(al("hUnuttumEposta"), { redirectTo: hesapDonusAdresi("yenisifre") });
      if (error) { hesapDurum(hesapHataMetni(error)); return; }
      hesapDurum("Bu e-postayla bir hesap varsa sıfırlama bağlantısı gönderildi.", true);
      return;
    }

    if (tur === "yenisifre") {
      const s1 = form.querySelector("#hYeniSifre").value, s2 = form.querySelector("#hYeniSifre2").value;
      if (s1.length < 8) { hesapDurum("Şifre en az 8 karakter olmalı."); return; }
      if (s1 !== s2) { hesapDurum("İki şifre aynı değil."); return; }
      const { error } = await hesapIstemci.auth.updateUser({ password: s1 });
      if (error) { hesapDurum(hesapHataMetni(error)); return; }
      if (typeof perdeKapat === "function") { perdeKapat(); }
      hesapBildir("Şifren değiştirildi");
    }
  } catch (e) {
    hesapDurum(hesapHataMetni(e));
  } finally {
    if (form.isConnected) { hesapFormMesgul(form, false); }
  }
}

/** Hesaba ait ilerlemeyi cihazdan siler; yönetici/oturum/cihaz kayıtlarına dokunmaz.
    Çıkıştan sonra misafir (hesapsız) olarak temiz başlanır. */
function hesapYerelIlerlemeyiTemizle() {
  try {
    const silinecek = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.indexOf("tentiforapp_") === 0 && ESITLEME_DISI.indexOf(k) === -1) {
        silinecek.push(k);
      }
    }
    silinecek.forEach(function (k) { window.localStorage.removeItem(k); });
  } catch (_) { /* depolama kapalı */ }
}

async function hesapCikis() {
  await hesapEsitle(true, false);      /* çıkmadan son hâli hesaba kaydet (başka cihazdakiyle birleştirerek) */
  const kaydedildi = hesapEsitDurum === "kaydedildi" || hesapEsitDurum === "güncel";
  const eskiId = hesapKullanici && hesapKullanici.id;
  hesapKullanici = null;               /* bundan sonra boş hâli hesaba yazmasın */
  hesapProfil = null;
  clearInterval(hesapEsitZamanlayici);
  okumaKaliciTemizle();
  try { await hesapIstemci.auth.signOut(); } catch (_) { /* yoksay */ }
  /* hesaba yazılamadıysa (çevrimdışı) bu cihazdaki ilerleme silinmez: evrenler, eçka kaybolmasın */
  if (kaydedildi) { hesapYerelIlerlemeyiTemizle(); esitZamanSifirla(); }
  else {
    try {
      window.sessionStorage.setItem("tentiforapp_cikis_uyari", "1");
      /* cihazda kalan ilerleme bu hesabın: aynı cihazda başka hesap açılırsa ona karışmaz */
      if (eskiId) { window.localStorage.setItem(HESAP_SAHIP_ANAHTAR, eskiId); }
    } catch (_) { /* yoksay */ }
  }
  location.reload();                   /* bellek (cüzdan, kodlar, UI) misafire dönsün */
}

/* ==================== ilerleme eşitleme (2.0) ====================
   - Her kaydın ne zaman değiştiği "tentiforapp_esit_zaman"da tutulur (localStorage yazımları izlenir).
   - İki cihaz birleştirilir, biri seçilmez: açılanlar, çözülenler, madalyalar, kartlar birleşir; eçka iki
     cihazdaki kazanç ve harcamayla hesaplanır (son eşitlemedeki cüzdan taban alınır); öteki kayıtlarda son
     değişen kazanır. Fan eserleri kimliğe göre birleşir.
   - Bulutta tek satır, sıkıştırılmış (gzip). Başka cihazın yazıp yazmadığı yalnızca zaman sütunu okunarak
     anlaşılır; tam veri yalnızca gerektiğinde iner. Yazım en sık 45 saniyede bir, değişiklik varsa. */

const ESIT_ZAMAN_ANAHTAR = "tentiforapp_esit_zaman";
/* 5 dakikada bir (sekme görünürken). Asıl kayıt sekme gizlenirken/kapanırken yapılır; ilerleme her an cihazda durur. */
const ESIT_ARALIK = 300000;
/* yalnızca büyüyen kazanımlar: iki cihazdakiler birleşir */
const ESIT_BIRLESIM = [
  "tentiforapp_erisim", "tentiforapp_cozulen", "tentiforapp_madalyalar", "tentiforapp_madalya", "tentiforapp_kart_koleksiyon",
  "tentiforapp_kesif", "tentiforapp_usta_acilan", "tentiforapp_supheli_cozulen", "tentiforapp_evren_lore",
  "tentiforapp_kanon_profiller", "tentiforapp_terimler_goruldu", "tentiforapp_rekorlar", "tentiforapp_gorulen", "tentiforapp_cihazlar"
];

let esitZaman = null;
let esitZamanBekle = 0;
let esitDamgaKapali = false;
let esitYazOrijinal = null;
let esitCekBekliyor = false;     /* başka cihazda yeni ilerleme var; sekme gizlenince uygulanır */
let esitSonKontrol = 0;

function esitIzlenir(k) {
  return !!k && k.indexOf("tentiforapp_") === 0 && k !== ESIT_ZAMAN_ANAHTAR && ESITLEME_DISI.indexOf(k) === -1;
}

function esitZamanOku() {
  if (!esitZaman) {
    try { esitZaman = JSON.parse(window.localStorage.getItem(ESIT_ZAMAN_ANAHTAR) || "{}") || {}; } catch (_) { esitZaman = {}; }
  }
  return esitZaman;
}

function esitZamanYaz() {
  esitZamanBekle = 0;
  if (esitDamgaKapali || !esitYazOrijinal) { return; }
  try { esitYazOrijinal.call(window.localStorage, ESIT_ZAMAN_ANAHTAR, JSON.stringify(esitZamanOku())); } catch (_) { /* dolu */ }
}

function esitDamgala(k) {
  if (esitDamgaKapali || !esitIzlenir(k)) { return; }
  esitZamanOku()[k] = Date.now();
  if (!esitZamanBekle) { esitZamanBekle = setTimeout(esitZamanYaz, 400); }
}

/** Çıkışta / başka hesabın ilerlemesi silinirken: damgalar da silinir (silme işaretleri başka hesaba taşınmasın). */
function esitZamanSifirla() {
  clearTimeout(esitZamanBekle); esitZamanBekle = 0;
  esitZaman = {};
  try { window.localStorage.removeItem(ESIT_ZAMAN_ANAHTAR); } catch (_) { /* yoksay */ }
  esitZaman = {};
}

(function () {
  try {
    const P = window.Storage && window.Storage.prototype;
    if (!P || P.__esitSarili) { return; }
    const yaz = P.setItem, sil = P.removeItem;
    esitYazOrijinal = yaz;
    P.setItem = function (k, v) { const r = yaz.call(this, k, v); if (this === window.localStorage) { esitDamgala(String(k)); } return r; };
    P.removeItem = function (k) { const r = sil.call(this, k); if (this === window.localStorage) { esitDamgala(String(k)); } return r; };
    P.__esitSarili = true;
  } catch (_) { /* depolama yok */ }
  window.addEventListener("pagehide", function () { if (esitZamanBekle) { clearTimeout(esitZamanBekle); esitZamanYaz(); } });
})();

function hesapAnlikGoruntu() {
  if (esitZamanBekle) { clearTimeout(esitZamanBekle); esitZamanYaz(); }
  const g = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.indexOf("tentiforapp_") === 0 && ESITLEME_DISI.indexOf(k) === -1) { g[k] = window.localStorage.getItem(k); }
    }
  } catch (_) { /* depolama kapalı */ }
  return g;
}

/** Değişim izi: zaman damgaları dışındaki kayıtlardan (damga her yazımda değişir). */
function hesapGoruntuIzi(g) {
  const l = Object.keys(g).filter(function (k) { return k !== ESIT_ZAMAN_ANAHTAR; }).sort().map(function (k) { return [k, g[k]]; });
  return typeof ziyaretIz === "function" ? ziyaretIz(l) : JSON.stringify(l).length;
}

function hesapCihazAnlamli(g) {
  return ILERLEME_ISARETLERI.some(function (k) { return g[k] && g[k] !== "[]" && g[k] !== "{}"; });
}

function hesapEsitKaydi() {
  const t = jsonOku(HESAP_ESIT_ANAHTAR, {}) || {};
  return (hesapKullanici && t[hesapKullanici.id]) || null;
}

/** ek: { uzak: buluttaki satırın zamanı, cuzdan: birleşmenin tabanı, ozet: profile yazılan özetin izi } */
function hesapEsitKaydiYaz(iz, ek) {
  const t = jsonOku(HESAP_ESIT_ANAHTAR, {}) || {};
  t[hesapKullanici.id] = Object.assign({}, t[hesapKullanici.id] || {}, ek || {}, { iz: iz, zaman: new Date().toISOString() });
  jsonYaz(HESAP_ESIT_ANAHTAR, t);
}

/* ---------- sıkıştırma ---------- */

async function esitSikistir(g) {
  if (!window.CompressionStream || !window.DecompressionStream || typeof bayttanBase64 !== "function") { return g; }
  try {
    const s = new Blob([JSON.stringify(g)]).stream().pipeThrough(new CompressionStream("gzip"));
    return { _v: 2, _z: bayttanBase64(new Uint8Array(await new Response(s).arrayBuffer())) };
  } catch (_) { return g; }
}

async function esitAc(v) {
  if (!v || typeof v._z !== "string") { return v || {}; }
  if (!window.DecompressionStream) { throw new Error("bu tarayıcı eşitlemeyi açamıyor"); }
  const s = new Blob([base64tenBayt(v._z)]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(s).text());
}

async function hesapUzakIlerleme() {
  const { data, error } = await hesapIstemci.from("ilerlemeler").select("veri, guncelleme").eq("id", hesapKullanici.id).maybeSingle();
  if (error) { throw error; }
  if (!data) { return null; }
  return { veri: await esitAc(data.veri), guncelleme: data.guncelleme };
}

/** Yalnızca zaman sütunu: başka cihaz son gördüğümüzden sonra yazdı mı? */
async function hesapUzakDegistiMi() {
  const k = hesapEsitKaydi();
  const { data, error } = await hesapIstemci.from("ilerlemeler").select("guncelleme").eq("id", hesapKullanici.id).maybeSingle();
  if (error || !data || !data.guncelleme) { return false; }
  return !k || !k.uzak || new Date(data.guncelleme).getTime() !== new Date(k.uzak).getTime();
}

/* ---------- birleştirme ---------- */

function esitJson(s) { try { return JSON.parse(s); } catch (_) { return undefined; } }
function esitDuzMu(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function esitIlkelDizi(x) { return Array.isArray(x) && x.every(function (y) { return y === null || typeof y !== "object"; }); }

/** Yalnızca büyüyen kayıtlar: ilkel diziler birleşir, nesneler iç içe birleşir; sayılarda rekorlar büyüğü, öteki değerlerde yeni olan. */
function esitDerinBirlestir(yeni, eski, enBuyuk) {
  if (esitIlkelDizi(yeni) && esitIlkelDizi(eski)) {
    const l = yeni.slice();
    eski.forEach(function (x) { if (l.indexOf(x) === -1) { l.push(x); } });
    return l;
  }
  if (esitDuzMu(yeni) && esitDuzMu(eski)) {
    const o = Object.assign({}, eski);
    Object.keys(yeni).forEach(function (k) { o[k] = k in eski ? esitDerinBirlestir(yeni[k], eski[k], enBuyuk) : yeni[k]; });
    return o;
  }
  if (enBuyuk && typeof yeni === "number" && typeof eski === "number") { return Math.max(yeni, eski); }
  return yeni;
}

/** Cüzdan: açılanların birleşimi; eçka = iki cihazın tabandan bu yana kazanç ve harcamaları. */
function esitCuzdanBirlestir(a, b, taban, aYeni) {
  const yeni = aYeni ? a : b, eski = aYeni ? b : a;
  const c = Object.assign({}, eski, yeni);
  const t = taban || { ecka: (typeof veri !== "undefined" && veri && veri.cuzdan ? veri.cuzdan.baslangic : 30), kazanilan: 0, harcanan: 0 };
  ["ecka", "kazanilan", "harcanan"].forEach(function (k) {
    const x = Number(a[k]) || 0, y = Number(b[k]) || 0, z = Number(t[k]) || 0;
    c[k] = Math.max(0, Math.round(x + y - z));
  });
  const l = (Array.isArray(a.acilan) ? a.acilan : []).slice();
  (Array.isArray(b.acilan) ? b.acilan : []).forEach(function (x) { if (l.indexOf(x) === -1) { l.push(x); } });
  c.acilan = l;
  return c;
}

/** Fan eserleri: kimliğe göre; aynı eserin son güncelleneni. */
function esitFanBirlestir(a, b) {
  const m = {}, sira = [];
  a.concat(b).forEach(function (x) {
    if (!x || !x.id) { return; }
    if (!m[x.id]) { sira.push(x.id); m[x.id] = x; return; }
    if (String(x.guncelleme || x.olusturma || "") > String(m[x.id].guncelleme || m[x.id].olusturma || "")) { m[x.id] = x; }
  });
  return sira.map(function (id) { return m[id]; }).filter(function (x) { return !(typeof evrenBosMu === "function" && evrenBosMu(x) && x.tur === "evren" && a.indexOf(x) === -1 && b.indexOf(x) === -1); });
}

/** Bu cihaz (y) ile buluttaki (u) görüntüyü birleştirir. taban: son eşitlemedeki cüzdan sayıları.
    uzakOnce: bu cihaz bu hesapla ilk kez buluşuyor; sıradan kayıtlarda hesaptaki kazanır (kazanımlar yine birleşir). */
function esitBirlestir(y, u, taban, uzakOnce) {
  const zy = uzakOnce ? {} : (esitJson(y[ESIT_ZAMAN_ANAHTAR] || "{}") || {}), zu = esitJson(u[ESIT_ZAMAN_ANAHTAR] || "{}") || {};
  const s = {}, z = {};
  const anahtarlar = {};
  Object.keys(y).concat(Object.keys(u), Object.keys(zy), Object.keys(zu)).forEach(function (k) { if (esitIzlenir(k)) { anahtarlar[k] = true; } });
  Object.keys(anahtarlar).forEach(function (k) {
    const ty = Number(zy[k]) || 0, tu = Number(zu[k]) || 0;
    const varY = k in y, varU = k in u;
    z[k] = Math.max(ty, tu) || undefined;
    if (varY && varU && y[k] !== u[k]) {
      const a = esitJson(y[k]), b = esitJson(u[k]);
      if (k === "tentiforapp_cuzdan" && esitDuzMu(a) && esitDuzMu(b)) { s[k] = JSON.stringify(esitCuzdanBirlestir(a, b, taban, ty >= tu)); return; }
      if (k === "tentiforapp_fan_eserlerim" && Array.isArray(a) && Array.isArray(b)) { s[k] = JSON.stringify(esitFanBirlestir(a, b)); return; }
      if (ESIT_BIRLESIM.indexOf(k) !== -1 && a !== undefined && b !== undefined) {
        s[k] = JSON.stringify(ty >= tu ? esitDerinBirlestir(a, b, k === "tentiforapp_rekorlar") : esitDerinBirlestir(b, a, k === "tentiforapp_rekorlar"));
        return;
      }
      s[k] = (tu > ty || (uzakOnce && tu === ty)) ? u[k] : y[k];
      return;
    }
    if (varY && varU) { s[k] = y[k]; return; }
    /* yalnızca bir tarafta: öbür taraf onu sonradan sildiyse silinir */
    if (varY) { if (!(tu > ty && !varU && zu[k])) { s[k] = y[k]; } return; }
    if (varU) { if (!(ty > tu && !varY && zy[k])) { s[k] = u[k]; } }
  });
  Object.keys(z).forEach(function (k) { if (z[k] === undefined) { delete z[k]; } });
  s[ESIT_ZAMAN_ANAHTAR] = JSON.stringify(z);
  return s;
}

function esitCuzdanTaban(g) {
  const c = esitJson(g["tentiforapp_cuzdan"] || "null");
  return esitDuzMu(c) ? { ecka: Number(c.ecka) || 0, kazanilan: Number(c.kazanilan) || 0, harcanan: Number(c.harcanan) || 0 } : null;
}

/** Birleşmiş görüntüyü bu cihaza yazar (damgalamadan). */
function esitYerelYaz(g) {
  esitDamgaKapali = true;
  try {
    Object.keys(hesapAnlikGoruntu()).forEach(function (k) { if (!(k in g)) { window.localStorage.removeItem(k); } });
    Object.keys(g).forEach(function (k) {
      if (k.indexOf("tentiforapp_") === 0 && ESITLEME_DISI.indexOf(k) === -1) { window.localStorage.setItem(k, g[k]); }
    });
  } finally {
    esitDamgaKapali = false;
    esitZaman = esitJson(g[ESIT_ZAMAN_ANAHTAR] || "{}") || {};
  }
}

/** Profildeki herkese açık özet: rol, kişilik, tamlık, madalyalar. */
function hesapOzet() {
  const o = {};
  try {
    const rol = arsivciRol(), kis = arsivciKisilik(), ol = arsivciOlculeri();
    o.rol = rol.ad; o.kisilik = kis.ad;
    o.oyun = ol.oyun; o.katman = ol.katman; o.gun = ol.gun;
    const t = (typeof tamlikHesapla === "function") ? tamlikHesapla() : null;
    if (t) { o.tamlik = t.yuzde; }
    if (typeof arsivciMadalyalari === "function") { o.madalyalar = arsivciMadalyalari().map(function (m) { return m.ad; }).slice(0, 20); }
  } catch (_) { /* özet eksik kalabilir */ }
  return o;
}

let hesapEsitSuruyor = false;

/** Görüntüyü buluta yazar. Profil özeti yalnızca değiştiyse yazılır. */
async function esitBulutaYaz(g) {
  const simdi = new Date().toISOString();
  const { error } = await hesapIstemci.from("ilerlemeler").upsert({ id: hesapKullanici.id, veri: await esitSikistir(g), guncelleme: simdi });
  if (error) { throw error; }
  const ozet = hesapOzet();
  const ozetIz = JSON.stringify(ozet);
  const k = hesapEsitKaydi();
  if (!k || k.ozet !== ozetIz) {
    await hesapIstemci.from("profiller").update({ ozet: ozet, guncelleme: simdi }).eq("id", hesapKullanici.id);
  }
  hesapEsitKaydiYaz(hesapGoruntuIzi(g), { uzak: simdi, cuzdan: esitCuzdanTaban(g), ozet: ozetIz });
}

/** Değişiklik varsa buluta yazar. zorla: değişmemiş olsa da (çıkışta) yazar.
    Başka cihaz bu arada yazdıysa önce birleştirir: kimsenin ilerlemesi ezilmez. */
async function hesapEsitle(zorla, yenileme) {
  if (!hesapIstemci || !hesapKullanici || hesapEsitSuruyor) { return; }
  const g = hesapAnlikGoruntu();
  const iz = hesapGoruntuIzi(g);
  const k = hesapEsitKaydi();
  if (!zorla && k && k.iz === iz) { return; }

  hesapEsitSuruyor = true;
  try {
    if (k && k.uzak && await hesapUzakDegistiMi()) {
      hesapEsitSuruyor = false;
      await hesapUzaktanCek(zorla || document.visibilityState === "hidden", yenileme);
      return;
    }
    await esitBulutaYaz(g);
    hesapEsitDurum = "kaydedildi";
    if (typeof liderlikGonder === "function") { liderlikGonder(); }
  } catch (e) {
    hesapEsitDurum = "kaydedilemedi — " + hesapHataMetni(e);
  } finally {
    hesapEsitSuruyor = false;
    hesapEsitDurumCiz();
  }
}

/** Buluttakini alır ve bu cihazla birleştirir. uygula: bu cihaz değişecekse hemen yaz ve sayfayı yenile
    (sekme yeni görünür olduysa ya da gizliyse); değilse "yenile" bildirimi gösterilir ve sekme gizlenince uygulanır. */
async function hesapUzaktanCek(uygula, yenileme) {
  if (!hesapIstemci || !hesapKullanici || hesapEsitSuruyor) { return; }
  hesapEsitSuruyor = true;
  try {
    const u = await hesapUzakIlerleme();
    const yerel = hesapAnlikGoruntu();
    if (!u || !u.veri || !Object.keys(u.veri).length) { await esitBulutaYaz(yerel); return; }
    const k = hesapEsitKaydi();
    const b = esitBirlestir(yerel, u.veri, k && k.cuzdan);
    const bIz = hesapGoruntuIzi(b);
    const yerelDegisir = bIz !== hesapGoruntuIzi(yerel);
    if (yerelDegisir && !uygula) {
      esitCekBekliyor = true;
      esitBildirimGoster();
      return;
    }
    esitCekBekliyor = false;
    if (bIz !== hesapGoruntuIzi(u.veri)) { await esitBulutaYaz(b); hesapEsitDurum = "kaydedildi"; }
    else { hesapEsitKaydiYaz(bIz, { uzak: u.guncelleme, cuzdan: esitCuzdanTaban(b) }); hesapEsitDurum = "güncel"; }
    if (yerelDegisir) { esitYerelYaz(b); if (yenileme !== false) { location.reload(); } }
  } catch (e) {
    hesapEsitDurum = "okunamadı — " + hesapHataMetni(e);
  } finally {
    hesapEsitSuruyor = false;
    hesapEsitDurumCiz();
  }
}

function esitBildirimGoster() {
  if (document.querySelector("#esitBildirim")) { return; }
  const el = document.createElement("div");
  el.id = "esitBildirim";
  el.className = "kadi-uyari esit-bildirim";
  el.setAttribute("role", "status");
  el.innerHTML = "<span>Başka cihazdaki ilerlemen geldi.</span>" +
    '<button class="dugme" data-esit-yenile>Yenile</button>';
  document.body.appendChild(el);
}

document.addEventListener("click", function (e) {
  if (e.target.closest && e.target.closest("[data-esit-yenile]")) { hesapUzaktanCek(true); }
});

/** Hesapsız kurulan evrenler var olan hesaba girince kaybolmasın (birleştirme bunu da yapar; eski çağrılar için). */
function hesapFanBirlestir(g) {
  const k = "tentiforapp_fan_eserlerim";
  const yerel = esitJson(window.localStorage.getItem(k) || "[]"), uzak = esitJson(g[k] || "[]");
  if (!Array.isArray(yerel) || !yerel.length) { return false; }
  const once = g[k];
  g[k] = JSON.stringify(esitFanBirlestir(Array.isArray(uzak) ? uzak : [], yerel));
  return g[k] !== once;
}

/** Buluttaki görüntüyü bu cihaza yazar ve sayfayı yeniler (eski çağrılar için; birleştirerek). */
function hesapUzagiUygula(veriUzak) {
  const k = hesapEsitKaydi();
  const b = esitBirlestir(hesapAnlikGoruntu(), veriUzak || {}, k && k.cuzdan);
  try { esitYerelYaz(b); } catch (_) { hesapBildir("Bu tarayıcı kayıt yapmaya izin vermiyor"); return; }
  hesapEsitKaydiYaz("birlesik", { cuzdan: esitCuzdanTaban(b) });
  location.reload();
}

let hesapCatismaUzak = null;

const HESAP_SIFIR_ANAHTAR = "sb-tentiforapp-sifirlandi";
const HESAP_SAHIP_ANAHTAR = "sb-tentiforapp-sahip";   /* çıkışta hesaba yazılamayan ilerlemenin sahibi */

/** Defter'deki tam sıfırlama çağırır: hesaptaki ilerleme de sıfırlansın diye işaret bırakır. */
function hesapSifirlandi() {
  if (!hesapKullanici) { return; }
  try {
    window.localStorage.setItem(HESAP_SIFIR_ANAHTAR, hesapKullanici.id);
    const t = jsonOku(HESAP_ESIT_ANAHTAR, {}) || {};
    delete t[hesapKullanici.id];
    jsonYaz(HESAP_ESIT_ANAHTAR, t);
  } catch (_) { /* yoksay */ }
}

/** Girişte ya da açılışta: bulut ile bu cihazı birleştirir. */
async function hesapIlkEsitleme() {
  /* çıkışta hesaba yazılamayıp cihazda kalan ilerleme başka bir hesabınsa bu hesaba karışmasın */
  let sahip = null;
  try { sahip = window.localStorage.getItem(HESAP_SAHIP_ANAHTAR); } catch (_) { sahip = null; }
  if (sahip) {
    try { window.localStorage.removeItem(HESAP_SAHIP_ANAHTAR); } catch (_) { /* yoksay */ }
    if (sahip !== hesapKullanici.id) { hesapYerelIlerlemeyiTemizle(); esitZamanSifirla(); }
  }
  let sifir = null;
  try { sifir = window.localStorage.getItem(HESAP_SIFIR_ANAHTAR); } catch (_) { sifir = null; }
  if (sifir && sifir === hesapKullanici.id) {
    try { window.localStorage.removeItem(HESAP_SIFIR_ANAHTAR); } catch (_) { /* yoksay */ }
    try { await esitBulutaYaz(hesapAnlikGoruntu()); } catch (_) { /* sonra */ }   /* sıfırlanmış hâli hesaba da yaz */
    if (typeof liderlikSifirla === "function") { await liderlikSifirla(); }
    return;
  }

  let uzak;
  try { uzak = await hesapUzakIlerleme(); } catch (e) { hesapEsitDurum = "okunamadı — " + hesapHataMetni(e); return; }

  const yerel = hesapAnlikGoruntu();
  const kayit = hesapEsitKaydi();
  const uzakVar = uzak && uzak.veri && Object.keys(uzak.veri).length > 0;

  try {
    if (!uzakVar) { await esitBulutaYaz(yerel); return; }                         /* ilk kez: bu cihazdakini yükle */
    /* boş cihaz: hesaptakini olduğu gibi al */
    const b = esitBirlestir(yerel, uzak.veri, kayit && kayit.cuzdan, !kayit);
    const bIz = hesapGoruntuIzi(b);
    if (bIz !== hesapGoruntuIzi(uzak.veri)) { await esitBulutaYaz(b); }
    else { hesapEsitKaydiYaz(bIz, { uzak: uzak.guncelleme, cuzdan: esitCuzdanTaban(b) }); }
    hesapEsitDurum = "güncel";
    if (bIz !== hesapGoruntuIzi(yerel)) { esitYerelYaz(b); location.reload(); }
  } catch (e) {
    hesapEsitDurum = "kaydedilemedi — " + hesapHataMetni(e);
  }
}

function hesapCatismaGovde() {
  const u = hesapCatismaUzak;
  const zaman = u && u.guncelleme ? new Date(u.guncelleme).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) : "—";
  return "<h3>Hangi ilerleme kullanılsın?</h3>" +
    '<p class="pencere-alt">Hem hesabında hem bu cihazda farklı ilerleme var. Birini seç; ' +
      "diğeri bunun üzerine yazılır.</p>" +
    '<div class="hesap-secim">' +
      '<button class="dugme dugme-tam" data-hesap-catisma="uzak">Hesaptakini kullan<span>son kayıt: ' + kacir(zaman) + "</span></button>" +
      '<button class="dugme dugme-tam dugme-sade" data-hesap-catisma="yerel">Bu cihazdakini kullan<span>hesaptaki ilerlemenin yerine geçer</span></button>' +
    "</div>";
}

/* Sekme gizlenirken son hâli kaydet (başka cihazdan bekleyen varsa önce birleştir);
   görünür olunca başka cihazda ilerlendi mi diye yalnızca zaman sütununa bak. */
document.addEventListener("visibilitychange", function () {
  if (!hesapKullanici) { return; }
  if (document.visibilityState === "hidden") {
    if (esitCekBekliyor) { hesapUzaktanCek(true); } else { hesapEsitle(); }
    return;
  }
  if (Date.now() - esitSonKontrol < 15000) { return; }
  esitSonKontrol = Date.now();
  hesapUzakDegistiMi().then(function (d) { if (d) { hesapUzaktanCek(true); } }).catch(function () { /* çevrimdışı */ });
});

/* ==================== "Sen" sayfasındaki Hesabın bölümü ==================== */

let hesapDuzenle = false;

function hesapCiz() {
  const alan = document.querySelector("#hesapAlan");
  if (!alan) { return; }

  if (!hesapEtkin()) {
    alan.innerHTML = '<p class="oyun-not">Hesaplar yakında açılacak. O zamana kadar ilerlemen bu cihazda saklanıyor; ' +
      "Defterin'deki yedekleme ile başka cihaza taşıyabilirsin.</p>";
    return;
  }
  if (!hesapHazir) { alan.innerHTML = '<p class="oyun-not">Hesap bilgileri yükleniyor…</p>'; return; }

  if (!hesapKullanici) {
    alan.innerHTML =
      '<div class="hesap-kutu">' +
        '<p class="oyun-giris">Bir hesapla ilerlemen — eçkan, çözdüğün kodlar, madalyaların, defterin — ' +
          "her cihazda seninle gelir. Herkese açık bir arşivci profilin olur.</p>" +
        '<div class="oyun-sira">' +
          '<button class="dugme" data-hesap-pencere="kayit">Hesap oluştur</button>' +
          '<button class="dugme dugme-sade" data-hesap-pencere="giris">Giriş yap</button>' +
        "</div>" +
      "</div>";
    return;
  }

  const p = hesapProfil || {};
  const tanim = (typeof isimKartAd !== "undefined" && isimKartAd) ? isimKartAd : "";
  const oneri = tanim && typeof isimUret === "function" ? (isimUret(tanim)[0] || {}).sonuc : "";

  alan.innerHTML =
    '<div class="hesap-kutu">' +
      '<div class="hesap-kimlik">' +
        hesapAvatar(p, 64) +
        "<div>" +
          '<div class="hesap-ad">' + kacir(p.gorunen_ad || "İsimsiz arşivci") + "</div>" +
          (p.kullanici_adi ? '<div class="hesap-kadi">@' + kacir(p.kullanici_adi) + "</div>" : "") +
          '<div class="oyun-not">' + kacir(hesapKullanici.email || "") + "</div>" +
        "</div>" +
      "</div>" +
      (hesapDuzenle
        ? '<form class="hesap-duzen" data-hesap-profil-form="1">' +
            '<label class="hesap-etiket" for="hpAd">Görünen ad</label>' +
            '<input class="kod-giris" id="hpAd" maxlength="40" value="' + kacir(p.gorunen_ad || "") + '">' +
            '<label class="hesap-etiket" for="hpKadi">Kullanıcı adı</label>' +
            '<input class="kod-giris" id="hpKadi" maxlength="20" spellcheck="false" value="' + kacir(p.kullanici_adi || "") + '">' +
            '<label class="hesap-etiket" for="hpTentifor">Tentiforverse adın (isteğe bağlı)</label>' +
            '<input class="kod-giris" id="hpTentifor" maxlength="40" value="' + kacir(p.tentifor_adi || oneri || "") + '"' +
              ' placeholder="İsim Sistemi\'nden çıkan adın">' +
            '<label class="hesap-etiket" for="hpHakkinda">Hakkında</label>' +
            '<textarea class="kod-giris" id="hpHakkinda" rows="3" maxlength="280">' + kacir(p.hakkinda || "") + "</textarea>" +
            (typeof vitrinSecimleri === "function" ? vitrinSecimleri(p.vitrin || {}) : "") +
            '<div class="oyun-sira">' +
              '<button class="dugme" type="submit">Kaydet</button>' +
              '<button class="dugme dugme-sade" type="button" data-hesap-duzen="kapat">Vazgeç</button>' +
            "</div>" +
            '<p class="pencere-durum" id="hesapProfilDurum"></p>' +
          "</form>"
        : (p.tentifor_adi ? '<p class="hesap-tentifor">Tömye\'de: <b>' + kacir(p.tentifor_adi) + "</b></p>" : "") +
          (p.hakkinda ? '<p class="hesap-hakkinda">' + kacir(p.hakkinda) + "</p>" : "") +
          '<div class="oyun-sira">' +
            '<button class="dugme dugme-sade" data-hesap-duzen="ac">Profili düzenle</button>' +
            (p.kullanici_adi
              ? '<a class="dugme dugme-sade" href="#/u/' + encodeURIComponent(p.kullanici_adi) + '">Herkese açık profilin</a>' +
                '<button class="dugme dugme-sade" data-hesap-bag="1">Bağlantıyı kopyala</button>'
              : "") +
          "</div>") +
      '<div class="hesap-esit">' +
        '<span class="oyun-etiket">İlerleme eşitleme</span>' +
        '<span id="hesapEsitDurum"></span>' +
        '<button class="dugme dugme-sade" data-hesap-esitle="1">Şimdi eşitle</button>' +
        '<button class="dugme dugme-sade" data-gez-git="liderlik">Liderlik tabloları</button>' +
      "</div>" +
      '<div class="oyun-sira">' +
        '<button class="dugme dugme-sade" data-hesap-pencere="yenisifre">Şifreyi değiştir</button>' +
        '<button class="dugme dugme-sade" data-hesap-cikis="1">Çıkış yap</button>' +
        '<button class="dugme dugme-sade y-sil" data-hesap-sil="1">Hesabımı sil</button>' +
      "</div>" +
      '<p class="oyun-not"><button class="ic-bag" data-gez-git="gizlilik">Gizlilik ve verilerin</button></p>' +
    "</div>" +
    '<div id="hesapTopluluk"></div>';
  hesapEsitDurumCiz();
  if (typeof toplulukHesapEk === "function") { toplulukHesapEk(); }
}

/* ==================== hesabımı sil ==================== */

function hesapSilPencere() {
  const perde = document.querySelector("#perde");
  if (!perde || !hesapKullanici) { return; }
  const ad = (hesapProfil && hesapProfil.kullanici_adi) || "";
  perde.innerHTML =
    '<div class="pencere hesap-pencere" role="dialog" aria-modal="true">' +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      "<h3>Hesabımı sil</h3>" +
      '<p class="pencere-alt">Hesabın, profilin, buluttaki ilerlemen, skorların, teorilerin, oyların ve takiplerin ' +
        "kalıcı olarak silinir. Bu geri alınamaz. Bu cihazdaki ilerlemen yerinde kalır.</p>" +
      '<form data-hesap-sil-form="1">' +
        '<label class="hesap-etiket" for="hSilOnay">Onaylamak için kullanıcı adını yaz: <b>' + kacir(ad || "sil") + "</b></label>" +
        '<input class="kod-giris" id="hSilOnay" autocomplete="off" spellcheck="false">' +
        '<button class="dugme dugme-tam sil" type="submit">Kalıcı olarak sil</button>' +
      "</form>" +
      '<p class="pencere-durum" id="hesapDurum" role="status"></p>' +
    "</div>";
  perde.hidden = false;
  const g = perde.querySelector("#hSilOnay"); if (g) { g.focus(); }
}

async function hesapSil(form) {
  const beklenen = (hesapProfil && hesapProfil.kullanici_adi) || "sil";
  const yazilan = kullaniciAdiSade((form.querySelector("#hSilOnay") || {}).value || "");
  if (yazilan !== beklenen) { hesapDurum("Kullanıcı adı eşleşmedi."); return; }
  hesapFormMesgul(form, true);
  const { error } = await hesapIstemci.rpc("hesabimi_sil");
  if (error) { hesapFormMesgul(form, false); hesapDurum(hesapHataMetni(error)); return; }
  clearInterval(hesapEsitZamanlayici);
  try {
    Object.keys(window.localStorage).forEach(function (k) { if (k.indexOf("sb-tentiforapp") === 0) { window.localStorage.removeItem(k); } });
  } catch (_) { /* yoksay */ }
  okumaKaliciTemizle();
  await hesapIstemci.auth.signOut().catch(function () {});
  if (typeof perdeKapat === "function") { perdeKapat(); }
  hesapOturumAyarla(null, "SIGNED_OUT");
  hesapBildir("Hesabın ve bütün verilerin silindi");
}

function hesapEsitDurumCiz() {
  const el = document.querySelector("#hesapEsitDurum");
  if (!el) { return; }
  const k = hesapEsitKaydi();
  const zaman = k ? new Date(k.zaman).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "";
  el.textContent = (hesapEsitDurum || "bekliyor") + (zaman ? " · son: " + zaman : "");
}

async function hesapProfilKaydet(form) {
  const al = function (id) { return (form.querySelector("#" + id) || {}).value || ""; };
  const kadi = kullaniciAdiSade(al("hpKadi"));
  const durum = form.querySelector("#hesapProfilDurum");
  const yaz = function (m, iyi) { if (durum) { durum.textContent = m; durum.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };

  if (!kullaniciAdiGecerli(kadi)) { yaz("Kullanıcı adı 3–20 karakter olmalı: küçük harf, rakam ya da _."); return; }
  if (kadi !== (hesapProfil && hesapProfil.kullanici_adi) && (await hesapKullaniciAdiBos(kadi)) === false) {
    yaz("Bu kullanıcı adı alınmış."); return;
  }

  const degisiklik = {
    gorunen_ad: al("hpAd").trim().slice(0, 40) || null,
    kullanici_adi: kadi,
    tentifor_adi: al("hpTentifor").trim().slice(0, 40) || null,
    hakkinda: al("hpHakkinda").trim().slice(0, 280) || null,
    vitrin: { karakter: al("hpVitrinKarakter") || null, alinti: al("hpVitrinAlinti") || null },
    guncelleme: new Date().toISOString()
  };
  /* Tetikleyici çalışmadıysa (eski kurulum) satır olmayabilir: upsert */
  const { error } = await hesapIstemci.from("profiller").upsert(Object.assign({ id: hesapKullanici.id }, degisiklik));
  if (error) { yaz(hesapHataMetni(error)); return; }
  hesapProfil = Object.assign({}, hesapProfil, degisiklik);
  hesapDuzenle = false;
  hesapDugmesiCiz();
  hesapCiz();
  hesapBildir("Profil kaydedildi");
}

/* ==================== herkese açık profil: #/u/kullaniciadi ==================== */

async function hesapProfilAc(ad) {
  const perde = document.querySelector("#perde");
  if (!perde) { return; }
  const kadi = decodeURIComponent(String(ad || "")).toLowerCase();

  const goster = function (ic) {
    perde.innerHTML = '<div class="pencere hesap-profil" role="dialog" aria-modal="true">' +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' + ic + "</div>";
    perde.hidden = false;
  };

  if (!hesapEtkin()) { goster("<h3>Profiller henüz açık değil</h3>"); return; }
  goster('<p class="oyun-not">Profil yükleniyor…</p>');
  if (!hesapIstemci) { await hesapGerekli(); }
  if (!hesapIstemci) { goster("<h3>Profil yüklenemedi</h3>"); return; }

  const { data: p, error } = await hesapIstemci.from("profiller")
    .select("kullanici_adi, gorunen_ad, tentifor_adi, hakkinda, ozet, vitrin, olusturma").eq("kullanici_adi", kadi).maybeSingle();

  if (error || !p) {
    goster("<h3>Böyle bir arşivci yok</h3>" +
      '<p class="pencere-alt">@' + kacir(kadi) + " adıyla bir profil bulunamadı. Kütüphanede bu raf boş.</p>");
    return;
  }

  const o = p.ozet || {};
  const katilim = p.olusturma ? new Date(p.olusturma).toLocaleDateString("tr-TR", { year: "numeric", month: "long" }) : "";
  const bu = hesapProfil && hesapProfil.kullanici_adi === p.kullanici_adi;

  goster(
    '<div class="hesap-kimlik">' + hesapAvatar(p, 72) +
      "<div>" +
        '<div class="hesap-ad">' + kacir(p.gorunen_ad || p.kullanici_adi) + "</div>" +
        '<div class="hesap-kadi">@' + kacir(p.kullanici_adi) + "</div>" +
        (katilim ? '<div class="oyun-not">Katılım: ' + kacir(katilim) + "</div>" : "") +
      "</div>" +
    "</div>" +
    (p.tentifor_adi && typeof kyldoYaz === "function"
      ? '<div class="hesap-tentifor-blok"><div class="yazi-satir">' + kyldoYaz(p.tentifor_adi, 34) + "</div>" +
        '<p class="hesap-tentifor">Tömye\'de: <b>' + kacir(p.tentifor_adi) + "</b></p></div>"
      : "") +
    (p.hakkinda ? '<p class="hesap-hakkinda">' + kacir(p.hakkinda) + "</p>" : "") +
    (o.rol
      ? '<div class="hesap-ozet">' +
          '<div><span class="oyun-etiket">Rol</span><b>' + kacir(o.rol) + "</b></div>" +
          (o.kisilik ? '<div><span class="oyun-etiket">Kişilik</span><b>' + kacir(o.kisilik) + "</b></div>" : "") +
          (typeof o.tamlik === "number" ? '<div><span class="oyun-etiket">Tamlık</span><b>%' + o.tamlik + "</b></div>" : "") +
          (typeof o.gun === "number" ? '<div><span class="oyun-etiket">Gün</span><b>' + o.gun + "</b></div>" : "") +
        "</div>"
      : "") +
    '<div id="profilDereceler"></div>' +
    '<div id="profilYaris"></div>' +
    '<div id="profilTopluluk"></div>' +
    (o.madalyalar && o.madalyalar.length
      ? '<div class="hesap-madalya">' + o.madalyalar.map(function (m) { return "<span>" + kacir(m) + "</span>"; }).join("") + "</div>"
      : "") +
    '<div class="oyun-sira">' +
      '<button class="dugme dugme-sade" data-hesap-bag="' + kacir(p.kullanici_adi) + '">Bağlantıyı kopyala</button>' +
      (bu ? '<button class="dugme dugme-sade" data-hesap-git="1">Profilini düzenle</button>' : "") +
    "</div>"
  );
  if (typeof liderlikProfilDereceleri === "function") { liderlikProfilDereceleri(p.kullanici_adi); }
  if (typeof yarisProfilEk === "function") { yarisProfilEk(p); }
  if (typeof toplulukProfilEk === "function") { toplulukProfilEk(p); }
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  if (e.target.closest("#hesapBtn")) {
    if (hesapKullanici) { location.hash = "#/hesap"; if (typeof bolumeGit === "function") { setTimeout(function () { bolumeGit("hesap"); }, 60); } }
    else { hesapPencere("giris"); }
    return;
  }
  const p = e.target.closest("[data-hesap-pencere]");
  if (p) { e.preventDefault(); hesapPencere(p.dataset.hesapPencere); return; }

  const d = e.target.closest("[data-hesap-duzen]");
  if (d) { hesapDuzenle = d.dataset.hesapDuzen === "ac"; hesapCiz(); return; }

  if (e.target.closest("[data-hesap-cikis]")) { hesapCikis(); return; }
  if (e.target.closest("[data-hesap-sil]")) { hesapSilPencere(); return; }
  if (e.target.closest("[data-hesap-esitle]")) { hesapEsitDurum = "eşitleniyor…"; hesapEsitDurumCiz(); hesapEsitle(true); return; }

  const bag = e.target.closest("[data-hesap-bag]");
  if (bag) {
    const ad = bag.dataset.hesapBag !== "1" ? bag.dataset.hesapBag : (hesapProfil && hesapProfil.kullanici_adi);
    const url = hesapProfilAdresi(ad || "");
    const tamam = function () { hesapBildir("Profil bağlantısı kopyalandı"); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(tamam, function () { prompt("Bağlantı:", url); }); }
    else { prompt("Bağlantı:", url); }
    return;
  }
  if (e.target.closest("[data-hesap-git]")) {
    if (typeof perdeKapat === "function") { perdeKapat(); }
    hesapDuzenle = true;
    location.hash = "#/hesap";
    return;
  }

  const c = e.target.closest("[data-hesap-catisma]");
  if (c) {
    const secim = c.dataset.hesapCatisma;
    if (typeof perdeKapat === "function") { perdeKapat(); }
    if (secim === "uzak" && hesapCatismaUzak) { hesapUzagiUygula(hesapCatismaUzak.veri); }
    else { hesapEsitle(true); }
    hesapCatismaUzak = null;
  }
});

document.addEventListener("submit", function (e) {
  const f = e.target.closest("[data-hesap-form]");
  if (f) { e.preventDefault(); hesapFormGonder(f.dataset.hesapForm, f); return; }
  const hs = e.target.closest("[data-hesap-sil-form]");
  if (hs) { e.preventDefault(); hesapSil(hs); return; }
  const pf = e.target.closest("[data-hesap-profil-form]");
  if (pf) { e.preventDefault(); hesapProfilKaydet(pf); }
});

/* Kayıtta kullanıcı adı: görünen addan öner, yazdıkça uygunluğunu söyle. */
document.addEventListener("input", function (e) {
  if (e.target.id === "hKayitAd") {
    const k = document.querySelector("#hKayitKullanici");
    if (k && !k.dataset.eliyle) { k.value = kullaniciAdiOner(e.target.value); k.dispatchEvent(new Event("input", { bubbles: true })); }
    return;
  }
  if (e.target.id !== "hKayitKullanici") { return; }
  if (e.isTrusted) { e.target.dataset.eliyle = "1"; }
  const deger = kullaniciAdiSade(e.target.value);
  const durum = document.querySelector("#hKayitKullaniciDurum");
  if (!durum) { return; }
  clearTimeout(hesapKayitAdKontrol);
  if (!deger) { durum.textContent = ""; return; }
  if (!kullaniciAdiGecerli(deger)) { durum.textContent = "3–20 karakter: küçük harf, rakam ya da _"; durum.className = "hesap-ipucu kotu"; return; }
  durum.textContent = "kontrol ediliyor…"; durum.className = "hesap-ipucu";
  hesapKayitAdKontrol = setTimeout(async function () {
    const bos = await hesapKullaniciAdiBos(deger);
    if (document.querySelector("#hKayitKullanici") && kullaniciAdiSade(document.querySelector("#hKayitKullanici").value) !== deger) { return; }
    durum.textContent = bos === false ? "alınmış" : "@" + deger + " uygun";
    durum.className = "hesap-ipucu " + (bos === false ? "kotu" : "iyi");
  }, 400);
});

