/* Son ziyaretinden beri yeni — okuyucu geri döndüğünde neyin eklendiğini ya da
   değiştiğini görsün.

   Her içerik kaydının kısa bir parmak izi (içeriğin özeti) bu cihazda saklanır.
   Açılışta şimdiki izler öncekilerle karşılaştırılır: izi hiç olmayan kayıt
   "yeni", izi değişen kayıt "güncellendi" sayılır. Fark bu oturum boyunca
   (sayfa yenilense de) korunur; bir sonraki ziyarette yeniden hesaplanır.
   İlk ziyarette her şey yeni olacağı için hiçbir şey işaretlenmez. */

const ZIYARET_IZ_ANAHTAR = "tentiforapp_ziyaret_izleri";
const ZIYARET_FARK_ANAHTAR = "tentiforapp_ziyaret_fark";

/* tur: kimlik öneki · sayfa: gezinmede nokta konacak sayfa · bolum: erişim ve gidilecek yer */
const ZIYARET_TURLERI = [
  { tur: "karakter", ad: "Karakter", sayfa: "arsiv", bolum: "arsiv",
    liste: function () { return veri.karakterler; }, baslik: function (k) { return k.ad; },
    git: function (k) { return "#/karakter/" + encodeURIComponent(k.id); } },
  { tur: "evren", ad: "Evren", sayfa: "arsiv", bolum: "evren",
    liste: function () { return veri.evren; }, baslik: function (e) { return e.baslik; },
    git: function (e) { return "#/evren/" + encodeURIComponent(e.id); } },
  { tur: "roman", ad: "Roman", sayfa: "okuma", bolum: "roman",
    liste: function () { return veri.roman && veri.roman.bolumler; },
    kimlik: function (b) { return b.no; }, baslik: function (b) { return b.no + ". bölüm · " + b.baslik; } },
  { tur: "hikaye", ad: "Kısa hikâye", sayfa: "okuma", bolum: "kisaHikayeler",
    liste: function () { return veri.kisaHikayeler; }, baslik: function (h) { return h.baslik; } },
  { tur: "olay", ad: "Olay", sayfa: "okuma", bolum: "olaylar",
    liste: function () { return veri.anlatiOlaylari; }, baslik: function (o) { return o.baslik; } },
  { tur: "mektup", ad: "Mektup", sayfa: "belgeler", bolum: "mektuplar",
    liste: function () { return veri.mektuplar; },
    baslik: function (m) { return (m.kimden || "?") + " → " + (m.kime || "?"); } },
  { tur: "galeri", ad: "Galeri", sayfa: "oyunlar", bolum: "galeri",
    liste: function () { return veri.galeri; }, baslik: function (g) { return g.baslik; } },
  { tur: "yer", ad: "Harita", sayfa: "dunya", bolum: "harita",
    liste: function () {
      const l = [];
      (veri.haritalar || []).forEach(function (h) {
        (h.yerler || []).forEach(function (y) { l.push({ kayit: y, kimlik: h.id + ":" + y.id, ek: h.ad }); });
      });
      return l;
    },
    sarili: true, baslik: function (y, s) { return y.ad + (s && s.ek ? " (" + s.ek + ")" : ""); } },
  { tur: "yapim", ad: "Yapım", sayfa: "proje", bolum: "yapimlar",
    liste: function () { return veri.yapimlar; }, kimlik: function (y) { return y.ad + "|" + (y.tur || ""); },
    baslik: function (y) { return y.ad; } },
  { tur: "sozluk", ad: "Sözlük", sayfa: "araclar", bolum: "sozluk",
    liste: function () { return veri.sozluk; }, kimlik: function (s) { return s.terim; },
    baslik: function (s) { return s.terim; } },
  { tur: "dosya", ad: "Dosya", sayfa: "araclar", bolum: "dosyalar",
    liste: function () { return veri.kilitliDosyalar; }, baslik: function (d) { return d.ad; } },
];

