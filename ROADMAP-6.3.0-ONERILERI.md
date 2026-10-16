# TentiforApp 6.3.0 önerileri

**Tarih:** 2026-10-02  
**Kaynak:** `selim4747/tentiforapp`, v6.2.6 çalışma ağacı ve önceki sistem denetimleri

## Kısa karar

6.3.0'ı büyük bir özellik sürümü yerine **güvenilirlik ve keşif sürümü** yapmak en doğru tercih olur.

Uygulama zaten arşiv, evrenler, karakterler, oyunlar, bildirimler, PWA/çevrimdışı çalışma, Android kabuğu, fan hikâyesi ve ücretli plan altyapısını aynı üründe taşıyor. Bu genişlik değerli; ancak yeni bir özellikten önce kullanıcının her zaman güncel kodu çalıştırması, verinin tek bir doğru kaynaktan yönetilmesi ve yönetici işlemlerinin izlenebilir olması gerekiyor.

## Önerilen 6.3.0 teması

> **TentiforApp 6.3 — Güvenilir Arşiv ve Keşif**

---

## P0 — 6.3.0'a kesinlikle alınmalı

### 1. Yayın, Service Worker ve cache zincirini kalıcı olarak düzelt

Önceki denetimde en kritik risk bu bulundu. Kullanıcı cihazında eski JavaScript veya eski Service Worker kalırsa Supabase doğru olsa bile kullanıcı eski davranışı görür.

Yapılacaklar:

- Tüm kritik JS/CSS dosyalarını tek bir asset manifestinden hash'le.
- `index.html` ve `sw.js` aynı URL listesini aynı üretim fonksiyonundan alsın.
- Sürümlü asset'lerde `ignoreSearch: true` fallback'ini kullanma.
- Service Worker kaydını her rota için kökten yap:

```js
navigator.serviceWorker.register('/sw.js', { scope: '/' });
```

- Yeni worker için `registration.update()` → `waiting.postMessage({ action: 'skipWaiting' })` → `controllerchange` → kontrollü yenileme akışını uygula.
- Cloudflare Pages deploy adımını depoya ekle veya en azından deploy sonrası canlı hash doğrulaması çalıştır.
- Canlı smoke test şunları otomatik kontrol etsin:
  - `/index.html`
  - `/sw.js`
  - `/surum.json`
  - `paket-4.js`
  - bildirim motoru
  - Supabase kurulum sürümü

**Neden P0:** Bu sorunlar veri silme, çıkış-giriş veya sayfa yenilemeyle güvenilir biçimde çözülmüyor; kullanıcı eski bundle çalıştırabiliyor.

### 2. Supabase kurulumunu tek ve deterministik hale getir

Şu an `supabase/kurulum.sql` içinde bazı public fonksiyonların eski ve yeni tanımları birden fazla kez bulunuyor. Dosyanın tamamı çalıştırılınca son tanım kazanıyor; ancak parça parça çalıştırmada risk oluşuyor.

Yapılacaklar:

- `kurulum_surumu`, `abonelik_hediye`, `kullaniciya_bildir`, `bildirimlerim` gibi fonksiyonların her birini dosyada tek tanıma indir.
- Tek bir yöntem seç:
  - Supabase CLI migration zinciri, veya
  - baseline `kurulum.sql` + açık sıralı migration klasörü.
- Manuel kurulum ile migration kullanımını README'de net ayır.
- Kurulum panelindeki yolları gerçek repo yollarıyla eşleştir:
  - `/supabase/kurulum.sql`
  - `/supabase/functions/bildirim-gonder/index.ts`
- `notify pgrst, 'reload schema'` çağrısını bütün tanımların en sonuna bırak.
- `supabase/kurulum.sql` için CI'da tekrar tanım ve sıralama testi ekle.

**Başarı ölçütü:** Yeni bir Supabase projesinde kurulum tek seferde, baştan sona ve aynı sonucu vererek tamamlanmalı.

### 3. Ücretli plan ve hediye işlemlerini idempotent ve denetlenebilir yap

Mevcut yükseltme kuralı doğru yönde: EvrenGezer → EvrenYazar mümkün, EvrenYazar → EvrenGezer yasak. 6.3.0'da bunu ürün seviyesinde daha güvenli hale getirmek gerekir.

Öneriler:

- `abonelik_hediye` için açık sonuç kodları kullan:
  - `tamam`
  - `yok`
  - `yetki`
  - `gecersiz`
  - `dusurme_yok`
  - `ayni_istek`
