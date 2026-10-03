# TentiforApp — Backend/Supabase Güvenlik Denetimi

**Kapsam:** Yalnızca `supabase/kurulum.sql`, ek SQL dosyaları, `supabase/migrations/*.sql`, `supabase/functions/*/index.ts` ve RPC/Edge Function çağrıları yapan istemci kodu incelendi.

**İncelenen sürüm:** `1ba8eca` (`git rev-parse --short HEAD`).

**Yöntem ve sınır:** Statik kaynak incelemesi yapıldı; canlı Supabase projesinde rol grant’leri, deploy edilmiş Edge Function sürümleri, gerçek JWT doğrulaması ve gerçek webhook sağlayıcı ayarları çalıştırılarak doğrulanamadı. Aşağıdaki bulgular kaynak kodunda doğrudan görülen davranışlara dayanır. Canlı veritabanı gerektiren noktalar ayrıca belirtilmiştir.

## Kısa sonuç

- `CREATE TABLE` ile oluşturulan tabloların tamamında kaynakta `ENABLE ROW LEVEL SECURITY` bulundu; RLS’siz kalan bir tablo tespit edilmedi.
- `using (true)` kullanılan politikalar içinde özellikle `profiller` kişisel alanları da herkese açıyor. Diğer açık politikalar (`yaris_tanim`, `yaris_ayar`, `oylanabilir`, `yayindaki_evrenler`) katalog/ayar amaçlı görünüyor.
- Çoğu `SECURITY DEFINER` fonksiyonunda `search_path = ''` kullanılmış; iki sayaç fonksiyonu bunun yerine `search_path = public` kullanıyor.
- RPC adları ile istemci çağrıları arasında kaynakta eşleşmeyen bir ad bulunamadı. Buna karşılık aynı imzalı fonksiyonların birden çok kez yeniden tanımlandığı ve son tanımın önceki davranışı sessizce değiştirdiği görüldü.
- `abonelik_hediye` son doğrulama migration’ında yönetici ve süre/plan doğrulaması yapıyor; doğrudan istemci çağrısıyla abonelik yazılmasını sağlayan yetkisiz bir RPC kanıtlanmadı.

## Bulgular

### B-01 — Sınırlı yönetici, yarış içeriğini ve liderlik ayarlarını değiştirebiliyor

**Önem:** **Yüksek**  
**Dosya:satır:** `supabase/kurulum.sql:111-114, 616-650, 980-983`; sınırlı yönetici üretimi `supabase/kurulum.sql:2337-2340`

**Sorun:** `yaris_icerik_yukle` yalnızca `yonetici_mi()` kontrolü yapıyor. `yonetici_mi()` ise yöneticiler tablosunda herhangi bir satırın bulunmasını yeterli sayıyor; `duzey = 'sinirli'` olan yönetici de bu kontrolden geçer. Fonksiyon soru bankasını silebilir/yeniden yazabilir, liderlik sınırlarını değiştirebilir ve oylanabilir yapımlar listesini değiştirebilir. Fonksiyon authenticated role’e açıkça grant edilmiştir.

**Somut kanıt:**

```sql
-- supabase/kurulum.sql:111-114
create or replace function public.yonetici_mi() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.yoneticiler where id = auth.uid());
$$;
```

```sql
-- supabase/kurulum.sql:610-616
create or replace function public.yaris_icerik_yukle(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
...
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
```

```sql
-- supabase/kurulum.sql:618-650
for y in select jsonb_object_keys(coalesce(p->'banka', '{}')) loop
  delete from public.yaris_banka where yaris = y;
  insert into public.yaris_banka ...;
end loop;
...
update public.liderlik_ayar set ... where id = 1;
...
delete from public.oylanabilir ...;
insert into public.oylanabilir ...;
```

```sql
-- supabase/kurulum.sql:980-983
grant execute on function public.yaris_icerik_yukle(jsonb), ... to authenticated;
```

Sınırlı yönetici rolü tek-kod akışında açıkça oluşturuluyor:

```sql
-- supabase/kurulum.sql:2337-2340
values (uid, 'sinirli', oz, ...)
on conflict (id) do nothing;
```

