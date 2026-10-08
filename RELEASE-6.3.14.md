# TentiFor 6.3.14 — Release Report

**Kapsam:** PR #135 üzerinden `main`’e alınacak 6.3.14 değişiklik seti ve doğrulanan release artifact’i. Merge ve canlı yayın durumu GitHub/Cloudflare Pages üzerindeki güncel durumdur.

## Sürüm özeti

- Web sürümü: **6.3.14**
- Android `versionName`: **6.3.14**
- Android `versionCode`: **625**
- İç evren kayıtları her dünya için ayrı kişi kartı, kişilik, gizli kimlik ve olay tutar. Yan evrendeki karşılık bağlantısı yalnızca referanstır; beden veya kayıt birleştirmez.
- Yönetici paneli karakterlere gizli kimlik/kişilik ekleyip düzenleyebilir. L25’e **Star Saver**; Feil’e **Yaşam**, **Kütüphaneci** ve L25 ile çalışan **Bilim insanı** kayıtları eklendi. Profillerde kimlikler başlangıçta kapalı spoiler olarak gösterilir.
- Mobil kimlik ve iç evren formları tek sütun, taşma koruması ve dokunmaya uygun düğmelerle düzenlendi.
- Main dalındaki onaylı E126 evren verisi korundu ve son offline APK kopyasına dahil edildi.

## APK ve içerik güncelleme politikası

Kanonik evren verisi, Android uygulaması çevrimiçiyken her açılışta [`https://tentifor.com/veri.json`](https://tentifor.com/veri.json) adresinden `no-cache` ile alınır. İstek zaman aşımına uğrar, başarısız olur veya veri biçimi geçersiz gelirse APK’ye gömülü veri kullanılır. Hesap ve ortak evren değişiklikleri mevcut Supabase eşitleme akışında kalır. Böylece yeni evren/evren verisi değişiklikleri için APK’yi yeniden kurmak gerekmez; uygulama kodu veya önemli native değişiklikler için APK yenilemesi gerekir.

## Doğrulama

- `npm test` — **başarılı**; tüm regression/unit testleri, release hijyeni, APK metadata/checksum ve yeni canlı veri remote-first/çevrimdışı fallback sözleşmeleri geçti.
- `npm run lint` — **başarılı**; 177 JavaScript dosyası.
- Chromium, Firefox ve WebKit — **başarılı**; 390px mobil genişlikte admin kimlik kaydetme, spoiler açma, iç evren kişilik/kimlik/olay kaydetme, yan evren bağlantısının kayıtları birleştirmemesi, iç evrene özgü kişi oluşturma, yatay taşma ve dokunma hedefleri kontrol edildi.
- `npm run build` — **başarılı**; `dist` ve Capacitor `www` kaynakları eşitlendi.
- Android signed release build (`assembleRelease`) — **başarılı**.
- APK imzası doğrulandı. Sertifika SHA-256 parmak izi `7dde5a8e4ab8e285fc5fae67987279c0da81f842ef6b37c9c9346c09991512de`; App Links allowlistesiyle eşleşiyor.
- APK manifesti: `dev.pages.tentiforapp`, `versionName=6.3.14`, `versionCode=625`.
- APK boyutu: **7,217,324 bayt**.
- APK SHA-256: `7b0889f92c15e0c3b1a0d25ebf81dca470f9a8199df0996f3ff964feff8d8b5a`.
- `https://tentifor.com/veri.json` için 200 yanıtı, `Access-Control-Allow-Origin: *` ve `Cache-Control: public, max-age=0, must-revalidate` başlıkları salt-okunur şekilde doğrulandı.
- GitHub-hosted check-runs/status entegrasyonu bu oturumda `403 Resource not accessible by integration` döndürdü; bu nedenle uzak CI sonucu raporlanmıyor. Yerel test, lint ve build sonuçları yukarıdadır.

## Dağıtım dosyası

[İmzalı Android APK — 6.3.14 (625)](uygulama/indir/tentiforapp.apk)

APK ve web değişiklikleri PR #135 kapsamındadır; Cloudflare Pages üretim dağıtımı `main` dalındaki deploy durumuna bağlıdır. Gelecek web-only sürümlerde APK/versionCode aynı bırakılacak; APK yalnızca önemli veya native davranışı etkileyen sürümlerde yenilenecek.
