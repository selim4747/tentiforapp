/* TentiforApp 4.0 · engine/evren-motoru — herhangi bir standart evren paketini (fan evren biçimi, JSON) alıp
   sitenin evren görüntüleyicisinde açar: harita, zaman, kişiler, hikâyeler. Önizleme (sandbox) modunda paket
   cihazda kalıcı olmaz; kapanınca silinir.
   4.0.3: onaylanan evrenler Supabase'de değil GitHub'da (evrenler/<adres>.json + veri.json): sitenin sıradan fan
   evrenleri gibi listelere girer, çevrimdışı açılır; sunucuya ek okuma yok. */

const MOTOR = { onizleme: null };

function evrenMotoruAc(ham, secenek) {
  const o = secenek || {};
  const e = typeof ham === "string" ? fanTemizle(JSON.parse(ham)) : fanTemizle(ham);
  if (!e || e.tur !== "evren") { throw new Error("Bu bir evren paketi değil."); }
  e.id = (o.onizleme ? "onizle-" : "acilan-") + String(o.slug || e.id).slice(0, 30);
  fanAcilanEkle(e);
  MOTOR.onizleme = o.onizleme ? e.id : null;
  document.documentElement.toggleAttribute("data-onizleme", !!o.onizleme);
  location.hash = "#/ev/acilan/" + e.id;
  return e.id;
}

/* önizleme bitince (evren sayfasından çıkınca) paket cihazdan silinir */
window.addEventListener("hashchange", function () {
  const r = typeof rota === "function" ? rota() : location.hash;   /* site adresi yol olarak tutar (/ev/acilan/…) */
  if (!MOTOR.onizleme || r.indexOf("#/ev/acilan/" + MOTOR.onizleme) === 0) { return; }
  try { jsonYaz(FAN_ACILAN_ANAHTAR, (jsonOku(FAN_ACILAN_ANAHTAR, []) || []).filter(function (x) { return x && x.id !== MOTOR.onizleme; })); } catch (_) { /* yok */ }
  MOTOR.onizleme = null;
  document.documentElement.removeAttribute("data-onizleme");
});

/* eski paylaşım adresi #/yayin/<adres> → sitenin fan evreni #/ev/fan/<adres> */
function yayinAdresiBak() {
  const m = /^#\/yayin\/([a-z0-9-]+)/.exec(typeof rota === "function" ? rota() : location.hash);
  if (m) { location.hash = "#/ev/fan/" + m[1]; }
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evren-bildir]");
  if (!b || typeof sikayetEt !== "function") { return; }
  sikayetEt("evren", b.getAttribute("data-evren-bildir"), function (m) { if (typeof eckaBildir === "function") { eckaBildir(m); } });
});

/* ==================== 4.3: okuma rehberi ====================
   Evrenin "Nereden başlamalı" listesi: okuma_rehberi = [{ sira, baslik, kilitli, kod_gerekli, dosya }].
   dosya (maddenin açtığı yer): "roman:<bölüm>" · "bolum:<grup>" (ör. bolum:kisiler) · "lore:<lore>" · "#/…" (sitede bir adres) · "" (yalnızca başlık).
   Kurucu yazmadıysa romanı olan evrende kendiliğinden kurulur: giriş, roman bölümleri, kilitli lore. Düzenleyici: 82-evren-kurucu. */

