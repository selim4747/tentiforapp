/* E25 kişileri: herkesin E25'e (Evrengezerlerin evreni) ekleyebildiği Evrengezerler.

   - Kişiyi yaratan onun adını, unvanını, özetini ve kişilik hallerini yazar. Kişilik halleri yaratıcının
     cihazındaki imza anahtarıyla (ECDSA P-256) imzalanır: yalnızca yaratıcı değiştirebilir. Başka biri
     değiştirirse imza tutmaz ve kişi her yerde "değiştirilmiş" diye görünür.
   - Kişi, fan eseri gibi bir dosyadır (tur: "kisi"); kişinin verisinde durur, dosyayla paylaşılır,
     yazara gönderilince yönetici sitede (veri.fanEserleri.kisiler) yayımlayabilir.
   - İsteyen kişiyi başka bir evrene ya da hikâyeye "konuk" olarak götürür: imzalı kopyası esere girer,
     kişilik halleri orada salt okunur görünür (yaratıcı güncellediyse en yeni imzalı hâli). */

const YARATICI_ANAHTAR = "tentiforapp_yaratici_anahtar";
const KISI_HAL_SINIR = 12;
const KONUK_SINIR = 30;

/* ==================== veri ==================== */

function kisiB64(v, n) { v = String(v || ""); return /^[A-Za-z0-9+/=]+$/.test(v) && v.length <= n ? v : ""; }

/** Dosyadan ya da konuk listesinden gelen kişiyi sınırlar. */
function kisiTemizle(ham) {
  if (!ham || typeof ham !== "object") { return null; }
  const e = { bicim: FAN_BICIM, surum: 1, tur: "kisi", id: fanMetin(ham.id, 40).replace(/[^\w-]/g, "") || fanId(),
    evren: /^[a-z0-9]{1,12}$/.test(ham.evren || "") ? ham.evren : "e25",
    ad: fanMetin(ham.ad, 80), unvan: fanMetin(ham.unvan, 80), ozet: fanMetin(ham.ozet, 2000), yazar: fanMetin(ham.yazar, 80),
    olusturma: fanMetin(ham.olusturma, 30), guncelleme: fanMetin(ham.guncelleme, 30),
    kisilik: (Array.isArray(ham.kisilik) ? ham.kisilik : []).slice(0, KISI_HAL_SINIR).map(function (h) {
      return { ad: fanMetin(h && h.ad, 80), aciklama: fanMetin(h && h.aciklama, 1500) };
    }).filter(function (h) { return h.ad.trim() || h.aciklama.trim(); }) };
  if (ham.imza && typeof ham.imza === "object") {
    const a = kisiB64(ham.imza.a, 120), s = kisiB64(ham.imza.s, 200);
    if (a && s) { e.imza = { a: a, s: s }; }
  }
  if (!e.ad.trim()) { return null; }
  return e;
}

function konukTemizle(l) {
  return (Array.isArray(l) ? l : []).slice(0, KONUK_SINIR).map(kisiTemizle).filter(Boolean);
}

/** İmzalanan kısım: kimlik, ad ve kişilik halleri (sıralı, sabit biçim). */
function kisiImzaMetni(e) {
  return JSON.stringify({ id: e.id, ad: e.ad, kisilik: (e.kisilik || []).map(function (h) { return [h.ad, h.aciklama]; }) });
}

/* ==================== imza ==================== */

async function yaraticiAnahtari() {
  let y = jsonOku(YARATICI_ANAHTAR, null);
  if (!y || !y.a || !y.gizli) {
    const cift = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    y = { a: bayttanBase64(new Uint8Array(await crypto.subtle.exportKey("raw", cift.publicKey))),
      gizli: await crypto.subtle.exportKey("jwk", cift.privateKey) };
    jsonYaz(YARATICI_ANAHTAR, y);
  }
  return y;
}

function benimYaratigimMi(e) {
  const y = jsonOku(YARATICI_ANAHTAR, null);
  return !!(y && y.a && e && e.imza && e.imza.a === y.a);
}

async function kisiImzala(e) {
  const y = await yaraticiAnahtari();
  const gizli = await crypto.subtle.importKey("jwk", y.gizli, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const imza = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, gizli, new TextEncoder().encode(kisiImzaMetni(e)));
  e.imza = { a: y.a, s: bayttanBase64(new Uint8Array(imza)) };
  return e;
}

