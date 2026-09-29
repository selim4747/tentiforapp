/* Sitenin evrenlerinde karakterlerin gün gün yolculukları (kendi evren dosyalarındaki çizelgenin sitedeki eşi).
   - Claude'un evreni (kanon dışı, özellikleri örnekleyen evren): claudeEvreni.kisiler[i].yol = [{ yer, gun, zaman, not }].
     Yönetici buradan karakter de ekler.
   - Tentiforverse (Tömye ve gezegenleri): veri.karakterler[i].yol = [{ harita, yer, yil, gun, zaman, not }] — haritadaki
     "Yol çiz" aracıyla aynı veri; burada gün gün kurulur ve izlenir. Haritalar, kendi evrenlerdeki gezegenler gibi davranır.
   Yönetici çizer (Kaydet ile yayına girer); herkes gün gün izler.
   Pencere olarak açılır (#geziSayfa) ya da sayfaya gömülür (Claude'un evreni → Yolculuklar). */

let GZK = null;   /* { harita: gösterilen harita, secili: karakter sırası, kap: gömülüyse kabın seçicisi, kirli, durum } */

function gzkHarita(id) { return (veri.haritalar || []).find(function (x) { return x.id === id; }) || null; }

function gzkYonetici() { return typeof haritaYonetici === "function" && haritaYonetici(); }

function gzkHaritaAcik(x) {
  return gzkYonetici() || typeof kanonEvrenErisimi !== "function" || kanonEvrenErisimi(x.id);
}

/** Haritanın evreni: karakterler nerede, yolları hangi biçimde (yoksa null: bu haritada yolculuk bölümü yok). */
function gzkKaynak(h) {
  if (!h) { return null; }
  const ce = veri.claudeEvreni;
  if (ce && ce.harita === h.id) {
    if (!Array.isArray(ce.kisiler)) { ce.kisiler = []; }
    return {
      haritalar: [h], kisiler: ce.kisiler, karakterEkle: true,
      gorunur: function () { return true; },
      oku: function (k) { return (k.yol || []).map(function (a) { return Object.assign({}, a, { g: h.id }); }); },
      yaz: function (k, yol) {
        const l = yol.map(function (a) { const o = { yer: a.yer }; if (a.gun >= 1) { o.gun = a.gun; } o.zaman = a.zaman || ""; o.not = a.not || ""; return o; });
        if (l.length) { k.yol = l; } else { delete k.yol; }
      }
    };
  }
  if ((h.ustEvren || h.id) === "tomye") {
    return {
      haritalar: (veri.haritalar || []).filter(function (x) { return (x.ustEvren || x.id) === "tomye"; }),
      kisiler: veri.karakterler || [], karakterEkle: false,
      gorunur: function (k) { return !k.gizli || gzkYonetici() || (typeof katmanAcik === "function" && katmanAcik(k.gizli)); },
      oku: function (k) {
        return (k.yol || []).map(function (a) { return { g: a.harita, yer: a.yer, gun: a.gun, zaman: a.zaman || "", not: a.not || "", yil: a.yil }; });
      },
      yaz: function (k, yol) {
        const l = yol.map(function (a) {
          const o = { harita: a.g || "tomye", yer: a.yer };
          if (typeof a.yil === "number" && isFinite(a.yil)) { o.yil = a.yil; }
          if (a.gun >= 1) { o.gun = a.gun; }
          if (a.zaman) { o.zaman = a.zaman; }
          if (a.not) { o.not = a.not; }
          return o;
        });
        if (l.length) { k.yol = l; } else { delete k.yol; }
      }
    };
  }
  return null;
}

function gzkKisiListesi(h) { const k = gzkKaynak(h); return k ? k.kisiler : null; }

/** Okurun görebildiği yer mi (kilitli ya da sisli yerler okura gösterilmez). */
function gzkYerGorunur(h, y) {
  if (!y || !h) { return false; }
  if (gzkYonetici()) { return true; }
  if (!gzkHaritaAcik(h)) { return false; }
  return typeof haritaYerDurumu !== "function" || haritaYerDurumu(h, y, null) === "goster";
}

function gzkYerBul(kaynak, a) {
  const h = kaynak.haritalar.find(function (x) { return x.id === a.g; });
  const y = h && (h.yerler || []).find(function (x) { return x.id === a.yer; });
  return gzkYerGorunur(h, y) ? y : null;
}

