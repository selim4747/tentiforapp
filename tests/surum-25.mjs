/* Sürüm 2.5 testleri: yayın paketini (dist/) gerçek Chromium'da açar; Supabase istekleri gerçek PostgreSQL'e gider
   (tests/supabase-taklidi.cjs). tests/calistir.mjs tarafından çağrılır; tek başına da çalışır (aşağıya bak). */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { yeniSahte } = require("./supabase-taklidi.cjs");
const TEST_URL = "https://test.supabase.co";

export async function surum25Testleri({ adres, veritabani, dizin }) {
  const sahte = yeniSahte(veritabani);
  const hatalar = [];
  let gecen = 0;
  const ok = function (ad, kosul, ek) {
    if (!kosul) { throw new Error("BAŞARISIZ: " + ad + (ek !== undefined ? " → " + JSON.stringify(ek) : "")); }
    gecen++;
    console.log("  tamam: " + ad);
  };
  const tarayici = await chromium.launch(process.env.CHROMIUM_YOLU ? { executablePath: process.env.CHROMIUM_YOLU } : {});
  const bekle = function (p, ms) { return p.waitForTimeout(ms || 600); };

  async function cihaz(ad, genis) {
    const ctx = await tarayici.newContext({ viewport: genis ? { width: 1200, height: 900 } : { width: 420, height: 1000 }, serviceWorkers: "block", acceptDownloads: true });
    await ctx.addInitScript(function () {
      try {
        localStorage.setItem("tentiforapp_tur", "bitti"); localStorage.setItem("tentiforapp_baslangic_oto", "kapali");
        localStorage.setItem("tentiforapp_seviye_test", "20"); localStorage.setItem("tentiforapp_hesap_hatirlat", JSON.stringify({ kapat: true }));
      } catch (e) { /* yok */ }
      window.__olayTest = true; window.__okumaOnbellegiKapali = true;
    });
    await ctx.route(/\/js\/(?:28-hesap|paket-\d+)\.js(\?|$)/, function (r) { return r.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(dizin + new URL(r.request().url()).pathname, "utf8").replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, TEST_URL) }); });
    await ctx.route(TEST_URL + "/**", function (r) { return sahte.isle(r); });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, function (r) { return r.abort(); });
    const p = await ctx.newPage();
    p.on("pageerror", function (e) { if (!/sandboxed and lacks the 'allow-same-origin'/.test(e.message)) { hatalar.push(ad + ": " + e.message); } });
    p.on("console", function (m) {
      const cerceve = (m.location() || {}).url === "about:srcdoc" || /Content Security Policy/.test(m.text());
      if (m.type() === "error" && !cerceve && !/Failed to load resource|ERR_FAILED|fonts\.g/.test(m.text())) { hatalar.push(ad + " konsol: " + m.text()); }
    });
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
  const sorgu = async function (sql, par) { return (await sahte.kokSorgu(sql, par)).rows; };

  try {
    /* ---------- kurucu: evren, önizleme, sürüm geçmişi ---------- */
    console.log("2.5 kurucu");
    const K = await cihaz("kurucu");
    await kayitOl(K, "Kurucu", "kurucu25", "k25@ornek.test");
    const eid = await K.evaluate(function () {
      const id = evrenYeniKur();
      evrenBenimDegistir(id, function (e) {
        e.ad = "Ortak Kıyı";
        e.ozet = "Tuzla kaplı bir kıyı.";
        e.kisiler = [{ id: "k1", ad: "Arvel", not: "kaptan" }];
        e.harita = { yerler: [{ id: "y1", ad: "Norak", x: 30, y: 40 }, { id: "y2", ad: "Pelin", x: 70, y: 60 }] };
        e.roman = { baslik: "Kıyı", ozet: "", bolumler: [{ id: "b1", baslik: "Liman", metin: "Birinci bölüm." }, { id: "b2", baslik: "Fener", metin: "İkinci bölüm." }, { id: "b3", baslik: "Dönüş", metin: "Üçüncü bölüm." }] };
        const is = {}; Array.from("abcçdefgğhıijklmnoöprsştuüvyz").forEach(function (h, i) { is[h] = "M" + i + " 0L" + (i + 5) + " 60"; });
        e.yazi = { tur: "alfabe", isaretler: is };
      });
      return id;
    });
    ok("kurucu evren kurar", !!eid);
    await K.evaluate(function (id) { location.hash = "#/ev/benim/" + id; }, eid); await bekle(K, 800);
    await K.click('#evrenSayfa [data-evs-sekme="bilgi"]'); await bekle(K, 400);
    ok("bilgi sekmesinde önizleme, ortak yazarlık, sürüm geçmişi, istatistik", await K.evaluate(function () {
      return !!document.querySelector("#evrenSayfa [data-ev-onizle]") && !!document.querySelector("#evrenSayfa .ortak-kutu") &&
        !!document.querySelector("#evrenSayfa .gcm-kutu") && !!document.querySelector("#evrenSayfa .evi-kutu");
    }));
    await K.click("#evrenSayfa .y25-kurucu [data-ev-onizle]"); await bekle(K, 500);
    ok("önizleme: ziyaretçi gözü, düzenleme sekmeleri yok, ödül yok", await K.evaluate(function () {
      const t = Array.from(document.querySelectorAll("#evrenSayfa [data-evs-sekme]")).map(function (x) { return x.dataset.evsSekme; });
      return EVS.onizle === true && EVS.kaynak === "fan" && !!document.querySelector("#evrenSayfa .onizle-serit") && t.indexOf("stil") === -1 && t.indexOf("kodstil") === -1 &&
        /Önizlemede ödül yok/.test(evoOdulEngeli()) && !document.querySelector("#evrenSayfa .y25-kurucu");
    }), await K.evaluate(function () {
      return { kaynak: EVS.kaynak, serit: !!document.querySelector("#evrenSayfa .onizle-serit"), sekmeler: Array.from(document.querySelectorAll("#evrenSayfa [data-evs-sekme]")).map(function (x) { return x.dataset.evsSekme; }),
        odul: evoOdulEngeli(), kurucu: !!document.querySelector("#evrenSayfa .y25-kurucu") };
    }));
    await K.click("#evrenSayfa [data-ev-onizle-cik]"); await bekle(K, 400);
    ok("önizlemeden düzenlemeye dönülür", await K.evaluate(function () { return EVS.kaynak === "benim"; }));

    await K.evaluate(function (id) {
      GCM.son = {};
      evrenBenimDegistir(id, function (e) { e.ad = "Yanlış Ad"; });
    }, eid); await bekle(K, 500);
    await K.evaluate(function () { evrenSayfaCiz(); }); await bekle(K, 200);
    await K.evaluate(function () { document.querySelector("#evrenSayfa .gcm-kutu").open = true; }); await bekle(K, 700);
    ok("sürüm geçmişinde önceki hâl listelenir", await K.locator("#gcmListe [data-gcm-don]").count() >= 1);
    await K.click("#gcmListe [data-gcm-don]"); await K.click("#gcmListe [data-gcm-don]"); await bekle(K, 700);
    ok("geri alınca eski ad döner, yanlış hâl de geçmişe düşer", await K.evaluate(async function (id) {
      const l = await gcmListe(id);
      return evrenBenimBul(id).ad === "Ortak Kıyı" && l.some(function (x) { return /Yanlış Ad/.test(x.veri); });
    }, eid));

    /* ---------- ortak yazarlık ---------- */
    console.log("2.5 ortak yazarlık");
    await K.evaluate(function () { EVS.sekme = "bilgi"; evrenSayfaCiz(); }); await bekle(K, 300);
    await K.click("#evrenSayfa [data-ortak-ac]"); await bekle(K, 1500);
    ok("evren ortak yazarlığa açılır (sunucuda)", (await sorgu("select veri->>'ad' ad from public.ortak_evrenler where id = $1", [eid]))[0].ad === "Ortak Kıyı" &&
      await K.evaluate(function (id) { return evrenBenimBul(id).ortak === true; }, eid));
    await K.click("#evrenSayfa [data-ortak-davet]"); await bekle(K, 1200);
    const davet = await K.inputValue("#ortakDavetKod");
    ok("davet kodu ve bağlantısı üretilir", /^ORT-[A-Z0-9]{10}$/.test(davet) && /\?kod=ORT-/.test(await K.inputValue("#ortakDavetBag")));

    const Y = await cihaz("yazar");
    await kayitOl(Y, "Yazar", "yazar25", "y25@ornek.test");
    await Y.evaluate(function (k) { kodPenceresi(); kodDene(k); }, davet); await bekle(Y, 2500);
    ok("davet koduyla katılan yazara evren gelir", await Y.evaluate(function (id) { const e = evrenBenimBul(id); return !!e && e.ad === "Ortak Kıyı" && e.ortak === true && rota() === "#/ev/benim/" + id; }, eid));
    await Y.evaluate(function (id) { evrenBenimDegistir(id, function (e) { e.ozet = "Yazarın özeti."; }); }, eid); await bekle(Y, 3800);
    ok("yazarın değişikliği sunucuya gider", (await sorgu("select veri->>'ozet' o from public.ortak_evrenler where id = $1", [eid]))[0].o === "Yazarın özeti.");
    await K.evaluate(function (id) { return ortakCek(id); }, eid); await bekle(K, 800);
    ok("kurucu güncel hâli çeker", await K.evaluate(function (id) { return evrenBenimBul(id).ozet === "Yazarın özeti."; }, eid));
    /* çatışma: kurucu eski tabanla yazar */
    await Y.evaluate(function (id) { evrenBenimDegistir(id, function (e) { e.ozet = "Yazar yine yazdı."; }); }, eid); await bekle(Y, 3800);
    await K.evaluate(function (id) { GCM.son = {}; evrenBenimDegistir(id, function (e) { e.ozet = "Kurucunun çakışan hâli."; }); }, eid); await bekle(K, 4200);
    ok("çatışmada son kaydedenin hâli yüklenir, kurucununki geçmişe düşer", await K.evaluate(async function (id) {
      const l = await gcmListe(id);
      return evrenBenimBul(id).ozet === "Yazar yine yazdı." && l.some(function (x) { return /^(ortak yazardan önce|Yazar'in değişikliğinden önce)$/.test(x.neden) && /Kurucunun çakışan/.test(x.veri); });
    }, eid));
    ok("yazarlar listesi", await K.evaluate(async function (id) { await ortakUyeleriYukle(id); return (ORTAK.uyeler[id] || []).length === 2 && ortakSahipMi(id); }, eid));

    /* ---------- yönetim: yetkiler, içerik bildirimi, haftanın evreni, yedek ---------- */
    console.log("2.5 yönetim");
    await sorgu("insert into public.yoneticiler (id) select id from auth.users where email = 'k25@ornek.test' on conflict do nothing");
    const panel = async function (p, grup, sekme, ms) {
      await p.evaluate(function (a) { window.yoneticiAcik = function () { return true; }; location.hash = "#/sen"; yoneticiGrup = a[0]; yoneticiSekme = a[1]; yoneticiCiz(); }, [grup, sekme]);
      await bekle(p, ms || 1200);
    };
    await K.evaluate(function () { evrenSayfaKapat(); }); await bekle(K, 300);
    await panel(K, "bakim", "tekkod", 1500);
    await K.selectOption("#tekTur", "yonetici"); await bekle(K, 400);
    ok("yönetici kodunda yetkiler seçilir", await K.locator("[data-tek-yetki]").count() >= 10);
    await K.click('[data-tek-yetki-hepsi="0"]'); await bekle(K, 300);
    await K.check('[data-tek-yetki="hatalar"]'); await K.check('[data-tek-yetki="icbildirim"]');
    await K.click("[data-tek-uret]"); await bekle(K, 1500);
    const yKod = (await K.inputValue("#tekYeniKodlar")).trim();
    ok("yetkili yönetici kodu üretilir", /^[A-Z0-9]{10}$/.test(yKod));
    const S = await cihaz("sınırlı", true);
    await kayitOl(S, "Sınırlı", "sinirli25", "s25@ornek.test");
    await S.evaluate(function (k) { kodPenceresi(); kodDene(k); }, yKod); await bekle(S, 2600);
    ok("sınırlı yönetici yalnızca seçilen sekmeleri görür", await S.evaluate(function () {
      return panelAcik() && yoneticiSekmeleri("bakim").join() === "hatalar,icbildirim" && yoneticiSekmeleri("icerik").length === 0 && yoneticiSekmeleri("ekle").length === 0;
    }), await S.evaluate(function () { return [yoneticiSekmeleri("bakim"), yoneticiSekmeleri("icerik")]; }));
    ok("yetkiler sunucuda da kayıtlı", (await sorgu("select array_to_string(y.yetkiler, ',') y from public.yoneticiler y join auth.users u on u.id = y.id where u.email = 's25@ornek.test'"))[0].y === "hatalar,icbildirim");

    /* okur: sitedeki fan evreni (kurucunun evreninin yayımlanmış hâli) */
    const O = await cihaz("okur");
    await kayitOl(O, "Okur", "okur25", "o25@ornek.test");
    const kopya = await K.evaluate(function (id) { const e = JSON.parse(JSON.stringify(evrenBenimBul(id))); delete e.ortak; e.id = "fyayin25"; e.yazar = "Kurucu"; return e; }, eid);
    const fanKur = function (p) { return p.evaluate(function (e) { veri.fanEserleri = veri.fanEserleri || {}; veri.fanEserleri.evrenler = [e]; }, kopya); };
    await fanKur(O);
    await O.evaluate(function () { location.hash = "#/ev/fan/fyayin25"; }); await bekle(O, 900);
    await O.click('#evrenSayfa [data-evs-sekme="bilgi"]'); await bekle(O, 400);
    await O.click("#evrenSayfa .ib-evren [data-ib-ac]"); await bekle(O, 300);
    await O.fill("#ibNeden", "Test bildirimi: uygunsuz görsel"); await O.click("[data-ib-gonder]"); await bekle(O, 1200);
    ok("okur evreni bildirir", /ulaştı/.test(await O.textContent("#ibDurum")) &&
      (await sorgu("select count(*)::int n from public.icerik_bildirimleri where hedef = 'fan:fyayin25'"))[0].n === 1);
    await O.evaluate(function () { perdeKapat(); });
    ok("evren istatistiği sayılır", (await sorgu("select coalesce(sum(sayi),0)::int n from public.evren_sayaclari where evren = 'ev:fyayin25' and ad = 'ziyaret'"))[0].n >= 1);
    await S.evaluate(function () { yoneticiGrup = "bakim"; yoneticiSekme = "icbildirim"; location.hash = "#/sen"; yoneticiCiz(); }); await bekle(S, 1500);
    ok("yetkili sınırlı yönetici içerik bildirimlerini görür", /uygunsuz görsel/.test(await S.textContent("#yoneticiAlan")) && /İçerik bildirimleri/.test(await S.textContent("#yoneticiAlan .oyun-sekme")));
    await S.click('#yoneticiAlan [data-ib-karar][data-durum="incelendi"]'); await bekle(S, 1200);
    ok("bildirim incelendi işaretlenir", (await sorgu("select durum from public.icerik_bildirimleri where hedef = 'fan:fyayin25'"))[0].durum === "incelendi");

    await panel(K, "icerik", "vitrin", 800);
    await fanKur(K);
    await K.evaluate(function () { yoneticiCiz(); }); await bekle(K, 300);
    await K.selectOption("#hvSec", "fyayin25"); await K.fill("#hvNot", "Tuzun ve fenerin evreni."); await K.click("[data-hv-kaydet]"); await bekle(K, 400);
    ok("haftanın evreni seçilir ve ana sayfada görünür", await K.evaluate(function () {
      return veri.haftaninEvreni.id === "fyayin25" && /Tuzun ve fenerin/.test((document.querySelector("#haftaEvrenAlan") || {}).textContent || "");
    }));
    await panel(K, "bakim", "hatalar", 1500);
    ok("panel yedek hatırlatması", /yedek alınmadı/.test(await K.textContent("#yoneticiAlan .y24-serit")));

    /* evren yönetici kodunun yetkileri */
    await K.evaluate(async function (id) {
      const e = evrenBenimBul(id);
      await evrenLoreEkle(e, { baslik: "Birinci sır", metin: "Tuz aslında gözyaşıdır.", kod: "LORE111111" });
      await evrenLoreEkle(evrenBenimBul(id), { baslik: "İkinci sır", metin: "Fener hiç sönmedi.", kod: "LORE222222" });
      EVS = null; location.hash = "#/ev/benim/" + id;
    }, eid); await bekle(K, 900);
    await K.click('#evrenSayfa [data-evs-sekme="lore"]'); await bekle(K, 400);
    ok("evren yönetici kodunda yetkiler seçilir", await K.locator("#evrenSayfa [data-evy-lore]").count() === 2 && await K.locator("#evyYetkiSekme").count() === 1);
    const ikinci = await K.evaluate(function (id) { return evrenBenimBul(id).lorlar[1].id; }, eid);
    await K.uncheck('#evrenSayfa [data-evy-lore="' + ikinci + '"]'); await K.check("#evyYetkiSekme"); await K.check("#evyYetkiIpucu");
    await K.fill("#evyKod", "YONET12345"); await K.click("#evrenSayfa [data-evy-kur]"); await bekle(K, 500);
    ok("evren yönetici kodu yalnızca seçilen loreyu açar, yetkiler kaydedilir", await K.evaluate(async function (id) {
      const e = evrenBenimBul(id);
      const y = e.yoneticiYetki;
      const s = await evrenKodDene(e, "YONET12345");
      return y.sekmeler && y.ipucu && y.lorlar.length === 1 && !e.lorlar[1].sy && !!e.lorlar[0].sy && s.tur === "evren" && s.n === 1 && evy25Acik(id);
    }, eid));
    ok("yetkili evren yöneticisi gizli sekmeleri görür", await K.evaluate(function (id) {
      const e = evrenBenimBul(id);
      e.sekmeDuzen = { gizli: ["roman"] };
      EVS.kaynak = "fan";   /* ziyaretçi gözüyle */
      const once = evrenEkSekmeler({ eser: Object.assign({}, e, { yoneticiOzet: null }) }).some(function (x) { return x[0] === "roman"; });
      const sonra = evrenEkSekmeler({ eser: e }).some(function (x) { return x[0] === "roman"; });
      EVS.kaynak = "benim"; delete e.sekmeDuzen;
      return !once && sonra;
    }, eid));
    await K.evaluate(function () { evrenSayfaKapat(); }); await bekle(K, 200);

    /* ---------- okur: okuma listesi, yazı klavyesi, keşif önizleme, ayarlar ---------- */
    console.log("2.5 okur");
    await O.evaluate(function () { evrenSayfaKapat(); location.hash = "#/ev/fan/fyayin25"; }); await bekle(O, 800);
    await O.click('#evrenSayfa [data-evs-sekme="roman"]'); await bekle(O, 300);
    await O.click('#evrenSayfa .evr-gez [data-evr-sec="b2"]'); await bekle(O, 300);
    await O.click("#evrenSayfa [data-okl-liste]"); await bekle(O, 300);
    await O.evaluate(function () { evrenSayfaKapat(); location.hash = "#/arsiv"; }); await bekle(O, 400);
    await O.evaluate(function () { evrenSonrakiSekme = "roman"; location.hash = "#/ev/fan/fyayin25"; }); await bekle(O, 800);
    ok("kaldığın yerden devam: ikinci bölüm açılır", /Kaldığın yerden: 2\. bölüm/.test(await O.textContent("#evrenSayfa .okl-serit")) && /Fener/.test(await O.textContent("#evrenSayfa .evr-bolum-baslik")),
      await O.evaluate(function () { return { sekme: EVS.sekme, serit: (document.querySelector("#evrenSayfa .okl-serit") || {}).textContent, baslik: (document.querySelector("#evrenSayfa .evr-bolum-baslik") || {}).textContent, kayit: localStorage.getItem("tentiforapp_okuma_listem") }; }));
    ok("okuma listesinde", /Okuma listende/.test(await O.textContent("#evrenSayfa [data-okl-liste]")));
    await O.click('#evrenSayfa [data-evs-sekme="yazi"]'); await bekle(O, 300);
    await O.fill("#ykMetin", "merhaba kıyı"); await bekle(O, 150);
    ok("yazı klavyesi: yazdıkça evrenin yazısıyla", await O.locator("#ykOnizle svg path").count() >= 10);
    ok("yazı klavyesi: PNG üretilir", await O.evaluate(async function () { const b = await ykPng(document.querySelector("#ykOnizle").innerHTML); return b.type === "image/png" && b.size > 1500; }));
    await O.evaluate(function () { evrenSayfaKapat(); location.hash = "#/sen"; }); await bekle(O, 800);
    ok("Sen: okuma listem, bildirimler, cihazdaki evrenler", await O.evaluate(function () {
      const a = document.querySelector("#ayar25Alan"); return !!a && /Ortak Kıyı/.test(a.textContent) && /Sessiz saatler/.test(a.textContent) && /Cihazdaki evrenler|Çevrimdışı okuma/.test(a.textContent);
    }));
    await O.evaluate(function () { document.querySelectorAll("#ayar25Alan details").forEach(function (d) { d.open = true; }); });
    await O.selectOption("#sessizBas", "22"); await O.selectOption("#sessizBit", "8"); await bekle(O, 300);
    ok("sessiz saatler kaydedilir", await O.evaluate(function () { const s = JSON.parse(localStorage.getItem("tentiforapp_sessiz_saat")); return s.bas === 22 && s.bit === 8; }));
    await O.evaluate(function () { location.hash = "#/fan"; kesifCiz(); }); await bekle(O, 500);
    await O.click('#evrenKesif [data-kesif-onizle="fyayin25"]'); await bekle(O, 400);
    ok("keşif: önizleme kartı haritayla", await O.locator("#perde .kesif-onizle .ko-harita svg").count() === 1 && /3 bölüm|bölüm/.test(await O.textContent("#perde .kesif-onizle")));
    await O.click("#perde .kesif-onizle [data-evren-git]"); await bekle(O, 800);
    ok("önizlemeden evrene girilir", await O.evaluate(function () { return EVS && EVS.id === "fyayin25" && document.querySelector("#perde").hidden; }));

    /* istatistik kurucuya görünür */
    await K.evaluate(function (id) { EVI.onbellek = {}; location.hash = "#/ev/benim/" + id; }, eid); await bekle(K, 800);
    await K.click('#evrenSayfa [data-evs-sekme="bilgi"]'); await bekle(K, 1500);
    ok("kurucu evren istatistiğini görür", /ziyaret/.test(await K.textContent("#eviAlan")), await K.textContent("#eviAlan"));

    /* ---------- kutu bağları ve kutu rozetleri ---------- */
    console.log("2.5 kutu rozetleri");
    ok("bütün evrenlerde kutular bağlanır, gizli karakter bağ olmaz", await O.evaluate(function () {
      RB.ag = null;
      const ag = rbAg();
      const gizli = veri.karakterler.filter(function (k) { return k.kart === false; }).map(function (k) { return "kar:" + k.id; });
      const alanlar = {}; ag.forEach(function (d) { alanlar[d.kutu.alan] = true; });
      const m = veri.mektuplar.find(function (x) { return veri.karakterler.some(function (k) { return k.ad === x.kimden && k.kart !== false; }); });
      const kimden = veri.karakterler.find(function (k) { return k.ad === m.kimden; });
      return ag.size > 150 && alanlar.tomye && alanlar.claude && !gizli.some(function (g) { return ag.has(g); }) &&
        rbBaglar("mektup:" + (m.id || veri.mektuplar.indexOf(m))).some(function (b) { return b.anahtar === "kar:" + kimden.id; });
    }));
    ok("karakter rozetine evren maddeleri de girer", await O.evaluate(function () {
      return veri.karakterler.some(function (k) { return k.kart !== false && karakterKutulari(k).some(function (x) { return /^evren:/.test(x.anahtar); }); });
    }));
    const rb = await O.evaluate(function () {
      let hedef = null;
      rbAg().forEach(function (d, k) { if (!hedef && /^madde:ce-/.test(k) && rbBaglar(k).length >= 2 && rbKonu(k).length) { hedef = k; } });
      const once = rbDurum(hedef);
      okunduIsaretle(hedef); rozetleriDenetle();
      const yarim = rbDurum(hedef);
      rbBaglar(hedef).forEach(function (b) { okunduIsaretle(b.anahtar); });
      rozetleriDenetle();
      const gumus = rbDurum(hedef);
      const l = fanEserlerim();
      l.push({ bicim: FAN_BICIM, surum: 1, tur: "hikaye", id: "rbtest", baslik: "Deneme", karakterler: "", metin: rbKonu(hedef)[0] + " üzerine uzun bir hikâye. " + "Kıyıda rüzgâr esiyordu ve herkes bekliyordu. ".repeat(10) });
      fanEserlerimYaz(l);
      rozetleriDenetle();
      return { hedef: hedef, once: once, yarim: yarim, gumus: gumus, altin: rbDurum(hedef) };
    });
    ok("kutu ve bağlı kutuları okununca gümüş, yarım okununca yok", rb.hedef && rb.once === "" && rb.yarim === "" && rb.gumus === "gumus", rb);
    ok("konusuna fan hikâyesi yazınca altın kutu rozeti", rb.altin === "altin", rb);
    ok("kutunun altında bağlı kutular ve rozet durumu", await O.evaluate(function (k) { const h = rbSeritHtml(k); return /🥇/.test(h) && /bağlı kutu/.test(h) && /✓/.test(h); }, rb.hedef));
    await O.evaluate(function () { evrenSayfaKapat(); location.hash = "#/claude"; }); await bekle(O, 1200);
    await O.evaluate(function () { document.querySelectorAll("#claudeEvrenAlan details.ce-kisi").forEach(function (d) { d.open = true; }); if (typeof okuEtiketle === "function") { okuEtiketle(); } okuTara(); }); await bekle(O, 500);
    ok("sayfadaki kutuların altında bağ şeridi", await O.locator(".rb-serit").count() >= 1, await O.evaluate(function () { return document.querySelectorAll("[data-oku]").length; }));

    ok("2.5 testlerinde sayfa hatası yok", hatalar.length === 0, hatalar);
  } finally {
    await tarayici.close();
    await sahte.pool.end().catch(function () { /* kapalı */ });
  }
  return gecen;
}
