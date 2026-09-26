/* Karakter oyunları — Gırı Çevirmeni, Gündüz Vardiyası, Boyut Sürüklenmesi.
   Hepsi ortak eçka cüzdanını besler. */

/** Oyunun bugün kalan kazanç hakkını gösterir. Görünmez tavan kafa karıştırıyordu. */
function tavanBilgi(oyun) {
  const kalan = gunlukKalan(oyun);
  if (kalan === Infinity) { return ""; }

  const t = veri.cuzdan.gunlukTavan[oyun];

  if (kalan <= 0) {
    return '<div class="tavan-uyari">Bugünlük kazanç sınırına ulaştın. ' +
           "Oynamaya devam edebilirsin ama " + birim() + " kazanmazsın. " +
           "Sınır yarın sıfırlanır.</div>";
  }

  return '<div class="tavan-bilgi">bugün kalan kazanç: <b>' + kalan + " / " + t +
         " " + birim() + "</b></div>";
}

/* ==================== 1. GIRI ÇEVİRMENİ ==================== */
/* Kyldolar kendi köklerini okuyamıyor. Sen okuyabiliyorsun. */

let C = null;

function cevirmenBaslat(zorluk) {
  if (typeof meydanTohumla === "function") { meydanTohumla("cevirmen"); }
  const havuz = (veri.kelimeler[zorluk] || []).slice();

  for (let i = havuz.length - 1; i > 0; i--) {
    const j = Math.floor(rast01() * (i + 1));
    const t = havuz[i]; havuz[i] = havuz[j]; havuz[j] = t;
  }

  const tersMi = zorluk !== "kolay";

  C = {
    zorluk: zorluk,
    tersMi: tersMi,
    sira: havuz.slice(0, 8),
    indeks: 0,
    dogru: 0,
    yanlis: 0,
    ipucuKullanildi: false,
    bitti: false
  };

  cevirmenCiz();
}

function cevirmenSifreli(kelime) {
  return basHarf(harfCevir(C.tersMi ? tersCevir(kelime) : kelime, false));
}

function cevirmenCevap(giris) {
  if (!C || C.bitti) { return; }

  const dogruCevap = C.sira[C.indeks];
  const verilen = String(giris).trim().toLocaleLowerCase("tr");

  if (verilen === dogruCevap) {
    C.dogru++;
    const odul = C.ipucuKullanildi ? 1 : (C.zorluk === "zor" ? 4 : C.zorluk === "orta" ? 3 : 2);
    gunlukKazan("cevirmen", odul, "Gırı Çevirmeni");
    gorevIlerle("cevirmen5");
    cevirmenIlerle(true);
    return;
  }

  C.yanlis++;
  cevirmenIlerle(false);
}

function cevirmenIlerle(dogruMu) {
  C.sonDurum = dogruMu ? "dogru" : "yanlis";
  C.sonKelime = C.sira[C.indeks];
  C.indeks++;
  C.ipucuKullanildi = false;

  if (C.indeks >= C.sira.length) {
    C.bitti = true;
    if (typeof rekorYaz === "function") { rekorYaz("cevirmen", C.dogru); }
    if (typeof meydanBitir === "function") { meydanBitir("cevirmen", C.dogru); }
    if (C.dogru === C.sira.length) {
      gunlukKazan("cevirmen", 10, "Kusursuz çeviri");
      if (C.zorluk === "zor") {
        oyunBitti("cevirmen");
        if (!C.ipucuAlindi && typeof madalyaVer === "function") { madalyaVer("ipucusuz"); }
      }
    }
  }

  cevirmenCiz();
}

function cevirmenIpucu() {
  if (!C || C.bitti || C.ipucuKullanildi) { return; }
  C.ipucuKullanildi = true;
  C.ipucuAlindi = true;
  istArtir("ipucu");
  cevirmenCiz();
}

