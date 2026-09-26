/* Liderlik tabloları — Oyunlar sayfasında.

   Veriler Supabase'deki görünümlerden okunur (supabase/kurulum.sql, LİDERLİK bölümü).
   Site yalnızca ham ölçüleri gönderir (istatistik_gonder); tamlık, haftalık ve
   Tömye ayı puanlarını, sınır ve hız kontrollerini veritabanı yapar. Kurala uymayan
   kayıt askıya alınır ve tablolarda görünmez; yönetici panelindeki Liderlik
   sekmesinden incelenir. */

const LIDERLIK_TABLOLARI = [
  { id: "haftalik",  grup: "genel",  ad: "Bu hafta",        birim: "eçka", unvan: "Haftanın Arşivcisi", not: "Her pazartesi sıfırlanır." },
  { id: "sezonluk",  grup: "genel",  ad: "Tömye ayı",       birim: "eçka", unvan: "Ayın Arşivcisi",     not: "Tömye takviminin 28 günlük ayı boyunca kazanılan eçka." },
  { id: "tamlik",    grup: "genel",  ad: "Tamlık",          birim: "%",    unvan: "Baş Arşivci",        not: "Karakterler, katmanlar, oyunlar, galeri ve günler." },
  { id: "ecka_toplam", grup: "genel", ad: "Toplam eçka",    birim: "eçka", unvan: "Eçka Hazinedarı",    not: "Bugüne kadar kazanılan (harcanan düşülmez)." },
  { id: "seri",      grup: "genel",  ad: "Giriş serisi",    birim: "gün",  unvan: "Sönmeyen Mum",       not: "Arka arkaya gelinen günler." },
  { id: "katman",    grup: "genel",  ad: "Buz katmanları",  birim: "",     unvan: "Buz Kıran",          not: "Çözülen şifreli katmanlar." },
  { id: "madalya",   grup: "genel",  ad: "Madalyalar",      birim: "",     unvan: "Madalya Avcısı",     not: "" },
  { id: "nobet",     grup: "oyun",   ad: "Nöbet",           birim: "gün",  unvan: "Nöbetin Bekçisi",    not: "Dayanılan en uzun gün." },
  { id: "cevirmen",  grup: "oyun",   ad: "Gırı Çevirmeni",  birim: "/8",   unvan: "Gırıca Ustası",      not: "" },
  { id: "vardiya",   grup: "oyun",   ad: "Gündüz Vardiyası", birim: "/10", unvan: "Tezgâhın Yıldızı",   not: "En çok memnun müşteri." },
  { id: "yazi",      grup: "oyun",   ad: "Yazı Çözme",      birim: "/6",   unvan: "Kyldo Okuru",        not: "" },
  { id: "boyut",     grup: "oyun",   ad: "Boyut Sürüklenmesi", birim: "/3", unvan: "Boyut Gezgini",     not: "Ulaşılan en yüksek seviye." },
  { id: "baloncuk",  grup: "oyun",   ad: "Baloncuk Evren",  birim: "",     unvan: "Tuhaflık Mimarı",    not: "En tuhaf evren." },
  { id: "bulmaca",   grup: "ozel",   ad: "Günün bulmacası", birim: "",     unvan: "Sabah Kuşu",         not: "Bugünkü bulmacayı çözenler, çözüş sırasıyla." },
  { id: "kulupler",  grup: "ozel",   ad: "Kulüpler",        birim: "",     unvan: "",                   not: "Kişilik tipine göre takımlar; puan üyelerin bu haftaki eçkası." },
  { id: "topluluk",  grup: "ozel",   ad: "Topluluk",        birim: "",     unvan: "",                   not: "Arşivcilerin rol ve kişilik dağılımı." }
];
const LIDERLIK_GRUPLARI = { genel: "Genel", oyun: "Oyunlar", ozel: "Topluluk" };
const LIDERLIK_SATIR = 20;

let liderlikSecili = "haftalik";
let liderlikTakip = false;       /* yalnızca takip ettiklerim */
let liderlikTakipListesi = null;

