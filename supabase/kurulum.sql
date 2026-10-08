-- TentiforApp hesap sistemi — Supabase kurulumu
-- Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını yapıştır → Run.
-- Birden fazla kez çalıştırmak güvenlidir; önceki kurulumu bu yapıya getirir.

-- ============ PROFİLLER (herkese açık) ============
-- Burada yalnızca başkalarının görmesinde sakınca olmayan bilgiler durur.
create table if not exists public.profiller (
  id uuid primary key references auth.users(id) on delete cascade,
  kullanici_adi text unique check (kullanici_adi ~ '^[a-z0-9_]{3,20}$'),
  gorunen_ad text check (char_length(gorunen_ad) <= 40),
  gorsel text,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);

alter table public.profiller add column if not exists hakkinda text check (char_length(hakkinda) <= 280);
alter table public.profiller add column if not exists tentifor_adi text check (char_length(tentifor_adi) <= 40);
-- Sitenin kendisinin yazdığı özet: rol, kişilik, tamlık, madalyalar
alter table public.profiller add column if not exists ozet jsonb not null default '{}'::jsonb;
-- İlerleme artık ayrı ve gizli tabloda (aşağıda); profilde durmaz
alter table public.profiller drop column if exists ilerleme;

alter table public.profiller enable row level security;

drop policy if exists "kendi profilini okur" on public.profiller;
drop policy if exists "profiller herkese açık" on public.profiller;
drop policy if exists "kendi profilini ekler" on public.profiller;
drop policy if exists "kendi profilini günceller" on public.profiller;

create policy "profiller herkese açık" on public.profiller
  for select using (true);
create policy "kendi profilini ekler" on public.profiller
  for insert with check (auth.uid() = id);
create policy "kendi profilini günceller" on public.profiller
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.profiller_sunucu_alanlarini_koru() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() = old.id and not public.tam_yonetici_mi() then
    new.ozet := old.ozet;
  end if;
  return new;
end;
$$;
drop trigger if exists profiller_sunucu_alanlari on public.profiller;
create trigger profiller_sunucu_alanlari before update on public.profiller
for each row execute function public.profiller_sunucu_alanlarini_koru();

-- Public profil sözleşmesi: istemci public_profiller view'ını kullanır.
create or replace view public.public_profiller as
select id, kullanici_adi, gorunen_ad, gorsel, tentifor_adi, hakkinda, vitrin, olusturma, guncelleme
from public.profiller;
grant select on public.public_profiller to anon, authenticated;
-- ============ İLERLEME (yalnızca sahibi) ============
-- Eçka, çözülen kodlar, madalyalar, defter... Başka kimse okuyamaz.
create table if not exists public.ilerlemeler (
  id uuid primary key references auth.users(id) on delete cascade,
  veri jsonb not null default '{}'::jsonb,
  guncelleme timestamptz not null default now()
);

alter table public.ilerlemeler enable row level security;

drop policy if exists "kendi ilerlemesini okur" on public.ilerlemeler;
drop policy if exists "kendi ilerlemesini ekler" on public.ilerlemeler;
drop policy if exists "kendi ilerlemesini günceller" on public.ilerlemeler;

create policy "kendi ilerlemesini okur" on public.ilerlemeler
  for select using (auth.uid() = id);
create policy "kendi ilerlemesini ekler" on public.ilerlemeler
  for insert with check (auth.uid() = id);
create policy "kendi ilerlemesini günceller" on public.ilerlemeler
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ============ KAYIT OLUNCA PROFİL OLUŞSUN ============
create or replace function public.yeni_kullanici() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiller (id, kullanici_adi, gorunen_ad)
  values (
    new.id,
    nullif(lower(new.raw_user_meta_data->>'kullanici_adi'), ''),
    nullif(new.raw_user_meta_data->>'gorunen_ad', '')
  );
  return new;
end;
$$;

drop trigger if exists kullanici_olusunca on auth.users;
create trigger kullanici_olusunca
  after insert on auth.users
  for each row execute procedure public.yeni_kullanici();

-- ======================================================================
-- ============ LİDERLİK TABLOLARI ======================================
-- ======================================================================
-- İlke: istemcinin gönderdiği hiçbir sayıya körü körüne güvenilmez.
--  * İstatistikler yalnızca istatistik_gonder() ile yazılır; tabloya doğrudan
--    yazma izni yoktur.
--  * Tamlık, haftalık ve Tömye ayı puanları, zaman damgaları sunucuda hesaplanır.
--  * Her değerin üst sınırı vardır; artış hızı geçen süreyle karşılaştırılır.
--  * Kurala uymayan kayıt otomatik olarak askıya alınır (tablolarda görünmez)
--    ve yöneticinin incelemesine düşer. Üç ayrı kişiden bildirim gelen kayıt da.
--  * Sıklık sınırı: 20 saniyede bir gönderim; günde en çok 10 bildirim.

-- ---------- ayarlar (yönetici SQL ile değiştirebilir) ----------
create table if not exists public.liderlik_ayar (
  id int primary key default 1 check (id = 1),
  karakter int not null default 25,     -- karakter sayısı
  katman int not null default 7,        -- buz katmanı sayısı
  oyun int not null default 6,          -- bitirilebilir oyun sayısı
  galeri int not null default 7,        -- galeri kartı sayısı
  madalya int not null default 9,       -- madalya sayısı
  gunluk_ecka int not null default 5000,-- bir günde kazanılabilecek makul en çok eçka
  baslangic date not null default '2026-08-01'   -- sitenin açıldığı gün (gün sayısı bundan büyük olamaz)
);
insert into public.liderlik_ayar (id) values (1) on conflict (id) do nothing;
alter table public.liderlik_ayar enable row level security;
drop policy if exists "ayar herkese açık" on public.liderlik_ayar;
create policy "ayar herkese açık" on public.liderlik_ayar for select using (true);

-- ---------- yöneticiler ----------
-- Kendini eklemek için (kendi e-postanla):
--   insert into public.yoneticiler (id) select id from auth.users where email = 'SENIN@EPOSTAN';
create table if not exists public.yoneticiler (id uuid primary key references auth.users(id) on delete cascade);
alter table public.yoneticiler enable row level security;

create or replace function public.yonetici_mi() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.yoneticiler where id = auth.uid());
$$;

-- İki düzey: 'tam' (her şey) ve 'sinirli' (denetim ve istatistik var; yedek yok).
-- Sınırlı yönetici eklemek: insert into public.yoneticiler (id, duzey) select id, 'sinirli' from auth.users where email = '...';
alter table public.yoneticiler add column if not exists duzey text not null default 'tam';
do $$ begin
  alter table public.yoneticiler add constraint yoneticiler_duzey check (duzey in ('tam', 'sinirli'));
exception when duplicate_object then null; end $$;

create or replace function public.tam_yonetici_mi() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.yoneticiler where id = auth.uid() and duzey = 'tam');
$$;

-- 2.5: sınırlı yöneticinin yetkileri (panel sekmeleri). NULL: bütün sınırlı yetkiler (eski davranış).
-- Tek kodla verilen yöneticilikte kod üretilirken seçilir; elle eklenen sınırlı yönetici için:
--   update public.yoneticiler set yetkiler = array['hatalar','teoriler'] where id = '...';
alter table public.yoneticiler add column if not exists yetkiler text[];
create or replace function public.yonetici_yetki(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.yoneticiler where id = auth.uid()
    and (duzey = 'tam' or yetkiler is null or p = any(yetkiler)));
$$;

-- ---------- istatistikler (yalnızca sahibi ve yönetici okur; herkes görünüm üzerinden) ----------
create table if not exists public.istatistikler (
  id uuid primary key references auth.users(id) on delete cascade,
  okunan_karakter int not null default 0,
  katman int not null default 0,
  oyun int not null default 0,
  galeri int not null default 0,
  gun int not null default 0,
  seri int not null default 0,
  madalya int not null default 0,
  ecka_toplam int not null default 0,
  nobet int not null default 0,
  cevirmen int not null default 0,
  vardiya int not null default 0,
  yazi int not null default 0,
  boyut int not null default 0,
  baloncuk int not null default 0,
  tamlik int not null default 0,
  rol text,
  kisilik text,
  hafta date,                       -- haftalık puanın başladığı pazartesi (UTC)
  hafta_taban int not null default 0,
  sezon int,                        -- Tömye yılı*100 + ay
  sezon_taban int not null default 0,
  gizli boolean not null default false,     -- kullanıcı tablolarda görünmek istemiyor
  askida boolean not null default false,    -- otomatik kontrol ya da bildirim: inceleme bekliyor
  askida_neden text,
  engelli boolean not null default false,   -- yönetici tablodan çıkardı
  son_gonderim timestamptz,
  guncelleme timestamptz not null default now(),
  olusturma timestamptz not null default now()
);
-- tam okunan kutular (okuma süresi dolmuş kayıt, madde, mektup…): kutu başına 10 XP (her kutu bir kez)
alter table public.istatistikler add column if not exists okunan_kutu int not null default 0;
-- günlük oyunlardan XP (kazanılan oyun başına 10, günde en çok 80; bütün evrenler)
alter table public.istatistikler add column if not exists oyun_xp int not null default 0;
alter table public.istatistikler enable row level security;
drop policy if exists "kendi istatistiğini okur" on public.istatistikler;
create policy "kendi istatistiğini okur" on public.istatistikler
  for select using (auth.uid() = id or public.yonetici_mi());

-- şüpheli gönderimlerin kaydı (yalnız yönetici okur)
create table if not exists public.liderlik_suphe (
  no bigserial primary key,
  id uuid not null references auth.users(id) on delete cascade,
  zaman timestamptz not null default now(),
  neden text not null,
  veri jsonb
);
alter table public.liderlik_suphe enable row level security;
drop policy if exists "yönetici şüpheleri okur" on public.liderlik_suphe;
create policy "yönetici şüpheleri okur" on public.liderlik_suphe for select using (public.yonetici_yetki('liderlik'));

-- kullanıcı bildirimleri
create table if not exists public.bildirimler (
  no bigserial primary key,
  bildiren uuid not null references auth.users(id) on delete cascade,
  hedef uuid not null references auth.users(id) on delete cascade,
  neden text check (char_length(neden) <= 200),
  zaman timestamptz not null default now(),
  incelendi boolean not null default false,
  unique (bildiren, hedef)
);
alter table public.bildirimler enable row level security;
drop policy if exists "yönetici bildirimleri okur" on public.bildirimler;
create policy "yönetici bildirimleri okur" on public.bildirimler for select using (public.yonetici_yetki('liderlik'));

-- günün bulmacası: çözüş zamanı sunucudan
create table if not exists public.bulmaca_cozumleri (
  id uuid not null references auth.users(id) on delete cascade,
  gun date not null,
  zaman timestamptz not null default now(),
  primary key (id, gun)
);
alter table public.bulmaca_cozumleri enable row level security;

-- ---------- Tömye takvimi: yıl*100 + ay (sitenin takvimiyle aynı hesap) ----------
create or replace function public.tomye_ay(t timestamptz default now()) returns int
language plpgsql immutable set search_path = '' as $$
declare
  aylar int[] := array[28,28,28,29,28,28,29,28,28,28,28];  -- Leg … Dezeh, toplam 310
  saat double precision := extract(epoch from (t - timestamptz '2000-01-01 00:00:00+00')) / 3600.0;
  gun int := floor(saat / 25);
  yil int := floor(gun / 310) + 1;
  kalan int := gun % 310;
  ay int := 1;
begin
  if saat < 0 then return 0; end if;
  while kalan >= aylar[ay] loop
    kalan := kalan - aylar[ay];
    ay := ay + 1;
  end loop;
  return yil * 100 + ay;
end;
$$;

-- ---------- istatistik gönderimi ----------
create or replace function public.istatistik_gonder(g jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  a public.liderlik_ayar;
  o public.istatistikler;
  yeni boolean;
  sure_gun double precision;
  sebepler text[] := '{}';
  v record;
  bu_hafta date := date_trunc('week', now() at time zone 'utc')::date;
  bu_sezon int := public.tomye_ay(now());
  site_gun int;
  n_okunan int; n_katman int; n_oyun int; n_galeri int; n_gun int; n_seri int; n_madalya int;
  n_ecka int; n_nobet int; n_cevirmen int; n_vardiya int; n_yazi int; n_boyut int; n_baloncuk int;
  n_tamlik int; n_kutu int; n_oyun_xp int;
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  -- aynı kullanıcının eşzamanlı gönderimleri sıraya girsin (ilk kayıt iki kez yazılmasın)
  perform pg_advisory_xact_lock(hashtext('istatistik:' || uid::text));
  select * into a from public.liderlik_ayar where id = 1;
  select * into o from public.istatistikler where id = uid for update;
  yeni := not found;

  -- sıklık sınırı
  if not yeni and o.son_gonderim is not null and o.son_gonderim > now() - interval '20 seconds' then
    return jsonb_build_object('durum', 'erken');
  end if;

  -- sayıya çevir; bozuk ya da negatif değer 0 sayılır
  select
    greatest(coalesce((g->>'okunan_karakter')::int, 0), 0), greatest(coalesce((g->>'katman')::int, 0), 0),
    greatest(coalesce((g->>'oyun')::int, 0), 0),            greatest(coalesce((g->>'galeri')::int, 0), 0),
    greatest(coalesce((g->>'gun')::int, 0), 0),             greatest(coalesce((g->>'seri')::int, 0), 0),
    greatest(coalesce((g->>'madalya')::int, 0), 0),         greatest(coalesce((g->>'ecka_toplam')::int, 0), 0),
    greatest(coalesce((g->>'nobet')::int, 0), 0),           greatest(coalesce((g->>'cevirmen')::int, 0), 0),
    greatest(coalesce((g->>'vardiya')::int, 0), 0),         greatest(coalesce((g->>'yazi')::int, 0), 0),
    greatest(coalesce((g->>'boyut')::int, 0), 0),           greatest(coalesce((g->>'baloncuk')::int, 0), 0)
  into n_okunan, n_katman, n_oyun, n_galeri, n_gun, n_seri, n_madalya,
       n_ecka, n_nobet, n_cevirmen, n_vardiya, n_yazi, n_boyut, n_baloncuk;

  n_kutu := greatest(coalesce((g->>'okunan_kutu')::int, 0), 0);
  n_oyun_xp := greatest(coalesce((g->>'oyun_xp')::int, 0), 0);

  -- 1) mutlak sınırlar: aşan değer imkânsızdır → sınıra çekilir ve kayıt askıya alınır
  if n_kutu > 1500 then sebepler := array_append(sebepler, 'okunan kutu > 1500'); n_kutu := 1500; end if;
  site_gun := (current_date - a.baslangic) + 1;
  if n_okunan > a.karakter then sebepler := array_append(sebepler, 'okunan karakter > karakter sayısı'); n_okunan := a.karakter; end if;
  if n_katman > a.katman then sebepler := array_append(sebepler, 'katman > katman sayısı'); n_katman := a.katman; end if;
  if n_oyun > a.oyun then sebepler := array_append(sebepler, 'oyun > oyun sayısı'); n_oyun := a.oyun; end if;
  if n_galeri > a.galeri then sebepler := array_append(sebepler, 'galeri > kart sayısı'); n_galeri := a.galeri; end if;
  if n_madalya > a.madalya then sebepler := array_append(sebepler, 'madalya > madalya sayısı'); n_madalya := a.madalya; end if;
  if n_gun > site_gun then sebepler := array_append(sebepler, 'gün > sitenin yaşı'); n_gun := site_gun; end if;
  if n_seri > n_gun then sebepler := array_append(sebepler, 'seri > gün'); n_seri := n_gun; end if;
  -- oyun XP'si gelinen günle sınırlı (günde en çok 80; cihaz saati farkı için bir gün pay). Askıya almaz, yalnızca kırpar.
  n_oyun_xp := least(n_oyun_xp, 80 * (n_gun + 1));
  if n_cevirmen > 8 then sebepler := array_append(sebepler, 'çevirmen > 8'); n_cevirmen := 8; end if;
  if n_vardiya > 10 then sebepler := array_append(sebepler, 'vardiya > 10'); n_vardiya := 10; end if;
  if n_yazi > 6 then sebepler := array_append(sebepler, 'yazı > 6'); n_yazi := 6; end if;
  if n_boyut > 3 then sebepler := array_append(sebepler, 'boyut > 3'); n_boyut := 3; end if;
  if n_baloncuk > 200 then sebepler := array_append(sebepler, 'baloncuk > 200'); n_baloncuk := 200; end if;
  if n_nobet > 10000 then sebepler := array_append(sebepler, 'nöbet > 10000'); n_nobet := 10000; end if;

  -- 2) artış hızı: geçen süreye göre makul mü?
  if yeni then
    -- ilk gönderim: cihazdaki eski ilerleme gelebilir ama oynanan gün sayısıyla orantılı olmalı
    if n_ecka > a.gunluk_ecka * greatest(n_gun, 1) then
      sebepler := array_append(sebepler, 'ilk gönderimde eçka gün sayısına göre çok yüksek');
    end if;
  else
    sure_gun := greatest(extract(epoch from (now() - o.guncelleme)) / 86400.0, 0);
    if n_gun > o.gun + ceil(sure_gun) + 1 then sebepler := array_append(sebepler, 'gün sayısı süreden hızlı arttı'); end if;
    if n_seri > o.seri + ceil(sure_gun) + 1 then sebepler := array_append(sebepler, 'seri süreden hızlı arttı'); end if;
    if n_ecka - o.ecka_toplam > a.gunluk_ecka * sure_gun + 1000 then
      sebepler := array_append(sebepler, 'eçka süreden hızlı arttı');
    end if;
  end if;

  -- 3) rekorlar ve sayaçlar geri düşmez (düşürmek için istatistik_sifirla)
  if not yeni then
    n_okunan := greatest(n_okunan, o.okunan_karakter); n_katman := greatest(n_katman, o.katman);
    n_oyun := greatest(n_oyun, o.oyun);                n_galeri := greatest(n_galeri, o.galeri);
    n_gun := greatest(n_gun, o.gun);                   n_madalya := greatest(n_madalya, o.madalya);
    n_ecka := greatest(n_ecka, o.ecka_toplam);         n_nobet := greatest(n_nobet, o.nobet);
    n_cevirmen := greatest(n_cevirmen, o.cevirmen);    n_vardiya := greatest(n_vardiya, o.vardiya);
    n_yazi := greatest(n_yazi, o.yazi);                n_boyut := greatest(n_boyut, o.boyut);
    n_baloncuk := greatest(n_baloncuk, o.baloncuk);
    n_kutu := greatest(n_kutu, o.okunan_kutu);
    n_oyun_xp := greatest(n_oyun_xp, o.oyun_xp);
  end if;

  -- 4) tamlık sunucuda hesaplanır (sitedeki formülün aynısı)
  n_tamlik := round(100.0 * (
      3 * n_okunan::numeric / greatest(a.karakter, 1)
    + 3 * n_katman::numeric / greatest(a.katman, 1)
    + 2 * n_oyun::numeric / greatest(a.oyun, 1)
    + 1 * n_galeri::numeric / greatest(a.galeri, 1)
    + 1 * least(1.0, n_gun / 14.0)) / 10.0);

  insert into public.istatistikler as i (
    id, okunan_karakter, katman, oyun, galeri, gun, seri, madalya, ecka_toplam,
    nobet, cevirmen, vardiya, yazi, boyut, baloncuk, tamlik, okunan_kutu, oyun_xp, rol, kisilik,
    hafta, hafta_taban, sezon, sezon_taban, askida, askida_neden, son_gonderim, guncelleme)
  values (
    uid, n_okunan, n_katman, n_oyun, n_galeri, n_gun, n_seri, n_madalya, n_ecka,
    n_nobet, n_cevirmen, n_vardiya, n_yazi, n_boyut, n_baloncuk, n_tamlik, n_kutu, n_oyun_xp,
    left(g->>'rol', 40), left(g->>'kisilik', 40),
    -- ilk gönderimde haftalık/aylık puan sıfırdan başlar (eski ilerleme bu haftaya yazılmaz)
    bu_hafta, n_ecka, bu_sezon, n_ecka,
    cardinality(sebepler) > 0, nullif(array_to_string(sebepler, '; '), ''), now(), now())
  on conflict (id) do update set
    okunan_karakter = excluded.okunan_karakter, katman = excluded.katman, oyun = excluded.oyun,
    galeri = excluded.galeri, gun = excluded.gun, seri = excluded.seri, madalya = excluded.madalya,
    ecka_toplam = excluded.ecka_toplam, nobet = excluded.nobet, cevirmen = excluded.cevirmen,
    vardiya = excluded.vardiya, yazi = excluded.yazi, boyut = excluded.boyut, baloncuk = excluded.baloncuk,
    tamlik = excluded.tamlik, okunan_kutu = excluded.okunan_kutu, oyun_xp = excluded.oyun_xp, rol = excluded.rol, kisilik = excluded.kisilik,
    -- yeni hafta/ay başladıysa taban, önceki toplam olur
    hafta_taban = case when i.hafta is distinct from bu_hafta then i.ecka_toplam else i.hafta_taban end,
    hafta = bu_hafta,
    sezon_taban = case when i.sezon is distinct from bu_sezon then i.ecka_toplam else i.sezon_taban end,
    sezon = bu_sezon,
    askida = i.askida or cardinality(sebepler) > 0,
    askida_neden = case when cardinality(sebepler) > 0
                        then left(coalesce(i.askida_neden || '; ', '') || array_to_string(sebepler, '; '), 500)
                        else i.askida_neden end,
    son_gonderim = now(), guncelleme = now();

  if cardinality(sebepler) > 0 then
    insert into public.liderlik_suphe (id, neden, veri) values (uid, array_to_string(sebepler, '; '), g);
    return jsonb_build_object('durum', 'askida', 'sebepler', to_jsonb(sebepler));
  end if;
  return jsonb_build_object('durum', 'tamam', 'tamlik', n_tamlik);
end;
$$;

-- tam sıfırlama: sayaçlar sıfırlanır (askı ve engel durumu korunur)
create or replace function public.istatistik_sifirla() returns void
language sql security definer set search_path = '' as $$
  update public.istatistikler set
    okunan_karakter = 0, katman = 0, oyun = 0, galeri = 0, gun = 0, seri = 0, madalya = 0, ecka_toplam = 0,
    nobet = 0, cevirmen = 0, vardiya = 0, yazi = 0, boyut = 0, baloncuk = 0, tamlik = 0,
    hafta_taban = 0, sezon_taban = 0, guncelleme = now()
  where id = auth.uid();
$$;

-- tablolarda görünmek istemiyorum
create or replace function public.liderlik_gorunurluk(gizle boolean) returns void
language sql security definer set search_path = '' as $$
  update public.istatistikler set gizli = gizle where id = auth.uid();
$$;

-- günün bulmacasını çözdüm (gün ve saat sunucudan; günde bir kez)
create or replace function public.bulmaca_cozdum() returns void
language sql security definer set search_path = '' as $$
  insert into public.bulmaca_cozumleri (id, gun)
  select auth.uid(), (now() at time zone 'utc')::date where auth.uid() is not null
  on conflict do nothing;
$$;

