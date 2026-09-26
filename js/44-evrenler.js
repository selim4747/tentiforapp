/* Evrenler: her sayfadan evren seçimi, her evrenin kendi sayfası, kişinin kendi evreni ve E99.

   - "Evren seç" menüsü (başlıkta, telefonda alt menüde): sitedeki evrenler, fanmade evrenler,
     kişinin kendi evrenleri ve açtığı evren dosyaları.
   - Evren sayfası (#/ev/<kaynak>/<id>): harita + evren bilgileri. Kişi kendi evreninin tam yöneticisidir:
     haritasına yer ekler, taşır, alan çizer; kurallarını, kişilerini ve kendi alanlarını düzenler.
     Hepsi kişinin verisinde (tentiforapp_fan_eserlerim) durur; hesabı varsa cihazlar arasında eşitlenir.
   - E99 (#/ev/e99): herkesin yazabildiği boş evren. Okurun katkısı önce yalnızca kendi cihazında durur;
     gönderince dosya olur ve e-postayla yazara gider; yönetici dosyayı açıp onaylayınca E99'a eklenir.
   - Ekonomi, stil, alfabe, kod ve kilitli lore sekmeleri: 45-evrengezer.js.
   - Panel → Bakım → Yayınla: Cloudflare'de otomatik yayın kapalıyken siteyi tek tıkla yayınlar (deploy hook). */

const E99_KATKI_ID = "e99-katkim";
const E99_GONDERILEN_ANAHTAR = "tentiforapp_e99_gonderilen";
const YAYIN_KANCA_ANAHTAR = "tentiforapp_yayin_kancasi";   /* hesapla eşitlenmez (28-hesap.js) */
const EVH_TURLER = ["Kıta", "Bölge", "Şehir", "Küçük Yerleşim", "Ada", "Su", "Dağ", "Orman", "Çöl", "Uzak"];

/* ==================== evren listesi ==================== */

/** Kayıt (karakter, evren maddesi, sözlük terimi) bu evrende görünür mü? Alan yoksa yalnızca Tömye'dedir.
    Birden çok evrende olan kayıt (ör. melezler) hepsinde ortaktır; kilitli katmanları aynı kodla açılır. */
function evrendeMi(o, id) {
  const l = o && Array.isArray(o.evrenler) && o.evrenler.length ? o.evrenler : ["tomye"];
  return l.indexOf(id) !== -1;
}

/** Kanon evren sayfasına erişim: yönetici; evrenin "erisim" bölümüne erişimi olan (E25 → Tömye'nin evren bölümü:
    maddeler Tömye'den taşındığı için görünürlükleri değişmez); ya da o evrene kodla erişimi olan. */
function kanonSayfaErisimi(id) {
  if (typeof panelAcik === "function" && panelAcik()) { return true; }
  const k = (veri.kanonEvrenleri || {})[id];
  if (k && k.erisim && typeof bolumErisimi === "function" && bolumErisimi(k.erisim)) { return true; }
  return typeof kanonEvrenErisimi !== "function" || kanonEvrenErisimi(id);
}

function evrenSiraNo(x) {
  const m = String(x.ad || "").match(/(\d+)/);
  return m ? Number(m[1]) : 999;
}

/** Kanon evrenin kayıtları: bu evrene etiketli kişiler, evren maddeleri ve sözlük terimleri.
    Tömye'yle ortak kişilerin (melezler) yalnızca özeti burada; anıları ve hikâyeleri Tömye arşivinde kalır.
    Maddeler Tömye'dekiyle aynı biçimde (buz katmanları aynı kodlarla açılır). */
function kanonEvrenIcerigi(id) {
  const kisiler = (veri.karakterler || []).map(function (k, i) { return [k, i]; }).filter(function (x) { return evrendeMi(x[0], id); });
  const maddeler = (veri.evren || []).map(function (e, i) { return [e, i]; }).filter(function (x) { return evrendeMi(x[0], id); });
  const terimler = (veri.sozluk || []).filter(function (t) { return evrendeMi(t, id); });
  if (!kisiler.length && !maddeler.length && !terimler.length) { return ""; }
  const rozet = function (o) { return typeof kilitRozeti === "function" ? kilitRozeti(o) : ""; };
  return '<div class="kanon-evren-icerik">' +
    (kisiler.length ? '<h3 class="evs-ara-baslik">Kişiler</h3><div class="izgara evs-izgara">' + kisiler.map(function (x) {
      const k = x[0];
      if (evrendeMi(k, "tomye")) {
        return '<div class="kart kart-ortak"><span class="kart-unvan">' + kacir(k.unvan) + " · Tömye ile ortak</span>" +
          '<span class="kart-ad">' + kacir(k.ad) + '</span><span class="kart-ozet">' + kacir(k.ozet) + "</span>" +
          '<button class="dugme dugme-sade" data-evren-git="#/karakter/' + kacir(k.id) + '">Anıları ve hikâyesi Tömye\'de →</button></div>';
      }
      return '<button class="kart" data-karakter="' + x[1] + '"><span class="kart-unvan">' + kacir(k.unvan) + "</span>" +
        '<span class="kart-ad">' + kacir(k.ad) + '</span><span class="kart-ozet">' + kacir(k.ozet) + "</span>" + rozet(k) + "</button>";
    }).join("") + "</div>" : "") +
    (maddeler.length ? '<h3 class="evs-ara-baslik">Evren bilgisi</h3><div class="madde-liste">' + maddeler.map(function (x) {
      const e = x[0];
      return '<div class="madde" data-madde="' + x[1] + '"><button class="madde-bas" aria-expanded="false">' +
        '<span class="madde-bolum">' + kacir(evrendeMi(e, "tomye") ? "Tömye ile ortak" : e.bolum) + "</span>" +
        '<span class="madde-baslik">' + kacir(e.baslik) + rozet(e) + '</span><span class="madde-ok">›</span></button>' +
        '<div class="madde-ozet">' + kacir(e.ozet) + "</div>" +
        '<div class="madde-govde">' + paragraf(e.metin) + (typeof buzulListesi === "function" ? buzulListesi(e.gizli) : "") + "</div></div>";
    }).join("") + "</div>" : "") +
    (terimler.length ? '<h3 class="evs-ara-baslik">Sözlük</h3><dl class="evs-sozluk">' + terimler.map(function (t) {
      return "<dt>" + kacir(t.terim) + "</dt><dd>" + kacir(t.tanim) + "</dd>";
    }).join("") + "</dl>" : "") +
    "</div>";
}

function evrenSeciciListesi() {
  const site = [];
  (veri.haritalar || []).forEach(function (h) {
    const kilitli = !kanonSayfaErisimi(h.id);
    const git = h.id === "claude" ? "#/claude" : (h.id === (veri.haritalar[0] || {}).id ? "#/arsiv"
      : ((veri.kanonEvrenleri || {})[h.id] ? "#/ev/site/" + h.id : "harita:" + h.id));
    site.push({ ad: h.id === (veri.haritalar[0] || {}).id ? h.ad + " · 24. Evren" : h.ad, git: git, kilitli: kilitli,
      not: h.id === "claude" ? "kanon dışı" : "" });
  });
  /* haritası olmayan kanon evrenler (ör. E25) */
  Object.keys(veri.kanonEvrenleri || {}).forEach(function (id) {
    if ((veri.haritalar || []).some(function (h) { return h.id === id; })) { return; }
    const k = veri.kanonEvrenleri[id];
    site.push({ ad: k.ad || id.toUpperCase(), git: "#/ev/site/" + id, kilitli: !kanonSayfaErisimi(id), not: id === "e25" ? "Evrengezerler" : "" });
  });
  site.sort(function (a, b) { return evrenSiraNo(a) - evrenSiraNo(b); });
  if (veri.e99) { site.push({ ad: "E99", git: "#/ev/e99", not: "herkes yazabilir" }); }
  const fan = ((veri.fanEserleri || {}).evrenler || []).map(function (e) {
    return { ad: e.ad, git: "#/ev/fan/" + e.id, not: e.yazar || "" };
  });
  const benim = fanEserlerim().filter(function (e) { return e.tur === "evren" && !e.e99; }).map(function (e) {
    return { ad: e.ad || "Adsız evren", git: "#/ev/benim/" + e.id, not: "tam yöneticisi sensin" };
  });
  const acilan = fanAcilanlar().filter(function (e) { return e.tur === "evren"; }).map(function (e) {
    return { ad: e.ad, git: "#/ev/acilan/" + e.id, not: "dosyadan" };
  });
  return { site: site, fan: fan, benim: benim, acilan: acilan };
}

