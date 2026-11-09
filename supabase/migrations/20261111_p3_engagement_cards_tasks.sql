-- TentiforApp P3 — richer public reading-card metadata and actionable discovery tasks.
-- Additive replacement: no existing content or user progress is backfilled.
create or replace function public.kesif_gorevlerim() returns jsonb
language sql stable security definer set search_path = '' as $$
  with s as (
    select coalesce(seri,0) seri,coalesce(gun,0) gun
    from public.istatistikler where id=auth.uid()
  ), hafta as (
    select date_trunc('week',now() at time zone 'utc')::date bas
  ), r as (
    select count(*)::int n from public.kisisel_raf
    where kullanici=auth.uid() and eklenme >= (select bas from hafta)
  ), y as (
    select count(*)::int n from public.okuma_yollari
    where sahibi=auth.uid() and olusturma >= (select bas from hafta)
  )
  select jsonb_build_object(
    'durum',case when auth.uid() is null then 'giris' else 'tamam' end,
    'gorevler',case when auth.uid() is null then '[]'::jsonb else jsonb_build_array(
      jsonb_build_object('id','seri','ad','Okuma serisi','aciklama','Arka arkaya üç farklı gün uğra.','ilerleme',least(3,s.seri),'hedef',3,'xp',15,'sure_dk',5,'sonraki','Yarın kaldığın yerden devam et.'),
      jsonb_build_object('id','raf','ad','Arşivini büyüt','aciklama','Bu hafta iki öğeyi kişisel rafına ekle.','ilerleme',least(2,r.n),'hedef',2,'xp',10,'sure_dk',3,'sonraki','Bir sonraki okumayı rafından aç.'),
      jsonb_build_object('id','yol','ad','Bir rota çiz','aciklama','Bu hafta bir okuma yolu oluştur.','ilerleme',least(1,y.n),'hedef',1,'xp',20,'sure_dk',8,'sonraki','Rotanı paylaşılabilir karta dönüştür.')
    ) end
  ) from s,r,y;
$$;
revoke all on function public.kesif_gorevlerim() from public, anon;
grant execute on function public.kesif_gorevlerim() to authenticated;
notify pgrst, 'reload schema';
