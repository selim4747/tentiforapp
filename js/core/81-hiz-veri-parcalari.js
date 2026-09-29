/* Sürüm 3.0 — hız ve düzen.

   1. Veri parçaları: açılışta gerekmeyen uzun listeler (şimdilik değişiklik günlüğünün eski sürümleri) yayın paketinde
      ayrı dosyadadır (scripts/paketle.mjs → veri-<ad>.json). veri.json'da ilk birkaç kaydı durur, veri.__parcalar
      tamamının nerede olduğunu söyler. Gerekince iner; yönetici kaydederken, dışa aktarırken ya da panel açıkken
      hepsi yerine konur, böylece GitHub'a asla eksik veri yazılmaz. Geliştirirken (paketsiz) hiçbir şey yapmaz.
   2. Değişiklikler sayfası (/surumler/): sürümler seriye göre gruplu, aranabilir; son ziyaretten beri gelenler işaretli. */

/* ==================== 1. veri parçaları ==================== */

const VERI_PARCA = {};          /* ad → tam liste (indikten sonra) */
const VERI_PARCA_SOZ = {};      /* ad → iniş sözü */

function veriParcaBilgisi() { return (typeof veri !== "undefined" && veri && veri.__parcalar) || null; }

function veriParcalariHazir() {
  const p = veriParcaBilgisi();
  return !p || Object.keys(p).every(function (ad) { return !!VERI_PARCA[ad]; });
}

/** Bir parçayı indirip veri'deki yerine koyar (anahtarın sırası aynı kalır). */
function veriParcasi(ad) {
  const p = veriParcaBilgisi();
  if (!p || !p[ad]) { return Promise.resolve(veri && veri[ad]); }
  if (VERI_PARCA[ad]) { return Promise.resolve(veri[ad]); }
  if (!VERI_PARCA_SOZ[ad]) {
    VERI_PARCA_SOZ[ad] = fetch(p[ad].dosya).then(function (y) {
      if (!y.ok) { throw new Error(ad + " parçası okunamadı (" + y.status + ")"); }
      return y.json();
    }).then(function (tam) {
      if (!Array.isArray(tam)) { throw new Error(ad + " parçası bozuk"); }
      /* sayfa açıkken yöneticinin eklediği yeni kayıtlar (listenin başında, parçada olmayan) korunur */
      const eldeki = Array.isArray(veri[ad]) ? veri[ad] : [];
      const tamMetin = tam.map(function (x) { return JSON.stringify(x); });
      const yeniler = eldeki.filter(function (x) { return tamMetin.indexOf(JSON.stringify(x)) === -1; });
      VERI_PARCA[ad] = tam;
      veri[ad] = yeniler.concat(tam);
      if (veriParcalariHazir() && veri.__parcalar) { delete veri.__parcalar; }
      return veri[ad];
    }).catch(function (e) { delete VERI_PARCA_SOZ[ad]; throw e; });
  }
  return VERI_PARCA_SOZ[ad];
}

function veriParcalariTam() {
  const p = veriParcaBilgisi();
  if (!p) { return Promise.resolve(); }
  return Promise.all(Object.keys(p).map(veriParcasi)).then(function () { /* hepsi yerinde */ });
}

/** Açılıştaki (parçalı) veri metninden GitHub'dakinin aynısını kurar: Kaydet korumasının özeti için (22-yonetici.js). */
function veriParcalariUygula(o) {
  if (!o || !o.__parcalar) { return o; }
  Object.keys(o.__parcalar).forEach(function (ad) { if (VERI_PARCA[ad]) { o[ad] = VERI_PARCA[ad]; } });
  delete o.__parcalar;
  return o;
}

/* ==================== 2. Değişiklikler sayfası ==================== */

const DG_SON = "tf30_degisiklik_son";   /* bu cihazda en son görülen sürüm */
const DG = { ara: "", seri: "hepsi", onceki: null };

function dgSurumSayi(s) {
  return String(s || "0").split(".").map(function (x) { return parseInt(x, 10) || 0; });
}
function dgBuyukMu(a, b) {
  const x = dgSurumSayi(a), y = dgSurumSayi(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) { return (x[i] || 0) > (y[i] || 0); } }
  return false;
}
function dgTarih(t) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t || ""));
  if (!m) { return String(t || ""); }
  try { return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }); } catch (_) { return t; }
}
function dgVurgu(metin, ara) {
  const k = kacir(metin);
  if (!ara) { return k; }
  const i = String(metin).toLocaleLowerCase("tr").indexOf(ara);
  if (i === -1) { return k; }
  return kacir(metin.slice(0, i)) + "<mark>" + kacir(metin.slice(i, i + ara.length)) + "</mark>" + kacir(metin.slice(i + ara.length));
}

