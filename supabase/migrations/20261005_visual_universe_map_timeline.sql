-- TentiforApp 6.3.8 — görsel evren haritası ve düzenlenebilir zaman çizelgesi
create table if not exists public.evren_gorsel_alanlari (
  evren_id text primary key check (char_length(btrim(evren_id)) between 1 and 80),
  sahibi uuid not null references auth.users(id) on delete cascade,
  herkese_acik boolean not null default false,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (evren_id, sahibi)
);

create table if not exists public.evren_harita_dugumleri (
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null,
  id uuid not null default gen_random_uuid(),
  tip text not null check (tip in ('karakter','mekan','olay','gezegen','kavram')),
  baslik text not null check (char_length(btrim(baslik)) between 1 and 120),
  aciklama text not null default '' check (char_length(aciklama) <= 600),
  x numeric(8,2) not null default 100 check (x between 0 and 1000),
  y numeric(8,2) not null default 100 check (y between 0 and 1000),
  yayinda boolean not null default false,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  primary key (sahibi, evren_id, id),
  foreign key (evren_id, sahibi) references public.evren_gorsel_alanlari(evren_id, sahibi) on delete cascade
);
create index if not exists evren_harita_dugumleri_sahip_idx on public.evren_harita_dugumleri (sahibi, evren_id, guncelleme desc);

create table if not exists public.evren_harita_baglari (
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null,
  id uuid not null default gen_random_uuid(),
  kaynak uuid not null,
  hedef uuid not null,
  tur text not null check (tur in ('akrabalik','dusmanlik','müttefiklik','mekan','zaman','ozel')),
  etiket text not null default '' check (char_length(etiket) <= 80),
  olusturma timestamptz not null default now(),
  primary key (sahibi, evren_id, id),
  check (kaynak <> hedef),
  check (tur <> 'ozel' or char_length(btrim(etiket)) between 1 and 80),
  foreign key (evren_id, sahibi) references public.evren_gorsel_alanlari(evren_id, sahibi) on delete cascade,
  foreign key (sahibi, evren_id, kaynak) references public.evren_harita_dugumleri(sahibi, evren_id, id) on delete cascade,
  foreign key (sahibi, evren_id, hedef) references public.evren_harita_dugumleri(sahibi, evren_id, id) on delete cascade
);
create index if not exists evren_harita_baglari_sahip_idx on public.evren_harita_baglari (sahibi, evren_id);

create table if not exists public.evren_zaman_olaylari (
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null,
  id uuid not null default gen_random_uuid(),
  zaman text not null check (char_length(btrim(zaman)) between 1 and 60),
  baslik text not null check (char_length(btrim(baslik)) between 1 and 160),
  aciklama text not null default '' check (char_length(aciklama) <= 600),
  tur text not null default 'olay' check (tur in ('olay','donem','savas','dogum','olum','donum')),
  sira integer not null default 0 check (sira between 0 and 100000),
  durum text not null default 'taslak' check (durum in ('taslak','yayinda')),
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  primary key (sahibi, evren_id, id),
  foreign key (evren_id, sahibi) references public.evren_gorsel_alanlari(evren_id, sahibi) on delete cascade
);
create index if not exists evren_zaman_olaylari_siralama_idx on public.evren_zaman_olaylari (sahibi, evren_id, sira, zaman);

create table if not exists public.evren_zaman_baglari (
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null,
  id uuid not null default gen_random_uuid(),
  kaynak uuid not null,
  hedef uuid not null,
  etiket text not null default '' check (char_length(etiket) <= 80),
  olusturma timestamptz not null default now(),
  primary key (sahibi, evren_id, id),
  check (kaynak <> hedef),
  foreign key (evren_id, sahibi) references public.evren_gorsel_alanlari(evren_id, sahibi) on delete cascade,
  foreign key (sahibi, evren_id, kaynak) references public.evren_zaman_olaylari(sahibi, evren_id, id) on delete cascade,
  foreign key (sahibi, evren_id, hedef) references public.evren_zaman_olaylari(sahibi, evren_id, id) on delete cascade
);
create index if not exists evren_zaman_baglari_sahip_idx on public.evren_zaman_baglari (sahibi, evren_id);

alter table public.evren_gorsel_alanlari enable row level security;
alter table public.evren_harita_dugumleri enable row level security;
alter table public.evren_harita_baglari enable row level security;
alter table public.evren_zaman_olaylari enable row level security;
alter table public.evren_zaman_baglari enable row level security;
revoke all on public.evren_gorsel_alanlari, public.evren_harita_dugumleri, public.evren_harita_baglari, public.evren_zaman_olaylari, public.evren_zaman_baglari from public, anon, authenticated;

