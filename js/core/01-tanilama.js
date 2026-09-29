/* Tanılama şeridi: yakalanmayan bir hata olursa ekranın altında görünür.
   "Kopyala" ile tam metni (hata, sürüm, adres, tarayıcı) panoya alabilirsin;
   yenileyince çıkan tuhaf hataları böyle yakalayacağız. */
(function () {
  var goruldu = {};
  function detay(baslik, mesaj, yigin) {
    var sur = "";
    try { sur = (window.veri && window.veri.surum) || (window.__VERI__ && window.__VERI__.surum) || ""; } catch (e) {}
    return baslik + ": " + mesaj + "\n" + (yigin ? yigin + "\n" : "") +
      "sürüm: " + sur + "\nadres: " + location.href.slice(0, 160) + "\ntarayıcı: " + navigator.userAgent;
  }
  window.tanilamaGoster = function (baslik, mesaj, yigin) {
    var anahtar = baslik + mesaj;
    if (goruldu[anahtar]) { return; }
    goruldu[anahtar] = true;
    /* yöneticiye de gitsin (32-bakim.js hazır değilse kuyrukta bekler) */
    var kayit = { baslik: baslik, mesaj: mesaj, yigin: yigin || "" };
    if (typeof window.hataGonder === "function") { window.hataGonder(kayit); }
    else { (window.__hataKuyrugu = window.__hataKuyrugu || []).push(kayit); }
    function kur() {
      var kutu = document.getElementById("tanilamaSeridi");
      if (!kutu) {
        kutu = document.createElement("div");
        kutu.id = "tanilamaSeridi";
        kutu.setAttribute("role", "alert");
        kutu.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2000;background:#7a1f1f;color:#fff;" +
          "font:12px/1.5 ui-monospace,monospace;padding:10px 14px;display:flex;gap:10px;align-items:flex-start;" +
          "box-shadow:0 -4px 16px rgba(0,0,0,.3)";
        kutu.innerHTML = '<div id="tanilamaMetin" style="flex:1;min-width:0;word-break:break-word"></div>' +
          '<button type="button" id="tanilamaKopya" style="flex-shrink:0;font:inherit;padding:4px 10px;border:1px solid #fff;background:transparent;color:#fff;cursor:pointer">Kopyala</button>' +
          '<button type="button" id="tanilamaKapat" style="flex-shrink:0;font:inherit;padding:4px 10px;border:1px solid #fff;background:transparent;color:#fff;cursor:pointer">Kapat</button>';
        document.body.appendChild(kutu);
        kutu.querySelector("#tanilamaKapat").onclick = function () { kutu.remove(); };
        kutu.querySelector("#tanilamaKopya").onclick = function () {
          var metin = kutu.getAttribute("data-detay") || "";
          try { navigator.clipboard.writeText(metin); } catch (e) {
            var t = document.createElement("textarea"); t.value = metin; document.body.appendChild(t); t.select();
            try { document.execCommand("copy"); } catch (e2) {} t.remove();
          }
          this.textContent = "Kopyalandı";
        };
      }
      kutu.querySelector("#tanilamaMetin").textContent = baslik + ": " + mesaj;
      kutu.setAttribute("data-detay", detay(baslik, mesaj, yigin));
    }
    if (document.body) { kur(); } else { document.addEventListener("DOMContentLoaded", kur); }
  };
  /* 3.0: yayında betikler birkaç pakette birleşik (scripts/paketle.mjs). Hata yerini asıl dosya adıyla yaz:
     "paket-2.js?v=…:14:803" → "28-hesap.js (paket-2.js:14:803)". Tabloyu her paketin ilk satırı kurar. */
  function paketDosyasi(ad, satir) {
    var t = (window.__PAKET__ || {})[ad];
    if (!t) { return ""; }
    var bulunan = "";
    for (var i = 0; i < t.length; i++) { if (t[i][0] <= satir) { bulunan = t[i][1]; } }
    return bulunan;
  }
  function yiginCevir(y) {
    return String(y || "").replace(/(paket-\d+\.js)(?:\?v=\w+)?:(\d+)(?::(\d+))?/g, function (tam, ad, sat, sut) {
      var d = paketDosyasi(ad, Number(sat));
      return d ? d + " (" + ad + ":" + sat + (sut ? ":" + sut : "") + ")" : tam;
    });
  }
  window.hataYeriCevir = yiginCevir;
  window.addEventListener("error", function (e) {
    if (!e.message) { return; }
    var ad = String(e.filename || "").split("/").pop().replace(/\?.*$/, "");
    var d = paketDosyasi(ad, e.lineno);
    window.tanilamaGoster("Hata", e.message + " (" + (d ? d + ", " + ad : ad) + ":" + e.lineno + ")",
      e.error && e.error.stack ? yiginCevir(String(e.error.stack)).slice(0, 600) : "");
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    window.tanilamaGoster("Söz reddi", String((r && r.message) || r), r && r.stack ? yiginCevir(String(r.stack)).slice(0, 600) : "");
  });
})();
