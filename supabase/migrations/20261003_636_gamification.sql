-- TentiforApp 6.3.6 — okuma serisi ve haftalık keşif görevleri
create table if not exists public.okuma_gunleri (
  kullanici uuid not null references auth.users(id) on delete cascade,
  gun date not null,
  adres text not null default '',
  ilk_giris timestamptz not null default now(),
  primary key (kullanici, gun)
);
alter table public.okuma_gunleri enable row level security;
revoke all on public.okuma_gunleri from public, anon, authenticated;

create or replace function public.okuma_serisi_kaydet(p_adres text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); bugun date:=(now() at time zone 'utc')::date; onceki date; yeni boolean:=false; seri int:=0; toplam int:=0; etkilenen int:=0;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  p_adres:=left(regexp_replace(coalesce(p_adres,''),'[^a-zA-Z0-9_/:.?=-]','','g'),240);
  insert into public.okuma_gunleri(kullanici,gun,adres) values(uid,bugun,p_adres) on conflict (kullanici,gun) do nothing;
  get diagnostics etkilenen = row_count; yeni := etkilenen > 0;
  select count(*)::int into toplam from public.okuma_gunleri where kullanici=uid;
  select seri into seri from public.istatistikler where id=uid;
  if yeni then
    select exists(select 1 from public.okuma_gunleri where kullanici=uid and gun=bugun-1) into yeni;
    seri:=case when yeni then greatest(1,coalesce(seri,0)+1) else 1 end;
    insert into public.istatistikler(id,gun,seri,guncelleme) values(uid,1,seri,now()) on conflict(id) do update set gun=public.istatistikler.gun+1,seri=excluded.seri,guncelleme=now();
  end if;
  return jsonb_build_object('durum','tamam','seri',coalesce(seri,0),'gun',toplam);
end;
$$;
revoke all on function public.okuma_serisi_kaydet(text) from public, anon;
grant execute on function public.okuma_serisi_kaydet(text) to authenticated;

create or replace function public.kesif_gorevlerim() returns jsonb
language sql stable security definer set search_path = '' as $$
  with s as (select coalesce(seri,0) seri,coalesce(gun,0) gun from public.istatistikler where id=auth.uid()), hafta as (select date_trunc('week',now() at time zone 'utc')::date bas), r as (select count(*)::int n from public.kisisel_raf where kullanici=auth.uid() and eklenme >= (select bas from hafta)), y as (select count(*)::int n from public.okuma_yollari where sahibi=auth.uid() and olusturma >= (select bas from hafta))
  select jsonb_build_object('durum',case when auth.uid() is null then 'giris' else 'tamam' end,'gorevler',case when auth.uid() is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('id','seri','ad','Okuma serisi','aciklama','Arka arkaya üç farklı gün uğra.','ilerleme',least(3,s.seri),'hedef',3,'xp',15),jsonb_build_object('id','raf','ad','Arşivini büyüt','aciklama','Bu hafta iki öğeyi kişisel rafına ekle.','ilerleme',least(2,r.n),'hedef',2,'xp',10),jsonb_build_object('id','yol','ad','Bir rota çiz','aciklama','Bu hafta bir okuma yolu oluştur.','ilerleme',least(1,y.n),'hedef',1,'xp',20)) end) from s,r,y;
$$;
revoke all on function public.kesif_gorevlerim() from public, anon;
grant execute on function public.kesif_gorevlerim() to authenticated;
notify pgrst, 'reload schema';