const kisiDogrulamaOnbellek = {};

/** "gecerli" | "degismis" | "imzasiz" */
async function kisiDogrula(e) {
  if (!e || !e.imza) { return "imzasiz"; }
  const anahtar = e.imza.a + "|" + e.imza.s + "|" + kisiImzaMetni(e);
  if (kisiDogrulamaOnbellek[anahtar]) { return kisiDogrulamaOnbellek[anahtar]; }
  let sonuc = "degismis";
  try {
    const acik = await crypto.subtle.importKey("raw", base64tenBayt(e.imza.a), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    sonuc = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, acik, base64tenBayt(e.imza.s), new TextEncoder().encode(kisiImzaMetni(e))) ? "gecerli" : "degismis";
  } catch (_) { sonuc = "degismis"; }
  kisiDogrulamaOnbellek[anahtar] = sonuc;
  return sonuc;
}

/* çizilen kişiler: rozetler çizimden sonra doğrulanır */
const KISI_KAYIT = {};
let kisiKayitNo = 0;
let kisiTazeleZaman = null;

function kisiRozet(e) {
  const k = "k" + (++kisiKayitNo);
  KISI_KAYIT[k] = e;
  clearTimeout(kisiTazeleZaman);
  kisiTazeleZaman = setTimeout(kisiRozetleriTazele, 0);
  return '<span class="kisi-imza" data-kisi-imza="' + k + '">' + (e.imza ? "imza denetleniyor…" : "imzasız") + "</span>";
}

async function kisiRozetleriTazele() {
  const kayit = KISI_KAYIT;
  for (const el of Array.from(document.querySelectorAll("[data-kisi-imza]"))) {
    const e = kayit[el.getAttribute("data-kisi-imza")];
    if (!e) { continue; }
    const d = await kisiDogrula(e);
    el.textContent = ({ gecerli: "✓ yaratıcısının imzası", degismis: "⚠ değiştirilmiş: kişilik halleri yaratıcısına ait değil", imzasiz: "imzasız" })[d];
    el.className = "kisi-imza " + d;
  }
}

/** Yaratıcının güncellediği en yeni hâl: aynı kimlik ve aynı yaratıcı anahtarıyla bilinen sürüm. */
function kisiGuncel(k) {
  if (!k || !k.imza) { return k; }
  const adaylar = fanEserlerim().concat(fanSiteListesi("kisi")).filter(function (x) {
    return x && x.tur === "kisi" && x.id === k.id && x.imza && x.imza.a === k.imza.a;
  });
  adaylar.sort(function (a, b) { return String(b.guncelleme || "").localeCompare(String(a.guncelleme || "")); });
  return adaylar[0] && String(adaylar[0].guncelleme || "") > String(k.guncelleme || "") ? adaylar[0] : k;
}

/* ==================== görünüm ==================== */

function kisiHalleriHtml(e) {
  const l = e.kisilik || [];
  if (!l.length) { return ""; }
  return '<dl class="kisi-haller">' + l.map(function (h) {
    return "<dt>" + kacir(h.ad || "—") + "</dt><dd>" + paragraf(h.aciklama) + "</dd>";
  }).join("") + "</dl>";
}

/** Okuma görünümü (dosyada ve sitede). */
function kisiGovde(e, dosya) {
  return '<p class="ust">Evrengezer · ' + kacir(String(e.evren || "e25").toUpperCase()) + " · okur kişisi</p>" +
    "<h1>" + kacir(e.ad) + "</h1>" +
    '<div class="bilgi">' + (e.unvan ? "<div><b>Unvan:</b> " + kacir(e.unvan) + "</div>" : "") +
      (e.yazar ? "<div><b>Yaratan:</b> " + kacir(e.yazar) + "</div>" : "") +
      (dosya ? "" : "<div>" + kisiRozet(e) + "</div>") + "</div>" +
    (e.ozet ? paragraf(e.ozet) : "") +
    ((e.kisilik || []).length ? "<h2>Kişilik halleri</h2>" + kisiHalleriHtml(e) +
      '<p class="bilgi">Kişilik halleri yaratıcısına aittir; bu kişiyi götüren başka biri onları değiştiremez.</p>' : "");
}

