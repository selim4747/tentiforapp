/* Bakım katmanı — gizlilik sayfası, otomatik hata bildirimi, sesli okuma,
   panelin eksik içerik düzenleyicileri, değişiklik özeti, yönetici istatistikleri,
   yedek ve teori denetimi. */

/* ==================== GİZLİLİK ==================== */

function gizlilikCiz() {
  const alan = document.querySelector("#gizlilikAlan");
  if (!alan) { return; }
  const iletisim = (veri && veri.iletisim) || "";
  const bolum = function (baslik, maddeler) {
    return '<div class="kutu-y gizlilik-kutu"><h3>' + kacir(baslik) + "</h3><ul>" +
      maddeler.map(function (m) { return "<li>" + m + "</li>"; }).join("") + "</ul></div>";
  };
  alan.innerHTML =
    '<p class="oyun-giris">Bu site reklam göstermez, izleme çerezi ve üçüncü taraf analiz aracı kullanmaz. ' +
      "Aşağıda hangi bilginin nerede durduğu tek tek yazıyor.</p>" +
    bolum("Yalnızca senin cihazında", [
      "Okuma ilerlemen, başarımların, eçka cüzdanın, defterin, tema ve yazı tipi tercihlerin tarayıcının yerel deposunda tutulur.",
      "Hesap açmazsan bunların hiçbiri bir sunucuya gitmez. Tarayıcı verisini silersen bunlar da silinir."
    ]) +
    bolum("Hesap açarsan sunucuda (Supabase)", [
      "E-posta adresin ve şifrenin güvenli özeti — yalnızca giriş için kullanılır, hiçbir yerde gösterilmez.",
      "Kullanıcı adın, görünen adın, hakkında yazın ve vitrinin — <b>herkese açıktır</b>.",
      "İlerlemen — yalnızca sana görünür; cihazlar arası eşitleme içindir.",
      "Yarış skorların, liderlik sayıların, teorilerin, oyların ve takip ettiklerin — liderlikten çıkmayı seçmediysen herkese açıktır.",
      "Güvenlik için: yarış süreleri ve şüpheli sonuç işaretleri (hile önleme)."
    ]) +
    bolum("Yeni bölüm bildirimi (açarsan)", [
      "Tarayıcının sana verdiği bildirim adresi ve iki şifreleme anahtarı sunucuda saklanır; hesabın açıksa hangi hesaba ait olduğu da.",
      "Yalnızca yeni bölüm ve duyuru göndermek için kullanılır. Roman bölümündeki <b>Bildirimleri kapat</b> ile ya da tarayıcı ayarından izni kaldırarak silinir."
    ]) +
    bolum("Fan hikâyeleri ve evrenleri", [
      "Yazdıkların cihazında (hesabın varsa onunla eşitlenerek) durur; açtığın dosyalar sunucuya gönderilmez, yalnızca tarayıcında okunur.",
      "Bir dosyayı yazara e-postayla gönderirsen, sitede yayımlanması yazarın onayıyla olur."
    ]) +
    bolum("Hata bildirimleri", [
      "Sitede bir hata olursa hata metni, hatanın olduğu dosya, sayfa adresi (sorgu kısmı atılarak), tarayıcı bilgisi ve site sürümü kaydedilir.",
      "Amaç yalnızca hatayı düzeltmektir. Aynı hata gün içinde tek kayıt olarak sayılır; kayıtlar yönetici tarafından temizlenir."
    ]) +
    bolum("Haklarını nasıl kullanırsın", [
      "Görmek: profilin ve ilerlemen hesabında görünür; Sen sayfasından ilerlemeni dışa aktarabilirsin.",
      "Düzeltmek: profil bilgilerini Hesabın bölümünden istediğin an değiştirebilirsin.",
      "Silmek: Hesabın bölümündeki <b>Hesabımı sil</b> düğmesi hesabını, profilini, ilerlemeni, skorlarını ve teorilerini kalıcı olarak siler.",
      iletisim
        ? "Başka bir istek için: " + (/^[^@\s]+@[^@\s]+$/.test(iletisim)
            ? '<a href="mailto:' + kacir(iletisim) + '">' + kacir(iletisim) + "</a>"
            : /^https?:\/\//.test(iletisim) ? '<a href="' + kacir(iletisim) + '" rel="noopener" target="_blank">' + kacir(iletisim) + "</a>" : kacir(iletisim))
        : "Başka bir istek için sitenin GitHub sayfasından ulaşabilirsin."
    ]) +
    '<p class="oyun-not">Bu metin 6698 sayılı KVKK\'nın aydınlatma yükümlülüğü gözetilerek hazırlanmıştır; hukuki danışmanlık yerine geçmez. ' +
      "Son güncelleme: " + kacir((veri && veri.guncelleme) || "") + "</p>";
}

/* ==================== OTOMATİK HATA BİLDİRİMİ ==================== */

let hataGonderilen = 0;

function hataAdresi() {
  /* sorgu kısmında giriş kodu olabilir; asla gönderme */
  return (location.origin + location.pathname + location.hash).slice(0, 300);
}

window.hataGonder = function (kayit) {
  if (!kayit || hataGonderilen >= 10) { return; }
  if (typeof HESAP_AYAR === "undefined" || !HESAP_AYAR.url || !HESAP_AYAR.anahtar) { return; }
  if (/^(localhost|127\.)/.test(location.hostname) && !window.__hataYereldeGonder) { return; }
  hataGonderilen++;
  const yigin = String(kayit.yigin || "").split("\n").slice(0, 3).join(" | ");
  const govde = {
    p_mesaj: (String(kayit.baslik || "") + ": " + String(kayit.mesaj || "")).slice(0, 500),
    p_kaynak: yigin.slice(0, 300) || null,
    p_adres: hataAdresi(),
    p_tarayici: navigator.userAgent.slice(0, 300),
    p_surum: String((typeof veri !== "undefined" && veri && veri.surum) || "").slice(0, 40) || null
  };
  try {
    fetch(HESAP_AYAR.url + "/rest/v1/rpc/hata_kaydet", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", apikey: HESAP_AYAR.anahtar, Authorization: "Bearer " + HESAP_AYAR.anahtar },
      body: JSON.stringify(govde)
    }).catch(function () {});
  } catch (e) { /* bildirim de patlarsa sessiz kal */ }
};

(function () {
  const kuyruk = window.__hataKuyrugu || [];
  window.__hataKuyrugu = [];
  kuyruk.forEach(window.hataGonder);
})();

/* ==================== SESLİ OKUMA ==================== */

const SESLI_SECICI = ".okuma-metin, .mektup-metin, .hikaye-metin, .detay-metin, .roman-metin";
let sesliAktif = null;

function sesliDestek() {
  return "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
}

function sesliSes() {
  const sesler = window.speechSynthesis.getVoices() || [];
  return sesler.find(function (s) { return /^tr(-|_|$)/i.test(s.lang); }) || null;
}

function sesliDugmeEkle(kok) {
  if (!sesliDestek()) { return; }
  (kok || document).querySelectorAll(SESLI_SECICI).forEach(function (el) {
    if (el.dataset.sesli || el.closest("[data-sesli-yok]")) { return; }
    if ((el.textContent || "").trim().length < 280) { return; }
    el.dataset.sesli = "1";
    const d = document.createElement("button");
    d.type = "button";
    d.className = "dugme dugme-sade sesli-dugme";
    d.setAttribute("data-sesli-oku", "");
    d.textContent = "▶ Dinle";
    el.parentNode.insertBefore(d, el);
  });
}

