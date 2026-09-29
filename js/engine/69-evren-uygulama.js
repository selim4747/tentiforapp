/* Evren uygulamaları — kurucu evrenine kodla (HTML + JavaScript) yeni oyun ya da özellik yazar.

   Güvenlik: kod, sitenin içinde değil, korumalı bir çerçevede çalışır:
     <iframe sandbox="allow-scripts"> (aynı köken yok → sitenin kayıtlarına, oturumuna, çerezlerine erişemez;
     açılır pencere, form, üst sayfaya yönlendirme yok) + içerik güvenlik politikası (ağ yok: fetch, dış
     betik, dış görsel yüklenmez). Site ile yalnızca postMessage ile konuşur:
       evren            → evrenin verisi (kişiler, yerler, sözlük, tarih, kurallar, harita yerleri)
       evren.kazandim() → günlük oyun XP'si (oyun başına günde bir kez; kendi evreninde ve dosyadan açılanda yok)
       evren.kaydet(v) / evren.yukle() → uygulamanın küçük kaydı (en çok 4 KB, hesapla eşitlenir)
   Sitede yayımlanan evrenlerin uygulamaları yazarın onayından geçer. */

const EVU_SINIR = 10;
const EVU_KOD_SINIR = 60000;
const EVU_DEPO = "tentiforapp_evren_uygulama";
const EVU_DEPO_SINIR = 4000;
const EVU = { acik: null, duzenle: null, silOnay: null };

/* ==================== veri ==================== */

function evuTemizle(l) {
  return (Array.isArray(l) ? l : []).slice(0, EVU_SINIR).map(function (x, i) {
    if (!x || typeof x !== "object") { return null; }
    const kod = typeof x.kod === "string" ? x.kod.slice(0, EVU_KOD_SINIR) : "";
    const ad = fanMetin(x.ad, 60).trim();
    if (!ad && !kod.trim()) { return null; }
    return { id: fanMetin(x.id, 40).replace(/[^\w-]/g, "") || ("u" + i), ad: ad || "Adsız", tur: x.tur === "ozellik" ? "ozellik" : "oyun",
      aciklama: fanMetin(x.aciklama, 300), kod: kod };
  }).filter(Boolean);
}

function evuListe(e) { return (e && e.uygulamalar) || []; }

/** Çerçeveye giden evren verisi (salt okunur kopya) */
function evuEvrenVerisi(e) {
  const al = function (l, alanlar) { return (Array.isArray(l) ? l : []).slice(0, 300).map(function (x) { const o = {}; alanlar.forEach(function (a) { if (x && x[a] !== undefined) { o[a] = x[a]; } }); return o; }); };
  return {
    ad: e.ad || "", ozet: e.ozet || "",
    kisiler: al((e.kisiler || []).filter(function (x) { return !x.kutu; }), ["ad", "rol", "aciklama"]),
    yerler: al(e.yerler, ["ad", "tur", "aciklama"]), sozluk: al(e.sozluk, ["terim", "tanim"]),
    tarih: al(e.tarih, ["zaman", "olay"]), kurallar: al(e.kurallar, ["ad", "tur", "aciklama"]),
    haritaYerleri: al(((e.harita || {}).yerler) || [], ["ad", "x", "y", "tur", "not"]),
    para: e.para ? { ad: e.para.ad, simge: e.para.simge } : null
  };
}

function evuJsonGom(o) {
  return JSON.stringify(JSON.stringify(o)).replace(/</g, "\\u003c").replace(/[\u2028]/g, "\\u2028").replace(/[\u2029]/g, "\\u2029");
}

function evuSrcdoc(e, u) {
  return '<!doctype html><html lang="tr"><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; media-src data: blob:">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<style>html{color-scheme:light dark}body{font:16px/1.5 system-ui,sans-serif;margin:12px}button,input,select{font:inherit;min-height:40px;padding:6px 12px}</style>" +
    "<script>(function(){var b={},n=0;function g(m){parent.postMessage(m,'*');}" +
    "window.evren=JSON.parse(" + evuJsonGom(evuEvrenVerisi(e)) + ");" +
    "evren.kazandim=function(){g({tip:'kazandi'});};" +
    "evren.kaydet=function(v){g({tip:'kaydet',veri:v});};" +
    "evren.skor=function(p){g({tip:'skor',puan:Number(p)||0});};" +
    "evren.yukle=function(){return new Promise(function(c){var i=++n;b[i]=c;g({tip:'yukle',id:i});});};" +
    "evren.odulOlunca=null;" +
    "addEventListener('message',function(e){var d=e.data||{};if(d.tip==='yuklendi'&&b[d.id]){b[d.id](d.veri);delete b[d.id];}" +
    "if(d.tip==='odul'&&typeof evren.odulOlunca==='function'){evren.odulOlunca(d);}});" +
    "function h(){g({tip:'yukseklik',px:document.documentElement.scrollHeight});}" +
    "addEventListener('load',h);if(window.ResizeObserver){new ResizeObserver(h).observe(document.documentElement);}" +
    "})();<\/script></head><body>" + u.kod + "</body></html>";
}