function evrenSeciciAc() {
  if (document.querySelector("#evrenSecici")) { evrenSeciciKapat(); return; }
  if (typeof mobilMenuKapat === "function") { mobilMenuKapat(); }
  const l = evrenSeciciListesi();
  const grup = function (baslik, liste, bos) {
    return '<div class="es-grup"><div class="oyun-etiket">' + kacir(baslik) + "</div>" +
      (liste.length ? liste.map(function (x) {
        return '<button class="es-oge' + (x.kilitli ? " kilitli" : "") + '" data-evren-git="' + kacir(x.git) + '">' +
          '<span class="es-ad">' + kacir(x.ad) + (x.kilitli && typeof KANON_KILIT_SVG !== "undefined" ? " " + KANON_KILIT_SVG : "") + "</span>" +
          (x.not ? '<span class="es-not">' + kacir(x.not) + "</span>" : "") + "</button>";
      }).join("") : '<p class="oyun-not">' + kacir(bos) + "</p>") + "</div>";
  };
  const k = document.createElement("div");
  k.id = "evrenSecici";
  k.className = "es-katman";
  k.innerHTML = '<div class="es-panel" role="dialog" aria-modal="true" aria-label="Evren seç">' +
    '<div class="mm-ust es-ust"><b>Evren seç</b><button class="pencere-kapat" data-es-kapat aria-label="Kapat">✕</button></div>' +
    grup("Sitedeki evrenler", l.site, "") +
    grup("Senin evrenlerin", l.benim, "Henüz bir evren kurmadın.") +
    '<button class="dugme es-yeni" data-es-yeni>+ Yeni evren kur</button>' +
    (l.fan.length ? grup("Fanmade evrenler", l.fan, "") : "") +
    (l.acilan.length ? grup("Açtığın evren dosyaları", l.acilan, "") : "") +
    "</div>";
  document.body.appendChild(k);
  const ilk = k.querySelector(".es-oge");
  if (ilk) { ilk.focus({ preventScroll: true }); }
}

function evrenSeciciKapat() {
  const k = document.querySelector("#evrenSecici");
  if (k) { k.remove(); }
}

function evrenGit(git) {
  evrenSeciciKapat();
  if (git.indexOf("harita:") === 0) {
    const id = git.slice(7);
    if (typeof haritaSeciliId !== "undefined") { haritaSeciliId = id; }
    if (location.hash !== "#/harita") { location.hash = "#/harita"; }
    setTimeout(function () { if (typeof haritaCiz === "function") { try { haritaCiz(); } catch (e) { /* çizilemedi */ } } }, 60);
    return;
  }
  location.hash = git;
}

/** Başlıktaki "Evren" düğmesi (her sayfada görünür; telefonda alt menüde). */
function evrenDugmesiKur() {
  if (document.querySelector("#evrenSecBtn")) { return; }
  const once = document.querySelector("#cuzdanRozet");
  if (!once) { return; }
  const b = document.createElement("button");
  b.id = "evrenSecBtn";
  b.className = "evren-sec-btn";
  b.setAttribute("aria-haspopup", "dialog");
  b.innerHTML = '<span aria-hidden="true">◎</span> Evren seç';
  once.parentNode.insertBefore(b, once);
}

/* ==================== kişinin kendi evreni ve E99 katkısı ==================== */

function evrenBenimBul(id) {
  return fanEserlerim().find(function (e) { return e.id === id && e.tur === "evren"; }) || null;
}

function evrenYeniKur() {
  const e = fanYeni("evren");
  return e.id;
}

/** E99 katkısı: kişinin henüz göndermediği ekleri; fan taslakları arasında gizli bir kayıt. */
function e99Katki() {
  let e = evrenBenimBul(E99_KATKI_ID);
  if (!e) {
    const l = fanEserlerim();
    e = { bicim: FAN_BICIM, surum: 1, tur: "evren", id: E99_KATKI_ID, e99: true, ad: "E99 katkım", yazar: "", ozet: "", harita: { yerler: [] } };
    FAN_EVREN_GRUPLARI.forEach(function (g) { e[g.k] = []; });
    l.push(e);
    fanEserlerimYaz(l);
  }
  if (!e.harita) { e.harita = { yerler: [] }; }
  return e;
}

function e99KatkiBosMu(e) {
  return !FAN_EVREN_GRUPLARI.some(function (g) {
    return (e[g.k] || []).some(function (x) { return Object.keys(x).some(function (k) { return String(x[k] || "").trim(); }); });
  }) && !((e.harita || {}).yerler || []).length && !String(e.ozet || "").trim();
}

function e99Gonderilenler() {
  const l = jsonOku(E99_GONDERILEN_ANAHTAR, []);
  return Array.isArray(l) ? l : [];
}

/** Yayındaki E99'a eklenmiş (onaylanıp yayınlanmış) önerileri yerel listeden düşer. */
function e99GonderilenleriTemizle() {
  const yayinda = (veri.e99 && veri.e99.oneriler) || [];
  const l = e99Gonderilenler();
  const kalan = l.filter(function (g) { return yayinda.indexOf(g.id) === -1; });
  if (kalan.length !== l.length) { jsonYaz(E99_GONDERILEN_ANAHTAR, kalan); }
  return kalan;
}

/* ==================== harita ==================== */

const EVH_RENK = {
  "Kıta": "#E6DCC3", "Bölge": "#D9E6C8", "Ada": "#E6DCC3", "Su": "#9DC4E3", "Dağ": "#C9BBA8",
  "Orman": "#B7D3A8", "Çöl": "#EFD9A6", "Uzak": "#D5D9E0"
};

function evhTurRengi(tur) { return EVH_RENK[tur] || "#E3DCCB"; }

