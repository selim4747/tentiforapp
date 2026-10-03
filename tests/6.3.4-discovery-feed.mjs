import assert from 'node:assert/strict';
import fs from 'node:fs';
const m=fs.readFileSync('supabase/migrations/20261003_634_discovery_feed.sql','utf8');
const j=fs.readFileSync('js/engine/124-v634-kesif.js','utf8');
for (const fn of ['kesif_akisi','kesif_one_cikanlar']) assert.match(m,new RegExp('function public\\.'+fn));
assert.match(m,/evren_sayaclari/); assert.match(m,/profil_icerik_gorunur/); assert.match(m,/limit greatest/);
assert.match(j,/kesif_akisi/); assert.match(j,/kesif_one_cikanlar/); assert.match(j,/tf634-siralama/);
console.log('6.3.4 discovery contracts: PASS (ranking, filters and featured archivists)');
