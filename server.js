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

const ALIMLAR_FILE = path.join(PUBLIC_DIR, 'alimlar.json');

function getAlimlarDb() {
  try {
    if (fs.existsSync(ALIMLAR_FILE)) {
      return JSON.parse(fs.readFileSync(ALIMLAR_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('alimlar.json okuma hatası:', e);
  }
  return {
    surum: 1,
    guncelleme: new Date().toISOString(),
    toplamAlim: 0,
    toplamEcka: 0,
    alimlar: [],
    evrenler: {},
    sahipler: {}
  };
}

function saveAlimlarDb(db) {
  try {
    const jsonStr = JSON.stringify(db, null, 2);
    fs.writeFileSync(ALIMLAR_FILE, jsonStr, 'utf-8');
    const distFile = path.join(PUBLIC_DIR, 'dist', 'alimlar.json');
    if (fs.existsSync(path.dirname(distFile))) {
      try { fs.writeFileSync(distFile, jsonStr, 'utf-8'); } catch {}
    }
  } catch (e) {
    console.error('alimlar.json kaydetme hatası:', e);
  }
}

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

  // API endpoints: /api/pano
  if (pathname.startsWith('/api/pano')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ durum: 'ok', mesajlar: [] }));
    return;
  }

  // API endpoints: /api/alimlar ve /api/alim
  if (pathname === '/api/alimlar' || pathname === '/api/alim') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 2e6) req.destroy();
      });
      req.on('end', () => {
        try {
          const veri = JSON.parse(body || '{}');
          if (!veri.icerikId && !veri.icerikBaslik) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ durum: 'hata', mesaj: 'İçerik ID veya başlığı gereklidir.' }));
            return;
          }
          const tutar = Math.max(0, Number(veri.tutar) || 0);
          const alim = {
            id: veri.id || `alm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            icerikTur: String(veri.icerikTur || 'roman'),
            icerikId: String(veri.icerikId || ''),
            icerikBaslik: String(veri.icerikBaslik || 'İçerik'),
            evrenId: String(veri.evrenId || 'tomye'),
            evrenAd: String(veri.evrenAd || 'Tömye'),
            evrenSahip: String(veri.evrenSahip || 'TentiFor'),
            alici: String(veri.alici || 'ziyaretci'),
            aliciId: String(veri.aliciId || ''),
            tutar: tutar,
            birim: String(veri.birim || 'eçka'),
            tarih: veri.tarih || new Date().toISOString()
          };

          const db = getAlimlarDb();
          db.toplamAlim = (db.toplamAlim || 0) + 1;
          db.toplamEcka = (db.toplamEcka || 0) + tutar;
          db.guncelleme = new Date().toISOString();
          db.alimlar = Array.isArray(db.alimlar) ? db.alimlar : [];
          db.alimlar.unshift(alim);
          if (db.alimlar.length > 1000) db.alimlar = db.alimlar.slice(0, 1000);

          db.evrenler = db.evrenler || {};
          const ev = db.evrenler[alim.evrenId] = db.evrenler[alim.evrenId] || {
            id: alim.evrenId,
            ad: alim.evrenAd,
            sahip: alim.evrenSahip,
            toplamAlim: 0,
            toplamEcka: 0,
            roman: { adet: 0, ecka: 0 },
            cizim: { adet: 0, ecka: 0 },
            sonAlimlar: []
          };
          ev.ad = alim.evrenAd || ev.ad;
          ev.sahip = alim.evrenSahip || ev.sahip;
          ev.toplamAlim = (ev.toplamAlim || 0) + 1;
          ev.toplamEcka = (ev.toplamEcka || 0) + tutar;
          if (alim.icerikTur === 'roman') {
            ev.roman = ev.roman || { adet: 0, ecka: 0 };
            ev.roman.adet = (ev.roman.adet || 0) + 1;
            ev.roman.ecka = (ev.roman.ecka || 0) + tutar;
          } else if (alim.icerikTur === 'cizim') {
            ev.cizim = ev.cizim || { adet: 0, ecka: 0 };
            ev.cizim.adet = (ev.cizim.adet || 0) + 1;
            ev.cizim.ecka = (ev.cizim.ecka || 0) + tutar;
          }
          ev.sonAlimlar = Array.isArray(ev.sonAlimlar) ? ev.sonAlimlar : [];
          ev.sonAlimlar.unshift(alim);
          if (ev.sonAlimlar.length > 50) ev.sonAlimlar = ev.sonAlimlar.slice(0, 50);

          db.sahipler = db.sahipler || {};
          const sh = db.sahipler[alim.evrenSahip] = db.sahipler[alim.evrenSahip] || {
            sahip: alim.evrenSahip,
            toplamAlim: 0,
            toplamEcka: 0,
            evrenler: {}
          };
          sh.toplamAlim = (sh.toplamAlim || 0) + 1;
          sh.toplamEcka = (sh.toplamEcka || 0) + tutar;
          sh.evrenler = sh.evrenler || {};
          sh.evrenler[alim.evrenId] = (sh.evrenler[alim.evrenId] || 0) + tutar;

          saveAlimlarDb(db);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ durum: 'ok', mesaj: 'Alım sunucuya başarıyla yazıldı.', alim, evrenOzeti: ev }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ durum: 'hata', mesaj: 'Geçersiz JSON: ' + (err && err.message) }));
        }
      });
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const db = getAlimlarDb();
      const evrenParam = reqUrl.searchParams.get('evren');
      const sahipParam = reqUrl.searchParams.get('sahip');

      if (evrenParam) {
        const ev = (db.evrenler && db.evrenler[evrenParam]) || {
          id: evrenParam,
          toplamAlim: 0,
          toplamEcka: 0,
          roman: { adet: 0, ecka: 0 },
          cizim: { adet: 0, ecka: 0 },
          sonAlimlar: []
        };
        const alimlarListesi = (db.alimlar || []).filter((a) => a.evrenId === evrenParam);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ durum: 'ok', evrenId: evrenParam, evrenOzeti: ev, alimlar: alimlarListesi }));
        return;
      }

      if (sahipParam) {
        const sh = (db.sahipler && db.sahipler[sahipParam]) || {
          sahip: sahipParam,
          toplamAlim: 0,
          toplamEcka: 0,
          evrenler: {}
        };
        const alimlarListesi = (db.alimlar || []).filter((a) => a.evrenSahip === sahipParam);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ durum: 'ok', sahip: sahipParam, sahipOzeti: sh, alimlar: alimlarListesi }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        durum: 'ok',
        toplamAlim: db.toplamAlim || 0,
        toplamEcka: db.toplamEcka || 0,
        guncelleme: db.guncelleme,
        alimlar: db.alimlar || [],
        evrenler: db.evrenler || {},
        sahipler: db.sahipler || {}
      }));
      return;
    }

    res.writeHead(405, { Allow: 'GET, POST, HEAD, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
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
    const isSpaFallback = cleanRoute === 'sen' || cleanRoute === 'arsiv' || cleanRoute === 'moderasyon';
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
