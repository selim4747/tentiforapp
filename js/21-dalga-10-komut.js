/* Onuncu dalga — Komut Paleti, Karakter Sohbeti, Moodboard. */

/* ==================== KOMUT PALETİ ====================
   Ctrl/Cmd+K ile açılır. Yazdıkça karakterlere, evren maddelerine, araçlara
   ve sayfalara anında zıplar. Site 44 evren + 23 karakter + çok sayıda araca
   çıktı; artık böyle bir hızlandırıcı gerekiyor. */

let komutAcik = false;
let komutSecili = 0;

/** Sabit komutlar: sayfalar ve araçlar. Karakterler/evren maddeleri
    dinamik olarak arama anında eklenir. */
function komutSabitListesi() {
  const liste = [];

  GEZINME.forEach(function (g) {
    g.bolumler.forEach(function (b) {
      liste.push({ tur: "Git", ad: b[1], alt: g.ad, eylem: function () { location.hash = "#/" + b[0]; } });
    });
  });

  liste.push(
    { tur: "Araç", ad: "Kimlik Sınavı", alt: "Oyunlar", eylem: function () { location.hash = "#/kimlik"; } },
    { tur: "Araç", ad: "Rastgele keşfet", alt: "Keşif",
      eylem: function () { if (typeof rastgeleKesif === "function") { rastgeleKesif(); } } },
    { tur: "Araç", ad: "Okuma günlüğünü indir", alt: "Dışa aktar",
      eylem: function () { if (typeof okumaGunlugunuIndir === "function") { okumaGunlugunuIndir(); } } },
    { tur: "Araç", ad: "Yönetici paneli", alt: "Sen", eylem: function () { location.hash = "#/yonetici"; } }
  );

  return liste;
}

function komutTumListesi() {
  const liste = komutSabitListesi();

  (bolumErisimi("arsiv") ? (veri.karakterler || []) : []).forEach(function (k, i) {
    liste.push({ tur: "Karakter", ad: k.ad, alt: k.unvan || "",
      eylem: function () { location.hash = "#/arsiv"; setTimeout(function () { karakterAc(i); }, 60); } });
  });

  (bolumErisimi("evren") ? (veri.evren || []) : []).forEach(function (e, i) {
    liste.push({ tur: "Evren", ad: e.baslik, alt: e.bolum,
      eylem: function () { location.hash = "#/evren/" + e.id; } });
  });

  return liste;
}

function komutAra(sorgu) {
  const q = trNormal(String(sorgu).trim());
  if (!q) { return komutSabitListesi().slice(0, 8); }

  const parcalar = q.split(/\s+/);

  return komutTumListesi().filter(function (k) {
    const metin = trNormal(k.ad + " " + k.alt);
    return parcalar.every(function (p) { return metin.indexOf(p) !== -1; });
  }).slice(0, 12);
}

function komutPaletiAc() {
  komutAcik = true;
  komutSecili = 0;

  let k = document.querySelector("#komutPaleti");
  if (!k) {
    k = document.createElement("div");
    k.id = "komutPaleti";
    k.className = "ic-katman komut-katman";
    document.body.appendChild(k);
  }

  komutPaletiCiz("");
  k.hidden = false;

  setTimeout(function () {
    const giris = document.querySelector("#komutGiris");
    if (giris) { giris.focus(); }
  }, 30);
}

function komutPaletiKapat() {
  komutAcik = false;
  const k = document.querySelector("#komutPaleti");
  if (k) { k.hidden = true; }
}

