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
let meYukleniyor = false;

function meMetin(s) {
  return String(s == null ? "" : s)
    .replace(/\\x27/gi, "'")
    .replace(/\\u0027/gi, "'");
}

function meKacir(s) {
  return typeof kacir === "function" ? kacir(meMetin(s)) : meMetin(s);
}

function meGeceStil() {
  if (document.getElementById("meGeceStil")) return;
  const s = document.createElement("style");
  s.id = "meGeceStil";
  s.textContent =
    'html[data-ayar-tema="gece"] #modelEvren .ce-sayi b,' +
    'html[data-ayar-tema="gece"] #modelEvren .ce-kisi-ad,' +
    'html[data-ayar-tema="gece"] #modelEvren .evr-baslik,' +
    'html[data-ayar-tema="gece"] #modelEvren .olay-baslik {' +
    "font-weight:600;color:var(--murekkep);-webkit-text-fill-color:var(--murekkep);}" +
    'html[data-ayar-tema="gece"] #modelEvren .ce-sayi,' +
    'html[data-ayar-tema="gece"] #modelEvren .ce-kurallar,' +
    'html[data-ayar-tema="gece"] #modelEvren .ce-kisi,' +
    'html[data-ayar-tema="gece"] #modelEvren .me-yer-kart,' +
    'html[data-ayar-tema="gece"] #modelEvren .me-harita-kutu,' +
    'html[data-ayar-tema="gece"] #modelEvren .mektup,' +
    'html[data-ayar-tema="gece"] #modelEvren .olay-kart {' +
    "background:var(--beyaz);border-color:var(--sig);color:var(--murekkep);}" +
    'html[data-ayar-tema="gece"] #modelEvren .ce-sayi span,' +
    'html[data-ayar-tema="gece"] #modelEvren .ce-kisi-ozet,' +
    'html[data-ayar-tema="gece"] #modelEvren .oyun-not {' +
    "color:var(--murekkep-2);}" +
    'html[data-ayar-tema="gece"] #modelEvren .me-test-uyari {' +
    "background:rgba(127,178,220,0.08);border-left-color:var(--deniz);}" +
    'html[data-ayar-tema="gece"] #modelEvren .me-glif {' +
    "border-color:var(--sig);color:var(--murekkep);background:var(--buz);}";
  document.head.appendChild(s);
}

function meNorm(ham) {
  if (!ham || typeof ham !== "object") return null;
  const v = Object.assign({}, ham);
  if (!v.yerler && v.harita && Array.isArray(v.harita.yerler)) v.yerler = v.harita.yerler;
  (v.kisiler || []).forEach(function (k, i) {
    if (!k.id) k.id = k.ad || ("kisi-" + i);
  });
  (v.baglar || []).forEach(function (b) {
    const kisi = function (ad) {
      return (v.kisiler || []).find(function (k) { return k.id === ad || k.ad === ad; });
    };
    const a = kisi(b.a);
    const c = kisi(b.b);
    if (a) b.a = a.id;
    if (c) b.b = c.id;
  });
  return v;
}

function meKaynak() {
  if (typeof veri !== "undefined" && veri && veri.modelEvreni) return veri.modelEvreni;
  if (typeof window !== "undefined" && window.veri && window.veri.modelEvreni) return window.veri.modelEvreni;
  return window.__meVeriCache || null;
}

function meVeri() {
  return meNorm(meKaynak());
}

function meVeriYukle(sonra) {
  if (meKaynak()) {
    if (sonra) sonra();
    return;
  }
  if (meYukleniyor) return;
  meYukleniyor = true;
  fetch("evrenler/fornek-eterya.json", { cache: "no-cache" }).then(function (r) {
    if (!r.ok) throw new Error("eterya");
    return r.json();
  }).then(function (j) {
    window.__meVeriCache = j;
    if (typeof veri !== "undefined" && veri) veri.modelEvreni = j;
    else if (typeof window !== "undefined") {
      window.veri = window.veri || {};
      window.veri.modelEvreni = j;
    }
  }).catch(function () {
    /* dosya yoksa mevcut boş durum çizilir */
  }).then(function () {
    meYukleniyor = false;
    if (sonra) sonra();
  });
}

function meKisi(v, id) {
  return (v.kisiler || []).find(function (x) { return x.id === id || x.ad === id; }) || { ad: id };
}

function meKuralListesi() {
  const v = meVeri();
  if (!v || !v.kurallar) return "";
  return '<div class="madde-liste">' + v.kurallar.map(function (k, i) {
    const acik = i === 0;
    return '<div class="madde' + (acik ? ' acik' : '') + '" id="me-kural-' + meKacir(k.id || k.ad) + '">' +
      '<button class="madde-bas" aria-expanded="' + (acik ? 'true' : 'false') + '">' +
        '<span class="madde-baslik">' + meKacir(k.ad) + ' <span class="oyun-not">(' + meKacir(k.tur) + ')</span></span>' +
        '<span class="madde-ok">›</span>' +
      '</button>' +
      '<div class="madde-govde okuma-metin"><p>' + meKacir(k.aciklama) + '</p></div>' +
    '</div>';
  }).join("") + '</div>';
}

