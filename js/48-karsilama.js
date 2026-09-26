/* Karşılama ve ziyaret sayacı.

   - /basla/ (#/basla): Instagram gibi dışarıdan gelenler için kısa tanıtım. Başlangıç kodunu tek dokunuşla
     girer, evrenlere ve oyunlara yönlendirir, hesap açmayı önerir.
   - Ziyaret sayacı: kişisel veri tutmadan günlük toplam sayılar (Supabase olay_say). Hangi sayfadan girildiği,
     Instagram'dan mı gelindiği, karşılamanın açılması, başlangıç kodunun girilmesi. Aynı olay oturumda bir kez
     sayılır. Panel → Bakım → İstatistik'te görünür. */

const OLAY_AD = /^[a-z0-9_:]{1,40}$/;

/** Günlük sayaca bir ekler. Hesap kütüphanesi yüklenmez: doğrudan Supabase REST uç noktasına küçük bir istek. */
function olaySay(ad, herSefer) {
  try {
    if (!OLAY_AD.test(ad) || typeof HESAP_AYAR === "undefined" || !HESAP_AYAR.url || !HESAP_AYAR.anahtar) { return; }
    if (location.protocol.indexOf("http") !== 0 || /^(localhost|127\.)/.test(location.hostname) && !window.__olayTest) { return; }
    if (!herSefer) {
      const k = "tentiforapp_olay_" + ad;
      try { if (sessionStorage.getItem(k)) { return; } sessionStorage.setItem(k, "1"); } catch (_) { /* yok */ }
    }
    fetch(HESAP_AYAR.url + "/rest/v1/rpc/olay_say", {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", apikey: HESAP_AYAR.anahtar, Authorization: "Bearer " + HESAP_AYAR.anahtar },
      body: JSON.stringify({ p_ad: ad })
    }).catch(function () { /* sayaç kurulmamış olabilir */ });
  } catch (_) { /* sayaç hiçbir şeyi bozmasın */ }
}

/** İlk açılış: nereden girildi, Instagram'dan mı gelindi. */
function girisSay() {
  const r = rota().replace(/^#\/?/, "").split("/")[0] || "ana";
  const sayfa = r === "ev" ? "evren" : r;
  olaySay("giris:" + (/^[a-z0-9]{1,20}$/i.test(sayfa) ? sayfa.toLowerCase() : "diger"));
  const ua = navigator.userAgent || "";
  const kaynak = /Instagram/i.test(ua) || /[?&](utm_source=ig|utm_source=instagram|ref=ig)/i.test(location.search) ? "instagram"
    : (/FBAN|FBAV/i.test(ua) ? "facebook" : (/WhatsApp/i.test(ua) ? "whatsapp" : ""));
  if (kaynak) { olaySay("kaynak:" + kaynak); }
}

/* ==================== karşılama ==================== */

function karsilamaAc() {
  olaySay("basla_acildi");
  let s = document.querySelector("#karsilama");
  if (!s) {
    s = document.createElement("div");
    s.id = "karsilama";
    s.className = "evren-sayfa karsilama";
    s.setAttribute("role", "dialog");
    s.setAttribute("aria-modal", "true");
    s.setAttribute("aria-label", "Tentiforverse'e hoş geldin");
    document.body.appendChild(s);
    document.documentElement.classList.add("evren-acik");
  }
  document.title = "Başla — TentiforApp";
  const kod = (veri && veri.baslangicKodu) || "";
  const kart = function (git, baslik, metin) {
    return '<button class="krs-kart" data-krs-git="' + kacir(git) + '"><b>' + kacir(baslik) + "</b><span>" + kacir(metin) + "</span></button>";
  };
  s.innerHTML =
    '<div class="evs-govde krs-govde">' +
      '<p class="oyun-etiket">Tentiforverse</p>' +
      "<h1>Hoş geldin, gezgin.</h1>" +
      '<p class="krs-giris">Tömye\'nin gökyüzünde ay yoktur, ama ayları 28 gün çeker. Burası Tentiforverse\'ün arşivi: karakterler, evrenler, ' +
        "kilitli kayıtlar ve oyunlar. Her evrenin kendi parası, kendi sırları var; bazıları kodla açılır.</p>" +
      (kod ? '<div class="kutu-y krs-kod"><div><span class="oyun-not">Başlangıç kodu</span><b class="krs-kod-yazi">' + kacir(kod) + "</b></div>" +
        '<button class="dugme" data-krs-kod>Kodu gir ve arşivi aç</button></div>' : "") +
      '<div class="krs-kartlar">' +
        kart("#/arsiv", "Tömye · 24. Evren", "Karakterler, kozmoloji ve buz altındaki kayıtlar.") +
        kart("#/ev/site/e25", "E25", "Evrengezerlerin evreni. Kendi Evrengezerini de ekleyebilirsin.") +
        kart("#/ev/e99", "E99", "Bomboş bir evren: kuralını, kişisini, haritasını sen yaz.") +
        kart("#/oyunlar", "Oyunlar", "Nöbet, Şafak Yürüyüşü, Tanık Ayna ve daha fazlası.") +
        kart("yeni-evren", "Kendi evrenini kur", "Haritasını çiz, alfabesini ve parasını belirle.") +
      "</div>" +
      '<div class="oyun-sira krs-alt">' +
        (typeof hesapPencere === "function" ? '<button class="dugme dugme-sade" data-krs-hesap>Hesap aç — ilerlemen cihazlar arasında kalsın</button>' : "") +
        '<button class="dugme dugme-sade" data-krs-kapat>Siteye geç →</button>' +
      "</div>" +
    "</div>";
  const b = s.querySelector("[data-krs-kod]") || s.querySelector(".krs-kart");
  if (b) { b.focus({ preventScroll: true }); }
}

function karsilamaKapat(git) {
  const s = document.querySelector("#karsilama");
  if (s) { s.remove(); }
  if (!document.querySelector("#evrenSayfa")) { document.documentElement.classList.remove("evren-acik"); }
  if (git) { location.hash = git; }
}

window.addEventListener("hashchange", function () {
  if (rota().indexOf("#/basla") !== 0 && document.querySelector("#karsilama")) { karsilamaKapat(); }
});

document.addEventListener("click", function (ev) {
  const h = ev.target.closest("[data-krs-kod], [data-krs-git], [data-krs-hesap], [data-krs-kapat]");
  if (!h) { return; }
  if (h.hasAttribute("data-krs-kod")) {
    olaySay("basla_kod");
    karsilamaKapat("#/arsiv");
    setTimeout(function () { if (typeof baslangicUygula === "function") { baslangicUygula(); } }, 150);
    return;
  }
  if (h.dataset.krsGit === "yeni-evren") {
    karsilamaKapat();
    if (typeof evrenYeniKur === "function") { const id = evrenYeniKur(); evrenSonrakiSekme = "bilgi"; location.hash = "#/ev/benim/" + id; }
    return;
  }
  if (h.dataset.krsGit) { karsilamaKapat(h.dataset.krsGit); return; }
  if (h.hasAttribute("data-krs-hesap")) { karsilamaKapat("#/sen"); setTimeout(function () { hesapPencere("kayit"); }, 150); return; }
  if (h.hasAttribute("data-krs-kapat")) { karsilamaKapat("#/arsiv"); }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && document.querySelector("#karsilama")) { karsilamaKapat("#/arsiv"); }
});

