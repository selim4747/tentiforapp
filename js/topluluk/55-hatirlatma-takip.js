/* Günün kelimesi hatırlatması ve evren takibi.

   - Hatırlatma: Chrome'da uygulama olarak yüklüyken (Periodic Background Sync) servis çalışanı günde bir kez
     bakar; o gün kelime oynanmadıysa "Günün kelimesi hazır" der. Sunucu yok.
   - Takip: okur sitedeki bir fan evrenini takip eder. Yeni roman bölümü eklenince ana sayfada görür;
     hatırlatma açıksa servis çalışanı bildirim de gösterir.
   Ayarlar servis çalışanıyla "tf-ayar" önbelleği üzerinden paylaşılır (sw.js). */

const TKP_ANAHTAR = "tentiforapp_takip_evrenler";   /* { evrenId: bilinen bölüm sayısı } */
const HTR_ANAHTAR = "tentiforapp_gk_hatirlatma";
const SW_AYAR = "/__tf-ayar";

function tkpBolumSayisi(e) {
  if (!e) { return 0; }
  if (e.sayilar) { return Number(e.sayilar.bolum) || 0; }
  return (((e.roman || {}).bolumler) || []).length;
}

function tkpListe() {
  const l = jsonOku(TKP_ANAHTAR, {});
  return l && typeof l === "object" && !Array.isArray(l) ? l : {};
}

function tkpFanEvren(id) {
  return ((veri.fanEserleri || {}).evrenler || []).find(function (x) { return x.id === id; }) || null;
}

/** Servis çalışanının ayarını tazeler; bölüm sayılarında büyük olan kalır (iki taraf da günceller). */
async function swAyarEsitle(ek) {
  /* uygulamada: bugün oynandı → hatırlatmalar yeniden kurulur */
  if (kabukMu() && ek && ek.oynanan) {
    try { localStorage.setItem(KABUK_BLD.oynanan, kabukBugun()); } catch (_) { /* yok */ }
    kabukHatirlatmaKur();
  }
  if (typeof caches === "undefined") { return; }
  try {
    const c = await caches.open("tf-ayar");
    const y = await c.match(SW_AYAR);
    const a = y ? await y.json() : {};
    const takip = tkpListe();
    const eski = a.takip || {};
    Object.keys(takip).forEach(function (id) { takip[id] = Math.max(Number(takip[id]) || 0, Number(eski[id]) || 0); });
    a.takip = takip;
    a.kelime = jsonOku(HTR_ANAHTAR, false) === true;
    Object.assign(a, ek || {});
    await c.put(SW_AYAR, new Response(JSON.stringify(a), { headers: { "Content-Type": "application/json" } }));
  } catch (_) { /* önbellek kapalı */ }
}

/** Günlük arka plan kontrolünü kaydeder. Hata varsa açıklamasını döner. */
/** Günlük hatırlatmayı kurar; boş dize ya da neden kurulamadığı. Android uygulamasında yerel bildirimle (78). */
async function gunlukKontrolKaydet(izinIste) {
  if (kabukMu() && kabukEklenti("LocalNotifications")) { return kabukGunlukKur(izinIste); }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) { return "Bu tarayıcı bildirim göstermiyor."; }
  let reg = null;
  try { reg = await Promise.race([navigator.serviceWorker.ready, new Promise(function (c) { setTimeout(function () { c(null); }, 3000); })]); } catch (_) { reg = null; }
  if (!reg || !("periodicSync" in reg)) {
    return "Günlük hatırlatma, Chrome'da siteyi uygulama olarak yükleyince çalışır (menüden “Uygulamayı yükle”).";
  }
  if (Notification.permission !== "granted") {
    if (!izinIste) { return "Bildirim izni yok."; }
    const izin = await Notification.requestPermission();
    if (izin !== "granted") { return "Bildirim izni verilmedi."; }
  }
  try {
    const d = await navigator.permissions.query({ name: "periodic-background-sync" });
    if (d.state !== "granted") { return "Chrome henüz arka plan kontrolüne izin vermedi; uygulamayı birkaç gün kullanınca açılır."; }
  } catch (_) { /* sorulamıyorsa denemeye devam */ }
  try { await reg.periodicSync.register("tf-gunluk", { minInterval: 12 * 3600 * 1000 }); }
  catch (e) { return "Kaydedilemedi: " + ((e && e.message) || e); }
  return "";
}

async function gunlukKontrolKaldirGerekirse() {
  if (kabukMu()) { kabukHatirlatmaKur(); }   /* uygulamada yerel bildirimler yeniden kurulur */
  if (jsonOku(HTR_ANAHTAR, false) === true || Object.keys(tkpListe()).length) { return; }
  try { const reg = await navigator.serviceWorker.ready; if (reg.periodicSync) { await reg.periodicSync.unregister("tf-gunluk"); } } catch (_) { /* yok */ }
}

/* ==================== günün kelimesi: hatırlatma düğmesi ==================== */

