/* Edge Function (supabase/functions/bildirim-gonder) birim testi: Deno ve ağ olmadan,
   Supabase istemcisi ve web-push taklit edilerek çalıştırılır. */
import { readFileSync } from "node:fs";

export async function bildirimFonksiyonTestleri(kok) {
  let kaynak = readFileSync(kok + "supabase/functions/bildirim-gonder/index.ts", "utf8")
    .replace(/^import .*$/gm, "").replace(/^export /gm, "");
  const bildirimIsle = new Function(kaynak + "\nreturn bildirimIsle;")();
  let gecen = 0;
  const ok = function (ad, k, bilgi) { if (!k) { throw new Error("BAŞARISIZ: " + ad + (bilgi ? " " + JSON.stringify(bilgi) : "")); } gecen++; console.log("  tamam: " + ad); };

  const abonelikler = [
    { endpoint: "https://fcm.googleapis.com/a", p256dh: "p", auth: "a" },
    { endpoint: "https://fcm.googleapis.com/olu", p256dh: "p", auth: "a" },
    { endpoint: "https://fcm.googleapis.com/bozuk", p256dh: "p", auth: "a" }
  ];
  function araclar(yonetici) {
    const iz = { silinen: [], gonderilen: [], vapid: null };
    return { iz: iz,
      createClient: function (url, anahtar) {
        if (anahtar === "anon") { return { rpc: async function (ad) { return { data: ad === "tam_yonetici_mi" && yonetici, error: null }; } }; }
        return { from: function () { return {
          select: function () { return { order: function () { return { range: async function (a, b) { return { data: abonelikler.slice(a, b + 1), error: null }; } }; } }; },
          delete: function () { return { in: async function (_, l) { iz.silinen.push.apply(iz.silinen, l); return { error: null }; } }; }
        }; } };
      },
      webpush: {
        setVapidDetails: function (k, a, g) { iz.vapid = [k, a, g]; },
        sendNotification: async function (abone, yuk) {
          iz.gonderilen.push(JSON.parse(yuk));
          if (/olu/.test(abone.endpoint)) { throw { statusCode: 410 }; }
          if (/bozuk/.test(abone.endpoint)) { throw { statusCode: 500 }; }
        }
      } };
  }
  const ortam = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "servis",
    VAPID_PUBLIC_KEY: "acik", VAPID_PRIVATE_KEY: "gizli" };
  const istek = function (govde, yontem) {
    return new Request("https://x.supabase.co/functions/v1/bildirim-gonder", { method: yontem || "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" }, body: yontem === "OPTIONS" ? undefined : JSON.stringify(govde) });
  };

  ok("CORS ön isteği", (await bildirimIsle(istek(null, "OPTIONS"), ortam, araclar(true))).status === 200);
  ok("anahtarsız: ayarsız", (await (await bildirimIsle(istek({ baslik: "x" }), { ...ortam, VAPID_PRIVATE_KEY: "" }, araclar(true))).json()).durum === "ayarsiz");
  const y = await bildirimIsle(istek({ baslik: "x" }), ortam, araclar(false));
  ok("yönetici olmayan gönderemez", y.status === 403);
  const a = araclar(true);
  const r = await (await bildirimIsle(istek({ baslik: "Yeni bölüm", metin: "Dört", adres: "//kotu.site/x" }), ortam, a)).json();
  ok("herkese gönderilir, sayılar doğru", r.durum === "tamam" && r.gonderilen === 1 && r.silinen === 1 && r.hata === 1, r);
  ok("biten abonelik silinir", a.iz.silinen.join() === "https://fcm.googleapis.com/olu");
  ok("başka siteye yönlendiren adres engellenir", a.iz.gonderilen.every(function (g) { return g.adres === "/"; }));
  ok("VAPID ayarlanır", a.iz.vapid[1] === "acik" && a.iz.vapid[2] === "gizli");
  const b = araclar(true);
  await bildirimIsle(istek({ baslik: "B", adres: "/#/roman" }), ortam, b);
  ok("site içi adres korunur", b.iz.gonderilen[0].adres === "/#/roman");
  ok("boş başlık reddedilir", (await bildirimIsle(istek({ baslik: " " }), ortam, araclar(true))).status === 400);
  gecen += await moderasyonTestleri(kok);
  gecen += await webhookTestleri(kok);
  return gecen;
}

