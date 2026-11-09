import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const sanitizerSource = fs.readFileSync('js/engine/45-evrengezer.js', 'utf8');
const moduleSource = fs.readFileSync('js/engine/104-evren-ansiklopedi.js', 'utf8');
const builder = fs.readFileSync('scripts/paketle.mjs', 'utf8');
const bundle = fs.readFileSync('js/paket-3.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const runner = fs.readFileSync('scripts/test.mjs', 'utf8');
const publicationSource = fs.readFileSync('js/engine/v65-universe-publication-check.js', 'utf8');

function extractFunction(text, signature) {
  const start = text.indexOf(signature);
  assert.notEqual(start, -1, `Missing function ${signature}`);
  const open = text.indexOf('{', start + signature.length);
  let depth = 0, quote = '', escaped = false, lineComment = false, blockComment = false;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i], next = text[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i += 1; } continue; }
    if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === quote) quote = ''; continue; }
    if (ch === '/' && next === '/') { lineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  assert.fail(`Unclosed function ${signature}`);
}

const imageSanitizer = extractFunction(sanitizerSource, 'function evrenVarlikGorselTemizle(a)');
const uuidSanitizer = extractFunction(sanitizerSource, 'function evrenVarlikUuidTemizle(value)');
const wikiSanitizer = extractFunction(sanitizerSource, 'function evrenAnsiklopediTemizle(a)');
const sanitizerContext = {
  URL,
  window: {},
  fanMetin(value, max) { return String(value == null ? '' : value).slice(0, max); },
  input: [
    { id: 'plant-1', tur: 'bitki', baslik: '  Ay çiçeği  ', ozet: 'Kısa tanıtım', giris: 'Eski giriş korunur.', etiketler: ['Gece', 'Gece', '<script>'], ilgiliIds: ['animal-1'], durum: 'yayinda', gorsel: { id: 'asset-1', tur: 'varlik', kaynak: 'indexeddb' }, ozellikler: { siniflandirma: 'Çiçekli bitki', ignored: '<script>' }, kaynakca: [{ baslik: 'Güvenli kaynak', url: 'https://example.invalid/wiki' }, { baslik: 'Tehlikeli bağlantı', url: 'javascript:alert(1)' }] },
    { id: 'plant-1', tur: 'hayvan', baslik: 'duplicate id' },
    { id: 'bad-type', tur: 'dragon', baslik: 'Eski özel tür', aciklama: 'İçerik kaybolmamalı.' },
    { id: 'missing-type', baslik: 'Türü olmayan eski kayıt', habitat: 'Kıyı' },
    null,
    { id: 'draft-1', tur: 'hayvan', baslik: '', durum: 'bad', spoiler: true }
  ]
};
const sanitized = vm.runInNewContext(`const EVREN_VARLIK_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;\n${imageSanitizer}\n${uuidSanitizer}\n${wikiSanitizer}\nevrenAnsiklopediTemizle(input)`, sanitizerContext);
const expectedCategories = [
  ['bitki', 'Bitki'], ['hayvan', 'Hayvan'], ['esya', 'Eşya'], ['ozel-esya', 'Özel eşya'],
  ['bina', 'Bina'], ['ozel-bina', 'Özel bina'], ['ozel-guc', 'Özel güç'], ['diger', 'Diğer / özel tür']
];
const sanitizedCategories = JSON.parse(JSON.stringify(sanitizerContext.window.EVREN_ANSIKLOPEDI_SCHEMA.categories.map(({ id, ad }) => [id, ad])));
assert.deepEqual(sanitizedCategories, expectedCategories, 'one verified schema contains the eight Turkish categories');
assert.equal(sanitized.length, 5, 'malformed rows are dropped while legacy/duplicate records remain recoverable');
assert.equal(sanitized[0].baslik, 'Ay çiçeği', 'article title is trimmed');
assert.deepEqual(Array.from(sanitized[0].etiketler), ['Gece', '<script>'], 'tags are deduplicated while markup remains plain text');
assert.equal(sanitized[0].ozellikler.ignored, undefined, 'unknown structured fields are removed');
assert.equal(sanitized[0].gorsel.kaynak, 'indexeddb', 'approved local image metadata is retained');
assert.equal(sanitized[0].kaynakca[0].url, 'https://example.invalid/wiki', 'HTTPS references are preserved');
assert.equal(sanitized[0].kaynakca[1].url, '', 'unsafe URL schemes are not retained as link targets');
assert.equal(sanitized[2].tur, 'diger', 'unknown legacy category safely defaults to Other');
assert.equal(sanitized[2].turEski, 'dragon', 'legacy category label is preserved as plain metadata');
assert.equal(sanitized[2].aciklama, 'İçerik kaybolmamalı.', 'legacy category fallback does not discard article text');
assert.equal(sanitized[3].tur, 'diger', 'missing legacy category safely defaults to Other');
assert.notEqual(sanitized[0].id, sanitized[1].id, 'duplicate legacy IDs are made unique rather than discarding article content');
assert.equal(sanitized[4].durum, 'taslak', 'invalid status defaults to private draft');
assert.equal(JSON.stringify(sanitized).includes('javascript:alert'), false, 'unsafe URL is discarded by normalization');

