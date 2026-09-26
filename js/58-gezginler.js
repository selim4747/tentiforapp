/* Kanon haritalarda gezginler: sitenin haritalarında (Tömye, Claude'un evreni…) gün gün yolculuk eden kişiler.
   Karakter listesinden bağımsızdır: her harita kendi gezginlerini taşır (kanon olmayan evrenlere kanon karakter
   eklemek gerekmesin). Yönetici çizer (Kaydet ile yayına girer); herkes haritada gün gün izler.
   Gezgin, evrenin kendi kişilerinden birine bağlanabilir (Claude'un evreni: claudeEvreni.kisiler).
   Veri: harita.gezginler = [{ id, ad, kisi, yol: [{ yer, gun, zaman, not }] }]
   Pencere olarak açılır (#geziSayfa) ya da bir sayfanın içine gömülür (Claude'un evreni → Yolculuklar). */

let GZK = null;   /* { harita: id, secili: gezgin sırası, kap: gömülüyse kabın seçicisi } */

/** Haritanın evrenine ait kişiler (gezgini bağlamak için). */
function gzkEvrenKisileri(h) {
  const ce = veri.claudeEvreni;
  if (ce && ce.harita === h.id) { return (ce.kisiler || []).map(function (k) { return { id: k.id, ad: k.ad, unvan: k.unvan }; }); }
  return [];
}

function gzkAd(h, z) {
  if (z.kisi) { const k = gzkEvrenKisileri(h).find(function (x) { return x.id === z.kisi; }); if (k) { return k.ad; } }
  return z.ad || "Adsız";
}

function gzkHarita(id) { return (veri.haritalar || []).find(function (x) { return x.id === id; }) || null; }

function gzkYonetici() { return typeof haritaYonetici === "function" && haritaYonetici(); }

/** Okurun görebildiği yer mi (kilitli ya da sisli yerler okura gösterilmez). */
function gzkYerGorunur(h, y) {
  if (!y) { return false; }
  if (gzkYonetici()) { return true; }
  return typeof haritaYerDurumu !== "function" || haritaYerDurumu(h, y, null) === "goster";
}

/** Okurun gördüğü gezginler: yolu gizli yerlerden temizlenmiş, boş yolu olanlar hariç (yönetici hepsini görür). */
function gzkGezginler(h) {
  const yon = gzkYonetici();
  return (h.gezginler || []).map(function (z, i) {
    const yol = (z.yol || []).filter(function (a) { return gzkYerGorunur(h, (h.yerler || []).find(function (y) { return y.id === a.yer; })); });
    return { i: i, ad: gzkAd(h, z), yol: yon ? (z.yol || []) : yol };
  }).filter(function (x) { return yon || x.yol.length; });
}

function gzkBaglam() {
  const h = GZK && gzkHarita(GZK.harita);
  if (!h) { return null; }
  const yon = gzkYonetici();
  const l = gzkGezginler(h);
  if (l.length && !l.some(function (x) { return x.i === GZK.secili; })) { GZK.secili = l[0].i; }
  const z = (h.gezginler || [])[GZK.secili];
  return {
    kisiler: l, secili: l.length ? GZK.secili : null, duzenle: yon,
    yerler: (h.yerler || []).filter(function (y) { return y.tur !== "Kıta" && gzkYerGorunur(h, y); }).map(function (y) { return { id: y.id, ad: y.ad, g: "" }; }),
    gruplar: [{ g: "", ad: h.ad }],
    yerBul: function (a) { const y = (h.yerler || []).find(function (x) { return x.id === a.yer; }); return gzkYerGorunur(h, y) ? y : null; },
    gAd: function () { return ""; },
    sec: function (i) { GZK.secili = i; },
    degistir: function (fn) {
      if (!yon) { return; }
      const gz = (h.gezginler || [])[GZK.secili];
      if (!gz) { return; }
      if (!Array.isArray(gz.yol)) { gz.yol = []; }
      fn(gz.yol);
      gz.yol.forEach(function (a) { delete a.g; });
      gzkKirli();
    },
    ciz: gzkCiz,
    ustEk: yon ? '<button type="button" class="dugme dugme-sade" data-gzk-yeni>+ Gezgin</button>' + (z ? gzkAdSatiri(h, z) : "") : "",
    bos: yon ? "Bu haritada henüz gezgin yok. “+ Gezgin” ile ekle; sonra şehirlere gün gün dokun." : ""
  };
}