/** Takip filtresi açıksa sorguyu takip edilenlere (ve kendine) daraltır. */
async function liderlikFiltrele(sorgu) {
  if (!liderlikTakip || typeof hesapKullanici === "undefined" || !hesapKullanici) { return sorgu; }
  if (!liderlikTakipListesi) {
    const { data } = await hesapIstemci.rpc("takip_ettiklerim");
    liderlikTakipListesi = Array.isArray(data) ? data : [];
  }
  const liste = liderlikTakipListesi.concat(hesapProfil && hesapProfil.kullanici_adi ? [hesapProfil.kullanici_adi] : []);
  return sorgu.in("kullanici_adi", liste.length ? liste : ["-"]);
}
let liderlikBenim = null;       /* kendi istatistik satırım: { gizli, askida, askida_neden, engelli } */

function liderlikTablo(id) { return LIDERLIK_TABLOLARI.find(function (t) { return t.id === id; }) || LIDERLIK_TABLOLARI[0]; }

function liderlikSezonAdi() {
  const d = (typeof dunyadanTomyeye === "function") ? dunyadanTomyeye(new Date()) : null;
  return d ? d.ay + " " + d.yil : "Tömye ayı";
}

function liderlikBaslik(t) {
  if (t.id === "sezonluk") { return liderlikSezonAdi(); }
  return t.ad;
}

function liderlikUnvan(t) {
  if (t.id === "sezonluk") { const d = dunyadanTomyeye(new Date()); return d ? d.ay + " Ayının Arşivcisi" : t.unvan; }
  return t.unvan;
}

/* ==================== gönderim ==================== */

const LIDER_IZ_ANAHTAR = "sb-tentiforapp-lider-iz";

function liderlikOlculeri() {
  const o = arsivciOlculeri();
  let okunan = 0;
  try {
    const g = JSON.parse(kayitOku("tentiforapp_okuma_gecmis") || "[]");
    okunan = new Set(g.filter(function (x) { return x.tur === "karakter"; }).map(function (x) { return x.id; })).size;
  } catch (_) { okunan = 0; }
  const r = (typeof REKOR_ANAHTAR !== "undefined" ? jsonOku(REKOR_ANAHTAR, {}) : {}) || {};
  return {
    okunan_karakter: okunan, katman: o.katman, oyun: o.oyun, galeri: o.galeri, gun: o.gun,
    seri: (typeof seriHesapla === "function") ? seriHesapla() : 0,
    madalya: (typeof arsivciMadalyalari === "function") ? arsivciMadalyalari().length : 0,
    ecka_toplam: Math.round(cuzdan.kazanilan || 0),
    nobet: Math.max(typeof enIyiSkor === "function" ? enIyiSkor() : 0, r.nobet || 0),
    cevirmen: r.cevirmen || 0, vardiya: r.vardiya || 0, yazi: r.yazi || 0, boyut: r.boyut || 0, baloncuk: r.baloncuk || 0,
    rol: arsivciRol().ad, kisilik: arsivciKisilik().ad
  };
}

let liderlikGonderiliyor = false;

/** Hesap eşitlemesinden sonra çağrılır. Değişmediyse göndermez; aynı anda tek gönderim. */
async function liderlikGonder(zorla) {
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici || liderlikGonderiliyor) { return; }
  let g;
  try { g = liderlikOlculeri(); } catch (_) { return; }
  const iz = JSON.stringify(g);
  const anahtar = LIDER_IZ_ANAHTAR + "-" + hesapKullanici.id;
  if (!zorla && kayitOku(anahtar) === iz) { return; }

  liderlikGonderiliyor = true;
  let data, error;
  try { ({ data, error } = await hesapIstemci.rpc("istatistik_gonder", { g: g })); }
  finally { liderlikGonderiliyor = false; }
  if (error) { return; }
  if (data && data.durum !== "erken") { kayitYaz(anahtar, iz); }
  if (data && data.durum === "askida") { liderlikBenim = null; }
}

/** Tam sıfırlamada hesaptaki tablolar da sıfırlanır. */
async function liderlikSifirla() {
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) { return; }
  await hesapIstemci.rpc("istatistik_sifirla");
  try { window.localStorage.removeItem(LIDER_IZ_ANAHTAR + "-" + hesapKullanici.id); } catch (_) { /* yoksay */ }
}

async function liderlikBulmacaCozuldu() {
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) { return; }
  await hesapIstemci.rpc("bulmaca_cozdum");
}