let ziyaretFark = {};                 /* { "karakter:tari": "yeni" | "guncel" } */
let ziyaretNesne = new WeakMap();     /* kayıt nesnesi → anahtar (rozet için) */
let ziyaretBilgi = {};                /* anahtar → { tur, baslik, git, sayfa, bolum } */

/** Kısa ve hızlı parmak izi (djb2). Güvenlik için değil, yalnızca "değişti mi" için. */
function ziyaretIz(nesne) {
  const s = JSON.stringify(nesne) || "";
  let h = 5381;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}

/** Şimdiki bütün kayıtların izlerini çıkarır, nesne–anahtar eşlemesini kurar. */
function ziyaretIzleriCikar() {
  const izler = {};
  ziyaretNesne = new WeakMap();
  ziyaretBilgi = {};

  ZIYARET_TURLERI.forEach(function (t) {
    (t.liste() || []).forEach(function (oge) {
      const kayit = t.sarili ? oge.kayit : oge;
      if (!kayit || typeof kayit !== "object") { return; }
      const ham = t.sarili ? oge.kimlik : (t.kimlik ? t.kimlik(kayit) : (kayit.id || t.baslik(kayit)));
      if (ham === undefined || ham === null || ham === "") { return; }

      const anahtar = t.tur + ":" + ham;
      izler[anahtar] = ziyaretIz(kayit);
      ziyaretNesne.set(kayit, anahtar);
      ziyaretBilgi[anahtar] = {
        tur: t.ad, sayfa: t.sayfa, bolum: t.bolum,
        baslik: t.baslik(kayit, t.sarili ? oge : null) || "",
        git: t.git ? t.git(kayit) : "#/" + t.bolum
      };
    });
  });
  return izler;
}

/** Açılışta bir kez çalışır (24-arsiv-mantigi.js çizimden önce çağırır). */
function ziyaretKarsilastir() {
  const simdiki = ziyaretIzleriCikar();

  /* Bu oturumda zaten hesaplandıysa (sayfa yenilendi) aynı farkı kullan. */
  let oturum = null;
  try { oturum = JSON.parse(window.sessionStorage.getItem(ZIYARET_FARK_ANAHTAR) || "null"); } catch (_) { oturum = null; }

  if (oturum && typeof oturum === "object") {
    ziyaretFark = oturum;
  } else {
    const onceki = jsonOku(ZIYARET_IZ_ANAHTAR, null);
    ziyaretFark = {};
    if (onceki && typeof onceki === "object") {
      Object.keys(simdiki).forEach(function (a) {
        if (!(a in onceki)) { ziyaretFark[a] = "yeni"; }
        else if (onceki[a] !== simdiki[a]) { ziyaretFark[a] = "guncel"; }
      });
    }
    ziyaretFarkSakla();
  }

  /* Bir sonraki ziyaretin karşılaştırma noktası bugünkü hâl. */
  jsonYaz(ZIYARET_IZ_ANAHTAR, simdiki);
}

function ziyaretFarkSakla() {
  try { window.sessionStorage.setItem(ZIYARET_FARK_ANAHTAR, JSON.stringify(ziyaretFark)); } catch (_) { /* gizli sekme */ }
}

/** Kayıt için "yeni" | "guncel" | "" — kartlardaki rozet bunu kullanır. */
function ziyaretDurumu(kayit) {
  if (!kayit || typeof kayit !== "object") { return ""; }
  const a = ziyaretNesne.get(kayit);
  return (a && ziyaretFark[a]) || "";
}

/** Erişilebilir (kilidi açık bölümdeki) farklar, bilgileriyle. */
function ziyaretListesi() {
  return Object.keys(ziyaretFark).filter(function (a) {
    const b = ziyaretBilgi[a];
    return b && (typeof bolumErisimi !== "function" || bolumErisimi(b.bolum));
  }).map(function (a) { return Object.assign({ anahtar: a, durum: ziyaretFark[a] }, ziyaretBilgi[a]); });
}

