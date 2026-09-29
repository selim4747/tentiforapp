/* TentiforApp 4.0 · core/reklam — ücretsiz katmanda reklam yuvaları; Pro'da hiç gösterilmez.
   Kapalıyken hiçbir şey yapmaz. Açmak için veri.json'a: "reklam": { "aktif": true, "betik": "https://…", "sinif": "…" }
   (betik: reklam ağının verdiği tek betik adresi; sinif: ağın yuvalarda istediği sınıf). */

function reklamAcik() { return typeof veri !== "undefined" && veri && veri.reklam && veri.reklam.aktif === true && !tf4ProMu(); }

function reklamYuvalariCiz() {
  document.querySelectorAll("[data-reklam-yuva]").forEach(function (y) { if (!reklamAcik()) { y.remove(); } });
  if (!reklamAcik()) { return; }
  const koy = function (hedef, ad) {
    const h = document.querySelector(hedef);
    if (!h || document.querySelector('[data-reklam-yuva="' + ad + '"]')) { return; }
    h.insertAdjacentHTML("afterend", '<aside class="reklam-yuva ' + kacir(veri.reklam.sinif || "") + '" data-reklam-yuva="' + ad + '" aria-label="Reklam"><span class="reklam-etiket">Reklam · Pro’da görünmez</span></aside>');
  };
  koy("#anaEvrenler", "ana");
  koy("#karakterIzgara", "tomye");
  const b = String(veri.reklam.betik || "");
  if (/^https:\/\//.test(b) && !document.querySelector("script[data-reklam-betik]")) {
    const s = document.createElement("script"); s.src = b; s.async = true; s.setAttribute("data-reklam-betik", ""); document.head.appendChild(s);
  }
}
document.addEventListener("tf-veri-hazir", function () { setTimeout(reklamYuvalariCiz, 0); });
document.addEventListener("tf4-uyelik", reklamYuvalariCiz);
