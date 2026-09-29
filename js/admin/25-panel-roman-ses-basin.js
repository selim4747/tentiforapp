/* Yönetici paneline eklenen üç sekme: Roman, Ses Ekle, Basın Kiti.

   Önceden roman bölümlerinin metni, karakter temaları/ortam sesi ve basın kiti
   görselleri yalnızca veri.json elle düzenlenerek eklenebiliyordu. Sekmeler
   22-yonetici.js'teki Y_GRUPLARI'na kayıtlı; çizim oradan buraya yönlenir. */

/* ==================== ROMAN ==================== */

let yoneticiRomanBolum = null;     /* düzenlenen bölümün indeksi, "yeni" ya da null */
let yoneticiRomanSilOnay = null;

function romanKelimeSayisi(metin) {
  return String(metin || "").trim().split(/\s+/).filter(Boolean).length;
}

function yoneticiRoman() {
  if (!veri.roman) { veri.roman = { baslik: "", altbaslik: "", giris: "", bolumler: [] }; }
  const r = veri.roman;

  const genel =
    '<div class="kutu-y">' +
      "<label>Roman başlığı</label>" +
      '<input class="kod-giris arac-giris" id="yRomanBaslik" value="' + kacir(r.baslik || "") + '">' +
      "<label>Alt başlık</label>" +
      '<input class="kod-giris arac-giris" id="yRomanAltbaslik" value="' + kacir(r.altbaslik || "") + '">' +
      "<label>Giriş</label>" +
      '<textarea class="kod-giris arac-giris" id="yRomanGiris" rows="3">' + kacir(r.giris || "") + "</textarea>" +
      '<button class="dugme dugme-sade" data-y-roman-genel="1">Genel bilgileri kaydet</button>' +
    "</div>";

  if (yoneticiRomanBolum !== null) { return genel + yoneticiRomanEditor(); }

  const liste = r.bolumler.map(function (b, i) {
    const kelime = romanKelimeSayisi(b.metin);
    const silOnay = yoneticiRomanSilOnay === i;
    return '<div class="y-blok-satir">' +
             '<span class="y-blok-baslik">' + String(b.no).padStart(2, "0") + " · " + kacir(b.baslik || "") +
               '<span class="oyun-not"> — ' + (kelime ? kelime + " kelime" : "boş") + " · " +
               (b.fiyat ? b.fiyat + " " + birim() : "ücretsiz") + "</span></span>" +
             '<button class="dugme dugme-sade" data-y-roman-duzenle="' + i + '">düzenle</button>' +
             '<button class="dugme dugme-sade y-sil" data-y-roman-sil="' + i + '">' +
               (silOnay ? "emin misin?" : "sil") + "</button>" +
           "</div>";
  }).join("");

  return genel +
    '<div class="kutu-y">' +
      "<label>Bölümler — " + r.bolumler.length + " adet</label>" +
      '<div class="y-blok-liste">' + (liste || '<p class="oyun-not">Henüz bölüm yok.</p>') + "</div>" +
      '<button class="dugme" data-y-roman-yeni="1">+ Yeni bölüm</button>' +
    "</div>";
}

