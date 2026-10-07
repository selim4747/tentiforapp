import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSitemap, fetchPublicSeoPages, renderSeoNotFound, renderSeoPage, seoMetadata, writeSeoRoutes } from '../scripts/public-seo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migrationPath = 'supabase/migrations/20261005_visual_universe_map_timeline_639_seo_cards.sql';
const migration = read(migrationPath);
const setup = read('supabase/kurulum.sql');
const client = read('js/engine/seo-meta.js');
const buildScript = read('scripts/paketle.mjs');
const index = read('index.html');
const sw = read('sw.js');

assert.match(migration, /create or replace function public\.public_seo_sayfa\(p_tur text, p_id text\) returns jsonb/);
assert.match(migration, /create or replace function public\.public_seo_sayfalar\(p_tur text, p_limit int default 100, p_offset int default 0\) returns jsonb/);
assert.equal((migration.match(/security definer set search_path = ''/g) || []).length, 3, 'both public RPCs and the version marker use SECURITY DEFINER with an empty search_path');
assert.match(migration, /revoke all on function public\.public_seo_sayfa\(text,text\) from public;\s*grant execute on function public\.public_seo_sayfa\(text,text\) to anon, authenticated;/);
assert.match(migration, /revoke all on function public\.public_seo_sayfalar\(text,int,int\) from public;\s*grant execute on function public\.public_seo_sayfalar\(text,int,int\) to anon, authenticated;/);
assert.doesNotMatch(migration, /create table|alter table|grant\s+select\s+on/i, 'SEO does not broaden table access or add data tables');
assert.match(migration, /p\.profil_arama_gorunur,true\)/, 'profile must be discoverable before it can be indexed');
assert.match(migration, /\[\[:alnum:\]\]/, 'published-world slugs support locale-aware Unicode letters and digits');
assert.match(migration, /'hakkinda',case when coalesce\(p\.profil_icerik_gorunur,true\) then left\(coalesce\(p\.hakkinda,''\),280\) else '' end/, 'private profile content must not expose biography');
assert.match(migration, /from public\.yayindaki_evrenler y/, 'universe SEO data comes from published-world rows');
assert.match(migration, /where y\.id=p_id::uuid and y\.public_mu/, 'reading path must be explicitly public');
assert.match(migration, /left\(a\.baslik,160\)/, 'reading path response caps step text');
assert.match(migration, /least\(coalesce\(p_limit,100\),100\)/, 'manifest pagination is bounded to 100 rows');
assert.match(migration, /least\(coalesce\(p_offset,0\),1000000\)/, 'manifest offset is bounded');
const canonicalDefinitions = migration.split('-- This is the current-installation marker;')[0].trim();
assert.ok(setup.includes(canonicalDefinitions), 'canonical setup must contain the exact 6.3.9 public SEO RPC definitions');
assert.equal((setup.match(/create or replace function public\.kurulum_surumu\b/g) || []).length, 1, 'canonical setup keeps a single install-version marker');
assert.match(setup, /select '6\.3\.13'::text/);
assert.match(migration, /select '6\.3\.9'::text/);

assert.match(client, /addEventListener\('hashchange', handleRoute\)/);
assert.match(client, /addEventListener\('popstate', handleRoute\)/);
assert.match(client, /public_seo_sayfa/);
assert.match(client, /noindex, follow/);
assert.doesNotMatch(client, /\.innerHTML\s*=/, 'untrusted public profile/world text must be rendered with textContent/attributes, never HTML parsing');
assert.match(index, /js\/engine\/seo-meta\.js/);
assert.match(sw, /js\/engine\/seo-meta\.js/);
assert.match(buildScript, /publicSeoPages/);

