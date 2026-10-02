# Supabase şema ve fonksiyon test raporu

**Proje:** `tentiforapp` (`wlgtjbrlquefnzavwein`)

## Sonuç

Fonksiyon ve tablo smoke testlerinde çalışma zamanı hatası alınmadı. Hediye akışının güncel migration'ı canlı veritabanında mevcut ve `abonelik_hediye` fonksiyonu `hediye_gecmisi` ile bildirim akışını içeriyor.

## Doğrulananlar

| Kontrol | Sonuç |
|---|---|
| Public tablolar | 66 tablo bulundu |
| RLS | 66 tablonun tamamında açık |
| `hediye_gecmisi` | Mevcut, RLS açık, 2 policy, 3 index |
| `kurulum_surumu()` | `6.2.5` döndü |
| `tam_yonetici_mi()` anonim context | `false` döndü; beklenen sonuç |
| `abonelik_durumum()` | Hatasız şekilde ücretsiz plan bilgisi döndü |
| `bildirimlerim()` | Hatasız şekilde boş liste döndü |
| RPC/function katalog taraması | 139 public fonksiyon bulundu; katalog okunabildi |
| TypeScript tip üretimi | Başarılı |

Veri değiştiren fonksiyonlar, özellikle `abonelik_hediye`, test amacıyla çağrılmadı; bu fonksiyonları çağırmak gerçek kullanıcı üyeliğini ve bildirimlerini değiştirir.

## Danışman bulguları

Bunlar doğrudan çalışma zamanı hatası değildir, fakat proje sağlığı açısından takip edilmelidir:

- 49 tabloda RLS açık fakat doğrudan RLS policy yok. Bu tabloların çoğu yalnızca `SECURITY DEFINER` RPC'leri üzerinden kullanılmak üzere tasarlanmış görünüyor; doğrudan istemci erişimi gerekiyorsa policy eklenmeli.
- 26 view `SECURITY DEFINER` olarak işaretlendi. Bu view'lar bilinçli olarak herkese açık özet/veri sunuyorsa tasarım kararıdır; değilse erişimleri daraltılmalı.
- 24 SECURITY DEFINER fonksiyon anonim role açık görünüyor; token doğrulayan veya anonim sayaç/abone akışları için bilinçli olabilir, fakat her fonksiyon ayrıca incelenmeli.
- 40 foreign key için covering index eksikliği performans uyarısı oluşturuyor.
- 5 tabloda primary key yok. Deneme/log tabloları için bilinçli olabilir; kalıcı veri tablolarında düzeltilmeli.
- 12 RLS policy'si `auth.uid()` çağrısını satır başına yeniden değerlendiriyor. `hediye_gecmisi` policy'leri dahil olmak üzere `(select auth.uid())` biçimine dönüştürülmesi performansı iyileştirir.

## Hediye akışı özel kontrolü

`abonelik_hediye(text, text, integer)` canlı tanımı:

- tam yönetici kontrolü yapıyor,
- `abonelikler` tablosunda üyeliği güncelliyor,
- `hediye_gecmisi` tablosuna kayıt ekliyor,
- `kullaniciya_bildir` çağırıyor,
- yalnızca `authenticated` role açık.

Sonuç: Hediye akışı için gerekli tablo, indeks, fonksiyon ve grant'ler mevcut; salt-okunur testlerde hata yok.