function komutPaletiCiz(sorgu) {
  const k = document.querySelector("#komutPaleti");
  if (!k) { return; }

  const sonuclar = komutAra(sorgu);
  komutSecili = Math.min(komutSecili, Math.max(0, sonuclar.length - 1));

  k.innerHTML =
    '<div class="komut-panel" role="dialog" aria-modal="true" aria-label="Komut paleti">' +
      '<input class="komut-giris" id="komutGiris" type="text" autocomplete="off" spellcheck="false" ' +
        'placeholder="karakter, evren maddesi, araç ara…" value="' + kacir(sorgu) + '">' +
      '<div class="komut-liste">' +
        (sonuclar.length
          ? sonuclar.map(function (s, i) {
              return '<button class="komut-oge' + (i === komutSecili ? " secili" : "") +
                     '" data-komut-index="' + i + '">' +
                       '<span class="komut-tur">' + kacir(s.tur) + "</span>" +
                       '<span class="komut-govde">' +
                         '<span class="komut-ad">' + kacir(s.ad) + "</span>" +
                         (s.alt ? '<span class="komut-alt">' + kacir(s.alt) + "</span>" : "") +
                       "</span>" +
                     "</button>";
            }).join("")
          : '<div class="komut-bos">Sonuç yok</div>') +
      "</div>" +
      '<div class="komut-ipucu">↑↓ gezin · Enter seç · Esc kapat</div>' +
    "</div>";
}

document.addEventListener("keydown", function (e) {
  const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
  if (ctrlK) { e.preventDefault(); komutAcik ? komutPaletiKapat() : komutPaletiAc(); return; }

  if (!komutAcik) { return; }

  if (e.key === "Escape") { komutPaletiKapat(); return; }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    const sonuclar = komutAra(document.querySelector("#komutGiris").value);
    komutSecili = Math.min(komutSecili + 1, sonuclar.length - 1);
    komutPaletiCiz(document.querySelector("#komutGiris").value);
    document.querySelector("#komutGiris").focus();
    return;
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    komutSecili = Math.max(komutSecili - 1, 0);
    komutPaletiCiz(document.querySelector("#komutGiris").value);
    document.querySelector("#komutGiris").focus();
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    const sonuclar = komutAra(document.querySelector("#komutGiris").value);
    const secilen = sonuclar[komutSecili];
    if (secilen) { komutPaletiKapat(); secilen.eylem(); }
  }
});

document.addEventListener("input", function (e) {
  if (e.target.id === "komutGiris") { komutSecili = 0; komutPaletiCiz(e.target.value); }
});

document.addEventListener("click", function (e) {
  if (e.target.closest("#komutTetikBtn")) { komutAcik ? komutPaletiKapat() : komutPaletiAc(); return; }

  if (e.target.id === "komutPaleti") { komutPaletiKapat(); return; }

  const oge = e.target.closest("[data-komut-index]");
  if (oge) {
    const sonuclar = komutAra((document.querySelector("#komutGiris") || {}).value || "");
    const secilen = sonuclar[parseInt(oge.dataset.komutIndex, 10)];
    if (secilen) { komutPaletiKapat(); secilen.eylem(); }
  }
});

/* ==================== KARAKTER SOHBETİ ====================
   İki karakter seç; sitedeki gerçek alıntılarına ve kişilik verilerine
   yaslanan kısa, oyunsu bir diyalog kartı üretir. Ciddi bir üretim değil —
   basit bir eşleştirme, eğlence amaçlı. */

const SOHBET_KALIPLARI = [
  function (a, b) { return [a + ": Buraya nasıl geldin?", b + ": Uzun hikâye. Sen?"]; },
  function (a, b) { return [a + ": Bunu daha önce de yaşadık gibi.", b + ": Belki de yaşadık."]; },
  function (a, b) { return [a + ": Sana güvenebilir miyim?", b + ": Bunu sormak zaten bir cevap."]; },
  function (a, b) { return [a + ": Neden hâlâ buradasın?", b + ": Gidecek başka yerim yok."]; },
  function (a, b) { return [a + ": Bir şey saklıyorsun.", b + ": Herkes saklıyor."]; },
  function (a, b) { return [a + ": Bunu neden yaptın?", b + ": Çünkü sen sormadan yapmam gerekiyordu."]; },
];

/** Bir karakterin alıntısını (varsa) bulur. */
function karakterAlintisi(k) {
  const uygun = (veri.alintilar || []).filter(function (a) {
    if (!katmanAcik(a.gizli) || !spoilerUygun(a.gizli)) { return false; }
    return a.kim && a.kim.indexOf(k.ad.split(" ")[0]) !== -1;
  });
  return uygun.length ? uygun[Math.floor(rast01() * uygun.length)] : null;
}