**Etki:** `sinirli` yönetici, güvenlik modelindeki “tam yönetici” ayrımına rağmen yarış sorularını/cevaplarını ve liderlik yapılandırmasını değiştirebilir. Bu doğrudan içerik bütünlüğü ve liderlik sonuçlarının manipülasyonudur.

**Önerilen düzeltme:** `yaris_icerik_yukle` içinde `public.tam_yonetici_mi()` veya açıkça `public.yonetici_yetki('icerik')` kontrolü kullanın. İçerik yükleme için ayrı bir yetki adı ve ayrı grant tanımlayın; fonksiyonu mevcut authenticated grubuna açık bırakıp yalnızca genel `yonetici_mi()` ile korumayın. Canlı veritabanında mevcut `authenticated` grant’lerini de kontrol edin.

---

### B-02 — `fan` moderatör, `kanon` işaretini değiştirebiliyor

**Önem:** **Yüksek**  
**Dosya:satır:** `supabase/kurulum.sql:2996-3002, 3079-3092`

**Sorun:** Kaynak yorumunda `fan` moderatörün yalnızca fan-made içerikle sınırlı, `kanon` moderatörün ise kanon içeriğe yetkili olduğu yazıyor. Fakat `moderator_dogrula` yalnızca token’ın aktif bir oturuma ait olup olmadığını kontrol ediyor; tokenın bağlı olduğu `moderator_kodlari.duzey` değerini kontrol etmiyor. `yayin_kanon` da herhangi bir geçerli moderatör tokenını kabul ediyor.

**Somut kanıt:**

```sql
-- supabase/kurulum.sql:2996-3002
create or replace function public.moderator_dogrula(p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.moderator_oturumlari o
    join public.moderator_kodlari k on k.ozet = o.kod_ozet
    where o.token_ozet = public.mod_ozet(p_token, '#tok')
      and o.bitis > now() and k.aktif
  );
$$;
```

Bu sorguda `k.duzey` ile ilgili bir yetki testi yoktur. Kanon işareti fonksiyonu:

```sql
-- supabase/kurulum.sql:3079-3090
-- 4.0.3: iki seviyeli moderatör. "fan": yalnızca fan-made onaylar; "kanon": fan-made ve kanon onaylar.
create or replace function public.yayin_kanon(p_token text, p_slug text, p_kanon boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.moderator_dogrula(p_token) or public.tam_yonetici_mi()) then raise exception 'yetki yok'; end if;
  update public.yayindaki_evrenler set kanon = coalesce(p_kanon, false) where slug = p_slug;
  return found;
end;
$$;
grant execute on function public.yayin_kanon(text, text, boolean) to anon, authenticated;
```

**Etki:** Geçerli bir `fan` moderatör oturumu kanon statüsünü açıp kapatabilir. Bu, kaynakta ilan edilen rol ayrımının doğrudan yetki atlamasıdır.

**Önerilen düzeltme:** `moderator_dogrula` yerine tokenın düzeyini döndüren güvenli bir iç fonksiyon kullanın. `p_kanon = true` için `duzey = 'kanon'` veya tam yönetici, `p_kanon = false` için uygun ayrı politika uygulayın. Token doğrulama ve yetki kararını tek bir SQL fonksiyonunda birleştirin; rol kararını istemciye bırakmayın.

---

### B-03 — Yarış bitiş yanıtı soru cevaplarını istemciye sızdırıyor

**Önem:** **Yüksek**  
**Dosya:satır:** `supabase/kurulum.sql:527-529, 741-775, 788-798`

**Sorun:** Dosya, doğru cevapların istemciye gösterilmemesi gerektiğini söylüyor. Ancak `yaris_bitir` her soru için `b.cevap` değerini `sonuclar` içine koyuyor ve bu JSON’u istemciye döndürüyor. Bir kullanıcı boş/yanlış yanıtlarla çok sayıda oturum başlatıp bitirerek soru bankasının cevaplarını toplu olarak çıkarabilir.

**Somut kanıt:**

```sql
-- supabase/kurulum.sql:527-529
-- Sorular ve doğru cevaplar sunucudadır. Oyuncuya sorular cevapsız gider;
-- puanı, süreyi ve doğruluğu veritabanı hesaplar.
```

