# TentiFor Android release

## Güncel indirilebilir APK: 6.5.6 — debug imzalı

`uygulama/indir/tentiforapp.apk` Android CI tarafından 6.5.6 kaynaklarından derlenmiştir; indirme düğmesinin kullandığı dosya budur. Build run: [39152075406](https://github.com/selim4747/tentiforapp/actions/runs/39152075406).

- Package: `dev.pages.tentiforapp`
- Version code: `6505`
- Version name: `6.5.6`
- APK size: `8,952,895` bytes
- APK SHA-256: `db95017bedbf81702f2c3222091c8f467c220f80ca5ff1bb74a2477675c860ba`
- Signing: `Android Debug`; certificate SHA-256: `0C:95:3D:61:ED:41:D0:78:9A:A9:C5:A8:DD:10:8B:01:2E:F4:8B:F2:B9:F3:62:33:AA:8D:93:CD:A1:86:05:E6`

Bu APK kalıcı release keystore ile imzalı değildir. Farklı bir imzayla kurulu eski uygulamanın üzerine güncelleme Android tarafından reddedilebilir. Uygulamayı kaldırıp yeniden kurmak cihazdaki yerel verileri silebilir; önce yedek alın. Aynı sertifikayla imzalı güncellemeler için kalıcı release keystore yapılandırılmalıdır.

## Önceki APK: 6.5.2 — tarihsel metadata

Aşağıdaki bilgiler önceki APK’ya aittir; güncel indirme dosyası değildir:

- Package: `dev.pages.tentiforapp`
- Version code: `6502`
- Version name: `6.5.2`
- APK size: `8,937,240` bytes
- APK SHA-256: `8e7f65ef6944ddc5ed998da373550e51f8139fa40e64b8f3d928c8f5cf246d1f`
- Signing: `Android Debug`; certificate SHA-256: `6D:C4:B0:A8:39:EA:49:DD:8E:23:C8:66:5D:A0:72:64:57:C7:6A:E0:47:7D:13:A8:EE:01:02:27:AB:B6:D2:31`

## Önceki APK’lar — tarihsel metadata

- **6.4.10:** version code `6410`, size `8,931,459` bytes, SHA-256 `8f0e3f682aa495876be17c67a9429f55bc7fe6b5f015d0612a1024634b484ef4`.
- **6.3.16:** version code `627`, size `8,380,457` bytes, SHA-256 `b2973f91cbc1750aace8828ac84605677bbee89cc2970f184b058d6f03698547`; debug signed.
- **6.3.15:** version code `626`, size `7,219,124` bytes, SHA-256 `b4900dfefa639168ae5237df7613bd1bf7322a20b53909e6901294abffcdddb1`; release certificate SHA-256 `7D:DE:5A:8E:4A:B8:E2:85:FC:5F:AE:67:98:72:79:C0:DA:81:F8:42:EF:6B:37:C9:C9:34:6C:09:99:15:12:DE`.
- **6.3.14:** version code `625`, size `7,217,324` bytes, SHA-256 `7b0889f92c15e0c3b1a0d25ebf81dca470f9a8199df0996f3ff964feff8d8b5a`.

6.3.15 mobil arayüz yenilemesi daha yumuşak adaçayı/mavi-gri renkler, rahat okunur kartlar, belirgin ana eylem, dokunmaya uygun hedefler, güvenli alanı hesaba katan alt gezinme ve gece temasını koruyan stiller içerir. 6.3.14 / `versionCode 625` aynı kalıcı release sertifikasıyla kurulmuşsa yeni APK uygulama kaldırılmadan normal bir güncelleme olarak yüklenebilirdi.

## APK güncelleme politikası ve içerik eşitleme

APK her web sürümünde yeniden derlenmeyecek. Native/mobil davranışını etkileyen önemli değişikliklerde yeni APK ve artan `versionCode` üretilecek; web-only sürümlerde son APK korunacak. 6.5.6 Android APK’sı bu akışta CI tarafından debug imzalı üretildi.

Android uygulaması çevrimiçiyken kanonik evren verisini her açılışta `https://tentifor.com/veri.json` adresinden alır; istek başarısız olursa veya veri biçimi geçersizse APK içine gömülü son veriye döner. Hesap ve ortak evren değişiklikleri Supabase eşitleme akışında kalır. Böylece yeni evren ekleme ve evren verisi düzenlemeleri için APK güncellemesi gerekmez. Yeni native APK gerektiğinde aynı kalıcı sertifika ve artan `versionCode` kullanılır; mevcut kullanıcılar uygulamayı kaldırmadan güncelleyebilir.

## Gelecek release’ler

İmzalama anahtarı repoya, APK içine veya loglara konmaz. Gelecekte aynı uygulamanın güncellenebilmesi için aynı keystore korunmalı ve aşağıdaki GitHub Actions secret’ları güvenli biçimde yapılandırılmalıdır:

- `TF_ANDROID_KEYSTORE_BASE64`
- `TF_ANDROID_KEYSTORE_PASSWORD`
- `TF_ANDROID_KEY_ALIAS`
- `TF_ANDROID_KEY_PASSWORD`

`android-build.yml` bu secret’ların dördü de varsa signed release artifact üretir; yoksa debug APK akışını sürdürür. Yerel üretim için `scripts/build-signed-apk.sh` kullanılır ve `TF_ANDROID_*` değişkenleri shell dışında kalıcı olarak kaydedilmez.

`.well-known/assetlinks.json` yeni sertifika fingerprint’ini ve eski kurulu uygulamaların bağlantı uyumluluğu için eski fingerprint’i birlikte içerir.
