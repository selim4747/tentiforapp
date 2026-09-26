/* Topluluk III: haftanın Evrengezeri (ana sayfa vitrini), evren ziyaretçi defteri,
   konuk haritası (bir kişinin götürüldüğü evrenler ve hikâyeler) ve panelde "bu hafta" özeti.

   - Vitrin: sitede yayımlanmış E25 kişilerinden her hafta biri (herkeste aynı kişi).
   - Ziyaretçi defteri: sitedeki evrenlere (kanon, fanmade, E99) hesapla kısa not; yönetici onaylayınca
     herkes görür, yazan kendi bekleyen notunu görür (supabase: evren_defter_*).
   - Konuk haritası: kişinin konuk olarak girdiği eserler bu cihazdaki ve sitedeki eserlerden bulunur. */

/* ==================== haftanın Evrengezeri ==================== */

function haftaNo(t) {
  const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  return Math.floor((d.getTime() / 86400000 + 3) / 7);   /* Pazartesi başlayan hafta sayacı */
}

function haftaninEvrengezeri() {
  const l = fanSiteListesi("kisi").filter(function (e) { return e && e.tur === "kisi" && (e.evren || "e25") === "e25" && e.ad; });
  if (!l.length) { return null; }
  const sira = l.slice().sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  return sira[haftaNo(new Date()) % sira.length];
}

function e25VitrinCiz() {
  const alan = document.querySelector("#e25VitrinAlan");
  if (!alan || !veri) { return; }
  const e = haftaninEvrengezeri();
  if (!e) {
    alan.innerHTML = '<div class="e25-vitrin bos"><span class="oyun-etiket">E25 · Evrengezerler</span>' +
      "<p>E25'e herkes kendi Evrengezerini ekleyebilir. Kişilik halleri senin imzanla kilitli kalır.</p>" +
      '<a class="dugme dugme-sade" href="#/ev/site/e25">Evrengezerini ekle</a></div>';
    return;
  }
  alan.innerHTML = '<div class="e25-vitrin"><span class="oyun-etiket">Haftanın Evrengezeri · E25</span>' +
    "<h3>" + kacir(e.ad) + "</h3>" +
    (e.unvan || e.yazar ? '<p class="oyun-not">' + kacir([e.unvan, e.yazar ? "yaratan: " + e.yazar : ""].filter(Boolean).join(" · ")) + "</p>" : "") +
    (e.ozet ? "<p>" + kacir(String(e.ozet).replace(/\s+/g, " ").slice(0, 240)) + (String(e.ozet).length > 240 ? "…" : "") + "</p>" : "") +
    '<div class="oyun-sira"><a class="dugme" href="#/ev/site/e25">E25\'te gör</a>' +
      '<button class="dugme dugme-sade" data-kisi-kart="site:' + kacir(e.id) + '">Kişi kartı</button></div></div>';
}

/* ==================== konuk haritası ==================== */

/** Kişinin konuk olarak bulunduğu eserler: bu cihazdakiler, sitedekiler ve açılan dosyalar. */
function konukYerleri(kisiId) {
  const l = [];
  const gorulen = {};
  const bak = function (e, kaynak) {
    if (!e || (e.tur !== "hikaye" && e.tur !== "evren") || e.e99) { return; }
    if (!(e.konuklar || []).some(function (k) { return k && k.id === kisiId; })) { return; }
    const a = e.tur + ":" + e.id;
    if (gorulen[a]) { return; }
    gorulen[a] = true;
    l.push({ tur: e.tur, ad: fanAd(e), kaynak: kaynak, id: e.id });
  };
  fanEserlerim().forEach(function (e) { bak(e, "benim"); });
  fanSiteListesi("hikaye").forEach(function (e) { bak(e, "site"); });
  fanSiteListesi("evren").forEach(function (e) { bak(e, "site"); });
  if (typeof fanAcilanlar === "function") { fanAcilanlar().forEach(function (e) { bak(e, "acilan"); }); }
  return l;
}

