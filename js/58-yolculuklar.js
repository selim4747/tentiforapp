/* Sitenin kendi karakter listesi olan evrenlerinde karakterlerin gün gün yolculukları.
   Şimdilik Claude'un evreni (kanon dışı, özellikleri örnekleyen evren): yol doğrudan karakterde durur,
   claudeEvreni.kisiler[i].yol = [{ yer, gun, zaman, not }] (yer: evrenin haritasındaki yer).
   Yönetici karakter ekler ve yolunu çizer (Kaydet ile yayına girer); herkes gün gün izler.
   Pencere olarak açılır (#geziSayfa) ya da sayfaya gömülür (Claude'un evreni → Yolculuklar).
   Tömye'nin kanon karakterleri kendi yol aracını kullanır (harita → Yol çiz). */

let GZK = null;   /* { harita: id, secili: karakter sırası, kap: gömülüyse kabın seçicisi, kirli, durum } */

function gzkHarita(id) { return (veri.haritalar || []).find(function (x) { return x.id === id; }) || null; }

function gzkYonetici() { return typeof haritaYonetici === "function" && haritaYonetici(); }

/** Haritanın evrenine ait karakter listesi (yoksa null: o haritada yolculuk bölümü yok). */
function gzkKisiListesi(h) {
  const ce = veri.claudeEvreni;
  if (h && ce && ce.harita === h.id) { if (!Array.isArray(ce.kisiler)) { ce.kisiler = []; } return ce.kisiler; }
  return null;
}

/** Okurun görebildiği yer mi (kilitli ya da sisli yerler okura gösterilmez). */
function gzkYerGorunur(h, y) {
  if (!y) { return false; }
  if (gzkYonetici()) { return true; }
  return typeof haritaYerDurumu !== "function" || haritaYerDurumu(h, y, null) === "goster";
}

/** Çizelgedeki karakterler: okur yalnızca yolu olanları görür (gizli yerler atlanır), yönetici hepsini. */
function gzkKarakterler(h) {
  const l = gzkKisiListesi(h);
  if (!l) { return []; }
  const yon = gzkYonetici();
  return l.map(function (k, i) {
    const yol = (k.yol || []).filter(function (a) { return yon || gzkYerGorunur(h, (h.yerler || []).find(function (y) { return y.id === a.yer; })); });
    return { i: i, ad: k.ad || "Adsız", yol: yol };
  }).filter(function (x) { return yon || x.yol.length; });
}

function gzkBaglam() {
  const h = GZK && gzkHarita(GZK.harita);
  const liste = gzkKisiListesi(h);
  if (!h || !liste) { return null; }
  const yon = gzkYonetici();
  const l = gzkKarakterler(h);
  /* ilk açılışta yolu olan ilk karakter */
  if (l.length && !l.some(function (x) { return x.i === GZK.secili; })) {
    const yollu = l.find(function (x) { return x.yol.length; });
    GZK.secili = (yollu || l[0]).i;
  }
  const k = liste[GZK.secili];
  return {
    kisiler: l, secili: l.length ? GZK.secili : null, duzenle: yon,
    yerler: (h.yerler || []).filter(function (y) { return y.tur !== "Kıta" && gzkYerGorunur(h, y); }).map(function (y) { return { id: y.id, ad: y.ad, g: "" }; }),
    gruplar: [{ g: "", ad: h.ad }],
    yerBul: function (a) { const y = (h.yerler || []).find(function (x) { return x.id === a.yer; }); return gzkYerGorunur(h, y) ? y : null; },
    gAd: function () { return ""; },
    sec: function (i) { GZK.secili = i; },
    degistir: function (fn) {
      if (!yon) { return; }
      const kk = liste[GZK.secili];
      if (!kk) { return; }
      if (!Array.isArray(kk.yol)) { kk.yol = []; }
      fn(kk.yol);
      kk.yol.forEach(function (a) { delete a.g; });
      if (!kk.yol.length) { delete kk.yol; }
      gzkKirli();
    },
    ciz: gzkCiz,
    ustEk: yon ? '<button type="button" class="dugme dugme-sade" data-gzk-yeni>+ Karakter</button>' +
      (k ? '<div class="gzk-ad"><input class="kod-giris arac-giris" data-gzk-alan="ad" maxlength="60" value="' + kacir(k.ad || "") + '" aria-label="Karakterin adı" placeholder="Adı">' +
        '<input class="kod-giris arac-giris" data-gzk-alan="unvan" maxlength="80" value="' + kacir(k.unvan || "") + '" aria-label="Unvanı" placeholder="Unvanı (ör. Kervan önderi)"></div>' : "") : "",
    bos: yon ? "Bu evrende henüz karakter yok. “+ Karakter” ile ekle; sonra şehirlere gün gün dokun." : ""
  };
}

