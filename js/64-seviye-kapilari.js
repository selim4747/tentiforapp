/* Seviye kapıları: XP arttıkça site yavaş yavaş açılır.
   - Üretim: 5. seviyede fan hikâyesi yazmak, 10. seviyede Evrengezer yaratmak, 15. seviyede fan evreni kurmak.
     (Önceden yazdıkların hep açık; kapı yalnızca yenisini başlatırken sorar.)
   - İkincil bilgiler: ana hikâye ve arşiv her zaman açık; yan bölümler (basın kiti, moodboard, yankılar…) seviye
     geldikçe açılır.
   Seviye: hesabın varsa sunucudaki XP (arsivci_seviyeleri); yoksa bu cihazdaki ilerlemeden aynı formülle
   tahmin (arşiv tamlığı, gelinen günler, madalyalar, buz katmanları). İkisinden büyük olanı geçerli. */

const SEVIYE_URETIM = {
  hikaye: { seviye: 5, ad: "Fan hikâyesi yazmak" },
  kisi: { seviye: 10, ad: "Evrengezer yaratmak" },
  evren: { seviye: 15, ad: "Fan evreni kurmak" }
};

/* yan bölümler: bölüm kimliği → açıldığı seviye */
const SEVIYE_BOLUMLER = {
  moodboard: 2, basin: 2, yankilar: 3, isim: 3, sohbet: 4, karsi: 4, bilinmeyenler: 5, dosyalar: 6
};

const SVK = { sunucu: 0, istendi: false, onbellek: null, zaman: 0 };

function svkXpSeviye(xp) { return Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1; }
function svkSeviyeXp(s) { return 40 * (s - 1) * (s - 1); }

/** Bu cihazdaki ilerlemeden XP (sunucudaki formülün cihazda bilinen kısmı). */
function yerelXp() {
  let xp = 0;
  try { xp += 20 * ((typeof tamlikHesapla === "function" && tamlikHesapla().yuzde) || 0); } catch (_) { /* yok */ }
  try {
    const o = typeof arsivciOlculeri === "function" ? arsivciOlculeri() : {};
    xp += 5 * (o.gun || 0) + 40 * (o.katman || 0);
  } catch (_) { /* yok */ }
  try { xp += 30 * ((typeof arsivciMadalyalari === "function" && arsivciMadalyalari().length) || 0); } catch (_) { /* yok */ }
  return Math.round(xp);
}

/** Hesabın sunucudaki XP'si (oturum başına bir kez sorulur). */
async function svkSunucuYukle() {
  if (SVK.istendi || typeof hesapIstemci === "undefined" || !hesapIstemci || typeof hesapProfil === "undefined" || !hesapProfil || !hesapProfil.kullanici_adi) { return; }
  SVK.istendi = true;
  try {
    const r = await hesapIstemci.from("arsivci_seviyeleri").select("xp").eq("kullanici_adi", hesapProfil.kullanici_adi).maybeSingle();
    if (r && r.data) { SVK.sunucu = Number(r.data.xp) || 0; SVK.onbellek = null; }
  } catch (_) { SVK.istendi = false; }
}

/** { seviye, xp, sonraki: sonraki seviyenin XP'si } */
function seviyeDurumu() {
  if (SVK.onbellek && Date.now() - SVK.zaman < 4000) { return SVK.onbellek; }
  svkSunucuYukle();
  let xp = Math.max(SVK.sunucu, yerelXp());
  /* yalnızca yerel testte: seviye elle yükseltilebilir */
  try { if (/^(localhost|127\.)/.test(location.hostname)) { const t = Number(localStorage.getItem("tentiforapp_seviye_test")); if (t > 0) { xp = Math.max(xp, svkSeviyeXp(t)); } } } catch (_) { /* yok */ }
  const s = svkXpSeviye(xp);
  SVK.onbellek = { seviye: s, xp: xp, sonraki: svkSeviyeXp(s + 1) };
  SVK.zaman = Date.now();
  return SVK.onbellek;
}

function svkYonetici() { return typeof yoneticiAcik === "function" && yoneticiAcik(); }

function seviyeYeter(gereken) { return svkYonetici() || seviyeDurumu().seviye >= gereken; }

/** "Seviye 5'te açılır · şu an 3 · 240 XP kaldı" */
function seviyeKapiMetni(gereken) {
  const d = seviyeDurumu();
  const kalan = Math.max(0, svkSeviyeXp(gereken) - d.xp);
  return "Seviye " + gereken + "'te açılır · şu an Seviye " + d.seviye + " · " + kalan + " XP kaldı";
}

