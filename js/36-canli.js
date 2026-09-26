/* Canlı ve ortak anlar: Kor'un Hıçkırığı, şifreli kartpostal, arşiv avı. */

/* ==================== KOR'UN HIÇKIRIĞI ====================
   Sunucu günde en çok bir kez, önceden okunamayan bir anda 3 dakikalık bir pencere açar.
   Sayfa açıkken dakikada bir sorulur (hesap kütüphanesi gerekmez); pencere açıksa ekrandan
   karanlık bir halka geçer ve "Tanığım" düğmesi çıkar. Tanıklık sunucuda doğrulanır. */

const HICKIRIK_ANAHTAR = "tentiforapp_hickirik_gun";
let hickirikZamanlayici = null;

function hickirikBugunGosterildi() {
  try { return localStorage.getItem(HICKIRIK_ANAHTAR) === new Date().toISOString().slice(0, 10); } catch (e) { return false; }
}

async function hickirikSor() {
  if (document.hidden || hickirikBugunGosterildi()) { return; }
  if (typeof HESAP_AYAR === "undefined" || !HESAP_AYAR.url || !HESAP_AYAR.anahtar) { return; }
  try {
    const y = await fetch(HESAP_AYAR.url + "/rest/v1/rpc/hickirik_durum", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: HESAP_AYAR.anahtar, Authorization: "Bearer " + HESAP_AYAR.anahtar },
      body: "{}"
    });
    if (!y.ok) { return; }
    const d = await y.json();
    if (d && d.aktif) { hickirikGoster(d.kalan); }
  } catch (e) { /* çevrimdışı: sessiz */ }
}

function hickirikBaslat() {
  if (hickirikZamanlayici) { return; }
  setTimeout(hickirikSor, 8000);
  hickirikZamanlayici = setInterval(hickirikSor, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { hickirikSor(); } });
}

function hickirikGoster(kalan) {
  if (document.querySelector("#hickirik")) { return; }
  try { localStorage.setItem(HICKIRIK_ANAHTAR, new Date().toISOString().slice(0, 10)); } catch (e) { /* yok */ }
  const k = document.createElement("div");
  k.id = "hickirik";
  k.className = "hickirik";
  k.innerHTML =
    '<div class="hickirik-halka" aria-hidden="true"></div>' +
    '<div class="hickirik-kart" role="dialog" aria-live="assertive">' +
      '<span class="oyun-etiket">Şu an, herkeste</span>' +
      "<h3>Kor hıçkırdı.</h3>" +
      '<p>Gündüzün ortasından ince bir karanlık geçiyor. Bu an bir daha tekrarlanmayacak; ' +
        (kalan ? "yaklaşık " + Math.max(1, Math.round(kalan / 60)) + " dakika içinde geçecek." : "birazdan geçecek.") + "</p>" +
      '<button class="dugme" data-hickirik="tanik">Tanığım</button> ' +
      '<button class="dugme dugme-sade" data-hickirik="kapat">Kapat</button>' +
      '<p class="pencere-durum" id="hickirikDurum"></p>' +
    "</div>";
  document.body.appendChild(k);
}

async function hickirikTanik() {
  const d = document.querySelector("#hickirikDurum");
  const yaz = function (m, iyi) { if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };
  if (typeof hesapGerekli === "function") { await hesapGerekli(); }
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) {
    yaz("Tanık sayılmak için giriş yap — pencere birkaç dakika açık.");
    if (typeof hesapPencere === "function") { hesapPencere("giris"); }
    return;
  }
  const { data, error } = await hesapIstemci.rpc("hickirik_tanik");
  if (error) { yaz(typeof hesapHataMetni === "function" ? hesapHataMetni(error) : "Kaydedilemedi."); return; }
  if (data && data.durum === "tamam") {
    yaz("Tanıklığın kaydedildi. Bugün " + data.bugun + " kişi gördü; sen toplam " + data.toplam + " kez.", true);
    if (typeof madalyaVer === "function") { madalyaVer("hickirikTanigi"); }
  } else { yaz("Hıçkırık geçti; bir dahakine."); }
}

/* ==================== ŞİFRELİ KARTPOSTAL ==================== */

