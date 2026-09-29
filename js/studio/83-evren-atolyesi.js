/* Sürüm 3.0 — evren atölyesi: kanon ve fan-made evrenler.

   Her evrenin bir statüsü var:
   - Kanon: sitenin kendi evrenleri (Tömye, E25, E26, E99, Claude'un evreni) ve yöneticinin kanona aldığı fan evrenleri
     (veri.fanEserleri.evrenler[i].kanon === true). Kanon evrende isteyen istediği gibi fan hikâyesi ve Evrengezer
     hikâyesi yazar.
   - Fan-made: kişinin kendi kurallarıyla ayrı evreni. Evrengezerleri (E25 kişileri) buraya yalnızca evrenin sahibi ve
     evrenin yönetici kodunu girmiş yetkililer getirir. Sahibi isterse başkalarının bu evrende hikâye yazmasını da kapatır.
   Kurucu "Paylaş" adımında seçer: ayrı bir fan-made evren mi, kanona katılmaya aday mı (yazara gönderir; yönetici
   onaylayıp kanona alır). Kurallar sitede uygulanır: Evrengezer götürme, hikâye dosyası indirme, paylaşma, gönderme. */

const EVA_DURUMLAR = ["fan", "kanonAday"];

/* ==================== statü ==================== */

function evaAd(s) { return String(s || "").trim().toLocaleLowerCase("tr"); }

/** Test evreni: Claude'un Evreni kanon değil; sitenin özelliklerinin denendiği ve gösterildiği evren. */
function evaTestAdlari() {
  const l = ["claude'un evreni", "şomdo", "claude"];
  (veri.haritalar || []).forEach(function (h) { if (h && h.id === "claude" && h.ad) { l.push(evaAd(h.ad)); } });
  if (veri.claudeEvreni && veri.claudeEvreni.ad) { l.push(evaAd(veri.claudeEvreni.ad)); }
  return l;
}

/** Sitenin kendi evrenleri: her zaman kanon (test evreni hariç). */
function evaKanonAdlari() {
  const l = ["tömye", "24. evren", "e24", "e99"];
  (veri.haritalar || []).forEach(function (h) { if (h && h.ad && h.id !== "claude") { l.push(evaAd(h.ad)); } });
  Object.keys(veri.kanonEvrenleri || {}).forEach(function (id) { l.push(id); l.push(evaAd((veri.kanonEvrenleri[id] || {}).ad)); });
  const test = evaTestAdlari();
  return l.filter(function (x) { return x && test.indexOf(x) === -1; });
}

/** Bir hikâyenin "Hangi evrende geçiyor?" alanından evrenin statüsü.
    { tur: "kanon" | "test" | "benim" | "fan" | "serbest", ad, id, eser, test } — test: sitenin örnek (test) fan evreni */
function evaStatu(ad) {
  const a = evaAd(ad);
  if (!a) { return { tur: "serbest", ad: "" }; }
  const benim = (typeof fanEserlerim === "function" ? fanEserlerim() : []).find(function (x) { return x.tur === "evren" && !x.e99 && evaAd(x.ad) === a; });
  if (benim) { return { tur: "benim", ad: benim.ad, id: benim.id, eser: benim }; }
  if (evaTestAdlari().indexOf(a) !== -1) { return { tur: "test", ad: ad }; }
  if (evaKanonAdlari().indexOf(a) !== -1) { return { tur: "kanon", ad: ad }; }
  const site = (typeof fanSiteListesi === "function" ? fanSiteListesi("evren") : []).find(function (x) { return evaAd(x.ad) === a; });
  if (site) { return { tur: site.kanon === true ? "kanon" : "fan", ad: site.ad, id: site.id, eser: site, test: site.test === true && site.kanon !== true }; }
  return { tur: "serbest", ad: ad };
}

/** Bu cihazda bu evrenin yetkilisi mi (evren yönetici kodu girildi)? */
/** Bu fan-made evrene Evrengezer getirebilir mi: evren yöneticisi ya da Evrengezer izni kodu (84). */
function evaYetkili(s) { return !!(s && s.id && (evy25Acik(s.id) || evrEgIzinVar(s.id))); }

