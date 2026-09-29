/* Sürüm 2.4 — yönetim, evren kurucu, okur, çevrimdışı ve uygulamaya hazırlık.

   Yönetim: panelde "kurulum.sql güncel değil" uyarısı (kurulum_surumu) ve son 24 saatin hata özeti;
            ?kod=XXXX davet bağlantısı (kod penceresi dolu açılır; giriş gerekiyorsa girişten sonra kendiliğinden denenir).
   Evren kurucu: stil kodunda canlı önizleme; evren sekmelerinin sırası ve gizlenmesi (sekmeDuzen); hazır şablonlar.
   Okur: evren yazısını çözme oyunu (her evrende, yazısı çizildiyse); uygulama puan tabloları; evren keşfi; cihazlarım.
   Çevrimdışı: bağlantı durumu şeridi, bağlantı gelince eşitleme, "internetsiz de açılır" bildirimi (sw.js'te önbellek stratejisi).
   Uygulama: TentiforKopru — ileride Play Store / App Store kabuğu (TWA, Capacitor) için tek giriş noktası. */

const KURULUM_BEKLENEN = "4.2";

/* ==================== yönetim: SQL sürüm uyarısı ve hata özeti ==================== */

const YON24 = { surum: null, hata: null, soruldu: false };

/** Yayındaki site sürümü (veri.json): hata listeleri yalnızca bununla gönderilmiş hataları gösterir. */
function guncelSurum() { return String((typeof veri !== "undefined" && veri && veri.surum) || ""); }

async function yon24Sor() {
  if (YON24.soruldu || typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) { return; }
  YON24.soruldu = true;
  try {
    const r = await hesapIstemci.rpc("kurulum_surumu");
    YON24.surum = r.error ? "yok" : String(r.data || "yok");
  } catch (_) { YON24.surum = "yok"; }
  try {
    const gun = new Date(Date.now() - 86400000).toISOString();
    /* yalnızca yayındaki sürümün hataları: eski sürümlerinkiler düzelmiş olabilir, paneli kalabalıklaştırmasın */
    const r = await hesapIstemci.from("hata_kayitlari").select("mesaj,sayi,surum").eq("surum", guncelSurum()).gte("son", gun).order("sayi", { ascending: false }).limit(50);
    if (!r.error) { YON24.hata = r.data || []; }
  } catch (_) { /* yetki yok */ }
  yon24SeritKoy();
}

/** Paneli yeniden çizmeden uyarı şeridini koyar (panelde yazılmakta olan alanlar kaybolmasın). */
function yon24SeritKoy() {
  const alan = document.querySelector("#yoneticiAlan");
  if (!alan || typeof panelAcik !== "function" || !panelAcik()) { return; }
  const eski = alan.querySelector(".y24-serit");
  if (eski) { eski.remove(); }
  const h = yon24Serit();
  if (h) { alan.insertAdjacentHTML("afterbegin", '<div class="y24-serit">' + h + "</div>"); }
}

function yon24Serit() {
  const l = [];
  if (YON24.surum && YON24.surum !== KURULUM_BEKLENEN) {
    /* 2.8: hataların sürüme göre ayrılması da buna bağlı */
    l.push('<div class="y-uyari kotu"><b>Supabase kurulumu güncel değil</b> (sunucuda: ' + kacir(YON24.surum === "yok" ? "2.4 öncesi" : YON24.surum) +
      ", gereken: " + KURULUM_BEKLENEN + "). Supabase → SQL Editor'de <code>supabase/kurulum.sql</code> dosyasının tamamını çalıştır; tek kodlar, oyun XP'si ve puan tabloları buna bağlı.</div>");
  }
  if (YON24.hata && YON24.hata.length) {
    const toplam = YON24.hata.reduce(function (t, x) { return t + (Number(x.sayi) || 0); }, 0);
    l.push('<div class="y-uyari"><b>v' + kacir(guncelSurum()) + ": son 24 saatte " + toplam + " hata</b> (" + YON24.hata.length + " farklı). En sık: “" +
      kacir(String(YON24.hata[0].mesaj || "").slice(0, 120)) + "” ×" + YON24.hata[0].sayi +
      ' <button class="dugme dugme-sade y-kucuk" data-y24-hatalar>Hatalara bak</button></div>');
  }
  return l.join("");
}

if (typeof yoneticiCiz === "function") {
  const eskiYC = yoneticiCiz;
  window.yoneticiCiz = function () {
    const r = eskiYC.apply(this, arguments);
    const alan = document.querySelector("#yoneticiAlan");
    if (alan && typeof panelAcik === "function" && panelAcik()) {
      yon24Sor();
      yon24SeritKoy();
    }
    return r;
  };
}

