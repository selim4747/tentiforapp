-- TentiforApp 6.2.8 hazırlığı: Android FCM cihaz tokenları.
create table if not exists public.bildirim_cihazlari (
  id uuid primary key default gen_random_uuid(),
  kullanici uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  uygulama_surum text,
  aktif boolean not null default true,
  son_gorulme timestamptz not null default now(),
  olusturuldu timestamptz not null default now(),
  constraint bildirim_cihaz_platform check (platform in ('android')),
  constraint bildirim_cihaz_token_bos check (length(trim(token)) >= 20),
  constraint bildirim_cihaz_token_unique unique (platform, token)
);
create index if not exists bildirim_cihazlari_kullanici_idx on public.bildirim_cihazlari (kullanici, aktif);
alter table public.bildirim_cihazlari enable row level security;
drop policy if exists "bildirim_cihaz_kendi" on public.bildirim_cihazlari;
create policy "bildirim_cihaz_kendi" on public.bildirim_cihazlari for select to authenticated using (kullanici = auth.uid());

grant select on public.bildirim_cihazlari to authenticated;
revoke insert, update, delete on public.bildirim_cihazlari from anon, authenticated;

create or replace function public.bildirim_cihaz_kaydet(p_token text, p_platform text default 'android', p_surum text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('durum', 'giris'); end if;
  if lower(coalesce(p_platform, '')) <> 'android' or length(trim(coalesce(p_token, ''))) < 20 then
    return jsonb_build_object('durum', 'token');
  end if;
  insert into public.bildirim_cihazlari (kullanici, token, platform, uygulama_surum, aktif, son_gorulme)
  values (auth.uid(), trim(p_token), 'android', nullif(trim(p_surum), ''), true, now())
  on conflict (platform, token) do update set kullanici = excluded.kullanici, uygulama_surum = excluded.uygulama_surum, aktif = true, son_gorulme = now();
  return jsonb_build_object('durum', 'tamam');
end $$;
revoke execute on function public.bildirim_cihaz_kaydet(text, text, text) from public, anon;
grant execute on function public.bildirim_cihaz_kaydet(text, text, text) to authenticated;

create or replace function public.bildirim_cihaz_kapat(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n integer := 0;
begin
  if auth.uid() is null then return jsonb_build_object('durum', 'giris'); end if;
  update public.bildirim_cihazlari set aktif = false, son_gorulme = now() where token = trim(p_token) and kullanici = auth.uid();
  get diagnostics n = row_count;
  return jsonb_build_object('durum', 'tamam', 'guncellenen', n);
end $$;
revoke execute on function public.bildirim_cihaz_kapat(text) from public, anon;
grant execute on function public.bildirim_cihaz_kapat(text) to authenticated;

notify pgrst, 'reload schema';