/** Hikâyede ya da evrende konuk kişiler (salt okunur). */
function konukGovde(e, dosya) {
  const l = e.konuklar || [];
  if (!l.length) { return ""; }
  return "<h2>Konuk kişiler</h2>" + l.map(function (k0) {
    const k = kisiGuncel(k0);
    return '<div class="konuk"><h3>' + kacir(k.ad) + (k.unvan ? ' <span class="bilgi">· ' + kacir(k.unvan) + "</span>" : "") + "</h3>" +
      '<div class="bilgi">' + kacir(String(k.evren || "e25").toUpperCase()) + " kişisi" + (k.yazar ? " · yaratan: " + kacir(k.yazar) : "") +
        (dosya ? "" : " · " + kisiRozet(k)) + "</div>" +
      (k.ozet ? paragraf(k.ozet) : "") + kisiHalleriHtml(k) + "</div>";
  }).join("");
}

function e25Kisileri() {
  const gorulen = {};
  const l = [];
  const ekle = function (e, kaynak) {
    if (!e || e.tur !== "kisi" || (e.evren || "e25") !== "e25" || gorulen[e.id]) { return; }
    gorulen[e.id] = true;
    l.push({ e: e, kaynak: kaynak });
  };
  fanEserlerim().forEach(function (e) { ekle(e, "benim"); });
  fanSiteListesi("kisi").forEach(function (e) { ekle(e, "site"); });
  fanAcilanlar().forEach(function (e) { ekle(e, "acilan"); });
  return l;
}

let kisiDuzenlenen = null;   /* düzenlenen kendi kişinin kimliği */
let kisiGoturulen = null;    /* götürme seçicisi açık olan kişi: "kaynak:id" */

function kisiBul(kaynak, id) {
  const l = kaynak === "benim" ? fanEserlerim() : (kaynak === "site" ? fanSiteListesi("kisi") : fanAcilanlar());
  return l.find(function (x) { return x.tur === "kisi" && x.id === id; }) || null;
}

function kisiFormHtml(e) {
  const hal = (e && e.kisilik || []).map(function (h) { return (h.ad || "") + ": " + String(h.aciklama || "").replace(/\n+/g, " "); }).join("\n");
  const yazar = (e && e.yazar) || (typeof hesapProfil !== "undefined" && hesapProfil && (hesapProfil.gorunen_ad || hesapProfil.kullanici_adi)) || "";
  return '<div class="kisi-form" data-kisi-form="' + kacir(e ? e.id : "") + '">' +
    '<label for="kisiAd">Adı</label><input class="kod-giris arac-giris" id="kisiAd" maxlength="80" value="' + kacir(e ? e.ad : "") + '">' +
    '<label for="kisiUnvan">Unvanı</label><input class="kod-giris arac-giris" id="kisiUnvan" maxlength="80" value="' + kacir(e ? e.unvan : "") + '" placeholder="Taş taşıyıcısı, gezgin, kaçak…">' +
    '<label for="kisiOzet">Kim o?</label><textarea class="kod-giris arac-giris fan-uzun" id="kisiOzet" rows="4" maxlength="2000">' + kacir(e ? e.ozet : "") + "</textarea>" +
    '<label for="kisiHaller">Kişilik halleri (her satıra bir tane — “Hal: açıklama”)</label>' +
    '<textarea class="kod-giris arac-giris fan-uzun" id="kisiHaller" rows="5" placeholder="Sakin: Tehlikede bile sesi titremez.&#10;Öfkeli: Taşını sıkınca evrenler çatırdar.">' + kacir(hal) + "</textarea>" +
    '<label for="kisiYazar">Yaratan (takma ad olabilir)</label><input class="kod-giris arac-giris" id="kisiYazar" maxlength="80" value="' + kacir(yazar) + '">' +
    '<div class="oyun-sira"><button class="dugme" data-kisi-kaydet="' + kacir(e ? e.id : "") + '">' + (e ? "Kaydet ve imzala" : "Ekle ve imzala") + "</button>" +
      (e ? '<button class="dugme dugme-sade" data-kisi-vazgec>Vazgeç</button><button class="dugme dugme-sade y-sil" data-kisi-sil="' + kacir(e.id) + '">Sil</button>' : "") + "</div>" +
    '<p class="pencere-durum" id="kisiDurum" role="status"></p></div>';
}

