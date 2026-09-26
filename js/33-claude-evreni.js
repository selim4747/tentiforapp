/* Claude tarafından yapılan evren — Tentiforverse'ün kanonu değildir, herkese açıktır.
   Kod kilidine girmez: bölüm KANON_BOLUMLERI'nde değil, haritası da kilitten muaf (23-kanon-kilidi.js). */

const CE_SEKMELER = [
  ["genel", "Genel"], ["fizik", "Fizik"], ["dunya", "Dünya"], ["toplum", "Toplum"], ["tarih", "Tarih"],
  ["kisiler", "Kişiler"], ["hikayeler", "Hikâyeler"], ["belgeler", "Belgeler"], ["sozluk", "Sözlük"], ["sorular", "Açık sorular"], ["oyunlar", "Oyunlar"]
];
let ceSekme = "genel";

function ceVeri() { return (typeof veri !== "undefined" && veri && veri.claudeEvreni) || null; }

function ceMaddeler(tur) {
  return (ceVeri().maddeler || []).filter(function (m) { return m.tur === tur; });
}

function ceMaddeListesi(liste, ilkAcik) {
  return '<div class="madde-liste">' + liste.map(function (m, i) {
    const acik = ilkAcik && i === 0;
    return '<div class="madde' + (acik ? " acik" : "") + '" id="ce-' + kacir(m.id) + '">' +
        '<button class="madde-bas" aria-expanded="' + (acik ? "true" : "false") + '">' +
          '<span class="madde-baslik">' + kacir(m.baslik) + yeniRozet(m) + "</span>" +
          '<span class="madde-ok">›</span>' +
        "</button>" +
        '<p class="madde-ozet">' + kacir(m.ozet || "") + "</p>" +
        '<div class="madde-govde okuma-metin">' + paragraf(m.metin) + "</div>" +
      "</div>";
  }).join("") + "</div>";
}

function ceKisiAdi(id) {
  const k = (ceVeri().kisiler || []).find(function (x) { return x.id === id; });
  return k ? k.ad : id;
}

function ceGenel() {
  const c = ceVeri();
  const fizik = ceMaddeler("fizik");
  return '<p class="oyun-giris">' + kacir(c.ozet || "") + "</p>" +
    '<div class="ce-sayilar">' +
      [[fizik.length, "fizik kuralı"], [(c.kisiler || []).length, "kişi"], [(c.hikayeler || []).length, "hikâye"],
       [(c.sozluk || []).length, "terim"]].map(function (s) {
        return '<div class="ce-sayi"><b>' + s[0] + "</b><span>" + s[1] + "</span></div>";
      }).join("") +
    "</div>" +
    '<div class="ce-kurallar"><span class="oyun-etiket">Temel kurallar</span><ol>' +
      fizik.map(function (m) {
        return '<li><button class="ic-bag" data-ce-git="fizik" data-ce-madde="' + kacir(m.id) + '">' + kacir(m.baslik) + "</button> — " +
          kacir(m.ozet) + "</li>";
      }).join("") + "</ol></div>" +
    (c.harita ? '<button class="dugme" data-ce-harita="' + kacir(c.harita) + '">Haritayı aç</button>' : "") +
    ceMaddeListesi(ceMaddeler("dunya").slice(0, 1), true);
}

function ceKisiler() {
  const c = ceVeri();
  const baglar = c.baglar || [];
  return '<div class="ce-kisiler">' + (c.kisiler || []).map(function (k) {
    const b = baglar.filter(function (x) { return x.a === k.id || x.b === k.id; }).map(function (x) {
      const oteki = x.a === k.id ? x.b : x.a;
      return '<li><b>' + kacir(ceKisiAdi(oteki)) + "</b> — " + kacir(x.etiket) + "</li>";
    }).join("");
    return '<details class="ce-kisi" id="ce-' + kacir(k.id) + '">' +
        "<summary>" +
          '<span class="ce-kisi-ad">' + kacir(k.ad) + yeniRozet(k) + "</span>" +
          '<span class="ce-kisi-unvan">' + kacir(k.unvan || "") + "</span>" +
          '<span class="ce-kisi-ozet">' + kacir(k.ozet || "") + "</span>" +
        "</summary>" +
        '<div class="detay-metin okuma-metin">' + paragraf(k.detay || "") + "</div>" +
        (b ? '<ul class="ce-baglar">' + b + "</ul>" : "") +
      "</details>";
  }).join("") + "</div>";
}

