// @ts-nocheck — sade JavaScript; Deno tip denetimi gerekmez.
// TentiforApp 4.0 — PayTR ödeme bildirimi (Bildirim URL'si). Supabase → Edge Functions → adı "odeme-webhook".
// PayTR mağaza paneli → Ayarlar → Bildirim URL: https://<proje>.supabase.co/functions/v1/odeme-webhook
// Bu fonksiyon JWT doğrulaması olmadan çalışmalı (PayTR oturum göndermez): Supabase'de "Verify JWT" kapalı.
// Güvenlik: PayTR'nin gönderdiği hash, mağaza anahtarıyla yeniden hesaplanıp karşılaştırılır; tutmazsa hiçbir şey yazılmaz.
// Başarılı ödeme: kullanıcı 30 gün Pro olur (süresi bitmemişse üstüne eklenir). Aynı bildirim ikinci kez gelirse yok sayılır.
// Yanıt her durumda düz metin "OK" olmalı; yoksa PayTR bildirimi tekrarlar.

import { createClient } from "npm:@supabase/supabase-js@2";

async function hmacBase64(anahtar, metin) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(anahtar), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const imza = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(metin)));
  return btoa(String.fromCharCode(...imza));
}

/** İş mantığı (testte taklit edilir): form alanları + araçlar → { durum, metin } */
async function webhookIsle(f, a) {
  const oid = String(f.merchant_oid || ""), durum = String(f.status || ""), toplam = String(f.total_amount || ""), hash = String(f.hash || "");
  const beklenen = await hmacBase64(a.ortam.PAYTR_MERCHANT_KEY || "", oid + (a.ortam.PAYTR_MERCHANT_SALT || "") + durum + toplam);
  if (!hash || hash !== beklenen) { return { durum: 400, metin: "hash tutmadı" }; }

  const { data: o } = await a.db.from("odemeler").select("*").eq("merchant_oid", oid).maybeSingle();
  if (!o || o.durum !== "bekliyor") { return { durum: 200, metin: "OK" }; }   /* bilinmeyen ya da daha önce işlenmiş */

  const simdi = a.simdi ? a.simdi() : Date.now();
  if (durum !== "success") {
    await a.db.from("odemeler").update({ durum: "basarisiz", sonuc: new Date(simdi).toISOString() }).eq("merchant_oid", oid);
    return { durum: 200, metin: "OK" };
  }
  await a.db.from("odemeler").update({ durum: "basarili", sonuc: new Date(simdi).toISOString() }).eq("merchant_oid", oid);
  const { data: ab } = await a.db.from("kullanici_abonelik").select("abonelik_bitis").eq("kullanici", o.kullanici).maybeSingle();
  const taban = Math.max(simdi, ab && ab.abonelik_bitis ? Date.parse(ab.abonelik_bitis) : 0);
  await a.db.from("kullanici_abonelik").upsert({
    kullanici: o.kullanici, uyelik_tipi: "pro", abonelik_bitis: new Date(taban + 30 * 864e5).toISOString(), odeme_id: oid, guncelleme: new Date(simdi).toISOString(),
  });
  return { durum: 200, metin: "OK" };
}

Deno.serve(async (istek) => {
  if (istek.method !== "POST") { return new Response("yalnızca POST", { status: 405 }); }
  const form = await istek.formData().catch(() => null);
  if (!form) { return new Response("geçersiz", { status: 400 }); }
  const f = {};
  for (const [k, v] of form.entries()) { f[k] = String(v); }
  const ortam = Deno.env.toObject();
  const r = await webhookIsle(f, { ortam, db: createClient(ortam.SUPABASE_URL, ortam.SUPABASE_SERVICE_ROLE_KEY) });
  return new Response(r.metin, { status: r.durum, headers: { "Content-Type": "text/plain" } });
});
