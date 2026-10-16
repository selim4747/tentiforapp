# TentiforApp 5.2 → 5.3 inceleme raporu

**İnceleme tarihi:** 2026-10-01  
**Depo:** `selim4747/tentiforapp`  
**İncelenen dal/commit:** `main` / `6d813ead7db0b5c5f35ef3c0048f4e1189a2643e`  
**Uzak dal ile durum:** Eşit; kaynak ağacı inceleme sonunda temiz bırakıldı. Bu rapor ayrıca yeni dosya olarak oluşturuldu.

## 1. Mevcut durum özeti

TentiforApp, statik/PWA ağırlıklı bir uygulama; Node `server.js` yerel servis sağlıyor, Supabase SQL şeması hesap/üyelik/topluluk özelliklerini taşıyor, Capacitor kabuğu ise Android APK varlıklarını içeriyor. Depo içeriğinde 5.2 üyelik ve ortak evren akışı, çevrimdışı okuma, bildirimler, fan evrenleri, moderasyon ve cihazdaki sürüm geçmişi bulunuyor.

**Güçlü taraflar**

- Çevrimdışı açılış ve yavaş ağ davranışı için gerçek bir service worker fallback stratejisi var.
- 5.2 ortak kullanım/üyelik sınırları hem istemci tarafında hem de Supabase fonksiyonlarında düşünülmüş.
- XSS açısından kullanıcı içeriğinin önemli bölümleri `kacir`/kaçış yardımcılarıyla HTML’e alınıyor.
- Depoda `security definer` fonksiyonlarının çoğu `search_path = ''` ile sınırlandırılmış ve tabloların önemli bölümü RLS ile korunuyor.
- APK/www kopyası üretim betiğiyle senkronize ediliyor; mevcut kaynak kopyaları incelemede birbirinden sapmamış.

## 2. Çalıştırılan kontroller

| Kontrol | Sonuç | Not |
|---|---:|---|
| `npm install --no-audit --no-fund` | Geçti | Node `22.13.0` üzerinde jsdom için engine uyarısı var; bağımlılık kuruluyor. |
| `npm run build` | Geçti | `dist` ve APK/www varlıkları üretildi. |
| `npm run lint` | Geçti | Ancak yalnızca `console.log("Lint passed")`; gerçek lint yapmıyor. |
| `tests/calistir.mjs` | Geçti | Zorunlu dosyalar ve `veri.json` kontrolü. |
| `tests/5.1-dashboard.mjs` | Geçti | 5.1 dashboard assertion’ları. |
| `tests/5.2-membership.mjs` | **Başarısız** | Güncel üyelik metni ile testte aranan eski metin uyuşmuyor. |
| `tests/offline-yavas.mjs` | Geçti | Service worker ve timeout regression’ları. |
| `tests/kullanici-simulasyonu.mjs` | Kısmi | Akışlar geçti; runtime’da `bag çizilemedi` hatası raporlandı. Test bunu başarısız saymıyor. |
| `node --check` (JS/server/SW) | Geçti | Sözdizimi hatası yok. |
| JSON parse kontrolleri | Geçti | `veri.json`, manifest, metadata, sürüm dosyaları geçerli JSON. |
| `npm audit --omit=dev --audit-level=moderate` | Geçti | 0 production vulnerability. |
| Yerel HTTP smoke test | Geçti | `/`, `/api/pano`, header’lar ve SPA fallback yanıt verdi. |

## 3. Bulgular ve önerilen aksiyonlar

### P1 — 5.2 regression testi kırık

`tests/5.2-membership.mjs`, `Sınırsız kişiyle yerel takım paketi` metnini arıyor. Güncel kaynak ise `js/engine/91-v473-uyelik.js` içinde `Sınırsız evren, Evrengezer, fan hikâyesi ve yerel takım paketi üyesi...` metnini kullanıyor. Yani görünen ürün metni değişmiş, test güncellenmemiş.

**Etkisi:** CI/manuel release kontrolü yeşil görünmüyor; 5.2’nin gerçekten doğrulandığına güven azalıyor.

**5.3 aksiyonu:** Testi görünen cümleye değil `window.tf4UyelikPolitikasi`, plan limitleri ve `tf4TakimKotaAcik` gibi davranış sözleşmelerine bağla. Metin assertion’ları yalnızca kopya/mikro metin testi olarak ayrı tutulmalı.

### P1 — Runtime hatası testte yutuluyor

`tests/kullanici-simulasyonu.mjs` `bag çizilemedi` hatasını yakalıyor ancak yalnızca `console.warn` yazıp sonunda `process.exit(0)` ile başarılı bitiyor. Hata `js/engine/` içindeki ilişki/bağ çizimi ya da harita SVG akışında oluşuyor; mevcut JSDOM ortamı canvas/SVG/Image API’lerini tam desteklemediği için gerçek tarayıcı hatası ile test altyapısı sınırlaması ayrıştırılmalı.

**5.3 aksiyonu:**

