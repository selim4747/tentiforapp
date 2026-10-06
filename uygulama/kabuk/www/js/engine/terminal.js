/**
 * Tentiforverse Gelişmiş Web Terminali (T-Term)
 * Aysız gezegen Tömye'nin 25 saatlik zamanı, ses çifti isim üreticisi,
 * arşiv kayıtları, evren sorguları, kod çözücü ve 404 kurtarma konsolu.
 */
(function () {
  'use strict';

  var KOMUTLAR = [
    'yardim', 'help', 'saat', 'time', 'takvim', 'cal', 'cevir', 'yas',
    'isim', 'oneri', 'sesler', 'ara', 'karakter', 'evren', 'sozluk',
    'girilar', 'necale', 'ozan', 'eylul', 'katmanlar', 'somdo', 'defter',
    'kod', 'cuzdan', 'rozetler', 'tema', 'git', 'oyun', 'zar',
    'matrix', 'whoami', 'surum', 'temizle', 'clear', 'echo'
  ];

  var TEMA_LISTESI = ['buz', 'gece', 'kutuphane', 'orman', 'ara', 'virus', 'uclu', 'tas'];

  var SES_CIFTI = {
    b: 'p', p: 'b', c: 'ç', ç: 'c', d: 't', t: 'd', g: 'k', k: 'g',
    v: 'f', f: 'v', z: 's', s: 'z', j: 'ş', ş: 'j', r: 'l', l: 'r',
    n: 'm', m: 'n', a: 'e', e: 'a', ı: 'i', i: 'ı', o: 'u', u: 'o',
    ö: 'ü', ü: 'ö', y: 'y', h: 'h'
  };

  var UNLULER = 'aeıioöuü';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function harfCevir(kelime, unluKoru) {
    var out = '';
    for (var i = 0; i < kelime.length; i++) {
      var h = kelime[i].toLocaleLowerCase('tr');
      if (unluKoru && UNLULER.indexOf(h) !== -1) {
        out += h;
      } else {
        out += SES_CIFTI[h] || h;
      }
    }
    return out;
  }

  function tersCevir(kelime) {
    return Array.from(String(kelime || '')).reverse().join('');
  }

  function basHarf(s) {
    return s ? s.charAt(0).toLocaleUpperCase('tr') + s.slice(1) : '';
  }

  // Tömye Takvim Hesaplayıcı
  function getTomyeZaman(dunyaDate) {
    var v = typeof veri !== 'undefined' && veri ? veri.takvim : null;
    var epokDunya = v && v.epokDunya ? v.epokDunya : '2025-01-01';
    var epokYil = v && v.epokYil ? v.epokYil : 1;
    var gunSaat = v && v.gunSaat ? v.gunSaat : 25;
    var aylar = v && v.aylar ? v.aylar : [
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
    ];
    var gunler = v && v.gunler ? v.gunler : ['Yen', 'Tan', 'Gün', 'Dün', 'Tün', 'Son'];

    var d = dunyaDate || new Date();
    var n = new Date(epokDunya + 'T00:00:00Z');
    var saatFarki = (d.getTime() - n.getTime()) / 36e5;
    if (saatFarki < 0) return null;

    var toplamGun = Math.floor(saatFarki / gunSaat);
    var saat = Math.floor(saatFarki % gunSaat);
    var yilGunu = aylar.reduce(function (top, x) { return top + x.gun; }, 0);
    var yil = Math.floor(toplamGun / yilGunu) + epokYil;

    var kalanGun = toplamGun % yilGunu;
    var ayIdx = 0;
    while (ayIdx < aylar.length && kalanGun >= aylar[ayIdx].gun) {
      kalanGun -= aylar[ayIdx].gun;
      ayIdx += 1;
    }
    if (ayIdx >= aylar.length) ayIdx = aylar.length - 1;

    var aktifAy = aylar[ayIdx];
    var gun = kalanGun + 1;
    var haftaGunu = gunler[toplamGun % gunler.length];
    var gunOrani = (saat + ((d.getMinutes() * 60 + d.getSeconds()) / 3600)) / gunSaat;

    return {
      yil: yil,
      ayNo: ayIdx + 1,
      ay: aktifAy.ad,
      ayKoken: aktifAy.koken,
      gun: gun,
      saat: saat,
      haftaGunu: haftaGunu,
      toplamGun: toplamGun,
      gunOrani: Math.min(1, Math.max(0, gunOrani)),
      aylar: aylar
    };
  }

  // Terminal DOM & UI Şablonu
  var CSS = `
    .tf-term-modal {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(10, 15, 20, 0.85); backdrop-filter: blur(8px);
      padding: 16px;
    }
    .tf-term-modal[hidden] { display: none !important; }
    .tf-term-box {
      width: 100%; max-width: 900px; height: 580px; max-height: 90vh;
      background: #080D13; border: 1px solid #1C5C96; border-radius: 8px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 24px rgba(28,92,150,0.3);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: 'DM Mono', ui-monospace, monospace; font-size: 13.5px; line-height: 1.5;
      color: #7FB2DC; position: relative;
    }
    .tf-term-box.maximized { max-width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
    .tf-term-header {
      background: #0D1622; border-bottom: 1px solid #1C2B3C;
      padding: 9px 14px; display: flex; align-items: center; justify-content: space-between;
      user-select: none;
    }
    .tf-term-dots { display: flex; gap: 7px; align-items: center; }
    .tf-term-dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; cursor: pointer; }
    .tf-term-dot.red { background: #FF5F56; }
    .tf-term-dot.yellow { background: #FFBD2E; }
    .tf-term-dot.green { background: #27C93F; }
    .tf-term-title { font-weight: 600; color: #E8EEF4; letter-spacing: 0.04em; font-size: 12px; }
    .tf-term-body {
      flex: 1; overflow-y: auto; padding: 14px 16px;
      display: flex; flex-direction: column; gap: 8px;
      background: radial-gradient(circle at 50% 0%, #0d1e30 0%, #070b10 80%);
    }
    .tf-term-pills {
      display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 14px;
      background: #091019; border-top: 1px solid #152233;
    }
    .tf-term-pill {
      background: #101c2a; color: #8ec3ea; border: 1px solid #1f354f;
      padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;
      font-family: inherit; transition: 0.15s;
    }
    .tf-term-pill:hover { background: #1c5c96; color: #fff; }
    .tf-term-input-row {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px;
      background: #0D1622; border-top: 1px solid #1C2B3C;
    }
    .tf-term-prompt { color: #27C93F; font-weight: bold; flex-shrink: 0; }
    .tf-term-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #FFF; font-family: inherit; font-size: 14px;
    }
    .tf-term-line { white-space: pre-wrap; word-break: break-word; }
    .tf-term-line.cmd { color: #FFF; font-weight: bold; }
    .tf-term-line.good { color: #5AF78E; }
    .tf-term-line.warn { color: #F3F99D; }
    .tf-term-line.bad { color: #FF6E67; }
    .tf-term-line.info { color: #57C7FF; }
    .tf-term-line.dim { color: #6272A4; }
    .tf-term-line.head { color: #BD93F9; font-weight: bold; }
    .tf-term-box a, .tf-term-box .tf-link {
      color: #57C7FF; text-decoration: underline; cursor: pointer;
    }
    /* Gömülü 404 terminal stili */
    .yok-terminal-kapsayici {
      margin-top: 24px; width: 100%; border-radius: 8px; overflow: hidden;
      border: 1px solid #1C5C96;
    }
    .yok-terminal-kapsayici .tf-term-box {
      height: 380px; max-height: 60vh;
    }
    /* Header toggle butonu */
    .terminal-toggle-btn {
      font-family: var(--mono, monospace); font-weight: 700;
      color: var(--deniz, #1C5C96); background: transparent;
      border: 1px solid var(--sig, #B8D6EC); border-radius: 4px;
      padding: 6px 10px; cursor: pointer; transition: 0.16s; font-size: 12px;
    }
    .terminal-toggle-btn:hover {
      background: var(--deniz, #1C5C96); color: #fff;
    }
  `;

  var history = [];
  var historyIdx = -1;
  var matrixTimer = null;

  function injectStyles() {
    if (document.getElementById('tentiforTerminalCss')) return;
    var s = document.createElement('style');
    s.id = 'tentiforTerminalCss';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function appendLine(container, text, cls) {
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'tf-term-line ' + (cls || '');
    div.innerHTML = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function clearBuffer(container) {
    if (!container) return;
    container.innerHTML = '';
  }

  // Komut Yürütücü
  function calistir(rawCmd, container) {
    var full = String(rawCmd || '').trim();
    if (!full) return;

    if (matrixTimer) {
      clearInterval(matrixTimer);
      matrixTimer = null;
    }

    appendLine(container, '<span class="tf-term-prompt">tomye@tentifor:~$</span> ' + esc(full), 'cmd');
    history.push(full);
    historyIdx = history.length;

    var parts = full.split(/\s+/);
    var c = parts[0].toLowerCase();
    var args = parts.slice(1);

    switch (c) {
      case 'yardim':
      case 'help': {
        appendLine(container, '╔══════════════════════════════════════════════════════════════╗', 'head');
        appendLine(container, '║          TENTİFORVERSE TERMINAL KOMUT REHBERİ                ║', 'head');
        appendLine(container, '╚══════════════════════════════════════════════════════════════╝', 'head');
        appendLine(container, '⏳ <b>Zaman ve Takvim</b>', 'warn');
        appendLine(container, '  <b>saat</b>               Tömye güncel 25 saatini ve gün ilerlemesini verir');
        appendLine(container, '  <b>takvim [ay]</b>        28 günlük ay takvimini dökümler');
        appendLine(container, '  <b>cevir &lt;YYYY-AA-GG&gt;</b> Dünya tarihini Tömye takvimine çevirir');
        appendLine(container, '  <b>yas &lt;sayi&gt;</b>         Dünya ve Tömye arasındaki yaş çevirisini yapar');
        appendLine(container, '📜 <b>İsim ve Dil</b>', 'warn');
        appendLine(container, '  <b>isim &lt;kelime&gt;</b>     Ses çifti algoritmasıyla (çatlak -> Gerdec) 4 yoldan isim üretir');
        appendLine(container, '  <b>oneri [karakter|sehir|ay]</b> Rastgele isim adayları üretir');
        appendLine(container, '  <b>sesler</b>             Kanon ses çiftleri tablosunu döker');
        appendLine(container, '🔍 <b>Arşiv ve Keşif</b>', 'warn');
        appendLine(container, '  <b>ara &lt;terim&gt;</b>        Karakter, evren ve sözlükte arama yapar');
        appendLine(container, '  <b>karakter &lt;ad/id&gt;</b>   Karakter kartını ve ayrıntılarını getirir');
        appendLine(container, '  <b>evren [id]</b>         Kanon ve topluluk evrenlerini listeler / detaylandırır');
        appendLine(container, '  <b>sozluk &lt;terim&gt;</b>     Evren terimini ve anlamını getirir');
        appendLine(container, '⚙️ <b>Sistem ve Ayarlar</b>', 'warn');
        appendLine(container, '  <b>kod &lt;sifre&gt;</b>        Gizli arşiv kilidini terminalden çözer');
        appendLine(container, '  <b>tema &lt;ad&gt;</b>          Site temasını değiştirir (gece, buz, kutuphane, orman, virus)');
        appendLine(container, '  <b>cuzdan</b>             ECKA bakiyeni ve günlük kazanımı gösterir');
        appendLine(container, '  <b>rozetler</b>           Kazanılan arşivci rozetlerini listeler');
        appendLine(container, '  <b>git &lt;rota&gt;</b>          Sayfalar arası hızlı gezinme (arsiv, oyunlar, tomye, sen)');
        appendLine(container, '  <b>whoami</b>             Mevcut oturum ve arşivci kimliğin');
        appendLine(container, '  <b>oyun kelime</b>        Hızlı Kyldo kelime bilmecesi');
        appendLine(container, '  <b>zar [yuz]</b>          Zar atar (1-6, 1-20 veya Tömye usulü 1-25)');
        appendLine(container, '  <b>matrix</b>             Terminal glitch/yağmur akışı');
        appendLine(container, '  <b>temizle</b>            Terminal ekranını temizler');
        break;
      }

      case 'saat':
      case 'time': {
        var t = getTomyeZaman(new Date());
        if (!t) { appendLine(container, 'Saat bilgisi alınamadı.', 'bad'); break; }
        var barLen = 25;
        var dolgu = Math.round(t.gunOrani * barLen);
        var bar = '█'.repeat(dolgu) + '░'.repeat(barLen - dolgu);
        var yuzde = Math.round(t.gunOrani * 100);

        appendLine(container, '┌────────────────────────────────────────────────────────────┐', 'head');
        appendLine(container, '│  TÖMYE ZAMANI: <b>' + t.gun + ' ' + t.ay + ' ' + t.yil + '</b> (' + t.haftaGunu + ')', 'head');
        appendLine(container, '│  ⏰ Günün <b>' + String(t.saat).padStart(2, '0') + '. SAATİ</b> (Gün 25 saat çeker)', 'warn');
        appendLine(container, '│  🌿 Ay kökeni: ' + t.ayKoken + ' (' + t.ayNo + '. ay)', 'info');
        appendLine(container, '│  ⏳ İlerleme: [' + bar + '] %' + yuzde, 'good');
        appendLine(container, '│  📜 Epoktan bu yana: ' + t.toplamGun + ' Tömye günü', 'dim');
        appendLine(container, '└────────────────────────────────────────────────────────────┘', 'head');
        break;
      }

      case 'takvim':
      case 'cal': {
        var tNow = getTomyeZaman(new Date());
        appendLine(container, 'TÖMYE TAKVİMİ · 25 saat gün / 310 gün yıl / 6 gün hafta / 28 gün ay (Kyldo 30 gün)', 'head');
        appendLine(container, 'Haftanın Günleri: <b>Yen · Tan · Gün · Dün · Tün · Son</b>', 'dim');
        appendLine(container, '-------------------------------------------------------------', 'dim');
        (tNow.aylar || []).forEach(function (a, idx) {
          var isCurrent = (idx + 1) === tNow.ayNo;
          var star = isCurrent ? ' <span class="warn">◀ ŞU ANKİ AY (' + tNow.gun + '. gün)</span>' : '';
          appendLine(container, '  ' + (idx + 1 < 10 ? ' ' : '') + (idx + 1) + '. ' + a.ad.padEnd(14) + ' (' + a.koken.padEnd(10) + ') : ' + a.gun + ' gün' + star, isCurrent ? 'good' : 'dim');
        });
        break;
      }

      case 'cevir': {
        if (!args[0]) {
          appendLine(container, 'Kullanım: cevir YYYY-AA-GG (Örn: cevir 2026-10-06)', 'warn');
          break;
        }
        var dt = new Date(args[0]);
        if (isNaN(dt.getTime())) {
          appendLine(container, 'Geçersiz tarih formatı.', 'bad');
          break;
        }
        var tz = getTomyeZaman(dt);
        if (!tz) {
          appendLine(container, 'Tarih epok başlangıcından önce.', 'bad');
          break;
        }
        appendLine(container, '✓ Tömye Karşılığı: <b>' + tz.gun + ' ' + tz.ay + ' ' + tz.yil + ' · ' + tz.haftaGunu + ' · ' + tz.saat + '. saat</b> (' + tz.ayKoken + ')', 'good');
        break;
      }

      case 'yas': {
        var yVal = parseFloat(args[0]);
        if (isNaN(yVal)) {
          appendLine(container, 'Kullanım: yas <sayı> (Örn: yas 25 veya yas 120 -tomyeden)', 'warn');
          break;
        }
        var vTakvim = typeof veri !== 'undefined' && veri ? veri.takvim : null;
        var yilGun = 310;
        var gunSaat = vTakvim && vTakvim.gunSaat ? vTakvim.gunSaat : 25;
        var tomyeYilSaat = yilGun * gunSaat;
        var dunyaYilSaat = 365.2425 * 24;

        if (args.indexOf('-tomyeden') !== -1 || args.indexOf('--tomyeden') !== -1) {
          var dunya = (yVal * tomyeYilSaat) / dunyaYilSaat;
          appendLine(container, yVal + ' Tömye yılı ≈ <b>' + dunya.toFixed(1) + ' Dünya yılı</b>', 'good');
        } else {
          var tomye = (yVal * dunyaYilSaat) / tomyeYilSaat;
          appendLine(container, yVal + ' Dünya yılı ≈ <b>' + tomye.toFixed(1) + ' Tömye yılı</b>', 'good');
        }
        appendLine(container, '(Kyldo ortalama ömrü: 250 Tömye yılı ≈ 220 Dünya yılı)', 'dim');
        break;
      }

      case 'isim': {
        if (!args[0]) {
          appendLine(container, 'Kullanım: isim <kelime> (Örn: isim çatlak veya isim oneri)', 'warn');
          break;
        }
        var w = args[0].toLowerCase();
        var u1 = basHarf(harfCevir(w, false));
        var u2 = basHarf(harfCevir(tersCevir(w), false));
        var u3 = basHarf(harfCevir(w, true));
        var u4 = basHarf(tersCevir(w));

        appendLine(container, '"' + args[0] + '" için üretilen Tentiforverse isimleri:', 'head');
        appendLine(container, '  1. <b>' + u1.padEnd(16) + '</b> <span class="info">[harf çevirisi]</span> (Tömye, Tarı, Yejen kuralı)', 'good');
        appendLine(container, '  2. <b>' + u2.padEnd(16) + '</b> <span class="info">[ters + harf]</span> (Gırı & 4. ay Gerdec kuralı)', 'warn');
        appendLine(container, '  3. <b>' + u3.padEnd(16) + '</b> <span class="info">[ünlüler korunur]</span> (Afor yumuşak tını)', 'good');
        appendLine(container, '  4. <b>' + u4.padEnd(16) + '</b> <span class="info">[ayna/ters]</span>', 'dim');
        break;
      }

      case 'oneri': {
        var tur = args[0] || 'karakter';
        var tohumlar = {
          karakter: ['umut', 'korku', 'sabır', 'öfke', 'sessizlik', 'hatıra', 'borç', 'vaat', 'gölge', 'iz', 'yara'],
          sehir: ['liman', 'kıyı', 'geçit', 'kule', 'demir', 'tuz', 'köprü', 'sur', 'pazar', 'çukur'],
          ay: ['kar', 'buz', 'don', 'çatlak', 'derin', 'uzak', 'ışık', 'yıldız', 'sabır', 'gece', 'hasat']
        };
        var h = tohumlar[tur] || tohumlar.karakter;
        var r = [...h].sort(function () { return 0.5 - Math.random(); }).slice(0, 5);
        appendLine(container, 'Tentiforverse ' + tur.toUpperCase() + ' Adayları:', 'head');
        r.forEach(function (k, idx) {
          var n1 = basHarf(harfCevir(k, false));
          var n2 = basHarf(harfCevir(tersCevir(k), false));
          appendLine(container, '  ' + (idx + 1) + '. <b>' + n1 + '</b> (Kök: ' + k + ' · Diğer yol: ' + n2 + ')', 'good');
        });
        break;
      }

      case 'sesler': {
        appendLine(container, 'TENTİFORVERSE KANON SES TABLOSU:', 'head');
        appendLine(container, '  b ↔ p   |   c ↔ ç   |   d ↔ t   |   g ↔ k', 'good');
        appendLine(container, '  v ↔ f   |   z ↔ s   |   j ↔ ş   |   r ↔ l', 'good');
        appendLine(container, '  n ↔ m   |   a ↔ e   |   ı ↔ i   |   o ↔ u', 'good');
        appendLine(container, '  ö ↔ ü   |   (y ve h harfleri değişmez)', 'warn');
        break;
      }

      case 'ara': {
        var q = args.join(' ').toLowerCase();
        if (!q) {
          appendLine(container, 'Kullanım: ara <terim> (Örn: ara Ax)', 'warn');
          break;
        }
        var sonuclar = [];
        if (typeof veri !== 'undefined' && veri) {
          (veri.karakterler || []).forEach(function (cItem) {
            if (String(cItem.ad).toLowerCase().indexOf(q) !== -1 || String(cItem.tanim || '').toLowerCase().indexOf(q) !== -1) {
              sonuclar.push({ tur: 'Karakter', ad: cItem.ad, id: cItem.id, ozet: cItem.tanim });
            }
          });
          if (veri.kanonEvrenleri) {
            Object.keys(veri.kanonEvrenleri).forEach(function (kId) {
              var ev = veri.kanonEvrenleri[kId];
              if (String(ev.ad || '').toLowerCase().indexOf(q) !== -1 || String(ev.ozet || '').toLowerCase().indexOf(q) !== -1) {
                sonuclar.push({ tur: 'Evren', ad: ev.ad, id: kId, ozet: ev.ozet });
              }
            });
          }
          (veri.sozluk || []).forEach(function (sItem) {
            if (String(sItem.terim).toLowerCase().indexOf(q) !== -1 || String(sItem.tanim || '').toLowerCase().indexOf(q) !== -1) {
              sonuclar.push({ tur: 'Sözlük', ad: sItem.terim, id: sItem.terim, ozet: sItem.tanim });
            }
          });
        }
        appendLine(container, '"' + q + '" için ' + sonuclar.length + ' sonuç bulundu:', 'head');
        if (!sonuclar.length) {
          appendLine(container, '  Eşleşen kayıt bulunamadı.', 'dim');
        } else {
          sonuclar.slice(0, 15).forEach(function (item) {
            appendLine(container, '  • [' + item.tur + '] <b>' + esc(item.ad) + '</b> ' + (item.ozet ? '<span class="dim">— ' + esc(String(item.ozet).slice(0, 80)) + '…</span>' : ''), 'info');
          });
        }
        break;
      }

      case 'karakter': {
        var cQuery = args.join(' ').toLowerCase();
        if (!cQuery) {
          appendLine(container, 'Kullanım: karakter <ad veya id> (Örn: karakter Necale)', 'warn');
          break;
        }
        var foundChar = null;
        if (typeof veri !== 'undefined' && veri && veri.karakterler) {
          foundChar = veri.karakterler.find(function (x) {
            return x.id.toLowerCase() === cQuery || String(x.ad).toLowerCase() === cQuery || String(x.ad).toLowerCase().indexOf(cQuery) !== -1;
          });
        }
        if (!foundChar) {
          appendLine(container, '"' + cQuery + '" adında karakter bulunamadı.', 'bad');
          break;
        }
        appendLine(container, '┌────────────────────────────────────────────────────────────┐', 'head');
        appendLine(container, '│  KARAKTER: <b>' + foundChar.ad + '</b> [' + foundChar.id + ']', 'head');
        if (foundChar.tanim) appendLine(container, '│  Tanım: ' + foundChar.tanim, 'good');
        if (foundChar.aciklama) appendLine(container, '│  ' + foundChar.aciklama, 'dim');
        if (Array.isArray(foundChar.kutular) && foundChar.kutular.length) {
          appendLine(container, '│  Kayıt Kutuları: ' + foundChar.kutular.length + ' adet', 'info');
        }
        appendLine(container, '└────────────────────────────────────────────────────────────┘', 'head');
        break;
      }

      case 'evren': {
        var eId = (args[0] || '').toLowerCase();
        if (typeof veri === 'undefined' || !veri) {
          appendLine(container, 'Evren verisi yüklenemedi.', 'bad');
          break;
        }
        var worlds = veri.kanonEvrenleri || {};
        if (!eId) {
          appendLine(container, 'Mevcut Kanon ve Resmi Evrenler:', 'head');
          appendLine(container, '  • <b>tomye</b> : 24. Evren (Tömye Kanonu - Aysız gezegen)', 'good');
          Object.keys(worlds).forEach(function (kId) {
            appendLine(container, '  • <b>' + kId + '</b> : ' + (worlds[kId].ad || kId), 'good');
          });
          if (veri.e99) appendLine(container, '  • <b>e99</b> : E99 Ortak Okur Evreni', 'good');
          appendLine(container, 'Detay için: evren <id> (Örn: evren e25)', 'dim');
          break;
        }
        if (eId === 'tomye') {
          appendLine(container, 'TÖMYE (24. Evren): Aysız bir gezegen, ayları 28 gün çeken bir takvim.', 'good');
        } else if (worlds[eId]) {
          appendLine(container, 'EVREN: <b>' + (worlds[eId].ad || eId) + '</b> [' + eId + ']', 'good');
          if (worlds[eId].ozet) appendLine(container, worlds[eId].ozet, 'dim');
        } else {
          appendLine(container, '"' + eId + '" kimlikli evren bulunamadı.', 'bad');
        }
        break;
      }

      case 'kod': {
        var secret = args.join(' ').trim();
        if (!secret) {
          appendLine(container, 'Kullanım: kod <şifre>', 'warn');
          break;
        }
        if (typeof window.kodDene === 'function') {
          var resKod = window.kodDene(secret);
          if (resKod) {
            appendLine(container, '✓ Kod çözüldü! ' + (resKod.mesaj || 'Kayıt açıldı.'), 'good');
          } else {
            appendLine(container, '✕ Kod geçersiz veya daha önce kullanılmış.', 'bad');
          }
        } else {
          appendLine(container, 'Kod doğrulayıcı hazır: ' + secret, 'info');
        }
        break;
      }

      case 'tema': {
        var tAd = (args[0] || '').toLowerCase();
        if (TEMA_LISTESI.indexOf(tAd) === -1) {
          appendLine(container, 'Geçerli temalar: ' + TEMA_LISTESI.join(', '), 'warn');
          break;
        }
        document.documentElement.setAttribute('data-ayar-tema', tAd);
        try { localStorage.setItem('tentiforapp_tema', tAd); } catch (_) {}
        appendLine(container, '✓ Tema "' + tAd + '" olarak ayarlandı.', 'good');
        break;
      }

      case 'git': {
        var targetPage = (args[0] || '').toLowerCase().replace(/^#\/?/, '');
        if (!targetPage) {
          appendLine(container, 'Kullanım: git <arsiv|oyunlar|tomye|sen|fan|kesif>', 'warn');
          break;
        }
        location.hash = '#/' + targetPage;
        appendLine(container, 'Yönlendiriliyor: #/' + targetPage, 'good');
        break;
      }

      case 'cuzdan': {
        var cuzdanObj = typeof window.cuzdan !== 'undefined' ? window.cuzdan : null;
        var bakiye = cuzdanObj && typeof cuzdanObj.ecka === 'number' ? cuzdanObj.ecka : 0;
        appendLine(container, '┌────────────────────────────────────────────────────────────┐', 'head');
        appendLine(container, '│  CÜZDAN VE ECKA DURUMU', 'head');
        appendLine(container, '│  Mevcut Bakiye: <b>' + bakiye + ' ECKA</b>', 'good');
        appendLine(container, '│  Tömye birimi bütün oyun ve takvim ödüllerinde geçerlidir.', 'dim');
        appendLine(container, '└────────────────────────────────────────────────────────────┘', 'head');
        break;
      }

      case 'rozetler': {
        var rozetList = [];
        try {
          var rawR = localStorage.getItem('tentiforapp_rozetler');
          if (rawR) rozetList = Object.keys(JSON.parse(rawR));
        } catch (_) {}
        appendLine(container, 'Kazanılan Rozetler (' + rozetList.length + '):', 'head');
        if (!rozetList.length) {
          appendLine(container, '  Henüz rozet kazanılmadı. Karakterleri ve evrenleri okuyarak kazanabilirsin.', 'dim');
        } else {
          rozetList.forEach(function (rItem) {
            appendLine(container, '  🥇 ' + rItem, 'good');
          });
        }
        break;
      }

      case 'zar': {
        var yuz = parseInt(args[0], 10) || 25; // Tömye varsayılanı 25!
        var atis = Math.floor(Math.random() * yuz) + 1;
        appendLine(container, '🎲 ' + yuz + ' yüzlü Tömye zarı atıldı: <b>' + atis + '</b>', 'good');
        break;
      }

      case 'matrix': {
        appendLine(container, 'Tömye Kozmik Buzul & Kyldo Sinyal Akışı başlatıldı...', 'good');
        var glyphs = '01ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟTÖMYEAX24GERDECKYLDO';
        matrixTimer = setInterval(function () {
          var str = '';
          for (var i = 0; i < 48; i++) {
            str += glyphs[Math.floor(Math.random() * glyphs.length)] + ' ';
          }
          appendLine(container, str, 'dim');
        }, 120);
        setTimeout(function () {
          if (matrixTimer) { clearInterval(matrixTimer); matrixTimer = null; }
        }, 8000);
        break;
      }

      case 'necale': {
        appendLine(container, '<i>"Kütüphanede her şeyin bir yeri vardır. Haritalar yer değiştirse de, bir kez yazılan kelime buzdaki çatlak gibi kalır."</i>', 'head');
        appendLine(container, '— Necale, Arşiv Muhafızı (4. Katman)', 'warn');
        break;
      }

      case 'girilar':
      case 'giri': {
        appendLine(container, 'GIRILAR: Tömye kütüphanelerini ateşe veren kadim isyancı birlik.', 'head');
        appendLine(container, '<i>"Kelimeler donarsa medeniyet donar."</i> diyerek arşivleri yaksalar da Kyldo şifreleri küllerin içinde korundu.', 'warn');
        break;
      }

      case 'ozan': {
        appendLine(container, 'OZAN: Buzul gezgini ve yankı arayıcısı. Donmuş denizin altındaki 3. Çatlağı haritalayan kâşif.', 'good');
        break;
      }

      case 'eylul': {
        appendLine(container, 'EYLÜL: Tömye\'nin ayna alfabesini ve ses çifti matrisini ilk deşifre eden yazıt çözücüsü.', 'good');
        break;
      }

      case 'katmanlar':
      case 'katman': {
        appendLine(container, 'TÖMYE\'NİN 7 DONMUŞ KOZMİK KATMANI:', 'head');
        appendLine(container, '1. Yüzey Kırağısı | 2. Kyldo Yazıtları | 3. Yankı Havuzları | 4. Baloncuk Evrenler | 5. Yanmış Kitaplık | 6. Dördüncü Çatlak | 7. Arşiv Çekirdeği', 'info');
        break;
      }

      case 'somdo': {
        appendLine(container, 'ŞOMDO: Aynaların arkasındaki sessiz ve kadim Tentifor yankısı (Claude Model Evreni).', 'good');
        break;
      }

      case 'defter': {
        appendLine(container, 'Kişisel Okur Defteriniz: Vurgularınız, okuma seriniz ve madalyalarınız yerel cihazınızda saklanır.', 'info');
        break;
      }

      case 'ping':
      case 'curl':
      case 'fetch':
      case 'cowsay': {
        appendLine(container, '"' + esc(c) + '" komutu siteye / Tömye dünyasına özgü olmadığı için terminalden kaldırılmıştır. Komut listesi için <b>yardim</b> yazın.', 'warn');
        break;
      }

      case 'whoami': {
        var prof = typeof window.hesapProfil !== 'undefined' && window.hesapProfil ? window.hesapProfil : null;
        if (prof && (prof.kullanici_adi || prof.gorunen_ad)) {
          appendLine(container, 'Giriş Yapmış Arşivci: <b>@' + (prof.kullanici_adi || '') + '</b> (' + (prof.gorunen_ad || '') + ')', 'good');
        } else {
          appendLine(container, 'Misafir Arşivci (Yerel oturum etkin)', 'dim');
        }
        break;
      }

      case 'surum': {
        appendLine(container, 'TentiforApp v6.3.13 (Platform Engine: 2026-10-06)', 'info');
        break;
      }

      case 'temizle':
      case 'clear': {
        clearBuffer(container);
        break;
      }

      case 'echo': {
        appendLine(container, esc(args.join(' ')));
        break;
      }

      default: {
        appendLine(container, 'Bilinmeyen komut: "' + esc(c) + '". Komut listesi için <b>yardim</b> yaz.', 'bad');
        break;
      }
    }
  }

  // Terminal Penceresi Oluşturucu
  function createTerminalInstance(options) {
    injectStyles();
    var opts = options || {};
    var gomulu = !!opts.gomulu;
    var targetElem = gomulu && opts.hedef ? document.querySelector(opts.hedef) : null;

    var box = document.createElement('div');
    box.className = 'tf-term-box';

    box.innerHTML = `
      <div class="tf-term-header">
        <div class="tf-term-dots">
          <span class="tf-term-dot red" title="Kapat" data-term-act="close"></span>
          <span class="tf-term-dot yellow" title="Büyüt/Küçült" data-term-act="max"></span>
          <span class="tf-term-dot green" title="Temizle" data-term-act="clear"></span>
        </div>
        <div class="tf-term-title">tentifor@tomye-terminal: ~ (T-Term v6.3.13)</div>
        <div style="font-size:11px; color:#57C7FF;">[?] 'yardim'</div>
      </div>
      <div class="tf-term-body" data-term-body></div>
      <div class="tf-term-pills">
        <button type="button" class="tf-term-pill" data-term-cmd="saat">saat</button>
        <button type="button" class="tf-term-pill" data-term-cmd="takvim">takvim</button>
        <button type="button" class="tf-term-pill" data-term-cmd="isim çatlak">isim çatlak</button>
        <button type="button" class="tf-term-pill" data-term-cmd="ara Ax">ara Ax</button>
        <button type="button" class="tf-term-pill" data-term-cmd="karakter Necale">karakter Necale</button>
        <button type="button" class="tf-term-pill" data-term-cmd="zar 25">zar</button>
        <button type="button" class="tf-term-pill" data-term-cmd="matrix">matrix</button>
        <button type="button" class="tf-term-pill" data-term-cmd="yardim">yardim</button>
      </div>
      <div class="tf-term-input-row">
        <span class="tf-term-prompt">tomye@tentifor:~$</span>
        <input type="text" class="tf-term-input" data-term-in spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="komut yazın...">
      </div>
    `;

    var body = box.querySelector('[data-term-body]');
    var input = box.querySelector('[data-term-in]');

    // Karşılama mesajı
    if (opts.is404) {
      appendLine(body, '╔══════════════════════════════════════════════════════════════╗', 'bad');
      appendLine(body, '║   [404] KAYIP SEKTÖR · TENTİFOR KURTARMA KONSOLU DEVREDE     ║', 'bad');
      appendLine(body, '╚══════════════════════════════════════════════════════════════╝', 'bad');
      appendLine(body, 'Aradığın sayfa bulunamadı; ancak kurtarma terminali aktif.', 'warn');
      appendLine(body, 'Arşivi taramak için: <b>ara &lt;terim&gt;</b> | Ana sayfaya dönmek için: <b>git arsiv</b>', 'info');
      appendLine(body, 'Tüm komutlar için <b>yardim</b> yazabilirsin.\n', 'dim');
    } else {
      appendLine(body, '╔══════════════════════════════════════════════════════════════╗', 'head');
      appendLine(body, '║   TENTİFORVERSE TERMINAL (T-Term) · Aysız Gezegen Tömye      ║', 'head');
      appendLine(body, '╚══════════════════════════════════════════════════════════════╝', 'head');
      appendLine(body, 'Hoş geldin arşivci. Komutları görmek için <b>yardim</b> yazın.\n', 'info');
    }

    // Input etkileşimleri
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var val = input.value;
        input.value = '';
        calistir(val, body);
      } else if (e.key === 'ArrowUp') {
        if (history.length && historyIdx > 0) {
          historyIdx -= 1;
          input.value = history[historyIdx] || '';
        }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (history.length && historyIdx < history.length - 1) {
          historyIdx += 1;
          input.value = history[historyIdx] || '';
        } else {
          historyIdx = history.length;
          input.value = '';
        }
        e.preventDefault();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        var valTab = input.value.trim().toLowerCase();
        if (valTab) {
          var match = KOMUTLAR.find(function (k) { return k.startsWith(valTab); });
          if (match) input.value = match + ' ';
        }
      }
    });

    // Buton ve Pill etkileşimleri
    box.addEventListener('click', function (e) {
      var pill = e.target.closest('[data-term-cmd]');
      if (pill) {
        var pCmd = pill.dataset.termCmd;
        calistir(pCmd, body);
        input.focus();
        return;
      }
      var act = e.target.closest('[data-term-act]');
      if (act) {
        var action = act.dataset.termAct;
        if (action === 'clear') clearBuffer(body);
        else if (action === 'max') box.classList.toggle('maximized');
        else if (action === 'close') {
          if (!gomulu) {
            var modal = box.closest('.tf-term-modal');
            if (modal) modal.hidden = true;
          }
        }
      }
    });

    if (gomulu && targetElem) {
      targetElem.innerHTML = '';
      targetElem.appendChild(box);
    }

    return { box: box, body: body, input: input };
  }

  // Global Modal Terminal
  var globalModal = null;
  var globalInstance = null;

  function initGlobalModal() {
    if (globalModal) return;
    injectStyles();
    globalModal = document.createElement('div');
    globalModal.className = 'tf-term-modal';
    globalModal.hidden = true;

    globalInstance = createTerminalInstance({ gomulu: false });
    globalModal.appendChild(globalInstance.box);

    globalModal.addEventListener('click', function (e) {
      if (e.target === globalModal) {
        globalModal.hidden = true;
      }
    });

    document.body.appendChild(globalModal);
  }

  function acModal(is404) {
    initGlobalModal();
    globalModal.hidden = false;
    setTimeout(function () {
      if (globalInstance && globalInstance.input) globalInstance.input.focus();
    }, 100);
  }

  function kapatModal() {
    if (globalModal) globalModal.hidden = true;
  }

  // Header'a terminal düğmesi ekle
  function headerDugmesiEkle() {
    var header = document.querySelector('header.ust');
    if (!header || header.querySelector('#btnTerminal')) return;
    var btn = document.createElement('button');
    btn.className = 'ust-ikon terminal-toggle-btn';
    btn.id = 'btnTerminal';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Tentifor Terminali');
    btn.title = 'Terminal Konsolu (~ veya >_)';
    btn.textContent = '>_';
    btn.addEventListener('click', function () {
      acModal(false);
    });
    // btnKod'dan hemen önce ekle
    var btnKod = header.querySelector('#btnKod');
    if (btnKod) header.insertBefore(btn, btnKod);
    else header.appendChild(btn);
  }

  // 404 sayfasına gömülü terminal bağla
  function yokSayfasiKontrol() {
    var yokSec = document.querySelector('#yokSayfa');
    if (yokSec && !yokSec.querySelector('.tf-term-box')) {
      var wrapper = yokSec.querySelector('.yok-terminal-kapsayici');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'yok-terminal-kapsayici';
        var ic = yokSec.querySelector('.yok-ic') || yokSec;
        ic.appendChild(wrapper);
      }
      createTerminalInstance({ gomulu: true, hedef: '.yok-terminal-kapsayici', is404: true });
    }
  }

  // Kısayol Tuşları: ` veya Ctrl+~
  document.addEventListener('keydown', function (e) {
    if (e.key === '`' || e.key === 'F12' || (e.ctrlKey && e.key === '~')) {
      var inFocus = document.activeElement;
      if (inFocus && inFocus.tagName === 'INPUT' && !inFocus.classList.contains('tf-term-input')) return;
      if (inFocus && inFocus.tagName === 'TEXTAREA') return;
      e.preventDefault();
      if (globalModal && !globalModal.hidden) kapatModal();
      else acModal(false);
    } else if (e.key === 'Escape' && globalModal && !globalModal.hidden) {
      kapatModal();
    }
  });

  // Hash rota desteği: #/terminal
  function rotaKontrol() {
    if (location.hash === '#/terminal' || location.hash === '#/konsol') {
      acModal(false);
    }
    setTimeout(yokSayfasiKontrol, 50);
  }

  function boot() {
    injectStyles();
    initGlobalModal();
    headerDugmesiEkle();
    rotaKontrol();
  }

  window.tentiforTerminal = {
    ac: acModal,
    kapat: kapatModal,
    ornekOlustur: createTerminalInstance,
    calistir: function (cmd) {
      if (globalInstance) calistir(cmd, globalInstance.body);
    }
  };

  window.addEventListener('hashchange', rotaKontrol);
  document.addEventListener('DOMContentLoaded', boot, { once: true });
  document.addEventListener('tf-veri-hazir', boot);

  // Dinamik olarak 404 sayfası gelirse yakala
  var obs = new MutationObserver(function () {
    headerDugmesiEkle();
    yokSayfasiKontrol();
  });
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });
}());