/** Ortada kişi, çevresinde gittiği yerler; evrenler dolu, hikâyeler boş halka. */
function konukHaritasiSvg(kisi, yerler) {
  const EN = 340, BOY = 260, cx = EN / 2, cy = BOY / 2;
  const r = yerler.length > 6 ? 104 : 92;
  const kisalt = function (s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const noktalar = yerler.map(function (y, i) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, yerler.length);
    return { y: y, x: cx + r * Math.cos(a), yy: cy + r * 0.8 * Math.sin(a) };
  });
  return '<svg class="konuk-harita" viewBox="0 0 ' + EN + " " + BOY + '" role="img" aria-label="' + kacir(kisi.ad) + ' nerelere gitti">' +
    noktalar.map(function (n) { return '<line x1="' + cx + '" y1="' + cy + '" x2="' + n.x.toFixed(1) + '" y2="' + n.yy.toFixed(1) + '" class="kh-cizgi"/>'; }).join("") +
    '<circle cx="' + cx + '" cy="' + cy + '" r="30" class="kh-merkez"/>' +
    '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" class="kh-merkez-yazi">' + kacir(kisalt(kisi.ad, 10)) + "</text>" +
    '<text x="' + cx + '" y="' + (cy + 46) + '" text-anchor="middle" class="kh-alt">E25</text>' +
    noktalar.map(function (n) {
      const sol = n.x < cx - 4, sag = n.x > cx + 4;
      const tx = n.x + (sol ? -12 : (sag ? 12 : 0));
      const ty = n.yy + (Math.abs(n.x - cx) <= 4 ? (n.yy < cy ? -12 : 20) : 4);
      return '<g><title>' + kacir((n.y.tur === "evren" ? "Evren: " : "Hikâye: ") + n.y.ad) + "</title>" +
        '<circle cx="' + n.x.toFixed(1) + '" cy="' + n.yy.toFixed(1) + '" r="7" class="' + (n.y.tur === "evren" ? "kh-evren" : "kh-hikaye") + '"/>' +
        '<text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="' + (sol ? "end" : (sag ? "start" : "middle")) + '" class="kh-yazi">' +
          kacir(kisalt(n.y.ad, 18)) + "</text></g>";
    }).join("") + "</svg>";
}

let konukHaritasiAcik = null;   /* açık haritanın kişi anahtarı: "kaynak:id" */

function konukHaritasiHtml(e, anahtar) {
  const yerler = konukYerleri(e.id);
  if (konukHaritasiAcik !== anahtar) {
    return '<button class="dugme dugme-sade" data-konuk-harita="' + kacir(anahtar) + '">Nerelere gitti?' + (yerler.length ? " (" + yerler.length + ")" : "") + "</button>";
  }
  return '<div class="konuk-harita-kutu"><div class="oyun-etiket">' + kacir(e.ad) + " nerelere gitti?</div>" +
    (yerler.length
      ? konukHaritasiSvg(e, yerler) +
        '<ul class="konuk-yerler">' + yerler.map(function (y) {
          return "<li>" + (y.tur === "evren" ? "Evren" : "Hikâye") + ": <b>" + kacir(y.ad) + "</b> · " +
            ({ benim: "senin", site: "sitede", acilan: "dosyadan" })[y.kaynak] + "</li>";
        }).join("") + "</ul>"
      : '<p class="oyun-not">Henüz hiçbir evrene ya da hikâyeye götürülmedi. İlk götüren sen ol: “Başka evrene götür”.</p>') +
    '<button class="dugme dugme-sade" data-konuk-harita="">Kapat</button></div>';
}

/* ==================== evren ziyaretçi defteri ==================== */

/** Sunucudaki defter anahtarı: kanon evrenin kimliği, fanmade evrende "fan-" önekli kimlik. */
function evrenDefterAnahtari() {
  if (!EVS) { return ""; }
  if (EVS.kaynak === "site") { return EVS.id; }
  if (EVS.kaynak === "e99") { return "e99"; }
  if (EVS.kaynak === "fan") { return ("fan-" + EVS.id).slice(0, 60); }
  return "";
}

