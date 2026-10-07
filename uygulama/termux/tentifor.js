/**
 * @tentifor/termux — Tentiforverse Termux Kütüphanesi
 * Android Termux ortamında Tömye takvimi, isim üretici, evren paketleyici,
 * arşiv tarayıcı ve Termux:API bildirimlerini yöneten modül.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

// Yerel veri kaynağı
function loadVeri() {
  const veriPath = path.join(ROOT_DIR, 'veri.json');
  if (fs.existsSync(veriPath)) {
    try {
      return JSON.parse(fs.readFileSync(veriPath, 'utf8'));
    } catch {}
  }
  return null;
}

const cachedVeri = loadVeri();

/* ==========================================================================
   1. SES ÇİFTLERİ VE İSİM SİSTEMİ
   ========================================================================== */
export const SES_CIFTI = {
  b: 'p', p: 'b',
  c: 'ç', ç: 'c',
  d: 't', t: 'd',
  g: 'k', k: 'g',
  v: 'f', f: 'v',
  z: 's', s: 'z',
  j: 'ş', ş: 'j',
  r: 'l', l: 'r',
  n: 'm', m: 'n',
  a: 'e', e: 'a',
  ı: 'i', i: 'ı',
  o: 'u', u: 'o',
  ö: 'ü', ü: 'ö',
  y: 'y', h: 'h'
};

const UNLULER = 'aeıioöuü';

export function harfCevir(kelime, unluleriKoru = false) {
  let cikti = '';
  for (const harf of String(kelime || '').toLocaleLowerCase('tr')) {
    if (unluleriKoru && UNLULER.includes(harf)) {
      cikti += harf;
      continue;
    }
    cikti += SES_CIFTI[harf] || harf;
  }
  return cikti;
}

export function tersCevir(kelime) {
  return Array.from(String(kelime || '')).reverse().join('');
}

export function basHarf(kelime) {
  const s = String(kelime || '');
  return s ? s.charAt(0).toLocaleUpperCase('tr') + s.slice(1) : '';
}

export const isim = {
  uret(kelime) {
    const k = String(kelime || '').trim().toLocaleLowerCase('tr');
    if (!k) return [];
    return [
      {
        yol: 'harf çevirisi',
        sonuc: basHarf(harfCevir(k, false)),
        aciklama: 'Her harfin ses karşılığı (Tömye, Tarı, Yejen kuralı)'
      },
      {
        yol: 'ters + harf',
        sonuc: basHarf(harfCevir(tersCevir(k), false)),
        aciklama: 'Önce tersten okunur, sonra ses çifti uygulanır (Gırı kuralı)'
      },
      {
        yol: 'ünlüler korunur',
        sonuc: basHarf(harfCevir(k, true)),
        aciklama: 'Yalnızca ünsüzler değişir, akıcı ve yumuşak tını'
      },
      {
        yol: 'sadece ters',
        sonuc: basHarf(tersCevir(k)),
        aciklama: 'Düz ayna yansıması'
      }
    ];
  },

  coz(kelime) {
    const k = String(kelime || '').trim().toLocaleLowerCase('tr');
    if (!k) return [];
    return [
      { yol: 'harf çevirisi', sonuc: basHarf(harfCevir(k, false)) },
      { yol: 'harf sonra ters', sonuc: basHarf(tersCevir(harfCevir(k, false))) },
      { yol: 'sadece ters', sonuc: basHarf(tersCevir(k)) }
    ];
  },

  oneri(tur = 'karakter', adet = 5) {
    const tohumlar = {
      karakter: ['umut', 'korku', 'sabır', 'öfke', 'sessizlik', 'hatıra', 'borç', 'vaat', 'gölge', 'iz', 'yara', 'tanık', 'kayıp', 'başlangıç'],
      sehir: ['liman', 'kıyı', 'geçit', 'kule', 'demir', 'tuz', 'köprü', 'sur', 'pazar', 'çukur', 'yamaç', 'kavşak', 'ocak'],
      ay: ['kar', 'buz', 'don', 'çatlak', 'derin', 'uzak', 'ışık', 'yıldız', 'sabır', 'gece', 'hasat', 'sessiz', 'rüzgar', 'şafak', 'dönüş', 'yanık', 'kök']
    };
    const havuz = tohumlar[tur] || tohumlar.karakter;
    const secilenler = [...havuz].sort(() => 0.5 - Math.random()).slice(0, Math.max(1, adet));
    return secilenler.map((kok) => {
      const u1 = basHarf(harfCevir(kok, false));
      const u2 = basHarf(harfCevir(tersCevir(kok), false));
      return { kok, isim: u1, alternatif: u2 };
    });
  }
};