function sesliDurdur() {
  if (sesliDestek()) { window.speechSynthesis.cancel(); }
  if (sesliAktif) { sesliAktif.textContent = "▶ Dinle"; sesliAktif.classList.remove("okuyor"); }
  sesliAktif = null;
}

function sesliDugmeOku(dugme) {
  if (sesliAktif === dugme) { sesliDurdur(); return; }
  sesliDurdur();
  const metinEl = dugme.nextElementSibling;
  if (!metinEl) { return; }
  const metin = (metinEl.innerText || metinEl.textContent || "").trim();
  if (!metin) { return; }
  const ses = sesliSes();
  /* Tarayıcı sesleri uzun metni kesebiliyor; paragraf paragraf sıraya koy */
  const parcalar = metin.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  parcalar.forEach(function (p, i) {
    const u = new SpeechSynthesisUtterance(p);
    u.lang = "tr-TR";
    if (ses) { u.voice = ses; }
    u.rate = 0.95;
    if (i === parcalar.length - 1) { u.onend = function () { if (sesliAktif === dugme) { sesliDurdur(); } }; }
    window.speechSynthesis.speak(u);
  });
  sesliAktif = dugme;
  dugme.textContent = "■ Durdur";
  dugme.classList.add("okuyor");
}

function sesliBaslat() {
  if (!sesliDestek()) { return; }
  sesliDugmeEkle(document);
  let bekleyen = false;
  new MutationObserver(function () {
    if (bekleyen) { return; }
    bekleyen = true;
    requestAnimationFrame(function () { bekleyen = false; sesliDugmeEkle(document); });
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", sesliDurdur);
}

/* ==================== DEĞİŞİKLİK ÖZETİ ==================== */

/* Açılışta içeriğin bir fotoğrafı alınır; panelde "Özet çıkar" farkı yazar. */
let bakimFoto = null;

const OZET_LISTELERI = [
  ["karakterler", "karakter", function (x) { return x.ad || x.id; }],
  ["evren", "evren kaydı", function (x) { return x.ad || x.baslik || x.id; }],
  ["mektuplar", "mektup", function (x) { return (x.kimden || "") + " → " + (x.kime || ""); }],
  ["olaylar", "olay", function (x) { return x.baslik || x.ad; }],
  ["kisaHikayeler", "kısa hikâye", function (x) { return x.baslik; }],
  ["yapimlar", "yapım", function (x) { return x.ad || x.baslik; }],
  ["zamanCizelgesi", "zaman çizelgesi kaydı", function (x) { return x.baslik; }],
  ["bulmacalar", "bulmaca", null],
  ["suphehliBulmacalar", "şüpheli bulmacası", null],
  ["bilinmeyenler", "bilinmeyen", function (x) { return x.soru; }],
  ["yankilar", "yankı", function (x) { return x.baslik; }],
  ["sozluk", "sözlük terimi", function (x) { return x.terim; }],
  ["alintilar", "alıntı", null],
  ["galeri", "galeri görseli", null],
  ["kilitliDosyalar", "kilitli dosya", function (x) { return x.baslik || x.ad; }],
  ["gunlukler", "günlük", null],
  ["kayitlar", "kayıt", null],
  ["claudeEvreni.maddeler", "Claude evreni maddesi", function (x) { return x.baslik; }],
  ["claudeEvreni.kisiler", "Claude evreni kişisi", function (x) { return x.ad; }],
  ["claudeEvreni.hikayeler", "Claude evreni hikâyesi", function (x) { return x.baslik; }],
  ["fanEserleri.hikayeler", "fan hikâyesi", function (x) { return x.baslik; }],
  ["fanEserleri.evrenler", "fan evreni", function (x) { return x.ad; }],
  ["kanonEvrenleri.e26.kurallar", "E26 kuralı", function (x) { return x.ad; }],
  ["kanonEvrenleri.e26.kisiler", "E26 kişisi", function (x) { return x.ad; }],
  ["kanonEvrenleri.e26.yerler", "E26 yeri", function (x) { return x.ad; }],
  ["kanonEvrenleri.e26.tarih", "E26 olayı", function (x) { return x.olay; }],
  ["kanonEvrenleri.e26.ozelAlanlar", "E26 alanı", function (x) { return x.ad; }],
  ["e99.kurallar", "E99 kuralı", function (x) { return x.ad; }],
  ["e99.kisiler", "E99 kişisi", function (x) { return x.ad; }],
  ["e99.yerler", "E99 yeri", function (x) { return x.ad; }],
  ["e99.harita.yerler", "E99 harita yeri", function (x) { return x.ad; }]
];

function bakimAnahtar(x) {
  return x && typeof x === "object" ? (x.id || x.ad || x.baslik || x.terim || x.soru || JSON.stringify(x).slice(0, 80)) : String(x);
}

function bakimFotoAl() {
  const f = {};
  OZET_LISTELERI.forEach(function (l) {
    const liste = (yDizi(l[0], true) || []);
    /* aynı adlı kayıtlar olabilir (iki "Delilik" gibi): kaçıncı olduğu da anahtara girer */
    const sayac = {};
    const anahtarlar = liste.map(function (x) {
      const a = String(bakimAnahtar(x));
      sayac[a] = (sayac[a] || 0) + 1;
      return a + "#" + sayac[a];
    });
    f[l[0]] = { anahtarlar: anahtarlar, metin: liste.map(function (x) { return JSON.stringify(x); }) };
  });
  const r = veri.roman && Array.isArray(veri.roman.bolumler) ? veri.roman.bolumler : [];
  f.roman = r.filter(function (b) { return b.metin; }).map(function (b) { return b.no; });
  const k = veri.kelimeler || {};
  f.kelime = (k.kolay || []).length + (k.orta || []).length + (k.zor || []).length;
  return f;
}

function bakimBaslat() {
  if (typeof veri === "undefined" || !veri) { return; }
  bakimFoto = bakimFotoAl();
  gizlilikCiz();
  sesliBaslat();
}

function bakimOzetMaddeleri() {
  if (!bakimFoto) { return []; }
  const simdi = bakimFotoAl();
  const maddeler = [];
  OZET_LISTELERI.forEach(function (l) {
    const once = bakimFoto[l[0]], sonra = simdi[l[0]];
    const liste = (yDizi(l[0], true) || []);
    const yeni = [];
    let degisen = 0;
    sonra.anahtarlar.forEach(function (a, i) {
      const j = once.anahtarlar.indexOf(a);
      if (j === -1) { yeni.push(liste[i]); }
      else if (once.metin[j] !== sonra.metin[i]) { degisen++; }
    });
    const silinen = once.anahtarlar.filter(function (a) { return sonra.anahtarlar.indexOf(a) === -1; }).length;
    if (yeni.length) {
      const adlar = l[2] ? yeni.map(l[2]).filter(Boolean).slice(0, 4) : [];
      maddeler.push(yeni.length + " yeni " + l[1] + (adlar.length ? ": " + adlar.join(", ") + (yeni.length > adlar.length ? "…" : "") : ""));
    }
    if (degisen) { maddeler.push(degisen + " " + l[1] + " güncellendi"); }
    if (silinen) { maddeler.push(silinen + " " + l[1] + " kaldırıldı"); }
  });
  const yeniBolum = simdi.roman.filter(function (n) { return bakimFoto.roman.indexOf(n) === -1; });
  if (yeniBolum.length) { maddeler.push("Roman: " + yeniBolum.map(function (n) { return n + ". bölüm"; }).join(", ") + " yayında"); }
  if (simdi.kelime !== bakimFoto.kelime) {
    const f = simdi.kelime - bakimFoto.kelime;
    maddeler.push("Kelime havuzu " + (f > 0 ? f + " kelime büyüdü" : Math.abs(f) + " kelime küçüldü"));
  }
  return maddeler;
}

function surumArtir(s, tur) {
  const p = String(s || "0.0.0").split(".").map(function (x) { return parseInt(x, 10) || 0; });
  while (p.length < 3) { p.push(0); }
  if (tur === "buyuk") { return (p[0] + 1) + ".0.0"; }
  if (tur === "kucuk") { return p[0] + "." + p[1] + "." + (p[2] + 1); }
  return p[0] + "." + (p[1] + 1) + ".0";
}

/* ==================== PANEL: LİSTE DÜZENLEYİCİLERİ ==================== */

const Y_LISTELER = {
  bulmacalar:         { ad: "Bulmacalar",          ornek: { tur: "isim", soru: "", kelime: "" } },
  suphehliBulmacalar: { ad: "Şüpheli bulmacaları", ornek: null },
  kelimeler:          { ad: "Kelime havuzu",       ozel: true },
  mektuplar:          { ad: "Mektuplar",           ornek: { id: "", kimden: "", kime: "", not: "", metin: "" } },
  bilinmeyenler:      { ad: "Bilinmeyenler",       ornek: { soru: "", not: "" } },
  yankilar:           { ad: "Yankılar",            ornek: { baslik: "", metin: "", ornekler: [] } },
  sozluk:             { ad: "Sözlük",              ornek: { terim: "", tanim: "" } },
  alintilar:          { ad: "Alıntılar",           ornek: { metin: "", kim: "" } },
  zamanCizelgesi:     { ad: "Zaman çizelgesi",     ornek: { no: 0, cag: "", baslik: "", metin: "" } },
  "claudeEvreni.maddeler":  { ad: "Claude evreni · maddeler", ornek: { id: "", tur: "fizik", baslik: "", ozet: "", metin: "" } },
  "claudeEvreni.kisiler":   { ad: "Claude evreni · kişiler", ornek: { id: "", ad: "", unvan: "", ozet: "", detay: "" } },
  "claudeEvreni.hikayeler": { ad: "Claude evreni · hikâyeler", ornek: { id: "", baslik: "", karakterler: [], metin: "" } },
  "claudeEvreni.mektuplar": { ad: "Claude evreni · mektuplar", ornek: { id: "", kimden: "", kime: "", not: "", metin: "" } },
  "claudeEvreni.sozluk":    { ad: "Claude evreni · sözlük", ornek: { terim: "", tanim: "" } },
  "claudeEvreni.sorular":   { ad: "Claude evreni · sorular", ornek: { soru: "", not: "" } },
  "fanEserleri.hikayeler": { ad: "Fanmade · hikâyeler", ornek: { bicim: "tentifor-eser", surum: 1, tur: "hikaye", id: "", baslik: "", yazar: "", evren: "", karakterler: "", etiketler: "", uyari: "", ozet: "", metin: "" } },
  "fanEserleri.evrenler":  { ad: "Fanmade · evrenler", ornek: { bicim: "tentifor-eser", surum: 1, tur: "evren", id: "", ad: "", yazar: "", ozet: "", kurallar: [], kisiler: [], yerler: [], tarih: [], sozluk: [], ozelAlanlar: [] } },
  "kanonEvrenleri.e26.kurallar": { ad: "E26 · kurallar", ornek: { ad: "", tur: "", aciklama: "" } },
  "kanonEvrenleri.e26.kisiler": { ad: "E26 · kişiler", ornek: { ad: "", rol: "", aciklama: "" } },
  "kanonEvrenleri.e26.yerler": { ad: "E26 · yerler", ornek: { ad: "", aciklama: "" } },
  "kanonEvrenleri.e26.tarih": { ad: "E26 · tarih", ornek: { zaman: "", olay: "" } },
  "kanonEvrenleri.e26.ozelAlanlar": { ad: "E26 · kendi alanları", ornek: { ad: "", deger: "" } },
  "e99.kurallar": { ad: "E99 · kurallar", ornek: { ad: "", tur: "", aciklama: "" } },
  "e99.kisiler": { ad: "E99 · kişiler", ornek: { ad: "", rol: "", aciklama: "" } },
  "e99.yerler": { ad: "E99 · yerler", ornek: { ad: "", aciklama: "" } },
  "e99.harita.yerler": { ad: "E99 · harita yerleri", ornek: { id: "", ad: "", tur: "Şehir", not: "", x: 50, y: 50 } },
  takvimEtkinlikleri: { ad: "Tömye takvimi etkinlikleri", ornek: { id: "", ad: "", ay: "Leg", gun: 1, sure: 1, tema: "", metin: "", alinti: "", gorev: { id: "yazi4", adet: 1, ad: "", odul: 30 } } },
  degisiklik:         { ad: "Değişiklik günlüğü",  ozel: true },
  site:               { ad: "Site ayarları",       ozel: true }
};

/** "claudeEvreni.kisiler" gibi noktalı yolları da çözer; dizi yoksa (bakma değilse) oluşturur. */
function yDizi(yol, bakma) {
  const parca = String(yol).split(".");
  let o = veri;
  for (let i = 0; i < parca.length - 1; i++) {
    if (!o[parca[i]] || typeof o[parca[i]] !== "object") { if (bakma) { return undefined; } o[parca[i]] = {}; }
    o = o[parca[i]];
  }
  const son = parca[parca.length - 1];
  if (!Array.isArray(o[son])) { if (bakma) { return o[son]; } o[son] = []; }
  return o[son];
}

const Y_LISTE_CIZICILER = {
  bulmacalar: "bulmacaCiz", suphehliBulmacalar: "supheliCiz", mektuplar: "mektupCiz",
  bilinmeyenler: "bilinmeyenCiz", yankilar: "yankiCiz", sozluk: "sozlukCiz",
  alintilar: "alintiCiz", zamanCizelgesi: "cizZaman", degisiklik: "degisiklikCiz", site: "gizlilikCiz",
  "claudeEvreni.maddeler": "claudeEvrenCiz", "claudeEvreni.kisiler": "claudeEvrenCiz", "claudeEvreni.hikayeler": "claudeEvrenCiz",
  "claudeEvreni.mektuplar": "claudeEvrenCiz", "claudeEvreni.sozluk": "claudeEvrenCiz", "claudeEvreni.sorular": "claudeEvrenCiz",
  takvimEtkinlikleri: "takvimEtkinlikCiz",
  "fanEserleri.hikayeler": "fanBolumleriCiz", "fanEserleri.evrenler": "fanBolumleriCiz"
};

let yListe = "bulmacalar";
let yListeAcik = null;
let yListeSilOnay = null;

function yListeSablon(anahtar) {
  const t = Y_LISTELER[anahtar];
  const liste = yDizi(anahtar);
  const kaynak = t.ornek || liste[0] || {};
  const bos = {};
  Object.keys(kaynak).forEach(function (k) {
    const v = kaynak[k];
    bos[k] = Array.isArray(v) ? [] : typeof v === "number" ? 0 : typeof v === "boolean" ? false :
             v && typeof v === "object" ? {} : "";
  });
  if ("no" in bos) { bos.no = liste.reduce(function (m, x) { return Math.max(m, Number(x.no) || 0); }, 0) + 1; }
  if ("id" in bos && anahtar === "mektuplar") { bos.id = "m" + (liste.length + 1) + Date.now().toString(36).slice(-3); }
  if ("id" in bos && anahtar === "suphehliBulmacalar") { bos.id = "b" + (liste.length + 1); }
  if ("id" in bos && anahtar.indexOf("claudeEvreni.") === 0) { bos.id = "cl_" + Date.now().toString(36); }
  return bos;
}

function yListeAlanCiz(k, v, i) {
  const ad = 'data-y-alan="' + kacir(k) + '" data-y-tip="';
  if (Array.isArray(v) && v.every(function (x) { return typeof x === "string"; })) {
    return "<label>" + kacir(k) + " — her satıra bir tane</label>" +
      '<textarea class="kod-giris arac-giris" rows="4" ' + ad + 'satirlar">' + kacir(v.join("\n")) + "</textarea>";
  }
  if (v && typeof v === "object") {
    return "<label>" + kacir(k) + " — JSON</label>" +
      '<textarea class="kod-giris arac-giris y-json" rows="6" ' + ad + 'json">' + kacir(JSON.stringify(v, null, 2)) + "</textarea>";
  }
  if (typeof v === "number") {
    return "<label>" + kacir(k) + "</label>" +
      '<input class="kod-giris arac-giris" type="number" ' + ad + 'sayi" value="' + v + '">';
  }
  if (typeof v === "boolean") {
    return '<label><input type="checkbox" ' + ad + 'mantik"' + (v ? " checked" : "") + "> " + kacir(k) + "</label>";
  }
  const uzun = String(v || "").length > 90 || k === "metin" || k === "not" || k === "tanim";
  return "<label>" + kacir(k) + "</label>" + (uzun
    ? '<textarea class="kod-giris arac-giris" rows="' + (k === "metin" ? 8 : 3) + '" ' + ad + 'metin">' + kacir(v || "") + "</textarea>"
    : '<input class="kod-giris arac-giris" ' + ad + 'metin" value="' + kacir(v || "") + '">');
}

function yListeOgeBaslik(x) {
  if (!x || typeof x !== "object") { return String(x); }
  return x.baslik || x.soru || x.terim || x.metin || x.id || x.kelime || "(boş)";
}

function yoneticiListeler() {
  /* site ayarları (sınırlı kod dahil) yalnızca tam yöneticide */
  if (!yoneticiAcik() && yListe === "site") { yListe = "bulmacalar"; }
  const secici = '<div class="filtre y-liste-secici">' + Object.keys(Y_LISTELER).filter(function (k) {
    return k !== "site" || yoneticiAcik();
  }).map(function (k) {
    const n = Array.isArray(yDizi(k, true)) ? " · " + yDizi(k).length : "";
    return '<button class="filtre-btn' + (yListe === k ? " secili" : "") + '" data-y-liste="' + k + '">' +
             kacir(Y_LISTELER[k].ad) + n + "</button>";
  }).join("") + "</div>";

  if (yListe === "kelimeler") { return secici + yListeKelimeler(); }
  if (yListe === "degisiklik") { return secici + yListeDegisiklik(); }
  if (yListe === "site") { return secici + yListeSite(); }

  const liste = yDizi(yListe);

  if (yListeAcik !== null && liste[yListeAcik]) {
    const x = liste[yListeAcik];
    return secici + '<div class="kutu-y" data-y-liste-form="' + yListeAcik + '">' +
      '<button class="dugme dugme-sade y-kucuk" data-y-liste-geri>← Listeye dön</button>' +
      "<h3>" + (yListeAcik + 1) + ". kayıt</h3>" +
      Object.keys(x).map(function (k) { return yListeAlanCiz(k, x[k], yListeAcik); }).join("") +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-y-liste-kaydet>Kaydet</button>' +
        '<button class="dugme dugme-sade y-sil" data-y-liste-sil="' + yListeAcik + '">' +
          (yListeSilOnay === yListeAcik ? "Emin misin? Sil" : "Sil") + "</button>" +
      "</div></div>";
  }

  return secici + '<div class="kutu-y">' +
    "<label>" + kacir(Y_LISTELER[yListe].ad) + " — " + liste.length + " kayıt</label>" +
    '<div class="y-liste-satirlar">' + liste.map(function (x, i) {
      return '<div class="y-liste-satir">' +
          '<button class="satir" data-y-liste-ac="' + i + '"><span class="satir-no">' + String(i + 1).padStart(2, "0") + "</span>" +
            '<span class="satir-govde"><span class="satir-baslik">' + kacir(String(yListeOgeBaslik(x)).slice(0, 90)) + "</span></span></button>" +
          '<span class="y-liste-sira">' +
            '<button class="dugme dugme-sade y-kucuk" data-y-liste-tasi="' + i + '" data-yon="-1" aria-label="Yukarı"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
            '<button class="dugme dugme-sade y-kucuk" data-y-liste-tasi="' + i + '" data-yon="1" aria-label="Aşağı"' + (i === liste.length - 1 ? " disabled" : "") + ">↓</button>" +
          "</span></div>";
    }).join("") + "</div>" +
    '<button class="dugme" data-y-liste-yeni>+ Yeni kayıt</button>' +
    "</div>";
}

function yListeFormKaydet() {
  const form = document.querySelector("[data-y-liste-form]");
  if (!form) { return; }
  const i = parseInt(form.dataset.yListeForm, 10);
  const x = yDizi(yListe)[i];
  let hata = null;
  form.querySelectorAll("[data-y-alan]").forEach(function (el) {
    const k = el.dataset.yAlan, tip = el.dataset.yTip;
    if (tip === "satirlar") { x[k] = el.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean); }
    else if (tip === "sayi") { x[k] = Number(el.value) || 0; }
    else if (tip === "mantik") { x[k] = el.checked; }
    else if (tip === "json") {
      try { x[k] = JSON.parse(el.value || "null"); } catch (e) { hata = k + " alanındaki JSON bozuk: " + e.message; }
    }
    else { x[k] = el.value.trim(); }
  });
  if (hata) { yoneticiDurum(hata, false); return; }
  yListeYenidenCiz();
  yoneticiDurum("Kaydedildi — yayına almak için Bakım → Kaydet", true);
}

function yListeYenidenCiz() {
  const f = Y_LISTE_CIZICILER[yListe];
  if (f && typeof window[f] === "function") { try { window[f](); } catch (e) { console.warn(e); } }
}

function yListeKelimeler() {
  const k = veri.kelimeler || (veri.kelimeler = { kolay: [], orta: [], zor: [] });
  return '<div class="kutu-y"><p class="oyun-not">Yarışlar ve yazı oyunu bu havuzdan kelime çeker. Virgülle ya da satır satır yaz.</p>' +
    ["kolay", "orta", "zor"].map(function (d) {
      return "<label>" + d + " — " + (k[d] || []).length + " kelime</label>" +
        '<textarea class="kod-giris arac-giris" rows="4" id="yKelime_' + d + '">' + kacir((k[d] || []).join(", ")) + "</textarea>";
    }).join("") +
    '<button class="dugme" data-y-kelime-kaydet>Kaydet</button></div>';
}

function yListeKelimeKaydet() {
  const k = veri.kelimeler || (veri.kelimeler = {});
  ["kolay", "orta", "zor"].forEach(function (d) {
    const el = document.querySelector("#yKelime_" + d);
    if (!el) { return; }
    const gorulen = {};
    k[d] = el.value.split(/[,\n]/).map(function (s) { return s.trim().toLocaleLowerCase("tr"); })
      .filter(function (s) { if (!s || gorulen[s]) { return false; } gorulen[s] = true; return true; });
  });
  yoneticiDurum("Kelime havuzu güncellendi. Yarışlara da yansıması için Bakım → Kaydet'ten sonra bir kez yayınla.", true);
  yoneticiCiz();
}

function yListeDegisiklik() {
  const d = veri.degisiklik || (veri.degisiklik = []);
  const maddeler = bakimOzetMaddeleri();
  return '<div class="kutu-y">' +
      "<label>Bu oturumda değişenler (otomatik)</label>" +
      (maddeler.length
        ? '<ul class="y-bosluk">' + maddeler.map(function (m) { return "<li>" + kacir(m) + "</li>"; }).join("") + "</ul>"
        : '<p class="oyun-not">Sayfa açıldığından beri içerikte değişiklik yok.</p>') +
      "<label>Yeni sürüm maddeleri — düzenleyebilirsin, her satır bir madde</label>" +
      '<textarea class="kod-giris arac-giris" rows="6" id="yDegMaddeler">' + kacir(maddeler.join("\n")) + "</textarea>" +
      "<label>Sürüm (şu an " + kacir(veri.surum || "—") + ")</label>" +
      '<select class="kod-giris arac-giris" id="yDegTur">' +
        '<option value="orta">' + kacir(surumArtir(veri.surum, "orta")) + " — yeni içerik</option>" +
        '<option value="kucuk">' + kacir(surumArtir(veri.surum, "kucuk")) + " — düzeltme</option>" +
        '<option value="buyuk">' + kacir(surumArtir(veri.surum, "buyuk")) + " — büyük sürüm</option>" +
      "</select>" +
      '<button class="dugme" data-y-deg-ekle>Günlüğe ekle ve sürümü yükselt</button>' +
    "</div>" +
    '<div class="kutu-y"><label>Geçmiş sürümler — ' + d.length + "</label>" +
      d.map(function (s, i) {
        return '<div class="y-lider-kayit"><b>' + kacir(s.surum) + "</b> · " + kacir(s.tarih) +
          '<div class="oyun-not">' + kacir((s.maddeler || []).join(" · ")) + "</div>" +
          '<button class="dugme dugme-sade y-sil y-kucuk" data-y-deg-sil="' + i + '">' + (yListeSilOnay === "d" + i ? "Emin misin?" : "Sil") + "</button></div>";
      }).join("") + "</div>";
}

function yDegisiklikEkle() {
  const maddeler = ((document.querySelector("#yDegMaddeler") || {}).value || "").split("\n")
    .map(function (s) { return s.trim(); }).filter(Boolean);
  if (!maddeler.length) { yoneticiDurum("En az bir madde yaz", false); return; }
  const tur = (document.querySelector("#yDegTur") || {}).value || "orta";
  const yeni = surumArtir(veri.surum, tur);
  const tarih = new Date().toISOString().slice(0, 10);
  const yeniKarakterler = (veri.karakterler || []).map(function (k) { return k.id; })
    .filter(function (id) { return bakimFoto && bakimFoto.karakterler.anahtarlar.indexOf(id + "#1") === -1; });
  (veri.degisiklik || (veri.degisiklik = [])).unshift({ surum: yeni, tarih: tarih, maddeler: maddeler, yeniler: yeniKarakterler });
  veri.surum = yeni;
  veri.guncelleme = tarih;
  bakimFoto = bakimFotoAl();
  if (typeof degisiklikCiz === "function") { degisiklikCiz(); }
  yoneticiDurum(yeni + " günlüğe eklendi — Kaydet sekmesinden yayınla", true);
  yoneticiCiz();
}

function yListeSite() {
  return '<div class="kutu-y">' +
    "<label>Gizlilik sayfasındaki iletişim adresi</label>" +
    '<p class="oyun-not">Bir e-posta ya da bağlantı yaz. Herkese açık görünür — kişisel adresin yerine bu site için açtığın bir adres önerilir. Boş bırakırsan GitHub sayfası gösterilir.</p>' +
    '<input class="kod-giris arac-giris" id="yIletisim" value="' + kacir(veri.iletisim || "") + '" placeholder="ornek: arsiv@alanadin.com">' +
    "<label>Fan eserlerinin gönderileceği e-posta</label>" +
    '<p class="oyun-not">Fan hikâyesi ya da evren yazan biri dosyasını bu adrese gönderebilsin diye Fan sayfasında görünür. Herkese açıktır: ' +
      "bunun için ayrı bir adres açman önerilir. Boş bırakırsan yalnızca indirme ve paylaşma kalır.</p>" +
    '<input class="kod-giris arac-giris" id="yFanEposta" type="email" value="' + kacir(veri.fanEposta || "") + '" placeholder="ornek: fan@alanadin.com">' +
    '<button class="dugme" data-y-site-kaydet>Kaydet</button></div>' +
    '<div class="kutu-y">' +
      "<label>Sınırlı yönetici kodu</label>" +
      '<p class="oyun-not">Bu kodu giren kişi paneli açar (roman, basın, listeler, ekleme sekmeleri, denetim, istatistik, kaydet) ' +
        "ama buz katmanları ve gizli bloklar onun için kilitli kalır; onları oynayarak açar. Kişiler, anahtarlar, yedek ve karakter/evren " +
        "düzenleyicileri yalnızca senin kodunla açılır.</p>" +
      '<p class="oyun-not">Durum: <b>' + (veri.sinirliYoneticiOzet ? "tanımlı" : "tanımsız") + "</b>. Kod sitede saklanmaz; yenisini üretince eskisi geçersiz olur.</p>" +
      (yListeYeniKod ? '<p class="y-kod-goster">Yeni kod: <code>' + kacir(yListeYeniKod) + "</code> — şimdi bir yere yaz, sonra Kaydet sekmesinden yayınla.</p>" : "") +
      '<button class="dugme dugme-sade" data-y-sinirli-uret>' + (veri.sinirliYoneticiOzet ? "Yeni kod üret (eskisini iptal et)" : "Kod üret") + "</button>" +
      (veri.sinirliYoneticiOzet ? ' <button class="dugme dugme-sade y-sil" data-y-sinirli-sil>Kodu iptal et</button>' : "") +
    "</div>";
}

let yListeYeniKod = null;

/* ==================== PANEL: HATALAR ==================== */

function yoneticiHatalar() {
  setTimeout(yoneticiHatalarYukle, 0);
  return '<p class="oyun-not">Ziyaretçilerin tarayıcısında oluşan hatalar buraya kendiliğinden düşer. Aynı hata gün içinde tek satırda sayılır.</p>' +
    '<div class="kutu-y" id="yHataAlan"><p class="oyun-not">Yükleniyor…</p></div>';
}

async function bakimIstemci(alan) {
  if (typeof hesapGerekli === "function" && !hesapIstemci) { try { await hesapGerekli(); } catch (e) { /* aşağıda */ } }
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) {
    alan.innerHTML = '<p class="oyun-not">Önce sağ üstten yönetici olarak tanımlı hesabınla giriş yap.</p>';
    return null;
  }
  return hesapIstemci;
}

