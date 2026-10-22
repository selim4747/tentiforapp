import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const data = JSON.parse(fs.readFileSync('veri.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const originalLayers = data.kanonEvrenleri?.e24?.katmanlar;

assert.equal(pkg.version, '6.6.2', 'package version must be 6.6.2');
assert.equal(data.surum, '6.6.2', 'published app data version must match package version');
assert.equal(Object.hasOwn(data, 'katmanlar'), false, 'the legacy global ice-layer catalog must be removed');
assert.equal(data.kanonEvrenleri.e24.id, 'e24');
assert.equal(data.kanonEvrenleri.e24.ad, 'E24');
assert.equal(data.kanonEvrenleri.e24.yerler[0].ad, 'Tömye', 'Tömye remains a place inside E24');
assert.equal(data.kanonEvrenleri.e25.id, 'e25', 'E25 remains a separate universe');
assert.equal(originalLayers.length, 7, 'all seven archive layers must move into E24');
assert.equal(new Set(originalLayers.map((layer) => layer.id)).size, 7, 'layer IDs must remain unique');
assert.equal(new Set(originalLayers.map((layer) => layer.dogrulama)).size, 7, 'layer verification keys must remain unique');
assert.ok(originalLayers.every((layer) => layer.id && layer.dogrulama), 'layer IDs and verification keys must be preserved');

const archiveCore = fs.readFileSync('js/core/24-arsiv-mantigi.js', 'utf8');
assert.match(archiveCore, /function evrenKatmanlari\(\)/, 'runtime must read E24-owned layers through one accessor');
assert.match(archiveCore, /veri\.kanonEvrenleri&&veri\.kanonEvrenleri\.e24&&veri\.kanonEvrenleri\.e24\.katmanlar/);
assert.doesNotMatch(archiveCore, /e\.size-acikSayisi\(\)/, 'homepage ice-layer progress must not use the total-key count as unlocked layers');
const onboarding = fs.readFileSync('js/arsiv/62-ilk-deneyim.js', 'utf8');
assert.match(onboarding, /E24 arşivinin %/);
assert.match(onboarding, /E24 buz katmanı/);

const source = fs.readFileSync('js/engine/85-e25-ana-sayfa-evrenler.js', 'utf8');
const start = source.indexOf('let anaSayfaRastgeleEvren=null;');
const end = source.indexOf('function anaEvrenlerCiz()', start);
assert.ok(start >= 0 && end > start, 'the homepage per-visit random selection helper must exist');
const homepageBundle = fs.readFileSync('js/paket-4.js', 'utf8');
assert.match(homepageBundle, /function anaSayfaRastgeleEvrenCiz\(\)/, 'the selector helper must be packaged for production');
assert.match(homepageBundle, /dugme\.dataset\.rastgeleEvren=anaSayfaRastgeleEvren\.id/, 'the selected universe must be recorded on the CTA');
assert.ok((homepageBundle.match(/anaSayfaRastgeleEvrenCiz\(\)/g) || []).length >= 2, 'the homepage renderer must invoke the packaged per-visit selector');
const helperDom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
helperDom.window.eval(source.slice(start, end));
const choose = helperDom.window.tfRastgeleGenisEvren;
assert.equal(typeof choose, 'function');
assert.equal(choose(data, () => 0)?.id, 'e24', 'the rich-universe pool should include E24');
assert.equal(choose(data, () => 0.999)?.id, 'ax24', 'the rich-universe pool should include Ax-24');
assert.notEqual(choose(data, () => 0.999)?.id, 'e25', 'E25 must never be selected for the homepage action');
const fallbackSource = { kanonEvrenleri: {
  oneArea: { id: 'oneArea', kurallar: ['a', 'b', 'c'] },
  threeAreas: { id: 'threeAreas', kurallar: ['a'], kisiler: ['b'], yerler: ['c'] },
} };
assert.equal(choose(fallbackSource, () => 0)?.id, 'threeAreas', 'fallback must count distinct non-empty areas, not records within one area');
helperDom.window.close();

const routeDom = new JSDOM('<!doctype html><html><head><meta name="robots"></head><body></body></html>', {
  url: 'https://tentifor.test/', runScripts: 'outside-only'
});
routeDom.window.eval(fs.readFileSync('js/core/00-rota.js', 'utf8'));
for (const slug of ['e24', 'ax24']) {
  assert.equal(routeDom.window.rotadanYol(`#/ev/site/${slug}`), `/evren/${slug}/`, `${slug} must have a stable clean route`);
  assert.equal(routeDom.window.yoldanRota(`/evren/${slug}/`), `#/ev/site/${slug}`, `${slug} clean routes must resolve to the canonical site universe`);
}
routeDom.window.close();

const packager = fs.readFileSync('scripts/paketle.mjs', 'utf8');
assert.match(packager, /slug: 'e24'/, 'E24 must be a generated public SEO route');
assert.match(packager, /slug: 'ax24'/, 'Ax-24 must be a generated public SEO route for random discovery');
const home = fs.readFileSync('index.html', 'utf8');
assert.match(home, /id="rastgeleEvrenHero"/);
assert.match(home, /E24 · Tömye · kanon/);
assert.doesNotMatch(home, /Tömye haritasını keşfet/, 'the old single-destination hero CTA must be removed');
const rumMock = fs.readFileSync('tests/helpers/cloudflare-rum-mock.mjs', 'utf8');
const mobileSource = fs.readFileSync('tests/mobile-ui-overflow-playwright.mjs', 'utf8');
assert.match(rumMock, /static\.cloudflareinsights\.com/,'mobile browser tests must provide a Cloudflare beacon mock');
assert.match(mobileSource, /mockCloudflareRum\(page\.context\(\)\)/, 'mobile browser tests must install the shared Cloudflare RUM mock');

console.log('6.6.2 E24 migration and mobile regression contracts: PASS');
