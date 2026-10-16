-- TentiforApp 6.3.3 — kurucu taslakları, sürüm geçmişi ve zaman çizelgesi
create table if not exists public.evren_taslaklari (
  id uuid primary key default gen_random_uuid(),
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null check (char_length(btrim(evren_id)) between 1 and 80),
  baslik text not null check (char_length(btrim(baslik)) between 1 and 160),
  surum int not null check (surum >= 1),
  veri jsonb not null check (pg_column_size(veri) < 1000000),
  durum text not null default 'taslak' check (durum in ('taslak','onizleme','arsiv')),
  olusturma timestamptz not null default now(),
  unique(sahibi,evren_id,surum)
);
create index if not exists evren_taslaklari_sahip_idx on public.evren_taslaklari(sahibi,evren_id,surum desc);
alter table public.evren_taslaklari enable row level security;
revoke all on public.evren_taslaklari from anon, authenticated;

create or replace function public.evren_taslak_kaydet(p_evren_id text,p_baslik text,p_veri jsonb,p_durum text default 'taslak') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); yeni uuid; n int; temiz text:=btrim(coalesce(p_evren_id,'')); bas text:=btrim(coalesce(p_baslik,''));
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if temiz='' or char_length(bas) not between 1 and 160 or p_veri is null or pg_column_size(p_veri)>=1000000 then return jsonb_build_object('durum','gecersiz'); end if;
  if p_durum not in ('taslak','onizleme','arsiv') then return jsonb_build_object('durum','gecersiz'); end if;
  select coalesce(max(surum),0)+1 into n from public.evren_taslaklari where sahibi=uid and evren_id=temiz;
  if n>1000 then delete from public.evren_taslaklari where sahibi=uid and evren_id=temiz and surum=(select min(surum) from public.evren_taslaklari where sahibi=uid and evren_id=temiz); end if;
  insert into public.evren_taslaklari(sahibi,evren_id,baslik,surum,veri,durum) values(uid,left(temiz,80),left(bas,160),n,p_veri,p_durum) returning id into yeni;
  return jsonb_build_object('durum','tamam','id',yeni,'surum',n);
end;
$$;
revoke all on function public.evren_taslak_kaydet(text,text,jsonb,text) from public, anon;
grant execute on function public.evren_taslak_kaydet(text,text,jsonb,text) to authenticated;
create or replace function public.evren_taslaklarim() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'evren_id',q.evren_id,'baslik',q.baslik,'surum',q.surum,'durum',q.durum,'olusturma',q.olusturma) order by q.olusturma desc), '[]'::jsonb)
  from (select distinct on (evren_id) id,evren_id,baslik,surum,durum,olusturma from public.evren_taslaklari where sahibi=auth.uid() order by evren_id,surum desc) q;
$$;
revoke all on function public.evren_taslaklarim() from public, anon;
grant execute on function public.evren_taslaklarim() to authenticated;
create or replace function public.evren_taslak_detay(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when sahibi=auth.uid() then jsonb_build_object('id',id,'evren_id',evren_id,'baslik',baslik,'surum',surum,'durum',durum,'veri',veri,'olusturma',olusturma) else null end from public.evren_taslaklari where id=p_id;
$$;
revoke all on function public.evren_taslak_detay(uuid) from public, anon;
grant execute on function public.evren_taslak_detay(uuid) to authenticated;

create table if not exists public.evren_zaman_noktalari (
  id bigserial primary key,
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null check (char_length(evren_id) between 1 and 80),
  zaman text not null check (char_length(zaman) between 1 and 60),
  baslik text not null check (char_length(baslik) between 1 and 160),
  aciklama text not null default '' check (char_length(aciklama)<=600),
  tur text not null default 'olay' check (tur in ('olay','donem','savas','dogum','olum','donum')),
  olusturma timestamptz not null default now()
);
create index if not exists evren_zaman_noktalari_idx on public.evren_zaman_noktalari(sahibi,evren_id,olusturma desc);
alter table public.evren_zaman_noktalari enable row level security;
revoke all on public.evren_zaman_noktalari from anon, authenticated;
create or replace function public.evren_zaman_noktasi_ekle(p_evren_id text,p_zaman text,p_baslik text,p_aciklama text default '',p_tur text default 'olay') returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); yeni bigint;
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  if (select count(*) from public.evren_zaman_noktalari where sahibi=uid and evren_id=p_evren_id)>=500 then raise exception 'zaman çizelgesi dolu'; end if;
  insert into public.evren_zaman_noktalari(sahibi,evren_id,zaman,baslik,aciklama,tur) values(uid,left(btrim(p_evren_id),80),left(btrim(p_zaman),60),left(btrim(p_baslik),160),left(coalesce(p_aciklama,''),600),coalesce(p_tur,'olay')) returning id into yeni;
  return yeni;
end;
$$;
revoke all on function public.evren_zaman_noktasi_ekle(text,text,text,text,text) from public, anon;
grant execute on function public.evren_zaman_noktasi_ekle(text,text,text,text,text) to authenticated;
create or replace function public.evren_zaman_cizelgesi(p_evren_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'zaman',zaman,'baslik',baslik,'aciklama',aciklama,'tur',tur) order by olusturma desc), '[]'::jsonb) from public.evren_zaman_noktalari where evren_id=p_evren_id and (sahibi=auth.uid() or false);
$$;
revoke all on function public.evren_zaman_cizelgesi(text) from public, anon;
grant execute on function public.evren_zaman_cizelgesi(text) to authenticated;
notify pgrst, 'reload schema';