-- şüpheli bildir: bir kişiyi bir kez; günde en çok 10; 3 ayrı kişi bildirirse askıya alınır
create or replace function public.bildir(hedef_ad text, neden text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hedef_id uuid;
  sayi int;
begin
  if uid is null then return 'giris'; end if;
  select id into hedef_id from public.profiller where kullanici_adi = lower(hedef_ad);
  if hedef_id is null then return 'yok'; end if;
  if hedef_id = uid then return 'kendin'; end if;
  if (select count(*) from public.bildirimler where bildiren = uid and zaman > now() - interval '1 day') >= 10 then
    return 'sinir';
  end if;
  insert into public.bildirimler (bildiren, hedef, neden) values (uid, hedef_id, left(neden, 200))
  on conflict (bildiren, hedef) do nothing;
  select count(distinct bildiren) into sayi from public.bildirimler where hedef = hedef_id and not incelendi;
  if sayi >= 3 then
    update public.istatistikler set askida = true,
      askida_neden = left(coalesce(askida_neden || '; ', '') || sayi || ' kişi bildirdi', 500)
    where id = hedef_id and not askida;
  end if;
  return 'tamam';
end;
$$;

-- ---------- yönetici ----------
create or replace function public.liderlik_denetim() returns table (
  id uuid, kullanici_adi text, gorunen_ad text, askida boolean, askida_neden text, engelli boolean,
  bildirim_sayisi bigint, bildirim_nedenleri text, tamlik int, ecka_toplam int, gun int, guncelleme timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('liderlik') then raise exception 'yetki yok'; end if;
  return query
    select s.id, p.kullanici_adi, p.gorunen_ad, s.askida, s.askida_neden, s.engelli,
           (select count(*) from public.bildirimler b where b.hedef = s.id and not b.incelendi),
           (select string_agg(coalesce(b.neden, '—'), ' | ') from public.bildirimler b where b.hedef = s.id and not b.incelendi),
           s.tamlik, s.ecka_toplam, s.gun, s.guncelleme
    from public.istatistikler s join public.profiller p on p.id = s.id
    where s.askida or s.engelli
       or exists (select 1 from public.bildirimler b where b.hedef = s.id and not b.incelendi)
    order by s.guncelleme desc;
end;
$$;

-- karar: 'onayla' (askıdan indir), 'cikar' (tablodan çıkar), 'geri_al' (çıkarmayı kaldır)
create or replace function public.liderlik_karar(hedef uuid, karar text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('liderlik') then raise exception 'yetki yok'; end if;
  if karar = 'onayla' then
    update public.istatistikler set askida = false, askida_neden = null where id = hedef;
  elsif karar = 'cikar' then
    update public.istatistikler set engelli = true, askida = false where id = hedef;
  elsif karar = 'geri_al' then
    update public.istatistikler set engelli = false where id = hedef;
  else
    raise exception 'bilinmeyen karar';
  end if;
  update public.bildirimler set incelendi = true where bildirimler.hedef = liderlik_karar.hedef;
end;
$$;

-- ---------- herkese açık görünümler (yalnızca görünür kayıtlar ve güvenli sütunlar) ----------
drop view if exists public.liderlik_dereceler;
drop view if exists public.kulupler;
drop view if exists public.topluluk_roller;
drop view if exists public.bulmaca_bugun;
drop view if exists public.liderlik;

create view public.liderlik as
  select p.kullanici_adi, p.gorunen_ad, p.tentifor_adi,
         s.tamlik, s.ecka_toplam, s.seri, s.katman, s.madalya, s.gun,
         s.nobet, s.cevirmen, s.vardiya, s.yazi, s.boyut, s.baloncuk,
         case when s.hafta = date_trunc('week', now() at time zone 'utc')::date
              then s.ecka_toplam - s.hafta_taban else 0 end as haftalik,
         case when s.sezon = public.tomye_ay(now()) then s.ecka_toplam - s.sezon_taban else 0 end as sezonluk,
         s.rol, s.kisilik, s.guncelleme
  from public.istatistikler s join public.profiller p on p.id = s.id
  where not s.gizli and not s.askida and not s.engelli and p.kullanici_adi is not null;

create view public.liderlik_dereceler as
  select kullanici_adi,
    rank() over (order by tamlik desc) as tamlik, rank() over (order by haftalik desc) as haftalik,
    rank() over (order by sezonluk desc) as sezonluk, rank() over (order by ecka_toplam desc) as ecka_toplam,
    rank() over (order by seri desc) as seri, rank() over (order by katman desc) as katman,
    rank() over (order by madalya desc) as madalya, rank() over (order by nobet desc) as nobet,
    rank() over (order by cevirmen desc) as cevirmen, rank() over (order by vardiya desc) as vardiya,
    rank() over (order by yazi desc) as yazi, rank() over (order by boyut desc) as boyut,
    rank() over (order by baloncuk desc) as baloncuk,
    tamlik > 0 as v_tamlik, haftalik > 0 as v_haftalik, sezonluk > 0 as v_sezonluk, ecka_toplam > 0 as v_ecka_toplam,
    seri > 0 as v_seri, katman > 0 as v_katman, madalya > 0 as v_madalya, nobet > 0 as v_nobet,
    cevirmen > 0 as v_cevirmen, vardiya > 0 as v_vardiya, yazi > 0 as v_yazi, boyut > 0 as v_boyut,
    baloncuk > 0 as v_baloncuk
  from public.liderlik;

-- kulüpler: kişilik tipine göre takımlar; puan = üyelerin bu haftaki eçkası
create view public.kulupler as
  select kisilik, count(*) as uye, sum(haftalik) as haftalik, round(avg(tamlik)) as ortalama_tamlik
  from public.liderlik where kisilik is not null group by kisilik;

create view public.topluluk_roller as
  select rol, count(*) as sayi from public.liderlik where rol is not null group by rol;

create view public.bulmaca_bugun as
  select p.kullanici_adi, p.gorunen_ad, b.zaman,
         row_number() over (order by b.zaman) as sira
  from public.bulmaca_cozumleri b
  join public.profiller p on p.id = b.id
  left join public.istatistikler s on s.id = b.id
  where b.gun = (now() at time zone 'utc')::date and p.kullanici_adi is not null
    and not coalesce(s.gizli or s.askida or s.engelli, false);

grant select on public.liderlik, public.liderlik_dereceler, public.kulupler,
                public.topluluk_roller, public.bulmaca_bugun to anon, authenticated;

-- istemcinin doğrudan yazmasına izin yok; yalnızca yukarıdaki fonksiyonlar
revoke insert, update, delete on public.istatistikler, public.bildirimler, public.bulmaca_cozumleri,
                                  public.liderlik_suphe, public.yoneticiler, public.liderlik_ayar
  from anon, authenticated;
revoke execute on function public.istatistik_gonder(jsonb), public.istatistik_sifirla(),
                           public.liderlik_gorunurluk(boolean), public.bulmaca_cozdum(),
                           public.bildir(text, text), public.liderlik_denetim(),
                           public.liderlik_karar(uuid, text) from public, anon;
grant execute on function public.istatistik_gonder(jsonb), public.istatistik_sifirla(),
                          public.liderlik_gorunurluk(boolean), public.bulmaca_cozdum(),
                          public.bildir(text, text), public.liderlik_denetim(),
                          public.liderlik_karar(uuid, text) to authenticated;

-- ======================================================================
-- ============ YARIŞLAR ================================================
-- ======================================================================
-- Sorular ve doğru cevaplar sunucudadır. Oyuncuya sorular cevapsız gider;
-- puanı, süreyi ve doğruluğu veritabanı hesaplar. Soru bankasını yönetici
-- hesabıyla giriş yapıldığında site kendisi üretip yükler (yaris_icerik_yukle).

create table if not exists public.yaris_tanim (
  yaris text primary key,
  tur text not null check (tur in ('secenek', 'metin', 'sira', 'nokta', 'set', 'serbest')),
  soru_sayisi int not null,
  sure_sn int not null,
  en_az_ms int not null default 0      -- bir doğru cevap için insanın en az harcayacağı süre
);
insert into public.yaris_tanim (yaris, tur, soru_sayisi, sure_sn, en_az_ms) values
  ('kyldo_hiz',   'metin',   40,   60, 900),
  ('isim_avi',    'secenek', 30,  120, 600),
  ('arsiv_sinavi','secenek', 10,  120, 900),
  ('alinti',      'secenek', 10,   60, 700),
  ('harita',      'nokta',    5,   90, 1200),
  ('takvim',      'secenek',  8,   90, 1500),
  ('kronoloji',   'sira',     1,   60, 4000),
  ('muhur',       'set',     10,   90, 1500),
  ('oyunbozan',   'set',      1,  180, 8000),
  ('nobet_meydan','serbest',  0, 3600, 4000)
on conflict (yaris) do update set tur = excluded.tur, soru_sayisi = excluded.soru_sayisi,
  sure_sn = excluded.sure_sn, en_az_ms = excluded.en_az_ms;
alter table public.yaris_tanim enable row level security;
drop policy if exists "yarışlar herkese açık" on public.yaris_tanim;
create policy "yarışlar herkese açık" on public.yaris_tanim for select using (true);

-- soru bankası: cevap sütunu hiçbir istemciye gösterilmez (politika yok)
create table if not exists public.yaris_banka (
  yaris text not null,
  no int not null,
  soru jsonb not null,
  cevap jsonb not null,
  primary key (yaris, no)
);
alter table public.yaris_banka enable row level security;

create table if not exists public.yaris_ayar (
  id int primary key default 1 check (id = 1),
  icerik_ozet text,
  guncelleme timestamptz
);
insert into public.yaris_ayar (id) values (1) on conflict (id) do nothing;
alter table public.yaris_ayar enable row level security;
drop policy if exists "yarış ayarı herkese açık" on public.yaris_ayar;
create policy "yarış ayarı herkese açık" on public.yaris_ayar for select using (true);

create table if not exists public.yaris_oturumlari (
  id uuid primary key default gen_random_uuid(),
  kullanici uuid not null references auth.users(id) on delete cascade,
  yaris text not null,
  sorular int[] not null default '{}',
  tohum bigint,
  baslangic timestamptz not null default now(),
  bitis timestamptz,
  durum text not null default 'acik'
);
create index if not exists yaris_oturumlari_kullanici on public.yaris_oturumlari (kullanici, baslangic);
alter table public.yaris_oturumlari enable row level security;

create table if not exists public.yaris_skorlari (
  no bigserial primary key,
  kullanici uuid not null references auth.users(id) on delete cascade,
  yaris text not null,
  puan int not null,
  dogru int not null default 0,
  sure_ms int not null,
  hafta date not null,
  sezon int not null,
  supheli boolean not null default false,
  zaman timestamptz not null default now()
);
create index if not exists yaris_skorlari_yaris on public.yaris_skorlari (yaris, hafta);
alter table public.yaris_skorlari enable row level security;

-- ---------- içerik yükleme (yönetici) ----------
create table if not exists public.kesif_anahtarlari (
  anahtar text primary key,
  eklenme timestamptz not null default now()
);
alter table public.kesif_anahtarlari enable row level security;

create or replace function public.yaris_icerik_yukle(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  y text;
  ilk boolean;
begin
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;

  for y in select jsonb_object_keys(coalesce(p->'banka', '{}')) loop
    if not exists (select 1 from public.yaris_tanim where yaris = y) and y <> 'gunun_kelimesi' then continue; end if;
    delete from public.yaris_banka where yaris = y;
    insert into public.yaris_banka (yaris, no, soru, cevap)
      select y, e.ord::int, coalesce(e.v->'soru', '{}'), coalesce(e.v->'cevap', '{}')
      from jsonb_array_elements(p->'banka'->y) with ordinality as e(v, ord);
  end loop;

  -- İlk Kâşif: ilk yüklemede var olan her şey "eski" sayılır; sonra eklenenler yeni
  select not exists (select 1 from public.kesif_anahtarlari) into ilk;
  insert into public.kesif_anahtarlari (anahtar, eklenme)
    select a, case when ilk then timestamptz '2000-01-01' else now() end
    from jsonb_array_elements_text(coalesce(p->'kesif', '[]')) as a
  on conflict (anahtar) do nothing;

  -- liderlikteki sınırlar içerikle birlikte güncellenir
  if p ? 'sayilar' then
    update public.liderlik_ayar set
      karakter = greatest(coalesce((p->'sayilar'->>'karakter')::int, karakter), 1),
      katman   = greatest(coalesce((p->'sayilar'->>'katman')::int, katman), 1),
      galeri   = greatest(coalesce((p->'sayilar'->>'galeri')::int, galeri), 1),
      madalya  = greatest(coalesce((p->'sayilar'->>'madalya')::int, madalya), 1),
      oyun     = greatest(coalesce((p->'sayilar'->>'oyun')::int, oyun), 1)
    where id = 1;
  end if;

  -- içerik oylamasına açık yapımlar
  if p ? 'yapimlar' and to_regclass('public.oylanabilir') is not null then
    delete from public.oylanabilir where ad not in (select jsonb_array_elements_text(p->'yapimlar'));
    insert into public.oylanabilir (ad) select jsonb_array_elements_text(p->'yapimlar') on conflict do nothing;
  end if;

  update public.yaris_ayar set icerik_ozet = p->>'ozet', guncelleme = now() where id = 1;
  return jsonb_build_object('durum', 'tamam',
    'soru', (select count(*) from public.yaris_banka), 'kesif', (select count(*) from public.kesif_anahtarlari));
end;
$$;

-- ---------- yarış oturumu ----------
create or replace function public.yaris_baslat(p_yaris text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  t public.yaris_tanim;
  secilen int[];
  oid uuid;
  tohum bigint;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  select * into t from public.yaris_tanim where yaris = p_yaris;
  if not found then return jsonb_build_object('durum', 'yok'); end if;
  -- sıklık: saatte en çok 60 oturum
  if (select count(*) from public.yaris_oturumlari where kullanici = uid and baslangic > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  update public.yaris_oturumlari set durum = 'terk' where kullanici = uid and yaris = p_yaris and durum = 'acik';

  if t.tur = 'serbest' then
    secilen := '{}';
    -- haftalık meydan: o hafta herkes aynı tohumla oynar
    tohum := (hashtext(p_yaris || ':' || date_trunc('week', now() at time zone 'utc')::date::text)::bigint & 2147483647);
  else
    select array_agg(no) into secilen from (
      select no from public.yaris_banka where yaris = p_yaris order by random() limit t.soru_sayisi) x;
    if secilen is null then return jsonb_build_object('durum', 'bos'); end if;
  end if;

  insert into public.yaris_oturumlari (kullanici, yaris, sorular, tohum) values (uid, p_yaris, secilen, tohum)
    returning id into oid;

  return jsonb_build_object('durum', 'tamam', 'oturum', oid, 'sure', t.sure_sn, 'tohum', tohum,
    'sorular', coalesce((select jsonb_agg(jsonb_build_object('no', b.no, 'soru', b.soru) order by u.ord)
                         from unnest(secilen) with ordinality as u(no, ord)
                         join public.yaris_banka b on b.yaris = p_yaris and b.no = u.no), '[]'::jsonb));
end;
$$;

-- metin karşılaştırması için Türkçe küçük harf
create or replace function public.tr_kucuk(m text) returns text
language sql immutable set search_path = '' as $$
  select lower(translate(trim(coalesce(m, '')), 'İIÇĞÖŞÜ', 'iıçğöşü'));
$$;

create or replace function public.yaris_bitir(p_oturum uuid, p_cevaplar jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  o public.yaris_oturumlari;
  t public.yaris_tanim;
  b public.yaris_banka;
  gecen_ms int;
  i int;
  v jsonb;
  dogru int := 0;
  puan int := 0;
  seri int := 0;
  seri_bitti boolean := false;
  ok boolean;
  mesafe double precision;
  dx double precision;
  kismi int;
  sonuclar jsonb := '[]'::jsonb;
  supheli boolean := false;
  skor int;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  select * into o from public.yaris_oturumlari where id = p_oturum and kullanici = uid for update;
  if not found or o.durum <> 'acik' then return jsonb_build_object('durum', 'gecersiz'); end if;
  select * into t from public.yaris_tanim where yaris = o.yaris;
  gecen_ms := (extract(epoch from (now() - o.baslangic)) * 1000)::int;

  -- süre dolduktan 10 sn sonra gelen cevap geçersiz
  if gecen_ms > (t.sure_sn + 10) * 1000 then
    update public.yaris_oturumlari set durum = 'gec', bitis = now() where id = o.id;
    return jsonb_build_object('durum', 'gec');
  end if;

  if t.tur = 'serbest' then
    -- Nöbet haftalık meydanı: skor istemciden gelir; sınırlanır ve süreyle karşılaştırılır
    skor := least(greatest(coalesce((p_cevaplar->>'skor')::int, 0), 0), 28);
    puan := skor; dogru := skor;
    if gecen_ms < skor * t.en_az_ms then supheli := true; end if;
  else
    for i in 1 .. coalesce(array_length(o.sorular, 1), 0) loop
      select * into b from public.yaris_banka where yaris = o.yaris and no = o.sorular[i];
      v := p_cevaplar -> (i - 1);
      ok := false; kismi := 0;
      if b.no is not null and v is not null and v <> 'null'::jsonb then
        if t.tur = 'secenek' then
          ok := public.tr_kucuk(v #>> '{}') = public.tr_kucuk(b.cevap->>'dogru');
        elsif t.tur = 'metin' then
          ok := public.tr_kucuk(v #>> '{}') in (select public.tr_kucuk(x) from jsonb_array_elements_text(b.cevap->'kabul') x);
        elsif t.tur = 'set' then
          ok := jsonb_typeof(v) = 'array' and
                (select coalesce(array_agg(public.tr_kucuk(x) order by public.tr_kucuk(x)), '{}') from jsonb_array_elements_text(v) x) =
                (select coalesce(array_agg(public.tr_kucuk(x) order by public.tr_kucuk(x)), '{}') from jsonb_array_elements_text(b.cevap->'dogru') x);
        elsif t.tur = 'sira' then
          if jsonb_typeof(v) = 'array' then
            select count(*) into kismi from jsonb_array_elements_text(v) with ordinality a(x, n)
              join jsonb_array_elements_text(b.cevap->'dogru') with ordinality d(x, n) on a.n = d.n and a.x = d.x;
            ok := kismi = jsonb_array_length(b.cevap->'dogru');
          end if;
        elsif t.tur = 'nokta' then
          dx := abs((v->>'x')::double precision - (b.cevap->>'x')::double precision);
          dx := least(dx, 100 - dx);    -- gezegen yatayda döner
          mesafe := sqrt(dx * dx + power((v->>'y')::double precision - (b.cevap->>'y')::double precision, 2));
          kismi := greatest(0, round(100 - mesafe * 4))::int;
          ok := mesafe <= 6;
        end if;
      end if;

      if ok then dogru := dogru + 1; end if;
      if not seri_bitti then if ok then seri := seri + 1; else seri_bitti := true; end if; end if;
      if t.tur = 'nokta' then puan := puan + kismi;
      elsif t.tur = 'sira' then puan := puan + kismi * 10;
      end if;
      sonuclar := sonuclar || jsonb_build_object('dogru', ok, 'kismi', kismi);
    end loop;

    if o.yaris = 'isim_avi' then puan := seri;                                        -- seri kırılana kadar
    elsif o.yaris = 'arsiv_sinavi' then puan := dogru * 10 + case when dogru > 0 then greatest(0, t.sure_sn - gecen_ms / 1000) else 0 end;
    elsif o.yaris = 'kronoloji' then puan := puan + case when dogru = 1 then greatest(0, t.sure_sn - gecen_ms / 1000) else 0 end;
    elsif o.yaris = 'oyunbozan' then puan := case when dogru = 1 then 30 + greatest(0, t.sure_sn - gecen_ms / 1000) else 0 end;
    elsif t.tur in ('secenek', 'metin', 'set') then puan := dogru;
    end if;

    -- insan hızı: her doğru için en az t.en_az_ms
    if dogru > 0 and gecen_ms < dogru * t.en_az_ms then supheli := true; end if;
  end if;

  update public.yaris_oturumlari set durum = 'bitti', bitis = now() where id = o.id;
  insert into public.yaris_skorlari (kullanici, yaris, puan, dogru, sure_ms, hafta, sezon, supheli)
    values (uid, o.yaris, puan, dogru, gecen_ms, date_trunc('week', now() at time zone 'utc')::date, public.tomye_ay(now()), supheli);
  if supheli then
    insert into public.liderlik_suphe (id, neden, veri)
      values (uid, o.yaris || ': insan hızının üstünde (' || dogru || ' doğru, ' || gecen_ms || ' ms)', p_cevaplar);
  end if;

  return jsonb_build_object('durum', 'tamam', 'puan', puan, 'dogru', dogru, 'sure_ms', gecen_ms,
                            'supheli', supheli, 'sonuclar', sonuclar);
end;
$$;

-- ---------- Günün Kelimesi (cevap sunucuda) ----------
create table if not exists public.gk_tahminler (
  kullanici uuid not null references auth.users(id) on delete cascade,
  gun date not null,
  tahminler text[] not null default '{}',
  cozuldu boolean not null default false,
  bitis timestamptz,
  primary key (kullanici, gun)
);
alter table public.gk_tahminler enable row level security;

create or replace function public.gk_cevap(p_gun date) returns text
language sql stable security definer set search_path = '' as $$
  select public.tr_kucuk(cevap->>'kelime') from public.yaris_banka
  where yaris = 'gunun_kelimesi'
    and no = (select (abs(p_gun - date '2026-01-01') % count(*)) + 1 from public.yaris_banka where yaris = 'gunun_kelimesi');
$$;

-- harf harf: d = doğru yerde, v = kelimede var, y = yok (tekrarlı harfler doğru sayılır)
create or replace function public.gk_karsilastir(tahmin text, cevap text) returns text[]
language plpgsql immutable set search_path = '' as $$
declare
  t text[] := regexp_split_to_array(tahmin, '');
  c text[] := regexp_split_to_array(cevap, '');
  s text[] := array_fill('y'::text, array[array_length(t, 1)]);
  kalan text[] := '{}';
  i int; j int;
begin
  for i in 1 .. array_length(t, 1) loop
    if t[i] = c[i] then s[i] := 'd'; else kalan := kalan || c[i]; end if;
  end loop;
  for i in 1 .. array_length(t, 1) loop
    if s[i] <> 'd' then
      j := array_position(kalan, t[i]);
      if j is not null then s[i] := 'v'; kalan := kalan[1:j-1] || kalan[j+1:]; end if;
    end if;
  end loop;
  return s;
end;
$$;

create or replace function public.gk_durum() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_gun date := (now() at time zone 'utc')::date;
  cevap text := public.gk_cevap((now() at time zone 'utc')::date);
  k public.gk_tahminler;
  bitti boolean;
begin
  if cevap is null then return jsonb_build_object('durum', 'bos'); end if;
  select * into k from public.gk_tahminler t where t.kullanici = uid and t.gun = v_gun;
  bitti := coalesce(k.cozuldu, false) or coalesce(array_length(k.tahminler, 1), 0) >= 6;
  return jsonb_build_object('durum', 'tamam', 'gun', v_gun, 'uzunluk', char_length(cevap), 'hak', 6,
    'tahminler', coalesce((select jsonb_agg(jsonb_build_object('kelime', x, 'sonuc', to_jsonb(public.gk_karsilastir(x, cevap))) order by n)
                           from unnest(k.tahminler) with ordinality u(x, n)), '[]'::jsonb),
    'cozuldu', coalesce(k.cozuldu, false), 'bitti', bitti,
    'cevap', case when bitti then cevap end);
end;
$$;

create or replace function public.gk_tahmin(p text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_gun date := (now() at time zone 'utc')::date;
  cevap text := public.gk_cevap((now() at time zone 'utc')::date);
  tahmin text := public.tr_kucuk(p);
  k public.gk_tahminler;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if cevap is null then return jsonb_build_object('durum', 'bos'); end if;
  if char_length(tahmin) <> char_length(cevap) or tahmin !~ '^[a-zçğıöşü]+$' then
    return jsonb_build_object('durum', 'gecersiz', 'uzunluk', char_length(cevap));
  end if;
  insert into public.gk_tahminler (kullanici, gun) values (uid, v_gun) on conflict do nothing;
  select * into k from public.gk_tahminler t where t.kullanici = uid and t.gun = v_gun for update;
  if k.cozuldu or coalesce(array_length(k.tahminler, 1), 0) >= 6 then return public.gk_durum(); end if;
  update public.gk_tahminler set tahminler = tahminler || tahmin,
    cozuldu = (tahmin = cevap),
    bitis = case when tahmin = cevap or coalesce(array_length(tahminler, 1), 0) + 1 >= 6 then now() end
  where gk_tahminler.kullanici = uid and gk_tahminler.gun = v_gun;
  return public.gk_durum();
end;
$$;

-- ---------- İlk Kâşif ----------
create table if not exists public.kesifler (
  kullanici uuid not null references auth.users(id) on delete cascade,
  anahtar text not null references public.kesif_anahtarlari(anahtar) on delete cascade,
  zaman timestamptz not null default now(),
  primary key (kullanici, anahtar)
);
alter table public.kesifler enable row level security;

-- yalnızca son 60 günde eklenen içerik sayılır; dakikada en çok 30 kayıt
create or replace function public.kesif_kaydet(p text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  if not exists (select 1 from public.kesif_anahtarlari where anahtar = p and eklenme > now() - interval '60 days') then return; end if;
  if (select count(*) from public.kesifler where kullanici = uid and zaman > now() - interval '1 minute') >= 30 then return; end if;
  insert into public.kesifler (kullanici, anahtar) values (uid, p) on conflict do nothing;
end;
$$;

-- ---------- herkese açık görünümler ----------
drop view if exists public.yaris_tablolari;
drop view if exists public.kyldo_toplam;
drop view if exists public.kulup_savasi;
drop view if exists public.gk_bugun;
drop view if exists public.kasif_sayilari;
drop view if exists public.ilk_kasifler;

-- tablolarda görünebilecek kullanıcılar (gizli, askıda, engelli değil)
create or replace view public.gorunur_kullanicilar as
  select p.id, p.kullanici_adi, p.gorunen_ad, s.kisilik
  from public.profiller p left join public.istatistikler s on s.id = p.id
  where p.kullanici_adi is not null and not coalesce(s.gizli or s.askida or s.engelli, false);

create view public.yaris_tablolari as
  select k.yaris, 'tum'::text as kapsam, g.kullanici_adi, g.gorunen_ad, max(k.puan) as puan, count(*) as oyun
    from public.yaris_skorlari k join public.gorunur_kullanicilar g on g.id = k.kullanici
    where not k.supheli group by k.yaris, g.kullanici_adi, g.gorunen_ad
  union all
  select k.yaris, 'hafta', g.kullanici_adi, g.gorunen_ad, max(k.puan), count(*)
    from public.yaris_skorlari k join public.gorunur_kullanicilar g on g.id = k.kullanici
    where not k.supheli and k.hafta = date_trunc('week', now() at time zone 'utc')::date
    group by k.yaris, g.kullanici_adi, g.gorunen_ad
  union all
  select k.yaris, 'sezon', g.kullanici_adi, g.gorunen_ad, max(k.puan), count(*)
    from public.yaris_skorlari k join public.gorunur_kullanicilar g on g.id = k.kullanici
    where not k.supheli and k.sezon = public.tomye_ay(now())
    group by k.yaris, g.kullanici_adi, g.gorunen_ad;

-- toplam çeviri: Kyldo hız yarışlarında doğru çevrilen bütün kelimeler
create view public.kyldo_toplam as
  select g.kullanici_adi, g.gorunen_ad, sum(k.dogru) as toplam,
         sum(k.dogru) filter (where k.hafta = date_trunc('week', now() at time zone 'utc')::date) as hafta
  from public.yaris_skorlari k join public.gorunur_kullanicilar g on g.id = k.kullanici
  where k.yaris = 'kyldo_hiz' and not k.supheli
  group by g.kullanici_adi, g.gorunen_ad;

-- kulüp savaşı: bu hafta ve geçen hafta en çok Kyldo kelimesi çeviren kulüp
create view public.kulup_savasi as
  select g.kisilik,
         coalesce(sum(k.dogru) filter (where k.hafta = date_trunc('week', now() at time zone 'utc')::date), 0) as bu_hafta,
         coalesce(sum(k.dogru) filter (where k.hafta = date_trunc('week', now() at time zone 'utc')::date - 7), 0) as gecen_hafta,
         count(distinct g.id) as katilan
  from public.yaris_skorlari k join public.gorunur_kullanicilar g on g.id = k.kullanici
  where k.yaris = 'kyldo_hiz' and not k.supheli and g.kisilik is not null
  group by g.kisilik;

create view public.gk_bugun as
  select g.kullanici_adi, g.gorunen_ad, array_length(t.tahminler, 1) as deneme, t.bitis,
         row_number() over (order by array_length(t.tahminler, 1), t.bitis) as sira
  from public.gk_tahminler t join public.gorunur_kullanicilar g on g.id = t.kullanici
  where t.gun = (now() at time zone 'utc')::date and t.cozuldu;

create view public.ilk_kasifler as
  select * from (
    select k.anahtar, g.kullanici_adi, g.gorunen_ad, k.zaman,
           row_number() over (partition by k.anahtar order by k.zaman) as sira
    from public.kesifler k join public.gorunur_kullanicilar g on g.id = k.kullanici) x
  where sira <= 10;

create view public.kasif_sayilari as
  select kullanici_adi, gorunen_ad, count(*) as ilk_on, count(*) filter (where sira = 1) as birinci
  from public.ilk_kasifler group by kullanici_adi, gorunen_ad;

revoke all on public.gorunur_kullanicilar from anon, authenticated;
grant select on public.yaris_tablolari, public.kyldo_toplam, public.kulup_savasi, public.gk_bugun,
                public.ilk_kasifler, public.kasif_sayilari to anon, authenticated;

revoke insert, update, delete on public.yaris_tanim, public.yaris_banka, public.yaris_ayar, public.yaris_oturumlari,
  public.yaris_skorlari, public.gk_tahminler, public.kesif_anahtarlari, public.kesifler from anon, authenticated;
revoke select on public.yaris_banka, public.yaris_oturumlari, public.yaris_skorlari, public.gk_tahminler,
  public.kesif_anahtarlari, public.kesifler from anon, authenticated;
revoke execute on function public.yaris_icerik_yukle(jsonb), public.yaris_baslat(text), public.yaris_bitir(uuid, jsonb),
  public.gk_durum(), public.gk_tahmin(text), public.kesif_kaydet(text), public.gk_cevap(date) from public, anon;
grant execute on function public.yaris_icerik_yukle(jsonb), public.yaris_baslat(text), public.yaris_bitir(uuid, jsonb),
  public.gk_durum(), public.gk_tahmin(text), public.kesif_kaydet(text) to authenticated;
revoke execute on function public.gk_cevap(date) from authenticated;

-- ======================================================================
-- ============ HESAP SİLME, YEDEK, HATA KAYDI =========================
-- ======================================================================

-- Kullanıcı kendi hesabını ve bütün verisini siler (KVKK). Diğer tablolar
-- auth.users'a "on delete cascade" ile bağlı olduğu için hepsi birlikte gider.
create or replace function public.hesabimi_sil() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'giriş gerekli'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Tarayıcıdaki hatalar: aynı hata aynı gün tek satırda sayılır; günde en çok 5000 satır
create table if not exists public.hata_kayitlari (
  no bigserial primary key,
  gun date not null default (now() at time zone 'utc')::date,
  ozet text not null,
  mesaj text not null,
  kaynak text,
  adres text,
  tarayici text,
  surum text,
  kullanici uuid references auth.users(id) on delete set null,
  sayi int not null default 1,
  ilk timestamptz not null default now(),
  son timestamptz not null default now(),
  unique (gun, ozet)
);
alter table public.hata_kayitlari enable row level security;
drop policy if exists "yönetici hataları okur" on public.hata_kayitlari;
create policy "yönetici hataları okur" on public.hata_kayitlari for select using (public.yonetici_yetki('hatalar'));

create or replace function public.hata_kaydet(p_mesaj text, p_kaynak text default null, p_adres text default null,
                                              p_tarayici text default null, p_surum text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  bugun date := (now() at time zone 'utc')::date;
  /* 2.8: sürüm de anahtarda — aynı hata her sürüm için ayrı sayılır, panel yalnızca yayındaki sürümünkileri gösterir */
  o text := md5(left(coalesce(p_mesaj, ''), 300) || '|' || left(coalesce(p_kaynak, ''), 200) || '|' || left(coalesce(p_surum, ''), 40));
begin
  if coalesce(p_mesaj, '') = '' then return; end if;
  if (select count(*) from public.hata_kayitlari where gun = bugun) >= 5000 then return; end if;
  insert into public.hata_kayitlari (gun, ozet, mesaj, kaynak, adres, tarayici, surum, kullanici)
  values (bugun, o, left(p_mesaj, 500), left(p_kaynak, 300), left(p_adres, 300), left(p_tarayici, 300), left(p_surum, 40), auth.uid())
  on conflict (gun, ozet) do update set sayi = public.hata_kayitlari.sayi + 1, son = now();
end;
$$;

create or replace function public.hata_temizle() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('hatalar') then raise exception 'yetki yok'; end if;
  delete from public.hata_kayitlari;
end;
$$;

-- ======================================================================
-- ============ TOPLULUK: TEORİLER, OYLAMA, TAKİP, VİTRİN ==============
-- ======================================================================

alter table public.profiller add column if not exists vitrin jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.profiller add constraint profiller_vitrin_boyut check (pg_column_size(vitrin) < 2000);
exception when duplicate_object then null; end $$;

-- teori panosu: "Bilinmeyenler"deki sorulara okur teorileri
create table if not exists public.teoriler (
  id bigserial primary key,
  kullanici uuid not null references auth.users(id) on delete cascade,
  konu text not null check (char_length(konu) between 1 and 200),
  metin text not null check (char_length(metin) between 20 and 1000),
  zaman timestamptz not null default now(),
  gizli boolean not null default false,
  isaret text check (isaret in ('kanon', 'yakin'))
);
alter table public.teoriler enable row level security;

create table if not exists public.teori_begenileri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  teori bigint not null references public.teoriler(id) on delete cascade,
  primary key (kullanici, teori)
);
alter table public.teori_begenileri enable row level security;

create table if not exists public.teori_bildirimleri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  teori bigint not null references public.teoriler(id) on delete cascade,
  zaman timestamptz not null default now(),
  primary key (kullanici, teori)
);
alter table public.teori_bildirimleri enable row level security;

create or replace function public.teori_yaz(p_konu text, p_metin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); yeni bigint;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if exists (select 1 from public.istatistikler where id = uid and engelli) then return jsonb_build_object('durum', 'engelli'); end if;
  if char_length(trim(coalesce(p_metin, ''))) < 20 then return jsonb_build_object('durum', 'kisa'); end if;
  if (select count(*) from public.teoriler where kullanici = uid and zaman > now() - interval '1 day') >= 5 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  insert into public.teoriler (kullanici, konu, metin) values (uid, left(trim(p_konu), 200), left(trim(p_metin), 1000))
    returning id into yeni;
  return jsonb_build_object('durum', 'tamam', 'id', yeni);
end;
$$;

create or replace function public.teori_begen(p_teori bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  if exists (select 1 from public.teori_begenileri where kullanici = uid and teori = p_teori) then
    delete from public.teori_begenileri where kullanici = uid and teori = p_teori;
    return false;
  end if;
  if not exists (select 1 from public.teoriler where id = p_teori and not gizli and kullanici <> uid) then return false; end if;
  insert into public.teori_begenileri (kullanici, teori) values (uid, p_teori);
  return true;
end;
$$;

-- üç ayrı kişi bildirirse teori gizlenir; yönetici geri açabilir
create or replace function public.teori_bildir(p_teori bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return 'giris'; end if;
  if (select count(*) from public.teori_bildirimleri where kullanici = uid and zaman > now() - interval '1 day') >= 10 then return 'sinir'; end if;
  insert into public.teori_bildirimleri (kullanici, teori) select uid, p_teori
    where exists (select 1 from public.teoriler where id = p_teori and kullanici <> uid) on conflict do nothing;
  if (select count(*) from public.teori_bildirimleri where teori = p_teori) >= 3 then
    update public.teoriler set gizli = true where id = p_teori and isaret is null;
  end if;
  return 'tamam';
end;
$$;

-- kendi teorini ya da (yönetici) herhangi birini sil
create or replace function public.teori_sil(p_teori bigint) returns void
language sql security definer set search_path = '' as $$
  delete from public.teoriler where id = p_teori and (kullanici = auth.uid() or public.yonetici_mi());
$$;

-- yönetici: kanon / yakın işareti, gizle / aç
create or replace function public.teori_isaretle(p_teori bigint, p_isaret text, p_gizli boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('teoriler') then raise exception 'yetki yok'; end if;
  update public.teoriler set isaret = nullif(p_isaret, ''), gizli = p_gizli where id = p_teori;
  if not p_gizli then delete from public.teori_bildirimleri where teori = p_teori; end if;
end;
$$;

-- yönetici: gizlenmiş (bildirilen) teoriler ve işaretliler
create or replace function public.teori_denetim() returns table (
  id bigint, konu text, metin text, zaman timestamptz, gizli boolean, isaret text,
  kullanici_adi text, bildirim bigint, begeni bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('teoriler') then raise exception 'yetki yok'; end if;
  return query
    select t.id, t.konu, t.metin, t.zaman, t.gizli, t.isaret, p.kullanici_adi,
           (select count(*) from public.teori_bildirimleri b where b.teori = t.id),
           (select count(*) from public.teori_begenileri b where b.teori = t.id)
    from public.teoriler t join public.profiller p on p.id = t.kullanici
    where t.gizli or exists (select 1 from public.teori_bildirimleri b where b.teori = t.id)
    order by t.zaman desc limit 200;
end;
$$;

-- sıradaki içerik oylaması: yapımlar listesinden, kişi başı en çok 3 oy
create table if not exists public.oylanabilir (ad text primary key);
alter table public.oylanabilir enable row level security;
drop policy if exists "oylanabilir herkese açık" on public.oylanabilir;
create policy "oylanabilir herkese açık" on public.oylanabilir for select using (true);

create table if not exists public.yapim_oylari (
  kullanici uuid not null references auth.users(id) on delete cascade,
  yapim text not null references public.oylanabilir(ad) on delete cascade,
  zaman timestamptz not null default now(),
  primary key (kullanici, yapim)
);
alter table public.yapim_oylari enable row level security;

create or replace function public.yapim_oyla(p_yapim text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if exists (select 1 from public.yapim_oylari where kullanici = uid and yapim = p_yapim) then
    delete from public.yapim_oylari where kullanici = uid and yapim = p_yapim;
  elsif not exists (select 1 from public.oylanabilir where ad = p_yapim) then
    return jsonb_build_object('durum', 'yok');
  elsif (select count(*) from public.yapim_oylari where kullanici = uid) >= 3 then
    return jsonb_build_object('durum', 'sinir');
  else
    insert into public.yapim_oylari (kullanici, yapim) values (uid, p_yapim);
  end if;
  return jsonb_build_object('durum', 'tamam',
    'oylarim', coalesce((select jsonb_agg(yapim) from public.yapim_oylari where kullanici = uid), '[]'::jsonb));
end;
$$;

create or replace function public.oylarim() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(yapim), '[]'::jsonb) from public.yapim_oylari where kullanici = auth.uid();
$$;

-- takip
create table if not exists public.takipler (
  takip_eden uuid not null references auth.users(id) on delete cascade,
  takip_edilen uuid not null references auth.users(id) on delete cascade,
  zaman timestamptz not null default now(),
  primary key (takip_eden, takip_edilen),
  check (takip_eden <> takip_edilen)
);
alter table public.takipler enable row level security;

create or replace function public.takip_et(p_ad text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); hedef uuid;
begin
  if uid is null then return false; end if;
  select id into hedef from public.profiller where kullanici_adi = lower(p_ad);
  if hedef is null or hedef = uid then return false; end if;
  if exists (select 1 from public.takipler where takip_eden = uid and takip_edilen = hedef) then
    delete from public.takipler where takip_eden = uid and takip_edilen = hedef;
    return false;
  end if;
  if (select count(*) from public.takipler where takip_eden = uid) >= 500 then return false; end if;
  insert into public.takipler (takip_eden, takip_edilen) values (uid, hedef);
  return true;
end;
$$;

create or replace function public.takip_ettiklerim() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(p.kullanici_adi), '[]'::jsonb)
  from public.takipler t join public.profiller p on p.id = t.takip_edilen
  where t.takip_eden = auth.uid() and p.kullanici_adi is not null;
$$;

-- ======================================================================
-- ============ OYUNLAŞTIRMA: SEVİYE, HAFTALIK, İSTATİSTİK =============
-- ======================================================================

-- Günün Kelimesi serisi: bugün ya da dün biten, arka arkaya bulunan günler
create or replace function public.gk_seri() returns int
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); g date := (now() at time zone 'utc')::date; n int := 0;
begin
  if uid is null then return 0; end if;
  if not exists (select 1 from public.gk_tahminler where kullanici = uid and gun = g and cozuldu) then g := g - 1; end if;
  while exists (select 1 from public.gk_tahminler where kullanici = uid and gun = g and cozuldu) loop
    n := n + 1; g := g - 1;
  end loop;
  return n;
end;
$$;

create or replace function public.haftalik_ilerleme() returns jsonb
language sql stable security definer set search_path = '' as $$
  with h as (select date_trunc('week', now() at time zone 'utc')::date as bas)
  select jsonb_build_object(
    'farkli_yaris', (select count(distinct yaris) from public.yaris_skorlari, h where kullanici = auth.uid() and hafta = h.bas and not supheli),
    'yaris', (select count(*) from public.yaris_skorlari, h where kullanici = auth.uid() and hafta = h.bas and not supheli),
    'kyldo', (select coalesce(sum(dogru), 0) from public.yaris_skorlari, h where kullanici = auth.uid() and hafta = h.bas and yaris = 'kyldo_hiz' and not supheli),
    'gk', (select count(*) from public.gk_tahminler, h where kullanici = auth.uid() and gun >= h.bas and cozuldu),
    'kesif', (select count(*) from public.kesifler, h where kullanici = auth.uid() and zaman >= h.bas),
    'teori', (select count(*) from public.teoriler, h where kullanici = auth.uid() and zaman >= h.bas),
    'hafta', (select bas from h));
$$;

-- ======================================================================
-- ================== KOR'UN HIÇKIRIĞI ve ARŞİV AVI ====================
-- ======================================================================

-- Hıçkırık: günde en çok bir kez, 09:00–23:00 (İstanbul) arasında rastgele bir anda 3 dakika sürer.
-- Zaman tabloda saklanır ve okunamaz; istemci yalnızca "şu an var mı" diye sorar.
create table if not exists public.hickirik_olaylari (gun date primary key, bas timestamptz);
alter table public.hickirik_olaylari enable row level security;

create table if not exists public.hickirik_taniklari (
  kullanici uuid not null references auth.users(id) on delete cascade,
  gun date not null,
  zaman timestamptz not null default now(),
  primary key (kullanici, gun)
);
alter table public.hickirik_taniklari enable row level security;

create or replace function public.hickirik_bugun() returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  g date := (now() at time zone 'Europe/Istanbul')::date;
  b timestamptz;
  var boolean;
begin
  select bas, true into b, var from public.hickirik_olaylari where gun = g;
  if var is null then
    /* üç günden biri hıçkırıksız geçer */
    if random() < 0.34 then b := null;
    else b := (g::timestamp + interval '9 hours' + random() * interval '14 hours') at time zone 'Europe/Istanbul'; end if;
    insert into public.hickirik_olaylari (gun, bas) values (g, b) on conflict (gun) do nothing;
    select bas into b from public.hickirik_olaylari where gun = g;
  end if;
  return b;
end;
$$;

create or replace function public.hickirik_durum() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b timestamptz := public.hickirik_bugun();
begin
  if b is not null and now() >= b and now() < b + interval '3 minutes' then
    return jsonb_build_object('aktif', true, 'kalan', extract(epoch from (b + interval '3 minutes' - now()))::int);
  end if;
  return jsonb_build_object('aktif', false);
end;
$$;

create or replace function public.hickirik_tanik() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b timestamptz := public.hickirik_bugun();
  g date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if auth.uid() is null then return jsonb_build_object('durum', 'giris'); end if;
  if b is null or now() < b or now() > b + interval '4 minutes' then return jsonb_build_object('durum', 'gec'); end if;
  insert into public.hickirik_taniklari (kullanici, gun) values (auth.uid(), g) on conflict do nothing;
  return jsonb_build_object('durum', 'tamam',
    'toplam', (select count(*) from public.hickirik_taniklari where kullanici = auth.uid()),
    'bugun', (select count(*) from public.hickirik_taniklari where gun = g));
end;
$$;

-- Arşiv avı: ipuçları sitede (veri.json), son cevabın özeti yalnızca burada.
create table if not exists public.av_sezonlari (sezon int primary key, ozet text not null, ad text not null);
alter table public.av_sezonlari enable row level security;
insert into public.av_sezonlari (sezon, ozet, ad)
values (1, 'c49b0f1b4adc47d356ca82227869e147455c4862838fcc9f6a2588c02cd53046', 'İlk Kayıt')
on conflict (sezon) do update set ozet = excluded.ozet, ad = excluded.ad;

create table if not exists public.av_cozumleri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  sezon int not null references public.av_sezonlari(sezon) on delete cascade,
  zaman timestamptz not null default now(),
  primary key (kullanici, sezon)
);
alter table public.av_cozumleri enable row level security;

create table if not exists public.av_denemeleri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  zaman timestamptz not null default now()
);
alter table public.av_denemeleri enable row level security;

create or replace function public.av_normal(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(lower(translate(coalesce(t, ''), 'ıİŞşĞğÜüÖöÇçÂâÎîÛû', 'iissgguuooccaaiiuu')), '[^a-z0-9]', '', 'g')
$$;

create or replace function public.av_coz(p_sezon int, p_cevap text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  o text;
begin
  if u is null then return jsonb_build_object('durum', 'giris'); end if;
  if exists (select 1 from public.av_cozumleri where kullanici = u and sezon = p_sezon) then
    return jsonb_build_object('durum', 'zaten');
  end if;
  if (select count(*) from public.av_denemeleri where kullanici = u and zaman > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  insert into public.av_denemeleri (kullanici) values (u);
  select ozet into o from public.av_sezonlari where sezon = p_sezon;
  if o is null then return jsonb_build_object('durum', 'yok'); end if;
  if encode(sha256(convert_to(public.av_normal(p_cevap) || '#av', 'UTF8')), 'hex') <> o then
    return jsonb_build_object('durum', 'yanlis');
  end if;
  insert into public.av_cozumleri (kullanici, sezon) values (u, p_sezon);
  return jsonb_build_object('durum', 'tamam',
    'sira', (select count(*) from public.av_cozumleri where sezon = p_sezon));
end;
$$;

-- ======================================================================
-- ====== TOPLULUK II: DEFTER, YAZARA SOR, KULÜP, OKUR BULMACASI, DAVET ======
-- ======================================================================

create or replace function public.tomye_hafta(t timestamptz default now()) returns text
language sql stable set search_path = '' as $$
  select to_char(t at time zone 'Europe/Istanbul', 'IYYY-"H"IW')
$$;

-- ---------- Kütüphane Defteri: herkes günde bir cümle, haftalık bölüm ----------
create table if not exists public.defter_cumleleri (
  id bigserial primary key,
  kullanici uuid not null references auth.users(id) on delete cascade,
  hafta text not null,
  metin text not null check (char_length(metin) between 10 and 220),
  zaman timestamptz not null default now(),
  gizli boolean not null default false
);
alter table public.defter_cumleleri enable row level security;
create index if not exists defter_hafta on public.defter_cumleleri (hafta, zaman);
create table if not exists public.defter_oylari (
  kullanici uuid not null references auth.users(id) on delete cascade,
  cumle bigint not null references public.defter_cumleleri(id) on delete cascade,
  primary key (kullanici, cumle)
);
alter table public.defter_oylari enable row level security;
create table if not exists public.defter_bildirimleri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  cumle bigint not null references public.defter_cumleleri(id) on delete cascade,
  primary key (kullanici, cumle)
);
alter table public.defter_bildirimleri enable row level security;

create or replace function public.defter_yaz(p_metin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m text := trim(coalesce(p_metin, ''));
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if exists (select 1 from public.istatistikler where id = uid and engelli) then return jsonb_build_object('durum', 'engelli'); end if;
  if char_length(m) < 10 then return jsonb_build_object('durum', 'kisa'); end if;
  if exists (select 1 from public.defter_cumleleri where kullanici = uid
             and (zaman at time zone 'Europe/Istanbul')::date = (now() at time zone 'Europe/Istanbul')::date) then
    return jsonb_build_object('durum', 'bugun');
  end if;
  insert into public.defter_cumleleri (kullanici, hafta, metin) values (uid, public.tomye_hafta(), left(m, 220));
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.defter_oyla(p_cumle bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  if exists (select 1 from public.defter_oylari where kullanici = uid and cumle = p_cumle) then
    delete from public.defter_oylari where kullanici = uid and cumle = p_cumle; return false;
  end if;
  insert into public.defter_oylari (kullanici, cumle) select uid, p_cumle
    where exists (select 1 from public.defter_cumleleri where id = p_cumle and kullanici <> uid);
  return found;
end;
$$;

create or replace function public.defter_bildir(p_cumle bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.defter_bildirimleri (kullanici, cumle) select auth.uid(), p_cumle
    where exists (select 1 from public.defter_cumleleri where id = p_cumle and kullanici <> auth.uid()) on conflict do nothing;
  if (select count(*) from public.defter_bildirimleri where cumle = p_cumle) >= 3 then
    update public.defter_cumleleri set gizli = true where id = p_cumle;
  end if;
end;
$$;

create or replace function public.defter_sil(p_cumle bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.defter_cumleleri where id = p_cumle and (kullanici = auth.uid() or public.yonetici_mi());
end;
$$;

-- ---------- Yazara sor ----------
create table if not exists public.yazar_sorulari (
  id bigserial primary key,
  kullanici uuid not null references auth.users(id) on delete cascade,
  metin text not null check (char_length(metin) between 10 and 300),
  zaman timestamptz not null default now(),
  cevap text check (char_length(cevap) <= 2000),
  cevap_zaman timestamptz,
  gizli boolean not null default false
);
alter table public.yazar_sorulari enable row level security;
create table if not exists public.yazar_soru_oylari (
  kullanici uuid not null references auth.users(id) on delete cascade,
  soru bigint not null references public.yazar_sorulari(id) on delete cascade,
  primary key (kullanici, soru)
);
alter table public.yazar_soru_oylari enable row level security;

create or replace function public.yazara_sor(p_metin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m text := trim(coalesce(p_metin, ''));
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if exists (select 1 from public.istatistikler where id = uid and engelli) then return jsonb_build_object('durum', 'engelli'); end if;
  if char_length(m) < 10 then return jsonb_build_object('durum', 'kisa'); end if;
  if (select count(*) from public.yazar_sorulari where kullanici = uid and zaman > now() - interval '1 day') >= 3 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  insert into public.yazar_sorulari (kullanici, metin) values (uid, left(m, 300));
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.yazar_soru_oyla(p_soru bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  if exists (select 1 from public.yazar_soru_oylari where kullanici = uid and soru = p_soru) then
    delete from public.yazar_soru_oylari where kullanici = uid and soru = p_soru; return false;
  end if;
  insert into public.yazar_soru_oylari (kullanici, soru) select uid, p_soru
    where exists (select 1 from public.yazar_sorulari where id = p_soru and kullanici <> uid and not gizli);
  return found;
end;
$$;

create or replace function public.yazar_cevapla(p_soru bigint, p_cevap text, p_gizle boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
  update public.yazar_sorulari
    set cevap = nullif(trim(coalesce(p_cevap, '')), ''), cevap_zaman = case when nullif(trim(coalesce(p_cevap, '')), '') is null then null else now() end,
        gizli = p_gizle
    where id = p_soru;
end;
$$;

create or replace function public.yazar_soru_sil(p_soru bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.yazar_sorulari where id = p_soru and ((kullanici = auth.uid() and cevap is null) or public.yonetici_mi());
end;
$$;

-- ---------- Kulüp duvarı ve haftalık kulüp hedefi ----------
create table if not exists public.kulup_mesajlari (
  id bigserial primary key,
  kullanici uuid not null references auth.users(id) on delete cascade,
  kisilik text not null,
  metin text not null check (char_length(metin) between 2 and 200),
  zaman timestamptz not null default now(),
  gizli boolean not null default false
);
alter table public.kulup_mesajlari enable row level security;
create index if not exists kulup_mesajlari_kulup on public.kulup_mesajlari (kisilik, zaman);
create table if not exists public.kulup_bildirimleri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  mesaj bigint not null references public.kulup_mesajlari(id) on delete cascade,
  primary key (kullanici, mesaj)
);
alter table public.kulup_bildirimleri enable row level security;

create or replace function public.kulup_yaz(p_metin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); k text; m text := trim(coalesce(p_metin, ''));
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  select kisilik into k from public.istatistikler where id = uid and not engelli;
  if k is null then return jsonb_build_object('durum', 'kulupsuz'); end if;
  if char_length(m) < 2 then return jsonb_build_object('durum', 'kisa'); end if;
  if (select count(*) from public.kulup_mesajlari where kullanici = uid and zaman > now() - interval '1 day') >= 20 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  insert into public.kulup_mesajlari (kullanici, kisilik, metin) values (uid, k, left(m, 200));
  return jsonb_build_object('durum', 'tamam', 'kulup', k);
end;
$$;

create or replace function public.kulup_bildir(p_mesaj bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.kulup_bildirimleri (kullanici, mesaj) select auth.uid(), p_mesaj
    where exists (select 1 from public.kulup_mesajlari where id = p_mesaj and kullanici <> auth.uid()) on conflict do nothing;
  if (select count(*) from public.kulup_bildirimleri where mesaj = p_mesaj) >= 3 then
    update public.kulup_mesajlari set gizli = true where id = p_mesaj;
  end if;
end;
$$;

create or replace function public.kulup_sil(p_mesaj bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.kulup_mesajlari where id = p_mesaj and (kullanici = auth.uid() or public.yonetici_mi());
end;
$$;

-- ---------- Okur bulmacaları ----------
create table if not exists public.okur_bulmacalari (
  id bigserial primary key,
  kullanici uuid not null references auth.users(id) on delete cascade,
  tur text not null check (tur in ('kyldo', 'isim')),
  soru text not null check (char_length(soru) between 2 and 40),
  ipucu text check (char_length(ipucu) <= 120),
  cevap_ozet text not null,
  zaman timestamptz not null default now(),
  gizli boolean not null default false
);
alter table public.okur_bulmacalari enable row level security;
create table if not exists public.okur_bulmaca_cozumleri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  bulmaca bigint not null references public.okur_bulmacalari(id) on delete cascade,
  zaman timestamptz not null default now(),
  primary key (kullanici, bulmaca)
);
alter table public.okur_bulmaca_cozumleri enable row level security;
create table if not exists public.okur_bulmaca_denemeleri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  zaman timestamptz not null default now()
);
alter table public.okur_bulmaca_denemeleri enable row level security;

/* isim sisteminin harf çevirisi (js/04 SES_CIFTI ile aynı) */
create or replace function public.isim_cevir(t text) returns text
language sql immutable set search_path = '' as $$
  select translate(lower(coalesce(t, '')), 'bpcçdtgkvfzsjşrlnmaeıioöuü', 'pbçctdkgfvszşjlrmneaiıuoüö')
$$;

create or replace function public.okur_bulmaca_yaz(p_tur text, p_cevap text, p_ipucu text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c text := lower(trim(coalesce(p_cevap, ''))); soru text; yeni bigint;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if exists (select 1 from public.istatistikler where id = uid and engelli) then return jsonb_build_object('durum', 'engelli'); end if;
  if c !~ '^[a-zçğıöşü]{2,20}$' then return jsonb_build_object('durum', 'kelime'); end if;
  if (select count(*) from public.okur_bulmacalari where kullanici = uid and zaman > now() - interval '1 day') >= 5 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  soru := case when p_tur = 'isim' then public.isim_cevir(c) else c end;
  soru := upper(left(soru, 1)) || substr(soru, 2);
  insert into public.okur_bulmacalari (kullanici, tur, soru, ipucu, cevap_ozet)
    values (uid, p_tur, soru, nullif(left(trim(coalesce(p_ipucu, '')), 120), ''), 'gecici') returning id into yeni;
  update public.okur_bulmacalari set cevap_ozet = encode(sha256(convert_to(public.av_normal(c) || '#ob' || yeni, 'UTF8')), 'hex') where id = yeni;
  return jsonb_build_object('durum', 'tamam', 'id', yeni);
end;
$$;

create or replace function public.okur_bulmaca_coz(p_bulmaca bigint, p_cevap text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); b record;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  select * into b from public.okur_bulmacalari where id = p_bulmaca and not gizli;
  if b is null then return jsonb_build_object('durum', 'yok'); end if;
  if b.kullanici = uid then return jsonb_build_object('durum', 'kendi'); end if;
  if exists (select 1 from public.okur_bulmaca_cozumleri where kullanici = uid and bulmaca = p_bulmaca) then return jsonb_build_object('durum', 'zaten'); end if;
  if (select count(*) from public.okur_bulmaca_denemeleri where kullanici = uid and zaman > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  insert into public.okur_bulmaca_denemeleri (kullanici) values (uid);
  if encode(sha256(convert_to(public.av_normal(p_cevap) || '#ob' || p_bulmaca, 'UTF8')), 'hex') <> b.cevap_ozet then
    return jsonb_build_object('durum', 'yanlis');
  end if;
  insert into public.okur_bulmaca_cozumleri (kullanici, bulmaca) values (uid, p_bulmaca);
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.okur_bulmaca_sil(p_bulmaca bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.okur_bulmacalari where id = p_bulmaca and (kullanici = auth.uid() or public.yonetici_mi());
end;
$$;

-- ---------- Davet ve rehberlik ----------
create table if not exists public.davetler (
  davetli uuid primary key references auth.users(id) on delete cascade,
  davet_eden uuid not null references auth.users(id) on delete cascade,
  zaman timestamptz not null default now()
);
alter table public.davetler enable row level security;

create or replace function public.davet_kaydet(p_ad text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); eden uuid;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if exists (select 1 from public.davetler where davetli = uid) then return jsonb_build_object('durum', 'zaten'); end if;
  if (select created_at from auth.users where id = uid) < now() - interval '7 days' then return jsonb_build_object('durum', 'eski'); end if;
  select id into eden from public.profiller where kullanici_adi = lower(trim(coalesce(p_ad, '')));
  if eden is null or eden = uid then return jsonb_build_object('durum', 'yok'); end if;
  insert into public.davetler (davetli, davet_eden) values (uid, eden);
  return jsonb_build_object('durum', 'tamam');
end;
$$;

/* ilk hafta tamam: davetli en az 3 farklı gün gelmiş (istatistikler.gun) */
create or replace function public.davet_durumum() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'davet_ettigim', (select count(*) from public.davetler where davet_eden = auth.uid()),
    'tamamlayan', (select count(*) from public.davetler d join public.istatistikler s on s.id = d.davetli
                    where d.davet_eden = auth.uid() and coalesce(s.gun, 0) >= 3),
    'davet_eden', (select p.kullanici_adi from public.davetler d join public.profiller p on p.id = d.davet_eden where d.davetli = auth.uid()),
    'benim_haftam', coalesce((select s.gun >= 3 from public.davetler d join public.istatistikler s on s.id = d.davetli where d.davetli = auth.uid()), false))
$$;

-- Arşivci seviyesi: bütün ilerlemeden sunucuda hesaplanan XP.
-- Aynı XP iki sistemi besler:
--   seviye  : arşivci seviyesi (unvanlar), gereken XP = 60·(seviye−1)²
--   basamak : Tömye basamağı, gereken XP = 5·(basamak−1)·(basamak+4); Tömye rakamlarıyla yazılır (Neo … Net, sıfırsız onluk)
-- dokum: XP'nin kaynaklara göre dağılımı (herkese açık; ayrıntı içermez)
create or replace view public.arsivci_seviyeleri as
  with p as (
    select p.id, p.kullanici_adi, p.gorunen_ad, s.tamlik, s.gun, s.madalya, s.katman, s.okunan_kutu, s.oyun_xp
    from public.profiller p left join public.istatistikler s on s.id = p.id
    where p.kullanici_adi is not null and not coalesce(s.engelli or s.askida, false)),
  x as (
    select p.*,
      coalesce(p.tamlik, 0) * 20 as x_tamlik,
      coalesce(p.gun, 0) * 5 as x_gun,
      coalesce(p.madalya, 0) * 30 as x_madalya,
      coalesce(p.katman, 0) * 40 as x_katman,
      coalesce(p.okunan_kutu, 0) * 10 as x_okuma,
      coalesce(p.oyun_xp, 0) as x_oyun,
      -- yarış: günde (UTC) yalnızca ilk 3 geçerli oyun XP verir; puansız (cevapsız) oyun sayılmaz
      10 * (select count(*) from (select row_number() over (partition by (y.zaman at time zone 'utc')::date order by y.zaman) as sira
              from public.yaris_skorlari y where y.kullanici = p.id and not y.supheli and y.puan > 0) q where q.sira <= 3) as x_yaris,
      15 * (select count(*) from public.kesifler k where k.kullanici = p.id) as x_kesif,
      25 * (select count(*) from public.kesifler k where k.kullanici = p.id
              and not exists (select 1 from public.kesifler k2 where k2.anahtar = k.anahtar and k2.zaman < k.zaman)) as x_ilk_kasif,
      25 * (select count(*) from public.gk_tahminler g where g.kullanici = p.id and g.cozuldu) as x_gk,
      5 * (select count(*) from public.teoriler t where t.kullanici = p.id and not t.gizli) as x_teori,
      3 * (select count(*) from public.teori_begenileri b join public.teoriler t on t.id = b.teori
             where t.kullanici = p.id and not t.gizli and b.kullanici <> p.id) as x_begeni,
      50 * (select count(*) from public.teoriler t where t.kullanici = p.id and t.isaret = 'kanon')
      + 20 * (select count(*) from public.teoriler t where t.kullanici = p.id and t.isaret = 'yakin') as x_isaret,
      5 * (select count(*) from public.yapim_oylari o where o.kullanici = p.id) as x_oy,
      20 * (select count(*) from public.hickirik_taniklari h where h.kullanici = p.id) as x_hickirik,
      100 * (select count(*) from public.av_cozumleri a where a.kullanici = p.id) as x_av,
      10 * (select count(*) from public.defter_cumleleri c where c.kullanici = p.id and not c.gizli)
      + 2 * (select count(*) from public.defter_oylari o join public.defter_cumleleri c on c.id = o.cumle where c.kullanici = p.id and not c.gizli) as x_defter,
      15 * (select count(*) from public.yazar_sorulari q where q.kullanici = p.id and q.cevap is not null) as x_soru,
      5 * (select count(*) from public.okur_bulmaca_cozumleri z where z.kullanici = p.id)
      + least(100, 2 * (select count(*) from public.okur_bulmaca_cozumleri z join public.okur_bulmacalari b on b.id = z.bulmaca where b.kullanici = p.id)) as x_okur_bulmaca,
      least(500, 50 * (select count(*) from public.davetler d join public.istatistikler s2 on s2.id = d.davetli where d.davet_eden = p.id and coalesce(s2.gun, 0) >= 3))
      + 30 * (select count(*) from public.davetler d join public.istatistikler s2 on s2.id = d.davetli where d.davetli = p.id and coalesce(s2.gun, 0) >= 3) as x_davet,
      10 * (select count(*) from (select y.sezon, row_number() over (partition by (y.zaman at time zone 'utc')::date order by y.zaman) as sira
              from public.yaris_skorlari y where y.kullanici = p.id and not y.supheli and y.puan > 0) q
            where q.sira <= 3 and q.sezon / 100 = public.tomye_ay(now()) / 100)
      + 25 * (select count(*) from public.gk_tahminler g where g.kullanici = p.id and g.cozuldu and public.tomye_ay(g.gun::timestamptz) / 100 = public.tomye_ay(now()) / 100)
      + 15 * (select count(*) from public.kesifler k where k.kullanici = p.id and public.tomye_ay(k.zaman) / 100 = public.tomye_ay(now()) / 100) as yil_xp
    from p),
  t as (
    select x.*, x_tamlik + x_gun + x_madalya + x_katman + x_yaris + x_kesif + x_ilk_kasif + x_gk + x_teori + x_begeni + x_isaret + x_oy + x_hickirik + x_av + x_defter + x_soru + x_okur_bulmaca + x_davet + x_okuma + x_oyun as xp
    from x)
  select kullanici_adi, gorunen_ad, xp, yil_xp,
    (floor(sqrt(xp / 60.0)) + 1)::int as seviye,
    floor((-3 + sqrt(25 + 0.8 * xp)) / 2)::int as basamak,
    jsonb_build_object('tamlik', x_tamlik, 'gun', x_gun, 'madalya', x_madalya, 'katman', x_katman, 'yaris', x_yaris,
      'kesif', x_kesif, 'ilk_kasif', x_ilk_kasif, 'gk', x_gk, 'teori', x_teori, 'begeni', x_begeni,
      'isaret', x_isaret, 'oy', x_oy, 'hickirik', x_hickirik, 'av', x_av,
      'defter', x_defter, 'soru', x_soru, 'okur_bulmaca', x_okur_bulmaca, 'davet', x_davet, 'okuma', x_okuma, 'oyun', x_oyun) as dokum
  from t;

-- Yönetici istatistikleri
create or replace function public.site_istatistik() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('istatistik') then raise exception 'yetki yok'; end if;
  return jsonb_build_object(
    'kullanici', (select count(*) from auth.users),
    'profil', (select count(*) from public.profiller where kullanici_adi is not null),
    'aktif7', (select count(distinct k) from (
        select kullanici k from public.yaris_oturumlari where baslangic > now() - interval '7 days'
        union select id from public.istatistikler where guncelleme > now() - interval '7 days') a),
    'gunluk', (select jsonb_agg(jsonb_build_object('gun', g::date,
        'kayit', (select count(*) from auth.users u where (u.created_at at time zone 'utc')::date = g::date),
        'aktif', (select count(distinct kullanici) from public.yaris_oturumlari o where (o.baslangic at time zone 'utc')::date = g::date),
        'yaris', (select count(*) from public.yaris_skorlari y where (y.zaman at time zone 'utc')::date = g::date)) order by g)
      from generate_series((now() at time zone 'utc')::date - 13, (now() at time zone 'utc')::date, interval '1 day') g),
    'yarislar', (select coalesce(jsonb_agg(jsonb_build_object('yaris', yaris, 'oyun', n) order by n desc), '[]'::jsonb)
      from (select yaris, count(*) n from public.yaris_skorlari where zaman > now() - interval '30 days' group by yaris) y),
    'kulupler', (select coalesce(jsonb_agg(jsonb_build_object('kisilik', kisilik, 'uye', n) order by n desc), '[]'::jsonb)
      from (select kisilik, count(*) n from public.istatistikler where kisilik is not null group by kisilik) k),
    'teori', (select count(*) from public.teoriler),
    'teori_bekleyen', (select count(*) from public.teoriler where gizli),
    'hata_bugun', (select coalesce(sum(sayi), 0) from public.hata_kayitlari where gun = (now() at time zone 'utc')::date),
    'supheli7', (select count(*) from public.liderlik_suphe where zaman > now() - interval '7 days'));
end;
$$;

-- Yönetici yedeği: bütün tablolar tek JSON
create or replace function public.yedek_al() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  return jsonb_build_object(
    'zaman', now(),
    'kullanicilar', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at)), '[]') from auth.users),  -- e-posta bilerek yok
    'profiller', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.profiller t),
    'ilerlemeler', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.ilerlemeler t),
    'istatistikler', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.istatistikler t),
    'yaris_skorlari', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.yaris_skorlari t),
    'gk_tahminler', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.gk_tahminler t),
    'evren_defteri', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.evren_defteri t),
    'kesifler', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.kesifler t),
    'bulmaca_cozumleri', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.bulmaca_cozumleri t),
    'bildirimler', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.bildirimler t),
    'teoriler', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.teoriler t),
    'teori_begenileri', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.teori_begenileri t),
    'yapim_oylari', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.yapim_oylari t),
    'takipler', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.takipler t),
    'yoneticiler', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.yoneticiler t),
    'liderlik_ayar', (select to_jsonb(t) from public.liderlik_ayar t where id = 1));
end;
$$;

-- ---------- herkese açık görünümler ----------
drop view if exists public.teori_listesi;
drop view if exists public.teori_rozetleri;
drop view if exists public.yapim_oy_sayilari;
drop view if exists public.takip_sayilari;

create view public.teori_listesi as
  select t.id, t.konu, t.metin, t.zaman, t.isaret, p.kullanici_adi, p.gorunen_ad,
         (select count(*) from public.teori_begenileri b where b.teori = t.id) as begeni,
         exists (select 1 from public.teori_begenileri b where b.teori = t.id and b.kullanici = auth.uid()) as ben_begendim,
         t.kullanici = auth.uid() as benim
  from public.teoriler t join public.profiller p on p.id = t.kullanici
  left join public.istatistikler s on s.id = t.kullanici
  where not t.gizli and p.kullanici_adi is not null and not coalesce(s.engelli, false);

create view public.teori_rozetleri as
  select p.kullanici_adi, count(*) filter (where t.isaret = 'kanon') as kanon, count(*) filter (where t.isaret = 'yakin') as yakin
  from public.teoriler t join public.profiller p on p.id = t.kullanici
  where t.isaret is not null and not t.gizli group by p.kullanici_adi;

create view public.yapim_oy_sayilari as
  select o.ad as yapim, count(y.kullanici) as oy from public.oylanabilir o
  left join public.yapim_oylari y on y.yapim = o.ad group by o.ad;

create view public.takip_sayilari as
  select p.kullanici_adi,
    (select count(*) from public.takipler t where t.takip_edilen = p.id) as takipci,
    (select count(*) from public.takipler t where t.takip_eden = p.id) as takip
  from public.profiller p where p.kullanici_adi is not null;

grant select on public.teori_listesi, public.teori_rozetleri, public.yapim_oy_sayilari, public.takip_sayilari,
                public.arsivci_seviyeleri to anon, authenticated;

revoke insert, update, delete on public.hata_kayitlari, public.teoriler, public.teori_begenileri, public.teori_bildirimleri,
  public.oylanabilir, public.yapim_oylari, public.takipler from anon, authenticated;
revoke select on public.teoriler, public.teori_begenileri, public.teori_bildirimleri, public.yapim_oylari, public.takipler
  from anon, authenticated;
revoke execute on function public.hesabimi_sil(), public.hata_temizle(), public.teori_yaz(text, text), public.teori_begen(bigint),
  public.teori_bildir(bigint), public.teori_sil(bigint), public.teori_isaretle(bigint, text, boolean), public.yapim_oyla(text),
  public.oylarim(), public.takip_et(text), public.takip_ettiklerim(), public.gk_seri(), public.haftalik_ilerleme(),
  public.site_istatistik(), public.yedek_al(), public.teori_denetim() from public, anon;
grant execute on function public.hesabimi_sil(), public.hata_temizle(), public.teori_yaz(text, text), public.teori_begen(bigint),
  public.teori_bildir(bigint), public.teori_sil(bigint), public.teori_isaretle(bigint, text, boolean), public.yapim_oyla(text),
  public.oylarim(), public.takip_et(text), public.takip_ettiklerim(), public.gk_seri(), public.haftalik_ilerleme(),
  public.site_istatistik(), public.yedek_al(), public.teori_denetim() to authenticated;
-- hata kaydı hesapsız ziyaretçiden de gelebilir
grant execute on function public.hata_kaydet(text, text, text, text, text) to anon, authenticated;

-- Hıçkırık ve arşiv avı: herkese açık sayılar
create or replace view public.hickirik_sayilari as
  select g.kullanici_adi, g.gorunen_ad, count(*) as tanik, max(t.gun) as son
  from public.hickirik_taniklari t join public.gorunur_kullanicilar g on g.id = t.kullanici
  group by g.kullanici_adi, g.gorunen_ad;

create or replace view public.av_cozenler as
  select a.sezon, g.kullanici_adi, g.gorunen_ad, a.zaman,
         row_number() over (partition by a.sezon order by a.zaman) as sira
  from public.av_cozumleri a join public.gorunur_kullanicilar g on g.id = a.kullanici;

grant select on public.hickirik_sayilari, public.av_cozenler to anon, authenticated;
revoke all on public.hickirik_olaylari, public.hickirik_taniklari, public.av_sezonlari, public.av_cozumleri,
  public.av_denemeleri from anon, authenticated;
revoke execute on function public.hickirik_bugun(), public.hickirik_tanik(), public.av_coz(int, text) from public, anon;
grant execute on function public.hickirik_tanik(), public.av_coz(int, text) to authenticated;
grant execute on function public.hickirik_durum() to anon, authenticated;

-- ======================================================================
-- ================= OKUMA: TEPKİLER ve KENAR NOTLARI ==================
-- ======================================================================
-- hedef: okunan şeyin kimliği, ör. 'roman:3', 'ce:cl_h1'

create table if not exists public.tepkiler (
  kullanici uuid not null references auth.users(id) on delete cascade,
  hedef text not null check (hedef ~ '^[a-z]{1,10}:[A-Za-z0-9_-]{1,40}$'),
  tepki text not null check (tepki in ('buz', 'kalp', 'yildiz', 'soru')),
  zaman timestamptz not null default now(),
  primary key (kullanici, hedef, tepki)
);
alter table public.tepkiler enable row level security;

create table if not exists public.kenar_notlari (
  id bigserial primary key,
  kullanici uuid not null references auth.users(id) on delete cascade,
  hedef text not null check (hedef ~ '^[a-z]{1,10}:[A-Za-z0-9_-]{1,40}$'),
  metin text not null check (char_length(metin) between 3 and 280),
  zaman timestamptz not null default now(),
  gizli boolean not null default false
);
alter table public.kenar_notlari enable row level security;
create index if not exists kenar_notlari_hedef on public.kenar_notlari (hedef, zaman);

create table if not exists public.kenar_not_bildirimleri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  not_id bigint not null references public.kenar_notlari(id) on delete cascade,
  zaman timestamptz not null default now(),
  primary key (kullanici, not_id)
);
alter table public.kenar_not_bildirimleri enable row level security;

create or replace function public.tepki_ver(p_hedef text, p_tepki text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  if exists (select 1 from public.tepkiler where kullanici = uid and hedef = p_hedef and tepki = p_tepki) then
    delete from public.tepkiler where kullanici = uid and hedef = p_hedef and tepki = p_tepki;
    return false;
  end if;
  if (select count(*) from public.tepkiler where kullanici = uid and zaman > now() - interval '1 hour') >= 120 then
    raise exception 'çok hızlı';
  end if;
  insert into public.tepkiler (kullanici, hedef, tepki) values (uid, p_hedef, p_tepki);
  return true;
end;
$$;

create or replace function public.tepkilerim(p_hedef text) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(tepki), '{}') from public.tepkiler where kullanici = auth.uid() and hedef = p_hedef
$$;

create or replace function public.kenar_not_yaz(p_hedef text, p_metin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); yeni bigint;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if exists (select 1 from public.istatistikler where id = uid and engelli) then return jsonb_build_object('durum', 'engelli'); end if;
  if char_length(trim(coalesce(p_metin, ''))) < 3 then return jsonb_build_object('durum', 'kisa'); end if;
  if (select count(*) from public.kenar_notlari where kullanici = uid and zaman > now() - interval '1 day') >= 10 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  insert into public.kenar_notlari (kullanici, hedef, metin) values (uid, p_hedef, left(trim(p_metin), 280)) returning id into yeni;
  return jsonb_build_object('durum', 'tamam', 'id', yeni);
end;
$$;

create or replace function public.kenar_not_bildir(p_not bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return 'giris'; end if;
  if (select count(*) from public.kenar_not_bildirimleri where kullanici = uid and zaman > now() - interval '1 day') >= 10 then return 'sinir'; end if;
  insert into public.kenar_not_bildirimleri (kullanici, not_id) select uid, p_not
    where exists (select 1 from public.kenar_notlari where id = p_not and kullanici <> uid) on conflict do nothing;
  if (select count(*) from public.kenar_not_bildirimleri where not_id = p_not) >= 3 then
    update public.kenar_notlari set gizli = true where id = p_not;
  end if;
  return 'tamam';
end;
$$;

create or replace function public.kenar_not_sil(p_not bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.kenar_notlari where id = p_not and (kullanici = auth.uid() or public.yonetici_mi());
end;
$$;

create or replace view public.tepki_sayilari as
  select hedef, tepki, count(*) as sayi from public.tepkiler group by hedef, tepki;

create or replace view public.kenar_notlari_listesi as
  select n.id, n.hedef, n.metin, n.zaman, g.kullanici_adi, g.gorunen_ad, (n.kullanici = auth.uid()) as benim
  from public.kenar_notlari n join public.gorunur_kullanicilar g on g.id = n.kullanici
  where not n.gizli;

grant select on public.tepki_sayilari, public.kenar_notlari_listesi to anon, authenticated;
revoke all on public.tepkiler, public.kenar_notlari, public.kenar_not_bildirimleri from anon, authenticated;
revoke execute on function public.tepki_ver(text, text), public.tepkilerim(text), public.kenar_not_yaz(text, text),
  public.kenar_not_bildir(bigint), public.kenar_not_sil(bigint) from public, anon;
grant execute on function public.tepki_ver(text, text), public.tepkilerim(text), public.kenar_not_yaz(text, text),
  public.kenar_not_bildir(bigint), public.kenar_not_sil(bigint) to authenticated;

-- Topluluk II: herkese açık görünümler
create or replace view public.defter_listesi as
  select c.id, c.hafta, c.metin, c.zaman, g.kullanici_adi, g.gorunen_ad,
    (select count(*) from public.defter_oylari o where o.cumle = c.id) as oy,
    exists (select 1 from public.defter_oylari o where o.cumle = c.id and o.kullanici = auth.uid()) as ben_oyladim,
    (c.kullanici = auth.uid()) as benim
  from public.defter_cumleleri c join public.gorunur_kullanicilar g on g.id = c.kullanici
  where not c.gizli;

create or replace view public.yazara_sorular as
  select q.id, q.metin, q.zaman, q.cevap, q.cevap_zaman, g.kullanici_adi, g.gorunen_ad,
    (select count(*) from public.yazar_soru_oylari o where o.soru = q.id) as oy,
    exists (select 1 from public.yazar_soru_oylari o where o.soru = q.id and o.kullanici = auth.uid()) as ben_oyladim,
    (q.kullanici = auth.uid()) as benim
  from public.yazar_sorulari q join public.gorunur_kullanicilar g on g.id = q.kullanici
  where not q.gizli;

create or replace view public.kulup_duvari as
  select m.id, m.kisilik, m.metin, m.zaman, g.kullanici_adi, g.gorunen_ad, (m.kullanici = auth.uid()) as benim
  from public.kulup_mesajlari m join public.gorunur_kullanicilar g on g.id = m.kullanici
  where not m.gizli;

/* haftalık kulüp hedefi: kulüp üyelerinin bu haftaki geçerli yarış oyunları */
create or replace view public.kulup_haftasi as
  select s.kisilik, count(y.*) as yaris, 60 as hedef
  from public.istatistikler s
  left join public.yaris_skorlari y on y.kullanici = s.id and not y.supheli
    and public.tomye_hafta(y.zaman) = public.tomye_hafta()
  where s.kisilik is not null and not coalesce(s.engelli, false)
  group by s.kisilik;

create or replace view public.okur_bulmaca_listesi as
  select b.id, b.tur, b.soru, b.ipucu, b.zaman, g.kullanici_adi, g.gorunen_ad,
    (select count(*) from public.okur_bulmaca_cozumleri z where z.bulmaca = b.id) as cozen,
    exists (select 1 from public.okur_bulmaca_cozumleri z where z.bulmaca = b.id and z.kullanici = auth.uid()) as cozdum,
    (b.kullanici = auth.uid()) as benim
  from public.okur_bulmacalari b join public.gorunur_kullanicilar g on g.id = b.kullanici
  where not b.gizli;

create or replace view public.rehber_sayilari as
  select g.kullanici_adi, count(*) as rehber
  from public.davetler d join public.istatistikler s on s.id = d.davetli and coalesce(s.gun, 0) >= 3
  join public.gorunur_kullanicilar g on g.id = d.davet_eden
  group by g.kullanici_adi;

grant select on public.defter_listesi, public.yazara_sorular, public.kulup_duvari, public.kulup_haftasi,
  public.okur_bulmaca_listesi, public.rehber_sayilari to anon, authenticated;
revoke all on public.defter_cumleleri, public.defter_oylari, public.defter_bildirimleri, public.yazar_sorulari,
  public.yazar_soru_oylari, public.kulup_mesajlari, public.kulup_bildirimleri, public.okur_bulmacalari,
  public.okur_bulmaca_cozumleri, public.okur_bulmaca_denemeleri, public.davetler from anon, authenticated;
revoke execute on function public.defter_yaz(text), public.defter_oyla(bigint), public.defter_bildir(bigint), public.defter_sil(bigint),
  public.yazara_sor(text), public.yazar_soru_oyla(bigint), public.yazar_cevapla(bigint, text, boolean), public.yazar_soru_sil(bigint),
  public.kulup_yaz(text), public.kulup_bildir(bigint), public.kulup_sil(bigint),
  public.okur_bulmaca_yaz(text, text, text), public.okur_bulmaca_coz(bigint, text), public.okur_bulmaca_sil(bigint),
  public.davet_kaydet(text), public.davet_durumum() from public, anon;
grant execute on function public.defter_yaz(text), public.defter_oyla(bigint), public.defter_bildir(bigint), public.defter_sil(bigint),
  public.yazara_sor(text), public.yazar_soru_oyla(bigint), public.yazar_cevapla(bigint, text, boolean), public.yazar_soru_sil(bigint),
  public.kulup_yaz(text), public.kulup_bildir(bigint), public.kulup_sil(bigint),
  public.okur_bulmaca_yaz(text, text, text), public.okur_bulmaca_coz(bigint, text), public.okur_bulmaca_sil(bigint),
  public.davet_kaydet(text), public.davet_durumum() to authenticated;

-- ---------- Web Push: yeni bölüm bildirimi ----------
-- Abonelikleri yalnızca sunucu tarafı (Edge Function, service role) okur. Ziyaretçi yalnızca kendi
-- aboneliğini ekler/siler. Uç adresi bilinen tarayıcı itme servisleriyle sınırlı: fonksiyon başka bir
-- adrese istek atmaya zorlanamaz.
create table if not exists public.bildirim_abonelikleri (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  kullanici uuid references auth.users(id) on delete set null,
  olusturma timestamptz not null default now()
);
alter table public.bildirim_abonelikleri enable row level security;
do $$ begin
  alter table public.bildirim_abonelikleri add constraint bildirim_uc check (
    length(endpoint) <= 1000 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com|[a-z0-9.-]+\.push\.apple\.com)/');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.bildirim_abonelikleri add constraint bildirim_anahtar check (
    p256dh ~ '^[A-Za-z0-9_=-]{40,200}$' and auth ~ '^[A-Za-z0-9_=-]{8,100}$');
exception when duplicate_object then null; end $$;

create or replace function public.bildirim_abone_ol(p_endpoint text, p_p256dh text, p_auth text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.bildirim_abonelikleri) >= 200000 then return jsonb_build_object('durum', 'dolu'); end if;
  begin
    insert into public.bildirim_abonelikleri (endpoint, p256dh, auth, kullanici)
      values (p_endpoint, p_p256dh, p_auth, auth.uid())
      on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth,
        kullanici = coalesce(auth.uid(), public.bildirim_abonelikleri.kullanici);
  exception when check_violation then
    return jsonb_build_object('durum', 'gecersiz');
  end;
  return jsonb_build_object('durum', 'tamam');
end $$;

create or replace function public.bildirim_abonelik_sil(p_endpoint text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare silinen integer := 0;
begin
  if auth.uid() is null then return jsonb_build_object('durum', 'giris'); end if;
  delete from public.bildirim_abonelikleri
   where endpoint = p_endpoint and kullanici = auth.uid();
  get diagnostics silinen = row_count;
  return jsonb_build_object('durum', 'tamam', 'silinen', silinen);
end $$;

create or replace function public.bildirim_sayisi() returns int
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  return (select count(*) from public.bildirim_abonelikleri);
end $$;

revoke all on public.bildirim_abonelikleri from anon, authenticated;
revoke execute on function public.bildirim_abone_ol(text, text, text), public.bildirim_abonelik_sil(text), public.bildirim_sayisi() from public;
grant execute on function public.bildirim_abone_ol(text, text, text), public.bildirim_abonelik_sil(text) to authenticated;
grant execute on function public.bildirim_sayisi() to authenticated;

-- ---------- E99 ----------
-- E99 katkıları sunucuya gelmez: okur dosyayı e-postayla yazara gönderir, yazar panelden E99'a ekler.
-- Önceki sürümün sunucu fonksiyonları kaldırılır (eski e99_onerileri tablosu varsa dokunulmaz; kimse erişemez).
drop function if exists public.e99_oner(jsonb);
drop function if exists public.e99_onerilerim();
drop function if exists public.e99_oneriler(text);
drop function if exists public.e99_karar(bigint, text);

-- ---------- ziyaret sayacı (anonim, kişisel veri yok) ----------
-- Günlük toplamlar: hangi sayfadan girildi, nereden gelindi, başlangıç kodu kaç kez girildi.
-- Herkes sayabilir (ad biçimi sınırlı, günde en çok 300 farklı ad); yalnızca tam yönetici okur.
create table if not exists public.olay_sayaclari (
  gun date not null default current_date,
  ad text not null,
  sayi integer not null default 0,
  primary key (gun, ad)
);
alter table public.olay_sayaclari enable row level security;

create or replace function public.olay_say(p_ad text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_ad is null or p_ad !~ '^[a-z0-9_:]{1,40}$' then return; end if;
  if not exists (select 1 from public.olay_sayaclari where gun = current_date and ad = p_ad)
     and (select count(*) from public.olay_sayaclari where gun = current_date) >= 300 then return; end if;
  insert into public.olay_sayaclari (gun, ad, sayi) values (current_date, p_ad, 1)
  on conflict (gun, ad) do update set sayi = public.olay_sayaclari.sayi + 1;
end $$;

create or replace function public.olay_sayilari(p_gun integer)
returns table (gun date, ad text, sayi integer)
language plpgsql security definer stable set search_path = '' as $$
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  return query select o.gun, o.ad, o.sayi from public.olay_sayaclari o
    where o.gun > current_date - greatest(1, least(coalesce(p_gun, 14), 90))
    order by o.gun desc, o.ad;
end $$;

revoke all on public.olay_sayaclari from anon, authenticated;
revoke execute on function public.olay_say(text), public.olay_sayilari(integer) from public;
grant execute on function public.olay_say(text) to anon, authenticated;
grant execute on function public.olay_sayilari(integer) to authenticated;

-- ======================================================================
-- ========== GÜNÜN KELİMESİ İSTATİSTİĞİ, EVREN DEFTERİ, HAFTA ==========
-- ======================================================================

-- Günün Kelimesi: oynanan, bulunan, seri, en uzun seri, kaçıncı tahminde bulunduğu
create or replace function public.gk_istatistik() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r record; seri int := 0; en int := 0; onceki date; oyn int := 0; coz int := 0;
  dag int[] := array[0, 0, 0, 0, 0, 0];
begin
  if uid is null then return null; end if;
  for r in select gun, cozuldu, coalesce(array_length(tahminler, 1), 0) as n from public.gk_tahminler
           where kullanici = uid and (cozuldu or coalesce(array_length(tahminler, 1), 0) >= 6) order by gun loop
    oyn := oyn + 1;
    if r.cozuldu then
      coz := coz + 1;
      if r.n between 1 and 6 then dag[r.n] := dag[r.n] + 1; end if;
      if onceki is not null and r.gun = onceki + 1 then seri := seri + 1; else seri := 1; end if;
      onceki := r.gun;
      en := greatest(en, seri);
    else
      seri := 0; onceki := null;
    end if;
  end loop;
  return jsonb_build_object('oynanan', oyn, 'cozulen', coz, 'seri', public.gk_seri(), 'en_uzun', en, 'dagilim', to_jsonb(dag));
end;
$$;

-- Evren ziyaretçi defteri: sitedeki evrenlere kısa notlar; yönetici onaylayınca görünür
create table if not exists public.evren_defteri (
  id bigserial primary key,
  evren text not null check (evren ~ '^[A-Za-z0-9_-]{1,60}$'),
  kullanici uuid not null references auth.users(id) on delete cascade,
  metin text not null check (char_length(metin) between 2 and 280),
  zaman timestamptz not null default now(),
  onayli boolean not null default false
);
create index if not exists evren_defteri_evren_zaman on public.evren_defteri (evren, zaman desc);
alter table public.evren_defteri enable row level security;

create or replace function public.evren_defter_yaz(p_evren text, p_metin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m text := btrim(coalesce(p_metin, ''));
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if not exists (select 1 from public.gorunur_kullanicilar where id = uid) then return jsonb_build_object('durum', 'profil'); end if;
  if coalesce(p_evren, '') !~ '^[A-Za-z0-9_-]{1,60}$' then return jsonb_build_object('durum', 'gecersiz'); end if;
  if char_length(m) < 2 or char_length(m) > 280 then return jsonb_build_object('durum', 'uzunluk'); end if;
  if (select count(*) from public.evren_defteri where kullanici = uid and zaman > now() - interval '1 day') >= 5 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  insert into public.evren_defteri (evren, kullanici, metin) values (p_evren, uid, m);
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Onaylı notlar herkese; kişinin kendi bekleyen notları yalnızca kendisine
create or replace function public.evren_defter_oku(p_evren text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'kullanici_adi', g.kullanici_adi, 'gorunen_ad', g.gorunen_ad,
    'metin', d.metin, 'zaman', d.zaman, 'bekliyor', not d.onayli, 'benim', d.kullanici = auth.uid()) order by d.zaman desc), '[]'::jsonb)
  from (select * from public.evren_defteri
        where evren = p_evren and (onayli or kullanici = auth.uid()) order by zaman desc limit 60) d
  join public.gorunur_kullanicilar g on g.id = d.kullanici;
$$;

create or replace function public.evren_defter_sil(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.evren_defteri where id = p_id and (kullanici = auth.uid() or public.yonetici_mi());
end;
$$;

create or replace function public.evren_defter_bekleyenler() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('istatistik') then raise exception 'yetki yok'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'evren', d.evren, 'kullanici_adi', p.kullanici_adi,
      'metin', d.metin, 'zaman', d.zaman) order by d.zaman), '[]'::jsonb)
    from public.evren_defteri d join public.profiller p on p.id = d.kullanici where not d.onayli);
end;
$$;

create or replace function public.evren_defter_karar(p_id bigint, p_onay boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('istatistik') then raise exception 'yetki yok'; end if;
  if p_onay then update public.evren_defteri set onayli = true where id = p_id;
  else delete from public.evren_defteri where id = p_id; end if;
end;
$$;

-- Panel: bu haftanın özeti (son 7 gün)
create or replace function public.hafta_ozeti() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare bas date := (now() at time zone 'utc')::date - 6;
begin
  if not public.yonetici_yetki('istatistik') then raise exception 'yetki yok'; end if;
  return jsonb_build_object(
    'kayit', (select count(*) from auth.users where (created_at at time zone 'utc')::date >= bas),
    'kayit_onceki', (select count(*) from auth.users where (created_at at time zone 'utc')::date between bas - 7 and bas - 1),
    'gk_oynayan', (select count(*) from public.gk_tahminler where gun >= bas and coalesce(array_length(tahminler, 1), 0) > 0),
    'gk_bulan', (select count(*) from public.gk_tahminler where gun >= bas and cozuldu),
    'defter_bekleyen', (select count(*) from public.evren_defteri where not onayli),
    'teori_bekleyen', (select count(*) from public.teoriler where gizli),
    'soru_bekleyen', (select count(*) from public.yazar_sorulari where cevap is null and not gizli),
    'yaris', (select count(*) from public.yaris_skorlari where (zaman at time zone 'utc')::date >= bas));
end;
$$;

revoke all on public.evren_defteri from anon, authenticated;
revoke execute on function public.gk_istatistik(), public.evren_defter_yaz(text, text), public.evren_defter_oku(text),
  public.evren_defter_sil(bigint), public.evren_defter_bekleyenler(), public.evren_defter_karar(bigint, boolean), public.hafta_ozeti() from public, anon;
grant execute on function public.evren_defter_oku(text) to anon, authenticated;
grant execute on function public.gk_istatistik(), public.evren_defter_yaz(text, text), public.evren_defter_sil(bigint),
  public.evren_defter_bekleyenler(), public.evren_defter_karar(bigint, boolean), public.hafta_ozeti() to authenticated;

-- ---------- Tek kullanımlık kodlar (2.1) ----------
-- Her kod bir kişi içindir: ilk giren hesaba bağlanır; o hesap çıkıp girse de hakkı sürer, başka hesap giremez.
-- Kodun kendisi saklanmaz, yalnızca özeti: sha256(büyük harf kod || '#tek').
-- Türler: evren (seviye 15'i beklemeden evren kurma), evrengezer (seviye 10), yonetici (sınırlı yönetici paneli),
--         kisi (bölüm ve evren erişimi; veri: { erisim: { bolumler, evrenler }, anahtarlar, selamlama }).
-- Bağı silmek (kişiyi koddan çıkarmak): Supabase → Table Editor → tek_kodlar → o satırın "kullanici" hücresini NULL yap
--   (ya da sitede Panel → Bakım → Tek kodlar → "Bağı sil"). Kişinin yaptıkları silinmez; yalnızca kodun verdiği hak gider,
--   kod yeniden kullanılabilir hâle gelir. Tamamen kapatmak için "iptal" = true.
create table if not exists public.tek_kodlar (
  ozet text primary key check (ozet ~ '^[0-9a-f]{64}$'),
  tur text not null check (tur in ('evren', 'evrengezer', 'yonetici', 'kisi')),
  ad text not null default '' check (char_length(ad) <= 80),
  veri jsonb not null default '{}'::jsonb check (pg_column_size(veri) < 20000),
  kullanici uuid references auth.users(id) on delete set null,
  baglanma timestamptz,
  iptal boolean not null default false,
  olusturan uuid references auth.users(id) on delete set null,
  olusturma timestamptz not null default now()
);
alter table public.tek_kodlar enable row level security;
revoke all on public.tek_kodlar from anon, authenticated;
create index if not exists tek_kodlar_kullanici on public.tek_kodlar (kullanici);
-- süreli kod (2.4): bağlandıktan sonra kaç gün geçerli; boşsa süresiz
alter table public.tek_kodlar add column if not exists sure_gun int check (sure_gun between 1 and 3650);
-- 3.1: evren1 = tek seferlik bir evren kurma hakkı. Hesaba bağlanır; kişi bir evren kurunca harcanır (harcama dolar)
--      ve hak listesinden düşer. Seviye 15'i beklemeden yalnızca bir evren.
alter table public.tek_kodlar add column if not exists harcama timestamptz;
alter table public.tek_kodlar drop constraint if exists tek_kodlar_tur_check;
alter table public.tek_kodlar add constraint tek_kodlar_tur_check check (tur in ('evren', 'evren1', 'evrengezer', 'yonetici', 'kisi'));

create table if not exists public.tek_kod_denemeleri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  zaman timestamptz not null default now()
);
create index if not exists tek_kod_denemeleri_k on public.tek_kod_denemeleri (kullanici, zaman);
alter table public.tek_kod_denemeleri enable row level security;
revoke all on public.tek_kod_denemeleri from anon, authenticated;

-- tek kodla verilen yöneticilik: bağ silinince yalnızca o kodun verdiği satır gider
alter table public.yoneticiler add column if not exists tek_kod text;

create or replace function public.tek_kod_ozet(p_kod text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(upper(btrim(coalesce(p_kod, ''))) || '#tek', 'UTF8')), 'hex');
$$;

-- bağ silinince, kod iptal edilince ya da satır silinince: o kodun verdiği yöneticilik kalkar
create or replace function public.tek_kod_bag_degisti() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.kullanici is not null and (tg_op = 'DELETE' or new.kullanici is distinct from old.kullanici or new.iptal) then
    delete from public.yoneticiler where id = old.kullanici and tek_kod = old.ozet;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists tek_kod_bag on public.tek_kodlar;
create trigger tek_kod_bag after update or delete on public.tek_kodlar
  for each row execute procedure public.tek_kod_bag_degisti();

create or replace function public.tek_kod_kullan(p_kod text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  oz text := public.tek_kod_ozet(p_kod);
  r public.tek_kodlar;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if (select count(*) from public.tek_kod_denemeleri where kullanici = uid and zaman > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  select * into r from public.tek_kodlar where ozet = oz for update;
  if not found or r.iptal then
    insert into public.tek_kod_denemeleri (kullanici) values (uid);
    return jsonb_build_object('durum', 'yok');
  end if;
  if r.kullanici is not null and r.kullanici <> uid then return jsonb_build_object('durum', 'dolu'); end if;
  if r.kullanici = uid and r.sure_gun is not null and r.baglanma + make_interval(days => r.sure_gun) < now() then
    return jsonb_build_object('durum', 'sure_doldu');
  end if;
  if r.kullanici is null then
    update public.tek_kodlar set kullanici = uid, baglanma = now() where ozet = oz;
    if r.tur = 'yonetici' then
      insert into public.yoneticiler (id, duzey, tek_kod, yetkiler)
      values (uid, 'sinirli', oz, case when jsonb_typeof(r.veri -> 'yetkiler') = 'array'
        then array(select jsonb_array_elements_text(r.veri -> 'yetkiler')) end)
      on conflict (id) do nothing;
    end if;
  end if;
  return jsonb_build_object('durum', 'tamam', 'tur', r.tur, 'ad', r.ad, 'veri', r.veri);
end;
$$;

-- girişte: bu hesaba bağlı kodların verdiği haklar
create or replace function public.tek_kodlarim() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  -- süresi dolan tek kodların verdiği yöneticilik kalkar
  delete from public.yoneticiler y using public.tek_kodlar t
    where y.id = auth.uid() and y.tek_kod = t.ozet and t.sure_gun is not null and t.baglanma + make_interval(days => t.sure_gun) < now();
  return (select coalesce(jsonb_agg(jsonb_build_object('tur', tur, 'ad', ad, 'veri', veri,
      'bitis', case when sure_gun is null then null else baglanma + make_interval(days => sure_gun) end) order by baglanma), '[]'::jsonb)
    from public.tek_kodlar where kullanici = auth.uid() and not iptal and harcama is null
      and (sure_gun is null or baglanma + make_interval(days => sure_gun) >= now()));
end;
$$;

-- 3.1: tek seferlik hakkı harca (evren kuruldu). Bu hesaba bağlı, harcanmamış en eski evren1 kodu.
create or replace function public.tek_kod_harca(p_tur text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare oz text;
begin
  if auth.uid() is null or p_tur <> 'evren1' then return false; end if;
  select ozet into oz from public.tek_kodlar where kullanici = auth.uid() and tur = p_tur and not iptal and harcama is null
    order by baglanma limit 1 for update;
  if oz is null then return false; end if;
  update public.tek_kodlar set harcama = now() where ozet = oz;
  return true;
end;
$$;
revoke execute on function public.tek_kod_harca(text) from public, anon;
grant execute on function public.tek_kod_harca(text) to authenticated;

-- yönetici: kod üret (kodların kendisi sitede üretilir; buraya yalnızca özetleri gelir)
create or replace function public.tek_kod_olustur(p_kodlar jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare x jsonb; n int := 0;
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  if jsonb_typeof(p_kodlar) <> 'array' or jsonb_array_length(p_kodlar) > 50 then raise exception 'en çok 50 kod'; end if;
  for x in select * from jsonb_array_elements(p_kodlar) loop
    insert into public.tek_kodlar (ozet, tur, ad, veri, olusturan, sure_gun)
    values (x->>'ozet', x->>'tur', left(coalesce(x->>'ad', ''), 80), coalesce(x->'veri', '{}'::jsonb), auth.uid(),
      nullif(coalesce((x->>'sure_gun')::int, 0), 0));
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.tek_kod_listesi() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not public.tam_yonetici_mi() then null else coalesce(jsonb_agg(jsonb_build_object(
    'ozet', t.ozet, 'tur', t.tur, 'ad', t.ad, 'iptal', t.iptal, 'olusturma', t.olusturma, 'baglanma', t.baglanma,
    'kullanici_adi', p.kullanici_adi, 'bagli', t.kullanici is not null, 'sure_gun', t.sure_gun, 'harcama', t.harcama,
    'bitis', case when t.sure_gun is null or t.baglanma is null then null else t.baglanma + make_interval(days => t.sure_gun) end)
    order by t.olusturma desc), '[]'::jsonb) end
  from public.tek_kodlar t left join public.profiller p on p.id = t.kullanici;
$$;

create or replace function public.tek_kod_bag_sil(p_ozet text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  update public.tek_kodlar set kullanici = null, baglanma = null where ozet = p_ozet;
  return found;
end;
$$;

create or replace function public.tek_kod_iptal(p_ozet text, p_iptal boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  update public.tek_kodlar set iptal = p_iptal where ozet = p_ozet;
  return found;
end;
$$;

revoke execute on function public.tek_kod_kullan(text), public.tek_kodlarim(), public.tek_kod_olustur(jsonb), public.tek_kod_listesi(),
  public.tek_kod_bag_sil(text), public.tek_kod_iptal(text, boolean), public.tek_kod_bag_degisti() from public, anon;
grant execute on function public.tek_kod_kullan(text), public.tek_kodlarim(), public.tek_kod_olustur(jsonb), public.tek_kod_listesi(),
  public.tek_kod_bag_sil(text), public.tek_kod_iptal(text, boolean) to authenticated;


-- Evren uygulamalarının (kurucunun kodla yazdığı oyunlar) en iyi puanları: her kişinin her oyundaki en iyisi.
-- Puanı oyunun kendisi bildirir (tarayıcıda çalışır): hile önlenemez, yalnızca eğlence tablosudur; XP vermez.
create table if not exists public.uygulama_skorlari (
  evren text not null check (evren ~ '^[\w:.-]{1,80}$'),
  uygulama text not null check (uygulama ~ '^[\w-]{1,40}$'),
  kullanici uuid not null references auth.users(id) on delete cascade,
  puan bigint not null check (puan between -1000000000 and 1000000000),
  zaman timestamptz not null default now(),
  primary key (evren, uygulama, kullanici)
);
alter table public.uygulama_skorlari enable row level security;
revoke all on public.uygulama_skorlari from anon, authenticated;
create table if not exists public.uygulama_skor_denemeleri (kullanici uuid not null references auth.users(id) on delete cascade, zaman timestamptz not null default now());
create index if not exists uygulama_skor_denemeleri_k on public.uygulama_skor_denemeleri (kullanici, zaman);
alter table public.uygulama_skor_denemeleri enable row level security;
revoke all on public.uygulama_skor_denemeleri from anon, authenticated;

create or replace function public.uygulama_skor_yaz(p_evren text, p_uygulama text, p_puan bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); onceki bigint;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if exists (select 1 from public.istatistikler where id = uid and engelli) then return jsonb_build_object('durum', 'engelli'); end if;
  if p_evren !~ '^[\w:.-]{1,80}$' or p_uygulama !~ '^[\w-]{1,40}$' or p_puan is null or p_puan not between -1000000000 and 1000000000 then
    return jsonb_build_object('durum', 'gecersiz');
  end if;
  if (select count(*) from public.uygulama_skor_denemeleri where kullanici = uid and zaman > now() - interval '1 hour') >= 120 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  insert into public.uygulama_skor_denemeleri (kullanici) values (uid);
  select puan into onceki from public.uygulama_skorlari where evren = p_evren and uygulama = p_uygulama and kullanici = uid;
  if onceki is null or p_puan > onceki then
    insert into public.uygulama_skorlari (evren, uygulama, kullanici, puan) values (p_evren, p_uygulama, uid, p_puan)
    on conflict (evren, uygulama, kullanici) do update set puan = excluded.puan, zaman = now();
    return jsonb_build_object('durum', 'rekor', 'onceki', onceki);
  end if;
  return jsonb_build_object('durum', 'tamam', 'enIyi', onceki);
end;
$$;

create or replace function public.uygulama_skor_tablosu(p_evren text, p_uygulama text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('ad', coalesce(p.gorunen_ad, p.kullanici_adi, 'okur'), 'kullanici_adi', p.kullanici_adi, 'puan', s.puan)
    order by s.puan desc, s.zaman), '[]'::jsonb)
  -- yalnızca tablolarda görünebilenler (liderlikte gizlenen, askıya alınan, engellenen yok)
  from (select u.* from public.uygulama_skorlari u join public.gorunur_kullanicilar g on g.id = u.kullanici
        where u.evren = p_evren and u.uygulama = p_uygulama order by u.puan desc, u.zaman limit 10) s
  join public.profiller p on p.id = s.kullanici;
$$;

revoke execute on function public.uygulama_skor_yaz(text, text, bigint), public.uygulama_skor_tablosu(text, text) from public, anon;
grant execute on function public.uygulama_skor_yaz(text, text, bigint) to authenticated;
grant execute on function public.uygulama_skor_tablosu(text, text) to anon, authenticated;

-- ======================================================================
-- ========== 2.5: ORTAK EVREN, İÇERİK BİLDİRİMİ, EVREN İSTATİSTİĞİ ==========
-- ======================================================================

-- Ortak yazarlık: kurucu evrenini buraya koyar, davet koduyla başka hesaplar da yazar.
-- Son kaydeden kazanır; üstüne yazılan hâl kurucunun cihazında sürüm geçmişine düşer (site tarafı).
create table if not exists public.ortak_evrenler (
  id text primary key check (id ~ '^[\w-]{1,60}$'),
  sahip uuid not null references auth.users(id) on delete cascade,
  veri jsonb not null,
  guncelleme timestamptz not null default now(),
  guncelleyen uuid references auth.users(id) on delete set null
);
alter table public.ortak_evrenler enable row level security;
revoke all on public.ortak_evrenler from anon, authenticated;

create table if not exists public.ortak_evren_uyeleri (
  evren text not null references public.ortak_evrenler(id) on delete cascade,
  kullanici uuid not null references auth.users(id) on delete cascade,
  rol text not null default 'yazar' check (rol in ('sahip', 'yazar')),
  katilma timestamptz not null default now(),
  primary key (evren, kullanici)
);
alter table public.ortak_evren_uyeleri enable row level security;
revoke all on public.ortak_evren_uyeleri from anon, authenticated;

create table if not exists public.ortak_evren_davetleri (
  ozet text primary key,
  evren text not null references public.ortak_evrenler(id) on delete cascade,
  olusturma timestamptz not null default now(),
  kullanan uuid references auth.users(id) on delete set null
);
alter table public.ortak_evren_davetleri enable row level security;
revoke all on public.ortak_evren_davetleri from anon, authenticated;

create or replace function public.ortak_uye_mi(p_evren text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ortak_evren_uyeleri where evren = p_evren and kullanici = auth.uid());
$$;

-- Ortak yazarlık yalnızca ücretli planla açılır. Bu kontrol istemcideki
-- düğme kontrolünün tekrarıdır; asıl yetki her zaman RPC içinde doğrulanır.
create or replace function public.ortak_evren_planli_mi(p_kullanici uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = '' as $$
  select public.pro_mu(p_kullanici);
$$;

create or replace function public.ortak_evren_yazar_mi(p_kullanici uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.abonelikler a
    where a.id = p_kullanici and a.tip = 'evrenyazar'
      and (a.bitis is null or a.bitis > now())
  ) or coalesce(public.pro_kod_bitis(p_kullanici) > now(), false);
$$;

-- kurucu evrenini ortak yazarlığa açar (ya da kendi kaydını günceller)
create or replace function public.ortak_evren_ac(p_id text, p_veri jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.ortak_evrenler;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if not public.ortak_evren_planli_mi(uid) then return jsonb_build_object('durum', 'plan'); end if;
  if p_id !~ '^[\w-]{1,60}$' or jsonb_typeof(p_veri) <> 'object' or pg_column_size(p_veri) > 3000000 then return jsonb_build_object('durum', 'gecersiz'); end if;
  select * into r from public.ortak_evrenler where id = p_id;
  if found and r.sahip <> uid then return jsonb_build_object('durum', 'baskasinin'); end if;
  if (select count(*) from public.ortak_evrenler where sahip = uid) >= 20 and not found then return jsonb_build_object('durum', 'sinir'); end if;
  insert into public.ortak_evrenler (id, sahip, veri, guncelleyen) values (p_id, uid, p_veri, uid)
    on conflict (id) do update set veri = excluded.veri, guncelleme = now(), guncelleyen = uid;
  insert into public.ortak_evren_uyeleri (evren, kullanici, rol) values (p_id, uid, 'sahip') on conflict do nothing;
  return jsonb_build_object('durum', 'tamam', 'guncelleme', (select guncelleme from public.ortak_evrenler where id = p_id));
end;
$$;

create or replace function public.ortak_davet_ozet(p_kod text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(upper(btrim(coalesce(p_kod, ''))) || '#ortak', 'UTF8')), 'hex');
$$;

-- kurucu: davet kodu (kodun kendisi sitede üretilir, buraya özeti gelir)
create or replace function public.ortak_evren_davet(p_id text, p_ozet text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ortak_evren_planli_mi() then return jsonb_build_object('durum', 'plan'); end if;
  if not exists (select 1 from public.ortak_evrenler where id = p_id and sahip = auth.uid()) then return jsonb_build_object('durum', 'yetki'); end if;
  if p_ozet !~ '^[0-9a-f]{64}$' then return jsonb_build_object('durum', 'gecersiz'); end if;
  if (select count(*) from public.ortak_evren_davetleri where evren = p_id and kullanan is null) >= 20 then return jsonb_build_object('durum', 'sinir'); end if;
  insert into public.ortak_evren_davetleri (ozet, evren) values (p_ozet, p_id) on conflict do nothing;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- davet koduyla katıl: kod tek kullanımlık
create or replace function public.ortak_evren_katil(p_kod text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d public.ortak_evren_davetleri; e public.ortak_evrenler; mevcut int; limit_kisi int;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if (select count(*) from public.tek_kod_denemeleri where kullanici = uid and zaman > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  select * into d from public.ortak_evren_davetleri where ozet = public.ortak_davet_ozet(p_kod) for update;
  if not found then
    insert into public.tek_kod_denemeleri (kullanici) values (uid);
    return jsonb_build_object('durum', 'yok');
  end if;
  if d.kullanan is not null and d.kullanan <> uid then return jsonb_build_object('durum', 'dolu'); end if;
  select * into e from public.ortak_evrenler where id = d.evren;
  if not public.ortak_evren_planli_mi(e.sahip) then return jsonb_build_object('durum', 'kapali'); end if;
  mevcut := (select count(*) from public.ortak_evren_uyeleri where evren = e.id);
  limit_kisi := case when public.ortak_evren_yazar_mi(e.sahip) then 2147483647 else 2 end;
  if mevcut >= limit_kisi and not exists (select 1 from public.ortak_evren_uyeleri where evren = e.id and kullanici = uid) then
    return jsonb_build_object('durum', 'takim_siniri');
  end if;
  update public.ortak_evren_davetleri set kullanan = uid where ozet = d.ozet;
  insert into public.ortak_evren_uyeleri (evren, kullanici) values (d.evren, uid) on conflict do nothing;
  return jsonb_build_object('durum', 'tamam', 'id', e.id, 'veri', e.veri, 'guncelleme', e.guncelleme);
end;
$$;

create or replace function public.ortak_evren_getir(p_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.ortak_evrenler;
begin
  if not public.ortak_uye_mi(p_id) then return jsonb_build_object('durum', 'yetki'); end if;
  select * into e from public.ortak_evrenler where id = p_id;
  return jsonb_build_object('durum', 'tamam', 'veri', e.veri, 'guncelleme', e.guncelleme, 'sahip', e.sahip = auth.uid(),
    'guncelleyen', (select coalesce(p.gorunen_ad, p.kullanici_adi) from public.profiller p where p.id = e.guncelleyen));
end;
$$;

-- yazar kaydeder; p_taban: yazarın elindeki hâlin zamanı. Arada başkası yazdıysa onun hâli döner (çatışma).
create or replace function public.ortak_evren_yaz(p_id text, p_veri jsonb, p_taban timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.ortak_evrenler;
begin
  if not public.ortak_uye_mi(p_id) then return jsonb_build_object('durum', 'yetki'); end if;
  if jsonb_typeof(p_veri) <> 'object' or pg_column_size(p_veri) > 3000000 then return jsonb_build_object('durum', 'gecersiz'); end if;
  select * into e from public.ortak_evrenler where id = p_id for update;
  if p_taban is null or e.guncelleme > p_taban + interval '1 millisecond' then
    return jsonb_build_object('durum', 'catisma', 'veri', e.veri, 'guncelleme', e.guncelleme,
      'guncelleyen', (select coalesce(p.gorunen_ad, p.kullanici_adi) from public.profiller p where p.id = e.guncelleyen));
  end if;
  update public.ortak_evrenler set veri = p_veri, guncelleme = now(), guncelleyen = auth.uid() where id = p_id
    returning guncelleme into e.guncelleme;
  return jsonb_build_object('durum', 'tamam', 'guncelleme', e.guncelleme);
end;
$$;

create or replace function public.ortak_evrenlerim() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'guncelleme', e.guncelleme, 'rol', u.rol)), '[]'::jsonb)
  from public.ortak_evren_uyeleri u join public.ortak_evrenler e on e.id = u.evren where u.kullanici = auth.uid();
$$;

create or replace function public.ortak_evren_uyeler(p_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ortak_uye_mi(p_id) then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', u.kullanici, 'rol', u.rol, 'ad', coalesce(p.gorunen_ad, p.kullanici_adi, 'yazar'),
      'kullanici_adi', p.kullanici_adi, 'ben', u.kullanici = auth.uid()) order by u.katilma), '[]'::jsonb)
    from public.ortak_evren_uyeleri u left join public.profiller p on p.id = u.kullanici where u.evren = p_id);
end;
$$;

-- kurucu bir yazarı çıkarır; yazar kendisi ayrılır. Kurucu ayrılırsa evren ortaklıktan çıkar (herkeste kopyası kalır).
create or replace function public.ortak_evren_cikar(p_id text, p_kullanici uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sahip_mi boolean := exists (select 1 from public.ortak_evrenler where id = p_id and sahip = auth.uid());
begin
  if p_kullanici = auth.uid() and sahip_mi then delete from public.ortak_evrenler where id = p_id; return jsonb_build_object('durum', 'kapandi'); end if;
  if not sahip_mi and p_kullanici <> auth.uid() then return jsonb_build_object('durum', 'yetki'); end if;
  delete from public.ortak_evren_uyeleri where evren = p_id and kullanici = p_kullanici and rol = 'yazar';
  return jsonb_build_object('durum', 'tamam');
end;
$$;

revoke execute on function public.ortak_evren_ac(text, jsonb), public.ortak_evren_davet(text, text), public.ortak_evren_katil(text),
  public.ortak_evren_getir(text), public.ortak_evren_yaz(text, jsonb, timestamptz), public.ortak_evrenlerim(),
  public.ortak_evren_uyeler(text), public.ortak_evren_cikar(text, uuid), public.ortak_uye_mi(text),
  public.ortak_evren_planli_mi(uuid), public.ortak_evren_yazar_mi(uuid) from public, anon, authenticated;
grant execute on function public.ortak_evren_ac(text, jsonb), public.ortak_evren_davet(text, text), public.ortak_evren_katil(text),
  public.ortak_evren_getir(text), public.ortak_evren_yaz(text, jsonb, timestamptz), public.ortak_evrenlerim(),
  public.ortak_evren_uyeler(text), public.ortak_evren_cikar(text, uuid) to authenticated;

-- İçerik bildirimi: okur uygunsuz evren, uygulama, defter notu ya da teoriyi bildirir (mağaza kuralları bunu ister)
create table if not exists public.icerik_bildirimleri (
  no bigserial primary key,
  tur text not null check (tur in ('evren', 'uygulama', 'defter', 'teori', 'yorum', 'diger')),
  hedef text not null check (char_length(hedef) between 1 and 200),
  neden text check (char_length(neden) <= 500),
  adres text check (char_length(adres) <= 300),
  bildiren uuid references auth.users(id) on delete set null,
  zaman timestamptz not null default now(),
  durum text not null default 'yeni' check (durum in ('yeni', 'incelendi', 'kaldirildi'))
);
create index if not exists icerik_bildirimleri_d on public.icerik_bildirimleri (durum, zaman desc);
alter table public.icerik_bildirimleri enable row level security;
revoke all on public.icerik_bildirimleri from anon, authenticated;

create or replace function public.icerik_bildir(p_tur text, p_hedef text, p_neden text, p_adres text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if p_tur not in ('evren', 'uygulama', 'defter', 'teori', 'yorum', 'diger') or coalesce(p_hedef, '') = '' then return jsonb_build_object('durum', 'gecersiz'); end if;
  if (select count(*) from public.icerik_bildirimleri where bildiren = uid and zaman > now() - interval '1 day') >= 20 then return jsonb_build_object('durum', 'sinir'); end if;
  if exists (select 1 from public.icerik_bildirimleri where bildiren = uid and tur = p_tur and hedef = left(p_hedef, 200) and durum = 'yeni') then
    return jsonb_build_object('durum', 'zaten');
  end if;
  insert into public.icerik_bildirimleri (tur, hedef, neden, adres, bildiren) values (p_tur, left(p_hedef, 200), left(p_neden, 500), left(p_adres, 300), uid);
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.icerik_bildirimleri_listesi() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('icbildirim') then raise exception 'yetki yok'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('no', b.no, 'tur', b.tur, 'hedef', b.hedef, 'neden', b.neden, 'adres', b.adres,
      'zaman', b.zaman, 'durum', b.durum, 'bildiren', p.kullanici_adi) order by b.durum = 'yeni' desc, b.zaman desc), '[]'::jsonb)
    from (select * from public.icerik_bildirimleri order by zaman desc limit 200) b left join public.profiller p on p.id = b.bildiren);
end;
$$;

create or replace function public.icerik_bildirim_karar(p_no bigint, p_durum text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('icbildirim') then raise exception 'yetki yok'; end if;
  if p_durum not in ('yeni', 'incelendi', 'kaldirildi') then raise exception 'geçersiz durum'; end if;
  update public.icerik_bildirimleri set durum = p_durum where no = p_no;
end;
$$;

revoke execute on function public.icerik_bildir(text, text, text, text), public.icerik_bildirimleri_listesi(), public.icerik_bildirim_karar(bigint, text) from public, anon;
grant execute on function public.icerik_bildir(text, text, text, text), public.icerik_bildirimleri_listesi(), public.icerik_bildirim_karar(bigint, text) to authenticated;

-- Evren istatistiği: ziyaret, sekme, oyun sayaçları (kimlik yok, yalnızca günlük sayılar; herkes okur)
create table if not exists public.evren_sayaclari (
  evren text not null check (evren ~ '^[\w:.-]{1,80}$'),
  gun date not null default (now() at time zone 'utc')::date,
  ad text not null check (ad ~ '^[a-z0-9_:]{1,40}$'),
  sayi int not null default 0,
  primary key (evren, gun, ad)
);
alter table public.evren_sayaclari enable row level security;
revoke all on public.evren_sayaclari from anon, authenticated;

create or replace function public.evren_say(p_evren text, p_ad text) returns void
language plpgsql security definer set search_path = '' as $$
declare bugun date := (now() at time zone 'utc')::date;
begin
  if p_evren !~ '^[\w:.-]{1,80}$' or p_ad !~ '^[a-z0-9_:]{1,40}$' then return; end if;
  -- günde en çok 5000 satır: sayaç kimseyi yormasın
  if not exists (select 1 from public.evren_sayaclari where evren = p_evren and gun = bugun and ad = p_ad)
     and (select count(*) from public.evren_sayaclari where gun = bugun) >= 5000 then return; end if;
  insert into public.evren_sayaclari (evren, gun, ad, sayi) values (p_evren, bugun, p_ad, 1)
    on conflict (evren, gun, ad) do update set sayi = public.evren_sayaclari.sayi + 1;
end;
$$;

create or replace function public.evren_istatistik(p_evren text, p_gun int default 30) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('gun', gun, 'ad', ad, 'sayi', sayi) order by gun, ad), '[]'::jsonb)
  from public.evren_sayaclari
  where evren = p_evren and gun > (now() at time zone 'utc')::date - greatest(1, least(coalesce(p_gun, 30), 90));
$$;

revoke execute on function public.evren_say(text, text), public.evren_istatistik(text, int) from public;
grant execute on function public.evren_say(text, text), public.evren_istatistik(text, int) to anon, authenticated;

-- Sayaçlar tek istekte: site olay ve evren sayaçlarını biriktirip sayfadan çıkarken bir kez gönderir (en çok 50)
create or replace function public.sayac_toplu(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare x jsonb; n int := 0;
begin
  if jsonb_typeof(p) <> 'array' then return; end if;
  for x in select value from jsonb_array_elements(p) loop
    n := n + 1;
    exit when n > 50;
    if x ->> 'tur' = 'olay' then perform public.olay_say(x ->> 'ad');
    elsif x ->> 'tur' = 'evren' then perform public.evren_say(x ->> 'evren', x ->> 'ad');
    end if;
  end loop;
end;
$$;
revoke execute on function public.sayac_toplu(jsonb) from public;
grant execute on function public.sayac_toplu(jsonb) to anon, authenticated;


-- ==================== 4.0: hafif evren teslimi, moderatör onayı, üyelik ====================
-- Evrenin kendisi veritabanında tutulmaz: sıkıştırılmış tek bir .json.gz olarak Storage'dadır.
-- Veritabanında yalnızca küçük birer satır: başvuru (kuyruk), yayındaki evren (vitrin), üyelik.

-- ---------- üyelik: tek kaynak (EvrenGezer / EvrenYazar) ----------
-- Üyelik durumu yalnızca küçük bir satırda tutulur; içerik ve evren verisi bu tabloya yazılmaz.
create table if not exists public.abonelikler (
  id uuid primary key references auth.users(id) on delete cascade,
  tip text not null default 'ucretsiz' check (tip in ('ucretsiz', 'evrengezer', 'evrenyazar')),
  bitis timestamptz,
  guncelleme timestamptz not null default now()
);
alter table public.abonelikler enable row level security;
drop policy if exists "abonelik_kendi" on public.abonelikler;
drop policy if exists "Kullanici kendi aboneligini gorur" on public.abonelikler;
create policy "abonelik_kendi" on public.abonelikler
  for select to authenticated using (auth.uid() = id);

-- Eski kurulum daha önce çalıştıysa kayıtları bir kez yeni tabloya taşı.
-- Tablo yoksa veya yeni tablo zaten doluysa DO bloğu hiçbir taşıma yapmaz.
do $$
begin
  if to_regclass('public.kullanici_abonelik') is not null
     and not exists (select 1 from public.abonelikler) then
    execute $q$
      insert into public.abonelikler (id, tip, bitis, guncelleme)
      select kullanici,
             case when uyelik_tipi = 'pro' then 'evrenyazar' else 'ucretsiz' end,
             abonelik_bitis,
             coalesce(guncelleme, now())
      from public.kullanici_abonelik
      on conflict (id) do nothing
    $q$;
  end if;
end $$;

-- PayTR webhook'u için ödeme kayıtları; istemciye yazma yetkisi verilmez.
create table if not exists public.odemeler (
  merchant_oid text primary key,
  kullanici uuid not null references auth.users(id) on delete cascade,
  tutar int not null,
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'basarili', 'basarisiz')),
  olusturma timestamptz not null default now(),
  sonuc timestamptz
);
alter table public.odemeler enable row level security;

-- Eski pro30 kodlarını kaybetmeden yeni plan sistemine bağla.
create or replace function public.pro_kod_bitis(p_kullanici uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select max(baglanma + make_interval(days => coalesce(sure_gun, 30)))
  from public.tek_kodlar
  where kullanici = p_kullanici and tur = 'pro30' and not iptal and baglanma is not null;
$$;
revoke all on function public.pro_kod_bitis(uuid) from public, anon, authenticated;

create or replace function public.pro_mu(p_kullanici uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.abonelikler a
    where a.id = p_kullanici
      and a.tip in ('evrengezer', 'evrenyazar')
      and (a.bitis is null or a.bitis > now())
  ) or coalesce(public.pro_kod_bitis(p_kullanici) > now(), false);
$$;
revoke all on function public.pro_mu(uuid) from public, anon, authenticated;

create or replace function public.abonelik_durumum() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.abonelikler;
  kod_bitis timestamptz;
  aktif_tip text := 'ucretsiz';
  aktif_bitis timestamptz := null;
begin
  if uid is null then
    return jsonb_build_object('pro', false, 'tip', 'ucretsiz', 'bitis', null,
      'limitler', jsonb_build_object('evren', 1, 'gezgin', 3, 'hikaye', 10, 'gezegen', 1));
  end if;
  select * into r from public.abonelikler where id = uid;
  kod_bitis := public.pro_kod_bitis(uid);
  if r.id is not null and r.tip in ('evrengezer', 'evrenyazar') and (r.bitis is null or r.bitis > now()) then
    aktif_tip := r.tip;
    aktif_bitis := r.bitis;
  end if;
  if kod_bitis is not null and kod_bitis > now() and (aktif_bitis is null or kod_bitis > aktif_bitis) then
    aktif_tip := 'evrenyazar';
    aktif_bitis := kod_bitis;
  end if;
  return jsonb_build_object(
    'pro', aktif_tip in ('evrengezer', 'evrenyazar'),
    'tip', aktif_tip,
    'bitis', aktif_bitis,
    'limitler', case
      when aktif_tip = 'evrenyazar' then jsonb_build_object('evren', null, 'gezgin', null, 'hikaye', null, 'gezegen', null)
      when aktif_tip = 'evrengezer' then jsonb_build_object('evren', 5, 'gezgin', 12, 'hikaye', 42, 'gezegen', 5)
      else jsonb_build_object('evren', 1, 'gezgin', 3, 'hikaye', 10, 'gezegen', 1)
    end
  );
end;
$$;
revoke all on function public.abonelik_durumum() from public, anon;
grant execute on function public.abonelik_durumum() to authenticated;

-- Eski yönetici paneli çağrısı için uyumluluk: eski Pro, sınırsız EvrenYazar'a eşlenir.
create or replace function public.pro_ver(p_kullanici_adi text, p_gun int) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare sonuc jsonb;
begin
  sonuc := public.abonelik_hediye(p_kullanici_adi, 'evrenyazar', p_gun);
  if sonuc->>'durum' <> 'tamam' then raise exception '%', coalesce(sonuc->>'durum', 'hediye verilemedi'); end if;
  return (sonuc->>'bitis')::timestamptz;
end;
$$;
revoke all on function public.pro_ver(text, int) from public, anon;
grant execute on function public.pro_ver(text, int) to authenticated;

-- ---------- başvurular (onay kuyruğu) ----------
create table if not exists public.basvurular (
  id uuid primary key default gen_random_uuid(),
  baslik text not null check (char_length(baslik) between 1 and 120),
  ozet text not null default '' check (char_length(ozet) <= 600),
  dosya_yolu text not null,
  boyut int not null default 0 check (boyut between 0 and 3145728),
  gonderen uuid not null references auth.users(id) on delete cascade,
  gonderen_eposta text,
  oncelik boolean not null default false,
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'onaylandi', 'reddedildi')),
  karar_notu text,
  tarih timestamptz not null default now(),
  karar_tarihi timestamptz
);
create index if not exists basvurular_kuyruk on public.basvurular (durum, oncelik desc, tarih);
alter table public.basvurular enable row level security;
drop policy if exists "basvuru_kendi" on public.basvurular;
create policy "basvuru_kendi" on public.basvurular for select to authenticated using (gonderen = auth.uid());
-- ekleme yalnızca basvuru_gonder ile; genel kullanıcı başkasının başvurusunu göremez

create or replace function public.basvuru_gonder(p_baslik text, p_ozet text, p_dosya_yolu text, p_boyut int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); pro boolean; n int; yeni uuid;
begin
  if u is null then raise exception 'giriş gerekli'; end if;
  if p_dosya_yolu is null or p_dosya_yolu !~ ('^' || u::text || '/[A-Za-z0-9._-]{1,120}\.json\.gz$') then raise exception 'dosya yolu geçersiz'; end if;
  pro := public.pro_mu(u);
  select count(*) into n from public.basvurular where gonderen = u and durum = 'bekliyor';
  if n >= (case when pro then 5 else 1 end) then
    raise exception 'bekleyen başvurun var (ücretsiz 1, Pro 5)';
  end if;
  insert into public.basvurular (baslik, ozet, dosya_yolu, boyut, gonderen, gonderen_eposta, oncelik)
    values (left(btrim(p_baslik), 120), left(coalesce(p_ozet, ''), 600), p_dosya_yolu, greatest(0, coalesce(p_boyut, 0)), u,
      (select email from auth.users where id = u), pro)
  returning id into yeni;
  return yeni;
end;
$$;
revoke execute on function public.basvuru_gonder(text, text, text, int) from public, anon;
grant execute on function public.basvuru_gonder(text, text, text, int) to authenticated;

-- ---------- yayındaki evrenler (vitrin; herkes okur) ----------
create table if not exists public.yayindaki_evrenler (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  baslik text not null,
  ozet text not null default '',
  dosya_yolu text not null,
  yazar text,
  basvuru uuid references public.basvurular(id) on delete set null,
  yayin_tarihi timestamptz not null default now()
);
alter table public.yayindaki_evrenler enable row level security;
drop policy if exists "yayin_herkes" on public.yayindaki_evrenler;
create policy "yayin_herkes" on public.yayindaki_evrenler for select to anon, authenticated using (true);

-- ---------- moderatör erişim kodları ----------
-- Kodun kendisi sitede (yönetici panelinde) üretilir; buraya yalnızca özeti gelir. Moderatör hesap açmaz:
-- kodla giriş yapar, 12 saatlik bir oturum anahtarı (token) alır; token da yalnızca özetiyle saklanır.
create table if not exists public.moderator_kodlari (
  ozet text primary key,
  ad text not null default '',
  aktif boolean not null default true,
  olusturma timestamptz not null default now()
);
alter table public.moderator_kodlari enable row level security;
create table if not exists public.moderator_oturumlari (
  token_ozet text primary key,
  kod_ozet text not null references public.moderator_kodlari(ozet) on delete cascade,
  bitis timestamptz not null
);
alter table public.moderator_oturumlari enable row level security;
create table if not exists public.moderator_denemeler (
  zaman timestamptz not null default now(),
  kod_ozet text not null default ''
);
alter table public.moderator_denemeler add column if not exists kod_ozet text not null default '';
alter table public.moderator_denemeler enable row level security;

create or replace function public.mod_ozet(p_metin text, p_tuz text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(btrim(coalesce(p_metin, '')) || p_tuz, 'UTF8')), 'hex');
$$;

create or replace function public.moderator_giris(p_kod text) returns text
language plpgsql security definer set search_path = '' as $$
declare oz text := public.mod_ozet(upper(p_kod), '#mod'); t text;
begin
  -- kaba kuvvete karşı: son 10 dakikada 30'dan çok hatalı deneme varsa bekle
  if (select count(*) from public.moderator_denemeler where zaman > now() - interval '10 minutes' and (kod_ozet = oz or kod_ozet = '') ) >= 10 then
    raise exception 'çok deneme; biraz bekle';
  end if;
  if not exists (select 1 from public.moderator_kodlari where ozet = oz and aktif) then
    insert into public.moderator_denemeler (kod_ozet) values (oz);
    delete from public.moderator_denemeler where zaman < now() - interval '1 day';
    raise exception 'kod geçersiz';
  end if;
  delete from public.moderator_oturumlari where bitis < now();
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.moderator_oturumlari (token_ozet, kod_ozet, bitis) values (public.mod_ozet(t, '#tok'), oz, now() + interval '12 hours');
  return t;
end;
$$;
revoke execute on function public.moderator_giris(text) from public;
grant execute on function public.moderator_giris(text) to anon, authenticated;

create or replace function public.moderator_dogrula(p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderator_oturumlari o join public.moderator_kodlari k on k.ozet = o.kod_ozet
    where o.token_ozet = public.mod_ozet(p_token, '#tok') and o.bitis > now() and k.aktif);
$$;
revoke execute on function public.moderator_dogrula(text) from public;
grant execute on function public.moderator_dogrula(text) to anon, authenticated;

create or replace function public.mod_kuyruk(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.moderator_dogrula(p_token) then raise exception 'moderatör oturumu yok'; end if;
  return coalesce((select jsonb_agg(to_jsonb(b) - 'gonderen' order by b.oncelik desc, b.tarih)
    from public.basvurular b where b.durum = 'bekliyor'), '[]'::jsonb);
end;
$$;
revoke execute on function public.mod_kuyruk(text) from public;
grant execute on function public.mod_kuyruk(text) to anon, authenticated;

-- karar: dosya taşıma/silme Edge Function'da (service role); bu yalnızca satırları işler
create or replace function public.mod_karar(p_token text, p_id uuid, p_onay boolean, p_slug text, p_not text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.basvurular;
begin
  if not public.moderator_dogrula(p_token) then raise exception 'moderatör oturumu yok'; end if;
  select * into b from public.basvurular where id = p_id and durum = 'bekliyor' for update;
  if b.id is null then raise exception 'başvuru yok ya da karar verilmiş'; end if;
  update public.basvurular set durum = case when p_onay then 'onaylandi' else 'reddedildi' end,
    karar_notu = left(coalesce(p_not, ''), 400), karar_tarihi = now() where id = p_id;
  if p_onay then
    insert into public.yayindaki_evrenler (slug, baslik, ozet, dosya_yolu, yazar, basvuru)
      values (p_slug, b.baslik, b.ozet, p_slug || '.json.gz',
        (select coalesce(nullif(gorunen_ad, ''), kullanici_adi) from public.profiller where id = b.gonderen), b.id)
    on conflict (slug) do update set baslik = excluded.baslik, ozet = excluded.ozet, basvuru = excluded.basvuru, yayin_tarihi = now();
  end if;
  return jsonb_build_object('id', p_id, 'onay', p_onay);
end;
$$;
revoke execute on function public.mod_karar(text, uuid, boolean, text, text) from public;
grant execute on function public.mod_karar(text, uuid, boolean, text, text) to anon, authenticated;

-- yönetici: moderatör kodu ekle / kapat (kodun özeti gelir: mod_ozet(upper(kod), '#mod'))
create or replace function public.moderator_kod_ekle(p_ozet text, p_ad text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  if p_ozet !~ '^[0-9a-f]{64}$' then raise exception 'özet geçersiz'; end if;
  insert into public.moderator_kodlari (ozet, ad) values (p_ozet, left(coalesce(p_ad, ''), 60))
  on conflict (ozet) do update set aktif = true, ad = excluded.ad;
end;
$$;
revoke execute on function public.moderator_kod_ekle(text, text) from public, anon;
grant execute on function public.moderator_kod_ekle(text, text) to authenticated;

create or replace function public.moderator_kodlari_kapat() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  update public.moderator_kodlari set aktif = false where aktif;
  get diagnostics n = row_count;
  delete from public.moderator_oturumlari;
  return n;
end;
$$;
revoke execute on function public.moderator_kodlari_kapat() from public, anon;
grant execute on function public.moderator_kodlari_kapat() to authenticated;

-- ---------- Storage: kuyruk (kilitli) ve yayın (herkese açık) ----------
-- Test veritabanında storage şeması yok: yalnızca Supabase'de kurulur.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
      values ('onay-kuyrugu', 'onay-kuyrugu', false, 3145728), ('yayindaki-evrenler', 'yayindaki-evrenler', true, 3145728)
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;
    execute 'drop policy if exists "kuyruga_birak" on storage.objects';
    -- kişi yalnızca kendi klasörüne dosya bırakabilir; kimse (service role dışında) listeleyemez, okuyamaz, silemez
    execute $p$create policy "kuyruga_birak" on storage.objects for insert to authenticated
      with check (bucket_id = 'onay-kuyrugu' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;

alter table public.moderator_kodlari add column if not exists duzey text not null default 'fan';
-- Moderatör seviyesi server-side doğrulanır; fan kodu kanon statüsünü değiştiremez.
create or replace function public.moderator_kanon_dogrula(p_token text, p_kanon boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.moderator_oturumlari o
    join public.moderator_kodlari k on k.ozet = o.kod_ozet
    where o.token_ozet = public.mod_ozet(p_token, '#tok')
      and o.bitis > now() and k.aktif
      and (not coalesce(p_kanon, false) or k.duzey = 'kanon')
  );
$$;
revoke execute on function public.moderator_kanon_dogrula(text, boolean) from public;
grant execute on function public.moderator_kanon_dogrula(text, boolean) to anon, authenticated;
-- 4.0.2: onaylanan evren kanon ya da fan-made olarak yayımlanır (moderatör ya da yönetici değiştirebilir)
alter table public.yayindaki_evrenler add column if not exists kanon boolean not null default false;
create or replace function public.yayin_kanon(p_token text, p_slug text, p_kanon boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.tam_yonetici_mi() or public.moderator_kanon_dogrula(p_token, coalesce(p_kanon, false))) then raise exception 'yetki yok'; end if;
  update public.yayindaki_evrenler set kanon = coalesce(p_kanon, false) where slug = p_slug;
  return found;
end;
$$;
revoke execute on function public.yayin_kanon(text, text, boolean) from public;
grant execute on function public.yayin_kanon(text, text, boolean) to anon, authenticated;

-- 4.0.3: iki seviyeli moderatör. "fan": yalnızca fan-made onaylar; "kanon": fan-made ve kanon onaylar.
-- Onaylanan evren Supabase'de tutulmaz: moderasyon fonksiyonu onu GitHub deposuna yazar (evrenler/<adres>.json + veri.json).
alter table public.moderator_kodlari add column if not exists duzey text not null default 'fan';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'moderator_kodlari_duzey_check') then
    alter table public.moderator_kodlari add constraint moderator_kodlari_duzey_check check (duzey in ('fan', 'kanon'));
  end if;
end $$;

drop function if exists public.moderator_kod_ekle(text, text);
create or replace function public.moderator_kod_ekle(p_ozet text, p_ad text, p_duzey text default 'fan') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  if p_ozet !~ '^[0-9a-f]{64}$' then raise exception 'özet geçersiz'; end if;
  if coalesce(p_duzey, 'fan') not in ('fan', 'kanon') then raise exception 'düzey fan ya da kanon'; end if;
  insert into public.moderator_kodlari (ozet, ad, duzey) values (p_ozet, left(coalesce(p_ad, ''), 60), coalesce(p_duzey, 'fan'))
  on conflict (ozet) do update set aktif = true, ad = excluded.ad, duzey = excluded.duzey;
end;
$$;
revoke execute on function public.moderator_kod_ekle(text, text, text) from public, anon;
grant execute on function public.moderator_kod_ekle(text, text, text) to authenticated;

-- oturumdaki moderatörün adı ve düzeyi (yoksa null)
create or replace function public.moderator_bilgi(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ad', k.ad, 'duzey', k.duzey) from public.moderator_oturumlari o join public.moderator_kodlari k on k.ozet = o.kod_ozet
    where o.token_ozet = public.mod_ozet(p_token, '#tok') and o.bitis > now() and k.aktif limit 1;
$$;
revoke execute on function public.moderator_bilgi(text) from public;
grant execute on function public.moderator_bilgi(text) to anon, authenticated;

-- karar: yalnızca başvuru satırı işlenir (vitrin artık GitHub'da; Supabase'e evren yazılmaz)
create or replace function public.mod_karar(p_token text, p_id uuid, p_onay boolean, p_slug text, p_not text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.basvurular;
begin
  if not public.moderator_dogrula(p_token) then raise exception 'moderatör oturumu yok'; end if;
  select * into b from public.basvurular where id = p_id and durum = 'bekliyor' for update;
  if b.id is null then raise exception 'başvuru yok ya da karar verilmiş'; end if;
  update public.basvurular set durum = case when p_onay then 'onaylandi' else 'reddedildi' end,
    karar_notu = left(coalesce(p_not, ''), 400), karar_tarihi = now() where id = p_id;
  -- eski kayıtlar: başvuruların kararı verilmişse satır 60 gün sonra silinir (tablo büyümesin)
  delete from public.basvurular where durum <> 'bekliyor' and karar_tarihi < now() - interval '60 days';
  return jsonb_build_object('id', p_id, 'onay', p_onay);
end;
$$;

-- 4.0.3: yönetici moderatör kodlarını görür ve tek tek siler (kodun kendisi hiçbir yerde saklanmaz; yalnızca özetin başı gösterilir)
create or replace function public.moderator_kodlari_listesi() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('ozet', ozet, 'kisa', left(ozet, 8), 'ad', ad, 'duzey', duzey, 'aktif', aktif, 'olusturma', olusturma) order by olusturma desc)
    from public.moderator_kodlari), '[]'::jsonb);
end;
$$;
revoke execute on function public.moderator_kodlari_listesi() from public, anon;
grant execute on function public.moderator_kodlari_listesi() to authenticated;

create or replace function public.moderator_kod_sil(p_ozet text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  delete from public.moderator_kodlari where ozet = p_ozet;   -- oturumları da düşer (on delete cascade)
  return found;
end;
$$;
revoke execute on function public.moderator_kod_sil(text) from public, anon;
grant execute on function public.moderator_kod_sil(text) to authenticated;

-- ==================== 4.2: fan hikâyesi onayı, kurucu onayı, bildirimler, şikâyet, güncelleme, Pro kodu ====================

-- ---------- Pro hediye/deneme kodu uyumluluğu ----------
alter table public.tek_kodlar drop constraint if exists tek_kodlar_tur_check;
alter table public.tek_kodlar add constraint tek_kodlar_tur_check check (tur in ('evren', 'evren1', 'evrengezer', 'yonetici', 'kisi', 'pro30'));

-- ---------- kullanıcı bildirimleri (site ve uygulama içi; itme bildirimi Edge Function'dan) ------------ ---------- kullanıcı bildirimleri (site ve uygulama içi; itme bildirimi Edge Function'dan) ----------
create table if not exists public.kullanici_bildirimleri (
  no bigserial primary key,
  kullanici uuid not null references auth.users(id) on delete cascade,
  metin text not null check (char_length(metin) <= 400),
  baglanti text check (baglanti is null or baglanti ~ '^#/'),
  okundu boolean not null default false,
  zaman timestamptz not null default now()
);
create index if not exists kullanici_bildirimleri_kisi on public.kullanici_bildirimleri (kullanici, zaman desc);
alter table public.kullanici_bildirimleri add column if not exists kategori text not null default 'profil';
create index if not exists kullanici_bildirimleri_kategori on public.kullanici_bildirimleri (kullanici, kategori, zaman desc);
alter table public.kullanici_bildirimleri enable row level security;
drop policy if exists "bildirim_kendi" on public.kullanici_bildirimleri;
create policy "bildirim_kendi" on public.kullanici_bildirimleri for select to authenticated using (kullanici = auth.uid());

create or replace function public.kullaniciya_bildir(p_kullanici uuid, p_metin text, p_baglanti text) returns void
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if p_kullanici is null then return; end if;
  k := case
    when lower(coalesce(p_metin,'')) ~ 'hediye|üyelik|abonelik|evrengezer|evrenyazar' then 'hediye'
    when lower(coalesce(p_metin,'')) ~ 'rozet|madalya|kazandın|kilit' then 'rozet'
    when lower(coalesce(p_metin,'')) ~ 'okuma|bölüm|roman|ilerleme' then 'okuma'
    when lower(coalesce(p_metin,'')) ~ 'evren|davet|konuk' then 'evren'
    when lower(coalesce(p_metin,'')) ~ 'duyuru|bakım' then 'duyuru'
    else 'profil' end;
  insert into public.kullanici_bildirimleri (kullanici, metin, baglanti, kategori)
    values (p_kullanici, left(p_metin, 400), p_baglanti, k);
  delete from public.kullanici_bildirimleri where kullanici = p_kullanici and no not in
    (select no from public.kullanici_bildirimleri where kullanici = p_kullanici order by zaman desc limit 50);
end;
$$;
revoke execute on function public.kullaniciya_bildir(uuid, text, text) from public, anon, authenticated;

create or replace function public.yonetici_kisisel_bildirim(p_kullanici_adi text, p_baslik text, p_metin text, p_baglanti text default '#/sen') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare hedef uuid; baslik text := left(btrim(coalesce(p_baslik, '')), 80); metin text := left(btrim(coalesce(p_metin, '')), 300); adres text := case when coalesce(p_baglanti, '') like '#/%' then p_baglanti else '#/sen' end;
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  select id into hedef from public.profiller where kullanici_adi = lower(btrim(p_kullanici_adi)) limit 1;
  if hedef is null then return jsonb_build_object('durum', 'hedef_yok'); end if;
  if baslik = '' then return jsonb_build_object('durum', 'baslik_yok'); end if;
  perform public.kullaniciya_bildir(hedef, left(baslik || case when metin = '' then '' else ': ' || metin end, 400), adres);
  return jsonb_build_object('durum', 'tamam', 'uygulama', 1, 'hedef', lower(btrim(p_kullanici_adi)));
end;
$$;
revoke execute on function public.yonetici_kisisel_bildirim(text, text, text, text) from public, anon;
grant execute on function public.yonetici_kisisel_bildirim(text, text, text, text) to authenticated;



create or replace function public.bildirimleri_okundu() returns void
language sql security definer set search_path = '' as $$
  update public.kullanici_bildirimleri set okundu = true where kullanici = auth.uid() and not okundu;
$$;
revoke execute on function public.bildirimleri_okundu() from public, anon;
grant execute on function public.bildirimleri_okundu() to authenticated;

-- ---------- evren sahipliği ve kurucu onayı ayarı ----------
create table if not exists public.evren_sahipleri (
  slug text primary key,
  kullanici uuid not null references auth.users(id) on delete cascade,
  hikaye_onayi boolean not null default false,
  olusturma timestamptz not null default now()
);
alter table public.evren_sahipleri enable row level security;
drop policy if exists "sahip_kendi" on public.evren_sahipleri;
create policy "sahip_kendi" on public.evren_sahipleri for select to authenticated using (kullanici = auth.uid());

create or replace function public.evren_hikaye_onayi(p_slug text, p_acik boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.evren_sahipleri set hikaye_onayi = coalesce(p_acik, false) where slug = p_slug and kullanici = auth.uid();
  if not found then raise exception 'bu evrenin kurucusu değilsin'; end if;
  return coalesce(p_acik, false);
end;
$$;
revoke execute on function public.evren_hikaye_onayi(text, boolean) from public, anon;
grant execute on function public.evren_hikaye_onayi(text, boolean) to authenticated;

-- ---------- başvurular: tür (evren/hikâye), hedef evren, güncelleme, kurucu onayı ----------
alter table public.basvurular add column if not exists tur text not null default 'evren';
alter table public.basvurular add column if not exists evren_slug text;
alter table public.basvurular add column if not exists guncelle_slug text;
alter table public.basvurular add column if not exists kaynak_id text;
alter table public.basvurular add column if not exists yayin_slug text;
alter table public.basvurular drop constraint if exists basvurular_durum_check;
alter table public.basvurular add constraint basvurular_durum_check check (durum in ('kurucu_bekliyor', 'bekliyor', 'onaylandi', 'reddedildi'));
alter table public.basvurular drop constraint if exists basvurular_tur_check;
alter table public.basvurular add constraint basvurular_tur_check check (tur in ('evren', 'hikaye'));

create or replace function public.basvuru_teslim(p_tur text, p_baslik text, p_ozet text, p_dosya_yolu text, p_boyut int,
  p_evren text, p_guncelle text, p_kaynak text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); pro boolean; n int; yeni uuid; s public.evren_sahipleri; v_durum text := 'bekliyor';
begin
  if u is null then raise exception 'giriş gerekli'; end if;
  if p_tur not in ('evren', 'hikaye') then raise exception 'tür evren ya da hikaye'; end if;
  if p_dosya_yolu is null or p_dosya_yolu !~ ('^' || u::text || '/[A-Za-z0-9._-]{1,120}\.json\.gz$') then raise exception 'dosya yolu geçersiz'; end if;
  pro := public.pro_mu(u);
  select count(*) into n from public.basvurular where gonderen = u and durum in ('bekliyor', 'kurucu_bekliyor');
  if n >= (case when pro then 5 else 1 end) then raise exception 'bekleyen başvurun var (ücretsiz 1, Pro 5)'; end if;
  -- güncelleme: yalnızca evrenin kurucusu gönderebilir
  if p_guncelle is not null then
    if p_tur <> 'evren' or not exists (select 1 from public.evren_sahipleri where slug = p_guncelle and kullanici = u) then
      raise exception 'yalnızca evrenin kurucusu güncelleme gönderebilir';
    end if;
  end if;
  -- hikâye: evrenin kurucusu "hikâyeleri ben onaylayayım" dediyse önce ona gider
  if p_tur = 'hikaye' and p_evren is not null then
    select * into s from public.evren_sahipleri where slug = p_evren;
    if s.slug is not null and s.hikaye_onayi and s.kullanici <> u then v_durum := 'kurucu_bekliyor'; end if;
  end if;
  insert into public.basvurular (tur, baslik, ozet, dosya_yolu, boyut, gonderen, gonderen_eposta, oncelik, durum, evren_slug, guncelle_slug, kaynak_id)
    values (p_tur, left(btrim(p_baslik), 120), left(coalesce(p_ozet, ''), 600), p_dosya_yolu, greatest(0, coalesce(p_boyut, 0)), u,
      (select email from auth.users where id = u), pro, v_durum, p_evren, p_guncelle, left(coalesce(p_kaynak, ''), 60))
  returning id into yeni;
  if v_durum = 'kurucu_bekliyor' then
    perform public.kullaniciya_bildir(s.kullanici, 'Evrenine yeni bir hikâye yazıldı: “' || left(btrim(p_baslik), 80) || '”. Onayını bekliyor.', '#/sen');
  end if;
  return jsonb_build_object('id', yeni, 'durum', v_durum, 'kurucu', case when v_durum = 'kurucu_bekliyor' then s.kullanici end);
end;
$$;
revoke execute on function public.basvuru_teslim(text, text, text, text, int, text, text, text) from public, anon;
grant execute on function public.basvuru_teslim(text, text, text, text, int, text, text, text) to authenticated;

-- kurucu: onayını bekleyen hikâyeler ve karar
create or replace function public.kurucu_bekleyenler() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'baslik', b.baslik, 'ozet', b.ozet, 'evren', b.evren_slug, 'tarih', b.tarih) order by b.tarih), '[]'::jsonb)
    from public.basvurular b join public.evren_sahipleri s on s.slug = b.evren_slug
    where b.durum = 'kurucu_bekliyor' and s.kullanici = auth.uid();
$$;
revoke execute on function public.kurucu_bekleyenler() from public, anon;
grant execute on function public.kurucu_bekleyenler() to authenticated;

create or replace function public.kurucu_karar(p_id uuid, p_onay boolean, p_not text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.basvurular;
begin
  select bb.* into b from public.basvurular bb join public.evren_sahipleri s on s.slug = bb.evren_slug
    where bb.id = p_id and bb.durum = 'kurucu_bekliyor' and s.kullanici = auth.uid() for update of bb;
  if b.id is null then raise exception 'başvuru yok ya da senin evrenin değil'; end if;
  if p_onay then
    update public.basvurular set durum = 'bekliyor' where id = p_id;
    perform public.kullaniciya_bildir(b.gonderen, 'Evrenin kurucusu “' || b.baslik || '” hikâyeni onayladı; şimdi moderatörlerde.', '#/sen');
  else
    update public.basvurular set durum = 'reddedildi', karar_notu = left('Kurucu: ' || coalesce(p_not, ''), 400), karar_tarihi = now() where id = p_id;
    perform public.kullaniciya_bildir(b.gonderen, 'Evrenin kurucusu “' || b.baslik || '” hikâyeni reddetti' || coalesce(': ' || nullif(btrim(p_not), ''), '.'), '#/sen');
  end if;
  return jsonb_build_object('id', p_id, 'onay', p_onay, 'dosya', case when p_onay then null else b.dosya_yolu end);
end;
$$;
revoke execute on function public.kurucu_karar(uuid, boolean, text) from public, anon;
grant execute on function public.kurucu_karar(uuid, boolean, text) to authenticated;

-- başvurularım (kaynak ve yayın adresiyle: "güncelleme gönder" ve "düzelt, yeniden gönder" için)
create or replace function public.basvurularim() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tur', tur, 'baslik', baslik, 'durum', durum, 'karar_notu', karar_notu,
    'tarih', tarih, 'kaynak_id', kaynak_id, 'yayin_slug', yayin_slug, 'guncelle_slug', guncelle_slug) order by tarih desc), '[]'::jsonb)
    from (select * from public.basvurular where gonderen = auth.uid() order by tarih desc limit 20) b;