/** Salt SVG: yayın dosyasında da (fanDosyaHtml) kullanılır, bu yüzden yalnızca öznitelik ve kaçırılmış metin. */
function evrenHaritaSvg(h, o) {
  o = o || {};
  const yerler = (h && h.yerler) || [];
  const ekli = o.ekli || [];               /* E99: kişinin yayında olmayan katkıları (kesik çizgili) */
  const k = 0.7;
  const esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };
  /* harita stili (kurucunun seçtiği desen ve renkler; yalnızca #RRGGBB) */
  const st = (h && h.stil) || {};
  const desen = (typeof EVH_DESENLER !== "undefined" && EVH_DESENLER[st.desen]) || {};
  const hex = function (v) { return /^#[0-9a-fA-F]{6}$/.test(v || "") ? v : ""; };
  const deniz = hex(h && h.renk) || desen.deniz || "#BFD8EC";
  const kara = hex(st.kara) || desen.kara || "";
  const cizgi = hex(st.cizgi) || desen.cizgi || "#8A7B5E";
  const yazi = hex(st.yazi) || desen.yazi || "#1D2530";
  const hale = desen.hale || "#fff";
  const yaziTipi = ({ sans: "system-ui,sans-serif", mono: "ui-monospace,monospace" })[st.font] || "Georgia,serif";
  const etiket = function (ad) {
    return st.font === "alfabe" && o.alfabe && typeof evrenAlfabeYaz === "function" ? evrenAlfabeYaz(ad, o.alfabe) : ad;
  };
  const alanRengi = function (tur) { return kara && tur !== "Su" ? kara : (tur === "Su" && kara ? deniz : evhTurRengi(tur)); };
  const izgara = (st.izgara || desen.izgara)
    ? '<g class="evh-izgara" stroke="' + cizgi + '" stroke-width="0.12" opacity="0.45">' +
      [10, 20, 30, 40, 50, 60, 70, 80, 90].map(function (x) { return '<line x1="' + x + '" y1="0" x2="' + x + '" y2="70"></line>'; }).join("") +
      [10, 20, 30, 40, 50, 60].map(function (y) { return '<line x1="0" y1="' + y + '" x2="100" y2="' + y + '"></line>'; }).join("") + "</g>"
    : "";
  const alan = function (y, katki) {
    if (!y.sekil || y.sekil.length < 3) { return ""; }
    return '<polygon points="' + y.sekil.map(function (n) { return n[0] + "," + (n[1] * k).toFixed(2); }).join(" ") + '" fill="' + alanRengi(y.tur) + '"' +
      ' stroke="' + cizgi + '" stroke-width="0.25"' + (katki ? ' stroke-dasharray="1 0.6"' : "") + (o.secili === y.id ? ' class="evh-secili"' : "") +
      ' data-evh-yer="' + esc(y.id) + '"' + (katki ? ' data-evh-katki="1"' : "") + "></polygon>";
  };
  const isaret = function (y, katki) {
    const sec = o.secili === y.id;
    return '<g class="evh-yer' + (sec ? " secili" : "") + (katki ? " katki" : "") + '" data-evh-yer="' + esc(y.id) + '"' + (katki ? ' data-evh-katki="1"' : "") +
      ' transform="translate(' + y.x + "," + (y.y * k).toFixed(2) + ')">' +
      '<circle r="' + (sec ? 1.6 : 1.1) + '" fill="' + (y.tur === "Şehir" ? "#1C5C96" : "#3D4A57") + '" stroke="#fff" stroke-width="0.35"' + (katki ? ' stroke-dasharray="0.6 0.4"' : "") + "></circle>" +
      '<circle r="3.2" fill="transparent"></circle>' +
      '<text y="-2.1" text-anchor="middle" font-size="2.3" font-family="' + yaziTipi + '" fill="' + yazi + '" stroke="' + hale + '" stroke-width="0.5" paint-order="stroke">' + esc(etiket(y.ad || "—")) + "</text></g>";
  };
  const taslak = (o.cizim && o.cizim.length)
    ? '<polyline points="' + o.cizim.map(function (n) { return n[0] + "," + (n[1] * k).toFixed(2); }).join(" ") + '" fill="none" stroke="#A33" stroke-width="0.4" stroke-dasharray="1 0.5"></polyline>' +
      o.cizim.map(function (n) { return '<circle cx="' + n[0] + '" cy="' + (n[1] * k).toFixed(2) + '" r="0.6" fill="#A33"></circle>'; }).join("")
    : "";
  return '<svg class="evh-svg' + (o.duzenle ? " duzenle" : "") + '" viewBox="0 0 100 70" role="img" aria-label="Evren haritası" xmlns="http://www.w3.org/2000/svg">' +
    '<rect class="evh-deniz" x="0" y="0" width="100" height="70" fill="' + deniz + '"></rect>' + izgara +
    yerler.map(function (y) { return alan(y, false); }).join("") + ekli.map(function (y) { return alan(y, true); }).join("") +
    yerler.filter(function (y) { return !y.sekil; }).map(function (y) { return isaret(y, false); }).join("") +
    ekli.filter(function (y) { return !y.sekil; }).map(function (y) { return isaret(y, true); }).join("") +
    yerler.filter(function (y) { return y.sekil; }).map(function (y) { return isaret(y, false); }).join("") +
    ekli.filter(function (y) { return y.sekil; }).map(function (y) { return isaret(y, true); }).join("") +
    taslak + "</svg>";
}

/* ==================== evren sayfası ==================== */

let EVS = null;
let evrenSonrakiSekme = null;   /* yeni evren kurulunca bilgi sekmesiyle açılsın */   /* { kaynak: benim|fan|acilan|e99, id, sekme: harita|bilgi, secili, mod: sec|yer|cizim, cizim: [] } */

function evrenSayfaAc(kaynak, id) {
  if (kaynak === "e99") { e99Katki(); id = "e99"; }
  /* haritası olmayan kanon evren bilgi sekmesiyle açılır */
  const haritasiz = kaynak === "site" && !(veri.haritalar || []).some(function (h) { return h.id === id && (h.yerler || []).length; });
  EVS = { kaynak: kaynak, id: id, sekme: evrenSonrakiSekme || ((EVS && EVS.kaynak === kaynak && EVS.id === id) ? EVS.sekme : (haritasiz ? "bilgi" : "harita")), secili: null, mod: "sec", cizim: [] };
  evrenSonrakiSekme = null;
  evrenSayfaCiz();
  if (EVS && typeof evrenZiyaretOdulu === "function") {
    if (evrenZiyaretOdulu() && document.querySelector("#evrenSayfa [data-evs-cuzdan]")) { evrenSayfaCiz(); }
  }
}

function evrenSayfaKapat() {
  const s = document.querySelector("#evrenSayfa");
  if (s) { s.remove(); }
  document.documentElement.classList.remove("evren-acik");
  EVS = null;
  if (rota().indexOf("#/ev/") === 0) {
    history.replaceState(null, "", rotadanYol("#/fan") + location.search);
    if (typeof sayfaYonlendir === "function") { sayfaYonlendir(); }
  }
}

/** Gösterilecek evren ve düzenleme hakkı. */
function evrenSayfaVerisi() {
  if (!EVS) { return null; }
  if (EVS.kaynak === "benim") {
    const e = evrenBenimBul(EVS.id);
    return e ? { eser: e, duzenle: true, hedef: e.id, rozet: "Senin evrenin · tam yöneticisi sensin" } : null;
  }
  if (EVS.kaynak === "fan" || EVS.kaynak === "acilan") {
    const e = fanBul(EVS.kaynak === "fan" ? "site" : "acilan", "evren", EVS.id);
    return e ? { eser: e, duzenle: false, rozet: EVS.kaynak === "fan" ? "Fanmade evren" : "Açtığın dosya" } : null;
  }
  if (EVS.kaynak === "e99") {
    return { eser: veri.e99 || {}, duzenle: true, hedef: E99_KATKI_ID, katki: e99Katki(), rozet: "Herkesin evreni · yazdıkların önce yalnızca sende durur" };
  }
  if (EVS.kaynak === "site") {
    /* sitenin kanon evreni: bilgiler veri.kanonEvrenleri'nden, harita sitenin haritasından (veri.haritalar) */
    const k = (veri.kanonEvrenleri || {})[EVS.id];
    const h = (veri.haritalar || []).find(function (x) { return x.id === EVS.id; });
    if (!k) { return null; }
    const acik = kanonSayfaErisimi(EVS.id);
    const yon = typeof yoneticiAcik === "function" && yoneticiAcik();
    const eser = Object.assign({}, k, { etiket: "Kanon evren", harita: { yerler: (h && h.yerler) || [], renk: h && h.renk } });
    return { eser: eser, duzenle: yon, site: h, kilitli: !acik,
      rozet: yon ? "Kanon · haritayı yönetici olarak düzenliyorsun" : "Kanon evren" };
  }
  return null;
}