function htrSatirHtml(mesaj) {
  const acik = jsonOku(HTR_ANAHTAR, false) === true;
  return '<div class="htr-satir">' +
    (acik ? '<span class="oyun-not">🔔 Her gün hatırlatma açık</span><button class="ic-bag" data-htr="kapat">kapat</button>'
      : '<button class="dugme dugme-sade htr-dugme" data-htr="ac">🔔 Her gün hatırlat</button>') +
    (mesaj ? '<span class="oyun-not htr-mesaj">' + kacir(mesaj) + "</span>" : "") + "</div>";
}

function htrSatirCiz(mesaj) {
  const dis = document.querySelector("#gkAlan");
  if (!dis) { return; }
  let s = dis.querySelector(".htr-satir");
  const yeni = htrSatirHtml(mesaj);
  if (s) { s.outerHTML = yeni; return; }
  const modlar = dis.querySelector(".gk-modlar");
  if (modlar) { modlar.insertAdjacentHTML("afterend", yeni); }
}

/* kelime bitince servis çalışanına "bugün oynandı" (hatırlatma gelmesin) */
document.addEventListener("submit", function (ev) {
  if (!ev.target.closest || !ev.target.closest("#gkAlan")) { return; }
  setTimeout(function () {
    const kolay = typeof koKayit === "function" ? koKayit("tomye-kolay") : null;
    const zorBitti = typeof gkDurum !== "undefined" && gkDurum && gkDurum.bitti;
    if (zorBitti || (kolay && koBitti(kolay))) { swAyarEsitle({ oynanan: koGun() }); }
  }, 1200);
}, true);

/* ==================== evren takibi ==================== */

function tkpKutusu(id) {
  const takipte = id in tkpListe();
  return '<div class="kutu-y tkp-kutu"><div class="oyun-etiket">Takip</div>' +
    '<p class="oyun-not">' + (takipte ? "Bu evreni takip ediyorsun: yeni bölüm eklenince ana sayfada görürsün (hatırlatma açıksa bildirim de gelir)."
      : "Takip et: bu evrene yeni roman bölümü eklenince haberin olsun.") + "</p>" +
    '<div class="oyun-sira"><button class="dugme' + (takipte ? " dugme-sade" : "") + '" data-tkp="' + kacir(id) + '">' + (takipte ? "Takibi bırak" : "☆ Takip et") + "</button></div>" +
    '<p class="pencere-durum" id="tkpDurum" role="status"></p></div>';
}

/** Ana sayfa: takip edilen evrenlerde yeni bölüm. */
function takipCiz() {
  const alan = document.querySelector("#takipAlan");
  if (!alan || !veri) { return; }
  const l = tkpListe();
  const yeniler = Object.keys(l).map(function (id) {
    const e = tkpFanEvren(id);
    return e ? { e: e, fark: tkpBolumSayisi(e) - (Number(l[id]) || 0) } : null;
  }).filter(function (x) { return x && x.fark > 0; });
  alan.innerHTML = yeniler.length ? '<div class="tkp-yeni"><span class="oyun-etiket">Takip ettiğin evrenlerde yeni</span>' +
    yeniler.map(function (x) {
      return '<a class="tkp-oge" href="#/ev/fan/' + kacir(x.e.id) + '"><b>' + kacir(x.e.ad) + "</b><span>" + x.fark + " yeni bölüm →</span></a>";
    }).join("") + "</div>" : "";
}

/* ==================== olaylar ==================== */

document.addEventListener("click", async function (ev) {
  const h = ev.target.closest("[data-htr], [data-tkp]");
  if (!h) { return; }
  if (h.dataset.htr === "ac") {
    h.disabled = true;
    const hata = await gunlukKontrolKaydet(true);
    if (!hata) { jsonYaz(HTR_ANAHTAR, true); await swAyarEsitle(); }
    htrSatirCiz(hata || "Her gün bir kez hatırlatacağım (o gün oynadıysan hatırlatmam).");
    return;
  }
  if (h.dataset.htr === "kapat") {
    jsonYaz(HTR_ANAHTAR, false);
    await swAyarEsitle();
    await gunlukKontrolKaldirGerekirse();
    htrSatirCiz();
    return;
  }
  if (h.dataset.tkp) {
    const id = h.dataset.tkp;
    const l = tkpListe();
    const e = tkpFanEvren(id);
    const birakti = id in l;
    if (birakti) { delete l[id]; } else { l[id] = tkpBolumSayisi(e); }
    jsonYaz(TKP_ANAHTAR, l);
    evrenSayfaCiz();   /* düğme hemen değişsin; izin sorusu ve servis çalışanı ardından */
    await swAyarEsitle();
    if (birakti) { await gunlukKontrolKaldirGerekirse(); return; }
    const hata = await gunlukKontrolKaydet(true);
    const d = document.querySelector("#tkpDurum");
    if (d) {
      d.textContent = hata ? "Takip ediyorsun. Yeni bölümleri ana sayfada görürsün. (" + hata + ")" : "Takip ediyorsun: yeni bölümde bildirim gelir.";
      d.className = "pencere-durum iyi";
    }
  }
});

/* ilk açılışta servis çalışanının ayarı tazelensin (başka cihazdan eşitlenen takipler) */
window.addEventListener("load", function () { setTimeout(function () { swAyarEsitle(); }, 3000); });