function cevirmenCiz() {
  const alan = document.querySelector("#cevirmenAlan");
  if (!alan) { return; }

  if (!C) {
    alan.innerHTML =
      '<p class="oyun-giris">Yanmış bir Gırı kitabından kurtulan kelimeler. ' +
      "Kyldolar bunları okuyamıyor — sen isim sistemini biliyorsun.</p>" +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-cev="kolay">Kolay</button>' +
        '<button class="dugme dugme-sade" data-cev="orta">Orta</button>' +
        '<button class="dugme dugme-sade" data-cev="zor">Zor</button>' +
      "</div>" +
      '<p class="oyun-not">Kolay: harfler çevrilmiş. Orta ve zor: kelime ayrıca ters okunuyor.</p>' +
      tavanBilgi("cevirmen");
    return;
  }

  if (C.bitti) {
    alan.innerHTML =
      '<div class="oyun-son">' +
        "<h3>" + C.dogru + " / " + C.sira.length + "</h3>" +
        "<p>" + (C.dogru === C.sira.length
          ? "Kusursuz. Gırı arşivi sana açık."
          : C.dogru >= C.sira.length / 2
            ? "Fena değil. Bir Kyldo için imkânsız olan şeyi yapıyorsun."
            : "Dil direniyor. Tekrar dene.") + "</p>" +
        '<button class="dugme" data-cev="yeni">Yeniden</button>' +
      "</div>";
    return;
  }

  const kelime = C.sira[C.indeks];
  const sifreli = cevirmenSifreli(kelime);
  const ipucu = C.ipucuKullanildi
    ? '<p class="oyun-ipucu">İlk harf: <b>' + kelime.charAt(0) + "</b> · " +
      kelime.length + " harf" + (C.tersMi ? " · kelime ters okunuyor" : "") + "</p>"
    : "";

  alan.innerHTML =
    tavanBilgi("cevirmen") +
    '<div class="cev-ust">' +
      "<span>" + (C.indeks + 1) + " / " + C.sira.length + "</span>" +
      "<span>doğru " + C.dogru + "</span>" +
    "</div>" +
    (C.sonKelime ? '<p class="cev-gecmis ' + C.sonDurum + '">' +
      (C.sonDurum === "dogru" ? "doğru: " : "cevap: ") + C.sonKelime + "</p>" : "") +
    '<div class="cev-kelime">' + sifreli + "</div>" +
    '<input class="kod-giris" id="cevGiris" autocomplete="off" spellcheck="false" ' +
      'placeholder="türkçesi" inputmode="text">' +
    '<button class="dugme" data-cev-onay="1">Çevir</button>' +
    '<button class="dugme dugme-sade" data-cev-ipucu="1"' +
      (C.ipucuKullanildi ? " disabled" : "") + ">İpucu (ödül düşer)</button>" +
    ipucu;

  const g = document.querySelector("#cevGiris");
  if (g) { g.focus(); }
}

/* ==================== 2. GÜNDÜZ VARDİYASI ==================== */
/* Romanın açılışı diyalog ağırlıklıdır. Burası gündüz kısmı. */

let V = null;

function vardiyaBaslat() {
  if (typeof meydanTohumla === "function") { meydanTohumla("vardiya"); }
  V = { sira: 0, toplam: 10, kazanc: 0, memnun: 0, sabir: 5, bitti: false, musteri: null };
  vardiyaMusteri();
}

function vardiyaMusteri() {
  const liste = veri.musteriler || [];
  V.musteri = liste[Math.floor(rast01() * liste.length)];
  V.secim = null;
  vardiyaCiz();
}

