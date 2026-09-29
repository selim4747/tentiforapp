// @ts-nocheck — sade JavaScript; Deno tip denetimi gerekmez.
// TentiforApp 4.0.3 — moderatör işlemleri. Supabase → Edge Functions → adı "moderasyon".
//
// Moderatör hesap açmaz: erişim koduyla public.moderator_giris'ten aldığı oturum anahtarını (token) gönderir.
// İki seviye: "fan" moderatör yalnızca fan-made onaylar; "kanon" moderatör fan-made ve kanon onaylar.
// Onaylanan evren Supabase'de TUTULMAZ: GitHub deposuna yazılır (evrenler/<adres>.json + veri.json'daki özet),
// Kayıt mesajında "[skip ci]" vardır: site kendiliğinden kurulmaz; yönetici Yayınla'ya basınca yayına çıkar.
// Kuyruktaki geçici dosya karar verilince silinir.
//
// Gizli değerler (Edge Functions → Secrets):
//   GITHUB_TOKEN  — depoya yazma izni olan anahtar (fine-grained: yalnızca bu depo, Contents: Read and write)
//   GITHUB_DEPO   — isteğe bağlı, varsayılan "selim4747/tentiforapp";  GITHUB_DAL — isteğe bağlı, varsayılan "main"
//
// İşlemler: onizle (60 sn'lik imzalı indirme adresi), onayla ({ kanon: true|false }), reddet, kanon (yayındaki evrenin
// kanon/fan-made durumunu değiştirir; yalnızca kanon moderatör).

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const yanit = (veri, durum) => new Response(JSON.stringify(veri), { status: durum || 200, headers: { ...CORS, "Content-Type": "application/json" } });

/* ---------- GitHub ---------- */
const DEPO = () => Deno.env.get("GITHUB_DEPO") || "selim4747/tentiforapp";
const DAL = () => Deno.env.get("GITHUB_DAL") || "main";
function gh(yol, secenek) {
  const t = Deno.env.get("GITHUB_TOKEN");
  if (!t) { throw new Error("GITHUB_TOKEN gizli değeri yok (Supabase → Edge Functions → Secrets)."); }
  return fetch("https://api.github.com/repos/" + DEPO() + "/contents/" + yol + (secenek && secenek.method ? "" : "?ref=" + DAL()), Object.assign({
    headers: { Authorization: "Bearer " + t, Accept: "application/vnd.github+json", "User-Agent": "tentiforapp-moderasyon" },
  }, secenek || {}));
}
const b64 = (metin) => { const b = new TextEncoder().encode(metin); let s = ""; for (let i = 0; i < b.length; i += 8192) { s += String.fromCharCode(...b.subarray(i, i + 8192)); } return btoa(s); };
const b64Coz = (s) => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, "")), (c) => c.charCodeAt(0)));

async function ghOku(yol) {
  const r = await gh(yol);
  if (r.status === 404) { return null; }
  if (!r.ok) { throw new Error("GitHub okunamadı (" + r.status + ")"); }
  const j = await r.json();
  let metin = j.content ? b64Coz(j.content) : "";
  if (!metin && j.download_url) { metin = await (await fetch(j.download_url)).text(); }   /* 1 MB'tan büyük dosya */
  return { metin, sha: j.sha };
}
async function ghYaz(yol, metin, mesaj, sha) {
  const govde = { message: mesaj, content: b64(metin), branch: DAL() };
  if (sha) { govde.sha = sha; }
  const r = await gh(yol, { method: "PUT", body: JSON.stringify(govde) });
  if (!r.ok) { const e = new Error("GitHub'a yazılamadı (" + r.status + ")"); e.durum = r.status; throw e; }
}
/** veri.json'u değiştirip yazar; panel aynı anda kaydettiyse (409) bir kez yeniden dener. */
async function veriDegistir(fn, mesaj) {
  for (let deneme = 0; deneme < 3; deneme++) {
    const d = await ghOku("veri.json");
    if (!d) { throw new Error("veri.json bulunamadı"); }
    const v = JSON.parse(d.metin);
    const sonuc = fn(v);
    try { await ghYaz("veri.json", JSON.stringify(v, null, 2) + "\n", mesaj, d.sha); return sonuc; }
    catch (e) { if (e.durum !== 409 && e.durum !== 422) { throw e; } }
  }
  throw new Error("veri.json şu an başka bir kayıtla çakışıyor; biraz sonra yeniden dene.");
}

