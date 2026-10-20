-- GitHub-backed map media keeps authorization in the existing RPC layer.
-- Align removal permissions with upload and return the former object pointer.
create or replace function public.evren_gorsel_varlik_sil(p_evren_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  asil uuid;
  evren text := btrim(coalesce(p_evren_id,''));
  eski_yol text;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  asil := public.evren_gorsel_yetki_kontrol(evren);
  if asil is null then raise exception 'evren için yetki yok'; end if;
  if asil <> uid then
    if not (exists (select 1 from public.ortak_evrenler o where o.id = evren and o.sahip = asil)
            and public.ortak_uye_mi(evren)) then
      raise exception 'evren için yetki yok';
    end if;
  end if;
  select a.gorsel_yolu into eski_yol
    from public.evren_gorsel_alanlari a
    where a.evren_id = evren and a.sahibi = asil
    for update;
  update public.evren_gorsel_alanlari
    set gorsel_yolu=null,gorsel_mime=null,gorsel_boyut=null,gorsel_genislik=null,
        gorsel_yukseklik=null,gorsel_alt=null,gorsel_guncelleme=now(),guncelleme=now()
    where evren_id=evren and sahibi=asil;
  if not found then raise exception 'evren için yetki yok'; end if;
  return jsonb_build_object('durum','tamam','yol',eski_yol);
end;
$$;
revoke all on function public.evren_gorsel_varlik_sil(text) from public, anon;
grant execute on function public.evren_gorsel_varlik_sil(text) to authenticated;
notify pgrst, 'reload schema';
