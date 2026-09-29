/* Dördüncü dalga — rol yolu, giriş serisi, eçka geçmişi, sezonluk kilit,
   günün bulmacası, mektuplar, günlükler, kayıtlar, baloncuk galerisi ve tur. */

/* ==================== ROL YOLU ==================== */

const ROL_GECMIS_ANAHTAR = "tentiforapp_rol_gecmis";

/** Bir rolün koşullarından hangileri eksik? */
function rolEksikleri(kosul) {
  const o = arsivciOlculeri();
  const eksik = [];

  if (kosul.oyun !== undefined && o.oyun < kosul.oyun) {
    eksik.push((kosul.oyun - o.oyun) + " oyun daha bitir");
  }
  if (kosul.katman !== undefined && o.katman < kosul.katman) {
    eksik.push((kosul.katman - o.katman) + " katman daha çöz");
  }
  if (kosul.galeri !== undefined && o.galeri < kosul.galeri) {
    eksik.push((kosul.galeri - o.galeri) + " galeri kaydı aç");
  }
  if (kosul.gun !== undefined && o.gun < kosul.gun) {
    eksik.push((kosul.gun - o.gun) + " gün daha uğra");
  }

  const adlar = { nobet: "Nöbet", cevirmen: "Gırı Çevirmeni", vardiya: "Gündüz Vardiyası",
                  boyut: "Boyut Sürüklenmesi", yazi: "Yazı Çözme", baloncuk: "Baloncuk Evren" };

  Object.keys(adlar).forEach(function (k) {
    if (kosul[k] === true && !o.bitirdi(k)) { eksik.push(adlar[k] + " bitir"); }
  });

  return eksik;
}

function rolGecmisiKaydet(rolId) {
  let g = [];
  try { g = JSON.parse(kayitOku(ROL_GECMIS_ANAHTAR) || "[]"); } catch (e) { g = []; }

  if (g.length && g[g.length - 1].rol === rolId) { return; }

  g.push({ rol: rolId, tarih: bugununAdi() });
  if (g.length > 20) { g.shift(); }
  kayitYaz(ROL_GECMIS_ANAHTAR, JSON.stringify(g));
}

function rolYoluCiz() {
  const alan = document.querySelector("#rolYoluAlan");
  if (!alan || !veri.roller) { return; }

  const simdiki = arsivciRol();
  rolGecmisiKaydet(simdiki.id);

  /* roller veride zordan kolaya sıralı; gösterirken tersine çeviriyoruz */
  const sirali = veri.roller.slice().reverse();
  const simdiIndeks = sirali.findIndex(function (r) { return r.id === simdiki.id; });

  let gecmis = [];
  try { gecmis = JSON.parse(kayitOku(ROL_GECMIS_ANAHTAR) || "[]"); } catch (e) { gecmis = []; }

  alan.innerHTML =
    '<ol class="rol-yol">' +
      sirali.map(function (r, i) {
        const gecildi = i < simdiIndeks;
        const aktif = i === simdiIndeks;
        const eksik = (gecildi || aktif) ? [] : rolEksikleri(r.kosul || {});

        return '<li class="rol-adim' + (gecildi ? " gecildi" : "") + (aktif ? " aktif" : "") + '">' +
                 '<span class="rol-nokta"></span>' +
                 '<div class="rol-govde">' +
                   '<span class="rol-ad">' + kacir(r.ad) + "</span>" +
                   '<span class="rol-not">' + kacir(r.not || "") + "</span>" +
                   (eksik.length
                     ? '<span class="rol-eksik">' + eksik.map(kacir).join(" · ") + "</span>"
                     : "") +
                 "</div>" +
               "</li>";
      }).join("") +
    "</ol>" +
    (gecmis.length > 1
      ? '<div class="arac-blok"><div class="oyun-etiket">Rol geçmişin</div>' +
        '<ul class="y-bosluk">' + gecmis.slice().reverse().map(function (g) {
          const r = veri.roller.find(function (x) { return x.id === g.rol; });
          return "<li><b>" + kacir(r ? r.ad : g.rol) + "</b> — " + kacir(g.tarih) + "</li>";
        }).join("") + "</ul></div>"
      : "");
}