let defterDurum = { anahtar: "", liste: null, hata: "", mesaj: "" };

function evrenDefterBolumu() {
  const a = evrenDefterAnahtari();
  if (!a) { return '<p class="oyun-not">Ziyaretçi defteri yalnızca sitedeki evrenlerde açık.</p>'; }
  if (defterDurum.anahtar !== a) { defterDurum = { anahtar: a, liste: null, hata: "", mesaj: "" }; setTimeout(evrenDefterYukle, 0); }
  const girisli = typeof hesapKullanici !== "undefined" && !!hesapKullanici;
  const l = defterDurum.liste;
  return '<div class="evren-defter">' +
    '<p class="oyun-not">Bu evrene uğrayanların notları. Yazdığın not yazar onaylayınca herkese görünür; o zamana kadar yalnızca sen görürsün.</p>' +
    (typeof hesapEtkin === "function" && hesapEtkin()
      ? (girisli
        ? '<div class="kutu-y"><label for="defterNot">Notun (en fazla 280 harf)</label>' +
            '<textarea class="kod-giris arac-giris" id="defterNot" rows="3" maxlength="280" placeholder="Buraya uğradım, en çok … aklımda kaldı."></textarea>' +
            '<div class="oyun-sira"><button class="dugme" data-defter-yaz>Not bırak</button></div>' +
            '<p class="pencere-durum' + (defterDurum.mesaj ? " iyi" : "") + '" id="defterDurum" role="status">' + kacir(defterDurum.mesaj) + "</p></div>"
        : '<div class="kutu-y"><p class="oyun-not">Not bırakmak için giriş yap.</p><button class="dugme dugme-sade" data-hesap-pencere="giris">Giriş yap</button></div>')
      : "") +
    (defterDurum.hata ? '<p class="oyun-not">' + kacir(defterDurum.hata) + "</p>" : "") +
    (l === null ? '<p class="oyun-not">Yükleniyor…</p>'
      : (l.length ? '<ul class="defter-notlar">' + l.map(function (n) {
          return '<li class="' + (n.bekliyor ? "bekliyor" : "") + '"><p>' + kacir(n.metin) + "</p>" +
            '<div class="oyun-not">' + kacir(n.gorunen_ad || n.kullanici_adi || "") + " · " + kacir(new Date(n.zaman).toLocaleDateString("tr-TR")) +
              (n.bekliyor ? " · onay bekliyor" : "") +
              (n.benim ? ' · <button class="ic-bag" data-defter-sil="' + kacir(n.id) + '">sil</button>' : "") + "</div></li>";
        }).join("") + "</ul>"
        : '<p class="oyun-not">Henüz not yok. İlk notu sen bırak.</p>')) +
    "</div>";
}

async function evrenDefterYukle() {
  const a = defterDurum.anahtar;
  if (!a) { return; }
  if (typeof hesapEtkin !== "function" || !hesapEtkin()) { defterDurum.liste = []; defterDurum.hata = "Defter hesaplar açılınca başlayacak."; evrenDefterTazele(); return; }
  try { if (typeof hesapGerekli === "function") { await hesapGerekli(); } } catch (_) { /* aşağıda */ }
  if (typeof hesapIstemci === "undefined" || !hesapIstemci) { defterDurum.liste = []; defterDurum.hata = "Şu an ulaşılamıyor."; evrenDefterTazele(); return; }
  const { data, error } = await hesapIstemci.rpc("evren_defter_oku", { p_evren: a });
  if (defterDurum.anahtar !== a) { return; }
  defterDurum.liste = error ? [] : (Array.isArray(data) ? data : []);
  defterDurum.hata = error ? "Defter şu an açılamadı." : "";
  evrenDefterTazele();
}

function evrenDefterTazele() {
  if (EVS && EVS.sekme === "defter" && document.querySelector("#evrenSayfa .evren-defter")) { evrenSayfaCiz(); }
}

