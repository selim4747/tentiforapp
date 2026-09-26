/* Adresler: her sayfa kendi gerçek yolunda açılır (/arsiv/, /dunya/, /evren/e25/, /karakter/feil/ …).

   Uygulamanın içi "#/…" rotalarıyla çalışmaya devam eder: bir yer location.hash'e "#/fan" yazınca
   adres çubuğu hemen /fan/ olur (sayfa yeniden yüklenmez). Rotayı okuyan her yer rota() kullanır:
   adreste "#/…" varsa o, yoksa yoldan türetilir. Geri/ileri tuşları (popstate) da aynı yönlendirmeyi
   tetikler. Yayın paketi her sayfa için kendi başlığı ve açıklamasıyla ayrı bir index.html üretir;
   olmayan yollar için Cloudflare Pages ana sayfayı verir, rota yine yoldan okunur. */

/* bunlar veri taşır ya da tek seferliktir: adres çubuğunda "#" ile kalır */
const ROTA_HASH_KALIR = /^#\/(kartpostal\/|fan\/paylasim)/;

/** "/evren/e25/" → "#/ev/site/e25" · "/arsiv/" → "#/arsiv" · "/" → "" */
function yoldanRota(yol) {
  const p = String(yol || "").split("/").filter(function (x) { return x && x !== "index.html"; }).map(function (x) {
    try { return decodeURIComponent(x); } catch (e) { return x; }
  });
  if (!p.length) { return ""; }
  if (p[0] === "evren" && p[1]) {
    if (["benim", "acilan", "fan", "site"].indexOf(p[1]) !== -1) { return "#/ev/" + p.slice(1).join("/"); }
    if (p[1] === "e99") { return "#/ev/e99"; }
    if (/^e\d+$/.test(p[1])) { return "#/ev/site/" + p[1]; }
    return "#/ev/fan/" + p[1];
  }
  return "#/" + p.join("/");
}

/** yoldanRota'nın tersi: "#/ev/site/e25" → "/evren/e25/" */
function rotadanYol(r) {
  const p = String(r || "").replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!p.length) { return "/"; }
  const k = function (l) { return "/" + l.map(encodeURIComponent).join("/") + "/"; };
  if (p[0] === "ev") {
    if (p[1] === "e99" && p.length === 2) { return "/evren/e99/"; }
    if (p[1] === "site" && p[2] && /^e\d+$/.test(p[2]) && p[2] !== "e99") { return k(["evren", p[2]]); }
    if (p[1] === "fan" && p[2] && !/^e\d+$/.test(p[2]) && ["benim", "acilan", "fan", "site"].indexOf(p[2]) === -1) { return k(["evren", p[2]]); }
    return k(["evren"].concat(p.slice(1)));
  }
  return k(p);
}

/** Geçerli rota ("#/…"). Adreste başka bir "#" varsa (sayfa içi çapa) eskisi gibi o döner. */
function rota() {
  const h = location.hash;
  if (h) { return h; }
  return yoldanRota(location.pathname);
}

/** Paylaşılacak tam adres. */
function rotaAdresi(r) {
  if (location.protocol.indexOf("http") !== 0) { return location.href.split("#")[0] + r; }
  return location.origin + (ROTA_HASH_KALIR.test(r) ? "/" + r : rotadanYol(r));
}

/** Adresteki "#/…" rotasını gerçek yola çevirir (geçmiş kaydını değiştirmeden). */
function rotaYolaCevir() {
  const h = location.hash;
  if (!h || h.indexOf("#/") !== 0 || ROTA_HASH_KALIR.test(h) || location.protocol.indexOf("http") !== 0) { return; }
  const yol = rotadanYol(h);
  if (yoldanRota(yol) !== (h === "#/" ? "" : h)) { return; }   /* tam geri çevrilemiyorsa dokunma */
  try { history.replaceState(history.state, "", yol + location.search); } catch (e) { /* yoksay */ }
}

let rotaSon = "";

/* kişiye özel sayfalar arama motorlarında dizinlenmez */
const ROTA_KISISEL = /^#\/(sen|u\/|ev\/(benim|acilan)|kartpostal|fanAc|fan\/paylasim)/;
function rotaRobotlar() {
  const m = document.querySelector('meta[name="robots"]');
  if (m) { m.setAttribute("content", ROTA_KISISEL.test(rota()) ? "noindex, follow" : "index, follow"); }
}
window.addEventListener("hashchange", function () { rotaRobotlar(); });
document.addEventListener("DOMContentLoaded", rotaRobotlar);

/* ilk listener: diğer hashchange dinleyicileri rota()'yı okur, sonuç aynıdır */
window.addEventListener("hashchange", function () { rotaYolaCevir(); rotaSon = rota(); });

/* geri/ileri: yoldan yola geçişte hashchange olmaz; yönlendirmeyi biz tetikleriz */
window.addEventListener("popstate", function () {
  const r = rota();
  if (r === rotaSon) { return; }
  rotaSon = r;
  try { window.dispatchEvent(new HashChangeEvent("hashchange")); } catch (e) { window.dispatchEvent(new Event("hashchange")); }
});

/* <base href="/"> yüzünden "#…" bağlantıları ana sayfaya gidip sayfayı yeniden yüklerdi: aynı sayfada kal */
document.addEventListener("click", function (ev) {
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) { return; }
  const a = ev.target.closest && ev.target.closest("a[href^='#']");
  if (!a || a.target === "_blank" || a.hasAttribute("download")) { return; }
  ev.preventDefault();
  const h = a.getAttribute("href");
  if (h === "#" || h === rota()) { return; }   /* aynı yer: tarayıcı da bir şey yapmazdı */
  location.hash = h;
}, true);

rotaYolaCevir();
rotaSon = rota();
