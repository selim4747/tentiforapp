-- TentiforApp 6.3.11 — canonical kurulum sürüm işareti.
-- Veri silmez; mevcut şema ile uyumludur. Tam kurulum için supabase/kurulum.sql
-- dosyasının tamamı çalıştırılmalıdır.
create or replace function public.kurulum_surumu() returns text
language sql stable security definer set search_path = '' as $$
  select '6.3.11'::text
$$;
revoke all on function public.kurulum_surumu() from public;
grant execute on function public.kurulum_surumu() to anon, authenticated;
notify pgrst, 'reload schema';