/** Gezinme şeridindeki nokta için: o sayfada kaç yenilik var. */
function ziyaretSayfaSayisi(sayfa) {
  return ziyaretListesi().filter(function (z) { return z.sayfa === sayfa; }).length;
}

function ziyaretGoruldu(anahtar) {
  if (anahtar) { delete ziyaretFark[anahtar]; } else { ziyaretFark = {}; }
  ziyaretFarkSakla();
  ziyaretTazele();
}

function ziyaretTazele() {
  yeniliklerCiz();
  if (typeof gezinmeCiz === "function") { gezinmeCiz(); }
}

/* ==================== Arşiv'in başındaki kart ==================== */

const ZIYARET_GOSTER = 8;
let ziyaretHepsi = false;

function yeniliklerCiz() {
  const alan = document.querySelector("#yenilikAlan");
  if (!alan) { return; }

  const liste = ziyaretListesi();
  if (!liste.length) { alan.innerHTML = ""; return; }

  const yeni = liste.filter(function (z) { return z.durum === "yeni"; }).length;
  const guncel = liste.length - yeni;
  /* önce yeniler, sonra güncellenenler */
  liste.sort(function (a, b) { return (a.durum === "yeni" ? 0 : 1) - (b.durum === "yeni" ? 0 : 1); });
  const gorunen = ziyaretHepsi ? liste : liste.slice(0, ZIYARET_GOSTER);

  alan.innerHTML =
    '<div class="yenilik-kart">' +
      '<div class="yenilik-ust">' +
        '<span class="oyun-etiket">Son ziyaretinden beri</span>' +
        '<span class="yenilik-sayi">' +
          (yeni ? yeni + " yeni" : "") + (yeni && guncel ? " · " : "") + (guncel ? guncel + " güncellendi" : "") +
        "</span>" +
      "</div>" +
      '<div class="yenilik-liste">' + gorunen.map(function (z) {
        return '<button class="yenilik-satir" data-yenilik-git="' + kacir(z.anahtar) + '">' +
                 '<span class="yenilik-tur">' + kacir(z.tur) + "</span>" +
                 '<span class="yenilik-ad">' + kacir(z.baslik) + "</span>" +
                 '<span class="yeni-rozet' + (z.durum === "guncel" ? " guncel" : "") + '">' +
                   (z.durum === "yeni" ? "yeni" : "güncellendi") + "</span>" +
               "</button>";
      }).join("") + "</div>" +
      '<div class="oyun-sira">' +
        (liste.length > ZIYARET_GOSTER
          ? '<button class="dugme dugme-sade" data-yenilik-hepsi="1">' +
              (ziyaretHepsi ? "Daha az göster" : "Hepsini göster (" + liste.length + ")") + "</button>"
          : "") +
        '<button class="dugme dugme-sade" data-yenilik-tamam="1">Tamam, gördüm</button>' +
      "</div>" +
    "</div>";
}

document.addEventListener("click", function (e) {
  const git = e.target.closest("[data-yenilik-git]");
  if (git) {
    const a = git.dataset.yenilikGit;
    const b = ziyaretBilgi[a];
    ziyaretGoruldu(a);
    if (b) {
      /* aynı adrese tekrar gidilirse hashchange tetiklenmez; o zaman elle uygula */
      if (rota() === b.git) {
        if (typeof baglantiyiUygula === "function") { baglantiyiUygula(); }
        if (b.git.split("/").length === 2 && typeof bolumeGit === "function") { bolumeGit(b.bolum); }
      } else {
        location.hash = b.git;
      }
    }
    return;
  }
  if (e.target.closest("[data-yenilik-hepsi]")) { ziyaretHepsi = !ziyaretHepsi; yeniliklerCiz(); return; }
  if (e.target.closest("[data-yenilik-tamam]")) { ziyaretGoruldu(null); }
});
