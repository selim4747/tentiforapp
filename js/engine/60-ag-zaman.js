/* İlişki ağı ve zaman çizelgesi — bütün evrenlerde.
   - Kendi evreni, sitedeki fan evrenleri, açılan dosyalar: evren sayfasında "Bağlar ve zaman" sekmesi.
     Bağlar: e.baglar = [{ a: kişi adı, b: kişi adı, etiket }]; zaman çizelgesi evrenin Tarih kayıtlarından.
   - Claude'un evreni: Kişiler sekmesinde ağ (claudeEvreni.baglar), Tarih sekmesinde kronoloji çizelgesi
     ("Zaman — olay" diye yazılmış tarih maddelerinden). */

const IA_KAYIT = {};   /* kap kimliği → { dugumler, baglar } (dokununca yeniden çizmek için) */
let IA_SECILI = {};    /* kap kimliği → seçili düğüm */

/* ---------- veri ---------- */

function iaBaglarTemizle(l) {
  return (Array.isArray(l) ? l : []).slice(0, 200).map(function (x) {
    if (!x || typeof x !== "object") { return null; }
    const a = String(x.a == null ? "" : x.a).slice(0, 80).trim(), b = String(x.b == null ? "" : x.b).slice(0, 80).trim();
    return a && b && a !== b ? { a: a, b: b, etiket: String(x.etiket == null ? "" : x.etiket).slice(0, 80) } : null;
  }).filter(Boolean);
}

/* ---------- ilişki ağı ---------- */

/** Düğümler çember üstünde; seçili düğümün bağları öne çıkar, ötekiler soluklaşır. */
function iaSvg(dugumler, baglar, secili) {
  const n = dugumler.length;
  const esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };
  const cx = 80, cy = 62, R = n > 1 ? Math.min(44, 28 + n * 1.3) : 0;
  const yer = {};
  dugumler.forEach(function (d, i) {
    const a = -Math.PI / 2 + i / n * Math.PI * 2;
    yer[d.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a: a };
  });
  const ilgili = function (x) { return !secili || x.a === secili || x.b === secili; };
  const cizgiler = baglar.filter(function (x) { return yer[x.a] && yer[x.b]; }).map(function (x) {
    const p = yer[x.a], q = yer[x.b], on = ilgili(x);
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    return '<g class="ia-bag' + (on ? (secili ? " on" : "") : " soluk") + '"><line x1="' + p.x.toFixed(1) + '" y1="' + p.y.toFixed(1) + '" x2="' + q.x.toFixed(1) + '" y2="' + q.y.toFixed(1) + '"></line>' +
      (x.etiket && (secili ? on : baglar.length <= 8) ? '<text x="' + mx.toFixed(1) + '" y="' + (my - 0.8).toFixed(1) + '" text-anchor="middle">' + esc(x.etiket) + "</text>" : "") +
      (x.etiket ? "<title>" + esc(x.etiket) + "</title>" : "") + "</g>";
  }).join("");
  const baglilar = {};
  baglar.forEach(function (x) { if (x.a === secili) { baglilar[x.b] = 1; } if (x.b === secili) { baglilar[x.a] = 1; } });
  const noktalar = dugumler.map(function (d) {
    const p = yer[d.id];
    const c = Math.cos(p.a), anc = Math.abs(c) < 0.3 ? "middle" : (c > 0 ? "start" : "end");
    const sn = Math.sin(p.a);
    const lx = p.x + c * 4.2, ly = p.y + (Math.abs(c) < 0.3 ? (sn > 0 ? 7.2 : -4.4) : sn * 4.2 + 1.6);
    const soluk = secili && d.id !== secili && !baglilar[d.id];
    return '<g class="ia-dugum' + (d.id === secili ? " secili" : "") + (soluk ? " soluk" : "") + '" data-ia-dugum="' + esc(d.id) + '" tabindex="0" role="button" aria-label="' + esc(d.ad) + '">' +
      '<circle class="ia-vuru" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="5"></circle>' +
      '<circle class="ia-nokta" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (d.id === secili ? 2.6 : 2) + '"></circle>' +
      '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anc + '">' + esc(d.ad) + "</text></g>";
  }).join("");
  return '<svg class="ia-svg" viewBox="0 0 160 124" role="img" aria-label="İlişki ağı" xmlns="http://www.w3.org/2000/svg">' + cizgiler + noktalar + "</svg>";
}

