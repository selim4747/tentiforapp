import fs from 'node:fs';
import path from 'node:path';

export const HIDDEN_UNIVERSE_IDS = new Set();
export const HIDDEN_UNIVERSE_ROUTES = new Set();
export const HIDDEN_UNIVERSE_FILES = new Set();

export function isHiddenUniverseAssetPath() { return false; }
export function isHiddenUniversePath() { return false; }

export function sanitizePublicData(value) {
  if (Array.isArray(value)) return value.map(sanitizePublicData);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) output[key] = sanitizePublicData(item);
  return output;
}

export function writePublicJson(sourcePath, targetPath) {
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(sanitizePublicData(source), null, 2)}\n`, 'utf8');
}

export function stripHiddenUniverseSections(html) { return String(html); }

export function copyPublicAsset(sourcePath, targetPath, relativePath) {
  if (relativePath === 'veri.json') return writePublicJson(sourcePath, targetPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}
