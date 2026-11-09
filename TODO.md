# TentiFor ürün kuyruğu — P2

> Bu iş kullanıcı talebiyle uygulanıyor. Bu dal PR’a hazırlanacak; production veritabanına migration/backfill çalıştırılmayacak.

## P2 — Evren varlık kimliği ve wiki/harita/zaman çizelgesi bağlantıları

### A. Ortak kimlik ve mevcut veriye uyum — [x] Uygulandı

- Karakter, yer, tarih/olay, gezegen ve ansiklopedi maddelerinin mevcut kanonik kayıtları kendi bugünkü depolarında kalır; içerik başka bir modüle kopyalanmaz ve aynı başlığa sahip kayıtlar otomatik birleştirilmez.
- Her açıkça bağlanan kayıt evren kapsamlı, değişmez bir UUID `varlikId` alır. Yeni kayıt kimliği oluşturulurken bir kez kaydedilir; eski kayıt kimliği yalnızca kullanıcı ilişki kurmayı seçtiğinde eklenir, yerel dünya JSON’una yazılır ve mevcut eşitleme yollarında korunur. Array sırası/indeksi kimlik olarak kullanılmaz; toplu backfill yapılmaz.
- Wiki makalesinin var olan `id` değeri ve `?wiki=<id>` paylaşılabilir deep-link’i değişmez. `varlikId` ayrı ve opsiyoneldir; sanitizer, revision, portable JSON export/import ve geri yükleme bu alanı korur.
- `world.tarih`, eski `evren_zaman_noktalari` ve güncel `evren_zaman_olaylari` ayrı kayıtlardır. Başlık veya sıra benzerliğine göre otomatik eşleştirme/taşıma yapılmaz. Eski, eşleşmemiş kayıtlar çalışmaya devam eder.

### B. Yetkili ilişki katmanı ve yayın gizliliği — [x] Uygulandı

- Varlık ilişkisi sahip ve evren kapsamlıdır; türü, kaynak kayıt türünü ve kaynak kayıt kimliğini saklar. Kayıt ve link oluşturma idempotenttir. İstemciden gelen sahip bilgisine güvenilmez; RPC `auth.uid()` ve mevcut sahiplik/ortaklık kontrollerini kullanır.
- Harita düğümü ve zaman çizelgesi olayı nullable `varlik_id` ile aynı evrendeki kayıtlı varlığa bağlanabilir. Bu yeni alanlar boş kaldığında mevcut API ve eski kayıtlar çalışır. Harita toplu kaydı referansları korur; başka sahibin/evrenin kimliğine foreign-key/RPC üzerinden bağlanılamaz.
- Doğrudan tablo izinleri kapalı, RLS açık ve security-definer RPC `search_path` sabitlenmiştir. Kayıt silme yerine arşivleme/bağı kaldırma uygulanır; bağımsız kanonik içerik CASCADE ile silinmez.
- Taslak, bulunmayan, arşivli, yanlış türde veya başka sahip/evrendeki hedef sessizce kabul edilmez. Public RPC ve görünüm yalnızca erişilebilir/yayında hedefin güvenli link bilgisini verir; hedef taslaksa UUID, başlık, tür veya adet gibi özel metadata sızdırılmaz. Sahip önizlemesi public görünümden ayrıdır.
- Migration yalnızca additive, nullable ve geriye uyumlu hazırlanır. Bu görevde üretim veritabanına uygulanmaz ve kullanıcı verisinde backfill çalıştırılmaz.

### C. Üç modülde kullanıcı bağlantısı ve kaynağa dönüş — [x] Uygulandı

- Evren sahibi wiki, harita ve timeline düzenleyicilerinde kayıtları başlık/tür/bağlamla seçebilir; seçim kaynak kimliğini saklar. Aynı başlığa sahip hedefler ayrı kalır; var olmayan, taslak, yanlış türde veya kapsam dışı hedefler açık uyarı verir.
- Harita düğümü ve timeline olayı bağlı kanonik kayda açılabilir; wiki makalesindeki mevcut “İlgili maddeler” korunur ve ayrıca kişi/yer/olay/gezegen/wiki varlığına ID ile bağlantı sunulur.
- Bağlantı deep-link’i yenilemede korunur, browser Back/Forward ile doğru hedefe/önceki görünüme döner; mevcut `?wiki=` davranışı bozulmaz. Public okur yalnızca yayımlanmış/erişilebilir hedefleri açar.
- Yerel depolama, hesap/shared-world eşitlemesi ve portable JSON export/import `varlikId` ve ilişkileri korur; kimlik çakışması/iki cihazdan eşitleme belirsizliği varsa yanlış kayıt sessizce birleştirilmez.

## 2026-11-09 devir güncellemesi

- Harita ve zaman çizelgesi editörlerine UUID tabanlı hedef seçme, bağlı kaydı açmaya kaydırma ve bağı kaldırma kontrolleri eklendi; hedefler başlıkla otomatik eşleştirilmiyor.
- Harita/timeline yükleme RPC’leri `varlik_id` döndürecek ve harita toplu kaydı mevcut UUID’yi koruyacak şekilde güncellendi. Geriye dönük kurulumlar için `20261109_p2_editor_uuid_roundtrip.sql` eklendi.
- P2 uygulama kapsamı tamamlandı; production migration/backfill bu görevde özellikle çalıştırılmadı. Kalan kapılar: wiki/kişi/yer/gezegen kanonik kayıtlarının yetkili RPC ilişki katmanına alınması, public `?varlik=` açma akışı, local/shared/portable round-trip doğrulaması ve bağımsız güvenlik incelemesi ayrıca tamamlanmalı. PR taslak kalmalı.

## İnceleme kapısı

- Uygulama tamamlandığında bir salt-okunur bağımsız kod incelemesi; sahip/evren sınırları, public metadata sızıntısı, sanitizer/import uyumu, toplu harita save ve mevcut deep-link geriye uyumluluğunu denetleyecek.
- Otomatik Webdev LSP kaydı bulunmadığı için doğrulama mevcut lint, JS parse, statik SQL/RLS sözleşmeleri ve dış canlı yazmaları engellenmiş testlerle yapılacak. Production migration/backfill veya gerçek kullanıcı verisi üzerinde test yapılmayacak.

## P3 — Ürün bağlılığı ve keşif — [x] Uygulandı

- SEO/CI asset sürümleri service worker ve Android kabukta hizalandı.
- Public okuma yolu kartı başlık, yazar, spoiler’sız açıklama, tahmini okuma süresi ve güvenli paylaşım payload’ı sunuyor.
- Evren oluşturma akışı aşamalı ilerleme, sonraki adım ve otomatik taslak kaydı mesajını koruyor.
- Günlük/haftalık görevler yaklaşık süre ve tamamlanma sonrası sonraki adımı döndürüyor.
- Migration: `20261111_p3_engagement_cards_tasks.sql`; production migration/backfill bu görevde çalıştırılmadı.