function dgListeHtml() {
  const l = Array.isArray(veri.degisiklik) ? veri.degisiklik : [];
  const ara = DG.ara.trim().toLocaleLowerCase("tr");
  const onceki = DG.onceki;
  let sonSeri = null, gosterilen = 0;
  const html = l.map(function (d, i) {
    const seri = String(dgSurumSayi(d.surum)[0]);
    if (DG.seri !== "hepsi" && seri !== DG.seri) { return ""; }
    const maddeler = (d.maddeler || []).filter(function (m) { return !ara || String(m).toLocaleLowerCase("tr").indexOf(ara) !== -1 || String(d.surum).indexOf(ara) === 0; });
    if (ara && !maddeler.length) { return ""; }
    gosterilen++;
    const buyuk = /\.0\.0$/.test(String(d.surum || ""));
    const yeni = onceki && dgBuyukMu(d.surum, onceki);
    const yeniKar = (d.yeniler || []).length;
    const bas = seri !== sonSeri ? '<h3 class="dg-seri">' + kacir(seri) + ".x sürümleri</h3>" : "";
    sonSeri = seri;
    return bas + '<article class="dg-surum' + (buyuk ? " buyuk" : "") + (yeni ? " yeni" : "") + '">' +
      "<details" + (i === 0 || ara || yeni ? " open" : "") + "><summary>" +
        '<span class="dg-no">' + kacir(d.surum) + "</span>" +
        '<span class="dg-tarih">' + kacir(dgTarih(d.tarih)) + "</span>" +
        (buyuk ? '<span class="dg-etiket">Büyük güncelleme</span>' : "") +
        (yeni ? '<span class="dg-yeni">yeni</span>' : "") +
        '<span class="dg-sayi">' + (d.maddeler || []).length + " değişiklik</span>" +
      "</summary>" +
      '<ul class="dg-maddeler">' + maddeler.map(function (m) { return "<li>" + dgVurgu(m, ara) + "</li>"; }).join("") + "</ul>" +
      (yeniKar ? '<p class="oyun-not">Bu sürümde ' + yeniKar + " yeni karakter kaydı.</p>" : "") +
      "</details></article>";
  }).join("");
  const p = veriParcaBilgisi();
  const eksik = p && p.degisiklik && !VERI_PARCA.degisiklik ? (p.degisiklik.toplam || 0) - l.length : 0;
  return (gosterilen ? html : '<p class="oyun-not">Aramana uyan değişiklik yok.</p>') +
    (eksik > 0 ? '<p class="oyun-not dg-yukleniyor">Daha eski ' + eksik + " sürüm yükleniyor…</p>" : "");
}

function degisiklikSayfaCiz() {
  const alan = document.querySelector("#degisiklikAlan");
  if (!alan || typeof veri === "undefined" || !veri || !Array.isArray(veri.degisiklik)) { return; }
  if (DG.onceki === null) { try { DG.onceki = localStorage.getItem(DG_SON) || ""; } catch (_) { DG.onceki = ""; } }
  const p = veriParcaBilgisi();
  const toplam = p && p.degisiklik && !VERI_PARCA.degisiklik ? p.degisiklik.toplam : veri.degisiklik.length;
  const son = veri.degisiklik[0] || {};
  const maddeSayisi = veri.degisiklik.reduce(function (t, d) { return t + (d.maddeler || []).length; }, 0);
  const seriler = [];
  veri.degisiklik.forEach(function (d) { const s = String(dgSurumSayi(d.surum)[0]); if (seriler.indexOf(s) === -1) { seriler.push(s); } });
  if (p && p.degisiklik && !VERI_PARCA.degisiklik) { ["2", "1"].forEach(function (s) { if (seriler.indexOf(s) === -1) { seriler.push(s); } }); }

  if (!alan.querySelector("#dgListe")) {
    alan.innerHTML =
      '<div class="dg-ust">' +
        '<p class="dg-simdi"><span class="dg-rozet" id="dgSimdi"></span> <span id="dgOzet"></span></p>' +
        '<input class="dg-ara" id="dgAra" type="search" placeholder="Değişikliklerde ara (ör. harita, bulmaca)" aria-label="Değişikliklerde ara" autocomplete="off">' +
        '<div class="filtre dg-filtre" id="dgFiltre" role="group" aria-label="Sürüm serisi"></div>' +
      "</div>" +
      '<div id="dgListe" class="dg-liste" aria-live="polite"></div>';
  }
  alan.querySelector("#dgSimdi").textContent = "v" + (son.surum || veri.surum || "");
  alan.querySelector("#dgOzet").textContent = "şu anki sürüm · " + dgTarih(son.tarih) + " · " + toplam + " sürüm" + (VERI_PARCA.degisiklik || !p ? ", " + maddeSayisi + " değişiklik" : "");
  alan.querySelector("#dgFiltre").innerHTML = ["hepsi"].concat(seriler).map(function (s) {
    return '<button class="filtre-btn' + (DG.seri === s ? " secili" : "") + '" data-dg-seri="' + s + '" aria-pressed="' + (DG.seri === s) + '">' + (s === "hepsi" ? "Hepsi" : s + ".x") + "</button>";
  }).join("");
  alan.querySelector("#dgListe").innerHTML = dgListeHtml();

  /* sayfa gerçekten açıksa: eski sürümleri indir, "yeni" işaretini bir sonraki ziyarete kadar sakla */
  const acik = typeof aktifSayfa === "undefined" || aktifSayfa === "surumler";
  if (acik && p && p.degisiklik && !VERI_PARCA.degisiklik) {
    veriParcasi("degisiklik").then(degisiklikSayfaCiz, function () {
      const y = alan.querySelector(".dg-yukleniyor");
      if (y) { y.textContent = "Eski sürümler şu an indirilemedi (internet yok gibi). Bağlanınca bu sayfa tamamlanır."; }
    });
  }
  if (acik && son.surum) { try { localStorage.setItem(DG_SON, son.surum); } catch (_) { /* yok */ } }
}
window.degisiklikCiz = degisiklikSayfaCiz;

document.addEventListener("input", function (e) {
  if (!e.target || e.target.id !== "dgAra") { return; }
  DG.ara = e.target.value;
  const l = document.querySelector("#dgListe");
  if (l) { l.innerHTML = dgListeHtml(); }   /* yalnızca liste: arama kutusu yerinde kalır, klavye kapanmaz */
});
document.addEventListener("click", function (e) {
  const b = e.target.closest && e.target.closest("[data-dg-seri]");
  if (!b) { return; }
  DG.seri = b.getAttribute("data-dg-seri");
  degisiklikSayfaCiz();
});
