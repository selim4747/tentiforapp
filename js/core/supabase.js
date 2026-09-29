/* TentiforApp 4.0 · core/supabase — veritabanı ve depolama istemcisi.
   Kütüphane (213 KB) yalnızca gerçekten gerekince iner (js/28-hesap.js hesapGerekli). Herkese açık okumalar
   (vitrin, yayındaki evren dosyaları) kütüphanesiz, düz fetch ile yapılır ve cihazda önbelleklenir. */

const TF4 = { uyelik: { pro: false, tip: "ucretsiz", bitis: null }, moderator: null };

async function tf4Istemci() {
  if (typeof hesapGerekli === "function") { await hesapGerekli(); }
  if (typeof hesapIstemci === "undefined" || !hesapIstemci) { throw new Error("Sunucuya bağlanılamadı."); }
  return hesapIstemci;
}

function tf4Adres(yol) { return HESAP_AYAR.url.replace(/\/$/, "") + yol; }

/** Herkese açık REST okuması (kütüphanesiz); sonuç cihazda `sure` ms önbelleklenir. */
async function tf4AcikOku(yol, anahtar, sure) {
  try { const o = JSON.parse(localStorage.getItem(anahtar) || "null"); if (o && Date.now() - o.t < sure) { return o.v; } } catch (_) { /* yok */ }
  const r = await fetch(tf4Adres(yol), { headers: { apikey: HESAP_AYAR.anahtar } });
  if (!r.ok) { throw new Error("Okunamadı (" + r.status + ")"); }
  const v = await r.json();
  try { localStorage.setItem(anahtar, JSON.stringify({ t: Date.now(), v: v })); } catch (_) { /* yok */ }
  return v;
}

/* sıkıştırma: tarayıcının kendi gzip'i (Android WebView dahil); ek kütüphane yok */
async function tf4Sikistir(metin) {
  if (typeof CompressionStream !== "function") { throw new Error("Bu tarayıcı sıkıştırmayı desteklemiyor; güncel bir tarayıcı dene."); }
  return new Response(new Blob([metin]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
}
async function tf4Ac(blob) {
  if (typeof DecompressionStream !== "function") { throw new Error("Bu tarayıcı sıkıştırılmış dosyayı açamıyor."); }
  return new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text();
}

async function tf4Fonksiyon(ad, govde) {
  const s = await tf4Istemci();
  const { data, error } = await s.functions.invoke(ad, { body: govde || {} });
  if (error) {
    let m = error.message || String(error);
    try { const j = await error.context.json(); if (j && j.hata) { m = j.hata; } } catch (_) { /* yok */ }
    throw new Error(m);
  }
  if (data && data.hata) { throw new Error(data.hata); }
  return data;
}