async function liderlikBenimYukle() {
  if (!hesapIstemci || !hesapKullanici) { liderlikBenim = null; return; }
  const { data } = await hesapIstemci.from("istatistikler")
    .select("gizli, askida, askida_neden, engelli").eq("id", hesapKullanici.id).maybeSingle();
  liderlikBenim = data || null;
}

/* ==================== çizim ==================== */

function liderlikCiz() {
  const alan = document.querySelector("#liderlikAlan");
  if (!alan) { return; }

  if (typeof hesapEtkin !== "function" || !hesapEtkin()) {
    alan.innerHTML = '<p class="oyun-not">Liderlik tabloları hesaplar açılınca başlayacak.</p>';
    return;
  }

  const t = liderlikTablo(liderlikSecili);
  const sekmeler = Object.keys(LIDERLIK_GRUPLARI).map(function (g) {
    return '<div class="lider-grup"><span class="lider-grup-ad">' + LIDERLIK_GRUPLARI[g] + "</span>" +
      '<div class="filtre">' + LIDERLIK_TABLOLARI.filter(function (x) { return x.grup === g; }).map(function (x) {
        return '<button class="' + (x.id === t.id ? "secili" : "") + '" data-lider="' + x.id + '">' + kacir(liderlikBaslik(x)) + "</button>";
      }).join("") + "</div></div>";
  }).join("");

  alan.innerHTML =
    sekmeler +
    '<div class="lider-kutu">' +
      '<div class="lider-ust"><h3>' + kacir(liderlikBaslik(t)) + "</h3>" +
        (liderlikUnvan(t) ? '<span class="lider-unvan-ipucu">birinciye unvan: <b>' + kacir(liderlikUnvan(t)) + "</b></span>" : "") +
      "</div>" +
      (t.not ? '<p class="oyun-not">' + kacir(t.not) + "</p>" : "") +
      (typeof hesapKullanici !== "undefined" && hesapKullanici && !(t.yukle && !t.takipli) && ["bulmaca", "kulupler", "topluluk"].indexOf(t.id) === -1
        ? '<label class="lider-gorun lider-takip"><input type="checkbox" data-lider-takip="1"' + (liderlikTakip ? " checked" : "") +
          "> yalnızca takip ettiklerim ve ben</label>" : "") +
      '<div id="liderlikIcerik"><p class="oyun-not">Yükleniyor…</p></div>' +
      '<div id="liderlikBen"></div>' +
    "</div>";

  if (typeof hesapIstemci === "undefined" || !hesapIstemci) {
    /* kütüphane gerekince yüklenir; hazır olunca hesapOturumAyarla tabloyu yeniden çizer */
    if (typeof hesapGerekli === "function") { hesapGerekli(); }
    return;
  }
  liderlikIcerikYukle(t);
}

async function liderlikIcerikYukle(t) {
  const kutu = document.querySelector("#liderlikIcerik");
  if (!kutu) { return; }
  try {
    if (t.yukle) { await t.yukle(kutu, t); }
    else if (t.id === "bulmaca") { await liderlikBulmacaCiz(kutu); }
    else if (t.id === "kulupler") { await liderlikKuluplerCiz(kutu); }
    else if (t.id === "topluluk") { await liderlikToplulukCiz(kutu); }
    else { await liderlikSiralamaCiz(kutu, t); }
  } catch (e) {
    kutu.innerHTML = '<p class="oyun-not">' + kacir(typeof hesapHataMetni === "function" ? hesapHataMetni(e) : "Yüklenemedi") + "</p>";
  }
  liderlikBenCiz(t);
}

function liderlikBenimAdim() { return (typeof hesapProfil !== "undefined" && hesapProfil && hesapProfil.kullanici_adi) || null; }