const world = {
  id: 'wiki-test', ad: 'Test Evreni',
  ansiklopediMaddeleri: [
    { id: 'plant-1', tur: 'bitki', baslik: 'Ay çiçeği', ozet: 'Geceleri açan bir bitki.', giris: 'Gümüş Göl kıyısında açar.', aciklama: 'Göl kenarlarında yetişir.', habitat: 'Gümüş Göl', etiketler: ['gece', 'bitki'], durum: 'yayinda', spoiler: true, sonDegisiklik: '2026-11-07T12:00:00Z', ozellikler: { ekolojikRol: 'Gölü arındırır.' }, kaynakca: [{ baslik: 'Ay çiçeği rehberi', aciklama: 'Gümüş Göl kaynak notu', url: 'https://example.invalid/atlas' }], ilgiliIds: ['animal-1'] },
    { id: 'animal-1', tur: 'hayvan', baslik: 'Göl tilkisi', ozet: 'Küçük bir gece avcısı.', aciklama: 'Ay çiçeğinin tohumlarını taşır.', habitat: 'Gümüş Göl', etiketler: ['gece', 'hayvan'], durum: 'yayinda', ilgiliIds: ['plant-1'], ozellikler: { beslenme: 'Tarçınlı meyve ve balık.' } },
    { id: 'item-1', tur: 'esya', baslik: 'Bakır fener', ozet: 'Sönmeyen kıyı feneri.', aciklama: 'Bir ustanın işçiliği.', durum: 'yayinda', ozellikler: { malzeme: 'Bakır', islev: 'Yol gösterir.' } },
    { id: 'special-item-1', tur: 'ozel-esya', baslik: 'Gelgit anahtarı', ozet: 'Kilitli kapıları açar.', durum: 'yayinda', ozellikler: { guc: 'Gelgiti durdurur.' } },
    { id: 'building-1', tur: 'bina', baslik: 'Mavi liman', ozet: 'Kıyı kentinin merkezi.', durum: 'yayinda', ozellikler: { yapi: 'Taş iskele.' } },
    { id: 'special-building-1', tur: 'ozel-bina', baslik: 'Sessiz kule', ozet: 'Rüzgârı kesen gözetleme yapısı.', durum: 'yayinda', ozellikler: { savunma: 'Yankı kalkanı.' } },
    { id: 'power-1', tur: 'ozel-guc', baslik: 'Su hafızası', ozet: 'Suyun geçmişini duyma yetisi.', durum: 'yayinda', ozellikler: { sinirlar: 'Tuzlu suda zayıflar.' } },
    { id: 'other-1', tur: 'diger', baslik: 'Kırmızı fırtına', ozet: 'Kıyıların mevsimsel olayı.', durum: 'yayinda', ozellikler: { nitelikler: 'Tarçın kokulu.' }, kaynakca: [{ baslik: 'Eski kaynak', url: 'javascript:alert(1)' }] },
    { id: 'draft-1', tur: 'bitki', baslik: 'Gizli taslak', ozet: 'Henüz yayımlanmadı.', durum: 'taslak' }
  ]
};
const dom = new JSDOM('<!doctype html><html lang="tr"><head></head><body></body></html>', { runScripts: 'outside-only', url: 'https://tentifor.test/' });
const { window } = dom;
window.kacir = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
window.eval(`function fanMetin(value,max){return String(value==null?'':value).slice(0,max)}\n${imageSanitizer}\n${wikiSanitizer}\nwindow.evrenVarlikGorselTemizle=evrenVarlikGorselTemizle;window.evrenAnsiklopediTemizle=evrenAnsiklopediTemizle;`);
window.EVREN_ANSIKLOPEDI_SCHEMA = sanitizerContext.window.EVREN_ANSIKLOPEDI_SCHEMA;
window.evrenSayfaVerisi = () => ({ eser: world, kaynak: window.EVS.kaynak });
window.evrenBenimBul = () => world;
window.evrenBenimDegistir = (_id, mutator) => mutator(world);
window.evrenEkSekmeler = () => [];
window.evrenEkBolum = () => '<p>base</p>';
window.evrKurucuHtml = () => '<div class="evr-kartlar"></div>';
window.confirm = () => true;
window.eval('var EVS = { kaynak: "public", sekme: "ansiklopedi", id: "wiki-test" };');
window.eval(moduleSource);
const publicPage = { eser: world, kaynak: 'public' };
assert.equal(window.evrenEkSekmeler(publicPage).filter((tab) => tab[0] === 'ansiklopedi').length, 1, 'reader tab is shown once when published articles exist');
let publicMarkup = window.evrenEkBolum(publicPage);
assert.ok(publicMarkup.includes('Ay çiçeği') && publicMarkup.includes('Göl tilkisi'), 'published articles render in the public index');
assert.ok(!publicMarkup.includes('Gizli taslak'), 'draft article text is hidden from readers');
assert.ok(expectedCategories.every(([, label]) => publicMarkup.includes(label)), 'reader navigation contains every category name');
assert.ok(publicMarkup.includes('Alfabetik indeks') && publicMarkup.includes('Liste') && publicMarkup.includes('Kartlar'), 'reader offers list, alphabetic index and optional grid views');

