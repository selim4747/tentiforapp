/* Evrengezer: evrenler arası ekonomi, evren özelleştirme, kilitli lore ve evren kodları.

   - Her evrenin kendi parası var (Tömye'de eçka). Ortak para Evrengezer (EG); evren paraları
     Evrengezer Bürosu'nda EG'ye çevrilir (her yönde %5 kesinti: para yakılır, ekonomi şişmez).
     Başka bir evreni (sitedeki ya da fanmade) günde bir kez gezmek o evrenin parasından ödül verir;
     kişinin kendi evreni ve dışarıdan açılan dosyalar ödül vermez (kendi kendine para basılamasın).
   - Evren kurucusu kendi evreninin parasını, alfabesini, harita stilini ve sayfa stilini ayarlar;
     evrenin bütün içeriğini kod (JSON) olarak açıp değiştirebilir.
   - Kilitli lore: metin, lore koduna bağlı rastgele bir anahtarla şifrelenir. Anahtar; lore koduna,
     (varsa) evrenin yönetici koduna ve (site kurduysa) Evrengezer açık anahtarına ayrı ayrı sarılır.
     Kodların hepsi evrenin kimliğiyle tuzlanır: bir evrenin kodu başka hiçbir evrende çalışmaz.
     Evrengezer yönetici kodları (sitenin yönetici kodları) her evrende çalışır: gizli Evrengezer
     anahtarı veride yalnızca bu kodlara sarılı durur. */

const EG_ANAHTAR = "tentiforapp_evrengezer";
const EVL_ANAHTAR = "tentiforapp_evren_lore";          /* { evrenId: { loreId: anahtar } } — açılan lorelar */
const EVK_ANAHTAR = "tentiforapp_evren_kodlarim";      /* { evrenId: { yon: kod, lore: { loreId: kod } } } — kurucunun kodları */
const EG_KESINTI = 0.05;
const EG_ZIYARET_DEGER = 2;       /* günlük evren ziyaret ödülü, EG karşılığı */
const EG_ZIYARET_GUNLUK = 5;      /* günde en fazla bu kadar evren ödül verir */
const ALFABE_HARFLER = "abcçdefgğhıijklmnoöprsştuüvyz";
const ALFABE_HAVUZ = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟᚼᛅᛆᛋᛐ⟁⟟⊼⋔⌖⍜⍟⎔⏃⏚⟒⌰⍀⋏⊑";
const EVH_DESENLER = {
  duz: { ad: "Düz" },
  kagit: { ad: "Eski kâğıt", deniz: "#D8C8A0", kara: "#EFE3C4", cizgi: "#6B5433", yazi: "#3B2A14", hale: "#F4EAD2" },
  gece: { ad: "Gece", deniz: "#0F1D2E", kara: "#2A3B4F", cizgi: "#7FB2DC", yazi: "#E8EEF4", hale: "#0F1D2E" },
  izgara: { ad: "Izgara", izgara: true }
};
const EV_FONTLAR = { serif: "Georgia,serif", sans: "system-ui,sans-serif", mono: "ui-monospace,monospace" };

/* ==================== temizleme (dosyadan gelen her alan sınırlanır) ==================== */