function liderlikSatir(sira, p, deger, t, unvanli) {
  const ben = liderlikBenimAdim() === p.kullanici_adi;
  const madalya = sira === 1 ? "①" : sira === 2 ? "②" : sira === 3 ? "③" : String(sira);
  return '<div class="lider-satir' + (ben ? " ben" : "") + (sira <= 3 ? " ilk" + sira : "") + '">' +
      '<span class="lider-sira">' + madalya + "</span>" +
      '<a class="lider-kisi" href="#/u/' + encodeURIComponent(p.kullanici_adi) + '">' +
        (typeof hesapAvatar === "function" ? hesapAvatar(p, 30) : "") +
        '<span class="lider-ad">' + kacir(p.gorunen_ad || p.kullanici_adi) +
          (unvanli ? '<span class="lider-unvan">' + kacir(unvanli) + "</span>" : "") +
          '<span class="lider-kadi">@' + kacir(p.kullanici_adi) + "</span></span>" +
      "</a>" +
      '<span class="lider-deger">' + kacir(deger) + "</span>" +
      (typeof hesapKullanici !== "undefined" && hesapKullanici && !ben
        ? '<button class="lider-bildir" data-lider-bildir="' + kacir(p.kullanici_adi) + '" title="Şüpheli bildir" aria-label="Şüpheli bildir">⚑</button>'
        : '<span class="lider-bildir-bos"></span>') +
    "</div>";
}

function liderlikDegerMetni(t, v) {
  if (t.id === "tamlik") { return "%" + v; }
  if (t.birim && t.birim.charAt(0) === "/") { return v + t.birim; }
  return String(v) + (t.birim ? " " + t.birim : "");
}

async function liderlikSiralamaCiz(kutu, t) {
  const { data, error } = await (await liderlikFiltrele(hesapIstemci.from("liderlik")
    .select("kullanici_adi, gorunen_ad, " + t.id).gt(t.id, 0)))
    .order(t.id, { ascending: false }).order("guncelleme", { ascending: true }).limit(LIDERLIK_SATIR);
  if (error) { throw error; }
  if (!data || !data.length) {
    kutu.innerHTML = '<p class="lider-bos">Bu tabloda henüz kimse yok. İlk sen ol!</p>';
    return;
  }
  /* eşit değerler aynı sırayı paylaşır */
  let sira = 0, onceki = null;
  kutu.innerHTML = '<div class="lider-liste">' + data.map(function (p, i) {
    if (p[t.id] !== onceki) { sira = i + 1; onceki = p[t.id]; }
    return liderlikSatir(sira, p, liderlikDegerMetni(t, p[t.id]), t, sira === 1 ? liderlikUnvan(t) : "");
  }).join("") + "</div>";
}

async function liderlikBulmacaCiz(kutu) {
  const { data, error } = await hesapIstemci.from("bulmaca_bugun")
    .select("kullanici_adi, gorunen_ad, zaman, sira").order("sira").limit(LIDERLIK_SATIR);
  if (error) { throw error; }
  if (!data || !data.length) {
    kutu.innerHTML = '<p class="lider-bos">Bugünkü bulmacayı henüz kimse çözmedi. ' +
      '<button class="ic-bag" data-gez-git="arsivci">Bulmacaya git</button></p>';
    return;
  }
  kutu.innerHTML = '<div class="lider-liste">' + data.map(function (p) {
    const saat = new Date(p.zaman).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    return liderlikSatir(p.sira, p, saat, liderlikTablo("bulmaca"), p.sira === 1 ? "Sabah Kuşu" : "");
  }).join("") + "</div>";
}

async function liderlikKuluplerCiz(kutu) {
  const { data: ham, error } = await hesapIstemci.from("kulupler").select("*").order("haftalik", { ascending: false });
  if (error) { throw error; }
  /* toplamlar veritabanında bigint: sayı olarak kullan */
  const data = (ham || []).map(function (k) {
    return { kisilik: k.kisilik, uye: Number(k.uye) || 0, haftalik: Number(k.haftalik) || 0, ortalama_tamlik: Number(k.ortalama_tamlik) || 0 };
  });
  if (!data || !data.length) { kutu.innerHTML = '<p class="lider-bos">Henüz kulüp yok.</p>'; return; }
  const benim = (typeof arsivciKisilik === "function") ? arsivciKisilik().ad : "";
  const enCok = Math.max.apply(null, data.map(function (k) { return k.haftalik || 0; }).concat([1]));
  kutu.innerHTML = '<div class="lider-liste">' + data.map(function (k, i) {
    return '<div class="lider-satir kulup' + (k.kisilik === benim ? " ben" : "") + '">' +
        '<span class="lider-sira">' + (i === 0 ? "①" : i + 1) + "</span>" +
        '<span class="lider-kisi"><span class="lider-ad">' + kacir(k.kisilik) +
          (k.kisilik === benim ? '<span class="lider-unvan">senin kulübün</span>' : "") +
          '<span class="lider-kadi">' + k.uye + " üye · ort. tamlık %" + (k.ortalama_tamlik || 0) + "</span>" +
          '<span class="lider-cubuk"><i style="width:' + Math.round(100 * (k.haftalik || 0) / enCok) + '%"></i></span>' +
        "</span></span>" +
        '<span class="lider-deger">' + (k.haftalik || 0) + " eçka</span><span></span>" +
      "</div>";
  }).join("") + "</div>";
}

