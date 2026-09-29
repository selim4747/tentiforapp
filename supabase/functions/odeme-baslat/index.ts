// @ts-nocheck — sade JavaScript; Deno tip denetimi gerekmez.
// TentiforApp 4.0 — Yaratıcı Pro (1 ay) ödemesini başlatır: PayTR iFrame API'den ödeme sayfası anahtarı (token) alır.
// Supabase → Edge Functions → adı "odeme-baslat". Gizli değerler (Edge Functions → Secrets):
//   PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT — PayTR mağaza panelindeki bilgiler
//   PRO_FIYAT_KURUS (isteğe bağlı, varsayılan 9900 = 99,00 TL), PAYTR_TEST ("1" = test modu), SITE_ADRESI (örn. https://tentiforapp.pages.dev)
// Giriş yapmış kullanıcı çağırır (Authorization: Bearer <oturum>). Başarılı ödeme bildirimi odeme-webhook'a gelir.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const yanit = (veri, durum) => new Response(JSON.stringify(veri), { status: durum || 200, headers: { ...CORS, "Content-Type": "application/json" } });

async function hmacBase64(anahtar, metin) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(anahtar), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const imza = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(metin)));
  return btoa(String.fromCharCode(...imza));
}

Deno.serve(async (istek) => {
  if (istek.method === "OPTIONS") { return new Response("ok", { headers: CORS }); }
  const env = (a, v) => Deno.env.get(a) || v;
  const kimlik = env("PAYTR_MERCHANT_ID"), anahtar = env("PAYTR_MERCHANT_KEY"), tuz = env("PAYTR_MERCHANT_SALT");
  if (!kimlik || !anahtar || !tuz) { return yanit({ hata: "ödeme henüz kurulmadı (PayTR bilgileri eksik)" }, 503); }

  const kullaniciIstemci = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: istek.headers.get("Authorization") || "" } } });
  const { data: { user } } = await kullaniciIstemci.auth.getUser();
  if (!user) { return yanit({ hata: "giriş gerekli" }, 401); }

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const tutar = parseInt(env("PRO_FIYAT_KURUS", "9900"), 10);
  const oid = "TF" + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase();   /* PayTR: yalnızca harf ve rakam */
  await db.from("odemeler").insert({ merchant_oid: oid, kullanici: user.id, tutar });

  const ip = (istek.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "127.0.0.1";
  const sepet = btoa(unescape(encodeURIComponent(JSON.stringify([["Yaratıcı Pro (1 ay)", (tutar / 100).toFixed(2), 1]]))));
  const test = env("PAYTR_TEST", "0") === "1" ? "1" : "0";
  const site = env("SITE_ADRESI", "https://tentiforapp.pages.dev");
  const alanlar = {
    merchant_id: kimlik, user_ip: ip, merchant_oid: oid, email: user.email || "uye@tentiforapp.local", payment_amount: String(tutar),
    user_basket: sepet, no_installment: "1", max_installment: "0", currency: "TL", test_mode: test, debug_on: test,
    user_name: "TentiforApp üyesi", user_address: "Dijital hizmet", user_phone: "0000000000",
    merchant_ok_url: site + "/#/sen?odeme=tamam", merchant_fail_url: site + "/#/sen?odeme=olmadi", timeout_limit: "30", lang: "tr",
  };
  alanlar.paytr_token = await hmacBase64(anahtar, kimlik + ip + oid + alanlar.email + alanlar.payment_amount + sepet + "1" + "0" + "TL" + test + tuz);

  const r = await fetch("https://www.paytr.com/odeme/api/get-token", { method: "POST", body: new URLSearchParams(alanlar) });
  const j = await r.json().catch(() => ({}));
  if (j.status !== "success") { return yanit({ hata: "PayTR: " + (j.reason || "token alınamadı") }, 502); }
  return yanit({ adres: "https://www.paytr.com/odeme/guvenli/" + j.token, siparis: oid });
});