/* ==================== çalıştırma ==================== */

let evuCerceve = null;   /* { pencere, evren, uygulama } açık çerçeve */

function evuDepoAnahtari(u) { return (typeof evrenCuzdanAnahtari === "function" ? evrenCuzdanAnahtari() : "ev") + "|" + u.id; }

function evuCalistir(kap, e, u) {
  kap.innerHTML = "";
  const f = document.createElement("iframe");
  f.className = "evu-cerceve";
  f.setAttribute("sandbox", "allow-scripts");
  f.setAttribute("referrerpolicy", "no-referrer");
  f.setAttribute("title", u.ad);
  f.setAttribute("loading", "lazy");
  f.srcdoc = evuSrcdoc(e, u);
  kap.appendChild(f);
  evuCerceve = { pencere: f.contentWindow, cerceve: f, evren: e, uygulama: u };
  if (typeof evuSkorTablosu === "function") { evuSkorTablosu(kap, u); }
  /* okur evreninde: uygulamayı bildir (içerik bildirimi) */
  if (EVS && EVS.kaynak === "fan" && !onizlemeMi() && kap.parentNode && !kap.parentNode.querySelector(".ib-uygulama")) {
    kap.insertAdjacentHTML("afterend", '<p class="oyun-not ib-uygulama">' + ibDugme("uygulama", "fan:" + EVS.id + "/" + u.id, u.ad) + "</p>");
  }
}

window.addEventListener("message", function (ev) {
  const c = evuCerceve;
  if (!c || !c.cerceve.isConnected || ev.source !== c.cerceve.contentWindow) { return; }
  const d = ev.data || {};
  const cevap = function (m) { try { c.cerceve.contentWindow.postMessage(m, "*"); } catch (_) { /* kapandı */ } };
  if (d.tip === "yukseklik") {
    c.cerceve.style.height = Math.max(160, Math.min(1600, Math.round(Number(d.px) || 0) + 4)) + "px";
  } else if (d.tip === "kazandi") {
    const engel = typeof evoOdulEngeli === "function" ? evoOdulEngeli() : "";
    let xp = 0;
    if (!engel && c.uygulama.tur === "oyun" && typeof oyunXpVer === "function") { xp = oyunXpVer(evuDepoAnahtari(c.uygulama).replace(/\|/, "|kod:")); }
    const mesaj = engel ? engel.replace("oyunlar ödül vermez", "uygulamalar XP vermez") : (xp ? "+" + xp + " XP" : "Bugünün XP'sini bu oyundan aldın.");
    cevap({ tip: "odul", xp: xp, mesaj: mesaj });
    const d2 = document.querySelector("#evuDurum");
    if (d2) { d2.textContent = mesaj; }
  } else if (d.tip === "kaydet") {
    let metin = "";
    try { metin = JSON.stringify(d.veri === undefined ? null : d.veri); } catch (_) { return; }
    if (metin.length > EVU_DEPO_SINIR) { return; }
    const t = jsonOku(EVU_DEPO, {}) || {};
    t[evuDepoAnahtari(c.uygulama)] = metin;
    jsonYaz(EVU_DEPO, t);
  } else if (d.tip === "skor") {
    if (typeof evuSkorYaz === "function") { evuSkorYaz(c, d.puan, cevap); }
  } else if (d.tip === "yukle") {
    const t = jsonOku(EVU_DEPO, {}) || {};
    let v = null;
    try { v = JSON.parse(t[evuDepoAnahtari(c.uygulama)] || "null"); } catch (_) { v = null; }
    cevap({ tip: "yuklendi", id: d.id, veri: v });
  }
});

/* ==================== örnekler ==================== */

