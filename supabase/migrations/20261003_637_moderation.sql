-- TentiforApp 6.3.7 — moderasyon özeti, davranış sinyalleri ve geri alınabilir karantina
create table if not exists public.icerik_karantina (
  no bigserial primary key,
  bildirim_no bigint not null references public.icerik_bildirimleri(no) on delete cascade,
  tur text not null,
  hedef text not null,
  notu text not null default '' check (char_length(notu)<=500),
  durum text not null default 'aktif' check (durum in ('aktif','kaldirildi')),
  moderator uuid not null references auth.users(id),
  olusturma timestamptz not null default now(),
  kaldirma timestamptz,
  unique (bildirim_no)
);
alter table public.icerik_karantina enable row level security;
revoke all on public.icerik_karantina from public, anon, authenticated;

create or replace function public.icerik_bildirim_ozeti() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('icbildirim') then raise exception 'yetki yok'; end if;
  return jsonb_build_object('toplam',(select count(*) from public.icerik_bildirimleri),'yeni',(select count(*) from public.icerik_bildirimleri where durum='yeni'),'incelendi',(select count(*) from public.icerik_bildirimleri where durum='incelendi'),'kaldirildi',(select count(*) from public.icerik_bildirimleri where durum='kaldirildi'),'karantina',(select count(*) from public.icerik_karantina where durum='aktif'),'turler',coalesce((select jsonb_agg(jsonb_build_object('tur',tur,'adet',adet) order by adet desc) from (select tur,count(*)::int adet from public.icerik_bildirimleri group by tur) q),'[]'::jsonb),'raporlayanlar',coalesce((select jsonb_agg(jsonb_build_object('kullanici_adi',p.kullanici_adi,'adet',q.adet) order by q.adet desc) from (select bildiren,count(*)::int adet from public.icerik_bildirimleri where bildiren is not null group by bildiren order by adet desc limit 10) q join public.profiller p on p.id=q.bildiren),'[]'::jsonb));
end;
$$;
revoke all on function public.icerik_bildirim_ozeti() from public, anon, authenticated;
grant execute on function public.icerik_bildirim_ozeti() to authenticated;

create or replace function public.icerik_karantinaya_al(p_bildirim_no bigint,p_not text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.icerik_bildirimleri%rowtype; uid uuid:=auth.uid();
begin
  if not public.yonetici_yetki('icbildirim') then raise exception 'yetki yok'; end if;
  select * into r from public.icerik_bildirimleri where no=p_bildirim_no;
  if r.no is null then return jsonb_build_object('durum','yok'); end if;
  insert into public.icerik_karantina(bildirim_no,tur,hedef,notu,moderator) values(r.no,r.tur,r.hedef,left(coalesce(p_not,''),500),uid) on conflict(bildirim_no) do update set durum='aktif',notu=excluded.notu,moderator=excluded.moderator,kaldirma=null;
  update public.icerik_bildirimleri set durum='kaldirildi' where no=p_bildirim_no;
  return jsonb_build_object('durum','tamam');
end;
$$;
create or replace function public.icerik_karantina_kaldir(p_bildirim_no bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_yetki('icbildirim') then raise exception 'yetki yok'; end if;
  update public.icerik_karantina set durum='kaldirildi',kaldirma=now() where bildirim_no=p_bildirim_no and durum='aktif';
  return jsonb_build_object('durum',case when found then 'tamam' else 'yok' end);
end;
$$;
revoke all on function public.icerik_karantinaya_al(bigint,text),public.icerik_karantina_kaldir(bigint) from public, anon, authenticated;
grant execute on function public.icerik_karantinaya_al(bigint,text),public.icerik_karantina_kaldir(bigint) to authenticated;
notify pgrst, 'reload schema';
