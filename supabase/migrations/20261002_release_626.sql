-- TentiforApp 6.2.6: canlı kurulum sürümünü kaynakla eşitle.
create or replace function public.kurulum_surumu() returns text
language sql immutable set search_path = '' as $$
  select '6.2.6'::text
$$;
grant execute on function public.kurulum_surumu() to anon, authenticated;
notify pgrst, 'reload schema';
