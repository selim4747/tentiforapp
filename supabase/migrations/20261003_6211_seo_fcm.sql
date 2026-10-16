-- TentiforApp 6.2.11 — FCM lifecycle and public SEO contracts
create or replace function public.bildirim_cihazlari_kapat_tumu() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n integer := 0;
begin
  if auth.uid() is null then return jsonb_build_object('durum','giris'); end if;
  update public.bildirim_cihazlari set aktif = false, son_gorulme = now() where kullanici = auth.uid() and aktif;
  get diagnostics n = row_count;
  return jsonb_build_object('durum','tamam','guncellenen',n);
end;
$$;
revoke all on function public.bildirim_cihazlari_kapat_tumu() from public, anon;
grant execute on function public.bildirim_cihazlari_kapat_tumu() to authenticated;

create index if not exists bildirim_cihazlari_aktif_gorulme_idx
  on public.bildirim_cihazlari (aktif, son_gorulme);
notify pgrst, 'reload schema';
