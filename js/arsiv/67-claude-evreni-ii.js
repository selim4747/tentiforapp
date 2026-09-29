/* Claude'un Evreni II — sitenin bütün özelliklerinin vitrini (kanon dışı).

   - Roman sekmesi: "Işık Postası" (veri.claudeEvreni.roman), bölüm bölüm; her bölüm okuma kutusu.
   - Okuma ilerlemesi: evrenin bütün kutuları (madde, kişi, hikâye, mektup, yankı, sözlük, roman bölümü),
     kaç tanesinin sonuna kadar okunduğu ve sıradaki okunmamış kutu.
   - Arama: evrenin içinde (maddeler, kişiler, hikâyeler, mektuplar, sözlük, roman).
   - Kişi kartları: geçtiği hikâyeler ve mektupları; hakkındaki her şeyi okuyana rozet (bir kez 15 eçka).
   - Günlük oyunlar (XP): Kim bu?, Sözlük bilmecesi, Hangisi önce? — 66-gunluk-oyunlar.js motoruyla, günde bir kez 10 XP. */

let ceRomanSecili = null;

/* ==================== kutular ==================== */

/** Evrenin bütün okuma kutuları: { anahtar, ad, tur, sekme, hedef } (hedef: sayfadaki #ce-… kimliği) */
function ceKutular() {
  const c = ceVeri();
  if (!c) { return []; }
  const l = [];
  const ekle = function (anahtar, ad, tur, sekme, hedef) { l.push({ anahtar: anahtar, ad: ad, tur: tur, sekme: sekme, hedef: hedef }); };
  (c.maddeler || []).forEach(function (m) { ekle("madde:ce-" + m.id, m.baslik, "madde", m.tur, "ce-" + m.id); });
  (c.kisiler || []).forEach(function (k) { ekle("madde:ce-" + k.id, k.ad, "kişi", "kisiler", "ce-" + k.id); });
  (c.hikayeler || []).forEach(function (h) { ekle("madde:ce-" + h.id, h.baslik, "hikâye", "hikayeler", "ce-" + h.id); });
  (c.mektuplar || []).forEach(function (m) { ekle("madde:ce-" + m.id, m.kimden + " → " + m.kime, "mektup", "belgeler", "ce-" + m.id); });
  (c.yankilar || []).forEach(function (y, i) { ekle("madde:ce-yanki-" + i, y.baslik, "yankı", "belgeler", "ce-yanki-" + i); });
  if ((c.sozluk || []).length) { ekle("madde:ce-sozluk", "Sözlük", "sözlük", "sozluk", "ce-sozluk"); }
  ((c.roman || {}).bolumler || []).forEach(function (b, i) { ekle("madde:ce-roman-" + b.id, (i + 1) + ". " + (b.baslik || "Bölüm"), "roman", "roman", "ce-roman-" + b.id); });
  return l;
}

function ceOkundu(k) { return typeof okunduMu === "function" && okunduMu(k.anahtar); }

function ceIlerlemeHtml() {
  const l = ceKutular();
  if (!l.length) { return ""; }
  const okunan = l.filter(ceOkundu).length;
  const siradaki = l.find(function (k) { return !ceOkundu(k); });
  const oran = Math.round(100 * okunan / l.length);
  return '<div class="kutu-y ce-ilerleme"><div class="ce-ilerleme-ust"><span class="oyun-etiket">Okuma ilerlemen</span>' +
      "<b>" + okunan + " / " + l.length + "</b></div>" +
    '<span class="svk-cubuk ce-cubuk" aria-hidden="true"><i style="width:' + Math.max(2, oran) + '%"></i></span>' +
    '<p class="oyun-not">Bir kutuyu sonuna kadar okuyunca işaretlenir; her kutu bir kez 10 XP.</p>' +
    (siradaki ? '<button class="dugme dugme-sade" data-ce-kutu="' + kacir(siradaki.anahtar) + '">Sıradaki: ' + kacir(siradaki.ad) + " (" + kacir(siradaki.tur) + ") →</button>"
      : '<p class="oyun-not"><b>Hepsini okudun.</b> Bu evrende okunmamış kutu kalmadı.</p>') +
    "</div>";
}

