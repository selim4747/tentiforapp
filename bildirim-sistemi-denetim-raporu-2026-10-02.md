# TentiforApp bildirim sistemi denetim raporu

**Tarih:** 2026-10-02  
**Depo:** `selim4747/tentiforapp`  
**İncelenen sürüm:** `6.2.7` / commit `41882e0acfc45f4e3fa1dbea8d99f5c03fd7b055`

## Yönetici özeti

Bildirim sisteminin web akışı ve uygulama içi bildirim akışı statik testlerde çalışıyor. Ancak gerçek Android emulator CI'si uygulama testlerine ulaşmadan emulator/ADB katmanında başarısız oluyor; bu nedenle mobilde uçtan uca çalışma henüz kanıtlanmış değil.

En önemli kod bulgusu:

- **Yüksek öncelik — `bildirim_abonelik_sil` sahiplik kontrolü yok.** Canlı Supabase tanımında hem `anon` hem `authenticated` execute yetkisi bulunuyor. Fonksiyon, verilen endpoint'i doğrudan siliyor; `auth.uid()` ile endpoint sahibini karşılaştırmıyor. Bu, endpoint değeri bilinen başka bir kullanıcının web-push aboneliğinin silinmesine izin verebilir.

İkincil bulgular:

- **Orta öncelik — APK bildirim ayarı VAPID anahtarına gereksiz bağlı.** `js/admin/75-yonetim-yetkileri.js` içindeki ayarlar, `bildirimAcikAnahtar()` boşsa “site henüz kurmadı” gösteriyor. Oysa APK `LocalNotifications` kullanabilir ve VAPID anahtarına ihtiyaç duymaz. Bu nedenle VAPID kurulmamış ortamlarda APK kullanıcısı roman bildirimini ayarlar ekranından açamayabilir.
- **Orta öncelik — APK’de “Kapat” akışı web push’a göre yazılmış.** `bildirimKapat()` yalnızca Service Worker `pushManager` aboneliğini iptal ediyor. APK tarafında yerel izin iptali işletim sistemi ayarlarına yönlendirilmediği gibi, yerel bildirim tercihleriyle de açık biçimde eşleştirilmiyor.
- **Düşük/orta öncelik — gerçek mobil uçtan uca kanıt yok.** Son üç Android CI çalışması sırasıyla emulator ayarları/boot/ADB seviyesinde başarısız oldu. Bu uygulama kodunun hatalı olduğunu kanıtlamaz; fakat APK bildirim izni, Supabase oturumu, RPC’den bildirim çekme, `LocalNotifications.schedule` ve tıklama navigasyonu gerçek cihaz/emulator üzerinde doğrulanmış sayılmaz.

## Doğrulanan olumlu noktalar

### Web Push

- Service Worker `push` listener'ı kayıtlı.
- Push payload'ı `self.registration.showNotification(...)` ile gösteriliyor.
- Bildirim tıklamasında dış origin'ler kök adrese düşürülüyor; dış phishing adresine doğrudan yönlendirme yok.
- `bildirim_abone_ol` endpoint, `p256dh` ve `auth` biçimlerini SQL constraint'leriyle doğruluyor.
- 404/410 dönen eski push endpoint'leri Edge Function tarafından temizleniyor.
- Hedefli gönderim, kullanıcı adını profil UUID'sine çeviriyor.
- VAPID anahtarı yokken hedefli gönderimde uygulama içi bildirim kaydı oluşturulabiliyor.

### Uygulama içi bildirim merkezi

- `bildirimlerim` yalnızca `auth.uid()` kullanıcısının en fazla 50 bildirimini döndürüyor.
- `bildirimleri_okundu` yalnızca çağıran kullanıcının bildirimlerini güncelliyor.
- RLS, kullanıcı bildirimleri tablosunda kullanıcıların yalnızca kendi kayıtlarını seçmesine izin veriyor.
- Yönetici kişisel bildirimi `tam_yonetici_mi()` ile korunuyor.
- Bildirim bağlantısı SQL tarafında `#/` rotalarıyla sınırlandırılıyor.
- İstemci metinleri `kacir(...)` ile HTML injection'a karşı kaçırılıyor.

### Eski Notification hatası

Kaynak ve bundle denetiminde `new Notification(...)` kalmamış. Aşağıdaki dosyalar `showNotification(...)` kullanıyor:

- `js/engine/88-v46-yenilikler.js`
- `js/core/46-guncelleme.js`
- `js/paket-3.js`
- Android kabuk kopyaları
- `sw.js`

Böylece daha önce görülen `Failed to construct 'Notification': Illegal constructor` hatası kaynakta tekrarlanmıyor.

## Çalıştırılan testler

