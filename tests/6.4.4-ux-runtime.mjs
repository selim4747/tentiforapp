import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(new URL('../js/arayuz/33-ux-644.js', import.meta.url), 'utf8');
const dom = new JSDOM('<!doctype html><body><main id="okuma"><div class="tf64-onboarding"><ol><li><input type="checkbox" data-tf64-step="0"></li><li><input type="checkbox" data-tf64-step="1"></li></ol></div><div class="okuma-metin"><p>Uzun metin</p></div></main></body>', {
  url: 'https://tentifor.com/#/okuma',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;
window.eval(source);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
await new Promise((resolve) => setTimeout(resolve, 180));
assert.ok(window.document.querySelector('#tf644ReadingToolbar'));
assert.ok(window.document.querySelector('.tf644-progress'));
assert.equal(window.document.querySelectorAll('#tf644Breadcrumb').length, 1);
const step = window.document.querySelector('[data-tf64-step="0"]');
step.checked = true;
step.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.match(window.localStorage.getItem('tentiforapp_644_ux'), /"steps"/);
console.log('6.4.4 UX DOM runtime: PASS (toolbar, onboarding persistence and breadcrumb)');
