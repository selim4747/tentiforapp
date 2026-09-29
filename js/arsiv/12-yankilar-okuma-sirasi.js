/* İkinci dalga — yankılar, karşılaştırma, okuma sırası, spoiler seviyesi,
   yazı çözme oyunu ve baloncuk evren kum havuzu. */

/* ==================== SPOILER SEVİYESİ ====================
   Not: kilitleri açmaz. Çözdüğün bölümlerin doğrudan mı yoksa uyarı arkasında mı
   görüneceğini belirler. Katmanları açmak yalnızca QR kodu ve oyun ödülleriyle olur —
   yoksa katman kapıları anlamsızlaşırdı. */

const SPOILER_ANAHTAR = "tentiforapp_spoiler";

let spoilerSeviye = "hepsi";

const SEVIYE_SIRASI = { temiz: 0, oyun: 1, roman: 2, hepsi: 3 };
const KATMAN_SEVIYESI = { kenar: 1, kimlik: 2, kutuphane: 2, tas: 2, son: 3 };

function spoilerYukle() {
  const s = kayitOku(SPOILER_ANAHTAR);
  if (s && SEVIYE_SIRASI[s] !== undefined) { spoilerSeviye = s; }
}

function spoilerAyarla(s) {
  if (SEVIYE_SIRASI[s] === undefined) { return; }
  spoilerSeviye = s;
  kayitYaz(SPOILER_ANAHTAR, s);
  spoilerCiz();
  arsiviTazele();
}

/** Bu katman, seçilen seviyede doğrudan gösterilebilir mi? */
function spoilerUygun(katmanId) {
  if (!katmanId) { return true; }
  const gerek = KATMAN_SEVIYESI[katmanId] || 3;
  return SEVIYE_SIRASI[spoilerSeviye] >= gerek;
}

function spoilerCiz() {
  const alan = document.querySelector("#spoilerAlan");
  if (!alan || !veri.spoiler) { return; }

  alan.innerHTML =
    '<p class="oyun-giris">Kilitleri çözdüğün hâlde bazı şeyleri henüz görmek ' +
    "istemiyorsan seviyeyi düşür. Çözülmüş bölümler kapalı gösterilir, dokununca açılır.</p>" +
    '<div class="spoiler-secim">' +
      veri.spoiler.map(function (s) {
        return '<button class="spoiler-btn' + (spoilerSeviye === s.id ? " secili" : "") +
               '" data-spoiler="' + s.id + '">' +
                 '<span class="spoiler-ad">' + kacir(s.ad) + "</span>" +
                 '<span class="spoiler-not">' + kacir(s.not) + "</span>" +
               "</button>";
      }).join("") +
    "</div>" +
    '<p class="oyun-not">Bu ayar kilit açmaz. Katmanlar yalnızca QR kodu ve oyun ' +
    "ödülleriyle çözülür.</p>";
}

/* ==================== YANKILAR ==================== */

function yankiCiz() {
  const alan = document.querySelector("#yankiAlan");
  if (!alan || !veri.yankilar) { return; }

  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();

  alan.innerHTML =
    '<p class="oyun-giris">Evren tasarlanırken bazı şeyler kendiliğinden tekrarladı. ' +
    "Bunlar tesadüf değil — ya da tam olarak öyle.</p>" +
    '<div class="yanki-liste">' +
      veri.yankilar.map(function (y) {
        const acik = yonetici || (katmanAcik(y.gizli) && spoilerUygun(y.gizli));

        if (!acik) {
          return '<div class="yanki kapali">' +
                   '<div class="yanki-baslik">— buz altında —</div>' +
                   '<div class="yanki-metin">Bu yankı çözülmemiş bir katmana ait.</div>' +
                 "</div>";
        }

        return '<div class="yanki">' +
                 '<div class="yanki-baslik">' + kacir(y.baslik) + "</div>" +
                 '<div class="yanki-metin">' + kacir(y.metin) + "</div>" +
                 '<ul class="yanki-ornek">' +
                   y.ornekler.map(function (o) { return "<li>" + kacir(o) + "</li>"; }).join("") +
                 "</ul>" +
               "</div>";
      }).join("") +
    "</div>";
}

/* ==================== KARŞILAŞTIRMA ==================== */

let karsiA = null;
let karsiB = null;

function karsiSecenek(secili, alan) {
  return (veri.karakterler || []).map(function (k, i) {
    return '<option value="' + i + '"' + (secili === i ? " selected" : "") + ">" +
           kacir(k.ad) + "</option>";
  }).join("");
}

function karsiCiz() {
  const alan = document.querySelector("#karsiAlan");
  if (!alan || !veri.karakterler || !veri.karakterler.length) { return; }

  if (karsiA === null) { karsiA = 0; }
  if (karsiB === null) { karsiB = Math.min(1, veri.karakterler.length - 1); }

  alan.innerHTML =
    '<div class="karsi-secim">' +
      '<select class="kod-giris arac-giris" id="karsiA" aria-label="Birinci karakter">' +
        karsiSecenek(karsiA) + "</select>" +
      '<span class="karsi-orta">·</span>' +
      '<select class="kod-giris arac-giris" id="karsiB" aria-label="İkinci karakter">' +
        karsiSecenek(karsiB) + "</select>" +
    "</div>" +
    '<div id="karsiSonuc"></div>';

  karsiHesapla();
}

function karsiHesapla() {
  const kutu = document.querySelector("#karsiSonuc");
  if (!kutu) { return; }

  const a = veri.karakterler[karsiA];
  const b = veri.karakterler[karsiB];
  if (!a || !b) { return; }

  if (a.id === b.id) {
    kutu.innerHTML = '<p class="oyun-not">İki farklı isim seç.</p>';
    return;
  }

  /* doğrudan bağ var mı */
  const baglar = ((veri.ag && veri.ag.baglar) || []).filter(function (x) {
    return (x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id);
  });

  /* ortak komşular */
  const komsu = function (id) {
    const s = new Set();
    ((veri.ag && veri.ag.baglar) || []).forEach(function (x) {
      if (x.a === id) { s.add(x.b); }
      if (x.b === id) { s.add(x.a); }
    });
    return s;
  };

  const ka = komsu(a.id);
  const kb = komsu(b.id);
  const ortak = Array.from(ka).filter(function (x) { return kb.has(x); });

  const adBul = function (id) {
    const k = (veri.karakterler || []).find(function (x) { return x.id === id; });
    return k ? k.ad : id;
  };

  kutu.innerHTML =
    '<div class="karsi-izgara">' +
      [a, b].map(function (k) {
        return '<div class="karsi-kart">' +
                 '<div class="karsi-unvan">' + kacir(k.unvan) + "</div>" +
                 '<div class="karsi-ad">' + kacir(k.ad) + "</div>" +
                 '<div class="karsi-grup">' + kacir(k.grup || "—") + "</div>" +
                 '<div class="karsi-ozet">' + kacir(k.ozet) + "</div>" +
               "</div>";
      }).join("") +
    "</div>" +

    '<div class="karsi-satir">' +
      "<b>Aynı çevre</b>" +
      "<span>" + (a.grup === b.grup ? kacir(a.grup) : "hayır — " +
        kacir(a.grup || "?") + " / " + kacir(b.grup || "?")) + "</span>" +
    "</div>" +

    '<div class="karsi-satir">' +
      "<b>Doğrudan bağ</b>" +
      "<span>" + (baglar.length
        ? baglar.map(function (x) {
            return kacir(x.etiket) + (x.bilmez ? " (bilmiyor)" : "");
          }).join(" · ")
        : "yok") + "</span>" +
    "</div>" +

    '<div class="karsi-satir">' +
      "<b>Ortak isimler</b>" +
      "<span>" + (ortak.length ? ortak.map(adBul).map(kacir).join(", ") : "yok") + "</span>" +
    "</div>" +

    karsiZamanEkseni(a, b);
}

