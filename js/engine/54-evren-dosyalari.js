/* Sitedeki fan evrenleri ayrı dosyada: evrenler/<id>.json

   veri.json her açılışta iner; evrenler (roman, harita, gezegenler, oyun ayarları) büyüdükçe onu şişirmesin diye
   yönetici bir evreni siteye eklerken evrenin tamamı GitHub'a ayrı bir dosya olarak yüklenir, veri.json'da yalnızca
   kısa özeti (ad, anlatım, sayılar, para) kalır. Evren açılınca dosyası iner; servis çalışanı onu önbelleğe alır.
   "Telefona indir" evreni ve çizimlerini kalıcı önbelleğe koyar: internet yokken de açılır.

   GitHub anahtarı yoksa evren eskisi gibi veri.json'un içinde kalır (her şey yine çalışır). */

const EVD_ONBELLEK = "tf-evrenler";              /* servis çalışanının sürüm temizliğine girmez */
const EVD_INDIRILEN = "tentiforapp_indirilen_evrenler";
const EVD_YOL = /^evrenler\/[\w-]{1,60}\.json$/;
const EVD_BELLEK = {};                            /* id → evrenin tamamı (bu oturumda indirilen ya da yüklenen) */
const evdSuruyor = {};

function evdDosyali(e) { return !!(e && e.tur === "evren" && typeof e.dosya === "string" && EVD_YOL.test(e.dosya)); }
function evdHazir(e) { return !evdDosyali(e) || !!EVD_BELLEK[e.id]; }

/** veri.json'da kalacak özet: listelerin, evren seçicinin, paylaşım sayfasının ve gezi ödülünün ihtiyacı kadarı. */
function evdOzet(e, yol, boyut) {
  const say = function (l) { return (Array.isArray(l) ? l : []).length; };
  const o = { bicim: FAN_BICIM, surum: 1, tur: "evren", id: e.id, ad: e.ad || "", yazar: e.yazar || "",
    ozet: String(e.ozet || "").slice(0, 400), dosya: yol, boyut: boyut || 0,
    sayilar: { kural: say(e.kurallar), kisi: say(e.kisiler), yer: say(((e.harita || {}).yerler)), gezegen: say(e.gezegenler),
      bolum: say(((e.roman || {}).bolumler)), cizim: say(e.cizimler) } };
  ["eklenme", "olusturma", "guncelleme"].forEach(function (k) { if (e[k]) { o[k] = e[k]; } });
  ["para", "alfabe", "stil"].forEach(function (k) { if (e[k]) { o[k] = e[k]; } });
  if ((e.konuklar || []).length) { o.konuklar = e.konuklar; }
  const kapak = (e.cizimler || []).find(function (c) { return c.yol; });
  if (kapak) { o.kapak = kapak.yol; }
  return o;
}

/** Evrenin tamamını getirir (bellekten ya da dosyasından). */
function evdYukle(e) {
  if (!evdDosyali(e)) { return Promise.resolve(e); }
  if (EVD_BELLEK[e.id]) { return Promise.resolve(EVD_BELLEK[e.id]); }
  if (!evdSuruyor[e.id]) {
    evdSuruyor[e.id] = fetch(e.dosya, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) { throw new Error("Evren dosyası inemedi (" + r.status + ")"); } return r.json(); })
      .then(function (ham) {
        const t = fanTemizle(ham);
        if (!t || t.tur !== "evren") { throw new Error("Evren dosyası okunamadı"); }
        t.id = e.id;
        t.dosya = e.dosya;
        if (e.eklenme) { t.eklenme = e.eklenme; }
        EVD_BELLEK[e.id] = t;
        return t;
      })
      .finally(function () { delete evdSuruyor[e.id]; });
  }
  return evdSuruyor[e.id];
}

/* fan listesinde kart: özetteki sayılar */
/** Dosyalı okur evreninin kartı: özet sayılarla (evrenin tamamı indirilmeden). */
function evdKartHtml(e, kaynak) {
  const s = e.sayilar;
  const alt = [e.yazar, s.kural + " kural", s.kisi + " kişi", s.bolum ? s.bolum + " bölüm" : "", s.gezegen ? (s.gezegen + 1) + " gezegen" : ""].filter(Boolean).join(" · ");
  return '<button class="fan-kart" data-fan-ac="' + kaynak + ":" + kacir(e.tur) + ":" + kacir(e.id) + '">' +
    (e.kapak && EVC_YOL.test(e.kapak) ? '<img class="fan-kart-kapak" src="' + kacir(e.kapak) + '" alt="" loading="lazy">' : "") +
    '<span class="fan-kart-ad">' + kacir(fanAd(e)) + "</span>" +
    '<span class="oyun-not">' + kacir(alt) + "</span>" +
    (e.ozet ? '<span class="fan-kart-ozet">' + kacir(String(e.ozet).slice(0, 160)) + "</span>" : "") + "</button>";
}

