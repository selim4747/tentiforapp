# TentiforApp Mobil Kabuk (Capacitor)

Bu dizin TentiforApp'in Android APK derlemesi için Capacitor kabuk yapılandırmasını içerir.

## Dizin Yapısı
- `kabuk/`: Capacitor yapılandırma dosyaları ve yerel varlıklar.
- `indir/`: APK indirme ve sürüm bildirim dosyaları.
- `ac/`: Uygulama içi derin bağlantı açılış sayfası.

## 4.7.4 dağıtım davranışı

- APK, `server.url` kullanmadan `www/` içindeki son paketten açılır; internet yokken en azından APK ile gelen sürüm çalışır.
- Uygulama açıldıktan sonra `https://tentiforapp.pages.dev/surum.json` en fazla 2,5 saniye kontrol edilir. Ağ yavaşsa veya yoksa yerel paket bekletilmez.
- Daha yeni paket varsa kullanıcıdan onay istemeden güncel siteye geçilir; başarısız ağ kontrolünde yerel APK sürümü korunur.
- `npm run build`, APK dosyasını, `apk.json` metadata dosyasını ve `.well-known/assetlinks.json` dosyasını `dist/` içine kopyalar.

Native APK'nın bu sözleşmeyi kullanması için `www/` güncellendikten sonra Capacitor Android APK yeniden derlenmelidir:

```bash
cd uygulama/kabuk
npx cap sync android
cd android
./gradlew assembleRelease
```
