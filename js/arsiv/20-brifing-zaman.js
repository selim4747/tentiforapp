/* Dokuzuncu dalga — site tamlığı, SVG zaman çizelgesi, vurgulama, rastgele brifing. */

/* ==================== SİTE TAMLIĞI ==================== */

function tamlikHesapla() {
  const o = (typeof arsivciOlculeri === "function") ? arsivciOlculeri() : null;
  if (!o) { return null; }

  let okunanKarakter = 0;
  try {
    const g = JSON.parse(kayitOku("tentiforapp_okuma_gecmis") || "[]");
    okunanKarakter = new Set(g.filter(function (x) { return x.tur === "karakter"; })
      .map(function (x) { return x.id; })).size;
  } catch (e) { /* yoksay */ }

  const parcalar = [
    { ad: "karakterler okundu", agirlik: 3, oran: okunanKarakter / Math.max(1, (veri.karakterler || []).length) },
    { ad: "katmanlar çözüldü", agirlik: 3, oran: o.katman / Math.max(1, o.katmanToplam) },
    { ad: "oyunlar bitirildi", agirlik: 2, oran: o.oyun / Math.max(1, o.oyunToplam) },
    { ad: "galeri açıldı", agirlik: 1, oran: o.galeri / Math.max(1, o.galeriToplam) },
    { ad: "günler geldi", agirlik: 1, oran: Math.min(1, o.gun / 14) },
  ];

  const agirlikToplam = parcalar.reduce(function (t, p) { return t + p.agirlik; }, 0);
  const puan = parcalar.reduce(function (t, p) { return t + p.agirlik * p.oran; }, 0);

  return { yuzde: Math.round((puan / agirlikToplam) * 100), parcalar: parcalar };
}

function tamlikCiz() {
  const alan = document.querySelector("#tamlikAlan");
  if (!alan) { return; }

  const t = tamlikHesapla();
  if (!t) { return; }

  alan.innerHTML =
    '<div class="tamlik">' +
      '<div class="tamlik-halka">' +
        '<svg viewBox="0 0 100 100" width="92" height="92">' +
          '<circle cx="50" cy="50" r="42" class="tamlik-arka"/>' +
          '<circle cx="50" cy="50" r="42" class="tamlik-on" style="stroke-dasharray:' +
            (t.yuzde * 2.64) + " 264" + '"/>' +
        "</svg>" +
        '<span class="tamlik-sayi">%' + t.yuzde + "</span>" +
      "</div>" +
      '<div class="tamlik-liste">' +
        t.parcalar.map(function (p) {
          return '<div class="tamlik-satir"><span>' + kacir(p.ad) + "</span>" +
                 '<span class="tamlik-oran">%' + Math.round(p.oran * 100) + "</span></div>";
        }).join("") +
      "</div>" +
    "</div>";
}

/* ==================== SVG ZAMAN ÇİZELGESİ ==================== */

function zamanSvgCiz() {
  const alan = document.querySelector("#zamanSvgAlan");
  if (!alan || !veri.zamanCizelgesi) { return; }

  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();
  const adimlar = veri.zamanCizelgesi;
  const genislik = Math.max(720, adimlar.length * 64);
  const y = 60;

  const noktalar = adimlar.map(function (z, i) {
    const acik = yonetici || (katmanAcik(z.gizli) && spoilerUygun(z.gizli));
    const x = 40 + i * ((genislik - 80) / Math.max(1, adimlar.length - 1));
    return { x: x, z: z, acik: acik };
  });

  const cizgi = noktalar.map(function (n) { return n.x + "," + y; }).join(" ");

  alan.innerHTML =
    '<div class="zaman-svg-saril">' +
      '<svg viewBox="0 0 ' + genislik + ' 120" class="zaman-svg" style="min-width:' + genislik + 'px">' +
        '<polyline points="' + cizgi + '" class="zsvg-hat"/>' +
        noktalar.map(function (n, i) {
          return '<g class="zsvg-nokta' + (n.acik ? "" : " kapali") + '" ' +
                   'data-zsvg="' + i + '" tabindex="0" role="button" ' +
                   'aria-label="' + kacir(n.acik ? n.z.baslik : "Kilitli adım") + '">' +
                   '<circle cx="' + n.x + '" cy="' + y + '" r="7"/>' +
                   '<text x="' + n.x + '" y="' + (y + 26) + '" text-anchor="middle">' +
                     kacir(String(n.z.no)) + "</text>" +
                 "</g>";
        }).join("") +
      "</svg>" +
    "</div>" +
    '<div id="zsvgDetay" class="zsvg-detay"></div>';
}