/** İki karakterin zaman çizelgesindeki konumlarını yan yana gösterir;
    aynı adımda geçiyorlarsa dönemleri kesişiyor demektir. */
function karsiZamanEkseni(a, b) {
  const liste = veri.zamanCizelgesi || [];
  if (!liste.length) { return ""; }

  const aAdim = new Set(karakterZamanAdimlari(a).map(function (z) { return z.no; }));
  const bAdim = new Set(karakterZamanAdimlari(b).map(function (z) { return z.no; }));
  const kesisim = liste.filter(function (z) { return aAdim.has(z.no) && bAdim.has(z.no); });

  return '<div class="karsi-zaman">' +
      '<div class="oyun-etiket">Zaman çizelgesinde</div>' +
      '<div class="kz-cift">' +
        '<div class="kz-serit">' +
          liste.map(function (z) {
            return '<span class="kz-nokta' + (aAdim.has(z.no) ? " dolu" : "") +
                   '" title="' + kacir(a.ad + " — " + z.no + ". " + z.baslik) + '"></span>';
          }).join("") +
        "</div>" +
        '<div class="kz-serit">' +
          liste.map(function (z) {
            return '<span class="kz-nokta kz-b' + (bAdim.has(z.no) ? " dolu" : "") +
                   '" title="' + kacir(b.ad + " — " + z.no + ". " + z.baslik) + '"></span>';
          }).join("") +
        "</div>" +
      "</div>" +
      '<div class="kz-etiketler"><span>' + kacir(a.ad) + "</span><span>" + kacir(b.ad) + "</span></div>" +
      (kesisim.length
        ? '<p class="oyun-not">Aynı dönemde kesişiyorlar: ' +
          kesisim.map(function (z) { return kacir(z.baslik); }).join(", ") + "</p>"
        : '<p class="oyun-not">Zaman çizelgesinde hiç kesişmiyorlar.</p>') +
    "</div>";
}

/* ==================== OKUMA SIRASI ==================== */

let siraSecim = "onerilen";

function siraCiz() {
  const alan = document.querySelector("#siraAlan");
  if (!alan || !veri.okumaSirasi) { return; }

  const s = veri.okumaSirasi[siraSecim];
  if (!s) { return; }

  alan.innerHTML =
    '<div class="arac-secim">' +
      Object.keys(veri.okumaSirasi).map(function (k) {
        return '<button class="filtre-btn' + (siraSecim === k ? " secili" : "") +
               '" data-sira="' + k + '">' + kacir(veri.okumaSirasi[k].ad) + "</button>";
      }).join("") +
    "</div>" +
    '<p class="oyun-giris">' + kacir(s.aciklama) + "</p>" +
    '<ol class="sira-liste">' +
      s.adimlar.map(function (a, i) {
        return '<li><span class="sira-no">' + (i + 1) + "</span>" +
               '<span class="sira-ad">' + kacir(a) + "</span></li>";
      }).join("") +
    "</ol>";
  siraKilitleriIsaretle(alan, s);   /* hangi adım açık, hangisi kod ister (62-ilk-deneyim) */
}

/* ==================== YAZI ÇÖZME OYUNU ==================== */

let Y = null;

let yaziTers = false;

function yaziOyunBaslat(zorluk, ters) {
  if (typeof meydanTohumla === "function") { meydanTohumla("yazi"); }
  yaziTers = !!ters;
  const havuz = (veri.kelimeler[zorluk] || []).slice();

  for (let i = havuz.length - 1; i > 0; i--) {
    const j = Math.floor(rast01() * (i + 1));
    const t = havuz[i]; havuz[i] = havuz[j]; havuz[j] = t;
  }

  Y = { zorluk: zorluk, ters: yaziTers, sira: havuz.slice(0, 6), indeks: 0, dogru: 0,
        ipucu: false, bitti: false, sonKelime: null, sonDurum: null, secenekler: null };

  if (yaziTers) { yaziSecenekUret(); }
  yaziOyunCiz();
}

/** Ters modda dört şık üretir: biri doğru, üçü başka kelime. */
function yaziSecenekUret() {
  const dogru = Y.sira[Y.indeks];
  const havuz = [].concat(veri.kelimeler.kolay, veri.kelimeler.orta, veri.kelimeler.zor)
    .filter(function (k) { return k !== dogru; });

  const secim = [dogru];
  while (secim.length < 4 && havuz.length) {
    const k = havuz.splice(Math.floor(rast01() * havuz.length), 1)[0];
    if (secim.indexOf(k) === -1) { secim.push(k); }
  }

  for (let i = secim.length - 1; i > 0; i--) {
    const j = Math.floor(rast01() * (i + 1));
    const t = secim[i]; secim[i] = secim[j]; secim[j] = t;
  }

  Y.secenekler = secim;
}

function yaziOyunCevap(giris) {
  if (!Y || Y.bitti) { return; }

  const dogruCevap = Y.sira[Y.indeks];
  const verilen = String(giris).trim().toLocaleLowerCase("tr");

  if (verilen === dogruCevap) {
    Y.dogru++;
    gunlukKazan("yazi", Y.ipucu ? 1 : (Y.zorluk === "zor" ? 5 : Y.zorluk === "orta" ? 4 : 3),
                "Yazı çözme");
    Y.sonDurum = "dogru";
    gorevIlerle("yazi4");
  } else {
    Y.sonDurum = "yanlis";
  }

  Y.sonKelime = dogruCevap;
  Y.indeks++;
  Y.ipucu = false;

  if (Y.indeks < Y.sira.length && Y.ters) { yaziSecenekUret(); }

  if (Y.indeks >= Y.sira.length) {
    Y.bitti = true;
    if (typeof rekorYaz === "function") { rekorYaz("yazi", Y.dogru); }
    if (typeof meydanBitir === "function") { meydanBitir("yazi", Y.dogru); }

    if (Y.dogru === Y.sira.length) {
      gunlukKazan("yazi", 12, "Kusursuz okuma");
      if (Y.zorluk === "zor") {
        oyunBitti("yazi");
        istArtir(Y.ters ? "yaziYaz" : "yaziOku");
        if (cuzdan.ist.yaziYaz && cuzdan.ist.yaziOku && typeof madalyaVer === "function") {
          madalyaVer("tumYazilar");
        }
      }
    }
  }

  yaziOyunCiz();
}