function kisiGoturHtml(e, anahtar) {
  const benim = fanEserlerim();
  const hikayeler = benim.filter(function (x) { return x.tur === "hikaye"; });
  const evrenler = benim.filter(function (x) { return x.tur === "evren" && !x.e99; });
  return '<div class="kisi-gotur"><label for="kisiHedef">Nereye götürülsün?</label>' +
    '<select class="kod-giris arac-giris" id="kisiHedef">' +
      '<option value="yeni-hikaye">Yeni bir hikâye yaz</option>' +
      hikayeler.map(function (h) { return '<option value="hikaye:' + kacir(h.id) + '">Hikâye: ' + kacir(fanAd(h)) + "</option>"; }).join("") +
      evrenler.map(function (v) { return '<option value="evren:' + kacir(v.id) + '">Evren: ' + kacir(fanAd(v)) + "</option>"; }).join("") +
    "</select>" +
    '<p class="oyun-not">Kişi oraya konuk olarak girer. Onu istediğin hikâyede yazabilirsin; kişilik halleri yaratıcısına ait kalır.</p>' +
    '<div class="oyun-sira"><button class="dugme" data-kisi-gotur-onay="' + kacir(anahtar) + '">Götür</button>' +
    '<button class="dugme dugme-sade" data-kisi-gotur-kapat>Vazgeç</button></div></div>';
}

function kisiKartHtml(x) {
  const e = x.e;
  const anahtar = x.kaynak + ":" + e.id;
  const kendi = x.kaynak === "benim" && (benimYaratigimMi(e) || !e.imza);
  /* altta: doğumu (kapı, ilk söz), göründüğü yerler, pasaport damgaları */
  const dg = e.dogum || {};
  const yerler = evrKonukYerleri(e.id);
  const damga = e25Damgalar(e.id);
  const ek = '<p class="oyun-not evr-dogdu">E25’te doğdu' + (dg.kapi ? " · " + kacir(dg.kapi) + " kapısından" : "") + (dg.soz ? " · ilk sözü: “" + kacir(dg.soz) + "”" : "") +
      (e.evren && e.evren !== "e25" ? " · ilk göründüğü evren: " + kacir(String(e.evren).toUpperCase()) : "") + "</p>" +
    (yerler.length ? '<p class="oyun-not evr-gezdi"><b>Göründüğü yerler:</b> ' + yerler.slice(0, 8).map(kacir).join(" · ") + (yerler.length > 8 ? " …" : "") + "</p>" : "") +
    '<div class="e25-pasaport"><span class="oyun-etiket">Pasaport · ' + damga.length + " damga</span>" +
      (damga.length ? '<div class="e25-damgalar">' + damga.map(e25DamgaHtml).join("") + "</div>" : '<span class="oyun-not"> henüz boş: başka bir evrende hikâyeye konuk olunca damga gelir</span>') + "</div>";
  if (kendi && kisiDuzenlenen === e.id) { return '<div class="kutu-y kisi-kart">' + kisiFormHtml(e) + ek + "</div>"; }
  return '<div class="kutu-y kisi-kart"><div class="kisi-bas"><b>' + kacir(e.ad) + "</b>" + (e.unvan ? ' <span class="oyun-not">' + kacir(e.unvan) + "</span>" : "") + "</div>" +
    '<div class="oyun-not">' + (e.yazar ? "Yaratan: " + kacir(e.yazar) + " · " : "") +
      (x.konuk && x.kaynak === "site" ? "bir esere konuk olarak geldi" : ({ benim: kendi ? "senin kişin" : "senin kopyan", site: "sitede", acilan: "dosyadan" })[x.kaynak]) + " · " + kisiRozet(e) + "</div>" +
    (e.ozet ? paragraf(e.ozet) : "") + kisiHalleriHtml(e) +
    '<div class="oyun-sira">' +
      '<button class="dugme dugme-sade" data-kisi-gotur="' + kacir(anahtar) + '">Başka evrene götür</button>' +
      '<button class="dugme dugme-sade" data-kisi-kart="' + kacir(anahtar) + '">Kişi kartı (hikâye)</button>' +
      (kendi ? '<button class="dugme dugme-sade" data-kisi-duzenle="' + kacir(e.id) + '">Düzenle</button>' +
        '<button class="dugme dugme-sade" data-kisi-paylas="' + kacir(anahtar) + '">Dosya / yazara gönder</button>' : "") +
    "</div>" + (kisiGoturulen === anahtar ? kisiGoturHtml(e, anahtar) : "") +
    (typeof konukHaritasiHtml === "function" ? konukHaritasiHtml(e, anahtar) : "") + ek + "</div>";
}

