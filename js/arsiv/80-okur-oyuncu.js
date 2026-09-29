/* Sürüm 2.8 — okurun ve oyuncunun zevkine; sunucuya yük bindirmeden (hepsi cihazda ya da mevcut eşitleme kaydında).
   Kesintisiz dinleme: sesli okuma cümle cümle; okunan cümle metinde işaretli; hız; uyku zamanlayıcısı; metin bitince
     sonrakine (roman bölümünde sonraki bölüme) geçer. Uygulamada telefonun sesiyle (78-uygulama-kabugu.js), ekran kararmaz.
   Harita Atlası: Harita Avı'nda bulunan yerler atlasa işlenir (cuzdan.acilan "atlas:<harita>:<yer>", hesapla eşitlenir);
     günün oyunu bitince XP'siz serbest turlarla atlas tamamlanır; tamamlanan harita unvan verir.
   Haftalık Tömye bulmacası: sözlük, kişiler ve maddelerden hafta numarasına göre üretilen çapraz bulmaca; herkese aynı.
   Okuma hedefi ve haftalık özet: okunan dakikalar ve kutular bu cihazda sayılır; Sen → Defterin'de hedef ve "Bu hafta"
     kartı (PNG olarak paylaşılır).
   Kısayollar ve hatırlatmalar: ?kisayol=devam|bugun|havi|bulmaca (uygulama simgesi ve ana ekran kısayolları); uygulamada
     seri, okuma yolu ve okuma hedefi için yerel bildirim (sessiz saatlere uyar); tarayıcıda site açıkken şerit.
   Kendi okuma yolun: kutuları seç, sırala, adlandır; bağlantıyla paylaş (?yol=…).
   Karakter zaman çizgisi: karakter penceresinde adının geçtiği zaman adımları çağlarıyla, mektupları ve günlükleri. */

const TF28 = { ses: "tf28_ses", okuma: "tf28_okuma", kutu: "tf28_kutu", hedef: "tf28_hedef", bulmaca: "tf28_bulmaca", yollar: "tf28_yollar",
  hatirlat: "tf28_hatirlat", serit: "tf28_serit", atlasGun: "tf28_atlas_gun" };