function gzkAdSatiri(h, z) {
  const kisiler = gzkEvrenKisileri(h);
  return '<div class="gzk-ad">' +
    (kisiler.length ? '<select class="kod-giris arac-giris" data-gzk-kisi aria-label="Evrenin kişisi"><option value="">Kişiye bağlama (serbest ad)</option>' +
      kisiler.map(function (k) { return '<option value="' + kacir(k.id) + '"' + (z.kisi === k.id ? " selected" : "") + ">" + kacir(k.ad + (k.unvan ? " · " + k.unvan : "")) + "</option>"; }).join("") + "</select>" : "") +
    (z.kisi && kisiler.some(function (k) { return k.id === z.kisi; }) ? "" : '<input class="kod-giris arac-giris" data-gzk-ad maxlength="60" value="' + kacir(z.ad || "") + '" aria-label="Gezginin adı" placeholder="Adı">') +
    '<button type="button" class="ic-bag y-sil" data-gzk-sil>Gezgini sil</button></div>';
}

function gzkKirli() {
  GZK.kirli = (GZK.kirli || 0) + 1;
  if (typeof yoneticiDurum === "function") { yoneticiDurum("Gezginler değişti — yayına almak için Kaydet, sonra Yayınla", true); }
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

function gzkAc(haritaId, gezgin, gun, kap) {
  const h = gzkHarita(haritaId);
  if (!h) { return; }
  const eski = GZK;
  GZK = { harita: haritaId, secili: 0, kirli: eski && eski.harita === haritaId ? eski.kirli : 0, durum: "", kap: kap || null };
  if (gezgin !== undefined && gezgin !== null) { GZK.secili = gezgin; }
  gzKimlik("kanon:" + haritaId + ":" + GZK.secili);
  if (gun !== undefined && gun !== null) { GZ.gun = gun; }
  GZ.bagla = gzkBaglam;
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
  if (typeof haritaCiz === "function" && document.querySelector("#haritaAlan")) { haritaCiz(); }
  /* evren sayfası açıksa çizelgesi yeniden bağlansın */
  if (typeof EVS !== "undefined" && EVS && document.querySelector("#evrenSayfa") && typeof evrenSayfaCiz === "function") { evrenSayfaCiz(); }
}

function gzkCiz() {
  if (!GZK) { return; }
  const h = gzkHarita(GZK.harita);
  if (!h) { gzkKapat(); return; }
  let s = GZK.kap ? document.querySelector(GZK.kap) : document.querySelector("#geziSayfa");
  if (GZK.kap && !s) { GZK = null; GZ.bagla = null; gzOynatDurdur(); return; }   /* gömülü olduğu sayfa kapandı */
  const b = gzkBaglam();
  gzKimlik("kanon:" + GZK.harita + ":" + b.secili);
  GZ.bagla = gzkBaglam;
  if (!s) {
    s = document.createElement("div");
    s.id = "geziSayfa";
    s.className = "sehir-sayfa gezi-sayfa gzk-kok";
    s.setAttribute("role", "dialog");
    s.setAttribute("aria-modal", "true");
    document.body.appendChild(s);
  }
  s.setAttribute("aria-label", h.ad + " gezginleri");
  const gorunen = (h.yerler || []).filter(function (y) { return gzkYerGorunur(h, y); });
  window.__gzYol = gzNoktalar(b, "");
  let svg;
  try { svg = evrenHaritaSvg({ yerler: gorunen, renk: h.renk }, {}); } finally { window.__gzYol = null; }
  const kayar = s.scrollTop;
  s.classList.add("gzk-kok");
  s.innerHTML =
    (GZK.kap ? "" : '<div class="evs-ust"><button class="evs-ikon" data-gzk-kapat aria-label="Kapat" title="Kapat"><span aria-hidden="true">←</span></button>' +
      '<div class="evs-baslik"><span class="evs-rozet">Gezginler' + (b.duzenle ? " · düzenliyorsun" : "") + "</span><h2>" + kacir(h.ad) + "</h2></div></div>") +
    '<div class="' + (GZK.kap ? "gzk-gomulu" : "sh-govde") + '">' +
      (b.duzenle ? '<div class="gzk-kaydet"><span class="oyun-not">' + (GZK.durum ? kacir(GZK.durum) : (GZK.kirli ? "Kaydedilmemiş değişiklik var." : "Değişiklikler bu cihazda; yayına almak için Kaydet.")) + "</span>" +
        '<button type="button" class="dugme" data-gzk-kaydet>Kaydet' + (GZK.kirli ? " (" + GZK.kirli + ")" : "") + "</button></div>" : "") +
      '<div class="evh-kutu gzk-harita">' + svg + "</div>" +
      (b.duzenle ? '<p class="oyun-not">İpucu: haritadaki yerlere de dokunabilirsin.</p>' : "") +
      '<section class="gz-kutu" aria-label="Gezi çizelgesi">' + gzGovde(b) + "</section>" +
    "</div>";
  if (!GZK.kap) { s.scrollTop = kayar; }
}

/* ---------- olaylar ---------- */

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-gzk-ac], [data-gzk-kapat], [data-gzk-yeni], [data-gzk-sil], [data-gzk-kaydet]");
  if (!h) { return; }
  const d = h.dataset;
  if (d.gzkAc !== undefined) {
    ev.preventDefault();
    const hid = d.gzkAc || (typeof aktifHarita === "function" && aktifHarita() || {}).id;
    const gezgin = d.gzkGezgin !== undefined ? Number(d.gzkGezgin) : null, gun = d.gzkGun !== undefined ? Number(d.gzkGun) : null;
    /* Claude'un evreni sayfasındaki Yolculuklar sekmesi açıksa orada, değilse pencerede */
    const gomulu = document.querySelector("#ceGezi");
    gzkAc(hid, gezgin, gun, gomulu && veri.claudeEvreni && veri.claudeEvreni.harita === hid && !(typeof HT !== "undefined" && HT.acik) ? "#ceGezi" : null);
    return;
  }
  if (!GZK) { return; }
  if (h.hasAttribute("data-gzk-kapat")) { gzkKapat(); return; }
  if (!gzkYonetici()) { return; }
  const hr = gzkHarita(GZK.harita);
  if (h.hasAttribute("data-gzk-kaydet")) { gzkKaydet(); return; }
  if (h.hasAttribute("data-gzk-yeni")) {
    if (!Array.isArray(hr.gezginler)) { hr.gezginler = []; }
    hr.gezginler.push({ id: "gz_" + Date.now().toString(36), ad: "Yeni gezgin", yol: [] });
    GZ.gun = null;
    GZK.secili = hr.gezginler.length - 1;
    gzkKirli(); gzkCiz();
    const a = document.querySelector(".gzk-kok [data-gzk-ad]");
    if (a) { a.focus(); a.select(); }
    return;
  }
  if (h.hasAttribute("data-gzk-sil")) {
    const z = (hr.gezginler || [])[GZK.secili];
    if (!z || !confirm(gzkAd(hr, z) + " ve bütün yolu silinsin mi?")) { return; }
    hr.gezginler.splice(GZK.secili, 1);
    if (!hr.gezginler.length) { delete hr.gezginler; }
    GZK.secili = 0;
    gzkKirli(); setTimeout(gzkCiz, 0);
  }
});

