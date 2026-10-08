# TentiFor 6.3.15 — Release Report

**Durum:** [PR #136](https://github.com/selim4747/tentiforapp/pull/136) `main` dalına birleştirildi. Merge commit: `0aa7b9dd414a08cc2a2af06319eeb48012fa18ac`. Cloudflare Pages’te canlı sürüm **6.3.15** olarak doğrulandı.

## Sürüm ve UX özeti

- Web sürümü: **6.3.15**
- Android `versionName`: **6.3.15**
- Android `versionCode`: **626**
- Mobil deneyim daha sakin adaçayı/mavi-gri palet, yumuşak kartlar, dokunmaya uygun kontroller, safe-area alt gezinme ve gece teması uyumu sunuyor.
- Karışıklık düzeltmeleri: tanıtım turu erişilebilir modal dialog; arka planı ayırıyor, adımı gösteriyor, görünür **Atla** ve **Sonraki adım** eylemleri sunuyor, Escape ile kapanıyor ve alt menünün üzerinde kalıyor. Ana sayfa metni kısaltıldı; belirsiz **Kod** düğmesi **Kod gir** olarak adlandırıldı.
- Evren kartlarının yıldız düğmeleri kendi kartlarına sabitlendi; mobilde üst üste binme giderildi. **Rastgele keşfet** tam genişliğe hizalandı.
- Evren içeriği çevrimiçi açılışta güncel kanonik `veri.json` alır; ağ/veri hatasında APK içindeki kopyaya döner. Web-only içerik güncellemeleri APK yenilemesi veya yeniden kurulum gerektirmez.
- APK politikası: 6.3.15 önemli bir mobil tasarım sürümü olduğundan `versionCode 626` ile üretildi. Web-only sürümlerde APK/versionCode sabit kalır.

## İmzalı Android artifact

- Package: `dev.pages.tentiforapp`
- Boyut: **7,220,272 bayt**
- SHA-256: `3d98ab1a416333dbef603dcad7cdf1200b57d6e920c253fe34de660e33278a35`
- Release sertifika SHA-256: `7D:DE:5A:8E:4A:B8:E2:85:FC:5F:AE:67:98:72:79:C0:DA:81:F8:42:EF:6B:37:C9:C9:34:6C:09:99:15:12:DE`
- `apksigner`: JAR/v1 ve APK Signature Scheme v2 doğrulandı; `aapt` metaverisi `6.3.15 / 626` ile eşleşiyor.
- 6.3.14 / `versionCode 625` aynı sertifikayla kuruluysa üzerine güncellenebilir; uygulamayı kaldırmak gerekmez.
- [İmzalı Android APK — 6.3.15 (626)](uygulama/indir/tentiforapp.apk)

## Doğrulama

- Post-merge `main` commit’i `0aa7b9d`: `npm test` — **PASS**; tam regression/unit, release hijyeni, sürüm ayrımı, deterministik hash, APK metadata/`dist` eşitliği ve içerik eşitleme testleri.
- `npm run lint` — **PASS**; 178 JavaScript dosyası.
- 390×844 mobil UI regression — **PASS** Chromium, Firefox ve WebKit’te: yatay taşma yok; dokunma hedefleri/safe-area alt menüsü uygun; yıldızlar kendi kartlarında; rastgele eylem tam satırda; modal tur, **Atla/Escape**, net etiketler ve gece teması doğrulandı.
- Admin/gizli kimlik/iç evren cross-browser smoke — **PASS** Chromium, Firefox ve WebKit’te: form kaydetme, spoiler aç/kapatma, bağımsız kişi/kişilik/olay kartları ve karşılık bağlantısı.
- `npm run build` — **PASS**; `dist` ve Capacitor `www` senkronize. Paket hash’i `10fa597e7210`; CSS cache-buster `88c297377677`.
- Android `assembleRelease` — **PASS**; APK imzası, sürüm metaverisi, gömülü HTML/CSS/JS, SHA-256/byte sayısı ve `dist` kopyası doğrulandı.
- Canlı GET kontrolleri: `https://tentifor.com/surum.json` **6.3.15 / 10fa597e7210** döndürdü; `https://tentifor.com/` yeni ana sayfa metnini ve **Kod gir** etiketini içeriyor. Canlı CSS `88c297377677` hash’iyle `.ana-evren-sar` yıldız ankrajını ve `#rastgeleHero` tam satır kuralını içeriyor.
- GitHub hosted-check ayrıntı sorgusu entegrasyonun 403 erişim sınırına takıldı; bu, yukarıdaki başarılı yerel post-merge testlerinden ayrı bir görünürlük kısıtıdır.
