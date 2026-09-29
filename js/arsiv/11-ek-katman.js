/* Ek katman — karakter sesleri, gece modu, sözlük, bilinmeyenler,
   rastgele keşif, okuma modu ve alıntı kartı. */

/* ==================== KARAKTER SESLERİ ====================
   Dosyalar "ses/" klasörüne konur, karakterin "ses" alanına yolu yazılır.
   Dosyası olmayan karakterde düğme çıkmaz. */

const SES_ANAHTAR = "tentiforapp_ses";

let calan = null;          // o an çalan Audio
let calanKimlik = null;
let sesKapali = false;

function sesYukle() {
  sesKapali = kayitOku(SES_ANAHTAR) === "kapali";
}

function sesAyarDegistir() {
  sesKapali = !sesKapali;
  kayitYaz(SES_ANAHTAR, sesKapali ? "kapali" : "acik");

  if (sesKapali) { sesDurdur(); ortamDurdur(); }
  sesDugmesiTazele();
}

function sesDurdur() {
  if (!calan) { return; }
  try { calan.pause(); } catch (e) { /* yoksay */ }
  calan = null;
  calanKimlik = null;
  document.querySelectorAll(".ses-btn.calıyor").forEach(function (b) {
    b.classList.remove("calıyor");
  });
}

/** Bir karakterin temasını çalar. Aynı anda tek ses çalar. */
function sesCal(kimlik, yol, dugme) {
  if (sesKapali) { eckaBildir("Sesler kapalı"); return; }

  if (calanKimlik === kimlik) { sesDurdur(); return; }

  sesDurdur();

  const a = new Audio(yol);
  a.volume = (veri.ses && veri.ses.varsayilanSes) || 0.7;

  a.addEventListener("ended", sesDurdur);
  a.addEventListener("error", function () {
    sesDurdur();
    eckaBildir("Ses dosyası bulunamadı");
  });

  const sozu = a.play();
  if (sozu && sozu.catch) { sozu.catch(function () { sesDurdur(); }); }

  calan = a;
  calanKimlik = kimlik;
  if (dugme) { dugme.classList.add("calıyor"); }
}

/** Karakter kartına konulacak çalma düğmesi. Ses yoksa boş döner. */
function sesDugmesi(k) {
  if (!k.ses) { return ""; }
  return '<button class="ses-btn" data-ses="' + kacir(k.id) + '" data-ses-yol="' +
         kacir(k.ses) + '" aria-label="Temayı çal">▶ tema</button>';
}

function sesDugmesiTazele() {
  const b = document.querySelector("#sesAnahtar");
  if (b) { b.textContent = sesKapali ? "sesler kapalı" : "sesler açık"; }
}

/* Ortam sesi — döngüsel, oyunun gece safhasında. Dosya yoksa sessizce atlanır. */
let ortam = null;

function ortamCal(yol) {
  if (sesKapali || !yol || (ortam && ortam.src.indexOf(yol) !== -1)) { return; }
  ortamDurdur();

  const a = new Audio(yol);
  a.loop = true;
  a.volume = 0.25;
  a.addEventListener("error", ortamDurdur);

  const s = a.play();
  if (s && s.catch) { s.catch(function () { ortam = null; }); }
  ortam = a;
}

function ortamDurdur() {
  if (!ortam) { return; }
  try { ortam.pause(); } catch (x) { /* yoksay */ }
  ortam = null;
}

/* ==================== GECE MODU ==================== */

const TEMA_ANAHTAR = "tentiforapp_tema";

/** Kayıtlı tercih yoksa telefonun/bilgisayarın karanlık tema ayarını izler.
    Düğmeyle bir kez seçildiğinde o tercih geçerli olur. */
function temaYukle() {
  const kayitli = kayitOku(TEMA_ANAHTAR);
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const t = kayitli || (mq && mq.matches ? "gece" : "buz");
  document.documentElement.setAttribute("data-ayar-tema", t);
  temaDugmesiTazele();
  if (!kayitli && mq && mq.addEventListener && !temaYukle.dinliyor) {
    temaYukle.dinliyor = true;
    mq.addEventListener("change", function (e) {
      if (kayitOku(TEMA_ANAHTAR)) { return; }
      document.documentElement.setAttribute("data-ayar-tema", e.matches ? "gece" : "buz");
      temaDugmesiTazele();
    });
  }
}

/* ==================== SİTE TEMASI ====================
   Renk temasından bağımsız ikinci katman. Kapalı kutuların şeklini
   değiştirir (kitap, not, taş, mektup...); herhangi bir renk temasıyla
   birlikte kullanılabilir — bkz. yonetici olmayan kullanıcı için
   siteTemaMagazaCiz() (ucuncu.js).

   TABAN vs ETKİN: kullanıcının GERÇEKTEN seçtiği tema (taban) ayrı
   saklanır (localStorage). data-site-tema özniteliği ise ETKİN
   değeri taşır — normalde tabanla aynıdır, ama Oyunbozan + Ruh Virüsü
   Üçlüsü (renk) bir aradaysa Katiller de kendiliğinden katılır ve
   öznitelik "oyunbozan katiller" gibi İKİ token birden taşır (CSS'te
   [data-site-tema~="..."] ile eşleşir). Kullanıcı mağazadan başka bir
   site teması seçtiği anda taban tek değere döner, iki temalı durum
   biter — bu yeniden hesaplama her uygulamada otomatik olur. */
