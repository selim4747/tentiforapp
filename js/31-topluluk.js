/* Topluluk ve oyunlaştırma — teori panosu, içerik oylaması, takip, profil vitrini,
   arşivci seviyeleri, yarış madalyaları, haftalık görev zinciri.

   Veriler Supabase'de (supabase/kurulum.sql, TOPLULUK ve OYUNLAŞTIRMA bölümleri).
   Yazma işlemlerinin hepsi sunucudaki fonksiyonlardan geçer: sıklık sınırı,
   bildirimle gizleme ve yönetici işaretleri orada. */

function toplulukHazir() { return typeof hesapIstemci !== "undefined" && !!hesapIstemci; }
function toplulukGirisli() { return toplulukHazir() && typeof hesapKullanici !== "undefined" && !!hesapKullanici; }

let toplulukYonetici = null;   /* { uid, deger }: rpc yonetici_mi sonucu, kullanıcı başına bir kez */

async function toplulukYoneticiMi() {
  if (!toplulukGirisli()) { return false; }
  if (!toplulukYonetici || toplulukYonetici.uid !== hesapKullanici.id) {
    const r = await hesapIstemci.rpc("yonetici_mi");
    toplulukYonetici = { uid: hesapKullanici.id, deger: r.data === true };
  }
  return toplulukYonetici.deger;
}

/* ==================== TEORİ PANOSU ==================== */

let teoriKonu = null;

function teoriKonular() { return (veri.bilinmeyenler || []).map(function (b) { return b.soru; }); }

async function teoriCiz() {
  const alan = document.querySelector("#teoriAlan");
  if (!alan) { return; }
  if (typeof hesapEtkin !== "function" || !hesapEtkin()) { alan.innerHTML = ""; return; }
  if (!toplulukHazir()) { alan.innerHTML = '<p class="oyun-not">Teoriler yükleniyor…</p>'; hesapGorununce(alan, teoriCiz); return; }

  const konular = teoriKonular();
  if (!konular.length) { alan.innerHTML = ""; return; }
  if (!teoriKonu || konular.indexOf(teoriKonu) === -1) { teoriKonu = konular[0]; }

  const { data, error } = await hesapIstemci.from("teori_listesi").select("*").eq("konu", teoriKonu);
  const yon = await toplulukYoneticiMi();
  const liste = (data || []).map(function (t) { t.begeni = Number(t.begeni) || 0; return t; })
    .sort(function (a, b) {
      const s = function (x) { return x.isaret === "kanon" ? 2 : x.isaret === "yakin" ? 1 : 0; };
      return s(b) - s(a) || b.begeni - a.begeni || new Date(b.zaman) - new Date(a.zaman);
    });

  alan.innerHTML =
    '<p class="oyun-not">Açık sorulara kendi teorini yaz. Yazar beğendiği teoriyi <b>kanon</b> ya da <b>yakın</b> diye işaretleyebilir; ' +
      "sahibi rozet ve seviye puanı kazanır.</p>" +
    '<select class="kod-giris arac-giris teori-konu" id="teoriKonu" aria-label="Soru">' + konular.map(function (k) {
      return '<option value="' + kacir(k) + '"' + (k === teoriKonu ? " selected" : "") + ">" + kacir(k) + "</option>";
    }).join("") + "</select>" +
    (error ? '<p class="oyun-not">' + kacir(hesapHataMetni(error)) + "</p>" : "") +
    '<div class="teori-liste">' + (liste.length ? liste.map(function (t) {
      return '<div class="teori' + (t.isaret ? " " + t.isaret : "") + '">' +
          (t.isaret ? '<span class="teori-isaret">' + (t.isaret === "kanon" ? "★ kanon" : "◐ yakın") + "</span>" : "") +
          '<p class="teori-metin">' + kacir(t.metin) + "</p>" +
          '<div class="teori-alt">' +
            '<a href="#/u/' + encodeURIComponent(t.kullanici_adi) + '">@' + kacir(t.kullanici_adi) + "</a>" +
            '<span class="oyun-not">' + new Date(t.zaman).toLocaleDateString("tr-TR") + "</span>" +
            '<button class="teori-begen' + (t.ben_begendim ? " acik" : "") + '" data-teori-begen="' + t.id + '"' +
              (t.benim || !toplulukGirisli() ? " disabled" : "") + ' aria-label="Beğen">♥ ' + t.begeni + "</button>" +
            (t.benim || yon ? '<button class="ic-bag" data-teori-sil="' + t.id + '">sil</button>' : "") +
            (!t.benim && toplulukGirisli() ? '<button class="ic-bag" data-teori-bildir="' + t.id + '">bildir</button>' : "") +
            (yon ? '<span class="teori-yon">' +
                '<button class="ic-bag" data-teori-isaret="kanon" data-id="' + t.id + '">kanon</button>' +
                '<button class="ic-bag" data-teori-isaret="yakin" data-id="' + t.id + '">yakın</button>' +
                '<button class="ic-bag" data-teori-isaret="" data-id="' + t.id + '">işareti kaldır</button>' +
                '<button class="ic-bag" data-teori-gizle="' + t.id + '">gizle</button></span>' : "") +
          "</div></div>";
    }).join("") : '<p class="lider-bos">Bu soruya henüz teori yazılmadı. İlk sen yaz!</p>') + "</div>" +
    (toplulukGirisli()
      ? '<form class="teori-form" data-teori-form="1"><textarea class="kod-giris" id="teoriMetin" rows="3" maxlength="1000" ' +
          'placeholder="Teorin (en az 20 karakter)"></textarea><button class="dugme" type="submit">Teorimi paylaş</button></form>' +
        '<p class="pencere-durum" id="teoriDurum"></p>'
      : '<button class="dugme dugme-sade" data-hesap-pencere="giris">Teori yazmak için giriş yap</button>');
}

