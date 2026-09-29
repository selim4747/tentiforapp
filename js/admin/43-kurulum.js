/* Kurulum yardımcısı (panel → Bakım → Kurulum).

   Telefonda 110 KB'lık kurulum.sql'i GitHub'dan seçip kopyalamak zor. Burada:
   - Hangi özelliğin sunucuda kurulu olduğu tek tek denetlenir (✓ / eksik).
   - SQL, deyim sınırlarından (fonksiyon gövdeleri bölünmeden) ~12 KB'lık parçalara ayrılır;
     her parça tek dokunuşla panoya kopyalanır, Supabase SQL Editor'a yapıştırılıp sırayla çalıştırılır.
     Dosya baştan sona tekrar çalıştırılabilir; yarıda kalırsa kalan parçadan devam edilir.
   - Bildirim fonksiyonunun kodu da aynı şekilde kopyalanır.
   Dosyalar yayın paketinde kurulum/ klasöründedir (scripts/paketle.mjs); gizli bilgi içermezler. */

const KURULUM_PARCA_ANAHTAR = "tf_kurulum_parcalar";   /* tentiforapp_ ile başlamaz: hesapla eşitlenmez */
const KURULUM_PARCA_BOYUT = 12000;

/** Deyim sınırlarında böler: satır ";" ile bitmeli ve $$ gövdesinin içinde olmamalı. */
function kurulumParcala(metin, boyut) {
  const satirlar = String(metin).replace(/\r\n/g, "\n").split("\n");
  const parcalar = [];
  let simdiki = [], uzunluk = 0, dolar = 0;
  satirlar.forEach(function (s) {
    simdiki.push(s);
    uzunluk += s.length + 1;
    dolar += (s.match(/\$\$/g) || []).length;
    if (dolar % 2 === 0 && /;\s*$/.test(s) && uzunluk >= (boyut || KURULUM_PARCA_BOYUT)) {
      parcalar.push(simdiki.join("\n"));
      simdiki = []; uzunluk = 0;
    }
  });
  if (simdiki.join("").trim()) { parcalar.push(simdiki.join("\n")); }
  return parcalar;
}

let kurulumMetin = null, kurulumFonksiyon = null, kurulumHata = "";

async function kurulumDosyalariYukle() {
  if (kurulumMetin !== null) { return; }
  try {
    const [a, b] = await Promise.all([fetch("kurulum/kurulum.sql", { cache: "no-cache" }), fetch("kurulum/bildirim-gonder.ts", { cache: "no-cache" })]);
    if (!a.ok) { throw new Error("kurulum.sql bulunamadı (" + a.status + ")"); }
    kurulumMetin = await a.text();
    kurulumFonksiyon = b.ok ? await b.text() : "";
  } catch (e) {
    kurulumHata = (e && e.message) || String(e);
    kurulumMetin = "";
  }
}

function kurulumYapilanlar() {
  try { return JSON.parse(localStorage.getItem(KURULUM_PARCA_ANAHTAR) || "{}") || {}; } catch (e) { return {}; }
}

function kurulumYapildiIsaretle(ozet, i) {
  const y = kurulumYapilanlar();
  if (y.ozet !== ozet) { y.ozet = ozet; y.parca = {}; }
  y.parca = y.parca || {};
  y.parca[i] = true;
  try { localStorage.setItem(KURULUM_PARCA_ANAHTAR, JSON.stringify(y)); } catch (e) { /* özel sekme */ }
}

function kurulumOzet(metin) {
  let h = 0;
  for (let i = 0; i < metin.length; i++) { h = (h * 31 + metin.charCodeAt(i)) >>> 0; }
  return h.toString(36) + ":" + metin.length;
}

/* ---------- özellik denetimi ---------- */

