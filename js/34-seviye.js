/* Seviyeler — aynı XP iki sistemi besler (XP sunucuda hesaplanır: arsivci_seviyeleri).

   1. Arşivci seviyesi: 1, 2, 3… ve unvanlar (Çırak → Sonsuz Raf). Gereken XP = 60·(s−1)².
   2. Tömye basamağı: Tömye rakamlarıyla yazılır (veri.takvim.rakamlar):
        Neo 1 · Vot 2 · Rit 3 · Rof 4 · Yaf 5 · Ilat 6 · İdey 7 · Kiz 8 · İnen 9 · Net 10
      İlk altısı haftanın günleridir. Tömye sayımında sıfır yoktur (takvim de 1 Leg 1'den başlar):
      Net'ten (10) sonra Neo·Neo (11) gelir, Neo·Net 20, Vot·Neo 21… Her altı basamak bir "hafta",
      her hafta bir ayın adını taşır (Leg, Sop, Mut…); on bir ay bir Tömye yılı eder.
      Gereken XP = 5·(b−1)·(b+4). */

const TOMYE_RAKAM_YEDEK = ["Neo", "Vot", "Rit", "Rof", "Yaf", "Ilat", "İdey", "Kiz", "İnen", "Net"];

function tomyeRakamlari() {
  const r = typeof veri !== "undefined" && veri && veri.takvim && veri.takvim.rakamlar;
  return Array.isArray(r) && r.length >= 2 ? r : TOMYE_RAKAM_YEDEK;
}

/** Haftanın günleri (ilk altı rakam): basamağın ay içindeki yeri için. */
function tomyeGunleri() {
  const g = typeof veri !== "undefined" && veri && veri.takvim && veri.takvim.gunler;
  return Array.isArray(g) && g.length === 6 ? g : TOMYE_RAKAM_YEDEK.slice(0, 6);
}

/** Sayıyı Tömye rakamlarıyla yazar (sıfırsız onluk): 1 → Neo, 10 → Net, 11 → Neo·Neo, 21 → Vot·Neo. */
function tomyeSayi(n) {
  n = Math.floor(Number(n));
  if (!(n >= 1)) { return "—"; }
  const r = tomyeRakamlari();
  const taban = r.length;
  const parca = [];
  while (n > 0) {
    parca.unshift(r[(n - 1) % taban]);
    n = Math.floor((n - 1) / taban);
  }
  return parca.join("·");
}

function basamakXp(b) { return 5 * (b - 1) * (b + 4); }

function basamakHesap(xp) {
  return Math.max(1, Math.floor((-3 + Math.sqrt(25 + 0.8 * Math.max(0, Number(xp) || 0))) / 2));
}

/** Basamağın takvimdeki yeri: hangi ay (hafta), ayın kaçıncı günü, kaçıncı yıl. */
function basamakYeri(b) {
  const aylar = (veri && veri.takvim && veri.takvim.aylar) || [];
  const hafta = Math.floor((b - 1) / 6);
  const ay = aylar.length ? aylar[hafta % aylar.length] : { ad: "Ay " + (hafta + 1), koken: "" };
  return {
    gun: tomyeGunleri()[(b - 1) % 6],
    gunNo: ((b - 1) % 6) + 1,
    ay: ay.ad, koken: ay.koken || "",
    yil: Math.floor(hafta / Math.max(1, aylar.length || 11)) + 1
  };
}

/* ---------- arşivci seviyesi (geliştirilmiş) ---------- */

/* Unvanlar yalnızca 31-topluluk.js'te tanımlıysa genişletilir */
if (typeof SEVIYE_UNVANLARI !== "undefined" && !SEVIYE_UNVANLARI.some(function (x) { return x[0] === 30; })) {
  SEVIYE_UNVANLARI.push([30, "Arşiv Ustası"], [40, "Sonsuz Raf"]);
}

function sonrakiUnvan(s) {
  return (typeof SEVIYE_UNVANLARI !== "undefined" ? SEVIYE_UNVANLARI : []).find(function (x) { return x[0] > s; }) || null;
}

