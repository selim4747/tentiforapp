import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { approvedCanonicalUniversePages, buildSitemap, renderSeoPage, writeSeoRoutes } from '../scripts/public-seo.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tentifor-642-seo-'));
fs.mkdirSync(path.join(root, 'evrenler'), { recursive: true });
fs.writeFileSync(path.join(root, 'evrenler', 'ışık-evren.json'), JSON.stringify({ tur: 'evren', id: 'ışık-evren', ad: 'Işık Evreni', ozet: 'Yeni public evren.' }));
fs.writeFileSync(path.join(root, 'evrenler', 'taslak-evren.json'), JSON.stringify({ tur: 'evren', id: 'taslak-evren', ad: 'Taslak' }));

const source = {
  fanEserleri: { evrenler: [
    { tur: 'evren', id: 'ışık-evren', public_mu: true, dosya: 'evrenler/ışık-evren.json', ad: 'Işık Evreni' },
    { tur: 'evren', id: 'taslak-evren', test: true, dosya: 'evrenler/taslak-evren.json' },
    { tur: 'evren', id: '../gizli', public_mu: true, dosya: 'evrenler/../gizli.json' },
    { tur: 'evren', id: 'kopya-evren', public_mu: true, dosya: 'evrenler/başka.json' }
  ] }
};
const pages = approvedCanonicalUniversePages(root, source);
assert.equal(pages.length, 1, 'yalnızca açıkça public ve güvenli yerel evren indexlenmeli');
assert.equal(pages[0].slug, 'ışık-evren');
assert.equal(pages[0].yazar_adi, 'TentiFor');

const sitemap = buildSitemap(pages, ['/']);
assert.match(sitemap, /\/evren\/%C4%B1%C5%9F%C4%B1k-evren\//);
assert.doesNotMatch(sitemap, /taslak|gizli|kopya/);

const dist = path.join(root, 'dist');
const shell = '<!doctype html><html><head><title>TentiFor</title><meta name="description" content=""></head><body><main id="tepe" hidden data-seo-route-background></main></body></html>';
assert.equal(writeSeoRoutes({ indexHtml: shell, distDir: dist, items: pages }), 1);
assert.ok(fs.existsSync(path.join(dist, 'evren', 'ışık-evren', 'index.html')));
assert.ok(fs.existsSync(path.join(dist, 'evren', 'ışık-evren.html')));
assert.ok(fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8').includes('%C4% B1% C5% 9F%C4%B1k-evren'.replaceAll(' ', '')));
assert.match(renderSeoPage(shell, pages[0]), /Işık Evreni/);
console.log('6.4.2 universe indexing: PASS (public registry discovery, safe slugs, static routes and sitemap)');
