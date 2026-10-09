/* 6.3 ziyaretçi sırası: okuma kapısı, evren salonu, eçka, taslak, sözlük, kaldığın yer. */
(function () {
  var KALAN = "tentiforapp_kalinan";
  var TASLAK = "tentiforapp_fan_taslak";
  var IP = "tentiforapp_arac_ipucu";
  var KAPILAR = {
    e25: { ad: "E25 · Kapılar Salonu", metin: "Evrengezerlerin evreni. Beyaz Taşlar kapıları açar; melezlerin kaydı burada ve Tömye'de ortaktır." },
    e99: { ad: "E99 · Açık salon", metin: "Herkesin yazabildiği evren. Kanon değildir; eklenen kayıt onaydan sonra keşifte görünür." },
    e126: { ad: "E126 · Okur evreni", metin: "Okurların kurduğu kayıt. Başlığı okunur ve onaylıysa ana sayfa şeridine çıkar." }
  };

  function kayitOku(anahtar) { try { return localStorage.getItem(anahtar); } catch (e) { return ""; } }
  function kayitYaz(anahtar, deger) { try { localStorage.setItem(anahtar, deger); } catch (e) {} }
  function girisli() { return typeof hesapProfil !== "undefined" && hesapProfil && hesapProfil.id; }
  function kac(s) { return String(s || "").replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">"); }

  function tomyeBugun() {
    var t = (typeof veri !== "undefined" && veri && veri.takvim) || {};
    var aylar = t.aylar || [];
    var yilGun = t.yilGun || 310;
    var epok = new Date((t.epokDunya || "2000-01-01") + "T00:00:00");
    var bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    var gun = Math.floor((bugun - epok) / 86400000);
    if (!aylar.length || gun < 0) return "";
    var yil = Math.floor(gun / yilGun) + (t.epokYil || 1);
    var kalan = gun % yilGun;
    var ay = aylar[0], i;
    for (i = 0; i < aylar.length; i++) { if (kalan < aylar[i].gun) { ay = aylar[i]; break; } kalan -= aylar[i].gun; }
    return (kalan + 1) + " " + ay.ad + " " + yil;
  }

  function kalaniYaz(yer, ad) {
    var kayit = { yer: yer, ad: ad, t: Date.now() };
    kayitYaz(KALAN, JSON.stringify(kayit));
    if (girisli() && typeof hesapAyarYaz === "function") { try { hesapAyarYaz("kalinan", kayit); } catch (e) {} }
  }
  function kalaniOku() {
    try { return JSON.parse(kayitOku(KALAN) || "null"); } catch (e) { return null; }
  }

  function panel(id, html) {
    var el = document.getElementById(id);
    if (!el) { el = document.createElement("section"); el.id = id; el.className = "kutu-y sira-kutu"; var kok = document.querySelector("main") || document.body; kok.insertBefore(el, kok.firstChild); }
    el.innerHTML = html;
    return el;
  }

  function okumayiAc() {
    location.hash = "#/okuma";
    setTimeout(function () {
      panel("siraOkuma", '<p class="oyun-etiket">İlk açık sayfa</p><h2>Gece Vardiyası</h2><p>Roman Delilik kilitli: spoiler içeren bölümler oyun ve kodla açılır. Bu kısa kayıt kilitsiz.</p><button type="button" class="dugme" data-sira-git="hikaye">Gece Vardiyasını aç</button>');
      var hedef = document.getElementById("hikaye");
      if (hedef) hedef.scrollIntoView({ behavior: "smooth", block: "start" });
      kalaniYaz("#/okuma", "Gece Vardiyası");
    }, 250);
  }

  function oyunuAc() {
    location.hash = "#/oyunlar";
    setTimeout(function () {
      panel("siraOyun", '<p class="oyun-etiket">Bugünkü oyun</p><h2>Nöbet</h2><p>Eçka oyunlardan biriken iç puandır. Nöbet bitince tema, galeri ve kilitli bir oyun açılabilir.</p><button type="button" class="dugme" data-gez-git="oyunlar">Oyunları aç</button>');
      kalaniYaz("#/oyunlar", "Nöbet");
    }, 250);
  }

  function kapiCiz() {
    var parca = (location.pathname.split("/")[2] || "").toLowerCase();
    var kapi = KAPILAR[parca];
    var eski = document.getElementById("siraKapi");
    if (!kapi) { if (eski) eski.remove(); return; }
    panel("siraKapi", '<p class="oyun-etiket">Evren kapısı</p><h2>' + kac(kapi.ad) + '</h2><p>' + kac(kapi.metin) + '</p><a class="dugme" href="#/tomye">Tömye arşivine dön</a>');
    document.querySelectorAll("main h1, main h2").forEach(function (b) {
      if (/^Fan/.test(b.textContent || "") && b.closest("#siraKapi") == null) b.closest("section, article, div") && b.closest("section, article, div").classList.add("sira-gizle-fan");
    });
    kalaniYaz(location.pathname, kapi.ad);
  }

  function e26Onizleme() {
    document.querySelectorAll(".ana-evren, .evren-kart, article").forEach(function (kart) {
      if (!/E26/.test(kart.textContent || "") || kart.querySelector(".sira-e26")) return;
      var n = document.createElement("p");
      n.className = "oyun-not sira-e26";
      n.textContent = "Herkesin saçına bağlı konuşma topu vardır. Bu kilit oyunla açılır.";
      kart.appendChild(n);
    });
  }

  function eckaYazi() {
    var et = document.querySelector(".cuzdan-etiket");
    if (et) et.textContent = "eçka";
    var btn = document.getElementById("cuzdanRozet");
    if (btn) btn.title = "Eçka, oyunlardan biriken iç puan. Başlangıç bakiyesi yeni cihazda görünür.";
  }

  function tarihSeridi() {
    var hero = document.querySelector(".hero-metin");
    if (!hero || document.getElementById("siraTarih")) return;
    var p = document.createElement("p");
    p.id = "siraTarih";
    p.className = "oyun-not";
    var kalan = kalaniOku();
    p.innerHTML = "Tömye'de bugün " + kac(tomyeBugun()) + ". Arşivde bu gün, ayların neden sayıldığının hâlâ bilinmediği gündür." + (kalan && kalan.ad ? ' <button type="button" class="dugme dugme-sade" data-sira-kal="1">Kaldığın yer: ' + kac(kalan.ad) + "</button>" : "");
    hero.insertAdjacentElement("afterend", p);
  }

  function fanTaslak() {
    if (!/\/fan\/?/.test(location.pathname) && location.hash.indexOf("#/fan") !== 0) return;
    if (document.getElementById("siraTaslak")) return;
    var kok = document.querySelector("#fan") || document.querySelector("main");
    if (!kok) return;
    var kutu = document.createElement("form");
    kutu.id = "siraTaslak";
    kutu.className = "kutu-y sira-kutu";
    kutu.innerHTML = '<p class="oyun-etiket">Taslak</p><h2>Burada yaz</h2><p>Taslak bu cihazda kalır. Göndermek için giriş gerekir; dosya indirmek ikinci yoldur.</p><input class="kod-giris" name="baslik" placeholder="Başlık" maxlength="80"><textarea class="kod-giris" name="metin" rows="5" maxlength="4000" placeholder="Kısa hikâye"></textarea><button class="dugme" type="submit">Taslağı sakla</button> <button class="dugme dugme-sade" type="button" data-sira-gonder="1">Gönder</button>';
    kok.insertBefore(kutu, kok.firstChild);
    try { var eski = JSON.parse(kayitOku(TASLAK) || "null"); if (eski) { kutu.baslik.value = eski.baslik || ""; kutu.metin.value = eski.metin || ""; } } catch (e) {}
    kutu.addEventListener("submit", function (e) { e.preventDefault(); kayitYaz(TASLAK, JSON.stringify({ baslik: kutu.baslik.value, metin: kutu.metin.value })); kutu.insertAdjacentHTML("beforeend", '<p class="pencere-durum iyi">Bu cihaza saklandı.</p>'); });
  }

  function sozlukAc(terim) {
    var liste = (typeof veri !== "undefined" && veri && veri.sozluk) || [];
    var kayit = liste.find(function (x) { return x && terim && String(x.terim).toLocaleLowerCase("tr") === terim.toLocaleLowerCase("tr"); });
    if (!kayit) return;
    var kutu = document.getElementById("siraSozluk") || document.createElement("aside");
    kutu.id = "siraSozluk";
    kutu.className = "kutu-y sira-sozluk";
    kutu.innerHTML = "<b>" + kac(kayit.terim) + "</b><p>" + kac(kayit.tanim) + '</p><button type="button" data-sira-kapat="1">Kapat</button>';
    document.body.appendChild(kutu);
  }

  function ipucu() {
    if (kayitOku(IP) === "1") return;
    document.querySelectorAll("#temaAnahtar, #rastgeleBtn, #btnTerminalUst, #cuzdanRozet").forEach(function (el) {
      el.classList.add("sira-etiketli");
    });
  }

  document.addEventListener("click", function (e) {
    var oku = e.target.closest && e.target.closest("[data-gez-git='sira'], [data-sira='oku']");
    if (oku || (e.target.closest && e.target.closest("button") && /Okumaya başla/.test(e.target.closest("button").textContent || ""))) { e.preventDefault(); okumayiAc(); return; }
    var oyna = e.target.closest && e.target.closest("[data-sira='oyna']");
    if (oyna || (e.target.closest && e.target.closest("button") && /Oynamaya başla/.test(e.target.closest("button").textContent || ""))) { e.preventDefault(); oyunuAc(); return; }
    var git = e.target.closest && e.target.closest("[data-sira-git]");
    if (git) { location.hash = "#/" + git.getAttribute("data-sira-git"); return; }
    var kal = e.target.closest && e.target.closest("[data-sira-kal]");
    if (kal) { var k = kalaniOku(); if (k && k.yer) location.hash = k.yer.indexOf("#") === 0 ? k.yer : "#/okuma"; return; }
    var gonder = e.target.closest && e.target.closest("[data-sira-gonder]");
    if (gonder) { if (!girisli()) { alert("Taslak duruyor. Göndermek için giriş yap."); var b = document.querySelector("#hesapBtn, .hesap-btn"); if (b) b.click(); return; } alert("Gönderim sırası açılınca bu taslak fan kuyruğuna düşer."); return; }
    if (e.target.closest && e.target.closest("[data-sira-kapat]")) { var s = document.getElementById("siraSozluk"); if (s) s.remove(); return; }
    var yildiz = e.target.closest && e.target.closest(".ana-yildiz, [data-yildiz]");
    if (yildiz && !girisli()) { e.preventDefault(); e.stopPropagation(); alert("Kaydetmek için giriş yap."); return; }
    var soz = e.target.closest && e.target.closest(".sozluk-terim, [data-terim]");
    if (soz) sozlukAc(soz.getAttribute("data-terim") || soz.textContent);
    if (e.target.closest && e.target.closest("#temaAnahtar, #rastgeleBtn, #btnTerminalUst")) kayitYaz(IP, "1");
  }, true);

  document.addEventListener("mouseup", function () {
    var sec = String(window.getSelection && window.getSelection());
    if (sec && sec.length < 40) sozlukAc(sec.trim());
  });

  function kur() { eckaYazi(); tarihSeridi(); kapiCiz(); e26Onizleme(); fanTaslak(); ipucu(); }
  document.addEventListener("DOMContentLoaded", kur);
  window.addEventListener("hashchange", kur);
  window.addEventListener("popstate", kur);
  new MutationObserver(function () { e26Onizleme(); eckaYazi(); }).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(kur, 600);
})();
