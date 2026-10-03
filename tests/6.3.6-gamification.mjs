import assert from 'node:assert/strict';
import fs from 'node:fs';
const m=fs.readFileSync('supabase/migrations/20261003_636_gamification.sql','utf8');
const j=fs.readFileSync('js/engine/okuma-serisi-gorevler.js','utf8');
assert.match(m,/create table if not exists public\.okuma_gunleri/); assert.match(m,/function public\.okuma_serisi_kaydet/); assert.match(m,/function public\.kesif_gorevlerim/);
assert.match(m,/on conflict \(kullanici,gun\) do nothing/); assert.match(m,/auth\.uid\(\)/); assert.match(m,/kisisel_raf/);
assert.match(j,/okuma_serisi_kaydet/); assert.match(j,/kesif_gorevlerim/); assert.match(j,/Haftalık keşif/);
console.log('6.3.6 gamification contracts: PASS (streaks and weekly tasks)');
