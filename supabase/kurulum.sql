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

-- Supabase'in API'si yeni tablo ve sütunları hemen görsün
notify pgrst, 'reload schema';