```sql
-- supabase/kurulum.sql:741-775
select * into b from public.yaris_banka where yaris = o.yaris and no = o.sorular[i];
...
sonuclar := sonuclar || jsonb_build_object(
  'dogru', ok,
  'cevap', b.cevap,
  'kismi', kismi
);
```

```sql
-- supabase/kurulum.sql:796-798
return jsonb_build_object(..., 'sonuclar', sonuclar);
```

**Etki:** `yaris_banka.cevap` alanı, RLS/select ile doğrudan gizlense bile yarış RPC’sinin dönüşünden öğrenilebilir. Bu, soru/cevap bankasının gizliliğini ve yarış bütünlüğünü bozar.

**Önerilen düzeltme:** `sonuclar` içinde yalnızca `dogru`, `kismi`, puan ve güvenli metrikleri döndürün; `b.cevap` alanını kaldırın. Kullanıcıya açıklama gerekiyorsa cevapları ayrı, oran sınırlı ve tek kullanımlık bir sonuç akışıyla; mümkünse yalnızca yöneticiye sunun. RPC için regresyon testi ekleyip yanıt JSON’unda `cevap` anahtarını yasaklayın.

---

### B-04 — Moderasyon Edge Function’ı kimlik doğrulamasız ve her içeriği onaylıyor

**Önem:** **Yüksek**  
**Dosya:satır:** `supabase/functions/moderasyon/index.ts:2-15`

**Sorun:** Fonksiyon Authorization header, JWT, yönetici/moderatör rolü, istek metodu veya içerik doğrulaması yapmıyor. Gelen `icerik` değeri kullanılmadan her başarılı JSON isteği için `onaylandi: true` döndürüyor. CORS da tüm origin’lere açık.

**Somut kanıt:**

```ts
// supabase/functions/moderasyon/index.ts:2-10
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  try {
    const { icerik } = await req.json();
    return new Response(JSON.stringify({ durum: 'ok', onaylandi: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
```

**Etki:** Endpoint’e erişebilen herkes, içerik göndermeden/rol doğrulamadan “onaylandı” yanıtı alır. Bu dosyanın içinde doğrudan Supabase yazımı görülmediği için canlı veritabanında onayın hangi katmanda kalıcılaştırıldığı doğrulanamadı; ancak endpoint’in güvenlik kararı fail-open ve gerçek moderasyon sonucu olarak kullanılması güvenli değildir.

**Önerilen düzeltme:** Fonksiyonda JWT’yi `auth.getUser` ile doğrulayın, rolü server-side kontrol edin, işlem ve alan allowlist’i uygulayın ve onayı yalnızca service-role ile yapılan atomik DB işlemi olarak kaydedin. Gerçek moderasyon uygulanmıyorsa fonksiyonu kaldırın veya `onaylandi: true` yerine açıkça `not_implemented` döndürün. Origin’i sabit uygulama originleriyle sınırlayın.

---

### B-05 — Ödeme webhook’unda imza doğrulaması yok

**Önem:** **Orta**  
**Dosya:satır:** `supabase/functions/odeme-webhook/index.ts:2-5`

**Sorun:** Webhook her HTTP metodunu ve her gövdeyi kabul edip 200/`durum: ok` döndürüyor. PayTR veya başka bir sağlayıcı imzası, merchant bilgisi, tutar, sipariş kimliği, durum ve idempotency kontrolü yok.

**Somut kanıt:**

