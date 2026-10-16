-- TentiforApp 6.3.11 — okuma serisi production fix.
-- Anon kullanıcılar istemcide RPC'ye gönderilmez; authenticated çağrıda
-- istatistikler.seri kolon adı PL/pgSQL değişkeniyle çakışmaz.
create or replace function public.okuma_serisi_kaydet(p_adres text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); bugun date:=(now() at time zone 'utc')::date; yeni boolean:=false; seri int:=0; toplam int:=0; etkilenen int:=0;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  p_adres:=left(regexp_replace(coalesce(p_adres,''),'[^a-zA-Z0-9_/:.?=-]','','g'),240);
  insert into public.okuma_gunleri(kullanici,gun,adres) values(uid,bugun,p_adres) on conflict (kullanici,gun) do nothing;
  get diagnostics etkilenen = row_count; yeni := etkilenen > 0;
  select count(*)::int into toplam from public.okuma_gunleri where kullanici=uid;
  select i.seri into seri from public.istatistikler as i where i.id=uid;
  if yeni then
    select exists(select 1 from public.okuma_gunleri where kullanici=uid and gun=bugun-1) into yeni;
    seri:=case when yeni then greatest(1,coalesce(seri,0)+1) else 1 end;
    insert into public.istatistikler(id,gun,seri,guncelleme) values(uid,1,seri,now()) on conflict(id) do update set gun=public.istatistikler.gun+1,seri=excluded.seri,guncelleme=now();
  end if;
  return jsonb_build_object('durum','tamam','seri',coalesce(seri,0),'gun',toplam);
end;
$$;
revoke all on function public.okuma_serisi_kaydet(text) from public, anon;
grant execute on function public.okuma_serisi_kaydet(text) to authenticated;
notify pgrst, 'reload schema';
