// @ts-nocheck — sade JavaScript; Deno tip denetimi gerekmez.
// TentiforApp 4.0 — moderatör işlemleri (dosya taşıma/silme). Supabase → Edge Functions → adı "moderasyon".
// Moderatör hesap açmaz: erişim koduyla public.moderator_giris'ten aldığı oturum anahtarını (token) gönderir.
// Kuyruk dosyaları kilitli "onay-kuyrugu" bucket'ındadır; yalnızca bu fonksiyon (service role) okur, taşır, siler.
// İşlemler: onizle (60 sn'lik imzalı indirme adresi), onayla (dosyayı "yayindaki-evrenler"e taşır, vitrine işler), reddet (siler).

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const yanit = (veri, durum) => new Response(JSON.stringify(veri), { status: durum || 200, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (istek) => {
  if (istek.method === "OPTIONS") { return new Response("ok", { headers: CORS }); }
  if (istek.method !== "POST") { return yanit({ hata: "yalnızca POST" }, 405); }
  let g;
  try { g = await istek.json(); } catch (_) { return yanit({ hata: "geçersiz istek" }, 400); }
  const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: gecerli } = await db.rpc("moderator_dogrula", { p_token: String(g.token || "") });
  if (!gecerli) { return yanit({ hata: "moderatör oturumu yok ya da süresi doldu" }, 401); }

  const { data: b } = await db.from("basvurular").select("*").eq("id", g.id).maybeSingle();
  if (!b || b.durum !== "bekliyor") { return yanit({ hata: "başvuru yok ya da karar verilmiş" }, 404); }

  if (g.islem === "onizle") {
    const { data, error } = await db.storage.from("onay-kuyrugu").createSignedUrl(b.dosya_yolu, 60);
    if (error) { return yanit({ hata: error.message }, 500); }
    return yanit({ adres: data.signedUrl });
  }
  if (g.islem === "reddet") {
    await db.storage.from("onay-kuyrugu").remove([b.dosya_yolu]);
    const { error } = await db.rpc("mod_karar", { p_token: g.token, p_id: b.id, p_onay: false, p_slug: null, p_not: String(g.not || "") });
    return error ? yanit({ hata: error.message }, 400) : yanit({ tamam: true });
  }
  if (g.islem === "onayla") {
    const slug = String(g.slug || "").toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) { return yanit({ hata: "adres (slug) 3–60 harf/rakam/tire olmalı" }, 400); }
    const { data: dosya, error: e1 } = await db.storage.from("onay-kuyrugu").download(b.dosya_yolu);
    if (e1) { return yanit({ hata: e1.message }, 500); }
    const { error: e2 } = await db.storage.from("yayindaki-evrenler").upload(slug + ".json.gz", dosya, { contentType: "application/gzip", upsert: true, cacheControl: "3600" });
    if (e2) { return yanit({ hata: e2.message }, 500); }
    const { error: e3 } = await db.rpc("mod_karar", { p_token: g.token, p_id: b.id, p_onay: true, p_slug: slug, p_not: String(g.not || "") });
    if (e3) { return yanit({ hata: e3.message }, 400); }
    await db.storage.from("onay-kuyrugu").remove([b.dosya_yolu]);
    return yanit({ tamam: true, slug });
  }
  return yanit({ hata: "bilinmeyen işlem" }, 400);
});