function evrenSayfaCiz() {
  const v = evrenSayfaVerisi();
  let s = document.querySelector("#evrenSayfa");
  if (!v) { if (s) { s.remove(); } EVS = null; return; }
  if (!s) {
    s = document.createElement("div");
    s.id = "evrenSayfa";
    s.className = "evren-sayfa";
    s.setAttribute("role", "dialog");
    s.setAttribute("aria-modal", "true");
    document.body.appendChild(s);
    document.documentElement.classList.add("evren-acik");
  }
  const e = v.eser;
  const sekme = function (id, ad) {
    return '<button class="dugme' + (EVS.sekme === id ? "" : " dugme-sade") + '" data-evs-sekme="' + id + '" aria-selected="' + (EVS.sekme === id) + '" role="tab">' + ad + "</button>";
  };
  s.setAttribute("aria-label", e.ad || "Evren");
  const ek = (!v.kilitli && typeof evrenEkSekmeler === "function") ? evrenEkSekmeler(v) : [];
  if (["harita", "bilgi"].indexOf(EVS.sekme) === -1 && !ek.some(function (x) { return x[0] === EVS.sekme; })) { EVS.sekme = "harita"; }
  const ekGovde = ek.length && typeof evrenEkBolum === "function" ? evrenEkBolum(v) : null;
  const alfabeAd = e.alfabe && e.alfabe.baslik && typeof evrenAlfabeYaz === "function" ? evrenAlfabeYaz(e.ad || "", e.alfabe) : "";
  s.setAttribute("style", typeof evrenSayfaStili === "function" ? evrenSayfaStili(e) : "");
  s.innerHTML =
    '<div class="evs-ust">' +
      '<button class="dugme dugme-sade" data-evs-kapat>← Geri</button>' +
      '<div class="evs-baslik"><span class="oyun-etiket">' + kacir(v.rozet) + "</span><h2>" + kacir(e.ad || "Adsız evren") + "</h2>" +
        (alfabeAd ? '<div class="evs-alfabe-ad" aria-hidden="true">' + kacir(alfabeAd) + "</div>" : "") + "</div>" +
      '<button class="dugme dugme-sade" data-evren-sec>◎ Başka evren</button>' +
    "</div>" +
    (!v.kilitli && typeof evrenCuzdanCubugu === "function" ? evrenCuzdanCubugu(v) : "") +
    '<div class="evs-sekmeler" role="tablist">' + sekme("harita", "Harita") + sekme("bilgi", EVS.kaynak === "e99" ? "Evren ve katkın" : (v.duzenle ? "Evreni düzenle" : "Evren")) +
      ek.map(function (x) { return sekme(x[0], kacir(x[1])); }).join("") + "</div>" +
    '<div class="evs-govde">' + (v.kilitli
      ? '<div class="kutu-y"><p class="oyun-giris">Bu evren kanonun parçası; kodla açılır.</p><button class="dugme" data-evs-kod>Kod gir</button></div>' +
        /* E25'e kişi eklemek herkese açık: evren kilitliyken de */
        (EVS.kaynak === "site" && EVS.id === "e25" && typeof e25KisilerHtml === "function" ? e25KisilerHtml() : "")
      : (ekGovde !== null ? ekGovde : (EVS.sekme === "harita" ? evrenHaritaBolumu(v) : evrenBilgiBolumu(v)))) + "</div>";
}

/* ---------- harita sekmesi ---------- */

function evrenHaritaVerisi(v) {
  if (EVS.kaynak === "e99") { return { yayin: (veri.e99 && veri.e99.harita) || { yerler: [] }, duzen: v.katki.harita }; }
  if (EVS.kaynak === "site") {
    const h = v.site || { yerler: [] };
    if (!Array.isArray(h.yerler)) { h.yerler = []; }
    return v.duzenle ? { yayin: { yerler: [] }, duzen: h } : { yayin: h, duzen: null };
  }
  return { yayin: v.duzenle ? { yerler: [] } : (v.eser.harita || { yerler: [] }), duzen: v.duzenle ? (v.eser.harita || { yerler: [] }) : null };
}

function evrenHaritaBolumu(v) {
  const hv = evrenHaritaVerisi(v);
  const e99 = EVS.kaynak === "e99";
  const gorunen = e99 ? hv.yayin : (hv.duzen || hv.yayin);
  const svg = evrenHaritaSvg({ yerler: gorunen.yerler, renk: (hv.duzen || gorunen).renk || gorunen.renk, stil: (hv.duzen || gorunen).stil || gorunen.stil },
    { duzenle: !!hv.duzen, secili: EVS.secili, cizim: EVS.cizim, ekli: e99 ? hv.duzen.yerler : [], alfabe: v.eser.alfabe });
  const yerSay = gorunen.yerler.length + (e99 ? hv.duzen.yerler.length : 0);
  let arac = "";
  if (hv.duzen) {
    const mod = function (id, ad) { return '<button class="dugme' + (EVS.mod === id ? "" : " dugme-sade") + '" data-evh-mod="' + id + '">' + ad + "</button>"; };
    arac = '<div class="evh-arac">' + mod("sec", "Seç / taşı") + mod("yer", "+ Yer ekle") + mod("cizim", "Alan çiz") +
      (EVS.mod === "cizim" ? '<button class="dugme" data-evh-bitir' + (EVS.cizim.length < 3 ? " disabled" : "") + ">Alanı bitir (" + EVS.cizim.length + " nokta)</button>" +
        '<button class="dugme dugme-sade" data-evh-iptal>Vazgeç</button>' : "") +
      '<label class="evh-renk">Deniz <input type="color" data-evh-renk value="' + kacir(hv.duzen.renk || (typeof EVH_DESENLER !== "undefined" && EVH_DESENLER[(hv.duzen.stil || {}).desen] || {}).deniz || "#BFD8EC") + '"></label>' +
      "</div>" +
      '<p class="oyun-not">' + ({ sec: "Bir yere dokun: seçip bilgilerini düzenle; basılı tutup sürükle: taşı.",
        yer: "Haritada boş bir yere dokun: oraya yeni bir yer eklenir.",
        cizim: "Kıta, göl ya da bölge sınırı için köşelere sırayla dokun; en az 3 nokta, sonra \"Alanı bitir\"." })[EVS.mod] +
      (e99 ? " Kesik çizgili olanlar senin katkın: yalnızca sende görünür." : "") + "</p>";
  }
  return arac + '<div class="evh-kutu" data-evh-kutu>' + svg + "</div>" +
    (yerSay ? "" : '<p class="oyun-not">' + (hv.duzen ? "Harita boş: bir yer ekleyerek başla." : "Bu evrenin haritası yok.") + "</p>") +
    evrenSeciliFormu(v, hv);
}

function evrenYerBul(hv, id) {
  const d = hv.duzen && hv.duzen.yerler.find(function (y) { return y.id === id; });
  if (d) { return { yer: d, duzenlenir: true }; }
  const y = hv.yayin.yerler.find(function (x) { return x.id === id; });
  return y ? { yer: y, duzenlenir: false } : null;
}

