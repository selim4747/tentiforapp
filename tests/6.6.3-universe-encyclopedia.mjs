import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync('js/engine/45-evrengezer.js', 'utf8');
const moduleSource = fs.readFileSync('js/engine/104-evren-ansiklopedi.js', 'utf8');
const builder = fs.readFileSync('scripts/paketle.mjs', 'utf8');
const bundle = fs.readFileSync('js/paket-3.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const runner = fs.readFileSync('scripts/test.mjs', 'utf8');

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

const imageSanitizer = extractFunction(source, 'function evrenVarlikGorselTemizle(a)');
const wikiSanitizer = extractFunction(source, 'function evrenAnsiklopediTemizle(a)');
const sanitized = vm.runInNewContext(`${imageSanitizer}\n${wikiSanitizer}\nevrenAnsiklopediTemizle(input)`, {
  fanMetin(value, max) { return String(value == null ? '' : value).slice(0, max); },
  input: [
    { id: 'plant-1', tur: 'bitki', baslik: '  Ay çiçeği  ', ozet: 'Kısa tanıtım', etiketler: ['Gece', 'Gece', '<script>'], ilgiliIds: ['animal-1'], durum: 'yayinda', gorsel: { id: 'asset-1', tur: 'varlik', kaynak: 'indexeddb' }, ozellikler: { habitat: 'kıyı', ignored: '<script>' } },
    { id: 'plant-1', tur: 'hayvan', baslik: 'duplicate id' },
    { id: 'bad-type', tur: 'dragon', baslik: 'Invalid type' },
    null,
    { id: 'draft-1', tur: 'hayvan', baslik: '', durum: 'bad', spoiler: true }
  ]
});
assert.equal(sanitized.length, 2, 'duplicate IDs, unknown types and invalid records are removed');
assert.equal(sanitized[0].baslik, 'Ay çiçeği', 'article title is trimmed');
assert.deepEqual(Array.from(sanitized[0].etiketler), ['Gece', '<script>'], 'tags are deduplicated without turning plain text into markup');
assert.equal(sanitized[0].ozellikler.ignored, undefined, 'unknown structured fields are removed');
assert.equal(sanitized[0].gorsel.kaynak, 'indexeddb', 'approved local image metadata is retained');
assert.equal(sanitized[1].durum, 'taslak', 'invalid status defaults to private draft');
assert.equal(JSON.stringify(sanitized).includes('https://'), false, 'no arbitrary remote URL is introduced');

const world = {
  id: 'wiki-test', ad: 'Test Evreni',
  ansiklopediMaddeleri: [
    { id: 'plant-1', tur: 'bitki', baslik: 'Ay çiçeği', ozet: 'Geceleri açan bir bitki.', aciklama: 'Göl kenarlarında yetişir.', habitat: 'Gümüş Göl', etiketler: ['gece', 'bitki'], durum: 'yayinda', spoiler: true, ozellikler: { ekolojikRol: 'Gölü arındırır.' }, ilgiliIds: ['animal-1'] },
    { id: 'animal-1', tur: 'hayvan', baslik: 'Göl tilkisi', ozet: 'Küçük bir gece avcısı.', aciklama: 'Ay çiçeğinin tohumlarını taşır.', habitat: 'Gümüş Göl', etiketler: ['gece', 'hayvan'], durum: 'yayinda', ilgiliIds: ['plant-1'] },
    { id: 'draft-1', tur: 'bitki', baslik: 'Gizli taslak', ozet: 'Henüz yayımlanmadı.', durum: 'taslak' }
  ]
};
const dom = new JSDOM('<!doctype html><html lang="tr"><head></head><body></body></html>', { runScripts: 'outside-only', url: 'https://tentifor.test/' });
const { window } = dom;
window.kacir = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
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
assert.ok(window.evrenEkSekmeler(publicPage).some((tab) => tab[0] === 'ansiklopedi'), 'reader tab is shown when published articles exist');
let publicMarkup = window.evrenEkBolum(publicPage);
assert.ok(publicMarkup.includes('Ay çiçeği') && publicMarkup.includes('Göl tilkisi'), 'published articles render in the public index');
assert.ok(!publicMarkup.includes('Gizli taslak'), 'draft articles are hidden from readers');

window.document.body.innerHTML = publicMarkup;
const search = window.document.querySelector('[data-eaw-search]');
search.value = 'tilki';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(window.document.querySelector('[data-eaw-card][data-category="bitki"]').hidden, true, 'search filters non-matching cards');
assert.equal(window.document.querySelector('[data-eaw-card][data-category="hayvan"]').hidden, false, 'search keeps matching cards visible');
search.value = '';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
window.document.querySelector('[data-eaw-open="plant-1"]').click();
assert.ok(window.document.querySelector('.eaw-article').textContent.includes('Ay çiçeği'), 'reader can open an article detail');
assert.ok(window.document.querySelector('.eaw-article details summary').textContent.includes('Spoiler'), 'spoiler body is hidden behind an explicit disclosure');
window.document.querySelector('[data-eaw-article-not-used]')?.click();
const relatedLink = window.document.querySelector('.eaw-related [data-eaw-open="animal-1"]');
assert.ok(relatedLink, 'article IDs produce cross-links to related entries');
relatedLink.click();
assert.ok(window.document.querySelector('.eaw-article').textContent.includes('Göl tilkisi'), 'related link opens the target article');

window.eval('EVS.kaynak = "benim"; EVS.sekme = "ansiklopedi";');
const ownerPage = { eser: world, kaynak: 'benim' };
assert.ok(window.evrenEkSekmeler(ownerPage).some((tab) => tab[0] === 'ansiklopedi'), 'owner tab is available for a blank/new universe');
assert.ok(window.evrKurucuHtml(ownerPage).includes('data-evs-sekme="ansiklopedi"'), 'the multi-step creator links to the encyclopedia editor');
window.document.body.innerHTML = window.evrenEkBolum(ownerPage);
assert.ok(window.document.querySelector('[data-eaw-new]'), 'owner editor offers new encyclopedia entries');
window.document.querySelector('[data-eaw-new]').click();
assert.ok(world.ansiklopediMaddeleri.some((entry) => entry.durum === 'taslak' && entry.tur === 'bitki'), 'new articles begin as private drafts');
const newEntry = world.ansiklopediMaddeleri.find((entry) => entry.durum === 'taslak' && entry.tur === 'bitki');
const title = window.document.querySelector(`[data-eaw-field="${newEntry.id}:baslik"]`);
title.value = 'Yeni Bitki';
title.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.equal(newEntry.baslik, 'Yeni Bitki', 'owner editor persists changes to the custom-world data record');

assert.ok(builder.includes("'function evrenAnsiklopediTemizle(a)'"), 'build script synchronizes the new sanitizer into paket-3');
assert.ok(bundle.includes('function evrenAnsiklopediTemizle(a)'), 'served bundle contains the encyclopedia sanitizer');
assert.ok(index.includes('js/engine/104-evren-ansiklopedi.js'), 'app shell loads the encyclopedia editor');
assert.ok(runner.includes('tests/6.6.3-universe-encyclopedia.mjs'), 'unit regression is registered in the full test runner');
window.close();
console.log('6.6.3 universe encyclopedia tests passed (sanitization, draft privacy, search, article links and owner editing).');
