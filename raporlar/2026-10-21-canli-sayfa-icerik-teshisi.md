# TentiFor’da şablon/boş içerik görünmesi: teşhis ve düzeltme raporu

**Son doğrulama:** 21 Ekim 2026, 19:03 (+03:00). Yönetici hesabına giriş yapılmadı. Production’a yazılmadı, deploy tetiklenmedi.

## Kısa sonuç

Şablon/eksik içerik belirtisi tek bir sebepten değil, birbiriyle örtüşen üç doğrulanmış riskten kaynaklanıyordu:

1. **Canlı deployment geride:** Cloudflare Pages `main` için en son başarılı production deployment hâlâ `dd7b4f6c3df7a40e59bd500a1c817c96bc67e61f` (`fix: exclude universe routes that render 404`). Canlı HTML’nin JS referansları ve `sw.js` cache işareti `4cc7201b2899`; bu çalışma ağacının son build işareti `cc8030a658ac`. Önceki yerel `27fabdd2b6a3` karşılaştırması artık geçerli değil; daha yeni düzeltmelerle yerel hash değişti. Canlı hâlâ eski hash’te.
2. **Veri hazır olmadan çalışan async/render callback’leri:** Kulüp savaşı çizimi leaderboard yanıtından sonra `veri.katmanlar` kullanan profil hesabına geçebiliyor; `veri.json` henüz yüklenmediyse gerçek `TypeError` doğuruyor. Harita URL’si `popstate` handler’ı da `veri.haritalar` alanına aynı hazırlık aralığında erişebiliyordu. Bu hatalar bazı bileşenleri yarıda bırakıp sayfa açılışını eksik gösterebilir.
3. **Kritik başlangıç başarısızlığında yalnızca iskelet kalabilmesi:** SPA kabuğunda içerik başlangıçta gizleniyor. Gerekli script/bootstrap hiç çalışmaz veya çok geç kalırsa kullanıcıya görünür, yeniden denenebilir bir hata durumu yoktu. Public SEO dinamik içeriği alınamazsa da fallback’in neden kaldığı yeterince açık değildi.

Ayrıca doğrulama sırasında **build entegrasyonu kusuru** bulundu: düzenlenen `js/arsiv/09-medya-harita.js` kaynağı `npm run build` ile serve edilen `js/paket-1.js` içine kendiliğinden eşitlenmiyordu. İlk Playwright koşusu kaynak düzeltmesine rağmen eski paketlenmiş handler’ın çalıştığını kanıtladı. Paketleme script’ine kaynak/paket senkronizasyonu ve tekrar build’de tekillik kontrolü eklendi.

Bu nedenler giderilmek üzere kod ve build çıktıları PR #192 dalına hazırlandı; **production’daki kullanıcıların yeni build’i aldığı söylenemez**. Önceki açık talimat doğrultusunda deployment başlatılmadı. Canlı düzeltme PR’ın uygun şekilde birleştirilip, açık production onayı ve deploy kapısı tamamlandıktan sonra mümkün olacak.

## Production ve hash kanıtı

Cloudflare Pages projesi `tentiforapp` için production branch `main`, build komutu `node scripts/paketle.mjs`, çıktı dizini `dist`; Git bağlantısında deployment açık. Salt-okunur son kontrolünde aktif production kaydı:

- Deployment ID: `1a1d98e8-3305-4bf3-afa1-2804da9fcd60`
- Commit: `dd7b4f6c3df7a40e59bd500a1c817c96bc67e61f`
- Aşama: `deploy / success`
- Zaman: 21 Ekim 2026 11:23 UTC

Aynı kontrol, `main` dışındaki PR dalı için `preview_deployments_disabled` nedeniyle atlanmış (skip edilmiş) bir preview kaydı gösterdi; bu production güncellemesi değildir.

Canlı, kimlik doğrulamasız GET yanıtlarında:

- `https://tentifor.com/`: HTTP 200, JS query version `4cc7201b2899`, `Cache-Control: public, max-age=0, must-revalidate`.
- `https://tentifor.com/sw.js`: HTTP 200, worker işareti `4cc7201b2899`, ham gövde SHA-256 ön eki `10bda7ff17dd`, `Cache-Control: public, max-age=14400, must-revalidate`.
- Güncel yerel build: `index.html` meta ve `sw.js` cache anahtarı `cc8030a658ac`.

Dolayısıyla eski/live–yeni/local farkı sürüyor. Bu deployment drift’i kanıtlar; tek başına her kullanıcının sadece şablon görmesini kanıtlamaz. CDN/Service Worker cache’i, eski deployment’la birlikte eski dosyaların sürmesini açıklayabilir; belirli bir kullanıcının cihazındaki cache davranışı bu incelemede ölçülmedi. PR #191’deki worker update akışına ilişkin mevcut regressions geçiyor; henüz production’da yeni worker’ın aktivasyonu gözlenmedi.

## Kod kök nedenleri ve yapılan düzeltmeler

### 1. Kulüp savaşı/veri hazır olma yarışı

Leaderboard isteği `await` sonrası kullanıcı/kişilik verisini okuyor; istek yanıtlarken global `veri` hâlâ `null` olabiliyor. `js/oyun/30-yarislar.js` artık veri hazır değilken yeniden çizimi tek `tf-veri-hazir` listener’ına bırakıyor; listener tek kullanımlı. Hedef DOM elemanı kaldırılmışsa iş yapılmıyor. Liderlik isteği başarısız olursa Promise reddi uygulamayı çökertmek yerine görünür hata/tekrar dene arayüzüne ve tanılamaya dönüyor.