async function teoriGonder(form) {
  const metin = ((form.querySelector("#teoriMetin") || {}).value || "").trim();
  const d = document.querySelector("#teoriDurum");
  const yaz = function (m, iyi) { if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };
  if (metin.length < 20) { yaz("Teorin en az 20 karakter olmalı."); return; }
  const { data, error } = await hesapIstemci.rpc("teori_yaz", { p_konu: teoriKonu, p_metin: metin });
  if (error) { yaz(hesapHataMetni(error)); return; }
  const m = { tamam: "Teorin paylaşıldı.", sinir: "Bugün yeterince teori yazdın (günde 5).", kisa: "Teorin çok kısa.",
              engelli: "Hesabın tablolardan çıkarıldığı için teori yazamıyorsun.", giris: "Önce giriş yap." }[data && data.durum];
  if (data && data.durum === "tamam") { teoriCiz(); hesapBildir(m); } else { yaz(m || "Paylaşılamadı."); }
}

/* bilinmeyenler bölümü çizildikten sonra teoriler de çizilsin */
function teoriBagla() {
  if (typeof bilinmeyenCiz === "function") {
    const eski = bilinmeyenCiz;
    window.bilinmeyenCiz = function () { const r = eski.apply(this, arguments); teoriCiz(); return r; };
  }
  if (typeof cizYapimlar === "function") {
    const eskiY = cizYapimlar;
    window.cizYapimlar = function () { const r = eskiY.apply(this, arguments); oylamaCiz(); return r; };
  }
}

/* ==================== İÇERİK OYLAMASI ==================== */

let oylarim = [];