window.document.body.innerHTML = publicMarkup;
assert.equal(window.document.querySelectorAll('[data-eaw-category]').length, 9, 'reader offers all-categories plus eight category filters');
const search = window.document.querySelector('[data-eaw-search]');
search.value = 'TİLKİ';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(window.document.querySelectorAll('[data-eaw-open]').length, 1, 'case-insensitive Turkish search finds the matching animal');
assert.ok(window.document.querySelector('[data-eaw-open="animal-1"]'), 'Turkish dotted-I search resolves the expected title');
search.value = 'kaynak notu';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(window.document.querySelectorAll('[data-eaw-open]').length, 1, 'full text search includes citation description text, not just titles');
search.value = 'hiçbir-madde-yok';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.ok(window.document.querySelector('.eaw-empty'), 'no-result state is understandable');
search.value = '';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
window.document.querySelector('[data-eaw-category="bina"]').click();
assert.equal(window.document.querySelectorAll('[data-eaw-open]').length, 1, 'category filter narrows the article index');
window.document.querySelector('[data-eaw-category=""]').click();
window.document.querySelector('[data-eaw-view="alfabetik"]').click();
assert.ok(window.document.querySelector('.eaw-alpha-index'), 'alphabetic index view groups articles by Turkish initial');
window.document.querySelector('[data-eaw-view="liste"]').click();

window.history.replaceState({}, '', '/?wiki=plant-1');
publicMarkup = window.evrenEkBolum(publicPage);
window.document.body.innerHTML = publicMarkup;
assert.ok(window.document.querySelector('.eaw-article'), 'published article deep link hydrates the selected article');
assert.equal(window.document.querySelector('.eaw-article h1').textContent, 'Ay çiçeği', 'deep link opens the stable article ID');
assert.ok(window.document.querySelector('.eaw-infobox'), 'reader article includes a wiki information box');
const spoiler = window.document.querySelector('.eaw-article details.eaw-spoiler');
assert.ok(spoiler && !spoiler.open, 'spoiler content starts collapsed');
assert.ok(spoiler.querySelector('.eaw-infobox') && spoiler.querySelector('.eaw-intro') && spoiler.querySelector('.eaw-prose'), 'spoiler protects the infobox, intro and article body together');
assert.ok(window.document.querySelector('.eaw-related [data-eaw-open="animal-1"]'), 'related article ID renders as an internal cross-link');
assert.equal(window.document.querySelector('.eaw-bibliography a').getAttribute('target'), '_blank', 'safe references open in a separate tab');
assert.equal(window.document.querySelector('.eaw-bibliography a').getAttribute('rel'), 'noopener noreferrer', 'external references use safe rel attributes');
assert.ok(!window.document.querySelector('.eaw-bibliography a[href^="javascript:"]'), 'unsafe source URLs are rendered as text, never executable links');
window.history.replaceState({}, '', '/?wiki=other-1');
window.document.body.innerHTML = window.evrenEkBolum(publicPage);
assert.ok(window.document.querySelector('.eaw-bibliography').textContent.includes('Eski kaynak'), 'unsafe citation title remains readable as plain text');
assert.equal(window.document.querySelector('.eaw-bibliography a[href^="javascript:"]'), null, 'rendered unsafe citation never becomes an executable link');
window.history.replaceState({}, '', '/?wiki=draft-1');
window.document.body.innerHTML = window.evrenEkBolum(publicPage);
assert.equal(window.document.querySelector('.eaw-article'), null, 'guessed draft ID cannot hydrate a public article');
assert.ok(!window.document.body.textContent.includes('Gizli taslak'), 'draft URL does not reveal the draft title');
window.history.replaceState({}, '', '/');
window.document.body.innerHTML = window.evrenEkBolum(publicPage);
window.document.querySelector('[data-eaw-open="plant-1"]').click();
assert.equal(new URL(window.location.href).searchParams.get('wiki'), 'plant-1', 'opening a reader article writes a stable deep-link query');
window.document.querySelector('.eaw-related [data-eaw-open="animal-1"]').click();
assert.equal(new URL(window.location.href).searchParams.get('wiki'), 'animal-1', 'related article navigation updates the deep link');
assert.ok(window.document.querySelector('.eaw-article').textContent.includes('Göl tilkisi'), 'related link opens the target article');

