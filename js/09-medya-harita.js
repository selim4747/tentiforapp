/* Medya bölümleri — roman, harita, alıntılar, yazar notları, basın kiti,
   canlı Tömye saati, Kayıp teması ve değişiklik günlüğü. */

/** Bir katman çözülmüş mü? Katman kimliğiyle sorar. */
function katmanAcik(katmanId) {
  if (!katmanId) { return true; }
  const k = (veri.katmanlar || []).concat(veri.kisiselKatmanlar || [])
    .find(function (x) { return x.id === katmanId; });
  return !!(k && cozulenler[k.dogrulama]);
}

/* ==================== KAYIP ==================== */

function kayipCiz() {
  const alan = document.querySelector("#kayipAlan");
  if (!alan || !veri.kayip) { return; }

  const k = veri.kayip;
  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();

  alan.innerHTML =
    '<p class="kayip-giris">' + kacir(k.giris) + "</p>" +
    '<div class="kayip-liste">' +
      (k.maddeler || []).map(function (s) {
        const acik = yonetici || katmanAcik(s.gizli);

        return '<div class="kayip-satir' + (acik ? "" : " kapali") + '">' +
                 '<span class="kayip-kim">' + kacir(s.kim) + "</span>" +
                 '<span class="kayip-ne">' +
                   (acik ? kacir(s.ne) : "— buz altında —") +
                   (acik && s.sonra ? '<em class="kayip-sonra">' + kacir(s.sonra) + "</em>" : "") +
                 "</span>" +
               "</div>";
      }).join("") +
    "</div>" +
    '<p class="kayip-kapanis">' + kacir(k.kapanis) + "</p>";
}

/* ==================== ALINTILAR ==================== */

function alintiCiz() {
  const alan = document.querySelector("#alintiAlan");
  if (!alan || !veri.alintilar) { return; }

  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();

  const gorunur = veri.alintilar.filter(function (a) {
    return yonetici || katmanAcik(a.gizli);
  });

  const gizliSayi = veri.alintilar.length - gorunur.length;

  alan.innerHTML =
    '<div class="alinti-izgara">' + gorunur.map(function (a) {
      return '<figure class="alinti">' +
               "<blockquote>" + kacir(a.metin) + "</blockquote>" +
               "<figcaption>" + kacir(a.kim) + "</figcaption>" +
               (typeof defterde === "function"
                 ? '<button class="defter-btn' + (defterde(a.metin) ? " dolu" : "") +
                   '" data-defter="' + kacir(a.metin) + '">' +
                   (defterde(a.metin) ? "defterinde" : "deftere ekle") + "</button>"
                 : "") +
             "</figure>";
    }).join("") + "</div>" +
    (gizliSayi ? '<p class="oyun-not">' + gizliSayi +
      " alıntı daha buz altında. Kod çözdükçe belirir.</p>" : "");
}

/* ==================== YAZAR NOTLARI ==================== */

function notlarCiz() {
  const alan = document.querySelector("#notlarAlan");
  if (!alan || !veri.yazarNotlari) { return; }

  alan.innerHTML = '<div class="madde-liste">' + veri.yazarNotlari.map(function (n, i) {
    return '<div class="madde" data-not="' + i + '">' +
             '<button class="madde-bas">' +
               '<span class="madde-bolum">not</span>' +
               '<span class="madde-baslik">' + kacir(n.baslik) + "</span>" +
               '<span class="madde-ok">›</span>' +
             "</button>" +
             '<div class="madde-govde">' + paragraf(n.metin) + "</div>" +
           "</div>";
  }).join("") + "</div>";
}

/* ==================== ROMAN ==================== */

function romanAcikMi(b) {
  return b.fiyat === 0 || kilitAcik("roman_" + b.no);
}

function romanAcikSayisi() {
  if (!veri.roman) { return 0; }
  return veri.roman.bolumler.filter(romanAcikMi).length;
}

function romanCiz() {
  const alan = document.querySelector("#romanAlan");
  if (!alan || !veri.roman) { return; }

  const r = veri.roman;

  alan.innerHTML =
    '<p class="oyun-giris">' + kacir(r.giris || r.aciklama || "") + "</p>" +
    '<div class="liste">' + r.bolumler.map(function (b) {
      const acik = romanAcikMi(b);
      const yazildi = b.metin && b.metin.trim().length > 0;

      let sag;
      if (!acik) {
        sag = '<span class="roman-fiyat">' + b.fiyat + " " + birim() + "</span>";
      } else if (!yazildi) {
        sag = '<span class="roman-bos">yazılmadı</span>';
      } else {
        sag = '<span class="satir-ok">›</span>';
      }

      return '<button class="satir" data-roman="' + b.no + '">' +
               '<span class="satir-no">' + String(b.no).padStart(2, "0") + "</span>" +
               '<span class="satir-govde">' +
                 '<span class="satir-baslik">' + kacir(b.baslik || b.ad || "") + "</span>" +
                 '<span class="satir-alt">' + kacir(b.ozet) + "</span>" +
               "</span>" + sag +
             "</button>";
    }).join("") + "</div>";
}

function romanAc(no) {
  const b = veri.roman.bolumler.find(function (x) { return x.no === no; });
  if (!b) { return; }

  if (!romanAcikMi(b)) {
    if (!eckaVar(b.fiyat)) {
      eckaBildir("Yeterli " + birim() + " yok · " + (b.fiyat - cuzdan.ecka) + " eksik");
      return;
    }

    if (kilitAc("roman_" + b.no, b.fiyat)) {
      eckaBildir(b.no + ". bölüm açıldı");
      romanCiz();
      basarimCiz();
    }
    return;
  }

  if (!b.metin || !b.metin.trim()) {
    eckaBildir("Bu bölüm henüz yazılmadı");
    return;
  }

  document.querySelector("#perde").innerHTML =
    '<div class="pencere pencere-genis" role="dialog" aria-modal="true">' +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      "<h3>" + kacir(b.ad) + "</h3>" +
      '<p class="pencere-alt">' + veri.roman.baslik + " · " + b.no + ". bölüm</p>" +
      '<div class="okuma">' + paragraf(b.metin) + "</div>" +
    "</div>";

  document.querySelector("#perde").hidden = false;
}

/* ==================== HARİTA ==================== */

let haritaSecili = null;
let haritaSeciliId = null;   /* null = ilk (varsayılan) harita */

/** Şu an gösterilen haritayı döner. Yönetici panelinden birden fazla harita
    eklenebildiği için "harita" artık tekil değil, bir dizi. */
function aktifHarita() {
  /* Mobilde "resize" sayfa yüklenirken (adres çubuğu kayarken) tetiklenebilir;
     o an veri henüz tanımlanmamış ya da yüklenmemiş olabilir. */
  if (typeof veri === "undefined" || !veri) { return null; }
  const tumu = veri.haritalar || [];
  if (!tumu.length) { return null; }
  /* kişiye özel kodda yalnızca izin verilen evrenler; hiçbiri yoksa (kodsuz) hepsi */
  const izinli = (typeof kanonEvrenErisimi === "function") ? tumu.filter(function (h) { return kanonEvrenErisimi(h.id); }) : tumu;
  const liste = izinli.length ? izinli : tumu;
  if (haritaSeciliId) {
    const bulunan = liste.find(function (h) { return h.id === haritaSeciliId; });
    if (bulunan) { return bulunan; }
  }
  return liste[0];
}

/** Arama, çapraz bağlantı ve denetim araçları hangi haritada olduğuna
    bakmaksızın TÜM yerleri tarar. */
function tumHaritaYerleri() {
  const liste = veri.haritalar || [];
  let tumu = [];
  liste.forEach(function (h) { tumu = tumu.concat(h.yerler || []); });
  return tumu;
}

/* Tür → görsel sınıf eşleşmesi. Bilinmeyen bir tür (yönetici panelinden eklenirse)
   sessizce "diger" sınıfına düşer, harita hiçbir zaman kırılmaz. */
const HARITA_TUR_SINIF = {
  "Şehir": "sehir", "Küçük Yerleşim": "kucuk", "Ada": "ada",
  "Bölge": "bolge", "Uzak": "uzak", "Su": "su",
};
function haritaTurSinifi(tur) { return HARITA_TUR_SINIF[tur] || "diger"; }

/** Hangi türlerin haritada gizlendiğini tutar — { tur: true }. Oturum boyunca bellekte. */
let haritaGizliTurler = {};

/* ---- Evren haritası ----
   Her harita bir "evren"dir (gezegen, ayrı bir evren ya da bölge). Dünya 100 x 100
   birimliktir. Gezegen türünde yatayda (x) etrafında döner: doğuya gide gide
   batıdan çıkarsın; dikeyde (y) kutuplarda durur. Diğer türlerde düz bir harita.
   Sahne piksel uzayında çizilir: zemin (su, ızgara, kıtalar, gece gölgesi)
   yakınlaştırmayla büyür, ama yer adları ve işaretler sabit boyutta kalır.
   Önizleme ve tam ekran aynı çizimi kullanır.

   Veri (hepsi isteğe bağlı; eski veriyle uyumlu):
     harita.evren  = { tur, donen, takvim, gunSaat, yilGun, egim, saatBoylami,
                       kurallar, icerik, okuyucu, sis }
     harita.gizli  = katman kimliği  (o katman açılana dek evren görünmez)
     yer.baslangic / yer.bitis = Tömye yılı (zaman kaydırıcısı için)
     yer.gizli     = katman kimliği,  yer.sis = true (keşfedilene dek görünmez)
     yer.gecit     = { harita, yer }  (başka bir evrene açılan kapı)
     yer.sekil     = [[x,y], ...]  (kıtanın kıyı çizgisi; yoksa elips)
     karakter.yol  = [{ harita, yer, yil?, not? }, ...]  (karakterin izlediği yol) */

const HARITA_ONIZLEME_GENIS = 50;   /* önizlemede yatayda görünen birim */
const HARITA_ISARET_R = { sehir: 7, kucuk: 5, ada: 6, bolge: 8, uzak: 7, su: 6, diger: 6 };
const HARITA_CATLAK = ["M0 30L34 44L62 26L100 30", "M12 100L28 62L46 74L38 100",
                       "M70 0L64 30L84 52L78 100", "M0 70L30 78L58 92"];
const HARITA_KESIF_ANAHTAR = "tentiforapp_kesif";
const HARITA_ELIPS_RX = 22, HARITA_ELIPS_RY = 14;

const HARITA_IKON_BUYUT =
  '<svg class="hm-ikon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">' +
  '<path d="M9.5 2H14v4.5M6.5 14H2V9.5M14 2L9.2 6.8M2 14l4.8-4.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const HARITA_IKON_KATMAN =
  '<svg class="hm-ikon" viewBox="0 0 16 16" width="17" height="17" aria-hidden="true" focusable="false">' +
  '<path d="M8 2L14.5 5.5 8 9 1.5 5.5zM2 8.2L8 11.5l6-3.3M2 10.7L8 14l6-3.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const HARITA_IKON_KALEM =
  '<svg class="hm-ikon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' +
  '<path d="M2 14l.8-3.2L11.3 2.3a1.2 1.2 0 011.7 0l.7.7a1.2 1.2 0 010 1.7L5.2 13.2 2 14z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

const HT = {
  kutu: null, acik: false, w: 0, h: 0,
  cx: 50, cy: 50, k: 8, kMin: 8, kMax: 80, donen: true,
  anim: 0, atalet: 0, kare: 0, gecmis: false, ipucuZamani: 0, odakOnce: null,
  gece: true, saat: null, oynat: 0, zamanlayici: 0,   /* saat: null = canlı, sayı = el ile */
  yil: null,                                          /* null = zaman filtresi kapalı */
  yol: null,                                          /* gösterilen karakterin kimliği */
  panel: false,
  duzen: false, arac: "tasi", kita: null, geri: [], kirli: 0, surukle: null, toastZamani: 0, silOnay: null
};

function haritaSar(x) { return ((x % 100) + 100) % 100; }
function haritaKis(v, alt, ust) { return Math.max(alt, Math.min(ust, v)); }
function haritaSayi(v) { return typeof v === "number" && isFinite(v); }
function haritaAzHareket() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function haritaYonetici() { return (typeof yoneticiAcik === "function") && yoneticiAcik(); }

/* ---------- evren üst bilgisi ---------- */

function evrenMeta(h) {
  const e = (h && h.evren) || {};
  const t = veri.takvim || {};
  const tomye = e.takvim === "tomye";
  const tur = e.tur || "gezegen";
  const ilkSehir = ((h && h.yerler) || []).find(function (y) { return y.tur === "Şehir"; });
  const poz = function (v, yedek) { return (haritaSayi(v) && v > 0) ? v : (yedek || 0); };
  return {
    tur: tur,
    donen: typeof e.donen === "boolean" ? e.donen : tur === "gezegen",
    gunSaat: poz(e.gunSaat, tomye ? t.gunSaat : 0),
    yilGun: poz(e.yilGun, tomye ? t.yilGun : 0),
    egim: haritaSayi(e.egim) ? e.egim : 8,
    saatBoylami: haritaSayi(e.saatBoylami) ? e.saatBoylami : (ilkSehir ? ilkSehir.x : 50),
    kurallar: e.kurallar || "", icerik: e.icerik || "", okuyucu: e.okuyucu || "",
    sis: !!e.sis
  };
}

const HARITA_EVREN_TURLERI = { gezegen: "Gezegen", evren: "Evren", bolge: "Bölge" };

/* ---------- zaman ---------- */

function haritaEpok() {
  const t = veri.takvim || {};
  return new Date((t.epokDunya || "2000-01-01") + "T00:00:00Z").getTime();
}

/** Şimdiki Tömye zamanı: gün içi saat ve yıl kesri (mevsim için). */
function haritaSimdi(m) {
  const t = veri.takvim || {};
  const gecenSaat = (Date.now() - haritaEpok()) / 3600000;
  const gunSaat = m.gunSaat || t.gunSaat || 24;
  const gun = gecenSaat / gunSaat;
  const yilGun = m.yilGun || t.yilGun || 365;
  return {
    saat: ((gecenSaat % gunSaat) + gunSaat) % gunSaat,
    yilKesri: (((gun % yilGun) + yilGun) % yilGun) / yilGun
  };
}

function haritaSimdiYili() {
  const t = veri.takvim || {};
  const gun = ((Date.now() - haritaEpok()) / 3600000) / (t.gunSaat || 24);
  return (t.epokYil || 1) + Math.floor(gun / (t.yilGun || 365));
}

function haritaYilAd(y) { return "Yıl " + (y < 0 ? "−" + Math.abs(y) : y); }

