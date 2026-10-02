-- TentiforApp 6.2.7 bildirim güvenliği ve APK yerel bildirim kanalı düzeltmesi.
-- Endpoint silme yalnızca endpoint sahibi authenticated kullanıcıya açıktır.
create or replace function public.bildirim_abonelik_sil(p_endpoint text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare silinen integer := 0;
begin
  if auth.uid() is null then return jsonb_build_object('durum', 'giris'); end if;
  delete from public.bildirim_abonelikleri
   where endpoint = p_endpoint and kullanici = auth.uid();
  get diagnostics silinen = row_count;
  return jsonb_build_object('durum', 'tamam', 'silinen', silinen);
end $$;
revoke execute on function public.bildirim_abonelik_sil(text) from public, anon;
grant execute on function public.bildirim_abonelik_sil(text) to authenticated;
notify pgrst, 'reload schema';
