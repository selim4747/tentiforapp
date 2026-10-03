# TentiforApp — Frontend / SEO / PWA / Erişilebilirlik Denetimi

**Denetim tarihi:** 2026-10-03  
**Kapsam:** `index.html`, `manifest.webmanifest`, `sw.js`, `robots.txt`, `_headers`, `.well-known/assetlinks.json`, `css/style.css`, kök JS kaynakları, `README.md` ve rapor/roadmap Markdown dosyaları.  
**Yöntem:** Yerel dosya/DOM/JSON/CSS/JS taraması; yerel varlık ölçümleri; `node --check`; canlı `curl -L` HTTP ve içerik kontrolleri. Dış URL sonuçları yalnızca bu denetim ortamından görülebildiği kadarıyla geçerlidir.

## Yönetici özeti

Proje temel HTML yapısı, `lang="tr"`, tek H1, meta açıklama, OG görseli, manifest ikonları/ekran görüntüleri ve mutlak Service Worker kayıt URL'si açısından düzenli. Ancak yayınlanmış PWA önbellek sözleşmesinde **HTML ile SW arasında CSS hash uyuşmazlığı** ve **HTML'in yüklediği yedi JS dosyasının precache dışında kalması** var. Bu iki hata çevrimdışı açılışta CSS'siz veya eksik işlevli uygulamaya yol açabilir. En doğrudan SEO kırığı ise robots'ta bildirilen `sitemap.xml` adresinin 200 dönen HTML SPA fallback'i olmasıdır.

## Bulgular

### F-01 — Yüksek — Robots sitemap'i gerçek sitemap değil (kırık/yanlış içerik bağlantısı)

- **Dosya:satır:** `robots.txt:3`
- **Sorun:** `Sitemap: https://tentiforapp.pages.dev/sitemap.xml` bildiriliyor; repoda `sitemap.xml` yok.
- **Kanıt:** `find` ile repoda hiçbir `sitemap.xml` bulunmadı. Canlı kontrolde `curl -L https://tentiforapp.pages.dev/sitemap.xml` **HTTP 200**, `Content-Type: text/html; charset=utf-8` döndürdü; yanıtın ilk satırı `<!DOCTYPE html>` ve ana SPA HTML'i. Bu, XML sitemap değildir; 200 olması kırığı gizleyen SPA fallback davranışıdır.
- **Önerilen düzeltme:** Gerçek bir `sitemap.xml` üretip build çıktısına kopyalayın; en azından canonical public URL'leri XML formatında verin ve `Content-Type: application/xml` döndürün. Sitemap üretilemeyecekse robots satırını kaldırın.

### F-02 — Yüksek — Service Worker CSS önbellek anahtarı HTML ile uyuşmuyor

- **Dosya:satır:** `index.html:45,47`; `sw.js:5,171-175`
- **Sorun:** HTML `css/style.css?v=be2f302c44ec` yüklerken SW precache listesinde `css/style.css?v=cc93b781040e` var.
- **Kanıt:** Kaynakta iki farklı URL açıkça mevcut. SW'nin sürümlü dosya yolu için `caches.match(istek)` tam anahtar eşleşmesi kullanması (`sw.js:173`) nedeniyle HTML'in istediği `be2f...` kopyası, yalnızca SW kurulumu başarıyla tamamlandıysa `cc93...` olarak önbellekte bulunmaz. `sw.js:174` de sürümlü istek için tam eşleşmeli fallback kullanıyor. `_headers:32-36` CSS/JS URL'lerini `31536000, immutable` yapıyor; dolayısıyla yanlış anahtar uzun süre kalabilir.
- **Etkisi:** Çevrimdışı veya cache'te ağ hatası olduğunda CSS hiç gelmeyebilir; gelen CSS de HTML'deki sürümle aynı olmayabilir.
- **Önerilen düzeltme:** HTML ve `ILK` listesini tek build manifestinden üretin; SW hash'i her release'te otomatik güncelleyin. Release testinde tüm `href/src` URL'leri ile precache URL'lerini basename + query düzeyinde karşılaştırın.

### F-03 — Yüksek — HTML'in yüklediği yedi JS dosyası SW precache listesinde yok