document.addEventListener("click", function (ev) {
  if (!ev.target.closest || !ev.target.closest("[data-y24-hatalar]")) { return; }
  yoneticiGrup = "bakim"; yoneticiSekme = "hatalar";
  yoneticiCiz();
});

/* ==================== davet bağlantısı: ?kod=XXXX ==================== */

const DAVETKOD_ANAHTAR = "tf-davet-kod";

function davetKoduAl() {
  let kod = null;
  try {
    const u = new URL(location.href);
    kod = u.searchParams.get("kod");
    if (kod) {
      u.searchParams.delete("kod");
      history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
      sessionStorage.setItem(DAVETKOD_ANAHTAR, kod.trim().toUpperCase().slice(0, 40));
    }
  } catch (_) { /* yoksay */ }
  return kod;
}

function davetKoduDene() {
  let kod = null;
  try { kod = sessionStorage.getItem(DAVETKOD_ANAHTAR); } catch (_) { kod = null; }
  if (!kod || typeof kodPenceresi !== "function" || typeof kodDene !== "function") { return; }
  const yerel = typeof tekYerelKodMu === "function" && tekYerelKodMu(kod);
  const hesap = typeof tekHesapVar === "function" && tekHesapVar();
  if (!yerel && !hesap) {
    if (davetOturumBekleniyor()) { return; }   /* kayıtlı oturum açılıyor: hesapProfilYukle sonrası yeniden denenir */
    kodPenceresi();
    const g = document.querySelector("#kodGiris"); if (g) { g.value = kod; }
    const d = document.querySelector("#kodDurum");
    if (d) { d.innerHTML = 'Bu bir davet kodu: hesabına bağlanması için önce giriş yap ya da hesap aç. <button class="dugme dugme-sade" data-hesap-pencere="giris">Giriş yap</button>'; d.className = "pencere-durum"; }
    return;   /* giriş yapınca yeniden denenir */
  }
  try { sessionStorage.removeItem(DAVETKOD_ANAHTAR); } catch (_) { /* yoksay */ }
  kodPenceresi();
  const g = document.querySelector("#kodGiris"); if (g) { g.value = kod; }
  kodDene(kod);
}

/** Bu cihazda kayıtlı bir Supabase oturumu var ama henüz yüklenmedi mi? */
function davetOturumBekleniyor() {
  if (typeof hesapKullanici !== "undefined" && hesapKullanici) { return false; }
  if (DAVET_OTURUM.bekle === false) { return false; }
  try {
    for (let i = 0; i < localStorage.length; i++) { if (/^sb-.*-auth-token$/.test(localStorage.key(i) || "")) { return true; } }
  } catch (_) { /* yoksay */ }
  return false;
}
const DAVET_OTURUM = { bekle: true };

if (typeof hesapProfilYukle === "function") {
  const eskiPY24 = hesapProfilYukle;
  window.hesapProfilYukle = async function () {
    const r = await eskiPY24.apply(this, arguments);
    YON24.soruldu = false;
    setTimeout(davetKoduDene, 600);
    return r;
  };
}

/* ==================== evren kurucu: canlı önizleme, sekme düzeni, şablonlar ==================== */

document.addEventListener("input", function (ev) {
  const t = ev.target;
  if (!t || (t.id !== "eksStil" && t.id !== "eksGorunum")) { return; }
  const v = typeof evrenSayfaVerisi === "function" ? evrenSayfaVerisi() : null;
  if (!v) { return; }
  if (t.id === "eksStil" && typeof eksStilCss === "function") {
    const s = document.querySelector("#evrenSayfa");
    let st = s && s.querySelector("#evsKodStil");
    if (s && !st) { st = document.createElement("style"); st.id = "evsKodStil"; s.appendChild(st); }
    if (st) { st.textContent = eksStilCss({ stilKodu: t.value }); }
  } else if (typeof eksHtmlTemizle === "function") {
    const o = document.querySelector("#eksOnizle");
    if (o) { o.innerHTML = eksHtmlTemizle(t.value, v.eser); }
  }
});

const SEKME_ADLARI = { harita: "Harita", vitrin: "Vitrin", oyunlar: "Oyunlar", roman: "Roman", cizim: "Çizimler", uygulama: "Uygulamalar",
  yazi: "Yazı", lore: "Kilitli lore", defter: "Ziyaretçi defteri", alfabe: "Alfabe", ag: "Bağlar ve zaman" };

