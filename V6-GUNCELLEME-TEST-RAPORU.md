# TentiforApp 6.0 Güncelleme ve Test Raporu

## Uygulanan native temel

`feat/v6-native-android` dalında Capacitor Android projesi oluşturuldu. Android projesi artık `uygulama/kabuk/android/` altında bulunuyor ve şu katmanlar eklendi:

- `TentiforNative` Capacitor plugin’i: biyometrik doğrulama, Android capability sorgusu ve ekranı açık tutma.
- Android ana ekran widget’ı: TentiforApp’ı Oyunlar rotasına açan temel widget.
- Android `SEND`/`VIEW` intent filtreleri: metin, HTML ve JSON paylaşma/dosya açma girişleri.
- App Links için HTTPS intent filtreleri.
- `USE_BIOMETRIC`, `WAKE_LOCK`, `NFC` ve Android 13 bildirim izinleri.
- Native intentlerin web katmanına aktarılması ve 6.0 JS köprüsü.
- GitHub Actions ile Java 17, Node 20, Capacitor sync ve `assembleDebug` artifact üretimi.

Sürüm numarası bilerek 5.4.4 bırakıldı; bu dal native 6.0 altyapı/özellik çalışmasıdır, production 6.0 release etiketi değildir.

## Başarılı kontroller

`npm test`, `npm run lint`, `npm run test:release`, `npm run test:live` ve yeni `tests/android-native.mjs` başarılıdır. Lint’te iki önceden mevcut `no-empty` uyarısı dışında hata yoktur. Canlı ortam simülasyonunda 18 kontrol geçmiştir. Native sözleşme testi plugin, biyometri, widget, intent ve CI tanımlarını doğrulamıştır.

Web kullanıcı testi de temiz kaldı. `/`, `/oyunlar/`, `/atolye/`, `/tomye/` ve `/fan/` rotaları; manifest, Service Worker, `veri.json` ve APK metadata uçları HTTP `200` döndürdü. Eksik kaynak bulunmadı, runtime JavaScript çökmesi görülmedi ve Evren Atölyesi boş formu Türkçe hata mesajı verdi.

## Build durumu

Sandbox’ta Java ve Gradle wrapper indirilebilir durumda, ancak Android SDK kurulu olmadığı için yerel `assembleDebug` şu nedenle tamamlanamadı:

> SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable or by setting sdk.dir.

Bu eksiklik GitHub Actions runner’ında giderilir; workflow Android SDK içeren `ubuntu-latest` üzerinde `./gradlew assembleDebug` çalıştırır ve debug APK’yı artifact olarak yükler. Yerel build sonucu bu nedenle **ortam eksikliği**, kod/test hatası değildir.

## Henüz tam uygulanmamış veya cihaz gerektiren maddeler

Widget’ın temel sürümü ve biyometri köprüsü uygulanmıştır; fakat gerçek cihazda widget kurulumu, biyometrik başarı/iptal senaryoları ve Android paylaşım/dosya açma akışları fiziksel Android veya CI emulator gerektirir. NFC için izin ve capability bildirimi hazırdır, fakat NDEF okuma/yazma UI’ı henüz eklenmemiştir. Nearby Share, Android sistem yedekleme doğrulaması, kilit ekranı medya servisi ve gelişmiş dinamik widget verisi de sonraki native iterasyondadır.
