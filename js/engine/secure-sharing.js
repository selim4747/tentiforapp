/* TentiforApp 6.3.10 — public-only, revocable sharing and owner history. */
(function () {
  'use strict';
  var TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var mountedTargets = new WeakMap();

  function client() {
    if (typeof hesapIstemci !== 'undefined' && hesapIstemci && hesapIstemci.rpc) return hesapIstemci;
    return null;
  }
  async function publicRpc(name, args) {
    var c = client();
    if (c) return c.rpc(name, args);
    if (typeof HESAP_AYAR === 'undefined' || !HESAP_AYAR.url || !HESAP_AYAR.anahtar) throw new Error('public-rpc-unavailable');
    var response = await fetch(HESAP_AYAR.url.replace(/\/$/, '') + '/rest/v1/rpc/' + encodeURIComponent(name), {
      method: 'POST', headers: { apikey: HESAP_AYAR.anahtar, 'content-type': 'application/json' }, body: JSON.stringify(args || {})
    });
    var data = await response.json();
    return response.ok ? { data: data, error: null } : { data: null, error: data };
  }
  function account() {
    if (typeof hesapKullanici !== 'undefined' && hesapKullanici) return hesapKullanici;
    return window.hesapKullanici || null;
  }
  function clean(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max || 180);
  }
  function urlFor(path, token) {
    var url = new URL(path, window.location.origin);
    url.hash = '';
    if (token) url.searchParams.set('tf_share', token);
    return url.toString();
  }
  function typeId(item) {
    if (!item) return null;
    if (item.tur === 'profil') return { type: 'profil', id: clean(item.kullanici_adi, 20).toLowerCase() };
    if (item.tur === 'evren') return { type: 'evren', id: clean(item.slug, 60).normalize('NFC').toLocaleLowerCase('tr-TR') };
    if (item.tur === 'okuma') return { type: 'okuma', id: clean(item.id, 36).toLowerCase() };
    return null;
  }
  function publicContainer(type) {
    if (type === 'profil') return document.querySelector('.hesap-profil .tf63-profil-alan, .hesap-profil');
    if (type === 'evren') return document.querySelector('#evrenSayfa .evs-govde, #evrenSayfa');
    if (type === 'okuma') return document.querySelector('#tf639ReadPathView');
    return document.querySelector('[data-seo-fallback]');
  }
  function statusNode(container) {
    var node = container && container.querySelector('[data-tf310-status]');
    if (!node && container) {
      node = document.createElement('p');
      node.className = 'tf310-status pencere-durum';
      node.setAttribute('data-tf310-status', '');
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      container.appendChild(node);
    }
    return node;
  }
  function announce(container, message, good) {
    var node = statusNode(container);
    if (node) {
      node.textContent = clean(message, 240);
      node.classList.toggle('iyi', !!good);
      node.classList.toggle('kotu', !good);
    } else if (typeof window.eckaBildir === 'function') window.eckaBildir(clean(message, 180));
  }
  function setAccountMessage(message, good) {
    var box = document.querySelector('.tf635-kalite');
    var node = box && box.querySelector('[data-tf635-msg]');
    if (node) {
      node.textContent = clean(message, 240);
      node.className = 'pencere-durum ' + (good ? 'iyi' : 'kotu');
    } else if (typeof window.eckaBildir === 'function') window.eckaBildir(clean(message, 180));
  }
  function mountPublicTarget(detail) {
    var item = detail && detail.item;
    var meta = detail && detail.meta;
    var parsed = typeId(item);
    if (!parsed || !meta || !meta.path) return;
    var parent = publicContainer(parsed.type);
    if (!parent) parent = document.querySelector('[data-seo-fallback]');
    if (!parent) return;
    var button = parent.querySelector('[data-tf310-share]');
    var key = parsed.type + ':' + parsed.id;
    if (button && mountedTargets.get(button) === key) return;
    if (!button) {
      var group = document.createElement('div');
      group.className = 'tf310-share-actions';
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'dugme tf310-share-button';
      button.setAttribute('data-tf310-share', '');
      button.textContent = 'Paylaş';
      group.appendChild(button);
      parent.insertBefore(group, parent.firstChild);
    }
    button.__tf310Target = {
      type: parsed.type,
      id: parsed.id,
      path: meta.path,
      title: clean(meta.title, 100),
      description: clean(meta.description, 180),
      verifiedPublic: true
    };
    button.setAttribute('aria-label', (clean(meta.kind, 40) || 'İçerik') + ' bağlantısını paylaş');
    mountedTargets.set(button, key);
  }
  async function createLink(target) {
    var c = client();
    if (!c || !account()) return null;
    try {
      var response = await c.rpc('paylasim_baglanti_olustur', { p_tur: target.type, p_id: target.id, p_sure_gun: 30 });
      var data = response && response.data;
      if (response && !response.error && data && data.durum === 'tamam' && TOKEN_RE.test(String(data.id || '')) && typeof data.yol === 'string') {
        return { id: String(data.id).toLowerCase(), url: urlFor(data.yol, String(data.id).toLowerCase()) };
      }
      return null;
    } catch (_) { return null; }
  }
  async function verifyProfileIsPublic(username) {
    var c = client();
    if (!c) return false;
    try {
      var response = await c.rpc('public_seo_sayfa', { p_tur: 'profil', p_id: username });
      return !!(response && !response.error && response.data && response.data.tur === 'profil');
    } catch (_) { return false; }
  }
  async function recordShare(link, eventName) {
    var c = client();
    if (!c || !link || !TOKEN_RE.test(link)) return;
    try { await c.rpc('paylasim_olay_kaydet', { p_link: link, p_olay: eventName }); } catch (_) {}
  }
  async function copyText(value) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(value);
      return;
    }
    var field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.setAttribute('aria-hidden', 'true');
    field.style.position = 'fixed'; field.style.opacity = '0'; field.style.pointerEvents = 'none';
    document.body.appendChild(field); field.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } finally { field.remove(); }
    if (!copied) throw new Error('clipboard-unavailable');
  }
  async function deliver(target, host, ownerProfile) {
    var btn = host && host.matches('[data-tf310-share]') ? host : null;
    if (btn) btn.disabled = true;
    announce(ownerProfile ? document.querySelector('.tf635-kalite') : host && host.parentElement, 'Paylaşım hazırlanıyor…', true);
    try {
      var token = await createLink(target);
      var shareUrl = token ? token.url : urlFor(target.path);
      if (ownerProfile && !token && !(await verifyProfileIsPublic(target.id))) {
        setAccountMessage('Profilin şu anda herkese açık değil; paylaşım bağlantısı oluşturulmadı.', false);
        return;
      }
      var payload = { title: target.title || 'TentiFor', text: target.description || 'TentiFor’te herkese açık içerik', url: shareUrl };
      var mode = '';
      try {
        if (window.TentiforKopru && typeof window.TentiforKopru.paylas === 'function') {
          await window.TentiforKopru.paylas(payload);
          mode = 'native';
        } else if (typeof navigator.share === 'function') {
          await navigator.share(payload);
          mode = 'native';
        } else {
          await copyText(shareUrl);
          mode = 'kopyalandi';
        }
      } catch (error) {
        if (error && error.name === 'AbortError') {
          announce(ownerProfile ? document.querySelector('.tf635-kalite') : host && host.parentElement, 'Paylaşım iptal edildi.', true);
          return;
        }
        try { await copyText(shareUrl); mode = 'kopyalandi'; }
        catch (_) {
          announce(ownerProfile ? document.querySelector('.tf635-kalite') : host && host.parentElement, 'Paylaşım açılamadı. Tarayıcı paylaşımı ve pano kopyalama desteklenmiyor.', false);
          return;
        }
      }
      if (token) await recordShare(token.id, mode);
      var message = mode === 'native' ? 'Paylaşım penceresi açıldı.' : 'Bağlantı panoya kopyalandı.';
      if (!token) message += ' İçerik herkese açık; süreli izleme bağlantısı oluşturulamadı.';
      announce(ownerProfile ? document.querySelector('.tf635-kalite') : host && host.parentElement, message, true);
    } catch (_) {
      announce(ownerProfile ? document.querySelector('.tf635-kalite') : host && host.parentElement, 'Paylaşım başarısız oldu. Lütfen yeniden dene.', false);
    } finally { if (btn) btn.disabled = false; }
  }
  function accountProfileTarget() {
    var user = account();
    var handle = clean(user && user.kullanici_adi, 20).toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) return null;
    return { type: 'profil', id: handle, path: '/u/' + encodeURIComponent(handle) + '/', title: handle + ' (@' + handle + ') | TentiFor', description: 'TentiFor’te herkese açık profil.', verifiedPublic: false };
  }
  function addHistoryPanel(box) {
    if (!box || box.querySelector('[data-tf310-history-panel]')) return;
    var legacy = box.querySelector('[data-tf635-share]');
    if (legacy) {
      legacy.textContent = 'Profilimi paylaş';
      legacy.setAttribute('aria-label', 'Herkese açık profilimi paylaş');
      if (legacy.previousElementSibling) legacy.previousElementSibling.textContent = 'Profilin yalnızca herkese açıksa paylaşılır. Süreli bağlantılar ve açılma sayıları aşağıdaki geçmişten yönetilir.';
    }
    var panel = document.createElement('section');
    panel.className = 'tf310-history-panel';
    panel.setAttribute('data-tf310-history-panel', '');
    var title = document.createElement('h3'); title.textContent = 'Paylaşım geçmişi';
    var note = document.createElement('p'); note.className = 'oyun-not'; note.textContent = 'Bağlantılar yalnızca yayınlanmış içerik için oluşturulur; 30 gün sonra sona erer ve istediğin an iptal edilebilir. Tokenı iptal etmek içeriğin kendi herkese açık yayınını kapatmaz. Ölçümler günlük toplamdır; ziyaretçi IP’si, cihazı veya referrer’ı saklanmaz.';
    var load = document.createElement('button'); load.type = 'button'; load.className = 'dugme dugme-sade'; load.setAttribute('data-tf310-history-load', ''); load.textContent = 'Paylaşım geçmişini göster';
    var rows = document.createElement('div'); rows.className = 'tf310-history-list'; rows.setAttribute('data-tf310-history-list', ''); rows.setAttribute('aria-live', 'polite');
    panel.append(title, note, load, rows);
    box.appendChild(panel);
  }
  function mountHistory() {
    var root = document.querySelector('#hesapTopluluk');
    var box = root && root.querySelector('.tf635-kalite');
    if (!box || !account() || !client()) return;
    addHistoryPanel(box);
  }
  function labelType(value) { return value === 'profil' ? 'Profil' : value === 'evren' ? 'Evren' : value === 'okuma' ? 'Okuma yolu' : 'İçerik'; }
  function rowButton(text, attribute, id, className) {
    var button = document.createElement('button'); button.type = 'button'; button.className = className || 'dugme dugme-sade'; button.setAttribute(attribute, id); button.textContent = text; return button;
  }
  function renderHistory(container, rows) {
    container.replaceChildren();
    if (!rows.length) { var empty = document.createElement('p'); empty.className = 'oyun-not'; empty.textContent = 'Henüz paylaşım bağlantısı oluşturulmadı.'; container.appendChild(empty); return; }
    rows.forEach(function (item) {
      var card = document.createElement('article'); card.className = 'tf310-history-row';
      var heading = document.createElement('strong'); heading.textContent = labelType(item.tur) + ' · ' + clean(item.icerik_id, 100);
      var counts = document.createElement('p'); counts.className = 'oyun-not';
      counts.textContent = 'Açıldı: ' + Number(item.acildi || 0) + ' · Kopyalandı: ' + Number(item.kopyalandi || 0) + ' · Web/native paylaşımı: ' + Number(item.native || 0);
      var expires = new Date(item.bitis); var created = new Date(item.olusturma);
      var info = document.createElement('p'); info.className = 'oyun-not';
      info.textContent = 'Oluşturuldu: ' + (Number.isNaN(created.getTime()) ? '—' : created.toLocaleString('tr-TR')) + ' · Son: ' + (Number.isNaN(expires.getTime()) ? '—' : expires.toLocaleString('tr-TR'));
      card.append(heading, info, counts);
      var active = !item.iptal && expires.getTime() > Date.now() && TOKEN_RE.test(String(item.id || ''));
      if (active) {
        var actions = document.createElement('div'); actions.className = 'tf310-history-actions';
        if (item.yol) {
          var copy = rowButton('Bağlantıyı kopyala', 'data-tf310-copy-link', String(item.id));
          copy.__tf310Link = { id: String(item.id), path: String(item.yol) };
          actions.appendChild(copy);
        } else {
          var unavailable = document.createElement('span'); unavailable.className = 'oyun-not'; unavailable.textContent = 'İçerik artık public değil; bağlantı açılamaz.'; actions.appendChild(unavailable);
        }
        var revoke = rowButton('Bağlantıyı iptal et', 'data-tf310-revoke', String(item.id));
        actions.appendChild(revoke); card.appendChild(actions);
      } else {
        var state = document.createElement('p'); state.className = 'tf310-status'; state.textContent = item.iptal ? 'İptal edildi.' : !item.yol ? 'İçerik artık herkese açık değil.' : 'Süresi doldu.'; card.appendChild(state);
      }
      container.appendChild(card);
    });
  }
  async function loadHistory(button) {
    var box = button.closest('.tf635-kalite'); var container = box && box.querySelector('[data-tf310-history-list]');
    if (!container) return;
    button.disabled = true; container.textContent = 'Paylaşım geçmişi yükleniyor…';
    try {
      var response = await client().rpc('paylasim_gecmisim');
      if (response.error) throw response.error;
      renderHistory(container, Array.isArray(response.data) ? response.data : []);
    } catch (_) { container.textContent = 'Paylaşım geçmişi yüklenemedi. Biraz sonra yeniden dene.'; }
    finally { button.disabled = false; }
  }
  async function historyAction(button, event) {
    var c = client(); if (!c) return;
    button.disabled = true;
    try {
      if (event === 'copy') {
        var link = button.__tf310Link;
        if (!link || !TOKEN_RE.test(link.id)) throw new Error('link');
        await copyText(urlFor(link.path, link.id));
        await recordShare(link.id, 'kopyalandi');
        announce(button.closest('[data-tf310-history-panel]'), 'Bağlantı panoya kopyalandı.', true);
      } else {
        var id = button.getAttribute('data-tf310-revoke');
        if (!TOKEN_RE.test(String(id || ''))) throw new Error('link');
        var response = await c.rpc('paylasim_baglanti_iptal', { p_link: id });
        if (response.error || !response.data || response.data.durum !== 'tamam') throw new Error('revoke');
        var load = button.closest('[data-tf310-history-panel]').querySelector('[data-tf310-history-load]');
        announce(button.closest('[data-tf310-history-panel]'), 'Bağlantı iptal edildi.', true);
        if (load) await loadHistory(load);
      }
    } catch (_) { announce(button.closest('[data-tf310-history-panel]'), 'İşlem tamamlanamadı. Bağlantı yetkisini ve durumunu kontrol et.', false); }
    finally { button.disabled = false; }
  }
  async function consumeToken() {
    var url;
    try { url = new URL(window.location.href); } catch (_) { return; }
    var token = url.searchParams.get('tf_share');
    if (!token || !TOKEN_RE.test(token)) return;
    var c = client();
    if (!c) return;
    try {
      var response = await publicRpc('paylasim_baglanti_ac', { p_token: token });
      var data = response && response.data;
      if (response && !response.error && data && data.durum === 'tamam' && typeof data.yol === 'string') {
        var expected = new URL(data.yol, window.location.origin);
        var cleanActual = url.pathname.replace(/\/+$/, '') || '/';
        var cleanExpected = expected.pathname.replace(/\/+$/, '') || '/';
        if (cleanActual !== cleanExpected) {
          expected.searchParams.set('tf_share', token);
          window.location.replace(expected.toString());
          return;
        }
        url.searchParams.delete('tf_share');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      } else {
        url.searchParams.delete('tf_share');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        var fallback = document.querySelector('[data-seo-fallback], .hesap-profil, #evrenSayfa');
        if (fallback) announce(fallback, 'Paylaşım bağlantısı geçersiz, iptal edilmiş veya süresi dolmuş. Herkese açık sayfayı görüntülemeye devam edebilirsin.', false);
      }
    } catch (_) { /* Tracking failure never blocks access to the public canonical page. */ }
  }
  document.addEventListener('click', function (event) {
    var legacy = event.target.closest && event.target.closest('[data-tf635-share]');
    if (legacy) {
      event.preventDefault(); event.stopImmediatePropagation();
      var target = accountProfileTarget();
      if (!target) { setAccountMessage('Public profil bağlantısı hazırlanamadı.', false); return; }
      deliver(target, legacy, true);
      return;
    }
    var share = event.target.closest && event.target.closest('[data-tf310-share]');
    if (share) { event.preventDefault(); deliver(share.__tf310Target, share, false); return; }
    var historyLoad = event.target.closest && event.target.closest('[data-tf310-history-load]');
    if (historyLoad) { event.preventDefault(); loadHistory(historyLoad); return; }
    var copy = event.target.closest && event.target.closest('[data-tf310-copy-link]');
    if (copy) { event.preventDefault(); historyAction(copy, 'copy'); return; }
    var revoke = event.target.closest && event.target.closest('[data-tf310-revoke]');
    if (revoke) { event.preventDefault(); historyAction(revoke, 'revoke'); }
  }, true);
  window.addEventListener('tf639-public-item', function (event) { mountPublicTarget(event.detail); });
  function boot() {
    mountHistory();
    var observer = new MutationObserver(function () {
      mountHistory();
      if (document.querySelector('[data-tf310-history-panel]')) observer.disconnect();
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    consumeToken();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  document.addEventListener('tf-veri-hazir', mountHistory);
  document.addEventListener('tf-hesap-hazir', mountHistory);
  window.TF310Share = { consume: consumeToken };
}());
