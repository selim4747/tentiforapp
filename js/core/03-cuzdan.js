/* Eçka cüzdanı — site genelinde tek para.
   Nöbet'te harcadığın gerçekten gider; satışlar geri doldurur.
   Diğer oyunlar mütevazı miktarda ekler. Kilitler buradan açılır. */

const CUZDAN_ANAHTAR = "tentiforapp_cuzdan";

let cuzdan = { ecka: null, acilan: [], kazanilan: 0, harcanan: 0, gun: "", gunluk: {} };

function cuzdanYukle() {
  const ham = kayitOku(CUZDAN_ANAHTAR);

  if (ham) {
    try {
      const d = JSON.parse(ham);
      if (d && typeof d.ecka === "number") { cuzdan = d; }
    } catch (e) { /* bozuk kayıt */ }
  }

  if (cuzdan.ecka === null) {
    cuzdan.ecka = (veri && veri.cuzdan ? veri.cuzdan.baslangic : 30);
  }

  if (!Array.isArray(cuzdan.acilan)) { cuzdan.acilan = []; }
  if (!cuzdan.gunluk) { cuzdan.gunluk = {}; }
  gunuTazele();
  istatistikHazirla();
  baslangicKendiliginden();   /* yeni gelen: başlangıç kodu kendiliğinden açılır (62-ilk-deneyim) */
}

function cuzdanKaydet() {
  kayitYaz(CUZDAN_ANAHTAR, JSON.stringify(cuzdan));
  cuzdanGoster();
}

function birim() {
  return veri && veri.cuzdan ? veri.cuzdan.birim : "eçka";
}

/** Kazanç ekler. Kaynak adı kayıt için. */
function gecmiseYaz(miktar, kaynak) {
  if (!Array.isArray(cuzdan.gecmis)) { cuzdan.gecmis = []; }
  cuzdan.gecmis.push({ m: miktar, k: kaynak || "—", t: bugununAdi() });
  if (cuzdan.gecmis.length > 60) { cuzdan.gecmis.shift(); }
}

function eckaKazan(miktar, kaynak) {
  const ilk = eckaYeniMi();
  if (miktar > 0) {
    yilGuncelle(function (y) { y.ecka += miktar; });   /* yılın özeti (39) */
    cuzdan.ecka += miktar;
    cuzdan.kazanilan += miktar;
    gecmiseYaz(miktar, kaynak);
    cuzdanKaydet();
    eckaBildir("+" + miktar + " " + birim() + (kaynak ? " · " + kaynak : ""));
  }
  eckaGostergesiAyarla();
  if (ilk && miktar > 0 && !eckaYeniMi()) { setTimeout(eckaIlkBalon, 600); }   /* ilk eçkan: ne işe yaradığını anlatan balon */
}

/** Harcama dener. Yetmezse false döner ve hiçbir şey değişmez. */
function eckaHarca(miktar, kaynak) {
  if (miktar > cuzdan.ecka) { return false; }
  cuzdan.ecka -= miktar;
  cuzdan.harcanan += miktar;
  gecmiseYaz(-miktar, kaynak || "harcama");
  cuzdanKaydet();
  return true;
}

function eckaVar(miktar) {
  return cuzdan.ecka >= miktar;
}

/* ---------- günlük tavan ----------
   Oyunlar sonsuz tekrarlanabiliyor. Tavan olmasa kilitler 15 dakikada açılırdı. */

function bugununAdi() {
  return new Date().toISOString().slice(0, 10);
}

function gunuTazele() {
  const bugun = bugununAdi();
  if (cuzdan.gun !== bugun) {
    cuzdan.gun = bugun;
    cuzdan.gunluk = {};
  }
}

function tavan(oyun) {
  const t = veri && veri.cuzdan ? veri.cuzdan.gunlukTavan : null;
  return t && t[oyun] ? t[oyun] : null;
}

function gunlukKalan(oyun) {
  const t = tavan(oyun);
  if (t === null) { return Infinity; }
  gunuTazele();
  const kalan = Math.max(0, t - (cuzdan.gunluk[oyun] || 0));
  /* bütün oyunların toplam tavanı: her oyunun tavanını tek tek doldurmak günde bütün kilitleri açmasın */
  const genel = veri && veri.cuzdan ? veri.cuzdan.genelTavan : 0;
  return genel ? Math.min(kalan, Math.max(0, genel - gunlukToplamKazanc())) : kalan;
}

/** Bugün tavanlı oyunlardan kazanılan toplam. */
function gunlukToplamKazanc() {
  gunuTazele();
  return Object.keys(cuzdan.gunluk).reduce(function (s, k) { return s + (tavan(k) !== null ? (cuzdan.gunluk[k] || 0) : 0); }, 0);
}

