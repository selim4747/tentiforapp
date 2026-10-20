import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.TF_ADMIN_BROWSER_PORT || 3191);
const baseURL = process.env.TF_ADMIN_BROWSER_URL || `http://127.0.0.1:${port}`;
let server;
let output = '';

async function ready() {
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`${baseURL}/`)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error(`Local app server did not start: ${output}`);
}

async function makeAdmin(page) {
  await page.waitForFunction(() => typeof veri !== 'undefined' && typeof dogrulamaOzeti === 'function');
  await page.evaluate(() => { veri.yoneticiOzet = dogrulamaOzeti('playwright-regresyon-kodu'); });
  await page.locator('#yGiris').fill('playwright-regresyon-kodu');
  await page.locator('[data-yonetici="giris"]').click();
  await page.waitForSelector('[data-y-sekme="karakterler"]');
}

try {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  await ready();
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    localStorage.removeItem('tentiforapp_yonetici');
    localStorage.removeItem('tentiforapp_github');
    sessionStorage.clear();
  });
  const page = await context.newPage();

  // Cold admin entry must render its initial panel without a user-triggered reload.
  const response = await page.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200);
  await page.evaluate(() => yoneticiCiz());
  await page.waitForFunction(() => (document.querySelector('#yoneticiAlan')?.textContent || '').trim().length > 0, null, { timeout: 15000 });
  assert.ok(await page.locator('#yGiris').count() || await page.locator('[data-y-sekme="karakterler"]').count(), 'cold admin panel should render after data/modules are ready');

  // Authenticate only in memory, change a record, and verify the local draft survives reload.
  await makeAdmin(page);
  await page.locator('[data-y-ac="0"]').click();
  const edited = 'Playwright yerel taslak testi';
  await page.locator('#yAd').fill(edited);
  await page.locator('[data-yonetici="kaydet"]').click();
  await page.waitForFunction(() => (localStorage.getItem('tentiforapp_yonetici_taslak_v1') || '').includes('Playwright yerel taslak testi'), null, { timeout: 10000 });
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter((key) => key === 'tentiforapp_yonetici' || key === 'tentiforapp_github')), [], 'admin code and GitHub token/settings must not be persisted');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#yGiris') || document.querySelector('[data-y-sekme="karakterler"]'), null, { timeout: 15000 });
  await makeAdmin(page);
  await page.locator('[data-y-ac="0"]').click();
  await page.waitForFunction((value) => document.querySelector('#yAd')?.value === value, edited, { timeout: 10000 });
  assert.equal(await page.locator('#yAd').inputValue(), edited, 'local draft should restore after browser reload');

  await context.close();
  await browser.close();
  console.log('Admin Playwright regressions: PASS (cold render and draft reload persistence)');
} finally {
  if (server) server.kill('SIGTERM');
}