/** Evrengezer olanlara Beyaz Taş teması indirimli. */
function temaIndirimi(temaId) {
  const rol = arsivciRol();
  if (temaId === "tas" && (rol.id === "evrengezer" || rol.id === "lebga")) { return 0.5; }
  if (temaId === "uclu" && rol.id === "melez") { return 0.8; }
  return 1;
}

/* ==================== GİRİŞ SERİSİ ==================== */

function seriHesapla() {
  istatistikHazirla();
  const gunler = (cuzdan.ist.gunler || []).slice().sort();
  if (!gunler.length) { return 0; }

  let seri = 1;
  for (let i = gunler.length - 1; i > 0; i--) {
    const a = new Date(gunler[i] + "T00:00:00Z");
    const b = new Date(gunler[i - 1] + "T00:00:00Z");
    if ((a - b) / 86400000 === 1) { seri++; } else { break; }
  }
  return seri;
}

function seriOdulAl() {
  const seri = seriHesapla();
  const anahtar = "seri_" + bugununAdi();
  if (kilitAcik(anahtar)) { return; }

  const odul = Math.min(40, 5 + seri * 3);
  cuzdan.acilan.push(anahtar);
  eckaKazan(odul, seri + " günlük seri");
  seriCiz();
}

function seriMadalyaKontrol() {
  if (seriHesapla() >= 7 && typeof madalyaVer === "function") { madalyaVer("yediGun"); }
}

function seriCiz() {
  seriMadalyaKontrol();
  const alan = document.querySelector("#seriAlan");
  if (!alan) { return; }

  const seri = seriHesapla();
  const alindi = kilitAcik("seri_" + bugununAdi());
  const odul = Math.min(40, 5 + seri * 3);

  alan.innerHTML =
    '<div class="seri">' +
      '<div class="seri-sayi">' + seri + "</div>" +
      '<div class="seri-alt">gün üst üste</div>' +
      '<div class="seri-noktalar">' +
        Array.from({ length: Math.min(14, Math.max(7, seri)) }).map(function (x, i) {
          return '<span class="seri-nokta' + (i < seri ? " dolu" : "") + '"></span>';
        }).join("") +
      "</div>" +
      (alindi
        ? '<div class="gunun-alindi">bugünkü seri ödülünü aldın</div>'
        : '<button class="dugme" data-seri="al">' + odul + " " + birim() + " al</button>") +
      '<p class="oyun-not">Bir gün atlarsan seri sıfırlanır.</p>' +
    "</div>";
}

/* ==================== EÇKA GEÇMİŞİ ==================== */

function gecmisCiz() {
  const alan = document.querySelector("#gecmisAlan");
  if (!alan) { return; }

  istatistikHazirla();
  const kayit = (cuzdan.gecmis || []).slice().reverse().slice(0, 25);

  alan.innerHTML =
    '<div class="bag-ozet">' +
      "<span>kazanılan <b>" + (cuzdan.kazanilan || 0) + "</b></span>" +
      "<span>harcanan <b>" + (cuzdan.harcanan || 0) + "</b></span>" +
      "<span>cüzdan <b>" + cuzdan.ecka + "</b></span>" +
    "</div>" +
    (kayit.length
      ? '<ul class="gecmis-liste">' + kayit.map(function (k) {
          return '<li class="' + (k.m > 0 ? "arti" : "eksi") + '">' +
                   "<span>" + (k.m > 0 ? "+" : "") + k.m + "</span>" +
                   "<span>" + kacir(k.k) + "</span>" +
                   '<span class="gecmis-tarih">' + kacir(k.t || "") + "</span>" +
                 "</li>";
        }).join("") + "</ul>"
      : '<p class="oyun-not">Henüz hareket yok.</p>');
}

/* ==================== SEZONLUK ==================== */

function sezonAktif(s) {
  const bugun = new Date();
  const ay = bugun.getMonth() + 1;
  const gun = bugun.getDate();
  const simdi = ay * 100 + gun;

  const ayir = function (m) {
    const p = m.split("-");
    return parseInt(p[0], 10) * 100 + parseInt(p[1], 10);
  };

  const bas = ayir(s.bas);
  const son = ayir(s.son);

  return bas <= son ? (simdi >= bas && simdi <= son) : (simdi >= bas || simdi <= son);
}

