> Alan adı geçiş notu (2026-10-07): bu rapordaki site bağlantıları güncel ana alan adına taşındı; tarihsel test bulguları değişmedi.

# TentiforApp — Derinlemesine Hata, Eksik Bağlantı ve Sorun Raporu

**Denetim tarihi:** 2026-10-03  
**İncelenen commit:** `1ba8eca`  
**Kapsam:** Frontend, JavaScript çalışma zamanı/mantık, PWA/offline, SEO, erişilebilirlik, Android/Capacitor, Supabase/RLS/RPC/Edge Functions, veri bütünlüğü, dokümantasyon ve gerçek tarayıcı akışları.

> Bu rapor kaynak kodu, yerel sunucu, Chromium taraması, HTTP kontrolleri, statik referans taraması, SQL incelemesi ve mevcut test suite'i birlikte kullanılarak hazırlanmıştır. Canlı Supabase rol grant'leri, deploy edilmiş Edge Function sürümleri ve gerçek ödeme sağlayıcısı hesabı bu sandbox'tan doğrulanamadı; ilgili maddeler bu sınırlamayla işaretlenmiştir.

## Yönetici özeti

Depo **derleniyor, lint ve mevcut regresyon testleri geçiyor**; ancak bu testler yayın/iş güvenliği açısından kritik bazı sözleşmeleri kapsamıyor. En önemli riskler:

1. **Yüksek:** `fan` moderatör tokenı kanon statüsünü değiştirebiliyor.
2. **Yüksek:** Sınırlı yönetici, yarış soru/cevap bankası ve liderlik ayarlarını değiştirebiliyor.
3. **Yüksek:** `yaris_bitir` doğru cevapları istemciye döndürüyor.
4. **Yüksek:** Moderasyon Edge Function'ı JWT/rol doğrulamadan her isteğe `onaylandi: true` dönüyor.
5. **Yüksek:** Service Worker CSS sürüm anahtarı HTML ile farklı; ayrıca ilk açılışta yüklenen 7 JS dosyası precache dışında.
6. **Yüksek:** Ödeme akışında eski `99 TL`/plansız akış ile yeni `249 TL`/plan tipli akış aynı anda bulunuyor.
7. **Yüksek:** Ödeme öncesi gösterilen KVKK, iade ve mesafeli satış metinleri veri dosyasında yok; kullanıcıya “Bu metin henüz eklenmedi.” gösteriliyor.
8. **Yüksek:** `robots.txt` gerçek XML olmayan bir `sitemap.xml` adresi bildiriyor.
9. **Yüksek:** Querystring'siz JS dosyaları bir yıl `immutable` cache'leniyor.
10. **Orta:** Ödeme webhook'u imza/idempotency doğrulamadan her gövdeye 200 dönüyor.
11. **Orta:** Offline queue API'si var fakat üretim transport implementasyonu bulunamadı; yazmalar online olduğunda gönderilmeyebilir.
12. **Orta:** APK'nın gerçek imza fingerprint'i `.well-known/assetlinks.json` ile uyuşmuyor; Android App Links doğrulaması bu nedenle başarısız olabilir.

**Kritik seviyede (hemen veri kaybı/uzaktan kod çalıştırma) doğrulanmış bulgu yok; yüksek seviyedeki yetki, içerik sızıntısı, ödeme ve offline yayınlama sorunları release öncesi kapatılmalıdır.**

---

## Önceliklendirilmiş bulgular

### H-01 — Yüksek — Sınırlı yönetici yarış içeriğini değiştirebiliyor

- **Kanıt:** `supabase/kurulum.sql:111-114, 616-650, 980-983`; sınırlı yönetici üretimi `2337-2340`.
- `yaris_icerik_yukle()` yalnızca `yonetici_mi()` çağırıyor.
- `yonetici_mi()` yöneticiler tablosunda satır bulunmasını yeterli sayıyor; `duzey='sinirli'` ayrımı yapmıyor.
- Fonksiyon yarış soru bankasını, cevapları, liderlik ayarlarını ve oylanabilir içerikleri yazabiliyor; `authenticated` role'e execute grant'i var.

