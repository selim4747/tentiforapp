-- TentiforApp 6.3.4 — kişiselleştirilmiş keşif, popülerlik ve öne çıkan arsivciler
create or replace function public.kesif_akisi(p_tur text default 'hepsi',p_siralama text default 'yeni',p_limit int default 24) returns jsonb
language sql stable security definer set search_path = '' as $$
  with takip as (select takip_edilen from public.takipler where takip_eden=auth.uid()),
  evrenler as (
    select 'evren'::text tur,y.slug id,y.baslik,left(y.ozet,220) metin,
      p.kullanici_adi, y.yayin_tarihi zaman, '#/ev/fan/'||y.slug adres,
      coalesce((select sum(sayi) from public.evren_sayaclari z where z.evren=y.slug and z.gun>(now() at time zone 'utc')::date-30),0)::bigint popular,
      case when b.gonderen in (select takip_edilen from takip) then 1 else 0 end takip_boost
    from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru left join public.profiller p on p.id=b.gonderen left join public.istatistikler st on st.id=b.gonderen
    where (p_tur='hepsi' or p_tur='evren') and (p.id is null or (coalesce(p.profil_icerik_gorunur,true) and not coalesce(st.gizli or st.askida or st.engelli,false)))
  ), arsivciler as (
    select 'arsivci'::text tur,p.kullanici_adi id,coalesce(nullif(p.gorunen_ad,''),p.kullanici_adi) baslik,left(coalesce(p.hakkinda,''),220) metin,p.kullanici_adi, p.guncelleme zaman,'#/u/'||p.kullanici_adi adres,
      ((select count(*) from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru where b.gonderen=p.id)*10+(select count(*) from public.takipler t where t.takip_edilen=p.id))::bigint popular,
      case when p.id in (select takip_edilen from takip) then 1 else 0 end takip_boost
    from public.profiller p left join public.istatistikler st on st.id=p.id
    where (p_tur='hepsi' or p_tur='arsivci') and coalesce(p.profil_arama_gorunur,true) and not coalesce(st.gizli or st.askida or st.engelli,false)
  ), birlesik as (select * from evrenler union all select * from arsivciler), sirali as (
    select * from birlesik order by
      case when p_siralama='populer' then popular end desc nulls last,
      case when p_siralama='onerilen' then takip_boost end desc nulls last,
      case when p_siralama='onerilen' then popular end desc nulls last,
      case when p_siralama='yeni' then zaman end desc nulls last, zaman desc
    limit greatest(1,least(coalesce(p_limit,24),50))
  ) select coalesce(jsonb_agg(jsonb_build_object('tur',tur,'id',id,'baslik',baslik,'metin',metin,'kullanici_adi',kullanici_adi,'zaman',zaman,'adres',adres,'popular',popular) order by zaman desc),'[]'::jsonb) from sirali;
$$;
revoke all on function public.kesif_akisi(text,text,int) from public;
grant execute on function public.kesif_akisi(text,text,int) to anon, authenticated;
create or replace function public.kesif_one_cikanlar(p_limit int default 12) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('kullanici_adi',q.kullanici_adi,'gorunen_ad',q.gorunen_ad,'evren_sayisi',q.evren_sayisi,'takipci',q.takipci) order by q.evren_sayisi desc,q.takipci desc), '[]'::jsonb)
  from (select p.kullanici_adi,p.gorunen_ad,(select count(*) from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru where b.gonderen=p.id)::int evren_sayisi,(select count(*) from public.takipler t where t.takip_edilen=p.id)::int takipci from public.profiller p left join public.istatistikler s on s.id=p.id where coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false) order by evren_sayisi desc,takipci desc limit greatest(1,least(coalesce(p_limit,12),30))) q;
$$;
revoke all on function public.kesif_one_cikanlar(int) from public;
grant execute on function public.kesif_one_cikanlar(int) to anon, authenticated;
notify pgrst, 'reload schema';
