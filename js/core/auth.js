/* TentiforApp 4.0 · core/auth — moderatör erişim kodu. Moderatör hesap açmaz: kodu girer, sunucu
   (public.moderator_giris) 12 saatlik bir oturum anahtarı verir; anahtar yalnızca bu sekmede tutulur. */

const TF4_MOD_ANAHTAR = "tf4_mod";

function moderatorToken() { try { return sessionStorage.getItem(TF4_MOD_ANAHTAR) || ""; } catch (_) { return ""; } }

async function moderatorGiris(kod) {
  const k = String(kod || "").trim();
  if (k.length < 8) { throw new Error("Kod en az 8 karakter."); }
  const s = await tf4Istemci();
  const { data, error } = await s.rpc("moderator_giris", { p_kod: k });
  if (error || !data) { throw new Error(/deneme/.test((error && error.message) || "") ? "Çok deneme yapıldı; biraz bekle." : "Kod geçersiz."); }
  try { sessionStorage.setItem(TF4_MOD_ANAHTAR, data); } catch (_) { /* yok */ }
  TF4.moderator = data;
  return true;
}

function moderatorCikis() { try { sessionStorage.removeItem(TF4_MOD_ANAHTAR); } catch (_) { /* yok */ } TF4.moderator = null; }

/** Kodun sunucudaki özeti: sha256(BÜYÜK HARF kod + "#mod"), SQL'deki mod_ozet ile aynı. */
async function moderatorKodOzeti(kod) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(kod).trim().toUpperCase() + "#mod"));
  return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
}

function moderatorKodUret() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = new Uint32Array(20);
  crypto.getRandomValues(r);
  return "MOD-" + Array.from(r).map(function (x) { return a[x % a.length]; }).join("").replace(/(.{5})(?=.)/g, "$1-");
}
