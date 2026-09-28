/* Sürüm 2.7 testleri: okuma ayarları, odak modu, isme dokun, altını çiz ve Defterin, Bugün kartı ve seri,
   Harita Avı, liderlik listelerinin Cloudflare fonksiyonu (functions/api/pano.js) ve sitede Supabase'e geri dönüş.
   tests/calistir.mjs çağırır. */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { yeniSahte } = require("./supabase-taklidi.cjs");
const TEST_URL = "https://test.supabase.co";

export async function surum27Testleri({ adres, veritabani, dizin, kok }) {
  const sahte = yeniSahte(veritabani);
  const hesapKod = readFileSync(dizin + "/js/28-hesap.js", "utf8").replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, TEST_URL);
  const hatalar = [];
  let gecen = 0;
  const ok = function (ad, kosul, ek) {
    if (!kosul) { throw new Error("BAŞARISIZ: " + ad + (ek !== undefined ? " → " + JSON.stringify(ek) : "")); }
    gecen++; console.log("  tamam: " + ad);
  };

  /* ---------- Cloudflare fonksiyonu (tarayıcısız) ---------- */
  console.log("2.7 liderlik fonksiyonu");
  const pano = await import(pathToFileURL((kok || dizin + "/..") + "/functions/api/pano.js").href);
  const istekler = [];
  const eskiFetch = globalThis.fetch;
  const onbellek = new Map();
  globalThis.caches = { default: {
    match: async function (r) { const y = onbellek.get(r.url); return y ? y.clone() : undefined; },
    put: async function (r, y) { onbellek.set(r.url, y); }
  } };
  globalThis.fetch = async function (u, o) {
    istekler.push({ u: String(u), apikey: o && o.headers && o.headers.apikey });
    return new Response(JSON.stringify([{ kullanici_adi: "ayse", gorunen_ad: "Ayşe", haftalik: 40 }]), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const ctx = function (u) { return { request: new Request(u), waitUntil: function (p) { return p; } }; };
    const y1 = await pano.onRequestGet(ctx("https://site.test/api/pano?t=haftalik"));
    const j1 = await y1.json();
    ok("fonksiyon liderlik görünümünü okur (publishable key, sıralı, 20 satır)", y1.status === 200 && j1.t === "haftalik" && j1.veri[0].kullanici_adi === "ayse" &&
      /\/rest\/v1\/liderlik\?select=kullanici_adi,gorunen_ad,haftalik&haftalik=gt\.0&order=haftalik\.desc,guncelleme\.asc&limit=20$/.test(istekler[0].u) && /^sb_publishable_/.test(istekler[0].apikey), { j1, istekler });
    ok("yanıt önbelleğe uygun (10 dakika)", /max-age=600/.test(y1.headers.get("cache-control")));
    await pano.onRequestGet(ctx("https://site.test/api/pano?t=haftalik"));
    ok("ikinci istek Supabase'e gitmez (önbellekten)", istekler.length === 1, istekler.length);
    const y2 = await pano.onRequestGet(ctx("https://site.test/api/pano?t=topluluk"));
    const j2 = await y2.json();
    ok("topluluk: iki tablo tek yanıtta", Array.isArray(j2.veri) && j2.veri.length === 2 && istekler.length === 3);
    const y3 = await pano.onRequestGet(ctx("https://site.test/api/pano?t=profiller"));
    ok("listede olmayan tablo okunmaz", y3.status === 404 && istekler.length === 3);
    globalThis.fetch = async function () { return new Response("hata", { status: 500 }); };
    const y4 = await pano.onRequestGet(ctx("https://site.test/api/pano?t=kulupler"));
    ok("Supabase hata verirse önbelleğe hata yazılmaz", y4.status === 502 && !onbellek.has("https://site.test/api/pano?t=kulupler") && /no-store/.test(y4.headers.get("cache-control")));
  } finally {
    globalThis.fetch = eskiFetch;
    delete globalThis.caches;
  }

  const tarayici = await chromium.launch(process.env.CHROMIUM_YOLU ? { executablePath: process.env.CHROMIUM_YOLU } : {});
  const bekle = function (p, ms) { return p.waitForTimeout(ms || 600); };
  async function cihaz(ad, secenek) {
    const ctx = await tarayici.newContext(Object.assign({ viewport: { width: 1100, height: 900 }, serviceWorkers: "block" }, secenek || {}));
    await ctx.addInitScript(function () {
      try {
        localStorage.setItem("tentiforapp_tur", "bitti"); localStorage.setItem("tentiforapp_baslangic_oto", "kapali");
        localStorage.setItem("tentiforapp_seviye_test", "20"); localStorage.setItem("tentiforapp_hesap_hatirlat", JSON.stringify({ kapat: true }));
      } catch (e) { /* yok */ }
      window.__okumaOnbellegiKapali = true;
      /* kanon kilidi testte açık */
      const t = setInterval(function () {
        if (typeof kanonErisim === "function") { window.kanonErisim = function () { return { hepsi: true, tumEvren: true, bolumler: new Set(), evrenler: new Set() }; }; clearInterval(t); }
      }, 20);
    });
    await ctx.route(/\/js\/28-hesap\.js(\?|$)/, function (r) { return r.fulfill({ status: 200, contentType: "application/javascript", body: hesapKod }); });
    await ctx.route(TEST_URL + "/**", function (r) { return sahte.isle(r); });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, function (r) { return r.abort(); });
    const p = await ctx.newPage();
    p.on("pageerror", function (e) { hatalar.push(ad + ": " + e.message); });
    return p;
  }

  try {
    console.log("2.7 okuma ayarları ve odak modu");
    const O = await cihaz("okur", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await O.goto(adres + "/"); await bekle(O, 1500);
    await O.evaluate(function () { location.hash = "#/karakter/tari"; }); await bekle(O, 1500);
    ok("uzun metnin üstünde Aa ve Odak", await O.locator("#perde .ok-arac [data-oka-ac]").count() === 1 && await O.locator("#perde .ok-arac [data-odak-ac]").count() === 1);
    const once = await O.evaluate(function () { return parseFloat(getComputedStyle(document.querySelector("#perde .detay-metin")).fontSize); });
    await O.click("#perde [data-oka-ac]"); await bekle(O, 200);
    await O.click('[data-oka-boyut="1"]'); await O.click('[data-oka-boyut="1"]');
    await O.click('[data-oka="zemin"][data-deger="gece"]'); await O.click('[data-oka="aralik"][data-deger="2"]'); await bekle(O, 200);
    const sonra = await O.evaluate(function () {
      const el = document.querySelector("#perde .detay-metin"), cs = getComputedStyle(el);
      return { px: parseFloat(cs.fontSize), zemin: cs.backgroundColor, satir: parseFloat(cs.lineHeight), kayit: JSON.parse(localStorage.getItem("tf27_okuma")) };
    });
    ok("yazı büyür, gece zemini ve satır aralığı uygulanır", Math.abs(sonra.px - once * 1.25) < 0.6 && sonra.zemin === "rgb(22, 24, 29)" && sonra.satir >= sonra.px * 1.9, { once, sonra });
    ok("ayar bu cihazda (eşitlemeye girmeyen anahtarla) saklanır", sonra.kayit && sonra.kayit.boyut === 3 && sonra.kayit.zemin === "gece", sonra.kayit);
    await O.goto(adres + "/"); await bekle(O, 1500);   /* yerel test sunucusu /karakter/…/ yolunu vermez (Cloudflare verir) */
    const yen = await O.evaluate(function () { return { zemin: document.documentElement.getAttribute("data-ok-zemin"), olcek: document.documentElement.style.getPropertyValue("--ok-olcek"), kayit: localStorage.getItem("tf27_okuma") }; });
    ok("yenileyince ayar kalır", yen.zemin === "gece" && yen.olcek === "1.25", yen);
    await O.evaluate(function () { location.hash = "#/karakter/tari"; }); await bekle(O, 1500);
    await O.click("#perde [data-oka-ac]"); await O.click("[data-oka-sifirla]"); await bekle(O, 200);
    ok("sıfırla", await O.evaluate(function () { return !document.documentElement.hasAttribute("data-ok-zemin") && !document.documentElement.hasAttribute("data-ok-olcek"); }));
    await O.keyboard.press("Escape"); await bekle(O, 150);
    ok("Esc ayar panelini kapatır, pencereyi değil", await O.evaluate(function () { return !document.querySelector("#okaPanel") && !document.querySelector("#perde").hidden; }));
    await O.click("#perde [data-odak-ac]"); await bekle(O, 300);
    ok("odak modu: çubuklar gizli, çıkış düğmesi var", await O.evaluate(function () {
      return document.documentElement.hasAttribute("data-odak") && getComputedStyle(document.querySelector(".ust")).display === "none" && !!document.querySelector(".odak-cik");
    }));
    await O.keyboard.press("Escape"); await bekle(O, 200);
    ok("Esc önce odaktan çıkarır, pencere açık kalır", await O.evaluate(function () { return !document.documentElement.hasAttribute("data-odak") && !document.querySelector(".odak-cik") && !document.querySelector("#perde").hidden; }));
    await O.click("#perde [data-odak-ac]"); await bekle(O, 200);
    await O.evaluate(function () { location.hash = "#/arsiv"; }); await bekle(O, 500);
    ok("sayfa değişince odak kapanır", await O.evaluate(function () { return !document.documentElement.hasAttribute("data-odak"); }));

    console.log("2.7 isme dokun");
    await O.evaluate(function () { location.hash = "#/karakter/tari"; }); await bekle(O, 1500);
    const ad = await O.evaluate(function () {
      const h = CSS.highlights.get("tf-ad");
      const l = h ? Array.from(h).map(function (r) { return r.toString(); }) : [];
      return { l: l, tek: new Set(l).size === l.length };
    });
    ok("metindeki adların altı çizilir, her ad bir kez, sıradan sözcük değil", ad.l.indexOf("Egir") !== -1 && ad.tek && !ad.l.some(function (x) { return /^[a-zçğıöşü]/.test(x); }), ad);
    const nokta = await O.evaluate(function () {
      const r = Array.from(CSS.highlights.get("tf-ad")).find(function (x) { return x.toString() === "Egir"; });
      r.startContainer.parentElement.scrollIntoView({ block: "center" });
      const k = r.getBoundingClientRect();
      return { x: k.left + k.width / 2, y: k.top + k.height / 2 };
    });
    await O.mouse.click(nokta.x, nokta.y); await bekle(O, 300);
    const kart = await O.evaluate(function () { const k = document.querySelector(".ad-kart"); return k ? k.textContent : null; });
    ok("ada dokununca kart: tür, ad, okuma durumu", kart && /Karakter/.test(kart) && /Egir/.test(kart) && /Kaydını (henüz okumadın|okudun)/.test(kart), kart);
    await O.keyboard.press("Escape"); await bekle(O, 150);
    ok("Esc kartı kapatır, pencere açık kalır", await O.evaluate(function () { return !document.querySelector(".ad-kart") && !document.querySelector("#perde").hidden; }));
    await O.mouse.click(nokta.x, nokta.y); await bekle(O, 200);
    await O.click("[data-ad-kart-git]"); await bekle(O, 1500);
    ok("kaydına git: o karakterin kaydı açılır", await O.evaluate(function () { return /#\/karakter\/egir|\/karakter\/egir/.test(location.href) && /Egir/.test(document.querySelector("#perde h3, #perde h2").textContent); }));

    console.log("2.7 altını çiz ve Defterin");
    await O.evaluate(function () { location.hash = "#/karakter/tari"; }); await bekle(O, 1500);
    await O.evaluate(function () {
      const el = document.querySelector("#perde .detay-metin p");
      const t = Array.from(el.childNodes).find(function (n) { return n.nodeType === 3 && n.data.length > 40; });
      const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 30);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      vurguSecimDenetle();
    });
    ok("seçimde altını çiz balonu", await O.locator(".vurgu-balon").count() === 1);
    await O.click(".vurgu-balon"); await bekle(O, 400);
    const v = await O.evaluate(function () { return vurguListesi(); });
    ok("vurgu kaynağı ve yeriyle kaydedilir", v.length === 1 && v[0].oku === "kar:tari" && /karakter\/tari/.test(v[0].git) && v[0].kaynak, v);
    ok("vurgu metinde işaretli", await O.evaluate(function () { const h = CSS.highlights.get("tf-vurgu"); return !!h && h.size === 1; }));
    await O.evaluate(function () { perdeKapat(); location.hash = "#/sen"; }); await bekle(O, 800);
    await O.evaluate(function () { document.querySelector("#defter").scrollIntoView(); vurgularimCiz(); }); await bekle(O, 500);
    ok("Defterin'de vurgu: yerinde oku, kart, sil", await O.locator("#vurguAlan [data-vurgu-git]").count() === 1 && await O.locator("#vurguAlan [data-vurgu-kart]").count() === 1 && await O.locator("#vurguAlan [data-vurgu-sil]").count() === 1);
    const png = await O.evaluate(async function () { const t = await vurguKartiUret(vurguListesi()[0]); const b = await kartBlob(t); return { en: t.width, boy: t.height, tur: b.type, boyut: b.size }; });
    ok("alıntı kartı PNG üretilir", png.en === 1080 && png.boy === 1350 && png.tur === "image/png" && png.boyut > 20000, png);
    await O.click("#vurguAlan [data-vurgu-git]"); await bekle(O, 2200);
    ok("yerinde oku: kayıt açılır, vurgu görünür", await O.evaluate(function () { return !document.querySelector("#perde").hidden && /Tarı/.test(document.querySelector("#perde").textContent) && CSS.highlights.get("tf-vurgu").size === 1; }));
    await O.evaluate(function () { perdeKapat(); location.hash = "#/sen"; }); await bekle(O, 800);
    await O.evaluate(function () { vurgularimCiz(); }); await O.click("#vurguAlan [data-vurgu-sil]"); await bekle(O, 300);
    ok("vurgu silinir", await O.evaluate(function () { return vurguListesi().length === 0 && CSS.highlights.get("tf-vurgu").size === 0; }));

    console.log("2.7 bugün kartı, seri, Harita Avı");
    await O.evaluate(function () {
      const g = function (n) { return new Date(Date.parse(oyunXpGunu() + "T00:00:00Z") - n * 86400000).toISOString().slice(0, 10); };
      /* dün, önceki gün, 4 gün önce (3 gün önce kaçırıldı: buz kalıbı), 5, 6 gün önce; 9 gün önce ayrı */
      [1, 2, 4, 5, 6, 9].forEach(function (n) { cuzdan.acilan.push("oxp_" + g(n) + "_tomye|kim"); });
      cuzdanKaydet();
      location.hash = "#/oyunlar";
    }); await bekle(O, 900);
    const s1 = await O.evaluate(function () { return { s: seriDurumu(), kart: document.querySelector("#oyunBugun") && document.querySelector("#oyunBugun").textContent }; });
    ok("seri: bugün oynanmadan dünden sayılır, haftada bir kaçırılan gün bozmaz", s1.s.seri === 5 && !s1.s.bugunOynandi && s1.s.buzKalibi && s1.s.enUzun === 5 && s1.s.unvan && s1.s.unvan[1] === "Kıvılcım", s1.s);
    ok("Bugün kartı: oyunlar, seri, Harita Avı", s1.kart && /🔥 5 gün/.test(s1.kart) && /Günün kelimesi/.test(s1.kart) && /Harita Avı/.test(s1.kart) && /Seri bugün bir oyun kazanınca sürer/.test(s1.kart), s1.kart);
    await O.click('[data-bugun-git="havi"]'); await bekle(O, 1200);
    const h = await O.evaluate(function () { const d = haviDurum(); return { ad: d.y.ad, x: d.y.x, y: d.y.y, ipucu: document.querySelector("#haviAlan .havi-ipucu").textContent, xp: oyunXpBugun() }; });
    ok("Harita Avı açılır: ipucunda yerin adı gizli", h.ipucu && h.ipucu.indexOf(h.ad) === -1, h);
    const kutu = await O.locator("#haviAlan svg").boundingBox();
    const tikla = function (x, y) { return O.mouse.click(kutu.x + kutu.width * x / 100, kutu.y + kutu.height * y / 100); };
    await tikla(h.x > 50 ? 5 : 95, h.y > 50 ? 5 : 95); await bekle(O, 200);
    const d1 = await O.evaluate(function () { return { t: haviDurum().tahmin, durum: document.querySelector("#haviAlan .havi-durum").textContent }; });
    ok("uzak tahmin: soğuk ya da ılık, hak azalır", d1.t.length === 1 && /(Soğuk|Ilık)/.test(d1.durum) && /4 hakkın kaldı/.test(d1.durum), d1);
    await O.goto(adres + "/"); await bekle(O, 1500);
    await O.evaluate(function () { location.hash = "#/oyunlar"; }); await bekle(O, 600);
    await O.click('[data-bugun-git="havi"]'); await bekle(O, 1200);
    ok("tahminler yenileyince kalır (aynı gün)", await O.evaluate(function () { return haviDurum().tahmin.length === 1; }));
    const kutu2 = await O.locator("#haviAlan svg").boundingBox();
    await O.mouse.click(kutu2.x + kutu2.width * h.x / 100, kutu2.y + kutu2.height * h.y / 100); await bekle(O, 400);
    const d2 = await O.evaluate(function () { return { d: haviDurum(), xp: oyunXpBugun(), kart: document.querySelector("#oyunBugun").textContent, s: seriDurumu() }; });
    ok("yerinde tahmin: buldun, oyun XP'si, seri bugünle 6", d2.d.kazandi && d2.d.bitti && d2.xp === h.xp + 10 && d2.s.seri === 6 && d2.s.bugunOynandi && /🔥 6 gün/.test(d2.kart), { xp: d2.xp, s: d2.s });
    ok("bitince haritaya tahmin yapılamaz", await O.evaluate(function () { return !document.querySelector("#haviAlan [data-havi-harita]"); }));

    console.log("2.7 liderlik: fonksiyon yoksa Supabase");
    const L = await cihaz("lider");
    await L.goto(adres + "/"); await bekle(L, 1200);
    await L.evaluate(function () { location.hash = "#/liderlik"; }); await bekle(L, 1500);
    await L.evaluate(async function () { await hesapKutuphaneYukle(); }); await bekle(L, 2500);
    await L.evaluate(function () { liderlikCiz(); }); await bekle(L, 1500);
    const l1 = await L.evaluate(function () { return { pano: LIDERLIK_PANO.yok, icerik: (document.querySelector("#liderlikIcerik") || {}).textContent || "" }; });
    ok("yerelde /api/pano yok: liderlik Supabase'den yüklenir", l1.pano === true && !/Yükleniyor|Yüklenemedi/.test(l1.icerik) && l1.icerik.length > 5, l1);
    await L.click('[data-lider="kulupler"]'); await bekle(L, 1200);
    ok("kulüpler de yüklenir", await L.evaluate(function () { const t = document.querySelector("#liderlikIcerik").textContent; return !/Yükleniyor|Yüklenemedi/.test(t) && t.length > 5; }));
    await L.click('[data-lider="topluluk"]'); await bekle(L, 1200);
    ok("topluluk da yüklenir", await L.evaluate(function () { const t = document.querySelector("#liderlikIcerik").textContent; return !/Yükleniyor|Yüklenemedi/.test(t) && t.length > 5; }));
    await L.route("**/api/pano?t=haftalik", function (r) {
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ t: "haftalik", zaman: new Date().toISOString(), veri: [{ kullanici_adi: "panodan", gorunen_ad: "Panodan Gelen", haftalik: 99 }] }) });
    });
    await L.evaluate(function () { LIDERLIK_PANO.yok = false; liderlikSecili = "haftalik"; liderlikCiz(); }); await bekle(L, 1200);
    ok("fonksiyon varsa liste oradan gelir", await L.evaluate(function () { return /Panodan Gelen/.test(document.querySelector("#liderlikIcerik").textContent); }));

    ok("2.7 testlerinde sayfa hatası yok", hatalar.length === 0, hatalar);
  } finally {
    await tarayici.close();
    await sahte.pool.end().catch(function () { /* kapalı */ });
  }
  return gecen;
}
