import assert from 'node:assert/strict';
import fs from 'node:fs';

const mobile = fs.readFileSync('js/core/42-mobil.js', 'utf8');
const currency = fs.readFileSync('js/engine/45-evrengezer.js', 'utf8');
const data = JSON.parse(fs.readFileSync('veri.json', 'utf8'));

assert.equal(data.surum, '5.4.0');
assert.match(mobile, /\["magaza","Mağaza","▣"\]/);
assert.match(mobile, /n&&!n\.kilitli/);
assert.match(mobile, /data-evren-magaza/);
assert.match(mobile, /evrenMagazaAc\(\)/);
assert.match(currency, /function evrenMagazaAc\(\)/);
assert.match(currency, /egBuroAc\(a\)/);
assert.match(currency, /evrenCuzdanAnahtari\(\)/);
console.log('5.4.0 mağaza regresyonları: PASS');