function haritaSaatYaz(saat) {
  const s = Math.floor(saat), d = Math.floor((saat - s) * 60);
  return String(s).padStart(2, "0") + ":" + String(d).padStart(2, "0");
}

/** Zaman kaydırıcısının durakları: yerlerin ve yol adımlarının yılları + şimdi. */
function haritaAnahtarYillar() {
  const kume = {};
  (veri.haritalar || []).forEach(function (h) {
    (h.yerler || []).forEach(function (y) {
      if (haritaSayi(y.baslangic)) { kume[y.baslangic] = true; }
      if (haritaSayi(y.bitis)) { kume[y.bitis] = true; }
    });
  });
  (veri.karakterler || []).forEach(function (k) {
    (k.yol || []).forEach(function (a) { if (haritaSayi(a.yil)) { kume[a.yil] = true; } });
  });
  kume[haritaSimdiYili()] = true;
  return Object.keys(kume).map(Number).sort(function (a, b) { return a - b; });
}

/* ---------- evren ve yer görünürlüğü (kilit, sis, zaman) ---------- */

function haritaKesifOku() {
  try { return JSON.parse(kayitOku(HARITA_KESIF_ANAHTAR) || "{}") || {}; } catch (e) { return {}; }
}
function haritaKesfedildi(haritaId, yerId) {
  const d = haritaKesifOku();
  return !!(d[haritaId] && d[haritaId].indexOf(yerId) !== -1);
}
/** Yeni keşfedildiyse true döner. */
function haritaKesfet(haritaId, yerId) {
  const d = haritaKesifOku();
  if (!d[haritaId]) { d[haritaId] = []; }
  if (d[haritaId].indexOf(yerId) !== -1) { return false; }
  d[haritaId].push(yerId);
  kayitYaz(HARITA_KESIF_ANAHTAR, JSON.stringify(d));
  return true;
}

function katmanBulHepsi(id) {
  return (veri.katmanlar || []).concat(veri.kisiselKatmanlar || [])
    .find(function (k) { return k.id === id; });
}

function haritaEvrenGorunur(h) {
  if (haritaYonetici()) { return true; }
  if (typeof kanonEvrenErisimi === "function" && !kanonEvrenErisimi(h.id)) { return false; }
  if (h.gizli && !katmanAcik(h.gizli)) { return false; }
  const m = evrenMeta(h);
  if (m.sis && h !== (veri.haritalar || [])[0] && !haritaKesfedildi("_evren", h.id)) { return false; }
  return true;
}
function haritaGorunenEvrenler() {
  return (veri.haritalar || []).filter(haritaEvrenGorunur);
}

/** "goster" | "hayalet" (yalnızca yöneticiye) | "gizli". yil: null ise zaman filtresi yok. */
function haritaYerDurumu(h, y, yil) {
  let gizli = false;
  if (y.gizli && !katmanAcik(y.gizli)) { gizli = true; }
  if (y.sis && !haritaKesfedildi(h.id, y.id)) { gizli = true; }
  if (gizli && !haritaYonetici()) { return "gizli"; }
  if (yil !== null && yil !== undefined) {
    if (haritaSayi(y.baslangic) && yil < y.baslangic) { return "gizli"; }
    if (haritaSayi(y.bitis) && yil >= y.bitis) { return "gizli"; }
  }
  return gizli ? "hayalet" : "goster";
}

/* ---------- kıta şekli ---------- */

function haritaElipsSekil(y, n) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    p.push([+(y.x + HARITA_ELIPS_RX * Math.cos(a)).toFixed(1), +(y.y + HARITA_ELIPS_RY * Math.sin(a)).toFixed(1)]);
  }
  return p;
}

/** Kapalı Catmull-Rom eğrisi: köşe noktalarından yumuşak bir kıyı çizgisi. */
function haritaKitaYolu(p) {
  const n = p.length;
  let d = "M" + p[0][0] + " " + p[0][1];
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    d += "C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(2) + " " + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(2) + " " +
         (p2[0] - (p3[0] - p1[0]) / 6).toFixed(2) + " " + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(2) + " " +
         p2[0] + " " + p2[1];
  }
  return d + "Z";
}

function haritaSekilMerkezi(p) {
  let x = 0, y = 0;
  p.forEach(function (n) { x += n[0]; y += n[1]; });
  return { x: x / p.length, y: y / p.length };
}

/* ---------- gündüz–gece gölgesi ---------- */

/** Gece yarısı: güneş yüksekliği < yuksek (derece) olan bölge. Enleme göre gece
    yarı genişliği (0–50 birim). Eksen eğikliği ve mevsim terminatörü eğer. */
function haritaGeceGenislikleri(m, yilKesri, yuksek) {
  const dek = m.egim * Math.sin(2 * Math.PI * yilKesri) * Math.PI / 180;
  const sinD = Math.sin(dek), cosD = Math.cos(dek);
  const sinH = Math.sin(yuksek * Math.PI / 180);
  const satirlar = [];
  for (let i = 0; i <= 50; i++) {
    const y = i * 2;
    const enlem = (90 - 1.8 * y) * Math.PI / 180;
    const payda = Math.cos(enlem) * cosD;
    const pay = sinH - Math.sin(enlem) * sinD;
    let w;
    if (Math.abs(payda) < 1e-6) { w = pay > 0 ? 50 : 0; }
    else {
      const c = pay / payda;
      w = c >= 1 ? 50 : (c <= -1 ? 0 : 50 * (1 - Math.acos(c) / Math.PI));
    }
    satirlar.push([y, w]);
  }
  return satirlar;
}

function haritaGeceSvg(m, saat, yilKesri, cx, yarimW) {
  const geceX = m.saatBoylami + (m.gunSaat / 2 - saat) / m.gunSaat * 100 + 50;
  const s0 = Math.floor((cx - yarimW - geceX - 50) / 100);
  const s1 = Math.ceil((cx + yarimW - geceX + 50) / 100);
  let cikti = "";
  [[0, "hm-gece-a"], [-9, "hm-gece-b"]].forEach(function (kat) {
    const satirlar = haritaGeceGenislikleri(m, yilKesri, kat[0]);
    let d = "";
    for (let s = s0; s <= s1; s++) {
      const xs = geceX + 100 * s;
      const sol = satirlar.map(function (r) { return (xs - r[1] - (r[1] >= 49.9 ? 0.4 : 0)).toFixed(2) + " " + r[0]; });
      const sag = satirlar.slice().reverse().map(function (r) { return (xs + r[1] + (r[1] >= 49.9 ? 0.4 : 0)).toFixed(2) + " " + r[0]; });
      d += "M" + sol.join("L") + "L" + sag.join("L") + "Z";
    }
    cikti += '<path class="' + kat[1] + '" d="' + d + '"/>';
  });
  return '<g class="hm-gece">' + cikti + "</g>";
}

/* ---------- karakter yolu ---------- */

function haritaYerBul(haritaId, yerId) {
  if (typeof kanonEvrenErisimi === "function" && !kanonEvrenErisimi(haritaId)) { return null; }
  const h = (veri.haritalar || []).find(function (x) { return x.id === haritaId; });
  return h ? (h.yerler || []).find(function (y) { return y.id === yerId; }) || null : null;
}
function haritaKarakterBul(id) {
  return (veri.karakterler || []).find(function (k) { return k.id === id; }) || null;
}
function haritaEvrenAdi(id) {
  const h = (veri.haritalar || []).find(function (x) { return x.id === id; });
  return h ? h.ad : id;
}

/** Yolun adımlarını (zaman filtresine göre) döner: [{a, i, yer}] */
function haritaYolAdimlari(kar, yil) {
  const liste = [];
  ((kar && kar.yol) || []).forEach(function (a, i) {
    if (yil !== null && yil !== undefined && haritaSayi(a.yil) && a.yil > yil) { return; }
    const yer = haritaYerBul(a.harita, a.yer);
    if (yer) { liste.push({ a: a, i: i, yer: yer }); }
  });
  return liste;
}

/** Bu evrendeki yol parçalarını piksel uzayında çizer (dünyayı dolaşan yol en kısa yoldan gider). */
function haritaYolSvg(h, kar, adimlar, w, hh, cx, cy, k, t0, t1) {
  const px = function (X) { return (X - cx) * k + w / 2; };
  const py = function (Y) { return (Y - cy) * k + hh / 2; };
  const m = evrenMeta(h);
  const yol = kar.yol || [];
  const parcalar = [];      /* aynı evrende kesintisiz adımlar */
  let son = null;
  adimlar.forEach(function (s) {
    if (s.a.harita !== h.id) { son = null; return; }
    if (!son) { son = []; parcalar.push(son); }
    son.push(s);
  });
  const sonAdim = adimlar.length ? adimlar[adimlar.length - 1] : null;

  let cizgi = "", oklar = "", noktalar = "";
  parcalar.forEach(function (parca) {
    /* sarma: her adımı bir öncekine en yakın "dünya kopyasına" yerleştir */
    let xu = null;
    const nk = parca.map(function (s) {
      let x = s.yer.x;
      if (xu !== null && m.donen) { x = xu + ((((s.yer.x - xu + 50) % 100) + 100) % 100 - 50); }
      xu = x;
      return { x: x, y: s.yer.y, s: s };
    });
    /* aynı yerdeki adımlar tek işarette, numaraları birleşik */
    const gruplar = {};
    nk.forEach(function (n) {
      const an = n.s.yer.id + "|" + n.x.toFixed(2);
      (gruplar[an] = gruplar[an] || { n: n, s: [] }).s.push(n.s);
    });

    for (let t = t0 - 1; t <= t1 + 1; t++) {
      const pts = nk.map(function (n) { return [px(n.x + 100 * t), py(n.y)]; });
      const xs = pts.map(function (p) { return p[0]; });
      if (Math.max.apply(null, xs) < -80 || Math.min.apply(null, xs) > w + 80) { continue; }
      if (pts.length > 1) {
        cizgi += "M" + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L");
        for (let i = 0; i < pts.length - 1; i++) {
          const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
          if (Math.hypot(dx, dy) < 46) { continue; }
          oklar += '<path class="hm-yol-ok" transform="translate(' + (pts[i][0] + dx / 2).toFixed(1) + " " +
                   (pts[i][1] + dy / 2).toFixed(1) + ") rotate(" + (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1) +
                   ')" d="M-5 -5L5 0L-5 5z"/>';
        }
      }
      Object.keys(gruplar).forEach(function (an) {
        const g = gruplar[an];
        const X = px(g.n.x + 100 * t), Y = py(g.n.y);
        if (X < -60 || X > w + 60 || Y < -40 || Y > hh + 40) { return; }
        const nolar = g.s.map(function (s) { return s.i + 1; });
        let not = "";
        g.s.forEach(function (s) {
          const sonraki = yol[s.i + 1], onceki = yol[s.i - 1];
          if (sonraki && sonraki.harita !== s.a.harita) { not = " → " + haritaEvrenAdi(sonraki.harita); }
          else if (onceki && onceki.harita !== s.a.harita && !not) { not = " ← " + haritaEvrenAdi(onceki.harita); }
        });
        const sonMu = !!sonAdim && g.s.indexOf(sonAdim) !== -1;
        noktalar += '<g class="hm-yol-nokta' + (sonMu ? " son" : "") + '" transform="translate(' + X.toFixed(1) + " " + Y.toFixed(1) + ')">' +
          (sonMu ? '<circle class="hm-yol-halka" r="15"/>' : "") +
          '<circle class="hm-yol-daire" r="9"/>' +
          '<text class="hm-yol-no" y="3.6" text-anchor="middle">' + nolar.join(",") + "</text>" +
          (not ? '<text class="hm-yol-cikis" x="14" y="4">' + kacir(not) + "</text>" : "") +
          "</g>";
      });
    }
  });
  if (!cizgi && !noktalar) { return ""; }
  return '<g class="hm-yol">' +
    (cizgi ? '<path class="hm-yol-hale" d="' + cizgi + '"/><path class="hm-yol-cizgi" d="' + cizgi + '"/>' : "") +
    oklar + noktalar + "</g>";
}

/* ---------- sahne ---------- */

function haritaIsaret(y, sx, sy, secili, etkilesim, hayalet, etiketsiz) {
  const sinif = haritaTurSinifi(y.tur);
  const r = (HARITA_ISARET_R[sinif] || 6) + (secili ? 3 : 0);
  return '<g class="hm-nokta t-' + sinif + (secili ? " secili" : "") + (hayalet ? " hayalet" : "") + (y.gecit ? " gecit" : "") + '"' +
           (etkilesim ? ' data-hyer="' + kacir(y.id) + '"' : "") +
           ' transform="translate(' + sx.toFixed(1) + " " + sy.toFixed(1) + ')">' +
           (etkilesim ? '<circle class="hm-vuru" r="20"/>' : "") +
           (secili ? '<circle class="hm-halka" r="' + (r + 6) + '"/>' : "") +
           (y.gecit ? '<circle class="hm-gecit" r="' + (r + 5) + '"/>' : "") +
           '<circle class="hm-nkt" r="' + r + '"/>' +
           (etiketsiz ? "<title>" + kacir(y.ad) + "</title>"
                      : '<text y="' + (-(r + 7)) + '" text-anchor="middle">' + kacir(y.ad) + "</text>") +
         "</g>";
}

/* Etiket önceliği: sığmayanlar arasında önce düşük öncelikli olanların adı gizlenir. */
const HARITA_ETIKET_ONCELIK = { sehir: 1, su: 2, bolge: 3, ada: 4, kucuk: 5, uzak: 6, diger: 7 };

/** Etiket kutusu (piksel): yazı işaretin üstünde, ortalı. Mono 12px ≈ 7.3px/harf. */
function haritaEtiketKutusu(y, sx, sy, secili) {
  const r = (HARITA_ISARET_R[haritaTurSinifi(y.tur)] || 6) + (secili ? 3 : 0);
  const gen = String(y.ad || "").length * 7.3 + 6;
  return { x0: sx - gen / 2, x1: sx + gen / 2, y0: sy - r - 21, y1: sy - r - 3, nx: sx, ny: sy, nr: r };
}