function evHex(v) { return /^#[0-9a-fA-F]{6}$/.test(v || "") ? v : ""; }

function evrenHaritaStilTemizle(s) {
  if (!s || typeof s !== "object") { return null; }
  const o = {};
  if (EVH_DESENLER[s.desen]) { o.desen = s.desen; }
  ["kara", "cizgi", "yazi"].forEach(function (k) { const v = evHex(s[k]); if (v) { o[k] = v; } });
  if (s.font === "alfabe" || EV_FONTLAR[s.font]) { o.font = s.font; }
  if (s.izgara) { o.izgara = true; }
  return Object.keys(o).length ? o : null;
}

function evrenLoreTemizle(l) {
  if (!l || typeof l !== "object") { return null; }
  const b64 = function (v, n) { v = String(v || ""); return /^[A-Za-z0-9+/=]*$/.test(v) && v.length <= n ? v : ""; };
  const o = { id: fanMetin(l.id, 40).replace(/[^\w-]/g, ""), baslik: fanMetin(l.baslik, 160), ipucu: fanMetin(l.ipucu, 500),
    ipucuFiyat: Math.max(0, Math.min(10000, Math.round(Number(l.ipucuFiyat) || 0))),
    tuz: /^[0-9a-f]{16,32}$/.test(l.tuz || "") ? l.tuz : "", ic: b64(l.ic, 80000),
    ko: /^[0-9a-f]{64}$/.test(l.ko || "") ? l.ko : "", sk: b64(l.sk, 200) };
  if (!o.id || !o.tuz || !o.ic || !o.ko || !o.sk) { return null; }
  const sy = b64(l.sy, 200);
  if (sy) { o.sy = sy; }
  if (l.seg && typeof l.seg === "object") {
    const p = b64(l.seg.p, 200), s = b64(l.seg.s, 200);
    if (p && s) { o.seg = { p: p, s: s }; }
  }
  return o;
}

/** fanTemizle (40) evren için bunu çağırır: para, alfabe, sayfa stili, kilitli lore, evren yönetici kodu özeti. */
function evrenEkTemizle(ham, e) {
  if (ham.para && typeof ham.para === "object") {
    const kur = Number(ham.para.kur);
    e.para = { ad: fanMetin(ham.para.ad, 24), simge: fanMetin(ham.para.simge, 3),
      kur: isFinite(kur) && kur > 0 ? Math.min(1, Math.max(0.01, Math.round(kur * 100) / 100)) : 0.1 };
  }
  if (ham.alfabe && typeof ham.alfabe === "object" && ham.alfabe.harfler && typeof ham.alfabe.harfler === "object") {
    const h = {};
    ALFABE_HARFLER.split("").forEach(function (c) { const g = fanMetin(ham.alfabe.harfler[c], 4); if (g.trim()) { h[c] = g; } });
    if (Object.keys(h).length) { e.alfabe = { harfler: h, baslik: !!ham.alfabe.baslik }; }
  }
  if (ham.stil && typeof ham.stil === "object") {
    const s = {};
    ["ana", "zemin", "yazi"].forEach(function (k) { const v = evHex(ham.stil[k]); if (v) { s[k] = v; } });
    if (EV_FONTLAR[ham.stil.font]) { s.font = ham.stil.font; }
    const k = Number(ham.stil.kose);
    if (ham.stil.kose !== undefined && isFinite(k)) { s.kose = Math.max(0, Math.min(24, Math.round(k))); }
    if (Object.keys(s).length) { e.stil = s; }
  }
  if (Array.isArray(ham.lorlar)) {
    const l = ham.lorlar.slice(0, 60).map(evrenLoreTemizle).filter(Boolean);
    if (l.length) { e.lorlar = l; }
  }
  if (/^[0-9a-f]{64}$/.test(ham.yoneticiOzet || "")) { e.yoneticiOzet = ham.yoneticiOzet; }
}

/* ==================== alfabe ==================== */

function evrenAlfabeYaz(metin, alfabe) {
  const h = (alfabe && alfabe.harfler) || {};
  return Array.from(String(metin || "")).map(function (c) {
    const k = c.toLocaleLowerCase("tr");
    return h[k] || c;
  }).join("");
}

function evrenRastgeleAlfabe() {
  const havuz = Array.from(ALFABE_HAVUZ);
  const h = {};
  ALFABE_HARFLER.split("").forEach(function (c) {
    const i = Math.floor(Math.random() * havuz.length);
    h[c] = havuz.splice(i, 1)[0] || c;
  });
  return h;
}

/* ==================== ekonomi ==================== */

let egCuzdan = null;

function egYukle() {
  if (egCuzdan) { return egCuzdan; }
  const d = jsonOku(EG_ANAHTAR, null);
  egCuzdan = (d && typeof d === "object") ? d : {};
  if (typeof egCuzdan.eg !== "number" || !isFinite(egCuzdan.eg)) { egCuzdan.eg = 0; }
  if (!egCuzdan.b || typeof egCuzdan.b !== "object") { egCuzdan.b = {}; }
  if (!egCuzdan.p || typeof egCuzdan.p !== "object") { egCuzdan.p = {}; }
  if (!Array.isArray(egCuzdan.gecmis)) { egCuzdan.gecmis = []; }
  if (!Array.isArray(egCuzdan.ipucu)) { egCuzdan.ipucu = []; }
  if (!egCuzdan.ziyaret || typeof egCuzdan.ziyaret !== "object") { egCuzdan.ziyaret = { gun: "", l: [] }; }
  return egCuzdan;
}

function egKaydet() { jsonYaz(EG_ANAHTAR, egCuzdan); }

function egGecmis(m, k) {
  egCuzdan.gecmis.push({ m: m, k: k, t: bugununAdi() });
  if (egCuzdan.gecmis.length > 60) { egCuzdan.gecmis.shift(); }
}

/** Evren parası: { ad, simge, kur } — kur: bu paranın 1 biriminin EG karşılığı. */
function evrenParasi(anahtar, eser) {
  const tanimli = (typeof veri !== "undefined" && veri && veri.evrenParalari) || {};
  let p = null;
  if (anahtar === "tomye") { p = Object.assign({ ad: birim(), simge: "", kur: 0.1 }, tanimli.tomye || {}); p.ad = birim(); }
  else if (anahtar.indexOf("site:") === 0 || anahtar === "e99") {
    const id = anahtar === "e99" ? "e99" : anahtar.slice(5);
    p = tanimli[id] || { ad: (eser && eser.ad ? eser.ad : id.toUpperCase()) + " jetonu", simge: "", kur: 0.1 };
  } else if (eser && eser.para && eser.para.ad) { p = eser.para; }
  else if (eser) { p = { ad: (eser.ad || "Evren") + " parası", simge: "", kur: 0.1 }; }
  else { p = (egYukle().p || {})[anahtar] || { ad: "evren parası", simge: "", kur: 0.1 }; }
  const kur = Number(p.kur);
  return { ad: String(p.ad || "evren parası"), simge: String(p.simge || ""), kur: isFinite(kur) && kur > 0 ? Math.min(1, Math.max(0.01, kur)) : 0.1 };
}

function egBakiye(anahtar) {
  if (anahtar === "tomye") { return cuzdan.ecka; }
  return egYukle().b[anahtar] || 0;
}

/** Evren parası ekler/çıkarır. Tömye'de eçka cüzdanına işler (kazanç istatistiğine sayılmaz: çeviri kazanç değil). */
function egBakiyeDegistir(anahtar, n, kaynak) {
  if (anahtar === "tomye") {
    cuzdan.ecka += n;
    gecmiseYaz(n, kaynak);
    cuzdanKaydet();
    return;
  }
  egYukle();
  egCuzdan.b[anahtar] = Math.max(0, (egCuzdan.b[anahtar] || 0) + n);
  egKaydet();
}

function egParaHatirla(anahtar, p) {
  egYukle();
  if (anahtar === "tomye") { return; }
  egCuzdan.p[anahtar] = { ad: p.ad, simge: p.simge, kur: p.kur };
}

/** X EG almak için ödenecek evren parası (kesinti dahil). */
function egAlisBedeli(x, p) { return Math.ceil(Math.round(x / p.kur * (1 + EG_KESINTI) * 1000) / 1000); }
/** X EG satınca gelen evren parası (kesinti düşülmüş). */
function egSatisGeliri(x, p) { return Math.floor(Math.round(x / p.kur * (1 - EG_KESINTI) * 1000) / 1000); }

function egAl(anahtar, x, eser) {
  x = Math.floor(Number(x) || 0);
  if (x <= 0) { return "Kaç EG?"; }
  const p = evrenParasi(anahtar, eser);
  const bedel = egAlisBedeli(x, p);
  if (egBakiye(anahtar) < bedel) { return "Yetmez: " + bedel + " " + p.ad + " gerekiyor."; }
  egParaHatirla(anahtar, p);
  egBakiyeDegistir(anahtar, -bedel, "Evrengezer bürosu");
  egYukle().eg += x;
  egGecmis(x, bedel + " " + p.ad + " → EG");
  egKaydet();
  return "";
}

function egSat(anahtar, x, eser) {
  x = Math.floor(Number(x) || 0);
  if (x <= 0) { return "Kaç EG?"; }
  egYukle();
  if (egCuzdan.eg < x) { return "Yetmez: " + x + " EG yok."; }
  const p = evrenParasi(anahtar, eser);
  const gelir = egSatisGeliri(x, p);
  if (gelir <= 0) { return "Bu kadar EG'ye bir birim bile düşmüyor."; }
  egParaHatirla(anahtar, p);
  egCuzdan.eg -= x;
  egGecmis(-x, "EG → " + gelir + " " + p.ad);
  egKaydet();
  egBakiyeDegistir(anahtar, gelir, "Evrengezer bürosu");
  return "";
}

/** Açık evren sayfasının cüzdan anahtarı; ödül vermeyen (kişinin kendi) evrenlerde de çeviri yapılabilir. */
function evrenCuzdanAnahtari() {
  if (!EVS) { return "tomye"; }
  if (EVS.kaynak === "e99") { return "e99"; }
  if (EVS.kaynak === "site") { return "site:" + EVS.id; }
  return "ev:" + EVS.id;
}

function evrenKendisininMi(id) {
  return fanEserlerim().some(function (e) { return e.id === id; });
}

/** Günlük gezi ödülü: sitedeki ve fanmade evrenler; kişinin kendi evreni ve dosyadan açılanlar hariç. */
function evrenZiyaretOdulu() {
  if (!EVS || ["site", "fan", "e99"].indexOf(EVS.kaynak) === -1) { return 0; }
  const v = evrenSayfaVerisi();
  if (!v || v.kilitli) { return 0; }
  if (EVS.kaynak === "fan" && evrenKendisininMi(EVS.id)) { return 0; }
  egYukle();
  const bugun = bugununAdi();
  if (egCuzdan.ziyaret.gun !== bugun) { egCuzdan.ziyaret = { gun: bugun, l: [] }; }
  const anahtar = evrenCuzdanAnahtari();
  if (egCuzdan.ziyaret.l.indexOf(anahtar) !== -1 || egCuzdan.ziyaret.l.length >= EG_ZIYARET_GUNLUK) { return 0; }
  const p = evrenParasi(anahtar, v.eser);
  const n = Math.max(1, Math.round(EG_ZIYARET_DEGER / p.kur));
  egCuzdan.ziyaret.l.push(anahtar);
  egParaHatirla(anahtar, p);
  egKaydet();
  egBakiyeDegistir(anahtar, n, "Evren gezisi");
  if (typeof eckaBildir === "function") { eckaBildir("+" + n + " " + p.ad + " · " + (v.eser.ad || "evren") + " gezisi"); }
  return n;
}

function egTutar(n, p) { return n + " " + (p.simge ? p.simge + " " : "") + p.ad; }

/** Evren sayfasının üstündeki cüzdan çubuğu: bu evrenin parası + Evrengezer. */
function evrenCuzdanCubugu(v) {
  const a = evrenCuzdanAnahtari();
  const p = evrenParasi(a, v.eser);
  return '<div class="evs-cuzdan" data-evs-cuzdan>' +
    "<span><b>" + kacir(egTutar(egBakiye(a), p)) + "</b></span>" +
    '<span class="evs-eg">' + egYukle().eg + " EG</span>" +
    '<button class="dugme dugme-sade" data-eg-buro>Evrengezer bürosu</button></div>';
}

/** Büro: bütün evren paraların, EG'ye çevirme. */
function egBuroHtml(odak) {
  egYukle();
  const anahtarlar = ["tomye"];
  if (odak && anahtarlar.indexOf(odak.anahtar) === -1) { anahtarlar.push(odak.anahtar); }
  Object.keys(egCuzdan.b).forEach(function (k) { if (egCuzdan.b[k] > 0 && anahtarlar.indexOf(k) === -1) { anahtarlar.push(k); } });
  const satir = function (a) {
    const eser = odak && odak.anahtar === a ? odak.eser : null;
    const p = evrenParasi(a, eser);
    return '<div class="eg-satir" data-eg-satir="' + kacir(a) + '">' +
      '<div class="eg-para"><b>' + kacir(egTutar(egBakiye(a), p)) + "</b>" +
        '<span class="oyun-not">1 ' + kacir(p.ad) + " = " + p.kur + " EG · 10 EG almak " + egAlisBedeli(10, p) + " · 10 EG satmak " + egSatisGeliri(10, p) + "</span></div>" +
      '<div class="eg-islem"><input class="kod-giris arac-giris" type="number" min="1" step="1" value="1" inputmode="numeric" aria-label="EG miktarı">' +
        '<button class="dugme" data-eg-al="' + kacir(a) + '">EG al</button>' +
        '<button class="dugme dugme-sade" data-eg-sat="' + kacir(a) + '">EG sat</button></div></div>';
  };
  return '<div class="eg-buro"><div class="oyun-etiket">Evrengezer bürosu</div>' +
    '<p class="oyun-not">Evrengezer (EG) bütün evrenlerde geçen ortak para. Her evrenin kendi parası burada EG\'ye, EG de başka evrenin parasına çevrilir; ' +
      "her çeviride %" + Math.round(EG_KESINTI * 100) + " kesinti yakılır.</p>" +
    '<p class="eg-toplam"><b>' + egCuzdan.eg + " EG</b></p>" +
    anahtarlar.map(satir).join("") +
    '<p class="pencere-durum" id="egDurum" role="status"></p></div>';
}

let egBuroOdak = null;

function egBuroAc(odak) {
  egBuroOdak = odak || null;
  const perde = document.querySelector("#perde");
  if (!perde) { return; }
  perde.innerHTML = '<div class="pencere" role="dialog" aria-modal="true" aria-label="Evrengezer bürosu">' +
    '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' + egBuroHtml(egBuroOdak) + "</div>";
  perde.hidden = false;
}

function egBuroTazele(mesaj, iyi) {
  const b = document.querySelector("#perde .eg-buro");
  if (b) { b.outerHTML = egBuroHtml(egBuroOdak); }
  const d = document.querySelector("#egDurum");
  if (d && mesaj) { d.textContent = mesaj; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); }
  if (EVS && document.querySelector("#evrenSayfa [data-evs-cuzdan]")) {
    const v = evrenSayfaVerisi();
    if (v) { document.querySelector("#evrenSayfa [data-evs-cuzdan]").outerHTML = evrenCuzdanCubugu(v); }
  }
}

