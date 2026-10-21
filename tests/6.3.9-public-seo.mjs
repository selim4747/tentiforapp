import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { approvedCanonicalUniversePages, buildSitemap, fetchPublicSeoPages, renderNoindexAppRoute, renderSeoNotFound, renderSeoPage, renderStandaloneAdminPage, seoMetadata, writeSeoRoutes } from '../scripts/public-seo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migrationPath = 'supabase/migrations/20261005_visual_universe_map_timeline_639_seo_cards.sql';
const migration = read(migrationPath);
const setup = read('supabase/kurulum.sql');
const client = read('js/engine/seo-meta.js');
const routeSource = read('js/core/00-rota.js');
const routeBundle = read('js/paket-1.js');
const buildScript = read('scripts/paketle.mjs');
const archiveCore = read('js/core/24-arsiv-mantigi.js');
const onboardingModule = read('js/arsiv/14-rol-yolu-mektuplar.js');
const redirects = read('_redirects');
const index = read('index.html');
const sw = read('sw.js');
const packageJson = JSON.parse(read('package.json'));

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
const setupVersion = setup.match(/create or replace function public\.kurulum_surumu\b[\s\S]*?select '([^']+)'::text/)?.[1];
const setupTarget = read('js/paket-4.js').match(/const KURULUM_BEKLENEN="([^"]+)"/)?.[1];
assert.ok(setupVersion && setupTarget, 'backend schema sürümü okunabilmeli');
assert.equal(setupTarget, setupVersion, 'admin beklenen schema sürümü Supabase kurulum sürümüyle eşleşmeli');
assert.match(migration, /select '6\.3\.9'::text/);

