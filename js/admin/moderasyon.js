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
    '<div class="oyun-sira"><button type="button" class="dugme" data-mod-kod-uret>Kod üret</button><button type="button" class="dugme dugme-sade" data-mod-kod-kapat>Bütün kodları kapat</button></div>' +
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
  p.innerHTML = kabuk('<p class="pencere-alt">' + l.length + ' başvuru bekliyor · <button type="button" class="ic-bag" data-mod-cikis>çıkış</button></p>' +
    (l.length ? l.map(function (b) {
      return '<article class="kutu-y mod-basvuru" data-mod-id="' + kacir(b.id) + '"><b>' + (b.oncelik ? '<span class="eva-rozet">★ Pro</span> ' : "") + kacir(b.baslik) + "</b>" +
        '<p class="oyun-not">' + kacir(b.gonderen_eposta || "") + " · " + new Date(b.tarih).toLocaleString("tr-TR") + " · " + Math.max(1, Math.round((b.boyut || 0) / 1024)) + " KB</p>" +
        (b.ozet ? "<p>" + kacir(b.ozet) + "</p>" : "") +
        '<div class="oyun-sira"><button type="button" class="dugme dugme-sade" data-mod-onizle>Güvenli önizleme</button><button type="button" class="dugme dugme-sade" data-mod-indir>İndir</button></div>' +
        '<label>Yayın adresi</label><input class="arac-giris" data-mod-slug value="' + kacir(slugYap(b.baslik)) + '" maxlength="60">' +
        '<label>Not (isteğe bağlı; gönderen görür)</label><input class="arac-giris" data-mod-not maxlength="400">' +
        '<div class="oyun-sira"><button type="button" class="dugme" data-mod-onay>Onayla</button><button type="button" class="dugme dugme-sade" data-mod-red>Reddet</button></div>' +
        '<p class="pencere-durum" role="status"></p></article>';
    }).join("") : '<p class="oyun-not">Kuyruk boş.</p>') + moderasyonYoneticiHtml());
}

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-mod-giris], [data-mod-cikis], [data-mod-onizle], [data-mod-indir], [data-mod-onay], [data-mod-red], [data-mod-kod-uret], [data-mod-kod-kapat], [data-pro-ver]");
  if (!b) { return; }
  const kart = b.closest("[data-mod-id]");
  const durum = (kart && kart.querySelector(".pencere-durum")) || document.querySelector("#modDurum") || document.querySelector("#modKodDurum");
  const yaz = function (m, iyi) { if (durum) { durum.textContent = m; durum.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };
  try {
    if (b.hasAttribute("data-mod-giris")) { await moderatorGiris((document.querySelector("#modKod") || {}).value); return moderasyonCiz(); }
    if (b.hasAttribute("data-mod-cikis")) { moderatorCikis(); return moderasyonCiz(); }
    if (b.hasAttribute("data-mod-kod-uret")) {
      const kod = moderatorKodUret(), s = await tf4Istemci();
      const r = await s.rpc("moderator_kod_ekle", { p_ozet: await moderatorKodOzeti(kod), p_ad: (document.querySelector("#modKodAd") || {}).value || "" });
      if (r.error) { throw r.error; }
      const d = document.querySelector("#modKodDurum");
      if (d) { d.className = "pencere-durum iyi"; d.textContent = "Kod (yalnızca şimdi görünür, moderatöre ilet): " + kod; }
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
      if (typeof perdeKapat === "function") { perdeKapat(); }
      evrenMotoruAc(await tf4Ac(blob), { onizleme: true });
      if (typeof eckaBildir === "function") { eckaBildir("Güvenli önizleme: bu evren cihazına kaydedilmez. Karar için #/moderasyon"); }
      return;
    }
    const onay = b.hasAttribute("data-mod-onay");
    if (!onay && !confirm("Bu başvuru reddedilsin ve dosyası silinsin mi?")) { return; }
    yaz(onay ? "Yayına alınıyor…" : "Reddediliyor…", true);
    await tf4Fonksiyon("moderasyon", { islem: onay ? "onayla" : "reddet", token: token, id: id,
      slug: (kart.querySelector("[data-mod-slug]") || {}).value, not: (kart.querySelector("[data-mod-not]") || {}).value });
    if (onay) { try { localStorage.removeItem(YAYIN_ONBELLEK); } catch (_) { /* yok */ } }
    moderasyonCiz();
  } catch (e) { yaz(e.message || String(e), false); }
});
document.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && ev.target && ev.target.id === "modKod") { const b = document.querySelector("[data-mod-giris]"); if (b) { b.click(); } } });



/* #/moderasyon ve #/yayin/<adres> sayfa değil: yönlendirici bunları "bulunamadı" saymasın; altta ana sayfa açılır */
if (typeof hataSayfasiAc === "function") {
  const eskiHSA40 = hataSayfasiAc;
  window.hataSayfasiAc = function (istenen) {
    const s = String(istenen || "");
    if (/^(moderasyon|yayin\/)/.test(s)) {
      if (typeof sayfaGoster === "function" && typeof aktifSayfa !== "undefined" && !aktifSayfa) { sayfaGoster("arsiv", false); }
      setTimeout(/^moderasyon/.test(s) ? moderasyonCiz : yayinAdresiBak, 0);
      return;
    }
    return eskiHSA40.apply(this, arguments);
  };
}