/** Ağ kutusu: dokunulan kişinin bağları altta yazıyla da listelenir. */
function iaKutu(kap, dugumler, baglar) {
  IA_KAYIT[kap] = { dugumler: dugumler, baglar: baglar };
  const sec = IA_SECILI[kap] && dugumler.some(function (d) { return d.id === IA_SECILI[kap]; }) ? IA_SECILI[kap] : null;
  const ad = function (id) { const d = dugumler.find(function (x) { return x.id === id; }); return d ? d.ad : id; };
  const liste = sec ? baglar.filter(function (x) { return x.a === sec || x.b === sec; }) : [];
  return '<div class="ia-kutu" data-ia-kap="' + kacir(kap) + '">' + iaSvg(dugumler, baglar, sec) +
    '<p class="oyun-not ia-yazi" role="status">' + (sec
      ? "<b>" + kacir(ad(sec)) + "</b>: " + (liste.length ? liste.map(function (x) { return kacir(ad(x.a === sec ? x.b : x.a)) + (x.etiket ? " — " + kacir(x.etiket) : ""); }).join(" · ") : "bağı yok")
      : "Bir kişiye dokun: kimlerle, nasıl bağlı olduğunu gör.") + "</p></div>";
}

document.addEventListener("click", function (ev) {
  const d = ev.target.closest && ev.target.closest("[data-ia-dugum]");
  if (!d) { return; }
  const kutu = d.closest("[data-ia-kap]");
  const kap = kutu && kutu.dataset.iaKap;
  const k = kap && IA_KAYIT[kap];
  if (!k) { return; }
  const id = d.getAttribute("data-ia-dugum");
  IA_SECILI[kap] = IA_SECILI[kap] === id ? null : id;
  kutu.outerHTML = iaKutu(kap, k.dugumler, k.baglar);
});
document.addEventListener("keydown", function (ev) {
  if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches && ev.target.matches("[data-ia-dugum]")) { ev.preventDefault(); ev.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
});

/* ---------- zaman çizelgesi ---------- */

function zcHtml(olaylar) {
  if (!olaylar.length) { return ""; }
  return '<ol class="zc">' + olaylar.map(function (o) {
    return '<li class="zc-olay"><span class="zc-nokta" aria-hidden="true"></span><div><b class="zc-zaman">' + kacir(o.zaman || "—") + "</b>" +
      (o.olay ? '<p class="zc-metin">' + kacir(o.olay) + "</p>" : "") + (o.not ? '<p class="oyun-not">' + kacir(o.not) + "</p>" : "") + "</div></li>";
  }).join("") + "</ol>";
}