function gzkKirli() {
  GZK.kirli = (GZK.kirli || 0) + 1;
  GZK.durum = "";
  if (typeof yoneticiDurum === "function") { yoneticiDurum("Yolculuklar değişti — yayına almak için Kaydet, sonra Yayınla", true); }
}

function gzkKaydet() {
  if (typeof githubHazir === "function" && githubHazir() && location.protocol.indexOf("http") === 0 && typeof githubGonder === "function") {
    githubGonder();
    GZK.durum = "GitHub'a gönderiliyor… Bitince Panel → Bakım → Yayınla.";
  } else if (typeof yoneticiDisaAktar === "function") {
    yoneticiDisaAktar();
    GZK.durum = "veri.json indirildi ya da panoya kopyalandı.";
  }
  GZK.kirli = 0;
  gzkCiz();
}

function gzkAc(haritaId, kisi, gun, kap) {
  const h = gzkHarita(haritaId);
  if (!h || !gzkKisiListesi(h)) { return; }
  const eski = GZK;
  GZK = { harita: haritaId, secili: kisi === undefined || kisi === null ? -1 : kisi, kirli: eski && eski.harita === haritaId ? eski.kirli : 0, durum: "", kap: kap || null };
  GZ.bagla = gzkBaglam;
  const b = gzkBaglam();   /* seçili karakteri netleştirir */
  gzKimlik("kanon:" + haritaId + ":" + (b ? b.secili : ""));
  if (gun !== undefined && gun !== null) { GZ.gun = gun; }
  gzkCiz();
}

function gzkKapat() {
  gzOynatDurdur();
  GZ.gun = null;
  const s = document.querySelector("#geziSayfa");
  if (s) { s.remove(); }
  GZK = null;
  GZ.bagla = null;
  /* altta açık kalan harita paneli ve yer kartı tazelensin */
  try { if (typeof HT !== "undefined" && HT.kutu && HT.acik) { haritaPanelCiz(); haritaBilgiCiz(); } } catch (_) { /* yok */ }
  /* Claude'un evreni sayfası açıksa Yolculuklar sekmesi yeniden bağlansın */
  if (document.querySelector("#claudeEvrenAlan") && typeof claudeEvrenCiz === "function") { claudeEvrenCiz(); }
  if (typeof EVS !== "undefined" && EVS && document.querySelector("#evrenSayfa") && typeof evrenSayfaCiz === "function") { evrenSayfaCiz(); }
}