window.addEventListener("load", function () { setTimeout(girisSay, 1500); });

/* ==================== panel: ziyaret sayacı (İstatistik sekmesinin altında) ==================== */

const OLAY_ADLARI = {
  basla_acildi: "Karşılama açıldı", basla_kod: "Karşılamadan kod girildi", baslangic_kodu: "Başlangıç kodu girildi",
  "kaynak:instagram": "Instagram'dan gelen", "kaynak:facebook": "Facebook'tan gelen", "kaynak:whatsapp": "WhatsApp'tan gelen"
};

function olayAdi(ad) {
  if (OLAY_ADLARI[ad]) { return OLAY_ADLARI[ad]; }
  if (ad.indexOf("giris:") === 0) { return "Giriş: /" + ad.slice(6) + "/"; }
  return ad;
}

async function olaySayilariCiz() {
  const alan = document.querySelector("#yIstAlan");
  if (!alan || typeof bakimIstemci !== "function") { return; }
  let kutu = document.querySelector("#yOlayAlan");
  if (!kutu) { kutu = document.createElement("div"); kutu.id = "yOlayAlan"; kutu.className = "olay-alan"; alan.appendChild(kutu); }
  const ist = await bakimIstemci(kutu);
  if (!ist) { return; }
  const { data, error } = await ist.rpc("olay_sayilari", { p_gun: 14 });
  if (error) { kutu.innerHTML = '<p class="oyun-not">Ziyaret sayacı kurulu değil: Kurulum sekmesinden kurulum.sql\'i yeniden çalıştır.</p>'; return; }
  const toplam = {}, bugun = {};
  const gun = new Date().toISOString().slice(0, 10);
  (data || []).forEach(function (r) {
    toplam[r.ad] = (toplam[r.ad] || 0) + Number(r.sayi || 0);
    if (String(r.gun).slice(0, 10) === gun) { bugun[r.ad] = (bugun[r.ad] || 0) + Number(r.sayi || 0); }
  });
  const adlar = Object.keys(toplam).sort(function (a, b) { return toplam[b] - toplam[a]; });
  kutu.innerHTML = '<h4 class="olay-baslik">Ziyaret sayacı · son 14 gün</h4>' +
    '<p class="oyun-not">Kişisel veri yok: yalnızca günlük toplamlar. Aynı kişi bir oturumda bir kez sayılır.</p>' +
    (adlar.length ? '<table class="olay-tablo"><thead><tr><th>Olay</th><th>Bugün</th><th>14 gün</th></tr></thead><tbody>' +
      adlar.map(function (a) { return "<tr><td>" + kacir(olayAdi(a)) + "</td><td>" + istSayi(bugun[a] || 0) + "</td><td>" + istSayi(toplam[a]) + "</td></tr>"; }).join("") +
      "</tbody></table>" : '<p class="oyun-not">Henüz kayıt yok.</p>');
}

document.addEventListener("DOMContentLoaded", function () {
  /* İstatistik sekmesi çizildikten sonra sayacı altına ekle */
  if (typeof yoneticiIstatistikYukle === "function") {
    const eski = yoneticiIstatistikYukle;
    window.yoneticiIstatistikYukle = async function () {
      const r = await eski.apply(this, arguments);
      try { await olaySayilariCiz(); } catch (_) { /* sayaç panelin kalanını bozmasın */ }
      return r;
    };
  }
});
