# TentiFor Android release

## 6.3.14 signed release

`uygulama/indir/tentiforapp.apk` şu package ve sürümle yayımlanır:

- Package: `dev.pages.tentiforapp`
- Version code: `625`
- Version name: `6.3.14`
- APK SHA-256: `408d77b7dc6cce788d1659223e3bced832a68b93f34b04648ba8e83a8d3160aa`
- Release certificate SHA-256: `7D:DE:5A:8E:4A:B8:E2:85:FC:5F:AE:67:98:72:79:C0:DA:81:F8:42:EF:6B:37:C9:C9:34:6C:09:99:15:12:DE`

6.3.13 sürümü aynı kalıcı release sertifikasıyla kuruluysa 6.3.14 normal uygulama güncellemesi olarak yüklenebilir. Daha eski, farklı sertifikayla imzalı kurulumların kaldırılıp yeniden kurulması gerekir. Supabase hesapları ve sunucu verileri bundan etkilenmez; cihazdaki yerel veriler kaldırma sırasında silinebilir.

## Gelecek release’ler

İmzalama anahtarı repoya, APK içine veya loglara konmaz. Gelecekte aynı uygulamanın güncellenebilmesi için aynı keystore korunmalı ve aşağıdaki GitHub Actions secret’ları güvenli biçimde yapılandırılmalıdır:

- `TF_ANDROID_KEYSTORE_BASE64`
- `TF_ANDROID_KEYSTORE_PASSWORD`
- `TF_ANDROID_KEY_ALIAS`
- `TF_ANDROID_KEY_PASSWORD`

Workflow bu secret’ların dördü de varsa signed release artifact üretir; yoksa debug APK akışını sürdürür. Yerel üretim için `scripts/build-signed-apk.sh` kullanılır ve `TF_ANDROID_*` değişkenleri shell dışında kalıcı olarak kaydedilmez.

`.well-known/assetlinks.json` yeni sertifika fingerprint’ini ve eski kurulu uygulamaların bağlantı uyumluluğu için eski fingerprint’i birlikte içerir.
