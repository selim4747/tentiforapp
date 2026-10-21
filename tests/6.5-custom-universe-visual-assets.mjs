import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = process.cwd();
const source = fs.readFileSync(`${root}/js/engine/45-evrengezer.js`, 'utf8');
const bundle = fs.readFileSync(`${root}/js/paket-3.js`, 'utf8');
const moduleSource = fs.readFileSync(`${root}/js/engine/103-evren-ozel-varliklar.js`, 'utf8');
const index = fs.readFileSync(`${root}/index.html`, 'utf8');
const builder = fs.readFileSync(`${root}/scripts/paketle.mjs`, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(`${root}/package.json`, 'utf8'));

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

const metaFn = extractFunction(source, 'function evrenVarlikGorselTemizle(a)');
const listFn = extractFunction(source, 'function evrenVarliklarTemizle(a)');
const context = {
  fanMetin(value, max) { return String(value == null ? '' : value).slice(0, max); }
};
const sanitized = vm.runInNewContext(`${metaFn}\n${listFn}\nevrenVarliklarTemizle(input)`, {
  ...context,
  input: [
    { id: 'item-1', tur: 'esya', baslik: '<Moon>', aciklama: 'Safe & sound', fiyat: 99, gorsel: { id: 'img_1', tur: 'varlik', kaynak: 'indexeddb', mime: 'image/png', yukseklik: 1 } },
    { id: 'drawing-1', tur: 'cizim', baslik: 'Free art', fiyat: -4 },
    { id: 'drawing-1', tur: 'bina', baslik: 'duplicate id' },
    { id: 'remote', tur: 'bina', gorsel: { id: 'remote-image', tur: 'varlik', kaynak: 'https://unsafe.example/image.png' } },
    { id: 'invalid', tur: 'unknown', baslik: 'Invalid type' }
  ]
});
assert.equal(sanitized.length, 3, 'valid asset types persist while duplicate IDs and unknown types are dropped');
assert.equal(sanitized[0].baslik, '<Moon>', 'text remains data and is HTML-escaped by the renderer');
assert.equal(sanitized[0].fiyat, 0, 'item/building prices are not accidentally treated as drawing purchases');
assert.equal(sanitized[0].gorsel.kaynak, 'indexeddb', 'only same-profile IndexedDB image metadata is accepted');
assert.equal(sanitized[1].fiyat, 0, 'negative drawing price is clamped to free in persisted data');
assert.equal(sanitized[2].gorsel, undefined, 'an otherwise valid record remains, but its unsafe remote image metadata is removed');
assert.equal(JSON.stringify(sanitized).includes('unsafe.example'), false, 'an unsafe remote image URL never survives sanitization');

const sourceSanitizer = extractFunction(source, 'function evrenEkTemizle(a,e)');
assert.ok(bundle.includes('function evrenVarlikGorselTemizle(a)'), 'build synchronizes the image metadata sanitizer into the served bundle');
assert.ok(bundle.includes('function evrenVarliklarTemizle(a)'), 'build synchronizes the custom item/drawing sanitizer into the served bundle');
assert.equal(extractFunction(bundle, 'function evrenEkTemizle(a,e)'), sourceSanitizer, 'served bundle and source sanitizer must match byte-for-byte');
assert.ok(builder.includes("'function evrenVarliklarTemizle(a)'"), 'build script enforces bundle synchronization');
assert.ok(index.includes('js/engine/103-evren-ozel-varliklar.js'), 'user-facing visual editor is loaded by the app shell');
assert.ok(moduleSource.includes('data-eva-varlik-yeni="esya"') && moduleSource.includes('data-eva-varlik-yeni="bina"') && moduleSource.includes('data-eva-varlik-yeni="cizim"'), 'editor exposes item, building and artwork creation');
assert.ok(moduleSource.includes('data-eva-portre='), 'editor supports custom-character portraits');
assert.ok(moduleSource.includes('Görsel içeriğini dışa aktar') && moduleSource.includes('Görsel içeriğini içe aktar'), 'visual assets have an explicit portable backup/restore path');
assert.equal(packageJson.scripts['test:universe-visual-browser'], 'node tests/universe-visual-playwright.mjs');

console.log('Custom universe visual-asset contract: PASS (safe metadata, persisted portraits/records, build sync and portable backups).');