Başarılı:

1. `node tests/canli-ortam-simulasyonu.mjs` — **18/18 PASS**
2. `node tests/5.3.4-layout-notifications.mjs` — **PASS**
3. `node tests/5.3-regressions.mjs` — **PASS**
4. `node tests/offline-yavas.mjs` — **PASS**

Bu testler şunları kapsıyor: geçersiz kimlik doğrulama, admin/okur ayrımı, push aboneliği, geçersiz endpoint, hedefli uygulama bildirimi, Web Push gönderimi, eski endpoint temizliği, yetkisiz gönderim, Service Worker push/click listener'ları ve illegal `Notification` constructor regresyonu.

## Canlı Supabase bulgusu

Canlı proje: `wlgtjbrlquefnzavwein`.

Salt-okunur `pg_proc` kontrolünde:

| Fonksiyon | anon execute | authenticated execute | Not |
|---|---:|---:|---|
| `bildirim_abone_ol` | Evet | Evet | Hesapsız web aboneliği tasarımıyla uyumlu |
| `bildirim_abonelik_sil` | Evet | Evet | **Endpoint sahiplik kontrolü yok; düzeltilmeli** |
| `bildirimlerim` | Hayır | Evet | `auth.uid()` ile filtreli |
| `bildirimleri_okundu` | Hayır | Evet | `auth.uid()` ile filtreli |
| `yonetici_kisisel_bildirim` | Hayır | Evet | `tam_yonetici_mi()` ile korunuyor |

Önerilen SQL güvenlik düzeltmesi:

```sql
create or replace function public.bildirim_abonelik_sil(p_endpoint text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare silinen integer := 0;
begin
  delete from public.bildirim_abonelikleri
   where endpoint = p_endpoint
     and (kullanici = auth.uid() or kullanici is null);
  get diagnostics silinen = row_count;
  return jsonb_build_object('durum', 'tamam', 'silinen', silinen);
end;
$$;

revoke execute on function public.bildirim_abonelik_sil(text) from anon;
grant execute on function public.bildirim_abonelik_sil(text) to authenticated, anon;
```

Not: Hesapsız abonelik desteği korunacaksa `kullanici is null` satırı anon aboneliğin kendi endpoint'ini silmesini mümkün kılar; fakat anonim endpoint'lerde sahiplik kanıtı bulunmadığı için daha sıkı model, abonelik silme işlemini yalnızca authenticated kullanıcıya açmak veya silme için abonelik oluştururken verilen tek kullanımlık bir sahiplik belirteci eklemektir. En güvenli öneri: web push aboneliğini hesapla ilişkilendirmek ve silmeyi yalnızca `kullanici = auth.uid()` koşuluyla yapmak.

## Yayın/PR durumu

- Yerel `main` ve `origin/main` aynı commit'te: `41882e0...`.
- Bildirim sistemi için açık ve bekleyen bir PR yok.
- Açık görünen PR **#95 V4.4 release**; bu görevle ve 6.2.7 bildirim denetimiyle ilgisiz olduğu için birleştirilmedi.
- Bu denetim turunda kaynak koduna yeni değişiklik yapılmadı; rapor dosyası çalışma ağacında yeni dosya olarak duruyor.

## Öncelikli aksiyon planı

1. `bildirim_abonelik_sil` için abonelik sahipliği kontrolünü migration olarak ekle ve canlıya uygula.
2. APK ayarlarındaki “Yeni roman bölümü” satırını VAPID anahtarından bağımsız olarak `bildirimYerelMi()` durumuna göre göster.
3. APK kapatma/açma akışını `LocalNotifications.checkPermissions/requestPermissions` ve uygulama tercihleriyle açıkça eşleştir.
4. Android CI emulator boot sorununu uygulama assertion'larından bağımsız bir job olarak düzelt; mümkünse gerçek cihazda veya stabil bir emulator image'ında bildirim smoke testi ekle.
5. Canlıda hedefli uygulama bildirimi, hedefli Web Push, tüm abonelere Web Push, eski endpoint temizliği ve hesap silme/abonelik silme senaryolarını ayrı ayrı doğrula.

## Sonuç

**Web ve Supabase sözleşmesi statik/simülasyon testlerinde sağlıklı; ancak sistem tamamen hatasız ilan edilemez.** Özellikle `bildirim_abonelik_sil` canlı güvenlik açığı ve APK bildirim ayarının VAPID anahtarına bağlanması 6.2.7 sonrası düzeltilmesi gereken iki somut konudur. Android CI başarısızlığı ise şu an bildirim kodundan çok emulator altyapısı seviyesindedir ve mobil uçtan uca testin tamamlanmasını engellemektedir.
