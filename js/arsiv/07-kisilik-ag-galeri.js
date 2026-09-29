/* Kişilik testi, ilişki ağı ve galeri. */

/* ==================== KİŞİLİK TESTİ ==================== */

const TEST_ODUL_ANAHTAR = "test_odulu";

let T = null;

function testBaslat() {
  T = { soru: 0, puan: {}, sonuc: null };
  testCiz();
}

function testSec(secenekIndeks) {
  if (!T || T.sonuc) { return; }

  const soru = veri.test.sorular[T.soru];
  const puan = soru.secenekler[secenekIndeks].puan;

  Object.keys(puan).forEach(function (k) {
    T.puan[k] = (T.puan[k] || 0) + puan[k];
  });

  T.soru++;

  if (T.soru >= veri.test.sorular.length) {
    let enIyi = null;

    Object.keys(T.puan).forEach(function (k) {
      if (!enIyi || T.puan[k] > T.puan[enIyi]) { enIyi = k; }
    });

    T.sonuc = enIyi;
    if (!kartSahip(T.sonuc)) { kartKazan(T.sonuc, "test"); }   /* sonuç karakterinin kartı (39) */

    if (!kilitAcik(TEST_ODUL_ANAHTAR)) {
      cuzdan.acilan.push(TEST_ODUL_ANAHTAR);
      eckaKazan(veri.cuzdan.testOdul, "Testi tamamladın");
    }

    if (typeof basarimCiz === "function") { basarimCiz(); }
  }

  testCiz();
}

function testCiz() {
  const alan = document.querySelector("#testAlan");
  if (!alan) { return; }

  if (!T) {
    alan.innerHTML =
      '<p class="oyun-giris">Kütüphanenin on görevlisi oldu. Sen hangisisin?</p>' +
      '<button class="dugme" data-test="basla">Teste başla</button>' +
      '<p class="oyun-not">' + veri.test.sorular.length + " soru · ilk tamamlayışta " +
        veri.cuzdan.testOdul + " " + birim() + "</p>";
    return;
  }

  if (T.sonuc) {
    const s = veri.test.sonuclar[T.sonuc];

    alan.innerHTML =
      '<div class="test-sonuc">' +
        '<div class="test-unvan">' + kacir(s.unvan) + "</div>" +
        "<h3>" + kacir(s.ad) + "</h3>" +
        "<p>" + kacir(s.aciklama) + "</p>" +
        '<button class="dugme" data-paylas="' + kacir(T.sonuc) + '">Sonucu paylaş</button>' +
        '<button class="dugme dugme-sade" data-test="basla">Tekrar çöz</button>' +
      "</div>";
    return;
  }

  const soru = veri.test.sorular[T.soru];

  alan.innerHTML =
    '<div class="cev-ust"><span>' + (T.soru + 1) + " / " + veri.test.sorular.length + "</span></div>" +
    '<div class="test-soru">' + kacir(soru.metin) + "</div>" +
    '<div class="test-secenekler">' +
      soru.secenekler.map(function (sec, i) {
        return '<button class="test-btn" data-test-sec="' + i + '">' + kacir(sec.metin) + "</button>";
      }).join("") +
    "</div>";
}

/* ==================== İLİŞKİ AĞI ==================== */

let secilenDugum = null;
let agGizliDugumler = new Set();   /* kadraj disi birakilan karakter id'leri */
let agFiltreAcik = false;

let agFiltreYuklendi = false;

const AG_FILTRE_ANAHTAR = "tentiforapp_ag_filtre";

/** Kadraj dışı bırakılan karakterleri yükler — sayfa yenilense de tercih
    kaybolmasın diye. */
function agFiltreYukle() {
  try {
    const kayitli = JSON.parse(kayitOku(AG_FILTRE_ANAHTAR) || "[]");
    if (Array.isArray(kayitli)) { agGizliDugumler = new Set(kayitli); }
  } catch (e) { agGizliDugumler = new Set(); }
}

function agFiltreKaydet() {
  kayitYaz(AG_FILTRE_ANAHTAR, JSON.stringify(Array.from(agGizliDugumler)));
}

