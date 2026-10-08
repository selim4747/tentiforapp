(function () {
  'use strict';

  function evrenGezinmeKur() {
    if (typeof window.GEZINME !== 'undefined' && Array.isArray(window.GEZINME)) {
      const varMi = window.GEZINME.some(g => g.id === 'eterya' || g.id === 'modelEvren');
      if (!varMi) {
        const claudeIdx = window.GEZINME.findIndex(g => g.id === 'claude');
        const kayit = {
          id: 'eterya',
          ad: 'Eterya (Test)',
          ikon: '✧',
          bolumler: [['modelEvren', 'Eterya']]
        };
        if (claudeIdx >= 0) window.GEZINME.splice(claudeIdx + 1, 0, kayit);
        else window.GEZINME.push(kayit);
      }
      if (typeof window.SAYFA_BASLIK !== 'undefined') {
        window.SAYFA_BASLIK['eterya'] = 'Eterya: Yıldız Kırıkları (Test)';
      }
    }
    if (typeof window.GEC_CIZILENLER !== 'undefined') {
      window.GEC_CIZILENLER['modelEvren'] = 'modelEvrenCiz';
    }
    if (typeof cizildi !== 'undefined' && cizildi) delete cizildi.modelEvren;
    if (typeof gezinmeCiz === 'function') {
      try { gezinmeCiz(); } catch (e) {}
    }
  }

  function eteryaSayfasiniAc() {
    evrenGezinmeKur();
    const hash = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
    if (hash !== 'eterya' && hash !== 'modelEvren') return;
    if (typeof sayfaYonlendir === 'function') sayfaYonlendir();
    if (typeof modelEvrenCiz === 'function') modelEvrenCiz();
  }

  function senSayfasiAyarEkle() {
    const ayarAlani = document.querySelector('#ayar25Alan') || document.querySelector('#hesapAlan');
    if (!ayarAlani || document.querySelector('#v46EkAyarlar')) return;
    const div = document.createElement('div');
    div.id = 'v46EkAyarlar';
    div.style.marginTop = '18px';
    const bildirimDurumu = localStorage.getItem('tentiforapp_ayar_guncelleme_bildirim') !== '0';
    div.innerHTML = `
      <details class="kutu-y ayar25" open style="margin-bottom:14px;">
        <summary><b>🔔 Güncelleme & İçerik Bildirimleri (v4.7.2)</b></summary>
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
            if (!navigator.serviceWorker || !navigator.serviceWorker.ready) {
              if (typeof window.eckaBildir === 'function') window.eckaBildir('Bildirim servisi hazır değil. Sayfayı yenileyip tekrar dene.');
              return;
            }
            try {
              const kayit = await navigator.serviceWorker.ready;
              await kayit.showNotification("TentiFor v4.7.2", {
                body: "Bildirim sistemi çalışıyor.",
                icon: "ikon/ikon-192.png",
                tag: "tentiforapp-test-bildirim"
              });
              if (typeof window.eckaBildir === 'function') window.eckaBildir('Test bildirimi gönderildi!');
            } catch (e) {
              if (typeof window.eckaBildir === 'function') window.eckaBildir('Bildirim gönderilemedi: ' + (e && e.message || e));
            }
          } else if (typeof window.eckaBildir === 'function') {
            window.eckaBildir('Tarayıcı bildirim izni verilmedi.');
          }
        } else if (typeof window.eckaBildir === 'function') {
          window.eckaBildir('Bu tarayıcı bildirimleri desteklemiyor.');
        }
      };
    }
  }

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
        if (aktifIstekler.has(adres)) return aktifIstekler.get(adres);
        const promise = orjAcikOku.apply(this, arguments).finally(() => { aktifIstekler.delete(adres); });
        aktifIstekler.set(adres, promise);
        return promise;
      };
    }
  }

  window.gecitSimulasyonuAc = function () {
    const perde = document.getElementById('perde');
    if (!perde) return;
    const evrenler = [
      { id: 'tomye', ad: 'Tömye Evreni', kurallar: ['Gökyüzünde ay yoktur'] },
      { id: 'eterya', ad: 'Eterya', kurallar: ['Eter kırıkları'] },
      { id: 'claude', ad: "Claude'un Evreni", kurallar: ['Işık yürüme hızında'] },
      { id: 'e25', ad: 'E25 Evreni', kurallar: ['Sis ve boyut çatlağı'] }
    ];
    if (typeof window.fanEserlerim === 'function') {
      window.fanEserlerim().forEach(fe => {
        if (fe.tur === 'evren') evrenler.push({ id: fe.id, ad: fe.ad || 'Özel Evren', kurallar: (fe.kurallar || []).map(k => k.ad || k.aciklama).filter(Boolean) });
      });
    }
    perde.innerHTML = '<div class="pencere"><button class="pencere-kapat" data-kapat="1">✕</button><h2>Geçit Simülatörü</h2><p class="oyun-not">İki evren arası kural çatışması.</p></div>';
    perde.hidden = false;
  };

  function v47IcEvrenYukle() {
    if (document.querySelector('script[data-v47]')) return;
    const s = document.createElement('script');
    s.src = 'js/engine/89-v47-ic-evren.js?v=6314';
    s.defer = true;
    s.setAttribute('data-v47', '1');
    document.head.appendChild(s);
  }

  function v472IcSinirYukle() {
    if (document.querySelector('script[data-v472]')) return;
    const s = document.createElement('script');
    s.src = 'js/engine/90-v472-ic-sinir.js?v=472';
    s.defer = true;
    s.setAttribute('data-v472', '1');
    document.head.appendChild(s);
  }

  function baslat() {
    evrenGezinmeKur();
    supabaseYukOnleyici();
    v47IcEvrenYukle();
    v472IcSinirYukle();
    setInterval(senSayfasiAyarEkle, 500);
    setTimeout(eteryaSayfasiniAc, 0);
    window.addEventListener('hashchange', () => {
      evrenGezinmeKur();
      setTimeout(senSayfasiAyarEkle, 100);
      setTimeout(eteryaSayfasiniAc, 50);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();
})();