- İstek kimliği (`request_id`) ekle; çift tıklama aynı hediyeyi iki kez yazmasın.
- `hediye_gecmisi` tablosuna işlem kaynağı ve sonuç kodu ekle.
- Yönetici panelinde son 50 hediye işlemini filtrele:
  - veren
  - alan
  - plan
  - gün
  - zaman
  - sonuç
- Ödeme webhook'u ile hediye RPC'sinin abonelik güncelleme kuralları aynı plan politikasını kullansın.
- Aboneliği “silmek” yerine normal operasyonlarda `ucretsiz` durumuna geçişi tercih et; gerçek silmeyi yalnızca veri temizliği/migrasyon için kullan.

**Neden:** Ücretli plan, para ve kullanıcı erişimiyle ilgili olduğu için sessiz varsayılanlar veya çift çağrılar ciddi veri sorununa dönüşebilir.

---

## P1 — 6.3.0 içinde güçlü biçimde önerilir

### 4. Yönetici yetkilerini tek bir modele indir

Şu anda iki ayrı kavram var:

- Supabase'deki `yoneticiler.duzey = 'tam'`
- İstemci tarafındaki yerel yönetici/kod oturumu

Bunlar ayrıştığında kullanıcı Supabase'de yetkili olsa bile paneli göremeyebilir veya tersi algı oluşabilir.

Öneri:

- Panel görünürlüğü için sunucu taraflı `yonetici_yetki()` sonucunu temel al.
- Yerel yönetici kodunu yalnızca çevrimdışı içerik kilidi için kullan.
- Yönetici paneli açılışında tek bir `/yonetici_kimlik` veya eşdeğer RPC sonucu yükle.
- UI, RPC yetkisi ve audit log aynı yetki kaynağını kullansın.

### 5. Hesap ve profil deneyimini tamamla

Genel kullanıcı adı denetiminde temel akış sağlıklı görünse de 6.3.0 için şu UX iyileştirmeleri değerli olur:

- Kullanıcı adı uygunluğunu kayıt sırasında debounce ile göster.
- Büyük/küçük harf ve Türkçe karakter normalizasyonunu tek bir ortak yardımcıda tut.
- Kullanıcı adı değişikliğinde eski adın ne kadar süre rezerve edildiğini belirle.
- Profil eksikse otomatik onarım akışını kullanıcıya anlaşılır şekilde göster.
- Oturum yenilendiğinde plan, bildirim ve profil durumunu tek bir hesap yenileme işleminde güncelle.
- Hesap silme, veri dışa aktarma ve oturumları kapatma ekranlarını ekle.

### 6. Global aramayı ürünün ana keşif özelliği yap

Uygulama içerik açısından zengin: karakter, evren, olay, hikâye, sözlük, günlük, mektup, oyun ve fan içeriği aynı sistemde. Bu içeriklerin değeri arama ile artar.

Önerilen arama sürümü:

- Karakter, evren, hikâye, olay, sözlük ve kullanıcı içeriği kategorileri.
- Türkçe karakter duyarlı ama normalleştirilmiş arama.
- Yazım hatasına toleranslı yakın eşleşme.
- Son aramalar ve klavye kısayolu.
- Sonuçlarda içerik türü, evren ve erişim etiketi.
- Kilitli içerik için “neden kilitli” açıklaması.
- Arama sonuçlarına doğrudan rota linki.

**Ürün etkisi:** Yeni içerik eklemeden mevcut içeriğin bulunabilirliğini belirgin biçimde artırır.

### 7. Okuma ve keşif devamlılığını güçlendir

Kullanıcı uygulamayı arşiv gibi kullanıyor; bu nedenle “nerede kalmıştım?” akışı temel olmalı.

- Son okunan 10 içerik.
- İçerik bazlı okuma yüzdesi.
- “Kaldığın yerden devam et” kartı.
- Evren bazlı son etkinlik.
- Çevrimdışı okunan içerikleri çevrimiçi olunca güvenli biçimde eşitle.
- Aynı kaydın farklı cihazlardan gelmesi için açık bir birleştirme politikası.

### 8. Bildirim merkezini sadeleştir ve önem sırası ekle

Mevcut bildirim altyapısı güçlü; ancak `hediye`, `rozet`, `okuma`, `evren`, `duyuru` gibi kategoriler büyüdükçe filtreleme gerekir.

- Okunmamış sayacı.
- Kategori filtreleri.
- Tümünü okundu işaretle.
- Bildirim tıklanınca hedef kayda doğrudan git.
- Aynı olayın tekrar bildirimini engelleyen olay anahtarı.
- Kullanıcıya göre bildirim sıklığı ayarı.

---

## P2 — 6.3.x'e bırakılabilir

