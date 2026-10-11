# Claude ve Eterya Silme Öncesi Hata ve Risk Raporu

**Tarih:** 2026-10-11 23:00–23:03 (+03:00)  
**İncelenen dal:** `release/6.4.2.1`  
**Commit:** `0b5b4ac`  
**Kapsam:** Yerel kaynak, üretim artifact’leri, route/SEO bağlantıları, test paketi ve Supabase salt-okunur kayıt taraması.  
**Bu rapor hazırlanırken hiçbir silme veya düzeltme yapılmadı.**

## 1. Özet

| Alan | Sonuç |
|---|---|
| Genel regresyon | PASS |
| Lint / JS syntax | PASS — 192 dosya |
| Release hygiene | PASS |
| Public universe indexing testi | PASS |
| JSON bütünlüğü | PASS — kaynak JSON’larında hata yok |
| Git çalışma ağacı | Temiz |
| Claude/Eterya kaynak referansları | **Bulundu — 46 dosya** |
| Claude/Eterya üretim artifact referansları | **Bulundu — 71 dosya** |
| Claude/Eterya route dosyaları | **Hâlâ mevcut** |
| Supabase yayın/ortak evren/taslak kayıtları | Eşleşme yok |
| Supabase Eterya sayaç kayıtları | **10 kayıt bulundu** |
| Gerçek browser testleri | Çalışmadı; Playwright browser binary’leri ortamda yok |

## 2. Kritik bulgular

### C1 — Silme gerçekleşmediği için eski route ve dosyalar hâlâ erişilebilir durumda

**Önem:** Kritik  

Aşağıdaki dosyalar kaynak ağacında hâlâ mevcut:

- `claude.html`
- `claude/index.html`
- `eterya.html`
- `eterya/index.html`
- `evrenler/fornek-eterya.json`
- `ikon/og/claude.png`
- `js/arsiv/33-claude-evreni.js`
- `js/arsiv/67-claude-evreni-ii.js`

Bu dosyalar silinmediği için production build yeniden alındığında tekrar üretim paketine veya native `www` kopyasına taşınabilecek durumdadır.

### C2 — Üretim ve native artifact’lerde eski referanslar mevcut

**Önem:** Kritik  

`dist` ve `uygulama/kabuk/www` altında Claude/Eterya metni veya route referansı içeren **71 dosya** bulundu.

Mevcut `6.4.2.1` release testleri bu evrenlerin artık hiç bulunmamasını kontrol etmiyor; yalnızca genel paket bütünlüğünü kontrol ediyor. Bu nedenle mevcut testlerin PASS olması silme kapsamının tamamlandığı anlamına gelmiyor.

### C3 — Navigasyon ve içindekiler hâlâ silinecek bölümleri tanımlıyor

**Önem:** Yüksek  

`js/arayuz/18-gezinme.js` içinde şu kayıtlar hâlâ mevcut:

- `claude` / `Claude'un Evreni`
- `eterya` / `Eterya (Test)`
- `claudeEvren` bölümü
- `modelEvren` bölümü

Aynı dosyanın `IC_RAF` ve `GEC_CIZILENLER` yapılarında da bu bölümlere ait bağlantılar bulunuyor. Kaynak veri silinse bile bu menü kayıtları kaldırılmazsa boş veya hatalı sayfa bağlantıları üretilebilir.

### C4 — Gizleme katmanı silme yerine filtreleme yapıyor

**Önem:** Yüksek  

` scripts/visibility.mjs` içinde Claude/Eterya için aşağıdaki gizleme tanımları bulunuyor:

- `HIDDEN_UNIVERSE_IDS = ['claude', 'fornek-eterya']`
- `HIDDEN_UNIVERSE_ROUTES = ['claude', 'eterya']`
- Claude/Eterya dosyalarını filtreleyen `HIDDEN_UNIVERSE_FILES`
- Metin filtreleyen `HIDDEN_TEXT`
- HTML’de Claude/model evreni bölümlerini regex ile çıkaran kod

Bu mekanizma şu an içeriği yalnızca paketleme sırasında gizliyor. Kaynak dosyalar ve route’lar silinmediği için kalıcı silme yerine geçmiyor. Silme sonrasında bu özel filtrelerin yanlışlıkla ortak evrenleri veya kullanıcı üretimli içerikleri etkilemediği ayrıca doğrulanmalı.

