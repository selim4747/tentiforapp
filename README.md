# TentiforApp

Tentiforverse evren arşivi: Tömye'nin kayıtları, okur evrenleri (fan-made ve kanon), oyunlar, topluluk.
Sürüm: **4.3.0** · Site: https://tentiforapp.pages.dev · Android uygulaması siteyi açan ince bir kabuktur (`uygulama/`).

## Nasıl çalışır

- **Site statik:** `index.html` + `js/` + `css/` + `veri.json`. Sunucu tarafında kod yok; derleme adımı yalnızca
  yayın paketini üretir (`npm run paketle` → `dist/`).
- **İçerik GitHub'da:** `veri.json` (arşivin tamamı) ve `evrenler/<adres>.json` (onaylanmış okur evrenleri). Panel
  ve moderasyon bu dosyaları GitHub'a yazar; yazılan her işlem `[skip ci]` taşır, siteyi kendiliğinden yayınlamaz.
- **Yayın elle:** Panel → Bakım → **Yayınla** (Cloudflare Pages dağıtım bağlantısı). Otomatik yayın kapalıdır.
- **Supabase yalnızca hesaplar ve kısa ömürlü işler için:** giriş, ilerleme eşitleme, puan tabloları, onay kuyruğu,
  bildirimler. Kurulum tek dosya: `supabase/kurulum.sql` (tekrar çalıştırılabilir). Edge Functions: `supabase/functions/`.
- **Okuma yükü düşük tutulur:** herkese aynı listeler Cloudflare önbelleğinden gelir (`functions/api/pano.js`),
  istemci okumaları önbellekli.

## Klasörler

| Yol | İçerik |
|---|---|
| `js/` | Sitenin betikleri, alan klasörlerinde (ayrıntı: [`js/README.md`](js/README.md)) |
| `css/style.css` | Bütün stiller |
| `veri.json`, `evrenler/` | İçerik (panelden düzenlenir) |
| `supabase/` | `kurulum.sql` ve Edge Functions (moderasyon, ödeme, bildirim) |
| `functions/` | Cloudflare Pages Functions (önbellekli liderlik) |
| `scripts/` | Yayın paketi (`paketle.mjs`), paylaşım görselleri (`og-gorselleri.mjs`) |
| `tests/` | Veritabanı, fonksiyon ve tarayıcı testleri |
| `uygulama/` | Android kabuğu ve APK kurulumu (ayrıntı: [`uygulama/README.md`](uygulama/README.md)) |
| `.github/workflows/` | Testler, APK derleme, paylaşım görselleri |
| `ikon/`, `yazitipi/`, `gorseller/` | Simgeler, yazı tipleri, görseller |

## Geliştirme

Siteyi yerelde açmak için herhangi bir statik sunucu yeter (ör. `python3 -m http.server`); betikler paketlenmeden, `index.html`
sırasıyla ayrı ayrı yüklenir.

Kod kuralı: **bir fonksiyon, bir tanım.** Bir özellik var olan bir fonksiyonu genişletecekse ekleme o fonksiyonun
tanımına yapılır; başka dosyadan sarmak yasaktır (test denetler). Ayrıntı `js/README.md`'de.

## Test

```sh
service postgresql start                              # bir kez
export PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres
npm test                                              # hepsi (~30 dk)
npm run test:takim -- vt,s31                          # yalnızca seçilen takımlar
```

Takımlar: `vt` (veritabanı), `fonksiyon` (Edge Functions), `tarayici`, `cevrimdisi`, `s25`, `yuk` (sunucu yükü),
`s26`, `s27`, `s28`, `s30`, `s31` (3.1 ve 4.x), `kabuk` (Android). Chromium yolu gerekirse `CHROMIUM_YOLU=/yol/chromium`.