function vardiyaSec(raf) {
  if (!V || V.bitti || V.secim || V.musteri.sohbet) { return; }

  V.secim = raf;
  const dogru = raf === V.musteri.raf;

  if (dogru) {
    V.memnun++;
    const kazanc = 6 + V.musteri.bahsis;
    V.kazanc += kazanc;
    gunlukKazan("vardiya", kazanc, "Gündüz Vardiyası");
    gorevIlerle("vardiya8");
  } else {
    V.sabir--;
  }

  V.sira++;
  vardiyaCiz();

  setTimeout(function () {
    if (!V) { return; }

    if (V.sabir <= 0 || V.sira >= V.toplam) {
      V.bitti = true;
      if (typeof rekorYaz === "function") { rekorYaz("vardiya", V.memnun); }
      if (typeof meydanBitir === "function") { meydanBitir("vardiya", V.memnun); }

      if (V.memnun === V.toplam) {
        gunlukKazan("vardiya", 20, "Kusursuz vardiya");
        oyunBitti("vardiya");
        istArtir("kusursuzVardiya");
        if (cuzdan.ist.kusursuzVardiya >= 3 && typeof madalyaVer === "function") {
          madalyaVer("kusursuzgun");
        }
      }
      vardiyaCiz();
      return;
    }

    vardiyaMusteri();
  }, 1100);
}

function vardiyaCiz() {
  const alan = document.querySelector("#vardiyaAlan");
  if (!alan) { return; }

  if (!V) {
    alan.innerHTML =
      '<p class="oyun-giris">Gündüz kütüphane açık. Müşteri ne istediğini tam söylemez; ' +
      "hangi raftan bakacağını sen bulacaksın.</p>" +
      '<button class="dugme" data-vardiya="basla">Dükkânı aç</button>' +
      tavanBilgi("vardiya");
    return;
  }

  if (V.bitti) {
    alan.innerHTML =
      '<div class="oyun-son">' +
        "<h3>" + V.memnun + " / " + V.toplam + "</h3>" +
        "<p>" + (V.sabir <= 0
          ? "Sabır tükendi. Bugünlük bu kadar."
          : V.memnun >= 8
            ? "İyi bir gün. Tarı'nın gündüzleri böyleydi — sorun geceydi."
            : "Vasat bir gün. Raflar seni bekliyor.") + "</p>" +
        '<p class="oyun-not">Kazanç: ' + V.kazanc + " " + birim() + "</p>" +
        '<button class="dugme" data-vardiya="basla">Yeni gün</button>' +
      "</div>";
    return;
  }

  const m = V.musteri;
  /* raf istemeyen müşteri: yalnızca konuşur, puana ve sıraya sayılmaz */
  if (m.sohbet) {
    alan.innerHTML = tavanBilgi("vardiya") +
      '<div class="cev-ust"><span>müşteri ' + (V.sira + 1) + " / " + V.toplam + "</span><span>sabır " + "●".repeat(Math.max(0, V.sabir)) + "</span></div>" +
      '<div class="musteri"><div class="musteri-ad">' + kacir(m.ad) + '</div><div class="musteri-istek">" ' + kacir(m.istek) + ' "</div>' +
      (V.sohbetCevap ? '<div class="musteri-istek">" ' + kacir(m.cevap || "") + ' "</div>' : "") + "</div>" +
      (V.sohbetCevap ? "" : '<button class="dugme" data-vardiya-anlat>Anlat</button>');
    return;
  }
  const raflar = (veri.raflar || []).map(function (r) {
    let sinif = "raf-btn";

    if (V.secim) {
      if (r === m.raf) { sinif += " dogru"; }
      else if (r === V.secim) { sinif += " yanlis"; }
    }

    return '<button class="' + sinif + '" data-raf="' + kacir(r) + '">' + kacir(r) + "</button>";
  }).join("");

  alan.innerHTML =
    tavanBilgi("vardiya") +
    '<div class="cev-ust">' +
      "<span>müşteri " + (V.sira + 1) + " / " + V.toplam + "</span>" +
      "<span>sabır " + "●".repeat(Math.max(0, V.sabir)) + "</span>" +
    "</div>" +
    '<div class="musteri">' +
      '<div class="musteri-ad">' + kacir(m.ad) + "</div>" +
      '<div class="musteri-istek">" ' + kacir(m.istek) + ' "</div>' +
    "</div>" +
    '<div class="raf-izgara">' + raflar + "</div>" +
    (V.secim
      ? '<p class="oyun-ipucu">' + (V.secim === m.raf ? "Doğru raf." : "Aradığı " + m.raf + " rafındaydı.") + "</p>"
      : "");
}