/** Bir karakterin kısa (ilk isim) hâlini döner — ama başka bir karakterin TAM
    adı bu kısaltmayla birebir çakışıyorsa (ör. "Kyldo Zarın" -> "Kyldo", ve
    ayrıca "Kyldo" adında bir tür kartı varsa) karışıklığı önlemek için tam
    adı kullanır. */
function sohbetKisaAd(k) {
  const ilk = k.ad.split(" ")[0];
  const cakisma = (veri.karakterler || []).some(function (x) {
    return x.id !== k.id && x.ad === ilk;
  });
  return cakisma ? k.ad : ilk;
}

function sohbetUret(aId, bId) {
  const a = (veri.karakterler || []).find(function (k) { return k.id === aId; });
  const b = (veri.karakterler || []).find(function (k) { return k.id === bId; });
  if (!a || !b || a.id === b.id) { return null; }

  const adA = sohbetKisaAd(a), adB = sohbetKisaAd(b);
  const kalip = SOHBET_KALIPLARI[Math.floor(rast01() * SOHBET_KALIPLARI.length)];
  const satirlar = kalip(adA, adB);

  const alintiA = karakterAlintisi(a);
  if (alintiA) { satirlar.push(adA + ": \u201c" + alintiA.metin + "\u201d"); }

  /* aynı grup/aynı bağa sahiplerse bir kapanış satırı ekle */
  const bagli = ((veri.ag && veri.ag.baglar) || []).some(function (bg) {
    return (bg.a === a.id && bg.b === b.id) || (bg.a === b.id && bg.b === a.id);
  });
  if (bagli) { satirlar.push("— aralarında zaten bir bağ var —"); }
  else { satirlar.push("— bu ikisi arşivde hiç kesişmedi —"); }

  return { a: a, b: b, satirlar: satirlar };
}

function sohbetCiz() {
  const alan = document.querySelector("#sohbetAlan");
  if (!alan) { return; }

  const kar = veri.karakterler || [];
  const secA = document.querySelector("#sohbetA");
  const secB = document.querySelector("#sohbetB");
  const aId = secA ? secA.value : (kar[0] && kar[0].id);
  const bId = secB ? secB.value : (kar[1] && kar[1].id);

  const secenek = function (secili) {
    return kar.map(function (k) {
      return '<option value="' + k.id + '"' + (k.id === secili ? " selected" : "") + ">" +
             kacir(k.ad) + "</option>";
    }).join("");
  };

  alan.innerHTML =
    '<p class="oyun-not">İki karakter seç; aralarında kısa, oyunsu bir diyalog üretilsin. ' +
    "Ciddiye alma — eğlencelik.</p>" +
    '<div class="sohbet-secim">' +
      '<select class="kod-giris arac-giris" id="sohbetA">' + secenek(aId) + "</select>" +
      '<select class="kod-giris arac-giris" id="sohbetB">' + secenek(bId) + "</select>" +
    "</div>" +
    '<button class="dugme" id="sohbetUret">Sohbet üret</button>' +
    '<div id="sohbetSonuc"></div>';
}

function sohbetSonucCiz() {
  const kutu = document.querySelector("#sohbetSonuc");
  if (!kutu) { return; }

  const aId = document.querySelector("#sohbetA").value;
  const bId = document.querySelector("#sohbetB").value;
  const s = sohbetUret(aId, bId);

  if (!s) { kutu.innerHTML = '<p class="oyun-not">Aynı karakteri iki kere seçemezsin.</p>'; return; }

  kutu.innerHTML =
    '<div class="sohbet-kart">' +
      s.satirlar.map(function (satir) {
        return '<p class="sohbet-satir">' + kacir(satir) + "</p>";
      }).join("") +
    "</div>";
}

document.addEventListener("click", function (e) {
  if (e.target.id === "sohbetUret") { sohbetSonucCiz(); }
});
document.addEventListener("change", function (e) {
  if (e.target.id === "sohbetA" || e.target.id === "sohbetB") { sohbetSonucCiz(); }
});

