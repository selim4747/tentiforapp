/* Yarışlar — sunucuda doğrulanan oyunlar.

   Soru bankası bu dosyadaki yarisPaketiUret() ile sitenin kendi içeriğinden
   üretilir ve yönetici hesabıyla giriş yapıldığında Supabase'e yüklenir
   (yaris_icerik_yukle). Oyuncuya sorular cevapsız gelir; puanı, süreyi ve
   doğruluğu veritabanı hesaplar (supabase/kurulum.sql, YARIŞLAR bölümü).
   Kilitli (buz altındaki) içerik hiçbir soruya girmez. */

const YARIS_SURUM = 1;   /* soru üretimi değişirse artır: yönetici girişinde banka yeniden yüklenir */

const YARISLAR = [
  { id: "kyldo_hiz", ad: "Kyldo Hız Çevirisi", ozet: "60 saniyede Kyldo simgelerini oku, kelimeyi yaz. Puan: doğru kelime." },
  { id: "isim_avi", ad: "İsim Avı", ozet: "Türkçe kelimenin Tentiforverse adını (ya da tersini) bul. Puan: baştan kesintisiz doğru sayısı." },
  { id: "arsiv_sinavi", ad: "Arşiv Sınavı", ozet: "Karakterler, sözlük, harita ve zaman çizelgesinden 10 soru. Doğrular ve kalan süre puan." },
  { id: "alinti", ad: "Kimin Satırı?", ozet: "Bir satır ya da özet: kime, neye ait? 60 saniye." },
  { id: "harita", ad: "Harita Bulmacası", ozet: "Adı verilen yeri Tömye haritasında göster. Ne kadar yakınsa o kadar puan." },
  { id: "takvim", ad: "Takvim Hesabı", ozet: "Dünya tarihinin Tömye takvimindeki karşılığını bul." },
  { id: "kronoloji", ad: "Kronoloji Rafı", ozet: "Kütüphanenin kronoloji rafı karışmış: olayları doğru sıraya diz." },
  { id: "muhur", ad: "Kyldo Mühürleri", ozet: "Verilen heceyi çizgileri yakıp çarpıları koyarak mühürle." },
  { id: "oyunbozan", ad: "Oyunbozan'ı Bul", ozet: "İpuçlarından bağlantılı iki kişiyi zamana karşı bul." },
  { id: "nobet_meydan", ad: "Nöbet — Haftalık Meydan", ozet: "Bu hafta herkes aynı gecelerle karşılaşıyor. Kim daha uzun dayanır?" }
];
const YARIS_AD = {};
YARISLAR.forEach(function (y) { YARIS_AD[y.id] = y.ad; });

/* Tömye ayı etkinlikleri: her ayın öne çıkan yarışı (sıra = Leg … Dezeh) */
const TOMYE_AYI_ETKINLIK = [
  { yaris: "kyldo_hiz", tema: "Kar yazısı" },       { yaris: "harita", tema: "Buzun haritası" },
  { yaris: "kronoloji", tema: "Donmuş zaman" },     { yaris: "muhur", tema: "Çatlaktan sızan mühürler" },
  { yaris: "arsiv_sinavi", tema: "Derin arşiv" },   { yaris: "isim_avi", tema: "Uzak isimler" },
  { yaris: "alinti", tema: "Işıkta kalan satırlar" }, { yaris: "takvim", tema: "Yıldız hesabı" },
  { yaris: "nobet_meydan", tema: "Sabır nöbeti" },  { yaris: "oyunbozan", tema: "Gecenin oyunu" },
  { yaris: "kyldo_hiz", tema: "Kelime hasadı" }
];

/* ==================== yardımcılar ==================== */

function trk(m) { return String(m == null ? "" : m).trim().toLocaleLowerCase("tr"); }

/** Tohumlu karıştırma: aynı içerik → aynı banka (gereksiz yeniden yükleme olmasın). */
function yarisKaristir(dizi, tohum) {
  let t = tohum >>> 0;
  const r = function () { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; };
  const d = dizi.slice();
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const x = d[i]; d[i] = d[j]; d[j] = x; }
  return d;
}

function yarisSecenekler(dogru, havuz, tohum, adet) {
  const diger = yarisKaristir(havuz.filter(function (x) { return trk(x) !== trk(dogru); }), tohum)
    .filter(function (x, i, a) { return a.findIndex(function (y) { return trk(y) === trk(x); }) === i; })
    .slice(0, (adet || 4) - 1);
  return yarisKaristir([dogru].concat(diger), tohum + 7);
}

function tomyeEtkinligi() {
  const d = (typeof dunyadanTomyeye === "function") ? dunyadanTomyeye(new Date()) : null;
  if (!d) { return null; }
  const e = TOMYE_AYI_ETKINLIK[(d.ayNo - 1) % TOMYE_AYI_ETKINLIK.length];
  return { ay: d.ay, yil: d.yil, koken: d.ayKoken, yaris: e.yaris, tema: e.tema };
}

/* ==================== soru bankası ==================== */

/** Bir hecenin Kyldo çizimi: yanan çizgiler (c) ve çarpılar (x). */
function heceParcalari(h) {
  const a = veri.alfabe || {};
  return { c: (h.unsuz && a.unsuzler && a.unsuzler[h.unsuz]) || [], x: (h.unlu && a.unluler && a.unluler[h.unlu]) || [] };
}

function kyldoYazilabilir(k) {
  const a = veri.alfabe || {};
  return Array.from(trk(k)).every(function (h) { return (a.unsuzler && a.unsuzler[h]) || (a.unluler && a.unluler[h]); });
}

/** Kıyı çizgisinin içinde mi? (arşiv sınavı: yer hangi kıtada) */
function noktaCokgende(p, x, y) {
  let ic = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) { ic = !ic; }
  }
  return ic;
}

