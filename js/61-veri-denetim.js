/* Kaydet öncesi veri denetimi: yönetici veri.json'u GitHub'a göndermeden önce kırık bağlantılar aranır.
   Düzeltilebilenler (silinmiş yere giden yol adımı, olmayan haritaya geçit, bozuk şehir planı / çizgi / ölçek,
   silinmiş kişiye bağ) tek onayla düzeltilir; düzeltilemeyenler (aynı haritada çift yer kimliği) yalnızca bildirilir. */

/** { sorunlar: [{ metin, duzelt? }] } — duzelt verilmişse o sorun kendiliğinden giderilebilir. */
function veriDenetle(v) {
  v = v || veri;
  const sorunlar = [];
  const haritalar = v.haritalar || [];
  const harita = function (id) { return haritalar.find(function (h) { return h.id === id; }); };
  const yerVar = function (hid, yid) { const h = harita(hid); return !!(h && (h.yerler || []).some(function (y) { return y.id === yid; })); };

  haritalar.forEach(function (h) {
    const gorulen = {};
    (h.yerler || []).forEach(function (y) {
      if (gorulen[y.id]) { sorunlar.push({ metin: h.ad + ": “" + y.id + "” kimliği iki yerde kullanılmış (" + gorulen[y.id] + ", " + y.ad + ")" }); }
      gorulen[y.id] = y.ad || "?";
      if (y.gecit && y.gecit.harita && !harita(y.gecit.harita)) {
        sorunlar.push({ metin: h.ad + " · " + y.ad + ": geçit olmayan bir haritaya gidiyor (" + y.gecit.harita + ")", duzelt: function () { delete y.gecit; } });
      }
      if (y.sehir && typeof sehirTemizle === "function") {
        const t = sehirTemizle(y.sehir);
        if (JSON.stringify(t) !== JSON.stringify(y.sehir)) {
          sorunlar.push({ metin: h.ad + " · " + y.ad + ": şehir planında bozuk ya da sınır dışı öğe var", duzelt: function () { if (t) { y.sehir = t; } else { delete y.sehir; } } });
        }
      }
    });
    if (h.cizgiler) {
      const iyi = (Array.isArray(h.cizgiler) ? h.cizgiler : []).filter(function (c) {
        return c && Array.isArray(c.noktalar) && c.noktalar.length > 1 && ["nehir", "yol", "sinir"].indexOf(c.tur) !== -1 &&
          c.noktalar.every(function (n) { return Array.isArray(n) && isFinite(n[0]) && isFinite(n[1]); });
      });
      if (iyi.length !== (Array.isArray(h.cizgiler) ? h.cizgiler.length : -1)) {
        sorunlar.push({ metin: h.ad + ": bozuk çizgi (nehir/yol/sınır) var", duzelt: function () { if (iyi.length) { h.cizgiler = iyi; } else { delete h.cizgiler; } } });
      }
    }
    if (h.olcek && !(Number(h.olcek.deger) > 0)) {
      sorunlar.push({ metin: h.ad + ": ölçeğin değeri yok", duzelt: function () { delete h.olcek; } });
    }
  });

  (v.karakterler || []).forEach(function (k) {
    if (!Array.isArray(k.yol) || !k.yol.length) { return; }
    const kirik = k.yol.filter(function (a) { return !yerVar(a.harita, a.yer); });
    if (kirik.length) {
      sorunlar.push({ metin: k.ad + ": yolunda " + kirik.length + " adım silinmiş bir yere gidiyor", duzelt: function () {
        k.yol = k.yol.filter(function (a) { return yerVar(a.harita, a.yer); });
        if (!k.yol.length) { delete k.yol; }
      } });
    }
  });

  const ce = v.claudeEvreni;
  if (ce) {
    const kisiler = ce.kisiler || [];
    kisiler.forEach(function (k) {
      if (!Array.isArray(k.yol) || !k.yol.length) { return; }
      const kirik = k.yol.filter(function (a) { return !yerVar(ce.harita, a.yer); });
      if (kirik.length) {
        sorunlar.push({ metin: "Claude'un evreni · " + k.ad + ": yolunda " + kirik.length + " adım silinmiş bir yere gidiyor", duzelt: function () {
          k.yol = k.yol.filter(function (a) { return yerVar(ce.harita, a.yer); });
          if (!k.yol.length) { delete k.yol; }
        } });
      }
    });
    const idler = {};
    kisiler.forEach(function (k) { idler[k.id] = true; });
    const kopuk = (ce.baglar || []).filter(function (b) { return !idler[b.a] || !idler[b.b]; });
    if (kopuk.length) {
      sorunlar.push({ metin: "Claude'un evreni: " + kopuk.length + " bağ silinmiş bir kişiye gidiyor", duzelt: function () {
        ce.baglar = ce.baglar.filter(function (b) { return idler[b.a] && idler[b.b]; });
      } });
    }
  }

  [v.karakterler || [], (ce && ce.kisiler) || []].forEach(function (l) {
    l.forEach(function (k) {
      if (k.canli && typeof gzCanliTemizle === "function" && !gzCanliTemizle(k.canli)) {
        sorunlar.push({ metin: k.ad + ": canlı yolculuk ayarı bozuk", duzelt: function () { delete k.canli; } });
      }
    });
  });
  return { sorunlar: sorunlar };
}

/** Sorunları gösterir; düzeltilebilenleri düzeltir. Kaydetmeye devam edilsin mi? */
function veriDenetimOnayi() {
  const r = veriDenetle();
  if (!r.sorunlar.length) { return true; }
  const duzelir = r.sorunlar.filter(function (s) { return s.duzelt; });
  const liste = r.sorunlar.slice(0, 10).map(function (s) { return "• " + s.metin; }).join("\n") + (r.sorunlar.length > 10 ? "\n• …ve " + (r.sorunlar.length - 10) + " sorun daha" : "");
  const soru = "Kaydetmeden önce " + r.sorunlar.length + " sorun bulundu:\n\n" + liste + "\n\n" +
    (duzelir.length ? "Tamam: " + (duzelir.length === r.sorunlar.length ? "hepsini" : duzelir.length + " tanesini") + " düzeltip kaydet · İptal: kaydetme" : "Tamam: yine de kaydet · İptal: kaydetme");
  if (!confirm(soru)) {
    if (typeof yoneticiDurum === "function") { yoneticiDurum("Kaydedilmedi: " + r.sorunlar.length + " sorun var (" + r.sorunlar[0].metin + (r.sorunlar.length > 1 ? "…" : "") + ")", false); }
    return false;
  }
  duzelir.forEach(function (s) { try { s.duzelt(); } catch (_) { /* geç */ } });
  return true;
}

if (typeof githubGonder === "function") {
  const eskiGonder = githubGonder;
  window.githubGonder = function () {
    if (!veriDenetimOnayi()) { return Promise.resolve(); }
    return eskiGonder.apply(this, arguments);
  };
}