const SITE_TEMA_ANAHTAR = "tentiforapp_site_tema";

function siteTemaUygula() {
  const taban = kayitOku(SITE_TEMA_ANAHTAR) || "yok";
  const renk = document.documentElement.getAttribute("data-ayar-tema") || "buz";
  const etkin = (taban === "oyunbozan" && renk === "uclu") ? "oyunbozan katiller" : taban;
  document.documentElement.setAttribute("data-site-tema", etkin);
}

function siteTemaYukle() {
  siteTemaUygula();
}

function temaDegistir() {
  const simdi = document.documentElement.getAttribute("data-ayar-tema") === "gece" ? "buz" : "gece";
  document.documentElement.setAttribute("data-ayar-tema", simdi);
  kayitYaz(TEMA_ANAHTAR, simdi);
  temaDugmesiTazele();
}

function temaDugmesiTazele() {
  const b = document.querySelector("#temaAnahtar");
  if (!b) { return; }
  b.textContent = document.documentElement.getAttribute("data-ayar-tema") === "gece" ? "☾" : "☀";
}

/* ==================== SÖZLÜK ==================== */

function sozlukCiz() {
  const alan = document.querySelector("#sozlukAlan");
  if (!alan || !veri.sozluk) { return; }

  const liste = veri.sozluk.slice().sort(function (a, b) {
    return a.terim.localeCompare(b.terim, "tr");
  });

  alan.innerHTML =
    '<input class="kod-giris arac-giris" id="sozlukGiris" placeholder="terim ara" ' +
      'autocomplete="off">' +
    '<dl class="sozluk-liste" id="sozlukListe">' +
      liste.map(function (s) {
        return '<div class="sozluk-madde" data-terim="' +
                 kacir(s.terim.toLocaleLowerCase("tr")) + '">' +
                 "<dt>" + kacir(s.terim) + "</dt>" +
                 "<dd>" + kacir(s.tanim) + "</dd>" +
               "</div>";
      }).join("") +
    "</dl>";
}

function sozlukSuz(sorgu) {
  const q = String(sorgu).trim().toLocaleLowerCase("tr");

  document.querySelectorAll(".sozluk-madde").forEach(function (m) {
    const gorunur = !q || m.dataset.terim.indexOf(q) !== -1 ||
                    m.textContent.toLocaleLowerCase("tr").indexOf(q) !== -1;
    m.style.display = gorunur ? "" : "none";
  });
}

/* ==================== BİLİNMEYENLER ==================== */

function bilinmeyenCiz() {
  const alan = document.querySelector("#bilinmeyenAlan");
  if (!alan || !veri.bilinmeyenler) { return; }

  alan.innerHTML =
    '<p class="oyun-giris">Evren hâlâ yazılıyor. Bunlar henüz cevabı olmayan sorular — ' +
    "bir gün buraya cevap gelecek.</p>" +
    '<div class="bilinmeyen-liste">' +
      veri.bilinmeyenler.map(function (b) {
        return '<div class="bilinmeyen">' +
                 '<div class="bilinmeyen-soru">' + kacir(b.soru) + "</div>" +
                 '<div class="bilinmeyen-not">' + kacir(b.not) + "</div>" +
               "</div>";
      }).join("") +
    "</div>";
}

/* ==================== RASTGELE KEŞİF ==================== */

function rastgeleKesif() {
  if (typeof istArtir === "function") { istArtir("rastgele"); gorevIlerle("rastgele2"); }
  /* Açma işini adres yönlendirmesine bırakıyoruz; tek bir mekanizma olsun. */
  const hedefler = [];

  if (bolumErisimi("arsiv")) { (veri.karakterler || []).forEach(function (k) { hedefler.push({ tur: "karakter", id: k.id }); }); }
  if (bolumErisimi("evren")) { (veri.evren || []).forEach(function (e) { hedefler.push({ tur: "evren", id: e.id }); }); }

  if (!hedefler.length) { eckaBildir("Rastgele keşif için önce bir kod gir"); return; }

  const secim = hedefler[Math.floor(Math.random() * hedefler.length)];
  const hedefHash = "#/" + secim.tur + "/" + secim.id;

  if (rota() === hedefHash) {
    baglantiyiUygula();
  } else {
    location.hash = hedefHash;
  }

  /* Karakter seçilirse bir pencere açılır, o zaten görünürdür. Ama evren
     maddeleri sayfa içinde satır olarak açılır — kart görünene kadar kısa
     bir bekleyip kendimiz kaydırıyoruz. hashchange zincirinin bunu her
     zaman yapacağına güvenmek kırılgan çıktı: doğrudan tıklamada çalışıyor
     ama location.hash atamasıyla tetiklenince atlanabiliyordu. */
  if (secim.tur === "evren") {
    setTimeout(function () {
      const i = (veri.evren || []).findIndex(function (e) { return e.id === secim.id; });
      const el = document.querySelector('[data-madde="' + i + '"]');
      if (el && el.scrollIntoView) { el.scrollIntoView({ block: "center", behavior: "smooth" }); }
    }, 100);
  }
}

