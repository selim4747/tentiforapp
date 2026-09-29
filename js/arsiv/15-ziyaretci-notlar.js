/* Beşinci dalga — ziyaretçi tarafı.
   Meydan okuma, kişisel notlar, alıntı defteri, okuma geçmişi, madalyalar,
   yazı tipi, yer imi, klavye kısayolları ve tam sıfırlama. */

const NOT_ANAHTAR = "tentiforapp_notlar";
const DEFTER_ANAHTAR = "tentiforapp_defter";
const GECMIS_OKUMA_ANAHTAR = "tentiforapp_okuma_gecmis";
const YAZI_ANAHTAR = "tentiforapp_yazitipi";
const REKOR_ANAHTAR = "tentiforapp_rekorlar";
const MADALYA_ANAHTAR = "tentiforapp_madalyalar";

/** Kayıttan JSON okur. Bozuk ya da beklenmedik tipteyse varsayılana döner —
    eskiden bozuk bir kayıt bütün bölümü çizilemez hâle getiriyordu. */
function jsonOku(anahtar, varsayilan) {
  let d;

  try {
    const h = kayitOku(anahtar);
    if (!h) { return varsayilan; }
    d = JSON.parse(h);
  } catch (e) {
    return varsayilan;
  }

  if (d === null || d === undefined) { return varsayilan; }
  if (Array.isArray(varsayilan) !== Array.isArray(d)) { return varsayilan; }
  if (typeof d !== typeof varsayilan) { return varsayilan; }

  return d;
}

function jsonYaz(anahtar, deger) {
  kayitYaz(anahtar, JSON.stringify(deger));
}

/* ==================== KİŞİSEL NOTLAR ==================== */

function notAl(kimlik) {
  return (jsonOku(NOT_ANAHTAR, {}) || {})[kimlik] || "";
}

function notYaz(kimlik, metin) {
  const n = jsonOku(NOT_ANAHTAR, {}) || {};
  if (String(metin).trim()) { n[kimlik] = String(metin); } else { delete n[kimlik]; }
  jsonYaz(NOT_ANAHTAR, n);
}

/** Karakter penceresine eklenen not alanı. */
function notKutusu(kimlik) {
  const mevcut = notAl(kimlik);
  return '<div class="not-kutu">' +
           '<div class="oyun-etiket">Notun</div>' +
           '<textarea class="kod-giris arac-giris" data-not-kimlik="' + kacir(kimlik) +
             '" rows="3" placeholder="bu kayıt hakkında kendine bir not bırak">' +
             kacir(mevcut) + "</textarea>" +
           '<p class="oyun-not">Yalnızca bu cihazda saklanır.</p>' +
         "</div>";
}

/* ==================== ALINTI DEFTERİ ==================== */

function defterde(metin) {
  const d = jsonOku(DEFTER_ANAHTAR, []);
  return Array.isArray(d) && d.indexOf(metin) !== -1;
}

function deftereEkle(metin) {
  const d = jsonOku(DEFTER_ANAHTAR, []) || [];
  const i = d.indexOf(metin);
  if (i === -1) { d.push(metin); } else { d.splice(i, 1); }
  jsonYaz(DEFTER_ANAHTAR, d);
  if (typeof alintiCiz === "function") { alintiCiz(); }
  defterCiz();
}

function defterCiz() {
  const alan = document.querySelector("#defterAlan");
  if (!alan) { return; }

  const d = jsonOku(DEFTER_ANAHTAR, []) || [];

  alan.innerHTML = d.length
    ? '<div class="alinti-izgara">' + d.map(function (m) {
        const a = (veri.alintilar || []).find(function (x) { return x.metin === m; });
        return '<figure class="alinti">' +
                 "<blockquote>" + kacir(m) + "</blockquote>" +
                 "<figcaption>" + kacir(a ? a.kim : "—") + "</figcaption>" +
                 '<button class="defter-btn dolu" data-defter="' + kacir(m) + '">kaldır</button>' +
               "</figure>";
      }).join("") + "</div>"
    : '<p class="oyun-not">Alıntılar bölümünden beğendiklerini işaretle; burada birikir.</p>';
}

/* ==================== OKUMA GEÇMİŞİ ==================== */