- **Dosya:satır:** `index.html:849-859`; `sw.js:5`
- **Sorun:** İlk HTML'in çalışması için yüklediği dosyaların bir kısmı `ILK` listesinde yok.
- **Kanıt:** Programatik karşılaştırmada şu girişler `PRECACHE_MISSING` çıktı:
  - `js/core/93-offline-queue.js` (`index.html:849`)
  - `js/core/94-cakisma.js` (`index.html:850`)
  - `js/engine/91-v473-uyelik.js?v=52f73cc9f764` (`853`)
  - `js/core/54-v54-olgunlastirma.js?v=52f73cc9f764` (`856`)
  - `js/core/100-v60-native.js?v=52f73cc9f764` (`857`)
  - `js/core/110-v62-platform.js?v=52f73cc9f764` (`858`)
  - `js/engine/101-v61-universe.js?v=612` (`859`)
- **Etkisi:** SW'den cache'lenmiş `index.html` çevrimdışı açıldığında bu scriptlerin ağdan gelmesi beklenir; ağ yoksa uygulama kabuğu kısmen çalışır, bazı PWA/native/üyelik/evren işlevleri sessizce eksik kalır.
- **Önerilen düzeltme:** Tüm ilk HTML scriptlerini precache'e ekleyin veya paketleme adımında tek gerçek kaynak listesinden bundle üretin. Unversioned scriptleri de içerik hash'iyle sürümleyin.

### F-04 — Yüksek — Bir yıllık immutable JS politikası, querystring'siz script URL'leriyle çelişiyor

- **Dosya:satır:** `_headers:35-36`; `index.html:849-851`
- **Sorun:** Cloudflare bütün `/js/*` için bir yıl `immutable` cache veriyor; buna karşın üç script sürüm query'si olmadan çağrılıyor.
- **Kanıt:** `_headers:35-36`: `Cache-Control: public, max-age=31536000, immutable`. `index.html:849` `js/core/93-offline-queue.js`, `:850` `js/core/94-cakisma.js`, `:851` `js/arsiv/34b-model-evreni.js` URL'lerinde `?v=` yok. Aynı URL içerik değişse bile istemci/proxy eski kopyayı bir yıl tutabilir.
- **Önerilen düzeltme:** Bu dosyaların URL'lerini build hash'iyle sürümleyin; ya da sürümsüz dosyalar için `max-age=0, must-revalidate` istisnası tanımlayın. En güvenlisi tüm asset URL'lerini hash'lemektir.

### F-05 — Yüksek — Path tabanlı public rotalar arama motoruna benzersiz HTML sunmuyor

- **Dosya:satır:** `index.html:13-14,52-53`; `js/core/00-rota.js:1`
- **Sorun:** `/tomye/`, `/sen/`, `/evren/e25/`, `/yasal/kvkk/` gibi path'ler sunucudan ayrı sayfa yerine aynı root SPA shell'ini alıyor. Tüm yanıtların canonical/title/meta içeriği root sayfayı gösteriyor.
- **Kanıt:** Canlı `curl -L` ile `/tomye/`, `/sen/`, `/evren/e25/`, `/yasal/kvkk/` ve `/fanAc/` için **HTTP 200**, aynı `text/html` shell'i alındı; her yanıt yaklaşık 74 KB. `index.html:52-53` canonical ve `og:url` her durumda `https://tentiforapp.pages.dev/`; title da `index.html:13`'te tek sabit başlık. Route kodu istemci tarafında `location.pathname`/hash çeviriyor; sunucu tarafında route'a özel head yok.
- **Etkisi:** Public route'lar benzersiz içerik/başlık/description ile taranamaz; tüm sayfalar root URL ile kanonikleşir. JS çalıştırmayan/JS'yi gecikmeli çalıştıran crawler için route içeriği de güvenilir biçimde görünmez.
- **Önerilen düzeltme:** Public SEO rotaları için prerender/static route HTML üretin veya edge/server tarafında route'a özel title, description, canonical, OG ve JSON-LD enjekte edin. Hash-only kişisel rotaları `noindex` tutun; public path'leri sitemap'e ekleyin.

### F-06 — Orta — Manifest tema renkleri HTML ile tutarsız

- **Dosya:satır:** `manifest.webmanifest:18-19`; `index.html:7-8`
- **Sorun:** Manifest `background_color` ve `theme_color` olarak `#102A43` kullanıyor; HTML light/dark browser theme-color değerleri `#F4F9FD` ve `#0B1017`.
- **Kanıt:** Üç sabit değer kaynakta doğrudan farklı. Bu, kurulum splash/status bar renginin web sayfasının ve kullanıcının seçtiği tema renginden farklı görünmesine neden olur.
- **Önerilen düzeltme:** Tek bir tasarım token'ından üretin veya manifest renginin bilinçli sabit olduğunu dokümante edin. Gece teması için manifest tek bir `theme_color` desteklediğinden, kurulum ekranındaki kontrastı ayrıca test edin.

