import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const cacheBlock = sw.match(/const ILK\s*=\s*\[([\s\S]*?)\];/);
assert.ok(cacheBlock, 'service-worker precache list exists');
const cacheEntries = [...cacheBlock[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
assert.ok(cacheEntries.length > 0, 'service-worker precache list is not empty');
for (const entry of cacheEntries) {
  const relative = entry.split('?')[0].replace(/^\.\//, '') || 'index.html';
  assert.ok(fs.existsSync(path.join(root, relative)), `precache entry missing from source: ${entry}`);
  assert.ok(fs.existsSync(path.join(root, 'uygulama/kabuk/www', relative)), `precache entry missing from APK webDir: ${entry}`);
}
assert.equal(cacheEntries.some((entry) => entry.includes('34b-model-evreni.js')), false, 'retired model file is not precached');

const bootstrap = fs.readFileSync(path.join(root, 'js/core/125-live-site-bootstrap.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const capacitor = JSON.parse(fs.readFileSync(path.join(root, 'uygulama/kabuk/capacitor.config.json'), 'utf8'));
assert.match(index, /js\/core\/125-live-site-bootstrap\.js/);
assert.equal(capacitor.server.url, undefined, 'native startup uses packaged local assets before online redirect');
assert.ok(capacitor.server.allowNavigation.includes('tentifor.com'));
assert.ok(capacitor.server.allowNavigation.includes('www.tentifor.com'));

async function boot({ native = true, host = 'localhost', online = true, imageBehavior = 'load' } = {}) {
  const location = {
    href: `https://${host}/harita/?harita=ax24`,
    hostname: host,
    replace(url) { this.replaced = url; }
  };
  const imageUrls = [];
  class FakeImage {
    set src(value) {
      this.currentSrc = value;
      if (value === 'data:,') return;
      imageUrls.push(value);
      setTimeout(() => {
        if (imageBehavior === 'load') this.onload?.();
        else this.onerror?.();
      }, 0);
    }
  }
  const rootWindow = {
    location,
    navigator: { onLine: online },
    Capacitor: native ? { isNativePlatform: () => true } : undefined,
    Image: FakeImage,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(bootstrap, { window: rootWindow, URL, Date, setTimeout, clearTimeout });
  await delay(15);
  return { location, imageUrls };
}

const online = await boot({ imageBehavior: 'load' });
assert.equal(online.imageUrls.length, 1);
assert.match(online.imageUrls[0], /^https:\/\/tentifor\.com\/favicon\.ico\?apk-check=/);
assert.equal(online.location.replaced, 'https://tentifor.com/harita/?harita=ax24', 'live redirect preserves deep route and selection');

const offline = await boot({ online: false });
assert.equal(offline.imageUrls.length, 0, 'offline launch does not wait on a network probe');
assert.equal(offline.location.replaced, undefined, 'offline startup stays on bundled local shell');

const unavailable = await boot({ imageBehavior: 'error' });
assert.equal(unavailable.imageUrls.length, 1);
assert.equal(unavailable.location.replaced, undefined, 'unreachable live site leaves local shell active');

const remote = await boot({ host: 'tentifor.com' });
assert.equal(remote.imageUrls.length, 0, 'live site does not redirect to itself');
assert.equal(remote.location.replaced, undefined);

console.log(`Native offline startup: PASS (${cacheEntries.length} precache files exist in source/www; live redirect and local offline fallback verified)`);