function yarisPaketiUret() {
  const banka = {};
  const kelimeler = [].concat((veri.kelimeler || {}).kolay || [], (veri.kelimeler || {}).orta || [], (veri.kelimeler || {}).zor || []);
  const acikKarakterler = (veri.karakterler || []).filter(function (k) { return k.ad && k.unvan; });

  /* Kyldo hız: kelimenin hece çizimleri, cevap kelimenin kendisi */
  banka.kyldo_hiz = kelimeler.filter(kyldoYazilabilir).map(function (k) {
    return { soru: { heceler: heceleraAyir(k).map(heceParcalari) }, cevap: { kabul: [trk(k)] } };
  });

  /* İsim avı: harf çevirisi, iki yönde */
  const cevirisi = function (k) { return isimUret(k)[0].sonuc; };
  const turkce = kelimeler.filter(function (k) { return /^[a-zçğıöşü]+$/.test(trk(k)) && trk(k).length >= 3; });
  banka.isim_avi = [];
  turkce.forEach(function (k, i) {
    const t = cevirisi(k);
    const yollar = isimUret(k).map(function (x) { return x.sonuc; });
    const baskalari = turkce.slice(i + 1, i + 12).map(cevirisi);
    banka.isim_avi.push({ soru: { yon: "tentifor", metin: basHarf(k), secenekler: yarisSecenekler(t, yollar.concat(baskalari), i) }, cevap: { dogru: t } });
    const turkceSecenek = turkce.slice(Math.max(0, i - 6), i + 6).map(basHarf);
    banka.isim_avi.push({ soru: { yon: "turkce", metin: t, secenekler: yarisSecenekler(basHarf(k), turkceSecenek, i + 1000) }, cevap: { dogru: basHarf(k) } });
  });

  /* Arşiv sınavı: yalnızca kartlarda herkese görünen bilgiler */
  const as = [];
  const adlar = acikKarakterler.map(function (k) { return k.ad; });
  acikKarakterler.forEach(function (k, i) {
    as.push({ soru: { metin: "“" + k.unvan + "” kim?", secenekler: yarisSecenekler(k.ad, adlar, i) }, cevap: { dogru: k.ad } });
    if (k.grup) {
      const gruplar = acikKarakterler.map(function (x) { return x.grup; }).filter(Boolean);
      as.push({ soru: { metin: k.ad + " hangi çevrede?", secenekler: yarisSecenekler(k.grup, gruplar, i + 50) }, cevap: { dogru: k.grup } });
    }
  });
  (veri.sozluk || []).forEach(function (s, i) {
    const terimler = veri.sozluk.map(function (x) { return x.terim; });
    const tanim = String(s.tanim || "").split(/(?<=\.)\s/)[0].slice(0, 140);
    if (tanim) { as.push({ soru: { metin: "“" + tanim + "” — hangi terim?", secenekler: yarisSecenekler(s.terim, terimler, i + 100) }, cevap: { dogru: s.terim } }); }
  });
  const tomye = (veri.haritalar || [])[0];
  if (tomye) {
    const kitalar = (tomye.yerler || []).filter(function (y) { return y.tur === "Kıta" && y.sekil; });
    (tomye.yerler || []).filter(function (y) { return y.tur !== "Kıta" && !y.gizli; }).forEach(function (y, i) {
      const kita = kitalar.find(function (k) { return noktaCokgende(k.sekil, y.x, y.y); });
      const yer = kita ? kita.ad : "Buz Okyanusu";
      as.push({ soru: { metin: y.ad + " nerede?", secenekler: yarisSecenekler(yer, kitalar.map(function (k) { return k.ad; }).concat(["Buz Okyanusu"]), i + 200, 3) }, cevap: { dogru: yer } });
    });
  }
  const caglar = (veri.zamanCizelgesi || []).map(function (z) { return z.cag; });
  (veri.zamanCizelgesi || []).forEach(function (z, i) {
    as.push({ soru: { metin: "“" + z.baslik + "” hangi çağda?", secenekler: yarisSecenekler(z.cag, caglar, i + 300) }, cevap: { dogru: z.cag } });
  });
  banka.arsiv_sinavi = as;

  /* Kimin satırı: kilitsiz alıntılar ve karakter kartı özetleri */
  const al = [];
  const alintiSahipleri = (veri.alintilar || []).filter(function (a) { return !a.gizli; }).map(function (a) { return a.kim; });
  (veri.alintilar || []).filter(function (a) { return !a.gizli; }).forEach(function (a, i) {
    al.push({ soru: { metin: "“" + a.metin + "”", secenekler: yarisSecenekler(a.kim, alintiSahipleri, i + 400) }, cevap: { dogru: a.kim } });
  });
  acikKarakterler.filter(function (k) { return k.ozet; }).forEach(function (k, i) {
    al.push({ soru: { metin: "“" + k.ozet + "” — kim?", secenekler: yarisSecenekler(k.ad, adlar, i + 500) }, cevap: { dogru: k.ad } });
  });
  banka.alinti = al;

  /* Harita bulmacası: Tömye'nin kıta olmayan yerleri */
  banka.harita = tomye ? (tomye.yerler || []).filter(function (y) { return y.tur !== "Kıta" && !y.gizli; }).map(function (y) {
    return { soru: { ad: y.ad, tur: y.tur }, cevap: { x: y.x, y: y.y } };
  }) : [];

  /* Takvim hesabı: 2000–2040 arası tarihler */
  banka.takvim = [];
  const ayAdlari = ((veri.takvim || {}).aylar || []).map(function (a) { return a.ad; });
  if (ayAdlari.length && typeof dunyadanTomyeye === "function") {
    const metin = function (d) { return d.gun + " " + d.ay + " " + d.yil; };
    for (let i = 0; i < 80; i++) {
      const tarih = new Date(Date.UTC(2000, 0, 1) + ((i * 2654435761) % (40 * 365)) * 86400000 + 12 * 3600000);
      const d = dunyadanTomyeye(tarih);
      if (!d) { continue; }
      const yanlis = [
        { gun: d.gun, ay: ayAdlari[(d.ayNo) % ayAdlari.length], yil: d.yil },
        { gun: d.gun, ay: d.ay, yil: d.yil + 1 },
        { gun: Math.max(1, (d.gun + 9) % 28 + 1), ay: d.ay, yil: d.yil },
        { gun: d.gun, ay: ayAdlari[(d.ayNo + ayAdlari.length - 2) % ayAdlari.length], yil: d.yil - 1 }
      ].map(metin);
      banka.takvim.push({ soru: { tarih: tarih.toISOString().slice(0, 10), secenekler: yarisSecenekler(metin(d), yanlis, i + 600) }, cevap: { dogru: metin(d) } });
    }
  }

  /* Kronoloji rafı: 5 olay, doğru sıra = zaman çizelgesindeki sıra */
  banka.kronoloji = [];
  const olaylar = veri.zamanCizelgesi || [];
  for (let i = 0; olaylar.length >= 5 && i < 40; i++) {
    const secim = yarisKaristir(olaylar, i + 700).slice(0, 5);
    banka.kronoloji.push({
      soru: { olaylar: yarisKaristir(secim, i + 800).map(function (o) { return { id: String(o.no), baslik: o.baslik, cag: o.cag }; }) },
      cevap: { dogru: secim.slice().sort(function (a, b) { return a.no - b.no; }).map(function (o) { return String(o.no); }) }
    });
  }

  /* Kyldo mühürleri: alfabedeki her hece */
  banka.muhur = [];
  const a = veri.alfabe || {};
  const unsuzler = Object.keys(a.unsuzler || {}), unluler = Object.keys(a.unluler || {});
  unsuzler.forEach(function (u) {
    unluler.forEach(function (v) {
      const p = heceParcalari({ unsuz: u, unlu: v });
      banka.muhur.push({ soru: { hece: u + v }, cevap: { dogru: p.c.map(function (c) { return "c:" + c; }).concat(p.x.map(function (x) { return "x:" + x; })) } });
    });
  });

  /* Oyunbozan'ı bul: şüpheli tahtası bulmacaları */
  banka.oyunbozan = (veri.suphehliBulmacalar || []).map(function (b) {
    return { soru: { kisiler: b.kisiler, ipuclari: b.ipuclari }, cevap: { dogru: b.cozum } };
  });

  /* Günün kelimesi: Tentiforverse'ün kendi adları (4–7 harf) */
  const adaylar = [];
  const ekle = function (m) {
    const k = trk(m);
    if (/^[a-zçğıöşü]{4,7}$/.test(k) && adaylar.indexOf(k) === -1) { adaylar.push(k); }
  };
  acikKarakterler.forEach(function (k) { ekle(k.ad); });
  (veri.isimSozluk || []).forEach(function (s) { ekle(s.isim); });
  (veri.sozluk || []).forEach(function (s) { ekle(s.terim); });
  ((veri.takvim || {}).aylar || []).forEach(function (x) { ekle(x.ad); });
  (veri.haritalar || []).forEach(function (h) { ekle(h.ad); (h.yerler || []).forEach(function (y) { if (!y.gizli) { ekle(y.ad); } }); });
  banka.gunun_kelimesi = yarisKaristir(adaylar.sort(), 2026).map(function (k) { return { soru: {}, cevap: { kelime: k } }; });

  const kesif = [].concat(
    (veri.karakterler || []).map(function (k) { return "karakter:" + k.id; }),
    (veri.evren || []).map(function (e) { return "evren:" + e.id; }),
    (veri.katmanlar || []).map(function (k) { return "katman:" + k.id; }));

  const sayilar = {
    karakter: (veri.karakterler || []).length, katman: (veri.katmanlar || []).length,
    galeri: (veri.galeri || []).length, madalya: (veri.madalyalar || []).length,
    oyun: (typeof OYUNLAR !== "undefined") ? OYUNLAR.length : 6
  };

  /* sıradaki içerik oylaması: henüz başlanmamış yapımlar (yapımda/yazımda/yayında olanlar hariç) */
  const baslanmis = /^(yapımda|yazımda|yayında|çıktı|tamamlandı)$/i;
  const yapimlar = [];
  (veri.yapimlar || []).forEach(function (y) {
    if (!y || !y.ad || baslanmis.test(String(y.durum || "").trim())) { return; }
    const ad = yapimlar.indexOf(y.ad) === -1 ? y.ad : y.ad + " (" + y.tur + ")";
    if (yapimlar.indexOf(ad) === -1) { yapimlar.push(ad.slice(0, 120)); }
  });

  const govde = { banka: banka, kesif: kesif, sayilar: sayilar, yapimlar: yapimlar };
  govde.ozet = YARIS_SURUM + "-" + metinTohumu(JSON.stringify(govde)).toString(36);
  return govde;
}

