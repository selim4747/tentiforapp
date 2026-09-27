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
create policy "yönetici şüpheleri okur" on public.liderlik_suphe for select using (public.yonetici_mi());

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
create policy "yönetici bildirimleri okur" on public.bildirimler for select using (public.yonetici_mi());

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
  n_tamlik int; n_kutu int;
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

  -- 1) mutlak sınırlar: aşan değer imkânsızdır → sınıra çekilir ve kayıt askıya alınır
  if n_kutu > 600 then sebepler := array_append(sebepler, 'okunan kutu > 600'); n_kutu := 600; end if;
  site_gun := (current_date - a.baslangic) + 1;
  if n_okunan > a.karakter then sebepler := array_append(sebepler, 'okunan karakter > karakter sayısı'); n_okunan := a.karakter; end if;
  if n_katman > a.katman then sebepler := array_append(sebepler, 'katman > katman sayısı'); n_katman := a.katman; end if;
  if n_oyun > a.oyun then sebepler := array_append(sebepler, 'oyun > oyun sayısı'); n_oyun := a.oyun; end if;
  if n_galeri > a.galeri then sebepler := array_append(sebepler, 'galeri > kart sayısı'); n_galeri := a.galeri; end if;
  if n_madalya > a.madalya then sebepler := array_append(sebepler, 'madalya > madalya sayısı'); n_madalya := a.madalya; end if;
  if n_gun > site_gun then sebepler := array_append(sebepler, 'gün > sitenin yaşı'); n_gun := site_gun; end if;
  if n_seri > n_gun then sebepler := array_append(sebepler, 'seri > gün'); n_seri := n_gun; end if;
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
    nobet, cevirmen, vardiya, yazi, boyut, baloncuk, tamlik, okunan_kutu, rol, kisilik,
    hafta, hafta_taban, sezon, sezon_taban, askida, askida_neden, son_gonderim, guncelleme)
  values (
    uid, n_okunan, n_katman, n_oyun, n_galeri, n_gun, n_seri, n_madalya, n_ecka,
    n_nobet, n_cevirmen, n_vardiya, n_yazi, n_boyut, n_baloncuk, n_tamlik, n_kutu,
    left(g->>'rol', 40), left(g->>'kisilik', 40),
    -- ilk gönderimde haftalık/aylık puan sıfırdan başlar (eski ilerleme bu haftaya yazılmaz)
    bu_hafta, n_ecka, bu_sezon, n_ecka,
    cardinality(sebepler) > 0, nullif(array_to_string(sebepler, '; '), ''), now(), now())
  on conflict (id) do update set
    okunan_karakter = excluded.okunan_karakter, katman = excluded.katman, oyun = excluded.oyun,
    galeri = excluded.galeri, gun = excluded.gun, seri = excluded.seri, madalya = excluded.madalya,
    ecka_toplam = excluded.ecka_toplam, nobet = excluded.nobet, cevirmen = excluded.cevirmen,
    vardiya = excluded.vardiya, yazi = excluded.yazi, boyut = excluded.boyut, baloncuk = excluded.baloncuk,
    tamlik = excluded.tamlik, okunan_kutu = excluded.okunan_kutu, rol = excluded.rol, kisilik = excluded.kisilik,
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
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
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
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
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
      sonuclar := sonuclar || jsonb_build_object('dogru', ok, 'cevap', b.cevap, 'kismi', kismi);
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
create policy "yönetici hataları okur" on public.hata_kayitlari for select using (public.yonetici_mi());

