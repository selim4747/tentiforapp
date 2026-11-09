# Supabase genel sağlık ve güvenlik audit’i

**Proje:** `tentiforapp` (`wlgtjbrlquefnzavwein`)
**Tarih:** 2026-11-09
**Yöntem:** Supabase MCP üzerinden salt-okunur PostgreSQL katalog sorguları ve güvenli RPC smoke testleri
**Veri değişikliği:** Yok. INSERT/UPDATE/DELETE/backfill çalıştırılmadı.

## 1. Yönetici özeti

Canlı proje erişilebilir ve sağlıklı durumda. Şema sürümü `6.6.2`; public şemada 93 tablo var ve 93 tablonun tamamında RLS açık. P2/P3 migration’ları canlıda mevcut.

Bununla birlikte legacy şema için üç önemli takip alanı var:

1. **75 tablo RLS açık olmasına rağmen policy’siz.** Bu tabloların önemli bölümü RPC-only mimaride tasarlanmış görünüyor. Bu durum otomatik olarak açık anlamına gelmez; doğrudan tablo grant’leri kapalıysa yalnızca RPC yüzeyi erişilebilir. Ancak her tablo için beklenen erişim modeli belgelenmeli.
2. **44 security-definer fonksiyon anon’a açık.** Bunların bir bölümü bilinçli public read/telemetri/moderasyon doğrulama endpoint’i olabilir. Buna rağmen fonksiyon bazında public veri, rate-limit ve auth gereksinimi incelenmeli.
3. **28 public view’ın 27’si anon SELECT’e açık.** View’ların döndürdüğü kolonların public olması gerekir; kullanıcıya özel veya moderasyon verisi içeren view’lar daraltılmalı.

Olumlu bulgu: Security-definer fonksiyonların katalogdaki tamamında `search_path` ayarı mevcut; bu taramada search-path’siz security-definer fonksiyon bulunmadı.

## 2. Şema ve RLS

| Kontrol | Sonuç | Değerlendirme |
|---|---:|---|
| Kurulum sürümü | `6.6.2` | Beklenen canlı sürüm |
| Public tablo | 93 | Normal |
| RLS açık tablo | 93/93 | Güçlü temel kontrol |
| RLS kapalı tablo | 0 | Başarılı |
| Policy’siz RLS tablo | 75 | Orta/yüksek takip riski; RPC-only tasarım doğrulanmalı |
| Policy’si olan tablo | 18 | Doğrudan erişim sözleşmesi olanlar |
| Primary key olmayan tablo | 5 | Deneme/log tablolarında bilinçli olabilir; veri modeli incelenmeli |

Policy’siz tabloların tamamına otomatik `SELECT/INSERT/UPDATE/DELETE` policy eklenmesi önerilmez. Bu, RPC-only güvenlik modelini bozabilir. Doğru işlem: her tabloyu `public direct access`, `authenticated-only RPC`, `admin-only` veya `internal/log` sınıfına ayırıp yalnızca gerektiği yerde policy/grant eklemektir.

## 3. Fonksiyon ve RPC güvenliği

| Kontrol | Sonuç | Değerlendirme |
|---|---:|---|
| Public RPC/function katalog taraması | Başarılı | Katalog okunabildi |
| Security-definer fonksiyon | Çok sayıda | Her biri sahiplik/auth kontrolüyle korunmalı |
| Anon’a açık security-definer | 44 | Fonksiyon bazlı inceleme gerekli |
| Security-definer + explicit `search_path` | Tamamı | İyi |
| Security-definer + eksik `search_path` | 0 | Başarılı |
| P2 yazma RPC’leri anon execute | Kapalı | Başarılı |
| P2 yazma RPC’leri authenticated execute | Açık | Beklenen |
| Public resolver smoke testi | `null` | Taslak/olmayan metadata sızdırılmadı |

P2 fonksiyonlarında doğrulanan grant sözleşmesi:

- `evren_varlik_kaydet`: anon kapalı, authenticated açık.
- `evren_varlik_kaydet_kanonik`: anon kapalı, authenticated açık.
- `evren_varlik_bagla`: anon kapalı, authenticated açık.
- `evren_varlik_bilgisi`: public resolver olarak anon/authenticated açık.
- `kesif_gorevlerim`: anon kapalı, authenticated açık.

## 4. Public view yüzeyi

Public şemada 28 view bulundu; 27 view anon SELECT’e açık, bir view doğrudan SELECT’e kapalı.

Anon’a açık view’lar için özellikle şu kontroller yapılmalı:

- Kullanıcıya özel UUID, e-posta, cihaz, ödeme veya moderasyon alanı dönüyor mu?
- View yalnızca yayımlanmış kayıtları mı döndürüyor?
- View üzerinden satır sayısı, taslak varlığı veya özel metadata tahmin edilebiliyor mu?
- View’ın sahibi ve security-invoker/security-definer davranışı beklenen modelle uyumlu mu?

Bu audit’te view tanımları toplu olarak değiştirilmiyor; çünkü her view için ürünün public/private sözleşmesi farklı.

## 5. Foreign key ve primary key kontrolleri

Katalogda 5 primary-key’siz tablo görüldü:

