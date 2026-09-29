/* TentiforApp 4.0 · admin/moderasyon — erişim koduyla açılan onay kuyruğu. Adres: #/moderasyon
   Moderatör: kuyruğu listeler, paketi indirir ya da Güvenli Önizleme'de (cihazda kalıcı olmadan) açar, onaylar/reddeder.
   Yönetici (panel açıkken) aynı pencerede moderatör kodu üretir, kodları kapatır, elle Pro verir. */

function slugYap(s) {
  const t = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
  return String(s || "").toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, function (c) { return t[c]; })
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "evren";
}

function moderasyonYoneticiHtml() {
  if (typeof yoneticiAcik !== "function" || !yoneticiAcik()) { return ""; }
  return '<details class="kutu-y mod-yonetici"><summary><b>Yönetici: moderatör kodları ve Pro</b></summary>' +
    '<label for="modKodAd">Moderatörün adı</label><input class="arac-giris" id="modKodAd" maxlength="60" placeholder="Ayşe">' +
    '<label for="modKodDuzey">Yetkisi</label><select class="kod-giris arac-giris" id="modKodDuzey"><option value="fan">Fan moderatör: yalnızca fan-made onaylar</option><option value="kanon">Kanon moderatör: fan-made ve kanon onaylar</option></select>' +
    '<div class="oyun-sira"><button type="button" class="dugme" data-mod-kod-uret>Kod üret</button><button type="button" class="dugme dugme-sade" data-mod-kod-liste>Kodları göster</button><button type="button" class="dugme dugme-sade" data-mod-kod-kapat>Bütün kodları kapat</button></div>' +
    '<div id="modKodListe"></div>' +
    '<p class="pencere-durum" id="modKodDurum" role="status"></p>' +
    '<label for="proKadi">Elle Pro ver: kullanıcı adı</label><input class="arac-giris" id="proKadi" maxlength="40">' +
    '<label for="proGun">Gün</label><input class="arac-giris" id="proGun" type="number" min="1" max="3660" value="30">' +
    '<div class="oyun-sira"><button type="button" class="dugme dugme-sade" data-pro-ver>Pro ver</button></div></details>';
}

