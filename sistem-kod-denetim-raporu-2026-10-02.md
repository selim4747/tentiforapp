# TentiforApp sistem kod denetim raporu

**Tarih:** 2026-10-02  
**Depo:** `selim4747/tentiforapp`  
**HEAD:** `a90688f` — `Fix setup version warning and notification test`  
**Canlı adres:** `https://tentiforapp.pages.dev/`

## 1. Kısa sonuç

İki hata güncel kaynak kodda yeniden üretilemiyor. Ancak eski kodun kullanıcı cihazında çalışmaya devam etmesini sağlayan ciddi bir yayın/cache tasarım problemi var.

| Alan | Sonuç |
|---|---|
| Supabase canlı kurulum sürümü | `6.2.5` dönüyor; veritabanı güncel |
| Güncel istemcinin beklediği sürüm | `6.2.5` |
| Eski istemcinin beklediği sürüm | `4.2` |
| Güncel bildirim kodu | `ServiceWorkerRegistration.showNotification()` kullanıyor |
| Güncel kodda `new Notification(...)` | Yok |
| Canlı origin dosyaları | Denetimde mevcut HEAD ile eşleşti |
| Kullanıcı cihazındaki eski cache ihtimali | Yüksek; tasarım açığı doğrulandı |
| Cloudflare deploy ayarı | Depoda tanımlı değil; dış panel ayarı olarak kalıyor |

**Ana sonuç:** Kullanıcının gördüğü `sunucuda 6.2.5, gereken 4.2` ve `Illegal constructor` hataları güncel koddan değil, eski client bundle/Service Worker/cache kopyasından geliyor. Buna rağmen depoda bu eski kopyanın tekrar kullanılmasını mümkün kılan cache-busting eksikleri var.

---

## 2. Supabase kurulum sürümü denetimi

### Güncel durum

- `supabase/kurulum.sql` dosyasının sonundaki `kurulum_surumu()` tanımı `6.2.5` döndürüyor.
- Canlı Supabase sorgusu:

```sql
select public.kurulum_surumu();
```

Sonuç:

```text
6.2.5
```

- Güncel istemci:
  - `js/admin/74-yonetim-kurulum.js`: `KURULUM_BEKLENEN="6.2.5"`
  - `js/paket-4.js`: aynı değer
  - Android/www kopyaları: aynı değer

### Bulunan sorunlar

#### Yüksek önem: SQL’de aynı RPC iki kez tanımlı

`supabase/kurulum.sql` içinde:

- Yaklaşık 2424. satır: `kurulum_surumu()` → `4.0`
- Yaklaşık 3447. satır: `kurulum_surumu()` → `6.2.5`

Dosyanın tamamı sıralı çalıştırılırsa son tanım kazanır. Fakat dosya parça parça, yarıda kalmış veya yanlış seçimle çalıştırılırsa sürüm karışabilir.

**Öneri:** Eski `4.0` tanımını kaldırıp yalnızca tek bir `kurulum_surumu()` tanımı bırakılmalı.

#### Kritik: Kurulum paneli yanlış dosya yolları kullanıyor

`js/admin/43-kurulum.js` şu yolları fetch ediyor:

```text
kurulum/kurulum.sql
kurulum/bildirim-gonder.ts
```

Depoda gerçek yollar:

```text
supabase/kurulum.sql
supabase/functions/bildirim-gonder/index.ts
```

Bu nedenle yönetim panelindeki “kurulum dosyasını indir/görüntüle” akışı 404 verebilir veya kullanıcıyı yanlış yönlendirebilir.

#### Yüksek önem: Ayrı migration gerçek migration zinciri değil

`supabase/migrations/20261002_hediye_abonelik_migration.sql` doğrudan mevcut tablolara `ALTER TABLE` uyguluyor. Temel tablolar yoksa migration başarısız olur. Ayrıca depoda Supabase CLI migration metadata/config zinciri bulunmuyor.

**Öneri:** Tek bir canonical kurulum yaklaşımı seçilmeli:

