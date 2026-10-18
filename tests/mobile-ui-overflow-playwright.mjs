import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.TF_MOBILE_UI_PORT || 3188);
const baseURL = process.env.TF_MOBILE_UI_URL || `http://127.0.0.1:${port}`;
let server;
let browser;
let serverOutput = '';

async function ready() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch(`${baseURL}/`);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Local app server did not start: ${serverOutput}`);
}

async function waitForApp(page) {
  await page.waitForFunction(() => typeof window.veri !== 'undefined' && typeof window.haritaCiz === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(150);
}

async function measureRoute(width, route) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200, `${route} should be served at ${width}px`);
    await waitForApp(page);
    const layout = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width, visible: getComputedStyle(element).display !== 'none' && box.width > 0 };
      };
      const header = document.querySelector('header.ust');
      const nav = document.querySelector('.gezinme');
      const terminal = document.querySelector('.gez-terminal');
      return {
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        bodyClient: document.body.clientWidth,
        body: document.body.scrollWidth,
        header: rect('header.ust'),
        tools: rect('.ust-araclar-trigger'),
        personal: rect('.tf642-trigger'),
        account: rect('.hesap-btn'),
        terminal: rect('.gez-terminal'),
        terminalInScrollableNav: !!(nav && terminal && nav.contains(terminal) && ['auto', 'scroll'].includes(getComputedStyle(nav).overflowX)),
        navClientWidth: nav?.clientWidth ?? 0,
        navScrollWidth: nav?.scrollWidth ?? 0,
        gameTabs: rect('.oyun-sekme'),
        mapPreview: rect('#haritaAlan .harita-onizleme')
      };
    });
    assert.equal(layout.document, layout.viewport, `${route} ${width}px document must not scroll horizontally: ${JSON.stringify(layout)}`);
    assert.ok(layout.body <= layout.bodyClient, `${route} ${width}px body must not overflow horizontally: ${JSON.stringify(layout)}`);
    if (width === 375 || width === 768) {
      assert.ok(layout.tools?.visible, `Araçlar button should be visible at ${width}px`);
      assert.ok(layout.tools.left >= -1 && layout.tools.right <= width + 1, `Araçlar button should remain within the header at ${width}px: ${JSON.stringify(layout)}`);
    }
    for (const [name, item] of [['Kişisel merkez', layout.personal], ['Hesap', layout.account]]) {
      if (item?.visible) assert.ok(item.left >= -1 && item.right <= width + 1, `${name} button should stay within ${width}px viewport: ${JSON.stringify(layout)}`);
    }
    if (width === 768 && layout.terminal?.visible) {
      assert.equal(layout.terminalInScrollableNav, true, 'terminal CTA must be inside the horizontally scrollable navigation');
      assert.ok(layout.navClientWidth <= width && layout.navScrollWidth >= layout.navClientWidth, 'navigation overflow must remain within its own scroller');
    }
    if (width === 375 || width === 768) {
      await page.locator('[data-tf654-tools-toggle]').click();
      const toolsPanel = await page.locator('#ustAraclarPanel').evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, viewport: innerWidth, overflow: document.documentElement.scrollWidth };
      });
      assert.ok(toolsPanel.left >= -1 && toolsPanel.right <= width + 1, `Araçlar paneli ${width}px viewport içine sığmalı: ${JSON.stringify(toolsPanel)}`);
      assert.equal(toolsPanel.overflow, width, `Araçlar paneli ${width}px sayfa taşması oluşturmamalı: ${JSON.stringify(toolsPanel)}`);
      await page.locator('[data-tf654-tools-toggle]').click();
    }
    await page.close();
    return layout;
  } catch (error) {
    await page.close();
    throw error;
  }
}

try {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (chunk) => { serverOutput += chunk; });
  server.stderr.on('data', (chunk) => { serverOutput += chunk; });
  await ready();
  browser = await chromium.launch({ headless: true });

  const measurements = [];
  for (const width of [375, 390, 768, 1024]) {
    for (const route of ['/', '/oyunlar/', '/harita/']) {
      measurements.push({ width, route, ...(await measureRoute(width, route)) });
    }
  }

  const routesResponse = await fetch(`${baseURL}/manus-routes.json`);
  assert.equal(routesResponse.status, 200, '/manus-routes.json should return HTTP 200');
  const routeManifest = await routesResponse.json();
  assert.ok(routeManifest && typeof routeManifest === 'object' && !Array.isArray(routeManifest), '/manus-routes.json should contain a valid JSON object');

  const workshop = await browser.newPage({ viewport: { width: 375, height: 850 } });
  await workshop.goto(`${baseURL}/atolye/`, { waitUntil: 'domcontentloaded' });
  await waitForApp(workshop);
  const createButton = workshop.locator('[data-es-yeni]').first();
  assert.equal(await createButton.count(), 1, 'Atölye should expose a create-world action');
  await createButton.evaluate((button) => button.click());
  const form = workshop.locator('#tf61-wizard-form');
  await form.waitFor({ state: 'visible' });
  await form.locator('button[type="submit"]').click();
  assert.equal(await workshop.locator('#tf61-ad').evaluate((input) => input.validationMessage), 'Evren adı gerekli.');
  assert.equal(await workshop.locator('#tf61-status').textContent(), '', 'native required-field message should be shown without stale inline status');
  await form.evaluate((element) => element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(await workshop.locator('#tf61-status').textContent(), 'Evren adı gerekli.', 'Atölye inline status uses the exact Turkish empty-name message');

  // Create an isolated local test universe to exercise the real 1408px-capable SVG renderer.
  await workshop.locator('#tf61-ad').fill('Viewport test evreni');
  await workshop.locator('#tf61-yerler').fill('Başlangıç limanı');
  await form.locator('button[type="submit"]').click();
  await workshop.waitForFunction(() => document.querySelector('#evrenSayfa .evh-svg')?.getBoundingClientRect().width > 0, null, { timeout: 30000 });
  const mapLayout = await workshop.locator('#evrenSayfa .evh-svg').evaluate((svg) => {
    const box = svg.getBoundingClientRect();
    const parent = svg.closest('.evh-kutu');
    const parentBox = parent.getBoundingClientRect();
    return { viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, svgWidth: box.width, parentWidth: parentBox.width, parentClient: parent.clientWidth, parentScroll: parent.scrollWidth, aria: svg.getAttribute('aria-label'), labels: svg.textContent };
  });
  assert.ok(mapLayout.svgWidth <= 375 && mapLayout.document === 375, `universe map SVG must scale within 375px: ${JSON.stringify(mapLayout)}`);
  assert.ok(mapLayout.parentWidth <= 375 && mapLayout.parentScroll <= mapLayout.parentClient + 1, `map labels should fit without body-level overflow: ${JSON.stringify(mapLayout)}`);
  assert.equal(mapLayout.aria, 'Evren haritası', 'map SVG remains exposed as an accessible image');
  assert.match(mapLayout.labels, /Başlangıç limanı/, 'map node label remains present in the real SVG');

  await workshop.setViewportSize({ width: 768, height: 900 });
  await workshop.waitForTimeout(100);
  const tabletMap = await workshop.locator('#evrenSayfa .evh-svg').evaluate((svg) => ({ width: svg.getBoundingClientRect().width, viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, bodyClient: document.body.clientWidth, parentWidth: svg.closest('.evh-kutu').getBoundingClientRect().width }));
  assert.ok(tabletMap.width <= tabletMap.viewport && tabletMap.document === tabletMap.viewport && tabletMap.body <= tabletMap.bodyClient, `tablet map SVG and body stay within 768px: ${JSON.stringify(tabletMap)}`);

  await workshop.close();
  console.log(`mobile UI overflow Playwright: PASS (${measurements.length} route/viewport checks; routes JSON; Atölye validation; real SVG at 375/768px)`);
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGKILL');
}
