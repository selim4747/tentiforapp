# TentiFor Android release

## 6.3.16 indirilebilir APK

`uygulama/indir/tentiforapp.apk` bu dosyadır:

- Package: `dev.pages.tentiforapp`
- Version code: `627`
- Version name: `6.3.16`
- APK size: `8,380,457` bytes
- APK SHA-256: `b2973f91cbc1750aace8828ac84605677bbee89cc2970f184b058d6f03698547`
- İmza: debug. Release keystore secret’ları (`TF_ANDROID_KEYSTORE_*`) Actions’ta yok.

6.3.15 release kuruluysa bu paket yerinde güncellenmez; kaldırmak gerekir. Aynı release sertifikasıyla güncelleme, secret’lar konunca yeniden imzalanır.

# TentiFor Android release

## 6.3.15 signed release

`uygulama/indir/tentiforapp.apk` bu önemli mobil arayüz sürümüdür:

- Package: `dev.pages.tentiforapp`
- Version code: `626`
- Version name: `6.3.15`
- APK size: `7,219,124` bytes
- APK SHA-256: `b4900dfefa639168ae5237df7613bd1bf7322a20b53909e6901294abffcdddb1`
- Release certificate SHA-256: `7D:DE:5A:8E:4A:B8:E2:85:FC:5F:AE:67:98:72:79:C0:DA:81:F8:42:EF:6B:37:C9:C9:34:6C:09:99:15:12:DE`

6.3.15 mobil arayüz yenilemesi daha yumuşak adaçayı/mavi-gri renkler, rahat okunur kartlar, belirgin ana eylem, dokunmaya uygun hedefler, güvenli alanı hesaba katan alt gezinme ve gece temasını koruyan stiller içerir. 6.3.14 / `versionCode 625` aynı kalıcı release sertifikasıyla kurulmuşsa yeni APK uygulama kaldırılmadan normal bir güncelleme olarak yüklenebilir.

## Önceki signed release: 6.3.14

- Version code: `625`
- Version name: `6.3.14`
- APK size: `7,217,324` bytes
- APK SHA-256: `7b0889f92c15e0c3b1a0d25ebf81dca470f9a8199df0996f3ff964feff8d8b5a`

Daha eski ve farklı sertifikayla imzalı kurulumların kaldırılıp yeniden kurulması gerekebilir; cihazdaki yerel veriler kaldırma sırasında silinebilir. Supabase hesapları ve sunucu verileri bundan etkilenmez.

## APK güncelleme politikası ve içerik eşitleme

İmzalı APK her web sürümünde yeniden derlenmeyecek. APK yalnızca önemli sürümlerde veya native/mobil davranışını etkileyen kapsamlı değişikliklerde güncellenecek; web-only sürümlerde son önemli APK ve `versionCode` korunacak. 6.3.15 bu politika kapsamında önemli bir mobil UI sürümüdür.

Android uygulaması çevrimiçiyken kanonik evren verisini her açılışta `https://tentifor.com/veri.json` adresinden alır; istek başarısız olursa veya veri biçimi geçersizse APK içine gömülü son veriye döner. Hesap ve ortak evren değişiklikleri Supabase eşitleme akışında kalır. Böylece yeni evren ekleme ve evren verisi düzenlemeleri için APK güncellemesi gerekmez. Yeni native APK gerektiğinde aynı kalıcı sertifika ve artan `versionCode` kullanılır; mevcut kullanıcılar uygulamayı kaldırmadan güncelleyebilir.

## Gelecek release’ler

İmzalama anahtarı repoya, APK içine veya loglara konmaz. Gelecekte aynı uygulamanın güncellenebilmesi için aynı keystore korunmalı ve aşağıdaki GitHub Actions secret’ları güvenli biçimde yapılandırılmalıdır:

- `TF_ANDROID_KEYSTORE_BASE64`
- `TF_ANDROID_KEYSTORE_PASSWORD`
- `TF_ANDROID_KEY_ALIAS`
- `TF_ANDROID_KEY_PASSWORD`

Workflow bu secret’ların dördü de varsa signed release artifact üretir; yoksa debug APK akışını sürdürür. Yerel üretim için `scripts/build-signed-apk.sh` kullanılır ve `TF_ANDROID_*` değişkenleri shell dışında kalıcı olarak kaydedilmez.

`.well-known/assetlinks.json` yeni sertifika fingerprint’ini ve eski kurulu uygulamaların bağlantı uyumluluğu için eski fingerprint’i birlikte içerir.