### 2. Harita URL hydration yarışı ve stale paket

`js/arsiv/09-medya-harita.js` içindeki `haritaURLSeciminiYukle()` `popstate` üzerinde `veri.haritalar` alanına, veri henüz null iken erişebiliyordu. Handler artık veri hazır olana kadar bekliyor ve tek bir readiness callback’i kaydediyor. `scripts/paketle.mjs` bu kaynak aralığını `js/paket-1.js` ile senkronize ediyor ve kaynak/paket sınırı tekil değilse build’i durduruyor. Regresyon testi hem null-durumunda hata olmadığını hem readiness sonrası seçim yapıldığını ve served bundle’ın korumayı içerdiğini doğruluyor.

### 3. İskeletin süresiz kalması / veri yükleme hatası

`index.html` başlangıç watchdog’u timeout sonrası yalnız render sınıfını değiştirmekle kalmıyor; erişilebilir `role=alert` mesajı ve yeniden yükleme kontrolü gösteriyor. Mesaj, timeout DOM’daki bildirim elementi parse edilmeden önce oluşsa bile saklanıyor ve `DOMContentLoaded` sonrasında gösteriliyor. `js/core/24-arsiv-mantigi.js` yükleme başarısızlığını görünür ve yeniden denenebilir hata durumuna dönüştürüyor; admin/standalone DOM’da bulunmayan karakter grid’ine güvenli erişiyor.

### 4. Dinamik SEO/public fallback’inin belirsiz kalması

`js/engine/seo-meta.js` public içerik isteği başarısız olduğunda fallback’i sessizce bırakmak yerine görünür hata ve yeniden dene seçeneği ekliyor. Test, ilgili veri/RPC hatasını kontrollü biçimde üretip kullanıcıya sunulan state’i doğruluyor.

### 5. Test kapsamı ve production kapısı

`tests/startup-readiness.mjs` gecikmeli veri/async render, tek listener, kaldırılmış DOM, ağ arızası ve erken boot timeout senaryolarını kapsıyor. SEO/admin Playwright’ta yalnızca kapsam dışı `static.cloudflareinsights.com` RUM isteği izole ediliyor; uygulama `pageerror` kayıtları stack ile tutuluyor ve boş kalması bekleniyor. PR #192’nin production workflow’u elle tetiklenir durumda kalıyor; admin ve SEO browser testleri workflow kapısına dahil. Bu görevde workflow çalıştırılmadı.

Yönetici oturumu/localStorage, yenileme, sekmeler arası giriş/çıkış ve sekmeyi kapatıp aynı profilde açma testleri de geçmiştir; bu değişikliklerde kimlik bilgisi URL’ye/loglara veya GitHub/başka ayarlara yazılmadı. Canlı yönetici hesabına giriş yapılmadı.

## Son test sonuçları

Node `22.22.2` ile son build ve kod:

- `npm run build` — **PASS**, hash `cc8030a658ac`; `sw.js`, `index.html`, native yerel kopyalar ve `dist` senkronlandı.
- `npm test` — **PASS**, tüm uygulama regresyonları; startup readiness ve update safety dahil.
- `npm run test:seo` — **PASS**, Playwright’da SEO/admin shell, route, public share ve kontrollü app-data/bootstrap hataları/retry. Gerçek `pageerror` assertion’ları açık kaldı.
- `npm run test:admin-browser` — **PASS**, cross-tab login/logout, reload, tab-reopen persistence.
- `npm run lint` — **PASS**, 223 JavaScript dosyası.
- `git diff --check` — **PASS**.

Tam `npm test` içinde Chromium testleri geçti. Firefox/WebKit altsuite’leri çalıştırılamadı (bu ortamda ilgili tarayıcı çalıştırılabilir dosyaları yüklü değil); bu iki SKIP ana Chromium SEO/admin Playwright testlerinin sonucu değildir.

## Yayınlama durumu ve kapsam sınırı

Canlı `/` ve `/sw.js` hâlâ `4cc7201b2899` sunuyor; production deployment hâlâ `dd7b4f6`. Yeni `cc8030a658ac` build **deploy edilmedi**. PR #192 açık, `fix/cloudflare-production-deploy` dalında; bu çalışma PR’a aktarılınca testler GitHub tarafında da tekrar çalıştırılmalıdır. Production’a geçiş ayrı ve açık onay gerektirir; burada verilmiş önceki “deploy etme” talimatına uyuldu.

Uygulama düzeltmelerinin production etkisi henüz gözlenmediği için, canlıdaki tüm kullanıcılar için sorunun tamamen çözüldüğü iddia edilmemelidir. Kullanıcıya özgü eklenti/ağ engeli veya mevcut Service Worker durumu da ancak ilgili cihaz/profil incelenerek kesinleştirilebilir.

## Değişen ana kaynaklar

`index.html`, `js/core/24-arsiv-mantigi.js`, `js/oyun/30-yarislar.js`, `js/arsiv/09-medya-harita.js`, `js/engine/seo-meta.js`, `scripts/paketle.mjs`, `scripts/test.mjs`, `tests/startup-readiness.mjs`, `tests/seo-playwright.mjs`, `tests/admin-playwright.mjs` ve PR #192’deki manuel production workflow’u. Build’den türeyen HTML/service-worker/bundle çıktıları da tutarlı hash’le güncellendi.
