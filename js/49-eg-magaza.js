/* Evrengezer mağazası: EG'nin harcandığı yerler ve günün evren turu.

   - Mağaza (Evrengezer bürosunun altında): harita desenleri (Neon, Yıldız haritası), Yıldız alfabesi,
     E25 kişi kartı çerçeveleri. Bir kez alınır, hesapla eşitlenir; EG harcanır (yakılır).
   - Günün evren turu: aynı gün 3 farklı evreni (sitedeki, fanmade, E99) gezene EG ödülü (45-evrengezer.js). */

const EG_TUR_HEDEF = 3;
const EG_TUR_ODUL = 3;

const EG_MAGAZA = [
  { id: "desen_neon", tur: "Harita deseni", ad: "Neon", fiyat: 15, not: "Kendi evreninin haritasında: Stil ve para → Harita stili." },
  { id: "desen_yildiz", tur: "Harita deseni", ad: "Yıldız haritası", fiyat: 25, not: "Gece göğü, yıldızlar ve altın sınırlar." },
  { id: "alfabe_yildiz", tur: "Alfabe", ad: "Yıldız alfabesi", fiyat: 15, not: "Evrenin alfabesini yıldız işaretlerinden üretir.",
    havuz: "✦✧✩✪✫✬✭✮✯✰★☆✶✷✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈" },
  { id: "cerceve_buz", tur: "Kart çerçevesi", ad: "Buz", fiyat: 10, renk: "#8CC8F0", not: "E25 kişi kartının çevresine." },
  { id: "cerceve_altin", tur: "Kart çerçevesi", ad: "Altın", fiyat: 20, renk: "#C9A227", not: "E25 kişi kartının çevresine." }
];

function egSahipMi(id) {
  const c = egYukle();
  return Array.isArray(c.alinan) && c.alinan.indexOf(id) !== -1;
}

function egMagazaAl(id) {
  const m = EG_MAGAZA.find(function (x) { return x.id === id; });
  if (!m) { return "Bulunamadı."; }
  if (egSahipMi(id)) { return "Zaten sende."; }
  const c = egYukle();
  if (c.eg < m.fiyat) { return "Yetmez: " + m.fiyat + " EG gerekiyor. Evren paralarını büroda EG'ye çevirebilirsin."; }
  c.eg -= m.fiyat;
  if (!Array.isArray(c.alinan)) { c.alinan = []; }
  c.alinan.push(id);
  egGecmis(-m.fiyat, "Mağaza: " + m.ad);
  egKaydet();
  return "";
}

/** En iyi sahip olunan kart çerçevesi (altın > buz) */
function egKartCercevesi() {
  const l = EG_MAGAZA.filter(function (m) { return m.id.indexOf("cerceve_") === 0 && egSahipMi(m.id); });
  return l.length ? l[l.length - 1] : null;
}

function egMagazaHtml() {
  const c = egYukle();
  const tur = (c.ziyaret && c.ziyaret.gun === bugununAdi()) ? (c.ziyaret.l || []).length : 0;
  return '<div class="eg-magaza"><div class="oyun-etiket">Günün evren turu</div>' +
    '<p class="oyun-not">Bugün ' + Math.min(tur, EG_TUR_HEDEF) + "/" + EG_TUR_HEDEF + " evren gezildi" +
      (c.ziyaret && c.ziyaret.tur ? " · ödül alındı" : " · tamamlayınca +" + EG_TUR_ODUL + " EG") + ". Sitedeki, fanmade ya da E99 evrenleri sayılır.</p>" +
    '<div class="oyun-etiket">Mağaza</div>' +
    EG_MAGAZA.map(function (m) {
      const var_ = egSahipMi(m.id);
      return '<div class="eg-urun"><div><b>' + kacir(m.ad) + '</b> <span class="oyun-not">' + kacir(m.tur) + "</span>" +
        '<div class="oyun-not">' + kacir(m.not) + "</div></div>" +
        (var_ ? '<span class="eg-urun-var">sende</span>' : '<button class="dugme dugme-sade" data-eg-magaza="' + m.id + '">' + m.fiyat + " EG</button>") + "</div>";
    }).join("") + "</div>";
}

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-eg-magaza]");
  if (!h) { return; }
  const hata = egMagazaAl(h.dataset.egMagaza);
  if (typeof egBuroTazele === "function") { egBuroTazele(hata || "Alındı.", !hata); }
});