```ts
// supabase/functions/odeme-webhook/index.ts:2-5
Deno.serve(async (req) => {
  return new Response(JSON.stringify({ durum: 'ok' }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

**Etki:** Endpoint, sağlayıcı dışındaki sahte bildirimleri de başarılı kabul eder. Mevcut dosyada `abonelikler` veya `odemeler` tablosuna yazım bulunmadığından bu kaynakla tek başına abonelik yükseltmesi kanıtlanamadı; buna rağmen webhook sözleşmesi güvenli değildir ve ileride DB yazımı eklendiğinde sahte ödeme riski doğrudan oluşur.

**Önerilen düzeltme:** Sağlayıcının resmi imza/kanal doğrulamasını ham request body üzerinde uygulayın; merchant ID, `merchant_oid`, tutar, para birimi ve beklenen kullanıcı/planı server-side doğrulayın. Başarılı işlemi `odemeler.merchant_oid` üzerinde unique/idempotent upsert ile kaydedin; yalnızca doğrulanmış ve başarılı durum için abonelik RPC’sini service-role bağlamında çalıştırın. Geçersiz imzaya 401/400 dönün.

---

### B-06 — Ödeme başlatma endpoint’i kimlik ve plan doğrulaması olmadan başarı dönüyor

**Önem:** **Orta**  
**Dosya:satır:** `supabase/functions/odeme-baslat/index.ts:2-8`

**Sorun:** OPTIONS dışındaki her istek, Authorization, HTTP metodu, request body, kullanıcı veya fiyat/plan doğrulanmadan `durum: ok` döndürüyor; ödeme URL’si ise `null`. İstemci bu sonucu ödeme iframe’i açmak için kullanıyor.

**Somut kanıt:**

```ts
// supabase/functions/odeme-baslat/index.ts:2-8
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  return new Response(JSON.stringify({ durum: 'ok', odemeUrl: null }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
});
```

İstemci çağrısı UI kontrolünden sonra yapılmakta, fakat Edge Function tarafında aynı kontrol yoktur:

```js
// js/engine/91-v473-uyelik.js:1 (tek satırlık kaynak)
const t = await tf4Fonksiyon("odeme-baslat", {});
```

**Etki:** Yetkisiz/bozuk istekler başarılı ödeme başlangıcı olarak raporlanır ve ödeme akışı fail-open davranır. Bu dosyada abonelik yazımı olmadığı için doğrudan ücretsiz abonelik yükseltmesi doğrulanamadı; mevcut davranış ödeme başlatmayı güvenilir biçimde temsil etmiyor.

**Önerilen düzeltme:** JWT doğrulayın; kullanıcıyı token’dan alın; plan/fiyatı istemciden kabul etmeyip server-side sabit katalogdan seçin; provider token/URL’sini yalnızca doğrulanmış talep için üretin. Başarı yanıtını ancak provider oturumu gerçekten oluşturulduğunda dönün.

---

### B-07 — Profil tablosu `using (true)` ile kişisel alanları anonim okuma için açıyor (KVKK/gizlilik riski)

**Önem:** **Orta**  
**Dosya:satır:** `supabase/kurulum.sql:5-19, 23-35`; istemci okuması `js/core/28-hesap.js:1`

**Sorun:** `profiller` tablosu kullanıcı adı, görüntü adı, görsel, hakkında, Tentifor adı ve JSON özet alanlarını içeriyor. RLS policy tüm select işlemlerini `true` ile kabul ediyor. İstemci de bu alanları doğrudan herkese açık tablo sorgusuyla okuyor.

**Somut kanıt:**

```sql
-- supabase/kurulum.sql:7-19
create table if not exists public.profiller (...
  gorsel text,
  ...
);
alter table public.profiller add column if not exists hakkinda text ...;
alter table public.profiller add column if not exists tentifor_adi text ...;
alter table public.profiller add column if not exists ozet jsonb not null default '{}'::jsonb;
```

```sql
-- supabase/kurulum.sql:23-35
alter table public.profiller enable row level security;
create policy "profiller herkese açık" on public.profiller
  for select using (true);
```

```js
// js/core/28-hesap.js:1 (tek satırlık kaynak)
hesapIstemci.from("profiller")
  .select("kullanici_adi, gorunen_ad, tentifor_adi, hakkinda, ozet, vitrin, olusturma")