function gzkCiz() {
  if (!GZK) { return; }
  const h = gzkHarita(GZK.harita);
  if (!h) { gzkKapat(); return; }
  let s = GZK.kap ? document.querySelector(GZK.kap) : document.querySelector("#geziSayfa");
  if (GZK.kap && !s) { GZK = null; GZ.bagla = null; gzOynatDurdur(); return; }   /* gömülü olduğu sayfa kapandı */
  const b = gzkBaglam();
  if (!b) { return; }
  gzKimlik("kanon:" + GZK.harita + ":" + b.secili);
  GZ.bagla = gzkBaglam;
  if (!s) {
    s = document.createElement("div");
    s.id = "geziSayfa";
    s.className = "sehir-sayfa gezi-sayfa";
    s.setAttribute("role", "dialog");
    s.setAttribute("aria-modal", "true");
    s.setAttribute("aria-label", h.ad + " yolculukları");
    document.body.appendChild(s);
  }
  s.classList.add("gzk-kok");
  const gorunen = (h.yerler || []).filter(function (y) { return gzkYerGorunur(h, y); });
  window.__gzYol = gzNoktalar(b, "");
  let svg;
  try { svg = evrenHaritaSvg({ yerler: gorunen, renk: h.renk }, {}); } finally { window.__gzYol = null; }
  const kayar = s.scrollTop;
  s.innerHTML =
    (GZK.kap ? "" : '<div class="evs-ust"><button class="evs-ikon" data-gzk-kapat aria-label="Kapat" title="Kapat"><span aria-hidden="true">←</span></button>' +
      '<div class="evs-baslik"><span class="evs-rozet">Yolculuklar' + (b.duzenle ? " · düzenliyorsun" : "") + "</span><h2>" + kacir(h.ad) + "</h2></div></div>") +
    '<div class="' + (GZK.kap ? "gzk-gomulu" : "sh-govde") + '">' +
      (b.duzenle ? '<div class="gzk-kaydet"><span class="oyun-not">' + (GZK.durum ? kacir(GZK.durum) : (GZK.kirli ? "Kaydedilmemiş değişiklik var." : "Değişiklikler bu cihazda; yayına almak için Kaydet.")) + "</span>" +
        '<button type="button" class="dugme" data-gzk-kaydet>Kaydet' + (GZK.kirli ? " (" + GZK.kirli + ")" : "") + "</button></div>" : "") +
      '<div class="evh-kutu gzk-harita">' + svg + "</div>" +
      (b.duzenle ? '<p class="oyun-not">İpucu: haritadaki yerlere de dokunabilirsin.</p>' : "") +
      '<section class="gz-kutu" aria-label="Yolculuk çizelgesi">' + gzGovde(b) + "</section>" +
    "</div>";
  if (!GZK.kap) { s.scrollTop = kayar; }
}

/* ---------- olaylar ---------- */

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-gzk-ac], [data-gzk-kapat], [data-gzk-yeni], [data-gzk-kaydet]");
  if (!h) { return; }
  const d = h.dataset;
  if (d.gzkAc !== undefined) {
    ev.preventDefault();
    const hid = d.gzkAc || (typeof aktifHarita === "function" && aktifHarita() || {}).id;
    const kisi = d.gzkKisi !== undefined ? Number(d.gzkKisi) : null, gun = d.gzkGun !== undefined ? Number(d.gzkGun) : null;
    gzkAc(hid, kisi, gun, null);
    return;
  }
  if (!GZK) { return; }
  if (h.hasAttribute("data-gzk-kapat")) { gzkKapat(); return; }
  if (!gzkYonetici()) { return; }
  if (h.hasAttribute("data-gzk-kaydet")) { gzkKaydet(); return; }
  if (h.hasAttribute("data-gzk-yeni")) {
    const liste = gzkKisiListesi(gzkHarita(GZK.harita));
    if (!liste) { return; }
    liste.push({ id: "cl_" + Date.now().toString(36), ad: "Yeni karakter", unvan: "", ozet: "", detay: "", eklendi: new Date().toISOString().slice(0, 10) });
    GZK.secili = liste.length - 1;
    GZ.gun = null;
    gzkKirli(); gzkCiz();
    const a = document.querySelector('.gzk-kok [data-gzk-alan="ad"]');
    if (a) { a.focus(); a.select(); }
  }
});

document.addEventListener("input", function (ev) {
  const t = ev.target;
  if (!t || !t.matches || !t.matches(".gzk-kok [data-gzk-alan]") || !GZK || !gzkYonetici()) { return; }
  const k = (gzkKisiListesi(gzkHarita(GZK.harita)) || [])[GZK.secili];
  if (!k) { return; }
  const alan = t.dataset.gzkAlan;
  k[alan] = String(t.value).slice(0, alan === "ad" ? 60 : 80);
  GZK.kirli = GZK.kirli || 1;
  if (alan === "ad") {
    const o = document.querySelector('.gzk-kok [data-gz-kisi] option[value="' + GZK.secili + '"]');
    if (o) { o.textContent = (k.ad || "Adsız") + ((k.yol || []).length ? " (" + k.yol.length + ")" : ""); }
  }
});
document.addEventListener("change", function (ev) {
  const t = ev.target;
  if (t && t.matches && t.matches(".gzk-kok [data-gzk-alan]") && GZK && gzkYonetici()) { gzkKirli(); }
});

