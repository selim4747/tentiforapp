-- TentiforApp 6.3.9 — public SEO metadata and share-card source data
-- Only already-public profiles, published universes and explicitly public reading paths.

create or replace function public.public_seo_sayfa(p_tur text, p_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare sonuc jsonb;
begin
  if p_tur = 'profil' then
    if p_id is null or p_id !~* '^[a-z0-9_]{3,20}$' then return null; end if;
    select jsonb_build_object(
      'tur','profil',
      'kullanici_adi',p.kullanici_adi,
      'gorunen_ad',coalesce(nullif(p.gorunen_ad,''),p.kullanici_adi),
      'hakkinda',case when coalesce(p.profil_icerik_gorunur,true) then left(coalesce(p.hakkinda,''),280) else '' end,
      'icerik_gorunur',coalesce(p.profil_icerik_gorunur,true),
      'evrenler',case when coalesce(p.profil_icerik_gorunur,true) then coalesce((
        select jsonb_agg(jsonb_build_object('slug',q.slug,'baslik',q.baslik,'ozet',q.ozet) order by q.yayin_tarihi desc)
        from (select y.slug,y.baslik,left(y.ozet,600) ozet,y.yayin_tarihi
          from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru
          where b.gonderen=p.id order by y.yayin_tarihi desc limit 30) q
      ),'[]'::jsonb) else '[]'::jsonb end
    ) into sonuc
    from public.profiller p
    left join public.istatistikler s on s.id=p.id
    where lower(p.kullanici_adi)=lower(btrim(p_id))
      and coalesce(p.profil_arama_gorunur,true)
      and not coalesce(s.gizli or s.askida or s.engelli,false);
    return sonuc;
  elsif p_tur = 'evren' then
    if p_id is null or char_length(p_id)<3 or char_length(p_id)>60 or p_id !~ '^[[:alnum:]][[:alnum:]-]{2,59}$' then return null; end if;
    select jsonb_build_object(
      'tur','evren','slug',y.slug,'baslik',left(y.baslik,120),'ozet',left(y.ozet,600),
      'yayin_tarihi',y.yayin_tarihi,
      'yazar',case when coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true)
        and not coalesce(s.gizli or s.askida or s.engelli,false) then p.kullanici_adi else null end,
      'yazar_adi',case when coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true)
        and not coalesce(s.gizli or s.askida or s.engelli,false) then coalesce(nullif(p.gorunen_ad,''),p.kullanici_adi) else null end
    ) into sonuc
    from public.yayindaki_evrenler y
    left join public.basvurular b on b.id=y.basvuru
    left join public.profiller p on p.id=b.gonderen
    left join public.istatistikler s on s.id=p.id
    where y.slug=lower(btrim(p_id))
      and (p.id is null or (coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)));
    return sonuc;
  elsif p_tur = 'okuma' then
    if p_id is null or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
    select jsonb_build_object(
      'tur','okuma','id',y.id,'baslik',left(y.baslik,120),'aciklama',left(y.aciklama,600),
      'yazar',p.kullanici_adi,'yazar_adi',coalesce(nullif(p.gorunen_ad,''),p.kullanici_adi),
      'adimlar',coalesce((select jsonb_agg(jsonb_build_object('sira',a.sira,'baslik',left(a.baslik,160),'tur',a.tur) order by a.sira)
        from (select sira,baslik,tur from public.okuma_yolu_adimlari where yol=y.id order by sira limit 100) a),'[]'::jsonb)
    ) into sonuc
    from public.okuma_yollari y
    join public.profiller p on p.id=y.sahibi
    left join public.istatistikler s on s.id=p.id
    where y.id=p_id::uuid and y.public_mu
      and coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true)
      and not coalesce(s.gizli or s.askida or s.engelli,false);
    return sonuc;
  end if;
  return null;
end;
$$;
revoke all on function public.public_seo_sayfa(text,text) from public;
grant execute on function public.public_seo_sayfa(text,text) to anon, authenticated;

-- A crawler sitemap can enumerate only resources that meet the same public visibility rules.
-- Pagination is capped to 100 items per request to keep response and query cost bounded.
create or replace function public.public_seo_sayfalar(p_tur text, p_limit int default 100, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare n int:=greatest(1,least(coalesce(p_limit,100),100)); o int:=greatest(0,least(coalesce(p_offset,0),1000000)); sonuc jsonb;
begin
  if p_tur='profil' then
    select coalesce(jsonb_agg(public.public_seo_sayfa('profil',q.kullanici_adi) order by q.kullanici_adi),'[]'::jsonb) into sonuc
    from (select p.kullanici_adi from public.profiller p left join public.istatistikler s on s.id=p.id
      where p.kullanici_adi is not null and coalesce(p.profil_arama_gorunur,true)
        and not coalesce(s.gizli or s.askida or s.engelli,false)
      order by lower(p.kullanici_adi),p.kullanici_adi limit n offset o) q;
    return sonuc;
  elsif p_tur='evren' then
    select coalesce(jsonb_agg(public.public_seo_sayfa('evren',q.slug) order by q.slug),'[]'::jsonb) into sonuc
    from (select y.slug from public.yayindaki_evrenler y left join public.basvurular b on b.id=y.basvuru
      left join public.profiller p on p.id=b.gonderen left join public.istatistikler s on s.id=p.id
      where p.id is null or (coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false))
      order by y.slug limit n offset o) q;
    return sonuc;
  elsif p_tur='okuma' then
    select coalesce(jsonb_agg(public.public_seo_sayfa('okuma',q.id::text) order by q.id),'[]'::jsonb) into sonuc
    from (select y.id from public.okuma_yollari y join public.profiller p on p.id=y.sahibi
      left join public.istatistikler s on s.id=p.id
      where y.public_mu and coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true)
        and not coalesce(s.gizli or s.askida or s.engelli,false)
      order by y.id limit n offset o) q;
    return sonuc;
  end if;
  return '[]'::jsonb;
end;
$$;
revoke all on function public.public_seo_sayfalar(text,int,int) from public;
grant execute on function public.public_seo_sayfalar(text,int,int) to anon, authenticated;

-- This is the current-installation marker; the canonical setup contains one copy only.
create or replace function public.kurulum_surumu() returns text
language sql stable security definer set search_path = '' as $$ select '6.3.9'::text $$;
revoke all on function public.kurulum_surumu() from public;
grant execute on function public.kurulum_surumu() to anon, authenticated;
notify pgrst, 'reload schema';