```

**Etki:** Giriş yapmamış istemci dahil API’ye erişebilen herkes bu alanları okuyabilir. Bunların profil sayfasında paylaşılması amaçlanmış olabilir; ancak kaynakta alan bazında opt-in, gizlilik seviyesi veya herkese açık görünüm ile özel alan ayrımı yoktur. KVKK bakımından veri minimizasyonu ve amaçla sınırlılık açısından inceleme gerektirir.

**Önerilen düzeltme:** Doğrudan tablo yerine yalnızca açıkça kamuya açık sütunlardan oluşan `public_profile_view` oluşturun; `hakkinda`, `gorsel`, `vitrin` ve özet gibi alanlar için kullanıcı bazlı görünürlük/opt-in uygulayın. Authenticated API’nin tabloyu `select *` ile taramasını engelleyin ve canlı role grant’lerini sütun/view seviyesine indirin.

---

### B-08 — Sunucu tarafından üretildiği belirtilen profil özeti doğrudan kullanıcı güncellemesine açık

**Önem:** **Orta**  
**Dosya:satır:** `supabase/kurulum.sql:18-19, 30-35, 1048-1051`

**Sorun:** `ozet` alanı yorumda “sitenin kendisinin yazdığı özet” olarak tanımlanıyor; `vitrin` için de ayrı veri alanı var. Ancak profil UPDATE policy’si satır sahibi için tüm tablo güncellemelerini kabul ediyor ve column-level yetki/trigger ile `ozet` doğrulaması yok. Bu nedenle canlı role’lerde tablo UPDATE yetkisi varsa kullanıcı kendi sunucu üretimli özetini ham REST/RPC isteğiyle değiştirebilir.

**Somut kanıt:**

```sql
-- supabase/kurulum.sql:18-19
-- Sitenin kendisinin yazdığı özet: rol, kişilik, tamlık, madalyalar
alter table public.profiller add column if not exists ozet jsonb not null default '{}'::jsonb;
```

```sql
-- supabase/kurulum.sql:30-35
create policy "profiller herkese açık" on public.profiller for select using (true);
create policy "kendi profilini günceller" on public.profiller
  for update using (auth.uid() = id) with check (auth.uid() = id);
```

```sql
-- supabase/kurulum.sql:1048-1051
alter table public.profiller add column if not exists vitrin jsonb not null default '{}'::jsonb;
... profiller_vitrin_boyut check (pg_column_size(vitrin) < 2000);
```

**Etki:** Satır sahibi başkasının profilini değiştiremese de kendi profilinde sunucu hesabı gibi görünen rol/tamlık/madalya değerlerini yazabilir; bu değerler public profil görünümünde gösteriliyor. Kaynakta `profiller` için `UPDATE` yetkisinin canlı role’lerde gerçekten verildiğine dair açık `GRANT` satırı yoktur; bu nedenle canlı grant sonucu doğrulanamadı, ancak RLS policy column bazlı koruma sağlamıyor.

**Önerilen düzeltme:** Kullanıcı yazılabilir profil sütunlarını ayrı bir tabloya ayırın veya `profiller` için table UPDATE’ı kaldırıp yalnızca izin verilen sütunlara sahip bir RPC/view kullanın. `ozet`i yalnızca server-side hesaplayan fonksiyon/trigger yazabilsin; public görünümdeki `ozet` değerlerinin kaynağını ve imzasını güvenilir kabul etmeyin.

---

### B-09 — Moderatör giriş rate limit’i global; anonim saldırgan tüm moderatör girişlerini kilitleyebilir

**Önem:** **Orta**  
**Dosya:satır:** `supabase/kurulum.sql:2974-2994`

**Sorun:** Hatalı deneme sayacı IP, kod, kullanıcı veya oturum bazında değil; tüm sistem için tek `moderator_denemeler` tablosuna yazılıyor. 10 dakikada 30 hatalı denemeden sonra bütün geçerli moderatör girişleri reddediliyor. Giriş RPC’si anon role’e açıktır.

**Somut kanıt:**

```sql
-- supabase/kurulum.sql:2974-2985
create or replace function public.moderator_giris(p_kod text) returns text
...
  if (select count(*) from public.moderator_denemeler
      where zaman > now() - interval '10 minutes') >= 30 then
    raise exception 'çok deneme; biraz bekle';
  end if;
  if not exists (...) then
    insert into public.moderator_denemeler default values;
    ...
    raise exception 'kod geçersiz';
  end if;
