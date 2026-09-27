-- Veritabanı testleri: güvenlik kuralları ve topluluk fonksiyonları.
-- tests/calistir.mjs tarafından, kurulum.sql iki kez çalıştırıldıktan sonra çalıştırılır.
-- Her kontrol test.ok() ile yapılır; biri tutmazsa hata verip durur.

create schema if not exists test;
grant usage on schema test to anon, authenticated;
create or replace function test.ok(ad text, kosul boolean) returns void language plpgsql as $$
begin
  if kosul is distinct from true then raise exception 'BAŞARISIZ: %', ad; end if;
  raise notice 'tamam: %', ad;
end $$;
create or replace function test.patlar(sorgu text) returns boolean language plpgsql as $$
begin
  execute sorgu;
  return false;
exception when others then
  return true;
end $$;
grant execute on all functions in schema test to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111', 'a@ornek.test', '{"kullanici_adi":"yonetici","gorunen_ad":"Yönetici"}'),
 ('22222222-2222-2222-2222-222222222222', 'b@ornek.test', '{"kullanici_adi":"ayse","gorunen_ad":"Ayşe"}'),
 ('33333333-3333-3333-3333-333333333333', 'c@ornek.test', '{"kullanici_adi":"cem"}'),
 ('44444444-4444-4444-4444-444444444444', 'd@ornek.test', '{"kullanici_adi":"deniz"}');
insert into public.yoneticiler values ('11111111-1111-1111-1111-111111111111');
insert into public.ilerlemeler (id, veri) values ('22222222-2222-2222-2222-222222222222', '{"gizli":1}');

select test.ok('kayıtta profil oluşur', (select count(*) = 4 from public.profiller where kullanici_adi is not null));

-- ---------- anonim ziyaretçi ----------
set role anon;
select test.ok('anonim profilleri görür', (select count(*) = 4 from public.profiller));
select test.ok('anonim ilerleme göremez', (select count(*) = 0 from public.ilerlemeler));
select test.ok('anonim yarış bankasını okuyamaz', test.patlar('select * from public.yaris_banka'));
select test.ok('anonim hesap silemez', test.patlar('select public.hesabimi_sil()'));
select test.ok('anonim hata bildirebilir', not test.patlar($q$select public.hata_kaydet('x is not defined', 'a.js:1', '/#/arsiv', 'test', '1.0.0')$q$));
select public.hata_kaydet('x is not defined', 'a.js:1', '/#/arsiv', 'test', '1.0.0');
select test.ok('anonim hata kayıtlarını okuyamaz', (select count(*) = 0 from public.hata_kayitlari));
reset role;
select test.ok('aynı hata tek satırda sayılır', (select count(*) = 1 and max(sayi) = 2 from public.hata_kayitlari));

-- ---------- giriş yapmış kullanıcı ----------
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select test.ok('kendi ilerlemesini görür', (select count(*) = 1 from public.ilerlemeler));
update public.profiller set gorunen_ad = 'ele geçirildi' where kullanici_adi = 'cem';
select test.ok('başkasının profilini değiştiremez', (select gorunen_ad is distinct from 'ele geçirildi' from public.profiller where kullanici_adi = 'cem'));
select test.ok('Günün Kelimesi cevabını çağıramaz', test.patlar($q$select public.gk_cevap(current_date)$q$));
select test.ok('yarış bankasını okuyamaz', test.patlar('select * from public.yaris_banka'));
select test.ok('yönetici olmayan yedek alamaz', test.patlar('select public.yedek_al()'));
select test.ok('yönetici olmayan istatistik göremez', test.patlar('select public.site_istatistik()'));

-- teori panosu
select test.ok('kısa teori reddedilir', public.teori_yaz('Gırıların ölçü birimleri neydi?', 'kısa') ->> 'durum' <> 'tamam' or test.patlar($q$select public.teori_yaz('x', 'kısa')$q$));
select test.ok('teori yazılır', public.teori_yaz('Gırıların ölçü birimleri neydi?', 'Bence Gırı saniyesi Tömye gününün yirmi beşte biriydi.') ->> 'durum' = 'tamam');
select id as teori_no from public.teori_listesi where benim limit 1 \gset
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.ok('başkasının teorisini beğenir', public.teori_begen(:teori_no));
select test.ok('beğeni sayılır', (select begeni = 1 from public.teori_listesi where id = :teori_no));
select test.ok('başkası teori silemez', test.patlar('select public.teori_sil(' || :teori_no || ')')
  or (select count(*) = 1 from public.teori_listesi where id = :teori_no));