/* ==================== evren stili ==================== */

/** Evren sayfasına kurucunun stili: renkler CSS değişkeni olarak (yalnızca #RRGGBB), yazı tipi listeden. */
function evrenSayfaStili(e) {
  const s = (e && e.stil) || {};
  const p = [];
  if (evHex(s.zemin)) { p.push("--kar:" + s.zemin, "--beyaz:" + s.zemin); }
  if (evHex(s.yazi)) { p.push("--murekkep:" + s.yazi, "color:" + s.yazi); }
  if (evHex(s.ana)) { p.push("--deniz:" + s.ana, "--yarik:" + s.ana); }
  if (EV_FONTLAR[s.font]) { p.push("--govde:" + EV_FONTLAR[s.font], "--display:" + EV_FONTLAR[s.font], "font-family:" + EV_FONTLAR[s.font]); }
  if (typeof s.kose === "number") { p.push("--evs-kose:" + s.kose + "px"); }
  return p.join(";");
}

/* ==================== kilitli lore: şifreleme ==================== */

function evRastHex(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
}

function evKodTemiz(k) { return String(k || "").trim().toUpperCase(); }

function evKodUret(onek) {
  const harf = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return (onek || "EVR") + "-" + Array.from(b).map(function (x) { return harf[x % harf.length]; }).join("");
}

function lorKodOzet(eid, kod) { return dogrulamaOzeti("lore|" + eid + "|" + evKodTemiz(kod)); }
function evYonOzet(eid, kod) { return dogrulamaOzeti("evyon|" + eid + "|" + evKodTemiz(kod)); }
function lorIcCoz(l, ck) {
  if (!/^[0-9a-f]{32}$/.test(ck || "")) { return null; }
  try { const o = JSON.parse(sifreCoz(l.ic, "loreic|" + ck + "|" + l.tuz)); return o && typeof o.m === "string" ? o.m : null; }
  catch (e) { return null; }
}
function lorAnahtarCoz(sarili, anahtar) {
  try { const ck = sifreCoz(sarili, anahtar); return /^[0-9a-f]{32}$/.test(ck) ? ck : null; } catch (e) { return null; }
}

function b64Bayt(b) { return bayttanBase64(new Uint8Array(b)); }

async function egAcikAnahtar() {
  const a = veri && veri.evrengezer && veri.evrengezer.acik;
  if (!a || !(window.crypto && crypto.subtle)) { return null; }
  try { return await crypto.subtle.importKey("raw", base64tenBayt(a), { name: "ECDH", namedCurve: "P-256" }, true, []); }
  catch (e) { return null; }
}

/** Lore anahtarını Evrengezer açık anahtarına sarar (yalnızca Evrengezer yönetici kodu açabilir). */
async function egSar(ck) {
  const acik = await egAcikAnahtar();
  if (!acik) { return null; }
  const gecici = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const bit = await crypto.subtle.deriveBits({ name: "ECDH", public: acik }, gecici.privateKey, 256);
  const p = await crypto.subtle.exportKey("raw", gecici.publicKey);
  return { p: b64Bayt(p), s: sifrele(ck, "eg|" + onaltilik(new Uint8Array(bit))) };
}

/** Oturumdaki Evrengezer yönetici kodu (tam ya da sınırlı). */
function egYoneticiKodu() {
  if (typeof yoneticiKod !== "undefined" && yoneticiKod) { return { tur: "tam", kod: yoneticiKod }; }
  if (typeof panelAcik === "function" && panelAcik()) {
    const k = kayitOku(YONETICI_ANAHTAR) || "";
    if (typeof sinirliKodMu === "function" && sinirliKodMu(k)) { return { tur: "sinirli", kod: k }; }
  }
  return null;
}

let egGizliOnbellek = null;

async function egGizliAnahtar() {
  const y = egYoneticiKodu();
  const eg = veri && veri.evrengezer;
  if (!y || !eg || !eg[y.tur]) { return null; }
  if (egGizliOnbellek && egGizliOnbellek.kod === y.kod) { return egGizliOnbellek.anahtar; }
  try {
    const jwk = JSON.parse(sifreCoz(eg[y.tur], "egyon|" + y.kod));
    const anahtar = await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    egGizliOnbellek = { kod: y.kod, anahtar: anahtar };
    return anahtar;
  } catch (e) { return null; }
}

async function egLorAc(l, gizli) {
  if (!l.seg) { return null; }
  try {
    const p = await crypto.subtle.importKey("raw", base64tenBayt(l.seg.p), { name: "ECDH", namedCurve: "P-256" }, true, []);
    const bit = await crypto.subtle.deriveBits({ name: "ECDH", public: p }, gizli, 256);
    return lorAnahtarCoz(l.seg.s, "eg|" + onaltilik(new Uint8Array(bit)));
  } catch (e) { return null; }
}

/* açılan lore anahtarları: kalıcı (kodla açtıkların) + oturum (Evrengezer yöneticisi olarak açılanlar) */
const EVL_OTURUM = {};

function evlAcilan(eid) {
  const d = jsonOku(EVL_ANAHTAR, {});
  const k = Object.assign({}, (d && d[eid]) || {}, EVL_OTURUM[eid] || {});
  return k;
}

function evlKaydet(eid, loreId, ck) {
  const d = jsonOku(EVL_ANAHTAR, {}) || {};
  if (!d[eid]) { d[eid] = {}; }
  d[eid][loreId] = ck;
  jsonYaz(EVL_ANAHTAR, d);
}