function evrenSeciliFormu(v, hv) {
  if (!EVS.secili) { return ""; }
  const b = evrenYerBul(hv, EVS.secili);
  if (!b) { return ""; }
  const y = b.yer;
  if (!b.duzenlenir) {
    return '<div class="kutu-y evh-bilgi"><b>' + kacir(y.ad || "—") + "</b>" + (y.tur ? ' <span class="oyun-not">' + kacir(y.tur) + "</span>" : "") + paragraf(y.not) + "</div>";
  }
  return '<div class="kutu-y evh-bilgi" data-evh-form="' + kacir(y.id) + '">' +
    '<label for="evhAd">Adı</label><input class="kod-giris arac-giris" id="evhAd" data-evh-alan="ad" value="' + kacir(y.ad) + '" maxlength="80">' +
    '<label for="evhTur">Türü (listede yoksa kendin yaz)</label><input class="kod-giris arac-giris" id="evhTur" data-evh-alan="tur" list="evhTurler" value="' + kacir(y.tur) + '" maxlength="40">' +
    '<datalist id="evhTurler">' + EVH_TURLER.map(function (t) { return '<option value="' + t + '">'; }).join("") + "</datalist>" +
    '<label for="evhNot">Anlatım</label><textarea class="kod-giris arac-giris fan-uzun" id="evhNot" data-evh-alan="not" rows="3" maxlength="2000">' + kacir(y.not) + "</textarea>" +
    '<button class="dugme dugme-sade y-sil" data-evh-sil>Bu yeri sil</button></div>';
}

/** Düzenlenen haritayı kaydeder (kendi evreni ya da E99 katkısı). */
function evrenHaritaDegistir(fn) {
  const v = evrenSayfaVerisi();
  if (!v || !v.duzenle) { return; }
  if (EVS.kaynak === "site") {
    /* yönetici sitenin haritasını düzenler: yayına girmesi için Kaydet (ve Yayınla) */
    if (!v.site) { return; }
    if (!Array.isArray(v.site.yerler)) { v.site.yerler = []; }
    fn(v.site);
    if (typeof yoneticiDurum === "function") { yoneticiDurum("Harita değişti — yayına almak için panelde Kaydet", true); }
    return;
  }
  const l = fanEserlerim();
  const e = l.find(function (x) { return x.id === v.hedef; });
  if (!e) { return; }
  if (!e.harita || !Array.isArray(e.harita.yerler)) { e.harita = { yerler: [] }; }
  fn(e.harita);
  e.guncelleme = new Date().toISOString();
  fanEserlerimYaz(l);
}

function evrenNokta(svg, ev) {
  const r = svg.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, (ev.clientX - r.left) / r.width * 100));
  const y = Math.max(0, Math.min(100, (ev.clientY - r.top) / r.height * 100));
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

let evhSurukle = null;   /* { id, bas: [x,y], nokta, oynadi } */

document.addEventListener("pointerdown", function (ev) {
  const svg = ev.target.closest && ev.target.closest("#evrenSayfa .evh-svg.duzenle");
  if (!svg || !EVS) { return; }
  let hedef = ev.target.closest("[data-evh-yer]");
  /* yer eklerken bir alanın (kıta, göl) içine dokunmak da yeni yer ekler */
  if (hedef && EVS.mod === "yer" && hedef.tagName.toLowerCase() === "polygon") { hedef = null; }
  const n = evrenNokta(svg, ev);
  if (EVS.mod === "cizim") { EVS.cizim.push(n); evrenSayfaCiz(); return; }
  if (hedef) {
    const v = evrenSayfaVerisi();
    const hv = evrenHaritaVerisi(v);
    const b = evrenYerBul(hv, hedef.getAttribute("data-evh-yer"));
    EVS.secili = hedef.getAttribute("data-evh-yer");
    if (b && b.duzenlenir && !b.yer.sekil && EVS.mod === "sec") {
      evhSurukle = { id: b.yer.id, bas: n, nokta: [b.yer.x, b.yer.y], oynadi: false };
      try { svg.setPointerCapture(ev.pointerId); } catch (_) { /* yok */ }
      ev.preventDefault();
      return;
    }
    evrenSayfaCiz();
    return;
  }
  if (EVS.mod === "yer") {
    const id = "y" + Date.now().toString(36);
    evrenHaritaDegistir(function (h) { h.yerler.push({ id: id, ad: "Yeni yer", tur: "Şehir", not: "", x: n[0], y: n[1] }); });
    EVS.secili = id;
    EVS.mod = "sec";
    evrenSayfaCiz();
    const ad = document.querySelector("#evhAd");
    if (ad) { ad.focus(); ad.select(); }
    return;
  }
  EVS.secili = null;
  evrenSayfaCiz();
});