### 9. İçerik üretici araçlarını ürünleştir

EvrenGezer/EvrenYazar tarafı sitenin en ayırt edici alanı. Bir sonraki adım daha fazla özellik değil, üretim akışının güvenli ve anlaşılır olması:

- Evren şablonları.
- Taslak / yayınlandı / arşivlendi durumları.
- Önizleme modu.
- Değişiklik geçmişi ve geri alma.
- Başka kullanıcıyla ortak düzenleme.
- İçerik boyutu ve plan kotası göstergesi.
- Yayın öncesi doğrulama: bozuk bağlantı, eksik karakter, yetim bölüm, geçersiz görsel.

### 10. Mobil/Android parity kontrolünü büyüt

Web kaynakları, `uygulama/kabuk/www` ve dist kopyaları senkron tutuluyor; release testleri bunu doğruluyor. 6.3.x'te buna gerçek cihaz davranışı eklenmeli:

- Android Chrome gerçek cihaz smoke testi.
- Service Worker kayıt testi.
- Bildirim izni ve bildirim tıklama testi.
- Çevrimdışı açılış testi.
- Dosya paylaşımı ve APK deep-link testi.
- Düşük bellek ve yavaş ağ senaryosu.

### 11. Performans bütçesi koy

Özellik sayısı arttıkça ilk açılış maliyeti büyüyor.

- İlk açılış JS bütçesi.
- İlk anlamlı içerik süresi.
- Büyük `veri.json` parçalama stratejisi.
- Görsellerde boyut ve lazy-load standardı.
- Uzun listelerde sanallaştırma veya sayfalama.
- Her release'te Lighthouse/Chromium ölçümü.

### 12. Hata izleme ve sağlık paneli ekle

Kullanıcı “çalışmıyor” dediğinde yalnızca tarayıcı konsoluna bağlı kalınmamalı.

- İstemci hata olayları: sürüm, paket hash'i, rota, tarayıcı, online/offline.
- Supabase RPC hata kodları.
- Service Worker sürümü.
- Son başarılı veri yükleme zamanı.
- Yöneticiye özet sağlık paneli.
- Kişisel veri ve token kaydetmeden hata örnekleme.

---

## Önerilen 6.3.0 sprint sırası

### Sprint 1 — Yayın güvenliği

1. Asset manifest ve tek hash üretimi.
2. Service Worker kök kayıt ve güncelleme akışı.
3. `ignoreSearch` davranışının sürümlü asset'lerde kaldırılması.
4. Canlı deploy/hash smoke testi.

### Sprint 2 — Supabase bütünlüğü

1. Çift fonksiyon tanımlarını temizleme.
2. Baseline/migration stratejisini belgelemek.
3. Kurulum paneli yollarını düzeltmek.
4. Hediye/ödeme RPC ortak plan politikasını oluşturmak.

### Sprint 3 — Hesap, yetki ve abonelik

1. Tek yönetici yetki modeli.
2. Hediye isteği idempotency anahtarı.
3. Audit ekranı.
4. Hesap/profil yenileme ve kullanıcı adı UX'i.

### Sprint 4 — Keşif ve kalite

1. Global arama.
2. Kaldığın yerden devam et.
3. Bildirim filtreleri.
4. Gerçek Android/yavaş ağ smoke testleri.

---

## 6.3.0 için başarı kriterleri

- Kullanıcı hangi alt rotadan girerse girsin root Service Worker kaydoluyor.
- Yeni release eski JS bundle'ını bilinçli olarak kullanmıyor.
- Canlı dosya hashleri GitHub release hashleriyle otomatik karşılaştırılıyor.
- Yeni Supabase projesi kurulum SQL'sini tek ve deterministik biçimde çalıştırıyor.
- Aynı hediye tıklaması iki abonelik uzatması oluşturmuyor.
- EvrenGezer → EvrenYazar çalışıyor; EvrenYazar → EvrenGezer reddediliyor.
- Yönetici işlemleri audit ekranında görülebiliyor.
- Kullanıcı aradığı içerik türünü ve kaldığı yeri kolayca bulabiliyor.
- Web, PWA ve Android aynı plan, bildirim ve hesap davranışını gösteriyor.

## Son önerim

6.3.0'ın başlığı ve kapsamı şu olmalı:

> **“Yeni özelliklerden önce güvenilir yayın, güvenli abonelik ve güçlü keşif.”**

Bunlar tamamlandıktan sonra 6.4'te ortak evren düzenleme, içerik üretici işbirliği ve daha gelişmiş sosyal özellikler çok daha güvenli biçimde büyütülebilir.