/* yönetici haritadaki yere dokununca adım (kıtalar hariç) */
document.addEventListener("click", function (ev) {
  const g = ev.target.closest && ev.target.closest(".gzk-kok .evh-svg [data-evh-yer]");
  if (!g || !GZK) { return; }
  const b = gzkBaglam();
  if (!b || !b.duzenle || b.secili === null) { return; }
  const id = g.getAttribute("data-evh-yer");
  if (!b.yerler.some(function (y) { return y.id === id; })) { return; }
  gzEkle(b, id, "");
  gzkCiz();
});

/* Esc yolculuk penceresini kapatır (altındaki harita açık kalır) */
window.addEventListener("keydown", function (e) {
  if (e.key !== "Escape" || !GZK || GZK.kap || !document.querySelector("#geziSayfa")) { return; }
  e.stopImmediatePropagation();
  e.preventDefault();
  gzkKapat();
}, true);

/* ---------- haritaya bağlantılar ---------- */

function gzkOzet(h) {
  const l = gzkKarakterler(h).filter(function (x) { return x.yol.length; });
  return l.length ? kacir(l.slice(0, 3).map(function (x) { return x.ad; }).join(", ")) + (l.length > 3 ? "…" : "") : "";
}

/* harita sayfası: önizlemenin altında */
if (typeof haritaCiz === "function") {
  const eskiHaritaCiz = haritaCiz;
  window.haritaCiz = function () {
    const r = eskiHaritaCiz.apply(this, arguments);
    const alan = document.querySelector("#haritaAlan");
    const h = typeof aktifHarita === "function" ? aktifHarita() : null;
    if (alan && h && gzkKisiListesi(h)) {
      const oz = gzkOzet(h);
      if (oz || gzkYonetici()) {
        alan.insertAdjacentHTML("beforeend", '<div class="gzk-satir"><button type="button" class="dugme dugme-sade gzk-ac" data-gzk-ac="' + kacir(h.id) + '">🧭 ' +
          (oz ? "Karakterlerin yolculukları: " + oz + " — gün gün izle" : "Karakterlere gün gün yolculuk çiz") + "</button></div>");
      }
    }
    return r;
  };
}

/* tam ekran harita: katman panelinde "Yolculuklar" bölümü */
if (typeof haritaPanelCiz === "function") {
  const eskiPanel = haritaPanelCiz;
  window.haritaPanelCiz = function () {
    const r = eskiPanel.apply(this, arguments);
    try {
      const el = HT.kutu && HT.kutu.querySelector("#htPanel");
      const h = aktifHarita();
      if (el && !el.hidden && h && gzkKisiListesi(h)) {
        const l = gzkKarakterler(h).filter(function (x) { return x.yol.length; });
        if (l.length || gzkYonetici()) {
          el.insertAdjacentHTML("beforeend", '<section class="hp-bolum gzk-panel"><b>Yolculuklar</b>' +
            (l.length ? '<div class="hp-alt">' + l.map(function (x) {
              const son = gzGunler(x.yol)[x.yol.length - 1];
              return '<button type="button" class="hp-mini" data-gzk-ac="' + kacir(h.id) + '" data-gzk-kisi="' + x.i + '">' + kacir(x.ad) + " · " + son + " gün</button>";
            }).join("") + "</div>" : "") +
            '<p class="hp-not">' + (l.length ? "Birine dokun: gün gün nereye gittiğini izle." : "Henüz yolculuk yok.") + "</p>" +
            (gzkYonetici() ? '<button type="button" class="hp-mini" data-gzk-ac="' + kacir(h.id) + '">Yolculukları düzenle</button>' : "") + "</section>");
        }
      }
    } catch (_) { /* harita kapalı */ }
    return r;
  };
}