1. Supabase CLI migration sistemi kurulmalı, veya
2. Manuel kurulumda önce baseline SQL, sonra açıkça migration SQL çalıştırılmalı.

İki yaklaşım aynı anda belirsiz bırakılmamalı.

#### Orta önem: Schema reload sırası

`supabase/kurulum.sql` içinde `notify pgrst, 'reload schema'` yeni 5.4/6.2.5 fonksiyonları tanımlanmadan önce geliyor. Son migration dosyasında notify en sonda.

**Öneri:** `notify pgrst, 'reload schema'` tüm tablo ve fonksiyon tanımlarının en sonuna taşınmalı.

---

## 3. Bildirim API denetimi

### Güncel kod doğru

`js/engine/88-v46-yenilikler.js` test akışı:

1. `Notification.requestPermission()` ile izin ister.
2. `navigator.serviceWorker.ready` bekler.
3. `registration.showNotification(...)` çağırır.

Güncel kaynakta `new Notification(...)` bulunmuyor.

Aynı şekilde:

- `js/core/46-guncelleme.js` → `showNotification`
- `sw.js` → `self.registration.showNotification`
- Native Android yolu → LocalNotifications

### Hatanın anlamı

Android Chrome’daki:

```text
Failed to construct 'Notification': Illegal constructor
```

hatası, eski bir JavaScript kopyasının doğrudan `new Notification(...)` çalıştırdığını gösterir. Güncel repo kodu bu çağrıyı içermiyor.

Bu hata Supabase kaynaklı değil.

---

## 4. Service Worker ve cache denetimi

### Kritik kök neden

`_headers` ve `server.js` JavaScript dosyalarına şu politikayı veriyor:

```text
Cache-Control: public, max-age=31536000, immutable
```

Yani aynı URL bir yıl boyunca eski içerik olarak tutulabilir.

Ancak `scripts/paketle.mjs` yalnızca bazı dosyaların query sürümünü değiştiriyor:

- `paket-2.js` güncelleniyor
- `92-v51-dashboard.js` güncelleniyor
- `paket-1.js` sabit kalıyor
- `paket-3.js` sabit kalıyor
- `paket-4.js` sabit kalıyor
- `engine/88-v46-yenilikler.js` sabit kalabiliyor

Özellikle sorunlu dosyalar:

```html
js/paket-4.js?v=544-final
js/engine/88-v46-yenilikler.js?v=6a2f5e8c1d
```

`paket-4.js` içinde Supabase kurulum sürümü kontrolü bulunuyor.  
`engine/88-v46-yenilikler.js` içinde bildirim testi bulunuyor.

İçerik değişse bile URL değişmezse tarayıcı eski dosyayı çalıştırabilir.

### Service Worker precache tutarsızlığı

`index.html` ile `sw.js` aynı dosyalar için farklı query değerleri kullanıyor. Örneğin `paket-4.js` için:

- HTML: `?v=544-final`
- Service Worker precache: farklı eski hash

Bu iki ayrı cache anahtarı oluşturur. Ayrıca `ignoreSearch` fallback’i eski ve yeni kopyaların birlikte kullanılmasına yol açabilir.

### Service Worker güncelleme eksiği

Yeni Service Worker’ın yüklenmesi ve aktive olması her sayfa açılışında garanti edilmiyor. Açık sekmenin belleğinde eski JavaScript çalışmaya devam edebilir.

**Öneri:**

- Tüm JS/CSS URL’leri içerik hash’iyle sürümlenmeli.
- HTML ve Service Worker URL listesi tek üretim kaynağından oluşturulmalı.
- `paket-4.js` ve `engine/88-v46-yenilikler.js` sabit query ile bırakılmamalı.
- `registration.update()` çağrısı boot akışına eklenmeli.
- Yeni worker aktive olduğunda kontrollü reload yapılmalı.
- Release testinde tüm HTML script URL’leri ile SW precache URL’leri karşılaştırılmalı.

---

## 5. Paketleme ve kaynak senkronu

Yerel denetimde şu kopyalar senkron bulundu:

- Kaynak JS
- `uygulama/kabuk/www`
- `dist`

`npm run test:release` başarılı.

