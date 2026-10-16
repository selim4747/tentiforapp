import assert from 'node:assert/strict';
import fs from 'node:fs';
const m=fs.readFileSync('supabase/migrations/20261003_631_archive_tools.sql','utf8');
const j=fs.readFileSync('js/engine/kisisel-arsiv-araclari.js','utf8');
for (const fn of ['raf_listele','raf_sil','okuma_yolu_olustur','okuma_yolu_adim_ekle','okuma_yollari_listele','okuma_yolu_detay','evren_baglantisi_ekle','evren_grafigi']) assert.match(m,new RegExp('function public\\.'+fn));
assert.match(j,/raf_kaydet/); assert.match(j,/okuma_yolu_olustur/); assert.match(j,/okuma_yolu_adim_ekle/); assert.match(j,/evren_baglantisi_ekle/);
console.log('6.3.1 archive tools contracts: PASS (shelves, reading paths and universe graph)');