$$;
revoke execute on function public.basvurularim() from public, anon;
grant execute on function public.basvurularim() to authenticated;

-- moderatör kararı: gönderene bildirim; evren onayında kurucu kaydı
create or replace function public.mod_karar(p_token text, p_id uuid, p_onay boolean, p_slug text, p_not text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.basvurular; ad text;
begin
  if not public.moderator_dogrula(p_token) then raise exception 'moderatör oturumu yok'; end if;
  select * into b from public.basvurular where id = p_id and durum = 'bekliyor' for update;
  if b.id is null then raise exception 'başvuru yok ya da karar verilmiş'; end if;
  update public.basvurular set durum = case when p_onay then 'onaylandi' else 'reddedildi' end,
    karar_notu = left(coalesce(p_not, ''), 400), karar_tarihi = now(), yayin_slug = case when p_onay then p_slug end where id = p_id;
  ad := case when b.tur = 'hikaye' then 'hikâyen' else 'evrenin' end;
  if p_onay then
    if b.tur = 'evren' then
      insert into public.evren_sahipleri (slug, kullanici) values (p_slug, b.gonderen) on conflict (slug) do nothing;
    end if;
    perform public.kullaniciya_bildir(b.gonderen, '“' || b.baslik || '” ' || ad || ' onaylandı' || coalesce(': ' || nullif(btrim(p_not), ''), '') || '. Site güncellenince yayında.',
      case when b.tur = 'evren' then '#/ev/fan/' || p_slug else '#/fan' end);
  else
    perform public.kullaniciya_bildir(b.gonderen, '“' || b.baslik || '” ' || ad || ' reddedildi' || coalesce(': ' || nullif(btrim(p_not), ''), '.') || ' Düzeltip yeniden gönderebilirsin.', '#/sen');
  end if;
  delete from public.basvurular where durum in ('onaylandi', 'reddedildi') and karar_tarihi < now() - interval '60 days';
  return jsonb_build_object('id', p_id, 'onay', p_onay, 'gonderen', b.gonderen);
end;
$$;

-- kuyruk: tür, hedef evren ve güncelleme bilgisiyle (kurucu onayı bekleyenler moderatöre gelmez)
create or replace function public.mod_kuyruk(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.moderator_dogrula(p_token) then raise exception 'moderatör oturumu yok'; end if;
  return coalesce((select jsonb_agg(to_jsonb(b) - 'gonderen' - 'kaynak_id' ||
      jsonb_build_object('yazar_kadi', (select kullanici_adi from public.profiller where id = b.gonderen)) order by b.oncelik desc, b.tarih)
    from public.basvurular b where b.durum = 'bekliyor'), '[]'::jsonb);
end;
$$;

-- ---------- şikâyet ----------
create table if not exists public.sikayetler (
  no bigserial primary key,
  tur text not null check (tur in ('evren', 'hikaye')),
  slug text not null check (char_length(slug) <= 80),
  neden text not null check (char_length(neden) between 3 and 400),
  bildiren uuid not null references auth.users(id) on delete cascade,
  zaman timestamptz not null default now(),
  kapali boolean not null default false,
  unique (tur, slug, bildiren)
);
alter table public.sikayetler enable row level security;

create or replace function public.sikayet_et(p_tur text, p_slug text, p_neden text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'giriş gerekli'; end if;
  if (select count(*) from public.sikayetler where bildiren = auth.uid() and zaman > now() - interval '1 day') >= 10 then raise exception 'bugün çok şikâyet ettin'; end if;
  insert into public.sikayetler (tur, slug, neden, bildiren) values (p_tur, p_slug, left(btrim(p_neden), 400), auth.uid())
  on conflict (tur, slug, bildiren) do update set neden = excluded.neden, zaman = now(), kapali = false;
  return true;
end;
$$;
revoke execute on function public.sikayet_et(text, text, text) from public, anon;
grant execute on function public.sikayet_et(text, text, text) to authenticated;

create or replace function public.mod_sikayetler(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.moderator_dogrula(p_token) then raise exception 'moderatör oturumu yok'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('tur', tur, 'slug', slug, 'sayi', sayi, 'nedenler', nedenler) order by sayi desc)
    from (select tur, slug, count(*) sayi, jsonb_agg(neden order by zaman desc) nedenler from public.sikayetler where not kapali group by tur, slug) s), '[]'::jsonb);
end;
$$;
revoke execute on function public.mod_sikayetler(text) from public;
grant execute on function public.mod_sikayetler(text) to anon, authenticated;

create or replace function public.mod_sikayet_kapat(p_token text, p_tur text, p_slug text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.moderator_dogrula(p_token) then raise exception 'moderatör oturumu yok'; end if;
  update public.sikayetler set kapali = true where tur = p_tur and slug = p_slug and not kapali;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.mod_sikayet_kapat(text, text, text) from public;
grant execute on function public.mod_sikayet_kapat(text, text, text) to anon, authenticated;

create or replace function public.kurulum_surumu() returns text
language sql stable security definer set search_path = '' as $$ select '6.3.15'::text $$;
revoke all on function public.kurulum_surumu() from public;
grant execute on function public.kurulum_surumu() to anon, authenticated;
-- ---------- 5.4 migration: hediye geçmişi, alıcı bildirimi ve plan politikası ----------
-- 6.2.7: ücretsiz plan 1 evren, 3 EvrenGezer, 10 fan hikâyesi, 1 ek gezegen.
alter table public.kullanici_bildirimleri add column if not exists kategori text not null default 'profil';
create index if not exists kullanici_bildirimleri_kategori on public.kullanici_bildirimleri (kullanici, kategori, zaman desc);
create table if not exists public.hediye_gecmisi (
  id bigserial primary key,
  veren uuid not null references auth.users(id) on delete cascade,
  alan uuid not null references auth.users(id) on delete cascade,
  tip text not null check (tip in ('evrengezer','evrenyazar')),
  gun int not null check (gun between 1 and 3650),
  onceki_tip text,
  onceki_bitis timestamptz,
  yeni_bitis timestamptz not null,
  durum text not null default 'tamam',
  zaman timestamptz not null default now()
);
create index if not exists hediye_gecmisi_alan_zaman on public.hediye_gecmisi (alan, zaman desc);
create index if not exists hediye_gecmisi_veren_zaman on public.hediye_gecmisi (veren, zaman desc);
alter table public.hediye_gecmisi enable row level security;
drop policy if exists "hediye alan kendi geçmişini okur" on public.hediye_gecmisi;
create policy "hediye alan kendi geçmişini okur" on public.hediye_gecmisi for select to authenticated using (alan = auth.uid());
drop policy if exists "yönetici hediye geçmişini okur" on public.hediye_gecmisi;
create policy "yönetici hediye geçmişini okur" on public.hediye_gecmisi for select to authenticated using (public.tam_yonetici_mi());

create or replace function public.bildirimlerim() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('no', no, 'metin', metin, 'baglanti', baglanti, 'okundu', okundu, 'zaman', zaman, 'kategori', kategori) order by zaman desc), '[]'::jsonb)
    from (select * from public.kullanici_bildirimleri where kullanici = auth.uid() order by zaman desc limit 50) b;
