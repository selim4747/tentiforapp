/* TentiforApp 4.0 · engine/evren-motoru — herhangi bir standart evren paketini (fan evren biçimi, JSON) alıp
   sitenin evren görüntüleyicisinde açar: harita, zaman, kişiler, hikâyeler. Önizleme (sandbox) modunda paket
   cihazda kalıcı olmaz; kapanınca silinir.
   4.0.3: onaylanan evrenler Supabase'de değil GitHub'da (evrenler/<adres>.json + veri.json): sitenin sıradan fan
   evrenleri gibi listelere girer, çevrimdışı açılır; sunucuya ek okuma yok. */

const MOTOR = { onizleme: null };

function evrenMotoruAc(ham, secenek) {
  const o = secenek || {};
  const e = typeof ham === "string" ? fanTemizle(JSON.parse(ham)) : fanTemizle(ham);
  if (!e || e.tur !== "evren") { throw new Error("Bu bir evren paketi değil."); }
  e.id = (o.onizleme ? "onizle-" : "acilan-") + String(o.slug || e.id).slice(0, 30);
  fanAcilanEkle(e);
  MOTOR.onizleme = o.onizleme ? e.id : null;
  document.documentElement.toggleAttribute("data-onizleme", !!o.onizleme);
  location.hash = "#/ev/acilan/" + e.id;
  return e.id;
}

/* önizleme bitince (evren sayfasından çıkınca) paket cihazdan silinir */
window.addEventListener("hashchange", function () {
  const r = typeof rota === "function" ? rota() : location.hash;   /* site adresi yol olarak tutar (/ev/acilan/…) */
  if (!MOTOR.onizleme || r.indexOf("#/ev/acilan/" + MOTOR.onizleme) === 0) { return; }
  try { jsonYaz(FAN_ACILAN_ANAHTAR, (jsonOku(FAN_ACILAN_ANAHTAR, []) || []).filter(function (x) { return x && x.id !== MOTOR.onizleme; })); } catch (_) { /* yok */ }
  MOTOR.onizleme = null;
  document.documentElement.removeAttribute("data-onizleme");
});

/* eski paylaşım adresi #/yayin/<adres> → sitenin fan evreni #/ev/fan/<adres> */
function yayinAdresiBak() {
  const m = /^#\/yayin\/([a-z0-9-]+)/.exec(typeof rota === "function" ? rota() : location.hash);
  if (m) { location.hash = "#/ev/fan/" + m[1]; }
}

/* önizlenen evrenin cihazdaki kopyası panelde "kanona aday" diye görünmesin */
if (typeof kanonAdaylari === "function") {
  const eskiKA402 = kanonAdaylari;
  window.kanonAdaylari = function () { return eskiKA402.apply(this, arguments).filter(function (x) { return !(x.kaynak === "acilan" && /^(yayin|onizle|acilan)-/.test(x.e.id || "")); }); };
}

/* 4.2: sitedeki okur evreninde "Bildir" (şikâyet; moderatörlere gider) */
if (typeof evaEylemHtml === "function") {
  const eskiEEH42 = evaEylemHtml;
  window.evaEylemHtml = function (v) {
    const h = eskiEEH42.apply(this, arguments);
    if (!h || typeof EVS === "undefined" || !EVS || EVS.kaynak !== "fan") { return h; }
    return h.replace(/<\/div><\/div>$/, '<button class="dugme dugme-sade" data-evren-bildir="' + kacir(EVS.id) + '">Bildir</button></div></div>');
  };
}
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evren-bildir]");
  if (!b || typeof sikayetEt !== "function") { return; }
  sikayetEt("evren", b.getAttribute("data-evren-bildir"), function (m) { if (typeof eckaBildir === "function") { eckaBildir(m); } });
});