### C5 — Sunucu route’ları 404’e yönlendiriyor, ancak route dosyaları hâlâ depoda

**Önem:** Orta/Yüksek  

`_redirects` içinde:

- `/claude* -> /404.html 404`
- `/eterya* -> /404.html 404`

`server.js` içinde de bu kaynakların yayın katmanında geçici olarak 404 olduğu belirtiliyor. Bu davranış dışarıdan gizleme sağlıyor; ancak eski HTML dosyaları depoda ve artifact’lerde kaldığı için tam silme şartı karşılanmıyor.

## 3. Kaynak kodu bağımlılıkları

### Claude’a özel modüller

- `js/arsiv/33-claude-evreni.js`
- `js/arsiv/67-claude-evreni-ii.js`

Bu modüller `veri.claudeEvreni`, `claudeEvrenCiz`, Claude’a özel oyunlar, arama ve okuma ilerlemesi üretmektedir. Modüller kaldırılırken `index.html` script yükleme sırası ve ortak `GZK`/yolculuk motoru çağrıları birlikte kontrol edilmelidir.

### Claude/Eterya’ya referans veren ortak modüller

Tarama sonucunda ortak modüllerde de referanslar bulundu. Önemli örnekler:

- `js/engine/44-evrenler.js`
- `js/engine/58-yolculuklar.js`
- `js/engine/68-coklu-evren.js`
- `js/core/42-mobil.js`
- `js/core/state.js`
- `js/arsiv/08-kesif.js`
- `js/arsiv/23-kanon-kilidi.js`
- `js/studio/40-fan-atolye.js`
- `js/studio/83-evren-atolyesi.js`
- `js/studio/84-evren-araclari.js`
- `js/admin/32-bakim.js`
- `js/admin/61-veri-denetim.js`
- `js/oyun/30-yarislar.js`
- `js/oyun/50-kelime-oyunu.js`
- `js/oyun/66-gunluk-oyunlar.js`
- `js/engine/tentifor-terminal.js`
- `js/engine/terminal.js`

Bu dosyaların tamamı Claude/Eterya’ya özel değildir. Silme sırasında yalnızca bu evrenlere ait branch, label, route ve veri erişimleri çıkarılmalı; ortak Tömye/E25/E26/E99/fan evren motoru korunmalıdır.

## 4. Veri bütünlüğü sonuçları

### Yerel `veri.json`

- JSON ayrıştırma: **PASS**
- `claudeEvreni`: mevcut; anahtarları `ad`, `harita`, `ozet`, `maddeler`, `kisiler`, `baglar`, `hikayeler`, `mektuplar`, `sozluk`, `alintilar`, `sorular`, `yankilar`, `roman`
- `haritalar` içinde `id: "claude"` kaydı mevcut
- `fanEserleri.evrenler` içinde `id: "fornek-eterya"` kaydı mevcut
- `evrenler/fornek-eterya.json` mevcut
- Diğer örnek evrenler `fornek-sis` ve `fornek-kul` ayrı ve korunabilir durumda

### Supabase salt-okunur tarama

Proje: `tentiforapp` (`wlgtjbrlquefnzavwein`)

Aşağıdaki alanlarda `claude`, `eterya` veya `fornek-eterya` eşleşmesi bulunmadı:

- `yayindaki_evrenler`
- `ortak_evrenler`
- `evren_sahipleri`
- `evren_taslaklari`
- `evren_defteri`
- `ortak_evren_davetleri`
- `evren_gorsel_alanlari`
- `evren_harita_dugumleri`
- `evren_zaman_olaylari`
- `kanon_evren_yetkileri`
- `basvurular`

### Supabase’te bulunan kayıt

`evren_sayaclari` tablosunda `ev:fornek-eterya` için **10 sayaç kaydı** bulundu:

- `sekme:yazi`
- `sekme:ag`
- `sekme:bilgi`
- `sekme:rehber`
- `sekme:oyunlar`
- `oyun:sinav`
- `ziyaret`
- `sekme:harita`
- `ziyaret` — tekrar eden ikinci kayıt
- `sekme:harita` — tekrar eden ikinci kayıt

Bu kayıtlar yayın kaydı değil, kullanım/ziyaret sayaçlarıdır; ancak kullanıcı “Supabase/public eşleşmeleri de sil” kapsamını onayladığı için kalıcı silme işleminde temizlenmelidir.

Claude için `ev:claude` sayaç eşleşmesi bulunmadı.