function yoneticiRomanEditor() {
  const yeni = yoneticiRomanBolum === "yeni";
  const b = yeni ? { baslik: "", ozet: "", metin: "", fiyat: 0 } : veri.roman.bolumler[yoneticiRomanBolum];
  if (!b) { yoneticiRomanBolum = null; return ""; }

  return '<div class="kutu-y">' +
      "<label>" + (yeni ? "Yeni bölüm" : String(b.no).padStart(2, "0") + ". bölüm") + " — başlık</label>" +
      '<input class="kod-giris arac-giris" id="yRomanBolumBaslik" value="' + kacir(b.baslik || "") + '">' +
      "<label>Özet (listede görünür)</label>" +
      '<input class="kod-giris arac-giris" id="yRomanBolumOzet" value="' + kacir(b.ozet || "") + '">' +
      "<label>Fiyat (" + birim() + ", 0 = ücretsiz)</label>" +
      '<input class="kod-giris arac-giris" id="yRomanBolumFiyat" type="number" min="0" step="10" value="' + (b.fiyat || 0) + '">' +
      "<label>Metin — paragrafları boş satırla ayır</label>" +
      '<textarea class="kod-giris arac-giris y-roman-metin" id="yRomanBolumMetin" rows="18">' + kacir(b.metin || "") + "</textarea>" +
      '<p class="oyun-not" id="yRomanSayac">' + romanKelimeSayisi(b.metin) + " kelime</p>" +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-y-roman-kaydet="1">' + (yeni ? "Bölümü ekle" : "Kaydet") + "</button>" +
        '<button class="dugme dugme-sade" data-y-roman-iptal="1">İptal</button>' +
      "</div>" +
    "</div>";
}

function yoneticiRomanGenelKaydet() {
  const r = veri.roman;
  r.baslik = ((document.querySelector("#yRomanBaslik") || {}).value || "").trim();
  r.altbaslik = ((document.querySelector("#yRomanAltbaslik") || {}).value || "").trim();
  r.giris = ((document.querySelector("#yRomanGiris") || {}).value || "").trim();
  yoneticiDurum("Roman bilgileri güncellendi", true);
  if (typeof romanCiz === "function") { romanCiz(); }
}

function yoneticiRomanBolumKaydet() {
  const al = function (id) { return ((document.querySelector(id) || {}).value || ""); };
  const baslik = al("#yRomanBolumBaslik").trim();
  if (!baslik) { yoneticiDurum("Bölümün başlığı gerekli", false); return; }

  const fiyat = Math.max(0, parseInt(al("#yRomanBolumFiyat"), 10) || 0);
  const bolumler = veri.roman.bolumler;
  const alanlar = { baslik: baslik, ozet: al("#yRomanBolumOzet").trim(), metin: al("#yRomanBolumMetin").trim(), fiyat: fiyat };

  if (yoneticiRomanBolum === "yeni") {
    const no = bolumler.reduce(function (m, b) { return Math.max(m, b.no || 0); }, 0) + 1;
    bolumler.push(Object.assign({ no: no }, alanlar));
    yoneticiDurum(no + ". bölüm eklendi", true);
  } else {
    Object.assign(bolumler[yoneticiRomanBolum], alanlar);
    yoneticiDurum("\"" + baslik + "\" kaydedildi", true);
  }

  yoneticiRomanBolum = null;
  if (typeof romanCiz === "function") { romanCiz(); }
  yoneticiCiz();
}

function yoneticiRomanBolumSil(i) {
  if (yoneticiRomanSilOnay !== i) { yoneticiRomanSilOnay = i; yoneticiCiz(); return; }
  const b = veri.roman.bolumler.splice(i, 1)[0];
  yoneticiRomanSilOnay = null;
  yoneticiDurum("\"" + (b && b.baslik) + "\" silindi", true);
  if (typeof romanCiz === "function") { romanCiz(); }
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-roman-genel]")) { yoneticiRomanGenelKaydet(); return; }
  if (e.target.closest("[data-y-roman-yeni]")) { yoneticiRomanBolum = "yeni"; yoneticiRomanSilOnay = null; yoneticiCiz(); return; }
  const d = e.target.closest("[data-y-roman-duzenle]");
  if (d) { yoneticiRomanBolum = parseInt(d.dataset.yRomanDuzenle, 10); yoneticiRomanSilOnay = null; yoneticiCiz(); return; }
  const s = e.target.closest("[data-y-roman-sil]");
  if (s) { yoneticiRomanBolumSil(parseInt(s.dataset.yRomanSil, 10)); return; }
  if (e.target.closest("[data-y-roman-kaydet]")) { yoneticiRomanBolumKaydet(); return; }
  if (e.target.closest("[data-y-roman-iptal]")) { yoneticiRomanBolum = null; yoneticiCiz(); }
});

