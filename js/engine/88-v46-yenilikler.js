(function () {
  'use strict';

  /* ==========================================================================
     1. GEZİNME & MODEL EVRENİ ENTEGRASYONU
     ========================================================================== */
  function evrenGezinmeKur() {
    if (typeof window.GEZINME !== 'undefined' && Array.isArray(window.GEZINME)) {
      const varMi = window.GEZINME.some(g => g.id === 'eterya' || g.id === 'modelEvren');
      if (!varMi) {
        window.GEZINME.push({
          id: 'eterya',
          ad: 'Eterya (Test)',
          ikon: '✧',
          bolumler: [['modelEvren', 'Eterya']]
        });
        if (typeof window.SAYFA_BASLIK !== 'undefined') {
          window.SAYFA_BASLIK['eterya'] = 'Eterya: Yıldız Kırıkları (Test)';
        }
      }
    }
    if (typeof window.GEC_CIZILENLER !== 'undefined') {
      window.GEC_CIZILENLER['modelEvren'] = 'modelEvrenCiz';
    }
  }

  /* ==========================================================================
     2. UYGULAMA İÇİ BİLDİRİM AYARLARI & MOBİL MODERASYON ENTEGRASYONU
     ========================================================================== */
  function senSayfasiAyarEkle() {
    const ayarAlani = document.querySelector('#ayar25Alan') || document.querySelector('#hesapAlan');
    if (!ayarAlani || document.querySelector('#v46EkAyarlar')) return;

    const div = document.createElement('div');
    div.id = 'v46EkAyarlar';
    div.style.marginTop = '18px';

    const bildirimDurumu = localStorage.getItem('tentiforapp_ayar_guncelleme_bildirim') !== '0';

    div.innerHTML = `
      <!-- UYGULAMA İÇİ BİLDİRİM AYARLARI -->
      <details class="kutu-y ayar25" open style="margin-bottom:14px;">
        <summary><b>🔔 Güncelleme & İçerik Bildirimleri (v4.6.1)</b></summary>
        <div class="ayar25-satir" style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--renk-kenar, #eee);">
          <div>
            <b>Yeni Sürüm ve İçerik Uyarıları</b>
            <div class="oyun-not">Yeni evren veya sürüm yayınlandığında sistem bildirimi gönder</div>
          </div>
          <button type="button" class="dugme ${bildirimDurumu ? 'dugme-sade' : ''} y-kucuk" id="v46BildirimToggle">
            ${bildirimDurumu ? 'Bildirimler: Açık (Kapat)' : 'Bildirimler: Kapalı (Aç)'}
          </button>
        </div>
        <div class="ayar25-satir" style="display:flex; justify-content:space-between; align-items:center; padding:8px 0;">
          <div>
            <span>Tarayıcı / Cihaz İzni</span>
            <div class="oyun-not" id="v46IzinMetin">Durum: ${"Notification" in window ? Notification.permission : "desteklenmiyor"}</div>
          </div>
          <button type="button" class="dugme y-kucuk" id="v46TestBildirimBtn">Test Bildirimi Gönder</button>
        </div>
      </details>

      <!-- MOBİL & MASAÜSTÜ MODERASYON ERİŞİMİ -->
      <details class="kutu-y ayar25" open>
        <summary><b>🛡️ Moderasyon & Yönetim Paneli</b></summary>
        <p class="oyun-not">Okur evrenlerini, fan hikâyelerini, şikâyetleri ve topluluk başvurularını incelemek için tek tıkla moderasyon paneline git:</p>
        <div class="oyun-sira" style="margin-top:10px;">
          <a href="#/moderasyon" class="dugme" style="text-decoration:none; display:inline-flex; align-items:center; gap:8px;">
            🛡️ Moderasyon Panelini Aç
          </a>
        </div>
      </details>
    `;

    ayarAlani.appendChild(div);

    // Event listenerlar
    const toggleBtn = div.querySelector('#v46BildirimToggle');
    if (toggleBtn) {
      toggleBtn.onclick = function () {
        const suan = localStorage.getItem('tentiforapp_ayar_guncelleme_bildirim') !== '0';
        const yeni = !suan;
        localStorage.setItem('tentiforapp_ayar_guncelleme_bildirim', yeni ? '1' : '0');
        toggleBtn.textContent = yeni ? 'Bildirimler: Açık (Kapat)' : 'Bildirimler: Kapalı (Aç)';
        toggleBtn.className = 'dugme ' + (yeni ? 'dugme-sade' : '') + ' y-kucuk';
        if (typeof window.eckaBildir === 'function') {
          window.eckaBildir(yeni ? 'Güncelleme bildirimleri açıldı.' : 'Güncelleme bildirimleri kapatıldı.');
        }
      };
    }

    const testBtn = div.querySelector('#v46TestBildirimBtn');
    if (testBtn) {
      testBtn.onclick = async function () {
        if ("Notification" in window) {
          if (Notification.permission !== "granted") {
            const perm = await Notification.requestPermission();
            const izinMetin = div.querySelector('#v46IzinMetin');
            if (izinMetin) izinMetin.textContent = 'Durum: ' + perm;
          }
          if (Notification.permission === "granted") {
            new Notification("TentiforApp v4.6.1", {
              body: "Bildirim sistemi başarıyla çalışıyor! Yeni sürüm ve evrenlerden anında haberdar olacaksınız.",
              icon: "ikon/ikon-192.png"
            });
            if (typeof window.eckaBildir === 'function') {
              window.eckaBildir('Test bildirimi gönderildi!');
            }
          } else {
            if (typeof window.eckaBildir === 'function') {
              window.eckaBildir('Tarayıcı bildirim izni verilmedi.');
            }
          }
        } else {
          if (typeof window.eckaBildir === 'function') {
            window.eckaBildir('Bu tarayıcı bildirimleri desteklemiyor.');
          }
        }
      };
    }
  }

  /* ==========================================================================
     3. SUPABASE YÜKÜNÜ AZALTAN AKILLI ÖNBELLEK VE DEDUPLICATION
     ========================================================================== */
  function supabaseYukOnleyici() {
    let sonBildirimZamani = 0;
    if (typeof window.bildirimleriYukle === 'function') {
      const orjBildirim = window.bildirimleriYukle;
      window.bildirimleriYukle = async function () {
        if (Date.now() - sonBildirimZamani < 60000 && window.TF4_BILDIRIM && window.TF4_BILDIRIM.liste && window.TF4_BILDIRIM.liste.length) {
          if (typeof window.bildirimleriCiz === 'function') window.bildirimleriCiz();
          return window.TF4_BILDIRIM.liste;
        }
        sonBildirimZamani = Date.now();
        return orjBildirim.apply(this, arguments);
      };
    }

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

    const aktifIstekler = new Map();
    if (typeof window.tf4AcikOku === 'function') {
      const orjAcikOku = window.tf4AcikOku;
      window.tf4AcikOku = function (adres) {
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
     4. ÇOKLU EVREN GEÇİT & KURAL ÇATIŞMASI SİMÜLATÖRÜ
     ========================================================================== */
  window.gecitSimulasyonuAc = function () {
    const perde = document.getElementById('perde');
    if (!perde) return;

    const evrenler = [
      { id: 'tomye', ad: 'Tömye Evreni', kurallar: ['Gökyüzünde ay yoktur, aylar 28 gündür', 'Buz altı enerjisi ve Kyldo kimliği', 'Taş taşıyan Evrengezerler'] },
      { id: 'eterya', ad: 'Eterya: Yıldız Kırıkları (Test)', kurallar: ['Eter kırıkları ve saf ışık', 'Çapraz yerçekimi', 'Işık glifleri alfabesi', 'Rezonans kristalleri'] },
      { id: 'claude', ad: "Claude'un Evreni (Şomdo)", kurallar: ['Işığın yürüme hızında gitmesi', 'Düşünce kristalleşmesi'] },
      { id: 'e25', ad: 'E25 Evreni', kurallar: ['Sürekli sis ve boyut çatlağı', 'Kütüphane koruyuculuğu'] }
    ];

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
        <div class="sim-secimler" style="display:grid; grid-template-columns:1fr auto 1fr; gap:12px; align-items:center; margin:14px 0;">
          <div>
            <label style="font-weight:600; font-size:13px; display:block; margin-bottom:4px;">1. Kaynak Evren</label>
            <select class="kod-giris arac-giris" id="simEvrenA">
              ${evrenler.map((e, idx) => `<option value="${e.id}" ${idx === 0 ? 'selected' : ''}>${e.ad}</option>`).join('')}
            </select>
          </div>
          <div style="font-size:22px; font-weight:bold; color:var(--renk-vurgu, #2f81f7); text-align:center;">⇄</div>
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
        <div id="simSonucAlani" style="margin-top:16px;"></div>
      </div>
    `;
    perde.hidden = false;

    function calistir() {
      const aId = document.getElementById('simEvrenA').value;
      const bId = document.getElementById('simEvrenB').value;
      const alan = document.getElementById('simSonucAlani');
      if (!alan) return;

      if (aId === bId) {
        alan.innerHTML = `
          <div class="kutu-y" style="border-left:4px solid #2ecc71;">
            <b>✓ Tam Uyum (%100)</b>
            <p class="oyun-not" style="margin-top:6px;">Aynı evren içinde geçit açıldı. Herhangi bir kural çatışması veya boyutsal sapma gözlenmez.</p>
          </div>
        `;
        return;
      }

      const evA = evrenler.find(x => x.id === aId) || { ad: aId };
      const evB = evrenler.find(x => x.id === bId) || { ad: bId };

      const tohum = (aId.charCodeAt(0) * 17 + bId.charCodeAt(0) * 31) % 100;
      const kararlilik = Math.max(40, Math.min(94, 100 - (tohum % 45)));

      alan.innerHTML = `
        <div class="kutu-y" style="border-left:4px solid var(--renk-vurgu, #2f81f7);">
          <span class="oyun-etiket">Geçit Kararlılığı: %${kararlilik}</span>
          <div style="margin-top:8px; font-size:13.5px; line-height:1.5;">
            <b>🌀 Doğa Kanunları & Fizik:</b> ${evA.ad} ile ${evB.ad} sınırında rezonans dalgalanması yaşanır. Kural çatışması geçici bir yerçekimi kırılması oluşturur.
          </div>
          <div style="margin-top:6px; font-size:13.5px; line-height:1.5;">
            <b>💎 Evrengezer Taşı Tepkisi:</b> ${kararlilik > 70 ? 'Taş normal frekansta rezonans sağlar, geçiş güvenlidir.' : 'Taş yüzeyinde ısınma gözlenir; 48 saatten uzun kalınması önerilmez.'}
          </div>
          <div style="margin-top:6px; font-size:13.5px; line-height:1.5;">
            <b>⏳ Zaman Akışı:</b> 1 ${evA.ad} günü ≈ ${(0.8 + (tohum % 8) * 0.1).toFixed(1)} ${evB.ad} gününe denk düşer.
          </div>
        </div>
      `;
    }

    const hBtn = document.getElementById('simHesaplaBtn');
    if (hBtn) hBtn.onclick = calistir;
    calistir();
  };

  /* ==========================================================================
     BAŞLATMA
     ========================================================================== */
  function baslat() {
    evrenGezinmeKur();
    supabaseYukOnleyici();
    setInterval(senSayfasiAyarEkle, 500);

    window.addEventListener('hashchange', () => {
      evrenGezinmeKur();
      setTimeout(senSayfasiAyarEkle, 100);
      if (location.hash === '#/eterya' || location.hash === '#/modelEvren') {
        if (typeof window.modelEvrenCiz === 'function') {
          setTimeout(window.modelEvrenCiz, 50);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baslat);
  } else {
    baslat();
  }
})();
