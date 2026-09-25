/* Keşif — arama, günün kaydı, başlangıç yolu, başarımlar, paylaşım kartı,
   derin bağlantı ve "yeni" rozeti.

   Derin bağlantılar hash tabanlıdır (#/karakter/tari); uygulamaya çevrildiğinde
   WebView içinde de aynı şekilde çalışır. */

/* ==================== YENİ ROZETİ ==================== */

const YENI_GUN = 21;

function yeniMi(kayit) {
  if (!kayit || !kayit.eklendi) { return false; }
  const fark = (Date.now() - new Date(kayit.eklendi + "T00:00:00Z").getTime()) / 86400000;
  return fark >= 0 && fark <= YENI_GUN;
}

/** "yeni" rozeti: kayıt son ziyaretten beri eklendiyse ya da eklendi tarihi yakınsa.
    Son ziyaretten beri değiştiyse "güncellendi". Bkz. 26-ziyaret-yenilikleri.js */
function yeniRozet(kayit) {
  const z = (typeof ziyaretDurumu === "function") ? ziyaretDurumu(kayit) : "";
  if (z === "guncel") { return '<span class="yeni-rozet guncel">güncellendi</span>'; }
  return (z === "yeni" || yeniMi(kayit)) ? '<span class="yeni-rozet">yeni</span>' : "";
}

/** Türkçe karakterleri sadeleştirir: "tari" yazınca "Tarı" bulunsun. */
function trNormal(m) {
  return String(m).toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a");
}

/** Tek harflik yazım hatasına tolerans (Levenshtein <= 1). */
function yakinMi(a, b) {
  if (Math.abs(a.length - b.length) > 1) { return false; }
  if (a === b) { return true; }

  let i = 0, j = 0, fark = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++fark > 1) { return false; }
    if (a.length > b.length) { i++; }
    else if (a.length < b.length) { j++; }
    else { i++; j++; }
  }
  return fark + (a.length - i) + (b.length - j) <= 1;
}

/* ==================== ARAMA ==================== */

let aramaSonuc = [];

/** Bir bölümün hangi sayfada olduğunu söyler. */
function bolumunSayfasi(id) {
  if (typeof sayfaKimlikleri !== "function") { return ""; }
  const m = sayfaKimlikleri();
  const s = Object.keys(m).find(function (x) { return m[x].indexOf(id) !== -1; });
  return s ? (SAYFA_BASLIK[s] || "") : "";
}

function aramaDizini() {
  const d = [];

  (veri.karakterler || []).forEach(function (k, i) {
    d.push({ tur: "Karakter", ad: k.ad, alt: k.unvan, metin: k.ozet + " " + k.detay,
             git: "#/karakter/" + k.id, i: i });
  });

  (veri.evren || []).forEach(function (e, i) {
    d.push({ tur: "Evren", ad: e.baslik, alt: e.bolum, metin: e.ozet + " " + e.metin,
             git: "#/evren/" + e.id, i: i });
  });

  (veri.zamanCizelgesi || []).forEach(function (z) {
    d.push({ tur: "Zaman", ad: z.baslik, alt: z.cag, metin: z.metin, git: "#zaman" });
  });

  (veri.alintilar || []).forEach(function (a) {
    if (a.gizli && !katmanAcik(a.gizli)) { return; }
    d.push({ tur: "Alıntı", ad: a.metin, alt: a.kim, metin: a.metin, git: "#alintilar" });
  });

  (veri.yapimlar || []).forEach(function (y) {
    d.push({ tur: "Yapım", ad: y.ad, alt: y.tur + " · " + y.durum, metin: y.not, git: "#yapimlar" });
  });

  (veri.anlatiOlaylari || []).forEach(function (o) {
    d.push({ tur: "Olay", ad: o.baslik, alt: o.yasanmaSekli, metin: o.anlatim, git: "#olaylar" });
  });

  (veri.kisaHikayeler || []).forEach(function (hk) {
    d.push({ tur: "Hikâye", ad: hk.baslik, alt: "", metin: hk.metin, git: "#kisaHikayeler" });
  });

  (veri.kilitliDosyalar || []).forEach(function (dy) {
    d.push({ tur: "Dosya", ad: dy.ad, alt: dy.katmanAd + " katmanı", metin: dy.aciklama || "", git: "#dosyalar" });
  });

  (veri.isimSozluk || []).forEach(function (s) {
    d.push({ tur: "İsim", ad: s.isim, alt: s.anlam, metin: s.koken + " " + s.anlam, git: "#isim" });
  });

  /* Bölüm adları da aranabilsin: "harita" yazınca harita bölümü çıksın. */
  if (typeof GEZINME !== "undefined") {
    GEZINME.forEach(function (g) {
      g.bolumler.forEach(function (b) {
        d.push({ tur: "Bölüm", ad: b[1], alt: g.ad,
                 metin: b[1] + " " + b[0] + " " + g.ad, git: "#/" + b[0] });
      });
    });
  }

  /* kilitli kanon bölümlerinin kayıtları aramada görünmez; bölüm adları kalır */
  return d.filter(function (k) { return k.tur === "Bölüm" || kanonGitErisimi(k.git); });
}

