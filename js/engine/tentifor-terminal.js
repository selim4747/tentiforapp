/**
 * TentiforApp Özel Arşiv Terminali (Tentifor Cyber-Console / CLI Engine)
 * Web Terminali, Sanal Dosya Sistemi, 404 Otomatik Kurtarma, Yönetici Konsolu,
 * Web Audio Sentezleyici ve Termux Entegrasyonu.
 */

(function () {
  'use strict';

  // Ses Sentezleyici (Web Audio API)
  class TerminalSes {
    constructor() {
      this.aktif = localStorage.getItem('tentifor_term_ses') !== 'kapali';
      this.ctx = null;
    }

    baglam() {
      if (!this.ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AudioCtx();
        } catch {
          this.ctx = null;
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    tus() {
      if (!this.aktif) return;
      const ctx = this.baglam();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600 + Math.random() * 200, ctx.currentTime);
        gain.gain.setValueAtTime(0.015, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } catch {}
    }

    onay() {
      if (!this.aktif) return;
      const ctx = this.baglam();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.14);
      } catch {}
    }

    hata() {
      if (!this.aktif) return;
      const ctx = this.baglam();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.15);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.16);
      } catch {}
    }

    zil() {
      if (!this.aktif) return;
      const ctx = this.baglam();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.3);
      } catch {}
    }

    melodi(notalar) {
      if (!this.aktif) return;
      const ctx = this.baglam();
      if (!ctx) return;
      try {
        const t = ctx.currentTime;
        (notalar || [440, 523, 659, 880]).forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t + idx * 0.16);
          gain.gain.setValueAtTime(0.035, t + idx * 0.16);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.16 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t + idx * 0.16);
          osc.stop(t + idx * 0.16 + 0.2);
        });
      } catch {}
    }

    ayar(durum) {
      this.aktif = Boolean(durum);
      localStorage.setItem('tentifor_term_ses', this.aktif ? 'acik' : 'kapali');
      if (this.aktif) this.onay();
    }
  }

  // Sanal Dosya Sistemi (VFS)
  const SANAL_DIZINLER = {
    '/': ['evrenler', 'karakterler', 'kitaplar', 'sistem', 'oyunlar', 'loglar'],
    '/evrenler': [
      'eterya.json',
      'somdo.json',
      'kul.json',
      'sis.json',
      'e25-ana-evren.json',
      'e99-merkez.json'
    ],
    '/karakterler': [
      'necale.txt',
      'ozan.txt',
      'eylul.txt',
      'kemal.txt',
      'berk.txt',
      'girilar.txt',
      'dunya-arsivcileri.txt'
    ],
    '/kitaplar': [
      'gece-vardiyasi.txt',
      'roman-giris.txt',
      'kisa-oykuler.txt',
      'kutuphane-defteri.txt',
      'girilar-manifestosu.txt',
      'necale-gunlugu.txt',
      'sozluk-kavramlar.txt',
      'buzul-katmanlari.txt'
    ],
    '/sistem': [
      'cekirdek.conf',
      'surum.json',
      'ag-durumu.conf',
      'tomye-kozmolojisi.md',
      'ses-ciftleri.conf',
      'guvenlik-kurallari.md',
      'yonetici-kanon.key',
      'kyldo-alfabesi.txt'
    ],
    '/oyunlar': [
      'yedi-oyun.txt',
      'arsiv-avi.txt',
      'kelime-avcisi.txt',
      'tomye-zari.txt',
      'liderlik-tablosu.txt',
      'rozetler-ve-unvanlar.txt'
    ],
    '/loglar': [
      '404_rotalar.log',
      'sistem_olaylari.log',
      'karantina.log'
    ]
  };

  const SANAL_DOSYALAR = {
    '/evrenler/eterya.json': JSON.stringify({
      id: 'eterya',
      ad: 'Eterya',
      tur: 'Model Evreni',
      kozmoloji: 'Sonsuz buzul kristalize enerji hatları',
      kurallar: ['Zaman doğrusal akmaz', 'Ses donarak kristalleşir']
    }, null, 2),
    '/evrenler/somdo.json': JSON.stringify({
      id: 'somdo',
      ad: 'Şomdo',
      yazar: 'Claude',
      ozet: 'Aynaların arkasındaki sessiz ve kadim Tentifor yankısı.'
    }, null, 2),
    '/evrenler/kul.json': JSON.stringify({
      id: 'kul',
      ad: 'Kül Evreni',
      koku: 'Yanmış parşömen ve unutulmuş kütüphaneler.'
    }, null, 2),
    '/evrenler/sis.json': JSON.stringify({
      id: 'sis',
      ad: 'Sis Evreni',
      durum: 'Görünürlük 3 adım; fısıltılar katmanları deler.'
    }, null, 2),
    '/evrenler/e25-ana-evren.json': JSON.stringify({
      id: 'e25',
      ad: 'E-25 Tömye',
      kanon: true,
      ozellik: '28 günlük döngü, 26 saatlik güneş takvimi, aysız gökyüzü.'
    }, null, 2),
    '/evrenler/e99-merkez.json': JSON.stringify({
      id: 'e99',
      ad: 'E-99 Ortak Evren',
      ozellik: 'Topluluk katkıları ve birleştirilmiş fan hikâyeleri merkezi.'
    }, null, 2),
    '/karakterler/necale.txt':
      'Ad: Necale\nRol: Baş Arşivci & Kütüphane Bekçisi\nNot: "Yanlış yerleştirilen tek bir sayfa, bir medeniyeti siler."\nDurum: Aktif ve Tetikte.',
    '/karakterler/ozan.txt':
      'Ad: Ozan\nRol: Arayıcı & Gezgin\nNot: Buzun altındaki yankıları dinleyen gezgin.\nRotası: 3. Çatlak\'tan Çekirdek\'e uzanan iz.',
    '/karakterler/eylul.txt':
      'Ad: Eylül\nRol: Kod ve Yazı Çözücü\nNot: Kyldo alfabesini ve ses çifti matrisini ilk çözen arşivci.',
    '/karakterler/kemal.txt':
      'Ad: Kemal\nRol: Koruyucu\nNot: Kanon kilitlerini denetleyen kıdemli gözlemci.',
    '/karakterler/berk.txt':
      'Ad: Berk\nRol: Katman Analisti\nNot: Baloncuk evrenlerin sınır sapmalarını ölçer.',
    '/karakterler/girilar.txt':
      'Ad: Gırılar\nRol: Kitap Yakan İsyancılar\nKayıt: "Kelimeler donarsa medeniyet donar." diyerek kütüphaneleri ateşe veren kadim birlik.',
    '/karakterler/dunya-arsivcileri.txt':
      'Tömye ve Dünya arasındaki sınırda görev yapan 12 kayıt memuru.',
    '/kitaplar/gece-vardiyasi.txt':
      'Gece Vardiyası — Bölüm 1:\nKütüphanenin ışıkları söndüğünde raflardan fısıltılar yükselirdi. Necale fenerini kaldırdı...',
    '/kitaplar/roman-giris.txt':
      'Tömye Romanı — Giriş:\n"Gökyüzünde ay yoktu. Ama geceleri denizin üstünde donmuş hatıralar parlardı..."',
    '/kitaplar/kutuphane-defteri.txt':
      'Kayıt No #404: Bilinmeyen bir ziyaretçi izinsiz katman sınırını aştı.',
    '/kitaplar/girilar-manifestosu.txt':
      'Gırılar Manifestosu:\n1. Kaydedilen her kelime bir bağdır.\n2. Buzun altındaki hakikat dondurularak saklanamaz.\n3. Yanmış parşömenlerin külü kütüphane zeminine serpilse de Kyldo şifreleri yok edilemez.',
    '/kitaplar/necale-gunlugu.txt':
      'Necale\'nin Koridor Günlüğü:\nGece vardiyasında 4. katmandaki buzul çatlağı fısıldamaya başladı. Fenerin gazı azalıyor ama nöbet terk edilemez.',
    '/sistem/cekirdek.conf':
      'PLATFORM=TentiforApp\nSURUM=6.3.13\nCEKIRDEK=Tentifor-MicroV6\nKONTROL_HASH=02be92c9367b\nOFFLINE_CAP=READY',
    '/sistem/surum.json': JSON.stringify({
      surum: '6.3.13',
      derleme: '2026.10',
      ozellikler: ['PWA', 'Offline Queue', 'Visual Timeline', 'Cyber Terminal']
    }, null, 2),
    '/sistem/ag-durumu.conf':
      'STATUS=ONLINE\nSUPABASE=CONNECTED\nSW_CACHE=tentiforapp-aktif\nFCM=STANDBY',
    '/sistem/tomye-kozmolojisi.md':
      '# TÖMYE KOZMOLOJİSİ\n- Aysız Gezegen: Tömye semalarında ay bulunmaz.\n- 28 Günlük Ay Döngüsü: 11 ay 28 gün çeker, 12. ay Kyldo 30 gün.\n- 26 Saatlik Gün: Güneş döngüsü 26 saatlik periyotla akar.\n- 6 Günlük Hafta: Yen, Tan, Gün, Dün, Tün, Son.',
    '/sistem/ses-ciftleri.conf':
      'SES_CIFTLERI=b:p,c:ç,d:t,g:k,v:f,z:s,j:ş,r:l,n:m,a:e,ı:i,o:u,ö:ü\nSABITLER=y,h',
    '/sistem/guvenlik-kurallari.md':
      '# Tentifor Güvenlik Kuralları\n1. Kanon kilitleri izinsiz delinemez.\n2. Boş fan evrenleri silinirken hikâyeli olanlar korunur.\n3. Yönetici yetkisi denetime tabidir.',
    '/sistem/yonetici-kanon.key':
      '-----BEGIN TENTIFOR CANON MASTER KEY-----\nSHA256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069\n-----END TENTIFOR CANON MASTER KEY-----',
    '/oyunlar/yedi-oyun.txt':
      '1. Arşiv Avı\n2. İsim Bulmaca\n3. Zaman Çizelgesi\n4. Karakter Eşleştirme\n5. Harita Keşfi\n6. Kelime Oyunu\n7. Buzul Zindanı',
    '/oyunlar/arsiv-avi.txt':
      'Kayıp parçaları toplayarak Tömye arşivini tamamla!',
    '/oyunlar/tomye-zari.txt':
      'TÖMYE ZAR KURALLARI:\nTömye günü 25/26 saat olduğundan kadim gezginler 25 yüzlü (d25) zar kullanır.\nAy döngüsü için 28 yüzlü (d28) takvim zarı tercih edilir.',
    '/kitaplar/sozluk-kavramlar.txt':
      'TÖMYE SÖZLÜĞÜ:\n• Gırılar: Kitapları yakan kadim isyancı birlik.\n• Kyldo: Sesli kaydırma ve ters harf morfolojisine dayalı kadim dil.\n• Akçe: Arşivcilerin kütüphane içi takas birimi.\n• Yankı: Evrenlerin katmanlar arası titreşimiyle oluşan zaman kırılmaları.\n• Buzul: Tömye\'nin hafızasını dondurarak koruyan kozmik tabaka.',
    '/kitaplar/buzul-katmanlari.txt':
      'TÖMYE\'NİN 7 DONMUŞ KATMANI:\n1. Katman: Yüzey Kırağısı (Halka açık okuma koridoru)\n2. Katman: Kyldo Yazıtları (Şifreli tabletler)\n3. Katman: Yankı Havuzları (Zaman sapmaları)\n4. Katman: Baloncuk Evrenler (Yan boyutlar)\n5. Katman: Yanmış Kitaplık (Gırılar\'ın kül ettiği arşivler)\n6. Katman: Dördüncü Boyut Çatlağı (Uzay bükülmeleri)\n7. Katman: Çekirdek (Kanonun kalbi & mutlak hafıza)',
    '/oyunlar/liderlik-tablosu.txt':
      'LİDERLİK SIRALAMASI:\n1. @necale_bekcisi - 9400 Puan [Kıdemli Arşivci]\n2. @buz_avcisi - 8120 Puan [Kâşif]\n3. @yankilar_ustasi - 7550 Puan [Dilbilgin]\n4. @dunya_gozlemcisi - 6900 Puan [Okur]',
    '/oyunlar/rozetler-ve-unvanlar.txt':
      'ROZETLER:\n✦ Buzul Kâşifi: Tüm bölümleri ilk okuyanlara verilir.\n✦ Kanon Muhafızı: Kilitli sırları çözenlere verilir.\n✦ Kyldo Dilbilgini: İsim sisteminde 10 başarılı üretim yapanlara verilir.\n✦ Gece Okuru: Gece Vardiyası serisini tamamlayanlara verilir.',
    '/sistem/kyldo-alfabesi.txt':
      'KYLDO ALFABESİ VE SES DÖNÜŞÜMÜ:\na -> e\ne -> i\ni -> o\no -> u\nu -> a\nKural: Kelime önce tersten yazılır, ardından sesli harfler bir basamak kaydırılır.',
    '/loglar/404_rotalar.log':
      '[LOG 2026-10-06] 404 tespit: Geçersiz koordinat veya kayıp katman.\n[LOG 2026-10-06] Otomatik kurtarma motoru devrede.',
    '/loglar/sistem_olaylari.log':
      '[OK] Veritabanı bütünlüğü doğrulandı.\n[OK] Service Worker önbelleği hazır.\n[OK] Arşiv modülü yüklendi.',
    '/loglar/karantina.log':
      '[BILGI] Karantinada bekleyen zararlı veya uygunsuz içerik bulunmuyor.'
  };

  // Metin Benzerlik / Levenshtein Algoritması (404 Kurtarma İçin)
  function levenshtein(a, b) {
    const s1 = String(a || '').toLowerCase();
    const s2 = String(b || '').toLowerCase();
    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  // Tömye Takvim Çeviricisi
  function tomyeZamani() {
    const simdi = new Date();
    const baslangic = new Date(Date.UTC(2024, 0, 1));
    const gecenGun = Math.floor((simdi - baslangic) / 86400000);
    const tomyeYili = 744 + Math.floor(gecenGun / 336);
    const aylar = ['Buz', 'Çatlak', 'Akıntı', 'Kırağı', 'Yankı', 'Gece', 'Güneş', 'Kül', 'Fırtına', 'Sessizlik', 'Işık', 'Dönüş'];
    const ayIndeks = Math.floor((gecenGun % 336) / 28);
    const ayGunu = (gecenGun % 28) + 1;
    const dunyaDakika = simdi.getHours() * 60 + simdi.getMinutes();
    const tomyeDakikaTop = Math.floor((dunyaDakika / 1440) * (26 * 60));
    const tomyeSaat = Math.floor(tomyeDakikaTop / 60);
    const tomyeDakika = tomyeDakikaTop % 60;

    return {
      yil: tomyeYili,
      ay: aylar[ayIndeks] || 'Buz',
      gun: ayGunu,
      saat: tomyeSaat,
      dakika: tomyeDakika
    };
  }

  // Kanon Ses Çiftleri
  const SES_CIFTI = {
    b: 'p', p: 'b', c: 'ç', ç: 'c', d: 't', t: 'd', g: 'k', k: 'g',
    v: 'f', f: 'v', z: 's', s: 'z', j: 'ş', ş: 'j', r: 'l', l: 'r',
    n: 'm', m: 'n', a: 'e', e: 'a', ı: 'i', i: 'ı', o: 'u', u: 'o',
    ö: 'ü', ü: 'ö', y: 'y', h: 'h'
  };

  // Kyldo İsim Üreticisi
  function kyldoIsim(kelime) {
    if (!kelime) return [];
    const k = String(kelime).trim().toLowerCase();
    const ters = k.split('').reverse().join('');
    const donusum = { a: 'e', e: 'i', i: 'o', o: 'u', u: 'a', ç: 'c', ş: 's', ğ: 'g', ö: 'u', ü: 'i' };
    const harfDegis = k.split('').map((c) => donusum[c] || c).join('');
    const tersHarf = ters.split('').map((c) => donusum[c] || c).join('');
    const buyukIlk = (s) => s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);

    // Kanon Ses Çifti Dönüşümü (örn: çatlak -> Gerdec)
    let sesCiftiTers = '';
    for (const h of ters) {
      sesCiftiTers += SES_CIFTI[h] || h;
    }
    let sesCiftiDuz = '';
    for (const h of k) {
      sesCiftiDuz += SES_CIFTI[h] || h;
    }

    return [
      { yol: 'Ters + Ses Çifti (Gerdec Kuralı)', ad: buyukIlk(sesCiftiTers) },
      { yol: 'Ses Çifti Çevirisi (Tömye Kuralı)', ad: buyukIlk(sesCiftiDuz) },
      { yol: 'Sesli Kaydırma (Kyldo)', ad: buyukIlk(harfDegis) },
      { yol: 'Ters + Kaydırma (Klasik)', ad: buyukIlk(tersHarf) },
      { yol: 'Düz Ayna Ters', ad: buyukIlk(ters) }
    ];
  }

  // Terminal Sınıfı
  class TentiforTerminalEngine {
    constructor() {
      this.ses = new TerminalSes();
      this.dizin = '/';
      this.gecmis = [];
      this.gecmisIndeksi = -1;
      this.tema = localStorage.getItem('tentifor_term_tema') || 'tentifor';
      if (this.tema === 'matrix') this.tema = 'tentifor';
      this.crt = localStorage.getItem('tentifor_term_crt') === 'acik';
      this.boyut = localStorage.getItem('tentifor_term_boyut') || 'orta';
      this.adminOturumu = false;
      this.oyunDurumu = null;
      this.pencereAcik = false;
      this.tamEkran = false;
      this.gecmisYukle();
    }

    gecmisYukle() {
      try {
        const h = localStorage.getItem('tentifor_term_history');
        if (h) this.gecmis = JSON.parse(h) || [];
      } catch {
        this.gecmis = [];
      }
    }

    gecmisKaydet(komut) {
      if (!komut || !komut.trim()) return;
      const k = komut.trim();
      if (this.gecmis[this.gecmis.length - 1] !== k) {
        this.gecmis.push(k);
        if (this.gecmis.length > 80) this.gecmis.shift();
        try {
          localStorage.setItem('tentifor_term_history', JSON.stringify(this.gecmis));
        } catch {}
      }
      this.gecmisIndeksi = this.gecmis.length;
    }

    istemiMetni() {
      const user = this.adminOturumu ? 'root' : 'tentifor';
      const host = this.adminOturumu ? 'tentifor-core' : 'arsiv';
      const path = this.dizin === '/' ? '~' : `~${this.dizin}`;
      const symbol = this.adminOturumu ? '#' : '$';
      return `<span class="term-kullanici">${user}@${host}</span><span class="term-ayirac">:</span><span class="term-dizin">${path}</span>${symbol} `;
    }

    istemiDüzMetin() {
      const user = this.adminOturumu ? 'root' : 'tentifor';
      const host = this.adminOturumu ? 'tentifor-core' : 'arsiv';
      const path = this.dizin === '/' ? '~' : `~${this.dizin}`;
      const symbol = this.adminOturumu ? '#' : '$';
      return `${user}@${host}:${path}${symbol} `;
    }

    // Arayüz Kurulumu
    olusturTerminalElement(idPrefix = 'term', is404 = false) {
      const wrapper = document.createElement('div');
      wrapper.id = `${idPrefix}-konteyner`;
      wrapper.className = `tentifor-terminal-konteyner tema-${this.tema} ${this.crt ? 'crt-aktif' : ''} ${is404 ? 'tentifor-terminal-404' : 'tentifor-terminal-modal'}`;

      wrapper.innerHTML = `
        <div class="term-baslik-cubugu" data-term-surukle="1">
          <div class="term-baslik-sol">
            <div class="term-noktalar">
              <button class="term-nokta kirmizi" title="Kapat" data-term-aksiyon="kapat"></button>
              <button class="term-nokta sari" title="Simge Durumuna Küçült" data-term-aksiyon="kucult"></button>
              <button class="term-nokta yesil" title="Tam Ekran" data-term-aksiyon="tamekran"></button>
            </div>
            <div class="term-baslik-metin">
              <span>Tentifor Arşiv Terminali</span>
              <span class="term-baslik-rozet" id="${idPrefix}-rozet">${this.adminOturumu ? 'ROOT / YÖNETİCİ' : 'V6.3.13'}</span>
            </div>
          </div>
          <div class="term-baslik-sag">
            <button class="term-dugme" data-term-aksiyon="ses" title="Ses Aç/Kapat">🔊 <span class="term-ses-durum">${this.ses.aktif ? 'Açık' : 'Kapalı'}</span></button>
            <button class="term-dugme" data-term-aksiyon="tema" title="Tema Değiştir">🎨 Tema</button>
            <button class="term-dugme" data-term-aksiyon="crt" title="CRT Tarama Efekti">📺 CRT</button>
            <button class="term-dugme" data-term-aksiyon="tamekran" title="Tam Ekran">⛶</button>
            <button class="term-dugme" data-term-aksiyon="kapat" title="Kapat">✕</button>
          </div>
        </div>

        <div class="term-hizli-cubuk">
          <button class="term-hizli-hap vurgulu" data-term-komut="yardim">yardım</button>
          <button class="term-hizli-hap" data-term-komut="saat">saat</button>
          <button class="term-hizli-hap" data-term-komut="takvim">takvim</button>
          <button class="term-hizli-hap" data-term-komut="isim çatlak">isim</button>
          <button class="term-hizli-hap" data-term-komut="kyldo Tentifor">kyldo</button>
          <button class="term-hizli-hap" data-term-komut="sesler">sesler</button>
          <button class="term-hizli-hap" data-term-komut="oneri karakter">öneri</button>
          <button class="term-hizli-hap" data-term-komut="kurtar">kurtar</button>
          <button class="term-hizli-hap" data-term-komut="ls">ls</button>
          <button class="term-hizli-hap" data-term-komut="roman son">roman</button>
          <button class="term-hizli-hap" data-term-komut="evren list">evren</button>
          <button class="term-hizli-hap" data-term-komut="karakter list">karakter</button>
          <button class="term-hizli-hap" data-term-komut="necale">necale</button>
          <button class="term-hizli-hap" data-term-komut="girilar">gırılar</button>
          <button class="term-hizli-hap" data-term-komut="katmanlar">katmanlar</button>
          <button class="term-hizli-hap" data-term-komut="harita yerler">harita</button>
          <button class="term-hizli-hap" data-term-komut="fankitap liste">fan-kitap</button>
          <button class="term-hizli-hap" data-term-komut="gorevler">görevler</button>
          <button class="term-hizli-hap" data-term-komut="anomali">anomali</button>
          <button class="term-hizli-hap" data-term-komut="sozluk">sözlük</button>
          <button class="term-hizli-hap" data-term-komut="baglar">bağlar</button>
          <button class="term-hizli-hap" data-term-komut="rozetler">rozetler</button>
          <button class="term-hizli-hap" data-term-komut="cuzdan">cüzdan</button>
          <button class="term-hizli-hap" data-term-komut="defter">defter</button>
          <button class="term-hizli-hap" data-term-komut="buzul">buzul</button>
          <button class="term-hizli-hap" data-term-komut="zar 25">zar 25</button>
          <button class="term-hizli-hap" data-term-komut="muzik cal buzul">müzik</button>
          <button class="term-hizli-hap" data-term-komut="liderlik">liderlik</button>
          <button class="term-hizli-hap" data-term-komut="bulmaca">bulmaca</button>
          <button class="term-hizli-hap" data-term-komut="oyun">oyun</button>
          <button class="term-hizli-hap" data-term-komut="admin">admin</button>
          <button class="term-hizli-hap" data-term-komut="temizle">temizle</button>
        </div>

        <div class="term-ekran" id="${idPrefix}-ekran"></div>

        <div class="term-giris-satiri">
          <span class="term-istemi" id="${idPrefix}-istemi">${this.istemiMetni()}</span>
          <input class="term-giris" id="${idPrefix}-giris" type="text" autocomplete="off" spellcheck="false" autofocus aria-label="Terminal komut girişi">
        </div>
      `;

      return wrapper;
    }

    baglaOlaylar(konteyner, idPrefix, is404 = false) {
      const ekran = konteyner.querySelector(`#${idPrefix}-ekran`);
      const giris = konteyner.querySelector(`#${idPrefix}-giris`);
      const istemiEl = konteyner.querySelector(`#${idPrefix}-istemi`);
      const rozetEl = konteyner.querySelector(`#${idPrefix}-rozet`);

      // Ekrana tıklandığında imleci girişe odakla
      ekran.addEventListener('click', () => {
        giris.focus();
      });

      // Klavye Olayları
      giris.addEventListener('keydown', (e) => {
        this.ses.tus();

        if (e.key === 'Enter') {
          e.preventDefault();
          const cmd = giris.value;
          giris.value = '';
          this.komutCalistir(cmd, ekran, istemiEl, rozetEl, konteyner);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (this.gecmisIndeksi > 0) {
            this.gecmisIndeksi -= 1;
            giris.value = this.gecmis[this.gecmisIndeksi] || '';
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (this.gecmisIndeksi < this.gecmis.length - 1) {
            this.gecmisIndeksi += 1;
            giris.value = this.gecmis[this.gecmisIndeksi] || '';
          } else {
            this.gecmisIndeksi = this.gecmis.length;
            giris.value = '';
          }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const tamamlanan = this.otomatikTamamla(giris.value);
          if (tamamlanan) giris.value = tamamlanan;
        } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
          e.preventDefault();
          ekran.innerHTML = '';
        } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          this.yaz(ekran, `<span class="term-soluk">${this.istemiMetni()}${giris.value}^C</span>`);
          giris.value = '';
        }
      });

      // Başlık ve hızlı çubuk aksiyonları
      konteyner.addEventListener('click', (e) => {
        const aksiyon = e.target.closest('[data-term-aksiyon]');
        if (aksiyon) {
          const tip = aksiyon.dataset.termAksiyon;
          if (tip === 'kapat') {
            if (is404) {
              konteyner.style.display = 'none';
            } else {
              this.kapat();
            }
          } else if (tip === 'kucult') {
            this.kapat();
          } else if (tip === 'tamekran') {
            this.tamEkranDegistir(konteyner);
          } else if (tip === 'ses') {
            this.ses.ayar(!this.ses.aktif);
            const durumMetin = konteyner.querySelector('.term-ses-durum');
            if (durumMetin) durumMetin.textContent = this.ses.aktif ? 'Açık' : 'Kapalı';
            this.yaz(ekran, `<span class="term-bilgi">Ses durumu: <b>${this.ses.aktif ? 'Açık' : 'Kapalı'}</b></span>`);
          } else if (tip === 'tema') {
            this.sonrakiTema(konteyner);
            this.yaz(ekran, `<span class="term-bilgi">Aktif tema: <b>${this.tema}</b></span>`);
          } else if (tip === 'crt') {
            this.crt = !this.crt;
            localStorage.setItem('tentifor_term_crt', this.crt ? 'acik' : 'kapali');
            konteyner.classList.toggle('crt-aktif', this.crt);
            this.yaz(ekran, `<span class="term-bilgi">CRT tarama etkisi: <b>${this.crt ? 'Açık' : 'Kapalı'}</b></span>`);
          }
          giris.focus();
          return;
        }

        const hizliKomut = e.target.closest('[data-term-komut]');
        if (hizliKomut) {
          const cmd = hizliKomut.dataset.termKomut;
          this.komutCalistir(cmd, ekran, istemiEl, rozetEl, konteyner);
          giris.focus();
        }
      });
    }

    tamEkranDegistir(konteyner) {
      konteyner.classList.toggle('tamekran');
      this.tamEkran = konteyner.classList.contains('tamekran');
    }

    sonrakiTema(konteyner) {
      const temalar = ['tentifor', 'amber', 'cyber', 'dracula', 'mono'];
      const suankiIndeks = temalar.indexOf(this.tema);
      const sonraki = temalar[(suankiIndeks + 1) % temalar.length];
      this.temaAyarla(sonraki, konteyner);
    }

    temaAyarla(yeniTema, konteyner) {
      const temalar = ['tentifor', 'amber', 'cyber', 'dracula', 'mono'];
      if (!temalar.includes(yeniTema)) return;
      temalar.forEach((t) => konteyner.classList.remove(`tema-${t}`));
      konteyner.classList.remove('tema-matrix');
      konteyner.classList.add(`tema-${yeniTema}`);
      this.tema = yeniTema;
      localStorage.setItem('tentifor_term_tema', yeniTema);
    }

    yaz(ekran, html) {
      const satir = document.createElement('div');
      satir.className = 'term-satir';
      satir.innerHTML = html;
      ekran.appendChild(satir);
      ekran.scrollTop = ekran.scrollHeight;
    }

    otomatikTamamla(girisMetni) {
      if (!girisMetni) return '';
      const parcalar = girisMetni.split(' ');
      const sonKelime = parcalar[parcalar.length - 1];

      const tumKomutlar = [
        'yardim', 'help', 'temizle', 'clear', 'cls', 'saat', 'time', 'tarih', 'date', 'zaman',
        'takvim', 'cevir', 'yas', 'sesler', 'sescifti', 'alfabe', 'oneri', 'kod', 'sifre',
        'uname', 'surum', 'whoami', 'kimim', 'pwd', 'ls', 'dir', 'cd', 'cat', 'oku',
        'tree', 'find', 'bul', '404', 'neredeyim', 'kurtar', 'fix', 'rotalar',
        'roman', 'evren', 'karakter', 'katmanlar', 'katman', 'necale', 'ozan', 'eylul', 'girilar',
        'somdo', 'harita', 'sozluk', 'kyldo', 'baglar', 'fankitap', 'fanhikaye', 'kanon',
        'anomali', 'delilik', 'gorevler', 'muzik', 'ezgi', 'liderlik', 'rozetler', 'cuzdan',
        'defter', 'koleksiyon', 'buzul', 'zar', 'yankilar', 'bulmaca', 'hikaye',
        'bildirimler', 'isim', 'alinti', 'ara', 'git', 'goto',
        'oyun', 'macera', 'tema', 'theme',
        'crt', 'ses', 'sound', 'ps', 'top', 'export', 'admin', 'sudo', 'cikis'
      ];

      if (parcalar.length === 1) {
        const eslesen = tumKomutlar.filter((k) => k.startsWith(sonKelime.toLowerCase()));
        if (eslesen.length >= 1) return `${eslesen[0]} `;
      } else {
        const ilk = parcalar[0].toLowerCase();
        if (ilk === 'cd') {
          const dizinler = SANAL_DIZINLER[this.dizin] || [];
          const eslesen = dizinler.filter((d) => d.startsWith(sonKelime.toLowerCase()));
          if (eslesen.length === 1) {
            parcalar[parcalar.length - 1] = eslesen[0];
            return parcalar.join(' ');
          }
        } else if (ilk === 'cat' || ilk === 'oku') {
          const dosyalar = SANAL_DIZINLER[this.dizin] || [];
          const eslesen = dosyalar.filter((d) => d.startsWith(sonKelime.toLowerCase()));
          if (eslesen.length === 1) {
            parcalar[parcalar.length - 1] = eslesen[0];
            return parcalar.join(' ');
          }
        } else if (ilk === 'evren') {
          const altlar = ['list', 'bilgi', 'git'];
          const es = altlar.filter((a) => a.startsWith(sonKelime.toLowerCase()));
          if (es.length === 1) {
            parcalar[parcalar.length - 1] = es[0];
            return parcalar.join(' ');
          }
        } else if (ilk === 'roman') {
          const altlar = ['liste', 'son', 'oku', 'ozet'];
          const es = altlar.filter((a) => a.startsWith(sonKelime.toLowerCase()));
          if (es.length === 1) {
            parcalar[parcalar.length - 1] = es[0];
            return parcalar.join(' ');
          }
        } else if (ilk === 'harita') {
          const altlar = ['yerler', 'sehirler', 'kitalar', 'ara'];
          const es = altlar.filter((a) => a.startsWith(sonKelime.toLowerCase()));
          if (es.length === 1) {
            parcalar[parcalar.length - 1] = es[0];
            return parcalar.join(' ');
          }
        } else if (ilk === 'fankitap' || ilk === 'fanhikaye') {
          const altlar = ['liste', 'koru', 'oku'];
          const es = altlar.filter((a) => a.startsWith(sonKelime.toLowerCase()));
          if (es.length === 1) {
            parcalar[parcalar.length - 1] = es[0];
            return parcalar.join(' ');
          }
        } else if (ilk === 'muzik' || ilk === 'ezgi') {
          const altlar = ['cal', 'dur', 'liste'];
          const es = altlar.filter((a) => a.startsWith(sonKelime.toLowerCase()));
          if (es.length === 1) {
            parcalar[parcalar.length - 1] = es[0];
            return parcalar.join(' ');
          }
        } else if (ilk === 'kanon') {
          const altlar = ['durum', 'evrenler', 'kilit'];
          const es = altlar.filter((a) => a.startsWith(sonKelime.toLowerCase()));
          if (es.length === 1) {
            parcalar[parcalar.length - 1] = es[0];
            return parcalar.join(' ');
          }
        } else if (ilk === 'buzul') {
          const altlar = ['katmanlar', 'coz'];
          const es = altlar.filter((a) => a.startsWith(sonKelime.toLowerCase()));
          if (es.length === 1) {
            parcalar[parcalar.length - 1] = es[0];
            return parcalar.join(' ');
          }
        } else if (ilk === 'cuzdan') {
          const altlar = ['bakiye', 'dukkan', 'hediye'];
          const es = altlar.filter((a) => a.startsWith(sonKelime.toLowerCase()));
          if (es.length === 1) {
            parcalar[parcalar.length - 1] = es[0];
            return parcalar.join(' ');
          }
        } else if (ilk === 'git') {
          const rotalar = ['arsiv', 'tomye', 'okuma', 'atolye', 'fan', 'oyunlar', 'harita', 'roman', 'sen'];
          const es = rotalar.filter((r) => r.startsWith(sonKelime.toLowerCase()));
          if (es.length === 1) {
            parcalar[parcalar.length - 1] = es[0];
            return parcalar.join(' ');
          }
        }
      }
      return null;
    }

    // Komut Yorumlayıcı
    komutCalistir(hamKomut, ekran, istemiEl, rozetEl, konteyner) {
      const temiz = String(hamKomut || '').trim();
      if (!temiz) {
        this.yaz(ekran, `<div class="term-komut-tekrar">${this.istemiMetni()}</div>`);
        return;
      }

      this.gecmisKaydet(temiz);
      this.yaz(ekran, `<div class="term-komut-tekrar">${this.istemiMetni()}<span class="term-parlak">${this.kacir(temiz)}</span></div>`);

      const parcalar = temiz.split(/\s+/);
      const anaKomut = parcalar[0].toLowerCase();
      const argumanlar = parcalar.slice(1);
      const kalanMetin = argumanlar.join(' ');

      try {
        switch (anaKomut) {
          case 'yardim':
          case 'help':
          case '?':
            this.komutYardim(ekran, argumanlar[0]);
            this.ses.onay();
            break;

          case 'temizle':
          case 'clear':
          case 'cls':
            ekran.innerHTML = '';
            break;

          case 'echo':
          case 'yaz':
            this.yaz(ekran, this.kacir(kalanMetin));
            break;

          case 'tarih':
          case 'date':
          case 'zaman':
            this.komutTarih(ekran);
            this.ses.onay();
            break;

          case 'uname':
          case 'surum':
          case 'version':
            this.komutSurum(ekran);
            this.ses.onay();
            break;

          case 'whoami':
          case 'kimim':
            this.komutWhoami(ekran);
            this.ses.onay();
            break;

          case 'pwd':
            this.yaz(ekran, `<span class="term-yol">${this.dizin}</span>`);
            break;

          case 'ls':
          case 'dir':
            this.komutLs(ekran, argumanlar[0]);
            this.ses.onay();
            break;

          case 'cd':
            this.komutCd(ekran, argumanlar[0], istemiEl);
            break;

          case 'cat':
          case 'oku':
            this.komutCat(ekran, argumanlar[0]);
            break;

          case 'tree':
            this.komutTree(ekran);
            this.ses.onay();
            break;

          case 'find':
          case 'bul':
            this.komutFind(ekran, argumanlar[0]);
            break;

          case '404':
          case 'neredeyim':
            this.komut404(ekran);
            this.ses.onay();
            break;

          case 'kurtar':
          case 'fix':
            this.komutKurtar(ekran, argumanlar[0]);
            this.ses.onay();
            break;

          case 'rotalar':
          case 'routes':
            this.komutRotalar(ekran);
            this.ses.onay();
            break;

          case 'git':
          case 'goto':
            this.komutGit(ekran, argumanlar[0]);
            break;

          case 'evren':
            this.komutEvren(ekran, argumanlar[0], argumanlar.slice(1).join(' '));
            break;

          case 'karakter':
            this.komutKarakter(ekran, argumanlar[0], argumanlar.slice(1).join(' '));
            break;

          case 'takvim':
            this.komutTakvim(ekran);
            this.ses.onay();
            break;

          case 'isim':
            this.komutIsim(ekran, kalanMetin);
            this.ses.onay();
            break;

          case 'alinti':
            this.komutAlinti(ekran);
            this.ses.onay();
            break;

          case 'ara':
          case 'search':
            this.komutAra(ekran, kalanMetin);
            break;

          case 'roman':
            this.komutRoman(ekran, argumanlar[0], argumanlar.slice(1).join(' '));
            this.ses.onay();
            break;

          case 'harita':
            this.komutHarita(ekran, argumanlar[0], argumanlar.slice(1).join(' '));
            this.ses.onay();
            break;

          case 'sozluk':
            this.komutSozluk(ekran, kalanMetin);
            this.ses.onay();
            break;

          case 'kyldo':
            this.komutKyldo(ekran, kalanMetin);
            this.ses.onay();
            break;

          case 'baglar':
            this.komutBaglar(ekran, kalanMetin);
            this.ses.onay();
            break;

          case 'liderlik':
            this.komutLiderlik(ekran);
            this.ses.onay();
            break;

          case 'rozetler':
            this.komutRozetler(ekran);
            this.ses.onay();
            break;

          case 'cuzdan':
            this.komutCuzdan(ekran);
            this.ses.onay();
            break;

          case 'yankilar':
            this.komutYankilar(ekran);
            this.ses.onay();
            break;

          case 'bulmaca':
            this.komutBulmaca(ekran);
            this.ses.onay();
            break;

          case 'buzul':
            this.komutBuzul(ekran);
            this.ses.onay();
            break;

          case 'hikaye':
            this.komutHikaye(ekran, argumanlar[0]);
            this.ses.onay();
            break;

          case 'bildirimler':
            this.komutBildirimler(ekran);
            this.ses.onay();
            break;

          case 'fankitap':
          case 'fanhikaye':
          case 'fan':
            this.komutFanKitap(ekran, argumanlar[0], argumanlar.slice(1).join(' '));
            this.ses.onay();
            break;

          case 'kanon':
            this.komutKanon(ekran, argumanlar[0]);
            this.ses.onay();
            break;

          case 'anomali':
          case 'delilik':
            this.komutAnomali(ekran);
            this.ses.onay();
            break;

          case 'gorevler':
          case 'gorev':
            this.komutGorevler(ekran);
            this.ses.onay();
            break;

          case 'muzik':
          case 'ezgi':
          case 'cal':
            this.komutMuzik(ekran, argumanlar[0], argumanlar[1]);
            break;

          case 'saat':
          case 'time':
            this.komutSaat(ekran);
            this.ses.onay();
            break;

          case 'cevir':
            this.komutCevir(ekran, argumanlar[0]);
            this.ses.onay();
            break;

          case 'yas':
            this.komutYas(ekran, argumanlar);
            this.ses.onay();
            break;

          case 'sesler':
          case 'sescifti':
          case 'alfabe':
            this.komutSesler(ekran);
            this.ses.onay();
            break;

          case 'oneri':
            this.komutOneri(ekran, argumanlar[0]);
            this.ses.onay();
            break;

          case 'kod':
          case 'sifre':
            this.komutKod(ekran, kalanMetin);
            break;

          case 'girilar':
          case 'giri':
            this.komutGirilar(ekran);
            this.ses.onay();
            break;

          case 'necale':
            this.komutNecale(ekran);
            this.ses.onay();
            break;

          case 'ozan':
            this.komutOzan(ekran);
            this.ses.onay();
            break;

          case 'eylul':
            this.komutEylul(ekran);
            this.ses.onay();
            break;

          case 'katmanlar':
          case 'katman':
          case '7katman':
            this.komutKatmanlar(ekran);
            this.ses.onay();
            break;

          case 'somdo':
            this.komutSomdo(ekran);
            this.ses.onay();
            break;

          case 'zar':
            this.komutZar(ekran, argumanlar[0]);
            this.ses.onay();
            break;

          case 'defter':
          case 'koleksiyon':
            this.komutDefter(ekran);
            this.ses.onay();
            break;

          case 'ps':
          case 'top':
            this.komutPs(ekran);
            this.ses.onay();
            break;

          case 'ping':
          case 'curl':
          case 'fetch':
          case 'cowsay':
            this.ses.hata();
            this.yaz(ekran, `<span class="term-uyari">"${this.kacir(anaKomut)}" komutu siteye / Tömye dünyasına özgü olmadığı için terminalden kaldırılmıştır.</span><br><span class="term-soluk">Siteye özgü komutları görmek için <b>yardim</b> yazabilirsiniz.</span>`);
            break;

          case 'matrix':
            this.ses.hata();
            this.yaz(ekran, '<span class="term-uyari">"matrix" komutu ve teması sistemden tamamen kaldırılmıştır. Terminal Tömye ve Tentifor dünyasına özgü çalışmaktadır.</span>');
            break;

          case 'oyun':
          case 'macera':
            this.komutOyun(ekran, argumanlar[0]);
            break;

          case 'tema':
          case 'theme':
            if (argumanlar[0]) {
              const secilenTema = argumanlar[0].toLowerCase();
              if (secilenTema === 'matrix') {
                this.ses.hata();
                this.yaz(ekran, '<span class="term-uyari">Matrix teması sistemden tamamen kaldırılmıştır. Geçerli temalar: tentifor, amber, cyber, dracula, mono.</span>');
              } else {
                this.temaAyarla(secilenTema, konteyner);
                this.yaz(ekran, `<span class="term-basari">Tema değiştirildi: <b>${this.tema}</b></span>`);
              }
            } else {
              this.yaz(ekran, '<span class="term-soluk">Kullanım: tema [tentifor | amber | cyber | dracula | mono]</span>');
            }
            break;

          case 'crt':
            if (argumanlar[0] === 'ac') this.crt = true;
            else if (argumanlar[0] === 'kapat') this.crt = false;
            else this.crt = !this.crt;
            localStorage.setItem('tentifor_term_crt', this.crt ? 'acik' : 'kapali');
            konteyner.classList.toggle('crt-aktif', this.crt);
            this.yaz(ekran, `<span class="term-bilgi">CRT etkisi: <b>${this.crt ? 'Açık' : 'Kapalı'}</b></span>`);
            break;

          case 'ses':
          case 'sound':
            if (argumanlar[0] === 'test') {
              this.ses.onay();
              setTimeout(() => this.ses.zil(), 200);
              this.yaz(ekran, '<span class="term-basari">Ses test sinyalleri gönderildi.</span>');
            } else if (argumanlar[0] === 'ac') {
              this.ses.ayar(true);
              this.yaz(ekran, '<span class="term-basari">Terminal sesleri açıldı.</span>');
            } else if (argumanlar[0] === 'kapat') {
              this.ses.ayar(false);
              this.yaz(ekran, '<span class="term-uyari">Terminal sesleri kapatıldı.</span>');
            } else {
              this.yaz(ekran, `<span class="term-soluk">Ses durumu: <b>${this.ses.aktif ? 'Açık' : 'Kapalı'}</b>. (Kullanım: ses ac | kapat | test)</span>`);
            }
            break;

          case 'history':
          case 'gecmis':
            this.yaz(ekran, this.gecmis.map((cmd, i) => `<span class="term-soluk">${(i + 1).toString().padStart(3, ' ')}</span>  ${this.kacir(cmd)}`).join('<br>'));
            break;

          case 'export':
          case 'indir':
            this.komutExport(ekran);
            break;

          case 'admin':
          case 'yonetici':
          case 'sudo':
            this.komutAdmin(ekran, argumanlar, istemiEl, rozetEl);
            break;

          case 'exit':
          case 'quit':
          case 'kapat':
            this.kapat();
            break;

          default:
            this.ses.hata();
            this.yaz(ekran, `<span class="term-hata">Komut bulunamadı: "${this.kacir(anaKomut)}".</span> <span class="term-soluk">Yardım için <b>yardim</b> yazabilirsiniz.</span>`);
        }
      } catch (err) {
        this.ses.hata();
        this.yaz(ekran, `<span class="term-hata">Hata: ${this.kacir(err && err.message ? err.message : String(err))}</span>`);
      }
    }

    // KOMUT UYGULAMALARI
    komutYardim(ekran, kategori) {
      if (kategori === 'admin' || kategori === 'yonetici') {
        this.yaz(ekran, `
<span class="term-parlak">=== YÖNETİCİ & ROOT KOMUTLARI ===</span>
<span class="term-vurgu">admin giris &lt;kod&gt;</span>    : Yönetici kimlik doğrulaması yapar ve root oturumu açar.
<span class="term-vurgu">admin durum</span>           : Yönetici yetkileri, kanon kilidi ve oturum bilgisi.
<span class="term-vurgu">admin kanon [ac|kapat]</span> : Kanon evren kilitlerini açar/kapatır.
<span class="term-vurgu">admin karantina</span>       : Karantinaya alınan bildirim ve içerikleri listeler.
<span class="term-vurgu">admin yedek</span>           : veri.json yedeğini JSON olarak dışa aktarır/indirir.
<span class="term-vurgu">admin loglar</span>          : Güvenlik, 404 audit ve sistem erişim günlükleri.
<span class="term-vurgu">admin panel</span>           : Görsel yönetici kontrol panelini (#yonetici) açar.
<span class="term-vurgu">admin cikis</span>           : Root oturumunu kapatır ve normal moda döner.
<span class="term-vurgu">sudo &lt;komut&gt;</span>         : Root yetkisiyle doğrudan komut yürütür.
        `);
        return;
      }

      this.yaz(ekran, `
<span class="term-banner">
╔══════════════════════════════════════════════════════════╗
║        TENTİFOR ARŞİV TERMİNALİ (V6.3.13)               ║
║   Tömye Kozmolojisi & Siber Kurtarma Konsolu            ║
╚══════════════════════════════════════════════════════════╝</span>
<span class="term-parlak">⏳ Zaman, Takvim & Yaş:</span>
  <span class="term-vurgu">saat</span>                         : Tömye güncel 26 saatini ve gün ilerlemesini verir.
  <span class="term-vurgu">takvim</span>                       : 28 günlük aylık takvim matrisini çizer.
  <span class="term-vurgu">tarih</span>                        : Dünya ve Tömye döngü koordinatlarını karşılaştırır.
  <span class="term-vurgu">cevir &lt;YYYY-AA-GG&gt;</span>           : Dünya tarihini Tömye gün/ay/yılına çevirir.
  <span class="term-vurgu">yas &lt;sayi&gt; [-tomyeden]</span>       : Dünya ile Tömye arasındaki yaş hesabını yapar.

<span class="term-parlak">📜 Kyldo Dili, Ses & İsim:</span>
  <span class="term-vurgu">isim &lt;kelime&gt;</span>                : Ses çifti ve Kyldo morfolojisiyle isim üretir.
  <span class="term-vurgu">kyldo &lt;metin&gt;</span>                : Metni kadim Kyldo yazı ve fonetiğine kodlar.
  <span class="term-vurgu">sesler</span>                       : Kanon ses çiftleri tablosunu döker (b↔p, c↔ç, d↔t...).
  <span class="term-vurgu">oneri [karakter|sehir|ay]</span>    : Rastgele Tentiforverse isim adayları üretir.
  <span class="term-vurgu">sozluk [kelime]</span>              : Kadim arşiv kavramlarını ve sözlük maddelerini açıklar.

<span class="term-parlak">📚 Tömye Edebiyatı & Arşiv:</span>
  <span class="term-vurgu">roman</span> [liste|son|oku &lt;no&gt;]   : Tömye roman bölümlerini listeler ve okur.
  <span class="term-vurgu">fankitap</span> [liste|koru|oku]    : Topluluk fan hikâyeleri ve korunan evrenler.
  <span class="term-vurgu">hikaye</span> [liste|oku &lt;no&gt;]      : Gece Vardiyası kısa öykülerini açar.
  <span class="term-vurgu">alinti</span>                       : Arşivden rastgele edebi alıntı getirir.
  <span class="term-vurgu">ara &lt;terim&gt;</span>                  : Tüm sitede ve evrenlerde arama yapar.

<span class="term-parlak">🗺️ Kozmoloji & Boyutlar:</span>
  <span class="term-vurgu">evren</span> [list|bilgi|git]       : Kanon ve topluluk evrenlerini listeler/açar.
  <span class="term-vurgu">katmanlar</span> / <span class="term-vurgu">buzul</span>            : Tömye'nin 7 donmuş kozmik katmanını listeler.
  <span class="term-vurgu">harita</span> [yerler|ara]          : Tömye kıtaları, şehirleri ve koordinatları.
  <span class="term-vurgu">anomali</span> / <span class="term-vurgu">delilik</span>         : Boyut çatlak stabilitesi ve delilik katsayısı.
  <span class="term-vurgu">kanon</span> [durum|evrenler]       : Kanon evren kilitleri ve yan boyut dengesi.
  <span class="term-vurgu">somdo</span>                        : Claude tarafından tasarlanan Şomdo model evreni.
  <span class="term-vurgu">yankilar</span>                     : Evrenler arası yankı ve kırılma kayıtları.

<span class="term-parlak">👥 Karakterler & Arşivciler:</span>
  <span class="term-vurgu">karakter</span> [list|bilgi]        : Karakter kütüklerini inceler.
  <span class="term-vurgu">necale</span>                       : Baş Arşivci ve Kütüphane Bekçisi'nin notları.
  <span class="term-vurgu">girilar</span>                      : Kitapları yakan isyancılar ve manifestoları.
  <span class="term-vurgu">ozan</span>                         : Buzul gezgini ve yankı arayıcısı.
  <span class="term-vurgu">eylul</span>                        : Kyldo yazıtlarını çözen dilbilimci.
  <span class="term-vurgu">baglar</span> [karakter]            : Karakterler arası bağ ve ilişki haritası.

<span class="term-parlak">🎮 Oyunlar, Etkileşim & Cüzdan:</span>
  <span class="term-vurgu">bulmaca</span>                      : Günün interaktif Tömye bilgi bulmacası.
  <span class="term-vurgu">oyun</span> [1|2|3|basla]           : "Kütüphane Labirenti: Kayıp Defter" RPG macerası.
  <span class="term-vurgu">zar [yuz]</span>                    : Tömye zarı atar (varsayılan d25 veya d28).
  <span class="term-vurgu">gorevler</span>                     : Günlük okur keşif ve kütüphane görevleri.
  <span class="term-vurgu">liderlik</span>                     : Arşivci sıralaması ve puan tablosu.
  <span class="term-vurgu">rozetler</span>                     : Okur keşif başarımları ve unvanları.
  <span class="term-vurgu">cuzdan</span>                       : Akçe / ECKA bakiyesi ve arşiv dükkânı.
  <span class="term-vurgu">defter</span>                       : Cihazınızdaki yerel okur defteri ve vurgular.
  <span class="term-vurgu">kod &lt;sifre&gt;</span>                  : Terminalden gizli arşiv kilitlerini açar.
  <span class="term-vurgu">muzik</span> [liste|cal|dur]        : Web Audio Tömye synthesizer retro ezgileri.

<span class="term-parlak">🧭 404 & Kurtarma Konsolu:</span>
  <span class="term-vurgu">404</span>                          : Bulunulan sayfanın 404 analiz raporu.
  <span class="term-vurgu">kurtar</span> [hedef]               : Kayıp rotayı en yakın geçerli arşive bağlar.
  <span class="term-vurgu">rotalar</span>                      : Geçerli tüm sistem rotalarını listeler.
  <span class="term-vurgu">git &lt;sayfa&gt;</span>                  : Doğrudan sayfaya geçiş yapar (git okuma, git sen...).

<span class="term-parlak">📁 Dosya Sistemi (VFS):</span>
  <span class="term-vurgu">ls</span> [yol] / <span class="term-vurgu">cd</span> / <span class="term-vurgu">cat</span> / <span class="term-vurgu">tree</span> / <span class="term-vurgu">find</span> : Sanal Tömye kütüphane arşivinde gezinme.

<span class="term-parlak">⚙️ Sistem & Tercihler:</span>
  <span class="term-vurgu">yardim</span> [kat]                 : Yardım rehberi (örn: yardim admin).
  <span class="term-vurgu">temizle</span>                      : Terminal ekranını temizler.
  <span class="term-vurgu">surum</span>                        : Tömye Arşiv Çekirdeği sürüm bilgisi.
  <span class="term-vurgu">whoami</span>                       : Aktif arşivci profili ve oturum durumu.
  <span class="term-vurgu">ps</span>                           : Tömye arşiv arka plan katman ve süreçleri.
  <span class="term-vurgu">tema &lt;ad&gt;</span>                    : tentifor, amber, cyber, dracula, mono.
  <span class="term-vurgu">crt</span> [ac|kapat]               : Retro CRT tarama çizgisi efekti.
  <span class="term-vurgu">ses</span> [ac|kapat|test]          : Web Audio terminal seslerini ayarlar.
  <span class="term-vurgu">export</span>                       : Terminal oturum günlüğünü indirir.
  <span class="term-vurgu">admin [giris]</span>                : Yönetici özel konsolu (yardim admin).
      `);
    }

    komutTarih(ekran) {
      const simdi = new Date();
      const tomye = tomyeZamani();
      this.yaz(ekran, `
<span class="term-parlak">--- ZAMAN DÖNGÜSÜ KOORDİNATLARI ---</span>
<span class="term-vurgu">Dünya (UTC/TR):</span> ${simdi.toISOString().replace('T', ' ').slice(0, 19)}
<span class="term-vurgu">Tömye Yılı    :</span> ${tomye.yil}
<span class="term-vurgu">Tömye Ayı     :</span> ${tomye.gun}. ${tomye.ay} (28 günlük döngü)
<span class="term-vurgu">Tömye Saati   :</span> ${String(tomye.saat).padStart(2, '0')}:${String(tomye.dakika).padStart(2, '0')} (Günde 26 saat)
<span class="term-soluk">Kozmolojik Not: Tömye'nin gökyüzünde ay yoktur, aylar buzul erime periyoduna göre çekilir.</span>
      `);
    }

    komutSurum(ekran) {
      const sw = typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller ? 'AKTİF (Offline Ready)' : 'STANDBY';
      this.yaz(ekran, `
<span class="term-parlak">Tömye Arşiv Çekirdeği:</span> Tentifor-MicroV6 (Build 6.3.13)
<span class="term-vurgu">Kozmoloji    :</span> 24. Evren · Tömye (Aysız Gezegen / 28 Günlük Takvim)
<span class="term-vurgu">Epok Yılı    :</span> 744 Tömye Yılı (Dünya: 2026.10)
<span class="term-vurgu">Platform     :</span> Web PWA / Capacitor Shell Native
<span class="term-vurgu">PWA Motoru   :</span> ${sw}
<span class="term-vurgu">Kanon Kilit  :</span> Koruma Devrede (Kütüphane Muhafızı: Necale)
<span class="term-vurgu">Arşiv Hash   :</span> 02be92c9367b
<span class="term-vurgu">Depolama     :</span> LocalStorage + IndexedDB Offline Sync
      `);
    }

    komutWhoami(ekran) {
      const hesapKullanici = typeof window !== 'undefined' ? window.hesapKullanici : null;
      const isAdmin = this.adminOturumu;
      const kullaniciAdi = hesapKullanici ? `@${hesapKullanici.kullanici_adi || hesapKullanici.id}` : 'misafir_arsivci';
      const rol = isAdmin ? 'Tam Yetkili Yönetici (ROOT)' : hesapKullanici ? 'Kayıtlı Okur' : 'Anonim Gezgin';

      let cuzdan = '—';
      try {
        if (typeof window !== 'undefined' && typeof window.cuzdanBakiye === 'function') {
          cuzdan = `${window.cuzdanBakiye()} Akçe`;
        }
      } catch {}

      this.yaz(ekran, `
<span class="term-parlak">Kullanıcı  :</span> <span class="term-vurgu">${kullaniciAdi}</span>
<span class="term-parlak">Yetki Rolü :</span> ${rol}
<span class="term-parlak">Cüzdan     :</span> ${cuzdan}
<span class="term-parlak">Oturum     :</span> ${isAdmin ? '<span class="term-basari">ROOT TERMINAL SESSION</span>' : 'Standard Visitor'}
      `);
    }

    komutLs(ekran, hedefYol) {
      const yol = this.cozYol(hedefYol || this.dizin);
      const liste = SANAL_DIZINLER[yol];

      if (!liste) {
        this.ses.hata();
        this.yaz(ekran, `<span class="term-hata">Dizin bulunamadı: ${this.kacir(yol)}</span>`);
        return;
      }

      const ciktilar = liste.map((oge) => {
        const tamYol = yol === '/' ? `/${oge}` : `${yol}/${oge}`;
        const isDir = Boolean(SANAL_DIZINLER[tamYol]);
        if (isDir) {
          return `<span class="term-yol">📁 ${oge}/</span>`;
        }
        return `<span class="term-soluk">📄 ${oge}</span>`;
      });

      this.yaz(ekran, `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;margin:4px 0;">${ciktilar.join('')}</div>`);
    }

    komutCd(ekran, hedefYol, istemiEl) {
      if (!hedefYol || hedefYol === '~') {
        this.dizin = '/';
        if (istemiEl) istemiEl.innerHTML = this.istemiMetni();
        return;
      }

      if (hedefYol === '..') {
        if (this.dizin !== '/') {
          const parcalar = this.dizin.split('/').filter(Boolean);
          parcalar.pop();
          this.dizin = parcalar.length ? `/${parcalar.join('/')}` : '/';
        }
        if (istemiEl) istemiEl.innerHTML = this.istemiMetni();
        return;
      }

      const yeniYol = this.cozYol(hedefYol);
      if (SANAL_DIZINLER[yeniYol]) {
        this.dizin = yeniYol;
        if (istemiEl) istemiEl.innerHTML = this.istemiMetni();
        this.ses.onay();
      } else {
        this.ses.hata();
        this.yaz(ekran, `<span class="term-hata">Böyle bir dizin yok: ${this.kacir(hedefYol)}</span>`);
      }
    }

    komutCat(ekran, dosyaAdi) {
      if (!dosyaAdi) {
        this.yaz(ekran, '<span class="term-soluk">Kullanım: cat &lt;dosya_adı&gt;</span>');
        return;
      }

      let tamYol = dosyaAdi.startsWith('/') ? dosyaAdi : (this.dizin === '/' ? `/${dosyaAdi}` : `${this.dizin}/${dosyaAdi}`);
      tamYol = pathNormalize(tamYol);

      const icerik = SANAL_DOSYALAR[tamYol];
      if (icerik !== undefined) {
        this.ses.onay();
        this.yaz(ekran, `<div class="term-kod-kutusu" style="background:rgba(255,255,255,0.03);padding:8px;border-radius:4px;border:1px solid var(--term-border);font-size:12px;">${this.kacir(icerik)}</div>`);
      } else {
        this.ses.hata();
        this.yaz(ekran, `<span class="term-hata">Dosya bulunamadı: ${this.kacir(dosyaAdi)}</span>`);
      }
    }

    komutTree(ekran) {
      let agacHtml = '<div class="term-agac">\n<span class="term-vurgu">/</span> (Tentiforverse Sanal Kütüphanesi)\n';
      const rootList = SANAL_DIZINLER['/'] || [];

      rootList.forEach((dizin, i) => {
        const isLastDir = i === rootList.length - 1;
        const dirPrefix = isLastDir ? '└── ' : '├── ';
        agacHtml += `${dirPrefix}<span class="term-yol">${dizin}/</span>\n`;

        const subItems = SANAL_DIZINLER[`/${dizin}`] || [];
        subItems.forEach((sub, j) => {
          const isLastSub = j === subItems.length - 1;
          const subPrefix = isLastDir ? '    ' : '│   ';
          const filePrefix = isLastSub ? '└── ' : '├── ';
          agacHtml += `${subPrefix}${filePrefix}<span class="term-soluk">${sub}</span>\n`;
        });
      });

      agacHtml += '</div>';
      this.yaz(ekran, agacHtml);
    }

    komutFind(ekran, aranan) {
      if (!aranan) {
        this.yaz(ekran, '<span class="term-soluk">Kullanım: find &lt;terim&gt;</span>');
        return;
      }
      const terim = aranan.toLowerCase();
      const bulunanlar = Object.keys(SANAL_DOSYALAR).filter((f) => f.toLowerCase().includes(terim));

      if (bulunanlar.length) {
        this.yaz(ekran, `<span class="term-parlak">Eşleşen Dosyalar (${bulunanlar.length}):</span>\n` +
          bulunanlar.map((b) => `<span class="term-yol">${b}</span>`).join('\n'));
      } else {
        this.yaz(ekran, `<span class="term-soluk">"${this.kacir(aranan)}" ile eşleşen sanal dosya bulunamadı.</span>`);
      }
    }

    komut404(ekran) {
      const aktifHash = typeof location !== 'undefined' ? location.hash : '';
      const aktifYol = typeof location !== 'undefined' ? location.pathname : '';
      const hedef = aktifHash || aktifYol;

      this.yaz(ekran, `
<span class="term-hata">[404 KESİNTİ ANALİZ RAPORU]</span>
<span class="term-vurgu">İstenen Koordinat:</span> ${this.kacir(hedef)}
<span class="term-parlak">Durum            :</span> Bu adres Tömye kanonunda bulunamadı.
<span class="term-soluk">Olasılıklar:</span>
  1. Gırılar bu kütüphane rafını yakmış olabilir.
  2. Dördüncü boyutta baloncuk evrene sapmış olabilirsiniz.
  3. Adres harf hatası taşıyor olabilir.
<span class="term-bilgi">Kurtarma için: <b>kurtar</b> komutunu girin veya <b>rotalar</b> yazın.</span>
      `);
    }

    komutKurtar(ekran, ozelHedef) {
      const ham = ozelHedef || (typeof location !== 'undefined' ? location.hash.replace(/^#\/?/, '') : '');
      const hedef = String(ham).replace(/^\//, '').split('/')[0].toLowerCase();

      const gecerliRotalar = [
        { id: 'arsiv', ad: 'Ana Sayfa & Karakterler' },
        { id: 'tomye', ad: 'Tömye Evreni' },
        { id: 'okuma', ad: 'Okuma Alanı & Roman' },
        { id: 'atolye', ad: 'Evren Kurucu Atölye' },
        { id: 'fan', ad: 'Fan Evrenleri' },
        { id: 'oyunlar', ad: 'Yedi Oyun & Meydan' },
        { id: 'dunya', ad: 'Harita ve Zaman Çizelgesi' },
        { id: 'harita', ad: 'Tömye Haritası' },
        { id: 'roman', ad: 'Roman ve Olaylar' },
        { id: 'araclar', ad: 'İsim Sistemi & Araçlar' },
        { id: 'sen', ad: 'Hesap & Arşivci Kartı' }
      ];

      // En yakın eşleşmeyi bul
      let enIyi = null;
      let minMesafe = 999;

      gecerliRotalar.forEach((r) => {
        const dist = levenshtein(hedef, r.id);
        if (dist < minMesafe) {
          minMesafe = dist;
          enIyi = r;
        }
      });

      this.yaz(ekran, `
<span class="term-parlak">[OTOMATİK SİSTEM KURTARMA]</span>
Hedef: <span class="term-uyari">${this.kacir(hedef || '(boş)')}</span>
${enIyi ? `En yakın olası rota: <span class="term-basari">#/${enIyi.id}</span> (${enIyi.ad})` : ''}

<div style="margin: 8px 0;">
  <button class="term-dugme" onclick="location.hash='#/${enIyi ? enIyi.id : 'arsiv'}'">🚀 Hemen #/${enIyi ? enIyi.id : 'arsiv'} Sayfasına Git</button>
  <button class="term-dugme" onclick="location.hash='#/arsiv'">🏠 Ana Sayfaya Dön</button>
</div>
<span class="term-soluk">Alternatif olarak doğrudan <b>git ${enIyi ? enIyi.id : 'arsiv'}</b> yazabilirsiniz.</span>
      `);
    }

    komutRotalar(ekran) {
      const rotalar = [
        '#/arsiv    -> Karakterler & Genel Arşiv',
        '#/tomye    -> Tömye Evren Kozmolojisi',
        '#/okuma    -> Roman & Gece Vardiyası',
        '#/atolye   -> Evrenini Kur & Atölye',
        '#/fan      -> Topluluk Fan Hikâyeleri',
        '#/oyunlar  -> Yedi Oyun & Arşiv Avı',
        '#/harita   -> İnteraktif Tömye Haritası',
        '#/dunya    -> Zaman Çizelgesi & Takvim',
        '#/araclar  -> İsim Sistemi & Kyldo Yazısı',
        '#/sen      -> Kişisel Arşivci Profili',
        '#/terminal -> Bu Özel Terminal Konsolu'
      ];
      this.yaz(ekran, `<span class="term-parlak">Sistem Rotaları:</span>\n${rotalar.map((r) => `<span class="term-yol">${r}</span>`).join('\n')}`);
    }

    komutGit(ekran, sayfa) {
      if (!sayfa) {
        this.yaz(ekran, '<span class="term-soluk">Kullanım: git &lt;sayfa_adı&gt; (örn: git okuma, git harita, git atolye)</span>');
        return;
      }
      const hedef = sayfa.toLowerCase().replace(/^#\/?/, '');
      if (typeof location !== 'undefined') {
        location.hash = `#/${hedef}`;
        this.ses.onay();
        this.yaz(ekran, `<span class="term-basari">Navigasyon başlatıldı: <b>#/${hedef}</b></span>`);
      }
    }

    komutEvren(ekran, altKomut, parametre) {
      const alt = (altKomut || 'list').toLowerCase();
      const veri = typeof window !== 'undefined' ? window.veri : null;

      if (alt === 'list') {
        const evrenler = (veri && veri.evren) ? veri.evren : [
          { id: 'eterya', baslik: 'Eterya', bolum: 'Model' },
          { id: 'somdo', baslik: 'Şomdo', bolum: 'Claude' },
          { id: 'kul', baslik: 'Kül', bolum: 'Arşiv' },
          { id: 'sis', baslik: 'Sis', bolum: 'Arşiv' },
          { id: 'e25', baslik: 'E-25 Tömye', bolum: 'Kanon' }
        ];

        this.yaz(ekran, `<span class="term-parlak">Yayındaki Evrenler (${evrenler.length}):</span>\n` +
          evrenler.map((e) => `<span class="term-vurgu">• [${e.id || '—'}]</span> <b>${this.kacir(e.baslik || e.ad || 'İsimsiz')}</b> <span class="term-soluk">(${e.bolum || e.tur || 'Evren'})</span>`).join('\n') +
          '\n<span class="term-soluk">Detay için: evren bilgi &lt;id&gt; | Gitmek için: evren git &lt;id&gt;</span>');
      } else if (alt === 'bilgi') {
        if (!parametre) {
          this.yaz(ekran, '<span class="term-soluk">Kullanım: evren bilgi &lt;id&gt;</span>');
          return;
        }
        const aranan = parametre.toLowerCase();
        const evrenler = (veri && veri.evren) ? veri.evren : [];
        const bulunan = evrenler.find((e) => (e.id || '').toLowerCase() === aranan || (e.baslik || '').toLowerCase().includes(aranan));

        if (bulunan) {
          this.yaz(ekran, `
<span class="term-parlak">=== EVREN DETAYI ===</span>
<span class="term-vurgu">ID     :</span> ${bulunan.id}
<span class="term-vurgu">Başlık :</span> ${this.kacir(bulunan.baslik || bulunan.ad)}
<span class="term-vurgu">Bölüm  :</span> ${this.kacir(bulunan.bolum || '—')}
<span class="term-vurgu">Özet   :</span> ${this.kacir(bulunan.ozet || 'Özet bulunmuyor.')}
<span class="term-vurgu">Metin  :</span> ${this.kacir((bulunan.metin || '').slice(0, 200))}...
          `);
        } else {
          this.yaz(ekran, `<span class="term-hata">Evren bulunamadı: ${this.kacir(parametre)}</span>`);
        }
      } else if (alt === 'git') {
        if (!parametre) {
          this.yaz(ekran, '<span class="term-soluk">Kullanım: evren git &lt;id&gt;</span>');
          return;
        }
        if (typeof location !== 'undefined') {
          location.hash = `#/evren/${encodeURIComponent(parametre)}`;
          this.yaz(ekran, `<span class="term-basari">Evrene yönlendiriliyor: ${this.kacir(parametre)}</span>`);
        }
      }
    }

    komutKarakter(ekran, altKomut, parametre) {
      const alt = (altKomut || 'list').toLowerCase();
      const veri = typeof window !== 'undefined' ? window.veri : null;
      const karakterler = (veri && veri.karakterler) ? veri.karakterler : [
        { id: 'necale', ad: 'Necale', unvan: 'Baş Arşivci', ozet: 'Kütüphane bekçisi.' },
        { id: 'ozan', ad: 'Ozan', unvan: 'Gezgin', ozet: 'Buzun altındaki yankıları arar.' }
      ];

      if (alt === 'list') {
        this.yaz(ekran, `<span class="term-parlak">Karakter Arşivi (${karakterler.length}):</span>\n` +
          karakterler.map((k) => `<span class="term-vurgu">• ${this.kacir(k.ad)}</span> <span class="term-soluk">— ${this.kacir(k.unvan || 'Karakter')} [id: ${k.id}]</span>`).join('\n') +
          '\n<span class="term-soluk">Detay için: karakter bilgi &lt;ad/id&gt;</span>');
      } else if (alt === 'bilgi' || alt === 'ara') {
        if (!parametre) {
          this.yaz(ekran, '<span class="term-soluk">Kullanım: karakter bilgi &lt;isim&gt;</span>');
          return;
        }
        const aranan = parametre.toLowerCase();
        const bulunan = karakterler.find((k) => (k.id || '').toLowerCase() === aranan || (k.ad || '').toLowerCase().includes(aranan));

        if (bulunan) {
          this.yaz(ekran, `
<span class="term-parlak">=== KARAKTER DOSYASI ===</span>
<span class="term-vurgu">Ad       :</span> ${this.kacir(bulunan.ad)}
<span class="term-vurgu">Unvan    :</span> ${this.kacir(bulunan.unvan || '—')}
<span class="term-vurgu">Grup     :</span> ${this.kacir(bulunan.grup || '—')}
<span class="term-vurgu">Özet     :</span> ${this.kacir(bulunan.ozet || '—')}
<span class="term-vurgu">Ayrıntı  :</span> ${this.kacir((bulunan.detay || '').slice(0, 240))}...
          `);
        } else {
          this.yaz(ekran, `<span class="term-hata">Karakter bulunamadı: ${this.kacir(parametre)}</span>`);
        }
      }
    }

    komutTakvim(ekran) {
      const tomye = tomyeZamani();
      let cikti = `<span class="term-parlak">TÖMYE TAKVİMİ — Yıl ${tomye.yil}, ${tomye.ay} Ayı</span>\n`;
      cikti += '<span class="term-soluk">Pzt Sal Çar Per Cum Cmt Paz</span>\n';

      for (let g = 1; g <= 28; g++) {
        const isToday = g === tomye.gun;
        const pad = g.toString().padStart(3, ' ');
        if (isToday) {
          cikti += `<span class="term-vurgu">[${g < 10 ? ' ' + g : g}]</span>`;
        } else {
          cikti += `${pad} `;
        }
        if (g % 7 === 0) cikti += '\n';
      }

      cikti += `\n<span class="term-soluk">Bugün döngünün ${tomye.gun}. günüdür. Gün 26 saattir.</span>`;
      this.yaz(ekran, cikti);
    }

    komutIsim(ekran, kelime) {
      if (!kelime) {
        this.yaz(ekran, '<span class="term-soluk">Kullanım: isim &lt;kelime&gt; (örn: isim çatlak, isim yankı)</span>');
        return;
      }
      const sonuclar = kyldoIsim(kelime);
      this.yaz(ekran, `
<span class="term-parlak">Kyldo İsim Üretim Matrisi: "${this.kacir(kelime)}"</span>
${sonuclar.map((s) => `<span class="term-vurgu">• ${s.yol.padEnd(24, ' ')}:</span> <b>${s.ad}</b>`).join('\n')}
      `);
    }

    komutAlinti(ekran) {
      const alintilar = [
        '“Kütüphanenin en tehlikeli yeri, henüz okunmamış kitapların bulunduğu raf değil; yarım bırakılmış defterlerdir.” — Necale',
        '“Gökyüzünde ay yoksa, yönünü denizin üzerinde donan buz çatlaklarına bakarak bulursun.” — Ozan',
        '“Tömye unutmaz. Sadece bazen hatırlamak için kışın bitmesini bekler.”',
        '“Gırılar her şeyi yaktığını sandı; oysa küller en sağlam şifreleme yöntemidir.”',
        '“26 saatlik bir günde 2 saat fazlan vardır. O iki saatte ne yaptığın evrenini belirler.”'
      ];
      const secilen = alintilar[Math.floor(Math.random() * alintilar.length)];
      this.yaz(ekran, `<span class="term-uyari" style="font-style:italic;">${this.kacir(secilen)}</span>`);
    }

    komutAra(ekran, terim) {
      if (!terim) {
        this.yaz(ekran, '<span class="term-soluk">Kullanım: ara &lt;kelime&gt;</span>');
        return;
      }
      const t = terim.toLowerCase();
      const veri = typeof window !== 'undefined' ? window.veri : null;
      const sonuclar = [];

      if (veri) {
        (veri.karakterler || []).forEach((k) => {
          if ((k.ad && k.ad.toLowerCase().includes(t)) || (k.ozet && k.ozet.toLowerCase().includes(t))) {
            sonuclar.push(`[Karakter] ${k.ad} — ${k.unvan || ''}`);
          }
        });
        (veri.evren || []).forEach((e) => {
          if ((e.baslik && e.baslik.toLowerCase().includes(t)) || (e.ozet && e.ozet.toLowerCase().includes(t))) {
            sonuclar.push(`[Evren] ${e.baslik} — ${e.bolum || ''}`);
          }
        });
      }

      if (sonuclar.length) {
        this.yaz(ekran, `<span class="term-parlak">Bulunan Kayıtlar (${sonuclar.length}):</span>\n` +
          sonuclar.slice(0, 10).map((s) => `<span class="term-vurgu">•</span> ${this.kacir(s)}`).join('\n'));
      } else {
        this.yaz(ekran, `<span class="term-soluk">"${this.kacir(terim)}" ile ilgili sonuç bulunamadı.</span>`);
      }
    }

    komutRoman(ekran, altKomut, parametre) {
      const alt = (altKomut || 'liste').toLowerCase();
      const veri = typeof window !== 'undefined' ? window.veri : null;
      const roman = (veri && veri.roman) ? veri.roman : null;
      const bolumler = (roman && Array.isArray(roman.bolumler)) ? roman.bolumler : [];

      if (alt === 'liste') {
        let cikti = `<span class="term-parlak">📖 TÖMYE ROMANI: "${this.kacir((roman && roman.baslik) || 'Tömye')}"</span>\n`;
        if (roman && roman.altbaslik) cikti += `<span class="term-soluk">${this.kacir(roman.altbaslik)}</span>\n`;
        cikti += `<span class="term-vurgu">Mevcut Bölümler (${bolumler.length || 4}):</span>\n`;

        if (bolumler.length) {
          cikti += bolumler.map((b, i) => {
            const no = b.no || (i + 1);
            const baslik = b.baslik || `Bölüm ${no}`;
            return `<span class="term-vurgu">• [Bölüm ${no}]</span> <b>${this.kacir(baslik)}</b> <span class="term-soluk">(${b.kelimeSayisi || (b.metin ? b.metin.length : 1200)} karakter)</span>`;
          }).join('\n');
        } else {
          cikti += `• [Bölüm 1] Buzun Üstündeki Fenerler\n• [Bölüm 2] Yanmış Raflar Arasında\n• [Bölüm 3] Dördüncü Çatlak\n• [Bölüm 4] Kütüphanenin Çekirdeği`;
        }
        cikti += '\n<span class="term-soluk">Okumak için: <b>roman oku &lt;no&gt;</b> | Son bölüm için: <b>roman son</b> | Özet için: <b>roman ozet</b></span>';
        this.yaz(ekran, cikti);
      } else if (alt === 'son') {
        const sonBolum = bolumler.length ? bolumler[bolumler.length - 1] : { no: 4, baslik: 'Kütüphanenin Çekirdeği', metin: 'Necale son sayfayı kapattı. Buzun altındaki yankı nihayet susmuştu.' };
        this.yaz(ekran, `
<span class="term-parlak">=== EN SON YAYINLANAN BÖLÜM: [Bölüm ${sonBolum.no || bolumler.length}] ===</span>
<span class="term-vurgu">Başlık:</span> <b>${this.kacir(sonBolum.baslik || 'Son Bölüm')}</b>
<div class="term-kod-kutusu" style="margin:6px 0;padding:8px;background:rgba(255,255,255,0.03);border:1px solid var(--term-border);font-size:12px;max-height:160px;overflow-y:auto;">
${this.kacir((sonBolum.metin || sonBolum.ozet || 'Bölüm içeriği arşivde hazır.').slice(0, 500))}...
</div>
<span class="term-soluk">Tamamı okuma modunda: <b>git okuma</b></span>
        `);
      } else if (alt === 'oku') {
        const no = parseInt(parametre, 10) || 1;
        const bolum = bolumler.find((b, i) => (b.no === no || (i + 1) === no)) || (bolumler[no - 1]);
        if (bolum) {
          this.yaz(ekran, `
<span class="term-parlak">=== BÖLÜM ${no}: ${this.kacir(bolum.baslik || '')} ===</span>
<div class="term-kod-kutusu" style="margin:6px 0;padding:8px;background:rgba(255,255,255,0.03);border:1px solid var(--term-border);font-size:12px;max-height:220px;overflow-y:auto;">
${this.kacir(bolum.metin || bolum.ozet || 'Bölüm metni yükleniyor...')}
</div>
<span class="term-bilgi">Okuma paneline gitmek için: <b>git okuma</b></span>
          `);
        } else {
          this.yaz(ekran, `<span class="term-hata">Bölüm ${no} bulunamadı. Mevcut bölümler için: <b>roman liste</b></span>`);
        }
      } else if (alt === 'ozet') {
        this.yaz(ekran, `
<span class="term-parlak">TÖMYE ROMANI HAKKINDA:</span>
${this.kacir((roman && roman.giris) || 'Tömye Kütüphanesi\'nin sekizinci görevlisinin hikâyesi. Gece ve gündüz arasındaki ince çizgide, hafıza ve buzul katmanlarının çözülüşü.')}
        `);
      }
    }

    komutHarita(ekran, altKomut, parametre) {
      const alt = (altKomut || 'yerler').toLowerCase();
      const veri = typeof window !== 'undefined' ? window.veri : null;
      const haritalar = (veri && Array.isArray(veri.haritalar)) ? veri.haritalar : [];
      const tomyeHarita = haritalar.find((h) => h.id === 'tomye') || haritalar[0] || {};
      const yerler = Array.isArray(tomyeHarita.yerler) ? tomyeHarita.yerler : [];

      if (alt === 'yerler' || alt === 'liste') {
        let cikti = `<span class="term-parlak">🗺️ TÖMYE HARİTASI — BÖLGELER & YERLEŞİMLER (${yerler.length}):</span>\n`;
        cikti += yerler.slice(0, 15).map((y) => {
          const ad = y.ad || y.baslik || 'Bilinmeyen Yer';
          const tur = y.tur || y.tip || 'Bölge';
          const koordinat = (y.x !== undefined && y.y !== undefined) ? `[X:${y.x}, Y:${y.y}]` : '';
          return `<span class="term-vurgu">• ${this.kacir(ad)}</span> <span class="term-soluk">(${tur}) ${koordinat}</span>`;
        }).join('\n');
        cikti += '\n<span class="term-soluk">Detaylı arama için: <b>harita ara &lt;ad&gt;</b> | İnteraktif harita: <b>git harita</b></span>';
        this.yaz(ekran, cikti);
      } else if (alt === 'ara') {
        if (!parametre) {
          this.yaz(ekran, '<span class="term-soluk">Kullanım: harita ara &lt;yer_adı&gt;</span>');
          return;
        }
        const aranan = parametre.toLowerCase();
        const bulunan = yerler.find((y) => (y.ad || '').toLowerCase().includes(aranan) || (y.id || '').toLowerCase().includes(aranan));
        if (bulunan) {
          this.yaz(ekran, `
<span class="term-parlak">=== HARİTA LOKASYON KAYDI ===</span>
<span class="term-vurgu">Ad         :</span> <b>${this.kacir(bulunan.ad || bulunan.id)}</b>
<span class="term-vurgu">Tür        :</span> ${this.kacir(bulunan.tur || 'Bölge')}
<span class="term-vurgu">Koordinat  :</span> X: ${bulunan.x || 0}, Y: ${bulunan.y || 0}
<span class="term-vurgu">Açıklama   :</span> ${this.kacir(bulunan.aciklama || bulunan.ozet || 'Özel koordinat açıklaması bulunmuyor.')}
          `);
        } else {
          this.yaz(ekran, `<span class="term-hata">Haritada "${this.kacir(parametre)}" lokasyonu bulunamadı.</span>`);
        }
      } else {
        this.yaz(ekran, '<span class="term-soluk">Kullanım: harita yerler | harita ara &lt;ad&gt;</span>');
      }
    }

    komutSozluk(ekran, terim) {
      const veri = typeof window !== 'undefined' ? window.veri : null;
      const sozlukListesi = (veri && Array.isArray(veri.sozluk)) ? veri.sozluk : [];

      if (!terim) {
        let cikti = `<span class="term-parlak">📚 TÖMYE KADİM SÖZLÜĞÜ (${sozlukListesi.length} Madde):</span>\n`;
        const ornekler = sozlukListesi.slice(0, 10);
        if (ornekler.length) {
          cikti += ornekler.map((s) => `<span class="term-vurgu">• ${this.kacir(s.kelime || s.ad)}</span>: <span class="term-soluk">${this.kacir((s.anlam || s.aciklama || '').slice(0, 60))}...</span>`).join('\n');
        } else {
          cikti += `• Gırılar: Kitapları yakan isyancılar\n• Kyldo: Kadim ters alfabe ve dil\n• Akçe: Arşiv içi para birimi\n• Yankı: Evrenler arası kırılma\n• Buzul: Kozmik hafıza katmanı`;
        }
        cikti += '\n<span class="term-soluk">Detay için: <b>sozluk &lt;kelime&gt;</b> (örn: sozluk kyldo, sozluk akce)</span>';
        this.yaz(ekran, cikti);
        return;
      }

      const aranan = terim.toLowerCase().trim();
      const bulunan = sozlukListesi.find((s) => (s.kelime || s.ad || '').toLowerCase() === aranan || (s.kelime || s.ad || '').toLowerCase().includes(aranan));

      if (bulunan) {
        this.yaz(ekran, `
<span class="term-parlak">=== SÖZLÜK MADDESİ ===</span>
<span class="term-vurgu">Kavram :</span> <b>${this.kacir(bulunan.kelime || bulunan.ad)}</b>
<span class="term-vurgu">Köken  :</span> ${this.kacir(bulunan.koken || 'Kadim Tömye Dili')}
<span class="term-vurgu">Anlam  :</span> ${this.kacir(bulunan.anlam || bulunan.aciklama || '')}
        `);
      } else {
        this.yaz(ekran, `<span class="term-hata">"${this.kacir(terim)}" kavramı sözlükte bulunamadı.</span>`);
      }
    }

    komutKyldo(ekran, metin) {
      if (!metin) {
        this.yaz(ekran, `
<span class="term-parlak">=== KYLDO DİL & SES DÖNÜŞÜM MOTORU ===</span>
<span class="term-vurgu">Kural:</span> Kelime tersten yazılır ve sesli harfler kaydırılır (a→e, e→i, i→o, o→u, u→a).
<span class="term-soluk">Kullanım: kyldo &lt;metin&gt; (örn: kyldo Tentifor, kyldo Kütüphane)</span>
        `);
        return;
      }
      const donusum = kyldoIsim(metin);
      this.yaz(ekran, `
<span class="term-parlak">Kyldo Kodlama Çıktısı: "${this.kacir(metin)}"</span>
${donusum.map((d) => `<span class="term-vurgu">• ${d.yol}:</span> <b>${d.ad}</b>`).join('\n')}
<span class="term-soluk">Fonetik Okunuş: [${this.kacir(donusum[2] ? donusum[2].ad : '')}]</span>
      `);
    }

    komutBaglar(ekran, karakter) {
      const baglar = [
        { kaynak: 'Necale', hedef: 'Ozan', tur: 'Yoldaşlık & Arşiv Rehberi' },
        { kaynak: 'Necale', hedef: 'Gırılar', tur: 'Kadim Düşmanlık & Koruma' },
        { kaynak: 'Ozan', hedef: 'Buzul Katmanları', tur: 'Arayış & Kâşif' },
        { kaynak: 'Eylül', hedef: 'Necale', tur: 'Kyldo Yazıt Çözücüsü' },
        { kaynak: 'Kemal', hedef: 'Kanon Kilitleri', tur: 'Muhafızlık' },
        { kaynak: 'Berk', hedef: 'Baloncuk Evrenler', tur: 'Boyut Analisti' }
      ];

      if (karakter) {
        const aranan = karakter.toLowerCase();
        const filtrelenmis = baglar.filter((b) => b.kaynak.toLowerCase().includes(aranan) || b.hedef.toLowerCase().includes(aranan));
        if (filtrelenmis.length) {
          this.yaz(ekran, `<span class="term-parlak">"${this.kacir(karakter)}" İle İlgili Bağlar:</span>\n` +
            filtrelenmis.map((b) => `<span class="term-vurgu">• ${b.kaynak} ⟷ ${b.hedef}:</span> ${b.tur}`).join('\n'));
        } else {
          this.yaz(ekran, `<span class="term-soluk">"${this.kacir(karakter)}" için kayıtlı bağ bulunamadı.</span>`);
        }
        return;
      }

      this.yaz(ekran, `
<span class="term-parlak">🕸️ KARAKTER & EVREN İLİŞKİ AĞI:</span>
${baglar.map((b) => `<span class="term-vurgu">• ${b.kaynak.padEnd(8, ' ')} ──[${b.tur}]──&gt; ${b.hedef}</span>`).join('\n')}
<span class="term-soluk">Belirli bir karakter için: <b>baglar &lt;isim&gt;</b></span>
      `);
    }

    komutLiderlik(ekran) {
      const liderler = [
        { sira: 1, ad: '@necale_bekcisi', unvan: 'Kıdemli Arşivci', puan: 9400, rozet: '👑' },
        { sira: 2, ad: '@buz_avcisi', unvan: 'Buzul Kâşifi', puan: 8120, rozet: '❄️' },
        { sira: 3, ad: '@yankilar_ustasi', unvan: 'Kyldo Dilbilgini', puan: 7550, rozet: '📜' },
        { sira: 4, ad: '@dunya_gozlemcisi', unvan: 'Okur', puan: 6900, rozet: '📖' },
        { sira: 5, ad: '@tentifor_yolcusu', unvan: 'Çırak', puan: 5400, rozet: '✨' }
      ];

      this.yaz(ekran, `
<span class="term-parlak">🏆 TENTİFOR ARŞİVİ GENEL LİDERLİK SIRALAMASI:</span>
${liderler.map((l) => `<span class="term-vurgu">#${l.sira}</span> ${l.rozet} <b>${l.ad.padEnd(20, ' ')}</b> <span class="term-soluk">${l.unvan.padEnd(18, ' ')}</span> <span class="term-basari">${l.puan} Puan</span>`).join('\n')}
<span class="term-soluk">Sıralamada yükselmek için bölümleri okuyun ve bulmacaları çözün.</span>
      `);
    }

    komutRozetler(ekran) {
      const rozetler = [
        { id: 'buzul', ad: 'Buzul Kâşifi', durum: 'KAZANILDI', ikon: '❄️', aciklama: 'Tömye buzul katmanlarını inceleyenlere verilir.' },
        { id: 'kanon', ad: 'Kanon Muhafızı', durum: 'KAZANILDI', ikon: '🛡️', aciklama: 'Kanon sırlarını koruyan okurlar.' },
        { id: 'kyldo', ad: 'Kyldo Dilbilgini', durum: 'KİLİTLİ', ikon: '📜', aciklama: 'İsim sisteminde 5 kod çözenlere verilir.' },
        { id: 'gece', ad: 'Gece Okuru', durum: 'KAZANILDI', ikon: '🌙', aciklama: 'Gece Vardiyası serisini tamamlayanlara verilir.' },
        { id: 'firtina', ad: 'Fırtına Tanığı', durum: 'KİLİTLİ', ikon: '⚡', aciklama: 'Anomali ve çatlak seviyesini ölçenlere verilir.' }
      ];

      this.yaz(ekran, `
<span class="term-parlak">🎖️ KAZANILAN & KİLİTLİ OKUR ROZETLERİ:</span>
${rozetler.map((r) => {
  const durumStil = r.durum === 'KAZANILDI' ? '<span class="term-basari">[KAZANILDI]</span>' : '<span class="term-soluk">[KİLİTLİ]</span>';
  return `${r.ikon} <b>${r.ad}</b> ${durumStil}\n   <span class="term-soluk">${r.aciklama}</span>`;
}).join('\n')}
      `);
    }

    komutCuzdan(ekran, altKomut) {
      const alt = (altKomut || 'bakiye').toLowerCase();
      let bakiye = 250;
      try {
        if (typeof window !== 'undefined' && typeof window.cuzdanBakiye === 'function') {
          bakiye = window.cuzdanBakiye();
        } else {
          const kayitli = localStorage.getItem('tentifor_cuzdan_akce');
          if (kayitli) bakiye = parseInt(kayitli, 10);
        }
      } catch {}

      if (alt === 'hediye') {
        const sonAlim = localStorage.getItem('tentifor_gunluk_akce_tarih');
        const bugun = new Date().toISOString().slice(0, 10);
        if (sonAlim === bugun) {
          this.yaz(ekran, '<span class="term-uyari">Bugünkü günlük arşiv akçenizi zaten aldınız. Yarın tekrar gelin!</span>');
        } else {
          bakiye += 50;
          localStorage.setItem('tentifor_gunluk_akce_tarih', bugun);
          localStorage.setItem('tentifor_cuzdan_akce', String(bakiye));
          this.ses.zil();
          this.yaz(ekran, `<span class="term-basari">🎉 Tebrikler! Günlük 50 Akçe hesabınıza eklendi. Yeni bakiye: <b>${bakiye} Akçe</b></span>`);
        }
        return;
      }

      this.yaz(ekran, `
<span class="term-parlak">💰 TENTİFOR ARŞİV CÜZDANI:</span>
<span class="term-vurgu">Mevcut Bakiye :</span> <span class="term-basari"><b>${bakiye} Akçe</b></span>
<span class="term-vurgu">Son İşlem    :</span> Bölüm okuma ödülü (+20 Akçe)
<span class="term-soluk">Günlük hediyenizi almak için: <b>cuzdan hediye</b></span>
      `);
    }

    komutYankilar(ekran) {
      const veri = typeof window !== 'undefined' ? window.veri : null;
      const yankilar = (veri && Array.isArray(veri.yankilar)) ? veri.yankilar : [
        { no: 'Y-01', baslik: 'Kırağı Yankısı', metin: 'Buzun altından gelen düzenli vuruş sesleri.' },
        { no: 'Y-02', baslik: 'Yanmış Sayfa Yankısı', metin: 'Kütüphanenin 5. katmanından yükselen kül kokusu.' },
        { no: 'Y-03', baslik: 'Dördüncü Çatlak', metin: 'Zamanın 26 saatlik düzlemde 2 saat kayması.' }
      ];

      this.yaz(ekran, `
<span class="term-parlak">⚡ BOYUTLARARASI ZAMAN VE ANOMALİ YANKILARI:</span>
${yankilar.map((y) => `<span class="term-vurgu">• [${y.no || 'Y'}] ${this.kacir(y.baslik || 'Yankı')}:</span> <span class="term-soluk">${this.kacir(y.metin || y.aciklama || '')}</span>`).join('\n')}
      `);
    }

    komutBulmaca(ekran, altKomut, parametre) {
      const alt = (altKomut || 'soru').toLowerCase();
      const sorular = [
        { id: 1, soru: "Tömye kütüphanesini ateşe veren kadim isyancı birliğin adı nedir?", cevap: "gırılar", ipucu: "G ile başlar, iki hecelidir." },
        { id: 2, soru: "Tömye gezegeninde bir gün kaç saattir?", cevap: "26", ipucu: "Dünya gününden 2 saat fazladır." },
        { id: 3, soru: "Kadim Tömye alfabesinin ve dilinin adı nedir?", cevap: "kyldo", ipucu: "K ile başlar, beş harflidir." },
        { id: 4, soru: "Kütüphane bekçisi ve baş arşivcinin adı nedir?", cevap: "necale", ipucu: "N ile başlar." }
      ];

      if (alt === 'cevap') {
        if (!this.aktifBulmaca) {
          this.yaz(ekran, '<span class="term-soluk">Önce bir bulmaca açmalısınız: <b>bulmaca</b></span>');
          return;
        }
        const tahmin = (parametre || '').toLowerCase().trim();
        if (tahmin === this.aktifBulmaca.cevap.toLowerCase()) {
          this.ses.zil();
          this.yaz(ekran, `<span class="term-basari">🎉 DOĞRU CEVAP! Harika bir Tömye arşivcisisiniz. (+25 Akçe kazanıldı!)</span>`);
          this.aktifBulmaca = null;
        } else {
          this.ses.hata();
          this.yaz(ekran, `<span class="term-hata">Yanlış cevap.</span> <span class="term-soluk">İpucu: ${this.aktifBulmaca.ipucu}</span>`);
        }
        return;
      }

      const secilen = sorular[Math.floor(Math.random() * sorular.length)];
      this.aktifBulmaca = secilen;
      this.yaz(ekran, `
<span class="term-parlak">🧩 GÜNLÜK TÖMYE BİLGİ BULMACASI:</span>
<span class="term-vurgu">Soru:</span> <b>${secilen.soru}</b>
<span class="term-soluk">Cevaplamak için: <b>bulmaca cevap &lt;tahmininiz&gt;</b></span>
      `);
    }

    komutBuzul(ekran, altKomut, parametre) {
      const katmanlar = [
        { sira: 1, ad: 'Yüzey Kırağısı', durum: 'AÇIK', derinlik: '0 - 50m' },
        { sira: 2, ad: 'Kyldo Yazıtları', durum: 'AÇIK', derinlik: '50 - 200m' },
        { sira: 3, ad: 'Yankı Havuzları', durum: 'AÇIK', derinlik: '200 - 500m' },
        { sira: 4, ad: 'Baloncuk Evrenler', durum: 'ERİYOR', derinlik: '500 - 1200m' },
        { sira: 5, ad: 'Yanmış Kitaplık', durum: 'KİLİTLİ', derinlik: '1200 - 2500m' },
        { sira: 6, ad: 'Dördüncü Çatlak', durum: 'KİLİTLİ', derinlik: '2500 - 5000m' },
        { sira: 7, ad: 'Kanon Çekirdeği', durum: 'MUTLAK KİLİT', derinlik: '5000m+' }
      ];

      this.yaz(ekran, `
<span class="term-parlak">❄️ TÖMYE'NİN 7 DONMUŞ KOZMİK KATMANI:</span>
${katmanlar.map((k) => {
  const renk = k.durum === 'AÇIK' ? 'term-basari' : k.durum === 'ERİYOR' ? 'term-uyari' : 'term-soluk';
  return `<span class="term-vurgu">[${k.sira}. Katman]</span> <b>${k.ad.padEnd(20, ' ')}</b> <span class="term-soluk">${k.derinlik.padEnd(14, ' ')}</span> <span class="${renk}">[${k.durum}]</span>`;
}).join('\n')}
<span class="term-soluk">Kilitli katmanları çözmek için yönetici yetkisi veya gizli anahtarlar gereklidir.</span>
      `);
    }

    komutHikaye(ekran, altKomut) {
      const oykuler = [
        { no: 1, baslik: 'Gece Vardiyası — Giriş', ozet: 'Saat 24:00 olduğunda ve kütüphane kapandığında, raflardaki harfler kendi yerlerini değiştirmeye başlar.' },
        { no: 2, baslik: 'Kayıp Görevli', ozet: 'Dokuzuncu görevli nöbet tutarken aynada kendi yansımasını göremedi.' },
        { no: 3, baslik: 'Kül Masalı', ozet: 'Gırılar\'ın ateşe verdiği ilk kitaplıktan geriye sadece üç sayfa kalmıştı.' }
      ];

      this.yaz(ekran, `
<span class="term-parlak">📖 GECE VARDİYASI KISA ÖYKÜLERİ:</span>
${oykuler.map((o) => `<span class="term-vurgu">• [Öykü ${o.no}] <b>${o.baslik}</b>:</span>\n  <span class="term-soluk">${o.ozet}</span>`).join('\n')}
<span class="term-soluk">Öykü modunu okumak için: <b>git okuma</b></span>
      `);
    }

    komutBildirimler(ekran) {
      this.yaz(ekran, `
<span class="term-parlak">🔔 GÜNCEL SİSTEM BİLDİRİMLERİ & DUYURULAR:</span>
<span class="term-vurgu">• [YENİ] V6.3.13 Arşiv Terminali Devrede:</span> 404 kurtarma motoru ve VFS arşivi yayına alındı.
<span class="term-vurgu">• [KORUMA] Fan Hikâyeleri Güvencesi:</span> Fan hikâyesi yazılmış evrenlerin silinmesi kalıcı olarak engellendi.
<span class="term-vurgu">• [ROMAN] Bölüm 4 Yayında:</span> Tömye romanının yeni bölümü kütüphaneye eklendi.
<span class="term-vurgu">• [PWA] Çevrimdışı Desteği:</span> Tüm kayıtlar IndexedDB üzerinden senkronize ediliyor.
      `);
    }

    komutFanKitap(ekran, altKomut, parametre) {
      const alt = (altKomut || 'liste').toLowerCase();
      const veri = typeof window !== 'undefined' ? window.veri : null;
      const fanEserleri = (veri && veri.fanEserleri) ? veri.fanEserleri : {};
      const hikayeler = Array.isArray(fanEserleri.hikayeler) ? fanEserleri.hikayeler : [];

      let yerelFan = [];
      try {
        const raw = localStorage.getItem('tentifor_fan_hikayeler');
        if (raw) yerelFan = JSON.parse(raw) || [];
      } catch {}

      const tumHikayeler = [...hikayeler, ...yerelFan];

      if (alt === 'koru' || alt === 'guvence') {
        this.yaz(ekran, `
<span class="term-parlak">🛡️ TOPLULUK FAN HİKÂYELERİ VE EVREN KORUMA SİSTEMİ</span>
<span class="term-basari">[KORUMA AKTİF]</span> Fan hikâyesi yazılmış hiçbir evren sistem temizliğinde SİLİNEMEZ.
<span class="term-vurgu">Korumadaki Evren Sayısı:</span> ${tumHikayeler.length ? tumHikayeler.length + 3 : '3 (Kanon ve Model evrenleri)'}
<span class="term-soluk">Kural Doğrulaması: Boş deneme evrenleri temizlenebilirken, hikâye veya bölüm içeren tüm evrenler kalıcı arşiv kilitlidir.</span>
        `);
        return;
      }

      this.yaz(ekran, `
<span class="term-parlak">📜 TOPLULUK FAN HİKÂYELERİ & EVRENLER:</span>
${tumHikayeler.length ? tumHikayeler.map((h, i) => `<span class="term-vurgu">• [${i + 1}] ${this.kacir(h.baslik || 'Fan Eseri')}</span> <span class="term-soluk">(@${this.kacir(h.yazar || 'anonim')}) — Koruma Altında</span>`).join('\n') : '<span class="term-soluk">Arşivde kayıtlı 3 korumalı evren hikâyesi bulunuyor. Kendi hikâyenizi eklemek için <b>git atolye</b> yapabilirsiniz.</span>'}
\n<span class="term-soluk">Koruma durumunu görmek için: <b>fankitap koru</b> | Atölye için: <b>git atolye</b></span>
      `);
    }

    komutKanon(ekran, altKomut) {
      const kanonlar = [
        { id: 'e25', ad: 'E-25 Tömye', tur: 'Ana Evren (Kanon)', durum: 'MUTLAK KORUMA' },
        { id: 'eterya', ad: 'Eterya', tur: 'Model Evreni', durum: 'KORUMALI' },
        { id: 'somdo', ad: 'Şomdo', tur: 'Kadim Yankı Evreni', durum: 'KORUMALI' },
        { id: 'kul', ad: 'Kül Evreni', tur: 'Gırılar Külliyatı', durum: 'KORUMALI' },
        { id: 'sis', ad: 'Sis Evreni', tur: 'Baloncuk Boyut', durum: 'ESNEK' }
      ];

      this.yaz(ekran, `
<span class="term-parlak">⚖️ KANON EVRENLER & BOYUT DENETİMİ:</span>
${kanonlar.map((k) => `<span class="term-vurgu">• [${k.id.padEnd(7, ' ')}] <b>${k.ad.padEnd(18, ' ')}</b></span> <span class="term-soluk">${k.tur.padEnd(20, ' ')}</span> <span class="term-basari">[${k.durum}]</span>`).join('\n')}
<span class="term-soluk">Kanon kilit durumu için: <b>admin durum</b></span>
      `);
    }

    komutAnomali(ekran) {
      const tomye = tomyeZamani();
      const stabilite = ((Math.sin(Date.now() / 800000) * 12) + 84).toFixed(1);
      const delilik = (100 - parseFloat(stabilite)).toFixed(1);

      this.yaz(ekran, `
<span class="term-parlak">🌀 TÖMYE BOYUTSAL ANOMALİ & DELİLİK ANALİZİ:</span>
<span class="term-vurgu">Kozmik Tarih       :</span> Yıl ${tomye.yil}, ${tomye.ay} Ayı, ${tomye.gun}. Gün (${tomye.saat}:${String(tomye.dakika).padStart(2, '0')})
<span class="term-vurgu">Boyut Stabilitesi  :</span> <span class="term-basari">%${stabilite}</span>
<span class="term-vurgu">Delilik İndeksi    :</span> <span class="term-uyari">%${delilik}</span>
<span class="term-vurgu">Buzul Çatlak Durumu:</span> Normal (Sapma &lt; 0.04 radyan)
<span class="term-soluk">Delilik Romanı Hakkında: Tömye Kütüphanesi'nin 8. görevlisinin psikolojik izolasyon anlatısı.</span>
      `);
    }

    komutGorevler(ekran) {
      const gorevler = [
        { ad: 'Günün Tömye Bölümünü İncele', odul: '+20 Akçe', tamam: true },
        { ad: 'Tömye Sözlüğünden Bir Kavram Araştır', odul: '+15 Akçe', tamam: true },
        { ad: 'Kyldo İsim Üreticisini Çalıştır', odul: '+15 Akçe', tamam: false },
        { ad: 'Günlük Tömye Bilgi Bulmacasını Çöz', odul: '+25 Akçe', tamam: false }
      ];

      this.yaz(ekran, `
<span class="term-parlak">📋 GÜNLÜK OKUR & ARŞİV GÖREVLERİ:</span>
${gorevler.map((g) => {
  const isaret = g.tamam ? '<span class="term-basari">[✓ TAMAMLANDI]</span>' : '<span class="term-uyari">[BEKLİYOR]</span>';
  return `• <b>${g.ad}</b> (${g.odul}) ${isaret}`;
}).join('\n')}
<span class="term-soluk">Görevleri tamamlayarak Akçe kazanabilir ve liderlik tablosunda yükselebilirsiniz.</span>
      `);
    }

    komutMuzik(ekran, altKomut, parca) {
      const alt = (altKomut || 'cal').toLowerCase();
      if (alt === 'dur' || alt === 'durdur' || alt === 'kapat') {
        this.yaz(ekran, '<span class="term-uyari">Müzik durduruldu.</span>');
        return;
      }

      if (alt === 'liste') {
        this.yaz(ekran, `
<span class="term-parlak">🎵 TÖMYE AMBİENT RETRO MELODİ LİSTESİ:</span>
  • <span class="term-vurgu">buzul</span>      : Kozmik buzul fısıltısı melodisi (392Hz - 784Hz)
  • <span class="term-vurgu">necale</span>     : Baş Arşivci gece teması (330Hz - 659Hz)
  • <span class="term-vurgu">kutuphane</span>  : Kütüphane koridorları ambient yankısı
<span class="term-soluk">Çalmak için: <b>muzik cal buzul</b> veya <b>muzik cal necale</b></span>
        `);
        return;
      }

      const secim = (parca || 'buzul').toLowerCase();
      let notalar = [392, 440, 523, 659, 784];
      let ad = 'Buzul Fısıltısı';

      if (secim === 'necale') {
        notalar = [330, 392, 493, 587, 659];
        ad = 'Necale Gece Teması';
      } else if (secim === 'kutuphane') {
        notalar = [261, 329, 392, 523, 659];
        ad = 'Kütüphane Koridorları';
      }

      this.ses.melodi(notalar);
      this.yaz(ekran, `<span class="term-basari">🎶 Çalınıyor: <b>${ad}</b> (8-Bit Synthesizer)</span>\n<span class="term-soluk">Durdurmak için: <b>muzik dur</b></span>`);
    }

    komutPs(ekran) {
      this.yaz(ekran, `
<span class="term-parlak">TÖMYE ARŞİV KATMANLARI VE SÜREÇ İZLEME MOTORU:</span>
<span class="term-soluk">PID  KATMAN   ZAMAN    SÜREÇ ADI         DURUM    BELLEK   AÇIKLAMA</span>
  1  kat/0    00:00:02 init-tentifor     RUNNING  14.2 MB  24. Evren Çekirdek Başlatıcısı
 12  kat/1    00:00:01 tomye-takvim      RUNNING   5.4 MB  28 Gün / 26 Saat Çark Senkronu
 28  kat/2    00:00:01 kyldo-fonetik     ACTIVE    4.1 MB  Kadim Ses Çifti & İsim Matrisi
 42  kat/3    00:00:01 sw-cache-worker   IDLE      8.6 MB  Çevrimdışı Arşiv Senkronizasyonu
 77  kat/1    00:00:00 audio-synth       READY     2.1 MB  Web Audio Tömye Rezonans Sentezi
104  kat/4    00:00:03 offline-queue     SLEEP     4.8 MB  İşlem Kuyruğu & Çakışma Yönetimi
128  kat/5    00:00:00 buzul-muhafiz     ACTIVE    3.9 MB  Necale Kütüphane Bekçi Nöbeti
215  kat/0    00:00:00 web-terminal      ACTIVE    6.4 MB  T-Term Siber Konsol Motoru
      `);
    }

    komutSaat(ekran) {
      const tomye = tomyeZamani();
      const gunOrani = (tomye.saat * 60 + tomye.dakika) / (26 * 60);
      const barLen = 24;
      const dolgu = Math.round(gunOrani * barLen);
      const bar = '█'.repeat(dolgu) + '░'.repeat(Math.max(0, barLen - dolgu));
      const yuzde = Math.round(gunOrani * 100);

      this.yaz(ekran, `
<span class="term-parlak">╔══════════════════════════════════════════════════════════════╗</span>
<span class="term-parlak">║                     TÖMYE GÜNEŞ ZAMANI                       ║</span>
<span class="term-parlak">╚══════════════════════════════════════════════════════════════╝</span>
<span class="term-vurgu">Tarih        :</span> <b>${tomye.gun}. ${tomye.ay} ${tomye.yil}</b> (Aysız Gezegen Takvimi)
<span class="term-vurgu">Saat         :</span> <b>${String(tomye.saat).padStart(2, '0')}:${String(tomye.dakika).padStart(2, '0')}</b> (Günün ${tomye.saat}. Saati / Gün 26 saattir)
<span class="term-vurgu">Döngü        :</span> 28 günlük ay döngüsünün ${tomye.gun}. günü
<span class="term-vurgu">Gün İlerleme :</span> [${bar}] %${yuzde}
<span class="term-soluk">Kozmoloji Notu: Tömye semalarında ay yoktur; zaman akışı deniz üzerindeki buzul katmanları ve yıldız çarkıyla ölçülür.</span>
      `);
    }

    komutCevir(ekran, tarihStr) {
      if (!tarihStr) {
        this.yaz(ekran, '<span class="term-soluk">Kullanım: cevir YYYY-AA-GG (örn: cevir 2026-10-06)</span>');
        return;
      }
      const dt = new Date(tarihStr);
      if (isNaN(dt.getTime())) {
        this.yaz(ekran, '<span class="term-hata">Geçersiz tarih formatı. Örnek: cevir 2026-10-06</span>');
        return;
      }
      const baslangic = new Date(Date.UTC(2024, 0, 1));
      const gecenGun = Math.floor((dt - baslangic) / 86400000);
      const tomyeYili = 744 + Math.floor(gecenGun / 336);
      const aylar = ['Buz', 'Çatlak', 'Akıntı', 'Kırağı', 'Yankı', 'Gece', 'Güneş', 'Kül', 'Fırtına', 'Sessizlik', 'Işık', 'Dönüş'];
      const ayIndeks = ((Math.floor(gecenGun / 28) % 12) + 12) % 12;
      const ayGunu = ((gecenGun % 28) + 28) % 28 + 1;
      const gunler = ['Yen', 'Tan', 'Gün', 'Dün', 'Tün', 'Son'];
      const haftaGunu = gunler[((gecenGun % 6) + 6) % 6];

      this.yaz(ekran, `
<span class="term-basari">✓ TÖMYE TAKVİM ÇEVİRİSİ:</span>
<span class="term-vurgu">Dünya Tarihi :</span> ${tarihStr}
<span class="term-vurgu">Tömye Tarihi :</span> <b>${ayGunu} ${aylar[ayIndeks]} ${tomyeYili}</b> (${haftaGunu} günü)
<span class="term-soluk">Tömye'de aylar 28 gün çeker ve hafta 6 gündür (Yen, Tan, Gün, Dün, Tün, Son).</span>
      `);
    }

    komutYas(ekran, argumanlar) {
      const sayi = parseFloat(argumanlar[0]);
      if (isNaN(sayi)) {
        this.yaz(ekran, '<span class="term-soluk">Kullanım: yas &lt;sayı&gt; [-tomyeden] (örn: yas 25 veya yas 120 -tomyeden)</span>');
        return;
      }
      const tomyeden = argumanlar.includes('-tomyeden') || argumanlar.includes('--tomyeden');
      const tomyeYilSaat = 336 * 26;
      const dunyaYilSaat = 365.2425 * 24;

      if (tomyeden) {
        const dunya = (sayi * tomyeYilSaat) / dunyaYilSaat;
        this.yaz(ekran, `
<span class="term-basari">✓ YAŞ ÇEVİRİSİ:</span>
<b>${sayi} Tömye yılı</b> ≈ <span class="term-parlak">${dunya.toFixed(1)} Dünya yılı</span>
<span class="term-soluk">(Kyldo ortalama insan ömrü: 250 Tömye yılı ≈ 248 Dünya yılı)</span>
        `);
      } else {
        const tomye = (sayi * dunyaYilSaat) / tomyeYilSaat;
        this.yaz(ekran, `
<span class="term-basari">✓ YAŞ ÇEVİRİSİ:</span>
<b>${sayi} Dünya yılı</b> ≈ <span class="term-parlak">${tomye.toFixed(1)} Tömye yılı</span>
<span class="term-soluk">(Tömye takvimi: 336 gün, her gün 26 saat)</span>
        `);
      }
    }

    komutSesler(ekran) {
      this.yaz(ekran, `
<span class="term-parlak">╔══════════════════════════════════════════════════════════════╗</span>
<span class="term-parlak">║             TENTİFORVERSE KANON SES TABLOSU                  ║</span>
<span class="term-parlak">╚══════════════════════════════════════════════════════════════╝</span>
<span class="term-vurgu">Ünsüz Çiftleri:</span>
  <b>b ↔ p</b>   |   <b>c ↔ ç</b>   |   <b>d ↔ t</b>   |   <b>g ↔ k</b>
  <b>v ↔ f</b>   |   <b>z ↔ s</b>   |   <b>j ↔ ş</b>   |   <b>r ↔ l</b>
  <b>n ↔ m</b>
<span class="term-vurgu">Ünlü Çiftleri:</span>
  <b>a ↔ e</b>   |   <b>ı ↔ i</b>   |   <b>o ↔ u</b>   |   <b>ö ↔ ü</b>
<span class="term-soluk">Sabit Kalanlar: <b>y</b> ve <b>h</b> harfleri değişmez.</span>
<span class="term-soluk">Kural Notu: Bu ses çiftleri isyanda yakılan Kyldo dilinin morfolojik omurgasıdır.
Örn: "çatlak" → Gerdec kuralıyla dönüşür. Denemek için: <b>isim &lt;kelime&gt;</b></span>
      `);
    }

    komutOneri(ekran, turParam) {
      const tur = (turParam || 'karakter').toLowerCase();
      const tohumlar = {
        karakter: ['umut', 'korku', 'sabır', 'öfke', 'sessizlik', 'hatıra', 'borç', 'vaat', 'gölge', 'iz', 'yara'],
        sehir: ['liman', 'kıyı', 'geçit', 'kule', 'demir', 'tuz', 'köprü', 'sur', 'pazar', 'çukur'],
        ay: ['kar', 'buz', 'don', 'çatlak', 'derin', 'uzak', 'ışık', 'yıldız', 'sabır', 'gece', 'hasat']
      };
      const liste = tohumlar[tur] || tohumlar.karakter;
      const secilen = [...liste].sort(() => 0.5 - Math.random()).slice(0, 5);

      this.yaz(ekran, `
<span class="term-parlak">TENTİFORVERSE ${tur.toUpperCase()} İSİM ADAYLARI:</span>
${secilen.map((kok, i) => {
  const donus = kyldoIsim(kok);
  const anaAd = donus[0] ? donus[0].ad : kok;
  const klasikAd = donus[2] ? donus[2].ad : kok;
  return `<span class="term-vurgu">${i + 1}. <b>${anaAd}</b></span> <span class="term-soluk">(Kök: "${kok}" · Kyldo klasik: ${klasikAd})</span>`;
}).join('\n')}
<span class="term-soluk">Kendi kelimenizi türetmek için: <b>isim &lt;kelimeniz&gt;</b></span>
      `);
    }

    komutKod(ekran, sifre) {
      const kod = String(sifre || '').trim();
      if (!kod) {
        this.yaz(ekran, '<span class="term-soluk">Kullanım: kod &lt;şifre&gt; (örn: kod AX24 veya kod KYLDO)</span>');
        return;
      }
      if (typeof window !== 'undefined' && typeof window.kodDene === 'function') {
        const sonuc = window.kodDene(kod);
        if (sonuc) {
          this.ses.zil();
          this.yaz(ekran, `<span class="term-basari">✓ Kod başarıyla çözüldü! ${this.kacir(sonuc.mesaj || 'Gizli kayıt ve içerikler erişime açıldı.')}</span>`);
        } else {
          this.ses.hata();
          this.yaz(ekran, '<span class="term-hata">✕ Kod geçersiz veya daha önce kullanılmış.</span>');
        }
      } else {
        this.ses.onay();
        this.yaz(ekran, `<span class="term-bilgi">Kod doğrulayıcı devrede. Kod işlendi: <b>${this.kacir(kod)}</b></span>`);
      }
    }

    komutGirilar(ekran) {
      this.yaz(ekran, `
<span class="term-parlak">╔══════════════════════════════════════════════════════════════╗</span>
<span class="term-parlak">║             GIRILAR — KİTAP YAKAN İSYANCILAR                 ║</span>
<span class="term-parlak">╚══════════════════════════════════════════════════════════════╝</span>
<span class="term-vurgu">Tanım       :</span> Tömye'nin kütüphanelerini ateşe veren kadim isyancı birlik.
<span class="term-vurgu">İnançları   :</span> <i>"Kelimeler donarsa medeniyet donar. Yazılan her harf zihne vurulmuş bir buz zinciridir."</i>
<span class="term-vurgu">Tarihsel İz :</span> İsyanda yüz binlerce cilt parşömen kül edildi. Fakat Baş Arşivci Necale
ve dilbilimciler, kelimeleri Kyldo ses çiftleri ve ayna yazısıyla şifreleyerek buzulun altına gömdü.
<span class="term-vurgu">Durum       :</span> Küller kütüphanenin zeminine karıştı; yangın bitti ama metinler hâlâ şifreli.
<span class="term-soluk">Detaylı inceleme için: <b>cat /kitaplar/girilar-manifestosu.txt</b></span>
      `);
    }

    komutNecale(ekran) {
      this.yaz(ekran, `
<span class="term-parlak">╔══════════════════════════════════════════════════════════════╗</span>
<span class="term-parlak">║             NECALE — BAŞ ARŞİVCİ & KÜTÜPHANE BEKÇİSİ         ║</span>
<span class="term-parlak">╚══════════════════════════════════════════════════════════════╝</span>
<span class="term-vurgu">Görev Yeri  :</span> Tömye Büyük Kütüphanesi, 4. Katman Muhafızlığı.
<span class="term-vurgu">Sözü        :</span> <i>"Yanlış yerleştirilen tek bir sayfa, bir medeniyeti siler."</i>
<span class="term-vurgu">Kişisel Not :</span> Gırılar kütüphaneyi yakarken alevlerin arasından çıkardığı son cilt,
Tentifor Kanon Anahtarı'dır. Gece nöbetlerinde feneriyle donmuş rafları teftiş eder.
<span class="term-vurgu">Durum       :</span> Aktif ve Tetikte.
<span class="term-soluk">Detay için: <b>cat /karakterler/necale.txt</b> veya <b>muzik cal necale</b></span>
      `);
    }

    komutOzan(ekran) {
      this.yaz(ekran, `
<span class="term-parlak">=== OZAN — BUZUL GEZGİNİ & YANKI ARAYICISI ===</span>
<span class="term-vurgu">Görevi      :</span> Tömye'nin donmuş okyanusunda çatlakları dinlemek.
<span class="term-vurgu">Gözlemi     :</span> <i>"Buzun altındaki yankılar sadece geçmişi değil; yazılmamış hikâyeleri de fısıldar."</i>
<span class="term-vurgu">Rotası      :</span> Üçüncü Çatlak'tan Dördüncü Katman Çekirdeği'ne uzanan gizli iz.
<span class="term-soluk">Detay için: <b>cat /karakterler/ozan.txt</b></span>
      `);
    }

    komutEylul(ekran) {
      this.yaz(ekran, `
<span class="term-parlak">=== EYLÜL — KYLDO YAZIT ÇÖZÜCÜSÜ ===</span>
<span class="term-vurgu">Başarısı    :</span> Tömye'nin ayna alfabesini ve ses çifti matrisini ilk deşifre eden arşivci.
<span class="term-vurgu">İlkesi      :</span> <i>"Bir kelimeyi tersten okuduğunda duyduğun ses, onun gerçek kökenidir."</i>
<span class="term-vurgu">Çalışması   :</span> Ses çiftleri tablosunu ve 28 günlük ay takvimini belgeledi.
<span class="term-soluk">Detay için: <b>cat /karakterler/eylul.txt</b> veya <b>sesler</b></span>
      `);
    }

    komutKatmanlar(ekran) {
      this.yaz(ekran, `
<span class="term-parlak">╔══════════════════════════════════════════════════════════════╗</span>
<span class="term-parlak">║             TÖMYE'NİN 7 DONMUŞ KOZMİK KATMANI                ║</span>
<span class="term-parlak">╚══════════════════════════════════════════════════════════════╝</span>
<span class="term-vurgu">1. Katman: Yüzey Kırağısı</span>       — Halka açık okuma koridoru ve vitrin.
<span class="term-vurgu">2. Katman: Kyldo Yazıtları</span>      — Şifreli tabletler ve ses çifti dönüşümleri.
<span class="term-vurgu">3. Katman: Yankı Havuzları</span>      — Zaman kırılmaları ve model evren frekansları.
<span class="term-vurgu">4. Katman: Baloncuk Evrenler</span>    — Yan boyutlar ve topluluk fan atölyeleri.
<span class="term-vurgu">5. Katman: Yanmış Kitaplık</span>      — Gırılar'ın kül ettiği kadim arşiv odaları.
<span class="term-vurgu">6. Katman: Dördüncü Çatlak</span>      — Uzay-zaman bükülmeleri ve geçitler.
<span class="term-vurgu">7. Katman: Arşiv Çekirdeği</span>      — Kanonun kalbi, aysız gökyüzünün mutlak sırrı.
<span class="term-soluk">Katman metnini okumak için: <b>cat /kitaplar/buzul-katmanlari.txt</b></span>
      `);
    }

    komutSomdo(ekran) {
      this.yaz(ekran, `
<span class="term-parlak">=== ŞOMDO — MODEL EVRENİ (Claude Katkısı) ===</span>
<span class="term-vurgu">Ad          :</span> Şomdo
<span class="term-vurgu">Köken       :</span> Aynaların arkasındaki sessiz ve kadim Tentifor yankısı.
<span class="term-vurgu">Kozmoloji   :</span> Işığın kırılmadığı, yalnızca donduğu derin boyut.
<span class="term-vurgu">Dosya Kaydı :</span> <code>/evrenler/somdo.json</code>
<span class="term-soluk">İçeriği görmek için: <b>cat /evrenler/somdo.json</b> veya <b>evren bilgi somdo</b></span>
      `);
    }

    komutZar(ekran, yuzParam) {
      const yuz = parseInt(yuzParam, 10) || 25; // Tömye varsayılanı 25!
      const atis = Math.floor(Math.random() * yuz) + 1;
      this.yaz(ekran, `
<span class="term-basari">🎲 TÖMYE ZARI ATILDI (d${yuz}): <b>${atis}</b></span>
<span class="term-soluk">(Tömye'de bir gün 25/26 saat olduğundan, geleneksel arşiv zarı 25 yüzlüdür.)</span>
      `);
    }

    komutDefter(ekran) {
      let vurguSayisi = 0;
      let rozetSayisi = 0;
      try {
        const v = localStorage.getItem('tentiforapp_vurgular');
        if (v) vurguSayisi = Object.keys(JSON.parse(v)).length;
        const r = localStorage.getItem('tentiforapp_rozetler');
        if (r) rozetSayisi = Object.keys(JSON.parse(r)).length;
      } catch {}

      this.yaz(ekran, `
<span class="term-parlak">╔══════════════════════════════════════════════════════════════╗</span>
<span class="term-parlak">║                 KİŞİSEL OKUR DEFTERİNİZ                      ║</span>
<span class="term-parlak">╚══════════════════════════════════════════════════════════════╝</span>
<span class="term-vurgu">Kayıtlı Vurgular     :</span> ${vurguSayisi} adet alıntı
<span class="term-vurgu">Kazanılan Rozetler   :</span> ${rozetSayisi} adet
<span class="term-vurgu">Cihaz Durumu         :</span> Çevrimdışı yerel defter hazır
<span class="term-soluk">Defter bölümünü sitede açmak için: <b>git sen</b></span>
      `);
    }

    komutOyun(ekran, adim) {
      if (!adim || adim === 'basla') {
        this.oyunDurumu = { oda: 1, anahtar: false };
        this.yaz(ekran, `
<span class="term-parlak">=== KÜTÜPHANE LABİRENTİ: KAYIP DEFTER ===</span>
Soğuk ve karanlık bir arşiv koridorundasın. Necale'nin eski çalışma odasının kapısındasın.
Sol tarafta buzul çatlağı (1), sağ tarafta kilitli demir kapı (2) var.
Ne yapacaksın?
<span class="term-vurgu">Kullanım: oyun 1 veya oyun 2</span>
        `);
        return;
      }

      if (!this.oyunDurumu) {
        this.oyunDurumu = { oda: 1, anahtar: false };
      }

      if (this.oyunDurumu.oda === 1) {
        if (adim === '1') {
          this.oyunDurumu.oda = 2;
          this.oyunDurumu.anahtar = true;
          this.yaz(ekran, `
Buzul çatlağına indin. Çatlağın dibinde kristalize olmuş eski bir <span class="term-vurgu">Gümüş Anahtar</span> buldun!
Anahtarı çantana koydun.
Şimdi ana koridora dönmek için: <span class="term-vurgu">oyun 3</span>
          `);
        } else if (adim === '2') {
          if (this.oyunDurumu.anahtar) {
            this.oyunDurumu.oda = 3;
            this.yaz(ekran, `
Gümüş anahtarı kilide taktın... *TIK!* Kapı açıldı!
İçeride parıldayan kadim Tentifor Defteri duruyor!
<span class="term-basari">TEBRİKLER! Arşiv gizemini çözdün ve kütüphaneyi kurtardın!</span>
Yeniden başlamak için: <b>oyun basla</b>
            `);
          } else {
            this.ses.hata();
            this.yaz(ekran, `
Kapı kilitli! Ağır demir tokmak kıpırdamıyor. Bir anahtara ihtiyacın var.
Buzul çatlağına inmek için: <span class="term-vurgu">oyun 1</span>
            `);
          }
        } else if (adim === '3') {
          this.oyunDurumu.oda = 1;
          this.yaz(ekran, 'Koridora döndün. Demir kapıyı denemek için: <span class="term-vurgu">oyun 2</span>');
        }
      } else if (this.oyunDurumu.oda === 2) {
        if (adim === '3') {
          this.oyunDurumu.oda = 1;
          this.yaz(ekran, 'Koridora döndün. Demir kapıyı denemek için: <span class="term-vurgu">oyun 2</span>');
        }
      }
    }

    komutExport(ekran) {
      const metin = ekran.innerText || ekran.textContent;
      if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([metin], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `tentifor-terminal-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        this.yaz(ekran, '<span class="term-basari">Terminal günlüğü dışa aktarıldı ve indirildi.</span>');
      }
    }

    // YÖNETİCİ ÖZEL İÇERİK & KOMUTLARI
    komutAdmin(ekran, argumanlar, istemiEl, rozetEl) {
      const alt = (argumanlar[0] || 'durum').toLowerCase();
      const parametre = argumanlar[1] || '';

      // Giriş
      if (alt === 'giris') {
        if (!parametre) {
          this.yaz(ekran, '<span class="term-soluk">Kullanım: admin giris &lt;yonetici_kodu&gt;</span>');
          return;
        }

        let basarili = false;
        if (typeof window !== 'undefined' && typeof window.yoneticiGiris === 'function') {
          basarili = Boolean(window.yoneticiGiris(parametre));
        } else {
          // Geliştirici/Test modu fallback
          basarili = parametre === 'root' || parametre === 'tentifor2026' || parametre === 'admin';
        }

        if (basarili) {
          this.adminOturumu = true;
          this.ses.zil();
          if (istemiEl) istemiEl.innerHTML = this.istemiMetni();
          if (rozetEl) rozetEl.textContent = 'ROOT / YÖNETİCİ';
          this.yaz(ekran, `
<span class="term-basari">[YÖNETİCİ YETKİLENDİRMESİ BAŞARILI]</span>
Oturum seviyesi: <span class="term-parlak">ROOT / TAM DENETİM</span>
Kanon şifreleme ve yönetim araçları aktif.
Yardım için: <b>yardim admin</b>
          `);
        } else {
          this.ses.hata();
          this.yaz(ekran, '<span class="term-hata">[ERİŞİM REDDEDİLDİ] Geçersiz yönetici kodu. Bu olay güvenlik günlüğüne kaydedildi.</span>');
        }
        return;
      }

      // Çıkış
      if (alt === 'cikis') {
        this.adminOturumu = false;
        if (typeof window !== 'undefined' && typeof window.yoneticiCikis === 'function') {
          try { window.yoneticiCikis(); } catch {}
        }
        if (istemiEl) istemiEl.innerHTML = this.istemiMetni();
        if (rozetEl) rozetEl.textContent = 'V6.3.13';
        this.yaz(ekran, '<span class="term-soluk">Yönetici oturumu kapatıldı. Standart moda dönüldü.</span>');
        return;
      }

      // Root yetkisi kontrolü
      if (!this.adminOturumu) {
        this.ses.hata();
        this.yaz(ekran, `
<span class="term-hata">[YETKİ GEREKLİ]</span>
Bu komutu çalıştırmak için yönetici doğrulaması gerekmektedir.
Giriş için: <span class="term-vurgu">admin giris &lt;kod&gt;</span>
        `);
        return;
      }

      // Durum
      if (alt === 'durum') {
        const kanonDurumu = typeof window !== 'undefined' && typeof window.kanonKilidiAcik === 'function' && window.kanonKilidiAcik() ? 'AÇIK (Tüm sırlar görünür)' : 'KİLİTLİ (Kanon koruması devrede)';
        this.yaz(ekran, `
<span class="term-parlak">=== YÖNETİCİ OTURUM DURUMU ===</span>
Yetki Seviyesi : <span class="term-basari">ROOT (Full Administrator)</span>
Kanon Kilidi   : ${kanonDurumu}
Karantina Modu : Aktif (Otomatik filtre devrede)
Veri Bütünlüğü : Doğrulandı (164 dosya senkron)
        `);
      } else if (alt === 'kanon') {
        const aks = (parametre || 'durum').toLowerCase();
        if (aks === 'ac') {
          if (typeof window !== 'undefined' && typeof window.kanonAc === 'function') {
            window.kanonAc();
          }
          this.yaz(ekran, '<span class="term-basari">Kanon kilitleri açıldı. Gizli katmanlar erişilebilir.</span>');
        } else if (aks === 'kapat') {
          if (typeof window !== 'undefined' && typeof window.kanonSifirla === 'function') {
            window.kanonSifirla();
          }
          this.yaz(ekran, '<span class="term-uyari">Kanon kilitlendi. Gizli katmanlar korumaya alındı.</span>');
        } else {
          this.yaz(ekran, '<span class="term-soluk">Kullanım: admin kanon [ac | kapat]</span>');
        }
      } else if (alt === 'karantina') {
        this.yaz(ekran, `
<span class="term-parlak">=== MODERASYON & KARANTİNA HAVUZU ===</span>
Aktif Karantina Sayısı: 0
Şüpheli Bildirim     : 0
Raporlanan Fan Evren : 0
<span class="term-basari">Tüm içerikler temiz ve yayında.</span>
        `);
      } else if (alt === 'yedek') {
        const veri = typeof window !== 'undefined' ? window.veri : null;
        if (veri) {
          const jsonStr = JSON.stringify(veri, null, 2);
          if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `veri-yedek-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            this.yaz(ekran, '<span class="term-basari">veri.json tam yedeği indirildi.</span>');
          }
        } else {
          this.yaz(ekran, '<span class="term-hata">Yedeklenecek veri nesnesi bulunamadı.</span>');
        }
      } else if (alt === 'loglar') {
        this.yaz(ekran, `
<span class="term-parlak">=== YÖNETİM GÜVENLİK GÜNLÜĞÜ ===</span>
[AUTH] 2026-10-06 14:32:00 - Root konsol başlatıldı.
[SYNC] 2026-10-06 14:35:12 - Fan evrenleri koruma kontrolü başarılı.
[404]  2026-10-06 14:40:05 - Otomatik kurtarma motoru hazır.
[SEC]  2026-10-06 14:45:19 - Karantina havuzu taraması tamamlandı.
        `);
      } else if (alt === 'panel') {
        if (typeof location !== 'undefined') {
          location.hash = '#/sen';
          setTimeout(() => {
            if (typeof window.yoneticiCiz === 'function') window.yoneticiCiz();
          }, 100);
          this.yaz(ekran, '<span class="term-basari">Yönetici paneli (#sen -> yönetici) açıldı.</span>');
        }
      } else if (alt === 'temizle') {
        this.yaz(ekran, '<span class="term-basari">Geçici sistem önbellekleri ve loglar temizlendi.</span>');
      } else {
        this.yaz(ekran, '<span class="term-soluk">Bilinmeyen admin komutu. Yardım için: <b>yardim admin</b></span>');
      }
    }

    // Yol Normalizasyonu & Çözümü
    cozYol(hedef) {
      if (!hedef) return this.dizin;
      let tamYol = hedef.startsWith('/') ? hedef : (this.dizin === '/' ? `/${hedef}` : `${this.dizin}/${hedef}`);
      return pathNormalize(tamYol);
    }

    kacir(metin) {
      return String(metin == null ? '' : metin)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Modal Pencere Kontrolleri
    ac() {
      let modal = document.querySelector('#tentifor-terminal-modal-kapsayici');
      if (!modal) {
        modal = this.olusturTerminalElement('term-modal', false);
        modal.id = 'tentifor-terminal-modal-kapsayici';
        document.body.appendChild(modal);
        this.baglaOlaylar(modal, 'term-modal', false);

        // Karşılama mesajı
        const ekran = modal.querySelector('#term-modal-ekran');
        this.yaz(ekran, `
<span class="term-banner">
Tentifor Arşiv Terminali V6.3.13 [Cyber-Console Ready]
Telif Hakkı (C) 2026 NJG Games / Tentiforverse. Tüm hakları saklıdır.
</span>
<span class="term-soluk">Kullanılabilir komutlar için <b>yardim</b> yazın veya hızlı düğmeleri kullanın.</span>
        `);
      }
      modal.classList.remove('gizli');
      this.pencereAcik = true;
      const giris = modal.querySelector('#term-modal-giris');
      if (giris) setTimeout(() => giris.focus(), 50);
    }

    kapat() {
      const modal = document.querySelector('#tentifor-terminal-modal-kapsayici');
      if (modal) modal.classList.add('gizli');
      this.pencereAcik = false;
    }

    gecis() {
      if (this.pencereAcik) {
        this.kapat();
      } else {
        this.ac();
      }
    }

    // 404 Sayfasında Gömülü Terminal Başlatma
    mount404(arananAdres) {
      const yokSayfa = document.querySelector('#yokSayfa');
      if (!yokSayfa) return;

      let varolan = yokSayfa.querySelector('#term-404-konteyner');
      if (varolan) varolan.remove();

      const kutu = document.createElement('div');
      kutu.className = 'yok-terminal-kutusu';
      kutu.innerHTML = `
        <div class="yok-terminal-baslik">
          <span>⚡ Tentifor Kurtarma Terminali (404 Sinyal Kaybı)</span>
          <button class="term-dugme" id="yokTermBuyutBtn">⛶ Tam Ekranda Aç</button>
        </div>
      `;

      const terminalEl = this.olusturTerminalElement('term-404', true);
      kutu.appendChild(terminalEl);
      yokSayfa.appendChild(kutu);

      this.baglaOlaylar(terminalEl, 'term-404', true);

      const ekran = terminalEl.querySelector('#term-404-ekran');
      this.yaz(ekran, `
<span class="term-hata">[404 HATA TESPİTİ] İstenen adres bulunamadı: "${this.kacir(arananAdres || '')}"</span>
<span class="term-soluk">Bu terminal üzerinden kayıp rotayı analiz edebilir veya arşiv komutlarını çalıştırabilirsiniz.</span>
<span class="term-vurgu">Öneri: Otomatik rota kurtarma için "kurtar" yazın veya geçerli sayfaları görmek için "rotalar" komutunu çalıştırın.</span>
      `);

      const buyutBtn = kutu.querySelector('#yokTermBuyutBtn');
      if (buyutBtn) {
        buyutBtn.addEventListener('click', () => {
          this.ac();
        });
      }
    }
  }

  // Yardımcı Yol Normalleştirici
  function pathNormalize(p) {
    const parts = p.split('/').filter(Boolean);
    const stack = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        if (stack.length) stack.pop();
      } else {
        stack.push(part);
      }
    }
    return '/' + stack.join('/');
  }

  // Global Motor Örneği
  const terminalInstance = new TentiforTerminalEngine();
  if (typeof window !== 'undefined') {
    window.TentiforTerminal = terminalInstance;
  }

  // Global Klavye Kısayolları (Ctrl+` veya ~ veya Alt+T)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && (e.key === '`' || e.code === 'Backquote')) || (e.altKey && e.key.toLowerCase() === 't')) {
      e.preventDefault();
      terminalInstance.gecis();
    }
  });

  // Menü ve Header'a Terminal Tuşu Ekleme Fonksiyonu
  function menuTerminalTusuEkle() {
    // 1. Header (Üst Menü Çubuğu) Tuşu
    const header = document.querySelector('header.ust');
    if (header && !header.querySelector('#btnTerminalUst')) {
      const btn = document.createElement('button');
      btn.className = 'ust-ikon terminal-menu-btn';
      btn.id = 'btnTerminalUst';
      btn.type = 'button';
      btn.setAttribute('data-term-ac', '1');
      btn.setAttribute('aria-label', 'Tentifor Terminal Konsolu');
      btn.setAttribute('title', 'Terminal Konsolu (>_)');
      btn.innerHTML = '&gt;_';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        terminalInstance.ac();
      });
      const btnKod = header.querySelector('#btnKod');
      if (btnKod) {
        header.insertBefore(btn, btnKod);
      } else {
        header.appendChild(btn);
      }
    }

    // 2. Gezinme (Desktop Navigasyon Menüsü) Tuşu
    const gezinme = document.querySelector('#gezinme');
    if (gezinme && !gezinme.querySelector('#terminalGezBtn')) {
      const gezBtn = document.createElement('button');
      gezBtn.className = 'gez-btn gez-terminal';
      gezBtn.id = 'terminalGezBtn';
      gezBtn.type = 'button';
      gezBtn.setAttribute('data-term-ac', '1');
      gezBtn.setAttribute('aria-label', 'Tentifor Terminal Konsolu');
      gezBtn.setAttribute('title', 'Tentifor Arşiv Terminali (Ctrl+`)');
      gezBtn.innerHTML = '&gt;_ Terminal';
      gezBtn.addEventListener('click', (e) => {
        e.preventDefault();
        terminalInstance.ac();
      });
      gezinme.appendChild(gezBtn);
    }
  }

  // Yüzen Düğme (FAB) ve Menü Tuşları Başlatma
  function arayuzDugmeleriKur() {
    menuTerminalTusuEkle();

    if (!document.querySelector('#tentiforTermFab')) {
      const fab = document.createElement('button');
      fab.id = 'tentiforTermFab';
      fab.className = 'tentifor-term-fab';
      fab.setAttribute('data-term-ac', '1');
      fab.setAttribute('aria-label', 'Tentifor Arşiv Terminalini Aç');
      fab.setAttribute('title', 'Tentifor Terminali Aç (Ctrl+`)');
      fab.innerHTML = '<span class="fab-nokta"></span> >_ Terminal';
      fab.addEventListener('click', () => {
        terminalInstance.gecis();
      });
      document.body.appendChild(fab);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arayuzDugmeleriKur);
  } else {
    arayuzDugmeleriKur();
  }

  // Tıklama Olay Delegasyonu (Mobil Menü, Header ve Linkler)
  document.addEventListener('click', (e) => {
    const hedef = e.target.closest && e.target.closest('#btnTerminalUst, #terminalGezBtn, #btnTerminal, [data-term-ac], [data-mobil-eylem="terminal"], [data-gez-git="terminal"]');
    if (hedef) {
      e.preventDefault();
      terminalInstance.ac();
    }
  });

  // Rota Kontrolü: #/terminal veya #/konsol açılırsa
  function rotaTerminalKontrol() {
    menuTerminalTusuEkle();
    const hash = (typeof location !== 'undefined' ? location.hash : '').toLowerCase();
    if (hash === '#/terminal' || hash === '#/konsol') {
      terminalInstance.ac();
    }
  }

  window.addEventListener('hashchange', rotaTerminalKontrol);
  setTimeout(rotaTerminalKontrol, 200);

})();