1. Hatayı `expected environment limitation` olarak açıkça sınıflandır veya gerçek tarayıcı testiyle yeniden üret.
2. Kritik runtime hatası varsa test exit code’unu 1 yap.
3. Harita/bağ çizimi için boş veri, bozuk veri, canvas yokluğu ve SVG üretimi için ayrı unit testleri ekle.

### P1 — `lint` gerçekte lint yapmıyor

`package.json` içindeki lint script’i sabit başarı mesajı basıyor. 3.4 MB civarı frontend kodunda bu, syntax dışında kalite kontrolü olmadığı anlamına geliyor.

**5.3 aksiyonu:** En azından ESLint veya Biome ekle; mevcut tek satırlık/minified dosya düzenini bozmadan önce kapsamı `js/**/*.js`, `server.js`, `scripts/**/*.mjs`, `tests/**/*.mjs` olarak başlat. İlk aşamada `no-undef`, `no-unreachable`, `no-unused-vars` ve async promise kuralları seçilebilir. Ayrıca `npm test` komutu tanımlanmalı.

### P1 — Build hash’i içerik tabanlı değil

`scripts/paketle.mjs`, `veri.json` içeriğine ek olarak `Date.now()` hash’liyor. Aynı kaynakla her build’de yeni paket hash’i ve service worker cache adı oluşuyor; bu da gereksiz cache invalidation, gereksiz güncelleme bildirimi ve sürekli çalışma ağacı değişikliği üretiyor.

**5.3 aksiyonu:** Hash’i release girdilerinin içeriklerinden deterministik üret. `kuruldu` tarihi gerekiyorsa hash’e dahil etme; release metadata’sını ayrı üret. Aynı girdilerle iki build’in aynı paket adını vermesini test et.

### P1 — Sürüm kaynakları 5.2 ile tutarsız

Aşağıdaki dosyalar farklı sürüm bilgileri taşıyor:

- `package.json`: `5.2.0`
- `veri.json` / `surum.json`: `5.2.0`
- `README.md`: `v4.7.4`
- `manifest.webmanifest`: `5.0.1`
- `uygulama/kabuk/package.json`: `5.0.1`
- `js/core/46-guncelleme.js` içinde eski fallback sürüm değeri: `4.7.4`

**Etkisi:** PWA kurulum ekranı, APK metadata’sı, hata kayıtları ve dokümantasyon farklı sürüm gösterebilir.

**5.3 aksiyonu:** Tek bir sürüm kaynağı kullan; build sırasında README/manifest/Capacitor metadata/fallback değerlerini oradan üret. CI’da tüm sürüm alanlarının aynı semver’e eşit olduğunu doğrula.

### P2 — Üretim paketi eski dosyaları temizlemiyor

`paketle.mjs`, `dist` ve `uygulama/kabuk/www` içine kaynakları kopyalıyor fakat hedefi önce temizlemiyor. Kaynakta silinen veya yeniden adlandırılan bir dosya eski üretim çıktısında kalabilir.

**5.3 aksiyonu:** Kopyalama öncesi güvenli hedef dizinlerini temizle veya manifest tabanlı silme yap. Sonrasında beklenen dosya listesi ve orphan dosya testi ekle.

### P2 — Duplicated source of truth release riskini artırıyor

Ana `js`, `index.html`, `sw.js` ve `uygulama/kabuk/www` kopyaları build ile senkronize ediliyor. Bu yaklaşım çalışıyor ancak manuel değişiklikte drift riski yüksek.

**5.3 aksiyonu:** `www` yalnızca build çıktısı olarak üretilsin ve mümkünse Git’te tutulmasın; APK build pipeline’ı `dist`/kaynak çıktısından beslensin. Tutulmaya devam edecekse CI’da tam ağaç karşılaştırması zorunlu olsun.

### P2 — Node sürümü ile jsdom engine aralığı uyuşmuyor

Kurulum Node `22.13.0` ile çalıştı ancak `jsdom@30.1.1` ve alt paketleri `22.14.0`/`22.22.2` ve üzeri aralıklar istiyor. Şu an testler geçse de reproducibility riski var.

**5.3 aksiyonu:** `.nvmrc` veya `engines` ile desteklenen Node sürümünü sabitle; tercihen CI ve lokal ortamı Node `22.22.2+` ile eşleştir veya jsdom sürümünü mevcut runtime’a uygun sabitle.

### P2 — Yerel Node sunucusunda güvenlik başlıkları eksik

Cloudflare `_headers` dosyasında `Referrer-Policy` ve `Permissions-Policy` var; fakat `server.js` yalnızca `nosniff` ve `X-Frame-Options` koyuyor. Ayrıca statik sunucuda `Access-Control-Allow-Origin: *` ve POST yöntemi geniş tanımlı.

