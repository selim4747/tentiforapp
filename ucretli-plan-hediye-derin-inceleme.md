# Ücretli plan hediye etme — derin inceleme raporu

**Tarih:** 2026-10-02  
**Proje:** tentiforapp / bağlı Supabase projesi  
**İncelenen akış:** `mod-yonetici` → `data-pro-ver` → `abonelik_hediye`

## Kısa sonuç

Supabase tarafında **tam yönetici kaydı doğru**, güncel `abonelik_hediye(text,text,integer)` RPC'si canlıda mevcut, `authenticated` rolüne açık ve `SECURITY DEFINER` olarak doğru ayarlanmış. Tam yönetici UUID'siyle gerçek authenticated bağlamı taklit edilerek yapılan salt-okunur test `{"durum":"yok"}` döndürdü; bu, yetki kontrolünün geçtiğini kanıtlıyor. Yetkisiz UUID ise `{"durum":"yetki"}` döndürdü.

Buna rağmen hediye akışında kesin bir istemci kusuru var: aynı düğme hem eski `moderasyon.js` handler'ı tarafından `pro_ver` RPC'sine hem de yeni `91-v473-uyelik.js` handler'ı tarafından `abonelik_hediye` RPC'sine bağlanmış. Eski handler kaldırılmadığı için tıklama iki farklı akışı tetikleyebilir. Bu durum çift işlem, yanlış plan (`pro_ver` her zaman `evrenyazar`), eski hata mesajının görünmesi veya yeni handler'ın sonucu üzerine yazılması riskini oluşturuyor.

## Canlı Supabase bulguları

### 1. Yönetici hesabı doğru

- `yoneticiler.id`: `ddd0f85b-da6e-483b-8f9a-465a210b51e9`
- `duzey`: `tam`
- Profil kullanıcı adı: `selimoo2`
- Auth kullanıcısı mevcut: evet
- `tam_yonetici_mi()` tanımı: `yoneticiler.id = auth.uid() and duzey = 'tam'`

Sonuç: **E-postanın yönetici olması tek başına ölçüt değil; girişteki JWT'nin UUID'si önemlidir.** Kullanılan tarayıcı oturumu bu UUID'ye ait değilse RPC bilinçli olarak `yetki` döndürür.

### 2. Hediye RPC'si canlıda mevcut

Canlı tanım:

```text
abonelik_hediye(p_kullanici_adi text, p_tip text, p_gun integer) returns jsonb
```

- `SECURITY DEFINER`: açık
- Sahip: `postgres`
- `search_path`: boş (`''`)
- `authenticated`: `EXECUTE` yetkisi var
- `anon`: yetkisi yok
- `tam_yonetici_mi()` çağrısı var
- Hedef kullanıcı adı case-insensitive karşılaştırılıyor
- Gün değeri 1–3650 aralığına sıkıştırılıyor
- Başarılı akışta `abonelikler`, `hediye_gecmisi` ve `kullanici_bildirimleri` yazılıyor

### 3. Tablolar canlıda var

- `abonelikler`: var, 1 kayıt
- `hediye_gecmisi`: var, 0 kayıt
- `kullanici_bildirimleri`: var, 5 kayıt
- `hediye_gecmisi` gerekli kolonlara ve RLS politikalarına sahip
- `kullanici_bildirimleri.kategori` canlıda mevcut

`hediye_gecmisi` sayısının 0 olması, şimdiye kadar yeni `abonelik_hediye` akışının başarılı bir hediye işlemiyle tamamlanmadığını gösteriyor. Mevcut tek abonelik kaydı `selimblackstone` kullanıcısına ait ve `evrenyazar` olarak aktif.

### 4. RPC smoke test sonuçları

Tam yönetici UUID'siyle, gerçek authenticated bağlamı taklit edilerek **var olmayan kullanıcı adı** çağrıldı:

```json
{"durum":"yok"}
```

Bu beklenen sonuçtur ve yetkinin geçtiğini gösterir.

Yetkisiz UUID ile aynı çağrı:

```json
{"durum":"yetki"}
```

Bu da yetki kontrolünün çalıştığını gösterir.

Gerçek kullanıcı adına başarılı çağrı yapılmadı; çünkü bu, abonelik ve hediye geçmişinde kalıcı değişiklik oluşturur.

## Kesin kaynak kusuru: iki click handler

### Yeni akış

`js/engine/91-v473-uyelik.js` içinde düğme:

```js
hesapIstemci.rpc('abonelik_hediye', {
  p_kullanici_adi: kadi,
  p_tip: tip,
  p_gun: gun
})
```

Bu handler `stopImmediatePropagation()` kullanıyor; ancak eski handler daha önce kayıt olduysa bu önlem eski handler'ı geriye dönük engelleyemez.

### Eski akış hâlâ canlı

`js/admin/moderasyon.js` ve üretim `uygulama/kabuk/www/js/paket-4.js` içinde aynı düğme için eski handler bulunuyor:

