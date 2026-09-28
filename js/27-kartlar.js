/* Paylaşılabilir görsel kartlar — Kyldo yazısıyla isim kartı ve arşivci kartı.

   İkisi de tarayıcıda canvas ile çizilir; sunucu yok. Telefonda sistemin
   paylaşım menüsü açılır (WhatsApp, Instagram...), desteklenmiyorsa PNG iner.
   Kyldo heceleri 10-kyldo-yazisi.js'teki aynı veriyle (veri.alfabe) çizilir. */

const KART_EN = 1080, KART_BOY = 1350;         /* 4:5 — Instagram gönderisine uyar */
const KART_RENK = {
  kar: "#F4F9FD", buz: "#DFEDF8", sig: "#B8D6EC", deniz: "#1C5C96",
  yarik: "#0D3560", murekkep: "#0A0F14", murekkep2: "#3D4A57"
};
/* kartın altına yazılan adres: sitenin açıldığı alan adı (taşınınca kendiliğinden değişir) */
const KART_ADRES = (typeof location !== "undefined" && location.protocol === "https:" && location.host) || "tentiforapp.pages.dev";

/** Sitenin yazı tipleri canvas'ta da kullanılsın; yüklenemezse yedeklerle devam eder. */
function kartFontlariHazir() {
  if (!document.fonts || !document.fonts.load) { return Promise.resolve(); }
  return Promise.all([
    document.fonts.load('400 80px "Bodoni Moda"'),
    document.fonts.load('italic 400 40px "EB Garamond"'),
    document.fonts.load('400 28px "EB Garamond"'),
    document.fonts.load('500 26px "DM Mono"')
  ]).catch(function () { /* çevrimdışı: Georgia/monospace */ });
}

const KART_FONT = {
  baslik: function (px) { return "400 " + px + 'px "Bodoni Moda", Georgia, serif'; },
  yazi: function (px, italik) { return (italik ? "italic " : "") + "400 " + px + 'px "EB Garamond", Georgia, serif'; },
  mono: function (px, kalin) { return (kalin ? "500 " : "400 ") + px + 'px "DM Mono", ui-monospace, monospace'; }
};

/** Sitenin hero'su gibi: kar zemin, altta buz tabakası ve çatlaklar. */
function kartZemin(c, en, boy) {
  c.fillStyle = KART_RENK.kar;
  c.fillRect(0, 0, en, boy);

  const ust = boy * 0.72;
  const g = c.createLinearGradient(0, ust, 0, boy);
  g.addColorStop(0, KART_RENK.buz);
  g.addColorStop(1, KART_RENK.sig);
  c.fillStyle = g;
  c.fillRect(0, ust, en, boy - ust);

  c.strokeStyle = KART_RENK.sig;
  c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, ust); c.lineTo(en, ust); c.stroke();

  c.strokeStyle = "rgba(28,92,150,.28)";
  c.lineWidth = 3;
  [[0.18, 1, 0.3, 0], [0.62, 0, 0.53, 1], [0.84, 1, 0.92, 0]].forEach(function (p) {
    c.beginPath();
    c.moveTo(en * p[0], p[1] ? boy : ust);
    c.lineTo(en * p[2], p[3] ? boy : ust);
    c.stroke();
  });
}

/** Metni verilen genişliğe sarar, satırları döner. */
function kartSar(c, metin, genislik) {
  const satirlar = [];
  let satir = "";
  String(metin || "").split(/\s+/).filter(Boolean).forEach(function (k) {
    const d = satir ? satir + " " + k : k;
    if (c.measureText(d).width > genislik && satir) { satirlar.push(satir); satir = k; } else { satir = d; }
  });
  if (satir) { satirlar.push(satir); }
  return satirlar;
}

/** Aralıklı büyük harf etiket (sitedeki .etiket gibi). */
function kartEtiket(c, metin, x, y, renk, px) {
  c.fillStyle = renk || KART_RENK.deniz;
  c.font = KART_FONT.mono(px || 24, true);
  let cx = x;
  const aralik = (px || 24) * 0.22;
  Array.from(String(metin).toLocaleUpperCase("tr")).forEach(function (h) {
    c.fillText(h, cx, y);
    cx += c.measureText(h).width + aralik;
  });
}

