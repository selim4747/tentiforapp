/* TentiFor UX katmanı — mevcut hesap/eşitleme ve bildirim akışlarını yeniden kullanır. */
(function () {
  "use strict";

  var bildirimler = [];
  var bildirimTimer = 0;
  var sonHesap = null;

  function esc(value) {
    return typeof kacir === "function" ? kacir(String(value || "")) : String(value || "").replace(/[&<>\"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]); });
  }

  function uxBildirim(metin, tur) {
    var alan = document.querySelector("#tfUxBildirimler");
    if (!alan) {
      alan = document.createElement("div");
      alan.id = "tfUxBildirimler";
      alan.className = "tf-ux-bildirimler";
      alan.setAttribute("aria-live", "polite");
      alan.setAttribute("aria-atomic", "false");
      document.body.appendChild(alan);
    }
    var kayit = { id: Date.now() + Math.random(), metin: metin, tur: tur || "bilgi" };
    bildirimler.push(kayit);
    bildirimler = bildirimler.slice(-3);
    alan.innerHTML = bildirimler.map(function (item) {
      return '<div class="tf-ux-bildirim tf-ux-' + esc(item.tur) + '" role="status"><span aria-hidden="true">' + (item.tur === "hata" ? "!" : item.tur === "basari" ? "✓" : "i") + '</span><span>' + esc(item.metin) + '</span><button type="button" aria-label="Bildirimi kapat" data-tf-ux-kapat="' + item.id + '">×</button></div>';
    }).join("");
    clearTimeout(bildirimTimer);
    bildirimTimer = setTimeout(function () { bildirimler = []; if (alan) alan.innerHTML = ""; }, 5200);
  }
  window.tfUxBildirim = uxBildirim;

  function syncLabel() {
    var durum = typeof hesapEsitDurum !== "undefined" ? String(hesapEsitDurum || "") : "";
    if (navigator.onLine === false) return { sinif: "cevrimdisi", baslik: "Çevrimdışı", metin: "Değişikliklerin bu cihazda tutuluyor. Bağlantı gelince Şimdi eşitle düğmesini kullan." };
    if (/kaydedilemedi|okunamadı/i.test(durum)) return { sinif: "hata", baslik: "Eşitlenemedi", metin: "Bağlantıyı kontrol et ve tekrar dene." };
    if (/eşitleniyor|…/.test(durum)) return { sinif: "suruyor", baslik: "Eşitleniyor", metin: "İlerlemen güvenli biçimde hesabına aktarılıyor." };
    if (/başka cihaz|bekliyor/i.test(durum)) return { sinif: "yeni", baslik: "Başka cihazdan yeni ilerleme bulundu", metin: "Birleştirmek için tekrar eşitle." };
    return { sinif: "guncel", baslik: "Güncel", metin: "İlerlemen hesabınla eşit. İstersen şimdi yeniden kontrol edebilirsin." };
  }

  function syncCard() {
    var durum = syncLabel();
    var kayit = typeof hesapEsitKaydi === "function" ? hesapEsitKaydi() : null;
    var zaman = kayit && kayit.zaman ? new Date(kayit.zaman).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "Henüz eşitleme yok";
    return '<div class="tf-esitleme-karti tf-esitleme-' + durum.sinif + '" role="region" aria-label="İlerleme eşitleme durumu"><div><span class="oyun-etiket">İlerleme ve eşitleme</span><h3>' + durum.baslik + '</h3><p>' + durum.metin + '</p><small>Son eşitleme: ' + esc(zaman) + '</small></div><button type="button" class="dugme" data-hesap-esitle="1">' + (durum.sinif === "hata" || durum.sinif === "yeni" ? "Tekrar dene" : "Şimdi eşitle") + '</button></div>';
  }

  function detay(ad, acik, icerik) {
    var el = document.createElement("details");
    el.className = "tf-hesap-bolum";
    if (acik) el.open = true;
    el.innerHTML = '<summary><span>' + esc(ad) + '</span><span aria-hidden="true">⌄</span></summary><div class="tf-hesap-bolum-ic"></div>';
    el.querySelector(".tf-hesap-bolum-ic").appendChild(icerik);
    return el;
  }

  function hesapBolumleriniDuzenle() {
    var alan = document.querySelector("#hesapAlan .hesap-kutu");
    if (!alan || alan.dataset.tfUxHazir === "1" || !document.querySelector("#hesapAlan .hesap-kimlik")) return;
    alan.dataset.tfUxHazir = "1";
    var parcalar = Array.prototype.slice.call(alan.children);
    var profil = document.createElement("div");
    var profilSec = [".hesap-kimlik", ".hesap-duzen", ".hesap-tentifor", ".hesap-hakkinda"];
    parcalar.forEach(function (node) { if (profilSec.some(function (sel) { return node.matches && node.matches(sel); })) profil.appendChild(node); });
    parcalar.filter(function (node) { return node.matches && node.matches(".oyun-sira") && !node.querySelector("[data-hesap-cikis], [data-hesap-sil], [data-hesap-diger-cikis]"); }).forEach(function (node) { profil.appendChild(node); });
    var sync = document.createElement("div");
    [".hesap-esit", ".cihazlarim"].forEach(function (sel) { var node = alan.querySelector(sel); if (node) sync.appendChild(node); });
    var guvenlik = document.createElement("div");
    parcalar.filter(function (node) { return node.matches && node.matches(".oyun-sira") && node.querySelector("[data-hesap-cikis], [data-hesap-sil], [data-hesap-diger-cikis]"); }).forEach(function (node) { guvenlik.appendChild(node); });
    var gizlilik = document.createElement("div");
    gizlilik.innerHTML = '<p>Profil bilgilerin yalnızca seçtiğin herkese açık profil alanlarında görünür; oyun ve ilerleme kayıtların hesabınla eşitlenir.</p><p><b>Hesap silme</b> geri alınamaz. Silmeden önce Defterin bölümünden yerel yedeğini alabilirsin.</p><button type="button" class="dugme dugme-sade" data-gez-git="gizlilik">Gizlilik ayrıntıları</button>';
    Array.prototype.slice.call(alan.children).forEach(function (node) { if (node !== profil && node !== sync && node !== guvenlik && node.id !== "bildirimMerkezi" && node.id !== "hesapTopluluk") node.remove(); });
    var kart = document.createDocumentFragment();
    kart.appendChild(detay("Profilim", true, profil));
    kart.appendChild(detay("İlerleme ve eşitleme", true, sync));
    kart.appendChild(detay("Güvenlik", false, guvenlik));
    kart.appendChild(detay("Gizlilik ve veriler", false, gizlilik));
    alan.insertBefore(kart, alan.firstChild);
    var mevcut = alan.querySelector(".tf-esitleme-karti");
    if (!mevcut) alan.insertAdjacentHTML("afterbegin", syncCard());
  }

  function hesapUXCiz() {
    var alan = document.querySelector("#hesapAlan");
    if (!alan || !document.querySelector("#hesapAlan .hesap-kutu")) return;
    if (sonHesap !== alan.innerHTML) { sonHesap = alan.innerHTML; hesapBolumleriniDuzenle(); }
    var kart = alan.querySelector(".tf-esitleme-karti");
    var durum = syncLabel();
    if (kart && kart.dataset.tfUxDurum !== durum.sinif) {
      var yeniKart = document.createElement("div");
      yeniKart.innerHTML = syncCard();
      kart.replaceWith(yeniKart.firstElementChild);
    }
    kart = alan.querySelector(".tf-esitleme-karti");
    if (kart) kart.dataset.tfUxDurum = durum.sinif;
  }

  function baslangicRehberi() {
    var hero = document.querySelector("main#tepe > .hero");
    var girisli = typeof hesapKullanici !== "undefined" && !!hesapKullanici;
    if (!hero || !girisli || document.querySelector("#tfBaslangicRehberi")) return;
    var kutu = document.createElement("aside");
    kutu.id = "tfBaslangicRehberi";
    kutu.className = "tf-devam tf-baslangic-rehberi";
    kutu.setAttribute("aria-label", "Okumaya devam et");
    kutu.innerHTML = '<span class="oyun-etiket">Sana özel</span><b>Kaldığın yerden devam et</b><button class="dugme dugme-sade" data-gez-git="defter">Defterine dön</button>';
    hero.insertAdjacentElement("afterend", kutu);
  }

  function komutUX() {
    var palet = document.querySelector("#komutPaleti");
    if (!palet || palet.hidden || palet.querySelector(".tf-komut-ek")) return;
    var hedefler = [
      ["Hesap ayarları", "Hesap", "#/sen"],
      ["Gizlilik", "Ayarlar", "#/sen"],
      ["Okuma listem", "Defter", "#/defter"],
      ["Kayıtlı evrenlerim", "Defter", "#/defter"],
      ["Evren keşfi", "Keşif", "#/fan"],
      ["Yedekleme", "Defter", "#/defter"]
    ];
    if (typeof yoneticiAcik === "function" && yoneticiAcik()) hedefler.unshift(["E26 yönetim paneli", "Yönetici · yetkili", "#/yonetici"]);
    if (typeof panelAcik === "function" && panelAcik()) hedefler.push(["Yönetici paneli", "Yönetici", "#/yonetici"]);
    var liste = document.createElement("div");
    liste.className = "tf-komut-ek";
    liste.innerHTML = '<div class="tf-komut-baslik">Hızlı erişim</div>' + hedefler.map(function (item) { return '<button type="button" class="komut-oge" data-tf-komut-git="' + esc(item[2]) + '"><span class="komut-tur">' + esc(item[1]) + '</span><span class="komut-govde"><span class="komut-ad">' + esc(item[0]) + '</span></span></button>'; }).join("");
    var panel = palet.querySelector(".komut-panel");
    var ipucu = panel && panel.querySelector(".komut-ipucu");
    if (ipucu) panel.insertBefore(liste, ipucu); else if (panel) panel.appendChild(liste);
  }

  document.addEventListener("click", function (event) {
    var kapat = event.target.closest && event.target.closest("[data-tf-ux-kapat]");
    if (kapat) { bildirimler = bildirimler.filter(function (item) { return String(item.id) !== String(kapat.dataset.tfUxKapat); }); kapat.closest(".tf-ux-bildirim").remove(); return; }
    var git = event.target.closest && event.target.closest("[data-tf-komut-git]");
    if (git) { var palet = document.querySelector("#komutPaleti"); if (palet && typeof komutPaletiKapat === "function") komutPaletiKapat(function () { location.hash = git.dataset.tfKomutGit; }); else location.hash = git.dataset.tfKomutGit; return; }
    if (event.target.closest && event.target.closest("[data-hesap-diger-cikis]")) {
      setTimeout(function () { uxBildirim("Diğer cihazlardaki oturumların kapatıldı", "basari"); }, 0);
    }
  });
  window.addEventListener("hashchange", function () { setTimeout(function () { baslangicRehberi(); hesapUXCiz(); komutUX(); }, 80); });
  window.addEventListener("online", function () { hesapUXCiz(); });
  window.addEventListener("offline", function () { hesapUXCiz(); });
  window.addEventListener("tf-hesap-hazir", function () { setTimeout(function () { hesapUXCiz(); baslangicRehberi(); }, 30); });
  document.addEventListener("DOMContentLoaded", function () {
    baslangicRehberi();
    setTimeout(function () { hesapUXCiz(); komutUX(); }, 800);
    var observer = new MutationObserver(function () { hesapUXCiz(); komutUX(); });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