function okumaKaydet(tur, kimlik, ad) {
  const g = jsonOku(GECMIS_OKUMA_ANAHTAR, []) || [];
  const filtre = g.filter(function (x) { return !(x.tur === tur && x.id === kimlik); });
  filtre.push({ tur: tur, id: kimlik, ad: ad, t: Date.now() });
  while (filtre.length > 40) { filtre.shift(); }
  jsonYaz(GECMIS_OKUMA_ANAHTAR, filtre);
}

function okumaGecmisiCiz() {
  const alan = document.querySelector("#okumaGecmisAlan");
  if (!alan) { return; }

  const g = (jsonOku(GECMIS_OKUMA_ANAHTAR, []) || []).slice().reverse();

  if (!g.length) {
    alan.innerHTML = '<p class="oyun-not">Henüz kayıt gezmedin.</p>';
    return;
  }

  const son = g[0];

  alan.innerHTML =
    '<div class="kaldigin-yer">' +
      '<span class="oyun-etiket">kaldığın yer</span>' +
      '<button class="dugme" data-okuma-git="' + kacir(son.tur) + "/" + kacir(son.id) + '">' +
        kacir(son.ad) + " · devam et</button>" +
    "</div>" +
    '<ul class="gecmis-liste">' +
      g.slice(0, 20).map(function (x) {
        return '<li class="arti"><span>' + (x.tur === "karakter" ? "kayıt" : "evren") + "</span>" +
               '<span><button class="ic-bag" data-okuma-git="' + kacir(x.tur) + "/" + kacir(x.id) +
                 '">' + kacir(x.ad) + "</button></span>" +
               '<span class="gecmis-tarih">' + new Date(x.t).toLocaleDateString("tr") + "</span></li>";
      }).join("") +
    "</ul>";
}

/* ==================== YENİDEN OKUMA ==================== */

const GORULEN_ANAHTAR = "tentiforapp_gorulen";

/** Bir kayıt, son çözülen katmandan sonra hiç açılmadıysa "yeni" sayılır. */
function yeniAcildiMi(o) {
  if (!o.gizli || !o.gizli.length) { return false; }
  const acikVar = o.gizli.some(function (g) { return !!cozulenler[g.dogrulama]; });
  if (!acikVar) { return false; }
  const g = jsonOku(GORULEN_ANAHTAR, []) || [];
  return g.indexOf(o.id) === -1;
}

function gorulduIsaretle(kimlik) {
  const g = jsonOku(GORULEN_ANAHTAR, []) || [];
  if (g.indexOf(kimlik) === -1) { g.push(kimlik); jsonYaz(GORULEN_ANAHTAR, g); }
}

function yeniRozeti(o) {
  return yeniAcildiMi(o) ? '<span class="yeni-rozet">yeni açıldı</span>' : "";
}

/* ==================== MADALYALAR ==================== */

function madalyaVar(id) {
  const m = jsonOku(MADALYA_ANAHTAR, []);
  return Array.isArray(m) && m.indexOf(id) !== -1;
}

function madalyaVer(id) {
  if (madalyaVar(id)) { return; }
  hesapHatirlat("madalya");
  const m = jsonOku(MADALYA_ANAHTAR, []) || [];
  m.push(id);
  jsonYaz(MADALYA_ANAHTAR, m);

  const bilgi = (veri.madalyalar || []).find(function (x) { return x.id === id; });
  eckaBildir("Madalya: " + (bilgi ? bilgi.ad : id));
  eckaKazan(30, "Madalya");
  madalyaCiz();
}

function madalyaCiz() {
  const alan = document.querySelector("#madalyaAlan");
  if (!alan || !veri.madalyalar) { return; }

  const kazanilan = (jsonOku(MADALYA_ANAHTAR, []) || []).length;

  alan.innerHTML =
    '<p class="oyun-not">' + kazanilan + " / " + veri.madalyalar.length + " madalya</p>" +
    '<div class="madalya-izgara">' +
      veri.madalyalar.map(function (m) {
        const v = madalyaVar(m.id);
        return '<div class="madalya' + (v ? " kazanildi" : "") + '">' +
                 '<div class="madalya-ad">' + kacir(m.ad) + "</div>" +
                 '<div class="madalya-not">' + kacir(m.not) + "</div>" +
               "</div>";
      }).join("") +
    "</div>";
}

/* ==================== KİŞİSEL REKORLAR ==================== */

