/* Cloudflare Pages Function: /api/pano?t=<tablo>
   Herkese aynı görünen liderlik listelerini Supabase'den bir kez okur, Cloudflare'in önbelleğinde 10 dakika tutar.
   Böylece her ziyaretçi ayrı ayrı Supabase'e gitmez: istek ve log sayısı düşer. Site (js/29-liderlik.js) önce buraya
   bakar; bu adres yoksa ya da hata verirse eskisi gibi doğrudan Supabase'e gider. Kişiye özel hiçbir şey burada yok. */

const SUPABASE = "https://wlgtjbrlquefnzavwein.supabase.co";
const ANAHTAR = "sb_publishable_CHM9EAA3V5nZeQcmKtR0UQ__Xyb4b_F";   /* publishable key — sitede de görünür, gizli değildir */
const SURE = 600;   /* saniye */

/* js/29-liderlik.js'teki sıralama tabloları (liderlik görünümünün sütunları) */
const SIRALAMA = ["haftalik", "sezonluk", "tamlik", "ecka_toplam", "seri", "katman", "madalya", "nobet", "cevirmen", "vardiya", "yazi", "boyut", "baloncuk"];
const SATIR = 20;

function sorgular(t) {
  if (SIRALAMA.indexOf(t) !== -1) {
    return ["/rest/v1/liderlik?select=kullanici_adi,gorunen_ad," + t + "&" + t + "=gt.0&order=" + t + ".desc,guncelleme.asc&limit=" + SATIR];
  }
  if (t === "kulupler") { return ["/rest/v1/kulupler?select=*&order=haftalik.desc"]; }
  if (t === "topluluk") { return ["/rest/v1/kulupler?select=kisilik,uye", "/rest/v1/topluluk_roller?select=rol,sayi"]; }
  return null;
}

function yanit(govde, durum, onbellek) {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": onbellek ? "public, max-age=" + SURE : "no-store",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

export async function onRequestGet(ctx) {
  const adres = new URL(ctx.request.url);
  const t = adres.searchParams.get("t") || "";
  const l = sorgular(t);
  if (!l) { return yanit({ hata: "bilinmeyen tablo" }, 404, false); }

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const anahtar = new Request(adres.origin + "/api/pano?t=" + t);
  if (cache) {
    const eski = await cache.match(anahtar);
    if (eski) { return eski; }
  }

  let veri;
  try {
    veri = await Promise.all(l.map(async function (yol) {
      const r = await fetch(SUPABASE + yol, { headers: { apikey: ANAHTAR, Accept: "application/json" } });
      if (!r.ok) { throw new Error("supabase " + r.status); }
      return r.json();
    }));
  } catch (e) {
    return yanit({ hata: String(e && e.message || e) }, 502, false);
  }

  const y = yanit({ t: t, zaman: new Date().toISOString(), veri: veri.length === 1 ? veri[0] : veri }, 200, true);
  if (cache) {
    const is = cache.put(anahtar, y.clone());
    if (ctx.waitUntil) { ctx.waitUntil(is); } else { await is; }
  }
  return y;
}