async function oylamaCiz() {
  const alan = document.querySelector("#oylamaAlan");
  if (!alan) { return; }
  if (typeof hesapEtkin !== "function" || !hesapEtkin()) { alan.innerHTML = ""; return; }
  if (!toplulukHazir()) { alan.innerHTML = '<p class="oyun-not">Oylama yükleniyor…</p>'; hesapGorununce(alan, oylamaCiz); return; }

  const [s, b] = await Promise.all([
    hesapIstemci.from("yapim_oy_sayilari").select("yapim, oy"),
    toplulukGirisli() ? hesapIstemci.rpc("oylarim") : Promise.resolve({ data: [] })
  ]);
  oylarim = Array.isArray(b.data) ? b.data : [];
  const liste = (s.data || []).map(function (x) { return { yapim: x.yapim, oy: Number(x.oy) || 0 }; })
    .sort(function (a, c) { return c.oy - a.oy || a.yapim.localeCompare(c.yapim, "tr"); });
  if (!liste.length) { alan.innerHTML = '<p class="oyun-not">Oylama, yönetici bir sonraki girişinde açılacak.</p>'; return; }
  const enCok = Math.max.apply(null, liste.map(function (x) { return x.oy; }).concat([1]));

  alan.innerHTML = '<p class="oyun-not">Sıradaki hangisi olsun? En çok 3 yapıma oy verebilirsin' +
      (toplulukGirisli() ? " · kalan oyun: <b>" + (3 - oylarim.length) + "</b>" : "") + ".</p>" +
    '<div class="oylama">' + liste.map(function (x) {
      const benim = oylarim.indexOf(x.yapim) !== -1;
      return '<div class="dagilim-satir oy' + (benim ? " ben" : "") + '"><span>' + kacir(x.yapim) + "</span>" +
        '<span class="lider-cubuk"><i style="width:' + Math.round(100 * x.oy / enCok) + '%"></i></span><b>' + x.oy + "</b>" +
        (toplulukGirisli()
          ? '<button class="dugme dugme-sade oy-dugme' + (benim ? " acik" : "") + '" data-oyla="' + kacir(x.yapim) + '"' +
              (!benim && oylarim.length >= 3 ? " disabled" : "") + ">" + (benim ? "geri al" : "oy ver") + "</button>"
          : "") +
        "</div>";
    }).join("") + "</div>" +
    (toplulukGirisli() ? "" : '<button class="dugme dugme-sade" data-hesap-pencere="giris">Oy vermek için giriş yap</button>');
}

/* ==================== TAKİP ve VİTRİN ==================== */

/** Profil düzenleme formuna: sevdiğin karakter ve satır. */
function vitrinSecimleri(v) {
  const karakterler = (veri.karakterler || []).filter(function (k) { return k.ad && k.unvan; });
  const alintilar = (veri.alintilar || []).filter(function (a) { return !a.gizli; });
  return '<label class="hesap-etiket" for="hpVitrinKarakter">Vitrin: sevdiğin karakter</label>' +
    '<select class="kod-giris" id="hpVitrinKarakter"><option value="">— seçme —</option>' + karakterler.map(function (k) {
      return '<option value="' + kacir(k.id) + '"' + (v.karakter === k.id ? " selected" : "") + ">" + kacir(k.ad) + "</option>";
    }).join("") + "</select>" +
    '<label class="hesap-etiket" for="hpVitrinAlinti">Vitrin: sevdiğin satır</label>' +
    '<select class="kod-giris" id="hpVitrinAlinti"><option value="">— seçme —</option>' + alintilar.map(function (a) {
      const m = a.metin.length > 70 ? a.metin.slice(0, 68) + "…" : a.metin;
      return '<option value="' + kacir(a.metin) + '"' + (v.alinti === a.metin ? " selected" : "") + ">" + kacir(m) + "</option>";
    }).join("") + "</select>";
}

