/* Topluluk II: Kütüphane Defteri, Yazara sor, Kulüp duvarı, Okur bulmacaları, Davet.
   Hepsi hesap kütüphanesini yalnızca alan ekrana yaklaşınca yükler (hesapGorununce). */

function t2Hazir() { return typeof hesapIstemci !== "undefined" && !!hesapIstemci; }
function t2Girisli() { return t2Hazir() && typeof hesapKullanici !== "undefined" && !!hesapKullanici; }

/** Alanı kurar: kütüphane yoksa görününce yükler, sonra çizer. */
function t2Kur(alan, ciz) {
  if (!alan) { return false; }
  if (typeof hesapEtkin !== "function" || !hesapEtkin()) { alan.innerHTML = '<p class="oyun-not">Hesaplar açılınca başlayacak.</p>'; return false; }
  if (!t2Hazir()) {
    alan.innerHTML = '<p class="oyun-not">Yükleniyor…</p>';
    if (typeof hesapGorununce === "function") { hesapGorununce(alan, ciz); }
    return false;
  }
  return true;
}

function t2Durum(alan, m, iyi) {
  const d = alan && alan.querySelector("[data-t2-durum]");
  if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); }
}

function t2Kim(x) {
  return '<a href="#/u/' + encodeURIComponent(x.kullanici_adi) + '">@' + kacir(x.kullanici_adi) + "</a>";
}

function t2GirisDugmesi(ne) {
  return '<button class="dugme dugme-sade" data-hesap-pencere="giris">' + kacir(ne) + " için giriş yap</button>";
}

let t2YoneticiMi = null;
async function t2Yonetici() {
  if (!t2Girisli()) { return false; }
  if (t2YoneticiMi === null) { const r = await hesapIstemci.rpc("yonetici_mi"); t2YoneticiMi = r.data === true; }
  return t2YoneticiMi;
}

/* ==================== KÜTÜPHANE DEFTERİ ==================== */

const DEFTER_TOHUMLARI = [
  "Kütüphanenin kapısı o gece açık kalmıştı ve içeriden bir ses geliyordu.",
  "Buzun altında bir ışık yanıp söndü; üç kez, sonra hiç.",
  "Tarı rafın en üstündeki kitabı indirdiğinde, kitabın ona çoktan baktığını fark etti.",
  "Blero'ya o sabah hiç görülmemiş bir yolcu geldi.",
  "Egca'lar kasada kendi kendine yer değiştirmişti.",
  "Kimse Ilat günü kütüphaneye gelmezdi, ama biri geldi."
];

