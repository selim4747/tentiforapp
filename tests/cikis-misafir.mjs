/* Çıkış → misafir sıfırlama: tarayıcı olmadan localStorage davranışını doğrular.
   Çalıştır: node tests/cikis-misafir.mjs
   (npm test içindeki Playwright senaryosu aynı akışı gerçek sayfada da dener.) */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KOK = join(dirname(fileURLToPath(import.meta.url)), "..");
const kod = readFileSync(join(KOK, "js/28-hesap.js"), "utf8");

function al(ad) {
  const re = new RegExp("function " + ad + "\\s*\\([^)]*\\)\\s*\\{");
  const m = kod.match(re);
  if (!m) { throw new Error(ad + " bulunamadı"); }
  const start = m.index;
  let i = kod.indexOf("{", start), n = 0;
  for (; i < kod.length; i++) {
    if (kod[i] === "{") { n++; }
    else if (kod[i] === "}") { n--; if (n === 0) { return kod.slice(start, i + 1); } }
  }
  throw new Error(ad + " kapanmadı");
}

const depo = {
  "tentiforapp_cuzdan": JSON.stringify({ ecka: 999 }),
  "tentiforapp_cozulen": JSON.stringify({ x: "KOD" }),
  "tentiforapp_madalyalar": "[\"x\"]",
  "tentiforapp_sayfa": "sen",
  "tentiforapp_tur": "bitti",
  "tentiforapp_yonetici": "gizli",
  "sb-tentiforapp-oturum": "oturum",
  "baska": "durur"
};
const localStorage = {
  get length() { return Object.keys(depo).length; },
  key(i) { return Object.keys(depo)[i] || null; },
  getItem(k) { return Object.prototype.hasOwnProperty.call(depo, k) ? depo[k] : null; },
  setItem(k, v) { depo[k] = String(v); },
  removeItem(k) { delete depo[k]; }
};

const ESITLEME_DISI = [
  "tentiforapp_github", "tentiforapp_yonetici", "tentiforapp_katman_kodlari", "tentiforapp_duzenleme",
  "tentiforapp_konum", "tentiforapp_sayfa", "tentiforapp_tur",
  "tentiforapp_ziyaret_izleri", "tentiforapp_ziyaret_fark", "tentiforapp_fan_acilan", "tentiforapp_bildirim", "tentiforapp_yayin_kancasi"
];

const fn = al("hesapYerelIlerlemeyiTemizle");
if (!kod.includes("location.reload()")) { throw new Error("hesapCikis sayfayı yenilemiyor"); }
if (kod.includes("Bu cihazdaki ilerlemen yerinde duruyor")) { throw new Error("eski çıkış metni duruyor"); }

const hesapYerelIlerlemeyiTemizle = new Function("window", "ESITLEME_DISI", fn + "\nreturn hesapYerelIlerlemeyiTemizle;")({ localStorage }, ESITLEME_DISI);
hesapYerelIlerlemeyiTemizle();

const silinen = ["tentiforapp_cuzdan", "tentiforapp_cozulen", "tentiforapp_madalyalar"];
const duran = ["tentiforapp_sayfa", "tentiforapp_tur", "tentiforapp_yonetici", "sb-tentiforapp-oturum", "baska"];
for (const k of silinen) {
  if (depo[k] != null) { throw new Error("silinmedi: " + k); }
}
for (const k of duran) {
  if (depo[k] == null) { throw new Error("yanlışlıkla silindi: " + k); }
}
console.log("çıkış misafir birim testi geçti: ilerleme silindi, cihaz kayıtları durdu.");
