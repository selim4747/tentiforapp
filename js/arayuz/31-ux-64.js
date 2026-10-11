/* TentiFor 6.4 — keşif, kişisel merkez, güvenli topluluk ve offline yönetimi. */
(function () {
  "use strict";
  var PREF = "tentiforapp_64_tercihler";
  var ONBOARD = "tentiforapp_64_onboarding";
  var saved = null;

  function esc(v) { return typeof kacir === "function" ? kacir(String(v == null ? "" : v)) : String(v == null ? "" : v).replace(/[&<>\"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]); }); }
  function read(key, fallback) { try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (_) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function notify(text, type) { if (typeof tfUxBildirim === "function") tfUxBildirim(text, type || "bilgi"); else if (typeof eckaBildir === "function") eckaBildir(text); }
  function loggedIn() { return typeof hesapKullanici !== "undefined" && !!hesapKullanici; }
  function go(hash) { location.hash = hash; }

  function localProgress() {
    var result = [];
    try {
      Object.keys(localStorage).forEach(function (key) {
        if (!/okuma|okl|ilerleme|defter/i.test(key)) return;
        var value = read(key, null);
        if (!value || typeof value !== "object") return;
        Object.keys(value).forEach(function (id) {
          var item = value[id];
          if (item && (item.git || item.bolum || item.ad)) result.push({ id: id, ad: item.ad || id, git: item.git || "#/defter", sira: item.sira, toplam: item.toplam, zaman: item.zaman || 0, bitti: item.bitti });
        });
      });
    } catch (_) {}
    return result.sort(function (a, b) { return Number(b.zaman) - Number(a.zaman); }).filter(function (item, i, all) { return all.findIndex(function (x) { return x.id === item.id; }) === i; }).slice(0, 6);
  }

  function dashboard() {
    var host = document.querySelector("#kesif");
    if (!host || document.querySelector("#tf64Dashboard")) return;
    var progress = localProgress();
    var first = progress.find(function (item) { return !item.bitti; }) || progress[0];
    var greeting = loggedIn() ? "Bugün arşivde sana ait bir yol var." : "Arşive giriş için kısa bir yol seç.";
    var continueHtml = first ? '<article class="tf64-dash-card tf64-primary"><span class="oyun-etiket">Kaldığın yerden</span><h3>' + esc(first.ad) + '</h3><p>' + (first.toplam ? esc(String((Number(first.sira || 0) + 1) + " / " + first.toplam + " bölüm")) : "Son ziyaretin burada kaldı.") + '</p><button class="dugme" data-tf64-git="' + esc(first.git) + '">Devam et</button></article>' : '<article class="tf64-dash-card tf64-primary"><span class="oyun-etiket">İlk adım</span><h3>Bir kayıt seç ve iz bırak</h3><p>Okuma listene bir evren ekle; TentiFor sonraki gelişinde nerede kaldığını hatırlar.</p><button class="dugme" data-tf64-git="#/okuma">Okuma yollarını aç</button></article>';
    var day = new Date().getDate();
    var suggestions = [
      ["Rastgele keşif", "Arşivde daha önce görmediğin bir kayda git.", "#/arsiv"],
      ["Kendi evrenin", "Bir harita, kişi veya kural ile başla.", "#/atolye"],
      ["Bugünün oyunu", "Kısa bir meydan okumayla arşiv puanı kazan.", "#/oyunlar"]
    ];
    var pick = suggestions[day % suggestions.length];
    var el = document.createElement("div");
    el.id = "tf64Dashboard";
    el.className = "tf64-dashboard";
    el.setAttribute("aria-labelledby", "tf64DashboardTitle");
    el.innerHTML = '<div class="tf64-dash-head"><div><span class="etiket">Kişisel merkez</span><h2 id="tf64DashboardTitle">' + greeting + '</h2><p class="bolum-alt">Okudukların, keşiflerin ve üretim araçların tek bir başlangıç noktasında.</p></div><button class="dugme dugme-sade tf64-refresh" type="button" data-tf64-refresh>Yenile</button></div><div class="tf64-dash-grid">' + continueHtml + '<article class="tf64-dash-card"><span class="oyun-etiket">Bugünün önerisi</span><h3>' + esc(pick[0]) + '</h3><p>' + esc(pick[1]) + '</p><button class="dugme dugme-sade" data-tf64-git="' + pick[2] + '">Aç</button></article><article class="tf64-dash-card"><span class="oyun-etiket">Hızlı erişim</span><div class="tf64-quick"><button data-tf64-git="#/defter">Defterim</button><button data-tf64-git="#/fan">Evren keşfi</button><button data-tf64-git="#/sen">Ayarlar</button></div></article></div>';
    var anchor = host.querySelector(".arama-kutu");
    host.insertBefore(el, anchor ? anchor.nextSibling : host.firstChild);
  }

  function onboarding() {
    var host = document.querySelector("#baslangicAlan");
    if (!host || read(ONBOARD, {}).tamam) return;
    var steps = ["Bir karakter veya evren keşfet", "Bir metni okuma listene ekle", "Kendi evreninin ilk kaydını oluştur"];
    host.innerHTML = '<div class="tf64-onboarding"><div class="tf64-onboarding-head"><div><span class="oyun-etiket">Yeni arşivci rehberi</span><h3>İlk 10 dakikada TentiFor</h3></div><button class="ic-bag" data-tf64-onboard-close>Şimdilik kapat</button></div><ol>' + steps.map(function (step, i) { return '<li><span>' + (i + 1) + '</span><label><input type="checkbox" data-tf64-step="' + i + '"> ' + esc(step) + '</label></li>'; }).join("") + '</ol><p class="oyun-not">Yeni hesap hediyen ilk adımları denemek için hazır.</p></div>';
  }

  function personalArchive() {
    var host = document.querySelector("#defterAlan");
    if (!host || document.querySelector("#tf64Archive")) return;
    var savedItems = localProgress();
    var offline = read("tentiforapp_indirilen_evrenler", {});
    var el = document.createElement("div");
    el.id = "tf64Archive";
    el.className = "kutu-y tf64-archive";
    el.innerHTML = '<div class="tf64-section-head"><div><span class="oyun-etiket">6.4 kişisel arşiv</span><h3>Tek yerde</h3></div><button class="dugme dugme-sade" data-tf64-export>Özeti indir</button></div><div class="tf64-archive-grid"><div><b>Okuma kuyruğu</b><span>' + savedItems.length + ' kayıt</span><button class="ic-bag" data-tf64-git="#/okuma">Listeyi aç</button></div><div><b>Çevrimdışı paketler</b><span>' + Object.keys(offline || {}).length + ' evren</span><button class="ic-bag" data-tf64-git="#/sen">Yönet</button></div><div><b>İlerleme</b><span>' + (savedItems.filter(function (x) { return x.bitti; }).length) + ' tamamlanan kayıt</span><button class="ic-bag" data-tf64-git="#/basarim">Rozetlere git</button></div></div>' + (savedItems.length ? '<ul class="tf64-archive-list">' + savedItems.slice(0, 4).map(function (item) { return '<li><span><b>' + esc(item.ad) + '</b>' + (item.toplam ? '<small>' + esc(String((Number(item.sira || 0) + 1) + ' / ' + item.toplam)) + '</small>' : '') + '</span><button class="ic-bag" data-tf64-git="' + esc(item.git) + '">Aç</button></li>'; }).join("") + '</ul>' : '<p class="oyun-not">Bir kayıt eklediğinde kişisel arşivin burada görünecek.</p>');
    host.insertBefore(el, host.firstChild);
  }

  function remotePrefsLoad() {
    if (!loggedIn() || typeof hesapIstemci === "undefined" || !hesapIstemci) return;
    hesapIstemci.rpc("kullanici_tercihleri_oku").then(function (res) {
      if (res.error || !res.data) return;
      var remote = res.data, p = read(PREF, {});
      var flags = remote.bildirimler || {};
      Object.keys(flags).forEach(function (key) { p[key] = flags[key]; });
      p.muted = remote.sessize_alinan || p.muted || [];
      p.blocked = remote.engellenen || p.blocked || [];
      p.payment = !!remote.odeme_haberdar || !!p.payment;
      write(PREF, p);
      drawMuted();
    }).catch(function () {});
  }
  function remotePrefsSave() {
    if (!loggedIn() || typeof hesapIstemci === "undefined" || !hesapIstemci) return;
    var p = read(PREF, {});
    hesapIstemci.rpc("kullanici_tercihleri_kaydet", { p_bildirimler: { sosyal: p.sosyal !== false, gorev: p.gorev !== false, urun: p.urun !== false, sessiz: !!p.sessiz }, p_sessize_alinan: p.muted || [], p_engellenen: p.blocked || [], p_odeme_haberdar: !!p.payment }).catch(function () {});
  }
  function preferences() {
    var host = document.querySelector("#hesapAlan");
    if (!host || document.querySelector("#tf64Preferences")) return;
    var pref = read(PREF, { sosyal: true, gorev: true, urun: true, sessiz: false });
    var el = document.createElement("div");
    el.id = "tf64Preferences";
    el.className = "kutu-y tf64-preferences";
    el.innerHTML = '<div class="tf64-section-head"><div><span class="oyun-etiket">6.4 kontrol merkezi</span><h3>Bildirim ve topluluk tercihleri</h3></div><span class="tf64-local-badge">Cihazda hazır</span></div><div class="tf64-pref-grid"><label><input type="checkbox" data-tf64-pref="sosyal"' + (pref.sosyal ? " checked" : "") + '> Takip ve sosyal bildirimler</label><label><input type="checkbox" data-tf64-pref="gorev"' + (pref.gorev ? " checked" : "") + '> Görev, seri ve ödül hatırlatmaları</label><label><input type="checkbox" data-tf64-pref="urun"' + (pref.urun ? " checked" : "") + '> Yeni özellik ve yayın duyuruları</label><label><input type="checkbox" data-tf64-pref="sessiz"' + (pref.sessiz ? " checked" : "") + '> Topluluk akışını sessize al</label></div><div class="tf64-community"><label for="tf64Mute">Sessize al / engelle kullanıcı adı</label><div class="tf64-inline"><input id="tf64Mute" class="kod-giris arac-giris" placeholder="kullanici_adi" autocomplete="off"><button class="dugme dugme-sade" data-tf64-mute>Sessize al</button><button class="dugme dugme-sade" data-tf64-block>Engelle</button></div><p class="oyun-not">Tercihlerin cihazında korunur; giriş yaptıysan hesabınla eşitlemeye hazırlanır.</p><div id="tf64MutedList"></div></div><div class="tf64-payment"><span><b>EvrenYazar</b><small>Ödeme açıldığında haber ver</small></span><button class="dugme" data-tf64-payment>Beni haberdar et</button></div>';
    host.appendChild(el);
    drawMuted();
    remotePrefsLoad();
  }
  function drawMuted() { var el = document.querySelector("#tf64MutedList"); if (!el) return; var p = read(PREF, { muted: [], blocked: [] }); var all = (p.muted || []).map(function (x) { return "Sessiz: @" + x; }).concat((p.blocked || []).map(function (x) { return "Engelli: @" + x; })); el.innerHTML = all.length ? '<div class="tf64-muted-list">' + all.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join("") + '</div>' : '<p class="oyun-not">Henüz sessize alınan veya engellenen kullanıcı yok.</p>'; }

  function discovery() {
    var host = document.querySelector("#fanEvrenAlan");
    if (!host || document.querySelector("#tf64Discovery")) return;
    var el = document.createElement("div");
    el.id = "tf64Discovery";
    el.className = "kutu-y tf64-discovery";
    el.innerHTML = '<div class="tf64-section-head"><div><span class="oyun-etiket">Akıllı keşif</span><h3>Arşivde daha hızlı bul</h3></div><span class="oyun-not">filtreler cihazında tutulur</span></div><div class="tf64-filter-row"><input id="tf64DiscoverSearch" class="kod-giris arac-giris" type="search" placeholder="Evren, yazar veya konu ara…"><select id="tf64DiscoverType" class="kod-giris arac-giris"><option value="">Tüm içerikler</option><option value="zengin">En zengin</option><option value="yeni">En yeni</option><option value="kisa">Kısa okuma</option></select></div><div id="tf64DiscoverResult" class="tf64-discover-result"></div><p class="oyun-not">Bir sonucu seçtiğinde doğrudan evren sayfasına gidersin.</p>';
    host.insertBefore(el, host.firstChild);
    drawDiscovery();
  }
  function drawDiscovery() { var out = document.querySelector("#tf64DiscoverResult"), q = String((document.querySelector("#tf64DiscoverSearch") || {}).value || "").toLocaleLowerCase("tr"); if (!out || typeof veri === "undefined") return; var list = ((veri.fanEserleri || {}).evrenler || []).filter(function (x) { return !q || (String(x.ad) + " " + String(x.yazar || "") + " " + String(x.ozet || "")).toLocaleLowerCase("tr").indexOf(q) !== -1; }); var type = (document.querySelector("#tf64DiscoverType") || {}).value; list.sort(function (a, b) { if (type === "zengin") return Number((b.sayilar || {}).bolum || 0) - Number((a.sayilar || {}).bolum || 0); if (type === "kisa") return Number((a.sayilar || {}).bolum || 0) - Number((b.sayilar || {}).bolum || 0); return String(b.eklenme || b.olusturma || "").localeCompare(String(a.eklenme || a.olusturma || "")); }); out.innerHTML = list.slice(0, 8).map(function (x) { return '<button class="tf64-discover-card" data-tf64-git="#/ev/fan/' + esc(x.id) + '"><b>' + esc(x.ad || "Adsız evren") + '</b><span>' + esc(x.yazar || "TentiFor arşivcisi") + '</span><small>' + esc(String(x.ozet || "Kısa bir evren kaydı").slice(0, 110)) + '</small></button>'; }).join("") || '<p class="oyun-not">Bu filtrelerle eşleşen evren yok. Başka bir kelime dene.</p>'; }

  function shareCard() { var route = location.hash || "#/arsiv", title = document.title.replace(/ — TentiFor$/, ""); var text = title + " · TentiFor"; if (navigator.share) navigator.share({ title: title, text: text, url: location.href }).catch(function () {}); else if (typeof panoyaKopyala === "function") panoyaKopyala(location.href).then(function () { notify("Bağlantı kopyalandı", "basari"); }); }
  function exportSummary() { var data = { surum: "6.4.3.0", tarih: new Date().toISOString(), okuma: localProgress(), tercihler: read(PREF, {}) }; var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); a.download = "tentifor-6.4-ozet.json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); }

  document.addEventListener("click", function (e) {
    var target = e.target.closest && e.target.closest("[data-tf64-git], [data-tf64-onboard-close], [data-tf64-mute], [data-tf64-block], [data-tf64-payment], [data-tf64-export], [data-tf64-refresh]");
    if (!target) return;
    if (target.dataset.tf64Git) { go(target.dataset.tf64Git); return; }
    if (target.hasAttribute("data-tf64-refresh")) { ["#tf64Dashboard", "#tf64Archive", "#tf64Preferences", "#tf64Discovery"].forEach(function (id) { var n = document.querySelector(id); if (n) n.remove(); }); render(); notify("Kişisel merkez güncellendi", "basari"); return; }
    if (target.hasAttribute("data-tf64OnboardClose")) { write(ONBOARD, { tamam: true }); var box = target.closest(".tf64-onboarding"); if (box) box.remove(); return; }
    if (target.hasAttribute("data-tf64Export")) { exportSummary(); return; }
    if (target.hasAttribute("data-tf64Payment")) { var p = read(PREF, {}); p.payment = true; write(PREF, p); remotePrefsSave(); target.textContent = "Listeye eklendin"; target.disabled = true; notify("Ödeme açıldığında haber vereceğiz", "basari"); return; }
    if (target.hasAttribute("data-tf64Mute") || target.hasAttribute("data-tf64Block")) { var input = document.querySelector("#tf64Mute"), name = String(input && input.value || "").trim().toLocaleLowerCase("tr").replace(/[^a-z0-9_çğıöşü-]/g, "").slice(0, 40); if (!name) { notify("Önce bir kullanıcı adı yaz", "hata"); return; } var p = read(PREF, { muted: [], blocked: [] }), key = target.hasAttribute("data-tf64Mute") ? "muted" : "blocked"; p[key] = p[key] || []; if (p[key].indexOf(name) === -1) p[key].push(name); write(PREF, p); remotePrefsSave(); input.value = ""; drawMuted(); notify("@" + name + (key === "muted" ? " sessize alındı" : " engellendi"), "basari"); }
  });
  document.addEventListener("change", function (e) { if (e.target.matches && e.target.matches("[data-tf64-pref]")) { var p = read(PREF, {}); p[e.target.dataset.tf64Pref] = e.target.checked; write(PREF, p); remotePrefsSave(); notify("Tercihin kaydedildi", "basari"); } if (e.target.matches && e.target.matches("[data-tf64-step]")) { var checks = Array.prototype.slice.call(document.querySelectorAll("[data-tf64-step]")); if (checks.length && checks.every(function (x) { return x.checked; })) { write(ONBOARD, { tamam: true }); notify("İlk adım rehberini tamamladın", "basari"); } } });
  document.addEventListener("input", function (e) { if (e.target.id === "tf64DiscoverSearch" || e.target.id === "tf64DiscoverType") drawDiscovery(); });
  document.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { var input = document.querySelector("#aramaGiris"); if (input) { e.preventDefault(); input.focus(); } } });
  document.addEventListener("DOMContentLoaded", function () { setTimeout(render, 900); });
  window.addEventListener("hashchange", function () { setTimeout(render, 100); });
  function render() { dashboard(); onboarding(); if (location.hash.indexOf("#/defter") === 0 || location.hash.indexOf("#/sen") === 0) { personalArchive(); preferences(); } if (location.hash.indexOf("#/fan") === 0 || location.hash.indexOf("#/atolye") === 0) discovery(); }
  window.tf64ShareCard = shareCard;
}());