async function moderasyonCiz() {
  const p = document.querySelector("#perde");
  if (!p) { return; }
  const kabuk = function (ic) { return '<div class="pencere mod-pencere" role="dialog" aria-modal="true" aria-label="Moderasyon"><button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button><h3>Moderasyon</h3>' + ic + "</div>"; };
  const t = moderatorToken();
  if (!t) {
    p.innerHTML = kabuk('<p class="pencere-alt">Onay kuyruğu yalnızca moderatör erişim koduyla açılır.</p>' +
      '<label for="modKod">Moderatör kodu</label><input class="kod-giris" id="modKod" autocomplete="off" spellcheck="false" placeholder="MOD-…">' +
      '<div class="oyun-sira"><button type="button" class="dugme" data-mod-giris>Gir</button></div><p class="pencere-durum" id="modDurum" role="status"></p>' + moderasyonYoneticiHtml());
    p.hidden = false; const g = p.querySelector("#modKod"); if (g) { g.focus(); }
    return;
  }
  p.innerHTML = kabuk('<p class="oyun-not">Kuyruk yükleniyor…</p>'); p.hidden = false;
  let l = [];
  try {
    const s = await tf4Istemci();
    const r = await s.rpc("mod_kuyruk", { p_token: t });
    if (r.error) { throw r.error; }
    l = r.data || [];
  } catch (e) { moderatorCikis(); return moderasyonCiz(); }
  const kanonYetki = moderatorDuzey() === "kanon";
  p.innerHTML = kabuk('<p class="pencere-alt">' + (kanonYetki ? "Kanon moderatör" : "Fan moderatör") + " · " + l.length + ' başvuru bekliyor · <button type="button" class="ic-bag" data-mod-cikis>çıkış</button></p>' +
    '<p class="oyun-not">Onaylanan evren GitHub deposuna yazılır (evrenler/ klasörü ve veri.json); yönetici Yayınla’ya basınca sitede görünür.</p>' +
    (l.length ? l.map(function (b) {
      const tur = b.tur === "hikaye" ? "hikâye" : (b.guncelle_slug ? "güncelleme" : "evren");
      return '<article class="kutu-y mod-basvuru" data-mod-id="' + kacir(b.id) + '" data-mod-tur="' + kacir(b.tur || "evren") + '" data-mod-guncelle="' + kacir(b.guncelle_slug || "") + '">' +
        '<span class="mod-tur">' + tur + "</span><b>" + (b.oncelik ? '<span class="eva-rozet">★ Pro</span> ' : "") + kacir(b.baslik) + "</b>" +
        (b.tur === "hikaye" ? '<p class="oyun-not">Evren: ' + kacir(b.evren_slug || "Tömye ya da belirtilmemiş") + "</p>" : "") +
        (b.guncelle_slug ? '<p class="oyun-not">Sitedeki “' + kacir(b.guncelle_slug) + '” evreninin yeni hâli. Kurucusu gönderdi. <button type="button" class="ic-bag" data-mod-fark>Neler değişti?</button></p><div class="mod-fark-alan"></div>' : "") +
        '<p class="oyun-not">' + kacir(b.gonderen_eposta || "") + " · " + new Date(b.tarih).toLocaleString("tr-TR") + " · " + Math.max(1, Math.round((b.boyut || 0) / 1024)) + " KB</p>" +
        (b.ozet ? "<p>" + kacir(b.ozet) + "</p>" : "") +
        '<div class="oyun-sira"><button type="button" class="dugme dugme-sade" data-mod-onizle>Güvenli önizleme</button><button type="button" class="dugme dugme-sade" data-mod-indir>İndir</button></div>' +
        (b.guncelle_slug ? "" : '<label>Yayın adresi</label><input class="arac-giris" data-mod-slug value="' + kacir(slugYap(b.baslik)) + '" maxlength="60">') +
        '<label>Not (isteğe bağlı; gönderen görür)</label><input class="arac-giris" data-mod-not maxlength="400">' +
        '<div class="oyun-sira"><button type="button" class="dugme" data-mod-onay="fan">Fan-made olarak onayla</button>' + (kanonYetki ? '<button type="button" class="dugme" data-mod-onay="kanon">Kanon olarak onayla</button>' : "") + '<button type="button" class="dugme dugme-sade" data-mod-red>Reddet</button></div>' +
        '<p class="pencere-durum" role="status"></p></article>';
    }).join("") : '<p class="oyun-not">Kuyruk boş.</p>') + '<div id="modSikayetler"></div>' + yayindakilerHtml(kanonYetki) + moderasyonYoneticiHtml());
  sikayetleriCiz(kanonYetki);
}

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-mod-giris], [data-mod-cikis], [data-mod-onizle], [data-mod-indir], [data-mod-onay], [data-mod-red], [data-mod-kod-uret], [data-mod-kod-kapat], [data-pro-ver]");
  if (!b) { return; }
  const kart = b.closest("[data-mod-id]");
  const durum = (kart && kart.querySelector(".pencere-durum")) || document.querySelector("#modDurum") || document.querySelector("#modKodDurum");
  const yaz = function (m, iyi) { if (durum) { durum.textContent = m; durum.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };
  try {
    if (b.hasAttribute("data-mod-giris")) { await moderatorGiris((document.querySelector("#modKod") || {}).value); await moderatorDuzeyYukle(); return moderasyonCiz(); }
    if (b.hasAttribute("data-mod-cikis")) { moderatorCikis(); return moderasyonCiz(); }
    if (b.hasAttribute("data-mod-kod-uret")) {
      const kod = moderatorKodUret(), s = await tf4Istemci();
      const duzey = (document.querySelector("#modKodDuzey") || {}).value === "kanon" ? "kanon" : "fan";
      const r = await s.rpc("moderator_kod_ekle", { p_ozet: await moderatorKodOzeti(kod), p_ad: (document.querySelector("#modKodAd") || {}).value || "", p_duzey: duzey });
      if (r.error) { throw r.error; }
      const d = document.querySelector("#modKodDurum");
      if (d) { d.className = "pencere-durum iyi"; d.textContent = (duzey === "kanon" ? "Kanon" : "Fan") + " moderatör kodu (yalnızca şimdi görünür, moderatöre ilet): " + kod; }
      return;
    }
    if (b.hasAttribute("data-mod-kod-kapat")) {
      const s = await tf4Istemci(); const r = await s.rpc("moderator_kodlari_kapat");
      if (r.error) { throw r.error; }
      const d = document.querySelector("#modKodDurum"); if (d) { d.className = "pencere-durum iyi"; d.textContent = r.data + " kod kapatıldı; açık oturumlar düştü."; }
      return;
    }
    if (b.hasAttribute("data-pro-ver")) {
      const s = await tf4Istemci();
      const r = await s.rpc("pro_ver", { p_kullanici_adi: (document.querySelector("#proKadi") || {}).value || "", p_gun: Number((document.querySelector("#proGun") || {}).value) || 30 });
      if (r.error) { throw r.error; }
      const d = document.querySelector("#modKodDurum"); if (d) { d.className = "pencere-durum iyi"; d.textContent = "Pro verildi: " + new Date(r.data).toLocaleDateString("tr-TR") + " tarihine kadar."; }
      return;
    }
    const id = kart.getAttribute("data-mod-id"), token = moderatorToken();
    if (b.hasAttribute("data-mod-onizle") || b.hasAttribute("data-mod-indir")) {
      yaz("İndiriliyor…", true);
      const r = await tf4Fonksiyon("moderasyon", { islem: "onizle", token: token, id: id });
      const blob = await (await fetch(r.adres)).blob();
      if (b.hasAttribute("data-mod-indir")) { kartIndir(blob, slugYap(kart.querySelector("b").textContent) + ".json.gz"); yaz("İndirildi.", true); return; }
      const metin = await tf4Ac(blob);
      if (kart.getAttribute("data-mod-tur") === "hikaye") {
        const h = fanTemizle(JSON.parse(metin));
        const alan = kart.querySelector(".mod-okuma") || kart.appendChild(Object.assign(document.createElement("div"), { className: "kurucu-okuma mod-okuma" }));
        alan.innerHTML = h ? '<div class="fan-oku">' + fanEserGovde(h, false, { tam: true }) + "</div>" : "<p>Okunamadı.</p>";
        yaz("Hikâye aşağıda (cihaza kaydedilmedi).", true);
        return;
      }
      if (typeof perdeKapat === "function") { perdeKapat(); }
      evrenMotoruAc(metin, { onizleme: true });
      if (typeof eckaBildir === "function") { eckaBildir("Güvenli önizleme: bu evren cihazına kaydedilmez. Karar için #/moderasyon"); }
      return;
    }
    const onay = b.hasAttribute("data-mod-onay");
    if (!onay && !confirm("Bu başvuru reddedilsin ve dosyası silinsin mi?")) { return; }
    yaz(onay ? "Yayına alınıyor…" : "Reddediliyor…", true);
    const r = await tf4Fonksiyon("moderasyon", { islem: onay ? "onayla" : "reddet", token: token, id: id, kanon: onay && b.getAttribute("data-mod-onay") === "kanon",
      slug: (kart.querySelector("[data-mod-slug]") || {}).value, not: (kart.querySelector("[data-mod-not]") || {}).value });
    if (onay && typeof eckaBildir === "function") { eckaBildir((r.kanon ? "Kanon" : "Fan-made") + " olarak GitHub'a yazıldı; yönetici Yayınla'ya basınca sitede görünür."); }
    moderasyonCiz();
  } catch (e) { yaz(e.message || String(e), false); }
});
document.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && ev.target && ev.target.id === "modKod") { const b = document.querySelector("[data-mod-giris]"); if (b) { b.click(); } } });

