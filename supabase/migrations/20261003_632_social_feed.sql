-- TentiforApp 6.3.2 — takip akışı, sosyal bildirimler ve içerik raporları
-- Takip RPC'si karşılıklı engeli korur ve yalnızca yeni takipte bildirim üretir.
create or replace function public.takip_et(p_ad text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); hedef uuid; hedef_kadi text; mevcut boolean;
begin
  if uid is null then return false; end if;
  select id, kullanici_adi into hedef, hedef_kadi from public.profiller where kullanici_adi = lower(btrim(p_ad));
  if hedef is null or hedef = uid or exists(select 1 from public.kullanici_engelleri e where (e.engelleyen=uid and e.engellenen=hedef) or (e.engelleyen=hedef and e.engellenen=uid)) then return false; end if;
  select exists(select 1 from public.takipler where takip_eden=uid and takip_edilen=hedef) into mevcut;
  if mevcut then
    delete from public.takipler where takip_eden=uid and takip_edilen=hedef;
  else
    if (select count(*) from public.takipler where takip_eden=uid) >= 500 then return false; end if;
    insert into public.takipler(takip_eden,takip_edilen) values(uid,hedef);
    perform public.kullaniciya_bildir(hedef, '@' || (select kullanici_adi from public.profiller where id=uid) || ' seni takip etmeye başladı.', '#/u/' || (select kullanici_adi from public.profiller where id=uid));
  end if;
  return not mevcut;
end;
$$;
revoke all on function public.takip_et(text) from public, anon;
grant execute on function public.takip_et(text) to authenticated;

-- Takip edilen arşivcilerin yalnızca public içeriklerinden birleşik akış.
create or replace function public.takip_akisi() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(q.x order by (q.x->>'zaman')::timestamptz desc), '[]'::jsonb) from (
    select x from (
    select jsonb_build_object('tur','evren','id',y.slug,'baslik',y.baslik,'metin',left(y.ozet,220),'kullanici_adi',p.kullanici_adi,'zaman',y.yayin_tarihi,'adres','#/ev/fan/'||y.slug) x
    from public.takipler t join public.basvurular b on b.gonderen=t.takip_edilen join public.yayindaki_evrenler y on y.basvuru=b.id join public.profiller p on p.id=t.takip_edilen left join public.istatistikler s on s.id=p.id
    where t.takip_eden=auth.uid() and coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)
    union all
    select jsonb_build_object('tur','teori','id',te.id,'baslik',te.konu,'metin',left(te.metin,220),'kullanici_adi',p.kullanici_adi,'zaman',te.zaman,'adres','#/bilinmeyenler') x
    from public.takipler t join public.teoriler te on te.kullanici=t.takip_edilen join public.profiller p on p.id=t.takip_edilen left join public.istatistikler s on s.id=p.id
    where t.takip_eden=auth.uid() and not te.gizli and coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)
    union all
    select jsonb_build_object('tur','defter','id',d.id,'baslik','Kütüphane Defteri','metin',left(d.metin,220),'kullanici_adi',p.kullanici_adi,'zaman',d.zaman,'adres','#/ortakDefter') x
    from public.takipler t join public.defter_cumleleri d on d.kullanici=t.takip_edilen join public.profiller p on p.id=t.takip_edilen left join public.istatistikler s on s.id=p.id
    where t.takip_eden=auth.uid() and not d.gizli and coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)
  ) x order by (x->>'zaman')::timestamptz desc limit 80
  ) q;
$$;
revoke all on function public.takip_akisi() from public, anon;
grant execute on function public.takip_akisi() to authenticated;