/** Çizelgedeki karakterler: okur yalnızca yolu olanları görür (gizli yerler atlanır), yönetici hepsini. */
function gzkKarakterler(h) {
  const kaynak = gzkKaynak(h);
  if (!kaynak) { return []; }
  const yon = gzkYonetici();
  return kaynak.kisiler.map(function (k, i) {
    if (!k || !kaynak.gorunur(k)) { return null; }
    const yol = kaynak.oku(k).filter(function (a) { return yon || gzkYerBul(kaynak, a); });
    return { i: i, ad: k.ad || "Adsız", yol: yol, canli: k.canli || null };
  }).filter(function (x) { return x && (yon || x.yol.length); });
}

function gzkBaglam() {
  const h = GZK && gzkHarita(GZK.harita);
  const kaynak = gzkKaynak(h);
  if (!h || !kaynak) { return null; }
  const yon = gzkYonetici();
  const l = gzkKarakterler(h);
  /* ilk açılışta yolu olan ilk karakter */
  if (l.length && !l.some(function (x) { return x.i === GZK.secili; })) {
    const yollu = l.find(function (x) { return x.yol.length; });
    GZK.secili = (yollu || l[0]).i;
  }
  const k = kaynak.kisiler[GZK.secili];
  const haritalar = kaynak.haritalar.filter(gzkHaritaAcik);
  const yerler = [];
  haritalar.forEach(function (x) {
    (x.yerler || []).forEach(function (y) { if (y.tur !== "Kıta" && gzkYerGorunur(x, y)) { yerler.push({ id: y.id, ad: y.ad, g: x.id }); } });
  });
  return {
    kisiler: l, secili: l.length ? GZK.secili : null, duzenle: yon,
    evrenAd: (kaynak.haritalar[0] && (kaynak.haritalar[0].evrenAdi || kaynak.haritalar[0].ad)) || "",
    yerler: yerler,
    gruplar: haritalar.map(function (x) { return { g: x.id, ad: x.ad }; }),
    yerBul: function (a) { return gzkYerBul(kaynak, a); },
    gAd: function (g) { if (haritalar.length < 2) { return ""; } const x = gzkHarita(g); return x ? x.ad : ""; },
    sec: function (i) { GZK.secili = i; },
    /* evren saati: sitenin takvimi (Tömye) ya da haritanın kendi gün uzunluğu (Şomdo'da 40 saat) */
    simdiGun: function () {
      const m = typeof evrenMeta === "function" ? evrenMeta(gzkHarita(GZK.harita)) : {};
      return gzEvrenGunu(typeof haritaEpok === "function" ? haritaEpok() : Date.parse("2000-01-01"), m.gunSaat || (veri.takvim || {}).gunSaat || 24);
    },
    canliYaz: function (c) {
      if (!yon) { return; }
      const kk = kaynak.kisiler[GZK.secili];
      if (!kk) { return; }
      if (c) { kk.canli = c; } else { delete kk.canli; }
      gzkKirli();
    },
    degistir: function (fn) {
      if (!yon) { return; }
      const kk = kaynak.kisiler[GZK.secili];
      if (!kk) { return; }
      const yol = kaynak.oku(kk);
      fn(yol);
      kaynak.yaz(kk, yol);
      gzkKirli();
    },
    ciz: gzkCiz,
    ustEk: yon && kaynak.karakterEkle ? '<button type="button" class="dugme dugme-sade" data-gzk-yeni>+ Karakter</button>' +
      (k ? '<div class="gzk-ad"><input class="kod-giris arac-giris" data-gzk-alan="ad" maxlength="60" value="' + kacir(k.ad || "") + '" aria-label="Karakterin adı" placeholder="Adı">' +
        '<input class="kod-giris arac-giris" data-gzk-alan="unvan" maxlength="80" value="' + kacir(k.unvan || "") + '" aria-label="Unvanı" placeholder="Unvanı (ör. Kervan önderi)"></div>' : "") : "",
    bos: yon ? (kaynak.karakterEkle ? "Bu evrende henüz karakter yok. “+ Karakter” ile ekle; sonra şehirlere gün gün dokun." : "Karakterleri paneldeki Karakterler bölümünden eklersin.") : ""
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
  if (!h || !gzkKaynak(h)) { return; }
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
  let b = gzkBaglam();
  if (!b) { return; }
  /* oynatıcı başka haritadaki güne gelince o harita gösterilir (Tömye → Ax-24) */
  if (GZ.gun !== null) {
    const kk = b.kisiler.find(function (x) { return x.i === b.secili; });
    const j = kk ? gzSimdi(kk.yol) : -1;
    if (j >= 0 && kk.yol[j].g && kk.yol[j].g !== GZK.harita && b.gruplar.some(function (g) { return g.g === kk.yol[j].g; })) {
      GZK.harita = kk.yol[j].g;
      b = gzkBaglam();
    }
  }
  gzKimlik("kanon:" + (gzkKaynak(gzkHarita(GZK.harita)).haritalar[0].id) + ":" + b.secili);
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
  const h2 = gzkHarita(GZK.harita);
  const gorunen = (h2.yerler || []).filter(function (y) { return gzkYerGorunur(h2, y); });
  window.__gzYol = gzNoktalar(b, h2.id);
  let svg;
  try { svg = evrenHaritaSvg({ yerler: gorunen, renk: h2.renk, cizgiler: h2.cizgiler, olcek: h2.olcek }, {}); } finally { window.__gzYol = null; }
  const kayar = s.scrollTop;
  s.innerHTML =
    (GZK.kap ? "" : '<div class="evs-ust"><button class="evs-ikon" data-gzk-kapat aria-label="Kapat" title="Kapat"><span aria-hidden="true">←</span></button>' +
      '<div class="evs-baslik"><span class="evs-rozet">Yolculuklar' + (b.duzenle ? " · düzenliyorsun" : "") + "</span><h2>" + kacir(h2.evrenAdi || h2.ad) + "</h2></div></div>") +
    '<div class="' + (GZK.kap ? "gzk-gomulu" : "sh-govde") + '">' +
      (b.duzenle ? '<div class="gzk-kaydet"><span class="oyun-not">' + (GZK.durum ? kacir(GZK.durum) : (GZK.kirli ? "Kaydedilmemiş değişiklik var." : "Değişiklikler bu cihazda; yayına almak için Kaydet.")) + "</span>" +
        '<button type="button" class="dugme" data-gzk-kaydet>Kaydet' + (GZK.kirli ? " (" + GZK.kirli + ")" : "") + "</button></div>" : "") +
      (b.gruplar.length > 1 ? '<div class="gzk-haritalar" role="tablist">' + b.gruplar.map(function (g) {
        return '<button type="button" class="evg-cip' + (g.g === GZK.harita ? " secili" : "") + '" data-gzk-harita="' + kacir(g.g) + '">' + kacir(g.ad) + "</button>";
      }).join("") + "</div>" : "") +
      '<div class="evh-kutu gzk-harita">' + svg + "</div>" +
      (b.duzenle ? '<p class="oyun-not">İpucu: haritadaki yerlere de dokunabilirsin.</p>' : "") +
      '<section class="gz-kutu" aria-label="Yolculuk çizelgesi">' + gzGovde(b) + "</section>" +
    "</div>";
  if (!GZK.kap) { s.scrollTop = kayar; }
}

/* ---------- olaylar ---------- */

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-gzk-ac], [data-gzk-kapat], [data-gzk-yeni], [data-gzk-kaydet], [data-gzk-harita]");
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
  if (d.gzkHarita) { gzOynatDurdur(); GZ.gun = null; GZK.harita = d.gzkHarita; gzkCiz(); return; }
  if (!gzkYonetici()) { return; }
  if (h.hasAttribute("data-gzk-kaydet")) { gzkKaydet(); return; }
  if (h.hasAttribute("data-gzk-yeni")) {
    const kaynak = gzkKaynak(gzkHarita(GZK.harita));
    if (!kaynak || !kaynak.karakterEkle) { return; }
    const liste = kaynak.kisiler;
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
  const kaynak = gzkKaynak(gzkHarita(GZK.harita));
  const k = kaynak && kaynak.karakterEkle ? kaynak.kisiler[GZK.secili] : null;
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
  if (!b.yerler.some(function (y) { return y.id === id && y.g === GZK.harita; })) { return; }
  gzEkle(b, id, GZK.harita);
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
          x.yol.forEach(function (a, j) { if (a.yer === s.id && a.g === h.id && bu.indexOf(gunler[j]) === -1) { bu.push(gunler[j]); } });
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
