-- 6.6.2+ — güvenli Supabase hardening
-- Hassas legacy tablolar için anon doğrudan erişimini kapatır.
-- RLS/policy, kullanıcı verisi ve mevcut authenticated grant'leri değiştirmez.
-- Foreign key indexlerini yalnızca aynı kolon prefix'i mevcut değilse ekler.

begin;

revoke all on table
  public.abonelikler,
  public.basvurular,
  public.bildirim_cihazlari,
  public.bildirimler,
  public.bulmaca_cozumleri,
  public.hata_kayitlari,
  public.hediye_gecmisi,
  public.kullanici_abonelik,
  public.kullanici_bildirimleri,
  public.moderator_denemeler,
  public.moderator_kodlari,
  public.moderator_oturumlari,
  public.odemeler,
  public.sikayetler,
  public.yoneticiler
from anon;

-- Trigger/admin yardımcıları doğrudan istemci fonksiyonu değildir.
revoke execute on function public.profiller_sunucu_alanlarini_koru() from anon;
revoke execute on function public.bildirim_sayisi() from anon;

-- Her FK için local kolon prefix'iyle eşleşen bir index yoksa additive index ekle.
do $$
declare
  f record;
  cols text;
  index_name text;
begin
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
         and (i.indkey::int2[])[1:cardinality(f.conkey)] = f.conkey
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