select public.teori_bildir(:teori_no);
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.teori_bildir(:teori_no);
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.teori_bildir(:teori_no);
select test.ok('üç bildirimle teori gizlenir', (select count(*) = 0 from public.teori_listesi where id = :teori_no));
select test.ok('yönetici denetimde görür', (select count(*) = 1 from public.teori_denetim() where id = :teori_no));
select public.teori_isaretle(:teori_no, 'kanon', false);
select test.ok('yönetici açıp kanon işaretler', (select isaret = 'kanon' from public.teori_listesi where id = :teori_no));
select test.ok('kanon rozeti sayılır', (select kanon = 1 from public.teori_rozetleri where kullanici_adi = 'ayse'));
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.ok('yönetici olmayan işaretleyemez', test.patlar('select public.teori_isaretle(' || :teori_no || $q$, 'yakin', false)$q$));

-- içerik oylaması
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.yaris_icerik_yukle('{"yapimlar":["Delilik","Star Run","Evrengezer","Dördüncü"],"banka":{}}');
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.yapim_oyla('Delilik'), public.yapim_oyla('Star Run'), public.yapim_oyla('Evrengezer');
select test.ok('dördüncü oy verilmez', public.yapim_oyla('Dördüncü') ->> 'durum' <> 'tamam');
select test.ok('listede olmayana oy verilmez', public.yapim_oyla('Uydurma') ->> 'durum' <> 'tamam');
select test.ok('oylar sayılır', (select oy = 1 from public.yapim_oy_sayilari where yapim = 'Delilik'));

-- takip
select test.ok('takip eder', public.takip_et('ayse'));
select test.ok('kendini takip edemez', public.takip_et('cem') is not true);
select test.ok('takip listesi', public.takip_ettiklerim() ? 'ayse');
select test.ok('takipçi sayısı', (select takipci = 1 from public.takip_sayilari where kullanici_adi = 'ayse'));

-- vitrin boyutu sınırlı
select test.ok('dev vitrin reddedilir', test.patlar($q$update public.profiller set vitrin = jsonb_build_object('alinti', repeat('x', 5000)) where id = auth.uid()$q$));

-- seviye, haftalık
select test.ok('seviye görünümü', (select count(*) >= 1 from public.arsivci_seviyeleri));
select test.ok('XP dökümü toplamı XP''ye eşit', (select bool_and(xp = (select sum(v::bigint) from jsonb_each_text(dokum) e(k, v))) from public.arsivci_seviyeleri));
select public.istatistik_gonder('{"okunan_kutu": 4}'::jsonb);
select test.ok('tam okunan kutu başına 10 XP', (select (dokum->>'okuma')::int = 40 from public.arsivci_seviyeleri where kullanici_adi = 'cem'));
reset role; update public.istatistikler set son_gonderim = null where id = '33333333-3333-3333-3333-333333333333'; set role authenticated;
select public.istatistik_gonder('{"okunan_kutu": 2}'::jsonb);
select test.ok('okunan kutu azalmaz', (select okunan_kutu = 4 from public.istatistikler where id = auth.uid()));
reset role; update public.istatistikler set son_gonderim = null where id = '33333333-3333-3333-3333-333333333333'; set role authenticated;
select public.istatistik_gonder('{"oyun_xp": 30}'::jsonb);
select test.ok('günlük oyun XP''si dökümde', (select (dokum->>'oyun')::int = 30 from public.arsivci_seviyeleri where kullanici_adi = 'cem'));
reset role; update public.istatistikler set son_gonderim = null where id = '33333333-3333-3333-3333-333333333333'; set role authenticated;
select public.istatistik_gonder('{"oyun_xp": 99999}'::jsonb);
select test.ok('oyun XP''si gün sayısıyla sınırlı, askıya almaz', (select oyun_xp = 80 and not askida from public.istatistikler where id = auth.uid()));
select test.ok('oy ve teori XP verir', (select (dokum->>'oy')::int = 15 from public.arsivci_seviyeleri where kullanici_adi = 'cem'));
select test.ok('Tömye basamağı formülü', (select bool_and(basamak >= 1 and 5 * (basamak - 1) * (basamak + 4) <= xp and 5 * basamak * (basamak + 5) > xp) from public.arsivci_seviyeleri));
select test.ok('haftalık ilerleme', public.haftalik_ilerleme() ? 'hafta');