window.eval('EVS.kaynak = "benim"; EVS.sekme = "ansiklopedi";');
const ownerPage = { eser: world, kaynak: 'benim' };
window.evrenSayfaCiz = () => { window.document.body.innerHTML = window.evrenEkBolum(ownerPage); };
assert.ok(window.evrenEkSekmeler(ownerPage).some((tab) => tab[0] === 'ansiklopedi'), 'owner tab is available for a blank/new universe');
assert.ok(window.evrKurucuHtml(ownerPage).includes('data-evs-sekme="ansiklopedi"'), 'multi-step creator links to encyclopedia editor');
window.document.body.innerHTML = window.evrenEkBolum(ownerPage);
assert.ok(window.document.querySelector('[data-eaw-new]'), 'owner editor offers new encyclopedia entries');
window.document.querySelector('[data-eaw-new]').click();
const newEntry = world.ansiklopediMaddeleri.find((entry) => !entry.baslik && entry.durum === 'taslak');
assert.ok(newEntry, 'new entries are persisted as private drafts');
const categorySelect = window.document.querySelector(`[data-eaw-field="${newEntry.id}:tur"]`);
assert.deepEqual(Array.from(categorySelect.options).map((option) => option.value), expectedCategories.map(([id]) => id), 'editor category choices use the single schema');
categorySelect.value = 'ozel-esya';
categorySelect.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.ok(window.document.querySelector(`[data-eaw-field="${newEntry.id}:ozellikler.malzeme"]`), 'special item editor exposes material-specific fields');
assert.ok(window.document.querySelector(`[data-eaw-field="${newEntry.id}:ozellikler.guc"]`), 'special item editor exposes effect-specific fields');
assert.equal(window.document.querySelector(`[data-eaw-field="${newEntry.id}:ozellikler.beslenme"]`), null, 'irrelevant animal fields are not required or shown');
let title = window.document.querySelector(`[data-eaw-field="${newEntry.id}:baslik"]`);
title.value = 'Yeni Gelgit Anahtarı';
title.dispatchEvent(new window.Event('change', { bubbles: true }));
let summary = window.document.querySelector(`[data-eaw-field="${newEntry.id}:ozet"]`);
summary.value = 'Gelgit kapılarını açan özel bir eşya.';
summary.dispatchEvent(new window.Event('change', { bubbles: true }));
let statusSelect = window.document.querySelector(`[data-eaw-field="${newEntry.id}:durum"]`);
statusSelect.value = 'yayinda';
statusSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.equal(newEntry.durum, 'yayinda', 'title and short introduction satisfy publication requirements');
assert.ok(newEntry.gecmis.length >= 3, 'field changes create bounded, restorable revisions');
window.document.querySelector(`[data-eaw-save="${newEntry.id}"]`).click();
assert.ok(window.document.querySelector(`[data-eaw-entry-status="${newEntry.id}"]`).textContent.includes('kaydedildi'), 'save action confirms the existing local draft save path');