function evkKodlar(eid) {
  const d = jsonOku(EVK_ANAHTAR, {}) || {};
  return d[eid] || { lore: {} };
}

function evkYaz(eid, fn) {
  const d = jsonOku(EVK_ANAHTAR, {}) || {};
  if (!d[eid]) { d[eid] = { lore: {} }; }
  if (!d[eid].lore) { d[eid].lore = {}; }
  fn(d[eid]);
  jsonYaz(EVK_ANAHTAR, d);
}

/** Evrende kod dener: yalnızca bu evrenin lore kodları, bu evrenin yönetici kodu ve Evrengezer yönetici kodları. */
async function evrenKodDene(e, kod) {
  const k = evKodTemiz(kod);
  if (!k) { return { tur: "", n: 0 }; }
  /* Evrengezer yönetici kodu: bütün evrenlerde çalışır */
  const ham = String(kod).trim();
  const egKod = (veri.yoneticiOzet && dogrulamaOzeti(ham) === veri.yoneticiOzet) || (typeof sinirliKodMu === "function" && sinirliKodMu(ham));
  if (egKod && typeof yoneticiGiris === "function" && yoneticiGiris(ham)) {
    if (typeof kanonSifirla === "function") { kanonSifirla(); }
    const n = await evrenEgAc(e);
    return { tur: "evrengezer", n: n };
  }
  const lorlar = e.lorlar || [];
  if (e.yoneticiOzet && e.yoneticiOzet === evYonOzet(e.id, k)) {
    let n = 0;
    lorlar.forEach(function (l) {
      if (!l.sy) { return; }
      const ck = lorAnahtarCoz(l.sy, "evyonk|" + e.id + "|" + k + "|" + l.tuz);
      if (ck && lorIcCoz(l, ck) !== null) { evlKaydet(e.id, l.id, ck); n++; }
    });
    return { tur: "evren", n: n };
  }
  const ozet = lorKodOzet(e.id, k);
  let n = 0;
  lorlar.forEach(function (l) {
    if (l.ko !== ozet) { return; }
    const ck = lorAnahtarCoz(l.sk, "lorek|" + e.id + "|" + k + "|" + l.tuz);
    if (ck && lorIcCoz(l, ck) !== null) { evlKaydet(e.id, l.id, ck); n++; }
  });
  return { tur: n ? "lore" : "", n: n };
}

/** Evrengezer yöneticisi: bu evrenin bütün lorelarını (Evrengezer'e sarılı olanları) bu oturum için açar. */
async function evrenEgAc(e) {
  const gizli = await egGizliAnahtar();
  if (!gizli) { return 0; }
  let n = 0;
  for (const l of (e.lorlar || [])) {
    const ck = await egLorAc(l, gizli);
    if (ck && lorIcCoz(l, ck) !== null) {
      if (!EVL_OTURUM[e.id]) { EVL_OTURUM[e.id] = {}; }
      EVL_OTURUM[e.id][l.id] = ck;
      n++;
    }
  }
  return n;
}

/** Kurucu: yeni kilitli lore. */
async function evrenLoreEkle(e, bilgi) {
  const kod = evKodTemiz(bilgi.kod);
  if (!String(bilgi.baslik || "").trim()) { return "Başlık yaz."; }
  if (!String(bilgi.metin || "").trim()) { return "Kilitlenecek metni yaz."; }
  if (kod.length < 4) { return "Kod en az 4 karakter olsun."; }
  const ck = evRastHex(16), tuz = evRastHex(12);
  const l = { id: "l" + Date.now().toString(36) + evRastHex(2), baslik: String(bilgi.baslik).slice(0, 160), ipucu: String(bilgi.ipucu || "").slice(0, 500),
    ipucuFiyat: Math.max(0, Math.min(10000, Math.round(Number(bilgi.ipucuFiyat) || 0))), tuz: tuz,
    ic: sifrele(JSON.stringify({ m: String(bilgi.metin).slice(0, 40000) }), "loreic|" + ck + "|" + tuz),
    ko: lorKodOzet(e.id, kod), sk: sifrele(ck, "lorek|" + e.id + "|" + kod + "|" + tuz) };
  const yon = evkKodlar(e.id).yon;
  if (yon && e.yoneticiOzet === evYonOzet(e.id, yon)) { l.sy = sifrele(ck, "evyonk|" + e.id + "|" + evKodTemiz(yon) + "|" + tuz); }
  try { const s = await egSar(ck); if (s) { l.seg = s; } } catch (_) { /* Evrengezer anahtarı kurulmamış */ }
  evlKaydet(e.id, l.id, ck);
  evkYaz(e.id, function (d) { d.lore[l.id] = kod; });
  evrenBenimDegistir(e.id, function (x) { if (!Array.isArray(x.lorlar)) { x.lorlar = []; } x.lorlar.push(l); });
  return "";
}

/** Kurucu: evren yönetici kodu. Anahtarı bilinen (bu cihazda açık) bütün lorelar koda yeniden sarılır. */
function evrenYoneticiKoduKur(e, kod) {
  const k = evKodTemiz(kod);
  if (k.length < 6) { return { hata: "Yönetici kodu en az 6 karakter olsun." }; }
  const acik = evlAcilan(e.id);
  let sarilan = 0, kalan = 0;
  evrenBenimDegistir(e.id, function (x) {
    x.yoneticiOzet = evYonOzet(x.id, k);
    (x.lorlar || []).forEach(function (l) {
      const ck = acik[l.id];
      if (ck && lorIcCoz(l, ck) !== null) { l.sy = sifrele(ck, "evyonk|" + x.id + "|" + k + "|" + l.tuz); sarilan++; }
      else { delete l.sy; kalan++; }
    });
  });
  evkYaz(e.id, function (d) { d.yon = k; });
  return { sarilan: sarilan, kalan: kalan };
}

/** Evrengezer anahtarı sonradan kurulduysa, kurucunun açık lorelarını ona da sarar. */
async function evrenEgSarEksik(e) {
  if (!veri.evrengezer || !veri.evrengezer.acik) { return 0; }
  const acik = evlAcilan(e.id);
  const eksik = (e.lorlar || []).filter(function (l) { return !l.seg && acik[l.id]; });
  if (!eksik.length) { return 0; }
  const sarlar = {};
  for (const l of eksik) { const s = await egSar(acik[l.id]); if (s) { sarlar[l.id] = s; } }
  evrenBenimDegistir(e.id, function (x) { (x.lorlar || []).forEach(function (l) { if (sarlar[l.id]) { l.seg = sarlar[l.id]; } }); });
  return Object.keys(sarlar).length;
}

function evrenBenimDegistir(id, fn) {
  const l = fanEserlerim();
  const e = l.find(function (x) { return x.id === id && x.tur === "evren"; });
  if (!e) { return; }
  fn(e);
  e.guncelleme = new Date().toISOString();
  fanEserlerimYaz(l);
}

/* ==================== evren sayfası: ek sekmeler ==================== */

function evrenEkSekmeler(v) {
  const l = [];
  if (EVS.kaynak === "site") { return l; }
  const lorlar = (v.eser.lorlar || []).length;
  if (EVS.kaynak === "benim" || lorlar) { l.push(["lore", "Kilitli lore" + (lorlar ? " (" + lorlar + ")" : "")]); }
  if (EVS.kaynak === "benim") { l.push(["stil", "Stil ve para"]); l.push(["kod", "Kod"]); }
  if (v.eser.alfabe && v.eser.alfabe.harfler && EVS.kaynak !== "benim") { l.push(["alfabe", "Alfabe"]); }
  return l;
}

function evrenEkBolum(v) {
  if (EVS.sekme === "lore") { return evrenLoreBolumu(v); }
  if (EVS.sekme === "stil" && EVS.kaynak === "benim") { return evrenStilBolumu(v); }
  if (EVS.sekme === "kod" && EVS.kaynak === "benim") { return evrenKodBolumu(v); }
  if (EVS.sekme === "alfabe") { return evrenAlfabeCevirici(v.eser); }
  return null;
}

/* ---------- kilitli lore ---------- */

let evlOtoDenendi = {};

