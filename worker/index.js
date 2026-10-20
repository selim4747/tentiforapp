const MAX_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 4096;
const BUCKET = 'evren-harita-gorselleri';
const SUPABASE_URL = 'https://wlgtjbrlquefnzavwein.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CHM9EAA3V5nZeQcmKtR0UQ__Xyb4b_F';
const RELEASE_TAG = 'tentiforapp-media-v1';
const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
let privateRepoCheckedAt = 0;
let privateRepoCheck = null;
let privateRepoCheckedKey = '';
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}
function originAllowed(origin, request, env) {
  if (!origin) return true;
  const allowed = new Set([
    new URL(request.url).origin,
    env.SITE_ORIGIN || 'https://tentifor.com',
    'https://tentifor.com', 'https://www.tentifor.com',
    'capacitor://localhost', 'https://localhost', 'http://localhost'
  ]);
  return allowed.has(origin);
}
function corsHeaders(origin) {
  return origin ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  } : {};
}
function bearer(request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') || '');
  return match ? match[1].trim() : '';
}
function safeConfig(env) {
  const owner = String(env.GITHUB_MEDIA_OWNER || 'selim4747');
  const repo = String(env.GITHUB_MEDIA_REPO || 'tentiforapp-media');
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo)) return null;
  return { owner, repo };
}
function githubHeaders(env, accept = 'application/vnd.github+json') {
  return {
    'Accept': accept,
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'TentiFor-Map-Media'
  };
}
function supabaseBase(env) {
  return String(env.SUPABASE_URL || SUPABASE_URL).replace(/\/$/, '');
}
function supabaseHeaders(env, token) {
  const headers = { 'apikey': String(env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY), 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
async function supabaseRpc(env, name, args, token) {
  const base = supabaseBase(env);
  if (!base) throw new Error('supabase-not-configured');
  const response = await fetch(`${base}/rest/v1/rpc/${encodeURIComponent(name)}`, {
    method: 'POST', headers: supabaseHeaders(env, token), body: JSON.stringify(args)
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'not-authorized' : 'supabase-unavailable');
  return response.json();
}
async function supabaseUser(env, token) {
  const base = supabaseBase(env);
  if (!base) throw new Error('supabase-not-configured');
  const response = await fetch(`${base}/auth/v1/user`, {
    headers: { 'apikey': String(env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY), 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('not-authorized');
  const user = await response.json();
  if (!user || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(user.id || ''))) throw new Error('not-authorized');
  return user;
}
function readDimensions(bytes, mime) {
  const b = new Uint8Array(bytes);
  const view = new DataView(bytes);
  if (mime === 'image/png' && b.length >= 24 && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mime === 'image/jpeg' && b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255) {
    let offset = 2;
    while (offset + 4 < b.length) {
      while (b[offset] === 255) offset++;
      const marker = b[offset++];
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > b.length) break;
      const length = (b[offset] << 8) | b[offset + 1];
      if (length < 2 || offset + length > b.length) break;
      if (SOF.has(marker) && length >= 7) return { height: (b[offset + 3] << 8) | b[offset + 4], width: (b[offset + 5] << 8) | b[offset + 6] };
      offset += length;
    }
  }
  if (mime === 'image/webp' && b.length >= 30 && text4(b, 0) === 'RIFF' && text4(b, 8) === 'WEBP') {
    const kind = text4(b, 12);
    if (kind === 'VP8X') return { width: 1 + b[24] + (b[25] << 8) + (b[26] << 16), height: 1 + b[27] + (b[28] << 8) + (b[29] << 16) };
    if (kind === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { width: ((b[26] | (b[27] << 8)) & 0x3fff), height: ((b[28] | (b[29] << 8)) & 0x3fff) };
    if (kind === 'VP8L' && b[20] === 0x2f) return { width: 1 + b[21] + ((b[22] & 0x3f) << 8), height: 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10)) };
  }
  return null;
}
function text4(bytes, offset) { return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]); }
function imagePath(userId, worldId, path) {
  const parts = String(path || '').split('/');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId)) || parts.length !== 3 || parts[0] !== String(userId) || parts[1] !== String(worldId)) return null;
  const match = /^gh-(\d{1,20})\.(png|jpg|webp)$/.exec(parts[2]);
  return match ? { assetId: match[1], ext: match[2] } : null;
}
function responseMetaHeaders(data, cors) {
  return {
    ...cors,
    'Content-Type': data.mime,
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
    'Cache-Control': 'private, no-store',
    'X-EVH-Image-Mime': data.mime,
    'X-EVH-Image-Width': String(data.width || ''),
    'X-EVH-Image-Height': String(data.height || ''),
    'X-EVH-Image-Alt': encodeURIComponent(String(data.alt || 'Harita resmi').slice(0, 160)),
    'X-EVH-Image-Fit': data.fit === 'contain' ? 'contain' : 'cover',
    'X-EVH-Image-Source': data.source === 'github' ? 'github' : 'supabase',
    'X-EVH-Image-Path': data.source === 'github' ? '' : encodeURIComponent(String(data.path || '')),
    'X-EVH-Image-Opacity': String(Math.max(0, Math.min(1, Number(data.opacity == null ? 1 : data.opacity))))
  };
}
async function ensurePrivateRepo(env) {
  const config = safeConfig(env);
  if (!config || !env.GITHUB_TOKEN) throw new Error('github-not-configured');
  const key = `${config.owner}/${config.repo}`;
  if (privateRepoCheckedKey === key && Date.now() - privateRepoCheckedAt < 60_000) return true;
  if (privateRepoCheck) return privateRepoCheck;
  privateRepoCheck = (async () => {
    const response = await fetch(`${GITHUB_API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`, { headers: githubHeaders(env) });
    if (!response.ok) throw new Error(`github-${response.status}`);
    const repository = await response.json();
    if (!repository || repository.private !== true) throw new Error('github-repository-not-private');
    privateRepoCheckedKey = key;
    privateRepoCheckedAt = Date.now();
    return true;
  })();
  try { return await privateRepoCheck; }
  finally { privateRepoCheck = null; }
}
async function releaseForUpload(env) {
  const config = safeConfig(env);
  if (!config || !env.GITHUB_TOKEN) throw new Error('github-not-configured');
  await ensurePrivateRepo(env);
  const base = `${GITHUB_API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
  const tagUrl = `${base}/releases/tags/${encodeURIComponent(RELEASE_TAG)}`;
  const headers = githubHeaders(env);
  let response = await fetch(tagUrl, { headers });
  if (response.ok) return response.json();
  if (response.status !== 404) throw new Error(`github-${response.status}`);
  response = await fetch(`${base}/releases`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_name: RELEASE_TAG, name: 'TentiFor private map media', body: 'Private map image assets managed by the TentiFor media Worker.', prerelease: true, make_latest: 'false' })
  });
  if (response.ok) return response.json();
  if (response.status === 422) {
    const retry = await fetch(tagUrl, { headers });
    if (retry.ok) return retry.json();
  }
  throw new Error(`github-${response.status}`);
}
async function uploadReleaseAsset(env, bytes, mime, ext) {
  const config = safeConfig(env);
  if (!config) throw new Error('github-not-configured');
  const release = await releaseForUpload(env);
  const uploadUrl = String(release.upload_url || '').replace(/\{\?name,label\}$/, '');
  let parsed;
  try { parsed = new URL(uploadUrl); } catch { throw new Error('github-upload-url-invalid'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'uploads.github.com') throw new Error('github-upload-url-invalid');
  const name = `asset-${crypto.randomUUID()}.${ext}`;
  parsed.searchParams.set('name', name);
  const response = await fetch(parsed.toString(), {
    method: 'POST', headers: { ...githubHeaders(env), 'Content-Type': mime }, body: bytes
  });
  if (!response.ok) throw new Error(`github-${response.status}`);
  const result = await response.json();
  if (!Number.isSafeInteger(Number(result.id))) throw new Error('github-asset-response-invalid');
  return result;
}
async function deleteReleaseAsset(env, id) {
  if (!env.GITHUB_TOKEN || !/^\d{1,20}$/.test(String(id || ''))) return false;
  const config = safeConfig(env);
  if (!config) return false;
  const url = `${GITHUB_API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/releases/assets/${encodeURIComponent(id)}`;
  const response = await fetch(url, { method: 'DELETE', headers: githubHeaders(env) });
  return response.status === 204 || response.status === 404;
}
async function getMapImage(request, env, cors) {
  const worldId = new URL(request.url).searchParams.get('evrenId') || '';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(worldId)) return json({ error: 'invalid-world-id' }, 400, cors);
  const token = bearer(request);
  let data;
  try { data = await supabaseRpc(env, 'evren_gorsel_varlik_oku', { p_evren_id: worldId }, token); }
  catch (error) { return json({ error: error.message === 'not-authorized' ? 'not-authorized' : 'image-unavailable' }, error.message === 'not-authorized' ? 403 : 502, cors); }
  if (!data || data.durum !== 'tamam' || !data.yol || !data.mime || !MIME_EXT[data.mime]) return json({ error: 'image-not-found' }, 404, cors);
  const githubPath = imagePath(String(data.yol).split('/')[0], worldId, data.yol);
  let upstream;
  if (githubPath) {
    if (!env.GITHUB_TOKEN) return json({ error: 'image-storage-not-configured' }, 503, cors);
    const config = safeConfig(env);
    if (!config) return json({ error: 'image-storage-not-configured' }, 503, cors);
    try { await ensurePrivateRepo(env); } catch { return json({ error: 'image-storage-not-configured' }, 503, cors); }
    const url = `${GITHUB_API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/releases/assets/${githubPath.assetId}`;
    upstream = await fetch(url, { headers: githubHeaders(env, 'application/octet-stream'), redirect: 'follow' });
  } else {
    const base = supabaseBase(env);
    const encodedPath = String(data.yol).split('/').map(encodeURIComponent).join('/');
    upstream = await fetch(`${base}/storage/v1/object/${BUCKET}/${encodedPath}`, {
      headers: { apikey: String(env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      redirect: 'follow'
    });
  }
  if (!upstream.ok) return json({ error: upstream.status === 404 ? 'image-not-found' : 'image-unavailable' }, upstream.status === 404 ? 404 : 502, cors);
  const meta = {
    mime: data.mime, width: data.genislik, height: data.yukseklik, alt: data.alt,
    fit: data.kaplama, opacity: data.saydamlik, source: githubPath ? 'github' : 'supabase', path: githubPath ? '' : data.yol
  };
  return new Response(upstream.body, { status: 200, headers: responseMetaHeaders(meta, cors) });
}
async function uploadMapImage(request, env, cors) {
  const token = bearer(request);
  if (!token) return json({ error: 'login-required' }, 401, cors);
  if (!env.GITHUB_TOKEN || !safeConfig(env)) return json({ error: 'image-storage-not-configured' }, 503, cors);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BYTES + 64 * 1024) return json({ error: 'image-too-large' }, 413, cors);
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'invalid-form' }, 400, cors); }
  const file = form.get('file');
  const worldId = String(form.get('evrenId') || '');
  const mime = String(file && file.type || '').toLowerCase();
  if (!file || typeof file.arrayBuffer !== 'function' || !MIME_EXT[mime]) return json({ error: 'unsupported-image' }, 415, cors);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(worldId)) return json({ error: 'invalid-world-id' }, 400, cors);
  if (Number(file.size) < 1 || Number(file.size) > MAX_BYTES) return json({ error: 'image-too-large' }, 413, cors);
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_BYTES) return json({ error: 'image-too-large' }, 413, cors);
  const dimensions = readDimensions(bytes, mime);
  if (!dimensions || !dimensions.width || !dimensions.height || dimensions.width > MAX_EDGE || dimensions.height > MAX_EDGE) return json({ error: 'invalid-image' }, 415, cors);
  let user;
  try { user = await supabaseUser(env, token); }
  catch (error) { return json({ error: error.message === 'supabase-not-configured' ? 'image-storage-not-configured' : 'not-authorized' }, error.message === 'supabase-not-configured' ? 503 : 401, cors); }
  let previous = null;
  try { previous = await supabaseRpc(env, 'evren_gorsel_varlik_oku', { p_evren_id: worldId }, token); } catch { /* save RPC below remains the authorization gate */ }
  let asset;
  try { asset = await uploadReleaseAsset(env, bytes, mime, MIME_EXT[mime]); }
  catch (error) { return json({ error: error.message === 'github-not-configured' ? 'image-storage-not-configured' : 'image-upload-failed' }, error.message === 'github-not-configured' ? 503 : 502, cors); }
  const path = `${user.id}/${worldId}/gh-${asset.id}.${MIME_EXT[mime]}`;
  const rawOpacity = Number(form.get('saydamlik'));
  const opacity = Number.isFinite(rawOpacity) ? Math.max(0, Math.min(1, rawOpacity)) : 1;
  const fit = form.get('kaplama') === 'contain' ? 'contain' : 'cover';
  const alt = String(form.get('alt') || 'Harita resmi').slice(0, 160);
  let saved;
  try {
    saved = await supabaseRpc(env, 'evren_gorsel_varlik_kaydet', {
      p_evren_id: worldId, p_yol: path, p_mime: mime, p_boyut: bytes.byteLength,
      p_genislik: dimensions.width, p_yukseklik: dimensions.height, p_alt: alt,
      p_kaplama: fit, p_saydamlik: opacity
    }, token);
  } catch (error) {
    await deleteReleaseAsset(env, asset.id);
    return json({ error: error.message === 'not-authorized' ? 'not-authorized' : 'image-save-failed' }, error.message === 'not-authorized' ? 403 : 502, cors);
  }
  if (!saved || saved.durum !== 'tamam') {
    await deleteReleaseAsset(env, asset.id);
    return json({ error: saved && saved.durum === 'giris' ? 'login-required' : 'not-authorized' }, saved && saved.durum === 'giris' ? 401 : 403, cors);
  }
  const old = previous && previous.durum === 'tamam' ? imagePath(String(previous.yol || '').split('/')[0], worldId, previous.yol) : null;
  if (old && old.assetId !== String(asset.id)) await deleteReleaseAsset(env, old.assetId);
  return json({
    id: `remote-${worldId}`, tur: 'arka-plan', kaynak: 'github', yol: path, mime, boyut: bytes.byteLength,
    genislik: dimensions.width, yukseklik: dimensions.height, alt, kaplama: fit, saydamlik: opacity,
    herkeseAcik: false
  }, 201, cors);
}
async function deleteMapImage(request, env, cors) {
  const token = bearer(request);
  if (!token) return json({ error: 'login-required' }, 401, cors);
  const worldId = new URL(request.url).searchParams.get('evrenId') || '';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(worldId)) return json({ error: 'invalid-world-id' }, 400, cors);
  let previous;
  try { previous = await supabaseRpc(env, 'evren_gorsel_varlik_oku', { p_evren_id: worldId }, token); }
  catch { return json({ error: 'not-authorized' }, 403, cors); }
  let removed;
  try { removed = await supabaseRpc(env, 'evren_gorsel_varlik_sil', { p_evren_id: worldId }, token); }
  catch { return json({ error: 'not-authorized' }, 403, cors); }
  if (!removed || removed.durum !== 'tamam') return json({ error: 'not-authorized' }, 403, cors);
  const path = String(removed && removed.yol || previous && previous.durum === 'tamam' && previous.yol || '');
  const githubPath = path ? imagePath(path.split('/')[0], worldId, path) : null;
  let cleanup = 'none';
  if (githubPath) cleanup = await deleteReleaseAsset(env, githubPath.assetId) ? 'done' : 'pending';
  return json({ durum: 'tamam', cleanup }, 200, cors);
}
export async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/evren-gorsel') return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  const origin = request.headers.get('Origin') || '';
  if (!originAllowed(origin, request, env)) return json({ error: 'origin-not-allowed' }, 403);
  const cors = corsHeaders(origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method === 'GET') return getMapImage(request, env, cors);
  if (request.method === 'POST') return uploadMapImage(request, env, cors);
  if (request.method === 'DELETE') return deleteMapImage(request, env, cors);
  return json({ error: 'method-not-allowed' }, 405, { ...cors, Allow: 'GET, POST, DELETE, OPTIONS' });
}
export default { fetch: handleRequest };
