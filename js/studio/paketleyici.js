/* TentiforApp 4.2 · studio/paketleyici — evreni ya da fan hikâyesini tek bir sıkıştırılmış .json.gz paketine çevirir,
   boyutunu denetler ve kilitli onay kuyruğuna bırakır. Veritabanına yalnızca küçük bir başvuru satırı yazılır.
   Evren onaylandıysa aynı evrenden yeni gönderim "güncelleme" olur. Hikâye, kurucusu "hikâyeleri ben onaylayayım"
   diyen bir evrene yazıldıysa önce kurucuya gider (bildirimle), sonra moderatöre. Kurucu paneli Sen sayfasında. */

const PAKET_SINIR = 3 * 1024 * 1024;   /* sıkıştırılmış en çok 3 MB (bucket sınırıyla aynı) */

async function eserPaketle(e) {
  const temiz = fanTemizle(JSON.parse(JSON.stringify(e)));
  if (!temiz || (temiz.tur !== "evren" && temiz.tur !== "hikaye")) { throw new Error("Eser okunamadı."); }
  delete temiz.lorlar; delete temiz.yoneticiOzet;   /* kilitli lore ve yönetici kodu kurucuya aittir */

  /* 4.4 Şema Genişletmesi & Geriye Dönük Uyumluluk (Fallback) */
  temiz.surum = temiz.surum || "4.4.0";
  if (temiz.tur === "evren") {
    temiz.ana_evren_id = temiz.ana_evren_id || null;
    temiz.kok_zaman_cizgisi = temiz.kok_zaman_cizgisi || null;
    temiz.paralel_dal = temiz.paralel_dal || null;
    temiz.okuma_rehberi = Array.isArray(temiz.okuma_rehberi) ? temiz.okuma_rehberi : [];
    if (temiz.roman && Array.isArray(temiz.roman.bolumler)) {
      temiz.roman.bolumler.forEach(function (b) {
        if (!b.kararlar) { b.kararlar = []; }
      });
    }
  }

  const blob = await tf4Sikistir(JSON.stringify(temiz));
  if (blob.size > PAKET_SINIR) { throw new Error("Paket " + (blob.size / 1048576).toFixed(1) + " MB; en çok 3 MB olabilir (büyük görselleri küçült)."); }
  return { blob: blob, eser: temiz };
}
async function evrenPaketle(e) { const p = await eserPaketle(e); return { blob: p.blob, evren: p.eser }; }

let BASVURU_BELLEK = null;   /* bu oturumda okunan başvurular (güncelleme tespiti için) */
async function basvurularim(tazele) {
  if (BASVURU_BELLEK && !tazele) { return BASVURU_BELLEK; }
  const s = await tf4Istemci();
  const { data, error } = await s.rpc("basvurularim");
  if (error) { throw error; }
  BASVURU_BELLEK = data || [];
  return BASVURU_BELLEK;
}

/** Hikâyenin yazıldığı evren sitedeki bir okur evreniyse adresi (kurucu onayı için) */
function hikayeEvrenAdresi(h) {
  const ad = String(h.evren || "").trim().toLocaleLowerCase("tr");
  if (!ad || typeof fanSiteListesi !== "function") { return null; }
  const e = fanSiteListesi("evren").find(function (x) { return String(x.ad || "").trim().toLocaleLowerCase("tr") === ad; });
  return e ? e.id : null;
}

