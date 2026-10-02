/* TentiforApp servis çalışanı — sayfa ve veri önce ağdan (yavaşsa son kopya), sürümlü dosyalar önbellekten.
   Yeni bir sürüm yayınlanınca sayfalar kendiliğinden yenilenir; eski kopya yalnızca çevrimdışı ya da yavaş ağda kullanılır. */
const ONBELLEK = "tentiforapp-400f923eefb0";
/* Hesap kütüphanesi burada yok: yalnızca hesabı kullanan indirir (ilk kullanımda önbelleğe girer). */
const ILK = ["./", "index.html", "css/style.css?v=be2f302c44ec", "veri.json", "veri-degisiklik.json?v=a1aad374ff", "js/paket-1.js?v=3d381d29b0", "js/paket-2.js?v=400f923eefb0", "js/paket-3.js?v=00429b607e", "js/paket-4.js?v=d6c566e7fa", "manifest.webmanifest", "ikon/ikon-192.png", "yazitipi/karla-normal-400-latin.woff2", "js/core/24-arsiv-mantigi.js?v=3b01d5d917", "js/arsiv/34b-model-evreni.js", "js/engine/88-v46-yenilikler.js?v=b1134c748a", "js/engine/92-v51-dashboard.js?v=400f923eefb0", "js/core/99-v50-mobil.js?v=500", "evrenler/fornek-eterya.json"];

