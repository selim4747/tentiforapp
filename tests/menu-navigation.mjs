import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';

const virtualConsole = new VirtualConsole();
const runtimeErrors = [];
virtualConsole.on('jsdomError', (error) => {
  if (!/Not implemented: navigation|Could not parse CSS/.test(error.message)) {
    runtimeErrors.push(error.message);
  }
});

const dom = await JSDOM.fromURL('http://localhost:3000/', {
  runScripts: 'dangerously',
  resources: 'usable',
  virtualConsole,
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = (input, init) => globalThis.fetch(new URL(String(input), window.location.href), init);
    window.scrollTo = () => {};
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  }
});

const { window } = dom;
const { document } = window;
const delay = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));
const click = (element) => {
  assert.ok(element, 'expected menu control to exist');
  if (element instanceof window.HTMLAnchorElement) {
    element.click();
    return;
  }
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
};

try {
  for (let attempt = 0; attempt < 60 && !document.querySelector('#altMenu [data-mobil-menu]'); attempt += 1) {
    await delay(100);
  }

  const bottomNav = document.querySelector('#altMenu');
  assert.ok(bottomNav, 'mobile bottom navigation should be rendered');
  assert.equal(bottomNav.querySelectorAll('.alt-oge').length, 5, 'bottom navigation should show its five destinations');
  assert.equal(bottomNav.getAttribute('aria-label'), 'Hızlı gezinme');
  const startupErrorCount = runtimeErrors.length;

  click(bottomNav.querySelector('[data-mobil-menu] .alt-ikon'));
  assert.ok(document.querySelector('#mobilMenu .mobil-menu[role="dialog"]'), 'tapping the menu icon should open the dialog');
  assert.ok(document.documentElement.classList.contains('menu-acik'), 'opening the dialog should lock background scrolling');
  assert.equal(document.querySelector('#altMenu [data-mobil-menu]').getAttribute('aria-expanded'), 'true');

  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(document.querySelector('#mobilMenu'), null, 'Escape should close the mobile menu');
  assert.ok(!document.documentElement.classList.contains('menu-acik'), 'closing should release the scroll lock');
  assert.equal(document.querySelector('#altMenu [data-mobil-menu]').getAttribute('aria-expanded'), 'false');

  click(document.querySelector('#altMenu [data-mobil-menu]'));
  click(document.querySelector('#mobilMenu [data-mobil-kapat]'));
  assert.equal(document.querySelector('#mobilMenu'), null, 'the close button should dismiss the mobile menu');

  click(document.querySelector('#altMenu [data-mobil-menu]'));
  click(document.querySelector('#mobilMenu'));
  assert.equal(document.querySelector('#mobilMenu'), null, 'tapping the backdrop should dismiss the mobile menu');

  click(document.querySelector('#altMenu [data-mobil-menu]'));
  const oyunlarLink = document.querySelector('#mobilMenu a.mm-sayfa[href="#/oyunlar"]');
  let menuLinkClick;
  oyunlarLink.addEventListener('click', (event) => { menuLinkClick = event; }, { once: true });
  click(oyunlarLink);
  await delay(100);
  assert.ok(menuLinkClick && menuLinkClick.defaultPrevented, 'the app router should intercept menu hash links');
  assert.equal(window.location.pathname, '/oyunlar/', 'selecting a destination should normalize it to the app page route');
  assert.equal(document.querySelector('#mobilMenu'), null, 'choosing a destination should close the mobile menu');
  assert.equal(document.querySelector('#altMenu a[href="#/oyunlar"]').getAttribute('aria-current'), 'page');

  click(document.querySelector('#altMenu [data-mobil-menu]'));
  click(document.querySelector('#mobilMenu a.mm-sayfa[href="#/oyunlar"]'));
  assert.equal(document.querySelector('#mobilMenu'), null, 'choosing the current destination should still close the menu');

  click(document.querySelector('#gezinme #icindekilerBtn'));
  assert.ok(document.querySelector('#icindekiler [role="dialog"]'), 'the desktop all-pages control should open the contents dialog');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(document.querySelector('#icindekiler'), null, 'Escape should close the contents dialog');

  const menuErrors = runtimeErrors.slice(startupErrorCount);
  assert.deepEqual(menuErrors, [], `unexpected menu runtime errors: ${menuErrors.join('; ')}`);
  console.log('Menu navigation tests: PASS (mobile open/close, Escape, backdrop, route selection, current route, and all-pages dialog)');
} finally {
  dom.window.close();
}
