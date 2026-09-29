/* TentiforApp 4.0 · engine/evren-motoru — herhangi bir standart evren paketini (fan evren biçimi, JSON) alıp
   sitenin evren görüntüleyicisinde açar: harita, zaman, kişiler, hikâyeler. Önizleme (sandbox) modunda paket
   cihazda kalıcı olmaz; kapanınca silinir. Onaylanan evrenler herkese açık depodan (kütüphanesiz) iner. */

const MOTOR = { onizleme: null };
const YAYIN_ONBELLEK = "tf4_yayinlar";

function evrenMotoruAc(ham, secenek) {
  const o = secenek || {};
  const e = typeof ham === "string" ? fanTemizle(JSON.parse(ham)) : fanTemizle(ham);
  if (!e || e.tur !== "evren") { throw new Error("Bu bir evren paketi değil."); }
  e.id = (o.onizleme ? "onizle-" : "yayin-") + String(o.slug || e.id).slice(0, 30);
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

async function yayinlananEvrenler(zorla) {
  if (zorla) { try { localStorage.removeItem(YAYIN_ONBELLEK); } catch (_) { /* yok */ } }
  return tf4AcikOku("/rest/v1/yayindaki_evrenler?select=slug,baslik,ozet,yazar,yayin_tarihi,kanon&order=yayin_tarihi.desc&limit=60", YAYIN_ONBELLEK, 2 * 3600e3);
}

async function yayinlananEvreniAc(slug) {
  if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) { throw new Error("Adres geçersiz."); }
  const r = await fetch(tf4Adres("/storage/v1/object/public/yayindaki-evrenler/" + slug + ".json.gz"));
  if (!r.ok) { throw new Error("Evren dosyası inemedi (" + r.status + ")."); }
  return evrenMotoruAc(await tf4Ac(await r.blob()), { slug: slug });
}

/* ana sayfada katlı "Onaylanan evrenler": açılınca bir kez okunur (30 dk önbellek) — açmayana sunucu yükü yok */
function yayinKutusuHtml() {
  return '<details class="kesif-daha" id="yayinEvrenler"><summary><span class="kesif-daha-ad">Onaylanan evrenler</span><span class="kesif-daha-not">okurların kurup moderatörlerin onayladığı evrenler</span></summary><div class="kesif-daha-ic" id="yayinListe"><p class="oyun-not">Yükleniyor…</p></div></details>';
}
async function yayinListeCiz() {
  const a = document.querySelector("#yayinListe");
  if (!a) { return; }
  try {
    const l = await yayinlananEvrenler(true);   /* kişi kendisi açtı: taze liste (bir istek) */
    if (typeof YAYIN !== "undefined") { YAYIN.liste = l; }
    a.innerHTML = l.length ? '<div class="ana-evren-liste">' + l.map(function (x) {
      return '<button type="button" class="ana-evren ' + (x.kanon ? "kanon" : "fan") + '" data-yayin-ac="' + kacir(x.slug) + '"><b class="ana-evren-ad">' + kacir(x.baslik) + "</b>" +
        '<span class="ana-evren-not">' + kacir((x.yazar ? x.yazar + " · " : "") + String(x.ozet || "").slice(0, 90)) + "</span></button>";
    }).join("") + "</div>" : '<p class="oyun-not">Henüz onaylanan evren yok. İlkini sen kur: evrenini Kurucu’nun son adımından onaya gönder.</p>';
  } catch (_) { a.innerHTML = '<p class="oyun-not">Şu an okunamadı; biraz sonra yeniden dene.</p>'; }
}
if (typeof anaEvrenlerCiz === "function") {
  const eskiAEC40 = anaEvrenlerCiz;
  window.anaEvrenlerCiz = function () {
    const r = eskiAEC40.apply(this, arguments);
    const kur = document.querySelector("#anaEvrenler .ana-kur");
    if (kur && !document.querySelector("#yayinEvrenler")) {
      kur.insertAdjacentHTML("beforebegin", yayinKutusuHtml());
      document.querySelector("#yayinEvrenler").addEventListener("toggle", function (ev) { if (ev.target.open) { yayinListeCiz(); } });
    }
    return r;
  };
}
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-yayin-ac]");
  if (!b) { return; }
  yayinlananEvreniAc(b.getAttribute("data-yayin-ac")).catch(function (e) { if (typeof eckaBildir === "function") { eckaBildir(e.message); } });
});
/* paylaşılabilir adres: #/yayin/<slug> */
function yayinAdresiBak() {
  const m = /^#\/yayin\/([a-z0-9-]+)/.exec(typeof rota === "function" ? rota() : location.hash);
  if (m) { yayinlananEvreniAc(m[1]).catch(function (e) { if (typeof eckaBildir === "function") { eckaBildir(e.message); } }); }
}



