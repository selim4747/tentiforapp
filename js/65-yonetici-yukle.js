/* Yalnızca yöneticinin kullandığı betikler (roman/ses/basın düzenleyicisi, kurulum yardımcısı) yayın paketinde
   index.html'e konmaz (scripts/paketle.mjs); panel açılınca burada yüklenir. Geliştirirken hepsi zaten yüklüdür. */

const YONETICI_BETIKLERI = ["js/25-panel-roman-ses-basin.js", "js/43-kurulum.js"];
let yoneticiBetikSozu = null;

function yoneticiBetikleriHazir() {
  return typeof yoneticiRoman === "function" && typeof yoneticiKurulum === "function";
}

function yoneticiBetikleriYukle() {
  if (yoneticiBetikleriHazir()) { return Promise.resolve(); }
  if (yoneticiBetikSozu) { return yoneticiBetikSozu; }
  yoneticiBetikSozu = YONETICI_BETIKLERI.reduce(function (onceki, yol) {
    return onceki.then(function () {
      return new Promise(function (coz) {
        const s = document.createElement("script");
        s.src = yol;
        s.onload = coz;
        s.onerror = function () { yoneticiBetikSozu = null; coz(); };
        document.body.appendChild(s);
      });
    });
  }, Promise.resolve());
  return yoneticiBetikSozu;
}

if (typeof yoneticiCiz === "function") {
  const eskiYoneticiCiz = yoneticiCiz;
  window.yoneticiCiz = function () {
    const acik = (typeof panelAcik === "function" && panelAcik()) || (typeof yoneticiAcik === "function" && yoneticiAcik());
    if (acik && !yoneticiBetikleriHazir()) {
      const bu = this, arg = arguments;
      yoneticiBetikleriYukle().then(function () { eskiYoneticiCiz.apply(bu, arg); });
      /* yüklenene kadar panel, eksik sekmeler olmadan çizilir (sekme gövdeleri yüklenince yeniden) */
      try { return eskiYoneticiCiz.apply(this, arguments); } catch (_) { return undefined; }
    }
    return eskiYoneticiCiz.apply(this, arguments);
  };
}