document.addEventListener("input", function (e) {
  if (e.target.id !== "yRomanBolumMetin") { return; }
  const s = document.querySelector("#yRomanSayac");
  if (s) { s.textContent = romanKelimeSayisi(e.target.value) + " kelime"; }
});

/* ==================== SES EKLE ====================
   Karakter temaları (karakter.ses) ve Nöbet'in gece ortam sesi (ses.ortam).
   Ses dosyası veri.json'a gömülemeyecek kadar büyük olduğu için yalnızca
   GitHub'a yüklenir; GitHub ayarı yoksa açıkça söylenir. */

const SES_EN_FAZLA_MB = 15;

let yoneticiSesHedef = "";          /* karakter id'si ya da "_ortam" */
let yoneticiSesDosya = null;

function yoneticiSesEkle() {
  const karakterler = veri.karakterler || [];
  if (!yoneticiSesHedef) { yoneticiSesHedef = karakterler.length ? karakterler[0].id : "_ortam"; }

  const secenek = function (deger, ad, var_) {
    return '<option value="' + kacir(deger) + '"' + (deger === yoneticiSesHedef ? " selected" : "") + ">" +
           kacir(ad) + (var_ ? " (sesi var)" : "") + "</option>";
  };

  const mevcut = karakterler.filter(function (k) { return k.ses; }).map(function (k) {
    return { ad: k.ad + " — tema", yol: k.ses, hedef: k.id };
  });
  if (veri.ses && veri.ses.ortam) { mevcut.unshift({ ad: "Nöbet — gece ortam sesi", yol: veri.ses.ortam, hedef: "_ortam" }); }

  return '<p class="oyun-not">Karakter temaları kartta "▶ tema" düğmesiyle, ortam sesi Nöbet oyununun gece safhasında döngüde çalar. ' +
      "Dosya GitHub'a <code>ses/</code> klasörüne yüklenir (en fazla " + SES_EN_FAZLA_MB + " MB; mp3 önerilir).</p>" +
    (typeof githubHazir === "function" && !githubHazir()
      ? '<p class="oyun-not"><b>GitHub ayarı yok.</b> Ses yüklemek için önce Bakım → Kaydet sekmesinden GitHub bilgilerini gir.</p>'
      : "") +
    '<div class="kutu-y">' +
      "<label>1. Hangi ses?</label>" +
      '<select class="kod-giris arac-giris" id="ySesHedef">' +
        secenek("_ortam", "Nöbet — gece ortam sesi", veri.ses && veri.ses.ortam) +
        karakterler.map(function (k) { return secenek(k.id, k.ad + " — tema", k.ses); }).join("") +
      "</select>" +
      "<label>2. Ses dosyası</label>" +
      '<input type="file" accept="audio/*" id="ySesDosya">' +
      (yoneticiSesDosya
        ? '<p class="oyun-not">' + kacir(yoneticiSesDosya.name) + " · " + (yoneticiSesDosya.size / 1048576).toFixed(1) + " MB</p>"
        : "") +
      '<button class="dugme' + (yoneticiSesDosya ? "" : " pasif") + '" data-y-ses-yukle="1">Yükle</button>' +
    "</div>" +
    (mevcut.length
      ? '<div class="kutu-y"><label>Eklenmiş sesler — ' + mevcut.length + " adet</label>" +
          '<div class="y-blok-liste">' + mevcut.map(function (m) {
            return '<div class="y-blok-satir">' +
                     '<span class="y-blok-baslik">' + kacir(m.ad) + '<span class="oyun-not"> — ' + kacir(m.yol) + "</span></span>" +
                     '<button class="dugme dugme-sade" data-y-ses-dinle="' + kacir(m.yol) + '">dinle</button>' +
                     '<button class="dugme dugme-sade y-sil" data-y-ses-kaldir="' + kacir(m.hedef) + '">kaldır</button>' +
                   "</div>";
          }).join("") + "</div></div>"
      : "");
}