function sekmeDuzenTemizle(d) {
  if (!d || typeof d !== "object") { return null; }
  const ad = function (x) { return /^[a-z]{1,20}$/.test(String(x || "")) ? String(x) : ""; };
  const o = {};
  if (ad(d.ilk)) { o.ilk = ad(d.ilk); }
  const g = (Array.isArray(d.gizli) ? d.gizli : []).map(ad).filter(Boolean).slice(0, 20);
  if (g.length) { o.gizli = g; }
  return Object.keys(o).length ? o : null;
}

if (typeof evrenEkTemizle === "function") {
  const eskiEk24 = evrenEkTemizle;
  window.evrenEkTemizle = function (ham, e) {
    eskiEk24.apply(this, arguments);
    const d = sekmeDuzenTemizle(ham.sekmeDuzen);
    if (d) { e.sekmeDuzen = d; } else { delete e.sekmeDuzen; }
  };
}

function evrenDuzeni() {
  const v = typeof evrenSayfaVerisi === "function" ? evrenSayfaVerisi() : null;
  return (v && v.eser && v.eser.sekmeDuzen) || null;
}

if (typeof evrenEkSekmeler === "function") {
  const eskiSek24 = evrenEkSekmeler;
  window.evrenEkSekmeler = function (v) {
    const l = eskiSek24.apply(this, arguments);
    const d = v && v.eser && v.eser.sekmeDuzen;
    if (!d || !EVS || EVS.kaynak === "benim" || !Array.isArray(d.gizli)) { return l; }
    return l.filter(function (x) { return d.gizli.indexOf(x[0]) === -1; });
  };
}

let sekmeDuzenSon = null;   /* ilk sekme yalnızca evren açılırken bir kez (yeniden çizimlerde okurun seçtiği kalır) */

function haritaGizliMi(d) { return !!(d && EVS && EVS.kaynak !== "benim" && (d.gizli || []).indexOf("harita") !== -1); }

if (typeof evrenSayfaCiz === "function") {
  const eskiCiz24 = evrenSayfaCiz;
  window.evrenSayfaCiz = function () {
    if (typeof EVS === "undefined" || !EVS) { sekmeDuzenSon = null; return eskiCiz24.apply(this, arguments); }
    const d = evrenDuzeni();
    const anahtar = EVS.kaynak + ":" + EVS.id;
    if (sekmeDuzenSon !== anahtar) {
      sekmeDuzenSon = anahtar;
      const gizli = EVS.kaynak !== "benim" ? ((d && d.gizli) || []) : [];
      if (d && d.ilk && (EVS.sekme === "harita" || EVS.sekme === "bilgi") && gizli.indexOf(d.ilk) === -1) { EVS.sekme = d.ilk; }
    }
    if (haritaGizliMi(d) && EVS.sekme === "harita") { EVS.sekme = "bilgi"; }
    let r = eskiCiz24.apply(this, arguments);
    /* seçilen sekme bu evrende yoksa çizim haritaya düşer; harita gizliyse bilgiye */
    if (haritaGizliMi(d) && EVS && EVS.sekme === "harita") { EVS.sekme = "bilgi"; r = eskiCiz24.apply(this, arguments); }
    if (haritaGizliMi(d)) {
      const b = document.querySelector('#evrenSayfa [data-evs-sekme="harita"]'); if (b) { b.remove(); }
    }
    return r;
  };
}

if (typeof evrenSayfaKapat === "function") {
  const eskiKapat24 = evrenSayfaKapat;
  window.evrenSayfaKapat = function () { sekmeDuzenSon = null; return eskiKapat24.apply(this, arguments); };
}