function bakimYetkiHatasi(alan, error) {
  alan.innerHTML = /yetki|permission|denied/i.test((error && error.message) || "")
    ? '<p class="oyun-not">Bu hesap yönetici olarak tanımlı değil (Liderlik sekmesindeki talimata bak).</p>'
    : '<p class="oyun-not">' + kacir(typeof hesapHataMetni === "function" ? hesapHataMetni(error) : String(error && error.message)) + "</p>";
}

async function yoneticiHatalarYukle() {
  const alan = document.querySelector("#yHataAlan");
  if (!alan) { return; }
  const ist = await bakimIstemci(alan);
  if (!ist) { return; }
  const { data, error } = await ist.from("hata_kayitlari").select("no,gun,mesaj,kaynak,adres,tarayici,surum,sayi,son")
    .order("son", { ascending: false }).limit(100);
  if (error) { bakimYetkiHatasi(alan, error); return; }
  if (!data || !data.length) { alan.innerHTML = '<p class="oyun-not">Kayıtlı hata yok.</p>'; return; }
  alan.innerHTML = "<label>Son hatalar — " + data.length + "</label>" +
    '<div class="y-blok-liste">' + data.map(function (h) {
      return '<div class="y-lider-kayit"><div><b>' + kacir(h.mesaj) + '</b> <span class="y-lider-durum">×' + Number(h.sayi) + "</span></div>" +
        (h.kaynak ? '<div class="oyun-not y-kod-satir">' + kacir(h.kaynak) + "</div>" : "") +
        '<div class="oyun-not">' + kacir(h.gun) + " · " + kacir(h.adres || "") + (h.surum ? " · v" + kacir(h.surum) : "") + "</div>" +
        '<div class="oyun-not">' + kacir((h.tarayici || "").slice(0, 120)) + "</div></div>";
    }).join("") + "</div>" +
    '<button class="dugme dugme-sade y-sil" data-y-hata-temizle>' + (yListeSilOnay === "hata" ? "Emin misin? Hepsini sil" : "Tümünü temizle") + "</button>";
}