function haritaKutuCakisir(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Düzenleme tutamaçları: seçili kıtanın köşeleri, ortası ve orta noktaları. */
function haritaTutamaclar(y, cx, cy, k, w, hh) {
  if (!y || !y.sekil) { return ""; }
  const t = Math.round((cx - y.x) / 100);
  const px = function (X) { return (X + 100 * t - cx) * k + w / 2; };
  const py = function (Y) { return (Y - cy) * k + hh / 2; };
  const n = y.sekil.length;
  let s = "";
  for (let i = 0; i < n; i++) {
    const a = y.sekil[i], b = y.sekil[(i + 1) % n];
    s += '<circle class="hm-orta" data-hmid="' + i + '" cx="' + px((a[0] + b[0]) / 2).toFixed(1) + '" cy="' + py((a[1] + b[1]) / 2).toFixed(1) + '" r="5"/>';
  }
  for (let i = 0; i < n; i++) {
    const a = y.sekil[i];
    s += '<rect class="hm-tutamac" data-hnokta="' + i + '" x="' + (px(a[0]) - 6).toFixed(1) + '" y="' + (py(a[1]) - 6).toFixed(1) + '" width="12" height="12" rx="2"/>';
  }
  const mr = haritaSekilMerkezi(y.sekil);
  s += '<path class="hm-merkez" data-hmerkez="1" transform="translate(' + px(mr.x).toFixed(1) + " " + py(mr.y).toFixed(1) + ')" d="M0 -11L11 0L0 11L-11 0z"/>';
  return '<g class="hm-tutamaclar">' + s + "</g>";
}

/** Verilen görünüm (merkez cx,cy — ölçek k piksel/birim) için SVG iç işaretini üretir.
    sec: { kimlik, etkilesim, yil, gece: {saat, yilKesri}|null, yol: karakterKimliği|null, duzen: bool } */
function haritaSahne(h, w, hh, cx, cy, k, sec) {
  const yerler = h.yerler || [];
  const m = evrenMeta(h);
  const kimlik = sec.kimlik;
  const yarim = w / (2 * k);
  const pay = 90 / k;                                  /* yan taşan etiketler için pay */
  const t0 = m.donen ? Math.floor((cx - yarim - pay) / 100) : 0;   /* görünen "dünya kopyaları" */
  const t1 = m.donen ? Math.floor((cx + yarim + pay) / 100) : 0;
  const solX = 100 * t0, sagX = 100 * (t1 + 1);
  const durum = {};
  yerler.forEach(function (y) { durum[y.id] = haritaYerDurumu(h, y, sec.yil); });

  let izgara = "";
  for (let x = solX; x <= sagX; x += 10) { izgara += "M" + x + " 0V100"; }
  for (let y = 10; y < 100; y += 10) { izgara += "M" + solX + " " + y + "H" + sagX; }

  let zemin = "";
  for (let t = t0; t <= t1; t++) {
    zemin += '<g transform="translate(' + (100 * t) + ' 0)">' +
      '<g class="hm-catlak">' + HARITA_CATLAK.map(function (d) { return '<path d="' + d + '"/>'; }).join("") + "</g>" +
      yerler.filter(function (y) { return y.tur === "Kıta" && durum[y.id] !== "gizli"; }).map(function (y) {
        const sinif = "hm-kita" + (durum[y.id] === "hayalet" ? " hayalet" : "");
        return y.sekil && y.sekil.length > 2
          ? '<path class="' + sinif + '" d="' + haritaKitaYolu(y.sekil) + '"/>'
          : '<ellipse class="' + sinif + '" cx="' + y.x + '" cy="' + y.y + '" rx="' + HARITA_ELIPS_RX + '" ry="' + HARITA_ELIPS_RY + '"/>';
      }).join("") +
      "</g>";
  }

  let gece = "";
  if (sec.gece && m.gunSaat) { gece = haritaGeceSvg(m, sec.gece.saat, sec.gece.yilKesri, cx, yarim); }

  const kitaAd = [], isaretler = [], ustte = [], adaylar = [], kitaKutular = [];
  for (let t = t0; t <= t1; t++) {
    yerler.forEach(function (y) {
      if (durum[y.id] === "gizli") { return; }
      const hayalet = durum[y.id] === "hayalet";
      const sx = (y.x + 100 * t - cx) * k + w / 2;
      const sy = (y.y - cy) * k + hh / 2;
      if (y.tur === "Kıta") {
        const ex = ((haritaSayi(y.etiketX)) ? y.etiketX : y.x) + 100 * t;
        const ey = haritaSayi(y.etiketY) ? y.etiketY : y.y;
        const ax = (ex - cx) * k + w / 2, ay = (ey - cy) * k + hh / 2;
        if (ax < -160 || ax > w + 160 || ay < -40 || ay > hh + 40) { return; }
        const ad = String(y.ad || "").toLocaleUpperCase("tr");
        const gen = Math.max(60, ad.length * 13);
        kitaKutular.push({ x0: ax - gen / 2, x1: ax + gen / 2, y0: ay - 16, y1: ay + 6 });
        kitaAd.push('<g class="hm-kita-g' + (hayalet ? " hayalet" : "") + '"' + (sec.etkilesim ? ' data-hyer="' + kacir(y.id) + '"' : "") + ">" +
          (sec.etkilesim ? '<rect class="hm-vuru" x="' + (ax - gen / 2).toFixed(1) + '" y="' + (ay - 16).toFixed(1) +
                           '" width="' + gen + '" height="28"/>' : "") +
          '<text class="hm-kita-ad" x="' + ax.toFixed(1) + '" y="' + ay.toFixed(1) + '">' + kacir(ad) + "</text></g>");
        return;
      }
      if (haritaGizliTurler[y.tur]) { return; }
      if (sx < -120 || sx > w + 120 || sy < -50 || sy > hh + 50) { return; }
      const secili = !!sec.etkilesim && haritaSecili === y.id;
      adaylar.push({ y: y, sx: sx, sy: sy, secili: secili, hayalet: hayalet,
                     oncelik: secili ? 0 : (HARITA_ETIKET_ONCELIK[haritaTurSinifi(y.tur)] || 9) });
    });
  }

  /* Uzaklaştırınca adlar üst üste binmesin: öncelik sırasıyla yerleştir,
     çakışan etiketi gizle (nokta kalır, yakınlaşınca adı geri gelir). */
  adaylar.sort(function (a, b) { return a.oncelik - b.oncelik; });
  const yerlesen = kitaKutular.slice();
  adaylar.forEach(function (a) {
    const kutu = haritaEtiketKutusu(a.y, a.sx, a.sy, a.secili);
    const cakisir = !a.secili && yerlesen.some(function (b) {
      return haritaKutuCakisir(kutu, b) ||
             /* başka bir işaretin noktasını da örtmesin */
             (b.nr && haritaKutuCakisir(kutu, { x0: b.nx - b.nr, x1: b.nx + b.nr, y0: b.ny - b.nr, y1: b.ny + b.nr }));
    });
    if (!cakisir) { yerlesen.push(kutu); }
    (a.secili ? ustte : isaretler).push(haritaIsaret(a.y, a.sx, a.sy, a.secili, !!sec.etkilesim, a.hayalet, cakisir));
  });

  let yol = "";
  if (sec.yol) {
    const kar = haritaKarakterBul(sec.yol);
    if (kar) { yol = haritaYolSvg(h, kar, haritaYolAdimlari(kar, sec.yil), w, hh, cx, cy, k, t0, t1); }
  }

  let tutamac = "";
  if (sec.duzen && haritaSecili) {
    const sy = yerler.find(function (y) { return y.id === haritaSecili && y.tur === "Kıta"; });
    if (sy) { tutamac = haritaTutamaclar(sy, cx, cy, k, w, hh); }
  }

  return '<defs>' +
      '<linearGradient id="hmKu-' + kimlik + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" style="stop-color:var(--beyaz);stop-opacity:.95"/>' +
        '<stop offset="1" style="stop-color:var(--beyaz);stop-opacity:0"/></linearGradient>' +
      '<linearGradient id="hmKa-' + kimlik + '" x1="0" y1="1" x2="0" y2="0">' +
        '<stop offset="0" style="stop-color:var(--beyaz);stop-opacity:.95"/>' +
        '<stop offset="1" style="stop-color:var(--beyaz);stop-opacity:0"/></linearGradient>' +
    "</defs>" +
    '<g transform="translate(' + (w / 2 - cx * k).toFixed(2) + " " + (hh / 2 - cy * k).toFixed(2) + ") scale(" + k.toFixed(4) + ')">' +
      '<rect class="hm-su" x="' + solX + '" y="0" width="' + (sagX - solX) + '" height="100"/>' +
      '<path class="hm-izgara" d="' + izgara + '"/>' +
      zemin + gece +
      '<rect x="' + solX + '" y="0" width="' + (sagX - solX) + '" height="9" fill="url(#hmKu-' + kimlik + ')"/>' +
      '<rect x="' + solX + '" y="91" width="' + (sagX - solX) + '" height="9" fill="url(#hmKa-' + kimlik + ')"/>' +
    "</g>" +
    yol + kitaAd.join("") + isaretler.join("") + ustte.join("") + tutamac;
}

/* ---------- bölümdeki küçük önizleme ---------- */

let haritaGozlemci = null;

/** Önizlemenin ve tam ekranın ilk baktığı yer: haritadaki ilk şehir. */
function haritaBaslangicNoktasi(h) {
  const yerler = (h && h.yerler) || [];
  const y = yerler.find(function (p) { return p.tur === "Şehir"; }) ||
            yerler.find(function (p) { return p.tur !== "Kıta"; });
  return y ? { x: y.x, y: y.y } : { x: 50, y: 50 };
}

function haritaGeceDurumu(h, saatEl) {
  const m = evrenMeta(h);
  if (!m.gunSaat) { return null; }
  const s = haritaSimdi(m);
  return { saat: (saatEl === null || saatEl === undefined) ? s.saat : saatEl, yilKesri: s.yilKesri };
}

function haritaOnizlemeBoya() {
  const kutu = document.querySelector("#haritaAlan .harita-onizleme");
  if (!kutu) { return; }
  const h = aktifHarita();
  if (!h) { return; }
  const w = kutu.clientWidth, hh = kutu.clientHeight;
  if (!w || !hh) { return; }             /* bölüm henüz görünmüyor; boyut gelince gözlemci çağırır */
  const b = haritaBaslangicNoktasi(h);
  const svg = kutu.querySelector("svg");
  const k = w / HARITA_ONIZLEME_GENIS;
  svg.setAttribute("viewBox", "0 0 " + w + " " + hh);
  /* Şehir çerçevenin üst kısmında dursun; altında kıtadan bir parça görünsün. */
  svg.innerHTML = haritaSahne(h, w, hh, b.x, b.y + 0.2 * hh / k, k,
    { kimlik: "on", etkilesim: false, yil: null, gece: haritaGeceDurumu(h, null) });
}

function haritaOnizlemeGozle() {
  if (haritaGozlemci) { haritaGozlemci.disconnect(); haritaGozlemci = null; }
  const kutu = document.querySelector("#haritaAlan .harita-onizleme");
  if (kutu && typeof ResizeObserver === "function") {
    haritaGozlemci = new ResizeObserver(haritaOnizlemeBoya);
    haritaGozlemci.observe(kutu);
  }
  haritaOnizlemeBoya();
}
window.addEventListener("resize", haritaOnizlemeBoya);

function haritaCiz() {
  const alan = document.querySelector("#haritaAlan");
  if (!alan) { return; }
  let h = aktifHarita();
  if (!h) { return; }
  if (!haritaEvrenGorunur(h)) { haritaSeciliId = null; h = aktifHarita(); }

  const gorunen = haritaGorunenEvrenler();
  const secici = gorunen.length > 1
    ? '<div class="harita-secici">' +
        gorunen.map(function (hh) {
          return '<button class="filtre-btn' + (hh.id === h.id ? " secili" : "") +
                 '" data-harita-sec="' + kacir(hh.id) + '">' + kacir(hh.ad) + "</button>";
        }).join("") +
      "</div>"
    : "";

  alan.innerHTML =
    secici +
    '<p class="oyun-giris">' + kacir(h.aciklama || "") + "</p>" +
    '<button type="button" class="harita-onizleme" data-harita-ac="1" aria-label="' +
      kacir(h.ad) + ' haritasını tam ekran aç">' +
      '<svg aria-hidden="true" focusable="false"></svg>' +
      '<span class="harita-onizleme-ipucu">' + HARITA_IKON_BUYUT + " Tam ekran</span>" +
    "</button>" +
    '<p class="oyun-not">Dokun, tam ekran açılsın. Sürükleyerek gezegeni çevir; harita yatayda sonsuz döner.</p>';

  haritaOnizlemeGozle();
  if (HT.acik) { haritaTamYenile(); }
}

/* ---- tam ekran harita ---- */

function haritaTamKur() {
  if (HT.kutu) { return HT.kutu; }
  const kutu = document.createElement("div");
  kutu.id = "haritaTam";
  kutu.className = "harita-tam";
  kutu.hidden = true;
  kutu.setAttribute("role", "dialog");
  kutu.setAttribute("aria-modal", "true");
  kutu.setAttribute("aria-label", "Harita, tam ekran");
  kutu.innerHTML =
    '<div class="ht-sahne" id="htSahne" tabindex="0" aria-label="Harita alanı. Ok tuşlarıyla gez, artı ve eksi ile yakınlaş.">' +
      '<svg id="htSvg" aria-hidden="true" focusable="false"></svg></div>' +
    '<div class="ht-ust">' +
      '<button type="button" class="ht-btn" data-ht="kapat" aria-label="Haritayı kapat" title="Kapat (Esc)">✕</button>' +
      '<div class="ht-baslik" id="htBaslik"></div>' +
      '<select class="ht-git" id="htGit" aria-label="Bir yere git"></select>' +
    "</div>" +
    '<div class="ht-lejant" id="htLejant"></div>' +
    '<div class="ht-duzen" id="htDuzen" hidden></div>' +
    '<div class="ht-arac">' +
      '<button type="button" class="ht-btn" data-ht="yakin" aria-label="Yakınlaş" title="Yakınlaş (+)">+</button>' +
      '<button type="button" class="ht-btn" data-ht="uzak" aria-label="Uzaklaş" title="Uzaklaş (−)">−</button>' +
      '<button type="button" class="ht-btn" data-ht="tum" aria-label="Tüm gezegeni göster" title="Tüm gezegen (0)">◎</button>' +
      '<button type="button" class="ht-btn" data-ht="katman" id="htKatmanBtn" aria-label="Katmanlar: gölge, zaman, yol, evrenler" title="Katmanlar (L)">' + HARITA_IKON_KATMAN + "</button>" +
      '<button type="button" class="ht-btn ht-yonetici" data-ht="duzen" id="htDuzenBtn" aria-label="Geliştirici modu" title="Geliştirici modu" hidden>' + HARITA_IKON_KALEM + "</button>" +
      (document.fullscreenEnabled
        ? '<button type="button" class="ht-btn" data-ht="tarayici" aria-label="Tarayıcı tam ekranı" title="Tarayıcıyı tam ekran yap">' +
          HARITA_IKON_BUYUT.replace('width="12" height="12"', 'width="16" height="16"') + "</button>"
        : "") +
    "</div>" +
    '<div class="ht-ipucu" id="htIpucu">Sürükleyerek gez · tekerlek ya da iki parmakla yakınlaş · harita yatayda sonsuz döner</div>' +
    '<div class="ht-panel" id="htPanel" hidden></div>' +
    '<div class="ht-bilgi" id="htBilgi" hidden></div>' +
    '<div class="ht-toast" id="htToast" role="status" aria-live="polite"></div>';
  document.body.appendChild(kutu);
  HT.kutu = kutu;
  haritaTamOlaylariBagla(kutu);
  return kutu;
}

function haritaToast(mesaj) {
  const el = HT.kutu && HT.kutu.querySelector("#htToast");
  if (!el) { return; }
  el.textContent = mesaj;
  el.classList.add("gorunur");
  clearTimeout(HT.toastZamani);
  HT.toastZamani = setTimeout(function () { el.classList.remove("gorunur"); }, 2800);
}

/** Görünümü sınırlar: yakınlaştırma aralığı, kutuplarda durma, yatayda sarma (ya da düz evrende kenar). */
function haritaSinirla() {
  HT.k = haritaKis(HT.k, HT.kMin, HT.kMax);
  const yarimH = HT.h / (2 * HT.k);
  HT.cy = (yarimH >= 50) ? 50 : haritaKis(HT.cy, yarimH, 100 - yarimH);
  if (HT.donen) { HT.cx = haritaSar(HT.cx); }
  else {
    const yarimW = HT.w / (2 * HT.k);
    HT.cx = (yarimW >= 50) ? 50 : haritaKis(HT.cx, yarimW, 100 - yarimW);
  }
}

function haritaKMin() {
  /* En uzak görünümde de gezegen yan yana tekrar etmesin: geniş ekranda genişliğe,
     dar ekranda yüksekliğe göre sığar. Düz evrende de tamamı ekranı doldurur. */
  return Math.max(HT.h, HT.w) / 100;
}

function haritaTamOlcu(ilk) {
  const sahne = HT.kutu.querySelector("#htSahne");
  const w = sahne.clientWidth, hh = sahne.clientHeight;
  if (!w || !hh) { return; }
  const eskiKMin = HT.kMin;
  HT.w = w; HT.h = hh;
  HT.kMin = haritaKMin();
  HT.kMax = HT.kMin * 10;
  if (!ilk && eskiKMin) { HT.k = HT.k / eskiKMin * HT.kMin; }   /* yeniden boyutlanınca oranı koru */
  HT.kutu.querySelector("#htSvg").setAttribute("viewBox", "0 0 " + w + " " + hh);
  haritaSinirla();
}

function haritaSahneSecenek(h) {
  return { kimlik: "tam", etkilesim: true, yil: HT.yil, yol: HT.yol, duzen: HT.duzen,
           gece: HT.gece ? haritaGeceDurumu(h, HT.saat) : null };
}

function haritaTamCiz() {
  const h = aktifHarita();
  if (!h || !HT.acik || !HT.w) { return; }
  HT.kutu.querySelector("#htSvg").innerHTML = haritaSahne(h, HT.w, HT.h, HT.cx, HT.cy, HT.k, haritaSahneSecenek(h));
  HT.kutu.querySelector('[data-ht="yakin"]').disabled = HT.k >= HT.kMax * 0.999;
  HT.kutu.querySelector('[data-ht="uzak"]').disabled = HT.k <= HT.kMin * 1.001;
  haritaKesifKontrol(h);
}
function haritaCizIste() {
  if (HT.kare) { return; }
  HT.kare = requestAnimationFrame(function () { HT.kare = 0; haritaTamCiz(); });
}
function haritaCizHemen() {
  if (HT.kare) { cancelAnimationFrame(HT.kare); HT.kare = 0; }
  haritaTamCiz();
}

/** Sisli yerler: ziyaretçi o yere yeterince yakınlaşıp baktığında keşfedilir. */
function haritaKesifKontrol(h) {
  if (haritaYonetici() || HT.k < HT.kMin * 2) { return; }
  const r = Math.min(HT.w, HT.h) * 0.3 / HT.k;
  (h.yerler || []).forEach(function (y) {
    if (!y.sis || haritaKesfedildi(h.id, y.id)) { return; }
    if (y.gizli && !katmanAcik(y.gizli)) { return; }
    let dx = y.x - HT.cx;
    if (HT.donen) { dx = (((dx + 50) % 100) + 100) % 100 - 50; }
    if (Math.hypot(dx, y.y - HT.cy) <= r && haritaKesfet(h.id, y.id)) {
      haritaToast("Sis dağıldı, keşfettin: " + y.ad);
      haritaTamLejantCiz();
      haritaTamBaslikDoldur();
      haritaCizIste();
    }
  });
}

function haritaAnimDurdur() {
  if (HT.anim) { cancelAnimationFrame(HT.anim); HT.anim = 0; }
  if (HT.atalet) { cancelAnimationFrame(HT.atalet); HT.atalet = 0; }
}

/** Görünümü yumuşakça başka bir merkeze/ölçeğe taşır. Yatayda en kısa yoldan gider
    (dünyanın öbür yanından dolaşmaz). */
function haritaGecis(hcx, hcy, hk, sure) {
  haritaAnimDurdur();
  const bx = HT.cx, by = HT.cy, bk = HT.k;
  const tx = HT.donen ? hcx + 100 * Math.round((bx - hcx) / 100) : hcx;
  hk = haritaKis(hk, HT.kMin, HT.kMax);
  if (haritaAzHareket() || !sure) {
    HT.cx = tx; HT.cy = hcy; HT.k = hk;
    haritaSinirla(); haritaCizHemen();
    return;
  }
  const t0 = performance.now();
  function adim(t) {
    const u = Math.min(1, (t - t0) / sure);
    const e = 1 - Math.pow(1 - u, 3);
    HT.k = bk * Math.pow(hk / bk, e);
    HT.cx = bx + (tx - bx) * e;
    HT.cy = by + (hcy - by) * e;
    haritaSinirla(); haritaCizHemen();
    HT.anim = (u < 1 && HT.acik) ? requestAnimationFrame(adim) : 0;
  }
  HT.anim = requestAnimationFrame(adim);
}

/** Ekrandaki (px,py) noktasını sabit tutarak yakınlaştırır; dx,dy kadar da kaydırır. */
function haritaKaydirYakinlastir(dx, dy, carpan, px, py) {
  const X = HT.cx + (px - dx - HT.w / 2) / HT.k;
  const Y = HT.cy + (py - dy - HT.h / 2) / HT.k;
  HT.k = haritaKis(HT.k * carpan, HT.kMin, HT.kMax);
  HT.cx = X - (px - HT.w / 2) / HT.k;
  HT.cy = Y - (py - HT.h / 2) / HT.k;
  haritaSinirla(); haritaCizIste();
}

function haritaZoomNoktaya(carpan, px, py) {
  const yeniK = haritaKis(HT.k * carpan, HT.kMin, HT.kMax);
  const X = HT.cx + (px - HT.w / 2) / HT.k;
  const Y = HT.cy + (py - HT.h / 2) / HT.k;
  haritaGecis(X - (px - HT.w / 2) / yeniK, Y - (py - HT.h / 2) / yeniK, yeniK, 320);
}

function haritaAtalet(vx, vy) {
  if (Math.hypot(vx, vy) < 0.05) { return; }
  let son = performance.now();
  function adim(t) {
    const dt = Math.min(50, t - son); son = t;
    HT.cx -= vx * dt / HT.k;
    HT.cy -= vy * dt / HT.k;
    const s = Math.exp(-dt / 320);
    vx *= s; vy *= s;
    haritaSinirla(); haritaCizHemen();
    HT.atalet = (Math.hypot(vx, vy) > 0.02 && HT.acik) ? requestAnimationFrame(adim) : 0;
  }
  HT.atalet = requestAnimationFrame(adim);
}

function haritaIpucuGizle() {
  clearTimeout(HT.ipucuZamani);
  const el = HT.kutu && HT.kutu.querySelector("#htIpucu");
  if (el) { el.classList.add("gizli"); }
}

/* ---------- seçim, evren değiştirme ---------- */

function haritaSeciliYer() {
  const h = aktifHarita();
  return (haritaSecili && h) ? (h.yerler || []).find(function (y) { return y.id === haritaSecili; }) || null : null;
}

/** Kıtanın tamamı ekrana sığacak yakınlık (kıyı çizgisi yoksa eski sabit oran). */
function haritaKitaSigdir(y) {
  if (!y.sekil || y.sekil.length < 3) { return HT.kMin * 1.8; }
  const xs = y.sekil.map(function (p) { return p[0]; });
  const ys = y.sekil.map(function (p) { return p[1]; });
  const gen = Math.max.apply(null, xs) - Math.min.apply(null, xs) + 8;
  const yuk = Math.max.apply(null, ys) - Math.min.apply(null, ys) + 8;
  return haritaKis(Math.min(HT.w / gen, HT.h / yuk), HT.kMin, HT.kMax);
}

/** Bir yeri seçer, bilgi kartını açar ve ona uçar. yakin: yere doğru belirgin yakınlaş. */
function haritaYereGit(id, yakin) {
  const h = aktifHarita();
  const y = h && (h.yerler || []).find(function (p) { return p.id === id; });
  if (!y) { return; }
  haritaSecili = id;
  HT.kita = (y.tur === "Kıta") ? id : null;
  if (haritaGizliTurler[y.tur]) { haritaGizliTurler[y.tur] = false; haritaTamLejantCiz(); }
  if (HT.panel && window.matchMedia && window.matchMedia("(max-width:719px)").matches) { HT.panel = false; haritaPanelCiz(); }
  haritaBilgiCiz();
  let k = HT.k;
  if (yakin) { k = (y.tur === "Kıta") ? haritaKitaSigdir(y) : Math.max(HT.k, HT.kMin * 3.5); }
  /* Yer, bilgi kartının altında kalmasın diye ekranın üst yarısına yerleşir. */
  haritaGecis(y.x, y.y + 0.1 * HT.h / k, k, 520);
}

function haritaEvrenDegistir(id, yerId) {
  const h = (veri.haritalar || []).find(function (x) { return x.id === id; });
  if (!h) { return; }
  if (!haritaYonetici() && typeof kanonEvrenErisimi === "function" && !kanonEvrenErisimi(id)) { haritaToast("Bu evren sana açık değil"); return; }
  if (!haritaYonetici() && h.gizli && !katmanAcik(h.gizli)) { haritaToast("Bu evrene henüz giremezsin"); return; }
  if (!haritaYonetici()) { haritaKesfet("_evren", id); }
  haritaSeciliId = id;
  haritaSecili = null;
  HT.kita = null;
  if (HT.acik) {
    haritaAnimDurdur();
    haritaTamHaritaYukle();
    if (yerId) { haritaYereGit(yerId, true); }
    haritaToast(h.ad + (HARITA_EVREN_TURLERI[evrenMeta(h).tur] ? " · " + HARITA_EVREN_TURLERI[evrenMeta(h).tur] : ""));
  }
  haritaCiz();
}

function haritaDokun(px, py) {
  const el = document.elementFromPoint(px, py);
  if (el && el.closest && el.closest("[data-hnokta],[data-hmid],[data-hmerkez]")) { return; }   /* tutamaç: seçimi bozma */
  const g = el && el.closest ? el.closest("[data-hyer]") : null;
  if (HT.duzen && HT.arac === "yol") {
    if (g) { haritaYolaEkle(g.getAttribute("data-hyer")); return; }
  }
  if (g) { haritaYereGit(g.getAttribute("data-hyer"), false); return; }
  if (HT.duzen && HT.arac === "yerekle") { haritaYeniYer(px, py); return; }
  if (haritaSecili) { haritaSecili = null; HT.kita = null; haritaBilgiCiz(); haritaCizIste(); }
}

/* ---------- yer bilgi kartı (görüntüleme + düzenleme) ---------- */

function haritaZamanAraligi(y) {
  const a = haritaSayi(y.baslangic), b = haritaSayi(y.bitis);
  if (!a && !b) { return ""; }
  return (a ? haritaYilAd(y.baslangic) : "en başından") + " → " + (b ? haritaYilAd(y.bitis) : "hâlâ");
}

function haritaBilgiCiz() {
  const el = HT.kutu.querySelector("#htBilgi");
  const s = haritaSeciliYer();
  if (!s) { el.hidden = true; el.innerHTML = ""; el.classList.remove("duzen"); HT.bilgiId = null; return; }
  const yeniSecim = HT.bilgiId !== s.id || HT.bilgiDuzen !== HT.duzen;
  const h = aktifHarita();
  const kapat = '<button type="button" class="ht-bilgi-kapat" data-ht="bilgi-kapat" aria-label="Kartı kapat">✕</button>';

  if (HT.duzen) {
    el.classList.add("duzen");
    el.innerHTML = kapat + haritaYerFormu(h, s);
  } else {
    el.classList.remove("duzen");
    const durum = haritaYerDurumu(h, s, null);
    const zaman = haritaZamanAraligi(s);
    let gecit = "";
    if (s.gecit && s.gecit.harita) {
      const hedef = (veri.haritalar || []).find(function (x) { return x.id === s.gecit.harita; });
      const izin = hedef && (haritaYonetici() || ((!hedef.gizli || katmanAcik(hedef.gizli)) && (typeof kanonEvrenErisimi !== "function" || kanonEvrenErisimi(hedef.id))));
      if (hedef && izin) {
        gecit = '<button type="button" class="dugme ht-gecit-btn" data-ht="gecit-git" data-harita="' + kacir(s.gecit.harita) +
                '" data-yer="' + kacir(s.gecit.yer || "") + '">Kapıdan geç · ' + kacir(hedef.ad) + " →</button>";
      }
    }
    el.innerHTML = kapat +
      "<h4>" + kacir(s.ad) + ' <span class="harita-tur">' + kacir(s.tur) + "</span></h4>" +
      (zaman ? '<p class="ht-zaman">' + kacir(zaman) + "</p>" : "") +
      (durum === "hayalet" ? '<p class="ht-zaman">Ziyaretçilerden gizli (kilit ya da sis)</p>' : "") +
      "<p>" + kacir(s.not || "") + "</p>" + haritaYerSakinleri(s) + gecit;
  }
  el.hidden = false;
  if (yeniSecim) { el.scrollTop = 0; }
  HT.bilgiId = s.id; HT.bilgiDuzen = HT.duzen;
  haritaIpucuGizle();
}

function haritaYerFormu(h, y) {
  const tumTurler = HARITA_TURLERI.concat(HARITA_TURLERI.indexOf(y.tur) === -1 ? [y.tur, "Küçük Yerleşim"] : ["Küçük Yerleşim"]);
  const turler = tumTurler.filter(function (t, i) { return tumTurler.indexOf(t) === i; });
  const katmanlar = (veri.katmanlar || []).concat(veri.kisiselKatmanlar || []);
  const evrenler = (veri.haritalar || []);
  const gh = (y.gecit && y.gecit.harita) || "";
  const hedefH = evrenler.find(function (x) { return x.id === gh; });
  const alan = function (etiket, girdi) { return '<label class="hf-alan"><span>' + etiket + "</span>" + girdi + "</label>"; };
  const sayiDeger = function (v) { return haritaSayi(v) ? v : ""; };
  const kita = y.tur === "Kıta";

  return '<h4>Yeri düzenle <span class="harita-tur">' + kacir(y.tur) + "</span></h4>" +
    alan("Ad", '<input class="kod-giris arac-giris" data-hf="ad" id="hfAd" value="' + kacir(y.ad) + '">') +
    alan("Tür", '<select class="kod-giris arac-giris" data-hf="tur">' + turler.map(function (t) {
      return '<option' + (t === y.tur ? " selected" : "") + ">" + kacir(t) + "</option>";
    }).join("") + "</select>") +
    alan("Not", '<textarea class="kod-giris arac-giris" data-hf="not" rows="3">' + kacir(y.not || "") + "</textarea>") +
    '<div class="hf-cift">' +
      alan("Başlangıç yılı", '<input class="kod-giris arac-giris" type="number" data-hf="baslangic" value="' + sayiDeger(y.baslangic) + '" placeholder="hep vardı">') +
      alan("Bitiş yılı", '<input class="kod-giris arac-giris" type="number" data-hf="bitis" value="' + sayiDeger(y.bitis) + '" placeholder="hâlâ var">') +
    "</div>" +
    alan("Gizli (katman açılınca görünür)", '<select class="kod-giris arac-giris" data-hf="gizli"><option value="">— herkese açık —</option>' +
      katmanlar.map(function (k) { return '<option value="' + kacir(k.id) + '"' + (y.gizli === k.id ? " selected" : "") + ">" + kacir(k.ad) + "</option>"; }).join("") + "</select>") +
    '<label class="hf-onay"><input type="checkbox" data-hf="sis"' + (y.sis ? " checked" : "") + '> Sisli: yaklaşıp bakana kadar görünmez</label>' +
    alan("Kapı: hangi evrene açılır", '<select class="kod-giris arac-giris" data-hf="gecitH"><option value="">— kapı değil —</option>' +
      evrenler.map(function (x) { return '<option value="' + kacir(x.id) + '"' + (x.id === gh ? " selected" : "") + ">" + kacir(x.ad) + "</option>"; }).join("") + "</select>") +
    (hedefH ? alan("Kapının vardığı yer", '<select class="kod-giris arac-giris" data-hf="gecitY"><option value="">— evrenin başı —</option>' +
      (hedefH.yerler || []).filter(function (p) { return p.tur !== "Kıta"; }).map(function (p) {
        return '<option value="' + kacir(p.id) + '"' + (y.gecit && y.gecit.yer === p.id ? " selected" : "") + ">" + kacir(p.ad) + "</option>";
      }).join("") + "</select>") : "") +
    (kita
      ? '<div class="oyun-sira">' +
          (y.sekil
            ? '<button type="button" class="dugme dugme-sade y-kucuk" data-ht="kita-elips">Elipse dön</button>'
            : '<button type="button" class="dugme dugme-sade y-kucuk" data-ht="kita-sekil">Kıyıyı düzenlenebilir yap</button>') +
        "</div>" +
        (y.sekil ? '<p class="oyun-not">Köşeleri sürükle, kenar ortasındaki noktaya dokunup yeni köşe ekle, köşeye çift tıklayıp sil. Ortadaki eşkenar dörtgen tüm kıtayı taşır.</p>' : "")
      : "") +
    '<div class="oyun-sira">' +
      '<button type="button" class="dugme dugme-sade y-kucuk y-sil" data-ht="yer-sil">' + (HT.silOnay === y.id ? "Emin misin?" : "Bu yeri sil") + "</button>" +
    "</div>";
}

/* ---------- üst şerit: evren adı, "yere git", lejant ---------- */

function haritaTamLejantCiz() {
  const h = aktifHarita();
  const el = HT.kutu.querySelector("#htLejant");
  const turler = [];
  ((h && h.yerler) || []).forEach(function (y) {
    if (y.tur !== "Kıta" && haritaYerDurumu(h, y, HT.yil) !== "gizli" && turler.indexOf(y.tur) === -1) { turler.push(y.tur); }
  });
  el.hidden = !turler.length;
  el.innerHTML = turler.map(function (t) {
    const gizli = !!haritaGizliTurler[t];
    return '<button type="button" class="hl-oge t-' + haritaTurSinifi(t) + (gizli ? " kapali" : "") +
           '" data-hm-tur="' + kacir(t) + '" aria-pressed="' + (!gizli) + '">' +
           '<span class="hl-nokta"></span>' + kacir(t) + "</button>";
  }).join("");
}

function haritaTamBaslikDoldur() {
  const liste = haritaGorunenEvrenler();
  const h = aktifHarita();
  const el = HT.kutu.querySelector("#htBaslik");
  el.innerHTML = liste.length > 1
    ? '<select class="ht-harita" id="htHarita" aria-label="Evren seç">' +
        liste.map(function (x) {
          return '<option value="' + kacir(x.id) + '"' + (h && x.id === h.id ? " selected" : "") + ">" + kacir(x.ad) + "</option>";
        }).join("") + "</select>"
    : kacir(h ? h.ad : "Harita");

  const yerler = ((h && h.yerler) || []).filter(function (y) { return haritaYerDurumu(h, y, HT.yil) !== "gizli"; });
  const gruplar = [];
  yerler.forEach(function (y) {
    let g = gruplar.find(function (x) { return x.tur === y.tur; });
    if (!g) { g = { tur: y.tur, yerler: [] }; gruplar.push(g); }
    g.yerler.push(y);
  });
  HT.kutu.querySelector("#htGit").innerHTML =
    '<option value="">Yere git…</option>' +
    gruplar.map(function (g) {
      return '<optgroup label="' + kacir(g.tur) + '">' + g.yerler.map(function (y) {
        return '<option value="' + kacir(y.id) + '">' + kacir(y.ad) + "</option>";
      }).join("") + "</optgroup>";
    }).join("");
  const yon = HT.kutu.querySelector("#htDuzenBtn");
  yon.hidden = !haritaYonetici();
  yon.classList.toggle("acik", HT.duzen);
  HT.kutu.querySelector("#htKatmanBtn").classList.toggle("acik", HT.panel);
}

/* ---------- katmanlar paneli: gölge, zaman, yol, evrenler ---------- */

function haritaEnYakinYilIndeksi(yillar, yil) {
  let en = 0;
  yillar.forEach(function (y, i) { if (Math.abs(y - yil) < Math.abs(yillar[en] - yil)) { en = i; } });
  return en;
}

function haritaGizliSayisi() {
  const h = aktifHarita();
  if (!h || HT.yil === null) { return 0; }
  return (h.yerler || []).filter(function (y) {
    return haritaYerDurumu(h, y, null) !== "gizli" && haritaYerDurumu(h, y, HT.yil) === "gizli";
  }).length;
}

function haritaPanelCiz() {
  const el = HT.kutu && HT.kutu.querySelector("#htPanel");
  if (!el) { return; }
  el.hidden = !HT.panel;
  HT.kutu.querySelector("#htKatmanBtn").classList.toggle("acik", HT.panel);
  if (!HT.panel) { return; }

  const h = aktifHarita();
  const m = evrenMeta(h);
  const yon = haritaYonetici();
  let s = '<div class="hp-baslik"><b>Katmanlar</b><button type="button" class="hp-x" data-hp="kapat" aria-label="Paneli kapat">✕</button></div>';

  /* 1) gündüz–gece */
  if (m.gunSaat) {
    const simdi = haritaSimdi(m);
    const saat = HT.saat === null ? simdi.saat : HT.saat;
    s += '<section class="hp-bolum">' +
      '<label class="hp-satir"><input type="checkbox" data-hp="gece"' + (HT.gece ? " checked" : "") + "> <b>Gündüz–gece gölgesi</b></label>" +
      '<div class="hp-alt">' +
        '<div class="hp-secim">' +
          '<label><input type="radio" name="hpSaatMod" data-hp="saatCanli"' + (HT.saat === null ? " checked" : "") + '> Canlı <em id="hpSimdi">' + haritaSaatYaz(simdi.saat) + "</em></label>" +
          '<label><input type="radio" name="hpSaatMod" data-hp="saatElle"' + (HT.saat !== null ? " checked" : "") + "> El ile</label>" +
        "</div>" +
        '<input type="range" id="hpSaat" min="0" max="' + m.gunSaat + '" step="0.05" value="' + saat.toFixed(2) + '"' +
          (HT.saat === null ? " disabled" : "") + ' aria-label="Gün içi saat">' +
        '<div class="hp-saat"><output id="hpSaatYaz">' + haritaSaatYaz(saat) + "</output>" +
          '<button type="button" class="hp-mini" data-hp="oynat">' + (HT.oynat ? "❚❚ Durdur" : "▶ Günü oynat") + "</button></div>" +
        '<p class="hp-not">Gölge, ' + kacir(h.ad) + " saatine göre hareket eder (bir gün " + m.gunSaat + " saat).</p>" +
      "</div></section>";
  } else {
    s += '<section class="hp-bolum"><p class="hp-not">Bu evrenin gün uzunluğu tanımlı değil, o yüzden gölge yok.' +
         (yon ? " Yönetici ▸ Harita düzenle ▸ evren ayarları." : "") + "</p></section>";
  }

  /* 2) zaman kaydırıcısı */
  const yillar = haritaAnahtarYillar();
  s += '<section class="hp-bolum">' +
    '<label class="hp-satir"><input type="checkbox" data-hp="zaman"' + (HT.yil !== null ? " checked" : "") + "> <b>Zaman kaydırıcısı</b></label>";
  if (HT.yil !== null) {
    const gizli = haritaGizliSayisi();
    s += '<div class="hp-alt">' +
      '<input type="range" id="hpYil" min="0" max="' + (yillar.length - 1) + '" step="1" value="' + haritaEnYakinYilIndeksi(yillar, HT.yil) + '" aria-label="Yıl">' +
      '<div class="hp-saat">' +
        '<button type="button" class="hp-mini" data-hp="yilOnce" aria-label="Önceki dönüm noktası">◀</button>' +
        '<input class="kod-giris arac-giris hp-yil" type="number" id="hpYilYaz" value="' + HT.yil + '" aria-label="Yıl yaz">' +
        '<button type="button" class="hp-mini" data-hp="yilSonra" aria-label="Sonraki dönüm noktası">▶</button>' +
        '<button type="button" class="hp-mini" data-hp="simdi">Şimdi</button>' +
      "</div>" +
      '<p class="hp-not" id="hpYilNot">' + haritaYilAd(HT.yil) + (gizli ? " · " + gizli + " yer henüz yok ya da artık yok" : "") + "</p>" +
    "</div>";
  } else if (yillar.length < 2) {
    s += '<p class="hp-not">Yerlere başlangıç ya da bitiş yılı verildikçe kaydırıcı dolar. ' + (yon ? "Geliştirici modunda bir yere dokunup yılları yaz." : "") + "</p>";
  }
  s += "</section>";

  /* 3) karakter yolu */
  const karlar = (yon && HT.duzen) ? (veri.karakterler || []) : (veri.karakterler || []).filter(function (k) { return k.yol && k.yol.length; });
  s += '<section class="hp-bolum"><label class="hp-satir" for="hpYol"><b>Karakter yolu</b></label>';
  if (karlar.length) {
    s += '<select class="kod-giris arac-giris" id="hpYol" data-hp="yol"><option value="">— yol gösterme —</option>' +
      karlar.map(function (k) {
        return '<option value="' + kacir(k.id) + '"' + (HT.yol === k.id ? " selected" : "") + ">" + kacir(k.ad) +
               (k.yol && k.yol.length ? " (" + k.yol.length + " adım)" : "") + "</option>";
      }).join("") + "</select>";
  } else {
    s += '<p class="hp-not">Henüz yolu olan karakter yok.' + (yon ? " Geliştirici modunu açıp Yol aracıyla bir karakter seç, yerlere dokun." : "") + "</p>";
  }
  const kar = HT.yol ? haritaKarakterBul(HT.yol) : null;
  if (kar) { s += haritaYolListesi(kar, yon && HT.duzen); }
  s += "</section>";

  /* 4) evrenler */
  const evrenler = haritaGorunenEvrenler();
  s += '<section class="hp-bolum"><b class="hp-satir">Evrenler</b><div class="hp-evrenler">' +
    evrenler.map(function (x) {
      const xm = evrenMeta(x);
      return '<button type="button" class="hp-evren' + (x.id === h.id ? " secili" : "") + '" data-hp-evren="' + kacir(x.id) + '">' +
        '<span class="hp-evren-ad">' + kacir(x.ad) + "</span>" +
        '<span class="hp-evren-alt">' + kacir(HARITA_EVREN_TURLERI[xm.tur] || xm.tur) + " · " + (x.yerler || []).length + " yer" +
          (x.gizli ? " · gizli" : "") + (xm.sis ? " · sisli" : "") + "</span></button>";
    }).join("") + "</div>";
  const uc = [["Kurallar", m.kurallar], ["İçerik", m.icerik], ["Okuyucu", m.okuyucu]].filter(function (x) { return x[1]; });
  if (uc.length) {
    s += '<dl class="hp-uc">' + uc.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + kacir(x[1]) + "</dd>"; }).join("") + "</dl>";
  }
  const kapilar = (h.yerler || []).filter(function (y) { return y.gecit && y.gecit.harita && haritaYerDurumu(h, y, null) !== "gizli" && (typeof kanonEvrenErisimi !== "function" || kanonEvrenErisimi(y.gecit.harita)); });
  if (kapilar.length) {
    s += '<div class="hp-kapilar"><span class="hp-not">Kapılar</span>' + kapilar.map(function (y) {
      return '<button type="button" class="hp-mini" data-hp-gecit="' + kacir(y.id) + '">' + kacir(y.ad) + " → " + kacir(haritaEvrenAdi(y.gecit.harita)) + "</button>";
    }).join("") + "</div>";
  }
  s += "</section>";

  /* 5) geliştirici */
  if (yon) {
    s += '<section class="hp-bolum hp-yonetici">' +
      '<label class="hp-satir"><input type="checkbox" data-hp="duzen"' + (HT.duzen ? " checked" : "") + "> <b>Geliştirici modu</b></label>" +
      '<p class="hp-not">Yerleri sürükle, kıta kıyısını çiz, yer ekle, karakter yolu çiz. Değişiklikler bellekte tutulur; işin bitince Kaydet\'e bas.</p></section>';
  }
  el.innerHTML = s;
}

