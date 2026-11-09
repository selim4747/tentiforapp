import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/20261108_p2_cross_module_entity_links.sql');
const setup = read('supabase/kurulum.sql');
const adminSource = read('js/admin/74-yonetim-kurulum.js');
const bundle = read('js/paket-4.js');
const runner = read('scripts/test.mjs');
const schemaBlock = migration.split('-- Release marker:', 1)[0].trim();

assert.match(migration, /create table if not exists public\.evren_varliklari\s*\(/);
assert.match(migration, /varlik_id uuid primary key default gen_random_uuid\(\)/i, 'stable ID is generated once by the server');
assert.match(migration, /sahibi uuid not null references auth\.users\(id\)/i);
assert.match(migration, /evren_id text not null check/i);
assert.match(migration, /kaynak_turu text not null check \(kaynak_turu in \('harita_dugumu','zaman_olayi'\)\)/);
assert.match(migration, /kaynak_kaydi_id uuid not null/);
assert.match(migration, /unique \(sahibi, evren_id, kaynak_turu, kaynak_kaydi_id\)/);
assert.match(migration, /unique \(sahibi, evren_id, varlik_id\)/);
assert.doesNotMatch(migration.slice(0, migration.indexOf('alter table public.evren_harita_dugumleri')), /baslik|title/i,
  'registry keys must not use titles or inferred merges');

for (const table of ['evren_harita_dugumleri', 'evren_zaman_olaylari']) {
  assert.match(migration, new RegExp(`alter table public\\.${table}\\s+add column if not exists varlik_id uuid;`), `${table} gets a nullable reference`);
  assert.match(migration, new RegExp(`foreign key \\(sahibi, evren_id, varlik_id\\)\\s+references public\\.evren_varliklari \\(sahibi, evren_id, varlik_id\\) not valid`),
    `${table} reference is owner/universe-scoped and safe for populated tables`);
}
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on public\.evren_varliklari from public, anon, authenticated/,
  'no direct table access is granted to client roles');
assert.match(migration, /create trigger evren_varlik_kimligi_degismez[\s\S]*?before update on public\.evren_varliklari/,
  'registry UUID, scope, and source key are protected against reassignment');
assert.match(migration, /new\.varlik_id is distinct from old\.varlik_id[\s\S]*?new\.kaynak_kaydi_id is distinct from old\.kaynak_kaydi_id/);

for (const fn of ['evren_varlik_kaydet', 'evren_varlik_bagla', 'evren_varlik_bilgisi']) {
  const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const definition = migration.match(new RegExp(`create or replace function public\\.${escaped}\\([\\s\\S]*?\\$\\$;`))?.[0];
  assert.ok(definition, `${fn} RPC exists`);
  assert.match(definition, /security definer/i, `${fn} must run through a controlled server function`);
  assert.match(definition, /set search_path = ''/i, `${fn} must pin an empty search_path`);
  assert.doesNotMatch(definition, /p_(?:sahibi|owner|owner_id)\b/i, `${fn} must not trust caller-supplied owner`);
  if (fn !== 'evren_varlik_bilgisi') {
    assert.match(definition, /auth\.uid\(\)/, `${fn} derives caller identity from auth.uid()`);
    assert.match(definition, /evren_gorsel_yetki_kontrol\(evren\)/, `${fn} uses the established owner/shared-world authorization gate`);
  }
  assert.match(migration, new RegExp(`revoke all on function public\\.${escaped}\\([\\s\\S]*?from public`), `${fn} revokes default PUBLIC execution`);
}
assert.match(migration, /grant execute on function public\.evren_varlik_kaydet\(text, text, uuid\) to authenticated/);
assert.match(migration, /grant execute on function public\.evren_varlik_bagla\(text, text, uuid, uuid\) to authenticated/);
assert.match(migration, /revoke all on function public\.evren_varlik_bilgisi\(text, text, uuid\) from public/);
assert.match(migration, /grant execute on function public\.evren_varlik_bilgisi\(text, text, uuid\) to anon, authenticated/);
assert.match(migration, /on conflict \(sahibi, evren_id, kaynak_turu, kaynak_kaydi_id\) do nothing/,
  'repeated registration/link calls do not create duplicate source identities');
assert.match(migration, /set varlik_id = p_varlik_id/,
  'link operation assigns only an explicitly selected existing ID (or NULL to unlink)');
assert.match(migration, /if p_kaynak_turu is null or p_kaynak_turu not in \('harita_dugumu','zaman_olayi'\)/,
  'all source-kind RPCs reject unknown and NULL source kinds');
assert.match(migration, /d\.sahibi = asil and d\.evren_id = evren and d\.id = p_kaynak_kaydi_id/);
assert.match(migration, /e\.sahibi = asil and e\.evren_id = evren and e\.id = p_kaynak_kaydi_id/);
assert.match(migration, /v\.varlik_id = p_varlik_id and v\.sahibi = asil and v\.evren_id = evren/,
  'target identity must belong to the same owner and universe');
assert.match(migration, /v\.kaynak_turu, v\.kaynak_kaydi_id/,
  'linking validates the registered kind and source record key');

const publicResolver = migration.match(/create or replace function public\.evren_varlik_bilgisi\([\s\S]*?\$\$;/)?.[0] || '';
assert.match(publicResolver, /a\.evren_id = evren and a\.herkese_acik/);
assert.match(publicResolver, /d\.id = p_kaynak_kaydi_id and d\.yayinda/);
assert.match(publicResolver, /e\.id = p_kaynak_kaydi_id and e\.durum = 'yayinda'/);
assert.match(publicResolver, /d\.id = hedef_kaydi and d\.yayinda/);
assert.match(publicResolver, /e\.id = hedef_kaydi and e\.durum = 'yayinda'/);
assert.match(publicResolver, /return jsonb_build_object\('varlik_id',source_varlik,[\s\S]*?'baslik',baslik\)/,
  'target UUID/title/type are returned only after source and target publication checks');
assert.doesNotMatch(publicResolver, /count\s*\(/i, 'public resolver does not expose reference counts');

assert.doesNotMatch(migration, /\bdrop\s+table\b|\bdrop\s+column\b|\btruncate\b|\bdelete\s+from\b/i,
  'migration does not delete, truncate, or drop existing data');
const setupSchema = setup.split("create or replace function public.kurulum_surumu() returns text", 1)[0];
assert.ok(setupSchema.includes(schemaBlock), 'clean-install SQL includes the migration schema block unchanged');
assert.equal((setup.match(/create or replace function public\.kurulum_surumu\b/g) || []).length, 1,
  'clean-install setup has one release marker');
const setupVersion = setup.match(/create or replace function public\.kurulum_surumu\b[\s\S]*?select '([^']+)'::text/)?.[1];
const migrationVersion = migration.match(/select '([^']+)'::text/)?.[1];
const adminVersion = adminSource.match(/KURULUM_BEKLENEN="([^"]+)"/)?.[1];
const bundleVersion = bundle.match(/KURULUM_BEKLENEN="([^"]+)"/)?.[1];
assert.equal(migrationVersion, '6.6.2');
assert.equal(setupVersion, migrationVersion, 'setup marker matches migration');
assert.equal(adminVersion, migrationVersion, 'admin source expects the installed schema version');
assert.equal(bundleVersion, migrationVersion, 'distributed bundle matches admin source marker');
assert.match(runner, /tests\/6\.6\.2-entity-links-sql\.mjs/,
  'the static contract is registered with the repository test runner');

console.log('6.6.2 entity-link SQL contract: PASS (additive schema, scoped immutable IDs, RPC authorization, publication filtering, setup/version alignment)');