const EKS_SABLONLAR = [
  { ad: "Dergi", stil: ".eks-vitrin h1{font-size:2.6em;line-height:1;margin:0 0 6px;letter-spacing:-.02em}\n.eks-vitrin .ust{font-family:var(--mono);text-transform:uppercase;letter-spacing:.2em;font-size:12px}\n.eks-vitrin .kolon{columns:2 260px;column-gap:28px}\n.eks-vitrin .kolon h3{break-after:avoid;border-top:3px solid currentColor;padding-top:6px}",
    gorunum: '<p class="ust">Sayı 1 · evren dergisi</p>\n<h1>{{ad}}</h1>\n<p><i>{{ozet}}</i></p>\n<div class="kolon">\n  <h3>Kişiler</h3>{{kisiler}}\n  <h3>Yerler</h3>{{yerler}}\n  <h3>Tarih</h3>{{tarih}}\n</div>' },
  { ad: "Ansiklopedi", stil: ".eks-vitrin{font-family:Georgia,serif}\n.eks-vitrin h1{border-bottom:1px solid currentColor;padding-bottom:4px}\n.eks-vitrin .kutu{float:right;width:240px;max-width:45%;margin:0 0 12px 16px;padding:10px;border:1px solid currentColor;font-size:.9em}\n.eks-vitrin h2{border-bottom:1px solid;font-weight:400}",
    gorunum: '<h1>{{ad}}</h1>\n<aside class="kutu"><b>{{ad}}</b>{{harita}}</aside>\n<p>{{ozet}}</p>\n<h2>Kurallar</h2>{{kurallar}}\n<h2>Kişiler</h2>{{kisiler}}\n<h2>Sözlük</h2>{{sozluk}}' },
  { ad: "Oyun menüsü", stil: ".eks-vitrin{text-align:center}\n.eks-vitrin h1{font-family:var(--mono);font-size:2.4em;letter-spacing:.15em;text-transform:uppercase}\n.eks-vitrin .menu{display:grid;gap:10px;max-width:360px;margin:20px auto}\n.eks-vitrin .menu p{border:2px solid var(--deniz);padding:12px;border-radius:999px;margin:0;font-family:var(--mono)}",
    gorunum: '<h1>{{ad}}</h1>\n<p>{{ozet}}</p>\n<div class="menu">\n  <p>▶ Oyunlar sekmesinde oyna</p>\n  <p>✦ Romanı oku</p>\n  <p>◎ Haritayı keşfet</p>\n</div>' },
  { ad: "Gece gökyüzü", stil: ".eks-vitrin{background:#070b16;color:#e8eefc;padding:16px;border-radius:14px}\n.eks-vitrin .gok{padding:36px 20px;border-radius:14px;background:radial-gradient(circle at 30% 20%,#23305a,#070b16 70%);text-align:center}\n.eks-vitrin .gok h1{font-weight:400;letter-spacing:.3em;text-transform:uppercase}",
    gorunum: '<div class="gok">\n  <h1>{{ad}}</h1>\n  <p>{{yazi:yıldız yolu}}</p>\n  <p>{{ozet}}</p>\n</div>\n<h3>Yıldız haritası</h3>{{harita}}' }
];

function eksDuzenKutusu(e) {
  const d = e.sekmeDuzen || {};
  const tum = ["harita", "vitrin", "oyunlar", "roman", "cizim", "uygulama", "yazi", "lore", "defter", "alfabe", "ag"];
  return '<div class="kutu-y eks-sablon"><label>Hazır şablonlar (stil + görünüm)</label>' +
      '<p class="oyun-not">Birini seç; stil ve görünüm kodu birlikte gelir, sonra dilediğin gibi değiştir.</p>' +
      '<div class="oyun-sira">' + EKS_SABLONLAR.map(function (s, i) { return '<button class="dugme dugme-sade" data-eks-sablon="' + i + '">' + kacir(s.ad) + "</button>"; }).join("") + "</div></div>" +
    '<div class="kutu-y eks-duzen"><label for="eksIlk">Evren açılınca ilk sekme</label>' +
      '<select class="kod-giris arac-giris" id="eksIlk"><option value="">Harita (varsayılan)</option>' + tum.filter(function (x) { return x !== "harita"; }).map(function (x) {
        return '<option value="' + x + '"' + (d.ilk === x ? " selected" : "") + ">" + kacir(SEKME_ADLARI[x] || x) + "</option>";
      }).join("") + "</select>" +
      '<label>Ziyaretçilerden gizlenecek sekmeler</label><div class="y-alan-izgara">' + tum.map(function (x) {
        return '<label class="y-alan-secim"><input type="checkbox" data-eks-gizle="' + x + '"' + ((d.gizli || []).indexOf(x) !== -1 ? " checked" : "") + "> " + kacir(SEKME_ADLARI[x] || x) + "</label>";
      }).join("") + "</div>" +
      '<p class="oyun-not">Sen her sekmeyi görmeye devam edersin; gizleme ziyaretçiler içindir.</p></div>';
}

if (typeof eksKodBolumu === "function") {
  const eskiEks = eksKodBolumu;
  window.eksKodBolumu = function (v) { return eksDuzenKutusu(v.eser) + eskiEks.apply(this, arguments); };
}

document.addEventListener("change", function (ev) {
  const t = ev.target;
  if (!t || !EVS || EVS.kaynak !== "benim" || typeof evrenBenimDegistir !== "function") { return; }
  if (t.id !== "eksIlk" && !(t.matches && t.matches("[data-eks-gizle]"))) { return; }
  const gizli = Array.prototype.slice.call(document.querySelectorAll("[data-eks-gizle]")).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-eks-gizle"); });
  const ilk = (document.querySelector("#eksIlk") || {}).value || "";
  evrenBenimDegistir(EVS.id, function (e) { const d = sekmeDuzenTemizle({ ilk: ilk, gizli: gizli }); if (d) { e.sekmeDuzen = d; } else { delete e.sekmeDuzen; } });
});

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-eks-sablon]");
  if (!b || !EVS || EVS.kaynak !== "benim" || typeof evrenBenimDegistir !== "function") { return; }
  const s = EKS_SABLONLAR[Number(b.getAttribute("data-eks-sablon"))];
  if (!s) { return; }
  evrenBenimDegistir(EVS.id, function (e) { e.stilKodu = s.stil; e.gorunumKodu = s.gorunum; });
  EVS.sekme = "vitrin";
  evrenSayfaCiz();
});