Bu nedenle şu anda repo içi kopya drift’i ana sorun değil.

Ancak `dist/` `.gitignore` içinde ve GitHub Actions dosyalarında Cloudflare Pages deploy adımı yok. Workflow’lar yalnızca Android build/test yapıyor.

Sonuç:

- Yerel build başarılı olabilir.
- GitHub commit’i başarılı olabilir.
- Android workflow kırmızı olabilir.
- Cloudflare Pages’in hangi commit’i, hangi build komutuyla ve hangi output klasöründen yayınladığı depodan doğrulanamaz.

Bu release zincirinde ciddi izlenebilirlik açığıdır.

---

## 6. GitHub / Cloudflare yayın denetimi

Depoda bulunan workflow’lar:

```text
.github/workflows/android-build.yml
.github/workflows/build-apk.yml
```

Bunlar Cloudflare Pages’e deploy etmiyor.

Depoda bulunmayanlar:

- Cloudflare Pages deploy workflow’u
- Wrangler yapılandırması
- Deploy sonrası canlı hash kontrolü
- Canlı `/surum.json` doğrulaması
- Canlı `paket-4.js` kontrolü
- Canlı `engine/88-v46-yenilikler.js` kontrolü

Bu nedenle “GitHub’da düzeltildi” ile “kullanıcı cihazı düzeltilmiş dosyayı çalıştırıyor” arasında güvenilir bir bağlantı yok.

---

## 7. Test eksikleri

Mevcut testler şunları doğruluyor:

- Kaynakta `new Notification(...)` olmaması
- `showNotification(...)` bulunması
- Kaynak/www/dist senkronu
- Paketleme hash’i
- Yerel Service Worker sözleşmeleri

Ancak şunları doğrulamıyor:

- Gerçek Android Chrome
- Gerçek Service Worker registration
- Gerçek Cache Storage
- Gerçek Cloudflare HTTP response header’ları
- Canlı URL ile repo hash eşleşmesi
- Tüm HTML script URL’leri ile SW URL’lerinin eşleşmesi
- Eski bundle’ın cihazdan tamamen silinmesi

Bu nedenle bütün yerel testler başarılı olurken kullanıcı eski kodu çalıştırabiliyor.

---

## 8. Öncelikli düzeltme planı

### P0 — Hemen

1. `scripts/paketle.mjs` tüm kritik script URL’lerini hash’lemeli.
2. `index.html` ve `sw.js` aynı üretilmiş asset manifestini kullanmalı.
3. `paket-4.js` ve `engine/88-v46-yenilikler.js` sabit query’den çıkarılmalı.
4. Cloudflare Pages’te gerçek production deploy manuel olarak tetiklenmeli.
5. Android cihazda site verisi + Service Worker + Cache Storage temizlenmeli.

### P1 — Aynı düzeltme setinde

1. `js/admin/43-kurulum.js` yanlış `kurulum/...` yollarını gerçek `supabase/...` yollarına çevirmeli.
2. SQL’deki eski `kurulum_surumu() = 4.0` tanımı kaldırılmalı.
3. `notify pgrst` tüm SQL tanımlarının sonuna taşınmalı.
4. Supabase migration zinciri tek yönteme indirilmeli.

### P2 — Release güvenliği

1. Cloudflare deploy workflow’u eklenmeli.
2. Deploy sonrası şu dosyalar canlıdan çekilip hash’lenmeli:
   - `/index.html`
   - `/sw.js`
   - `/surum.json`
   - `/js/paket-4.js?...`
   - `/js/engine/88-v46-yenilikler.js?...`
3. HTTP `Cache-Control` başlıkları release testinde kontrol edilmeli.
4. Android APK içindeki `assets/public` dosyaları kaynakla karşılaştırılmalı.
5. Gerçek Android Chrome smoke test eklenmeli.

---

## Son karar

**Depodaki son değişiklikler doğru dosyalara uygulanmış; fakat sistemin yayın ve cache tasarımı güvenilir değil.** Kullanıcının verileri silip yeniden giriş yapması bu problemi çözmez, çünkü sorun hesap verisinde değil; eski JavaScript/Service Worker/cache katmanındadır.