function haritaYolListesi(kar, duzenle) {
  const yol = kar.yol || [];
  const gorunen = haritaYolAdimlari(kar, HT.yil);
  const gorunenIndeks = {};
  gorunen.forEach(function (g) { gorunenIndeks[g.i] = true; });
  if (!yol.length) { return '<p class="hp-not">Bu karakterin henüz yolu yok.</p>'; }
  return '<ol class="hp-yol">' + yol.map(function (a, i) {
    const yer = haritaYerBul(a.harita, a.yer);
    const acik = !!gorunenIndeks[i];
    return '<li class="' + (acik ? "" : "soluk") + '"><button type="button" class="hp-adim" data-hp-adim="' + i + '">' +
      '<b>' + (i + 1) + ".</b> " + kacir(yer ? yer.ad : "(silinmiş yer)") +
      '<em> · ' + kacir(haritaEvrenAdi(a.harita)) + (haritaSayi(a.yil) ? " · " + haritaYilAd(a.yil) : "") + "</em></button>" +
      (duzenle
        ? '<span class="hp-adim-arac"><input class="kod-giris arac-giris hp-yil" type="number" data-hp-adim-yil="' + i + '" value="' + (haritaSayi(a.yil) ? a.yil : "") + '" placeholder="yıl" aria-label="Adım yılı">' +
          '<button type="button" class="hp-mini" data-hp-adim-sil="' + i + '" aria-label="Adımı sil">✕</button></span>'
        : "") +
      (a.not ? '<span class="hp-adim-not">' + kacir(a.not) + "</span>" : "") + "</li>";
  }).join("") + "</ol>";
}