function sezonCiz() {
  const alan = document.querySelector("#sezonAlan");
  if (!alan || !veri.sezonluk) { return; }

  alan.innerHTML = '<div class="sezon-liste">' + veri.sezonluk.map(function (s) {
    const acik = sezonAktif(s);
    return '<div class="sezon' + (acik ? " acik" : "") + '">' +
             '<div class="sezon-ad">' + kacir(s.ad) + "</div>" +
             '<div class="sezon-tarih">' + kacir(s.bas) + " → " + kacir(s.son) + "</div>" +
             '<div class="sezon-metin">' +
               (acik ? kacir(s.metin) : "Bu dönem henüz gelmedi.") + "</div>" +
           "</div>";
  }).join("") + "</div>";
}

/* ==================== GÜNÜN BULMACASI ==================== */

function gununBulmacasi() {
  const liste = veri.bulmacalar || [];
  if (!liste.length) { return null; }
  return liste[gorevTohumu() % liste.length];
}

function bulmacaCevapla(giris) {
  const b = gununBulmacasi();
  if (!b) { return; }

  const durum = document.querySelector("#bulmacaDurum");
  const verilen = String(giris).trim().toLocaleLowerCase("tr");

  let dogru;
  if (b.tur === "isim") {
    const olasi = isimCoz(b.kelime).map(function (x) {
      return x.sonuc.toLocaleLowerCase("tr");
    });
    dogru = olasi.indexOf(verilen) !== -1;
  } else {
    dogru = verilen === String(b.cevap).toLocaleLowerCase("tr");
  }

  if (!dogru) {
    if (durum) { durum.textContent = "Olmadı. Yarın yeni bulmaca gelir."; durum.className = "pencere-durum kotu"; }
    return;
  }

  const anahtar = "bulmaca_" + bugununAdi();
  if (!kilitAcik(anahtar)) {
    cuzdan.acilan.push(anahtar);
    eckaKazan(25, "Günün bulmacası");
    /* hesap varsa çözüş saati sunucuya: günün bulmacası tablosu */
    if (typeof liderlikBulmacaCozuldu === "function") { liderlikBulmacaCozuldu(); }
  }

  bulmacaCiz();
  if (typeof gunlukOzetCiz === "function") { gunlukOzetCiz(); }
}

function bulmacaCiz() {
  const alan = document.querySelector("#bulmacaAlan");
  if (!alan) { return; }

  const b = gununBulmacasi();
  if (!b) { return; }

  const cozuldu = kilitAcik("bulmaca_" + bugununAdi());

  alan.innerHTML =
    '<div class="bulmaca">' +
      '<div class="gorev-etiket">günün bulmacası</div>' +
      '<div class="bulmaca-soru">' + kacir(b.soru) + "</div>" +
      (b.tur === "isim" ? '<div class="bulmaca-kelime">' + kacir(b.kelime) + "</div>" : "") +
      (cozuldu
        ? '<div class="gunun-alindi">bugünkü bulmacayı çözdün</div>'
        : '<input class="kod-giris arac-giris" id="bulmacaGiris" autocomplete="off" ' +
          'placeholder="cevabın">' +
          '<button class="dugme" data-bulmaca="1">Cevapla</button>' +
          '<p class="pencere-durum" id="bulmacaDurum"></p>') +
    "</div>";
}

/* ==================== MEKTUP, GÜNLÜK, KAYIT ==================== */

function mektupCiz() {
  const alan = document.querySelector("#mektupAlan");
  if (!alan || !veri.mektuplar) { return; }

  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();

  alan.innerHTML = '<div class="mektup-liste">' + veri.mektuplar.map(function (m) {
    const acik = yonetici || (katmanAcik(m.gizli) && spoilerUygun(m.gizli));

    if (!acik) {
      return '<div class="mektup kapali"><div class="mektup-ust">— buz altında —</div></div>';
    }

    return '<div class="mektup">' +
             '<div class="mektup-ust">' + kacir(m.kimden) + " → " + kacir(m.kime) + "</div>" +
             '<div class="mektup-not">' + kacir(m.not || "") + "</div>" +
             '<div class="mektup-metin okuma-metin">' + paragraf(m.metin) + "</div>" +
           "</div>";
  }).join("") + "</div>";
}

