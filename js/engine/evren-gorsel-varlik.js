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
  window.evrenGorselGoster = function (meta, rerender) {
    if (!meta || !meta.id || window.EVH_GORSEL_URL[meta.id]) return;
    window.evrenGorselVarlik.oku(meta, { kaynak: meta.kaynak }).then(function (record) {
      if (!record || !record.url) return;
      window.EVH_GORSEL_URL[meta.id] = record.url;
      if (typeof rerender === 'function') rerender();
    }).catch(function () {});
  };
  var BUCKET = 'evren-harita-gorselleri';
  function serverRead(meta) {
    if (!meta || !meta.yol || typeof hesapIstemci === 'undefined' || !hesapIstemci) return Promise.resolve(null);
    return hesapIstemci.storage.from(BUCKET).download(meta.yol).then(function (result) {
      if (!result || result.error || !result.data) return null;
      return { meta: meta, blob: result.data, url: URL.createObjectURL(result.data) };
    });
  }
  function serverDelete(meta, evrenId) {
    if (!meta || !evrenId || typeof hesapIstemci === 'undefined' || !hesapIstemci) return Promise.resolve(true);
    return hesapIstemci.rpc('evren_gorsel_varlik_sil', { p_evren_id: evrenId }).then(function (result) {
      if (result && result.error) throw result.error;
      return meta.yol ? hesapIstemci.storage.from(BUCKET).remove([meta.yol]).then(function () { return true; }) : true;
    });
  }
  function serverUpload(file, context) {
    context = context || {};
    if (typeof hesapIstemci === 'undefined' || !hesapIstemci || typeof hesapKullanici === 'undefined' || !hesapKullanici) return Promise.reject(new Error('Hesaba aktarmak için giriş yapmalısınız.'));
    if (!context.evrenId) return Promise.reject(new Error('Hesap aktarımı için evren kimliği eksik.'));
    return validate(file).then(function (normalized) {
      var assetId = id(), ext = normalized.mime === 'image/png' ? 'png' : normalized.mime === 'image/jpeg' ? 'jpg' : 'webp';
      var path = String(hesapKullanici.id) + '/' + String(context.evrenId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) + '/' + assetId + '.' + ext;
      return hesapIstemci.storage.from(BUCKET).upload(path, normalized.blob, { upsert: false, contentType: normalized.mime }).then(function (upload) {
        if (upload && upload.error) throw upload.error;
        return hesapIstemci.rpc('evren_gorsel_varlik_kaydet', {
          p_evren_id: context.evrenId, p_yol: path, p_mime: normalized.mime, p_boyut: normalized.blob.size,
          p_genislik: normalized.width, p_yukseklik: normalized.height, p_alt: context.alt || 'Harita resmi',
          p_kaplama: context.kaplama || 'cover', p_saydamlik: context.saydamlik == null ? 1 : context.saydamlik
        }).then(function (result) {
          if (result && result.error) return hesapIstemci.storage.from(BUCKET).remove([path]).then(function () { throw result.error; });
          var meta = result && result.data || {};
          return { id: assetId, tur: 'arka-plan', kaynak: 'supabase', yol: path, mime: normalized.mime,
            genislik: normalized.width, yukseklik: normalized.height, alt: context.alt || 'Harita resmi',
            kaplama: context.kaplama === 'contain' ? 'contain' : 'cover', saydamlik: Number(context.saydamlik) || 1,
            olusturma: new Date().toISOString(), sunucu: meta };
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
      if (context.kaynak === 'supabase') return serverUpload(file, context);
      return localUpload(file, context);
    },
    oku: function (meta, context) {
      context = context || {};
      if (context.kaynak === 'supabase') return serverRead(meta);
      return localRead(meta);
    },
    sil: function (meta, context) {
      context = context || {};
      if (context.kaynak === 'supabase') return serverDelete(meta, context.evrenId);
      return localDelete(meta);
    },
    disaAktar: function (meta) { return localRead(meta); },
    gomuluAktar: function (meta, dataUrl) {
      if (!dataUrl || !/^data:image\/(png|jpeg|webp);base64,/i.test(dataUrl)) return Promise.reject(new Error('Gömülü görsel biçimi geçersiz.'));
      return fetch(dataUrl).then(function (response) { return response.blob(); }).then(function (blob) { return localUpload(blob, meta || {}); });
    },
    hesabaAktar: function (meta, evrenId, context) {
      return localRead(meta).then(function (record) {
        if (!record || !record.blob) throw new Error('Yerel görsel bulunamadı.');
        context = Object.assign({}, context || {}, { kaynak: 'supabase', evrenId: evrenId, alt: context && context.alt || meta.alt, kaplama: context && context.kaplama || meta.kaplama, saydamlik: context && context.saydamlik == null ? meta.saydamlik : context && context.saydamlik });
        return serverUpload(record.blob, context);
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
        durum('Görsel hesabınıza kaydedildi.', true);
      }).catch(function (error) { durum(error && error.message || 'Hesaba aktarılamadı.', false); }).finally(function () { transfer.disabled = false; });
      return;
    }
    var remove = event.target.closest && event.target.closest('[data-evh-gorsel-sil]');
    if (remove) {
      var current = typeof evrenSayfaVerisi === 'function' ? evrenSayfaVerisi() : null;
      var map = current && typeof evrenHaritaVerisi === 'function' ? evrenHaritaVerisi(current) : null;
      var meta = map && map.duzen && map.duzen.gorsel;
      if (!meta || typeof evrenHaritaDegistir !== 'function') return;
      evrenHaritaDegistir(function (draft) { delete draft.gorsel; });
      delete window.EVH_GORSEL_URL[meta.id];
      if (typeof evrenGorselVarlik !== 'undefined') evrenGorselVarlik.sil(meta, { kaynak: meta.kaynak, evrenId: typeof EVS !== 'undefined' && EVS ? EVS.id : '' }).catch(function () {});
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }
    var choose = event.target.closest && event.target.closest('[data-evh-gorsel-alan] label[for="evhGorselDosya"]');
    if (choose) {
      var input = document.getElementById('evhGorselDosya');
      if (input) input.click();
    }
  });
  document.addEventListener('change', function (event) {
    var input = event.target;
    if (input && input.matches && input.matches('[data-evh-gorsel-alt], [data-evh-gorsel-kaplama], [data-evh-gorsel-saydamlik]')) {
      var settingsPage = typeof evrenSayfaVerisi === 'function' ? evrenSayfaVerisi() : null;
      var settingsMap = settingsPage && typeof evrenHaritaVerisi === 'function' ? evrenHaritaVerisi(settingsPage) : null;
      if (!settingsMap || !settingsMap.duzen || !settingsMap.duzen.gorsel || typeof evrenHaritaDegistir !== 'function') return;
      var field = input.hasAttribute('data-evh-gorsel-alt') ? 'alt' : input.hasAttribute('data-evh-gorsel-kaplama') ? 'kaplama' : 'saydamlik';
      var value = field === 'alt' ? String(input.value || '').slice(0, 160) : field === 'kaplama' ? (input.value === 'contain' ? 'contain' : 'cover') : Math.max(0, Math.min(1, Number(input.value) || 0));
      evrenHaritaDegistir(function (draft) { draft.gorsel[field] = value; });
      if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      return;
    }
    if (!input || !input.matches || !input.matches('[data-evh-gorsel-input]')) return;
    var file = input.files && input.files[0];
    if (!file || typeof evrenGorselVarlik === 'undefined' || typeof evrenHaritaDegistir !== 'function') return;
    durum('Görsel doğrulanıyor…', false);
    evrenGorselVarlik.yukle(file, { alt: 'Harita resmi' }).then(function (meta) {
      var old = typeof evrenSayfaVerisi === 'function' ? evrenSayfaVerisi() : null;
      var data = old && typeof evrenHaritaVerisi === 'function' ? evrenHaritaVerisi(old) : null;
      var previous = data && data.duzen && data.duzen.gorsel;
      evrenHaritaDegistir(function (draft) { draft.gorsel = meta; });
      if (previous && previous.id !== meta.id) evrenGorselVarlik.sil(previous).catch(function () {});
      return evrenGorselVarlik.oku(meta).then(function (record) {
        if (record && record.url) window.EVH_GORSEL_URL[meta.id] = record.url;
        if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
        durum('Harita resmi bu cihaza kaydedildi.', true);
      });
    }).catch(function (error) { durum(error && error.message || 'Görsel kaydedilemedi.', false); });
    input.value = '';
  });
}());
