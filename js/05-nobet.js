/* NÖBET — kütüphane hayatta kalma oyunu
   Necale olarak bir Tömye ayı (28 gün) boyunca kütüphaneyi elde tut.
   Gündüz kitap sat, gece Tarı'nın canavarlarına karşı nöbet tut.

   Para birimi "eçka" olarak geçiyor (akçe'nin ters okunuşu — isim sistemine uygun).
   Beğenmezsen aşağıdaki birim() satırını değiştir, her yerde güncellenir. */

const OYUN_KAYIT = "tentiforapp_nobet";
const SON_GUN = 28;
const KITAP_FIYAT = 14;

const CANAVAR_ADLARI = [
  "Fısıltı", "Gölge Müşteri", "Raf Arası", "Uykusuz", "Ezber",
  "Yankı", "Kapanmayan Kapı", "Sayfa Sesi", "Boş Sandalye", "Geç Kalan"
];

let O = null;

/* ---------- durum ---------- */
const SKOR_ANAHTAR = "tentiforapp_nobet_skor";

function enIyiSkor() {
  const s = parseInt(kayitOku(SKOR_ANAHTAR), 10);
  return isNaN(s) ? 0 : s;
}

function skorKaydet(gun) {
  if (gun > enIyiSkor()) { kayitYaz(SKOR_ANAHTAR, String(gun)); }
}

function gorevliBul(id) {
  const liste = (veri.gorevliler || []);
  return liste.find(function (g) { return g.id === id; }) || liste[0] ||
         { id: "necale", ad: "Necale", can: 50, cesaret: 9, itibar: 3, stok: 6, canavarGuc: 1 };
}

let secilenGorevli = "necale";

function oyunVarsayilan(sonsuz) {
  const g = gorevliBul(secilenGorevli);
  return {
    gorevli: g.id,
    sonsuz: !!sonsuz,
    kacti: false,
    kacKalan: 5,
    olay: null,
    gun: 1,
    faz: "gunduz",
    can: g.can,
    maxCan: g.can,
    stok: g.stok,
    maxStok: 12,
    cesaret: g.cesaret,
    fener: 0,
    itibar: g.itibar,
    fenerKullanildi: false,
    canavarlar: [],
    kayit: [],
    sonuc: null
  };
}

function oyunYukle() {
  const ham = kayitOku(OYUN_KAYIT);
  if (!ham) { return null; }
  try {
    const d = JSON.parse(ham);
    if (!d || typeof d !== "object") { return null; }

    /* Bozuk ya da elle kurcalanmış kayıt oyunu çizilemez hâle getiriyordu. */
    const sayisal = ["gun", "can", "maxCan", "stok", "maxStok", "cesaret", "fener", "itibar"];
    for (let i = 0; i < sayisal.length; i++) {
      if (typeof d[sayisal[i]] !== "number" || !isFinite(d[sayisal[i]])) { return null; }
    }

    if (!Array.isArray(d.canavarlar) || !Array.isArray(d.kayit)) { return null; }

    return d;
  } catch (e) {
    return null;
  }
}

function oyunKaydet() {
  kayitYaz(OYUN_KAYIT, JSON.stringify(O));
}

function oyunSifirla(sonsuz) {
  if (typeof meydanTohumla === "function") { meydanTohumla("nobet"); }
  O = oyunVarsayilan(sonsuz);
  not("Necale nöbeti devraldı. Bir ay dayanman gerek.");
  oyunKaydet();
  oyunCiz();
}

function not(metin) {
  O.kayit.unshift(metin);
  if (O.kayit.length > 6) { O.kayit.pop(); }
}

function rast(n) {
  return Math.floor(rast01() * n);
}

/* ---------- olay kartları ----------
   Bazı sabahlar seçim gerektiren bir durum çıkar. Gün ancak seçimden sonra başlar. */