/* 4.0.3: moderatörün düzeyi (fan / kanon) bu sekmede saklanır; asıl denetim sunucuda (moderasyon fonksiyonu) */
function moderatorDuzey() { try { return sessionStorage.getItem("tf4_mod_duzey") || "fan"; } catch (_) { return "fan"; } }
async function moderatorDuzeyYukle() {
  try {
    const s = await tf4Istemci();
    const r = await s.rpc("moderator_bilgi", { p_token: moderatorToken() });
    if (r.data) { sessionStorage.setItem("tf4_mod_duzey", r.data.duzey === "kanon" ? "kanon" : "fan"); }
  } catch (_) { /* yok */ }
}

/* yayındaki (sitedeki) fan evrenleri: kanon moderatör kanon / fan-made arasında değiştirir. Liste veri.json'dan (sunucu yok) */
function yayindakilerHtml(kanonYetki) {
  const evr = typeof fanSiteListesi === "function" ? fanSiteListesi("evren").filter(function (x) { return x.test !== true; }) : [];
  const hik = typeof fanSiteListesi === "function" ? fanSiteListesi("hikaye") : [];
  if (!evr.length && !hik.length) { return ""; }
  const kaldir = function (tur, id) { return kanonYetki ? ' <button type="button" class="ic-bag" data-mod-kaldir="' + tur + ":" + kacir(id) + '">Yayından kaldır</button>' : ""; };
  return (evr.length ? '<h4>Sitedeki okur evrenleri</h4><ul class="mod-yayin">' + evr.map(function (x) {
      return "<li><b>" + kacir(x.ad || x.id) + "</b> · " + (x.kanon === true ? "kanon" : "fan-made") +
        (kanonYetki ? ' <button type="button" class="ic-bag" data-mod-kanon="' + kacir(x.id) + '" data-kanon="' + (x.kanon === true ? "0" : "1") + '">' + (x.kanon === true ? "Fan-made yap" : "Kanon yap") + "</button>" : "") + kaldir("evren", x.id) + "</li>";
    }).join("") + "</ul>" : "") +
    (hik.length ? '<h4>Sitedeki fan hikâyeleri</h4><ul class="mod-yayin">' + hik.map(function (x) {
      return "<li><b>" + kacir(x.baslik || x.id) + "</b>" + (x.evren ? ' <span class="oyun-not">· ' + kacir(x.evren) + "</span>" : "") + kaldir("hikaye", x.id) + "</li>";
    }).join("") + "</ul>" : "") +
    (kanonYetki ? '<p class="oyun-not">Değişiklikler GitHub’a yazılır; yönetici Yayınla’ya basınca sitede görünür.</p>' : "");
}
document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-mod-kanon]");
  if (!b) { return; }
  b.disabled = true;
  try {
    await tf4Fonksiyon("moderasyon", { islem: "kanon", token: moderatorToken(), slug: b.getAttribute("data-mod-kanon"), kanon: b.getAttribute("data-kanon") === "1" });
    if (typeof eckaBildir === "function") { eckaBildir("GitHub'a yazıldı; yönetici Yayınla'ya basınca sitede görünür."); }
    b.textContent = "Kaydedildi ✓";
  } catch (e) { if (typeof eckaBildir === "function") { eckaBildir("Değiştirilemedi: " + (e.message || e)); } b.disabled = false; }
});