async function liderlikToplulukCiz(kutu) {
  const [k, r] = await Promise.all([
    hesapIstemci.from("kulupler").select("kisilik, uye"),
    hesapIstemci.from("topluluk_roller").select("rol, sayi")
  ]);
  if (k.error) { throw k.error; }
  if (r.error) { throw r.error; }
  (k.data || []).forEach(function (x) { x.uye = Number(x.uye) || 0; });
  (r.data || []).forEach(function (x) { x.sayi = Number(x.sayi) || 0; });
  const cubuklar = function (liste, ad, sayi) {
    const toplam = liste.reduce(function (t, x) { return t + (x[sayi] || 0); }, 0) || 1;
    return liste.slice().sort(function (a, b) { return b[sayi] - a[sayi]; }).map(function (x) {
      const yuzde = Math.round(100 * x[sayi] / toplam);
      return '<div class="dagilim-satir"><span>' + kacir(x[ad]) + "</span>" +
        '<span class="lider-cubuk"><i style="width:' + yuzde + '%"></i></span><b>%' + yuzde + "</b></div>";
    }).join("");
  };
  const toplamKisi = (k.data || []).reduce(function (t, x) { return t + x.uye; }, 0);
  kutu.innerHTML = toplamKisi
    ? '<p class="oyun-not">' + toplamKisi + " arşivci tablolarda.</p>" +
      '<div class="dagilim"><div><span class="oyun-etiket">Kişilikler</span>' + cubuklar(k.data || [], "kisilik", "uye") + "</div>" +
      '<div><span class="oyun-etiket">Roller</span>' + cubuklar(r.data || [], "rol", "sayi") + "</div></div>"
    : '<p class="lider-bos">Henüz kimse yok.</p>';
}

/** Tablonun altında: senin sıran ya da seni tabloya davet. */
async function liderlikBenCiz(t) {
  const el = document.querySelector("#liderlikBen");
  if (!el) { return; }

  if (!hesapKullanici) {
    el.innerHTML = '<div class="lider-ben"><span>Tablolara girmek için bir hesap aç; ilerlemen otomatik yazılır.</span>' +
      '<button class="dugme dugme-sade" data-hesap-pencere="kayit">Hesap oluştur</button></div>';
    return;
  }

  await liderlikBenimYukle();
  const b = liderlikBenim;
  let metin = "";
  if (b && b.engelli) { metin = "Kaydın yönetici tarafından tablolardan çıkarıldı."; }
  else if (b && b.askida) { metin = "Kaydın incelemede; bu sürede tablolarda görünmüyorsun." + (b.askida_neden ? " (" + b.askida_neden + ")" : ""); }
  else if (b && b.gizli) { metin = "Tablolarda görünmemeyi seçtin."; }
  else if (!b) { metin = "Bir sonraki eşitlemede tablolara yazılacaksın."; }
  else if (!t.yukle && ["bulmaca", "kulupler", "topluluk"].indexOf(t.id) === -1 && liderlikBenimAdim()) {
    const { data } = await hesapIstemci.from("liderlik").select(t.id).eq("kullanici_adi", liderlikBenimAdim()).maybeSingle();
    const v = data ? data[t.id] : 0;
    if (!v) { metin = "Bu tabloda henüz puanın yok."; }
    else {
      const { count } = await hesapIstemci.from("liderlik").select("kullanici_adi", { count: "exact", head: true }).gt(t.id, v);
      metin = "Sen: <b>" + ((count || 0) + 1) + ".</b> sıradasın · " + kacir(liderlikDegerMetni(t, v));
    }
  }

  el.innerHTML = '<div class="lider-ben"><span>' + (metin.indexOf("<b>") !== -1 ? metin : kacir(metin)) + "</span>" +
    '<label class="lider-gorun"><input type="checkbox" data-lider-gorun="1"' + (b && b.gizli ? "" : " checked") +
      (b ? "" : " disabled") + "> tablolarda görün</label></div>";
}