$$;
revoke execute on function public.bildirimlerim() from public, anon;
grant execute on function public.bildirimlerim() to authenticated;

create or replace function public.abonelik_hediye(
  p_kullanici_adi text, p_tip text, p_gun int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hedef uuid;
  veren uuid := auth.uid();
  gun int := p_gun;
  tip text := lower(btrim(coalesce(p_tip, '')));
  kadi text := btrim(coalesce(p_kullanici_adi, ''));
  eski_tip text;
  eski_bitis timestamptz;
  yeni_bitis timestamptz;
  etkin_tip text;
begin
  if veren is null or not public.tam_yonetici_mi() then
    return jsonb_build_object('durum', 'yetki');
  end if;
  if kadi = '' or tip not in ('evrengezer', 'evrenyazar') or gun is null or gun < 1 or gun > 3650 then
    return jsonb_build_object('durum', 'gecersiz');
  end if;
  select id into hedef from public.profiller
    where lower(kullanici_adi) = lower(btrim(p_kullanici_adi)) limit 1;
  if hedef is null then return jsonb_build_object('durum', 'yok'); end if;
  select a.tip, a.bitis into eski_tip, eski_bitis
    from public.abonelikler a where a.id = hedef;
  if eski_tip = 'evrenyazar' and tip = 'evrengezer' then
    return jsonb_build_object('durum', 'dusurme_yok', 'tip', eski_tip);
  end if;
  etkin_tip := case
    when eski_tip = 'evrenyazar' or tip = 'evrenyazar' then 'evrenyazar'
    else tip
  end;
  yeni_bitis := greatest(coalesce(eski_bitis, now()), now())
    + make_interval(days => gun);
  insert into public.abonelikler (id, tip, bitis, guncelleme)
    values (hedef, etkin_tip, yeni_bitis, now())
    on conflict (id) do update set
      tip = excluded.tip, bitis = excluded.bitis, guncelleme = now();
  insert into public.hediye_gecmisi
    (veren, alan, tip, gun, onceki_tip, onceki_bitis, yeni_bitis)
    values (veren, hedef, tip, gun, eski_tip, eski_bitis, yeni_bitis);
  perform public.kullaniciya_bildir(
    hedef,
    'Yönetici sana ' || gun::text || ' günlük ' ||
      case when tip = 'evrenyazar' then 'EvrenYazar' else 'EvrenGezer' end ||
      ' üyeliği hediye etti. Bitiş: ' ||
      to_char(yeni_bitis at time zone 'Europe/Istanbul', 'DD.MM.YYYY'),
    '#/hesap'
  );
  return jsonb_build_object(
    'durum', 'tamam', 'tip', etkin_tip, 'gun', gun,
    'bitis', yeni_bitis, 'onceki_tip', eski_tip
  );
end;
$$;
revoke all on function public.abonelik_hediye(text, text, int) from public, anon;
grant execute on function public.abonelik_hediye(text, text, int) to authenticated;

-- Tüm tablolar ve fonksiyonlar oluşturulduktan sonra API şemasını bir kez yenile.
notify pgrst, 'reload schema';


-- 6.2.8 hazırlığı: Android FCM cihaz tokenları.
create table if not exists public.bildirim_cihazlari (
  id uuid primary key default gen_random_uuid(),
  kullanici uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  uygulama_surum text,
  aktif boolean not null default true,
  son_gorulme timestamptz not null default now(),
  olusturuldu timestamptz not null default now(),
  constraint bildirim_cihaz_platform check (platform in ('android')),
  constraint bildirim_cihaz_token_bos check (length(trim(token)) >= 20),
  constraint bildirim_cihaz_token_unique unique (platform, token)
);
create index if not exists bildirim_cihazlari_kullanici_idx on public.bildirim_cihazlari (kullanici, aktif);
alter table public.bildirim_cihazlari enable row level security;
drop policy if exists "bildirim_cihaz_kendi" on public.bildirim_cihazlari;
create policy "bildirim_cihaz_kendi" on public.bildirim_cihazlari for select to authenticated using (kullanici = auth.uid());
grant select on public.bildirim_cihazlari to authenticated;
revoke insert, update, delete on public.bildirim_cihazlari from anon, authenticated;
create or replace function public.bildirim_cihaz_kaydet(p_token text, p_platform text default 'android', p_surum text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('durum', 'giris'); end if;
  if lower(coalesce(p_platform, '')) <> 'android' or length(trim(coalesce(p_token, ''))) < 20 then return jsonb_build_object('durum', 'token'); end if;
  insert into public.bildirim_cihazlari (kullanici, token, platform, uygulama_surum, aktif, son_gorulme) values (auth.uid(), trim(p_token), 'android', nullif(trim(p_surum), ''), true, now()) on conflict (platform, token) do update set kullanici = excluded.kullanici, uygulama_surum = excluded.uygulama_surum, aktif = true, son_gorulme = now();
  return jsonb_build_object('durum', 'tamam');
end $$;
revoke execute on function public.bildirim_cihaz_kaydet(text, text, text) from public, anon;
grant execute on function public.bildirim_cihaz_kaydet(text, text, text) to authenticated;
create or replace function public.bildirim_cihaz_kapat(p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare n integer := 0;
begin
  if auth.uid() is null then return jsonb_build_object('durum', 'giris'); end if;
  update public.bildirim_cihazlari set aktif = false, son_gorulme = now() where token = trim(p_token) and kullanici = auth.uid();
  get diagnostics n = row_count;
  return jsonb_build_object('durum', 'tamam', 'guncellenen', n);
end $$;
revoke execute on function public.bildirim_cihaz_kapat(text) from public, anon;
grant execute on function public.bildirim_cihaz_kapat(text) to authenticated;
notify pgrst, 'reload schema';

-- 6.2.10: idempotent offline operation inbox
create table if not exists public.offline_islemler (kullanici uuid not null references auth.users(id) on delete cascade, istemci_id text not null, tur text not null check (tur ~ '^[a-z0-9_-]{1,80}$'), veri jsonb not null, olusturma timestamptz not null default now(), primary key (kullanici, istemci_id), constraint offline_veri_boyut check (pg_column_size(veri) <= 100000));
alter table public.offline_islemler enable row level security;
revoke all on public.offline_islemler from anon, authenticated;
create or replace function public.offline_islem_kaydet(p_istemci_id text, p_tur text, p_veri jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$ declare uid uuid := auth.uid(); begin if uid is null then return jsonb_build_object('durum','giris'); end if; if p_istemci_id is null or p_istemci_id !~ '^q_[a-z0-9_]{3,100}$' or p_tur is null or p_tur !~ '^[a-z0-9_-]{1,80}$' or p_veri is null then return jsonb_build_object('durum','veri'); end if; insert into public.offline_islemler(kullanici, istemci_id, tur, veri) values(uid,p_istemci_id,p_tur,p_veri) on conflict (kullanici, istemci_id) do nothing; return jsonb_build_object('durum','tamam','istemci_id',p_istemci_id); exception when check_violation then return jsonb_build_object('durum','boyut'); end; $$;
revoke all on function public.offline_islem_kaydet(text,text,jsonb) from public, anon; grant execute on function public.offline_islem_kaydet(text,text,jsonb) to authenticated;


-- TentiforApp 6.3.0 — keşif, arşivci profili, takip, gizlilik ve raflar
alter table public.profiller add column if not exists profil_arama_gorunur boolean not null default true;
alter table public.profiller add column if not exists profil_icerik_gorunur boolean not null default true;
alter table public.profiller add column if not exists takip_listesi_gorunur boolean not null default true;

-- View yalnızca public profil sözleşmesini taşır; özel ilerleme ve e-posta taşımaz.
create or replace view public.public_profiller as
select id, kullanici_adi, gorunen_ad, gorsel, tentifor_adi, hakkinda, vitrin,
       olusturma, guncelleme, profil_arama_gorunur, profil_icerik_gorunur, takip_listesi_gorunur
from public.profiller
where coalesce(profil_arama_gorunur, true);
grant select on public.public_profiller to anon, authenticated;

create index if not exists profiller_kullanici_adi_prefix_idx
  on public.profiller (lower(kullanici_adi));
create index if not exists yayindaki_evrenler_yayin_tarihi_idx
  on public.yayindaki_evrenler (yayin_tarihi desc);

-- Kullanıcı araması: e-posta, id ve özel alanlar hiçbir zaman dönmez.
create or replace function public.kullanici_ara(p_sorgu text, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_sorgu, ''))); n int := greatest(1, least(coalesce(p_limit, 20), 20));
begin
  if char_length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'tur','kullanici','kullanici_adi',p.kullanici_adi,'gorunen_ad',p.gorunen_ad,
    'gorsel',p.gorsel,'tentifor_adi',p.tentifor_adi,
    'takip_ediliyor',exists(select 1 from public.takipler t where t.takip_eden = auth.uid() and t.takip_edilen = p.id)
  ) order by case when lower(p.kullanici_adi)=q then 0 when lower(p.kullanici_adi) like q||'%' then 1 else 2 end, p.kullanici_adi)
  from public.profiller p left join public.istatistikler s on s.id=p.id
  where p.kullanici_adi is not null and coalesce(p.profil_arama_gorunur,true)
    and not coalesce(s.gizli or s.askida or s.engelli,false)
    and not exists (select 1 from public.kullanici_engelleri e where (e.engelleyen=auth.uid() and e.engellenen=p.id) or (e.engelleyen=p.id and e.engellenen=auth.uid()))
    and (lower(p.kullanici_adi) like '%'||q||'%' or lower(coalesce(p.gorunen_ad,'')) like '%'||q||'%' or lower(coalesce(p.tentifor_adi,'')) like '%'||q||'%')
  limit n), '[]'::jsonb);