Ayrıca Supabase uyarısının kaynağı veritabanının eski olması değildir: canlı Supabase zaten `6.2.5` dönüyor. Kullanıcının gördüğü `gereken: 4.2` metni eski frontend bundle’ının çalıştığını gösterir.

**Düzeltilmesi gereken asıl katmanlar:**

1. Asset cache-busting
2. Service Worker güncelleme ve cache anahtarları
3. Cloudflare deploy zinciri
4. Kurulum paneli yanlış dosya yolları
5. SQL sürüm tanımlarının tekilleştirilmesi
6. Canlı smoke test ve release doğrulaması


# İkinci derin denetim — yeni bulgular

## 9. Kritik yeni bulgu: `/sen/` Service Worker kaydı yanlış URL’ye gidiyor

Ana uygulama boot kodu:

```js
navigator.serviceWorker.register("sw.js")
```

Bu göreli URL’dir. Kullanıcının verdiği adres `/sen/` olduğundan tarayıcı şu adresi ister:

```text
https://tentiforapp.pages.dev/sen/sw.js
```

Canlı HTTP testi:

| URL | HTTP | Content-Type |
|---|---:|---|
| `/sw.js` | 200 | `application/javascript` |
| `/sen/sw.js` | 200 | `text/html` |
| `/moderasyon/sw.js` | 200 | `text/html` |

Cloudflare SPA fallback’i 404 yerine HTML döndürüyor. Tarayıcı bunu Service Worker JavaScript’i olarak kabul etmez. Sonuç olarak `/sen/` sayfasından root Service Worker düzgün kaydedilmez/güncellenmez.

**Düzeltme:**

```js
navigator.serviceWorker.register("/sw.js", { scope: "/" })
```

Bildirim aboneliği kodu zaten doğru biçimde `/sw.js` kullanıyor; ana boot kodu da aynı olmalı.

## 10. Kritik yeni bulgu: Güncelleme kodu `skipWaiting` mesajı gönderiyor ama Service Worker mesaj dinlemiyor

`js/core/46-guncelleme.js`:

```js
navigator.serviceWorker.controller.postMessage({ action: "skipWaiting" });
```

Ancak `sw.js` içinde `self.addEventListener("message", ...)` bulunmuyor. Bu mesaj hiçbir şey yapmıyor.

Service Worker install sırasında zaten `self.skipWaiting()` çağırıyor; bu nedenle mesaj tamamen gereksiz görünüyor. Fakat güncelleme akışında sayfa hemen `location.reload()` yaptığı için yeni worker’ın gerçekten aktive olması beklenmiyor.

**Düzeltme seçenekleri:**

- Ya `message` listener eklenip `action === "skipWaiting"` işlenmeli,
- ya da `registration.update()` ve `controllerchange` beklenerek sonra reload yapılmalı.

Önerilen güvenli akış:

```js
const registration = await navigator.serviceWorker.getRegistration("/");
await registration?.update();
if (registration?.waiting) registration.waiting.postMessage({ action: "skipWaiting" });
await new Promise(resolve => {
  navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
});
location.reload();
```

## 11. Service Worker sürümlü paketlerde eski kopyayı bilinçli olarak koruyor

`sw.js` içinde:

```js
const ONBELLEK = "tentiforapp-3f5d896f6185";
```

ve `ILK` listesinde sabit sürümlü paketler var. `surum.json` güncellense bile Service Worker aşağıdaki davranışı sürdürüyor:

- Sürümlü JS/CSS dosyalarında cache-first
- Cache’de eski URL varsa ağa hiç gitmeme
- Sayfada `ignoreSearch: true` ile eski query’li kopyayı bulup kullanabilme

Bu, yeni HTML canlıya çıkmış olsa bile eski `paket-4.js` ve eski bildirim kodunun kullanılmasını mümkün kılıyor.

**Düzeltme:** Yeni release’te asset URL’si değişmeli; ayrıca `ignoreSearch` sürümlü asset’lerde kullanılmamalı.