function haritaOynatDegistir() {
  if (HT.oynat) { cancelAnimationFrame(HT.oynat); HT.oynat = 0; haritaPanelCiz(); return; }
  const m = evrenMeta(aktifHarita());
  if (!m.gunSaat) { return; }
  if (HT.saat === null) { HT.saat = haritaSimdi(m).saat; }
  HT.gece = true;
  let son = performance.now();
  function adim(t) {
    const dt = (t - son) / 1000; son = t;
    HT.saat = (HT.saat + dt * m.gunSaat / 20) % m.gunSaat;   /* bir gün ~20 saniye */
    const r = HT.kutu.querySelector("#hpSaat"), y = HT.kutu.querySelector("#hpSaatYaz");
    if (r) { r.value = HT.saat.toFixed(2); }
    if (y) { y.textContent = haritaSaatYaz(HT.saat); }
    haritaCizIste();
    HT.oynat = HT.acik ? requestAnimationFrame(adim) : 0;
  }
  HT.oynat = requestAnimationFrame(adim);
  haritaPanelCiz();
}

function haritaZamanAc(ac) {
  if (ac) {
    if (HT.yil === null) { HT.yil = haritaSimdiYili(); }
  } else { HT.yil = null; }
  haritaZamanTazele(true);
}

/** Zaman filtresi değişince: sahne, lejant, "yere git" listesi ve panel tazelenir. */
function haritaZamanTazele(panelYenile) {
  const y = haritaSeciliYer();
  if (y && haritaYerDurumu(aktifHarita(), y, HT.yil) === "gizli") { haritaSecili = null; HT.kita = null; haritaBilgiCiz(); }
  haritaTamLejantCiz();
  haritaTamBaslikDoldur();
  if (panelYenile) { haritaPanelCiz(); }
  else {
    const not = HT.kutu.querySelector("#hpYilNot");
    const gizli = haritaGizliSayisi();
    if (not && HT.yil !== null) { not.textContent = haritaYilAd(HT.yil) + (gizli ? " · " + gizli + " yer henüz yok ya da artık yok" : ""); }
    const yaz = HT.kutu.querySelector("#hpYilYaz");
    if (yaz && HT.yil !== null && document.activeElement !== yaz) { yaz.value = HT.yil; }
  }
  haritaCizHemen();
}