/* ==================== MOODBOARD ====================
   Karakter portreleri henüz yok; bu, o boşluğu dolduran bir atmosfer panosu.
   Renk paletleri ve doku referansları — resim değil, CSS ile üretilen
   soyut kartlar. */

const MOODBOARD = [
  { grup: "Kütüphane", not: "Buz mavisi, kâğıt sarısı, tozlu ışık.",
    renkler: ["#DDEBF6", "#B8D6EC", "#E8DCC0", "#3D4A57"] },
  { grup: "Luyot / Sabıka", not: "Beyaz, kırmızı, siyah — üç kardeş, üç renk.",
    renkler: ["#F4F4F4", "#B4232F", "#1A1A1A", "#9AA8B4"] },
  { grup: "Evrengezer", not: "Derin lacivert, yıldız beyazı, taş grisi.",
    renkler: ["#0D3560", "#F4F9FD", "#6B7785", "#1C5C96"] },
  { grup: "Blero", not: "Buz altı yeşili, işçi turuncusu, soğuk gri.",
    renkler: ["#4A6B5F", "#C97A3D", "#7C8896", "#DFEDF8"] },
  { grup: "Ruh Virüsü / Kitap", not: "Camsı siyah, glitch kırmızısı, boşluk.",
    renkler: ["#0A0F14", "#B4232F", "#2A2A2A", "#5A5A5A"] },
  { grup: "Dışarısı", not: "Uzay moru, metal gümüşü, uzak yıldız sarısı.",
    renkler: ["#2E2A4A", "#9CA3AF", "#E8D48A", "#1A1830"] },
];

function moodboardCiz() {  const alan = document.querySelector("#moodboardAlan");
  if (!alan) { return; }

  alan.innerHTML =
    '<p class="oyun-not">Portreler gelene kadar bir atmosfer panosu. Her grup için ' +
    "renk paleti ve kısa bir doku notu.</p>" +
    '<div class="mood-izgara">' +
      MOODBOARD.map(function (m) {
        return '<div class="mood-kart">' +
                 '<div class="mood-renkler">' +
                   m.renkler.map(function (r) {
                     return '<span style="background:' + r + '"></span>';
                   }).join("") +
                 "</div>" +
                 '<div class="mood-grup">' + kacir(m.grup) + "</div>" +
                 '<div class="mood-not">' + kacir(m.not) + "</div>" +
               "</div>";
      }).join("") +
    "</div>";
}

/* ==================== OLAYLAR ====================
   Yönetici panelinden eklenen olaylar: başlık, yaşanma şekli, anlatım ve
   olaydaki kişiler. Zaman çizelgesinden farklı — buradaki her kayıt kendi
   başına bir olay kartı, bir dönemin genel özeti değil. */

function olaylarCiz() {
  const alan = document.querySelector("#olaylarAlan");
  if (!alan) { return; }

  const liste = veri.anlatiOlaylari || [];

  if (!liste.length) {
    alan.innerHTML = '<p class="oyun-not">Henüz olay eklenmedi.</p>';
    return;
  }

  alan.innerHTML = liste.map(function (o) {
    const kisiler = (o.kisiler || []).map(function (id) {
      const k = (veri.karakterler || []).find(function (x) { return x.id === id; });
      return k ? '<span class="olay-kisi">' + kacir(k.ad) + "</span>" : "";
    }).join("");

    return '<div class="olay-kart">' +
        '<h3 class="olay-baslik">' + kacir(o.baslik) + "</h3>" +
        (o.yasanmaSekli ? '<p class="olay-sekil">' + kacir(o.yasanmaSekli) + "</p>" : "") +
        '<div class="detay-metin">' + paragraf(o.anlatim) + "</div>" +
        (kisiler ? '<div class="olay-kisiler">' + kisiler + "</div>" : "") +
      "</div>";
  }).join("");
}

/* ==================== KISA HİKÂYELER ====================
   Yönetici panelinden eklenen düz, dallanmayan kısa hikâyeler — sitedeki
   etkileşimli "Gece Vardiyası"ndan farklı, tek parça anlatılar. */

