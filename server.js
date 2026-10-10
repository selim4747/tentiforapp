import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  // CORS & Security headers: statik sunucu yalnızca aynı-origin GET/HEAD sağlar.
  const origin = String(req.headers.origin || '');
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
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
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  // Parse URL
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(reqUrl.pathname);

  // API endpoints mock/passthrough
  if (pathname.startsWith('/api/pano')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ durum: 'ok', mesajlar: [] }));
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
    const ext = path.extname(safePath).toLowerCase();
    if (ext && ext !== '.html') {
      // Static asset missing -> 404
      const dist404 = path.join(PUBLIC_DIR, 'dist', '404.html');
      filePath = fs.existsSync(dist404) ? dist404 : path.join(PUBLIC_DIR, 'index.html');
      statusCode = 404;
    } else {
      // SPA Fallback: serve index.html (prefer dist/index.html if available)
      const distIndex = path.join(PUBLIC_DIR, 'dist', 'index.html');
      filePath = fs.existsSync(distIndex) ? distIndex : path.join(PUBLIC_DIR, 'index.html');
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