/** Herkese açık profile: seviye, takip, vitrin, teori rozetleri. */
async function toplulukProfilEk(p) {
  const el = document.querySelector("#profilTopluluk");
  if (!el || !toplulukHazir()) { return; }
  const ad = p.kullanici_adi;
  const [sv, ts, tr, liste] = await Promise.all([
    hesapIstemci.from("arsivci_seviyeleri").select("xp, seviye").eq("kullanici_adi", ad).maybeSingle(),
    hesapIstemci.from("takip_sayilari").select("takipci, takip").eq("kullanici_adi", ad).maybeSingle(),
    hesapIstemci.from("teori_rozetleri").select("kanon, yakin").eq("kullanici_adi", ad).maybeSingle(),
    toplulukGirisli() ? hesapIstemci.rpc("takip_ettiklerim") : Promise.resolve({ data: [] })
  ]);
  const ben = typeof hesapProfil !== "undefined" && hesapProfil && hesapProfil.kullanici_adi === ad;
  const takipte = Array.isArray(liste.data) && liste.data.indexOf(ad) !== -1;
  const v = p.vitrin || {};
  const k = v.karakter ? (veri.karakterler || []).find(function (x) { return x.id === v.karakter; }) : null;
  const seviye = sv.data ? Number(sv.data.seviye) : 1;

  let html = '<div class="profil-topluluk">' +
    '<div class="profil-seviye"><span class="seviye-rozet">' + seviye + "</span><span><b>" + kacir(seviyeUnvani(seviye)) + "</b>" +
      '<span class="oyun-not"> · ' + (sv.data ? Number(sv.data.xp) : 0) + " XP</span></span></div>" +
    '<div class="profil-takip"><span><b>' + (ts.data ? Number(ts.data.takipci) : 0) + "</b> takipçi</span><span><b>" +
      (ts.data ? Number(ts.data.takip) : 0) + "</b> takip</span>" +
      (toplulukGirisli() && !ben ? '<button class="dugme' + (takipte ? " dugme-sade" : "") + '" data-takip="' + kacir(ad) + '">' +
        (takipte ? "Takibi bırak" : "Takip et") + "</button>" : "") +
    "</div>";
  if (k || v.alinti) {
    html += '<div class="profil-vitrin"><span class="oyun-etiket">Vitrin</span>' +
      (k ? '<p>Sevdiği karakter: <a href="#/karakter/' + encodeURIComponent(k.id) + '">' + kacir(k.ad) + "</a></p>" : "") +
      (v.alinti ? '<blockquote>“' + kacir(v.alinti) + "”</blockquote>" : "") + "</div>";
  }
  if (tr.data && (Number(tr.data.kanon) || Number(tr.data.yakin))) {
    html += '<div class="hesap-madalya">' +
      (Number(tr.data.kanon) ? '<span class="birinci">★ ' + Number(tr.data.kanon) + " kanon teori</span>" : "") +
      (Number(tr.data.yakin) ? "<span>◐ " + Number(tr.data.yakin) + " yakın teori</span>" : "") + "</div>";
  }
  el.innerHTML = html + "</div>";
}

/* ==================== SEVİYE ==================== */

const SEVIYE_UNVANLARI = [[1, "Çırak"], [3, "Raf Görevlisi"], [5, "Okur"], [8, "Arşivci"], [12, "Kâtip"],
                          [16, "Baş Kâtip"], [20, "Kütüphaneci"], [25, "Tömye Bilgesi"]];

function seviyeUnvani(s) {
  let u = SEVIYE_UNVANLARI[0][1];
  SEVIYE_UNVANLARI.forEach(function (x) { if (s >= x[0]) { u = x[1]; } });
  return u;
}

/** Seviye s için gereken XP: seviye = floor(sqrt(xp/40)) + 1 */
function seviyeXp(s) { return 40 * (s - 1) * (s - 1); }

