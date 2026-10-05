# Tentiforverse 6.3.11 mobil dağıtımı

Bu dizin, GitHub Actions ile derlenen Tentiforverse Android APK'sini ve yerel web varlıklarını içerir.

## 5.0 mobil özellikleri

- **Kütüphanem:** cihaz içi notlar, favoriler ve son kaldığın yere dönme.
- **Çevrimdışı paket:** temel uygulama dosyaları ve daha önce alınmış içerikler için yerel Cache Storage paketi.
- **Paylaş:** Android paylaşım ekranı, tarayıcı paylaşımı veya bağlantı kopyalama geri dönüşü.
- **APK kimliği:** Tentiforverse 6.3.11 adı, lacivert-altın tema ve açılış ekranı.
- **Bildirimler:** Web Push, hedef kullanıcıya bildirim ve Android Local Notifications.
- **Mobil kullanım:** alt menü, Android geri tuşu, yenilemek için aşağı çekme ve derin bağlantı desteği.
- **Kişisel veriler:** notlar, favoriler ve okuma konumu Supabase'e gönderilmeden cihazda tutulur.

## Sınırlar

Çevrimdışı modda daha önce cihazda bulunan içerikler okunabilir. Yeni içerik, Supabase hesabı, ödeme, topluluk eşitlemesi ve hedef bildirim gönderimi için internet gerekir. APK'nin kendisi Android güvenliği nedeniyle sessizce değiştirilemez; yeni native sürüm GitHub Actions ile derlenip kullanıcıya yükletilir.

## GitHub Actions derlemesi

`.github/workflows/build-apk.yml` dosyası `workflow_dispatch` ile çalıştırılabilir. Workflow şu işlemleri GitHub sunucularında yapar:

1. Web paketini 6.3.11 olarak oluşturur.
2. Capacitor Android kabuğunu kurar ve gerekli eklentileri ekler.
3. Debug APK'yi derler.
4. APK'yi `tentiforverse-debug-apk` artifact'i olarak yükler.

Yerel bilgisayara Android Studio, Gradle veya Android SDK kurulması gerekmez.

## Dağıtım dosyaları

- `kabuk/capacitor.config.json`: Android adı, renk, splash ve bildirim ayarları.
- `kabuk/package.json`: Capacitor Android, bildirim, paylaşım, haptics, dosya ve splash eklentileri.
- `indir/tentiforapp.apk`: herkese açık indirilecek son APK.
- `indir/apk.json`: APK sürümü, kodu, boyutu ve tarih metadata'sı.
- `../js/core/99-v50-mobil.js`: 5.0 Kütüphanem ve çevrimdışı araçları.
