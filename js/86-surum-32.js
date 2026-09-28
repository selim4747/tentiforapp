/* Sürüm 3.2 — sade arayüz (görünümün çoğu css/style.css sonundaki 3.2 bloğunda).
   Burada: sayfa başlığı ile ilk bölümün başlığı aynıysa ikincisi gizlenir ("Oyunlar / Oyunlar" tekrarı),
   tek bölümlü sayfada tek çipli "Bu sayfada" satırı gösterilmez. */

function sadeBaslikTekrari(sayfa) {
  document.querySelectorAll("section.bolum.baslik-tekrar").forEach(function (s) { s.classList.remove("baslik-tekrar"); });
  const sb = document.querySelector("#sayfaBasi");
  if (!sb || sb.hidden) { return; }
  const h1 = sb.querySelector("h1");
  const ilk = Array.prototype.find.call(document.querySelectorAll("main section.bolum"), function (s) { return !s.hidden; });
  const h2 = ilk && ilk.querySelector(".bolum-basi h2");
  const bicim = function (t) { return String(t || "").trim().toLocaleLowerCase("tr"); };
  if (h1 && h2 && bicim(h1.textContent) === bicim(h2.textContent)) { ilk.classList.add("baslik-tekrar"); }
  const cipler = sb.querySelector(".sayfa-icerik");
  if (cipler) { cipler.classList.toggle("tek-cip", cipler.children.length < 2); }
}

if (typeof sayfaBasiCiz === "function") {
  const eskiSBC32 = sayfaBasiCiz;
  window.sayfaBasiCiz = function (sayfa) {
    const r = eskiSBC32.apply(this, arguments);
    /* bölümlerin gizlenip açılması aynı karede biter: ölçüm bir sonraki karede */
    requestAnimationFrame(function () { try { sadeBaslikTekrari(sayfa); } catch (_) { /* yok */ } });
    return r;
  };
}

/* 3.2.2: Tentiforverse kartları ("#/arsiv": evren seçici, E25 kapısı, atölye) Tömye sayfasını açar.
   Değer korunur (karşılaştırmalar ona bakıyor); ana sayfadaki Tömye kartı kendi düğmeleriyle kalır. */
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest('[data-evren-git="#/arsiv"]');
  if (!b || b.closest("#anaEvrenler")) { return; }
  ev.preventDefault(); ev.stopImmediatePropagation();
  if (typeof evrenSeciciKapat === "function" && document.querySelector("#evrenSecici")) { evrenSeciciKapat(); }
  if (typeof evrenSayfaKapat === "function" && document.querySelector("#evrenSayfa")) { evrenSayfaKapat(); }
  location.hash = "#/tomye";
}, true);
