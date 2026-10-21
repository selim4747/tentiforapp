/* TentiFor — custom-universe portraits, items, buildings and free/paid artwork. */
(function () {
  'use strict';

  var FORMAT = 'tentifor-evren-gorselleri';
  var MAX_FILE_BYTES = 20 * 1024 * 1024;
  var TYPE_NAMES = { esya: 'Özel eşya', bina: 'Özel bina', cizim: 'Çizim' };

  function esc(value) {
    return typeof window.kacir === 'function'
      ? window.kacir(value)
      : String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
  }
  function currentState() {
    return typeof EVS !== 'undefined' && EVS ? EVS : null;
  }
  function currentPage() {
    try { return typeof window.evrenSayfaVerisi === 'function' ? window.evrenSayfaVerisi() : null; }
    catch (_) { return null; }
  }
  function currentWorld() {
    var page = currentPage();
    return page && page.eser || null;
  }
  function isOwner(page) {
    var state = currentState();
    return !!((state && state.kaynak === 'benim') || (page && page.kaynak === 'benim'));
  }
  function metaSanitize(meta) {
    if (typeof window.evrenVarlikGorselTemizle === 'function') return window.evrenVarlikGorselTemizle(meta);
    return null;
  }
  function records(world) {
    return Array.isArray(world && world.varliklar) ? world.varliklar : [];
  }
  function source(meta) {
    if (!meta) return '';
    var urls = window.EVH_GORSEL_URL || {};
    if (meta.id && urls[meta.id]) return urls[meta.id];
    if (meta.kaynak === 'embedded' && typeof meta.veri === 'string' && /^data:image\/(png|jpeg|webp);base64,/i.test(meta.veri)) return meta.veri;
    return '';
  }
  function showSlot(meta, worldId) {
    if (!meta || !meta.id || source(meta) || typeof window.evrenGorselGoster !== 'function') return;
    window.evrenGorselGoster(meta, function () { refreshImageSlots(meta.id); }, worldId);
  }
  function refreshImageSlots(id) {
    var metaId = String(id || ''), url = (window.EVH_GORSEL_URL || {})[metaId];
    if (!url) return;
    document.querySelectorAll('[data-eva-gorsel-slot]').forEach(function (slot) {
      if (slot.getAttribute('data-eva-gorsel-slot') !== metaId) return;
      var img = document.createElement('img');
      img.alt = slot.getAttribute('data-eva-gorsel-alt') || 'Evren görseli';
      img.src = url;
      img.loading = 'lazy';
      img.style.cssText = 'display:block;max-width:100%;max-height:280px;width:auto;height:auto;object-fit:contain;margin:auto';
      slot.replaceChildren(img);
    });
  }
  function imageHtml(meta, alt, worldId) {
    if (!meta) return '<div class="galeri-bos">Görsel eklenmemiş</div>';
    var url = source(meta);
    if (url) return '<img data-eva-gorsel-slot="' + esc(meta.id) + '" data-eva-gorsel-alt="' + esc(alt || meta.alt || 'Evren görseli') + '" src="' + esc(url) + '" alt="' + esc(alt || meta.alt || 'Evren görseli') + '" loading="lazy" style="display:block;max-width:100%;max-height:280px;width:auto;height:auto;object-fit:contain;margin:auto">';
    showSlot(meta, worldId);
    return '<div class="galeri-bos" data-eva-gorsel-slot="' + esc(meta.id) + '" data-eva-gorsel-alt="' + esc(alt || meta.alt || 'Evren görseli') + '" role="status">Görsel yükleniyor…</div>';
  }
  function lockId(world, record) {
    return 'evr_' + String(world && world.id || 'evren').replace(/[^A-Za-z0-9_-]/g, '') + '_varlik_' + String(record && record.id || '').replace(/[^A-Za-z0-9_-]/g, '');
  }
  function unlocked(id, price) {
    return Number(price) <= 0 || (typeof window.kilitAcik === 'function' && window.kilitAcik(id));
  }
  function publicCard(world, record, index) {
    var type = TYPE_NAMES[record.tur] || 'Varlık';
    var id = lockId(world, record), price = Math.max(0, Math.floor(Number(record.fiyat) || 0));
    var open = record.tur !== 'cizim' || unlocked(id, price);
    var picture = open
      ? imageHtml(metaSanitize(record.gorsel), record.baslik || type, world.id)
      : '<div class="galeri-kilit"><b>🔒 ' + price + ' eçka</b><button type="button" class="dugme" data-eva-varlik-al="' + esc(id) + '" data-fiyat="' + price + '">Aç (' + price + ' eçka)</button></div>';
    return '<article class="galeri-kart"><div class="galeri-gorsel">' + picture + '</div><div class="galeri-alt"><span class="oyun-etiket">' + esc(type) + '</span><h4>' + esc(record.baslik || type + ' ' + (index + 1)) + '</h4><p>' + esc(open ? record.aciklama || '' : 'Eçka ile kilitli çizim') + '</p>' + (record.tur === 'cizim' ? '<span class="oyun-not">' + (price ? price + ' eçka' : 'Ücretsiz') + '</span>' : '') + '</div></article>';
  }
  function portraitCard(person, index, worldId) {
    var portrait = metaSanitize(person && person.portre);
    if (!portrait) return '';
    return '<article class="galeri-kart"><div class="galeri-gorsel">' + imageHtml(portrait, person.ad || 'Karakter portresi', worldId) + '</div><div class="galeri-alt"><span class="oyun-etiket">Karakter portresi</span><h4>' + esc(person.ad || 'Karakter ' + (index + 1)) + '</h4><p>' + esc(person.aciklama || person.ozet || '') + '</p></div></article>';
  }
  function publicHtml(world) {
    var items = records(world), portraits = (Array.isArray(world && world.kisiler) ? world.kisiler : []).map(function (person, index) { return portraitCard(person, index, world.id); }).filter(Boolean);
    var cards = items.map(function (record, index) { return publicCard(world, record, index); }).join('');
    return '<section class="evren-varliklar"><div class="kutu-y"><h3>🧰 ' + esc(world.ad || 'Evren') + ' · Varlıklar ve çizimler</h3><p class="oyun-not">Özel eşyalar ve binalar bu evrenin kayıtlarıdır. Kilitli çizimler yalnızca site içi sanal eçka ile açılır; gerçek para veya kart kullanılmaz.</p></div>' + (portraits.length ? '<h3 class="evs-ara-baslik">Karakter portreleri</h3><div class="galeri-izgara">' + portraits.join('') + '</div>' : '') + (cards ? '<h3 class="evs-ara-baslik">Özel eşyalar, binalar ve çizimler</h3><div class="galeri-izgara">' + cards + '</div>' : '<div class="kutu-y"><p class="oyun-not">Bu evrende henüz özel eşya, bina veya çizim yok.</p></div>') + '</section>';
  }
  function characterEditor(world) {
    var people = (Array.isArray(world.kisiler) ? world.kisiler : []).map(function (person, index) {
      if (!person || person.kutu) return '';
      var meta = metaSanitize(person.portre);
      return '<fieldset class="fan-grup eva-portre" data-eva-portre-kart="' + index + '"><legend>' + esc(person.ad || 'Karakter ' + (index + 1)) + '</legend><div class="galeri-gorsel">' + imageHtml(meta, person.ad || 'Karakter portresi', world.id) + '</div><label>Portre seç <input class="kod-giris" type="file" accept="image/png,image/jpeg,image/webp" data-eva-portre="' + index + '"></label><button type="button" class="dugme dugme-sade" data-eva-portre-sil="' + index + '"' + (meta ? '' : ' disabled') + '>Portreyi kaldır</button></fieldset>';
    }).join('');
    return '<section><h3>Karakter portreleri</h3><p class="oyun-not">Önce “Kişiler” bölümünde karakter ekle. Görseller bu cihazda güvenli biçimde saklanır.</p>' + (people || '<div class="kutu-y"><p class="oyun-not">Henüz karakter yok. <button type="button" class="dugme dugme-sade" data-evr-adim="kisiler">Kişiler adımına git</button></p></div>') + '</section>';
  }
  function recordEditor(world, record, index) {
    var title = TYPE_NAMES[record.tur] || 'Varlık';
    var meta = metaSanitize(record.gorsel);
    var price = Math.max(0, Math.floor(Number(record.fiyat) || 0));
    return '<fieldset class="fan-grup eva-varlik" data-eva-varlik-kart="' + esc(record.id) + '"><legend>' + esc(title) + ' · ' + esc(record.baslik || 'Adsız kayıt') + '</legend><div class="galeri-gorsel">' + imageHtml(meta, record.baslik || title, world.id) + '</div><label>Adı <input class="kod-giris" maxlength="120" value="' + esc(record.baslik || '') + '" data-eva-varlik-alan="' + esc(record.id) + ':baslik"></label><label>Açıklama <textarea class="kod-giris" rows="3" maxlength="2000" data-eva-varlik-alan="' + esc(record.id) + ':aciklama">' + esc(record.aciklama || '') + '</textarea></label>' + (record.tur === 'cizim' ? '<label>Eçka fiyatı (0 = ücretsiz) <input class="kod-giris" type="number" min="0" max="10000" step="1" value="' + price + '" data-eva-varlik-alan="' + esc(record.id) + ':fiyat"></label>' : '') + '<label>Görsel yükle <input class="kod-giris" type="file" accept="image/png,image/jpeg,image/webp" data-eva-varlik-gorsel="' + esc(record.id) + '"></label><button type="button" class="dugme dugme-sade" data-eva-varlik-sil="' + esc(record.id) + '">Kaydı sil</button><p class="pencere-durum" role="status" data-eva-varlik-kart-durum="' + esc(record.id) + '"></p></fieldset>';
  }
  function editorHtml(world) {
    var items = records(world);
    return '<div class="eva-varlik-editor"><div class="kutu-y"><h3>Evren varlıklarını oluştur ve düzenle</h3><p class="oyun-not">Karakter portreleri, özel eşyalar, özel binalar ve ücretsiz veya eçka ile açılan çizimler ekleyebilirsin. Görseller bu tarayıcı profilindeki IndexedDB’de saklanır; dışa aktarma dosyasıyla başka cihaza taşıyabilirsin. Eçka tamamen sanal oyun içi paradır.</p><div class="oyun-sira"><button type="button" class="dugme" data-eva-varlik-yeni="esya">+ Özel eşya</button><button type="button" class="dugme" data-eva-varlik-yeni="bina">+ Özel bina</button><button type="button" class="dugme dugme-sade" data-eva-varlik-yeni="cizim">+ Çizim ekle</button></div><div class="oyun-sira"><button type="button" class="dugme dugme-sade" data-eva-gorsel-disari>Görsel içeriğini dışa aktar</button><label class="dugme dugme-sade">Görsel içeriğini içe aktar <input type="file" accept="application/json,.json" data-eva-gorsel-iceri style="display:none"></label></div><p class="pencere-durum" role="status" data-eva-gorsel-durum></p></div><section><h3>Özel eşyalar, binalar ve çizimler</h3>' + (items.length ? items.map(function (record, index) { return recordEditor(world, record, index); }).join('') : '<div class="kutu-y"><p class="oyun-not">Henüz özel eşya, bina veya çizim eklenmedi.</p></div>') + '</section>' + characterEditor(world) + '</div>';
  }
  function tabsHook() {
    var old = window.evrenEkSekmeler;
    if (typeof old === 'function' && !old.__evaVisual) {
      var wrapped = function (page) {
        var tabs = old.apply(this, arguments);
        tabs = Array.isArray(tabs) ? tabs.slice() : [];
        var world = page && page.eser || currentWorld();
        if ((isOwner(page) || records(world).length || (world && Array.isArray(world.kisiler) && world.kisiler.some(function (person) { return person && person.portre; }))) && !tabs.some(function (tab) { return tab && tab[0] === 'varliklar'; })) tabs.push(['varliklar', '🧰 Varlıklar']);
        return tabs;
      };
      wrapped.__evaVisual = true;
      window.evrenEkSekmeler = wrapped;
    }
    var oldSection = window.evrenEkBolum;
    if (typeof oldSection === 'function' && !oldSection.__evaVisual) {
      var section = function (page) {
        var state = currentState();
        if (state && state.sekme === 'varliklar') {
          var world = page && page.eser || currentWorld();
          return world ? (isOwner(page) ? editorHtml(world) : publicHtml(world)) : '<p class="oyun-not">Evren verisi yüklenemedi.</p>';
        }
        return oldSection.apply(this, arguments);
      };
      section.__evaVisual = true;
      window.evrenEkBolum = section;
    }
  }
  function creatorCardHook() {
    var original = window.evrKurucuHtml;
    if (typeof original !== 'function' || original.__evaVisual) return;
    var wrapped = function (page) {
      var html = original.apply(this, arguments);
      if (isOwner(page) && html.indexOf('data-eva-varlik-card-link') === -1) {
        var marker = '<div class="evr-kartlar">';
        if (html.indexOf(marker) !== -1) html = html.replace(marker, marker + '<button type="button" class="evr-kart" data-eva-varlik-card-link data-evs-sekme="varliklar"><b>🧰 Özel varlıklar</b><span>Karakter portresi, özel eşya/bina ve ücretsiz ya da eçka ile açılan çizim ekle</span></button>');
      }
      return html;
    };
    wrapped.__evaVisual = true;
    window.evrKurucuHtml = wrapped;
  }
  function worldId() { var state = currentState(), world = currentWorld(); return String(state && state.id || world && world.id || ''); }
  function getWorldForEdit() {
    var state = currentState();
    if (!state || state.kaynak !== 'benim' || !state.id || typeof window.evrenBenimBul !== 'function') return null;
    return window.evrenBenimBul(state.id);
  }
  function mutateWorld(mutator) {
    var id = worldId();
    if (!id || typeof window.evrenBenimDegistir !== 'function') throw new Error('Evren düzenleme aracı hazır değil.');
    window.evrenBenimDegistir(id, mutator);
    var updated = getWorldForEdit();
    if (!updated) throw new Error('Evren taslağı kaydedilemedi.');
    return updated;
  }
  function setStatus(message, good) {
    var node = document.querySelector('#evrenSayfa [data-eva-gorsel-durum]');
    if (node) { node.textContent = message; node.className = 'pencere-durum ' + (good ? 'iyi' : 'kotu'); }
  }
  function setRecordStatus(id, message, good) {
    var node = document.querySelector('#evrenSayfa [data-eva-varlik-kart-durum="' + String(id).replace(/[^A-Za-z0-9_-]/g, '') + '"]');
    if (node) { node.textContent = message; node.className = 'pencere-durum ' + (good ? 'iyi' : 'kotu'); }
  }
  function newId() {
    try { if (window.crypto && window.crypto.randomUUID) return 'v' + window.crypto.randomUUID().replace(/-/g, ''); } catch (_) {}
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function createRecord(type) {
    mutateWorld(function (world) {
      if (!Array.isArray(world.varliklar)) world.varliklar = [];
      if (world.varliklar.length >= 100) throw new Error('Bir evrende en fazla 100 özel varlık/çizim olabilir.');
      world.varliklar.push({ id: newId(), tur: type, baslik: '', aciklama: '', fiyat: 0, gorsel: null });
    });
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
  }
  function releaseMeta(meta) {
    if (!meta) return Promise.resolve();
    var url = window.EVH_GORSEL_URL && window.EVH_GORSEL_URL[meta.id];
    if (url) { try { URL.revokeObjectURL(url); } catch (_) {} delete window.EVH_GORSEL_URL[meta.id]; }
    if (meta.kaynak === 'indexeddb' && window.evrenGorselVarlik) return window.evrenGorselVarlik.sil(meta).catch(function () {});
    return Promise.resolve();
  }
  async function uploadImage(file, context) {
    if (!window.evrenGorselVarlik || typeof window.evrenGorselVarlik.yukle !== 'function') throw new Error('Görsel yükleme aracı hazır değil.');
    return window.evrenGorselVarlik.yukle(file, context);
  }
  async function saveRecordImage(id, file) {
    if (!file) throw new Error('Önce bir görsel seç.');
    var before = getWorldForEdit(), record = before && records(before).find(function (item) { return item.id === id; });
    if (!record) throw new Error('Varlık bulunamadı; sayfayı yenileyip tekrar dene.');
    setRecordStatus(id, 'Görsel güvenli biçimde hazırlanıyor…', true);
    var uploaded = await uploadImage(file, { tur: record.tur === 'cizim' ? 'cizim' : 'varlik', alt: record.baslik || TYPE_NAMES[record.tur], kaplama: 'contain' });
    var old = record.gorsel;
    try {
      mutateWorld(function (world) { var target = records(world).find(function (item) { return item.id === id; }); if (!target) throw new Error('Varlık silinmiş.'); target.gorsel = uploaded; });
    } catch (error) { await releaseMeta(uploaded); throw error; }
    if (old && old.id !== uploaded.id) await releaseMeta(old);
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
    setRecordStatus(id, 'Görsel eklendi ve bu cihaza kaydedildi.', true);
  }
  async function savePortrait(index, file) {
    if (!file) throw new Error('Önce bir görsel seç.');
    var before = getWorldForEdit(), person = before && before.kisiler && before.kisiler[index];
    if (!person || person.kutu) throw new Error('Karakter bulunamadı.');
    setStatus('Karakter portresi hazırlanıyor…', true);
    var uploaded = await uploadImage(file, { tur: 'portre', alt: person.ad || 'Karakter portresi', kaplama: 'contain' });
    var old = person.portre;
    try {
      mutateWorld(function (world) { var target = world.kisiler && world.kisiler[index]; if (!target || target.kutu) throw new Error('Karakter silinmiş.'); target.portre = uploaded; });
    } catch (error) { await releaseMeta(uploaded); throw error; }
    if (old && old.id !== uploaded.id) await releaseMeta(old);
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
    setStatus('Karakter portresi kaydedildi.', true);
  }
  function updateRecordField(id, field, value) {
    if (['baslik', 'aciklama', 'fiyat'].indexOf(field) < 0) return;
    if (field === 'fiyat') {
      var price = Number(value);
      if (!Number.isInteger(price) || price < 0 || price > 10000) { setRecordStatus(id, 'Fiyat 0–10.000 arasında tam sayı olmalı.', false); return; }
      value = price;
    } else value = String(value || '').slice(0, field === 'baslik' ? 120 : 2000);
    try { mutateWorld(function (world) { var item = records(world).find(function (record) { return record.id === id; }); if (item) item[field] = value; }); setRecordStatus(id, 'Taslak bu cihaza kaydedildi.', true); }
    catch (error) { setRecordStatus(id, error.message || 'Kaydedilemedi.', false); }
  }
  async function removeRecord(id) {
    var world = getWorldForEdit(), item = world && records(world).find(function (record) { return record.id === id; });
    if (!item) return;
    mutateWorld(function (draft) { draft.varliklar = records(draft).filter(function (record) { return record.id !== id; }); });
    await releaseMeta(item.gorsel);
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
  }
  async function removePortrait(index) {
    var world = getWorldForEdit(), person = world && world.kisiler && world.kisiler[index];
    if (!person || !person.portre) return;
    var old = person.portre;
    mutateWorld(function (draft) { var target = draft.kisiler && draft.kisiler[index]; if (target) delete target.portre; });
    await releaseMeta(old);
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
  }
  function asDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('Görsel dışa aktarılamadı.')); };
      reader.readAsDataURL(blob);
    });
  }
  async function portableMeta(meta) {
    if (!meta) return null;
    var safe = metaSanitize(meta);
    if (!safe) throw new Error('Görsel bilgisi geçersiz; dışa aktarma durduruldu.');
    if (safe.kaynak === 'embedded' && safe.veri) return safe;
    if (safe.kaynak !== 'indexeddb' || !window.evrenGorselVarlik) throw new Error('Bu görsel cihazda bulunmuyor. Önce resmi yeniden yükle.');
    var record = await window.evrenGorselVarlik.disaAktar(safe);
    if (!record || !record.blob) throw new Error('Görsel dosyası bu cihazda bulunamadı.');
    try { safe.veri = await asDataUrl(record.blob); }
    finally { if (record.url) { try { URL.revokeObjectURL(record.url); } catch (_) {} } }
    safe.kaynak = 'embedded';
    safe.yol = '';
    return safe;
  }
  async function exportVisuals() {
    var world = getWorldForEdit();
    if (!world) throw new Error('Dışa aktarma yalnızca kendi evreninde kullanılabilir.');
    var payload = {
      format: FORMAT,
      version: 1,
      evrenId: world.id,
      evrenAdi: world.ad,
      varliklar: JSON.parse(JSON.stringify(records(world))),
      portreler: (Array.isArray(world.kisiler) ? world.kisiler : []).map(function (person, index) { return person && person.portre ? { index: index, ad: person.ad || '', portre: JSON.parse(JSON.stringify(person.portre)) } : null; }).filter(Boolean)
    };
    for (var i = 0; i < payload.varliklar.length; i += 1) payload.varliklar[i].gorsel = await portableMeta(payload.varliklar[i].gorsel);
    for (var j = 0; j < payload.portreler.length; j += 1) payload.portreler[j].portre = await portableMeta(payload.portreler[j].portre);
    var blob = new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' });
    if (blob.size > MAX_FILE_BYTES) throw new Error('Görsel paketi 20 MB sınırını aşıyor; daha az veya daha küçük görsel seç.');
    var url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = (String(world.id || 'evren').replace(/[^A-Za-z0-9_-]/g, '') || 'evren') + '-gorseller.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setStatus('Görsel paketi indirildi. Başka bir cihazda Varlıklar → Görsel içeriğini içe aktar ile açabilirsin.', true);
  }
  function normalizeName(value) { return String(value || '').trim().toLocaleLowerCase('tr-TR'); }
  async function importVisuals(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) throw new Error('Görsel paketi 20 MB sınırını aşıyor.');
    var text = await file.text(), payload;
    try { payload = JSON.parse(text); } catch (_) { throw new Error('Dosya geçerli JSON değil.'); }
    if (!payload || payload.format !== FORMAT || payload.version !== 1 || !Array.isArray(payload.varliklar) || !Array.isArray(payload.portreler)) throw new Error('Bu, TentiFor evren görsel paketi değil.');
    var world = getWorldForEdit();
    if (!world) throw new Error('Görseller yalnızca kendi evrenine içe aktarılabilir.');
    if (payload.varliklar.length > 100 || payload.portreler.length > 120) throw new Error('Paket çok fazla kayıt içeriyor.');
    var cleanRecords = typeof window.evrenVarliklarTemizle === 'function' ? window.evrenVarliklarTemizle(payload.varliklar) : null;
    if (!Array.isArray(cleanRecords)) throw new Error('Varlık verisi doğrulanamadı.');
    var uploads = [];
    async function importMeta(meta) {
      if (!meta) return null;
      var safe = metaSanitize(meta);
      if (!safe || safe.kaynak !== 'embedded' || !safe.veri) throw new Error('Taşınabilir paket içinde gömülü olmayan veya geçersiz görsel var.');
      var newMeta = await window.evrenGorselVarlik.gomuluAktar(safe, safe.veri);
      uploads.push(newMeta);
      return newMeta;
    }
    try {
      for (var i = 0; i < cleanRecords.length; i += 1) cleanRecords[i].gorsel = await importMeta(cleanRecords[i].gorsel);
      var portraits = [];
      for (var j = 0; j < payload.portreler.length; j += 1) {
        var entry = payload.portreler[j];
        if (!entry || typeof entry !== 'object') continue;
        var sourceMeta = metaSanitize(entry.portre);
        if (!sourceMeta) continue;
        portraits.push({ index: Number(entry.index), ad: String(entry.ad || ''), portre: await importMeta(sourceMeta) });
      }
      var old = getWorldForEdit(), oldAssets = [];
      (records(old)).forEach(function (item) { if (item.gorsel) oldAssets.push(item.gorsel); });
      (old.kisiler || []).forEach(function (person) { if (person && person.portre) oldAssets.push(person.portre); });
      mutateWorld(function (draft) {
        draft.varliklar = cleanRecords;
        (draft.kisiler || []).forEach(function (person) { if (person) delete person.portre; });
        portraits.forEach(function (entry) {
          var target = draft.kisiler && draft.kisiler[entry.index];
          if (!target || normalizeName(target.ad) !== normalizeName(entry.ad)) target = (draft.kisiler || []).find(function (person) { return person && normalizeName(person.ad) === normalizeName(entry.ad); });
          if (target) target.portre = entry.portre;
        });
      });
      var current = getWorldForEdit(), kept = new Set();
      records(current).forEach(function (item) { if (item.gorsel && item.gorsel.id) kept.add(item.gorsel.id); });
      (current.kisiler || []).forEach(function (person) { if (person && person.portre && person.portre.id) kept.add(person.portre.id); });
      for (var k = 0; k < oldAssets.length; k += 1) if (!kept.has(oldAssets[k].id)) await releaseMeta(oldAssets[k]);
      if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
      setStatus('Görsel paketi içe aktarıldı; eşleşen karakter portreleri ve varlıklar kaydedildi.', true);
    } catch (error) {
      for (var u = 0; u < uploads.length; u += 1) await releaseMeta(uploads[u]);
      throw error;
    }
  }
  function showPurchase(button) {
    if (typeof window.icerikSatinAl !== 'function') return;
    var state = currentState(), world = currentWorld();
    window.icerikSatinAl({ id: button.getAttribute('data-eva-varlik-al'), fiyat: Number(button.getAttribute('data-fiyat') || 0), onBasarili: function () { if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); } });
  }

  var previousTabs = window.evrenEkSekmeler;
  if (typeof previousTabs === 'function') {
    window.evrenEkSekmeler = function (page) {
      var tabs = previousTabs.apply(this, arguments);
      tabs = Array.isArray(tabs) ? tabs.slice() : [];
      var world = page && page.eser || currentWorld();
      var hasPortrait = !!(world && Array.isArray(world.kisiler) && world.kisiler.some(function (person) { return person && person.portre; }));
      if ((isOwner(page) || records(world).length || hasPortrait) && !tabs.some(function (tab) { return tab && tab[0] === 'varliklar'; })) tabs.push(['varliklar', '🧰 Varlıklar']);
      return tabs;
    };
  }
  var previousSection = window.evrenEkBolum;
  if (typeof previousSection === 'function') {
    window.evrenEkBolum = function (page) {
      var state = currentState();
      if (state && state.sekme === 'varliklar') {
        var world = page && page.eser || currentWorld();
        return world ? (isOwner(page) ? editorHtml(world) : publicHtml(world)) : '<p class="oyun-not">Evren verisi yüklenemedi.</p>';
      }
      return previousSection.apply(this, arguments);
    };
  }
  creatorCardHook();
  document.addEventListener('tf-veri-hazir', function () { creatorCardHook(); });

  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-eva-varlik-yeni], [data-eva-varlik-sil], [data-eva-portre-sil], [data-eva-gorsel-disari], [data-eva-varlik-al]');
    if (!button) return;
    if (button.hasAttribute('data-eva-varlik-yeni')) {
      try { createRecord(button.getAttribute('data-eva-varlik-yeni')); }
      catch (error) { setStatus(error.message || 'Kayıt eklenemedi.', false); }
      return;
    }
    if (button.hasAttribute('data-eva-varlik-sil')) { removeRecord(button.getAttribute('data-eva-varlik-sil')).catch(function (error) { setStatus(error.message || 'Kayıt silinemedi.', false); }); return; }
    if (button.hasAttribute('data-eva-portre-sil')) { removePortrait(Number(button.getAttribute('data-eva-portre-sil'))).catch(function (error) { setStatus(error.message || 'Portre kaldırılamadı.', false); }); return; }
    if (button.hasAttribute('data-eva-gorsel-disari')) { exportVisuals().catch(function (error) { setStatus(error.message || 'Dışa aktarılamadı.', false); }); return; }
    if (button.hasAttribute('data-eva-varlik-al')) showPurchase(button);
  });
  document.addEventListener('change', function (event) {
    var input = event.target;
    if (!input || !input.matches) return;
    if (input.matches('[data-eva-varlik-gorsel]')) {
      var id = input.getAttribute('data-eva-varlik-gorsel'), file = input.files && input.files[0];
      saveRecordImage(id, file).catch(function (error) { setRecordStatus(id, error.message || 'Görsel eklenemedi.', false); });
      input.value = '';
      return;
    }
    if (input.matches('[data-eva-portre]')) {
      var index = Number(input.getAttribute('data-eva-portre')), portraitFile = input.files && input.files[0];
      savePortrait(index, portraitFile).catch(function (error) { setStatus(error.message || 'Portre eklenemedi.', false); });
      input.value = '';
      return;
    }
    if (input.matches('[data-eva-gorsel-iceri]')) {
      var importFile = input.files && input.files[0];
      importVisuals(importFile).catch(function (error) { setStatus(error.message || 'İçe aktarılamadı.', false); });
      input.value = '';
    }
  });
  document.addEventListener('change', function (event) {
    var input = event.target;
    if (!input || !input.matches || !input.matches('[data-eva-varlik-alan]')) return;
    var parts = String(input.getAttribute('data-eva-varlik-alan') || '').split(':'), id = parts[0], field = parts[1];
    updateRecordField(id, field, input.value);
  });
}());