/* 4.2: moderasyon ve ödeme bildirimi Edge Function'ları — Deno, Supabase ve GitHub taklit edilerek */
function edgeYukle(kok, ad, adlar) {
  let k = readFileSync(kok + "supabase/functions/" + ad + "/index.ts", "utf8").replace(/^import .*$/gm, "");
  k = k.slice(0, k.indexOf("Deno.serve("));
  return new Function(k + "\nreturn { " + adlar.join(", ") + " };")();
}

async function moderasyonTestleri(kok) {
  const { moderasyonIsle } = edgeYukle(kok, "moderasyon", ["moderasyonIsle"]);
  let gecen = 0;
  const ok = function (ad, k, bilgi) { if (!k) { throw new Error("BAŞARISIZ: moderasyon: " + ad + (bilgi ? " " + JSON.stringify(bilgi) : "")); } gecen++; console.log("  tamam: moderasyon: " + ad); };
  const evren = { bicim: "tentifor-eser", surum: 1, tur: "evren", id: "yerel1", ad: "Deneme Evreni", ozet: "Bir özet", kurallar: [{ ad: "k" }], lorlar: [{ id: "gizli" }] };
  const hikaye = { bicim: "tentifor-eser", surum: 1, tur: "hikaye", id: "h1", baslik: "Deneme Hikâyesi", evren: "Deneme Evreni", metin: "Bir zamanlar" };
  function kur(duzey, basvuru, paket, veriBas) {
    const iz = { karar: [], silinen: [], dosyalar: {}, push: 0, kapatilan: [] };
    let veri = veriBas || { fanEserleri: { evrenler: [], hikayeler: [] } };
    const db = {
      rpc: async function (ad, a) {
        if (ad === "moderator_bilgi") { return { data: a.p_token === "gecerli" ? { ad: "Test", duzey: duzey } : null }; }
        if (ad === "moderator_giris") { return a.p_kod === "MOD-DOGRU-12345" ? { data: "gecerli" } : { data: null, error: { message: "kod geçersiz" } }; }
        if (ad === "mod_karar") { iz.karar.push(a); return { data: {}, error: null }; }
        if (ad === "mod_sikayet_kapat") { iz.kapatilan.push(a.p_slug); return { data: 1 }; }
        return { data: null };
      },
      from: function (t) {
        const zincir = { select: function () { return zincir; }, eq: function () { return zincir; }, limit: function () { return Promise.resolve({ data: [] }); },
          maybeSingle: async function () { return { data: t === "basvurular" ? basvuru : (t === "profiller" ? { kullanici_adi: "yazar1" } : (t === "evren_sahipleri" ? { kullanici: "kurucu" } : null)) }; } };
        return zincir;
      },
      storage: { from: function () { return {
        createSignedUrl: async function () { return { data: { signedUrl: "https://imzali" } }; },
        download: async function () { return { data: JSON.stringify(paket) }; },
        remove: async function (l) { iz.silinen.push.apply(iz.silinen, l); return {}; }
      }; } }
    };
    const gh = {
      oku: async function (yol) { return iz.dosyalar[yol] != null ? { metin: iz.dosyalar[yol], sha: "s" } : null; },
      yaz: async function (yol, metin) { iz.dosyalar[yol] = metin; },
      sil: async function (yol) { const v = iz.dosyalar[yol] != null; delete iz.dosyalar[yol]; return v; },
      veriDegistir: async function (fn) { const r = fn(veri); return r; }
    };
    return { iz: iz, veri: function () { return veri; }, a: { db: db, gh: gh, ortam: {}, kullaniciDb: db, kullanici: null, webpush: null, gunzip: async function (x) { return x; } } };
  }
  const bEvren = { id: "b1", tur: "evren", durum: "bekliyor", dosya_yolu: "u/1.json.gz", baslik: "Deneme Evreni", gonderen: "u1" };

  let k = kur("fan", bEvren, evren);
  ok("yanlış kodla giriş reddedilir", (await moderasyonIsle({ islem: "giris", kod: "MOD-YANLIS-1234" }, k.a)).durum === 401);
  const gr = await moderasyonIsle({ islem: "giris", kod: "MOD-DOGRU-12345" }, k.a);
  ok("doğru kod token ve düzey döner (kod geri dönmez)", gr.durum === 200 && gr.veri.token === "gecerli" && gr.veri.duzey === "fan" && !("kod" in gr.veri));
  ok("oturumsuz işlem reddedilir", (await moderasyonIsle({ islem: "onizle", token: "sahte", id: "b1" }, k.a)).durum === 401);
  ok("fan moderatör kanon onaylayamaz", (await moderasyonIsle({ islem: "onayla", token: "gecerli", id: "b1", kanon: true, slug: "deneme-evreni" }, k.a)).durum === 403);
  ok("fan moderatör yayından kaldıramaz", (await moderasyonIsle({ islem: "kaldir", token: "gecerli", tur: "evren", slug: "deneme-evreni" }, k.a)).durum === 403);
  ok("geçersiz yayın adresi reddedilir", (await moderasyonIsle({ islem: "onayla", token: "gecerli", id: "b1", slug: "A B" }, k.a)).durum === 400);

  const r1 = await moderasyonIsle({ islem: "onayla", token: "gecerli", id: "b1", slug: "deneme-evreni" }, k.a);
  const oz = k.veri().fanEserleri.evrenler[0];
  ok("fan-made onay: evren dosyası GitHub'a, özeti veri.json'a", r1.durum === 200 && !!k.iz.dosyalar["evrenler/deneme-evreni.json"] && oz.id === "deneme-evreni" && oz.dosya === "evrenler/deneme-evreni.json" && !oz.kanon, r1);
  const dosya = JSON.parse(k.iz.dosyalar["evrenler/deneme-evreni.json"]);
  ok("kilitli lore yayına girmez, yazar kullanıcı adı eklenir", !dosya.lorlar && dosya.yazar_kadi === "yazar1" && oz.yazar_kadi === "yazar1");
  ok("karar kaydedilir, kuyruk dosyası silinir", k.iz.karar.length === 1 && k.iz.karar[0].p_onay === true && k.iz.silinen[0] === "u/1.json.gz");
  ok("aynı adres ikinci kez kullanılamaz", (await moderasyonIsle({ islem: "onayla", token: "gecerli", id: "b1", slug: "deneme-evreni" }, k.a)).durum === 409);

  k = kur("kanon", bEvren, evren);
  await moderasyonIsle({ islem: "onayla", token: "gecerli", id: "b1", slug: "kanon-evren", kanon: true }, k.a);
  ok("kanon moderatör kanon onaylar", k.veri().fanEserleri.evrenler[0].kanon === true);
  const g = kur("fan", Object.assign({}, bEvren, { guncelle_slug: "kanon-evren" }), Object.assign({}, evren, { ad: "Yeni Ad" }), k.veri());
  g.iz.dosyalar["evrenler/kanon-evren.json"] = "{}";
  await moderasyonIsle({ islem: "onayla", token: "gecerli", id: "b1" }, g.a);
  ok("güncelleme dosyayı ve özeti yeniler, kanon işareti korunur", g.veri().fanEserleri.evrenler.length === 1 && g.veri().fanEserleri.evrenler[0].ad === "Yeni Ad" && g.veri().fanEserleri.evrenler[0].kanon === true);
  const kl = await moderasyonIsle({ islem: "kaldir", token: "gecerli", tur: "evren", slug: "kanon-evren" }, k.a);
  ok("kanon moderatör yayından kaldırır: özet ve dosya gider, şikâyet kapanır", kl.durum === 200 && k.veri().fanEserleri.evrenler.length === 0 && !k.iz.dosyalar["evrenler/kanon-evren.json"] && k.iz.kapatilan[0] === "kanon-evren");

  const h = kur("fan", { id: "b2", tur: "hikaye", durum: "bekliyor", dosya_yolu: "u/2.json.gz", baslik: "Deneme Hikâyesi", gonderen: "u2" }, hikaye,
    { fanEserleri: { evrenler: [], hikayeler: [{ id: "deneme-hikayesi" }] } });
  const r2 = await moderasyonIsle({ islem: "onayla", token: "gecerli", id: "b2", slug: "deneme-hikayesi" }, h.a);
  ok("hikâye onayı: veri.json hikâyelerine, çakışan adrese ek alır", r2.durum === 200 && h.veri().fanEserleri.hikayeler.length === 2 && h.veri().fanEserleri.hikayeler[1].id === "deneme-hikayesi-2" && r2.veri.slug === "deneme-hikayesi-2", r2);
  const t = kur("fan", bEvren, hikaye);
  ok("tür uyuşmayan paket reddedilir", (await moderasyonIsle({ islem: "onayla", token: "gecerli", id: "b1", slug: "yanlis-tur" }, t.a)).durum === 400);

  const rd = kur("fan", bEvren, evren);
  await moderasyonIsle({ islem: "reddet", token: "gecerli", id: "b1", not: "eksik" }, rd.a);
  ok("red: not kararla gider, dosya silinir", rd.iz.karar[0].p_onay === false && rd.iz.karar[0].p_not === "eksik" && rd.iz.silinen.length === 1);

  const kr = kur("fan", { id: "b3", tur: "hikaye", durum: "kurucu_bekliyor", dosya_yolu: "u/3.json.gz", baslik: "H", gonderen: "u3", evren_slug: "deneme-evreni" }, hikaye);
  ok("kurucu işlemi girişsiz yapılamaz", (await moderasyonIsle({ islem: "kurucu_onizle", id: "b3" }, kr.a)).durum === 401);
  kr.a.kullanici = { id: "baskasi" };
  ok("kurucu olmayan başkasının hikâyesini göremez", (await moderasyonIsle({ islem: "kurucu_onizle", id: "b3" }, kr.a)).durum === 403);
  kr.a.kullanici = { id: "kurucu" };
  ok("kurucu kendi evrenine gelen hikâyeyi önizler", (await moderasyonIsle({ islem: "kurucu_onizle", id: "b3" }, kr.a)).veri.adres === "https://imzali");
  return gecen;
}

