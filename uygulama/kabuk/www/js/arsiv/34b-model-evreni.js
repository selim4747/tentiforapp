const ME_SEKMELER = [
  ["genel", "Genel"],
  ["kurallar", "Kurallar & Fizik"],
  ["dunya", "Dünya & Harita"],
  ["kisiler", "Kişiler & Bağlar"],
  ["hikayeler", "Hikâyeler"],
  ["roman", "Roman"],
  ["belgeler", "Belgeler"],
  ["sozluk", "Sözlük"],
  ["sorular", "Açık sorular"]
];
let meSekme = "genel";
let meRomanSecili = "bolum-1";

function meVeri() {
  return (typeof veri !== "undefined" && veri && veri.modelEvreni) || null;
}

function meKuralListesi() {
  const v = meVeri();
  if (!v || !v.kurallar) return "";
  return '<div class="madde-liste">' + v.kurallar.map(function (k, i) {
    const acik = i === 0;
    return '<div class="madde' + (acik ? ' acik' : '') + '" id="me-kural-' + kacir(k.id) + '">' +
      '<button class="madde-bas" aria-expanded="' + (acik ? 'true' : 'false') + '">' +
        '<span class="madde-baslik">' + kacir(k.ad) + ' <span class="oyun-not">(' + kacir(k.tur) + ')</span></span>' +
        '<span class="madde-ok">›</span>' +
      '</button>' +
      '<div class="madde-govde okuma-metin"><p>' + kacir(k.aciklama) + '</p></div>' +
    '</div>';
  }).join("") + '</div>';
}

function meDunyaHtml() {
  const v = meVeri();
  if (!v || !v.yerler) return "";
  return '<div class="kutu-y me-harita-kutu">' +
    '<span class="oyun-etiket">Eterya Coğrafyası & Kırık Alanları</span>' +
    '<p class="oyun-not">Çapraz yerçekiminin ve eter kırıklarının etkisi altındaki dört ana bölge:</p>' +
    '<div class="alinti-izgara">' +
      v.yerler.map(function (y) {
        return '<div class="kutu-y me-yer-kart" id="me-yer-' + kacir(y.id) + '">' +
          '<b>' + kacir(y.ad) + '</b> <span class="oyun-not">· ' + kacir(y.tur) + '</span>' +
          '<p style="font-size:13px; margin:6px 0 0 0;">' + kacir(y.not) + '</p>' +
          '<div class="oyun-not" style="margin-top:6px;">Koordinat: ' + y.x + '% / ' + y.y + '%</div>' +
        '</div>';
      }).join("") +
    '</div>' +
  '</div>';
}

function meKisilerHtml() {
  const v = meVeri();
  if (!v || !v.kisiler) return "";
  const baglar = v.baglar || [];
  
  const baglarHtml = baglar.length ? '<details class="kutu-y ia-bolum me-ag" open>' +
    '<summary class="oyun-etiket">Kişiler Arası İlişki Ağı</summary>' +
    '<ul class="mod-yayin" style="margin-top:8px;">' +
      baglar.map(function (b) {
        const kA = v.kisiler.find(function (x) { return x.id === b.a; }) || { ad: b.a };
        const kB = v.kisiler.find(function (x) { return x.id === b.b; }) || { ad: b.b };
        return '<li><b>' + kacir(kA.ad) + '</b> ⇄ <b>' + kacir(kB.ad) + '</b>: <span class="oyun-not">' + kacir(b.etiket) + '</span></li>';
      }).join("") +
    '</ul></details>' : '';

  return baglarHtml + '<div class="ce-kisiler">' + v.kisiler.map(function (k) {
    const kBag = baglar.filter(function (b) { return b.a === k.id || b.b === k.id; }).map(function (b) {
      const digerId = b.a === k.id ? b.b : b.a;
      const diger = v.kisiler.find(function (x) { return x.id === digerId; });
      return '<li><b>' + kacir(diger ? diger.ad : digerId) + '</b> — ' + kacir(b.etiket) + '</li>';
    }).join("");

    return '<details class="ce-kisi" id="me-' + kacir(k.id) + '">' +
      '<summary>' +
        '<span class="ce-kisi-ad">' + kacir(k.ad) + '</span>' +
        '<span class="ce-kisi-unvan">' + kacir(k.unvan || "") + '</span>' +
        '<span class="ce-kisi-ozet">' + kacir(k.ozet || "") + '</span>' +
      '</summary>' +
      '<div class="detay-metin okuma-metin">' + paragraf(k.detay || "") + '</div>' +
      (kBag ? '<ul class="ce-baglar">' + kBag + '</ul>' : '') +
    '</details>';
  }).join("") + '</div>';
}