-- İstemciden gelen sahip bilgisi kullanılmaz. Bilinen yayın/taslak/ortak evren sahipleri
-- mevcut kaynak tablolarıyla doğrulanır; yeni yerel evrenin ilk kaydı auth.uid() adına ayrılır.
create or replace function public.evren_gorsel_yetki_kontrol(p_evren_id text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  evren text := btrim(coalesce(p_evren_id, ''));
  asil uuid;
  kayit_sahibi uuid;
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  if char_length(evren) not between 1 and 80 then raise exception 'geçersiz evren'; end if;
  select kullanici into asil from public.evren_sahipleri where slug = evren;
  if found then
    if asil <> uid and not (exists (select 1 from public.ortak_evrenler o where o.id = evren and o.sahip = asil) and public.ortak_uye_mi(evren)) then raise exception 'evren için yetki yok'; end if;
  else
    select sahip into asil from public.ortak_evrenler where id = evren;
    if found then
      if uid <> asil and not public.ortak_uye_mi(evren) then raise exception 'evren için yetki yok'; end if;
    else
      select b.gonderen into asil
      from public.yayindaki_evrenler y left join public.basvurular b on b.id = y.basvuru
      where y.slug = evren;
      if found then
        if asil is null or asil <> uid then raise exception 'evren için yetki yok'; end if;
      elsif exists (select 1 from public.evren_taslaklari d where d.evren_id = evren and d.sahibi <> uid)
            and not exists (select 1 from public.evren_taslaklari d where d.evren_id = evren and d.sahibi = uid) then
        raise exception 'evren için yetki yok';
      elsif exists (select 1 from public.evren_taslaklari d where d.evren_id = evren and d.sahibi = uid) then
        asil := uid;
      else
        asil := null;
      end if;
    end if;
  end if;

  insert into public.evren_gorsel_alanlari(evren_id,sahibi) values(evren,coalesce(asil,uid)) on conflict(evren_id) do nothing;
  select sahibi into kayit_sahibi from public.evren_gorsel_alanlari where evren_id = evren for update;
  if found then
    if asil is not null and asil <> kayit_sahibi then raise exception 'evren için yetki yok'; end if;
    if kayit_sahibi = uid then return kayit_sahibi; end if;
    if exists (select 1 from public.ortak_evrenler o where o.id = evren and o.sahip = kayit_sahibi)
       and public.ortak_uye_mi(evren) then return kayit_sahibi; end if;
    raise exception 'evren için yetki yok';
  end if;
  return coalesce(asil, uid);
end;
$$;
revoke all on function public.evren_gorsel_yetki_kontrol(text) from public, anon, authenticated;

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
    'dugumler',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'tip',q.tip,'baslik',q.baslik,'aciklama',q.aciklama,'x',q.x,'y',q.y,'yayinda',q.yayinda) order by q.olusturma,q.id) from (select id,tip,baslik,aciklama,x,y,yayinda,olusturma from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren and (duzenleyebilir or (herkese and yayinda)) order by olusturma,id limit 150) q),'[]'::jsonb),
    'baglar',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'kaynak',q.kaynak,'hedef',q.hedef,'tur',q.tur,'etiket',q.etiket) order by q.olusturma,q.id) from (select b.id,b.kaynak,b.hedef,b.tur,b.etiket,b.olusturma from public.evren_harita_baglari b where b.sahibi=asil and b.evren_id=evren and (duzenleyebilir or (herkese and exists(select 1 from public.evren_harita_dugumleri a where a.sahibi=b.sahibi and a.evren_id=b.evren_id and a.id=b.kaynak and a.yayinda) and exists(select 1 from public.evren_harita_dugumleri z where z.sahibi=b.sahibi and z.evren_id=b.evren_id and z.id=b.hedef and z.yayinda))) order by b.olusturma,b.id limit 300) q),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.evren_gorsel_haritayi_yukle(text) from public;
grant execute on function public.evren_gorsel_haritayi_yukle(text) to anon, authenticated;

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
  insert into public.evren_harita_dugumleri(sahibi,evren_id,id,tip,baslik,aciklama,x,y,yayinda)
  select asil,evren,(v->>'id')::uuid,v->>'tip',btrim(v->>'baslik'),coalesce(v->>'aciklama',''),(v->>'x')::numeric,(v->>'y')::numeric,coalesce((v->>'yayinda')::boolean,false)
  from jsonb_array_elements(p_dugumler) d(v);
  insert into public.evren_harita_baglari(sahibi,evren_id,id,kaynak,hedef,tur,etiket)
  select asil,evren,(v->>'id')::uuid,(v->>'kaynak')::uuid,(v->>'hedef')::uuid,v->>'tur',coalesce(v->>'etiket','')
  from jsonb_array_elements(p_baglar) b(v);
  return jsonb_build_object('durum','tamam','dugum',jsonb_array_length(p_dugumler),'bag',jsonb_array_length(p_baglar));