/** Bir kutuya git: sekmesini aç, kutuyu aç, göster. */
function ceKutuyaGit(anahtar) {
  const k = ceKutular().find(function (x) { return x.anahtar === anahtar; });
  if (!k) { return; }
  if (k.sekme === "roman") { ceRomanSecili = k.hedef.replace(/^ce-roman-/, ""); }
  ceSekme = k.sekme === "dunya" && k.hedef === "ce-clEvren" ? "genel" : k.sekme;
  claudeEvrenCiz();
  const el = document.getElementById(k.hedef);
  if (!el) { return; }
  if (el.classList.contains("madde")) { el.classList.add("acik"); const b = el.querySelector(".madde-bas"); if (b) { b.setAttribute("aria-expanded", "true"); } }
  if (el.tagName === "DETAILS") { el.open = true; }
  el.scrollIntoView({ block: "start" });
}

/* ==================== arama ==================== */

function ceAraNormal(s) { return String(s || "").toLocaleLowerCase("tr"); }

function ceAra(sorgu) {
  const q = ceAraNormal(sorgu).trim();
  const c = ceVeri();
  if (q.length < 2 || !c) { return []; }
  const kutular = ceKutular();
  const bul = function (anahtar) { return kutular.find(function (k) { return k.anahtar === anahtar; }); };
  const sonuc = [];
  const dene = function (anahtar, metinler) {
    const tam = metinler.join(" ");
    const i = ceAraNormal(tam).indexOf(q);
    if (i === -1) { return; }
    const k = bul(anahtar);
    if (!k) { return; }
    const bas = Math.max(0, i - 40);
    sonuc.push({ kutu: k, parca: (bas > 0 ? "…" : "") + tam.slice(bas, i + q.length + 60).replace(/\s+/g, " ") + "…" });
  };
  (c.kisiler || []).forEach(function (k) { dene("madde:ce-" + k.id, [k.ad, k.unvan || "", k.ozet || "", k.detay || ""]); });
  (c.maddeler || []).forEach(function (m) { dene("madde:ce-" + m.id, [m.baslik, m.ozet || "", m.metin || ""]); });
  (c.hikayeler || []).forEach(function (h) { dene("madde:ce-" + h.id, [h.baslik, h.metin || ""]); });
  (c.mektuplar || []).forEach(function (m) { dene("madde:ce-" + m.id, [m.kimden + " → " + m.kime, m.not || "", m.metin || ""]); });
  ((c.roman || {}).bolumler || []).forEach(function (b) { dene("madde:ce-roman-" + b.id, [b.baslik || "", b.metin || ""]); });
  (c.sozluk || []).forEach(function (s) {
    if (ceAraNormal(s.terim + " " + s.tanim).indexOf(q) !== -1) { const k = bul("madde:ce-sozluk"); if (k) { sonuc.push({ kutu: k, parca: s.terim + " — " + s.tanim }); } }
  });
  return sonuc.slice(0, 12);
}

function ceAraSonucCiz(sorgu) {
  const el = document.querySelector("#ceAraSonuc");
  if (!el) { return; }
  const q = String(sorgu || "").trim();
  if (q.length < 2) { el.innerHTML = ""; return; }
  const l = ceAra(q);
  el.innerHTML = l.length ? '<ul class="ce-ara-liste">' + l.map(function (s) {
    return '<li><button class="ic-bag" data-ce-kutu="' + kacir(s.kutu.anahtar) + '"><b>' + kacir(s.kutu.ad) + '</b> <span class="ce-ara-tur">' + kacir(s.kutu.tur) + "</span></button>" +
      '<span class="ce-ara-parca">' + kacir(s.parca) + "</span></li>";
  }).join("") + "</ul>" : '<p class="oyun-not">“' + kacir(q) + "” bu evrende geçmiyor.</p>";
}

/* ==================== roman ==================== */

