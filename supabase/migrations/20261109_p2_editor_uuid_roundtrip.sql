-- TentiforApp 6.6.2 — preserve editor entity IDs across RPC load/save.
-- Additive function replacement only; production application remains an operator decision.
create or replace function public.evren_gorsel_haritayi_yukle(p_evren_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  evren text := btrim(coalesce(p_evren_id, ''));
  uid uuid := auth.uid();
  asil uuid;
  herkese boolean := false;
  duzenleyebilir boolean := false;
begin
  if char_length(evren) not between 1 and 80 then return jsonb_build_object('durum','gecersiz','dugumler','[]'::jsonb,'baglar','[]'::jsonb); end if;
  select sahibi, herkese_acik into asil, herkese from public.evren_gorsel_alanlari where evren_id = evren;
  if not found then return jsonb_build_object('durum','tamam','duzenleyebilir',uid is not null,'herkese_acik',false,'dugumler','[]'::jsonb,'baglar','[]'::jsonb); end if;
  duzenleyebilir := uid is not null and (uid = asil or (exists (select 1 from public.ortak_evrenler o where o.id = evren and o.sahip = asil) and public.ortak_uye_mi(evren)));
  if not duzenleyebilir and not herkese then return jsonb_build_object('durum','yok','dugumler','[]'::jsonb,'baglar','[]'::jsonb); end if;
  return jsonb_build_object(
    'durum','tamam',
    'duzenleyebilir',duzenleyebilir,
    'herkese_acik',case when duzenleyebilir then herkese else false end,
    'dugumler',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'tip',q.tip,'baslik',q.baslik,'aciklama',q.aciklama,'x',q.x,'y',q.y,'yayinda',q.yayinda,'varlik_id',q.varlik_id) order by q.olusturma,q.id) from (select id,tip,baslik,aciklama,x,y,yayinda,varlik_id,olusturma from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren and (duzenleyebilir or (herkese and yayinda)) order by olusturma,id limit 150) q),'[]'::jsonb),
    'baglar',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'kaynak',q.kaynak,'hedef',q.hedef,'tur',q.tur,'etiket',q.etiket) order by q.olusturma,q.id) from (select b.id,b.kaynak,b.hedef,b.tur,b.etiket,b.olusturma from public.evren_harita_baglari b where b.sahibi=asil and b.evren_id=evren and (duzenleyebilir or (herkese and exists(select 1 from public.evren_harita_dugumleri a where a.sahibi=b.sahibi and a.evren_id=b.evren_id and a.id=b.kaynak and a.yayinda) and exists(select 1 from public.evren_harita_dugumleri z where z.sahibi=b.sahibi and z.evren_id=b.evren_id and z.id=b.hedef and z.yayinda))) order by b.olusturma,b.id limit 300) q),'[]'::jsonb)
  );
