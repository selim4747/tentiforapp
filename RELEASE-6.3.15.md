# TentiFor 6.3.15 — Release Report

**Durum:** [PR #136](https://github.com/selim4747/tentiforapp/pull/136) `main` hedefine açık. Henüz merge edilmedi; bu nedenle Cloudflare Pages canlı dağıtımı yapılmadı.

## Sürüm özeti

- Web sürümü: **6.3.15**
- Android `versionName`: **6.3.15**
- Android `versionCode`: **626**
- Mobil tasarım: daha sakin adaçayı/mavi-gri palet, daha yumuşak kartlar ve tipografi, belirgin ana eylem, dokunmaya uygun kontroller, safe-area uyumlu alt gezinme ve gece teması uyumu.
- Evren içeriği: çevrimiçi açılışta güncel kanonik `veri.json` alınır; bağlantı/veri hatasında APK içindeki son kopya kullanılır. Web-only içerik değişikliklerinde APK’yi yenilemek veya uygulamayı yeniden kurmak gerekmez.
- APK politikası: 6.3.15 önemli bir mobil tasarım sürümü olduğundan APK `626` ile üretildi. Sonraki web-only sürümlerde Android APK/versionCode sabit kalacak.

## İmzalı Android artifact

- Package: `dev.pages.tentiforapp`
- Boyut: **7,219,124 bayt**
- SHA-256: `b4900dfefa639168ae5237df7613bd1bf7322a20b53909e6901294abffcdddb1`
- Release sertifika SHA-256: `7D:DE:5A:8E:4A:B8:E2:85:FC:5F:AE:67:98:72:79:C0:DA:81:F8:42:EF:6B:37:C9:C9:34:6C:09:99:15:12:DE`
- 6.3.14 / `versionCode 625` aynı sertifikayla kurulmuşsa 6.3.15 mevcut uygulamanın üzerine kurulabilir; uygulamayı kaldırmaya gerek yoktur.
- [İmzalı Android APK — 6.3.15 (626)](uygulama/indir/tentiforapp.apk)

## Doğrulama

- `npm test` — **PASS**; tam regression/unit paketi, release hijyeni, sürüm ayrımı, paket deterministikliği, APK metadata/`dist` eşitliği ve içerik eşitleme testleri.
- `npm run lint` — **PASS**; 178 JavaScript dosyası.
- Yeni mobil UI regression testi — **PASS** Chromium, Firefox ve WebKit’te 390×844 görünüm: yatay taşma yok, ana eylem en az 44 px, alt menü güvenli alanı, onboarding-alt menü çakışması yok, gece teması korunuyor.
- Mevcut admin/kimlik/iç-evren mobil smoke testi — **PASS** Chromium, Firefox ve WebKit’te form kaydetme, spoiler aç/kapatma, bağımsız kişi/kişilik/olay kartları ve karşılık bağlantısı davranışları.
- `npm run build` — **PASS**; `dist` ve Capacitor `www` üretildi/eşitlendi. Web paket hash’i `a71c7bd325e0`; CSS cache-buster `5d3e4e8a9312`, kaynak CSS hash’iyle index ve Service Worker’da eşleşiyor.
- Android `assembleRelease` — **PASS**; aynı kalıcı release sertifikasıyla signed APK üretildi. APK imzası `apksigner`, `versionName=6.3.15` ve `versionCode=626` ise Android paket metadata’sıyla doğrulandı.
- Final APK SHA-256/byte sayısı, indirme metadata’sı ve `dist` kopyası; CSS kaynak/`dist`/Capacitor `www` eşitliği — **PASS**.
- Canlı yayın kontrolü bu değişiklik için yapılmadı; merge sonrasında Cloudflare Pages dağıtımı doğrulanabilir.
- PR #136 GitHub `mergeStateStatus=UNSTABLE` bildiriyor; `gh pr checks` hosted-check ayrıntılarına `403 Resource not accessible by integration` nedeniyle erişemedi. Bu oturumda uzak CI sonucu doğrulanamadı; yerel test sonuçları yukarıda ayrı kaydedilmiştir.