function rekorYaz(oyun, deger) {
  const r = jsonOku(REKOR_ANAHTAR, {}) || {};
  if (!r[oyun] || deger > r[oyun]) { r[oyun] = deger; jsonYaz(REKOR_ANAHTAR, r); }
  rekorCiz();
}

function rekorCiz() {
  const alan = document.querySelector("#rekorAlan");
  if (!alan) { return; }

  const r = jsonOku(REKOR_ANAHTAR, {}) || {};
  const adlar = { nobet: "Nöbet — en uzun gün", cevirmen: "Gırı Çevirmeni — en yüksek",
                  vardiya: "Vardiya — en çok memnun", yazi: "Yazı Çözme — en yüksek",
                  boyut: "Boyut — en yüksek katman", baloncuk: "Baloncuk — en iyi tuhaflık" };

  const satir = Object.keys(adlar).map(function (k) {
    return '<li class="arti"><span>' + (r[k] !== undefined ? r[k] : "—") + "</span>" +
           "<span>" + adlar[k] + "</span><span></span></li>";
  }).join("");

  alan.innerHTML = '<ul class="gecmis-liste">' + satir + "</ul>";
}

/* ==================== MEYDAN OKUMA ==================== */

const MEYDAN_OYUNLARI = { cevirmen: "Gırı Çevirmeni", yazi: "Yazı Çözme",
                          vardiya: "Gündüz Vardiyası", nobet: "Nöbet" };

let meydan = null;   // { oyun, tohum, skor }

function meydanKodu(oyun, tohum, skor) {
  return [oyun, tohum.toString(36), String(skor)].join(".");
}

function meydanBaglantisi(oyun, tohum, skor) {
  return rotaAdresi("#/meydan/") +
         encodeURIComponent(meydanKodu(oyun, tohum, skor));
}

function meydanUygula() {
  const h = rota();
  if (h.indexOf("#/meydan/") !== 0) { return; }

  const p = decodeURIComponent(h.slice(9)).split(".");
  if (p.length !== 3 || !MEYDAN_OYUNLARI[p[0]]) { return; }

  const tohum = parseInt(p[1], 36);
  const skor = parseInt(p[2], 10);

  if (!isFinite(tohum) || !isFinite(skor) || skor < 0 || !/^[0-9]+$/.test(p[2])) { return; }

  meydan = { oyun: p[0], tohum: tohum, skor: skor };
  meydanCiz();
  bolumeGit("oyunlar");
}

/** Meydan okumada oyun başlarken tohum verilir: aynı dizi, aynı sıra.
    (Önceden tohum hiç ayarlanmıyordu; meydan aslında farklı diziyle oynanıyordu.) */
function meydanTohumla(oyun) {
  if (meydan && meydan.oyun === oyun && !meydan.sonuc) { tohumAyarla(meydan.tohum); }
}

function meydanBitir(oyun, skor) {
  if (!meydan || meydan.oyun !== oyun) { return; }

  /* Nöbet haftalık meydanı (30-yarislar.js): skor sunucuya gider */
  if (meydan.haftalik) {
    meydan = null;
    tohumAyarla(null);
    if (typeof yarisMeydanBitti === "function") { yarisMeydanBitti(skor); }
    meydanCiz();
    return;
  }

  const kazandi = skor > meydan.skor;
  meydan.sonuc = { skor: skor, kazandi: kazandi };

  if (kazandi) { eckaKazan(35, "Meydan okuma kazanıldı"); }
  tohumAyarla(null);
  meydanCiz();
}