function b64urlYaz(metin) {
  const b = new TextEncoder().encode(metin);
  let s = "";
  b.forEach(function (x) { s += String.fromCharCode(x); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlOku(metin) {
  const s = atob(metin.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(s, function (c) { return c.charCodeAt(0); }));
}

function kartpostalCiz() {
  const alan = document.querySelector("#kartpostalAlan");
  if (!alan) { return; }
  const ad = (typeof hesapProfil !== "undefined" && hesapProfil && (hesapProfil.gorunen_ad || hesapProfil.kullanici_adi)) || "";
  alan.innerHTML =
    '<p class="oyun-giris">Birine kilitli bir kartpostal gönder. Bağlantıyı açan, mesajı ancak kilidi çözerse okur. ' +
      "Mesaj hiçbir sunucuya gitmez; bağlantının kendisinde durur.</p>" +
    '<form class="kp-form" data-kp-form>' +
      '<label>Kimden<input class="kod-giris arac-giris" id="kpKimden" maxlength="40" value="' + kacir(ad) + '"></label>' +
      '<label>Mesaj<textarea class="kod-giris arac-giris" id="kpMesaj" rows="4" maxlength="300" required></textarea></label>' +
      '<fieldset class="kp-kilit"><legend>Kilit</legend>' +
        '<label><input type="radio" name="kpKilit" value="kyldo" checked> Kyldo yazısı <span class="oyun-not">(alıcı çözerek okur)</span></label>' +
        '<label><input type="radio" name="kpKilit" value="sifre"> Şifre</label>' +
        '<label><input type="radio" name="kpKilit" value="acik"> Kilitsiz</label>' +
      "</fieldset>" +
      '<input class="kod-giris arac-giris" id="kpSifre" maxlength="40" placeholder="şifre (alıcıya ayrıca söyle)" hidden autocomplete="off">' +
      '<button class="dugme" type="submit">Bağlantı oluştur</button>' +
    "</form>" +
    '<div id="kpSonuc"></div>';
}

function kartpostalOlustur() {
  const al = function (id) { return ((document.querySelector(id) || {}).value || "").trim(); };
  const mesaj = al("#kpMesaj");
  const kilit = (document.querySelector('input[name="kpKilit"]:checked') || {}).value || "kyldo";
  const sonuc = document.querySelector("#kpSonuc");
  if (!mesaj) { return; }
  const paket = { v: 1, k: al("#kpKimden").slice(0, 40), t: kilit, m: mesaj };
  if (kilit === "sifre") {
    const kod = al("#kpSifre");
    if (kod.length < 3) { sonuc.innerHTML = '<p class="pencere-durum kotu">Şifre en az 3 karakter olsun.</p>'; return; }
    paket.m = sifrele("TNTF:" + mesaj, kod);
  }
  const adres = location.href.split("#")[0] + "#/kartpostal/" + b64urlYaz(JSON.stringify(paket));
  sonuc.innerHTML = '<div class="kutu-y"><label>Bağlantı hazır</label>' +
    '<input class="kod-giris arac-giris" readonly value="' + kacir(adres) + '" id="kpAdres">' +
    '<button class="dugme" data-kp-paylas>Paylaş</button> <button class="dugme dugme-sade" data-kp-onizle>Önizle</button>' +
    (kilit === "sifre" ? '<p class="oyun-not">Şifreyi bağlantıyla aynı yerden gönderme.</p>' : "") + "</div>";
}

function kartpostalAc(ham) {
  let p;
  try { p = JSON.parse(b64urlOku(ham)); } catch (e) { p = null; }
  const perde = document.querySelector("#perde");
  if (!perde) { return; }
  if (!p || typeof p.m !== "string") {
    perde.innerHTML = '<div class="pencere"><button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button><h3>Kartpostal okunamadı</h3>' +
      '<p class="pencere-alt">Bağlantı eksik kopyalanmış olabilir.</p></div>';
    perde.hidden = false;
    return;
  }
  const kimden = String(p.k || "").slice(0, 40);
  let govde = "";
  if (p.t === "sifre") {
    govde = '<p class="pencere-alt">Bu kartpostal şifreli. Gönderen şifreyi sana ayrıca söylemiş olmalı.</p>' +
      '<form data-kp-coz><input class="kod-giris" id="kpCozKod" autocomplete="off" placeholder="şifre">' +
      '<button class="dugme" type="submit">Aç</button></form><div class="kp-metin" id="kpMetin"></div>';
  } else if (p.t === "kyldo") {
    govde = '<div class="kp-kyldo">' + (typeof kyldoYaz === "function" ? kyldoYaz(p.m.slice(0, 300), 34) : kacir(p.m)) + "</div>" +
      '<p class="oyun-not">Kyldo yazısıyla yazıldı. Araçlar → Kyldo yazısı ile çözebilirsin.</p>' +
      '<button class="dugme dugme-sade" data-kp-goster>Okunuşunu göster</button><div class="kp-metin" id="kpMetin" hidden>' + paragraf(p.m.slice(0, 300)) + "</div>";
  } else {
    govde = '<div class="kp-metin">' + paragraf(p.m.slice(0, 300)) + "</div>";
  }
  perde.innerHTML = '<div class="pencere kartpostal" role="dialog" aria-modal="true">' +
    '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
    '<span class="oyun-etiket">Kartpostal' + (kimden ? " · " + kacir(kimden) + "'den" : "") + "</span>" +
    govde + "</div>";
  perde.hidden = false;
  perde.dataset.kp = ham;
}

/* ==================== ARŞİV AVI ==================== */

function avNormal(t) {
  const tablo = { "ı": "i", "İ": "i", "Ş": "s", "ş": "s", "Ğ": "g", "ğ": "g", "Ü": "u", "ü": "u", "Ö": "o", "ö": "o", "Ç": "c", "ç": "c", "Â": "a", "â": "a", "Î": "i", "î": "i", "Û": "u", "û": "u" };
  return Array.from(String(t || "")).map(function (h) { return tablo[h] || h; }).join("").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function avAnahtar() { return "tentiforapp_av_" + ((veri.av && veri.av.sezon) || 1); }
function avIlerleme() { try { return Number(localStorage.getItem(avAnahtar())) || 0; } catch (e) { return 0; } }

function avCiz() {
  const alan = document.querySelector("#avAlan");
  const av = veri && veri.av;
  if (!alan || !av) { return; }
  const n = avIlerleme();
  const ip = av.ipuclari || [];
  const bitti = n >= ip.length;
  const yolda = ip.slice(0, n).map(function (x, i) {
    return '<li class="av-bulundu">' + kacir(x.yer) + " — çözüldü</li>";
  }).join("");
  let govde;
  if (!bitti) {
    const x = ip[n];
    govde = '<div class="kutu-y av-ipucu"><span class="oyun-etiket">' + (n + 1) + ". ipucu · " + kacir(x.yer) + "</span>" +
      "<p>" + kacir(x.soru) + "</p>" +
      (x.kyldo && typeof kyldoYaz === "function" ? '<div class="kp-kyldo">' + kyldoYaz(x.kyldo, 40) + "</div>" : "") +
      '<form data-av-form="' + n + '"><input class="kod-giris arac-giris" id="avCevap" autocomplete="off" placeholder="cevap">' +
      '<button class="dugme" type="submit">Dene</button> <button class="dugme dugme-sade" type="button" data-gez-git="' + kacir(x.git) + '">Oraya git</button></form>' +
      '<p class="pencere-durum" id="avDurum"></p></div>';
  } else {
    govde = '<div class="kutu-y av-ipucu"><span class="oyun-etiket">Son soru</span><p>' + kacir(av.son) + "</p>" +
      '<form data-av-son><input class="kod-giris arac-giris" id="avSon" autocomplete="off" placeholder="son cevap">' +
      '<button class="dugme" type="submit">Kaydet</button></form><p class="pencere-durum" id="avDurum"></p></div>';
  }
  alan.innerHTML = '<p class="oyun-giris"><b>' + kacir(av.ad) + ".</b> " + kacir(av.giris) + "</p>" +
    (yolda ? '<ol class="av-yol">' + yolda + "</ol>" : "") + govde +
    '<div id="avCozenler"></div>';
  avCozenlerCiz();
}

async function avCozenlerCiz() {
  const el = document.querySelector("#avCozenler");
  if (!el || typeof hesapEtkin !== "function" || !hesapEtkin()) { return; }
  if (typeof hesapIstemci === "undefined" || !hesapIstemci) {
    if (typeof hesapGorununce === "function") { hesapGorununce(el, avCozenlerCiz); }
    return;
  }
  const { data } = await hesapIstemci.from("av_cozenler").select("kullanici_adi, gorunen_ad, sira, zaman")
    .eq("sezon", veri.av.sezon).order("sira", { ascending: true }).limit(20);
  el.innerHTML = '<span class="oyun-etiket">Çözenler</span>' + (data && data.length
    ? '<ol class="av-cozen">' + data.map(function (x) {
        return '<li><a href="#/u/' + encodeURIComponent(x.kullanici_adi) + '">' + kacir(x.gorunen_ad || x.kullanici_adi) + "</a>" +
          ' <span class="oyun-not">' + new Date(x.zaman).toLocaleDateString("tr-TR") + "</span></li>";
      }).join("") + "</ol>"
    : '<p class="oyun-not">Henüz kimse çözmedi. İlk sen ol.</p>');
}

function avDene(n) {
  const g = document.querySelector("#avCevap");
  const d = document.querySelector("#avDurum");
  const x = veri.av.ipuclari[n];
  if (!g || !x) { return; }
  if (dogrulamaOzeti(avNormal(g.value)) === x.ozet) {
    try { localStorage.setItem(avAnahtar(), String(n + 1)); } catch (e) { /* yok */ }
    avCiz();
  } else if (d) { d.textContent = "Olmadı. İpucunun yerine bir daha bak."; d.className = "pencere-durum kotu"; }
}

async function avSon() {
  const g = document.querySelector("#avSon");
  const d = document.querySelector("#avDurum");
  const yaz = function (m, iyi) { if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };
  if (!g || !g.value.trim()) { return; }
  if (typeof hesapGerekli === "function") { await hesapGerekli(); }
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) {
    yaz("Son cevap sunucuda doğrulanır ve tabloya yazılır: önce giriş yap.");
    if (typeof hesapPencere === "function") { hesapPencere("giris"); }
    return;
  }
  const { data, error } = await hesapIstemci.rpc("av_coz", { p_sezon: veri.av.sezon, p_cevap: g.value });
  if (error) { yaz(typeof hesapHataMetni === "function" ? hesapHataMetni(error) : "Olmadı."); return; }
  const m = { tamam: "Doğru! Sen " + (data && data.sira) + ". çözensin.", zaten: "Bu sezonu zaten çözmüşsün.",
              yanlis: "Olmadı. Beş cevabın ilk harfleri…", sinir: "Bir saatte 20 deneme hakkın doldu.", giris: "Önce giriş yap." }[data && data.durum];
  yaz(m || "Olmadı.", data && (data.durum === "tamam" || data.durum === "zaten"));
  if (data && data.durum === "tamam") {
    if (typeof madalyaVer === "function") { madalyaVer("arsivAvcisi"); }
    avCozenlerCiz();
  }
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const h = e.target.closest("[data-hickirik]");
  if (h) {
    if (h.dataset.hickirik === "tanik") { hickirikTanik(); }
    else { const k = document.querySelector("#hickirik"); if (k) { k.remove(); } }
    return;
  }
  if (e.target.closest("[data-kp-paylas]")) {
    const a = (document.querySelector("#kpAdres") || {}).value;
    if (!a) { return; }
    if (navigator.share) { navigator.share({ title: "Bir kartpostalın var", url: a }).catch(function () {}); }
    else if (typeof panoyaKopyala === "function") { panoyaKopyala(a).then(function () { e.target.textContent = "Kopyalandı"; }); }
    return;
  }
  if (e.target.closest("[data-kp-onizle]")) {
    const a = (document.querySelector("#kpAdres") || {}).value || "";
    const i = a.indexOf("#/kartpostal/");
    if (i !== -1) { kartpostalAc(a.slice(i + 13)); }
    return;
  }
  if (e.target.closest("[data-kp-goster]")) {
    const m = document.querySelector("#kpMetin"); if (m) { m.hidden = false; }
    e.target.closest("[data-kp-goster]").remove();
  }
});

document.addEventListener("change", function (e) {
  if (e.target.name === "kpKilit") {
    const s = document.querySelector("#kpSifre");
    if (s) { s.hidden = e.target.value !== "sifre"; }
  }
});

document.addEventListener("submit", function (e) {
  if (e.target.closest("[data-kp-form]")) { e.preventDefault(); kartpostalOlustur(); return; }
  const c = e.target.closest("[data-kp-coz]");
  if (c) {
    e.preventDefault();
    const perde = document.querySelector("#perde");
    const kod = ((document.querySelector("#kpCozKod") || {}).value || "").trim();
    const hedef = document.querySelector("#kpMetin");
    let p = null, metin = "";
    try { p = JSON.parse(b64urlOku(perde.dataset.kp || "")); metin = sifreCoz(p.m, kod); } catch (x) { metin = ""; }
    if (metin.indexOf("TNTF:") === 0) { hedef.innerHTML = paragraf(metin.slice(5, 305)); c.remove(); }
    else { hedef.innerHTML = '<p class="pencere-durum kotu">Şifre tutmadı.</p>'; }
    return;
  }
  const a = e.target.closest("[data-av-form]");
  if (a) { e.preventDefault(); avDene(Number(a.dataset.avForm)); return; }
  if (e.target.closest("[data-av-son]")) { e.preventDefault(); avSon(); }
});

document.addEventListener("DOMContentLoaded", hickirikBaslat);

/* Profilde hıçkırık tanıklığı */
document.addEventListener("DOMContentLoaded", function () {
  if (typeof toplulukProfilEk !== "function") { return; }
  const eski = toplulukProfilEk;
  window.toplulukProfilEk = async function (p) {
    await eski.apply(this, arguments);
    const el = document.querySelector("#profilTopluluk .profil-topluluk");
    if (!el || typeof hesapIstemci === "undefined" || !hesapIstemci || !p || !p.kullanici_adi) { return; }
    const { data } = await hesapIstemci.from("hickirik_sayilari").select("tanik").eq("kullanici_adi", p.kullanici_adi).maybeSingle();
    if (data && Number(data.tanik)) {
      const s = document.createElement("div");
      s.className = "hesap-madalya";
      s.innerHTML = "<span>◑ " + Number(data.tanik) + " kez Hıçkırık tanığı</span>";
      el.appendChild(s);
    }
  };
});
