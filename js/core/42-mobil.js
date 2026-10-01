/* Mobil menü — sade, tek katmanlı sürüm.
   Alt navigasyon ve açılır panel aynı denetleyiciden çizilir. Panel açıldığında
   doğrudan body sonuna eklenir; arka planı yalnızca bu panel yakalar. */
const ALT_MENU = [["arsiv", "Ana sayfa", "▤"], ["okuma", "Oku", "▧"], ["oyunlar", "Oyna", "▩"], ["evren", "Evren", "◎"]];
function uygulamaKurulu() {
  return !!((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true);
}
function altMenuCiz() {
  let nav = document.getElementById("altMenu");
  if (!nav) {
    nav = document.createElement("nav");
    nav.id = "altMenu";
    nav.className = "alt-menu";
    nav.setAttribute("aria-label", "Hızlı gezinme");
    document.body.appendChild(nav);
  }
  const aktif = typeof aktifSayfa !== "undefined" ? aktifSayfa : "";
  const acik = !!document.getElementById("mobilMenu");
  const hedefler = ALT_MENU.map(function (oge) {
    const hedef = (oge[0] === "okuma" || oge[0] === "oyunlar") && typeof aktifEvrenHedefi === "function" ? aktifEvrenHedefi(oge[0] === "okuma" ? "oku" : "oyna") : null;
    return { oge: oge, hedef: hedef };
  });
  nav.innerHTML = hedefler.map(function (item) {
    const oge = item.oge;
    if (oge[0] === "evren") {
      return '<button type="button" class="alt-oge" data-evren-sec aria-haspopup="dialog"><span class="alt-ikon" aria-hidden="true">' + oge[2] + '</span><span>' + kacir(oge[1]) + '</span></button>';
    }
    if (item.hedef) {
      return '<a class="alt-oge" href="' + kacir(item.hedef.git) + '" data-alt-hedef="' + (oge[0] === "okuma" ? "oku" : "oyna") + '"><span class="alt-ikon" aria-hidden="true">' + oge[2] + '</span><span>' + kacir(oge[1]) + '</span></a>';
    }
    return '<a class="alt-oge' + (aktif === oge[0] ? " bu" : "") + '" href="#/' + oge[0] + '"' + (aktif === oge[0] ? ' aria-current="page"' : "") + '><span class="alt-ikon" aria-hidden="true">' + oge[2] + '</span><span>' + kacir(oge[1]) + '</span></a>';
  }).join("") + '<button type="button" class="alt-oge' + (acik ? " bu" : "") + '" data-mobil-menu aria-haspopup="dialog" aria-expanded="' + acik + '"><span class="alt-ikon" aria-hidden="true">☰</span><span>Menü</span></button>';
}
function mobilMenuKapat() {
  const panel = document.getElementById("mobilMenu");
  if (panel) panel.remove();
  document.documentElement.classList.remove("menu-acik");
  altMenuCiz();
}
function mobilMenuCiz() {
  const root = document.getElementById("mobilMenu");
  if (!root) return;
  const aktif = typeof aktifSayfa !== "undefined" ? aktifSayfa : "";
  const sayfalar = typeof GEZINME !== "undefined" ? GEZINME.filter(function (x) { return ["tomye", "claude", "eterya"].indexOf(x.id) === -1; }) : [];
  root.innerHTML = '<div class="mobil-menu" role="dialog" aria-modal="true" aria-label="Menü">' +
    '<div class="mm-ust"><b>Menü</b><button type="button" class="pencere-kapat" data-mobil-kapat aria-label="Kapat">✕</button></div>' +
    '<button type="button" class="mm-ara" data-mobil-ara><span aria-hidden="true">⌕</span> Arşivde ara…</button>' +
    '<div class="mm-sayfalar">' + sayfalar.map(function (x) {
      return '<a class="mm-sayfa' + (x.id === aktif ? " bu" : "") + '" href="#/' + x.id + '"' + (x.id === aktif ? ' aria-current="page"' : "") + '><span class="mm-ikon" aria-hidden="true">' + kacir(x.ikon || "▪") + '</span><span class="mm-ad">' + kacir(x.ad) + '</span></a>';
    }).join("") + '</div>' +
    '<div class="mm-eylemler"><button type="button" class="mm-eylem" data-evren-sec>◎ Evrenler</button><button type="button" class="mm-eylem" data-uyelik-ac>◇ Planlar</button><button type="button" class="mm-eylem" data-mobil-eylem="icindekiler">☰ İçindekiler</button><button type="button" class="mm-eylem" data-mobil-eylem="tema">☀ Gece modu</button><button type="button" class="mm-eylem" data-mobil-eylem="rastgele">⤳ Rastgele keşif</button><button type="button" class="mm-eylem" data-mobil-eylem="kod">⌗ Kod gir</button><button type="button" class="mm-eylem" data-mobil-eylem="dosya">⇪ Dosya aç</button><button type="button" class="mm-eylem" data-mobil-eylem="moderasyon">🛡 Moderasyon Paneli</button></div>' +
    '</div>';
}
function mobilMenuAc() {
  if (document.getElementById("mobilMenu")) { mobilMenuKapat(); return; }
  const root = document.createElement("div");
  root.id = "mobilMenu";
  root.className = "mobil-menu-katman";
  root.addEventListener("click", function (event) {
    if (event.target === root) mobilMenuKapat();
  });
  document.body.appendChild(root);
  mobilMenuCiz();
  document.documentElement.classList.add("menu-acik");
  altMenuCiz();
  const search = root.querySelector("[data-mobil-ara]");
  if (search) search.focus({ preventScroll: true });
}
function mobilMenuEylemi(oge) {
  if (oge === "tema") { if (typeof temaDegistir === "function") temaDegistir(); mobilMenuCiz(); return; }
  mobilMenuKapat();
  if (oge === "icindekiler" && typeof icindekilerAc === "function") icindekilerAc();
  else if (oge === "rastgele" && typeof rastgeleKesif === "function") rastgeleKesif();
  else if (oge === "kod") { const btn = document.getElementById("btnKod"); if (btn) btn.click(); }
  else if (oge === "dosya") location.hash = "#/fanAc";
  else if (oge === "moderasyon") location.hash = "#/moderasyon";
}
document.addEventListener("click", function (event) {
  const target = event.target.closest && event.target.closest("[data-evren-magaza]");
  if (target) { event.preventDefault(); if (typeof evrenMagazaAc === "function") evrenMagazaAc(); }
});
document.addEventListener("click", function (event) {
  const target = event.target.closest && event.target.closest("[data-alt-hedef]");
  if (!target || typeof aktifEvrenHedefi !== "function") return;
  const hedef = aktifEvrenHedefi(target.getAttribute("data-alt-hedef"));
  if (!hedef) return;
  event.preventDefault();
  if (hedef.ce) { ceSekme = hedef.ce; location.hash = hedef.git; }
  else { evrenSonrakiSekme = hedef.sekme; location.hash = hedef.git; }
});
document.addEventListener("click", function (event) {
  const target = event.target.closest && event.target.closest("[data-mobil-menu], [data-mobil-kapat], [data-mobil-ara], [data-mobil-eylem], [data-evren-sec], [data-uyelik-ac], .mm-sayfa");
  if (!target) return;
  if (target.hasAttribute("data-mobil-menu")) { event.preventDefault(); mobilMenuAc(); return; }
  if (target.hasAttribute("data-mobil-kapat")) { event.preventDefault(); mobilMenuKapat(); return; }
  if (target.hasAttribute("data-mobil-ara")) { event.preventDefault(); mobilMenuKapat(); if (typeof komutPaletiAc === "function") komutPaletiAc(); return; }
  if (target.hasAttribute("data-evren-sec") || target.hasAttribute("data-uyelik-ac")) { mobilMenuKapat(); return; }
  if (target.classList.contains("mm-sayfa")) { event.preventDefault(); const href = target.getAttribute("href"); mobilMenuKapat(); if (location.hash !== href) location.hash = href; return; }
  if (target.hasAttribute("data-mobil-eylem")) { event.preventDefault(); mobilMenuEylemi(target.getAttribute("data-mobil-eylem")); }
});
document.addEventListener("keydown", function (event) { if (event.key === "Escape" && document.getElementById("mobilMenu")) mobilMenuKapat(); });
const APK_BILGI={durum:"",surum:"",boyut:0,kod:""};function apkBilgiYukle(){APK_BILGI.durum="yukleniyor";const k="tf4_apk_bilgi";let eski=null;try{eski=JSON.parse(localStorage.getItem(k)||"null")}catch{}const c=typeof AbortController==="function"?new AbortController():null;let z;const f=fetch("/uygulama/indir/apk.json?offline=1",Object.assign({cache:"no-store"},c?{signal:c.signal}:{}));const zaman=new Promise(function(_,r){z=setTimeout(function(){c&&c.abort();r(new Error("metadata-timeout"))},3500)});Promise.race([f,zaman]).then(function(e){clearTimeout(z);return e.ok?e.json():null}).then(function(e){if(!e||!e.kod)throw new Error("metadata-yok");Object.assign(APK_BILGI,{durum:"var",surum:String(e.surum||""),boyut:Number(e.boyut)||0,kod:String(e.kod)});try{localStorage.setItem(k,JSON.stringify(e))}catch{}mobilMenuCiz()}).catch(function(){clearTimeout(z);if(eski&&eski.kod)Object.assign(APK_BILGI,{durum:"var",surum:String(eski.surum||""),boyut:Number(eski.boyut)||0,kod:String(eski.kod)});else APK_BILGI.durum="yok";mobilMenuCiz()})}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault(),kurulumOlayi=e,mobilMenuCiz()}),window.addEventListener("appinstalled",function(){kurulumOlayi=null,mobilMenuCiz()});async function uygulamaYukle(){if(!kurulumOlayi)return;const e=kurulumOlayi;kurulumOlayi=null;try{e.prompt(),await e.userChoice}catch{}mobilMenuCiz()}const PAYLASIM_ONBELLEK="tf-paylasim";async function paylasilanDosyaAc(){if(rota().indexOf("#/fan/paylasim")===0&&(history.replaceState(null,"",rotadanYol("#/fanAc")+location.search),typeof sayfaYonlendir=="function"&&sayfaYonlendir(),"caches"in window))try{const e=await caches.open(PAYLASIM_ONBELLEK),a=await e.match("/__paylasilan");if(!a)return;await e.delete("/__paylasilan");const t=await a.text(),n=fanMetindenEser(t);fanAcilanEkle(n),typeof fanAcCiz=="function"&&fanAcCiz(),fanPencere(n,"acilan")}catch(e){const a=document.querySelector("#fanAcDurum");a&&(a.textContent="Paylaşılan dosya açılamadı: "+(e&&e.message||e),a.className="pencere-durum kotu")}}"launchQueue"in window&&window.launchQueue&&window.launchQueue.setConsumer&&window.launchQueue.setConsumer(function(e){!e||!e.files||!e.files.length||e.files[0].getFile().then(function(a){typeof sayfayaGit=="function"&&sayfayaGit("fan"),typeof fanDosyaAc=="function"&&fanDosyaAc(a)}).catch(function(){})}),window.addEventListener("hashchange", function () { if (document.getElementById("mobilMenu")) mobilMenuKapat(); });
if(typeof kabukEklenti==="function"){const _ln=kabukEklenti("LocalNotifications");_ln&&_ln.addListener&&_ln.addListener("localNotificationActionPerformed",function(e){const a=e&&e.notification&&e.notification.extra&&e.notification.extra.adres||"#/sen";if(/^#\//.test(a))location.hash=a})}
document.addEventListener("DOMContentLoaded",function(){try{altMenuCiz()}catch{}if(rota().indexOf("#/fan/paylasim")===0){const e=setInterval(function(){typeof veri!="undefined"&&veri&&(clearInterval(e),paylasilanDosyaAc())},100);setTimeout(function(){clearInterval(e)},15e3)}});function baglantiDurumuCiz(){let e=document.querySelector("#cevrimdisi");if(navigator.onLine!==!1){e&&e.remove();return}e||(e=document.createElement("div"),e.id="cevrimdisi",e.className="cevrimdisi",e.setAttribute("role","status"),e.textContent="Çevrimdışısın · okuma, oyunlar ve kendi evrenlerin çalışır; kazandıkların cihazda durur, bağlantı gelince hesabına eşitlenir.",document.body.appendChild(e))}window.addEventListener("offline",baglantiDurumuCiz),window.addEventListener("online",function(){baglantiDurumuCiz(),typeof eckaBildir=="function"&&eckaBildir("Bağlantı geri geldi"),typeof hesapEsitle=="function"&&typeof hesapKullanici!="undefined"&&hesapKullanici&&hesapEsitle()}),document.addEventListener("DOMContentLoaded",baglantiDurumuCiz);const SURUM_ANAHTAR="tentiforapp_gorulen_surum";function surumNotuCiz(){const e=document.querySelector("#surumNotuAlan");if(!e||typeof veri=="undefined"||!veri||!veri.surum)return;const a=kayitOku(SURUM_ANAHTAR);if(!a){kayitYaz(SURUM_ANAHTAR,veri.surum),e.innerHTML="";return}if(a===veri.surum){e.innerHTML="";return}const t=(veri.degisiklik||[])[0];if(!t){e.innerHTML="";return}e.innerHTML='<div class="surum-notu" role="region" aria-label="Neler yeni"><div class="surum-ust"><span class="oyun-etiket">Neler yeni · '+kacir(t.surum)+'</span><button class="pencere-kapat" data-surum-kapat aria-label="Kapat">✕</button></div><ul>'+(t.maddeler||[]).slice(0,6).map(function(n){return"<li>"+kacir(n)+"</li>"}).join("")+'</ul><button class="dugme dugme-sade" data-gez-git="degisiklik">Bütün değişiklikler</button></div>'}document.addEventListener("click",function(e){if(e.target.closest("[data-surum-kapat], .surum-notu [data-gez-git]")){kayitYaz(SURUM_ANAHTAR,veri.surum);const a=document.querySelector("#surumNotuAlan");a&&(a.innerHTML="")}});

document.addEventListener("DOMContentLoaded", function () { altMenuCiz(); });