/* sitenin veri.json'da tuttuğu kısa özet (js/engine/54-evren-dosyalari.js evdOzet ile aynı) */
function evrenOzeti(e, yol, boyut) {
  const say = (l) => (Array.isArray(l) ? l : []).length;
  const o = { bicim: "tentifor-eser", surum: 1, tur: "evren", id: e.id, ad: e.ad || "", yazar: e.yazar || "",
    ozet: String(e.ozet || "").slice(0, 400), dosya: yol, boyut: boyut || 0,
    sayilar: { kural: say(e.kurallar), kisi: say(e.kisiler), yer: say((e.harita || {}).yerler), gezegen: say(e.gezegenler),
      bolum: say((e.roman || {}).bolumler), cizim: say(e.cizimler) } };
  ["eklenme", "olusturma", "guncelleme", "para", "alfabe", "stil"].forEach((k) => { if (e[k]) { o[k] = e[k]; } });
  if ((e.konuklar || []).length) { o.konuklar = e.konuklar; }
  const kapak = (e.cizimler || []).find((c) => c.yol);
  if (kapak) { o.kapak = kapak.yol; }
  return o;
}

async function gunzipMetin(blob) {
  const s = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(s).text();
}

Deno.serve(async (istek) => {
  if (istek.method === "OPTIONS") { return new Response("ok", { headers: CORS }); }
  if (istek.method !== "POST") { return yanit({ hata: "yalnızca POST" }, 405); }
  let g;
  try { g = await istek.json(); } catch (_) { return yanit({ hata: "geçersiz istek" }, 400); }
  const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: mod } = await db.rpc("moderator_bilgi", { p_token: String(g.token || "") });
  if (!mod) { return yanit({ hata: "moderatör oturumu yok ya da süresi doldu" }, 401); }
  const kanonYetki = mod.duzey === "kanon";

  try {
    /* yayındaki bir evrenin kanon/fan-made durumu (yalnızca kanon moderatör) */
    if (g.islem === "kanon") {
      if (!kanonYetki) { return yanit({ hata: "Kanon kararı yalnızca kanon moderatörün." }, 403); }
      const id = String(g.slug || "");
      const bulundu = await veriDegistir((v) => {
        const e = (((v.fanEserleri || {}).evrenler) || []).find((x) => x.id === id);
        if (!e) { return false; }
        if (g.kanon) { e.kanon = true; } else { delete e.kanon; }
        return true;
      }, (g.kanon ? "Kanona alındı: " : "Fan-made yapıldı: ") + id + " (moderatör: " + (mod.ad || "?") + ") [skip ci]");
      return bulundu ? yanit({ tamam: true }) : yanit({ hata: "evren bulunamadı" }, 404);
    }

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
      const kanon = g.kanon === true;
      if (kanon && !kanonYetki) { return yanit({ hata: "Bu kod yalnızca fan-made onaylar; kanon için kanon moderatör gerekir." }, 403); }
      const slug = String(g.slug || "").toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) { return yanit({ hata: "Yayın adresi 3–60 küçük harf, rakam ya da tire olmalı." }, 400); }
      if (await ghOku("evrenler/" + slug + ".json")) { return yanit({ hata: "Bu adres kullanılıyor; başka bir yayın adresi yaz." }, 409); }

      const { data: dosya, error: e1 } = await db.storage.from("onay-kuyrugu").download(b.dosya_yolu);
      if (e1) { return yanit({ hata: e1.message }, 500); }
      const evren = JSON.parse(await gunzipMetin(dosya));
      if (!evren || evren.tur !== "evren" || evren.bicim !== "tentifor-eser") { return yanit({ hata: "Paket bir evren değil." }, 400); }
      evren.id = slug;
      evren.eklenme = new Date().toISOString().slice(0, 10);
      delete evren.lorlar; delete evren.yoneticiOzet; delete evren.test; delete evren.durum;
      const metin = JSON.stringify(evren, null, 2) + "\n";
      const yol = "evrenler/" + slug + ".json";
      const mesaj = "Evren onaylandı: " + (evren.ad || slug) + (kanon ? " (kanon)" : " (fan-made)") + " · moderatör: " + (mod.ad || "?") + " [skip ci]";

      await ghYaz(yol, metin, mesaj);
      await veriDegistir((v) => {
        v.fanEserleri = v.fanEserleri || {};
        const l = v.fanEserleri.evrenler = v.fanEserleri.evrenler || [];
        const o = evrenOzeti(evren, yol, new TextEncoder().encode(metin).length);
        if (kanon) { o.kanon = true; }
        const i = l.findIndex((x) => x.id === slug);
        if (i === -1) { l.push(o); } else { l[i] = o; }
      }, mesaj);

      const { error: e3 } = await db.rpc("mod_karar", { p_token: g.token, p_id: b.id, p_onay: true, p_slug: slug, p_not: String(g.not || "") });
      if (e3) { return yanit({ hata: e3.message }, 400); }
      await db.storage.from("onay-kuyrugu").remove([b.dosya_yolu]);
      return yanit({ tamam: true, slug, kanon });
    }
    return yanit({ hata: "bilinmeyen işlem" }, 400);
  } catch (e) {
    return yanit({ hata: e.message || String(e) }, 500);
  }
});
