/* Yeni bölüm bildirimi (Web Push).

   Ziyaretçi: Roman bölümündeki "Bildirim al" düğmesiyle izin verir; tarayıcının itme aboneliği
   Supabase'e (bildirim_abonelikleri) yazılır. Hesap gerekmez.
   Yönetici: panelde Bakım → Bildirim. Anahtar çifti burada, tarayıcının içinde üretilir;
   gizli anahtar sayfadan hiç çıkmaz, yöneticinin kopyalayıp Supabase Secrets'a yapıştırması gerekir.
   Gönderim supabase/functions/bildirim-gonder Edge Function'ıyla yapılır.

   Açık anahtar herkese açıktır ve veri.bildirim.acikAnahtar'da durur (Kaydet ile yayına çıkar). */

const BILDIRIM_ANAHTAR = "tentiforapp_bildirim";   /* bu cihaz abone mi — hesapla eşitlenmez */

function b64url(bayt) {
  let s = "";
  new Uint8Array(bayt).forEach(function (b) { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlBayt(metin) {
  const s = String(metin).replace(/-/g, "+").replace(/_/g, "/");
  const ham = atob(s + "===".slice((s.length + 3) % 4));
  const b = new Uint8Array(ham.length);
  for (let i = 0; i < ham.length; i++) { b[i] = ham.charCodeAt(i); }
  return b;
}

function bildirimAcikAnahtar() {
  const a = veri && veri.bildirim && veri.bildirim.acikAnahtar;
  return a && /^[A-Za-z0-9_-]{80,100}$/.test(a) ? a : "";
}

function bildirimDestek() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone/iPad: bildirim yalnızca ana ekrana eklenmiş uygulamada çalışır. */
function bildirimIosTarayici() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const kurulu = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  return ios && !kurulu;
}

function bildirimAboneMi() { return kayitOku(BILDIRIM_ANAHTAR) === "1"; }

async function bildirimKaydi() {
  return navigator.serviceWorker.ready;
}

/* ==================== ziyaretçi ==================== */

function bildirimKutusuCiz() {
  const alan = document.querySelector("#bildirimAlan");
  if (!alan) { return; }
  if (!bildirimAcikAnahtar()) { alan.innerHTML = ""; return; }

  let govde;
  if (bildirimIosTarayici()) {
    govde = '<p class="oyun-not">Yeni bölüm çıkınca haber almak için önce siteyi ana ekrana ekle (Paylaş → Ana Ekrana Ekle), sonra oradan açıp buraya dön.</p>';
  } else if (!bildirimDestek()) {
    govde = '<p class="oyun-not">Bu tarayıcı bildirim desteklemiyor.</p>';
  } else if (Notification.permission === "denied") {
    govde = '<p class="oyun-not">Bildirimleri bu site için kapatmışsın. Açmak için tarayıcının site ayarlarından izin ver.</p>';
  } else if (bildirimAboneMi()) {
    govde = '<p class="oyun-not">Yeni bölüm çıkınca bu cihaza bildirim gelecek.</p>' +
      '<button class="dugme dugme-sade" data-bildirim="kapat">Bildirimleri kapat</button>';
  } else {
    govde = '<p class="oyun-not">Yeni bölüm çıktığında telefonuna ya da bilgisayarına haber gelsin. Hesap gerekmez; istediğin zaman kapatırsın.</p>' +
      '<button class="dugme" data-bildirim="ac">Yeni bölümde haber ver</button>';
  }
  alan.innerHTML = '<div class="bildirim-kutu"><span class="oyun-etiket">Bildirim</span>' + govde +
    '<p class="pencere-durum" id="bildirimDurum" role="status"></p></div>';
}

function bildirimDurum(m, iyi) {
  const d = document.querySelector("#bildirimDurum");
  if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); }
}

async function bildirimAboneOl() {
  /* izin isteği tıklamanın hemen içinde olmalı: önce o */
  const izin = await Notification.requestPermission();
  if (izin !== "granted") { bildirimKutusuCiz(); bildirimDurum("İzin verilmedi", false); return false; }
  try {
    const kayit = await bildirimKaydi();
    let abonelik = await kayit.pushManager.getSubscription();
    if (!abonelik) {
      abonelik = await kayit.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlBayt(bildirimAcikAnahtar()) });
    }
    const j = abonelik.toJSON();
    if (typeof hesapGerekli === "function") { await hesapGerekli(); }
    const { data, error } = await hesapIstemci.rpc("bildirim_abone_ol", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    if (error || !data || data.durum !== "tamam") {
      bildirimDurum(error ? hesapHataMetni(error) : "Kaydedilemedi (" + ((data && data.durum) || "?") + ")", false);
      return false;
    }
    kayitYaz(BILDIRIM_ANAHTAR, "1");
    bildirimKutusuCiz();
    bildirimDurum("Tamam — yeni bölümde haber vereceğiz", true);
    return true;
  } catch (e) {
    bildirimDurum("Abone olunamadı: " + ((e && e.message) || e), false);
    return false;
  }
}

