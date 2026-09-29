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
    '<div class="ag-filtre" style="display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; margin-bottom:.8rem;">' +
      '<button class="dugme' + (agKuvvetModu ? "" : " dugme-sade") + '" data-ag-kuvvet-gecis="1">' +
        (agKuvvetModu ? "🌐 Dinamik Kuvvet Ağı (Aktif)" : "🌐 Dinamik İlişki Grafiği") +
      "</button>" +
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
    (agKuvvetModu
      ? '<div class="ag-kuvvet-kutusu" style="position:relative; width:100%; height:450px; background:#0B1017; border-radius:8px; overflow:hidden; border:1px solid #1f2e42;">' +
          '<canvas id="agKuvvetCanvas" width="800" height="450" style="width:100%; height:100%; display:block; cursor:grab;"></canvas>' +
          '<div style="position:absolute; bottom:8px; left:12px; font-size:12px; color:#fff; opacity:.85; display:flex; gap:12px; background:rgba(0,0,0,0.5); padding:4px 8px; border-radius:4px;">' +
            '<span style="color:#2ecc71;">● Dostluk</span> <span style="color:#e74c3c;">● Düşmanlık</span> <span style="color:#3498db;">● Akrabalık</span>' +
          '</div>' +
        '</div>'
      : '<div class="ag-tahta-sarici" tabindex="0" role="region" aria-label="Kişilik ağı (kaydırılabilir)">' +
          '<svg viewBox="0 0 ' + genislik + " " + yukseklik + '" width="' + genislik + '" height="' + yukseklik +
            '" class="ag-svg ag-tahta" role="img" aria-label="İlişki ağı">' +
            '<rect width="' + genislik + '" height="' + yukseklik + '" class="ag-pano"/>' +
            cizgiler + noktalar +
          "</svg>" +
        "</div>") +
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
      : '<p class="oyun-not">Bir isme dokun. Düğümleri çekip sürükleyebilirsin. Bağlar türüne göre parlar.</p>') +
    '<div class="ag-aciklama"><span>yeşil: dostluk</span> <span>kırmızı: düşmanlık</span> <span>mavi: akrabalık</span></div>';

  if (agKuvvetModu) {
    setTimeout(function () {
      const cvs = document.querySelector("#agKuvvetCanvas");
      if (cvs) { agKuvvetSimulasyonBaslat(cvs, dugumler, gorunurBaglar); }
    }, 20);
  }
}

let agKuvvetModu = false;
let agKuvvetAnimId = null;

function agKuvvetSimulasyonBaslat(canvas, dugumler, baglar) {
  if (agKuvvetAnimId) { cancelAnimationFrame(agKuvvetAnimId); agKuvvetAnimId = null; }
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  const nodes = dugumler.map(function (d, i) {
    const angle = (i / dugumler.length) * Math.PI * 2;
    return {
      id: d.id, ad: d.ad,
      x: W / 2 + Math.cos(angle) * (W * 0.3) + (Math.random() * 20 - 10),
      y: H / 2 + Math.sin(angle) * (H * 0.3) + (Math.random() * 20 - 10),
      vx: 0, vy: 0, r: 18
    };
  });

  const links = baglar.map(function (b) {
    const s = nodes.find(function (n) { return n.id === b.a; });
    const t = nodes.find(function (n) { return n.id === b.b; });
    const et = String(b.etiket || "").toLowerCase();
    let renk = "#2ecc71"; // dostluk
    if (/düşman|hasım|nefret|rakip|isyan/.test(et)) { renk = "#e74c3c"; }
    else if (/kardeş|anne|baba|çocuk|aile|soy|kan|akraba/.test(et)) { renk = "#3498db"; }
    return { source: s, target: t, renk: renk, etiket: b.etiket };
  }).filter(function (l) { return l.source && l.target; });

  let suruklenen = null;

  canvas.onpointerdown = function (e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    for (let i = 0; i < nodes.length; i++) {
      const dx = nodes[i].x - x, dy = nodes[i].y - y;
      if (Math.hypot(dx, dy) < nodes[i].r + 6) {
        suruklenen = nodes[i];
        break;
      }
    }
  };

  window.addEventListener("pointermove", function (e) {
    if (!suruklenen) { return; }
    const rect = canvas.getBoundingClientRect();
    suruklenen.x = Math.max(20, Math.min(W - 20, (e.clientX - rect.left) * (W / rect.width)));
    suruklenen.y = Math.max(20, Math.min(H - 20, (e.clientY - rect.top) * (H / rect.height)));
    suruklenen.vx = 0; suruklenen.vy = 0;
  });

  window.addEventListener("pointerup", function () { suruklenen = null; });

  function tick() {
    // Kuvvet hesaplamaları (itme & çekme)
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        let dx = n2.x - n1.x, dy = n2.y - n1.y;
        let dist = Math.hypot(dx, dy) || 1;
        if (dist < 180) {
          const force = (180 - dist) / dist * 0.08;
          if (n1 !== suruklenen) { n1.vx -= dx * force; n1.vy -= dy * force; }
          if (n2 !== suruklenen) { n2.vx += dx * force; n2.vy += dy * force; }
        }
      }
      // Merkeze çekim
      if (n1 !== suruklenen) {
        n1.vx += (W / 2 - n1.x) * 0.003;
        n1.vy += (H / 2 - n1.y) * 0.003;
        n1.x += n1.vx; n1.y += n1.vy;
        n1.vx *= 0.85; n1.vy *= 0.85;
      }
    }

    links.forEach(function (l) {
      let dx = l.target.x - l.source.x, dy = l.target.y - l.source.y;
      let dist = Math.hypot(dx, dy) || 1;
      const targetDist = 90;
      const force = (dist - targetDist) * 0.015;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      if (l.source !== suruklenen) { l.source.vx += fx; l.source.vy += fy; }
      if (l.target !== suruklenen) { l.target.vx -= fx; l.target.vy -= fy; }
    });

    // Çizim
    ctx.clearRect(0, 0, W, H);

    // Çizgiler (parlama efekti)
    links.forEach(function (l) {
      ctx.beginPath();
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
      ctx.strokeStyle = l.renk;
      ctx.lineWidth = 2;
      ctx.shadowColor = l.renk;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Düğümler
    nodes.forEach(function (n) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n === suruklenen ? "#3A7CA5" : "#16324A";
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#81CFE0";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.ad.slice(0, 10), n.x, n.y);
    });

    agKuvvetAnimId = requestAnimationFrame(tick);
  }

  agKuvvetAnimId = requestAnimationFrame(tick);
}