function olayKur() {
  const liste = (veri.olaylar || []);
  if (!liste.length || O.gun < 3 || rast01() > 0.35) { O.olay = null; return; }

  O.olay = liste[Math.floor(rast01() * liste.length)].id;
}

function olayBul(id) {
  return (veri.olaylar || []).find(function (x) { return x.id === id; });
}

function olaySec(indeks) {
  if (!O || !O.olay) { return; }

  const olay = olayBul(O.olay);
  if (!olay) { O.olay = null; oyunCiz(); return; }

  const s = olay.secenekler[indeks];
  if (!s) { return; }

  if (s.ecka) {
    if (s.ecka < 0) {
      if (!eckaHarca(-s.ecka, "Nöbet olayı")) {
        not("Yeterli " + birim() + " yok — diğer seçeneği kullan.");
        eckaBildir("Bu seçenek için " + (-s.ecka) + " " + birim() + " gerekiyor");
        oyunCiz();
        return;
      }
    } else {
      eckaKazan(s.ecka, "Nöbet olayı");
    }
  }

  if (s.stok) { O.stok = Math.max(0, Math.min(O.maxStok, O.stok + s.stok)); }
  if (s.can) { O.can = Math.max(1, Math.min(O.maxCan, O.can + s.can)); }
  if (s.itibar) { O.itibar = Math.max(1, O.itibar + s.itibar); }
  if (s.fener) { O.fener = Math.min(5, O.fener + s.fener); }
  if (s.cesaret) { O.cesaret = Math.min(50, O.cesaret + s.cesaret); }

  not(s.metin.replace(/\s*\([^)]*\)\s*$/, ""));
  O.olay = null;
  oyunKaydet();
  oyunCiz();
}

function olayCiz() {
  const olay = olayBul(O.olay);
  if (!olay) { return ""; }

  return '<div class="olay">' +
           '<div class="olay-etiket">sabah</div>' +
           '<div class="olay-metin">' + kacir(olay.metin) + "</div>" +
           '<div class="oyun-sira">' +
             olay.secenekler.map(function (s, i) {
               const yetmez = s.ecka && s.ecka < 0 && !eckaVar(-s.ecka);
               return '<button class="dugme' + (i ? " dugme-sade" : "") +
                      (yetmez ? " pasif" : "") + '" data-olay="' + i + '">' +
                      kacir(s.metin) + (yetmez ? " · yetersiz " + birim() : "") + "</button>";
             }).join("") +
           "</div>" +
         "</div>";
}

/* ---------- gündüz ---------- */
function dukkaniAc() {
  const musteri = O.itibar + rast(3);
  const satilan = Math.min(O.stok, musteri);
  const kazanc = satilan * KITAP_FIYAT;

  O.stok -= satilan;
  eckaKazan(kazanc, "Kitap satışı");

  if (satilan === 0) {
    not("Gün boyu kimseye satamadın. Raflar boş.");
  } else {
    not(satilan + " kitap sattın · +" + kazanc + " " + birim());
  }

  if (satilan > 0 && satilan === musteri && rast(4) === 0) {
    O.itibar++;
    not("Danpar uğradı ve memnun ayrıldı. İtibar +1");
  }

  O.faz = "gece";
  geceKur();
  if (typeof ortamCal === "function" && veri.ses && veri.ses.ortam) {
    ortamCal(veri.ses.ortam);
  }
  oyunKaydet();
  oyunCiz();
}

function stokAl(adet) {
  const maliyet = adet * 5;

  if (O.stok + adet > O.maxStok) { not("Raflar bu kadarını almaz."); oyunCiz(); return; }
  if (!eckaHarca(maliyet)) { not("Yeterli " + birim() + " yok."); oyunCiz(); return; }

  O.stok += adet;
  not(adet + " kitap aldın · −" + maliyet + " " + birim());
  oyunKaydet();
  oyunCiz();
}

