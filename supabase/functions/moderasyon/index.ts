// @ts-nocheck — sade JavaScript; Deno tip denetimi gerekmez.
// TentiforApp 4.2 — moderatör ve kurucu işlemleri. Supabase → Edge Functions → adı "moderasyon".
//
// Moderatör hesap açmaz: erişim koduyla aldığı oturum anahtarını (token) gönderir. İki seviye: "fan" moderatör yalnızca
// fan-made onaylar; "kanon" moderatör fan-made ve kanon onaylar, yayındakini kaldırır, kanon/fan-made değiştirir.
// Onaylanan evren ve hikâye Supabase'de TUTULMAZ: GitHub deposuna yazılır (evren: evrenler/<adres>.json + veri.json özeti;
// hikâye: veri.json fanEserleri.hikayeler). Kayıtlarda "[skip ci]" vardır: site kendiliğinden kurulmaz, yönetici Yayınla'ya basar.
// Kuyruktaki geçici dosya karar verilince silinir. Kararlar gönderene site/uygulama bildirimi ve (açtıysa) itme bildirimi olarak gider.
//
// Gizli değerler (Edge Functions → Secrets):
//   GITHUB_TOKEN  — depoya yazma izni (fine-grained: yalnızca bu depo, Contents: Read and write)
//   GITHUB_DEPO, GITHUB_DAL — isteğe bağlı (varsayılan "selim4747/tentiforapp", "main")
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT — isteğe bağlı; varsa itme bildirimi de gider (bildirim-gonder ile aynı)
//
// İşlemler (moderatör, token ile): giris, onizle, onayla { kanon }, reddet { not }, kanon { slug, kanon }, kaldir { tur, slug },
//   sikayetler, sikayet_kapat { tur, slug }
// İşlemler (giriş yapmış kullanıcı, Authorization ile): kurucu_onizle { id }, kurucu_karar { id, onay, not }, kurucuya_bildir { id }

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ---------- yardımcılar (saf; testte taklit edilir) ---------- */
const b64 = (metin) => { const b = new TextEncoder().encode(metin); let s = ""; for (let i = 0; i < b.length; i += 8192) { s += String.fromCharCode(...b.subarray(i, i + 8192)); } return btoa(s); };
const b64Coz = (s) => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, "")), (c) => c.charCodeAt(0)));
const SLUG = /^[a-z0-9][a-z0-9-]{2,59}$/;

function githubAraci(ortam, getir) {
  const depo = ortam.GITHUB_DEPO || "selim4747/tentiforapp", dal = ortam.GITHUB_DAL || "main";
  const istek = (yol, secenek) => {
    if (!ortam.GITHUB_TOKEN) { throw new Error("GITHUB_TOKEN gizli değeri yok (Supabase → Edge Functions → Secrets)."); }
    return getir("https://api.github.com/repos/" + depo + "/contents/" + yol + (secenek && secenek.method ? "" : "?ref=" + dal), Object.assign({
      headers: { Authorization: "Bearer " + ortam.GITHUB_TOKEN, Accept: "application/vnd.github+json", "User-Agent": "tentiforapp-moderasyon" },
    }, secenek || {}));
  };
  const oku = async (yol) => {
    const r = await istek(yol);
    if (r.status === 404) { return null; }
    if (!r.ok) { throw new Error("GitHub okunamadı (" + r.status + ")"); }
    const j = await r.json();
    let metin = j.content ? b64Coz(j.content) : "";
    if (!metin && j.download_url) { metin = await (await getir(j.download_url)).text(); }
    return { metin, sha: j.sha };
  };
  const yaz = async (yol, metin, mesaj, sha) => {
    const govde = { message: mesaj, content: b64(metin), branch: dal };
    if (sha) { govde.sha = sha; }
    const r = await istek(yol, { method: "PUT", body: JSON.stringify(govde) });
    if (!r.ok) { const e = new Error("GitHub'a yazılamadı (" + r.status + ")"); e.durum = r.status; throw e; }
  };
  const sil = async (yol, mesaj) => {
    const d = await oku(yol);
    if (!d) { return false; }
    const r = await istek(yol, { method: "DELETE", body: JSON.stringify({ message: mesaj, sha: d.sha, branch: dal }) });
    if (!r.ok) { throw new Error("GitHub'dan silinemedi (" + r.status + ")"); }
    return true;
  };
  /** veri.json'u değiştirip yazar; panel aynı anda kaydettiyse yeniden dener. */
  const veriDegistir = async (fn, mesaj) => {
    for (let deneme = 0; deneme < 3; deneme++) {
      const d = await oku("veri.json");
      if (!d) { throw new Error("veri.json bulunamadı"); }
      const v = JSON.parse(d.metin);
      const sonuc = fn(v);
      try { await yaz("veri.json", JSON.stringify(v, null, 2) + "\n", mesaj, d.sha); return sonuc; }
      catch (e) { if (e.durum !== 409 && e.durum !== 422) { throw e; } }
    }
    throw new Error("veri.json şu an başka bir kayıtla çakışıyor; biraz sonra yeniden dene.");
  };
  return { oku, yaz, sil, veriDegistir };
}