function gunlukCiz() {
  const alan = document.querySelector("#gunlukAlan");
  if (!alan || !veri.gunlukler) { return; }

  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();

  alan.innerHTML = '<div class="gunluk-liste">' + veri.gunlukler.map(function (g) {
    const acik = yonetici || (katmanAcik(g.gizli) && spoilerUygun(g.gizli));

    if (!acik) {
      return '<div class="gunluk kapali"><div class="gunluk-ust">— buz altında —</div></div>';
    }

    return '<div class="gunluk">' +
             '<div class="gunluk-ust"><b>' + kacir(g.kim) + "</b>" +
               '<span class="gunluk-tarih">' + kacir(g.tarih) + "</span></div>" +
             '<div class="okuma-metin">' + paragraf(g.metin) + "</div>" +
           "</div>";
  }).join("") + "</div>";
}

function kayitCiz() {
  const alan = document.querySelector("#kayitAlan");
  if (!alan || !veri.kayitlar) { return; }

  const yonetici = (typeof yoneticiAcik === "function") && yoneticiAcik();

  alan.innerHTML =
    '<p class="oyun-giris">L25 ara evrende mahsurken dışarıya mesaj gönderdi. ' +
    "Mesajlar Tömye Kütüphanesi'ne düştü ve kimse dinlemedi.</p>" +
    '<div class="kayit-liste">' + veri.kayitlar.map(function (k) {
      const acik = yonetici || (katmanAcik(k.gizli) && spoilerUygun(k.gizli));

      if (!acik) {
        return '<div class="kayit kapali"><span class="kayit-no">—</span>' +
               '<span class="kayit-metin">buz altında</span></div>';
      }

      return '<div class="kayit">' +
               '<span class="kayit-no">kayıt ' + k.no + "</span>" +
               '<span class="kayit-sure">' + kacir(k.sure) + "</span>" +
               '<div class="kayit-metin okuma-metin">' + paragraf(k.metin) + "</div>" +
             "</div>";
    }).join("") + "</div>";
}

/* ==================== BALONCUK GALERİSİ ==================== */

const EVREN_ANAHTAR = "tentiforapp_evrenler";

/** Kurulan evreni galeriye kaydeder ve kimliğini döner. Galeri 20'yi geçince en eski
    dokunulmamış evren silinir; içerik, kişi ya da ad eklenmiş evrenler silinmez. */
function evrenKaydet(kayit) {
  let liste = [];
  try { liste = JSON.parse(kayitOku(EVREN_ANAHTAR) || "[]"); } catch (e) { liste = []; }
  if (!Array.isArray(liste)) { liste = []; }

  if (!kayit.id) { kayit.id = evrenYeniKimlik("ev_"); }
  liste.push(kayit);

  const duzenlenmis = function (e) {
    return !!(e.ad || (e.icerik && e.icerik.length) || (e.kisiler && e.kisiler.length));
  };
  while (liste.length > 20) {
    const i = liste.slice(0, -1).findIndex(function (e) { return !duzenlenmis(e); });
    if (i === -1) { break; }
    liste.splice(i, 1);
  }
  if (liste.length > 60) { liste.shift(); }

  kayitYaz(EVREN_ANAHTAR, JSON.stringify(liste));
  return kayit.id;
}

/* ==================== EVREN DEFTERİ ====================
   Kurduğun her evrene istediğin içeriği ve kişiyi ekleyebilirsin: ad ver, yerleri,
   nesneleri, olayları yaz, kişilerini tanıt. Yönetici kilidi yok — her şey bu
   cihazda saklanır ve yalnızca senin kurduğun evrene bağlıdır. */

const ED_SINIR = { icerik: 40, kisi: 40 };
let edId = null;
let edDuzenle = null;                 /* { tur: "icerik"|"kisi", id } */
let edTaslak = { icB: "", icM: "", kiA: "", kiN: "" };
let edSilOnay = null;