**Etki:** Sınırlı yönetici, tam yöneticiye ayrılmış içerik ve skor bütünlüğü işlemlerini manipüle edebilir.

**Düzeltme:** `tam_yonetici_mi()` veya açık yetki matrisi (`icerik_yaz`, `liderlik_ayar_yaz`) kullanın; her kritik RPC için negatif rol testleri ekleyin.

### H-02 — Yüksek — Fan moderatör kanon statüsünü değiştirebiliyor

- **Kanıt:** `supabase/kurulum.sql:2996-3002, 3079-3092`.
- `moderator_dogrula()` oturumun aktif olduğunu kontrol ediyor fakat `moderator_kodlari.duzey` değerini kontrol etmiyor.
- `yayin_kanon()` yalnızca `moderator_dogrula(p_token)` veya tam yönetici kontrolü yapıyor ve `anon, authenticated` için açık.

**Etki:** Fan düzeyi tokenla `kanon=true` yapılabilir; ilan edilen moderatör rol ayrımı bozulur.

**Düzeltme:** Token doğrulama fonksiyonu düzeyi döndürmeli; `p_kanon=true` yalnızca `kanon` düzeyi veya tam yöneticiye izin vermeli.

### H-03 — Yüksek — Yarış bitiş yanıtı doğru cevapları sızdırıyor

- **Kanıt:** `supabase/kurulum.sql:741-775, 788-798`.
- `yaris_bitir()` içinde `jsonb_build_object('dogru', ok, 'cevap', b.cevap, ...)` oluşturuluyor ve `sonuclar` istemciye dönüyor.

**Etki:** Kullanıcılar tekrar tekrar yarış bitirerek soru/cevap bankasını çıkarabilir; yarış bütünlüğü bozulur.

**Düzeltme:** `cevap` alanını RPC dönüşünden tamamen kaldırın. Cevap açıklaması gerekiyorsa ayrı, oran sınırlı ve yetkili sonuç endpoint'i kullanın.

### H-04 — Yüksek — Moderasyon Edge Function fail-open ve kimlik doğrulamasız

- **Kanıt:** `supabase/functions/moderasyon/index.ts:2-15`.
- Authorization/JWT, rol, method ve içerik doğrulaması yok.
- Her JSON isteğinde `{ durum:'ok', onaylandi:true }` dönüyor; CORS `*`.

**Etki:** Endpoint'i çağıran herkes sahte “onaylandı” sonucu alabilir. Dosyada kalıcı DB yazımı görülmediği için canlıda kalıcı etki ayrıca doğrulanamadı; yine de güvenlik kararı güvenilir değildir.

**Düzeltme:** JWT + server-side rol doğrulaması, içerik allowlist'i ve gerçek DB işlemi ekleyin. Gerçek moderasyon yoksa `not_implemented` dönün; `true` dönmeyin.

### H-05 — Yüksek — Ödeme akışları plan/fiyat açısından ikiye bölünmüş

- **Kanıt:** `js/core/odeme.js:1`; `js/engine/91-v473-uyelik.js:87,114`; eski çağrılar `js/engine/89-v47-ic-evren.js:78`, `js/engine/90-v472-ic-sinir.js:75`, `js/oyun/64-seviye-kapilari.js:1`.
- Eski modal `TF4_PRO_FIYAT="99 TL / ay"` gösteriyor ve `odeme-baslat` çağrısını `{}` ile yapıyor.
- Yeni üyelik akışı EvrenYazar için `249 TL / ay` gösteriyor ve `tip` gönderiyor.

**Etki:** Kullanıcı giriş noktasına göre farklı ürün/fiyat görebilir; plansız eski istekte sunucu hangi ürünün satılacağını belirleyemez.

**Düzeltme:** Tek ödeme modalı ve tek server-side fiyat kataloğu kullanın. Eski `proPencereAc` çağrılarını kaldırın/adapter'a yönlendirin; `tip` zorunlu doğrulansın.

### H-06 — Yüksek — Hukuki metinler eksik olmasına rağmen ödeme ekranında bağlantılanıyor

