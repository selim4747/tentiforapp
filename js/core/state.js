/* TentiforApp 4.0 · core/state — global durum: üyelik (ücretsiz/Pro). Pro durumu cihazda 6 saat saklanır;
   ödeme ya da giriş sonrası tazelenir (sunucuya her açılışta sorulmaz). */

const TF4_UYELIK_ANAHTAR = "tf4_uyelik";

function tf4ProMu() { return !!(TF4.uyelik && TF4.uyelik.pro && (!TF4.uyelik.bitis || Date.parse(TF4.uyelik.bitis) > Date.now())); }

function tf4UyelikUygula() {
  document.documentElement.classList.toggle("tf-pro", tf4ProMu());
  try { document.dispatchEvent(new Event("tf4-uyelik")); } catch (_) { /* eski tarayıcı */ }
}

async function tf4AbonelikYukle(zorla) {
  const kim = typeof hesapKullanici !== "undefined" && hesapKullanici ? hesapKullanici.id : "";
  if (!kim) { TF4.uyelik = { pro: false, tip: "ucretsiz", bitis: null }; tf4UyelikUygula(); return TF4.uyelik; }
  try {
    const o = JSON.parse(localStorage.getItem(TF4_UYELIK_ANAHTAR) || "null");
    if (!zorla && o && o.kim === kim && Date.now() - o.t < 6 * 3600e3) { TF4.uyelik = o.v; tf4UyelikUygula(); return TF4.uyelik; }
  } catch (_) { /* yok */ }
  try {
    const { data, error } = await hesapIstemci.rpc("abonelik_durumum");
    if (error) { throw error; }
    TF4.uyelik = { pro: !!data.pro, tip: data.tip || "ucretsiz", bitis: data.bitis || null };
    try { localStorage.setItem(TF4_UYELIK_ANAHTAR, JSON.stringify({ kim: kim, t: Date.now(), v: TF4.uyelik })); } catch (_) { /* yok */ }
  } catch (_) { /* kurulum.sql 4.0 çalıştırılmadıysa ücretsiz sayılır */ }
  tf4UyelikUygula();
  return TF4.uyelik;
}

/* giriş yapınca (tek kod hakları yüklenirken) üyelik de yüklenir */
if (typeof tekHaklariYukle === "function") {
  const eskiTHY40 = tekHaklariYukle;
  window.tekHaklariYukle = async function () {
    const r = await eskiTHY40.apply(this, arguments);
    try { await tf4AbonelikYukle(false); } catch (_) { /* yok */ }
    return r;
  };
}
try { const o = JSON.parse(localStorage.getItem(TF4_UYELIK_ANAHTAR) || "null"); if (o && o.v) { TF4.uyelik = o.v; } } catch (_) { /* yok */ }
tf4UyelikUygula();
