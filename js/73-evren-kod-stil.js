/* Evrenin stil kodu ve görünüm kodu (2.3) — kurucu evreninin sayfasını kendi koduyla biçimlendirir.

   - Stil kodu (CSS): yalnızca bu evrenin sayfasına uygulanır (#evrenSayfa içine iç içe CSS olarak sarılır; sitenin
     geri kalanına dokunamaz). @import ve dış adresler (url(...) yalnızca data:) temizlenir.
   - Görünüm kodu (HTML): evrenin "Vitrin" sekmesi. Betik çalışmaz: yalnızca izinli etiketler ve öznitelikler kalır
     (olay öznitelikleri, script, iframe, form yok; bağlantılar http(s)/#, görseller data: ya da ikon/fan/).
     Yer tutucular: {{ad}} {{ozet}} {{kisiler}} {{yerler}} {{sozluk}} {{tarih}} {{kurallar}}.
   Evrenle birlikte kaydedilir, dosyaya iner, sitede yayımlanırsa herkes görür. */

const EKS_STIL_SINIR = 20000;
const EKS_GORUNUM_SINIR = 30000;
const EKS_ETIKETLER = ["div", "span", "p", "h1", "h2", "h3", "h4", "h5", "ul", "ol", "li", "b", "i", "em", "strong", "u", "small", "mark",
  "blockquote", "figure", "figcaption", "img", "a", "br", "hr", "section", "article", "header", "footer", "aside", "nav",
  "table", "thead", "tbody", "tr", "th", "td", "details", "summary", "dl", "dt", "dd", "code", "pre", "sup", "sub"];
const EKS_OZNITELIK = ["class", "title", "alt", "href", "src", "style", "colspan", "rowspan", "open", "width", "height", "role", "aria-label", "lang", "dir"];

if (typeof evrenEkTemizle === "function") {
  const eskiEkK = evrenEkTemizle;
  window.evrenEkTemizle = function (ham, e) {
    eskiEkK.apply(this, arguments);
    if (typeof ham.stilKodu === "string" && ham.stilKodu.trim()) { e.stilKodu = ham.stilKodu.slice(0, EKS_STIL_SINIR); } else { delete e.stilKodu; }
    if (typeof ham.gorunumKodu === "string" && ham.gorunumKodu.trim()) { e.gorunumKodu = ham.gorunumKodu.slice(0, EKS_GORUNUM_SINIR); } else { delete e.gorunumKodu; }
  };
}

/* ==================== stil kodu ==================== */