/* ==================== telefona indir (çevrimdışı) ==================== */

function evdIndirilenler() {
  const l = jsonOku(EVD_INDIRILEN, {});
  return l && typeof l === "object" && !Array.isArray(l) ? l : {};
}

function evdIndirKutusu(ozet) {
  const k = evdIndirilenler()[ozet.id];
  const kb = ozet.boyut ? " (" + Math.max(1, Math.round(ozet.boyut / 1024)) + " KB" + (ozet.sayilar && ozet.sayilar.cizim ? " + " + ozet.sayilar.cizim + " çizim" : "") + ")" : "";
  return '<div class="kutu-y evd-indir"><div class="oyun-etiket">Çevrimdışı</div>' +
    (k ? '<p class="oyun-not">Bu evren telefonunda: internet yokken de açılır. İndirilme: ' + kacir(new Date(k).toLocaleDateString("tr-TR")) + "</p>"
      : '<p class="oyun-not">Evreni telefonuna indir' + kacir(kb) + "; internet yokken de açılsın. Uygulama olarak yüklediysen en iyi orada çalışır.</p>") +
    '<div class="oyun-sira"><button class="dugme' + (k ? " dugme-sade" : "") + '" data-evd-indir="' + kacir(ozet.id) + '">' + (k ? "Güncelle" : "Telefona indir") + "</button>" +
      (k ? '<button class="dugme dugme-sade" data-evd-sil="' + kacir(ozet.id) + '">Telefondan kaldır</button>' : "") + "</div>" +
    '<p class="pencere-durum" id="evdDurum" role="status"></p></div>';
}

async function evdCevrimdisiIndir(id) {
  const ozet = ((veri.fanEserleri || {}).evrenler || []).find(function (x) { return x.id === id; });
  if (!evdDosyali(ozet) || typeof caches === "undefined") { return "Bu tarayıcı çevrimdışı indirmeyi desteklemiyor."; }
  const agYok = "İnternet yok: evreni indirmek için bağlantı gerekir. Bağlanınca yeniden dene.";
  if (navigator.onLine === false) { return agYok; }
  try {
    const tam = await evdYukle(ozet);
    const c = await caches.open(EVD_ONBELLEK);
    const adresler = [ozet.dosya].concat((tam.cizimler || []).filter(function (x) { return x.yol && EVC_YOL.test(x.yol); }).map(function (x) { return x.yol; }));
    for (let i = 0; i < adresler.length; i++) {
      /* önbellekten değil, ağdan: indirilen hâl güncel olsun */
      const y = await fetch(adresler[i], { cache: "no-cache" });
      if (!y.ok) { return "İndirilemedi: " + adresler[i]; }
      await c.put(new URL(adresler[i], location.origin + "/").href, y);
    }
  } catch (e) {
    return (e instanceof TypeError || navigator.onLine === false) ? agYok : ((e && e.message) || "İndirilemedi");
  }
  if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch (_) { /* yok */ } }
  const l = evdIndirilenler();
  l[id] = Date.now();
  jsonYaz(EVD_INDIRILEN, l);
  return "";
}

async function evdCevrimdisiSil(id) {
  const ozet = ((veri.fanEserleri || {}).evrenler || []).find(function (x) { return x.id === id; });
  if (ozet && typeof caches !== "undefined") {
    const c = await caches.open(EVD_ONBELLEK);
    const tam = EVD_BELLEK[id] || ozet;
    await c.delete(new URL(ozet.dosya, location.origin + "/").href);
    await Promise.all((tam.cizimler || []).filter(function (x) { return x.yol; }).map(function (x) { return c.delete(new URL(x.yol, location.origin + "/").href); }));
  }
  const l = evdIndirilenler();
  delete l[id];
  jsonYaz(EVD_INDIRILEN, l);
}

/* ==================== yönetici: siteye eklerken dosyayı GitHub'a yükle ==================== */

