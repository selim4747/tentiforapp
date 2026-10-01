-- Ortak evren plan kuralı
-- Her hesap kişisel evren oluşturabilir. Ortak evreni açma/davet etme yalnızca
-- EvrenGezer veya EvrenYazar planına açıktır. EvrenGezer sahibi dahil 2 kişi,
-- EvrenYazar sınırsız kişi kullanabilir.

create or replace function public.ortak_evren_planli_mi(p_kullanici uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = '' as $$
  select public.pro_mu(p_kullanici);
$$;

create or replace function public.ortak_evren_yazar_mi(p_kullanici uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.abonelikler a
    where a.id = p_kullanici
      and a.tip = 'evrenyazar'
      and (a.bitis is null or a.bitis > now())
  ) or coalesce(public.pro_kod_bitis(p_kullanici) > now(), false);
$$;

revoke execute on function public.ortak_evren_planli_mi(uuid), public.ortak_evren_yazar_mi(uuid)
from public, anon, authenticated;

-- Kurucu ortak evren açmadan önce planı server tarafında doğrula.
create or replace function public.ortak_evren_ac(p_id text, p_veri jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.ortak_evrenler;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if not public.ortak_evren_planli_mi(uid) then return jsonb_build_object('durum', 'plan'); end if;
  if p_id !~ '^[\w-]{1,60}$' or jsonb_typeof(p_veri) <> 'object' or pg_column_size(p_veri) > 3000000 then return jsonb_build_object('durum', 'gecersiz'); end if;
  select * into r from public.ortak_evrenler where id = p_id;
  if found and r.sahip <> uid then return jsonb_build_object('durum', 'baskasinin'); end if;
  if (select count(*) from public.ortak_evrenler where sahip = uid) >= 20 and not found then return jsonb_build_object('durum', 'sinir'); end if;
  insert into public.ortak_evrenler (id, sahip, veri, guncelleyen) values (p_id, uid, p_veri, uid)
    on conflict (id) do update set veri = excluded.veri, guncelleme = now(), guncelleyen = uid;
  insert into public.ortak_evren_uyeleri (evren, kullanici, rol) values (p_id, uid, 'sahip') on conflict do nothing;
  return jsonb_build_object('durum', 'tamam', 'guncelleme', (select guncelleme from public.ortak_evrenler where id = p_id));
end;
$$;

-- Davet üretmek de yalnızca planlı kurucuya açık.
create or replace function public.ortak_evren_davet(p_id text, p_ozet text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ortak_evren_planli_mi() then return jsonb_build_object('durum', 'plan'); end if;
  if not exists (select 1 from public.ortak_evrenler where id = p_id and sahip = auth.uid()) then return jsonb_build_object('durum', 'yetki'); end if;
  if p_ozet !~ '^[0-9a-f]{64}$' then return jsonb_build_object('durum', 'gecersiz'); end if;
  if (select count(*) from public.ortak_evren_davetleri where evren = p_id and kullanan is null) >= 20 then return jsonb_build_object('durum', 'sinir'); end if;
  insert into public.ortak_evren_davetleri (ozet, evren) values (p_ozet, p_id) on conflict do nothing;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- EvrenGezer: sahip dahil en fazla 2 kişi. EvrenYazar: sınırsız.
create or replace function public.ortak_evren_katil(p_kod text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d public.ortak_evren_davetleri; e public.ortak_evrenler; mevcut int; limit_kisi int;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if (select count(*) from public.tek_kod_denemeleri where kullanici = uid and zaman > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('durum', 'sinir');
  end if;
  select * into d from public.ortak_evren_davetleri where ozet = public.ortak_davet_ozet(p_kod) for update;
  if not found then
    insert into public.tek_kod_denemeleri (kullanici) values (uid);
    return jsonb_build_object('durum', 'yok');
  end if;
  if d.kullanan is not null and d.kullanan <> uid then return jsonb_build_object('durum', 'dolu'); end if;
  select * into e from public.ortak_evrenler where id = d.evren;
  if not public.ortak_evren_planli_mi(e.sahip) then return jsonb_build_object('durum', 'kapali'); end if;
  mevcut := (select count(*) from public.ortak_evren_uyeleri where evren = e.id);
  limit_kisi := case when public.ortak_evren_yazar_mi(e.sahip) then 2147483647 else 2 end;
  if mevcut >= limit_kisi and not exists (select 1 from public.ortak_evren_uyeleri where evren = e.id and kullanici = uid) then
    return jsonb_build_object('durum', 'takim_siniri');
  end if;
  update public.ortak_evren_davetleri set kullanan = uid where ozet = d.ozet;
  insert into public.ortak_evren_uyeleri (evren, kullanici) values (d.evren, uid) on conflict do nothing;
  return jsonb_build_object('durum', 'tamam', 'id', e.id, 'veri', e.veri, 'guncelleme', e.guncelleme);
end;
$$;

revoke execute on function public.ortak_evren_ac(text, jsonb), public.ortak_evren_davet(text, text), public.ortak_evren_katil(text)
from public, anon;
grant execute on function public.ortak_evren_ac(text, jsonb), public.ortak_evren_davet(text, text), public.ortak_evren_katil(text)
to authenticated;
