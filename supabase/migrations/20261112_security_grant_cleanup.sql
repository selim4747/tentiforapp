-- 6.6.2+ — policy'siz RLS tablolarında anon grant temizliği
-- Kullanıcı verisine dokunmaz; yalnızca etkisiz doğrudan anon grant'lerini kaldırır.

begin;

revoke execute on function public.profiller_sunucu_alanlarini_koru() from public, anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select n.nspname as schema_name,c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      left join pg_policy p on p.polrelid=c.oid
     where n.nspname='public'
       and c.relkind='r'
       and c.relrowsecurity
     group by n.nspname,c.relname,c.oid
    having count(p.polname)=0
  loop
    execute format('revoke all on table %I.%I from anon',t.schema_name,t.table_name);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