/** Tavana takılan kazanç. Verilen miktarın ne kadarı geçtiyse onu ekler. */
function gunlukKazan(oyun, miktar, kaynak) {
  const kalan = gunlukKalan(oyun);

  if (kalan <= 0) {
    eckaBildir("Bugünlük sınıra ulaştın — yarın sıfırlanır");
    return 0;
  }

  const verilen = Math.min(miktar, kalan);
  cuzdan.gunluk[oyun] = (cuzdan.gunluk[oyun] || 0) + verilen;
  eckaKazan(verilen, kaynak);
  istKaynak(oyun, verilen);
  return verilen;
}

/* ---------- yedekleme ----------
   localStorage silinirse her şey gider. Bu kod tüm ilerlemeyi taşır. */

function yedekUret() {
  const paket = { s: 1, c: cuzdan, k: cozulenler };
  const metin = JSON.stringify(paket);
  const bayt = new TextEncoder().encode(metin);
  let ikili = "";
  for (let i = 0; i < bayt.length; i++) { ikili += String.fromCharCode(bayt[i]); }
  return "TNTF1" + btoa(ikili).replace(/=+$/, "");
}

function yedekYukle(kod) {
  const temiz = String(kod).trim();
  if (temiz.indexOf("TNTF1") !== 0) { return "Bu bir yedek kodu değil."; }

  try {
    const ikili = atob(temiz.slice(5));
    const bayt = new Uint8Array(ikili.length);
    for (let i = 0; i < ikili.length; i++) { bayt[i] = ikili.charCodeAt(i); }
    const paket = JSON.parse(new TextDecoder("utf-8").decode(bayt));

    if (!paket || !paket.c) { return "Yedek bozuk."; }

    cuzdan = paket.c;
    cozulenler = paket.k || {};
    if (!Array.isArray(cuzdan.acilan)) { cuzdan.acilan = []; }
    if (!cuzdan.gunluk) { cuzdan.gunluk = {}; }

    cuzdanKaydet();
    acilanlariKaydet();
    return null;
  } catch (e) {
    return "Yedek okunamadı.";
  }
}

/* ---------- kilitler ---------- */
function kilitAcik(anahtar) {
  return cuzdan.acilan.indexOf(anahtar) !== -1;
}

/** Ödeyip kalıcı olarak açar. */
function kilitAc(anahtar, fiyat) {
  if (kilitAcik(anahtar)) { return true; }
  if (!eckaHarca(fiyat, "kilit")) { return false; }

  cuzdan.acilan.push(anahtar);
  cuzdanKaydet();
  return true;
}

/* ---------- gösterim ---------- */
function cuzdanGoster() {
  const el = document.querySelector("#cuzdanTutar");
  if (el) { el.textContent = cuzdan.ecka + " " + birim(); }
  eckaGostergesiAyarla();
}

let bildirimZaman = null;

function eckaBildir(metin) {
  let kutu = document.querySelector("#eckaBildirim");

  if (!kutu) {
    kutu = document.createElement("div");
    kutu.id = "eckaBildirim";
    kutu.className = "ecka-bildirim";
    kutu.setAttribute("role", "status");
    kutu.setAttribute("aria-live", "polite");
    document.body.appendChild(kutu);
  }

  kutu.textContent = metin;
  kutu.classList.add("gorunur");

  if (bildirimZaman) { clearTimeout(bildirimZaman); }
  bildirimZaman = setTimeout(function () { kutu.classList.remove("gorunur"); }, 2200);
}

/* ---------- oyun başarıları ve kod ödülleri ----------
   Bir oyun bitince en önemsiz katman (Kenar), hepsi bitince ikinci katman
   (Kimlik) açılır. Bu iki kodun istemci tarafında çözülmesi gerektiği için
   şifreleri gerçek koruma değil, gözden saklamadır. Ayrıntı OKUBENI'de. */

const OYUNLAR = ["nobet", "cevirmen", "vardiya", "boyut", "yazi", "baloncuk"];

function basariVar(oyun) {
  return cuzdan.acilan.indexOf("bitirdi_" + oyun) !== -1;
}

function bitirilenSayisi() {
  let n = 0;
  OYUNLAR.forEach(function (o) { if (basariVar(o)) { n++; } });
  return n;
}

function katmanAc(kod, ad) {
  const ozet = dogrulamaOzeti(kod);
  if (cozulenler[ozet]) { return false; }

  cozulenler[ozet] = kod;
  acilanlariKaydet();
  eckaBildir(ad + " katmanı çözüldü: " + kod);
  /* İlk Kâşif (30-yarislar) */
  (veri.katmanlar || []).forEach(function (k) { if (k.dogrulama === ozet) { kesifKaydet("katman:" + k.id); } });
  return true;
}