/* ==================== 4.4: AKILLI TERİM DEDEKTÖRÜ (SMART TERM DETECTOR) ==================== */

/** Metin içindeki anahtar sözcük ve karakterleri regex ile tarar ve dokunulabilir holo-kart etiketine çevirir */
function akilliTerimDedektoru(metin, evren) {
  if (!metin || typeof metin !== "string") { return metin; }
  const sozluk = (typeof veri !== "undefined" && veri.sozluk) || [];
  const karakterler = (typeof veri !== "undefined" && veri.karakterler) || [];
  const evrenKisiler = (evren && evren.kisiler) || [];
  const evrenYerler = (evren && evren.yerler) || [];

  const kelimeler = new Map();
  sozluk.forEach(function (s) { if (s && s.ad && s.ad.length >= 3) { kelimeler.set(s.ad, { tip: "Kavram", aciklama: s.anlam || s.ozet || "" }); } });
  karakterler.forEach(function (k) { if (k && k.ad && k.ad.length >= 3) { kelimeler.set(k.ad, { tip: "Karakter", aciklama: (k.unvan ? k.unvan + " · " : "") + (k.ozet || "") }); } });
  evrenKisiler.forEach(function (k) { if (k && k.ad && k.ad.length >= 3) { kelimeler.set(k.ad, { tip: "Evren Kişisi", aciklama: (k.unvan ? k.unvan + " · " : "") + (k.ozet || "") }); } });
  evrenYerler.forEach(function (y) { if (y && y.ad && y.ad.length >= 3) { kelimeler.set(y.ad, { tip: "Mekan", aciklama: (y.tur ? y.tur + " · " : "") + (y.ozet || "") }); } });

  if (!kelimeler.size) { return metin; }

  const anahtarlar = Array.from(kelimeler.keys()).sort(function (a, b) { return b.length - a.length; }).slice(0, 40);
  const regex = new RegExp('\\b(' + anahtarlar.map(function (k) { return k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'); }).join('|') + ')\\b', 'g');

  return metin.replace(regex, function (eslesen) {
    const info = kelimeler.get(eslesen);
    if (!info) { return eslesen; }
    return '<span class="akilli-terim" data-holo-ad="' + kacir(eslesen) + '" data-holo-tip="' + kacir(info.tip) + '" data-holo-aciklama="' + kacir(info.aciklama) + '" style="border-bottom: 2px dotted #3A7CA5; cursor: pointer; color: inherit; font-weight: 600; text-decoration: none;">' + eslesen + '</span>';
  });
}

/* Holo-Kart / Tooltip açılışı */
document.addEventListener("click", function (e) {
  const t = e.target.closest && e.target.closest(".akilli-terim");
  if (!t) {
    const eski = document.querySelector("#holoKartTooltip");
    if (eski && !e.target.closest("#holoKartTooltip")) { eski.remove(); }
    return;
  }
  const ad = t.getAttribute("data-holo-ad");
  const tip = t.getAttribute("data-holo-tip") || "Kavram";
  const aciklama = t.getAttribute("data-holo-aciklama") || "Arşiv kaydı inceleniyor.";

  let tooltip = document.querySelector("#holoKartTooltip");
  if (tooltip) { tooltip.remove(); }

  tooltip = document.createElement("div");
  tooltip.id = "holoKartTooltip";
  tooltip.style.cssText = "position:absolute; z-index:9999; width:260px; background:#0B1017; color:#E3EEF7; border:1px solid #3A7CA5; border-radius:8px; padding:10px 12px; box-shadow:0 8px 24px rgba(0,0,0,0.5); font-size:13px; line-height:1.4;";
  tooltip.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">' +
    '<b style="color:#81CFE0; font-size:14px;">' + kacir(ad) + '</b>' +
    '<span style="font-size:10px; text-transform:uppercase; background:#16324A; color:#fff; padding:2px 5px; border-radius:3px;">' + kacir(tip) + '</span>' +
  '</div>' +
  '<p style="margin:0; opacity:.9;">' + kacir(aciklama) + '</p>' +
  '<div style="text-align:right; margin-top:6px;"><button type="button" class="ic-bag" onclick="this.closest(\'#holoKartTooltip\').remove()" style="color:#81CFE0; font-size:11px;">Kapat</button></div>';

  document.body.appendChild(tooltip);
  const rect = t.getBoundingClientRect();
  tooltip.style.left = Math.max(10, Math.min(window.innerWidth - 280, rect.left + window.scrollX)) + "px";
  tooltip.style.top = (rect.bottom + window.scrollY + 6) + "px";
});

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-ag-kuvvet-gecis]")) { agKuvvetModu = !agKuvvetModu; agCiz(); return; }
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