function tf28Oku(k, v) { try { const x = JSON.parse(localStorage.getItem(k)); return x === null || x === undefined ? v : x; } catch (_) { return v; } }
function tf28Yaz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* dolu */ } }
function yerelGun(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

/* ==================== kesintisiz dinleme ==================== */

const SES = { aktif: false, duraklat: false, el: null, dugme: null, cumleler: [], i: 0, nesil: 0, uyku: null, bolumSonu: false, baslik: "" };
const SES_HIZ = [0.8, 0.95, 1.1, 1.3, 1.5];

function sesAyar() { const a = tf28Oku(TF28.ses, {}) || {}; return { hiz: SES_HIZ.indexOf(a.hiz) !== -1 ? a.hiz : 0.95, uyku: a.uyku || "" }; }

/** Metni cümlelere böler; her cümlenin metindeki yeri (Range) — işaretlemek ve göstermek için. */
function cumleler(el) {
  const dugumler = typeof metinDugumleri === "function" ? metinDugumleri(el) : [];
  let s = "";
  const harita = [];
  let oncekiBlok = null;
  dugumler.forEach(function (n) {
    const blok = n.parentElement.closest("p, li, blockquote, div, h1, h2, h3, h4") || el;
    if (oncekiBlok && blok !== oncekiBlok) { s += "\n"; harita.push(harita[harita.length - 1]); }
    oncekiBlok = blok;
    for (let i = 0; i < n.data.length; i++) { s += n.data[i]; harita.push([n, i]); }
  });
  const l = [];
  const re = /[^.!?…\n]+(?:[.!?…]+["”’')\]]*|\n|$)/g;
  let m;
  while ((m = re.exec(s))) {
    if (!m[0]) { re.lastIndex++; continue; }
    const t = m[0].replace(/\s+/g, " ").trim();
    if (!t || !/[0-9A-Za-zÇĞİÖŞÜçğıöşü]/.test(t)) { continue; }
    let bas = m.index, son = m.index + m[0].length - 1;
    while (bas < son && /\s/.test(s[bas])) { bas++; }
    while (son > bas && /\s/.test(s[son])) { son--; }
    const a = harita[bas], b = harita[son];
    let r = null;
    if (a && b) { try { r = document.createRange(); r.setStart(a[0], a[1]); r.setEnd(b[0], b[1] + 1); } catch (_) { r = null; } }
    l.push({ metin: t, r: r });
  }
  return l;
}

function sesIsaret(r) {
  if (typeof CSS === "undefined" || !CSS.highlights || typeof Highlight !== "function") { return; }
  if (r) { CSS.highlights.set("tf-sesli", new Highlight(r)); } else { CSS.highlights.delete("tf-sesli"); }
}

function sesBasligi(el) {
  const p = el.closest("#perde .pencere");
  const h = (p && p.querySelector("h3")) || (el.closest(".evr-oku") && el.closest(".evr-oku").querySelector("h3, h4")) ||
    (el.closest("section.bolum") && el.closest("section.bolum").querySelector("h2")) || (el.closest("#evrenSayfa") && el.closest("#evrenSayfa").querySelector("h2, h1"));
  return h ? h.textContent.trim().slice(0, 60) : "Metin";
}

function sesBaslat(el, dugme) {
  dinlemeDurdur(true);
  const l = cumleler(el);
  if (!l.length) { return; }
  const a = sesAyar();
  SES.aktif = true; SES.duraklat = false; SES.el = el; SES.dugme = dugme || null; SES.cumleler = l; SES.i = 0;
  SES.baslik = sesBasligi(el);
  SES.bolumSonu = a.uyku === "bolum";
  if (!SES.uyku && /^\d+$/.test(a.uyku)) { SES.uyku = Date.now() + Number(a.uyku) * 60000; }
  if (SES.dugme) { SES.dugme.textContent = "■ Durdur"; SES.dugme.classList.add("okuyor"); }
  if (typeof ekranAcikTut === "function") { ekranAcikTut(true); }
  sesCubukCiz();
  sesSoyle();
}

function sesSoyle() {
  if (!SES.aktif || SES.duraklat) { return; }
  if (SES.uyku && Date.now() > SES.uyku) { dinlemeDurdur(); if (typeof eckaBildir === "function") { eckaBildir("Uyku zamanlayıcısı: dinleme durdu"); } return; }
  if (SES.i >= SES.cumleler.length) { sesSonraki(); return; }
  const c = SES.cumleler[SES.i];
  sesIsaret(c.r);
  if (c.r) {
    const k = c.r.getBoundingClientRect();
    if (k.height && (k.top < 70 || k.bottom > window.innerHeight - 140)) {
      const kap = SES.el.closest("#perde .pencere, #evrenSayfa");
      if (kap && kap.scrollHeight > kap.clientHeight) { kap.scrollBy({ top: k.top - kap.getBoundingClientRect().top - 120, behavior: "smooth" }); }
      else { window.scrollBy({ top: k.top - 160, behavior: "smooth" }); }
    }
  }
  const u = new SpeechSynthesisUtterance(c.metin);
  u.lang = "tr-TR";
  const v = typeof sesliSes === "function" ? sesliSes() : null;
  if (v) { u.voice = v; }
  u.rate = sesAyar().hiz;
  const n = SES.nesil;
  u.onend = function () { if (n !== SES.nesil || !SES.aktif) { return; } SES.i++; sesSoyle(); };
  u.onerror = function (e) {
    if (n !== SES.nesil || !SES.aktif) { return; }
    if (e && /interrupted|canceled/.test(e.error || "")) { return; }
    SES.i++; sesSoyle();
  };
  window.speechSynthesis.speak(u);
  sesCubukCiz();
}

/** Metin bitti: roman bölümünde sonraki bölüm, listede sonraki metin; uyku "bölüm sonunda" ise dur. */
function sesSonraki() {
  const el = SES.el;
  if (SES.bolumSonu) { dinlemeDurdur(); if (typeof eckaBildir === "function") { eckaBildir("Bölüm bitti: dinleme durdu"); } return; }
  let sonraki = null;
  const perde = el && el.closest("#perde");
  const roman = perde && perde.querySelector('.tepki-alan[data-hedef^="roman:"]');
  const evr = el && el.closest(".evr-oku");
  const bekleVeDevam = function (sec) {
    setTimeout(function () {
      const y = document.querySelector(sec);
      if (y && SES.aktif) { const d = SES.dugme; sesBaslatDevam(y, d); } else { dinlemeDurdur(); }
    }, 500);
  };
  if (roman && typeof romanAc === "function" && veri.roman) {
    const no = Number(roman.getAttribute("data-okuma-hedef").slice(6));
    const b = (veri.roman.bolumler || []).find(function (x) { return x.no === no + 1; });
    if (b && b.metin && typeof romanAcikMi === "function" && romanAcikMi(b)) { romanAc(no + 1); bekleVeDevam("#perde .okuma"); return; }
  } else if (evr) {
    const btn = Array.prototype.find.call(evr.querySelectorAll("button"), function (x) { return /Sonraki bölüm/.test(x.textContent); });
    if (btn) { btn.click(); bekleVeDevam(".evr-oku .okuma-metin"); return; }
  } else if (typeof okumaAlanlari === "function") {
    /* yalnızca aynı pencere, evren sayfası ya da bölüm içinde (arkadaki sayfaya geçmez) */
    const kap = el.closest("#perde, #evrenSayfa, main section.bolum") || document.body;
    const l = okumaAlanlari().filter(function (x) { return kap.contains(x) && (typeof gorunurMu !== "function" || gorunurMu(x)); });
    const i = l.indexOf(el);
    sonraki = i !== -1 ? l[i + 1] : null;
  }
  if (sonraki) { sesBaslatDevam(sonraki, null); return; }
  dinlemeDurdur();
  if (typeof eckaBildir === "function") { eckaBildir("Dinleme bitti"); }
}

/** Sonraki metne geçerken uyku zamanlayıcısı ve hız sürer. */
function sesBaslatDevam(el, dugme) {
  const uyku = SES.uyku;
  if (SES.dugme && SES.dugme !== dugme) { SES.dugme.textContent = "▶ Dinle"; SES.dugme.classList.remove("okuyor"); }
  SES.nesil++;
  const onc = el.previousElementSibling;
  const d = dugme || (onc && onc.classList.contains("sesli-dugme") ? onc : null);
  SES.uyku = uyku;
  const l = cumleler(el);
  if (!l.length) { dinlemeDurdur(); return; }
  SES.el = el; SES.dugme = d; SES.cumleler = l; SES.i = 0; SES.baslik = sesBasligi(el);
  if (d) { d.textContent = "■ Durdur"; d.classList.add("okuyor"); }
  sesSoyle();
}

function dinlemeDurdur(sessiz) {
  const vardi = SES.aktif;
  SES.aktif = false; SES.duraklat = false; SES.nesil++; SES.uyku = null;
  try { if (window.speechSynthesis) { window.speechSynthesis.cancel(); } } catch (_) { /* yok */ }
  if (SES.dugme) { SES.dugme.textContent = "▶ Dinle"; SES.dugme.classList.remove("okuyor"); }
  SES.dugme = null; SES.el = null;
  sesIsaret(null);
  const c = document.querySelector("#sesCubuk");
  if (c) { c.remove(); }
  if (vardi && !sessiz && typeof ekranAcikTut === "function" && !(typeof ODAK !== "undefined" && ODAK.acik)) { ekranAcikTut(false); }
}

function sesDuraklat() {
  if (!SES.aktif) { return; }
  if (SES.duraklat) { SES.duraklat = false; sesSoyle(); }
  else { SES.duraklat = true; SES.nesil++; try { window.speechSynthesis.cancel(); } catch (_) { /* yok */ } sesCubukCiz(); }
}

function sesCubukCiz() {
  let c = document.querySelector("#sesCubuk");
  if (!SES.aktif) { if (c) { c.remove(); } return; }
  /* çubuk bir kez çizilir; her cümlede yalnızca yazıları değişir (düğmeler yerinde kalır, dokunuş ve odak kaybolmaz) */
  if (!c) {
    c = document.createElement("div");
    c.id = "sesCubuk";
    c.className = "ses-cubuk";
    c.setAttribute("role", "region");
    c.setAttribute("aria-label", "Dinleme");
    c.innerHTML = '<span class="ses-baslik" aria-live="polite"></span>' +
      '<span class="ses-dugmeler">' +
        '<button type="button" data-dinle="duraklat"></button>' +
        '<button type="button" data-dinle="atla" aria-label="Sonraki cümle">⏭</button>' +
        '<button type="button" data-dinle="hiz"></button>' +
        '<button type="button" data-dinle="uyku"></button>' +
        '<button type="button" data-dinle="durdur" aria-label="Dinlemeyi durdur">■</button>' +
      "</span>";
    document.body.appendChild(c);
  }
  const a = sesAyar();
  const kalan = SES.uyku ? Math.max(0, Math.ceil((SES.uyku - Date.now()) / 60000)) : 0;
  const uykuAd = a.uyku === "bolum" ? "bölüm sonu" : (SES.uyku ? kalan + " dk" : "kapalı");
  const yaz = function (sec, metin, etiket) {
    const el = c.querySelector(sec);
    if (!el) { return; }
    if (el.textContent !== metin) { el.textContent = metin; }
    if (etiket && el.getAttribute("aria-label") !== etiket) { el.setAttribute("aria-label", etiket); }
  };
  yaz(".ses-baslik", (SES.duraklat ? "Duraklatıldı · " : "Dinleniyor · ") + SES.baslik + "  " + Math.min(SES.i + 1, SES.cumleler.length) + "/" + SES.cumleler.length);
  yaz('[data-dinle="duraklat"]', SES.duraklat ? "▶" : "❚❚", SES.duraklat ? "Sürdür" : "Duraklat");
  yaz('[data-dinle="hiz"]', String(a.hiz).replace(".", ",") + "×", "Hız: " + a.hiz + " kat");
  yaz('[data-dinle="uyku"]', "☾ " + uykuAd, "Uyku zamanlayıcısı: " + uykuAd);
}

/* "▶ Dinle" düğmesi artık kesintisiz dinlemeyi başlatır (32-bakim.js'teki düğmeler aynı) */
window.sesliDugmeOku = function (dugme) {
  if (SES.aktif && SES.dugme === dugme) { dinlemeDurdur(); return; }
  const el = dugme.nextElementSibling;
  if (!el) { return; }
  sesBaslat(el, dugme);
};
window.sesliDurdur = function () { dinlemeDurdur(); };

/* ==================== Harita Atlası ==================== */

function atlasHaritalari() {
  return ((typeof veri !== "undefined" && veri && veri.haritalar) || []).filter(function (h) {
    if (!Array.isArray(h.yerler) || h.yerler.filter(haviAdayMi).length < 4) { return false; }
    return !(h.id === "tomye" && typeof bolumErisimi === "function" && !bolumErisimi("harita"));
  });
}
function atlasAnahtar(h, y) { return "atlas:" + h + ":" + y; }
function atlastaMi(h, y) { return typeof cuzdan !== "undefined" && cuzdan.acilan.indexOf(atlasAnahtar(h, y)) !== -1; }

function atlasEkle(h, y) {
  if (typeof cuzdan === "undefined" || atlastaMi(h, y)) { return false; }
  cuzdan.acilan.push(atlasAnahtar(h, y));
  if (typeof cuzdanKaydet === "function") { cuzdanKaydet(); }
  const g = tf28Oku(TF28.atlasGun, {}) || {};
  const bugun = yerelGun();
  g[bugun] = (g[bugun] || 0) + 1;
  tf28Yaz(TF28.atlasGun, gunleriBuda(g));
  const hr = atlasHaritalari().find(function (x) { return x.id === h; });
  if (hr) {
    const d = atlasDurum(hr);
    if (d.bulunan === d.toplam && typeof eckaBildir === "function") { eckaBildir("🗺 Atlas tamam: " + hr.ad + " Haritacısı"); }
  }
  return true;
}

function atlasDurum(h) {
  const l = h.yerler.filter(haviAdayMi);
  const b = l.filter(function (y) { return atlastaMi(h.id, y.id); });
  return { toplam: l.length, bulunan: b.length, yerler: b };
}

/* Harita Avı kazanılınca yer atlasa */
if (typeof haviKaydet === "function") {
  const eskiHK28 = haviKaydet;
  window.haviKaydet = function (d) {
    const r = eskiHK28.apply(this, arguments);
    if (d && d.kazandi) { atlasEkle(d.harita, d.yer); }
    return r;
  };
}

const SERBEST = { d: null };   /* XP'siz tur: { h, y, tahmin: [], bitti, kazandi } */

function serbestBaslat(hid) {
  const h = atlasHaritalari().find(function (x) { return x.id === hid; });
  if (!h) { return; }
  const kalan = h.yerler.filter(function (y) { return haviAdayMi(y) && !atlastaMi(h.id, y.id); });
  const havuz = kalan.length ? kalan : h.yerler.filter(haviAdayMi);
  const y = havuz[Math.floor(Math.random() * havuz.length)];
  SERBEST.d = { h: h, y: y, harita: h.id, yer: y.id, tahmin: [], bitti: false, kazandi: false };
  atlasCiz();
  const k = document.querySelector("#atlasAlan");
  if (k) { k.scrollIntoView({ block: "start", behavior: "smooth" }); }
}

function serbestTahmin(hx, hy) {
  const d = SERBEST.d;
  if (!d || d.bitti) { return; }
  const uz = Math.hypot(hx - d.y.x, hy - d.y.y);
  d.tahmin.push([Math.round(hx * 10) / 10, Math.round(hy * 10) / 10, Math.round(uz * 10) / 10]);
  if (uz <= 6) { d.bitti = true; d.kazandi = true; atlasEkle(d.h.id, d.y.id); }
  else if (d.tahmin.length >= HAVI_HAK) { d.bitti = true; }
  atlasCiz();
}

function atlasMiniSvg(h) {
  const kara = h.yerler.filter(function (y) { return Array.isArray(y.sekil) && y.sekil.length > 2; }).map(function (y) {
    return '<polygon class="havi-kara" points="' + y.sekil.map(function (p) { return p[0] + "," + p[1]; }).join(" ") + '"/>';
  }).join("");
  const bulunan = atlasDurum(h).yerler.map(function (y) {
    return '<circle class="atlas-yer" cx="' + y.x + '" cy="' + y.y + '" r="1.8"/><text class="havi-ad" x="' + y.x + '" y="' + (y.y - 2.8) + '">' + kacir(y.ad) + "</text>";
  }).join("");
  return '<svg class="havi-svg atlas-svg" viewBox="0 0 100 100" role="img" aria-label="' + kacir(h.ad) + ' atlası: bulunan yerler">' +
    '<rect class="havi-deniz" x="0" y="0" width="100" height="100"/>' + kara + bulunan + "</svg>";
}

function atlasCiz() {
  const alan = document.querySelector("#gunlukOyunAlan");
  if (!alan) { return; }
  let k = document.querySelector("#atlasAlan");
  const l = atlasHaritalari();
  if (!l.length) { if (k) { k.remove(); } return; }
  if (!k || !alan.contains(k)) {
    k = document.createElement("div");
    k.id = "atlasAlan";
    k.className = "yaris-kart evo-kart atlas-kart";
    const havi = document.querySelector("#haviAlan");
    if (havi && havi.parentNode === alan) { havi.insertAdjacentElement("afterend", k); } else { alan.appendChild(k); }
  }
  const gunun = typeof haviDurum === "function" ? haviDurum() : null;
  const serbestAcik = !gunun || gunun.bitti;
  const d = SERBEST.d;
  let tur = "";
  if (d) {
    const son = d.tahmin[d.tahmin.length - 1];
    const durum = d.kazandi ? "✓ " + kacir(d.y.ad) + " atlasına işlendi." : (d.bitti ? "Haklar bitti: " + kacir(d.y.ad) + "." :
      (son ? "<b>" + haviSicaklik(son[2])[0] + ".</b> " + (d.tahmin.length >= 2 ? kacir(haviYon(son, d.y)) + " " : "") + (HAVI_HAK - d.tahmin.length) + " hakkın kaldı." : "Haritada bu yeri bul (XP'siz)."));
    tur = '<div class="atlas-tur"><p class="havi-ipucu"><span class="oyun-etiket">Serbest tur · ' + kacir(d.y.tur || "Yer") + "</span> " +
        kacir(typeof goGizle === "function" ? goGizle(String(d.y.not || ""), d.y.ad) : d.y.not) + "</p>" +
      haviSvg(d).replace(' data-havi-harita=""', d.bitti ? "" : ' data-atlas-harita=""') +
      '<p class="oyun-not" role="status" aria-live="polite">' + durum + "</p>" +
      (d.bitti ? '<button type="button" class="dugme dugme-sade y-kucuk" data-atlas-serbest="' + kacir(d.h.id) + '">Bir tur daha</button> <button type="button" class="ic-bag" data-atlas-kapat>Kapat</button>' : "") +
      "</div>";
  }
  k.innerHTML = "<h4>Harita Atlası</h4>" +
    '<p class="oyun-not">Harita Avı\'nda bulduğun yerler buraya işlenir. Bir haritanın bütün yerlerini bulunca unvanını alırsın.</p>' +
    '<div class="atlas-liste">' + l.map(function (h) {
      const s = atlasDurum(h);
      return '<div class="atlas-satir"><div class="atlas-ust"><b>' + kacir(h.ad) + "</b> <span class=\"oyun-not\">" + s.bulunan + " / " + s.toplam +
          (s.bulunan === s.toplam ? " · 🗺 " + kacir(h.ad) + " Haritacısı" : "") + "</span></div>" +
        '<span class="lider-cubuk" aria-hidden="true"><i style="width:' + Math.round(100 * s.bulunan / s.toplam) + '%"></i></span>' +
        (s.bulunan ? '<details><summary>Atlası gör</summary>' + atlasMiniSvg(h) + "</details>" : "") +
        (serbestAcik && (!d || d.bitti) ? '<button type="button" class="dugme dugme-sade y-kucuk" data-atlas-serbest="' + kacir(h.id) + '">Serbest tur (XP\'siz)</button>' : "") +
        "</div>";
    }).join("") + "</div>" +
    (serbestAcik ? "" : '<p class="oyun-not">Serbest turlar günün Harita Avı bitince açılır.</p>') + tur;
}

if (typeof haviCiz === "function") {
  const eskiHC28 = haviCiz;
  window.haviCiz = function () {
    const r = eskiHC28.apply(this, arguments);
    try { atlasCiz(); } catch (e) { console.error("[TentiforApp] atlas:", e); }
    return r;
  };
}

/* ==================== haftalık Tömye bulmacası ==================== */

const BUL_HARF = /^[A-ZÇĞİÖŞÜÂÎÛ]+$/;

function haftaKimligi(d) {
  d = d ? new Date(d) : new Date();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const gun = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - gun);
  const yilBasi = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + "-H" + String(Math.ceil(((t - yilBasi) / 86400000 + 1) / 7)).padStart(2, "0");
}

function bulBuyuk(s) { return String(s || "").toLocaleUpperCase("tr").replace(/Â/g, "A").replace(/Î/g, "İ").replace(/Û/g, "U"); }

function bulIpucu(metin, ad) {
  let t = String(metin || "").replace(/\s+/g, " ").trim();
  if (typeof goGizle === "function") { t = goGizle(t, ad); }
  const n = t.search(/[.!?](\s|$)/);
  if (n > 30 && n < 150) { t = t.slice(0, n + 1); }
  return t.length > 150 ? t.slice(0, 147) + "…" : t;
}

/** Kelime havuzu: okurun açabildiği içerikten, tek kelimelik adlar ve terimler. */
function bulHavuz() {
  const l = [];
  const ekle = function (ad, ipucu) {
    const k = bulBuyuk(ad);
    if (!BUL_HARF.test(k) || k.length < 3 || k.length > 10 || !ipucu || l.some(function (x) { return x.k === k; })) { return; }
    l.push({ k: k, ipucu: ipucu });
  };
  const erisir = function (b) { return typeof bolumErisimi !== "function" || bolumErisimi(b); };
  (erisir("arsiv") && typeof goKarakterler === "function" ? goKarakterler() : []).forEach(function (k) {
    ekle(k.ad, [k.unvan, bulIpucu(k.ozet, k.ad)].filter(Boolean).join(" — "));
  });
  if (erisir("sozluk")) {
    (veri.sozluk || []).forEach(function (s) { ekle(s.terim, bulIpucu(s.tanim, s.terim)); });
  }
  (erisir("evren") && typeof goMaddeler === "function" ? goMaddeler() : []).forEach(function (m) { ekle(m.baslik, bulIpucu(m.ozet, m.baslik)); });
  ((veri.claudeEvreni || {}).sozluk || []).forEach(function (s) { ekle(s.terim, "Claude'un Evreni: " + bulIpucu(s.tanim, s.terim)); });
  return l;
}

/** Çapraz bulmaca: kelimeler kesişerek yerleşir; bitişik harf kuralı korunur. */
function bulmacaUret(hafta) {
  const r = typeof goRastgele === "function" ? goRastgele("bulmaca|" + hafta) : Math.random;
  const havuz = bulHavuz();
  for (let i = havuz.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = havuz[i]; havuz[i] = havuz[j]; havuz[j] = t; }
  if (havuz.length < 4) { return null; }
  const izgara = {};
  const al = function (x, y) { return izgara[x + "," + y]; };
  const yerlesen = [];
  const sigar = function (k, x, y, yatay) {
    const dx = yatay ? 1 : 0, dy = yatay ? 0 : 1;
    if (al(x - dx, y - dy) || al(x + dx * k.length, y + dy * k.length)) { return -1; }
    let kesisme = 0;
    for (let i = 0; i < k.length; i++) {
      const cx = x + dx * i, cy = y + dy * i, v = al(cx, cy);
      if (v) { if (v !== k[i]) { return -1; } kesisme++; continue; }
      if (al(cx + dy, cy + dx) || al(cx - dy, cy - dx)) { return -1; }
    }
    return kesisme;
  };
  const koy = function (w, x, y, yatay) {
    for (let i = 0; i < w.k.length; i++) { izgara[(x + (yatay ? i : 0)) + "," + (y + (yatay ? 0 : i))] = w.k[i]; }
    yerlesen.push({ k: w.k, ipucu: w.ipucu, x: x, y: y, yatay: yatay });
  };
  koy(havuz[0], 0, 0, true);
  for (let n = 1; n < havuz.length && yerlesen.length < 8; n++) {
    const w = havuz[n];
    let en = null;
    yerlesen.forEach(function (p) {
      for (let i = 0; i < p.k.length; i++) {
        for (let j = 0; j < w.k.length; j++) {
          if (p.k[i] !== w.k[j]) { continue; }
          const yatay = !p.yatay;
          const x = p.yatay ? p.x + i : p.x - j;
          const y = p.yatay ? p.y - j : p.y + i;
          const s = sigar(w.k, x, y, yatay);
          if (s > 0 && (!en || s > en.s)) { en = { x: x, y: y, yatay: yatay, s: s }; }
        }
      }
    });
    if (en) { koy(w, en.x, en.y, en.yatay); }
  }
  if (yerlesen.length < 4) { return null; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  Object.keys(izgara).forEach(function (k) { const p = k.split(",").map(Number); minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
  const kelimeler = yerlesen.map(function (w) { return { k: w.k, ipucu: w.ipucu, x: w.x - minX, y: w.y - minY, yatay: w.yatay }; });
  kelimeler.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
  const numara = {};
  let no = 0;
  kelimeler.forEach(function (w) { const k = w.x + "," + w.y; if (!numara[k]) { numara[k] = ++no; } w.no = numara[k]; });
  const hucre = {};
  kelimeler.forEach(function (w) { for (let i = 0; i < w.k.length; i++) { hucre[(w.x + (w.yatay ? i : 0)) + "," + (w.y + (w.yatay ? 0 : i))] = w.k[i]; } });
  return { hafta: hafta, en: maxX - minX + 1, boy: maxY - minY + 1, kelimeler: kelimeler, hucre: hucre, numara: numara };
}

const BUL = { b: null, yon: true };

function bulmacaDurum() {
  const hafta = haftaKimligi();
  if (typeof veri === "undefined" || !veri) { return { b: null, d: { hafta: hafta, harf: {}, cozuldu: false, ipucu: 0 } }; }   /* sayfa açılırken veri gelmeden */
  if (!BUL.b || BUL.b.hafta !== hafta) { BUL.b = bulmacaUret(hafta); }
  let d = tf28Oku(TF28.bulmaca, null);
  if (!d || d.hafta !== hafta) { d = { hafta: hafta, harf: {}, cozuldu: false, ipucu: 0 }; }
  return { b: BUL.b, d: d };
}

function haftaBulmacaCiz() {
  const alan = document.querySelector("#gunlukOyunAlan");
  if (!alan) { return; }
  let k = document.querySelector("#haftaBulmaca");
  const s = bulmacaDurum();
  if (!s.b) { if (k) { k.remove(); } return; }
  if (!k || !alan.contains(k)) {
    k = document.createElement("div");
    k.id = "haftaBulmaca";
    k.className = "yaris-kart evo-kart bul-kart";
    alan.appendChild(k);
  }
  const b = s.b, d = s.d;
  let izgara = "";
  for (let y = 0; y < b.boy; y++) {
    for (let x = 0; x < b.en; x++) {
      const a = x + "," + y;
      if (!b.hucre[a]) { izgara += '<span class="bul-bos" aria-hidden="true"></span>'; continue; }
      const kelime = b.kelimeler.filter(function (w) { return w.yatay ? (w.y === y && x >= w.x && x < w.x + w.k.length) : (w.x === x && y >= w.y && y < w.y + w.k.length); });
      const etiket = kelime.map(function (w) { return w.no + " " + (w.yatay ? "soldan sağa" : "yukarıdan aşağı") + ", " + (w.yatay ? x - w.x + 1 : y - w.y + 1) + ". harf / " + w.k.length; }).join("; ");
      izgara += '<span class="bul-hucre">' + (b.numara[a] ? '<i class="bul-no" aria-hidden="true">' + b.numara[a] + "</i>" : "") +
        '<input type="text" maxlength="1" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" data-bul="' + a + '" aria-label="' + kacir(etiket) + '" value="' + kacir(d.harf[a] || "") + '"' + (d.cozuldu ? " readonly" : "") + "></span>";
    }
  }
  const ipucular = function (yatay) {
    return b.kelimeler.filter(function (w) { return w.yatay === yatay; }).map(function (w) {
      return '<li><button type="button" class="ic-bag bul-ipucu" data-bul-git="' + w.x + "," + w.y + "," + (yatay ? 1 : 0) + '"><b>' + w.no + ".</b> " + kacir(w.ipucu) + " <span class=\"oyun-not\">(" + w.k.length + ")</span></button></li>";
    }).join("");
  };
  k.innerHTML = "<h4>Haftanın Tömye bulmacası" + (d.cozuldu ? " · ✓ çözüldü" : "") + '</h4><p class="oyun-not">Her pazartesi yenilenir; herkese aynı bulmaca. Kutucuğa yaz, sıradakine kendiliğinden geçer.</p>' +
    '<div class="bul-izgara" style="grid-template-columns:repeat(' + b.en + ',minmax(0,1fr));max-width:' + Math.min(440, b.en * 40) + 'px" role="group" aria-label="Bulmaca ızgarası">' + izgara + "</div>" +
    '<div class="bul-ipuclari"><div><div class="oyun-etiket">Soldan sağa</div><ol>' + ipucular(true) + '</ol></div><div><div class="oyun-etiket">Yukarıdan aşağı</div><ol>' + ipucular(false) + "</ol></div></div>" +
    (d.cozuldu ? "" : '<div class="oyun-sira"><button type="button" class="dugme" data-bul-kontrol>Kontrol et</button>' +
      '<button type="button" class="dugme dugme-sade" data-bul-harf-ac' + (d.ipucu >= 3 ? " disabled" : "") + ">Bir harf aç (" + (3 - d.ipucu) + ")</button></div>") +
    '<p class="oyun-not" id="bulDurum" role="status" aria-live="polite"></p>';
}

function bulKaydet(d) { tf28Yaz(TF28.bulmaca, d); }

function bulSonrakiHucre(a, ileri) {
  const s = bulmacaDurum();
  const p = a.split(",").map(Number);
  const dx = BUL.yon ? 1 : 0, dy = BUL.yon ? 0 : 1;
  const n = (p[0] + dx * (ileri ? 1 : -1)) + "," + (p[1] + dy * (ileri ? 1 : -1));
  return s.b.hucre[n] ? document.querySelector('[data-bul="' + n + '"]') : null;
}

function bulKontrol() {
  const s = bulmacaDurum();
  let yanlis = 0, bos = 0;
  Object.keys(s.b.hucre).forEach(function (a) {
    const el = document.querySelector('[data-bul="' + a + '"]');
    const v = bulBuyuk(s.d.harf[a] || "");
    if (!v) { bos++; if (el) { el.classList.remove("yanlis"); } return; }
    const ok = v === s.b.hucre[a];
    if (!ok) { yanlis++; }
    if (el) { el.classList.toggle("yanlis", !ok); el.setAttribute("aria-invalid", String(!ok)); }
  });
  const durum = document.querySelector("#bulDurum");
  if (!yanlis && !bos) {
    s.d.cozuldu = true;
    bulKaydet(s.d);
    if (typeof oyunXpVer === "function") { oyunXpVer("bulmaca|" + s.d.hafta); }
    haftaBulmacaCiz();
    const d2 = document.querySelector("#bulDurum");
    if (d2) { d2.textContent = "Bulmaca çözüldü. Gelecek pazartesi yenisi gelir."; }
    if (typeof oyunBugunCiz === "function") { oyunBugunCiz(); }
    return;
  }
  if (durum) { durum.textContent = (yanlis ? yanlis + " harf yanlış (kırmızı). " : "") + (bos ? bos + " kutu boş." : ""); }
}

function bulHarfAc() {
  const s = bulmacaDurum();
  if (s.d.cozuldu || s.d.ipucu >= 3) { return; }
  const l = Object.keys(s.b.hucre).filter(function (a) { return bulBuyuk(s.d.harf[a] || "") !== s.b.hucre[a]; });
  if (!l.length) { return; }
  const a = l[Math.floor(Math.random() * l.length)];
  s.d.harf[a] = s.b.hucre[a];
  s.d.ipucu++;
  bulKaydet(s.d);
  const el = document.querySelector('[data-bul="' + a + '"]');
  if (el) { el.value = s.b.hucre[a]; el.classList.remove("yanlis"); }
  const b = document.querySelector("[data-bul-harf-ac]");
  if (b) { b.textContent = "Bir harf aç (" + (3 - s.d.ipucu) + ")"; b.disabled = s.d.ipucu >= 3; }
}

/* yazarken yalnızca kutunun değeri değişir: ızgara yeniden çizilmez, telefonun klavyesi açık kalır */
document.addEventListener("input", function (e) {
  const el = e.target;
  if (!el || !el.hasAttribute || !el.hasAttribute("data-bul")) { return; }
  const s = bulmacaDurum();
  const v = bulBuyuk(el.value).replace(/[^A-ZÇĞİÖŞÜ]/g, "").slice(-1);
  el.value = v;
  el.classList.remove("yanlis");
  s.d.harf[el.getAttribute("data-bul")] = v;
  bulKaydet(s.d);
  if (v) { const n = bulSonrakiHucre(el.getAttribute("data-bul"), true); if (n) { n.focus(); n.select(); } }
});
document.addEventListener("keydown", function (e) {
  const el = e.target;
  if (!el || !el.hasAttribute || !el.hasAttribute("data-bul")) { return; }
  const a = el.getAttribute("data-bul");
  if (e.key === "Backspace" && !el.value) { const n = bulSonrakiHucre(a, false); if (n) { e.preventDefault(); n.focus(); n.value = ""; n.dispatchEvent(new Event("input", { bubbles: true })); n.focus(); } return; }
  const yonler = { ArrowRight: [1, 0, true], ArrowLeft: [-1, 0, true], ArrowDown: [0, 1, false], ArrowUp: [0, -1, false] };
  const y = yonler[e.key];
  if (y) {
    const p = a.split(",").map(Number);
    const n = document.querySelector('[data-bul="' + (p[0] + y[0]) + "," + (p[1] + y[1]) + '"]');
    if (n) { e.preventDefault(); BUL.yon = y[2]; n.focus(); n.select(); }
  }
});
document.addEventListener("focusin", function (e) {
  const el = e.target;
  if (!el || !el.hasAttribute || !el.hasAttribute("data-bul")) { return; }
  /* yalnızca bir yöne giden hücrede yön kendiliğinden o olur */
  const s = bulmacaDurum();
  const p = el.getAttribute("data-bul").split(",").map(Number);
  const yatayVar = s.b.hucre[(p[0] - 1) + "," + p[1]] || s.b.hucre[(p[0] + 1) + "," + p[1]];
  const dikeyVar = s.b.hucre[p[0] + "," + (p[1] - 1)] || s.b.hucre[p[0] + "," + (p[1] + 1)];
  if (yatayVar && !dikeyVar) { BUL.yon = true; } else if (dikeyVar && !yatayVar) { BUL.yon = false; }
});

/* Bugün kartında haftanın bulmacası ve okuma hedefi */
if (typeof bugunOyunlari === "function") {
  const eskiBO28 = bugunOyunlari;
  window.bugunOyunlari = function () {
    const l = eskiBO28.apply(this, arguments);
    const s = bulmacaDurum();
    if (s.b) { l.push({ id: "bulmaca|" + s.d.hafta, ad: "Haftanın bulmacası", git: "bulmaca", bitti: !!s.d.cozuldu }); }
    return l;
  };
}
if (typeof bugunGit === "function") {
  const eskiBG28 = bugunGit;
  window.bugunGit = function (hedef) {
    if (hedef !== "bulmaca" && hedef !== "atlas") { return eskiBG28.apply(this, arguments); }
    if (typeof rota === "function" && rota().indexOf("#/oyunlar") !== 0) { location.hash = "#/oyunlar"; }
    setTimeout(function () {
      if (typeof oyunSekmesiAc === "function") { oyunSekmesiAc("gunluk"); }
      const el = document.querySelector(hedef === "bulmaca" ? "#haftaBulmaca" : "#atlasAlan") || document.querySelector("#panel-gunluk");
      if (el) { el.scrollIntoView({ block: "start", behavior: "smooth" }); }
    }, 250);
  };
}

/* ==================== okuma hedefi ve haftalık özet ==================== */

const OKH = { alanlar: [], tazelendi: 0, hedefBildi: "" };

function gunleriBuda(g) {
  const sinir = yerelGun(new Date(Date.now() - 70 * 86400000));
  Object.keys(g).forEach(function (k) { if (k < sinir) { delete g[k]; } });
  return g;
}

/** Şu an ekranda okunan bir metin var mı (en az üçte biri görünür). */
function okunuyorMu() {
  if (Date.now() - OKH.tazelendi > 3000) {
    OKH.alanlar = typeof okumaAlanlari === "function" ? okumaAlanlari() : [];
    OKH.tazelendi = Date.now();
  }
  const ekran = window.innerHeight || 800;
  return OKH.alanlar.some(function (el) {
    if (!el.isConnected) { return false; }
    const k = el.getBoundingClientRect();
    const gorunen = Math.min(k.bottom, ekran) - Math.max(k.top, 0);
    return gorunen > Math.min(k.height, ekran) / 3 && gorunen > 60;
  });
}

setInterval(function () {
  if (document.visibilityState !== "visible") { return; }
  const etkin = typeof OKU !== "undefined" ? Date.now() - OKU.sonEtkinlik < 45000 : true;
  if (!(etkin || SES.aktif) || !okunuyorMu()) { return; }
  const g = tf28Oku(TF28.okuma, {}) || {};
  const bugun = yerelGun();
  g[bugun] = (g[bugun] || 0) + 1;
  tf28Yaz(TF28.okuma, gunleriBuda(g));
  const hedef = Number(tf28Oku(TF28.hedef, 0)) || 0;
  if (hedef && g[bugun] === hedef * 60 && OKH.hedefBildi !== bugun) {
    OKH.hedefBildi = bugun;
    if (typeof eckaBildir === "function") { eckaBildir("📖 Bugünkü okuma hedefin tamam: " + hedef + " dk ✓"); }
    hatirlatmalariKur();
  }
}, 1000);

function okumaDakika(gun) { return Math.floor(((tf28Oku(TF28.okuma, {}) || {})[gun || yerelGun()] || 0) / 60); }

/** Bu haftanın günleri (pazartesiden). */
function haftaGunleri() {
  const bugun = new Date();
  const pzt = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate() - ((bugun.getDay() + 6) % 7));
  const l = [];
  for (let i = 0; i < 7; i++) { l.push(yerelGun(new Date(pzt.getFullYear(), pzt.getMonth(), pzt.getDate() + i))); }
  return l;
}

function haftaOzeti() {
  const gunler = haftaGunleri();
  const ok = tf28Oku(TF28.okuma, {}) || {}, kt = tf28Oku(TF28.kutu, {}) || {}, at = tf28Oku(TF28.atlasGun, {}) || {};
  const dk = gunler.map(function (g) { return Math.floor((ok[g] || 0) / 60); });
  const toplam = function (o) { return gunler.reduce(function (t, g) { return t + (o[g] || 0); }, 0); };
  const s = typeof seriDurumu === "function" ? seriDurumu() : { seri: 0 };
  const b = bulmacaDurum();
  return { gunler: gunler, dk: dk, dakika: dk.reduce(function (t, x) { return t + x; }, 0), kutu: toplam(kt), yer: toplam(at), seri: s.seri, bulmaca: !!(b.d && b.d.cozuldu),
    hedef: Number(tf28Oku(TF28.hedef, 0)) || 0 };
}

const GUN_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function haftaKartiHtml() {
  const o = haftaOzeti();
  const bugun = yerelGun();
  const tepe = Math.max(o.hedef || 0, Math.max.apply(null, o.dk), 1);
  const pazar = new Date().getDay() === 0;
  return '<div class="kutu-y hafta-kart" id="haftaKart">' +
    '<div class="oyun-etiket">Okuma hedefi</div>' +
    '<div class="oka-secim hedef-secim" role="group" aria-label="Günlük okuma hedefi">' + [0, 5, 10, 20, 30].map(function (m) {
      return '<button type="button" class="' + (o.hedef === m ? "secili" : "") + '" data-okuma-hedef="' + m + '" aria-pressed="' + (o.hedef === m) + '">' + (m ? m + " dk" : "Kapalı") + "</button>";
    }).join("") + "</div>" +
    (o.hedef ? '<p class="oyun-not">Bugün ' + okumaDakika() + " / " + o.hedef + " dk" + (okumaDakika() >= o.hedef ? " ✓" : "") + "</p>" : "") +
    '<div class="oyun-etiket">Bu hafta' + (pazar ? " · özetin hazır" : "") + "</div>" +
    '<div class="hafta-cubuklar" role="img" aria-label="Bu hafta günlere göre okuma dakikası: ' + o.gunler.map(function (g, i) { return GUN_KISA[i] + " " + o.dk[i]; }).join(", ") + '">' +
      o.gunler.map(function (g, i) {
        return '<div class="hafta-gun' + (g === bugun ? " bugun" : "") + (o.hedef && o.dk[i] >= o.hedef ? " tamam" : "") + '"><span class="hafta-sutun"><i style="height:' + Math.round(100 * o.dk[i] / tepe) + '%"></i></span>' +
          "<b>" + o.dk[i] + "</b><span>" + GUN_KISA[i] + "</span></div>";
      }).join("") + "</div>" +
    '<p class="oyun-not">' + o.dakika + " dk okuma · " + o.kutu + " kutu bitti · " + o.yer + " yeni yer · seri " + o.seri + " gün" + (o.bulmaca ? " · bulmaca ✓" : "") + "</p>" +
    '<div class="oyun-sira"><button type="button" class="dugme dugme-sade y-kucuk" data-hafta-kart>🖼 Haftanın kartı</button></div>' +
    '<p class="oyun-not">Okuma süresi yalnızca bu cihazda sayılır.</p></div>';
}

function haftaKartiCiz() {
  const d = document.querySelector("#defter");
  if (!d) { return; }
  let k = document.querySelector("#haftaKart");
  const h = haftaKartiHtml();
  if (k) { k.outerHTML = h; return; }
  const bas = d.querySelector(".bolum-basi");
  if (bas) { bas.insertAdjacentHTML("afterend", h); } else { d.insertAdjacentHTML("afterbegin", h); }
}

async function haftaKartiUret() {
  if (typeof kartZemin !== "function") { return null; }
  if (typeof kartFontlariHazir === "function") { await kartFontlariHazir(); }
  const o = haftaOzeti();
  const en = 1080, boy = 1350;
  const t = document.createElement("canvas");
  t.width = en; t.height = boy;
  const c = t.getContext("2d");
  kartZemin(c, en, boy);
  c.fillStyle = KART_RENK.murekkep || "#0d2438";
  c.font = KART_FONT.baslik(84);
  c.fillText("Bu hafta", 90, 190);
  c.font = KART_FONT.mono(28, true);
  c.fillStyle = KART_RENK.deniz || "#1c5c96";
  c.fillText(o.gunler[0].split("-").reverse().join(".") + " – " + o.gunler[6].split("-").reverse().join("."), 94, 240);
  const tepe = Math.max(o.hedef || 0, Math.max.apply(null, o.dk), 1);
  o.dk.forEach(function (d, i) {
    const x = 110 + i * 125, h = Math.round(360 * d / tepe);
    c.fillStyle = KART_RENK.deniz || "#1c5c96";
    c.fillRect(x, 690 - h, 70, h);
    c.fillStyle = KART_RENK.murekkep || "#0d2438";
    c.font = KART_FONT.mono(26);
    c.fillText(GUN_KISA[i], x + 6, 730);
    c.fillText(String(d), x + 16, 680 - h);
  });
  c.font = KART_FONT.yazi(46);
  [o.dakika + " dakika okudum", o.kutu + " kutu bitirdim", o.yer + " yeni yer buldum", "Seri: " + o.seri + " gün" + (o.bulmaca ? " · bulmaca ✓" : "")].forEach(function (s, i) {
    c.fillText(s, 100, 830 + i * 64);
  });
  c.font = KART_FONT.mono(26);
  c.fillStyle = KART_RENK.deniz || "#1c5c96";
  c.fillText(KART_ADRES, 100, boy - 70);
  return t;
}

/* ==================== kısayollar ve hatırlatmalar ==================== */

function kisayolUygula(t) {
  if (t === "devam") {
    const y = typeof yolAktif === "function" ? yolAktif() : null;
    const s = y && typeof yolIlerleme === "function" ? yolIlerleme(y).sonraki : null;
    if (s && typeof yolAdimaGit === "function") { yolAdimaGit(s); return; }
    const son = typeof sonOkunan === "function" ? sonOkunan() : null;
    if (son && son.tur === "karakter" && typeof karakterAc === "function") {
      const i = (veri.karakterler || []).findIndex(function (x) { return x.id === son.id; });
      if (i !== -1) { karakterAc(i); return; }
    }
    location.hash = son && son.tur === "madde" ? "#/evren" : "#/tomye";
    return;
  }
  if (t === "bugun") {
    location.hash = "#/oyunlar";
    setTimeout(function () { const k = document.querySelector("#oyunBugun"); if (k) { k.scrollIntoView({ block: "start" }); } }, 400);
    return;
  }
  if ((t === "havi" || t === "bulmaca" || t === "atlas") && typeof bugunGit === "function") { bugunGit(t); }
}

/** Adresteki ?kisayol= ve ?yol= bir kez uygulanır, sonra adresten silinir. */
function adresParametreleri() {
  let u;
  try { u = new URL(location.href); } catch (_) { return; }
  const k = u.searchParams.get("kisayol"), y = u.searchParams.get("yol");
  if (!k && !y) { return; }
  u.searchParams.delete("kisayol"); u.searchParams.delete("yol");
  try { history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch (_) { /* yok */ }
  if (k) { setTimeout(function () { kisayolUygula(k); }, 300); }
  if (y) { setTimeout(function () { ozelYolIceAl(y); }, 300); }
}

function sessizSaatteMi(saat) {
  const s = typeof SESSIZ25 !== "undefined" && typeof jsonOku === "function" ? jsonOku(SESSIZ25, null) : null;
  if (!s || s.bas === s.bit) { return false; }
  return s.bas < s.bit ? (saat >= s.bas && saat < s.bit) : (saat >= s.bas || saat < s.bit);
}

function hatirlatmaAcik() { return tf28Oku(TF28.hatirlat, false) === true; }

/** Uygulamada yerel bildirimler: seri (bugün 20:30), okuma hedefi (bugün 21:00), okuma yolu (yarın 18:00). Sunucu yok. */
async function hatirlatmalariKur() {
  const ln = typeof kabukMu === "function" && kabukMu() && typeof kabukEklenti === "function" ? kabukEklenti("LocalNotifications") : null;
  if (!ln) { return ""; }
  try { await ln.cancel({ notifications: [{ id: 7200 }, { id: 7201 }, { id: 7202 }] }); } catch (_) { /* yok */ }
  if (!hatirlatmaAcik()) { return ""; }
  const liste = [];
  const saatte = function (gunEk, saat, dk) { const t = new Date(); t.setDate(t.getDate() + gunEk); t.setHours(saat, dk, 0, 0); return t; };
  const ekle = function (id, t, baslik, govde, kisayol) {
    if (t.getTime() <= Date.now() + 60000 || sessizSaatteMi(t.getHours())) { return; }
    liste.push({ id: id, title: baslik, body: govde, schedule: { at: t, allowWhileIdle: true }, extra: { kisayol: kisayol } });
  };
  const s = typeof seriDurumu === "function" ? seriDurumu() : null;
  if (s && s.seri > 0 && !s.bugunOynandi) { ekle(7200, saatte(0, 20, 30), "🔥 " + s.seri + " günlük serin", "Bugün bir oyun kazanırsan seri sürer.", "bugun"); }
  const hedef = Number(tf28Oku(TF28.hedef, 0)) || 0;
  const bugunDk = okumaDakika();
  if (hedef && bugunDk < hedef) { ekle(7201, saatte(0, 21, 0), "📖 Okuma hedefine " + (hedef - bugunDk) + " dk kaldı", "Kaldığın yerden devam et.", "devam"); }
  const y = typeof yolAktif === "function" ? yolAktif() : null;
  if (y && typeof yolIlerleme === "function") {
    const o = yolIlerleme(y);
    if (o.sonraki) { ekle(7202, saatte(1, 18, 0), "Okuma yolunda " + (o.toplam - o.okunan) + " kutu kaldı", y.ad, "devam"); }
  }
  if (!liste.length) { return ""; }
  try { await ln.schedule({ notifications: liste }); return ""; } catch (e) { return "Bildirim kurulamadı: " + ((e && e.message) || e); }
}

async function hatirlatmaAyarla(ac) {
  if (!ac) { tf28Yaz(TF28.hatirlat, false); await hatirlatmalariKur(); return ""; }
  const ln = typeof kabukMu === "function" && kabukMu() && typeof kabukEklenti === "function" ? kabukEklenti("LocalNotifications") : null;
  if (ln) {
    try {
      let d = await ln.checkPermissions();
      if (d.display !== "granted") { d = await ln.requestPermissions(); }
      if (d.display !== "granted") { return "Bildirim izni verilmedi (Ayarlar → Uygulamalar → TentiforApp → Bildirimler)."; }
    } catch (_) { /* sorulamadı; kurmayı dene */ }
  }
  tf28Yaz(TF28.hatirlat, true);
  return hatirlatmalariKur();
}

/** Tarayıcıda: akşam, seri tehlikedeyse günde bir kez küçük şerit. */
function seritGoster() {
  if (!hatirlatmaAcik() || (typeof kabukMu === "function" && kabukMu())) { return; }
  const bugun = yerelGun();
  if (tf28Oku(TF28.serit, "") === bugun || new Date().getHours() < 17 || sessizSaatteMi(new Date().getHours())) { return; }
  const s = typeof seriDurumu === "function" ? seriDurumu() : null;
  const hedef = Number(tf28Oku(TF28.hedef, 0)) || 0;
  let metin = "";
  if (s && s.seri > 0 && !s.bugunOynandi) { metin = "🔥 " + s.seri + " günlük serin var: bugün bir oyun kazan."; }
  else if (hedef && okumaDakika() < hedef) { metin = "📖 Bugünkü okuma hedefine " + (hedef - okumaDakika()) + " dk kaldı."; }
  if (!metin || document.querySelector("#hatirlatSerit")) { return; }
  tf28Yaz(TF28.serit, bugun);
  const d = document.createElement("div");
  d.id = "hatirlatSerit";
  d.className = "hatirlat-serit";
  d.setAttribute("role", "status");
  d.innerHTML = "<span>" + kacir(metin) + '</span><button type="button" class="dugme y-kucuk" data-kisayol="' + (metin.charAt(0) === "🔥" ? "bugun" : "devam") + '">' +
    (metin.charAt(0) === "🔥" ? "Oyna" : "Oku") + '</button><button type="button" class="pencere-kapat" data-serit-kapat aria-label="Kapat">✕</button>';
  document.body.appendChild(d);
}

/* ==================== kendi okuma yolun ==================== */

const OZY = { secilen: [], ad: "", duzenlenen: null };

function ozelYollar() { const l = tf28Oku(TF28.yollar, []); return Array.isArray(l) ? l : []; }
function ozelYollarYaz(l) { tf28Yaz(TF28.yollar, l.slice(0, 30)); }

function kutuBul(anahtar) {
  try { const d = rbAg().get(anahtar); return d && (typeof rbErisir !== "function" || rbErisir(d.kutu)) ? d.kutu : null; } catch (_) { return null; }
}

function ozelYolNesnesi(y) {
  const adimlar = (y.a || []).map(function (a) { const k = kutuBul(a); return k ? { anahtar: k.anahtar, ad: k.ad, git: k.git } : null; }).filter(Boolean);
  const sn = adimlar.reduce(function (t, a) { return t + (typeof yolKelime === "function" ? yolKelime(a.anahtar) : 0) * (typeof okuSaniyeKelime === "function" ? okuSaniyeKelime() : 0.25); }, 0);
  return { id: "oz:" + y.id, ad: y.ad, adimlar: adimlar, dakika: Math.max(1, Math.round(sn / 60)), ozel: true };
}

if (typeof okumaYolu === "function") {
  const eskiOY28 = okumaYolu;
  window.okumaYolu = function (id) {
    const m = /^oz:(.+)$/.exec(id || "");
    if (!m) { return eskiOY28.apply(this, arguments); }
    const y = ozelYollar().find(function (x) { return x.id === m[1]; });
    return y ? ozelYolNesnesi(y) : null;
  };
}

function yolKoduYap(y) {
  const j = JSON.stringify({ ad: String(y.ad || "").slice(0, 60), a: (y.a || []).slice(0, 40) });
  return btoa(unescape(encodeURIComponent(j))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function yolKoduAc(kod) {
  try {
    const j = JSON.parse(decodeURIComponent(escape(atob(String(kod).replace(/-/g, "+").replace(/_/g, "/")))));
    const a = (Array.isArray(j.a) ? j.a : []).map(String).filter(function (x) { return x.length < 120 && !!kutuBul(x); }).slice(0, 40);
    return a.length ? { ad: String(j.ad || "Paylaşılan yol").slice(0, 60), a: a } : null;
  } catch (_) { return null; }
}
function yolBaglantisi(y) { return location.origin + "/?yol=" + yolKoduYap(y); }

function ozelYolIceAl(kod) {
  const y = yolKoduAc(kod);
  if (!y) { if (typeof eckaBildir === "function") { eckaBildir("Bu okuma yolu açılamadı (kutular sende kilitli ya da bağlantı bozuk)."); } return; }
  const l = ozelYollar();
  if (!l.some(function (x) { return x.ad === y.ad && x.a.join("|") === y.a.join("|"); })) {
    l.unshift({ id: String(Date.now().toString(36)), ad: y.ad, a: y.a });
    ozelYollarYaz(l);
  }
  location.hash = "#/sen";
  setTimeout(function () {
    if (typeof ayar25Ciz === "function") { ayar25Ciz(); }
    if (typeof eckaBildir === "function") { eckaBildir("Okuma yolu eklendi: " + y.ad + " · " + y.a.length + " kutu"); }
    const k = document.querySelector("#ozelYolAlan");
    if (k) { k.scrollIntoView({ block: "center" }); }
  }, 600);
}

function ozelYolHtml() {
  const l = ozelYollar();
  return '<div class="ozel-yol" id="ozelYolAlan"><div class="oyun-etiket">Kendi yolların</div>' +
    (l.length ? '<ul class="yol-liste">' + l.map(function (y) {
      const n = ozelYolNesnesi(y);
      return '<li><span><b>' + kacir(y.ad) + '</b><span class="oyun-not"> · ' + n.adimlar.length + " kutu · ~" + n.dakika + ' dk</span></span><span class="oyun-sira">' +
        (n.adimlar.length ? '<button class="dugme dugme-sade y-kucuk" data-yol-basla="oz:' + kacir(y.id) + '">Başla</button>' : "") +
        '<button class="dugme dugme-sade y-kucuk" data-ozy-paylas="' + kacir(y.id) + '">Paylaş</button>' +
        '<button class="dugme dugme-sade y-kucuk" data-ozy-duzenle="' + kacir(y.id) + '">Düzenle</button>' +
        '<button class="dugme dugme-sade y-kucuk" data-ozy-sil="' + kacir(y.id) + '" aria-label="' + kacir(y.ad) + ' yolunu sil">✕</button></span></li>';
    }).join("") + "</ul>" : "") +
    '<button type="button" class="dugme y-kucuk" data-ozy-yeni>+ Kendi yolunu kur</button></div>';
}

if (typeof yollarHtml === "function") {
  const eskiYH28 = yollarHtml;
  window.yollarHtml = function () { return eskiYH28.apply(this, arguments) + ozelYolHtml(); };
}

function ozyPanelIc() {
  return '<div class="oka-ust"><b>' + (OZY.duzenlenen ? "Yolu düzenle" : "Kendi okuma yolun") + '</b><button type="button" class="pencere-kapat" data-ozy-kapat aria-label="Kapat">✕</button></div>' +
    '<label for="ozyAd">Yolun adı</label><input class="kod-giris arac-giris" id="ozyAd" maxlength="60" autocomplete="off" placeholder="ör. Luyot ailesi" value="' + kacir(OZY.ad) + '">' +
    '<label for="ozyAra">Kutu ara ve ekle</label><input class="kod-giris arac-giris" id="ozyAra" autocomplete="off" placeholder="karakter, mektup, madde…" aria-controls="ozySonuc">' +
    '<div id="ozySonuc" class="ozy-sonuc" role="listbox" aria-label="Arama sonuçları"></div>' +
    '<div class="oyun-etiket">Sıra</div><ol id="ozySira" class="ozy-sira"></ol>' +
    '<div class="oyun-sira"><button type="button" class="dugme" data-ozy-kaydet>Kaydet</button></div><p class="oyun-not" id="ozyDurum" role="status"></p>';
}

function ozySiraCiz() {
  const el = document.querySelector("#ozySira");
  if (!el) { return; }
  el.innerHTML = OZY.secilen.length ? OZY.secilen.map(function (a, i) {
    const k = kutuBul(a);
    return "<li><span>" + kacir(k ? k.ad : a) + '</span><span class="ozy-eylem">' +
      '<button type="button" data-ozy-yukari="' + i + '" aria-label="Yukarı taşı"' + (i ? "" : " disabled") + ">↑</button>" +
      '<button type="button" data-ozy-asagi="' + i + '" aria-label="Aşağı taşı"' + (i < OZY.secilen.length - 1 ? "" : " disabled") + ">↓</button>" +
      '<button type="button" data-ozy-cikar="' + i + '" aria-label="Çıkar">✕</button></span></li>';
  }).join("") : '<li class="oyun-not">Yukarıdan kutu ekle.</li>';
}

function ozySonucCiz(q) {
  const el = document.querySelector("#ozySonuc");
  if (!el) { return; }
  q = String(q || "").trim().toLocaleLowerCase("tr");
  if (q.length < 2) { el.innerHTML = ""; return; }
  const l = [];
  try {
    rbAg().forEach(function (d) {
      const k = d.kutu;
      if (l.length >= 8 || OZY.secilen.indexOf(k.anahtar) !== -1 || (typeof rbErisir === "function" && !rbErisir(k))) { return; }
      if ((k.ad + " " + (k.adlar || []).join(" ")).toLocaleLowerCase("tr").indexOf(q) !== -1) { l.push(k); }
    });
  } catch (_) { /* yok */ }
  el.innerHTML = l.length ? l.map(function (k) { return '<button type="button" class="ozy-oge" role="option" data-ozy-ekle="' + kacir(k.anahtar) + '">' + kacir(k.ad) + "</button>"; }).join("")
    : '<p class="oyun-not">Sonuç yok.</p>';
}

function ozyPanelAc(id) {
  ozyPanelKapat();
  const y = id ? ozelYollar().find(function (x) { return x.id === id; }) : null;
  OZY.duzenlenen = y ? y.id : null;
  OZY.ad = y ? y.ad : "";
  OZY.secilen = y ? y.a.slice() : [];
  const p = document.createElement("div");
  p.id = "ozyPanel";
  p.className = "oka-panel ozy-panel";
  p.setAttribute("role", "dialog");
  p.setAttribute("aria-label", "Kendi okuma yolun");
  p.innerHTML = ozyPanelIc();
  if (typeof ODAK27 !== "undefined") { ODAK27.once = document.activeElement; }
  document.body.appendChild(p);
  ozySiraCiz();
  const g = p.querySelector("#ozyAd");
  if (g) { g.focus({ preventScroll: true }); }
}
function ozyPanelKapat() {
  const p = document.querySelector("#ozyPanel");
  if (!p) { return false; }
  p.remove();
  if (typeof odakGeriVer === "function") { odakGeriVer(); }
  return true;
}

function ozyKaydet() {
  const ad = ((document.querySelector("#ozyAd") || {}).value || "").trim();
  const d = document.querySelector("#ozyDurum");
  if (!ad || OZY.secilen.length < 2) { if (d) { d.textContent = "Bir ad ver ve en az iki kutu ekle."; } return; }
  const l = ozelYollar();
  const y = OZY.duzenlenen ? l.find(function (x) { return x.id === OZY.duzenlenen; }) : null;
  if (y) { y.ad = ad.slice(0, 60); y.a = OZY.secilen.slice(0, 40); }
  else { l.unshift({ id: Date.now().toString(36), ad: ad.slice(0, 60), a: OZY.secilen.slice(0, 40) }); }
  ozelYollarYaz(l);
  ozyPanelKapat();
  if (typeof ayar25Ciz === "function") { ayar25Ciz(); }
  if (typeof eckaBildir === "function") { eckaBildir("Okuma yolu kaydedildi"); }
}

async function ozyPaylas(id) {
  const y = ozelYollar().find(function (x) { return x.id === id; });
  if (!y) { return; }
  const url = yolBaglantisi(y);
  if (typeof TentiforKopru !== "undefined" && TentiforKopru.paylas) {
    try { await TentiforKopru.paylas({ title: y.ad, text: "TentiforApp okuma yolu: " + y.ad, url: url }); return; } catch (_) { /* aşağıda */ }
  }
  try { await navigator.clipboard.writeText(url); if (typeof eckaBildir === "function") { eckaBildir("Bağlantı kopyalandı"); } }
  catch (_) { window.prompt("Okuma yolunun bağlantısı:", url); }
}

/* ==================== karakter zaman çizgisi ==================== */

function karakterZamanHtml(k) {
  if (!k || typeof karakterKutulari !== "function") { return ""; }
  const l = karakterKutulari(k).filter(function (x) { return !x.kilitli; });
  const zaman = l.filter(function (x) { return /^zaman:/.test(x.anahtar); }).map(function (x) {
    const no = x.anahtar.slice(6);
    const z = (veri.zamanCizelgesi || []).find(function (a) { return String(a.no) === no; }) || {};
    return { x: x, z: z };
  }).sort(function (a, b) { return (Number(a.z.no) || 0) - (Number(b.z.no) || 0); });
  const kalem = l.filter(function (x) { return /^(mektup|gunluk):/.test(x.anahtar); });
  if (!zaman.length && !kalem.length) { return ""; }
  let cag = "";
  const satir = function (x, ust, alt) {
    const ok = typeof okunduMu === "function" && okunduMu(x.anahtar);
    return '<li class="kz-adim' + (ok ? " okundu" : "") + '"><button type="button" class="kz-git" data-kz-git="' + kacir(x.anahtar) + '">' +
      '<span class="kz-nokta" aria-hidden="true"></span><span><b>' + kacir(ust) + "</b>" + (alt ? '<span class="oyun-not"> ' + kacir(alt) + "</span>" : "") +
      '<span class="sr-yalniz">' + (ok ? ", okundu" : ", okunmadı") + "</span></span></button></li>";
  };
  return '<div class="kutu-y karakter-zaman"><div class="oyun-etiket">' + kacir(k.ad) + " · zaman çizgisi</div>" +
    (zaman.length ? '<ol class="kz-cizgi">' + zaman.map(function (o) {
      const c = o.z.cag && o.z.cag !== cag ? '<li class="kz-cag" aria-hidden="true">' + kacir(o.z.cag) + "</li>" : "";
      cag = o.z.cag || cag;
      return c + satir(o.x, o.z.baslik || o.x.ad, o.z.cag ? "· " + o.z.cag : "");
    }).join("") + "</ol>" : "") +
    (kalem.length ? '<div class="oyun-etiket">Kendi kaleminden ve ona yazılanlar</div><ol class="kz-cizgi">' + kalem.map(function (x) {
      return satir(x, x.ad, "");
    }).join("") + "</ol>" : "") +
    '<p class="oyun-not">Soluk olanları henüz okumadın; dokununca açılır.</p></div>';
}

/* karakter penceresi açılınca bir kez (rozet kutusu kendini yenilese de çizgi çoğalmaz) */
if (typeof sonraSar === "function") {
  sonraSar("karakterAc", function (eskiAc) {
    return function (i) {
      const r = eskiAc.apply(this, arguments);
      const k = (veri.karakterler || [])[i];
      const p = document.querySelector("#perde:not([hidden]) .pencere");
      if (k && p && !p.querySelector(".karakter-zaman")) { p.insertAdjacentHTML("beforeend", karakterZamanHtml(k)); }
      return r;
    };
  });
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const t = e.target;
  if (!t.closest) { return; }

  const sd = t.closest("[data-dinle]");
  if (sd) {
    const v = sd.getAttribute("data-dinle");
    if (v === "duraklat") { sesDuraklat(); }
    else if (v === "atla") { if (SES.aktif) { SES.nesil++; try { window.speechSynthesis.cancel(); } catch (_) { /* yok */ } SES.i++; SES.duraklat = false; sesSoyle(); } }
    else if (v === "durdur") { dinlemeDurdur(); }
    else if (v === "hiz") {
      const a = sesAyar();
      a.hiz = SES_HIZ[(SES_HIZ.indexOf(a.hiz) + 1) % SES_HIZ.length];
      tf28Yaz(TF28.ses, a);
      if (SES.aktif && !SES.duraklat) { SES.nesil++; try { window.speechSynthesis.cancel(); } catch (_) { /* yok */ } sesSoyle(); } else { sesCubukCiz(); }
    } else if (v === "uyku") {
      const a = sesAyar();
      const sira = ["", "15", "30", "bolum"];
      a.uyku = sira[(sira.indexOf(a.uyku) + 1) % sira.length];
      tf28Yaz(TF28.ses, a);
      SES.uyku = /^\d+$/.test(a.uyku) ? Date.now() + Number(a.uyku) * 60000 : null;
      SES.bolumSonu = a.uyku === "bolum";
      sesCubukCiz();
    }
    return;
  }

  const as = t.closest("[data-atlas-serbest]");
  if (as) { serbestBaslat(as.getAttribute("data-atlas-serbest")); return; }
  if (t.closest("[data-atlas-kapat]")) { SERBEST.d = null; atlasCiz(); return; }
  const ah = t.closest("[data-atlas-harita]");
  if (ah) {
    const m = ah.getScreenCTM();
    if (m) { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); serbestTahmin(Math.max(0, Math.min(100, p.x)), Math.max(0, Math.min(100, p.y))); }
    return;
  }

  if (t.closest("[data-bul-kontrol]")) { bulKontrol(); return; }
  if (t.closest("[data-bul-harf-ac]")) { bulHarfAc(); return; }
  const bg = t.closest("[data-bul-git]");
  if (bg) { const p = bg.getAttribute("data-bul-git").split(","); BUL.yon = p[2] === "1"; const n = document.querySelector('[data-bul="' + p[0] + "," + p[1] + '"]'); if (n) { n.focus(); n.select(); } return; }

  const hd = t.closest("[data-okuma-hedef]");
  if (hd && hd.closest("#haftaKart")) { tf28Yaz(TF28.hedef, Number(hd.getAttribute("data-okuma-hedef")) || 0); haftaKartiCiz(); hatirlatmalariKur(); const n = document.querySelector('#haftaKart [data-okuma-hedef="' + hd.getAttribute("data-okuma-hedef") + '"]'); if (n) { n.focus(); } return; }
  if (t.closest("[data-hafta-kart]")) {
    haftaKartiUret().then(function (tv) { return tv ? kartPaylas(tv, "tentiforapp-bu-hafta.png", "Bu hafta TentiforApp'te") : ""; })
      .then(function (m) { if (m && typeof eckaBildir === "function") { eckaBildir(m); } });
    return;
  }

  const hr = t.closest("[data-hatirlat28]");
  if (hr) {
    hatirlatmaAyarla(hr.getAttribute("data-hatirlat28") === "ac").then(function (m) {
      if (m && typeof eckaBildir === "function") { eckaBildir(m); }
      if (typeof ayar25Ciz === "function") { ayar25Ciz(); }
    });
    return;
  }
  const ks = t.closest("[data-kisayol]");
  if (ks) { const s = document.querySelector("#hatirlatSerit"); if (s) { s.remove(); } kisayolUygula(ks.getAttribute("data-kisayol")); return; }
  if (t.closest("[data-serit-kapat]")) { const s = document.querySelector("#hatirlatSerit"); if (s) { s.remove(); } return; }

  if (t.closest("[data-ozy-yeni]")) { ozyPanelAc(null); return; }
  const oz = t.closest("[data-ozy-duzenle]");
  if (oz) { ozyPanelAc(oz.getAttribute("data-ozy-duzenle")); return; }
  const op = t.closest("[data-ozy-paylas]");
  if (op) { ozyPaylas(op.getAttribute("data-ozy-paylas")); return; }
  const osl = t.closest("[data-ozy-sil]");
  if (osl) {
    const id = osl.getAttribute("data-ozy-sil");
    if (!window.confirm("Bu okuma yolu silinsin mi?")) { return; }
    ozelYollarYaz(ozelYollar().filter(function (x) { return x.id !== id; }));
    const ak = typeof jsonOku === "function" ? jsonOku(typeof YOL_AKTIF !== "undefined" ? YOL_AKTIF : "", null) : null;
    if (ak && ak.id === "oz:" + id && typeof jsonYaz === "function") { jsonYaz(YOL_AKTIF, null); }
    if (typeof ayar25Ciz === "function") { ayar25Ciz(); }
    return;
  }
  if (t.closest("[data-ozy-kapat]")) { ozyPanelKapat(); return; }
  if (t.closest("[data-ozy-kaydet]")) { ozyKaydet(); return; }
  const oe = t.closest("[data-ozy-ekle]");
  if (oe) {
    OZY.secilen.push(oe.getAttribute("data-ozy-ekle"));
    ozySiraCiz();
    const g = document.querySelector("#ozyAra");
    if (g) { ozySonucCiz(g.value); g.focus(); }
    return;
  }
  const oy = t.closest("[data-ozy-yukari], [data-ozy-asagi], [data-ozy-cikar]");
  if (oy) {
    const i = Number(oy.getAttribute("data-ozy-yukari") || oy.getAttribute("data-ozy-asagi") || oy.getAttribute("data-ozy-cikar"));
    if (oy.hasAttribute("data-ozy-cikar")) { OZY.secilen.splice(i, 1); }
    else {
      const j = oy.hasAttribute("data-ozy-yukari") ? i - 1 : i + 1;
      if (j >= 0 && j < OZY.secilen.length) { const x = OZY.secilen[i]; OZY.secilen[i] = OZY.secilen[j]; OZY.secilen[j] = x; }
    }
    ozySiraCiz();
    return;
  }

  const kz = t.closest("[data-kz-git]");
  if (kz) { const k = kutuBul(kz.getAttribute("data-kz-git")); if (k && typeof kutuyaGit === "function") { kutuyaGit(k); } return; }
});

/* yol ararken yalnızca sonuç listesi yenilenir (kutu yerinde kalır, klavye kapanmaz) */
document.addEventListener("input", function (e) {
  if (e.target && e.target.id === "ozyAra") { ozySonucCiz(e.target.value); }
  if (e.target && e.target.id === "ozyAd") { OZY.ad = e.target.value; }
});

document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") { return; }
  if (ozyPanelKapat()) { e.stopImmediatePropagation(); e.preventDefault(); return; }
  if (SES.aktif && e.target && e.target.closest && e.target.closest("#sesCubuk")) { dinlemeDurdur(); e.stopImmediatePropagation(); e.preventDefault(); }
}, true);

window.addEventListener("hashchange", function () { ozyPanelKapat(); });
document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { hatirlatmalariKur(); } });

/* ==================== başlangıç ==================== */

(function bekle28(n) {
  if (typeof veri === "undefined" || !veri) { if (n > 0) { setTimeout(function () { bekle28(n - 1); }, 300); } return; }
  adresParametreleri();
  haftaKartiCiz();
  hatirlatmalariKur();
  setTimeout(seritGoster, 3000);
  /* uygulama kısayolu soğuk açılışta: başlatan adres (bir kez) */
  const app = typeof kabukMu === "function" && kabukMu() && typeof kabukEklenti === "function" ? kabukEklenti("App") : null;
  if (app && app.getLaunchUrl) {
    app.getLaunchUrl().then(function (d) {
      const u = d && d.url;
      if (!u || !/kisayol=/.test(u)) { return; }
      let once = "";
      try { once = sessionStorage.getItem("tf28_acilis") || ""; } catch (_) { /* yok */ }
      if (once === u) { return; }
      try { sessionStorage.setItem("tf28_acilis", u); } catch (_) { /* yok */ }
      const m = /kisayol=([a-z]+)/.exec(u);
      if (m) { kisayolUygula(m[1]); }
    }).catch(function () { /* yok */ });
  }
  const ln = typeof kabukMu === "function" && kabukMu() && typeof kabukEklenti === "function" ? kabukEklenti("LocalNotifications") : null;
  if (ln && ln.addListener) {
    ln.addListener("localNotificationActionPerformed", function (d) {
      const k = d && d.notification && d.notification.extra && d.notification.extra.kisayol;
      if (k) { setTimeout(function () { kisayolUygula(k); }, 600); }
    });
  }
})(60);

window.addEventListener("hashchange", function () { setTimeout(haftaKartiCiz, 300); });

/* erişilebilirlik: soluk "pasif" düğmeler ekran okuyucuya da kullanılamaz olarak söylensin (sınıf birçok dosyada) */
function pasifIsaretle() {
  document.querySelectorAll(".dugme.pasif:not([aria-disabled]), .dukkan.pasif:not([aria-disabled])").forEach(function (b) { b.setAttribute("aria-disabled", "true"); });
  document.querySelectorAll("[aria-disabled='true']:not(.pasif):not([disabled])").forEach(function (b) { if (b.classList.contains("dugme") || b.classList.contains("dukkan")) { b.removeAttribute("aria-disabled"); } });
}
let pasifZaman = null;
new MutationObserver(function () {
  if (pasifZaman) { return; }
  pasifZaman = setTimeout(function () { pasifZaman = null; pasifIsaretle(); }, 200);
}).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