/** Yönetici hesabıyla girildiğinde soru bankasını ve liderlik sayılarını günceller. */
async function yarisIcerikEsitle() {
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) { return; }
  const yon = await hesapIstemci.rpc("yonetici_mi");
  if (yon.error || yon.data !== true) { return; }
  let paket;
  try { paket = yarisPaketiUret(); } catch (e) { console.error("[TentiforApp] yarış paketi:", e); return; }
  const { data } = await hesapIstemci.from("yaris_ayar").select("icerik_ozet").eq("id", 1).maybeSingle();
  if (data && data.icerik_ozet === paket.ozet) { return; }
  const r = await hesapIstemci.rpc("yaris_icerik_yukle", { p: paket });
  if (!r.error) { hesapBildir("Yarış soruları güncellendi"); yarislarCiz(); }
}

/* ==================== durum ==================== */

let Y2 = null;          /* etkin yarış: { yaris, oturum, sure, sorular, cevaplar, indeks, bitis, sonuc } */
let yarisZaman = 0;
let yarisEnIyi = {};    /* kendi en iyi puanlarım */

function yarisHazirMi() { return typeof hesapIstemci !== "undefined" && hesapIstemci && typeof hesapKullanici !== "undefined"; }

/* ==================== çizim: bölüm ==================== */

function yarislarCiz() {
  const alan = document.querySelector("#yarislarAlan");
  if (!alan) { return; }
  if (typeof hesapEtkin !== "function" || !hesapEtkin()) {
    alan.innerHTML = '<p class="oyun-not">Yarışlar hesaplar açılınca başlayacak.</p>';
    return;
  }
  if (Y2 && !Y2.sonuc) { yarisOyunCiz(); return; }
  /* hesap kütüphanesi gerekince yüklenir; hazır olunca hesapOturumAyarla bu bölümü yeniden çizer */
  if (typeof hesapIstemci !== "undefined" && !hesapIstemci && typeof hesapGerekli === "function") { hesapGerekli(); }

  const e = tomyeEtkinligi();
  alan.innerHTML =
    (e ? '<div class="yaris-etkinlik"><span class="oyun-etiket">' + kacir(e.ay + " " + e.yil) + " ayı · " + kacir(e.tema) + "</span>" +
         "<p>Bu ayın öne çıkan yarışı <b>" + kacir(YARIS_AD[e.yaris]) + "</b>: ilk oyununda eçka ödülü iki katı, " +
         "ay boyunca ayrı bir sıralaması var.</p>" +
         '<button class="dugme dugme-sade" data-yaris-basla="' + e.yaris + '">Hemen oyna</button></div>' : "") +
    '<div id="gkAlan"></div>' +
    '<div id="haftalikAlan"></div>' +
    '<div id="kulupSavasAlan"></div>' +
    (Y2 && Y2.sonuc ? '<div id="yarisSonucAlan">' + yarisSonucHtml() + "</div>" : "") +
    '<div class="yaris-izgara">' + YARISLAR.map(function (y) {
      const one = e && e.yaris === y.id;
      return '<div class="yaris-kart' + (one ? " one" : "") + '">' +
          (one ? '<span class="yaris-rozet">bu ayın yarışı</span>' : "") +
          "<h4>" + kacir(y.ad) + "</h4>" +
          '<p class="oyun-not">' + kacir(y.ozet) + "</p>" +
          '<div class="yaris-kart-alt"><span class="yaris-eniyi">' +
            (yarisEnIyi[y.id] !== undefined ? "en iyin: <b>" + yarisEnIyi[y.id] + "</b>" : "") + "</span>" +
            '<button class="dugme" data-yaris-basla="' + y.id + '">Başla</button></div>' +
        "</div>";
    }).join("") + "</div>" +
    '<p class="oyun-not">Sıralamalar <button class="ic-bag" data-gez-git="liderlik">Liderlik</button> bölümünde, “Yarışlar” altında.</p>';

  gunKelimesiYukle();
  kulupSavasiCiz();
  yarisEnIyileriYukle();
  if (typeof haftalikCiz === "function") { haftalikCiz(); }
}

async function yarisEnIyileriYukle() {
  if (!yarisHazirMi() || !hesapKullanici || !hesapProfil || !hesapProfil.kullanici_adi) { return; }
  const { data } = await hesapIstemci.from("yaris_tablolari").select("yaris, puan")
    .eq("kapsam", "tum").eq("kullanici_adi", hesapProfil.kullanici_adi);
  const onceki = JSON.stringify(yarisEnIyi);
  yarisEnIyi = {};
  (data || []).forEach(function (r) { yarisEnIyi[r.yaris] = Number(r.puan); });
  if (JSON.stringify(yarisEnIyi) !== onceki && !(Y2 && !Y2.sonuc)) {
    document.querySelectorAll(".yaris-kart").forEach(function (k, i) {
      const el = k.querySelector(".yaris-eniyi"); const id = YARISLAR[i].id;
      if (el) { el.innerHTML = yarisEnIyi[id] !== undefined ? "en iyin: <b>" + yarisEnIyi[id] + "</b>" : ""; }
    });
  }
}

/* ==================== yarış akışı ==================== */