/** Sen → Hesabın bölümünün altı: seviye ve madalya kontrolü. */
async function toplulukHesapEk() {
  const el = document.querySelector("#hesapTopluluk");
  if (!el || !toplulukGirisli() || !hesapProfil || !hesapProfil.kullanici_adi) { return; }
  const { data } = await hesapIstemci.from("arsivci_seviyeleri").select("xp, yil_xp, seviye").eq("kullanici_adi", hesapProfil.kullanici_adi).maybeSingle();
  if (data) {
    const s = Number(data.seviye), xp = Number(data.xp);
    const alt = seviyeXp(s), ust = seviyeXp(s + 1);
    const oran = Math.max(0, Math.min(100, Math.round(100 * (xp - alt) / Math.max(1, ust - alt))));
    const d = (typeof dunyadanTomyeye === "function") ? dunyadanTomyeye(new Date()) : null;
    el.innerHTML = '<div class="hesap-kutu seviye-kutu">' +
      '<div class="profil-seviye"><span class="seviye-rozet">' + s + "</span><span><b>" + kacir(seviyeUnvani(s)) + "</b>" +
        '<span class="oyun-not"> · ' + xp + " XP · sonraki seviyeye " + (ust - xp) + " XP</span></span></div>" +
      '<span class="lider-cubuk"><i style="width:' + oran + '%"></i></span>' +
      '<p class="oyun-not">' + (d ? d.yil + ". Tömye yılı" : "Bu Tömye yılı") + " sezonu: <b>" + Number(data.yil_xp) + " XP</b>. " +
        "XP; tamlık, katmanlar, madalyalar, yarışlar, Günün Kelimesi, İlk Kâşif ve kanon teorilerden gelir.</p>" +
    "</div>";
  }
  toplulukMadalyaKontrol();
}

/* ==================== YARIŞ MADALYALARI ==================== */

let madalyaKontrolZaman = 0;

async function toplulukMadalyaKontrol() {
  if (!toplulukGirisli() || !hesapProfil || !hesapProfil.kullanici_adi || typeof madalyaVer !== "function") { return; }
  if (Date.now() - madalyaKontrolZaman < 15000) { return; }
  madalyaKontrolZaman = Date.now();
  const ad = hesapProfil.kullanici_adi;
  const [gk, ky, yt, ks, tr] = await Promise.all([
    hesapIstemci.rpc("gk_seri"),
    hesapIstemci.from("kyldo_toplam").select("toplam").eq("kullanici_adi", ad).maybeSingle(),
    hesapIstemci.from("yaris_tablolari").select("yaris").eq("kapsam", "tum").eq("kullanici_adi", ad),
    hesapIstemci.from("kasif_sayilari").select("ilk_on").eq("kullanici_adi", ad).maybeSingle(),
    hesapIstemci.from("teori_rozetleri").select("kanon").eq("kullanici_adi", ad).maybeSingle()
  ]);
  if (Number(gk.data) >= 7) { madalyaVer("gk7"); }
  if (ky.data && Number(ky.data.toplam) >= 100) { madalyaVer("kyldo100"); }
  if (yt.data && yt.data.length >= (typeof YARISLAR !== "undefined" ? YARISLAR.length : 10)) { madalyaVer("tumYarislar"); }
  if (ks.data && Number(ks.data.ilk_on) >= 1) { madalyaVer("ilkKasif"); }
  if (tr.data && Number(tr.data.kanon) >= 1) { madalyaVer("kanonTeori"); }
}

/* ==================== HAFTALIK GÖREV ZİNCİRİ ==================== */

/* Sırayla açılır: biri bitince sonraki görünür. Hepsi bitince zincir ödülü. */
const HAFTALIK_GOREVLER = [
  { id: "h_yaris3", ad: "3 farklı yarışta yarış", alan: "farkli_yaris", hedef: 3, odul: 40 },
  { id: "h_gk3", ad: "Günün Kelimesi'ni 3 kez bul", alan: "gk", hedef: 3, odul: 40 },
  { id: "h_kyldo30", ad: "Kyldo Hız Çevirisi'nde 30 kelime çevir", alan: "kyldo", hedef: 30, odul: 50 },
  { id: "h_yaris10", ad: "Bu hafta 10 yarış bitir", alan: "yaris", hedef: 10, odul: 40 },
  { id: "h_teori", ad: "Bir teori yaz", alan: "teori", hedef: 1, odul: 30 }
];
const HAFTALIK_ZINCIR_ODUL = 100;

