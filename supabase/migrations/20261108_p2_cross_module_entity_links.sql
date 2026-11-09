-- TentiforApp 6.6.2 — universe-scoped stable IDs for visual map/timeline sources.
-- Additive only: existing records remain untouched and both reference columns stay nullable.
create table if not exists public.evren_varliklari (
  varlik_id uuid primary key default gen_random_uuid(),
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren_id text not null check (char_length(btrim(evren_id)) between 1 and 80),
  kaynak_turu text not null check (kaynak_turu in ('harita_dugumu','zaman_olayi')),
  kaynak_kaydi_id uuid not null,
  olusturma timestamptz not null default now(),
  unique (sahibi, evren_id, varlik_id),
  unique (sahibi, evren_id, kaynak_turu, kaynak_kaydi_id)
);
create index if not exists evren_varliklari_evren_idx
  on public.evren_varliklari (sahibi, evren_id, kaynak_turu);

alter table public.evren_varliklari enable row level security;
revoke all on public.evren_varliklari from public, anon, authenticated;

alter table public.evren_harita_dugumleri
  add column if not exists varlik_id uuid;
alter table public.evren_zaman_olaylari
  add column if not exists varlik_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'evren_harita_dugumleri_varlik_scope_fk' and conrelid = 'public.evren_harita_dugumleri'::regclass) then
    alter table public.evren_harita_dugumleri
      add constraint evren_harita_dugumleri_varlik_scope_fk
      foreign key (sahibi, evren_id, varlik_id)
      references public.evren_varliklari (sahibi, evren_id, varlik_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'evren_zaman_olaylari_varlik_scope_fk' and conrelid = 'public.evren_zaman_olaylari'::regclass) then
    alter table public.evren_zaman_olaylari
      add constraint evren_zaman_olaylari_varlik_scope_fk
      foreign key (sahibi, evren_id, varlik_id)
      references public.evren_varliklari (sahibi, evren_id, varlik_id) not valid;
  end if;
end $$;

-- No RPC or application path may reassign an established ID or source/scope key.
create or replace function public.evren_varlik_kimligi_degismez() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.varlik_id is distinct from old.varlik_id
     or new.sahibi is distinct from old.sahibi
     or new.evren_id is distinct from old.evren_id
     or new.kaynak_turu is distinct from old.kaynak_turu
     or new.kaynak_kaydi_id is distinct from old.kaynak_kaydi_id then
    raise exception 'evren varlık kimliği ve kaynak anahtarı değiştirilemez';
  end if;
  return new;
end;
$$;
revoke all on function public.evren_varlik_kimligi_degismez() from public, anon, authenticated;
drop trigger if exists evren_varlik_kimligi_degismez on public.evren_varliklari;
create trigger evren_varlik_kimligi_degismez
  before update on public.evren_varliklari
  for each row execute function public.evren_varlik_kimligi_degismez();

