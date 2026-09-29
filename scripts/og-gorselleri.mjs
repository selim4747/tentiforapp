/* Paylaşım görselleri (1200×630): her sayfa, kanon evren, E99 ve karşılama için ikon/og/<ad>.png.
   Yayın paketi (scripts/paketle.mjs) bu dosyaları sayfaların og:image etiketine yazar.
   Yeniden üretmek için (Chromium gerekir): node scripts/og-gorselleri.mjs */

import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KOK = new URL("..", import.meta.url).pathname;
const HEDEF = join(KOK, "ikon", "og");
mkdirSync(HEDEF, { recursive: true });

const veri = JSON.parse(readFileSync(join(KOK, "veri.json"), "utf8"));
const gez = readFileSync(join(KOK, "js/arayuz/18-gezinme.js"), "utf8");
const blok = gez.slice(gez.indexOf("const GEZINME"), gez.indexOf("];", gez.indexOf("const GEZINME")));
const sayfalar = [...blok.matchAll(/\{\s*id:\s*"([^"]+)",\s*ad:\s*"([^"]+)"[\s\S]*?bolumler:\s*\[([\s\S]*?)\]\s*\}/g)]
  .map(function (m) { return { id: m[1], ad: m[2], alt: [...m[3].matchAll(/\[\s*"[^"]+",\s*"([^"]+)"\s*\]/g)].map(function (b) { return b[1]; }).slice(0, 5).join(" · ") }; })
  .filter(function (s) { return s.id !== "sen"; });

const kartlar = sayfalar.map(function (s) { return { ad: s.id, ust: "Tentiforverse", baslik: s.ad, alt: s.alt, koyu: false }; });
for (const [id, k] of Object.entries(veri.kanonEvrenleri || {})) {
  kartlar.push({ ad: id, ust: "Kanon evren", baslik: k.ad || id.toUpperCase(),
    alt: id === "e25" ? "Evrengezerlerin evreni · kendi Evrengezerini ekle" : "İçeriği kodla açılır", koyu: true });
}
if (veri.e99) { kartlar.push({ ad: "e99", ust: "Herkesin evreni", baslik: "E99", alt: "Bomboş bir evren: kuralını, kişisini, haritasını sen yaz", koyu: false }); }
kartlar.push({ ad: "basla", ust: "Tentiforverse", baslik: "Hoş geldin, gezgin.", alt: "Tömye'nin gökyüzünde ay yoktur, ama ayları 28 gün çeker.", koyu: true });

const kacir = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
const html = function (k) {
  const z = k.koyu ? "#0B1017" : "#F4F9FD", y = k.koyu ? "#E8EEF4" : "#0A0F14", a = k.koyu ? "#7FB2DC" : "#1C5C96", c = k.koyu ? "#33475C" : "#B8D6EC";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1200px;height:630px;background:${z};color:${y};font-family:Georgia,"DejaVu Serif",serif;overflow:hidden}
  .k{position:absolute;inset:56px 72px;display:flex;flex-direction:column;justify-content:space-between}
  .u{font:600 22px/1 "DejaVu Sans Mono",ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:${a}}
  h1{font-weight:400;font-size:${k.baslik.length > 18 ? 88 : 116}px;line-height:1.02;margin:0}
  .a{font-size:34px;line-height:1.35;max-width:980px;opacity:.85}
  .s{display:flex;justify-content:space-between;align-items:flex-end;font:24px "DejaVu Sans",system-ui,sans-serif;color:${a}}
  .buz{position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(transparent,${c});opacity:.55}
  .t{font:700 30px Georgia,serif;width:64px;height:64px;border:3px solid ${a};border-radius:14px;display:flex;align-items:center;justify-content:center;color:${y}}
  </style></head><body><div class="buz"></div><div class="k"><div class="u">${kacir(k.ust)}</div>
  <div><h1>${kacir(k.baslik)}</h1><p class="a">${kacir(k.alt)}</p></div>
  <div class="s"><span>tentiforapp.pages.dev</span><span class="t">T</span></div></div></body></html>`;
};

const tarayici = await chromium.launch(process.env.CHROMIUM_YOLU ? { executablePath: process.env.CHROMIUM_YOLU } : {});
const sayfa = await tarayici.newPage({ viewport: { width: 1200, height: 630 } });
for (const k of kartlar) {
  await sayfa.setContent(html(k));
  await sayfa.screenshot({ path: join(HEDEF, k.ad + ".png") });
}
await tarayici.close();
console.log(kartlar.length + " paylaşım görseli: " + kartlar.map(function (k) { return k.ad; }).join(", "));
