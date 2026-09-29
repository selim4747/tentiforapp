/* TentiforApp servis çalışanı — sayfa ve veri önce ağdan (yavaşsa son kopya), sürümlü dosyalar önbellekten.
   Yeni bir sürüm yayınlanınca sayfalar kendiliğinden yenilenir; eski kopya yalnızca çevrimdışı ya da yavaş ağda kullanılır. */
const ONBELLEK = "tentiforapp-v4.3";
/* Hesap kütüphanesi burada yok: yalnızca hesabı kullanan indirir (ilk kullanımda önbelleğe girer). */
const ILK = ["./", "index.html", "css/style.css", "veri.json", "js/core/00-rota.js", "js/core/01-tanilama.js", "js/core/02-kripto.js", "js/core/03-cuzdan.js", "js/arsiv/04-araclar-isim-takvim.js", "js/oyun/05-nobet.js", "js/oyun/06-karakter-oyunlari.js", "js/arsiv/07-kisilik-ag-galeri.js", "js/arsiv/08-kesif.js", "js/arsiv/09-medya-harita.js", "js/arsiv/10-kyldo-yazisi.js", "js/arsiv/11-ek-katman.js", "js/arsiv/12-yankilar-okuma-sirasi.js", "js/arsiv/13-arsivci-karti-hikaye.js", "js/arsiv/14-rol-yolu-mektuplar.js", "js/arsiv/15-ziyaretci-notlar.js", "js/admin/16-yerinde-duzenleme.js", "js/arsiv/17-aile-agaci.js", "js/arayuz/18-gezinme.js", "js/arsiv/19-kimlik-sinavi.js", "js/arsiv/20-brifing-zaman.js", "js/arayuz/21-komut-sohbet-moodboard.js", "js/admin/22-yonetici.js", "js/admin/22b-yonetici-araclari.js", "js/arsiv/23-kanon-kilidi.js", "js/admin/25-panel-roman-ses-basin.js", "js/arsiv/26-ziyaret-yenilikleri.js", "js/arsiv/27-kartlar.js", "js/core/28-hesap.js", "js/oyun/29-liderlik.js", "js/oyun/30-yarislar.js", "js/topluluk/31-topluluk.js", "js/admin/32-bakim.js", "js/arsiv/33-claude-evreni.js", "js/oyun/34-seviye.js", "js/arsiv/35-somdo-oyunlari.js", "js/oyun/36-canli.js", "js/arsiv/37-okuma-toplulugu.js", "js/topluluk/38-topluluk-ii.js", "js/arsiv/39-yil-koleksiyon.js", "js/studio/40-fan-atolye.js", "js/topluluk/41-bildirim.js", "js/core/42-mobil.js", "js/admin/43-kurulum.js", "js/engine/44-evrenler.js", "js/engine/45-evrengezer.js", "js/core/46-guncelleme.js", "js/engine/47-e25-kisiler.js", "js/arayuz/48-karsilama.js", "js/engine/49-eg-magaza.js", "js/oyun/50-kelime-oyunu.js", "js/engine/51-evren-oyunlari.js", "js/topluluk/52-topluluk-iii.js", "js/studio/53-evren-kurulum.js", "js/engine/54-evren-dosyalari.js", "js/topluluk/55-hatirlatma-takip.js", "js/engine/56-harita-araclari.js", "js/engine/57-sehir-yol.js", "js/engine/58-yolculuklar.js", "js/engine/59-harita-ekleri.js", "js/engine/60-ag-zaman.js", "js/admin/61-veri-denetim.js", "js/arsiv/62-ilk-deneyim.js", "js/arsiv/63-okuma-rozet.js", "js/oyun/64-seviye-kapilari.js", "js/admin/65-yonetici-yukle.js", "js/oyun/66-gunluk-oyunlar.js", "js/arsiv/67-claude-evreni-ii.js", "js/engine/68-coklu-evren.js", "js/engine/69-evren-uygulama.js", "js/engine/70-evren-yazisi.js", "js/topluluk/71-tek-kodlar.js", "js/arayuz/72-sayfa-duzeni.js", "js/engine/73-evren-kod-stil.js", "js/admin/74-yonetim-kurulum.js", "js/admin/75-yonetim-yetkileri.js", "js/arsiv/76-rozet-baglari.js", "js/arsiv/77-okuma-yollari.js", "js/core/78-uygulama-kabugu.js", "js/arsiv/79-okur-ayarlari.js", "js/arsiv/80-okur-oyuncu.js", "js/core/81-hiz-veri-parcalari.js", "js/studio/82-evren-kurucu.js", "js/studio/83-evren-atolyesi.js", "js/studio/84-evren-araclari.js", "js/engine/85-e25-ana-sayfa-evrenler.js", "js/arayuz/86-sade-arayuz.js", "js/studio/87-yildiz-sablon-okuma.js", "js/core/supabase.js", "js/core/state.js", "js/core/auth.js", "js/core/odeme.js", "js/core/reklam.js", "js/engine/evren-motoru.js", "js/studio/editor.js", "js/studio/paketleyici.js", "js/admin/moderasyon.js", "manifest.webmanifest", "ikon/ikon-192.png", "yazitipi/karla-normal-400-latin.woff2", "js/core/24-arsiv-mantigi.js"];

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

  const surumlu = /^\/(?:js\/|css\/|veri-[a-z]+\.json$)/.test(u.pathname) && u.searchParams.has("v");
  if (surumlu || /^\/(?:ikon|yazitipi)\//.test(u.pathname)) {
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
  });
}
