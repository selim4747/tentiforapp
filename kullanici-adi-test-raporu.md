# Genel kullanıcı adı testi raporu

**Tarih:** 2026-10-02  
**Depo:** `selim4747/tentiforapp`  
**Supabase projesi:** `wlgtjbrlquefnzavwein`

## Sonuç

Kullanıcı adı akışında kritik bir hata bulunmadı. Kaynak JS sözdizimi kontrolü, mevcut otomatik test paketi, sınır-değer matrisi ve canlı Supabase şema/veri kontrolleri başarılı.

## Kontroller

- `js/core/28-hesap.js` ve Android kabuk kopyası `node --check` ile doğrulandı.
- Kaynak ve Android kopyasının SHA-256 özeti aynı: `cdfc2aba4986044cae46fe07126bc852759e973028094efec280e040e2f7bb90`.
- `npm test`: **PASS**; tüm mevcut regresyon ve kullanıcı simülasyonu testleri geçti.
- Canlı kullanıcı adı matrisi:
  - 3 karakter: geçerli
  - 20 karakter: geçerli
  - 2 ve 21 karakter: reddediliyor
  - büyük harf: küçük harfe dönüştürülüyor
  - Türkçe `ç, ğ, ı, ö, ş, ü`: ASCII karşılığına dönüştürülüyor
  - boşluk, tire, nokta, emoji ve satır sonu: reddediliyor
  - alt çizgi: mevcut kurala göre geçerli
- Canlı veri bütünlüğü:
  - auth kullanıcıları: **2**
  - profiller: **2**
  - eksik profil: **0**
  - boş/null kullanıcı adı: **0**
  - uzunluk ihlali: **0**
  - baş/son boşluk: **0**
  - izin verilmeyen karakter: **0**
  - büyük harf: **0**
  - case-insensitive çakışma: **0**
- Canlı `public.profiller` kısıtları mevcut:
  - `CHECK (kullanici_adi ~ '^[a-z0-9_]{3,20}$')`
  - `UNIQUE (kullanici_adi)`
  - primary key ve auth kullanıcı referansı

## Dayanıklılık bulgusu

`hesapKullaniciAdiBos()` sorgusu Supabase/REST hatası alırsa `null` döndürüyor. Kayıt ekranında kontrol yalnızca `=== false` ile yapıldığı için ağ veya geçici API hatasında kullanıcı adı arayüzde “uygun” görünebilir. Gerçek kayıt aşamasında veritabanı unique/check kısıtları yine koruma sağlıyor ve hata mesajı gösteriliyor; bu nedenle veri bütünlüğü riski yok, ancak UX yanıltıcı olabilir.

Önerilen davranış: `null` sonucunu “kontrol edilemedi, bağlantıyı dene” olarak göstermek ve form gönderimini sorgu başarılı olana kadar durdurmak.

## Değişiklik durumu

Bu test çalışmasında kaynak koduna değişiklik yapılmadı; rapor dışında çalışma ağacı temiz bırakıldı.
