-- TentiforApp 6.3.0 — keşif, arşivci profili, takip, gizlilik ve raflar
alter table public.profiller add column if not exists profil_arama_gorunur boolean not null default true;
alter table public.profiller add column if not exists profil_icerik_gorunur boolean not null default true;
alter table public.profiller add column if not exists takip_listesi_gorunur boolean not null default true;

-- View yalnızca public profil sözleşmesini taşır; özel ilerleme ve e-posta taşımaz.
create or replace view public.public_profiller as
select id, kullanici_adi, gorunen_ad, gorsel, tentifor_adi, hakkinda, vitrin,
       olusturma, guncelleme, profil_arama_gorunur, profil_icerik_gorunur, takip_listesi_gorunur
from public.profiller
where coalesce(profil_arama_gorunur, true);
grant select on public.public_profiller to anon, authenticated;

create index if not exists profiller_kullanici_adi_prefix_idx
  on public.profiller (lower(kullanici_adi));
create index if not exists yayindaki_evrenler_yayin_tarihi_idx
  on public.yayindaki_evrenler (yayin_tarihi desc);

-- Kullanıcı araması: e-posta, id ve özel alanlar hiçbir zaman dönmez.
create or replace function public.kullanici_ara(p_sorgu text, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_sorgu, ''))); n int := greatest(1, least(coalesce(p_limit, 20), 20));
begin
  if char_length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'tur','kullanici','kullanici_adi',p.kullanici_adi,'gorunen_ad',p.gorunen_ad,
    'gorsel',p.gorsel,'tentifor_adi',p.tentifor_adi,
    'takip_ediliyor',exists(select 1 from public.takipler t where t.takip_eden = auth.uid() and t.takip_edilen = p.id)
  ) order by case when lower(p.kullanici_adi)=q then 0 when lower(p.kullanici_adi) like q||'%' then 1 else 2 end, p.kullanici_adi)
  from public.profiller p left join public.istatistikler s on s.id=p.id
  where p.kullanici_adi is not null and coalesce(p.profil_arama_gorunur,true)
    and not coalesce(s.gizli or s.askida or s.engelli,false)
    and not exists (select 1 from public.kullanici_engelleri e where (e.engelleyen=auth.uid() and e.engellenen=p.id) or (e.engelleyen=p.id and e.engellenen=auth.uid()))
    and (lower(p.kullanici_adi) like '%'||q||'%' or lower(coalesce(p.gorunen_ad,'')) like '%'||q||'%' or lower(coalesce(p.tentifor_adi,'')) like '%'||q||'%')
  limit n), '[]'::jsonb);
end;
$$;
revoke all on function public.kullanici_ara(text,int) from public;
grant execute on function public.kullanici_ara(text,int) to anon, authenticated;

-- Evrensel arama: kullanıcılar ve yayınlanmış fan evrenleri. Özel/taslak içerik yoktur.
create or replace function public.kesif_ara(p_sorgu text, p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_sorgu, ''))); n int := greatest(1, least(coalesce(p_limit, 30), 30)); sonuc jsonb;
begin
  if char_length(q) < 2 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(x order by x->>'tur', x->>'baslik'), '[]'::jsonb) into sonuc from (
    (select jsonb_build_object('tur','kullanici','id',p.kullanici_adi,'baslik',coalesce(nullif(p.gorunen_ad,''),p.kullanici_adi),'alt','@'||p.kullanici_adi,'adres','#/u/'||p.kullanici_adi) x
    from public.profiller p left join public.istatistikler s on s.id=p.id
    where p.kullanici_adi is not null and coalesce(p.profil_arama_gorunur,true)
      and not coalesce(s.gizli or s.askida or s.engelli,false)
      and not exists (select 1 from public.kullanici_engelleri e where (e.engelleyen=auth.uid() and e.engellenen=p.id) or (e.engelleyen=p.id and e.engellenen=auth.uid()))
      and (lower(p.kullanici_adi) like '%'||q||'%' or lower(coalesce(p.gorunen_ad,'')) like '%'||q||'%' or lower(coalesce(p.tentifor_adi,'')) like '%'||q||'%')
    limit n)
    union all
    (select jsonb_build_object('tur','evren','id',y.slug,'baslik',y.baslik,'alt',left(y.ozet,160),'adres','#/ev/fan/'||y.slug) x
    from public.yayindaki_evrenler y
    left join public.basvurular b on b.id=y.basvuru
    left join public.profiller p on p.id=b.gonderen
    left join public.istatistikler s on s.id=p.id
    where lower(y.baslik||' '||y.ozet) like '%'||q||'%'
      and (p.id is null or (coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)))
    limit n)
  ) x;
  return sonuc;
end;
$$;
revoke all on function public.kesif_ara(text,int) from public;
grant execute on function public.kesif_ara(text,int) to anon, authenticated;