### F-07 — Yüksek — Arama input'u programatik etiketsiz

- **Dosya:satır:** `index.html:105-109`
- **Sorun:** Statik arama kontrolünün `<label>` veya `aria-label`'ı yok; yalnızca placeholder kullanılıyor.
- **Kanıt:** `index.html:107-108` input `id="aramaGiris"` ve placeholder içeriyor, fakat DOM'da `label` sayısı 0 ve bu input'a bağlı label yok. Placeholder ekran okuyucuda kalıcı accessible name yerine geçmez ve kullanıcı yazmaya başladığında kaybolur.
- **Önerilen düzeltme:** Görsel olarak gizlenmiş bir `<label for="aramaGiris">Arşivde ara</label>` ekleyin veya en azından `aria-label="Arşivde ara"` kullanın. Sonuç kutusunu `role="listbox"`/`aria-controls` ile ilişkilendirip klavye okuma akışını da tanımlayın.

### F-08 — Orta — Input odak göstergesi UA outline'ı kaldırılıyor

- **Dosya:satır:** `css/style.css:1` (minified; `.arama-giris:focus`, `.kod-giris:focus`)
- **Sorun:** Arama ve kod input'larında `outline:none` var; odak yalnızca 1px border color değişimine bırakılmış.
- **Kanıt:** CSS'te `.arama-giris:focus{outline:none;border-color:var(--deniz)}` ve `.kod-giris:focus{outline:none;border-color:var(--deniz)}` tanımları bulunuyor. Kullanıcı temaları `--deniz`/`--sig` değerlerini değiştiriyor; bu nedenle 1px border, tüm temalarda güvenilir ve yeterince görünür bir focus indicator değildir.
- **Önerilen düzeltme:** `:focus-visible` için en az 2-3px solid outline/box-shadow ekleyin; border değişimini yardımcı gösterge olarak bırakın. Odak stilini tüm tema değişkenleriyle kontrast testine sokun.

### F-09 — Orta — Bilgilendirici dinamik kapak/görseller boş alt ile render ediliyor

- **Dosya:satır:** `js/paket-3.js:192`; ayrıca `js/arsiv/07-kisilik-ag-galeri.js:1`, `js/core/24-arsiv-mantigi.js:1`
- **Sorun:** Fan kartı kapakları ve bazı galeri görselleri `alt=""` ile ekran okuyucudan saklanıyor.
- **Kanıt:** `js/paket-3.js:192` şablonunda `<img class="fan-kart-kapak" ... alt="" ...>`; galeri şablonlarında da `alt=""` bulunuyor. Kart/galeri görseli yalnızca dekorasyon değil, eser/kapak bilgisi taşıyorsa bu alternatif metin kaybıdır. Portre şablonunun `aria-hidden="true"` ile dekoratif tasarlanmış olması ayrı bir durumdur ve alt boşluğu orada kabul edilebilir.
- **Önerilen düzeltme:** Bilgi taşıyan kapaklarda `alt` değerini eser başlığı/kapak açıklamasıyla doldurun; yalnızca aynı bilgiyi metin zaten eksiksiz veriyorsa `alt=""` bırakın. Dekoratif görselleri açıkça `aria-hidden="true"` ile işaretleyin.

### F-10 — Orta — Modal host için ortak odak/semantik yönetim kanıtı yok

- **Dosya:satır:** `index.html:840`; dinamik dialog örnekleri `js/oyun/64-seviye-kapilari.js:1`, `js/engine/92-v51-dashboard.js:39`
- **Sorun:** `#perde` yalnızca `<div class="perde" id="perde" hidden></div>` olarak tanımlı. Dinamik içeriklerin bazıları `role="dialog" aria-modal="true"` ekliyor; ancak ortak host için açık `aria-hidden`/`inert`, focus trap ve modal kapanınca önceki elemana focus geri verme mekanizması tespit edilmedi.
- **Kanıt:** `index.html:840` host'ta `role`, `aria-hidden` veya `inert` yok. Kaynak taramasında dialog açan çok sayıda şablon ve `focus()` kullanımı bulunmasına karşın, modal içi Tab döngüsünü sınırlayan veya açan kontrolü saklayıp kapatınca restore eden ortak bir trap bulunamadı.
- **Etkisi:** Klavye kullanıcısı modal açıkken arka plandaki kontrollere ilerleyebilir; kapanma sonrası focus beklenmedik konuma dönebilir.
- **Önerilen düzeltme:** Tek modal yöneticisi kullanın: açan elementi saklayın, `aria-hidden`/`inert` ile arka planı pasifleştirin, ilk/son focus arasında Tab döngüsü kurun, Escape ve kapatma sonrası focus'u geri verin. Native `<dialog>` yaklaşımını değerlendirin.

