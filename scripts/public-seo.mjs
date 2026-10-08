import fs from 'node:fs';
import path from 'node:path';

export const SEO_ORIGIN = 'https://tentifor.com';
export const SEO_PAGE_LIMIT = 100;
export const SEO_PAGE_CAP = 5000;
const SOCIAL_IMAGE = `${SEO_ORIGIN}/paylasim.png`;
const PUBLIC_SECTION_PATHS = new Set(['/tomye/', '/fan/', '/oyunlar/', '/atolye/', '/okuma/']);

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function cleanText(value, max = 600) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function short(value, max) {
  const text = cleanText(value, 2000).replace(/\s+/g, ' ');
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function safeWorldSlug(value) {
  const slug = cleanText(value, 60).normalize('NFC').toLocaleLowerCase('tr-TR');
  return /^[\p{L}\p{N}][\p{L}\p{N}-]{2,59}$/u.test(slug) ? slug : null;
}

export function approvedCanonicalUniversePages(rootDir, sourceData) {
  const entries = sourceData && sourceData.fanEserleri && sourceData.fanEserleri.evrenler;
  if (!Array.isArray(entries)) return [];
  const root = path.resolve(rootDir);
  const worldRoot = path.join(root, 'evrenler');
  const seen = new Set();
  const pages = [];
  for (const entry of entries) {
    if (!entry || entry.tur !== 'evren' || entry.kanon !== true) continue;
    const id = cleanText(entry.id, 24).toLowerCase();
    if (!/^e\d{1,6}$/.test(id) || seen.has(id)) continue;
    const relative = `evrenler/${id}.json`;
    if (entry.dosya !== relative) continue;
    const file = path.resolve(root, relative);
    if (!file.startsWith(`${worldRoot}${path.sep}`) || !fs.existsSync(file)) continue;
    let realRoot; let realFile; let world;
    try {
      realRoot = fs.realpathSync(worldRoot);
      realFile = fs.realpathSync(file);
      world = JSON.parse(fs.readFileSync(realFile, 'utf8'));
    } catch { continue; }
    if (!realFile.startsWith(`${realRoot}${path.sep}`) || !world || world.tur !== 'evren' || String(world.id || '').toLowerCase() !== id) continue;
    const item = {
      tur: 'evren', slug: id,
      baslik: cleanText(world.ad || entry.ad || id.toUpperCase(), 120),
      ozet: cleanText(world.ozet || entry.ozet, 600),
      yazar_adi: cleanText(world.yazar_kadi || entry.yazar_kadi || world.yazar || entry.yazar || 'TentiFor', 80)
    };
    if (!seoMetadata(item)) continue;
    seen.add(id);
    pages.push(item);
  }
  return pages;
}

function publicRoute(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.tur === 'sayfa') {
    const sectionPath = String(item.path || '');
    return PUBLIC_SECTION_PATHS.has(sectionPath) ? sectionPath : null;
  }
  if (item.tur === 'profil') {
    const username = cleanText(item.kullanici_adi, 20).toLowerCase();
    return /^[a-z0-9_]{3,20}$/.test(username) ? `/u/${encodeURIComponent(username)}/` : null;
  }
  if (item.tur === 'evren') {
    const slug = safeWorldSlug(item.slug);
    return slug ? `/evren/${encodeURIComponent(slug)}/` : null;
  }
  if (item.tur === 'okuma') {
    const id = cleanText(item.id, 36).toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
      ? `/okuma-yolu/${id}/` : null;
  }
  return null;
}