function yaziOyunCiz() {
  const alan = document.querySelector("#yaziOyunAlan");
  if (!alan) { return; }

  if (!Y) {
    alan.innerHTML =
      '<p class="oyun-giris">Kyldo yazısıyla yazılmış bir kelime göreceksin. ' +
      "Çizgiler ünsüzü, çarpılar ünlüyü veriyor. Yukarıdaki tabloya bakabilirsin.</p>" +
      '<div class="oyun-etiket">Oku — yazıyı görüp Türkçesini yaz</div>' +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-yazi-oyun="kolay">Kolay</button>' +
        '<button class="dugme dugme-sade" data-yazi-oyun="orta">Orta</button>' +
        '<button class="dugme dugme-sade" data-yazi-oyun="zor">Zor</button>' +
      "</div>" +
      '<div class="oyun-etiket" style="margin-top:16px">Yaz — Türkçesini görüp doğru yazıyı seç</div>' +
      '<div class="oyun-sira">' +
        '<button class="dugme dugme-sade" data-yazi-ters="kolay">Kolay</button>' +
        '<button class="dugme dugme-sade" data-yazi-ters="orta">Orta</button>' +
        '<button class="dugme dugme-sade" data-yazi-ters="zor">Zor</button>' +
      "</div>" +
      tavanBilgi("yazi");
    return;
  }

  if (Y.bitti) {
    alan.innerHTML =
      '<div class="oyun-son">' +
        "<h3>" + Y.dogru + " / " + Y.sira.length + "</h3>" +
        "<p>" + (Y.dogru === Y.sira.length
          ? "Kyldo yazısını okuyabiliyorsun."
          : "Yazı henüz yabancı. Tablo yukarıda duruyor.") + "</p>" +
        '<button class="dugme" data-yazi-oyun="yeni">Yeniden</button>' +
      "</div>";
    return;
  }

  const kelime = Y.sira[Y.indeks];

  if (Y.ters) {
    alan.innerHTML =
      tavanBilgi("yazi") +
      '<div class="cev-ust"><span>' + (Y.indeks + 1) + " / " + Y.sira.length +
        "</span><span>doğru " + Y.dogru + "</span></div>" +
      (Y.sonKelime ? '<p class="cev-gecmis ' + Y.sonDurum + '">' +
        (Y.sonDurum === "dogru" ? "doğru: " : "cevap: ") + kacir(Y.sonKelime) + "</p>" : "") +
      '<div class="cev-kelime">' + kacir(kelime) + "</div>" +
      '<div class="yazi-secenekler">' +
        (Y.secenekler || []).map(function (s) {
          return '<button class="yazi-secenek" data-yazi-sec="' + kacir(s) + '">' +
                 kyldoYaz(s, 40) + "</button>";
        }).join("") +
      "</div>";
    return;
  }

  alan.innerHTML =
    tavanBilgi("yazi") +
    '<div class="cev-ust"><span>' + (Y.indeks + 1) + " / " + Y.sira.length +
      "</span><span>doğru " + Y.dogru + "</span></div>" +
    (Y.sonKelime ? '<p class="cev-gecmis ' + Y.sonDurum + '">' +
      (Y.sonDurum === "dogru" ? "doğru: " : "cevap: ") + kacir(Y.sonKelime) + "</p>" : "") +
    '<div class="yz-cikti yz-bulmaca">' + kyldoYaz(kelime, 52) + "</div>" +
    '<input class="kod-giris" id="yaziOyunGiris" autocomplete="off" spellcheck="false" ' +
      'placeholder="okuduğun kelime">' +
    '<button class="dugme" data-yazi-onay="1">Oku</button>' +
    '<button class="dugme dugme-sade" data-yazi-ipucu="1"' + (Y.ipucu ? " disabled" : "") +
      ">İpucu (ödül düşer)</button>" +
    (Y.ipucu ? '<p class="oyun-ipucu">İlk harf: <b>' + kacir(kelime.charAt(0)) +
      "</b> · " + kelime.length + " harf</p>" : "");

  const g = document.querySelector("#yaziOyunGiris");
  if (g) { g.focus(); }
}

/* ==================== BALONCUK EVREN ====================
   Üç ile beş kural seç, bir yabancı öğe getir. Kurallar birbirini etkiler:
   bazı ikililer birlikte yeni bir şey doğurur, bazıları birbirini yutar.
   İki evreni birleştirip melez de kurabilirsin. */

let E = null;
let baloncukGrup = "hepsi";
let baloncukAra = "";

function baloncukAyar() { return veri.baloncuk; }

/* ---------- özel evren ----------
   Oyuncu kendi kuralını ve içeriğini (yabancı öğe) yazabilir. Değerleri Yaşam "okur":
   metinden deterministik türetilir — aynı metin her zaman aynı değeri alır. Metni
   değiştirerek iyi değer aramak mümkün, o yüzden özel öğeli evrenler madalya ve
   oyun bitirme sayılmaz (sonuç ve galeri kaydı yine oluşur). Özel öğeler bu cihazda saklanır;
   kurulan evrenin galeri kaydına da kopyası girer, böylece silinseler bile
   galeri ve birleştirme bozulmaz. */

const OZEL_BALONCUK_ANAHTAR = "tentiforapp_ozel_baloncuk";
let baloncukTaslak = { kural: "", icerik: "" };

function ozelSinir() {
  const o = (baloncukAyar() && baloncukAyar().ozel) || {};
  return { kural: o.enKural || 5, icerik: o.enIcerik || 3 };
}

function ozelOku() {
  let d = {};
  try { d = JSON.parse(kayitOku(OZEL_BALONCUK_ANAHTAR) || "{}") || {}; } catch (e) { d = {}; }
  return { kurallar: Array.isArray(d.kurallar) ? d.kurallar : [],
           yabancilar: Array.isArray(d.yabancilar) ? d.yabancilar : [] };
}

function ozelYaz(d) { kayitYaz(OZEL_BALONCUK_ANAHTAR, JSON.stringify(d)); }

/** Özel öğeler + galerideki evrenlerin kopyaları (silinmiş öğeler de çözülebilsin). */
function ozelHavuz() {
  const d = ozelOku();
  const kurallar = d.kurallar.slice(), yabancilar = d.yabancilar.slice();
  let galeri = [];
  try { galeri = JSON.parse(kayitOku("tentiforapp_evrenler") || "[]"); } catch (e) { galeri = []; }
  (Array.isArray(galeri) ? galeri : []).forEach(function (g) {
    if (!g || !g.ozel) { return; }
    (g.ozel.kurallar || []).forEach(function (k) {
      if (!kurallar.some(function (x) { return x.id === k.id; })) { kurallar.push(k); }
    });
    (g.ozel.yabancilar || []).forEach(function (y) {
      if (!yabancilar.some(function (x) { return x.id === y.id; })) { yabancilar.push(y); }
    });
  });
  return { kurallar: kurallar, yabancilar: yabancilar };
}

function baloncukKurallari() { return baloncukAyar().kurallar.concat(ozelOku().kurallar); }
function baloncukYabancilari() { return baloncukAyar().yabancilar.concat(ozelOku().yabancilar); }

function kuralBul(id) {
  return baloncukAyar().kurallar.find(function (k) { return k.id === id; }) ||
         ozelHavuz().kurallar.find(function (k) { return k.id === id; });
}

function yabanciBul(id) {
  return baloncukAyar().yabancilar.find(function (y) { return y.id === id; }) ||
         ozelHavuz().yabancilar.find(function (y) { return y.id === id; });
}

