/* TentiFor — structured, wiki-like custom-universe encyclopedia. */
(function () {
  'use strict';

  var TYPE_NAMES = { bitki: 'Bitki', hayvan: 'Hayvan', ozel: 'Diğer canlı / tür' };
  var BACKUP_FORMAT = 'tentifor-evren-ansiklopedi';
  var MAX_BACKUP_BYTES = 20 * 1024 * 1024;
  var FIELDS = [
    ['siniflandirma', 'Tür / sınıflandırma'], ['gorunum', 'Görünüş'], ['yasamDongusu', 'Yaşam döngüsü'],
    ['beslenme', 'Beslenme'], ['davranis', 'Davranış'], ['kullanim', 'Kullanım / tehlike'], ['ekolojikRol', 'Ekolojik rol']
  ];
  var selected = Object.create(null);
  var previewMode = Object.create(null);

  function installStyles() {
    if (document.getElementById('eaw-styles')) return;
    var style = document.createElement('style');
    style.id = 'eaw-styles';
    style.textContent = '.eaw-controls{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin:16px 0}.eaw-controls label,.eaw-entry label{display:block;margin:12px 0}.eaw-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}.eaw-card{padding:18px;border:1px solid var(--cizgi,#ced4da);background:var(--beyaz,#fff)}.eaw-card h4{margin:10px 0}.eaw-link{color:var(--deniz,#0f4c5c);font:inherit;font-weight:700;text-decoration:underline;background:none;border:0;padding:0;cursor:pointer;text-align:left}.eaw-entry{margin:16px 0}.eaw-entry input:not([type=checkbox]),.eaw-entry select,.eaw-entry textarea,.eaw-controls input,.eaw-controls select{display:block;width:100%;min-height:44px;margin-top:6px}.eaw-entry textarea{resize:vertical}.eaw-entry input[type=checkbox]{width:auto;min-height:auto;margin-right:8px}.eaw-entry select[multiple]{min-height:110px}.eaw-image-empty{min-height:70px;padding:20px;border:1px dashed var(--cizgi,#ced4da);color:var(--murekkep,#495057)}.eaw-article{max-width:980px;margin:16px auto}.eaw-article header{padding:20px 0}.eaw-article h3{font-size:1.6em;margin:8px 0}.eaw-intro{font-size:1.1em}.eaw-article-layout{display:grid;grid-template-columns:minmax(220px,360px) 1fr;gap:24px;margin:20px 0}.eaw-article-image,.eaw-fact{padding:14px;border:1px solid var(--cizgi,#ced4da);background:var(--beyaz,#fff)}.eaw-facts{display:grid;grid-template-columns:1fr 1fr;gap:12px}.eaw-fact b{color:var(--deniz,#0f4c5c)}.eaw-prose{line-height:1.7;margin:20px 0}.eaw-related,.eaw-tags{margin-top:14px}.eaw-tags span{display:inline-block;margin:4px 6px 4px 0;padding:3px 8px;border:1px solid var(--cizgi,#ced4da)}@media(max-width:700px){.eaw-controls,.eaw-article-layout,.eaw-facts{grid-template-columns:1fr}.eaw-list{grid-template-columns:1fr}.eaw-article{margin:8px 0}}';
    document.head.appendChild(style);
  }

  function esc(value) {
    return typeof window.kacir === 'function'
      ? window.kacir(value)
      : String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
  }
  function pageWorld(page) {
    return page && page.eser || (typeof window.evrenSayfaVerisi === 'function' && window.evrenSayfaVerisi() || {}).eser || null;
  }
  function currentState() { return typeof EVS !== 'undefined' && EVS ? EVS : null; }
  function owner(page) {
    var state = currentState();
    return !!((state && state.kaynak === 'benim') || (page && page.kaynak === 'benim'));
  }
  function records(world) { return Array.isArray(world && world.ansiklopediMaddeleri) ? world.ansiklopediMaddeleri : []; }
  function sanitizeImage(meta) {
    return typeof window.evrenVarlikGorselTemizle === 'function' ? window.evrenVarlikGorselTemizle(meta) : null;
  }
  function imageUrl(meta) {
    if (!meta) return '';
    var urls = window.EVH_GORSEL_URL || {};
    if (meta.id && urls[meta.id]) return urls[meta.id];
    if (meta.kaynak === 'embedded' && typeof meta.veri === 'string' && /^data:image\/(png|jpeg|webp);base64,/i.test(meta.veri)) return meta.veri;
    return '';
  }
  function imageHtml(meta, alt, worldId) {
    if (!meta) return '<div class="eaw-image-empty">Görsel eklenmemiş</div>';
    var url = imageUrl(meta);
    if (url) return '<img src="' + esc(url) + '" alt="' + esc(alt || 'Ansiklopedi görseli') + '" loading="lazy" style="max-width:100%;max-height:300px;object-fit:contain">';
    if (meta.kaynak === 'indexeddb' && typeof window.evrenGorselGoster === 'function') {
      window.evrenGorselGoster(meta, function () { if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); }, worldId);
      return '<div class="eaw-image-empty" role="status">Görsel bu tarayıcıda bulunamadı. Yazarın görsel yedeğini paylaşması gerekir.</div>';
    }
    return '<div class="eaw-image-empty" role="status">Bu görsel bu cihazda mevcut değil.</div>';
  }
  function id() {
    try { if (window.crypto && window.crypto.randomUUID) return 'w' + window.crypto.randomUUID().replace(/-/g, ''); } catch (_) {}
    return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function getWorldForEdit() {
    var state = currentState();
    if (!state || state.kaynak !== 'benim' || !state.id || typeof window.evrenBenimBul !== 'function') return null;
    return window.evrenBenimBul(state.id);
  }
  function mutate(mutator) {
    var state = currentState();
    if (!state || state.kaynak !== 'benim' || typeof window.evrenBenimDegistir !== 'function') throw new Error('Yalnızca kendi evrenini düzenleyebilirsin.');
    window.evrenBenimDegistir(state.id, mutator);
    var updated = getWorldForEdit();
    if (!updated) throw new Error('Ansiklopedi taslağı kaydedilemedi.');
    return updated;
  }
  function status(message, good) {
    var node = document.querySelector('#evrenSayfa [data-eaw-status]');
    if (node) { node.textContent = message; node.className = 'pencere-durum ' + (good ? 'iyi' : 'kotu'); }
  }
  function entryStatus(entryId, message, good) {
    var node = document.querySelector('#evrenSayfa [data-eaw-entry-status="' + String(entryId).replace(/[^A-Za-z0-9_-]/g, '') + '"]');
    if (node) { node.textContent = message; node.className = 'pencere-durum ' + (good ? 'iyi' : 'kotu'); }
  }
  function newEntry() {
    mutate(function (world) {
      if (!Array.isArray(world.ansiklopediMaddeleri)) world.ansiklopediMaddeleri = [];
      if (world.ansiklopediMaddeleri.length >= 300) throw new Error('Bir evrende en fazla 300 ansiklopedi maddesi olabilir.');
      world.ansiklopediMaddeleri.push({ id: id(), tur: 'bitki', baslik: '', ozet: '', aciklama: '', etiketler: [], habitat: '', ozellikler: {}, ilgiliIds: [], gorsel: null, spoiler: false, durum: 'taslak' });
    });
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
  }
  function blobDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('Görsel yedek dosyasına eklenemedi.')); };
      reader.readAsDataURL(blob);
    });
  }
  async function portableArticle(entry) {
    var copy = JSON.parse(JSON.stringify(entry));
    if (!copy.gorsel) return copy;
    var meta = sanitizeImage(copy.gorsel);
    if (!meta) throw new Error('Bir maddenin görsel metadata bilgisi geçersiz.');
    if (meta.kaynak === 'embedded') { copy.gorsel = meta; return copy; }
    if (!window.evrenGorselVarlik || typeof window.evrenGorselVarlik.disaAktar !== 'function') throw new Error('Yerel görsel yedek aracı hazır değil.');
    var record = await window.evrenGorselVarlik.disaAktar(meta);
    if (!record || !record.blob) throw new Error('Bir görsel dosyası bu cihazda bulunamadı.');
    try {
      meta.kaynak = 'embedded';
      meta.veri = await blobDataUrl(record.blob);
      copy.gorsel = sanitizeImage(meta);
      if (!copy.gorsel) throw new Error('Gömülü görsel güvenli biçimde doğrulanamadı.');
      return copy;
    } finally { if (record.url) { try { URL.revokeObjectURL(record.url); } catch (_) {} } }
  }
  async function exportEncyclopedia() {
    var world = getWorldForEdit();
    if (!world) throw new Error('Dışa aktarma yalnızca kendi evreninde kullanılabilir.');
    var articles = records(world), portable = [];
    for (var i = 0; i < articles.length; i += 1) portable.push(await portableArticle(articles[i]));
    var payload = { format: BACKUP_FORMAT, version: 1, evrenId: world.id, evrenAdi: world.ad || '', maddeler: portable };
    var blob = new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' });
    if (blob.size > MAX_BACKUP_BYTES) throw new Error('Ansiklopedi yedeği 20 MB sınırını aşıyor; daha az veya daha küçük görsel seç.');
    var url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = (String(world.id || 'evren').replace(/[^A-Za-z0-9_-]/g, '') || 'evren') + '-ansiklopedi.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    status('Ansiklopedi yedeği indirildi; maddeler ve görseller bu JSON dosyasına gömüldü.', true);
  }
  async function importEncyclopedia(file) {
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Ansiklopedi yedeği 20 MB sınırını aşıyor.');
    var payload;
    try { payload = JSON.parse(await file.text()); } catch (_) { throw new Error('Dosya geçerli JSON değil.'); }
    if (!payload || payload.format !== BACKUP_FORMAT || payload.version !== 1 || !Array.isArray(payload.maddeler) || payload.maddeler.length > 300) throw new Error('Bu, geçerli TentiFor ansiklopedi yedeği değil.');
    var world = getWorldForEdit();
    if (!world) throw new Error('İçe aktarma yalnızca kendi evreninde kullanılabilir.');
    if (!window.confirm('Bu işlem evrendeki mevcut ansiklopedi maddelerinin tamamını içe aktarılan yedekle değiştirir. Devam edilsin mi?')) return;
    var clean = typeof window.evrenAnsiklopediTemizle === 'function' ? window.evrenAnsiklopediTemizle(payload.maddeler) : null;
    if (!Array.isArray(clean) || clean.length !== payload.maddeler.length) throw new Error('Yedekte geçersiz veya yinelenen ansiklopedi kaydı var.');
    for (var validationIndex = 0; validationIndex < clean.length; validationIndex += 1) if (payload.maddeler[validationIndex].gorsel && !clean[validationIndex].gorsel) throw new Error('Yedekte geçersiz ansiklopedi görseli var; hiçbir kayıt değiştirilmedi.');
    var uploads = [];
    async function restore(meta) {
      if (!meta) return null;
      var safe = sanitizeImage(meta);
      if (!safe) throw new Error('Yedekte geçersiz görsel metadata var.');
      if (safe.kaynak !== 'embedded' || !safe.veri) throw new Error('Taşınabilir yedekte tüm görseller gömülü olmalıdır.');
      if (!window.evrenGorselVarlik || typeof window.evrenGorselVarlik.gomuluAktar !== 'function') throw new Error('Yerel görsel geri yükleme aracı hazır değil.');
      var restored = await window.evrenGorselVarlik.gomuluAktar(safe, safe.veri);
      uploads.push(restored);
      return restored;
    }
    try {
      for (var i = 0; i < clean.length; i += 1) clean[i].gorsel = await restore(clean[i].gorsel);
      var old = records(world).map(function (entry) { return entry.gorsel; }).filter(Boolean);
      mutate(function (draft) { draft.ansiklopediMaddeleri = clean; });
      var current = getWorldForEdit(), retained = new Set();
      records(current).forEach(function (entry) { if (entry.gorsel && entry.gorsel.id) retained.add(entry.gorsel.id); });
      for (var j = 0; j < old.length; j += 1) if (old[j].id && !retained.has(old[j].id) && old[j].kaynak === 'indexeddb') await window.evrenGorselVarlik.sil(old[j]).catch(function () {});
      if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
      status('Ansiklopedi yedeği içe aktarıldı; maddeler ve görseller bu cihazda saklanıyor.', true);
    } catch (error) {
      for (var k = 0; k < uploads.length; k += 1) if (uploads[k]) await window.evrenGorselVarlik.sil(uploads[k]).catch(function () {});
      throw error;
    }
  }
  function editorEntry(entry, world) {
    var fields = entry.ozellikler || {};
    var meta = sanitizeImage(entry.gorsel);
    var image = imageHtml(meta, entry.baslik || 'Ansiklopedi maddesi', world.id);
    return '<fieldset class="fan-grup eaw-entry" data-eaw-entry="' + esc(entry.id) + '"><legend>' + esc(TYPE_NAMES[entry.tur] || 'Madde') + ' · ' + esc(entry.baslik || 'Yeni madde') + '</legend>' +
      '<label>Kategori <select class="kod-giris" data-eaw-field="' + esc(entry.id) + ':tur">' + ['bitki', 'hayvan', 'ozel'].map(function (type) { return '<option value="' + type + '"' + (entry.tur === type ? ' selected' : '') + '>' + esc(TYPE_NAMES[type]) + '</option>'; }).join('') + '</select></label>' +
      '<label>Madde adı <input class="kod-giris" maxlength="120" value="' + esc(entry.baslik || '') + '" data-eaw-field="' + esc(entry.id) + ':baslik"></label>' +
      '<label>Kısa tanıtım <textarea class="kod-giris" rows="2" maxlength="500" data-eaw-field="' + esc(entry.id) + ':ozet">' + esc(entry.ozet || '') + '</textarea></label>' +
      '<label>Açıklama <textarea class="kod-giris" rows="5" maxlength="12000" data-eaw-field="' + esc(entry.id) + ':aciklama">' + esc(entry.aciklama || '') + '</textarea></label>' +
      '<label>Habitat / bulunduğu yerler <input class="kod-giris" maxlength="500" value="' + esc(entry.habitat || '') + '" data-eaw-field="' + esc(entry.id) + ':habitat"></label>' +
      '<label>Etiketler (virgülle ayır) <input class="kod-giris" maxlength="500" value="' + esc((entry.etiketler || []).join(', ')) + '" data-eaw-field="' + esc(entry.id) + ':etiketler"></label>' +
      FIELDS.map(function (field) { return '<label>' + esc(field[1]) + ' <textarea class="kod-giris" rows="2" maxlength="1000" data-eaw-field="' + esc(entry.id) + ':ozellikler.' + field[0] + '">' + esc(fields[field[0]] || '') + '</textarea></label>'; }).join('') +
      '<label>İlgili maddeler <select class="kod-giris" multiple data-eaw-field="' + esc(entry.id) + ':ilgiliIds">' + records(world).filter(function (item) { return item.id !== entry.id; }).map(function (item) { return '<option value="' + esc(item.id) + '"' + ((entry.ilgiliIds || []).indexOf(item.id) >= 0 ? ' selected' : '') + '>' + esc(item.baslik || 'Adsız madde') + ' · ' + esc(TYPE_NAMES[item.tur] || 'Madde') + '</option>'; }).join('') + '</select></label>' +
      '<label>Durum <select class="kod-giris" data-eaw-field="' + esc(entry.id) + ':durum"><option value="taslak"' + (entry.durum !== 'yayinda' ? ' selected' : '') + '>Taslak (yalnızca sahibi görür)</option><option value="yayinda"' + (entry.durum === 'yayinda' ? ' selected' : '') + '>Yayında</option></select></label>' +
      '<label><input type="checkbox" data-eaw-field="' + esc(entry.id) + ':spoiler"' + (entry.spoiler ? ' checked' : '') + '> Spoiler içeriyor</label>' +
      '<div class="eaw-image-preview">' + image + '</div><label>Görsel yükle (bu tarayıcı profiline kaydedilir) <input class="kod-giris" type="file" accept="image/png,image/jpeg,image/webp" data-eaw-image="' + esc(entry.id) + '"></label>' +
      '<p class="oyun-not">Görseller mevcut yerel görsel deposunda saklanır; başka cihazdaki okuyucuların görebilmesi için görsel yedeği ayrıca paylaşılmalıdır.</p>' +
      '<p class="pencere-durum" role="status" data-eaw-entry-status="' + esc(entry.id) + '"></p><button type="button" class="dugme dugme-sade" data-eaw-delete="' + esc(entry.id) + '">Maddeyi sil</button></fieldset>';
  }
  function editorHtml(world) {
    var entries = records(world);
    return '<section class="eaw-editor"><div class="kutu-y"><h3>Ansiklopedi maddeleri</h3><p class="oyun-not">Bitki, hayvan veya kendi tür kategorini ayrı maddeler halinde yaz. Taslaklar yalnızca sana görünür; yayınlanan maddeler okuyucu listesindedir. İsteğe bağlı alanları boş bırakabilirsin.</p><button type="button" class="dugme" data-eaw-new>+ Ansiklopedi maddesi</button> <button type="button" class="dugme dugme-sade" data-eaw-preview>Okur önizlemesi</button> <button type="button" class="dugme dugme-sade" data-eaw-export>Dışa aktar</button> <label class="dugme dugme-sade" for="eaw-import-file">İçe aktar</label><input id="eaw-import-file" type="file" accept="application/json,.json" data-eaw-import hidden><p class="oyun-not">Yedek; taslakları, yayınlanan maddeleri ve gömülü görselleri taşır (en fazla 20 MB). İçe aktarma mevcut ansiklopedi maddelerinin tamamının yerine geçer.</p><p class="pencere-durum" role="status" data-eaw-status></p></div>' +
      '<div class="eaw-entries">' + (entries.length ? entries.map(function (entry) { return editorEntry(entry, world); }).join('') : '<div class="kutu-y"><p class="oyun-not">Henüz ansiklopedi maddesi yok.</p></div>') + '</div></section>';
  }
  function published(world) { return records(world).filter(function (entry) { return entry && entry.durum === 'yayinda' && String(entry.baslik || '').trim(); }); }
  function indexHtml(world) {
    var entries = published(world);
    var cards = entries.map(function (entry) {
      return '<article class="eaw-card" data-eaw-card data-category="' + esc(entry.tur) + '" data-search="' + esc([entry.baslik, entry.ozet, entry.habitat, (entry.etiketler || []).join(' ')].join(' ').toLocaleLowerCase('tr')) + '"><span class="oyun-etiket">' + esc(TYPE_NAMES[entry.tur] || 'Madde') + '</span><h4><button type="button" class="eaw-link" data-eaw-open="' + esc(entry.id) + '">' + esc(entry.baslik) + '</button></h4><p>' + esc(entry.ozet || '') + '</p>' + (entry.habitat ? '<p><b>Habitat:</b> ' + esc(entry.habitat) + '</p>' : '') + '<p class="eaw-tags">' + (entry.etiketler || []).map(function (tag) { return '<span>' + esc(tag) + '</span>'; }).join(' ') + '</p></article>';
    }).join('');
    return '<div class="eaw-index"><div class="eaw-controls"><label>Madde ara <input class="kod-giris" type="search" placeholder="Ad, tanıtım veya habitat" data-eaw-search></label><label>Kategori <select class="kod-giris" data-eaw-filter><option value="">Tüm kategoriler</option><option value="bitki">Bitkiler</option><option value="hayvan">Hayvanlar</option><option value="ozel">Diğer</option></select></label></div><div class="galeri-izgara eaw-list">' + (cards || '<p class="oyun-not">Bu evrende henüz yayınlanmış ansiklopedi maddesi yok.</p>') + '</div></div>';
  }
  function detailHtml(world, entry) {
    var fields = entry.ozellikler || {};
    var details = FIELDS.map(function (field) { return fields[field[0]] ? '<div class="eaw-fact"><b>' + esc(field[1]) + '</b><p>' + esc(fields[field[0]]) + '</p></div>' : ''; }).join('');
    var related = (entry.ilgiliIds || []).map(function (relatedId) { var found = published(world).find(function (item) { return item.id === relatedId; }); return found ? '<button type="button" class="eaw-link" data-eaw-open="' + esc(found.id) + '">' + esc(found.baslik) + '</button>' : ''; }).filter(Boolean).join(' · ');
    var meta = sanitizeImage(entry.gorsel);
    var articleBody = '<div class="eaw-article-layout"><div class="eaw-article-image">' + imageHtml(meta, entry.baslik, world.id) + '</div><div class="eaw-facts">' + (entry.habitat ? '<div class="eaw-fact"><b>Habitat / bulunduğu yerler</b><p>' + esc(entry.habitat) + '</p></div>' : '') + details + '</div></div><div class="eaw-prose">' + esc(entry.aciklama || '').replace(/\n/g, '<br>') + '</div>' + (related ? '<div class="eaw-related"><b>İlgili maddeler:</b> ' + related + '</div>' : '') + '<p class="eaw-tags">' + (entry.etiketler || []).map(function (tag) { return '<span>' + esc(tag) + '</span>'; }).join(' ') + '</p>';
    if (entry.spoiler) articleBody = '<details><summary>Spoiler içeriyor · İçeriği göster</summary>' + articleBody + '</details>';
    return '<article class="eaw-article"><button type="button" class="dugme dugme-sade" data-eaw-back>← Ansiklopediye dön</button><header><span class="oyun-etiket">' + esc(TYPE_NAMES[entry.tur] || 'Madde') + '</span><h3>' + esc(entry.baslik) + '</h3><p class="eaw-intro">' + esc(entry.ozet || '') + '</p></header>' + articleBody + '</article>';
  }
  function readerHtml(world) {
    var idKey = String(world.id || '');
    var entry = published(world).find(function (item) { return item.id === selected[idKey]; });
    return '<section class="eaw-reader">' + (owner() ? '<button type="button" class="dugme dugme-sade" data-eaw-edit>← Düzenlemeye dön</button><p class="oyun-not">Bu, okuyucu önizlemesidir; taslak maddeler görünmez.</p>' : '') + '<div class="kutu-y"><h3>' + esc(world.ad || 'Evren') + ' · Ansiklopedi</h3><p class="oyun-not">Bitki, hayvan ve diğer yayınlanmış maddeler.</p></div><div class="eaw-content">' + (entry ? detailHtml(world, entry) : indexHtml(world)) + '</div></section>';
  }
  function hookTabs() {
    var oldTabs = window.evrenEkSekmeler;
    if (typeof oldTabs === 'function' && !oldTabs.__eaw) {
      var tabs = function (page) {
        var result = oldTabs.apply(this, arguments);
        result = Array.isArray(result) ? result.slice() : [];
        var world = pageWorld(page);
        if ((owner(page) || published(world).length) && !result.some(function (tab) { return tab && tab[0] === 'ansiklopedi'; })) result.push(['ansiklopedi', '📚 Ansiklopedi']);
        return result;
      };
      tabs.__eaw = true;
      window.evrenEkSekmeler = tabs;
    }
    var oldSection = window.evrenEkBolum;
    if (typeof oldSection === 'function' && !oldSection.__eaw) {
      var section = function (page) {
        var state = currentState();
        if (state && state.sekme === 'ansiklopedi') {
          var world = pageWorld(page);
          return world ? (owner(page) ? (previewMode[String(world.id || '')] ? readerHtml(world) : editorHtml(world)) : readerHtml(world)) : '<p class="oyun-not">Evren verisi yüklenemedi.</p>';
        }
        return oldSection.apply(this, arguments);
      };
      section.__eaw = true;
      window.evrenEkBolum = section;
    }
  }
  function hookCreator() {
    var original = window.evrKurucuHtml;
    if (typeof original !== 'function' || original.__eaw) return;
    var wrapped = function (page) {
      var html = original.apply(this, arguments);
      if (owner(page) && html.indexOf('data-eaw-card') < 0) {
        var marker = '<div class="evr-kartlar">';
        if (html.indexOf(marker) >= 0) html = html.replace(marker, marker + '<button type="button" class="evr-kart" data-eaw-card data-evs-sekme="ansiklopedi"><b>📚 Ansiklopedi</b><span>Bitki, hayvan ve diğer türleri Wiki maddeleri olarak düzenle</span></button>');
      }
      return html;
    };
    wrapped.__eaw = true;
    window.evrKurucuHtml = wrapped;
  }
  function findEntry(world, entryId) { return records(world).find(function (entry) { return entry && entry.id === entryId; }); }
  function updateField(entryId, field, value) {
    var allowed = ['tur', 'baslik', 'ozet', 'aciklama', 'habitat', 'etiketler', 'ilgiliIds', 'durum', 'spoiler'];
    var world = getWorldForEdit(), current = world && findEntry(world, entryId);
    if (!current) return;
    if (field.indexOf('ozellikler.') === 0) {
      var key = field.slice('ozellikler.'.length);
      if (!FIELDS.some(function (item) { return item[0] === key; })) return;
      mutate(function (draft) { var target = findEntry(draft, entryId); if (target) { target.ozellikler = target.ozellikler || {}; target.ozellikler[key] = String(value || '').slice(0, 1000); } });
    } else {
      if (allowed.indexOf(field) < 0) return;
      var parsed = value;
      if (field === 'etiketler' || field === 'ilgiliIds') parsed = String(value || '').split(',').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, field === 'etiketler' ? 30 : 100);
      if (field === 'spoiler') parsed = !!value;
      if (field === 'tur' && !Object.prototype.hasOwnProperty.call(TYPE_NAMES, value)) return;
      if (field === 'durum' && value !== 'taslak' && value !== 'yayinda') return;
      var max = { baslik: 120, ozet: 500, aciklama: 12000, habitat: 500 }[field];
      if (typeof parsed === 'string' && max) parsed = parsed.slice(0, max);
      mutate(function (draft) { var target = findEntry(draft, entryId); if (target) target[field] = parsed; });
    }
    entryStatus(entryId, 'Taslak bu evrene kaydedildi.', true);
  }
  async function uploadEntryImage(entryId, file) {
    if (!file) return;
    if (!window.evrenGorselVarlik || typeof window.evrenGorselVarlik.yukle !== 'function') throw new Error('Yerel görsel deposu hazır değil.');
    var world = getWorldForEdit(), entry = world && findEntry(world, entryId);
    if (!entry) throw new Error('Ansiklopedi maddesi bulunamadı.');
    var uploaded = await window.evrenGorselVarlik.yukle(file, { tur: 'varlik', alt: entry.baslik || 'Ansiklopedi maddesi', kaplama: 'contain' });
    try { mutate(function (draft) { var target = findEntry(draft, entryId); if (!target) throw new Error('Madde silinmiş.'); target.gorsel = uploaded; }); }
    catch (error) { await window.evrenGorselVarlik.sil(uploaded).catch(function () {}); throw error; }
    if (entry.gorsel && entry.gorsel.id !== uploaded.id) await window.evrenGorselVarlik.sil(entry.gorsel).catch(function () {});
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
    entryStatus(entryId, 'Görsel bu tarayıcı profiline kaydedildi.', true);
  }
  function deleteEntry(entryId) {
    var world = getWorldForEdit(), entry = world && findEntry(world, entryId);
    if (!entry || !window.confirm('Bu ansiklopedi maddesi silinsin mi?')) return;
    mutate(function (draft) { draft.ansiklopediMaddeleri = records(draft).filter(function (item) { return item.id !== entryId; }); });
    if (entry.gorsel && entry.gorsel.kaynak === 'indexeddb' && window.evrenGorselVarlik) window.evrenGorselVarlik.sil(entry.gorsel).catch(function () {});
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
  }
  function filterCards(root) {
    var query = (root.querySelector('[data-eaw-search]') || {}).value || '';
    query = query.toLocaleLowerCase('tr');
    var category = (root.querySelector('[data-eaw-filter]') || {}).value || '';
    root.querySelectorAll('[data-eaw-card]').forEach(function (card) {
      var text = card.getAttribute('data-search') || '';
      card.hidden = (!!category && card.getAttribute('data-category') !== category) || (!!query && text.indexOf(query) < 0);
    });
  }
  hookTabs();
  hookCreator();
  installStyles();
  document.addEventListener('tf-veri-hazir', function () { hookTabs(); hookCreator(); });
  document.addEventListener('click', function (event) {
    var target = event.target.closest && event.target.closest('[data-eaw-new], [data-eaw-delete], [data-eaw-open], [data-eaw-back], [data-eaw-export], [data-eaw-preview], [data-eaw-edit]');
    if (target && target.hasAttribute('data-eaw-new')) { try { newEntry(); } catch (error) { status(error.message || 'Madde eklenemedi.', false); } return; }
    if (target && target.hasAttribute('data-eaw-export')) { exportEncyclopedia().catch(function (error) { status(error.message || 'Yedek indirilemedi.', false); }); return; }
    if (target && target.hasAttribute('data-eaw-preview')) { var previewWorld = getWorldForEdit(); if (previewWorld) { previewMode[String(previewWorld.id || '')] = true; if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); } return; }
    if (target && target.hasAttribute('data-eaw-edit')) { var editWorld = getWorldForEdit(); if (editWorld) { previewMode[String(editWorld.id || '')] = false; if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); } return; }
    if (target && target.hasAttribute('data-eaw-delete')) { deleteEntry(target.getAttribute('data-eaw-delete')); return; }
    var root = target && target.closest('.eaw-reader');
    if (root && target.hasAttribute('data-eaw-open')) {
      var page = typeof window.evrenSayfaVerisi === 'function' ? window.evrenSayfaVerisi() : null;
      var world = pageWorld(page), item = world && findEntry(world, target.getAttribute('data-eaw-open'));
      if (world && item && item.durum === 'yayinda') { selected[String(world.id || '')] = item.id; root.querySelector('.eaw-content').innerHTML = detailHtml(world, item); }
      return;
    }
    if (root && target.hasAttribute('data-eaw-back')) { var current = pageWorld(typeof window.evrenSayfaVerisi === 'function' ? window.evrenSayfaVerisi() : null); if (current) { delete selected[String(current.id || '')]; root.querySelector('.eaw-content').innerHTML = indexHtml(current); } }
  });
  document.addEventListener('change', function (event) {
    var field = event.target.closest && event.target.closest('[data-eaw-field]');
    if (field && currentState() && currentState().kaynak === 'benim') {
      var parts = field.getAttribute('data-eaw-field').split(':'), fieldName = parts.slice(1).join(':');
      updateField(parts[0], fieldName, field.type === 'checkbox' ? field.checked : field.multiple ? Array.from(field.selectedOptions).map(function (option) { return option.value; }) : field.value);
      return;
    }
    var image = event.target.closest && event.target.closest('[data-eaw-image]');
    if (image && currentState() && currentState().kaynak === 'benim') uploadEntryImage(image.getAttribute('data-eaw-image'), image.files && image.files[0]).catch(function (error) { entryStatus(image.getAttribute('data-eaw-image'), error.message || 'Görsel yüklenemedi.', false); });
    var backup = event.target.closest && event.target.closest('[data-eaw-import]');
    if (backup && currentState() && currentState().kaynak === 'benim') importEncyclopedia(backup.files && backup.files[0]).catch(function (error) { status(error.message || 'Yedek içe aktarılamadı.', false); });
    var filter = event.target.closest && event.target.closest('[data-eaw-filter]');
    if (filter) filterCards(filter.closest('.eaw-reader'));
  });
  document.addEventListener('input', function (event) {
    var search = event.target.closest && event.target.closest('[data-eaw-search]');
    if (search) filterCards(search.closest('.eaw-reader'));
  });
}());
