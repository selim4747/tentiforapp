-- 5.4: hediye geçmişi, alıcı bildirimi ve güncel hediye RPC'si.
-- Idempotent olacak şekilde yazılmıştır; mevcut kurulumlarda güvenle uygulanabilir.
alter table public.kullanici_bildirimleri
  add column if not exists kategori text not null default 'profil';

create index if not exists kullanici_bildirimleri_kategori
  on public.kullanici_bildirimleri (kullanici, kategori, zaman desc);

create table if not exists public.hediye_gecmisi (
  id bigserial primary key,
  veren uuid not null references auth.users(id) on delete cascade,
  alan uuid not null references auth.users(id) on delete cascade,
  tip text not null check (tip in ('evrengezer','evrenyazar')),
  gun int not null check (gun between 1 and 3650),
  onceki_tip text,
  onceki_bitis timestamptz,
  yeni_bitis timestamptz not null,
  durum text not null default 'tamam',
  zaman timestamptz not null default now()
);

create index if not exists hediye_gecmisi_alan_zaman
  on public.hediye_gecmisi (alan, zaman desc);
create index if not exists hediye_gecmisi_veren_zaman
  on public.hediye_gecmisi (veren, zaman desc);

alter table public.hediye_gecmisi enable row level security;
drop policy if exists "hediye alan kendi geçmişini okur" on public.hediye_gecmisi;
create policy "hediye alan kendi geçmişini okur"
  on public.hediye_gecmisi for select to authenticated
  using (alan = auth.uid());
drop policy if exists "yönetici hediye geçmişini okur" on public.hediye_gecmisi;
create policy "yönetici hediye geçmişini okur"
  on public.hediye_gecmisi for select to authenticated
  using (public.tam_yonetici_mi());

create or replace function public.bildirimlerim() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'no', no, 'metin', metin, 'baglanti', baglanti, 'okundu', okundu,
    'zaman', zaman, 'kategori', kategori
  ) order by zaman desc), '[]'::jsonb)
  from (
    select * from public.kullanici_bildirimleri
    where kullanici = auth.uid()
    order by zaman desc limit 50
  ) b;
$$;
revoke execute on function public.bildirimlerim() from public, anon;
grant execute on function public.bildirimlerim() to authenticated;

create or replace function public.abonelik_hediye(
  p_kullanici_adi text, p_tip text, p_gun int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hedef uuid;
  veren uuid := auth.uid();
  gun int := greatest(1, least(3650, coalesce(p_gun, 30)));
  tip text := lower(coalesce(p_tip, 'evrengezer'));
  eski_tip text;
  eski_bitis timestamptz;
  yeni_bitis timestamptz;
  etkin_tip text;
begin
  if veren is null or not public.tam_yonetici_mi() then
    return jsonb_build_object('durum', 'yetki');
  end if;
  if tip not in ('evrengezer', 'evrenyazar') then tip := 'evrengezer'; end if;
  select id into hedef from public.profiller
    where lower(kullanici_adi) = lower(btrim(p_kullanici_adi)) limit 1;
  if hedef is null then return jsonb_build_object('durum', 'yok'); end if;
  select a.tip, a.bitis into eski_tip, eski_bitis
    from public.abonelikler a where a.id = hedef;
  etkin_tip := case
    when eski_tip = 'evrenyazar' or tip = 'evrenyazar' then 'evrenyazar'
    else tip
  end;
  yeni_bitis := greatest(coalesce(eski_bitis, now()), now())
    + make_interval(days => gun);
  insert into public.abonelikler (id, tip, bitis, guncelleme)
    values (hedef, etkin_tip, yeni_bitis, now())
    on conflict (id) do update set
      tip = excluded.tip, bitis = excluded.bitis, guncelleme = now();
  insert into public.hediye_gecmisi
    (veren, alan, tip, gun, onceki_tip, onceki_bitis, yeni_bitis)
    values (veren, hedef, tip, gun, eski_tip, eski_bitis, yeni_bitis);
  perform public.kullaniciya_bildir(
    hedef,
    'Yönetici sana ' || gun::text || ' günlük ' ||
      case when tip = 'evrenyazar' then 'EvrenYazar' else 'EvrenGezer' end ||
      ' üyeliği hediye etti. Bitiş: ' ||
      to_char(yeni_bitis at time zone 'Europe/Istanbul', 'DD.MM.YYYY'),
    '#/hesap'
  );
  return jsonb_build_object(
    'durum', 'tamam', 'tip', etkin_tip, 'gun', gun,
    'bitis', yeni_bitis, 'onceki_tip', eski_tip
  );
end;
$$;
revoke all on function public.abonelik_hediye(text, text, int) from public, anon;
grant execute on function public.abonelik_hediye(text, text, int) to authenticated;

create or replace function public.kullaniciya_bildir(
  p_kullanici uuid, p_metin text, p_baglanti text
) returns void
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if p_kullanici is null then return; end if;
  k := case
    when lower(coalesce(p_metin,'')) ~ 'hediye|üyelik|abonelik|evrengezer|evrenyazar' then 'hediye'
    when lower(coalesce(p_metin,'')) ~ 'rozet|madalya|kazandın|kilit' then 'rozet'
    when lower(coalesce(p_metin,'')) ~ 'okuma|bölüm|roman|ilerleme' then 'okuma'
    when lower(coalesce(p_metin,'')) ~ 'evren|davet|konuk' then 'evren'
    when lower(coalesce(p_metin,'')) ~ 'duyuru|bakım' then 'duyuru'
    else 'profil'
  end;
  insert into public.kullanici_bildirimleri
    (kullanici, metin, baglanti, kategori)
    values (p_kullanici, left(p_metin, 400), p_baglanti, k);
  delete from public.kullanici_bildirimleri
    where kullanici = p_kullanici and no not in (
      select no from public.kullanici_bildirimleri
      where kullanici = p_kullanici order by zaman desc limit 50
    );
end;
$$;
revoke execute on function public.kullaniciya_bildir(uuid, text, text)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