/* ---------- Kyldo hecesini canvas'a çizmek ---------- */

function kyldoHeceCiz(c, hece, x, y, b, renk) {
  const a = veri.alfabe;
  if (!a) { return; }
  const kenar = b * 0.16, ic = b - kenar * 2;
  const ol = function (d) { return kenar + d * ic; };

  c.save();
  c.translate(x, y);
  c.strokeStyle = renk || KART_RENK.murekkep;
  c.lineCap = "round";

  if (hece.unsuz && a.unsuzler && a.unsuzler[hece.unsuz]) {
    c.lineWidth = Math.max(2, b * 0.075);
    a.unsuzler[hece.unsuz].forEach(function (ad) {
      const p = PARCA_YERI[ad];
      if (!p) { return; }
      c.beginPath(); c.moveTo(ol(p[0]), ol(p[1])); c.lineTo(ol(p[2]), ol(p[3])); c.stroke();
    });
  }

  if (hece.unlu && a.unluler && a.unluler[hece.unlu]) {
    c.lineWidth = Math.max(2, b * 0.055);
    c.strokeStyle = KART_RENK.deniz;
    a.unluler[hece.unlu].forEach(function (ad) {
      const h = HUCRE_YERI[ad];
      if (!h) { return; }
      const cx = ol(h[0]), cy = ol(h[1]), r = ic * 0.10;
      c.beginPath(); c.moveTo(cx - r, cy - r); c.lineTo(cx + r, cy + r);
      c.moveTo(cx - r, cy + r); c.lineTo(cx + r, cy - r); c.stroke();
    });
  }
  c.restore();
}

/** Bir kelimeyi ortalayarak çizer; sığmazsa hece boyunu küçültür, gerekirse iki satıra böler. */
function kyldoSatirCiz(c, kelime, merkezX, y, enFazlaGen, boyut) {
  const heceler = heceleraAyir(kelime);
  if (!heceler.length) { return y; }

  const bosluk = 0.12;
  let b = boyut;
  const gen = function (n, bb) { return n * bb + (n - 1) * bb * bosluk; };
  while (gen(heceler.length, b) > enFazlaGen && b > boyut * 0.55) { b -= 4; }

  const satirlar = [];
  if (gen(heceler.length, b) > enFazlaGen) {
    const yari = Math.ceil(heceler.length / 2);
    satirlar.push(heceler.slice(0, yari), heceler.slice(yari));
  } else {
    satirlar.push(heceler);
  }

  satirlar.forEach(function (s) {
    let x = merkezX - gen(s.length, b) / 2;
    s.forEach(function (h) { kyldoHeceCiz(c, h, x, y, b); x += b * (1 + bosluk); });
    y += b * 1.15;
  });
  return y;
}

/* ---------- paylaş / indir ---------- */

function kartBlob(tuval) {
  return new Promise(function (coz) { tuval.toBlob(coz, "image/png"); });
}

function kartIndir(blob, dosyaAdi) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
}

function kartPaylasilabilir() {
  try {
    const f = new File([new Blob(["x"], { type: "image/png" })], "x.png", { type: "image/png" });
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] }));
  } catch (_) { return false; }
}

/** Telefonda paylaşım menüsü; olmazsa indirir. Durum metni döner. */
async function kartPaylas(tuval, dosyaAdi, metin) {
  const blob = await kartBlob(tuval);
  if (!blob) { return "Kart üretilemedi"; }

  if (kartPaylasilabilir()) {
    try {
      await navigator.share({
        files: [new File([blob], dosyaAdi, { type: "image/png" })],
        text: metin + " — " + KART_ADRES
      });
      return "Paylaşıldı";
    } catch (e) {
      if (e && e.name === "AbortError") { return ""; }   /* kullanıcı vazgeçti */
    }
  }
  kartIndir(blob, dosyaAdi);
  return "İndirildi";
}

