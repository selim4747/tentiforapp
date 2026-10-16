-- Tentiforverse: Supabase yalnızca erişim kontrolü yapar; içerik GitHub private depoda kalır.

alter table public.ortak_evrenler
  add column if not exists github_yol text;

alter table public.ortak_evrenler
  add column if not exists durum text not null default 'taslak';

alter table public.ortak_evrenler
  drop constraint if exists ortak_evrenler_github_yol_ck;

alter table public.ortak_evrenler
  add constraint ortak_evrenler_github_yol_ck
  check (github_yol is null or github_yol ~ '^evren/[A-Za-z0-9_-]{1,60}\.json$');

create or replace function public.evren_github_yol_kaydet(p_id text, p_yol text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare e public.ortak_evrenler;
begin
  if auth.uid() is null then return jsonb_build_object('durum', 'giris'); end if;
  if p_yol !~ '^evren/[A-Za-z0-9_-]{1,60}\.json$' then
    return jsonb_build_object('durum', 'gecersiz');
  end if;
  select * into e from public.ortak_evrenler
   where id = p_id and sahip = auth.uid();
  if not found then return jsonb_build_object('durum', 'yetki'); end if;
  update public.ortak_evrenler
     set github_yol = p_yol, guncelleme = now()
   where id = p_id;
  return jsonb_build_object('durum', 'tamam', 'github_yol', p_yol);
end;
$$;

revoke execute on function public.evren_github_yol_kaydet(text, text) from public, anon;
grant execute on function public.evren_github_yol_kaydet(text, text) to authenticated;

create or replace function public.evren_erisimi(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'izin', true,
    'id', e.id,
    'github_yol', e.github_yol,
    'durum', e.durum,
    'rol', u.rol,
    'sahip', e.sahip = auth.uid(),
    'guncelleme', e.guncelleme
  )
  from public.ortak_evrenler e
  join public.ortak_evren_uyeleri u
    on u.evren = e.id and u.kullanici = auth.uid()
  where e.id = p_id;
$$;

revoke execute on function public.evren_erisimi(text) from public, anon;
grant execute on function public.evren_erisimi(text) to authenticated;
