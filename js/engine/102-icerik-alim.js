// Tentifor — içerik kilitleri yalnızca cihazdaki sanal eçka ile açılır.
// Bu modül ürün alımı için sunucu/API veya satıcı gelir kaydı kullanmaz.
(function () {
  'use strict';

  const PARA_BIRIMI = 'eçka';
  const oncekiSekmeler = window.evrenEkSekmeler;
  const oncekiBolum = window.evrenEkBolum;

  function kacir(deger) {
    if (typeof window.kacir === 'function') return window.kacir(deger);
    return String(deger == null ? '' : deger).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function acikMi(id, fiyat) {
    return Number(fiyat) <= 0 || (typeof window.kilitAcik === 'function' && window.kilitAcik(id));
  }

  function icerikSatinAl(icerik) {
    const id = String(icerik && icerik.id || '');
    const fiyat = Math.max(0, Math.floor(Number(icerik && icerik.fiyat) || 0));
    if (!id) return false;
    if (typeof window.kilitAcik === 'function' && window.kilitAcik(id)) return true;
    if (fiyat > 0 && typeof window.eckaVar === 'function' && !window.eckaVar(fiyat)) {
      if (typeof window.eckaBildir === 'function') window.eckaBildir('Yeterli eçkan yok.');
      return false;
    }
    if (typeof window.kilitAc !== 'function' || !window.kilitAc(id, fiyat)) {
      if (typeof window.eckaBildir === 'function') window.eckaBildir('İçerik açılamadı; eçka bakiyeni kontrol et.');
      return false;
    }
    if (typeof window.eckaBildir === 'function') {
      window.eckaBildir(fiyat > 0 ? 'İçerik açıldı · −' + fiyat + ' ' + PARA_BIRIMI : 'Ücretsiz içerik açıldı.');
    }
    if (typeof icerik.onBasarili === 'function') icerik.onBasarili();
    return true;
  }

  function romanHtml(sayfa) {
    const eser = sayfa && sayfa.eser || {};
    const bolumler = eser.roman && Array.isArray(eser.roman.bolumler) ? eser.roman.bolumler : [];
    if (!bolumler.length) return '<div class="kutu-y"><p class="oyun-not">Bu evrende henüz yazılmış bir roman bölümü yok.</p></div>';
    const seciliId = String((typeof EVS !== 'undefined' && EVS && EVS.seciliBolum) || sayfa.seciliBolum || bolumler[0].id || '0');
    const secili = bolumler.find((b, i) => String(b.id == null ? i : b.id) === seciliId) || bolumler[0];
    const seciliIdx = bolumler.indexOf(secili);
    const evrenId = (typeof EVS !== 'undefined' && EVS && EVS.id) || eser.id || 'evren';
    const bolumId = (b, i) => 'evr_' + evrenId + '_roman_' + (b.id == null ? i : b.id);
    const kilitId = bolumId(secili, seciliIdx);
    const fiyat = Math.max(0, Math.floor(Number(secili.fiyat) || 0));
    const acik = acikMi(kilitId, fiyat);
    const plan = (b, i) => {
      const id = bolumId(b, i);
      const tutar = Math.max(0, Math.floor(Number(b.fiyat) || 0));
      return '<button type="button" class="satir" data-evren-bolum-sec="' + kacir(b.id == null ? i : b.id) + '"><span>' + (i + 1) + '. ' + kacir(b.baslik || 'Bölüm') + '</span><span>' + (acikMi(id, tutar) ? 'Okunabilir' : '🔒 ' + tutar + ' ' + PARA_BIRIMI) + '</span></button>';
    };
    const metin = secili.metin || '';
    return '<section class="evr-roman-sekmesi"><div class="kutu-y"><h3>📖 ' + kacir(eser.roman.baslik || eser.ad || 'Roman') + '</h3><div class="liste">' + bolumler.map(plan).join('') + '</div></div>' +
      (acik ? '<article class="kutu-y okuma-alani"><h4>' + (seciliIdx + 1) + '. Bölüm · ' + kacir(secili.baslik || '') + '</h4><div class="okuma-metin">' + (metin ? (typeof window.paragraf === 'function' ? window.paragraf(metin) : '<p>' + kacir(metin) + '</p>') : '<p class="oyun-not">Bu bölüm henüz yazılmadı.</p>') + '</div></article>' :
        '<div class="kutu-y roman-kilit-kutu"><h4>Bu bölüm eçka ile kilitli</h4><p>' + fiyat + ' eçka harcayarak aç. Eçka yalnızca site içi sanal paradır; gerçek para veya kart kullanılmaz.</p><button type="button" class="dugme" data-evren-bolum-al="' + kacir(kilitId) + '" data-fiyat="' + fiyat + '">🛒 ' + fiyat + ' eçka ile aç</button></div>') + '</section>';
  }

  function cizimlerHtml(sayfa) {
    const eser = sayfa && sayfa.eser || {};
    const cizimler = Array.isArray(eser.cizimler) ? eser.cizimler : [];
    if (!cizimler.length) return '<div class="kutu-y"><p class="oyun-not">Bu evrende henüz eklenmiş çizim yok.</p></div>';
    const evrenId = (typeof EVS !== 'undefined' && EVS && EVS.id) || eser.id || 'evren';
    return '<section class="evr-cizimler-sekmesi"><div class="kutu-y"><h3>🎨 ' + kacir(eser.ad || 'Evren') + ' çizimleri</h3><p class="oyun-not">Kilitli çizimler yalnızca site içi sanal eçka ile açılır; gerçek para veya kart kullanılmaz.</p></div><div class="galeri-izgara">' +
      cizimler.map((c, i) => {
        const id = 'evr_' + evrenId + '_cizim_' + (c.id == null ? i : c.id);
        const fiyat = Math.max(0, Math.floor(Number(c.fiyat) || 0));
        const acik = acikMi(id, fiyat);
        const src = (typeof window.cizimKaynak === 'function' ? window.cizimKaynak(c) : (c.yol || c.gorsel || '')) || '';
        const icerik = acik ? (src ? '<img src="' + kacir(src) + '" alt="' + kacir(c.baslik || 'Çizim') + '" loading="lazy">' : '<div class="galeri-bos">Görsel bulunamadı</div>') :
          '<div class="galeri-kilit"><b>🔒 ' + fiyat + ' eçka</b><button type="button" class="dugme" data-evren-cizim-al="' + kacir(id) + '" data-fiyat="' + fiyat + '">Aç (' + fiyat + ' eçka)</button></div>';
        return '<article class="galeri-kart ' + (acik ? '' : 'kilitli') + '"><div class="galeri-gorsel">' + icerik + '</div><div class="galeri-alt"><h4>' + kacir(c.baslik || 'Çizim ' + (i + 1)) + '</h4><p>' + kacir(acik ? (c.aciklama || '') : 'Eçka ile kilitli görsel') + '</p></div></article>';
      }).join('') + '</div></section>';
  }

  window.evrenEkSekmeler = function (sayfa) {
    const oncekiler = typeof oncekiSekmeler === 'function' ? oncekiSekmeler(sayfa) : [];
    const sonuc = Array.isArray(oncekiler) ? oncekiler.slice() : [];
    const eser = sayfa && sayfa.eser;
    if (eser && eser.roman && Array.isArray(eser.roman.bolumler) && eser.roman.bolumler.length && !sonuc.some((s) => s && s[0] === 'roman')) sonuc.push(['roman', '📖 Roman']);
    if (eser && Array.isArray(eser.cizimler) && eser.cizimler.length && !sonuc.some((s) => s && s[0] === 'cizim')) sonuc.push(['cizim', '🎨 Çizimler']);
    return sonuc;
  };

  window.evrenEkBolum = function (sayfa) {
    if (typeof EVS !== 'undefined' && EVS) {
      if (EVS.sekme === 'roman') return romanHtml(sayfa);
      if (EVS.sekme === 'cizim') return cizimlerHtml(sayfa);
    }
    return typeof oncekiBolum === 'function' ? oncekiBolum(sayfa) : null;
  };

  document.addEventListener('click', function (e) {
    const sec = e.target.closest && e.target.closest('[data-evren-bolum-sec]');
    if (sec && typeof EVS !== 'undefined' && EVS) {
      e.preventDefault();
      EVS.seciliBolum = sec.getAttribute('data-evren-bolum-sec');
      if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz();
      return;
    }
    const hedef = e.target.closest && e.target.closest('[data-evren-bolum-al], [data-evren-cizim-al]');
    if (!hedef) return;
    e.preventDefault();
    const id = hedef.getAttribute('data-evren-bolum-al') || hedef.getAttribute('data-evren-cizim-al');
    const fiyat = hedef.getAttribute('data-fiyat');
    icerikSatinAl({ id, fiyat, onBasarili: function () { if (typeof window.evrenSayfaCiz === 'function') window.evrenSayfaCiz(); } });
  });

  window.icerikSatinAl = icerikSatinAl;
})();