/* sitenin veri.json'da tuttuğu kısa özet (js/engine/54-evren-dosyalari.js evdOzet ile aynı) */
function evrenOzeti(e, yol, boyut) {
  const say = (l) => (Array.isArray(l) ? l : []).length;
  const o = { bicim: "tentifor-eser", surum: 1, tur: "evren", id: e.id, ad: e.ad || "", yazar: e.yazar || "",
    ozet: String(e.ozet || "").slice(0, 400), dosya: yol, boyut: boyut || 0,
    sayilar: { kural: say(e.kurallar), kisi: say(e.kisiler), yer: say((e.harita || {}).yerler), gezegen: say(e.gezegenler),
      bolum: say((e.roman || {}).bolumler), cizim: say(e.cizimler) } };
  ["eklenme", "olusturma", "guncelleme", "para", "alfabe", "stil", "yazar_kadi"].forEach((k) => { if (e[k]) { o[k] = e[k]; } });
  if ((e.konuklar || []).length) { o.konuklar = e.konuklar; }
  const kapak = (e.cizimler || []).find((c) => c.yol);
  if (kapak) { o.kapak = kapak.yol; }
  return o;
}

async function pushGonder(a, kullanici, baslik, metin, adres) {
  const o = a.ortam;
  if (!a.webpush || !kullanici || !o.VAPID_PUBLIC_KEY || !o.VAPID_PRIVATE_KEY) { return 0; }
  try {
    a.webpush.setVapidDetails(o.VAPID_SUBJECT || "https://tentiforapp.pages.dev", o.VAPID_PUBLIC_KEY, o.VAPID_PRIVATE_KEY);
    const { data } = await a.db.from("bildirim_abonelikleri").select("endpoint,p256dh,auth").eq("kullanici", kullanici).limit(10);
    let n = 0;
    for (const s of data || []) {
      try { await a.webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ baslik, metin, adres: adres || "/" }), { TTL: 86400 }); n++; }
      catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) { await a.db.from("bildirim_abonelikleri").delete().eq("endpoint", s.endpoint); } }
    }
    return n;
  } catch (_) { return 0; }
}

