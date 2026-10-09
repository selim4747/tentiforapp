import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
assert.ok(fs.existsSync(path.join(dist, 'evren/e25/index.html')), 'run npm run build before Playwright SEO tests');
assert.ok(fs.existsSync(path.join(dist, 'evren/e126/index.html')), 'approved E126 must have a generated public route');
assert.ok(fs.existsSync(path.join(dist, 'moderasyon/index.html')), 'moderation must have an app-shell route instead of the static 404');
assert.ok(fs.existsSync(path.join(dist, 'moderasyon.html')), 'extensionless moderation URL must have an app-shell route');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  let file = path.resolve(dist, `.${pathname}`);
  if (!file.startsWith(`${dist}${path.sep}`) && file !== dist) { response.writeHead(403).end('Forbidden'); return; }
  try {
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('missing');
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(dist, '404.html')).pipe(response);
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const faviconResponse = await fetch(`${origin}/favicon.ico`);
assert.equal(faviconResponse.status, 200);
assert.match(faviconResponse.headers.get('content-type') || '', /image\/x-icon/);
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // Search/social crawlers must get meaningful route content and metadata with JS disabled.
  const crawler = await browser.newPage({ javaScriptEnabled: false });
  const staticResponse = await crawler.goto(`${origin}/evren/e25/`, { waitUntil: 'domcontentloaded' });
  assert.equal(staticResponse.status(), 200);
  assert.match(await crawler.title(), /E25.*TentiFor/);
  assert.match(await crawler.locator('meta[name="description"]').getAttribute('content'), /Evrengezerlerin evreni/);
  assert.equal(await crawler.locator('link[rel="canonical"]').getAttribute('href'), 'https://tentifor.com/evren/e25/');
  assert.equal(await crawler.locator('meta[property="og:url"]').getAttribute('content'), 'https://tentifor.com/evren/e25/');
  assert.equal(await crawler.locator('meta[name="twitter:url"]').getAttribute('content'), 'https://tentifor.com/evren/e25/');
  assert.match(await crawler.locator('h1').first().textContent(), /E25/);
  const e126Response = await crawler.goto(`${origin}/evren/e126/`, { waitUntil: 'domcontentloaded' });
  assert.equal(e126Response.status(), 200);
  assert.match(await crawler.title(), /E126.*TentiFor/);
  assert.equal(await crawler.locator('link[rel="canonical"]').getAttribute('href'), 'https://tentifor.com/evren/e126/');
  assert.equal(await crawler.locator('meta[property="og:url"]').getAttribute('content'), 'https://tentifor.com/evren/e126/');
  assert.equal(await crawler.locator('meta[name="robots"]').getAttribute('content'), 'index, follow');
  assert.match(await crawler.locator('h1').first().textContent(), /E126/);
  const moderationStatic = await crawler.goto(`${origin}/moderasyon/`, { waitUntil: 'domcontentloaded' });
  assert.equal(moderationStatic.status(), 200);
  assert.match(await crawler.title(), /Moderasyon.*TentiFor/);
  assert.equal(await crawler.locator('meta[name="robots"]').getAttribute('content'), 'noindex, follow');
  assert.equal(await crawler.locator('link[rel="canonical"]').getAttribute('href'), 'https://tentifor.com/moderasyon/');
  assert.doesNotMatch(await crawler.locator('body').innerText(), /404|Sayfa bulunamadı|Aradığın adres:/i);
  const moderationNoSlash = await crawler.goto(`${origin}/moderasyon`, { waitUntil: 'domcontentloaded' });
  assert.equal(moderationNoSlash.status(), 200);
  assert.equal(await crawler.locator('meta[name="robots"]').getAttribute('content'), 'noindex, follow');
  await crawler.close();

  // Normal browser: direct static page exposes a functioning share-card download.
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, acceptDownloads: true });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (payload) => { window.__nativeShare = payload; } });
  });
  await context.route('https://**/*', (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`${origin}/evren/e25/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#evrenSayfa[aria-modal="true"]');
  const onboardingSkip = page.locator('#turIpucu .tur-kapat');
  if (await onboardingSkip.count()) {
    await onboardingSkip.click();
    await page.waitForFunction(() => !document.querySelector('#turIpucu'));
  }
  await page.waitForSelector('#evrenSayfa button[data-tf639-card]');
  const visibleCard = page.locator('#evrenSayfa button[data-tf639-card]:visible').first();
  assert.equal(await visibleCard.count(), 1, 'share-card action should be available on a public universe page');
  const [download] = await Promise.all([page.waitForEvent('download'), visibleCard.click()]);
  assert.match(download.suggestedFilename(), /^tentiforapp-e25\.png$/);
  await page.waitForSelector('#evrenSayfa button[data-tf310-share]:visible');
  await page.evaluate(() => { window.TentiforKopru = null; });
  const shareButton = page.locator('#evrenSayfa button[data-tf310-share]:visible').first();
  await shareButton.click();
  await page.waitForFunction(() => window.__nativeShare && /\/evren\/e25\/$/.test(window.__nativeShare.url));
  assert.equal(new URL((await page.evaluate(() => window.__nativeShare.url))).pathname, '/evren/e25/');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__copiedShare = text; } } });
  });
  await shareButton.click();
  await page.waitForFunction(() => typeof window.__copiedShare === 'string' && window.__copiedShare.includes('/evren/e25/'));
  const pageWidth = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(pageWidth.document <= pageWidth.viewport + 1, `mobile layout overflows horizontally: ${JSON.stringify(pageWidth)}`);

  // E126's canonical snapshot and route normalization are covered by the static crawler
  // assertions above and tests/domain-brand-regression.mjs; this browser test is offline.

  // Direct moderation loads must show the app shell, not stack a modal over the 404 document.
  const moderationResponse = await page.goto(`${origin}/moderasyon/`, { waitUntil: 'domcontentloaded' });
  assert.equal(moderationResponse.status(), 200);
  await page.waitForSelector('.mod-pencere[role="dialog"][aria-modal="true"]');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, follow');
  assert.doesNotMatch(await page.locator('body').innerText(), /404|Sayfa bulunamadı|Aradığın adres:/i);
  await page.locator('.mod-pencere [data-kapat]').click();
  await page.waitForFunction(() => !document.querySelector('.mod-pencere'));
  assert.doesNotMatch(await page.locator('body').innerText(), /404|Sayfa bulunamadı|Aradığın adres:/i);
  const moderationNoSlashResponse = await page.goto(`${origin}/moderasyon`, { waitUntil: 'domcontentloaded' });
  assert.equal(moderationNoSlashResponse.status(), 200);
  await page.waitForSelector('.mod-pencere[role="dialog"][aria-modal="true"]');

  // Client-side route transition updates title, description, social metadata and canonical URL.
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { location.hash = '#/ev/site/e25'; });
  await page.waitForFunction(() => document.title.includes('E25') && document.querySelector('link[rel="canonical"]')?.href === 'https://tentifor.com/evren/e25/');
  assert.match(await page.locator('meta[name="description"]').getAttribute('content'), /Evrengezerlerin evreni/);
  assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), 'https://tentifor.com/evren/e25/');
  assert.equal(await page.locator('meta[name="twitter:url"]').getAttribute('content'), 'https://tentifor.com/evren/e25/');
  assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'), 'summary_large_image');

  const missing = await page.goto(`${origin}/private-draft-not-published/`, { waitUntil: 'domcontentloaded' });
  assert.equal(missing.status(), 404);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, follow');
  assert.match(await page.locator('h1').first().textContent(), /Sayfa bulunamadı/);
  await context.close();
  console.log('Playwright SEO/share smoke: PASS (JS-off crawler metadata, E126 direct/legacy routes, noindex moderation app shell, no persistent 404, SPA canonical, PNG card, share, mobile width, noindex 404)');
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
