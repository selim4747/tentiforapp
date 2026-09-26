// @ts-nocheck — sade JavaScript; Deno tip denetimi gerekmez.
// TentiforApp — yeni bölüm bildirimi gönderen Supabase Edge Function.
//
// Supabase panelinde: Edge Functions → Deploy a new function → Via editor → adı "bildirim-gonder",
// bu dosyanın tamamını yapıştır → Deploy. Gizli değerler (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  — sitenin panelinde Bakım → Bildirim → "Anahtar üret"
//   VAPID_SUBJECT (isteğe bağlı)         — örn. https://tentifor.netlify.app
// SUPABASE_URL, SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından kendiliğinden verilir.
//
// Yalnızca tam yönetici çağırabilir: istekteki oturumla public.tam_yonetici_mi() sorulur.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function yanit(veri, durum) {
  return new Response(JSON.stringify(veri), { status: durum || 200, headers: { ...CORS, "Content-Type": "application/json" } });
}

/** Bağlantı yalnızca sitenin içinde kalır: "/" ile başlamalı, "//" ile değil. */
function guvenliAdres(a) {
  const s = String(a || "/").slice(0, 300);
  return /^\/(?!\/)/.test(s) ? s : "/";
}

export async function bildirimIsle(istek, ortam, araclar) {
  if (istek.method === "OPTIONS") { return new Response("ok", { headers: CORS }); }
  if (istek.method !== "POST") { return yanit({ durum: "yontem" }, 405); }

  const url = ortam.SUPABASE_URL, anon = ortam.SUPABASE_ANON_KEY, servis = ortam.SUPABASE_SERVICE_ROLE_KEY;
  if (!ortam.VAPID_PUBLIC_KEY || !ortam.VAPID_PRIVATE_KEY) { return yanit({ durum: "ayarsiz", mesaj: "VAPID anahtarları Secrets'a girilmemiş" }, 500); }

  const kullanici = araclar.createClient(url, anon, {
    global: { headers: { Authorization: istek.headers.get("Authorization") || "" } },
    auth: { persistSession: false },
  });
  const yetki = await kullanici.rpc("tam_yonetici_mi");
  if (yetki.error || yetki.data !== true) { return yanit({ durum: "yetki" }, 403); }

  let g;
  try { g = await istek.json(); } catch (_) { return yanit({ durum: "bos" }, 400); }
  const baslik = String((g && g.baslik) || "").trim().slice(0, 80);
  const metin = String((g && g.metin) || "").trim().slice(0, 200);
  if (!baslik) { return yanit({ durum: "bos" }, 400); }
  const yuk = JSON.stringify({ baslik: baslik, metin: metin, adres: guvenliAdres(g.adres) });

  araclar.webpush.setVapidDetails(ortam.VAPID_SUBJECT || "https://tentifor.netlify.app", ortam.VAPID_PUBLIC_KEY, ortam.VAPID_PRIVATE_KEY);
  const yonetim = araclar.createClient(url, servis, { auth: { persistSession: false } });

  let gonderilen = 0, hata = 0, bas = 0;
  const olu = [];
  const SAYFA = 500, DALGA = 50;
  for (;;) {
    const s = await yonetim.from("bildirim_abonelikleri").select("endpoint,p256dh,auth").order("endpoint").range(bas, bas + SAYFA - 1);
    if (s.error) { return yanit({ durum: "hata", mesaj: s.error.message }, 500); }
    const liste = s.data || [];
    for (let i = 0; i < liste.length; i += DALGA) {
      await Promise.all(liste.slice(i, i + DALGA).map(function (a) {
        return araclar.webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, yuk, { TTL: 86400, urgency: "normal" })
          .then(function () { gonderilen++; })
          .catch(function (e) {
            /* 404/410: abonelik artık yok (kullanıcı izni kaldırdı ya da tarayıcıyı sildi) */
            if (e && (e.statusCode === 404 || e.statusCode === 410)) { olu.push(a.endpoint); } else { hata++; }
          });
      }));
    }
    if (liste.length < SAYFA) { break; }
    bas += SAYFA;
  }
  for (let i = 0; i < olu.length; i += 200) {
    await yonetim.from("bildirim_abonelikleri").delete().in("endpoint", olu.slice(i, i + 200));
  }
  return yanit({ durum: "tamam", gonderilen: gonderilen, silinen: olu.length, hata: hata });
}

if (typeof Deno !== "undefined") {
  Deno.serve(function (istek) {
    return bildirimIsle(istek, Deno.env.toObject(), { createClient: createClient, webpush: webpush })
      .catch(function (e) { return yanit({ durum: "hata", mesaj: String((e && e.message) || e) }, 500); });
  });
}
