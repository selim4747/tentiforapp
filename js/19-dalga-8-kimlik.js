/* Sekizinci dalga — Kimlik Sınavı: geniş kanon, oynayış temelli kişilik testi.
   Üç aşama: tepki oyunu, kaynak dağıtımı, ikilem soruları. Sadece cevap değil,
   nasıl oynadığın da puanlıyor. */

let KS = null;   /* { asama, tehlike:{...}, kaynak:{...}, sorular:{...}, puan:{} } */

function kimlikVeri() { return veri.kimlikTest; }

function kimlikBaslat() {
  KS = {
    asama: "giris",
    tehlike: { indeks: 0, kayit: [] },       /* {hizli, saldir} */
    kaynak: { dagitim: {} },
    soruIndeks: 0,
    puan: {},
  };

  (kimlikVeri().kaynak.basliklar || []).forEach(function (b) { KS.kaynak.dagitim[b.id] = 0; });

  kimlikCiz();
}

function kimlikPuanEkle(id, miktar) {
  if (!id) { return; }
  KS.puan[id] = (KS.puan[id] || 0) + miktar;
}

/* ---------- Aşama 1: Tehlike Anı ---------- */

let tehlikeZaman = null;

function tehlikeBaslat() {
  KS.asama = "tehlike";
  KS.tehlike.baslangic = Date.now();
  tehlikeZaman = KS.tehlike.baslangic;
  kimlikCiz();
}

function tehlikeCevap(secim) {
  if (!KS || KS.asama !== "tehlike") { return; }

  const gecen = Date.now() - tehlikeZaman;
  const sure = kimlikVeri().tehlike.sure_ms;
  const hizli = gecen < sure * 0.45;

  KS.tehlike.kayit.push({ secim: secim, hizli: hizli, gecen: gecen });
  KS.tehlike.indeks++;

  if (KS.tehlike.indeks >= kimlikVeri().tehlike.kartlar.length) {
    tehlikeSonucla();
    KS.asama = "kaynak";
  } else {
    tehlikeZaman = Date.now();
  }

  kimlikCiz();
}

function tehlikeSureAsimi() {
  /* süre dolunca kaçış sayılır ve yavaş işaretlenir */
  tehlikeCevap("kac");
}

function tehlikeSonucla() {
  const kayit = KS.tehlike.kayit;
  const saldirOran = kayit.filter(function (k) { return k.secim === "saldir"; }).length / kayit.length;
  const hizliOran = kayit.filter(function (k) { return k.hizli; }).length / kayit.length;

  const t = kimlikVeri().tehlike;
  const anahtar = (hizliOran >= 0.5 ? "hizli" : "yavas") + "-" + (saldirOran >= 0.5 ? "saldir" : "kac");
  const egilim = t[anahtar];

  if (egilim) { kimlikPuanEkle(egilim.id, 3); }
  KS.tehlikeSonuc = egilim;
}

/* ---------- Aşama 2: Kaynak Dağıtımı ---------- */

function kaynakDegistir(id, delta) {
  if (!KS || KS.asama !== "kaynak") { return; }

  const yeni = KS.kaynak.dagitim[id] + delta;
  const toplamSimdi = Object.values(KS.kaynak.dagitim).reduce(function (a, b) { return a + b; }, 0);

  if (yeni < 0) { return; }
  if (delta > 0 && toplamSimdi >= kimlikVeri().kaynak.toplam) { return; }

  KS.kaynak.dagitim[id] = yeni;
  kimlikCiz();
}

function kaynakDevamEt() {
  const toplam = Object.values(KS.kaynak.dagitim).reduce(function (a, b) { return a + b; }, 0);
  if (toplam < kimlikVeri().kaynak.toplam) {
    eckaBildir("Önce " + kimlikVeri().kaynak.toplam + " puanı dağıt");
    return;
  }

  let baskinId = null, baskinDeger = -1;
  Object.keys(KS.kaynak.dagitim).forEach(function (id) {
    if (KS.kaynak.dagitim[id] > baskinDeger) { baskinDeger = KS.kaynak.dagitim[id]; baskinId = id; }
  });

  const egilim = kimlikVeri().kaynak.baskin[baskinId];
  if (egilim) { kimlikPuanEkle(egilim.id, 3); }
  KS.kaynakSonuc = egilim;

  KS.asama = "sorular";
  kimlikCiz();
}