document.addEventListener("pointermove", function (ev) {
  if (!evhSurukle) { return; }
  const svg = document.querySelector("#evrenSayfa .evh-svg.duzenle");
  if (!svg) { return; }
  const n = evrenNokta(svg, ev);
  const dx = n[0] - evhSurukle.bas[0], dy = n[1] - evhSurukle.bas[1];
  if (!evhSurukle.oynadi && Math.abs(dx) + Math.abs(dy) < 0.8) { return; }
  evhSurukle.oynadi = true;
  const x = Math.max(0, Math.min(100, evhSurukle.nokta[0] + dx)), y = Math.max(0, Math.min(100, evhSurukle.nokta[1] + dy));
  const g = svg.querySelector('g[data-evh-yer="' + CSS.escape(evhSurukle.id) + '"]');
  if (g) { g.setAttribute("transform", "translate(" + x + "," + (y * 0.7).toFixed(2) + ")"); }
  evhSurukle.son = [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
});

document.addEventListener("pointerup", function () {
  if (!evhSurukle) { return; }
  const s = evhSurukle;
  evhSurukle = null;
  if (s.oynadi && s.son) {
    evrenHaritaDegistir(function (h) {
      const y = h.yerler.find(function (x) { return x.id === s.id; });
      if (y) { y.x = s.son[0]; y.y = s.son[1]; }
    });
  }
  evrenSayfaCiz();
});

document.addEventListener("input", function (ev) {
  const el = ev.target;
  if (el.matches && el.matches("#evrenSayfa [data-evh-alan]")) {
    const id = el.closest("[data-evh-form]").getAttribute("data-evh-form");
    const alan = el.getAttribute("data-evh-alan");
    evrenHaritaDegistir(function (h) {
      const y = h.yerler.find(function (x) { return x.id === id; });
      if (y) { y[alan] = String(el.value).slice(0, alan === "not" ? 2000 : 80); }
    });
    /* etiketi hemen güncelle; formu yeniden çizmeden (imleç kaçmasın) */
    if (alan === "ad") {
      const t = document.querySelector('#evrenSayfa g[data-evh-yer="' + CSS.escape(id) + '"] text');
      if (t) { t.textContent = el.value || "—"; }
    }
  } else if (el.matches && el.matches("#evrenSayfa [data-evh-renk]")) {
    evrenHaritaDegistir(function (h) { h.renk = el.value; });
    const d = document.querySelector("#evrenSayfa .evh-deniz");
    if (d) { d.setAttribute("fill", el.value); }
  }
});

/* ---------- bilgi sekmesi ---------- */

function evrenBilgiBolumu(v) {
  const e = v.eser;
  if (EVS.kaynak === "benim") {
    fanSecili.evren = e.id;
    return '<div class="fan-form kutu-y" data-fan-form="evren" data-fan-hedef="' + kacir(e.id) + '">' + fanEvrenFormHtml(e, true) + "</div>" +
      (typeof konukDuzenleyiciHtml === "function" ? konukDuzenleyiciHtml(e) : "") +
      '<p class="oyun-not" data-fan-kayit="evren">Her şey bu cihaza (hesabın varsa hesabına da) kaydediliyor.</p>' +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-fan-indir="evren">Dosya olarak indir</button>' +
        '<button class="dugme dugme-sade" data-fan-paylas="evren">Paylaş</button>' +
        '<button class="dugme dugme-sade" data-fan-gonder="evren">Yazara gönder</button>' +
      "</div><div data-fan-gonder-alan=\"evren\"></div>";
  }
  if (EVS.kaynak === "site") {
    return '<div class="fan-oku">' + fanEserGovde(e, false) + "</div>" + kanonEvrenIcerigi(EVS.id) +
      (EVS.id === "e25" && typeof e25KisilerHtml === "function" ? e25KisilerHtml() : "") +
      (v.duzenle ? '<p class="oyun-not">Bu bilgileri düzenlemek için: Sen → Yönetici → İçerik → Listeler → ' + kacir(e.ad) +
        ". Karakterlerin ve evren maddelerinin hangi evrende görüneceği, panelde kaydın “Hangi evrende” alanından. Sonra Kaydet.</p>" : "");
  }
  if (EVS.kaynak === "fan" || EVS.kaynak === "acilan") {
    return '<div class="fan-oku">' + fanEserGovde(e, false) + "</div>" +
      '<div class="oyun-sira"><button class="dugme" data-evs-kopyala>Kopyala ve kendi evrenim yap</button></div>';
  }
  /* E99 */
  const katki = v.katki;
  const yayinBos = !veri.e99 || e99KatkiBosMu(Object.assign({}, veri.e99, { ozet: "" }));
  const gonderilen = e99GonderilenleriTemizle();
  return '<div class="fan-oku">' + (yayinBos
      ? '<p class="oyun-giris">' + kacir((veri.e99 && veri.e99.ozet) || "") + "</p><p class=\"oyun-not\">Henüz yayında bir şey yok. İlk kuralı sen yaz.</p>"
      : fanEserGovde(veri.e99, false)) + "</div>" +
    '<div class="kutu-y e99-katki"><div class="oyun-etiket">Senin katkın · yalnızca bu cihazda</div>' +
      '<p class="oyun-not">Yazdıkların yalnızca bu cihazda durur; hiçbir sunucuya gitmez. Gönder dediğinde bir dosya hazırlanır ve e-postanla yazara gönderirsin. ' +
        "Yazar onaylayıp yayınlarsa E99'a herkes için eklenir.</p>" +
      '<div class="fan-form" data-fan-form="evren" data-fan-hedef="' + E99_KATKI_ID + '">' + fanEvrenFormHtml(katki, false) + "</div>" +
      '<div class="oyun-sira"><button class="dugme" data-e99-gonder>Dosya hazırla ve yazara gönder</button></div>' +
      '<p class="pencere-durum" id="e99Durum" role="status"></p>' +
      (e99SonGonderilen && e99GonderilenBul(e99SonGonderilen) ? e99EpostaHtml(e99GonderilenBul(e99SonGonderilen)) : "") +
    "</div>" +
    (gonderilen.length ? '<div class="kutu-y"><div class="oyun-etiket">Gönderdiklerin</div><ul class="e99-gonderilen">' +
      gonderilen.map(function (g) {
        return "<li>" + kacir(new Date(g.t).toLocaleDateString("tr-TR")) + " · " +
          "yazarın onayını bekliyor · " + e99Ozet(g.veri || {}) +
          ' <button class="e99-mini" data-e99-paylas="' + kacir(g.id) + '">Gönder</button>' +
          ' <button class="e99-mini" data-e99-indir="' + kacir(g.id) + '">İndir</button></li>';
      }).join("") + "</ul></div>" : "");
}

function e99OzetDuz(v) {
  const p = [];
  FAN_EVREN_GRUPLARI.forEach(function (g) { const n = (v[g.k] || []).length; if (n) { p.push(n + " " + g.tekil); } });
  const y = ((v.harita || {}).yerler || []).length;
  if (y) { p.push(y + " harita yeri"); }
  return p.join(", ") || "boş";
}

function e99Ozet(v) { return kacir(e99OzetDuz(v)); }

/** Katkıdan gönderilecek dosyanın eserini kurar: boş satırlar atılır, kimliği "e99k" ile başlar. */
function e99DosyaEseri(katki) {
  const t = fanTemizle(Object.assign({}, katki, { id: "e99k" + fanId().slice(1), ad: "E99 katkısı" }));
  FAN_EVREN_GRUPLARI.forEach(function (g) {
    t[g.k] = (t[g.k] || []).filter(function (x) { return Object.keys(x).some(function (k) { return String(x[k] || "").trim(); }); });
  });
  t.olusturma = new Date().toISOString();
  return t;
}

function e99GonderilenBul(id) {
  return e99Gonderilenler().find(function (g) { return g.id === id; }) || null;
}

/** Dosyayı e-postayla gönderme adımları (sunucu yok: dosya kişinin e-postasından yazara gider). */
function e99EpostaHtml(g) {
  const adres = fanEposta();
  if (!adres) {
    return '<p class="oyun-not">Yazar henüz bir gönderim adresi tanımlamadı. Dosya bu cihazda duruyor; aşağıdan tekrar indirip yazara ulaştırabilirsin.</p>';
  }
  const govde = "Merhaba,\n\nE99 için bir katkı gönderiyorum (" + e99OzetDuz(g.veri || {}) + "). Dosya ekte.\n\n";
  return '<p class="oyun-not">Alıcı: <b class="fan-adres">' + kacir(adres) + "</b>. Paylaş menüsünde e-posta uygulamasını seçersen dosya ekli gider; " +
      "“E-postayı aç” bağlantısı dosyayı kendisi ekleyemez, indirdiğin dosyayı sen eklersin.</p>" +
    '<div class="oyun-sira">' +
      '<button class="dugme" data-e99-paylas="' + kacir(g.id) + '">Dosyayla e-posta at</button>' +
      '<a class="dugme dugme-sade" href="mailto:' + adres + "?subject=" + encodeURIComponent("TentiforApp E99 katkısı") + "&body=" + encodeURIComponent(govde) + '">E-postayı aç</a>' +
      '<button class="dugme dugme-sade" data-fan-adres-kopyala>Adresi kopyala</button>' +
    "</div>";
}

let e99SonGonderilen = null;   /* az önce hazırlanan dosyanın kimliği: gönderme adımları onun için gösterilir */

async function e99Gonder() {
  fanBekleyeniYaz();
  const katki = e99Katki();
  if (e99KatkiBosMu(katki)) { e99DurumYaz("Önce bir şey yaz.", false); return; }
  const e = e99DosyaEseri(katki);
  const l = e99Gonderilenler();
  l.unshift({ id: e.id, t: Date.now(), durum: "gonderildi", veri: e });
  jsonYaz(E99_GONDERILEN_ANAHTAR, l.slice(0, 30));
  /* katkı sıfırlanır; dosyası "Gönderdiklerin"de durur */
  const t = fanEserlerim();
  const k = t.find(function (x) { return x.id === E99_KATKI_ID; });
  FAN_EVREN_GRUPLARI.forEach(function (g) { k[g.k] = []; });
  k.ozet = "";
  k.harita = { yerler: [] };
  fanEserlerimYaz(t);
  e99SonGonderilen = e.id;
  /* paylaşım menüsü dokunuşun hemen ardından açılmalı (tarayıcı izni) */
  const s = await fanPaylas(e, "E99 katkısı — TentiforApp" + (fanEposta() ? ". Alıcı: " + fanEposta() : ""));
  evrenSayfaCiz();
  e99DurumYaz((s ? s + ". " : "") + "Yazar dosyayı açıp onaylarsa E99'da herkes görecek.", true);
}

function e99DurumYaz(m, iyi) {
  const d = document.querySelector("#e99Durum");
  if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); }
}

/* ==================== panel: E99 katkıları ve Yayınla ==================== */

let yE99Dosya = null;

