import assert from 'node:assert/strict';
import { handleRequest } from '../worker/index.js';

const userId = '1ab230d4-5678-4abc-9def-1234567890ab';
const jwt = 'test-user-jwt';
const env = {
  ASSETS: { fetch: async () => new Response('asset') },
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-test-key',
  GITHUB_MEDIA_OWNER: 'selim4747',
  GITHUB_MEDIA_REPO: 'tentiforapp-media',
  GITHUB_TOKEN: 'server-only-token',
  SITE_ORIGIN: 'https://tentifor.com'
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/1sgAAAAASUVORK5CYII=', 'base64');
const originalFetch = globalThis.fetch;

function request(method, url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.auth !== false) headers.set('Authorization', `Bearer ${jwt}`);
  if (options.origin) headers.set('Origin', options.origin);
  return new Request(url, { method, headers, body: options.body });
}
function rpcName(url) { return new URL(url).pathname.split('/').pop(); }

try {
  // A private map is invisible to a signed-out visitor; GitHub must not be called.
  let githubReads = 0;
  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    if (value.includes('/rest/v1/rpc/')) return Response.json({ durum: 'yok' });
    if (value.includes('api.github.com')) githubReads += 1;
    throw new Error(`Unexpected request: ${value}`);
  };
  let response = await handleRequest(request('GET', 'https://tentifor.com/api/evren-gorsel?evrenId=world-private', { auth: false }), env, {});
  assert.equal(response.status, 404);
  assert.equal(githubReads, 0);

  // Even public maps are blocked if a misconfigured media repository is public.
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.includes('/rest/v1/rpc/')) return Response.json({
      durum: 'tamam', yol: `${userId}/world-public/gh-314.png`, mime: 'image/png',
      boyut: png.length, genislik: 1, yukseklik: 1, alt: 'Kapak', kaplama: 'contain', saydamlik: 0, herkese_acik: true
    });
    if (value.endsWith('/repos/selim4747/tentiforapp-media')) return Response.json({ private: false });
    if (value.includes('/releases/assets/314')) githubReads += 1;
    throw new Error(`Unexpected request: ${value}`);
  };
  response = await handleRequest(request('GET', 'https://tentifor.com/api/evren-gorsel?evrenId=world-public', { auth: false }), env, {});
  assert.equal(response.status, 503);
  assert.equal(githubReads, 0);

  // A published GitHub-backed map is streamed through the Worker with metadata.
  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    if (value.endsWith('/repos/selim4747/tentiforapp-media')) return Response.json({ private: true });
    if (value.includes('/rest/v1/rpc/')) return Response.json({
      durum: 'tamam', yol: `${userId}/world-public/gh-314.png`, mime: 'image/png',
      boyut: png.length, genislik: 1, yukseklik: 1, alt: 'Kapak', kaplama: 'contain', saydamlik: 0, herkese_acik: true
    });
    if (value.includes('/releases/assets/314')) {
      assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer server-only-token');
      return new Response(png, { headers: { 'Content-Type': 'application/octet-stream' } });
    }
    throw new Error(`Unexpected request: ${value}`);
  };
  response = await handleRequest(request('GET', 'https://tentifor.com/api/evren-gorsel?evrenId=world-public', { auth: false }), env, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('X-EVH-Image-Source'), 'github');
  assert.equal(response.headers.get('X-EVH-Image-Opacity'), '0');
  assert.equal(response.headers.get('X-EVH-Image-Fit'), 'contain');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);

  // Upload validates the session, sends raw bytes to a private Release, and stores
  // only a GitHub asset pointer plus bounded metadata through the authorized RPC.
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    requests.push({ url: value, init });
    if (value.endsWith('/auth/v1/user')) return Response.json({ id: userId });
    if (value.endsWith('/rest/v1/rpc/evren_gorsel_varlik_oku')) return Response.json({ durum: 'tamam', yol: null });
    if (value.endsWith('/rest/v1/rpc/evren_gorsel_varlik_kaydet')) return Response.json({ durum: 'tamam' });
    if (value.endsWith('/releases/tags/tentiforapp-media-v1')) return new Response('', { status: 404 });
    if (value.endsWith('/releases')) return Response.json({
      id: 77,
      upload_url: 'https://uploads.github.com/repos/selim4747/tentiforapp-media/releases/77/assets{?name,label}'
    }, { status: 201 });
    if (value.startsWith('https://uploads.github.com/')) {
      assert.equal(init.method, 'POST');
      assert.equal(new Headers(init.headers).get('Content-Type'), 'image/png');
      assert.deepEqual(Buffer.from(init.body), png);
      return Response.json({ id: 314, name: 'asset-test.png' }, { status: 201 });
    }
    throw new Error(`Unexpected request: ${value}`);
  };
  const form = new FormData();
  form.append('evrenId', 'world-upload');
  form.append('alt', 'Sıfır saydamlık');
  form.append('kaplama', 'contain');
  form.append('saydamlik', '0');
  form.append('file', new Blob([png], { type: 'image/png' }), 'map.png');
  response = await handleRequest(request('POST', 'https://tentifor.com/api/evren-gorsel', { body: form, origin: 'https://tentifor.com' }), env, {});
  const uploaded = await response.json();
  assert.equal(response.status, 201);
  assert.equal(uploaded.kaynak, 'github');
  assert.match(uploaded.yol, new RegExp(`^${userId}/world-upload/gh-314\\.png$`));
  assert.equal(uploaded.saydamlik, 0);
  const save = requests.find((item) => item.url.endsWith('/evren_gorsel_varlik_kaydet'));
  assert.ok(save);
  assert.equal(new Headers(save.init.headers).get('Authorization'), `Bearer ${jwt}`);
  assert.equal(JSON.parse(save.init.body).p_saydamlik, 0);
  assert.ok(requests.some((item) => item.url.includes('api.github.com/repos/selim4747/tentiforapp-media/releases')));

  // Deleting removes the private asset before clearing Supabase metadata.
  let deletedAsset = false;
  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    if (value.endsWith('/rest/v1/rpc/evren_gorsel_varlik_oku')) return Response.json({ durum: 'tamam', yol: `${userId}/world-delete/gh-314.png` });
    if (value.endsWith('/rest/v1/rpc/evren_gorsel_varlik_sil')) return Response.json({ durum: 'tamam', yol: `${userId}/world-delete/gh-314.png` });
    if (value.endsWith('/releases/assets/314') && init.method === 'DELETE') { deletedAsset = true; return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected request: ${value}`);
  };
  response = await handleRequest(request('DELETE', 'https://tentifor.com/api/evren-gorsel?evrenId=world-delete'), env, {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cleanup, 'done');
  assert.equal(deletedAsset, true);

  // A failed GitHub cleanup must leave Supabase metadata intact for retry.
  let metadataDeleteCalled = false;
  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    if (value.endsWith('/rest/v1/rpc/evren_gorsel_varlik_oku')) return Response.json({ durum: 'tamam', yol: `${userId}/world-retry/gh-315.png` });
    if (value.endsWith('/rest/v1/rpc/evren_gorsel_varlik_sil')) { metadataDeleteCalled = true; return Response.json({ durum: 'tamam' }); }
    if (value.endsWith('/releases/assets/315') && init.method === 'DELETE') return new Response('GitHub unavailable', { status: 503 });
    throw new Error(`Unexpected request: ${value}`);
  };
  response = await handleRequest(request('DELETE', 'https://tentifor.com/api/evren-gorsel?evrenId=world-retry'), env, {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'image-cleanup-failed');
  assert.equal(metadataDeleteCalled, false);

  // Disallowed browser origins cannot read image metadata.
  response = await handleRequest(request('OPTIONS', 'https://tentifor.com/api/evren-gorsel', { origin: 'https://attacker.example' }), env, {});
  assert.equal(response.status, 403);
  console.log('Private GitHub map-media Worker contracts: PASS');
} finally {
  globalThis.fetch = originalFetch;
}