/** Önizleme: canvas'ı alanın içine küçültülmüş hâlde koyar. */
function kartOnizle(alan, tuval) {
  if (!alan) { return; }
  tuval.className = "kart-onizleme-tuval";
  tuval.setAttribute("role", "img");
  alan.innerHTML = "";
  alan.appendChild(tuval);
}

/* ==================== İSİM KARTI ==================== */

let isimKartAd = "";
let isimKartYol = 0;        /* isimUret()'in hangi yolu */
let isimKartTuval = null;
let isimKartSayac = 0;      /* hızlı yazarken eski çizimin yenisini ezmemesi için */

function isimKartTarih() {
  try { return dunyadanTomyeye(new Date()); } catch (_) { return null; }
}

async function isimKartUret(ad, yol) {
  await kartFontlariHazir();
  const secenekler = isimUret(ad);
  const s = secenekler[yol] || secenekler[0];
  if (!s) { return null; }
  const tentifor = s.sonuc;

  const t = document.createElement("canvas");
  t.width = KART_EN; t.height = KART_BOY;
  const c = t.getContext && t.getContext("2d");
  if (!c) { return null; }

  kartZemin(c, KART_EN, KART_BOY);
  const sol = 110, orta = KART_EN / 2;

  c.fillStyle = KART_RENK.deniz;
  c.fillRect(sol, 118, 6, 64);
  kartEtiket(c, "Tömye kimliği", sol + 26, 162, KART_RENK.murekkep2, 24);
  kartEtiket(c, "24. Evren", KART_EN - sol - 190, 162, KART_RENK.deniz, 22);

  /* Kyldo yazısıyla isim */
  const altY = kyldoSatirCiz(c, tentifor, orta, 320, KART_EN - sol * 2, 150);

  /* Tentifor adı */
  c.textAlign = "center";
  c.fillStyle = KART_RENK.murekkep;
  let px = 128;
  c.font = KART_FONT.baslik(px);
  while (c.measureText(tentifor).width > KART_EN - sol * 2 && px > 60) { px -= 6; c.font = KART_FONT.baslik(px); }
  const adY = altY + px * 0.95 + 30;
  c.fillText(tentifor, orta, adY);

  c.font = KART_FONT.yazi(40, true);
  c.fillStyle = KART_RENK.deniz;
  c.fillText(basHarf(String(ad).trim().toLocaleLowerCase("tr")) + " · " + s.yol, orta, adY + 70);

  /* Hecelerin okunuşu */
  const heceler = heceleraAyir(tentifor).map(function (h) { return (h.unsuz || "") + (h.unlu || ""); });
  c.font = KART_FONT.mono(26);
  c.fillStyle = KART_RENK.murekkep2;
  c.fillText(heceler.join(" · "), orta, adY + 124);

  /* Tömye tarihi — buz tabakasının üstünde */
  const d = isimKartTarih();
  const buzY = KART_BOY * 0.72;
  c.textAlign = "left";
  kartEtiket(c, "Arşive kayıt", sol, buzY + 92, KART_RENK.yarik, 22);
  c.fillStyle = KART_RENK.murekkep;
  c.font = KART_FONT.baslik(52);
  c.fillText(d ? d.gun + " " + d.ay + " " + d.yil : "—", sol, buzY + 160);
  c.font = KART_FONT.yazi(30, true);
  c.fillStyle = KART_RENK.murekkep2;
  c.fillText(d ? d.haftaGunu + " · " + d.ayKoken + " ayı · " + String(d.saat).padStart(2, "0") + ". saat" : "", sol, buzY + 206);

  kartEtiket(c, "TentiforApp · " + KART_ADRES, sol, KART_BOY - 70, KART_RENK.yarik, 20);
  c.textAlign = "left";
  return t;
}