export function seoMetadata(item) {
  const route = publicRoute(item);
  if (!route) return null;
  if (item.tur === 'sayfa') {
    return { route, title: short(item.title || 'TentiFor', 70), description: short(item.description || 'TentiFor — Tentiforverse arşivi, evrenler ve okuma alanı.', 155), type: 'website', author: 'TentiFor' };
  }
  if (item.tur === 'profil') {
    const username = cleanText(item.kullanici_adi, 20).toLowerCase();
    const display = cleanText(item.gorunen_ad || username, 80);
    const title = `${short(display, 22)} (@${username}) | TentiFor`;
    let description = cleanText(item.hakkinda, 280);
    if (item.icerik_gorunur === false) description = `${display} (@${username}) için TentiFor’te herkese açık profil.`;
    else if (!description) description = `${display} (@${username}) için TentiFor’teki herkese açık profil ve yayınlanmış evrenler.`;
    else description = `${display} (@${username}): ${description}`;
    return { route, title: short(title, 70), description: short(description, 155), type: 'profile', author: display };
  }
  if (item.tur === 'evren') {
    const slug = safeWorldSlug(item.slug);
    const name = cleanText(item.baslik || slug, 120);
    const title = `${short(name, 30)} · ${short(slug, 10)} | TentiFor`;
    let description = cleanText(item.ozet, 600);
    if (!description) description = `${name} — TentiFor’te yayımlanmış bir evren.`;
    return { route, title: short(title, 70), description: short(description, 155), type: 'article', author: cleanText(item.yazar_adi || item.yazar || 'TentiFor', 80) };
  }
  const name = cleanText(item.baslik || 'Okuma yolu', 120);
  const title = `${short(name, 32)} · Okuma yolu | TentiFor`;
  const author = cleanText(item.yazar_adi || item.yazar || 'TentiFor', 80);
  const description = cleanText(item.aciklama, 600) || `${name} — ${author} tarafından paylaşılan herkese açık okuma rotası.`;
  return { route, title: short(title, 70), description: short(description, 155), type: 'article', author };
}

function cardButton(meta) {
  const card = {
    type: meta.type === 'profile' ? 'Profil' : (meta.route.startsWith('/evren/') ? 'Evren' : 'Okuma yolu'),
    title: meta.title,
    author: meta.author,
    description: meta.description,
    url: `${SEO_ORIGIN}${meta.route}`
  };
  return `<button class="dugme dugme-sade tf639-card-button" type="button" data-tf639-card data-type="${escapeHtml(card.type)}" data-title="${escapeHtml(card.title)}" data-author="${escapeHtml(card.author)}" data-description="${escapeHtml(card.description)}" data-url="${escapeHtml(card.url)}">Paylaşım kartını indir</button>`;
}

