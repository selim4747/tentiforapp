/* TentiFor — APK Özel ve Sıradaki Araçlar Motoru (v6.5.4)
 * 1. İnternetsiz Yerel Hatırlatıcı & Etkileşimli Bildirimler (Capacitor LocalNotifications)
 * 2. Bölünmüş Ekran Zekası (Split-Screen & Foldables Multi-Window)
 * 3. Yerel Klasör Senkronizasyonu (Documents/Tentifor Storage Access)
 * 4. [2] Zen Daktilo Modu (APK'ye Özel — Web'de kilitli)
 * 5. [4] Evren ve Taslak Karşılaştırma / Diff Aracı (APK'ye Özel — Web'de kilitli)
 * 6. [5] Biyonik & Hızlı Okuma Laboratuvarı (RSVP & Bionic Focus — APK'ye Özel — Web'de kilitli)
 */
(function () {
  'use strict';

  function isApk() {
    return !!(
      (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
      (typeof window.kabukMu === 'function' && window.kabukMu())
    );
  }

  function getPlugin(name) {
    if (typeof window.kabukEklenti === 'function') {
      var p = window.kabukEklenti(name);
      if (p) return p;
    }
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name];
  }

  function kacir(str) {
    return typeof window.kacir === 'function' ? window.kacir(str) : String(str || '').replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function toast(msg) {
    if (typeof window.eckaBildir === 'function') window.eckaBildir(msg);
    else console.info('[TentiforAPK]', msg);
  }

  /* =========================================================================
     0. WEB KİLİTLİ MODAL BİLDİRİMİ (Web kullanıcılarına açık ve şık bilgilendirme)
     ========================================================================= */
  function gosterWebKilitliModal(baslik, aciklama) {
    var perde = document.getElementById('perde');
    if (!perde) return;
    perde.hidden = false;
    perde.innerHTML = [
      '<div class="pencere" role="dialog" aria-modal="true" aria-label="' + kacir(baslik) + '" style="max-width: 520px;">',
      '  <div class="pencere-ust">',
      '    <span class="oyun-etiket" style="color: #b84a39; font-weight: bold;">🔒 TENTİFOR APK\'YE ÖZEL</span>',
      '    <button class="pencere-kapat" type="button" data-apk-kapat aria-label="Kapat">✕</button>',
      '  </div>',
      '  <h3 style="margin: 10px 0 12px; font-family: var(--display); font-size: 24px;">' + kacir(baslik) + '</h3>',
      '  <p class="oyun-not" style="font-size: 15px; line-height: 1.6; margin-bottom: 16px; color: var(--murekkep);">' + kacir(aciklama) + '</p>',
      '  <div class="kutu-y" style="background: rgba(28,92,150,0.06); border: 1px dashed var(--deniz); padding: 14px; margin-bottom: 20px; border-radius: 8px;">',
      '    <b style="color: var(--deniz);">Neden Web\'de Çalışmıyor?</b><br>',
      '    <span style="font-size: 13.5px; line-height: 1.5; color: var(--murekkep-2);">Bu araç, Android donanım hızlandırması, yerel dosya sistemi (SAF), haptik titreşim motoru ve çevrimdışı işlem altyapısıyla bütünleşik tasarlanmıştır. Web tarayıcısı üzerinden doğrudan çalıştırılamaz; tam deneyim için Tentifor APK gereklidir.</span>',
      '  </div>',
      '  <div style="display: flex; gap: 10px; flex-wrap: wrap;">',
      '    <a class="dugme" href="/uygulama/indir/tentiforapp.apk" download style="text-decoration:none;">📲 Tentifor Android APK 6.5.4 İndir</a>',
      '    <button class="dugme dugme-sade" type="button" data-apk-kapat>Anladım, Kapat</button>',
      '  </div>',
      '  <p class="oyun-not" role="note" style="font-size: 12px; margin: 10px 0 0;">Not: Bu APK debug sertifikasıyla imzalıdır. Bazı önceki kurulumların üzerine yükleme reddedilebilir; uygulamayı kaldırıp yeniden kurmak cihazdaki yerel verileri silebilir. Gerekli verileri önceden yedekleyin.</p>',
      '</div>'
    ].join('');
  }

  /* =========================================================================
     1. İNTERNETSİZ YEREL HATIRLATICI & ETKİLEŞİMLİ BİLDİRİMLER
     ========================================================================= */
  var TentiforApkHatirlatici = {
    KEY_AYAR: 'tf_apk_yerel_hatirlatma',
    KEY_STREAK: 'tf_apk_okuma_streak_gun',
    CHANNEL_ID: 'tentifor_yerel_hatirlatma',
    ACTION_TYPE_ID: 'TF_HATIRLATMA_EYLEM',

    varsayilanAyar: function () {
      return {
        aktif: true,
        saat: 20,
        dakika: 30,
        gunlukStreak: true,
        haftalikOzet: true
      };
    },

    ayarAl: function () {
      try {
        var kayit = localStorage.getItem(this.KEY_AYAR);
        return kayit ? Object.assign(this.varsayilanAyar(), JSON.parse(kayit)) : this.varsayilanAyar();
      } catch (_) {
        return this.varsayilanAyar();
      }
    },

    ayarKaydet: function (yeni) {
      try {
        localStorage.setItem(this.KEY_AYAR, JSON.stringify(yeni));
      } catch (_) {}
      this.zamanla();
    },

    etkilesimliKanalKur: async function () {
      var ln = getPlugin('LocalNotifications');
      if (!ln) return;
      try {
        if (ln.createChannel) {
          await ln.createChannel({
            id: this.CHANNEL_ID,
            name: 'TentiFor Yerel Hatırlatıcı',
            description: 'İnternetsiz çevrimdışı okuma ve alışkanlık hatırlatıcıları',
            importance: 4,
            visibility: 1,
            vibration: true
          });
        }
        if (ln.registerActionTypes) {
          await ln.registerActionTypes({
            types: [
              {
                id: this.ACTION_TYPE_ID,
                actions: [
                  { id: 'HEMEN_OKU', title: '📖 Hemen Oku' },
                  { id: 'ERTELE_1S', title: '⏱️ 1 Saat Ertele' },
                  { id: 'TAMAMLA', title: '✓ Tamamlandı' }
                ]
              }
            ]
          });
        }
      } catch (e) {
        console.warn('[Hatırlatıcı] Kanal/Eylem kaydedilemedi:', e);
      }
    },

    zamanla: async function () {
      var ln = getPlugin('LocalNotifications');
      var ayar = this.ayarAl();
      if (!isApk() || !ln) {
        // Web modunda yerel zamanlayıcı pasif kalır
        return;
      }

      await this.etkilesimliKanalKur();

      try {
        // Eski hatırlatıcı bildirimlerini temizle (ID aralığı 8800 - 8807)
        var iptalListesi = [];
        for (var k = 0; k < 7; k++) iptalListesi.push({ id: 8800 + k });
        if (ln.cancel) await ln.cancel({ notifications: iptalListesi });

        if (!ayar.aktif) return;

        var bildirimler = [];
        var simdi = new Date();
        for (var i = 0; i < 7; i++) {
          var hedefTarih = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate() + i, ayar.saat, ayar.dakika, 0, 0);
          if (hedefTarih.getTime() <= simdi.getTime() + 60000) {
            continue;
          }
          bildirimler.push({
            id: 8800 + i,
            title: 'Tentiforverse Okuma Saati',
            body: 'Bugünkü okuma hedefini tamamlamak ve serini korumak için bir bölüm aç.',
            channelId: this.CHANNEL_ID,
            actionTypeId: this.ACTION_TYPE_ID,
            schedule: { at: hedefTarih, allowWhileIdle: true },
            extra: { tip: 'yerel_okuma', gun: i }
          });
        }

        if (bildirimler.length && ln.schedule) {
          await ln.schedule({ notifications: bildirimler });
        }
      } catch (err) {
        console.warn('[Hatırlatıcı] Zamanlama hatası:', err);
      }
    },

    hemenDene: async function () {
      var ln = getPlugin('LocalNotifications');
      if (!isApk() || !ln) {
        toast('İnternetsiz yerel bildirim motoru APK kabuğunda çalışır.');
        return;
      }
      try {
        await this.etkilesimliKanalKur();
        var testZamani = new Date(Date.now() + 2000);
        await ln.schedule({
          notifications: [
            {
              id: 8899,
              title: '📖 Tentifor Okuma Hatırlatıcısı (Test)',
              body: 'Çevrimdışı yerel bildirim testi. Butonlara dokunarak aksiyon alabilirsin.',
              channelId: this.CHANNEL_ID,
              actionTypeId: this.ACTION_TYPE_ID,
              schedule: { at: testZamani, allowWhileIdle: true },
              extra: { tip: 'test' }
            }
          ]
        });
        toast('Etkileşimli yerel bildirim 2 saniye sonra gelecek.');
      } catch (e) {
        toast('Bildirim gönderilemedi: ' + (e && e.message || e));
      }
    },

    eylemYonet: async function (detay) {
      var actionId = detay && detay.actionId;
      var ln = getPlugin('LocalNotifications');
      if (actionId === 'HEMEN_OKU') {
        location.hash = '#/okuma';
        toast('Okuma alanına yönlendiriliyorsun.');
      } else if (actionId === 'ERTELE_1S') {
        if (ln && ln.schedule) {
          try {
            await ln.schedule({
              notifications: [
                {
                  id: 8898,
                  title: '⏰ Ertelenen Okuma Saati',
                  body: '1 saat önceki hatırlatman geldi. Şimdi okumaya başlayabilirsin.',
                  channelId: this.CHANNEL_ID,
                  actionTypeId: this.ACTION_TYPE_ID,
                  schedule: { at: new Date(Date.now() + 3600000), allowWhileIdle: true }
                }
              ]
            });
            toast('1 saat ertelendi.');
          } catch (_) {}
        }
      } else if (actionId === 'TAMAMLA') {
        var bugun = new Date().toLocaleDateString('en-CA');
        try {
          var okumaMap = JSON.parse(localStorage.getItem('tf28_okuma') || '{}');
          okumaMap[bugun] = Math.max(okumaMap[bugun] || 0, 900); // 15 dk tamamlandı say
          localStorage.setItem('tf28_okuma', JSON.stringify(okumaMap));
          toast('Bugünkü okuma hedefin tamamlandı olarak işaretlendi! ✓');
        } catch (_) {}
      }
    },

    panelAc: function () {
      var ayar = this.ayarAl();
      var perde = document.getElementById('perde');
      if (!perde) return;
      perde.hidden = false;
      var saatStr = (ayar.saat < 10 ? '0' : '') + ayar.saat;
      var dakStr = (ayar.dakika < 10 ? '0' : '') + ayar.dakika;

      perde.innerHTML = [
        '<div class="pencere" role="dialog" aria-modal="true" aria-label="Yerel Hatırlatıcı Ayarları" style="max-width: 480px;">',
        '  <div class="pencere-ust">',
        '    <span class="oyun-etiket">ÇEVRİMDIŞI DONANIM BİLDİRİMİ</span>',
        '    <button class="pencere-kapat" type="button" data-apk-kapat aria-label="Kapat">✕</button>',
        '  </div>',
        '  <h3 style="margin: 8px 0 12px; font-family: var(--display);">İnternetsiz Yerel Hatırlatıcı</h3>',
        '  <p class="oyun-not">Cihazın kendi donanım saatini kullanır. İnternetin kapalı olsa dahi her gün belirlediğin saatte bildirim gönderir.</p>',
        '  <div class="kutu-y" style="margin: 16px 0; display: flex; flex-direction: column; gap: 12px;">',
        '    <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">',
        '      <input type="checkbox" id="tfYrlAktif" ' + (ayar.aktif ? 'checked' : '') + '>',
        '      <b>Günlük yerel okuma hatırlatması aktif</b>',
        '    </label>',
        '    <div style="display:flex; align-items:center; gap:10px;">',
        '      <span>Hatırlatma Saati:</span>',
        '      <input type="time" id="tfYrlSaat" value="' + saatStr + ':' + dakStr + '" class="kod-giris" style="padding: 6px 10px; border-radius: 4px; border: 1px solid var(--sig); font-size: 15px;">',
        '    </div>',
        '    <div class="oyun-not" style="font-size: 12.5px; margin-top: 4px;">Bildirimler kilit ekranında butonlar taşır: "Hemen Oku", "1 Saat Ertele" ve "Tamamlandı".</div>',
        '  </div>',
        '  <div style="display: flex; gap: 10px; flex-wrap: wrap;">',
        '    <button class="dugme" type="button" id="tfYrlKaydet">Ayarları Kaydet</button>',
        '    <button class="dugme dugme-sade" type="button" id="tfYrlTest">Şimdi Test Et (2 sn)</button>',
        '  </div>',
        '</div>'
      ].join('');

      document.getElementById('tfYrlKaydet').addEventListener('click', function () {
        var aktif = document.getElementById('tfYrlAktif').checked;
        var saatVal = document.getElementById('tfYrlSaat').value || '20:30';
        var parts = saatVal.split(':');
        TentiforApkHatirlatici.ayarKaydet({
          aktif: aktif,
          saat: parseInt(parts[0], 10) || 20,
          dakika: parseInt(parts[1], 10) || 30
        });
        toast('Hatırlatıcı ayarları güncellendi.');
        perde.hidden = true;
      });

      document.getElementById('tfYrlTest').addEventListener('click', function () {
        TentiforApkHatirlatici.hemenDene();
      });
    }
  };

  /* =========================================================================
     2. BÖLÜNMÜŞ EKRAN ZEKASI (Split-Screen & Foldables Multi-Window)
     ========================================================================= */
  var TentiforBolunmusEkran = {
    aktifMi: false,
    denetle: function () {
      var w = window.innerWidth;
      var h = window.innerHeight;
      var oran = w / Math.max(1, h);

      // Çoklu pencere (Split-screen): Android'de ekran ikiye bölündüğünde w >= 560 ve en/boy oranı kareye yaklaşır
      // veya geniş ekran / katlanabilir cihazlarda w >= 880
      var bolunmus = (w >= 880) || (w >= 540 && Math.abs(oran - 1.0) < 0.35 && h >= 480);

      if (bolunmus !== this.aktifMi) {
        this.aktifMi = bolunmus;
        document.documentElement.toggleAttribute('data-tf-bolunmus-ekran', bolunmus);
        window.dispatchEvent(new CustomEvent('tf-bolunmus-degisti', { detail: { bolunmus: bolunmus, w: w, h: h } }));
        if (bolunmus) {
          this.yanPaneliHazirla();
        } else {
          var panel = document.getElementById('tfBolunmusYanPanel');
          if (panel) panel.remove();
        }
      }
    },

    yanPaneliHazirla: function () {
      if (document.getElementById('tfBolunmusYanPanel')) return;
      var panel = document.createElement('aside');
      panel.id = 'tfBolunmusYanPanel';
      panel.className = 'tf-bolunmus-yan-panel';
      panel.setAttribute('role', 'complementary');
      panel.setAttribute('aria-label', 'Bölünmüş Ekran Çift Panel Rehberi');
      panel.innerHTML = [
        '<div class="tf-by-ust">',
        '  <span class="oyun-etiket">BÖLÜNMÜŞ EKRAN REHBERİ</span>',
        '  <button type="button" class="tf-by-kapat" data-by-kapat aria-label="Gizle">✕</button>',
        '</div>',
        '<div class="tf-by-icerik">',
        '  <b>Çift Panelli Çalışma Alanı</b>',
        '  <p class="oyun-not">Tablet, katlanabilir ekran veya bölünmüş pencere modundasın. Ana içerik akarken sağ panelde hızlı not alabilir veya evren haritasını canlı tutabilirsin.</p>',
        '  <div class="tf-by-not-kutu" style="margin-top: 10px;">',
        '    <textarea id="tfByNot" placeholder="Bu sayfayı okurken hızlı notun..." style="width: 100%; min-height: 100px; padding: 8px; font-family: var(--govde); border: 1px solid var(--sig); border-radius: 4px; box-sizing: border-box;"></textarea>',
        '    <div style="display:flex; justify-content:space-between; margin-top:6px;">',
        '      <small id="tfByNotDurum" class="oyun-not">Cihazda otomatik saklanır</small>',
        '      <button type="button" class="ic-bag" id="tfByTaslagaAktar">Taslağa Ekle →</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');
      document.body.appendChild(panel);

      var txt = panel.querySelector('#tfByNot');
      try {
        txt.value = localStorage.getItem('tf_bolunmus_hizli_not') || '';
      } catch (_) {}
      txt.addEventListener('input', function () {
        try {
          localStorage.setItem('tf_bolunmus_hizli_not', txt.value);
        } catch (_) {}
      });

      panel.querySelector('[data-by-kapat]').addEventListener('click', function () {
        panel.classList.toggle('gizli');
      });

      panel.querySelector('#tfByTaslagaAktar').addEventListener('click', function () {
        if (!txt.value.trim()) return;
        try {
          var eski = localStorage.getItem('tentifor_zen_taslak') || '';
          localStorage.setItem('tentifor_zen_taslak', (eski ? eski + '\n\n' : '') + txt.value.trim());
          toast('Not Zen Taslağına aktarıldı.');
        } catch (_) {}
      });
    }
  };

  /* =========================================================================
     3. YEREL KLASÖR SENKRONİZASYONU (Documents/Tentifor Storage Access)
     ========================================================================= */
  var TentiforYerelKlasorSenk = {
    KLASOR_ADI: 'Tentifor',

    senkronizeEt: async function () {
      if (!isApk()) {
        gosterWebKilitliModal('Yerel Klasör Senkronizasyonu', 'Cihazın yerel depolama alanı (/Documents/Tentifor/) ile otomatik dosya senkronizasyonu yalnızca Tentifor Android uygulamasında çalışır.');
        return;
      }

      var fs = getPlugin('Filesystem');
      if (!fs) {
        toast('Filesystem eklentisi hazır değil.');
        return;
      }

      try {
        toast('Yerel klasör senkronizasyonu başlatılıyor...');
        // 1. Documents dizininde Tentifor klasörünü sağla
        try {
          await fs.mkdir({
            path: this.KLASOR_ADI,
            directory: 'DOCUMENTS',
            recursive: true
          });
        } catch (_) {}

        // 2. Cihazdaki taslak ve evren verilerini topla
        var paket = {
          olusturuldu: new Date().toISOString(),
          cihaz: 'TentiforApp Android Native',
          surum: (typeof window.veri !== 'undefined' && window.veri && window.veri.surum) || '6.5.4',
          zenTaslak: localStorage.getItem('tentifor_zen_taslak') || '',
          bolunmusNot: localStorage.getItem('tf_bolunmus_hizli_not') || '',
          okumaIlerleme: localStorage.getItem('tentiforapp_v50_devam') || '',
          fanTaslaklar: localStorage.getItem('tf4_fan_taslaklar') || ''
        };

        var dosyaAdi = this.KLASOR_ADI + '/tentifor-yerel-senk-' + new Date().toISOString().slice(0, 10) + '.json';
        await fs.writeFile({
          path: dosyaAdi,
          data: JSON.stringify(paket, null, 2),
          directory: 'DOCUMENTS',
          encoding: 'utf8'
        });

        toast('Başarılı: Belgeler/Tentifor klasörüne eşitlendi. ✓');
      } catch (err) {
        console.error('[YerelKlasor]', err);
        toast('Klasör senkronizasyonu hatası: ' + (err && err.message || err));
      }
    }
  };

  /* =========================================================================
     4. [2] ZEN DAKTİLO MODU (APK'ye Özel — Web'de Kilitli)
     ========================================================================= */
  var TentiforZenDaktilo = {
    KEY_TASLAK: 'tentifor_zen_taslak',
    audioCtx: null,

    calDaktiloSesi: function (tip) {
      if (!isApk()) return;
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!this.audioCtx && AudioCtx) this.audioCtx = new AudioCtx();
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        var now = this.audioCtx.currentTime;
        var osc = this.audioCtx.createOscillator();
        var gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        if (tip === 'zil') {
          // Satır sonu zili (Carriage return bell)
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1760, now);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
        } else if (tip === 'bosluk') {
          // Boşluk tuşu (Tok vuruş)
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(120, now);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
        } else {
          // Metalik daktilo tuş tıklaması
          osc.type = 'square';
          osc.frequency.setValueAtTime(440 + Math.random() * 200, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
        }
      } catch (_) {}
    },

    haptikTitre: function () {
      if (!isApk()) return;
      var haptics = getPlugin('Haptics');
      if (haptics && haptics.impact) {
        haptics.impact({ style: 'light' }).catch(function () {});
      }
    },

    ac: function () {
      if (!isApk()) {
        gosterWebKilitliModal(
          'Zen Daktilo Modu',
          'Mekanik ses sentezleyici, haptik tuş titreşimi, dikkat dağıtmayan tam ekran odak alanı ve donanımsal yerel taslak koruması yalnızca Tentifor APK\'de çalışır. Web sürümünden erişilemez.'
        );
        return;
      }

      var taslak = '';
      try {
        taslak = localStorage.getItem(this.KEY_TASLAK) || '';
      } catch (_) {}

      var modal = document.createElement('div');
      modal.id = 'tfZenDaktiloModal';
      modal.className = 'tf-zen-daktilo-katman';
      modal.innerHTML = [
        '<div class="tf-zen-govde">',
        '  <header class="tf-zen-ust">',
        '    <div class="tf-zen-sol">',
        '      <span class="tf-zen-rozet">⌨️ ZEN DAKTİLO (APK ÖZEL)</span>',
        '      <span class="tf-zen-sayac" id="tfZenSayac">0 kelime · 0 karakter</span>',
        '    </div>',
        '    <div class="tf-zen-sag">',
        '      <button type="button" class="dugme dugme-sade" id="tfZenSenkBtn" title="Klasöre Eşitle">💾 Senk</button>',
        '      <button type="button" class="dugme dugme-sade" id="tfZenTemizle">Temizle</button>',
        '      <button type="button" class="pencere-kapat" id="tfZenKapat" aria-label="Kapat">✕</button>',
        '    </div>',
        '  </header>',
        '  <main class="tf-zen-alan">',
        '    <textarea id="tfZenMetin" class="tf-zen-textarea" placeholder="Zihnindeki evreni yazmaya başla... (Her tuşta mekanik tıkırtı ve haptik titreşim aktiftir)" spellcheck="false" autofocus>' + kacir(taslak) + '</textarea>',
        '  </main>',
        '  <footer class="tf-zen-alt">',
        '    <small id="tfZenDurum">Cihaza anlık kaydediliyor...</small>',
        '    <small>ESC ile çıkabilirsin</small>',
        '  </footer>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);
      document.documentElement.classList.add('zen-acik');

      var textarea = modal.querySelector('#tfZenMetin');
      var sayac = modal.querySelector('#tfZenSayac');
      var durum = modal.querySelector('#tfZenDurum');

      function guncelleSayac() {
        var v = textarea.value;
        var kelime = (v.match(/\S+/g) || []).length;
        sayac.textContent = kelime + ' kelime · ' + v.length + ' karakter';
        try {
          localStorage.setItem('tentifor_zen_taslak', v);
          durum.textContent = 'Kaydedildi (' + new Date().toLocaleTimeString('tr-TR') + ')';
        } catch (_) {}
      }
      guncelleSayac();

      textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          TentiforZenDaktilo.calDaktiloSesi('zil');
          TentiforZenDaktilo.haptikTitre();
        } else if (e.key === ' ') {
          TentiforZenDaktilo.calDaktiloSesi('bosluk');
          TentiforZenDaktilo.haptikTitre();
        } else if (e.key.length === 1) {
          TentiforZenDaktilo.calDaktiloSesi('tus');
          TentiforZenDaktilo.haptikTitre();
        }
      });

      textarea.addEventListener('input', guncelleSayac);

      modal.querySelector('#tfZenKapat').addEventListener('click', function () {
        modal.remove();
        document.documentElement.classList.remove('zen-acik');
      });

      modal.querySelector('#tfZenTemizle').addEventListener('click', function () {
        if (confirm('Taslağı silmek istediğinden emin misin?')) {
          textarea.value = '';
          guncelleSayac();
        }
      });

      modal.querySelector('#tfZenSenkBtn').addEventListener('click', function () {
        TentiforYerelKlasorSenk.senkronizeEt();
      });

      modal.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          modal.remove();
          document.documentElement.classList.remove('zen-acik');
        }
      });
    }
  };

  /* =========================================================================
     5. [4] EVREN VE TASLAK KARŞILAŞTIRMA (DIFF) ARACI (APK'ye Özel — Web'de Kilitli)
     ========================================================================= */
  var TentiforKarsilastirmaDiff = {
    ac: function () {
      if (!isApk()) {
        gosterWebKilitliModal(
          'Evren ve Taslak Karşılaştırma Aracı (Diff)',
          'İki evren sürümünü, taslağı veya bölümü yan yana satır satır karşılaştıran görsel fark analiz motoru yalnızca Tentifor APK\'de çalışır. Web sürümünden erişilemez.'
        );
        return;
      }

      var modal = document.createElement('div');
      modal.id = 'tfDiffModal';
      modal.className = 'tf-zen-daktilo-katman';
      modal.innerHTML = [
        '<div class="tf-zen-govde" style="max-width: 960px;">',
        '  <header class="tf-zen-ust">',
        '    <div class="tf-zen-sol">',
        '      <span class="tf-zen-rozet">⚖️ EVREN & TASLAK DIFF (APK ÖZEL)</span>',
        '    </div>',
        '    <div class="tf-zen-sag">',
        '      <button type="button" class="dugme" id="tfDiffKarsilastirBtn">Farkları Bul</button>',
        '      <button type="button" class="pencere-kapat" id="tfDiffKapat" aria-label="Kapat">✕</button>',
        '    </div>',
        '  </header>',
        '  <main style="padding: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex: 1; overflow-y: auto;">',
        '    <div>',
        '      <b>1. Metin (Orijinal / Önceki Sürüm)</b>',
        '      <textarea id="tfDiffA" class="kod-giris" style="width: 100%; height: 180px; margin-top: 6px; box-sizing: border-box; font-family: var(--mono); font-size: 13px;" placeholder="İlk metni yapıştır veya yaz...">Tömye göğünde ay yoktur.\nYıl 310 gündür; dokuz ay 28, ikisi 29 gün çeker.\nE25 kapısı kilitlidir.</textarea>',
        '    </div>',
        '    <div>',
        '      <b>2. Metin (Yeni / Revize Sürüm)</b>',
        '      <textarea id="tfDiffB" class="kod-giris" style="width: 100%; height: 180px; margin-top: 6px; box-sizing: border-box; font-family: var(--mono); font-size: 13px;" placeholder="İkinci metni yapıştır...">Tömye göğünde ay yoktur.\nYıl 310 gündür; dokuz ay 28, ikisi 29 gün çeker.\nE25 kapısı oyunla açılır.\nYeni bir yıldız doğmuştur.</textarea>',
        '    </div>',
        '    <div id="tfDiffSonuc" style="grid-column: 1 / -1; margin-top: 10px; background: var(--kar); padding: 14px; border-radius: 6px; border: 1px solid var(--sig); font-family: var(--mono); font-size: 13.5px; line-height: 1.6; max-height: 300px; overflow-y: auto;">',
        '      <small class="oyun-not">Karşılaştır butonuna dokunarak satır satır farkları görüntüle.</small>',
        '    </div>',
        '  </main>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);

      function farkHesapla() {
        var linesA = (document.getElementById('tfDiffA').value || '').split('\n');
        var linesB = (document.getElementById('tfDiffB').value || '').split('\n');
        var out = [];

        var max = Math.max(linesA.length, linesB.length);
        var eklenen = 0, silinen = 0, ayni = 0;

        for (var i = 0; i < max; i++) {
          var a = linesA[i];
          var b = linesB[i];
          if (a === b) {
            out.push('<div style="color: var(--murekkep); padding: 2px 4px;">  ' + kacir(a || '') + '</div>');
            ayni++;
          } else {
            if (typeof a !== 'undefined') {
              out.push('<div style="background: rgba(220,53,69,0.15); color: #c82333; padding: 2px 4px; font-weight: bold;">- ' + kacir(a) + '</div>');
              silinen++;
            }
            if (typeof b !== 'undefined') {
              out.push('<div style="background: rgba(40,167,69,0.15); color: #218838; padding: 2px 4px; font-weight: bold;">+ ' + kacir(b) + '</div>');
              eklenen++;
            }
          }
        }

        var ozet = '<div style="margin-bottom: 8px; font-weight: bold;">Özet: +' + eklenen + ' satır eklendi, -' + silinen + ' satır değişti/silindi, ' + ayni + ' satır ortak.</div>';
        document.getElementById('tfDiffSonuc').innerHTML = ozet + out.join('');
      }

      document.getElementById('tfDiffKarsilastirBtn').addEventListener('click', farkHesapla);
      document.getElementById('tfDiffKapat').addEventListener('click', function () { modal.remove(); });
    }
  };

  /* =========================================================================
     6. [5] BİYONİK & HIZLI OKUMA LABORATUVARI (RSVP & Bionic Focus — APK'ye Özel)
     ========================================================================= */
  var TentiforHizliOkumaLab = {
    timer: null,
    wpm: 350,
    index: 0,
    words: [],

    ac: function () {
      if (!isApk()) {
        gosterWebKilitliModal(
          'Biyonik & Hızlı Okuma Laboratuvarı',
          'RSVP (Rapid Serial Visual Presentation) tek kelime akış motoru ve Biyonik Okuma odaklayıcı yalnızca Tentifor APK\'de çalışır. Web sürümünden erişilemez.'
        );
        return;
      }

      var ornekMetin = 'Tömye\'nin gökyüzünde ay yoktur ama ayları yirmi sekiz gün çeker. Zamansız yolculukların başladığı bu sessiz koridorlarda her harf bir geçidi aralar. Hızlı okuma laboratuvarı göz hareketlerini minimuma indirerek zihinsel odağı en üst seviyeye taşır.';

      var modal = document.createElement('div');
      modal.id = 'tfHizliOkumaModal';
      modal.className = 'tf-zen-daktilo-katman';
      modal.innerHTML = [
        '<div class="tf-zen-govde" style="max-width: 680px;">',
        '  <header class="tf-zen-ust">',
        '    <div class="tf-zen-sol">',
        '      <span class="tf-zen-rozet">⚡ HIZLI OKUMA LAB (APK ÖZEL)</span>',
        '    </div>',
        '    <div class="tf-zen-sag">',
        '      <button type="button" class="pencere-kapat" id="tfHoKapat" aria-label="Kapat">✕</button>',
        '    </div>',
        '  </header>',
        '  <main style="padding: 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px;">',
        '    <!-- RSVP Odak Kutusu -->',
        '    <div style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; background: var(--kar); border: 2px solid var(--deniz); border-radius: 8px; position: relative;">',
        '      <div style="position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: rgba(28,92,150,0.2); pointer-events: none;"></div>',
        '      <div id="tfRsvpKelime" style="font-family: var(--display); font-size: 42px; font-weight: bold; letter-spacing: 0.05em; color: var(--murekkep);">BAŞLAT</div>',
        '    </div>',
        '    <!-- Kontroller -->',
        '    <div style="display: flex; gap: 12px; align-items: center;">',
        '      <button type="button" class="dugme" id="tfHoOynat">▶ Başlat</button>',
        '      <button type="button" class="dugme dugme-sade" id="tfHoSifirla">Başa Al</button>',
        '      <label style="font-size: 13.5px; display: flex; align-items: center; gap: 6px;">',
        '        <b>Hız:</b>',
        '        <select id="tfHoWpm" class="kod-giris" style="padding: 4px 8px; font-size: 14px;">',
        '          <option value="250">250 WPM (Rahat)</option>',
        '          <option value="350" selected>350 WPM (Standart)</option>',
        '          <option value="500">500 WPM (Hızlı)</option>',
        '          <option value="700">700 WPM (Ekstrem)</option>',
        '        </select>',
        '      </label>',
        '    </div>',
        '    <!-- Biyonik Okuma Önizlemesi -->',
        '    <div style="width: 100%; text-align: left; background: var(--beyaz); border: 1px solid var(--buz); border-radius: 6px; padding: 14px;">',
        '      <b style="font-size: 13px; color: var(--deniz);">Biyonik Harf Vurgulama Önizlemesi:</b>',
        '      <div id="tfBiyonikOnizleme" style="margin-top: 8px; font-size: 16px; line-height: 1.7; color: var(--murekkep);"></div>',
        '    </div>',
        '  </main>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);

      var kelimeEl = document.getElementById('tfRsvpKelime');
      var oynatBtn = document.getElementById('tfHoOynat');
      var wpmSelect = document.getElementById('tfHoWpm');
      var biyonikEl = document.getElementById('tfBiyonikOnizleme');

      // Biyonik formata çevir (ilk %45 harfleri kalınlaştır)
      function biyonikYap(metin) {
        return metin.split(' ').map(function (w) {
          if (!w) return '';
          var orta = Math.ceil(w.length * 0.45);
          return '<b>' + kacir(w.slice(0, orta)) + '</b>' + kacir(w.slice(orta));
        }).join(' ');
      }
      biyonikEl.innerHTML = biyonikYap(ornekMetin);

      this.words = ornekMetin.split(/\s+/).filter(Boolean);
      this.index = 0;
      var self = this;

      function durdur() {
        if (self.timer) {
          clearInterval(self.timer);
          self.timer = null;
        }
        oynatBtn.textContent = '▶ Başlat';
      }

      function adim() {
        if (self.index >= self.words.length) {
          durdur();
          kelimeEl.textContent = 'TAMAMLANDI ✓';
          return;
        }
        var w = self.words[self.index];
        kelimeEl.textContent = w;
        self.index++;
      }

      oynatBtn.addEventListener('click', function () {
        if (self.timer) {
          durdur();
        } else {
          var ms = Math.round(60000 / self.wpm);
          self.timer = setInterval(adim, ms);
          oynatBtn.textContent = '⏸ Durdur';
        }
      });

      wpmSelect.addEventListener('change', function () {
        self.wpm = parseInt(this.value, 10) || 350;
        if (self.timer) {
          durdur();
          var ms = Math.round(60000 / self.wpm);
          self.timer = setInterval(adim, ms);
          oynatBtn.textContent = '⏸ Durdur';
        }
      });

      document.getElementById('tfHoSifirla').addEventListener('click', function () {
        durdur();
        self.index = 0;
        kelimeEl.textContent = self.words[0] || 'HAZIR';
      });

      document.getElementById('tfHoKapat').addEventListener('click', function () {
        durdur();
        modal.remove();
      });
    }
  };

  /* =========================================================================
     7. GLOBAL OLAYLAR VE KISAYOLLAR
     ========================================================================= */
  // Mobil menüye ve butonlara tıklama yöneticisi
  document.addEventListener('click', function (e) {
    var kapat = e.target.closest('[data-apk-kapat], [data-apk-modal-kapat]');
    if (kapat) {
      var perde = document.getElementById('perde');
      if (perde) perde.hidden = true;
      var zenModal = document.getElementById('tfZenDaktiloModal');
      if (zenModal) zenModal.remove();
      var diffModal = document.getElementById('tfDiffModal');
      if (diffModal) diffModal.remove();
      var hoModal = document.getElementById('tfHizliOkumaModal');
      if (hoModal) hoModal.remove();
      return;
    }

    var tetik = e.target.closest('[data-tf-apk-arac]');
    if (tetik) {
      e.preventDefault();
      var arac = tetik.getAttribute('data-tf-apk-arac');
      if (arac === 'daktilo') TentiforZenDaktilo.ac();
      else if (arac === 'diff') TentiforKarsilastirmaDiff.ac();
      else if (arac === 'hizli-okuma') TentiforHizliOkumaLab.ac();
      else if (arac === 'yerel-senk') TentiforYerelKlasorSenk.senkronizeEt();
      else if (arac === 'hatirlatici') TentiforApkHatirlatici.panelAc();
    }
  });

  // LocalNotification Action dinleyicisi
  if (typeof window.kabukEklenti === 'function') {
    var _ln = window.kabukEklenti('LocalNotifications');
    if (_ln && _ln.addListener) {
      _ln.addListener('localNotificationActionPerformed', function (ev) {
        TentiforApkHatirlatici.eylemYonet(ev);
      });
    }
  }

  // Yeniden boyutlandırma ve bölünmüş ekran takibi
  window.addEventListener('resize', function () {
    TentiforBolunmusEkran.denetle();
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { TentiforBolunmusEkran.denetle(); }, 300);
  });

  // Başlangıç kurulumu
  document.addEventListener('DOMContentLoaded', function () {
    TentiforBolunmusEkran.denetle();
    if (isApk()) {
      TentiforApkHatirlatici.zamanla();
    }
  });

  // Dışa aktar
  window.TentiforApkHatirlatici = TentiforApkHatirlatici;
  window.TentiforBolunmusEkran = TentiforBolunmusEkran;
  window.TentiforYerelKlasorSenk = TentiforYerelKlasorSenk;
  window.TentiforZenDaktilo = TentiforZenDaktilo;
  window.TentiforKarsilastirmaDiff = TentiforKarsilastirmaDiff;
  window.TentiforHizliOkumaLab = TentiforHizliOkumaLab;

}());
