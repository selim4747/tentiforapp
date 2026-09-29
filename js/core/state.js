/* TentiforApp 4.0 · core/state — global durum: üyelik (ücretsiz/Pro). Pro durumu cihazda 6 saat saklanır;
   ödeme ya da giriş sonrası tazelenir (sunucuya her açılışta sorulmaz). */

const TF4_UYELIK_ANAHTAR = "tf4_uyelik";

function tf4ProMu() { return !!(TF4.uyelik && TF4.uyelik.pro && (!TF4.uyelik.bitis || Date.parse(TF4.uyelik.bitis) > Date.now())); }

function tf4UyelikUygula() {
  document.documentElement.classList.toggle("tf-pro", tf4ProMu());
  try { document.dispatchEvent(new Event("tf4-uyelik")); } catch (_) { /* eski tarayıcı */ }
}

async function tf4AbonelikYukle(zorla) {
  const kim = typeof hesapKullanici !== "undefined" && hesapKullanici ? hesapKullanici.id : "";
  if (!kim) { TF4.uyelik = { pro: false, tip: "ucretsiz", bitis: null }; tf4UyelikUygula(); return TF4.uyelik; }
  try {
    const o = JSON.parse(localStorage.getItem(TF4_UYELIK_ANAHTAR) || "null");
    if (!zorla && o && o.kim === kim && Date.now() - o.t < 6 * 3600e3) { TF4.uyelik = o.v; tf4UyelikUygula(); return TF4.uyelik; }
  } catch (_) { /* yok */ }
  try {
    const { data, error } = await hesapIstemci.rpc("abonelik_durumum");
    if (error) { throw error; }
    TF4.uyelik = { pro: !!data.pro, tip: data.tip || "ucretsiz", bitis: data.bitis || null };
    try { localStorage.setItem(TF4_UYELIK_ANAHTAR, JSON.stringify({ kim: kim, t: Date.now(), v: TF4.uyelik })); } catch (_) { /* yok */ }
  } catch (_) { /* kurulum.sql 4.0 çalıştırılmadıysa ücretsiz sayılır */ }
  tf4UyelikUygula();
  return TF4.uyelik;
}

try { const o = JSON.parse(localStorage.getItem(TF4_UYELIK_ANAHTAR) || "null"); if (o && o.v) { TF4.uyelik = o.v; } } catch (_) { /* yok */ }
tf4UyelikUygula();

/* ==================== 4.3: aktif evren ====================
   Alt menüdeki Oku ve Oyna seçili evrene göre açılır. Aktif evren: { git, ad } (git: "#/ev/fan/<id>", "#/ev/e99",
   "#/claude" …) ya da null (Tentiforverse). Evren seçicide seçilince ya da bir evren sayfası açılınca değişir;
   seçicide Tentiforverse seçilince sıfırlanır. Cihazda saklanır. */
const TF4_AKTIF_EVREN = "tf4_aktif_evren";

