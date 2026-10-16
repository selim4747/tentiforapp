import assert from 'node:assert/strict';
import fs from 'node:fs';
const m=fs.readFileSync('supabase/migrations/20261003_632_social_feed.sql','utf8');
const j=fs.readFileSync('js/engine/takip-akisi-topluluk.js','utf8');
for (const fn of ['takip_akisi','public_profil_etkinlikleri','sosyal_sikayet_et','sosyal_sikayetler_yukle']) assert.match(m,new RegExp('function public\\.'+fn));
assert.match(m,/kullaniciya_bildir/); assert.match(m,/unique \(bildiren,tur,hedef\)/);
assert.match(j,/takip_akisi/); assert.match(j,/sosyal_sikayet_et/); assert.match(j,/public_profil_etkinlikleri/);
console.log('6.3.2 social feed contracts: PASS (followed feed, notifications, activity and reports)');