/* ---------- Aşama 3: Sorular ---------- */

function kimlikSoruCevap(secenekIndeks) {
  const sorular = kimlikVeri().sorular;
  const s = sorular[KS.soruIndeks];
  const sec = s.secenekler[secenekIndeks];

  Object.keys(sec.puan || {}).forEach(function (id) { kimlikPuanEkle(id, sec.puan[id]); });

  KS.soruIndeks++;

  if (KS.soruIndeks >= sorular.length) {
    KS.asama = "sonuc";
  }

  kimlikCiz();
}

/* ---------- sonuç ---------- */

function kimlikSonucBul() {
  let enIyi = null, enYuksek = -1;
  Object.keys(KS.puan).forEach(function (id) {
    if (KS.puan[id] > enYuksek) { enYuksek = KS.puan[id]; enIyi = id; }
  });
  return enIyi;
}

function kimlikTekrarla() { kimlikBaslat(); }

/* ---------- çizim ---------- */

function kimlikCiz() {
  const alan = document.querySelector("#kimlikAlan");
  if (!alan) { return; }

  const k = kimlikVeri();

  if (!KS) {
    alan.innerHTML =
      '<p class="oyun-giris">' + kacir(k.giris) + "</p>" +
      '<p class="oyun-not">Üç aşama: bir tepki oyunu, bir kaynak dağıtımı, birkaç ikilem. ' +
      "Toplam iki dakika sürer.</p>" +
      '<button class="dugme" data-kimlik="basla">' + kacir(k.baslik) + "</button>" +
      (KS_SONUC_KAYITLI() ? kimlikGecmisOzet() : "");
    return;
  }

  if (KS.asama === "giris") { tehlikeBaslat(); return; }
  if (KS.asama === "tehlike") { alan.innerHTML = tehlikeEkrani(); return; }
  if (KS.asama === "kaynak") { alan.innerHTML = kaynakEkrani(); return; }
  if (KS.asama === "sorular") { alan.innerHTML = soruEkrani(); return; }
  if (KS.asama === "sonuc") { alan.innerHTML = sonucEkrani(); kimlikKaydet(); }
}

function tehlikeEkrani() {
  const k = kimlikVeri().tehlike;
  const kart = k.kartlar[KS.tehlike.indeks];

  return '<div class="oyun-etiket">tehlike anı — ' + (KS.tehlike.indeks + 1) + " / " +
      k.kartlar.length + "</div>" +
    '<div class="tehlike-kart">' +
      "<p>" + kacir(kart.metin) + "</p>" +
      '<div class="tehlike-sayac" id="tehlikeCubuk"><span></span></div>' +
    "</div>" +
    '<div class="oyun-sira tehlike-sira">' +
      '<button class="dugme dugme-sade" data-tehlike="kac">KAÇ</button>' +
      '<button class="dugme" data-tehlike="saldir">SALDIR</button>' +
    "</div>";
}

