# TentiforApp'i mağaza uygulaması yapmak (ileride)

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
