-- TentifApp 6.3.13 — canonical installation marker.
-- Idempotent: safe to apply after all previous TentifApp migrations.
create or replace function public.kurulum_surumu() returns text
language sql stable security definer set search_path = '' as $$
  select '6.3.13'::text
$$;
revoke all on function public.kurulum_surumu() from public;
grant execute on function public.kurulum_surumu() to anon, authenticated;
