# Özel GitHub harita görsel deposu

Harita görsellerinin ikili dosyaları artık herkese açık `tentiforapp` kaynak deposuna veya yeni Supabase Storage yüklemelerine gitmez. Yeni dosyalar, ilk yüklemede Worker’ın oluşturduğu `tentiforapp-media-v1` GitHub Release’ine yüklenir; `supabase.evren_gorsel_alanlari` tablosunda yalnızca görsel yolu ve sınırlı metadata tutulur. `selim4747/tentiforapp-media` deposu **private kalmalıdır**. Pages Function ayrıca depoyu API’den kontrol eder ve public olduğunu görürse görsel aktarımını reddeder.

## Dağıtım öncesi

1. `selim4747/tentiforapp-media` için yalnızca bu depoya erişebilen bir GitHub fine-grained token oluşturun. `Contents: Read and write` izni yeterlidir; token’ı istemci koduna, Git geçmişine veya mesajlara koymayın.
2. Cloudflare Pages projesi `tentiforapp` içinde `GITHUB_TOKEN` adlı **Secret** ekleyin. Production ve Preview ortamlarına eklenmesi önerilir.
3. `supabase/migrations/20261020_github_map_image_delete.sql` migration’ını Supabase’e uygulayın. Bu, görsel silme yetkisini yükleme ile aynı sahip/ortak-üye kontrolüne hizalar ve eski asset yolunu temizlik için döndürür.
4. Mevcut Cloudflare Pages dağıtımı `functions/api/evren-gorsel.js` rotasını da içerecek şekilde yayınlandığında endpoint etkinleşir. Ayrı Worker veya statik site deployment yöntemi değişikliği gerekmez.

Token tanımlanmadan önce API yeni GitHub görsel yüklemelerini `image-storage-not-configured` ile reddeder; mevcut eski Supabase görselleri okunabilir kalır. İlk başarılı aktarım özel release’i otomatik oluşturur. Paylaşılan/yayınlanmış harita görseli ancak mevcut Supabase `evren_gorsel_varlik_oku` RPC’si kullanıcının o haritaya erişimini doğruladıktan sonra Worker üzerinden verilir.