end;
$$;
revoke all on function public.kullanici_ara(text,int) from public;
grant execute on function public.kullanici_ara(text,int) to anon, authenticated;

-- Evrensel arama: kullanıcılar ve yayınlanmış fan evrenleri. Özel/taslak içerik yoktur.
create or replace function public.kesif_ara(p_sorgu text, p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_sorgu, ''))); n int := greatest(1, least(coalesce(p_limit, 30), 30)); sonuc jsonb;
begin
  if char_length(q) < 2 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(x order by x->>'tur', x->>'baslik'), '[]'::jsonb) into sonuc from (
    (select jsonb_build_object('tur','kullanici','id',p.kullanici_adi,'baslik',coalesce(nullif(p.gorunen_ad,''),p.kullanici_adi),'alt','@'||p.kullanici_adi,'adres','#/u/'||p.kullanici_adi) x
    from public.profiller p left join public.istatistikler s on s.id=p.id
    where p.kullanici_adi is not null and coalesce(p.profil_arama_gorunur,true)
      and not coalesce(s.gizli or s.askida or s.engelli,false)
      and not exists (select 1 from public.kullanici_engelleri e where (e.engelleyen=auth.uid() and e.engellenen=p.id) or (e.engelleyen=p.id and e.engellenen=auth.uid()))
      and (lower(p.kullanici_adi) like '%'||q||'%' or lower(coalesce(p.gorunen_ad,'')) like '%'||q||'%' or lower(coalesce(p.tentifor_adi,'')) like '%'||q||'%')
    limit n)
    union all
    (select jsonb_build_object('tur','evren','id',y.slug,'baslik',y.baslik,'alt',left(y.ozet,160),'adres','#/ev/fan/'||y.slug) x
    from public.yayindaki_evrenler y
    left join public.basvurular b on b.id=y.basvuru
    left join public.profiller p on p.id=b.gonderen
    left join public.istatistikler s on s.id=p.id
    where lower(y.baslik||' '||y.ozet) like '%'||q||'%'
      and (p.id is null or (coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)))
    limit n)
  ) x;
  return sonuc;