/* ==========================================================================
   2. TÖMYE TAKVİMİ VE ZAMAN HESAPLAYICI
   ========================================================================== */
export const TAKVIM_VARSAYILAN = {
  epokDunya: '2025-01-01',
  epokYil: 1,
  gunSaat: 25,
  haftaGun: 6,
  gunler: ['Yen', 'Tan', 'Gün', 'Dün', 'Tün', 'Son'],
  aylar: [
    { ad: 'Afor', koken: 'Buz', gun: 28 },
    { ad: 'Bero', koken: 'Geçit', gun: 28 },
    { ad: 'Cora', koken: 'Gölge', gun: 28 },
    { ad: 'Dala', koken: 'Yarık', gun: 28 },
    { ad: 'Etem', koken: 'Rüzgâr', gun: 28 },
    { ad: 'Firo', koken: 'Kıvılcım', gun: 28 },
    { ad: 'Gora', koken: 'Taş', gun: 28 },
    { ad: 'Hane', koken: 'Sığınak', gun: 28 },
    { ad: 'İlen', koken: 'Derinlik', gun: 28 },
    { ad: 'Jora', koken: 'Ayaz', gun: 28 },
    { ad: 'Kyldo', koken: 'Ateş', gun: 30 }
  ]
};

function getTakvimAyar() {
  return (cachedVeri && cachedVeri.takvim) || TAKVIM_VARSAYILAN;
}

export const takvim = {
  yilGun() {
    const a = getTakvimAyar();
    return a.aylar.reduce((top, x) => top + x.gun, 0);
  },

  cevirDunya(dunyaTarihi = new Date()) {
    const a = getTakvimAyar();
    const d = new Date(dunyaTarihi);
    const n = new Date(a.epokDunya + 'T00:00:00Z');
    const saatFarki = (d.getTime() - n.getTime()) / 36e5;
    if (saatFarki < 0) return null;

    const toplamTomyeGunu = Math.floor(saatFarki / a.gunSaat);
    const saat = Math.floor(saatFarki % a.gunSaat);
    const yilGunu = this.yilGun();
    const yil = Math.floor(toplamTomyeGunu / yilGunu) + a.epokYil;

    let kalanGun = toplamTomyeGunu % yilGunu;
    let ayIdx = 0;
    while (ayIdx < a.aylar.length && kalanGun >= a.aylar[ayIdx].gun) {
      kalanGun -= a.aylar[ayIdx].gun;
      ayIdx += 1;
    }
    if (ayIdx >= a.aylar.length) ayIdx = a.aylar.length - 1;

    const aktifAy = a.aylar[ayIdx];
    const gun = kalanGun + 1;
    const haftaGunu = a.gunler[toplamTomyeGunu % a.gunler.length];
    const gunOrani = (saat + ((d.getMinutes() * 60 + d.getSeconds()) / 3600)) / a.gunSaat;

    return {
      yil,
      ayNo: ayIdx + 1,
      ay: aktifAy.ad,
      ayKoken: aktifAy.koken,
      gun,
      saat,
      haftaGunu,
      toplamGun: toplamTomyeGunu,
      gunOrani: Math.min(1, Math.max(0, gunOrani))
    };
  },

  cevirTomye(yil, ayNo, gun, saat = 0) {
    const a = getTakvimAyar();
    const yilGunu = this.yilGun();
    let toplamGun = (yil - a.epokYil) * yilGunu;
    for (let i = 0; i < ayNo - 1 && i < a.aylar.length; i += 1) {
      toplamGun += a.aylar[i].gun;
    }
    toplamGun += gun - 1;
    const n = new Date(a.epokDunya + 'T00:00:00Z');
    const ms = n.getTime() + (toplamGun * a.gunSaat + saat) * 36e5;
    return new Date(ms);
  },

  suan() {
    return this.cevirDunya(new Date());
  },

  metin(t) {
    if (!t) return '—';
    return `${t.gun} ${t.ay} ${t.yil} · ${t.haftaGunu} · ${String(t.saat).padStart(2, '0')}. saat`;
  },

  yasCevir(yas, yon = 'dunyadan') {
    const a = getTakvimAyar();
    const tomyeYilSaat = this.yilGun() * a.gunSaat;
    const dunyaYilSaat = 365.2425 * 24;
    return yon === 'dunyadan'
      ? (yas * dunyaYilSaat) / tomyeYilSaat
      : (yas * tomyeYilSaat) / dunyaYilSaat;
  }
};

