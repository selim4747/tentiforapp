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
  return gecen;
}
