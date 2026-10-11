/* TentiFor — Mobil Ambiyans, Üretim & Paylaşım, Günlük Alışkanlık ve Hızlı Erişim Motoru */
(function () {
  'use strict';

  /* =========================================================================
     1. AMBİYANS SENTEZLEYİCİ (Atmospheric Procedural Web Audio Engine)
     100% Çevrimdışı, sıfır harici dosya indirme, Android APK & PWA uyumlu.
     ========================================================================= */
  var audioCtx = null;
  var ambientGain = null;
  var ambientNodes = [];
  var currentType = 'kapali'; // 'kapali', 'kozmik', 'buzul', 'yagmur', 'odak'
  var targetVolume = 0.22;
  var isReadingLinked = false;

  var AMBIENCE_TYPES = [
    { id: 'kapali', ad: 'Kapalı', ikon: '✕' },
    { id: 'kozmik', ad: 'Kozmik', ikon: '🌌' },
    { id: 'buzul', ad: 'Buzul', ikon: '❄️' },
    { id: 'yagmur', ad: 'Yağmur', ikon: '🌧️' },
    { id: 'odak', ad: 'Odak', ikon: '🎧' }
  ];

  function getAudioContext() {
    if (!audioCtx) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function clearNodes() {
    ambientNodes.forEach(function (node) {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch (_) {}
    });
    ambientNodes = [];
  }

  function createNoiseBuffer(ctx, seconds, type) {
    var bufferSize = ctx.sampleRate * (seconds || 4);
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var output = buffer.getChannelData(0);
    var lastOut = 0.0;
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (var i = 0; i < bufferSize; i++) {
      var white = Math.random() * 2 - 1;
      if (type === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else if (type === 'brown') {
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        output[i] = lastOut * 3.5;
      } else {
        output[i] = white * 0.18;
      }
    }
    return buffer;
  }

  function buildCosmic(ctx, master) {
    // 48Hz root + 72Hz fifth harmonic drone with gentle LFO drift
    var osc1 = ctx.createOscillator();
    var osc2 = ctx.createOscillator();
    var sub = ctx.createOscillator();
    var lfo = ctx.createOscillator();
    var lfoGain = ctx.createGain();
    var filter = ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(54.0, ctx.currentTime);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(81.0, ctx.currentTime);

    sub.type = 'sine';
    sub.frequency.setValueAtTime(27.0, ctx.currentTime);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
    lfoGain.gain.setValueAtTime(2.2, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, ctx.currentTime);
    filter.Q.setValueAtTime(1.8, ctx.currentTime);

    var mixer = ctx.createGain();
    mixer.gain.setValueAtTime(0.35, ctx.currentTime);

    osc1.connect(filter);
    osc2.connect(filter);
    sub.connect(filter);
    filter.connect(mixer);
    mixer.connect(master);

    osc1.start();
    osc2.start();
    sub.start();
    lfo.start();

    ambientNodes.push(osc1, osc2, sub, lfo, lfoGain, filter, mixer);
  }

  function buildGlacial(ctx, master) {
    // Filtered resonant wind noise with slow frequency sweep
    var buffer = createNoiseBuffer(ctx, 4, 'pink');
    var noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, ctx.currentTime);
    filter.Q.setValueAtTime(3.2, ctx.currentTime);

    var lfo = ctx.createOscillator();
    var lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.18, ctx.currentTime);
    lfoGain.gain.setValueAtTime(160, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noise.connect(filter);
    filter.connect(master);

    noise.start();
    lfo.start();
    ambientNodes.push(noise, filter, lfo, lfoGain);
  }

  function buildRain(ctx, master) {
    // Filtered pink noise with soft lowpass
    var buffer = createNoiseBuffer(ctx, 5, 'pink');
    var noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(880, ctx.currentTime);
    filter.Q.setValueAtTime(0.8, ctx.currentTime);

    noise.connect(filter);
    filter.connect(master);

    noise.start();
    ambientNodes.push(noise, filter);
  }

  function buildFocus(ctx, master) {
    // Warm brown noise for mental focus
    var buffer = createNoiseBuffer(ctx, 4, 'brown');
    var noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, ctx.currentTime);

    noise.connect(filter);
    filter.connect(master);

    noise.start();
    ambientNodes.push(noise, filter);
  }

  var TentiforAmbiyans = {
    turler: AMBIENCE_TYPES,
    aktifTur: function () { return currentType; },
    aktifMi: function () { return currentType !== 'kapali'; },
    
    etiket: function () {
      var item = AMBIENCE_TYPES.find(function (x) { return x.id === currentType; });
      return item ? item.ikon + ' ' + item.ad : 'Ambiyans';
    },

    degistir: function () {
      var idx = AMBIENCE_TYPES.findIndex(function (x) { return x.id === currentType; });
      var next = AMBIENCE_TYPES[(idx + 1) % AMBIENCE_TYPES.length];
      this.baslat(next.id);
      try {
        var s = JSON.parse(localStorage.getItem('tf28_ses') || '{}');
        s.ambiyans = next.id;
        localStorage.setItem('tf28_ses', JSON.stringify(s));
      } catch (_) {}
      return next.id;
    },

    baslat: function (tur, linkReading) {
      if (tur) currentType = tur;
      if (linkReading !== undefined) isReadingLinked = !!linkReading;

      if (currentType === 'kapali') {
        this.durdur();
        return;
      }

      var ctx = getAudioContext();
      if (!ctx) return;

      if (!ambientGain) {
        ambientGain = ctx.createGain();
        ambientGain.gain.setValueAtTime(0.001, ctx.currentTime);
        ambientGain.connect(ctx.destination);
      }

      clearNodes();

      if (currentType === 'kozmik') buildCosmic(ctx, ambientGain);
      else if (currentType === 'buzul') buildGlacial(ctx, ambientGain);
      else if (currentType === 'yagmur') buildRain(ctx, ambientGain);
      else if (currentType === 'odak') buildFocus(ctx, ambientGain);

      // Smooth fade-in
      ambientGain.gain.cancelScheduledValues(ctx.currentTime);
      ambientGain.gain.setValueAtTime(Math.max(0.001, ambientGain.gain.value), ctx.currentTime);
      ambientGain.gain.linearRampToValueAtTime(targetVolume, ctx.currentTime + 1.2);

      this.guncelleArayuz();
    },

    durdur: function () {
      if (audioCtx && ambientGain) {
        ambientGain.gain.cancelScheduledValues(audioCtx.currentTime);
        ambientGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);
        setTimeout(function () {
          clearNodes();
        }, 650);
      } else {
        clearNodes();
      }
      this.guncelleArayuz();
    },

    duraklat: function () {
      if (audioCtx && ambientGain) {
        ambientGain.gain.cancelScheduledValues(audioCtx.currentTime);
        ambientGain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 0.4);
      }
    },

    surdur: function () {
      if (currentType !== 'kapali' && audioCtx && ambientGain) {
        ambientGain.gain.cancelScheduledValues(audioCtx.currentTime);
        ambientGain.gain.linearRampToValueAtTime(targetVolume, audioCtx.currentTime + 0.6);
      }
    },

    // SES motoru kancaları
    sesBasladi: function () {
      var s = {};
      try { s = JSON.parse(localStorage.getItem('tf28_ses') || '{}'); } catch (_) {}
      var secili = s.ambiyans || 'kozmik';
      if (secili !== 'kapali') {
        this.baslat(secili, true);
      }
    },

    sesCalindi: function () {
      this.surdur();
    },

    sesDuraklatildi: function (duraklat) {
      if (duraklat) this.duraklat();
      else this.surdur();
    },

    sesDurdu: function () {
      if (isReadingLinked) {
        this.durdur();
      }
    },

    guncelleArayuz: function () {
      var btn = document.querySelector('[data-dinle="ambiyans"]');
      if (btn) {
        btn.textContent = this.etiket();
        btn.setAttribute('aria-label', 'Ambiyans: ' + this.etiket());
      }
      var miniBtn = document.querySelector('[data-hizli-ambiyans]');
      if (miniBtn) {
        miniBtn.textContent = this.aktifMi() ? this.etiket() : '🎧 Ambiyans';
        miniBtn.classList.toggle('aktif', this.aktifMi());
      }
    }
  };

  window.TentiforAmbiyans = TentiforAmbiyans;


  /* =========================================================================
     2. MOBİL ÜRETİM VE PAYLAŞIM (Mobile Creation & Seamless Sharing)
     ========================================================================= */
  var TentiforMobilUretim = {
    // Dışarıdan Android "Paylaş" ile gelen metni yakalar
    gelenPaylasimYakala: function (detail) {
      if (!detail) return;
      var text = (detail.text || detail.uri || '').trim();
      var title = (detail.title || 'Telefondan Paylaşılan Taslak').trim();
      if (!text) return;

      var yayinlanan = {
        id: 'mobil_' + Date.now().toString(36),
        tur: 'hikaye',
        ad: title.slice(0, 80),
        metin: text,
        tarih: new Date().toISOString(),
        kaynak: 'android-paylasim'
      };

      try {
        var mevcut = [];
        try { mevcut = JSON.parse(localStorage.getItem('tentiforapp_fan_eserlerim') || '[]'); } catch (_) {}
        if (!Array.isArray(mevcut)) mevcut = [];
        mevcut.unshift(yayinlanan);
        localStorage.setItem('tentiforapp_fan_eserlerim', JSON.stringify(mevcut.slice(0, 50)));

        if (typeof window.eckaBildir === 'function') {
          window.eckaBildir('📱 Paylaşılan metin taslaklarına kaydedildi!');
        }

        // Kullanıcıyı atölye veya fan sayfasına yönlendir
        if (location.hash !== '#/fan') {
          location.hash = '#/fan';
        } else if (typeof window.fanCiz === 'function') {
          window.fanCiz('hikaye');
        }
      } catch (err) {
        console.warn('Gelen paylaşım kaydedilemedi:', err);
      }
    },

    // Mobil metin alanlarına hızlı yazım şeridi bağlar
    yazToolbarBagla: function () {
      var textareas = document.querySelectorAll('textarea');
      textareas.forEach(function (ta) {
        if (ta.hasAttribute('data-tf-toolbar-hazir')) return;
        ta.setAttribute('data-tf-toolbar-hazir', '1');

        ta.addEventListener('focus', function () {
          TentiforMobilUretim.toolbarGoster(ta);
        });
      });
    },

    toolbarGoster: function (targetTa) {
      var bar = document.getElementById('tfMobilYazBar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'tfMobilYazBar';
        bar.className = 'tf-mobil-yaz-bar';
        bar.innerHTML = [
          '<button type="button" data-yaz-ekle="— " title="Diyalog Çizgisi">—</button>',
          '<button type="button" data-yaz-ekle="\n\n***\n\n" title="Sahne Ayracı">***</button>',
          '<button type="button" data-yaz-ekle="«»" title="Alıntı">«»</button>',
          '<button type="button" data-yaz-ekle="**kalın**" title="Kalın">B</button>',
          '<button type="button" data-yaz-ekle="*italik*" title="İtalik"><i>I</i></button>',
          '<button type="button" data-yaz-ekle="[1: Dipnot]" title="Dipnot">[1]</button>',
          '<span class="tf-yaz-sayac" id="tfYazSayac">0 kelime</span>',
          '<button type="button" data-yaz-kapat class="tf-yaz-kapat" title="Kapat">✕</button>'
        ].join('');
        document.body.appendChild(bar);

        bar.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-yaz-ekle]');
          if (btn && TentiforMobilUretim._aktifTa) {
            e.preventDefault();
            TentiforMobilUretim.metinEkle(TentiforMobilUretim._aktifTa, btn.getAttribute('data-yaz-ekle'));
            return;
          }
          if (e.target.closest('[data-yaz-kapat]')) {
            e.preventDefault();
            bar.classList.remove('aktif');
          }
        });
      }

      this._aktifTa = targetTa;
      this.sayacGuncelle(targetTa);
      bar.classList.add('aktif');

      targetTa.addEventListener('input', function () {
        TentiforMobilUretim.sayacGuncelle(targetTa);
      }, { once: false });
    },

    metinEkle: function (ta, snippet) {
      if (!ta) return;
      var start = ta.selectionStart || 0;
      var end = ta.selectionEnd || 0;
      var val = ta.value;

      var replacement = snippet;
      var newCursor = start + snippet.length;

      // Özel parantez içi imleç konumlandırması
      if (snippet === '«»') {
        replacement = '«»';
        newCursor = start + 1;
      } else if (snippet === '**kalın**') {
        replacement = '**' + (val.slice(start, end) || 'kalın') + '**';
        newCursor = start + replacement.length - 2;
      } else if (snippet === '*italik*') {
        replacement = '*' + (val.slice(start, end) || 'italik') + '*';
        newCursor = start + replacement.length - 1;
      }

      ta.value = val.slice(0, start) + replacement + val.slice(end);
      ta.focus();
      try {
        ta.setSelectionRange(newCursor, newCursor);
      } catch (_) {}

      // Input olayını tetikle ki varsa oto-kayıt çalışsın
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      this.sayacGuncelle(ta);
    },

    sayacGuncelle: function (ta) {
      var sayac = document.getElementById('tfYazSayac');
      if (!sayac || !ta) return;
      var text = (ta.value || '').trim();
      var words = text ? text.split(/\s+/).length : 0;
      sayac.textContent = words + ' kelime';
    },

    // Yerel Android veya PWA üzerinden güvenli paylaşım
    guvenliPaylas: async function (bilgi) {
      bilgi = bilgi || {};
      var baslik = bilgi.baslik || 'TentiFor';
      var metin = bilgi.metin || '';
      var url = bilgi.url || location.href;

      // 1. Android Capacitor Native Köprüsü
      if (window.TentiforKopru && window.TentiforKopru.paylas) {
        try {
          await window.TentiforKopru.paylas({ title: baslik, text: metin, url: url });
          return true;
        } catch (_) {}
      }

      // 2. Web Share API
      if (navigator.share) {
        try {
          await navigator.share({ title: baslik, text: metin, url: url });
          return true;
        } catch (e) {
          if (e && e.name === 'AbortError') return false;
        }
      }

      // 3. Panoya kopyalama fallback'i
      try {
        var copyText = metin ? (metin + '\n\n' + url) : url;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(copyText);
          if (typeof window.eckaBildir === 'function') window.eckaBildir('Bağlantı panoya kopyalandı.');
          return true;
        }
      } catch (_) {}

      window.prompt('Paylaşım bağlantısı:', url);
      return true;
    }
  };

  window.TentiforMobilUretim = TentiforMobilUretim;


  /* =========================================================================
     3. GÜNLÜK ALIŞKANLIK & HIZLI ERİŞİM (Daily Habits & Quick Access Dock)
     ========================================================================= */
  var TentiforGunlukVeHizli = {
    hedefDakika: function () {
      try {
        return Number(JSON.parse(localStorage.getItem('tf28_hedef') || '0')) || 10;
      } catch (_) {
        return 10;
      }
    },

    bugunOkumaDakika: function () {
      try {
        var bugun = new Date().toISOString().slice(0, 10);
        var kayit = JSON.parse(localStorage.getItem('tf28_okuma') || '{}');
        return Math.floor((kayit[bugun] || 0) / 60);
      } catch (_) {
        return 0;
      }
    },

    seriGunSayisi: function () {
      if (typeof window.seriDurumu === 'function') {
        var s = window.seriDurumu();
        return s && s.seri ? s.seri : 0;
      }
      return 0;
    },

    sonOkunanYer: function () {
      try {
        var resume = JSON.parse(localStorage.getItem('tentiforapp_v50_devam') || 'null');
        if (resume && resume.url) return resume;
      } catch (_) {}
      return null;
    },

    dockCiz: function () {
      if (document.getElementById('tfHizliDock')) return;
      var dock = document.createElement('div');
      dock.id = 'tfHizliDock';
      dock.className = 'tf-hizli-dock';
      dock.setAttribute('role', 'region');
      dock.setAttribute('aria-label', 'Hızlı Erişim Çekmecesi');

      var resume = this.sonOkunanYer();
      var okunanDk = this.bugunOkumaDakika();
      var hedefDk = this.hedefDakika();
      var seri = this.seriGunSayisi();

      dock.innerHTML = [
        '<div class="tf-dock-icerik" id="tfDockIcerik" hidden>',
        '  <div class="tf-dock-baslik">',
        '    <span>⚡ Hızlı Erişim</span>',
        '    <button type="button" class="tf-dock-kapat" data-dock-kapat aria-label="Kapat">✕</button>',
        '  </div>',
        '  <div class="tf-dock-grid">',
        '    <button type="button" class="tf-dock-kart" data-hizli-devam>',
        '      <span class="tf-dock-ikon">📖</span>',
        '      <b>Kaldığın Yer</b>',
        '      <small>' + (resume ? kacir(resume.title || 'Devam et') : 'Okumayı aç') + '</small>',
        '    </button>',
        '    <button type="button" class="tf-dock-kart" data-hizli-ambiyans>',
        '      <span class="tf-dock-ikon">🎧</span>',
        '      <b>Ambiyans</b>',
        '      <small>' + TentiforAmbiyans.etiket() + '</small>',
        '    </button>',
        '    <button type="button" class="tf-dock-kart" data-hizli-taslak>',
        '      <span class="tf-dock-ikon">✍️</span>',
        '      <b>Hızlı Taslak</b>',
        '      <small>Yeni fikir veya not</small>',
        '    </button>',
        '    <button type="button" class="tf-dock-kart" data-hizli-seri>',
        '      <span class="tf-dock-ikon">🔥</span>',
        '      <b>' + (seri > 0 ? seri + ' Günlük Seri' : 'Alışkanlık') + '</b>',
        '      <small>' + okunanDk + '/' + hedefDk + ' dk okundu' + (okunanDk >= hedefDk ? ' ✓' : '') + '</small>',
        '    </button>',
        '  </div>',
        '</div>',
        '<button type="button" class="tf-dock-tetik" id="tfDockTetik" aria-expanded="false" title="Hızlı Erişim">',
        '  <span class="tf-dock-tetik-ikon">⚡</span>',
        '  <span class="tf-dock-tetik-yazi">Hızlı Erişim</span>',
        '</button>'
      ].join('');

      document.body.appendChild(dock);

      // Dock Olayları
      var tetik = dock.querySelector('#tfDockTetik');
      var icerik = dock.querySelector('#tfDockIcerik');

      function dockAcKapa() {
        var acik = !icerik.hidden;
        icerik.hidden = acik;
        tetik.setAttribute('aria-expanded', String(!acik));
        dock.classList.toggle('acik', !acik);
        if (!acik) {
          TentiforGunlukVeHizli.dockGuncelle();
        }
      }

      tetik.addEventListener('click', dockAcKapa);
      dock.querySelector('[data-dock-kapat]').addEventListener('click', function () {
        icerik.hidden = true;
        tetik.setAttribute('aria-expanded', 'false');
        dock.classList.remove('acik');
      });

      dock.addEventListener('click', function (e) {
        var t = e.target.closest('[data-hizli-devam], [data-hizli-ambiyans], [data-hizli-taslak], [data-hizli-seri]');
        if (!t) return;

        if (t.hasAttribute('data-hizli-devam')) {
          var r = TentiforGunlukVeHizli.sonOkunanYer();
          if (r && r.url) {
            location.hash = r.url.replace(/^.*#/, '#');
          } else {
            location.hash = '#/okuma';
          }
          dockAcKapa();
        } else if (t.hasAttribute('data-hizli-ambiyans')) {
          var yeni = TentiforAmbiyans.degistir();
          t.querySelector('small').textContent = TentiforAmbiyans.etiket();
          if (typeof window.eckaBildir === 'function') {
            window.eckaBildir('Ambiyans: ' + TentiforAmbiyans.etiket());
          }
        } else if (t.hasAttribute('data-hizli-taslak')) {
          location.hash = '#/fan';
          dockAcKapa();
          setTimeout(function () {
            if (typeof window.fanYeni === 'function') window.fanYeni('hikaye');
          }, 300);
        } else if (t.hasAttribute('data-hizli-seri')) {
          location.hash = '#/sen';
          dockAcKapa();
        }
      });
    },

    dockGuncelle: function () {
      var dock = document.getElementById('tfHizliDock');
      if (!dock) return;
      var resume = this.sonOkunanYer();
      var okunanDk = this.bugunOkumaDakika();
      var hedefDk = this.hedefDakika();
      var seri = this.seriGunSayisi();

      var devamSmall = dock.querySelector('[data-hizli-devam] small');
      if (devamSmall) devamSmall.textContent = resume ? (resume.title || 'Devam et') : 'Okumayı aç';

      var ambSmall = dock.querySelector('[data-hizli-ambiyans] small');
      if (ambSmall) ambSmall.textContent = TentiforAmbiyans.etiket();

      var seriB = dock.querySelector('[data-hizli-seri] b');
      if (seriB) seriB.textContent = seri > 0 ? seri + ' Günlük Seri' : 'Alışkanlık';

      var seriSmall = dock.querySelector('[data-hizli-seri] small');
      if (seriSmall) seriSmall.textContent = okunanDk + '/' + hedefDk + ' dk okundu' + (okunanDk >= hedefDk ? ' ✓' : '');
    }
  };

  window.TentiforGunlukVeHizli = TentiforGunlukVeHizli;


  /* =========================================================================
     4. GENEL SİSTEM ENTEGRASYONLARI & OLAY DİNLEYİCİLERİ
     ========================================================================= */

  // Android Native Paylaşım Olayını Yakala
  window.addEventListener('tentifor-native-share', function (e) {
    if (e && e.detail) {
      TentiforMobilUretim.gelenPaylasimYakala(e.detail);
    }
  });

  // URL üzerinden gelen paylaşımlar (?paylas_metin=...)
  try {
    var params = new URLSearchParams(location.search);
    var sharedText = params.get('paylas_metin') || params.get('text');
    var sharedTitle = params.get('paylas_baslik') || params.get('title');
    if (sharedText) {
      TentiforMobilUretim.gelenPaylasimYakala({ text: sharedText, title: sharedTitle });
    }
  } catch (_) {}

  // Okuma Çubuğunu Ambiyans butonuyla dekore et
  function sesCubugunuGuncelle() {
    var cubuk = document.getElementById('sesCubuk');
    if (!cubuk) return;
    var dugmeler = cubuk.querySelector('.ses-dugmeler');
    if (dugmeler && !dugmeler.querySelector('[data-dinle="ambiyans"]')) {
      var ambBtn = document.createElement('button');
      ambBtn.type = 'button';
      ambBtn.setAttribute('data-dinle', 'ambiyans');
      ambBtn.setAttribute('aria-label', 'Ambiyans değiştir');
      ambBtn.className = 'ses-ambiyans-btn';
      ambBtn.textContent = TentiforAmbiyans.etiket();
      
      // Hız butonunun soluna yerleştir
      var hizBtn = dugmeler.querySelector('[data-dinle="hiz"]');
      if (hizBtn) dugmeler.insertBefore(ambBtn, hizBtn);
      else dugmeler.appendChild(ambBtn);
    }
  }

  // Tıklama olaylarını genişlet
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-dinle="ambiyans"]');
    if (t) {
      e.preventDefault();
      TentiforAmbiyans.degistir();
      sesCubugunuGuncelle();
    }
  });

  // DOM değişikliklerini izleyip araçları bağla
  var domTimer = null;
  var observer = new MutationObserver(function () {
    if (domTimer) return;
    domTimer = setTimeout(function () {
      domTimer = null;
      sesCubugunuGuncelle();
      TentiforMobilUretim.yazToolbarBagla();
    }, 250);
  });

  document.addEventListener('DOMContentLoaded', function () {
    observer.observe(document.body, { childList: true, subtree: true });
    TentiforGunlukVeHizli.dockCiz();
    TentiforMobilUretim.yazToolbarBagla();
  });

  // Yüklendiğinde hazırla
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    TentiforGunlukVeHizli.dockCiz();
    TentiforMobilUretim.yazToolbarBagla();
  }

  function kacir(str) {
    return typeof window.kacir === 'function' ? window.kacir(str) : String(str || '').replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

}());