async function evrenDefterYaz() {
  const g = document.querySelector("#defterNot");
  const d = document.querySelector("#defterDurum");
  const metin = g ? g.value.trim() : "";
  const yaz = function (m) { if (d) { d.textContent = m; d.className = "pencere-durum kotu"; } };
  if (metin.length < 2) { yaz("Birkaç kelime yaz."); return; }
  const { data, error } = await hesapIstemci.rpc("evren_defter_yaz", { p_evren: defterDurum.anahtar, p_metin: metin });
  if (error) { yaz(typeof hesapHataMetni === "function" ? hesapHataMetni(error) : "Yazılamadı."); return; }
  const durum = data && data.durum;
  if (durum !== "tamam") {
    yaz(({ profil: "Önce profilinde bir kullanıcı adı seç.", sinir: "Bugünlük not hakkın doldu (5).", uzunluk: "Not 2–280 harf olmalı.", giris: "Önce giriş yap." })[durum] || "Yazılamadı.");
    return;
  }
  defterDurum.mesaj = "Notun alındı; yazar onaylayınca herkes görecek.";
  defterDurum.liste = null;
  evrenSayfaCiz();
  evrenDefterYukle();
}

/* evren sayfasına "Defter" sekmesi (kilitli evrende sekmeler zaten görünmez) */
if (typeof evrenEkSekmeler === "function") {
  const eskiSekmeler = evrenEkSekmeler;
  window.evrenEkSekmeler = function (v) {
    const l = eskiSekmeler.apply(this, arguments);
    if (evrenDefterAnahtari()) { l.push(["defter", "Ziyaretçi defteri"]); }
    return l;
  };
  const eskiBolum = evrenEkBolum;
  window.evrenEkBolum = function (v) {
    if (EVS && EVS.sekme === "defter") { return evrenDefterBolumu(); }
    return eskiBolum.apply(this, arguments);
  };
}

/* ==================== panel: bu hafta ==================== */

async function haftaOzetiCiz() {
  const alan = document.querySelector("#yIstAlan");
  if (!alan || typeof hesapIstemci === "undefined" || !hesapIstemci) { return; }
  let kutu = document.querySelector("#yHaftaAlan");
  if (!kutu) { kutu = document.createElement("div"); kutu.id = "yHaftaAlan"; kutu.className = "hafta-ozet"; alan.insertBefore(kutu, alan.firstChild); }
  const [o, s, b] = await Promise.all([
    hesapIstemci.rpc("hafta_ozeti"),
    hesapIstemci.rpc("olay_sayilari", { p_gun: 7 }),
    hesapIstemci.rpc("evren_defter_bekleyenler")
  ]);
  if (o.error) { kutu.innerHTML = '<p class="oyun-not">“Bu hafta” özeti için Kurulum sekmesinden kurulum.sql\'i yeniden çalıştır.</p>'; return; }
  const d = o.data || {};
  let giris = 0, ig = 0, kod = 0;
  (s.data || []).forEach(function (r) {
    const n = Number(r.sayi) || 0;
    if (String(r.ad).indexOf("giris:") === 0) { giris += n; }
    if (r.ad === "kaynak:instagram") { ig += n; }
    if (r.ad === "baslangic_kodu" || r.ad === "basla_kod") { kod += n; }
  });
  const oran = Number(d.gk_oynayan) ? Math.round(100 * Number(d.gk_bulan) / Number(d.gk_oynayan)) + "%" : "–";
  const fark = Number(d.kayit) - Number(d.kayit_onceki);
  const kart = function (ad, deger, not) {
    return '<div class="ist-kutu"><span class="ist-kutu-ad">' + kacir(ad) + '</span><span class="ist-kutu-deger">' + kacir(String(deger)) + "</span>" +
      (not ? '<span class="ist-kutu-not">' + kacir(not) + "</span>" : "") + "</div>";
  };
  const bekleyen = b.error ? [] : (Array.isArray(b.data) ? b.data : []);
  kutu.innerHTML = '<h4 class="olay-baslik">Bu hafta · son 7 gün</h4>' +
    '<div class="ist-kutular">' +
      kart("Ziyaret", istSayi(giris), (ig ? istSayi(ig) + " Instagram'dan · " : "") + istSayi(kod) + " kod girişi") +
      kart("Yeni hesap", istSayi(d.kayit), (fark >= 0 ? "+" : "") + fark + " geçen haftaya göre") +
      kart("Günün kelimesi", oran, istSayi(d.gk_bulan) + " / " + istSayi(d.gk_oynayan) + " oyun bulundu") +
      kart("Yarış oyunu", istSayi(d.yaris)) +
      kart("Bekleyen", istSayi(Number(d.defter_bekleyen) + Number(d.teori_bekleyen) + Number(d.soru_bekleyen)),
        istSayi(d.defter_bekleyen) + " defter notu · " + istSayi(d.teori_bekleyen) + " teori · " + istSayi(d.soru_bekleyen) + " soru") +
    "</div>" +
    (bekleyen.length ? '<div class="kutu-y y-defter"><div class="oyun-etiket">Onay bekleyen defter notları</div>' +
      bekleyen.map(function (n) {
        return '<div class="y-defter-not"><p>' + kacir(n.metin) + "</p>" +
          '<div class="oyun-not">' + kacir(n.kullanici_adi || "") + " · " + kacir(defterEvrenAdi(n.evren)) + " · " + kacir(new Date(n.zaman).toLocaleString("tr-TR")) + "</div>" +
          '<div class="oyun-sira"><button class="dugme" data-y-defter="' + kacir(n.id) + ':1">Onayla</button>' +
          '<button class="dugme dugme-sade y-sil" data-y-defter="' + kacir(n.id) + ':0">Reddet</button></div></div>';
      }).join("") + "</div>" : "") +
    '<p class="oyun-not">E99 ve fan katkıları e-postana dosya olarak gelir; onları Bakım → E99 ve Fan sekmesinden açarsın.</p>';
}

