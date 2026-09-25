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

-- Supabase'in API'si yeni tablo ve sütunları hemen görsün
notify pgrst, 'reload schema';