-- Public profil özeti ve yayınlanmış fan evrenleri tek güvenli RPC'den alınır.
create or replace function public.public_kullanici_profili(p_kullanici_adi text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.profiller; s public.istatistikler; uid uuid := auth.uid();
begin
  select * into p from public.profiller where lower(kullanici_adi)=lower(btrim(p_kullanici_adi)) and coalesce(profil_arama_gorunur,true);
  if p.id is null then return null; end if;
  select * into s from public.istatistikler where id=p.id;
  if coalesce(s.gizli or s.askida or s.engelli,false) then return null; end if;
  if exists (select 1 from public.kullanici_engelleri e where (e.engelleyen=uid and e.engellenen=p.id) or (e.engelleyen=p.id and e.engellenen=uid)) then return null; end if;
  return jsonb_build_object(
    'profil', jsonb_build_object('kullanici_adi',p.kullanici_adi,'gorunen_ad',p.gorunen_ad,'gorsel',p.gorsel,'tentifor_adi',p.tentifor_adi,'hakkinda',p.hakkinda,'vitrin',p.vitrin,'olusturma',p.olusturma,'profil_icerik_gorunur',coalesce(p.profil_icerik_gorunur,true)),
    'takip_ediliyor', exists(select 1 from public.takipler t where t.takip_eden=uid and t.takip_edilen=p.id),
    'takipci', (select count(*) from public.takipler where takip_edilen=p.id),
    'takip', (select count(*) from public.takipler where takip_eden=p.id),
    'evrenler', case when coalesce(p.profil_icerik_gorunur,true) then coalesce((select jsonb_agg(jsonb_build_object('id',y.slug,'baslik',y.baslik,'ozet',y.ozet,'tarih',y.yayin_tarihi) order by y.yayin_tarihi desc) from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru where b.gonderen=p.id), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;
revoke all on function public.public_kullanici_profili(text) from public;
grant execute on function public.public_kullanici_profili(text) to anon, authenticated;

-- Engelleme: arama/profil/takip RPC'leri için ortak kaynak.
create table if not exists public.kullanici_engelleri (
  engelleyen uuid not null references auth.users(id) on delete cascade,
  engellenen uuid not null references auth.users(id) on delete cascade,
  zaman timestamptz not null default now(),
  primary key (engelleyen, engellenen),
  check (engelleyen <> engellenen)
);
alter table public.kullanici_engelleri enable row level security;
revoke all on public.kullanici_engelleri from anon, authenticated;
create or replace function public.kullanici_engelle(p_kullanici_adi text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); hedef uuid; mevcut boolean;
begin
  if uid is null then return false; end if;
  select id into hedef from public.profiller where lower(kullanici_adi)=lower(btrim(p_kullanici_adi));
  if hedef is null or hedef=uid then return false; end if;
  select exists(select 1 from public.kullanici_engelleri where engelleyen=uid and engellenen=hedef) into mevcut;
  if mevcut then delete from public.kullanici_engelleri where engelleyen=uid and engellenen=hedef; else insert into public.kullanici_engelleri values(uid,hedef); delete from public.takipler where takip_eden=uid and takip_edilen=hedef; end if;
  return not mevcut;
end;
$$;
revoke all on function public.kullanici_engelle(text) from public, anon;
grant execute on function public.kullanici_engelle(text) to authenticated;
-- Takip RPC'si engel ilişkilerini iki yönde de uygular.
create or replace function public.takip_et(p_ad text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); hedef uuid; mevcut boolean;
begin
  if uid is null then return false; end if;
  select id into hedef from public.profiller where kullanici_adi = lower(btrim(p_ad));
  if hedef is null or hedef = uid or exists(select 1 from public.kullanici_engelleri e where (e.engelleyen=uid and e.engellenen=hedef) or (e.engelleyen=hedef and e.engellenen=uid)) then return false; end if;
  select exists(select 1 from public.takipler where takip_eden=uid and takip_edilen=hedef) into mevcut;
  if mevcut then delete from public.takipler where takip_eden=uid and takip_edilen=hedef; else if (select count(*) from public.takipler where takip_eden=uid) >= 500 then return false; end if; insert into public.takipler(takip_eden,takip_edilen) values(uid,hedef); end if;
  return not mevcut;
end;
$$;
revoke all on function public.takip_et(text) from public, anon;
grant execute on function public.takip_et(text) to authenticated;


-- Kişisel raf temeli: içerik adresi ve başlık kullanıcı hesabına bağlıdır.
create table if not exists public.kisisel_raf (
  kullanici uuid not null references auth.users(id) on delete cascade,
  raf text not null check (raf ~ '^[a-z0-9_-]{1,40}$'),
  adres text not null check (char_length(adres) between 2 and 240),
  baslik text not null default '' check (char_length(baslik) <= 160),
  eklenme timestamptz not null default now(),
  primary key (kullanici, raf, adres)
);
alter table public.kisisel_raf enable row level security;
revoke all on public.kisisel_raf from anon, authenticated;
create or replace function public.raf_kaydet(p_raf text,p_adres text,p_baslik text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('durum','giris'); end if;
  if p_raf !~ '^[a-z0-9_-]{1,40}$' or p_adres is null or char_length(p_adres) < 2 then return jsonb_build_object('durum','gecersiz'); end if;
  insert into public.kisisel_raf(kullanici,raf,adres,baslik) values(auth.uid(),p_raf,left(p_adres,240),left(coalesce(p_baslik,''),160)) on conflict do nothing;
  return jsonb_build_object('durum','tamam');
end;
$$;
revoke all on function public.raf_kaydet(text,text,text) from public, anon;
grant execute on function public.raf_kaydet(text,text,text) to authenticated;
notify pgrst, 'reload schema';
