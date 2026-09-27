/* TentiforApp servis çalışanı — önce ağ, ağ yoksa son görülen kopya.
   Yeni bir sürüm yayınlanınca sayfalar kendiliğinden yenilenir; eski kopya yalnızca çevrimdışıyken kullanılır. */
const ONBELLEK = "tentiforapp-1.2.0-claude";
/* Hesap kütüphanesi burada yok: yalnızca hesabı kullanan indirir (ilk kullanımda önbelleğe girer). */
const ILK = ["./", "index.html", "css/style.css", "veri.json", "js/00-rota.js", "js/01-tanilama.js", "js/02-kripto.js", "js/03-cuzdan.js", "js/04-araclar-isim-takvim.js", "js/05-nobet.js", "js/06-karakter-oyunlari.js", "js/07-kisilik-ag-galeri.js", "js/08-kesif.js", "js/09-medya-harita.js", "js/10-kyldo-yazisi.js", "js/11-ek-katman.js", "js/12-dalga-2.js", "js/13-dalga-3.js", "js/14-dalga-4.js", "js/15-dalga-5.js", "js/16-yerinde-duzenleme.js", "js/17-dalga-6-aile.js", "js/18-dalga-7-gezinme.js", "js/19-dalga-8-kimlik.js", "js/20-dalga-9-brifing.js", "js/21-dalga-10-komut.js", "js/22-yonetici.js", "js/23-kanon-kilidi.js", "js/25-panel-roman-ses-basin.js", "js/26-ziyaret-yenilikleri.js", "js/27-kartlar.js", "js/28-hesap.js", "js/29-liderlik.js", "js/30-yarislar.js", "js/31-topluluk.js", "js/32-bakim.js", "js/33-claude-evreni.js", "js/34-seviye.js", "js/35-somdo-oyunlari.js", "js/36-canli.js", "js/37-okuma-toplulugu.js", "js/38-topluluk-ii.js", "js/39-yil-koleksiyon.js", "js/40-fan-atolye.js", "js/41-bildirim.js", "js/42-mobil.js", "js/43-kurulum.js", "js/44-evrenler.js", "js/45-evrengezer.js", "js/46-guncelleme.js", "js/47-e25-kisiler.js", "js/48-karsilama.js", "js/49-eg-magaza.js", "js/50-kelime-oyunu.js", "js/51-evren-oyunlari.js", "js/52-topluluk-iii.js", "js/53-evren-kurulum.js", "js/54-evren-dosyalari.js", "js/55-hatirlatma-takip.js", "js/56-harita-araclari.js", "js/57-sehir-yol.js", "js/58-yolculuklar.js", "js/59-harita-ekleri.js", "js/60-ag-zaman.js", "js/61-veri-denetim.js", "js/62-ilk-deneyim.js", "js/63-okuma-rozet.js", "js/64-seviye-kapilari.js", "js/65-yonetici-yukle.js", "js/66-gunluk-oyunlar.js", "js/67-claude-evreni-ii.js", "js/68-surum-2.js", "js/69-evren-uygulama.js", "js/70-evren-yazisi.js", "js/71-tek-kodlar.js", "manifest.webmanifest", "ikon/ikon-192.png", "js/24-arsiv-mantigi.js"];

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
  e.waitUntil(self.registration.showNotification(String(d.baslik || "TentiforApp").slice(0, 80), {
    body: String(d.metin || "").slice(0, 200), icon: "ikon/ikon-192.png", badge: "ikon/ikon-192.png",
    tag: "tentifor-bildirim", data: { adres: d.adres || "/" }
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

async function gunlukKontrol() {
  const a = await ayarOku();
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

self.addEventListener("fetch", function (e) {
  const istek = e.request;
  if (istek.method !== "GET" || new URL(istek.url).origin !== location.origin) { return; }
  e.respondWith(
    fetch(istek).then(function (yanit) {
      if (yanit && yanit.ok) {
        /* sorgu dizesi (veri.json?v=...) kopyayı şişirmesin: adres sorgusuz saklanır */
        const kopya = yanit.clone();
        const anahtar = new URL(istek.url); anahtar.search = "";
        caches.open(ONBELLEK).then(function (c) { c.put(anahtar.href, kopya); });
      }
      return yanit;
    }).catch(function () {
      return caches.match(istek, { ignoreSearch: true }).then(function (k) { return k || caches.match("index.html"); });
    })
  );
});