const XP_KAYNAKLARI = [
  ["tamlik", "Arşiv tamlığı", "tamlık yüzdesi başına 20"], ["okuma", "Tam okunan kutular", "kutu başına 10 (her kutu bir kez)"], ["gun", "Gelinen günler", "gün başına 5"],
  ["madalya", "Madalyalar", "madalya başına 30"], ["katman", "Buz katmanları", "katman başına 40"],
  ["oyun", "Günlük oyunlar", "kazanılan oyun başına 10, günde en çok 80"], ["yaris", "Yarışlar", "günün ilk 3 geçerli oyunu, 10'ar"], ["gk", "Günün Kelimesi", "çözüm başına 25"],
  ["kesif", "Keşifler", "keşif başına 15"], ["ilk_kasif", "İlk Kâşif", "ilk bulduğun her şey için 25"],
  ["teori", "Teoriler", "görünür teori başına 5"], ["begeni", "Teorilerine beğeni", "beğeni başına 3"],
  ["isaret", "Kanon / yakın teori", "50 / 20"], ["oy", "İçerik oylaması", "oy başına 5"],
  ["hickirik", "Hıçkırık tanıklığı", "tanıklık başına 20"], ["av", "Arşiv avı", "çözülen sezon başına 100"],
  ["defter", "Kütüphane Defteri", "cümle başına 10, beğeni başına 2"], ["soru", "Yazara sor", "cevaplanan soru başına 15"],
  ["okur_bulmaca", "Okur bulmacaları", "çözüm başına 5, bulmacan çözüldükçe 2"], ["davet", "Davet", "ilk haftasını tamamlayan davetli başına 50"]
];

/** Hesabın bölümündeki büyük kart: iki sistem + XP dökümü. */
function seviyeKartiHtml(d, tam) {
  const xp = Number(d.xp) || 0;
  const s = Number(d.seviye) || 1;
  const b = Number(d.basamak) || basamakHesap(xp);
  const sAlt = seviyeXp(s), sUst = seviyeXp(s + 1);
  const bAlt = basamakXp(b), bUst = basamakXp(b + 1);
  const oran = function (a, u) { return Math.max(0, Math.min(100, Math.round(100 * (xp - a) / Math.max(1, u - a)))); };
  const yer = basamakYeri(b);
  const sonraki = sonrakiUnvan(s);
  const ayaKalan = 6 - yer.gunNo;
  const dokum = d.dokum || {};

  let h = '<div class="seviye-cift">' +
    '<div class="seviye-yarim">' +
      '<span class="oyun-etiket">Arşivci seviyesi</span>' +
      '<div class="profil-seviye"><span class="seviye-rozet">' + s + "</span><span><b>" + kacir(seviyeUnvani(s)) + "</b></span></div>" +
      '<span class="lider-cubuk"><i style="width:' + oran(sAlt, sUst) + '%"></i></span>' +
      '<p class="oyun-not">' + (sUst - xp) + " XP sonra seviye " + (s + 1) +
        (sonraki ? " · <b>" + kacir(sonraki[1]) + "</b> unvanı seviye " + sonraki[0] + "'de" : "") + "</p>" +
    "</div>" +
    '<div class="seviye-yarim tomye-basamak">' +
      '<span class="oyun-etiket">Tömye basamağı</span>' +
      '<div class="basamak-sayi" title="' + b + '">' + kacir(tomyeSayi(b)) + "</div>" +
      '<p class="basamak-yer">' + kacir(yer.ay) + " ayının " + kacir(yer.gun) + " basamağı" +
        (yer.koken ? ' <span class="oyun-not">(' + kacir(yer.koken) + ")</span>" : "") +
        (yer.yil > 1 ? " · " + yer.yil + ". yıl" : "") + "</p>" +
      '<span class="lider-cubuk"><i style="width:' + oran(bAlt, bUst) + '%"></i></span>' +
      '<p class="oyun-not">' + (bUst - xp) + " XP sonra " + kacir(tomyeSayi(b + 1)) +
        (ayaKalan > 0 ? " · " + ayaKalan + " basamak sonra yeni ay" : " · sonraki basamak yeni bir ay açar") + "</p>" +
    "</div>" +
  "</div>";

  if (tam) {
    const satirlar = XP_KAYNAKLARI.filter(function (k) { return Number(dokum[k[0]]); }).map(function (k) {
      return '<li><span>' + kacir(k[1]) + ' <span class="oyun-not">' + kacir(k[2]) + "</span></span><b>" + Number(dokum[k[0]]) + "</b></li>";
    }).join("");
    h += '<details class="xp-dokum"><summary>' + xp + " XP nereden geldi?</summary>" +
      (satirlar ? "<ul>" + satirlar + "</ul>" : '<p class="oyun-not">Henüz XP yok. Oku, oyna, teori yaz.</p>') +
      '<p class="oyun-not">XP sunucuda hesaplanır; şüpheli yarış sonuçları ve gizlenen teoriler sayılmaz.</p></details>' +
      '<details class="xp-dokum"><summary>Tömye rakamları</summary>' +
        '<p class="oyun-not">İlk altı rakam haftanın günleridir; sıfır yoktur: ' +
        tomyeRakamlari().map(function (r, i) { return "<b>" + kacir(r) + "</b> " + (i + 1); }).join(" · ") +
        ". " + kacir(tomyeRakamlari()[tomyeRakamlari().length - 1]) + "'ten sonra baştan: Neo·Neo 11, Neo·Net 20, Vot·Neo 21, Net·Net 110. " +
        "Her altı basamak bir ay, on bir ay bir yıl.</p></details>";
  }
  return h;
}

