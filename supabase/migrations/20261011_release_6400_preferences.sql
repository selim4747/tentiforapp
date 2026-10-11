-- TentiFor 6.4 — hesap bildirim/topluluk tercihleri.
-- Tercihler hassas içerik taşımaz; RLS ile yalnızca sahibine açılır.
create table if not exists public.kullanici_tercihleri (
  kullanici uuid primary key references auth.users(id) on delete cascade,
  bildirimler jsonb not null default '{"sosyal":true,"gorev":true,"urun":true,"sessiz":false}'::jsonb,
  sessize_alinan text[] not null default '{}',
  engellenen text[] not null default '{}',
  odeme_haberdar boolean not null default false,
  guncelleme timestamptz not null default now()
);
create index if not exists kullanici_tercihleri_guncelleme_idx on public.kullanici_tercihleri(guncelleme desc);
alter table public.kullanici_tercihleri enable row level security;
revoke all on public.kullanici_tercihleri from anon, authenticated;

create or replace function public.kullanici_tercihleri_oku() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object(
    'bildirimler', bildirimler,
    'sessize_alinan', to_jsonb(sessize_alinan),
    'engellenen', to_jsonb(engellenen),
    'odeme_haberdar', odeme_haberdar
  ) from public.kullanici_tercihleri where kullanici=auth.uid()), '{"bildirimler":{"sosyal":true,"gorev":true,"urun":true,"sessiz":false},"sessize_alinan":[],"engellenen":[],"odeme_haberdar":false}'::jsonb);
$$;
revoke all on function public.kullanici_tercihleri_oku() from public, anon;
grant execute on function public.kullanici_tercihleri_oku() to authenticated;

create or replace function public.kullanici_tercihleri_kaydet(p_bildirimler jsonb default '{}'::jsonb, p_sessize_alinan text[] default '{}', p_engellenen text[] default '{}', p_odeme_haberdar boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if jsonb_typeof(coalesce(p_bildirimler,'{}'::jsonb)) <> 'object' then return jsonb_build_object('durum','gecersiz'); end if;
  if coalesce(array_length(p_sessize_alinan,1),0)>500 or coalesce(array_length(p_engellenen,1),0)>500 then return jsonb_build_object('durum','sinir'); end if;
  insert into public.kullanici_tercihleri(kullanici,bildirimler,sessize_alinan,engellenen,odeme_haberdar,guncelleme)
  values(uid,p_bildirimler,p_sessize_alinan,p_engellenen,coalesce(p_odeme_haberdar,false),now())
  on conflict (kullanici) do update set bildirimler=excluded.bildirimler,sessize_alinan=excluded.sessize_alinan,engellenen=excluded.engellenen,odeme_haberdar=excluded.odeme_haberdar,guncelleme=now();
  return jsonb_build_object('durum','tamam');
end $$;
revoke all on function public.kullanici_tercihleri_kaydet(jsonb,text[],text[],boolean) from public, anon;
grant execute on function public.kullanici_tercihleri_kaydet(jsonb,text[],text[],boolean) to authenticated;
notify pgrst, 'reload schema';
