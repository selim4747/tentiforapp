import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const adapter = fs.readFileSync('js/engine/evren-gorsel-varlik.js', 'utf8');
const fan = fs.readFileSync('js/studio/40-fan-atolye.js', 'utf8');
const map = fs.readFileSync('js/engine/44-evrenler.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261020_evren_harita_gorsel_varlik.sql', 'utf8');
const setup = fs.readFileSync('supabase/kurulum.sql', 'utf8');

assert.match(index, /js\/engine\/evren-gorsel-varlik\.js/);
assert.match(adapter, /indexedDB/);
assert.match(adapter, /MAX_BYTES = 10 \* 1024 \* 1024/);
assert.match(adapter, /image\/png/);
assert.match(adapter, /image\/jpeg/);
assert.match(adapter, /image\/webp/);
assert.match(adapter, /signature/);
assert.match(adapter, /evren-harita-gorselleri/);
assert.match(adapter, /evren_gorsel_varlik_kaydet/);
assert.match(adapter, /hesabaAktar/);

// Existing maps must remain valid when no image metadata is present; when it is
// present only bounded, safe metadata may enter the canonical fan record.
assert.match(fan, /function fanHaritaTemizle/);
assert.match(fan, /l\.gorsel=\{/);
assert.match(fan, /kaplama/);
assert.match(fan, /saydamlik/);
assert.match(fan, /fanDosyaHtmlTasima/);
assert.match(fan, /data:image\\\//);
assert.match(fan, /fanGomuluGorseliAl/);
assert.match(adapter, /gomuluAktar/);
assert.match(fan, /yerler/);
assert.match(fan, /cizgiler/);

// The image is rendered as the map's first visual layer, not as a replacement
// for polygons, paths, labels or the selection/editing layer.
assert.match(map, /evh-arka-plan/);
assert.match(map, /gorsel:\(n\.duzen\|\|t\)\.gorsel/);
assert.match(map, /data-evh-gorsel-input/);
assert.match(map, /data-evh-gorsel-sil/);
assert.match(map, /evrenGorselGoster/);

assert.match(migration, /evren_gorsel_varlik_kaydet/);
assert.match(migration, /evren_gorsel_varlik_sil/);
assert.match(migration, /evren_gorsel_varlik_oku/);
assert.match(migration, /evren-harita-gorselleri/);
assert.match(migration, /create policy/);
assert.match(migration, /storage\.foldername/);
assert.match(setup, /evren_gorsel_varlik_kaydet/);

console.log('6.5 fan map image assets contracts: PASS');
