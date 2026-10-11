import fs from 'node:fs';
import path from 'node:path';

// Bu liste kaynak içerikleri silmeden yayın katmanında geçici olarak gizler.
export const HIDDEN_UNIVERSE_IDS = new Set(['claude', 'fornek-eterya']);
export const HIDDEN_UNIVERSE_ROUTES = new Set(['claude', 'eterya']);
export const HIDDEN_UNIVERSE_FILES = new Set([
  'js/arsiv/33-claude-evreni.js',
  'js/arsiv/67-claude-evreni-ii.js',
  'ikon/og/claude.png',
  'evrenler/fornek-eterya.json',
  'claude.html',
  'eterya.html',
  'claude/index.html',
  'eterya/index.html'
]);

const HIDDEN_TEXT = /claude|eterya|fornek-eterya/i;

export function isHiddenUniverseAssetPath(value) {
  const normalized = String(value || '').replaceAll('\\', '/').replace(/^\/+/, '').toLocaleLowerCase('tr-TR');
  return HIDDEN_UNIVERSE_FILES.has(normalized) || /(?:^|\/)fornek-eterya(?:\.|\/|$)|(?:^|\/)claude(?:\.|\/|$)/i.test(normalized);
}

export function isHiddenUniversePath(value) {
  const normalized = String(value || '').replace(/^\/+|\/+$/g, '').toLocaleLowerCase('tr-TR');
  const first = normalized.split('/')[0];
  return HIDDEN_UNIVERSE_ROUTES.has(first)
    || HIDDEN_UNIVERSE_FILES.has(normalized)
    || normalized === 'evrenler/fornek-eterya.json';
}

function isHiddenRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return HIDDEN_UNIVERSE_IDS.has(String(value.id || '').toLocaleLowerCase('tr-TR'))
    || HIDDEN_UNIVERSE_IDS.has(String(value.slug || '').toLocaleLowerCase('tr-TR'))
    || HIDDEN_TEXT.test(String(value.dosya || ''));
}

// Yayınlanan veri kopyasında gizli evrenler ve onlara ait metin alanları bulunmaz.
// Kaynak veri.json değişmez; böylece geri açma yalnızca bu katmanın kaldırılmasıdır.
export function sanitizePublicData(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !isHiddenRecord(item) && !(typeof item === 'string' && HIDDEN_TEXT.test(item)))
      .map(sanitizePublicData);
  }
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && HIDDEN_TEXT.test(value) ? undefined : value;
  }
  if (isHiddenRecord(value)) return undefined;

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (HIDDEN_TEXT.test(key) || key === 'modelEvreni') continue;
    const cleaned = sanitizePublicData(item);
    if (cleaned !== undefined) output[key] = cleaned;
  }
  return output;
}

export function writePublicJson(sourcePath, targetPath) {
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const cleaned = sanitizePublicData(source);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
}

// Tüm uygulama kopyalarında hard-coded bölüm başlıklarını da kaldırır.
export function stripHiddenUniverseSections(html) {
  return String(html)
    .replace(/\s*<!--\s*CLAUDE TARAFINDAN YAPILAN EVREN[\s\S]*?<\/section>\s*/gi, '\n')
    .replace(/\s*<!--\s*MODEL TARAFINDAN YAPILAN TEST EVRENİ[\s\S]*?<\/section>\s*/gi, '\n')
    .replace(/\s*<section\b[^>]*\bid=["'](?:claudeEvren|modelEvren)["'][^>]*>[\s\S]*?<\/section>\s*/gi, '\n');
}

export function copyPublicAsset(sourcePath, targetPath, relativePath) {
  if (relativePath === 'veri.json') {
    writePublicJson(sourcePath, targetPath);
    return;
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}