window.document.querySelector(`[data-eaw-add-source="${newEntry.id}"]`).click();
let sourceUrl = window.document.querySelector(`[data-eaw-source-field^="${newEntry.id}:0:"][data-eaw-source-field$=":url"]`);
sourceUrl.value = 'javascript:alert(1)';
sourceUrl.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.equal(newEntry.kaynakca[0].url, '', 'invalid source URL is rejected without changing saved data');
sourceUrl.value = 'https://example.invalid/gelgit';
sourceUrl.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.equal(newEntry.kaynakca[0].url, 'https://example.invalid/gelgit', 'valid HTTPS source URL is saved');
const sourceBeforeFailedWrite = JSON.stringify(newEntry.kaynakca);
const originalWorldWriter = window.evrenBenimDegistir;
window.evrenBenimDegistir = () => false;
window.document.querySelector(`[data-eaw-add-source="${newEntry.id}"]`).click();
assert.equal(JSON.stringify(newEntry.kaynakca), sourceBeforeFailedWrite, 'failed local storage write does not mutate the current article data');
assert.ok(window.document.querySelector('[data-eaw-status]').textContent.includes('yerel depoya yazılamadı'), 'failed local write is reported instead of a false save confirmation');
window.evrenBenimDegistir = originalWorldWriter;

const publicationDom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
publicationDom.window.EVREN_ANSIKLOPEDI_SCHEMA = sanitizerContext.window.EVREN_ANSIKLOPEDI_SCHEMA;
publicationDom.window.eval(publicationSource);
const validate = publicationDom.window.tf65EvrenYayinDenetle;
assert.equal(typeof validate, 'function');
const publicWorld = {
  tur: 'evren', ad: 'Ansiklopedi Dünyası',
  ozet: 'Bitkiler, hayvanlar ve kıyı kentleri hakkında kayıtlar içeren örnek evren.',
  ansiklopediMaddeleri: [
    { id: 'plant-1', tur: 'bitki', baslik: 'Ay çiçeği', ozet: 'Geceleri açar.', durum: 'yayinda', ilgiliIds: ['fauna-1'] },
    { id: 'fauna-1', tur: 'hayvan', baslik: 'Göl tilkisi', ozet: 'Kıyıda yaşar.', durum: 'yayinda', ilgiliIds: ['plant-1'] },
    { id: 'draft-1', tur: 'bitki', baslik: 'Taslak madde', durum: 'taslak' }
  ]
};
assert.equal(validate(publicWorld).ok, true, 'published articles count as written content and reciprocal links are valid');
const draftOnly = structuredClone(publicWorld);
draftOnly.ansiklopediMaddeleri = [draftOnly.ansiklopediMaddeleri[2]];
assert.ok(validate(draftOnly).errors.some((item) => item.includes('yazılı bölüm')), 'private drafts do not count as public written content');
const missingArticle = structuredClone(publicWorld);
missingArticle.ansiklopediMaddeleri[0].ilgiliIds.push('missing-id');
assert.ok(validate(missingArticle).errors.some((item) => item.includes('Ay çiçeği') && item.includes('bulunmayan ansiklopedi maddesine')), 'broken article links identify their source article');
const draftLink = structuredClone(publicWorld);
draftLink.ansiklopediMaddeleri[0].ilgiliIds = ['draft-1'];
assert.ok(validate(draftLink).warnings.some((item) => item.includes('Ay çiçeği') && item.includes('taslak')), 'links to drafts are explicitly warned about');
const duplicateArticle = structuredClone(publicWorld);
duplicateArticle.ansiklopediMaddeleri[1].id = 'plant-1';
assert.ok(validate(duplicateArticle).errors.some((item) => item.includes('kimliği yineleniyor')), 'duplicate article IDs are rejected');
const crossListDuplicate = structuredClone(publicWorld);
crossListDuplicate.ansiklopediSilinenMaddeler = [{ id: 'plant-1' }];
assert.ok(validate(crossListDuplicate).errors.some((item) => item.includes('hem etkin hem silinen')), 'active/deleted ID collisions are rejected');
const malformedEncyclopedia = structuredClone(publicWorld);
malformedEncyclopedia.ansiklopediMaddeleri = 'not-an-array';
assert.ok(validate(malformedEncyclopedia).errors.some((item) => item.includes('maddeleri listesi bozuk')), 'malformed encyclopedia arrays cannot silently pass publication');
const overLimitEncyclopedia = structuredClone(publicWorld);
overLimitEncyclopedia.ansiklopediMaddeleri = Array.from({ length: 301 }, (_, index) => ({ id: `limit-${index}`, tur: 'bitki', baslik: 'Taslak', durum: 'taslak' }));
assert.ok(validate(overLimitEncyclopedia).errors.some((item) => item.includes('300 madde sınırını')), 'publication enforces the client-side article cap');
const historyOverflow = structuredClone(publicWorld);
historyOverflow.ansiklopediMaddeleri[0].gecmis = Array.from({ length: 21 }, () => ({ madde: {} }));
assert.ok(validate(historyOverflow).errors.some((item) => item.includes('20 sürüm sınırını')), 'publication rejects revision histories above the preserved limit');
const missingSummary = structuredClone(publicWorld);
missingSummary.ansiklopediMaddeleri[0].ozet = '';
assert.ok(validate(missingSummary).errors.some((item) => item.includes('Ay çiçeği') && item.includes('kısa tanıtım gerekli')), 'published entries require a short introduction');
const badCategory = structuredClone(publicWorld);
badCategory.ansiklopediMaddeleri[0].tur = 'dragon';
assert.ok(validate(badCategory).errors.some((item) => item.includes('Ay çiçeği') && item.includes('kategorisi geçersiz')), 'publication checks use the verified category schema');
const localImage = structuredClone(publicWorld);
localImage.ansiklopediMaddeleri[0].gorsel = { id: 'local-1', kaynak: 'indexeddb' };
assert.ok(validate(localImage).warnings.some((item) => item.includes('Ay çiçeği') && item.includes('IndexedDB')), 'published local images receive a per-article visibility warning');
const unsafeSource = structuredClone(publicWorld);
unsafeSource.ansiklopediMaddeleri[0].kaynakca = [{ baslik: 'Tehlikeli', url: 'javascript:alert(1)' }];
assert.ok(validate(unsafeSource).errors.some((item) => item.includes('Ay çiçeği') && item.includes('HTTPS')), 'publication rejects unsafe reference URLs');
const badMap = structuredClone(publicWorld);
badMap.harita = { yerler: [{ ad: 'Mavi Liman', x: 101, y: 70 }] };
assert.ok(validate(badMap).errors.some((item) => item.includes('0–100')));
const tooLarge = structuredClone(publicWorld);
tooLarge.kurallar = [{ ad: 'Büyük ek', aciklama: 'x'.repeat(960000) }];
assert.ok(validate(tooLarge).errors.some((item) => item.includes('950 KB')));

