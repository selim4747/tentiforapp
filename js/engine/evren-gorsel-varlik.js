/* TentiFor fan evreni harita görseli varlık adaptörü. Büyük veriyi evren JSON'una koymaz. */
(function () {
  'use strict';

  var DB_NAME = 'tentifor-evren-varliklari';
  var DB_VERSION = 1;
  var STORE = 'gorseller';
  var MAX_BYTES = 10 * 1024 * 1024;
  var MAX_EDGE = 4096;
  var MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

  function text(value) { return String(value == null ? '' : value); }
  function id() { return 'asset-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  function fail(message) { throw new Error(message); }
  function allowedMime(file) {
    var type = text(file && file.type).toLowerCase();
    if (!MIME[type]) fail('Yalnızca PNG, JPEG veya WebP görseller kabul edilir.');
    return type;
  }
  function arrayBuffer(file) {
    if (file && typeof file.arrayBuffer === 'function') return file.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Görsel okunamadı.')); };
      reader.onload = function () { resolve(reader.result); };
      reader.readAsArrayBuffer(file);
    });
  }
  function signature(bytes, mime) {
    var b = new Uint8Array(bytes);
    if (mime === 'image/png' && b.length >= 8 && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10) return true;
    if (mime === 'image/jpeg' && b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return true;
    if (mime === 'image/webp' && b.length >= 12 && b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80) return true;
    return false;
  }
  function openDb() {
    if (!window.indexedDB) return Promise.reject(new Error('Bu tarayıcı yerel görsel saklamayı desteklemiyor.'));
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = function () { reject(new Error('Yerel görsel deposu açılamadı.')); };
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = function () { resolve(request.result); };
    });
  }
  function transaction(mode, action) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode), store = tx.objectStore(STORE), request;
        try { request = action(store); } catch (error) { db.close(); reject(error); return; }
        tx.oncomplete = function () { db.close(); resolve(request && request.result); };
        tx.onerror = function () { db.close(); reject(new Error('Yerel görsel deposu işlemi başarısız oldu.')); };
        tx.onabort = function () { db.close(); reject(new Error('Yerel görsel deposu işlemi iptal edildi.')); };
      });
    });
  }
  function readImage(file, mime) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), image = new Image();
      image.onload = function () { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Görsel bozuk veya okunamıyor.')); };
      image.src = url;
    });
  }
  function normalize(file, mime) {
    return readImage(file, mime).then(function (image) {
      var width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
      if (!width || !height) fail('Görsel boyutları okunamadı.');
      var scale = Math.min(1, MAX_EDGE / Math.max(width, height));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      var ctx = canvas.getContext('2d');
      if (!ctx) fail('Görsel dönüştürülemedi.');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      var outputMime = mime === 'image/png' ? 'image/png' : 'image/webp';
      var quality = outputMime === 'image/png' ? undefined : 0.86;
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error('Görsel sıkıştırılamadı.')); return; }
          if (blob.size > MAX_BYTES) { reject(new Error('Görsel 10 MB sınırını aşıyor.')); return; }
          resolve({ blob: blob, width: canvas.width, height: canvas.height, mime: blob.type || outputMime });
        }, outputMime, quality);
      });
    });
  }
  function validate(file) {
    if (!file) return Promise.reject(new Error('Önce bir görsel seçin.'));
    if (Number(file.size) > MAX_BYTES) return Promise.reject(new Error('Görsel 10 MB sınırını aşıyor.'));
    var mime;
    try { mime = allowedMime(file); } catch (error) { return Promise.reject(error); }
    return arrayBuffer(file).then(function (bytes) {
      if (!signature(bytes, mime)) fail('Dosyanın gerçek görsel imzası MIME türüyle eşleşmiyor.');
      return normalize(file, mime);
    });
  }
  function localUpload(file, context) {
    return validate(file).then(function (normalized) {
      var meta = {
        id: id(), tur: 'arka-plan', kaynak: 'indexeddb', yol: '', mime: normalized.mime,
        genislik: normalized.width, yukseklik: normalized.height, alt: text(context && context.alt || 'Harita resmi').slice(0, 160),
        kaplama: context && context.kaplama === 'contain' ? 'contain' : 'cover',
        saydamlik: Math.max(0, Math.min(1, Number(context && context.saydamlik == null ? 1 : context.saydamlik))),
        olusturma: new Date().toISOString()
      };
      meta.yol = meta.id;
      return transaction('readwrite', function (store) { return store.put({ id: meta.id, meta: meta, blob: normalized.blob }); }).then(function () { return meta; });
    });
  }
  function localRead(meta) {
    if (!meta || !meta.id) return Promise.resolve(null);
    return transaction('readonly', function (store) { return store.get(meta.id); }).then(function (record) {
      return record && record.blob ? { meta: record.meta || meta, blob: record.blob, url: URL.createObjectURL(record.blob) } : null;
    });
  }
  function localDelete(meta) {
    return !meta || !meta.id ? Promise.resolve(true) : transaction('readwrite', function (store) { return store.delete(meta.id); }).then(function () { return true; });
  }
  window.EVH_GORSEL_URL = Object.create(null);
  window.EVH_GORSEL_UZAK_META = Object.create(null);
  var uzakBekleyen = Object.create(null);
  window.evrenGorselGoster = function (meta, rerender, evrenId) {
    if (!meta || !meta.id || window.EVH_GORSEL_URL[meta.id]) return;
    window.evrenGorselVarlik.oku(meta, { kaynak: meta.kaynak, evrenId: evrenId }).then(function (record) {
      if (!record || !record.url) return;
      window.EVH_GORSEL_URL[meta.id] = record.url;
      if (typeof rerender === 'function') rerender();
    }).catch(function () {});
  };
  var BUCKET = 'evren-harita-gorselleri';
  var API_PATH = '/api/evren-gorsel';
  function apiBase() {
    try {
      if (location.protocol === 'http:' || location.protocol === 'https:') {
        if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return location.origin;
      }
    } catch (error) {}
    return 'https://tentifor.com';
  }
  function apiHeaders() {
    if (typeof hesapIstemci === 'undefined' || !hesapIstemci || !hesapIstemci.auth) return Promise.resolve({});
    return hesapIstemci.auth.getSession().then(function (result) {
      var token = result && result.data && result.data.session && result.data.session.access_token;
      return token ? { Authorization: 'Bearer ' + token } : {};
    });
  }
  function apiUrl(evrenId) { return apiBase() + API_PATH + '?evrenId=' + encodeURIComponent(String(evrenId || '')); }
  function remoteMetaFrom(response, evrenId, fallback) {
    var decodeAlt = 'Harita resmi';
    try { decodeAlt = decodeURIComponent(response.headers.get('X-EVH-Image-Alt') || 'Harita resmi'); } catch (error) {}
    fallback = fallback || {};
    return {
      id: fallback.id || 'remote-' + String(evrenId), tur: 'arka-plan',
      kaynak: response.headers.get('X-EVH-Image-Source') === 'github' ? 'github' : 'supabase',
      yol: fallback.yol || (response.headers.get('X-EVH-Image-Source') === 'github' ? '' : (function () { try { return decodeURIComponent(response.headers.get('X-EVH-Image-Path') || ''); } catch (error) { return ''; } }())), mime: response.headers.get('X-EVH-Image-Mime') || fallback.mime || '',
      boyut: fallback.boyut, genislik: Number(response.headers.get('X-EVH-Image-Width')) || fallback.genislik,
      yukseklik: Number(response.headers.get('X-EVH-Image-Height')) || fallback.yukseklik,
      alt: decodeAlt, kaplama: response.headers.get('X-EVH-Image-Fit') === 'contain' ? 'contain' : 'cover',
      saydamlik: Math.max(0, Math.min(1, Number(response.headers.get('X-EVH-Image-Opacity') == null ? 1 : response.headers.get('X-EVH-Image-Opacity')))),
      herkeseAcik: fallback.herkeseAcik === true
    };
  }
  function serverRead(meta, evrenId) {
    if (evrenId) {
      return apiHeaders().then(function (headers) { return fetch(apiUrl(evrenId), { headers: headers, credentials: 'omit' }); }).then(function (response) {
        if (!response.ok) return null;
        return response.blob().then(function (blob) {
          var resolved = remoteMetaFrom(response, evrenId, meta);
          return { meta: resolved, blob: blob, url: URL.createObjectURL(blob) };
        });
      });
    }
    if (!meta || !meta.yol || typeof hesapIstemci === 'undefined' || !hesapIstemci) return Promise.resolve(null);
    return hesapIstemci.storage.from(BUCKET).download(meta.yol).then(function (result) {
      if (!result || result.error || !result.data) return null;
      return { meta: meta, blob: result.data, url: URL.createObjectURL(result.data) };
    });
  }
  function serverDelete(meta, evrenId) {
    if (!evrenId) return Promise.reject(new Error('Görseli silmek için evren kimliği gerekli.'));
    if (meta && meta.kaynak === 'github') {
      return apiHeaders().then(function (headers) {
        return fetch(apiUrl(evrenId), { method: 'DELETE', headers: headers, credentials: 'omit' });
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok) throw new Error(data.error === 'login-required' ? 'Silmek için hesabınıza giriş yapmalısınız.' : 'Görsel GitHub’dan kaldırılamadı.');
          return data.cleanup === 'pending' ? { cleanupPending: true } : true;
        });
      });
    }
    if (typeof hesapIstemci === 'undefined' || !hesapIstemci) return Promise.reject(new Error('Eski Supabase görselini silmek için hesap bağlantısı gerekli.'));
    return hesapIstemci.rpc('evren_gorsel_varlik_sil', { p_evren_id: evrenId }).then(function (result) {
      if (result && result.error) throw result.error;
      if (result && result.data && result.data.durum !== 'tamam') throw new Error('Görsel silme izni doğrulanamadı.');
      return meta && meta.yol ? hesapIstemci.storage.from(BUCKET).remove([meta.yol]).then(function (removed) {
        if (removed && removed.error) throw removed.error;
        return true;
      }) : true;
    });
  }
  function serverMetaRead(evrenId) { return serverRead(null, evrenId).then(function (record) { return record || null; }); }
  function uzakGorselGoster(evrenId, rerender) {
    if (!evrenId || window.EVH_GORSEL_UZAK_META[evrenId]) return;
    if (!uzakBekleyen[evrenId]) {
      uzakBekleyen[evrenId] = serverMetaRead(evrenId).then(function (record) {
        if (!record || !record.meta || !record.url) return null;
        window.EVH_GORSEL_UZAK_META[evrenId] = record.meta;
        window.EVH_GORSEL_URL[record.meta.id] = record.url;
        return record.meta;
      }).catch(function () { return null; }).finally(function () { delete uzakBekleyen[evrenId]; });
    }
    uzakBekleyen[evrenId].then(function (meta) { if (meta && typeof rerender === 'function') rerender(meta); });
  }
  function serverUpload(file, context) {
    context = context || {};
    if (typeof hesapIstemci === 'undefined' || !hesapIstemci || typeof hesapKullanici === 'undefined' || !hesapKullanici) return Promise.reject(new Error('Hesaba aktarmak için giriş yapmalısınız.'));
    if (!context.evrenId) return Promise.reject(new Error('Hesap aktarımı için evren kimliği eksik.'));
    return validate(file).then(function (normalized) {
      var form = new FormData();
      var ext = normalized.mime === 'image/png' ? 'png' : normalized.mime === 'image/jpeg' ? 'jpg' : 'webp';
      form.append('evrenId', String(context.evrenId));
      form.append('alt', text(context.alt || 'Harita resmi').slice(0, 160));
      form.append('kaplama', context.kaplama === 'contain' ? 'contain' : 'cover');
      form.append('saydamlik', String(context.saydamlik == null ? 1 : context.saydamlik));
      form.append('file', normalized.blob, 'harita.' + ext);
      return apiHeaders().then(function (headers) { return fetch(apiUrl(context.evrenId), { method: 'POST', headers: headers, body: form, credentials: 'omit' }); }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok) {
            var messages = { 'login-required': 'Hesabınıza tekrar giriş yapın.', 'not-authorized': 'Bu evren için görsel yükleme izniniz yok.', 'image-too-large': 'Görsel 10 MB sınırını aşıyor.', 'unsupported-image': 'Yalnızca PNG, JPEG veya WebP görseller kabul edilir.', 'image-storage-not-configured': 'GitHub görsel deposu henüz yapılandırılmadı.', 'image-cleanup-failed': 'Görsel sunucudan güvenle kaldırılamadı; metadata korunuyor, lütfen tekrar deneyin.' };
            throw new Error(messages[data.error] || 'Görsel GitHub’a aktarılamadı.');
          }
          if (data.id && window.EVH_GORSEL_URL[data.id]) URL.revokeObjectURL(window.EVH_GORSEL_URL[data.id]);
          if (data.id) delete window.EVH_GORSEL_URL[data.id];
          if (context.evrenId) delete window.EVH_GORSEL_UZAK_META[context.evrenId];
          return data;
        });
      });
    });
  }
  window.evrenGorselVarlik = {
    MAX_BYTES: MAX_BYTES,
    BUCKET: BUCKET,
    MAX_EDGE: MAX_EDGE,
    validate: validate,
    yukle: function (file, context) {
      context = context || {};
      if (context.kaynak === 'supabase' || context.kaynak === 'github') return serverUpload(file, context);
      return localUpload(file, context);
    },
    oku: function (meta, context) {
      context = context || {};
      if (context.kaynak === 'supabase' || context.kaynak === 'github') return serverRead(meta, context.evrenId);
      return localRead(meta);
    },
    sil: function (meta, context) {
      context = context || {};
      if (context.kaynak === 'supabase' || context.kaynak === 'github') return serverDelete(meta, context.evrenId);
      return localDelete(meta);
    },
    disaAktar: function (meta) { return localRead(meta); },
    uzaktanOku: serverMetaRead,
    uzakGorselGoster: uzakGorselGoster,
    gomuluAktar: function (meta, dataUrl) {
      if (!dataUrl || !/^data:image\/(png|jpeg|webp);base64,/i.test(dataUrl)) return Promise.reject(new Error('Gömülü görsel biçimi geçersiz.'));
      return fetch(dataUrl).then(function (response) { return response.blob(); }).then(function (blob) { return localUpload(blob, meta || {}); });
    },
    hesabaAktar: function (meta, evrenId, context) {
      return localRead(meta).then(function (record) {
        if (!record || !record.blob) throw new Error('Yerel görsel bulunamadı.');
        context = Object.assign({}, context || {}, { kaynak: 'github', evrenId: evrenId, alt: context && context.alt || meta.alt, kaplama: context && context.kaplama || meta.kaplama, saydamlik: context && context.saydamlik == null ? meta.saydamlik : context && context.saydamlik });
        return serverUpload(record.blob, context).then(function (remote) {
          if (window.EVH_GORSEL_URL[meta.id]) URL.revokeObjectURL(window.EVH_GORSEL_URL[meta.id]);
          delete window.EVH_GORSEL_URL[meta.id];
          return localDelete(meta).catch(function () {}).then(function () { if (record.url) URL.revokeObjectURL(record.url); return remote; });
        });
      });
    }
  };
}());