function ozelKarma(metin) {
  const t = String(metin).toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

function ozelAkis(tohum) {
  let a = tohum >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kuralın değerleri: kararlılık ve yaşam -3..3 (toplam etkisi en çok 5), tuhaflık 1..4. */
function ozelKuralDegerleri(metin) {
  const r = ozelAkis(ozelKarma("kural:" + metin));
  let k = Math.floor(r() * 7) - 3;
  let y = Math.floor(r() * 7) - 3;
  let t = 1 + Math.floor(r() * 4);
  while (Math.abs(k) + Math.abs(y) > 5) {
    if (Math.abs(k) >= Math.abs(y)) { k -= Math.sign(k); } else { y -= Math.sign(y); }
  }
  const norm = String(metin).toLocaleLowerCase("tr");
  if (["yok", "olmaz", "asla", "hiç", "ters", "sonsuz", "hiçbir"].some(function (w) { return norm.indexOf(w) !== -1; })) {
    t = Math.min(4, t + 1);
  }
  return { kararlilik: k, yasam: y, tuhaflik: t };
}

/** İçeriğin (yabancı öğenin) değerleri mevcut öğelerle aynı aralıkta. */
function ozelIcerikDegerleri(metin) {
  const r = ozelAkis(ozelKarma("icerik:" + metin));
  return { tuhaflik: 1 + Math.floor(r() * 4), kararlilik: Math.floor(r() * 4) - 1, yasam: Math.floor(r() * 5) - 1 };
}

function ozelDegerYazisi(o) {
  const isaretli = function (n) { return (n > 0 ? "+" : "") + n; };
  return "kararlılık " + isaretli(o.kararlilik || 0) + " · yaşam " + isaretli(o.yasam || 0) + " · tuhaflık " + (o.tuhaflik || 0);
}

/** Yeni özel kural ya da içerik ekler. Hata metni ya da null döner. */
function ozelEkle(tur, ham) {
  const metin = String(ham || "").trim().replace(/\s+/g, " ");
  if (metin.length < 4 || metin.length > 70) { return "Metin 4 ile 70 karakter arasında olmalı."; }

  const d = ozelOku();
  const liste = tur === "kural" ? d.kurallar : d.yabancilar;
  const sinir = ozelSinir()[tur === "kural" ? "kural" : "icerik"];
  if (liste.length >= sinir) { return "En fazla " + sinir + " özel " + (tur === "kural" ? "kural" : "içerik") + " saklanır. Birini silip yenisini yaz."; }

  const id = (tur === "kural" ? "o_" : "oi_") + ozelKarma(tur + ":" + metin).toString(36);
  const varMi = (tur === "kural" ? baloncukAyar().kurallar : baloncukAyar().yabancilar).concat(liste)
    .some(function (x) { return x.id === id || String(x.ad).toLocaleLowerCase("tr") === metin.toLocaleLowerCase("tr"); });
  if (varMi) { return "Bu zaten var."; }

  const o = Object.assign({ id: id, ad: metin, ozel: true },
    tur === "kural" ? { grup: "Özel" } : { "not": "Senin içeriğin." },
    tur === "kural" ? ozelKuralDegerleri(metin) : ozelIcerikDegerleri(metin));
  liste.push(o);
  ozelYaz(d);

  /* yeni öğe yer varsa hemen seçilsin */
  if (E && !E.sonuc) {
    if (tur === "kural" && E.kurallar.length < baloncukAyar().enCok) { E.kurallar.push(id); }
    if (tur !== "kural" && E.yabancilar.length < (baloncukAyar().enFazlaYabanci || 1)) { E.yabancilar.push(id); }
  }
  eckaBildir("Yaşam okudu — " + ozelDegerYazisi(o));
  return null;
}

function ozelSil(tur, id) {
  const d = ozelOku();
  if (tur === "kural") { d.kurallar = d.kurallar.filter(function (x) { return x.id !== id; }); }
  else { d.yabancilar = d.yabancilar.filter(function (x) { return x.id !== id; }); }
  ozelYaz(d);
  if (E && !E.sonuc) {
    E.kurallar = E.kurallar.filter(function (x) { return x !== id; });
    E.yabancilar = E.yabancilar.filter(function (x) { return x !== id; });
  }
}

/** Kurulan evrende kullanılan özel öğelerin kopyası (galeri kaydına girer). */
function ozelSnapshot(kurallar, yabancilar) {
  const h = ozelHavuz();
  const k = h.kurallar.filter(function (x) { return kurallar.indexOf(x.id) !== -1; });
  const y = h.yabancilar.filter(function (x) { return (yabancilar || []).indexOf(x.id) !== -1; });
  return (k.length || y.length) ? { kurallar: k, yabancilar: y } : undefined;
}

function ozelEvrenBlogu() {
  const d = ozelOku();
  const sinir = ozelSinir();
  const satir = function (tur, o) {
    return '<div class="ozel-oge"><span>' + kacir(o.ad) + "<em>" + kacir(ozelDegerYazisi(o)) + "</em></span>" +
           '<button class="dugme dugme-sade y-kucuk" data-baloncuk-ozel="' + tur + '-sil" data-id="' + kacir(o.id) + '">sil</button></div>';
  };
  return '<div class="arac-blok ozel-evren">' +
      '<div class="oyun-etiket">Özel evren — kendi kuralın ve içeriğin</div>' +
      '<p class="oyun-not">Bir kural ya da içerik yaz; Yaşam okuyup değerlerini kendisi verir. Aynı metin hep aynı değeri alır. ' +
        "En fazla " + sinir.kural + " özel kural ve " + sinir.icerik + " özel içerik saklanır; onları yukarıdaki listelerde seçebilirsin. " +
        "Özel öğeli evrenler madalya ve oyun bitirme sayılmaz.</p>" +
      '<div class="ozel-satir"><input class="kod-giris arac-giris" id="ozelKuralGiris" maxlength="70" autocomplete="off" ' +
        'placeholder="Kural, ör. Gölgeler ağırlık taşır" value="' + kacir(baloncukTaslak.kural) + '">' +
        '<button class="dugme dugme-sade" data-baloncuk-ozel="kural-ekle">Kural ekle (' + d.kurallar.length + "/" + sinir.kural + ")</button></div>" +
      '<div class="ozel-satir"><input class="kod-giris arac-giris" id="ozelIcerikGiris" maxlength="70" autocomplete="off" ' +
        'placeholder="İçerik, ör. Kendi kendine açılan bir kapı" value="' + kacir(baloncukTaslak.icerik) + '">' +
        '<button class="dugme dugme-sade" data-baloncuk-ozel="icerik-ekle">İçerik ekle (' + d.yabancilar.length + "/" + sinir.icerik + ")</button></div>" +
      d.kurallar.map(function (o) { return satir("kural", o); }).join("") +
      d.yabancilar.map(function (o) { return satir("icerik", o); }).join("") +
    "</div>";
}

/** Sonuç ekranında evrende kullanılan özel öğeleri gösterir. */
function ozelSonucSatiri() {
  if (!E) { return ""; }
  const ad = function (id, bul) { const o = bul(id); return o && o.ozel ? o.ad : null; };
  const liste = E.kurallar.map(function (id) { return ad(id, kuralBul); })
    .concat((E.yabancilar || []).map(function (id) { return ad(id, yabanciBul); }))
    .filter(function (x) { return x; });
  return liste.length ? '<p class="oyun-not">Senin öğelerin bu evrende: ' + liste.map(kacir).join(" · ") + "</p>" : "";
}


function baloncukBaslat() {
  E = { kurallar: [], yabancilar: [], sonuc: null, melez: false };
  baloncukGrup = "hepsi";
  baloncukAra = "";
  baloncukCiz();
}

function baloncukKuralSec(id) {
  if (!E || E.sonuc) { return; }

  const i = E.kurallar.indexOf(id);

  if (i !== -1) { E.kurallar.splice(i, 1); }
  else if (E.kurallar.length < baloncukAyar().enCok) { E.kurallar.push(id); }
  else { eckaBildir("En fazla " + baloncukAyar().enCok + " kural"); return; }

  baloncukCiz();
}

/** Yabancı öğe seçimi: en fazla enFazlaYabanci kadar, tekrar tıklayınca kaldırır. */
function baloncukYabanciSec(id) {
  const enFazla = baloncukAyar().enFazlaYabanci || 1;
  const i = E.yabancilar.indexOf(id);

  if (i !== -1) { E.yabancilar.splice(i, 1); }
  else if (E.yabancilar.length < enFazla) { E.yabancilar.push(id); }
  else { eckaBildir("En fazla " + enFazla + " yabancı öğe"); return; }

  baloncukCiz();
}

/** Seçili kurallar arasında tetiklenen üçlü sinerjileri döner. */
function tetiklenenUcluler(kurallar) {
  return (baloncukAyar().ucluler || []).filter(function (u) {
    return kurallar.indexOf(u.a) !== -1 && kurallar.indexOf(u.b) !== -1 &&
           kurallar.indexOf(u.c) !== -1;
  });
}

/** Seçili kurallar arasında tetiklenen etkileşimleri döner. */
function tetiklenenEtkilesimler(kurallar) {
  return baloncukAyar().etkilesimler.filter(function (e) {
    return kurallar.indexOf(e.a) !== -1 && kurallar.indexOf(e.b) !== -1;
  });
}

/** Bir evrenin ölçülerini hesaplar. Birleştirmede de aynı hesap kullanılır. */
function evrenHesapla(kurallar, yabancilar, melez) {
  const b = baloncukAyar();

  let kararlilik = 3;
  let yasam = 2;
  let tuhaflik = 0;

  kurallar.forEach(function (id) {
    const k = kuralBul(id);
    if (!k) { return; }
    kararlilik += k.kararlilik;
    yasam += k.yasam;
    tuhaflik += k.tuhaflik;
  });

  /* Kural sayısı arttıkça evren daha kırılgan olur. */
  const fazla = Math.max(0, Math.min(kurallar.length - b.enAz, 1));   /* ilk fazla kural bedel ister, sonrası ölçekle dengelenir */
  kararlilik -= fazla;

  (yabancilar || []).forEach(function (id) {
    const y = yabanciBul(id);
    if (!y) { return; }
    tuhaflik += y.tuhaflik || 0;
    kararlilik += y.kararlilik || 0;
    yasam += y.yasam || 0;
  });

  const etkiler = tetiklenenEtkilesimler(kurallar);
  etkiler.forEach(function (e) {
    kararlilik += e.kararlilik;
    yasam += e.yasam;
    tuhaflik += e.tuhaflik;
  });

  const ucluler = tetiklenenUcluler(kurallar);
  ucluler.forEach(function (u) {
    kararlilik += u.kararlilik;
    yasam += u.yasam;
    tuhaflik += u.tuhaflik;
  });

  /* Dört kuraldan fazlasında toplamlar kural sayısına göre ölçeklenir; yoksa 10 kurallı
     her evren kendiliğinden kaotik ya da çökmüş olurdu. Kararlılık ve yaşam karekökle
     (dalgalanma aynı kalsın), tuhaflık doğrusal (ortalama aynı kalsın) bölünür.
     Böylece 4 ile 10 kural arasında sonuçların dağılımı yaklaşık aynı kalır. */
  const nKural = kurallar.length;
  const baz = (b.olcek && b.olcek.baz) || 4;
  if (nKural > baz) {
    const o = b.olcek || { k: 0.5, y: 0.5, t: 1 };
    const oran = nKural / baz;
    kararlilik = Math.round((3 - fazla) + (kararlilik - (3 - fazla)) / Math.pow(oran, o.k));
    yasam = Math.round(2 + (yasam - 2) / Math.pow(oran, o.y));
    tuhaflik = Math.round(tuhaflik / Math.pow(oran, o.t));
  }

  if (melez) { tuhaflik += 3; kararlilik -= 2; }

  let tur;
  if (kararlilik <= -3) { tur = "cokus"; }
  else if (yasam >= 7 && kararlilik <= 1) { tur = "asiri"; }
  else if (kararlilik <= 0) { tur = "cokus"; }
  else if (yasam <= 0) { tur = "kisir"; }
  else if (tuhaflik <= 3 && kararlilik >= 5) { tur = "donuk"; }
  else if (tuhaflik >= 14) { tur = "kaotik"; }
  else if (kararlilik <= 2) { tur = "kirilgan"; }
  else if (kararlilik >= 5 && yasam >= 5 && tuhaflik >= 7 && tuhaflik <= 12) { tur = "kusursuz"; }
  else { tur = "kararli"; }

  if (melez && tur !== "cokus" && tur !== "kisir") { tur = "melez"; }

  return { tur: tur, kararlilik: kararlilik, yasam: yasam, tuhaflik: tuhaflik,
           etkiler: etkiler, ucluler: ucluler, melez: !!melez };
}

function baloncukCalistir() {
  const b = baloncukAyar();

  if (!E || E.kurallar.length < b.enAz || !E.yabancilar.length) {
    eckaBildir("En az " + b.enAz + " kural ve bir yabancı öğe seç");
    return;
  }

  E.sonuc = evrenHesapla(E.kurallar, E.yabancilar, false);

  const odul = b.oduller[E.sonuc.tur] || 8;
  gunlukKazan("baloncuk", odul, "Baloncuk evren");
  gorevIlerle("baloncuk1");

  if (typeof rekorYaz === "function") { rekorYaz("baloncuk", E.sonuc.tuhaflik); }

  const ozelVar = !!ozelSnapshot(E.kurallar, E.yabancilar);
  if (E.sonuc.tur === "kusursuz" && !ozelVar) {
    oyunBitti("baloncuk");
    if (typeof madalyaVer === "function") { madalyaVer("kusursuzevren"); }
  }

  if (typeof evrenKaydet === "function") {
    E.kayitId = evrenKaydet({ tur: E.sonuc.tur, turAd: turAdi(E.sonuc.tur), kurallar: E.kurallar.slice(),
                  yabanci: E.yabancilar[0], yabancilar: E.yabancilar.slice(),
                  kararlilik: E.sonuc.kararlilik,
                  yasam: E.sonuc.yasam, tuhaflik: E.sonuc.tuhaflik, melez: false,
                  ozel: ozelSnapshot(E.kurallar, E.yabancilar) });
  }

  baloncukCiz();
}

function turAdi(t) {
  return { cokus: "Çöküş", asiri: "Aşırı", kisir: "Kısır", donuk: "Donuk", kaotik: "Kaotik",
           kirilgan: "Kırılgan", kararli: "Kararlı", kusursuz: "Kusursuz",
           melez: "Melez" }[t] || t;
}

/* ---------- birleştirme ---------- */

let birlesikSecim = [];

function birlestirmeSec(indeks) {
  const i = birlesikSecim.indexOf(indeks);

  if (i !== -1) { birlesikSecim.splice(i, 1); }
  else if (birlesikSecim.length < 2) { birlesikSecim.push(indeks); }
  else { eckaBildir("İki evren seç"); return; }

  evrenGalerisiCiz();
}

/** İki evrenin içerik / kişi listelerini birleştirir (aynı kimlik tek sayılır). */
function evrenBirlestirOgeler(x, y) {
  const sonuc = [], goruldu = {};
  (x || []).concat(y || []).forEach(function (o) {
    if (goruldu[o.id]) { return; }
    goruldu[o.id] = true;
    sonuc.push(Object.assign({}, o));
  });
  return sonuc.length ? sonuc : undefined;
}

function evrenBirlestir() {
  let liste = [];
  try { liste = JSON.parse(kayitOku("tentiforapp_evrenler") || "[]"); } catch (e) { liste = []; }

  if (birlesikSecim.length !== 2) { eckaBildir("İki evren seç"); return; }

  const a = liste[birlesikSecim[0]];
  const c = liste[birlesikSecim[1]];
  if (!a || !c) { return; }

  /* Kurallar birleşir, tekrar edenler tek sayılır. */
  const kurallar = a.kurallar.slice();
  c.kurallar.forEach(function (k) { if (kurallar.indexOf(k) === -1) { kurallar.push(k); } });

  /* eski kayıtlarda tek "yabanci" alanı vardı, yenilerde "yabancilar" dizisi var */
  const aYab = a.yabancilar || (a.yabanci ? [a.yabanci] : []);
  const cYab = c.yabancilar || (c.yabanci ? [c.yabanci] : []);
  const yabancilar = aYab.slice();
  cYab.forEach(function (y) { if (yabancilar.indexOf(y) === -1) { yabancilar.push(y); } });

  E = { kurallar: kurallar, yabancilar: yabancilar, melez: true };
  E.sonuc = evrenHesapla(kurallar, yabancilar, true);

  const odul = baloncukAyar().oduller[E.sonuc.tur] || 10;
  gunlukKazan("baloncuk", odul, "Melez evren");

  if (typeof evrenKaydet === "function") {
    E.kayitId = evrenKaydet({ tur: E.sonuc.tur, turAd: turAdi(E.sonuc.tur), kurallar: kurallar,
                  ad: (evrenAdi(a) + " × " + evrenAdi(c)).slice(0, 40),
                  icerik: evrenBirlestirOgeler(a.icerik, c.icerik),
                  kisiler: evrenBirlestirOgeler(a.kisiler, c.kisiler),
                  yabanci: yabancilar[0], yabancilar: yabancilar,
                  kararlilik: E.sonuc.kararlilik, yasam: E.sonuc.yasam,
                  tuhaflik: E.sonuc.tuhaflik, melez: true,
                  ozel: ozelSnapshot(kurallar, yabancilar) });
  }

  birlesikSecim = [];
  baloncukCiz();
  evrenGalerisiCiz();
  bolumeGit("oyunlar");
}

/* ---------- çizim ---------- */

function baloncukSonucCiz() {
  const b = baloncukAyar();
  const s = E.sonuc;

  if (typeof ansiklopediKaydet === "function") {
    ansiklopediKaydet(s.tur);
    /* defter/vurgu widget'larında olduğu gibi, kaydeden fonksiyon kendi
       ekranını da tazelemeli — yoksa sayfa değişene kadar güncellenmez. */
    if (typeof ansiklopediCiz === "function") { ansiklopediCiz(); }
  }

  return '<div class="oyun-son">' +
      "<h3>" + kacir(turAdi(s.tur)) + "</h3>" +
      "<p>" + kacir(b.sonuclar[s.tur]) + "</p>" +
      istatistikCubuklari(s.kararlilik, s.yasam, s.tuhaflik) +
      ozelSonucSatiri() +
      (s.ucluler.length
        ? '<div class="etki-liste">' +
            '<div class="oyun-etiket">Üçlü sinerji</div>' +
            s.ucluler.map(function (u) {
              return '<div class="etki uclu">' +
                       '<div class="etki-ad">' + kacir(u.ad) + "</div>" +
                       '<div class="etki-metin">' + kacir(u.metin) + "</div>" +
                     "</div>";
            }).join("") +
          "</div>"
        : "") +
      (s.etkiler.length
        ? '<div class="etki-liste">' +
            '<div class="oyun-etiket">Tetiklenen etkileşimler</div>' +
            s.etkiler.map(function (e) {
              const iyi = (e.kararlilik + e.yasam) >= 0;
              return '<div class="etki' + (iyi ? " iyi" : " kotu") + '">' +
                       '<div class="etki-ad">' + kacir(e.ad) + "</div>" +
                       '<div class="etki-metin">' + kacir(e.metin) + "</div>" +
                     "</div>";
            }).join("") +
          "</div>"
        : (!s.ucluler.length ? '<p class="oyun-not">Kurallar birbirine dokunmadı.</p>' : "")) +
      (E.kayitId ? '<button class="dugme dugme-sade" data-evren-defter="' + kacir(E.kayitId) + '">Evren defterini aç: içerik ve kişi ekle</button> ' : "") +
      '<button class="dugme" data-baloncuk="basla">Yeni evren</button>' +
    "</div>";
}

/** Seçili gruba ve arama kutusuna göre kural düğmeleri. Yazarken yalnızca bu kısım tazelenir. */
function baloncukKuralIzgaraHtml() {
  const ara = baloncukAra.toLocaleLowerCase("tr").trim();
  const liste = baloncukKurallari().filter(function (k) {
    return (baloncukGrup === "hepsi" || k.grup === baloncukGrup) &&
           (!ara || String(k.ad).toLocaleLowerCase("tr").indexOf(ara) !== -1);
  });
  if (!liste.length) { return '<p class="oyun-not">Bu aramayla kural bulunamadı.</p>'; }
  return liste.map(function (k) {
    const secili = E && E.kurallar.indexOf(k.id) !== -1;
    return '<button class="baloncuk-kural' + (secili ? " secili" : "") + (k.ozel ? " ozel" : "") +
           '" data-baloncuk-kural="' + k.id + '">' +
             '<span class="bk-ad">' + kacir(k.ad) + "</span>" +
             '<span class="bk-grup">' + kacir(k.grup) + "</span>" +
           "</button>";
  }).join("");
}

function baloncukCiz() {
  const alan = document.querySelector("#baloncukAlan");
  if (!alan || !veri.baloncuk) { return; }

  const b = baloncukAyar();

  if (!E) {
    alan.innerHTML =
      '<p class="oyun-giris">' + kacir(b.aciklama) + "</p>" +
      '<p class="oyun-not">' + b.kurallar.length + " kural · " + b.yabancilar.length +
        " yabancı öğe · " + (b.etkilesimler.length + (b.ucluler || []).length) + " gizli etkileşim · " +
        "kendi kuralını ve içeriğini de yazabilirsin</p>" +
      '<button class="dugme" data-baloncuk="basla">Evren kur</button>' +
      tavanBilgi("baloncuk");
    return;
  }

  if (E.sonuc) { alan.innerHTML = baloncukSonucCiz(); return; }

  const gruplar = [];
  baloncukKurallari().forEach(function (k) { if (gruplar.indexOf(k.grup) === -1) { gruplar.push(k.grup); } });
  const sira = ["Fizik", "Işık ve Ses", "Madde ve Enerji", "Uzay ve Boyut", "Zaman", "Yaşam", "Algı", "Toplum", "Başka Evrenler", "E26", "Özel"];
  gruplar.sort(function (a, b) {
    const x = sira.indexOf(a), y = sira.indexOf(b);
    return (x === -1 ? 99 : x) - (y === -1 ? 99 : y);
  });

  const gorunur = baloncukKurallari().filter(function (k) {
    return baloncukGrup === "hepsi" || k.grup === baloncukGrup;
  });

  const onIzleme = E.kurallar.length >= b.enAz
    ? evrenHesapla(E.kurallar, E.yabancilar, false)
    : null;

  alan.innerHTML =
    tavanBilgi("baloncuk") +

    '<div class="oyun-etiket">Kurallar — ' + E.kurallar.length + " / " + b.enCok +
      " (en az " + b.enAz + ")</div>" +
    '<div class="filtre">' +
      '<button class="filtre-btn' + (baloncukGrup === "hepsi" ? " secili" : "") +
        '" data-baloncuk-grup="hepsi">Hepsi</button>' +
      gruplar.map(function (g) {
        return '<button class="filtre-btn' + (baloncukGrup === g ? " secili" : "") +
               '" data-baloncuk-grup="' + kacir(g) + '">' + kacir(g) + "</button>";
      }).join("") +
    "</div>" +
    '<input class="kod-giris arac-giris baloncuk-ara" id="baloncukAraGiris" autocomplete="off" ' +
      'placeholder="Kural ara… (ör. ışık, yerçekimi, zaman)" value="' + kacir(baloncukAra) + '">' +
    '<div class="baloncuk-izgara" id="baloncukKuralIzgara">' + baloncukKuralIzgaraHtml() + "</div>" +

    '<div class="oyun-etiket" style="margin-top:20px">Yabancı öğe — ' +
      E.yabancilar.length + " / " + (b.enFazlaYabanci || 1) + "</div>" +
    '<div class="baloncuk-izgara">' +
      baloncukYabancilari().map(function (y) {
        const secili = E.yabancilar.indexOf(y.id) !== -1;
        return '<button class="baloncuk-kural' + (secili ? " secili" : "") + (y.ozel ? " ozel" : "") +
               '" data-baloncuk-yabanci="' + y.id + '">' +
                 '<span class="bk-ad">' + kacir(y.ad) + "</span>" +
                 (y.not ? '<span class="bk-grup">' + kacir(y.not) + "</span>" : "") +
               "</button>";
      }).join("") +
    "</div>" +

    ozelEvrenBlogu() +

    (onIzleme
      ? '<div class="on-izleme">' +
          '<div class="oyun-etiket">Şu anki tahmin</div>' +
          istatistikCubuklari(onIzleme.kararlilik, onIzleme.yasam, onIzleme.tuhaflik) +
          (onIzleme.etkiler.length
            ? '<p class="oyun-ipucu">' + onIzleme.etkiler.length +
              " etkileşim tetiklenecek: " +
              onIzleme.etkiler.map(function (e) { return kacir(e.ad); }).join(" · ") + "</p>"
            : "") +
          (onIzleme.ucluler.length
            ? '<p class="oyun-ipucu uclu">' + onIzleme.ucluler.length +
              " üçlü sinerji tetiklenecek: " +
              onIzleme.ucluler.map(function (u) { return kacir(u.ad); }).join(" · ") + "</p>"
            : "") +
          (!onIzleme.etkiler.length && !onIzleme.ucluler.length
            ? '<p class="oyun-not">Henüz etkileşim yok. Farklı gruplardan kural dene.</p>'
            : "") +
        "</div>"
      : "") +

    '<button class="dugme' +
      (E.kurallar.length >= b.enAz && E.yabancilar.length ? "" : " pasif") +
      '" data-baloncuk="calistir">Evreni başlat</button>';
}

/** kararlılık/yaşam/tuhaflık için küçük yatay çubuklar. -8..12 arasını doldurur. */
function istatistikCubuklari(kararlilik, yasam, tuhaflik) {
  const cubuk = function (ad, deger) {
    const oran = Math.max(0, Math.min(100, ((deger + 8) / 20) * 100));
    const negatif = deger < 0;
    return '<div class="ist-satir">' +
             '<span class="ist-ad">' + ad + "</span>" +
             '<div class="ist-cubuk"><span class="' + (negatif ? "negatif" : "") +
               '" style="width:' + oran + '%"></span></div>' +
             '<span class="ist-deger">' + deger + "</span>" +
           "</div>";
  };
  return '<div class="baloncuk-istatistik">' +
      cubuk("kararlılık", kararlilik) + cubuk("yaşam", yasam) + cubuk("tuhaflık", tuhaflik) +
    "</div>";
}

/* ==================== KARAKTER ZAMAN ÇİZGİSİ ====================
   Bir karakterin kronolojinin hangi noktalarında göründüğünü gösterir. */

/** Bir karakterin zaman çizelgesinde (açık adımlarda) geçtiği yerleri bulur.
    Hem karakter penceresi hem karşılaştırma aracı bunu kullanır. */
function karakterZamanAdimlari(k) {
  const liste = veri.zamanCizelgesi || [];
  const ad = String(k.ad).split(" ")[0].toLocaleLowerCase("tr");
  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();

  return liste.filter(function (z) {
    const acik = yonetici || (katmanAcik(z.gizli) && spoilerUygun(z.gizli));
    if (!acik) { return false; }
    return (z.baslik + " " + z.metin).toLocaleLowerCase("tr").indexOf(ad) !== -1;
  });
}

function karakterZamani(k) {
  const liste = veri.zamanCizelgesi || [];
  const gecen = karakterZamanAdimlari(k);

  if (!gecen.length) { return ""; }

  return '<div class="kz">' +
           '<div class="oyun-etiket">Zaman çizgisinde</div>' +
           '<div class="kz-serit">' +
             liste.map(function (z) {
               const var_ = gecen.indexOf(z) !== -1;
               return '<span class="kz-nokta' + (var_ ? " dolu" : "") +
                      '" title="' + kacir(z.no + ". " + z.baslik) + '"></span>';
             }).join("") +
           "</div>" +
           '<ul class="kz-liste">' +
             gecen.map(function (z) {
               return "<li><b>" + z.no + ".</b> " + kacir(z.baslik) +
                      ' <span class="kz-cag">' + kacir(z.cag) + "</span></li>";
             }).join("") +
           "</ul>" +
         "</div>";
}

/* ==================== OYUNLA BAĞ ====================
   Sitede yaptıklarını oyuna taşıyan kısa kod. Unity tarafındaki doğrulayıcı
   OYUN_BAGI.cs dosyasında. */

const BAG_HARFLERI = { nobet: 1, cevirmen: 2, vardiya: 4, boyut: 8, yazi: 16, baloncuk: 32 };

function oyunBagKodu() {
  let maske = 0;
  Object.keys(BAG_HARFLERI).forEach(function (o) {
    if (basariVar(o)) { maske |= BAG_HARFLERI[o]; }
  });

  let katman = 0;
  (veri.katmanlar || []).forEach(function (k, i) {
    if (cozulenler[k.dogrulama]) { katman |= (1 << i); }
  });

  const govde = maske.toString(36).toUpperCase().padStart(2, "0") +
                katman.toString(36).toUpperCase().padStart(2, "0");

  let toplam = 7;
  for (let i = 0; i < govde.length; i++) { toplam = (toplam * 31 + govde.charCodeAt(i)) % 36; }

  return "SITE-" + govde + "-" + toplam.toString(36).toUpperCase();
}

function bagCiz() {
  const alan = document.querySelector("#bagAlan");
  if (!alan) { return; }

  const bitirilen = bitirilenSayisi();
  const toplamKatman = (veri.katmanlar || []).length;
  let acikKatman = 0;
  (veri.katmanlar || []).forEach(function (k) { if (cozulenler[k.dogrulama]) { acikKatman++; } });

  alan.innerHTML =
    '<p class="oyun-giris">Bu kod sitedeki ilerlemeni Delilik oyununa taşır. ' +
    "Oyun içindeki terminale girersin.</p>" +
    '<div class="bag-ozet">' +
      "<span>bitirilen oyun <b>" + bitirilen + "/" + OYUNLAR.length + "</b></span>" +
      "<span>çözülen katman <b>" + acikKatman + "/" + toplamKatman + "</b></span>" +
    "</div>" +
    '<div class="bag-kod" id="bagKod">' + kacir(oyunBagKodu()) + "</div>" +
    '<button class="dugme" data-bag="kopyala">Kodu kopyala</button>' +
    '<p class="oyun-not">Kod ilerledikçe değişir. Oyun her kodu bir kez kabul eder.</p>' +
    '<p class="pencere-durum" id="bagDurum"></p>';
}

document.addEventListener("click", function (e) {
  if (!e.target.closest("[data-bag]")) { return; }

  panoyaKopyala(oyunBagKodu()).then(function () {
    const d = document.querySelector("#bagDurum");
    if (d) { d.textContent = "Kopyalandı"; d.className = "pencere-durum iyi"; }
  }).catch(function () {
    const d = document.querySelector("#bagDurum");
    if (d) { d.textContent = "Kopyalanamadı, elle seç"; d.className = "pencere-durum kotu"; }
  });
});

/* ==================== olaylar ====================
   Not: bu blok bir düzenleme sırasında kazara silinmişti; geri yazıldı. */

document.addEventListener("click", function (e) {
  const sp = e.target.closest("[data-spoiler]");
  if (sp) { spoilerAyarla(sp.dataset.spoiler); return; }

  const sr = e.target.closest("[data-sira]");
  if (sr) { siraSecim = sr.dataset.sira; siraCiz(); return; }

  const yo = e.target.closest("[data-yazi-oyun]");
  if (yo) {
    if (yo.dataset.yaziOyun === "yeni") { Y = null; yaziOyunCiz(); }
    else { yaziOyunBaslat(yo.dataset.yaziOyun, false); }
    return;
  }

  const yt = e.target.closest("[data-yazi-ters]");
  if (yt) { yaziOyunBaslat(yt.dataset.yaziTers, true); return; }

  const ys = e.target.closest("[data-yazi-sec]");
  if (ys) { yaziOyunCevap(ys.dataset.yaziSec); return; }

  if (e.target.closest("[data-yazi-onay]")) {
    const g = document.querySelector("#yaziOyunGiris");
    if (g) { yaziOyunCevap(g.value); }
    return;
  }

  if (e.target.closest("[data-yazi-ipucu]")) {
    if (Y && !Y.bitti) { Y.ipucu = true; yaziOyunCiz(); }
    return;
  }

  const bo = e.target.closest("[data-baloncuk-ozel]");
  if (bo) {
    const ne = bo.dataset.baloncukOzel;
    if (ne === "kural-ekle" || ne === "icerik-ekle") {
      const tur = ne === "kural-ekle" ? "kural" : "icerik";
      const hata = ozelEkle(tur, baloncukTaslak[tur]);
      if (hata) { eckaBildir(hata); }
      else { baloncukTaslak[tur] = ""; }
    } else if (ne === "kural-sil" || ne === "icerik-sil") {
      ozelSil(ne === "kural-sil" ? "kural" : "icerik", bo.dataset.id);
    }
    baloncukCiz();
    return;
  }

  const bk = e.target.closest("[data-baloncuk-kural]");
  if (bk) { baloncukKuralSec(bk.dataset.baloncukKural); return; }

  const bg = e.target.closest("[data-baloncuk-grup]");
  if (bg) { baloncukGrup = bg.dataset.baloncukGrup; baloncukCiz(); return; }

  const by = e.target.closest("[data-baloncuk-yabanci]");
  if (by) {
    if (E && !E.sonuc) { baloncukYabanciSec(by.dataset.baloncukYabanci); }
    return;
  }

  const bs = e.target.closest("[data-evren-sec]");
  if (bs) { birlestirmeSec(parseInt(bs.dataset.evrenSec, 10)); return; }

  if (e.target.closest("[data-evren-birlestir]")) { evrenBirlestir(); return; }

  const bb = e.target.closest("[data-baloncuk]");
  if (bb) {
    if (bb.dataset.baloncuk === "basla") { baloncukBaslat(); }
    else { baloncukCalistir(); }
  }
});

document.addEventListener("input", function (e) {
  if (e.target.id === "baloncukAraGiris") {
    baloncukAra = e.target.value;
    const g = document.querySelector("#baloncukKuralIzgara");
    if (g) { g.innerHTML = baloncukKuralIzgaraHtml(); }
  }
  else if (e.target.id === "ozelKuralGiris") { baloncukTaslak.kural = e.target.value; }
  else if (e.target.id === "ozelIcerikGiris") { baloncukTaslak.icerik = e.target.value; }
});

document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter") { return; }
  const id = document.activeElement && document.activeElement.id;
  if (id !== "ozelKuralGiris" && id !== "ozelIcerikGiris") { return; }
  const tur = id === "ozelKuralGiris" ? "kural" : "icerik";
  const hata = ozelEkle(tur, baloncukTaslak[tur]);
  if (hata) { eckaBildir(hata); } else { baloncukTaslak[tur] = ""; }
  baloncukCiz();
});