async function bildirimKapat() {
  try {
    const kayit = await bildirimKaydi();
    const abonelik = await kayit.pushManager.getSubscription();
    if (abonelik) {
      const uc = abonelik.endpoint;
      await abonelik.unsubscribe();
      if (typeof hesapGerekli === "function") { await hesapGerekli(); }
      await hesapIstemci.rpc("bildirim_abonelik_sil", { p_endpoint: uc });
    }
  } catch (_) { /* yerelde kapatmak yeter; sunucudaki kayıt ilk gönderimde 410 ile silinir */ }
  kayitYaz(BILDIRIM_ANAHTAR, "0");
  bildirimKutusuCiz();
  bildirimDurum("Bildirimler kapatıldı", true);
}

/* ==================== yönetici paneli ==================== */

let bildirimUretilen = null;   /* { acik, gizli } — yalnızca bu sayfa açıkken bellekte */

/** P-256 anahtar çifti: açık 65 bayt (ham), gizli 32 bayt — web-push'un beklediği biçim. */
async function bildirimAnahtarUret() {
  const cift = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const acik = await crypto.subtle.exportKey("raw", cift.publicKey);
  const jwk = await crypto.subtle.exportKey("jwk", cift.privateKey);
  return { acik: b64url(acik), gizli: jwk.d };
}

function yoneticiBildirim() {
  if (!(typeof yoneticiAcik === "function" && yoneticiAcik())) { return '<p class="oyun-not">Bu sekme yalnızca tam yöneticiye açık.</p>'; }
  setTimeout(bildirimSayisiYukle, 0);
  const acik = bildirimAcikAnahtar();
  const son = ((veri.roman && veri.roman.bolumler) || []).slice(-1)[0];
  return '<div class="kutu-y">' +
      "<label>Kurulum</label>" +
      '<p class="oyun-not">Adımlar: 1) Supabase SQL Editor\'da kurulum.sql\'i çalıştır. 2) Aşağıdan anahtar üret. ' +
        "3) Gizli ve açık anahtarı Supabase → Edge Functions → Secrets'a VAPID_PRIVATE_KEY ve VAPID_PUBLIC_KEY adıyla ekle. " +
        "4) supabase/functions/bildirim-gonder/index.ts dosyasını \"bildirim-gonder\" adıyla Edge Function olarak yayınla. " +
        "5) Burada Kaydet sekmesinden siteyi yayınla: ziyaretçilere \"Yeni bölümde haber ver\" düğmesi çıkar.</p>" +
      '<p class="oyun-not">Açık anahtar: <b>' + (acik ? "tanımlı" : "tanımsız") + '</b> · Abone sayısı: <b id="yBildirimSayi">…</b></p>' +
      (bildirimUretilen
        ? '<div class="y-bildirim-anahtar"><label>VAPID_PUBLIC_KEY (açık — sitede de durur)</label>' +
            '<input class="kod-giris arac-giris" readonly value="' + kacir(bildirimUretilen.acik) + '" id="yBildirimAcik">' +
            '<button class="dugme dugme-sade" data-y-bildirim-kopyala="yBildirimAcik">Kopyala</button>' +
            "<label>VAPID_PRIVATE_KEY (gizli — yalnızca Supabase Secrets'a)</label>" +
            '<input class="kod-giris arac-giris" readonly value="' + kacir(bildirimUretilen.gizli) + '" id="yBildirimGizli">' +
            '<button class="dugme dugme-sade" data-y-bildirim-kopyala="yBildirimGizli">Kopyala</button>' +
            '<p class="oyun-not kotu">Gizli anahtar hiçbir yere kaydedilmedi; bu sayfayı kapatınca kaybolur. Şimdi Supabase\'e yapıştır. ' +
              "Sitenin koduna, veri.json'a ya da bir sohbete yazma.</p></div>"
        : "") +
      '<button class="dugme' + (acik ? " dugme-sade" : "") + '" data-y-bildirim-uret>' + (acik ? "Yeni anahtar çifti üret (eski aboneler düşer)" : "Anahtar çifti üret") + "</button>" +
    "</div>" +
    '<div class="kutu-y">' +
      "<label>Bildirim gönder</label>" +
      '<input class="kod-giris arac-giris" id="yBildirimBaslik" maxlength="80" value="' + kacir(son ? "Yeni bölüm: " + son.baslik : "Yeni bölüm yayında") + '">' +
      '<textarea class="kod-giris arac-giris" id="yBildirimMetin" rows="2" maxlength="200">' + kacir(son && son.ozet ? son.ozet : "") + "</textarea>" +
      '<label>Açılacak yer</label>' +
      '<input class="kod-giris arac-giris" id="yBildirimAdres" value="/#/roman" placeholder="/#/roman">' +
      '<button class="dugme" data-y-bildirim-gonder' + (acik ? "" : " disabled") + ">Herkese gönder</button>" +
      '<p class="oyun-not" id="yBildirimSonuc">' + (acik ? "" : "Önce anahtarı üret ve Kaydet ile yayınla.") + "</p>" +
    "</div>";
}

