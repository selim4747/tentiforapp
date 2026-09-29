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
const OK = () => new Response("OK", { headers: { "Content-Type": "text/plain" } });

Deno.serve(async (istek) => {
  if (istek.method !== "POST") { return new Response("yalnızca POST", { status: 405 }); }
  const f = await istek.formData().catch(() => null);
  if (!f) { return new Response("geçersiz", { status: 400 }); }
  const oid = String(f.get("merchant_oid") || ""), durum = String(f.get("status") || ""), toplam = String(f.get("total_amount") || ""), hash = String(f.get("hash") || "");
  const beklenen = await hmacBase64(Deno.env.get("PAYTR_MERCHANT_KEY") || "", oid + (Deno.env.get("PAYTR_MERCHANT_SALT") || "") + durum + toplam);
  if (!hash || hash !== beklenen) { return new Response("hash tutmadı", { status: 400 }); }

  const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: o } = await db.from("odemeler").select("*").eq("merchant_oid", oid).maybeSingle();
  if (!o || o.durum !== "bekliyor") { return OK(); }   /* bilinmeyen ya da daha önce işlenmiş */

  if (durum !== "success") {
    await db.from("odemeler").update({ durum: "basarisiz", sonuc: new Date().toISOString() }).eq("merchant_oid", oid);
    return OK();
  }
  await db.from("odemeler").update({ durum: "basarili", sonuc: new Date().toISOString() }).eq("merchant_oid", oid);
  const { data: a } = await db.from("kullanici_abonelik").select("abonelik_bitis").eq("kullanici", o.kullanici).maybeSingle();
  const taban = Math.max(Date.now(), a && a.abonelik_bitis ? Date.parse(a.abonelik_bitis) : 0);
  await db.from("kullanici_abonelik").upsert({
    kullanici: o.kullanici, uyelik_tipi: "pro", abonelik_bitis: new Date(taban + 30 * 864e5).toISOString(), odeme_id: oid, guncelleme: new Date().toISOString(),
  });
  return OK();
});
