/* Yerinde düzenleme — yönetici modunda sitenin kendisi üzerinde çalışır.
   Yazıya tıkla, düzelt, çık. Görseli kartın üstüne sürükle, bırak.

   Görseller küçültülüp GitHub'a yüklenir; anahtar girilmemişse dosyaya gömülür. */

const DUZENLE_ANAHTAR = "tentiforapp_duzenleme";

let duzenlemeModu = false;

function duzenlemeAcikMi() {
  return duzenlemeModu && typeof yoneticiAcik === "function" && yoneticiAcik();
}

function duzenlemeYukle() {
  duzenlemeModu = kayitOku(DUZENLE_ANAHTAR) === "acik";
  duzenlemeUygula();
}

function duzenlemeDegistir() {
  if (typeof yoneticiAcik !== "function" || !yoneticiAcik()) {
    eckaBildir("Önce yönetici moduna gir");
    return;
  }

  duzenlemeModu = !duzenlemeModu;
  kayitYaz(DUZENLE_ANAHTAR, duzenlemeModu ? "acik" : "kapali");
  duzenlemeUygula();
  duzenlemeTazele();
  duzenlemeCubugu();
}

/** Düzenleme modu açılıp kapanınca etkilenen her bölümü yeniden çizer. */
function duzenlemeTazele() {
  /* arsiviTazele artık tüm bölümleri kapsıyor. */
  arsiviTazele();
}


function duzenlemeUygula() {
  document.documentElement.setAttribute("data-ayar-duzenleme", duzenlemeAcikMi() ? "1" : "0");
}

/* ---------- yol çözümleme ----------
   "karakterler.3.detay" gibi bir yolu veri içinde bulur. */

function yolOku(yol) {
  const p = String(yol).split(".");
  let d = veri;

  for (let i = 0; i < p.length; i++) {
    if (d === null || d === undefined) { return ""; }
    d = Array.isArray(d) ? d[parseInt(p[i], 10)] : d[p[i]];
  }

  return d === null || d === undefined ? "" : String(d);
}

function yolYaz(yol, deger) {
  const p = String(yol).split(".");
  let d = veri;

  for (let i = 0; i < p.length - 1; i++) {
    d = Array.isArray(d) ? d[parseInt(p[i], 10)] : d[p[i]];
    if (!d) { return false; }
  }

  const son = p[p.length - 1];
  if (Array.isArray(d)) { d[parseInt(son, 10)] = deger; } else { d[son] = deger; }
  return true;
}

/** Düzenlenebilir alanı sarmalayan işaret. Mod kapalıyken hiçbir şey yapmaz. */
function duzenlenebilir(yol, ekSinif) {
  if (!duzenlemeAcikMi()) { return ""; }
  return ' data-duzenle="' + kacir(yol) + '" contenteditable="plaintext-only"' +
         ' class="' + (ekSinif || "") + ' duzenlenir" spellcheck="false"';
}

function duzenlemeKaydet(el) {
  const yol = el.dataset.duzenle;
  if (!yol) { return; }

  const yeni = el.innerText.replace(/\u00a0/g, " ").trim();
  const eski = yolOku(yol);

  if (yeni === eski) { return; }

  yolYaz(yol, yeni);
  gecmiseAl(yol, eski);
  duzenlemeCubugu();
  eckaBildir("Kaydedildi — dışa aktarmayı unutma");
}

/* ---------- geri alma ---------- */

const geriYigin = [];

function gecmiseAl(yol, eskiDeger) {
  geriYigin.push({ yol: yol, deger: eskiDeger });
  if (geriYigin.length > 50) { geriYigin.shift(); }
}

function geriAl() {
  const son = geriYigin.pop();
  if (!son) { eckaBildir("Geri alınacak bir şey yok"); return; }

  yolYaz(son.yol, son.deger);
  duzenlemeTazele();
  duzenlemeCubugu();
  eckaBildir("Geri alındı");
}

/* ---------- görsel işleme ---------- */

/** Görseli en fazla verilen genişliğe küçültüp base64 döner. kalite (0-1)
    JPEG sıkıştırma oranıdır — düşük değer daha küçük, daha düşük kaliteli
    dosya verir. */