function isimKartCiz() {
  const alan = document.querySelector("#isimKartAlan");
  if (!alan || !veri.alfabe) { return; }

  const secenekler = isimKartAd.trim() ? isimUret(isimKartAd) : [];
  /* yazı kutusu bir kez çizilir; yazarken yalnızca altı yenilenir (telefonda klavye kapanmasın) */
  if (!alan.querySelector("#isimKartGiris")) {
    alan.innerHTML =
      '<p class="oyun-not">Adını yaz: isim sistemiyle Tentiforverse adın çıkar, Kyldo yazısıyla yazılır ' +
        "ve bugünün Tömye tarihiyle kartın hazırlanır.</p>" +
      '<input class="kod-giris arac-giris" id="isimKartGiris" maxlength="24" autocomplete="off" spellcheck="false" ' +
        'aria-label="Adın" placeholder="adın" value="' + kacir(isimKartAd) + '">' +
      '<div id="isimKartDegisen"></div>';
  }
  const degisen = alan.querySelector("#isimKartDegisen");
  degisen.innerHTML =
    (secenekler.length
      ? '<div class="filtre isim-kart-yol">' + secenekler.map(function (s, i) {
          return '<button class="' + (i === isimKartYol ? "secili" : "") + '" data-isim-kart-yol="' + i + '">' +
                 kacir(s.sonuc) + '<span class="isim-kart-yol-ad">' + kacir(s.yol) + "</span></button>";
        }).join("") + "</div>"
      : "") +
    '<div class="kart-onizleme" id="isimKartOnizleme"></div>' +
    (secenekler.length
      ? '<div class="oyun-sira">' +
          '<button class="dugme" data-isim-kart="paylas">' + (kartPaylasilabilir() ? "Paylaş" : "Kartı indir") + "</button>" +
          (kartPaylasilabilir() ? '<button class="dugme dugme-sade" data-isim-kart="indir">İndir</button>' : "") +
        "</div>"
      : "") +
    '<p class="pencere-durum" id="isimKartDurum"></p>';

  isimKartOnizlemeTazele();
}

async function isimKartOnizlemeTazele() {
  const kutu = document.querySelector("#isimKartOnizleme");
  if (!kutu) { return; }
  if (!isimKartAd.trim()) { isimKartTuval = null; kutu.innerHTML = ""; kutu.hidden = true; return; }

  const bu = ++isimKartSayac;
  const t = await isimKartUret(isimKartAd, isimKartYol);
  if (bu !== isimKartSayac || !t) { return; }
  isimKartTuval = t;
  kutu.hidden = false;
  kartOnizle(kutu, t);
  t.setAttribute("aria-label", "İsim kartı önizlemesi");
}

async function isimKartDisari(tur) {
  if (!isimKartTuval) { return; }
  const ad = (isimUret(isimKartAd)[isimKartYol] || {}).sonuc || "isim";
  const dosya = "tomye-" + trNormal(ad).replace(/[^a-z0-9]+/g, "") + ".png";
  const d = document.querySelector("#isimKartDurum");
  let sonuc;
  if (tur === "indir") { kartIndir(await kartBlob(isimKartTuval), dosya); sonuc = "İndirildi"; }
  else { sonuc = await kartPaylas(isimKartTuval, dosya, "Tömye'deki adım: " + ad); }
  if (d) { d.textContent = sonuc; d.className = "pencere-durum iyi"; }
}

let isimKartZaman = 0;
document.addEventListener("input", function (e) {
  if (e.target.id !== "isimKartGiris") { return; }
  const oncekiBos = !isimKartAd.trim();
  isimKartAd = e.target.value;
  isimKartYol = 0;
  /* seçenek düğmeleri değişsin ama yazılan kutu odağını kaybetmesin */
  clearTimeout(isimKartZaman);
  isimKartZaman = setTimeout(isimKartCiz, oncekiBos ? 0 : 220);
});