const KURULUM_DENETIMLERI = [
  ["Hesap ve profiller", function (s) { return s.from("profiller").select("kullanici_adi").limit(1); }],
  ["Liderlik ve seviyeler (Tömye basamağı)", function (s) { return s.from("arsivci_seviyeleri").select("basamak").limit(1); }],
  ["Yarışlar", function (s) { return s.from("yaris_tablolari").select("*").limit(1); }],
  ["Teoriler ve oylama", function (s) { return s.from("teori_listesi").select("*").limit(1); }],
  ["Kor'un Hıçkırığı", function (s) { return s.rpc("hickirik_durum"); }],
  ["Arşiv avı", function (s) { return s.from("av_cozenler").select("*").limit(1); }],
  ["Tepkiler ve kenar notları", function (s) { return s.from("tepki_sayilari").select("*").limit(1); }],
  ["Kütüphane Defteri", function (s) { return s.from("defter_listesi").select("*").limit(1); }],
  ["Yazara sor", function (s) { return s.from("yazara_sorular").select("*").limit(1); }],
  ["Kulüp duvarı", function (s) { return s.from("kulup_duvari").select("*").limit(1); }],
  ["Okur bulmacaları", function (s) { return s.from("okur_bulmaca_listesi").select("*").limit(1); }],
  ["Davet ve rehberlik", function (s) { return s.from("rehber_sayilari").select("*").limit(1); }],
  ["Yeni bölüm bildirimi (tablo)", function (s) { return s.rpc("bildirim_abonelik_sil", { p_endpoint: "https://fcm.googleapis.com/denetim" }); }],
  ["Ziyaret sayacı", function (s) { return s.rpc("olay_sayilari", { p_gun: 1 }); }],
  ["Günün kelimesi: seri ve dağılım", function (s) { return s.rpc("gk_istatistik"); }],
  ["Evren ziyaretçi defteri ve “Bu hafta” özeti", function (s) { return s.rpc("evren_defter_oku", { p_evren: "denetim" }); }]
];

function kurulumEksikMi(hata) {
  const m = String((hata && (hata.message || hata.code)) || "");
  return /schema cache|could not find|does not exist|PGRST20[25]|42P01|42883/i.test(m);
}

async function kurulumDenetle() {
  const alan = document.querySelector("#yKurulumDenetim");
  if (!alan) { return; }
  if (typeof hesapGerekli === "function") { try { await hesapGerekli(); } catch (e) { /* aşağıda */ } }
  if (typeof hesapIstemci === "undefined" || !hesapIstemci) { alan.innerHTML = '<p class="oyun-not">Sunucuya bağlanılamadı.</p>'; return; }
  alan.innerHTML = '<p class="oyun-not">Denetleniyor…</p>';
  const sonuclar = await Promise.all(KURULUM_DENETIMLERI.map(async function (d) {
    try {
      const { error } = await d[1](hesapIstemci);
      return { ad: d[0], durum: !error ? "tamam" : (kurulumEksikMi(error) ? "eksik" : "tamam") };
    } catch (e) { return { ad: d[0], durum: "bilinmiyor" }; }
  }));
  const eksik = sonuclar.filter(function (s) { return s.durum === "eksik"; }).length;
  alan.innerHTML = '<ul class="kurulum-liste">' + sonuclar.map(function (s) {
    return '<li class="' + s.durum + '"><span aria-hidden="true">' + ({ tamam: "✓", eksik: "✗", bilinmiyor: "?" })[s.durum] + "</span>" +
      kacir(s.ad) + (s.durum === "eksik" ? " — kurulmamış" : "") + "</li>";
  }).join("") + "</ul>" +
  '<p class="oyun-not"><b>' + (eksik ? eksik + " özellik kurulmamış: aşağıdaki parçaları sırayla çalıştır." : "Hepsi kurulu. SQL'i yeniden çalıştırmak zararsızdır.") + "</b></p>";
}

/* ---------- panel sekmesi ---------- */

function yoneticiKurulum() {
  if (!(typeof yoneticiAcik === "function" && yoneticiAcik())) { return '<p class="oyun-not">Bu sekme yalnızca tam yöneticiye açık.</p>'; }
  setTimeout(kurulumCiz, 0);
  return '<div class="kutu-y"><label>Sunucudaki özellikler</label><div id="yKurulumDenetim"><p class="oyun-not">…</p></div>' +
      '<button class="dugme dugme-sade" data-y-kurulum-denetle>Yeniden denetle</button></div>' +
    '<div class="kutu-y" id="yKurulumParcalar"><p class="oyun-not">Yükleniyor…</p></div>' +
    '<div class="kutu-y" id="yKurulumFonksiyon"></div>';
}

