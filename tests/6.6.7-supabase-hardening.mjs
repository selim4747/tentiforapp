import assert from 'node:assert/strict';
import fs from 'node:fs';

const hardening = fs.readFileSync('supabase/migrations/20261112_security_performance_hardening.sql', 'utf8');
const cleanup = fs.readFileSync('supabase/migrations/20261112_security_performance_hardening_cleanup.sql', 'utf8');
const grants = fs.readFileSync('supabase/migrations/20261112_security_grant_cleanup.sql', 'utf8');
const setup = fs.readFileSync('supabase/kurulum.sql', 'utf8');

for (const [name, sql] of Object.entries({ hardening, cleanup, grants })) {
  assert.match(sql, /begin;/i, `${name}: transaction missing`);
  assert.match(sql, /commit;/i, `${name}: transaction end missing`);
  assert.doesNotMatch(sql, /\b(insert|update|delete)\s+into\b/i, `${name}: data mutation is not allowed`);
  assert.doesNotMatch(sql, /truncate\s+/i, `${name}: truncate is not allowed`);
}

assert.match(hardening, /revoke\s+all\s+on\s+table[\s\S]+from\s+anon/i);
assert.match(hardening, /create\s+index\s+if\s+not\s+exists/i);
assert.match(cleanup, /drop\s+index\s+if\s+exists/i);
assert.match(cleanup, /array_lower|\[0:cardinality\(f\.conkey\)-1\]/i);
assert.match(grants, /having\s+count\(p\.polname\)=0/i);
assert.match(grants, /revoke\s+execute\s+on\s+function/i);

for (const marker of [
  '20261112_security_performance_hardening.sql',
  '20261112_security_performance_hardening_cleanup.sql',
  '20261112_security_grant_cleanup.sql',
]) {
  assert.ok(setup.includes(marker) || setup.includes(fs.readFileSync(`supabase/migrations/${marker}`, 'utf8').trim()), `setup missing ${marker}`);
}

console.log('6.6.7 Supabase hardening regression: PASS');