/* ---------- geliştirici araçları ---------- */

function haritaDuzenCubuguCiz() {
  const el = HT.kutu.querySelector("#htDuzen");
  el.hidden = !(HT.duzen && haritaYonetici());
  if (el.hidden) { return; }
  const araclar = [["tasi", "Taşı"], ["yerekle", "+ Yer"], ["yol", "Yol çiz"]];
  el.innerHTML = araclar.map(function (a) {
      return '<button type="button" class="hl-oge' + (HT.arac === a[0] ? " secili" : "") + '" data-ht="arac" data-arac="' + a[0] + '" aria-pressed="' + (HT.arac === a[0]) + '">' + a[1] + "</button>";
    }).join("") +
    '<button type="button" class="hl-oge" data-ht="geri-al">↶ Geri al</button>' +
    '<button type="button" class="hl-oge kaydet" data-ht="kaydet">Kaydet' + (HT.kirli ? " (" + HT.kirli + ")" : "") + "</button>";
}

function haritaKirli() {
  HT.kirli++;
  haritaDuzenCubuguCiz();
}

function haritaGeriKaydet(h) {
  HT.geri.push({ harita: h.id, yerler: JSON.stringify(h.yerler || []) });
  if (HT.geri.length > 40) { HT.geri.shift(); }
}

function haritaGeriAl() {
  const s = HT.geri.pop();
  if (!s) { haritaToast("Geri alınacak bir şey yok"); return; }
  const h = (veri.haritalar || []).find(function (x) { return x.id === s.harita; });
  if (!h) { return; }
  const yerler = JSON.parse(s.yerler);
  h.yerler.length = 0;
  yerler.forEach(function (y) { h.yerler.push(y); });
  if (HT.kirli > 0) { HT.kirli--; }
  if (h.id !== aktifHarita().id) { haritaSeciliId = h.id; haritaTamHaritaYukle(); }
  haritaBilgiCiz();
  haritaDuzenCubuguCiz();
  haritaTamBaslikDoldur();
  haritaCizHemen();
  haritaToast("Geri alındı");
}

function haritaKaydet() {
  const http = location.protocol.indexOf("http") === 0;
  if (typeof githubHazir === "function" && githubHazir() && http) {
    githubGonder();
    haritaToast("GitHub'a gönderiliyor…");
  } else if (typeof yoneticiDisaAktar === "function") {
    yoneticiDisaAktar();
    haritaToast("veri.json panoya kopyalandı ya da indirildi");
  }
  HT.kirli = 0;
  haritaDuzenCubuguCiz();
}

function haritaYerId(ad) {
  const taban = "y_" + ad.trim().toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]+/gi, "").slice(0, 20);
  const var_ = {};
  tumHaritaYerleri().forEach(function (y) { var_[y.id] = true; });
  let id = taban, n = 2;
  while (var_[id]) { id = taban + n++; }
  return id;
}

function haritaYeniYer(px, py) {
  const h = aktifHarita();
  const r = HT.kutu.querySelector("#htSahne").getBoundingClientRect();
  const X = HT.cx + (px - r.left - HT.w / 2) / HT.k;
  const Y = HT.cy + (py - r.top - HT.h / 2) / HT.k;
  haritaGeriKaydet(h);
  const y = { id: haritaYerId("yeni yer"), ad: "Yeni yer", tur: "Şehir",
              x: +(HT.donen ? haritaSar(X) : haritaKis(X, 0, 100)).toFixed(1), y: +haritaKis(Y, 1, 99).toFixed(1), not: "" };
  h.yerler.push(y);
  haritaKirli();
  haritaYereGit(y.id, false);
  haritaTamBaslikDoldur();
  const ad = HT.kutu.querySelector("#hfAd");
  if (ad) { ad.focus(); ad.select(); }
}

function haritaYerSil() {
  const h = aktifHarita();
  const y = haritaSeciliYer();
  if (!y) { return; }
  if (HT.silOnay !== y.id) { HT.silOnay = y.id; haritaBilgiCiz(); return; }
  HT.silOnay = null;
  haritaGeriKaydet(h);
  h.yerler.splice(h.yerler.indexOf(y), 1);
  const kullanan = (veri.karakterler || []).filter(function (k) {
    return (k.yol || []).some(function (a) { return a.harita === h.id && a.yer === y.id; });
  }).length;
  haritaSecili = null; HT.kita = null;
  haritaKirli();
  haritaBilgiCiz(); haritaTamBaslikDoldur(); haritaTamLejantCiz(); haritaCizHemen();
  haritaToast(kullanan ? "Silindi. " + kullanan + " karakterin yolunda bu yer vardı, o adımlar gizlenir." : "Yer silindi");
}

/** Bilgi kartındaki form alanı değişti. */
function haritaFormUygula(alan, el) {
  const h = aktifHarita();
  const y = haritaSeciliYer();
  if (!y) { return; }
  haritaGeriKaydet(h);
  const deger = (el.type === "checkbox") ? el.checked : el.value;
  let yenidenCiz = false;

  if (alan === "ad") {
    const yeni = String(deger).trim();
    if (!yeni) { el.value = y.ad; return; }
    const eski = (typeof yerGorunenAd === "function") ? yerGorunenAd(y) : y.ad;
    y.ad = yeni;
    const yeniGorunen = (typeof yerGorunenAd === "function") ? yerGorunenAd(y) : y.ad;
    (veri.karakterler || []).forEach(function (k) {
      if (k.ozellikler && k.ozellikler.sehir === eski) { k.ozellikler.sehir = yeniGorunen; }
    });
    haritaTamBaslikDoldur();
  } else if (alan === "tur") { y.tur = deger; yenidenCiz = true; haritaTamLejantCiz(); }
  else if (alan === "not") { y.not = deger; }
  else if (alan === "baslangic" || alan === "bitis") {
    const n = parseFloat(deger);
    if (isNaN(n)) { delete y[alan]; } else { y[alan] = n; }
    haritaTamLejantCiz();
  } else if (alan === "gizli") { if (deger) { y.gizli = deger; } else { delete y.gizli; } }
  else if (alan === "sis") { if (deger) { y.sis = true; } else { delete y.sis; } }
  else if (alan === "gecitH") {
    if (deger) { y.gecit = { harita: deger, yer: (y.gecit && y.gecit.harita === deger) ? y.gecit.yer : "" }; } else { delete y.gecit; }
    yenidenCiz = true;
  } else if (alan === "gecitY") { if (y.gecit) { y.gecit.yer = deger; } }

  haritaKirli();
  if (yenidenCiz) { haritaBilgiCiz(); }
  haritaCizHemen();
}

function haritaKitaSekilYap() {
  const y = haritaSeciliYer();
  if (!y || y.tur !== "Kıta") { return; }
  haritaGeriKaydet(aktifHarita());
  y.sekil = haritaElipsSekil(y, 20);
  haritaKirli(); haritaBilgiCiz(); haritaCizHemen();
}

function haritaKitaElipseDon() {
  const y = haritaSeciliYer();
  if (!y || !y.sekil) { return; }
  haritaGeriKaydet(aktifHarita());
  delete y.sekil;
  haritaKirli(); haritaBilgiCiz(); haritaCizHemen();
}

function haritaKitaMerkeziGuncelle(y) {
  if (!y.sekil) { return; }
  const c = haritaSekilMerkezi(y.sekil);
  y.x = +haritaKis(c.x, 0, 100).toFixed(1);
  y.y = +haritaKis(c.y, 0, 100).toFixed(1);
  y.sekil.forEach(function (p) { p[0] = +p[0].toFixed(1); p[1] = +p[1].toFixed(1); });
}

/* Sürükleme: yer, kıta etiketi, kıta köşesi, tüm kıta. Piksel farkı dünya birimine çevrilir. */
function haritaDuzenVurus(px, py) {
  const el = document.elementFromPoint(px, py);
  if (!el || !el.closest) { return null; }
  let g = el.closest("[data-hnokta]");
  if (g) { return { tur: "nokta", i: parseInt(g.getAttribute("data-hnokta"), 10) }; }
  g = el.closest("[data-hmid]");
  if (g) { return { tur: "orta", i: parseInt(g.getAttribute("data-hmid"), 10) }; }
  if (el.closest("[data-hmerkez]")) { return { tur: "merkez" }; }
  g = el.closest("[data-hyer]");
  if (g && HT.arac !== "yol") {
    const id = g.getAttribute("data-hyer");
    const y = (aktifHarita().yerler || []).find(function (p) { return p.id === id; });
    if (y) { return { tur: y.tur === "Kıta" ? "etiket" : "yer", id: id }; }
  }
  return null;
}