function evrenLoreBolumu(v) {
  const e = v.eser;
  const benim = EVS.kaynak === "benim";
  const acik = evlAcilan(e.id);
  const kodlar = benim ? evkKodlar(e.id) : { lore: {} };
  const p = evrenParasi(evrenCuzdanAnahtari(), e);
  egYukle();
  /* Evrengezer yöneticisi sayfayı açınca lorelar kendiliğinden açılır */
  if (egYoneticiKodu() && veri.evrengezer && !evlOtoDenendi[e.id]) {
    evlOtoDenendi[e.id] = true;
    evrenEgAc(e).then(function (n) { if (n && EVS && EVS.sekme === "lore") { evrenSayfaCiz(); } });
  }
  if (benim && veri.evrengezer && veri.evrengezer.acik) {
    evrenEgSarEksik(e).then(function (n) { if (n && EVS && EVS.sekme === "lore") { evrenSayfaCiz(); } });
  }
  const liste = (e.lorlar || []).map(function (l) {
    const ck = acik[l.id];
    const metin = ck ? lorIcCoz(l, ck) : null;
    const ipucuAcik = benim || !l.ipucuFiyat || egCuzdan.ipucu.indexOf(e.id + "/" + l.id) !== -1;
    return '<div class="kutu-y evl-oge' + (metin !== null ? " acik" : "") + '" data-evl="' + kacir(l.id) + '">' +
      '<div class="evl-bas"><b>' + (metin !== null ? "" : (typeof KANON_KILIT_SVG !== "undefined" ? KANON_KILIT_SVG + " " : "🔒 ")) + kacir(l.baslik) + "</b></div>" +
      (metin !== null ? '<div class="okuma-metin evl-metin">' + paragraf(metin) + "</div>"
        : (l.ipucu ? (ipucuAcik ? '<p class="oyun-not">İpucu: ' + kacir(l.ipucu) + "</p>"
          : '<button class="dugme dugme-sade" data-evl-ipucu="' + kacir(l.id) + '">İpucunu al (' + kacir(egTutar(l.ipucuFiyat, p)) + ")</button>") : "")) +
      (benim ? '<div class="oyun-sira evl-kurucu">' +
        (kodlar.lore[l.id] ? '<span class="oyun-not">Kodu: <code>' + kacir(kodlar.lore[l.id]) + "</code></span>" : "") +
        (l.seg ? '<span class="oyun-not">· Evrengezer yöneticisi de açabilir</span>' : "") +
        '<button class="dugme dugme-sade y-sil" data-evl-sil="' + kacir(l.id) + '">Sil</button></div>' : "") +
      "</div>";
  }).join("");
  const kodGir = '<div class="kutu-y evl-kod"><label for="evlKod">Bu evrenin kodu</label>' +
    '<p class="oyun-not">Lore kodları ve evrenin yönetici kodu yalnızca bu evrende çalışır; başka evrenlerin kodları burada açmaz. Evrengezer yönetici kodları her evrende çalışır.</p>' +
    '<div class="oyun-sira"><input class="kod-giris arac-giris" id="evlKod" autocomplete="off" spellcheck="false" maxlength="60" placeholder="Kodu yaz">' +
    '<button class="dugme" data-evl-kod>Aç</button></div><p class="pencere-durum" id="evlDurum" role="status"></p></div>';
  const ekle = benim ? '<details class="kutu-y evl-ekle"' + (e.lorlar && e.lorlar.length ? "" : " open") + "><summary><b>+ Kilitli lore ekle</b></summary>" +
    '<p class="oyun-not">Metin bu cihazda şifrelenir; dosyada ve sitede yalnızca şifreli hâli durur. Kodu bilen, bu evrende açar.</p>' +
    '<label for="evlBaslik">Başlık (herkes görür)</label><input class="kod-giris arac-giris" id="evlBaslik" maxlength="160">' +
    '<label for="evlMetin">Kilitli metin</label><textarea class="kod-giris arac-giris fan-uzun" id="evlMetin" rows="6"></textarea>' +
    '<label for="evlYeniKod">Açılış kodu</label><div class="oyun-sira"><input class="kod-giris arac-giris" id="evlYeniKod" maxlength="60" autocomplete="off" spellcheck="false">' +
      '<button class="dugme dugme-sade" data-evl-kod-uret>Kod üret</button></div>' +
    '<label for="evlIpucu">İpucu (isteğe bağlı, herkes görür)</label><input class="kod-giris arac-giris" id="evlIpucu" maxlength="500">' +
    '<label for="evlIpucuFiyat">İpucunun fiyatı (' + kacir(p.ad) + "; 0 = bedava)</label>" +
      '<input class="kod-giris arac-giris" id="evlIpucuFiyat" type="number" min="0" max="10000" step="1" value="0" inputmode="numeric">' +
    '<button class="dugme" data-evl-ekle>Kilitle ve ekle</button><p class="pencere-durum" id="evlEkleDurum" role="status"></p></details>' +
    evrenYoneticiKoduHtml(e, kodlar) : "";
  return kodGir + (liste || '<p class="oyun-not">' + (benim ? "Henüz kilitli lore yok." : "Bu evrende kilitli lore yok.") + "</p>") + ekle;
}

function evrenYoneticiKoduHtml(e, kodlar) {
  const kurulu = !!e.yoneticiOzet;
  const biliniyor = kurulu && kodlar.yon && e.yoneticiOzet === evYonOzet(e.id, kodlar.yon);
  return '<div class="kutu-y"><label for="evyKod">Evrenin yönetici kodu</label>' +
    '<p class="oyun-not">Bu kodu bilen, bu evrendeki bütün kilitli loreları açar. Yalnızca bu evrende çalışır. ' +
      "Sitenin Evrengezer yönetici kodları ise her evrende çalışır" + (veri.evrengezer && veri.evrengezer.acik ? "." : " (site Evrengezer anahtarını kurunca).") + "</p>" +
    (biliniyor ? '<p class="oyun-not">Şu anki kod: <code>' + kacir(kodlar.yon) + "</code></p>" : (kurulu ? '<p class="oyun-not">Bir yönetici kodu kurulu (bu cihazda kayıtlı değil).</p>' : "")) +
    '<div class="oyun-sira"><input class="kod-giris arac-giris" id="evyKod" maxlength="60" autocomplete="off" spellcheck="false" placeholder="Yeni yönetici kodu">' +
      '<button class="dugme dugme-sade" data-evy-uret>Kod üret</button><button class="dugme" data-evy-kur>' + (kurulu ? "Değiştir" : "Kur") + "</button></div>" +
    '<p class="pencere-durum" id="evyDurum" role="status"></p></div>';
}

/* ---------- stil ve para ---------- */

