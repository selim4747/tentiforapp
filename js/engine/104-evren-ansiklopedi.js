/* TentiFor — structured, wiki-like custom-universe encyclopedia. */
(function () {
  'use strict';

  var BACKUP_FORMAT = 'tentifor-evren-ansiklopedi';
  var BACKUP_VERSION = 2;
  var MAX_BACKUP_BYTES = 20 * 1024 * 1024;
  var MAX_ARTICLES = 300;
  var MAX_REVISIONS = 20;
  var ARTICLE_PARAM = 'wiki';
  var ENTITY_PARAM = 'varlik';
  var selected = Object.create(null);
  var previewMode = Object.create(null);
  var readerState = Object.create(null);

  function schema() {
    var value = window.EVREN_ANSIKLOPEDI_SCHEMA;
    if (!value && typeof window.evrenAnsiklopediTemizle === 'function') {
      window.evrenAnsiklopediTemizle([]);
      value = window.EVREN_ANSIKLOPEDI_SCHEMA;
    }
    return value && Array.isArray(value.categories) ? value : {
      version: 1,
      categories: [{ id: 'diger', ad: 'Diğer / özel tür', alanlar: [] }],
      fields: {}
    };
  }
  function categories() { return schema().categories; }
  function category(value) {
    return categories().find(function (item) { return item.id === value; })
      || categories().find(function (item) { return item.id === 'diger'; })
      || { id: 'diger', ad: 'Diğer / özel tür', alanlar: [] };
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
  function deletedRecords(world) { return Array.isArray(world && world.ansiklopediSilinenMaddeler) ? world.ansiklopediSilinenMaddeler : []; }
  function indexedDbImages(entries) {
    var images = [], seen = new Set;
    function add(meta) {
      if (!meta || meta.kaynak !== 'indexeddb' || !meta.id || seen.has(meta.id)) return;
      seen.add(meta.id); images.push(meta);
    }
    (entries || []).forEach(function (entry) {
      if (!entry || typeof entry !== 'object') return;
      add(entry.gorsel);
      (Array.isArray(entry.gecmis) ? entry.gecmis : []).forEach(function (revision) { add(revision && revision.madde && revision.madde.gorsel); });
    });
    return images;
  }
  function cleanupOrphanImages(previousEntries, remainingEntries) {
    if (!window.evrenGorselVarlik || typeof window.evrenGorselVarlik.sil !== 'function') return Promise.resolve(0);
    var retained = new Set(indexedDbImages(remainingEntries).map(function (meta) { return meta.id; }));
    var obsolete = indexedDbImages(previousEntries).filter(function (meta) { return !retained.has(meta.id); });
    return Promise.all(obsolete.map(function (meta) {
      return Promise.resolve(window.evrenGorselVarlik.sil(meta, { kaynak: 'indexeddb' })).then(function () {
        var urls = window.EVH_GORSEL_URL || {};
        if (urls[meta.id]) { URL.revokeObjectURL(urls[meta.id]); delete urls[meta.id]; }
        return false;
      }).catch(function () { return true; });
    })).then(function (failures) { return failures.filter(Boolean).length; });
  }
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
    if (url) return '<img class="eaw-image" src="' + esc(url) + '" alt="' + esc(alt || 'Ansiklopedi görseli') + '" loading="lazy">';
    if (meta.kaynak === 'indexeddb' && typeof window.evrenGorselGoster === 'function') {
      window.evrenGorselGoster(meta, function () { if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); }, worldId);
      return '<div class="eaw-image-empty" role="status">Bu görsel yalnızca yazarın tarayıcı profilinde kayıtlı. Diğer okuyucular görseli göremeyebilir.</div>';
    }
    return '<div class="eaw-image-empty" role="status">Bu görsel bu cihazda mevcut değil.</div>';
  }
  function id() {
    try { if (window.crypto && window.crypto.randomUUID) return 'w' + window.crypto.randomUUID().replace(/-/g, ''); } catch (_) {}
    return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function now() { return new Date().toISOString(); }
  function getWorldForEdit() {
    var state = currentState();
    if (!state || state.kaynak !== 'benim' || !state.id || typeof window.evrenBenimBul !== 'function') return null;
    return window.evrenBenimBul(state.id);
  }
  function mutate(mutator) {
    var state = currentState();
    if (!state || state.kaynak !== 'benim' || typeof window.evrenBenimDegistir !== 'function') throw new Error('Yalnızca kendi evrenini düzenleyebilirsin.');
    var stored = window.evrenBenimDegistir(state.id, mutator);
    if (stored === false) throw new Error('Değişiklik yerel depoya yazılamadı; mevcut ansiklopedi korunuyor.');
    var updated = getWorldForEdit();
    if (!updated) throw new Error('Ansiklopedi taslağı kaydedilemedi.');
    return updated;
  }
  function status(message, good) {
    var node = document.querySelector('#evrenSayfa [data-eaw-status]') || document.querySelector('[data-eaw-status]');
    if (node) { node.textContent = message; node.className = 'pencere-durum ' + (good ? 'iyi' : 'kotu'); }
  }
  function entryStatus(entryId, message, good) {
    var selector = '[data-eaw-entry-status="' + String(entryId).replace(/[^A-Za-z0-9_-]/g, '') + '"]';
    var node = document.querySelector('#evrenSayfa ' + selector) || document.querySelector(selector);
    if (node) { node.textContent = message; node.className = 'pencere-durum ' + (good ? 'iyi' : 'kotu'); }
  }
  function findEntry(world, entryId) { return records(world).find(function (entry) { return entry && entry.id === entryId; }); }
  function currentWorldId(world) { return String(world && world.id || ''); }
  function published(world) {
    return records(world).filter(function (entry) {
      return entry && entry.durum === 'yayinda' && String(entry.baslik || '').trim();
    });
  }
  function safeExternalUrl(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw || raw.length > 2048) return '';
    try {
      var parsed = new URL(raw);
      if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return '';
      return parsed.href;
    } catch (_) { return ''; }
  }
  function markdownHtml(value) {
    var source = String(value == null ? '' : value).replace(/\r\n?/g, '\n').slice(0, 20000);
    var escaped = esc(source);
    escaped = escaped.replace(/^###\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^##\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^#\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    escaped = escaped.replace(/(<li>.*<\/li>)(?:\n|$)/g, '<ul>$1</ul>');
    return escaped.split('\n').map(function (line) {
      if (!line || /^<h[234]>/.test(line) || /^<ul>/.test(line) || /^<li>/.test(line)) return line;
      return '<p>' + line + '</p>';
    }).join('');
  }
  function githubRepo() {
    var configured = window.TENTIFOR_GITHUB_REPO || (window.tentiforConfig && window.tentiforConfig.githubRepo) || 'selim4747/tentiforapp';
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(configured)) ? String(configured) : 'selim4747/tentiforapp';
  }
  function githubDiscussionUrl(world, entry) {
    var title = encodeURIComponent('Wiki tartışması: ' + String(entry.baslik || 'Adsız madde').slice(0, 120));
    var body = encodeURIComponent('Evren: ' + String(world && (world.ad || world.id) || '') + '\nMadde kimliği: ' + String(entry.id || '') + '\n\nLütfen öneri, kaynak veya düzeltmeyi buraya yazın.');
    return 'https://github.com/' + githubRepo() + '/issues/new?title=' + title + '&body=' + body + '&labels=wiki';
  }
  function backlinksHtml(world, entry) {
    var ids = [];
    published(world).forEach(function (candidate) {
      if (!candidate || candidate.id === entry.id) return;
      var linked = Array.isArray(candidate.ilgiliIds) && candidate.ilgiliIds.indexOf(entry.id) >= 0;
      var entityLinked = entry.varlikId && Array.isArray(candidate.ilgiliVarlikIds) && candidate.ilgiliVarlikIds.indexOf(entry.varlikId) >= 0;
      if ((linked || entityLinked) && ids.indexOf(candidate.id) < 0) ids.push(candidate.id);
    });
    if (!ids.length) return '<section class="eaw-backlinks"><h2>Bu maddeye bağlantılar</h2><p class="eaw-muted">Henüz başka bir madde bu sayfaya bağlanmıyor.</p></section>';
    return '<section class="eaw-backlinks"><h2>Bu maddeye bağlantılar (' + ids.length + ')</h2><ul>' + ids.map(function (id) {
      var found = published(world).find(function (item) { return item.id === id; });
      return found ? '<li><button type="button" class="eaw-link" data-eaw-open="' + esc(found.id) + '">' + esc(found.baslik) + '</button></li>' : '';
    }).join('') + '</ul></section>';
  }
  function revisionDiffHtml(entry, revision) {
    var before = revision && revision.madde || {}, current = articleSnapshot(entry), keys = ['tur','baslik','ozet','giris','aciklama','habitat','etiketler','ilgiliIds','ilgiliVarlikIds','durum','spoiler','ozellikler','kaynakca'];
    var rows = keys.map(function (key) {
      var oldValue = JSON.stringify(before[key] == null ? '' : before[key], null, 2);
      var newValue = JSON.stringify(current[key] == null ? '' : current[key], null, 2);
      if (oldValue === newValue) return '';
      return '<tr><th>' + esc(key) + '</th><td><del>' + esc(oldValue) + '</del></td><td><ins>' + esc(newValue) + '</ins></td></tr>';
    }).filter(Boolean).join('');
    return '<details class="eaw-diff"><summary>Sürüm farkını göster</summary>' + (rows ? '<div class="eaw-diff-scroll"><table><thead><tr><th>Alan</th><th>Eski</th><th>Şimdiki</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="eaw-muted">Bu sürümle güncel sürüm arasında fark yok.</p>') + '</details>';
  }
  function categoryNavigationHtml(entries, state, compare) {
    var all = categories(), children = Object.create(null);
    all.forEach(function (item) { var parent = item.parentId || ''; (children[parent] || (children[parent] = [])).push(item); });
    function branch(parent, depth) {
      return (children[parent] || []).map(function (item) {
        var count = entries.filter(function (entry) { return entry.tur === item.id; }).length;
        var active = state.category === item.id;
        return '<button type="button" class="eaw-category-button' + (active ? ' is-active' : '') + '" style="padding-left:' + (10 + depth * 16) + 'px" data-eaw-category="' + esc(item.id) + '" aria-pressed="' + active + '">' + esc(item.ad) + ' <span>' + count + '</span></button>' + branch(item.id, depth + 1);
      }).join('');
    }
    return '<button type="button" class="eaw-category-button' + (state.category ? '' : ' is-active') + '" data-eaw-category="" aria-pressed="' + (!state.category) + '">Tüm maddeler <span>' + entries.length + '</span></button>' + branch('', 0);
  }
  function articleParam() {
    try { return new URL(window.location.href).searchParams.get(ARTICLE_PARAM) || ''; }
    catch (_) { return ''; }
  }
  function entityParam() {
    try { return new URL(window.location.href).searchParams.get(ENTITY_PARAM) || ''; }
    catch (_) { return ''; }
  }
  function entityCandidates(world, includeLegacy) {
    return typeof window.evrenVarlikAdaylari === 'function' ? window.evrenVarlikAdaylari(world, !!includeLegacy) : [];
  }
  function entityById(world, entityId, publicOnly) {
    return typeof window.evrenVarlikBul === 'function' ? window.evrenVarlikBul(world, entityId, !!publicOnly) : null;
  }
  function newEntityId() {
    return typeof window.evrenVarlikIdYeni === 'function' ? window.evrenVarlikIdYeni() : '';
  }
  function changeArticleUrl(articleId, mode, worldId) {
    try {
      var url = new URL(window.location.href);
      if (articleId) { url.searchParams.set(ARTICLE_PARAM, articleId); url.searchParams.delete(ENTITY_PARAM); }
      else { url.searchParams.delete(ARTICLE_PARAM); url.searchParams.delete(ENTITY_PARAM); }
      var state = window.history.state && typeof window.history.state === 'object'
        ? Object.assign({}, window.history.state) : {};
      if (articleId && mode === 'push') state.__eaw = { worldId: worldId, articleId: articleId };
      else delete state.__eaw;
      delete state.__eawEntity;
      if (mode === 'push') window.history.pushState(state, '', url.href);
      else window.history.replaceState(state, '', url.href);
      return true;
    } catch (_) { return false; }
  }
  function changeEntityUrl(entityId, mode, worldId) {
    try {
      var url = new URL(window.location.href); url.searchParams.delete(ARTICLE_PARAM);
      if (entityId) url.searchParams.set(ENTITY_PARAM, entityId); else url.searchParams.delete(ENTITY_PARAM);
      var previous = currentState(), state = window.history.state && typeof window.history.state === 'object' ? Object.assign({}, window.history.state) : {};
      if (mode === 'push' && previous) state.__eawReturnTab = previous.sekme || '';
      delete state.__eaw;
      if (entityId && mode === 'push') state.__eawEntity = { worldId: worldId, entityId: entityId }; else delete state.__eawEntity;
      if (mode === 'push') { window.history.replaceState(state, '', window.location.href); window.history.pushState(state, '', url.href); }
      else window.history.replaceState(state, '', url.href);
      return true;
    } catch (_) { return false; }
  }
  function selectedEntry(world) {
    var key = currentWorldId(world), routeId = articleParam();
    if (routeId) {
      var fromUrl = published(world).find(function (entry) { return entry.id === routeId; });
      if (fromUrl) { selected[key] = fromUrl.id; return fromUrl; }
      delete selected[key];
      return null;
    }
    delete selected[key];
    return null;
  }
  function collator() {
    try { return new Intl.Collator('tr-TR', { sensitivity: 'base', numeric: true }); }
    catch (_) { return { compare: function (a, b) { return String(a).localeCompare(String(b)); } }; }
  }
  function normalizeSearch(value) {
    var text = String(value == null ? '' : value);
    try { text = text.normalize('NFKC'); } catch (_) {}
    return text.toLocaleLowerCase('tr-TR');
  }
  function searchable(entry) {
    var fields = [];
    fields.push(entry.baslik, entry.ozet, entry.giris, entry.aciklama, entry.habitat, entry.tur);
    (entry.etiketler || []).forEach(function (item) { fields.push(item); });
    Object.keys(entry.ozellikler || {}).forEach(function (key) { fields.push(key, entry.ozellikler[key]); });
    (entry.kaynakca || []).forEach(function (source) { fields.push(source.baslik, source.aciklama, source.url); });
    return normalizeSearch(fields.filter(Boolean).join(' '));
  }
  function readerSettings(world) {
    var key = currentWorldId(world);
    if (!readerState[key]) readerState[key] = { query: '', category: '', sort: 'az', view: 'liste' };
    return readerState[key];
  }
  function dateLabel(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return 'Tarih belirtilmemiş';
    try { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
    catch (_) { return new Date(value).toLocaleString('tr-TR'); }
  }
  function categoryOptions(entry) {
    return categories().map(function (item) {
      return '<option value="' + esc(item.id) + '"' + (entry.tur === item.id ? ' selected' : '') + '>' + esc(item.ad) + '</option>';
    }).join('');
  }
  function articleSnapshot(entry) {
    var copy = JSON.parse(JSON.stringify(entry || {}));
    delete copy.gecmis;
    delete copy.silindiAt;
    return copy;
  }
  function saveRevision(entry, reason) {
    if (!Array.isArray(entry.gecmis)) entry.gecmis = [];
    entry.gecmis.push({
      versiyon: Math.max(1, Number(entry.surum) || 1),
      tarih: entry.sonDegisiklik || now(),
      neden: String(reason || 'Düzenleme').slice(0, 160),
      madde: articleSnapshot(entry)
    });
    if (entry.gecmis.length > MAX_REVISIONS) entry.gecmis = entry.gecmis.slice(-MAX_REVISIONS);
  }
  function applyRevision(entry, snapshot) {
    var history = Array.isArray(entry.gecmis) ? entry.gecmis : [];
    var nextVersion = Math.max(1, Number(entry.surum) || 1) + 1;
    var stableId = entry.id;
    Object.keys(entry).forEach(function (key) { if (key !== 'id') delete entry[key]; });
    Object.assign(entry, articleSnapshot(snapshot), {
      id: stableId,
      durum: 'taslak',
      gecmis: history,
      surum: nextVersion,
      sonDegisiklik: now()
    });
  }
  function entryWarnings(entry, world) {
    var notes = [];
    (entry.ilgiliIds || []).forEach(function (targetId) {
      var target = records(world).find(function (item) { return item && item.id === targetId; });
      if (!target) notes.push('İlgili madde bulunamadı: ' + targetId + '.');
      else if (target.durum !== 'yayinda') notes.push('“' + (target.baslik || 'Adsız madde') + '” taslak; okurlar bu bağlantıyı açamaz.');
    });
    (entry.ilgiliVarlikIds || []).forEach(function (targetId) {
      var target = entityById(world, targetId, false);
      if (!target) notes.push('Bağlı varlık bulunamadı veya bu evrende güvenli biçimde açılamıyor.');
      else if (target.gizli || (target.tur === 'wiki' && target.durum !== 'yayinda')) notes.push('Bağlı hedef taslak veya gizli; okurlar bu bağlantıyı açamaz.');
    });
    if (entry.gorsel && entry.gorsel.kaynak === 'indexeddb' && entry.durum === 'yayinda') {
      notes.push('Görsel yalnızca bu tarayıcı profilinde. Başka okuyucular görseli göremeyebilir.');
    }
    return notes;
  }
  function sourcesEditor(entry) {
    var sources = Array.isArray(entry.kaynakca) ? entry.kaynakca : [];
    return '<div class="eaw-sources-editor"><h4>Kaynakça</h4><p class="oyun-not">İsteğe bağlıdır. Bağlantılar yalnızca HTTPS olabilir; başlık ve açıklama HTML olarak çalıştırılmaz.</p>' +
      (sources.length ? sources.map(function (source, index) {
        return '<fieldset class="eaw-source" data-eaw-source="' + esc(entry.id) + ':' + index + '"><legend>Kaynak ' + (index + 1) + '</legend>' +
          '<label>Kaynak başlığı <input class="kod-giris" maxlength="180" value="' + esc(source.baslik || '') + '" data-eaw-source-field="' + esc(entry.id) + ':' + index + ':baslik"></label>' +
          '<label>Açıklama <textarea class="kod-giris" rows="2" maxlength="800" data-eaw-source-field="' + esc(entry.id) + ':' + index + ':aciklama">' + esc(source.aciklama || '') + '</textarea></label>' +
          '<label>HTTPS bağlantısı <input class="kod-giris" type="url" maxlength="2048" value="' + esc(source.url || '') + '" placeholder="https://…" data-eaw-source-field="' + esc(entry.id) + ':' + index + ':url"></label>' +
          '<button type="button" class="dugme dugme-sade" data-eaw-remove-source="' + esc(entry.id) + ':' + index + '">Kaynağı kaldır</button></fieldset>';
      }).join('') : '<p class="eaw-muted">Henüz kaynak eklenmedi.</p>') +
      '<button type="button" class="dugme dugme-sade" data-eaw-add-source="' + esc(entry.id) + '">+ Kaynak ekle</button></div>';
  }
  function revisionsHtml(entry) {
    var history = Array.isArray(entry.gecmis) ? entry.gecmis.slice().reverse() : [];
    if (!history.length) return '<details class="eaw-history"><summary>Düzenleme geçmişi</summary><p class="eaw-muted">Henüz önceki sürüm yok. İlk düzenlemeden sonra burada görünür.</p></details>';
    return '<details class="eaw-history"><summary>Düzenleme geçmişi (' + history.length + ')</summary><ol>' + history.map(function (revision, index) {
      return '<li><span>v' + esc(revision.versiyon) + ' · ' + esc(dateLabel(revision.tarih)) + (revision.neden ? ' · ' + esc(revision.neden) : '') + '</span><div class="eaw-history-actions"><button type="button" class="dugme dugme-sade" data-eaw-revert="' + esc(entry.id) + '" data-eaw-revision="' + (history.length - index - 1) + '">Bu sürüme dön</button>' + revisionDiffHtml(entry, revision) + '</div></li>';
    }).join('') + '</ol></details>';
  }
  function editorEntry(entry, world) {
    var cat = category(entry.tur), fields = entry.ozellikler || {};
    var meta = sanitizeImage(entry.gorsel), image = imageHtml(meta, entry.baslik || 'Ansiklopedi maddesi', world.id);
    var dynamic = (cat.alanlar || []).map(function (key) {
      var label = schema().fields && schema().fields[key] || key;
      return '<label>' + esc(label) + ' <textarea class="kod-giris" rows="2" maxlength="2000" data-eaw-field="' + esc(entry.id) + ':ozellikler.' + esc(key) + '">' + esc(fields[key] || '') + '</textarea></label>';
    }).join('');
    var related = records(world).filter(function (item) { return item && item.id !== entry.id; }).map(function (item) {
      var label = (item.baslik || 'Adsız madde') + ' · ' + category(item.tur).ad + (item.durum !== 'yayinda' ? ' · Taslak' : '');
      return '<option value="' + esc(item.id) + '"' + ((entry.ilgiliIds || []).indexOf(item.id) >= 0 ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    var entityOptions = entityCandidates(world, true).filter(function (item) { return item.varlikId !== entry.varlikId && (item.tur !== 'wiki' || item.record.id !== entry.id); }).map(function (item) {
      var selected = (entry.ilgiliVarlikIds || []).indexOf(item.varlikId) >= 0;
      return '<option value="' + esc(item.varlikId) + '"' + (selected ? ' selected' : '') + '>' + esc(item.label + (item.legacy ? ' · kimlik bağlantı seçilince oluşturulur' : '')) + '</option>';
    }).join('');
    var warnings = entryWarnings(entry, world);
    return '<fieldset class="fan-grup eaw-entry" data-eaw-entry="' + esc(entry.id) + '"><legend>' + esc(cat.ad) + ' · ' + esc(entry.baslik || 'Yeni madde') + '</legend>' +
      '<label>Kategori <select class="kod-giris" data-eaw-field="' + esc(entry.id) + ':tur">' + categoryOptions(entry) + '</select></label>' +
      (entry.turEski ? '<p class="eaw-warning">Eski tür “' + esc(entry.turEski) + '” güvenli biçimde “' + esc(cat.ad) + '” olarak gösteriliyor; madde içeriği korunmuştur.</p>' : '') +
      '<label>Madde adı <input class="kod-giris" maxlength="120" value="' + esc(entry.baslik || '') + '" data-eaw-field="' + esc(entry.id) + ':baslik"></label>' +
      '<label>Kısa tanıtım <textarea class="kod-giris" rows="2" maxlength="500" data-eaw-field="' + esc(entry.id) + ':ozet">' + esc(entry.ozet || '') + '</textarea></label>' +
      '<label>Giriş <textarea class="kod-giris" rows="3" maxlength="5000" data-eaw-field="' + esc(entry.id) + ':giris">' + esc(entry.giris || '') + '</textarea></label>' +
      '<label>Açıklama <textarea class="kod-giris" rows="5" maxlength="16000" data-eaw-field="' + esc(entry.id) + ':aciklama">' + esc(entry.aciklama || '') + '</textarea></label>' +
      '<label>Habitat / konum <input class="kod-giris" maxlength="500" value="' + esc(entry.habitat || '') + '" data-eaw-field="' + esc(entry.id) + ':habitat"></label>' +
      '<label>Etiketler (virgülle ayır) <input class="kod-giris" maxlength="500" value="' + esc((entry.etiketler || []).join(', ')) + '" data-eaw-field="' + esc(entry.id) + ':etiketler"></label>' +
      (dynamic ? '<section class="eaw-specific-fields"><h4>' + esc(cat.ad) + ' özellikleri</h4>' + dynamic + '</section>' : '') +
      '<label>İlgili maddeler <select class="kod-giris" multiple data-eaw-field="' + esc(entry.id) + ':ilgiliIds">' + related + '</select></label>' +
      '<label>Bağlı evren kayıtları (kişi, yer, olay, gezegen, harita veya wiki) <select class="kod-giris" multiple data-eaw-field="' + esc(entry.id) + ':ilgiliVarlikIds">' + entityOptions + '</select></label>' +
      '<p class="oyun-not">Aynı adlı kayıtlar türü ve bağlamıyla ayrı tutulur. Legacy kayda kimlik yalnızca burada bağlantı seçtiğinde atanır.</p>' +
      sourcesEditor(entry) +
      '<label>Durum <select class="kod-giris" data-eaw-field="' + esc(entry.id) + ':durum"><option value="taslak"' + (entry.durum !== 'yayinda' ? ' selected' : '') + '>Taslak (yalnızca sahibi görür)</option><option value="yayinda"' + (entry.durum === 'yayinda' ? ' selected' : '') + '>Yayında</option></select></label>' +
      '<label class="eaw-check"><input type="checkbox" data-eaw-field="' + esc(entry.id) + ':spoiler"' + (entry.spoiler ? ' checked' : '') + '> Spoiler içeriyor</label>' +
      '<div class="eaw-image-preview">' + image + '</div><label>Görsel yükle (PNG, JPEG veya WebP; en fazla 10 MB) <input class="kod-giris" type="file" accept="image/png,image/jpeg,image/webp" data-eaw-image="' + esc(entry.id) + '"></label>' +
      '<p class="oyun-not">Görseller dosya imzası, MIME türü ve boyut bakımından doğrulanıp bu tarayıcı profilindeki IndexedDB’de saklanır. Yayında bir maddedeki yalnızca yerel görsel için yükleme veya yayın onayı sırasında uyarı gösterilir.</p>' +
      (warnings.length ? '<ul class="eaw-warning-list">' + warnings.map(function (note) { return '<li>' + esc(note) + '</li>'; }).join('') + '</ul>' : '') +
      revisionsHtml(entry) +
      '<p class="pencere-durum" role="status" data-eaw-entry-status="' + esc(entry.id) + '"></p>' +
      '<div class="eaw-actions"><button type="button" class="dugme dugme-sade" data-eaw-save="' + esc(entry.id) + '">Değişiklikleri kaydet</button><button type="button" class="dugme dugme-sade" data-eaw-delete="' + esc(entry.id) + '">Geri alınabilir sil</button></div></fieldset>';
  }
  function deletedHtml(world) {
    var items = deletedRecords(world);
    if (!items.length) return '';
    return '<details class="eaw-trash"><summary>Silinen maddeler (' + items.length + ')</summary><p class="oyun-not">Silme işlemi geri alınabilir. Geri yüklenen maddeler güvenlik için taslak durumuna alınır.</p><ul>' + items.map(function (entry) {
      return '<li><span>' + esc(entry.baslik || 'Adsız madde') + ' · ' + esc(category(entry.tur).ad) + ' · ' + esc(dateLabel(entry.silindiAt)) + '</span> <button type="button" class="dugme dugme-sade" data-eaw-restore="' + esc(entry.id) + '">Geri yükle</button></li>';
    }).join('') + '</ul></details>';
  }
  function editorHtml(world) {
    var entries = records(world);
    return '<section class="eaw-editor"><div class="kutu-y"><h2>Ansiklopedi maddeleri</h2><p class="oyun-not">Bitki, hayvan, eşya, bina, özel güç ve diğer türleri ayrı Wiki maddeleri olarak oluştur. Giriş, özet ve açıklama alanlarında güvenli Markdown kullanabilirsin. Kategoriye özgü alanlar bilgi kutusu şablonu gibi çalışır; her değişiklik sürüm geçmişine ve audit kaydına gider.</p>' +
      '<div class="eaw-actions"><button type="button" class="dugme" data-eaw-new>+ Ansiklopedi maddesi</button><button type="button" class="dugme dugme-sade" data-eaw-preview>Okur önizlemesi</button><button type="button" class="dugme dugme-sade" data-eaw-export>Dışa aktar</button><label class="dugme dugme-sade eaw-file-label" for="eaw-import-file">İçe aktar</label><input id="eaw-import-file" type="file" accept="application/json,.json" data-eaw-import hidden></div>' +
      '<p class="oyun-not">GitHub tartışma bağlantısı her yayınlanan maddenin altında bulunur; yorum ve öneriler GitHub Issue olarak tutulur. Yedek; yayınlanan ve taslak maddeleri, geçmişi, ilişkileri, kaynakçayı, silinen maddeleri ve paylaşılabilir veri olarak JSON’a gömülmüş görselleri taşır (en fazla 20 MB). İçe aktarma mevcut ansiklopedi maddelerinin tamamının yerine geçer ve önceden açık onay ister.</p><p class="pencere-durum" role="status" data-eaw-status></p></div>' +
      '<div class="eaw-entries">' + (entries.length ? entries.map(function (entry) { return editorEntry(entry, world); }).join('') : '<div class="kutu-y"><p class="oyun-not">Henüz ansiklopedi maddesi yok.</p></div>') + '</div>' + deletedHtml(world) + '</section>';
  }
  function indexHtml(world) {
    var state = readerSettings(world), entries = published(world);
    var categoryNav = categoryNavigationHtml(entries, state, collator());
    var content = '<div class="eaw-index-layout"><nav class="eaw-category-nav" aria-label="Ansiklopedi kategorileri"><h3>Kategoriler</h3>' + categoryNav + '</nav><div class="eaw-index-main">' +
      '<div class="eaw-controls"><label>Madde ara <input class="kod-giris" type="search" placeholder="Başlık, açıklama, özellik veya kaynak" value="' + esc(state.query) + '" data-eaw-search></label>' +
      '<label>Sırala <select class="kod-giris" data-eaw-sort><option value="az"' + (state.sort === 'az' ? ' selected' : '') + '>Alfabetik (A–Z)</option><option value="za"' + (state.sort === 'za' ? ' selected' : '') + '>Alfabetik (Z–A)</option><option value="yeni"' + (state.sort === 'yeni' ? ' selected' : '') + '>Son değişiklik</option></select></label></div>' +
      '<div class="eaw-view-controls" role="group" aria-label="Madde görünümü"><span>Görünüm</span>' +
      [['liste', 'Liste'], ['alfabetik', 'Alfabetik indeks'], ['izgara', 'Kartlar']].map(function (view) { return '<button type="button" class="dugme dugme-sade' + (state.view === view[0] ? ' is-active' : '') + '" data-eaw-view="' + view[0] + '" aria-pressed="' + (state.view === view[0]) + '">' + view[1] + '</button>'; }).join('') + '</div>' +
      '<div class="eaw-results" data-eaw-results aria-live="polite"></div></div></div>';
    var holder = document.createElement('div');
    holder.innerHTML = '<section class="eaw-reader"><div class="eaw-content">' + content + '</div></section>';
    renderResults(holder.firstElementChild, world);
    return holder.querySelector('.eaw-content').innerHTML;
  }
  function entrySummary(entry) {
    return '<span class="eaw-entry-type">' + esc(category(entry.tur).ad) + '</span><strong>' + esc(entry.baslik) + '</strong>' +
      (entry.ozet ? '<span>' + esc(entry.ozet) + '</span>' : '') + (entry.habitat ? '<span class="eaw-entry-meta">Konum: ' + esc(entry.habitat) + '</span>' : '');
  }
  function renderResults(root, world) {
    var target = root.querySelector('[data-eaw-results]');
    if (!target) return;
    var state = readerSettings(world);
    var search = root.querySelector('[data-eaw-search]');
    var sort = root.querySelector('[data-eaw-sort]');
    if (search) state.query = search.value;
    if (sort) state.sort = sort.value;
    var compare = collator();
    var query = normalizeSearch(state.query);
    var entries = published(world).filter(function (entry) {
      return (!state.category || entry.tur === state.category) && (!query || searchable(entry).indexOf(query) >= 0);
    });
    if (state.sort === 'za') entries.sort(function (a, b) { return compare.compare(b.baslik || '', a.baslik || ''); });
    else if (state.sort === 'yeni') entries.sort(function (a, b) { return (Date.parse(b.sonDegisiklik) || 0) - (Date.parse(a.sonDegisiklik) || 0) || compare.compare(a.baslik || '', b.baslik || ''); });
    else entries.sort(function (a, b) { return compare.compare(a.baslik || '', b.baslik || ''); });
    var output = '';
    if (!entries.length) {
      output = '<div class="eaw-empty"><h3>Madde bulunamadı</h3><p>Arama sözcüğünü veya kategori filtresini değiştir. Taslaklar bu listede gösterilmez.</p></div>';
    } else if (state.view === 'izgara') {
      output = '<div class="eaw-card-grid">' + entries.map(function (entry) {
        return '<article class="eaw-card"><span class="oyun-etiket">' + esc(category(entry.tur).ad) + '</span><h3><button type="button" class="eaw-link" data-eaw-open="' + esc(entry.id) + '">' + esc(entry.baslik) + '</button></h3>' +
          (entry.ozet ? '<p>' + esc(entry.ozet) + '</p>' : '') + (entry.habitat ? '<p><b>Habitat / konum:</b> ' + esc(entry.habitat) + '</p>' : '') +
          '<button type="button" class="eaw-read-link" data-eaw-open="' + esc(entry.id) + '">Maddeyi oku →</button></article>';
      }).join('') + '</div>';
    } else if (state.view === 'alfabetik') {
      var groups = Object.create(null);
      entries.forEach(function (entry) {
        var letter = (String(entry.baslik || '').trim().charAt(0) || '#').toLocaleUpperCase('tr-TR');
        (groups[letter] || (groups[letter] = [])).push(entry);
      });
      output = '<div class="eaw-alpha-index">' + Object.keys(groups).sort(compare.compare).map(function (letter) {
        return '<section><h3>' + esc(letter) + '</h3><ul>' + groups[letter].map(function (entry) {
          return '<li><button type="button" class="eaw-link" data-eaw-open="' + esc(entry.id) + '">' + esc(entry.baslik) + '</button> <span>' + esc(category(entry.tur).ad) + '</span></li>';
        }).join('') + '</ul></section>';
      }).join('') + '</div>';
    } else {
      output = '<ul class="eaw-list-view">' + entries.map(function (entry) {
        return '<li><button type="button" class="eaw-list-entry" data-eaw-open="' + esc(entry.id) + '">' + entrySummary(entry) + '<span class="eaw-arrow" aria-hidden="true">›</span></button></li>';
      }).join('') + '</ul>';
    }
    target.innerHTML = '<p class="eaw-result-count">' + entries.length + ' madde' + (query ? ' bulundu' : '') + '</p>' + output;
    root.querySelectorAll('[data-eaw-category]').forEach(function (button) {
      var active = button.getAttribute('data-eaw-category') === state.category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    root.querySelectorAll('[data-eaw-view]').forEach(function (button) {
      var active = button.getAttribute('data-eaw-view') === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function linkedEntitiesHtml(world, entry, isOwner) {
    var ids = Array.isArray(entry.ilgiliVarlikIds) ? entry.ilgiliVarlikIds : [];
    var items = ids.map(function (targetId) { return entityById(world, targetId, !isOwner); }).filter(function (item) { return item && !item.gizli && (item.tur !== 'wiki' || item.durum === 'yayinda' || isOwner); });
    if (!items.length) return '';
    return '<section class="eaw-related-entities"><h2>Bağlı evren kayıtları</h2><ul>' + items.map(function (item) {
      if (item.tur === 'wiki' && item.durum === 'yayinda') return '<li><button type="button" class="eaw-link" data-eaw-open="' + esc(item.record.id) + '">' + esc(item.label) + '</button></li>';
      if (item.tur === 'wiki') return '<li><span>' + esc(item.label) + ' · taslak, yalnızca sahibi görebilir</span></li>';
      return '<li><button type="button" class="eaw-link" data-eaw-entity-open="' + esc(item.varlikId) + '">' + esc(item.label) + ' →</button></li>';
    }).join('') + '</ul></section>';
  }
  function entityDetailHtml(world, entityId, isOwner) {
    var item = entityById(world, entityId, !isOwner);
    if (!item || item.gizli || (item.tur === 'wiki' && item.durum !== 'yayinda' && !isOwner)) return '<div class="eaw-empty"><h2>Kayıt açılamadı</h2><p>Bu kayıt bulunamadı veya bu evrende görüntülenemiyor.</p><button type="button" class="dugme dugme-sade" data-eaw-entity-back>← Önceki görünüme dön</button></div>';
    if (item.tur === 'wiki' && item.record && item.durum === 'yayinda') return detailHtml(world, item.record, isOwner).replace('data-eaw-back>', 'data-eaw-entity-back>');
    var record = item.record || {}, details = item.source === 'kisi' ? [record.rol, record.aciklama, record.yas, record.yer] : item.source === 'yer' ? [record.tur, record.aciklama] : item.source === 'tarih' ? [record.zaman, record.cag, record.olay] : item.source === 'gezegen' ? [record.ad] : [record.tur, record.not, record.aciklama];
    var content = details.filter(Boolean).map(function (value) { return '<p>' + esc(value).replace(/\n/g, '<br>') + '</p>'; }).join('');
    return '<article class="eaw-article eaw-entity-detail"><div class="eaw-article-top"><button type="button" class="dugme dugme-sade" data-eaw-entity-back>← Önceki görünüme dön</button></div><header><span class="oyun-etiket">' + esc(item.label.split(' · ')[0]) + '</span><h1>' + esc(item.baslik) + '</h1></header><section class="eaw-prose">' + (content || '<p>Bu kayda ek açıklama eklenmemiş.</p>') + '</section></article>';
  }
  function detailHtml(world, entry, isOwner) {
    var cat = category(entry.tur), fields = entry.ozellikler || {};
    var facts = (cat.alanlar || []).map(function (key) {
      var value = fields[key], label = schema().fields && schema().fields[key] || key;
      return value ? '<div class="eaw-fact"><dt>' + esc(label) + '</dt><dd>' + esc(value).replace(/\n/g, '<br>') + '</dd></div>' : '';
    }).join('');
    var related = (entry.ilgiliIds || []).map(function (relatedId) {
      var found = published(world).find(function (item) { return item.id === relatedId; });
      return found ? '<li><button type="button" class="eaw-link" data-eaw-open="' + esc(found.id) + '">' + esc(found.baslik) + '</button> <span>' + esc(category(found.tur).ad) + '</span></li>' : '';
    }).filter(Boolean).join('');
    var references = (entry.kaynakca || []).map(function (source) {
      var safe = safeExternalUrl(source.url);
      var title = safe ? '<a href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer">' + esc(source.baslik) + '</a>' : esc(source.baslik);
      return '<li><strong>' + title + '</strong>' + (source.aciklama ? '<p>' + esc(source.aciklama) + '</p>' : '') + '</li>';
    }).join('');
    var imageMeta = sanitizeImage(entry.gorsel);
    var infoFacts = (entry.habitat ? '<div class="eaw-fact"><dt>Habitat / konum</dt><dd>' + esc(entry.habitat) + '</dd></div>' : '') + facts;
    var description = '<section><h2>Açıklama</h2><div class="eaw-prose eaw-markdown">' + markdownHtml(entry.aciklama || 'Bu madde için henüz ayrıntılı açıklama eklenmemiş.') + '</div></section>';
    var articleLayout = '<div class="eaw-article-layout"><aside class="eaw-infobox" aria-label="' + esc(cat.ad) + ' temel bilgileri"><div class="eaw-infobox-title">' + esc(entry.baslik) + '</div>' +
      '<div class="eaw-article-image">' + imageHtml(imageMeta, entry.baslik, world.id) + '</div><dl class="eaw-facts">' + (infoFacts || '<div class="eaw-fact"><dt>Temel bilgiler</dt><dd>Ek bilgi belirtilmemiş.</dd></div>') + '</dl></aside>' +
      '<div class="eaw-prose-column">' + (entry.giris ? '<section><h2>Giriş</h2><div class="eaw-intro eaw-markdown">' + markdownHtml(entry.giris) + '</div></section>' : '') +
      description + '</div></div>';
    var body = entry.spoiler ? '<details class="eaw-spoiler"><summary>Spoiler içeriyor · İçeriği göster</summary>' + articleLayout + '</details>' : articleLayout;
    body +=
      (related ? '<section class="eaw-related"><h2>İlgili maddeler</h2><ul>' + related + '</ul></section>' : '') +
      linkedEntitiesHtml(world, entry, isOwner) +
      backlinksHtml(world, entry) +
      '<section class="eaw-bibliography"><h2>Kaynakça</h2>' + (references ? '<ol>' + references + '</ol>' : '<p class="eaw-muted">Bu maddeye henüz kaynakça eklenmemiş.</p>') + '</section>' +
      '<footer class="eaw-modified">Son değişiklik: ' + esc(dateLabel(entry.sonDegisiklik)) + (entry.surum ? ' · v' + esc(entry.surum) : '') + '</footer>' +
      '<p class="eaw-github-discussion"><a class="dugme dugme-sade" href="' + esc(githubDiscussionUrl(world, entry)) + '" target="_blank" rel="noopener noreferrer">GitHub\'ta tartış / düzeltme öner</a></p>';
    var share = isOwner ? '' : '<button type="button" class="dugme dugme-sade" data-eaw-copy="' + esc(entry.id) + '">Madde bağlantısını kopyala</button>';
    return '<article class="eaw-article"><div class="eaw-article-top"><button type="button" class="dugme dugme-sade" data-eaw-back>← Ansiklopediye dön</button>' + share + '</div>' +
      '<header><span class="oyun-etiket">' + esc(cat.ad) + '</span><h1>' + esc(entry.baslik) + '</h1>' + (entry.ozet ? '<div class="eaw-summary eaw-markdown">' + markdownHtml(entry.ozet) + '</div>' : '') + '</header>' + body + '</article>';
  }
  function readerHtml(world) {
    var idKey = currentWorldId(world), isOwner = owner(), entry = selectedEntry(world);
    var preview = isOwner && previewMode[idKey], entityId = entityParam();
    return '<section class="eaw-reader" data-eaw-world="' + esc(idKey) + '">' +
      (isOwner ? '<div class="eaw-preview-note"><p>' + (preview ? 'Okur önizlemesi: taslak maddeler ve yerel görseller başka okuyuculara açık değildir.' : 'Okur görünümü; taslak maddeler burada gösterilmez.') + '</p><button type="button" class="dugme dugme-sade" data-eaw-edit>← Düzenlemeye dön</button></div>' : '') +
      '<header class="eaw-reader-head"><div><span class="oyun-etiket">Evren ansiklopedisi</span><h2>' + esc(world.ad || 'Evren') + '</h2><p>Türlerine göre gezin, alfabetik indeksi kullan veya tüm içerikte ara.</p></div><span class="eaw-total">' + published(world).length + ' yayınlanmış madde</span></header>' +
      '<div class="eaw-content">' + (entry ? detailHtml(world, entry, isOwner) : entityId ? entityDetailHtml(world, entityId, isOwner) : indexHtml(world)) + '</div></section>';
  }
  function renderReaderContent(root, world) {
    if (!root || !world) return;
    var content = root.querySelector('.eaw-content');
    if (!content) return;
    var entry = selectedEntry(world), entityId = entityParam();
    content.innerHTML = entry ? detailHtml(world, entry, owner()) : entityId ? entityDetailHtml(world, entityId, owner()) : indexHtml(world);
    if (!entry) renderResults(root, world);
  }
  function hookTabs() {
    var oldTabs = window.evrenEkSekmeler;
    if (typeof oldTabs === 'function' && !oldTabs.__eaw) {
      var tabs = function (page) {
        var result = oldTabs.apply(this, arguments);
        result = Array.isArray(result) ? result.slice() : [];
        var world = pageWorld(page);
        if ((owner(page) || published(world).length || entityParam()) && !result.some(function (tab) { return tab && tab[0] === 'ansiklopedi'; })) result.push(['ansiklopedi', 'Ansiklopedi']);
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
          return world ? (owner(page) ? (entityParam() || previewMode[currentWorldId(world)] ? readerHtml(world) : editorHtml(world)) : readerHtml(world)) : '<p class="oyun-not">Evren verisi yüklenemedi.</p>';
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
        if (html.indexOf(marker) >= 0) html = html.replace(marker, marker + '<button type="button" class="evr-kart" data-eaw-card data-evs-sekme="ansiklopedi"><b>Ansiklopedi</b><span>Bitki, hayvan, eşya, bina ve güçleri Wiki maddeleri olarak düzenle</span></button>');
      }
      return html;
    };
    wrapped.__eaw = true;
    window.evrKurucuHtml = wrapped;
  }
  function newEntry() {
    mutate(function (world) {
      if (!Array.isArray(world.ansiklopediMaddeleri)) world.ansiklopediMaddeleri = [];
      if (world.ansiklopediMaddeleri.length >= MAX_ARTICLES) throw new Error('Bir evrende en fazla 300 ansiklopedi maddesi olabilir.');
      world.ansiklopediMaddeleri.push({
        id: id(), varlikId: newEntityId(), tur: categories()[0] && categories()[0].id || 'diger', baslik: '', ozet: '', giris: '', aciklama: '', etiketler: [], habitat: '',
        ozellikler: {}, ilgiliIds: [], ilgiliVarlikIds: [], kaynakca: [], gorsel: null, spoiler: false, durum: 'taslak', surum: 1, sonDegisiklik: now(), gecmis: []
      });
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
  async function portableImage(meta) {
    if (!meta) return null;
    var clean = sanitizeImage(meta);
    if (!clean) throw new Error('Bir maddenin görsel metadata bilgisi geçersiz.');
    if (clean.kaynak === 'embedded') return clean;
    if (clean.kaynak !== 'indexeddb' || !window.evrenGorselVarlik || typeof window.evrenGorselVarlik.disaAktar !== 'function') {
      throw new Error('Görsel bu cihazda bulunamadı veya yedeklenebilir biçimde değil.');
    }
    var record = await window.evrenGorselVarlik.disaAktar(clean);
    if (!record || !record.blob) throw new Error('Bir görsel dosyası bu cihazda bulunamadı.');
    try {
      clean.kaynak = 'embedded';
      clean.veri = await blobDataUrl(record.blob);
      var safe = sanitizeImage(clean);
      if (!safe) throw new Error('Gömülü görsel güvenli biçimde doğrulanamadı.');
      return safe;
    } finally { if (record.url) { try { URL.revokeObjectURL(record.url); } catch (_) {} } }
  }
  async function portableArticle(entry) {
    var copy = JSON.parse(JSON.stringify(entry));
    copy.gorsel = await portableImage(copy.gorsel);
    for (var i = 0; i < (copy.gecmis || []).length; i += 1) {
      var revision = copy.gecmis[i];
      if (revision && revision.madde) revision.madde.gorsel = await portableImage(revision.madde.gorsel);
    }
    return copy;
  }
  async function exportEncyclopedia() {
    var world = getWorldForEdit();
    if (!world) throw new Error('Dışa aktarma yalnızca kendi evreninde kullanılabilir.');
    var articles = [], deleted = [];
    for (var i = 0; i < records(world).length; i += 1) articles.push(await portableArticle(records(world)[i]));
    for (var j = 0; j < deletedRecords(world).length; j += 1) deleted.push(await portableArticle(deletedRecords(world)[j]));
    var payload = {
      format: BACKUP_FORMAT, version: BACKUP_VERSION, schemaVersion: schema().version,
      kategoriler: categories().map(function (item) { return item.id; }),
      evrenId: world.id, evrenAdi: world.ad || '', maddeler: articles, silinenMaddeler: deleted
    };
    var blob = new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' });
    if (blob.size > MAX_BACKUP_BYTES) throw new Error('Ansiklopedi yedeği 20 MB sınırını aşıyor; daha az veya daha küçük görsel seç.');
    var url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = (String(world.id || 'evren').replace(/[^A-Za-z0-9_-]/g, '') || 'evren') + '-ansiklopedi.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    status('Ansiklopedi yedeği indirildi; maddeler, kaynakça, geçmiş ve görseller JSON dosyasına eklendi.', true);
  }
  function validateImageMeta(meta) {
    if (!meta) return true;
    var clean = sanitizeImage(meta);
    if (!clean || clean.kaynak !== 'embedded' || !clean.veri) return false;
    var match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(clean.veri);
    if (!match) return false;
    var decodedBytes = Math.floor(match[2].length * 3 / 4);
    return decodedBytes > 0 && decodedBytes <= 10 * 1024 * 1024 && clean.mime === 'image/' + match[1].toLowerCase();
  }
  function validateArticleImages(entry) {
    if (!validateImageMeta(entry && entry.gorsel)) return false;
    return (entry && Array.isArray(entry.gecmis) ? entry.gecmis : []).every(function (revision) {
      return !revision || !revision.madde || validateImageMeta(revision.madde.gorsel);
    });
  }
  function validateImportArticle(entry, version, seen) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Yedekte geçersiz ansiklopedi maddesi var.');
    var articleId = String(entry.id || '');
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(articleId)) throw new Error('Yedekte geçersiz veya eksik madde kimliği var.');
    if (seen.has(articleId)) throw new Error('Yedekte yinelenen madde kimliği var: ' + articleId);
    seen.add(articleId);
    var status = entry.durum == null ? 'taslak' : String(entry.durum);
    if (status !== 'taslak' && status !== 'yayinda') throw new Error('“' + String(entry.baslik || articleId).slice(0, 60) + '” maddesinin yayın durumu geçersiz.');
    if (status === 'yayinda') {
      if (!String(entry.baslik || '').trim()) throw new Error('Yayınlanmış bir madde başlıksız olamaz: ' + articleId);
      if (!String(entry.ozet || '').trim()) {
        var legacySummary = version === 1 ? String(entry.giris || entry.aciklama || '').trim() : '';
        if (!legacySummary) throw new Error('“' + String(entry.baslik || articleId).slice(0, 60) + '” yayınlanmış maddesinin kısa tanıtımı eksik.');
        entry.ozet = legacySummary.slice(0, 500);
      }
    }
    var known = categories().some(function (item) { return item.id === entry.tur; });
    if (version >= 2 && !known) throw new Error('“' + String(entry.baslik || articleId).slice(0, 60) + '” maddesinin kategorisi geçersiz.');
    if (!Array.isArray(entry.ilgiliIds) || entry.ilgiliIds.length > 100) throw new Error('“' + String(entry.baslik || articleId).slice(0, 60) + '” maddesinin ilişkileri geçersiz.');
    if (entry.varlikId != null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(entry.varlikId))) throw new Error('“' + String(entry.baslik || articleId).slice(0, 60) + '” maddesinin varlık kimliği geçersiz.');
    if (entry.ilgiliVarlikIds !== undefined && (!Array.isArray(entry.ilgiliVarlikIds) || entry.ilgiliVarlikIds.length > 100 || entry.ilgiliVarlikIds.some(function (id) { return !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id)); }))) throw new Error('“' + String(entry.baslik || articleId).slice(0, 60) + '” maddesinin varlık bağlantıları geçersiz.');
    if (!Array.isArray(entry.kaynakca || []) || (entry.kaynakca || []).length > 40) throw new Error('“' + String(entry.baslik || articleId).slice(0, 60) + '” maddesinin kaynakçası geçersiz.');
    if (entry.gecmis !== undefined && (!Array.isArray(entry.gecmis) || entry.gecmis.length > MAX_REVISIONS)) throw new Error('“' + String(entry.baslik || articleId).slice(0, 60) + '” maddesinin geçmişi bozuk veya 20 sürüm sınırını aşıyor.');
    (entry.kaynakca || []).forEach(function (source) {
      if (!source || typeof source !== 'object' || !String(source.baslik || '').trim()) throw new Error('Kaynak başlığı eksik veya geçersiz.');
      if (source.url && !safeExternalUrl(source.url)) throw new Error('“' + String(source.baslik).slice(0, 80) + '” kaynağının bağlantısı güvenli HTTPS adresi değil.');
    });
    if (!validateArticleImages(entry)) throw new Error('“' + String(entry.baslik || articleId).slice(0, 60) + '” maddesinin görseli geçersiz veya yedeğe gömülmemiş.');
    (entry.gecmis || []).forEach(function (revision) {
      if (!revision || typeof revision !== 'object' || !revision.madde) throw new Error('Madde düzenleme geçmişi bozuk.');
      if (!validateImageMeta(revision.madde.gorsel)) throw new Error('Düzenleme geçmişinde geçersiz veya gömülmemiş görsel var.');
    });
  }
  function validateImport(payload) {
    if (!payload || payload.format !== BACKUP_FORMAT || ![1, BACKUP_VERSION].includes(payload.version) || !Array.isArray(payload.maddeler) || payload.maddeler.length > MAX_ARTICLES) {
      throw new Error('Bu, geçerli TentiFor ansiklopedi yedeği değil.');
    }
    if (payload.version >= 2) {
      var expectedCategories = categories().map(function (item) { return item.id; });
      if (payload.schemaVersion !== schema().version || !Array.isArray(payload.kategoriler) || payload.kategoriler.length !== expectedCategories.length || expectedCategories.some(function (id) { return payload.kategoriler.indexOf(id) < 0; })) {
        throw new Error('Yedek ansiklopedi şeması bu sürümle uyumlu değil.');
      }
    }
    var deleted = payload.silinenMaddeler == null ? [] : payload.silinenMaddeler;
    if (!Array.isArray(deleted) || deleted.length > MAX_ARTICLES) throw new Error('Silinen maddeler listesi geçersiz.');
    var seen = new Set;
    payload.maddeler.forEach(function (entry) { validateImportArticle(entry, payload.version, seen); });
    deleted.forEach(function (entry) { validateImportArticle(entry, payload.version, seen); });
    var knownIds = seen;
    payload.maddeler.concat(deleted).forEach(function (entry) {
      (entry.ilgiliIds || []).forEach(function (targetId) {
        if (!knownIds.has(targetId)) throw new Error('“' + String(entry.baslik || entry.id).slice(0, 60) + '” maddesi bulunmayan bağlantı hedefini içeriyor: ' + targetId);
      });
    });
    var cleaned = typeof window.evrenAnsiklopediTemizle === 'function' ? window.evrenAnsiklopediTemizle(payload.maddeler) : null;
    var cleanedDeleted = typeof window.evrenAnsiklopediTemizle === 'function' ? window.evrenAnsiklopediTemizle(deleted) : null;
    if (!Array.isArray(cleaned) || cleaned.length !== payload.maddeler.length || !Array.isArray(cleanedDeleted) || cleanedDeleted.length !== deleted.length) {
      throw new Error('Yedekte geçersiz veya yinelenen ansiklopedi kaydı var.');
    }
    return { entries: cleaned, deleted: cleanedDeleted };
  }
  async function importEncyclopedia(file) {
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Ansiklopedi yedeği 20 MB sınırını aşıyor.');
    var payload;
    try { payload = JSON.parse(await file.text()); } catch (_) { throw new Error('Dosya geçerli JSON değil.'); }
    var validated = validateImport(payload);
    var world = getWorldForEdit();
    if (!world) throw new Error('İçe aktarma yalnızca kendi evreninde kullanılabilir.');
    var hasPublishedImages = validated.entries.some(function (entry) { return entry.durum === 'yayinda' && !!entry.gorsel; });
    var warning = hasPublishedImages ? '\n\nNot: Yedekteki görseller bu tarayıcı profilindeki IndexedDB’ye geri yüklenir. Başka okuyucular bu görselleri göremeyebilir.' : '';
    if (!window.confirm('Bu işlem mevcut ansiklopedi maddelerini ve silinen madde listesini içe aktarılan yedekle değiştirir. Önceki içerik bu dosyada yoksa geri alınamaz.' + warning + '\n\nDevam edilsin mi?')) return;

    var uploads = [], restoredByData = new Map;
    async function restore(meta) {
      if (!meta) return null;
      var safe = sanitizeImage(meta);
      if (!safe || safe.kaynak !== 'embedded' || !safe.veri) throw new Error('Taşınabilir yedekte tüm görseller gömülü olmalıdır.');
      if (restoredByData.has(safe.veri)) return Object.assign({}, restoredByData.get(safe.veri), { alt: safe.alt || restoredByData.get(safe.veri).alt });
      if (!window.evrenGorselVarlik || typeof window.evrenGorselVarlik.gomuluAktar !== 'function') throw new Error('Yerel görsel geri yükleme aracı hazır değil.');
      var restored = await window.evrenGorselVarlik.gomuluAktar(safe, safe.veri);
      if (!restored || !restored.id || restored.kaynak !== 'indexeddb') throw new Error('Gömülü görsel yerel depoya doğrulanarak kaydedilemedi.');
      uploads.push(restored);
      restoredByData.set(safe.veri, restored);
      return restored;
    }
    async function restoreAll(entries) {
      for (var i = 0; i < entries.length; i += 1) {
        entries[i].gorsel = await restore(entries[i].gorsel);
        for (var j = 0; j < (entries[i].gecmis || []).length; j += 1) {
          var revision = entries[i].gecmis[j];
          if (revision && revision.madde) revision.madde.gorsel = await restore(revision.madde.gorsel);
        }
      }
    }
    var beforeEntries = JSON.parse(JSON.stringify(records(world)));
    var beforeDeleted = JSON.parse(JSON.stringify(deletedRecords(world)));
    try {
      await restoreAll(validated.entries);
      await restoreAll(validated.deleted);
      mutate(function (draft) {
        draft.ansiklopediMaddeleri = validated.entries;
        draft.ansiklopediSilinenMaddeler = validated.deleted;
      });
      var saved = getWorldForEdit();
      if (!saved || JSON.stringify(records(saved)) !== JSON.stringify(validated.entries) || JSON.stringify(deletedRecords(saved)) !== JSON.stringify(validated.deleted)) {
        throw new Error('İçe aktarma kaydı doğrulanamadı; mevcut maddeler geri yükleniyor.');
      }
      var cleanupFailures = await cleanupOrphanImages(beforeEntries.concat(beforeDeleted), records(saved).concat(deletedRecords(saved)));
      if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
      status(cleanupFailures ? 'Ansiklopedi yedeği içe aktarıldı; ancak ' + cleanupFailures + ' eski yerel görsel temizlenemedi.' : 'Ansiklopedi yedeği içe aktarıldı. Görseller bu tarayıcı profiline kaydedildi.', !cleanupFailures);
    } catch (error) {
      try {
        mutate(function (draft) { draft.ansiklopediMaddeleri = beforeEntries; draft.ansiklopediSilinenMaddeler = beforeDeleted; });
      } catch (_) {}
      await cleanupOrphanImages(uploads.map(function (meta) { return { gorsel: meta }; }), beforeEntries.concat(beforeDeleted));
      throw error;
    }
  }
  function publishRequirements(entry) {
    var missing = [];
    if (!String(entry.baslik || '').trim()) missing.push('madde adı');
    if (!String(entry.ozet || '').trim()) missing.push('kısa tanıtım');
    return missing;
  }
  function updateField(entryId, field, value) {
    var allowed = ['tur', 'baslik', 'ozet', 'giris', 'aciklama', 'habitat', 'etiketler', 'ilgiliIds', 'ilgiliVarlikIds', 'durum', 'spoiler'];
    var world = getWorldForEdit(), current = world && findEntry(world, entryId);
    if (!current) return false;
    var parsed = value;
    if (field.indexOf('ozellikler.') === 0) {
      var key = field.slice('ozellikler.'.length);
      if (!Object.prototype.hasOwnProperty.call(schema().fields || {}, key)) return false;
      parsed = String(value || '').slice(0, 2000);
      if (current.ozellikler && current.ozellikler[key] === parsed) return true;
      mutate(function (draft) {
        var target = findEntry(draft, entryId); if (!target) return;
        saveRevision(target, 'Özellik düzenlendi'); target.ozellikler = target.ozellikler || {}; target.ozellikler[key] = parsed;
        target.surum = (Number(target.surum) || 1) + 1; target.sonDegisiklik = now();
      });
    } else {
      if (allowed.indexOf(field) < 0) return false;
      if (field === 'tur' && !categories().some(function (item) { return item.id === value; })) return false;
      if (field === 'durum' && value !== 'taslak' && value !== 'yayinda') return false;
      if (field === 'durum' && value === 'yayinda') {
        var missing = publishRequirements(current);
        if (missing.length) { entryStatus(entryId, 'Yayın için önce ' + missing.join(' ve ') + ' ekle.', false); return false; }
        if (current.gorsel && current.gorsel.kaynak === 'indexeddb') {
          var accepted = window.confirm('Bu görsel yalnızca bu tarayıcı profilindeki IndexedDB’de. Yayınlarsan diğer okuyucular görseli göremeyebilir. Eksik görsel uyarısını kabul ederek maddeyi yayımlamak istiyor musun?');
          if (!accepted) { entryStatus(entryId, 'Yayın iptal edildi; görsel paylaşılabilir değil.', false); return false; }
        }
      }
      if (field === 'etiketler') parsed = String(value || '').split(',').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 30);
      if (field === 'ilgiliIds') parsed = Array.isArray(value) ? value.slice(0, 100) : String(value || '').split(',').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 100);
      if (field === 'ilgiliVarlikIds') parsed = Array.isArray(value) ? value.slice(0, 100) : [];
      if (field === 'ilgiliVarlikIds') {
        var tokens = parsed.slice(), generated = [];
        mutate(function (draft) {
          var target = findEntry(draft, entryId); if (!target) return;
          var candidates = entityCandidates(draft, true), ids = [];
          tokens.forEach(function (token) {
            var candidate = candidates.find(function (item) { return item.varlikId === token; });
            if (!candidate) throw new Error('Bağlantı hedefi bulunamadı; hiçbir değişiklik kaydedilmedi.');
            var stableId = candidate.legacy ? newEntityId() : candidate.varlikId;
            if (!stableId) throw new Error('Güvenli UUID üretilemedi; bağlantı kaydedilmedi.');
            if (candidate.legacy) { candidate.record.varlikId = stableId; candidate.varlikId = stableId; generated.push(stableId); }
            if (ids.indexOf(stableId) < 0) ids.push(stableId);
          });
          saveRevision(target, 'Evren kaydı bağlantıları düzenlendi'); target.ilgiliVarlikIds = ids; target.surum = (Number(target.surum) || 1) + 1; target.sonDegisiklik = now();
        });
        entryStatus(entryId, generated.length ? 'Bağlantılar ve legacy kayıt kimlikleri bu evrenin yerel taslağına birlikte kaydedildi.' : 'Bağlantılar bu evrenin yerel taslağına kaydedildi.', true);
        return true;
      }
      if (field === 'spoiler') parsed = !!value;
      var max = { baslik: 120, ozet: 500, giris: 5000, aciklama: 16000, habitat: 500 }[field];
      if (typeof parsed === 'string' && max) parsed = parsed.slice(0, max);
      if (JSON.stringify(current[field]) === JSON.stringify(parsed)) return true;
      mutate(function (draft) {
        var target = findEntry(draft, entryId); if (!target) return;
        saveRevision(target, field === 'durum' ? 'Yayın durumu değiştirildi' : 'Madde düzenlendi');
        target[field] = parsed;
        target.surum = (Number(target.surum) || 1) + 1; target.sonDegisiklik = now();
      });
    }
    entryStatus(entryId, 'Değişiklik bu evrenin taslağına kaydedildi (v' + ((Number(current.surum) || 1) + 1) + ').', true);
    return true;
  }
  function updateSource(entryId, index, field, value) {
    if (!['baslik', 'aciklama', 'url'].includes(field)) return;
    var world = getWorldForEdit(), entry = world && findEntry(world, entryId);
    if (!entry) return;
    var parsed = String(value || '').trim();
    if (field === 'baslik') parsed = parsed.slice(0, 180);
    if (field === 'aciklama') parsed = String(value || '').slice(0, 800);
    if (field === 'url' && parsed && !safeExternalUrl(parsed)) { entryStatus(entryId, 'Kaynak bağlantısı yalnızca geçerli HTTPS URL olabilir.', false); return; }
    if (!Array.isArray(entry.kaynakca) || !entry.kaynakca[index] || entry.kaynakca[index][field] === parsed) return;
    mutate(function (draft) {
      var target = findEntry(draft, entryId); if (!target || !target.kaynakca || !target.kaynakca[index]) return;
      saveRevision(target, 'Kaynakça düzenlendi'); target.kaynakca[index][field] = parsed;
      target.surum = (Number(target.surum) || 1) + 1; target.sonDegisiklik = now();
    });
    entryStatus(entryId, 'Kaynakça taslağa kaydedildi.', true);
  }
  function addSource(entryId) {
    mutate(function (draft) {
      var target = findEntry(draft, entryId); if (!target) return;
      target.kaynakca = Array.isArray(target.kaynakca) ? target.kaynakca : [];
      if (target.kaynakca.length >= 40) throw new Error('Bir maddeye en fazla 40 kaynak eklenebilir.');
      saveRevision(target, 'Kaynakça eklendi'); target.kaynakca.push({ baslik: 'Yeni kaynak', aciklama: '', url: '' });
      target.surum = (Number(target.surum) || 1) + 1; target.sonDegisiklik = now();
    });
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
  }
  function removeSource(entryId, index) {
    mutate(function (draft) {
      var target = findEntry(draft, entryId); if (!target || !Array.isArray(target.kaynakca)) return;
      saveRevision(target, 'Kaynakça kaldırıldı'); target.kaynakca.splice(index, 1);
      target.surum = (Number(target.surum) || 1) + 1; target.sonDegisiklik = now();
    });
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
  }
  async function uploadEntryImage(entryId, file) {
    if (!file) return;
    var world = getWorldForEdit(), entry = world && findEntry(world, entryId);
    if (!entry) throw new Error('Ansiklopedi maddesi bulunamadı.');
    if (entry.durum === 'yayinda' && !window.confirm('Yüklenen görsel bu tarayıcı profilinin yerel deposunda kalır. Diğer okuyucular görseli göremeyebilir. Bu uyarıyı kabul ederek görseli eklemek istiyor musun?')) return;
    if (!window.evrenGorselVarlik || typeof window.evrenGorselVarlik.yukle !== 'function') throw new Error('Yerel görsel deposu hazır değil.');
    var previousImages = records(world).concat(deletedRecords(world));
    var uploaded = await window.evrenGorselVarlik.yukle(file, { tur: 'varlik', alt: entry.baslik || 'Ansiklopedi maddesi', kaplama: 'contain' });
    var updated;
    try {
      updated = mutate(function (draft) {
        var target = findEntry(draft, entryId); if (!target) throw new Error('Madde silinmiş.');
        saveRevision(target, 'Görsel değiştirildi'); target.gorsel = uploaded;
        target.surum = (Number(target.surum) || 1) + 1; target.sonDegisiklik = now();
      });
    } catch (error) { await window.evrenGorselVarlik.sil(uploaded).catch(function () {}); throw error; }
    var cleanupFailures = await cleanupOrphanImages(previousImages, records(updated).concat(deletedRecords(updated)));
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
    entryStatus(entryId, cleanupFailures ? 'Görsel kaydedildi ancak kullanılmayan eski görsel temizlenemedi.' : 'Görsel doğrulandı ve bu tarayıcı profiline kaydedildi.', !cleanupFailures);
  }
  function deleteEntry(entryId) {
    var world = getWorldForEdit(), entry = world && findEntry(world, entryId);
    if (!entry || !window.confirm('Madde geri alınabilir biçimde silinsin mi? Görsel ve geçmiş yedekte korunur.')) return;
    var previousEntries = records(world).concat(deletedRecords(world));
    var updated = mutate(function (draft) {
      var target = findEntry(draft, entryId); if (!target) return;
      draft.ansiklopediSilinenMaddeler = Array.isArray(draft.ansiklopediSilinenMaddeler) ? draft.ansiklopediSilinenMaddeler : [];
      draft.ansiklopediSilinenMaddeler.push(Object.assign({}, target, { silindiAt: now() }));
      if (draft.ansiklopediSilinenMaddeler.length > MAX_ARTICLES) draft.ansiklopediSilinenMaddeler.shift();
      draft.ansiklopediMaddeleri = records(draft).filter(function (item) { return item.id !== entryId; });
    });
    if (articleParam() === entryId) changeArticleUrl('', 'replace', currentWorldId(world));
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
    cleanupOrphanImages(previousEntries, records(updated).concat(deletedRecords(updated))).then(function (failures) {
      if (failures) status('Madde silindi; ancak kullanılmayan eski görsellerden ' + failures + ' tanesi temizlenemedi.', false);
    });
  }
  function restoreDeleted(entryId) {
    var world = getWorldForEdit(), entry = world && deletedRecords(world).find(function (item) { return item && item.id === entryId; });
    if (!entry) return;
    var active = records(world);
    if (active.some(function (item) { return item && item.id === entryId; })) throw new Error('Bu madde kimliği zaten etkin listede var; yinelenen kayda izin verilmedi.');
    if (active.length >= MAX_ARTICLES) throw new Error('Bu evrende 300 etkin madde sınırı dolu. Önce bir maddeyi sil veya taslağını dışa aktar.');
    mutate(function (draft) {
      var deleted = deletedRecords(draft), index = deleted.findIndex(function (item) { return item && item.id === entryId; });
      if (index < 0) return;
      var restored = Object.assign({}, deleted[index]); delete restored.silindiAt; restored.durum = 'taslak';
      restored.surum = (Number(restored.surum) || 1) + 1; restored.sonDegisiklik = now();
      saveRevision(restored, 'Silinen madde geri yüklendi');
      draft.ansiklopediMaddeleri = records(draft).concat([restored]);
      draft.ansiklopediSilinenMaddeler = deleted.filter(function (_, itemIndex) { return itemIndex !== index; });
    });
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
    status('Madde geri yüklendi ve taslak olarak kaydedildi.', true);
  }
  function revertRevision(entryId, historyIndex) {
    var world = getWorldForEdit(), entry = world && findEntry(world, entryId), revision = entry && entry.gecmis && entry.gecmis[historyIndex];
    if (!revision || !revision.madde) return;
    if (!window.confirm('Bu eski sürüme dönülsün mü? Mevcut sürüm geçmişte korunur ve geri alınan madde taslak olarak kalır.')) return;
    mutate(function (draft) {
      var target = findEntry(draft, entryId), old = target && target.gecmis && target.gecmis[historyIndex];
      if (!target || !old || !old.madde) return;
      saveRevision(target, 'Önceki sürüme dönmeden önce');
      applyRevision(target, old.madde);
    });
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
    status('Önceki sürüm geri yüklendi ve taslak olarak kaydedildi.', true);
  }
  function copyArticleLink(entryId) {
    var url = new URL(window.location.href);
    url.searchParams.set(ARTICLE_PARAM, entryId);
    url.searchParams.delete(ENTITY_PARAM);
    var text = url.href, node = document.createElement('textarea');
    var done = function () { status('Madde bağlantısı panoya kopyalandı.', true); };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(); });
    } else fallbackCopy();
    function fallbackCopy() {
      node.value = text; node.setAttribute('readonly', ''); node.style.position = 'fixed'; node.style.left = '-9999px';
      document.body.appendChild(node); node.select();
      try { if (!document.execCommand('copy')) throw new Error('copy failed'); done(); }
      catch (_) { status('Bağlantı kopyalanamadı. Tarayıcı adres çubuğundaki URL’yi kopyala.', false); }
      finally { node.remove(); }
    }
  }
  function openArticle(root, world, entryId) {
    var target = published(world).find(function (item) { return item.id === entryId; });
    if (!target) return;
    selected[currentWorldId(world)] = target.id;
    changeArticleUrl(target.id, 'push', currentWorldId(world));
    renderReaderContent(root, world);
  }
  function openEntity(root, world, entityId) {
    var target = entityById(world, entityId, !owner());
    if (!target || target.gizli) { status('Bu kayıt bulunamadı veya bu evrende görüntülenemiyor.', false); return; }
    if (target.tur === 'wiki') {
      if (target.durum !== 'yayinda') { status('Taslak wiki maddesi okur bağlantısı olarak açılamaz.', false); return; }
      openArticle(root, world, target.record.id); return;
    }
    changeEntityUrl(target.varlikId, 'push', currentWorldId(world));
    var state = currentState(); if (state) state.sekme = 'ansiklopedi';
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); else renderReaderContent(root, world);
  }
  function backFromEntity(root, world) {
    var state = window.history.state || {};
    if (state.__eawEntity && state.__eawEntity.worldId === currentWorldId(world)) { window.history.back(); return; }
    changeEntityUrl('', 'replace', currentWorldId(world));
    var current = currentState(); if (current && state.__eawReturnTab) current.sekme = state.__eawReturnTab;
    if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); else renderReaderContent(root, world);
  }
  function activateEntityRoute() {
    if (!entityParam()) return;
    var state = currentState();
    if (state && state.sekme !== 'ansiklopedi') { state.sekme = 'ansiklopedi'; if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); }
  }
  window.evrenVarlikAc = function (entityId) {
    var page = typeof window.evrenSayfaVerisi === 'function' ? window.evrenSayfaVerisi() : null, world = pageWorld(page);
    if (!world) return false;
    var root = document.querySelector('#evrenSayfa .eaw-reader');
    if (!root) { changeEntityUrl(entityId, 'push', currentWorldId(world)); var state = currentState(); if (state) state.sekme = 'ansiklopedi'; if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); return true; }
    openEntity(root, world, entityId); return true;
  };
  function backToIndex(root, world) {
    var state = window.history.state && window.history.state.__eaw;
    var currentId = articleParam();
    if (state && state.worldId === currentWorldId(world) && state.articleId === currentId) {
      window.history.back();
      return;
    }
    changeArticleUrl('', 'replace', currentWorldId(world));
    delete selected[currentWorldId(world)];
    renderReaderContent(root, world);
  }
  function installStyles() {
    if (document.getElementById('eaw-styles')) return;
    var style = document.createElement('style');
    style.id = 'eaw-styles';
    style.textContent = '.eaw-markdown p{margin:.65em 0}.eaw-markdown h2,.eaw-markdown h3,.eaw-markdown h4{margin:1em 0 .45em}.eaw-markdown ul{padding-left:22px}.eaw-markdown code{padding:2px 5px;background:color-mix(in srgb,var(--cizgi,#ced4da) 35%,transparent);border-radius:4px}.eaw-backlinks{margin-top:24px}.eaw-diff{margin-top:8px}.eaw-diff-scroll{overflow:auto}.eaw-diff table{border-collapse:collapse;min-width:680px}.eaw-diff th,.eaw-diff td{border:1px solid var(--cizgi,#ced4da);padding:6px;vertical-align:top;text-align:left}.eaw-diff th{background:color-mix(in srgb,var(--deniz,#0f4c5c) 8%,transparent)}.eaw-diff del{color:#8b1e1e;white-space:pre-wrap}.eaw-diff ins{color:#176b35;text-decoration:none;white-space:pre-wrap}.eaw-history-actions{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap}.eaw-github-discussion{margin-top:18px}.eaw-controls{display:grid;grid-template-columns:minmax(0,2fr) minmax(180px,1fr);gap:14px;margin:16px 0}.eaw-controls label,.eaw-entry label,.eaw-source label{display:block;margin:12px 0}.eaw-controls input,.eaw-controls select,.eaw-entry input:not([type=checkbox]),.eaw-entry select,.eaw-entry textarea,.eaw-source input,.eaw-source textarea{display:block;width:100%;min-width:0;min-height:44px;margin-top:6px}.eaw-entry textarea,.eaw-source textarea{resize:vertical}.eaw-check input{width:22px;height:22px;vertical-align:middle}.eaw-entry select[multiple]{min-height:120px}.eaw-actions,.eaw-view-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.eaw-file-label{display:inline-flex;align-items:center;min-height:44px}.eaw-entry{margin:16px 0}.eaw-editor h2,.eaw-reader h2{margin-top:0}.eaw-index-layout{display:grid;grid-template-columns:minmax(190px,240px) minmax(0,1fr);gap:24px;margin-top:18px}.eaw-category-nav{align-self:start;position:sticky;top:12px;display:flex;flex-direction:column;gap:7px;padding:14px;border:1px solid var(--cizgi,#ced4da);background:var(--beyaz,#fff)}.eaw-category-nav h3{margin:0 0 6px}.eaw-category-button{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:44px;padding:8px 10px;border:1px solid transparent;border-radius:6px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}.eaw-category-button:hover,.eaw-category-button.is-active{background:color-mix(in srgb,var(--deniz,#0f4c5c) 9%,transparent);border-color:var(--cizgi,#ced4da)}.eaw-category-button span{font-size:.85em;opacity:.75}.eaw-view-controls{margin:10px 0 14px}.eaw-view-controls .is-active{font-weight:700;border-color:var(--deniz,#0f4c5c)}.eaw-results{min-width:0}.eaw-result-count,.eaw-muted{color:var(--murekkep,#495057);opacity:.8}.eaw-list-view{list-style:none;margin:0;padding:0;border-top:1px solid var(--cizgi,#ced4da)}.eaw-list-view li{border-bottom:1px solid var(--cizgi,#ced4da)}.eaw-list-entry{display:flex;position:relative;flex-direction:column;align-items:flex-start;gap:5px;width:100%;min-height:64px;padding:12px 40px 12px 10px;border:0;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}.eaw-list-entry:hover{background:color-mix(in srgb,var(--deniz,#0f4c5c) 7%,transparent)}.eaw-list-entry strong{font-size:1.05em}.eaw-entry-type,.eaw-entry-meta,.eaw-alpha-index li span{font-size:.88em;color:var(--murekkep,#495057);opacity:.82}.eaw-arrow{position:absolute;right:12px;top:16px;font-size:1.5em}.eaw-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:14px}.eaw-card{min-width:0;padding:18px;border:1px solid var(--cizgi,#ced4da);border-radius:8px;background:var(--beyaz,#fff)}.eaw-card h3{margin:10px 0}.eaw-link,.eaw-read-link{color:var(--deniz,#0f4c5c);font:inherit;font-weight:700;text-decoration:underline;background:none;border:0;padding:5px 0;cursor:pointer;text-align:left;overflow-wrap:anywhere}.eaw-read-link{display:inline-block;min-height:44px}.eaw-related-entities .eaw-link{display:block;min-height:44px}.eaw-alpha-index{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.eaw-alpha-index section{padding:12px;border:1px solid var(--cizgi,#ced4da);border-radius:6px}.eaw-alpha-index h3{margin:0;border-bottom:1px solid var(--cizgi,#ced4da)}.eaw-alpha-index ul,.eaw-related ul,.eaw-bibliography ol{padding-left:22px}.eaw-alpha-index li,.eaw-related li,.eaw-bibliography li{padding:6px 0;overflow-wrap:anywhere}.eaw-empty{padding:20px;border:1px dashed var(--cizgi,#ced4da);border-radius:8px}.eaw-reader-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding:20px 0 14px;border-bottom:1px solid var(--cizgi,#ced4da)}.eaw-reader-head h2{font-size:1.65rem;margin:8px 0}.eaw-reader-head p{margin:0}.eaw-total{white-space:nowrap;color:var(--murekkep,#495057)}.eaw-article{max-width:1080px;margin:18px auto;min-width:0}.eaw-article-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.eaw-article header{padding:20px 0 14px}.eaw-article h1{font-size:clamp(1.7rem,4vw,2.4rem);line-height:1.18;margin:8px 0}.eaw-summary{font-size:1.16rem;line-height:1.6;max-width:72ch}.eaw-article-layout{display:grid;grid-template-columns:minmax(250px,340px) minmax(0,1fr);gap:24px;margin:14px 0}.eaw-infobox{align-self:start;min-width:0;border:1px solid var(--cizgi,#ced4da);background:var(--beyaz,#fff);border-radius:8px;overflow:hidden}.eaw-infobox-title{padding:12px;font-weight:700;text-align:center;background:color-mix(in srgb,var(--deniz,#0f4c5c) 10%,transparent)}.eaw-article-image{padding:12px}.eaw-image{display:block;width:100%;max-height:320px;object-fit:contain}.eaw-image-empty{min-height:70px;padding:16px;border:1px dashed var(--cizgi,#ced4da);color:var(--murekkep,#495057);overflow-wrap:anywhere}.eaw-facts{display:grid;grid-template-columns:1fr;gap:0;margin:0;padding:0 12px 10px}.eaw-fact{padding:9px 0;border-top:1px solid var(--cizgi,#ced4da);overflow-wrap:anywhere}.eaw-fact dt{font-weight:700;color:var(--deniz,#0f4c5c)}.eaw-fact dd{margin:4px 0 0;line-height:1.5}.eaw-prose-column{min-width:0}.eaw-prose-column h2,.eaw-related h2,.eaw-bibliography h2{font-size:1.28rem;border-bottom:1px solid var(--cizgi,#ced4da);padding-bottom:6px}.eaw-intro,.eaw-prose{line-height:1.78;overflow-wrap:anywhere}.eaw-related,.eaw-bibliography{margin-top:24px}.eaw-bibliography a{overflow-wrap:anywhere}.eaw-modified{margin-top:22px;padding:12px 0;border-top:1px solid var(--cizgi,#ced4da);font-size:.9em;color:var(--murekkep,#495057)}.eaw-tags{margin-top:12px}.eaw-tags span{display:inline-block;margin:4px 6px 4px 0;padding:4px 8px;border:1px solid var(--cizgi,#ced4da);border-radius:12px}.eaw-preview-note,.eaw-warning{padding:12px;border-left:4px solid #c98200;background:color-mix(in srgb,#e0a020 12%,transparent)}.eaw-preview-note{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.eaw-preview-note p{margin:0}.eaw-warning-list{color:#704d00}.eaw-history,.eaw-trash{margin:16px 0;padding:10px;border:1px solid var(--cizgi,#ced4da);border-radius:6px}.eaw-history summary,.eaw-trash summary{min-height:36px;cursor:pointer;font-weight:700}.eaw-history li,.eaw-trash li{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:6px 0}.eaw-source{padding:10px;border:1px solid var(--cizgi,#ced4da);border-radius:6px}.eaw-specific-fields{padding:4px 12px;border-left:3px solid var(--deniz,#0f4c5c)}.eaw-empty,.eaw-category-nav,.eaw-card,.eaw-infobox,.eaw-entry,.eaw-source{overflow-wrap:anywhere}@media(max-width:760px){.eaw-index-layout{grid-template-columns:minmax(0,1fr);gap:14px}.eaw-category-nav{position:static;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.eaw-category-nav h3{grid-column:1/-1}.eaw-category-button{padding:7px}.eaw-controls{grid-template-columns:minmax(0,1fr);gap:6px}.eaw-article-layout{grid-template-columns:minmax(0,1fr);gap:12px}.eaw-infobox{max-width:100%}.eaw-facts{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:12px}.eaw-reader-head{align-items:flex-start;flex-direction:column}.eaw-total{white-space:normal}.eaw-alpha-index{grid-template-columns:minmax(0,1fr)}.eaw-card-grid{grid-template-columns:minmax(0,1fr)}.eaw-article{margin:8px 0}.eaw-article header{padding-top:14px}.eaw-article-top .dugme{min-height:44px}.eaw-actions .dugme,.eaw-view-controls .dugme{min-height:44px}}';
    document.head.appendChild(style);
  }

  hookTabs();
  hookCreator();
  installStyles();
  schema();
  document.addEventListener('tf-veri-hazir', function () { hookTabs(); hookCreator(); schema(); setTimeout(activateEntityRoute, 0); });

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest && event.target.closest('[data-eaw-new], [data-eaw-delete], [data-eaw-open], [data-eaw-entity-open], [data-eaw-entity-back], [data-eaw-back], [data-eaw-export], [data-eaw-preview], [data-eaw-edit], [data-eaw-category], [data-eaw-view], [data-eaw-copy], [data-eaw-add-source], [data-eaw-remove-source], [data-eaw-revert], [data-eaw-restore], [data-eaw-save]');
    if (target && target.hasAttribute('data-eaw-new')) { try { newEntry(); } catch (error) { status(error.message || 'Madde eklenemedi.', false); } return; }
    if (target && target.hasAttribute('data-eaw-export')) { exportEncyclopedia().catch(function (error) { status(error.message || 'Yedek indirilemedi.', false); }); return; }
    if (target && target.hasAttribute('data-eaw-preview')) { var previewWorld = getWorldForEdit(); if (previewWorld) { previewMode[currentWorldId(previewWorld)] = true; if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); } return; }
    if (target && target.hasAttribute('data-eaw-edit')) { var editWorld = getWorldForEdit(); if (editWorld) { previewMode[currentWorldId(editWorld)] = false; if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); } return; }
    if (target && target.hasAttribute('data-eaw-delete')) { deleteEntry(target.getAttribute('data-eaw-delete')); return; }
    if (target && target.hasAttribute('data-eaw-restore')) { try { restoreDeleted(target.getAttribute('data-eaw-restore')); } catch (error) { status(error.message || 'Madde geri yüklenemedi.', false); } return; }
    if (target && target.hasAttribute('data-eaw-revert')) { revertRevision(target.getAttribute('data-eaw-revert'), Number(target.getAttribute('data-eaw-revision'))); return; }
    if (target && target.hasAttribute('data-eaw-save')) { entryStatus(target.getAttribute('data-eaw-save'), 'Değişiklikler bu evrenin mevcut yerel taslağına kaydedildi.', true); return; }
    if (target && target.hasAttribute('data-eaw-copy')) { copyArticleLink(target.getAttribute('data-eaw-copy')); return; }
    if (target && target.hasAttribute('data-eaw-add-source')) { try { addSource(target.getAttribute('data-eaw-add-source')); } catch (error) { status(error.message || 'Kaynak eklenemedi.', false); } return; }
    if (target && target.hasAttribute('data-eaw-remove-source')) { var sourceParts = target.getAttribute('data-eaw-remove-source').split(':'); removeSource(sourceParts[0], Number(sourceParts[1])); return; }
    var root = target && target.closest('.eaw-reader');
    var page = typeof window.evrenSayfaVerisi === 'function' ? window.evrenSayfaVerisi() : null;
    var world = pageWorld(page);
    if (root && world && target.hasAttribute('data-eaw-category')) {
      readerSettings(world).category = target.getAttribute('data-eaw-category') || '';
      renderResults(root, world); return;
    }
    if (root && world && target.hasAttribute('data-eaw-view')) {
      readerSettings(world).view = target.getAttribute('data-eaw-view') || 'liste';
      renderResults(root, world); return;
    }
    if (root && world && target.hasAttribute('data-eaw-open')) { openArticle(root, world, target.getAttribute('data-eaw-open')); return; }
    if (root && world && target.hasAttribute('data-eaw-entity-open')) { openEntity(root, world, target.getAttribute('data-eaw-entity-open')); return; }
    if (root && world && target.hasAttribute('data-eaw-entity-back')) { backFromEntity(root, world); return; }
    if (root && world && target.hasAttribute('data-eaw-back')) { backToIndex(root, world); }
  });
  document.addEventListener('change', function (event) {
    var field = event.target && event.target.closest && event.target.closest('[data-eaw-field]');
    if (field && currentState() && currentState().kaynak === 'benim') {
      var parts = field.getAttribute('data-eaw-field').split(':'), fieldName = parts.slice(1).join(':');
      var value = field.type === 'checkbox' ? field.checked : field.multiple ? Array.from(field.selectedOptions).map(function (option) { return option.value; }) : field.value;
      var changed = updateField(parts[0], fieldName, value);
      if (changed && fieldName === 'tur' && typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
      return;
    }
    var source = event.target && event.target.closest && event.target.closest('[data-eaw-source-field]');
    if (source && currentState() && currentState().kaynak === 'benim') {
      var sourceParts = source.getAttribute('data-eaw-source-field').split(':'), sourceField = sourceParts.pop(), sourceIndex = Number(sourceParts.pop()), sourceId = sourceParts.join(':');
      updateSource(sourceId, sourceIndex, sourceField, source.value); return;
    }
    var image = event.target && event.target.closest && event.target.closest('[data-eaw-image]');
    if (image && currentState() && currentState().kaynak === 'benim') uploadEntryImage(image.getAttribute('data-eaw-image'), image.files && image.files[0]).catch(function (error) { entryStatus(image.getAttribute('data-eaw-image'), error.message || 'Görsel yüklenemedi.', false); });
    var backup = event.target && event.target.closest && event.target.closest('[data-eaw-import]');
    if (backup && currentState() && currentState().kaynak === 'benim') importEncyclopedia(backup.files && backup.files[0]).catch(function (error) { status(error.message || 'Yedek içe aktarılamadı.', false); });
    var sort = event.target && event.target.closest && event.target.closest('[data-eaw-sort]');
    if (sort) {
      var reader = sort.closest('.eaw-reader'), page = typeof window.evrenSayfaVerisi === 'function' ? window.evrenSayfaVerisi() : null;
      var world = pageWorld(page); if (reader && world) renderResults(reader, world);
    }
  });
  document.addEventListener('input', function (event) {
    var search = event.target && event.target.closest && event.target.closest('[data-eaw-search]');
    if (search) {
      var reader = search.closest('.eaw-reader'), page = typeof window.evrenSayfaVerisi === 'function' ? window.evrenSayfaVerisi() : null;
      var world = pageWorld(page); if (reader && world) renderResults(reader, world);
    }
  });
  window.addEventListener('popstate', function () {
    var root = document.querySelector('#evrenSayfa .eaw-reader');
    var state = currentState(), page = typeof window.evrenSayfaVerisi === 'function' ? window.evrenSayfaVerisi() : null;
    var world = pageWorld(page), historyState = window.history.state || {};
    if (state && !entityParam() && historyState.__eawReturnTab) state.sekme = historyState.__eawReturnTab;
    if (entityParam() && state && state.sekme !== 'ansiklopedi') state.sekme = 'ansiklopedi';
    if (root && state && state.sekme === 'ansiklopedi' && world) renderReaderContent(root, world);
    else if (state && state.sekme === 'ansiklopedi' && world && typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
  });
  window.addEventListener('hashchange', function () { setTimeout(activateEntityRoute, 0); });
  setTimeout(activateEntityRoute, 0);
}());