const YUKSELTMELER = [
  {
    id: "fener", ad: "Fener", aciklama: "gece alınan hasarı azaltır",
    fiyat: function () { return 26 + O.fener * 18; },
    sinir: function () { return O.fener < 5; },
    uygula: function () { O.fener++; }
  },
  {
    id: "sopa", ad: "Meşe Sopa", aciklama: "vuruş gücü +3",
    fiyat: function () { return 20 + (O.cesaret - 9) * 6; },
    sinir: function () { return O.cesaret < 50; },
    uygula: function () { O.cesaret += 4; }
  },
  {
    id: "raf", ad: "Yeni Raf", aciklama: "stok sınırı +6",
    fiyat: function () { return 30 + (O.maxStok - 12) * 3; },
    sinir: function () { return O.maxStok < 36; },
    uygula: function () { O.maxStok += 6; }
  },
  {
    id: "levha", ad: "Cephe Levhası", aciklama: "günlük müşteri +1",
    fiyat: function () { return 35 + (O.itibar - 3) * 12; },
    sinir: function () { return O.itibar < 9; },
    uygula: function () { O.itibar++; }
  },
  {
    id: "yatak", ad: "Arka Oda Yatağı", aciklama: "azami dayanıklılık +10",
    fiyat: function () { return 45 + (O.maxCan - 50) * 2; },
    sinir: function () { return O.maxCan < 110; },
    uygula: function () { O.maxCan += 10; O.can += 10; }
  },
  {
    id: "cay", ad: "Demli Çay", aciklama: "15 dayanıklılık yenile",
    fiyat: function () { return 18; },
    sinir: function () { return O.can < O.maxCan; },
    uygula: function () { O.can = Math.min(O.maxCan, O.can + 15); }
  }
];

function yukselt(id) {
  const y = YUKSELTMELER.find(function (u) { return u.id === id; });
  if (!y || !y.sinir()) { return; }

  const fiyat = y.fiyat();
  if (!eckaHarca(fiyat)) { not("Yeterli " + birim() + " yok."); oyunCiz(); return; }

  y.uygula();
  not(y.ad + " alındı · −" + fiyat + " " + birim());
  oyunKaydet();
  oyunCiz();
}

/* ---------- gece ---------- */
function geceKur() {
  O.fenerKullanildi = false;
  O.canavarlar = [];

  const sonGece = !O.sonsuz && O.gun >= SON_GUN;

  if (sonGece) {
    O.canavarlar.push({
      ad: "Beş Uzuvlu", can: 120, maxCan: 120, guc: 9, patron: true
    });
    not("Raflar arasından beş uzuvlu bir şey çıktı.");
    return;
  }

  const g = gorevliBul(O.gorevli);
  const adet = Math.min(5, 1 + Math.floor(O.gun / 6) + (g.ekCanavar || 0));
  const can = 10 + O.gun * 2;
  const guc = Math.round((2 + Math.floor(O.gun / 6)) * (g.canavarGuc || 1));

  for (let i = 0; i < adet; i++) {
    O.canavarlar.push({
      ad: CANAVAR_ADLARI[rast(CANAVAR_ADLARI.length)],
      can: can, maxCan: can, guc: guc, patron: false
    });
  }
}

function canliCanavarlar() {
  return O.canavarlar.filter(function (c) { return c.can > 0; });
}

function canavarSaldirisi(siperde) {
  let hasar = canliCanavarlar().reduce(function (t, c) { return t + c.guc; }, 0);

  hasar -= O.fener * 4;
  hasar = Math.round(hasar * (0.8 + rast01() * 0.4));
  if (siperde) { hasar = Math.floor(hasar / 2); }
  if (hasar < 1) { hasar = 1; }

  O.can -= hasar;
  not("Karanlıktan " + hasar + " hasar aldın.");

  if (O.can <= 0) {
    O.can = 0;
    O.faz = "bitti";
    O.sonuc = "kayip";
    skorKaydet(O.gun);
    if (typeof rekorYaz === "function") { rekorYaz("nobet", O.gun); }
    if (typeof meydanBitir === "function") { meydanBitir("nobet", O.gun); }
  }
}