document.addEventListener("click", function (e) {
  const y = e.target.closest("[data-isim-kart-yol]");
  if (y) {
    isimKartYol = parseInt(y.dataset.isimKartYol, 10) || 0;
    document.querySelectorAll("[data-isim-kart-yol]").forEach(function (b) { b.classList.toggle("secili", b === y); });
    isimKartOnizlemeTazele();
    return;
  }
  const d = e.target.closest("[data-isim-kart]");
  if (d) { isimKartDisari(d.dataset.isimKart); }
});

/* ==================== ARŞİVCİ KARTI ==================== */

function arsivciMadalyalari() {
  const sahip = jsonOku(typeof MADALYA_ANAHTAR !== "undefined" ? MADALYA_ANAHTAR : "tentiforapp_madalya", []) || [];
  return (veri.madalyalar || []).filter(function (m) { return sahip.indexOf(m.id) !== -1; });
}

async function arsivciKartUret() {
  await kartFontlariHazir();
  const o = arsivciOlculeri();
  const rol = arsivciRol();
  const kis = arsivciKisilik();
  const tam = (typeof tamlikHesapla === "function") ? tamlikHesapla() : null;
  const madalyalar = arsivciMadalyalari();

  const t = document.createElement("canvas");
  t.width = KART_EN; t.height = KART_BOY;
  const c = t.getContext && t.getContext("2d");
  if (!c) { return null; }

  kartZemin(c, KART_EN, KART_BOY);
  const sol = 110, sag = KART_EN - 110, gen = sag - sol;

  c.fillStyle = KART_RENK.deniz;
  c.fillRect(sol, 118, 6, 64);
  kartEtiket(c, "Arşivci kartı", sol + 26, 162, KART_RENK.murekkep2, 24);

  /* tamlık halkası sağ üstte */
  if (tam) {
    const hx = sag - 80, hy = 150, r = 62;
    c.lineWidth = 12;
    c.strokeStyle = KART_RENK.buz;
    c.beginPath(); c.arc(hx, hy, r, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = KART_RENK.deniz;
    c.lineCap = "round";
    c.beginPath(); c.arc(hx, hy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, tam.yuzde / 100)); c.stroke();
    c.lineCap = "butt";
    c.fillStyle = KART_RENK.murekkep;
    c.font = KART_FONT.mono(30, true);
    c.textAlign = "center";
    c.fillText("%" + tam.yuzde, hx, hy + 11);
    c.font = KART_FONT.mono(17);
    c.fillStyle = KART_RENK.murekkep2;
    c.fillText("TAMLIK", hx, hy + r + 38);
    c.textAlign = "left";
  }

  /* rol ve kişilik */
  c.fillStyle = KART_RENK.murekkep;
  let px = 96;
  c.font = KART_FONT.baslik(px);
  while (c.measureText(rol.ad).width > gen - 170 && px > 54) { px -= 4; c.font = KART_FONT.baslik(px); }
  c.fillText(rol.ad, sol, 330);

  c.font = KART_FONT.yazi(34, true);
  c.fillStyle = KART_RENK.murekkep2;
  let y = 385;
  kartSar(c, rol.not || "", gen).slice(0, 2).forEach(function (s) { c.fillText(s, sol, y); y += 44; });

  y += 40;
  kartEtiket(c, "Kişilik", sol, y, KART_RENK.deniz, 22);
  c.fillStyle = KART_RENK.yarik;
  c.font = KART_FONT.baslik(56);
  c.fillText(kis.ad, sol, y + 66);
  c.font = KART_FONT.yazi(30);
  c.fillStyle = KART_RENK.murekkep2;
  y += 112;
  kartSar(c, kis.not || "", gen).slice(0, 2).forEach(function (s) { c.fillText(s, sol, y); y += 40; });

  /* ilerleme çubukları (tamlığın parçaları) */
  if (tam && tam.parcalar) {
    y += 30;
    kartEtiket(c, "İlerleme", sol, y, KART_RENK.deniz, 22);
    y += 20;
    tam.parcalar.slice(0, 5).forEach(function (p) {
      const oran = Math.max(0, Math.min(1, p.oran || 0));
      c.font = KART_FONT.mono(20);
      c.fillStyle = KART_RENK.murekkep2;
      c.fillText(p.ad, sol, y + 22);
      c.textAlign = "right";
      c.fillText("%" + Math.round(oran * 100), sag, y + 22);
      c.textAlign = "left";
      const bx = sol + 330, bw = gen - 330 - 80;
      c.fillStyle = KART_RENK.buz;
      c.fillRect(bx, y + 10, bw, 12);
      c.fillStyle = KART_RENK.deniz;
      c.fillRect(bx, y + 10, Math.max(oran ? 4 : 0, bw * oran), 12);
      y += 34;
    });
  }

  /* madalyalar */
  if (madalyalar.length) {
    y += 26;
    kartEtiket(c, "Madalyalar · " + madalyalar.length, sol, y, KART_RENK.deniz, 22);
    y += 22;
    c.font = KART_FONT.mono(22);
    let x = sol;
    madalyalar.slice(0, 8).forEach(function (m) {
      const ad = String(m.ad || m.id);
      const w = c.measureText(ad).width + 36;
      if (x + w > sag) { x = sol; y += 58; }
      if (y + 44 > KART_BOY * 0.72 - 16) { return; }
      c.strokeStyle = KART_RENK.sig; c.lineWidth = 2;
      c.fillStyle = "#FFFFFF";
      c.fillRect(x, y, w, 44); c.strokeRect(x, y, w, 44);
      c.fillStyle = KART_RENK.yarik;
      c.fillText(ad, x + 18, y + 30);
      x += w + 12;
    });
  }

  /* ölçüler — buz tabakasında */
  const buzY = KART_BOY * 0.72;
  const olculer = [
    ["oyun", o.oyun + "/" + o.oyunToplam], ["katman", o.katman + "/" + o.katmanToplam],
    ["galeri", o.galeri + "/" + o.galeriToplam], ["gün", String(o.gun)], ["kayıt", String(o.kayit)]
  ];
  const kolon = gen / olculer.length;
  olculer.forEach(function (p, i) {
    const x = sol + i * kolon;
    c.fillStyle = KART_RENK.murekkep;
    c.font = KART_FONT.baslik(58);
    c.fillText(p[1], x, buzY + 130);
    kartEtiket(c, p[0], x, buzY + 172, KART_RENK.yarik, 20);
  });

  const d = (typeof dunyadanTomyeye === "function") ? dunyadanTomyeye(new Date()) : null;
  kartEtiket(c, "TentiforApp · " + KART_ADRES, sol, KART_BOY - 70, KART_RENK.yarik, 20);
  if (d) {
    c.font = KART_FONT.yazi(26, true);
    c.fillStyle = KART_RENK.murekkep2;
    c.textAlign = "right";
    c.fillText(d.gun + " " + d.ay + " " + d.yil, sag, KART_BOY - 70);
    c.textAlign = "left";
  }
  return t;
}

/** 13-dalga-3.js'teki arşivci kartı düğmesi buraya gelir. */
async function arsivciKartDisari(tur) {
  const durum = document.querySelector("#arsivciDurum");
  const t = await arsivciKartUret();
  if (!t) {
    if (durum) { durum.textContent = "Tarayıcı görsel üretmeyi desteklemiyor"; durum.className = "pencere-durum kotu"; }
    return;
  }
  let sonuc;
  if (tur === "indir") { kartIndir(await kartBlob(t), "tentifor-arsivci.png"); sonuc = "İndirildi"; }
  else { sonuc = await kartPaylas(t, "tentifor-arsivci.png", "Arşivci kartım: " + arsivciRol().ad); }
  if (durum) { durum.textContent = sonuc; durum.className = "pencere-durum iyi"; }
}

async function arsivciKartOnizle() {
  const kutu = document.querySelector("#arsivciOnizleme");
  if (!kutu) { return; }
  const t = await arsivciKartUret();
  if (t) { kartOnizle(kutu, t); t.setAttribute("aria-label", "Arşivci kartı önizlemesi"); kutu.hidden = false; }
}