/* ==================== okur: yazı çözme oyunu ==================== */

function yaziCozKelimeleri(e) {
  if (!e || !e.yazi || typeof eyDolu !== "function" || !eyDolu(e.yazi) || typeof evoKelimeler !== "function") { return []; }
  return evoKelimeler(e).filter(function (k) { return eyParcala(k, e.yazi).every(function (p) { return !!p.isaret; }); });
}

if (typeof EVO_OYUNLAR !== "undefined" && !EVO_OYUNLAR.some(function (g) { return g.id === "yazicoz"; })) {
  EVO_OYUNLAR.push({ id: "yazicoz", ad: "Yazıyı çöz", ozet: "Evrenin kendi yazısıyla yazılmış adı bul. İşaretler Yazı sekmesinde." });
  EVO_EN_AZ.yazicoz = 4;
  EVO_SORU_OYUNU.yazicoz = true;
  const eskiDurum = evoDurumlari;
  window.evoDurumlari = function (e) {
    return eskiDurum.apply(this, arguments).map(function (d) {
      if (d.id !== "yazicoz") { return d; }
      const n = yaziCozKelimeleri(e).length;
      return Object.assign({}, d, { sayi: n, yeter: n >= EVO_EN_AZ.yazicoz });
    });
  };
}

function yaziCozBaslat(e) {
  const l = evoKaristir(yaziCozKelimeleri(e));
  EVO = { oyun: "yazicoz", evren: EVS.kaynak + ":" + EVS.id, i: 0, dogru: 0, secim: null, mesaj: "",
    sorular: l.slice(0, 5).map(function (k) {
      return { soru: "Bu evrenin yazısıyla ne yazıyor?", dogru: k,
        soruHtml: '<span class="oyun-not">Bu evrenin yazısıyla ne yazıyor?</span><span class="yc-yazi">' + eyYaziSvg(k, e.yazi, 48) + "</span>",
        secenekler: evoKaristir([k].concat(evoKaristir(l.filter(function (x) { return x !== k; })).slice(0, 3))) };
    }) };
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest('[data-evo-basla="yazicoz"]');
  if (!b || !EVS) { return; }
  const v = evrenSayfaVerisi();
  if (!v) { return; }
  yaziCozBaslat(v.eser);
  evrenSayfaCiz();
});

/* ==================== okur: uygulama puan tabloları ==================== */

function evuSkorAnahtari(u) {
  const ev = String(typeof evrenCuzdanAnahtari === "function" ? evrenCuzdanAnahtari() : "ev").replace(/[^\w:.-]/g, "_").slice(0, 80);
  return { evren: ev || "ev", uygulama: String(u.id || "u").replace(/[^\w-]/g, "_").slice(0, 40) || "u" };
}
const EVU_SKOR = { son: 0, enIyi: {} };   /* aynı oyundan saniyede onlarca puan gelirse sunucuyu yormasın */

async function evuSkorTablosu(kap, u) {
  if (typeof hesapIstemci === "undefined" || !hesapIstemci) { return; }
  const a = evuSkorAnahtari(u);
  let el = kap.parentNode && kap.parentNode.querySelector(".evu-skor");
  if (!el) { el = document.createElement("div"); el.className = "evu-skor"; kap.insertAdjacentElement("afterend", el); }
  try {
    const r = await hesapIstemci.rpc("uygulama_skor_tablosu", { p_evren: a.evren, p_uygulama: a.uygulama });
    const l = (!r.error && Array.isArray(r.data)) ? r.data : [];
    el.innerHTML = l.length ? '<span class="oyun-etiket">Puan tablosu</span><ol>' + l.map(function (x) {
      return "<li><b>" + kacir(x.ad) + "</b> · " + kacir(String(x.puan)) + "</li>";
    }).join("") + "</ol>" : "";
  } catch (_) { el.innerHTML = ""; }
}