function evrenStilBolumu(v) {
  const e = v.eser;
  const para = e.para || { ad: "", simge: "", kur: 0.1 };
  const st = e.stil || {};
  const hs = (e.harita && e.harita.stil) || {};
  const al = (e.alfabe && e.alfabe.harfler) || {};
  const renk = function (yol, deger, yedek, etiket) {
    return '<label class="evst-renk">' + etiket + ' <input type="color" data-evst="' + yol + '" value="' + kacir(deger || yedek) + '"></label>';
  };
  const secim = function (yol, deger, secenekler) {
    return '<select class="kod-giris arac-giris" data-evst="' + yol + '">' + secenekler.map(function (s) {
      return '<option value="' + s[0] + '"' + (String(deger || "") === s[0] ? " selected" : "") + ">" + kacir(s[1]) + "</option>";
    }).join("") + "</select>";
  };
  return '<div class="kutu-y"><label>Evrenin parası</label>' +
      '<p class="oyun-not">Başka evrenlerden gelen gezginler bu parayla ödüllenir ve ipuçlarını bununla alır. Kur: bu paranın 1 biriminin kaç Evrengezer (EG) ettiği (0,01–1).</p>' +
      '<div class="evst-izgara"><label>Adı<input class="kod-giris arac-giris" data-evst="para.ad" maxlength="24" value="' + kacir(para.ad) + '" placeholder="' + kacir((e.ad || "Evren") + " parası") + '"></label>' +
      '<label>Simgesi<input class="kod-giris arac-giris" data-evst="para.simge" maxlength="3" value="' + kacir(para.simge) + '"></label>' +
      '<label>Kur (EG)<input class="kod-giris arac-giris" data-evst="para.kur" type="number" min="0.01" max="1" step="0.01" value="' + kacir(para.kur) + '"></label></div></div>' +
    '<div class="kutu-y"><label>Sayfa stili</label><div class="evst-izgara">' +
      renk("stil.zemin", st.zemin, "#F4F9FD", "Zemin") + renk("stil.yazi", st.yazi, "#0A0F14", "Yazı") + renk("stil.ana", st.ana, "#1C5C96", "Ana renk") +
      "<label>Yazı tipi" + secim("stil.font", st.font, [["", "Sitenin"], ["serif", "Tırnaklı"], ["sans", "Sade"], ["mono", "Daktilo"]]) + "</label>" +
      '<label>Köşe yuvarlaklığı<input type="range" min="0" max="24" data-evst="stil.kose" value="' + kacir(typeof st.kose === "number" ? st.kose : 4) + '"></label></div>' +
      '<button class="dugme dugme-sade" data-evst-sifirla="stil">Sitenin stiline dön</button></div>' +
    '<div class="kutu-y"><label>Harita stili</label><div class="evst-izgara">' +
      "<label>Desen" + secim("harita.stil.desen", hs.desen, Object.keys(EVH_DESENLER).map(function (k) { return [k === "duz" ? "" : k, EVH_DESENLER[k].ad]; })) + "</label>" +
      renk("harita.stil.kara", hs.kara, "#E6DCC3", "Kara") + renk("harita.stil.cizgi", hs.cizgi, "#8A7B5E", "Sınır") + renk("harita.stil.yazi", hs.yazi, "#1D2530", "Yazı") +
      "<label>Harita yazısı" + secim("harita.stil.font", hs.font, [["", "Tırnaklı"], ["sans", "Sade"], ["mono", "Daktilo"], ["alfabe", "Evrenin alfabesi"]]) + "</label>" +
      '<label class="evst-kutu"><input type="checkbox" data-evst="harita.stil.izgara"' + (hs.izgara ? " checked" : "") + "> Izgara çizgileri</label></div>" +
      '<div class="evh-kutu evst-onizleme">' + evrenHaritaSvg(e.harita || { yerler: [] }, { alfabe: e.alfabe }) + "</div>" +
      '<button class="dugme dugme-sade" data-evst-sifirla="harita">Harita stilini sıfırla</button></div>' +
    '<div class="kutu-y"><label>Evrenin alfabesi</label>' +
      '<p class="oyun-not">Her harfin yerine kendi işaretini yaz (en fazla 4 karakter). Evrenin adı ve istersen harita yazıları bu alfabeyle de görünür.</p>' +
      '<div class="evst-alfabe">' + ALFABE_HARFLER.split("").map(function (c) {
        return '<label><span>' + c + '</span><input class="kod-giris" data-evst="alfabe.harfler.' + c + '" maxlength="4" value="' + kacir(al[c] || "") + '"></label>';
      }).join("") + "</div>" +
      '<label class="evst-kutu"><input type="checkbox" data-evst="alfabe.baslik"' + (e.alfabe && e.alfabe.baslik ? " checked" : "") + "> Evrenin adını alfabeyle de göster</label>" +
      '<div class="oyun-sira"><button class="dugme dugme-sade" data-evst-alfabe-uret>Rastgele alfabe üret</button>' +
      '<button class="dugme dugme-sade" data-evst-sifirla="alfabe">Alfabeyi sil</button></div>' +
      evrenAlfabeCevirici(e) + "</div>";
}

function evrenAlfabeCevirici(e) {
  return '<div class="kutu-y evst-cevir"><label for="evstCevir">Alfabeyle yaz</label>' +
    '<input class="kod-giris arac-giris" id="evstCevir" data-evst-cevir maxlength="200" placeholder="Bir şey yaz">' +
    '<p class="evst-cikti" data-evst-cikti>' + kacir(evrenAlfabeYaz(e.ad || "", e.alfabe)) + "</p>" +
    (EVS && EVS.kaynak !== "benim" && e.alfabe ? '<div class="evst-alfabe okunur">' + ALFABE_HARFLER.split("").map(function (c) {
      return "<span><b>" + kacir((e.alfabe.harfler || {})[c] || c) + "</b>" + c + "</span>";
    }).join("") + "</div>" : "") + "</div>";
}

function evrenStilYaz(e, yol, deger) {
  const p = yol.split(".");
  let o = e;
  for (let i = 0; i < p.length - 1; i++) {
    if (!o[p[i]] || typeof o[p[i]] !== "object") { o[p[i]] = {}; }
    o = o[p[i]];
  }
  const son = p[p.length - 1];
  if (deger === "" || deger === null || deger === false) { delete o[son]; } else { o[son] = deger; }
}

/* ---------- kod (JSON) ---------- */

function evrenKodBolumu(v) {
  const e = v.eser;
  return '<div class="kutu-y"><label for="evKodMetin">Evrenin kodu</label>' +
    '<p class="oyun-not">Evreninin bütün içeriği (kurallar, kişiler, harita, stil, para, alfabe…) burada. Değiştir ve “Uygula”ya bas. ' +
      "Tanınmayan alanlar ve sınır dışı değerler temizlenir; kilitli loreların şifreli alanlarına dokunursan o lorelar açılmaz olur.</p>" +
    '<textarea class="kod-giris arac-giris evkod" id="evKodMetin" rows="22" spellcheck="false" autocapitalize="off" autocomplete="off">' +
      kacir(JSON.stringify(e, null, 2)) + "</textarea>" +
    '<div class="oyun-sira"><button class="dugme" data-evkod-uygula>Uygula</button>' +
    '<button class="dugme dugme-sade" data-evkod-geri>Değişiklikleri at</button></div>' +
    '<p class="pencere-durum" id="evKodDurum" role="status"></p></div>';
}

function evrenKodUygula(id, metin) {
  let ham;
  try { ham = JSON.parse(metin); } catch (hata) { return "Kod okunamadı: " + ((hata && hata.message) || "JSON hatası"); }
  if (!ham || typeof ham !== "object" || Array.isArray(ham)) { return "Kod bir nesne olmalı: { … }"; }
  ham.bicim = FAN_BICIM;
  ham.tur = "evren";
  ham.id = id;
  const t = fanTemizle(ham);
  if (!t) { return "Evrenin bir adı (\"ad\") olmalı."; }
  const l = fanEserlerim();
  const i = l.findIndex(function (x) { return x.id === id && x.tur === "evren"; });
  if (i === -1) { return "Evren bulunamadı."; }
  t.guncelleme = new Date().toISOString();
  if (l[i].olusturma && !t.olusturma) { t.olusturma = l[i].olusturma; }
  l[i] = t;
  fanEserlerimYaz(l);
  return "";
}

/* ==================== panel: Evrengezer ==================== */

