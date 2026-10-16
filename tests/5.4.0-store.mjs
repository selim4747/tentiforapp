import assert from 'node:assert/strict';
import fs from 'node:fs';
import packageMeta from '../package.json' with { type: 'json' };

const mobile = fs.readFileSync('js/core/42-mobil.js', 'utf8');
const currency = fs.readFileSync('js/engine/45-evrengezer.js', 'utf8');
const data = JSON.parse(fs.readFileSync('veri.json', 'utf8'));

assert.equal(data.surum, packageMeta.version);
assert.match(mobile, /\["magaza","Mağaza","▣"\]/);
assert.match(mobile, /r=!!n/);
assert.match(mobile, /data-evren-magaza/);
assert.doesNotMatch(mobile, /rota\(\)\.indexOf\(\"#\/ev\/\"\)===0&&typeof evrenSayfaVerisi/); // pretty /evren/... URLs must also show it
assert.match(mobile, /evrenMagazaAc\(\)/);
assert.match(currency, /function evrenMagazaAc\(\)/);
assert.doesNotMatch(currency, /function evrenMagazaAc\(\)\{[^}]*a\.kilitli/);
assert.match(currency, /a&&a\.eser&&a\.eser\.ad/);
assert.match(currency, /egBuroAc\(a\)/);
assert.match(currency, /evrenCuzdanAnahtari\(\)/);
console.log(`${packageMeta.version} mağaza regresyonları: PASS`);