async function haftalikCiz() {
  const alan = document.querySelector("#haftalikAlan");
  if (!alan) { return; }
  if (!toplulukGirisli()) { alan.innerHTML = ""; return; }
  const { data } = await hesapIstemci.rpc("haftalik_ilerleme");
  if (!data) { alan.innerHTML = ""; return; }
  const hafta = data.hafta;
  const alindi = function (id) { return typeof kilitAcik === "function" && kilitAcik("haftalik_" + id + "_" + hafta); };
  let acik = true;
  const satirlar = HAFTALIK_GOREVLER.map(function (g) {
    const v = Math.min(g.hedef, Number(data[g.alan]) || 0);
    const bitti = v >= g.hedef, al = alindi(g.id);
    const gorunur = acik;
    if (!al) { acik = false; }   /* alınmamış ilk görevden sonrası kilitli */
    if (!gorunur) { return '<li class="kilitli"><span>🔒 Önceki görevi bitir</span></li>'; }
    return '<li class="' + (al ? "alindi" : bitti ? "hazir" : "") + '"><span>' + kacir(g.ad) + "</span>" +
      '<span class="oyun-not">' + v + "/" + g.hedef + "</span>" +
      (al ? '<span class="oyun-not">✓ ' + g.odul + " eçka</span>"
          : bitti ? '<button class="dugme" data-haftalik-al="' + g.id + '" data-hafta="' + hafta + '">' + g.odul + " eçka al</button>"
          : '<span class="oyun-not">' + g.odul + " eçka</span>") + "</li>";
  });
  const hepsi = HAFTALIK_GOREVLER.every(function (g) { return alindi(g.id); });
  const zincir = alindi("zincir");
  alan.innerHTML = '<div class="haftalik"><span class="oyun-etiket">Haftalık görev zinciri</span>' +
    '<ol class="haftalik-liste">' + satirlar.join("") + "</ol>" +
    (hepsi ? (zincir ? '<p class="oyun-not">Bu haftanın zincirini tamamladın ✓</p>'
                     : '<button class="dugme" data-haftalik-al="zincir" data-hafta="' + hafta + '">Zincir ödülü: ' + HAFTALIK_ZINCIR_ODUL + " eçka</button>")
           : '<p class="oyun-not">Hepsini bitirene +' + HAFTALIK_ZINCIR_ODUL + " eçka. Her pazartesi yenilenir.</p>") +
    "</div>";
}

/** Ödülü, sunucudaki ilerlemeyi yeniden kontrol ettikten sonra verir. */
async function haftalikOdulAl(id, hafta) {
  const { data } = await hesapIstemci.rpc("haftalik_ilerleme");
  if (!data || data.hafta !== hafta) { haftalikCiz(); return; }
  const anahtar = "haftalik_" + id + "_" + hafta;
  if (kilitAcik(anahtar)) { return; }
  let odul;
  if (id === "zincir") {
    if (!HAFTALIK_GOREVLER.every(function (g) { return kilitAcik("haftalik_" + g.id + "_" + hafta); })) { return; }
    odul = HAFTALIK_ZINCIR_ODUL;
  } else {
    const g = HAFTALIK_GOREVLER.find(function (x) { return x.id === id; });
    if (!g || (Number(data[g.alan]) || 0) < g.hedef) { haftalikCiz(); return; }
    odul = g.odul;
  }
  cuzdan.acilan.push(anahtar);
  eckaKazan(odul, id === "zincir" ? "Haftalık zincir" : "Haftalık görev");
  haftalikCiz();
}

/* ==================== liderlik: seviye tabloları ==================== */

LIDERLIK_TABLOLARI.splice(LIDERLIK_TABLOLARI.findIndex(function (t) { return t.id === "tamlik"; }), 0,
  { id: "seviye", grup: "genel", ad: "Seviye", birim: "XP", unvan: "Tömye Bilgesi", not: "Bütün ilerlemeden gelen arşivci puanı.",
    takipli: true, yukle: function (kutu) { return liderlikSeviyeCiz(kutu, "xp"); } },
  { id: "yil_xp", grup: "genel", ad: "Tömye yılı", birim: "XP", unvan: "Yılın Arşivcisi", not: "Bu Tömye yılında kazanılan XP (sezon).",
    takipli: true, yukle: function (kutu) { return liderlikSeviyeCiz(kutu, "yil_xp"); } });