/* yer kartı: buradan geçen karakterler, hangi günler */
if (typeof haritaBilgiCiz === "function") {
  const eskiBilgi = haritaBilgiCiz;
  window.haritaBilgiCiz = function () {
    const r = eskiBilgi.apply(this, arguments);
    try {
      const el = HT.kutu && HT.kutu.querySelector("#htBilgi");
      const s = haritaSeciliYer();
      const h = aktifHarita();
      if (el && s && h && !el.hidden && !HT.duzen && gzkKisiListesi(h)) {
        const gecenler = [];
        gzkKarakterler(h).forEach(function (x) {
          const gunler = gzGunler(x.yol);
          const bu = [];
          x.yol.forEach(function (a, j) { if (a.yer === s.id && bu.indexOf(gunler[j]) === -1) { bu.push(gunler[j]); } });
          if (bu.length) { gecenler.push({ x: x, gunler: bu }); }
        });
        if (gecenler.length) {
          el.insertAdjacentHTML("beforeend", '<div class="gzk-gecenler"><span class="oyun-etiket">buradan geçenler</span>' +
            gecenler.map(function (g) {
              const yazi = g.gunler.length > 4 ? g.gunler.slice(0, 4).join(", ") + "…" : g.gunler.join(", ");
              return '<button type="button" class="hp-mini" data-gzk-ac="' + kacir(h.id) + '" data-gzk-kisi="' + g.x.i + '" data-gzk-gun="' + g.gunler[0] + '">' +
                kacir(g.x.ad) + " · " + yazi + ". gün</button>";
            }).join("") + "</div>");
        }
      }
    } catch (_) { /* harita açık değil */ }
    return r;
  };
}

/* ---------- Claude'un evreni: Yolculuklar sekmesi, kişilerde "yolculuğunu izle" ---------- */

if (typeof CE_SEKMELER !== "undefined" && typeof claudeEvrenCiz === "function") {
  const i = CE_SEKMELER.findIndex(function (x) { return x[0] === "hikayeler"; });
  CE_SEKMELER.splice(i === -1 ? CE_SEKMELER.length : i + 1, 0, ["gezi", "Yolculuklar"]);
  const eskiCe = claudeEvrenCiz;
  window.claudeEvrenCiz = function () {
    const r = eskiCe.apply(this, arguments);
    const c = veri.claudeEvreni;
    const g = document.querySelector("#claudeEvrenAlan .ce-govde");
    const h = c && gzkHarita(c.harita);
    if (!g || !h) { return r; }
    if (ceSekme === "gezi") {
      g.innerHTML = '<p class="oyun-giris">Karakterlerin Şomdo\'daki yolculukları, gün gün. Birini seç, “Gün gün izle”ye bas: haritada nerede olduğunu görürsün.</p>' +
        '<div id="ceGezi" class="gzk-kok"></div>';
      const onceki = GZK && GZK.harita === h.id ? GZK.secili : null;
      gzkAc(h.id, onceki, null, "#ceGezi");
    } else if (ceSekme === "kisiler") {
      gzkKarakterler(h).forEach(function (x) {
        const k = c.kisiler[x.i];
        const d = k && k.id && g.querySelector("#ce-" + CSS.escape(k.id));
        if (!d || !x.yol.length) { return; }
        const son = gzGunler(x.yol)[x.yol.length - 1];
        d.insertAdjacentHTML("beforeend", '<button type="button" class="dugme dugme-sade ce-gezi-dugme" data-ce-gezi="' + x.i + '">🧭 Yolculuğunu gün gün izle (' + son + " gün)</button>");
      });
    }
    return r;
  };
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest("[data-ce-gezi]");
  if (!b || typeof ceSekme === "undefined") { return; }
  const c = veri.claudeEvreni;
  ceSekme = "gezi";
  GZK = { harita: c.harita, secili: Number(b.dataset.ceGezi), kirli: GZK ? GZK.kirli : 0 };
  claudeEvrenCiz();
  const k = document.querySelector("#claudeEvrenAlan");
  if (k) { k.scrollIntoView({ block: "start", behavior: "smooth" }); }
});