const EVU_ORNEK = {
  oyun: { ad: "Kim bu?", aciklama: "Evrenin kişileriyle beş soruluk oyun.", kod: [
    "<h2>Kim bu?</h2>", '<p id="soru"></p><div id="secenek"></div><p id="durum"></p>',
    "<script>",
    "var k = evren.kisiler.filter(function (x) { return x.ad && (x.rol || x.aciklama); });",
    "var tur = 0, dogru = 0;",
    "function karistir(l) { return l.slice().sort(function () { return Math.random() - 0.5; }); }",
    "function soru() {",
    "  if (k.length < 4) { document.getElementById('soru').textContent = 'Bu oyun için evrende en az 4 kişi olmalı.'; return; }",
    "  if (tur === 5) { document.getElementById('soru').textContent = dogru + ' / 5'; document.getElementById('secenek').innerHTML = '';",
    "    evren.skor(dogru); if (dogru >= 4) { evren.kazandim(); } return; }",
    "  var cevap = k[Math.floor(Math.random() * k.length)];",
    "  document.getElementById('soru').textContent = '“' + (cevap.rol || cevap.aciklama) + '” — bu kim?';",
    "  var s = document.getElementById('secenek'); s.innerHTML = '';",
    "  karistir([cevap].concat(karistir(k.filter(function (x) { return x !== cevap; })).slice(0, 3))).forEach(function (x) {",
    "    var b = document.createElement('button'); b.textContent = x.ad;",
    "    b.onclick = function () { if (x === cevap) { dogru++; } tur++; soru(); };",
    "    s.appendChild(b);",
    "  });",
    "}",
    "evren.odulOlunca = function (d) { document.getElementById('durum').textContent = d.mesaj; };",
    "soru();",
    "<\/script>"].join("\n") },
  ozellik: { ad: "Günün kehaneti", aciklama: "Her açılışta evrenden rastgele bir yer ve kişi; kaç kez baktığını hatırlar.", kod: [
    "<h2>Günün kehaneti</h2>", '<p id="k"></p><button id="yeni">Bir daha</button><p id="say"></p>',
    "<script>",
    "function sec(l) { return l.length ? l[Math.floor(Math.random() * l.length)] : null; }",
    "function kehanet() {",
    "  var kisi = sec(evren.kisiler), yer = sec(evren.yerler.concat(evren.haritaYerleri));",
    "  document.getElementById('k').textContent = (kisi ? kisi.ad : 'Biri') + ', bugün ' + (yer ? yer.ad : 'uzak bir yer') + ' yolunda.';",
    "}",
    "evren.yukle().then(function (v) { var n = (v && v.n || 0) + 1; evren.kaydet({ n: n });",
    "  document.getElementById('say').textContent = 'Bu kehanete ' + n + '. bakışın.'; });",
    "document.getElementById('yeni').onclick = kehanet; kehanet();",
    "<\/script>"].join("\n") }
};

/* ==================== sekme ==================== */

function evuBolum(v) {
  const e = v.eser;
  const l = evuListe(e);
  const benim = EVS && EVS.kaynak === "benim";
  const d = benim && EVU.duzenle ? l.find(function (x) { return x.id === EVU.duzenle; }) : null;
  if (d) {
    return '<div class="kutu-y evu-duzen">' +
      '<label for="evuAd">Adı</label><input class="kod-giris arac-giris" id="evuAd" maxlength="60" value="' + kacir(d.ad) + '">' +
      '<label for="evuTur">Türü</label><select class="kod-giris arac-giris" id="evuTur"><option value="oyun"' + (d.tur === "oyun" ? " selected" : "") + ">Oyun (kazanınca XP)</option>" +
        '<option value="ozellik"' + (d.tur === "ozellik" ? " selected" : "") + ">Özellik</option></select>" +
      '<label for="evuAciklama">Kısa açıklama</label><input class="kod-giris arac-giris" id="evuAciklama" maxlength="300" value="' + kacir(d.aciklama || "") + '">' +
      '<label for="evuKod">Kod (HTML + JavaScript)</label>' +
      '<textarea class="kod-giris arac-giris evkod" id="evuKod" rows="18" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="' + EVU_KOD_SINIR + '">' + kacir(d.kod) + "</textarea>" +
      '<details class="evu-api"><summary>Kodun kullanabildikleri</summary><ul>' +
        "<li><code>evren.kisiler</code>, <code>evren.yerler</code>, <code>evren.sozluk</code>, <code>evren.tarih</code>, <code>evren.kurallar</code>, <code>evren.haritaYerleri</code>: evreninin verisi (salt okunur)</li>" +
        "<li><code>evren.kazandim()</code>: oyunu kazanan günde bir kez XP alır (başkaları oynayınca; kendi evreninde XP yok)</li>" +
        "<li><code>evren.kaydet(v)</code> ve <code>evren.yukle()</code>: uygulamanın küçük kaydı (en çok 4 KB)</li>" +
        "<li><code>evren.skor(puan)</code>: oyunun puan tablosuna yaz (hesabı olan okurlar; en iyi puan kalır)</li>" +
        "<li>Güvenlik gereği internete çıkamaz, dış dosya yükleyemez, sitenin kayıtlarına erişemez.</li></ul></details>" +
      '<div class="oyun-sira"><button class="dugme" data-evu-kaydet="' + kacir(d.id) + '">Kaydet ve çalıştır</button>' +
        '<button class="dugme dugme-sade" data-evu-kapat>Listeye dön</button>' +
        '<button class="dugme dugme-sade y-sil" data-evu-sil="' + kacir(d.id) + '">' + (EVU.silOnay === d.id ? "Emin misin? Sil" : "Sil") + "</button></div>" +
      '<p class="pencere-durum" id="evuDurum" role="status"></p><div id="evuSahne" class="evu-sahne" data-evu="' + kacir(d.id) + '"></div></div>';
  }
  const acik = EVU.acik ? l.find(function (x) { return x.id === EVU.acik; }) : null;
  return '<p class="oyun-not">' + (benim
      ? "Evrenine kodla yeni oyunlar ve özellikler yaz. Kod korumalı bir çerçevede çalışır; evreninin verisini okuyabilir, oyunu kazanana XP verebilir."
      : "Bu evrenin kurucusunun yazdığı oyunlar ve özellikler.") + "</p>" +
    (l.length ? '<div class="evu-liste">' + l.map(function (u) {
      return '<div class="yaris-kart evo-kart"><h4>' + kacir(u.ad) + ' <span class="evu-tur">' + (u.tur === "oyun" ? "oyun" : "özellik") + "</span></h4>" +
        (u.aciklama ? '<p class="oyun-not">' + kacir(u.aciklama) + "</p>" : "") +
        '<div class="yaris-kart-alt"><span></span><span class="oyun-sira"><button class="dugme" data-evu-ac="' + kacir(u.id) + '">Aç</button>' +
        (benim ? '<button class="dugme dugme-sade" data-evu-duzenle="' + kacir(u.id) + '">Düzenle</button>' : "") + "</span></div></div>";
    }).join("") + "</div>" : '<p class="oyun-not">Henüz uygulama yok.</p>') +
    (benim && l.length < EVU_SINIR ? '<div class="oyun-sira"><button class="dugme dugme-sade" data-evu-yeni="oyun">+ Oyun (örnekle)</button>' +
      '<button class="dugme dugme-sade" data-evu-yeni="ozellik">+ Özellik (örnekle)</button></div>' : "") +
    (acik ? '<div class="kutu-y"><div class="gk-ust"><span class="oyun-etiket">' + kacir(acik.ad) + '</span><button class="dugme dugme-sade" data-evu-kapat>Kapat</button></div>' +
      '<p class="pencere-durum iyi" id="evuDurum" role="status"></p><div id="evuSahne" class="evu-sahne" data-evu="' + kacir(acik.id) + '"></div></div>' : "");
}