/* ==================== PANEL: İSTATİSTİK ==================== */

function yoneticiIstatistik() {
  setTimeout(yoneticiIstatistikYukle, 0);
  return '<div id="yIstAlan"><p class="oyun-not">Yükleniyor…</p></div>';
}

function istSayi(n) { return Number(n || 0).toLocaleString("tr-TR"); }

/* Tek renk sütun grafiği: 14 gün, taban çizgisi, yalnızca tepe değer yazılı */
function istSutun(baslik, dizi, alan) {
  const G = 18, ARA = 4, Y = 96, UST = 16, ALT = 18;
  const en = dizi.length * (G + ARA);
  const tepe = Math.max(1, Math.max.apply(null, dizi.map(function (d) { return Number(d[alan]) || 0; })));
  const tepeI = dizi.reduce(function (b, d, i) { return (Number(d[alan]) || 0) > (Number(dizi[b][alan]) || 0) ? i : b; }, 0);
  const taban = UST + Y;
  const sutunlar = dizi.map(function (d, i) {
    const v = Number(d[alan]) || 0;
    const h = v ? Math.max(2, Math.round(v / tepe * Y)) : 0;
    const x = i * (G + ARA) + ARA / 2, y = taban - h, r = Math.min(4, h, G / 2);
    const yol = h ? "M" + x + "," + taban + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y +
      "H" + (x + G - r) + "Q" + (x + G) + "," + y + " " + (x + G) + "," + (y + r) + "V" + taban + "Z" : "";
    const etiket = d.gun.slice(8, 10) + "." + d.gun.slice(5, 7);
    return '<g class="ist-isaret" tabindex="0" data-ist-ipucu="' + kacir(etiket + " · " + istSayi(v)) + '">' +
        '<rect x="' + (i * (G + ARA)) + '" y="' + UST + '" width="' + (G + ARA) + '" height="' + Y + '" fill="transparent"/>' +
        (yol ? '<path d="' + yol + '" class="ist-dolgu"/>' : "") +
        (i === tepeI && v ? '<text x="' + (x + G / 2) + '" y="' + (y - 4) + '" class="ist-deger" text-anchor="middle">' + istSayi(v) + "</text>" : "") +
      "</g>";
  }).join("");
  const ilk = dizi[0] ? dizi[0].gun.slice(8, 10) + "." + dizi[0].gun.slice(5, 7) : "";
  const son = dizi.length ? dizi[dizi.length - 1].gun.slice(8, 10) + "." + dizi[dizi.length - 1].gun.slice(5, 7) : "";
  return '<figure class="ist-grafik"><figcaption>' + kacir(baslik) + "</figcaption>" +
    '<svg viewBox="0 0 ' + en + " " + (UST + Y + ALT) + '" role="img" aria-label="' + kacir(baslik) + ', son 14 gün">' +
      sutunlar +
      '<line x1="0" x2="' + en + '" y1="' + (taban + 0.5) + '" y2="' + (taban + 0.5) + '" class="ist-taban"/>' +
      '<text x="0" y="' + (taban + 14) + '" class="ist-eksen">' + ilk + "</text>" +
      '<text x="' + en + '" y="' + (taban + 14) + '" class="ist-eksen" text-anchor="end">' + son + "</text>" +
    "</svg></figure>";
}