function meDunyaHtml() {
  const v = meVeri();
  if (!v || !v.yerler) return "";
  return '<div class="kutu-y me-harita-kutu">' +
    '<span class="oyun-etiket">Eterya Coğrafyası & Kırık Alanları</span>' +
    '<p class="oyun-not">Çapraz yerçekiminin ve eter kırıklarının etkisi altındaki bölgeler:</p>' +
    '<div class="alinti-izgara">' +
      v.yerler.map(function (y) {
        return '<div class="kutu-y me-yer-kart" id="me-yer-' + meKacir(y.id || y.ad) + '">' +
          '<b>' + meKacir(y.ad) + '</b> <span class="oyun-not">· ' + meKacir(y.tur) + '</span>' +
          '<p style="font-size:13px; margin:6px 0 0 0;">' + meKacir(y.not) + '</p>' +
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
        const kA = meKisi(v, b.a);
        const kB = meKisi(v, b.b);
        return '<li><b>' + meKacir(kA.ad) + '</b> ⇄ <b>' + meKacir(kB.ad) + '</b>: <span class="oyun-not">' + meKacir(b.etiket) + '</span></li>';
      }).join("") +
    '</ul></details>' : '';

  return baglarHtml + '<div class="ce-kisiler">' + v.kisiler.map(function (k) {
    const kBag = baglar.filter(function (b) { return b.a === k.id || b.b === k.id; }).map(function (b) {
      const digerId = b.a === k.id ? b.b : b.a;
      const diger = meKisi(v, digerId);
      return '<li><b>' + meKacir(diger.ad) + '</b> — ' + meKacir(b.etiket) + '</li>';
    }).join("");

    return '<details class="ce-kisi" id="me-' + meKacir(k.id) + '">' +
      '<summary>' +
        '<span class="ce-kisi-ad">' + meKacir(k.ad) + '</span>' +
        '<span class="ce-kisi-unvan">' + meKacir(k.unvan || "") + '</span>' +
        '<span class="ce-kisi-ozet">' + meKacir(k.ozet || "") + '</span>' +
      '</summary>' +
      '<div class="detay-metin okuma-metin">' + (typeof paragraf === "function" ? paragraf(meMetin(k.detay || "")) : meKacir(k.detay || "")) + '</div>' +
      (kBag ? '<ul class="ce-baglar">' + kBag + '</ul>' : '') +
    '</details>';
  }).join("") + '</div>';
}

