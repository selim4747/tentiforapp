# TentiforApp Android uygulaması (APK, mağazasız)

Uygulama ince bir Capacitor kabuğudur (`uygulama/kabuk/`): açılınca https://tentiforapp.pages.dev'i yükler.
- **İçerik güncellemesi:** her Yayınla anında uygulamaya da gelir (site nasıl yenileniyorsa öyle).
- **APK güncellemesi (kabuk değişince):** GitHub Actions derler, `uygulama/indir/` klasörüne koyar;
  uygulama açılınca günde bir kez `/uygulama/indir/apk.json`'a bakar, yeni sürüm varsa "İndir" şeridi çıkar.
- **Supabase:** aynı site, aynı istekler; hiçbir tablo/ayar değişmez. Yalnız Google ile giriş uygulamada açılmaz
  (Google, uygulama içi tarayıcıyı engeller); e-posta ile giriş çalışır.

## İlk kurulum (bir kez)

1. GitHub → Actions → **Android imza anahtarı üret** → Run workflow.
2. Bitince çalışmanın altındaki **imza-anahtari** dosyasını indir, aç:
   - `ANDROID_KEYSTORE_B64.txt` içeriğini → Settings → Secrets and variables → Actions → New repository secret,
     adı `ANDROID_KEYSTORE_B64`.
   - `ANDROID_KEYSTORE_SIFRE.txt` içeriğini → aynı yerde `ANDROID_KEYSTORE_SIFRE`.
   - `anahtar-yedek.jks` ve şifreyi güvenli bir yere yedekle (kaybolursa kurulu uygulamalar güncellenemez).
   - Sonra Actions'taki o çalışmanın dosyasını **sil** (zaten 1 gün sonra kendiliğinden silinir).
3. Actions → **Android APK** → Run workflow. APK derlenir ve depoya `uygulama/indir/tentiforapp.apk` olarak girer.
4. Panel → Bakım → **Yayınla**. (İstersen `CLOUDFLARE_DEPLOY_HOOK` adlı bir secret eklersen bu adım kendiliğinden olur.)
5. Telefonda https://tentiforapp.pages.dev/uygulama/indir/tentiforapp.apk aç, "bilinmeyen kaynaklara izin ver", kur.

## Sonraki APK güncellemeleri

Actions → Android APK → Run workflow (istersen "not" yaz) → Yayınla. Uygulamayı kullananlara "Yeni uygulama sürümü"
şeridi çıkar; İndir'e basıp üstüne kurarlar, veriler (giriş, ilerleme) kaybolmaz. İmza anahtarı hep aynı kalmalıdır.

Uygulamaya özel (js/78-uygulama-kabugu.js): geri tuşu önce açık pencereyi kapatır, ana sayfada iki basışta çıkar;
"İndir" düğmeleri dosyayı kaydedip telefonun Kaydet/Paylaş menüsünü açar; başka sitelere giden bağlantılar telefonun
tarayıcısında açılır; sesli okuma telefonun sesiyle; günün kelimesi hatırlatması telefon bildirimiyle (19:00, uygulama
her açılışta 7 günlüğünü kurar); aşağı çekince yenilenir; titreşim telefonun motoruyla.

E-posta bağlantıları (kayıt onayı, şifre sıfırlama) uygulamada kayıt olunduysa `/uygulama/ac/` adresine döner ve
uygulamayı açar. Bunun için Supabase → Authentication → URL Configuration → Redirect URLs'e
`https://tentiforapp.pages.dev/**` ekli olmalı. APK iş akışı imzanın parmak izini `.well-known/assetlinks.json`
olarak kendisi yazar.

