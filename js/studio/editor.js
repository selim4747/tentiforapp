/* TentiforApp 4.0 · studio/editor — evren kurma kuralları. Seviye kilidi evren kurmadan kalktı:
   ücretsiz her okur 1 evren taslağı kurar; Yaratıcı Pro sınırsız. Tek seferlik evren kodu (evren1) bir hak daha verir,
   seviye 15 kodu ve yönetici sınırsız kalır. Sınıra gelince seviye penceresi yerine Pro penceresi açılır. */

function tf4EvrenSayisi() { return typeof fanEserlerim === "function" ? fanEserlerim().filter(function (x) { return x.tur === "evren" && !x.e99; }).length : 0; }

function tf4EvrenSinirsiz() {
  return tf4ProMu() || (typeof svkYonetici === "function" && svkYonetici()) ||
    (typeof seviyeKoduSeviyesi === "function" && typeof SEVIYE_URETIM !== "undefined" && seviyeKoduSeviyesi() >= SEVIYE_URETIM.evren.seviye);
}

/* 85'teki tek seferlik hak mantığı "taban"a bakar: taban = sınırsız ya da ilk taslak */
window.evrenTabanAcik = function () { return tf4EvrenSinirsiz() || tf4EvrenSayisi() < 1; };

if (typeof uretimAcik === "function") {
  const eskiUA40 = uretimAcik;
  window.uretimAcik = function (tur) {
    if (tur !== "evren") { return eskiUA40.apply(this, arguments); }
    return evrenTabanAcik() || (typeof evren1Var === "function" && evren1Var());
  };
}
if (typeof seviyeUyari === "function") {
  const eskiSU40 = seviyeUyari;
  window.seviyeUyari = function (tur) {
    if (tur === "evren") { proPencereAc("Ücretsiz planda 1 evren taslağı var; " + tf4EvrenSayisi() + " evrenin hazır. Daha fazlası için Yaratıcı Pro."); return; }
    return eskiSU40.apply(this, arguments);
  };
}
if (typeof SEVIYE_URETIM !== "undefined" && SEVIYE_URETIM.evren) { SEVIYE_URETIM.evren.ad = "Fan evreni (1 taslak ücretsiz, Pro’da sınırsız)"; }

/* ana sayfanın en altındaki kart: kilit seviye değil, taslak hakkı */
if (typeof anaEvrenlerCiz === "function") {
  const eskiAEC40b = anaEvrenlerCiz;
  window.anaEvrenlerCiz = function () {
    const r = eskiAEC40b.apply(this, arguments);
    const k = document.querySelector("#anaEvrenler .ana-kur");
    if (!k) { return r; }
    const acik = uretimAcik("evren"), pro = tf4ProMu();
    k.classList.toggle("kilitli", !acik);
    k.innerHTML = acik
      ? '<b>Evrenini kur</b><span class="ana-evren-not">' + (pro ? "Yaratıcı Pro: sınırsız evren." : (tf4EvrenSayisi() < 1 ? "Ücretsiz: ilk evren taslağın hazır seni bekliyor." : "Tek seferlik hakkınla bir evren daha.")) +
          ' Tömye kadar derin bir evren: adım adım Kurucu.</span><button type="button" class="dugme" data-es-yeni>+ Yeni evren kur</button>'
      : '<b><span aria-hidden="true">🔒 </span>Evrenini kur</b><span class="ana-evren-not">Ücretsiz plandaki 1 evren taslağını kullandın. Yaratıcı Pro ile sınırsız evren kurarsın; tek seferlik bir evren kodun varsa girişten sonra gir.</span>' +
        '<div class="oyun-sira"><button type="button" class="dugme" data-pro-ac>Pro’ya geç · ' + TF4_PRO_FIYAT + '</button><button type="button" class="dugme dugme-sade" data-kod-ac="1">Kodum var</button></div>';
    return r;
  };
}
document.addEventListener("tf4-uyelik", function () { try { anaEvrenlerCiz(); } catch (_) { /* yok */ } });
