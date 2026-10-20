import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const ui = read('js/engine/91-v473-uyelik.js');
const migration = read('supabase/migrations/20261012_646_evren_gezer_wallet.sql');
const setup = read('supabase/kurulum.sql');
const importer = read('supabase/functions/evren-gezer-eg-aktar/index.ts');

const purchaseHandler = ui.match(/async function egPlanSatinAl\(buton, tip\) \{([\s\S]*?)\n  function planPencere/);
assert.ok(purchaseHandler, 'satın alma handler’ı test edilebilmeli');
assert.match(purchaseHandler[1], /typeof hesapKullanici === 'undefined' \|\| !hesapKullanici/, 'misafir, anon Supabase RPC çağrısı yapmamalı');
assert.match(ui, /EvrenGezer · 250 EG \/ 30 gün/);
assert.match(ui, /EvrenYazar · 750 EG \/ 30 gün/);
assert.match(ui, /rpc\('evren_gezer_cuzdanim'\)/);
assert.match(ui, /rpc\('evren_gezer_plan_satin_al'/);
assert.match(ui, /functions\.invoke\('evren-gezer-eg-aktar'\)/);
assert.match(ui, /sessionStorage\.setItem\(anahtar, satinAlmaIstekleri\[anahtar\]\)/, 'yanıtı kaybolan satın alma tekrarında aynı istek kimliği korunmalı');
assert.match(ui, /bakiye_yetersiz:/);
assert.match(ui, /Güvenli sunucu EG bakiyesi/);
assert.match(ui, /Gerçek parayla EG yüklemesi ayrı bir entegrasyondur/);
assert.match(importer, /auth\.getUser\(token\)/, 'aktarımı çağıran oturum token’ı doğrulanmalı');
assert.match(importer, /\.from\("ilerlemeler"\)/, 'eski EG, kullanıcının bulut senkron kaydından okunmalı');
assert.match(importer, /\.rpc\("evren_gezer_bakiye_aktar"/);
assert.match(importer, /tentiforapp_evrengezer/);
assert.doesNotMatch(importer, /request\.json\(/, 'aktarılacak eski bakiye istemci body’sinden alınmamalı');

for (const sql of [migration, setup]) {
  assert.match(sql, /create table if not exists public\.evren_gezer_cuzdanlari/);
  assert.match(sql, /create table if not exists public\.evren_gezer_islemleri/);
  assert.match(sql, /create table if not exists public\.evren_gezer_aktarimlari/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /istek_id uuid not null unique/);
  assert.match(sql, /for update/);
  assert.match(sql, /interval '30 days'/);
  assert.match(sql, /bakiye_sunucu < bedel/);
  assert.match(sql, /evrenyazar' and tip = 'evrengezer'/);
  assert.match(sql, /eski_tip = 'evrenyazar' and \(eski_bitis is null or eski_bitis > now\(\)\)/, 'süresi dolmuş EvrenYazar, daha ucuz alımda korunmamalı');
  assert.match(sql, /kod_bitis := public\.pro_kod_bitis\(uid\)/, 'hediye/pro kod erişimi ücretli plan satın alımında hesaba katılmalı');
  assert.match(sql, /grant execute on function public\.evren_gezer_plan_satin_al\(text, uuid\) to authenticated/);
  assert.match(sql, /grant execute on function public\.evren_gezer_bakiye_yukle\(uuid, bigint, uuid, text\) to service_role/);
  assert.match(sql, /revoke all on function public\.evren_gezer_bakiye_yukle\(uuid, bigint, uuid, text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.evren_gezer_bakiye_aktar\(uuid, bigint\) to service_role/);
  assert.match(sql, /revoke all on function public\.evren_gezer_bakiye_aktar\(uuid, bigint\) from public, anon, authenticated/);
  assert.match(sql, sql === setup ? /select '6\.6\.1'::text/ : /select '6\.4\.6\.0'::text/);
  assert.doesNotMatch(sql, /evren_gezer_cuzdanlari[\s\S]{0,1500}grant select/i, 'sunucu cüzdan tablosuna doğrudan SELECT yetkisi verilmemeli');
}
assert.equal((setup.match(/create or replace function public\.kurulum_surumu\b/g) || []).length, 1);
console.log('6.4.6 EG server-wallet/plan static regression checks: PASS');