function meHikayelerHtml() {
  const v = meVeri();
  if (!v || !v.hikayeler) return "";
  return v.hikayeler.map(function (h) {
    const kisiler = (h.karakterler || []).map(function (kid) {
      const k = (v.kisiler || []).find(function (x) { return x.id === kid; });
      return '<span class="olay-kisi">' + kacir(k ? k.ad : kid) + '</span>';
    }).join("");

    return '<details class="olay-kart ce-hikaye" id="me-hikaye-' + kacir(h.id) + '">' +
      '<summary>' +
        '<h3 class="olay-baslik">' + kacir(h.baslik) + '</h3>' +
        (kisiler ? '<div class="olay-kisiler">' + kisiler + '</div>' : '') +
      '</summary>' +
      '<div class="detay-metin">' + paragraf(h.metin) + '</div>' +
    '</details>';
  }).join("");
}

function meRomanHtml() {
  const v = meVeri();
  const roman = v && v.roman;
  const bolumler = (roman && roman.bolumler) || [];
  if (!bolumler.length) return '<p class="oyun-not">Bu evrenin henüz romanı yok.</p>';

  let i = bolumler.findIndex(function (b) { return b.id === meRomanSecili; });
  if (i === -1) i = 0;
  const aktifBolum = bolumler[i];
  meRomanSecili = aktifBolum.id;

  return '<div class="evr-oku ce-roman">' +
    '<h3 class="evr-baslik">' + kacir(roman.baslik || "Roman") + '</h3>' +
    (roman.ozet ? '<p class="oyun-not">' + kacir(roman.ozet) + '</p>' : '') +
    '<details class="evr-icindekiler">' +
      '<summary>İçindekiler · ' + bolumler.length + ' bölüm</summary>' +
      '<ol>' +
        bolumler.map(function (b, idx) {
          return '<li><button class="ic-bag" data-me-roman="' + kacir(b.id) + '">' + (idx + 1) + '. ' + kacir(b.baslik) + '</button></li>';
        }).join("") +
      '</ol>' +
    '</details>' +
    '<h4 class="evr-bolum-baslik">' + (i + 1) + '. ' + kacir(aktifBolum.baslik) + '</h4>' +
    '<div class="okuma-metin fan-metin ce-roman-metin">' + paragraf(aktifBolum.metin) + '</div>' +
    '<div class="oyun-sira evr-gez">' +
      (i > 0 ? '<button class="dugme dugme-sade" data-me-roman="' + kacir(bolumler[i - 1].id) + '">← Önceki bölüm</button>' : '') +
      (i + 1 < bolumler.length ? '<button class="dugme" data-me-roman="' + kacir(bolumler[i + 1].id) + '">Sonraki bölüm →</button>' : '') +
    '</div>' +
  '</div>';
}

function meBelgelerHtml() {
  const v = meVeri();
  if (!v) return "";
  const mektuplar = v.mektuplar || [];

  return '<div class="mektup-liste">' +
    mektuplar.map(function (m) {
      return '<div class="mektup" id="me-' + kacir(m.id) + '">' +
        '<div class="mektup-ust">' + kacir(m.kimden) + ' → ' + kacir(m.kime) + '</div>' +
        '<div class="mektup-not">' + kacir(m.not || "") + '</div>' +
        '<div class="mektup-metin okuma-metin">' + paragraf(m.metin) + '</div>' +
      '</div>';
    }).join("") +
  '</div>' +
  '<div class="kutu-y" style="margin-top:16px;">' +
    '<span class="oyun-etiket">Işık Glifi Alfabesi Kılavuzu</span>' +
    '<p class="oyun-not">Eterya sakinlerinin havada parmak uçlarıyla çizdikleri beş ana sesli glif:</p>' +
    '<div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:10px;">' +
      ['A: Üçgen Glif', 'E: Merdiven Glif', 'I: Dikey Çubuk', 'O: Dairesel Glif', 'U: Çanak Glif'].map(function (g) {
        return '<div style="padding:6px 12px; border:1px solid var(--renk-kenar, #ddd); border-radius:6px; font-weight:600; font-size:13px;">' + kacir(g) + '</div>';
      }).join("") +
    '</div>' +
  '</div>';
}

function meSozlukHtml() {
  const v = meVeri();
  if (!v || !v.sozluk) return "";
  return '<dl class="sozluk-liste" id="me-sozluk">' +
    v.sozluk.slice().sort(function (a, b) {
      return a.terim.localeCompare(b.terim, "tr");
    }).map(function (s) {
      return '<div class="sozluk-madde">' +
        '<dt>' + kacir(s.terim) + '</dt>' +
        '<dd>' + kacir(s.tanim) + '</dd>' +
      '</div>';
    }).join("") +
  '</dl>';
}