- `av_denemeleri`
- `moderator_denemeler`
- `okur_bulmaca_denemeleri`
- `tek_kod_denemeleri`
- `uygulama_skor_denemeleri`

Bunlar deneme/log tablolarıysa primary key zorunlu olmayabilir. Kalıcı kullanıcı verisi tutuyorlarsa UUID veya surrogate bigint primary key eklenmesi değerlendirilmelidir. Mevcut satırlara dokunmadan önce duplicate ve kullanım analizi yapılmalı.

Foreign key index taraması, özellikle bileşik sahip/evren ilişkilerinde eksik covering index uyarıları üretiyor. Index eklemek genellikle düşük risklidir; ancak tablo boyutları, yazma trafiği ve mevcut index’ler görülmeden toplu index migration’ı çalıştırılmadı.

## 6. Veri ve backfill güvenliği

Canlı kontrol sonucu:

- `evren_varliklari` mevcut.
- Entity registry satır sayısı: `0`.
- Harita `varlik_id` bağlantı satırı: `0`.
- Timeline `varlik_id` bağlantı satırı: `0`.
- Kullanıcı verisi backfill edilmedi.
- Hediye, üyelik, bildirim veya içerik değiştiren RPC çağrılmadı.

Bu durum additive migration’ın eski veriyi sessizce değiştirmediğini doğruluyor.

## 7. Çalıştırılan salt-okunur kontroller

- `public.kurulum_surumu()` sürüm kontrolü
- Public tablo ve RLS sayımı
- Policy kapsamı ve policy’siz tablo listesi
- Security-definer fonksiyon, `search_path` ve anon/authenticated execute grant taraması
- Public view ve anon SELECT grant taraması
- Primary key/foreign key katalog taraması
- P2/P3 RPC grant ve RLS doğrulaması
- Public resolver için bulunmayan hedef smoke testi

## 8. Önceliklendirilmiş öneriler

### P0 — Yapılmalı

- Payment, moderator, device, private user data ve admin fonksiyonlarının anon grant’lerini fonksiyon bazında yeniden doğrula.
- Anon’a açık 44 security-definer fonksiyon için beklenen public sözleşme matrisi oluştur.
- Public view’larda özel alan ve taslak metadata sızıntısı için kolon bazlı inceleme yap.

### P1 — Planlanmalı

- 75 policy’siz tabloyu RPC-only/direct-policy/internal sınıflarına ayır.
- FK index eksiklerini tablo boyutu ve sorgu planlarıyla doğrula; sonra additive index migration uygula.
- Primary-key’siz beş tablo için kullanım ve duplicate analizi yap.

### P2 — Performans

- `auth.uid()` satır-başı tekrar değerlendirme uyarılarını `(select auth.uid())` biçimine dönüştürmeyi benchmark ederek planla.
- Public view’lar ve ağır discovery RPC’leri için `EXPLAIN`/latency ölçümü ekle.

## Sonuç

P2/P3 canlı migration ve temel RLS/RPC sözleşmesi başarılıdır. Projenin bütün tablolarında RLS açık ve security-definer fonksiyonlarda explicit `search_path` bulunuyor. Kalan 75 policy’siz tablo, 44 anon security-definer fonksiyon, 27 anon view ve FK/PK uyarıları gerçek sorun adaylarıdır; fakat bunlar tek bir toplu migration ile güvenle düzeltilemez. Fonksiyon ve tablo bazlı erişim matrisi çıkarıldıktan sonra ayrı, küçük ve geri alınabilir migration’larla ele alınmalıdır.

## 9. Onaylı production hardening sonucu — 2026-11-09

Kullanıcı onayıyla düşük riskli hardening adımları canlıya uygulandı:

- Policy’siz RLS tablolarındaki anon doğrudan grant’leri temizlendi. Sonuç: policy’siz RLS tablolarında anon privilege sayısı `0`.
- Hassas legacy tabloların anon grant’leri kapatıldı: abonelik, başvuru, bildirim, hata, hediye, kullanıcı aboneliği/bildirimleri, moderasyon, ödeme, şikâyet ve yönetici tabloları.
- `profiller_sunucu_alanlarini_koru()` trigger helper’ının ve `bildirim_sayisi()` admin helper’ının anon execute yetkisi kapatıldı.
- Foreign-key kolonları için mevcut PK/unique/index prefix’leri korunarak yalnızca eksik prefix indexleri eklendi. Doğrulama sonucu eksik FK prefix index sayısı `0`; gerçek yardımcı index sayısı `54`.
- Önceki index migration’ındaki sıfır-tabanlı `int2vector` slice hatası düzeltildi ve redundant yardımcı indexler kaldırıldı.
- Security-definer fonksiyonlarda eksik `search_path` sayısı `0` olarak kaldı.
- Şema sürümü `6.6.2` olarak kaldı; kullanıcı verisi, backfill ve içerik satırları değiştirilmedi.

Public view’lar, doğrudan kullanılan `profiller`, `istatistikler`, `ilerlemeler` ve `evren_sahipleri` tabloları ile token tabanlı moderasyon RPC’leri uygulama uyumluluğu nedeniyle korunmuştur.
