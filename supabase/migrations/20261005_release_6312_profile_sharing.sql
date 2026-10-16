-- TentiforApp 6.3.12 — profile overflow fixes and contextual sharing client release.
-- Feature data remains client-side/public-only; no visitor identifiers are stored.
create or replace function public.kurulum_surumu() returns text
language sql stable security definer set search_path = '' as $$ select '6.3.12'::text $$;
revoke all on function public.kurulum_surumu() from public;
grant execute on function public.kurulum_surumu() to anon, authenticated;
notify pgrst, 'reload schema';