function seviyeCubukHtml(gereken) {
  const d = seviyeDurumu();
  const hedef = svkSeviyeXp(gereken);
  const oran = Math.max(2, Math.min(100, Math.round(100 * d.xp / Math.max(1, hedef))));
  return '<span class="svk-cubuk" aria-hidden="true"><i style="width:' + oran + '%"></i></span>';
}

const SVK_NASIL = "XP; okuyarak (arşiv tamlığı), her gün gelerek, madalya ve buz katmanlarıyla birikir. Hesabın varsa yarışlar, " +
  "günün kelimesi, teoriler ve keşifler de sayılır.";

/** Kapıya takılınca açılan küçük pencere. */
function seviyeUyari(tur) {
  const k = SEVIYE_URETIM[tur];
  if (!k || typeof perdeAc !== "function" && !document.querySelector("#perde")) { return; }
  const hesapYok = typeof hesapKullanici === "undefined" || !hesapKullanici;
  const p = document.querySelector("#perde");
  p.innerHTML = '<div class="pencere svk-pencere" role="dialog" aria-modal="true">' +
    '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
    '<div class="svk-kilit" aria-hidden="true">🔒</div>' +
    "<h3>" + kacir(k.ad) + "</h3>" +
    '<p class="pencere-alt">' + kacir(seviyeKapiMetni(k.seviye)) + "</p>" + seviyeCubukHtml(k.seviye) +
    '<p class="oyun-not">' + kacir(SVK_NASIL) + "</p>" +
    '<ul class="svk-yol">' + Object.keys(SEVIYE_URETIM).map(function (t) {
      const x = SEVIYE_URETIM[t];
      return '<li class="' + (seviyeYeter(x.seviye) ? "acik" : "") + '"><b>Seviye ' + x.seviye + "</b> · " + kacir(x.ad) + (seviyeYeter(x.seviye) ? " ✓" : "") + "</li>";
    }).join("") + "</ul>" +
    '<div class="oyun-sira">' + (hesapYok ? '<button class="dugme" data-svk-hesap="1">Hesap aç — XP her yerde sayılsın</button>' : "") +
      '<a class="dugme dugme-sade" href="#/oyunlar" data-kapat="1">Oyna, XP kazan</a></div></div>';
  p.hidden = false;
}

/* ---------- üretim kapıları ---------- */

if (typeof fanYeni === "function") {
  const eskiFanYeni = fanYeni;
  window.fanYeni = function (tur) {
    if (SEVIYE_URETIM[tur] && !seviyeYeter(SEVIYE_URETIM[tur].seviye)) { seviyeUyari(tur); return null; }
    return eskiFanYeni.apply(this, arguments);
  };
}
if (typeof evrenYeniKur === "function") {
  const eskiKur = evrenYeniKur;
  window.evrenYeniKur = function () {
    if (!seviyeYeter(SEVIYE_URETIM.evren.seviye)) { seviyeUyari("evren"); return null; }
    return eskiKur.apply(this, arguments);
  };
}
if (typeof kisiKaydet === "function") {
  const eskiKisiKaydet = kisiKaydet;
  window.kisiKaydet = function (id) {
    /* yenisini yaratmak kapıda; var olanı düzenlemek serbest */
    if (!id && !seviyeYeter(SEVIYE_URETIM.kisi.seviye)) { seviyeUyari("kisi"); return Promise.resolve("Evrengezer yaratmak " + seviyeKapiMetni(SEVIYE_URETIM.kisi.seviye) + "."); }
    return eskiKisiKaydet.apply(this, arguments);
  };
}
if (typeof e25KisilerHtml === "function") {
  const eskiE25 = e25KisilerHtml;
  window.e25KisilerHtml = function () {
    const h = eskiE25.apply(this, arguments);
    if (seviyeYeter(SEVIYE_URETIM.kisi.seviye)) { return h; }
    /* "Evrengezerini ekle" formu yerine kapı */
    return h.replace(/<details class="kutu-y"[^>]*><summary><b>\+ Evrengezerini ekle<\/b><\/summary>[\s\S]*?<\/details><\/div>$/,
      '<div class="kutu-y svk-kapi"><b>🔒 Evrengezerini ekle</b><p class="oyun-not">' + kacir(seviyeKapiMetni(SEVIYE_URETIM.kisi.seviye)) + "</p>" +
      seviyeCubukHtml(SEVIYE_URETIM.kisi.seviye) + "</div></div>");
  };
}