/* Yatay çubuk: kategoriler adıyla yazılı, değer çubuğun sağında */
function istCubuk(baslik, satirlar, adAlan, degerAlan, adCevir) {
  if (!satirlar || !satirlar.length) { return '<figure class="ist-grafik"><figcaption>' + kacir(baslik) + '</figcaption><p class="oyun-not">Henüz veri yok.</p></figure>'; }
  const tepe = Math.max(1, Math.max.apply(null, satirlar.map(function (s) { return Number(s[degerAlan]) || 0; })));
  return '<figure class="ist-grafik"><figcaption>' + kacir(baslik) + "</figcaption>" +
    '<div class="ist-cubuklar">' + satirlar.map(function (s) {
      const v = Number(s[degerAlan]) || 0;
      const ad = adCevir ? adCevir(s[adAlan]) : s[adAlan];
      return '<div class="ist-cubuk-satir ist-isaret" tabindex="0" data-ist-ipucu="' + kacir(ad + " · " + istSayi(v)) + '">' +
          '<span class="ist-cubuk-ad">' + kacir(ad) + "</span>" +
          '<span class="ist-cubuk-iz"><span class="ist-cubuk" style="width:' + (v / tepe * 100).toFixed(1) + '%"></span></span>' +
          '<span class="ist-cubuk-deger">' + istSayi(v) + "</span>" +
        "</div>";
    }).join("") + "</div></figure>";
}