Bilinen sınır: Google ile giriş uygulamada yok (Google'ın kuralı).

---

# Mağaza uygulaması yapmak (ileride)

Site bugün zaten bir PWA: Chrome/Edge'de "Uygulamayı yükle" ile kurulur, internetsiz açılır (sw.js),
kısayolları, paylaşım hedefi ve dosya açıcısı vardır (manifest.webmanifest). Mağazaya çıkmak için sitenin
kodunu değiştirmek gerekmez; üstüne ince bir kabuk konur. Kabuk ne olursa olsun site ona yalnızca
`window.TentiforKopru` üzerinden dokunur (js/74-surum-24.js): `ortam()`, `paylas()`, `titret()`, `surum()`.
Yerel bir özellik eklenince yalnızca bu nesne değişir.

## Yol 1 — Google Play: TWA (önerilen ilk adım)

Trusted Web Activity, siteyi Chrome motoruyla tam ekran açan küçük bir Android uygulamasıdır.
İçerik yine https://tentiforapp.pages.dev'den gelir; her Yayınla anında uygulamaya da yansır.

1. Bilgisayara Node ve Java (JDK 17) kur, sonra `npm i -g @bubblewrap/cli`.
2. Boş bir klasörde: `bubblewrap init --manifest https://tentiforapp.pages.dev/manifest.webmanifest`
   - Paket adı örneği: `dev.pages.tentiforapp.twa`
   - İmza anahtarını bubblewrap oluşturur; **anahtar dosyasını ve şifresini hiçbir yere yükleme, yedekle**.
3. `bubblewrap build` → `app-release-bundle.aab` Play Console'a yüklenir.
4. Siteyle uygulamanın birbirini tanıması (adres çubuğu gizlensin diye):
   `bubblewrap fingerprint` çıktısındaki SHA-256 parmak izini `assetlinks.ornek.json` içine yaz,
   dosyayı `.well-known/assetlinks.json` adıyla sitenin köküne koy; paketleme (scripts/paketle.mjs) onu yayına alır.
   Parmak izi gizli değildir; anahtarın kendisi gizlidir.

Uygulama içinde site `TentiforKopru.ortam() === "twa"` görür (`html[data-ortam="twa"]`).

## Yol 2 — App Store ve Play: Capacitor

iOS'ta TWA yok; Capacitor siteyi yerel bir kabuğa koyar.

1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. `npx cap init TentiforApp dev.pages.tentiforapp` — `webDir` olarak `node scripts/paketle.mjs` çıktısı (dist/).
3. `npx cap add ios` / `npx cap add android`, sonra Xcode / Android Studio ile derle.
4. Paylaşım, titreşim, bildirim için Capacitor eklentileri `TentiforKopru` içine bağlanır;
   `ortam()` zaten `"capacitor"` döner.

Dikkat: Capacitor'da site dosyaları uygulamanın içindedir; yeni içerik için ya uygulamayı güncellemek ya da
`veri.json`'u ağdan çekmek gerekir (bugün zaten ağdan geliyor, çevrimdışında son kopya).

## Mağaza öncesi kontrol listesi

- [x] Gizlilik politikası adresi: https://tentiforapp.pages.dev/gizlilik/
- [x] Hesap silme sitede var (Sen → Hesabın → Hesabımı sil) — Play bunu ister.
- [x] 512×512 ikon ve maskeli ikon hazır (ikon/).
- [x] Ekran görüntüleri: ikon/ekran-dar-1.jpg, ikon/ekran-dar-2.jpg (telefon), ikon/ekran-genis-1.jpg (tablet/masaüstü);
      manifest'te de var (Chrome'un zengin yükleme penceresi bunları gösterir). Play Console'a da bunları yükleyebilirsin.
- [x] Kullanıcı içeriği için bildirme yolu (2.5): evren sayfasında ve uygulamaların altında “⚑ Bildir”; panelde
      Bakım → İçerik bildirimleri. Yaş derecelendirmesi anketinde “kullanıcılar içerik paylaşır, bildirme var” de.
- [ ] Yaş derecelendirmesi anketi (Play Console).
- [ ] `.well-known/assetlinks.json`: `bubblewrap fingerprint` çıktısıyla `assetlinks.ornek.json`'u doldurup sitenin köküne
      `.well-known/assetlinks.json` olarak koy; paketleme onu kendiliğinden yayına alır (scripts/paketle.mjs).
- [ ] Supabase → Authentication → URL Configuration'a uygulamanın dönüş adresi (Capacitor'da özel şema) eklenmeli.