end;
$$;
revoke all on function public.evren_gorsel_haritayi_kaydet(text,jsonb,jsonb,boolean) from public, anon;
grant execute on function public.evren_gorsel_haritayi_kaydet(text,jsonb,jsonb,boolean) to authenticated;

create or replace function public.evren_gorsel_dugumu_guncelle(p_evren_id text,p_dugum jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); asil uuid; v_id uuid; etkilenen int;
begin
  if jsonb_typeof(p_dugum) is distinct from 'object' or pg_column_size(p_dugum)>4096 or coalesce(p_dugum->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(p_dugum->>'tip','') not in ('karakter','mekan','olay','gezegen','kavram') or char_length(btrim(coalesce(p_dugum->>'baslik',''))) not between 1 and 120 or char_length(coalesce(p_dugum->>'aciklama',''))>600 or coalesce(p_dugum->>'x','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' or coalesce(p_dugum->>'y','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' or (p_dugum ? 'yayinda' and jsonb_typeof(p_dugum->'yayinda') is distinct from 'boolean') then return jsonb_build_object('durum','gecersiz'); end if;
  if (p_dugum->>'x')::numeric not between 0 and 1000 or (p_dugum->>'y')::numeric not between 0 and 1000 then return jsonb_build_object('durum','gecersiz'); end if;
  evren := btrim(evren); asil:=public.evren_gorsel_yetki_kontrol(evren); v_id:=(p_dugum->>'id')::uuid;
  if not exists(select 1 from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren and id=v_id) and (select count(*) from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren)>=150 then return jsonb_build_object('durum','sinir'); end if;
  insert into public.evren_gorsel_alanlari(evren_id,sahibi) values(evren,asil) on conflict(evren_id) do nothing;
  if not exists(select 1 from public.evren_gorsel_alanlari where evren_id=evren and sahibi=asil) then raise exception 'evren için yetki yok'; end if;
  insert into public.evren_harita_dugumleri(sahibi,evren_id,id,tip,baslik,aciklama,x,y,yayinda) values(asil,evren,v_id,p_dugum->>'tip',btrim(p_dugum->>'baslik'),coalesce(p_dugum->>'aciklama',''),(p_dugum->>'x')::numeric,(p_dugum->>'y')::numeric,coalesce((p_dugum->>'yayinda')::boolean,false)) on conflict(sahibi,evren_id,id) do update set tip=excluded.tip,baslik=excluded.baslik,aciklama=excluded.aciklama,x=excluded.x,y=excluded.y,yayinda=excluded.yayinda,guncelleme=now();
  return jsonb_build_object('durum','tamam','id',v_id);
end;
$$;
revoke all on function public.evren_gorsel_dugumu_guncelle(text,jsonb) from public, anon;
grant execute on function public.evren_gorsel_dugumu_guncelle(text,jsonb) to authenticated;

create or replace function public.evren_gorsel_bagi_degistir(p_evren_id text,p_bag jsonb,p_sil boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); asil uuid; v_id uuid;
begin
  if jsonb_typeof(p_bag) is distinct from 'object' or pg_column_size(p_bag)>2048 or coalesce(p_bag->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return jsonb_build_object('durum','gecersiz'); end if;
  asil:=public.evren_gorsel_yetki_kontrol(evren); v_id:=(p_bag->>'id')::uuid;
  if coalesce(p_sil,false) then delete from public.evren_harita_baglari where sahibi=asil and evren_id=evren and id=v_id; return jsonb_build_object('durum','tamam','silindi',found); end if;
  if coalesce(p_bag->>'kaynak','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(p_bag->>'hedef','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or p_bag->>'kaynak'=p_bag->>'hedef' or coalesce(p_bag->>'tur','') not in ('akrabalik','dusmanlik','müttefiklik','mekan','zaman','ozel') or char_length(coalesce(p_bag->>'etiket',''))>80 or (p_bag->>'tur'='ozel' and char_length(btrim(coalesce(p_bag->>'etiket',''))) not between 1 and 80) then return jsonb_build_object('durum','gecersiz'); end if;
  if not exists(select 1 from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren and id=(p_bag->>'kaynak')::uuid) or not exists(select 1 from public.evren_harita_dugumleri where sahibi=asil and evren_id=evren and id=(p_bag->>'hedef')::uuid) then return jsonb_build_object('durum','gecersiz'); end if;
  if not exists(select 1 from public.evren_harita_baglari where sahibi=asil and evren_id=evren and id=v_id) and (select count(*) from public.evren_harita_baglari where sahibi=asil and evren_id=evren)>=300 then return jsonb_build_object('durum','sinir'); end if;
  insert into public.evren_gorsel_alanlari(evren_id,sahibi) values(evren,asil) on conflict(evren_id) do nothing;
  if not exists(select 1 from public.evren_gorsel_alanlari where evren_id=evren and sahibi=asil) then raise exception 'evren için yetki yok'; end if;
  insert into public.evren_harita_baglari(sahibi,evren_id,id,kaynak,hedef,tur,etiket) values(asil,evren,v_id,(p_bag->>'kaynak')::uuid,(p_bag->>'hedef')::uuid,p_bag->>'tur',coalesce(p_bag->>'etiket','')) on conflict(sahibi,evren_id,id) do update set kaynak=excluded.kaynak,hedef=excluded.hedef,tur=excluded.tur,etiket=excluded.etiket;
  return jsonb_build_object('durum','tamam','id',v_id);
end;
$$;
revoke all on function public.evren_gorsel_bagi_degistir(text,jsonb,boolean) from public, anon;
grant execute on function public.evren_gorsel_bagi_degistir(text,jsonb,boolean) to authenticated;

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
    'olaylar',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'zaman',q.zaman,'baslik',q.baslik,'aciklama',q.aciklama,'tur',q.tur,'sira',q.sira,'durum',q.durum) order by q.sira,q.zaman,q.olusturma) from (select id,zaman,baslik,aciklama,tur,sira,durum,olusturma from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren and (duzenleyebilir or durum='yayinda') order by sira,zaman,olusturma limit 500) q),'[]'::jsonb),
    'baglar',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'kaynak',q.kaynak,'hedef',q.hedef,'etiket',q.etiket) order by q.olusturma,q.id) from (select b.id,b.kaynak,b.hedef,b.etiket,b.olusturma from public.evren_zaman_baglari b where b.sahibi=asil and b.evren_id=evren and (duzenleyebilir or (exists(select 1 from public.evren_zaman_olaylari a where a.sahibi=b.sahibi and a.evren_id=b.evren_id and a.id=b.kaynak and a.durum='yayinda') and exists(select 1 from public.evren_zaman_olaylari z where z.sahibi=b.sahibi and z.evren_id=b.evren_id and z.id=b.hedef and z.durum='yayinda'))) order by b.olusturma,b.id limit 500) q),'[]'::jsonb));
