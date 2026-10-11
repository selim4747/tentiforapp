-- 6.3.17 — yeni hesaplara otomatik karşılama hediyesi
-- Her profil için yalnızca bir kez çalışır: 2 gün EvrenYazar, ardından 5 gün EvrenGezer.

create table if not exists public.yeni_hesap_hediye_planlari (
  kullanici uuid primary key references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  yazar_baslangic timestamptz not null,
  yazar_bitis timestamptz not null,
  gezer_baslangic timestamptz not null,
  gezer_bitis timestamptz not null,
  durum text not null default 'aktif' check (durum in ('aktif','iptal'))
);

alter table public.yeni_hesap_hediye_planlari enable row level security;
revoke all on public.yeni_hesap_hediye_planlari from anon, authenticated;

drop function if exists public.yeni_hesaba_hediye_ver();
create or replace function public.yeni_hesaba_hediye_ver()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare
  baslangic timestamptz := coalesce(new.olusturma, now());
  yazar_bitis timestamptz := baslangic + interval '2 days';
  gezer_bitis timestamptz := baslangic + interval '7 days';
begin
  insert into public.yeni_hesap_hediye_planlari
    (kullanici, olusturma, yazar_baslangic, yazar_bitis, gezer_baslangic, gezer_bitis)
  values
    (new.id, baslangic, baslangic, yazar_bitis, yazar_bitis, gezer_bitis)
  on conflict (kullanici) do nothing;

  if found then
    perform public.kullaniciya_bildir(
      new.id,
      'Hoş geldin! Yeni hesap hediyen hazır: 2 gün EvrenYazar, ardından 5 gün EvrenGezer. Üyelikler otomatik ilerler.',
      '#/hesap'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.yeni_hesaba_hediye_ver() from public, anon, authenticated;

drop trigger if exists profiller_yeni_hesap_hediyesi on public.profiller;
create trigger profiller_yeni_hesap_hediyesi
after insert on public.profiller
for each row execute function public.yeni_hesaba_hediye_ver();

create or replace function public.abonelik_durumum()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.abonelikler;
  hediye public.yeni_hesap_hediye_planlari;
  aktif_tip text := 'ucretsiz';
  aktif_bitis timestamptz := null;
  aktif_baslangic timestamptz := null;
  sonraki_tip text := null;
  sonraki_baslangic timestamptz := null;
  sonraki_bitis timestamptz := null;
  kod_bitis timestamptz;
begin
  if uid is null then
    return jsonb_build_object('pro', false, 'tip', 'ucretsiz', 'bitis', null,
      'limitler', jsonb_build_object('evren', 1, 'gezgin', 0, 'hikaye', 0, 'gezegen', 0));
  end if;

  select * into hediye
  from public.yeni_hesap_hediye_planlari
  where kullanici = uid and durum = 'aktif'
  limit 1;

  if hediye.kullanici is not null then
    if now() >= hediye.yazar_baslangic and now() < hediye.yazar_bitis then
      aktif_tip := 'evrenyazar'; aktif_baslangic := hediye.yazar_baslangic; aktif_bitis := hediye.yazar_bitis;
      sonraki_tip := 'evrengezer'; sonraki_baslangic := hediye.gezer_baslangic; sonraki_bitis := hediye.gezer_bitis;
    elsif now() >= hediye.gezer_baslangic and now() < hediye.gezer_bitis then
      aktif_tip := 'evrengezer'; aktif_baslangic := hediye.gezer_baslangic; aktif_bitis := hediye.gezer_bitis;
    end if;
  end if;

  if aktif_tip = 'ucretsiz' then
    select * into r from public.abonelikler where id = uid;
    if r.id is not null and r.tip in ('evrengezer', 'evrenyazar') and (r.bitis is null or r.bitis > now()) then
      aktif_tip := r.tip; aktif_bitis := r.bitis;
    end if;
  end if;

  kod_bitis := public.pro_kod_bitis(uid);
  if kod_bitis is not null and kod_bitis > now() and (aktif_bitis is null or kod_bitis > aktif_bitis) then
    aktif_tip := 'evrenyazar'; aktif_bitis := kod_bitis; sonraki_tip := null; sonraki_bitis := null;
  end if;

  return jsonb_build_object(
    'pro', aktif_tip in ('evrengezer', 'evrenyazar'),
    'tip', aktif_tip, 'bitis', aktif_bitis, 'baslangic', aktif_baslangic,
    'hediye', case when hediye.kullanici is not null then jsonb_build_object(
      'aktif', aktif_tip in ('evrengezer','evrenyazar') and aktif_baslangic is not null,
      'sonraki_tip', sonraki_tip, 'sonraki_baslangic', sonraki_baslangic, 'sonraki_bitis', sonraki_bitis
    ) else null end,
    'limitler', case
      when aktif_tip = 'evrenyazar' then jsonb_build_object('evren', null, 'gezgin', null, 'hikaye', null, 'gezegen', null)
      when aktif_tip = 'evrengezer' then jsonb_build_object('evren', 5, 'gezgin', 12, 'hikaye', 42, 'gezegen', 5)
      else jsonb_build_object('evren', 1, 'gezgin', 0, 'hikaye', 0, 'gezegen', 0)
    end
  );
end;
$$;

revoke all on function public.abonelik_durumum() from public, anon;
grant execute on function public.abonelik_durumum() to authenticated;
notify pgrst, 'reload schema';