function ceHikayeler() {
  return (ceVeri().hikayeler || []).map(function (h) {
    const kisiler = (h.karakterler || []).map(function (id) { return '<span class="olay-kisi">' + kacir(ceKisiAdi(id)) + "</span>"; }).join("");
    return '<details class="olay-kart ce-hikaye" id="ce-' + kacir(h.id) + '">' +
        '<summary><h3 class="olay-baslik">' + kacir(h.baslik) + yeniRozet(h) + "</h3>" +
          (kisiler ? '<div class="olay-kisiler">' + kisiler + "</div>" : "") + "</summary>" +
        '<div class="detay-metin">' + paragraf(h.metin) + "</div>" +
        '<div class="tepki-alan" data-hedef="ce:' + kacir(String(h.id).replace(/[^A-Za-z0-9_-]/g, "")) + '"></div>' +
      "</details>";
  }).join("");
}

function ceBelgeler() {
  const c = ceVeri();
  return '<div class="mektup-liste">' + (c.mektuplar || []).map(function (m) {
      return '<div class="mektup">' +
        '<div class="mektup-ust">' + kacir(m.kimden) + " → " + kacir(m.kime) + "</div>" +
        '<div class="mektup-not">' + kacir(m.not || "") + "</div>" +
        '<div class="mektup-metin okuma-metin">' + paragraf(m.metin) + "</div></div>";
    }).join("") + "</div>" +
    '<div class="alinti-izgara">' + (c.alintilar || []).map(function (a) {
      return '<figure class="alinti"><blockquote>' + kacir(a.metin) + "</blockquote><figcaption>" + kacir(a.kim) + "</figcaption></figure>";
    }).join("") + "</div>" +
    (c.yankilar || []).map(function (y) {
      return '<div class="kutu-y ce-yanki"><span class="oyun-etiket">Yankı</span><h3>' + kacir(y.baslik) + "</h3><p>" + kacir(y.metin) + "</p>" +
        "<ul>" + (y.ornekler || []).map(function (o) { return "<li>" + kacir(o) + "</li>"; }).join("") + "</ul></div>";
    }).join("");
}

function ceSozluk() {
  const liste = (ceVeri().sozluk || []).slice().sort(function (a, b) { return a.terim.localeCompare(b.terim, "tr"); });
  return '<dl class="sozluk-liste">' + liste.map(function (s) {
    return '<div class="sozluk-madde"><dt>' + kacir(s.terim) + "</dt><dd>" + kacir(s.tanim) + "</dd></div>";
  }).join("") + "</dl>";
}

function ceSorular() {
  return '<p class="oyun-not">Bu evrende henüz cevabı yazılmamış sorular.</p>' +
    '<div class="madde-liste">' + (ceVeri().sorular || []).map(function (s) {
      return '<div class="madde"><button class="madde-bas" aria-expanded="false"><span class="madde-baslik">' + kacir(s.soru) +
        '</span><span class="madde-ok">›</span></button><div class="madde-govde"><p>' + kacir(s.not || "") + "</p></div></div>";
    }).join("") + "</div>";
}

function claudeEvrenCiz() {
  const alan = document.querySelector("#claudeEvrenAlan");
  if (!alan) { return; }
  if (!ceVeri()) { alan.innerHTML = ""; return; }
  const govde = {
    genel: ceGenel, oyunlar: function () { return typeof somdoOyunlariHtml === "function" ? somdoOyunlariHtml() : ""; }, kisiler: ceKisiler, hikayeler: ceHikayeler, belgeler: ceBelgeler, sozluk: ceSozluk, sorular: ceSorular
  }[ceSekme];
  alan.innerHTML =
    '<div class="filtre ce-sekmeler">' + CE_SEKMELER.map(function (s) {
      return '<button class="filtre-btn' + (ceSekme === s[0] ? " secili" : "") + '" data-ce-sekme="' + s[0] + '">' + kacir(s[1]) + "</button>";
    }).join("") + "</div>" +
    '<div class="ce-govde">' + (govde ? govde() : ceMaddeListesi(ceMaddeler(ceSekme), false)) + "</div>";
}

document.addEventListener("click", function (e) {
  const s = e.target.closest("[data-ce-sekme]");
  if (s) { ceSekme = s.dataset.ceSekme; claudeEvrenCiz(); return; }
  const g = e.target.closest("[data-ce-git]");
  if (g) {
    ceSekme = g.dataset.ceGit;
    claudeEvrenCiz();
    const m = document.querySelector("#ce-" + g.dataset.ceMadde);
    if (m) { m.classList.add("acik"); m.scrollIntoView({ block: "start", behavior: "smooth" }); }
    return;
  }
  const h = e.target.closest("[data-ce-harita]");
  if (h && typeof haritaTamAc === "function") { haritaTamAc({ evren: h.dataset.ceHarita }); }
});