const REHBER_HEDEF = /^(roman:[\w-]{1,40}|bolum:[a-zA-Z]{1,30}|lore:[\w-]{1,40}|#\/[\w\-/%.]{1,160})$/;

function rehberTemizle(l) {
  return (Array.isArray(l) ? l : []).slice(0, 60).map(function (x) {
    if (!x || typeof x !== "object") { return null; }
    const baslik = fanMetin(x.baslik, 120).trim();
    if (!baslik) { return null; }
    const dosya = String(x.dosya || "").trim();
    return { baslik: baslik, kilitli: x.kilitli === true, kod_gerekli: x.kod_gerekli === true, dosya: REHBER_HEDEF.test(dosya) ? dosya : "" };
  }).filter(Boolean).map(function (x, i) { return Object.assign({ sira: i + 1 }, x); });
}

/** Evrenin okuma rehberi: kurucunun yazdığı, yoksa (romanı olan okur evreninde) kendiliğinden kurulan. */
function evrenRehberi(e) {
  if (Array.isArray(e.okuma_rehberi) && e.okuma_rehberi.length) { return e.okuma_rehberi; }
  const bolumler = ((e.roman || {}).bolumler) || [];
  if (!bolumler.length || !EVS || EVS.kaynak === "site") { return []; }
  const l = [];
  if (String(e.ozet || "").trim()) { l.push({ baslik: "Evrene giriş", dosya: "bolum:ozet" }); }
  bolumler.forEach(function (b, i) { l.push({ baslik: b.baslik || "Bölüm " + (i + 1), dosya: "roman:" + b.id }); });
  (e.lorlar || []).forEach(function (x) { l.push({ baslik: x.baslik || "Kilitli lore", dosya: "lore:" + x.id, kod_gerekli: true }); });
  return l.map(function (x, i) { return Object.assign({ sira: i + 1, kilitli: false, kod_gerekli: false }, x); });
}

/** Maddenin durumu: okunabilir mi, değilse neden (kilitli / kod ister). */
function rehberDurumu(e, x) {
  if (!x.dosya) { return ""; }
  if (x.kilitli) { return "kilitli"; }
  if (x.kod_gerekli) {
    const lore = /^lore:(.+)$/.exec(x.dosya);
    if (!(lore && evlAcilan(e.id)[lore[1]])) { return "kod"; }
  }
  return "acik";
}

function evrenRehberBolumu(v) {
  const e = v.eser;
  const l = evrenRehberi(e);
  const kendi = Array.isArray(e.okuma_rehberi) && e.okuma_rehberi.length;
  return '<div class="kutu-y evr-rehber"><span class="oyun-etiket">Nereden başlamalı</span>' +
    (l.length ? '<p class="oyun-giris">' + (kendi ? "Kurucunun önerdiği okuma sırası." : "Bu evreni baştan sona okumak için sıra.") + "</p>" +
      '<ol class="sira-liste">' + l.map(function (x, i) {
        const d = rehberDurumu(e, x);
        return '<li class="' + (d === "acik" ? "sira-acik" : (d ? "sira-kilitli" : "")) + '"><span class="sira-no">' + (i + 1) + '</span><span class="sira-ad">' + kacir(x.baslik) + "</span>" +
          (d === "acik" ? '<button type="button" class="ic-bag sira-git" data-rehber-git="' + kacir(x.dosya) + '">Oku →</button>'
            : (d ? '<span class="sira-kilit">🔒 ' + (d === "kod" ? "kod ister" : "kilitli") + "</span>" : "")) + "</li>";
      }).join("") + "</ol>"
      : '<p class="oyun-not">Bu evrende henüz okuma rehberi yok.</p>') + "</div>" +
    (EVS.kaynak === "benim" && !v.onizle ? evrRehberDuzenHtml(e) : "");
}

/* "Oku →": maddenin gösterdiği yere git */
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-rehber-git]");
  if (!b || !EVS) { return; }
  const h = b.getAttribute("data-rehber-git");
  const m = /^(roman|bolum|lore):(.+)$/.exec(h);
  if (!m) { if (/^#\//.test(h)) { location.hash = h; } return; }
  if (m[1] === "roman") { EVS.sekme = "roman"; evrDurum().secili = m[2]; }
  else { EVS.sekme = m[1] === "lore" ? "lore" : "bilgi"; }
  evrenSayfaCiz();
  if (m[1] === "bolum") {
    const s = document.querySelector('#evrenSayfa section.fan-grup[data-grup="' + m[2] + '"]');
    if (s) { s.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }
});