function saldir() {
  const canli = canliCanavarlar();
  if (!canli.length) { return; }

  const hedef = canli[0];
  const vurus = Math.round(O.cesaret * (0.8 + rast01() * 0.4));
  hedef.can -= vurus;

  if (hedef.can <= 0) {
    hedef.can = 0;
    not(hedef.ad + " dağıldı.");
  } else {
    not(hedef.ad + " üstüne " + vurus + " vurdun.");
  }

  if (!canliCanavarlar().length) { geceyiBitir(); return; }

  canavarSaldirisi(false);
  oyunKaydet();
  oyunCiz();
}

function siperAl() {
  not("Tezgâhın arkasına çekildin.");
  canavarSaldirisi(true);
  oyunKaydet();
  oyunCiz();
}

function fenerYak() {
  if (O.fenerKullanildi || O.fener < 1) { return; }

  O.fenerKullanildi = true;
  const canli = canliCanavarlar();

  let zayif = canli[0];
  canli.forEach(function (c) { if (!c.patron && c.can < zayif.can) { zayif = c; } });

  if (zayif.patron) {
    zayif.can -= O.fener * 12;
    if (zayif.can < 0) { zayif.can = 0; }
    not("Fener beş uzuvluyu geri itti.");
  } else {
    zayif.can = 0;
    not(zayif.ad + " ışıkta kayboldu.");
  }

  if (!canliCanavarlar().length) { geceyiBitir(); return; }

  canavarSaldirisi(false);
  oyunKaydet();
  oyunCiz();
}

function kac() {
  if (O.kacKalan <= 0) {
    not("Arka kapı artık işe yaramıyor. Rafların arasında kalacaksın.");
    oyunCiz();
    return;
  }

  O.kacKalan--;
  const kayip = Math.min(O.stok, 3);
  O.stok -= kayip;
  if (O.itibar > 1) { O.itibar--; }
  O.kacti = true;
  not("Arka kapıdan kaçtın. " + kayip + " kitap parçalandı, itibar −1. "
      + "Kalan kaçış: " + O.kacKalan + ".");
  geceyiBitir();
}

function geceyiBitir() {
  if (!O.sonsuz && O.gun >= SON_GUN) {
    O.faz = "bitti";
    O.sonuc = "kazanc";
    oyunBitti("nobet");
    if (typeof rekorYaz === "function") { rekorYaz("nobet", O.gun); }
    if (!O.kacti && typeof madalyaVer === "function") { madalyaVer("kacmadan"); }
    if (typeof meydanBitir === "function") { meydanBitir("nobet", O.gun); }
    oyunKaydet();
    oyunCiz();
    return;
  }

  if (typeof ortamDurdur === "function") { ortamDurdur(); }

  O.gun++;
  O.faz = "gunduz";
  gorevIlerle("nobet3");
  olayKur();
  O.can = Math.min(O.maxCan, O.can + 13);
  not("— " + O.gun + ". gün —");

  if (rast(6) === 0) {
    O.can = Math.min(O.maxCan, O.can + 8);
    not("Zafkı Eşci'nin hayali rafların arasından geçti. İçin ısındı.");
  }

  oyunKaydet();
  oyunCiz();
}