(function () {
  function durum(message, good) {
    var node = document.querySelector('#evrenSayfa [data-evh-gorsel-alan]');
    if (!node) return;
    var status = node.querySelector('[data-evh-gorsel-durum]');
    if (!status) { status = document.createElement('p'); status.setAttribute('data-evh-gorsel-durum', ''); node.appendChild(status); }
    status.className = 'pencere-durum ' + (good ? 'iyi' : 'kotu');
    status.textContent = message;
  }
  document.addEventListener('click', function (event) {
    var transfer = event.target.closest && event.target.closest('[data-evh-gorsel-hesaba]');
    if (transfer) {
      var transferPage = typeof evrenSayfaVerisi === 'function' ? evrenSayfaVerisi() : null;
      var transferMap = transferPage && typeof evrenHaritaVerisi === 'function' ? evrenHaritaVerisi(transferPage) : null;
      var transferMeta = transferMap && transferMap.duzen && transferMap.duzen.gorsel;
      var transferId = typeof EVS !== 'undefined' && EVS ? EVS.id : '';
      if (!transferMeta || !transferId || typeof evrenGorselVarlik === 'undefined') return;
      transfer.disabled = true; durum('Hesaba aktarılıyor…', false);
      evrenGorselVarlik.hesabaAktar(transferMeta, transferId).then(function (serverMeta) {
        if (typeof evrenHaritaDegistir === 'function') evrenHaritaDegistir(function (draft) { draft.gorsel = serverMeta; });
        if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
        durum('Görsel hesabınıza GitHub üzerinden kaydedildi.', true);
      }).catch(function (error) { durum(error && error.message || 'Hesaba aktarılamadı.', false); }).finally(function () { transfer.disabled = false; });
      return;
    }
    var remove = event.target.closest && event.target.closest('[data-evh-gorsel-sil]');
    if (remove) {
      var current = typeof evrenSayfaVerisi === 'function' ? evrenSayfaVerisi() : null;
      var map = current && typeof evrenHaritaVerisi === 'function' ? evrenHaritaVerisi(current) : null;
      var meta = map && map.duzen && map.duzen.gorsel;
      if (!meta || typeof evrenHaritaDegistir !== 'function') return;
      var removeId = typeof EVS !== 'undefined' && EVS ? EVS.id : '';
      remove.disabled = true; durum('Görsel kaldırılıyor…', false);
      evrenGorselVarlik.sil(meta, { kaynak: meta.kaynak, evrenId: removeId }).then(function (result) {
        evrenHaritaDegistir(function (draft) { delete draft.gorsel; });
        if (window.EVH_GORSEL_URL[meta.id]) URL.revokeObjectURL(window.EVH_GORSEL_URL[meta.id]);
        delete window.EVH_GORSEL_URL[meta.id];
        if (removeId) delete window.EVH_GORSEL_UZAK_META[removeId];
        if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
        durum(result && result.cleanupPending ? 'Harita resimden kaldırıldı; sunucu temizliği daha sonra tamamlanacak.' : 'Harita resmi kaldırıldı.', true);
      }).catch(function (error) {
        durum(error && error.message || 'Harita resmi kaldırılamadı.', false);
      }).finally(function () { remove.disabled = false; });
      return;
    }
    var choose = event.target.closest && event.target.closest('[data-evh-gorsel-alan] label[for="evhGorselDosya"]');
    if (choose) {
      var input = document.getElementById('evhGorselDosya');
      if (input) input.click();
    }
  });
  function gorselAyarGuncelle(input) {
    if (input && input.matches && input.matches('[data-evh-gorsel-alt], [data-evh-gorsel-kaplama], [data-evh-gorsel-saydamlik]')) {
      var settingsPage = typeof evrenSayfaVerisi === 'function' ? evrenSayfaVerisi() : null;
      var settingsMap = settingsPage && typeof evrenHaritaVerisi === 'function' ? evrenHaritaVerisi(settingsPage) : null;
      if (!settingsMap || !settingsMap.duzen || !settingsMap.duzen.gorsel || typeof evrenHaritaDegistir !== 'function') return true;
      var field = input.hasAttribute('data-evh-gorsel-alt') ? 'alt' : input.hasAttribute('data-evh-gorsel-kaplama') ? 'kaplama' : 'saydamlik';
      var value = field === 'alt' ? String(input.value || '').slice(0, 160) : field === 'kaplama' ? (input.value === 'contain' ? 'contain' : 'cover') : Math.max(0, Math.min(1, Number(input.value) || 0));
      evrenHaritaDegistir(function (draft) { draft.gorsel[field] = value; });
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return true;
    }
    return false;
  }
  document.addEventListener('input', function (event) { gorselAyarGuncelle(event.target); });
  document.addEventListener('change', function (event) {
    var input = event.target;
    if (gorselAyarGuncelle(input)) return;
    if (!input || !input.matches || !input.matches('[data-evh-gorsel-input]')) return;
    var file = input.files && input.files[0];
    if (!file || typeof evrenGorselVarlik === 'undefined' || typeof evrenHaritaDegistir !== 'function') return;
    durum('Görsel doğrulanıyor…', false);
    evrenGorselVarlik.yukle(file, { alt: 'Harita resmi' }).then(function (meta) {
      var old = typeof evrenSayfaVerisi === 'function' ? evrenSayfaVerisi() : null;
      var data = old && typeof evrenHaritaVerisi === 'function' ? evrenHaritaVerisi(old) : null;
      var previous = data && data.duzen && data.duzen.gorsel;
      var imageWorldId = typeof EVS !== 'undefined' && EVS ? EVS.id : '';
      evrenHaritaDegistir(function (draft) { draft.gorsel = meta; });
      if (previous && previous.id !== meta.id) evrenGorselVarlik.sil(previous, { kaynak: previous.kaynak, evrenId: imageWorldId }).catch(function () {});
      return evrenGorselVarlik.oku(meta).then(function (record) {
        if (record && record.url) window.EVH_GORSEL_URL[meta.id] = record.url;
        if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
        durum('Harita resmi bu cihaza kaydedildi.', true);
      });
    }).catch(function (error) { durum(error && error.message || 'Görsel kaydedilemedi.', false); });
    input.value = '';
  });
}());
