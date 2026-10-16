-- 6.4.6.0 — Sunucu tarafı EvrenGezer Parası (EG) cüzdanı ve plan satın alımı.
-- EG, evren-özel Eçka'dan bağımsızdır. Eski bulut senkron bakiyesi, yalnızca
-- service-role kullanan evren-gezer-eg-aktar Edge Function’ıyla bir defa içe alınır.

create table if not exists public.evren_gezer_cuzdanlari (
  kullanici uuid primary key references auth.users(id) on delete cascade,
  bakiye bigint not null default 0 check (bakiye >= 0),
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);

create table if not exists public.evren_gezer_islemleri (
  id uuid primary key default gen_random_uuid(),
  kullanici uuid not null references auth.users(id) on delete cascade,
  istek_id uuid not null unique,
  tur text not null check (tur in ('plan_satin_alma', 'bakiye_yukleme')),
  miktar bigint not null check (miktar <> 0),
  bakiye_son bigint not null check (bakiye_son >= 0),
  plan text check (plan in ('evrengezer', 'evrenyazar')),
  sure_gun int check (sure_gun is null or sure_gun between 1 and 3650),
  kaynak text not null,
  abonelik_bitis timestamptz,
  olusturma timestamptz not null default now()
);
create index if not exists evren_gezer_islemleri_kullanici_zaman_idx
  on public.evren_gezer_islemleri (kullanici, olusturma desc);

create table if not exists public.evren_gezer_aktarimlari (
  kullanici uuid primary key references auth.users(id) on delete cascade,
  eski_bakiye bigint not null check (eski_bakiye >= 0),
  aktarilan_bakiye bigint not null check (aktarilan_bakiye >= 0),
  aktarim_zamani timestamptz not null default now()
);

alter table public.evren_gezer_cuzdanlari enable row level security;
alter table public.evren_gezer_islemleri enable row level security;
alter table public.evren_gezer_aktarimlari enable row level security;
revoke all on public.evren_gezer_cuzdanlari from public, anon, authenticated, service_role;
revoke all on public.evren_gezer_islemleri from public, anon, authenticated, service_role;
revoke all on public.evren_gezer_aktarimlari from public, anon, authenticated, service_role;

create or replace function public.evren_gezer_cuzdanim()
returns jsonb
language plpgsql
stable
security definer
set search_path = '' as $$
declare
  uid uuid := auth.uid();
  bakiye_sunucu bigint;
begin
  if uid is null then
    return jsonb_build_object('durum', 'giris');
  end if;
  select c.bakiye into bakiye_sunucu
    from public.evren_gezer_cuzdanlari c where c.kullanici = uid;
  return jsonb_build_object('durum', 'tamam', 'para', 'EG', 'bakiye', coalesce(bakiye_sunucu, 0));
end;
$$;
revoke all on function public.evren_gezer_cuzdanim() from public, anon;
grant execute on function public.evren_gezer_cuzdanim() to authenticated;