/* ==================== 3. BOYUT SÜRÜKLENMESİ ==================== */
/* Ruh bedenden çıktı ve dördüncü boyuta düştü. Zaman her katmanda aynı akmaz. */

const BOYUT_KILIT = "oyun_boyut";

let B = null;

const BOYUT_SEVIYE = [
  { en: 5, boy: 5, hamle: 14, ters: [[2, 1], [2, 2], [2, 3]] },
  { en: 6, boy: 6, hamle: 20, ters: [[1, 3], [2, 3], [3, 3], [4, 3], [3, 1], [3, 4]] },
  { en: 7, boy: 7, hamle: 26, ters: [[2, 2], [3, 2], [4, 2], [2, 4], [3, 4], [4, 4], [3, 3], [1, 5], [5, 1]] }
];

function boyutBaslat(seviye) {
  const s = BOYUT_SEVIYE[seviye];

  B = {
    seviye: seviye,
    en: s.en, boy: s.boy,
    x: 0, y: 0,
    hedefX: s.en - 1, hedefY: s.boy - 1,
    kalan: s.hamle,
    ters: s.ters.map(function (t) { return t[0] + "," + t[1]; }),
    bitti: false,
    kazandi: false
  };

  boyutCiz();
}

function tersBolgede() {
  return B.ters.indexOf(B.x + "," + B.y) !== -1;
}

function boyutHareket(yon) {
  if (!B || B.bitti) { return; }

  let dx = 0, dy = 0;
  if (yon === "yukari") { dy = -1; }
  else if (yon === "asagi") { dy = 1; }
  else if (yon === "sol") { dx = -1; }
  else { dx = 1; }

  /* Zamanın tersine aktığı bölgede hareket ters işler. */
  if (tersBolgede()) { dx = -dx; dy = -dy; }

  const yx = B.x + dx;
  const yy = B.y + dy;

  if (yx < 0 || yy < 0 || yx >= B.en || yy >= B.boy) { return; }

  B.x = yx;
  B.y = yy;
  B.kalan--;

  if (B.x === B.hedefX && B.y === B.hedefY) {
    B.bitti = true;
    B.kazandi = true;
    gunlukKazan("boyut", 15 + B.seviye * 10, "Boyut Sürüklenmesi");
    if (typeof rekorYaz === "function") { rekorYaz("boyut", B.seviye + 1); }
    if (B.seviye === BOYUT_SEVIYE.length - 1) {
      oyunBitti("boyut");
      if (typeof madalyaVer === "function") { madalyaVer("ilkdeneme"); }
    }
  } else if (B.kalan <= 0) {
    B.bitti = true;
  }

  boyutCiz();
}

