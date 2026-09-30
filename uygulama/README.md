# Tentiforverse mobil dağıtımı

Bu dizin, Tentiforverse web sürümünü açan Android kabuğunu, mobil kimlik ayarlarını ve APK indirme metadata dosyalarını içerir.

## Hazırlanan mobil davranış

### Çevrimdışı çalışma

`uygulama/kabuk/capacitor.config.json` artık `server.url` kullanmıyor. Bir sonraki native APK derlemesinde `www/` içindeki web dosyaları APK'ya gömülecek; böylece uygulama internet yokken de açılabilecek.

Web/PWA tarafındaki `sw.js` zaten:

- uygulama dosyalarını önbelleğe alır,
- yavaş ağda cihazdaki son kopyayı açar,
- internet yokken daha önce açılmış içerikleri gösterir,
- bağlantı geri gelince yeni kopyayı arka planda alır.

Çevrimdışı çalışmada Supabase, hesap eşitleme ve yeni içerik erişilemez; cihazdaki yerel ilerleme bağlantı gelince eşitlenir.

### Bildirimler

- Native APK için `LocalNotifications` ayarları hazırlandı.
- Web/PWA için mevcut Service Worker bildirim altyapısı korunuyor.
- Kullanıcı bildirim izni vermelidir.
- Android 13 ve sonrasında işletim sistemi bildirim izni ayrıca ister.
- Günlük hatırlatma ve takip edilen evren bildirimi kullanıcı ayarlarından açılır.

### Mobil kimlik

Bir sonraki APK/PWA kurulumu şu adla görünür:

```text
Tentiforverse
```

Ayrıca koyu lacivert açılış ekranı, altın bildirim rengi ve Tentiforverse manifest adı kullanılır. `appId` güncelleme uyumluluğu bozulmasın diye değiştirilmedi.

## Önemli sınırlama

Bu sandbox'ta Android Studio, Android SDK, JDK ve Gradle native derleme araçları yoktur. Bu nedenle bu turda mevcut `uygulama/indir/tentiforapp.apk` binary dosyası yeniden derlenmedi.

Yani:

- Mevcut indirilebilir APK hâlâ eski web-kabuk davranışını taşır.
- Aşağıdaki ayarlar bir sonraki native APK derlemesine hazırlandı.
- Yeni ayarların telefonda görünmesi için APK'nın Android araçları bulunan bir bilgisayarda yeniden derlenmesi gerekir.
- Web/PWA kurulumu için manifest değişiklikleri `npm run build` sonrasında yayına alınabilir.

## Derleme zamanı

Android araçları bulunan bilgisayarda:

```bash
npm install
npm run build
cd uygulama/kabuk
npm install
npx cap sync android
npx cap open android
```

Android Studio'da APK üretildikten sonra:

```text
uygulama/indir/tentiforapp.apk
```

dosyası değiştirilir. Ardından `uygulama/indir/apk.json` içindeki boyut, sürüm ve tarih güncellenir; son olarak tekrar `npm run build` çalıştırılır.

## Dosyalar

- `kabuk/capacitor.config.json`: yerel-first APK, bildirim, açılış ekranı ve uygulama adı ayarları.
- `indir/`: indirilecek APK ve metadata.
- `../manifest.webmanifest`: web/PWA uygulama adı, ikon ve tema ayarları.
- `../sw.js`: çevrimdışı önbellek ve web bildirimleri.
