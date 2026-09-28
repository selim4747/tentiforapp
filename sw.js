/* TentiforApp servis çalışanı — sayfa ve veri önce ağdan (yavaşsa son kopya), sürümlü dosyalar önbellekten.
   Yeni bir sürüm yayınlanınca sayfalar kendiliğinden yenilenir; eski kopya yalnızca çevrimdışı ya da yavaş ağda kullanılır. */
const ONBELLEK = "tentiforapp-2.4.0";
/* Hesap kütüphanesi burada yok: yalnızca hesabı kullanan indirir (ilk kullanımda önbelleğe girer). */
const ILK = ["./", "index.html", "css/style.css", "veri.json", "js/00-rota.js", "js/01-tanilama.js", "js/02-kripto.js", "js/03-cuzdan.js", "js/04-araclar-isim-takvim.js", "js/05-nobet.js", "js/06-karakter-oyunlari.js", "js/07-kisilik-ag-galeri.js", "js/08-kesif.js", "js/09-medya-harita.js", "js/10-kyldo-yazisi.js", "js/11-ek-katman.js", "js/12-dalga-2.js", "js/13-dalga-3.js", "js/14-dalga-4.js", "js/15-dalga-5.js", "js/16-yerinde-duzenleme.js", "js/17-dalga-6-aile.js", "js/18-dalga-7-gezinme.js", "js/19-dalga-8-kimlik.js", "js/20-dalga-9-brifing.js", "js/21-dalga-10-komut.js", "js/22-yonetici.js", "js/23-kanon-kilidi.js", "js/25-panel-roman-ses-basin.js", "js/26-ziyaret-yenilikleri.js", "js/27-kartlar.js", "js/28-hesap.js", "js/29-liderlik.js", "js/30-yarislar.js", "js/31-topluluk.js", "js/32-bakim.js", "js/33-claude-evreni.js", "js/34-seviye.js", "js/35-somdo-oyunlari.js", "js/36-canli.js", "js/37-okuma-toplulugu.js", "js/38-topluluk-ii.js", "js/39-yil-koleksiyon.js", "js/40-fan-atolye.js", "js/41-bildirim.js", "js/42-mobil.js", "js/43-kurulum.js", "js/44-evrenler.js", "js/45-evrengezer.js", "js/46-guncelleme.js", "js/47-e25-kisiler.js", "js/48-karsilama.js", "js/49-eg-magaza.js", "js/50-kelime-oyunu.js", "js/51-evren-oyunlari.js", "js/52-topluluk-iii.js", "js/53-evren-kurulum.js", "js/54-evren-dosyalari.js", "js/55-hatirlatma-takip.js", "js/56-harita-araclari.js", "js/57-sehir-yol.js", "js/58-yolculuklar.js", "js/59-harita-ekleri.js", "js/60-ag-zaman.js", "js/61-veri-denetim.js", "js/62-ilk-deneyim.js", "js/63-okuma-rozet.js", "js/64-seviye-kapilari.js", "js/65-yonetici-yukle.js", "js/66-gunluk-oyunlar.js", "js/67-claude-evreni-ii.js", "js/68-surum-2.js", "js/69-evren-uygulama.js", "js/70-evren-yazisi.js", "js/71-tek-kodlar.js", "js/72-surum-22.js", "js/73-evren-kod-stil.js", "js/74-surum-24.js", "js/75-surum-25.js", "js/76-rozet-baglari.js", "js/77-surum-26.js", "js/78-uygulama-kabugu.js", "js/79-surum-27.js", "manifest.webmanifest", "ikon/ikon-192.png", "js/24-arsiv-mantigi.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(ONBELLEK).then(function (c) { return c.addAll(ILK); }).then(function () { return self.skipWaiting(); }));
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
    return self.registration.showNotification(String(d.baslik || "TentiforApp").slice(0, 80), {
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
    await self.registration.showNotification("Günün kelimesi hazır", {
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
   sayfa #/fan/paylasim adresinde onu açar (js/42-mobil.js). */
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
   - Sayfalar ve veri.json: önce ağ, ama ağ 3,5 sn içinde cevap vermezse (zayıf bağlantı) son kopya; ağ cevabı
     gelince önbellek yine tazelenir, bir sonraki açılış günceldir.
   - Geri kalanı: önce ağ, yoksa son kopya. */
const AG_BEKLEME = 3500;
const AG_BEKLEME_YAVAS = 800;   /* az önce bir sayfa ağı bekleyip kopyaya düştüyse: ağ yavaş, veri için yine bekletme */
let yavasAgZamani = 0;

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

  const surumlu = /^\/(?:js|css)\//.test(u.pathname) && u.searchParams.has("v");
  if (surumlu || /^\/ikon\//.test(u.pathname)) {
    e.respondWith(caches.match(istek).then(function (k) {
      return k || fetch(istek).then(function (y) { onbellegeKoy(istek, y, true); return y; }).catch(function () { return yedekKopya(istek); });
    }));
    return;
  }

  const bekletme = istek.mode === "navigate" || /\/veri\.json$/.test(u.pathname);
  const ag = fetch(istek).then(function (y) { onbellegeKoy(istek, y, false); return y; });
  if (!bekletme) {
    e.respondWith(ag.catch(function () { return yedekKopya(istek); }));
    return;
  }
  e.waitUntil(ag.catch(function () { /* çevrimdışı */ }));
  e.respondWith(new Promise(function (coz) {
    let bitti = false;
    const yavas = Date.now() - yavasAgZamani < 30000;
    const sure = setTimeout(function () {
      yedekKopya(istek).then(function (k) { if (k && !bitti) { bitti = true; yavasAgZamani = Date.now(); coz(k); } });
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
  }));
});
