/* TentiforApp 4.0 · core/auth — moderatör erişim kodu. Moderatör hesap açmaz: kodu girer, sunucu
   (public.moderator_giris) 12 saatlik bir oturum anahtarı verir; anahtar yalnızca bu sekmede tutulur. */

const TF4_MOD_ANAHTAR = "tf4_mod";

function moderatorToken() { try { return sessionStorage.getItem(TF4_MOD_ANAHTAR) || ""; } catch (_) { return ""; } }

/* 4.1: kod doğrudan "moderasyon" Edge Function'ına gider ve orada doğrulanır; bu dosyada hiçbir kod yazılı değildir.
   Dönen oturum anahtarı (token) yalnızca bu sekmede, oturum süresince tutulur. Fonksiyon henüz kurulmadıysa
   aynı doğrulamayı yapan veritabanı fonksiyonuna (moderator_giris) düşer. */
async function moderatorGiris(kod) {
  const k = String(kod || "").trim();
  if (k.length < 8) { throw new Error("Kod en az 8 karakter."); }
  let token = "", duzey = "";
  try {
    const r = await tf4Fonksiyon("moderasyon", { islem: "giris", kod: k });
    if (!r || typeof r.token !== "string" || r.token.length < 20) { throw new Error("fonksiyon yanıtı yok"); }
    token = r.token; duzey = r.duzey;
  } catch (e) {
    if (/geçersiz|deneme/.test(e.message || "")) { throw e; }
    const s = await tf4Istemci();
    const { data, error } = await s.rpc("moderator_giris", { p_kod: k });
    if (error || !data) { throw new Error(/deneme/.test((error && error.message) || "") ? "Çok deneme yapıldı; biraz bekle." : "Kod geçersiz."); }
    token = data;
  }
  try { sessionStorage.setItem(TF4_MOD_ANAHTAR, token); if (duzey) { sessionStorage.setItem("tf4_mod_duzey", duzey === "kanon" ? "kanon" : "fan"); } } catch (_) { /* yok */ }
  TF4.moderator = token;
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
