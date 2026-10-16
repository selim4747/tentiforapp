import assert from 'node:assert/strict';
import fs from 'node:fs';
const m=fs.readFileSync('supabase/migrations/20261003_637_moderation.sql','utf8');
const j=fs.readFileSync('js/engine/moderasyon-karantina.js','utf8');
assert.match(m,/create table if not exists public\.icerik_karantina/); assert.match(m,/function public\.icerik_bildirim_ozeti/);
assert.match(m,/function public\.icerik_karantinaya_al/); assert.match(m,/function public\.icerik_karantina_kaldir/);
assert.match(m,/yonetici_yetki\('icbildirim'\)/); assert.match(m,/durum in \('aktif','kaldirildi'\)/);
assert.match(j,/icerik_bildirim_ozeti/); assert.match(j,/Karantinaya al/); assert.match(j,/yoneticiAcik/);
console.log('6.3.7 moderation contracts: PASS (summary and reversible quarantine)');
