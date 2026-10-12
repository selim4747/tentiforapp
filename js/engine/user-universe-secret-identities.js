/* User-universe secret identity records and gold-badge progression. */
(function () {
  'use strict';
  var READ_PREFIX = 'tf-user-identity-read-';
  var MAX_IDENTITIES = 12;
  var newlyCreatedWorldId = null;

  function esc(value) {
    return typeof window.kacir === 'function' ? window.kacir(value == null ? '' : String(value)) :
      String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }
  function worlds() {
    try { return typeof window.fanEserlerim === 'function' ? window.fanEserlerim() || [] : []; } catch (_) { return []; }
  }
  function currentWorld() {
    var list = worlds();
    var id = window.EVS && window.EVS.id;
    var pageWorld = list.find(function (world) { return world && world.id === id && world.tur === 'evren'; });
    if (pageWorld) return pageWorld;
    var form = document.querySelector('[data-fan-form="evren"][data-fan-hedef]');
    var targetId = form && form.getAttribute('data-fan-hedef');
    var formWorld = list.find(function (world) { return world && world.id === targetId && world.tur === 'evren'; });
    var editor = document.querySelector('[data-tf-user-world-id]');
    var editorId = editor && editor.getAttribute('data-tf-user-world-id');
    var editorWorld = list.find(function (world) { return world && world.id === editorId && world.tur === 'evren'; });
    if (editorWorld) return editorWorld;
    return formWorld || list.slice().reverse().find(function (world) { return world && world.tur === 'evren'; }) || null;
  }
  function worldForPerson(personId) {
    return worlds().find(function (world) {
      return world && world.tur === 'evren' && people(world).some(function (person) {
        return person && (person.id === personId || person.gizliKimlikAnaId === personId);
      });
    }) || currentWorld();
  }
  function newId() {
    return typeof window.fanId === 'function' ? window.fanId() : 'kimlik-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function saveWorld(world) {
    var all = worlds();
    var index = all.findIndex(function (item) { return item && item.id === world.id; });
    if (index < 0) return false;
    all[index] = world;
    return typeof window.fanEserlerimYaz === 'function' ? window.fanEserlerimYaz(all) : false;
  }
  function people(world) { return world && Array.isArray(world.kisiler) ? world.kisiler : []; }
  function isIdentity(person) { return !!(person && person.gizliKimlikAnaId); }
  function identityRows(world, parentId) {
    return people(world).filter(function (person) { return isIdentity(person) && person.gizliKimlikAnaId === parentId; })
      .sort(function (a, b) { return Number(a.gizliKimlikSira || 0) - Number(b.gizliKimlikSira || 0); }).slice(0, MAX_IDENTITIES);
  }
  function badgeId(person) { return String(person && (person.rozetId || person.id) || ''); }
  function makeIdentityId(world, parent, index) {
    return ('i-' + String(world.id || 'evren').replace(/[^\w-]/g, '').slice(0, 16) + '-' + String(parent.id || 'kisi').replace(/[^\w-]/g, '').slice(0, 12) + '-' + (index + 1)).slice(0, 40);
  }
  function normalizeWorld(world, persist) {
    if (!world || !Array.isArray(world.kisiler)) return false;
    var changed = false;
    var peopleList = world.kisiler;
    peopleList.forEach(function (person, index) {
      if (!person || isIdentity(person)) return;
      if (!person.id) { person.id = ('k-' + String(world.id || 'evren').replace(/[^\w-]/g, '').slice(0, 28) + '-' + (index + 1)).slice(0, 40); changed = true; }
      else if (String(person.id).length > 40 || /[^\w-]/.test(String(person.id))) { person.id = String(person.id).replace(/[^\w-]/g, '').slice(0, 40); changed = true; }
      var legacy = Array.isArray(person.gizliKimlikler) ? person.gizliKimlikler.slice(0, MAX_IDENTITIES) : [];
      var existing = identityRows(world, person.id);
      if (!existing.length && legacy.length) {
        legacy.forEach(function (item, identityIndex) {
          item = typeof item === 'string' ? { ad: item } : item || {};
          if (!String(item.ad || '').trim()) return;
          peopleList.push({
            id: makeIdentityId(world, person, identityIndex), ad: String(item.ad).trim().slice(0, 80),
            rol: 'Gizli kimlik', aciklama: String(item.aciklama || '').slice(0, 800),
            gizliKimlikAnaId: person.id, gizliKimlikSira: identityIndex + 1
          });
        });
        person.gizliKimlikler = [];
        changed = true;
      } else if (legacy.length) { person.gizliKimlikler = []; changed = true; }
    });
    peopleList.forEach(function (person, index) {
      if (!person || !isIdentity(person)) return;
      if (!person.id) { person.id = makeIdentityId(world, { id: person.gizliKimlikAnaId }, Number(person.gizliKimlikSira || 1) - 1); changed = true; }
      else if (String(person.id).length > 40 || /[^\w-]/.test(String(person.id))) { person.id = String(person.id).replace(/[^\w-]/g, '').slice(0, 40); changed = true; }
      if (person.gizliKimlikAnaId) person.gizliKimlikAnaId = String(person.gizliKimlikAnaId).replace(/[^\w-]/g, '').slice(0, 40);
      person.gizliKimlikSira = Math.max(1, Math.min(MAX_IDENTITIES, Number(person.gizliKimlikSira) || 1));
    });
    if (changed && persist) saveWorld(world);
    return changed;
  }
  function goldBadge(id) {
    var key = 'rozet_altin_' + id;
    if (typeof window.kilitAcik === 'function') return !!window.kilitAcik(key);
    return !!(window.cuzdan && Array.isArray(window.cuzdan.acilan) && window.cuzdan.acilan.indexOf(key) !== -1);
  }
  function unlocked(rows, index, parentId) {
    if (index < 0 || index >= rows.length || !goldBadge(parentId)) return false;
    return index === 0 || goldBadge(badgeId(rows[index - 1]));
  }
  function readKey(id) { return READ_PREFIX + id; }
  function wasRead(id) { try { return localStorage.getItem(readKey(id)) === '1'; } catch (_) { return false; } }
  function markRead(id) { try { localStorage.setItem(readKey(id), '1'); return true; } catch (_) { return false; } }
  function hasStory(person) {
    var name = String(person && person.ad || '').trim().toLocaleLowerCase('tr');
    if (!name) return false;
    return worlds().some(function (item) {
      return item && item.tur === 'hikaye' && String(item.metin || '').length >= 300 &&
        String(item.karakterler || '').split(',').some(function (entry) { return entry.trim().toLocaleLowerCase('tr') === name; });
    });
  }
  function awardGold(person, explicitBadgeId) {
    var id = explicitBadgeId || badgeId(person);
    if (!person || !id || !wasRead(id) || !hasStory(person) || goldBadge(id)) return false;
    var wallet = window.cuzdan;
    if (!wallet || !Array.isArray(wallet.acilan)) return false;
    wallet.acilan.push('rozet_altin_' + id);
    if (typeof window.eckaKazan === 'function') window.eckaKazan(50, 'Altın rozet: ' + (person.ad || 'gizli karakter'));
    else if (typeof window.cuzdanKaydet === 'function') window.cuzdanKaydet();
    if (typeof window.eckaBildir === 'function') window.eckaBildir('Altın rozet: ' + (person.ad || 'karakter') + ' · sonraki gizli kimlik açıldı.');
    return true;
  }
  function statusText(parent, identities) {
    if (!goldBadge(badgeId(parent))) return 'Karakteri tamamlayıp onunla ilgili en az 300 karakterlik bir hikâye yazınca altın rozet kazanılır; ilk kimlik açılır.';
    if (!identities.length) return 'Bu karakter için henüz gizli kimlik eklenmemiş.';
    return 'Sıra ile açılır: her kimliği okuyup onunla ilgili hikâye yazınca altın rozeti kazan; sonraki panel açılır.';
  }
  function characterDetailsHtml(person) {
    var groups = typeof FAN_EVREN_GRUPLARI !== 'undefined' ? FAN_EVREN_GRUPLARI : window.FAN_EVREN_GRUPLARI;
    var group = Array.isArray(groups) && groups.find(function (item) { return item.k === 'kisiler'; });
    if (!group) return person.aciklama ? '<p>' + esc(person.aciklama).replace(/\n/g, '<br>') + '</p>' : '';
    return (group.alanlar || []).filter(function (field) { return field[0] !== 'ad' && String(person[field[0]] || '').trim(); })
      .map(function (field) { return '<p><b>' + esc(field[1]) + '</b><br>' + esc(person[field[0]]).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }
  function progressHtml(world, parent, depth) {
    depth = depth || 0;
    if (depth > 8) return '';
    var rows = identityRows(world, parent.id);
    if (!rows.length) return '';
    var buttons = rows.map(function (identity, index) {
      var isOpen = unlocked(rows, index, badgeId(parent));
      var childRows = identityRows(world, identity.id);
      var card = isOpen
        ? '<details class="tf-user-id-card"><summary>' + (index + 1) + '. ' + esc(identity.ad || 'Adsız kimlik') + ' · gizli kimlik</summary>' +
          characterDetailsHtml(identity) +
          '<button type="button" class="dugme dugme-sade" data-tf-user-id-read="' + esc(identity.id) + '" data-tf-user-id-badge="' + esc(badgeId(identity)) + '" data-tf-user-id-name="' + esc(identity.ad) + '">Bu kimliği okudum</button>' +
          progressHtml(world, identity, depth + 1) + '</details>'
        : '<p class="tf-user-id-locked">🔒 ' + (index + 1) + '. ' + esc(identity.ad || 'Adsız kimlik') + ' — ' + esc(index ? (rows[index - 1].ad || 'önceki kimliğin') + ' altın rozeti gerekir' : 'ana karakterin altın rozeti gerekir') + '</p>';
      return card;
    }).join('');
    return '<section class="tf-user-identities" aria-label="' + esc(parent.ad || 'Karakter') + ' gizli kimlik panelleri"><h4>Gizli kimlikler · spoiler</h4><p class="oyun-not">' + esc(statusText(parent, rows)) + '</p>' + buttons + '</section>';
  }
  function readerButton(person) {
    return '<button type="button" class="dugme dugme-sade tf-user-id-read-main" data-tf-user-id-read="' + esc(person.id) + '" data-tf-user-id-badge="' + esc(badgeId(person)) + '" data-tf-user-id-name="' + esc(person.ad) + '">Bu karakteri tamamen okudum</button>';
  }
  function addStyles() {
    if (document.getElementById('tfUserIdentityStyles')) return;
    var style = document.createElement('style'); style.id = 'tfUserIdentityStyles';
    style.textContent = '.tf-user-identities{margin:12px 0;padding:12px;border:1px solid var(--sig,#B8D6EC);border-radius:8px}.tf-user-id-card{margin:8px 0;padding:10px;background:color-mix(in srgb,var(--beyaz,#fff) 80%,transparent);border-radius:6px}.tf-user-id-card summary{cursor:pointer;font-weight:700}.tf-user-id-locked{padding:8px;border-left:3px solid var(--sig,#B8D6EC);opacity:.8}.tf-user-id-read-main{margin-top:8px}.tf-user-id-editor{margin:10px 0;padding:10px;border:1px dashed var(--sig,#B8D6EC);border-radius:6px}.tf-user-id-editor label{display:block;margin:8px 0 2px;font-weight:600}.tf-user-id-editor input,.tf-user-id-editor textarea{box-sizing:border-box;width:100%;max-width:100%}';
    document.head.appendChild(style);
  }
  function decorateUniverseCharacters() {
    if (typeof window.fanEvrenGrupHtml === 'function' && !window.fanEvrenGrupHtml._tfUserIdWrapped) {
      var oldGroup = window.fanEvrenGrupHtml;
      var wrappedGroup = function (world, group, options) {
        if (!group || group.k !== 'kisiler' || !world) return oldGroup.apply(this, arguments);
        normalizeWorld(world, true);
        var top = people(world).filter(function (person) { return person && !isIdentity(person); });
        var html = '<fieldset class="fan-grup"><legend>' + esc(group.ad) + (top.length ? ' · ' + top.length : '') + '</legend>' +
          (group.not ? '<p class="oyun-not">' + esc(group.not) + '</p>' : '') + top.map(function (person) {
            var actualIndex = people(world).indexOf(person);
            var fields = (group.alanlar || []).map(function (field) {
              return typeof window.fanGirdi === 'function' ? window.fanGirdi('kisiler.' + actualIndex + '.' + field[0], person[field[0]], field[1], field[2] === 'uzun' ? 'uzun' : '', field[2] === 'liste' ? { liste: field[3] || 'fanKuralTur' } : { satir: 2 }) : '';
            }).join('');
            return '<div class="fan-oge">' + fields + '<button class="dugme dugme-sade y-sil" data-fan-cikar="kisiler:' + actualIndex + '">Bu kişiyi kaldır</button></div>';
          }).join('') + '<button class="dugme dugme-sade" data-fan-ekle="kisiler">+ kişi ekle</button></fieldset>';
        var extras = top.map(function (person) {
          var idx = people(world).indexOf(person), rows = identityRows(world, person.id);
          var forms = rows.map(function (identity) {
          var childIndex = people(world).indexOf(identity);
            var identityFields = (group.alanlar || []).map(function (field) {
              return typeof window.fanGirdi === 'function' ? window.fanGirdi('kisiler.' + childIndex + '.' + field[0], identity[field[0]], 'Kimlik karakteri · ' + field[1], field[2] === 'uzun' ? 'uzun' : '', field[2] === 'liste' ? { liste: field[3] || 'fanKuralTur' } : { satir: 2 }) : '';
            }).join('');
            return '<div class="tf-user-id-editor"><b>Kimlik karakteri · sıra ' + Number(identity.gizliKimlikSira || 1) + '</b>' +
              identityFields +
              '<button type="button" class="dugme dugme-sade y-sil" data-tf-user-id-remove="' + esc(identity.id) + '">Bu kimliği kaldır</button></div>';
          }).join('');
          return '<div class="tf-user-id-editor" data-tf-user-id-parent="' + esc(person.id) + '"><h4>Gizli kimlik panelleri · ' + esc(person.ad || 'Karakter') + '</h4>' +
            '<p class="oyun-not">Her kimlik ayrı karakter kaydıdır. Ana karakterin altın rozeti ilkini, her kimliğin altın rozeti sıradakini açar.</p>' + forms +
            (rows.length < MAX_IDENTITIES ? '<button type="button" class="dugme dugme-sade" data-tf-user-id-add="' + esc(person.id) + '">+ Sıradaki gizli kimlik</button>' : '<p class="oyun-not">En fazla ' + MAX_IDENTITIES + ' gizli kimlik eklenebilir.</p>') + '</div>';
        }).join('');
        return '<div data-tf-user-world-id="' + esc(world.id) + '">' + html + '<section class="tf-user-id-editors"><h3>Karakter kimlik zinciri</h3><p class="oyun-not">Rozet zinciri için her karakteri okuyan kişinin o karakterle ilgili en az 300 karakterlik bir hikâyesi olmalıdır.</p>' + extras + '</section></div>';
      };
      wrappedGroup._tfUserIdWrapped = true; window.fanEvrenGrupHtml = wrappedGroup;
    }
    var groups = typeof FAN_EVREN_GRUPLARI !== 'undefined' ? FAN_EVREN_GRUPLARI : window.FAN_EVREN_GRUPLARI;
    var group = Array.isArray(groups) && groups.find(function (item) { return item.k === 'kisiler'; });
    if (group && typeof group.ciz === 'function' && !group.ciz._tfUserIdWrapped) {
      var oldDraw = group.ciz;
      var wrappedDraw = function (list, world, reader) {
        var all = Array.isArray(world && world.kisiler) ? world.kisiler : [];
        normalizeWorld(world, false);
        var top = all.filter(function (person) { return person && !isIdentity(person); });
        var rendered = oldDraw.call(this, top, Object.assign({}, world, { kisiler: top }), reader);
        if (rendered == null) return rendered;
        var box = document.createElement('div'); box.innerHTML = rendered;
        var articles = box.querySelectorAll('.evr-kisiler > article');
        top.forEach(function (person, index) {
          var article = articles[index]; if (!article) return;
          article.insertAdjacentHTML('beforeend', reader ? readerButton(person) + progressHtml(world, person) : progressHtml(world, person));
        });
        return box.innerHTML;
      };
      wrappedDraw._tfUserIdWrapped = true; group.ciz = wrappedDraw;
    }
  }
  function customPeople() {
    var rows = [];
    worlds().filter(function (world) { return world && world.tur === 'evren'; }).forEach(function (world) {
      normalizeWorld(world, false);
      people(world).forEach(function (person) {
        if (!person || !person.id || !String(person.ad || '').trim()) return;
        rows.push(person);
      });
      var inner = world.icEvren && Array.isArray(world.icEvren.kisiler) ? world.icEvren.kisiler : [];
      inner.forEach(function (person) {
        if (person && person.id && person.ad) rows.push(Object.assign({}, person, { rozetId: person.rozetId || ('ic-' + world.id + '-' + person.id) }));
      });
    });
    return rows;
  }
  function preserveIdentityFields() {
    if (typeof window.fanTemizle !== 'function' || window.fanTemizle._tfUserIdentityWrapped) return;
    var oldClean = window.fanTemizle;
    var wrapped = function (input) {
      var result = oldClean.apply(this, arguments);
      if (!result || result.tur !== 'evren' || !Array.isArray(input && input.kisiler) || !Array.isArray(result.kisiler)) return result;
      result.kisiler.forEach(function (person, index) {
        var original = input.kisiler[index];
        if (!person || !original) return;
        if (original.id) person.id = String(original.id).replace(/[^\w-]/g, '').slice(0, 40);
        if (original.gizliKimlikAnaId) person.gizliKimlikAnaId = String(original.gizliKimlikAnaId).replace(/[^\w-]/g, '').slice(0, 40);
        if (original.gizliKimlikSira) person.gizliKimlikSira = Math.max(1, Math.min(MAX_IDENTITIES, Number(original.gizliKimlikSira) || 1));
      });
      return result;
    };
    wrapped._tfUserIdentityWrapped = true;
    window.fanTemizle = wrapped;
  }
  function addWizardIdentityField() {
    var peopleInput = document.querySelector('#tf61-kisiler');
    if (!peopleInput || document.querySelector('#tf61-kimlikler')) return;
    var host = peopleInput.closest('label') || peopleInput.parentElement;
    if (!host || !host.parentElement) return;
    var field = document.createElement('label');
    field.innerHTML = '<span>İlk karakterlerin gizli kimlikleri <small>(isteğe bağlı; her satır: Ana karakter → Kimlik 1, Kimlik 2)</small></span>' +
      '<textarea class="kod-giris" id="tf61-kimlikler" rows="3" placeholder="Ada → Yıldız Bekçisi, Gölgeli Gezgin"></textarea>' +
      '<small class="oyun-not">Kimlikler ayrı karakter kartı olur; sonradan Kurucu → Kişiler adımında düzenleyebilirsin.</small>';
    host.insertAdjacentElement('afterend', field);
  }
  function connectWizardCreate() {
    if (typeof window.fanYeni === 'function' && !window.fanYeni._tfUserIdentityWrapped) {
      var oldCreate = window.fanYeni;
      var createWrapped = function (type) {
        var result = oldCreate.apply(this, arguments);
        if (type === 'evren') newlyCreatedWorldId = typeof result === 'string' ? result : result && result.id || null;
        return result;
      };
      createWrapped._tfUserIdentityWrapped = true; window.fanYeni = createWrapped;
    }
    if (typeof window.fanEserlerimYaz !== 'function' || window.fanEserlerimYaz._tfUserIdentityWizardWrapped) return;
    var oldWrite = window.fanEserlerimYaz;
    var wrapped = function (items) {
      var source = document.querySelector('#tf61-kimlikler');
      var mapText = source && source.value || '';
      if (mapText && Array.isArray(items)) {
        var selectedName = String((document.querySelector('#tf61-ad') || {}).value || '').trim().toLocaleLowerCase('tr');
        var selectedId = newlyCreatedWorldId || window.EVS && window.EVS.id;
        var world = items.find(function (item) { return item && item.id === selectedId && item.tur === 'evren'; });
        if (!world && selectedName) world = items.slice().reverse().find(function (item) { return item && item.tur === 'evren' && String(item.ad || '').trim().toLocaleLowerCase('tr') === selectedName; });
        if (world && Array.isArray(world.kisiler)) {
          world.kisiler.forEach(function (person) { if (person && !person.id) person.id = newId(); });
          mapText.split(/\n+/).forEach(function (line) {
            var match = /^\s*(.*?)\s*(?:→|->|:)\s*(.*?)\s*$/.exec(line);
            if (!match) return;
            var parent = world.kisiler.find(function (person) { return person && !isIdentity(person) && String(person.ad || '').trim().toLocaleLowerCase('tr') === match[1].trim().toLocaleLowerCase('tr'); });
            if (!parent) return;
            match[2].split(',').map(function (name) { return name.trim().slice(0, 80); }).filter(Boolean).slice(0, MAX_IDENTITIES).forEach(function (name) {
              var index = identityRows(world, parent.id).length;
              if (!identityRows(world, parent.id).some(function (row) { return row.ad.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'); })) {
                world.kisiler.push({ id: newId(), ad: name, rol: 'Gizli kimlik', aciklama: '', gizliKimlikAnaId: parent.id, gizliKimlikSira: index + 1 });
              }
            });
          });
        }
      }
      return oldWrite.apply(this, arguments);
    };
    wrapped._tfUserIdentityWizardWrapped = true; window.fanEserlerimYaz = wrapped;
  }
  function retryAwards() { customPeople().forEach(awardGold); }
  function clickHandler(event) {
    var characterRemove = event.target.closest && event.target.closest('[data-fan-cikar^="kisiler:"]');
    if (characterRemove) {
      var removeWorld = currentWorld();
      var removeIndex = Number((characterRemove.getAttribute('data-fan-cikar').split(':')[1] || ''));
      var removePerson = removeWorld && people(removeWorld)[removeIndex];
      if (removePerson && !isIdentity(removePerson)) {
        event.preventDefault(); event.stopImmediatePropagation();
        var removeIds = [removePerson.id], expanded = true;
        while (expanded) {
          expanded = false;
          people(removeWorld).forEach(function (person) {
            if (person && isIdentity(person) && removeIds.indexOf(person.gizliKimlikAnaId) !== -1 && removeIds.indexOf(person.id) === -1) { removeIds.push(person.id); expanded = true; }
          });
        }
        removeWorld.kisiler = people(removeWorld).filter(function (person) { return person && removeIds.indexOf(person.id) === -1; });
        saveWorld(removeWorld);
        if (typeof window.evrenAtolyeCiz === 'function') window.evrenAtolyeCiz();
        else if (typeof window.fanEvrenCiz === 'function') window.fanEvrenCiz();
        return;
      }
    }
    var target = event.target.closest && event.target.closest('[data-tf-user-id-add], [data-tf-user-id-remove], [data-tf-user-id-read]');
    if (!target) return;
    if (target.hasAttribute('data-tf-user-id-add') || target.hasAttribute('data-tf-user-id-remove')) {
      var lookupId = target.getAttribute('data-tf-user-id-add') || target.getAttribute('data-tf-user-id-remove');
      var world = worldForPerson(lookupId); if (!world) return;
      normalizeWorld(world, false);
      if (target.hasAttribute('data-tf-user-id-add')) {
        var parentId = target.getAttribute('data-tf-user-id-add');
        var parent = people(world).find(function (person) { return person && person.id === parentId; });
        if (!parent) return;
        var rows = identityRows(world, parentId); if (rows.length >= MAX_IDENTITIES) return;
        world.kisiler.push({ id: newId(), ad: '', rol: 'Gizli kimlik', aciklama: '', gizliKimlikAnaId: parentId, gizliKimlikSira: rows.length + 1 });
        saveWorld(world); if (typeof window.evrenAtolyeCiz === 'function') window.evrenAtolyeCiz();
        else if (typeof window.fanEvrenCiz === 'function') window.fanEvrenCiz();
      } else {
        var deleteId = target.getAttribute('data-tf-user-id-remove');
        world.kisiler = people(world).filter(function (person) { return person && person.id !== deleteId && person.gizliKimlikAnaId !== deleteId; });
        Array.from(new Set(world.kisiler.filter(isIdentity).map(function (person) { return person.gizliKimlikAnaId; })))
          .forEach(function (parentId) { identityRows(world, parentId).forEach(function (person, index) { person.gizliKimlikSira = index + 1; }); });
        saveWorld(world); if (typeof window.evrenAtolyeCiz === 'function') window.evrenAtolyeCiz();
        else if (typeof window.fanEvrenCiz === 'function') window.fanEvrenCiz();
      }
      return;
    }
    var id = target.getAttribute('data-tf-user-id-read');
    if (!id) return;
    var badge = target.getAttribute('data-tf-user-id-badge') || id;
    var personName = target.getAttribute('data-tf-user-id-name') || '';
    markRead(badge);
    var person = customPeople().find(function (item) { return item.id === id; }) || { id: id, ad: personName };
    if (!hasStory(person)) {
      if (typeof window.eckaBildir === 'function') window.eckaBildir('Okundu kaydedildi. Altın rozet için bu karakterle ilgili en az 300 karakterlik bir hikâye yaz.');
      return;
    }
    if (!awardGold(person, badge) && typeof window.eckaBildir === 'function') window.eckaBildir('Okundu kaydedildi; altın rozet durumu güncellendi.');
    var world = currentWorld(); if (world && typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
  }
  window.tfUserIdentityNormalize = normalizeWorld;
  window.tfUserIdentityRows = identityRows;
  window.tfUserIdentityGoldBadge = goldBadge;
  window.tfUserIdentityUnlocked = unlocked;
  window.tfUserIdentityProgressHtml = progressHtml;
  window.tfUserIdentityReadButton = readerButton;
  window.tfUserIdentityRetryAwards = retryAwards;
  document.addEventListener('DOMContentLoaded', function () { preserveIdentityFields(); connectWizardCreate(); addWizardIdentityField(); addStyles(); decorateUniverseCharacters(); }, { once: true });
  document.addEventListener('tf-veri-hazir', function () { preserveIdentityFields(); connectWizardCreate(); addWizardIdentityField(); addStyles(); decorateUniverseCharacters(); retryAwards(); });
  document.addEventListener('click', clickHandler, true);
  var originalBadgeCheck = window.rozetleriDenetle;
  if (typeof originalBadgeCheck === 'function') {
    window.rozetleriDenetle = function () { var result = originalBadgeCheck.apply(this, arguments); retryAwards(); return result; };
  }
  if (document.readyState !== 'loading') { preserveIdentityFields(); connectWizardCreate(); addWizardIdentityField(); addStyles(); decorateUniverseCharacters(); }
  new MutationObserver(function () { addWizardIdentityField(); }).observe(document.documentElement, { childList: true, subtree: true });
}());
