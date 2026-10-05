import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/20261005_visual_universe_map_timeline.sql');
const setup = read('supabase/kurulum.sql');
const client = read('js/engine/evren-harita-zaman-cizelgesi.js');
const css = read('css/style.css');
const index = read('index.html');
const packageJson = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('manifest.webmanifest'));

for (const table of ['evren_gorsel_alanlari','evren_harita_dugumleri','evren_harita_baglari','evren_zaman_olaylari','evren_zaman_baglari']) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}\\b`), `${table} tablosu migration'da olmalı`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} RLS kullanmalı`);
}
assert.match(migration, /revoke all on public\.evren_gorsel_alanlari, public\.evren_harita_dugumleri, public\.evren_harita_baglari, public\.evren_zaman_olaylari, public\.evren_zaman_baglari from public, anon, authenticated/);
assert.match(migration, /create or replace function public\.evren_gorsel_yetki_kontrol\(p_evren_id text\) returns uuid[\s\S]*?auth\.uid\(\)/);
for (const ownerSource of ['evren_sahipleri','ortak_evrenler','yayindaki_evrenler','evren_taslaklari']) assert.ok(migration.includes(ownerSource), `server-side owner source missing: ${ownerSource}`);
assert.doesNotMatch(migration, /p_sahibi\s+(?:uuid|text)/i, 'owner must never be caller supplied');
assert.match(migration, /if asil is not null and asil <> kayit_sahibi then raise exception 'evren için yetki yok'/, 'registered owner must match the canonical world owner');
assert.match(migration, /asil <> uid and not \(exists \(select 1 from public\.ortak_evrenler/, 'shared-world editors must use the canonical owner and membership check');
assert.match(migration, /insert into public\.evren_gorsel_alanlari\(evren_id,sahibi\) values\(evren,coalesce\(asil,uid\)\).*on conflict\(evren_id\) do nothing;\s*select sahibi into kayit_sahibi from public\.evren_gorsel_alanlari where evren_id = evren for update/s, 'authorized mutations serialize on the canonical world scope');
assert.match(migration, /set search_path = ''/, 'definer RPCs must pin an empty search_path');

for (const rpc of ['evren_gorsel_haritayi_yukle','evren_gorsel_haritayi_kaydet','evren_gorsel_dugumu_guncelle','evren_gorsel_bagi_degistir','evren_zaman_cizelgesi_yukle','evren_zaman_olay_kaydet','evren_zaman_olay_sil','evren_zaman_bagi_degistir']) {
  assert.match(migration, new RegExp(`create or replace function public\\.${rpc}\\(`), `${rpc} RPC missing`);
}
assert.match(migration, /pg_column_size\(p_dugumler\)\+pg_column_size\(p_baglar\)>262144/);
assert.match(migration, /jsonb_array_length\(p_dugumler\)>150 or jsonb_array_length\(p_baglar\)>300/);
assert.match(migration, />=500/, 'timeline event/link ceilings must be enforced server-side');
assert.match(migration, /herkese and yayinda/, 'public map RPC returns only explicitly published nodes');
assert.match(migration, /duzenleyebilir or durum='yayinda'/, 'public timeline RPC returns only published events');
assert.match(migration, /foreign key \(sahibi, evren_id, kaynak\) references public\.evren_harita_dugumleri/);
assert.match(migration, /foreign key \(sahibi, evren_id, hedef\) references public\.evren_zaman_olaylari/);
assert.match(migration, /select '6\.3\.8'::text/, 'migration updates the database version marker');
const canonicalMigration = migration.slice(0, migration.indexOf('-- Release marker')).trim();
assert.ok(setup.includes(canonicalMigration), 'canonical setup must retain the 6.3.8 migration definitions before later releases');
assert.equal((setup.match(/create or replace function public\.kurulum_surumu\b/g) || []).length, 1, 'canonical setup keeps one version marker');
assert.match(setup, /select '6\.3\.13'::text/);

for (const rpc of ['evren_gorsel_haritayi_yukle','evren_gorsel_haritayi_kaydet','evren_gorsel_dugumu_guncelle','evren_gorsel_bagi_degistir','evren_zaman_cizelgesi_yukle','evren_zaman_olay_kaydet','evren_zaman_olay_sil','evren_zaman_bagi_degistir']) {
  assert.ok(client.includes(`'${rpc}'`), `client calls ${rpc}`);
}
assert.match(client, /function esc\(/, 'user-provided strings must be HTML escaped');
assert.match(client, /pointermove/);
assert.match(client, /pointerdown/);
assert.match(client, /ArrowUp/);
assert.match(client, /data-tf638-zoom/);
assert.match(client, /data-tf638-reset/);
assert.match(client, /Dönem çakışması/);
assert.match(client, /data-tf638-publish-node/);
assert.match(client, /aria-live/);
assert.match(client, /tf-veri-hazir/);
assert.match(css, /@media\(max-width:640px\)/);
assert.match(css, /touch-action:none/);
assert.match(css, /\.tf638-node-handle:focus-visible/);
assert.match(index, /js\/engine\/evren-harita-zaman-cizelgesi\.js/);
assert.equal(packageJson.version, '6.3.13');
assert.equal(manifest.version, '6.3.13');
console.log('6.3.8 visual universe: PASS (owner/RLS, RPC limits, publication filtering, map/timeline and responsive keyboard/touch contracts)');