-- ---------- yönetici ----------
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select test.ok('istatistik 14 gün', jsonb_array_length(public.site_istatistik() -> 'gunluk') = 14);
select test.ok('yönetici hataları okur', (select count(*) = 1 from public.hata_kayitlari));
select test.ok('yedek tabloları içerir', public.yedek_al() ? 'profiller');
select test.ok('yedekte e-posta yok', position('ornek.test' in public.yedek_al()::text) = 0);
select public.hata_temizle();
select test.ok('hatalar temizlenir', (select count(*) = 0 from public.hata_kayitlari));

-- ---------- sınırlı yönetici ----------
select test.ok('kullanıcı kendini yönetici yapamaz', test.patlar($q$update public.yoneticiler set duzey = 'tam'$q$));
reset role;
update public.yoneticiler set duzey = 'sinirli' where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select test.ok('sınırlı yönetici istatistik görür', jsonb_array_length(public.site_istatistik() -> 'gunluk') = 14);
select test.ok('sınırlı yönetici yedek alamaz', test.patlar('select public.yedek_al()'));
reset role;
select test.ok('geçersiz düzey reddedilir', test.patlar($q$update public.yoneticiler set duzey = 'kral'$q$));
update public.yoneticiler set duzey = 'tam' where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;

-- ---------- Kor'un Hıçkırığı ve arşiv avı ----------
reset role;
delete from public.hickirik_olaylari;
insert into public.hickirik_olaylari (gun, bas) values ((now() at time zone 'Europe/Istanbul')::date, now() - interval '1 minute');
set role anon;
select test.ok('hıçkırık zamanı okunamaz', test.patlar('select * from public.hickirik_olaylari'));
select test.ok('hıçkırık açık görünür', (public.hickirik_durum() ->> 'aktif')::boolean);
select test.ok('anonim tanık olamaz', test.patlar('select public.hickirik_tanik()'));
reset role; set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.ok('tanıklık kaydedilir', public.hickirik_tanik() ->> 'durum' = 'tamam');
select test.ok('tanıklık günde bir', (public.hickirik_tanik() ->> 'toplam')::int = 1);
reset role;
update public.hickirik_olaylari set bas = now() - interval '10 minutes';
set role authenticated;
select test.ok('geç kalan tanık olamaz', public.hickirik_tanik() ->> 'durum' = 'gec');
select test.ok('pencere kapanır', not (public.hickirik_durum() ->> 'aktif')::boolean);
select test.ok('av: yanlış cevap', public.av_coz(1, 'yanlis') ->> 'durum' = 'yanlis');
select test.ok('av: doğru cevap (Türkçe harf ve boşluk farkı önemsiz)', public.av_coz(1, ' Kayıt ') ->> 'durum' = 'tamam');
select test.ok('av: ikinci kez sayılmaz', public.av_coz(1, 'kayit') ->> 'durum' = 'zaten');
select test.ok('av özeti okunamaz', test.patlar('select * from public.av_sezonlari'));
select test.ok('çözenler listesi', (select count(*) = 1 from public.av_cozenler where kullanici_adi = 'cem'));
select test.ok('hıçkırık ve av XP verir', (select (dokum->>'hickirik')::int = 20 and (dokum->>'av')::int = 100 from public.arsivci_seviyeleri where kullanici_adi = 'cem'));

-- ---------- tepkiler ve kenar notları ----------
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.ok('tepki verilir', public.tepki_ver('roman:1', 'kalp'));
select test.ok('tepki geri alınır', not public.tepki_ver('roman:1', 'kalp'));
select public.tepki_ver('roman:1', 'buz');
select test.ok('tepki sayısı görünür', (select sayi = 1 from public.tepki_sayilari where hedef = 'roman:1' and tepki = 'buz'));
select test.ok('tanımsız tepki reddedilir', test.patlar($q$select public.tepki_ver('roman:1', 'kotu')$q$));
select test.ok('bozuk hedef reddedilir', test.patlar($q$select public.tepki_ver('<script>', 'buz')$q$));
select test.ok('kenar notu yazılır', public.kenar_not_yaz('roman:1', 'Bu bölümdeki sessizlik çok güzel.') ->> 'durum' = 'tamam');
select id as not_no from public.kenar_notlari_listesi where benim limit 1 \gset
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.kenar_not_bildir(:not_no);
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.kenar_not_bildir(:not_no);
select test.ok('iki bildirimle görünür kalır', (select count(*) = 1 from public.kenar_notlari_listesi where id = :not_no));
reset role;
insert into auth.users (id, email, raw_user_meta_data) values ('55555555-5555-5555-5555-555555555555', 'e@ornek.test', '{"kullanici_adi":"ece"}');
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.kenar_not_bildir(:not_no);
select test.ok('üç bildirimle not gizlenir', (select count(*) = 0 from public.kenar_notlari_listesi where id = :not_no));
select public.kenar_not_sil(:not_no);
reset role;
select test.ok('başkasının notunu silemez', (select count(*) = 1 from public.kenar_notlari where id = :not_no));
set role authenticated;