function ara(sorgu) {
  const q = trNormal(sorgu).trim();

  if (q.length < 2) { aramaSonuc = []; aramaCiz(); return; }

  const parcalar = q.split(/\s+/);

  aramaSonuc = aramaDizini().map(function (kayit) {
    const ad = trNormal(kayit.ad);
    const govde = trNormal(kayit.ad + " " + kayit.alt + " " + kayit.metin);

    let puan = 0;
    parcalar.forEach(function (p) {
      if (ad === p) { puan += 100; }
      else if (ad.indexOf(p) === 0) { puan += 50; }
      else if (ad.indexOf(p) !== -1) { puan += 25; }
      else if (govde.indexOf(p) !== -1) { puan += 5; }
      else if (p.length >= 4 && yakinMi(ad, p)) { puan += 20; }
      else if (p.length >= 5 && govde.split(/\s+/).some(function (w) { return yakinMi(w, p); })) {
        puan += 3;
      }
    });

    return { kayit: kayit, puan: puan };
  }).filter(function (x) { return x.puan > 0; })
    .sort(function (a, b) { return b.puan - a.puan; })
    .slice(0, 12)
    .map(function (x) { return x.kayit; });

  aramaCiz();
}

function aramaCiz() {
  const kutu = document.querySelector("#aramaSonuc");
  if (!kutu) { return; }

  const giris = document.querySelector("#aramaGiris");
  const bos = !giris || giris.value.trim().length < 2;

  if (bos) { kutu.innerHTML = ""; kutu.hidden = true; return; }

  kutu.hidden = false;

  if (!aramaSonuc.length) {
    kutu.innerHTML = '<div class="arama-bos">Sonuç yok.</div>';
    return;
  }

  kutu.innerHTML = aramaSonuc.map(function (s) {
    return '<a class="arama-satir" href="' + s.git + '" data-arama-git="1">' +
             '<span class="arama-tur">' + kacir(s.tur) + "</span>" +
             '<span class="arama-govde">' +
               '<span class="arama-ad">' + kacir(s.ad) + "</span>" +
               '<span class="arama-alt">' + kacir(s.alt) + "</span>" +
             "</span>" +
             (function () {
               /* sonuç başka sayfadaysa hangi sayfada olduğunu söyle */
               const hedef = String(s.git || "").replace(/^#\/?/, "").split("/")[0];
               const sf = (typeof bolumunSayfasi === "function") ? bolumunSayfasi(hedef) : "";
               const tur = (typeof aktifSayfa !== "undefined" && typeof SAYFA_BASLIK !== "undefined")
                 ? SAYFA_BASLIK[aktifSayfa] : "";
               if (!sf || sf === tur) { return ""; }
               return '<span class="arama-sayfa">' + kacir(sf) + "</span>";
             })() +
           "</a>";
  }).join("");
}

/* ==================== GÜNÜN KAYDI ==================== */

const GUNUN_ANAHTAR = "gunun_kaydi";

function bugunAnahtari() {
  return new Date().toISOString().slice(0, 10);
}

/** Tarihe göre değişen ama gün içinde sabit kalan seçim. */
function gununSecimi() {
  const liste = (bolumErisimi("arsiv") ? (veri.karakterler || []) : []).concat(bolumErisimi("evren") ? (veri.evren || []) : []);
  if (!liste.length) { return null; }

  const t = bugunAnahtari();
  let tohum = 0;
  for (let i = 0; i < t.length; i++) { tohum = (tohum * 31 + t.charCodeAt(i)) >>> 0; }

  const o = liste[tohum % liste.length];
  const karakterMi = !!o.ad;

  return {
    ad: karakterMi ? o.ad : o.baslik,
    alt: karakterMi ? o.unvan : o.bolum,
    ozet: o.ozet,
    git: (karakterMi ? "#/karakter/" : "#/evren/") + o.id
  };
}

function gununCiz() {
  const alan = document.querySelector("#gununAlan");
  if (!alan) { return; }

  const s = gununSecimi();
  if (!s) { alan.innerHTML = ""; return; }

  const alindi = kilitAcik(GUNUN_ANAHTAR + "_" + bugunAnahtari());

  alan.innerHTML =
    '<a class="gunun-kart" href="' + s.git + '" data-gunun-git="1">' +
      '<span class="gunun-etiket">bugünün kaydı</span>' +
      '<span class="gunun-ad">' + kacir(s.ad) + "</span>" +
      '<span class="gunun-alt">' + kacir(s.alt) + "</span>" +
      '<span class="gunun-ozet">' + kacir(s.ozet) + "</span>" +
      (alindi ? "" : '<span class="gunun-odul">+' + veri.gununOdul + " " + birim() + "</span>") +
    "</a>";
}

function gununOkundu() {
  const anahtar = GUNUN_ANAHTAR + "_" + bugunAnahtari();
  if (kilitAcik(anahtar)) { return; }

  cuzdan.acilan.push(anahtar);
  cuzdanKaydet();
  eckaKazan(veri.gununOdul, "Bugünün kaydı");
  gununCiz();
  if (typeof gunlukOzetCiz === "function") { gunlukOzetCiz(); }
}

/* ==================== BAŞLANGIÇ YOLU ==================== */

function baslangicCiz() {
  const alan = document.querySelector("#baslangicAlan");
  if (!alan || !veri.baslangic) { return; }

  alan.innerHTML = '<ol class="yol">' + veri.baslangic.map(function (b, i) {
    return '<li><a href="' + b.hedef + '">' +
             '<span class="yol-no">' + (i + 1) + "</span>" +
             '<span class="yol-govde"><b>' + kacir(b.ad) + "</b>" +
               "<span>" + kacir(b.not) + "</span></span>" +
           "</a></li>";
  }).join("") + "</ol>";
}

/* ==================== BAŞARIMLAR ==================== */

function basarimListesi() {
  const kilitler = veri.katmanlar || [];
  const cozulen = kilitler.filter(function (k) { return !!cozulenler[k.dogrulama]; }).length;

  const galeri = veri.galeri || [];
  const galeriAcik = galeri.filter(function (g) {
    return g.fiyat === 0 || kilitAcik("galeri_" + g.id);
  }).length;

  return [
    { ad: "Çözülen katman", simdi: cozulen, hedef: kilitler.length },
    { ad: "Bitirilen oyun", simdi: bitirilenSayisi(), hedef: OYUNLAR.length },
    { ad: "Açılan galeri", simdi: galeriAcik, hedef: galeri.length },
    { ad: "Okunan roman bölümü", simdi: romanAcikSayisi(), hedef: (veri.roman.bolumler || []).length },
    { ad: "Kişilik testi", simdi: kilitAcik("test_odulu") ? 1 : 0, hedef: 1 }
  ];
}

function basarimCiz() {
  const alan = document.querySelector("#basarimAlan");
  if (!alan) { return; }

  const liste = basarimListesi();
  const toplam = liste.reduce(function (t, b) { return t + b.simdi; }, 0);
  const hedef = liste.reduce(function (t, b) { return t + b.hedef; }, 0);
  const yuzde = hedef ? Math.round((toplam / hedef) * 100) : 0;

  alan.innerHTML =
    '<div class="basarim-ust">' +
      '<span class="basarim-yuzde">%' + yuzde + "</span>" +
      '<span class="basarim-alt">arşivin ' + toplam + " / " + hedef + " parçası açık</span>" +
    "</div>" +
    '<div class="basarim-cubuk"><span style="width:' + yuzde + '%"></span></div>' +
    liste.map(function (b) {
      const o = b.hedef ? Math.round((b.simdi / b.hedef) * 100) : 0;
      return '<div class="basarim-satir">' +
               "<span>" + kacir(b.ad) + "</span>" +
               "<span><b>" + b.simdi + "</b> / " + b.hedef + "</span>" +
               '<div class="basarim-mini"><span style="width:' + o + '%"></span></div>' +
             "</div>";
    }).join("") +
    '<div class="basarim-cuzdan">Toplam kazanç <b>' + cuzdan.kazanilan + " " + birim() +
      "</b> · harcama <b>" + cuzdan.harcanan + " " + birim() + "</b></div>";
}

/* ==================== PAYLAŞIM KARTI ==================== */

/** Test sonucunu paylaşılabilir bir görsele çevirir. */
function paylasimKarti(sonucId) {
  const s = veri.test.sonuclar[sonucId];
  if (!s) { return null; }

  const en = 1080;
  const tuval = document.createElement("canvas");
  tuval.width = en;
  tuval.height = en;

  const c = tuval.getContext ? tuval.getContext("2d") : null;

  if (!c) { return null; }   /* canvas desteklenmiyor */

  /* zemin */
  c.fillStyle = "#F4F9FD";
  c.fillRect(0, 0, en, en);

  /* donmuş okyanus şeridi */
  const g = c.createLinearGradient(0, en * 0.62, 0, en);
  g.addColorStop(0, "#DFEDF8");
  g.addColorStop(1, "#B8D6EC");
  c.fillStyle = g;
  c.fillRect(0, en * 0.62, en, en * 0.38);

  c.strokeStyle = "#B8D6EC";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(0, en * 0.62);
  c.lineTo(en, en * 0.62);
  c.stroke();

  /* çatlaklar */
  c.strokeStyle = "rgba(28,92,150,.35)";
  c.lineWidth = 3;
  [[0.16, 0.28], [0.44, 0.36], [0.72, 0.62], [0.9, 0.8]].forEach(function (p) {
    c.beginPath();
    c.moveTo(en * p[0], en);
    c.lineTo(en * p[1], en * 0.62);
    c.stroke();
  });

  /* kırmızı yerine deniz mavisi dikey çizgi */
  c.fillStyle = "#1C5C96";
  c.fillRect(96, 150, 6, 150);

  c.fillStyle = "#1C5C96";
  c.font = "500 30px ui-monospace, monospace";
  c.fillText(s.unvan.toLocaleUpperCase("tr"), 130, 190);

  c.fillStyle = "#0A0F14";
  c.font = "700 128px Georgia, serif";
  c.fillText(s.ad, 126, 300);

  /* açıklama — satır kaydırma */
  c.fillStyle = "#3D4A57";
  c.font = "36px system-ui, sans-serif";

  const kelimeler = s.aciklama.split(" ");
  let satir = "";
  let y = 400;

  kelimeler.forEach(function (k) {
    const deneme = satir + k + " ";
    if (c.measureText(deneme).width > en - 250 && satir) {
      c.fillText(satir, 126, y);
      satir = k + " ";
      y += 52;
    } else {
      satir = deneme;
    }
  });
  c.fillText(satir, 126, y);

  c.fillStyle = "#0D3560";
  c.font = "500 30px ui-monospace, monospace";
  c.fillText("TentiforApp · Hangi görevlisin?", 126, en - 90);

  return tuval;
}

async function sonucPaylas(sonucId) {
  const tuval = paylasimKarti(sonucId);
  if (!tuval) { return; }

  const blob = await new Promise(function (r) { tuval.toBlob(r, "image/png"); });
  if (!blob) { return; }

  const dosya = new File([blob], "tentifor-sonuc.png", { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [dosya] })) {
    try {
      await navigator.share({ files: [dosya], title: "Hangi görevlisin?" });
      return;
    } catch (e) { /* kullanıcı vazgeçti ya da desteklenmiyor */ }
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tentifor-sonuc.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}

/* ==================== DERİN BAĞLANTI ==================== */


/** Bir bölüme yumuşak kaydırır. (Bir düzenlemede kazara silinmişti.) */
function bolumeGit(id) {
  const el = document.getElementById(id);
  if (el && el.scrollIntoView) { el.scrollIntoView({ behavior: "smooth", block: "start" }); }
}

function baglantiyiUygula() {
  const h = location.hash;
  if (h.indexOf("#/") !== 0) { return; }

  const parca = h.slice(2).split("/");
  const tur = parca[0];
  const id = decodeURIComponent(parca[1] || "");

  if ((tur === "karakter" && !bolumErisimi("arsiv")) || (tur === "evren" && !bolumErisimi("evren"))) { return; }

  if (tur === "karakter") {
    const i = (veri.karakterler || []).findIndex(function (k) { return k.id === id; });
    if (i !== -1) { karakterAc(i); }
    return;
  }

  if (tur === "evren") {
    const i = (veri.evren || []).findIndex(function (e) { return e.id === id; });
    if (i === -1) { return; }

    evrenFiltre = "hepsi";
    cizEvren();

    const el = document.querySelector('[data-madde="' + i + '"]');
    if (el) {
      el.classList.add("acik");
      el.scrollIntoView && el.scrollIntoView({ block: "center" });
    }
  }
}

function baglantiKopyala(id, tur) {
  const url = location.origin + location.pathname + "#/" + tur + "/" + id;

  panoyaKopyala(url).then(function () {
    eckaBildir("Bağlantı kopyalandı");
  }).catch(function () {
    eckaBildir(url);
  });
}

/* ==================== olaylar ==================== */

document.addEventListener("input", function (e) {
  if (e.target.id === "aramaGiris") { ara(e.target.value); }
});

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-arama-git]")) {
    const giris = document.querySelector("#aramaGiris");
    if (giris) { giris.value = ""; }
    aramaSonuc = [];
    aramaCiz();
    setTimeout(baglantiyiUygula, 60);
    return;
  }

  if (e.target.closest("[data-gunun-git]")) {
    gununOkundu();
    setTimeout(baglantiyiUygula, 60);
    return;
  }

  const p = e.target.closest("[data-paylas]");
  if (p) { sonucPaylas(p.dataset.paylas); return; }

  const b = e.target.closest("[data-baglanti]");
  if (b) { baglantiKopyala(b.dataset.baglanti, b.dataset.baglantiTur || "karakter"); }
});

window.addEventListener("hashchange", baglantiyiUygula);