/* ==================== bildir ==================== */

function liderlikBildirPencere(ad) {
  const perde = document.querySelector("#perde");
  if (!perde) { return; }
  perde.innerHTML =
    '<div class="pencere hesap-pencere" role="dialog" aria-modal="true">' +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      "<h3>Şüpheli bildir</h3>" +
      '<p class="pencere-alt">@' + kacir(ad) + " adlı arşivcinin skorları sana gerçek dışı mı görünüyor? " +
        "Üç ayrı kişi bildirirse kayıt incelenene kadar tablolardan kalkar.</p>" +
      '<form data-lider-bildir-form="' + kacir(ad) + '">' +
        '<label class="hesap-etiket" for="lbNeden">Neden (isteğe bağlı)</label>' +
        '<textarea class="kod-giris" id="lbNeden" rows="3" maxlength="200"></textarea>' +
        '<button class="dugme dugme-tam" type="submit">Bildir</button>' +
      "</form>" +
      '<p class="pencere-durum" id="hesapDurum" role="status"></p>' +
    "</div>";
  perde.hidden = false;
}

async function liderlikBildir(ad, neden) {
  const { data, error } = await hesapIstemci.rpc("bildir", { hedef_ad: ad, neden: neden || null });
  const m = error ? hesapHataMetni(error)
    : ({ tamam: "Bildirimin alındı, teşekkürler.", yok: "Bu arşivci bulunamadı.", kendin: "Kendini bildiremezsin.",
         sinir: "Bugün yeterince bildirimde bulundun.", giris: "Önce giriş yapmalısın." })[data] || "Alındı.";
  if (typeof hesapDurum === "function") { hesapDurum(m, data === "tamam"); }
  if (data === "tamam") { setTimeout(function () { if (typeof perdeKapat === "function") { perdeKapat(); } }, 1400); }
}

/* ==================== profil sayfasına dereceler ==================== */

/** Herkese açık profilde: ilk 10'daki dereceleri ve unvanları gösterir. */
async function liderlikProfilDereceleri(kadi) {
  const el = document.querySelector("#profilDereceler");
  if (!el || !hesapIstemci) { return; }
  const { data: ham } = await hesapIstemci.from("liderlik_dereceler").select("*").eq("kullanici_adi", kadi).maybeSingle();
  if (!ham) { return; }
  /* rank() bigint döner: sayıya çevir */
  const data = {};
  Object.keys(ham).forEach(function (k) { data[k] = k.indexOf("v_") === 0 || k === "kullanici_adi" ? ham[k] : Number(ham[k]); });
  const iyiler = LIDERLIK_TABLOLARI.filter(function (t) {
    return data["v_" + t.id] && data[t.id] && data[t.id] <= 10;
  }).sort(function (a, b) { return data[a.id] - data[b.id]; });
  if (!iyiler.length) { return; }
  el.innerHTML = '<span class="oyun-etiket">Dereceler</span><div class="hesap-madalya">' + iyiler.map(function (t) {
    return "<span" + (data[t.id] === 1 ? ' class="birinci"' : "") + ">" +
      (data[t.id] === 1 ? "★ " + kacir(liderlikUnvan(t)) + " · " : "") +
      kacir(liderlikBaslik(t)) + ": " + data[t.id] + ".</span>";
  }).join("") + "</div>";
}

/* ==================== yönetici paneli: Liderlik sekmesi ==================== */

function yoneticiLiderlik() {
  setTimeout(yoneticiLiderlikYukle, 0);
  return '<p class="oyun-not">Otomatik kontrollere takılan ve bildirilen kayıtlar. Bu sekme, Supabase\'de ' +
    "<code>yoneticiler</code> tablosuna eklenmiş bir hesapla giriş yapmış olmanı ister.</p>" +
    '<div class="kutu-y" id="yLiderlikAlan"><p class="oyun-not">Yükleniyor…</p></div>';
}

