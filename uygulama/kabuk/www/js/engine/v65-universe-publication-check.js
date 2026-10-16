/* TentiforApp 6.5.3 — evren yayın/önizleme öncesi kalite denetimi. */
(function () {
  'use strict';
  function list(value) { return Array.isArray(value) ? value : []; }
  function words(value) { return String(value == null ? '' : value).trim(); }
  function populated(value) {
    if (typeof value === 'string') return !!value.trim();
    if (Array.isArray(value)) return value.some(populated);
    if (value && typeof value === 'object') return Object.keys(value).some(function (key) { return populated(value[key]); });
    return false;
  }
  function bytes(value) {
    var json = JSON.stringify(value);
    try { return new TextEncoder().encode(json).length; } catch (_) { return unescape(encodeURIComponent(json)).length; }
  }
  function validate(world) {
    var errors = [];
    var warnings = [];
    if (!world || typeof world !== 'object' || Array.isArray(world)) {
      return { ok: false, errors: ['Evren verisi bir JSON nesnesi olmalı.'], warnings: [], byteSize: 0 };
    }
    if (world.tur && world.tur !== 'evren') errors.push('Kayıt türü “evren” olmalı.');
    var name = words(world.ad);
    if (name.length < 2) errors.push('Evren adı en az 2 karakter olmalı.');
    if (name.length > 80) errors.push('Evren adı en fazla 80 karakter olabilir.');
    var summary = words(world.ozet);
    if (summary.length < 30) errors.push('Özet en az 30 karakter olmalı; okur evrenin temel fikrini anlayabilmeli.');
    if (summary.length > 5000) errors.push('Özet 5.000 karakteri aşmamalı.');

    var contentKeys = ['kurallar', 'kisiler', 'yerler', 'tarih', 'sozluk', 'belgeler', 'lorlar', 'cizimler', 'oyun_listesi'];
    var hasWriting = contentKeys.some(function (key) { return list(world[key]).some(populated); })
      || list(world.roman && world.roman.bolumler).some(populated)
      || list(world.harita && world.harita.yerler).some(populated)
      || Object.keys(world).some(function (key) { return /^ozel/.test(key) && populated(world[key]); });
    if (!hasWriting) errors.push('En az bir yazılı bölüm ekle: kural, kişi, yer, tarih, sözlük veya roman bölümü.');

    var chapters = list(world.roman && world.roman.bolumler);
    var chapterIds = new Set(chapters.map(function (chapter) { return String(chapter && chapter.id || ''); }).filter(Boolean));
    var lore = list(world.lorlar);
    var loreIds = new Set(lore.map(function (entry) { return String(entry && entry.id || ''); }).filter(Boolean));
    var groups = ['kurallar', 'kisiler', 'yerler', 'tarih', 'sozluk', 'belgeler'];
    var groupNames = { kurallar: 'kural', kisiler: 'kişi', yerler: 'yer', tarih: 'tarih', sozluk: 'sözlük maddesi', belgeler: 'belge' };
    groups.forEach(function (key) {
      list(world[key]).forEach(function (item, index) {
        if (!item || typeof item !== 'object') errors.push((index + 1) + '. ' + groupNames[key] + ' geçersiz.');
        else if (!words(item.ad || item.baslik || item.olay || item.terim)) warnings.push((index + 1) + '. ' + groupNames[key] + ' başlıksız; okur listede tanıyamayabilir.');
        else if (!populated(item.aciklama || item.metin || item.tanim || item.ozet)) warnings.push((index + 1) + '. ' + groupNames[key] + ' için açıklama boş.');
      });
    });

    var map = list(world.harita && world.harita.yerler);
    map.forEach(function (place, index) {
      if (!place || !words(place.ad)) errors.push('Haritadaki ' + (index + 1) + '. yerin adı eksik.');
      else if (!Number.isFinite(Number(place.x)) || !Number.isFinite(Number(place.y)) || Number(place.x) < 0 || Number(place.x) > 100 || Number(place.y) < 0 || Number(place.y) > 100) {
        errors.push('Haritadaki “' + words(place.ad).slice(0, 60) + '” noktasının x/y koordinatları 0–100 aralığında olmalı.');
      }
    });

    list(world.okuma_rehberi).forEach(function (step, index) {
      var target = String(step && step.dosya || '');
      var match = /^(roman|lore):(.+)$/.exec(target);
      var group = /^bolum:(.+)$/.exec(target);
      if (!step || !words(step.baslik)) errors.push((index + 1) + '. okuma rotası adımı başlıksız.');
      else if (match && match[1] === 'roman' && !chapterIds.has(match[2])) errors.push('Okuma rotasındaki roman bölümü bulunamadı: ' + match[2]);
      else if (match && match[1] === 'lore' && !loreIds.has(match[2])) errors.push('Okuma rotasındaki lore kaydı bulunamadı: ' + match[2]);
      else if (group && group[1] !== 'ozet' && !list(world[group[1]]).length) errors.push('Okuma rotası boş veya bulunmayan bölüme gidiyor: ' + group[1]);
      else if (!match && !group && !/^#\//.test(target)) errors.push((index + 1) + '. okuma rotasının hedefi geçersiz.');
    });

    if (summary.length >= 30 && summary.length < 80) warnings.push('Özet kısa; evrenin ayırt edici yönünü bir iki cümleyle genişletmek iyi olur.');
    if (!map.length) warnings.push('Harita eklenmemiş. Görsel yerleşim okurun evreni kavramasına yardımcı olabilir.');
    if (!list(world.okuma_rehberi).length) warnings.push('Özel okuma sırası yok; içerikten otomatik bir Oku rotası oluşturulur.');
    var size = bytes(world);
    if (size > 950000) errors.push('Evren verisi 950 KB sınırını aşıyor (' + Math.round(size / 1024) + ' KB). Görsel veya metinleri küçült.');
    else if (size > 800000) warnings.push('Evren verisi 800 KB üzerine çıktı; sunucu kayıt sınırına yaklaşıyor.');
    return { ok: errors.length === 0, errors: errors, warnings: warnings, byteSize: size };
  }
  window.tf65EvrenYayinDenetle = validate;
}());
