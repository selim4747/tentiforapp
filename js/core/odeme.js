/* TentiforApp 4.0 · core/odeme — Yaratıcı Pro aylık üyelik. Ödeme PayTR'de: odeme-baslat (Edge Function) ödeme
   sayfası adresini verir; ödeme bitince PayTR, odeme-webhook'a bildirir ve üyelik 30 gün uzar. */

const TF4_PRO_FIYAT = "99 TL / ay";

function proPencereHtml(neden) {
  const pro = tf4ProMu();
  return '<div class="pencere pro-pencere" role="dialog" aria-modal="true" aria-label="Yaratıcı Pro">' +
    '<button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
    "<h3>Yaratıcı Pro</h3>" + (neden ? '<p class="pencere-alt">' + kacir(neden) + "</p>" : "") +
    '<div class="pro-katmanlar"><div class="pro-katman"><b>Ücretsiz</b><ul><li>1 evren taslağı</li><li>Bütün evrenleri gez, oku, oyna</li><li>Onaya 1 başvuru</li></ul></div>' +
      '<div class="pro-katman pro-one"><b>Yaratıcı Pro · ' + TF4_PRO_FIYAT + '</b><ul><li>Sınırsız evren</li><li>Onay kuyruğunda öncelik, aynı anda 5 başvuru</li><li>Reklamsız</li><li>Pro rozeti</li></ul></div></div>' +
    (pro ? '<p class="pencere-durum iyi">Pro üyesin' + (TF4.uyelik.bitis ? " · " + new Date(TF4.uyelik.bitis).toLocaleDateString("tr-TR") + " tarihine kadar" : "") + ".</p>"
      : '<label class="pro-onay"><input type="checkbox" id="proOnay"> <span><a href="#/yasal/mesafeli">Mesafeli satış sözleşmesini</a>, <a href="#/yasal/iade">iade koşullarını</a> ve <a href="#/yasal/kvkk">KVKK aydınlatma metnini</a> okudum, kabul ediyorum.</span></label>' +
        '<div class="oyun-sira"><button type="button" class="dugme" data-pro-ode>Pro’ya geç</button><button type="button" class="dugme dugme-sade" data-kod-ac>Kodum var</button></div>' +
        '<p class="oyun-not">Ödeme PayTR güvenli ödeme sayfasında yapılır; kart bilgin bu siteye gelmez. Üyelik 30 gün sürer, istersen yenilersin.</p>') +
    '<p class="pencere-durum" id="proDurum" role="status"></p></div>';
}

function proPencereAc(neden) {
  const p = document.querySelector("#perde");
  if (!p) { return; }
  p.innerHTML = proPencereHtml(neden); p.hidden = false;
  const k = p.querySelector("[data-pro-ode], .pencere-kapat"); if (k) { k.focus(); }
}

async function proyaGec() {
  const d = document.querySelector("#proDurum");
  const yaz = function (m, iyi) { if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };
  if (typeof hesapKullanici === "undefined" || !hesapKullanici) {
    yaz("Önce hesap aç ya da giriş yap: üyelik hesabına bağlanır.", false);
    const b = document.querySelector("#hesapBtn"); if (b) { setTimeout(function () { b.click(); }, 900); }
    return;
  }
  yaz("Ödeme sayfası hazırlanıyor…", true);
  try {
    const r = await tf4Fonksiyon("odeme-baslat", {});
    const p = document.querySelector("#perde");
    p.innerHTML = '<div class="pencere pro-odeme" role="dialog" aria-modal="true" aria-label="Ödeme"><button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
      '<iframe src="' + kacir(r.adres) + '" title="PayTR güvenli ödeme" class="pro-iframe" allow="payment"></iframe>' +
      '<p class="oyun-not">Ödeme bitince bu pencereyi kapat; üyeliğin birkaç saniye içinde açılır.</p></div>';
  } catch (e) { yaz(e.message, false); }
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-pro-ode], [data-pro-ac]");
  if (!b) { return; }
  if (b.hasAttribute("data-pro-ac")) { proPencereAc(b.getAttribute("data-pro-ac") || ""); return; }
  const onay = document.querySelector("#proOnay");
  if (onay && !onay.checked) { const d = document.querySelector("#proDurum"); if (d) { d.textContent = "Devam etmek için sözleşmeleri onayla."; d.className = "pencere-durum kotu"; } onay.focus(); return; }
  proyaGec();
});