function haritaSurukleBasla(vurus) {
  const h = aktifHarita();
  haritaGeriKaydet(h);
  HT.surukle = vurus;
  vurus.tasindi = false;
  if (vurus.tur === "orta") {
    /* kenar ortasına basılınca yeni köşe eklenir ve hemen sürüklenir */
    const y = haritaSeciliYer();
    if (y && y.sekil) {
      const a = y.sekil[vurus.i], b = y.sekil[(vurus.i + 1) % y.sekil.length];
      y.sekil.splice(vurus.i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      vurus.tur = "nokta"; vurus.i = vurus.i + 1; vurus.tasindi = true;
    }
  }
}

function haritaSurukleUygula(dx, dy) {
  const s = HT.surukle;
  if (!s) { return; }
  const h = aktifHarita();
  const bx = dx / HT.k, by = dy / HT.k;
  const y = s.id ? (h.yerler || []).find(function (p) { return p.id === s.id; }) : haritaSeciliYer();
  if (!y) { return; }
  s.tasindi = true;
  if (s.id && haritaSecili !== s.id) {           /* taşınan yer seçilsin, ama harita yerinden oynamasın */
    haritaSecili = s.id;
    HT.kita = y.tur === "Kıta" ? s.id : null;
    haritaBilgiCiz();
  }
  if (s.tur === "yer") {
    y.x = HT.donen ? haritaSar(y.x + bx) : haritaKis(y.x + bx, 0, 100);
    y.y = haritaKis(y.y + by, 1, 99);
  } else if (s.tur === "etiket") {
    y.etiketX = (haritaSayi(y.etiketX) ? y.etiketX : y.x) + bx;
    y.etiketY = (haritaSayi(y.etiketY) ? y.etiketY : y.y) + by;
  } else if (s.tur === "nokta" && y.sekil && y.sekil[s.i]) {
    y.sekil[s.i][0] = haritaKis(y.sekil[s.i][0] + bx, -40, 140);
    y.sekil[s.i][1] = haritaKis(y.sekil[s.i][1] + by, 0, 100);
  } else if (s.tur === "merkez" && y.sekil) {
    y.sekil.forEach(function (p) { p[0] += bx; p[1] = haritaKis(p[1] + by, 0, 100); });
    y.x += bx; y.y = haritaKis(y.y + by, 0, 100);
    if (haritaSayi(y.etiketX)) { y.etiketX += bx; }
    if (haritaSayi(y.etiketY)) { y.etiketY += by; }
  }
  haritaCizIste();
}

function haritaSurukleBitir() {
  const s = HT.surukle;
  HT.surukle = null;
  if (!s || !s.tasindi) {
    if (s) { HT.geri.pop(); }          /* hiçbir şey değişmedi: anlık görüntüyü at */
    return false;
  }
  const h = aktifHarita();
  const y = s.id ? (h.yerler || []).find(function (p) { return p.id === s.id; }) : haritaSeciliYer();
  if (y) {
    if (s.tur === "yer") { y.x = +y.x.toFixed(1); y.y = +y.y.toFixed(1); }
    if (s.tur === "etiket") { y.etiketX = +y.etiketX.toFixed(1); y.etiketY = +y.etiketY.toFixed(1); }
    if (s.tur === "nokta" || s.tur === "merkez") { haritaKitaMerkeziGuncelle(y); }
  }
  haritaKirli();
  haritaCizHemen();
  return true;
}

function haritaKoseSil(px, py) {
  const vurus = haritaDuzenVurus(px, py);
  const y = haritaSeciliYer();
  if (!vurus || vurus.tur !== "nokta" || !y || !y.sekil || y.sekil.length <= 3) { return false; }
  haritaGeriKaydet(aktifHarita());
  y.sekil.splice(vurus.i, 1);
  haritaKitaMerkeziGuncelle(y);
  haritaKirli(); haritaCizHemen();
  return true;
}

/* Karakter yolu düzenleme */
function haritaYolaEkle(yerId) {
  const kar = HT.yol ? haritaKarakterBul(HT.yol) : null;
  const h = aktifHarita();
  if (!kar) { haritaToast("Önce panelden bir karakter seç (Katmanlar ▸ Karakter yolu)"); if (!HT.panel) { HT.panel = true; haritaPanelCiz(); } return; }
  const yer = (h.yerler || []).find(function (y) { return y.id === yerId; });
  if (!yer || yer.tur === "Kıta") { return; }
  if (!kar.yol) { kar.yol = []; }
  const a = { harita: h.id, yer: yerId };
  if (HT.yil !== null) { a.yil = HT.yil; }
  kar.yol.push(a);
  haritaKirli();
  haritaPanelCiz();
  haritaCizHemen();
  haritaToast(kar.ad + ": " + kar.yol.length + ". adım — " + yer.ad);
}

/* ---------- açılış / kapanış ---------- */

function haritaTamHaritaYukle() {
  const h = aktifHarita();
  if (!h) { return; }
  const m = evrenMeta(h);
  HT.donen = m.donen;
  HT.kMin = haritaKMin();
  HT.kMax = HT.kMin * 10;
  const b = haritaBaslangicNoktasi(h);
  HT.cx = b.x; HT.cy = b.y;
  /* Açılışta yerler iç içe görünmesin ama kıta da ekrana sığsın:
     yaklaşık 50 birim yükseklik ya da 60 birim genişlik, hangisi daha genişse. */
  HT.k = Math.max(HT.kMin, Math.min(HT.h / 50, HT.w / 60));
  haritaSinirla();
  haritaTamBaslikDoldur();
  haritaTamLejantCiz();
  haritaBilgiCiz();
  haritaPanelCiz();
  haritaDuzenCubuguCiz();
  haritaCizHemen();
}

/** Yönetici panelinden veri değiştiyse açık haritayı tazeler. */
function haritaTamYenile() {
  if (!HT.acik) { return; }
  if (haritaSecili && !haritaSeciliYer()) { haritaSecili = null; }
  haritaTamBaslikDoldur();
  haritaTamLejantCiz();
  haritaBilgiCiz();
  haritaPanelCiz();
  haritaDuzenCubuguCiz();
  haritaCizHemen();
}

/** opt: yalnızca bir yer kimliği (metin) ya da { yer, yol, evren }. */
function haritaTamAc(opt) {
  if (!aktifHarita()) { return; }
  if (typeof opt === "string") { opt = { yer: opt }; }
  opt = opt || {};
  if (opt.evren) { haritaSeciliId = opt.evren; }
  const kutu = haritaTamKur();
  HT.odakOnce = document.activeElement;
  kutu.hidden = false;
  document.documentElement.classList.add("harita-tam-acik");
  HT.acik = true;
  haritaTamOlcu(true);
  haritaSecili = null;                  /* her açılış temiz başlasın; yer verildiyse aşağıda seçilir */
  HT.silOnay = null;
  HT.duzen = false;
  if (opt.yol) {
    const kar = haritaKarakterBul(opt.yol);
    const ilk = kar && (kar.yol || []).find(function (a) { return haritaYerBul(a.harita, a.yer); });
    HT.yol = opt.yol;
    if (ilk) { haritaSeciliId = ilk.harita; }
    HT.panel = true;
  }
  haritaTamHaritaYukle();
  if (opt.yol) {
    const kar = haritaKarakterBul(opt.yol);
    const ilk = kar && (kar.yol || []).find(function (a) { return a.harita === aktifHarita().id && haritaYerBul(a.harita, a.yer); });
    if (ilk) { const yer = haritaYerBul(ilk.harita, ilk.yer); haritaGecis(yer.x, yer.y, HT.kMin * 3, 0); }
  }
  if (opt.yer) { haritaYereGit(opt.yer, true); }

  HT.gecmis = false;
  try { history.pushState({ haritaTam: 1 }, ""); HT.gecmis = true; } catch (_) { /* geri tuşu desteği isteğe bağlı */ }

  const ip = kutu.querySelector("#htIpucu");
  ip.classList.toggle("gizli", !!haritaSecili || HT.panel);
  clearTimeout(HT.ipucuZamani);
  HT.ipucuZamani = setTimeout(haritaIpucuGizle, 6000);
  clearInterval(HT.zamanlayici);
  HT.zamanlayici = setInterval(function () {      /* canlı gölge ve saat yavaşça ilerler */
    if (!HT.acik) { return; }
    if (HT.gece && HT.saat === null) { haritaCizIste(); }
    const s = HT.kutu.querySelector("#hpSimdi");
    if (s) { s.textContent = haritaSaatYaz(haritaSimdi(evrenMeta(aktifHarita())).saat); }
  }, 15000);
  kutu.querySelector("#htSahne").focus({ preventScroll: true });
}

function haritaTamKapat(geriTusuyla) {
  if (!HT.acik) { return; }
  HT.acik = false;
  haritaAnimDurdur();
  if (HT.oynat) { cancelAnimationFrame(HT.oynat); HT.oynat = 0; }
  if (HT.kare) { cancelAnimationFrame(HT.kare); HT.kare = 0; }
  clearTimeout(HT.ipucuZamani);
  clearInterval(HT.zamanlayici);
  HT.surukle = null;
  HT.kutu.hidden = true;
  document.documentElement.classList.remove("harita-tam-acik");
  if (document.fullscreenElement) {
    try { const p = document.exitFullscreen(); if (p && p.catch) { p.catch(function () {}); } } catch (_) {}
  }
  if (!geriTusuyla && HT.gecmis) {
    HT.gecmis = false;
    try { history.back(); } catch (_) {}
  }
  HT.gecmis = false;
  haritaCiz();                          /* önizleme, tam ekranda seçilen evreni göstersin */
  if (HT.odakOnce && document.contains(HT.odakOnce) && HT.odakOnce.focus) {
    try { HT.odakOnce.focus({ preventScroll: true }); } catch (_) {}
  }
}

/* ---------- olaylar ---------- */

function haritaTamOlaylariBagla(kutu) {
  const sahne = kutu.querySelector("#htSahne");
  const ptr = new Map();          /* parmaklar / fare: id -> {x,y} */
  let sur = null;                 /* tek parmakla sürükleme durumu */
  let pinch = null;               /* iki parmakla: önceki orta nokta ve mesafe */

  function pinchOlc() {
    const [a, b] = Array.from(ptr.values());
    return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  }

  sahne.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) { return; }
    haritaAnimDurdur();
    haritaIpucuGizle();
    const ilk = ptr.size === 0;
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { sahne.setPointerCapture(e.pointerId); } catch (_) {}
    if (ilk) {
      sur = { x0: e.clientX, y0: e.clientY, lt: e.timeStamp, vx: 0, vy: 0, tasindi: false };
      if (HT.duzen && haritaYonetici()) {
        const vurus = haritaDuzenVurus(e.clientX, e.clientY);
        if (vurus) { haritaSurukleBasla(vurus); sur.duzen = true; }
      }
    } else if (ptr.size === 2) {
      if (sur) { sur.tasindi = true; }
      if (HT.surukle) { haritaSurukleBitir(); if (sur) { sur.duzen = false; } }
      pinch = pinchOlc();
    }
  });

  sahne.addEventListener("pointermove", function (e) {
    const p = ptr.get(e.pointerId);
    if (!p) { return; }
    let dx = e.clientX - p.x, dy = e.clientY - p.y;
    const oncekiX = p.x, oncekiY = p.y;
    p.x = e.clientX; p.y = e.clientY;

    if (ptr.size === 1 && sur) {
      if (!sur.tasindi) {
        if (Math.hypot(e.clientX - sur.x0, e.clientY - sur.y0) <= 6) { return; }
        sur.tasindi = true;
        if (!sur.duzen) { sahne.classList.add("surukleniyor"); }
        dx = e.clientX - sur.x0; dy = e.clientY - sur.y0;   /* eşiğe kadar birikeni de uygula */
      }
      if (sur.duzen && HT.surukle) { haritaSurukleUygula(dx, dy); return; }
      HT.cx -= dx / HT.k;
      HT.cy -= dy / HT.k;
      const dt = Math.max(1, e.timeStamp - sur.lt);
      sur.vx = 0.7 * sur.vx + 0.3 * ((e.clientX - oncekiX) / dt);
      sur.vy = 0.7 * sur.vy + 0.3 * ((e.clientY - oncekiY) / dt);
      sur.lt = e.timeStamp;
      haritaSinirla(); haritaCizIste();
    } else if (ptr.size === 2 && pinch) {
      const yeni = pinchOlc();
      const r = sahne.getBoundingClientRect();
      haritaKaydirYakinlastir(yeni.mx - pinch.mx, yeni.my - pinch.my, yeni.d / pinch.d,
                              yeni.mx - r.left, yeni.my - r.top);
      pinch = yeni;
    }
  });

  function birak(e) {
    if (!ptr.has(e.pointerId)) { return; }
    ptr.delete(e.pointerId);
    try { sahne.releasePointerCapture(e.pointerId); } catch (_) {}
    if (ptr.size === 0) {
      sahne.classList.remove("surukleniyor");
      const s = sur; sur = null; pinch = null;
      const surukleniyordu = !!HT.surukle;
      if (surukleniyordu) {
        const tasindi = haritaSurukleBitir();
        if (tasindi || !s) { return; }
      }
      if (!s || e.type === "pointercancel") { return; }
      if (!s.tasindi) { haritaDokun(e.clientX, e.clientY); return; }
      if (e.timeStamp - s.lt < 90 && !haritaAzHareket() && !s.duzen) { haritaAtalet(s.vx, s.vy); }
    } else if (ptr.size === 1) {
      pinch = null;                      /* kalan parmakla sürüklemeye devam; dokunma sayılmaz */
      const kalan = ptr.values().next().value;
      sur = { x0: kalan.x, y0: kalan.y, lt: e.timeStamp, vx: 0, vy: 0, tasindi: true };
    }
  }
  sahne.addEventListener("pointerup", birak);
  sahne.addEventListener("pointercancel", birak);

  sahne.addEventListener("wheel", function (e) {
    e.preventDefault();
    haritaAnimDurdur();
    haritaIpucuGizle();
    const birim = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 400 : 1);
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {            /* iz yüzeyi yatay kaydırma: çevir */
      HT.cx += e.deltaX * birim / HT.k;
      haritaSinirla(); haritaCizIste();
      return;
    }
    const r = sahne.getBoundingClientRect();
    haritaKaydirYakinlastir(0, 0, Math.exp(-e.deltaY * birim * (e.ctrlKey ? 0.01 : 0.0018)),
                            e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  sahne.addEventListener("dblclick", function (e) {
    if (HT.duzen && haritaKoseSil(e.clientX, e.clientY)) { return; }
    if (e.target.closest && e.target.closest("[data-hyer],[data-hnokta],[data-hmid],[data-hmerkez]")) { return; }
    const r = sahne.getBoundingClientRect();
    haritaZoomNoktaya(2, e.clientX - r.left, e.clientY - r.top);
  });

  kutu.addEventListener("click", function (e) {
    const b = e.target.closest("[data-ht]");
    if (b) {
      const ne = b.getAttribute("data-ht");
      if (ne === "kapat") { haritaTamKapat(); }
      else if (ne === "bilgi-kapat") { haritaSecili = null; HT.kita = null; haritaBilgiCiz(); haritaCizIste(); }
      else if (ne === "yakin") { haritaGecis(HT.cx, HT.cy, HT.k * 1.6, 260); }
      else if (ne === "uzak") { haritaGecis(HT.cx, HT.cy, HT.k / 1.6, 260); }
      else if (ne === "tum") { haritaGecis(HT.cx, 50, HT.kMin, 520); }
      else if (ne === "katman") {
        HT.panel = !HT.panel;
        if (HT.panel && window.matchMedia && window.matchMedia("(max-width:719px)").matches && haritaSecili) {
          haritaSecili = null; HT.kita = null; haritaBilgiCiz(); haritaCizIste();
        }
        haritaIpucuGizle(); haritaPanelCiz();
      }
      else if (ne === "duzen") { haritaDuzenAc(!HT.duzen); }
      else if (ne === "arac") { HT.arac = b.getAttribute("data-arac"); haritaDuzenCubuguCiz(); }
      else if (ne === "geri-al") { haritaGeriAl(); }
      else if (ne === "kaydet") { haritaKaydet(); }
      else if (ne === "kita-sekil") { haritaKitaSekilYap(); }
      else if (ne === "kita-elips") { haritaKitaElipseDon(); }
      else if (ne === "yer-sil") { haritaYerSil(); }
      else if (ne === "gecit-git") { haritaEvrenDegistir(b.getAttribute("data-harita"), b.getAttribute("data-yer") || null); }
      else if (ne === "tarayici") {
        try {
          if (document.fullscreenElement) { document.exitFullscreen(); }
          else { const p = kutu.requestFullscreen(); if (p && p.catch) { p.catch(function () {}); } }
        } catch (_) {}
      }
      return;
    }
    const tf = e.target.closest("[data-hm-tur]");
    if (tf) {
      const t = tf.getAttribute("data-hm-tur");
      haritaGizliTurler[t] = !haritaGizliTurler[t];
      const s = haritaSeciliYer();
      if (s && haritaGizliTurler[s.tur]) { haritaSecili = null; haritaBilgiCiz(); }
      haritaTamLejantCiz();
      haritaCizHemen();
      return;
    }
    const hp = e.target.closest("[data-hp]");
    if (hp) {
      const ne = hp.getAttribute("data-hp");
      if (ne === "kapat") { HT.panel = false; haritaPanelCiz(); }
      else if (ne === "oynat") { haritaOynatDegistir(); }
      else if (ne === "yilOnce" || ne === "yilSonra") {
        const yillar = haritaAnahtarYillar();
        const i = haritaEnYakinYilIndeksi(yillar, HT.yil);
        let j = i;
        if (ne === "yilOnce") { j = yillar[i] < HT.yil ? i : Math.max(0, i - 1); }
        else { j = yillar[i] > HT.yil ? i : Math.min(yillar.length - 1, i + 1); }
        HT.yil = yillar[j]; haritaZamanTazele(true);
      }
      else if (ne === "simdi") { HT.yil = haritaSimdiYili(); haritaZamanTazele(true); }
      return;
    }
    const ev = e.target.closest("[data-hp-evren]");
    if (ev) { haritaEvrenDegistir(ev.getAttribute("data-hp-evren"), null); return; }
    const gc = e.target.closest("[data-hp-gecit]");
    if (gc) {
      const y = (aktifHarita().yerler || []).find(function (p) { return p.id === gc.getAttribute("data-hp-gecit"); });
      if (y && y.gecit) { haritaEvrenDegistir(y.gecit.harita, y.gecit.yer || null); }
      return;
    }
    const ad = e.target.closest("[data-hp-adim]");
    if (ad) {
      const kar = haritaKarakterBul(HT.yol);
      const a = kar && (kar.yol || [])[parseInt(ad.getAttribute("data-hp-adim"), 10)];
      if (a) {
        if (a.harita !== aktifHarita().id) { haritaEvrenDegistir(a.harita, null); }
        const yer = haritaYerBul(a.harita, a.yer);
        if (yer) {
          if (HT.yil !== null && haritaSayi(a.yil) && a.yil > HT.yil) { HT.yil = a.yil; haritaZamanTazele(true); }
          haritaGecis(yer.x, yer.y, Math.max(HT.k, HT.kMin * 3), 520);
        }
      }
      return;
    }
    const sil = e.target.closest("[data-hp-adim-sil]");
    if (sil) {
      const kar = haritaKarakterBul(HT.yol);
      if (kar && kar.yol) {
        kar.yol.splice(parseInt(sil.getAttribute("data-hp-adim-sil"), 10), 1);
        haritaKirli(); haritaPanelCiz(); haritaCizHemen();
      }
    }
  });

  kutu.addEventListener("input", function (e) {
    const t = e.target;
    if (t.id === "hpSaat") {
      HT.saat = parseFloat(t.value) || 0;
      const y = kutu.querySelector("#hpSaatYaz");
      if (y) { y.textContent = haritaSaatYaz(HT.saat); }
      haritaCizIste();
    } else if (t.id === "hpYil") {
      const yillar = haritaAnahtarYillar();
      HT.yil = yillar[parseInt(t.value, 10)];
      haritaZamanTazele(false);
    } else if (t.id === "hpYilYaz") {
      const n = parseFloat(t.value);
      if (!isNaN(n)) { HT.yil = Math.round(n); haritaZamanTazele(false); }
    }
  });

  kutu.addEventListener("change", function (e) {
    const t = e.target;
    if (t.id === "htGit") {
      const v = t.value;
      t.value = "";
      if (v) { haritaYereGit(v, true); }
    } else if (t.id === "htHarita") {
      haritaEvrenDegistir(t.value, null);
    } else if (t.hasAttribute("data-hf")) {
      haritaFormUygula(t.getAttribute("data-hf"), t);
    } else if (t.hasAttribute("data-hp-adim-yil")) {
      const kar = haritaKarakterBul(HT.yol);
      const a = kar && (kar.yol || [])[parseInt(t.getAttribute("data-hp-adim-yil"), 10)];
      if (a) {
        const n = parseFloat(t.value);
        if (isNaN(n)) { delete a.yil; } else { a.yil = Math.round(n); }
        haritaKirli(); haritaPanelCiz(); haritaCizHemen();
      }
    } else if (t.hasAttribute("data-hp")) {
      const ne = t.getAttribute("data-hp");
      if (ne === "gece") { HT.gece = t.checked; haritaCizHemen(); }
      else if (ne === "saatCanli") { HT.saat = null; if (HT.oynat) { cancelAnimationFrame(HT.oynat); HT.oynat = 0; } haritaPanelCiz(); haritaCizHemen(); }
      else if (ne === "saatElle") { HT.saat = haritaSimdi(evrenMeta(aktifHarita())).saat; haritaPanelCiz(); haritaCizHemen(); }
      else if (ne === "zaman") { haritaZamanAc(t.checked); }
      else if (ne === "duzen") { haritaDuzenAc(t.checked); }
      else if (ne === "yol") { HT.yol = t.value || null; haritaPanelCiz(); haritaCizHemen(); }
    }
  });

  window.addEventListener("resize", function () {
    if (!HT.acik) { return; }
    haritaTamOlcu(false);
    haritaCizHemen();
  });

  window.addEventListener("popstate", function () {
    if (HT.acik) { HT.gecmis = false; haritaTamKapat(true); }
  });

  document.addEventListener("fullscreenchange", function () {
    if (HT.acik) { setTimeout(function () { haritaTamOlcu(false); haritaCizHemen(); }, 60); }
  });

  /* Yakalama aşamasında dinler: harita açıkken sitenin tek harfli kısayolları
     (r, g, 1–9, / …) çalışmasın; klavye yalnızca haritaya ait olsun. */
  document.addEventListener("keydown", function (e) {
    if (!HT.acik) { return; }
    e.stopPropagation();
    const a = document.activeElement;

    if (e.key === "Escape") {
      e.preventDefault();
      if (HT.panel) { HT.panel = false; haritaPanelCiz(); } else { haritaTamKapat(); }
      return;
    }

    if (e.key === "Tab") {
      const liste = Array.from(kutu.querySelectorAll("button, select, input, textarea, [tabindex='0']"))
        .filter(function (x) { return !x.disabled && x.getClientRects().length; });
      if (!liste.length) { return; }
      const ilk = liste[0], son = liste[liste.length - 1];
      if (!kutu.contains(a) || (e.shiftKey && a === ilk)) { e.preventDefault(); (e.shiftKey ? son : ilk).focus(); }
      else if (!e.shiftKey && a === son) { e.preventDefault(); ilk.focus(); }
      return;
    }

    const yaziyor = a && (a.tagName === "SELECT" || a.tagName === "INPUT" || a.tagName === "TEXTAREA");
    if (yaziyor || e.ctrlKey || e.metaKey || e.altKey) { return; }

    const adim = (e.shiftKey ? 240 : 80) / HT.k;
    if (e.key === "ArrowLeft") { HT.cx -= adim; }
    else if (e.key === "ArrowRight") { HT.cx += adim; }
    else if (e.key === "ArrowUp") { HT.cy -= adim; }
    else if (e.key === "ArrowDown") { HT.cy += adim; }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); haritaGecis(HT.cx, HT.cy, HT.k * 1.6, 260); return; }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); haritaGecis(HT.cx, HT.cy, HT.k / 1.6, 260); return; }
    else if (e.key === "0" || e.key === "Home") { e.preventDefault(); haritaGecis(HT.cx, 50, HT.kMin, 520); return; }
    else if (e.key === "l" || e.key === "L") { e.preventDefault(); HT.panel = !HT.panel; haritaPanelCiz(); return; }
    else { return; }
    e.preventDefault();
    haritaAnimDurdur(); haritaIpucuGizle();
    haritaSinirla(); haritaCizIste();
  }, true);
}

