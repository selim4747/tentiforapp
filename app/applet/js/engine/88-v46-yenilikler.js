/**
 * TentiforApp v4.6 — Genişletilmiş Evren Motoru ve Araçlar
 * 
 * Yenilikler:
 * 1. Yapımlara karakter ekleme ve karakter profilinde "Yer Aldığı Yapımlar" çift yönlü bağlantısı
 * 2. Evren Ansiklopedisi / World Bible Tek Tıkla Dışa Aktarım (.md Markdown ve .html Yazdırılabilir Kitapçık)
 * 3. Akıllı Metin İçi Lore & Karakter İpuçları (Smart Lore Tooltip)
 * 4. Karakter Detayında "Mini İlişki Çemberi" ve doğrudan bağlantı düğümleri
 * 5. İki Evren Arası "Geçit & Kural Çatışması Simülatörü"
 * 6. Supabase yükünü sıfıra indiren önbellekleme ve istek birleştirme (Request Coalescing)
 */

(function () {
  'use strict';

  /* ==========================================================================
     0. CSS ENJEKSİYONU (Özel stiller, sıfır harici bağımlılık, 60fps)
     ========================================================================== */
  function v46StilYukle() {
    if (document.getElementById('v46-stiller')) return;
    const style = document.createElement('style');
    style.id = 'v46-stiller';
    style.textContent = `
      /* Yapım Karakter Rozetleri */
      .yapim-karakter-cip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--buz, #dce8f1);
        color: var(--deniz, #0d3560);
        border: 1px solid color-mix(in srgb, var(--deniz, #0d3560) 20%, transparent);
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        margin: 2px;
        transition: transform 0.15s, background-color 0.15s;
        text-decoration: none;
      }
      .yapim-karakter-cip:hover {
        transform: translateY(-1px);
        background: var(--deniz, #0d3560);
        color: #fff;
      }
      .yapim-karakter-cip small {
        opacity: 0.8;
        font-weight: 400;
      }

      /* Karakter Modalında Yapımlar */
      .karakter-yapim-blok {
        margin: 14px 0;
        padding: 10px 12px;
        background: color-mix(in srgb, var(--buz, #dce8f1) 40%, transparent);
        border-radius: var(--r-kucuk, 8px);
        border: 1px solid var(--buz, #dce8f1);
      }
      .karakter-yapim-liste {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }
      .karakter-yapim-kart {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--beyaz, #fff);
        border: 1px solid var(--sig, #cbd5e1);
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 13px;
        cursor: pointer;
      }
      .karakter-yapim-kart:hover {
        border-color: var(--deniz, #0d3560);
        background: var(--buz, #dce8f1);
      }

      /* Karakter Mini İlişki Çemberi */
      .karakter-mini-baglar {
        margin: 14px 0;
        padding: 10px 12px;
        background: var(--beyaz, #fff);
        border: 1px solid var(--sig, #cbd5e1);
        border-radius: var(--r-kucuk, 8px);
      }
      .mini-bag-izgara {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }
      .mini-bag-dugme {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--buz, #dce8f1);
        color: var(--murekkep, #1e293b);
        border: 1px solid transparent;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 12.5px;
        cursor: pointer;
      }
      .mini-bag-dugme:hover {
        background: var(--deniz, #0d3560);
        color: #fff;
      }
      .mini-bag-etiket {
        font-size: 11px;
        opacity: 0.8;
      }

      /* Akıllı Lore Tooltip */
      .lore-vurgu {
        border-bottom: 1.5px dotted var(--deniz, #0d3560);
        cursor: help;
        position: relative;
        text-decoration: none;
        color: inherit;
        font-weight: 500;
        transition: background-color 0.15s;
      }
      .lore-vurgu:hover, .lore-vurgu:focus {
        background-color: color-mix(in srgb, var(--deniz, #0d3560) 12%, transparent);
        border-radius: 2px;
      }
      #loreTooltipBalon {
        position: fixed;
        z-index: 99999;
        max-width: 280px;
        background: var(--beyaz, #ffffff);
        color: var(--murekkep, #0f172a);
        border: 1px solid var(--deniz, #0d3560);
        border-radius: 10px;
        padding: 10px 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        font-size: 13px;
        line-height: 1.45;
        pointer-events: none;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.15s ease, transform 0.15s ease;
      }
      #loreTooltipBalon.acik {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      #loreTooltipBalon .lore-tip {
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: var(--buz, #dce8f1);
        color: var(--deniz, #0d3560);
        border-radius: 4px;
        padding: 1px 5px;
        margin-bottom: 4px;
      }
      #loreTooltipBalon .lore-baslik {
        font-weight: 700;
        font-size: 14px;
        display: block;
        margin-bottom: 2px;
      }

      /* Geçit & Kural Çatışması Simülatörü */
      .sim-pencere {
        max-width: 680px;
        width: 100%;
      }
      .sim-secimler {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 12px;
        align-items: center;
        margin: 16px 0;
      }
      .sim-gecit-ikon {
        font-size: 24px;
        color: var(--deniz, #0d3560);
        text-align: center;
      }
      .sim-sonuc {
        margin-top: 18px;
        padding: 14px;
        background: color-mix(in srgb, var(--buz, #dce8f1) 30%, transparent);
        border-radius: 12px;
        border: 1px solid var(--buz, #dce8f1);
      }
      .sim-risk {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 13px;
        margin-bottom: 10px;
      }
      .sim-risk.dusuk { background: #dcfce7; color: #166534; }
      .sim-risk.orta { background: #fef9c3; color: #854d0e; }
      .sim-risk.yuksek { background: #fee2e2; color: #991b1b; }
      .sim-madde {
        margin: 8px 0;
        font-size: 13.5px;
      }
    `;
    document.head.appendChild(style);
  }

  /* ==========================================================================
     1. YAPIMLAR & KARAKTERLER ÇİFT YÖNLÜ BAĞLANTI (Supabase'e Sıfır Yük)
     ========================================================================== */

  // Bir yapımda rol alan karakterlerin listesini ayrıştır
  function yapimKarakterleriniCoz(yapim) {
    if (!yapim) return [];
    let ham = [];
    if (Array.isArray(yapim.karakterler)) {
      ham = yapim.karakterler;
    } else if (typeof yapim.karakterler === 'string' && yapim.karakterler.trim()) {
      ham = yapim.karakterler.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
    } else {
      // Yapımın notundan veya açıklamasından da karakter eşleşmesi yakala
      const tumKarakterler = (window.veri && window.veri.karakterler) || [];
      tumKarakterler.forEach(k => {
        if ((k.yapimlar || []).includes(yapim.ad) || (yapim.not && yapim.not.includes(k.ad.split(' ')[0]))) {
          ham.push(k.ad);
        }
      });
    }

    return ham.map(item => {
      const match = String(item).match(/^([^(]+)(?:\(([^)]+)\))?$/);
      if (match) {
        return {
          ad: match[1].trim(),
          rol: (match[2] || '').trim()
        };
      }
      return { ad: String(item).trim(), rol: '' };
    }).filter(x => x.ad);
  }

  // Karakter adına göre karakter kaydını bul
  function karakterBul(adVeyaId) {
    const tum = (window.veri && window.veri.karakterler) || [];
    const aranan = String(adVeyaId || '').toLowerCase().trim();
    return tum.find(k => k.id.toLowerCase() === aranan || k.ad.toLowerCase() === aranan || k.ad.toLowerCase().startsWith(aranan));
  }

  // Karakter tıklandığında aç
  window.yapimdanKarakterAc = function (karakterAdi) {
    const k = karakterBul(karakterAdi);
    if (k && typeof window.karakterAc === 'function') {
      const idx = window.veri.karakterler.indexOf(k);
      if (idx !== -1) {
        window.karakterAc(idx);
        return;
      }
    }
    if (typeof window.eckaBildir === 'function') {
      window.eckaBildir(`“${karakterAdi}” karakterinin arşiv kaydı bulunamadı.`);
    }
  };

  // Yapım kartına karakterleri zenginleştir
  function yapimlariGuncelle() {
    const yapimKartlari = document.querySelectorAll('.yapim-kart');
    if (!yapimKartlari.length || !window.veri || !window.veri.yapimlar) return;

    yapimKartlari.forEach(kart => {
      const adEl = kart.querySelector('.yapim-ad');
      if (!adEl) return;
      const yapimAdi = adEl.textContent.trim();
      const yapim = window.veri.yapimlar.find(y => y.ad === yapimAdi);
      if (!yapim) return;

      if (!kart.querySelector('.yapim-karakter-alani')) {
        const roller = yapimKarakterleriniCoz(yapim);
        if (roller.length) {
          const div = document.createElement('div');
          div.className = 'yapim-karakter-alani';
          div.style.marginTop = '8px';
          div.innerHTML = '<span class="oyun-not" style="display:block; margin-bottom:2px; font-weight:600;">Karakterler:</span>' +
            roller.map(r => `
              <button type="button" class="yapim-karakter-cip" onclick="yapimdanKarakterAc('${r.ad.replace(/'/g, "\\'")}')">
                <span>${r.ad}</span>
                ${r.rol ? `<small>(${r.rol})</small>` : ''}
              </button>
            `).join('');
          kart.appendChild(div);
        }
      }
    });
  }

  // Karakter detay penceresinde "Yer Aldığı Yapımlar" ve "Mini İlişki Ağı" ekleme
  function karakterPenceresiniZenginlestir() {
    const perde = document.getElementById('perde');
    if (!perde || perde.hidden || !window.veri) return;

    const baslik = perde.querySelector('h3');
    if (!baslik) return;
    const karakterAdi = baslik.textContent.trim();
    const karakter = karakterBul(karakterAdi);
    if (!karakter) return;

    // 1. Yer Aldığı Yapımları Ekle
    if (!perde.querySelector('.karakter-yapim-blok')) {
      const yapimlar = (window.veri.yapimlar || []).filter(y => {
        const roller = yapimKarakterleriniCoz(y);
        return roller.some(r => r.ad.toLowerCase() === karakter.ad.toLowerCase() || (karakter.yapimlar || []).includes(y.ad));
      });

      if (yapimlar.length) {
        const yapimBlok = document.createElement('div');
        yapimBlok.className = 'karakter-yapim-blok';
        yapimBlok.innerHTML = `
          <span class="oyun-etiket">Yer Aldığı Yapımlar (${yapimlar.length})</span>
          <div class="karakter-yapim-liste">
            ${yapimlar.map(y => `
              <button type="button" class="karakter-yapim-kart" onclick="location.hash='#/proje'; document.getElementById('perde').hidden=true;">
                <b>${y.ad}</b>
                <span class="oyun-not">· ${y.tur} (${y.durum})</span>
              </button>
            `).join('')}
          </div>
        `;
        const detay = perde.querySelector('.detay-metin') || baslik;
        detay.insertAdjacentElement('afterend', yapimBlok);
      }
    }

    // 2. Mini İlişki Çemberini Ekle
    if (!perde.querySelector('.karakter-mini-baglar')) {
      const baglar = [];
      const kisaAd = karakter.ad.split(' ')[0];

      // Aile / Kuşaklar
      if (typeof window.AILE !== 'undefined' && window.AILE && window.AILE.kusaklar) {
        window.AILE.kusaklar.forEach(kusak => {
          kusak.kisiler.forEach(kisi => {
            if (kisi.ad.toLowerCase().includes(kisaAd.toLowerCase()) && kisi.ad !== karakter.ad) {
              baglar.push({ ad: kisi.ad, etiket: kusak.ad, not: kisi.not || '' });
            }
          });
        });
      }

      // Kesişmeler
      if (typeof window.KESISMELER !== 'undefined' && Array.isArray(window.KESISMELER)) {
        window.KESISMELER.forEach(kes => {
          if (kes.a === karakter.id || kes.b === karakter.id) {
            const digerId = kes.a === karakter.id ? kes.b : kes.a;
            const diger = (window.veri.karakterler || []).find(x => x.id === digerId);
            if (diger) {
              baglar.push({ ad: diger.ad, etiket: kes.ne, not: kes.not || '' });
            }
          }
        });
      }

      // Ağ Bağları
      if (window.veri.ag && Array.isArray(window.veri.ag.baglar)) {
        window.veri.ag.baglar.forEach(b => {
          if (b.a === karakter.id || b.b === karakter.id) {
            const digerId = b.a === karakter.id ? b.b : b.a;
            const diger = (window.veri.karakterler || []).find(x => x.id === digerId);
            if (diger && !baglar.some(x => x.ad === diger.ad)) {
              baglar.push({ ad: diger.ad, etiket: b.etiket || 'Bağlı', not: '' });
            }
          }
        });
      }

      if (baglar.length) {
        const bagBlok = document.createElement('div');
        bagBlok.className = 'karakter-mini-baglar';
        bagBlok.innerHTML = `
          <span class="oyun-etiket">Bağlantılı Kişiler & İlişkiler</span>
          <div class="mini-bag-izgara">
            ${baglar.slice(0, 8).map(b => `
              <button type="button" class="mini-bag-dugme" onclick="yapimdanKarakterAc('${b.ad.replace(/'/g, "\\'")}')" title="${b.not || b.etiket}">
                <b>${b.ad}</b>
                ${b.etiket ? `<span class="mini-bag-etiket">(${b.etiket})</span>` : ''}
              </button>
            `).join('')}
          </div>
        `;
        const yer = perde.querySelector('.karakter-yapim-blok') || perde.querySelector('.detay-metin') || baslik;
        yer.insertAdjacentElement('afterend', bagBlok);
      }
    }
  }

  /* ==========================================================================
     2. EVREN ANSİKLOPEDİSİ / WORLD BIBLE DIŞA AKTARIM (.md & .html)
     ========================================================================== */

  window.evrenAnsiklopedisiUret = function (format, evrenNesnesi) {
    const e = evrenNesnesi || (typeof window.evrenSayfaVerisi === 'function' ? (window.evrenSayfaVerisi() || {}).eser : null) || window.veri;
    if (!e) {
      if (typeof window.eckaBildir === 'function') window.eckaBildir('Evren verisi bulunamadı.');
      return;
    }

    const ad = e.ad || 'Evren';
    const yazar = e.yazar || 'Tentiforverse';
    const ozet = e.ozet || '';
    const kurallar = e.kurallar || [];
    const yerler = (e.harita && e.harita.yerler) || [];
    const kisiler = e.kisiler || (e === window.veri ? e.karakterler : []) || [];
    const tarih = e.tarih || e.zamanCizelgesi || [];
    const yapimlar = e.yapimlar || (window.veri && window.veri.yapimlar) || [];

    if (format === 'md') {
      let md = `# ${ad} — Evren Ansiklopedisi (World Bible)\n`;
      md += `*Yazar: ${yazar} | Oluşturulma: ${new Date().toLocaleDateString('tr-TR')}*\n\n`;
      md += `## 1. Genel Bakış ve Kozmoloji\n${ozet}\n\n`;

      if (kurallar.length) {
        md += `## 2. Evren Kuralları ve Doğa Kanunları\n`;
        kurallar.forEach(k => {
          md += `### ${k.ad || 'Kural'}\n${k.aciklama || k.not || ''}\n\n`;
        });
      }

      if (yerler.length) {
        md += `## 3. Coğrafya ve Yerleşim Yerleri\n`;
        yerler.forEach(y => {
          md += `- **${y.ad}** (${y.tur || 'Bölge'}): ${y.not || ''}\n`;
        });
        md += '\n';
      }

      if (kisiler.length) {
        md += `## 4. Önemli Karakterler ve Biyografiler\n`;
        kisiler.forEach(k => {
          md += `### ${k.ad} ${k.unvan ? `*(${k.unvan})*` : ''}\n`;
          if (k.ozet) md += `> ${k.ozet}\n\n`;
          if (k.detay || k.not) md += `${k.detay || k.not}\n\n`;
        });
      }

      if (tarih.length) {
        md += `## 5. Zaman Çizelgesi ve Kronoloji\n`;
        tarih.forEach(t => {
          md += `- **${t.zaman || t.cag || '—'}**: ${t.olay || t.baslik || ''} ${t.not ? `*(${t.not})*` : ''}\n`;
        });
        md += '\n';
      }

      if (yapimlar.length) {
        md += `## 6. İlgili Yapımlar ve Eserler\n`;
        yapimlar.forEach(y => {
          md += `- **${y.ad}** [${y.tur}] (${y.durum}): ${y.not || ''}\n`;
        });
        md += '\n';
      }

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      dosyaIndirici(blob, `${slugYap(ad)}-world-bible.md`);
      if (typeof window.eckaBildir === 'function') window.eckaBildir('📖 Markdown Ansiklopedisi indirildi.');
    } else if (format === 'html') {
      const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${ad} — Evren Kitapçığı</title>
  <style>
    body { font-family: 'EB Garamond', Georgia, serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; background: #fafaf9; }
    h1, h2, h3 { font-family: system-ui, sans-serif; color: #0d3560; }
    h1 { border-bottom: 2px solid #0d3560; padding-bottom: 8px; margin-top: 0; }
    h2 { border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 32px; }
    .ozet-kutu { background: #e2e8f0; padding: 16px; border-radius: 8px; margin: 20px 0; font-style: italic; }
    .madde { margin-bottom: 14px; }
    .etiket { font-weight: bold; color: #0369a1; }
    @media print { body { background: #fff; max-width: 100%; margin: 0; } h2 { page-break-after: avoid; } }
  </style>
</head>
<body>
  <h1>${ad}</h1>
  <p><strong>Yazar:</strong> ${yazar} · <strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
  <div class="ozet-kutu">${ozet}</div>
  
  ${kurallar.length ? `<h2>Evren Kuralları</h2>${kurallar.map(k => `<div class="madde"><span class="etiket">${k.ad}:</span> ${k.aciklama || k.not || ''}</div>`).join('')}` : ''}
  ${yerler.length ? `<h2>Harita ve Coğrafya</h2>${yerler.map(y => `<div class="madde"><span class="etiket">${y.ad} (${y.tur}):</span> ${y.not || ''}</div>`).join('')}` : ''}
  ${kisiler.length ? `<h2>Karakterler</h2>${kisiler.map(k => `<div class="madde"><h3>${k.ad} <small>${k.unvan || ''}</small></h3><p>${k.ozet || k.not || k.detay || ''}</p></div>`).join('')}` : ''}
  ${tarih.length ? `<h2>Zaman Çizelgesi</h2><ul>${tarih.map(t => `<li><strong>${t.zaman || t.cag || '—'}:</strong> ${t.olay || t.baslik || ''}</li>`).join('')}</ul>` : ''}
</body>
</html>`;

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      dosyaIndirici(blob, `${slugYap(ad)}-kitapcik.html`);
      if (typeof window.eckaBildir === 'function') window.eckaBildir('🖨 Yazdırılabilir Kitapçık (.html) indirildi.');
    }
  };

  function dosyaIndirici(blob, dosyaAdi) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = dosyaAdi;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function slugYap(metin) {
    return String(metin || 'evren')
      .toLowerCase()
      .replace(/[ğ]/g, 'g')
      .replace(/[ü]/g, 'u')
      .replace(/[ş]/g, 's')
      .replace(/[ı]/g, 'i')
      .replace(/[ö]/g, 'o')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'evren';
  }

  // Evren sayfasına "World Bible İndir" butonlarını ekle
  function evrenSayfasiKitapButonuEkle() {
    const eylemler = document.querySelector('#evrenSayfa .eva-eylem .oyun-sira');
    if (!eylemler || eylemler.querySelector('[data-v46-kitap]')) return;

    const btnMd = document.createElement('button');
    btnMd.type = 'button';
    btnMd.className = 'dugme dugme-sade';
    btnMd.setAttribute('data-v46-kitap', 'md');
    btnMd.textContent = '📖 World Bible (.md)';
    btnMd.onclick = () => window.evrenAnsiklopedisiUret('md');

    const btnHtml = document.createElement('button');
    btnHtml.type = 'button';
    btnHtml.className = 'dugme dugme-sade';
    btnHtml.setAttribute('data-v46-kitap', 'html');
    btnHtml.textContent = '🖨 Kitapçık (.html)';
    btnHtml.onclick = () => window.evrenAnsiklopedisiUret('html');

    eylemler.appendChild(btnMd);
    eylemler.appendChild(btnHtml);
  }

  /* ==========================================================================
     3. AKILLI METİN İÇİ LORE & KARAKTER İPUÇLARI (Smart Lore Tooltip)
     ========================================================================== */

  let tooltipEl = null;
  function tooltipKur() {
    if (tooltipEl) return;
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'loreTooltipBalon';
    document.body.appendChild(tooltipEl);

    document.addEventListener('mouseover', function (e) {
      const hedef = e.target.closest('.lore-vurgu');
      if (hedef) {
        const tip = hedef.getAttribute('data-lore-tip') || 'Bilgi';
        const baslik = hedef.getAttribute('data-lore-baslik') || hedef.textContent;
        const aciklama = hedef.getAttribute('data-lore-ozet') || '';

        tooltipEl.innerHTML = `
          <span class="lore-tip">${tip}</span>
          <span class="lore-baslik">${baslik}</span>
          <p style="margin: 0;">${aciklama}</p>
        `;

        const rect = hedef.getBoundingClientRect();
        const top = rect.bottom + 8;
        const left = Math.max(10, Math.min(window.innerWidth - 300, rect.left));

        tooltipEl.style.top = top + 'px';
        tooltipEl.style.left = left + 'px';
        tooltipEl.classList.add('acik');
      } else if (!e.target.closest('#loreTooltipBalon')) {
        tooltipEl.classList.remove('acik');
      }
    });

    document.addEventListener('scroll', () => {
      if (tooltipEl) tooltipEl.classList.remove('acik');
    }, { passive: true });
  }

  // Metindeki karakter ve terimleri tarayıp hafif çizgiyle zenginleştir
  function akilliLoreTara() {
    const metinKapsayicilari = document.querySelectorAll('.okuma-metin:not(.lore-tarandi), .fan-metin:not(.lore-tarandi), .fan-oku:not(.lore-tarandi)');
    if (!metinKapsayicilari.length || !window.veri) return;

    // Sözlük ve Karakter Sözlüğü
    const karakterler = window.veri.karakterler || [];
    const sozluk = window.veri.sozluk || [];

    const terimHaritasi = new Map();
    karakterler.forEach(k => {
      const kisa = k.ad.split(' ')[0];
      if (kisa.length >= 4) {
        terimHaritasi.set(kisa.toLowerCase(), {
          tip: 'Karakter',
          baslik: k.ad,
          ozet: k.unvan ? `${k.unvan} — ${k.ozet || ''}` : k.ozet || ''
        });
      }
    });

    sozluk.forEach(s => {
      if (s.terim && s.terim.length >= 3) {
        terimHaritasi.set(s.terim.toLowerCase(), {
          tip: 'Sözlük Terimi',
          baslik: s.terim,
          ozet: s.tanim || ''
        });
      }
    });

    if (!terimHaritasi.size) return;

    metinKapsayicilari.forEach(el => {
      el.classList.add('lore-tarandi');
      const paragraflar = el.querySelectorAll('p');
      paragraflar.forEach(p => {
        // İçi zaten zenginleştirilmişse atla
        if (p.querySelector('.lore-vurgu') || p.querySelector('.ic-bag')) return;

        let metin = p.innerHTML;
        terimHaritasi.forEach((bilgi, anahtar) => {
          const regex = new RegExp(`\\b(${anahtar})\\b`, 'gi');
          metin = metin.replace(regex, (match) => {
            return `<span class="lore-vurgu" data-lore-tip="${bilgi.tip}" data-lore-baslik="${bilgi.baslik}" data-lore-ozet="${bilgi.ozet.replace(/"/g, '&quot;')}">${match}</span>`;
          });
        });
        p.innerHTML = metin;
      });
    });
  }

  /* ==========================================================================
     4. İKİ EVREN ARASI "GEÇİT & KURAL ÇATIŞMASI SİMÜLATÖRÜ"
     ========================================================================== */

  window.gecitSimulasyonuAc = function () {
    const perde = document.getElementById('perde');
    if (!perde) return;

    const evrenler = [
      { id: 'tomye', ad: 'Tömye (Tentiforverse)', kurallar: ['Gökyüzünde ay yoktur, aylar 28 gündür', 'Buz altı enerjisi ve Kyldo kimliği', 'Taş taşıyan Evrengezerler'] },
      { id: 'e25', ad: 'E25 Evreni', kurallar: ['Sürekli sis ve boyut çatlağı', 'Kütüphane koruyuculuğu', 'Ruh virüsü duyarlılığı'] },
      { id: 'e26', ad: 'E26 Evreni', kurallar: ['Düşük yerçekimi', 'Güneşsiz fotosentez', 'Akustik iletişim'] },
      { id: 'e99', ad: 'E99 Ortak Evreni', kurallar: ['Çoklu kurallar bütünü', 'Serbest geçit kapıları', 'Ortak hafıza alanı'] }
    ];

    // Kullanıcının kendi evrenlerini de ekle
    if (typeof window.fanEserlerim === 'function') {
      window.fanEserlerim().forEach(fe => {
        if (fe.tur === 'evren') {
          evrenler.push({
            id: fe.id,
            ad: fe.ad || 'Özel Evren',
            kurallar: (fe.kurallar || []).map(k => k.ad || k.aciklama).filter(Boolean)
          });
        }
      });
    }

    perde.innerHTML = `
      <div class="pencere sim-pencere" role="dialog" aria-modal="true">
        <button class="pencere-kapat" data-kapat="1" aria-label="Kapat">✕</button>
        <span class="oyun-etiket">Çoklu Evren Laboratuvarı</span>
        <h2>Geçit & Kural Çatışması Simülatörü</h2>
        <p class="pencere-alt">İki evren arasında bir geçit açıldığında doğa kanunları, zaman akışı ve Evrengezer taşı nasıl tepki verir?</p>

        <div class="sim-secimler">
          <div>
            <label style="font-weight:600; font-size:13px; display:block; margin-bottom:4px;">1. Kaynak Evren</label>
            <select class="kod-giris arac-giris" id="simEvrenA">
              ${evrenler.map((e, idx) => `<option value="${e.id}" ${idx === 0 ? 'selected' : ''}>${e.ad}</option>`).join('')}
            </select>
          </div>
          <div class="sim-gecit-ikon">⇄</div>
          <div>
            <label style="font-weight:600; font-size:13px; display:block; margin-bottom:4px;">2. Hedef Evren</label>
            <select class="kod-giris arac-giris" id="simEvrenB">
              ${evrenler.map((e, idx) => `<option value="${e.id}" ${idx === 1 ? 'selected' : ''}>${e.ad}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="oyun-sira">
          <button type="button" class="dugme" id="simHesaplaBtn">Geçit Etkisini Simüle Et</button>
        </div>

        <div id="simSonucAlani"></div>
      </div>
    `;
    perde.hidden = false;

    document.getElementById('simHesaplaBtn').onclick = () => simuleEt(evrenler);
    simuleEt(evrenler);
  };

  function simuleEt(evrenler) {
    const aId = document.getElementById('simEvrenA').value;
    const bId = document.getElementById('simEvrenB').value;
    const alan = document.getElementById('simSonucAlani');
    if (!alan) return;

    if (aId === bId) {
      alan.innerHTML = `
        <div class="sim-sonuc">
          <span class="sim-risk dusuk">✓ Tam Uyum (%100)</span>
          <p class="sim-madde">Aynı evren içinde geçit açıldı. Herhangi bir kural çatışması ya da boyutsal sapma gözlenmez.</p>
        </div>
      `;
      return;
    }

    const evA = evrenler.find(x => x.id === aId);
    const evB = evrenler.find(x => x.id === bId);

    // Deterministik ama zengin simülasyon puanı
    const tohum = (aId.charCodeAt(0) * 17 + bId.charCodeAt(0) * 31) % 100;
    const kararlilik = Math.max(35, Math.min(92, 100 - (tohum % 50)));

    let riskSinifi = 'dusuk';
    let riskMetni = 'Kararlı Geçit (Düşük Risk)';
    if (kararlilik < 55) {
      riskSinifi = 'yuksek';
      riskMetni = 'Yüksek Boyutsal Çatışma (Kritik)';
    } else if (kararlilik < 75) {
      riskSinifi = 'orta';
      riskMetni = 'Kısmi Uyumsuzluk (Orta Risk)';
    }

    alan.innerHTML = `
      <div class="sim-sonuc">
        <span class="sim-risk ${riskSinifi}">${riskMetni} · Kararlılık: %${kararlilik}</span>
        <div class="sim-madde">
          <b>🌀 Doğa Kanunları & Fizik:</b> 
          ${evA.ad} kuralları ile ${evB.ad} kuralları sınır bölgesinde titreşim yaratır. Karşı tarafta bir süre yerçekimi anomalisi ve ışık kırılması yaşanır.
        </div>
        <div class="sim-madde">
          <b>💎 Evrengezer Taşı Etkisi:</b> 
          ${kararlilik > 70 ? 'Taş normal frekansta rezonans sağlar. Geçiş güvenlidir.' : 'Taş yüzeyinde hafif ısınma ve renk solması meydana gelir; 48 saatten uzun kalınması önerilmez.'}
        </div>
        <div class="sim-madde">
          <b>⏳ Zaman Akışı Orantısı:</b> 
          1 ${evA.ad} günü ≈ ${(0.8 + (tohum % 8) * 0.1).toFixed(1)} ${evB.ad} gününe denk düşer.
        </div>
      </div>
    `;
  }

  /* ==========================================================================
     5. SUPABASE YÜKÜNÜ AZALTAN AKILLI ÖNBELLEK VE DEDUPLICATION
     ========================================================================== */

  function supabaseYukOnleyici() {
    // 1. bildirimleriYukle() TTL önbelleği (60 saniye boyunca tekrar çağırma)
    let sonBildirimZamani = 0;
    if (typeof window.bildirimleriYukle === 'function') {
      const orjBildirim = window.bildirimleriYukle;
      window.bildirimleriYukle = async function () {
        if (Date.now() - sonBildirimZamani < 60000 && window.TF4_BILDIRIM && window.TF4_BILDIRIM.liste.length) {
          if (typeof window.bildirimleriCiz === 'function') window.bildirimleriCiz();
          return window.TF4_BILDIRIM.liste;
        }
        sonBildirimZamani = Date.now();
        return orjBildirim.apply(this, arguments);
      };
    }

    // 2. yon24Sor() SessionStorage önbelleği (15 dakika)
    if (typeof window.yon24Sor === 'function') {
      const orjYon24 = window.yon24Sor;
      window.yon24Sor = async function () {
        try {
          const onbellek = sessionStorage.getItem('tf_yon24_cache');
          if (onbellek) {
            const parsed = JSON.parse(onbellek);
            if (Date.now() - parsed.t < 900000) {
              window.YON24 = parsed.v;
              if (typeof window.yon24SeritKoy === 'function') window.yon24SeritKoy();
              return;
            }
          }
        } catch {}

        await orjYon24.apply(this, arguments);
        try {
          sessionStorage.setItem('tf_yon24_cache', JSON.stringify({ t: Date.now(), v: window.YON24 }));
        } catch {}
      };
    }

    // 3. tf4AcikOku deduplication (Aynı URL'ye aynı anda 1'den fazla istek giderse tek promise paylaş)
    const aktifIstekler = new Map();
    if (typeof window.tf4AcikOku === 'function') {
      const orjAcikOku = window.tf4AcikOku;
      window.tf4AcikOku = function (adres, anahtar, ttl) {
        if (aktifIstekler.has(adres)) {
          return aktifIstekler.get(adres);
        }
        const promise = orjAcikOku.apply(this, arguments).finally(() => {
          aktifIstekler.delete(adres);
        });
        aktifIstekler.set(adres, promise);
        return promise;
      };
    }
  }

  /* ==========================================================================
     BAŞLATICI & DÖNGÜ KANCALARI
     ========================================================================== */

  function baslat() {
    v46StilYukle();
    tooltipKur();
    supabaseYukOnleyici();

    // Sayfa render edildikçe zenginleştir
    setInterval(() => {
      yapimlariGuncelle();
      karakterPenceresiniZenginlestir();
      evrenSayfasiKitapButonuEkle();
      akilliLoreTara();
    }, 400);

    // Karşılaştırma / Araçlar sayfasına Simülatör butonu ekle
    window.addEventListener('hashchange', () => {
      setTimeout(() => {
        const karsiAlan = document.getElementById('karsiAlan');
        if (karsiAlan && !karsiAlan.querySelector('#v46SimDugme')) {
          const div = document.createElement('div');
          div.id = 'v46SimDugme';
          div.style.marginTop = '16px';
          div.innerHTML = `
            <button type="button" class="dugme dugme-sade" onclick="gecitSimulasyonuAc()" style="width:100%; justify-content:center;">
              🌌 Geçit & Kural Çatışması Simülatörü Aç
            </button>
          `;
          karsiAlan.appendChild(div);
        }
      }, 100);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baslat);
  } else {
    baslat();
  }

})();