function evuSahneKur() {
  const s = document.querySelector("#evrenSayfa #evuSahne");
  if (!s || s.querySelector("iframe")) { return; }
  const v = typeof evrenSayfaVerisi === "function" ? evrenSayfaVerisi() : null;
  const u = v && evuListe(v.eser).find(function (x) { return x.id === s.getAttribute("data-evu"); });
  if (u) { evuCalistir(s, v.eser, u); }
}

function evuDegistir(fn) {
  if (!EVS || EVS.kaynak !== "benim" || typeof evrenBenimDegistir !== "function") { return; }
  evrenBenimDegistir(EVS.id, function (e) { e.uygulamalar = evuTemizle(fn(evuListe(e).slice())); if (!e.uygulamalar.length) { delete e.uygulamalar; } });
}

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-evu-ac], [data-evu-duzenle], [data-evu-yeni], [data-evu-kaydet], [data-evu-sil], [data-evu-kapat]");
  if (!h || !EVS) { return; }
  const d = h.dataset;
  if (d.evuAc) { EVU.acik = d.evuAc; EVU.duzenle = null; }
  else if (d.evuDuzenle) { EVU.duzenle = d.evuDuzenle; EVU.acik = null; EVU.silOnay = null; }
  else if (h.hasAttribute("data-evu-kapat")) { EVU.acik = null; EVU.duzenle = null; }
  else if (d.evuYeni) {
    const o = EVU_ORNEK[d.evuYeni] || EVU_ORNEK.oyun;
    const id = "u" + Date.now().toString(36);
    evuDegistir(function (l) { l.push({ id: id, ad: o.ad, tur: d.evuYeni === "ozellik" ? "ozellik" : "oyun", aciklama: o.aciklama, kod: o.kod }); return l; });
    EVU.duzenle = id;
  } else if (d.evuKaydet) {
    const al = function (s) { const el = document.querySelector(s); return el ? el.value : ""; };
    const yeni = { id: d.evuKaydet, ad: al("#evuAd"), tur: al("#evuTur"), aciklama: al("#evuAciklama"), kod: al("#evuKod") };
    evuDegistir(function (l) { return l.map(function (x) { return x.id === yeni.id ? yeni : x; }); });
  } else if (d.evuSil) {
    if (EVU.silOnay !== d.evuSil) { EVU.silOnay = d.evuSil; }
    else { evuDegistir(function (l) { return l.filter(function (x) { return x.id !== d.evuSil; }); }); EVU.duzenle = null; EVU.silOnay = null; }
  }
  evrenSayfaCiz();
});
