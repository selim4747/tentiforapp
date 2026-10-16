import fs from 'node:fs';
import path from 'node:path';

export const SEO_ORIGIN = 'https://tentifor.com';
export const SEO_PAGE_LIMIT = 100;
export const SEO_PAGE_CAP = 5000;
const SOCIAL_IMAGE = `${SEO_ORIGIN}/paylasim.png`;
const PUBLIC_SECTION_PATHS = new Set(['/tomye/', '/fan/', '/oyunlar/', '/atolye/', '/okuma/', '/yonetici/']);

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