```

```sql
-- supabase/kurulum.sql:2993-2994
revoke execute on function public.moderator_giris(text) from public;
grant execute on function public.moderator_giris(text) to anon, authenticated;
```

**Etki:** Sadece 30 sahte istekle tüm moderatörlerin 10 dakika giriş yapması engellenebilir. Bu bir yetki yükseltme değil, doğrudan erişilebilirlik/operasyonel kullanılabilirlik problemidir.

**Önerilen düzeltme:** IP/istemci ve kod özeti bazında ayrı rate limit, artan bekleme, başarısızlıkta güvenilir audit kaydı ve gerekirse Edge/WAF katmanında limit uygulayın. Global sayaç yalnızca ek bir toplam koruma olarak tutulmalı; tek başına kapı kilidi olmamalıdır.

---

### B-10 — Aynı RPC’ler birden fazla yerde tanımlanıyor; migration sırası davranışı değiştiriyor

**Önem:** **Orta**  
**Dosya:satır:** `supabase/kurulum.sql:3457-3514`; `supabase/migrations/20261002_hediye_abonelik_migration.sql:52-103`; `supabase/migrations/20261002_hediye_rpc_validation.sql:3-60`; ayrıca `supabase/kurulum.sql:3016, 3125, 3338`

**Sorun:** Aynı isim ve imzaya sahip `SECURITY DEFINER` fonksiyonlar `CREATE OR REPLACE` ile tekrar tekrar yazılıyor. `abonelik_hediye`nin ilk migration sürümü geçersiz değerleri varsayılana çeviriyor; sonraki validation migration’ı aynı imzayı geçersiz değerleri reddedecek şekilde değiştiriyor. `kurulum.sql` da üçüncü bir kopya içeriyor. Aynı dosyada `mod_karar` de aynı imzayla üç kez yeniden tanımlanıyor; yalnızca son gövde etkin kalıyor.

**Somut kanıt:**

```sql
-- supabase/migrations/20261002_hediye_abonelik_migration.sql:52-60
action: create or replace function public.abonelik_hediye(...)
...
gun int := greatest(1, least(3650, coalesce(p_gun, 30)));
tip text := lower(coalesce(p_tip, 'evrengezer'));
```

```sql
-- supabase/migrations/20261002_hediye_rpc_validation.sql:3-22
create or replace function public.abonelik_hediye(...)
...
gun int := p_gun;
tip text := lower(btrim(coalesce(p_tip, '')));
...
if kadi = '' or tip not in (...) or gun is null or gun < 1 or gun > 3650 then
  return jsonb_build_object('durum', 'gecersiz');
end if;
```

```sql
-- kurulum.sql içinde aynı imza üç kez
supabase/kurulum.sql:3016  create or replace function public.mod_karar(text, uuid, boolean, text, text)
supabase/kurulum.sql:3125  create or replace function public.mod_karar(text, uuid, boolean, text, text)
supabase/kurulum.sql:3338  create or replace function public.mod_karar(text, uuid, boolean, text, text)
```

**Etki:** Supabase migration runner’ın beklenen sırası son doğrulama sürümünü uygulasa da, SQL Editor’de dosyaların farklı sırada çalıştırılması veya yalnızca eski migration’ın uygulanması ödeme/hediye RPC’sinin doğrulama davranışını değiştirir. `mod_karar` için inceleyen kişi ilk gövdeyi okuyup canlıda etkin olan son gövdeyi gözden kaçırabilir. Bu, deploy güvenilirliği ve denetim izlenebilirliği problemidir.

**Önerilen düzeltme:** Her fonksiyon için tek bir canonical migration bırakın; eski migration’larda aynı imzayı yeniden yazmayın. Geriye dönük değişiklik gerekiyorsa yeni migration yalnızca açıkça versioned bir imzayı/işlevi güncellesin. CI’da aynı schema-qualified isim+imza için duplicate `CREATE OR REPLACE` taraması ve migration sırası testi çalıştırın.

---

### B-11 — Kimlik doğrulamalı Edge Function’larda CORS `*`

**Önem:** **Düşük**  
**Dosya:satır:** `supabase/functions/evren-oku/index.ts:3-7, 9-13`; `supabase/functions/bildirim-gonder/index.ts:5-9, 11-13`

**Sorun:** Yetkili veri okuyan `evren-oku` ve yönetici bildirimi gönderen `bildirim-gonder` tüm origin’lere CORS izni veriyor. Bu tek başına bearer token üretmez; ancak tokenı elde etmiş bir web bağlamının bu ayrı origin’den endpoint’i çağırmasına izin verir ve origin izolasyonunu gereksiz biçimde kaldırır.

**Somut kanıt:**

```ts
// supabase/functions/evren-oku/index.ts:3-7
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

