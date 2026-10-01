# TentiforApp 6.0 — APK ve Android Entegrasyonu Yol Haritası

> Bu belge 6.0 hedeflerini tanımlar. 5.4.4 mevcut kararlı sürümdür; aşağıdaki maddeler henüz otomatik olarak yayınlanmış özellikler değildir.

## Amaç

TentiforApp APK’sını yalnızca web sitesini açan bir kabuk olmaktan çıkarıp, Android’in dosya sistemi, bildirimleri, ana ekranı, güvenlik ve paylaşım mekanizmalarıyla bütünleşen gerçek bir mobil uygulamaya dönüştürmek.

## 6.0 özellik kapsamı

### 1. Dosya ve paylaşım entegrasyonu

- `.tentifor.html`, `.tentifor`, `.json` ve uygun metin dosyalarını Android’de **TentiforApp ile aç** desteği.
- Android paylaşım menüsünde TentiforApp hedefi.
- Başka uygulamalardan gelen metni yeni hikâye, karakter fikri, evren notu veya taslak olarak kaydetme.
- Alınan dosyayı doğrudan **Açılanlar** veya **Fan Evrenlerim** alanına aktarma.
- Dosya içe/dışa aktarma sırasında güvenli boyut ve içerik doğrulaması.

### 2. Ana ekran ve hızlı erişim

- Android ana ekran widget’ı.
- Widget’ta günün kelimesi, son okunan evren, okuma ilerlemesi ve yeni içerik sayısı.
- Uygulama simgesine uzun basınca kısayollar:
  - Okumaya devam et
  - Günün Kelimesi
  - Yeni evren kur
  - Fan hikâyesi yaz
  - Rastgele evren
- Android bildirim rozeti ve okunmamış içerik sayısı.

### 3. Gelişmiş bildirimler

- Günün Kelimesi bildirimi için **Oyna** ve **Daha sonra hatırlat** aksiyonları.
- Yeni içerik, moderasyon sonucu, hikâye onayı ve ortak evren davetleri için doğrudan hedefe giden bildirimler.
- Bildirimlerden uygulama açılmadan ilgili aksiyona geçiş.
- Bildirim saatini, günleri ve türlerini kullanıcıya göre ayarlama.
- Bildirim geçmişi ve tekrar bildirimlerini engelleme.

### 4. Gizli içerik güvenliği

- Gizli lore katmanlarını cihazın biyometrik doğrulamasıyla koruma.
- Parmak izi, yüz doğrulama veya Android cihaz kilidi üzerinden güvenli açma.
- Özel evren notları, kişisel taslaklar ve moderasyon alanı için ayrı kilit seçenekleri.
- Başarısız doğrulamada içeriği göstermeme ve güvenli geri dönüş.

### 5. Okuma ve ses deneyimi

- APK’ye özel tam ekran, dikkat dağıtmayan okuma modu.
- Ekranın okuma sırasında kapanmasını önleme seçeneği.
- Arka planda sesli okuma.
- Kilit ekranı ve kulaklık kontrolleriyle oynat/durdur, ileri/geri ve sonraki bölüm.
- Okuma konumunu paragraf seviyesinde kaydetme.
- Hız, ses ve bölüm bazlı sesli okuma ayarları.

### 6. QR, bağlantı ve yakın paylaşım

- Evren, hikâye, karakter ve davet bağlantıları için QR oluşturma.
- QR kod tarayarak evren veya ortak çalışma davetine katılma.
- Yönetici kodlarını QR ile güvenli aktarabilme; kodu ekranda açık metin olarak göstermeme seçeneği.
- NFC veya Android yakın paylaşım desteğiyle evren bağlantısı ve karakter kartı aktarımı.

### 7. Yedekleme ve cihaz taşıma

- Okuma konumu, favoriler, yerel evrenler, fan hikâyeleri, skorlar ve ayarların Android yedeklemesi.
- Yeni telefonda uygulama kurulunca yerel ilerlemeyi geri yükleme.
- Kullanıcının açık onayıyla şifreli yerel yedek dosyası oluşturma.
- Yedek içeriğini başka cihaza dosya veya paylaşım yoluyla taşıma.
- Bozuk ya da uyumsuz yedekte mevcut veriyi koruyan geri dönüş akışı.

### 8. Sensör tabanlı mobil deneyler

- Telefonu eğerek veya döndürerek evren haritasında gezinme.
- İvmeölçer ve jiroskopla geçit açma gibi küçük oyun mekanikleri.
- Pusulayla keşif ve yön bulma oyunları.
- Sallama hareketiyle rastgele keşif veya kader seçimi.
- Sensör izni verilmeyen cihazlarda aynı özelliklerin dokunmatik alternatifleri.

### 9. Günlük kullanım ve mobil alışkanlıklar

- Günlük okuma serisi ve günlük oyun serisi.
- Haftalık keşif hedefleri.
- Günün Kelimesi için streak, en iyi skor ve kişisel istatistikler.
- Widget ve bildirim üzerinden seriyi koruma hatırlatması.
- Kullanıcı istemezse tüm günlük bildirimleri tek ayarla kapatma.

### 10. APK yaşam döngüsü

- Uygulama içinden yeni APK sürümünü, boyutunu ve değişiklik notlarını gösterme.
- İndirme ilerlemesi ve bağlantı kesilince devam edebilme.
- Sürüm doğrulaması ve bozuk APK indirmesinde güvenli iptal.
- Android geri tuşu, modal, menü ve uygulamadan çıkış davranışlarının bütün akışlarda tutarlı olması.

## Önceliklendirme

| Öncelik | Paket | Gerekçe |
|---|---|---|
| P0 | Dosya açma, paylaşım hedefi, bildirim aksiyonları | Mevcut dosya ve bildirim altyapısını doğrudan güçlendirir |
| P1 | Widget, uygulama kısayolları, biyometrik kilit | APK’nin web sitesinden farkını görünür kılar |
| P1 | Yedekleme ve cihaz taşıma | Kullanıcının yerel evrenlerini korur |
| P2 | Arka plan sesli okuma ve medya kontrolleri | Uzun okuma deneyimini mobil uygulamaya dönüştürür |
| P2 | QR, NFC ve yakın paylaşım | Evren paylaşımını kolaylaştırır |
| P3 | Sensör oyunları ve gelişmiş günlük sistem | Deneysel, tematik mobil özellikler |

## Teknik sınır

Bu yol haritasındaki web katmanı geliştirmeleri mevcut `www` içeriğiyle yapılabilir. Dosya ilişkilendirme, widget, biyometrik doğrulama, paylaşım hedefi, arka plan medya ve Android yedekleme gibi özellikler APK’nın Android katmanında yeni izinler veya Capacitor eklentileri gerektirebilir. Senin bilgisayarına Android Studio veya Node.js kurulması zorunlu değildir; Android build işlemi bulut CI üzerinden üretilebilir.

## Başarı ölçütleri

- APK, web sitesinden bağımsız olarak en az üç Android sistem entegrasyonu sunar: dosya açma, widget/kısayol ve gelişmiş bildirim.
- Kullanıcının yerel evrenleri ve okuma ilerlemesi cihaz değişiminde kaybolmaz.
- Gizli içerik, cihaz biyometrisi olmadan görüntülenmez.
- İnternetsiz açılış ve mevcut çevrimdışı testleri korunur.
- Android izinleri yalnızca ilgili özellik ilk kez kullanıldığında istenir.
- İzin verilmeyen cihazlarda her özellik için işlevsel bir dokunmatik/web alternatifi bulunur.