function aktifEvren() {
  if (TF4.aktifEvren === undefined) {
    try { TF4.aktifEvren = JSON.parse(localStorage.getItem(TF4_AKTIF_EVREN) || "null"); } catch (_) { TF4.aktifEvren = null; }
    if (TF4.aktifEvren && !/^#\/(ev\/|claude)/.test(TF4.aktifEvren.git || "")) { TF4.aktifEvren = null; }
  }
  return TF4.aktifEvren;
}

function aktifEvrenSec(git, ad) {
  const yeni = /^#\/(ev\/|claude)/.test(git || "") ? { git: git, ad: String(ad || "").slice(0, 60) } : null;
  const eski = aktifEvren();
  if ((eski && eski.git) === (yeni && yeni.git) && (eski && eski.ad) === (yeni && yeni.ad)) { return; }
  TF4.aktifEvren = yeni;
  try { if (yeni) { localStorage.setItem(TF4_AKTIF_EVREN, JSON.stringify(yeni)); } else { localStorage.removeItem(TF4_AKTIF_EVREN); } } catch (_) { /* yok */ }
  if (document.querySelector("#altMenu")) { altMenuCiz(); }
}

/** Alt menüde Oku ("oku") ya da Oyna ("oyna") nereye gider: aktif evrenin okuma rehberi / oyunları; aktif evren yoksa null
    (Tentiforverse'in Oku ve Oyna sayfaları). */
function aktifEvrenHedefi(tur) {
  const a = aktifEvren();
  if (!a) { return null; }
  if (a.git === "#/claude") { return { git: a.git, ad: a.ad, ce: tur === "oku" ? "roman" : "oyunlar" }; }
  return { git: a.git, ad: a.ad, sekme: tur === "oku" ? "rehber" : "oyunlar" };
}

/* ==================== 4.2: bildirimler (site ve uygulama içi) ====================
   Onay/red kararları, kurucu onayı istekleri: sunucudaki kullanici_bildirimleri. Girişte bir kez okunur (oturum başına),
   Sen sayfası açılınca tazelenir. Okunmamış varsa hesap düğmesinde nokta; Android uygulamasında yerel bildirim. */
const TF4_BILDIRIM = { liste: [], okundu_son: 0 };

async function bildirimleriYukle() {
  if (typeof hesapKullanici === "undefined" || !hesapKullanici || typeof hesapIstemci === "undefined" || !hesapIstemci) { return []; }
  try {
    const { data, error } = await hesapIstemci.rpc("bildirimlerim");
    if (error) { throw error; }
    TF4_BILDIRIM.liste = data || [];
  } catch (_) { TF4_BILDIRIM.liste = []; }
  bildirimleriCiz();
  uygulamaBildirimi();
  return TF4_BILDIRIM.liste;
}

function bildirimleriCiz() {
  const okunmamis = TF4_BILDIRIM.liste.filter(function (b) { return !b.okundu; }).length;
  document.documentElement.toggleAttribute("data-bildirim-var", okunmamis > 0);
  const a = document.querySelector("#tf4BildirimAlan");
  if (!a) { return; }
  if (!TF4_BILDIRIM.liste.length) { a.innerHTML = ""; return; }
  a.innerHTML = '<div class="kutu-y bildirim-kutu"><b>Bildirimlerin' + (okunmamis ? " · " + okunmamis + " yeni" : "") + "</b>" +
    '<ul class="bildirim-liste">' + TF4_BILDIRIM.liste.slice(0, 10).map(function (b) {
      return '<li class="' + (b.okundu ? "" : "yeni") + '">' + (b.baglanti ? '<a href="' + kacir(b.baglanti) + '">' + kacir(b.metin) + "</a>" : kacir(b.metin)) +
        ' <span class="oyun-not">' + new Date(b.zaman).toLocaleDateString("tr-TR") + "</span></li>";
    }).join("") + "</ul>" + (okunmamis ? '<button type="button" class="ic-bag" data-bildirim-okundu>Hepsini okundu say</button>' : "") + "</div>";
}

/* Android uygulamasında: yeni (bu cihazda henüz gösterilmemiş) bildirimler yerel bildirim olarak */
function uygulamaBildirimi() {
  const ln = typeof kabukEklenti === "function" && typeof kabukMu === "function" && kabukMu() ? kabukEklenti("LocalNotifications") : null;
  if (!ln) { return; }
  let son = 0;
  try { son = Number(localStorage.getItem("tf4_bildirim_son")) || 0; } catch (_) { /* yok */ }
  const yeni = TF4_BILDIRIM.liste.filter(function (b) { return !b.okundu && b.no > son; }).slice(0, 3);
  if (!yeni.length) { return; }
  try {
    ln.schedule({ notifications: yeni.map(function (b) { return { id: 4200000 + (b.no % 100000), title: "TentiforApp", body: String(b.metin).slice(0, 180), extra: { adres: b.baglanti || "#/sen" } }; }) });
    localStorage.setItem("tf4_bildirim_son", String(Math.max.apply(null, yeni.map(function (b) { return b.no; }))));
  } catch (_) { /* izin yoksa sessizce geç */ }
}

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-bildirim-okundu]");
  if (!b) { return; }
  try { await hesapIstemci.rpc("bildirimleri_okundu"); TF4_BILDIRIM.liste.forEach(function (x) { x.okundu = true; }); bildirimleriCiz(); } catch (_) { /* yok */ }
});

window.addEventListener("hashchange", function () {
  if (typeof aktifSayfa === "undefined" || aktifSayfa !== "sen") { return; }
  bildirimleriYukle();
  /* ücretsiz görünen hesap Sen sayfasında durumunu yeniden sorar: hediye edilen Pro 6 saatlik önbelleği beklemeden görünür */
  if (!tf4ProMu()) { tf4AbonelikYukle(true); }
});
