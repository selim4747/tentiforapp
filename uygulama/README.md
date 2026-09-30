# TentiforApp APK dağıtımı

Bu dizin, TentiforApp web sürümünü açan Android APK kabuğunu ve indirme metadata dosyalarını içerir.

## Gerçek çalışma şekli

- APK yalnızca `https://tentiforapp.pages.dev` web sürümünü açar.
- Uygulama içeriği APK'nın içine gömülü değildir.
- Bu nedenle APK'nın çalışması için internet bağlantısı gerekir.
- Web sitesi güncellendiğinde, aynı APK tekrar yayınlanmadan güncel web sürümü açılır.
- İnternet yoksa APK'nın içerik göstermemesi beklenen davranıştır; bu sürüm çevrimdışı APK değildir.

## Bu bilgisayarda yapılabilecekler

Android Studio, Android SDK ve JDK kurulu değilse native APK yeniden derlenemez. Bu bilgisayarda yapılabilecek güvenli işlemler şunlardır:

```bash
npm install
npm run build
```

Bu işlem web sürümünü paketler ve aşağıdaki dosyaları production `dist/` çıktısına kopyalar:

- `uygulama/indir/tentiforapp.apk`
- `uygulama/indir/apk.json`
- `.well-known/assetlinks.json`

Yeni APK dosyası dışarıdan hazırlandığında yalnızca şu dosyanın üzerine konur:

```text
uygulama/indir/tentiforapp.apk
```

Ardından APK boyutu ve sürüm bilgisi `uygulama/indir/apk.json` içinde güncellenir ve tekrar `npm run build` çalıştırılır.

## Dizin yapısı

- `kabuk/`: Web adresini açan Capacitor yapılandırması.
- `indir/`: APK dosyası ve indirme metadata dosyası.
- `ac/`: Android uygulama bağlantıları için açılış sayfası.