-- ---------- Topluluk II ----------
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.ok('defter cümlesi', public.defter_yaz('Kütüphanenin ışıkları bir anda söndü.') ->> 'durum' = 'tamam');
select test.ok('defter günde bir', public.defter_yaz('İkinci cümle bugün yazılamaz.') ->> 'durum' = 'bugun');
select id as cumle_no from public.defter_listesi where benim limit 1 \gset
select test.ok('kendi cümlesini beğenemez', not public.defter_oyla(:cumle_no));
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select test.ok('başkası beğenir', public.defter_oyla(:cumle_no));
select test.ok('soru sorulur', public.yazara_sor('Tarı neden hiç kendi adını duymuyor?') ->> 'durum' = 'tamam');
select id as soru_no from public.yazara_sorular where benim limit 1 \gset
select test.ok('yönetici olmayan cevaplayamaz', test.patlar('select public.yazar_cevapla(' || :soru_no || $q$, 'x')$q$));
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.yazar_cevapla(:soru_no, 'Çünkü adı kendisinden önce gelir.');
select test.ok('cevap görünür', (select cevap is not null from public.yazara_sorular where id = :soru_no));
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.yazar_soru_sil(:soru_no);
select test.ok('cevaplanmış soruyu soran silemez', (select count(*) = 1 from public.yazara_sorular where id = :soru_no));
select test.ok('kulüpsüz yazamaz', public.kulup_yaz('merhaba') ->> 'durum' = 'kulupsuz');
reset role;
insert into public.istatistikler (id, kisilik) values ('44444444-4444-4444-4444-444444444444', 'Aksiyon Delisi')
  on conflict (id) do update set kisilik = excluded.kisilik;
set role authenticated;
select test.ok('kulübüne yazar', public.kulup_yaz('Bu hafta hedefi geçelim!') ->> 'kulup' = 'Aksiyon Delisi');
select test.ok('kulüp duvarı görünür', (select count(*) = 1 from public.kulup_duvari where kisilik = 'Aksiyon Delisi'));
select test.ok('kulüp haftası', (select hedef = 60 from public.kulup_haftasi where kisilik = 'Aksiyon Delisi'));
select test.ok('isim bulmacası yazılır', public.okur_bulmaca_yaz('isim', 'dünya', 'gezegen') ->> 'durum' = 'tamam');
select test.ok('isim bulmacası: soru harf çevirisi', (select soru = 'Tömye' from public.okur_bulmaca_listesi where benim));
select test.ok('geçersiz cevap reddedilir', public.okur_bulmaca_yaz('kyldo', 'iki kelime', null) ->> 'durum' = 'kelime');
select id as ob_no from public.okur_bulmaca_listesi where benim limit 1 \gset
select test.ok('kendi bulmacasını çözemez', public.okur_bulmaca_coz(:ob_no, 'dünya') ->> 'durum' = 'kendi');
select test.ok('cevap özeti okunamaz', test.patlar('select cevap_ozet from public.okur_bulmacalari'));
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.ok('yanlış çözüm', public.okur_bulmaca_coz(:ob_no, 'tömye') ->> 'durum' = 'yanlis');
select test.ok('doğru çözüm (büyük harf/Türkçe fark etmez)', public.okur_bulmaca_coz(:ob_no, 'DÜNYA') ->> 'durum' = 'tamam');
select test.ok('davet: kendini davet edemez', public.davet_kaydet('cem') ->> 'durum' = 'yok');
select test.ok('davet kaydedilir', public.davet_kaydet('deniz') ->> 'durum' = 'tamam');
select test.ok('davet bir kez', public.davet_kaydet('deniz') ->> 'durum' = 'zaten');
reset role;
insert into public.istatistikler (id, gun) values ('33333333-3333-3333-3333-333333333333', 3)
  on conflict (id) do update set gun = 3;
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select test.ok('rehber: tamamlayan davetli sayılır', (public.davet_durumum() ->> 'tamamlayan')::int = 1);
select test.ok('rehber XP', (select (dokum->>'davet')::int = 50 from public.arsivci_seviyeleri where kullanici_adi = 'deniz'));

