-- 6.6.2+ — FK index hardening düzeltmesi
-- İlk hardening migration'ındaki int2vector slice sınırını düzeltir.
-- Kullanıcı verisine dokunmaz; yalnızca üretilen yardımcı indexleri yeniden düzenler.

begin;

do $$
declare
  idx record;
  f record;
  cols text;
  index_name text;
begin
  -- Yalnızca önceki migration tarafından üretilen indexleri kaldır.
  for idx in
    select n.nspname as schema_name, c.relname as index_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'i'
       and c.relname like 'idx_fk_%'
  loop
    execute format('drop index if exists %I.%I', idx.schema_name, idx.index_name);
  end loop;

  for f in
    select c.oid as constraint_oid,
           c.conrelid,
           n.nspname as schema_name,
           t.relname as table_name,
           c.conkey
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where c.contype = 'f'
       and n.nspname = 'public'
  loop
    if not exists (
      select 1
        from pg_index i
       where i.indrelid = f.conrelid
         and i.indisvalid
         and (i.indkey::int2[])[0:cardinality(f.conkey)-1] = f.conkey
    ) then
      select string_agg(format('%I', a.attname), ', ' order by u.ord)
        into cols
        from unnest(f.conkey) with ordinality as u(attnum, ord)
        join pg_attribute a
          on a.attrelid = f.conrelid
         and a.attnum = u.attnum;

      index_name := left(
        format('idx_fk_%s_%s', left(f.table_name, 36), substr(md5(f.constraint_oid::text), 1, 8)),
        63
      );

      execute format(
        'create index if not exists %I on %I.%I (%s)',
        index_name, f.schema_name, f.table_name, cols
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