/* ---------- çizim ---------- */
function oyunCiz() {
  if (!O) {
    O = oyunYukle() || null;
  }

  if (!O) {
    const s = document.querySelector("#oyunAlan");
    if (s) {
      s.innerHTML =
        '<p class="oyun-giris">Kimi oynayacaksın? Her görevlinin farklı başlangıcı ve ' +
        "farklı geceleri var.</p>" +
        '<div class="gorevli-izgara">' +
          (veri.gorevliler || []).map(function (g) {
            return '<button class="gorevli-kart" data-gorevli="' + kacir(g.id) + '">' +
                     '<span class="gorevli-ad">' + kacir(g.ad) + "</span>" +
                     '<span class="gorevli-not">' + kacir(g.not) + "</span>" +
                     '<span class="gorevli-olcu">dayanıklılık ' + g.can +
                       " · vuruş " + g.cesaret + " · itibar " + g.itibar + "</span>" +
                   "</button>";
          }).join("") +
        "</div>";
    }
    return;
  }

  const s = document.querySelector("#oyunAlan");

  if (O.faz === "bitti") { s.innerHTML = cizSon(); return; }

  s.innerHTML =
    '<div class="oyun-etiket">' +
      O.gun + (O.sonsuz ? ". gün · sonsuz" : ". gün / " + SON_GUN) +
      " · " + (O.faz === "gece" ? "gece" : "gündüz") +
    "</div>" +
    cizPano() +
    (O.faz === "gunduz" ? cizGunduz() : cizGece()) +
    cizKayit();
}

function cizPano() {
  const oran = Math.max(0, Math.round((O.can / O.maxCan) * 100));

  return '<div class="pano">' +
    '<div class="pano-cubuk"><span style="width:' + oran + '%"></span></div>' +
    '<div class="pano-satir">' +
      '<span>dayanıklılık <b>' + O.can + "/" + O.maxCan + "</b></span>" +
      "<span>" + birim() + " <b>" + cuzdan.ecka + "</b></span>" +
    "</div>" +
    '<div class="pano-satir">' +
      "<span>stok <b>" + O.stok + "/" + O.maxStok + "</b></span>" +
      "<span>vuruş <b>" + O.cesaret + "</b></span>" +
      "<span>fener <b>" + O.fener + "</b></span>" +
      "<span>kaçış <b>" + (O.kacKalan === undefined ? 5 : O.kacKalan) + "</b></span>" +
      "<span>itibar <b>" + O.itibar + "</b></span>" +
    "</div>" +
  "</div>";
}

function cizGunduz() {
  if (O.olay) { return olayCiz(); }

  const dukkanlar = YUKSELTMELER.map(function (y) {
    if (!y.sinir()) {
      return '<div class="dukkan pasif"><span class="dukkan-ad">' + y.ad +
             '</span><span class="dukkan-alt">azami seviye</span></div>';
    }

    const f = y.fiyat();
    const alinabilir = eckaVar(f);

    return '<button class="dukkan' + (alinabilir ? "" : " pasif") + '" data-yukselt="' + y.id + '">' +
             '<span class="dukkan-ad">' + y.ad + "</span>" +
             '<span class="dukkan-alt">' + y.aciklama + "</span>" +
             '<span class="dukkan-fiyat">' + f + "</span>" +
           "</button>";
  }).join("");

  return '<div class="oyun-blok">' +
      '<div class="oyun-etiket">stok</div>' +
      '<div class="oyun-sira">' +
        '<button class="dugme dugme-sade" data-stok="1">1 kitap · 5</button>' +
        '<button class="dugme dugme-sade" data-stok="5">5 kitap · 25</button>' +
      "</div>" +
    "</div>" +
    '<div class="oyun-blok">' +
      '<div class="oyun-etiket">yükseltme</div>' +
      '<div class="dukkan-izgara">' + dukkanlar + "</div>" +
    "</div>" +
    '<button class="dugme" data-oyun="ac">dükkânı aç ve geceyi bekle</button>';
}

