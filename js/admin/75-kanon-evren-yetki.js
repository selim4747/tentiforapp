/* TentiforApp 6.3.13 — evren kapsamlı yönetici yetkisi */
(function () {
  var yetkiler = Object.create(null), yukleniyor = null;
  function setYetkiler(data) {
    yetkiler = Object.create(null);
    if (!data || typeof data !== 'object') return;
    Object.keys(data).forEach(function (evren) {
      yetkiler[String(evren).toLowerCase()] = Array.isArray(data[evren]) ? data[evren].map(String) : [];
    });
  }
  function yukle() {
    if (yukleniyor || typeof hesapKullanici === 'undefined' || !hesapKullanici || typeof hesapIstemci === 'undefined' || !hesapIstemci) return yukleniyor;
    yukleniyor = hesapIstemci.rpc('kanon_evren_yetkilerim').then(function (sonuc) {
      if (sonuc && !sonuc.error) setYetkiler(sonuc.data);
      else setYetkiler(null);
      window.dispatchEvent(new Event('tf-kanon-yetki-hazir'));
      return yetkiler;
    }).catch(function () {
      setYetkiler(null);
      window.dispatchEvent(new Event('tf-kanon-yetki-hazir'));
      return yetkiler;
    });
    return yukleniyor;
  }
  window.kanonEvrenYetkisiVar = function (evren, yetki) {
    var liste = yetkiler[String(evren || '').toLowerCase()] || [];
    return liste.indexOf(String(yetki || 'duzenle')) !== -1;
  };
  window.kanonE26OzelYoneticiMi = function () {
    return window.kanonEvrenYetkisiVar('e26', 'duzenle');
  };
  window.kanonE26YetkiYukle = yukle;
  window.addEventListener('tf-hesap-hazir', function () {
    yukleniyor = null;
    yukle();
  });
  window.addEventListener('tf-veri-hazir', yukle);
  if (typeof hesapKullanici !== 'undefined' && hesapKullanici) yukle();
}());
