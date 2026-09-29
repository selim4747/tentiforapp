import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Custom headers for specific file extensions
const staticOptions = {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    } else if (filePath.endsWith('.woff2')) {
      res.setHeader('Content-Type', 'font/woff2');
    }
  }
};

// Cloudflare Pages Function replica: /api/pano?t=<tablo>
const SUPABASE = "https://wlgtjbrlquefnzavwein.supabase.co";
const ANAHTAR = "sb_publishable_CHM9EAA3V5nZeQcmKtR0UQ__Xyb4b_F";
const SURE = 600; // 10 minutes cache in seconds
const SIRALAMA = ["haftalik", "sezonluk", "tamlik", "ecka_toplam", "seri", "katman", "madalya", "nobet", "cevirmen", "vardiya", "yazi", "boyut", "baloncuk"];
const SATIR = 20;

function sorgular(t) {
  if (SIRALAMA.indexOf(t) !== -1) {
    return ["/rest/v1/liderlik?select=kullanici_adi,gorunen_ad," + t + "&" + t + "=gt.0&order=" + t + ".desc,guncelleme.asc&limit=" + SATIR];
  }
  if (t === "kulupler") { return ["/rest/v1/kulupler?select=*&order=haftalik.desc"]; }
  if (t === "kulup_savasi") { return ["/rest/v1/kulup_savasi?select=*"]; }
  if (t === "topluluk") { return ["/rest/v1/kulupler?select=kisilik,uye", "/rest/v1/topluluk_roller?select=rol,sayi"]; }
  return null;
}

const panoCache = new Map();

app.get('/api/pano', async (req, res) => {
  const t = String(req.query.t || "");
  const l = sorgular(t);
  if (!l) {
    return res.status(404).json({ hata: "bilinmeyen tablo" });
  }

  const cached = panoCache.get(t);
  if (cached && (Date.now() - cached.time < SURE * 1000)) {
    res.setHeader("Cache-Control", `public, max-age=${SURE}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.json(cached.data);
  }

  try {
    const responses = await Promise.all(l.map(async (yol) => {
      const r = await fetch(SUPABASE + yol, {
        headers: { apikey: ANAHTAR, Accept: "application/json" }
      });
      if (!r.ok) {
        throw new Error("supabase " + r.status);
      }
      return r.json();
    }));

    const data = {
      t: t,
      zaman: new Date().toISOString(),
      veri: responses.length === 1 ? responses[0] : responses
    };

    panoCache.set(t, { time: Date.now(), data });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", `public, max-age=${SURE}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.json(data);
  } catch (e) {
    if (cached) {
      res.setHeader("Cache-Control", "no-store");
      return res.json(cached.data);
    }
    return res.status(502).json({ hata: String(e && e.message || e) });
  }
});

// Determine static root: prefer dist if built, else repository root
const distDir = join(__dirname, 'dist');
const hasDist = existsSync(distDir);
const mainDir = hasDist ? distDir : __dirname;

if (hasDist) {
  app.use(express.static(distDir, staticOptions));
}
app.use(express.static(__dirname, staticOptions));

// SPA fallback for page navigation
app.use((req, res, next) => {
  if (req.method === 'GET' && !extname(req.path)) {
    const targetHtml = hasDist && existsSync(join(distDir, 'index.html'))
      ? join(distDir, 'index.html')
      : join(__dirname, 'index.html');
    return res.sendFile(targetHtml);
  }
  next();
});

app.listen(PORT, HOST, () => {
  console.log(`TentiforApp server running on http://${HOST}:${PORT}`);
});