async function evuSkorYaz(c, puan, cevap) {
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) { cevap({ tip: "skorlandi", durum: "giris" }); return; }
  const a = evuSkorAnahtari(c.uygulama);
  const p = Math.max(-1e9, Math.min(1e9, Math.round(Number(puan) || 0)));
  const k = a.evren + "|" + a.uygulama;
  const simdi = Date.now();
  if ((k in EVU_SKOR.enIyi && p <= EVU_SKOR.enIyi[k]) || simdi - EVU_SKOR.son < 3000) { cevap({ tip: "skorlandi", durum: "tamam" }); return; }
  EVU_SKOR.son = simdi;
  try {
    const r = await hesapIstemci.rpc("uygulama_skor_yaz", { p_evren: a.evren, p_uygulama: a.uygulama, p_puan: p });
    const durum = (!r.error && r.data && r.data.durum) || "hata";
    if (durum === "rekor") { EVU_SKOR.enIyi[k] = p; } else if (durum === "tamam" && r.data.enIyi != null) { EVU_SKOR.enIyi[k] = Number(r.data.enIyi); }
    cevap({ tip: "skorlandi", durum: durum });
    const d = document.querySelector("#evuDurum");
    if (d && durum === "rekor") { d.textContent = "Yeni en iyi puanın: " + p; }
    if (c.cerceve.isConnected) { evuSkorTablosu(c.cerceve.parentNode, c.uygulama); }
  } catch (_) { cevap({ tip: "skorlandi", durum: "hata" }); }
}

/* ==================== okur: evren keşfi ==================== */

const KESIF = { ara: "", sira: "yeni" };

function kesifListesi() {
  const l = ((veri && veri.fanEserleri) || {}).evrenler || [];
  const q = KESIF.ara.toLocaleLowerCase("tr").trim();
  const zengin = function (e) { const s = e.sayilar || {}; return (s.kisi || 0) + (s.yer || 0) + (s.kural || 0) + 3 * (s.bolum || 0); };
  return l.filter(function (e) { return !q || (String(e.ad) + " " + (e.ozet || "") + " " + (e.yazar || "")).toLocaleLowerCase("tr").indexOf(q) !== -1; })
    .sort(function (a, b) {
      if (KESIF.sira === "ad") { return String(a.ad).localeCompare(String(b.ad), "tr"); }
      if (KESIF.sira === "zengin") { return zengin(b) - zengin(a); }
      return String(b.eklenme || b.olusturma || "").localeCompare(String(a.eklenme || a.olusturma || ""));
    });
}

function kesifCiz() {
  const alan = document.querySelector("#fanEvrenAlan");
  if (!alan || !veri) { return; }
  let k = document.querySelector("#evrenKesif");
  const hepsi = ((veri.fanEserleri || {}).evrenler || []);
  if (!hepsi.length) { if (k) { k.remove(); } return; }
  if (!k) {
    k = document.createElement("div");
    k.id = "evrenKesif";
    k.className = "kutu-y evren-kesif";
    alan.parentNode.insertBefore(k, alan);
    k.innerHTML = '<div class="gk-ust"><span class="oyun-etiket">Evrenleri keşfet</span><select class="kod-giris arac-giris kesif-sira" id="kesifSira" aria-label="Sırala">' +
      '<option value="yeni">En yeni</option><option value="zengin">En zengin</option><option value="ad">Ada göre</option></select></div>' +
      '<input class="kod-giris arac-giris" id="kesifAra" type="search" placeholder="Evren, yazar ya da konu ara…" aria-label="Evren ara">' +
      '<div class="kesif-liste" id="kesifListe"></div>';
  }
  const l = kesifListesi();
  document.querySelector("#kesifListe").innerHTML = l.length ? l.map(function (e) {
    const s = e.sayilar || {};
    return '<button class="kesif-kart" data-evren-git="#/ev/fan/' + kacir(e.id) + '"><b>' + kacir(e.ad || "Adsız evren") + "</b>" +
      (e.yazar ? '<span class="oyun-not">' + kacir(e.yazar) + "</span>" : "") +
      (e.ozet ? "<span>" + kacir(String(e.ozet).slice(0, 140)) + "</span>" : "") +
      '<span class="kesif-sayi">' + [[s.kisi, "kişi"], [s.yer, "yer"], [s.bolum, "bölüm"]].filter(function (x) { return x[0]; }).map(function (x) { return x[0] + " " + x[1]; }).join(" · ") + "</span></button>";
  }).join("") : '<p class="oyun-not">Aramana uyan evren yok.</p>';
}

if (typeof fanEvrenCiz === "function") {
  const eskiFE = fanEvrenCiz;
  window.fanEvrenCiz = function () { const r = eskiFE.apply(this, arguments); kesifCiz(); return r; };
}

