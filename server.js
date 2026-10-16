import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHiddenUniversePath } from './scripts/visibility.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.apk': 'application/vnd.android.package-archive',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  // CORS & Security headers: statik sunucu ve API
  const origin = String(req.headers.origin || '');
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy-Report-Only', "default-src 'self' https://static.cloudflareinsights.com; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse URL
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(reqUrl.pathname);
  if (isHiddenUniversePath(pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Not Found');
    return;
  }

  // API endpoints: /api/pano
  if (pathname.startsWith('/api/pano')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ durum: 'ok', mesajlar: [] }));
    return;
  }

  // Eski satış geçmişi dosyası artık web/API üzerinden sunulmaz.
  if (pathname === '/alimlar.json') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Prevent directory traversal
  const rawPath = pathname === '/' ? '' : pathname;
  const safePath = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '').replace(/^[/\\]+/, '');

  function resolveStaticPath(target) {
    const list = [];
    if (!target || target === 'index.html') {
      list.push(path.join(PUBLIC_DIR, 'dist', 'index.html'));
      list.push(path.join(PUBLIC_DIR, 'index.html'));
    } else {
      // 1. Direct file in dist
      list.push(path.join(PUBLIC_DIR, 'dist', target));
      // 2. Directory index in dist (e.g. dist/tomye/index.html)
      list.push(path.join(PUBLIC_DIR, 'dist', target, 'index.html'));
      // 3. Flat html in dist (e.g. dist/tomye.html)
      list.push(path.join(PUBLIC_DIR, 'dist', `${target.replace(/\/+$/, '')}.html`));
      // 4. Direct file in root
      list.push(path.join(PUBLIC_DIR, target));
      // 5. Directory index in root
      list.push(path.join(PUBLIC_DIR, target, 'index.html'));
      // 6. Flat html in root
      list.push(path.join(PUBLIC_DIR, `${target.replace(/\/+$/, '')}.html`));
    }

    for (const cand of list) {
      try {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          return cand;
        }
      } catch {}
    }
    return null;
  }

  let filePath = resolveStaticPath(safePath);
  let statusCode = 200;

  if (!filePath) {
    const cleanRoute = safePath.replace(/^\/+|\/+$/g, '').toLowerCase();
    const knownRoutes = new Set([
      'sen', 'arsiv', 'moderasyon', 'tomye', 'fan', 'oyunlar', 'atolye', 'okuma',
      'baglar', 'dunya', 'belgeler', 'testler', 'araclar', 'proje', 'yonetici',
      'basla', 'harita'
    ]);
    const isSpaFallback = knownRoutes.has(cleanRoute);
    if (isSpaFallback) {
      const distIndex = path.join(PUBLIC_DIR, 'dist', 'index.html');
      filePath = fs.existsSync(distIndex) ? distIndex : path.join(PUBLIC_DIR, 'index.html');
      statusCode = 200;
    } else {
      const dist404 = path.join(PUBLIC_DIR, 'dist', '404.html');
      filePath = fs.existsSync(dist404) ? dist404 : (fs.existsSync(path.join(PUBLIC_DIR, '404.html')) ? path.join(PUBLIC_DIR, '404.html') : path.join(PUBLIC_DIR, 'index.html'));
      statusCode = 404;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  if (ext === '.apk') {
    res.setHeader('Content-Disposition', 'attachment; filename="tentiforapp.apk"');
  }

  // Caching headers
  if (ext === '.apk' || ext === '.html' || pathname === '/sw.js' || pathname.endsWith('.json') || pathname.endsWith('.xml') || pathname.endsWith('.txt')) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  if (req.method === 'HEAD') {
    res.writeHead(statusCode, { 'Content-Type': contentType });
    res.end();
    return;
  }

  res.writeHead(statusCode, { 'Content-Type': contentType });
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Server Error');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TentiFor sunucusu http://localhost:${PORT} üzerinde çalışıyor.`);
});