function yoneticiEvrengezer() {
  if (!(typeof yoneticiAcik === "function" && yoneticiAcik())) { return '<p class="oyun-not">Bu sekme yalnızca tam yöneticiye açık.</p>'; }
  const eg = veri.evrengezer || {};
  const paralar = veri.evrenParalari || {};
  const evrenler = [["tomye", "Tömye (24. Evren)"]].concat(Object.keys(veri.kanonEvrenleri || {}).map(function (k) { return [k, k.toUpperCase()]; }))
    .concat(veri.e99 ? [["e99", "E99"]] : []);
  const c = veri.cuzdan || {};
  return '<div class="kutu-y"><label>Evrengezer anahtarı</label>' +
      '<p class="oyun-not">Kurulunca, okurların kendi evrenlerine eklediği kilitli lorelar senin yönetici kodlarınla (tam ve sınırlı) da açılır — her evrende. ' +
        "Gizli anahtar veride yalnızca bu kodlara sarılı durur. Kurduktan sonra Kaydet ve Yayınla.</p>" +
      '<p class="oyun-not">Durum: <b>' + (eg.acik ? "kurulu" + (eg.sinirli ? " (tam + sınırlı kod)" : " (yalnızca tam kod)") : "kurulu değil") + "</b></p>" +
      '<label for="yEgSinirli">Sınırlı yönetici kodu (isteğe bağlı: o kodla da açılsın)</label>' +
      '<input class="kod-giris arac-giris" id="yEgSinirli" autocomplete="off" spellcheck="false">' +
      '<button class="dugme" data-y-eg-kur>' + (eg.acik ? "Anahtarı yeniden kur" : "Evrengezer anahtarını kur") + "</button>" +
      (eg.acik ? '<p class="oyun-not">Yeniden kurarsan eski anahtara sarılı loreları Evrengezer kodları açamaz (lore ve evren kodları çalışmaya devam eder).</p>' : "") +
    "</div>" +
    '<div class="kutu-y"><label>Evren paraları</label>' +
      '<p class="oyun-not">Kur: 1 birimin EG karşılığı. Tömye\'nin parasının adı Cüzdan ayarlarından (birim) gelir. Gezi ödülü her evrende ' + EG_ZIYARET_DEGER + " EG değerinde; çeviri kesintisi %" + Math.round(EG_KESINTI * 100) + ".</p>" +
      evrenler.map(function (x) {
        const p = paralar[x[0]] || {};
        return '<div class="evst-izgara" data-y-para="' + x[0] + '"><b>' + kacir(x[1]) + "</b>" +
          (x[0] === "tomye" ? "<span>" + kacir(birim()) + "</span>" : '<input class="kod-giris arac-giris" data-y-para-alan="ad" maxlength="24" value="' + kacir(p.ad || "") + '" placeholder="' + kacir(x[1] + " jetonu") + '">') +
          '<input class="kod-giris arac-giris" data-y-para-alan="simge" maxlength="3" value="' + kacir(p.simge || "") + '" placeholder="simge">' +
          '<input class="kod-giris arac-giris" data-y-para-alan="kur" type="number" min="0.01" max="1" step="0.01" value="' + kacir(p.kur || 0.1) + '"></div>';
      }).join("") +
    "</div>" +
    '<div class="kutu-y"><label>Tömye ekonomisi</label>' +
      '<p class="oyun-not">Oyunların günlük kazanç tavanları ve hepsinin toplam tavanı. Toplam tavan tek bir oyunda bütün günün kazancının toplanmasını önler.</p>' +
      '<div class="evst-izgara">' + Object.keys(c.gunlukTavan || {}).map(function (k) {
        return "<label>" + kacir(k) + '<input class="kod-giris arac-giris" type="number" min="0" max="2000" data-y-tavan="' + kacir(k) + '" value="' + kacir(c.gunlukTavan[k]) + '"></label>';
      }).join("") +
      '<label>Toplam<input class="kod-giris arac-giris" type="number" min="0" max="5000" data-y-tavan="*" value="' + kacir(c.genelTavan || 0) + '"></label></div>' +
      '<button class="dugme" data-y-ekonomi-kaydet>Paraları ve tavanları uygula</button>' +
      '<p class="oyun-not">Sonra Kaydet ve Yayınla.</p></div>';
}

async function evrengezerAnahtariKur(sinirliKod) {
  if (!(typeof yoneticiKod !== "undefined" && yoneticiKod)) { return "Tam yönetici koduyla giriş gerekli."; }
  const s = String(sinirliKod || "").trim();
  if (s && !(typeof sinirliKodMu === "function" && sinirliKodMu(s))) { return "Sınırlı kod doğru değil."; }
  const cift = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const jwk = JSON.stringify(await crypto.subtle.exportKey("jwk", cift.privateKey));
  const acik = await crypto.subtle.exportKey("raw", cift.publicKey);
  veri.evrengezer = { acik: b64Bayt(acik), tam: sifrele(jwk, "egyon|" + yoneticiKod) };
  if (s) { veri.evrengezer.sinirli = sifrele(jwk, "egyon|" + s); }
  egGizliOnbellek = null;
  evlOtoDenendi = {};
  return "";
}

/* ==================== olaylar ==================== */