function yoneticiE99() {
  if (!(typeof yoneticiAcik === "function" && yoneticiAcik())) { return '<p class="oyun-not">Bu sekme yalnızca tam yöneticiye açık.</p>'; }
  const e = veri.e99 || {};
  return '<p class="oyun-not">Okurlar E99 katkılarını dosya olarak e-postana gönderir (gönderim adresi: İçerik → Listeler → Site ayarları). ' +
      "Gelen dosyayı burada aç; beğenirsen E99'a ekle, sonra <b>Kaydet</b> ve <b>Yayınla</b>. " +
      "Dosyayı telefonda doğrudan TentiforApp ile ya da Fan → Aç ile açarsan orada da “E99'a ekle” düğmesi çıkar. " +
      "Yayındaki E99'dan bir şeyi çıkarmak için İçerik → Listeler → E99.</p>" +
    '<p class="oyun-not">Yayındaki E99: ' + e99Ozet(e) + " · eklenen katkı: " + ((e.oneriler || []).length) + "</p>" +
    '<div class="kutu-y"><label for="yE99Dosya">Gelen katkı dosyası</label>' +
      '<input type="file" id="yE99Dosya" accept=".html,.htm,.json,text/html,application/json"></div>' +
    '<div id="yE99Alan">' + yoneticiE99Onizleme() + "</div>";
}

function yoneticiE99Onizleme() {
  const e = yE99Dosya;
  if (!e) { return ""; }
  const ekli = ((veri.e99 && veri.e99.oneriler) || []).indexOf(e.id) !== -1;
  return '<div class="kutu-y y-e99">' +
    '<div class="oyun-etiket">' + kacir(e.yazar || "İmzasız") + (e.olusturma ? " · " + kacir(new Date(e.olusturma).toLocaleString("tr-TR")) : "") + " · " + e99Ozet(e) + "</div>" +
    '<div class="fan-oku">' + fanEserGovde(e, false) + "</div>" +
    '<div class="oyun-sira">' + (ekli ? '<p class="oyun-not">Bu katkı zaten E99\'da.</p>'
      : '<button class="dugme" data-y-e99-onay>Onayla ve E99\'a ekle</button><button class="dugme dugme-sade" data-y-e99-red>Vazgeç</button>') +
    "</div></div>";
}

/** Onaylanan katkıyı veri.e99'a ekler (katkının dosya kimliğiyle; aynı dosya iki kez eklenmez). */
function e99Birlestir(t) {
  if (!t) { return false; }
  if (!veri.e99) { veri.e99 = { bicim: FAN_BICIM, surum: 1, tur: "evren", id: "e99", ad: "E99", harita: { yerler: [] }, oneriler: [] }; }
  const e = veri.e99;
  if (!Array.isArray(e.oneriler)) { e.oneriler = []; }
  if (e.oneriler.indexOf(t.id) !== -1) { return false; }
  FAN_EVREN_GRUPLARI.forEach(function (g) {
    const eklenecek = (t[g.k] || []).filter(function (x) { return Object.keys(x).some(function (k) { return String(x[k] || "").trim(); }); });
    e[g.k] = (e[g.k] || []).concat(eklenecek);
  });
  if (t.ozet && String(t.ozet).trim()) { e.ozet = (e.ozet ? e.ozet + "\n\n" : "") + t.ozet; }
  if (!e.harita) { e.harita = { yerler: [] }; }
  ((t.harita || {}).yerler || []).forEach(function (y) {
    const k = JSON.parse(JSON.stringify(y));
    k.id = "e99_" + t.id + "_" + y.id;
    e.harita.yerler.push(k);
  });
  e.oneriler.push(t.id);
  return true;
}

function yoneticiYayinla() {
  if (!(typeof yoneticiAcik === "function" && yoneticiAcik())) { return '<p class="oyun-not">Bu sekme yalnızca tam yöneticiye açık.</p>'; }
  const kanca = kayitOku(YAYIN_KANCA_ANAHTAR) || "";
  return '<div class="kutu-y"><label>Siteyi yayınla</label>' +
    '<p class="oyun-not">Cloudflare\'de otomatik yayın kapalıysa GitHub\'a giden hiçbir değişiklik (Kaydet, E99 onayları, kod güncellemeleri) sen buna basmadan siteye çıkmaz.</p>' +
    '<button class="dugme" data-y-yayinla' + (kanca ? "" : " disabled") + ">Siteyi şimdi yayınla</button>" +
    '<p class="pencere-durum" id="yYayinDurum" role="status"></p></div>' +
    '<div class="kutu-y"><label for="yYayinKanca">Yayın bağlantısı (Cloudflare deploy hook)</label>' +
    '<p class="oyun-not">Cloudflare → Pages → tentiforapp → Settings → Builds → <b>Deploy hooks</b> → Add → dal <b>main</b> → oluşan adresi buraya yapıştır. ' +
      "Bu adres yalnızca bu cihazda saklanır; kimseyle paylaşma (bilen biri yayın başlatabilir).</p>" +
    '<input class="kod-giris arac-giris" id="yYayinKanca" type="url" value="' + kacir(kanca) + '" placeholder="https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/…" autocomplete="off">' +
    '<button class="dugme dugme-sade" data-y-yayin-kaydet>Kaydet</button></div>' +
    '<div class="kutu-y"><label>Otomatik yayını kapatmak</label>' +
    '<p class="oyun-not">Cloudflare → Pages → tentiforapp → Settings → Builds → <b>Branch control</b> → "Enable automatic production branch deployments" işaretini kaldır → Save. ' +
      "Preview branches: None.</p></div>";
}

function yayinKancasiGecerli(u) {
  return /^https:\/\/api\.cloudflare\.com\/client\/v4\/pages\/webhooks\/deploy_hooks\/[A-Za-z0-9_-]+$/.test(String(u || "").trim());
}

async function siteyiYayinla() {
  const d = document.querySelector("#yYayinDurum");
  const kanca = kayitOku(YAYIN_KANCA_ANAHTAR) || "";
  if (!yayinKancasiGecerli(kanca)) { if (d) { d.textContent = "Önce geçerli bir yayın bağlantısı kaydet."; } return; }
  if (d) { d.textContent = "Gönderiliyor…"; d.className = "pencere-durum"; }
  try {
    /* Cloudflare bu uca tarayıcıdan gelen isteğe CORS izni vermiyor; istek gider ama yanıt okunamaz */
    await fetch(kanca, { method: "POST", mode: "no-cors" });
    if (d) { d.textContent = "Yayın başlatıldı. 1–2 dakika içinde site güncellenir (Cloudflare → Deployments'ta görünür)."; d.className = "pencere-durum iyi"; }
  } catch (e) {
    if (d) { d.textContent = "Gönderilemedi: " + ((e && e.message) || e); d.className = "pencere-durum kotu"; }
  }
}

/* ==================== olaylar ve yönlendirme ==================== */

