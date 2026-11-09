-- TentiforApp 6.6.2 — allow local canonical entity targets without exposing their metadata.
-- Wiki entry IDs remain separate from varlikId; only the selected UUID is registered.
alter table public.evren_varliklari drop constraint if exists evren_varliklari_kaynak_turu_check;
alter table public.evren_varliklari add constraint evren_varliklari_kaynak_turu_check
  check (kaynak_turu in ('harita_dugumu','zaman_olayi','kisi','yer','tarih','gezegen','wiki'));

create or replace function public.evren_varlik_kaydet_kanonik(
  p_evren_id text, p_kaynak_turu text, p_kaynak_kaydi_id uuid, p_varlik_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evren text := btrim(coalesce(p_evren_id,'')); asil uuid;
begin
  if auth.uid() is null or char_length(evren) not between 1 and 80
     or p_kaynak_turu not in ('kisi','yer','tarih','gezegen','wiki')
     or p_kaynak_kaydi_id is null or p_varlik_id is null then
    return jsonb_build_object('durum','gecersiz');
  end if;
  asil := public.evren_gorsel_yetki_kontrol(evren);
  if exists (select 1 from public.evren_varliklari v
      where v.sahibi=asil and v.evren_id=evren and v.kaynak_turu=p_kaynak_turu
        and v.kaynak_kaydi_id=p_kaynak_kaydi_id and v.varlik_id<>p_varlik_id) then
    return jsonb_build_object('durum','cakisma');
  end if;
  if exists (select 1 from public.evren_varliklari v
      where v.sahibi=asil and v.evren_id=evren and v.varlik_id=p_varlik_id
        and (v.kaynak_turu<>p_kaynak_turu or v.kaynak_kaydi_id<>p_kaynak_kaydi_id)) then
    return jsonb_build_object('durum','cakisma');
  end if;
  insert into public.evren_varliklari (varlik_id,sahibi,evren_id,kaynak_turu,kaynak_kaydi_id)
    values (p_varlik_id,asil,evren,p_kaynak_turu,p_kaynak_kaydi_id)
    on conflict (sahibi,evren_id,kaynak_turu,kaynak_kaydi_id) do nothing;
  return jsonb_build_object('durum','tamam','varlik_id',p_varlik_id);
exception when unique_violation then
  return jsonb_build_object('durum','cakisma');
end;
$$;
revoke all on function public.evren_varlik_kaydet_kanonik(text,text,uuid,uuid) from public, anon;
grant execute on function public.evren_varlik_kaydet_kanonik(text,text,uuid,uuid) to authenticated;


create or replace function public.evren_varlik_bagla(
  p_evren_id text, p_kaynak_turu text, p_kaynak_kaydi_id uuid, p_varlik_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  evren text := btrim(coalesce(p_evren_id, ''));
  uid uuid := auth.uid();
  asil uuid;
  kaynak_bagli uuid;
  hedef_turu text;
  hedef_kaydi uuid;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if char_length(evren) not between 1 and 80 or p_kaynak_kaydi_id is null
     or p_kaynak_turu is null or p_kaynak_turu not in ('harita_dugumu','zaman_olayi') then
    return jsonb_build_object('durum','gecersiz');
  end if;
  asil := public.evren_gorsel_yetki_kontrol(evren);

  if p_kaynak_turu = 'harita_dugumu' then
    select d.varlik_id into kaynak_bagli from public.evren_harita_dugumleri d
      where d.sahibi = asil and d.evren_id = evren and d.id = p_kaynak_kaydi_id for update;
  else
    select e.varlik_id into kaynak_bagli from public.evren_zaman_olaylari e
      where e.sahibi = asil and e.evren_id = evren and e.id = p_kaynak_kaydi_id for update;
  end if;
  if not found then return jsonb_build_object('durum','yok'); end if;

  if p_varlik_id is not null then
    select v.kaynak_turu, v.kaynak_kaydi_id into hedef_turu, hedef_kaydi
      from public.evren_varliklari v
      where v.varlik_id = p_varlik_id and v.sahibi = asil and v.evren_id = evren;
    if not found then return jsonb_build_object('durum','gecersiz'); end if;
    if hedef_turu = 'harita_dugumu' then
      if not exists (select 1 from public.evren_harita_dugumleri d
        where d.sahibi = asil and d.evren_id = evren and d.id = hedef_kaydi) then
        return jsonb_build_object('durum','gecersiz');
      end if;
    elsif hedef_turu = 'zaman_olayi' then
      if not exists (select 1 from public.evren_zaman_olaylari e
        where e.sahibi = asil and e.evren_id = evren and e.id = hedef_kaydi) then
        return jsonb_build_object('durum','gecersiz');
      end if;
    elsif hedef_turu not in ('kisi','yer','tarih','gezegen','wiki') then
      return jsonb_build_object('durum','gecersiz');
    end if;
  end if;

  -- Ensure this source has a durable registry key before linking or unlinking it.
  insert into public.evren_varliklari (sahibi, evren_id, kaynak_turu, kaynak_kaydi_id)
    values (asil, evren, p_kaynak_turu, p_kaynak_kaydi_id)
    on conflict (sahibi, evren_id, kaynak_turu, kaynak_kaydi_id) do nothing;
  select v.varlik_id into kaynak_bagli from public.evren_varliklari v
    where v.sahibi = asil and v.evren_id = evren
      and v.kaynak_turu = p_kaynak_turu and v.kaynak_kaydi_id = p_kaynak_kaydi_id;

  if p_kaynak_turu = 'harita_dugumu' then
    update public.evren_harita_dugumleri set varlik_id = p_varlik_id
      where sahibi = asil and evren_id = evren and id = p_kaynak_kaydi_id;
  else
    update public.evren_zaman_olaylari set varlik_id = p_varlik_id
      where sahibi = asil and evren_id = evren and id = p_kaynak_kaydi_id;
  end if;
  return jsonb_build_object('durum','tamam','varlik_id',p_varlik_id);
end;
$$;
revoke all on function public.evren_varlik_bagla(text, text, uuid, uuid) from public, anon;
grant execute on function public.evren_varlik_bagla(text, text, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