- **Kanıt:** `js/core/odeme.js:1`; `yasalSayfaCiz()`; `veri.json` üst düzey anahtarlarında `yasal` yok.
- UI `#/yasal/mesafeli`, `#/yasal/iade`, `#/yasal/kvkk` bağlantıları üretiyor.
- `yasalSayfaCiz()` `(veri.yasal||{})[a]` okuyor; alan yok olduğundan gerçek tarayıcı ekranında **“Bu metin henüz eklenmedi.”** görülüyor.

**Etki:** Ödeme öncesi kullanıcıya sunulması gereken hukuki metinler fiilen boş; hukuki uyum ve kullanıcı bilgilendirmesi riski.

**Düzeltme:** Metinler yayınlanana kadar ödeme akışını açmayın veya `veri.yasal`ı zorunlu CI şeması yapın; metin sürüm/tarih bilgisini gösterin.

### H-07 — Yüksek — Service Worker CSS cache anahtarı HTML ile farklı

- **Kanıt:** `index.html:45,47` → `css/style.css?v=be2f302c44ec`; `sw.js:5` → `css/style.css?v=cc93b781040e`.
- `sw.js:173-175` sürümlü isteklerde tam cache key eşleşmesi kullanıyor.

**Etki:** Offline/yavaş ağda CSS bulunamayabilir veya eski CSS kullanılabilir; `immutable` politikası nedeniyle hata uzun süre kalabilir.

**Düzeltme:** HTML ve SW listesini aynı build manifestinden üretin; release testinde tüm `src/href` ve precache URL'lerini birebir karşılaştırın.

### H-08 — Yüksek — İlk HTML'in yüklediği 7 JS dosyası precache dışında

- **Kanıt:** `index.html:849-859`, `sw.js:5`.
- Precache'te olmayanlar: `js/core/93-offline-queue.js`, `94-cakisma.js`, `engine/91-v473-uyelik.js`, `core/54-v54-olgunlastirma.js`, `core/100-v60-native.js`, `core/110-v62-platform.js`, `engine/101-v61-universe.js`.

**Etki:** Cache'ten gelen HTML offline açıldığında üyelik, native, platform, çakışma, offline queue ve evren işlevleri eksilebilir.

**Düzeltme:** Tüm ilk HTML scriptlerini precache'e ekleyin veya tüm kodu paketleyip yalnızca hash'li paketleri yükleyin. Gerçek `offline reload` smoke testini CI'a ekleyin.

### H-09 — Yüksek — Sitemap bağlantısı var fakat gerçek sitemap yok

- **Kanıt:** `robots.txt:3`; repoda `sitemap.xml` yok. Canlı `/sitemap.xml` yanıtı HTTP 200 olsa da `Content-Type: text/html` ve SPA `<!DOCTYPE html>` döndürüyor.

**Etki:** Arama motorları geçersiz sitemap ile karşılaşır; 200 yanıtı sorunu gizler.

**Düzeltme:** Gerçek XML sitemap üretip `application/xml` ile yayınlayın veya robots satırını kaldırın.

### H-10 — Yüksek — Sürümsüz JS dosyaları bir yıl immutable cache'leniyor

- **Kanıt:** `_headers:35-36`; `index.html:849-851`.
- `/js/*` için `max-age=31536000, immutable`; `93-offline-queue.js`, `94-cakisma.js`, `34b-model-evreni.js` querystring olmadan yükleniyor.

**Etki:** Aynı URL'deki düzeltme proxy/tarayıcıda bir yıl görünmeyebilir.

**Düzeltme:** Tüm asset URL'lerine build hash'i ekleyin veya sürümsüz dosyalara `max-age=0, must-revalidate` istisnası koyun.

### H-11 — Yüksek — Public path rotaları route'a özgü SEO HTML'i sunmuyor

- **Kanıt:** `index.html:13-14,52-53`; `js/core/00-rota.js:1`.
- `/tomye/`, `/sen/`, `/evren/e25/`, `/yasal/kvkk/` aynı root SPA shell'ini, sabit title/description/canonical (`https://tentifor.com/`) alıyor.

**Etki:** Public rotalar benzersiz içerikle indekslenemez; JS'siz crawler için içerik güvenilir değildir.

**Düzeltme:** Public rotalar için prerender/SSR/edge head injection; kişisel rotalar için `noindex`; sitemap'e yalnızca gerçek public path'leri ekleyin.