/** Evrengezer (konuk kişi) bu evrende yer alabilir mi? */
function evaEvrengezerIzni(ad) {
  const s = evaStatu(ad);
  if (s.tur !== "fan" || evaYetkili(s)) { return { izin: true, statu: s }; }
  return { izin: false, statu: s, neden: "“" + s.ad + "” fan-made bir evren: Evrengezerleri buraya yalnızca evrenin sahibi ve yetkilileri getirebilir. " +
    "Evrengezer hikâyeni bir kanon evrende (Tömye, E25, E26…) ya da kendi evreninde yazabilirsin." };
}

/** Bu evrende hikâye yazılabilir mi? */
function evaHikayeIzni(ad) {
  const s = evaStatu(ad);
  if (s.tur === "fan" && s.eser && s.eser.izinler && s.eser.izinler.hikaye === "sahip" && !evaYetkili(s)) {
    return { izin: false, statu: s, neden: "“" + s.ad + "” evreninin sahibi bu evrende yalnızca kendisinin hikâye yazmasını istiyor." };
  }
  return { izin: true, statu: s };
}

/** Bir hikâye eseri kurallara uyuyor mu? Uymuyorsa neden. */
function evaHikayeDenetle(h) {
  if (!h || h.tur !== "hikaye") { return ""; }
  const hk = evaHikayeIzni(h.evren);
  if (!hk.izin) { return hk.neden; }
  if ((h.konuklar || []).length) { const g = evaEvrengezerIzni(h.evren); if (!g.izin) { return g.neden; } }
  return "";
}

function evaStatuRozeti(s) {
  if (s.tur === "kanon") { return '<span class="eva-rozet kanon">Kanon</span>'; }
  if (s.tur === "test") { return '<span class="eva-rozet test">Test</span>'; }
  if (s.tur === "fan") { return s.test ? '<span class="eva-rozet test">Test · fan-made</span>' : '<span class="eva-rozet fan">Fan-made</span>'; }
  if (s.tur === "benim") { return '<span class="eva-rozet benim">Senin evrenin</span>'; }
  return "";
}

function evaStatuNotu(ad) {
  const s = evaStatu(ad);
  if (s.tur === "kanon") { return evaStatuRozeti(s) + " Kanon evren: herkes hikâye ve Evrengezer hikâyesi yazabilir."; }
  if (s.tur === "benim") { return evaStatuRozeti(s) + " Senin evrenin: istediğin Evrengezeri getirebilirsin."; }
  if (s.tur === "test") { return evaStatuRozeti(s) + " Test evreni: sitenin özelliklerinin denendiği ve gösterildiği evren, kanon değil. Deneme hikâyesi ve Evrengezer hikâyesi yazabilirsin."; }
  if (s.tur === "fan") {
    const y = evaYetkili(s);
    return evaStatuRozeti(s) + (s.test ? " Örnek (test) fan-made evren" : " Fan-made evren") + (y ? " (yetkilisisin): Evrengezer getirebilirsin." : ": Evrengezerleri yalnızca sahibi ve yetkilileri getirebilir.") +
      (!evaHikayeIzni(ad).izin ? " Sahibi başkalarının hikâye yazmasını kapattı." : "");
  }
  return "";
}

/* ==================== Evrengezer götürme ==================== */

/* hikâye düzenleyicisinde: seçilen evrenin kuralı evren alanının hemen altında */
function evaHikayeNotuYaz() {
  const g = document.querySelector('[data-fan-form="hikaye"] [data-fan-alan="evren"]');
  if (!g) { return; }
  let n = g.parentNode.querySelector(".eva-not");
  if (!n) { n = document.createElement("p"); n.className = "oyun-not eva-not"; n.setAttribute("aria-live", "polite"); g.insertAdjacentElement("afterend", n); }
  const e = typeof fanDuzenlenen === "function" ? fanDuzenlenen("hikaye") : null;
  const h = Object.assign({}, e || {}, { tur: "hikaye", evren: g.value });
  const sorun = evaHikayeDenetle(h);
  n.innerHTML = evaStatuNotu(g.value) + (sorun ? ' <b class="eva-uyari">' + kacir(sorun) + "</b>" : "");
}

