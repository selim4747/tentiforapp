/* Yalnızca yöneticinin kullandığı betikler (roman/ses/basın düzenleyicisi, kurulum yardımcısı) yayın paketinde
   index.html'e konmaz (scripts/paketle.mjs); panel açılınca burada yüklenir. Geliştirirken hepsi zaten yüklüdür. */

const YONETICI_BETIKLERI = ["js/admin/22b-yonetici-araclari.js", "js/admin/25-panel-roman-ses-basin.js", "js/admin/43-kurulum.js"];
let yoneticiBetikSozu = null;

/** Panel betikleri ve veri.json'un bütün parçaları hazır mı (panel tam veriyle kaydeder). */
function yoneticiBetikleriHazir() {
  return typeof yoneticiGithub === "function" && typeof yoneticiRoman === "function" && typeof yoneticiKurulum === "function" && veriParcalariHazir();
}

function yoneticiBetikleriYukle() {
  const parcalar = veriParcalariTam().catch(function () { /* internetsiz: kaydetmede yine denenir */ });
  return Promise.all([yoneticiBetikDosyalari(), parcalar]).then(function () { /* tamam */ });
}

function yoneticiBetikDosyalari() {
  if (typeof yoneticiGithub === "function" && typeof yoneticiRoman === "function" && typeof yoneticiKurulum === "function") { return Promise.resolve(); }
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

