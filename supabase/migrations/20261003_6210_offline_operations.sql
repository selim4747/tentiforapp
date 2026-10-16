-- TentiforApp 6.2.10 — offline operation inbox
create table if not exists public.offline_islemler (
  kullanici uuid not null references auth.users(id) on delete cascade,
  istemci_id text not null,
  tur text not null check (tur ~ '^[a-z0-9_-]{1,80}$'),
  veri jsonb not null,
  olusturma timestamptz not null default now(),
  primary key (kullanici, istemci_id),
  constraint offline_veri_boyut check (pg_column_size(veri) <= 100000)
);
alter table public.offline_islemler enable row level security;
revoke all on public.offline_islemler from anon, authenticated;

create or replace function public.offline_islem_kaydet(p_istemci_id text, p_tur text, p_veri jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if p_istemci_id is null or p_istemci_id !~ '^q_[a-z0-9_]{3,100}$' then return jsonb_build_object('durum','istemci_id'); end if;
  if p_tur is null or p_tur !~ '^[a-z0-9_-]{1,80}$' or p_veri is null then return jsonb_build_object('durum','veri'); end if;
  insert into public.offline_islemler(kullanici, istemci_id, tur, veri)
    values (uid, p_istemci_id, p_tur, p_veri)
    on conflict (kullanici, istemci_id) do nothing;
  return jsonb_build_object('durum','tamam','istemci_id',p_istemci_id);
exception when check_violation then
  return jsonb_build_object('durum','boyut');
end;
$$;
revoke all on function public.offline_islem_kaydet(text,text,jsonb) from public, anon;
grant execute on function public.offline_islem_kaydet(text,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