/* 4.0.3: yönetici kodları görür ve tek tek siler */
async function moderatorKodListesiCiz() {
  const a = document.querySelector("#modKodListe");
  if (!a) { return; }
  const s = await tf4Istemci();
  const r = await s.rpc("moderator_kodlari_listesi");
  if (r.error) { a.innerHTML = '<p class="pencere-durum kotu">Okunamadı: ' + kacir(r.error.message) + "</p>"; return; }
  const l = r.data || [];
  a.innerHTML = l.length ? '<ul class="mod-yayin">' + l.map(function (k) {
    return "<li><b>" + kacir(k.ad || "adsız") + "</b> · " + (k.duzey === "kanon" ? "kanon" : "fan") + " moderatör" + (k.aktif ? "" : " · kapalı") +
      ' <span class="oyun-not">#' + kacir(k.kisa) + " · " + new Date(k.olusturma).toLocaleDateString("tr-TR") + "</span>" +
      ' <button type="button" class="ic-bag" data-mod-kod-sil="' + kacir(k.ozet) + '">Sil</button></li>';
  }).join("") + "</ul>" : '<p class="oyun-not">Moderatör kodu yok.</p>';
}
document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-mod-kod-liste], [data-mod-kod-sil]");
  if (!b) { return; }
  try {
    if (b.hasAttribute("data-mod-kod-sil")) {
      if (!confirm("Bu moderatör kodu silinsin mi? Açık oturumu da hemen düşer.")) { return; }
      const s = await tf4Istemci();
      const r = await s.rpc("moderator_kod_sil", { p_ozet: b.getAttribute("data-mod-kod-sil") });
      if (r.error) { throw r.error; }
    }
    await moderatorKodListesiCiz();
  } catch (e) { if (typeof eckaBildir === "function") { eckaBildir("Olmadı: " + (e.message || e)); } }
});

