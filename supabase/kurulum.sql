-- TentiforApp Supabase Kurulum ve Veritabanı Şeması

-- 1. Profiller Tablosu
create table if not exists public.profiller (
  id uuid references auth.users on delete cascade primary key,
  kullanici_adi text unique not null,
  gorunen_ad text,
  tentifor_adi text,
  hakkinda text,
  ozet jsonb default '{}'::jsonb,
  vitrin jsonb default '{}'::jsonb,
  olusturma timestamp with time zone default timezone('utc'::text, now()) not null,
  guncelleme timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. İlerlemeler Tablosu (Cihazlar Arası Eşitleme)
create table if not exists public.ilerlemeler (
  id uuid references auth.users on delete cascade primary key,
  veri jsonb not null,
  guncelleme timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Ziyaret & Olay Sayacı Tablosu
create table if not exists public.olay_sayaclari (
  id bigint generated always as identity primary key,
  ad text not null,
  sayi bigint default 1,
  gun date default current_date not null,
  unique (ad, gun)
);

-- RLS (Row Level Security) Etkinleştirme
alter table public.profiller enable row level security;
alter table public.ilerlemeler enable row level security;
alter table public.olay_sayaclari enable row level security;

-- Profiller İlkeleri
create policy "Profiller herkese açıktır"
  on public.profiller for select
  using (true);

create policy "Kullanıcı kendi profilini güncelleyebilir"
  on public.profiller for insert
  with check (auth.uid() = id);

create policy "Kullanıcı kendi profilini düzenleyebilir"
  on public.profiller for update
  using (auth.uid() = id);

-- İlerlemeler İlkeleri
create policy "Kullanıcı kendi ilerlemesini görebilir"
  on public.ilerlemeler for select
  using (auth.uid() = id);

create policy "Kullanıcı kendi ilerlemesini kaydedebilir"
  on public.ilerlemeler for all
  using (auth.uid() = id);

-- Olay Sayaçları İlkeleri
create policy "Sayaçlar herkese okunabilir"
  on public.olay_sayaclari for select
  using (true);

-- RPC Fonksiyonları
create or replace function public.hesabimi_sil()
returns void as $$
begin
  delete from public.profiller where id = auth.uid();
  delete from public.ilerlemeler where id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$ language plpgsql security definer;

create or replace function public.olay_sayilari(p_gun int default 14)
returns table(ad text, sayi bigint, gun date) as $$
begin
  return query
  select o.ad, sum(o.sayi)::bigint, o.gun
  from public.olay_sayaclari o
  where o.gun >= current_date - p_gun
  group by o.ad, o.gun
  order by o.gun desc;
end;
$$ language plpgsql security definer;

create or replace function public.olay_say(p_ad text)
returns void as $$
begin
  insert into public.olay_sayaclari (ad, sayi, gun)
  values (p_ad, 1, current_date)
  on conflict (ad, gun)
  do update set sayi = public.olay_sayaclari.sayi + 1;
end;
$$ language plpgsql security definer;