async function yoneticiLiderlikYukle() {
  const alan = document.querySelector("#yLiderlikAlan");
  if (!alan) { return; }
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) {
    alan.innerHTML = '<p class="oyun-not">Önce sağ üstten sitedeki hesabınla giriş yap.</p>';
    return;
  }
  const { data, error } = await hesapIstemci.rpc("liderlik_denetim");
  if (error) {
    alan.innerHTML = /yetki/i.test(error.message || "")
      ? '<p class="oyun-not">Bu hesap yönetici olarak tanımlı değil. Supabase → SQL Editor\'de şunu çalıştır:</p>' +
        '<pre class="y-kod">insert into public.yoneticiler (id)\nselect id from auth.users where email = \'' +
          kacir((hesapKullanici && hesapKullanici.email) || "SENIN@EPOSTAN") + "';</pre>"
      : '<p class="oyun-not">' + kacir(hesapHataMetni(error)) + "</p>";
    return;
  }
  if (!data || !data.length) { alan.innerHTML = '<p class="oyun-not">İncelenecek kayıt yok. Her şey temiz.</p>'; return; }

  alan.innerHTML = "<label>İncelenecek kayıtlar — " + data.length + "</label>" +
    '<div class="y-blok-liste">' + data.map(function (k) {
      const durum = k.engelli ? "tablodan çıkarıldı" : k.askida ? "askıda" : "bildirildi";
      return '<div class="y-lider-kayit">' +
          '<div><b>' + kacir(k.gorunen_ad || k.kullanici_adi) + '</b> <a href="#/u/' + encodeURIComponent(k.kullanici_adi) + '">@' + kacir(k.kullanici_adi) + "</a>" +
            ' <span class="y-lider-durum">' + durum + "</span></div>" +
          (k.askida_neden ? '<div class="oyun-not">Neden: ' + kacir(k.askida_neden) + "</div>" : "") +
          (Number(k.bildirim_sayisi) ? '<div class="oyun-not">' + Number(k.bildirim_sayisi) + " bildirim: " + kacir(k.bildirim_nedenleri || "") + "</div>" : "") +
          '<div class="oyun-not">tamlık %' + k.tamlik + " · " + k.ecka_toplam + " eçka · " + k.gun + " gün</div>" +
          '<div class="oyun-sira">' +
            (k.engelli
              ? '<button class="dugme dugme-sade" data-y-lider-karar="geri_al" data-id="' + k.id + '">Tabloya geri al</button>'
              : '<button class="dugme dugme-sade" data-y-lider-karar="onayla" data-id="' + k.id + '">Sorun yok, onayla</button>' +
                '<button class="dugme dugme-sade y-sil" data-y-lider-karar="cikar" data-id="' + k.id + '">Tablodan çıkar</button>') +
          "</div>" +
        "</div>";
    }).join("") + "</div>";
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const s = e.target.closest("[data-lider]");
  if (s) { liderlikSecili = s.dataset.lider; liderlikCiz(); return; }

  const b = e.target.closest("[data-lider-bildir]");
  if (b) { liderlikBildirPencere(b.dataset.liderBildir); return; }

  const k = e.target.closest("[data-y-lider-karar]");
  if (k) {
    k.disabled = true;
    hesapIstemci.rpc("liderlik_karar", { hedef: k.dataset.id, karar: k.dataset.yLiderKarar }).then(function (r) {
      if (r.error) { yoneticiDurum(hesapHataMetni(r.error), false); k.disabled = false; return; }
      yoneticiDurum("Karar kaydedildi", true);
      yoneticiLiderlikYukle();
    });
  }
});

document.addEventListener("change", function (e) {
  if (e.target.closest("[data-lider-takip]")) { liderlikTakip = e.target.checked; liderlikCiz(); return; }
  const g = e.target.closest("[data-lider-gorun]");
  if (!g) { return; }
  hesapIstemci.rpc("liderlik_gorunurluk", { gizle: !g.checked }).then(function () { liderlikCiz(); });
});

document.addEventListener("submit", function (e) {
  const f = e.target.closest("[data-lider-bildir-form]");
  if (!f) { return; }
  e.preventDefault();
  liderlikBildir(f.dataset.liderBildirForm, (f.querySelector("#lbNeden") || {}).value || "");
});