end;
$$;
revoke all on function public.kesif_ara(text,int) from public;
grant execute on function public.kesif_ara(text,int) to anon, authenticated;

-- Public profil özeti ve yayınlanmış fan evrenleri tek güvenli RPC'den alınır.
create or replace function public.public_kullanici_profili(p_kullanici_adi text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.profiller; s public.istatistikler; uid uuid := auth.uid();
begin
  select * into p from public.profiller where lower(kullanici_adi)=lower(btrim(p_kullanici_adi)) and coalesce(profil_arama_gorunur,true);
  if p.id is null then return null; end if;
  select * into s from public.istatistikler where id=p.id;
  if coalesce(s.gizli or s.askida or s.engelli,false) then return null; end if;
  if exists (select 1 from public.kullanici_engelleri e where (e.engelleyen=uid and e.engellenen=p.id) or (e.engelleyen=p.id and e.engellenen=uid)) then return null; end if;
  return jsonb_build_object(
    'profil', jsonb_build_object('kullanici_adi',p.kullanici_adi,'gorunen_ad',p.gorunen_ad,'gorsel',p.gorsel,'tentifor_adi',p.tentifor_adi,'hakkinda',p.hakkinda,'vitrin',p.vitrin,'olusturma',p.olusturma,'profil_icerik_gorunur',coalesce(p.profil_icerik_gorunur,true)),
    'takip_ediliyor', exists(select 1 from public.takipler t where t.takip_eden=uid and t.takip_edilen=p.id),
    'takipci', (select count(*) from public.takipler where takip_edilen=p.id),
    'takip', (select count(*) from public.takipler where takip_eden=p.id),
    'evrenler', case when coalesce(p.profil_icerik_gorunur,true) then coalesce((select jsonb_agg(jsonb_build_object('id',y.slug,'baslik',y.baslik,'ozet',y.ozet,'tarih',y.yayin_tarihi) order by y.yayin_tarihi desc) from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru where b.gonderen=p.id), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;
revoke all on function public.public_kullanici_profili(text) from public;
grant execute on function public.public_kullanici_profili(text) to anon, authenticated;

-- Engelleme: arama/profil/takip RPC'leri için ortak kaynak.
create table if not exists public.kullanici_engelleri (
  engelleyen uuid not null references auth.users(id) on delete cascade,
  engellenen uuid not null references auth.users(id) on delete cascade,
  zaman timestamptz not null default now(),
  primary key (engelleyen, engellenen),
  check (engelleyen <> engellenen)
);
alter table public.kullanici_engelleri enable row level security;
revoke all on public.kullanici_engelleri from anon, authenticated;
create or replace function public.kullanici_engelle(p_kullanici_adi text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); hedef uuid; mevcut boolean;
begin
  if uid is null then return false; end if;
  select id into hedef from public.profiller where lower(kullanici_adi)=lower(btrim(p_kullanici_adi));
  if hedef is null or hedef=uid then return false; end if;
  select exists(select 1 from public.kullanici_engelleri where engelleyen=uid and engellenen=hedef) into mevcut;
  if mevcut then delete from public.kullanici_engelleri where engelleyen=uid and engellenen=hedef; else insert into public.kullanici_engelleri values(uid,hedef); delete from public.takipler where takip_eden=uid and takip_edilen=hedef; end if;
  return not mevcut;
end;
$$;
revoke all on function public.kullanici_engelle(text) from public, anon;
grant execute on function public.kullanici_engelle(text) to authenticated;
-- Takip RPC'si engel ilişkilerini iki yönde de uygular.
create or replace function public.takip_et(p_ad text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); hedef uuid; mevcut boolean;
begin
  if uid is null then return false; end if;
  select id into hedef from public.profiller where kullanici_adi = lower(btrim(p_ad));
  if hedef is null or hedef = uid or exists(select 1 from public.kullanici_engelleri e where (e.engelleyen=uid and e.engellenen=hedef) or (e.engelleyen=hedef and e.engellenen=uid)) then return false; end if;
  select exists(select 1 from public.takipler where takip_eden=uid and takip_edilen=hedef) into mevcut;
  if mevcut then delete from public.takipler where takip_eden=uid and takip_edilen=hedef; else if (select count(*) from public.takipler where takip_eden=uid) >= 500 then return false; end if; insert into public.takipler(takip_eden,takip_edilen) values(uid,hedef); end if;
  return not mevcut;
end;
$$;
revoke all on function public.takip_et(text) from public, anon;
grant execute on function public.takip_et(text) to authenticated;


-- Kişisel raf temeli: içerik adresi ve başlık kullanıcı hesabına bağlıdır.
create table if not exists public.kisisel_raf (
  kullanici uuid not null references auth.users(id) on delete cascade,
  raf text not null check (raf ~ '^[a-z0-9_-]{1,40}$'),
  adres text not null check (char_length(adres) between 2 and 240),
  baslik text not null default '' check (char_length(baslik) <= 160),
  eklenme timestamptz not null default now(),
  primary key (kullanici, raf, adres)
);
alter table public.kisisel_raf enable row level security;
revoke all on public.kisisel_raf from anon, authenticated;
create or replace function public.raf_kaydet(p_raf text,p_adres text,p_baslik text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('durum','giris'); end if;
  if p_raf !~ '^[a-z0-9_-]{1,40}$' or p_adres is null or char_length(p_adres) < 2 then return jsonb_build_object('durum','gecersiz'); end if;
  insert into public.kisisel_raf(kullanici,raf,adres,baslik) values(auth.uid(),p_raf,left(p_adres,240),left(coalesce(p_baslik,''),160)) on conflict do nothing;
  return jsonb_build_object('durum','tamam');
end;
$$;
revoke all on function public.raf_kaydet(text,text,text) from public, anon;
grant execute on function public.raf_kaydet(text,text,text) to authenticated;
notify pgrst, 'reload schema';


-- TentiforApp 6.3.1 — kişisel raflar, okuma yolları ve evren ilişkileri
-- 6.3.0 kisisel_raf tablosunu listeleme/silme RPC'leriyle tamamlar.
create or replace function public.raf_listele() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('raf',raf,'adres',adres,'baslik',baslik,'eklenme',eklenme) order by eklenme desc), '[]'::jsonb)
  from public.kisisel_raf where kullanici=auth.uid();
$$;
revoke all on function public.raf_listele() from public, anon;
grant execute on function public.raf_listele() to authenticated;
create or replace function public.raf_sil(p_raf text,p_adres text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  delete from public.kisisel_raf where kullanici=auth.uid() and raf=p_raf and adres=p_adres;
  return found;
end;
$$;
revoke all on function public.raf_sil(text,text) from public, anon;
grant execute on function public.raf_sil(text,text) to authenticated;

create table if not exists public.okuma_yollari (
  id uuid primary key default gen_random_uuid(),
  sahibi uuid not null references auth.users(id) on delete cascade,
  baslik text not null check (char_length(btrim(baslik)) between 1 and 120),
  aciklama text not null default '' check (char_length(aciklama) <= 600),
  public_mu boolean not null default false,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
create index if not exists okuma_yollari_public_idx on public.okuma_yollari(public_mu,guncelleme desc);
alter table public.okuma_yollari enable row level security;
revoke all on public.okuma_yollari from anon, authenticated;
create table if not exists public.okuma_yolu_adimlari (
  id bigserial primary key,
  yol uuid not null references public.okuma_yollari(id) on delete cascade,
  sira int not null check (sira between 1 and 200),
  adres text not null check (char_length(adres) between 2 and 240 and adres ~ '^(#|/)'),
  baslik text not null default '' check (char_length(baslik) <= 160),
  tur text not null default 'icerik' check (tur in ('icerik','evren','hikaye','karakter','not')),
  spoiler text not null default 'yok' check (spoiler in ('yok','az','var')),
  unique(yol,sira)
);
create index if not exists okuma_yolu_adimlari_yol_idx on public.okuma_yolu_adimlari(yol,sira);
alter table public.okuma_yolu_adimlari enable row level security;
revoke all on public.okuma_yolu_adimlari from anon, authenticated;

create or replace function public.okuma_yolu_olustur(p_baslik text,p_aciklama text default '',p_public boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare yeni uuid; uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  if char_length(btrim(coalesce(p_baslik,''))) not between 1 and 120 then raise exception 'başlık geçersiz'; end if;
  if (select count(*) from public.okuma_yollari where sahibi=uid) >= 50 then raise exception 'en fazla 50 okuma yolu'; end if;
  insert into public.okuma_yollari(sahibi,baslik,aciklama,public_mu) values(uid,left(btrim(p_baslik),120),left(coalesce(p_aciklama,''),600),coalesce(p_public,false)) returning id into yeni;
  return yeni;
end;
$$;
revoke all on function public.okuma_yolu_olustur(text,text,boolean) from public, anon;
grant execute on function public.okuma_yolu_olustur(text,text,boolean) to authenticated;

create or replace function public.okuma_yolu_adim_ekle(p_yol uuid,p_adres text,p_baslik text,p_tur text default 'icerik',p_spoiler text default 'yok') returns bigint
language plpgsql security definer set search_path = '' as $$
declare yeni bigint; sira int; uid uuid:=auth.uid();
begin
  if uid is null or not exists(select 1 from public.okuma_yollari where id=p_yol and sahibi=uid) then raise exception 'okuma yolu yetkisi yok'; end if;
  if p_adres is null or p_adres !~ '^(#|/)' then raise exception 'adres geçersiz'; end if;
  select coalesce(max(sira),0)+1 into sira from public.okuma_yolu_adimlari where yol=p_yol;
  if sira > 200 then raise exception 'okuma yolu dolu'; end if;
  insert into public.okuma_yolu_adimlari(yol,sira,adres,baslik,tur,spoiler) values(p_yol,sira,left(p_adres,240),left(coalesce(p_baslik,''),160),coalesce(p_tur,'icerik'),coalesce(p_spoiler,'yok')) returning id into yeni;
  update public.okuma_yollari set guncelleme=now() where id=p_yol;
  return yeni;
end;
$$;
revoke all on function public.okuma_yolu_adim_ekle(uuid,text,text,text,text) from public, anon;
grant execute on function public.okuma_yolu_adim_ekle(uuid,text,text,text,text) to authenticated;

create or replace function public.okuma_yollari_listele(p_kullanici_adi text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare hedef uuid; uid uuid:=auth.uid();
begin
  if p_kullanici_adi is null and uid is null then return '[]'::jsonb; end if;
  if p_kullanici_adi is null then hedef:=uid; else select id into hedef from public.profiller where lower(kullanici_adi)=lower(btrim(p_kullanici_adi)) and coalesce(profil_arama_gorunur,true); end if;
  if hedef is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',y.id,'baslik',y.baslik,'aciklama',y.aciklama,'public',y.public_mu,'sahibi',p.kullanici_adi,'adim',coalesce((select count(*) from public.okuma_yolu_adimlari a where a.yol=y.id),0)) order by y.guncelleme desc) from public.okuma_yollari y join public.profiller p on p.id=y.sahibi where y.sahibi=hedef and (y.public_mu or hedef=uid)), '[]'::jsonb);
end;
$$;
revoke all on function public.okuma_yollari_listele(text) from public;
grant execute on function public.okuma_yollari_listele(text) to anon, authenticated;

create or replace function public.okuma_yolu_detay(p_yol uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare y public.okuma_yollari; p public.profiller; uid uuid:=auth.uid();
begin
  select * into y from public.okuma_yollari where id=p_yol;
  if y.id is null or (not y.public_mu and y.sahibi<>uid) then return null; end if;
  select * into p from public.profiller where id=y.sahibi;
  return jsonb_build_object('id',y.id,'baslik',y.baslik,'aciklama',y.aciklama,'public',y.public_mu,'sahibi',p.kullanici_adi,'adim',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'sira',a.sira,'adres',a.adres,'baslik',a.baslik,'tur',a.tur,'spoiler',a.spoiler) order by a.sira) from public.okuma_yolu_adimlari a where a.yol=y.id),'[]'::jsonb));
end;
$$;
revoke all on function public.okuma_yolu_detay(uuid) from public;
grant execute on function public.okuma_yolu_detay(uuid) to anon, authenticated;

-- Evren grafiği için sahip kontrollü, düşük hacimli bağlantı tabanı.
create table if not exists public.evren_baglantilari (
  id bigserial primary key,
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren text not null check (char_length(evren) between 1 and 80),
  kaynak text not null check (char_length(kaynak) between 1 and 120),
  hedef text not null check (char_length(hedef) between 1 and 120),
  iliski text not null default 'bağlı' check (char_length(iliski) between 1 and 60),
  public_mu boolean not null default false,
  olusturma timestamptz not null default now(),
  unique(sahibi,evren,kaynak,hedef,iliski)
);
alter table public.evren_baglantilari enable row level security;
revoke all on public.evren_baglantilari from anon, authenticated;
create or replace function public.evren_baglantisi_ekle(p_evren text,p_kaynak text,p_hedef text,p_iliski text default 'bağlı',p_public boolean default false) returns bigint
language plpgsql security definer set search_path = '' as $$
declare yeni bigint; uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  if (select count(*) from public.evren_baglantilari where sahibi=uid) >= 1000 then raise exception 'grafik sınırı'; end if;
  insert into public.evren_baglantilari(sahibi,evren,kaynak,hedef,iliski,public_mu) values(uid,left(p_evren,80),left(p_kaynak,120),left(p_hedef,120),left(coalesce(p_iliski,'bağlı'),60),coalesce(p_public,false)) on conflict (sahibi,evren,kaynak,hedef,iliski) do update set public_mu=excluded.public_mu returning id into yeni;
  return yeni;
end;
$$;
revoke all on function public.evren_baglantisi_ekle(text,text,text,text,boolean) from public, anon;
grant execute on function public.evren_baglantisi_ekle(text,text,text,text,boolean) to authenticated;
create or replace function public.evren_grafigi(p_evren text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('kaynak',kaynak,'hedef',hedef,'iliski',iliski) order by kaynak,hedef), '[]'::jsonb)
  from public.evren_baglantilari where evren=p_evren and (public_mu or sahibi=auth.uid());
$$;
revoke all on function public.evren_grafigi(text) from public;
grant execute on function public.evren_grafigi(text) to anon, authenticated;
notify pgrst, 'reload schema';


-- TentiforApp 6.3.2 — takip akışı, sosyal bildirimler ve içerik raporları
-- Takip RPC'si karşılıklı engeli korur ve yalnızca yeni takipte bildirim üretir.
create or replace function public.takip_et(p_ad text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); hedef uuid; hedef_kadi text; mevcut boolean;
begin
  if uid is null then return false; end if;
  select id, kullanici_adi into hedef, hedef_kadi from public.profiller where kullanici_adi = lower(btrim(p_ad));
  if hedef is null or hedef = uid or exists(select 1 from public.kullanici_engelleri e where (e.engelleyen=uid and e.engellenen=hedef) or (e.engelleyen=hedef and e.engellenen=uid)) then return false; end if;
  select exists(select 1 from public.takipler where takip_eden=uid and takip_edilen=hedef) into mevcut;
  if mevcut then
    delete from public.takipler where takip_eden=uid and takip_edilen=hedef;
  else
    if (select count(*) from public.takipler where takip_eden=uid) >= 500 then return false; end if;
    insert into public.takipler(takip_eden,takip_edilen) values(uid,hedef);
    perform public.kullaniciya_bildir(hedef, '@' || (select kullanici_adi from public.profiller where id=uid) || ' seni takip etmeye başladı.', '#/u/' || (select kullanici_adi from public.profiller where id=uid));
  end if;
  return not mevcut;
end;
$$;
revoke all on function public.takip_et(text) from public, anon;
grant execute on function public.takip_et(text) to authenticated;

-- Takip edilen arşivcilerin yalnızca public içeriklerinden birleşik akış.
create or replace function public.takip_akisi() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(q.x order by (q.x->>'zaman')::timestamptz desc), '[]'::jsonb) from (
    select x from (
    select jsonb_build_object('tur','evren','id',y.slug,'baslik',y.baslik,'metin',left(y.ozet,220),'kullanici_adi',p.kullanici_adi,'zaman',y.yayin_tarihi,'adres','#/ev/fan/'||y.slug) x
    from public.takipler t join public.basvurular b on b.gonderen=t.takip_edilen join public.yayindaki_evrenler y on y.basvuru=b.id join public.profiller p on p.id=t.takip_edilen left join public.istatistikler s on s.id=p.id
    where t.takip_eden=auth.uid() and coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)
    union all
    select jsonb_build_object('tur','teori','id',te.id,'baslik',te.konu,'metin',left(te.metin,220),'kullanici_adi',p.kullanici_adi,'zaman',te.zaman,'adres','#/bilinmeyenler') x
    from public.takipler t join public.teoriler te on te.kullanici=t.takip_edilen join public.profiller p on p.id=t.takip_edilen left join public.istatistikler s on s.id=p.id
    where t.takip_eden=auth.uid() and not te.gizli and coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)
    union all
    select jsonb_build_object('tur','defter','id',d.id,'baslik','Kütüphane Defteri','metin',left(d.metin,220),'kullanici_adi',p.kullanici_adi,'zaman',d.zaman,'adres','#/ortakDefter') x
    from public.takipler t join public.defter_cumleleri d on d.kullanici=t.takip_edilen join public.profiller p on p.id=t.takip_edilen left join public.istatistikler s on s.id=p.id
    where t.takip_eden=auth.uid() and not d.gizli and coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)
  ) x order by (x->>'zaman')::timestamptz desc limit 80
  ) q;
