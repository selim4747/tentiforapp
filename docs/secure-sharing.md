# 6.3.10 — güvenli paylaşım ve özet analitik

## Paylaşım akışı

- Süreli token yalnızca oturum açmış **içerik sahibinin** herkese açık profili, yayımlanmış evreni veya public okuma yolu için oluşturulur. Başka bir kullanıcının public içeriği paylaşılırken süreli token alınamaz; uygulama doğrulanmış canonical URL’yi kullanır.
- Token UUIDv4 biçimindedir. İstemciden gelen içerik türü/kimliği SQL tarafında tekrar doğrulanır; profiller, evrenler ve okuma yolları için görünürlük, yayın ve hesap durumu her oluşturma/açma işleminde yeniden kontrol edilir.
- Uygulama şu an varsayılan **30 günlük** token üretir; veritabanı RPC’si sabit 1, 7 veya 30 günlük seçenekleri kabul eder. Sahip hesabı en çok 100 etkin bağlantı ve saatte 20 yeni bağlantı sınırına tabidir. Eski iptal edilmiş/süresi 90 günden uzun geçmiş kayıtlar, yeni bir bağlantı oluşturulurken o sahip için temizlenir.
- Token iptali **yalnızca token URL’sini** geçersiz kılar. İçerik public kalıyorsa canonical adresi bilen herkes içeriğe erişebilir; içeriği tamamen gizlemek için profil/evren/okuma yolu görünürlüğü ayrıca kapatılmalıdır.
- Android’de Capacitor Share, destekleyen tarayıcılarda Web Share API, diğerlerinde pano kopyalama kullanılır. Tarayıcı/paylaşım hizmeti kullanılamasa bile herkese açık içeriğin erişimi engellenmez.

## Analitik ve veri sınırı

- Yalnızca günlük sayaçlar saklanır: açılma, kopyalama ve native/Web Share eylemleri. Açılma sayısı token/gün başına 2.000; sahip eylemleri olay/gün başına 100 ile sınırlandırılır.
- Ham ziyaret kaydı, IP, user-agent/cihaz kimliği, referrer, çerez, ziyaretçi hesabı veya kesin açılma zamanı tutulmaz. Olay tablosu yalnızca token, gün, sabit olay türü ve sayaç alanlarını içerir.
- Ham tablolar RLS ile korunur ve `anon`/`authenticated` için doğrudan tablo izinleri kapalıdır. Sahip geçmişi yalnızca `auth.uid()` ile eşleşen bağlantıları, en fazla son 100 kaydı ve günlük özetleri döndürür.
- Public token çözümleme RPC’si içeriğin hâlâ public olup olmadığını doğrular; iptal edilmiş, süresi dolmuş veya görünürlüğü kapanmış token için içerik yolu döndürmez.

## Doğrulama

`tests/6.3.10-secure-sharing.mjs` SQL/istemci gizlilik sözleşmelerini; `tests/seo-playwright.mjs` ise gerçek tarayıcıda native Web Share, pano fallback’i ve mevcut SEO paylaşım kartı akışını doğrular. Android Gradle CI `versionCode 621` derlemesini ayrıca sınar.