async function yarisBasla(id) {
  if (!yarisHazirMi()) { return; }
  if (!hesapKullanici) { hesapBildir("Yarışmak için giriş yap"); if (typeof hesapPencere === "function") { hesapPencere("giris"); } return; }
  if (id === "arsiv_sinavi" && typeof bolumErisimi === "function" && !bolumErisimi("arsiv")) {
    hesapBildir("Arşiv Sınavı için arşive erişimin olmalı (Kod)"); return;
  }
  const { data, error } = await hesapIstemci.rpc("yaris_baslat", { p_yaris: id });
  if (error) { hesapBildir(hesapHataMetni(error)); return; }
  if (!data || data.durum !== "tamam") {
    hesapBildir(({ bos: "Bu yarışın soruları henüz hazır değil (yönetici girişi bekleniyor)", sinir: "Bir saatte çok fazla yarış başlattın, biraz dinlen",
                   giris: "Önce giriş yap", yok: "Bilinmeyen yarış" })[data && data.durum] || "Başlatılamadı");
    return;
  }

  Y2 = { yaris: id, oturum: data.oturum, sure: data.sure, tohum: data.tohum, sorular: data.sorular || [],
         cevaplar: [], indeks: 0, bitis: Date.now() + data.sure * 1000, sonuc: null, secim: [], sira: null };

  if (id === "nobet_meydan") { yarisNobetBasla(); return; }

  clearInterval(yarisZaman);
  yarisZaman = setInterval(yarisSaatTik, 250);
  if (typeof bolumeGit === "function") { bolumeGit("yarislar"); }
  yarisOyunCiz();
}

function yarisKalanSn() { return Y2 ? Math.max(0, Math.ceil((Y2.bitis - Date.now()) / 1000)) : 0; }

function yarisSaatTik() {
  if (!Y2 || Y2.sonuc) { clearInterval(yarisZaman); return; }
  const el = document.querySelector("#yarisSaat");
  const k = yarisKalanSn();
  if (el) { el.textContent = k + " sn"; el.classList.toggle("az", k <= 10); }
  if (k <= 0) { yarisBitir(); }
}

function yarisCevapla(deger) {
  if (!Y2 || Y2.sonuc) { return; }
  Y2.cevaplar[Y2.indeks] = deger;
  Y2.indeks++;
  Y2.secim = [];
  if (Y2.indeks >= Y2.sorular.length) { yarisBitir(); return; }
  yarisOyunCiz();
}

let yarisBitiyor = false;

async function yarisBitir() {
  if (!Y2 || Y2.sonuc || yarisBitiyor) { return; }
  yarisBitiyor = true;
  clearInterval(yarisZaman);
  const cevaplar = Y2.yaris === "nobet_meydan" ? { skor: Y2.skor || 0 }
    : Y2.sorular.map(function (_, i) { return Y2.cevaplar[i] === undefined ? null : Y2.cevaplar[i]; });
  try {
    const { data, error } = await hesapIstemci.rpc("yaris_bitir", { p_oturum: Y2.oturum, p_cevaplar: cevaplar });
    if (error) { Y2.sonuc = { durum: "hata", mesaj: hesapHataMetni(error) }; }
    else { Y2.sonuc = data || { durum: "hata" }; }
  } finally { yarisBitiyor = false; }

  if (Y2.sonuc.durum === "tamam") { yarisOdul(Y2.yaris, Y2.sonuc.puan); }
  if (typeof toplulukMadalyaKontrol === "function") { toplulukMadalyaKontrol(); }
  yarislarCiz();
  if (typeof bolumeGit === "function") { bolumeGit("yarislar"); }
}

/** Günde bir kez, yarışı bitirene küçük bir eçka ödülü (bu ayın yarışında iki katı). */
function yarisOdul(id, puan) {
  if (!puan || typeof kilitAcik !== "function") { return; }
  const anahtar = "yaris_" + id + "_" + bugununAdi();
  if (kilitAcik(anahtar)) { return; }
  cuzdan.acilan.push(anahtar);
  const e = tomyeEtkinligi();
  const odul = (e && e.yaris === id) ? 20 : 10;
  eckaKazan(odul, YARIS_AD[id]);
}

/* ==================== oyun ekranları ==================== */

function yarisUst() {
  return '<div class="yaris-ust"><span class="oyun-etiket">' + kacir(YARIS_AD[Y2.yaris]) + "</span>" +
    '<span class="yaris-ilerleme">' + Math.min(Y2.indeks + 1, Y2.sorular.length) + " / " + Y2.sorular.length + "</span>" +
    '<span class="yaris-saat" id="yarisSaat">' + yarisKalanSn() + " sn</span>" +
    '<button class="dugme dugme-sade" data-yaris-bitir="1">Bitir</button></div>';
}

/** Kyldo hecesini parçalarından çizer (cevabı ele vermeden). */
function parcaSvg(p, boyut) {
  const b = boyut || 56, kenar = b * 0.16, ic = b - kenar * 2;
  const ol = function (d) { return kenar + d * ic; };
  let s = "";
  (p.c || []).forEach(function (ad) {
    const y = PARCA_YERI[ad]; if (!y) { return; }
    s += '<line x1="' + ol(y[0]) + '" y1="' + ol(y[1]) + '" x2="' + ol(y[2]) + '" y2="' + ol(y[3]) + '" class="yz-cizgi"/>';
  });
  (p.x || []).forEach(function (ad) {
    const h = HUCRE_YERI[ad]; if (!h) { return; }
    const cx = ol(h[0]), cy = ol(h[1]), r = ic * 0.1;
    s += '<line x1="' + (cx - r) + '" y1="' + (cy - r) + '" x2="' + (cx + r) + '" y2="' + (cy + r) + '" class="yz-carpi"/>' +
         '<line x1="' + (cx - r) + '" y1="' + (cy + r) + '" x2="' + (cx + r) + '" y2="' + (cy - r) + '" class="yz-carpi"/>';
  });
  return '<svg class="yz-hece" viewBox="0 0 ' + b + " " + b + '" width="' + b + '" height="' + b + '" aria-hidden="true">' + s + "</svg>";
}