function cizGece() {
  const canli = canliCanavarlar();

  const liste = O.canavarlar.map(function (c) {
    const olu = c.can <= 0;
    const oran = Math.max(0, Math.round((c.can / c.maxCan) * 100));

    return '<div class="canavar' + (olu ? " olu" : "") + (c.patron ? " patron" : "") + '">' +
             '<div class="canavar-ust"><span>' + c.ad + "</span><span>" + c.can + "/" + c.maxCan + "</span></div>" +
             '<div class="canavar-cubuk"><span style="width:' + oran + '%"></span></div>' +
           "</div>";
  }).join("");

  const fenerAktif = O.fener > 0 && !O.fenerKullanildi;

  return '<div class="oyun-blok">' +
      '<div class="oyun-etiket">rafların arasında ' + canli.length + " şey var</div>" +
      '<p class="oyun-not">' + kacir(gorevliBul(O.gorevli).gece || "") + "</p>" +
      liste +
    "</div>" +
    '<div class="oyun-sira">' +
      '<button class="dugme" data-oyun="saldir">vur</button>' +
      '<button class="dugme dugme-sade" data-oyun="siper">siper al</button>' +
    "</div>" +
    '<div class="oyun-sira" style="margin-top:9px">' +
      '<button class="dugme dugme-sade' + (fenerAktif ? "" : " pasif") + '" data-oyun="fener">' +
        (O.fener < 1 ? "fener yok" : (O.fenerKullanildi ? "fener tükendi" : "feneri yak")) +
      "</button>" +
      '<button class="dugme dugme-sade' + (O.kacKalan > 0 ? "" : " pasif") +
        '" data-oyun="kac">arka kapı' +
        (O.kacKalan > 0 ? " (" + O.kacKalan + ")" : " — bitti") + "</button>" +
    "</div>";
}

function cizKayit() {
  if (!O.kayit.length) { return ""; }

  return '<div class="oyun-kayit">' +
    O.kayit.map(function (k, i) {
      return '<div class="oyun-kayit-satir"' + (i === 0 ? ' data-yeni="1"' : "") + ">" + k + "</div>";
    }).join("") +
  "</div>";
}

function cizSon() {
  const kazandi = O.sonuc === "kazanc";

  return '<div class="oyun-son">' +
      "<h3>" + (kazandi ? "Ay bitti" : "Nöbet bitti") + "</h3>" +
      "<p>" + (kazandi
        ? "Yirmi sekiz gece dayandın. Kütüphane hâlâ ayakta. Necale kanonda kazanamadı — sen kazandın."
        : O.gun + ". gecede düştün. Tarı'nın bıraktığı kalabalık senden de büyüktü.") +
      "</p>" +
      '<button class="dugme" data-oyun="yeni">yeniden başla</button>' +
    "</div>";
}

/* ---------- olaylar ---------- */
document.addEventListener("click", function (e) {
  const gv = e.target.closest("[data-gorevli]");
  if (gv) { secilenGorevli = gv.dataset.gorevli; oyunSifirla(false); return; }

  const olayBtn = e.target.closest("[data-olay]");
  if (olayBtn && O && O.faz === "gunduz") {
    olaySec(parseInt(olayBtn.dataset.olay, 10));
    return;
  }

  const stokBtn = e.target.closest("[data-stok]");
  if (stokBtn && O && O.faz === "gunduz") {
    stokAl(parseInt(stokBtn.dataset.stok, 10));
    return;
  }

  const yBtn = e.target.closest("[data-yukselt]");
  if (yBtn && O && O.faz === "gunduz") {
    yukselt(yBtn.dataset.yukselt);
    return;
  }

  const oBtn = e.target.closest("[data-oyun]");
  if (!oBtn || !O) { return; }

  const eylem = oBtn.dataset.oyun;

  if (eylem === "ac" && O.faz === "gunduz") { dukkaniAc(); }
  else if (eylem === "saldir" && O.faz === "gece") { saldir(); }
  else if (eylem === "siper" && O.faz === "gece") { siperAl(); }
  else if (eylem === "fener" && O.faz === "gece") { fenerYak(); }
  else if (eylem === "kac" && O.faz === "gece") { kac(); }
  else if (eylem === "yeni") { O = null; oyunCiz(); }
  else if (eylem === "sonsuz") { oyunSifirla(true); }
});