function sesDosyaAdi(hedef, dosya) {
  const uzanti = (String(dosya.name).match(/\.([a-z0-9]{2,4})$/i) || [0, "mp3"])[1].toLowerCase();
  const kok = hedef === "_ortam" ? "ortam" : "tema_" + hedef;
  return "ses/" + kok.replace(/[^a-z0-9_-]/gi, "").toLowerCase() + "." + uzanti;
}

function dosyaBase64Oku(dosya) {
  return new Promise(function (coz, reddet) {
    const o = new FileReader();
    o.onerror = reddet;
    o.onload = function () { coz(bayttanBase64(new Uint8Array(o.result))); };
    o.readAsArrayBuffer(dosya);
  });
}

async function yoneticiSesYukle() {
  const dosya = yoneticiSesDosya;
  if (!dosya) { yoneticiDurum("Önce bir ses dosyası seç", false); return; }
  if (dosya.type && dosya.type.indexOf("audio/") !== 0) { yoneticiDurum("Bu bir ses dosyası değil", false); return; }
  if (dosya.size > SES_EN_FAZLA_MB * 1048576) { yoneticiDurum("Dosya " + SES_EN_FAZLA_MB + " MB'tan büyük", false); return; }

  yoneticiDurum("Yükleniyor...", true);
  const yol = sesDosyaAdi(yoneticiSesHedef, dosya);

  let sonuc;
  try {
    sonuc = await githubDosyaYukle(yol, await dosyaBase64Oku(dosya));
  } catch (_) {
    sonuc = { ok: false, sebep: "dosya okunamadı" };
  }
  if (!sonuc.ok) { yoneticiDurum("Yüklenemedi (" + sonuc.sebep + ") — GitHub ayarlarını kontrol et", false); return; }

  /* aynı adla yeniden yüklenince tarayıcı eskisini çalmasın */
  const kayit = yol + "?v=" + Date.now().toString(36);
  if (yoneticiSesHedef === "_ortam") {
    if (!veri.ses) { veri.ses = { klasor: "ses/", varsayilanSes: 0.7 }; }
    veri.ses.ortam = kayit;
  } else {
    const k = (veri.karakterler || []).find(function (x) { return x.id === yoneticiSesHedef; });
    if (k) { k.ses = kayit; }
  }

  yoneticiSesDosya = null;
  yoneticiDurum("Yüklendi: " + yol + " — kalıcı olması için veri.json'u kaydetmeyi unutma", true);
  arsiviTazele();
  yoneticiCiz();
}

function yoneticiSesKaldir(hedef) {
  if (hedef === "_ortam") { if (veri.ses) { veri.ses.ortam = ""; } }
  else {
    const k = (veri.karakterler || []).find(function (x) { return x.id === hedef; });
    if (k) { delete k.ses; }
  }
  yoneticiDurum("Ses bağlantısı kaldırıldı (GitHub'daki dosya elle silinmeli)", true);
  arsiviTazele();
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-ses-yukle]")) { yoneticiSesYukle(); return; }
  const dinle = e.target.closest("[data-y-ses-dinle]");
  if (dinle && typeof sesCal === "function") { sesCal("_panel_" + dinle.dataset.ySesDinle, dinle.dataset.ySesDinle, dinle); return; }
  const kaldir = e.target.closest("[data-y-ses-kaldir]");
  if (kaldir) { yoneticiSesKaldir(kaldir.dataset.ySesKaldir); }
});

document.addEventListener("change", function (e) {
  if (e.target.id === "ySesHedef") { yoneticiSesHedef = e.target.value; return; }
  if (e.target.id === "ySesDosya") { yoneticiSesDosya = e.target.files[0] || null; yoneticiCiz(); }
});

/* ==================== BASIN KİTİ ==================== */

let yoneticiBasinSilOnay = null;