async function webhookTestleri(kok) {
  const { webhookIsle } = edgeYukle(kok, "odeme-webhook", ["webhookIsle", "hmacBase64"]);
  const { hmacBase64 } = edgeYukle(kok, "odeme-webhook", ["hmacBase64"]);
  let gecen = 0;
  const ok = function (ad, k, bilgi) { if (!k) { throw new Error("BAŞARISIZ: ödeme bildirimi: " + ad + (bilgi ? " " + JSON.stringify(bilgi) : "")); } gecen++; console.log("  tamam: ödeme bildirimi: " + ad); };
  const ortam = { PAYTR_MERCHANT_KEY: "anahtar", PAYTR_MERCHANT_SALT: "tuz" };
  function kur(odemeDurum, bitis) {
    const iz = { guncelleme: [], abonelik: null };
    const db = { from: function (t) {
      const z = { select: function () { return z; }, eq: function () { return Promise.resolve({}); },
        maybeSingle: async function () { return { data: t === "odemeler" ? (odemeDurum ? { merchant_oid: "TF1", kullanici: "u1", durum: odemeDurum } : null) : (bitis ? { abonelik_bitis: bitis } : null) }; },
        update: function (x) { iz.guncelleme.push(x); return { eq: async function () { return {}; } }; },
        upsert: async function (x) { iz.abonelik = x; return {}; } };
      z.eq = function () { return z; };
      return z;
    } };
    return { iz: iz, a: { ortam: ortam, db: db, simdi: function () { return Date.parse("2026-10-01T00:00:00Z"); } } };
  }
  const imza = async function (d) { return hmacBase64("anahtar", "TF1" + "tuz" + d + "9900"); };
  let k = kur("bekliyor");
  ok("hash tutmazsa hiçbir şey yazılmaz", (await webhookIsle({ merchant_oid: "TF1", status: "success", total_amount: "9900", hash: "sahte" }, k.a)).durum === 400 && !k.iz.abonelik);
  const r = await webhookIsle({ merchant_oid: "TF1", status: "success", total_amount: "9900", hash: await imza("success") }, k.a);
  ok("başarılı ödeme 30 gün Pro verir, yanıt OK", r.metin === "OK" && k.iz.abonelik.uyelik_tipi === "pro" && k.iz.abonelik.abonelik_bitis === "2026-10-31T00:00:00.000Z");
  k = kur("bekliyor", "2026-10-11T00:00:00Z");
  await webhookIsle({ merchant_oid: "TF1", status: "success", total_amount: "9900", hash: await imza("success") }, k.a);
  ok("süresi bitmemiş üyeliğin üstüne eklenir", k.iz.abonelik.abonelik_bitis === "2026-11-10T00:00:00.000Z");
  k = kur("basarili");
  ok("aynı bildirim ikinci kez işlenmez", (await webhookIsle({ merchant_oid: "TF1", status: "success", total_amount: "9900", hash: await imza("success") }, k.a)).metin === "OK" && !k.iz.abonelik);
  k = kur("bekliyor");
  await webhookIsle({ merchant_oid: "TF1", status: "failed", total_amount: "9900", hash: await imza("failed") }, k.a);
  ok("başarısız ödeme Pro vermez", !k.iz.abonelik && k.iz.guncelleme[0].durum === "basarisiz");
  return gecen;
}