```ts
// supabase/functions/bildirim-gonder/index.ts:5-9
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};
```

**Etki:** CORS politikası uygulamanın gerçek origin’iyle sınırlı değil. `bildirim-gonder` ayrıca service-role ile işlem yapan yönetici endpoint’idir; işlev JWT ve tam yönetici kontrolü yaptığı için bu bulgu doğrudan yetki atlama olarak doğrulanmadı.

**Önerilen düzeltme:** `https://tentiforapp...` ve izin verilen geliştirme originlerini allowlist ile kontrol edin; dinamik origin kullanılıyorsa `Vary: Origin` ekleyin. Authorization gerektiren yönetici endpoint’lerinde wildcard CORS kullanmayın.

---

### B-12 — İki `SECURITY DEFINER` sayaç fonksiyonu güvenli boş search_path yerine `public` kullanıyor

**Önem:** **Düşük**  
**Dosya:satır:** `supabase/kurulum.sql:2110-2128`

**Sorun:** Dosyadaki çoğu `SECURITY DEFINER` fonksiyon `set search_path = ''` ile tanımlanmışken `olay_say` ve `olay_sayilari` `set search_path = public` kullanıyor. `public` arama yolunu açık bırakmak, güvenlik tanımcısı fonksiyonlarda şema gölgelemesi ve gelecekte eklenecek niteliksiz nesnelerin çözümlemeye girmesi açısından daha zayıf yapılandırmadır.

**Somut kanıt:**

```sql
-- supabase/kurulum.sql:2110-2122
create or replace function public.olay_say(p_ad text) returns void
language plpgsql security definer set search_path = public as $$
...
create or replace function public.olay_sayilari(p_gun integer)
returns table (...) language plpgsql security definer stable set search_path = public as $$
```

**Etki:** Bu gövdelerde kritik uygulama tabloları `public.olay_sayaclari` ve yönetici çağrısı `public.tam_yonetici_mi()` şeklinde nitelikli kullanılmış; bu nedenle bu statik incelemede hemen kullanılabilir bir exploit doğrulanmadı. Ancak güvenli varsayılanla tutarsızdır ve ileride eklenen niteliksiz fonksiyon/operatör çağrıları için risk alanı yaratır.

**Önerilen düzeltme:** `set search_path = ''` kullanın; uygulama tablolarını ve fonksiyonlarını tamamen `public.` ile niteleyin. Canlı veritabanında `public` şemasına `CREATE` yetkisinin `PUBLIC`/uygulama rollerinde olmadığını da doğrulayın.

## Doğrulanamayan veya sorun bulunmayan noktalar

1. **RLS kapsamı:** Kaynakta oluşturulan tabloların tamamında `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` görüldü. RLS’siz kalan bir `CREATE TABLE` tespit edilmedi.
2. **RPC adı uyuşmazlığı:** İstemci `.rpc(...)` adları ile SQL’deki fonksiyon adları arasında kaynak taramasında eşleşmeyen çağrı bulunmadı. SQL’de tanımlı ama istemciden çağrılmayan fonksiyonlar çoğunlukla trigger, yönetici/Edge akışı veya iç helper niteliğinde.
3. **Service-role sızıntısı:** `bildirim-gonder` service-role anahtarını yalnızca Edge Function içinde `Deno.env` üzerinden kullanıyor; kaynakta bu anahtarın response/client koduna döndürüldüğünü görmedim.
4. **Abonelik hediye RPC’si:** Etkin olduğu varsayılan son sürüm (`20261002_hediye_rpc_validation.sql`) `tam_yonetici_mi()` ve plan/süre allowlist’i kontrol ediyor; authenticated grant’i bulunmasına rağmen normal kullanıcı bu kontrolü geçemiyor. Canlı deploy sırasının bu son migration’ı uyguladığı doğrulanmalıdır.
5. **`using (true)` politikaları:** `profiller` dışındaki açık politikalar kaynak yorumları ve seçilen kolonlarıyla katalog/ayar görünümü olarak tasarlanmış. Bunların iş gereksinimiyle uyumlu olduğu canlı ürün politikası olmadan kesinleştirilemez.