## 12. Canlı hediye RPC’si kesin olarak güncel

Canlı PostgreSQL fonksiyon gövdesi doğrulandı:

- `SECURITY DEFINER`
- `search_path = ''`
- `auth.uid()` kontrolü
- `tam_yonetici_mi()` kontrolü
- kullanıcı adı case-insensitive arama
- mevcut üyelik bitişini uzatma
- `hediye_gecmisi` kaydı
- kullanıcı bildirimi
- `authenticated` rolüne EXECUTE izni

Canlı gövde, migration’daki güncel tanımla eşleşiyor. Dolayısıyla hediye butonuna gelen istek canlı RPC’ye ulaşırsa, yönetici yetkisi ve hedef kullanıcı adı doğru olduğu sürece işlem yapılabilir.

## 13. Kaynak SQL’de aynı fonksiyonların çift tanımı hâlâ risk

`supabase/kurulum.sql` içinde şu fonksiyonların her biri iki kez tanımlı:

| Fonksiyon | İlk tanım | Güncel tanım |
|---|---:|---:|
| `kurulum_surumu` | 2424 | 3447 |
| `abonelik_hediye` | 2880 | 3484 |
| `kullaniciya_bildir` | 3211 | 3514 |
| `bildirimlerim` | 3238 | 3476 |

İlk `abonelik_hediye` tanımı mevcut üyelik bitişini doğrudan `now() + gun` ile değiştiriyor; güncel tanım mevcut bitişi uzatıyor ve geçmiş/bildirim yazıyor. Dosya tam çalışırsa güncel tanım sonradan gelir; fakat manuel çalıştırmada ilk tanım geçici veya kalıcı olarak kullanılabilir.

**Düzeltme:** Eski tanımlar ve eski uyumluluk bloğu ayrıştırılmalı; kurulum dosyasında her public fonksiyon yalnızca bir kez bulunmalı.

## 14. Kurulum paneli hatası canlıda da doğrulandı

`js/admin/43-kurulum.js`:

```js
fetch("kurulum/kurulum.sql")
fetch("kurulum/bildirim-gonder.ts")
```

Canlı `/moderasyon/sw.js` testinin HTML fallback döndürmesiyle aynı sınıftaki bir routing sorunudur. Panel bu yolları isteyince mevcut dosyalar yerine SPA HTML’i veya 404 benzeri içerik alabilir.

Doğru yollar:

```text
/supabase/kurulum.sql
/supabase/functions/bildirim-gonder/index.ts
```

## 15. Güncel canlı dosya hashleri hakkında net durum

Canlı origin, denetim sırasında şu dosyalarda mevcut repo HEAD ile eşleşti:

- `sw.js`
- `surum.json`
- `js/paket-4.js`
- `js/engine/88-v46-yenilikler.js`
- `js/admin/74-yonetim-kurulum.js`
- `js/admin/43-kurulum.js`

Buna rağmen bu dosyaların JS cache başlıkları:

```text
Cache-Control: public, max-age=31536000, immutable
```

Dolayısıyla origin’in güncel olması, kullanıcının cihazındaki bundle’ın güncel olduğunu kanıtlamaz.

## Güncellenmiş kesin teşhis

Hediye RPC’si ve canlı Supabase fonksiyonları çalışır durumda. Kullanıcının hediye işlemine ulaşamamasının kalan en güçlü nedenleri:

1. `/sen/` altında göreli Service Worker URL’sinin HTML’e çözülmesi
2. Service Worker’ın sürümlü paketleri cache-first sunması
3. Güncelleme akışının worker’ı gerçekten beklememesi
4. `skipWaiting` mesajının Service Worker tarafından dinlenmemesi
5. JS dosyalarının bir yıl immutable cache’lenmesi
6. Kullanıcının eski bundle’ında bulunan `4.2` sürüm kontrolü ve `new Notification(...)` hatası

Bu nedenle bundan sonraki düzeltme Supabase SQL’e değil, **asset sürümleme + Service Worker kayıt/güncelleme + Cloudflare yayın zincirine** uygulanmalıdır.