function meSorularHtml() {
  const v = meVeri();
  if (!v || !v.sorular) return "";
  return '<p class="oyun-not">Eterya evreninde henüz sırrı çözülmemiş açık sorular:</p>' +
    '<div class="madde-liste">' +
      v.sorular.map(function (s) {
        return '<div class="madde">' +
          '<button class="madde-bas" aria-expanded="false">' +
            '<span class="madde-baslik">' + kacir(s.soru) + '</span>' +
            '<span class="madde-ok">›</span>' +
          '</button>' +
          '<div class="madde-govde"><p>' + kacir(s.not || "") + '</p></div>' +
        '</div>';
      }).join("") +
    '</div>';
}

function modelEvrenCiz() {
  const alan = document.querySelector("#modelEvrenAlan");
  if (!alan) return;
  const v = meVeri();
  if (!v) {
    alan.innerHTML = '<p class="oyun-not">Model evreni yüklenemedi.</p>';
    return;
  }

  const sekmeRenderer = {
    genel: function () {
      return '<p class="oyun-giris">' + kacir(v.ozet || "") + '</p>' +
        '<div class="ce-sayilar">' +
          [
            [(v.kurallar || []).length, "temel kural"],
            [(v.kisiler || []).length, "karakter"],
            [(v.yerler || []).length, "bölge"],
            [(v.hikayeler || []).length, "hikâye"],
            [(v.sozluk || []).length, "terim"]
          ].map(function (s) {
            return '<div class="ce-sayi"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>';
          }).join("") +
        '</div>' +
        '<div class="ce-kurallar">' +
          '<span class="oyun-etiket">Temel Doğa Yasaları</span>' +
          '<ol>' +
            (v.kurallar || []).map(function (k) {
              return '<li><b>' + kacir(k.ad) + ':</b> ' + kacir(k.aciklama) + '</li>';
            }).join("") +
          '</ol>' +
        '</div>' +
        meDunyaHtml();
    },
    kurallar: meKuralListesi,
    dunya: meDunyaHtml,
    kisiler: meKisilerHtml,
    hikayeler: meHikayelerHtml,
    roman: meRomanHtml,
    belgeler: meBelgelerHtml,
    sozluk: meSozlukHtml,
    sorular: meSorularHtml
  }[meSekme];

  const govdeHtml = sekmeRenderer ? sekmeRenderer() : '<p class="oyun-not">İçerik bulunamadı.</p>';

  alan.innerHTML = 
    '<div class="filtre ce-sekmeler">' +
      ME_SEKMELER.map(function (s) {
        return '<button class="filtre-btn' + (meSekme === s[0] ? ' secili' : '') + '" data-me-sekme="' + s[0] + '">' + kacir(s[1]) + '</button>';
      }).join("") +
    '</div>' +
    '<div class="me-govde">' + govdeHtml + '</div>' +
    '<div class="kutu-y me-test-uyari" style="margin-top:24px; border-left:4px solid var(--renk-vurgu, #2f81f7); padding:14px 18px; background:rgba(47,129,247,0.06); border-radius:4px;">' +
      '<span class="oyun-etiket" style="color:var(--renk-vurgu, #2f81f7); font-weight:700;">Kanon Dışı · Yapay Zekâ Test Evreni · v4.6.1</span>' +
      '<p style="margin:6px 0 0 0; font-size:13.5px; line-height:1.55; color:var(--renk-metin, inherit);">' +
        'Tıpkı Claude tarafından yapılan evren gibi bu evren de yapay zekâ tarafından oluşturulmuş bir test evrenidir (v4.6.1). ' +
        'Tentiforverse kanonuna dahil değildir; Evren Kurucu\\x27nun tüm yeteneklerini (kurallar, yerler/harita, karakterler, ilişki ağı, hikâyeler, mektuplar, sözlük, açık sorular ve glif alfabesi) insanlara canlı sergilemek amacıyla test olarak hazırlanmıştır.' +
      '</p>' +
    '</div>';
}

document.addEventListener("click", function (e) {
  const sekmeBtn = e.target.closest("[data-me-sekme]");
  if (sekmeBtn) {
    meSekme = sekmeBtn.dataset.meSekme;
    modelEvrenCiz();
    return;
  }
  const romanBtn = e.target.closest("[data-me-roman]");
  if (romanBtn) {
    meRomanSecili = romanBtn.dataset.meRoman;
    modelEvrenCiz();
    const baslik = document.querySelector("#modelEvrenAlan .evr-bolum-baslik");
    if (baslik) baslik.scrollIntoView({ block: "start", behavior: "smooth" });
  }
});