function gorselKucult(dosya, enFazla, kalite) {
  return new Promise(function (coz, reddet) {
    const okuyucu = new FileReader();

    okuyucu.onerror = function () { reddet(new Error("dosya okunamadı")); };

    okuyucu.onload = function () {
      const img = new Image();

      img.onerror = function () { reddet(new Error("görsel açılamadı")); };

      img.onload = function () {
        const t = document.createElement("canvas");
        const c = t.getContext ? t.getContext("2d") : null;

        if (!c) {
          /* canvas yoksa dosyayı olduğu gibi kullan */
          coz({ veri: String(okuyucu.result).split(",")[1], tur: dosya.type || "image/png" });
          return;
        }

        const oran = Math.min(1, enFazla / Math.max(img.width, img.height));
        t.width = Math.round(img.width * oran);
        t.height = Math.round(img.height * oran);

        /* pixel art bulanıklaşmasın */
        c.imageSmoothingEnabled = oran < 1 && Math.max(img.width, img.height) > enFazla * 1.5;
        c.drawImage(img, 0, 0, t.width, t.height);

        const uzanti = (dosya.type === "image/jpeg") ? "image/jpeg" : "image/png";
        const veriUri = t.toDataURL(uzanti, kalite === undefined ? 0.9 : kalite);
        coz({ veri: veriUri.split(",")[1], tur: uzanti, en: t.width, boy: t.height });
      };

      img.src = okuyucu.result;
    };

    okuyucu.readAsDataURL(dosya);
  });
}

/** GitHub'a ikili dosya yükler. gh ayarları yonetici.js'te. */
async function githubGorselYukle(yol, base64) {
  if (typeof gh === "undefined" || !gh.kullanici || !gh.depo || !gh.jeton) {
    return { ok: false, sebep: "anahtar yok" };
  }

  if (location.protocol.indexOf("http") !== 0) {
    return { ok: false, sebep: "yerel dosya" };
  }

  const url = "https://api.github.com/repos/" + gh.kullanici + "/" + gh.depo + "/contents/" + yol;
  const baslik = {
    "Authorization": "Bearer " + gh.jeton,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  let sha = null;

  try {
    const oku = await fetch(url + "?ref=" + encodeURIComponent(gh.dal), { headers: baslik });
    if (oku.ok) { sha = (await oku.json()).sha; }
    else if (oku.status === 401) { return { ok: false, sebep: "anahtar geçersiz" }; }
  } catch (e) {
    return { ok: false, sebep: "ağ hatası" };
  }

  const govde = { message: "görsel eklendi: " + yol, content: base64, branch: gh.dal };
  if (sha) { govde.sha = sha; }

  try {
    const yaz = await fetch(url, {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, baslik),
      body: JSON.stringify(govde)
    });

    if (!yaz.ok) { return { ok: false, sebep: "GitHub " + yaz.status }; }
    return { ok: true };
  } catch (e) {
    return { ok: false, sebep: "ağ hatası" };
  }
}

/** Yalnızca isim netliği için — githubGorselYukle görsel dışı ikili dosyalar
    (şifreli PDF, ses vb.) için de birebir aynı şekilde çalışır. */
function githubDosyaYukle(yol, base64) {
  return githubGorselYukle(yol, base64);
}

/** Bırakılan görseli işler: küçült, yükle, yolu veriye yaz.
    enFazla/kalite verilmezse mevcut galeri/karakter davranışı (1024px,
    yüksek kalite) korunur — yönetici panelindeki düşük kaliteli görsel
    aracı bunları düşük değerlerle çağırır. */
async function gorselBirakildi(dosya, hedefYol, adOneri, enFazla, kalite) {
  if (!dosya || dosya.type.indexOf("image/") !== 0) {
    eckaBildir("Bu bir görsel değil");
    return;
  }

  eckaBildir("Görsel işleniyor...");

  let sonuc;
  try {
    sonuc = await gorselKucult(dosya, enFazla || 1024, kalite);
  } catch (e) {
    eckaBildir("Görsel okunamadı");
    return;
  }

  const uzanti = sonuc.tur === "image/jpeg" ? "jpg" : "png";
  const dosyaAdi = "gorseller/" + adOneri.replace(/[^a-z0-9_-]/gi, "").toLowerCase() + "." + uzanti;

  const yukleme = await githubGorselYukle(dosyaAdi, sonuc.veri);

  if (yukleme.ok) {
    const eski = yolOku(hedefYol);
    yolYaz(hedefYol, dosyaAdi);
    gecmiseAl(hedefYol, eski);
    eckaBildir("Yüklendi: " + dosyaAdi);
  } else {
    /* GitHub yoksa doğrudan göm — dosyayı şişirir ama çalışır */
    const boyutKb = Math.round(sonuc.veri.length * 0.75 / 1024);

    if (boyutKb > 400) {
      eckaBildir("Görsel çok büyük (" + boyutKb + " KB) ve " + yukleme.sebep + ". Yüklenmedi.");
      return;
    }

    const eski = yolOku(hedefYol);
    yolYaz(hedefYol, "data:" + sonuc.tur + ";base64," + sonuc.veri);
    gecmiseAl(hedefYol, eski);
    eckaBildir("Dosyaya gömüldü (" + boyutKb + " KB) — " + yukleme.sebep);
  }

  duzenlemeTazele();
  duzenlemeCubugu();
}