const builderSource = fs.readFileSync('js/engine/evren-kurucu-calisma-alani.js', 'utf8');
assert.match(builderSource, /fd\.get\('durum'\) === 'onizleme'/, 'preview state receives publication check');
assert.match(builderSource, /page && page\.eser/, 'existing editor receives real universe data');
assert.match(builderSource, /data-tf65-check/, 'builder retains manual check control');
assert.ok(builder.includes("'function evrenAnsiklopediTemizle(a)'"), 'build script synchronizes the sanitizer into paket-3');
assert.ok(bundle.includes('function evrenAnsiklopediTemizle(a)'), 'served bundle contains the encyclopedia sanitizer after build');
assert.ok(index.includes('js/engine/104-evren-ansiklopedi.js'), 'app shell loads the encyclopedia editor');
assert.ok(runner.includes('tests/6.6.3-universe-encyclopedia.mjs'), 'unit regression is registered in the full test runner');
world.ansiklopediMaddeleri = Array.from({ length: 300 }, (_, index) => ({ id: `limit-${index}`, tur: 'diger', baslik: `Etkin madde ${index}`, durum: 'taslak' }));
world.ansiklopediSilinenMaddeler = [{ id: 'restore-at-limit', tur: 'diger', baslik: 'Geri yüklenecek', durum: 'taslak' }];
window.document.body.innerHTML = window.evrenEkBolum(ownerPage);
window.document.querySelector('[data-eaw-restore="restore-at-limit"]').click();
assert.equal(world.ansiklopediMaddeleri.length, 300, 'restore cannot exceed the 300 active-article cap');
assert.equal(world.ansiklopediSilinenMaddeler[0].id, 'restore-at-limit', 'a blocked restore keeps the deleted record in the recoverable trash');
assert.ok(window.document.querySelector('[data-eaw-status]').textContent.includes('300 etkin madde sınırı'), 'restore-cap failure is visible to the author');
window.close();
publicationDom.window.close();
console.log('6.6.3 universe encyclopedia tests passed (eight categories, compatibility sanitization, Wiki navigation, search, URLs, privacy, sources, revisions and publication checks).');
