import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(process.cwd(), 'js/core/24-arsiv-mantigi.js'), 'utf8');
for (const output of ['dist/js/core/24-arsiv-mantigi.js', 'uygulama/kabuk/www/js/core/24-arsiv-mantigi.js']) {
  assert.equal(fs.readFileSync(path.join(process.cwd(), output), 'utf8'), source, `${output} must contain the current live-data loader`);
}
const start = source.indexOf('function veriJsonOku(');
const end = source.indexOf('function cssBekle()', start);
assert.ok(start >= 0 && end > start, 'native content loader block must remain identifiable');
const loaderBlock = source.slice(start, end);

function createLoader({ native = false, injected = undefined, fetchImpl }) {
  const calls = [];
  const context = {
    window: {
      __VERI__: injected,
      ...(native ? { Capacitor: { isNativePlatform: () => true } } : {})
    },
    veriTabanHam: null,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return fetchImpl(url, options);
    },
    AbortController,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(`${loaderBlock}; globalThis.__veriPromise = veriKaynak;`, context);
  return { calls, context, promise: context.__veriPromise };
}

const response = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify(data) });
const liveData = { surum: '6.3.14', karakterler: [{ ad: 'Live canonical data' }] };
const nativeLive = createLoader({
  native: true,
  fetchImpl: async (url, options) => {
    assert.equal(url, 'https://tentifor.com/veri.json');
    assert.equal(options.cache, 'no-cache');
    assert.ok(options.signal instanceof AbortSignal);
    return response(liveData);
  }
});
assert.equal(JSON.stringify(await nativeLive.promise), JSON.stringify(liveData));
assert.equal(nativeLive.calls.length, 1, 'native online startup prefers the live canonical dataset');
assert.equal(nativeLive.context.veriTabanHam, JSON.stringify(liveData));

const offlineData = { surum: '6.3.14', karakterler: [{ ad: 'Bundled offline data' }] };
const nativeOffline = createLoader({
  native: true,
  fetchImpl: async (url) => {
    if (url === 'https://tentifor.com/veri.json') throw new TypeError('offline');
    assert.equal(url, 'veri.json');
    return response(offlineData);
  }
});
assert.equal(JSON.stringify(await nativeOffline.promise), JSON.stringify(offlineData));
assert.deepEqual(nativeOffline.calls.map((call) => call.url), ['https://tentifor.com/veri.json', 'veri.json']);

const nativeInvalid = createLoader({
  native: true,
  fetchImpl: async (url) => url.startsWith('https://')
    ? response({ surum: '6.3.15' })
    : response(offlineData)
});
assert.equal(JSON.stringify(await nativeInvalid.promise), JSON.stringify(offlineData), 'invalid live data must fall back to the bundled dataset');

const webLoader = createLoader({
  fetchImpl: async (url) => {
    assert.equal(url, 'veri.json');
    return response(liveData);
  }
});
assert.equal(JSON.stringify(await webLoader.promise), JSON.stringify(liveData));
assert.equal(webLoader.calls.length, 1, 'web startup continues to use same-origin data');

const injectedData = { surum: 'test', karakterler: [] };
const injectedLoader = createLoader({ native: true, injected: injectedData, fetchImpl: async () => { throw new Error('fetch should not run'); } });
assert.equal(await injectedLoader.promise, injectedData);
assert.equal(injectedLoader.calls.length, 0, 'explicit injected data remains authoritative');

console.log('Native content sync: PASS (live canonical data, no-cache revalidation, offline/invalid-data fallback, same-origin web load)');
