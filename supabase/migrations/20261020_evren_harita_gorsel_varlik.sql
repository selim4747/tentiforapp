-- TentiforApp 6.5 — fan/visual universe map image assets.
-- The existing evren_gorsel_alanlari owner/member gate remains canonical.

alter table public.evren_gorsel_alanlari
  add column if not exists gorsel_yolu text,
  add column if not exists gorsel_mime text,
  add column if not exists gorsel_boyut int,
  add column if not exists gorsel_genislik int,
  add column if not exists gorsel_yukseklik int,
  add column if not exists gorsel_alt text,
  add column if not exists gorsel_kaplama text not null default 'cover',
  add column if not exists gorsel_saydamlik numeric not null default 1,
  add column if not exists gorsel_guncelleme timestamptz;

alter table public.evren_gorsel_alanlari
  drop constraint if exists evren_gorsel_alanlari_gorsel_mime_check;
alter table public.evren_gorsel_alanlari
  add constraint evren_gorsel_alanlari_gorsel_mime_check
  check (gorsel_mime is null or gorsel_mime in ('image/png','image/jpeg','image/webp'));
alter table public.evren_gorsel_alanlari
  drop constraint if exists evren_gorsel_alanlari_gorsel_boyut_check;
alter table public.evren_gorsel_alanlari
  add constraint evren_gorsel_alanlari_gorsel_boyut_check
  check (gorsel_boyut is null or gorsel_boyut between 1 and 10485760);
alter table public.evren_gorsel_alanlari
  drop constraint if exists evren_gorsel_alanlari_gorsel_olcu_check;
alter table public.evren_gorsel_alanlari
  add constraint evren_gorsel_alanlari_gorsel_olcu_check
  check ((gorsel_genislik is null and gorsel_yukseklik is null)
      or (gorsel_genislik between 1 and 4096 and gorsel_yukseklik between 1 and 4096));
alter table public.evren_gorsel_alanlari
  drop constraint if exists evren_gorsel_alanlari_gorsel_kaplama_check;
alter table public.evren_gorsel_alanlari
  add constraint evren_gorsel_alanlari_gorsel_kaplama_check
  check (gorsel_kaplama in ('cover','contain'));
alter table public.evren_gorsel_alanlari
  drop constraint if exists evren_gorsel_alanlari_gorsel_saydamlik_check;
alter table public.evren_gorsel_alanlari
  add constraint evren_gorsel_alanlari_gorsel_saydamlik_check
  check (gorsel_saydamlik between 0 and 1);

-- This bucket is private. Public readers are granted access only by the
-- storage policy below when the owning visual map is explicitly published.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('evren-harita-gorselleri', 'evren-harita-gorselleri', false, 10485760,
              array['image/png','image/jpeg','image/webp'])
    on conflict (id) do update set public = false, file_size_limit = 10485760,
      allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "evren_harita_gorsel_yukle" on storage.objects';
    execute $p$create policy "evren_harita_gorsel_yukle" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'evren-harita-gorselleri'
        and (storage.foldername(name))[1] = auth.uid()::text
      )$p$;
    execute 'drop policy if exists "evren_harita_gorsel_sahibi" on storage.objects';
    execute $p$create policy "evren_harita_gorsel_sahibi" on storage.objects
      for all to authenticated
      using (
        bucket_id = 'evren-harita-gorselleri'
        and (storage.foldername(name))[1] = auth.uid()::text
      ) with check (
        bucket_id = 'evren-harita-gorselleri'
        and (storage.foldername(name))[1] = auth.uid()::text
      )$p$;
    execute 'drop policy if exists "evren_harita_gorsel_oku" on storage.objects';
    execute $p$create policy "evren_harita_gorsel_oku" on storage.objects
      for select to anon, authenticated
      using (
        bucket_id = 'evren-harita-gorselleri'
        and exists (
          select 1 from public.evren_gorsel_alanlari a
          where a.evren_id = (storage.foldername(name))[2]
            and a.gorsel_yolu = name
            and a.herkese_acik
        )
      )$p$;
  end if;
end $$;

