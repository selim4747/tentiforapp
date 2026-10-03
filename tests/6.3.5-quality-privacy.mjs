import assert from 'node:assert/strict';
import fs from 'node:fs';
const m=fs.readFileSync('supabase/migrations/20261003_635_quality_privacy.sql','utf8');
const j=fs.readFileSync('js/engine/arsivci-analitik-gizlilik.js','utf8');
assert.match(m,/function public\.arsivci_istatistikleri/); assert.match(m,/function public\.veri_disa_aktar/);
assert.match(m,/auth\.uid\(\)/); assert.match(m,/kisisel_raf/); assert.match(m,/okuma_yollari/); assert.match(m,/evren_taslaklari/);
assert.match(j,/arsivci_istatistikleri/); assert.match(j,/veri_disa_aktar/); assert.match(j,/Verilerimi dışa aktar/);
console.log('6.3.5 quality/privacy contracts: PASS (analytics, profile sharing and export)');