async function eserOnayaGonder(e, secenek) {
  const o = secenek || {};
  if (!e) { throw new Error("Eser bulunamadı."); }
  if (typeof hesapKullanici === "undefined" || !hesapKullanici) { throw new Error("Onaya göndermek için giriş yap (başvuru hesabına bağlanır)."); }
  if (e.tur === "evren" && (String(e.ad || "").trim().length < 2 || String(e.ozet || "").trim().length < 20)) { throw new Error("Göndermeden önce evrenin adını ve en az bir cümlelik özetini yaz."); }
  if (e.tur === "hikaye" && (String(e.baslik || "").trim().length < 2 || String(e.metin || "").trim().length < 100)) { throw new Error("Göndermeden önce hikâyenin başlığını ve en az bir paragraf metnini yaz."); }
  const p = await eserPaketle(e);
  const s = await tf4Istemci();
  const yol = hesapKullanici.id + "/" + Date.now() + "-" + String(e.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) + ".json.gz";
  const y = await s.storage.from("onay-kuyrugu").upload(yol, p.blob, { contentType: "application/gzip", upsert: false });
  if (y.error) { throw new Error("Yüklenemedi: " + y.error.message); }
  const r = await s.rpc("basvuru_teslim", { p_tur: e.tur, p_baslik: String(e.tur === "evren" ? e.ad : e.baslik).trim(),
    p_ozet: String(e.ozet || "").trim().slice(0, 600), p_dosya_yolu: yol, p_boyut: p.blob.size,
    p_evren: e.tur === "hikaye" ? hikayeEvrenAdresi(e) : null, p_guncelle: o.guncelle || null, p_kaynak: String(e.id).slice(0, 60) });
  if (r.error) { throw new Error(/bekleyen/.test(r.error.message) ? "Onayda bekleyen başvurun var (ücretsiz 1, Pro 5)." : r.error.message); }
  BASVURU_BELLEK = null;
  /* kurucu onayı gerekiyorsa kurucuya itme bildirimi de gitsin (site içi bildirim zaten yazıldı) */
  if (r.data && r.data.durum === "kurucu_bekliyor") { tf4Fonksiyon("moderasyon", { islem: "kurucuya_bildir", id: r.data.id }).catch(function () { /* itme bildirimi isteğe bağlı */ }); }
  return { id: r.data && r.data.id, durum: r.data && r.data.durum, boyut: p.blob.size };
}
async function evrenOnayaGonder(id, secenek) { return eserOnayaGonder(typeof evrenBenimBul === "function" ? evrenBenimBul(id) : null, secenek); }

function durumMetni(x) {
  return ({ kurucu_bekliyor: "evrenin kurucusunun onayını bekliyor", bekliyor: "moderatörlerin onayını bekliyor", onaylandi: "onaylandı ✓", reddedildi: "reddedildi" })[x.durum] || x.durum;
}
function basvuruListesiHtml(l) {
  return l.length ? '<ul class="tf4-basvurular">' + l.map(function (x) {
    return "<li><b>" + kacir(x.baslik) + "</b> · " + (x.tur === "hikaye" ? "hikâye" : (x.guncelle_slug ? "güncelleme" : "evren")) + " · " + durumMetni(x) +
      (x.karar_notu ? ' <span class="oyun-not">— ' + kacir(x.karar_notu) + "</span>" : "") +
      (x.durum === "reddedildi" && x.kaynak_id ? ' <button type="button" class="ic-bag" data-tf4-duzelt="' + kacir(x.tur + ":" + x.kaynak_id) + '">Düzelt ve yeniden gönder</button>' : "") + "</li>";
  }).join("") + "</ul>" : '<p class="oyun-not">Henüz başvurun yok.</p>';
}

function teslimHtml() {
  return '<section class="kutu-y tf4-teslim" aria-label="Onaya gönder"><b>Siteye yayın için onaya gönder</b>' +
    '<p class="oyun-not" id="tf4TeslimNot">Evrenin sıkıştırılıp kilitli kuyruğa gider; moderatörler önizleyip onaylayınca sitenin evrenlerine (fan-made ya da kanon) eklenir.' + (tf4ProMu() ? " Pro: kuyrukta önceliklisin." : "") + "</p>" +
    '<div class="oyun-sira"><button type="button" class="dugme" data-tf4-gonder>Onaya gönder</button><button type="button" class="dugme dugme-sade" data-tf4-basvurularim>Başvurularım</button></div>' +
    '<p class="pencere-durum" id="tf4TeslimDurum" role="status"></p><div id="tf4Basvurular"></div></section>';
}

/* bu yerel evren daha önce onaylandıysa gönderim güncelleme olur */
async function tf4GuncellemeAdresi(id) {
  try { const l = await basvurularim(false); const x = l.find(function (b) { return b.tur === "evren" && b.kaynak_id === id && b.durum === "onaylandi" && (b.yayin_slug || b.guncelle_slug); }); return x ? (x.guncelle_slug || x.yayin_slug) : null; }
  catch (_) { return null; }
}

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-tf4-gonder], [data-tf4-basvurularim]");
  if (!b || typeof EVS === "undefined" || !EVS) { return; }
  const d = document.querySelector("#tf4TeslimDurum");
  const yaz = function (m, iyi) { if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };
  if (b.hasAttribute("data-tf4-basvurularim")) {
    try { const a = document.querySelector("#tf4Basvurular"); if (a) { a.innerHTML = basvuruListesiHtml(await basvurularim(true)); } }
    catch (e) { yaz("Başvurular okunamadı.", false); }
    return;
  }
  b.disabled = true; yaz("Paketleniyor…", true);
  try {
    const r = await evrenOnayaGonder(EVS.id, { guncelle: b.getAttribute("data-tf4-guncelle") || null });
    yaz("Gönderildi (" + Math.max(1, Math.round(r.boyut / 1024)) + " KB). Karar verilince bildirim gelir; durumunu “Başvurularım”da görürsün.", true);
  } catch (e) { yaz(e.message, false); }
  b.disabled = false;
});