function defterEvrenAdi(a) {
  a = String(a || "");
  if (a.indexOf("fan-") === 0) {
    const e = fanSiteListesi("evren").find(function (x) { return x.id === a.slice(4); });
    return e ? e.ad + " (fan)" : a;
  }
  const k = (veri.kanonEvrenleri || {})[a];
  return k && k.ad ? k.ad : a.toUpperCase();
}

document.addEventListener("DOMContentLoaded", function () {
  if (typeof yoneticiIstatistikYukle === "function") {
    const eski = yoneticiIstatistikYukle;
    window.yoneticiIstatistikYukle = async function () {
      const r = await eski.apply(this, arguments);
      try { await haftaOzetiCiz(); } catch (_) { /* özet panelin kalanını bozmasın */ }
      return r;
    };
  }
});

/* ==================== olaylar ==================== */

document.addEventListener("click", async function (ev) {
  const h = ev.target.closest("[data-konuk-harita], [data-defter-yaz], [data-defter-sil], [data-y-defter]");
  if (!h) { return; }
  const d = h.dataset;
  if (d.konukHarita !== undefined) {
    konukHaritasiAcik = d.konukHarita || null;
    if (EVS && typeof evrenSayfaCiz === "function") { evrenSayfaCiz(); }
    return;
  }
  if (h.hasAttribute("data-defter-yaz")) { h.disabled = true; await evrenDefterYaz(); h.disabled = false; return; }
  if (d.defterSil) {
    await hesapIstemci.rpc("evren_defter_sil", { p_id: Number(d.defterSil) });
    defterDurum.liste = null; defterDurum.mesaj = "";
    evrenSayfaCiz();
    evrenDefterYukle();
    return;
  }
  if (d.yDefter) {
    const p = d.yDefter.split(":");
    h.disabled = true;
    const { error } = await hesapIstemci.rpc("evren_defter_karar", { p_id: Number(p[0]), p_onay: p[1] === "1" });
    if (error && typeof yoneticiDurum === "function") { yoneticiDurum(hesapHataMetni(error), false); }
    haftaOzetiCiz();
  }
});
