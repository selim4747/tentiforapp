import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20261005_visual_universe_map_timeline_639_seo_cards_6310_secure_sharing.sql', 'utf8');
const setup = fs.readFileSync('supabase/kurulum.sql', 'utf8');
const client = fs.readFileSync('js/engine/secure-sharing.js', 'utf8');
const seoClient = fs.readFileSync('js/engine/seo-meta.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const gradle = fs.readFileSync('uygulama/kabuk/android/app/build.gradle', 'utf8');
const nativeWrapper = fs.readFileSync('js/admin/74-yonetim-kurulum.js', 'utf8');
const androidPackage = JSON.parse(fs.readFileSync('uygulama/kabuk/package.json', 'utf8'));

for (const table of ['paylasim_baglantilari', 'paylasim_olay_ozetleri']) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}\\b`), `${table} table is required`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} must use RLS`);
  assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`), `${table} must not be directly readable/writable`);
}
assert.match(migration, /id uuid primary key default gen_random_uuid\(\)/, 'share token id must be random UUID, not an enumerable sequence');
assert.match(migration, /tur in \('profil','evren','okuma'\)/, 'only known public content types may be shared');
assert.match(migration, /bitis timestamptz not null/);
assert.match(migration, /iptal timestamptz/);
assert.match(migration, /olay in \('olusturuldu','kopyalandi','native','acildi'\)/, 'aggregate events must be a fixed enum');
const eventTable = migration.match(/create table if not exists public\.paylasim_olay_ozetleri\s*\(([\s\S]*?)\n\);/)?.[1] || '';
assert.ok(eventTable, 'daily aggregate event table must exist');
assert.doesNotMatch(eventTable, /\b(?:ip|ip_adresi|user_agent|referrer|referer|ziyaretci|session_id)\b/i, 'daily analytics must not retain visitor identifiers');
assert.doesNotMatch(eventTable, /kullanici|sahibi|email/i, 'event aggregates must not store visitor/account identifiers');

assert.match(migration, /function public\.paylasim_hedef_yolu\(p_tur text,p_id text\) returns text[\s\S]*?public\.yayindaki_evrenler[\s\S]*?public\.okuma_yollari/);
assert.ok(migration.includes("p_id !~ '^[[:alnum:]][[:alnum:]-]{2,59}$'"), 'share links must resolve Unicode universe slugs supported by public SEO routes');
assert.match(migration, /profil_arama_gorunur/);
assert.match(migration, /profil_icerik_gorunur/);
assert.match(migration, /public_mu/);
assert.match(migration, /gizli or s\.askida or s\.engelli/);
assert.match(migration, /function public\.paylasim_baglanti_olustur\(p_tur text,p_id text,p_sure_gun integer default 30\)/);
assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /b\.gonderen=uid/, 'published-world share creation must be owned by the canonical submitter');
assert.match(migration, /y\.sahibi=uid and y\.public_mu/, 'reading-route share creation must be owner-only and public');
assert.match(migration, /p_sure_gun not in \(1,7,30\)/, 'link lifetime must be bounded to fixed choices');
assert.match(migration, /olusturma>now\(\)-interval '1 hour'/, 'creation rate limit must be enforced server-side');
assert.match(migration, />=100/, 'active links per owner must be bounded');
assert.match(migration, />=20/, 'hourly link creation must be bounded');
assert.match(migration, /paylasim_baglanti_olustur\(text,text,integer\) from public, anon;\s*grant execute on function public\.paylasim_baglanti_olustur\(text,text,integer\) to authenticated;/);
assert.match(migration, /function public\.paylasim_baglanti_ac\(p_token uuid\)/);
assert.match(migration, /l?\.?iptal is not null or v_bitis<=now\(\)/);
assert.match(migration, /paylasim_hedef_yolu\(v_tur,v_icerik_id\)/, 'open must re-check the content is still public');
assert.match(migration, /'acildi',2000/, 'open counting must be capped per link/day');
assert.match(migration, /p_olay not in \('kopyalandi','native'\)/, 'clients cannot submit arbitrary analytics event names');
assert.match(migration, /where id=p_link for update/);
assert.match(migration, /where id=p_link and sahibi=uid/, 'revocation must require token ownership');
assert.match(migration, /where l\.sahibi=uid order by l\.olusturma desc limit 100/, 'owner history must be private and bounded');
assert.match(migration, /select '6\.3\.10'::text/);

const canonical = migration.split('-- Current-installation marker.')[0].trim();
assert.ok(setup.includes(canonical), 'canonical setup must mirror the exact 6.3.10 objects');
assert.equal((setup.match(/create or replace function public\.kurulum_surumu\b/g) || []).length, 1, 'canonical setup must retain one install-version marker');
assert.match(setup, /select '6\.3\.10'::text/);
assert.equal(packageJson.version, '6.3.10');
assert.match(gradle, /versionCode\s+621/);
assert.match(gradle, /versionName\s+"6\.3\.10"/);

assert.match(client, /navigator\.share/);
assert.match(client, /TentiforKopru\.paylas/);
assert.match(client, /navigator\.clipboard/);
assert.match(client, /document\.execCommand\('copy'\)/);
assert.match(client, /async function publicRpc\(name, args\)/, 'public token resolution must work without an initialized account client');
assert.match(client, /AbortError/);
assert.match(client, /paylasim_baglanti_iptal/);
assert.match(client, /paylasim_gecmisim/);
assert.match(client, /paylasim_baglanti_ac/);
assert.match(client, /paylasim_olay_kaydet/);
assert.match(client, /public_seo_sayfa/);
assert.match(client, /var active = !item\.iptal && expires\.getTime\(\) > Date\.now\(\)/, 'owners must be able to revoke an unexpired token even after its target becomes private');
assert.doesNotMatch(client, /\.innerHTML\s*=/, 'user/share content must be rendered without HTML parsing');
assert.ok(androidPackage.dependencies['@capacitor/share'], 'Capacitor Share plugin must be installed for Android');
assert.match(nativeWrapper, /Share\.share/, 'native wrapper must invoke the Capacitor Share plugin');
assert.match(seoClient, /announcePublicItem\(item, meta\)/, 'share controls receive only SEO-verified public records');
assert.match(index, /js\/engine\/secure-sharing\.js/);
assert.match(sw, /js\/engine\/secure-sharing\.js/);
assert.match(index, /js\/engine\/seo-meta\.js[\s\S]*?js\/engine\/secure-sharing\.js/);

console.log('6.3.10 secure sharing: PASS (public-only tokens, expiry/revoke, owner history, bounded aggregate metrics, native/clipboard fallback, privacy and version contracts)');