create or replace function public.evren_gezer_plan_satin_al(p_plan text, p_istek_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = '' as $$
declare
  uid uuid := auth.uid();
  tip text := lower(btrim(coalesce(p_plan, '')));
  bedel bigint;
  eski_tip text;
  eski_bitis timestamptz;
  kod_bitis timestamptz;
  etkin_tip text;
  yeni_bitis timestamptz;
  bakiye_sunucu bigint;
  onceki public.evren_gezer_islemleri;
begin
  if uid is null then return jsonb_build_object('durum', 'giris'); end if;
  if tip not in ('evrengezer', 'evrenyazar') or p_istek_id is null then
    return jsonb_build_object('durum', 'gecersiz');
  end if;
  bedel := case tip when 'evrengezer' then 250 else 750 end;

  insert into public.evren_gezer_cuzdanlari (kullanici, bakiye)
    values (uid, 0) on conflict (kullanici) do nothing;
  select c.bakiye into bakiye_sunucu
    from public.evren_gezer_cuzdanlari c where c.kullanici = uid for update;

  select * into onceki from public.evren_gezer_islemleri
    where kullanici = uid and istek_id = p_istek_id;
  if found then
    if onceki.tur <> 'plan_satin_alma' or onceki.plan <> tip then
      return jsonb_build_object('durum', 'istek_cakismasi', 'bakiye', bakiye_sunucu);
    end if;
    return jsonb_build_object('durum', 'tamam', 'plan', onceki.plan, 'gun', onceki.sure_gun,
      'bitis', onceki.abonelik_bitis, 'bakiye', bakiye_sunucu, 'tekrar', true);
  end if;

  select a.tip, a.bitis into eski_tip, eski_bitis
    from public.abonelikler a where a.id = uid for update;
  kod_bitis := public.pro_kod_bitis(uid);
  if kod_bitis > now() and tip = 'evrengezer' then
    return jsonb_build_object('durum', 'zaten_aktif', 'bakiye', bakiye_sunucu);
  end if;
  if eski_tip in ('evrengezer', 'evrenyazar') and (eski_bitis is null or eski_bitis > now()) then
    if eski_tip = 'evrenyazar' and tip = 'evrengezer' then
      return jsonb_build_object('durum', 'dusurme_yok', 'bakiye', bakiye_sunucu);
    end if;
    if eski_tip = tip and eski_bitis is null then
      return jsonb_build_object('durum', 'zaten_aktif', 'bakiye', bakiye_sunucu);
    end if;
  end if;
  if bakiye_sunucu < bedel then
    return jsonb_build_object('durum', 'bakiye_yetersiz', 'gerekli', bedel, 'bakiye', bakiye_sunucu);
  end if;

  etkin_tip := case
    when tip = 'evrenyazar' or (eski_tip = 'evrenyazar' and (eski_bitis is null or eski_bitis > now())) then 'evrenyazar'
    else tip
  end;
  yeni_bitis := greatest(coalesce(eski_bitis, now()), coalesce(kod_bitis, now()), now()) + interval '30 days';

  update public.evren_gezer_cuzdanlari
    set bakiye = bakiye - bedel, guncelleme = now()
    where kullanici = uid returning bakiye into bakiye_sunucu;
  insert into public.abonelikler (id, tip, bitis, guncelleme)
    values (uid, etkin_tip, yeni_bitis, now())
    on conflict (id) do update set tip = excluded.tip, bitis = excluded.bitis, guncelleme = now();
  insert into public.evren_gezer_islemleri
    (kullanici, istek_id, tur, miktar, bakiye_son, plan, sure_gun, kaynak, abonelik_bitis)
    values (uid, p_istek_id, 'plan_satin_alma', -bedel, bakiye_sunucu, tip, 30, 'plan_satin_alma', yeni_bitis);

  return jsonb_build_object('durum', 'tamam', 'plan', etkin_tip, 'gun', 30,
    'bitis', yeni_bitis, 'bakiye', bakiye_sunucu, 'tekrar', false);
end;
$$;
revoke all on function public.evren_gezer_plan_satin_al(text, uuid) from public, anon;
grant execute on function public.evren_gezer_plan_satin_al(text, uuid) to authenticated;

-- Yalnızca güvenilir sunucu/ödeme sağlayıcısı entegrasyonu EG yükleyebilir.
-- İstemci rollerine EXECUTE yetkisi verilmez; p_istek_id ödeme sağlayıcısının
-- doğrulanmış, idempotent işlem kimliği olmalıdır.
create or replace function public.evren_gezer_bakiye_yukle(
  p_kullanici uuid, p_miktar bigint, p_istek_id uuid, p_kaynak text
) returns jsonb
language plpgsql
security definer
set search_path = '' as $$
declare
  bakiye_sunucu bigint;
  onceki public.evren_gezer_islemleri;
  kaynak_temiz text := left(btrim(coalesce(p_kaynak, '')), 80);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'yetkisiz';
  end if;
  if p_kullanici is null or p_istek_id is null or p_miktar is null or p_miktar < 1 or p_miktar > 1000000 or kaynak_temiz = '' then
    raise exception 'gecersiz_yukleme';
  end if;
  insert into public.evren_gezer_cuzdanlari (kullanici, bakiye)
    values (p_kullanici, 0) on conflict (kullanici) do nothing;
  select c.bakiye into bakiye_sunucu from public.evren_gezer_cuzdanlari c
    where c.kullanici = p_kullanici for update;
  select * into onceki from public.evren_gezer_islemleri
    where kullanici = p_kullanici and istek_id = p_istek_id;
  if found then
    if onceki.tur <> 'bakiye_yukleme' or onceki.miktar <> p_miktar or onceki.kaynak <> kaynak_temiz then
      raise exception 'istek_cakismasi';
    end if;
    return jsonb_build_object('durum', 'tamam', 'bakiye', bakiye_sunucu, 'tekrar', true);
  end if;
  update public.evren_gezer_cuzdanlari set bakiye = bakiye + p_miktar, guncelleme = now()
    where kullanici = p_kullanici returning bakiye into bakiye_sunucu;
  insert into public.evren_gezer_islemleri
    (kullanici, istek_id, tur, miktar, bakiye_son, kaynak)
    values (p_kullanici, p_istek_id, 'bakiye_yukleme', p_miktar, bakiye_sunucu, kaynak_temiz);
  return jsonb_build_object('durum', 'tamam', 'bakiye', bakiye_sunucu, 'tekrar', false);
end;
$$;
revoke all on function public.evren_gezer_bakiye_yukle(uuid, bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.evren_gezer_bakiye_yukle(uuid, bigint, uuid, text) to service_role;

-- Yalnızca yukarıdaki Edge Function; eski değeri service-role ile bulut
-- ilerleme kaydından okur. Kullanıcı her hesabı için yalnızca bir kere aktarılır.
create or replace function public.evren_gezer_bakiye_aktar(p_kullanici uuid, p_miktar bigint)
returns jsonb
language plpgsql
security definer
set search_path = '' as $$
declare
  bakiye_sunucu bigint;
  onceki public.evren_gezer_aktarimlari;
  istek uuid := gen_random_uuid();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'yetkisiz';
  end if;
  if p_kullanici is null or p_miktar is null or p_miktar < 0 then
    raise exception 'gecersiz_aktarim';
  end if;
  insert into public.evren_gezer_cuzdanlari (kullanici, bakiye)
    values (p_kullanici, 0) on conflict (kullanici) do nothing;
  select c.bakiye into bakiye_sunucu from public.evren_gezer_cuzdanlari c
    where c.kullanici = p_kullanici for update;
  select * into onceki from public.evren_gezer_aktarimlari a where a.kullanici = p_kullanici;
  if found then
    return jsonb_build_object('durum', 'tamam', 'bakiye', bakiye_sunucu,
      'aktarilan', onceki.aktarilan_bakiye, 'tekrar', true);
  end if;
  update public.evren_gezer_cuzdanlari set bakiye = bakiye + p_miktar, guncelleme = now()
    where kullanici = p_kullanici returning bakiye into bakiye_sunucu;
  if p_miktar > 0 then
    insert into public.evren_gezer_islemleri
      (kullanici, istek_id, tur, miktar, bakiye_son, kaynak)
      values (p_kullanici, istek, 'bakiye_yukleme', p_miktar, bakiye_sunucu, 'legacy_cloud_import');
  end if;
  insert into public.evren_gezer_aktarimlari (kullanici, eski_bakiye, aktarilan_bakiye)
    values (p_kullanici, p_miktar, p_miktar);
  return jsonb_build_object('durum', 'tamam', 'bakiye', bakiye_sunucu,
    'aktarilan', p_miktar, 'tekrar', false);
end;
$$;
revoke all on function public.evren_gezer_bakiye_aktar(uuid, bigint) from public, anon, authenticated;
grant execute on function public.evren_gezer_bakiye_aktar(uuid, bigint) to service_role;

create or replace function public.kurulum_surumu() returns text
language sql stable security definer set search_path = '' as $$ select '6.4.6.0'::text $$;
revoke all on function public.kurulum_surumu() from public;
grant execute on function public.kurulum_surumu() to anon, authenticated;
notify pgrst, 'reload schema';