/** E25 sayfasının altındaki bölüm: herkes kendi Evrengezerini ekler (evren kodla kilitli olsa da). */
/** E25 sayfasının Evrengezerler bölümü: doğum sahnesi, Kapılar Salonu, okur Evrengezerleri, ekleme formu (ya da seviye kapısı). */
function e25KisilerHtml() {
  const l = e25Kisileri();
  const ekle = !uretimAcik("kisi")
    ? '<div class="kutu-y svk-kapi"><b>🔒 Evrengezerini ekle</b><p class="oyun-not">' + kacir(seviyeKapiMetni(SEVIYE_URETIM.kisi.seviye)) + "</p>" +
      seviyeCubukHtml(SEVIYE_URETIM.kisi.seviye) + "</div>"
    : '<details class="kutu-y"' + (l.some(function (x) { return x.kaynak === "benim"; }) ? "" : " open") + "><summary><b>+ Evrengezerini ekle</b></summary>" +
      (kisiDuzenlenen === "" || kisiDuzenlenen === null ? kisiFormHtml(null) : '<p class="oyun-not">Önce açık düzenlemeyi bitir.</p>') + "</details>";
  return e25DogumSahnesiHtml() + e25SalonHtml() +
    '<div class="e25-kisiler"><h3 class="evs-ara-baslik">Okurların Evrengezerleri' + (l.length >= 6 ? " · " + l.length + "</h3>" +
      '<input class="kod-giris e25-ara" id="e25Ara" type="search" placeholder="Evrengezer ara (ad, unvan, yaratan)" aria-label="Evrengezer ara">' : "</h3>") +
    '<p class="oyun-not">E25 Evrengezerlere özgü: isteyen buraya kendi Evrengezerini ekler. Kişilik halleri yaratanın imzasıyla kilitlidir; ' +
      "başkaları kişiyi kendi evrenine ya da hikâyesine götürüp yazabilir ama kişiliğini değiştiremez.</p>" +
    (l.length ? l.map(kisiKartHtml).join("") : '<p class="oyun-not">Henüz kimse eklemedi.</p>') + ekle + "</div>";
}

/** Hikâye ve evren düzenleyicisinde: konuk kişiler (salt okunur, çıkarılabilir). */
function konukDuzenleyiciHtml(e) {
  const l = (e && e.konuklar) || [];
  if (!l.length) { return ""; }
  return '<div class="kutu-y konuk-duzen"><div class="oyun-etiket">Konuk kişiler</div>' +
    '<p class="oyun-not">Kişilik halleri yaratıcısına ait; burada değiştirilemez. Hikâyende onları istediğin gibi yaşatabilirsin.</p>' +
    l.map(function (k0) {
      const k = kisiGuncel(k0);
      return '<div class="konuk"><b>' + kacir(k.ad) + "</b>" + (k.unvan ? ' <span class="oyun-not">' + kacir(k.unvan) + "</span>" : "") +
        '<div class="oyun-not">' + (k.yazar ? "yaratan: " + kacir(k.yazar) + " · " : "") + kisiRozet(k) + "</div>" + kisiHalleriHtml(k) +
        '<button class="dugme dugme-sade y-sil" data-konuk-cikar="' + kacir(e.id) + ":" + kacir(k.id) + '">Konuğu çıkar</button></div>';
    }).join("") + "</div>";
}

/* ==================== işlemler ==================== */

function kisiHalleriAyir(metin) {
  return String(metin || "").split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, KISI_HAL_SINIR).map(function (s) {
    const i = s.indexOf(":");
    return i > 0 ? { ad: s.slice(0, i).trim().slice(0, 80), aciklama: s.slice(i + 1).trim().slice(0, 1500) } : { ad: s.slice(0, 80), aciklama: "" };
  });
}