/* ---------- iş mantığı: istek gövdesi + araçlar → { durum, veri } ---------- */
async function moderasyonIsle(g, a) {
  const cevap = (veri, durum) => ({ durum: durum || 200, veri });
  const db = a.db;

  /* giriş: kod yalnızca sunucuda karşılaştırılır (veritabanında özeti durur) */
  if (g.islem === "giris") {
    const kod = String(g.kod || "").trim();
    if (kod.length < 8 || kod.length > 80) { return cevap({ hata: "Kod geçersiz." }, 400); }
    const { data: token, error } = await db.rpc("moderator_giris", { p_kod: kod });
    if (error || !token) { return cevap({ hata: /deneme/.test((error && error.message) || "") ? "Çok deneme yapıldı; biraz bekle." : "Kod geçersiz." }, 401); }
    const { data: bilgi } = await db.rpc("moderator_bilgi", { p_token: token });
    return cevap({ token, duzey: (bilgi && bilgi.duzey) || "fan", ad: (bilgi && bilgi.ad) || "" });
  }

  /* kurucu işlemleri: giriş yapmış kullanıcı (evrenin kurucusu) */
  if (/^kurucu/.test(String(g.islem || ""))) {
    const kul = a.kullanici;
    if (!kul) { return cevap({ hata: "giriş gerekli" }, 401); }
    const { data: b } = await db.from("basvurular").select("*").eq("id", g.id).maybeSingle();
    if (!b) { return cevap({ hata: "başvuru yok" }, 404); }
    if (g.islem === "kurucuya_bildir") {
      if (b.gonderen !== kul.id || b.durum !== "kurucu_bekliyor") { return cevap({ tamam: false }); }
      const { data: s } = await db.from("evren_sahipleri").select("kullanici").eq("slug", b.evren_slug).maybeSingle();
      return cevap({ tamam: true, gonderilen: await pushGonder(a, s && s.kullanici, "Evrenine yeni hikâye", "“" + b.baslik + "” onayını bekliyor.", "/sen/") });
    }
    const { data: s } = await db.from("evren_sahipleri").select("kullanici").eq("slug", b.evren_slug).maybeSingle();
    if (!s || s.kullanici !== kul.id || b.durum !== "kurucu_bekliyor") { return cevap({ hata: "bu hikâye senin onayını beklemiyor" }, 403); }
    if (g.islem === "kurucu_onizle") {
      const { data, error } = await db.storage.from("onay-kuyrugu").createSignedUrl(b.dosya_yolu, 60);
      return error ? cevap({ hata: error.message }, 500) : cevap({ adres: data.signedUrl });
    }
    if (g.islem === "kurucu_karar") {
      const { error } = await a.kullaniciDb.rpc("kurucu_karar", { p_id: b.id, p_onay: g.onay === true, p_not: String(g.not || "") });
      if (error) { return cevap({ hata: error.message }, 400); }
      if (g.onay !== true) { await db.storage.from("onay-kuyrugu").remove([b.dosya_yolu]); }
      await pushGonder(a, b.gonderen, "Hikâyen hakkında", g.onay === true ? "Kurucu “" + b.baslik + "” hikâyeni onayladı; şimdi moderatörlerde." : "Kurucu “" + b.baslik + "” hikâyeni reddetti.", "/sen/");
      return cevap({ tamam: true });
    }
    return cevap({ hata: "bilinmeyen işlem" }, 400);
  }

  /* moderatör işlemleri */
  const { data: mod } = await db.rpc("moderator_bilgi", { p_token: String(g.token || "") });
  if (!mod) { return cevap({ hata: "moderatör oturumu yok ya da süresi doldu" }, 401); }
  const kanonYetki = mod.duzey === "kanon";
  const imza = " · moderatör: " + (mod.ad || "?") + " [skip ci]";

  if (g.islem === "sikayetler") {
    const { data, error } = await db.rpc("mod_sikayetler", { p_token: g.token });
    return error ? cevap({ hata: error.message }, 400) : cevap({ liste: data || [] });
  }
  if (g.islem === "sikayet_kapat") {
    const { error } = await db.rpc("mod_sikayet_kapat", { p_token: g.token, p_tur: g.tur, p_slug: g.slug });
    return error ? cevap({ hata: error.message }, 400) : cevap({ tamam: true });
  }
  if (g.islem === "kanon") {
    if (!kanonYetki) { return cevap({ hata: "Kanon kararı yalnızca kanon moderatörün." }, 403); }
    const id = String(g.slug || "");
    const bulundu = await a.gh.veriDegistir((v) => {
      const e = (((v.fanEserleri || {}).evrenler) || []).find((x) => x.id === id);
      if (!e) { return false; }
      if (g.kanon) { e.kanon = true; } else { delete e.kanon; }
      return true;
    }, (g.kanon ? "Kanona alındı: " : "Fan-made yapıldı: ") + id + imza);
    return bulundu ? cevap({ tamam: true }) : cevap({ hata: "evren bulunamadı" }, 404);
  }
  if (g.islem === "kaldir") {
    if (!kanonYetki) { return cevap({ hata: "Yayından kaldırmak yalnızca kanon moderatörün." }, 403); }
    const tur = g.tur === "hikaye" ? "hikaye" : "evren", id = String(g.slug || "");
    if (!/^[\w-]{1,60}$/.test(id)) { return cevap({ hata: "adres geçersiz" }, 400); }
    const mesaj = (tur === "hikaye" ? "Hikâye" : "Evren") + " yayından kaldırıldı: " + id + imza;
    const bulundu = await a.gh.veriDegistir((v) => {
      const l = ((v.fanEserleri || {})[tur === "hikaye" ? "hikayeler" : "evrenler"]) || [];
      const i = l.findIndex((x) => x.id === id);
      if (i === -1) { return false; }
      l.splice(i, 1);
      return true;
    }, mesaj);
    if (tur === "evren") { await a.gh.sil("evrenler/" + id + ".json", mesaj); }
    await db.rpc("mod_sikayet_kapat", { p_token: g.token, p_tur: tur, p_slug: id });
    return bulundu ? cevap({ tamam: true }) : cevap({ hata: "bulunamadı" }, 404);
  }

  const { data: b } = await db.from("basvurular").select("*").eq("id", g.id).maybeSingle();
  if (!b || b.durum !== "bekliyor") { return cevap({ hata: "başvuru yok ya da karar verilmiş" }, 404); }

  if (g.islem === "onizle") {
    const { data, error } = await db.storage.from("onay-kuyrugu").createSignedUrl(b.dosya_yolu, 60);
    if (error) { return cevap({ hata: error.message }, 500); }
    return cevap({ adres: data.signedUrl, eski: b.guncelle_slug ? "evrenler/" + b.guncelle_slug + ".json" : null });
  }
  if (g.islem === "reddet") {
    await db.storage.from("onay-kuyrugu").remove([b.dosya_yolu]);
    const { error } = await db.rpc("mod_karar", { p_token: g.token, p_id: b.id, p_onay: false, p_slug: null, p_not: String(g.not || "") });
    if (error) { return cevap({ hata: error.message }, 400); }
    await pushGonder(a, b.gonderen, (b.tur === "hikaye" ? "Hikâyen" : "Evrenin") + " reddedildi", "“" + b.baslik + "”" + (g.not ? ": " + String(g.not).slice(0, 140) : ""), "/sen/");
    return cevap({ tamam: true });
  }
  if (g.islem === "onayla") {
    const kanon = g.kanon === true;
    if (kanon && !kanonYetki) { return cevap({ hata: "Bu kod yalnızca fan-made onaylar; kanon için kanon moderatör gerekir." }, 403); }
    const guncelleme = b.tur === "evren" && b.guncelle_slug;
    const slug = guncelleme ? b.guncelle_slug : String(g.slug || "").toLowerCase();
    if (!SLUG.test(slug)) { return cevap({ hata: "Yayın adresi 3–60 küçük harf, rakam ya da tire olmalı." }, 400); }

    const { data: dosya, error: e1 } = await db.storage.from("onay-kuyrugu").download(b.dosya_yolu);
    if (e1) { return cevap({ hata: e1.message }, 500); }
    const eser = JSON.parse(await a.gunzip(dosya));
    if (!eser || eser.bicim !== "tentifor-eser" || eser.tur !== b.tur) { return cevap({ hata: "Paket beklenen türde değil." }, 400); }
    const { data: profil } = await db.from("profiller").select("kullanici_adi").eq("id", b.gonderen).maybeSingle();
    eser.id = slug;
    eser.eklenme = new Date().toISOString().slice(0, 10);
    if (profil && profil.kullanici_adi) { eser.yazar_kadi = profil.kullanici_adi; }
    delete eser.lorlar; delete eser.yoneticiOzet; delete eser.test; delete eser.durum;
    const mesaj = (guncelleme ? "Evren güncellendi: " : (b.tur === "hikaye" ? "Hikâye onaylandı: " : "Evren onaylandı: ")) + (eser.ad || eser.baslik || slug) +
      (b.tur === "evren" ? (kanon ? " (kanon)" : " (fan-made)") : "") + imza;

    if (b.tur === "evren") {
      if (!guncelleme && await a.gh.oku("evrenler/" + slug + ".json")) { return cevap({ hata: "Bu adres kullanılıyor; başka bir yayın adresi yaz." }, 409); }
      const yol = "evrenler/" + slug + ".json", metin = JSON.stringify(eser, null, 2) + "\n";
      const eskiDosya = guncelleme ? await a.gh.oku(yol) : null;
      await a.gh.yaz(yol, metin, mesaj, eskiDosya && eskiDosya.sha);
      await a.gh.veriDegistir((v) => {
        v.fanEserleri = v.fanEserleri || {};
        const l = v.fanEserleri.evrenler = v.fanEserleri.evrenler || [];
        const o = evrenOzeti(eser, yol, new TextEncoder().encode(metin).length);
        const i = l.findIndex((x) => x.id === slug);
        if (kanon || (i !== -1 && l[i].kanon === true)) { o.kanon = true; }   /* güncelleme kanon işaretini korur */
        if (i === -1) { l.push(o); } else { l[i] = o; }
      }, mesaj);
    } else {
      const hid = await a.gh.veriDegistir((v) => {
        v.fanEserleri = v.fanEserleri || {};
        const l = v.fanEserleri.hikayeler = v.fanEserleri.hikayeler || [];
        let id = slug, n = 2;
        while (l.some((x) => x.id === id)) { id = slug.slice(0, 55) + "-" + n++; }
        eser.id = id;
        l.push(eser);
        return id;
      }, mesaj);
      eser.id = hid;
    }
    const { error: e3 } = await db.rpc("mod_karar", { p_token: g.token, p_id: b.id, p_onay: true, p_slug: eser.id, p_not: String(g.not || "") });
    if (e3) { return cevap({ hata: e3.message }, 400); }
    await db.storage.from("onay-kuyrugu").remove([b.dosya_yolu]);
    await pushGonder(a, b.gonderen, (b.tur === "hikaye" ? "Hikâyen" : "Evrenin") + " onaylandı", "“" + b.baslik + "” site güncellenince yayında.", b.tur === "evren" ? "/ev/fan/" + eser.id : "/fan/");
    return cevap({ tamam: true, slug: eser.id, kanon });
  }
  return cevap({ hata: "bilinmeyen işlem" }, 400);
}