function ceRomanHtml() {
  const r = ceVeri().roman;
  const l = (r && r.bolumler) || [];
  if (!l.length) { return '<p class="oyun-not">Bu evrenin henüz romanı yok.</p>'; }
  let i = l.findIndex(function (b) { return b.id === ceRomanSecili; });
  if (i === -1) { i = 0; }
  const b = l[i];
  ceRomanSecili = b.id;
  const okundu = function (x) { return typeof okunduMu === "function" && okunduMu("madde:ce-roman-" + x.id); };
  return '<div class="evr-oku ce-roman" id="ce-roman-' + kacir(b.id) + '">' +
    '<h3 class="evr-baslik">' + kacir(r.baslik || "Roman") + "</h3>" +
    (r.ozet ? '<p class="oyun-not">' + kacir(r.ozet) + "</p>" : "") +
    '<details class="evr-icindekiler"><summary>İçindekiler · ' + l.length + " bölüm</summary><ol>" + l.map(function (x, j) {
      return '<li><button class="ic-bag" data-ce-roman="' + kacir(x.id) + '">' + kacir(x.baslik || "Bölüm " + (j + 1)) + "</button>" +
        (okundu(x) ? ' <span class="ce-okundu" title="Okundu">✓</span>' : "") + "</li>";
    }).join("") + "</ol></details>" +
    '<h4 class="evr-bolum-baslik">' + (i + 1) + ". " + kacir(b.baslik || "") + yeniRozet(b) + "</h4>" +
    '<div class="okuma-metin fan-metin ce-roman-metin" data-bolum="' + kacir(b.id) + '">' + paragraf(b.metin) + "</div>" +
    '<div class="oyun-sira evr-gez">' +
      (i > 0 ? '<button class="dugme dugme-sade" data-ce-roman="' + kacir(l[i - 1].id) + '">← Önceki</button>' : "") +
      (i + 1 < l.length ? '<button class="dugme" data-ce-roman="' + kacir(l[i + 1].id) + '">Sonraki bölüm →</button>' : "") +
    "</div></div>";
}

/* ==================== kişiler: bağlantılar ve rozet ==================== */

/** Kişinin kutuları: kendi kaydı, geçtiği hikâyeler, yazdığı ya da ona yazılan mektuplar. */
function ceKisiKutulari(k) {
  const c = ceVeri();
  const l = [{ anahtar: "madde:ce-" + k.id, ad: k.ad, tur: "kayıt" }];
  (c.hikayeler || []).forEach(function (h) { if ((h.karakterler || []).indexOf(k.id) !== -1) { l.push({ anahtar: "madde:ce-" + h.id, ad: h.baslik, tur: "hikâye" }); } });
  (c.mektuplar || []).forEach(function (m) { if (m.kimden === k.ad || m.kime === k.ad) { l.push({ anahtar: "madde:ce-" + m.id, ad: m.kimden + " → " + m.kime, tur: "mektup" }); } });
  return l;
}

function ceKisiRozeti(k) {
  const l = ceKisiKutulari(k);
  return l.length > 1 && l.every(function (x) { return typeof okunduMu === "function" && okunduMu(x.anahtar); });
}

function ceKisileriZenginlestir() {
  (ceVeri().kisiler || []).forEach(function (k) {
    const d = document.getElementById("ce-" + k.id);
    if (!d || d.querySelector(".ce-kisi-kutular")) { return; }
    const l = ceKisiKutulari(k);
    const rozet = ceKisiRozeti(k);
    if (rozet && typeof soOdul === "function") { soOdul("ce_rozet_" + k.id, 15, "Claude'un Evreni: " + k.ad + " rozeti"); }
    const s = d.querySelector(".ce-kisi-ad");
    if (s && rozet) { s.insertAdjacentHTML("beforeend", ' <span class="ce-rozet" title="Hakkındaki her şeyi okudun">✓</span>'); }
    const diger = l.slice(1);
    const okunan = l.filter(function (x) { return typeof okunduMu === "function" && okunduMu(x.anahtar); }).length;
    const html = '<div class="ce-kisi-kutular">' +
      (diger.length ? '<span class="oyun-etiket">Geçtiği yerler</span><div class="ce-kisi-baglar">' + diger.map(function (x) {
        const ok = typeof okunduMu === "function" && okunduMu(x.anahtar);
        return '<button class="dugme dugme-sade" data-ce-kutu="' + kacir(x.anahtar) + '">' + (ok ? "✓ " : "") + kacir(x.ad) + " · " + kacir(x.tur) + "</button>";
      }).join("") + "</div>" : "") +
      '<p class="oyun-not">' + (rozet ? "<b>Rozet:</b> hakkındaki her şeyi okudun."
        : "Hakkındaki " + l.length + " kutudan " + okunan + " tanesini okudun" + (l.length > 1 ? "; hepsini okuyunca rozet." : ".")) + "</p></div>";
    const det = d.querySelector(".detay-metin");
    if (det) { det.insertAdjacentHTML("afterend", html); }
  });
}