/** Evrengezeri kaydeder; boş dize ya da hata metni döner. Yeni Evrengezer doğar: kapısı ve ilk sözü (formdan). */
async function kisiKaydet(id, alan) {
  /* yenisini yaratmak kapıda; var olanı düzenlemek serbest */
  if (!id && !uretimAcik("kisi")) { seviyeUyari("kisi"); return "Evrengezer yaratmak " + seviyeKapiMetni(SEVIYE_URETIM.kisi.seviye) + "."; }
  const kapi = (document.querySelector("#kisiKapi") || {}).value || "", soz = ((document.querySelector("#kisiIlkSoz") || {}).value || "").trim();
  const ad = String(alan.ad || "").trim();
  if (!ad) { return "Kişinin bir adı olsun."; }
  const l = fanEserlerim();
  let e = id ? l.find(function (x) { return x.tur === "kisi" && x.id === id; }) : null;
  if (e && e.imza && !benimYaratigimMi(e)) { return "Bu kişiyi sen yaratmadın; kişiliğini yalnızca yaratıcısı değiştirebilir."; }
  const simdi = new Date().toISOString();
  if (!e) { e = { bicim: FAN_BICIM, surum: 1, tur: "kisi", id: fanId(), evren: "e25", olusturma: simdi }; l.push(e); }
  e.ad = ad.slice(0, 80);
  e.unvan = String(alan.unvan || "").trim().slice(0, 80);
  e.ozet = String(alan.ozet || "").slice(0, 2000);
  e.yazar = String(alan.yazar || "").trim().slice(0, 80);
  e.kisilik = kisiHalleriAyir(alan.haller);
  e.guncelleme = simdi;
  try { await kisiImzala(e); } catch (_) { return "İmzalanamadı: bu tarayıcı imzayı desteklemiyor."; }
  if (!id && !e.dogum) {
    e.dogum = { kapi: kapi.slice(0, 80), soz: soz.slice(0, 200), t: new Date().toISOString() };
    evrDogumSon = e.id;   /* doğum sahnesi */
  }
  fanEserlerimYaz(l);
  return "";
}