export function renderSeoBody(item) {
  const meta = seoMetadata(item);
  if (!meta) throw new TypeError('SEO sayfası güvenli ve desteklenen bir public route değil.');
  let body = '';
  if (item.tur === 'sayfa') {
    body = `<span class="tf639-seo-kind">TentiFor</span><h1>${escapeHtml(meta.title.replace(/\s*[|·].*$/, ''))}</h1><p>${escapeHtml(meta.description)}</p>`;
  } else if (item.tur === 'profil') {
    const username = cleanText(item.kullanici_adi, 20).toLowerCase();
    const display = cleanText(item.gorunen_ad || username, 80);
    const bio = item.icerik_gorunur === false ? '' : cleanText(item.hakkinda, 280);
    const worlds = item.icerik_gorunur === false ? [] : (Array.isArray(item.evrenler) ? item.evrenler.slice(0, 30).map((world) => world && ({ ...world, slug: safeWorldSlug(world.slug) })).filter((world) => world && world.slug) : []);
    body = `<p class="tf639-seo-handle">@${escapeHtml(username)}</p>${bio ? `<p>${escapeHtml(bio)}</p>` : ''}` +
      (item.icerik_gorunur === false ? '<p>Bu arşivci içeriklerini herkese açık tutmuyor.</p>' :
        `<h2>Yayınlanmış evrenler</h2>${worlds.length ? `<ul>${worlds.map((world) => `<li><a href="/evren/${encodeURIComponent(world.slug)}/">${escapeHtml(cleanText(world.baslik || world.slug, 120))}</a>${world.ozet ? ` — ${escapeHtml(short(world.ozet, 180))}` : ''}</li>`).join('')}</ul>` : '<p>Henüz yayınlanmış evren yok.</p>'}`);
    body = `<span class="tf639-seo-kind">Herkese açık arşivci profili</span><h1>${escapeHtml(display)}</h1>${body}`;
  } else if (item.tur === 'evren') {
    const author = cleanText(item.yazar_adi || item.yazar || '', 80);
    body = `<span class="tf639-seo-kind">Yayınlanmış evren</span><h1>${escapeHtml(cleanText(item.baslik || item.slug, 120))}</h1>` +
      (author ? `<p class="tf639-seo-author">Yazar: ${escapeHtml(author)}</p>` : '') +
      (item.ozet ? `<p>${escapeHtml(cleanText(item.ozet, 600))}</p>` : '<p>TentiFor’te yayınlanmış bir evren.</p>');
  } else {
    const author = cleanText(item.yazar_adi || item.yazar || 'TentiFor', 80);
    const steps = Array.isArray(item.adimlar) ? item.adimlar.slice(0, 100) : [];
    body = `<span class="tf639-seo-kind">Herkese açık okuma yolu</span><h1>${escapeHtml(cleanText(item.baslik || 'Okuma yolu', 120))}</h1>` +
      `<p class="tf639-seo-author">Yazar: ${escapeHtml(author)}</p>` +
      (item.aciklama ? `<p>${escapeHtml(cleanText(item.aciklama, 600))}</p>` : '') +
      (steps.length ? `<h2>Okuma sırası</h2><ol>${steps.map((step) => `<li>${escapeHtml(cleanText(step && step.baslik || 'Başlıksız adım', 160))}${step && step.tur ? ` <span>(${escapeHtml(cleanText(step.tur, 24))})</span>` : ''}</li>`).join('')}</ol>` : '<p>Bu rotada henüz adım yok.</p>');
  }
  const card = item.tur === 'sayfa' ? '' : cardButton(meta);
  return `<article class="tf639-seo-fallback" id="tf639SeoFallback" data-seo-fallback aria-labelledby="tf639SeoTitle">${body.replace('<h1>', '<h1 id="tf639SeoTitle">')}<p class="tf639-seo-brand">TentiFor · Tentiforverse Arşivi</p>${card}<p><a href="${escapeHtml(meta.route)}">Uygulamada aç</a></p></article>`;
}

function replaceMeta(html, keyType, key, content) {
  const attr = keyType === 'property' ? 'property' : 'name';
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attr}=["']${escapedKey}["'])[^>]*>`, 'gi');
  const tag = `<meta ${attr}="${escapeHtml(key)}" content="${escapeHtml(content)}">`;
  let replaced = false;
  html = html.replace(pattern, () => { if (replaced) return ''; replaced = true; return tag; });
  return replaced ? html : html.replace('</head>', `  ${tag}\n</head>`);
}

function replaceCanonical(html, canonical) {
  const tag = `<link rel="canonical" href="${escapeHtml(canonical)}">`;
  const pattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi;
  let replaced = false;
  html = html.replace(pattern, () => { if (replaced) return ''; replaced = true; return tag; });
  return replaced ? html : html.replace('</head>', `  ${tag}\n</head>`);
}

