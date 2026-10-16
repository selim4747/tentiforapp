/* TentiforApp 6.3.8 — sahip kontrollü harita ve zaman çizelgesi editörü. */
(function () {
  'use strict';
  var sessions = Object.create(null);
  var mapTypes = [['karakter','Karakter'],['mekan','Mekân'],['olay','Olay'],['gezegen','Gezegen'],['kavram','Kavram']];
  var linkTypes = [['akrabalik','Akrabalık'],['dusmanlik','Düşmanlık'],['müttefiklik','Müttefiklik'],['mekan','Mekân bağlantısı'],['zaman','Zaman ilişkisi'],['ozel','Özel bağlantı']];
  var eventTypes = [['olay','Olay'],['donem','Dönem'],['savas','Savaş'],['dogum','Doğum'],['olum','Ölüm'],['donum','Dönüm noktası']];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
    });
  }
  function client() {
    return typeof hesapIstemci !== 'undefined' && hesapIstemci && typeof hesapIstemci.rpc === 'function' ? hesapIstemci : null;
  }
  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function labelOptions(values, selected) {
    return values.map(function (item) { return '<option value="' + esc(item[0]) + '"' + (item[0] === selected ? ' selected' : '') + '>' + esc(item[1]) + '</option>'; }).join('');
  }
  function sessionFor(root) {
    if (typeof EVS === 'undefined' || !EVS || !EVS.id) return null;
    var id = String(EVS.id).trim();
    if (!id || id.length > 80) return null;
    if (!sessions[id]) {
      sessions[id] = {
        id: id, own: EVS.kaynak === 'benim', loaded: false, loading: false, error: '',
        canEdit: false, public: false, nodes: [], links: [], events: [], eventLinks: [],
        zoom: 1, dirty: false, selected: '', eventDraft: null
      };
    }
    sessions[id].own = EVS.kaynak === 'benim';
    return sessions[id];
  }
  function status(root, text, good) {
    var target = root.querySelector('[data-tf638-status]');
    if (!target) return;
    target.textContent = text || '';
    target.className = 'pencere-durum tf638-status' + (good ? ' iyi' : text ? ' kotu' : '');
    target.setAttribute('role', 'status');
    target.setAttribute('aria-live', 'polite');
  }
  function rpc(name, args) {
    var c = client();
    if (!c) return Promise.reject(new Error('Sunucu bağlantısı hazır değil.'));
    return c.rpc(name, args).then(function (result) {
      if (result && result.error) throw result.error;
      return result ? result.data : null;
    });
  }
  function createPanel(root, state) {
    var prior = root.querySelector('[data-tf638-root]');
    if (prior) prior.remove();
    var panel = document.createElement('section');
    panel.className = 'kutu-y tf638-panel';
    panel.setAttribute('data-tf638-root', '');
    panel.setAttribute('data-tf638-id', state.id);
    panel.innerHTML = '<div class="tf638-heading"><div><span class="oyun-etiket">Evren araçları · 6.3.8</span><h3>Görsel harita ve zaman çizelgesi</h3><p class="oyun-not">Harita taslakları hesabına bağlıdır. Yalnızca yayınlamayı seçtiğin düğümler ve olaylar ziyaretçilere görünür.</p></div><span class="tf638-badge" data-tf638-visibility>Yükleniyor…</span></div>' +
      '<p data-tf638-status class="pencere-durum tf638-status" role="status" aria-live="polite">Harita yükleniyor…</p>' +
      '<div class="tf638-map-section"><div class="tf638-section-head"><div><h4>Evren haritası</h4><p class="oyun-not">Düğümleri sürükle; klavyede ok tuşlarıyla taşı. Sunucu 150 düğüm ve 300 bağlantıyla sınırlar.</p></div><div class="tf638-zoom" aria-label="Harita yakınlaştırma"><button type="button" class="dugme dugme-sade" data-tf638-zoom="-" aria-label="Uzaklaştır">−</button><output data-tf638-zoom-value>100%</output><button type="button" class="dugme dugme-sade" data-tf638-zoom="+" aria-label="Yakınlaştır">+</button></div></div>' +
      '<div class="tf638-stage-wrap"><div class="tf638-stage" data-tf638-stage aria-label="Sürüklenebilir evren haritası"><div class="tf638-canvas" data-tf638-canvas><svg class="tf638-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" data-tf638-lines></svg><div class="tf638-nodes" data-tf638-nodes></div></div></div></div>' +
      '<div class="tf638-map-tools" data-tf638-editor hidden><form data-tf638-node-form class="tf638-form"><label>Düğüm türü<select name="tip" class="kod-giris">' + labelOptions(mapTypes, 'karakter') + '</select></label><label>Ad<input name="baslik" class="kod-giris" maxlength="120" required placeholder="Örn. Ay Işığı Kulesi"></label><label>Açıklama<input name="aciklama" class="kod-giris" maxlength="600" placeholder="Kısa not (isteğe bağlı)"></label><button class="dugme" type="submit">Düğüm ekle</button></form>' +
      '<form data-tf638-link-form class="tf638-form"><label>İlk düğüm<select name="kaynak" class="kod-giris" required></select></label><label>İkinci düğüm<select name="hedef" class="kod-giris" required></select></label><label>Bağ türü<select name="tur" class="kod-giris">' + labelOptions(linkTypes, 'akrabalik') + '</select></label><label>Etiket<input name="etiket" class="kod-giris" maxlength="80" placeholder="Özel bağ adı"></label><button class="dugme dugme-sade" type="submit">Bağlantı ekle</button></form>' +
      '<div class="tf638-toolbar"><label class="tf638-check"><input type="checkbox" data-tf638-public> Haritayı herkese açık yap</label><div><button type="button" class="dugme dugme-sade" data-tf638-reset>Haritayı sıfırla</button> <button type="button" class="dugme" data-tf638-save>Haritayı kaydet</button></div></div></div>' +
      '<div class="tf638-event-section"><div class="tf638-section-head"><div><h4>Zaman çizelgesi</h4><p class="oyun-not">Dönem/tarih, sıralama ve taslak/yayın durumunu belirle. Aynı dönemli olaylar çakışma etiketiyle gösterilir.</p></div></div>' +
      '<div class="tf638-event-list" data-tf638-events></div><form data-tf638-event-form class="tf638-form tf638-event-form"><input type="hidden" name="id"><label>Tarih / dönem<input name="zaman" class="kod-giris" maxlength="60" required placeholder="Örn. 4. Yüzyıl / 2042-05"></label><label>Başlık<input name="baslik" class="kod-giris" maxlength="160" required></label><label>Tür<select name="tur" class="kod-giris">' + labelOptions(eventTypes, 'olay') + '</select></label><label>Sıra<input name="sira" type="number" class="kod-giris" min="0" max="100000" value="0"></label><label class="tf638-wide">Açıklama<textarea name="aciklama" class="kod-giris" maxlength="600" rows="2"></textarea></label><label>Durum<select name="durum" class="kod-giris"><option value="taslak">Taslak</option><option value="yayinda">Yayında</option></select></label><div class="tf638-actions"><button class="dugme" type="submit" data-tf638-event-submit>Olay ekle</button><button class="dugme dugme-sade" type="button" data-tf638-cancel-edit hidden>Vazgeç</button></div></form>' +
      '<form data-tf638-event-link-form class="tf638-form tf638-event-link"><label>Önceki olay<select name="kaynak" class="kod-giris" required></select></label><label>Bağlı olay<select name="hedef" class="kod-giris" required></select></label><label>İlişki<input name="etiket" class="kod-giris" maxlength="80" placeholder="Öncesi / sonucu"></label><button class="dugme dugme-sade" type="submit">Olayları bağla</button></form></div>';
    root.appendChild(panel);
    bind(panel, state);
    render(panel, state);
  }
  function load(state, panel) {
    if (state.loading) return;
    state.loading = true;
    status(panel, 'Harita ve zaman çizelgesi yükleniyor…', false);
    Promise.all([
      rpc('evren_gorsel_haritayi_yukle', { p_evren_id: state.id }),
      rpc('evren_zaman_cizelgesi_yukle', { p_evren_id: state.id })
    ]).then(function (values) {
      var map = values[0] || {}, timeline = values[1] || {};
      if (map.durum === 'yok' && !state.own) throw new Error('Bu evren için herkese açık bir harita bulunamadı.');
      state.nodes = Array.isArray(map.dugumler) ? map.dugumler : [];
      state.links = Array.isArray(map.baglar) ? map.baglar : [];
      state.events = Array.isArray(timeline.olaylar) ? timeline.olaylar : [];
      state.eventLinks = Array.isArray(timeline.baglar) ? timeline.baglar : [];
      state.public = map.herkese_acik === true;
      state.canEdit = state.own && map.duzenleyebilir === true && timeline.duzenleyebilir !== false;
      state.loaded = true;
      state.error = '';
      state.dirty = false;
      render(panel, state);
      status(panel, state.canEdit ? 'Harita hazır. Değişiklikleri kaydetmeden yayınlanmaz.' : 'Yalnızca yayınlanmış içerik görüntüleniyor.', true);
    }).catch(function (error) {
      state.error = error && error.message || 'Harita yüklenemedi.';
      state.loaded = true;
      render(panel, state);
      status(panel, state.error, false);
    }).finally(function () { state.loading = false; });
  }
  function renderMap(panel, state) {
    var stage = panel.querySelector('[data-tf638-stage]');
    var canvas = panel.querySelector('[data-tf638-canvas]');
    var nodeBox = panel.querySelector('[data-tf638-nodes]');
    var svg = panel.querySelector('[data-tf638-lines]');
    if (!stage || !canvas || !nodeBox || !svg) return;
    canvas.style.transform = 'scale(' + state.zoom + ')';
    canvas.style.width = (100 / state.zoom) + '%';
    canvas.style.height = (100 / state.zoom) + '%';
    panel.querySelector('[data-tf638-zoom-value]').textContent = Math.round(state.zoom * 100) + '%';
    nodeBox.innerHTML = state.nodes.map(function (node) {
      var selected = state.selected === node.id;
      var typeName = (mapTypes.find(function (t) { return t[0] === node.tip; }) || [node.tip,node.tip])[1];
      return '<div class="tf638-node tf638-node-' + esc(node.tip) + (selected ? ' is-selected' : '') + (node.yayinda ? ' is-published' : '') + '" data-tf638-node-card="' + esc(node.id) + '" style="left:' + (Number(node.x) / 10) + '%;top:' + (Number(node.y) / 10) + '%" role="group" aria-label="' + esc(node.baslik) + ', ' + esc(typeName) + '"><button type="button" class="tf638-node-handle" data-tf638-node="' + esc(node.id) + '" aria-label="' + esc(node.baslik) + ', ' + esc(typeName) + '. Ok tuşlarıyla taşı" aria-pressed="' + selected + '"><span class="tf638-node-type">' + esc(typeName) + '</span><b>' + esc(node.baslik) + '</b>' + (node.aciklama ? '<small>' + esc(node.aciklama) + '</small>' : '') + '</button>' + (state.canEdit ? '<div class="tf638-node-controls"><button type="button" data-tf638-publish-node="' + esc(node.id) + '" aria-label="' + (node.yayinda ? 'Yayından kaldır' : 'Yayınla') + '">' + (node.yayinda ? 'Yayında' : 'Taslak') + '</button><button type="button" data-tf638-delete-node="' + esc(node.id) + '" aria-label="Düğümü sil">Sil</button></div>' : '') + '</div>';
    }).join('');
    svg.innerHTML = state.links.map(function (link) {
      var from = state.nodes.find(function (n) { return n.id === link.kaynak; });
      var to = state.nodes.find(function (n) { return n.id === link.hedef; });
      if (!from || !to) return '';
      return '<g class="tf638-edge"><line x1="' + Number(from.x) + '" y1="' + Number(from.y) + '" x2="' + Number(to.x) + '" y2="' + Number(to.y) + '"></line><text x="' + ((Number(from.x) + Number(to.x)) / 2) + '" y="' + ((Number(from.y) + Number(to.y)) / 2) + '">' + esc(link.etiket || (linkTypes.find(function (t) { return t[0] === link.tur; }) || ['',''])[1]) + '</text>' + (state.canEdit ? '<g class="tf638-edge-delete" data-tf638-delete-link="' + esc(link.id) + '" role="button" tabindex="0" aria-label="Bağlantıyı sil"><title>Bağlantıyı sil</title><circle cx="' + ((Number(from.x) + Number(to.x)) / 2) + '" cy="' + ((Number(from.y) + Number(to.y)) / 2) + '" r="15"></circle><text x="' + ((Number(from.x) + Number(to.x)) / 2) + '" y="' + ((Number(from.y) + Number(to.y)) / 2) + '">×</text></g>' : '') + '</g>';
    }).join('');
    var editor = panel.querySelector('[data-tf638-editor]');
    editor.hidden = !state.canEdit;
    panel.querySelector('[data-tf638-visibility]').textContent = state.public ? 'Herkese açık' : 'Özel';
    var pub = panel.querySelector('[data-tf638-public]');
    if (pub) pub.checked = state.public;
    fillSelects(panel, state);
    renderEvents(panel, state);
  }
  function fillSelects(panel, state) {
    var options = state.nodes.map(function (n) { return '<option value="' + esc(n.id) + '">' + esc(n.baslik) + '</option>'; }).join('');
    ['[data-tf638-link-form] select[name="kaynak"]','[data-tf638-link-form] select[name="hedef"]'].forEach(function (selector) {
      var select = panel.querySelector(selector);
      if (select) select.innerHTML = options || '<option value="">Önce düğüm ekle</option>';
    });
    var eventOptions = state.events.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.zaman + ' · ' + e.baslik) + '</option>'; }).join('');
    ['[data-tf638-event-link-form] select[name="kaynak"]','[data-tf638-event-link-form] select[name="hedef"]'].forEach(function (selector) {
      var select = panel.querySelector(selector);
      if (select) select.innerHTML = eventOptions || '<option value="">Önce olay ekle</option>';
    });
  }
  function renderEvents(panel, state) {
    var list = panel.querySelector('[data-tf638-events]');
    if (!list) return;
    var counts = Object.create(null);
    state.events.forEach(function (event) { var key = String(event.zaman || '').trim().toLocaleLowerCase('tr'); counts[key] = (counts[key] || 0) + 1; });
    list.innerHTML = state.events.length ? state.events.map(function (event) {
      var clash = counts[String(event.zaman || '').trim().toLocaleLowerCase('tr')] > 1;
      var relationships = state.eventLinks.filter(function (link) { return link.kaynak === event.id || link.hedef === event.id; }).length;
      return '<article class="tf638-event"><div class="tf638-event-marker" aria-hidden="true"></div><div class="tf638-event-body"><div class="tf638-event-tags"><span class="oyun-etiket">' + esc(event.zaman) + '</span><span class="oyun-etiket">' + esc((eventTypes.find(function (t) { return t[0] === event.tur; }) || [event.tur,event.tur])[1]) + '</span><span class="oyun-etiket tf638-state-' + esc(event.durum) + '">' + (event.durum === 'yayinda' ? 'Yayında' : 'Taslak') + '</span>' + (clash ? '<span class="oyun-etiket tf638-conflict">Dönem çakışması</span>' : '') + '</div><h5>' + esc(event.baslik) + '</h5>' + (event.aciklama ? '<p>' + esc(event.aciklama) + '</p>' : '') + (relationships ? '<small>' + relationships + ' olay bağlantısı</small>' : '') + (state.canEdit ? '<div class="tf638-event-actions"><button type="button" class="dugme dugme-sade" data-tf638-edit-event="' + esc(event.id) + '">Düzenle</button><button type="button" class="dugme dugme-sade" data-tf638-delete-event="' + esc(event.id) + '">Sil</button></div>' : '') + '</div></article>';
    }).join('') : '<p class="oyun-not">' + (state.canEdit ? 'Henüz olay yok; formdan ilk noktayı ekle.' : 'Yayınlanmış olay bulunmuyor.') + '</p>';
    var forms = panel.querySelectorAll('[data-tf638-event-form], [data-tf638-event-link-form]');
    forms.forEach(function (form) { form.hidden = !state.canEdit; });
  }
  function render(panel, state) {
    if (!panel || !panel.isConnected) return;
    renderMap(panel, state);
    if (state.error) status(panel, state.error, false);
    if (state.loaded && !state.error && !state.dirty) status(panel, state.canEdit ? 'Harita hazır. Değişiklikleri kaydetmeden yayınlanmaz.' : 'Yalnızca yayınlanmış içerik görüntüleniyor.', true);
  }
  function updateNodePosition(panel, state, node) {
    var element = panel.querySelector('[data-tf638-node-card="' + node.id + '"]');
    if (element) { element.style.left = (Number(node.x) / 10) + '%'; element.style.top = (Number(node.y) / 10) + '%'; }
    var svg = panel.querySelector('[data-tf638-lines]');
    if (svg) svg.innerHTML = state.links.map(function (link) {
      var from = state.nodes.find(function (n) { return n.id === link.kaynak; });
      var to = state.nodes.find(function (n) { return n.id === link.hedef; });
      if (!from || !to) return '';
      return '<g class="tf638-edge"><line x1="' + from.x + '" y1="' + from.y + '" x2="' + to.x + '" y2="' + to.y + '"></line><text x="' + ((Number(from.x)+Number(to.x))/2) + '" y="' + ((Number(from.y)+Number(to.y))/2) + '">' + esc(link.etiket || '') + '</text></g>';
    }).join('');
  }
  function markDirty(panel, state, text) {
    state.dirty = true;
    state.revision = (state.revision || 0) + 1;
    status(panel, text || 'Kaydedilmemiş değişiklik var.', false);
  }
  function persistNodePosition(panel, state, node, hadPendingChanges) {
    var revision = state.revision || 0;
    status(panel, 'Düğüm konumu kaydediliyor…', false);
    rpc('evren_gorsel_dugumu_guncelle', { p_evren_id: state.id, p_dugum: node }).then(function (result) {
      if (!result || result.durum !== 'tamam') throw new Error('Düğüm konumu kaydedilemedi.');
      if (!hadPendingChanges && (state.revision || 0) === revision) state.dirty = false;
      status(panel, state.dirty ? 'Düğüm konumu kaydedildi; diğer harita değişiklikleri için Kaydet’e bas.' : 'Düğüm konumu sunucuya kaydedildi.', true);
    }).catch(function (error) { state.dirty = true; status(panel, error.message || 'Düğüm konumu kaydedilemedi; Haritayı kaydet ile yeniden dene.', false); });
  }
  function bind(panel, state) {
    var drag = null;
    panel.addEventListener('change', function (event) {
      if (event.target.matches('[data-tf638-public]')) markDirty(panel,state,'Haritanın görünürlük tercihi değişti. Kaydet.');
    });
    panel.addEventListener('submit', function (event) {
      var form = event.target;
      if (!state.canEdit) return;
      if (form.matches('[data-tf638-node-form]')) {
        event.preventDefault();
        if (state.nodes.length >= 150) { status(panel, 'Harita en fazla 150 düğüm içerebilir.', false); return; }
        var fd = new FormData(form);
        var n = state.nodes.length;
        state.nodes.push({ id: uuid(), tip: String(fd.get('tip')), baslik: String(fd.get('baslik') || '').trim(), aciklama: String(fd.get('aciklama') || '').trim(), x: 120 + (n % 5) * 150, y: 100 + Math.floor(n / 5) * 140, yayinda: false });
        form.reset(); markDirty(panel, state, 'Düğüm eklendi. Kaydetmeyi unutma.'); render(panel, state);
      } else if (form.matches('[data-tf638-link-form]')) {
        event.preventDefault();
        if (state.links.length >= 300) { status(panel, 'Harita en fazla 300 bağlantı içerebilir.', false); return; }
        var linkData = new FormData(form); var source = String(linkData.get('kaynak') || ''); var target = String(linkData.get('hedef') || '');
        if (!source || !target || source === target) { status(panel, 'İki farklı düğüm seç.', false); return; }
        var kind = String(linkData.get('tur')); var label = String(linkData.get('etiket') || '').trim();
        if (kind === 'ozel' && !label) { status(panel, 'Özel bağlantıya bir ad ver.', false); return; }
        if (state.dirty) { status(panel, 'Yeni bağlantı eklemeden önce harita düğümlerini kaydet.', false); return; }
        var mapEdge = { id: uuid(), kaynak: source, hedef: target, tur: kind, etiket: label };
        rpc('evren_gorsel_bagi_degistir', { p_evren_id: state.id, p_bag: mapEdge, p_sil: false }).then(function (result) {
          if (!result || result.durum !== 'tamam') throw new Error('Harita bağlantısı kaydedilemedi.');
          state.links.push(mapEdge); render(panel, state); form.reset(); status(panel, 'Harita bağlantısı kaydedildi.', true);
        }).catch(function (error) { status(panel, error.message || 'Harita bağlantısı kaydedilemedi.', false); });
      } else if (form.matches('[data-tf638-event-form]')) {
        event.preventDefault(); var eventData = new FormData(form);
        var record = { id: String(eventData.get('id') || uuid()), zaman: String(eventData.get('zaman') || '').trim(), baslik: String(eventData.get('baslik') || '').trim(), aciklama: String(eventData.get('aciklama') || '').trim(), tur: String(eventData.get('tur') || 'olay'), sira: Number(eventData.get('sira') || 0), durum: String(eventData.get('durum') || 'taslak') };
        rpc('evren_zaman_olay_kaydet', { p_evren_id: state.id, p_olay: record }).then(function (result) {
          if (!result || result.durum !== 'tamam') throw new Error(result && result.durum === 'sinir' ? 'Zaman çizelgesi en fazla 500 olay içerebilir.' : 'Olay kaydedilemedi.');
          var index = state.events.findIndex(function (item) { return item.id === record.id; });
          record.id = result.id || record.id;
          if (index >= 0) state.events[index] = record; else state.events.push(record);
          state.events.sort(function (a, b) { return Number(a.sira) - Number(b.sira) || String(a.zaman).localeCompare(String(b.zaman), 'tr'); });
          state.eventDraft = null; form.reset(); form.elements.id.value = ''; form.elements.sira.value = '0'; panel.querySelector('[data-tf638-event-submit]').textContent = 'Olay ekle'; panel.querySelector('[data-tf638-cancel-edit]').hidden = true; render(panel, state); status(panel, state.dirty ? 'Zaman çizelgesi olayı kaydedildi. Haritadaki değişiklikler hâlâ kaydedilmeyi bekliyor.' : 'Zaman çizelgesi olayı kaydedildi.', true);
        }).catch(function (error) { status(panel, error.message || 'Olay kaydedilemedi.', false); });
      } else if (form.matches('[data-tf638-event-link-form]')) {
        event.preventDefault();
        if (state.eventLinks.length >= 500) { status(panel, 'En fazla 500 olay bağlantısı eklenebilir.', false); return; }
        var edge = new FormData(form); var from = String(edge.get('kaynak') || ''); var to = String(edge.get('hedef') || '');
        if (!from || !to || from === to) { status(panel, 'İki farklı olay seç.', false); return; }
        var item = { id: uuid(), kaynak: from, hedef: to, etiket: String(edge.get('etiket') || '').trim() };
        rpc('evren_zaman_bagi_degistir', { p_evren_id: state.id, p_bag: item, p_sil: false }).then(function (result) {
          if (!result || result.durum !== 'tamam') throw new Error('Olay bağlantısı kaydedilemedi.');
          state.eventLinks.push(item); render(panel, state); form.reset(); status(panel, 'Olaylar bağlandı.', true);
        }).catch(function (error) { status(panel, error.message || 'Olaylar bağlanamadı.', false); });
      }
    });
    panel.addEventListener('click', function (event) {
      var nodeButton = event.target.closest('[data-tf638-node]');
      if (nodeButton && !event.target.closest('[data-tf638-publish-node],[data-tf638-delete-node]')) { state.selected = nodeButton.dataset.tf638Node; renderMap(panel, state); return; }
      var zoom = event.target.closest('[data-tf638-zoom]');
      if (zoom) { state.zoom = clamp(state.zoom + (zoom.dataset.tf638Zoom === '+' ? 0.1 : -0.1), 0.6, 1.6); renderMap(panel, state); return; }
      var save = event.target.closest('[data-tf638-save]');
      if (save) { saveMap(panel, state); return; }
      var reset = event.target.closest('[data-tf638-reset]');
      if (reset) {
        if (window.confirm('Bu evrenin haritasındaki tüm düğüm ve bağlantılar silinsin mi?')) { state.nodes = []; state.links = []; state.public = false; markDirty(panel, state, 'Harita sıfırlandı; kalıcı olması için kaydet.'); render(panel, state); saveMap(panel, state); }
        return;
      }
      var publish = event.target.closest('[data-tf638-publish-node]');
      if (publish) { var pubNode = state.nodes.find(function (n) { return n.id === publish.dataset.tf638PublishNode; }); if (pubNode) { pubNode.yayinda = !pubNode.yayinda; markDirty(panel,state,'Düğüm yayın durumu değişti.'); render(panel,state); } return; }
      var delNode = event.target.closest('[data-tf638-delete-node]');
      if (delNode) { if (window.confirm('Bu düğüm ve ona bağlı harita bağlantıları silinsin mi?')) { var id = delNode.dataset.tf638DeleteNode; state.nodes = state.nodes.filter(function (n) { return n.id !== id; }); state.links = state.links.filter(function (l) { return l.kaynak !== id && l.hedef !== id; }); markDirty(panel,state,'Düğüm silindi.'); render(panel,state); } return; }
      var delLink = event.target.closest('[data-tf638-delete-link]');
      if (delLink) { var deletedLink = state.links.find(function (l) { return l.id === delLink.dataset.tf638DeleteLink; }); if (!deletedLink) return; rpc('evren_gorsel_bagi_degistir',{p_evren_id:state.id,p_bag:deletedLink,p_sil:true}).then(function (result) { if (!result || result.durum !== 'tamam') throw new Error('Bağlantı silinemedi.'); state.links = state.links.filter(function (l) { return l.id !== deletedLink.id; }); render(panel,state); status(panel,'Bağlantı silindi.',true); }).catch(function (error) { status(panel,error.message || 'Bağlantı silinemedi.',false); }); return; }
      var editEvent = event.target.closest('[data-tf638-edit-event]');
      if (editEvent) { var found = state.events.find(function (e) { return e.id === editEvent.dataset.tf638EditEvent; }); if (found) { var f = panel.querySelector('[data-tf638-event-form]'); ['id','zaman','baslik','aciklama','tur','sira','durum'].forEach(function (key) { f.elements[key].value = found[key] == null ? '' : found[key]; }); panel.querySelector('[data-tf638-event-submit]').textContent = 'Olayı güncelle'; panel.querySelector('[data-tf638-cancel-edit]').hidden = false; f.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } return; }
      var cancel = event.target.closest('[data-tf638-cancel-edit]');
      if (cancel) { var ef = panel.querySelector('[data-tf638-event-form]'); ef.reset(); ef.elements.id.value = ''; ef.elements.sira.value = '0'; panel.querySelector('[data-tf638-event-submit]').textContent = 'Olay ekle'; cancel.hidden = true; return; }
      var delEvent = event.target.closest('[data-tf638-delete-event]');
      if (delEvent) { if (!window.confirm('Bu zaman çizelgesi olayı ve bağlı olay ilişkileri silinsin mi?')) return; var eventId = delEvent.dataset.tf638DeleteEvent; rpc('evren_zaman_olay_sil',{p_evren_id:state.id,p_id:eventId}).then(function (result) { if (result && result.durum !== 'tamam') throw new Error('Olay silinemedi.'); state.events = state.events.filter(function (e) { return e.id !== eventId; }); state.eventLinks = state.eventLinks.filter(function (l) { return l.kaynak !== eventId && l.hedef !== eventId; }); render(panel,state); status(panel,'Olay silindi.',true); }).catch(function (error) { status(panel,error.message || 'Olay silinemedi.',false); }); }
    });
    panel.querySelector('[data-tf638-stage]').addEventListener('pointerdown', function (event) {
      if (!state.canEdit) return;
      var node = event.target.closest('[data-tf638-node]');
      if (!node || event.target.closest('[data-tf638-node-controls]')) return;
      drag = { id: node.dataset.tf638Node, pointerId: event.pointerId, wasDirty: state.dirty };
      if (node.setPointerCapture) node.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    panel.querySelector('[data-tf638-stage]').addEventListener('pointermove', function (event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      var stage = panel.querySelector('[data-tf638-stage]'); var rect = stage.getBoundingClientRect();
      var node = state.nodes.find(function (n) { return n.id === drag.id; });
      if (!node || !rect.width || !rect.height) return;
      node.x = Math.round(clamp((event.clientX - rect.left) / rect.width * 1000, 0, 1000));
      node.y = Math.round(clamp((event.clientY - rect.top) / rect.height * 1000, 0, 1000));
      updateNodePosition(panel, state, node); state.dirty = true;
    });
    panel.querySelector('[data-tf638-stage]').addEventListener('pointerup', function (event) { if (drag && drag.pointerId === event.pointerId) { var moved = drag; drag = null; var record = state.nodes.find(function (n) { return n.id === moved.id; }); if (record) persistNodePosition(panel,state,record,moved.wasDirty); } });
    panel.addEventListener('keydown', function (event) {
      var edgeAction = event.target.closest('[data-tf638-delete-link]');
      if (edgeAction && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); edgeAction.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
      var node = event.target.closest('[data-tf638-node]');
      if (!node || !state.canEdit || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault(); var record = state.nodes.find(function (n) { return n.id === node.dataset.tf638Node; }); if (!record) return;
      var amount = event.shiftKey ? 40 : 12;
      if (event.key === 'ArrowLeft') record.x = clamp(Number(record.x)-amount,0,1000);
      if (event.key === 'ArrowRight') record.x = clamp(Number(record.x)+amount,0,1000);
      if (event.key === 'ArrowUp') record.y = clamp(Number(record.y)-amount,0,1000);
      if (event.key === 'ArrowDown') record.y = clamp(Number(record.y)+amount,0,1000);
      var hadPendingChanges = state.dirty; updateNodePosition(panel,state,record); markDirty(panel,state,'Düğüm klavyeyle taşındı.'); persistNodePosition(panel,state,record,hadPendingChanges);
    });
  }
  function saveMap(panel, state) {
    if (!state.canEdit) return;
    var button = panel.querySelector('[data-tf638-save]'); if (button) button.disabled = true;
    rpc('evren_gorsel_haritayi_kaydet',{p_evren_id:state.id,p_dugumler:state.nodes,p_baglar:state.links,p_herkese_acik:!!panel.querySelector('[data-tf638-public]').checked}).then(function (result) {
      if (!result || result.durum !== 'tamam') throw new Error(result && result.durum === 'sinir' ? 'Harita sınırına ulaşıldı.' : 'Harita kaydedilemedi; düğüm ve bağlantı sınırlarını kontrol et.');
      state.public = !!panel.querySelector('[data-tf638-public]').checked; state.dirty = false; render(panel,state); status(panel,'Harita güvenli biçimde kaydedildi.',true);
    }).catch(function (error) { status(panel,error.message || 'Harita kaydedilemedi.',false); }).finally(function () { if (button && button.isConnected) button.disabled = false; });
  }
  function mount() {
    var root = document.querySelector('#evrenSayfa');
    var state = sessionFor(root);
    if (!root || !state) return;
    var existing = root.querySelector('[data-tf638-root]');
    if (existing && existing.dataset.tf638Id === state.id) return;
    createPanel(root,state);
    var panel = root.querySelector('[data-tf638-root]');
    if (state.loaded) { render(panel,state); if (state.error) status(panel,state.error,false); }
    else load(state,panel);
  }
  document.addEventListener('DOMContentLoaded', mount, { once: true });
  document.addEventListener('tf-veri-hazir', mount);
  window.addEventListener('hashchange', function () { setTimeout(mount, 40); });
  if (document.body) new MutationObserver(function () { mount(); }).observe(document.body,{ childList: true, subtree: true });
}());