document.addEventListener("input", function (ev) {
  if (ev.target && ev.target.matches && ev.target.matches('[data-fan-form="hikaye"] [data-fan-alan="evren"]')) { evaHikayeNotuYaz(); }
});

/* ==================== evren sayfası ==================== */

/** Bu evrende yeni bir hikâye başlatır ve hikâye düzenleyicisine götürür. */
function evaHikayeBaslat(ad) {
  const hk = evaHikayeIzni(ad);
  if (!hk.izin) { if (typeof eckaBildir === "function") { eckaBildir(hk.neden); } return; }
  const e = fanYeni("hikaye");
  if (!e) { return; }
  const l = fanEserlerim();
  const h = l.find(function (x) { return x.id === e.id; });
  if (h) { h.evren = ad; fanEserlerimYaz(l); }
  fanSecili.hikaye = e.id; fanSekme.hikaye = "yaz";
  if (typeof evrenSayfaKapat === "function") { evrenSayfaKapat(); }
  location.hash = "#/fan";
  setTimeout(function () { fanHikayeCiz(); const a = document.querySelector("#fanHikayeAlan"); if (a) { a.scrollIntoView({ block: "start" }); } }, 150);
}

function evaEvrenAdi(v) {
  if (!EVS) { return ""; }
  if (EVS.kaynak === "site") { const h = (veri.haritalar || []).find(function (x) { return x.id === EVS.id; }); return (h && h.ad) || (v.eser && v.eser.ad) || EVS.id.toUpperCase(); }
  if (EVS.kaynak === "e99") { return "E99"; }
  return (v.eser && v.eser.ad) || "";
}

