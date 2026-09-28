/* Sürüm 2.8 testleri: yazarken arama kutusu yerinde kalır; panelde yalnızca yayındaki sürümün hataları; kesintisiz dinleme;
   Harita Atlası; haftalık bulmaca; okuma hedefi ve haftalık özet; kısayollar ve hatırlatmalar; kendi okuma yolun;
   karakter zaman çizgisi; erişilebilirlik (ızgara, odak). tests/calistir.mjs çağırır. */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { yeniSahte } = require("./supabase-taklidi.cjs");
const TEST_URL = "https://test.supabase.co";

export async function surum28Testleri({ adres, veritabani, dizin }) {
  const sahte = yeniSahte(veritabani);
  const hatalar = [];
  let gecen = 0;
  const ok = function (ad, kosul, ek) {
    if (!kosul) { throw new Error("BAŞARISIZ: " + ad + (ek !== undefined ? " → " + JSON.stringify(ek) : "")); }
    gecen++; console.log("  tamam: " + ad);
  };
  const tarayici = await chromium.launch(process.env.CHROMIUM_YOLU ? { executablePath: process.env.CHROMIUM_YOLU } : {});
  const bekle = function (p, ms) { return p.waitForTimeout(ms || 600); };

  async function cihaz(ad, secenek) {
    const s = secenek || {};
    const ctx = await tarayici.newContext(Object.assign({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" }, s.ctx || {}));
    await ctx.addInitScript(function (uygulama) {
      try {
        localStorage.setItem("tentiforapp_tur", "bitti"); localStorage.setItem("tentiforapp_baslangic_oto", "kapali");
        localStorage.setItem("tentiforapp_seviye_test", "20"); localStorage.setItem("tentiforapp_hesap_hatirlat", JSON.stringify({ kapat: true }));
      } catch (e) { /* yok */ }
      window.__okumaOnbellegiKapali = true;
      /* ses motoru: her cümle 20 ms sürer */
      window.__soylenen = [];
      const ses = { speak: function (u) { window.__soylenen.push({ t: u.text, hiz: u.rate }); setTimeout(function () { if (u.onend) { u.onend({}); } }, 20); },
        cancel: function () {}, getVoices: function () { return []; }, addEventListener: function () {}, removeEventListener: function () {} };
      Object.defineProperty(window, "speechSynthesis", { value: ses, configurable: true, writable: true });
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
      const t = setInterval(function () {
        if (typeof kanonErisim === "function") { window.kanonErisim = function () { return { hepsi: true, tumEvren: true, bolumler: new Set(), evrenler: new Set() }; }; clearInterval(t); }
      }, 20);
      if (uygulama) {
        window.__bildirim = []; window.__iptal = [];
        window.Capacitor = { isNativePlatform: function () { return true; }, getPlatform: function () { return "android"; }, Plugins: {
          App: { addListener: function () {}, getLaunchUrl: async function () { return { url: "https://tentiforapp.pages.dev/uygulama/ac/?kisayol=bugun" }; }, getInfo: async function () { return { build: "999" }; } },
          LocalNotifications: {
            checkPermissions: async function () { return { display: "granted" }; }, requestPermissions: async function () { return { display: "granted" }; },
            schedule: async function (o) { window.__bildirim = window.__bildirim.concat(o.notifications); }, cancel: async function (o) { window.__iptal = window.__iptal.concat(o.notifications); },
            addListener: function () {} },
          KeepAwake: { keepAwake: async function () { window.__uyanik = true; }, allowSleep: async function () { window.__uyanik = false; } }
        } };
      }
    }, !!s.uygulama);
    await ctx.route(/\/js\/(?:28-hesap|paket-\d+)\.js(\?|$)/, function (r) { return r.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(dizin + new URL(r.request().url()).pathname, "utf8").replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, TEST_URL) }); });
    await ctx.route(TEST_URL + "/**", function (r) { return sahte.isle(r); });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, function (r) { return r.abort(); });
    const p = await ctx.newPage();
    p.on("pageerror", function (e) { hatalar.push(ad + ": " + e.message); });
    return p;
  }
  async function kayitOl(p, ad, kadi, eposta) {
    await p.goto(adres + "/"); await bekle(p, 1200);
    await p.click("#hesapBtn");
    await p.click('#perde [data-hesap-pencere="kayit"]');
    await p.fill("#hKayitAd", ad); await p.fill("#hKayitKullanici", kadi);
    await p.fill("#hKayitEposta", eposta); await p.fill("#hKayitSifre", "tomye-2026");
    await p.click('[data-hesap-form="kayit"] button[type=submit]'); await bekle(p, 800);
    await p.goto(adres + "/?code=" + encodeURIComponent(eposta) + "&hesap=onay#/sen"); await bekle(p, 2500);
  }

  try {
    console.log("2.8 arama: yazarken kutu yerinde kalır");
    const O = await cihaz("okur");
    await O.goto(adres + "/"); await bekle(O, 1500);
    await O.evaluate(function () { komutPaletiAc(); }); await bekle(O, 200);
    await O.evaluate(function () { window.__ilkKutu = document.querySelector("#komutGiris"); });
    await O.keyboard.type("kyl", { delay: 40 }); await bekle(O, 150);
    ok("komut paleti: her harfte aynı kutu, odak kutuda, sonuçlar yenilenir", await O.evaluate(function () {
      const g = document.querySelector("#komutGiris");
      return g === window.__ilkKutu && document.activeElement === g && g.value === "kyl" && document.querySelectorAll("#komutListe [data-komut-index]").length > 0;
    }));
    await O.keyboard.press("Escape"); await bekle(O, 300);
    await O.evaluate(function () { location.hash = "#/araclar"; }); await bekle(O, 900);
    await O.evaluate(function () { document.querySelector("#isimKartAlan").scrollIntoView(); if (typeof isimKartCiz === "function") { isimKartCiz(); } window.__ilkKutu = document.querySelector("#isimKartGiris"); window.__ilkKutu.focus(); });
    await O.keyboard.type("Selim", { delay: 60 }); await bekle(O, 500);
    ok("isim kartı: her harfte aynı kutu, odak kutuda, seçenekler gelir", await O.evaluate(function () {
      const g = document.querySelector("#isimKartGiris");
      return g === window.__ilkKutu && document.activeElement === g && g.value === "Selim" && document.querySelectorAll("#isimKartAlan [data-isim-kart-yol]").length > 0;
    }));

    console.log("2.8 kesintisiz dinleme");
    await O.evaluate(function () { location.hash = "#/karakter/tari"; }); await bekle(O, 1500);
    await O.evaluate(function () { document.querySelector("#perde .sesli-dugme").click(); }); await bekle(O, 60);
    const d1 = await O.evaluate(function () { return { cubuk: !!document.querySelector("#sesCubuk"), isaret: CSS.highlights.get("tf-sesli") ? CSS.highlights.get("tf-sesli").size : 0, dugme: document.querySelector("#perde .sesli-dugme").textContent, cumle: SES.cumleler.length }; });
    ok("dinle: cümle cümle, okunan cümle işaretli, çubuk ve Durdur", d1.cubuk && d1.isaret === 1 && /Durdur/.test(d1.dugme) && d1.cumle >= 5, d1);
    await O.click('#sesCubuk [data-dinle="hiz"]'); await bekle(O, 80);
    await O.click('#sesCubuk [data-dinle="uyku"]'); await bekle(O, 50);
    const d2 = await O.evaluate(function () { return { hiz: sesAyar().hiz, uyku: sesAyar().uyku, sonHiz: __soylenen[__soylenen.length - 1].hiz, metin: document.querySelector("#sesCubuk").textContent }; });
    ok("hız ve uyku zamanlayıcısı", d2.hiz === 1.1 && d2.sonHiz === 1.1 && d2.uyku === "15" && /15 dk/.test(d2.metin), d2);
    await bekle(O, 1500);
    const d3 = await O.evaluate(function () { return { aktif: SES.aktif, cubuk: !!document.querySelector("#sesCubuk"), metinler: __soylenen.map(function (x) { return x.t; }) }; });
    const perdeMetni = await O.evaluate(function () { return document.querySelector("#perde .detay-metin").textContent.replace(/\s+/g, " "); });
    ok("metin bitince durur; yalnızca pencerenin metni okunur (arkadaki sayfaya geçmez)", !d3.aktif && !d3.cubuk && d3.metinler.every(function (t) { return perdeMetni.indexOf(t.slice(0, 20)) !== -1; }), d3.metinler.slice(-3));
    await O.evaluate(function () { tf28Yaz("tf28_ses", {}); });

    console.log("2.8 karakter zaman çizgisi");
    const kz = await O.evaluate(function () { const k = document.querySelector("#perde .karakter-zaman"); return k ? { n: document.querySelectorAll("#perde .karakter-zaman").length, adim: k.querySelectorAll(".kz-adim").length, cag: k.querySelectorAll(".kz-cag").length } : null; });
    ok("karakter penceresinde zaman çizgisi (çağlarıyla)", kz && kz.n === 1 && kz.adim >= 2 && kz.cag >= 1, kz);
    await O.evaluate(function () { okumaBitti("kar:tari", document.querySelector("#perde .detay-metin")); }); await bekle(O, 300);
    ok("rozet kutusu yenilenince zaman çizgisi çoğalmaz", await O.evaluate(function () { return document.querySelectorAll("#perde .karakter-zaman").length === 1; }));
    await O.click("#perde .kz-git"); await bekle(O, 1200);
    ok("zaman adımına dokununca açılır", await O.evaluate(function () { return /zaman/.test(location.pathname + location.hash) || !!document.querySelector("#zaman:not([hidden])"); }));

    console.log("2.8 haftalık bulmaca");
    await O.evaluate(function () { if (typeof perdeKapat === "function") { perdeKapat(); } location.hash = "#/oyunlar"; }); await bekle(O, 900);
    await O.click('[data-bugun-git="bulmaca"]'); await bekle(O, 1200);
    const b1 = await O.evaluate(function () { const s = bulmacaDurum(); return { kelime: s.b.kelimeler.length, hucre: Object.keys(s.b.hucre).length, input: document.querySelectorAll("#haftaBulmaca [data-bul]").length, hafta: s.d.hafta, imza: s.b.kelimeler.map(function (w) { return w.k; }).join(",") }; });
    ok("bulmaca kurulur: en az 4 kesişen kelime, her hücre bir kutu", b1.kelime >= 4 && b1.hucre === b1.input && /^\d{4}-H\d{2}$/.test(b1.hafta), b1);
    const ilk = await O.evaluate(function () { const w = bulmacaDurum().b.kelimeler.find(function (x) { return x.yatay; }); document.querySelector('[data-bul-git="' + w.x + "," + w.y + ',1"]').click(); window.__h = document.activeElement; return w; });
    await O.keyboard.type(ilk.k.slice(0, 2).toLocaleLowerCase("tr"), { delay: 50 });
    ok("yazınca büyük harf olur, sıradaki kutuya geçer, klavye açık kalır", await O.evaluate(function (w) {
      const a = document.activeElement;
      return a && a.getAttribute("data-bul") === (w.x + 2) + "," + w.y && document.querySelector('[data-bul="' + w.x + "," + w.y + '"]').value === w.k[0] && !!window.__h.isConnected;
    }, ilk));
    await O.evaluate(function () { const s = bulmacaDurum(); Object.keys(s.b.hucre).forEach(function (a) { const el = document.querySelector('[data-bul="' + a + '"]'); el.value = s.b.hucre[a]; el.dispatchEvent(new Event("input", { bubbles: true })); }); });
    const x0 = await O.evaluate(function () { return oyunXpBugun(); });
    const yanlis = await O.evaluate(function () { const a = Object.keys(bulmacaDurum().b.hucre)[0]; const el = document.querySelector('[data-bul="' + a + '"]'); const d = el.value; el.value = d === "A" ? "B" : "A"; el.dispatchEvent(new Event("input", { bubbles: true })); return { a: a, d: d }; });
    await O.click("[data-bul-kontrol]"); await bekle(O, 200);
    ok("yanlış harf işaretlenir, çözülmez", await O.evaluate(function (y) { return document.querySelector('[data-bul="' + y.a + '"]').classList.contains("yanlis") && !bulmacaDurum().d.cozuldu; }, yanlis));
    await O.evaluate(function (y) { const el = document.querySelector('[data-bul="' + y.a + '"]'); el.value = y.d; el.dispatchEvent(new Event("input", { bubbles: true })); }, yanlis);
    await O.click("[data-bul-kontrol]"); await bekle(O, 200);
    ok("doğru çözülünce XP ve Bugün kartında ✓", await O.evaluate(function (x0) { return bulmacaDurum().d.cozuldu && oyunXpBugun() === x0 + 10 && /✓\s*Haftanın bulmacası/.test(document.querySelector("#oyunBugun").textContent); }, x0));
    const B = await cihaz("baska");
    await B.goto(adres + "/"); await bekle(B, 1500);
    ok("aynı hafta herkese aynı bulmaca", await B.evaluate(function () { return bulmacaDurum().b.kelimeler.map(function (w) { return w.k; }).join(","); }) === b1.imza);

    console.log("2.8 Harita Atlası ve ızgara");
    await O.click('[data-bugun-git="havi"]'); await bekle(O, 1000);
    await O.click("[data-havi-izgara]"); await bekle(O, 150);
    ok("Harita Avı ızgarayla oynanır (25 adlandırılmış düğme, odak ızgarada)", await O.evaluate(function () {
      const l = document.querySelectorAll("#haviAlan [data-havi-hucre]");
      return l.length === 25 && /satır 1, sütun 1/.test(l[0].getAttribute("aria-label")) && document.activeElement === l[0];
    }));
    await O.evaluate(function () { const d = haviDurum(); const x = Math.min(4, Math.floor(d.y.x / 20)), y = Math.min(4, Math.floor(d.y.y / 20)); document.querySelector('[data-havi-hucre="' + (x * 20 + 10) + "," + (y * 20 + 10) + '"]').click(); }); await bekle(O, 200);
    ok("ızgaradan tahmin sayılır", await O.evaluate(function () { return haviDurum().tahmin.length === 1; }));
    await O.evaluate(function () { const d = haviDurum(); haviTahminNokta(d.y.x, d.y.y); }); await bekle(O, 300);
    const at = await O.evaluate(function () { const d = haviDurum(); const h = atlasHaritalari().find(function (x) { return x.id === d.harita; }); return { kazandi: d.kazandi, bulunan: atlasDurum(h).bulunan, kayit: cuzdan.acilan.indexOf("atlas:" + d.harita + ":" + d.yer) !== -1, serbest: document.querySelectorAll("#atlasAlan [data-atlas-serbest]").length }; });
    ok("bulunan yer atlasa işlenir (eşitlenen kayıtta), serbest tur açılır", at.kazandi && at.bulunan === 1 && at.kayit && at.serbest >= 1, at);
    const x1 = await O.evaluate(function () { return oyunXpBugun(); });
    await O.evaluate(function () { document.querySelector("#atlasAlan [data-atlas-serbest]").click(); }); await bekle(O, 300);
    await O.evaluate(function () { serbestTahmin(SERBEST.d.y.x, SERBEST.d.y.y); }); await bekle(O, 200);
    ok("serbest tur: XP'siz, bulunan yer atlasa", await O.evaluate(function (x1) { const h = SERBEST.d.h; return SERBEST.d.kazandi && oyunXpBugun() === x1 && atlasDurum(h).yerler.some(function (y) { return y.id === SERBEST.d.yer; }); }, x1));

    console.log("2.8 okuma hedefi ve haftalık özet");
    await O.evaluate(function () { location.hash = "#/sen"; }); await bekle(O, 900);
    await O.evaluate(function () { document.querySelector("#haftaKart").scrollIntoView(); }); await O.click('#haftaKart [data-okuma-hedef="10"]'); await bekle(O, 150);
    await O.evaluate(function () { const g = {}; g[yerelGun()] = 600; tf28Yaz("tf28_okuma", g); haftaKartiCiz(); });
    const hk = await O.evaluate(function () { return { hedef: tf28Oku("tf28_hedef", 0), metin: document.querySelector("#haftaKart").textContent, cubuk: document.querySelectorAll("#haftaKart .hafta-gun").length, tamam: document.querySelectorAll("#haftaKart .hafta-gun.tamam").length }; });
    ok("hedef seçilir, bu hafta 7 gün, hedefe ulaşan gün işaretli", hk.hedef === 10 && hk.cubuk === 7 && hk.tamam === 1 && /Bugün 10 \/ 10 dk ✓/.test(hk.metin) && /10 dk okuma/.test(hk.metin), hk);
    const png = await O.evaluate(async function () { const t = await haftaKartiUret(); const b = await kartBlob(t); return { en: t.width, tur: b.type, boyut: b.size }; });
    ok("haftanın kartı PNG", png.en === 1080 && png.tur === "image/png" && png.boyut > 20000, png);
    await O.evaluate(function () { OKH.tazelendi = 0; OKU.sonEtkinlik = Date.now(); location.hash = "#/karakter/necale"; }); await bekle(O, 3500);
    ok("okurken dakika sayılır (bu cihazda)", await O.evaluate(function () { return (tf28Oku("tf28_okuma", {})[yerelGun()] || 0) > 600; }));

    console.log("2.8 kendi okuma yolun");
    await O.evaluate(function () { perdeKapat(); location.hash = "#/sen"; }); await bekle(O, 900);
    await O.evaluate(function () { ayar25Ciz(); document.querySelectorAll("#ayar25Alan details").forEach(function (d) { d.open = true; }); document.querySelector("[data-ozy-yeni]").click(); }); await bekle(O, 200);
    await O.fill("#ozyAd", "Kütüphane gecesi");
    await O.click("#ozyAra"); await O.evaluate(function () { window.__ara = document.querySelector("#ozyAra"); });
    await O.keyboard.type("tar", { delay: 40 }); await bekle(O, 150);
    ok("yol ararken kutu yerinde, sonuçlar gelir", await O.evaluate(function () { return document.activeElement === window.__ara && document.querySelectorAll("#ozySonuc [data-ozy-ekle]").length >= 2; }));
    await O.evaluate(function () { document.querySelector("#ozySonuc [data-ozy-ekle]").click(); }); await O.evaluate(function () { document.querySelector("#ozySonuc [data-ozy-ekle]").click(); });
    await O.evaluate(function () { document.querySelector('[data-ozy-asagi="0"]').click(); });
    await O.click("[data-ozy-kaydet]"); await bekle(O, 400);
    const yol = await O.evaluate(function () { const y = ozelYollar()[0]; return { y: y, link: yolBaglantisi(y), yolNesne: okumaYolu("oz:" + y.id), listede: !!document.querySelector('#ozelYolAlan [data-yol-basla="oz:' + y.id + '"]') }; });
    ok("yol kaydedilir, sıralanır ve listede Başla", yol.y.ad === "Kütüphane gecesi" && yol.y.a.length === 2 && yol.yolNesne && yol.yolNesne.adimlar.length === 2 && yol.listede, yol);
    await O.click('#ozelYolAlan [data-yol-basla^="oz:"]'); await bekle(O, 1200);
    ok("özel yola başlanır (okuma yolu çubuğu)", await O.evaluate(function () { const y = yolAktif(); return !!y && /^oz:/.test(y.id); }));
    await B.goto(yol.link); await bekle(B, 2500);
    ok("bağlantıyla paylaşılan yol başka cihaza gelir, adres temizlenir", await B.evaluate(function () { return ozelYollar().length === 1 && ozelYollar()[0].ad === "Kütüphane gecesi" && ozelYollar()[0].a.length === 2 && !/yol=/.test(location.search); }));

    console.log("2.8 kısayollar ve hatırlatmalar");
    await B.goto(adres + "/?kisayol=bugun"); await bekle(B, 2200);
    ok("?kisayol=bugun: Oyunlar'daki Bugün kartı, adres temizlenir", await B.evaluate(function () { return rota() === "#/oyunlar" && !/kisayol/.test(location.search); }));
    const U = await cihaz("uygulama", { uygulama: true });
    await U.goto(adres + "/"); await bekle(U, 2500);
    ok("uygulama simgesi kısayoluyla açılış (getLaunchUrl) Bugün'e gider", await U.evaluate(function () { return rota() === "#/oyunlar"; }));
    await U.evaluate(function () {
      const g = function (n) { return new Date(Date.parse(oyunXpGunu() + "T00:00:00Z") - n * 86400000).toISOString().slice(0, 10); };
      [1, 2].forEach(function (n) { cuzdan.acilan.push("oxp_" + g(n) + "_tomye|kim"); });
      cuzdanKaydet(); tf28Yaz("tf28_hedef", 20);
    });
    await U.evaluate(function () { return hatirlatmaAyarla(true); }); await bekle(U, 300);
    const bl = await U.evaluate(function () { return { l: __bildirim.map(function (b) { return { id: b.id, t: b.title, k: b.extra && b.extra.kisayol, saat: new Date(b.schedule.at).getHours() }; }), iptal: __iptal.map(function (x) { return x.id; }) }; });
    const saat = new Date().getHours();
    const beklenen = [saat < 20 || (saat === 20 && new Date().getMinutes() < 29) ? 7200 : null, saat < 21 ? 7201 : null].filter(Boolean);
    ok("uygulamada seri ve okuma hedefi hatırlatması kurulur (önceki iptal edilir)", beklenen.every(function (id) { return bl.l.some(function (b) { return b.id === id; }); }) && bl.iptal.indexOf(7200) !== -1, bl);
    await U.evaluate(function () { __bildirim = []; jsonYaz(SESSIZ25, { bas: 0, bit: 23 }); return hatirlatmalariKur(); }); await bekle(U, 200);
    ok("sessiz saatlerde hatırlatma kurulmaz", await U.evaluate(function () { return __bildirim.length === 0; }));
    await U.evaluate(function () { jsonYaz(SESSIZ25, null); __bildirim = []; return hatirlatmaAyarla(false); }); await bekle(U, 200);
    ok("kapatınca kurulmaz", await U.evaluate(function () { return __bildirim.length === 0 && !hatirlatmaAcik(); }));
    await U.evaluate(function () { location.hash = "#/karakter/tari"; }); await bekle(U, 1500);
    await U.evaluate(function () { document.querySelector("#perde [data-odak-ac]").click(); }); await bekle(U, 200);
    ok("uygulamada odak modunda ekran açık kalır (KeepAwake)", await U.evaluate(function () { return window.__uyanik === true; }));

    console.log("2.8 panel: yalnızca yayındaki sürümün hataları");
    const K = await cihaz("yonetici", { ctx: { viewport: { width: 1100, height: 900 }, isMobile: false, hasTouch: false } });
    await kayitOl(K, "Kurucu", "kurucu28", "k28@ornek.test");
    await sahte.kokSorgu("insert into public.yoneticiler (id) select id from auth.users where email = 'k28@ornek.test' on conflict do nothing");
    const surum = await K.evaluate(function () { return veri.surum; });
    await sahte.kokSorgu("select public.hata_kaydet('eski sürümün hatası 28', 'a.js:1', '/', 'test', '2.0.0')");
    await sahte.kokSorgu("select public.hata_kaydet('yeni sürümün hatası 28', 'a.js:1', '/', 'test', $1)", [surum]);
    await K.evaluate(function () { window.yoneticiAcik = function () { return true; }; location.hash = "#/sen"; yoneticiGrup = "bakim"; yoneticiSekme = "hatalar"; yoneticiCiz(); }); await bekle(K, 2000);
    const ht = await K.evaluate(function () { return (document.querySelector("#yHataAlan") || {}).textContent || ""; });
    ok("hatalar sekmesinde yalnızca v" + surum + " hataları", /yeni sürümün hatası 28/.test(ht) && !/eski sürümün hatası 28/.test(ht) && new RegExp("v" + surum.replace(/\./g, "\\.")).test(ht), ht.slice(0, 300));
    await K.evaluate(function () { YON24.soruldu = false; YON24.hata = null; return yon24Sor(); }); await bekle(K, 800);
    ok("24 saat özeti de yalnızca bu sürüm", await K.evaluate(function () { return (YON24.hata || []).every(function (h) { return h.surum === veri.surum; }) && (YON24.hata || []).some(function (h) { return /yeni sürümün hatası 28/.test(h.mesaj); }); }));

    ok("2.8 testlerinde sayfa hatası yok", hatalar.length === 0, hatalar);
  } finally {
    await tarayici.close();
    await sahte.pool.end().catch(function () { /* kapalı */ });
  }
  return gecen;
}
