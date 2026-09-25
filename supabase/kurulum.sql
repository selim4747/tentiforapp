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
  n_tamlik int;
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

  -- 1) mutlak sınırlar: aşan değer imkânsızdır → sınıra çekilir ve kayıt askıya alınır
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
    nobet, cevirmen, vardiya, yazi, boyut, baloncuk, tamlik, rol, kisilik,
    hafta, hafta_taban, sezon, sezon_taban, askida, askida_neden, son_gonderim, guncelleme)
  values (
    uid, n_okunan, n_katman, n_oyun, n_galeri, n_gun, n_seri, n_madalya, n_ecka,
    n_nobet, n_cevirmen, n_vardiya, n_yazi, n_boyut, n_baloncuk, n_tamlik,
    left(g->>'rol', 40), left(g->>'kisilik', 40),
    -- ilk gönderimde haftalık/aylık puan sıfırdan başlar (eski ilerleme bu haftaya yazılmaz)
    bu_hafta, n_ecka, bu_sezon, n_ecka,
    cardinality(sebepler) > 0, nullif(array_to_string(sebepler, '; '), ''), now(), now())
  on conflict (id) do update set
    okunan_karakter = excluded.okunan_karakter, katman = excluded.katman, oyun = excluded.oyun,
    galeri = excluded.galeri, gun = excluded.gun, seri = excluded.seri, madalya = excluded.madalya,
    ecka_toplam = excluded.ecka_toplam, nobet = excluded.nobet, cevirmen = excluded.cevirmen,
    vardiya = excluded.vardiya, yazi = excluded.yazi, boyut = excluded.boyut, baloncuk = excluded.baloncuk,
    tamlik = excluded.tamlik, rol = excluded.rol, kisilik = excluded.kisilik,
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

-- Supabase'in API'si yeni tablo ve sütunları hemen görsün
notify pgrst, 'reload schema';