export function renderSeoPage(indexHtml, item) {
  const meta = seoMetadata(item);
  if (!meta) throw new TypeError('Geçersiz public SEO route.');
  const canonical = `${SEO_ORIGIN}${meta.route}`;
  let html = indexHtml.replace(/<!--[\s\S]*?-->/g, '');
  if (!/<base\b/i.test(html)) html = html.replace('<head>', '<head>\n<base href="/">');
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  html = replaceMeta(html, 'name', 'description', meta.description);
  html = replaceMeta(html, 'name', 'robots', 'index, follow');
  html = replaceMeta(html, 'property', 'og:type', meta.type);
  html = replaceMeta(html, 'property', 'og:title', meta.title);
  html = replaceMeta(html, 'property', 'og:description', meta.description);
  html = replaceMeta(html, 'property', 'og:url', canonical);
  html = replaceMeta(html, 'property', 'og:image', SOCIAL_IMAGE);
  html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = replaceMeta(html, 'name', 'twitter:title', meta.title);
  html = replaceMeta(html, 'name', 'twitter:url', canonical);
  html = replaceMeta(html, 'name', 'twitter:description', meta.description);
  html = replaceMeta(html, 'name', 'twitter:image', SOCIAL_IMAGE);
  html = replaceCanonical(html, canonical);
  const structured = item.tur === 'profil'
    ? { '@context': 'https://schema.org', '@type': 'ProfilePage', name: cleanText(item.gorunen_ad || item.kullanici_adi, 80), description: meta.description, url: canonical }
    : { '@context': 'https://schema.org', '@type': item.tur === 'sayfa' ? 'WebPage' : item.tur === 'okuma' ? 'ItemList' : 'CreativeWork', name: cleanText(item.baslik || item.title || item.slug, 120), description: meta.description, url: canonical };
  const jsonLd = `<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>`;
  html = html.replace('</head>', `${jsonLd}\n</head>`);
  html = html.replace(/<main\b(?=[^>]*\bid=["']tepe["'])[^>]*>/i, (tag) => tag.replace(/\s+hidden\b/i, '').replace(/\s+data-seo-route-background\b/i, '').replace(/>$/, ' hidden data-seo-route-background>'));
  const body = renderSeoBody(item);
  html = html.replace(/<body([^>]*)>/i, `<body$1>\n${body}`);
  return html;
}

export function renderSeoNotFound(indexHtml) {
  let html = indexHtml.replace(/<!--[\s\S]*?-->/g, '');
  if (!/<base\b/i.test(html)) html = html.replace('<head>', '<head>\n<base href="/">');
  html = html.replace(/<title>[^<]*<\/title>/i, '<title>Sayfa bulunamadı — TentiFor</title>');
  html = replaceMeta(html, 'name', 'robots', 'noindex, follow');
  html = replaceMeta(html, 'name', 'description', 'Bu TentiFor sayfası yayında olmayabilir veya adresi değişmiş olabilir.');
  html = replaceMeta(html, 'property', 'og:title', 'Sayfa bulunamadı — TentiFor');
  html = replaceMeta(html, 'property', 'og:description', 'Bu içerik yayında olmayabilir veya adresi değişmiş olabilir.');
  html = html.replace(/<main\b(?=[^>]*\bid=["']tepe["'])[^>]*>/i, (tag) => tag.replace(/\s+hidden\b/i, '').replace(/\s+data-seo-route-background\b/i, '').replace(/>$/, ' hidden data-seo-route-background>'));
  return html.replace(/<body([^>]*)>/i, '<body$1 data-seo-not-found><article class="tf639-seo-fallback"><span class="tf639-seo-kind">TentiFor</span><h1>Sayfa bulunamadı</h1><p>Bu içerik yayında olmayabilir veya adres değişmiş olabilir.</p><p><a href="/">TentiFor ana sayfasına dön</a></p></article>');
}

export function buildSitemap(items, staticPaths = ['/', '/tomye/', '/fan/', '/oyunlar/', '/atolye/', '/okuma/', '/evren/e25/', '/evren/e99/']) {
  const routes = new Set(staticPaths.map((item) => item.startsWith('http') ? new URL(item).pathname : item));
  for (const item of items || []) {
    const meta = seoMetadata(item);
    if (meta) routes.add(meta.route);
  }
  const urls = [...routes].sort((a, b) => a.localeCompare(b, 'tr')).map((route) => `  <url><loc>${escapeHtml(`${SEO_ORIGIN}${route}`)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function readPublicClientConfig(rootDir) {
  const sourcePath = path.join(rootDir, 'js/core/28-hesap.js');
  if (!fs.existsSync(sourcePath)) return null;
  const source = fs.readFileSync(sourcePath, 'utf8');
  const match = source.match(/const HESAP_AYAR=\{url:"(https:\/\/[^"\\]+)",anahtar:"([^"\\]+)"\}/);
  return match ? { url: match[1].replace(/\/$/, ''), apiKey: match[2] } : null;
}

export async function fetchPublicSeoPages(rootDir, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const config = options.config || readPublicClientConfig(rootDir);
  if (!config || typeof fetchImpl !== 'function') return [];
  const timeoutMs = options.timeoutMs || 7000;
  const pageLimit = Math.min(SEO_PAGE_LIMIT, Math.max(1, options.pageLimit || SEO_PAGE_LIMIT));
  const pageCap = Math.min(SEO_PAGE_CAP, Math.max(pageLimit, options.pageCap || SEO_PAGE_CAP));
  const results = [];
  for (const type of ['profil', 'evren', 'okuma']) {
    for (let offset = 0; offset < pageCap; offset += pageLimit) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetchImpl(`${config.url}/rest/v1/rpc/public_seo_sayfalar`, {
          method: 'POST',
          headers: { apikey: config.apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({ p_tur: type, p_limit: pageLimit, p_offset: offset }),
          signal: controller.signal
        });
      } finally { clearTimeout(timer); }
      if (!response || !response.ok) throw new Error(`Public SEO manifest HTTP ${response ? response.status : 'network error'}`);
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error('Public SEO manifest biçimi geçersiz');
      const safeItems = page.filter((item) => seoMetadata(item));
      results.push(...safeItems);
      if (page.length < pageLimit) break;
    }
  }
  return results;
}

export function renderNoindexAppRoute(indexHtml, route) {
  if (!route || typeof route !== 'object' || typeof route.path !== 'string') throw new TypeError('Geçersiz uygulama rotası.');
  const segments = route.path.split('/').filter(Boolean);
  if (!segments.length || route.path !== `/${segments.join('/')}/` || segments.some((segment) => !/^[a-z0-9-]+$/i.test(segment))) {
    throw new TypeError('Güvenli olmayan uygulama rotası.');
  }
  const canonical = `${SEO_ORIGIN}${route.path}`;
  const title = short(route.title || 'TentiFor', 70);
  const description = short(route.description || 'TentiFor uygulama alanı.', 155);
  let html = indexHtml.replace(/<!--[\s\S]*?-->/g, '');
  if (!/<base\b/i.test(html)) html = html.replace('<head>', '<head>\n<base href="/">');
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, 'name', 'description', description);
  html = replaceMeta(html, 'name', 'robots', 'noindex, follow');
  html = replaceMeta(html, 'property', 'og:title', title);
  html = replaceMeta(html, 'property', 'og:description', description);
  html = replaceMeta(html, 'property', 'og:url', canonical);
  html = replaceMeta(html, 'name', 'twitter:title', title);
  html = replaceMeta(html, 'name', 'twitter:description', description);
  html = replaceMeta(html, 'name', 'twitter:url', canonical);
  html = replaceCanonical(html, canonical);
  return html;
}

export function writeSeoRoutes({ indexHtml, distDir, items = [], staticPages = [], appRoutes = [] }) {
  const allItems = [...staticPages, ...items].filter((item) => seoMetadata(item));
  const seen = new Set();
  let written = 0;
  for (const item of allItems) {
    const meta = seoMetadata(item);
    if (!meta || seen.has(meta.route)) continue;
    seen.add(meta.route);
    const target = path.join(distDir, decodeURIComponent(meta.route.replace(/^\//, '')), 'index.html');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, renderSeoPage(indexHtml, item), 'utf8');
    written += 1;
  }
  const distRoot = path.resolve(distDir);
  for (const route of appRoutes) {
    if (!route || typeof route.path !== 'string' || seen.has(route.path)) continue;
    const segments = route.path.split('/').filter(Boolean);
    if (!segments.length || route.path !== `/${segments.join('/')}/` || segments.some((segment) => !/^[a-z0-9-]+$/i.test(segment))) continue;
    const html = renderNoindexAppRoute(indexHtml, route);
    const target = path.resolve(distRoot, ...segments, 'index.html');
    if (!target.startsWith(`${distRoot}${path.sep}`)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html, 'utf8');
    const flatTarget = path.resolve(distRoot, ...segments.slice(0, -1), `${segments.at(-1)}.html`);
    if (flatTarget.startsWith(`${distRoot}${path.sep}`)) {
      fs.mkdirSync(path.dirname(flatTarget), { recursive: true });
      fs.writeFileSync(flatTarget, html, 'utf8');
    }
  }
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), buildSitemap(allItems), 'utf8');
  return written;
}
