/* TentiforApp servis çalışanı — önce ağ, ağ yoksa son görülen kopya.
   Netlify'da yeni bir sürüm yayınlanınca sayfalar kendiliğinden yenilenir; eski kopya yalnızca çevrimdışıyken kullanılır. */
const ONBELLEK = "tentiforapp-1.0.0-58146def";
const ILK = ["./", "index.html", "css/style.css", "veri.json", "js/01-tanilama.js", "js/02-kripto.js", "js/03-cuzdan.js", "js/04-araclar-isim-takvim.js", "js/05-nobet.js", "js/06-karakter-oyunlari.js", "js/07-kisilik-ag-galeri.js", "js/08-kesif.js", "js/09-medya-harita.js", "js/10-kyldo-yazisi.js", "js/11-ek-katman.js", "js/12-dalga-2.js", "js/13-dalga-3.js", "js/14-dalga-4.js", "js/15-dalga-5.js", "js/16-yerinde-duzenleme.js", "js/17-dalga-6-aile.js", "js/18-dalga-7-gezinme.js", "js/19-dalga-8-kimlik.js", "js/20-dalga-9-brifing.js", "js/21-dalga-10-komut.js", "js/22-yonetici.js", "js/23-kanon-kilidi.js", "js/25-panel-roman-ses-basin.js", "js/26-ziyaret-yenilikleri.js", "js/27-kartlar.js", "js/28-hesap.js", "js/29-liderlik.js", "js/vendor/supabase-2.117.2.js", "js/24-arsiv-mantigi.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(ONBELLEK).then(function (c) { return c.addAll(ILK); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (anahtarlar) {
    return Promise.all(anahtarlar.filter(function (a) { return a !== ONBELLEK && a.indexOf("tentiforapp-") === 0; })
      .map(function (a) { return caches.delete(a); }));
  }).then(function () { return self.clients.claim(); }));
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