```js
hesapIstemci.rpc('pro_ver', {
  p_kullanici_adi: ...,
  p_gun: ...
})
```

Canlı `pro_ver(text, integer)` fonksiyonu yeni RPC'yi şu şekilde çağırıyor:

```text
abonelik_hediye(p_kullanici_adi, 'evrenyazar', p_gun)
```

Bu nedenle eski handler çalışırsa:

1. Seçilen plan dikkate alınmaz; her zaman `evrenyazar` gönderilir.
2. Yeni akışla birlikte aynı tıklama iki ayrı hediye işlemi başlatabilir.
3. İki hediye geçmişi satırı oluşabilir.
4. Kullanıcıya eski “Pro verildi” mesajı gösterilebilir.
5. Eski çağrı hata verirse yeni çağrının sonucu kullanıcı açısından belirsizleşebilir.

## Olası hata senaryoları ve ayırt edici belirtiler

| Olası neden | Belirti | Durum |
|---|---|---|
| Tarayıcı JWT'si `selimoo2` UUID'sine ait değil | `Hediye verilemedi: yetki` | Çok olası; e-posta değil JWT UUID'si kontrol ediliyor |
| Kullanıcı adı yerine e-posta giriliyor | `Bu kullanıcı adıyla kayıtlı hesap bulunamadı` / `durum:yok` | Çok olası; RPC yalnızca `profiller.kullanici_adi` arıyor |
| Kullanıcı adında başta/sonda boşluk var | Normalde sorun olmamalı | RPC `btrim` kullanıyor |
| Üretim sitesi eski JS paketi önbellekten sunuyor | Eski “Pro verildi” mesajı, plan seçiminin etkisiz olması | Çok olası; eski handler üretim paketinde hâlâ var |
| Aynı düğmeye iki handler bağlı | Çift işlem, planın EvrenYazar'a dönmesi, karışık mesaj | **Kesin kaynak kusuru** |
| Hedef profil yok veya kullanıcı adı yanlış büyük/küçük harf | `durum:yok` | RPC case-insensitive; gerçek sorun yanlış değer olabilir |
| Kullanıcı adı doğru ama yanlış Supabase projesine bağlı site | RPC/oturum davranışı beklenenden farklı | Ortam/config doğrulanmalı |
| Üretim bundle'ı güncel kaynakla yeniden paketlenmemiş | Kaynakta düzeltme var ama sitede eski davranış | Kontrol edilmeli |
| Oturum giriş yaptıktan sonra sayfa yenilenmemiş | `hesapIstemci` hazır değil veya eski JWT kullanılıyor | Olası; çıkış-giriş + tam yenileme gerekir |
| `mod-yonetici` paneli yalnızca yerel `yoneticiAcik()` koşuluyla çiziliyor | Tam Supabase yöneticisi olmasına rağmen hediye alanı görünmüyor | Tasarım kusuru/karışıklık; Supabase tam yöneticiliği ile yerel panel kilidi ayrı sistemler |

## Özellikle önemli ayrım

`yoneticiler.duzey = 'tam'` kaydı, Supabase RPC yetkisini doğrular. Ancak yönetici panelinin HTML'i ayrıca istemci tarafındaki `yoneticiAcik()` koşuluna bağlıdır. Yani:

- Supabase'de tam yönetici olmak RPC için yeterlidir.
- Panelin görünmesi için ayrıca uygulamanın yerel yönetici/moderatör açma koşulu sağlanır.
- Bu iki yetki sistemi aynı şey değildir.

## Sonuç / önceliklendirme

1. **P0 — Eski `pro_ver` click handler'ı kaldırılmalı.** Tek düğme yalnızca `abonelik_hediye` çağırmalı.
2. **P0 — Kaynak ve üretim `paket-4.js` yeniden paketlenip yayınlanmalı.** Sadece kaynak dosyayı değiştirmek canlı siteyi düzeltmez.
3. **P1 — Tarayıcıdan çıkış yapılıp `selimoo2` hesabıyla yeniden giriş yapılmalı.** E-posta adresinden ziyade JWT UUID'si doğrulanmalı.
4. **P1 — Hedef olarak e-posta değil, Supabase `profiller.kullanici_adi` girilmeli.**
5. **P1 — Başarılı testten sonra `hediye_gecmisi` ve hedef `abonelikler` kaydı kontrol edilmeli.**
6. **P2 — Yönetici paneli erişimi ile Supabase tam yönetici yetkisi tek bir açık koşulda birleştirilmeli; aksi halde kullanıcı tam yönetici olduğu halde paneli göremeyebilir.**

## İnceleme sınırı

Gerçek kullanıcı oturumuyla üretim tarayıcısında hedef kullanıcıya kalıcı hediye verilmedi; bu nedenle veri değiştiren başarılı hediye çağrısı bilerek çalıştırılmadı. Canlı RPC, tablo, grant, yönetici kaydı ve iki farklı kimlik bağlamı salt-okunur/sarmalanmış testlerle doğrulandı.