/* fan hikâyesi penceresi: "Onaya gönder" (kendi hikâyen) ve "Bildir" (sitedeki eser) */
document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest('[data-fan-p="onaya"], [data-fan-p="sikayet"]');
  if (!b || typeof fanAcik === "undefined" || !fanAcik) { return; }
  const e = fanAcik.eser;
  const yaz = function (m, iyi) { if (typeof fanPDurum === "function") { fanPDurum(m, iyi); } };
  if (b.getAttribute("data-fan-p") === "sikayet") { sikayetEt(e.tur, e.id, yaz); return; }
  b.disabled = true; yaz("Paketleniyor…", true);
  try {
    const r = await eserOnayaGonder(e);
    yaz(r.durum === "kurucu_bekliyor" ? "Gönderildi: önce evrenin kurucusu onaylayacak, sonra moderatörler. Karar verilince bildirim gelir." : "Gönderildi: moderatörler onaylayınca sitede yayına girer. Karar verilince bildirim gelir.", true);
  } catch (err) { yaz(err.message, false); }
  b.disabled = false;
});

/* şikâyet: giriş yapmış okur, sitedeki evren ya da hikâye için */
async function sikayetEt(tur, slug, yaz) {
  if (typeof hesapKullanici === "undefined" || !hesapKullanici) { yaz("Bildirmek için giriş yap.", false); return; }
  const neden = prompt("Neden bildiriyorsun? (en az 3 harf; moderatörler görür)");
  if (!neden || neden.trim().length < 3) { return; }
  try {
    const s = await tf4Istemci();
    const r = await s.rpc("sikayet_et", { p_tur: tur === "hikaye" ? "hikaye" : "evren", p_slug: String(slug), p_neden: neden.trim().slice(0, 400) });
    if (r.error) { throw r.error; }
    yaz("Bildirildi, teşekkürler. Moderatörler inceleyecek.", true);
  } catch (e) { yaz("Bildirilemedi: " + (e.message || e), false); }
}

/* reddedilen başvuru: kaynağı aç (evren → Kurucu, hikâye → Fan hikâyeleri yazma) */
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-tf4-duzelt]");
  if (!b) { return; }
  const p = b.getAttribute("data-tf4-duzelt").split(":"), tur = p[0], id = p.slice(1).join(":");
  const e = fanEserlerim().find(function (x) { return x.id === id; });
  if (!e) { if (typeof eckaBildir === "function") { eckaBildir("Bu eser bu cihazda yok (başka cihazda yazılmış olabilir)."); } return; }
  if (typeof perdeKapat === "function") { perdeKapat(); }
  if (tur === "evren") { if (typeof EVR_ADIM !== "undefined") { EVR_ADIM[id] = "temel"; } evrenSonrakiSekme = "kurucu"; location.hash = "#/ev/benim/" + id; }
  else { fanSecili.hikaye = id; fanSekme.hikaye = "yaz"; location.hash = "#/fan"; setTimeout(function () { if (typeof fanCiz === "function") { fanCiz("hikaye"); } }, 150); }
});