### F-11 — Orta — `uclu` temada normal metin rengi WCAG AA kontrastını karşılamıyor

- **Dosya:satır:** `css/style.css:1` (`html[data-ayar-tema=uclu]` değişkenleri)
- **Sorun:** `--deniz:#C8102E` metin rengi, `--kar:#080808` koyu zemin üzerinde kullanılıyor. Bu çift normal metin için yetersiz.
- **Kanıt:** sRGB WCAG kontrast hesabı `#C8102E` / `#080808` için yaklaşık **3.40:1** verir; normal metin eşiği 4.5:1'dir. `--deniz` `.etiket`, link ve benzeri metinlerde kullanılıyor; yalnızca büyük metin/ikon rengi olarak sınırlandırılmamış.
- **Önerilen düzeltme:** Koyu zeminde normal metin için beyaz veya daha açık kırmızı kullanın; kırmızıyı yalnızca büyük metin/ikon/dekoratif vurguya ayırın. `uclu`, `tas` ve diğer kullanıcı temalarını otomatik WCAG kontrast testine ekleyin.

### F-12 — Orta — README'deki “tam çevrimdışı çalışma” iddiası mevcut cache sözleşmesiyle garanti edilmiyor

- **Dosya:satır:** `README.md:12`; kanıtlayıcı teknik kaynaklar `sw.js:5`, `index.html:849-859`
- **Sorun:** README “Service Worker ile tam çevrimdışı çalışma” diyor; fakat ilk HTML scriptlerinin yedisi precache'te yok ve CSS hash'i uyuşmuyor.
- **Kanıt:** F-02 ve F-03'te listelenen gerçek kaynak farkları, yalnızca `index.html` cache'ten geldiğinde uygulamanın ağsız açılışını garanti etmez.
- **Önerilen düzeltme:** Önce precache sözleşmesini düzeltip gerçek offline smoke test ekleyin; aksi halde README iddiasını “çekirdek kabuk çevrimdışı; bazı modüller ilk çevrimiçi açılıştan sonra kullanılabilir” şeklinde daraltın.

### F-13 — Orta — README'deki roadmap bağlantısı depoda yok

- **Dosya:satır:** `README.md:17`
- **Sorun:** `ROADMAP-6.0-APK.md` bağlantısı veriliyor fakat bu dosya repoda bulunamadı.
- **Kanıt:** Link hedefi `test -e ROADMAP-6.0-APK.md`/`find` ile yok; mevcut Markdown dosya listesinde bu isimde dosya bulunmuyor.
- **Önerilen düzeltme:** Dosyayı ekleyin veya bağlantıyı mevcut roadmap dosyasına (`ucretli-plan-hediye-derin-inceleme.md` değilse doğru belgeye) düzeltin. CI'da relative Markdown link checker çalıştırın.

### F-14 — Düşük — Font ağırlığı beyanları gerçek dosya ağırlığıyla eşleşmiyor

- **Dosya:satır:** `css/style.css:1`; kritik inline CSS `index.html:44`
- **Sorun:** Bodoni/Karla için `font-weight:600` ve `700` tanımları, aynı `*-normal-400-*.woff2` dosyasına işaret ediyor; 500/700 Karla da 400 dosyasına işaret ediyor.
- **Kanıt:** CSS'te örneğin `font-family:Bodoni Moda;font-weight:700;src:url(../yazitipi/bodonimoda-normal-400-...)` ve `Karla;font-weight:700;src:url(...karla-normal-400-...)` mevcut. Repoda ilgili 600/700 font dosyaları yok.
- **Etkisi:** Tarayıcı sentetik bold üretir; tasarım ağırlığı ve metin ölçüleri değişebilir, font yükleme/performans beklentisi yanıltıcı olur.
- **Önerilen düzeltme:** Gerçek 600/700 font dosyalarını ekleyin; yoksa `font-weight` tanımlarını gerçekten desteklenen ağırlıklara indirin ve `font-synthesis` davranışını bilinçli belirleyin.

### F-15 — Düşük — Mevcut sistem raporunda güncel olmayan somut örnekler var