function defterHafta() {
  /* sunucuyla aynı: İstanbul saatine göre ISO haftası */
  const s = new Date(Date.now() + 3 * 3600000);
  const d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
  const gun = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - gun);
  const yilBas = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const hafta = Math.ceil(((d - yilBas) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + "-H" + String(hafta).padStart(2, "0");
}

async function ortakDefterCiz() {
  const alan = document.querySelector("#ortakDefterAlan");
  if (!t2Kur(alan, ortakDefterCiz)) { return; }
  const hafta = defterHafta();
  const { data, error } = await hesapIstemci.from("defter_listesi")
    .select("id, hafta, metin, zaman, kullanici_adi, oy, ben_oyladim, benim").order("zaman", { ascending: true }).limit(400);
  if (error) { alan.innerHTML = '<p class="oyun-not">' + kacir(hesapHataMetni(error)) + "</p>"; return; }
  const bu = (data || []).filter(function (x) { return x.hafta === hafta; });
  const eskiHaftalar = {};
  (data || []).filter(function (x) { return x.hafta !== hafta; }).forEach(function (x) { (eskiHaftalar[x.hafta] = eskiHaftalar[x.hafta] || []).push(x); });
  const no = Number(hafta.slice(-2)) || 1;
  const tohum = DEFTER_TOHUMLARI[no % DEFTER_TOHUMLARI.length];
  const cumle = function (x, oylanir) {
    return '<span class="defter-cumle' + (Number(x.oy) >= 3 ? " guclu" : "") + '">' + kacir(x.metin) + " " +
      '<span class="defter-kim">' + t2Kim(x) +
        (oylanir ? ' <button class="defter-oy' + (x.ben_oyladim ? " acik" : "") + '" data-defter-oy="' + x.id + '"' +
          (x.benim || !t2Girisli() ? " disabled" : "") + ' aria-label="Beğen">♥ ' + Number(x.oy) + "</button>" : "") +
        (x.benim && oylanir ? ' <button class="ic-bag" data-defter-sil="' + x.id + '">sil</button>' : "") +
        (!x.benim && t2Girisli() && oylanir ? ' <button class="ic-bag" data-defter-bildir="' + x.id + '">bildir</button>' : "") +
      "</span></span> ";
  };
  alan.innerHTML =
    '<p class="oyun-giris">Her hafta yeni bir sayfa. Herkes günde <b>bir cümle</b> ekler; cümleler beğenilir. ' +
      "Hafta bitince sayfa arşive geçer, üç ve üstü beğeni alan cümleler kalın yazılır.</p>" +
    '<div class="defter-sayfa"><span class="oyun-etiket">' + kacir(hafta.replace("-H", ". yılın ") + ". haftası") + "</span>" +
      '<p class="defter-metin"><span class="defter-cumle tohum">' + kacir(tohum) + "</span> " +
        bu.map(function (x) { return cumle(x, true); }).join("") + "</p></div>" +
    (t2Girisli()
      ? '<form class="t2-form" data-defter-form><textarea class="kod-giris" maxlength="220" rows="2" placeholder="Hikâyeye bugünkü cümleni ekle (10–220 karakter)"></textarea>' +
        '<button class="dugme" type="submit">Cümlemi ekle</button></form>'
      : t2GirisDugmesi("Cümle eklemek")) +
    '<p class="pencere-durum" data-t2-durum></p>' +
    (Object.keys(eskiHaftalar).length
      ? '<div class="defter-arsiv"><span class="oyun-etiket">Geçmiş sayfalar</span>' + Object.keys(eskiHaftalar).sort().reverse().slice(0, 8).map(function (h) {
          const n = Number(h.slice(-2)) || 1;
          return "<details><summary>" + kacir(h.replace("-H", ". yılın ") + ". haftası") + " · " + eskiHaftalar[h].length + " cümle</summary>" +
            '<p class="defter-metin"><span class="defter-cumle tohum">' + kacir(DEFTER_TOHUMLARI[n % DEFTER_TOHUMLARI.length]) + "</span> " +
            eskiHaftalar[h].map(function (x) { return cumle(x, false); }).join("") + "</p></details>";
        }).join("") + "</div>"
      : "");
}

/* ==================== YAZARA SOR ==================== */

async function yazaraSorCiz() {
  const alan = document.querySelector("#yazaraSorAlan");
  if (!t2Kur(alan, yazaraSorCiz)) { return; }
  const [{ data, error }, yon] = await Promise.all([
    hesapIstemci.from("yazara_sorular").select("id, metin, zaman, cevap, cevap_zaman, kullanici_adi, oy, ben_oyladim, benim").limit(200),
    t2Yonetici()
  ]);
  if (error) { alan.innerHTML = '<p class="oyun-not">' + kacir(hesapHataMetni(error)) + "</p>"; return; }
  const liste = (data || []).map(function (x) { x.oy = Number(x.oy) || 0; return x; });
  const cevapli = liste.filter(function (x) { return x.cevap; }).sort(function (a, b) { return new Date(b.cevap_zaman) - new Date(a.cevap_zaman); });
  const bekleyen = liste.filter(function (x) { return !x.cevap; }).sort(function (a, b) { return b.oy - a.oy || new Date(b.zaman) - new Date(a.zaman); });
  const soru = function (x) {
    return '<div class="yazar-soru' + (x.cevap ? " cevapli" : "") + '">' +
      '<p class="yazar-soru-metin">' + kacir(x.metin) + "</p>" +
      '<div class="teori-alt">' + t2Kim(x) +
        (!x.cevap ? ' <button class="teori-begen' + (x.ben_oyladim ? " acik" : "") + '" data-soru-oy="' + x.id + '"' +
          (x.benim || !t2Girisli() ? " disabled" : "") + ">▲ " + x.oy + "</button>" : "") +
        (x.benim && !x.cevap ? ' <button class="ic-bag" data-soru-sil="' + x.id + '">sil</button>' : "") +
      "</div>" +
      (x.cevap ? '<div class="yazar-cevap"><span class="oyun-etiket">Yazarın cevabı</span>' + paragraf(x.cevap) + "</div>" : "") +
      (yon ? '<details class="yazar-cevapla"><summary>' + (x.cevap ? "Cevabı düzenle" : "Cevapla") + "</summary>" +
        '<textarea class="kod-giris" rows="3" data-cevap-metin="' + x.id + '">' + kacir(x.cevap || "") + "</textarea>" +
        '<button class="dugme dugme-sade" data-soru-cevapla="' + x.id + '">Kaydet</button> ' +
        '<button class="dugme dugme-sade y-sil" data-soru-gizle="' + x.id + '">Gizle</button></details>' : "") +
    "</div>";
  };
  alan.innerHTML =
    '<p class="oyun-giris">Evrene, karakterlere ya da yazım sürecine dair sorunu sor. En çok oy alan sorular öne çıkar; ' +
      "yazar cevapladığında cevap burada kalır ve soran rozet ile XP alır.</p>" +
    (t2Girisli()
      ? '<form class="t2-form" data-soru-form><textarea class="kod-giris" maxlength="300" rows="2" placeholder="Sorun (10–300 karakter, günde 3)"></textarea>' +
        '<button class="dugme" type="submit">Sor</button></form>'
      : t2GirisDugmesi("Soru sormak")) +
    '<p class="pencere-durum" data-t2-durum></p>' +
    (cevapli.length ? '<span class="oyun-etiket">Cevaplananlar</span>' + cevapli.map(soru).join("") : "") +
    '<span class="oyun-etiket">Sırada bekleyenler</span>' +
    (bekleyen.length ? bekleyen.map(soru).join("") : '<p class="oyun-not">Bekleyen soru yok.</p>');
}

/* ==================== KULÜP DUVARI ==================== */

let kulupSecili = null;
let kulupElleSecildi = false;   /* elle seçilmediyse hep kendi (güncel) kulübünü göster */

/* Kulüp, arşivci kişiliğinin adıdır (liderlik eşitlemesi istatistikler.kisilik'e adı yazar). */
function kulupAdi(ad) { return ad; }

async function kulupCiz() {
  const alan = document.querySelector("#kulupAlan");
  if (!t2Kur(alan, kulupCiz)) { return; }
  let benim = null;
  if (t2Girisli()) {
    const r = await hesapIstemci.from("istatistikler").select("kisilik").eq("id", hesapKullanici.id).maybeSingle();
    benim = r.data && r.data.kisilik;
  }
  const kulupler = ((veri && veri.kisilikler) || []).map(function (x) { return x.ad; });
  if (!kulupElleSecildi || !kulupSecili) { kulupSecili = benim || kulupSecili || kulupler[0]; }
  const [m, h] = await Promise.all([
    hesapIstemci.from("kulup_duvari").select("id, metin, zaman, kullanici_adi, benim").eq("kisilik", kulupSecili)
      .order("zaman", { ascending: false }).limit(50),
    hesapIstemci.from("kulup_haftasi").select("kisilik, yaris, hedef")
  ]);
  const hafta = {};
  (h.data || []).forEach(function (x) { hafta[x.kisilik] = x; });
  const hs = hafta[kulupSecili] || { yaris: 0, hedef: 60 };
  const oran = Math.min(100, Math.round(100 * Number(hs.yaris) / Math.max(1, Number(hs.hedef))));
  alan.innerHTML =
    '<p class="oyun-giris">Sitede nasıl vakit geçirdiğin seni bir kulübe koyar (arşivci kartındaki kişiliğin). Kulübünün duvarına yazabilir, öbür kulüplerinkini okuyabilirsin.' +
      (benim ? " Senin kulübün: <b>" + kacir(kulupAdi(benim)) + "</b>." : " Kulübün, biraz oynayıp okuduktan sonra hesabın eşitlenince belirir.") + "</p>" +
    '<div class="filtre kulup-secici">' + kulupler.map(function (k) {
      return '<button class="filtre-btn' + (k === kulupSecili ? " secili" : "") + '" data-kulup="' + kacir(k) + '">' + kacir(kulupAdi(k)) +
        (k === benim ? " ★" : "") + "</button>";
    }).join("") + "</div>" +
    '<div class="kutu-y kulup-hedef"><span class="oyun-etiket">Bu haftanın kulüp hedefi</span>' +
      "<p>Üyeler birlikte <b>" + Number(hs.hedef) + " yarış</b> oynasın: şu an <b>" + Number(hs.yaris) + "</b>" +
      (oran >= 100 ? " — hedef tamam! ✓" : "") + "</p>" +
      '<span class="lider-cubuk"><i style="width:' + oran + '%"></i></span></div>' +
    (benim === kulupSecili
      ? '<form class="t2-form" data-kulup-form><input class="kod-giris arac-giris" maxlength="200" placeholder="Kulübüne bir şey yaz"><button class="dugme" type="submit">Yaz</button></form>'
      : (t2Girisli() ? "" : t2GirisDugmesi("Kulübüne yazmak"))) +
    '<p class="pencere-durum" data-t2-durum></p>' +
    '<div class="kulup-duvar">' + ((m.data || []).length ? m.data.map(function (x) {
      return '<div class="kenar-not"><p>' + kacir(x.metin) + '</p><span class="oyun-not">' + t2Kim(x) + " · " +
        new Date(x.zaman).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) +
        (x.benim ? ' · <button class="ic-bag" data-kulup-sil="' + x.id + '">sil</button>'
                 : (t2Girisli() ? ' · <button class="ic-bag" data-kulup-bildir="' + x.id + '">bildir</button>' : "")) + "</span></div>";
    }).join("") : '<p class="oyun-not">Duvar boş.</p>') + "</div>";
}