/* ==================== OKUMA MODU ==================== */

const OKUMA_ANAHTAR = "tentiforapp_okuma";

let okumaBoyut = 2;   // 1 küçük, 2 normal, 3 büyük

function okumaYukle() {
  const d = parseInt(kayitOku(OKUMA_ANAHTAR), 10);
  if (d >= 1 && d <= 3) { okumaBoyut = d; }
  okumaUygula();
}

function okumaBoyutDegistir(yon) {
  okumaBoyut = Math.min(3, Math.max(1, okumaBoyut + yon));
  kayitYaz(OKUMA_ANAHTAR, String(okumaBoyut));
  okumaUygula();
}

function okumaUygula() {
  document.documentElement.setAttribute("data-ayar-okuma", String(okumaBoyut));
}

/** Roman penceresine yazı boyutu denetimi ekler. */
function okumaDenetimi() {
  return '<div class="okuma-denetim">' +
           '<button class="okuma-btn" data-okuma="-1" aria-label="Yazıyı küçült">A−</button>' +
           '<button class="okuma-btn" data-okuma="1" aria-label="Yazıyı büyüt">A+</button>' +
         "</div>";
}

/* ==================== ALINTI KARTI ==================== */

function alintiKarti(metin, kim) {
  const en = 1080;
  const tuval = document.createElement("canvas");
  tuval.width = en;
  tuval.height = en;

  const c = tuval.getContext ? tuval.getContext("2d") : null;

  if (!c) { return null; }   /* canvas desteklenmiyor */

  c.fillStyle = "#F4F9FD";
  c.fillRect(0, 0, en, en);

  const g = c.createLinearGradient(0, en * 0.66, 0, en);
  g.addColorStop(0, "#DFEDF8");
  g.addColorStop(1, "#B8D6EC");
  c.fillStyle = g;
  c.fillRect(0, en * 0.66, en, en * 0.34);

  c.strokeStyle = "rgba(28,92,150,.35)";
  c.lineWidth = 3;
  [[180, en, 320, en * 0.66], [640, en * 0.66, 560, en], [880, en, 960, en * 0.66]]
    .forEach(function (p) {
      c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); c.stroke();
    });

  c.fillStyle = "#1C5C96";
  c.fillRect(120, 150, 6, 90);

  /* metin sarma */
  c.fillStyle = "#0A0F14";
  c.font = "600 60px Georgia, serif";
  const kelimeler = String(metin).split(/\s+/);
  const satirlar = [];
  let satir = "";

  kelimeler.forEach(function (k) {
    const deneme = satir ? satir + " " + k : k;
    if (c.measureText(deneme).width > en - 280 && satir) {
      satirlar.push(satir);
      satir = k;
    } else {
      satir = deneme;
    }
  });
  if (satir) { satirlar.push(satir); }

  let y = 300;
  satirlar.slice(0, 7).forEach(function (s) {
    c.fillText(s, 140, y);
    y += 84;
  });

  c.fillStyle = "#3D4A57";
  c.font = "30px Georgia, serif";
  c.fillText("— " + kim, 140, y + 30);

  c.fillStyle = "#0D3560";
  c.font = "26px monospace";
  c.fillText("TENTIFORAPP", 140, en - 70);

  return tuval;
}

function alintiPaylas(indeks) {
  const a = (veri.alintilar || [])[indeks];
  if (!a) { return; }

  const tuval = alintiKarti(a.metin, a.kim);

  if (!tuval) { eckaBildir("Tarayıcı görsel üretmeyi desteklemiyor"); return; }

  tuval.toBlob(function (blob) {
    if (!blob) { eckaBildir("Kart üretilemedi"); return; }

    const url = URL.createObjectURL(blob);
    const bag = document.createElement("a");
    bag.href = url;
    bag.download = "tentifor-alinti.png";
    document.body.appendChild(bag);
    bag.click();
    document.body.removeChild(bag);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    eckaBildir("Alıntı kartı indirildi");
  }, "image/png");
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const s = e.target.closest("[data-ses]");
  if (s) { sesCal(s.dataset.ses, s.dataset.sesYol, s); return; }

  if (e.target.closest("#sesAnahtar")) { sesAyarDegistir(); return; }
  if (e.target.closest("#temaAnahtar")) { temaDegistir(); return; }
  if (e.target.closest("#rastgeleBtn") || e.target.closest("#rastgeleHero")) {
    rastgeleKesif();
    return;
  }

  const o = e.target.closest("button[data-okuma]");
  if (o) { okumaBoyutDegistir(parseInt(o.dataset.okuma, 10)); return; }

  const ap = e.target.closest("[data-alinti-paylas]");
  if (ap) { alintiPaylas(parseInt(ap.dataset.alintiPaylas, 10)); }
});

document.addEventListener("input", function (e) {
  if (e.target.id === "sozlukGiris") { sozlukSuz(e.target.value); }
});