function boyutCiz() {
  const alan = document.querySelector("#boyutAlan");
  if (!alan) { return; }

  const fiyat = veri.cuzdan.boyutFiyat;

  if (!kilitAcik(BOYUT_KILIT)) {
    alan.innerHTML =
      '<div class="kilit-kutu">' +
        "<h3>Boyut Sürüklenmesi</h3>" +
        "<p>Ruh bedenden çıkıp uzun süre dışarıda kalırsa boyut atlar. " +
        "Feil'in yüz yılı bu katmanda geçti — ve bazı boyutlarda zaman tersine akıyordu.</p>" +
        '<p class="oyun-not">Kilidi açmak: <b>' + fiyat + " " + birim() + "</b> · " +
          "cüzdanında " + cuzdan.ecka +
          (eckaVar(fiyat) ? "" : " · <b>" + (fiyat - cuzdan.ecka) + "</b> eksik") + "</p>" +
        (eckaVar(fiyat) ? "" :
          '<p class="oyun-not">Diğer oyunlardan kazanabilirsin. Günlük kazanç sınırı ' +
          "var, o yüzden büyük kilitler birkaç güne yayılır.</p>") +
        '<button class="dugme' + (eckaVar(fiyat) ? "" : " pasif") + '" data-boyut-ac="1">' +
          (eckaVar(fiyat) ? "Kilidi aç" : "Yeterli " + birim() + " yok") + "</button>" +
      "</div>";
    return;
  }

  if (!B) {
    alan.innerHTML =
      '<p class="oyun-giris">Çıkışa ulaş. Ama mavi karelerde zaman tersine akıyor — ' +
      "orada verdiğin komut ters işler.</p>" +
      '<div class="oyun-sira">' +
        BOYUT_SEVIYE.map(function (s, i) {
          return '<button class="dugme' + (i ? " dugme-sade" : "") + '" data-boyut="' + i + '">' +
                 (i + 1) + ". katman</button>";
        }).join("") +
      "</div>" +
      tavanBilgi("boyut");
    return;
  }

  let izgara = "";
  for (let y = 0; y < B.boy; y++) {
    for (let x = 0; x < B.en; x++) {
      let sinif = "b-kare";
      if (B.ters.indexOf(x + "," + y) !== -1) { sinif += " b-ters"; }
      if (x === B.hedefX && y === B.hedefY) { sinif += " b-hedef"; }
      if (x === B.x && y === B.y) { sinif += " b-ruh"; }
      izgara += '<div class="' + sinif + '"></div>';
    }
  }

  alan.innerHTML =
    '<div class="cev-ust">' +
      "<span>" + (B.seviye + 1) + ". katman</span>" +
      "<span>kalan hamle " + Math.max(0, B.kalan) + "</span>" +
    "</div>" +
    '<div class="b-izgara" style="grid-template-columns:repeat(' + B.en + ',1fr)">' + izgara + "</div>" +
    (tersBolgede() && !B.bitti ? '<p class="oyun-ipucu">Zaman tersine akıyor.</p>' : "") +
    (B.bitti
      ? '<div class="oyun-son"><h3>' + (B.kazandi ? "Bağlandın" : "Sürüklendin") + "</h3>" +
        "<p>" + (B.kazandi
          ? "Bu katmanda tutunmayı başardın."
          : "Hamlelerin bitti. Boyutlar seni taşımaya devam ediyor.") + "</p>" +
        '<button class="dugme" data-boyut-geri="1">Katman seç</button></div>'
      : '<div class="b-kumanda">' +
          '<button class="b-tus" data-boyut-yon="yukari">▲</button>' +
          '<div class="b-orta">' +
            '<button class="b-tus" data-boyut-yon="sol">◀</button>' +
            '<button class="b-tus" data-boyut-yon="sag">▶</button>' +
          "</div>" +
          '<button class="b-tus" data-boyut-yon="asagi">▼</button>' +
        "</div>");
}

/* ==================== ortak olaylar ==================== */

document.addEventListener("click", function (e) {
  const cev = e.target.closest("[data-cev]");
  if (cev) {
    const d = cev.dataset.cev;
    if (d === "yeni") { C = null; cevirmenCiz(); }
    else { cevirmenBaslat(d); }
    return;
  }

  if (e.target.closest("[data-cev-onay]")) {
    const g = document.querySelector("#cevGiris");
    if (g) { cevirmenCevap(g.value); }
    return;
  }

  if (e.target.closest("[data-cev-ipucu]")) { cevirmenIpucu(); return; }

  if (e.target.closest("[data-vardiya-anlat]")) {
    if (!V || !V.musteri || !V.musteri.sohbet || V.sohbetCevap) { return; }
    V.sohbetCevap = true;
    vardiyaCiz();
    setTimeout(function () { if (V && !V.bitti) { V.sohbetCevap = false; vardiyaMusteri(); } }, 1400);
    return;
  }

  const v = e.target.closest("[data-vardiya]");
  if (v) { vardiyaBaslat(); return; }

  const raf = e.target.closest("[data-raf]");
  if (raf) { vardiyaSec(raf.dataset.raf); return; }

  if (e.target.closest("[data-boyut-ac]")) {
    if (kilitAc(BOYUT_KILIT, veri.cuzdan.boyutFiyat)) { eckaBildir("Boyut Sürüklenmesi açıldı"); }
    boyutCiz();
    return;
  }

  const b = e.target.closest("[data-boyut]");
  if (b) { boyutBaslat(parseInt(b.dataset.boyut, 10)); return; }

  if (e.target.closest("[data-boyut-geri]")) { B = null; boyutCiz(); return; }

  const yon = e.target.closest("[data-boyut-yon]");
  if (yon) { boyutHareket(yon.dataset.boyutYon); }
});