/* ==================== kurucu paneli (Sen sayfası) ==================== */
async function kurucuPaneliCiz() {
  const a = document.querySelector("#kurucuAlan");
  if (!a || typeof hesapKullanici === "undefined" || !hesapKullanici) { if (a) { a.innerHTML = ""; } return; }
  let evrenler = [], bekleyen = [], basvuru = [];
  try {
    const s = await tf4Istemci();
    const [e1, e2, e3] = await Promise.all([s.from("evren_sahipleri").select("slug,hikaye_onayi"), s.rpc("kurucu_bekleyenler"), s.rpc("basvurularim")]);
    evrenler = e1.data || []; bekleyen = e2.data || []; basvuru = e3.data || []; BASVURU_BELLEK = basvuru;
  } catch (_) { a.innerHTML = ""; return; }
  if (!evrenler.length && !basvuru.length) { a.innerHTML = ""; return; }
  const ad = function (slug) { const e = (typeof fanSiteListesi === "function" ? fanSiteListesi("evren") : []).find(function (x) { return x.id === slug; }); return e ? e.ad : slug; };
  a.innerHTML = '<div class="kutu-y kurucu-panel"><b>Evrenlerin ve başvuruların</b>' +
    (evrenler.length ? '<h4>Sitedeki evrenlerin</h4><ul class="mod-yayin">' + evrenler.map(function (e) {
      return '<li><b>' + kacir(ad(e.slug)) + '</b> <label class="kurucu-ayar"><input type="checkbox" data-kurucu-onay="' + kacir(e.slug) + '"' + (e.hikaye_onayi ? " checked" : "") +
        "> Bu evrene yazılan hikâyeleri önce ben onaylayayım</label></li>";
    }).join("") + "</ul>" : "") +
    (bekleyen.length ? '<h4>Onayını bekleyen hikâyeler</h4>' + bekleyen.map(function (b) {
      return '<article class="kutu-y mod-basvuru" data-kurucu-id="' + kacir(b.id) + '"><b>' + kacir(b.baslik) + '</b><p class="oyun-not">' + kacir(ad(b.evren)) + " · " + new Date(b.tarih).toLocaleDateString("tr-TR") + "</p>" +
        (b.ozet ? "<p>" + kacir(b.ozet) + "</p>" : "") +
        '<label>Not (reddedersen yazara gider)</label><input class="arac-giris" data-kurucu-not maxlength="300">' +
        '<div class="oyun-sira"><button type="button" class="dugme dugme-sade" data-kurucu-oku>Oku</button><button type="button" class="dugme" data-kurucu-evet>Onayla</button><button type="button" class="dugme dugme-sade" data-kurucu-hayir>Reddet</button></div>' +
        '<p class="pencere-durum" role="status"></p><div class="kurucu-okuma"></div></article>';
    }).join("") : "") +
    (basvuru.length ? "<h4>Başvuruların</h4>" + basvuruListesiHtml(basvuru) : "") + "</div>";
}

document.addEventListener("change", async function (ev) {
  const t = ev.target;
  if (!t || !t.matches || !t.matches("[data-kurucu-onay]")) { return; }
  try {
    const s = await tf4Istemci();
    const r = await s.rpc("evren_hikaye_onayi", { p_slug: t.getAttribute("data-kurucu-onay"), p_acik: t.checked });
    if (r.error) { throw r.error; }
    if (typeof eckaBildir === "function") { eckaBildir(t.checked ? "Bu evrene yazılan hikâyeler önce sana gelecek" : "Hikâyeler doğrudan moderatörlere gidecek"); }
  } catch (e) { t.checked = !t.checked; if (typeof eckaBildir === "function") { eckaBildir("Kaydedilemedi: " + (e.message || e)); } }
});

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-kurucu-oku], [data-kurucu-evet], [data-kurucu-hayir]");
  if (!b) { return; }
  const kart = b.closest("[data-kurucu-id]"), id = kart.getAttribute("data-kurucu-id");
  const d = kart.querySelector(".pencere-durum");
  const yaz = function (m, iyi) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); };
  try {
    if (b.hasAttribute("data-kurucu-oku")) {
      const r = await tf4Fonksiyon("moderasyon", { islem: "kurucu_onizle", id: id });
      const h = fanTemizle(JSON.parse(await tf4Ac(await (await fetch(r.adres)).blob())));
      kart.querySelector(".kurucu-okuma").innerHTML = h ? '<div class="fan-oku">' + fanEserGovde(h, false, { tam: true }) + "</div>" : "<p>Okunamadı.</p>";
      return;
    }
    const onay = b.hasAttribute("data-kurucu-evet");
    if (!onay && !confirm("Bu hikâye reddedilsin mi? Notun yazara gider.")) { return; }
    yaz("Kaydediliyor…", true);
    await tf4Fonksiyon("moderasyon", { islem: "kurucu_karar", id: id, onay: onay, not: (kart.querySelector("[data-kurucu-not]") || {}).value || "" });
    kurucuPaneliCiz();
  } catch (e) { yaz(e.message || String(e), false); }
});

window.addEventListener("hashchange", function () { if (typeof aktifSayfa !== "undefined" && aktifSayfa === "sen") { kurucuPaneliCiz(); } });