async function bildirimSayisiYukle() {
  const el = document.querySelector("#yBildirimSayi");
  if (!el) { return; }
  if (typeof hesapGerekli === "function" && (typeof hesapIstemci === "undefined" || !hesapIstemci)) { try { await hesapGerekli(); } catch (_) { /* aşağıda */ } }
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) { el.textContent = "giriş yapınca görünür"; return; }
  const { data, error } = await hesapIstemci.rpc("bildirim_sayisi");
  el.textContent = error ? "—" : String(data);
}

async function bildirimGonder() {
  const sonuc = document.querySelector("#yBildirimSonuc");
  const al = function (id) { return ((document.querySelector(id) || {}).value || "").trim(); };
  const govde = { baslik: al("#yBildirimBaslik"), metin: al("#yBildirimMetin"), adres: al("#yBildirimAdres") || "/" };
  if (!govde.baslik) { sonuc.textContent = "Başlık boş olamaz"; return; }
  if (typeof hesapGerekli === "function") { try { await hesapGerekli(); } catch (_) { /* aşağıda */ } }
  if (typeof hesapIstemci === "undefined" || !hesapIstemci || !hesapKullanici) { sonuc.textContent = "Önce yönetici hesabınla giriş yap"; return; }
  sonuc.textContent = "Gönderiliyor…";
  const { data, error } = await hesapIstemci.functions.invoke("bildirim-gonder", { body: govde });
  if (error) {
    let ayrinti = "";
    try { const j = error.context && await error.context.json(); ayrinti = j && (j.mesaj || j.durum); } catch (_) { /* gövde yok */ }
    sonuc.textContent = "Gönderilemedi: " + (ayrinti === "yetki" ? "bu hesap tam yönetici değil" : (ayrinti || error.message)) +
      (/not found|404/i.test(error.message || "") ? " — Edge Function \"bildirim-gonder\" yayınlanmamış olabilir" : "");
    return;
  }
  sonuc.textContent = data && data.durum === "tamam"
    ? data.gonderilen + " cihaza gönderildi" + (data.silinen ? " · " + data.silinen + " eski abonelik silindi" : "") + (data.hata ? " · " + data.hata + " hata" : "")
    : "Gönderilemedi: " + ((data && (data.mesaj || data.durum)) || "?");
  bildirimSayisiYukle();
}

/* ==================== olaylar ==================== */

document.addEventListener("click", async function (e) {
  const h = e.target.closest("[data-bildirim], [data-y-bildirim-uret], [data-y-bildirim-gonder], [data-y-bildirim-kopyala]");
  if (!h) { return; }
  if (h.dataset.bildirim === "ac") { h.disabled = true; await bildirimAboneOl(); }
  else if (h.dataset.bildirim === "kapat") { await bildirimKapat(); }
  else if (h.hasAttribute("data-y-bildirim-uret")) {
    bildirimUretilen = await bildirimAnahtarUret();
    if (!veri.bildirim) { veri.bildirim = {}; }
    veri.bildirim.acikAnahtar = bildirimUretilen.acik;
    yoneticiCiz();
    yoneticiDurum("Anahtar üretildi. Gizli anahtarı Supabase'e yapıştır, sonra Kaydet ile yayınla.", true);
  }
  else if (h.hasAttribute("data-y-bildirim-gonder")) { await bildirimGonder(); }
  else if (h.dataset.yBildirimKopyala) {
    const el = document.querySelector("#" + h.dataset.yBildirimKopyala);
    if (el && typeof panoyaKopyala === "function") { panoyaKopyala(el.value).then(function () { h.textContent = "Kopyalandı"; }); }
  }
});