function agCiz() {
  const alan = document.querySelector("#agAlan");
  if (!alan || !veri.ag) { return; }

  if (!agFiltreYuklendi) { agFiltreYukle(); agFiltreYuklendi = true; }

  const tumDugumler = veri.ag.dugumler;
  const dugumler = tumDugumler.filter(function (d) { return !agGizliDugumler.has(d.id); });
  const gorunurBaglar = veri.ag.baglar.filter(function (b) {
    if (agGizliDugumler.has(b.a) || agGizliDugumler.has(b.b)) { return false; }
    return !b.gizli || acikSayisi() > 0;
  });

  /* Şüpheli tahtası: sabit bir çembere sıkıştırmak yerine, dugum sayısı
     arttıkça genişleyen, kaydırılabilen bir tuval. Satırlar birbirine göre
     kaydırılmış (organik, "pano" hissi versin diye) ama pozisyon id'den
     türediği için her çizimde aynı kalıyor — rastgele zıplamıyor. */
  const SUTUN = Math.max(4, Math.ceil(Math.sqrt(dugumler.length * 1.7)));
  const HUCRE_X = 96, HUCRE_Y = 100, KENAR = 56;
  const satirSayisi = Math.max(1, Math.ceil(dugumler.length / SUTUN));
  const genislik = Math.max(360, SUTUN * HUCRE_X + KENAR * 2);
  const yukseklik = Math.max(300, satirSayisi * HUCRE_Y + KENAR * 2);

  const konum = {};
  dugumler.forEach(function (d, i) {
    const satir = Math.floor(i / SUTUN);
    const sutun = i % SUTUN;
    const sapma = ((d.id.charCodeAt(0) * 17 + d.id.length * 31) % 24) - 12;
    konum[d.id] = {
      x: KENAR + sutun * HUCRE_X + HUCRE_X / 2 + (satir % 2 ? HUCRE_X / 3 : 0),
      y: KENAR + satir * HUCRE_Y + HUCRE_Y / 2 + sapma * 0.35
    };
  });

  const cizgiler = gorunurBaglar.map(function (b) {
    const a = konum[b.a];
    const c = konum[b.b];
    if (!a || !c) { return ""; }

    const vurgu = secilenDugum && (b.a === secilenDugum || b.b === secilenDugum);

    return '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + c.x + '" y2="' + c.y +
           '" class="ag-cizgi' + (vurgu ? " vurgu" : "") + (b.gizli ? " gizli" : "") +
           (b.bilmez ? " bilmez" : "") + '"/>';
  }).join("");

  const noktalar = dugumler.map(function (d) {
    const k = konum[d.id];
    const sec = secilenDugum === d.id;
    const genislikKart = Math.max(52, d.ad.length * 6.2 + 16);

    return '<g class="ag-dugum' + (sec ? " secili" : "") + '" data-dugum="' + d.id + '">' +
             '<rect x="' + (k.x - genislikKart / 2) + '" y="' + (k.y - 12) + '" ' +
               'width="' + genislikKart + '" height="24" rx="2" class="ag-kart"/>' +
             '<circle cx="' + k.x + '" cy="' + (k.y - 12) + '" r="2.4" class="ag-pin"/>' +
             '<text x="' + k.x + '" y="' + (k.y + 4) + '" text-anchor="middle">' + kacir(d.ad) + "</text>" +
           "</g>";
  }).join("");

  const secili = secilenDugum
    ? gorunurBaglar.filter(function (b) { return b.a === secilenDugum || b.b === secilenDugum; })
    : [];

  const ad = function (id) {
    const d = tumDugumler.find(function (x) { return x.id === id; });
    return d ? d.ad : id;
  };

  const gizliSayisi = agGizliDugumler.size;

  alan.innerHTML =
    '<div class="ag-filtre">' +
      '<button class="dugme dugme-sade" data-ag-filtre-ac="1">' +
        (agFiltreAcik ? "Listeyi kapat" : "Karakter göster/gizle") +
      "</button>" +
      (gizliSayisi
        ? '<span class="oyun-not">' + gizliSayisi + " kadraj dışında</span>" +
          '<button class="dugme dugme-sade" data-ag-hepsi-goster="1">Hepsini göster</button>'
        : "") +
    "</div>" +
    (agFiltreAcik
      ? '<div class="ag-filtre-liste">' +
          tumDugumler.map(function (d) {
            const gizli = agGizliDugumler.has(d.id);
            return '<label class="y-alan-secim">' +
                     '<input type="checkbox" data-ag-goster="' + kacir(d.id) + '"' + (gizli ? "" : " checked") + "> " +
                     kacir(d.ad) +
                   "</label>";
          }).join("") +
        "</div>"
      : "") +
    '<div class="ag-tahta-sarici" tabindex="0" role="region" aria-label="Kişilik ağı (kaydırılabilir)">' +
      '<svg viewBox="0 0 ' + genislik + " " + yukseklik + '" width="' + genislik + '" height="' + yukseklik +
        '" class="ag-svg ag-tahta" role="img" aria-label="İlişki ağı">' +
        '<rect width="' + genislik + '" height="' + yukseklik + '" class="ag-pano"/>' +
        cizgiler + noktalar +
      "</svg>" +
    "</div>" +
    (secilenDugum
      ? '<div class="ag-bilgi"><h4>' + kacir(ad(secilenDugum)) + "</h4>" +
        (secili.length
          ? "<ul>" + secili.map(function (b) {
              const oteki = b.a === secilenDugum ? b.b : b.a;
              return '<li' + (b.bilmez ? ' class="bilmez"' : "") + "><b>" +
                     kacir(ad(oteki)) + "</b> — " + kacir(b.etiket) + "</li>";
            }).join("") + "</ul>"
          : "<p>Görünür bağ yok.</p>") +
        "</div>"
      : '<p class="oyun-not">Bir isme dokun. Tahtayı sağa sola kaydırabilirsin. Kilitli bağlar kod çözdükçe belirir.</p>') +
    '<div class="ag-aciklama"><span>tanışıklık</span>' +
      '<span class="bilmez">bilmiyor</span></div>';
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-ag-filtre-ac]")) { agFiltreAcik = !agFiltreAcik; agCiz(); return; }
  if (e.target.closest("[data-ag-hepsi-goster]")) { agGizliDugumler.clear(); agFiltreKaydet(); agCiz(); }
});