document.addEventListener("change", function (e) {
  if (e.target.id === "karsiA") { karsiA = parseInt(e.target.value, 10); karsiHesapla(); }
  if (e.target.id === "karsiB") { karsiB = parseInt(e.target.value, 10); karsiHesapla(); }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && document.activeElement &&
      document.activeElement.id === "yaziOyunGiris") {
    yaziOyunCevap(document.activeElement.value);
  }
});

/* ==================== EVREN ANSİKLOPEDİSİ ====================
   Baloncuk Evren'de ulaştığın dokuz sonuç türünü takip eden bir koleksiyon.
   Kusursuz sonuç zaten nadir; bu, diğer sekiz türü de görmeyi bir hedef yapar. */

const ANSIKLOPEDI_ANAHTAR = "tentiforapp_ansiklopedi";

function ansiklopediListesi() {
  try {
    const d = JSON.parse(kayitOku(ANSIKLOPEDI_ANAHTAR) || "{}");
    return (d && typeof d === "object" && !Array.isArray(d)) ? d : {};
  } catch (e) { return {}; }
}

function ansiklopediKaydet(tur) {
  const d = ansiklopediListesi();
  const yeniMi = !d[tur];
  d[tur] = (d[tur] || 0) + 1;
  kayitYaz(ANSIKLOPEDI_ANAHTAR, JSON.stringify(d));

  if (yeniMi && typeof madalyaVer === "function") {
    const tumu = Object.keys(baloncukAyar().sonuclar || {});
    if (tumu.every(function (t) { return d[t]; })) { madalyaVer("ansiklopediTam"); }
  }
}

function ansiklopediCiz() {
  const alan = document.querySelector("#ansiklopediAlan");
  if (!alan) { return; }

  const b = baloncukAyar();
  const d = ansiklopediListesi();
  const turler = Object.keys(b.sonuclar || {});
  const bulunanSayi = turler.filter(function (t) { return d[t]; }).length;

  alan.innerHTML =
    '<p class="oyun-not">' + bulunanSayi + " / " + turler.length + " sonuç türü keşfedildi.</p>" +
    '<div class="ansiklopedi-izgara">' +
      turler.map(function (t) {
        const bulundu = !!d[t];
        return '<div class="ansiklopedi-kart' + (bulundu ? " bulundu" : "") + '">' +
                 '<div class="ak-ad">' + (bulundu ? kacir(turAdi(t)) : "???") + "</div>" +
                 (bulundu
                   ? '<div class="ak-sayi">' + d[t] + " kez</div>"
                   : '<div class="ak-sayi">henüz yok</div>') +
               "</div>";
      }).join("") +
    "</div>";
}