document.addEventListener("input", function (ev) {
  const t = ev.target;
  if (!t || !t.matches || !t.matches(".gzk-kok [data-gzk-ad]") || !GZK || !gzkYonetici()) { return; }
  const z = ((gzkHarita(GZK.harita) || {}).gezginler || [])[GZK.secili];
  if (!z) { return; }
  z.ad = String(t.value).slice(0, 60);
  GZK.kirli = GZK.kirli || 1;
  const o = document.querySelector('.gzk-kok [data-gz-kisi] option[value="' + GZK.secili + '"]');
  if (o) { o.textContent = (z.ad || "Adsız") + ((z.yol || []).length ? " (" + z.yol.length + ")" : ""); }
});
document.addEventListener("change", function (ev) {
  const t = ev.target;
  if (!t || !t.matches || !GZK || !gzkYonetici()) { return; }
  if (t.matches(".gzk-kok [data-gzk-ad]")) { gzkKirli(); return; }
  if (t.matches(".gzk-kok [data-gzk-kisi]")) {
    const h = gzkHarita(GZK.harita);
    const z = ((h || {}).gezginler || [])[GZK.secili];
    if (!z) { return; }
    const k = gzkEvrenKisileri(h).find(function (x) { return x.id === t.value; });
    if (k) { z.kisi = k.id; z.ad = k.ad; } else { delete z.kisi; }
    gzkKirli(); setTimeout(gzkCiz, 0);
  }
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

/* Esc gezi penceresini kapatır (altındaki harita açık kalır) */
window.addEventListener("keydown", function (e) {
  if (e.key !== "Escape" || !GZK || GZK.kap || !document.querySelector("#geziSayfa")) { return; }
  e.stopImmediatePropagation();
  e.preventDefault();
  gzkKapat();
}, true);

/* ---------- haritaya bağlantılar ---------- */

function gzkDugme(h, sinif) {
  const l = gzkGezginler(h);
  if (!l.length && !gzkYonetici()) { return ""; }
  return '<button type="button" class="dugme ' + (sinif || "") + '" data-gzk-ac="' + kacir(h.id) + '">🧭 ' +
    (l.length ? "Gezginler: " + kacir(l.slice(0, 3).map(function (x) { return x.ad || "Adsız"; }).join(", ")) + (l.length > 3 ? "…" : "") + " — gün gün izle" : "Gezgin ekle (gün gün yolculuk)") + "</button>";
}

/* harita sayfası: önizlemenin altında */
if (typeof haritaCiz === "function") {
  const eskiHaritaCiz = haritaCiz;
  window.haritaCiz = function () {
    const r = eskiHaritaCiz.apply(this, arguments);
    const alan = document.querySelector("#haritaAlan");
    const h = typeof aktifHarita === "function" ? aktifHarita() : null;
    if (alan && h) {
      const d = gzkDugme(h, "dugme-sade gzk-ac");
      if (d) { alan.insertAdjacentHTML("beforeend", '<div class="gzk-satir">' + d + "</div>"); }
    }
    return r;
  };
}

/* tam ekran harita: katman panelinde "Gezginler" bölümü */
if (typeof haritaPanelCiz === "function") {
  const eskiPanel = haritaPanelCiz;
  window.haritaPanelCiz = function () {
    const r = eskiPanel.apply(this, arguments);
    try {
      const el = HT.kutu && HT.kutu.querySelector("#htPanel");
      const h = aktifHarita();
      if (el && !el.hidden && h) {
        const l = gzkGezginler(h);
        if (l.length || gzkYonetici()) {
          el.insertAdjacentHTML("beforeend", '<section class="hp-bolum gzk-panel"><b>Gezginler</b>' +
            (l.length ? '<div class="hp-alt">' + l.map(function (x) {
              const son = x.yol.length ? gzGunler(x.yol)[x.yol.length - 1] : 0;
              return '<button type="button" class="hp-mini" data-gzk-ac="' + kacir(h.id) + '" data-gzk-gezgin="' + x.i + '">' + kacir(x.ad || "Adsız") + (son ? " · " + son + " gün" : "") + "</button>";
            }).join("") + "</div>" : "") +
            '<p class="hp-not">' + (l.length ? "Birine dokun: gün gün nereye gittiğini izle." : "Henüz gezgin yok.") + "</p>" +
            (gzkYonetici() ? '<button type="button" class="hp-mini" data-gzk-ac="' + kacir(h.id) + '">Gezginleri düzenle</button>' : "") + "</section>");
        }
      }
    } catch (_) { /* harita kapalı */ }
    return r;
  };
}

/* yer kartı: buradan geçen gezginler, hangi günler */
if (typeof haritaBilgiCiz === "function") {
  const eskiBilgi = haritaBilgiCiz;
  window.haritaBilgiCiz = function () {
    const r = eskiBilgi.apply(this, arguments);
    try {
      const el = HT.kutu && HT.kutu.querySelector("#htBilgi");
      const s = haritaSeciliYer();
      const h = aktifHarita();
      if (el && s && h && !el.hidden && !HT.duzen) {
        const gecenler = [];
        gzkGezginler(h).forEach(function (x) {
          const gunler = gzGunler(x.yol);
          const bu = [];
          x.yol.forEach(function (a, j) { if (a.yer === s.id && bu.indexOf(gunler[j]) === -1) { bu.push(gunler[j]); } });
          if (bu.length) { gecenler.push({ x: x, gunler: bu }); }
        });
        if (gecenler.length) {
          el.insertAdjacentHTML("beforeend", '<div class="gzk-gecenler"><span class="oyun-etiket">buradan geçen gezginler</span>' +
            gecenler.map(function (g) {
              const yazi = g.gunler.length > 4 ? g.gunler.slice(0, 4).join(", ") + "…" : g.gunler.join(", ");
              return '<button type="button" class="hp-mini" data-gzk-ac="' + kacir(h.id) + '" data-gzk-gezgin="' + g.x.i + '" data-gzk-gun="' + g.gunler[0] + '">' +
                kacir(g.x.ad || "Adsız") + " · " + yazi + ". gün</button>";
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
      g.innerHTML = '<p class="oyun-giris">Kişilerin Şomdo\'daki yolculukları, gün gün. Birini seç, “Gün gün izle”ye bas: haritada nerede olduğunu görürsün.</p>' +
        '<div id="ceGezi" class="gzk-kok"></div>';
      const onceki = GZK && GZK.harita === h.id ? GZK.secili : null;
      gzkAc(h.id, onceki, null, "#ceGezi");
    } else if (ceSekme === "kisiler") {
      gzkGezginler(h).forEach(function (x) {
        const z = h.gezginler[x.i];
        const d = z.kisi && g.querySelector("#ce-" + CSS.escape(z.kisi));
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
