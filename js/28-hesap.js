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
  "tentiforapp_ziyaret_izleri", "tentiforapp_ziyaret_fark"
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
    try { history.replaceState(null, "", location.pathname + "#/u/" + encodeURIComponent(ad)); } catch (_) { /* yoksay */ }
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
      }
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
    hesapEsitZamanlayici = setInterval(hesapEsitle, 20000);
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
    [/schema cache|could not find the (table|column)|relation .* does not exist/i,
      "Veritabanı kurulumu eksik: Supabase'de supabase/kurulum.sql dosyası çalıştırılmalı."]
  ];
  for (let i = 0; i < esle.length; i++) { if (esle[i][0].test(m)) { return esle[i][1]; } }
  return m || "Bir şeyler ters gitti.";
}

function hesapDonusAdresi(tur) {
  return location.origin + location.pathname + "?hesap=" + tur;
}

/** Paylaşılan profil adresi: canlı sitede kısa /u/ad (netlify.toml yönlendirir), yerelde #/u/ad. */
function hesapProfilAdresi(ad) {
  if (location.protocol === "https:") { return location.origin + "/u/" + encodeURIComponent(ad); }
  return location.origin + location.pathname + "#/u/" + encodeURIComponent(ad);
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

async function hesapCikis() {
  await hesapEsitle(true);             /* çıkmadan son hâli kaydet */
  await hesapIstemci.auth.signOut();
  hesapBildir("Çıkış yapıldı. Bu cihazdaki ilerlemen yerinde duruyor.");
}

/* ==================== ilerleme eşitleme ==================== */

function hesapAnlikGoruntu() {
  const g = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.indexOf("tentiforapp_") === 0 && ESITLEME_DISI.indexOf(k) === -1) { g[k] = window.localStorage.getItem(k); }
    }
  } catch (_) { /* depolama kapalı */ }
  return g;
}

function hesapGoruntuIzi(g) {
  return typeof ziyaretIz === "function" ? ziyaretIz(Object.keys(g).sort().map(function (k) { return [k, g[k]]; })) : JSON.stringify(g).length;
}

function hesapCihazAnlamli(g) {
  return ILERLEME_ISARETLERI.some(function (k) { return g[k] && g[k] !== "[]" && g[k] !== "{}"; });
}

function hesapEsitKaydi() {
  const t = jsonOku(HESAP_ESIT_ANAHTAR, {}) || {};
  return (hesapKullanici && t[hesapKullanici.id]) || null;
}

function hesapEsitKaydiYaz(iz) {
  const t = jsonOku(HESAP_ESIT_ANAHTAR, {}) || {};
  t[hesapKullanici.id] = { iz: iz, zaman: new Date().toISOString() };
  jsonYaz(HESAP_ESIT_ANAHTAR, t);
}

async function hesapUzakIlerleme() {
  const { data, error } = await hesapIstemci.from("ilerlemeler").select("veri, guncelleme").eq("id", hesapKullanici.id).maybeSingle();
  if (error) { throw error; }
  return data;
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

/** Değişiklik varsa buluta yazar. zorla: değişmemiş olsa da (çıkışta) yazar. */
async function hesapEsitle(zorla) {
  if (!hesapIstemci || !hesapKullanici || hesapEsitSuruyor) { return; }
  const g = hesapAnlikGoruntu();
  const iz = hesapGoruntuIzi(g);
  const k = hesapEsitKaydi();
  if (!zorla && k && k.iz === iz) { return; }

  hesapEsitSuruyor = true;
  try {
    const simdi = new Date().toISOString();
    const { error } = await hesapIstemci.from("ilerlemeler").upsert({ id: hesapKullanici.id, veri: g, guncelleme: simdi });
    if (error) { throw error; }
    await hesapIstemci.from("profiller").update({ ozet: hesapOzet(), guncelleme: simdi }).eq("id", hesapKullanici.id);
    hesapEsitKaydiYaz(iz);
    hesapEsitDurum = "kaydedildi";
    if (typeof liderlikGonder === "function") { liderlikGonder(); }
  } catch (e) {
    hesapEsitDurum = "kaydedilemedi — " + hesapHataMetni(e);
  } finally {
    hesapEsitSuruyor = false;
    hesapEsitDurumCiz();
  }
}

/** Buluttaki görüntüyü bu cihaza yazar ve sayfayı yeniler. */
function hesapUzagiUygula(veriUzak) {
  const g = veriUzak || {};
  try {
    Object.keys(hesapAnlikGoruntu()).forEach(function (k) { if (!(k in g)) { window.localStorage.removeItem(k); } });
    Object.keys(g).forEach(function (k) {
      if (k.indexOf("tentiforapp_") === 0 && ESITLEME_DISI.indexOf(k) === -1) { window.localStorage.setItem(k, g[k]); }
    });
  } catch (_) { hesapBildir("Bu tarayıcı kayıt yapmaya izin vermiyor"); return; }
  hesapEsitKaydiYaz(hesapGoruntuIzi(hesapAnlikGoruntu()));
  location.reload();
}

let hesapCatismaUzak = null;

const HESAP_SIFIR_ANAHTAR = "sb-tentiforapp-sifirlandi";

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

/** Girişte ya da açılışta: bulut ile bu cihazı buluşturur. */
async function hesapIlkEsitleme() {
  let sifir = null;
  try { sifir = window.localStorage.getItem(HESAP_SIFIR_ANAHTAR); } catch (_) { sifir = null; }
  if (sifir && sifir === hesapKullanici.id) {
    try { window.localStorage.removeItem(HESAP_SIFIR_ANAHTAR); } catch (_) { /* yoksay */ }
    await hesapEsitle(true);        /* sıfırlanmış hâli hesaba da yaz */
    if (typeof liderlikSifirla === "function") { await liderlikSifirla(); }
    return;
  }

  let uzak;
  try { uzak = await hesapUzakIlerleme(); } catch (e) { hesapEsitDurum = "okunamadı — " + hesapHataMetni(e); return; }

  const yerel = hesapAnlikGoruntu();
  const yerelIz = hesapGoruntuIzi(yerel);
  const kayit = hesapEsitKaydi();
  const uzakVar = uzak && uzak.veri && Object.keys(uzak.veri).length > 0;

  if (!uzakVar) { await hesapEsitle(true); return; }                     /* ilk kez: bu cihazdakini yükle */

  const uzakIz = hesapGoruntuIzi(uzak.veri);
  if (uzakIz === yerelIz) { hesapEsitKaydiYaz(yerelIz); hesapEsitDurum = "güncel"; return; }

  if (kayit) {
    const yerelDegisti = kayit.iz !== yerelIz;
    const uzakYeni = new Date(uzak.guncelleme) > new Date(kayit.zaman);
    if (!yerelDegisti && uzakYeni) { hesapUzagiUygula(uzak.veri); return; }    /* başka cihazda ilerlendi */
    if (yerelDegisti && !uzakYeni) { await hesapEsitle(true); return; }          /* bu cihazda ilerlendi */
    if (!yerelDegisti && !uzakYeni) { hesapEsitDurum = "güncel"; return; }
  } else if (!hesapCihazAnlamli(yerel)) {
    hesapUzagiUygula(uzak.veri); return;                                          /* boş cihaz: hesaptakini al */
  }

  /* İki tarafta da farklı ilerleme var: kullanıcı seçsin. */
  hesapCatismaUzak = uzak;
  hesapPencere("catisma");
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

/* Sekme kapanırken ya da arka plana geçerken son hâli kaydet. */
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") { hesapEsitle(); }
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