**5.3 aksiyonu:** Yerel sunucuyu production benzeri hale getir: `Content-Security-Policy` (inline script/style istisnaları tasarlanarak), `Referrer-Policy`, `Permissions-Policy`, gerekirse HSTS’i yalnızca HTTPS ortamında ekle. CORS’u ihtiyaç olan endpoint’lerle sınırla; kullanılmayan POST’u reddet.

### P2 — Service worker precache listesi manuel ve eksik kalmaya açık

`sw.js` içindeki `ILK` listesi elle tutuluyor. Yeni bir 5.3 modülü eklenip listeye alınmazsa ilk offline açılışta davranış değişebilir.

**5.3 aksiyonu:** Build sırasında kullanılan kritik dosya manifestini üretip `sw.js` içine yaz. Testte index’in yüklediği sürümlü bütün kritik asset’lerin precache/runtime cache stratejisinde bulunduğunu doğrula.

## 4. 5.3 ürün önerileri

Önceliği yeni özellik sayısından çok **güvenilirlik + ortak üretim deneyimi** üzerine kurmak daha doğru görünüyor.

### 5.3 çekirdek paketi

1. **Üyelik/ortak evren güvenilirliği:** Plan limitlerini tek bir davranış sözleşmesine taşı; istemci, Supabase RPC ve testler aynı limit tablolarından türesin.
2. **Çakışma çözüm ekranı:** Mevcut “son kaydeden kazanır, önceki sürüm geçmişine düşer” davranışına ek olarak alan bazlı fark görünümü ve “benim/uzaktaki” seçimleri ekle.
3. **Sürüm ve güncelleme güvenilirliği:** Deterministik asset hash, tek sürüm kaynağı, SW manifest üretimi ve atomik cache geçişi.
4. **Offline queue:** Offline yapılan skor, okuma ilerlemesi, bildirim/ayar ve ortak evren değişikliklerini kuyruklayıp bağlantı gelince retry/backoff ve conflict görünümüyle eşitle.
5. **Arama/keşif:** 50 evren + fan içerikleri için arama sonucu tipi, etiket, yazar, güncelleme zamanı ve indirilebilir/offline filtreleri.
6. **Erişilebilir okuma modu:** Roman ve uzun metinler için yazı boyutu, satır aralığı, genişlik, tema, kaldığın yer ve ekran okuyucu etiketlerini tek “Okuma ayarları” panelinde birleştir.
7. **Moderasyon triage:** İçerik bildirimi için öncelik, tekrar bildirim birleştirme, hedefe göre durum ve karar geçmişi; yönetici panelinde ölçülebilir kuyruk.

### 5.3 için özellikle eklenebilecek küçük ama değerli özellikler

- Paylaşılan evrende **son değişiklik özeti**: hangi sekme/alan değişti, kim değiştirdi.
- Evren yayınlamadan önce **kalite kontrol raporu**: eksik ID, boş bölüm, kırık görsel, yetersiz oyun havuzu, erişim/plan ihlali.
- Fan evrenleri için **etiketler, spoiler seviyesi ve içerik uyarısı**.
- Okur tarafında **okuma listesi, kaldığın yer, yeni bölüm ve indirilen içerik** için tek dashboard.
- Uygulama içinde **veri dışa aktarma/içe aktarma ve sürüm geçmişi geri yükleme** için daha görünür güvenlik akışı.
- Yönetici için **deploy öncesi önizleme ve rollback** akışı.

## 5. Önerilen 5.3 teslim sırası

### Milestone A — Release hygiene

- `npm test` ekle; tüm mevcut testleri tek komutta çalıştır.
- 5.2 testini davranış tabanlı düzelt.
- Gerçek lint ekle.
- Node sürümünü sabitle.
- Tek sürüm kaynağı ve deterministik hash.
- Build sonrası kaynak/www/dist tutarlılık ve orphan testleri.

### Milestone B — Güvenilirlik

- `bag çizilemedi` hatasının gerçek tarayıcıda kök nedenini gider.
- Offline queue + retry/backoff.
- Ortak evren diff/çatışma arayüzü.
- Precache manifest üretimi.

### Milestone C — Kullanıcı değeri

- Gelişmiş keşif/arama.
- Yayın öncesi kalite denetçisi.
- Okuma modu ve okuma dashboard’u.
- Moderasyon kuyruğu ve karar geçmişi.

## 6. Sonuç

Depo 5.2 için çalışır bir temel sunuyor; production dependency audit, syntax, build ve offline regression tarafı iyi durumda. Ancak release kalitesini aşağı çeken dört konu var: **testlerin ürün metninden kırılması**, **sahte lint**, **deterministik olmayan build hash’i** ve **sürüm metadata tutarsızlığı**. 5.3’e yeni özellik eklemeden önce bu dört konu ile `bag çizilemedi` runtime probleminin kapatılması önerilir.

Bu incelemede kaynak koduna kalıcı uygulama değişikliği yapılmadı; yalnızca build’in oluşturduğu geçici dosyalar geri alındı. Kaynak dosyalarındaki git durumu temizdir; teslim edilen bu rapor dosyası yeni dosyadır.