function kaynakEkrani() {
  const k = kimlikVeri().kaynak;
  const toplam = Object.values(KS.kaynak.dagitim).reduce(function (a, b) { return a + b; }, 0);

  return '<div class="oyun-etiket">kaynak dağıtımı — ' + toplam + " / " + k.toplam + " puan</div>" +
    '<p class="oyun-not">Sabit puanı dört başlığa dağıt. Hepsini kullanmak zorunda değilsin ' +
      "ama dağıttıkça sonraki aşamaya geçebilirsin.</p>" +
    '<div class="kaynak-liste">' +
      k.basliklar.map(function (b) {
        const deger = KS.kaynak.dagitim[b.id];
        return '<div class="kaynak-satir">' +
                 '<div class="kaynak-bas"><b>' + kacir(b.ad) + "</b><span>" + kacir(b.not) + "</span></div>" +
                 '<div class="kaynak-kontrol">' +
                   '<button class="k-btn" data-kaynak-azalt="' + b.id + '">−</button>' +
                   '<span class="kaynak-deger">' + deger + "</span>" +
                   '<button class="k-btn" data-kaynak-artir="' + b.id + '">+</button>' +
                 "</div>" +
                 '<div class="kaynak-cubuk"><span style="width:' +
                   Math.round((deger / k.toplam) * 100) + '%"></span></div>' +
               "</div>";
      }).join("") +
    "</div>" +
    '<button class="dugme' + (toplam >= k.toplam ? "" : " pasif") +
      '" data-kimlik="kaynak-devam">Devam et</button>';
}

function soruEkrani() {
  const sorular = kimlikVeri().sorular;
  const s = sorular[KS.soruIndeks];

  return '<div class="oyun-etiket">soru ' + (KS.soruIndeks + 1) + " / " + sorular.length + "</div>" +
    '<h3 class="soru-metin">' + kacir(s.metin) + "</h3>" +
    '<div class="test-secenekler">' +
      s.secenekler.map(function (sec, i) {
        return '<button class="test-btn" data-kimlik-soru="' + i + '">' + kacir(sec.metin) + "</button>";
      }).join("") +
    "</div>";
}

function sonucEkrani() {
  const id = kimlikSonucBul();
  const k = kimlikVeri();
  const sonuc = k.sonuclar[id] || { ad: "?", unvan: "", aciklama: "Sonuç belirsiz kaldı." };

  return '<div class="kimlik-sonuc">' +
      '<div class="oyun-etiket">sonucun</div>' +
      "<h3>" + kacir(sonuc.ad) + "</h3>" +
      '<p class="kimlik-unvan">' + kacir(sonuc.unvan) + "</p>" +
      "<p>" + kacir(sonuc.aciklama) + "</p>" +

      '<div class="kimlik-detay">' +
        (KS.tehlikeSonuc ? '<div class="kimlik-adim"><b>tehlike anı:</b> ' +
          kacir(KS.tehlikeSonuc.not) + "</div>" : "") +
        (KS.kaynakSonuc ? '<div class="kimlik-adim"><b>kaynak dağılımı:</b> ' +
          kacir(KS.kaynakSonuc.not) + "</div>" : "") +
      "</div>" +
    "</div>" +
    '<div class="oyun-sira">' +
      '<button class="dugme" data-kimlik="tekrar">Yeniden dene</button>' +
      '<button class="dugme dugme-sade" data-kimlik="paylas">Sonucu paylaş</button>' +
    "</div>";
}

/* ---------- kayıt ---------- */

const KIMLIK_ANAHTAR = "tentiforapp_kimlik_sonuc";

function kimlikKaydet() {
  const id = kimlikSonucBul();
  if (!id) { return; }

  const zaten = kayitOku(KIMLIK_ANAHTAR);
  if (zaten === id) { return; }

  kayitYaz(KIMLIK_ANAHTAR, id);

  if (!zaten) {
    eckaKazan(25, "Kimlik Sınavı");
    if (typeof madalyaVer === "function") { /* ileride madalya eklenirse buraya bağlanır */ }
  }
}

function KS_SONUC_KAYITLI() { return !!kayitOku(KIMLIK_ANAHTAR); }

function kimlikGecmisOzet() {
  const id = kayitOku(KIMLIK_ANAHTAR);
  const sonuc = (kimlikVeri().sonuclar || {})[id];
  if (!sonuc) { return ""; }

  return '<div class="kimlik-gecmis">' +
    '<span class="oyun-etiket">önceki sonucun</span>' +
    "<b>" + kacir(sonuc.ad) + "</b>" +
  "</div>";
}

/* ---------- paylaşım kartı ---------- */

