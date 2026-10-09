import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(path.join(process.cwd(), 'js/engine/sira-6316.js'), 'utf8');
const attack = '<img id="sira-injected" src=x onerror="window.__siraInjected=1">';
const dom = new JSDOM(
  '<!doctype html><html><body><main><span class="cuzdan-etiket">Başlangıç</span><button id="cuzdanRozet"></button><p class="hero-metin">Tömye</p></main></body></html>',
  { url: 'https://tentifor.test/', runScripts: 'outside-only' }
);
const { window } = dom;
window.localStorage.setItem('tentiforapp_kalinan', JSON.stringify({ yer: '#/okuma', ad: attack, t: 1 }));

const NativeMutationObserver = window.MutationObserver;
let observerCallbacks = 0;
window.MutationObserver = class GuardedMutationObserver extends NativeMutationObserver {
  constructor(callback) {
    super((records, observer) => {
      observerCallbacks += 1;
      if (observerCallbacks > 4) {
        observer.disconnect();
        return;
      }
      callback(records, observer);
    });
  }
};

window.eval(source);
await new Promise((resolve) => setTimeout(resolve, 700));
await new Promise((resolve) => setTimeout(resolve, 30));

const label = window.document.querySelector('.cuzdan-etiket')?.textContent;
const injectedElement = window.document.querySelector('#siraTarih #sira-injected');
const failures = [];
if (observerCallbacks > 1) failures.push(`observer repeated its own DOM mutation (${observerCallbacks} callbacks)`);
if (label !== 'eçka') failures.push(`wallet label did not settle: ${JSON.stringify(label)}`);
if (injectedElement) failures.push('stored text was parsed as HTML instead of displayed literally');
if (!window.document.querySelector('#siraTarih')?.textContent.includes(attack)) failures.push('stored text is not preserved as literal text');
window.close();

assert.deepEqual(failures, [], `Visitor Gate runtime regression: ${failures.join('; ')}`);
console.log('Visitor Gate 6.3.16 runtime: PASS (observer settles, saved text stays inert)');