document.addEventListener("input", function (e) { if (e.target && e.target.id === "kesifAra") { KESIF.ara = e.target.value; kesifCiz(); } });
document.addEventListener("change", function (e) { if (e.target && e.target.id === "kesifSira") { KESIF.sira = e.target.value; kesifCiz(); } });

/* ==================== okur: cihazlarım ==================== */

const CIHAZ_ID = "tentiforapp_cihaz_id";
const CIHAZLAR = "tentiforapp_cihazlar";

function buCihazId() {
  let id = null;
  try { id = localStorage.getItem(CIHAZ_ID); if (!id) { id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); localStorage.setItem(CIHAZ_ID, id); } } catch (_) { id = "gecici"; }
  return id;
}

function buCihazAdi() {
  const ua = navigator.userAgent || "";
  const sis = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Cihaz";
  const tar = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "tarayıcı";
  return sis + " · " + tar + (TentiforKopru.ortam() !== "web" ? " (uygulama)" : "");
}

if (typeof esitBulutaYaz === "function") {
  const eskiBY = esitBulutaYaz;
  window.esitBulutaYaz = function (g) {
    try {
      const o = JSON.parse(g[CIHAZLAR] || "{}") || {};
      o[buCihazId()] = { ad: buCihazAdi(), son: new Date().toISOString() };
      /* en çok 12 cihaz: en eskiler düşer */
      const k = Object.keys(o).sort(function (a, b) { return String(o[b].son).localeCompare(String(o[a].son)); });
      k.slice(12).forEach(function (x) { delete o[x]; });
      g[CIHAZLAR] = JSON.stringify(o);
      localStorage.setItem(CIHAZLAR, g[CIHAZLAR]);
    } catch (_) { /* yoksay */ }
    return eskiBY.apply(this, arguments);
  };
}

function cihazlarimHtml() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(CIHAZLAR) || "{}") || {}; } catch (_) { o = {}; }
  const id = buCihazId();
  const k = Object.keys(o).sort(function (a, b) { return String(o[b].son).localeCompare(String(o[a].son)); });
  if (!k.length) { return ""; }
  return '<details class="kutu-y cihazlarim"><summary><b>Cihazlarım</b> · ' + k.length + "</summary><ul>" + k.map(function (x) {
    const d = new Date(o[x].son);
    return "<li><b>" + kacir(o[x].ad || "Cihaz") + "</b>" + (x === id ? " · bu cihaz" : "") +
      '<span class="oyun-not"> · son eşitleme ' + kacir(isNaN(d) ? "?" : d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })) + "</span></li>";
  }).join("") + '</ul><p class="oyun-not">Bir cihazda kazandığın, öteki cihaz açılınca birleşir.</p></details>';
}

if (typeof hesapCiz === "function") {
  const eskiHC = hesapCiz;
  window.hesapCiz = function () {
    const r = eskiHC.apply(this, arguments);
    const kap = document.querySelector("#hesapAlan .hesap-esit");
    if (kap && !document.querySelector(".cihazlarim") && typeof hesapKullanici !== "undefined" && hesapKullanici) {
      kap.insertAdjacentHTML("afterend", cihazlarimHtml());
    }
    return r;
  };
}

/* ==================== arşiv araması: telefonda sonuç kutusu kapanabilsin ==================== */

/* Sonuç kutusu yalnızca yazı silinince kapanıyordu: dışarı dokununca ya da Esc ile kapanır, kutuya dönünce yeniden açılır. */
document.addEventListener("click", function (e) {
  const k = document.querySelector("#aramaSonuc");
  if (!k || k.hidden || (e.target.closest && e.target.closest(".arama-kutu"))) { return; }
  k.hidden = true;
});
document.addEventListener("focusin", function (e) {
  if (e.target && e.target.id === "aramaGiris" && typeof aramaCiz === "function") { aramaCiz(); }
});
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape" || !e.target || e.target.id !== "aramaGiris") { return; }
  const k = document.querySelector("#aramaSonuc");
  if (k && !k.hidden) { k.hidden = true; e.target.blur(); }
});

/* ==================== çevrimdışı ==================== */

/* Uyarının kendisi 42-mobil.js'te (#cevrimdisi; bağlantı gelince bildirim ve eşitleme de orada). Burada yalnızca
   sayfa sınıfı. Dikkat: "cevrimdisi" sınıf adı o uyarının stilidir (sabit konum, dar kutu); html'e verilirse bütün
   sayfa o kutuya sıkışır — bu yüzden ayrı ad. */
function cevrimdisiSerit() {
  document.documentElement.classList.toggle("cevrimdisi-mod", navigator.onLine === false);
}