/* ==================== OKUR BULMACALARI ==================== */

async function okurBulmacaCiz() {
  const alan = document.querySelector("#okurBulmacaAlan");
  if (!t2Kur(alan, okurBulmacaCiz)) { return; }
  const { data, error } = await hesapIstemci.from("okur_bulmaca_listesi")
    .select("id, tur, soru, ipucu, zaman, kullanici_adi, cozen, cozdum, benim").order("zaman", { ascending: false }).limit(40);
  if (error) { alan.innerHTML = '<p class="oyun-not">' + kacir(hesapHataMetni(error)) + "</p>"; return; }
  alan.innerHTML =
    '<p class="oyun-giris">Okurların yazdığı bulmacalar. <b>Kyldo</b> bulmacasında Kyldo yazısıyla yazılmış kelimeyi oku; ' +
      "<b>isim</b> bulmacasında Tentiforverse adının hangi Türkçe kelimeden geldiğini bul. Çözene 5 XP, yazana her çözüm için 2 XP.</p>" +
    (t2Girisli()
      ? '<details class="kutu-y"><summary>Bulmaca yaz</summary><form class="t2-form" data-ob-form>' +
          '<label class="so-secenek"><input type="radio" name="obTur" value="kyldo" checked> Kyldo yazısı</label>' +
          '<label class="so-secenek"><input type="radio" name="obTur" value="isim"> İsim sistemi</label>' +
          '<input class="kod-giris arac-giris" id="obCevap" maxlength="20" placeholder="cevap: tek Türkçe kelime" autocomplete="off">' +
          '<input class="kod-giris arac-giris" id="obIpucu" maxlength="120" placeholder="ipucu (isteğe bağlı)">' +
          '<button class="dugme" type="submit">Yayınla</button></form></details>'
      : t2GirisDugmesi("Bulmaca yazmak ve çözmek")) +
    '<p class="pencere-durum" data-t2-durum></p>' +
    '<div class="ob-liste">' + ((data || []).length ? data.map(function (b) {
      const soru = b.tur === "kyldo" && typeof kyldoYaz === "function"
        ? '<div class="kp-kyldo">' + kyldoYaz(b.soru.toLocaleLowerCase("tr"), 30) + "</div>"
        : '<p class="ob-isim">' + kacir(b.soru) + "</p>";
      return '<div class="kutu-y ob-kart"><span class="oyun-etiket">' + (b.tur === "kyldo" ? "Kyldo" : "İsim") + " · " + t2Kim(b) +
          " · " + Number(b.cozen) + " çözen</span>" + soru +
        (b.ipucu ? '<p class="oyun-not">İpucu: ' + kacir(b.ipucu) + "</p>" : "") +
        (b.cozdum ? '<p class="oyun-not">✓ Çözdün</p>'
          : b.benim ? '<p class="oyun-not">Senin bulmacan · <button class="ic-bag" data-ob-sil="' + b.id + '">sil</button></p>'
          : t2Girisli() ? '<form class="t2-form ob-coz" data-ob-coz="' + b.id + '"><input class="kod-giris arac-giris" maxlength="30" placeholder="cevabın" autocomplete="off"><button class="dugme dugme-sade" type="submit">Dene</button></form>'
          : "") + "</div>";
    }).join("") : '<p class="oyun-not">Henüz bulmaca yok. İlkini sen yaz.</p>') + "</div>";
}

