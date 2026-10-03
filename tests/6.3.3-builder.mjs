import assert from 'node:assert/strict';
import fs from 'node:fs';
const m=fs.readFileSync('supabase/migrations/20261003_633_builder.sql','utf8');
const j=fs.readFileSync('js/engine/123-v633-kurucu.js','utf8');
for (const fn of ['evren_taslak_kaydet','evren_taslaklarim','evren_taslak_detay','evren_zaman_noktasi_ekle','evren_zaman_cizelgesi']) assert.match(m,new RegExp('function public\\.'+fn));
assert.match(m,/pg_column_size\(veri\) < 1000000/); assert.match(m,/unique\(sahibi,evren_id,surum\)/);
assert.match(j,/evren_taslak_kaydet/); assert.match(j,/evren_zaman_noktasi_ekle/); assert.match(j,/JSON.parse/);
console.log('6.3.3 builder contracts: PASS (drafts, version history and timeline)');
