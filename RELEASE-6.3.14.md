# TentiFor 6.3.14 — Release Report

**Durum:** PR [#135](https://github.com/selim4747/tentiforapp/pull/135) `main` dalına merge edildi (`7a097952`, 2026-10-08 21:25:07 UTC). Post-merge düzeltmeler `f8df273` ve `f193b03` olarak `main`’e push edildi.

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

- `npm test` — **PASS**, PR merge edildikten sonra `main` üzerindeki `f193b03` commit’inde tam regression/unit paketi.
- `npm run lint` — **PASS**, 177 JavaScript dosyası.
- Chromium, Firefox ve WebKit — **PASS**; post-merge 390px mobil admin kimlik kaydetme, spoiler açma, bağımsız iç-evren kişilik/kimlik/olay, karşılık bağlantısının kayıt birleştirmemesi, iç evrene özgü kişi oluşturma, yatay taşma ve dokunma hedefleri.
- `npm run build` — **PASS**; üretim hash’i `6c56a6f892f7`, `dist` ve Capacitor `www` eşitlendi.
- Android signed release build (`assembleRelease`) — **PASS**; APK aynı kalıcı release sertifikasıyla imzalı.
- APK içeriğinde güncel `veri.json` (E126 dahil), root favicon ve favicon’u precache eden Service Worker doğrulandı.
- APK sertifika SHA-256 parmak izi `7dde5a8e4ab8e285fc5fae67987279c0da81f842ef6b37c9c9346c09991512de`; App Links allowlistesiyle eşleşiyor.
- APK manifesti: `dev.pages.tentiforapp`, `versionName=6.3.14`, `versionCode=625`.
- APK boyutu: **7,217,324 bayt**.
- APK SHA-256: `7b0889f92c15e0c3b1a0d25ebf81dca470f9a8199df0996f3ff964feff8d8b5a`.
- Canlı üretim kontrolü: `https://tentifor.com/surum.json` ve `https://tentifor.com/` **HTTP 200**; manifest `6.3.14` / `6c56a6f892f7` bildiriyor. Canlı `sw.js` favicon’u precache ediyor; root favicon ve kimlik renderer’ı 200, canlı `veri.json` E126 ve kanonik kimlikleri içeriyor.
- `https://tentifor.com/veri.json` için `Access-Control-Allow-Origin: *` ve `Cache-Control: public, max-age=0, must-revalidate` başlıkları doğrulandı.
- GitHub-hosted check-runs/status entegrasyonu bu oturumda `403 Resource not accessible by integration` döndürdü; bu nedenle uzak CI sonucu doğrulanamadı. Yukarıdaki yerel post-merge kontrolleri başarılıdır.

## Dağıtım dosyası

[İmzalı Android APK — 6.3.14 (625)](uygulama/indir/tentiforapp.apk)

PR #135 merge edildi ve Cloudflare Pages’in canlı manifesti 6.3.14’ü doğruluyor. Gelecek web-only sürümlerde APK/versionCode aynı bırakılacak; APK yalnızca önemli veya native davranışı etkileyen sürümlerde yenilenecek. 6.3.13 aynı sertifikayla kurulmuşsa bu APK normal güncelleme olarak yüklenebilir; daha eski farklı sertifikalı sürümlerde kaldırıp yeniden kurmak gerekir.
