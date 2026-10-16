-- TentiForApp 6.4.5 — gerçek cihaz oturumları
create table if not exists public.hesap_cihazlari (
  kullanici uuid not null references auth.users(id) on delete cascade,
  cihaz text not null check (cihaz ~ '^[a-zA-Z0-9_-]{3,120}$'),
  ad text not null default 'Cihaz' check (char_length(ad) between 1 and 120),
  platform text not null default '' check (char_length(platform) <= 120),
  ilk_gorulme timestamptz not null default now(),
  son_gorulme timestamptz not null default now(),
  primary key (kullanici, cihaz)
);
create index if not exists hesap_cihazlari_aktif_idx on public.hesap_cihazlari(kullanici, son_gorulme desc);
alter table public.hesap_cihazlari enable row level security;
revoke all on public.hesap_cihazlari from public, anon, authenticated;
create or replace function public.cihaz_heartbeat(p_cihaz text, p_ad text default 'Cihaz', p_platform text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); temiz text := left(btrim(coalesce(p_cihaz,'')),120); n int;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if temiz !~ '^[a-zA-Z0-9_-]{3,120}$' then return jsonb_build_object('durum','gecersiz'); end if;
  insert into public.hesap_cihazlari(kullanici,cihaz,ad,platform,son_gorulme)
    values(uid,temiz,left(coalesce(nullif(btrim(coalesce(p_ad,'')), ''), 'Cihaz'),120),left(btrim(coalesce(p_platform,'')),120),now())
    on conflict(kullanici,cihaz) do update set ad=excluded.ad,platform=excluded.platform,son_gorulme=now();
  delete from public.hesap_cihazlari where kullanici=uid and son_gorulme < now() - interval '90 days';
  select count(*)::int into n from public.hesap_cihazlari where kullanici=uid and son_gorulme >= now() - interval '15 minutes';
  return jsonb_build_object('durum','tamam','aktif',n);
end;
$$;
revoke all on function public.cihaz_heartbeat(text,text,text) from public, anon;
grant execute on function public.cihaz_heartbeat(text,text,text) to authenticated;
create or replace function public.cihazlarim(p_cihaz text default '') returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'aktif', (select count(*)::int from public.hesap_cihazlari where kullanici=auth.uid() and son_gorulme >= now() - interval '15 minutes'),
    'cihazlar', coalesce((select jsonb_agg(jsonb_build_object('cihaz',cihaz,'ad',ad,'platform',platform,'ilk_gorulme',ilk_gorulme,'son_gorulme',son_gorulme,'bu_mu',cihaz=left(btrim(coalesce(p_cihaz,'')),120)) order by son_gorulme desc) from public.hesap_cihazlari where kullanici=auth.uid()), '[]'::jsonb)
  );
$$;
revoke all on function public.cihazlarim(text) from public, anon;
grant execute on function public.cihazlarim(text) to authenticated;
create or replace function public.kurulum_surumu() returns text language sql stable security definer set search_path = '' as $$ select '6.4.5.0'::text $$;
revoke all on function public.kurulum_surumu() from public;
grant execute on function public.kurulum_surumu() to anon, authenticated;
notify pgrst, 'reload schema';