function zsvgAc(indeks) {
  const kutu = document.querySelector("#zsvgDetay");
  if (!kutu) { return; }

  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();
  const z = (veri.zamanCizelgesi || [])[indeks];
  if (!z) { return; }

  const acik = yonetici || (katmanAcik(z.gizli) && spoilerUygun(z.gizli));

  kutu.innerHTML = acik
    ? '<div class="zsvg-etiket">' + kacir(z.cag) + "</div>" +
      "<h4>" + kacir(z.baslik) + "</h4><p>" + kacir(z.metin) + "</p>"
    : '<p class="oyun-not">Bu adım henüz buz altında.</p>';
}

/* ==================== AİLE AĞACI: SVG BAĞLANTILAR ====================
   Kutular arası ilişkiyi çizgiyle göstermek için basit bir bağ listesi.
   Konumlar CSS ızgarasından değil, kutuların gerçek konumundan okunur. */

const AILE_BAGLARI = [
  { a: "Geceg Luyot", b: "Yulkom Luyot", tur: "cocuk" },
  { a: "Afrı Bura", b: "Yulkom Luyot", tur: "cocuk" },
  { a: "Yulkom Luyot", b: "Feil Luyot", tur: "cocuk" },
  { a: "Yulkom Luyot", b: "Saek Luyot", tur: "cocuk" },
  { a: "Nudhal Sarı", b: "Feil Luyot", tur: "cocuk" },
  { a: "Nudhal Sarı", b: "Saek Luyot", tur: "cocuk" },
  { a: "Pıda Luyot", b: "Kaelan Luyot", tur: "cocuk" },
  { a: "Ültö Sanu", b: "Kaelan Luyot", tur: "cocuk" },
  { a: "Pileg", b: "İki çocuk", tur: "cocuk" },
];

function aileCizgileriCiz() {
  const sarici = document.querySelector("#aileAlan .aile");
  if (!sarici) { return; }

  let svg = sarici.querySelector(".aile-svg");
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "aile-svg");
    sarici.style.position = "relative";
    sarici.insertBefore(svg, sarici.firstChild);
  }

  const kutu = sarici.getBoundingClientRect();
  if (!kutu.width) { return; }

  svg.setAttribute("width", kutu.width);
  svg.setAttribute("height", kutu.height);
  svg.setAttribute("viewBox", "0 0 " + kutu.width + " " + kutu.height);

  const adBul = function (ad) {
    return [].slice.call(sarici.querySelectorAll(".aile-ad"))
      .find(function (el) { return el.textContent.trim() === ad; });
  };

  const cizgiler = AILE_BAGLARI.map(function (bag) {
    const elA = adBul(bag.a);
    const elB = adBul(bag.b);
    if (!elA || !elB) { return ""; }

    const ka = elA.closest(".aile-kisi").getBoundingClientRect();
    const kb = elB.closest(".aile-kisi").getBoundingClientRect();

    const x1 = ka.left - kutu.left + ka.width / 2;
    const y1 = ka.bottom - kutu.top;
    const x2 = kb.left - kutu.left + kb.width / 2;
    const y2 = kb.top - kutu.top;
    const ortaY = (y1 + y2) / 2;

    return '<path d="M' + x1 + " " + y1 + " C " + x1 + " " + ortaY + ", " +
           x2 + " " + ortaY + ", " + x2 + " " + y2 + '" class="aile-cizgi"/>';
  }).join("");

  svg.innerHTML = cizgiler;
}