function yarisOyunCiz() {
  const alan = document.querySelector("#yarislarAlan");
  if (!alan || !Y2) { return; }
  const s = Y2.sorular[Y2.indeks] ? Y2.sorular[Y2.indeks].soru : null;
  if (!s) { yarisBitir(); return; }
  let govde = "";
  const tur = Y2.yaris;

  if (tur === "kyldo_hiz") {
    govde = '<div class="yaris-kyldo">' + s.heceler.map(function (p) { return parcaSvg(p, 64); }).join("") + "</div>" +
      '<form data-yaris-metin="1" class="yaris-form"><input class="kod-giris yaris-giris" id="yarisGiris" autocomplete="off" ' +
      'autocapitalize="off" spellcheck="false" placeholder="kelime"><button class="dugme" type="submit">Gönder</button></form>' +
      '<p class="oyun-not">Boş geçmek için yazmadan gönder.</p>';
  } else if (tur === "isim_avi" || tur === "arsiv_sinavi" || tur === "alinti" || tur === "takvim") {
    let soru = s.metin;
    if (tur === "isim_avi") { soru = s.yon === "tentifor" ? "“" + s.metin + "” kelimesinin Tentiforverse adı?" : "“" + s.metin + "” hangi Türkçe kelimeden?"; }
    if (tur === "takvim") { soru = new Date(s.tarih + "T12:00:00Z").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) + " — Tömye'de hangi gün?"; }
    govde = '<p class="yaris-soru">' + kacir(soru) + "</p>" +
      '<div class="yaris-secenekler">' + s.secenekler.map(function (x) {
        return '<button class="dugme dugme-sade" data-yaris-secenek="' + kacir(x) + '">' + kacir(x) + "</button>";
      }).join("") + "</div>";
  } else if (tur === "harita") {
    govde = '<p class="yaris-soru">' + kacir(s.ad) + ' <span class="oyun-not">(' + kacir(s.tur) + ")</span> nerede? Haritada dokun.</p>" +
      '<div class="yaris-harita" id="yarisHarita">' + yarisHaritaSvg() + "</div>" +
      '<button class="dugme' + (Y2.nokta ? "" : " pasif") + '" data-yaris-nokta="1">Buradadır</button>';
  } else if (tur === "kronoloji") {
    if (!Y2.sira) { Y2.sira = s.olaylar.map(function (o) { return o.id; }); }
    const bul = function (id) { return s.olaylar.find(function (o) { return o.id === id; }); };
    govde = '<p class="yaris-soru">En eskiden en yeniye diz.</p><ol class="yaris-sira">' + Y2.sira.map(function (id, i) {
      const o = bul(id);
      return "<li><span>" + kacir(o.baslik) + '<span class="oyun-not"> · ' + kacir(o.cag) + "</span></span>" +
        '<button class="dugme dugme-sade" data-yaris-yukari="' + i + '" aria-label="Yukarı"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
        '<button class="dugme dugme-sade" data-yaris-asagi="' + i + '" aria-label="Aşağı"' + (i === Y2.sira.length - 1 ? " disabled" : "") + ">↓</button></li>";
    }).join("") + '</ol><button class="dugme" data-yaris-sira-gonder="1">Rafa yerleştir</button>';
  } else if (tur === "muhur") {
    const sec = Y2.secim;
    const secimParca = { c: [], x: [] };
    sec.forEach(function (x) { const p = x.split(":"); (p[0] === "c" ? secimParca.c : secimParca.x).push(p[1]); });
    const dugme = function (anahtar, ad) {
      const acik = sec.indexOf(anahtar) !== -1;
      return '<button class="muhur-dugme' + (acik ? " acik" : "") + '" data-muhur="' + anahtar + '" aria-pressed="' + acik + '">' + ad + "</button>";
    };
    govde = '<p class="yaris-soru">“' + kacir(s.hece) + "” hecesini mühürle</p>" +
      '<div class="muhur-onizleme">' + parcaSvg(secimParca, 120) + "</div>" +
      '<div class="muhur-grup"><span class="oyun-etiket">Çizgiler (ünsüz)</span><div class="muhur-dugmeler">' +
        dugme("c:ust", "Üst") + dugme("c:orta", "Orta") + dugme("c:alt", "Alt") +
        dugme("c:sol", "Sol") + dugme("c:ortaD", "Orta dikey") + dugme("c:sag", "Sağ") + "</div></div>" +
      '<div class="muhur-grup"><span class="oyun-etiket">Çarpılar (ünlü)</span><div class="muhur-dugmeler">' +
        dugme("x:solUst", "Sol üst") + dugme("x:sagUst", "Sağ üst") + dugme("x:solAlt", "Sol alt") + dugme("x:sagAlt", "Sağ alt") + "</div></div>" +
      '<button class="dugme" data-yaris-muhur-gonder="1">Mühürle</button>';
  } else if (tur === "oyunbozan") {
    govde = '<p class="yaris-soru">Bağlantılı iki kişiyi seç.</p>' +
      '<ul class="yaris-ipucu">' + (s.ipuclari || []).map(function (i) { return "<li>" + kacir(i) + "</li>"; }).join("") + "</ul>" +
      '<div class="yaris-secenekler">' + s.kisiler.map(function (k) {
        const secili = Y2.secim.indexOf(k.ad) !== -1;
        return '<button class="dugme' + (secili ? "" : " dugme-sade") + '" data-yaris-kisi="' + kacir(k.ad) + '">' + kacir(k.ad) +
          '<span class="oyun-not"> · ' + kacir(k.detay) + "</span></button>";
      }).join("") + "</div>" +
      '<button class="dugme' + (Y2.secim.length === 2 ? "" : " pasif") + '" data-yaris-kisi-gonder="1">Bunlar</button>';
  }

  alan.innerHTML = '<div class="yaris-oyun">' + yarisUst() + govde + "</div>";
  const g = alan.querySelector("#yarisGiris");
  if (g) { g.focus({ preventScroll: true }); }
}

/* Harita: yer adları gizli, yalnızca kıtalar. Tıklanan nokta dünya birimine çevrilir. */
function yarisHaritaSvg() {
  const h = (veri.haritalar || [])[0];
  if (!h || typeof haritaSahne !== "function") { return ""; }
  const w = 400, k = w / 100;
  let isaret = "";
  if (Y2.nokta) {
    isaret = '<circle cx="' + (Y2.nokta.x * k) + '" cy="' + (Y2.nokta.y * k) + '" r="7" class="yaris-nokta"/>';
  }
  return '<svg viewBox="0 0 ' + w + " " + w + '" data-yaris-harita="1" role="img" aria-label="Tömye haritası">' +
    haritaSahne(h, w, w, 50, 50, k, { kimlik: "yaris", etkilesim: false, yil: null, gece: null, yersiz: true }) + isaret + "</svg>";
}

/* ==================== sonuç ==================== */

function yarisCevapMetni(c) {
  if (!c) { return ""; }
  if (c.kabul) { return c.kabul[0]; }
  if (c.dogru && Array.isArray(c.dogru)) {
    if (Y2 && Y2.yaris === "kronoloji") {
      const s = Y2.sorular[0].soru.olaylar;
      return c.dogru.map(function (id) { const o = s.find(function (x) { return x.id === id; }); return o ? o.baslik : id; }).join(" → ");
    }
    return c.dogru.join(", ");
  }
  if (c.dogru !== undefined) { return String(c.dogru); }
  if (c.x !== undefined) { return "işaretli nokta"; }
  return "";
}

function yarisSonucHtml() {
  const s = Y2.sonuc;
  if (s.durum !== "tamam") {
    return '<div class="yaris-sonuc"><h3>' + kacir(({ gec: "Süre doldu", gecersiz: "Bu oturum kapanmış" })[s.durum] || "Kaydedilemedi") + "</h3>" +
      (s.mesaj ? '<p class="oyun-not">' + kacir(s.mesaj) + "</p>" : "") +
      '<button class="dugme" data-yaris-basla="' + Y2.yaris + '">Tekrar</button></div>';
  }
  const liste = (s.sonuclar || []).map(function (r, i) {
    if (Y2.yaris === "kronoloji" || Y2.yaris === "harita") {
      return "<li class=\"" + (r.dogru ? "dogru" : "yanlis") + "\">" + (i + 1) + ". " +
        (Y2.yaris === "harita" ? kacir(Y2.sorular[i].soru.ad) + " — " + r.kismi + " puan" : kacir(yarisCevapMetni(r.cevap))) + "</li>";
    }
    return "<li class=\"" + (r.dogru ? "dogru" : "yanlis") + "\">" + (r.dogru ? "✓ " : "✗ ") + kacir(yarisCevapMetni(r.cevap)) + "</li>";
  }).join("");
  return '<div class="yaris-sonuc">' +
    '<span class="oyun-etiket">' + kacir(YARIS_AD[Y2.yaris]) + "</span>" +
    '<div class="yaris-puan">' + s.puan + "<span>puan</span></div>" +
    '<p class="oyun-not">' + s.dogru + " doğru · " + Math.round((s.sure_ms || 0) / 1000) + " sn</p>" +
    (s.supheli ? '<p class="oyun-not kotu">Bu sonuç insan hızının üstünde göründüğü için tablolara yazılmadı.</p>' : "") +
    (liste ? '<details class="yaris-dokum"><summary>Cevaplar</summary><ol>' + liste + "</ol></details>" : "") +
    '<div class="oyun-sira"><button class="dugme" data-yaris-basla="' + Y2.yaris + '">Tekrar</button>' +
      '<button class="dugme dugme-sade" data-yaris-kapat="1">Kapat</button></div></div>';
}