/* 4.2: güncellemede sitedeki hâl ile yeni hâl arasındaki fark */
document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-mod-fark]");
  if (!b) { return; }
  const kart = b.closest("[data-mod-id]"), alan = kart.querySelector(".mod-fark-alan");
  try {
    alan.textContent = "Karşılaştırılıyor…";
    const r = await tf4Fonksiyon("moderasyon", { islem: "onizle", token: moderatorToken(), id: kart.getAttribute("data-mod-id") });
    const yeni = JSON.parse(await tf4Ac(await (await fetch(r.adres)).blob()));
    const eski = await (await fetch(r.eski || ("evrenler/" + kart.getAttribute("data-mod-guncelle") + ".json"), { cache: "no-cache" })).json();
    const f = typeof evrFark === "function" ? evrFark(eski, yeni) : [];
    alan.innerHTML = f.length ? '<ul class="mod-fark">' + f.slice(0, 60).map(function (x) { return "<li>" + kacir(x.tur) + " " + kacir(x.metin) + "</li>"; }).join("") + "</ul>" : '<p class="oyun-not">Görünür bir fark yok.</p>';
  } catch (e) { alan.textContent = "Karşılaştırılamadı: " + (e.message || e); }
});

/* 4.2: şikâyetler ve yayından kaldırma (kaldırma yalnızca kanon moderatör) */
async function sikayetleriCiz(kanonYetki) {
  const a = document.querySelector("#modSikayetler");
  if (!a) { return; }
  try {
    const r = await tf4Fonksiyon("moderasyon", { islem: "sikayetler", token: moderatorToken() });
    const l = r.liste || [];
    a.innerHTML = l.length ? "<h4>Şikâyetler</h4>" + l.map(function (x) {
      return '<article class="kutu-y mod-basvuru"><span class="mod-tur">' + (x.tur === "hikaye" ? "hikâye" : "evren") + "</span><b>" + kacir(x.slug) + "</b> · " + x.sayi + " bildirim" +
        '<ul class="mod-fark">' + (x.nedenler || []).slice(0, 5).map(function (n) { return "<li>" + kacir(n) + "</li>"; }).join("") + "</ul>" +
        '<div class="oyun-sira"><button type="button" class="dugme dugme-sade" data-mod-sikayet-kapat="' + kacir(x.tur + ":" + x.slug) + '">Sorun yok, kapat</button>' +
        (kanonYetki ? '<button type="button" class="dugme" data-mod-kaldir="' + kacir(x.tur + ":" + x.slug) + '">Yayından kaldır</button>' : "") + "</div></article>";
    }).join("") : "";
  } catch (_) { a.innerHTML = ""; }
}
document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-mod-kaldir], [data-mod-sikayet-kapat]");
  if (!b) { return; }
  const kaldir = b.hasAttribute("data-mod-kaldir");
  const p = b.getAttribute(kaldir ? "data-mod-kaldir" : "data-mod-sikayet-kapat").split(":");
  if (kaldir && !confirm("Bu " + (p[0] === "hikaye" ? "hikâye" : "evren") + " yayından kaldırılsın mı? GitHub'dan silinir; Yayınla'dan sonra sitede görünmez.")) { return; }
  b.disabled = true;
  try {
    await tf4Fonksiyon("moderasyon", { islem: kaldir ? "kaldir" : "sikayet_kapat", token: moderatorToken(), tur: p[0], slug: p.slice(1).join(":") });
    if (typeof eckaBildir === "function") { eckaBildir(kaldir ? "Kaldırıldı; yönetici Yayınla'ya basınca sitede görünmez." : "Şikâyet kapatıldı."); }
    moderasyonCiz();
  } catch (e) { if (typeof eckaBildir === "function") { eckaBildir("Olmadı: " + (e.message || e)); } b.disabled = false; }
});