assert.match(client, /addEventListener\('hashchange', handleRoute\)/);
assert.match(client, /addEventListener\('popstate', handleRoute\)/);
assert.match(client, /public_seo_sayfa/);
assert.match(client, /approvedCanonicalUniverse/);
assert.match(client, /noindex, follow/);
assert.match(client, /function showPublicLoadError/);
assert.match(client, /data-public-seo-error/);
assert.match(client, /retry\.addEventListener\('click'/);
assert.match(routeSource, /ilk === 'yonetici' \|\| ilk === 'yönetici'/, 'ASCII and Turkish admin path names resolve to the dedicated app route');
assert.match(routeSource, /return '\/yonetici\/'/, 'SPA admin navigation canonicalizes to the ASCII URL');
assert.match(routeSource, /DOMContentLoaded[\s\S]*window\.sayfaYonlendir/, 'direct admin entry overrides a previously saved Sen page');
assert.match(routeBundle, /ilk === 'yonetici' \|\| ilk === 'yönetici'/, 'the served bundle must resolve the dedicated ASCII admin route');
assert.match(routeBundle, /const ROTA_KISISEL =/);
assert.match(routeBundle, /yonetici\(\?:\\\/\|\$\)/, 'the served bundle treats admin as a private noindex route');
assert.match(routeBundle, /yonetici: \['Yönetici paneli — TentiFor'/, 'the served bundle keeps admin route metadata in sync');
assert.match(routeBundle, /DOMContentLoaded[\s\S]*window\.sayfaYonlendir/, 'the served bundle boots the direct admin route on first load');
assert.match(routeBundle, /id:"yonetici",ad:"Yönetici"/, 'the served navigation recognizes admin as its own page');
assert.match(routeBundle, /SAYFA_GIZLI_BOLUMLER=\{\}/, 'admin is not registered as hidden Sen content');
assert.match(routeBundle, /turGerekli\(\)\{return !document\.documentElement\.hasAttribute\("data-standalone-admin"\)/, 'the first-visit tour is disabled only for the standalone admin shell');
assert.match(onboardingModule, /turGerekli\(\)\{return !document\.documentElement\.hasAttribute\("data-standalone-admin"\)/);
assert.match(archiveCore, /a\.length&&!document\.documentElement\.hasAttribute\("data-standalone-admin"\)/, 'missing main-page sections do not produce a misleading admin-page diagnostic');
const moderationPrivacyRule = 'ROTA_KISISEL=/^#\\/(moderasyon(?:\\/|$)|sen|';
assert.ok(routeSource.replace(/\s+/g, '').includes(moderationPrivacyRule), 'moderation is a private noindex app route');
assert.ok(routeBundle.replace(/\s+/g, '').includes(moderationPrivacyRule), 'served route bundle matches the privacy rule in source');
assert.doesNotMatch(client, /\.innerHTML\s*=/, 'untrusted public profile/world text must be rendered with textContent/attributes, never HTML parsing');
assert.match(index, /js\/engine\/seo-meta\.js/);
assert.match(index, /id="tfAppBootStatus"[^>]*role="alert"/);
assert.match(index, /__TF_APP_BOOT_TIMEOUT_MS/);
assert.doesNotMatch(index, /id="yonetici"/, 'the public/Sen application shell must not contain the admin panel');
assert.match(sw, /js\/engine\/seo-meta\.js/);
assert.match(buildScript, /publicSeoPages/);
assert.match(redirects, /^\/yonetici\s+\/yonetici\/\s+301$/m, 'the extensionless admin path redirects to the dedicated ASCII URL');
assert.doesNotMatch(redirects, /^\/yonetici\/\s+\/index\.html\s+200$/m, 'the admin URL must not rewrite to the home/Sen application');

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
assert.equal(seoMetadata({ tur: 'sayfa', path: '/yonetici/', title: 'Yönetici paneli' }), null, 'the private admin page is not treated as public SEO content');

const approvedLocalUniverses = approvedCanonicalUniversePages(root, JSON.parse(read('veri.json')));
const e126 = approvedLocalUniverses.find((item) => item.slug === 'e126');
assert.ok(e126, 'the explicitly approved E126 file should have a local SEO route');
assert.equal(e126.baslik, 'E126');
assert.match(buildSitemap([e126]), /https:\/\/tentifor\.com\/evren\/e126\//);
assert.match(renderSeoPage(shell, e126), /<link rel="canonical" href="https:\/\/tentifor\.com\/evren\/e126\/">/);

const notFound = renderSeoNotFound(shell);
assert.match(notFound, /<base href="\/">/);
assert.match(notFound, /<meta name="robots" content="noindex, follow">/);
assert.match(notFound, /<h1>Sayfa bulunamadı<\/h1>/);
const moderationShell = renderNoindexAppRoute(shell, { path: '/moderasyon/', title: 'Moderasyon — TentiFor', description: 'Moderatör erişimi gerekir.' });
assert.match(moderationShell, /<base href="\/">/);
assert.match(moderationShell, /<meta name="robots" content="noindex, follow">/);
assert.match(moderationShell, /<link rel="canonical" href="https:\/\/tentifor\.com\/moderasyon\/">/);
assert.doesNotMatch(moderationShell, /data-seo-not-found|data-seo-fallback|Sayfa bulunamadı/);
assert.match(moderationShell, /<main id="tepe"><h2>App<\/h2><\/main>/, 'private moderation route keeps the app background visible');
assert.throws(() => renderNoindexAppRoute(shell, { path: '/../secrets/' }), /Güvenli olmayan uygulama rotası/);
const senShell = renderNoindexAppRoute(index, { path: '/sen/', title: 'Sen — TentiFor' });
assert.doesNotMatch(senShell, /id="yonetici"/, 'the Sen page no longer carries the admin panel DOM');
const standaloneAdmin = renderStandaloneAdminPage(index);
const standaloneMain = standaloneAdmin.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] || '';
assert.match(standaloneAdmin, /<title>Yönetici paneli — TentiFor<\/title>/);
assert.match(standaloneAdmin, /<link rel="canonical" href="https:\/\/tentifor\.com\/yonetici\/">/);
assert.match(standaloneAdmin, /<meta name="robots" content="noindex, follow">/);
assert.match(standaloneAdmin, /<html[^>]*data-standalone-admin="true"/);
assert.equal((standaloneMain.match(/<section\b/g) || []).length, 1, 'the dedicated admin page renders only the panel section');
assert.match(standaloneMain, /id="yoneticiAlan"/);
assert.doesNotMatch(standaloneMain, /id="sen"|id="arsiv"|id="bag"/);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tentifor-seo-test-'));
try {
  const fixtureRoot = path.join(temp, 'fixture');
  fs.mkdirSync(path.join(fixtureRoot, 'evrenler'), { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, 'evrenler/e126.json'), JSON.stringify({ tur: 'evren', id: 'e126', ad: 'E126', ozet: 'Onaylı evren' }));
  fs.writeFileSync(path.join(fixtureRoot, 'evrenler/e127.json'), JSON.stringify({ tur: 'evren', id: 'e127', ad: 'E127' }));
  const fixturePages = approvedCanonicalUniversePages(fixtureRoot, { fanEserleri: { evrenler: [
    { tur: 'evren', id: 'e126', kanon: true, dosya: 'evrenler/e126.json' },
    { tur: 'evren', id: 'e127', kanon: false, dosya: 'evrenler/e127.json' },
    { tur: 'evren', id: 'e128', kanon: true, dosya: '../e128.json' }
  ] } });
  assert.deepEqual(fixturePages.map((item) => item.slug), ['e126'], 'unapproved and traversal records must never be emitted');
  const written = writeSeoRoutes({ indexHtml: shell, distDir: temp, items: [profile, hostile, turkishWorld, { tur: 'okuma', id: 'bad-id' }], staticPages: [{ tur: 'sayfa', path: '/fan/', title: 'Fan', description: 'Public fan route' }], appRoutes: [{ path: '/moderasyon/', title: 'Moderasyon — TentiFor' }] });
  assert.equal(written, 4, 'only validated public routes are written');
  assert.ok(fs.existsSync(path.join(temp, 'u/selim_test/index.html')));
  assert.ok(fs.existsSync(path.join(temp, 'evren/safe-world/index.html')));
  assert.ok(fs.existsSync(path.join(temp, 'evren/ışık-evren/index.html')));
  assert.ok(fs.existsSync(path.join(temp, 'fan/index.html')));
  const moderationFile = fs.readFileSync(path.join(temp, 'moderasyon/index.html'), 'utf8');
  assert.ok(fs.existsSync(path.join(temp, 'moderasyon.html')), 'the extensionless Cloudflare Pages path gets an app shell too');
  assert.match(moderationFile, /noindex, follow/);
  assert.doesNotMatch(moderationFile, /data-seo-not-found|Sayfa bulunamadı/);
  assert.doesNotMatch(fs.readFileSync(path.join(temp, 'sitemap.xml'), 'utf8'), /moderasyon/);
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