end;
$$;
create or replace function public.evren_gorsel_haritayi_kaydet(p_evren_id text,p_dugumler jsonb,p_baglar jsonb,p_herkese_acik boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  evren text := btrim(coalesce(p_evren_id, ''));
  asil uuid;
  adet int;
  tek jsonb;
begin
  if jsonb_typeof(p_dugumler) is distinct from 'array' or jsonb_typeof(p_baglar) is distinct from 'array'
     or pg_column_size(p_dugumler)+pg_column_size(p_baglar)>262144 then return jsonb_build_object('durum','gecersiz'); end if;
  if jsonb_array_length(p_dugumler)>150 or jsonb_array_length(p_baglar)>300 then return jsonb_build_object('durum','gecersiz'); end if;
  if exists (select 1 from jsonb_array_elements(p_dugumler) d(v) where jsonb_typeof(v) is distinct from 'object' or coalesce(v->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(v->>'tip','') not in ('karakter','mekan','olay','gezegen','kavram') or char_length(btrim(coalesce(v->>'baslik',''))) not between 1 and 120 or char_length(coalesce(v->>'aciklama',''))>600 or coalesce(v->>'x','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' or coalesce(v->>'y','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' or (v ? 'yayinda' and jsonb_typeof(v->'yayinda') is distinct from 'boolean')) then return jsonb_build_object('durum','gecersiz'); end if;
  if exists (select 1 from jsonb_array_elements(p_dugumler) d(v) group by v->>'id' having count(*)>1) then return jsonb_build_object('durum','gecersiz'); end if;
  if exists (select 1 from jsonb_array_elements(p_dugumler) d(v) where (v->>'x')::numeric not between 0 and 1000 or (v->>'y')::numeric not between 0 and 1000) then return jsonb_build_object('durum','gecersiz'); end if;
  if exists (select 1 from jsonb_array_elements(p_baglar) b(v) where jsonb_typeof(v) is distinct from 'object' or coalesce(v->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(v->>'kaynak','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(v->>'hedef','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(v->>'kaynak','')=coalesce(v->>'hedef','') or coalesce(v->>'tur','') not in ('akrabalik','dusmanlik','müttefiklik','mekan','zaman','ozel') or char_length(coalesce(v->>'etiket',''))>80 or (v->>'tur'='ozel' and char_length(btrim(coalesce(v->>'etiket',''))) not between 1 and 80)) then return jsonb_build_object('durum','gecersiz'); end if;
  if exists (select 1 from jsonb_array_elements(p_baglar) b(v) group by v->>'id' having count(*)>1) or exists (select 1 from jsonb_array_elements(p_baglar) b(v) where not exists (select 1 from jsonb_array_elements(p_dugumler) d(n) where d.n->>'id'=b.v->>'kaynak') or not exists (select 1 from jsonb_array_elements(p_dugumler) d(n) where d.n->>'id'=b.v->>'hedef')) then return jsonb_build_object('durum','gecersiz'); end if;

  asil := public.evren_gorsel_yetki_kontrol(evren);
  insert into public.evren_gorsel_alanlari(evren_id,sahibi,herkese_acik) values(evren,asil,coalesce(p_herkese_acik,false))
  on conflict (evren_id) do update set herkese_acik=excluded.herkese_acik,guncelleme=now() where public.evren_gorsel_alanlari.sahibi=excluded.sahibi;
  if not exists (select 1 from public.evren_gorsel_alanlari where evren_id=evren and sahibi=asil) then raise exception 'evren için yetki yok'; end if;
  delete from public.evren_harita_baglari where sahibi=asil and evren_id=evren;
  delete from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren;
  insert into public.evren_harita_dugumleri(sahibi,evren_id,id,tip,baslik,aciklama,x,y,yayinda,varlik_id)
  select asil,evren,(v->>'id')::uuid,v->>'tip',btrim(v->>'baslik'),coalesce(v->>'aciklama',''),(v->>'x')::numeric,(v->>'y')::numeric,coalesce((v->>'yayinda')::boolean,false),nullif(v->>'varlik_id','')::uuid
  from jsonb_array_elements(p_dugumler) d(v);
  insert into public.evren_harita_baglari(sahibi,evren_id,id,kaynak,hedef,tur,etiket)
  select asil,evren,(v->>'id')::uuid,(v->>'kaynak')::uuid,(v->>'hedef')::uuid,v->>'tur',coalesce(v->>'etiket','')
  from jsonb_array_elements(p_baglar) b(v);
  return jsonb_build_object('durum','tamam','dugum',jsonb_array_length(p_dugumler),'bag',jsonb_array_length(p_baglar));
end;
$$;
create or replace function public.evren_zaman_cizelgesi_yukle(p_evren_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); uid uuid:=auth.uid(); asil uuid; herkese boolean:=false; duzenleyebilir boolean:=false;
begin
  if char_length(evren) not between 1 and 80 then return jsonb_build_object('durum','gecersiz','olaylar','[]'::jsonb,'baglar','[]'::jsonb); end if;
  select sahibi,herkese_acik into asil,herkese from public.evren_gorsel_alanlari where evren_id=evren;
  if not found then return jsonb_build_object('durum','tamam','duzenleyebilir',uid is not null,'olaylar','[]'::jsonb,'baglar','[]'::jsonb); end if;
  duzenleyebilir:=uid is not null and (uid=asil or (exists(select 1 from public.ortak_evrenler o where o.id=evren and o.sahip=asil) and public.ortak_uye_mi(evren)));
  if not duzenleyebilir and not herkese then return jsonb_build_object('durum','yok','olaylar','[]'::jsonb,'baglar','[]'::jsonb); end if;
  return jsonb_build_object('durum','tamam','duzenleyebilir',duzenleyebilir,
    'olaylar',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'zaman',q.zaman,'baslik',q.baslik,'aciklama',q.aciklama,'tur',q.tur,'sira',q.sira,'durum',q.durum,'varlik_id',q.varlik_id) order by q.sira,q.zaman,q.olusturma) from (select id,zaman,baslik,aciklama,tur,sira,durum,varlik_id,olusturma from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren and (duzenleyebilir or durum='yayinda') order by sira,zaman,olusturma limit 500) q),'[]'::jsonb),
    'baglar',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'kaynak',q.kaynak,'hedef',q.hedef,'etiket',q.etiket) order by q.olusturma,q.id) from (select b.id,b.kaynak,b.hedef,b.etiket,b.olusturma from public.evren_zaman_baglari b where b.sahibi=asil and b.evren_id=evren and (duzenleyebilir or (exists(select 1 from public.evren_zaman_olaylari a where a.sahibi=b.sahibi and a.evren_id=b.evren_id and a.id=b.kaynak and a.durum='yayinda') and exists(select 1 from public.evren_zaman_olaylari z where z.sahibi=b.sahibi and z.evren_id=b.evren_id and z.id=b.hedef and z.durum='yayinda'))) order by b.olusturma,b.id limit 500) q),'[]'::jsonb));
end;
$$;

notify pgrst, 'reload schema';