self.addEventListener("install", function (e) {
  /* Tek bir yavaş/eksik dosya kurulumun tamamını bozmasın. Çekilebilen dosyalar
     hemen önbelleğe girer; eksikler ilk ağ dönüşünde fetch stratejisiyle alınır. */
  e.waitUntil(caches.open(ONBELLEK).then(function (c) {
    return Promise.all(ILK.map(function (u) { return c.add(u).catch(function () { return null; }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (anahtarlar) {
    return Promise.all(anahtarlar.filter(function (a) { return a !== ONBELLEK && a.indexOf("tentiforapp-") === 0; })
      .map(function (a) { return caches.delete(a); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Yeni bölüm bildirimi (Web Push). Yük: { baslik, metin, adres } — adres her zaman bu sitenin içinde kalır. */
self.addEventListener("push", function (e) {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { metin: e.data ? e.data.text() : "" }; }
  /* sessiz saatte de gösterilir (tarayıcı ister) ama sessiz ve titreşimsiz */
  e.waitUntil(ayarOku().then(function (a) {
    return self.registration.showNotification(String(d.baslik || "Tentiforverse").slice(0, 80), {
      body: String(d.metin || "").slice(0, 200), icon: "ikon/ikon-192.png", badge: "ikon/ikon-192.png",
      tag: "tentifor-bildirim", data: { adres: d.adres || "/" }, silent: sessizMi(a)
    });
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  let hedef = new URL((e.notification.data && e.notification.data.adres) || "/", self.location.origin);
  if (hedef.origin !== self.location.origin) { hedef = new URL("/", self.location.origin); }
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (acik) {
    const p = acik.find(function (c) { return new URL(c.url).origin === self.location.origin; });
    if (p) { return p.navigate(hedef.href).then(function (c) { return (c || p).focus(); }).catch(function () { return p.focus(); }); }
    return self.clients.openWindow(hedef.href);
  }));
});

/* Günlük hatırlatma (Chrome'da uygulama olarak yüklüyken, Periodic Background Sync): sunucu yok.
   Ayarları sayfa "tf-ayar" önbelleğine yazar: { kelime: true, oynanan: "YYYY-AA-GG", takip: { evrenId: bölümSayısı } }.
   - Günün kelimesi: o gün henüz oynanmadıysa bir kez "Yeni kelime hazır".
   - Evren takibi: takip edilen evrene yeni roman bölümü eklendiyse haber. */
const AYAR_ADRES = "/__tf-ayar";

async function ayarOku() {
  try { const c = await caches.open("tf-ayar"); const y = await c.match(AYAR_ADRES); return y ? await y.json() : {}; } catch (_) { return {}; }
}
async function ayarYaz(a) {
  try { const c = await caches.open("tf-ayar"); await c.put(AYAR_ADRES, new Response(JSON.stringify(a), { headers: { "Content-Type": "application/json" } })); } catch (_) { /* yok */ }
}

/** Sessiz saatler (Sen → Bildirimler): { bas: 22, bit: 8 } — gece yarısını aşabilir. */
function sessizMi(a) {
  const s = a && a.sessiz;
  if (!s || typeof s.bas !== "number" || typeof s.bit !== "number" || s.bas === s.bit) { return false; }
  const h = new Date().getHours();
  return s.bas < s.bit ? (h >= s.bas && h < s.bit) : (h >= s.bas || h < s.bit);
}

async function gunlukKontrol() {
  const a = await ayarOku();
  if (sessizMi(a)) { return; }   /* sessiz saatte hatırlatma yok; sonraki kontrolde */
  const bugun = new Date().toISOString().slice(0, 10);
  if (a.kelime && a.oynanan !== bugun && a.hatirlatilan !== bugun) {
    a.hatirlatilan = bugun;
    await self.registration.showNotification("Tentiforverse · Günün kelimesi hazır", {
      body: "Bugünün Tentiforverse kelimesini bul: 6 hak.", icon: "ikon/ikon-192.png", badge: "ikon/ikon-192.png",
      tag: "tf-kelime", data: { adres: "/yarislar/" } });
  }
  const takip = a.takip || {};
  if (Object.keys(takip).length) {
    try {
      const v = await (await fetch("/veri.json", { cache: "no-cache" })).json();
      ((v.fanEserleri || {}).evrenler || []).forEach(function (e) {
        if (!(e.id in takip)) { return; }
        const n = e.sayilar ? Number(e.sayilar.bolum) || 0 : (((e.roman || {}).bolumler) || []).length;
        if (n > takip[e.id]) {
          self.registration.showNotification(String(e.ad || "Takip ettiğin evren").slice(0, 60) + ": yeni bölüm", {
            body: (n - takip[e.id]) + " yeni bölüm eklendi.", icon: "ikon/ikon-192.png", badge: "ikon/ikon-192.png",
            tag: "tf-takip-" + e.id, data: { adres: "/evren/" + String(e.id).replace(/[^\w-]/g, "") + "/" } });
          takip[e.id] = n;
        }
      });
      a.takip = takip;
    } catch (_) { /* çevrimdışı: bir dahaki sefere */ }
  }
  await ayarYaz(a);
}

self.addEventListener("periodicsync", function (e) {
  if (e.tag === "tf-gunluk") { e.waitUntil(gunlukKontrol()); }
});

/* Paylaşım hedefi (manifest share_target): telefonda bir .tentifor.html dosyası
   "Paylaş → TentiforApp" ile gönderilince buraya POST edilir. Dosya kısa süreli önbelleğe konur,
   sayfa #/fan/paylasim adresinde onu açar (js/core/42-mobil.js). */
self.addEventListener("fetch", function (e) {
  const u = new URL(e.request.url);
  if (e.request.method !== "POST" || u.origin !== location.origin || !/\/paylasim-al$/.test(u.pathname)) { return; }
  e.respondWith((async function () {
    try {
      const form = await e.request.formData();
      const dosya = form.get("dosya");
      if (dosya && typeof dosya !== "string" && dosya.size < 16 * 1024 * 1024) {
        const c = await caches.open("tf-paylasim");
        await c.put("/__paylasilan", new Response(dosya, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
        return Response.redirect("./#/fan/paylasim", 303);
      }
    } catch (_) { /* aşağıda */ }
    return Response.redirect("./#/fanAc", 303);
  })());
});

/* Önbellek stratejisi (2.4, çevrimdışı deneyim):
   - Sürümlü dosyalar (js/css ?v=özet) ve ikonlar hiç değişmez: önce önbellek (anında açılış, internetsiz de).
   - Sayfalar ve veri.json (3.0): cihazda kopyası varsa hemen o verilir, ağ arka planda tazeler (yeni paket
     yayındaysa sayfa kendini bir kez yeniler). Kopya yoksa önce ağ; ağ 3,5 sn içinde cevap vermezse son kopya.
   - Geri kalanı: önce ağ, yoksa son kopya. */
const AG_BEKLEME = 3500;
const AG_BEKLEME_YAVAS = 800;   /* az önce bir sayfa ağı bekleyip kopyaya düştüyse: ağ yavaş, veri için yine bekletme */
const AG_ISTEK_ZAMAN_ASIMI = 8000;
let yavasAgZamani = 0;

function guvenliFetch(istek, ayarlar) {
  /* Tarayıcı fetch'i bağlantı kurulmadan sonsuza kadar bekleyebilir. Service
     worker bu durumda ne cache cevabını ne de offline 503 cevabını döndürebilir. */
  const c = typeof AbortController === "function" ? new AbortController() : null;
  const o = Object.assign({}, ayarlar || {});
  if (c) o.signal = c.signal;
  const zaman = setTimeout(function () { if (c) c.abort(); }, AG_ISTEK_ZAMAN_ASIMI);
  return fetch(istek, o).finally(function () { clearTimeout(zaman); });
}

function onbellegeKoy(istek, yanit, sorguyla) {
  /* yönlendirilmiş yanıt önbellekten sayfa olarak verilemez (tarayıcı reddeder) */
  if (!yanit || !yanit.ok || yanit.type === "opaque" || yanit.redirected) { return; }
  const kopya = yanit.clone();
  const anahtar = new URL(istek.url);
  if (!sorguyla) { anahtar.search = ""; }   /* veri.json?v=... kopyayı şişirmesin */
  caches.open(ONBELLEK).then(function (c) { return c.put(anahtar.href, kopya); }).catch(function () { /* dolu */ });
}

function yedekKopya(istek) {
  return caches.match(istek, { ignoreSearch: true }).then(function (k) {
    if (k) { return k; }
    if (istek.mode === "navigate") { return caches.match("./").then(function (a) { return a || caches.match("index.html"); }); }
    return undefined;
  });
}

self.addEventListener("fetch", function (e) {
  const istek = e.request;
  const u = new URL(istek.url);
  if (istek.method !== "GET" || u.origin !== location.origin) { return; }
  if (u.pathname.indexOf("/__") === 0) { return; }
  if (u.pathname.indexOf("/api/") === 0) { return; }   /* sunucu fonksiyonları (functions/): kendi önbellekleri var */

  const surumlu = /^\/(?:js\/|css\/|veri-[a-z]+\.json$)/.test(u.pathname) && u.searchParams.has("v");
  if (surumlu || /^\/(?:ikon|yazitipi)\//.test(u.pathname)) {
    e.respondWith(caches.match(istek).then(function (k) {
      return k || guvenliFetch(istek).then(function (y) { onbellegeKoy(istek, y, true); return y; }).catch(function () { return yedekKopya(istek); });
    }));
    return;
  }

  const bekletme = istek.mode === "navigate" || /\/veri\.json$/.test(u.pathname);
  const ag = guvenliFetch(istek).then(function (y) { onbellegeKoy(istek, y, false); return y; });
  if (!bekletme) {
    e.respondWith(ag.catch(function () { return yedekKopya(istek); }));
    return;
  }
  e.waitUntil(ag.catch(function () { /* çevrimdışı */ }));
  /* 3.0 — ikinci açılış anında: cihazda kopyası olan sayfa ve veri beklemeden verilir, ağ arka planda
     kopyayı tazeler. Yayında yeni paket varsa sayfa bunu hemen fark edip bir kez yenilenir (js/core/46-guncelleme.js). */
  e.respondWith(caches.match(istek, { ignoreSearch: true }).then(function (kopya) {
    if (kopya) { return kopya; }
    return agiBekle(istek, ag);
  }));
});

function agiBekle(istek, ag) {
  return new Promise(function (coz) {
    let bitti = false;
    const yavas = Date.now() - yavasAgZamani < 30000;
    const sure = setTimeout(function () {
      yedekKopya(istek).then(function (k) {
        if (bitti) { return; }
        bitti = true;
        yavasAgZamani = Date.now();
        coz(k || new Response("Bağlantı yavaş. Sayfa çevrimdışı açılmayı denedi; yeniden dene.", {
          status: 504, headers: { "Content-Type": "text/plain; charset=utf-8" }
        }));
      });
    }, yavas ? AG_BEKLEME_YAVAS : AG_BEKLEME);
    ag.then(function (y) { if (!bitti) { bitti = true; clearTimeout(sure); yavasAgZamani = 0; coz(y); } })
      .catch(function () {
        clearTimeout(sure);
        yedekKopya(istek).then(function (k) {
          if (bitti) { return; }
          bitti = true;
          coz(k || new Response("Çevrimdışısın ve bu sayfa henüz cihazda yok.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
        });
      });
  });
}