- **Dosya:satır:** `sistem-kod-denetim-raporu-2026-10-02.md:154-170,311-333`
- **Sorun:** Rapor `paket-4.js?v=544-final` ve “/sen/ altında göreli SW kaydı” gibi örnekleri mevcut durumun kanıtı gibi sunuyor; güncel repo bunları göstermiyor.
- **Kanıt:** Güncel `index.html:845` `paket-4.js?v=52f73cc9f764`; güncel çalışma kodunda `js/core/24-arsiv-mantigi.js:1` ve bundle içindeki kayıt `navigator.serviceWorker.register("/sw.js", { scope: "/" })` mutlak root URL kullanıyor. Güncel gerçek uyuşmazlık CSS hash'inde (`F-02`) ve eksik precache'te (`F-03`).
- **Önerilen düzeltme:** Raporu “tarihsel snapshot” diye etiketleyin veya güncel hash/kanıtlarla güncelleyin; release sonrası rapor iddialarını çalışan kaynakla yeniden doğrulayın.

## Kontrol sonucu olumlu olanlar / doğrulanamayanlar

- **HTML yapısı:** `index.html` için `div`, `section`, `main`, `header`, `footer`, `button`, `form`, `label`, `script` açma-kapama sayıları eşleşti; `section` sayısı 58. Statik DOM'da duplicate `id` bulunmadı.
- **SEO temel etiketleri:** `html lang="tr"` (`index.html:2`), tek H1 (`index.html:81`), `robots=index, follow` (`:30`), 141 karakter description (`:14`) ve 34 karakter title (`:13`) mevcut. Description uzunluğu pratik snippet aralığında.
- **Canonical/OG:** Gerçek (yorum dışı) canonical `https://tentiforapp.pages.dev/` (`index.html:52`) ile `og:url` (`:53`) aynı. `og:image`/Twitter image canlıda **HTTP 200** ve `paylasim.png` gerçek ölçüsü **1200×630**. Twitter `twitter:url` yok; bu zorunlu bir etiket değildir, canonical/og:url yeterli fallback sağlar.
- **JSON-LD:** `index.html:32-41` JSON olarak parse ediliyor; `@context`, `@type=WebSite`, `name`, `description`, `inLanguage` geçerli temel alanlar. Ancak route'a özgü değildir ve `url` alanı eklenmesi önerilir; mevcut hali “geçersiz JSON-LD” olarak raporlanmadı.
- **Manifest varlıkları:** `ikon/ikon-192.png` 192×192, `ikon-512.png` 512×512, maskable 512×512; ekran görüntüleri sırasıyla 824×1648, 824×1648 ve 1280×800. Manifestteki `sizes` ile gerçek piksel ölçüleri eşleşiyor.
- **CSS varlıkları:** `css/style.css` içindeki 26 font `url()` referansının tamamı yerel dosyaya çözüldü. Manifest ikonları ve ekran görüntülerinde eksik dosya bulunmadı.
- **Dış bağlantılar:** Görülebilen `https://tentiforapp.pages.dev/`, `paylasim.png` ve Cloudflare beacon URL'si canlı kontrolde 200 döndü. `assetlinks.json`, manifest ve `sw.js` de 200 döndü. `sitemap.xml` tek istisna: HTTP statüsü 200 olsa da semantik olarak XML değil (F-01).
- **Hash rotaları:** Kök JS/index içinde görülen `#/` değerlerinin önemli bölümü (örn. `#/tomye`, `#/harita`, `#/yasal/*`, `#/sen`, `#/ev/*`, `#/u/*`) istemci route/renderer kodu tarafından ele alınıyor; yalnızca statik `id` karşılaştırmasıyla “kırık” ilan edilmedi. Doğrudan path navigasyonları da canlıda 200 shell alıyor; bu durum F-05'te SEO/SSR sorunu olarak raporlandı.
- **Büyük resimler:** İncelenen PWA/OG görselleri yaklaşık 2.3–111 KB aralığında; “çok büyük resim dosyası” olarak doğrulanabilir bir sorun bulunmadı. Dinamik kullanıcı yüklemeleri bu ölçümün dışındadır.

## Öncelikli düzeltme sırası

1. F-01: gerçek XML sitemap veya robots satırının kaldırılması.
2. F-02/F-03/F-04: tek kaynaklı asset manifesti; HTML/SW hash ve precache senkronu; tüm JS/CSS sürümleme.
3. F-05: public path rotaları için prerender/route-specific metadata.
4. F-07/F-08/F-10: accessible name, görünür focus ve modal focus yönetimi.
5. F-11: `uclu` tema kontrast düzeltmesi.
6. F-13 ve F-15: Markdown link/rapor doğruluk temizliği.