function evrenYeniKimlik(onek) {
  return onek + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function evrenListesiOku() {
  let liste = [];
  try { liste = JSON.parse(kayitOku(EVREN_ANAHTAR) || "[]"); } catch (e) { liste = []; }
  if (!Array.isArray(liste)) { liste = []; }
  let degisti = false;
  liste.forEach(function (e) { if (!e.id) { e.id = evrenYeniKimlik("ev_"); degisti = true; } });
  if (degisti) { kayitYaz(EVREN_ANAHTAR, JSON.stringify(liste)); }
  return liste;
}

function evrenAdi(e) { return e.ad || (e.turAd ? e.turAd + " evren" : "Evren"); }

function evrenDefteriAc(id) {
  edId = id; edDuzenle = null; edSilOnay = null;
  edTaslak = { icB: "", icM: "", kiA: "", kiN: "" };
  evrenDefteriCiz();
  $("#perde").hidden = false;
}

function evrenDefteriCiz() {
  const liste = evrenListesiOku();
  const e = liste.find(function (x) { return x.id === edId; });
  if (!e) { perdeKapat(); return; }

  const icerik = e.icerik || [], kisiler = e.kisiler || [];
  const duzIc = edDuzenle && edDuzenle.tur === "icerik", duzKi = edDuzenle && edDuzenle.tur === "kisi";
  const arac = function (tur, id) {
    const sil = edSilOnay === tur + ":" + id;
    return '<div class="ed-oge-arac">' +
      '<button type="button" class="dugme dugme-sade y-kucuk" data-ed="' + tur + '-duzenle" data-id="' + kacir(id) + '">düzenle</button>' +
      '<button type="button" class="dugme dugme-sade y-kucuk y-sil" data-ed="' + tur + '-sil" data-id="' + kacir(id) + '">' + (sil ? "emin misin?" : "sil") + "</button></div>";
  };
  const kuralAdlari = (e.kurallar || []).map(function (id) { const k = kuralBul(id); return k ? k.ad : id; });
  const arsiv = (veri.karakterler || []).map(function (k) { return '<option value="' + kacir(k.id) + '">' + kacir(k.ad) + "</option>"; }).join("");

  $("#perde").innerHTML =
    '<div class="pencere pencere-genis" role="dialog" aria-modal="true">' +
      '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      '<h3 id="edBaslik">' + kacir(evrenAdi(e)) + "</h3>" +
      '<p class="pencere-alt">' + kacir(e.turAd || "") + " · kararlılık " + e.kararlilik + " · yaşam " + e.yasam + " · tuhaflık " + e.tuhaflik + (e.melez ? " · melez" : "") + "</p>" +

      '<label class="hf-alan"><span>Evrenin adı</span>' +
        '<input class="kod-giris arac-giris" id="edAd" maxlength="40" autocomplete="off" placeholder="ör. Ağırlıksız Kıyı" value="' + kacir(e.ad || "") + '"></label>' +
      '<p class="oyun-not">Kuralları: ' + (kuralAdlari.length ? kuralAdlari.map(kacir).join(" · ") : "—") + "</p>" +

      '<div class="ed-blok"><div class="oyun-etiket">İçerik — ' + icerik.length + " / " + ED_SINIR.icerik + "</div>" +
        '<p class="oyun-not">Bu evrende ne var? Yerler, nesneler, olaylar, gelenekler; ne istersen.</p>' +
        (icerik.length ? icerik.map(function (o) {
          return '<div class="ed-oge"><div class="ed-oge-baslik">' + kacir(o.baslik) + "</div>" +
                 (o.metin ? '<div class="ed-oge-metin">' + paragraf(o.metin) + "</div>" : "") + arac("icerik", o.id) + "</div>";
        }).join("") : "") +
        '<div class="ed-form">' +
          '<input class="kod-giris arac-giris" id="edIcB" maxlength="60" autocomplete="off" placeholder="Başlık, ör. Ağırlıksız Şehir" value="' + kacir(edTaslak.icB) + '">' +
          '<textarea class="kod-giris arac-giris" id="edIcM" rows="3" maxlength="800" placeholder="Anlat…">' + kacir(edTaslak.icM) + "</textarea>" +
          '<div class="ed-sira"><button type="button" class="dugme" data-ed="icerik-kaydet">' + (duzIc ? "Değişikliği kaydet" : "İçerik ekle") + "</button>" +
            (duzIc ? '<button type="button" class="dugme dugme-sade" data-ed="icerik-vazgec">Vazgeç</button>' : "") + "</div>" +
        "</div></div>" +

      '<div class="ed-blok"><div class="oyun-etiket">Kişiler — ' + kisiler.length + " / " + ED_SINIR.kisi + "</div>" +
        '<p class="oyun-not">Bu evrende yaşayanlar. İstersen arşivdeki bir karakteri de getirebilirsin.</p>' +
        (kisiler.length ? kisiler.map(function (o) {
          return '<div class="ed-oge"><div class="ed-oge-baslik">' + kacir(o.ad) + "</div>" +
                 (o.not ? '<div class="ed-oge-metin">' + paragraf(o.not) + "</div>" : "") + arac("kisi", o.id) + "</div>";
        }).join("") : "") +
        '<div class="ed-form">' +
          '<input class="kod-giris arac-giris" id="edKiA" maxlength="40" autocomplete="off" placeholder="Ad" value="' + kacir(edTaslak.kiA) + '">' +
          '<textarea class="kod-giris arac-giris" id="edKiN" rows="2" maxlength="240" placeholder="Kimdir? (isteğe bağlı)">' + kacir(edTaslak.kiN) + "</textarea>" +
          '<div class="ed-sira"><button type="button" class="dugme" data-ed="kisi-kaydet">' + (duzKi ? "Değişikliği kaydet" : "Kişi ekle") + "</button>" +
            (duzKi ? '<button type="button" class="dugme dugme-sade" data-ed="kisi-vazgec">Vazgeç</button>' : "") + "</div>" +
          (arsiv ? '<select class="kod-giris arac-giris" id="edKiArsiv"><option value="">Arşivden kişi getir…</option>' + arsiv + "</select>" : "") +
        "</div></div>" +
    "</div>";
}

/** İçerik ya da kişi ekler / günceller. */
function evrenOgeKaydet(tur) {
  const liste = evrenListesiOku();
  const e = liste.find(function (x) { return x.id === edId; });
  if (!e) { return; }
  const icerikMi = tur === "icerik";
  const alan = icerikMi ? "icerik" : "kisiler";
  const baslik = (icerikMi ? edTaslak.icB : edTaslak.kiA).trim();
  const metin = (icerikMi ? edTaslak.icM : edTaslak.kiN).trim();
  if (!baslik) { eckaBildir(icerikMi ? "Bir başlık yaz" : "Bir ad yaz"); return; }

  if (!e[alan]) { e[alan] = []; }
  if (edDuzenle && edDuzenle.tur === tur) {
    const o = e[alan].find(function (x) { return x.id === edDuzenle.id; });
    if (o) { if (icerikMi) { o.baslik = baslik; o.metin = metin; } else { o.ad = baslik; o.not = metin; } }
  } else {
    if (e[alan].length >= ED_SINIR[icerikMi ? "icerik" : "kisi"]) {
      eckaBildir("En fazla " + ED_SINIR[icerikMi ? "icerik" : "kisi"] + " " + (icerikMi ? "içerik" : "kişi") + " eklenebilir");
      return;
    }
    const o = { id: evrenYeniKimlik(icerikMi ? "ic_" : "ki_") };
    if (icerikMi) { o.baslik = baslik; o.metin = metin; } else { o.ad = baslik; o.not = metin; }
    e[alan].push(o);
  }
  kayitYaz(EVREN_ANAHTAR, JSON.stringify(liste));
  edDuzenle = null;
  if (icerikMi) { edTaslak.icB = ""; edTaslak.icM = ""; } else { edTaslak.kiA = ""; edTaslak.kiN = ""; }
  evrenDefteriCiz();
  if (typeof evrenGalerisiCiz === "function") { evrenGalerisiCiz(); }
}

function evrenOgeDuzenle(tur, id) {
  const e = evrenListesiOku().find(function (x) { return x.id === edId; });
  const o = e && (e[tur === "icerik" ? "icerik" : "kisiler"] || []).find(function (x) { return x.id === id; });
  if (!o) { return; }
  edDuzenle = { tur: tur, id: id };
  if (tur === "icerik") { edTaslak.icB = o.baslik || ""; edTaslak.icM = o.metin || ""; }
  else { edTaslak.kiA = o.ad || ""; edTaslak.kiN = o.not || ""; }
  evrenDefteriCiz();
  const alan = document.querySelector(tur === "icerik" ? "#edIcB" : "#edKiA");
  if (alan) { alan.focus(); }
}

function evrenOgeSil(tur, id) {
  const anahtar = tur + ":" + id;
  if (edSilOnay !== anahtar) { edSilOnay = anahtar; evrenDefteriCiz(); return; }
  edSilOnay = null;
  const liste = evrenListesiOku();
  const e = liste.find(function (x) { return x.id === edId; });
  if (!e) { return; }
  const alan = tur === "icerik" ? "icerik" : "kisiler";
  e[alan] = (e[alan] || []).filter(function (x) { return x.id !== id; });
  kayitYaz(EVREN_ANAHTAR, JSON.stringify(liste));
  if (edDuzenle && edDuzenle.id === id) { edDuzenle = null; }
  evrenDefteriCiz();
  if (typeof evrenGalerisiCiz === "function") { evrenGalerisiCiz(); }
}

document.addEventListener("input", function (e) {
  const t = e.target;
  if (t.id === "edIcB") { edTaslak.icB = t.value; }
  else if (t.id === "edIcM") { edTaslak.icM = t.value; }
  else if (t.id === "edKiA") { edTaslak.kiA = t.value; }
  else if (t.id === "edKiN") { edTaslak.kiN = t.value; }
});

document.addEventListener("change", function (e) {
  const t = e.target;
  if (t.id === "edAd") {
    const liste = evrenListesiOku();
    const ev = liste.find(function (x) { return x.id === edId; });
    if (!ev) { return; }
    const ad = t.value.trim().slice(0, 40);
    if (ad) { ev.ad = ad; } else { delete ev.ad; }
    kayitYaz(EVREN_ANAHTAR, JSON.stringify(liste));
    const b = document.querySelector("#edBaslik");
    if (b) { b.textContent = evrenAdi(ev); }
    if (typeof evrenGalerisiCiz === "function") { evrenGalerisiCiz(); }
  } else if (t.id === "edKiArsiv" && t.value) {
    const k = (veri.karakterler || []).find(function (x) { return x.id === t.value; });
    if (k) { edTaslak.kiA = k.ad; edTaslak.kiN = k.unvan || ""; edDuzenle = null; evrenOgeKaydet("kisi"); }
  }
});

document.addEventListener("click", function (e) {
  const g = e.target.closest("[data-evren-defter]");
  if (g) { evrenDefteriAc(g.getAttribute("data-evren-defter")); return; }

  const b = e.target.closest("[data-ed]");
  if (!b) { return; }
  const ne = b.getAttribute("data-ed"), id = b.getAttribute("data-id");
  if (ne === "icerik-kaydet") { evrenOgeKaydet("icerik"); }
  else if (ne === "kisi-kaydet") { evrenOgeKaydet("kisi"); }
  else if (ne === "icerik-duzenle") { evrenOgeDuzenle("icerik", id); }
  else if (ne === "kisi-duzenle") { evrenOgeDuzenle("kisi", id); }
  else if (ne === "icerik-sil") { evrenOgeSil("icerik", id); }
  else if (ne === "kisi-sil") { evrenOgeSil("kisi", id); }
  else if (ne === "icerik-vazgec" || ne === "kisi-vazgec") {
    edDuzenle = null;
    if (ne === "icerik-vazgec") { edTaslak.icB = ""; edTaslak.icM = ""; } else { edTaslak.kiA = ""; edTaslak.kiN = ""; }
    evrenDefteriCiz();
  }
});

function evrenGalerisiCiz() {
  const alan = document.querySelector("#evrenGaleriAlan");
  if (!alan) { return; }

  const liste = evrenListesiOku();

  if (!liste.length) {
    alan.innerHTML = '<p class="oyun-not">Henüz evren kurmadın.</p>';
    return;
  }

  const secim = (typeof birlesikSecim !== "undefined") ? birlesikSecim : [];

  const kuralAdi = function (id) {
    const k = kuralBul(id);
    return k ? k.ad : id;
  };

  alan.innerHTML =
    '<p class="oyun-not">İki evren seçip birleştirebilirsin. Kuralları toplanır, ' +
    "yabancı öğeleri, içeriği ve kişileri birlikte gelir — sonuç ikisine de benzemez. " +
    "Her evrenin defterine istediğin içeriği ve kişiyi ekleyebilirsin.</p>" +
    '<div class="evren-liste">' +
      liste.map(function (e, i) {
        const secili = secim.indexOf(i) !== -1;
        const ic = (e.icerik || []).length, ki = (e.kisiler || []).length;
        return '<div class="evren-hucre">' +
               '<button class="evren-kart e-' + kacir(e.tur) + (secili ? " secili" : "") +
                 (e.melez ? " melez" : "") + '" data-evren-sec="' + i + '">' +
                 '<span class="evren-tur">' + kacir(evrenAdi(e)) +
                   (e.melez ? ' <span class="melez-rozet">melez</span>' : "") + "</span>" +
                 (e.ad ? '<span class="evren-alt">' + kacir(e.turAd || "") + "</span>" : "") +
                 '<span class="evren-kural">' +
                   e.kurallar.map(kuralAdi).map(kacir).join(" · ") + "</span>" +
                 '<span class="evren-olcu">k' + e.kararlilik + " · y" + e.yasam +
                   " · t" + e.tuhaflik + (ic || ki ? " · " + ic + " içerik · " + ki + " kişi" : "") + "</span>" +
               "</button>" +
               '<button type="button" class="dugme dugme-sade evren-defter-btn" data-evren-defter="' + kacir(e.id) + '">Defter</button>' +
               "</div>";
      }).join("") +
    "</div>" +
    '<button class="dugme' + (secim.length === 2 ? "" : " pasif") +
      '" data-evren-birlestir="1">Seçili iki evreni birleştir</button>';
}

/* ==================== İLK AÇILIŞ TURU ==================== */

const TUR_ANAHTAR = "tentiforapp_tur";

let turAdim = 0;

function turGerekli() {
  return kayitOku(TUR_ANAHTAR) !== "bitti";
}

function turBaslat() {
  turAdim = 0;
  turCiz();
}

function turBitir() {
  kayitYaz(TUR_ANAHTAR, "bitti");
  const k = document.querySelector("#turKatman");
  if (k) { k.remove(); }
}

function turCiz() {
  const liste = veri.tur || [];
  if (!liste.length || turAdim >= liste.length) { turBitir(); return; }

  let k = document.querySelector("#turKatman");
  if (!k) {
    k = document.createElement("div");
    k.id = "turKatman";
    k.className = "tur-katman";
    document.body.appendChild(k);
  }

  const a = liste[turAdim];

  k.innerHTML =
    '<div class="tur-kutu" role="dialog" aria-modal="true">' +
      '<div class="tur-sayac">' + (turAdim + 1) + " / " + liste.length + "</div>" +
      "<h3>" + kacir(a.baslik) + "</h3>" +
      "<p>" + kacir(a.metin) + "</p>" +
      '<div class="oyun-sira">' +
        '<button class="dugme" data-tur="ileri">' +
          (turAdim === liste.length - 1 ? "Başla" : "Devam") + "</button>" +
        '<button class="dugme dugme-sade" data-tur="atla">Geç</button>' +
      "</div>" +
    "</div>";
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-seri]")) { seriOdulAl(); return; }
  if (e.target.closest("[data-bulmaca]")) {
    const g = document.querySelector("#bulmacaGiris");
    if (g) { bulmacaCevapla(g.value); }
    return;
  }

  const t = e.target.closest("[data-tur]");
  if (t) {
    if (t.dataset.tur === "atla") { turBitir(); return; }

    const a = (veri.tur || [])[turAdim];
    turAdim++;

    if (turAdim >= (veri.tur || []).length) {
      turBitir();
      if (a && a.hedef) { location.hash = a.hedef; }
      return;
    }

    turCiz();
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && document.activeElement &&
      document.activeElement.id === "bulmacaGiris") {
    bulmacaCevapla(document.activeElement.value);
  }
});