/** "Zaman — olay" diye yazılmış paragraflardan olaylar; parantezli paragraflar bir öncekine not olur. */
function zcMetindenOlaylar(metin) {
  const l = [];
  String(metin || "").split(/\n\s*\n/).forEach(function (p) {
    p = p.trim();
    if (!p) { return; }
    const m = p.match(/^([^—\n]{1,60})\s+—\s+([\s\S]+)$/);
    if (m) {
      const ic = m[2].match(/^([\s\S]*?)\s*\(([^()]+)\)\s*$/);
      l.push({ zaman: m[1].trim(), olay: ic ? ic[1].trim() : m[2].trim(), not: ic ? ic[2].trim() : "" });
    } else if (l.length && /^\(/.test(p)) { l[l.length - 1].not = p.replace(/^\(|\)$/g, ""); }
  });
  return l;
}

/* ---------- evren sayfası: "Bağlar ve zaman" ---------- */

function iaEvrenBolumu(v) {
  const e = v.eser;
  const sahip = EVS.kaynak === "benim";
  const kisiler = (e.kisiler || []).filter(function (k) { return k && String(k.ad || "").trim() && !k.kutu; });
  const adlar = kisiler.map(function (k) { return String(k.ad).trim(); });
  const baglar = iaBaglarTemizle(e.baglar).filter(function (x) { return adlar.indexOf(x.a) !== -1 && adlar.indexOf(x.b) !== -1; });
  const dugumler = adlar.filter(function (a, i) { return adlar.indexOf(a) === i; }).map(function (a) { return { id: a, ad: a }; });
  const secenek = function (sec) { return dugumler.map(function (d) { return '<option value="' + kacir(d.id) + '"' + (d.id === sec ? " selected" : "") + ">" + kacir(d.ad) + "</option>"; }).join(""); };
  const olaylar = (e.tarih || []).filter(function (t) { return t && (String(t.zaman || "").trim() || String(t.olay || "").trim()); })
    .map(function (t) { return { zaman: t.zaman, olay: t.olay }; });
  return '<section class="kutu-y ia-bolum"><div class="oyun-etiket">İlişki ağı</div>' +
      (dugumler.length < 2 ? '<p class="oyun-not">' + (sahip ? "Ağ için Bilgiler sekmesinde en az iki kişi ekle." : "Bu evrende ağ kuracak kadar kişi yok.") + "</p>"
        : iaKutu("evren:" + (EVS.kaynak + ":" + EVS.id), dugumler, baglar) +
          (sahip ? '<div class="ia-ekle"><select class="kod-giris arac-giris" id="iaA" aria-label="Birinci kişi">' + secenek(dugumler[0].id) + "</select>" +
              '<select class="kod-giris arac-giris" id="iaB" aria-label="İkinci kişi">' + secenek(dugumler[1].id) + "</select>" +
              '<input class="kod-giris arac-giris" id="iaEtiket" maxlength="80" placeholder="Bağ: kardeş, düşman, öğretmeni…" aria-label="Bağın adı">' +
              '<button type="button" class="dugme" data-ia-ekle>Bağla</button></div>' +
            (baglar.length ? '<ul class="ia-liste">' + baglar.map(function (x, i) {
              return "<li><b>" + kacir(x.a) + "</b> — " + kacir(x.etiket || "bağlı") + " — <b>" + kacir(x.b) + '</b> <button type="button" class="ic-bag y-sil" data-ia-sil="' + i + '" aria-label="Bağı sil">✕</button></li>';
            }).join("") + "</ul>" : "") : "")) +
    "</section>" +
    '<section class="kutu-y zc-bolum"><div class="oyun-etiket">Zaman çizelgesi</div>' +
      (olaylar.length ? zcHtml(olaylar) : '<p class="oyun-not">' + (sahip ? "Bilgiler sekmesindeki Tarih bölümüne olay ekle; burada çizelge olur." : "Bu evrenin tarihi henüz yazılmamış.") + "</p>") +
      (sahip ? '<button type="button" class="ic-bag" data-evs-sekme="bilgi">Tarihi düzenle →</button>' : "") +
    "</section>";
}

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("#evrenSayfa [data-ia-ekle], #evrenSayfa [data-ia-sil]");
  if (!h || !EVS || EVS.kaynak !== "benim") { return; }
  if (h.hasAttribute("data-ia-ekle")) {
    const a = document.querySelector("#iaA").value, b = document.querySelector("#iaB").value;
    const etiket = document.querySelector("#iaEtiket").value.trim().slice(0, 80);
    if (!a || !b || a === b) { return; }
    evrenBenimDegistir(EVS.id, function (e) {
      const l = iaBaglarTemizle(e.baglar);
      if (l.length >= 200 || l.some(function (x) { return ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && x.etiket === etiket; })) { return; }
      l.push({ a: a, b: b, etiket: etiket });
      e.baglar = l;
    });
  } else {
    const i = Number(h.dataset.iaSil);
    evrenBenimDegistir(EVS.id, function (e) {
      /* listedeki sıra, var olan kişilere göre süzülmüş sıradır */
      const adlar = (e.kisiler || []).map(function (k) { return String((k && k.ad) || "").trim(); });
      const gorunen = iaBaglarTemizle(e.baglar).filter(function (x) { return adlar.indexOf(x.a) !== -1 && adlar.indexOf(x.b) !== -1; });
      const hedef = gorunen[i];
      if (!hedef) { return; }
      e.baglar = iaBaglarTemizle(e.baglar).filter(function (x) { return !(x.a === hedef.a && x.b === hedef.b && x.etiket === hedef.etiket); });
      if (!e.baglar.length) { delete e.baglar; }
    });
  }
  evrenSayfaCiz();
});

/* ---------- Claude'un evreni ---------- */