/** Kişiyi hikâyeye ya da evrene konuk olarak götürür; hedefin kimliğini döner. */
/** Evrengezeri bir esere konuk götürür. hedef: "yeni-hikaye", "yeni-hikaye@<evren adı>" ya da "<tür>:<id>". */
function kisiGotur(kisi, hedef) {
  const ham = String(hedef || "");
  let evrenAdi = null;
  if (/^yeni-hikaye@/.test(ham)) { evrenAdi = ham.slice("yeni-hikaye@".length); hedef = "yeni-hikaye"; }
  /* hikâyenin evreni Evrengezer getirmeye izin vermeli */
  if (/^hikaye:/.test(ham)) {
    const h = fanEserlerim().find(function (x) { return x.tur === "hikaye" && x.id === ham.slice(7); });
    const g = h ? evaEvrengezerIzni(h.evren) : { izin: true };
    if (!g.izin) { eckaBildir(g.neden); return null; }
  }
  const kopya = kisiTemizle(JSON.parse(JSON.stringify(kisi)));
  if (!kopya) { return null; }
  let l = fanEserlerim();
  let e;
  if (hedef === "yeni-hikaye") {
    const yeni = fanYeni("hikaye");
    if (!yeni) { return null; }   /* seviye kapısı: uyarıyı fanYeni gösterdi */
    l = fanEserlerim();
    e = l.find(function (x) { return x.id === yeni.id; });
    if (!e) { return null; }   /* depolama dolu: kaydedilemedi */
    e.baslik = kopya.ad + " hakkında";
  } else {
    const p = hedef.split(":");
    e = l.find(function (x) { return x.tur === p[0] && x.id === p[1]; });
  }
  if (!e) { return null; }
  e.konuklar = (Array.isArray(e.konuklar) ? e.konuklar : []).filter(function (k) { return k.id !== kopya.id; });
  e.konuklar.push(kopya);
  if (e.tur === "hikaye") {
    const adlar = String(e.karakterler || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (adlar.indexOf(kopya.ad) === -1) { adlar.push(kopya.ad); }
    e.karakterler = adlar.join(", ");
  }
  /* bir evrende yeni hikâye: evreni yazılır, metin yolculuk iskeletiyle başlar */
  if (evrenAdi !== null && e.tur === "hikaye") {
    if (evrenAdi) { e.evren = evrenAdi; }
    if (!String(e.metin || "").trim()) { e.metin = yolculukIskeleti(kisi, evrenAdi || e.evren); }
  }
  e.guncelleme = new Date().toISOString();
  fanEserlerimYaz(l);
  return { tur: e.tur, id: e.id };
}

/* ==================== kişi kartı: Instagram hikâyesi (1080×1920) ==================== */

async function kisiKartUret(e) {
  if (typeof kartFontlariHazir !== "function") { return null; }
  await kartFontlariHazir();
  const EN = 1080, BOY = 1920;
  const t = document.createElement("canvas");
  t.width = EN; t.height = BOY;
  const c = t.getContext && t.getContext("2d");
  if (!c) { return null; }
  kartZemin(c, EN, BOY);
  const cerceve = typeof egKartCercevesi === "function" ? egKartCercevesi() : null;
  if (cerceve) { c.strokeStyle = cerceve.renk; c.lineWidth = 18; c.strokeRect(34, 34, EN - 68, BOY - 68); }
  const sol = 110, gen = EN - 220;
  c.fillStyle = KART_RENK.deniz;
  c.fillRect(sol, 170, 6, 64);
  kartEtiket(c, "E25 · Evrengezer", sol + 26, 214, KART_RENK.murekkep2, 26);
  let y = 330;
  c.fillStyle = KART_RENK.murekkep;
  let px = 120;
  c.font = KART_FONT.baslik(px);
  let sat = kartSar(c, e.ad, gen);
  while (sat.length > 2 && px > 64) { px -= 8; c.font = KART_FONT.baslik(px); sat = kartSar(c, e.ad, gen); }
  sat.slice(0, 2).forEach(function (s) { y += px; c.fillText(s, sol, y); });
  y += 30;
  c.font = KART_FONT.yazi(40, true);
  c.fillStyle = KART_RENK.deniz;
  const bilgi = [e.unvan, e.yazar ? "yaratan: " + e.yazar : ""].filter(Boolean).join(" · ");
  if (bilgi) { kartSar(c, bilgi, gen).slice(0, 2).forEach(function (s) { y += 52; c.fillText(s, sol, y); }); }
  y += 40;
  c.font = KART_FONT.yazi(38);
  c.fillStyle = KART_RENK.murekkep2;
  kartSar(c, String(e.ozet || "").replace(/\s+/g, " ").slice(0, 300), gen).slice(0, 5).forEach(function (s) { y += 52; c.fillText(s, sol, y); });
  y += 50;
  (e.kisilik || []).slice(0, 5).forEach(function (h) {
    if (y > BOY - 360) { return; }
    c.font = KART_FONT.mono(30, true);
    c.fillStyle = KART_RENK.deniz;
    y += 56; c.fillText(String(h.ad || "").toLocaleUpperCase("tr").slice(0, 40), sol, y);
    c.font = KART_FONT.yazi(36);
    c.fillStyle = KART_RENK.murekkep;
    kartSar(c, String(h.aciklama || "").replace(/\s+/g, " ").slice(0, 160), gen).slice(0, 2).forEach(function (s) { y += 48; c.fillText(s, sol, y); });
    y += 10;
  });
  kartEtiket(c, "Kişilik halleri yaratanın imzasıyla kilitli", sol, BOY - 190, KART_RENK.murekkep2, 22);
  kartEtiket(c, "TentiforApp · " + KART_ADRES + "/evren/e25/", sol, BOY - 130, KART_RENK.yarik, 24);
  return t;
}

document.addEventListener("click", async function (ev) {
  const k = ev.target.closest("[data-kisi-kart]");
  if (!k) { return; }
  const p = k.dataset.kisiKart.split(":");
  const e = kisiBul(p[0], p.slice(1).join(":"));
  if (!e) { return; }
  k.disabled = true;
  try {
    const t = await kisiKartUret(e);
    if (!t) { return; }
    const blob = await new Promise(function (coz) { t.toBlob(coz, "image/png"); });
    const ad = fanSlug(e.ad) + "-e25-kart.png";
    const dosya = new File([blob], ad, { type: "image/png" });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [dosya] })) {
      try { await navigator.share({ files: [dosya], title: e.ad + " — E25 Evrengezeri" }); return; } catch (err) { if (err && err.name === "AbortError") { return; } }
    }
    kartIndir(blob, ad);
  } finally { k.disabled = false; }
});