/** Bir oyun ilk kez bitirildiğinde çağrılır. */
function oyunBitti(oyun) {
  /* yılın özeti, ilk hafta görevleri, Nöbet'te görevlinin kartı (39) */
  yilGuncelle(function (y) { y.oyun[oyun] = (y.oyun[oyun] || 0) + 1; });
  ilkHaftaIsaretle("oyun");
  if (oyun === "nobet" && typeof O !== "undefined" && O && O.gorevli) { kartKazan(O.gorevli, "nobet"); }
  if (basariVar(oyun)) { return; }

  cuzdan.acilan.push("bitirdi_" + oyun);
  cuzdanKaydet();

  let acildi = false;

  if (veri.oduller && veri.oduller.birOyun) {
    acildi = katmanAc(sifreCoz(veri.oduller.birOyun, "odul:birOyun"), "Kenar") || acildi;
  }

  if (bitirilenSayisi() >= OYUNLAR.length && veri.oduller && veri.oduller.tumOyunlar) {
    acildi = katmanAc(sifreCoz(veri.oduller.tumOyunlar, "odul:tumOyunlar"), "Kimlik") || acildi;
  }

  if (acildi && typeof arsiviTazele === "function") { arsiviTazele(); }
}

/* ==================== İSTATİSTİK ====================
   Arşivci kartındaki rol ve kişilik buradan hesaplanır.
   Ne kadar oynadığın kadar, nasıl oynadığın da tutulur. */

function istatistikHazirla() {
  if (!cuzdan.ist) {
    cuzdan.ist = { kaynak: {}, kayit: 0, rastgele: 0, ipucu: 0, gunler: [], gorev: {} };
  }
  if (!cuzdan.ist.kaynak) { cuzdan.ist.kaynak = {}; }
  if (!Array.isArray(cuzdan.ist.gunler)) { cuzdan.ist.gunler = []; }
  if (!cuzdan.ist.gorev) { cuzdan.ist.gorev = {}; }

  const bugun = bugununAdi();
  if (cuzdan.ist.gunler.indexOf(bugun) === -1) {
    cuzdan.ist.gunler.push(bugun);
    if (cuzdan.ist.gunler.length > 400) { cuzdan.ist.gunler.shift(); }
  }
}

/** Sayaç artırır. */
function istArtir(alan, miktar) {
  istatistikHazirla();
  cuzdan.ist[alan] = (cuzdan.ist[alan] || 0) + (miktar || 1);
  cuzdanKaydet();

  /* Bu istatistikler arşivci kartındaki rol/kişilik hesabını besliyor ama
     kartın kendisi yalnızca sayfa ilk açıldığında bir kez çiziliyordu —
     oynadıkça değişen bir şey görünürde hiç güncellenmiyordu. */
  if (typeof arsivciCiz === "function") { arsivciCiz(); }
}

/** Kaynak bazlı kazanç kaydı. */
function istKaynak(oyun, miktar) {
  istatistikHazirla();
  cuzdan.ist.kaynak[oyun] = (cuzdan.ist.kaynak[oyun] || 0) + miktar;
  cuzdanKaydet();
}

/** Günlük görev ilerlemesi. */
function gorevIlerle(id, miktar) {
  istatistikHazirla();
  const bugun = bugununAdi();
  if (cuzdan.ist.gorevGun !== bugun) {
    cuzdan.ist.gorevGun = bugun;
    cuzdan.ist.gorev = {};
  }
  cuzdan.ist.gorev[id] = (cuzdan.ist.gorev[id] || 0) + (miktar || 1);
  cuzdanKaydet();

  /* Bu, oyunun içinden çağrılıyor (Nöbet'te gün geçince, Çevirmen'de doğru
     cevapta, vb.) — ama "günün görevi" widget'ı yalnızca sayfa ilk
     açıldığında bir kez çiziliyordu. Sonuç: kullanıcı görevi gerçekten
     tamamlıyor ama widget hâlâ "0/3" gösteriyordu, "çalışmıyor" gibi
     görünüyordu. Artık her ilerlemede kendini tazeliyor. */
  if (typeof gorevCiz === "function") { gorevCiz(); }
  if (typeof gunlukOzetCiz === "function") { gunlukOzetCiz(); }
  if (id === "yazi4") { ilkHaftaIsaretle("yazi"); }   /* ilk hafta, etkinlik görevleri (39) */
  etkinlikGorevKontrol();
}

function gorevDurum(id) {
  istatistikHazirla();
  if (cuzdan.ist.gorevGun !== bugununAdi()) { return 0; }
  return cuzdan.ist.gorev[id] || 0;
}