/* ==========================================================================
   3. ARŞİV VE KAYIT SORGULAMA
   ========================================================================== */
export const arsiv = {
  karakterler() {
    return (cachedVeri && cachedVeri.karakterler) || [];
  },

  karakterBul(anahtar) {
    const q = String(anahtar || '').trim().toLocaleLowerCase('tr');
    return this.karakterler().find((c) =>
      c.id.toLowerCase() === q || String(c.ad).toLocaleLowerCase('tr') === q || String(c.ad).toLocaleLowerCase('tr').includes(q)
    ) || null;
  },

  evrenler() {
    const list = [];
    if (cachedVeri && cachedVeri.kanonEvrenleri) {
      for (const [k, v] of Object.entries(cachedVeri.kanonEvrenleri)) {
        list.push({ id: k, ...v, tur: 'kanon' });
      }
    }
    if (cachedVeri && cachedVeri.e99) {
      list.push({ id: 'e99', ...cachedVeri.e99, tur: 'ortak' });
    }
    return list;
  },

  ara(terim) {
    const q = String(terim || '').trim().toLocaleLowerCase('tr');
    if (!q) return [];
    const sonuclar = [];

    for (const c of this.karakterler()) {
      if (String(c.ad).toLocaleLowerCase('tr').includes(q) || String(c.tanim || '').toLocaleLowerCase('tr').includes(q)) {
        sonuclar.push({ tur: 'karakter', id: c.id, baslik: c.ad, ozet: c.tanim });
      }
    }

    for (const e of this.evrenler()) {
      if (String(e.ad || e.baslik || '').toLocaleLowerCase('tr').includes(q) || String(e.ozet || '').toLocaleLowerCase('tr').includes(q)) {
        sonuclar.push({ tur: 'evren', id: e.id, baslik: e.ad || e.baslik, ozet: e.ozet });
      }
    }

    if (cachedVeri && cachedVeri.sozluk) {
      for (const s of cachedVeri.sozluk) {
        if (String(s.terim).toLocaleLowerCase('tr').includes(q) || String(s.tanim || '').toLocaleLowerCase('tr').includes(q)) {
          sonuclar.push({ tur: 'sozluk', id: s.terim, baslik: s.terim, ozet: s.tanim });
        }
      }
    }

    return sonuclar.slice(0, 30);
  }
};

/* ==========================================================================
   4. ESER / FAN EVRENİ PAKETLEME & DOĞRULAMA (.tentifor.html)
   ========================================================================== */