function meydanCiz() {
  const alan = document.querySelector("#meydanAlan");
  if (!alan) { return; }

  if (!meydan) {
    const r = jsonOku(REKOR_ANAHTAR, {}) || {};
    const secenekler = Object.keys(MEYDAN_OYUNLARI).filter(function (o) { return r[o]; });

    alan.innerHTML =
      '<p class="oyun-giris">Bir skorunu bağlantıya göm, arkadaşına at. O da aynı ' +
      "diziyle oynar — tesadüf yok, sadece sen ve o.</p>" +
      (secenekler.length
        ? '<div class="oyun-sira">' + secenekler.map(function (o) {
            return '<button class="dugme dugme-sade" data-meydan-uret="' + o + '">' +
                   kacir(MEYDAN_OYUNLARI[o]) + " · " + r[o] + "</button>";
          }).join("") + "</div>" +
          '<div class="bag-kod gizle" id="meydanKod"></div>' +
          '<button class="dugme gizle" id="meydanKopyala" data-meydan="kopyala">Bağlantıyı kopyala</button>'
        : '<p class="oyun-not">Önce bir oyun oyna; skorun olunca meydan okuyabilirsin.</p>');
    return;
  }

  if (meydan.sonuc) {
    alan.innerHTML =
      '<div class="oyun-son">' +
        "<h3>" + (meydan.sonuc.kazandi ? "Kazandın" : "Kaybettin") + "</h3>" +
        "<p>" + meydan.sonuc.skor + " — " + meydan.skor + "</p>" +
        '<button class="dugme" data-meydan="bitir">Kapat</button>' +
      "</div>";
    return;
  }

  alan.innerHTML =
    '<div class="meydan">' +
      '<div class="gorev-etiket">' + (meydan.haftalik ? "haftalık meydan" : "meydan okuma") + "</div>" +
      '<div class="gorev-ad">' + kacir(MEYDAN_OYUNLARI[meydan.oyun]) + "</div>" +
      "<p>Geçmen gereken skor: <b>" + meydan.skor + "</b></p>" +
      '<p class="oyun-not">Aynı dizi, aynı sıra. Oyunu aşağıdan başlat.</p>' +
      '<button class="dugme dugme-sade" data-meydan="bitir">Vazgeç</button>' +
    "</div>";
}

/* ==================== YAZI TİPİ ==================== */

function yaziTipiYukle() {
  const y = kayitOku(YAZI_ANAHTAR) || "varsayilan";
  document.documentElement.setAttribute("data-ayar-yazitipi", y);
}

function yaziTipiCiz() {
  const alan = document.querySelector("#yaziTipiAlan");
  if (!alan || !veri.yaziTipleri) { return; }

  const simdi = document.documentElement.getAttribute("data-ayar-yazitipi") || "varsayilan";

  alan.innerHTML = '<div class="arac-secim">' + veri.yaziTipleri.map(function (y) {
    return '<button class="filtre-btn' + (simdi === y.id ? " secili" : "") +
           '" data-yazitipi="' + kacir(y.id) + '" title="' + kacir(y.not) + '">' +
           kacir(y.ad) + "</button>";
  }).join("") + "</div>";
}

/* ==================== TAM SIFIRLAMA ==================== */

const TUM_ANAHTARLAR = [
  "tentiforapp_cuzdan", "tentiforapp_cozulen", "tentiforapp_nobet",
  "tentiforapp_nobet_skor", "tentiforapp_evrenler", "tentiforapp_rol_gecmis",
  "tentiforapp_tur", "tentiforapp_spoiler", "tentiforapp_gunun", "tentiforapp_tema",
  "tentiforapp_ses", "tentiforapp_okuma", "tentiforapp_erisim", "tentiforapp_yonetici",
  "tentiforapp_katman_kodlari", "tentiforapp_github",
  NOT_ANAHTAR, DEFTER_ANAHTAR, GECMIS_OKUMA_ANAHTAR, YAZI_ANAHTAR,
  REKOR_ANAHTAR, MADALYA_ANAHTAR, GORULEN_ANAHTAR
];

function sifirlamaCiz() {
  const alan = document.querySelector("#sifirlaAlan");
  if (!alan) { return; }

  alan.innerHTML =
    '<p class="oyun-giris">Cüzdan, çözülen katmanlar, temalar, madalyalar, notlar, ' +
    "rekorlar — hepsi silinir. Site ilk kez giriyormuşsun gibi başlar.</p>" +
    '<p class="oyun-not">Silmeden önce cüzdan rozetinden yedek kodunu almak isteyebilirsin.</p>' +
    '<button class="dugme sil" data-sifirla="1">Tüm ilerlememi sıfırla</button>' +
    '<p class="pencere-durum" id="sifirlaDurum"></p>';
}