/* ==================== VURGULAMA ====================
   Okuma metninde bir seçim yapılınca "vurgula" balonu çıkar. Vurgular
   yalnızca bu tarayıcıda saklanır, sayfa yeniden açıldığında geri gelir. */

const VURGU_ANAHTAR = "tentiforapp_vurgular";

function vurguListesi() {
  try { return JSON.parse(kayitOku(VURGU_ANAHTAR) || "[]"); } catch (e) { return []; }
}

/** Vurguyu kaydeder; nerede okunduğu (bağlam: sayfa, kutu, roman bölümü) da yazılır, "Yerinde oku" oraya döner. */
function vurguKaydet(metin, kaynak) {
  const b = vurguBaglami();
  const liste = vurguListesi();
  let v = liste.find(function (x) { return x.metin === metin; });
  if (!v) {
    v = { metin: metin, kaynak: kaynak || b.baslik || "", t: Date.now() };
    liste.push(v);
    if (liste.length > 100) { liste.shift(); }
  }
  if (!v.git && !v.roman) {
    if (b.git) { v.git = b.git; }
    if (b.oku) { v.oku = b.oku; }
    if (b.roman) { v.roman = b.roman; }
    if (!v.kaynak && b.baslik) { v.kaynak = b.baslik; }
  }
  kayitYaz(VURGU_ANAHTAR, JSON.stringify(liste));
  vurgularimCiz();
  setTimeout(isaretleriTazele, 50);   /* metindeki işaretler */
}

let vurguBalonu = null;

function vurguSecimDenetle() {
  const secim = window.getSelection ? window.getSelection() : null;
  if (!secim || secim.isCollapsed || !secim.toString().trim()) { vurguBalonuKapat(); return; }
  const metin = secim.toString().replace(/\s+/g, " ").trim();
  if (metin.length < 4 || metin.length > 400) { vurguBalonuKapat(); return; }
  const kapsayici = secim.anchorNode && (secim.anchorNode.nodeType === 1 ? secim.anchorNode : secim.anchorNode.parentElement);
  const okumaAlani = kapsayici && kapsayici.closest && kapsayici.closest(VURGU_SECICI);
  if (!okumaAlani || okumaAlani.closest("[contenteditable], textarea")) { vurguBalonuKapat(); return; }
  const kutu = secim.getRangeAt(0).getBoundingClientRect();
  vurguBalonuKapat();
  const b = document.createElement("button");
  b.className = "vurgu-balon";
  b.textContent = "✎ altını çiz";
  b.style.top = Math.max(window.scrollY + 4, window.scrollY + kutu.top - 42) + "px";
  b.style.left = Math.max(8, Math.min(window.scrollX + kutu.left + kutu.width / 2 - 48, window.scrollX + document.documentElement.clientWidth - 110)) + "px";
  b.dataset.vurguMetin = metin;
  document.body.appendChild(b);
  vurguBalonu = b;
}

function vurguBalonuKapat() {
  if (vurguBalonu) { vurguBalonu.remove(); vurguBalonu = null; }
}

function vurgularimCiz() {
  const alan = document.querySelector("#vurguAlan");
  if (!alan) { return; }
  const liste = vurguListesi().slice().reverse();
  alan.innerHTML = liste.length
    ? '<div class="alinti-izgara vurgu-liste">' + liste.map(function (v) {
        const tarih = v.t ? new Date(v.t).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "";
        return '<figure class="alinti vurgu-kart"><blockquote>' + kacir(v.metin) + "</blockquote>" +
          "<figcaption>" + kacir([v.kaynak, tarih].filter(Boolean).join(" · ")) + "</figcaption>" +
          '<div class="vurgu-eylem">' +
            (v.git || v.roman ? '<button type="button" class="dugme dugme-sade y-kucuk" data-vurgu-git="' + kacir(v.t) + '">↗ Yerinde oku</button>' : "") +
            '<button type="button" class="dugme dugme-sade y-kucuk" data-vurgu-kart="' + kacir(v.t) + '">🖼 Kart</button>' +
            '<button type="button" class="dugme dugme-sade y-kucuk" data-vurgu-sil="' + kacir(v.t) + '" aria-label="Vurguyu sil">✕</button>' +
          "</div></figure>";
      }).join("") + "</div>"
    : '<p class="oyun-not">Okurken bir cümle seç, çıkan "✎ altını çiz" düğmesine bas. Vurguların metinde işaretli görünür, buradan yerine dönersin.</p>';
}