function yoneticiBasin() {
  if (!veri.basin) { veri.basin = { kunye: [], cumleler: [], gorseller: [] }; }
  const b = veri.basin;
  if (!b.gorseller) { b.gorseller = []; }

  const kunyeMetin = (b.kunye || []).map(function (k) { return k.alan + ": " + k.deger; }).join("\n");

  return '<div class="kutu-y">' +
      "<label>Tanıtım cümlesi</label>" +
      '<input class="kod-giris arac-giris" id="yBasinTanitim" value="' + kacir(b.tanitim || "") + '">' +
      "<label>Uzun açıklama</label>" +
      '<textarea class="kod-giris arac-giris" id="yBasinUzun" rows="4">' + kacir(b.uzun || "") + "</textarea>" +
      "<label>Künye — her satıra bir tane, <code>Alan: değer</code></label>" +
      '<textarea class="kod-giris arac-giris" id="yBasinKunye" rows="6">' + kacir(kunyeMetin) + "</textarea>" +
      '<button class="dugme dugme-sade" data-y-basin-metin="1">Metinleri kaydet</button>' +
    "</div>" +
    '<div class="kutu-y">' +
      "<label>Ekran görüntüleri — " + b.gorseller.length + " adet</label>" +
      '<p class="oyun-not">En fazla 1280 piksele küçültülüp GitHub\'a <code>gorseller/</code> klasörüne yüklenir.</p>' +
      '<input type="file" accept="image/*" id="yBasinGorsel">' +
      (b.gorseller.length
        ? '<div class="y-basin-izgara">' + b.gorseller.map(function (g, i) {
            return '<div class="y-basin-kart">' +
                     '<img src="' + kacir(g) + '" alt="" loading="lazy">' +
                     '<button class="dugme dugme-sade y-sil" data-y-basin-sil="' + i + '">' +
                       (yoneticiBasinSilOnay === i ? "emin misin?" : "sil") + "</button>" +
                   "</div>";
          }).join("") + "</div>"
        : "") +
    "</div>";
}

function yoneticiBasinMetinKaydet() {
  const b = veri.basin;
  const al = function (id) { return ((document.querySelector(id) || {}).value || "").trim(); };
  b.tanitim = al("#yBasinTanitim");
  b.uzun = al("#yBasinUzun");
  b.kunye = al("#yBasinKunye").split("\n").map(function (s) {
    const i = s.indexOf(":");
    return i === -1 ? null : { alan: s.slice(0, i).trim(), deger: s.slice(i + 1).trim() };
  }).filter(function (k) { return k && k.alan; });
  yoneticiDurum("Basın kiti güncellendi", true);
  if (typeof basinCiz === "function") { basinCiz(); }
}

async function yoneticiBasinGorselEkle(dosya) {
  if (!dosya) { return; }
  const i = veri.basin.gorseller.length;
  await gorselBirakildi(dosya, "basin.gorseller." + i, "basin_" + Date.now().toString(36), 1280, 0.82);
  /* yükleme başarısızsa boş kalan yeri temizle */
  veri.basin.gorseller = veri.basin.gorseller.filter(Boolean);
  if (typeof basinCiz === "function") { basinCiz(); }
  yoneticiCiz();
}

function yoneticiBasinGorselSil(i) {
  if (yoneticiBasinSilOnay !== i) { yoneticiBasinSilOnay = i; yoneticiCiz(); return; }
  veri.basin.gorseller.splice(i, 1);
  yoneticiBasinSilOnay = null;
  yoneticiDurum("Görsel kaldırıldı (GitHub'daki dosya elle silinmeli)", true);
  if (typeof basinCiz === "function") { basinCiz(); }
  yoneticiCiz();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-y-basin-metin]")) { yoneticiBasinMetinKaydet(); return; }
  const s = e.target.closest("[data-y-basin-sil]");
  if (s) { yoneticiBasinGorselSil(parseInt(s.dataset.yBasinSil, 10)); }
});

document.addEventListener("change", function (e) {
  if (e.target.id === "yBasinGorsel") { yoneticiBasinGorselEkle(e.target.files[0]); }
});
