# Canlı Ortam Simülasyonu

Bu koşucu, üretim Supabase projesine veya gerçek cihazlara bağlanmadan üç kritik entegrasyonu canlıya yakın sözleşmelerle doğrular:

- **Supabase:** oturum, rol/yetki, Web Push aboneliği, abonelik silme, uygulama içi hedefli bildirim ve inbox okundu akışı.
- **Web Push / Service Worker:** push payload, bildirim gösterimi, dış origin link güvenliği ve periodic sync listener kurulumu.
- **Capacitor / Android:** `LocalNotifications` izin, schedule/cancel ve bildirim tıklama hook’larının kaynak sözleşmesi.

## Çalıştırma

```bash
node tests/canli-ortam-simulasyonu.mjs
```

Test, bellekte izole bir Supabase/Edge Function benzetimi kurar. Gerçek erişim token’ı, VAPID anahtarı, e-posta, cihaz verisi veya production mutation kullanılmaz.

## Kapsanan senaryolar

1. Hatalı ve doğru Supabase oturumu.
2. Geçerli/geçersiz Web Push endpoint ve anahtarları.
3. Okur aboneliğinin kaydedilmesi ve kaldırılması.
4. Yönetici yetkisiyle hedefli uygulama bildirimi.
5. Yetkisiz kullanıcının bildirim gönderememesi.
6. VAPID anahtarı yokken yalnızca uygulama içi hedefli bildirim fallback’i.
7. Aktif push aboneliğine gönderim.
8. 404/410 benzeri stale endpoint temizliği.
9. Güvensiz bildirim adresinin `#/sen` fallback’ine alınması.
10. Service Worker `push`, `notificationclick` ve `periodicsync` listener’ları.
11. Dış origin bildirim linkinin aynı origin köke sınırlandırılması.
12. Native `LocalNotifications` yaşam döngüsü hook’larının varlığı.

## Gerçek staging’e geçiş

Gerçek Supabase staging projesiyle çalıştırmak için ayrı bir proje URL’si, publishable key, VAPID key çifti ve Edge Function secret’ları gerekir. Bu oturumdaki Supabase connector’ı kapalı olduğu için bu aşamada gerçek projeye bağlanılmadı. Simülasyon başarılı olduktan sonra staging migration’ları ayrı bir Supabase projesinde çalıştırılmalı; production projesi kullanılmamalıdır.
