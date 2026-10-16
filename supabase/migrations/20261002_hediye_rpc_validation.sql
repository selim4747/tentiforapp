-- Hediye RPC doğrulama düzeltmesi.
-- Geçersiz plan/süre değerleri artık sessizce varsayılana çevrilmez ve abonelik yazılmaz.
create or replace function public.abonelik_hediye(
  p_kullanici_adi text, p_tip text, p_gun int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hedef uuid;
  veren uuid := auth.uid();
  gun int := p_gun;
  tip text := lower(btrim(coalesce(p_tip, '')));
  kadi text := btrim(coalesce(p_kullanici_adi, ''));
  eski_tip text;
  eski_bitis timestamptz;
  yeni_bitis timestamptz;
  etkin_tip text;
begin
  if veren is null or not public.tam_yonetici_mi() then
    return jsonb_build_object('durum', 'yetki');
  end if;
  if kadi = '' or tip not in ('evrengezer', 'evrenyazar') or gun is null or gun < 1 or gun > 3650 then
    return jsonb_build_object('durum', 'gecersiz');
  end if;
  select id into hedef from public.profiller
    where lower(kullanici_adi) = lower(btrim(p_kullanici_adi)) limit 1;
  if hedef is null then return jsonb_build_object('durum', 'yok'); end if;
  select a.tip, a.bitis into eski_tip, eski_bitis
    from public.abonelikler a where a.id = hedef;
  if eski_tip = 'evrenyazar' and tip = 'evrengezer' then
    return jsonb_build_object('durum', 'dusurme_yok', 'tip', eski_tip);
  end if;
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
notify pgrst, 'reload schema';
