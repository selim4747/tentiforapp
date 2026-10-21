import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const setup = read('supabase/kurulum.sql');
const migration = read('supabase/migrations/20261021_6611_profile_privacy.sql');
const sw = read('sw.js');
const admin = read('js/admin/22-yonetici.js');
const account = read('js/core/28-hesap.js');

assert.equal(packageJson.version, '6.6.1');
assert.match(read('js/admin/74-yonetim-kurulum.js'), /KURULUM_BEKLENEN="6\.6\.1"/);
assert.match(read('js/paket-4.js'), /KURULUM_BEKLENEN="6\.6\.1"/);
assert.match(read('supabase/kurulum.sql'), /select '6\.6\.1'::text/);
assert.match(read('supabase/migrations/20261020_evren_harita_gorsel_varlik.sql'), /select '6\.6\.1'::text/);

const veriBranch = sw.indexOf('if (u.pathname === "/veri.json")');
assert.ok(veriBranch >= 0, 'veri.json özel network-first dalı olmalı');
assert.ok(sw.indexOf('guvenliFetch(istek, { cache: "no-store" })', veriBranch) > veriBranch);
assert.ok(sw.indexOf('yedekKopya(istek, false)', veriBranch) > veriBranch);

assert.match(admin, /yoneticiTaslakArsivle/);
assert.match(admin, /String\(i\.surum\|\|""\)!==t/);
assert.match(admin, /güncel verinin üzerine yazılmadı/);
assert.match(admin, /surum:String\(veri\.surum\|\|""\)/);

assert.match(account, /rpc\("kullanici_adi_uygun_mu"/);
assert.doesNotMatch(account, /hesapIstemci\.from\("profiller"\)\.select\("id"\)/);
assert.match(setup, /create policy "kendi profilini okur" on public\.profiller/);
assert.match(setup, /create or replace function public\.kullanici_adi_uygun_mu/);
assert.match(setup, /create or replace view public\.public_profiller/);
assert.match(setup, /coalesce\(p\.profil_icerik_gorunur, true\)/);
assert.match(migration, /drop policy if exists "profiller herkese açık"/);
assert.match(migration, /create or replace view public\.arsivci_seviyeleri/);
assert.match(migration, /select '6\.6\.1'::text/);

console.log('6.6.1 release hardening: PASS (fresh data, versioned drafts, privacy RLS and boolean username RPC)');