/* ---------- seviye atlama ödülleri ---------- */

/* Her seviye ve basamak bir kez ödüllendirilir (anahtarlar cüzdanda, cihazlar arası eşitlenir). */
function seviyeOdulleri(d) {
  if (typeof kilitAcik !== "function" || typeof eckaKazan !== "function" || typeof cuzdan === "undefined") { return; }
  const s = Number(d.seviye) || 1, b = Number(d.basamak) || 1;
  let ecka = 0;
  const haberler = [];
  for (let i = 2; i <= s; i++) {
    const a = "seviye_" + i;
    if (kilitAcik(a)) { continue; }
    cuzdan.acilan.push(a);
    ecka += 20 * i;
    if (i === s) { haberler.push("Seviye " + i + (seviyeUnvani(i) !== seviyeUnvani(i - 1) ? " · yeni unvan: " + seviyeUnvani(i) : "")); }
  }
  let yeniAy = null;
  for (let j = 2; j <= b; j++) {
    const a = "basamak_" + j;
    if (kilitAcik(a)) { continue; }
    cuzdan.acilan.push(a);
    ecka += 3 * j;
    if ((j - 1) % 6 === 0) { ecka += 30; yeniAy = basamakYeri(j).ay; }
    if (j === b) { haberler.push("Tömye basamağı " + tomyeSayi(j)); }
  }
  if (!ecka) { return; }
  eckaKazan(ecka, "Seviye ödülü");
  if (typeof hesapBildir === "function") {
    hesapBildir(haberler.join(" · ") + (yeniAy ? " · " + yeniAy + " ayına girdin" : "") + " (+" + ecka + " eçka)");
  }
}

/* ---------- liderlik: seviye satırında Tömye basamağı ---------- */

if (typeof liderlikSeviyeCiz === "function") {
  /* seviye tablosunda "Sv 5" yanında Tömye basamağı da yazsın */
  liderlikSeviyeCiz = async function (kutu, alan) {
    const { data, error } = await (await liderlikFiltrele(hesapIstemci.from("arsivci_seviyeleri")
      .select("kullanici_adi, gorunen_ad, seviye, basamak, " + alan).gt(alan, 0)))
      .order(alan, { ascending: false }).limit(LIDERLIK_SATIR);
    if (error) { throw error; }
    if (!data || !data.length) { kutu.innerHTML = '<p class="lider-bos">Henüz kimse yok.</p>'; return; }
    const t = liderlikTablo(alan === "xp" ? "seviye" : "yil_xp");
    kutu.innerHTML = '<div class="lider-liste">' + data.map(function (p, i) {
      return liderlikSatir(i + 1, p, (alan === "xp" ? "Sv " + p.seviye + " · " + tomyeSayi(p.basamak) + " · " : "") + Number(p[alan]) + " XP",
        t, i === 0 ? t.unvan : "");
    }).join("") + "</div>";
  };
}
