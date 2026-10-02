/* TentiforApp 6.2 platform layer: safe web/PWA/native hardening. */
(function () {
  'use strict';
  var KEY = 'tentiforapp_6_2';
  var LOCK_IDLE_MS = 5 * 60 * 1000;
  var state = { unlockedUntil: 0, lastActivity: Date.now(), favorites: [], history: [] };
  function read() { try { var v = JSON.parse(localStorage.getItem(KEY) || '{}'); state = Object.assign(state, v || {}); } catch (_) {} }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ favorites: state.favorites.slice(0, 200), history: state.history.slice(0, 100) })); } catch (_) {} }
  function toast(message, good) { if (typeof window.eckaBildir === 'function') window.eckaBildir(message); else console.info('[6.2]', message); }
  function esc(value) { return typeof window.kacir === 'function' ? window.kacir(value) : String(value).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]; }); }
  function native() { return window.TentiforNative6 && window.TentiforNative6.available; }
  function lock() { state.unlockedUntil = 0; try { sessionStorage.removeItem('tentiforapp_6_2_unlocked'); } catch (_) {} document.documentElement.setAttribute('data-tf62-locked', '1'); window.dispatchEvent(new CustomEvent('tf62-lock')); }
  function unlock() { state.unlockedUntil = Date.now() + LOCK_IDLE_MS; try { sessionStorage.setItem('tentiforapp_6_2_unlocked', '1'); } catch (_) {} document.documentElement.removeAttribute('data-tf62-locked'); window.dispatchEvent(new CustomEvent('tf62-unlock')); }
  async function authenticate() {
    if (native()) { await window.TentiforNative6.authenticate(); unlock(); return true; }
    unlock(); return true;
  }
  function isUnlocked() { return Date.now() < state.unlockedUntil; }
  function touch() { state.lastActivity = Date.now(); if (isUnlocked()) state.unlockedUntil = Date.now() + LOCK_IDLE_MS; }
  function recordHistory(id, title, route) {
    if (!id && !route) return;
    state.history = [{ id: String(id || route), title: String(title || id || route), route: String(route || ''), at: new Date().toISOString() }].concat(state.history.filter(function (x) { return x.id !== String(id || route); })).slice(0, 100); save();
  }
  function toggleFavorite(id, title) {
    id = String(id || ''); if (!id) return false;
    var found = state.favorites.indexOf(id); if (found >= 0) state.favorites.splice(found, 1); else state.favorites.unshift(id);
    save(); toast(found >= 0 ? 'Favorilerden çıkarıldı.' : 'Favorilere eklendi.', true); window.dispatchEvent(new CustomEvent('tf62-favorites')); return found < 0;
  }
  function exportBackup() {
    var payload = { format: 'tentiforapp-6.2.1-backup', version: '6.2.1', createdAt: new Date().toISOString(), data: {} };
    var skip = /^supabase\.|tf4_uyelik$|tentiforapp_6_2$/;
    try { Object.keys(localStorage).forEach(function (key) { if (!skip.test(key)) payload.data[key] = localStorage.getItem(key); }); } catch (_) {}
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tentiforapp-yedek-6.2.1.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); toast('Yedek dosyası indirildi.', true);
  }
  function importBackup(file) {
    return new Promise(function (resolve, reject) {
      if (!file || file.size > 16 * 1024 * 1024) return reject(new Error('Yedek dosyası 16 MB sınırını aşamaz.'));
      var reader = new FileReader(); reader.onload = function () { try {
        var payload = JSON.parse(reader.result); if (!payload || payload.format !== 'tentiforapp-6.2.1-backup' || !payload.data) throw new Error('Geçersiz TentiforApp yedeği.');
        var count = 0; Object.keys(payload.data).forEach(function (key) { if (/^supabase\.|tf4_uyelik$|tentiforapp_6_2$/.test(key)) return; if (typeof payload.data[key] === 'string') { localStorage.setItem(key, payload.data[key]); count++; } });
        read(); toast(count + ' kayıt geri yüklendi. Sayfa yenileniyor.', true); resolve(count); setTimeout(function () { location.reload(); }, 500);
      } catch (e) { reject(e); } }; reader.onerror = function () { reject(new Error('Yedek okunamadı.')); }; reader.readAsText(file);
    });
  }
  function searchIndex(query) {
    query = String(query || '').trim();
    if (query.length < 2) return [];
    /* Use the canonical permission-aware index. The old code read
       window.veri (the app declares veri as a top-level const) and guessed
       keys/routes, so valid terms such as “Feil” returned no result. */
    var canonical = typeof window.aramaDizini === 'function' ? window.aramaDizini() : [];
    var normal = typeof window.trNormal === 'function' ? window.trNormal : function (v) { return String(v || '').toLocaleLowerCase('tr-TR'); };
    var words = normal(query).split(/\s+/).filter(Boolean);
    return canonical.map(function (item) {
      var hay = normal([item.ad, item.alt, item.metin].join(' '));
      var score = words.reduce(function (sum, word) { return sum + (normal(item.ad || '').indexOf(word) >= 0 ? 40 : hay.indexOf(word) >= 0 ? 8 : 0); }, 0);
      return { type: item.tur, title: item.ad || 'Adsız kayıt', text: [item.alt, item.metin].filter(Boolean).join(' · ').slice(0, 220), route: item.git || '', score: score };
    }).filter(function (item) { return item.score > 0 && item.route; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 40);
  }
  function showSecretInfo() {
    var existing = document.querySelector('#tf62SecretInfo');
    if (!existing) { existing = document.createElement('div'); existing.id = 'tf62SecretInfo'; existing.className = 'tf62-overlay'; existing.innerHTML = '<div class="tf62-dialog" role="dialog" aria-modal="true" aria-labelledby="tf62SecretTitle"><button type="button" class="pencere-kapat" data-tf62-close aria-label="Kapat">✕</button><h3 id="tf62SecretTitle">Gizli içerik açma ne yapar?</h3><p>Bu işlem, APK’de cihaz biyometrisiyle <b>gizli içerik oturumu</b> açar. Oturum 5 dakika hareketsizlikten sonra kapanır.</p><p>Bu düğme tek başına evren katmanlarını, şifreleri veya oyun kilitlerini çözmez. Onlar kendi koşulları tamamlanınca açılır. Buradaki doğrulama, cihazı elinde tutmayan kişinin açık bırakılmış gizli içeriğe erişmesini engeller.</p><p class="oyun-not">Web/PWA’da biyometri olmadığı için gerçek cihaz doğrulaması yapılamaz; bu özellik APK içindir.</p><button type="button" class="dugme" data-tf62-confirm-secret>Devam et</button></div>'; document.body.appendChild(existing); }
    existing.hidden = false;
  }
  function openSearch() {
    var overlay = document.querySelector('#tf62Search'); if (!overlay) { overlay = document.createElement('div'); overlay.id = 'tf62Search'; overlay.className = 'tf62-overlay'; overlay.innerHTML = '<div class="tf62-dialog" role="dialog" aria-modal="true" aria-labelledby="tf62SearchTitle"><button type="button" class="pencere-kapat" data-tf62-close aria-label="Kapat">✕</button><h3 id="tf62SearchTitle">Her yerde ara</h3><input id="tf62SearchInput" class="arama-giris" type="search" placeholder="Karakter, evren, günlük…" autocomplete="off"><div id="tf62SearchResults" role="listbox"></div></div>'; document.body.appendChild(overlay); }
    overlay.hidden = false; var input = overlay.querySelector('#tf62SearchInput'); input.focus();
    function render() { var results = searchIndex(input.value), box = overlay.querySelector('#tf62SearchResults'); box.innerHTML = results.length ? results.map(function (r) { return '<button type="button" class="tf62-result" data-tf62-route="' + esc(r.route) + '"><b>' + esc(r.title) + '</b><small>' + esc(r.type) + ' · ' + esc(r.text) + '</small></button>'; }).join('') : '<p class="oyun-not">En az iki harf yaz veya sonuç bulunamadı.</p>'; }
    input.oninput = render; render();
  }
  function menuTools() {
    var menu = document.querySelector('#mobilMenu .mm-eylemler'); if (!menu || menu.querySelector('[data-tf62-action]')) return;
    var box = document.createElement('div'); box.className = 'tf62-tools'; box.innerHTML = '<button class="mm-eylem" type="button" data-tf62-action="search">⌕ Her yerde ara</button><button class="mm-eylem" type="button" data-tf62-action="backup">⇩ Yedek al</button><button class="mm-eylem" type="button" data-tf62-action="lock">▣ Gizli içeriği kilitle</button><label class="mm-eylem tf62-import">⇧ Yedek yükle<input type="file" accept="application/json,.json" data-tf62-import hidden></label>'; menu.appendChild(box);
  }
  read();
  try { if (sessionStorage.getItem('tentiforapp_6_2_unlocked') === '1') unlock(); } catch (_) {}
  window.Tentifor6_2 = { unlock: authenticate, lock: lock, isUnlocked: isUnlocked, exportBackup: exportBackup, importBackup: importBackup, search: searchIndex, favorite: toggleFavorite, history: function () { return state.history.slice(); }, recordHistory: recordHistory };
  ['touchstart', 'click', 'keydown'].forEach(function (type) { document.addEventListener(type, touch, { passive: true }); });
  document.addEventListener('click', function (event) {
    var action = event.target.closest && event.target.closest('[data-tf62-action]'); if (action) { var name = action.dataset.tf62Action; if (name === 'search') openSearch(); if (name === 'backup') exportBackup(); if (name === 'lock') { lock(); toast('Gizli içerik kilitlendi.', true); } }
    if (event.target.closest && event.target.closest('[data-tf62-secret-info]')) showSecretInfo();
    if (event.target.closest && event.target.closest('[data-tf62-confirm-secret]')) { var info = event.target.closest('.tf62-overlay'); if (info) info.hidden = true; if (window.Tentifor6_2) window.Tentifor6_2.unlock().catch(function (e) { toast(e.message || 'Cihaz doğrulaması başarısız.', false); }); }
    if (event.target.matches && event.target.matches('[data-tf62-import]')) return;
    var result = event.target.closest && event.target.closest('[data-tf62-route]'); if (result) { var route = result.dataset.tf62Route; if (route) location.hash = route; var o = document.querySelector('#tf62Search'); if (o) o.hidden = true; }
    if (event.target.closest && event.target.closest('[data-tf62-close]')) { var overlay = event.target.closest('.tf62-overlay'); if (overlay) overlay.hidden = true; }
    var fav = event.target.closest && event.target.closest('[data-tf62-favorite]'); if (fav) toggleFavorite(fav.dataset.tf62Favorite, fav.dataset.tf62Title);
  });
  document.addEventListener('change', function (event) { var input = event.target.closest && event.target.closest('[data-tf62-import]'); if (input && input.files && input.files[0]) importBackup(input.files[0]).catch(function (e) { toast(e.message || 'Yedek yüklenemedi.', false); }); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) return; if (Date.now() - state.lastActivity > LOCK_IDLE_MS) lock(); });
  window.addEventListener('hashchange', function () { recordHistory(location.hash, document.title, location.hash); });
  window.addEventListener('tentifor-back-button', function () {
    var overlay = document.querySelector('.tf62-overlay:not([hidden])');
    if (overlay) { overlay.hidden = true; window.__tf62BackHandled = true; return; }
    var curtain = document.querySelector('#perde:not([hidden])');
    if (curtain && typeof window.perdeKapat === 'function') { window.perdeKapat(); window.__tf62BackHandled = true; return; }
    var menu = document.querySelector('#mobilMenu');
    if (menu && menu.classList.contains('acik')) { if (typeof window.mobilMenuKapat === 'function') window.mobilMenuKapat(); window.__tf62BackHandled = true; return; }
    if (isUnlocked()) { lock(); toast('Gizli içerik kilitlendi.', true); window.__tf62BackHandled = true; }
  });
  new MutationObserver(menuTools).observe(document.documentElement, { childList: true, subtree: true }); menuTools();
  window.performance && performance.mark && performance.mark('tf62-platform-ready');
}());
