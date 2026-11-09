import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('js/arayuz/31-ux-64.js', 'utf8');
for (const attr of ['onboard-close', 'payment', 'mute', 'block', 'export', 'refresh']) {
  assert.match(source, new RegExp(`hasAttribute\\("data-tf64-${attr}"\\)`), `${attr} handler uses the dashed DOM attribute`);
}
assert.doesNotMatch(source, /hasAttribute\("data-tf64[A-Z]/, 'camelCase data-tf64 attribute checks must not regress');
assert.match(source, /data-tf64-step/);
assert.match(source, /write\(ONBOARD/);
console.log('6.6.5 P4 UX hardening: PASS (dashed attribute handlers and onboarding persistence contract)');