-- ---------- bildirim abonelikleri ----------
reset role;
set role anon;
select test.ok('anonim abone olur', public.bildirim_abone_ol('https://fcm.googleapis.com/fcm/send/abc123', repeat('B', 87), repeat('a', 22)) ->> 'durum' = 'tamam');
select test.ok('aynı abonelik tekrar yazılabilir', public.bildirim_abone_ol('https://fcm.googleapis.com/fcm/send/abc123', repeat('C', 87), repeat('a', 22)) ->> 'durum' = 'tamam');
select test.ok('bilinmeyen sunucuya abonelik reddedilir', public.bildirim_abone_ol('https://kotu.ornek/fcm', repeat('B', 87), repeat('a', 22)) ->> 'durum' = 'gecersiz');
select test.ok('iç ağ adresi reddedilir', public.bildirim_abone_ol('https://fcm.googleapis.com.kotu.ornek/x', repeat('B', 87), repeat('a', 22)) ->> 'durum' = 'gecersiz');
select test.ok('bozuk anahtar reddedilir', public.bildirim_abone_ol('https://fcm.googleapis.com/fcm/send/x', 'kisa<', 'a') ->> 'durum' = 'gecersiz');
select test.ok('anonim abonelikleri okuyamaz', test.patlar('select * from public.bildirim_abonelikleri'));
select test.ok('anonim abone sayısını göremez', test.patlar('select public.bildirim_sayisi()'));
reset role;
select test.ok('abonelik tek satır, anahtar güncel', (select count(*) = 1 and min(p256dh) = repeat('C', 87) from public.bildirim_abonelikleri));
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.ok('yönetici olmayan sayıyı göremez', test.patlar('select public.bildirim_sayisi()'));
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select test.ok('yönetici abone sayısını görür', public.bildirim_sayisi() = 1);
set role anon;
select test.ok('abonelik silinir', (public.bildirim_abonelik_sil('https://fcm.googleapis.com/fcm/send/abc123') ->> 'silinen')::int = 1);
reset role;
set role authenticated;

-- ---------- ziyaret sayacı ----------
reset role;
set role anon;
select public.olay_say('giris:arsiv');
select public.olay_say('giris:arsiv');
select public.olay_say('Kötü Ad!');
select test.ok('anonim sayamaz okuyamaz', test.patlar('select * from public.olay_sayaclari'));
select test.ok('anonim sayıları göremez', test.patlar('select * from public.olay_sayilari(14)'));
reset role;
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.ok('yönetici olmayan sayıları göremez', test.patlar('select * from public.olay_sayilari(14)'));
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select test.ok('sayaç artar, geçersiz ad sayılmaz', (select count(*) = 1 and max(sayi) = 2 from public.olay_sayilari(14)));
reset role;
set role authenticated;

-- ---------- günün kelimesi istatistiği ----------
reset role;
insert into public.gk_tahminler (kullanici, gun, tahminler, cozuldu) values
  ('33333333-3333-3333-3333-333333333333', (now() at time zone 'utc')::date - 3, '{aaaa,bbbb,cccc}', true),
  ('33333333-3333-3333-3333-333333333333', (now() at time zone 'utc')::date - 2, '{aaaa,bbbb}', true),
  ('33333333-3333-3333-3333-333333333333', (now() at time zone 'utc')::date - 1, '{a,b,c,d,e,f}', false),
  ('33333333-3333-3333-3333-333333333333', (now() at time zone 'utc')::date, '{aaaa}', false);
set role anon;
select test.ok('anonim kelime istatistiğini çağıramaz', test.patlar('select public.gk_istatistik()'));
reset role;
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.ok('kelime istatistiği: oynanan, bulunan, en uzun seri, dağılım',
  (select (i ->> 'oynanan')::int = 3 and (i ->> 'cozulen')::int = 2 and (i ->> 'en_uzun')::int = 2
     and (i -> 'dagilim') = '[0,1,1,0,0,0]'::jsonb and (i ->> 'seri')::int = 0 from (select public.gk_istatistik() i) x));