function tumunuSifirla() {
  const hesapli = typeof hesapKullanici !== "undefined" && hesapKullanici;
  if (!confirm("Tüm ilerlemen silinecek ve site sıfırdan başlayacak." +
               (hesapli ? "\n\nGiriş yaptığın için hesabındaki ilerleme de sıfırlanacak." : "") +
               "\n\nEmin misin?")) { return; }
  if (!confirm("Son uyarı: bu işlem geri alınamaz. Devam edilsin mi?")) { return; }

  TUM_ANAHTARLAR.forEach(function (a) {
    kayitYaz(a, "");
    try { window.localStorage.removeItem(a); } catch (e) { /* yoksay */ }
  });

  try {
    window.localStorage.removeItem("tentiforapp_gorulen");
    Object.keys(window.localStorage).forEach(function (k) {
      if (k.indexOf("tentiforapp") === 0) { window.localStorage.removeItem(k); }
    });
  } catch (e) { /* sandbox */ }

  if (typeof hesapSifirlandi === "function") { hesapSifirlandi(); }

  location.hash = "";
  location.reload();
}

/* ==================== KLAVYE KISAYOLLARI ==================== */

function kisayolCiz() {
  const alan = document.querySelector("#kisayolAlan");
  if (!alan) { return; }

  const liste = [["/", "arama"], ["r", "rastgele keşif"], ["g", "gece modu"],
                 ["1–9, 0", "sayfalar arası geçiş"], ["Esc", "pencereyi kapat"], ["?", "bu liste"]];

  alan.innerHTML = '<div class="kisayol-liste">' + liste.map(function (k) {
    return '<div class="kisayol"><kbd>' + kacir(k[0]) + "</kbd><span>" + kacir(k[1]) + "</span></div>";
  }).join("") + "</div>";
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const df = e.target.closest("[data-defter]");
  if (df) { deftereEkle(df.dataset.defter); return; }

  const og = e.target.closest("[data-okuma-git]");
  if (og) { location.hash = "#/" + og.dataset.okumaGit; return; }

  const yt = e.target.closest("button[data-yazitipi]");
  if (yt) {
    document.documentElement.setAttribute("data-ayar-yazitipi", yt.dataset.yazitipi);
    kayitYaz(YAZI_ANAHTAR, yt.dataset.yazitipi);
    yaziTipiCiz();
    return;
  }

  if (e.target.closest("[data-sifirla]")) { tumunuSifirla(); return; }

  const mu = e.target.closest("[data-meydan-uret]");
  if (mu) {
    const oyun = mu.dataset.meydanUret;
    const r = jsonOku(REKOR_ANAHTAR, {}) || {};
    const tohum = metinTohumu(oyun + Date.now());
    const bag = meydanBaglantisi(oyun, tohum, r[oyun] || 0);

    const kutu = document.querySelector("#meydanKod");
    const kop = document.querySelector("#meydanKopyala");
    if (kutu) { kutu.textContent = bag; kutu.classList.remove("gizle"); }
    if (kop) { kop.classList.remove("gizle"); kop.dataset.bag = bag; }
    return;
  }

  const mk = e.target.closest("[data-meydan]");
  if (mk) {
    if (mk.dataset.meydan === "kopyala") {
      panoyaKopyala(mk.dataset.bag || "").then(function () { eckaBildir("Bağlantı kopyalandı"); });
      return;
    }
    meydan = null;
    tohumAyarla(null);
    location.hash = "";
    meydanCiz();
  }
});

document.addEventListener("input", function (e) {
  const n = e.target.closest("[data-not-kimlik]");
  if (n) { notYaz(n.dataset.notKimlik, n.value); }
});

document.addEventListener("keydown", function (e) {
  const a = document.activeElement;
  const yaziyor = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT");
  if (yaziyor || e.ctrlKey || e.metaKey || e.altKey) { return; }

  if (e.key === "/") {
    e.preventDefault();
    const g = document.querySelector("#aramaGiris");
    const k = document.querySelector("#kesif");
    /* arama kutusu Arşiv sayfasında; başka sayfadaysan önce oraya geç */
    if (k && k.hidden && typeof sayfayaGit === "function") {
      sayfayaGit("arsiv");
      setTimeout(function () { const g2 = document.querySelector("#aramaGiris"); if (g2) { g2.focus(); } }, 120);
      return;
    }
    if (g) { g.focus(); }
    return;
  }

  if (e.key === "r") { if (typeof rastgeleKesif === "function") { rastgeleKesif(); } return; }
  if (e.key === "g") { if (typeof temaDegistir === "function") { temaDegistir(); } return; }

  if (e.key === "?") {
    const k = document.querySelector("#kisayol");
    if (k && k.scrollIntoView) { k.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }
});

window.addEventListener("hashchange", meydanUygula);