function kisaHikayelerCiz() {
  const alan = document.querySelector("#kisaHikayelerAlan");
  if (!alan) { return; }

  const liste = veri.kisaHikayeler || [];

  if (!liste.length) {
    alan.innerHTML = '<p class="oyun-not">Henüz kısa hikâye eklenmedi.</p>';
    return;
  }

  alan.innerHTML = liste.map(function (h) {
    const kisiler = (h.karakterler || []).map(function (id) {
      const k = (veri.karakterler || []).find(function (x) { return x.id === id; });
      return k ? '<span class="olay-kisi">' + kacir(k.ad) + "</span>" : "";
    }).join("");

    return '<div class="olay-kart">' +
        '<h3 class="olay-baslik">' + kacir(h.baslik) + "</h3>" +
        '<div class="detay-metin">' + paragraf(h.metin) + "</div>" +
        (kisiler ? '<div class="olay-kisiler">' + kisiler + "</div>" : "") +
      "</div>";
  }).join("");
}

/* ==================== KİLİTLİ DOSYALAR ====================
   Yönetici panelinden şifrelenip GitHub'a yüklenen dosyaları listeler.
   Katman zaten başka bir yerde çözülmüşse (aynı dogrulama özeti) dosya da
   otomatik erişilebilir olur — ayrı bir kod girmeye gerek kalmaz. */

function dosyalarCiz() {
  const alan = document.querySelector("#dosyalarAlan");
  if (!alan) { return; }

  const liste = veri.kilitliDosyalar || [];

  if (!liste.length) {
    alan.innerHTML = '<p class="oyun-not">Henüz kilitli dosya eklenmedi.</p>';
    return;
  }

  alan.innerHTML = liste.map(function (d, i) {
    const acik = !!cozulenler[d.dogrulama];

    return '<div class="dosya-kart">' +
        '<div class="dosya-ust">' +
          '<span class="dosya-ad">' + kacir(d.ad) + "</span>" +
          '<span class="katman-rozet">' + kacir(d.katmanAd) + " katmanı</span>" +
        "</div>" +
        (d.aciklama ? '<p class="dosya-aciklama">' + kacir(d.aciklama) + "</p>" : "") +
        '<div class="dosya-alt">' +
          (acik
            ? '<button class="dugme" data-dosya-indir="' + i + '">İndir — ' +
                Math.round(d.boyut / 1024) + " KB</button>"
            : '<button class="dugme dugme-sade" data-kod-ac="1">Kod gir</button>') +
        "</div>" +
        '<p class="dosya-durum" id="dosyaDurum' + i + '"></p>' +
      "</div>";
  }).join("");
}

/** Şifreli dosyayı indirir, tarayıcıda çözer ve gerçek dosya olarak sunar.
    Şifresiz hâli hiçbir yerde durmaz — yalnızca bu fonksiyon çalışırken,
    bellekte, geçici olarak var olur. */
async function dosyaIndir(i) {
  const d = (veri.kilitliDosyalar || [])[i];
  if (!d) { return; }

  const kod = cozulenler[d.dogrulama];
  if (!kod) { return; }

  const durumEl = document.querySelector("#dosyaDurum" + i);
  if (durumEl) { durumEl.textContent = "İndiriliyor..."; }

  try {
    const yanit = await fetch(d.dosyaYolu);
    if (!yanit.ok) { throw new Error("bulunamadı"); }

    const arabellek = await yanit.arrayBuffer();
    const sifreliBayt = new Uint8Array(arabellek);
    const cozulmusBayt = dosyaXOR(sifreliBayt, kod);

    const blob = new Blob([cozulmusBayt]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = d.orijinalAd || (d.ad + ".bin");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

    if (durumEl) { durumEl.textContent = ""; }
  } catch (e) {
    if (durumEl) { durumEl.textContent = "İndirilemedi — dosya bulunamadı ya da bağlantı sorunu."; }
  }
}

document.addEventListener("click", function (e) {
  const btn = e.target.closest("[data-dosya-indir]");
  if (btn) { dosyaIndir(parseInt(btn.dataset.dosyaIndir, 10)); }
});