-- ---------- evren ziyaretçi defteri ----------
select test.ok('deftere not yazılır', public.evren_defter_yaz('e25', 'Buraya ilk ben uğradım.') ->> 'durum' = 'tamam');
select test.ok('geçersiz evren adı reddedilir', public.evren_defter_yaz('../x', 'merhaba') ->> 'durum' = 'gecersiz');
select test.ok('çok uzun not reddedilir', public.evren_defter_yaz('e25', repeat('a', 281)) ->> 'durum' = 'uzunluk');
select test.ok('yazan kendi bekleyen notunu görür', (select jsonb_array_length(d) = 1 and (d -> 0 ->> 'bekliyor')::boolean from (select public.evren_defter_oku('e25') d) x));
select test.ok('tablo doğrudan okunamaz', test.patlar('select * from public.evren_defteri'));
select test.ok('yönetici olmayan onaylayamaz', test.patlar('select public.evren_defter_karar(1, true)'));
select test.ok('yönetici olmayan bekleyenleri göremez', test.patlar('select public.evren_defter_bekleyenler()'));
select test.ok('yönetici olmayan hafta özetini göremez', test.patlar('select public.hafta_ozeti()'));
select public.evren_defter_yaz('e25', 'iki'), public.evren_defter_yaz('e25', 'üç'), public.evren_defter_yaz('e25', 'dört'), public.evren_defter_yaz('e25', 'beş');
select test.ok('günde beş nottan fazlası yazılamaz', public.evren_defter_yaz('e25', 'altı') ->> 'durum' = 'sinir');
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select test.ok('başkası onaysız notu görmez', jsonb_array_length(public.evren_defter_oku('e25')) = 0);
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select test.ok('yönetici bekleyenleri görür', jsonb_array_length(public.evren_defter_bekleyenler()) = 5);
select test.ok('hafta özeti: kayıt ve bekleyen not', (select (h ->> 'kayit')::int >= 4 and (h ->> 'defter_bekleyen')::int = 5 from (select public.hafta_ozeti() h) x));
select public.evren_defter_karar((select min((x ->> 'id')::bigint) from jsonb_array_elements(public.evren_defter_bekleyenler()) x), true);
select public.evren_defter_karar((select max((x ->> 'id')::bigint) from jsonb_array_elements(public.evren_defter_bekleyenler()) x), false);
reset role;
set role anon;
select test.ok('onaylanan not herkese görünür', (select jsonb_array_length(d) = 1 and d -> 0 ->> 'kullanici_adi' = 'cem' and not (d -> 0 ->> 'bekliyor')::boolean from (select public.evren_defter_oku('e25') d) x));
select test.ok('anonim deftere yazamaz', test.patlar($q$select public.evren_defter_yaz('e25', 'merhaba')$q$));
reset role;
select test.ok('reddedilen not silinir', (select count(*) = 4 from public.evren_defteri));
select min(id) as onayli_not from public.evren_defteri where onayli \gset
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.evren_defter_sil(:onayli_not);
reset role;
select test.ok('başkasının notu silinemez', (select count(*) = 1 from public.evren_defteri where onayli));
set role authenticated;

-- ---------- E99: sunucu aracı yok ----------
select test.ok('E99 sunucu fonksiyonu yok', not exists (select 1 from pg_proc where proname like 'e99%'));

-- ---------- hesap silme ----------
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.hesabimi_sil();
reset role;
select test.ok('hesap silinince her şeyi gider',
  (select count(*) = 0 from auth.users where id = '22222222-2222-2222-2222-222222222222')
  and (select count(*) = 0 from public.profiller where kullanici_adi = 'ayse')
  and (select count(*) = 0 from public.ilerlemeler where id = '22222222-2222-2222-2222-222222222222')
  and (select count(*) = 0 from public.teoriler)
  and (select count(*) = 0 from public.takipler where takip_edilen = '22222222-2222-2222-2222-222222222222'));

-- yarış XP'si: günde yalnızca ilk 3 geçerli (puanlı) oyun
reset role;
select (dokum->>'yaris')::int as yaris_once from public.arsivci_seviyeleri where kullanici_adi = 'deniz' \gset
insert into public.yaris_skorlari (kullanici, yaris, puan, dogru, sure_ms, hafta, sezon)
  select '44444444-4444-4444-4444-444444444444', 'alinti', p, p, 30000, current_date, public.tomye_ay(now())
  from (values (0), (0), (3), (4), (5), (6), (7)) v(p);
select test.ok('yarış XP''si günde ilk 3 puanlı oyun', (select (dokum->>'yaris')::int - :yaris_once <= 30 and (dokum->>'yaris')::int >= 30
  from public.arsivci_seviyeleri where kullanici_adi = 'deniz'));