/** #/ev/benim/<id> · #/ev/fan/<id> · #/ev/acilan/<id> · #/ev/e99 */
function evrenAdresiAc() {
  const m = rota().match(/^#\/ev\/([a-z0-9]+)(?:\/([\w-]+))?/);
  if (!m) { if (document.querySelector("#evrenSayfa")) { const s = document.querySelector("#evrenSayfa"); s.remove(); document.documentElement.classList.remove("evren-acik"); EVS = null; } return; }
  if (typeof veri === "undefined" || !veri) { return; }
  evrenSayfaAc(m[1], m[2] || "");
  if (!EVS) {
    if (typeof hataSayfasiAc === "function") { hataSayfasiAc(rota().slice(2)); }
    return;
  }
}

window.addEventListener("hashchange", function () { evrenSeciciKapat(); evrenAdresiAc(); });

document.addEventListener("click", async function (ev) {
  const h = ev.target.closest("[data-evren-sec], #evrenSecBtn, [data-evren-git], [data-es-kapat], [data-es-yeni], .es-katman, " +
    "[data-evs-kapat], [data-evs-kod], [data-evs-sekme], [data-evs-kopyala], [data-evh-mod], [data-evh-bitir], [data-evh-iptal], [data-evh-sil], " +
    "[data-e99-gonder], [data-e99-paylas], [data-e99-indir], [data-y-e99-onay], [data-y-e99-red], [data-y-yayinla], [data-y-yayin-kaydet]");
  if (!h) { return; }
  const d = h.dataset;
  if (h.classList.contains("es-katman")) { if (ev.target === h) { evrenSeciciKapat(); } return; }
  if (h.id === "evrenSecBtn" || h.hasAttribute("data-evren-sec")) { evrenSeciciAc(); return; }
  if (d.evrenGit) { evrenGit(d.evrenGit); return; }
  if (h.hasAttribute("data-es-kapat")) { evrenSeciciKapat(); return; }
  if (h.hasAttribute("data-es-yeni")) { const id = evrenYeniKur(); evrenSonrakiSekme = "bilgi"; evrenGit("#/ev/benim/" + id); return; }
  if (h.hasAttribute("data-evs-kapat")) { evrenSayfaKapat(); return; }
  if (h.hasAttribute("data-evs-kod")) { const b = document.querySelector("#btnKod"); if (b) { b.click(); } return; }
  if (d.evsSekme) { fanBekleyeniYaz(); EVS.sekme = d.evsSekme; EVS.mod = "sec"; EVS.cizim = []; evrenSayfaCiz(); return; }
  if (h.hasAttribute("data-evs-kopyala")) {
    const v = evrenSayfaVerisi();
    const l = fanEserlerim();
    const kopya = JSON.parse(JSON.stringify(v.eser));
    kopya.id = fanId();
    kopya.guncelleme = new Date().toISOString();
    delete kopya.eklenme; delete kopya.oneriler;
    /* kilitli lore ve evren yönetici kodu kaynak evrene aittir: başka evrende çalışmaz */
    delete kopya.lorlar; delete kopya.yoneticiOzet;
    l.push(kopya);
    fanEserlerimYaz(l);
    location.hash = "#/ev/benim/" + kopya.id;
    return;
  }
  if (d.evhMod) { EVS.mod = d.evhMod; EVS.cizim = []; if (d.evhMod !== "sec") { EVS.secili = null; } evrenSayfaCiz(); return; }
  if (h.hasAttribute("data-evh-iptal")) { EVS.mod = "sec"; EVS.cizim = []; evrenSayfaCiz(); return; }
  if (h.hasAttribute("data-evh-bitir")) {
    if (EVS.cizim.length < 3) { return; }
    const nok = EVS.cizim.slice();
    const mx = nok.reduce(function (s, n) { return s + n[0]; }, 0) / nok.length, my = nok.reduce(function (s, n) { return s + n[1]; }, 0) / nok.length;
    const id = "a" + Date.now().toString(36);
    evrenHaritaDegistir(function (hh) { hh.yerler.push({ id: id, ad: "Yeni bölge", tur: "Kıta", not: "", x: Math.round(mx * 100) / 100, y: Math.round(my * 100) / 100, sekil: nok }); });
    EVS.mod = "sec"; EVS.cizim = []; EVS.secili = id;
    evrenSayfaCiz();
    return;
  }
  if (h.hasAttribute("data-evh-sil")) {
    const id = EVS.secili;
    evrenHaritaDegistir(function (hh) { hh.yerler = hh.yerler.filter(function (y) { return y.id !== id; }); });
    EVS.secili = null;
    evrenSayfaCiz();
    return;
  }
  if (h.hasAttribute("data-e99-gonder")) { h.disabled = true; try { await e99Gonder(); } finally { h.disabled = false; } return; }
  if (h.hasAttribute("data-y-e99-onay")) {
    const ok = e99Birlestir(yE99Dosya);
    if (typeof yoneticiDurum === "function") { yoneticiDurum(ok ? "E99'a eklendi — herkesin görmesi için Kaydet, sonra Yayınla" : "Bu katkı zaten E99'da", ok); }
    yE99Dosya = null;
    if (typeof yoneticiCiz === "function") { yoneticiCiz(); }
    return;
  }
  if (h.hasAttribute("data-y-e99-red")) { yE99Dosya = null; const a = document.querySelector("#yE99Alan"); if (a) { a.innerHTML = ""; } return; }
  if (d.e99Paylas || d.e99Indir) {
    const g = e99GonderilenBul(d.e99Paylas || d.e99Indir);
    if (!g) { return; }
    if (d.e99Indir) { fanIndir(g.veri); return; }
    const m = await fanPaylas(g.veri, "E99 katkısı — TentiforApp" + (fanEposta() ? ". Alıcı: " + fanEposta() : ""));
    if (m) { e99DurumYaz(m, true); }
    return;
  }
  if (h.hasAttribute("data-y-yayin-kaydet")) {
    const u = ((document.querySelector("#yYayinKanca") || {}).value || "").trim();
    if (u && !yayinKancasiGecerli(u)) { if (typeof yoneticiDurum === "function") { yoneticiDurum("Bu bir Cloudflare deploy hook adresi değil", false); } return; }
    kayitYaz(YAYIN_KANCA_ANAHTAR, u);
    if (typeof yoneticiCiz === "function") { yoneticiCiz(); }
    if (typeof yoneticiDurum === "function") { yoneticiDurum(u ? "Yayın bağlantısı bu cihaza kaydedildi" : "Yayın bağlantısı silindi", true); }
    return;
  }
  if (h.hasAttribute("data-y-yayinla")) { siteyiYayinla(); }
});

document.addEventListener("change", async function (ev) {
  if (!ev.target || ev.target.id !== "yE99Dosya") { return; }
  const alan = document.querySelector("#yE99Alan");
  try {
    const e = await fanDosyaOku(ev.target.files && ev.target.files[0]);
    if (e.tur !== "evren") { throw new Error("Bu bir evren dosyası değil"); }
    yE99Dosya = e;
    if (alan) { alan.innerHTML = yoneticiE99Onizleme(); }
  } catch (hata) {
    yE99Dosya = null;
    if (alan) { alan.innerHTML = '<p class="pencere-durum kotu">' + kacir((hata && hata.message) || "Açılamadı") + "</p>"; }
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") { return; }
  if (document.querySelector("#evrenSecici")) { evrenSeciciKapat(); return; }
  if (EVS && EVS.mod === "cizim") { EVS.mod = "sec"; EVS.cizim = []; evrenSayfaCiz(); return; }
  if (document.querySelector("#evrenSayfa") && !document.querySelector("#perde:not([hidden])")) { evrenSayfaKapat(); }
});

/* Fan editöründe grup ekleme/çıkarma fanCiz("evren") çağırır: açık evren sayfası da tazelensin */
(function () {
  const eski = window.fanCiz;
  if (typeof eski !== "function") { return; }
  window.fanCiz = function (tur) {
    const r = eski.apply(this, arguments);
    if (tur === "evren" && EVS && EVS.sekme === "bilgi") { try { evrenSayfaCiz(); } catch (e) { /* sayfa kapanmış */ } }
    return r;
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  evrenDugmesiKur();
  /* veri gelince adresteki evren sayfası açılsın */
  if (rota().indexOf("#/ev/") === 0) {
    const bekle = setInterval(function () {
      if (typeof veri !== "undefined" && veri) { clearInterval(bekle); evrenAdresiAc(); }
    }, 100);
    setTimeout(function () { clearInterval(bekle); }, 15000);
  }
});