/* ==================== RASTGELE BRİFİNG ==================== */

function brifingUret() {
  /* kilitli kanon bölümleri brifingde de görünmez */
  const kar = bolumErisimi("arsiv") ? (veri.karakterler || []) : [];
  const alnt = (bolumErisimi("alintilar") ? (veri.alintilar || []) : []).filter(function (a) { return katmanAcik(a.gizli) && spoilerUygun(a.gizli); });
  const evr = (bolumErisimi("evren") ? (veri.evren || []) : []).filter(function (e) {
    if (!e.gizli || !e.gizli.length) { return true; }
    return e.gizli.every(function (g) { return katmanAcik(g.katman) && spoilerUygun(g.katman); });
  });

  if (!kar.length) { return null; }

  const k = kar[Math.floor(rast01() * kar.length)];
  const a = alnt.length ? alnt[Math.floor(rast01() * alnt.length)] : null;
  const e = evr.length ? evr[Math.floor(rast01() * evr.length)] : null;

  return { karakter: k, alinti: a, evren: e };
}

function brifingCiz() {
  const alan = document.querySelector("#brifingAlan");
  if (!alan) { return; }

  const b = brifingUret();
  /* kilitli kanonda brifing boş kalır; başlığıyla birlikte gizlenir */
  if (alan.parentElement) { alan.parentElement.hidden = !bolumErisimi("arsiv"); }
  if (!b) { alan.innerHTML = bolumErisimi("arsiv") ? '<p class="oyun-not">Henüz brifing hazırlanamadı.</p>' : ""; return; }

  alan.innerHTML =
    '<div class="brifing">' +
      '<div class="brifing-etiket">bugünün brifingi</div>' +
      '<button class="brifing-kisi" data-brifing-karakter="' + kacir(b.karakter.id) + '">' +
        '<span class="brifing-ad">' + kacir(b.karakter.ad) + "</span>" +
        '<span class="brifing-unvan">' + kacir(b.karakter.unvan) + "</span>" +
      "</button>" +
      (b.alinti
        ? '<blockquote class="brifing-alinti">' + kacir(b.alinti.metin) +
          '<cite>— ' + kacir(b.alinti.kim) + "</cite></blockquote>"
        : "") +
      (b.evren
        ? '<div class="brifing-evren"><b>' + kacir(b.evren.baslik) + ":</b> " +
          kacir(b.evren.ozet) + "</div>"
        : "") +
    "</div>" +
    '<button class="dugme dugme-sade" id="brifingYenile">Yeni brifing</button>';
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const zn = e.target.closest("[data-zsvg]");
  if (zn) { zsvgAc(parseInt(zn.dataset.zsvg, 10)); return; }

  if (e.target.closest(".vurgu-balon")) {
    const metin = e.target.dataset.vurguMetin;
    const bolum = e.target.closest ? null : null;
    let kaynak = "";
    const secim = window.getSelection ? window.getSelection() : null;
    if (secim && secim.anchorNode) {
      const b = secim.anchorNode.parentElement &&
        secim.anchorNode.parentElement.closest("section.bolum");
      const h = b && b.querySelector("h2, h3");
      kaynak = h ? h.textContent : "";
    }
    vurguKaydet(metin, kaynak);
    vurguBalonuKapat();
    if (window.getSelection) { window.getSelection().removeAllRanges(); }
    eckaBildir("Vurgulandı");
    return;
  }

  if (e.target.closest("#brifingYenile")) { brifingCiz(); return; }

  const bk = e.target.closest("[data-brifing-karakter]");
  if (bk) {
    const i = (veri.karakterler || []).findIndex(function (k) { return k.id === bk.dataset.brifingKarakter; });
    if (i !== -1) { karakterAc(i); }
  }
});