async function yoneticiIstatistikYukle() {
  const alan = document.querySelector("#yIstAlan");
  if (!alan) { return; }
  const ist = await bakimIstemci(alan);
  if (!ist) { return; }
  const { data, error } = await ist.rpc("site_istatistik");
  if (error) { bakimYetkiHatasi(alan, error); return; }
  const d = data || {};
  const gunluk = d.gunluk || [];
  const yarisAd = function (id) {
    const t = typeof YARISLAR !== "undefined" && YARISLAR.find ? YARISLAR.find(function (y) { return y.id === id; }) : null;
    return t ? t.ad : id;
  };
  const kulupAd = function (id) {
    const k = (veri.kisilikler || []).find ? (veri.kisilikler || []).find(function (x) { return x.id === id; }) : null;
    return k ? (k.ad || id) : id;
  };
  const kutu = function (ad, deger, not) {
    return '<div class="ist-kutu"><span class="ist-kutu-ad">' + kacir(ad) + '</span><span class="ist-kutu-deger">' + istSayi(deger) + "</span>" +
      (not ? '<span class="ist-kutu-not">' + kacir(not) + "</span>" : "") + "</div>";
  };
  alan.innerHTML =
    '<div class="ist-kutular">' +
      kutu("Hesap", d.kullanici, istSayi(d.profil) + " profil") +
      kutu("Son 7 gün aktif", d.aktif7) +
      kutu("Teori", d.teori, Number(d.teori_bekleyen) ? istSayi(d.teori_bekleyen) + " incelemede" : "") +
      kutu("Bugün hata", d.hata_bugun) +
      kutu("Şüpheli (7 gün)", d.supheli7) +
    "</div>" +
    '<div class="ist-coklu">' +
      istSutun("Yeni hesap", gunluk, "kayit") +
      istSutun("Aktif kişi", gunluk, "aktif") +
      istSutun("Yarış oyunu", gunluk, "yaris") +
    "</div>" +
    '<div class="ist-coklu ist-iki">' +
      istCubuk("Yarışlar — son 30 gün, oyun", d.yarislar, "yaris", "oyun", yarisAd) +
      istCubuk("Kulüpler — üye", d.kulupler, "kisilik", "uye", kulupAd) +
    "</div>" +
    '<details class="ist-tablo"><summary>Tablo olarak göster</summary>' +
      '<table><thead><tr><th>Gün</th><th>Yeni hesap</th><th>Aktif</th><th>Yarış</th></tr></thead><tbody>' +
      gunluk.map(function (g) {
        return "<tr><td>" + kacir(g.gun) + "</td><td>" + istSayi(g.kayit) + "</td><td>" + istSayi(g.aktif) + "</td><td>" + istSayi(g.yaris) + "</td></tr>";
      }).join("") + "</tbody></table></details>" +
    '<div class="ist-ipucu" id="istIpucu" role="status" hidden></div>';
}