/* 4.0.2: onaylanan evrenler sitenin evren listelerine girer (ana sayfa, evren seçici, E25 kapıları, tüm evrenler):
   kanon onaylananlar "Kanon evrenler"de, ötekiler "Okurların evrenleri"nde (fan-made). Liste 2 saat cihazda saklanır. */
const YAYIN = { liste: [] };
function yayinListesiYukle() {
  try { const o = JSON.parse(localStorage.getItem(YAYIN_ONBELLEK) || "null"); if (o && Array.isArray(o.v)) { YAYIN.liste = o.v; } } catch (_) { /* yok */ }
  yayinlananEvrenler(false).then(function (l) {
    const once = JSON.stringify(YAYIN.liste); YAYIN.liste = Array.isArray(l) ? l : [];
    if (JSON.stringify(YAYIN.liste) !== once) { try { anaEvrenlerCiz(); } catch (_) { /* yok */ } }
  }).catch(function () { /* çevrimdışı ya da kurulum yok: liste boş kalır */ });
}
document.addEventListener("tf-veri-hazir", function () { setTimeout(yayinListesiYukle, 0); });

if (typeof evrenSeciciListesi === "function") {
  const eskiESL402 = evrenSeciciListesi;
  window.evrenSeciciListesi = function () {
    const l = eskiESL402.apply(this, arguments);
    const var_ = {};
    l.site.concat(l.fan).forEach(function (x) { var_[String(x.ad || "").toLocaleLowerCase("tr")] = true; });
    YAYIN.liste.forEach(function (x) {
      if (var_[String(x.baslik || "").toLocaleLowerCase("tr")]) { return; }
      const oge = { ad: x.baslik, git: "#/yayin/" + x.slug, not: (x.kanon ? "kanon · " : "fan-made · ") + (x.yazar || "okur evreni") };
      if (x.kanon) { l.site.push(oge); } else { l.fan.push(oge); }
    });
    return l;
  };
}

/* açılan onaylı evrenin statüsü: kanon onaylandıysa herkes fan hikâyesi ve Evrengezer hikâyesi yazabilir */
if (typeof evaStatu === "function") {
  const eskiES402 = evaStatu;
  window.evaStatu = function (ad) {
    const s = eskiES402.apply(this, arguments);
    if (s.tur !== "serbest") { return s; }
    const a = String(ad || "").toLocaleLowerCase("tr").trim();
    const y = YAYIN.liste.find(function (x) { return String(x.baslik || "").toLocaleLowerCase("tr").trim() === a; });
    return y ? { tur: y.kanon ? "kanon" : "fan", ad: y.baslik } : s;
  };
}

/* onaylı evrenin cihazdaki kopyası "açılan dosya" sayılıp panelde "kanona aday" diye görünmesin */
if (typeof kanonAdaylari === "function") {
  const eskiKA402 = kanonAdaylari;
  window.kanonAdaylari = function () { return eskiKA402.apply(this, arguments).filter(function (x) { return !(x.kaynak === "acilan" && /^(yayin|onizle)-/.test(x.e.id || "")); }); };
}
