-- TentiforApp 6.3.13 — E26 özel kanon yöneticisi
-- Kullanıcı site geneli yönetici olmaz; yalnızca belirtilen kanon evrenine erişir.
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
returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tam_yonetici_mi()
    or exists (
      select 1
      from public.kanon_evren_yetkileri k
      where k.kullanici = auth.uid()
        and k.evren = lower(btrim(coalesce(p_evren, '')))
        and coalesce(p_yetki, 'duzenle') = any(k.yetkiler)
    );
$$;
revoke all on function public.kanon_evren_yetkili(text, text) from public, anon;
grant execute on function public.kanon_evren_yetkili(text, text) to authenticated;

-- Yetki tanımı profil kullanıcı adına göre yapılır; UUID sabitlenmez.
insert into public.kanon_evren_yetkileri (kullanici, evren, yetkiler)
select p.id, 'e26', array['duzenle','yayinla','harita','okuma']::text[]
from public.profiller p
where p.kullanici_adi in ('selimblackstone', 'selimoo2')
on conflict (kullanici, evren) do update
set yetkiler = excluded.yetkiler;

-- Canlı istemci yalnızca kendi E26 yetki özetini alır.
create or replace function public.kanon_evren_yetkilerim()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(k.evren, to_jsonb(k.yetkiler)), '{}'::jsonb)
  from public.kanon_evren_yetkileri k
  where k.kullanici = auth.uid();
$$;
revoke all on function public.kanon_evren_yetkilerim() from public, anon;
grant execute on function public.kanon_evren_yetkilerim() to authenticated;