## 5. Test sonuçları

### Başarılı kontroller

- `npm test` — **PASS**
- `npm run lint` — **PASS**, 192 JavaScript dosyası
- `npm run test:release` — **PASS**
- `node tests/6.4.2-universe-indexing.mjs` — **PASS**
- JSON bütünlük taraması — **PASS**
- Çatışma işareti taraması — **0**
- Eski 6.4.2.0 / 6.4.1.0 referansları — **0**
- Git çalışma ağacı — **temiz**

### Çalıştırılamayan kontroller

`npm test` içindeki gerçek browser testleri aşağıdaki binary’ler ortamda bulunmadığı için SKIP oldu:

- Chromium
- Firefox
- WebKit

Bu nedenle gerçek tarayıcıda route navigasyonu, 404 davranışı, mobil menü görünürlüğü, service worker cache temizliği ve SEO sayfalarının görsel/DOM davranışı uçtan uca doğrulanmadı.

## 6. Muhtemel hata senaryoları

1. **Eski service worker cache’i:** Kullanıcının daha önce cache’lediği Claude/Eterya HTML/JS dosyaları silme sonrası tarayıcıda görünmeye devam edebilir. Cache version artırılmalı ve eski cache anahtarları temizlenmeli.
2. **Eski deep link’ler:** `/claude`, `/claude/`, `/eterya`, `/eterya/` ve eski hash route’ları 404’e düşmeli; yanlışlıkla boş uygulama sayfasına yönlenmemeli.
3. **Dinamik menü:** `GEZINME`, `IC_RAF`, mobil menü ve evren seçici silme sonrası olmayan fonksiyon adlarını çağırmamalı.
4. **Yönetici paneli:** `Y_LISTELER`, veri denetimi ve bakım ekranı `claudeEvreni.*` listelerini göstermemeli; aksi halde silinmiş veri için düzenleme formu üretilebilir.
5. **Arama ve keşif:** Silinen içeriklerin arama indeksine, son ziyaret geçmişine veya yerel koleksiyonlara tekrar eklenmemesi gerekir.
6. **SEO/sitemap:** Silinen route’lar sitemap, canonical, JSON-LD, `robots` veya statik output içinde kalmamalı.
7. **Native bundle:** `uygulama/kabuk/www` içinde eski route/JS/cache kalırsa APK offline modda silinen evrenleri göstermeye devam edebilir.
8. **Sayaçlar:** `evren_sayaclari` kayıtları temizlenmezse silinen Eterya için analitik verisi yaşamaya devam eder.
9. **Paylaşılan motor regresyonu:** Claude’a özel kod çıkarılırken `js/engine/58-yolculuklar.js` içindeki Tömye yolculukları ve genel harita motoru yanlışlıkla bozulabilir.
10. **Gizleme filtresi kalıntısı:** `visibility.mjs` içindeki özel filtreler kaldırılmaz veya yanlış düzenlenirse gelecekte aynı ada sahip kullanıcı üretimli fan evrenleri yanlışlıkla gizlenebilir.

## 7. Sonuç

Mevcut sürüm genel uygulama açısından sağlıklı görünmektedir; ancak Claude ve Eterya **silinmiş değildir**, yalnızca yayın katmanında gizlenmiştir. Tam silme için en az aşağıdaki değişiklikler gereklidir:

1. Veri kayıtlarının ve özel dosyaların kaldırılması.
2. Gezinme, mobil menü, içindekiler ve yönetici listelerindeki özel bölümlerin çıkarılması.
3. Claude’a özel JS modüllerinin script yükleme listesinden kaldırılması ve dosyalarının silinmesi.
4. Ortak modüllerdeki yalnızca Claude/Eterya branch’lerinin güvenli biçimde çıkarılması.
5. `_redirects`, `server.js`, `visibility.mjs`, sitemap/SEO ve service worker kurallarının yeni duruma göre güncellenmesi.
6. `evren_sayaclari` içindeki `ev:fornek-eterya` sayaçlarının Supabase’ten silinmesi.
7. Temiz build sonrası dist ve native bundle içinde sıfır referans doğrulaması.
8. Browser binary’leri olan bir ortamda gerçek route/mobil/cache smoke testlerinin çalıştırılması.

**Önemli:** Bu denetim turunda hiçbir dosya, route, Supabase kaydı veya artifact silinmemiştir.