/* 4.2: yasal sayfalar #/yasal/mesafeli | iade | kvkk — metinler veri.json "yasal" alanından (yönetici panelden ekler) */
const TF4_YASAL = { mesafeli: "Mesafeli satış sözleşmesi", iade: "İptal ve iade koşulları", kvkk: "KVKK aydınlatma metni" };
function yasalSayfaCiz(tur) {
  const p = document.querySelector("#perde");
  if (!p || !TF4_YASAL[tur]) { return; }
  const metin = ((typeof veri !== "undefined" && veri && veri.yasal) || {})[tur];
  p.innerHTML = '<div class="pencere yasal-pencere" role="dialog" aria-modal="true" aria-label="' + kacir(TF4_YASAL[tur]) + '"><button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>' +
    "<h3>" + kacir(TF4_YASAL[tur]) + "</h3>" +
    (metin ? '<div class="yasal-metin">' + String(metin).split(/\n{2,}/).map(function (x) { return "<p>" + kacir(x).replace(/\n/g, "<br>") + "</p>"; }).join("") + "</div>"
      : '<p class="oyun-not">Bu metin henüz eklenmedi.</p>') +
    '<p class="oyun-not">' + Object.keys(TF4_YASAL).map(function (k) { return '<a href="#/yasal/' + k + '">' + kacir(TF4_YASAL[k]) + "</a>"; }).join(" · ") + "</p></div>";
  p.hidden = false;
}
/* ödemeden dönüş: #/sen?odeme=tamam */
function odemeDonusBak() {
  if (!/odeme=tamam/.test(location.href)) { return; }
  setTimeout(function () {
    tf4AbonelikYukle(true).then(function (u) { if (typeof eckaBildir === "function") { eckaBildir(u.pro ? "Yaratıcı Pro açıldı ✓" : "Ödeme alındıysa üyeliğin birkaç dakika içinde açılır."); } });
  }, 1500);
}
window.addEventListener("hashchange", odemeDonusBak);
document.addEventListener("tf-veri-hazir", odemeDonusBak);

/* 4.1: Sen sayfasında Yaratıcı Pro kartı: üyelik durumu ve Pro'ya geç düğmesi (her zaman ulaşılabilir) */
function proKartiCiz() {
  const a = document.querySelector("#proAlan");
  if (!a) { return; }
  const pro = tf4ProMu();
  a.innerHTML = '<div class="kutu-y pro-kart"><b>' + (pro ? "Yaratıcı Pro üyesisin ✓" : "Yaratıcı Pro") + "</b>" +
    '<p class="oyun-not">' + (pro ? "Sınırsız evren, kuyrukta öncelik, reklamsız" + (TF4.uyelik.bitis ? " · " + new Date(TF4.uyelik.bitis).toLocaleDateString("tr-TR") + " tarihine kadar" : "") + "."
      : "Sınırsız evren, onay kuyruğunda öncelik, reklamsız ve Pro rozeti · " + TF4_PRO_FIYAT + ".") + "</p>" +
    '<div class="oyun-sira"><button type="button" class="dugme' + (pro ? " dugme-sade" : "") + '" data-pro-ac>' + (pro ? "Üyeliğini gör" : "Pro’ya geç") + "</button></div></div>";
}
document.addEventListener("tf-veri-hazir", function () { setTimeout(proKartiCiz, 0); });
document.addEventListener("tf4-uyelik", proKartiCiz);