function haritaDuzenAc(ac) {
  HT.duzen = !!ac && haritaYonetici();
  HT.arac = "tasi";
  HT.silOnay = null;
  HT.kutu.querySelector("#htDuzenBtn").classList.toggle("acik", HT.duzen);
  haritaDuzenCubuguCiz();
  haritaBilgiCiz();
  haritaPanelCiz();
  haritaCizHemen();
  if (HT.duzen) { haritaToast("Geliştirici modu açık: yerleri sürükleyebilirsin"); }
}


/** Karakter kartına "yolunu haritada göster" düğmesi (yolu varsa). */
function karakterYoluDugmesi(k) {
  if (!k.yol || !k.yol.length) { return ""; }
  return '<div class="arac-blok"><button type="button" class="dugme dugme-sade" data-harita-yol="' + kacir(k.id) +
         '">Yolunu haritada göster · ' + k.yol.length + " adım</button></div>";
}

/** Bir yerde (şehirde) yaşayan karakterleri gösterir — Hızlı Karakter
    aracıyla "Yaşadığı şehir" seçildiğinde kurulan bağın diğer yönü. */
function haritaYerSakinleri(yer) {
  if (typeof yerGorunenAd !== "function") { return ""; }
  const gorunenAd = yerGorunenAd(yer);
  const sakinler = (veri.karakterler || []).filter(function (k) {
    return k.ozellikler && k.ozellikler.sehir === gorunenAd;
  });

  if (!sakinler.length) { return ""; }

  return '<div class="yapim-liste-mini">' +
      '<span class="oyun-etiket">burada yaşayan karakterler</span>' +
      sakinler.map(function (k) { return '<span class="olay-kisi">' + kacir(k.ad) + "</span>"; }).join("") +
    "</div>";
}

/* ==================== TÖMYE SAATİ ==================== */

let saatZamanlayici = null;

function saatiBaslat() {
  saatiDurdur();
  saatiCiz();
  saatZamanlayici = setInterval(saatiCiz, 1000);
}

function saatiDurdur() {
  if (saatZamanlayici) { clearInterval(saatZamanlayici); saatZamanlayici = null; }
}

function saatiCiz() {
  const el = document.querySelector("#tomyeSaat");
  if (!el) { saatiDurdur(); return; }

  const t = takvimAyar();
  const epok = new Date(t.epokDunya + "T00:00:00Z");
  const gecenSaat = (Date.now() - epok.getTime()) / 3600000;

  if (gecenSaat < 0) { el.textContent = "—"; return; }

  const gunIci = gecenSaat % t.gunSaat;
  const saat = Math.floor(gunIci);
  const dakika = Math.floor((gunIci - saat) * 60);
  const saniye = Math.floor((((gunIci - saat) * 60) - dakika) * 60);

  const iki = function (n) { return String(n).padStart(2, "0"); };

  el.textContent = iki(saat) + ":" + iki(dakika) + ":" + iki(saniye);

  const oran = document.querySelector("#saatOran");
  if (oran) {
    oran.style.width = ((gunIci / t.gunSaat) * 100).toFixed(2) + "%";
  }
}

/* ==================== BASIN KİTİ ==================== */

function basinCiz() {
  const alan = document.querySelector("#basinAlan");
  if (!alan || !veri.basin) { return; }

  const b = veri.basin;

  alan.innerHTML =
    '<p class="basin-tanitim">' + kacir(b.tanitim) + "</p>" +
    '<p class="uzun-metin">' + kacir(b.uzun) + "</p>" +
    '<div class="kunye-izgara">' + b.kunye.map(function (k) {
      return '<div class="kunye-satir"><span>' + kacir(k.alan) + "</span><b>" +
             kacir(k.deger) + "</b></div>";
    }).join("") + "</div>" +
    (b.gorseller && b.gorseller.length
      ? '<div class="galeri-izgara">' + b.gorseller.map(function (g) {
          return '<div class="galeri-kart"><div class="galeri-gorsel">' +
                 '<img src="' + kacir(g) + '" alt="Delilik ekran görüntüsü" loading="lazy">' +
                 "</div></div>";
        }).join("") + "</div>"
      : '<p class="oyun-not">Ekran görüntüleri henüz eklenmedi. ' +
        "veri_ek.py → BASIN → gorseller alanına dosya yollarını yaz.</p>") +
    (b.baglantilar && b.baglantilar.length
      ? '<div class="oyun-sira">' + b.baglantilar.map(function (l) {
          return '<a class="dugme" href="' + kacir(l.url) + '" target="_blank" rel="noopener">' +
                 kacir(l.ad) + "</a>";
        }).join("") + "</div>"
      : "");
}

/* ==================== DEĞİŞİKLİK GÜNLÜĞÜ ==================== */

function degisiklikCiz() {
  const alan = document.querySelector("#degisiklikAlan");
  if (!alan || !veri.degisiklik) { return; }

  alan.innerHTML = '<div class="madde-liste">' + veri.degisiklik.map(function (d, i) {
    return '<div class="madde' + (i === 0 ? " acik" : "") + '">' +
             '<button class="madde-bas">' +
               '<span class="madde-bolum">' + kacir(d.surum) + "</span>" +
               '<span class="madde-baslik">' + kacir(d.tarih) + "</span>" +
               '<span class="madde-ok">›</span>' +
             "</button>" +
             '<div class="madde-govde"><ul class="y-bosluk">' +
               d.maddeler.map(function (m) { return "<li>" + kacir(m) + "</li>"; }).join("") +
             "</ul></div>" +
           "</div>";
  }).join("") + "</div>";
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const r = e.target.closest("[data-roman]");
  if (r) { romanAc(parseInt(r.dataset.roman, 10)); return; }

  if (e.target.closest("[data-harita-ac]")) { haritaTamAc(); return; }
  const yd = e.target.closest("[data-harita-yol]");
  if (yd) {
    if (typeof perdeKapat === "function") { perdeKapat(); }
    haritaTamAc({ yol: yd.getAttribute("data-harita-yol") });
    return;
  }

  const hs = e.target.closest("[data-harita-sec]");
  if (hs) {
    haritaSeciliId = hs.dataset.haritaSec;
    haritaSecili = null;
    haritaCiz();
    return;
  }
});