$$;
revoke all on function public.takip_akisi() from public, anon;
grant execute on function public.takip_akisi() to authenticated;

-- Public profil etkinliği: arama/profil görünürlüğü ve içerik görünürlüğü uygulanır.
create or replace function public.public_profil_etkinlikleri(p_kullanici_adi text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(q.x order by (q.x->>'zaman')::timestamptz desc), '[]'::jsonb) from (
    select x from (
    select jsonb_build_object('tur','evren','id',y.slug,'baslik',y.baslik,'metin',left(y.ozet,220),'zaman',y.yayin_tarihi,'adres','#/ev/fan/'||y.slug) x
    from public.profiller p join public.basvurular b on b.gonderen=p.id join public.yayindaki_evrenler y on y.basvuru=b.id left join public.istatistikler s on s.id=p.id
    where lower(p.kullanici_adi)=lower(btrim(p_kullanici_adi)) and coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)
    union all
    select jsonb_build_object('tur','teori','id',te.id,'baslik',te.konu,'metin',left(te.metin,220),'zaman',te.zaman,'adres','#/bilinmeyenler') x
    from public.profiller p join public.teoriler te on te.kullanici=p.id left join public.istatistikler s on s.id=p.id
    where lower(p.kullanici_adi)=lower(btrim(p_kullanici_adi)) and coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true) and not te.gizli and not coalesce(s.gizli or s.askida or s.engelli,false)
  ) x order by (x->>'zaman')::timestamptz desc limit 50
  ) q;
$$;
revoke all on function public.public_profil_etkinlikleri(text) from public;
grant execute on function public.public_profil_etkinlikleri(text) to anon, authenticated;

-- Evren, teori, defter ve public profil raporları için ayrı moderasyon kuyruğu.
create table if not exists public.sosyal_sikayetler (
  id bigserial primary key,
  bildiren uuid not null references auth.users(id) on delete cascade,
  tur text not null check (tur in ('evren','teori','defter','profil')),
  hedef text not null check (char_length(hedef) between 1 and 120),
  neden text not null check (char_length(neden) between 3 and 400),
  durum text not null default 'bekliyor' check (durum in ('bekliyor','incelendi','kapatildi')),
  zaman timestamptz not null default now(),
  unique (bildiren,tur,hedef)
);
create index if not exists sosyal_sikayetler_durum_zaman on public.sosyal_sikayetler(durum,zaman desc);
alter table public.sosyal_sikayetler enable row level security;
revoke all on public.sosyal_sikayetler from anon, authenticated;
create or replace function public.sosyal_sikayet_et(p_tur text,p_hedef text,p_neden text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); n int;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if p_tur not in ('evren','teori','defter','profil') or char_length(btrim(coalesce(p_hedef,''))) < 1 or char_length(btrim(coalesce(p_neden,''))) < 3 then return jsonb_build_object('durum','gecersiz'); end if;
  select count(*) into n from public.sosyal_sikayetler where bildiren=uid and zaman>now()-interval '1 day';
  if n>=20 then return jsonb_build_object('durum','sinir'); end if;
  insert into public.sosyal_sikayetler(bildiren,tur,hedef,neden) values(uid,p_tur,left(btrim(p_hedef),120),left(btrim(p_neden),400)) on conflict (bildiren,tur,hedef) do update set neden=excluded.neden,zaman=now(),durum='bekliyor';
  return jsonb_build_object('durum','tamam');
end;
$$;
revoke all on function public.sosyal_sikayet_et(text,text,text) from public, anon;
grant execute on function public.sosyal_sikayet_et(text,text,text) to authenticated;
create or replace function public.sosyal_sikayetler_yukle() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'tur',tur,'hedef',hedef,'neden',neden,'zaman',zaman,'durum',durum) order by zaman desc), '[]'::jsonb)
  from (select id,tur,hedef,neden,zaman,durum from public.sosyal_sikayetler where public.yonetici_yetki('istatistik') and durum='bekliyor' order by zaman desc limit 200) q;
$$;
revoke all on function public.sosyal_sikayetler_yukle() from public, anon, authenticated;
notify pgrst, 'reload schema';


-- TentiforApp 6.3.3 — kurucu taslakları, sürüm geçmişi ve zaman çizelgesi
create table if not exists public.evren_taslaklari (
  id uuid primary key default gen_random_uuid(),
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null check (char_length(btrim(evren_id)) between 1 and 80),
  baslik text not null check (char_length(btrim(baslik)) between 1 and 160),
  surum int not null check (surum >= 1),
  veri jsonb not null check (pg_column_size(veri) < 1000000),
  durum text not null default 'taslak' check (durum in ('taslak','onizleme','arsiv')),
  olusturma timestamptz not null default now(),
  unique(sahibi,evren_id,surum)
);
create index if not exists evren_taslaklari_sahip_idx on public.evren_taslaklari(sahibi,evren_id,surum desc);
alter table public.evren_taslaklari enable row level security;
revoke all on public.evren_taslaklari from anon, authenticated;

create or replace function public.evren_taslak_kaydet(p_evren_id text,p_baslik text,p_veri jsonb,p_durum text default 'taslak') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); yeni uuid; n int; temiz text:=btrim(coalesce(p_evren_id,'')); bas text:=btrim(coalesce(p_baslik,''));
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if temiz='' or char_length(bas) not between 1 and 160 or p_veri is null or pg_column_size(p_veri)>=1000000 then return jsonb_build_object('durum','gecersiz'); end if;
  if p_durum not in ('taslak','onizleme','arsiv') then return jsonb_build_object('durum','gecersiz'); end if;
  select coalesce(max(surum),0)+1 into n from public.evren_taslaklari where sahibi=uid and evren_id=temiz;
  if n>1000 then delete from public.evren_taslaklari where sahibi=uid and evren_id=temiz and surum=(select min(surum) from public.evren_taslaklari where sahibi=uid and evren_id=temiz); end if;
  insert into public.evren_taslaklari(sahibi,evren_id,baslik,surum,veri,durum) values(uid,left(temiz,80),left(bas,160),n,p_veri,p_durum) returning id into yeni;
  return jsonb_build_object('durum','tamam','id',yeni,'surum',n);
end;
$$;
revoke all on function public.evren_taslak_kaydet(text,text,jsonb,text) from public, anon;
grant execute on function public.evren_taslak_kaydet(text,text,jsonb,text) to authenticated;
create or replace function public.evren_taslaklarim() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'evren_id',q.evren_id,'baslik',q.baslik,'surum',q.surum,'durum',q.durum,'olusturma',q.olusturma) order by q.olusturma desc), '[]'::jsonb)
  from (select distinct on (evren_id) id,evren_id,baslik,surum,durum,olusturma from public.evren_taslaklari where sahibi=auth.uid() order by evren_id,surum desc) q;
$$;
revoke all on function public.evren_taslaklarim() from public, anon;
grant execute on function public.evren_taslaklarim() to authenticated;
create or replace function public.evren_taslak_detay(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when sahibi=auth.uid() then jsonb_build_object('id',id,'evren_id',evren_id,'baslik',baslik,'surum',surum,'durum',durum,'veri',veri,'olusturma',olusturma) else null end from public.evren_taslaklari where id=p_id;
$$;
revoke all on function public.evren_taslak_detay(uuid) from public, anon;
grant execute on function public.evren_taslak_detay(uuid) to authenticated;

create table if not exists public.evren_zaman_noktalari (
  id bigserial primary key,
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null check (char_length(evren_id) between 1 and 80),
  zaman text not null check (char_length(zaman) between 1 and 60),
  baslik text not null check (char_length(baslik) between 1 and 160),
  aciklama text not null default '' check (char_length(aciklama)<=600),
  tur text not null default 'olay' check (tur in ('olay','donem','savas','dogum','olum','donum')),
  olusturma timestamptz not null default now()
);
create index if not exists evren_zaman_noktalari_idx on public.evren_zaman_noktalari(sahibi,evren_id,olusturma desc);
alter table public.evren_zaman_noktalari enable row level security;
revoke all on public.evren_zaman_noktalari from anon, authenticated;
create or replace function public.evren_zaman_noktasi_ekle(p_evren_id text,p_zaman text,p_baslik text,p_aciklama text default '',p_tur text default 'olay') returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); yeni bigint;
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  if (select count(*) from public.evren_zaman_noktalari where sahibi=uid and evren_id=p_evren_id)>=500 then raise exception 'zaman çizelgesi dolu'; end if;
  insert into public.evren_zaman_noktalari(sahibi,evren_id,zaman,baslik,aciklama,tur) values(uid,left(btrim(p_evren_id),80),left(btrim(p_zaman),60),left(btrim(p_baslik),160),left(coalesce(p_aciklama,''),600),coalesce(p_tur,'olay')) returning id into yeni;
  return yeni;
end;
$$;
revoke all on function public.evren_zaman_noktasi_ekle(text,text,text,text,text) from public, anon;
grant execute on function public.evren_zaman_noktasi_ekle(text,text,text,text,text) to authenticated;
create or replace function public.evren_zaman_cizelgesi(p_evren_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'zaman',zaman,'baslik',baslik,'aciklama',aciklama,'tur',tur) order by olusturma desc), '[]'::jsonb) from public.evren_zaman_noktalari where evren_id=p_evren_id and (sahibi=auth.uid() or false);
$$;
revoke all on function public.evren_zaman_cizelgesi(text) from public, anon;
grant execute on function public.evren_zaman_cizelgesi(text) to authenticated;
notify pgrst, 'reload schema';


-- TentiforApp 6.3.4 — kişiselleştirilmiş keşif, popülerlik ve öne çıkan arsivciler
create or replace function public.kesif_akisi(p_tur text default 'hepsi',p_siralama text default 'yeni',p_limit int default 24) returns jsonb
language sql stable security definer set search_path = '' as $$
  with takip as (select takip_edilen from public.takipler where takip_eden=auth.uid()),
  evrenler as (
    select 'evren'::text tur,y.slug id,y.baslik,left(y.ozet,220) metin,
      p.kullanici_adi, y.yayin_tarihi zaman, '#/ev/fan/'||y.slug adres,
      coalesce((select sum(sayi) from public.evren_sayaclari z where z.evren=y.slug and z.gun>(now() at time zone 'utc')::date-30),0)::bigint popular,
      case when b.gonderen in (select takip_edilen from takip) then 1 else 0 end takip_boost
    from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru left join public.profiller p on p.id=b.gonderen left join public.istatistikler st on st.id=b.gonderen
    where (p_tur='hepsi' or p_tur='evren') and (p.id is null or (coalesce(p.profil_icerik_gorunur,true) and not coalesce(st.gizli or st.askida or st.engelli,false)))
  ), arsivciler as (
    select 'arsivci'::text tur,p.kullanici_adi id,coalesce(nullif(p.gorunen_ad,''),p.kullanici_adi) baslik,left(coalesce(p.hakkinda,''),220) metin,p.kullanici_adi, p.guncelleme zaman,'#/u/'||p.kullanici_adi adres,
      ((select count(*) from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru where b.gonderen=p.id)*10+(select count(*) from public.takipler t where t.takip_edilen=p.id))::bigint popular,
      case when p.id in (select takip_edilen from takip) then 1 else 0 end takip_boost
    from public.profiller p left join public.istatistikler st on st.id=p.id
    where (p_tur='hepsi' or p_tur='arsivci') and coalesce(p.profil_arama_gorunur,true) and not coalesce(st.gizli or st.askida or st.engelli,false)
  ), birlesik as (select * from evrenler union all select * from arsivciler), sirali as (
    select * from birlesik order by
      case when p_siralama='populer' then popular end desc nulls last,
      case when p_siralama='onerilen' then takip_boost end desc nulls last,
      case when p_siralama='onerilen' then popular end desc nulls last,
      case when p_siralama='yeni' then zaman end desc nulls last, zaman desc
    limit greatest(1,least(coalesce(p_limit,24),50))
  ) select coalesce(jsonb_agg(jsonb_build_object('tur',tur,'id',id,'baslik',baslik,'metin',metin,'kullanici_adi',kullanici_adi,'zaman',zaman,'adres',adres,'popular',popular) order by zaman desc),'[]'::jsonb) from sirali;
$$;
revoke all on function public.kesif_akisi(text,text,int) from public;
grant execute on function public.kesif_akisi(text,text,int) to anon, authenticated;
create or replace function public.kesif_one_cikanlar(p_limit int default 12) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('kullanici_adi',q.kullanici_adi,'gorunen_ad',q.gorunen_ad,'evren_sayisi',q.evren_sayisi,'takipci',q.takipci) order by q.evren_sayisi desc,q.takipci desc), '[]'::jsonb)
  from (select p.kullanici_adi,p.gorunen_ad,(select count(*) from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru where b.gonderen=p.id)::int evren_sayisi,(select count(*) from public.takipler t where t.takip_edilen=p.id)::int takipci from public.profiller p left join public.istatistikler s on s.id=p.id where coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false) order by evren_sayisi desc,takipci desc limit greatest(1,least(coalesce(p_limit,12),30))) q;
$$;
revoke all on function public.kesif_one_cikanlar(int) from public;
grant execute on function public.kesif_one_cikanlar(int) to anon, authenticated;
notify pgrst, 'reload schema';


-- TentiforApp 6.3.5 — arşivci analitiği ve veri dışa aktarma
create or replace function public.arsivci_istatistikleri(p_kullanici_adi text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); hedef uuid; kadi text;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if p_kullanici_adi is null then hedef:=uid; else select id into hedef from public.profiller where lower(kullanici_adi)=lower(btrim(p_kullanici_adi)); end if;
  if hedef is null or (hedef<>uid and not exists(select 1 from public.profiller where id=hedef and profil_arama_gorunur and profil_icerik_gorunur)) then return jsonb_build_object('durum','yok'); end if;
  select kullanici_adi into kadi from public.profiller where id=hedef;
  return jsonb_build_object('durum','tamam','kullanici_adi',kadi,'takipci',(select count(*) from public.takipler where takip_edilen=hedef),'takip',(select count(*) from public.takipler where takip_eden=hedef),'public_evren',(select count(*) from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru where b.gonderen=hedef),'ziyaret_30',(select coalesce(sum(sayi),0) from public.evren_sayaclari z join public.yayindaki_evrenler y on y.slug=z.evren join public.basvurular b on b.id=y.basvuru where b.gonderen=hedef and z.gun>(now() at time zone 'utc')::date-30),'raf',case when hedef=uid then (select count(*) from public.kisisel_raf where kullanici=uid) else 0 end,'taslak',(select count(*) from public.evren_taslaklari where sahibi=hedef));
end;
$$;
revoke all on function public.arsivci_istatistikleri(text) from public;
grant execute on function public.arsivci_istatistikleri(text) to authenticated;

create or replace function public.veri_disa_aktar() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  return jsonb_build_object('surum','6.3.7','olusturma',now(),'profil',(select jsonb_build_object('kullanici_adi',kullanici_adi,'gorunen_ad',gorunen_ad,'tentifor_adi',tentifor_adi,'hakkinda',hakkinda,'vitrin',vitrin,'profil_arama_gorunur',profil_arama_gorunur,'profil_icerik_gorunur',profil_icerik_gorunur) from public.profiller where id=uid),'raflar',coalesce((select jsonb_agg(to_jsonb(r) order by eklenme) from public.kisisel_raf r where kullanici=uid),'[]'::jsonb),'okuma_yollari',coalesce((select jsonb_agg(to_jsonb(y) order by y.guncelleme) from public.okuma_yollari y where sahibi=uid),'[]'::jsonb),'taslaklar',coalesce((select jsonb_agg(to_jsonb(t) order by t.olusturma) from public.evren_taslaklari t where sahibi=uid),'[]'::jsonb));
end;
$$;
revoke all on function public.veri_disa_aktar() from public, anon;
grant execute on function public.veri_disa_aktar() to authenticated;
notify pgrst, 'reload schema';


-- TentiforApp 6.3.6 — okuma serisi ve haftalık keşif görevleri
create table if not exists public.okuma_gunleri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  gun date not null,
  adres text not null default '',
  ilk_giris timestamptz not null default now(),
  primary key (kullanici, gun)
);
alter table public.okuma_gunleri enable row level security;
revoke all on public.okuma_gunleri from public, anon, authenticated;

create or replace function public.okuma_serisi_kaydet(p_adres text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); bugun date:=(now() at time zone 'utc')::date; onceki date; yeni boolean:=false; seri int:=0; toplam int:=0; etkilenen int:=0;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  p_adres:=left(regexp_replace(coalesce(p_adres,''),'[^a-zA-Z0-9_/:.?=-]','','g'),240);
  insert into public.okuma_gunleri(kullanici,gun,adres) values(uid,bugun,p_adres) on conflict (kullanici,gun) do nothing;
  get diagnostics etkilenen = row_count; yeni := etkilenen > 0;
  select count(*)::int into toplam from public.okuma_gunleri where kullanici=uid;
  select i.seri into seri from public.istatistikler as i where i.id=uid;
  if yeni then
    select exists(select 1 from public.okuma_gunleri where kullanici=uid and gun=bugun-1) into yeni;
    seri:=case when yeni then greatest(1,coalesce(seri,0)+1) else 1 end;
    insert into public.istatistikler(id,gun,seri,guncelleme) values(uid,1,seri,now()) on conflict(id) do update set gun=public.istatistikler.gun+1,seri=excluded.seri,guncelleme=now();
  end if;
  return jsonb_build_object('durum','tamam','seri',coalesce(seri,0),'gun',toplam);
end;
$$;
revoke all on function public.okuma_serisi_kaydet(text) from public, anon;
grant execute on function public.okuma_serisi_kaydet(text) to authenticated;

create or replace function public.kesif_gorevlerim() returns jsonb
language sql stable security definer set search_path = '' as $$
  with s as (select coalesce(seri,0) seri,coalesce(gun,0) gun from public.istatistikler where id=auth.uid()), hafta as (select date_trunc('week',now() at time zone 'utc')::date bas), r as (select count(*)::int n from public.kisisel_raf where kullanici=auth.uid() and eklenme >= (select bas from hafta)), y as (select count(*)::int n from public.okuma_yollari where sahibi=auth.uid() and olusturma >= (select bas from hafta))
  select jsonb_build_object('durum',case when auth.uid() is null then 'giris' else 'tamam' end,'gorevler',case when auth.uid() is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('id','seri','ad','Okuma serisi','aciklama','Arka arkaya üç farklı gün uğra.','ilerleme',least(3,s.seri),'hedef',3,'xp',15),jsonb_build_object('id','raf','ad','Arşivini büyüt','aciklama','Bu hafta iki öğeyi kişisel rafına ekle.','ilerleme',least(2,r.n),'hedef',2,'xp',10),jsonb_build_object('id','yol','ad','Bir rota çiz','aciklama','Bu hafta bir okuma yolu oluştur.','ilerleme',least(1,y.n),'hedef',1,'xp',20)) end) from s,r,y;
$$;
revoke all on function public.kesif_gorevlerim() from public, anon;
grant execute on function public.kesif_gorevlerim() to authenticated;
notify pgrst, 'reload schema';


-- TentiforApp 6.3.7 — moderasyon özeti, davranış sinyalleri ve geri alınabilir karantina
create table if not exists public.icerik_karantina (
  no bigserial primary key,
  bildirim_no bigint not null references public.icerik_bildirimleri(no) on delete cascade,
  tur text not null,
  hedef text not null,
  notu text not null default '' check (char_length(notu)<=500),
  durum text not null default 'aktif' check (durum in ('aktif','kaldirildi')),
  moderator uuid not null references auth.users(id),
  olusturma timestamptz not null default now(),
  kaldirma timestamptz,
  unique (bildirim_no)
);
alter table public.icerik_karantina enable row level security;
revoke all on public.icerik_karantina from public, anon, authenticated;

create or replace function public.icerik_bildirim_ozeti() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('icbildirim') then raise exception 'yetki yok'; end if;
  return jsonb_build_object('toplam',(select count(*) from public.icerik_bildirimleri),'yeni',(select count(*) from public.icerik_bildirimleri where durum='yeni'),'incelendi',(select count(*) from public.icerik_bildirimleri where durum='incelendi'),'kaldirildi',(select count(*) from public.icerik_bildirimleri where durum='kaldirildi'),'karantina',(select count(*) from public.icerik_karantina where durum='aktif'),'turler',coalesce((select jsonb_agg(jsonb_build_object('tur',tur,'adet',adet) order by adet desc) from (select tur,count(*)::int adet from public.icerik_bildirimleri group by tur) q),'[]'::jsonb),'raporlayanlar',coalesce((select jsonb_agg(jsonb_build_object('kullanici_adi',p.kullanici_adi,'adet',q.adet) order by q.adet desc) from (select bildiren,count(*)::int adet from public.icerik_bildirimleri where bildiren is not null group by bildiren order by adet desc limit 10) q join public.profiller p on p.id=q.bildiren),'[]'::jsonb));
end;
$$;
revoke all on function public.icerik_bildirim_ozeti() from public, anon, authenticated;
grant execute on function public.icerik_bildirim_ozeti() to authenticated;

create or replace function public.icerik_karantinaya_al(p_bildirim_no bigint,p_not text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.icerik_bildirimleri%rowtype; uid uuid:=auth.uid();
begin
  if not public.yonetici_yetki('icbildirim') then raise exception 'yetki yok'; end if;
  select * into r from public.icerik_bildirimleri where no=p_bildirim_no;
  if r.no is null then return jsonb_build_object('durum','yok'); end if;
  insert into public.icerik_karantina(bildirim_no,tur,hedef,notu,moderator) values(r.no,r.tur,r.hedef,left(coalesce(p_not,''),500),uid) on conflict(bildirim_no) do update set durum='aktif',notu=excluded.notu,moderator=excluded.moderator,kaldirma=null;
  update public.icerik_bildirimleri set durum='kaldirildi' where no=p_bildirim_no;
  return jsonb_build_object('durum','tamam');
end;
$$;
create or replace function public.icerik_karantina_kaldir(p_bildirim_no bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('icbildirim') then raise exception 'yetki yok'; end if;
  update public.icerik_karantina set durum='kaldirildi',kaldirma=now() where bildirim_no=p_bildirim_no and durum='aktif';
  return jsonb_build_object('durum',case when found then 'tamam' else 'yok' end);
end;
$$;
revoke all on function public.icerik_karantinaya_al(bigint,text),public.icerik_karantina_kaldir(bigint) from public, anon, authenticated;
grant execute on function public.icerik_karantinaya_al(bigint,text),public.icerik_karantina_kaldir(bigint) to authenticated;
notify pgrst, 'reload schema';
-- TentiforApp 6.3.8 — görsel evren haritası ve düzenlenebilir zaman çizelgesi
create table if not exists public.evren_gorsel_alanlari (
  evren_id text primary key check (char_length(btrim(evren_id)) between 1 and 80),
  sahibi uuid not null references auth.users(id) on delete cascade,
  herkese_acik boolean not null default false,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (evren_id, sahibi)
);

create table if not exists public.evren_harita_dugumleri (
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null,
  id uuid not null default gen_random_uuid(),
  tip text not null check (tip in ('karakter','mekan','olay','gezegen','kavram')),
  baslik text not null check (char_length(btrim(baslik)) between 1 and 120),
  aciklama text not null default '' check (char_length(aciklama) <= 600),
  x numeric(8,2) not null default 100 check (x between 0 and 1000),
  y numeric(8,2) not null default 100 check (y between 0 and 1000),
  yayinda boolean not null default false,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  primary key (sahibi, evren_id, id),
  foreign key (evren_id, sahibi) references public.evren_gorsel_alanlari(evren_id, sahibi) on delete cascade
);
create index if not exists evren_harita_dugumleri_sahip_idx on public.evren_harita_dugumleri (sahibi, evren_id, guncelleme desc);

create table if not exists public.evren_harita_baglari (
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null,
  id uuid not null default gen_random_uuid(),
  kaynak uuid not null,
  hedef uuid not null,
  tur text not null check (tur in ('akrabalik','dusmanlik','müttefiklik','mekan','zaman','ozel')),
  etiket text not null default '' check (char_length(etiket) <= 80),
  olusturma timestamptz not null default now(),
  primary key (sahibi, evren_id, id),
  check (kaynak <> hedef),
  check (tur <> 'ozel' or char_length(btrim(etiket)) between 1 and 80),
  foreign key (evren_id, sahibi) references public.evren_gorsel_alanlari(evren_id, sahibi) on delete cascade,
  foreign key (sahibi, evren_id, kaynak) references public.evren_harita_dugumleri(sahibi, evren_id, id) on delete cascade,
  foreign key (sahibi, evren_id, hedef) references public.evren_harita_dugumleri(sahibi, evren_id, id) on delete cascade
);
create index if not exists evren_harita_baglari_sahip_idx on public.evren_harita_baglari (sahibi, evren_id);

create table if not exists public.evren_zaman_olaylari (
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null,
  id uuid not null default gen_random_uuid(),
  zaman text not null check (char_length(btrim(zaman)) between 1 and 60),
  baslik text not null check (char_length(btrim(baslik)) between 1 and 160),
  aciklama text not null default '' check (char_length(aciklama) <= 600),
  tur text not null default 'olay' check (tur in ('olay','donem','savas','dogum','olum','donum')),
  sira integer not null default 0 check (sira between 0 and 100000),
  durum text not null default 'taslak' check (durum in ('taslak','yayinda')),
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  primary key (sahibi, evren_id, id),
  foreign key (evren_id, sahibi) references public.evren_gorsel_alanlari(evren_id, sahibi) on delete cascade
);
create index if not exists evren_zaman_olaylari_siralama_idx on public.evren_zaman_olaylari (sahibi, evren_id, sira, zaman);

create table if not exists public.evren_zaman_baglari (
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null,
  id uuid not null default gen_random_uuid(),
  kaynak uuid not null,
  hedef uuid not null,
  etiket text not null default '' check (char_length(etiket) <= 80),
  olusturma timestamptz not null default now(),
  primary key (sahibi, evren_id, id),
  check (kaynak <> hedef),
  foreign key (evren_id, sahibi) references public.evren_gorsel_alanlari(evren_id, sahibi) on delete cascade,
  foreign key (sahibi, evren_id, kaynak) references public.evren_zaman_olaylari(sahibi, evren_id, id) on delete cascade,
  foreign key (sahibi, evren_id, hedef) references public.evren_zaman_olaylari(sahibi, evren_id, id) on delete cascade
);
create index if not exists evren_zaman_baglari_sahip_idx on public.evren_zaman_baglari (sahibi, evren_id);

alter table public.evren_gorsel_alanlari enable row level security;
alter table public.evren_harita_dugumleri enable row level security;
alter table public.evren_harita_baglari enable row level security;
alter table public.evren_zaman_olaylari enable row level security;
alter table public.evren_zaman_baglari enable row level security;
revoke all on public.evren_gorsel_alanlari, public.evren_harita_dugumleri, public.evren_harita_baglari, public.evren_zaman_olaylari, public.evren_zaman_baglari from public, anon, authenticated;

-- İstemciden gelen sahip bilgisi kullanılmaz. Bilinen yayın/taslak/ortak evren sahipleri
-- mevcut kaynak tablolarıyla doğrulanır; yeni yerel evrenin ilk kaydı auth.uid() adına ayrılır.
create or replace function public.evren_gorsel_yetki_kontrol(p_evren_id text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  evren text := btrim(coalesce(p_evren_id, ''));
  asil uuid;
  kayit_sahibi uuid;
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  if char_length(evren) not between 1 and 80 then raise exception 'geçersiz evren'; end if;
  select kullanici into asil from public.evren_sahipleri where slug = evren;
  if found then
    if asil <> uid and not (exists (select 1 from public.ortak_evrenler o where o.id = evren and o.sahip = asil) and public.ortak_uye_mi(evren)) then raise exception 'evren için yetki yok'; end if;
  else
    select sahip into asil from public.ortak_evrenler where id = evren;
    if found then
      if uid <> asil and not public.ortak_uye_mi(evren) then raise exception 'evren için yetki yok'; end if;
    else
      select b.gonderen into asil
      from public.yayindaki_evrenler y left join public.basvurular b on b.id = y.basvuru
      where y.slug = evren;
      if found then
        if asil is null or asil <> uid then raise exception 'evren için yetki yok'; end if;
      elsif exists (select 1 from public.evren_taslaklari d where d.evren_id = evren and d.sahibi <> uid)
            and not exists (select 1 from public.evren_taslaklari d where d.evren_id = evren and d.sahibi = uid) then
        raise exception 'evren için yetki yok';
      elsif exists (select 1 from public.evren_taslaklari d where d.evren_id = evren and d.sahibi = uid) then
        asil := uid;
      else
        asil := null;
      end if;
    end if;
  end if;

  insert into public.evren_gorsel_alanlari(evren_id,sahibi) values(evren,coalesce(asil,uid)) on conflict(evren_id) do nothing;
  select sahibi into kayit_sahibi from public.evren_gorsel_alanlari where evren_id = evren for update;
  if found then
    if asil is not null and asil <> kayit_sahibi then raise exception 'evren için yetki yok'; end if;
    if kayit_sahibi = uid then return kayit_sahibi; end if;
    if exists (select 1 from public.ortak_evrenler o where o.id = evren and o.sahip = kayit_sahibi)
       and public.ortak_uye_mi(evren) then return kayit_sahibi; end if;
    raise exception 'evren için yetki yok';
  end if;
  return coalesce(asil, uid);
end;
$$;
revoke all on function public.evren_gorsel_yetki_kontrol(text) from public, anon, authenticated;

create or replace function public.evren_gorsel_haritayi_yukle(p_evren_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  evren text := btrim(coalesce(p_evren_id, ''));
  uid uuid := auth.uid();
  asil uuid;
  herkese boolean := false;
  duzenleyebilir boolean := false;
begin
  if char_length(evren) not between 1 and 80 then return jsonb_build_object('durum','gecersiz','dugumler','[]'::jsonb,'baglar','[]'::jsonb); end if;
  select sahibi, herkese_acik into asil, herkese from public.evren_gorsel_alanlari where evren_id = evren;
  if not found then return jsonb_build_object('durum','tamam','duzenleyebilir',uid is not null,'herkese_acik',false,'dugumler','[]'::jsonb,'baglar','[]'::jsonb); end if;
  duzenleyebilir := uid is not null and (uid = asil or (exists (select 1 from public.ortak_evrenler o where o.id = evren and o.sahip = asil) and public.ortak_uye_mi(evren)));
  if not duzenleyebilir and not herkese then return jsonb_build_object('durum','yok','dugumler','[]'::jsonb,'baglar','[]'::jsonb); end if;
  return jsonb_build_object(
    'durum','tamam',
    'duzenleyebilir',duzenleyebilir,
    'herkese_acik',case when duzenleyebilir then herkese else false end,
    'dugumler',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'tip',q.tip,'baslik',q.baslik,'aciklama',q.aciklama,'x',q.x,'y',q.y,'yayinda',q.yayinda) order by q.olusturma,q.id) from (select id,tip,baslik,aciklama,x,y,yayinda,olusturma from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren and (duzenleyebilir or (herkese and yayinda)) order by olusturma,id limit 150) q),'[]'::jsonb),
    'baglar',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'kaynak',q.kaynak,'hedef',q.hedef,'tur',q.tur,'etiket',q.etiket) order by q.olusturma,q.id) from (select b.id,b.kaynak,b.hedef,b.tur,b.etiket,b.olusturma from public.evren_harita_baglari b where b.sahibi=asil and b.evren_id=evren and (duzenleyebilir or (herkese and exists(select 1 from public.evren_harita_dugumleri a where a.sahibi=b.sahibi and a.evren_id=b.evren_id and a.id=b.kaynak and a.yayinda) and exists(select 1 from public.evren_harita_dugumleri z where z.sahibi=b.sahibi and z.evren_id=b.evren_id and z.id=b.hedef and z.yayinda))) order by b.olusturma,b.id limit 300) q),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.evren_gorsel_haritayi_yukle(text) from public;
grant execute on function public.evren_gorsel_haritayi_yukle(text) to anon, authenticated;