function istIpucuGoster(el) {
  const ip = document.querySelector("#istIpucu");
  const kap = document.querySelector("#yIstAlan");
  if (!ip || !kap) { return; }
  if (!el) { ip.hidden = true; return; }
  const a = el.getBoundingClientRect(), k = kap.getBoundingClientRect();
  ip.textContent = el.dataset.istIpucu;
  ip.hidden = false;
  const x = Math.min(Math.max(a.left + a.width / 2 - k.left, 40), k.width - 40);
  ip.style.left = x + "px";
  ip.style.top = (a.top - k.top - 8) + "px";
}

/* ==================== PANEL: YEDEK ==================== */

function yoneticiYedek() {
  return '<div class="kutu-y">' +
      "<label>Veritabanı yedeği</label>" +
      '<p class="oyun-not">Profiller, ilerlemeler, liderlik, yarış skorları, teoriler, oylar ve takipler tek bir JSON dosyası olarak iner. ' +
        "E-posta adresleri ve şifreler yedeğe girmez. Haftada bir indirip güvenli bir yerde saklaman önerilir.</p>" +
      '<button class="dugme" data-y-yedek-al>Yedeği indir</button>' +
    "</div>" +
    '<div class="kutu-y">' +
      "<label>İçerik yedeği</label>" +
      '<p class="oyun-not">İçerik zaten GitHub\'da sürüm geçmişiyle saklanıyor. Anlık kopyasını da indirebilirsin.</p>' +
      '<button class="dugme dugme-sade" data-y-veri-indir>veri.json indir</button>' +
    "</div>";
}