async function kurulumCiz() {
  kurulumDenetle();
  await kurulumDosyalariYukle();
  const alan = document.querySelector("#yKurulumParcalar");
  if (!alan) { return; }
  if (!kurulumMetin) { alan.innerHTML = '<p class="oyun-not">SQL dosyası yüklenemedi: ' + kacir(kurulumHata) + "</p>"; return; }
  const parcalar = kurulumParcala(kurulumMetin);
  const ozet = kurulumOzet(kurulumMetin);
  const y = kurulumYapilanlar();
  const yapilan = y.ozet === ozet ? (y.parca || {}) : {};
  alan.innerHTML =
    "<label>Veritabanı kurulumu (" + Math.round(kurulumMetin.length / 1024) + " KB, " + parcalar.length + " parça)</label>" +
    '<ol class="kurulum-adimlar">' +
      "<li>Supabase'i aç → <b>SQL Editor</b> → <b>New query</b>.</li>" +
      "<li>Aşağıda <b>1. parçayı kopyala</b>, editöre yapıştır, <b>Run</b>. \"Success\" görünce sıradakine geç.</li>" +
      "<li>Parçalar <b>sırayla</b> çalışmalı. Hata alırsan aynı parçayı tekrar çalıştırmak zararsız.</li>" +
      "<li>Bilgisayardaysan tek seferde de olur: <b>Tamamını kopyala</b>.</li>" +
    "</ol>" +
    '<div class="kurulum-parcalar">' + parcalar.map(function (p, i) {
      return '<button class="dugme' + (yapilan[i] ? " dugme-sade" : "") + '" data-y-kurulum-parca="' + i + '">' +
        (yapilan[i] ? "✓ " : "") + (i + 1) + ". parçayı kopyala <span>" + Math.round(p.length / 1024) + " KB</span></button>";
    }).join("") + "</div>" +
    '<button class="dugme dugme-sade" data-y-kurulum-tamami>Tamamını kopyala</button>' +
    '<button class="dugme dugme-sade" data-y-kurulum-sifirla>İşaretleri temizle</button>' +
    '<p class="pencere-durum" id="yKurulumDurum" role="status"></p>' +
    '<textarea class="kod-giris arac-giris kurulum-yedek" id="yKurulumYedek" rows="4" readonly hidden aria-label="Kopyalanacak metin"></textarea>';

  const f = document.querySelector("#yKurulumFonksiyon");
  if (f) {
    f.innerHTML = kurulumFonksiyon
      ? "<label>Bildirim fonksiyonu (Edge Function)</label>" +
        '<p class="oyun-not">Supabase → Edge Functions → Deploy a new function → Via Editor → adı <b>bildirim-gonder</b> → içeriği sil, bunu yapıştır → Deploy. ' +
        "Anahtarlar için Bakım → Bildirim sekmesine bak.</p>" +
        '<button class="dugme" data-y-kurulum-fonksiyon>Fonksiyon kodunu kopyala (' + Math.round(kurulumFonksiyon.length / 1024) + " KB)</button>"
      : "";
  }
}

/** Panoya yazar; olmazsa metni seçili bir kutuda gösterir (eski tarayıcı / izin yok). */
async function kurulumKopyala(metin, etiket) {
  const durum = document.querySelector("#yKurulumDurum");
  let tamam = false;
  try { await navigator.clipboard.writeText(metin); tamam = true; } catch (e) { tamam = false; }
  if (!tamam && typeof panoyaKopyala === "function") {
    try { await panoyaKopyala(metin); tamam = true; } catch (e) { tamam = false; }
  }
  if (tamam) {
    if (durum) { durum.textContent = etiket + " kopyalandı — Supabase SQL Editor'a yapıştırıp Run'a bas."; durum.className = "pencere-durum iyi"; }
    return true;
  }
  const t = document.querySelector("#yKurulumYedek");
  if (t) { t.hidden = false; t.value = metin; t.focus(); t.select(); }
  if (durum) { durum.textContent = "Otomatik kopyalanamadı: kutudaki metin seçili, uzun basıp Kopyala'ya dokun."; durum.className = "pencere-durum kotu"; }
  return false;
}

document.addEventListener("click", async function (e) {
  const h = e.target.closest("[data-y-kurulum-parca], [data-y-kurulum-tamami], [data-y-kurulum-fonksiyon], [data-y-kurulum-denetle], [data-y-kurulum-sifirla]");
  if (!h) { return; }
  if (h.hasAttribute("data-y-kurulum-denetle")) { kurulumDenetle(); return; }
  await kurulumDosyalariYukle();
  if (h.hasAttribute("data-y-kurulum-sifirla")) {
    try { localStorage.removeItem(KURULUM_PARCA_ANAHTAR); } catch (_) { /* yok */ }
    kurulumCiz();
    return;
  }
  if (h.hasAttribute("data-y-kurulum-fonksiyon")) { kurulumKopyala(kurulumFonksiyon, "Fonksiyon kodu"); return; }
  if (h.hasAttribute("data-y-kurulum-tamami")) { kurulumKopyala(kurulumMetin, "SQL'in tamamı"); return; }
  const i = Number(h.dataset.yKurulumParca);
  const parcalar = kurulumParcala(kurulumMetin);
  if (await kurulumKopyala(parcalar[i], (i + 1) + ". parça")) {
    kurulumYapildiIsaretle(kurulumOzet(kurulumMetin), i);
    h.classList.add("dugme-sade");
    if (h.textContent.indexOf("✓") !== 0) { h.insertAdjacentText("afterbegin", "✓ "); }
  }
});