/* ==================== Nöbet haftalık meydan ==================== */

function yarisNobetBasla() {
  /* 15-dalga-5.js'teki meydan altyapısı: aynı tohum = aynı geceler */
  meydan = { oyun: "nobet", tohum: Number(Y2.tohum) >>> 0, skor: 0, haftalik: true };
  if (typeof oyunSifirla === "function") { meydanTohumla("nobet"); oyunSifirla(false); }
  const btn = document.querySelector('[data-oyun-sekme="nobet"]');
  if (btn) { btn.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
  if (typeof bolumeGit === "function") { bolumeGit("oyunlar"); }
  hesapBildir("Haftalık meydan başladı: bu hafta herkes aynı gecelerle karşılaşıyor");
  if (typeof meydanCiz === "function") { meydanCiz(); }
}

/** meydanBitir (15-dalga-5.js) haftalık meydanda buraya gelir. */
function yarisMeydanBitti(skor) {
  if (!Y2 || Y2.yaris !== "nobet_meydan" || Y2.sonuc) { return; }
  Y2.skor = skor;
  yarisBitir();
}

/* ==================== Günün Kelimesi ==================== */

let gkDurum = null;

async function gunKelimesiYukle() {
  const alan = document.querySelector("#gkAlan");
  if (!alan || !yarisHazirMi()) { return; }
  if (!hesapKullanici) {
    alan.innerHTML = '<div class="gk"><span class="oyun-etiket">Günün kelimesi</span>' +
      '<p class="oyun-not">Her gün herkese aynı Tentiforverse kelimesi, 6 hak. Oynamak için giriş yap.</p>' +
      '<button class="dugme dugme-sade" data-hesap-pencere="giris">Giriş yap</button></div>';
    return;
  }
  const { data, error } = await hesapIstemci.rpc("gk_durum");
  if (error || !data || data.durum !== "tamam") {
    alan.innerHTML = '<div class="gk"><span class="oyun-etiket">Günün kelimesi</span><p class="oyun-not">' +
      (data && data.durum === "bos" ? "Kelimeler henüz hazır değil." : "Şu an ulaşılamıyor.") + "</p></div>";
    return;
  }
  gkDurum = data;
  gunKelimesiCiz();
}

function gunKelimesiCiz(uyari) {
  const alan = document.querySelector("#gkAlan");
  const d = gkDurum;
  if (!alan || !d) { return; }
  const satirlar = [];
  for (let i = 0; i < d.hak; i++) {
    const t = d.tahminler[i];
    let hucre = "";
    for (let j = 0; j < d.uzunluk; j++) {
      const h = t ? Array.from(t.kelime)[j] : "";
      const s = t ? t.sonuc[j] : "";
      hucre += '<span class="gk-hucre ' + (s === "d" ? "dogru" : s === "v" ? "var" : s === "y" ? "yok" : "") + '">' + kacir((h || "").toLocaleUpperCase("tr")) + "</span>";
    }
    satirlar.push('<div class="gk-satir">' + hucre + "</div>");
  }
  alan.innerHTML = '<div class="gk">' +
    '<div class="gk-ust"><span class="oyun-etiket">Günün kelimesi</span><span class="oyun-not">' + d.uzunluk + " harf · " +
      (d.hak - d.tahminler.length) + " hak</span></div>" +
    '<div class="gk-izgara">' + satirlar.join("") + "</div>" +
    (d.bitti
      ? '<p class="gk-son">' + (d.cozuldu ? "Buldun! " + d.tahminler.length + "/" + d.hak : "Bugünkü kelime: <b>" + kacir(String(d.cevap || "").toLocaleUpperCase("tr")) + "</b>") + "</p>" +
        '<button class="dugme dugme-sade" data-gk-paylas="1">Sonucu paylaş</button>'
      : '<form data-gk-form="1" class="yaris-form"><input class="kod-giris yaris-giris" id="gkGiris" maxlength="' + d.uzunluk + '" ' +
          'autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + d.uzunluk + ' harfli bir kelime"><button class="dugme" type="submit">Dene</button></form>' +
        '<p class="oyun-not">Mavi: doğru yerde · sarı: kelimede var · gri: yok. Tentiforverse\'ün kendi adlarından biri.</p>') +
    (uyari ? '<p class="pencere-durum kotu">' + kacir(uyari) + "</p>" : "") +
    "</div>";
}

async function gunKelimesiTahmin(k) {
  const { data, error } = await hesapIstemci.rpc("gk_tahmin", { p: trk(k) });
  if (error) { gunKelimesiCiz(hesapHataMetni(error)); return; }
  if (data && data.durum === "gecersiz") { gunKelimesiCiz(data.uzunluk + " harfli bir kelime yaz (yalnızca harf)"); return; }
  if (data && data.durum === "tamam") {
    const once = gkDurum && gkDurum.bitti;
    gkDurum = data;
    gunKelimesiCiz();
    if (!once && data.cozuldu) {
      yarisOdul("gunun_kelimesi", 1);
      if (typeof toplulukMadalyaKontrol === "function") { toplulukMadalyaKontrol(); }
      if (typeof haftalikCiz === "function") { haftalikCiz(); }
    }
    const g = document.querySelector("#gkGiris"); if (g) { g.focus({ preventScroll: true }); }
  }
}

function gunKelimesiPaylas() {
  const d = gkDurum; if (!d) { return; }
  const kare = { d: "🟦", v: "🟨", y: "⬜" };
  const metin = "TentiforApp · Günün Kelimesi " + d.gun + " — " + (d.cozuldu ? d.tahminler.length : "X") + "/" + d.hak + "\n" +
    d.tahminler.map(function (t) { return t.sonuc.map(function (s) { return kare[s]; }).join(""); }).join("\n") + "\n" + location.origin + location.pathname;
  const tamam = function () { hesapBildir("Sonuç panoya kopyalandı"); };
  if (navigator.share) { navigator.share({ text: metin }).catch(function () {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(metin).then(tamam, function () { prompt("Sonuç:", metin); }); }
  else { prompt("Sonuç:", metin); }
}

/* ==================== Kulüp savaşı ==================== */

async function kulupSavasiCiz(hedef) {
  const alan = hedef || document.querySelector("#kulupSavasAlan");
  if (!alan || !yarisHazirMi()) { return; }
  const { data } = await hesapIstemci.from("kulup_savasi").select("*");
  const liste = (data || []).map(function (k) { return { kisilik: k.kisilik, bu: Number(k.bu_hafta) || 0, gecen: Number(k.gecen_hafta) || 0, katilan: Number(k.katilan) || 0 }; })
    .sort(function (a, b) { return b.bu - a.bu; });
  const sampiyon = liste.slice().sort(function (a, b) { return b.gecen - a.gecen; })[0];
  const benim = (typeof arsivciKisilik === "function") ? arsivciKisilik().ad : "";
  const enCok = Math.max.apply(null, liste.map(function (k) { return k.bu; }).concat([1]));
  alan.innerHTML = '<div class="kulup-savas"><span class="oyun-etiket">Kulüp savaşı · bu hafta</span>' +
    "<p>Görev: <b>en çok Kyldo kelimesi çeviren kulüp</b>. Kyldo Hız Çevirisi'nde çevirdiğin her kelime kulübüne (kişiliğine) yazılır. " +
    "Senin kulübün: <b>" + kacir(benim) + "</b>.</p>" +
    (sampiyon && sampiyon.gecen > 0 ? '<p class="oyun-not">Geçen haftanın şampiyonu: <b>' + kacir(sampiyon.kisilik) + "</b> (" + sampiyon.gecen + " kelime)</p>" : "") +
    (liste.length
      ? liste.slice(0, 5).map(function (k, i) {
          return '<div class="dagilim-satir' + (k.kisilik === benim ? " ben" : "") + '"><span>' + (i + 1) + ". " + kacir(k.kisilik) + "</span>" +
            '<span class="lider-cubuk"><i style="width:' + Math.round(100 * k.bu / enCok) + '%"></i></span><b>' + k.bu + "</b></div>";
        }).join("")
      : '<p class="oyun-not">Bu hafta henüz kimse kelime çevirmedi.</p>') +
    "</div>";
}

/* ==================== İlk Kâşif ==================== */

function kesifKaydet(anahtar) {
  if (!yarisHazirMi() || !hesapKullanici) { return; }
  hesapIstemci.rpc("kesif_kaydet", { p: anahtar }).then(function () {}, function () {});
}

/* karakterAc 24-arsiv-mantigi.js'te, bu dosyadan sonra yüklenir: sarmalamayı sayfa hazır olunca yap */
function kesifBagla() {
  /* karakter kartı açılınca */
  if (typeof karakterAc === "function") {
    const eski = karakterAc;
    window.karakterAc = function (i) {
      const r = eski.apply(this, arguments);
      const k = (veri.karakterler || [])[i];
      if (k) { kesifKaydet("karakter:" + k.id); }
      return r;
    };
  }
  /* buz katmanı çözülünce */
  if (typeof katmanAc === "function") {
    const eskiK = katmanAc;
    window.katmanAc = function () {
      const once = {};
      (veri.katmanlar || []).forEach(function (k) { once[k.id] = !!cozulenler[k.dogrulama]; });
      const r = eskiK.apply(this, arguments);
      (veri.katmanlar || []).forEach(function (k) { if (!once[k.id] && cozulenler[k.dogrulama]) { kesifKaydet("katman:" + k.id); } });
      return r;
    };
  }
}
if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", kesifBagla); } else { kesifBagla(); }

/* evren maddesi açılınca */
document.addEventListener("click", function (e) {
  const b = e.target.closest(".madde-bas");
  if (!b) { return; }
  const m = b.closest("[data-madde]");
  const madde = m && (veri.evren || [])[parseInt(m.dataset.madde, 10)];
  if (madde) { kesifKaydet("evren:" + madde.id); }
});

/* ==================== liderlik: Yarışlar grubu ==================== */

LIDERLIK_GRUPLARI.yarislar = "Yarışlar";
LIDERLIK_GRUPLARI.kapsamli = "";   /* kapsam düğmeleri çizimde */

let yarisKapsam = "tum";

YARISLAR.forEach(function (y) {
  LIDERLIK_TABLOLARI.push({ id: "y_" + y.id, grup: "yarislar", ad: y.ad, birim: "puan", unvan: "", not: y.ozet,
    takipli: true, yukle: function (kutu, t) { return liderlikYarisCiz(kutu, y.id); } });
});
LIDERLIK_TABLOLARI.push(
  { id: "y_kyldo_toplam", grup: "yarislar", ad: "Toplam çeviri", birim: "kelime", unvan: "Kyldo Kâtibi",
    not: "Kyldo Hız Çevirisi'nde doğru çevrilen bütün kelimeler.", yukle: function (kutu) { return liderlikKyldoToplamCiz(kutu); } },
  { id: "y_gk", grup: "yarislar", ad: "Günün kelimesi", birim: "", unvan: "Kelime Avcısı",
    not: "Bugünkü kelimeyi bulanlar: en az denemede, en erken.", yukle: function (kutu) { return liderlikGkCiz(kutu); } },
  { id: "y_kasif", grup: "yarislar", ad: "İlk Kâşifler", birim: "", unvan: "İlk Kâşif",
    not: "Yeni eklenen karakter, evren maddesi ve katmanları ilk açan 10 kişi.", yukle: function (kutu) { return liderlikKasifCiz(kutu); } },
  { id: "y_kulup", grup: "yarislar", ad: "Kulüp savaşı", birim: "", unvan: "",
    not: "", yukle: function (kutu) { return kulupSavasiCiz(kutu); } }
);
delete LIDERLIK_GRUPLARI.kapsamli;

async function liderlikYarisCiz(kutu, yaris) {
  const e = tomyeEtkinligi();
  const kapsamlar = [["tum", "Tüm zamanlar"], ["hafta", "Bu hafta"], ["sezon", e ? e.ay + " ayı" : "Bu ay"]];
  const { data, error } = await (await liderlikFiltrele(hesapIstemci.from("yaris_tablolari").select("kullanici_adi, gorunen_ad, puan")
    .eq("yaris", yaris).eq("kapsam", yarisKapsam).gt("puan", 0))).order("puan", { ascending: false }).limit(LIDERLIK_SATIR);
  if (error) { throw error; }
  const ust = '<div class="filtre yaris-kapsam">' + kapsamlar.map(function (k) {
    return '<button class="' + (k[0] === yarisKapsam ? "secili" : "") + '" data-yaris-kapsam="' + k[0] + '">' + kacir(k[1]) + "</button>";
  }).join("") + "</div>";
  if (!data || !data.length) { kutu.innerHTML = ust + '<p class="lider-bos">Bu tabloda henüz kimse yok. <button class="ic-bag" data-yaris-basla="' + yaris + '">İlk sen ol!</button></p>'; return; }
  let sira = 0, onceki = null;
  kutu.innerHTML = ust + '<div class="lider-liste">' + data.map(function (p, i) {
    const puan = Number(p.puan);
    if (puan !== onceki) { sira = i + 1; onceki = puan; }
    return liderlikSatir(sira, p, puan + " puan", liderlikTablo("y_" + yaris), sira === 1 ? "Yarış Birincisi" : "");
  }).join("") + "</div>";
}

async function liderlikKyldoToplamCiz(kutu) {
  const { data, error } = await hesapIstemci.from("kyldo_toplam").select("kullanici_adi, gorunen_ad, toplam").gt("toplam", 0)
    .order("toplam", { ascending: false }).limit(LIDERLIK_SATIR);
  if (error) { throw error; }
  if (!data || !data.length) { kutu.innerHTML = '<p class="lider-bos">Henüz kimse Kyldo çevirmedi.</p>'; return; }
  kutu.innerHTML = '<div class="lider-liste">' + data.map(function (p, i) {
    return liderlikSatir(i + 1, p, Number(p.toplam) + " kelime", liderlikTablo("y_kyldo_toplam"), i === 0 ? "Kyldo Kâtibi" : "");
  }).join("") + "</div>";
}

async function liderlikGkCiz(kutu) {
  const { data, error } = await hesapIstemci.from("gk_bugun").select("kullanici_adi, gorunen_ad, deneme, sira").order("sira").limit(LIDERLIK_SATIR);
  if (error) { throw error; }
  if (!data || !data.length) { kutu.innerHTML = '<p class="lider-bos">Bugünkü kelimeyi henüz kimse bulmadı.</p>'; return; }
  kutu.innerHTML = '<div class="lider-liste">' + data.map(function (p) {
    return liderlikSatir(Number(p.sira), p, p.deneme + "/6", liderlikTablo("y_gk"), Number(p.sira) === 1 ? "Kelime Avcısı" : "");
  }).join("") + "</div>";
}

async function liderlikKasifCiz(kutu) {
  const { data, error } = await hesapIstemci.from("kasif_sayilari").select("kullanici_adi, gorunen_ad, ilk_on, birinci")
    .order("birinci", { ascending: false }).order("ilk_on", { ascending: false }).limit(LIDERLIK_SATIR);
  if (error) { throw error; }
  if (!data || !data.length) {
    kutu.innerHTML = '<p class="lider-bos">Yeni içerik eklendiğinde onu ilk açanlar burada görünecek.</p>'; return;
  }
  kutu.innerHTML = '<div class="lider-liste">' + data.map(function (p, i) {
    return liderlikSatir(i + 1, p, Number(p.birinci) + " birinci · " + Number(p.ilk_on) + " ilk 10", liderlikTablo("y_kasif"), Number(p.birinci) > 0 && i === 0 ? "İlk Kâşif" : "");
  }).join("") + "</div>";
}

/** Herkese açık profile: İlk Kâşif sayısı ve kulüp şampiyonluğu. */
async function yarisProfilEk(p) {
  const el = document.querySelector("#profilYaris");
  if (!el || !yarisHazirMi()) { return; }
  const parca = [];
  const k = await hesapIstemci.from("kasif_sayilari").select("ilk_on, birinci").eq("kullanici_adi", p.kullanici_adi).maybeSingle();
  if (k.data && Number(k.data.ilk_on) > 0) {
    parca.push("<span>🧭 İlk Kâşif · " + Number(k.data.birinci) + " birinci, " + Number(k.data.ilk_on) + " ilk 10</span>");
  }
  const kt = await hesapIstemci.from("kyldo_toplam").select("toplam").eq("kullanici_adi", p.kullanici_adi).maybeSingle();
  if (kt.data && Number(kt.data.toplam) > 0) { parca.push("<span>Kyldo: " + Number(kt.data.toplam) + " kelime çevirdi</span>"); }
  const kisilik = p.ozet && p.ozet.kisilik;
  if (kisilik) {
    const s = await hesapIstemci.from("kulup_savasi").select("kisilik, gecen_hafta").order("gecen_hafta", { ascending: false }).limit(1);
    if (s.data && s.data[0] && s.data[0].kisilik === kisilik && Number(s.data[0].gecen_hafta) > 0) {
      parca.push('<span class="birinci">🏆 ' + kacir(kisilik) + " — geçen haftanın şampiyon kulübü</span>");
    }
  }
  if (parca.length) { el.innerHTML = '<span class="oyun-etiket">Yarışlar</span><div class="hesap-madalya">' + parca.join("") + "</div>"; }
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const b = e.target.closest("[data-yaris-basla]");
  if (b) { e.preventDefault(); yarisBasla(b.dataset.yarisBasla); return; }
  if (e.target.closest("[data-yaris-bitir]")) { yarisBitir(); return; }
  if (e.target.closest("[data-yaris-kapat]")) { Y2 = null; yarislarCiz(); return; }

  const s = e.target.closest("[data-yaris-secenek]");
  if (s) { yarisCevapla(s.dataset.yarisSecenek); return; }

  const hs = e.target.closest("[data-yaris-harita]");
  if (hs && Y2) {
    const r = hs.getBoundingClientRect();
    Y2.nokta = { x: +((e.clientX - r.left) / r.width * 100).toFixed(1), y: +((e.clientY - r.top) / r.height * 100).toFixed(1) };
    const kutu = document.querySelector("#yarisHarita"); if (kutu) { kutu.innerHTML = yarisHaritaSvg(); }
    const d = document.querySelector("[data-yaris-nokta]"); if (d) { d.classList.remove("pasif"); }
    return;
  }
  if (e.target.closest("[data-yaris-nokta]") && Y2 && Y2.nokta) { const n = Y2.nokta; Y2.nokta = null; yarisCevapla(n); return; }

  const yu = e.target.closest("[data-yaris-yukari]"), as = e.target.closest("[data-yaris-asagi]");
  if ((yu || as) && Y2 && Y2.sira) {
    const i = parseInt((yu || as).dataset[yu ? "yarisYukari" : "yarisAsagi"], 10), j = yu ? i - 1 : i + 1;
    const t = Y2.sira[i]; Y2.sira[i] = Y2.sira[j]; Y2.sira[j] = t;
    yarisOyunCiz(); return;
  }
  if (e.target.closest("[data-yaris-sira-gonder]") && Y2 && Y2.sira) { const sira = Y2.sira; Y2.sira = null; yarisCevapla(sira); return; }

  const m = e.target.closest("[data-muhur]");
  if (m && Y2) {
    const p = m.dataset.muhur, i = Y2.secim.indexOf(p);
    if (i === -1) { Y2.secim.push(p); } else { Y2.secim.splice(i, 1); }
    yarisOyunCiz();
    return;
  }
  if (e.target.closest("[data-yaris-muhur-gonder]") && Y2) { yarisCevapla(Y2.secim.slice()); return; }

  const k = e.target.closest("[data-yaris-kisi]");
  if (k && Y2) {
    const ad = k.dataset.yarisKisi, i = Y2.secim.indexOf(ad);
    if (i !== -1) { Y2.secim.splice(i, 1); } else if (Y2.secim.length < 2) { Y2.secim.push(ad); }
    yarisOyunCiz(); return;
  }
  if (e.target.closest("[data-yaris-kisi-gonder]") && Y2 && Y2.secim.length === 2) { yarisCevapla(Y2.secim.slice()); return; }

  if (e.target.closest("[data-gk-paylas]")) { gunKelimesiPaylas(); return; }

  const kp = e.target.closest("[data-yaris-kapsam]");
  if (kp) { yarisKapsam = kp.dataset.yarisKapsam; if (typeof liderlikCiz === "function") { liderlikCiz(); } }
});

document.addEventListener("submit", function (e) {
  if (e.target.closest("[data-yaris-metin]")) {
    e.preventDefault();
    const g = document.querySelector("#yarisGiris");
    yarisCevapla(g ? trk(g.value) : "");
    return;
  }
  if (e.target.closest("[data-gk-form]")) {
    e.preventDefault();
    const g = document.querySelector("#gkGiris");
    if (g && g.value.trim()) { gunKelimesiTahmin(g.value); }
  }
});
