-- TentiforApp 6.2.7 stabilite patch'i
-- Kurulum panelinin canlı şema sürümüyle eşleşmesini sağlar.
create or replace function public.kurulum_surumu() returns text
language sql immutable set search_path = '' as $$
  select '6.2.7'::text
$$;

notify pgrst, 'reload schema';
