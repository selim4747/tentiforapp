/* TentiforApp 6.5.5 — kurucu çalışma alanı. */
(function () {
  'use strict';
  var mounted = false;
  var flushing = false;
  var PENDING_KEY = 'tf65_evren_taslak_bekleyen';
  function pendingRead() { try { var value = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; } }
  function pendingWrite(value) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(value.slice(-50))); return true; } catch (_) { return false; } }
  function currentOwner() { try { return window.hesapKullanici && window.hesapKullanici.id ? String(window.hesapKullanici.id) : null; } catch (_) { return null; } }
  function pendingAdd(type, payload) { var owner = currentOwner(); if (!owner) return false; var list = pendingRead(); list.push({ id: 'draft_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7), owner: owner, type: type, payload: payload, created: Date.now() }); return pendingWrite(list); }
  async function flushPending() {
    if (flushing || navigator.onLine === false || !c() || !currentOwner()) return;
    flushing = true;
    var list = pendingRead(), keep = [], changed = false;
    for (var i = 0; i < list.length; i += 1) {
      var item = list[i];
      if (!item || String(item.owner) !== currentOwner()) { keep.push(item); continue; }
      try {
        var result = item.type === 'evren-taslak' ? await c().rpc('evren_taslak_kaydet', item.payload) : await c().rpc('evren_zaman_noktasi_ekle', item.payload);
        if (result && result.error) throw result.error;
        changed = true;
      } catch (_) { keep.push(item); }
    }
    if (changed) pendingWrite(keep);
    flushing = false;
  }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  function c() { return typeof hesapIstemci !== 'undefined' && hesapIstemci && hesapIstemci.rpc ? hesapIstemci : null; }
  function msg(root, text, good) { var n = root.querySelector('[data-tf633-msg]'); if (n) { n.textContent = text; n.className = 'pencere-durum ' + (good ? 'iyi' : 'kotu'); } }
  function currentData() { try { var page = typeof evrenSayfaVerisi === 'function' ? evrenSayfaVerisi() : null; var world = page && page.eser || (typeof EVS !== 'undefined' && EVS && EVS.eser); return world ? JSON.stringify(world, null, 2) : ''; } catch (_) {} return ''; }
  function preflight(form, source) {
    var output = form && form.querySelector('[data-tf65-check-result]');
    if (!output) return null;
    var report;
    try {
      var data = source || JSON.parse(form.elements.veri.value);
      report = typeof window.tf65EvrenYayinDenetle === 'function' ? window.tf65EvrenYayinDenetle(data) : { ok: false, errors: ['Denetim modülü yüklenemedi.'], warnings: [] };
    } catch (error) { report = { ok: false, errors: ['JSON verisi okunamadı: ' + (error.message || error)], warnings: [] }; }
    var errors = (report.errors || []).map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('');
    var warnings = (report.warnings || []).map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('');
    output.innerHTML = '<div class="tf65-preflight-result ' + (report.ok ? 'iyi' : 'kotu') + '"><b>' + (report.ok ? 'Önizleme denetimi geçti' : 'Önizleme için düzeltme gerekiyor') + '</b>' + (errors ? '<ul>' + errors + '</ul>' : '') + (warnings ? '<p><b>Öneriler</b></p><ul>' + warnings + '</ul>' : '') + '<small>JSON boyutu: ' + Math.ceil((report.byteSize || 0) / 1024) + ' KB</small></div>';
    return report;
  }
  function addPreflight(box) {
    var form = box.querySelector('[data-tf633-save]');
    var textarea = form && form.querySelector('[name="veri"]');
    if (!textarea || form.querySelector('[data-tf65-check]')) return;
    var controls = document.createElement('div');
    controls.className = 'tf65-preflight';
    controls.innerHTML = '<button type="button" class="dugme dugme-sade" data-tf65-check>Yayın / önizleme öncesi denetle</button><div data-tf65-check-result role="status" aria-live="polite"></div><p class="oyun-not">Taslak kaydı serbesttir; “Önizleme” durumuna geçmeden önce ad, özet, yazılı içerik, okuma rotası ve harita verisi denetlenir.</p>';
    textarea.insertAdjacentElement('afterend', controls);
  }
  async function drafts(box) {
    var r = await c().rpc('evren_taslaklarim'), t = box.querySelector('[data-tf633-drafts]');
    if (r.error) { t.innerHTML = '<p class="oyun-not">Taslaklar yüklenemedi.</p>'; return; }
    var rows = Array.isArray(r.data) ? r.data : [];
    t.innerHTML = rows.length ? rows.map(function (x) { return '<div class="tf633-taslak"><b>' + esc(x.baslik) + '</b><span class="oyun-not">' + esc(x.evren_id) + ' · sürüm ' + Number(x.surum) + ' · ' + esc(x.durum) + '</span><button class="dugme dugme-sade" data-tf633-load="' + esc(x.id) + '">Detayı yükle</button></div>'; }).join('') : '<p class="oyun-not">Henüz sunucu taslağın yok.</p>';
  }
  function mount() {
    var root = document.querySelector('#hesapTopluluk');
    if (!root || mounted || typeof hesapKullanici === 'undefined' || !hesapKullanici || !c()) return;
    mounted = true;
    var box = document.createElement('section'); box.className = 'hesap-kutu tf633-kurucu';
    box.innerHTML = '<span class="oyun-etiket">Kurucu araçları · 6.5.5</span><h3>Evren taslak merkezi</h3><p class="oyun-not">Yerel editöründeki evren verisini sürümlü olarak sunucuda sakla. Her kayıt yeni bir sürüm oluşturur; mevcut yayın otomatik olarak değişmez.</p><form data-tf633-save><div class="oyun-sira"><input class="kod-giris arac-giris" name="evren" required maxlength="80" placeholder="evren kimliği"><input class="kod-giris arac-giris" name="baslik" required maxlength="160" placeholder="taslak başlığı"></div><select class="kod-giris" name="durum"><option value="taslak">Taslak</option><option value="onizleme">Önizleme</option><option value="arsiv">Arşiv</option></select><textarea class="kod-giris" name="veri" required rows="8" placeholder="Evren JSON verisi"></textarea><button type="button" class="dugme dugme-sade" data-tf633-current>Mevcut editörü doldur</button><button class="dugme" type="submit">Yeni sürüm kaydet</button></form><div data-tf633-drafts><p class="oyun-not">Taslaklar yükleniyor…</p></div><h3>Zaman çizelgesi noktası</h3><form data-tf633-time><div class="oyun-sira"><input class="kod-giris arac-giris" name="evren" required maxlength="80" placeholder="evren kimliği"><input class="kod-giris arac-giris" name="zaman" required maxlength="60" placeholder="zaman / çağ"><input class="kod-giris arac-giris" name="baslik" required maxlength="160" placeholder="olay başlığı"></div><textarea class="kod-giris" name="aciklama" rows="2" maxlength="600" placeholder="olay açıklaması"></textarea><select class="kod-giris" name="tur"><option>olay</option><option>donem</option><option>savas</option><option>dogum</option><option>olum</option><option>donum</option></select><button class="dugme" type="submit">Zaman noktasını ekle</button></form><p data-tf633-msg class="pencere-durum"></p>';
    root.appendChild(box); addPreflight(box); drafts(box); box.addEventListener('submit', submit); box.addEventListener('click', click);
  }
  async function submit(event) {
    var f=event.target; if (!f.matches('[data-tf633-save], [data-tf633-time]')) return; event.preventDefault(); var box=f.closest('.tf633-kurucu'), fd=new FormData(f);
    try { var r;
      if (f.matches('[data-tf633-save]')) { var data; try { data=JSON.parse(fd.get('veri')); } catch (_) { throw new Error('JSON verisi geçersiz'); } if (fd.get('durum') === 'onizleme') { var check = preflight(f, data); if (!check || !check.ok) throw new Error('Önizleme denetimindeki hataları düzeltip yeniden dene.'); } var draftPayload={p_evren_id:fd.get('evren'),p_baslik:fd.get('baslik'),p_veri:data,p_durum:fd.get('durum')}; if (navigator.onLine === false) { if (!pendingAdd('evren-taslak',draftPayload)) throw new Error('Çevrimdışı taslak cihazda saklanamadı'); msg(box,'İnternet yok; taslak bu cihaza kaydedildi, bağlantı gelince gönderilecek.',true); f.reset(); return; } r=await c().rpc('evren_taslak_kaydet',draftPayload); }
      else { var timePayload={p_evren_id:fd.get('evren'),p_zaman:fd.get('zaman'),p_baslik:fd.get('baslik'),p_aciklama:fd.get('aciklama')||'',p_tur:fd.get('tur')}; if (navigator.onLine === false) { if (!pendingAdd('evren-zaman',timePayload)) throw new Error('Çevrimdışı zaman noktası cihazda saklanamadı'); msg(box,'İnternet yok; zaman noktası bu cihaza kaydedildi, bağlantı gelince gönderilecek.',true); f.reset(); return; } r=await c().rpc('evren_zaman_noktasi_ekle',timePayload); }
      if(r.error) throw r.error; msg(box, f.matches('[data-tf633-save]') ? 'Sürüm kaydedildi.' : 'Zaman noktası eklendi.', true); if(f.matches('[data-tf633-save]')) drafts(box); f.reset();
    } catch(e) { msg(box, 'Kaydedilemedi: '+(e.message||e), false); }
  }
  async function click(event) {
    var check = event.target.closest('[data-tf65-check]'); if (check) { event.preventDefault(); preflight(check.closest('form')); return; }
    var current=event.target.closest('[data-tf633-current]'); if(current) { var f=current.closest('form'), data=currentData(); if(data) f.elements.veri.value=data; else msg(f.closest('.tf633-kurucu'),'Açık bir yerel evren editörü bulunamadı.',false); return; }
    var load=event.target.closest('[data-tf633-load]'); if(!load) return;
    var r=await c().rpc('evren_taslak_detay',{p_id:load.dataset.tf633Load}); if(r.error||!r.data) return; var f=load.closest('.tf633-kurucu').querySelector('[data-tf633-save]'); f.elements.evren.value=r.data.evren_id; f.elements.baslik.value=r.data.baslik+' (kopya)'; f.elements.durum.value='taslak'; f.elements.veri.value=JSON.stringify(r.data.veri,null,2); msg(f.closest('.tf633-kurucu'),'Taslak forma yüklendi; kaydettiğinde yeni sürüm oluşur.',true);
  }
  function boot(){mount(); flushPending();}
  window.addEventListener('online', function(){ flushPending(); });
  document.addEventListener('DOMContentLoaded',boot,{once:true}); document.addEventListener('tf-veri-hazir',boot); window.addEventListener('tf-hesap-hazir',flushPending); new MutationObserver(boot).observe(document.body,{childList:true,subtree:true});
}());