document.addEventListener("click", async function (ev) {
  const h = ev.target.closest("[data-eg-buro], [data-eg-al], [data-eg-sat], [data-evl-kod], [data-evl-kod-uret], [data-evl-ekle], [data-evl-sil], [data-evl-ipucu], " +
    "[data-evy-uret], [data-evy-kur], [data-evst-sifirla], [data-evst-alfabe-uret], [data-evkod-uygula], [data-evkod-geri], [data-y-eg-kur], [data-y-ekonomi-kaydet], [data-eg-cuzdan-buro]");
  if (!h) { return; }
  const d = h.dataset;
  const v = EVS ? evrenSayfaVerisi() : null;
  const durum = function (sec, m, iyi) { const x = document.querySelector(sec); if (x) { x.textContent = m; x.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };

  if (h.hasAttribute("data-eg-buro")) { egBuroAc(v ? { anahtar: evrenCuzdanAnahtari(), eser: v.eser } : null); return; }
  if (h.hasAttribute("data-eg-cuzdan-buro")) { egBuroAc(null); return; }
  if (d.egAl || d.egSat) {
    const a = d.egAl || d.egSat;
    const satir = h.closest("[data-eg-satir]");
    const x = satir ? satir.querySelector("input").value : 0;
    const eser = egBuroOdak && egBuroOdak.anahtar === a ? egBuroOdak.eser : null;
    const hata = d.egAl ? egAl(a, x, eser) : egSat(a, x, eser);
    egBuroTazele(hata || (d.egAl ? "EG alındı." : "EG satıldı."), !hata);
    return;
  }
  if (!v) {
    if (h.hasAttribute("data-y-eg-kur")) {
      const hata = await evrengezerAnahtariKur((document.querySelector("#yEgSinirli") || {}).value);
      if (typeof yoneticiDurum === "function") { yoneticiDurum(hata || "Evrengezer anahtarı kuruldu — Kaydet, sonra Yayınla", !hata); }
      if (!hata && typeof yoneticiCiz === "function") { yoneticiCiz(); }
      return;
    }
    if (h.hasAttribute("data-y-ekonomi-kaydet")) {
      if (!veri.evrenParalari) { veri.evrenParalari = {}; }
      document.querySelectorAll("[data-y-para]").forEach(function (sat) {
        const id = sat.getAttribute("data-y-para");
        const al = function (k) { const i = sat.querySelector('[data-y-para-alan="' + k + '"]'); return i ? i.value.trim() : ""; };
        const kur = Math.min(1, Math.max(0.01, Number(al("kur")) || 0.1));
        const p = { simge: al("simge").slice(0, 3), kur: Math.round(kur * 100) / 100 };
        if (id !== "tomye" && al("ad")) { p.ad = al("ad").slice(0, 24); }
        veri.evrenParalari[id] = p;
      });
      if (!veri.cuzdan) { veri.cuzdan = {}; }
      if (!veri.cuzdan.gunlukTavan) { veri.cuzdan.gunlukTavan = {}; }
      document.querySelectorAll("[data-y-tavan]").forEach(function (i) {
        const n = Math.max(0, Math.round(Number(i.value) || 0));
        if (i.getAttribute("data-y-tavan") === "*") { veri.cuzdan.genelTavan = n; } else { veri.cuzdan.gunlukTavan[i.getAttribute("data-y-tavan")] = n; }
      });
      if (typeof yoneticiDurum === "function") { yoneticiDurum("Ekonomi güncellendi — Kaydet, sonra Yayınla", true); }
      return;
    }
    return;
  }
  const e = v.eser;

  if (h.hasAttribute("data-evl-kod")) {
    const i = document.querySelector("#evlKod");
    const s = await evrenKodDene(e, i ? i.value : "");
    if (!s.tur) { durum("#evlDurum", "Bu kod bu evrende çalışmıyor.", false); return; }
    evrenSayfaCiz();
    durum("#evlDurum", s.tur === "evrengezer" ? "Evrengezer yöneticisi · " + s.n + " lore açıldı" :
      (s.tur === "evren" ? "Evren yönetici kodu · " + s.n + " lore açıldı" : s.n + " lore açıldı"), true);
    return;
  }
  if (h.hasAttribute("data-evl-kod-uret")) { const i = document.querySelector("#evlYeniKod"); if (i) { i.value = evKodUret("LOR"); } return; }
  if (h.hasAttribute("data-evl-ekle") && EVS.kaynak === "benim") {
    const deger = function (s) { const x = document.querySelector(s); return x ? x.value : ""; };
    h.disabled = true;
    const hata = await evrenLoreEkle(e, { baslik: deger("#evlBaslik"), metin: deger("#evlMetin"), kod: deger("#evlYeniKod"), ipucu: deger("#evlIpucu"), ipucuFiyat: deger("#evlIpucuFiyat") });
    h.disabled = false;
    if (hata) { durum("#evlEkleDurum", hata, false); return; }
    evrenSayfaCiz();
    durum("#evlDurum", "Lore kilitlendi ve eklendi.", true);
    return;
  }
  if (d.evlSil && EVS.kaynak === "benim") {
    if (h.dataset.onay !== "1") { h.dataset.onay = "1"; h.textContent = "Emin misin? Sil"; return; }
    evrenBenimDegistir(e.id, function (x) { x.lorlar = (x.lorlar || []).filter(function (l) { return l.id !== d.evlSil; }); });
    evrenSayfaCiz();
    return;
  }
  if (d.evlIpucu) {
    const l = (e.lorlar || []).find(function (x) { return x.id === d.evlIpucu; });
    if (!l) { return; }
    const a = evrenCuzdanAnahtari();
    const p = evrenParasi(a, e);
    if (egBakiye(a) < l.ipucuFiyat) { durum("#evlDurum", "Yetmez: " + egTutar(l.ipucuFiyat, p) + " gerekiyor. Evrengezer bürosunda EG'yi bu paraya çevirebilirsin.", false); return; }
    egParaHatirla(a, p);
    egBakiyeDegistir(a, -l.ipucuFiyat, "İpucu: " + l.baslik);
    egYukle().ipucu.push(e.id + "/" + l.id);
    egKaydet();
    evrenSayfaCiz();
    return;
  }
  if (h.hasAttribute("data-evy-uret")) { const i = document.querySelector("#evyKod"); if (i) { i.value = evKodUret("EVY"); } return; }
  if (h.hasAttribute("data-evy-kur") && EVS.kaynak === "benim") {
    const s = evrenYoneticiKoduKur(e, (document.querySelector("#evyKod") || {}).value);
    if (s.hata) { durum("#evyDurum", s.hata, false); return; }
    evrenSayfaCiz();
    durum("#evyDurum", "Yönetici kodu kuruldu" + (s.sarilan ? " · " + s.sarilan + " lore bu koda bağlandı" : "") +
      (s.kalan ? " · " + s.kalan + " lore bu cihazda açık değil, bağlanamadı" : ""), !s.kalan);
    return;
  }
  if (d.evstSifirla && EVS.kaynak === "benim") {
    evrenBenimDegistir(e.id, function (x) {
      if (d.evstSifirla === "stil") { delete x.stil; }
      if (d.evstSifirla === "harita" && x.harita) { delete x.harita.stil; delete x.harita.renk; }
      if (d.evstSifirla === "alfabe") { delete x.alfabe; }
    });
    evrenSayfaCiz();
    return;
  }
  if (h.hasAttribute("data-evst-alfabe-uret") && EVS.kaynak === "benim") {
    evrenBenimDegistir(e.id, function (x) { x.alfabe = { harfler: evrenRastgeleAlfabe(), baslik: !!(x.alfabe && x.alfabe.baslik) }; });
    evrenSayfaCiz();
    return;
  }
  if (h.hasAttribute("data-evkod-uygula") && EVS.kaynak === "benim") {
    const hata = evrenKodUygula(e.id, (document.querySelector("#evKodMetin") || {}).value || "");
    if (hata) { durum("#evKodDurum", hata, false); return; }
    evrenSayfaCiz();
    durum("#evKodDurum", "Uygulandı.", true);
    return;
  }
  if (h.hasAttribute("data-evkod-geri")) { evrenSayfaCiz(); }
});

/* stil alanları: renk/seçim/kutu değişince kaydet ve yeniden çiz; yazı alanlarında imleç kaçmasın diye yalnızca kaydet */
function evrenStilOlay(ev, yenidenCiz) {
  const el = ev.target;
  if (!el.matches || !el.matches("#evrenSayfa [data-evst]") || !EVS || EVS.kaynak !== "benim") { return; }
  const yol = el.getAttribute("data-evst");
  let deger = el.type === "checkbox" ? el.checked : el.value;
  if (el.type === "number" || el.type === "range") { deger = el.value === "" ? "" : Number(el.value); }
  if (yol.indexOf("alfabe.harfler.") === 0) { deger = String(deger).slice(0, 4); }
  evrenBenimDegistir(EVS.id, function (x) {
    evrenStilYaz(x, yol, deger);
    if (yol === "harita.stil.desen" && x.harita) { delete x.harita.renk; }
  });
  if (yenidenCiz) { evrenSayfaCiz(); }
}

document.addEventListener("input", function (ev) {
  const el = ev.target;
  if (el.matches && el.matches("#evrenSayfa [data-evst-cevir]")) {
    const v = evrenSayfaVerisi();
    const c = document.querySelector("#evrenSayfa [data-evst-cikti]");
    if (v && c) { c.textContent = evrenAlfabeYaz(el.value || v.eser.ad || "", v.eser.alfabe); }
    return;
  }
  if (el.matches && el.matches("#evrenSayfa [data-evst]") && (el.type === "text" || el.type === "number")) {
    evrenStilOlay(ev, false);
    /* alfabe harfi değişince çevirici ve alfabeli ad hemen güncellensin */
    if ((el.getAttribute("data-evst") || "").indexOf("alfabe.") === 0) {
      const v = evrenSayfaVerisi();
      const c = document.querySelector("#evrenSayfa [data-evst-cikti]");
      const g = document.querySelector("#evrenSayfa [data-evst-cevir]");
      if (v && c) { c.textContent = evrenAlfabeYaz((g && g.value) || v.eser.ad || "", v.eser.alfabe); }
    }
  }
});

document.addEventListener("change", function (ev) {
  const el = ev.target;
  if (!el.matches || !el.matches("#evrenSayfa [data-evst]")) { return; }
  /* yazı alanları "input"ta kaydedildi; burada yeniden çizmek sonraki alana geçen imleci kaçırırdı */
  if (el.tagName === "INPUT" && (el.type === "text" || el.type === "number")) { return; }
  evrenStilOlay(ev, true);
});

/* cüzdan penceresi: eçka yanına Evrengezer ve toplam tavan */
document.addEventListener("DOMContentLoaded", function () {
  if (typeof cuzdanPenceresi !== "function") { return; }
  const eski = cuzdanPenceresi;
  window.cuzdanPenceresi = function () {
    eski.apply(this, arguments);
    const p = document.querySelector("#perde .pencere");
    if (!p) { return; }
    const genel = veri.cuzdan && veri.cuzdan.genelTavan;
    const blok = document.createElement("div");
    blok.className = "arac-blok";
    blok.innerHTML = (genel ? '<p class="oyun-not">Oyunlardan bugün toplam: <b>' + gunlukToplamKazanc() + " / " + genel + " " + kacir(birim()) + "</b></p>" : "") +
      '<div class="oyun-etiket">Evrengezer</div><p class="oyun-not"><b>' + egYukle().eg + " EG</b> · " + kacir(birim()) +
      " Tömye'nin parası; başka evrenlerde o evrenin parası geçer.</p>" +
      '<button class="dugme dugme-sade" data-eg-cuzdan-buro>Evrengezer bürosu</button>';
    const ilk = p.querySelector(".oyun-etiket");
    p.insertBefore(blok, ilk || null);
  };
});