### H-12 — Yüksek — APK App Links fingerprint'i assetlinks ile uyuşmuyor

- **Kanıt:** APK içindeki `META-INF/CERT.RSA` sertifikasının SHA-256 fingerprint'i: `68:62:F4:DE:23:17:52:3E:C0:48:ED:EB:41:67:8B:22:D9:48:96:5A:67:35:74:19:5C:1F:FB:32:3F:FC:5C:29`. `.well-known/assetlinks.json` ise `D5:A7:CD:E4:CB:E9:6A:AF:1F:D4:05:F8:34:47:B2:3A:39:B9:34:EA:76:11:E4:79:4F:98:A9:DF:C2:44:CD:F9` bildiriyor.
- Android manifest'te HTTPS intent-filter var fakat `autoVerify` görülmedi.

**Etki:** Yayınlanan APK ile domain association doğrulanmayabilir; linkler uygulama yerine tarayıcıda açılabilir.

**Düzeltme:** Release keystore sertifikasının fingerprint'ini assetlinks'e koyun; debug/release association'larını ayrı yönetin; manifest için `android:autoVerify="true"` ve gerçek cihaz doğrulaması ekleyin.

---

## Orta önem bulguları

### M-01 — Webhook her gövdeye başarı dönüyor

- **Kanıt:** `supabase/functions/odeme-webhook/index.ts:2-5`.
- İmza, merchant/order, tutar, durum ve idempotency kontrolü yok; her method/body `200 {durum:'ok'}`.
- Mevcut dosyada DB yazımı görülmediğinden doğrudan abonelik yükseltmesi kanıtlanmadı.

**Düzeltme:** Ham body imzası, merchant/order/tutar/para birimi ve unique idempotent upsert doğrulaması olmadan başarı dönmeyin.

### M-02 — Ödeme başlatma endpoint'i auth/plan/fiyat doğrulamıyor

- **Kanıt:** `supabase/functions/odeme-baslat/index.ts:2-8`; `js/engine/91-v473-uyelik.js` çağrısı.
- Her istek `durum: ok, odemeUrl: null` dönüyor; Authorization, HTTP method, kullanıcı ve plan kontrolü yok.

**Düzeltme:** JWT'den kullanıcıyı alın; fiyatı istemciden kabul etmeyin; provider session gerçekten oluşmadan `ok` dönmeyin.

### M-03 — Profil kişisel alanları anonim select ile açık

- **Kanıt:** `supabase/kurulum.sql:5-35`; `js/core/28-hesap.js:1`.
- `profiller` select policy `using (true)`; `hakkinda`, `gorsel`, `tentifor_adi`, `ozet`, `vitrin` alanları doğrudan sorgulanıyor.

**Düzeltme:** Public profile view ve opt-in görünürlük kullanın; private sütunları doğrudan tablo select'inden kaldırın.

### M-04 — Sunucu üretimi olduğu belirtilen profil özeti kullanıcı UPDATE'i ile değiştirilebilir

- **Kanıt:** `supabase/kurulum.sql` profil UPDATE policy ve `ozet` kolonu tanımları; detay backend raporundadır.

**Düzeltme:** Kullanıcının güncelleyebileceği sütunları RPC/view ile allowlist edin; `ozet` için trigger veya server-only role kullanın.

### M-05 — Moderatör rate limit'i global sayaç

- **Kanıt:** `supabase/kurulum.sql:2974-2994`.
- IP/kod/hesap bazlı değil; anonim istekler global 30 denemelik kilidi doldurabilir.

**Düzeltme:** IP + kod özetine göre dağıtık rate limit, artan bekleme ve güvenli lockout uygulayın.

### M-06 — Aynı imzalı fonksiyonlar farklı SQL/migration dosyalarında yeniden tanımlanıyor

- **Kanıt:** `supabase/kurulum.sql`, `20261002_hediye_abonelik_migration.sql`, `20261002_hediye_rpc_validation.sql` — `abonelik_hediye` ve `mod_karar` tanımları.

**Etki:** Uygulama sırası etkin davranışı değiştirir; rollback ve yeni ortam kurulumu sürpriz üretebilir.