create or replace function public.evren_gorsel_haritayi_kaydet(p_evren_id text,p_dugumler jsonb,p_baglar jsonb,p_herkese_acik boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  evren text := btrim(coalesce(p_evren_id, ''));
  asil uuid;
  adet int;
  tek jsonb;
begin
  if jsonb_typeof(p_dugumler) is distinct from 'array' or jsonb_typeof(p_baglar) is distinct from 'array'
     or pg_column_size(p_dugumler)+pg_column_size(p_baglar)>262144 then return jsonb_build_object('durum','gecersiz'); end if;
  if jsonb_array_length(p_dugumler)>150 or jsonb_array_length(p_baglar)>300 then return jsonb_build_object('durum','gecersiz'); end if;
  if exists (select 1 from jsonb_array_elements(p_dugumler) d(v) where jsonb_typeof(v) is distinct from 'object' or coalesce(v->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(v->>'tip','') not in ('karakter','mekan','olay','gezegen','kavram') or char_length(btrim(coalesce(v->>'baslik',''))) not between 1 and 120 or char_length(coalesce(v->>'aciklama',''))>600 or coalesce(v->>'x','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' or coalesce(v->>'y','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' or (v ? 'yayinda' and jsonb_typeof(v->'yayinda') is distinct from 'boolean')) then return jsonb_build_object('durum','gecersiz'); end if;
  if exists (select 1 from jsonb_array_elements(p_dugumler) d(v) group by v->>'id' having count(*)>1) then return jsonb_build_object('durum','gecersiz'); end if;
  if exists (select 1 from jsonb_array_elements(p_dugumler) d(v) where (v->>'x')::numeric not between 0 and 1000 or (v->>'y')::numeric not between 0 and 1000) then return jsonb_build_object('durum','gecersiz'); end if;
  if exists (select 1 from jsonb_array_elements(p_baglar) b(v) where jsonb_typeof(v) is distinct from 'object' or coalesce(v->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(v->>'kaynak','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(v->>'hedef','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(v->>'kaynak','')=coalesce(v->>'hedef','') or coalesce(v->>'tur','') not in ('akrabalik','dusmanlik','müttefiklik','mekan','zaman','ozel') or char_length(coalesce(v->>'etiket',''))>80 or (v->>'tur'='ozel' and char_length(btrim(coalesce(v->>'etiket',''))) not between 1 and 80)) then return jsonb_build_object('durum','gecersiz'); end if;
  if exists (select 1 from jsonb_array_elements(p_baglar) b(v) group by v->>'id' having count(*)>1) or exists (select 1 from jsonb_array_elements(p_baglar) b(v) where not exists (select 1 from jsonb_array_elements(p_dugumler) d(n) where d.n->>'id'=b.v->>'kaynak') or not exists (select 1 from jsonb_array_elements(p_dugumler) d(n) where d.n->>'id'=b.v->>'hedef')) then return jsonb_build_object('durum','gecersiz'); end if;

  asil := public.evren_gorsel_yetki_kontrol(evren);
  insert into public.evren_gorsel_alanlari(evren_id,sahibi,herkese_acik) values(evren,asil,coalesce(p_herkese_acik,false))
  on conflict (evren_id) do update set herkese_acik=excluded.herkese_acik,guncelleme=now() where public.evren_gorsel_alanlari.sahibi=excluded.sahibi;
  if not exists (select 1 from public.evren_gorsel_alanlari where evren_id=evren and sahibi=asil) then raise exception 'evren için yetki yok'; end if;
  delete from public.evren_harita_baglari where sahibi=asil and evren_id=evren;
  delete from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren;
  insert into public.evren_harita_dugumleri(sahibi,evren_id,id,tip,baslik,aciklama,x,y,yayinda)
  select asil,evren,(v->>'id')::uuid,v->>'tip',btrim(v->>'baslik'),coalesce(v->>'aciklama',''),(v->>'x')::numeric,(v->>'y')::numeric,coalesce((v->>'yayinda')::boolean,false)
  from jsonb_array_elements(p_dugumler) d(v);
  insert into public.evren_harita_baglari(sahibi,evren_id,id,kaynak,hedef,tur,etiket)
  select asil,evren,(v->>'id')::uuid,(v->>'kaynak')::uuid,(v->>'hedef')::uuid,v->>'tur',coalesce(v->>'etiket','')
  from jsonb_array_elements(p_baglar) b(v);
  return jsonb_build_object('durum','tamam','dugum',jsonb_array_length(p_dugumler),'bag',jsonb_array_length(p_baglar));
end;
$$;
revoke all on function public.evren_gorsel_haritayi_kaydet(text,jsonb,jsonb,boolean) from public, anon;
grant execute on function public.evren_gorsel_haritayi_kaydet(text,jsonb,jsonb,boolean) to authenticated;

create or replace function public.evren_gorsel_dugumu_guncelle(p_evren_id text,p_dugum jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); asil uuid; v_id uuid; etkilenen int;
begin
  if jsonb_typeof(p_dugum) is distinct from 'object' or pg_column_size(p_dugum)>4096 or coalesce(p_dugum->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(p_dugum->>'tip','') not in ('karakter','mekan','olay','gezegen','kavram') or char_length(btrim(coalesce(p_dugum->>'baslik',''))) not between 1 and 120 or char_length(coalesce(p_dugum->>'aciklama',''))>600 or coalesce(p_dugum->>'x','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' or coalesce(p_dugum->>'y','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' or (p_dugum ? 'yayinda' and jsonb_typeof(p_dugum->'yayinda') is distinct from 'boolean') then return jsonb_build_object('durum','gecersiz'); end if;
  if (p_dugum->>'x')::numeric not between 0 and 1000 or (p_dugum->>'y')::numeric not between 0 and 1000 then return jsonb_build_object('durum','gecersiz'); end if;
  evren := btrim(evren); asil:=public.evren_gorsel_yetki_kontrol(evren); v_id:=(p_dugum->>'id')::uuid;
  if not exists(select 1 from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren and id=v_id) and (select count(*) from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren)>=150 then return jsonb_build_object('durum','sinir'); end if;
  insert into public.evren_gorsel_alanlari(evren_id,sahibi) values(evren,asil) on conflict(evren_id) do nothing;
  if not exists(select 1 from public.evren_gorsel_alanlari where evren_id=evren and sahibi=asil) then raise exception 'evren için yetki yok'; end if;
  insert into public.evren_harita_dugumleri(sahibi,evren_id,id,tip,baslik,aciklama,x,y,yayinda) values(asil,evren,v_id,p_dugum->>'tip',btrim(p_dugum->>'baslik'),coalesce(p_dugum->>'aciklama',''),(p_dugum->>'x')::numeric,(p_dugum->>'y')::numeric,coalesce((p_dugum->>'yayinda')::boolean,false)) on conflict(sahibi,evren_id,id) do update set tip=excluded.tip,baslik=excluded.baslik,aciklama=excluded.aciklama,x=excluded.x,y=excluded.y,yayinda=excluded.yayinda,guncelleme=now();
  return jsonb_build_object('durum','tamam','id',v_id);
end;
$$;
revoke all on function public.evren_gorsel_dugumu_guncelle(text,jsonb) from public, anon;
grant execute on function public.evren_gorsel_dugumu_guncelle(text,jsonb) to authenticated;

create or replace function public.evren_gorsel_bagi_degistir(p_evren_id text,p_bag jsonb,p_sil boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); asil uuid; v_id uuid;
begin
  if jsonb_typeof(p_bag) is distinct from 'object' or pg_column_size(p_bag)>2048 or coalesce(p_bag->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return jsonb_build_object('durum','gecersiz'); end if;
  asil:=public.evren_gorsel_yetki_kontrol(evren); v_id:=(p_bag->>'id')::uuid;
  if coalesce(p_sil,false) then delete from public.evren_harita_baglari where sahibi=asil and evren_id=evren and id=v_id; return jsonb_build_object('durum','tamam','silindi',found); end if;
  if coalesce(p_bag->>'kaynak','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(p_bag->>'hedef','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or p_bag->>'kaynak'=p_bag->>'hedef' or coalesce(p_bag->>'tur','') not in ('akrabalik','dusmanlik','müttefiklik','mekan','zaman','ozel') or char_length(coalesce(p_bag->>'etiket',''))>80 or (p_bag->>'tur'='ozel' and char_length(btrim(coalesce(p_bag->>'etiket',''))) not between 1 and 80) then return jsonb_build_object('durum','gecersiz'); end if;
  if not exists(select 1 from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren and id=(p_bag->>'kaynak')::uuid) or not exists(select 1 from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren and id=(p_bag->>'hedef')::uuid) then return jsonb_build_object('durum','gecersiz'); end if;
  if not exists(select 1 from public.evren_harita_baglari where sahibi=asil and evren_id=evren and id=v_id) and (select count(*) from public.evren_harita_baglari where sahibi=asil and evren_id=evren)>=300 then return jsonb_build_object('durum','sinir'); end if;
  insert into public.evren_gorsel_alanlari(evren_id,sahibi) values(evren,asil) on conflict(evren_id) do nothing;
  if not exists(select 1 from public.evren_gorsel_alanlari where evren_id=evren and sahibi=asil) then raise exception 'evren için yetki yok'; end if;
  insert into public.evren_harita_baglari(sahibi,evren_id,id,kaynak,hedef,tur,etiket) values(asil,evren,v_id,(p_bag->>'kaynak')::uuid,(p_bag->>'hedef')::uuid,p_bag->>'tur',coalesce(p_bag->>'etiket','')) on conflict(sahibi,evren_id,id) do update set kaynak=excluded.kaynak,hedef=excluded.hedef,tur=excluded.tur,etiket=excluded.etiket;
  return jsonb_build_object('durum','tamam','id',v_id);
end;
$$;
revoke all on function public.evren_gorsel_bagi_degistir(text,jsonb,boolean) from public, anon;
grant execute on function public.evren_gorsel_bagi_degistir(text,jsonb,boolean) to authenticated;

create or replace function public.evren_zaman_cizelgesi_yukle(p_evren_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); uid uuid:=auth.uid(); asil uuid; herkese boolean:=false; duzenleyebilir boolean:=false;
begin
  if char_length(evren) not between 1 and 80 then return jsonb_build_object('durum','gecersiz','olaylar','[]'::jsonb,'baglar','[]'::jsonb); end if;
  select sahibi,herkese_acik into asil,herkese from public.evren_gorsel_alanlari where evren_id=evren;
  if not found then return jsonb_build_object('durum','tamam','duzenleyebilir',uid is not null,'olaylar','[]'::jsonb,'baglar','[]'::jsonb); end if;
  duzenleyebilir:=uid is not null and (uid=asil or (exists(select 1 from public.ortak_evrenler o where o.id=evren and o.sahip=asil) and public.ortak_uye_mi(evren)));
  if not duzenleyebilir and not herkese then return jsonb_build_object('durum','yok','olaylar','[]'::jsonb,'baglar','[]'::jsonb); end if;
  return jsonb_build_object('durum','tamam','duzenleyebilir',duzenleyebilir,
    'olaylar',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'zaman',q.zaman,'baslik',q.baslik,'aciklama',q.aciklama,'tur',q.tur,'sira',q.sira,'durum',q.durum) order by q.sira,q.zaman,q.olusturma) from (select id,zaman,baslik,aciklama,tur,sira,durum,olusturma from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren and (duzenleyebilir or durum='yayinda') order by sira,zaman,olusturma limit 500) q),'[]'::jsonb),
    'baglar',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'kaynak',q.kaynak,'hedef',q.hedef,'etiket',q.etiket) order by q.olusturma,q.id) from (select b.id,b.kaynak,b.hedef,b.etiket,b.olusturma from public.evren_zaman_baglari b where b.sahibi=asil and b.evren_id=evren and (duzenleyebilir or (exists(select 1 from public.evren_zaman_olaylari a where a.sahibi=b.sahibi and a.evren_id=b.evren_id and a.id=b.kaynak and a.durum='yayinda') and exists(select 1 from public.evren_zaman_olaylari z where z.sahibi=b.sahibi and z.evren_id=b.evren_id and z.id=b.hedef and z.durum='yayinda'))) order by b.olusturma,b.id limit 500) q),'[]'::jsonb));
end;
$$;
revoke all on function public.evren_zaman_cizelgesi_yukle(text) from public;
grant execute on function public.evren_zaman_cizelgesi_yukle(text) to anon, authenticated;

create or replace function public.evren_zaman_olay_kaydet(p_evren_id text,p_olay jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); asil uuid; v_id uuid; yeni boolean;
begin
  if jsonb_typeof(p_olay) is distinct from 'object' or pg_column_size(p_olay)>4096 or char_length(btrim(coalesce(p_olay->>'zaman',''))) not between 1 and 60 or char_length(btrim(coalesce(p_olay->>'baslik',''))) not between 1 and 160 or char_length(coalesce(p_olay->>'aciklama',''))>600 or coalesce(p_olay->>'tur','olay') not in ('olay','donem','savas','dogum','olum','donum') or coalesce(p_olay->>'durum','taslak') not in ('taslak','yayinda') or coalesce(p_olay->>'sira','0') !~ '^[0-9]{1,6}$' or (p_olay ? 'id' and coalesce(p_olay->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then return jsonb_build_object('durum','gecersiz'); end if;
  if (coalesce(p_olay->>'sira','0'))::integer>100000 then return jsonb_build_object('durum','gecersiz'); end if;
  asil:=public.evren_gorsel_yetki_kontrol(evren); v_id:=case when p_olay ? 'id' then (p_olay->>'id')::uuid else gen_random_uuid() end;
  yeni:=not exists(select 1 from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren and id=v_id);
  if yeni and (select count(*) from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren)>=500 then return jsonb_build_object('durum','sinir'); end if;
  insert into public.evren_gorsel_alanlari(evren_id,sahibi) values(evren,asil) on conflict(evren_id) do nothing;
  if not exists(select 1 from public.evren_gorsel_alanlari where evren_id=evren and sahibi=asil) then raise exception 'evren için yetki yok'; end if;
  insert into public.evren_zaman_olaylari(sahibi,evren_id,id,zaman,baslik,aciklama,tur,sira,durum) values(asil,evren,v_id,btrim(p_olay->>'zaman'),btrim(p_olay->>'baslik'),coalesce(p_olay->>'aciklama',''),coalesce(p_olay->>'tur','olay'),coalesce((p_olay->>'sira')::integer,0),coalesce(p_olay->>'durum','taslak')) on conflict(sahibi,evren_id,id) do update set zaman=excluded.zaman,baslik=excluded.baslik,aciklama=excluded.aciklama,tur=excluded.tur,sira=excluded.sira,durum=excluded.durum,guncelleme=now();
  return jsonb_build_object('durum','tamam','id',v_id);
end;
$$;
revoke all on function public.evren_zaman_olay_kaydet(text,jsonb) from public, anon;
grant execute on function public.evren_zaman_olay_kaydet(text,jsonb) to authenticated;

create or replace function public.evren_zaman_olay_sil(p_evren_id text,p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); asil uuid;
begin
  if p_id is null then return jsonb_build_object('durum','gecersiz'); end if;
  asil:=public.evren_gorsel_yetki_kontrol(evren);
  delete from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren and id=p_id;
  return jsonb_build_object('durum','tamam','silindi',found);
end;
$$;
revoke all on function public.evren_zaman_olay_sil(text,uuid) from public, anon;
grant execute on function public.evren_zaman_olay_sil(text,uuid) to authenticated;

create or replace function public.evren_zaman_bagi_degistir(p_evren_id text,p_bag jsonb,p_sil boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); asil uuid; v_id uuid;
begin
  if jsonb_typeof(p_bag) is distinct from 'object' or pg_column_size(p_bag)>2048 or coalesce(p_bag->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return jsonb_build_object('durum','gecersiz'); end if;
  asil:=public.evren_gorsel_yetki_kontrol(evren); v_id:=(p_bag->>'id')::uuid;
  if coalesce(p_sil,false) then delete from public.evren_zaman_baglari where sahibi=asil and evren_id=evren and id=v_id; return jsonb_build_object('durum','tamam','silindi',found); end if;
  if coalesce(p_bag->>'kaynak','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(p_bag->>'hedef','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or p_bag->>'kaynak'=p_bag->>'hedef' or char_length(coalesce(p_bag->>'etiket',''))>80 then return jsonb_build_object('durum','gecersiz'); end if;
  if not exists(select 1 from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren and id=(p_bag->>'kaynak')::uuid) or not exists(select 1 from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren and id=(p_bag->>'hedef')::uuid) then return jsonb_build_object('durum','gecersiz'); end if;
  if not exists(select 1 from public.evren_zaman_baglari where sahibi=asil and evren_id=evren and id=v_id) and (select count(*) from public.evren_zaman_baglari where sahibi=asil and evren_id=evren)>=500 then return jsonb_build_object('durum','sinir'); end if;
  insert into public.evren_gorsel_alanlari(evren_id,sahibi) values(evren,asil) on conflict(evren_id) do nothing;
  if not exists(select 1 from public.evren_gorsel_alanlari where evren_id=evren and sahibi=asil) then raise exception 'evren için yetki yok'; end if;
  insert into public.evren_zaman_baglari(sahibi,evren_id,id,kaynak,hedef,etiket) values(asil,evren,v_id,(p_bag->>'kaynak')::uuid,(p_bag->>'hedef')::uuid,coalesce(p_bag->>'etiket','')) on conflict(sahibi,evren_id,id) do update set kaynak=excluded.kaynak,hedef=excluded.hedef,etiket=excluded.etiket;
  return jsonb_build_object('durum','tamam','id',v_id);
end;
$$;
revoke all on function public.evren_zaman_bagi_degistir(text,jsonb,boolean) from public, anon;
grant execute on function public.evren_zaman_bagi_degistir(text,jsonb,boolean) to authenticated;

notify pgrst, 'reload schema';

-- TentiforApp 6.3.9 — public SEO metadata and share-card source data
-- Only already-public profiles, published universes and explicitly public reading paths.

create or replace function public.public_seo_sayfa(p_tur text, p_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare sonuc jsonb;
begin
  if p_tur = 'profil' then
    if p_id is null or p_id !~* '^[a-z0-9_]{3,20}$' then return null; end if;
    select jsonb_build_object(
      'tur','profil',
      'kullanici_adi',p.kullanici_adi,
      'gorunen_ad',coalesce(nullif(p.gorunen_ad,''),p.kullanici_adi),
      'hakkinda',case when coalesce(p.profil_icerik_gorunur,true) then left(coalesce(p.hakkinda,''),280) else '' end,
      'icerik_gorunur',coalesce(p.profil_icerik_gorunur,true),
      'evrenler',case when coalesce(p.profil_icerik_gorunur,true) then coalesce((
        select jsonb_agg(jsonb_build_object('slug',q.slug,'baslik',q.baslik,'ozet',q.ozet) order by q.yayin_tarihi desc)
        from (select y.slug,y.baslik,left(y.ozet,600) ozet,y.yayin_tarihi
          from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru
          where b.gonderen=p.id order by y.yayin_tarihi desc limit 30) q
      ),'[]'::jsonb) else '[]'::jsonb end
    ) into sonuc
    from public.profiller p
    left join public.istatistikler s on s.id=p.id
    where lower(p.kullanici_adi)=lower(btrim(p_id))
      and coalesce(p.profil_arama_gorunur,true)
      and not coalesce(s.gizli or s.askida or s.engelli,false);
    return sonuc;
  elsif p_tur = 'evren' then
    if p_id is null or char_length(p_id)<3 or char_length(p_id)>60 or p_id !~ '^[[:alnum:]][[:alnum:]-]{2,59}$' then return null; end if;
    select jsonb_build_object(
      'tur','evren','slug',y.slug,'baslik',left(y.baslik,120),'ozet',left(y.ozet,600),
      'yayin_tarihi',y.yayin_tarihi,
      'yazar',case when coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true)
        and not coalesce(s.gizli or s.askida or s.engelli,false) then p.kullanici_adi else null end,
      'yazar_adi',case when coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true)
        and not coalesce(s.gizli or s.askida or s.engelli,false) then coalesce(nullif(p.gorunen_ad,''),p.kullanici_adi) else null end
    ) into sonuc
    from public.yayindaki_evrenler y
    left join public.basvurular b on b.id=y.basvuru
    left join public.profiller p on p.id=b.gonderen
    left join public.istatistikler s on s.id=p.id
    where y.slug=lower(btrim(p_id))
      and (p.id is null or (coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)));
    return sonuc;
  elsif p_tur = 'okuma' then
    if p_id is null or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
    select jsonb_build_object(
      'tur','okuma','id',y.id,'baslik',left(y.baslik,120),'aciklama',left(y.aciklama,600),
      'yazar',p.kullanici_adi,'yazar_adi',coalesce(nullif(p.gorunen_ad,''),p.kullanici_adi),
      'adimlar',coalesce((select jsonb_agg(jsonb_build_object('sira',a.sira,'baslik',left(a.baslik,160),'tur',a.tur) order by a.sira)
        from (select sira,baslik,tur from public.okuma_yolu_adimlari where yol=y.id order by sira limit 100) a),'[]'::jsonb)
    ) into sonuc
    from public.okuma_yollari y
    join public.profiller p on p.id=y.sahibi
    left join public.istatistikler s on s.id=p.id
    where y.id=p_id::uuid and y.public_mu
      and coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true)
      and not coalesce(s.gizli or s.askida or s.engelli,false);
    return sonuc;
  end if;
  return null;
end;
$$;
revoke all on function public.public_seo_sayfa(text,text) from public;
grant execute on function public.public_seo_sayfa(text,text) to anon, authenticated;

-- A crawler sitemap can enumerate only resources that meet the same public visibility rules.
-- Pagination is capped to 100 items per request to keep response and query cost bounded.
create or replace function public.public_seo_sayfalar(p_tur text, p_limit int default 100, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare n int:=greatest(1,least(coalesce(p_limit,100),100)); o int:=greatest(0,least(coalesce(p_offset,0),1000000)); sonuc jsonb;
begin
  if p_tur='profil' then
    select coalesce(jsonb_agg(public.public_seo_sayfa('profil',q.kullanici_adi) order by q.kullanici_adi),'[]'::jsonb) into sonuc
    from (select p.kullanici_adi from public.profiller p left join public.istatistikler s on s.id=p.id
      where p.kullanici_adi is not null and coalesce(p.profil_arama_gorunur,true)
        and not coalesce(s.gizli or s.askida or s.engelli,false)
      order by lower(p.kullanici_adi),p.kullanici_adi limit n offset o) q;
    return sonuc;
  elsif p_tur='evren' then
    select coalesce(jsonb_agg(public.public_seo_sayfa('evren',q.slug) order by q.slug),'[]'::jsonb) into sonuc
    from (select y.slug from public.yayindaki_evrenler y left join public.basvurular b on b.id=y.basvuru
      left join public.profiller p on p.id=b.gonderen left join public.istatistikler s on s.id=p.id
      where p.id is null or (coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false))
      order by y.slug limit n offset o) q;
    return sonuc;
  elsif p_tur='okuma' then
    select coalesce(jsonb_agg(public.public_seo_sayfa('okuma',q.id::text) order by q.id),'[]'::jsonb) into sonuc
    from (select y.id from public.okuma_yollari y join public.profiller p on p.id=y.sahibi
      left join public.istatistikler s on s.id=p.id
      where y.public_mu and coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true)
        and not coalesce(s.gizli or s.askida or s.engelli,false)
      order by y.id limit n offset o) q;
    return sonuc;
  end if;
  return '[]'::jsonb;
end;
$$;
revoke all on function public.public_seo_sayfalar(text,int,int) from public;
grant execute on function public.public_seo_sayfalar(text,int,int) to anon, authenticated;

notify pgrst, 'reload schema';

-- TentiforApp 6.3.10 — public-only share links and privacy-preserving aggregate events.
-- Tokens are random UUIDv4 values (122 bits of entropy); no visitor IP, user-agent,
-- referrer, account id, or per-visit timestamp is stored in analytics.

create table if not exists public.paylasim_baglantilari (
  id uuid primary key default gen_random_uuid(),
  sahibi uuid not null references auth.users(id) on delete cascade,
  tur text not null check (tur in ('profil','evren','okuma')),
  icerik_id text not null check (char_length(icerik_id) between 3 and 120),
  olusturma timestamptz not null default now(),
  bitis timestamptz not null,
  iptal timestamptz,
  constraint paylasim_bitis_sonra check (bitis > olusturma),
  constraint paylasim_iptal_sonra check (iptal is null or iptal >= olusturma)
);
create index if not exists paylasim_baglantilari_sahip_tarih_idx
  on public.paylasim_baglantilari(sahibi,olusturma desc);
create index if not exists paylasim_baglantilari_bitis_idx
  on public.paylasim_baglantilari(bitis) where iptal is null;
alter table public.paylasim_baglantilari enable row level security;
revoke all on public.paylasim_baglantilari from public, anon, authenticated;

create table if not exists public.paylasim_olay_ozetleri (
  paylasim uuid not null references public.paylasim_baglantilari(id) on delete cascade,
  gun date not null,
  olay text not null check (olay in ('olusturuldu','kopyalandi','native','acildi')),
  adet integer not null default 0 check (adet between 0 and 10000),
  primary key(paylasim,gun,olay)
);
create index if not exists paylasim_olay_ozetleri_gun_idx
  on public.paylasim_olay_ozetleri(paylasim,gun desc);
alter table public.paylasim_olay_ozetleri enable row level security;
revoke all on public.paylasim_olay_ozetleri from public, anon, authenticated;

-- Internal visibility gate. Never returns a route for drafts, private profiles,
-- unpublished worlds, hidden/suspended accounts, or non-public reading paths.
create or replace function public.paylasim_hedef_yolu(p_tur text,p_id text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare sonuc text;
begin
  if p_tur='profil' then
    if p_id is null or p_id !~* '^[a-z0-9_]{3,20}$' then return null; end if;
    select '/u/'||p.kullanici_adi||'/' into sonuc
    from public.profiller p left join public.istatistikler s on s.id=p.id
    where lower(p.kullanici_adi)=lower(btrim(p_id))
      and coalesce(p.profil_arama_gorunur,true)
      and not coalesce(s.gizli or s.askida or s.engelli,false);
  elsif p_tur='evren' then
    if p_id is null or p_id !~ '^[[:alnum:]][[:alnum:]-]{2,59}$' then return null; end if;
    select '/evren/'||y.slug||'/' into sonuc
    from public.yayindaki_evrenler y
    left join public.basvurular b on b.id=y.basvuru
    left join public.profiller p on p.id=b.gonderen
    left join public.istatistikler s on s.id=p.id
    where y.slug=lower(btrim(p_id))
      and (p.id is null or (coalesce(p.profil_icerik_gorunur,true)
        and not coalesce(s.gizli or s.askida or s.engelli,false)));
  elsif p_tur='okuma' then
    if p_id is null or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
    select '/okuma-yolu/'||y.id::text||'/' into sonuc
    from public.okuma_yollari y
    join public.profiller p on p.id=y.sahibi
    left join public.istatistikler s on s.id=p.id
    where y.id=p_id::uuid and y.public_mu
      and coalesce(p.profil_arama_gorunur,true)
      and coalesce(p.profil_icerik_gorunur,true)
      and not coalesce(s.gizli or s.askida or s.engelli,false);
  end if;
  return sonuc;
end;
$$;
revoke all on function public.paylasim_hedef_yolu(text,text) from public, anon, authenticated;

-- Internal, atomic daily counter. Only fixed event names are accepted and
-- callers serialize on their share-link row before incrementing.
create or replace function public.paylasim_olay_arttir(p_link uuid,p_olay text,p_sinir integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_olay not in ('olusturuldu','kopyalandi','native','acildi') or p_sinir is null or p_sinir < 1 then return false; end if;
  insert into public.paylasim_olay_ozetleri(paylasim,gun,olay,adet)
    values(p_link,current_date,p_olay,1)
    on conflict(paylasim,gun,olay) do update
      set adet=paylasim_olay_ozetleri.adet+1
      where paylasim_olay_ozetleri.adet < p_sinir;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.paylasim_olay_arttir(uuid,text,integer) from public, anon, authenticated;

create or replace function public.paylasim_baglanti_olustur(p_tur text,p_id text,p_sure_gun integer default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); hedef text; yeni uuid; son timestamptz;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if p_sure_gun is null or p_sure_gun not in (1,7,30) then return jsonb_build_object('durum','sure'); end if;
  hedef:=public.paylasim_hedef_yolu(p_tur,p_id);
  if hedef is null then return jsonb_build_object('durum','public_degil'); end if;
  if p_tur='profil' then
    if not exists(select 1 from public.profiller p where p.id=uid and lower(p.kullanici_adi)=lower(btrim(p_id))) then return jsonb_build_object('durum','yetki'); end if;
  elsif p_tur='evren' then
    if not exists(select 1 from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru where y.slug=lower(btrim(p_id)) and b.gonderen=uid) then return jsonb_build_object('durum','yetki'); end if;
  elsif p_tur='okuma' then
    if p_id is null or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists(select 1 from public.okuma_yollari y where y.id=p_id::uuid and y.sahibi=uid and y.public_mu) then return jsonb_build_object('durum','yetki'); end if;
  else
    return jsonb_build_object('durum','tur');
  end if;
  -- Serialize per account before enforcing creation limits.
  perform 1 from auth.users where id=uid for update;
  delete from public.paylasim_baglantilari l where l.sahibi=uid
    and (l.bitis<now()-interval '90 days' or l.iptal<now()-interval '90 days');
  if (select count(*) from public.paylasim_baglantilari l where l.sahibi=uid and l.iptal is null and l.bitis>now())>=100
    or (select count(*) from public.paylasim_baglantilari l where l.sahibi=uid and l.olusturma>now()-interval '1 hour')>=20 then
    return jsonb_build_object('durum','limit');
  end if;
  son:=now()+make_interval(days=>p_sure_gun);
  insert into public.paylasim_baglantilari(sahibi,tur,icerik_id,bitis)
    values(uid,p_tur,case when p_tur='profil' then lower(btrim(p_id)) else btrim(p_id) end,son)
    returning id into yeni;
  perform public.paylasim_olay_arttir(yeni,'olusturuldu',10000);
  return jsonb_build_object('durum','tamam','id',yeni,'bitis',son,'yol',hedef);
end;
$$;
revoke all on function public.paylasim_baglanti_olustur(text,text,integer) from public, anon;
grant execute on function public.paylasim_baglanti_olustur(text,text,integer) to authenticated;

-- Public bearer-link resolution rechecks visibility every time. At most 2,000
-- opens per token/day are counted; content still resolves after the cap.
create or replace function public.paylasim_baglanti_ac(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_tur text; v_icerik_id text; v_bitis timestamptz; v_iptal timestamptz; hedef text; adet integer;
begin
  if p_token is null then return null; end if;
  select id,tur,icerik_id,bitis,iptal into v_id,v_tur,v_icerik_id,v_bitis,v_iptal
    from public.paylasim_baglantilari where id=p_token for update;
  if not found or v_iptal is not null or v_bitis<=now() then return null; end if;
  hedef:=public.paylasim_hedef_yolu(v_tur,v_icerik_id);
  if hedef is null then return null; end if;
  select o.adet into adet from public.paylasim_olay_ozetleri o
    where o.paylasim=v_id and o.gun=current_date and o.olay='acildi';
  if coalesce(adet,0)<2000 then perform public.paylasim_olay_arttir(v_id,'acildi',2000); end if;
  return jsonb_build_object('durum','tamam','tur',v_tur,'id',v_icerik_id,'yol',hedef);
end;
$$;
revoke all on function public.paylasim_baglanti_ac(uuid) from public, anon, authenticated;
grant execute on function public.paylasim_baglanti_ac(uuid) to anon, authenticated;

create or replace function public.paylasim_olay_kaydet(p_link uuid,p_olay text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); v_sahibi uuid; v_bitis timestamptz; v_iptal timestamptz;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if p_olay not in ('kopyalandi','native') then return jsonb_build_object('durum','olay'); end if;
  select sahibi,bitis,iptal into v_sahibi,v_bitis,v_iptal
    from public.paylasim_baglantilari where id=p_link for update;
  if not found or v_sahibi<>uid then return jsonb_build_object('durum','yetki'); end if;
  if v_iptal is not null or v_bitis<=now() then return jsonb_build_object('durum','kapali'); end if;
  if not public.paylasim_olay_arttir(p_link,p_olay,100) then return jsonb_build_object('durum','limit'); end if;
  return jsonb_build_object('durum','tamam');
end;
$$;
revoke all on function public.paylasim_olay_kaydet(uuid,text) from public, anon;
grant execute on function public.paylasim_olay_kaydet(uuid,text) to authenticated;

create or replace function public.paylasim_gecmisim() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); sonuc jsonb;
begin
  if uid is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'tur',q.tur,'icerik_id',q.icerik_id,'yol',public.paylasim_hedef_yolu(q.tur,q.icerik_id),
    'olusturma',q.olusturma,'bitis',q.bitis,'iptal',q.iptal,
    'acildi',coalesce((select sum(o.adet) from public.paylasim_olay_ozetleri o where o.paylasim=q.id and o.olay='acildi'),0),
    'kopyalandi',coalesce((select sum(o.adet) from public.paylasim_olay_ozetleri o where o.paylasim=q.id and o.olay='kopyalandi'),0),
    'native',coalesce((select sum(o.adet) from public.paylasim_olay_ozetleri o where o.paylasim=q.id and o.olay='native'),0)
  ) order by q.olusturma desc),'[]'::jsonb) into sonuc
  from (select l.id,l.tur,l.icerik_id,l.olusturma,l.bitis,l.iptal from public.paylasim_baglantilari l
    where l.sahibi=uid order by l.olusturma desc limit 100) q;
  return sonuc;
end;
$$;
revoke all on function public.paylasim_gecmisim() from public, anon;
grant execute on function public.paylasim_gecmisim() to authenticated;

create or replace function public.paylasim_baglanti_iptal(p_link uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  update public.paylasim_baglantilari set iptal=coalesce(iptal,now()) where id=p_link and sahibi=uid;
  if not found then return jsonb_build_object('durum','yok'); end if;
  return jsonb_build_object('durum','tamam');
end;
$$;
revoke all on function public.paylasim_baglanti_iptal(uuid) from public, anon;
grant execute on function public.paylasim_baglanti_iptal(uuid) to authenticated;
notify pgrst, 'reload schema';


-- 6.3.14 E26 özel kanon yöneticisi: site geneli admin değildir.
create table if not exists public.kanon_evren_yetkileri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  evren text not null,
  yetkiler text[] not null default array['duzenle','yayinla']::text[],
  olusturma timestamptz not null default now(),
  primary key (kullanici, evren),
  constraint kanon_evren_yetkileri_evren_check check (evren = lower(evren) and evren ~ '^[a-z0-9_-]{1,40}$'),
  constraint kanon_evren_yetkileri_yetki_check check (yetkiler <@ array['duzenle','yayinla','harita','okuma']::text[])
);
alter table public.kanon_evren_yetkileri enable row level security;
revoke all on public.kanon_evren_yetkileri from anon, authenticated;
drop function if exists public.kanon_evren_yetkili(text, text);
create or replace function public.kanon_evren_yetkili(p_evren text, p_yetki text default 'duzenle')
returns boolean language sql stable security definer set search_path = '' as $$
  select public.tam_yonetici_mi() or exists (
    select 1 from public.kanon_evren_yetkileri k
    where k.kullanici = auth.uid()
      and k.evren = lower(btrim(coalesce(p_evren, '')))
      and coalesce(p_yetki, 'duzenle') = any(k.yetkiler)
  );
$$;
revoke all on function public.kanon_evren_yetkili(text, text) from public, anon;
grant execute on function public.kanon_evren_yetkili(text, text) to authenticated;
insert into public.kanon_evren_yetkileri (kullanici, evren, yetkiler)
select p.id, 'e26', array['duzenle','yayinla','harita','okuma']::text[]
from public.profiller p where p.kullanici_adi in ('selimblackstone', 'selimoo2')
on conflict (kullanici, evren) do update set yetkiler = excluded.yetkiler;
create or replace function public.kanon_evren_yetkilerim()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(k.evren, to_jsonb(k.yetkiler)), '{}'::jsonb)
  from public.kanon_evren_yetkileri k where k.kullanici = auth.uid();
$$;
revoke all on function public.kanon_evren_yetkilerim() from public, anon;
grant execute on function public.kanon_evren_yetkilerim() to authenticated;