function bakimIndir(ad, metin) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([metin], { type: "application/json" }));
  a.download = ad;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function yoneticiYedekAl() {
  yoneticiDurum("Yedek hazırlanıyor…", true);
  const kutu = { innerHTML: "" };
  const ist = await bakimIstemci(kutu);
  if (!ist) { yoneticiDurum("Önce yönetici hesabınla giriş yap", false); return; }
  const { data, error } = await ist.rpc("yedek_al");
  if (error) { yoneticiDurum(/yetki/i.test(error.message || "") ? "Bu hesap yönetici değil" : String(error.message), false); return; }
  bakimIndir("tentifor-yedek-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(data, null, 2));
  yoneticiDurum("Yedek indirildi", true);
}

/* ==================== PANEL: TEORİLER ==================== */

function yoneticiTeoriler() {
  setTimeout(yoneticiTeorilerYukle, 0);
  return '<p class="oyun-not">Üç bildirim alan teori kendiliğinden gizlenir. Buradan geri açabilir, kalıcı gizleyebilir ya da kanon/yakın diye işaretleyebilirsin.</p>' +
    '<div class="kutu-y" id="yTeoriAlan"><p class="oyun-not">Yükleniyor…</p></div>';
}

async function yoneticiTeorilerYukle() {
  const alan = document.querySelector("#yTeoriAlan");
  if (!alan) { return; }
  const ist = await bakimIstemci(alan);
  if (!ist) { return; }
  const { data, error } = await ist.rpc("teori_denetim");
  if (error) { bakimYetkiHatasi(alan, error); return; }
  if (!data || !data.length) { alan.innerHTML = '<p class="oyun-not">İncelenecek teori yok.</p>'; return; }
  alan.innerHTML = '<div class="y-blok-liste">' + data.map(function (t) {
    return '<div class="y-lider-kayit"><div><b>@' + kacir(t.kullanici_adi) + "</b> · " + kacir(t.konu) +
        ' <span class="y-lider-durum">' + (t.gizli ? "gizli" : "açık") + " · " + Number(t.bildirim) + " bildirim</span></div>" +
      '<div class="oyun-not">' + kacir(t.metin) + "</div>" +
      '<div class="oyun-sira">' +
        '<button class="dugme dugme-sade" data-y-teori="' + t.id + '" data-isaret="' + kacir(t.isaret || "") + '" data-gizli="0">Aç, bildirimleri sil</button>' +
        '<button class="dugme dugme-sade y-sil" data-y-teori="' + t.id + '" data-isaret="" data-gizli="1">Gizli tut</button>' +
      "</div></div>";
  }).join("") + "</div>";
}

/* ==================== OLAYLAR ==================== */

document.addEventListener("click", function (e) {
  const s = e.target.closest("[data-sesli-oku]");
  if (s) { sesliDugmeOku(s); return; }

  const l = e.target.closest("[data-y-liste]");
  if (l) { yListe = l.dataset.yListe; yListeAcik = null; yListeSilOnay = null; yoneticiCiz(); return; }
  const la = e.target.closest("[data-y-liste-ac]");
  if (la) { yListeAcik = parseInt(la.dataset.yListeAc, 10); yListeSilOnay = null; yoneticiCiz(); return; }
  if (e.target.closest("[data-y-liste-geri]")) { yListeAcik = null; yListeSilOnay = null; yoneticiCiz(); return; }
  if (e.target.closest("[data-y-liste-kaydet]")) { yListeFormKaydet(); return; }
  if (e.target.closest("[data-y-liste-yeni]")) {
    yDizi(yListe).push(yListeSablon(yListe));
    yListeAcik = yDizi(yListe).length - 1;
    yoneticiCiz();
    return;
  }
  const ls = e.target.closest("[data-y-liste-sil]");
  if (ls) {
    const i = parseInt(ls.dataset.yListeSil, 10);
    if (yListeSilOnay !== i) { yListeSilOnay = i; yoneticiCiz(); return; }
    yDizi(yListe).splice(i, 1);
    yListeSilOnay = null; yListeAcik = null;
    yListeYenidenCiz();
    yoneticiCiz();
    yoneticiDurum("Kayıt silindi", true);
    return;
  }
  const lt = e.target.closest("[data-y-liste-tasi]");
  if (lt) {
    const i = parseInt(lt.dataset.yListeTasi, 10), j = i + parseInt(lt.dataset.yon, 10);
    const liste = yDizi(yListe);
    if (j < 0 || j >= liste.length) { return; }
    const t = liste[i]; liste[i] = liste[j]; liste[j] = t;
    yListeYenidenCiz();
    yoneticiCiz();
    return;
  }
  if (e.target.closest("[data-y-kelime-kaydet]")) { yListeKelimeKaydet(); return; }
  if (e.target.closest("[data-y-deg-ekle]")) { yDegisiklikEkle(); return; }
  const ds = e.target.closest("[data-y-deg-sil]");
  if (ds) {
    const i = parseInt(ds.dataset.yDegSil, 10);
    if (yListeSilOnay !== "d" + i) { yListeSilOnay = "d" + i; yoneticiCiz(); return; }
    veri.degisiklik.splice(i, 1);
    yListeSilOnay = null;
    degisiklikCiz();
    yoneticiCiz();
    return;
  }
  if (e.target.closest("[data-y-sinirli-uret]") && yoneticiAcik()) {
    yListeYeniKod = yoneticiKodUret("YRD-") + yoneticiKodUret("").slice(0, 2);
    veri.sinirliYoneticiOzet = dogrulamaOzeti(yListeYeniKod);
    yoneticiCiz();
    yoneticiDurum("Yeni sınırlı kod üretildi", true);
    return;
  }
  if (e.target.closest("[data-y-sinirli-sil]") && yoneticiAcik()) {
    delete veri.sinirliYoneticiOzet;
    yListeYeniKod = null;
    yoneticiCiz();
    yoneticiDurum("Sınırlı kod iptal edildi — Kaydet sekmesinden yayınla", true);
    return;
  }
  if (e.target.closest("[data-y-site-kaydet]")) {
    veri.iletisim = ((document.querySelector("#yIletisim") || {}).value || "").trim();
    const fanE = ((document.querySelector("#yFanEposta") || {}).value || "").trim();
    if (fanE && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(fanE)) { yoneticiDurum("Fan e-postası geçerli bir adres değil", false); return; }
    veri.fanEposta = fanE;
    gizlilikCiz();
    if (typeof fanBolumleriCiz === "function") { fanBolumleriCiz(); }
    yoneticiDurum("İletişim adresleri güncellendi — yayına almak için Kaydet", true);
    return;
  }
  if (e.target.closest("[data-y-hata-temizle]")) {
    if (yListeSilOnay !== "hata") { yListeSilOnay = "hata"; yoneticiHatalarYukle(); return; }
    yListeSilOnay = null;
    hesapIstemci.rpc("hata_temizle").then(function (r) {
      yoneticiDurum(r.error ? String(r.error.message) : "Hata kayıtları temizlendi", !r.error);
      yoneticiHatalarYukle();
    });
    return;
  }
  if (e.target.closest("[data-y-yedek-al]")) { yoneticiYedekAl(); return; }
  if (e.target.closest("[data-y-veri-indir]")) { bakimIndir("veri.json", JSON.stringify(veri, null, 2)); return; }
  const yt = e.target.closest("[data-y-teori]");
  if (yt) {
    hesapIstemci.rpc("teori_isaretle", { p_teori: Number(yt.dataset.yTeori), p_isaret: yt.dataset.isaret || "", p_gizli: yt.dataset.gizli === "1" })
      .then(function (r) {
        yoneticiDurum(r.error ? String(r.error.message) : "Teori güncellendi", !r.error);
        yoneticiTeorilerYukle();
        if (typeof teoriCiz === "function") { teoriCiz(); }
      });
    return;
  }
});

["mouseover", "focusin"].forEach(function (olay) {
  document.addEventListener(olay, function (e) {
    const m = e.target.closest && e.target.closest("#yIstAlan .ist-isaret");
    if (m) { istIpucuGoster(m); }
  });
});
["mouseout", "focusout"].forEach(function (olay) {
  document.addEventListener(olay, function (e) {
    const m = e.target.closest && e.target.closest("#yIstAlan .ist-isaret");
    if (m && !(e.relatedTarget && m.contains(e.relatedTarget))) { istIpucuGoster(null); }
  });
});

/* ==================== SAYFA PAYLAŞ ==================== */

/* Yayında her sayfanın kendi adresi var (/dunya/ gibi): bağlantı önizlemesi o sayfanın adını gösterir */
function sayfaPaylasAdresi(sayfa) {
  return location.protocol === "https:" ? location.origin + "/" + sayfa + "/" : location.href.split("#")[0] + "#/" + sayfa;
}

document.addEventListener("click", function (e) {
  const d = e.target.closest("[data-sayfa-paylas]");
  if (!d) { return; }
  const sayfa = d.dataset.sayfaPaylas;
  const adres = sayfaPaylasAdresi(sayfa);
  const baslik = "TentiforApp — " + ((typeof SAYFA_BASLIK !== "undefined" && SAYFA_BASLIK[sayfa]) || sayfa);
  if (navigator.share) { navigator.share({ title: baslik, url: adres }).catch(function () {}); return; }
  const bitti = function () { d.textContent = "Bağlantı kopyalandı"; setTimeout(function () { d.textContent = "Paylaş"; }, 1800); };
  if (typeof panoyaKopyala === "function") { panoyaKopyala(adres).then(bitti).catch(function () { prompt("Bağlantı:", adres); }); }
  else { prompt("Bağlantı:", adres); }
});

/* Profil penceresi #/u/ad adresiyle açılır; adres değişince (geri tuşu, başka sayfa) kapansın */
window.addEventListener("hashchange", function () {
  if (/^#\/u\//.test(location.hash)) { return; }
  const perde = document.querySelector("#perde");
  if (perde && !perde.hidden && perde.querySelector(".hesap-profil") && typeof perdeKapat === "function") { perdeKapat(); }
});
