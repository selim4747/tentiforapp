# TentiforApp — Tentiforverse Arşivi (v6.3.15)

Tömye'nin gökyüzünde ay yoktur, ama ayları 28 gün çeker. Tentiforverse evren arşivi: karakterler, kozmoloji, isim sistemi, takvim ve oyunlar.

## Özellikler
- **Evren & Karakter Arşivi**: Tömye, E25, E26, E99, Claude evreni ve Model Vitrin Evreni (Eterya).
- **Model Test Evreni (Eterya: Yıldız Kırıkları)**: Evren Kurucu'nun tüm yeteneklerini (kurallar, harita, kişiler, ilişki ağı, hikâyeler, mektuplar, sözlük, açık sorular ve glif alfabesi) canlı sergileyen test evreni.
- **Akıllı Sürüm & İçerik Bildirimleri**: Sadece gerçek sürüm farkında yeni sürüm uyarısı, yeni evren/içerik eklendiğinde tekrarlamayan akıllı bildirimler.
- **Uygulama İçi Bildirim Ayarları & Mobil Moderasyon**: Sen sayfasından bildirim tercihleri ve mobil menüden tek tıkla moderasyon paneline erişim.
- **Kozmoloji & Takvim**: 13 aylık takvim, isim motoru, sözlük.
- **Evrengezer ve Fan Hikaye Atölyesi**: Evren üretimi, karakter tasarımı ve fan hikayeleri.
- **PWA & Çevrimdışı Desteği**: Service Worker ile tam çevrimdışı çalışma.
- **Public SEO & Paylaşım Kartları**: Görünürlüğü açık profiller, yayımlanmış evrenler ve public okuma rotaları için crawler sayfaları; uygulama içi Open Graph/Twitter metadata ve indirilebilir PNG paylaşım kartı. SSR bulunmadığında kullanılan build-time fallback için [SEO notlarına](docs/seo-prerender.md) bakın.
- **Güvenli Paylaşım & Özet Analitik**: Yalnızca herkese açık içerikler için 30 günlük, iptal edilebilir bağlantılar; Android/Web Share veya pano kopyalama, sahip hesabına özel geçmiş ve IP/cihaz/referrer tutmayan günlük toplulaştırılmış sayımlar. Token iptali içeriğin kendi herkese açık yayınını kapatmaz; bunun için içeriğin görünürlük ayarını değiştirmek gerekir. Ayrıntı: [paylaşım/gizlilik notları](docs/secure-sharing.md).
- **Gizli kimlikler**: Kanonik karakter profillerinde kapalı spoiler kimlikleri; yönetici panelinden düzenleme, L25 için Star Saver ve Feil için Yaşam/Kütüphaneci/Bilim insanı kimlikleri.
- **Bağımsız iç evren kişi kartları**: Kişilikler, gizli kimlikler ve olaylar evren başına ayrı tutulur; yan evren bağlantısı kayıtları veya bedenleri birleştirmez.
- **Mobil düzenleme**: İç evren ve kimlik formlarında tek sütunlu, taşmasız ve dokunmaya uygun alanlar.
- **Mobil APK & Android Desteği**: Capacitor ile paketlenebilir kabuk mimarisi.

## 6.0 APK yol haritası

6.0 için Android entegrasyonu, dosya açma/paylaşma hedefi, ana ekran widget’ı ve kısayollar, gelişmiş bildirim aksiyonları, biyometrik gizli içerik kilidi, arka plan sesli okuma, QR/NFC paylaşımı, cihaz yedekleme ve sensör tabanlı deneyler planlanmaktadır. Ayrıntılı kapsam için [6.0 APK yol haritasına](ROADMAP-6.0-APK.md) bakın.

## Çalıştırma
```bash
npm install
npm run build
npm start
```