end;
$$;
revoke all on function public.evren_zaman_cizelgesi_yukle(text) from public;
grant execute on function public.evren_zaman_cizelgesi_yukle(text) to anon, authenticated;

create or replace function public.evren_zaman_olay_kaydet(p_evren_id text,p_olay jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); asil uuid; v_id uuid; yeni boolean;
begin
  if jsonb_typeof(p_olay) is distinct from 'object' or pg_column_size(p_olay)>4096 or char_length(btrim(coalesce(p_olay->>'zaman',''))) not between 1 and 60 or char_length(btrim(coalesce(p_olay->>'baslik',''))) not between 1 and 160 or char_length(coalesce(p_olay->>'aciklama',''))>600 or coalesce(p_olay->>'tur','olay') not in ('olay','donem','savas','dogum','olum','donum') or coalesce(p_olay->>'durum','taslak') not in ('taslak','yayinda') or coalesce(p_olay->>'sira','0') !~ '^[0-9]{1,6}$' or (p_olay ? 'id' and coalesce(p_olay->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then return jsonb_build_object('durum','gecersiz'); end if;
  if (coalesce(p_olay->>'sira','0'))::integer>100000 then return jsonb_build_object('durum','gecersiz'); end if;
  asil:=public.evren_gorsel_yetki_kontrol(evren); v_id:=case when p_olay ? 'id' then (p_olay->>'id')::uuid else gen_random_uuid() end;
  yeni:=not exists(select 1 from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren and id=v_id);
  if yeni and (select count(*) from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren)>=500 then return jsonb_build_object('durum','sinir'); end if;
  insert into public.evren_gorsel_alanlari(evren_id,sahibi) values(evren,asil) on conflict(evren_id) do nothing;
  if not exists(select 1 from public.evren_gorsel_alanlari where evren_id=evren and sahibi=asil) then raise exception 'evren için yetki yok'; end if;
  insert into public.evren_zaman_olaylari(sahibi,evren_id,id,zaman,baslik,aciklama,tur,sira,durum) values(asil,evren,v_id,btrim(p_olay->>'zaman'),btrim(p_olay->>'baslik'),coalesce(p_olay->>'aciklama',''),coalesce(p_olay->>'tur','olay'),coalesce((p_olay->>'sira')::integer,0),coalesce(p_olay->>'durum','taslak')) on conflict(sahibi,evren_id,id) do update set zaman=excluded.zaman,baslik=excluded.baslik,aciklama=excluded.aciklama,tur=excluded.tur,sira=excluded.sira,durum=excluded.durum,guncelleme=now();
  return jsonb_build_object('durum','tamam','id',v_id);
end;
$$;
revoke all on function public.evren_zaman_olay_kaydet(text,jsonb) from public, anon;
grant execute on function public.evren_zaman_olay_kaydet(text,jsonb) to authenticated;

create or replace function public.evren_zaman_olay_sil(p_evren_id text,p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); asil uuid;
begin
  if p_id is null then return jsonb_build_object('durum','gecersiz'); end if;
  asil:=public.evren_gorsel_yetki_kontrol(evren);
  delete from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren and id=p_id;
  return jsonb_build_object('durum','tamam','silindi',found);
end;
$$;
revoke all on function public.evren_zaman_olay_sil(text,uuid) from public, anon;
grant execute on function public.evren_zaman_olay_sil(text,uuid) to authenticated;

create or replace function public.evren_zaman_bagi_degistir(p_evren_id text,p_bag jsonb,p_sil boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evren text:=btrim(coalesce(p_evren_id,'')); asil uuid; v_id uuid;
begin
  if jsonb_typeof(p_bag) is distinct from 'object' or pg_column_size(p_bag)>2048 or coalesce(p_bag->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return jsonb_build_object('durum','gecersiz'); end if;
  asil:=public.evren_gorsel_yetki_kontrol(evren); v_id:=(p_bag->>'id')::uuid;
  if coalesce(p_sil,false) then delete from public.evren_zaman_baglari where sahibi=asil and evren_id=evren and id=v_id; return jsonb_build_object('durum','tamam','silindi',found); end if;
  if coalesce(p_bag->>'kaynak','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(p_bag->>'hedef','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or p_bag->>'kaynak'=p_bag->>'hedef' or char_length(coalesce(p_bag->>'etiket',''))>80 then return jsonb_build_object('durum','gecersiz'); end if;
  if not exists(select 1 from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren and id=(p_bag->>'kaynak')::uuid) or not exists(select 1 from public.evren_zaman_olaylari where sahibi=asil and evren_id=evren and id=(p_bag->>'hedef')::uuid) then return jsonb_build_object('durum','gecersiz'); end if;
  if not exists(select 1 from public.evren_zaman_baglari where sahibi=asil and evren_id=evren and id=v_id) and (select count(*) from public.evren_zaman_baglari where sahibi=asil and evren_id=evren)>=500 then return jsonb_build_object('durum','sinir'); end if;
  insert into public.evren_gorsel_alanlari(evren_id,sahibi) values(evren,asil) on conflict(evren_id) do nothing;
  if not exists(select 1 from public.evren_gorsel_alanlari where evren_id=evren and sahibi=asil) then raise exception 'evren için yetki yok'; end if;
  insert into public.evren_zaman_baglari(sahibi,evren_id,id,kaynak,hedef,etiket) values(asil,evren,v_id,(p_bag->>'kaynak')::uuid,(p_bag->>'hedef')::uuid,coalesce(p_bag->>'etiket','')) on conflict(sahibi,evren_id,id) do update set kaynak=excluded.kaynak,hedef=excluded.hedef,etiket=excluded.etiket;
  return jsonb_build_object('durum','tamam','id',v_id);
end;
$$;
revoke all on function public.evren_zaman_bagi_degistir(text,jsonb,boolean) from public, anon;
grant execute on function public.evren_zaman_bagi_degistir(text,jsonb,boolean) to authenticated;

notify pgrst, 'reload schema';

-- Release marker: all schema objects through 6.3.8 are present.
create or replace function public.kurulum_surumu() returns text
language sql immutable set search_path = '' as $$
  select '6.3.8'::text;
$$;
