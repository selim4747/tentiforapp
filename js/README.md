# TentiforApp betikleri (4.0 düzeni)

Bütün betikler **düz betik** (modül değil) olarak aynı küresel alanı paylaşır. Yükleme sırası `index.html`'deki
`<script>` sırasıdır; yayında `scripts/paketle.mjs` bunları bu sırayla 4 pakete birleştirir (`js/paket-1…4.js`).
Dosya adlarındaki numara bu **yükleme sırasını** gösterir: daha büyük numara, daha küçük numaralı dosyanın
fonksiyonunu sarabilir (`const eski = f; window.f = function () { … eski.apply(this, arguments) … }`).

## Klasörler

| Klasör | İçerik |
|---|---|
| `core/` | Altyapı: adresler (`00-rota`), hata şeridi, kripto, cüzdan, hesap ve eşitleme (`28-hesap`), mobil, güncelleme, Android kabuğu, veri parçaları, **4.0**: `supabase` (istemci, sıkıştırma), `state` (üyelik), `auth` (moderatör kodu), `odeme` (Pro/PayTR), `reklam`. `24-arsiv-mantigi` veriyi yükler ve paylaşılan yardımcıları (`kacir`, `veri`) tanımlar; paketlemede en sonda ayrı kalır. |
| `arayuz/` | Gezinme ve sayfa düzeni: sayfalar (`18-gezinme`, `GEZINME` listesi), komut paleti, karşılama, sade arayüz. |
| `arsiv/` | Tömye içeriği ve okur: keşif, roman/harita/medya, Kyldo yazısı, kanon kilidi, kartlar, Claude'un Evreni, okuma rozetleri, okur ayarları. |
| `oyun/` | Oyunlar: Nöbet, karakter oyunları, liderlik, yarışlar, seviye ve seviye kapıları, günlük oyunlar, kelime oyunu. |
| `topluluk/` | Topluluk ve hesaba bağlı özellikler: teoriler, defter, kulüp, bildirim, takip, tek kullanımlık kodlar. |
| `engine/` | Evren motoru: evren sayfası (`44-evrenler`), Evrengezer ekonomisi, E25, haritalar, şehirler, yolculuklar, evren uygulamaları/yazısı/stili, **4.0** `evren-motoru` (paket açma, önizleme, onaylanan evrenler). |
| `studio/` | Evren kurma: fan atölyesi, Kurucu, atölye, araçlar, şablonlar, **4.0** `editor` (taslak hakkı) ve `paketleyici` (onaya gönderme). |
| `admin/` | Yönetici: panel, yerinde düzenleme, bakım, kurulum yardımcısı, yetkiler, **4.0** `moderasyon` (`#/moderasyon`). `22b`, `25`, `43` ziyaretçiye inmez; panel açılınca `65-yonetici-yukle` yükler. |
| `vendor/` | Dış kütüphaneler (küçültülmez). |

## Yeni kod eklerken

- İlgili klasöre ekle; `index.html`'de doğru yere `<script>` satırı ve `sw.js` `ILK` listesine yol ekle.
- Üst düzey adlar bütün dosyalarda tek olmalı (test bunu denetler: "üst düzey ad çakışması").
- Sunucuya yük eklemeden önce düşün: okuma önbellekli olmalı (`core/28-hesap` okuma önbelleği, `tf4AcikOku`).

## Test

```sh
service postgresql start                               # bir kez
export PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres
npm test                                               # hepsi (~30 dk)
npm run test:takim -- s31                              # yalnızca bir takım (~3 dk)
npm run test:takim -- vt,s31                           # birkaç takım
```

Takımlar: `vt` (veritabanı, `tests/veritabani.sql`), `fonksiyon`, `tarayici`, `cevrimdisi`, `s25`, `yuk` (sunucu yükü),
`s26`, `s27`, `s28`, `s30`, `s31` (3.1 ve 4.0), `kabuk` (Android). Chromium yolu gerekirse: `CHROMIUM_YOLU=/yol/chromium`.