document.addEventListener("keydown", function (e) {
  if (document.activeElement && document.activeElement.id === "cevGiris") {
    if (e.key === "Enter") { cevirmenCevap(document.activeElement.value); }
    return;
  }

  if (!B || B.bitti) { return; }

  const eslesme = {
    ArrowUp: "yukari", ArrowDown: "asagi", ArrowLeft: "sol", ArrowRight: "sag"
  };

  if (eslesme[e.key]) {
    e.preventDefault();
    boyutHareket(eslesme[e.key]);
  }
});

/* ==================== ŞÜPHELİ TAHTASI ==================== */
/* Site verisiyle hiçbir ilgisi yok — saf mantık bulmacası. Beş kişiden
   yalnızca ikisi birbirini tanıyor; ipuçlarını eleyerek doğru ikiliyi
   bulman gerekiyor. Tentiforverse bilgisi gerektirmez, kimse bilmese de
   bitirebilir. */

let S = null;
let supheliSonBulmaca = null;   /* ardisik ayni bulmacayi onlemek icin */

const SUPHELI_COZULEN_ANAHTAR = "tentiforapp_supheli_cozulen";

function supheliCozulenler() {
  try { return JSON.parse(kayitOku(SUPHELI_COZULEN_ANAHTAR) || "{}"); }
  catch (e) { return {}; }
}

/** Doğru çözülen bulmacayı kalıcı olarak işaretler. Beşi de çözülünce
    "Mantık Ustası" madalyası verilir. */
function supheliCozulenKaydet(bulmacaId) {
  const d = supheliCozulenler();
  const yeniMi = !d[bulmacaId];
  d[bulmacaId] = true;
  kayitYaz(SUPHELI_COZULEN_ANAHTAR, JSON.stringify(d));

  if (yeniMi && typeof madalyaVer === "function") {
    const tumu = (veri.suphehliBulmacalar || []).map(function (b) { return b.id; });
    if (tumu.length && tumu.every(function (id) { return d[id]; })) { madalyaVer("tumSuphehliler"); }
  }
}

function supheliBaslat(bulmacaId) {
  const liste = veri.suphehliBulmacalar || [];
  if (!liste.length) { return; }

  let b;
  if (bulmacaId) {
    b = liste.find(function (x) { return x.id === bulmacaId; });
  } else {
    /* Aynı bulmaca art arda gelmesin — birden fazla bulmaca varsa öncekini hariç tut. */
    const secilebilir = liste.length > 1
      ? liste.filter(function (x) { return x.id !== supheliSonBulmaca; })
      : liste;
    b = secilebilir[Math.floor(rast01() * secilebilir.length)];
  }
  if (!b) { return; }

  supheliSonBulmaca = b.id;
  S = { bulmacaId: b.id, secim: [], bitti: false, dogru: null };
  supheliCiz();
}

function supheliSec(ad) {
  if (!S || S.bitti) { return; }

  const i = S.secim.indexOf(ad);
  if (i !== -1) { S.secim.splice(i, 1); supheliCiz(); return; }

  if (S.secim.length >= 2) { return; }
  S.secim.push(ad);
  supheliCiz();
}