function eksCssTemizle(css) {
  return String(css || "").slice(0, EKS_STIL_SINIR)
    .replace(/<\/?\s*style/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/@charset[^;]*;?/gi, "")
    .replace(/expression\s*\(/gi, "(")
    .replace(/behavior\s*:/gi, "x:")
    .replace(/url\s*\(\s*(['"]?)(?!data:image\/)[^)]*\)/gi, "none");
}

/** Evrenin sayfasına uygulanan CSS: #evrenSayfa içine sarılı (iç içe CSS). */
function eksStilCss(e) {
  const c = eksCssTemizle(e && e.stilKodu);
  return c.trim() ? "#evrenSayfa{" + c + "}" : "";
}

/* ==================== görünüm kodu ==================== */

function eksAdresGuvenli(ad, v) {
  const s = String(v || "").trim();
  if (ad === "href") { return /^(https?:\/\/|#)/i.test(s); }
  if (ad === "src") { return /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) || /^ikon\/fan\/[\w-]{1,90}\.(jpg|png|webp)$/.test(s); }
  return true;
}

function eksYerTutucu(e) {
  const liste = function (l, bas, govde) {
    const x = (Array.isArray(l) ? l : []).filter(function (o) { return o && String(o[bas] || "").trim(); });
    return x.length ? "<ul>" + x.map(function (o) { return "<li><b>" + kacir(o[bas]) + "</b>" + (o[govde] ? " — " + kacir(o[govde]) : "") + "</li>"; }).join("") + "</ul>" : "";
  };
  return {
    ad: kacir(e.ad || ""), ozet: kacir(e.ozet || ""),
    kisiler: liste((e.kisiler || []).filter(function (k) { return !k.kutu; }), "ad", "rol"),
    yerler: liste(e.yerler, "ad", "aciklama"), sozluk: liste(e.sozluk, "terim", "tanim"),
    tarih: liste(e.tarih, "zaman", "olay"), kurallar: liste(e.kurallar, "ad", "aciklama")
  };
}

/** Görünüm kodunu güvenli HTML'e çevirir: izinli etiket ve öznitelikler dışında her şey atılır. */
function eksHtmlTemizle(html, e) {
  const yt = eksYerTutucu(e || {});
  const kaynak = String(html || "").slice(0, EKS_GORUNUM_SINIR).replace(/\{\{\s*(ad|ozet|kisiler|yerler|sozluk|tarih|kurallar)\s*\}\}/g, function (_, k) { return yt[k]; });
  const doc = new DOMParser().parseFromString("<div>" + kaynak + "</div>", "text/html");
  const kok = doc.body.firstChild;
  const temizle = function (el) {
    Array.prototype.slice.call(el.childNodes).forEach(function (c) {
      if (c.nodeType === 3) { return; }
      if (c.nodeType !== 1) { c.remove(); return; }
      const ad = c.tagName.toLowerCase();
      if (EKS_ETIKETLER.indexOf(ad) === -1) {
        /* bilinmeyen etiket: içindeki yazı kalsın, etiketin kendisi ve (script/style gibi) içeriği gitsin */
        if (["script", "style", "iframe", "object", "embed", "template", "svg", "math", "noscript", "form", "link", "meta", "base"].indexOf(ad) !== -1) { c.remove(); return; }
        temizle(c);
        while (c.firstChild) { el.insertBefore(c.firstChild, c); }
        c.remove();
        return;
      }
      Array.prototype.slice.call(c.attributes).forEach(function (a) {
        const n = a.name.toLowerCase();
        if (EKS_OZNITELIK.indexOf(n) === -1 || !eksAdresGuvenli(n, a.value)) { c.removeAttribute(a.name); return; }
        if (n === "style") { c.setAttribute("style", eksCssTemizle(a.value).replace(/[{}]/g, "")); }
      });
      if (ad === "a") { c.setAttribute("rel", "noopener nofollow ugc"); c.setAttribute("target", "_blank"); }
      temizle(c);
    });
  };
  temizle(kok);
  return kok.innerHTML;
}

/* ==================== sekmeler ==================== */

function eksKodBolumu(v) {
  const e = v.eser;
  return '<div class="kutu-y eks-kod"><label for="eksStil">Stil kodu (CSS)</label>' +
      '<p class="oyun-not">Evreninin sayfasını kendi CSS\'inle biçimlendir. Yalnızca bu evrenin sayfasına uygulanır. ' +
        "Örnek: <code>h2 { letter-spacing: .2em }</code>, <code>.evs-sekme.secili { background: #222; color: gold }</code>, <code>.eks-vitrin .kart { … }</code>. " +
        "Dış adresler ve @import çalışmaz.</p>" +
      '<textarea class="kod-giris arac-giris evkod" id="eksStil" rows="12" spellcheck="false" autocapitalize="off" maxlength="' + EKS_STIL_SINIR + '">' + kacir(e.stilKodu || "") + "</textarea>" +
      '<div class="oyun-sira"><button class="dugme" data-eks-kaydet="stilKodu">Stil kodunu uygula</button>' +
        '<button class="dugme dugme-sade" data-eks-ornek="stilKodu">Örnek stil</button>' +
        '<button class="dugme dugme-sade y-sil" data-eks-sil="stilKodu">Stil kodunu sil</button></div></div>' +
    '<div class="kutu-y eks-kod"><label for="eksGorunum">Görünüm kodu (HTML)</label>' +
      '<p class="oyun-not">Evreninin <b>Vitrin</b> sayfasını kendi HTML\'inle kur. Betik çalışmaz; başlık, paragraf, liste, tablo, görsel, bağlantı ve <code>class</code>/<code>style</code> serbest. ' +
        "Yer tutucular: <code>{{ad}}</code> <code>{{ozet}}</code> <code>{{kisiler}}</code> <code>{{yerler}}</code> <code>{{sozluk}}</code> <code>{{tarih}}</code> <code>{{kurallar}}</code>.</p>" +
      '<textarea class="kod-giris arac-giris evkod" id="eksGorunum" rows="14" spellcheck="false" autocapitalize="off" maxlength="' + EKS_GORUNUM_SINIR + '">' + kacir(e.gorunumKodu || "") + "</textarea>" +
      '<div class="oyun-sira"><button class="dugme" data-eks-kaydet="gorunumKodu">Görünüm kodunu uygula</button>' +
        '<button class="dugme dugme-sade" data-eks-ornek="gorunumKodu">Örnek görünüm</button>' +
        '<button class="dugme dugme-sade" data-evs-sekme="vitrin">Vitrini gör</button>' +
        '<button class="dugme dugme-sade y-sil" data-eks-sil="gorunumKodu">Görünüm kodunu sil</button></div></div>' +
    '<p class="pencere-durum" id="eksDurum" role="status"></p>';
}

function eksVitrinBolumu(v) {
  const e = v.eser;
  if (!String(e.gorunumKodu || "").trim()) {
    return '<p class="oyun-not">Bu evrenin henüz bir vitrini yok.' + (EVS && EVS.kaynak === "benim" ? " “Kod ile stil” sekmesinden görünüm kodu yaz." : "") + "</p>";
  }
  return '<div class="eks-vitrin">' + eksHtmlTemizle(e.gorunumKodu, e) + "</div>";
}

const EKS_ORNEK = {
  stilKodu: [
    ".evs-ust { border-bottom: 3px double currentColor; }",
    "h2 { letter-spacing: .08em; text-transform: uppercase; }",
    ".evs-sekme.secili { background: var(--deniz); color: #fff; border-radius: 999px; }",
    ".eks-vitrin .kapak { padding: 28px; border-radius: 12px; background: linear-gradient(135deg, var(--deniz), transparent); color: #fff; }",
    ".eks-vitrin .kapak h1 { margin: 0; font-size: 2.2em; }",
    ".eks-vitrin .izgara { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }",
    ".eks-vitrin .kutu { padding: 12px; border: 1px solid currentColor; border-radius: 8px; }"
  ].join("\n"),
  gorunumKodu: [
    '<header class="kapak">',
    "  <h1>{{ad}}</h1>",
    "  <p>{{ozet}}</p>",
    "</header>",
    '<section class="izgara">',
    '  <div class="kutu"><h3>Kişiler</h3>{{kisiler}}</div>',
    '  <div class="kutu"><h3>Yerler</h3>{{yerler}}</div>',
    '  <div class="kutu"><h3>Sözlük</h3>{{sozluk}}</div>',
    "</section>"
  ].join("\n")
};

if (typeof evrenEkSekmeler === "function") {
  const eskiSekK = evrenEkSekmeler;
  window.evrenEkSekmeler = function (v) {
    const l = eskiSekK.apply(this, arguments);
    if (!EVS || EVS.kaynak === "site") { return l; }
    const vitrin = String(v.eser.gorunumKodu || "").trim();
    if (vitrin || EVS.kaynak === "benim") { l.unshift(["vitrin", "✦ Vitrin"]); }
    if (EVS.kaynak === "benim") {
      const i = l.findIndex(function (x) { return x[0] === "stil"; });
      l.splice(i === -1 ? 1 : i + 1, 0, ["kodstil", "{ } Kod ile stil"]);
    }
    return l;
  };
  const eskiBolK = evrenEkBolum;
  window.evrenEkBolum = function (v) {
    if (EVS && EVS.sekme === "kodstil" && EVS.kaynak === "benim") { return eksKodBolumu(v); }
    if (EVS && EVS.sekme === "vitrin") { return eksVitrinBolumu(v); }
    return eskiBolK.apply(this, arguments);
  };
}

/* stil kodunu sayfaya uygula (evren sayfası kapanınca kendiliğinden gider) */
if (typeof evrenSayfaCiz === "function") {
  const eskiCizK = evrenSayfaCiz;
  window.evrenSayfaCiz = function () {
    const r = eskiCizK.apply(this, arguments);
    const s = document.querySelector("#evrenSayfa");
    const v = typeof evrenSayfaVerisi === "function" ? evrenSayfaVerisi() : null;
    if (s && v && v.eser && !v.kilitli) {
      const css = eksStilCss(v.eser);
      let st = s.querySelector("#evsKodStil");
      if (css) {
        if (!st) { st = document.createElement("style"); st.id = "evsKodStil"; s.appendChild(st); }
        if (st.textContent !== css) { st.textContent = css; }
      } else if (st) { st.remove(); }
    }
    return r;
  };
}

document.addEventListener("click", function (ev) {
  const h = ev.target.closest && ev.target.closest("[data-eks-kaydet], [data-eks-ornek], [data-eks-sil]");
  if (!h || !EVS || EVS.kaynak !== "benim" || typeof evrenBenimDegistir !== "function") { return; }
  const d = h.dataset;
  const alan = d.eksKaydet || d.eksOrnek || d.eksSil;
  if (["stilKodu", "gorunumKodu"].indexOf(alan) === -1) { return; }
  let deger = "";
  if (d.eksKaydet) { const t = document.querySelector(alan === "stilKodu" ? "#eksStil" : "#eksGorunum"); deger = t ? t.value : ""; }
  else if (d.eksOrnek) { deger = EKS_ORNEK[alan]; }
  const sinir = alan === "stilKodu" ? EKS_STIL_SINIR : EKS_GORUNUM_SINIR;
  evrenBenimDegistir(EVS.id, function (e) { if (String(deger).trim()) { e[alan] = String(deger).slice(0, sinir); } else { delete e[alan]; } });
  evrenSayfaCiz();
  const dd = document.querySelector("#eksDurum");
  if (dd) { dd.textContent = d.eksSil ? "Silindi." : "Uygulandı ve kaydedildi."; dd.className = "pencere-durum iyi"; }
});