/** 51-evren-oyunlari.js'teki siteye ekleme, çizimleri yükledikten sonra bunu çağırır. */
async function evdSiteyeYukle(id) {
  const l = (veri.fanEserleri || {}).evrenler || [];
  const i = l.findIndex(function (x) { return x.id === id; });
  if (i === -1) { return; }
  const durum = function (m, iyi) { if (typeof fanPDurum === "function") { fanPDurum(m, iyi); } };
  if (typeof githubHazir !== "function" || !githubHazir() || location.protocol.indexOf("http") !== 0 || typeof githubDosyaYukle !== "function") {
    durum("GitHub anahtarı tanımlı değil: evren veri.json'un içinde kalacak. Kaydet, sonra Yayınla.", true);
    return;
  }
  const tam = JSON.parse(JSON.stringify(l[i]));
  delete tam.dosya;
  const yol = "evrenler/" + String(id).replace(/[^\w-]/g, "").slice(0, 60) + ".json";
  const metin = JSON.stringify(tam);
  durum("Evren GitHub'a ayrı dosya olarak yükleniyor…", true);
  const r = await githubDosyaYukle(yol, base64Utf8(metin));
  if (!r.ok) { durum("Evren dosyası yüklenemedi (" + r.sebep + "); veri.json'un içinde kalacak. Kaydet, sonra Yayınla.", false); return; }
  const bayt = new TextEncoder().encode(metin).length;
  const t = fanTemizle(tam);
  if (t) { t.id = id; t.dosya = yol; if (tam.eklenme) { t.eklenme = tam.eklenme; } EVD_BELLEK[id] = t; }
  l[i] = evdOzet(tam, yol, bayt);
  if (typeof fanBolumleriCiz === "function") { fanBolumleriCiz(); }
  durum("Evren ayrı dosya olarak GitHub'a yüklendi (" + Math.max(1, Math.round(bayt / 1024)) + " KB); veri.json'da yalnızca özeti var. Şimdi Kaydet, sonra Yayınla.", true);
}

/* ==================== olaylar ==================== */

document.addEventListener("click", async function (ev) {
  const h = ev.target.closest("[data-evd-indir], [data-evd-sil]");
  if (!h) { return; }
  const d = document.querySelector("#evdDurum");
  h.disabled = true;
  if (h.dataset.evdIndir) {
    if (d) { d.textContent = "İndiriliyor…"; d.className = "pencere-durum"; }
    let hata = "";
    try { hata = await evdCevrimdisiIndir(h.dataset.evdIndir); } catch (e) { hata = (e && e.message) || "İndirilemedi"; }
    if (hata) { if (d) { d.textContent = hata; d.className = "pencere-durum kotu"; } h.disabled = false; return; }
    evrenSayfaCiz();
    const d2 = document.querySelector("#evdDurum");
    if (d2) { d2.textContent = "İndirildi: internet yokken de açılır."; d2.className = "pencere-durum iyi"; }
    return;
  }
  await evdCevrimdisiSil(h.dataset.evdSil);
  evrenSayfaCiz();
});

/* ==================== yönetici: Yayınla'dan sonra yayına çıktı mı? ====================
   Cloudflare paketi kurunca surum.json'daki paket kimliği değişir; panel 20 saniyede bir bakar. */

let yayinIzleme = null;

async function yayinPaketiOku() {
  /* 3.2: paket kimliği içerik özetidir; GitHub'a gönderim siteyi zaten kurduysa Yayınla aynı kimliği üretir.
     Kurulum zamanı (kuruldu) her kurulumda değişir: ikisine birlikte bakılır */
  try { const r = await fetch("/surum.json?_=" + Date.now(), { cache: "no-store" }); if (!r.ok) { return ""; } const d = await r.json(); return (d.paket || "") + "|" + (d.kuruldu || ""); } catch (_) { return ""; }
}

async function yayinIzle() {
  if (yayinIzleme) { clearInterval(yayinIzleme.zaman); }
  const bas = Date.now();
  const onceki = await yayinPaketiOku();
  /* sitede zaten bu sayfanın sürümünden yenisi varsa (otomatik kurulum önce bitti) hemen söyle */
  const yayindaki = onceki.split("|")[0];
  if (yayindaki && typeof sayfaPaketi === "function" && sayfaPaketi() && yayindaki !== sayfaPaketi()) {
    const d0 = document.querySelector("#yYayinDurum");
    if (d0) { d0.textContent = "Sitede daha yeni bir sürüm zaten yayında (GitHub'a gönderimle kurulmuş). Sayfayı yenileyince görürsün; Yayınla ayrıca yeniden kuruyor."; d0.className = "pencere-durum iyi"; }
  }
  const yaz = function (m, iyi) {
    const d = document.querySelector("#yYayinDurum");
    if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi === false ? "kotu" : "iyi"); }
  };
  yayinIzleme = { zaman: setInterval(async function () {
    const dk = Math.round((Date.now() - bas) / 60000);
    const simdi = await yayinPaketiOku();
    if (simdi && onceki && simdi !== onceki) {
      clearInterval(yayinIzleme.zaman); yayinIzleme = null;
      yaz("Yayında ✓ (" + Math.max(1, dk) + " dk sürdü). Sayfayı yenileyince yeni sürümü görürsün.", true);
      if (typeof eckaBildir === "function") { eckaBildir("Site yayında ✓"); }
      return;
    }
    if (Date.now() - bas > 12 * 60000) {
      clearInterval(yayinIzleme.zaman); yayinIzleme = null;
      yaz("12 dakikadır yeni sürüm görünmedi. Cloudflare → Deployments'ta hata var mı bak.", false);
      return;
    }
    yaz("Yayın kuruluyor… (" + dk + " dk) Bitince burada “Yayında ✓” yazar.", true);
  }, 20000) };
}