document.addEventListener("click", async function (ev) {
  const h = ev.target.closest("[data-kisi-kaydet], [data-kisi-vazgec], [data-kisi-sil], [data-kisi-duzenle], [data-kisi-paylas], [data-kisi-gotur], [data-kisi-gotur-kapat], [data-kisi-gotur-onay], [data-konuk-cikar]");
  if (!h) { return; }
  const d = h.dataset;
  const ciz = function () { if (typeof EVS !== "undefined" && EVS && typeof evrenSayfaCiz === "function") { evrenSayfaCiz(); } };
  if (d.kisiKaydet !== undefined) {
    const al = function (s) { const x = document.querySelector(s); return x ? x.value : ""; };
    h.disabled = true;
    const hata = await kisiKaydet(d.kisiKaydet, { ad: al("#kisiAd"), unvan: al("#kisiUnvan"), ozet: al("#kisiOzet"), haller: al("#kisiHaller"), yazar: al("#kisiYazar") });
    h.disabled = false;
    if (hata) { const x = document.querySelector("#kisiDurum"); if (x) { x.textContent = hata; x.className = "pencere-durum kotu"; } return; }
    kisiDuzenlenen = null;
    ciz();
    return;
  }
  if (h.hasAttribute("data-kisi-vazgec")) { kisiDuzenlenen = null; ciz(); return; }
  if (d.kisiSil) {
    if (h.dataset.onay !== "1") { h.dataset.onay = "1"; h.textContent = "Emin misin? Sil"; return; }
    fanEserlerimYaz(fanEserlerim().filter(function (x) { return !(x.tur === "kisi" && x.id === d.kisiSil); }));
    kisiDuzenlenen = null;
    ciz();
    return;
  }
  if (d.kisiDuzenle) { kisiDuzenlenen = d.kisiDuzenle; kisiGoturulen = null; ciz(); return; }
  if (d.kisiPaylas) {
    const p = d.kisiPaylas.split(":");
    const e = kisiBul(p[0], p.slice(1).join(":"));
    if (e) { await fanPaylas(e, e.ad + " — E25 Evrengezeri" + (fanEposta() ? ". Alıcı: " + fanEposta() : "")); }
    return;
  }
  if (d.kisiGotur) { kisiGoturulen = kisiGoturulen === d.kisiGotur ? null : d.kisiGotur; ciz(); return; }
  if (h.hasAttribute("data-kisi-gotur-kapat")) { kisiGoturulen = null; ciz(); return; }
  if (d.kisiGoturOnay) {
    const p = d.kisiGoturOnay.split(":");
    const e = kisiBul(p[0], p.slice(1).join(":"));
    const hedef = (document.querySelector("#kisiHedef") || {}).value || "yeni-hikaye";
    const s = e ? kisiGotur(e, hedef) : null;
    kisiGoturulen = null;
    if (!s) { ciz(); return; }
    if (s.tur === "hikaye") {
      fanSecili.hikaye = s.id; fanSekme.hikaye = "yaz";
      location.hash = "#/fan";
      setTimeout(function () { fanHikayeCiz(); const a = document.querySelector("#fanHikayeAlan"); if (a) { a.scrollIntoView({ block: "start" }); } }, 150);
    } else {
      evrenSonrakiSekme = "bilgi";
      location.hash = "#/ev/benim/" + s.id;
    }
    if (typeof eckaBildir === "function") { eckaBildir(e.ad + " konuk olarak götürüldü"); }
    return;
  }
  if (d.konukCikar) {
    const p = d.konukCikar.split(":");
    const l = fanEserlerim();
    const e = l.find(function (x) { return x.id === p[0]; });
    if (!e) { return; }
    e.konuklar = (e.konuklar || []).filter(function (k) { return k.id !== p[1]; });
    if (!e.konuklar.length) { delete e.konuklar; }
    fanEserlerimYaz(l);
    if (e.tur === "hikaye" && typeof fanHikayeCiz === "function") { fanHikayeCiz(); }
    ciz();
  }
});