document.addEventListener("mouseup", function (e) {
  if (e.target.closest(".vurgu-balon")) { return; }
  setTimeout(vurguSecimDenetle, 10);
});
document.addEventListener("touchend", function () { setTimeout(vurguSecimDenetle, 10); });

document.addEventListener("scroll", function () {
  if (vurguBalonu) { vurguBalonuKapat(); }
}, { passive: true });

/* zaman çizelgesi yeniden boyutlanınca aile bağları yeniden hizalansın */
window.addEventListener("resize", function () {
  if (typeof aileCizgileriCiz === "function") { aileCizgileriCiz(); }
});

/* ==================== GÜNLÜK ÖZET ====================
   Günün kaydı, günün görevi ve günün bulmacası ayrı ayrı bölümlerde
   duruyordu. Bu widget üçünü tek bakışta gösteren bir "Bugün" kartı. */

function gunlukOzetCiz() {
  try { bugunKartiCiz(); } catch (_) { /* yok */ }   /* Keşif'te "bugün" kartı (62-ilk-deneyim) */
  const alan = document.querySelector("#gunlukOzetAlan");
  if (!alan) { return; }

  const bugun = bugunAnahtari();

  const kayitAlindi = kilitAcik(GUNUN_ANAHTAR + "_" + bugun);
  const gorev = (typeof gununGorevi === "function") ? gununGorevi() : null;
  const gorevAlindi = kilitAcik("gorev_" + bugununAdi());
  const gorevHedef = gorev ? (GOREV_HEDEF[gorev.id] || 1) : 0;
  const gorevSimdi = gorev ? Math.min(gorevHedef, gorevDurum(gorev.id)) : 0;
  const bulmacaCozuldu = kilitAcik("bulmaca_" + bugununAdi());
  const seri = (typeof seriHesapla === "function") ? seriHesapla() : 0;

  const satirlar = [
    { ad: "Kayıt", tamam: kayitAlindi, git: "kesif", detay: kayitAlindi ? "okundu" : "henüz okunmadı" },
    { ad: "Görev", tamam: gorevAlindi, gorevMi: true,
      git: "arsivci", detay: gorev ? (gorevSimdi + " / " + gorevHedef) : "yok",
      nasil: (gorev && !gorevAlindi && typeof GOREV_REHBER !== "undefined" && GOREV_REHBER[gorev.id])
        ? GOREV_REHBER[gorev.id].nasil : "" },
    { ad: "Bulmaca", tamam: bulmacaCozuldu, git: "arsivci",
      detay: bulmacaCozuldu ? "çözüldü" : "bekliyor" },
  ];

  const tamamSayisi = satirlar.filter(function (s) { return s.tamam; }).length;

  alan.innerHTML =
    '<div class="gunluk-ozet">' +
      '<div class="go-ust">' +
        '<span class="go-etiket">bugün</span>' +
        (seri > 0 ? '<span class="go-seri">' + seri + " gün seri</span>" : "") +
      "</div>" +
      '<div class="go-satirlar">' +
        satirlar.map(function (s) {
          return '<button class="go-satir' + (s.tamam ? " tamam" : "") +
                 '" data-gunluk-git="' + s.git + '"' +
                 (s.gorevMi ? ' data-gunluk-gorev="1"' : "") + '>' +
                   '<span class="go-isaret">' + (s.tamam ? "✓" : "○") + "</span>" +
                   '<span class="go-govde">' +
                     '<span class="go-satir-ust"><span class="go-ad">' + kacir(s.ad) + "</span>" +
                       '<span class="go-detay">' + kacir(s.detay) + "</span></span>" +
                     (s.nasil ? '<span class="go-nasil">' + kacir(s.nasil) + "</span>" : "") +
                   "</span>" +
                 "</button>";
        }).join("") +
      "</div>" +
      (tamamSayisi === 3
        ? '<div class="go-bitti">Bugün için hepsi tamam. Yarın yeni bir gün.</div>'
        : '<div class="go-kalan">' + (3 - tamamSayisi) + " tanesi kaldı</div>") +
    "</div>";
}

