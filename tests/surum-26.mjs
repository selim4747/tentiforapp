/* Sürüm 2.6 testleri: okuma yolları, çevrimdışı okuma paketi, ortak yazarlık işaretleri, panel sağlık ekranı.
   tests/calistir.mjs çağırır. */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { yeniSahte } = require("./supabase-taklidi.cjs");
const TEST_URL = "https://test.supabase.co";

export async function surum26Testleri({ adres, veritabani, dizin }) {
  const sahte = yeniSahte(veritabani);
  const hesapKod = readFileSync(dizin + "/js/28-hesap.js", "utf8").replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, TEST_URL);
  const hatalar = [];
  let gecen = 0;
  const ok = function (ad, kosul, ek) {
    if (!kosul) { throw new Error("BAŞARISIZ: " + ad + (ek !== undefined ? " → " + JSON.stringify(ek) : "")); }
    gecen++; console.log("  tamam: " + ad);
  };
  const tarayici = await chromium.launch(process.env.CHROMIUM_YOLU ? { executablePath: process.env.CHROMIUM_YOLU } : {});
  const bekle = function (p, ms) { return p.waitForTimeout(ms || 600); };
  async function cihaz(ad) {
    const ctx = await tarayici.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
    await ctx.addInitScript(function () {
      try {
        localStorage.setItem("tentiforapp_tur", "bitti"); localStorage.setItem("tentiforapp_baslangic_oto", "kapali");
        localStorage.setItem("tentiforapp_seviye_test", "20"); localStorage.setItem("tentiforapp_hesap_hatirlat", JSON.stringify({ kapat: true }));
      } catch (e) { /* yok */ }
      window.__okumaOnbellegiKapali = true;
    });
    await ctx.route(/\/js\/28-hesap\.js(\?|$)/, function (r) { return r.fulfill({ status: 200, contentType: "application/javascript", body: hesapKod }); });
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
    console.log("2.6 okuma yolları ve çevrimdışı paket");
    const O = await cihaz("okur");
    await O.goto(adres + "/"); await bekle(O, 1800);
    await O.evaluate(function () { if (typeof kanonErisim === "function") { window.kanonErisim = function () { return { hepsi: true, tumEvren: true, bolumler: new Set(), evrenler: new Set() }; }; } });
    const yol = await O.evaluate(function () {
      const l = okumaYollari();
      const y = l.find(function (x) { return /^kar:/.test(x.id); });
      return { sayi: l.length, id: y && y.id, adim: y && y.adimlar.length, dakika: y && y.dakika, ce: l.some(function (x) { return /^ce:/.test(x.id); }) };
    });
    ok("karakterler ve Claude kişileri için okuma yolları kurulur", yol.sayi >= 3 && yol.id && yol.adim >= 3 && yol.dakika >= 1 && yol.ce, yol);
    await O.evaluate(function () { location.hash = "#/sen"; }); await bekle(O, 800);
    ok("Sen sayfasında okuma yolları ve çevrimdışı okuma", await O.evaluate(function () {
      const t = (document.querySelector("#ayar25Alan") || {}).textContent || "";
      return /Okuma yolları/.test(t) && /Çevrimdışı okuma/.test(t) && !!document.querySelector("#ayar25Alan [data-yol-basla]");
    }));
    await O.evaluate(function (id) { document.querySelectorAll("#ayar25Alan details").forEach(function (d) { d.open = true; }); document.querySelector('#ayar25Alan [data-yol-basla="' + id + '"]').click(); }, yol.id);
    await bekle(O, 900);
    ok("yol başlayınca sıradaki kutuya gidilir, çubuk görünür", await O.evaluate(function () {
      const c = document.querySelector("#yolCubugu"); return !!c && /Sıradaki/.test(c.textContent) && /0\//.test(c.textContent);
    }), await O.evaluate(function () { return [(document.querySelector("#yolCubugu") || {}).textContent, location.hash]; }));
    const bitis = await O.evaluate(function () {
      const y = yolAktif();
      y.adimlar.slice(0, -1).forEach(function (a) { okunduIsaretle(a.anahtar); });
      const el = document.createElement("div"); el.setAttribute("data-oku", y.adimlar[y.adimlar.length - 1].anahtar); document.body.appendChild(el);
      okumaBitti(y.adimlar[y.adimlar.length - 1].anahtar, el);
      el.remove();
      return { aktif: !!yolAktif(), cubuk: !!document.querySelector("#yolCubugu"), rozet: rozetDurumu(veri.karakterler.find(function (k) { return "kar:" + k.id === y.id; })) };
    });
    ok("yol bitince çubuk kalkar, karakter rozeti gelir", !bitis.aktif && !bitis.cubuk && bitis.rozet === "gumus", bitis);
    ok("karakter penceresinde okuma yolu düğmesi", await O.evaluate(function () {
      const k = veri.karakterler.find(function (x) { return x.kart !== false && okumaYolu("kar:" + x.id) && yolIlerleme(okumaYolu("kar:" + x.id)).sonraki; });
      return !!k && /Okuma yolu/.test(rozetKutusuHtml(k));
    }));
    const paket = await O.evaluate(async function () { const s = await paketIndir(null); return { s: s, indirilen: Object.keys(evdIndirilenler()).length, toplam: paketEvrenleri().length }; });
    ok("çevrimdışı paket: bütün fan evrenleri cihaza iner", paket.toplam >= 1 && paket.s.tamam === paket.toplam && paket.indirilen === paket.toplam, paket);
    await O.evaluate(function () { ayar25Ciz(); }); await bekle(O, 300);
    ok("paket inince 'hepsi cihazda' yazar", /bütün fan evrenleri cihazda/.test(await O.textContent("#ayar25Alan")));

    console.log("2.6 ortak yazarlık işaretleri");
    const K = await cihaz("kurucu");
    await kayitOl(K, "Kurucu", "kurucu26", "k26@ornek.test");
    const eid = await K.evaluate(function () {
      const id = evrenYeniKur();
      evrenBenimDegistir(id, function (e) { e.ad = "İşaretli Kıyı"; e.roman = { baslik: "", ozet: "", bolumler: [{ id: "b1", baslik: "Bir", metin: "Birinci." }] }; });
      return id;
    });
    await K.evaluate(function (id) { location.hash = "#/ev/benim/" + id; }, eid); await bekle(K, 800);
    await K.evaluate(function () { EVS.sekme = "bilgi"; evrenSayfaCiz(); }); await bekle(K, 300);
    await K.click("#evrenSayfa [data-ortak-ac]"); await bekle(K, 1500);
    await K.click("#evrenSayfa [data-ortak-davet]"); await bekle(K, 1200);
    const davet = await K.inputValue("#ortakDavetKod");
    const Y = await cihaz("yazar");
    await kayitOl(Y, "Ayşe", "ayse26", "y26@ornek.test");
    await Y.evaluate(function (k) { kodPenceresi(); kodDene(k); }, davet); await bekle(Y, 2500);
    await Y.evaluate(function () { EVS.sekme = "roman"; evrenSayfaCiz(); }); await bekle(Y, 200);
    await Y.evaluate(function (id) { evrenBenimDegistir(id, function (e) { e.roman.bolumler.push({ id: "b2", baslik: "İki", metin: "İkinci bölüm." }); }); }, eid); await bekle(Y, 3800);
    ok("giden kayıt kim ve hangi sekme bilgisini taşır", (await sahte.kokSorgu("select veri->'ortakIz'->>'kim' kim, veri->'ortakIz'->>'sekme' sekme from public.ortak_evrenler where id = $1", [eid])).rows[0].sekme === "roman");
    await K.evaluate(function (id) { GCM.son = {}; return ortakCek(id); }, eid); await bekle(K, 800);
    const oi = await K.evaluate(async function (id) {
      evrenSayfaCiz();
      const g = (JSON.parse(localStorage.getItem("tentiforapp_ortak_gunluk") || "{}")[id] || [])[0] || {};
      const s = (document.querySelector("#evrenSayfa .oi-serit") || {}).textContent || "";
      const l = await gcmListe(id);
      return { kim: g.kim, alanlar: g.alanlar, serit: s, gecmis: l.map(function (x) { return x.neden; }) };
    }, eid);
    ok("değişiklik günlüğü: kim ve hangi bölüm", oi.kim === "Ayşe" && (oi.alanlar || []).indexOf("roman") !== -1, oi);
    ok("evren sayfasında son değiştiren ve sekmesi", /Ayşe/.test(oi.serit) && /Roman sekmesinde/.test(oi.serit), oi);
    ok("sürüm geçmişinde kimin değişikliğinden önceki hâl", oi.gecmis.some(function (n) { return /Ayşe'in değişikliğinden önce/.test(n); }), oi);
    ok("ortak yazarlık kutusunda değişiklik günlüğü", await K.evaluate(function () { return /Değişiklik günlüğü/.test((document.querySelector("#evrenSayfa .ortak-kutu") || {}).textContent || ""); }));

    console.log("2.6 panel sağlık ekranı");
    await sahte.kokSorgu("insert into public.yoneticiler (id) select id from auth.users where email = 'k26@ornek.test' on conflict do nothing");
    await K.evaluate(function () { evrenSayfaKapat(); window.yoneticiAcik = function () { return true; }; location.hash = "#/sen"; YON24.soruldu = false; yoneticiGrup = "bakim"; yoneticiSekme = "hatalar"; yoneticiCiz(); }); await bekle(K, 2000);
    await K.evaluate(function () { yon24SeritKoy(); }); await bekle(K, 300);
    const sg = await K.evaluate(function () {
      const k = document.querySelector("#yoneticiAlan .saglik-kutu");
      return k ? { satir: k.querySelectorAll(".sg-satir").length, metin: k.textContent } : null;
    });
    ok("panelde site sağlığı: altı gösterge", sg && sg.satir === 6 && /Supabase kurulumu/.test(sg.metin) && /Yayındaki sürüm/.test(sg.metin) && /Son yedek/.test(sg.metin), sg);
    ok("sağlık: kurulum güncel görünür", await K.evaluate(function () { return !!document.querySelector("#yoneticiAlan .saglik-kutu .sg-satir.sg-iyi"); }));
    ok("2.6 testlerinde sayfa hatası yok", hatalar.length === 0, hatalar);
  } finally {
    await tarayici.close();
    await sahte.pool.end().catch(function () { /* kapalı */ });
  }
  return gecen;
}