/* düğmeler kilidi baştan göstersin; dokununca açıklama */
const SVK_DUGMELER = [
  ['[data-fan-yeni="hikaye"]', "hikaye"], ['[data-fan-yeni="evren"]', "evren"], ["[data-es-yeni]", "evren"], ['[data-krs-git="yeni-evren"]', "evren"]
];

function svkDugmeleriIsaretle(kok) {
  SVK_DUGMELER.forEach(function (d) {
    (kok || document).querySelectorAll(d[0]).forEach(function (b) {
      const kilitli = !seviyeYeter(SEVIYE_URETIM[d[1]].seviye);
      b.classList.toggle("svk-kilitli", kilitli);
      const r = b.querySelector(".svk-rozet");
      if (kilitli && !r) { b.insertAdjacentHTML("beforeend", ' <span class="svk-rozet">🔒 Sv ' + SEVIYE_URETIM[d[1]].seviye + "</span>"); }
      if (!kilitli && r) { r.remove(); }
    });
  });
}

document.addEventListener("click", function (ev) {
  for (let i = 0; i < SVK_DUGMELER.length; i++) {
    const b = ev.target.closest && ev.target.closest(SVK_DUGMELER[i][0]);
    if (b && !seviyeYeter(SEVIYE_URETIM[SVK_DUGMELER[i][1]].seviye)) {
      ev.preventDefault(); ev.stopImmediatePropagation();
      seviyeUyari(SVK_DUGMELER[i][1]);
      return;
    }
  }
}, true);

/* ---------- yan bölümler ---------- */

function seviyeBolumKilitli(id) {
  return SEVIYE_BOLUMLER[id] !== undefined && !seviyeYeter(SEVIYE_BOLUMLER[id]);
}

function seviyeBolumleriUygula() {
  document.querySelectorAll(".svk-yer").forEach(function (n) { n.remove(); });
  Object.keys(SEVIYE_BOLUMLER).forEach(function (id) {
    const b = document.getElementById(id);
    if (!b || !b.classList.contains("bolum")) { return; }
    const kilitli = seviyeBolumKilitli(id) && !b.classList.contains("kanon-kilitli");
    b.classList.toggle("svk-bolum-kilitli", kilitli);
    if (!kilitli) { return; }
    const y = document.createElement("div");
    y.className = "svk-yer";
    y.innerHTML = '<div class="kanon-ic"><span class="kanon-ikon" aria-hidden="true">✦</span>' +
      '<h3 class="kanon-baslik">' + kacir(typeof kanonBolumAdi === "function" ? kanonBolumAdi(id) : id) + "</h3>" +
      '<p class="kanon-metin">' + kacir(seviyeKapiMetni(SEVIYE_BOLUMLER[id])) + "</p>" + seviyeCubukHtml(SEVIYE_BOLUMLER[id]) +
      '<p class="oyun-not">' + kacir(SVK_NASIL) + "</p></div>";
    b.appendChild(y);
  });
}

if (typeof kanonKilitUygula === "function") {
  const eskiKilit = kanonKilitUygula;
  window.kanonKilitUygula = function () {
    const r = eskiKilit.apply(this, arguments);
    try { seviyeBolumleriUygula(); svkDugmeleriIsaretle(); } catch (_) { /* sayfa hazır değil */ }
    return r;
  };
}

/* menüde: seviyeyle açılan bölümün yanına "Sv 3" */
if (typeof kanonKilitIsareti === "function") {
  const eskiIsaret = kanonKilitIsareti;
  window.kanonKilitIsareti = function (id) {
    const h = eskiIsaret.apply(this, arguments);
    return h || (seviyeBolumKilitli(id) ? ' <span class="gez-kilit svk-menu" title="Seviye ' + SEVIYE_BOLUMLER[id] + "'te açılır\">Sv " + SEVIYE_BOLUMLER[id] + "</span>" : "");
  };
}

/* sayfa değişince fan ve evren düğmeleri de işaretlensin */
let svkZaman = null;
new MutationObserver(function () {
  if (svkZaman) { return; }
  svkZaman = setTimeout(function () { svkZaman = null; try { svkDugmeleriIsaretle(); } catch (_) { /* yok */ } }, 250);
}).observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("click", function (ev) {
  if (ev.target.closest && ev.target.closest("[data-svk-hesap]") && typeof hesapPencere === "function") { hesapPencere("kayit"); }
});
