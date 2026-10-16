-- TentiforApp 6.3.0 repair — uzak şemada eksik kalan kişisel raf temeli
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
notify pgrst, 'reload schema';