export const eser = {
  dogrula(veri) {
    if (!veri || typeof veri !== 'object') {
      return { gecerli: false, hata: 'Eser bir JSON nesnesi olmalıdır.' };
    }
    if (veri.bicim !== 'tentifor-eser') {
      return { gecerli: false, hata: 'bicim alanı "tentifor-eser" olmalıdır.' };
    }
    if (!['evren', 'hikaye'].includes(veri.tur)) {
      return { gecerli: false, hata: 'tur alanı "evren" veya "hikaye" olmalıdır.' };
    }
    if (!veri.id || typeof veri.id !== 'string') {
      return { gecerli: false, hata: 'Geçerli bir "id" alanı zorunludur.' };
    }
    if (veri.tur === 'evren' && !veri.ad) {
      return { gecerli: false, hata: 'Evrenin bir adı ("ad") olmalıdır.' };
    }
    if (veri.tur === 'hikaye' && !veri.baslik && !veri.metin) {
      return { gecerli: false, hata: 'Hikâyenin başlığı ("baslik") veya metni ("metin") bulunmalıdır.' };
    }
    return { gecerli: true };
  },

  dosyadanOku(dosyaYolu) {
    const icerik = fs.readFileSync(dosyaYolu, 'utf8');
    const trim = icerik.trim();
    if (trim.startsWith('{')) {
      const parsed = JSON.parse(trim);
      const v = this.dogrula(parsed);
      if (!v.gecerli) throw new Error(v.hata);
      return parsed;
    }
    const match = icerik.match(/<script type="application\/json" id="tentifor-eser">([\s\S]*?)<\/script>/);
    if (!match) throw new Error('Geçerli bir TentiFor eser dosyası bulunamadı.');
    const parsed = JSON.parse(match[1]);
    const v = this.dogrula(parsed);
    if (!v.gecerli) throw new Error(v.hata);
    return parsed;
  },

  paketleHtml(eserObj, ciktiYolu) {
    const v = this.dogrula(eserObj);
    if (!v.gecerli) throw new Error(v.hata);

    const jsonText = JSON.stringify(eserObj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    const baslik = eserObj.tur === 'hikaye' ? (eserObj.baslik || 'Adsız Hikâye') : (eserObj.ad || 'Adsız Evren');
    const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${baslik} — TentiFor fan eseri</title>
<style>
body{margin:0;background:#F4F9FD;color:#0A0F14;font:18px/1.7 Georgia,serif}
main{max-width:680px;margin:0 auto;padding:32px 18px 60px}
h1{font-weight:400;font-size:34px;line-height:1.2;margin:0 0 6px}
footer{margin-top:48px;font:13px/1.6 system-ui,sans-serif;color:#3D4A57;border-top:1px solid #B8D6EC;padding-top:12px}
</style>
</head><body><main>
<h1>${baslik}</h1>
<p>${eserObj.ozet || ''}</p>
<footer>TentiFor taşınabilir fan eseri · Termux aracı ile paketlendi.</footer>
</main>
<script type="application/json" id="tentifor-eser">${jsonText}</script>
</body></html>\n`;

    fs.writeFileSync(ciktiYolu, html, 'utf8');
    return ciktiYolu;
  }
};

/* ==========================================================================
   5. ANDROID TERMUX NATIVE API ENTEGRASYONU
   ========================================================================== */
export const termux = {
  aktifMi() {
    return Boolean(process.env.TERMUX_VERSION || process.env.PREFIX?.includes('com.termux'));
  },

  async komutCalistir(komut, args = []) {
    try {
      const res = await execFileAsync(komut, args);
      return { basarili: true, cikti: res.stdout.trim() };
    } catch (err) {
      return { basarili: false, hata: err.message };
    }
  },

  async bildirim({ baslik = 'TentiFor', metin = '', id = 'tentifor_notif', url = '' } = {}) {
    const args = ['--title', baslik, '--content', metin, '--id', id];
    if (url) args.push('--action', `am start -a android.intent.action.VIEW -d "${url}"`);
    return this.komutCalistir('termux-notification', args);
  },

  async toast(mesaj = '', kisa = true) {
    const args = [mesaj];
    if (kisa) args.push('-s');
    return this.komutCalistir('termux-toast', args);
  },

  async titresim(sureMs = 200) {
    return this.komutCalistir('termux-vibrate', ['-d', String(sureMs)]);
  },

  async panoyaKopyala(metin) {
    return this.komutCalistir('termux-clipboard-set', [metin]);
  }
};

export default {
  isim,
  takvim,
  arsiv,
  eser,
  termux
};