window.addEventListener("offline", cevrimdisiSerit);
window.addEventListener("online", function () {
  cevrimdisiSerit();
  if (typeof tekHaklariYukle === "function") { tekHaklariYukle(); }
});

/* internetsizken giriş: hesap kütüphanesi henüz inmediyse pencere boş kalıyordu; ne olduğunu söyle */
if (typeof hesapPencere === "function") {
  const eskiHP = hesapPencere;
  window.hesapPencere = function () {
    const kutuphane = window.supabase && window.supabase.createClient;
    if (navigator.onLine === false && !kutuphane) {
      const p = document.querySelector("#perde");
      if (p) {
        p.innerHTML = '<div class="pencere" role="dialog" aria-modal="true" aria-labelledby="cdHesapBaslik">' +
          '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
          '<h3 id="cdHesapBaslik">Çevrimdışısın</h3>' +
          '<p class="pencere-alt">Giriş yapmak ya da hesap açmak için internet gerekir.</p>' +
          '<p class="oyun-not">Okuduğun, oynadığın ve kazandığın her şey bu cihazda duruyor. Bağlantı gelince giriş yaparsan hesabınla birleşir.</p>' +
          '<button class="dugme" data-kapat="1">Tamam</button></div>';
        p.hidden = false;
      }
      return;
    }
    return eskiHP.apply(this, arguments);
  };
}

function cevrimdisiHazirBildir() {
  if (!("serviceWorker" in navigator)) { return; }
  if (TentiforKopru.ortam() === "web") { return; }
  navigator.serviceWorker.ready.then(function () {
    try {
      if (localStorage.getItem("tentiforapp_cevrimdisi_hazir")) { return; }
      localStorage.setItem("tentiforapp_cevrimdisi_hazir", "1");
    } catch (_) { return; }
    if (typeof eckaBildir === "function") { eckaBildir("Uygulama hazır · internetsiz de açılır"); }
  }).catch(function () { /* yok */ });
}

/* ==================== uygulama köprüsü ==================== */

/** İleride Play Store (TWA) ya da App Store / Play (Capacitor) kabuğunda çalışırken sitenin tek giriş noktası.
    Şimdilik tarayıcı API'lerine düşer; kabuk eklenince yalnızca burası değişir. Ayrıntı: uygulama/README.md */
const TentiforKopru = {
  ortam: function () {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) { return "capacitor"; }
    try {
      if (document.referrer && document.referrer.indexOf("android-app://") === 0) { sessionStorage.setItem("tf-ortam", "twa"); }
      if (sessionStorage.getItem("tf-ortam") === "twa") { return "twa"; }
    } catch (_) { /* yoksay */ }
    if ((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true) { return "pwa"; }
    return "web";
  },
  paylas: async function (v) {
    /* uygulamada (Capacitor) WebView'ın paylaşımı yok: telefonun kendi paylaşım menüsü */
    const pl = window.Capacitor && window.Capacitor.Plugins;
    if (pl && pl.Share && TentiforKopru.ortam() === "capacitor") { try { await pl.Share.share({ title: v.title, text: v.text, url: v.url }); return true; } catch (_) { return false; } }
    if (navigator.share) { try { await navigator.share(v); return true; } catch (_) { return false; } }
    if (v && v.url && typeof panoyaKopyala === "function") { panoyaKopyala(v.url); return true; }
    return false;
  },
  titret: function (ms) {
    try {
      const h = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
      if (h && TentiforKopru.ortam() === "capacitor") { h.vibrate({ duration: ms || 15 }).catch(function () { /* yok */ }); return; }
      if (navigator.vibrate) { navigator.vibrate(ms || 15); }
    } catch (_) { /* yok */ }
  },
  surum: function () { return (typeof veri !== "undefined" && veri && veri.surum) || ""; }
};
window.TentiforKopru = TentiforKopru;

/* ==================== başlangıç ==================== */

davetKoduAl();
document.addEventListener("DOMContentLoaded", function () {
  const o = TentiforKopru.ortam();
  document.documentElement.classList.toggle("uygulama-modu", o !== "web");
  document.documentElement.setAttribute("data-ortam", o);
  cevrimdisiSerit();
  cevrimdisiHazirBildir();
  const bekle = typeof veriHazirOlunca === "function" ? veriHazirOlunca : function (f) { setTimeout(f, 1500); };
  bekle(function () {
    kesifCiz();
    const oturumVardi = davetOturumBekleniyor();
    setTimeout(davetKoduDene, 900);
    /* kayıtlı oturum açılamadıysa (süresi dolmuş) davet yine de sorulsun */
    if (oturumVardi) { setTimeout(function () { DAVET_OTURUM.bekle = false; davetKoduDene(); }, 8000); }
  });
});