function evaEylemHtml(v) {
  if (!EVS || ["site", "e99", "fan"].indexOf(EVS.kaynak) === -1 || v.kilitli || v.onizle) { return ""; }
  const ad = evaEvrenAdi(v);
  const s = EVS.kaynak === "fan" ? evaStatu(ad) : { tur: "kanon", ad: ad };
  const hk = evaHikayeIzni(ad);
  const yon = EVS.kaynak === "fan" && typeof yoneticiAcik === "function" && yoneticiAcik();
  return '<div class="kutu-y eva-eylem"><div class="eva-eylem-bas">' + evaStatuRozeti(s) + "<b>" + kacir(ad) + "</b></div>" +
    '<p class="oyun-not">' + (s.tur === "kanon"
      ? "Kanon evren: herkes burada fan hikâyesi ve Evrengezer hikâyesi yazabilir."
      : (s.test ? "Örnek (test) fan-made evren: sitenin özelliklerini göstermek için kuruldu, kanon değil. Kendi kuralları var; Evrengezerleri buraya yalnızca sahibi ve yetkilileri getirebilir."
        : "Fan-made evren: kendi kuralları var. Evrengezerleri buraya yalnızca sahibi ve yetkilileri getirebilir.")) + "</p>" +
    '<div class="oyun-sira">' +
      (hk.izin ? '<button class="dugme" data-eva-hikaye="' + kacir(ad) + '">✎ Bu evrende hikâye yaz</button>' : '<span class="oyun-not">' + kacir(hk.neden) + "</span>") +
      (s.tur === "kanon" ? '<button class="dugme dugme-sade" data-eva-evrengezer>Evrengezer getir</button>' : "") +
      (yon ? '<button class="dugme dugme-sade" data-eva-kanon="' + kacir(EVS.id) + '">' + (s.tur === "kanon" ? "Kanondan çıkar" : "Kanona al") + "</button>" : "") +
    "</div>" +
    /* fan-made evrende Evrengezer izni kodu */
    (s.tur === "fan" && !evaYetkili(s) && (s.eser && (s.eser.egIzinleri || []).length)
      ? '<details class="evr-izin-gir"><summary>Evrengezer izni kodun var mı?</summary><div class="oyun-sira"><input class="kod-giris" id="evrIzinKod" placeholder="EG-…" aria-label="Evrengezer izni kodu">' +
        '<button type="button" class="dugme dugme-sade" data-evr-izin-gir>Gir</button></div><p class="pencere-durum" id="evrIzinGirDurum" role="status"></p></details>'
      : (s.tur === "fan" && evaYetkili(s) ? '<p class="oyun-not">✓ Bu evrene Evrengezer getirme iznin var.</p>' : "")) +
    evrRafHtml(ad) +
    '<div class="oyun-sira">' + (EVS.kaynak === "fan" ? '<button type="button" class="dugme dugme-sade" data-evr-tur-ac>🧭 Evren turu</button>' : "") +
      '<button type="button" class="dugme dugme-sade" data-evr-kart="' + kacir(EVS.kaynak + ":" + EVS.id) + '">🖼 Evren kartı</button>' +
      /* okur evrenini şikâyet et (moderatörlere gider) */
      (EVS.kaynak === "fan" ? '<button class="dugme dugme-sade" data-evren-bildir="' + kacir(EVS.id) + '">Bildir</button>' : "") + "</div></div>";
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-eva-hikaye], [data-eva-evrengezer], [data-eva-kanon], [data-eva-durum], [data-eva-izin]");
  if (!b) { return; }
  if (b.hasAttribute("data-eva-hikaye")) { evaHikayeBaslat(b.getAttribute("data-eva-hikaye")); return; }
  if (b.hasAttribute("data-eva-evrengezer")) {
    /* Evrengezerler E25'te: oradan "Başka evrene götür" → kanon evrende yeni hikâye */
    if (typeof evrenSayfaKapat === "function") { evrenSayfaKapat(); }
    location.hash = "#/ev/site/e25";
    return;
  }
  if (b.hasAttribute("data-eva-kanon")) {
    if (typeof yoneticiAcik !== "function" || !yoneticiAcik()) { return; }
    const e = fanSiteListesi("evren").find(function (x) { return x.id === b.getAttribute("data-eva-kanon"); });
    if (!e) { return; }
    if (e.kanon === true) { delete e.kanon; } else { e.kanon = true; }
    if (typeof eckaBildir === "function") { eckaBildir((e.kanon ? "Kanona alındı: " : "Kanondan çıkarıldı: ") + e.ad + ". Kalıcı olması için panelden GitHub'a Kaydet."); }
    evrenSayfaCiz();
    return;
  }
  if (!EVS || EVS.kaynak !== "benim" || typeof evrenBenimDegistir !== "function") { return; }
  if (b.hasAttribute("data-eva-durum")) {
    const d = b.getAttribute("data-eva-durum");
    evrenBenimDegistir(EVS.id, function (e) { if (d === "fan") { delete e.durum; } else { e.durum = d; } });
    evrenSayfaCiz();
    return;
  }
  if (b.hasAttribute("data-eva-izin")) {
    const z = b.getAttribute("data-eva-izin");
    evrenBenimDegistir(EVS.id, function (e) { if (z === "sahip") { e.izinler = { hikaye: "sahip" }; } else { delete e.izinler; } });
    evrenSayfaCiz();
  }
});

/* Kurucu "Paylaş" adımı: evrenin yolu */
function evaYolHtml(e) {
  const d = e.durum === "kanonAday" ? "kanonAday" : "fan";
  const kapali = e.izinler && e.izinler.hikaye === "sahip";
  const secim = function (deger, baslik, not, secili, veri_) {
    return '<button type="button" class="eva-yol' + (secili ? " secili" : "") + '" ' + veri_ + '="' + deger + '" aria-pressed="' + secili + '"><b>' + baslik + "</b><span>" + not + "</span></button>";
  };
  return '<div class="eva-yollar"><h4>Evreninin yolu</h4><div class="eva-yol-liste">' +
      secim("fan", "Fan-made · ayrı evren", "Kendi kuralların, kendi evrenin. Evrengezerleri yalnızca sen ve yetkililerin getirir.", d === "fan", "data-eva-durum") +
      secim("kanonAday", "Kanona katılsın", "Yazara gönder; onaylanırsa kanon olur ve herkes burada hikâye ve Evrengezer hikâyesi yazabilir.", d === "kanonAday", "data-eva-durum") +
    "</div>" +
    (d === "fan" ? '<div class="eva-yol-liste">' +
      secim("herkes", "Herkes hikâye yazabilir", "Okurlar bu evrende fan hikâyesi yazabilir (Evrengezersiz).", !kapali, "data-eva-izin") +
      secim("sahip", "Hikâyeleri yalnızca ben yazarım", "Başkaları bu evrende hikâye yazamaz.", !!kapali, "data-eva-izin") + "</div>"
      : '<p class="oyun-not">Aşağıdaki “Yazara gönder” ile gönder; yazar onaylayıp yayınlarsa evrenin kanona girer.</p>') +
    "</div>";
}

