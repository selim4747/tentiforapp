#!/usr/bin/env node

/**
 * Tentiforverse Termux CLI
 * Terminal üzerinden Tömye saatini, takvimini, isim üreticisini ve evren paketleyicisini çalıştırır.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isim, takvim, arsiv, eser, termux } from '../tentifor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Renk kodları (ANSI)
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function banner() {
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║   ${C.yellow}TENTİFORVERSE${C.cyan} · Android Termux Arşiv ve Zaman Konsolu   ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════════╝${C.reset}\n`);
}

function help() {
  banner();
  console.log(`${C.bold}KULLANIM:${C.reset}`);
  console.log(`  tentifor <komut> [seçenekler]\n`);
  console.log(`${C.bold}KOMUTLAR:${C.reset}`);
  console.log(`  ${C.green}saat${C.reset}                Tömye'deki güncel 25 saatlik zamanı ve günü gösterir`);
  console.log(`  ${C.green}takvim [ay]${C.reset}         Tömye takviminin ay tablosunu ve yapısını çizer`);
  console.log(`  ${C.green}cevir <YYYY-AA-GG>${C.reset}  Dünya tarihini Tömye takvimine çevirir`);
  console.log(`  ${C.green}yas <sayi>${C.reset}          Dünya ve Tömye arasındaki yaş çevirisini yapar`);
  console.log(`  ${C.green}isim <kelime>${C.reset}       Ses çifti kuralıyla (Tömye/Tarı/Gırı) isim üretir`);
  console.log(`  ${C.green}isim oneri [tur]${C.reset}   Karakter, şehir veya ay adı önerileri üretir`);
  console.log(`  ${C.green}ara <terim>${C.reset}         Arşivde karakter, evren veya sözlük terimi arar`);
  console.log(`  ${C.green}karakter <ad/id>${C.reset}    Karakter kartını ve detaylarını getirir`);
  console.log(`  ${C.green}evren [id]${C.reset}          Kanon evrenleri listeler veya detayını verir`);
  console.log(`  ${C.green}dogrula <dosya>${C.reset}     Fan evreni veya hikâye JSON dosyasını denetler`);
  console.log(`  ${C.green}paketle <in> [out]${C.reset}  Evren JSON dosyasını taşınabilir .tentifor.html yapar`);
  console.log(`  ${C.green}cikar <dosya.html>${C.reset}  .tentifor.html dosyasından evren JSON verisini çıkarır`);
  console.log(`  ${C.green}bildirim <bask> <m>${C.reset} Termux Android bildirim çubuğuna bildirim atar`);
  console.log(`  ${C.green}toast <mesaj>${C.reset}       Android ekranına kısa toast bildirimi basar`);
  console.log(`  ${C.green}yardim${C.reset}              Bu yardım ekranını gösterir\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'saat';

  switch (cmd) {
    case 'saat':
    case 'now':
    case 'time': {
      const now = takvim.suan();
      banner();
      console.log(`${C.bold}TÖMYE ZAMANI:${C.reset}`);
      console.log(`  📅 ${C.yellow}${now.gun} ${now.ay} ${now.yil}${C.reset} · ${C.cyan}${now.haftaGunu}${C.reset}`);
      console.log(`  ⏰ ${C.bold}${String(now.saat).padStart(2, '0')}. SAAT${C.reset} (Gün 25 saat çeker)`);
      console.log(`  🌿 Ay kökeni: ${C.italic}${now.ayKoken}${C.reset} (${now.ayNo}. ay)`);

      const barLen = 30;
      const filled = Math.round(now.gunOrani * barLen);
      const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
      const pct = Math.round(now.gunOrani * 100);
      console.log(`  ⏳ Gün İlerlemesi: [${C.green}${bar}${C.reset}] %${pct}`);
      console.log(`  📜 Epoktan bu yana toplam gün: ${C.dim}${now.toplamGun}${C.reset}\n`);
      break;
    }

    case 'takvim':
    case 'cal': {
      const now = takvim.suan();
      banner();
      console.log(`${C.bold}TÖMYE TAKVİM DÜZENİ:${C.reset}`);
      console.log(`  • 1 Gün = 25 Saat | 1 Yıl = 310 Gün | 1 Hafta = 6 Gün | Aylar = 28 Gün (Kyldo 30)\n`);

      console.log(`${C.bold}Haftanın Günleri:${C.reset} Yen · Tan · Gün · Dün · Tün · Son\n`);
      console.log(`${C.bold}Aylar:${C.reset}`);
      const aylar = [
        ['1. Afor (Buz)', '28 gün'],
        ['2. Bero (Geçit)', '28 gün'],
        ['3. Cora (Gölge)', '28 gün'],
        ['4. Dala (Yarık)', '28 gün'],
        ['5. Etem (Rüzgâr)', '28 gün'],
        ['6. Firo (Kıvılcım)', '28 gün'],
        ['7. Gora (Taş)', '28 gün'],
        ['8. Hane (Sığınak)', '28 gün'],
        ['9. İlen (Derinlik)', '28 gün'],
        ['10. Jora (Ayaz)', '28 gün'],
        ['11. Kyldo (Ateş)', '30 gün']
      ];
      aylar.forEach(([ad, gun]) => {
        const isCurrent = ad.toLowerCase().includes(now.ay.toLowerCase());
        const mark = isCurrent ? `${C.yellow}◀ Şu anki ay${C.reset}` : '';
        console.log(`  ${isCurrent ? C.bold + C.green : C.dim}• ${ad.padEnd(24)} : ${gun}${C.reset} ${mark}`);
      });
      console.log();
      break;
    }

    case 'cevir': {
      const dateStr = args[1];
      if (!dateStr) {
        console.error(`${C.red}Hata:${C.reset} Lütfen bir tarih girin. Örn: tentifor cevir 2026-10-06`);
        process.exit(1);
      }
      const res = takvim.cevirDunya(new Date(dateStr));
      if (!res) {
        console.error(`${C.red}Hata:${C.reset} Geçersiz tarih veya epok öncesi.`);
        process.exit(1);
      }
      console.log(`${C.green}✓ Tömye Karşılığı:${C.reset} ${takvim.metin(res)} (Ay: ${res.ayKoken})`);
      break;
    }

    case 'yas': {
      const val = parseFloat(args[1]);
      if (isNaN(val)) {
        console.error(`${C.red}Hata:${C.reset} Geçerli bir yaş belirtin. Örn: tentifor yas 24`);
        process.exit(1);
      }
      const isTomye = args.includes('--tomyeden');
      if (isTomye) {
        const dunya = takvim.yasCevir(val, 'tomyeden');
        console.log(`${val} Tömye yılı ≈ ${C.bold}${dunya.toFixed(1)}${C.reset} Dünya yılı`);
      } else {
        const tomye = takvim.yasCevir(val, 'dunyadan');
        console.log(`${val} Dünya yılı ≈ ${C.bold}${tomye.toFixed(1)}${C.reset} Tömye yılı`);
      }
      console.log(`${C.dim}(Kyldo ortalama ömrü: 250 Tömye yılı ≈ 220 Dünya yılı)${C.reset}`);
      break;
    }

    case 'isim': {
      const sub = args[1];
      if (!sub) {
        console.error(`${C.red}Hata:${C.reset} Lütfen çevrilecek bir kelime yazın veya "oneri" komutunu kullanın.`);
        console.error(`Örn: tentifor isim çatlak\n     tentifor isim oneri karakter`);
        process.exit(1);
      }

      if (sub === 'oneri') {
        const tur = args[2] || 'karakter';
        const adet = parseInt(args[3], 10) || 5;
        const oneriler = isim.oneri(tur, adet);
        console.log(`${C.bold}Tentiforverse ${tur.toUpperCase()} Adı Önerileri:${C.reset}\n`);
        oneriler.forEach((o, i) => {
          console.log(`  ${i + 1}. ${C.bold}${C.yellow}${o.isim}${C.reset} (Kök: ${o.kok} · Diğer yol: ${o.alternatif})`);
        });
        console.log();
        return;
      }

      const sonuclar = isim.uret(sub);
      console.log(`${C.bold}Girdi:${C.reset} "${sub}" için üretilen Tentiforverse isimleri:\n`);
      sonuclar.forEach((s) => {
        console.log(`  ${C.bold}${C.yellow}${s.sonuc.padEnd(16)}${C.reset} [${C.cyan}${s.yol}${C.reset}]`);
        console.log(`  ${C.dim}↳ ${s.aciklama}${C.reset}\n`);
      });
      break;
    }

    case 'ara': {
      const q = args.slice(1).join(' ');
      if (!q) {
        console.error(`${C.red}Hata:${C.reset} Arama terimi girin. Örn: tentifor ara Ax`);
        process.exit(1);
      }
      const sonuclar = arsiv.ara(q);
      console.log(`"${q}" için ${sonuclar.length} kayıt bulundu:\n`);
      if (!sonuclar.length) {
        console.log(`  ${C.dim}Hiçbir sonuç eşleşmedi.${C.reset}\n`);
        return;
      }
      sonuclar.forEach((s) => {
        console.log(`  • [${C.cyan}${s.tur.toUpperCase()}${C.reset}] ${C.bold}${s.baslik}${C.reset}`);
        if (s.ozet) console.log(`    ${C.dim}${String(s.ozet).slice(0, 120)}…${C.reset}`);
      });
      console.log();
      break;
    }

    case 'karakter': {
      const q = args.slice(1).join(' ');
      if (!q) {
        console.error(`${C.red}Hata:${C.reset} Karakter adı veya kimliği belirtin. Örn: tentifor karakter Ax`);
        process.exit(1);
      }
      const c = arsiv.karakterBul(q);
      if (!c) {
        console.error(`${C.red}Hata:${C.reset} "${q}" adında bir karakter bulunamadı.`);
        process.exit(1);
      }
      console.log(`${C.bold}${C.yellow}${c.ad}${C.reset} [${c.id}]`);
      if (c.tanim) console.log(`\n${C.bold}Özet:${C.reset} ${c.tanim}`);
      if (c.aciklama) console.log(`\n${c.aciklama}`);
      if (Array.isArray(c.kutular) && c.kutular.length) {
        console.log(`\n${C.bold}Kayıt Kutuları (${c.kutular.length}):${C.reset}`);
        c.kutular.forEach((k) => console.log(`  • ${k.baslik || 'Kutu'}: ${String(k.metin || '').slice(0, 80)}…`));
      }
      console.log();
      break;
    }

    case 'evren': {
      const list = arsiv.evrenler();
      const q = args[1];
      if (!q) {
        console.log(`${C.bold}Mevcut Kanon ve Ortak Evrenler:${C.reset}\n`);
        list.forEach((e) => {
          console.log(`  • [${C.cyan}${e.id}${C.reset}] ${C.bold}${e.ad || e.baslik}${C.reset} (${e.tur})`);
          if (e.ozet) console.log(`    ${C.dim}${String(e.ozet).slice(0, 100)}…${C.reset}`);
        });
        console.log(`\nDetay için: tentifor evren <id>\n`);
        return;
      }
      const target = list.find((e) => e.id.toLowerCase() === q.toLowerCase());
      if (!target) {
        console.error(`${C.red}Hata:${C.reset} "${q}" kimlikli evren bulunamadı.`);
        process.exit(1);
      }
      console.log(`${C.bold}${C.yellow}${target.ad || target.baslik}${C.reset} [${target.id}]`);
      console.log(`Tür: ${target.tur}`);
      if (target.ozet) console.log(`\n${target.ozet}`);
      console.log();
      break;
    }

    case 'dogrula': {
      const file = args[1];
      if (!file) {
        console.error(`${C.red}Hata:${C.reset} Doğrulanacak dosya yolunu belirtin.`);
        process.exit(1);
      }
      try {
        const data = eser.dosyadanOku(file);
        console.log(`${C.green}✓ Dosya geçerli bir TentiforApp eseridir!${C.reset}`);
        console.log(`  Başlık/Ad : ${data.ad || data.baslik}`);
        console.log(`  Tür       : ${data.tur}`);
        console.log(`  ID        : ${data.id}`);
      } catch (err) {
        console.error(`${C.red}❌ Doğrulama Hatası:${C.reset} ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'paketle': {
      const inFile = args[1];
      const outFile = args[2] || (inFile ? inFile.replace(/\.json$/, '') + '.tentifor.html' : null);
      if (!inFile || !outFile) {
        console.error(`${C.red}Hata:${C.reset} tentifor paketle <girdi.json> [cikti.tentifor.html]`);
        process.exit(1);
      }
      try {
        const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
        eser.paketleHtml(raw, outFile);
        console.log(`${C.green}✓ Başarıyla paketlendi:${C.reset} ${outFile}`);
      } catch (err) {
        console.error(`${C.red}❌ Paketleme Hatası:${C.reset} ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'cikar': {
      const inFile = args[1];
      const outFile = args[2] || (inFile ? inFile.replace(/\.tentifor\.html$/, '') + '.json' : null);
      if (!inFile) {
        console.error(`${C.red}Hata:${C.reset} tentifor cikar <dosya.tentifor.html> [cikti.json]`);
        process.exit(1);
      }
      try {
        const data = eser.dosyadanOku(inFile);
        if (outFile) {
          fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf8');
          console.log(`${C.green}✓ JSON dışa aktarıldı:${C.reset} ${outFile}`);
        } else {
          console.log(JSON.stringify(data, null, 2));
        }
      } catch (err) {
        console.error(`${C.red}❌ Hata:${C.reset} ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'bildirim': {
      const title = args[1] || 'TentiforApp';
      const msg = args.slice(2).join(' ') || 'Tömye takviminde yeni bir döngü başladı.';
      const res = await termux.bildirim({ baslik: title, metin: msg });
      if (res.basarili) {
        console.log(`${C.green}✓ Bildirim gönderildi.${C.reset}`);
      } else {
        console.log(`${C.yellow}Termux API yanıtı:${C.reset} ${res.hata || 'Termux:API paketi bulunamadı'}`);
      }
      break;
    }

    case 'toast': {
      const msg = args.slice(1).join(' ') || 'TentiforApp Termux Hazır';
      await termux.toast(msg);
      console.log(`${C.green}✓ Toast çağrıldı.${C.reset}`);
      break;
    }

    case 'yardim':
    case '--help':
    case '-h':
    default:
      help();
      break;
  }
}

main().catch((err) => {
  console.error(`${C.red}Beklenmeyen hata:${C.reset}`, err);
  process.exit(1);
});