create or replace function public.evren_varlik_kaydet(
  p_evren_id text, p_kaynak_turu text, p_kaynak_kaydi_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  evren text := btrim(coalesce(p_evren_id, ''));
  uid uuid := auth.uid();
  asil uuid;
  varlik uuid;
  bagli uuid;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if char_length(evren) not between 1 and 80 or p_kaynak_kaydi_id is null
     or p_kaynak_turu is null or p_kaynak_turu not in ('harita_dugumu','zaman_olayi') then
    return jsonb_build_object('durum','gecersiz');
  end if;
  asil := public.evren_gorsel_yetki_kontrol(evren);
  if p_kaynak_turu = 'harita_dugumu' then
    select d.varlik_id into bagli from public.evren_harita_dugumleri d
      where d.sahibi = asil and d.evren_id = evren and d.id = p_kaynak_kaydi_id for update;
  else
    select e.varlik_id into bagli from public.evren_zaman_olaylari e
      where e.sahibi = asil and e.evren_id = evren and e.id = p_kaynak_kaydi_id for update;
  end if;
  if not found then return jsonb_build_object('durum','yok'); end if;

  insert into public.evren_varliklari (sahibi, evren_id, kaynak_turu, kaynak_kaydi_id)
    values (asil, evren, p_kaynak_turu, p_kaynak_kaydi_id)
    on conflict (sahibi, evren_id, kaynak_turu, kaynak_kaydi_id) do nothing;
  select v.varlik_id into varlik from public.evren_varliklari v
    where v.sahibi = asil and v.evren_id = evren
      and v.kaynak_turu = p_kaynak_turu and v.kaynak_kaydi_id = p_kaynak_kaydi_id;

  -- Registration gives an unlinked source its own stable ID; preserve an explicit link.
  if bagli is null then
    if p_kaynak_turu = 'harita_dugumu' then
      update public.evren_harita_dugumleri set varlik_id = varlik
        where sahibi = asil and evren_id = evren and id = p_kaynak_kaydi_id and varlik_id is null;
    else
      update public.evren_zaman_olaylari set varlik_id = varlik
        where sahibi = asil and evren_id = evren and id = p_kaynak_kaydi_id and varlik_id is null;
    end if;
  end if;
  return jsonb_build_object('durum','tamam','varlik_id',varlik);
end;
$$;
revoke all on function public.evren_varlik_kaydet(text, text, uuid) from public, anon;
grant execute on function public.evren_varlik_kaydet(text, text, uuid) to authenticated;

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
    else
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

-- Public resolution is intentionally silent unless both the visible source row
-- and the linked target row are currently published in this same public world.
create or replace function public.evren_varlik_bilgisi(
  p_evren_id text, p_kaynak_turu text, p_kaynak_kaydi_id uuid
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  evren text := btrim(coalesce(p_evren_id, ''));
  asil uuid;
  source_varlik uuid;
  hedef_turu text;
  hedef_kaydi uuid;
  baslik text;
  kayit_turu text;
begin
  if char_length(evren) not between 1 and 80 or p_kaynak_kaydi_id is null
     or p_kaynak_turu is null or p_kaynak_turu not in ('harita_dugumu','zaman_olayi') then return null; end if;
  select a.sahibi into asil from public.evren_gorsel_alanlari a
    where a.evren_id = evren and a.herkese_acik;
  if not found then return null; end if;

  if p_kaynak_turu = 'harita_dugumu' then
    select d.varlik_id into source_varlik from public.evren_harita_dugumleri d
      where d.sahibi = asil and d.evren_id = evren and d.id = p_kaynak_kaydi_id and d.yayinda;
  else
    select e.varlik_id into source_varlik from public.evren_zaman_olaylari e
      where e.sahibi = asil and e.evren_id = evren and e.id = p_kaynak_kaydi_id and e.durum = 'yayinda';
  end if;
  if not found or source_varlik is null then return null; end if;

  select v.kaynak_turu, v.kaynak_kaydi_id into hedef_turu, hedef_kaydi
    from public.evren_varliklari v
    where v.varlik_id = source_varlik and v.sahibi = asil and v.evren_id = evren;
  if not found then return null; end if;

  if hedef_turu = 'harita_dugumu' then
    select d.baslik, d.tip into baslik, kayit_turu from public.evren_harita_dugumleri d
      where d.sahibi = asil and d.evren_id = evren and d.id = hedef_kaydi and d.yayinda;
  elsif hedef_turu = 'zaman_olayi' then
    select e.baslik, e.tur into baslik, kayit_turu from public.evren_zaman_olaylari e
      where e.sahibi = asil and e.evren_id = evren and e.id = hedef_kaydi and e.durum = 'yayinda';
  else
    return null;
  end if;
  if not found then return null; end if;
  return jsonb_build_object('varlik_id',source_varlik,'kaynak_turu',hedef_turu,
    'kayit_turu',kayit_turu,'baslik',baslik);
end;
$$;
revoke all on function public.evren_varlik_bilgisi(text, text, uuid) from public;
grant execute on function public.evren_varlik_bilgisi(text, text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
-- Release marker: stable cross-module entity links are present.
create or replace function public.kurulum_surumu() returns text
language sql stable security definer set search_path = '' as $$ select '6.6.2'::text $$;
revoke all on function public.kurulum_surumu() from public;
grant execute on function public.kurulum_surumu() to anon, authenticated;