**Düzeltme:** Tek canonical migration, açık versiyonlama ve her migration için temiz DB replay testi.

### M-07 — Offline queue için production transport bulunamadı

- **Kanıt:** `js/core/93-offline-queue.js:49-52` yalnızca `window.tf4OfflineTransport` varsa gönderiyor; repo taramasında bu değişkeni tanımlayan üretim kodu bulunmadı.

**Etki:** Kuyruğa eklenen yazılar online olayında gönderilmeyebilir; kullanıcı arayüzü başarılı sanabilir.

**Düzeltme:** Supabase/GitHub yazma noktalarına atomik queue + gerçek transport bağlayın; transport yoksa kuyruğu üretimde aktif etmeyin ve kullanıcıya durum gösterin.

### M-08 — Üyelik önbelleği 6 saate kadar bayat kalabilir

- **Kanıt:** `js/paket-4.js` içindeki `tf4AbonelikYukle`; `tf4_uyelik` localStorage kaydı.
- Normal akış cache'i zorlamadan çağırılabiliyor; ödeme/hediye sonrası eski plan 6 saate kadar gösterilebilir.

**Düzeltme:** Ödeme/hediye dönüşünde cache invalidation ve üyelik ekranı açılışında zorunlu RPC refresh.

### M-09 — Arama input'u accessible name olmadan geliyor

- **Kanıt:** `index.html:105-109`; label/aria-label yok, placeholder tek başına kullanılıyor.

**Düzeltme:** Görsel gizli label veya `aria-label="Arşivde ara"`; sonuç kutusu için `aria-controls`/klavye ilişkisi.

### M-10 — Modal ortak host'unda focus trap/inert yok

- **Kanıt:** `index.html:840`; dinamik dialog şablonları `js/oyun/64-seviye-kapilari.js`, `js/engine/92-v51-dashboard.js`.

**Düzeltme:** Tek modal yöneticisi, `inert`, focus trap, Escape ve kapanınca önceki elemana focus.

### M-11 — `uclu` temada metin kontrastı yetersiz

- **Kanıt:** `css/style.css:1`: `#C8102E` metin / `#080808` zemin yaklaşık 3.40:1; normal text için WCAG AA 4.5:1.

**Düzeltme:** Daha açık metin rengi veya kırmızıyı yalnızca büyük metin/ikon için sınırlama; tüm temalara otomatik kontrast testi.

### M-12 — README “tam offline” iddiası teknik sözleşmeyle uyuşmuyor

- **Kanıt:** `README.md:12`, H-07/H-08.

**Düzeltme:** Offline sözleşmesini düzeltin veya README iddiasını çekirdek kabukla sınırlayın.

### M-13 — README'de olmayan roadmap dosyasına link var

- **Kanıt:** `README.md:17` → `ROADMAP-6.0-APK.md`; dosya repoda yok.

**Düzeltme:** Dosyayı ekleyin veya doğru mevcut dosyaya link verin; relative Markdown link checker ekleyin.

### M-14 — `veri.json` parça metadata sayısı yanlış

- **Kanıt:** `veri.json`: `__parcalar.degisiklik.toplam = 61`; `veri-degisiklik.json` gerçek kayıt sayısı **68**.

**Etki:** Yönetici/veri parçası tamlık göstergeleri yanlış olabilir; metadata'ya güvenen kontrol/arayüz yanlış rapor üretir.

**Düzeltme:** Paketleme sırasında parça kayıt sayısını otomatik hesaplayıp güncelleyin; `toplam === JSON.length` CI assertion ekleyin.

### M-15 — Bilgi taşıyan kapak/görseller `alt=""` ile gizleniyor

- **Kanıt:** `js/paket-3.js:192`, `js/arsiv/07-kisilik-ag-galeri.js`, `js/core/24-arsiv-mantigi.js`.

**Düzeltme:** Kapak bilgi taşıyorsa başlık/açıklama alt metni; dekoratifse `aria-hidden` ile açık işaretleme.

### M-16 — Font weight tanımı gerçek dosya ile uyuşmuyor

- **Kanıt:** `css/style.css:1`, `index.html:44`; 600/700 tanımları `normal-400` WOFF2'ye işaret ediyor.