/* ---------- Deno sunucusu ---------- */
Deno.serve(async (istek) => {
  if (istek.method === "OPTIONS") { return new Response("ok", { headers: CORS }); }
  if (istek.method !== "POST") { return new Response(JSON.stringify({ hata: "yalnızca POST" }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } }); }
  let g;
  try { g = await istek.json(); } catch (_) { g = null; }
  let sonuc;
  if (!g) { sonuc = { durum: 400, veri: { hata: "geçersiz istek" } }; }
  else {
    const ortam = Deno.env.toObject();
    const db = createClient(ortam.SUPABASE_URL, ortam.SUPABASE_SERVICE_ROLE_KEY);
    const yetki = istek.headers.get("Authorization") || "";
    const kullaniciDb = createClient(ortam.SUPABASE_URL, ortam.SUPABASE_ANON_KEY, { global: { headers: { Authorization: yetki } } });
    let kullanici = null;
    if (/^kurucu/.test(String(g.islem || ""))) { try { kullanici = (await kullaniciDb.auth.getUser()).data.user; } catch (_) { kullanici = null; } }
    const araclar = { db, kullaniciDb, kullanici, ortam, webpush, gh: githubAraci(ortam, fetch),
      gunzip: async (blob) => await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text() };
    try { sonuc = await moderasyonIsle(g, araclar); }
    catch (e) { sonuc = { durum: 500, veri: { hata: e.message || String(e) } }; }
  }
  return new Response(JSON.stringify(sonuc.veri), { status: sonuc.durum, headers: { ...CORS, "Content-Type": "application/json" } });
});