document.addEventListener("change", function (e) {
  const g = e.target.closest("[data-ag-goster]");
  if (!g) { return; }
  if (g.checked) { agGizliDugumler.delete(g.dataset.agGoster); }
  else { agGizliDugumler.add(g.dataset.agGoster); }
  agFiltreKaydet();
  agCiz();
});

/* ==================== GALERİ ==================== */

function galeriCiz() {
  const alan = document.querySelector("#galeriAlan");
  if (!alan) { return; }

  const liste = veri.galeri || [];

  if (!liste.length) {
    alan.innerHTML = '<div class="bos">Henüz görsel yok.</div>';
    return;
  }

  alan.innerHTML = '<div class="galeri-izgara">' + liste.map(function (g, i) {
    const anahtar = "galeri_" + g.id;
    const duzenModu = (typeof duzenlemeAcikMi === "function") && duzenlemeAcikMi();
    /* Düzenleme modunda kilitli kartlar da açık görünür; yönetici hepsine görsel koyabilmeli. */
    const acik = duzenModu || g.fiyat === 0 || kilitAcik(anahtar);

    const duzen = duzenModu;

    const ic = acik
      ? (duzen
          ? '<div class="birak galeri-birak" data-birak="galeri.' + i + '.gorsel" ' +
            'data-birak-ad="galeri_' + kacir(g.id) + '">' +
              (g.gorsel ? '<img src="' + kacir(g.gorsel) + '" alt="" loading="lazy" decoding="async">'
                        : '<span class="birak-ipucu">sürükle</span>') +
              '<input type="file" accept="image/*" data-birak-giris="galeri.' + i + '.gorsel">' +
            "</div>"
          : (g.gorsel
              ? '<img src="' + kacir(g.gorsel) + '" alt="' + kacir(g.baslik) + '" loading="lazy">'
              : '<div class="galeri-bos">görsel eklenmedi</div>'))
      : '<div class="galeri-kilit">' +
          '<div class="galeri-fiyat">' + g.fiyat + " " + birim() + "</div>" +
          '<button class="dugme' + (eckaVar(g.fiyat) ? "" : " pasif") + '" data-galeri="' + g.id +
            '" data-fiyat="' + g.fiyat + '">Aç</button>' +
        "</div>";

    return '<div class="galeri-kart' + (acik ? "" : " kilitli") + '">' +
             '<div class="galeri-gorsel">' + ic + "</div>" +
             '<div class="galeri-alt">' +
               '<span class="galeri-tur">' + kacir(g.tur) + "</span>" +
               '<span class="galeri-baslik">' + kacir(g.baslik) + "</span>" +
               '<span class="galeri-aciklama">' + kacir(acik ? g.aciklama : "Kilitli") + "</span>" +
             "</div>" +
           "</div>";
  }).join("") + "</div>";
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-test]")) { testBaslat(); return; }

  const sec = e.target.closest("[data-test-sec]");
  if (sec) { testSec(parseInt(sec.dataset.testSec, 10)); return; }

  const dugum = e.target.closest("[data-dugum]");
  if (dugum) {
    secilenDugum = secilenDugum === dugum.dataset.dugum ? null : dugum.dataset.dugum;
    agCiz();
    return;
  }

  const g = e.target.closest("[data-galeri]");
  if (g) {
    const fiyat = parseInt(g.dataset.fiyat, 10);
    if (kilitAc("galeri_" + g.dataset.galeri, fiyat)) { eckaBildir("Galeri açıldı"); }
    galeriCiz();
  }
});
