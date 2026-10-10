// TentiFor — İçerik Alım Servisi ve Evren Gelir Yönetimi (v6.3.16)
// Roman ve çizim gibi içeriklerin eçka ile satın alınması,
// alımların sunucuya yazılması ve evren sahiplerinin satış gelirlerini görmesi.

(function () {
  const ALIM_YEREL_ANAHTAR = 'tentiforapp_evren_alimlar';
  const ALIM_ONBELLEK = {};

  function yerelAlimlarOku() {
    try {
      const ham = localStorage.getItem(ALIM_YEREL_ANAHTAR);
      if (ham) {
        const p = JSON.parse(ham);
        if (p && typeof p === 'object') return p;
      }
    } catch {}
    return { toplamAlim: 0, toplamEcka: 0, alimlar: [], evrenler: {}, sahipler: {} };
  }

  function yerelAlimlarYaz(db) {
    try {
      localStorage.setItem(ALIM_YEREL_ANAHTAR, JSON.stringify(db));
    } catch {}
  }

  function aktifAliciAdi() {
    if (typeof hesapKullanici !== 'undefined' && hesapKullanici) {
      return hesapKullanici.kullanici_adi || hesapKullanici.email || 'kayitli_okur';
    }
    const profil = typeof profilGetir === 'function' ? profilGetir() : null;
    if (profil && profil.ad) return profil.ad;
    return 'ziyaretci';
  }

  async function alimKaydet(veri) {
    if (!veri || (!veri.icerikId && !veri.icerikBaslik)) return null;
    const tutar = Math.max(0, Number(veri.tutar) || 0);
    const kayit = {
      id: veri.id || `alm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      icerikTur: String(veri.icerikTur || 'roman'),
      icerikId: String(veri.icerikId || ''),
      icerikBaslik: String(veri.icerikBaslik || 'İçerik'),
      evrenId: String(veri.evrenId || 'tomye'),
      evrenAd: String(veri.evrenAd || 'Tömye'),
      evrenSahip: String(veri.evrenSahip || 'TentiFor'),
      alici: String(veri.alici || aktifAliciAdi()),
      aliciId: String(veri.aliciId || (typeof hesapKullanici !== 'undefined' && hesapKullanici && hesapKullanici.id) || ''),
      tutar: tutar,
      birim: String(veri.birim || (typeof birim === 'function' ? birim() : 'eçka')),
      tarih: veri.tarih || new Date().toISOString()
    };

    // 1. Yerel belleği güncelle (anında yansıtma ve çevrimdışı güvencesi)
    const db = yerelAlimlarOku();
    db.toplamAlim = (db.toplamAlim || 0) + 1;
    db.toplamEcka = (db.toplamEcka || 0) + tutar;
    db.alimlar = Array.isArray(db.alimlar) ? db.alimlar : [];
    db.alimlar.unshift(kayit);

    db.evrenler = db.evrenler || {};
    const ev = db.evrenler[kayit.evrenId] = db.evrenler[kayit.evrenId] || {
      id: kayit.evrenId,
      ad: kayit.evrenAd,
      sahip: kayit.evrenSahip,
      toplamAlim: 0,
      toplamEcka: 0,
      roman: { adet: 0, ecka: 0 },
      cizim: { adet: 0, ecka: 0 },
      sonAlimlar: []
    };
    ev.toplamAlim = (ev.toplamAlim || 0) + 1;
    ev.toplamEcka = (ev.toplamEcka || 0) + tutar;
    if (kayit.icerikTur === 'roman') {
      ev.roman = ev.roman || { adet: 0, ecka: 0 };
      ev.roman.adet += 1;
      ev.roman.ecka += tutar;
    } else if (kayit.icerikTur === 'cizim') {
      ev.cizim = ev.cizim || { adet: 0, ecka: 0 };
      ev.cizim.adet += 1;
      ev.cizim.ecka += tutar;
    }
    ev.sonAlimlar = Array.isArray(ev.sonAlimlar) ? ev.sonAlimlar : [];
    ev.sonAlimlar.unshift(kayit);
    yerelAlimlarYaz(db);

    // 2. Sunucuya gönder (server.js alimlar.json)
    try {
      const yanit = await fetch('/api/alimlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kayit)
      });
      if (yanit.ok) {
        const json = await yanit.json();
        if (json && json.evrenOzeti) {
          ALIM_ONBELLEK[kayit.evrenId] = json.evrenOzeti;
        }
      }
    } catch (hata) {
      console.warn('Alım sunucuya gönderilirken ağ gecikmesi:', hata);
    }

    try {
      window.dispatchEvent(new CustomEvent('tf-alim-yapildi', { detail: kayit }));
    } catch {}

    return kayit;
  }

  async function evrenAlimlariGetir(evrenId) {
    if (!evrenId) return null;
    try {
      const yanit = await fetch(`/api/alimlar?evren=${encodeURIComponent(evrenId)}`);
      if (yanit.ok) {
        const json = await yanit.json();
        if (json && json.durum === 'ok') {
          ALIM_ONBELLEK[evrenId] = json.evrenOzeti;
          return json;
        }
      }
    } catch {}

    // Çevrimdışı ya da sunucu yanıt vermezse yerel depodan dön
    const yerel = yerelAlimlarOku();
    const ev = (yerel.evrenler && yerel.evrenler[evrenId]) || {
      id: evrenId,
      toplamAlim: 0,
      toplamEcka: 0,
      roman: { adet: 0, ecka: 0 },
      cizim: { adet: 0, ecka: 0 },
      sonAlimlar: []
    };
    const alimlar = (yerel.alimlar || []).filter((a) => a.evrenId === evrenId);
    return { durum: 'ok', evrenId: evrenId, evrenOzeti: ev, alimlar: alimlar };
  }

  async function sahipAlimlariGetir(sahip) {
    try {
      const url = sahip ? `/api/alimlar?sahip=${encodeURIComponent(sahip)}` : '/api/alimlar';
      const yanit = await fetch(url);
      if (yanit.ok) {
        return await yanit.json();
      }
    } catch {}
    return yerelAlimlarOku();
  }

  function icerikSatinAl(ayarlar) {
    const secenek = ayarlar || {};
    const kilitId = secenek.id;
    const fiyat = Math.max(0, Number(secenek.fiyat) || 0);
    const baslik = secenek.baslik || 'İçerik';
    const paraBirimi = typeof birim === 'function' ? birim() : 'eçka';

    if (!kilitId) return false;

    // Zaten açık mı?
    if (typeof kilitAcik === 'function' && kilitAcik(kilitId)) {
      if (typeof secenek.onBasarili === 'function') secenek.onBasarili();
      return true;
    }

    // Ücretsiz mi?
    if (fiyat <= 0) {
      if (typeof cuzdan !== 'undefined' && cuzdan && Array.isArray(cuzdan.acilan)) {
        if (cuzdan.acilan.indexOf(kilitId) === -1) {
          cuzdan.acilan.push(kilitId);
          if (typeof cuzdanKaydet === 'function') cuzdanKaydet();
        }
      }
      if (typeof secenek.onBasarili === 'function') secenek.onBasarili();
      return true;
    }

    // Yeterli eçka var mı?
    if (typeof eckaVar === 'function' && !eckaVar(fiyat)) {
      const bakiye = (typeof cuzdan !== 'undefined' && cuzdan && cuzdan.ecka) || 0;
      const eksik = Math.max(0, fiyat - bakiye);
      if (typeof eckaBildir === 'function') {
        eckaBildir(`Yeterli ${paraBirimi} yok · ${eksik} ${paraBirimi} eksik`);
      }
      return false;
    }

    // Eçka harca ve kilidi aç
    let acildi = false;
    if (typeof kilitAc === 'function') {
      acildi = kilitAc(kilitId, fiyat);
    } else if (typeof eckaHarca === 'function') {
      acildi = eckaHarca(fiyat, secenek.tur || 'icerik');
      if (acildi && typeof cuzdan !== 'undefined' && cuzdan && Array.isArray(cuzdan.acilan)) {
        cuzdan.acilan.push(kilitId);
        if (typeof cuzdanKaydet === 'function') cuzdanKaydet();
      }
    }

    if (!acildi) {
      if (typeof eckaBildir === 'function') eckaBildir('Satın alma tamamlanamadı.');
      return false;
    }

    // Sunucuya kaydet
    alimKaydet({
      icerikTur: secenek.tur || 'roman',
      icerikId: kilitId,
      icerikBaslik: baslik,
      evrenId: secenek.evrenId || 'tomye',
      evrenAd: secenek.evrenAd || 'Tömye',
      evrenSahip: secenek.evrenSahip || 'TentiFor',
      tutar: fiyat,
      birim: paraBirimi
    });

    if (typeof eckaBildir === 'function') {
      eckaBildir(`${baslik} açıldı · −${fiyat} ${paraBirimi}`);
    }

    if (typeof secenek.onBasarili === 'function') secenek.onBasarili();
    return true;
  }

  // Evren sahibi kontrolü
  function evrenSahibiMi(sayfa) {
    if (!sayfa || !sayfa.eser) return false;
    if (typeof EVS !== 'undefined' && EVS && EVS.kaynak === 'benim') return true;
    if (typeof yoneticiAcik === 'function' && yoneticiAcik()) return true;

    const aktifAd = aktifAliciAdi();
    const eser = sayfa.eser;
    if (aktifAd && (eser.sahip === aktifAd || eser.yazar === aktifAd)) return true;

    // Kanon evrenlerde yönetici açıkken sahibi sayılır
    if (sayfa.kaynak === 'site' && typeof yoneticiAcik === 'function' && yoneticiAcik()) return true;
    return false;
  }

  // Evren Sahibi Alımlar & Gelir Paneli HTML
  function evrenAlimlarHtml(sayfa) {
    const eser = sayfa && sayfa.eser ? sayfa.eser : {};
    const evrenId = (typeof EVS !== 'undefined' && EVS && EVS.id) || eser.id || 'tomye';
    const evrenAd = eser.ad || eser.baslik || 'Evren';
    const paraBirimi = typeof birim === 'function' ? birim() : 'eçka';

    const db = ALIM_ONBELLEK[evrenId] || ((yerelAlimlarOku().evrenler || {})[evrenId]) || {
      toplamAlim: 0,
      toplamEcka: 0,
      roman: { adet: 0, ecka: 0 },
      cizim: { adet: 0, ecka: 0 },
      sonAlimlar: []
    };

    const romanAdet = (db.roman && db.roman.adet) || 0;
    const romanEcka = (db.roman && db.roman.ecka) || 0;
    const cizimAdet = (db.cizim && db.cizim.adet) || 0;
    const cizimEcka = (db.cizim && db.cizim.ecka) || 0;
    const toplamAlim = db.toplamAlim || (romanAdet + cizimAdet);
    const toplamEcka = db.toplamEcka || (romanEcka + cizimEcka);
    const sonAlimlar = Array.isArray(db.sonAlimlar) ? db.sonAlimlar : [];

    // İçerik listesi dökümü (roman bölümleri ve çizimler)
    const romanBolumler = (eser.roman && Array.isArray(eser.roman.bolumler)) ? eser.roman.bolumler : [];
    const cizimler = Array.isArray(eser.cizimler) ? eser.cizimler : [];

    let icerikDökümüHtml = '';
    if (romanBolumler.length > 0 || cizimler.length > 0) {
      icerikDökümüHtml = `
        <div class="kutu-y tf-alim-blok" style="margin-top:16px;">
          <div class="oyun-etiket">Evrenindeki Satıştaki İçerikler</div>
          <div class="tf-alim-icerik-tablo" style="display:grid; gap:8px; margin-top:8px;">
            ${romanBolumler.map((b, i) => {
              const bFiyat = Number(b.fiyat) || 0;
              const alimSayisi = sonAlimlar.filter((a) => a.icerikId === `evr_${evrenId}_roman_${b.id || i}`).length;
              return `
                <div class="tf-alim-satir" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--kar,#f8faf9); border:1px solid var(--buz,#e0e7e5); border-radius:8px;">
                  <div>
                    <span class="y-rozet" style="background:#205493; color:#fff; font-size:11px; padding:2px 6px; margin-right:6px;">Roman</span>
                    <b>${typeof kacir === 'function' ? kacir(b.baslik || `${i + 1}. Bölüm`) : (b.baslik || `${i + 1}. Bölüm`)}</b>
                    <span class="oyun-not" style="margin-left:8px;">${bFiyat > 0 ? `${bFiyat} ${paraBirimi}` : 'Ücretsiz'}</span>
                  </div>
                  <div style="font-size:13px; color:var(--murekkep-2,#4a5568);">
                    <b>${alimSayisi}</b> alım · <b>${alimSayisi * bFiyat}</b> ${paraBirimi} gelir
                  </div>
                </div>
              `;
            }).join('')}
            ${cizimler.map((c, i) => {
              const cFiyat = Number(c.fiyat) || 0;
              const alimSayisi = sonAlimlar.filter((a) => a.icerikId === `evr_${evrenId}_cizim_${c.id || i}`).length;
              return `
                <div class="tf-alim-satir" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--kar,#f8faf9); border:1px solid var(--buz,#e0e7e5); border-radius:8px;">
                  <div>
                    <span class="y-rozet" style="background:#176c61; color:#fff; font-size:11px; padding:2px 6px; margin-right:6px;">Çizim</span>
                    <b>${typeof kacir === 'function' ? kacir(c.baslik || `Çizim ${i + 1}`) : (c.baslik || `Çizim ${i + 1}`)}</b>
                    <span class="oyun-not" style="margin-left:8px;">${cFiyat > 0 ? `${cFiyat} ${paraBirimi}` : 'Ücretsiz'}</span>
                  </div>
                  <div style="font-size:13px; color:var(--murekkep-2,#4a5568);">
                    <b>${alimSayisi}</b> alım · <b>${alimSayisi * cFiyat}</b> ${paraBirimi} gelir
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    return `
      <section class="evr-alimlar-paneli" style="padding:10px 0;">
        <div class="kutu-y tf-alim-ozet-kutu" style="background:var(--beyaz,#fff); border:1px solid var(--buz,#e0e7e5); border-radius:12px; padding:18px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
            <div>
              <span class="oyun-etiket" style="color:var(--deniz,#176c61); font-weight:700;">Evren Sahibi Paneli</span>
              <h2 style="margin:4px 0 6px; font-size:1.45rem;">💰 ${typeof kacir === 'function' ? kacir(evrenAd) : evrenAd} — Alımlar ve Gelir</h2>
              <p class="oyun-not" style="margin:0;">Okurlar evrenindeki roman ve çizimleri eçka ile satın aldıkça veriler sunucuya yazılır ve burada listelenir.</p>
            </div>
            <div class="oyun-sira">
              <button type="button" class="dugme dugme-sade" data-alim-yenile="${typeof kacir === 'function' ? kacir(evrenId) : evrenId}" title="Sunucudan en güncel alımları getir">
                🔄 Canlı Verileri Yenile
              </button>
            </div>
          </div>

          <!-- Ana Metrikler -->
          <div class="tf-alim-metrikler" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-top:16px;">
            <div style="background:var(--kar,#f8faf9); padding:14px; border-radius:10px; border:1px solid var(--buz,#e0e7e5); text-align:center;">
              <span style="font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:var(--murekkep-2,#4a5568); display:block;">Toplam Gelir</span>
              <b style="font-size:1.6rem; color:var(--deniz,#176c61); display:block; margin-top:2px;">${toplamEcka} <small style="font-size:12px;">${paraBirimi}</small></b>
            </div>
            <div style="background:var(--kar,#f8faf9); padding:14px; border-radius:10px; border:1px solid var(--buz,#e0e7e5); text-align:center;">
              <span style="font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:var(--murekkep-2,#4a5568); display:block;">Toplam Satış</span>
              <b style="font-size:1.6rem; color:var(--murekkep,#17212b); display:block; margin-top:2px;">${toplamAlim} <small style="font-size:12px;">adet</small></b>
            </div>
            <div style="background:var(--kar,#f8faf9); padding:14px; border-radius:10px; border:1px solid var(--buz,#e0e7e5); text-align:center;">
              <span style="font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:var(--murekkep-2,#4a5568); display:block;">Roman Geliri</span>
              <b style="font-size:1.4rem; color:#205493; display:block; margin-top:2px;">${romanEcka} <small style="font-size:12px;">${paraBirimi}</small></b>
              <span style="font-size:11.5px; color:var(--murekkep-2);">${romanAdet} alım</span>
            </div>
            <div style="background:var(--kar,#f8faf9); padding:14px; border-radius:10px; border:1px solid var(--buz,#e0e7e5); text-align:center;">
              <span style="font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:var(--murekkep-2,#4a5568); display:block;">Çizim Geliri</span>
              <b style="font-size:1.4rem; color:#854d0e; display:block; margin-top:2px;">${cizimEcka} <small style="font-size:12px;">${paraBirimi}</small></b>
              <span style="font-size:11.5px; color:var(--murekkep-2);">${cizimAdet} alım</span>
            </div>
          </div>
        </div>

        ${icerikDökümüHtml}

        <!-- Son Alımlar Geçmişi Tablosu -->
        <div class="kutu-y tf-alim-gecmis" style="margin-top:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div class="oyun-etiket">Sunucuya Yazılan Alım Geçmişi</div>
            <span class="oyun-not">${sonAlimlar.length} kayıt listeleniyor</span>
          </div>

          ${sonAlimlar.length === 0 ? `
            <p class="oyun-not" style="padding:16px; text-align:center; background:var(--kar,#f8faf9); border-radius:8px;">
              Bu evrene henüz eçka ile içerik alımı kaydedilmedi. Okurlar roman veya çizimleri satın aldığında anında burada görünecek.
            </p>
          ` : `
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:13.5px; text-align:left;">
                <thead>
                  <tr style="border-bottom:2px solid var(--buz,#e0e7e5); color:var(--murekkep-2,#4a5568);">
                    <th style="padding:8px 10px;">Zaman</th>
                    <th style="padding:8px 10px;">İçerik</th>
                    <th style="padding:8px 10px;">Tür</th>
                    <th style="padding:8px 10px;">Alıcı</th>
                    <th style="padding:8px 10px; text-align:right;">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  ${sonAlimlar.map((a) => {
                    const zamanMetni = a.tarih ? new Date(a.tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
                    const turRenk = a.icerikTur === 'roman' ? '#205493' : '#176c61';
                    return `
                      <tr style="border-bottom:1px solid var(--buz,#e0e7e5);">
                        <td style="padding:8px 10px; color:var(--murekkep-2,#4a5568);">${zamanMetni}</td>
                        <td style="padding:8px 10px; font-weight:600;">${typeof kacir === 'function' ? kacir(a.icerikBaslik || 'İçerik') : (a.icerikBaslik || 'İçerik')}</td>
                        <td style="padding:8px 10px;">
                          <span style="font-size:11px; padding:2px 6px; border-radius:999px; background:${turRenk}; color:#fff; text-transform:uppercase;">${a.icerikTur || 'roman'}</span>
                        </td>
                        <td style="padding:8px 10px;">@${typeof kacir === 'function' ? kacir(a.alici || 'okur') : (a.alici || 'okur')}</td>
                        <td style="padding:8px 10px; text-align:right; font-weight:700; color:var(--deniz,#176c61);">+${a.tutar} ${a.birim || paraBirimi}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </section>
    `;
  }

  // Evren Roman Sekmesi (Okuma & Eçka ile Satın Alma)
  function evrenRomanHtml(sayfa) {
    const eser = sayfa && sayfa.eser ? sayfa.eser : {};
    const evrenId = (typeof EVS !== 'undefined' && EVS && EVS.id) || eser.id || 'tomye';
    const evrenAd = eser.ad || 'Evren';
    const evrenSahip = eser.sahip || eser.yazar || 'Evren Sahibi';
    const roman = eser.roman || {};
    const bolumler = Array.isArray(roman.bolumler) ? roman.bolumler : [];
    const paraBirimi = typeof birim === 'function' ? birim() : 'eçka';

    if (!bolumler.length) {
      return '<div class="kutu-y"><p class="oyun-not">Bu evrende henüz yazılmış bir roman bölümü yok.</p></div>';
    }

    const seciliBolumId = sayfa.seciliBolum || (bolumler[0] && bolumler[0].id) || '0';
    const seciliBolum = bolumler.find((b, idx) => (b.id ? b.id === seciliBolumId : String(idx) === String(seciliBolumId))) || bolumler[0];
    const seciliIdx = bolumler.indexOf(seciliBolum);

    const kilitId = `evr_${evrenId}_roman_${seciliBolum.id || seciliIdx}`;
    const fiyat = Math.max(0, Number(seciliBolum.fiyat) || 0);
    const acikMi = fiyat === 0 || (typeof kilitAcik === 'function' && kilitAcik(kilitId));

    return `
      <section class="evr-roman-sekmesi" style="padding:8px 0;">
        <div class="kutu-y" style="margin-bottom:14px;">
          <h3 style="margin:0 0 6px;">📖 ${typeof kacir === 'function' ? kacir(roman.baslik || `${evrenAd} Romanı`) : (roman.baslik || `${evrenAd} Romanı`)}</h3>
          ${roman.ozet ? `<p class="oyun-not" style="margin:0 0 10px;">${typeof kacir === 'function' ? kacir(roman.ozet) : roman.ozet}</p>` : ''}
          <div class="liste" style="display:grid; gap:6px;">
            ${bolumler.map((b, idx) => {
              const bKilitId = `evr_${evrenId}_roman_${b.id || idx}`;
              const bFiyat = Math.max(0, Number(b.fiyat) || 0);
              const bAcik = bFiyat === 0 || (typeof kilitAcik === 'function' && kilitAcik(bKilitId));
              const secili = b === seciliBolum;
              return `
                <button type="button" class="satir ${secili ? 'secili' : ''}" data-evren-bolum-sec="${b.id || idx}" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; text-align:left; border:1px solid ${secili ? 'var(--deniz)' : 'var(--buz)'}; border-radius:8px; background:${secili ? 'var(--buz)' : 'var(--beyaz)'}; cursor:pointer;">
                  <div>
                    <span style="font-weight:700; margin-right:8px;">${idx + 1}.</span>
                    <b>${typeof kacir === 'function' ? kacir(b.baslik || `${idx + 1}. Bölüm`) : (b.baslik || `${idx + 1}. Bölüm`)}</b>
                  </div>
                  <div>
                    ${bAcik ? '<span style="color:var(--deniz); font-weight:600; font-size:12px;">Okunabilir ›</span>' : `<span class="roman-fiyat" style="font-weight:700; font-size:12px; color:#c98a0b;">🔒 ${bFiyat} ${paraBirimi}</span>`}
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="kutu-y okuma-alani" style="background:var(--beyaz,#fff); border:1px solid var(--buz,#e0e7e5); border-radius:10px; padding:18px;">
          <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid var(--buz); padding-bottom:8px; margin-bottom:14px;">
            <h4 style="margin:0; font-size:1.25rem;">${seciliIdx + 1}. Bölüm · ${typeof kacir === 'function' ? kacir(seciliBolum.baslik || '') : seciliBolum.baslik}</h4>
            <span class="oyun-not">${acikMi ? 'Açık' : `Kilitli (${fiyat} ${paraBirimi})`}</span>
          </div>

          ${acikMi ? `
            <div class="okuma-metin fan-metin" style="font-size:16px; line-height:1.7;">
              ${seciliBolum.metin ? (typeof paragraf === 'function' ? paragraf(seciliBolum.metin) : `<p>${seciliBolum.metin}</p>`) : '<p class="oyun-not">Bu bölüm henüz yazılmadı.</p>'}
            </div>
          ` : `
            <div class="roman-kilit-kutu" style="text-align:center; padding:30px 16px; background:var(--kar,#f8faf9); border-radius:8px; border:1px dashed var(--sig,#cbd5e1);">
              <div style="font-size:2.4rem; margin-bottom:8px;">🔒</div>
              <h4 style="margin:0 0 6px;">Bu bölüm eçka ile kilitli</h4>
              <p class="oyun-not" style="max-width:400px; margin:0 auto 16px;">
                Evren sahibinin belirlediği bu bölümü okumak için <b>${fiyat} ${paraBirimi}</b> harcayarak hemen açabilirsin. Satın alımın evrenin sahibinin gelirine yazılacaktır.
              </p>
              <button type="button" class="dugme" data-evren-bolum-al="${typeof kacir === 'function' ? kacir(kilitId) : kilitId}" data-evren-id="${typeof kacir === 'function' ? kacir(evrenId) : evrenId}" data-evren-ad="${typeof kacir === 'function' ? kacir(evrenAd) : evrenAd}" data-evren-sahip="${typeof kacir === 'function' ? kacir(evrenSahip) : evrenSahip}" data-baslik="${typeof kacir === 'function' ? kacir(`${seciliIdx + 1}. Bölüm · ${seciliBolum.baslik || ''}`) : `${seciliIdx + 1}. Bölüm`}" data-fiyat="${fiyat}">
                🛒 ${fiyat} ${paraBirimi} ile Satın Al ve Aç
              </button>
            </div>
          `}
        </div>
      </section>
    `;
  }

  // Evren Çizimler Sekmesi (Galeri & Eçka ile Satın Alma)
  function evrenCizimlerHtml(sayfa) {
    const eser = sayfa && sayfa.eser ? sayfa.eser : {};
    const evrenId = (typeof EVS !== 'undefined' && EVS && EVS.id) || eser.id || 'tomye';
    const evrenAd = eser.ad || 'Evren';
    const evrenSahip = eser.sahip || eser.yazar || 'Evren Sahibi';
    const cizimler = Array.isArray(eser.cizimler) ? eser.cizimler : [];
    const paraBirimi = typeof birim === 'function' ? birim() : 'eçka';

    if (!cizimler.length) {
      return '<div class="kutu-y"><p class="oyun-not">Bu evrende henüz eklenmiş çizim yok.</p></div>';
    }

    return `
      <section class="evr-cizimler-sekmesi" style="padding:8px 0;">
        <div class="kutu-y" style="margin-bottom:14px;">
          <h3 style="margin:0 0 6px;">🎨 ${typeof kacir === 'function' ? kacir(evrenAd) : evrenAd} Çizimleri ve Görselleri</h3>
          <p class="oyun-not" style="margin:0;">Evrenin atmosferini ve sahnelerini gösteren sanat çalışmaları.</p>
        </div>

        <div class="galeri-izgara" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:14px;">
          ${cizimler.map((c, idx) => {
            const kilitId = `evr_${evrenId}_cizim_${c.id || idx}`;
            const fiyat = Math.max(0, Number(c.fiyat) || 0);
            const acikMi = fiyat === 0 || (typeof kilitAcik === 'function' && kilitAcik(kilitId));
            const gorselKaynak = (typeof cizimKaynak === 'function' ? cizimKaynak(c) : (c.yol || c.gorsel || '')) || '';

            return `
              <div class="galeri-kart ${acikMi ? '' : 'kilitli'}" style="background:var(--beyaz); border:1px solid var(--buz); border-radius:10px; overflow:hidden; display:flex; flex-direction:column;">
                <div class="galeri-gorsel" style="height:190px; background:var(--kar); display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;">
                  ${acikMi ? (
                    gorselKaynak ? `<img src="${typeof kacir === 'function' ? kacir(gorselKaynak) : gorselKaynak}" alt="${typeof kacir === 'function' ? kacir(c.baslik || 'Çizim') : 'Çizim'}" loading="lazy" style="width:100%; height:100%; object-fit:cover;">` : '<div class="galeri-bos">Görsel bulunamadı</div>'
                  ) : `
                    <div style="filter:blur(10px); width:100%; height:100%; background:#718096; opacity:0.6;"></div>
                    <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.45); color:#fff; text-align:center; padding:12px;">
                      <span style="font-size:1.8rem; margin-bottom:4px;">🔒</span>
                      <b style="font-size:14px; margin-bottom:6px;">${fiyat} ${paraBirimi}</b>
                      <button type="button" class="dugme" style="font-size:12px; padding:6px 12px;" data-evren-cizim-al="${typeof kacir === 'function' ? kacir(kilitId) : kilitId}" data-evren-id="${typeof kacir === 'function' ? kacir(evrenId) : evrenId}" data-evren-ad="${typeof kacir === 'function' ? kacir(evrenAd) : evrenAd}" data-evren-sahip="${typeof kacir === 'function' ? kacir(evrenSahip) : evrenSahip}" data-baslik="${typeof kacir === 'function' ? kacir(c.baslik || `Çizim #${idx + 1}`) : `Çizim #${idx + 1}`}" data-fiyat="${fiyat}">
                        Aç (${fiyat} ${paraBirimi})
                      </button>
                    </div>
                  `}
                </div>
                <div class="galeri-alt" style="padding:10px 12px; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                  <div>
                    <span class="galeri-tur" style="font-size:11px; text-transform:uppercase; color:var(--deniz); font-weight:700;">Çizim</span>
                    <h4 style="margin:2px 0 4px; font-size:14px;">${typeof kacir === 'function' ? kacir(c.baslik || `Çizim #${idx + 1}`) : (c.baslik || `Çizim #${idx + 1}`)}</h4>
                    <p class="galeri-aciklama" style="font-size:12.5px; color:var(--murekkep-2); margin:0;">${typeof kacir === 'function' ? kacir(acikMi ? (c.aciklama || '') : 'Eçka ile kilitli görsel') : (acikMi ? (c.aciklama || '') : 'Eçka ile kilitli görsel')}</p>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  // Hook evrenEkSekmeler & evrenEkBolum
  const oncekiSekmeler = window.evrenEkSekmeler;
  const oncekiBolum = window.evrenEkBolum;

  window.evrenEkSekmeler = function (sayfa) {
    const liste = typeof oncekiSekmeler === 'function' ? (oncekiSekmeler(sayfa) || []) : [];
    const sonuc = Array.isArray(liste) ? liste.slice() : [];

    const eser = sayfa && sayfa.eser;
    if (eser) {
      // Roman sekmesi
      if (eser.roman && Array.isArray(eser.roman.bolumler) && eser.roman.bolumler.length > 0) {
        if (!sonuc.some((s) => s && s[0] === 'roman')) {
          sonuc.push(['roman', '📖 Roman']);
        }
      }
      // Çizimler sekmesi
      if (Array.isArray(eser.cizimler) && eser.cizimler.length > 0) {
        if (!sonuc.some((s) => s && s[0] === 'cizim')) {
          sonuc.push(['cizim', '🎨 Çizimler']);
        }
      }
      // Evren Sahibi Alımlar sekmesi
      if (evrenSahibiMi(sayfa)) {
        if (!sonuc.some((s) => s && s[0] === 'alimlar')) {
          sonuc.push(['alimlar', '💰 Alımlar & Gelir']);
        }
      }
    }

    return sonuc;
  };

  window.evrenEkBolum = function (sayfa) {
    if (typeof EVS !== 'undefined' && EVS) {
      if (EVS.sekme === 'alimlar') {
        return evrenAlimlarHtml(sayfa);
      }
      if (EVS.sekme === 'roman') {
        return evrenRomanHtml(sayfa);
      }
      if (EVS.sekme === 'cizim') {
        return evrenCizimlerHtml(sayfa);
      }
    }
    return typeof oncekiBolum === 'function' ? oncekiBolum(sayfa) : null;
  };

  // Bilgi sekmesinde evren sahibi için Gelir Özeti Kartı ekleme
  function evrenSahibiGelirRozetiHtml(sayfa) {
    if (!evrenSahibiMi(sayfa)) return '';
    const eser = sayfa.eser || {};
    const evrenId = eser.id || 'tomye';
    const db = ALIM_ONBELLEK[evrenId] || ((yerelAlimlarOku().evrenler || {})[evrenId]) || { toplamAlim: 0, toplamEcka: 0 };
    const paraBirimi = typeof birim === 'function' ? birim() : 'eçka';

    return `
      <div class="kutu-y tf-sahip-gelir-serit" style="background:var(--beyaz); border:2px solid var(--deniz); border-radius:10px; padding:12px 16px; margin:12px 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <span class="oyun-etiket" style="color:var(--deniz);">Evreninin Satış Geliri</span>
          <div style="font-size:15px; margin-top:2px;">
            💰 <b>${db.toplamEcka || 0} ${paraBirimi}</b> kazanıldı · <b>${db.toplamAlim || 0}</b> içerik alımı
          </div>
        </div>
        <button type="button" class="dugme" data-evs-sekme="alimlar" style="font-size:13px; padding:6px 12px;">
          Alımları ve Raporu Gör →
        </button>
      </div>
    `;
  }

  // Tıklama olayları (Satın alımlar, yenileme ve bölüm seçimi)
  document.addEventListener('click', async function (e) {
    const hedef = e.target.closest && e.target.closest('[data-evren-bolum-al], [data-evren-cizim-al], [data-alim-yenile], [data-evren-bolum-sec]');
    if (!hedef) return;

    // Roman bölümü satın al
    if (hedef.hasAttribute('data-evren-bolum-al')) {
      const kilitId = hedef.getAttribute('data-evren-bolum-al');
      const evrenId = hedef.getAttribute('data-evren-id') || 'tomye';
      const evrenAd = hedef.getAttribute('data-evren-ad') || 'Evren';
      const evrenSahip = hedef.getAttribute('data-evren-sahip') || 'Evren Sahibi';
      const baslik = hedef.getAttribute('data-baslik') || 'Roman Bölümü';
      const fiyat = Number(hedef.getAttribute('data-fiyat')) || 0;

      icerikSatinAl({
        tur: 'roman',
        id: kilitId,
        baslik: baslik,
        evrenId: evrenId,
        evrenAd: evrenAd,
        evrenSahip: evrenSahip,
        fiyat: fiyat,
        onBasarili: function () {
          if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
        }
      });
      return;
    }

    // Çizim satın al
    if (hedef.hasAttribute('data-evren-cizim-al')) {
      const kilitId = hedef.getAttribute('data-evren-cizim-al');
      const evrenId = hedef.getAttribute('data-evren-id') || 'tomye';
      const evrenAd = hedef.getAttribute('data-evren-ad') || 'Evren';
      const evrenSahip = hedef.getAttribute('data-evren-sahip') || 'Evren Sahibi';
      const baslik = hedef.getAttribute('data-baslik') || 'Çizim';
      const fiyat = Number(hedef.getAttribute('data-fiyat')) || 0;

      icerikSatinAl({
        tur: 'cizim',
        id: kilitId,
        baslik: baslik,
        evrenId: evrenId,
        evrenAd: evrenAd,
        evrenSahip: evrenSahip,
        fiyat: fiyat,
        onBasarili: function () {
          if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
        }
      });
      return;
    }

    // Alımları yenile
    if (hedef.hasAttribute('data-alim-yenile')) {
      const evrenId = hedef.getAttribute('data-alim-yenile');
      hedef.disabled = true;
      hedef.textContent = 'Yenileniyor…';
      try {
        await evrenAlimlariGetir(evrenId);
        if (typeof eckaBildir === 'function') eckaBildir('Alımlar güncellendi.');
      } finally {
        hedef.disabled = false;
        hedef.textContent = '🔄 Canlı Verileri Yenile';
        if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      }
      return;
    }

    // Roman bölümü değiştir
    if (hedef.hasAttribute('data-evren-bolum-sec')) {
      const bolumId = hedef.getAttribute('data-evren-bolum-sec');
      if (typeof EVS !== 'undefined' && EVS) {
        EVS.seciliBolum = bolumId;
        if (typeof evrenSayfaCiz === 'function') evrenSayfaCiz();
      }
      return;
    }
  });

  // Global API erişimi
  window.tfAlimServisi = {
    kaydet: alimKaydet,
    evrenAlimlariGetir: evrenAlimlariGetir,
    sahipAlimlariGetir: sahipAlimlariGetir,
    yerelAlimlarOku: yerelAlimlarOku,
    icerikSatinAl: icerikSatinAl,
    evrenSahibiMi: evrenSahibiMi,
    evrenAlimlarHtml: evrenAlimlarHtml,
    evrenSahibiGelirRozetiHtml: evrenSahibiGelirRozetiHtml
  };
  window.alimKaydet = alimKaydet;
  window.icerikSatinAl = icerikSatinAl;
  window.evrenAlimlariGetir = evrenAlimlariGetir;
  window.sahipAlimlariGetir = sahipAlimlariGetir;

  // Başlangıçta arka planda sunucudaki güncel alımları çek
  setTimeout(() => {
    fetch('/api/alimlar')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.evrenler) {
          Object.assign(ALIM_ONBELLEK, data.evrenler);
          const yerel = yerelAlimlarOku();
          yerel.evrenler = Object.assign(yerel.evrenler || {}, data.evrenler);
          yerel.toplamAlim = data.toplamAlim || yerel.toplamAlim;
          yerel.toplamEcka = data.toplamEcka || yerel.toplamEcka;
          yerelAlimlarYaz(yerel);
        }
      })
      .catch(() => {});
  }, 1000);
})();