/* ---------- yüzen çubuk ---------- */

function duzenlemeCubugu() {
  let c = document.querySelector("#duzenleCubuk");

  if (!duzenlemeAcikMi()) {
    if (c) { c.remove(); }
    return;
  }

  if (!c) {
    c = document.createElement("div");
    c.id = "duzenleCubuk";
    c.className = "duzenle-cubuk";
    document.body.appendChild(c);
  }

  c.innerHTML =
    '<span class="dc-rozet">düzenleme</span>' +
    '<span class="dc-bilgi">' + geriYigin.length + " değişiklik</span>" +
    '<button class="dc-btn" data-duzenleme="geri">Geri al</button>' +
    '<button class="dc-btn dc-ana" data-duzenleme="aktar">Kaydet</button>' +
    '<button class="dc-btn" data-duzenleme="kapat">Çık</button>';
}

/* ---------- olaylar ---------- */

document.addEventListener("focusout", function (e) {
  const el = e.target.closest ? e.target.closest("[data-duzenle]") : null;
  if (el) { duzenlemeKaydet(el); }
});

document.addEventListener("keydown", function (e) {
  const el = e.target.closest ? e.target.closest("[data-duzenle]") : null;
  if (!el) { return; }

  if (e.key === "Escape") { el.blur(); }
  if (e.key === "Enter" && !e.shiftKey && el.dataset.tekSatir === "1") {
    e.preventDefault();
    el.blur();
  }
});

document.addEventListener("click", function (e) {
  const b = e.target.closest("[data-duzenleme]");
  if (!b) { return; }

  const eylem = b.dataset.duzenleme;

  if (eylem === "geri") { geriAl(); }
  else if (eylem === "kapat") { duzenlemeDegistir(); }
  else if (eylem === "ac") { duzenlemeDegistir(); }
  else if (eylem === "aktar") {
    if (typeof githubGonder === "function") { yoneticiSekme = "kaydet"; yoneticiCiz(); githubGonder(); }
    else if (typeof yoneticiDisaAktar === "function") { yoneticiDisaAktar(); }
  }
});

/* sürükle-bırak */
document.addEventListener("dragover", function (e) {
  const alan = e.target.closest ? e.target.closest("[data-birak]") : null;
  if (!alan || !duzenlemeAcikMi()) { return; }
  e.preventDefault();
  alan.classList.add("birakilir");
});

document.addEventListener("dragleave", function (e) {
  const alan = e.target.closest ? e.target.closest("[data-birak]") : null;
  if (alan) { alan.classList.remove("birakilir"); }
});

document.addEventListener("drop", function (e) {
  const alan = e.target.closest ? e.target.closest("[data-birak]") : null;
  if (!alan || !duzenlemeAcikMi()) { return; }

  e.preventDefault();
  alan.classList.remove("birakilir");

  const dosya = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  gorselBirakildi(dosya, alan.dataset.birak, alan.dataset.birakAd || "gorsel");
});

/* panoya kopyalanan görseli yapıştır */
document.addEventListener("paste", function (e) {
  if (!duzenlemeAcikMi()) { return; }

  const hedef = document.querySelector(".birak-secili");
  if (!hedef || !e.clipboardData) { return; }

  const ogeler = e.clipboardData.items || [];
  for (let i = 0; i < ogeler.length; i++) {
    if (ogeler[i].type.indexOf("image/") === 0) {
      e.preventDefault();
      gorselBirakildi(ogeler[i].getAsFile(), hedef.dataset.birak, hedef.dataset.birakAd || "gorsel");
      return;
    }
  }
});

/* dosya seçiciyle de çalışsın */
document.addEventListener("change", function (e) {
  if (!e.target.dataset || !e.target.dataset.birakGiris) { return; }
  const alan = document.querySelector('[data-birak="' + e.target.dataset.birakGiris + '"]');
  if (!alan) { return; }
  gorselBirakildi(e.target.files[0], alan.dataset.birak, alan.dataset.birakAd || "gorsel");
});