document.addEventListener("click", function (e) {
  const g = e.target.closest("[data-gunluk-git]");
  if (!g) { return; }

  /* Görev satırı doğrudan görevin yapıldığı yere götürür (Göreve git ile
     aynı davranış), diğerleri yalnızca ilgili bölüme gider. */
  if (g.dataset.gunlukGorev && typeof goreveGit === "function") {
    goreveGit();
    return;
  }

  const hedefSayfa = g.dataset.gunlukGit;
  const m = (typeof sayfaKimlikleri === "function") ? sayfaKimlikleri() : null;

  if (m) {
    const sahip = Object.keys(m).find(function (x) { return m[x].indexOf(hedefSayfa) !== -1; });
    if (sahip && sahip !== aktifSayfa) { location.hash = "#/" + hedefSayfa; return; }
  }

  if (typeof bolumeGit === "function") { bolumeGit(hedefSayfa); }
});

/* ==================== DIŞA AKTARIM ====================
   Notlar, vurgular ve okuma geçmişini tek bir metin dosyası hâlinde indirir.
   Tamamen yerel; hiçbir yere gönderilmez. */

function okumaGunlugunuUret() {
  const bugun = new Date().toLocaleDateString("tr-TR");
  const satirlar = ["TENTIFORAPP — OKUMA GÜNLÜĞÜ", bugun, ""];

  /* notlar */
  const notlar = jsonOku("tentiforapp_notlar", {}) || {};
  const notAnahtarlari = Object.keys(notlar).filter(function (k) { return notlar[k]; });

  satirlar.push("== NOTLARIN ==");
  if (notAnahtarlari.length) {
    notAnahtarlari.forEach(function (kimlik) {
      const k = (veri.karakterler || []).find(function (x) { return x.id === kimlik; });
      satirlar.push("");
      satirlar.push("· " + (k ? k.ad : kimlik));
      satirlar.push(notlar[kimlik]);
    });
  } else {
    satirlar.push("(henüz not yok)");
  }

  /* vurgular */
  satirlar.push("", "== VURGULARIN ==");
  const vurgular = (typeof vurguListesi === "function") ? vurguListesi() : [];
  if (vurgular.length) {
    vurgular.forEach(function (v) {
      satirlar.push("");
      satirlar.push('"' + v.metin + '"');
      if (v.kaynak) { satirlar.push("— " + v.kaynak); }
    });
  } else {
    satirlar.push("(henüz vurgu yok)");
  }

  /* okuma gecmisi */
  satirlar.push("", "== GEZDİĞİN KAYITLAR ==");
  let gecmis = [];
  try { gecmis = JSON.parse(kayitOku("tentiforapp_okuma_gecmis") || "[]"); } catch (e) { gecmis = []; }
  if (gecmis.length) {
    gecmis.slice().reverse().forEach(function (g) {
      satirlar.push("· " + g.ad + " (" + new Date(g.t).toLocaleDateString("tr-TR") + ")");
    });
  } else {
    satirlar.push("(henüz kayıt gezmedin)");
  }

  satirlar.push("", "—", "tentiforapp içinden dışa aktarıldı, hiçbir yere gönderilmedi.");
  return satirlar.join("\n");
}

function okumaGunlugunuIndir() {
  const metin = okumaGunlugunuUret();
  const blob = new Blob([metin], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "tentiforapp-okuma-gunlugu.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

  eckaBildir("Okuma günlüğü indirildi");
}

document.addEventListener("click", function (e) {
  if (e.target.closest("#disaAktarBtn")) { okumaGunlugunuIndir(); }
});