**Düzeltme:** Gerçek weight dosyaları ekleyin veya deklarasyonları 400'e indirin; sentetik bold davranışını bilinçli belirleyin.

---

## Düşük önem bulguları

- `supabase/functions/*` içindeki kimlik doğrulamalı endpoint'lerde CORS `*` kullanımı (`rapor-backend.md`, B-11).
- İki `SECURITY DEFINER` sayaç fonksiyonunda `search_path = public`; mümkünse `search_path = ''` + tam nitelikli isimler kullanın (B-12).
- `sistem-kod-denetim-raporu-2026-10-02.md` güncel kaynakla uyuşmayan eski hash ve Service Worker örnekleri içeriyor; tarihsel snapshot olarak etiketlenmeli.
- Font ağırlığı ve erişilebilirlik bulguları işlevsel çökme değil, kalite/release riski niteliğindedir.

---

## Gerçek test sonuçları

### Başarılı kontroller

- `npm run lint` → **başarılı**, 136 JS dosyası; 2 adet `no-empty` uyarısı:
  - `js/engine/89-v47-ic-evren.js:331`
  - `js/engine/90-v472-ic-sinir.js:181`
- `npm test` → **başarılı**.
- Mevcut testler: dashboard, membership, regressions, vitrin, badges, gifting, layout/notifications, store, offline queue, conflict, shared universe, Android native, 6.1 universe, mobile menu, 6.2 platform.
- Chromium ile 85 rota/hash senaryosu gezildi; sayfa çökmesi tespit edilmedi.
- 404 senaryosu `#/olmayan-rota-xyz` için çalışıyor.
- Yerel asset, manifest ikonları, CSS `url()` referansları ve duplicate HTML id taraması temiz.
- APK SHA-256 metadata ile gerçek APK arasında eşleşiyor; sorun APK bütünlük hash'inde değil, App Links sertifika fingerprint'inde.

### Testlerin yakalayamadığı açıklar

- Mevcut suite Service Worker precache listesini HTML script listesiyle tam karşılaştırmıyor.
- Payment/Edge Function fail-open davranışı ve legal data schema için negatif test yok.
- RLS rol seviyesi (`sinirli` vs tam), moderatör düzeyi ve yarış cevaplarının RPC dönüşü için güvenlik regresyonu yok.
- Gerçek offline reload smoke testi CSS/7 eksik JS sorunlarını yakalayacak şekilde release CI'a bağlı değil.
- Public path SEO/canonical/sitemap içerik testi yok.

---

## Önerilen düzeltme sırası

### P0 — Release'i durdur

1. `yayin_kanon`, `yaris_icerik_yukle`, `yaris_bitir`, `moderasyon` yetki/cevap sızıntılarını düzeltin.
2. Ödeme akışını tekleştirin; `tip` ve fiyat server-side doğrulansın.
3. Hukuki metinleri eklemeden ödeme onayını yayınlamayın.
4. APK release sertifikası ile assetlinks fingerprint'ini eşleştirin.

### P1 — Yayınlama/PWA

5. HTML/SW asset manifestini tek kaynaktan üretin; CSS hash ve 7 JS precache farkını giderin.
6. Sürümsüz JS dosyalarını hash'leyin veya cache politikasını düzeltin.
7. Gerçek `sitemap.xml` yayınlayın; public path'ler için prerender/SEO head üretin.
8. Offline reload + network blocked CI testi ekleyin.

### P2 — Kalite ve sürdürülebilirlik

9. Offline queue transport'u gerçek yazma noktalarına bağlayın.
10. Üyelik cache invalidation, `veri` şeması ve parça metadata assertion'larını ekleyin.
11. Arama label'ı, modal focus trap/inert ve tema kontrastlarını düzeltin.
12. README/roadmap ve tarihsel rapor linklerini güncelleyin.

---

## İnceleme çıktıları

- Backend ayrıntıları: `rapor-backend.md`
- Frontend/PWA/SEO ayrıntıları: `rapor-frontend.md`
- Bu birleştirilmiş rapor: `INCELEME-SORUN-RAPORU-2026-10-03.md`