function supheliCevapla() {
  if (!S || S.secim.length !== 2) { return; }

  const liste = veri.suphehliBulmacalar || [];
  const b = liste.find(function (x) { return x.id === S.bulmacaId; });
  if (!b) { return; }

  const secimSirali = S.secim.slice().sort();
  const cozumSirali = b.cozum.slice().sort();
  const dogruMu = secimSirali[0] === cozumSirali[0] && secimSirali[1] === cozumSirali[1];

  S.bitti = true;
  S.dogru = dogruMu;

  if (dogruMu) {
    const odul = 12 + Math.floor(rast01() * 6);
    gunlukKazan("supheli", odul, "Şüpheli tahtası");
    gorevIlerle("supheli1");
    supheliCozulenKaydet(b.id);
  }

  supheliCiz();
}

function supheliYeni() {
  supheliBaslat(null);
}

function supheliCiz() {
  const alan = document.querySelector("#supheliAlan");
  if (!alan) { return; }

  if (!S) {
    alan.innerHTML =
      '<p class="oyun-giris">Beş kişiden yalnızca ikisi birbirini tanıyor. İpuçlarını kullanarak ' +
      "eleme yap, doğru ikiliyi bul. Bu bulmacanın Tentiforverse'le hiçbir ilgisi yok — saf mantık, " +
      "kimse bilmese de bitirebilir.</p>" +
      tavanBilgi("supheli") +
      '<button class="dugme dugme-tam" data-supheli-baslat="1">Bulmaca Başlat</button>';
    return;
  }

  const liste = veri.suphehliBulmacalar || [];
  const b = liste.find(function (x) { return x.id === S.bulmacaId; });
  if (!b) { alan.innerHTML = ""; return; }

  const kartlar = b.kisiler.map(function (k) {
    const secili = S.secim.indexOf(k.ad) !== -1;
    const dogruKart = S.bitti && b.cozum.indexOf(k.ad) !== -1;
    const yanlisKart = S.bitti && secili && b.cozum.indexOf(k.ad) === -1;

    return '<button class="supheli-kart' + (secili ? " secili" : "") +
             (dogruKart ? " dogru" : "") + (yanlisKart ? " yanlis" : "") + '"' +
             (S.bitti ? "" : ' data-supheli-sec="' + kacir(k.ad) + '"') + ">" +
             '<span class="supheli-ad">' + kacir(k.ad) + "</span>" +
             '<span class="supheli-detay">' + kacir(k.detay) + "</span>" +
           "</button>";
  }).join("");

  alan.innerHTML =
    tavanBilgi("supheli") +
    '<div class="supheli-izgara">' + kartlar + "</div>" +
    '<div class="supheli-ipuclari"><h4>İpuçları</h4><ul>' +
      b.ipuclari.map(function (i) { return "<li>" + kacir(i) + "</li>"; }).join("") +
    "</ul></div>" +
    (S.bitti
      ? '<div class="supheli-sonuc ' + (S.dogru ? "iyi" : "kotu") + '">' +
          (S.dogru
            ? "Doğru! Bağlantı: " + kacir(b.cozum.join(" — "))
            : "Yanlış. Doğru bağlantı: " + kacir(b.cozum.join(" — "))) +
        "</div>" +
        '<button class="dugme dugme-tam" data-supheli-yeni="1">Yeni bulmaca</button>'
      : '<button class="dugme dugme-tam' + (S.secim.length === 2 ? "" : " pasif") + '" data-supheli-cevapla="1">' +
          (S.secim.length < 2 ? "İki kişi seç (" + S.secim.length + "/2)" : "Cevapla") +
        "</button>");
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-supheli-baslat]")) { supheliBaslat(); return; }
  if (e.target.closest("[data-supheli-yeni]")) { supheliYeni(); return; }
  if (e.target.closest("[data-supheli-cevapla]")) { supheliCevapla(); return; }

  const sec = e.target.closest("[data-supheli-sec]");
  if (sec) { supheliSec(sec.dataset.supheliSec); }
});
