/* TentiforApp 4.0 · studio/editor — evren kurma kuralları. Seviye kilidi evren kurmadan kalktı:
   ücretsiz her okur 1 evren taslağı kurar; Yaratıcı Pro sınırsız. Tek seferlik evren kodu (evren1) bir hak daha verir,
   seviye 15 kodu ve yönetici sınırsız kalır. Sınıra gelince seviye penceresi yerine Pro penceresi açılır. */

function tf4EvrenSayisi() { return typeof fanEserlerim === "function" ? fanEserlerim().filter(function (x) { return x.tur === "evren" && !x.e99; }).length : 0; }

/* yalnızca yerel testte (localhost): test seviyesi 15+ sınırsız sayılır (eski testler çok evren kurar) */
function tf4TestSinirsiz() {
  try { return /^(localhost|127\.)/.test(location.hostname) && Number(localStorage.getItem("tentiforapp_seviye_test")) >= 15; } catch (_) { return false; }
}

function tf4EvrenSinirsiz() {
  return tf4ProMu() || tf4TestSinirsiz() || (typeof svkYonetici === "function" && svkYonetici()) ||
    (typeof seviyeKoduSeviyesi === "function" && typeof SEVIYE_URETIM !== "undefined" && seviyeKoduSeviyesi() >= SEVIYE_URETIM.evren.seviye);
}

document.addEventListener("tf4-uyelik", function () { try { anaEvrenlerCiz(); } catch (_) { /* yok */ } });