create or replace function public.evren_gorsel_varlik_kaydet(
  p_evren_id text, p_yol text, p_mime text, p_boyut int,
  p_genislik int, p_yukseklik int, p_alt text default '',
  p_kaplama text default 'cover', p_saydamlik numeric default 1
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  evren text := btrim(coalesce(p_evren_id,''));
  uid uuid := auth.uid();
  asil uuid;
  yol text := btrim(coalesce(p_yol,''));
  mime text := lower(btrim(coalesce(p_mime,'')));
  kaplama text := case when p_kaplama = 'contain' then 'contain' else 'cover' end;
  saydamlik numeric := greatest(0, least(1, coalesce(p_saydamlik,1)));
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if char_length(evren) not between 1 and 80 or char_length(yol) not between 1 and 300 then return jsonb_build_object('durum','gecersiz'); end if;
  if mime not in ('image/png','image/jpeg','image/webp') or p_boyut not between 1 and 10485760 then return jsonb_build_object('durum','gecersiz'); end if;
  if p_genislik not between 1 and 4096 or p_yukseklik not between 1 and 4096 then return jsonb_build_object('durum','gecersiz'); end if;
  if yol !~ ('^' || uid::text || '/' || evren || '/[A-Za-z0-9_-]+\.(png|jpg|webp)$') then return jsonb_build_object('durum','gecersiz'); end if;
  asil := public.evren_gorsel_yetki_kontrol(evren);
  if asil <> uid then
    if not (exists (select 1 from public.ortak_evrenler o where o.id = evren and o.sahip = asil) and public.ortak_uye_mi(evren)) then
      raise exception 'evren için yetki yok';
    end if;
  end if;
  update public.evren_gorsel_alanlari
    set gorsel_yolu=yol, gorsel_mime=mime, gorsel_boyut=p_boyut,
        gorsel_genislik=p_genislik, gorsel_yukseklik=p_yukseklik,
        gorsel_alt=left(coalesce(p_alt,''),160), gorsel_kaplama=kaplama,
        gorsel_saydamlik=saydamlik, gorsel_guncelleme=now(), guncelleme=now()
    where evren_id=evren and sahibi=asil;
  if not found then raise exception 'evren için yetki yok'; end if;
  return jsonb_build_object('durum','tamam','evren_id',evren,'yol',yol,'mime',mime,
    'boyut',p_boyut,'genislik',p_genislik,'yukseklik',p_yukseklik,'alt',left(coalesce(p_alt,''),160),
    'kaplama',kaplama,'saydamlik',saydamlik);
end;
$$;
revoke all on function public.evren_gorsel_varlik_kaydet(text,text,text,int,int,int,text,text,numeric) from public, anon;
grant execute on function public.evren_gorsel_varlik_kaydet(text,text,text,int,int,int,text,text,numeric) to authenticated;

create or replace function public.evren_gorsel_varlik_sil(p_evren_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); asil uuid; evren text := btrim(coalesce(p_evren_id,''));
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  asil := public.evren_gorsel_yetki_kontrol(evren);
  if asil <> uid then raise exception 'evren için yetki yok'; end if;
  update public.evren_gorsel_alanlari
    set gorsel_yolu=null,gorsel_mime=null,gorsel_boyut=null,gorsel_genislik=null,
        gorsel_yukseklik=null,gorsel_alt=null,gorsel_guncelleme=now(),guncelleme=now()
    where evren_id=evren and sahibi=asil;
  return jsonb_build_object('durum','tamam');
end;
$$;
revoke all on function public.evren_gorsel_varlik_sil(text) from public, anon;
grant execute on function public.evren_gorsel_varlik_sil(text) to authenticated;

create or replace function public.evren_gorsel_varlik_oku(p_evren_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when a.herkese_acik or a.sahibi=auth.uid() or public.ortak_uye_mi(a.evren_id)
    then jsonb_build_object('durum','tamam','yol',a.gorsel_yolu,'mime',a.gorsel_mime,'boyut',a.gorsel_boyut,
      'genislik',a.gorsel_genislik,'yukseklik',a.gorsel_yukseklik,'alt',a.gorsel_alt,
      'kaplama',a.gorsel_kaplama,'saydamlik',a.gorsel_saydamlik,'herkese_acik',a.herkese_acik)
    else jsonb_build_object('durum','yok') end
  from public.evren_gorsel_alanlari a where a.evren_id=btrim(coalesce(p_evren_id,''));
$$;
revoke all on function public.evren_gorsel_varlik_oku(text) from public;
grant execute on function public.evren_gorsel_varlik_oku(text) to anon, authenticated;

create or replace function public.kurulum_surumu() returns text
language sql stable security definer set search_path = '' as $$ select '6.5.0'::text $$;
revoke all on function public.kurulum_surumu() from public;
grant execute on function public.kurulum_surumu() to anon, authenticated;
notify pgrst, 'reload schema';