function meHikayelerHtml() {
  const v = meVeri();
  if (!v || !v.hikayeler) return "";
  return v.hikayeler.map(function (h) {
    const kisiler = (h.karakterler || []).map(function (kid) {
      const k = meKisi(v, kid);
      return '<span class="olay-kisi">' + meKacir(k.ad) + '</span>';
    }).join("");

    return '<details class="olay-kart ce-hikaye" id="me-hikaye-' + meKacir(h.id) + '">' +
      '<summary>' +
        '<h3 class="olay-baslik">' + meKacir(h.baslik) + '</h3>' +
        (kisiler ? '<div class="olay-kisiler">' + kisiler + '</div>' : '') +
      '</summary>' +
      '<div class="detay-metin">' + (typeof paragraf === "function" ? paragraf(meMetin(h.metin)) : meKacir(h.metin)) + '</div>' +
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
    '<h3 class="evr-baslik">' + meKacir(roman.baslik || "Roman") + '</h3>' +
    (roman.ozet ? '<p class="oyun-not">' + meKacir(roman.ozet) + '</p>' : '') +
    '<details class="evr-icindekiler">' +
      '<summary>İçindekiler · ' + bolumler.length + ' bölüm</summary>' +
      '<ol>' +
        bolumler.map(function (b, idx) {
          return '<li><button class="ic-bag" data-me-roman="' + meKacir(b.id) + '">' + (idx + 1) + '. ' + meKacir(b.baslik) + '</button></li>';
        }).join("") +
      '</ol>' +
    '</details>' +
    '<h4 class="evr-bolum-baslik">' + (i + 1) + '. ' + meKacir(aktifBolum.baslik) + '</h4>' +
    '<div class="okuma-metin fan-metin ce-roman-metin">' + (typeof paragraf === "function" ? paragraf(meMetin(aktifBolum.metin)) : meKacir(aktifBolum.metin)) + '</div>' +
    '<div class="oyun-sira evr-gez">' +
      (i > 0 ? '<button class="dugme dugme-sade" data-me-roman="' + meKacir(bolumler[i - 1].id) + '">← Önceki bölüm</button>' : '') +
      (i + 1 < bolumler.length ? '<button class="dugme" data-me-roman="' + meKacir(bolumler[i + 1].id) + '">Sonraki bölüm →</button>' : '') +
    '</div>' +
  '</div>';
}

function meBelgelerHtml() {
  const v = meVeri();
  if (!v) return "";
  const mektuplar = v.mektuplar || [];
  const glifler = [
    ["A", "Üçgen Glif"],
    ["E", "Merdiven Glif"],
    ["I", "Dikey Çubuk"],
    ["O", "Dairesel Glif"],
    ["U", "Çanak Glif"]
  ];

  return '<div class="mektup-liste">' +
    mektuplar.map(function (m) {
      return '<div class="mektup" id="me-' + meKacir(m.id) + '">' +
        '<div class="mektup-ust">' + meKacir(m.kimden) + ' → ' + meKacir(m.kime) + '</div>' +
        '<div class="mektup-not">' + meKacir(m.not || "") + '</div>' +
        '<div class="mektup-metin okuma-metin">' + (typeof paragraf === "function" ? paragraf(meMetin(m.metin)) : meKacir(m.metin)) + '</div>' +
      '</div>';
    }).join("") +
  '</div>' +
  '<div class="kutu-y" style="margin-top:16px;">' +
    '<span class="oyun-etiket">Işık Glifi Alfabesi Kılavuzu</span>' +
    '<p class="oyun-not">Eterya sakinlerinin havada parmak uçlarıyla çizdikleri beş ana sesli glif:</p>' +
    '<div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:10px;">' +
      glifler.map(function (g) {
        return '<div class="me-glif" style="padding:6px 12px; border:1px solid var(--sig, var(--renk-kenar, #33475C)); border-radius:6px; font-weight:600; font-size:13px;">' + meKacir(g[0] + ": " + g[1]) + '</div>';
      }).join("") +
    '</div>' +
  '</div>';
}

function meSozlukHtml() {
  const v = meVeri();
  if (!v || !v.sozluk) return "";
  return '<dl class="sozluk-liste" id="me-sozluk">' +
    v.sozluk.slice().sort(function (a, b) {
      return String(a.terim || "").localeCompare(String(b.terim || ""), "tr");
    }).map(function (s) {
      return '<div class="sozluk-madde">' +
        '<dt>' + meKacir(s.terim) + '</dt>' +
        '<dd>' + meKacir(s.tanim) + '</dd>' +
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
            '<span class="madde-baslik">' + meKacir(s.soru) + '</span>' +
            '<span class="madde-ok">›</span>' +
          '</button>' +
          '<div class="madde-govde"><p>' + meKacir(s.not || "") + '</p></div>' +
        '</div>';
      }).join("") +
    '</div>';
}

function modelEvrenCiz() {
  meGeceStil();
  const alan = document.querySelector("#modelEvrenAlan");
  if (!alan) return;
  const v = meVeri();
  if (!v) {
    alan.innerHTML = '<p class="oyun-not">Model evreni yükleniyor…</p>';
    meVeriYukle(function () {
      if (meVeri()) modelEvrenCiz();
      else alan.innerHTML = '<p class="oyun-not">Model evreni yüklenemedi.</p>';
    });
    return;
  }

  const sekmeRenderer = {
    genel: function () {
      return '<p class="oyun-giris">' + meKacir(v.ozet || "").replace(/\n/g, "</p><p class=\"oyun-giris\">") + '</p>' +
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
              return '<li><b>' + meKacir(k.ad) + ':</b> ' + meKacir(k.aciklama) + '</li>';
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
        return '<button class="filtre-btn' + (meSekme === s[0] ? ' secili' : '') + '" data-me-sekme="' + s[0] + '">' + meKacir(s[1]) + '</button>';
      }).join("") +
    '</div>' +
    '<div class="me-govde">' + govdeHtml + '</div>' +
    '<div class="kutu-y me-test-uyari" style="margin-top:24px; border-left:4px solid var(--deniz, var(--renk-vurgu, #7FB2DC)); padding:14px 18px; border-radius:4px;">' +
      '<span class="oyun-etiket" style="color:var(--deniz, var(--renk-vurgu, #7FB2DC)); font-weight:700;">Kanon Dışı · Yapay Zekâ Test Evreni · v4.6.1</span>' +
      '<p style="margin:6px 0 0 0; font-size:13.5px; line-height:1.55; color:var(--murekkep, var(--renk-metin, inherit));">' +
        'Tıpkı Claude tarafından yapılan evren gibi bu evren de yapay zekâ tarafından oluşturulmuş bir test evrenidir (v4.6.1). ' +
        'Tentiforverse kanonuna dahil değildir; Evren Kurucu’nun tüm yeteneklerini (kurallar, yerler/harita, karakterler, ilişki ağı, hikâyeler, mektuplar, sözlük, açık sorular ve glif alfabesi) insanlara canlı sergilemek amacıyla test olarak hazırlanmıştır.' +
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