create or replace function public.hata_kaydet(p_mesaj text, p_kaynak text default null, p_adres text default null,
                                              p_tarayici text default null, p_surum text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  bugun date := (now() at time zone 'utc')::date;
  o text := md5(left(coalesce(p_mesaj, ''), 300) || '|' || left(coalesce(p_kaynak, ''), 200));
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
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
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
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
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
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
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
    select p.id, p.kullanici_adi, p.gorunen_ad, s.tamlik, s.gun, s.madalya, s.katman, s.okunan_kutu
    from public.profiller p left join public.istatistikler s on s.id = p.id
    where p.kullanici_adi is not null and not coalesce(s.engelli or s.askida, false)),
  x as (
    select p.*,
      coalesce(p.tamlik, 0) * 20 as x_tamlik,
      coalesce(p.gun, 0) * 5 as x_gun,
      coalesce(p.madalya, 0) * 30 as x_madalya,
      coalesce(p.katman, 0) * 40 as x_katman,
      coalesce(p.okunan_kutu, 0) * 10 as x_okuma,
      10 * (select count(*) from public.yaris_skorlari y where y.kullanici = p.id and not y.supheli) as x_yaris,
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
      10 * (select count(*) from public.yaris_skorlari y where y.kullanici = p.id and not y.supheli and y.sezon / 100 = public.tomye_ay(now()) / 100)
      + 25 * (select count(*) from public.gk_tahminler g where g.kullanici = p.id and g.cozuldu and public.tomye_ay(g.gun::timestamptz) / 100 = public.tomye_ay(now()) / 100)
      + 15 * (select count(*) from public.kesifler k where k.kullanici = p.id and public.tomye_ay(k.zaman) / 100 = public.tomye_ay(now()) / 100) as yil_xp
    from p),
  t as (
    select x.*, x_tamlik + x_gun + x_madalya + x_katman + x_yaris + x_kesif + x_ilk_kasif + x_gk + x_teori + x_begeni + x_isaret + x_oy + x_hickirik + x_av + x_defter + x_soru + x_okur_bulmaca + x_davet + x_okuma as xp
    from x)
  select kullanici_adi, gorunen_ad, xp, yil_xp,
    (floor(sqrt(xp / 60.0)) + 1)::int as seviye,
    floor((-3 + sqrt(25 + 0.8 * xp)) / 2)::int as basamak,
    jsonb_build_object('tamlik', x_tamlik, 'gun', x_gun, 'madalya', x_madalya, 'katman', x_katman, 'yaris', x_yaris,
      'kesif', x_kesif, 'ilk_kasif', x_ilk_kasif, 'gk', x_gk, 'teori', x_teori, 'begeni', x_begeni,
      'isaret', x_isaret, 'oy', x_oy, 'hickirik', x_hickirik, 'av', x_av,
      'defter', x_defter, 'soru', x_soru, 'okur_bulmaca', x_okur_bulmaca, 'davet', x_davet, 'okuma', x_okuma) as dokum
  from t;

-- Yönetici istatistikleri
create or replace function public.site_istatistik() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
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
language sql security definer set search_path = '' as $$
  with s as (delete from public.bildirim_abonelikleri where endpoint = p_endpoint returning 1)
  select jsonb_build_object('durum', 'tamam', 'silinen', (select count(*) from s));
$$;

create or replace function public.bildirim_sayisi() returns int
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tam_yonetici_mi() then raise exception 'yetki yok'; end if;
  return (select count(*) from public.bildirim_abonelikleri);
end $$;

revoke all on public.bildirim_abonelikleri from anon, authenticated;
revoke execute on function public.bildirim_abone_ol(text, text, text), public.bildirim_abonelik_sil(text), public.bildirim_sayisi() from public;
grant execute on function public.bildirim_abone_ol(text, text, text), public.bildirim_abonelik_sil(text) to anon, authenticated;
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
language plpgsql security definer set search_path = public as $$
begin
  if p_ad is null or p_ad !~ '^[a-z0-9_:]{1,40}$' then return; end if;
  if not exists (select 1 from public.olay_sayaclari where gun = current_date and ad = p_ad)
     and (select count(*) from public.olay_sayaclari where gun = current_date) >= 300 then return; end if;
  insert into public.olay_sayaclari (gun, ad, sayi) values (current_date, p_ad, 1)
  on conflict (gun, ad) do update set sayi = public.olay_sayaclari.sayi + 1;
end $$;

create or replace function public.olay_sayilari(p_gun integer)
returns table (gun date, ad text, sayi integer)
language plpgsql security definer stable set search_path = public as $$
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
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'evren', d.evren, 'kullanici_adi', p.kullanici_adi,
      'metin', d.metin, 'zaman', d.zaman) order by d.zaman), '[]'::jsonb)
    from public.evren_defteri d join public.profiller p on p.id = d.kullanici where not d.onayli);
end;
$$;

create or replace function public.evren_defter_karar(p_id bigint, p_onay boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
  if p_onay then update public.evren_defteri set onayli = true where id = p_id;
  else delete from public.evren_defteri where id = p_id; end if;
end;
$$;

-- Panel: bu haftanın özeti (son 7 gün)
create or replace function public.hafta_ozeti() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare bas date := (now() at time zone 'utc')::date - 6;
begin
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
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

-- Supabase'in API'si yeni tablo ve sütunları hemen görsün
notify pgrst, 'reload schema';
