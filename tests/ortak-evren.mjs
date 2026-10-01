import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/kurulum.sql', 'utf8');
const client = fs.readFileSync('js/admin/75-yonetim-yetkileri.js', 'utf8');

assert.match(sql, /create or replace function public\.ortak_evren_planli_mi/);
assert.match(sql, /if not public\.ortak_evren_planli_mi\(uid\) then return jsonb_build_object\('durum', 'plan'\)/);
assert.match(sql, /if not public\.ortak_evren_planli_mi\(\) then return jsonb_build_object\('durum', 'plan'\)/);
assert.match(sql, /limit_kisi := case when public\.ortak_evren_yazar_mi\(e\.sahip\) then 2147483647 else 2 end/);
assert.match(sql, /return jsonb_build_object\('durum', 'takim_siniri'\)/);
assert.match(sql, /p_taban timestamptz/);
assert.match(client, /setTimeout\(function\(\)\{ortakYaz\(e\)\},2500\)/);
assert.match(client, /rpc\("ortak_evren_getir"/);
assert.match(client, /if\(ORTAK\.bekleyen\[e\]\)return/);
assert.match(client, /slice\(0,30\)/);

console.log('Shared-universe plan enforcement, team limit and low-traffic client contracts: PASS');