/* ==================== 4.4: ÇEVRİMDIŞI YÖNETİCİ (OFFLINEMANAGER) ==================== */

const tfOfflineManager = {
  dbAdi: "tentifor_offline_db",
  surum: 1,

  async _dbAc() {
    return new Promise(function (resolve, reject) {
      const istek = indexedDB.open("tentifor_offline_db", 1);
      istek.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("evrenler")) {
          db.createObjectStore("evrenler", { keyPath: "id" });
        }
      };
      istek.onsuccess = function (e) { resolve(e.target.result); };
      istek.onerror = function (e) { reject(e.target.error); };
    });
  },

  async kaydet(evren) {
    if (!evren || !evren.id) { throw new Error("Kaydedilecek geçerli bir evren yok."); }
    const db = await this._dbAc();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction("evrenler", "readwrite");
      const store = tx.objectStore("evrenler");
      const kopya = JSON.parse(JSON.stringify(evren));
      kopya._offline_tarih = new Date().toISOString();
      const r = store.put(kopya);
      r.onsuccess = function () { resolve(kopya); };
      r.onerror = function (e) { reject(e.target.error); };
    });
  },

  async getir(id) {
    const db = await this._dbAc();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction("evrenler", "readonly");
      const store = tx.objectStore("evrenler");
      const r = store.get(id);
      r.onsuccess = function () { resolve(r.result || null); };
      r.onerror = function (e) { reject(e.target.error); };
    });
  },

  async sil(id) {
    const db = await this._dbAc();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction("evrenler", "readwrite");
      const store = tx.objectStore("evrenler");
      const r = store.delete(id);
      r.onsuccess = function () { resolve(true); };
      r.onerror = function (e) { reject(e.target.error); };
    });
  },

  async listele() {
    const db = await this._dbAc();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction("evrenler", "readonly");
      const store = tx.objectStore("evrenler");
      const r = store.getAll();
      r.onsuccess = function () { resolve(r.result || []); };
      r.onerror = function (e) { reject(e.target.error); };
    });
  },

  /** Tek tıkla .tentifor dosyası olarak dışa aktar */
  disaAktar(evren) {
    if (!evren) { return; }
    const paket = JSON.stringify(evren, null, 2);
    const blob = new Blob([paket], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (evren.id || "evren") + ".tentifor";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /** .tentifor dosyasını içe aktar */
  async iceAktar(dosya) {
    const metin = await dosya.text();
    const evren = JSON.parse(metin);
    if (!evren || !evren.id) { throw new Error("Geçersiz .tentifor evren paketi."); }
    await this.kaydet(evren);
    if (typeof fanEseriKaydet === "function") { fanEseriKaydet(evren); }
    return evren;
  }
};

/* Çevrimdışı evren indirme butonu dinleyicisi */
document.addEventListener("click", async function (e) {
  const b = e.target.closest && e.target.closest("[data-evren-indir-offline]");
  if (!b) { return; }
  const id = b.getAttribute("data-evren-indir-offline");
  const evren = (typeof EVS !== "undefined" && EVS && EVS.veri) ? EVS.veri : (typeof evrenBul === "function" ? evrenBul(id) : null);
  if (!evren) { alert("Evren verisi bulunamadı."); return; }
  try {
    b.disabled = true;
    b.textContent = "İndiriliyor...";
    await tfOfflineManager.kaydet(evren);
    tfOfflineManager.disaAktar(evren);
    b.textContent = "✓ Çevrimdışı Hazır (.tentifor)";
    alert("“" + (evren.ad || "Evren") + "” başarıyla çevrimdışı arşivinize (IndexedDB) kaydedildi ve .tentifor paketi indirildi!");
  } catch (err) {
    alert("Çevrimdışı kayıt başarısız: " + (err.message || err));
    b.textContent = "Çevrimdışı İndir (.tentifor)";
    b.disabled = false;
  }
});