-- Public profil etkinliği: arama/profil görünürlüğü ve içerik görünürlüğü uygulanır.
create or replace function public.public_profil_etkinlikleri(p_kullanici_adi text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(q.x order by (q.x->>'zaman')::timestamptz desc), '[]'::jsonb) from (
    select x from (
    select jsonb_build_object('tur','evren','id',y.slug,'baslik',y.baslik,'metin',left(y.ozet,220),'zaman',y.yayin_tarihi,'adres','#/ev/fan/'||y.slug) x
    from public.profiller p join public.basvurular b on b.gonderen=p.id join public.yayindaki_evrenler y on y.basvuru=b.id left join public.istatistikler s on s.id=p.id
    where lower(p.kullanici_adi)=lower(btrim(p_kullanici_adi)) and coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true) and not coalesce(s.gizli or s.askida or s.engelli,false)
    union all
    select jsonb_build_object('tur','teori','id',te.id,'baslik',te.konu,'metin',left(te.metin,220),'zaman',te.zaman,'adres','#/bilinmeyenler') x
    from public.profiller p join public.teoriler te on te.kullanici=p.id left join public.istatistikler s on s.id=p.id
    where lower(p.kullanici_adi)=lower(btrim(p_kullanici_adi)) and coalesce(p.profil_arama_gorunur,true) and coalesce(p.profil_icerik_gorunur,true) and not te.gizli and not coalesce(s.gizli or s.askida or s.engelli,false)
  ) x order by (x->>'zaman')::timestamptz desc limit 50
  ) q;
$$;
revoke all on function public.public_profil_etkinlikleri(text) from public;
grant execute on function public.public_profil_etkinlikleri(text) to anon, authenticated;

-- Evren, teori, defter ve public profil raporları için ayrı moderasyon kuyruğu.
create table if not exists public.sosyal_sikayetler (
  id bigserial primary key,
  bildiren uuid not null references auth.users(id) on delete cascade,
  tur text not null check (tur in ('evren','teori','defter','profil')),
  hedef text not null check (char_length(hedef) between 1 and 120),
  neden text not null check (char_length(neden) between 3 and 400),
  durum text not null default 'bekliyor' check (durum in ('bekliyor','incelendi','kapatildi')),
  zaman timestamptz not null default now(),
  unique (bildiren,tur,hedef)
);
create index if not exists sosyal_sikayetler_durum_zaman on public.sosyal_sikayetler(durum,zaman desc);
alter table public.sosyal_sikayetler enable row level security;
revoke all on public.sosyal_sikayetler from anon, authenticated;
create or replace function public.sosyal_sikayet_et(p_tur text,p_hedef text,p_neden text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); n int;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if p_tur not in ('evren','teori','defter','profil') or char_length(btrim(coalesce(p_hedef,''))) < 1 or char_length(btrim(coalesce(p_neden,''))) < 3 then return jsonb_build_object('durum','gecersiz'); end if;
  select count(*) into n from public.sosyal_sikayetler where bildiren=uid and zaman>now()-interval '1 day';
  if n>=20 then return jsonb_build_object('durum','sinir'); end if;
  insert into public.sosyal_sikayetler(bildiren,tur,hedef,neden) values(uid,p_tur,left(btrim(p_hedef),120),left(btrim(p_neden),400)) on conflict (bildiren,tur,hedef) do update set neden=excluded.neden,zaman=now(),durum='bekliyor';
  return jsonb_build_object('durum','tamam');
end;
$$;
revoke all on function public.sosyal_sikayet_et(text,text,text) from public, anon;
grant execute on function public.sosyal_sikayet_et(text,text,text) to authenticated;
create or replace function public.sosyal_sikayetler_yukle() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'tur',tur,'hedef',hedef,'neden',neden,'zaman',zaman,'durum',durum) order by zaman desc), '[]'::jsonb)
  from (select id,tur,hedef,neden,zaman,durum from public.sosyal_sikayetler where public.yonetici_yetki('istatistik') and durum='bekliyor' order by zaman desc limit 200) q;
$$;
revoke all on function public.sosyal_sikayetler_yukle() from public, anon, authenticated;
notify pgrst, 'reload schema';