const shell = '<!doctype html><html><head><title>Home</title><meta name="description" content="Home"><meta name="robots" content="index, follow"><meta property="og:url" content="https://example.test/"><link rel="canonical" href="https://example.test/"></head><body><main id="tepe"><h2>App</h2></main></body></html>';
const hostile = { tur: 'evren', slug: 'safe-world', baslik: '<script>alert(1)</script> & "quote"', ozet: '<img src=x onerror=alert(1)>', yazar_adi: 'Yazar <svg onload=alert(1)>' };
const meta = seoMetadata(hostile);
assert.equal(meta.route, '/evren/safe-world/');
const page = renderSeoPage(shell, hostile);
assert.match(page, /<title>.*&lt;script&gt;.*<\/title>/);
assert.match(page, /<meta property="og:url" content="https:\/\/tentifor\.com\/evren\/safe-world\/">/);
assert.match(page, /<meta property="og:image" content="https:\/\/tentifor\.com\/paylasim\.png">/);
assert.match(page, /<meta name="twitter:card" content="summary_large_image">/);
assert.match(page, /<article class="tf639-seo-fallback"/);
assert.match(page, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(page, /<img src=x onerror=alert\(1\)>/);
assert.match(page, /<main id="tepe" hidden data-seo-route-background>/);
assert.equal(seoMetadata({ tur: 'profil', kullanici_adi: '../private' }), null, 'unsafe route identifiers must be omitted');
const turkishWorld = { tur: 'evren', slug: 'IŞIK-evren', baslik: 'Işık Evreni', ozet: 'Türkçe özet' };
assert.equal(seoMetadata(turkishWorld).route, '/evren/%C4%B1%C5%9F%C4%B1k-evren/');

const profile = { tur: 'profil', kullanici_adi: 'selim_test', gorunen_ad: 'Selim', hakkinda: 'Public bio', evrenler: [{ slug: 'safe-world', baslik: 'Safe World', ozet: 'Published' }] };
assert.equal(seoMetadata(profile).route, '/u/selim_test/');
const privateContentProfile = { tur: 'profil', kullanici_adi: 'selim_private', gorunen_ad: 'Selim Private', hakkinda: 'SECRET BIO', icerik_gorunur: false, evrenler: [{ slug: 'secret-world', baslik: 'Secret World' }] };
assert.doesNotMatch(seoMetadata(privateContentProfile).description, /SECRET BIO|yayınlanmış evrenler/i);
assert.doesNotMatch(renderSeoPage(shell, privateContentProfile), /SECRET BIO|secret-world/i);
const sitemap = buildSitemap([profile, hostile, turkishWorld, { tur: 'profil', kullanici_adi: 'bad/route' }], ['/']);
assert.match(sitemap, /\/u\/selim_test\//);
assert.match(sitemap, /\/evren\/safe-world\//);
assert.match(sitemap, /\/evren\/%C4%B1%C5%9F%C4%B1k-evren\//);
assert.doesNotMatch(sitemap, /bad\/route/);
assert.doesNotMatch(sitemap, /\/sen\/|\/admin\/|draft/i);

const notFound = renderSeoNotFound(shell);
assert.match(notFound, /<base href="\/">/);
assert.match(notFound, /<meta name="robots" content="noindex, follow">/);
assert.match(notFound, /<h1>Sayfa bulunamadı<\/h1>/);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tentifor-seo-test-'));
try {
  const written = writeSeoRoutes({ indexHtml: shell, distDir: temp, items: [profile, hostile, turkishWorld, { tur: 'okuma', id: 'bad-id' }], staticPages: [{ tur: 'sayfa', path: '/fan/', title: 'Fan', description: 'Public fan route' }] });
  assert.equal(written, 4, 'only validated public routes are written');
  assert.ok(fs.existsSync(path.join(temp, 'u/selim_test/index.html')));
  assert.ok(fs.existsSync(path.join(temp, 'evren/safe-world/index.html')));
  assert.ok(fs.existsSync(path.join(temp, 'evren/ışık-evren/index.html')));
  assert.ok(fs.existsSync(path.join(temp, 'fan/index.html')));
  assert.doesNotMatch(fs.readFileSync(path.join(temp, 'sitemap.xml'), 'utf8'), /bad-id/);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }

const requested = [];
const emptyPages = await fetchPublicSeoPages(root, {
  config: { url: 'https://public-config.example', apiKey: 'public-test-key' },
  fetchImpl: async (url, options) => {
    requested.push({ url, body: JSON.parse(options.body), method: options.method });
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }
});
assert.equal(emptyPages.length, 0);
assert.equal(requested.length, 3);
assert.deepEqual(requested.map((item) => item.body.p_tur), ['profil', 'evren', 'okuma']);
assert.ok(requested.every((item) => item.method === 'POST' && item.body.p_limit === 100 && item.body.p_offset === 0));

console.log('6.3.9 public SEO: PASS (privacy-gated RPCs, canonical mirror, XSS-safe static pages, whitelisted sitemap, noindex 404, route metadata and safe public-card inputs)');