/* ==================== günlük oyunlar (XP) ==================== */

if (typeof GO_OYUNLAR !== "undefined") {
  GO_OYUNLAR.push(
    { id: "ce_kim", evren: "claude", ad: "Kim bu?", ozet: "Kısa tanımdan kişiyi bul. 5 soru, 4 doğru yeter.", n: 5, esik: 4 },
    { id: "ce_sozluk", evren: "claude", ad: "Sözlük bilmecesi", ozet: "Tanımdan terimi bul. 5 soru, 4 doğru yeter.", n: 5, esik: 4 },
    { id: "ce_once", evren: "claude", ad: "Hangisi önce?", ozet: "Şomdo kronolojisinden iki olay: hangisi daha önce oldu? 5 soru, 4 doğru yeter.", n: 5, esik: 4 }
  );
  GO_URETICI.claude = function (id, r, kisa) {
    const c = ceVeri() || {};
    if (id === "ce_kim" || id === "ce_sozluk") {
      const l = id === "ce_kim" ? (c.kisiler || []).filter(function (k) { return k.ozet; }) : (c.sozluk || []);
      const ad = function (x) { return id === "ce_kim" ? x.ad : x.terim; };
      const ipucu = function (x) { return id === "ce_kim" ? (x.unvan ? x.unvan + ". " : "") + x.ozet : x.tanim; };
      return goKaristir(l, r).slice(0, 5).map(function (x) {
        const yanlis = goKaristir(l.filter(function (y) { return ad(y) !== ad(x); }), r).slice(0, 3).map(ad);
        return { soru: "“" + kisa(goGizle(ipucu(x), ad(x)), 220) + "” — " + (id === "ce_kim" ? "bu kim?" : "hangi terim?"), dogru: ad(x),
          secenekler: goKaristir([ad(x)].concat(yanlis), r) };
      });
    }
    /* Hangisi önce?: kronoloji maddesinin satırları eskiden yeniye */
    const olaylar = ceKronolojiOlaylari();
    const sorular = [];
    for (let t = 0; t < 5 && olaylar.length >= 2; t++) {
      const iki = goKaristir(olaylar, r).slice(0, 2);
      const once = iki[0].sira < iki[1].sira ? iki[0] : iki[1];
      sorular.push({ soru: "Hangisi daha önce oldu?", dogru: once.metin, secenekler: goKaristir(iki.map(function (x) { return x.metin; }), r) });
    }
    return sorular;
  };
}

/** Kronoloji maddesinden olaylar: { sira, metin } — "Çağ — olay" satırlarının olay kısmı. */
function ceKronolojiOlaylari() {
  const m = ((ceVeri() || {}).maddeler || []).find(function (x) { return x.id === "clKronoloji"; });
  if (!m) { return []; }
  return String(m.metin || "").split(/\n\s*\n/).map(function (s, i) {
    const p = s.split(" — ");
    const olay = (p.length > 1 ? p.slice(1).join(" — ") : s).replace(/\s*\(.*\)\s*$/, "").trim();
    return { sira: i, metin: olay.length > 120 ? olay.slice(0, 119) + "…" : olay };
  }).filter(function (x) { return x.metin && !/^Bugün/.test(x.metin); });
}

/* ==================== çizim: claudeEvrenCiz sarmalayıcı ==================== */

document.addEventListener("input", function (e) {
  if (e.target && e.target.id === "ceAra") { ceAraSonucCiz(e.target.value); }
});

document.addEventListener("click", function (e) {
  const k = e.target.closest("[data-ce-kutu]");
  if (k) { ceKutuyaGit(k.dataset.ceKutu); return; }
  const r = e.target.closest("[data-ce-roman]");
  if (r) {
    ceRomanSecili = r.dataset.ceRoman;
    claudeEvrenCiz();
    const b = document.querySelector("#claudeEvrenAlan .evr-bolum-baslik");
    if (b) { b.scrollIntoView({ block: "start" }); }
  }
});
