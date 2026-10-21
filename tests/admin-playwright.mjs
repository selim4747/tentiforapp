import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('https://static.cloudflareinsights.com/beacon.min.js*', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript; charset=utf-8', body: ''
  }));
  const fixtureDigest = crypto.createHash('sha256').update('playwright-regresyon-kodu#dogrula').digest('hex');
  await context.route('**/veri.json*', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.yoneticiOzet = fixtureDigest;
    await route.fulfill({ response, body: JSON.stringify(data) });
  });
  let page = await context.newPage();

  // Cold admin entry must render its initial panel without a user-triggered reload.
  const response = await page.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200);
  await page.evaluate(() => yoneticiCiz());
  await page.waitForFunction(() => (document.querySelector('#yoneticiAlan')?.textContent || '').trim().length > 0, null, { timeout: 15000 });
  assert.ok(await page.locator('#yGiris').count() || await page.locator('[data-y-sekme="karakterler"]').count(), 'cold admin panel should render after data/modules are ready');

  // A second unauthenticated admin tab must update when the first tab logs in.
  const otherTab = await context.newPage();
  await otherTab.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  await otherTab.waitForSelector('#yGiris', { timeout: 15000 });

  // Remember admin status in this browser profile across tabs and later visits.
  await makeAdmin(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('tentiforapp_yonetici')), 'playwright-regresyon-kodu', 'remembered admin session is stored for the browser profile');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('tentiforapp_yonetici')), null, 'the admin code is no longer tab-scoped');
  await otherTab.waitForSelector('[data-y-sekme="karakterler"]', { timeout: 15000 });
  assert.equal(await otherTab.locator('#yGiris').count(), 0, 'login is synchronized to an already-open tab');
  await page.goto(`${baseURL}/#/yonetici`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-y-sekme="karakterler"]', { timeout: 15000 });
  assert.equal(await page.locator('#yGiris').count(), 0, 'hash-based admin startup restores the same-tab session');
  assert.equal(await page.evaluate(() => rota()), '#/yonetici');
  await page.goto(`${baseURL}/sen/`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-y-sekme="karakterler"]'), null, { timeout: 15000 });
  assert.equal(await page.locator('#yGiris').count(), 0, 'admin session survives same-tab navigation');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-y-sekme="karakterler"]', { timeout: 15000 });
  assert.equal(await page.locator('#yGiris').count(), 0, 'admin session survives reload in the same tab');
  assert.equal(await page.evaluate(() => localStorage.getItem('tentiforapp_yonetici')), 'playwright-regresyon-kodu', 'admin status remains persistent after refresh');
  assert.equal(await page.evaluate(() => localStorage.getItem('tentiforapp_github')), null, 'GitHub token/settings remain outside local browser storage');
  await page.locator('[data-y-ac="0"]').click();
  const edited = 'Playwright yerel taslak testi';
  await page.locator('#yAd').fill(edited);
  await page.locator('[data-yonetici="kaydet"]').click();
  await page.waitForFunction(() => (localStorage.getItem('tentiforapp_yonetici_taslak_v1') || '').includes('Playwright yerel taslak testi'), null, { timeout: 10000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-y-sekme="karakterler"]', { timeout: 15000 });
  await page.locator('[data-y-ac="0"]').click();
  await page.waitForFunction((value) => document.querySelector('#yAd')?.value === value, edited, { timeout: 10000 });
  assert.equal(await page.locator('#yAd').inputValue(), edited, 'local draft should restore after browser reload');
  await page.close();
  page = await context.newPage();
  await page.goto(`${baseURL}/yonetici/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-y-sekme="karakterler"]', { timeout: 15000 });
  assert.equal(await page.locator('#yGiris').count(), 0, 'closing and reopening the admin tab preserves the browser-profile session');
  await page.evaluate(() => yoneticiCikis());
  assert.equal(await page.evaluate(() => localStorage.getItem('tentiforapp_yonetici')), null, 'logout clears the persistent admin session');
  assert.equal(await page.locator('#yGiris').count(), 1, 'logout returns to the code prompt');
  await otherTab.waitForSelector('#yGiris', { timeout: 15000 });
  assert.equal(await otherTab.locator('[data-y-sekme="karakterler"]').count(), 0, 'logout is synchronized to every other open tab');
  await context.close();
  await browser.close();
  console.log('Admin Playwright regressions: PASS (cross-tab login/logout, hash and standalone routes, reload and tab-reopen persistence, local draft)');
} finally {
  if (server) server.kill('SIGTERM');
}