function kimlikPaylasKarti() {
  const id = kimlikSonucBul();
  const sonuc = kimlikVeri().sonuclar[id];
  if (!sonuc) { return null; }

  const en = 1080;
  const t = document.createElement("canvas");
  t.width = en; t.height = en;
  const c = t.getContext ? t.getContext("2d") : null;
  if (!c) { return null; }

  c.fillStyle = "#F4F9FD"; c.fillRect(0, 0, en, en);
  const g = c.createLinearGradient(0, en * 0.62, 0, en);
  g.addColorStop(0, "#DFEDF8"); g.addColorStop(1, "#B8D6EC");
  c.fillStyle = g; c.fillRect(0, en * 0.62, en, en * 0.38);

  c.fillStyle = "#1C5C96"; c.fillRect(120, 150, 6, 80);
  c.fillStyle = "#3D4A57"; c.font = "26px monospace";
  c.fillText("KİMLİK SINAVI", 145, 180);

  c.fillStyle = "#0A0F14"; c.font = "700 92px Georgia, serif";
  c.fillText(sonuc.ad, 140, 320);

  c.fillStyle = "#1C5C96"; c.font = "italic 34px Georgia, serif";
  c.fillText(sonuc.unvan, 140, 372);

  c.fillStyle = "#3D4A57"; c.font = "26px Georgia, serif";
  const satirlar = []; let satir = "";
  String(sonuc.aciklama).split(/\s+/).forEach(function (w) {
    const d = satir ? satir + " " + w : w;
    if (c.measureText(d).width > en - 280 && satir) { satirlar.push(satir); satir = w; }
    else { satir = d; }
  });
  if (satir) { satirlar.push(satir); }
  let y = 440;
  satirlar.slice(0, 4).forEach(function (s) { c.fillText(s, 140, y); y += 38; });

  c.fillStyle = "#0D3560"; c.font = "26px monospace";
  c.fillText("TENTIFORAPP", 140, en - 70);
  return t;
}

function kimlikPaylas() {
  const t = kimlikPaylasKarti();
  if (!t) { eckaBildir("Kart üretilemedi"); return; }

  t.toBlob(function (blob) {
    if (!blob) { return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "kimlik-sinavi.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    eckaBildir("Kart indirildi");
  }, "image/png");
}

/* ---------- olaylar ---------- */

document.addEventListener("click", function (e) {
  const b = e.target.closest("[data-kimlik]");
  if (b) {
    const eylem = b.dataset.kimlik;
    if (eylem === "basla" || eylem === "tekrar") { kimlikBaslat(); }
    else if (eylem === "kaynak-devam") { kaynakDevamEt(); }
    else if (eylem === "paylas") { kimlikPaylas(); }
    return;
  }

  const th = e.target.closest("[data-tehlike]");
  if (th) { tehlikeCevap(th.dataset.tehlike); return; }

  const ka = e.target.closest("[data-kaynak-artir]");
  if (ka) { kaynakDegistir(ka.dataset.kaynakArtir, 1); return; }

  const kz = e.target.closest("[data-kaynak-azalt]");
  if (kz) { kaynakDegistir(kz.dataset.kaynakAzalt, -1); return; }

  const sq = e.target.closest("[data-kimlik-soru]");
  if (sq) { kimlikSoruCevap(parseInt(sq.dataset.kimlikSoru, 10)); }
});

/* tehlike anı süre çubuğu — CSS animasyonla senkron, JS zaman aşımını yönetir */
let tehlikeZamanlayici = null;

document.addEventListener("click", function (e) {
  if (!e.target.closest('[data-tehlike]') && !e.target.closest('[data-kimlik="basla"]')) { return; }
  if (tehlikeZamanlayici) { clearTimeout(tehlikeZamanlayici); tehlikeZamanlayici = null; }

  setTimeout(function () {
    if (!KS || KS.asama !== "tehlike") { return; }
    const sure = kimlikVeri().tehlike.sure_ms;
    tehlikeZamanlayici = setTimeout(function () {
      if (KS && KS.asama === "tehlike") { tehlikeSureAsimi(); }
    }, sure);
  }, 30);
});