/* ==================== Evren Atölyesi sayfası (#/atolye) ==================== */

function evaEvrenKarti(ad, alt, git, rozet, ek) {
  return '<div class="eva-kart">' + (rozet || "") + '<a class="eva-kart-ad" href="' + kacir(git) + '">' + kacir(ad || "Adsız evren") + "</a>" +
    (alt ? '<span class="oyun-not">' + alt + "</span>" : "") + (ek || "") + "</div>";
}

function evrenAtolyeCiz() {
  const alan = document.querySelector("#evrenAtolyeAlan");
  if (!alan || typeof veri === "undefined" || !veri) { return; }
  const benim = (typeof fanEserlerim === "function" ? fanEserlerim() : []).filter(function (e) { return e.tur === "evren" && !e.e99; });
  const site = typeof fanSiteListesi === "function" ? fanSiteListesi("evren") : [];
  const kanonSite = [];
  (veri.haritalar || []).forEach(function (h) {
    if (!h || h.ustEvren || h.id === "claude") { return; }
    const ilk = h.id === (veri.haritalar[0] || {}).id;
    kanonSite.push({ ad: ilk ? (h.evrenAdi || h.ad) + " · 24. Evren" : (h.evrenAdi || h.ad), hikaye: h.ad, git: ilk ? "#/arsiv" : ((veri.kanonEvrenleri || {})[h.id] ? "#/ev/site/" + h.id : "#/dunya") });
  });
  Object.keys(veri.kanonEvrenleri || {}).forEach(function (id) {
    if ((veri.haritalar || []).some(function (h) { return h.id === id; })) { return; }
    const k = veri.kanonEvrenleri[id];
    kanonSite.push({ ad: (k.ad || id.toUpperCase()) + (id === "e25" ? " · Evrengezerler" : ""), hikaye: k.ad || id.toUpperCase(), git: "#/ev/site/" + id });
  });
  if (veri.e99) { kanonSite.push({ ad: "E99 · herkesin evreni", hikaye: "E99", git: "#/ev/e99" }); }
  site.filter(function (e) { return e.kanon === true; }).forEach(function (e) { kanonSite.push({ ad: e.ad, hikaye: e.ad, git: "#/ev/fan/" + e.id }); });
  const fanMade = site.filter(function (e) { return e.kanon !== true && e.test !== true; });
  const testler = site.filter(function (e) { return e.kanon !== true && e.test === true; });
  const claude = (veri.haritalar || []).find(function (h) { return h && h.id === "claude"; });

  alan.innerHTML =
    '<div class="eva-bas">' +
      '<button class="dugme eva-yeni" data-es-yeni>+ Yeni evren kur</button>' +
      '<p class="oyun-not">Adım adım Kurucu açılır: Temel, Dünya, Kişiler, Zaman, Belgeler, Görünüm, Paylaş. Her şey bu cihaza (hesabın varsa hesabına da) kaydedilir.</p>' +
    "</div>" +
    '<div class="eva-kurallar">' +
      '<div class="eva-kural"><span class="eva-rozet kanon">Kanon</span><p>Sitenin evrenleri ve kanona alınan evrenler. <b>Herkes</b> burada fan hikâyesi ve Evrengezer hikâyesi yazabilir.</p></div>' +
      '<div class="eva-kural"><span class="eva-rozet fan">Fan-made</span><p>Kendi kurallarınla ayrı bir evren. Evrengezerleri buraya <b>yalnızca sen ve yetkililerin</b> (evren yönetici kodunu verdiklerin) getirir; istersen başkalarının hikâye yazmasını da kapatırsın.</p></div>' +
      '<div class="eva-kural"><span class="eva-rozet benim">Kanona katıl</span><p>Kurucu → Paylaş’ta “Kanona katılsın”ı seç ve yazara gönder. Onaylanırsa evrenin kanona girer.</p></div>' +
    "</div>" +
    "<h3 class=\"eva-bolum\">Senin evrenlerin" + (benim.length ? " · " + benim.length : "") + "</h3>" +
    (benim.length ? '<div class="eva-kartlar">' + benim.map(function (e) {
      const o = typeof evrOlcek === "function" ? evrOlcek(e) : null;
      return evaEvrenKarti(e.ad, (o ? "Tömye ölçeği %" + o.yuzde : "") + (e.durum === "kanonAday" ? " · kanona aday" : " · fan-made"), "#/ev/benim/" + e.id, evaStatuRozeti({ tur: "benim" }),
        '<button class="dugme dugme-sade y-kucuk" data-eva-kurucu="' + kacir(e.id) + '">🧭 Kurucu</button>');
    }).join("") + "</div>" : '<p class="oyun-not">Henüz bir evren kurmadın. İlk evrenin bir dakika sürer: bir ad, bir cümle, bir kural.</p>') +
    '<h3 class="eva-bolum">Kanon evrenler · burada herkes yazar</h3><div class="eva-kartlar">' + kanonSite.map(function (k) {
      return evaEvrenKarti(k.ad, "", k.git, evaStatuRozeti({ tur: "kanon" }), '<button class="dugme dugme-sade y-kucuk" data-eva-hikaye="' + kacir(k.hikaye) + '">✎ Hikâye yaz</button>');
    }).join("") + "</div>" +
    (fanMade.length ? '<h3 class="eva-bolum">Fan-made evrenler</h3><div class="eva-kartlar">' + fanMade.map(function (e) {
      const hk = evaHikayeIzni(e.ad);
      return evaEvrenKarti(e.ad, kacir([e.yazar, (e.kisiler || []).length ? (e.kisiler || []).length + " kişi" : ""].filter(Boolean).join(" · ")), "#/ev/fan/" + e.id, evaStatuRozeti({ tur: "fan" }),
        hk.izin ? '<button class="dugme dugme-sade y-kucuk" data-eva-hikaye="' + kacir(e.ad) + '">✎ Hikâye yaz</button>' : "");
    }).join("") + "</div>" : "") +
    ((claude || testler.length) ? '<h3 class="eva-bolum">Test evrenleri · özellikleri gör ve dene</h3>' +
      '<p class="oyun-not">Kanon değil: sitenin özelliklerinin denendiği ve gösterildiği evrenler. Bakıp öğren, kendi evreninde uygula.</p><div class="eva-kartlar">' +
      (claude ? evaEvrenKarti(claude.ad, "Test evreni", "#/claude", evaStatuRozeti({ tur: "test" }), '<button class="dugme dugme-sade y-kucuk" data-eva-hikaye="' + kacir(claude.ad) + '">✎ Deneme hikâyesi</button>') : "") +
      testler.map(function (e) { return evaEvrenKarti(e.ad, kacir(e.yazar || "örnek"), "#/ev/fan/" + e.id, evaStatuRozeti({ tur: "fan", test: true }), ""); }).join("") + "</div>" : "");
  /* evrenler arası geçitler (84) */
  const a = document.querySelector("#evrenAtolyeAlan");
  if (a && !a.querySelector(".evr-gecit, .evr-gecit-bos")) { a.insertAdjacentHTML("beforeend", '<h3 class="eva-bolum">Evrenler arası geçitler</h3><div class="evr-gecit-bos">' + evrGecitSvg() + "</div>"); }
}
if (typeof GEC_CIZILENLER !== "undefined") { GEC_CIZILENLER.evrenAtolye = "evrenAtolyeCiz"; }

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-eva-kurucu]");
  if (!b) { return; }
  const id = b.getAttribute("data-eva-kurucu");
  evrenSonrakiSekme = "kurucu";
  location.hash = "#/ev/benim/" + id;
});
/* sayfaya her gelişte güncel (kendi evrenlerin başka sayfada değişir) */
window.addEventListener("hashchange", function () { if (typeof rota === "function" && rota().indexOf("#/atolye") === 0) { setTimeout(evrenAtolyeCiz, 30); } });