async function liderlikSeviyeCiz(kutu, alan) {
  const { data, error } = await (await liderlikFiltrele(hesapIstemci.from("arsivci_seviyeleri")
    .select("kullanici_adi, gorunen_ad, seviye, " + alan).gt(alan, 0)))
    .order(alan, { ascending: false }).limit(LIDERLIK_SATIR);
  if (error) { throw error; }
  if (!data || !data.length) { kutu.innerHTML = '<p class="lider-bos">Henüz kimse yok.</p>'; return; }
  const t = liderlikTablo(alan === "xp" ? "seviye" : "yil_xp");
  kutu.innerHTML = '<div class="lider-liste">' + data.map(function (p, i) {
    return liderlikSatir(i + 1, p, (alan === "xp" ? "Sv " + p.seviye + " · " : "") + Number(p[alan]) + " XP", t, i === 0 ? t.unvan : "");
  }).join("") + "</div>";
}

/* ==================== olaylar ==================== */

document.addEventListener("change", function (e) {
  if (e.target.id === "teoriKonu") { teoriKonu = e.target.value; teoriCiz(); }
});

document.addEventListener("submit", function (e) {
  const f = e.target.closest("[data-teori-form]");
  if (f) { e.preventDefault(); teoriGonder(f); }
});

document.addEventListener("click", function (e) {
  const b = e.target.closest("[data-teori-begen]");
  if (b) { hesapIstemci.rpc("teori_begen", { p_teori: Number(b.dataset.teoriBegen) }).then(teoriCiz); return; }
  const bi = e.target.closest("[data-teori-bildir]");
  if (bi) {
    if (!confirm("Bu teoriyi uygunsuz diye bildirmek istiyor musun?")) { return; }
    hesapIstemci.rpc("teori_bildir", { p_teori: Number(bi.dataset.teoriBildir) }).then(function () { hesapBildir("Bildirimin alındı"); teoriCiz(); });
    return;
  }
  const s = e.target.closest("[data-teori-sil]");
  if (s) {
    if (!confirm("Teori silinsin mi?")) { return; }
    hesapIstemci.rpc("teori_sil", { p_teori: Number(s.dataset.teoriSil) }).then(teoriCiz);
    return;
  }
  const is = e.target.closest("[data-teori-isaret]");
  if (is) { hesapIstemci.rpc("teori_isaretle", { p_teori: Number(is.dataset.id), p_isaret: is.dataset.teoriIsaret, p_gizli: false }).then(teoriCiz); return; }
  const gz = e.target.closest("[data-teori-gizle]");
  if (gz) { hesapIstemci.rpc("teori_isaretle", { p_teori: Number(gz.dataset.teoriGizle), p_isaret: "", p_gizli: true }).then(teoriCiz); return; }

  const o = e.target.closest("[data-oyla]");
  if (o) {
    hesapIstemci.rpc("yapim_oyla", { p_yapim: o.dataset.oyla }).then(function (r) {
      if (r.data && r.data.durum === "sinir") { hesapBildir("En çok 3 oy verebilirsin"); }
      oylamaCiz();
    });
    return;
  }

  const t = e.target.closest("[data-takip]");
  if (t) {
    hesapIstemci.rpc("takip_et", { p_ad: t.dataset.takip }).then(function (r) {
      if (typeof liderlikTakipListesi !== "undefined") { liderlikTakipListesi = null; }
      hesapBildir(r.data ? "Takip ediyorsun" : "Takibi bıraktın");
      hesapProfilAc(t.dataset.takip);
    });
    return;
  }

  const h = e.target.closest("[data-haftalik-al]");
  if (h) { haftalikOdulAl(h.dataset.haftalikAl, h.dataset.hafta); }
});

if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", teoriBagla); } else { teoriBagla(); }