/* ==================== DAVET ==================== */

const DAVET_ANAHTAR = "tentiforapp_davet";

(function () {
  const q = new URLSearchParams(location.search);
  const d = q.get("davet");
  if (!d) { return; }
  try { localStorage.setItem(DAVET_ANAHTAR, d.toLowerCase().slice(0, 20)); } catch (e) { /* yok */ }
  q.delete("davet");
  try { history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q.toString() : "") + location.hash); } catch (e) { /* yok */ }
})();

async function davetKaydetDene() {
  let ad = null;
  try { ad = localStorage.getItem(DAVET_ANAHTAR); } catch (e) { ad = null; }
  if (!ad || !t2Girisli()) { return; }
  const { data } = await hesapIstemci.rpc("davet_kaydet", { p_ad: ad });
  if (data && data.durum !== "giris") { try { localStorage.removeItem(DAVET_ANAHTAR); } catch (e) { /* yok */ } }
  if (data && data.durum === "tamam" && typeof hesapBildir === "function") { hesapBildir("@" + ad + " seni davet etti. İlk haftanı tamamlayınca ikiniz de rozet kazanacaksınız."); }
}

async function davetKutusuCiz() {
  const el = document.querySelector("#hesapTopluluk");
  if (!el || !t2Girisli() || typeof hesapProfil === "undefined" || !hesapProfil || !hesapProfil.kullanici_adi) { return; }
  const { data } = await hesapIstemci.rpc("davet_durumum");
  if (!data) { return; }
  const adres = (location.protocol === "https:" ? location.origin + "/" : location.href.split(/[?#]/)[0]) + "?davet=" + encodeURIComponent(hesapProfil.kullanici_adi);
  let kutu = el.querySelector(".davet-kutu");
  if (!kutu) { kutu = document.createElement("div"); kutu.className = "hesap-kutu davet-kutu"; el.appendChild(kutu); }
  kutu.innerHTML = '<span class="oyun-etiket">Davet ve rehberlik</span>' +
    "<p>Bu bağlantıyla gelen biri ilk haftasında 3 gün uğrarsa sen <b>Rehber</b>, o <b>Çırak</b> rozeti alır (sen +50, o +30 XP).</p>" +
    '<input class="kod-giris arac-giris" readonly value="' + kacir(adres) + '"> <button class="dugme dugme-sade" data-davet-kopyala="' + kacir(adres) + '">Kopyala</button>' +
    '<p class="oyun-not">Davet ettiğin: <b>' + Number(data.davet_ettigim) + "</b> · ilk haftasını tamamlayan: <b>" + Number(data.tamamlayan) + "</b>" +
      (data.davet_eden ? " · seni davet eden: @" + kacir(data.davet_eden) + (data.benim_haftam ? " (Çırak ✓)" : " (ilk haftan sürüyor)") : "") + "</p>";
  if (Number(data.tamamlayan) > 0 && typeof madalyaVer === "function") { madalyaVer("rehber"); }
  if (data.benim_haftam && typeof madalyaVer === "function") { madalyaVer("cirak"); }
}

/* ==================== bağlar ==================== */

document.addEventListener("DOMContentLoaded", function () {
  /* hesapta davet kutusu; girişte davet kaydı */
  if (typeof toplulukHesapEk === "function") {
    const eskiH = toplulukHesapEk;
    window.toplulukHesapEk = async function () { await eskiH.apply(this, arguments); davetKaydetDene(); davetKutusuCiz(); };
  }
  /* profilde rehberlik rozeti */
  if (typeof toplulukProfilEk === "function") {
    const eskiP = toplulukProfilEk;
    window.toplulukProfilEk = async function (p) {
      await eskiP.apply(this, arguments);
      const el = document.querySelector("#profilTopluluk .profil-topluluk");
      if (!el || !t2Hazir() || !p || !p.kullanici_adi) { return; }
      const { data } = await hesapIstemci.from("rehber_sayilari").select("rehber").eq("kullanici_adi", p.kullanici_adi).maybeSingle();
      if (data && Number(data.rehber)) {
        const s = document.createElement("div");
        s.className = "hesap-madalya";
        s.innerHTML = "<span>☍ " + Number(data.rehber) + " kişiye rehberlik etti</span>";
        el.appendChild(s);
      }
    };
  }
});

document.addEventListener("submit", async function (e) {
  const f = e.target.closest("[data-defter-form], [data-soru-form], [data-kulup-form], [data-ob-form], [data-ob-coz]");
  if (!f) { return; }
  e.preventDefault();
  const alan = f.closest(".bolum");
  const deger = ((f.querySelector("textarea, input:not([type=radio])") || {}).value || "").trim();
  const mesaj = function (d, sozluk) { return sozluk[d && d.durum] || "Olmadı."; };
  if (f.matches("[data-defter-form]")) {
    const { data, error } = await hesapIstemci.rpc("defter_yaz", { p_metin: deger });
    if (error) { t2Durum(alan, hesapHataMetni(error)); return; }
    if (data.durum !== "tamam") { t2Durum(alan, mesaj(data, { bugun: "Bugünkü cümleni yazdın; yarın yine gel.", kisa: "En az 10 karakter.", engelli: "Hesabın kısıtlı." })); return; }
    ortakDefterCiz();
  } else if (f.matches("[data-soru-form]")) {
    const { data, error } = await hesapIstemci.rpc("yazara_sor", { p_metin: deger });
    if (error) { t2Durum(alan, hesapHataMetni(error)); return; }
    if (data.durum !== "tamam") { t2Durum(alan, mesaj(data, { sinir: "Günde 3 soru.", kisa: "En az 10 karakter.", engelli: "Hesabın kısıtlı." })); return; }
    yazaraSorCiz();
  } else if (f.matches("[data-kulup-form]")) {
    const { data, error } = await hesapIstemci.rpc("kulup_yaz", { p_metin: deger });
    if (error) { t2Durum(alan, hesapHataMetni(error)); return; }
    if (data.durum !== "tamam") { t2Durum(alan, mesaj(data, { kulupsuz: "Henüz bir kulübün yok: biraz oyna, oku; hesabın eşitlenince belirir.", sinir: "Bugünlük yeter (20 mesaj).", kisa: "Biraz daha yaz." })); return; }
    kulupCiz();
  } else if (f.matches("[data-ob-form]")) {
    const tur = (f.querySelector('input[name="obTur"]:checked') || {}).value || "kyldo";
    const { data, error } = await hesapIstemci.rpc("okur_bulmaca_yaz", { p_tur: tur, p_cevap: (f.querySelector("#obCevap") || {}).value || "", p_ipucu: (f.querySelector("#obIpucu") || {}).value || "" });
    if (error) { t2Durum(alan, hesapHataMetni(error)); return; }
    if (data.durum !== "tamam") { t2Durum(alan, mesaj(data, { kelime: "Cevap tek bir Türkçe kelime olmalı (2–20 harf).", sinir: "Günde 5 bulmaca." })); return; }
    okurBulmacaCiz();
  } else if (f.matches("[data-ob-coz]")) {
    const { data, error } = await hesapIstemci.rpc("okur_bulmaca_coz", { p_bulmaca: Number(f.dataset.obCoz), p_cevap: deger });
    if (error) { t2Durum(alan, hesapHataMetni(error)); return; }
    if (data.durum === "tamam") { t2Durum(alan, "Doğru! +5 XP", true); okurBulmacaCiz(); return; }
    t2Durum(alan, mesaj(data, { yanlis: "Olmadı, bir daha dene.", sinir: "Bir saatte 60 deneme hakkın doldu.", zaten: "Bunu zaten çözdün." }));
  }
});

document.addEventListener("click", async function (e) {
  const hedef = e.target.closest("[data-defter-oy], [data-defter-sil], [data-defter-bildir], [data-soru-oy], [data-soru-sil], [data-soru-cevapla], [data-soru-gizle], [data-kulup], [data-kulup-sil], [data-kulup-bildir], [data-ob-sil], [data-davet-kopyala]");
  if (!hedef) { return; }
  const d = hedef.dataset;
  if (d.davetKopyala) {
    if (navigator.share) { navigator.share({ title: "TentiforApp", url: d.davetKopyala }).catch(function () {}); }
    else if (typeof panoyaKopyala === "function") { panoyaKopyala(d.davetKopyala).then(function () { hedef.textContent = "Kopyalandı"; }); }
    return;
  }
  if (d.kulup) { kulupSecili = d.kulup; kulupElleSecildi = true; kulupCiz(); return; }
  if (!t2Hazir()) { return; }
  if (d.defterOy) { await hesapIstemci.rpc("defter_oyla", { p_cumle: Number(d.defterOy) }); ortakDefterCiz(); }
  else if (d.defterSil) { await hesapIstemci.rpc("defter_sil", { p_cumle: Number(d.defterSil) }); ortakDefterCiz(); }
  else if (d.defterBildir) { await hesapIstemci.rpc("defter_bildir", { p_cumle: Number(d.defterBildir) }); hedef.replaceWith(document.createTextNode("bildirildi")); }
  else if (d.soruOy) { await hesapIstemci.rpc("yazar_soru_oyla", { p_soru: Number(d.soruOy) }); yazaraSorCiz(); }
  else if (d.soruSil) { await hesapIstemci.rpc("yazar_soru_sil", { p_soru: Number(d.soruSil) }); yazaraSorCiz(); }
  else if (d.soruCevapla || d.soruGizle) {
    const id = Number(d.soruCevapla || d.soruGizle);
    const metin = ((document.querySelector('[data-cevap-metin="' + id + '"]') || {}).value || "");
    await hesapIstemci.rpc("yazar_cevapla", { p_soru: id, p_cevap: d.soruGizle ? "" : metin, p_gizle: !!d.soruGizle });
    yazaraSorCiz();
  }
  else if (d.kulupSil) { await hesapIstemci.rpc("kulup_sil", { p_mesaj: Number(d.kulupSil) }); kulupCiz(); }
  else if (d.kulupBildir) { await hesapIstemci.rpc("kulup_bildir", { p_mesaj: Number(d.kulupBildir) }); hedef.replaceWith(document.createTextNode("bildirildi")); }
  else if (d.obSil) { await hesapIstemci.rpc("okur_bulmaca_sil", { p_bulmaca: Number(d.obSil) }); okurBulmacaCiz(); }
});

/* Canlı veri gösteren bölümler: adresle gidildiğinde (#/kulup gibi) tazelenir; ilk çizim geç çizimde kalır. */
const T2_BOLUMLER = { ortakDefter: "ortakDefterCiz", yazaraSor: "yazaraSorCiz", kulup: "kulupCiz", okurBulmaca: "okurBulmacaCiz", av: "avCiz" };
window.addEventListener("hashchange", function () {
  const ad = location.hash.replace(/^#\/?/, "").split("/")[0];
  const f = T2_BOLUMLER[ad];
  if (f && typeof window[f] === "function" && t2Hazir()) { window[f](); }
});
