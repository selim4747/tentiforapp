-- TentiforApp 6.3.10 — public-only share links and privacy-preserving aggregate events.
-- Tokens are random UUIDv4 values (122 bits of entropy); no visitor IP, user-agent,
-- referrer, account id, or per-visit timestamp is stored in analytics.

create table if not exists public.paylasim_baglantilari (
  id uuid primary key default gen_random_uuid(),
  sahibi uuid not null references auth.users(id) on delete cascade,
  tur text not null check (tur in ('profil','evren','okuma')),
  icerik_id text not null check (char_length(icerik_id) between 3 and 120),
  olusturma timestamptz not null default now(),
  bitis timestamptz not null,
  iptal timestamptz,
  constraint paylasim_bitis_sonra check (bitis > olusturma),
  constraint paylasim_iptal_sonra check (iptal is null or iptal >= olusturma)
);
create index if not exists paylasim_baglantilari_sahip_tarih_idx
  on public.paylasim_baglantilari(sahibi,olusturma desc);
create index if not exists paylasim_baglantilari_bitis_idx
  on public.paylasim_baglantilari(bitis) where iptal is null;
alter table public.paylasim_baglantilari enable row level security;
revoke all on public.paylasim_baglantilari from public, anon, authenticated;

create table if not exists public.paylasim_olay_ozetleri (
  paylasim uuid not null references public.paylasim_baglantilari(id) on delete cascade,
  gun date not null,
  olay text not null check (olay in ('olusturuldu','kopyalandi','native','acildi')),
  adet integer not null default 0 check (adet between 0 and 10000),
  primary key(paylasim,gun,olay)
);
create index if not exists paylasim_olay_ozetleri_gun_idx
  on public.paylasim_olay_ozetleri(paylasim,gun desc);
alter table public.paylasim_olay_ozetleri enable row level security;
revoke all on public.paylasim_olay_ozetleri from public, anon, authenticated;

-- Internal visibility gate. Never returns a route for drafts, private profiles,
-- unpublished worlds, hidden/suspended accounts, or non-public reading paths.
create or replace function public.paylasim_hedef_yolu(p_tur text,p_id text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare sonuc text;
begin
  if p_tur='profil' then
    if p_id is null or p_id !~* '^[a-z0-9_]{3,20}$' then return null; end if;
    select '/u/'||p.kullanici_adi||'/' into sonuc
    from public.profiller p left join public.istatistikler s on s.id=p.id
    where lower(p.kullanici_adi)=lower(btrim(p_id))
      and coalesce(p.profil_arama_gorunur,true)
      and not coalesce(s.gizli or s.askida or s.engelli,false);
  elsif p_tur='evren' then
    if p_id is null or p_id !~ '^[[:alnum:]][[:alnum:]-]{2,59}$' then return null; end if;
    select '/evren/'||y.slug||'/' into sonuc
    from public.yayindaki_evrenler y
    left join public.basvurular b on b.id=y.basvuru
    left join public.profiller p on p.id=b.gonderen
    left join public.istatistikler s on s.id=p.id
    where y.slug=lower(btrim(p_id))
      and (p.id is null or (coalesce(p.profil_icerik_gorunur,true)
        and not coalesce(s.gizli or s.askida or s.engelli,false)));
  elsif p_tur='okuma' then
    if p_id is null or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
    select '/okuma-yolu/'||y.id::text||'/' into sonuc
    from public.okuma_yollari y
    join public.profiller p on p.id=y.sahibi
    left join public.istatistikler s on s.id=p.id
    where y.id=p_id::uuid and y.public_mu
      and coalesce(p.profil_arama_gorunur,true)
      and coalesce(p.profil_icerik_gorunur,true)
      and not coalesce(s.gizli or s.askida or s.engelli,false);
  end if;
  return sonuc;
end;
$$;
revoke all on function public.paylasim_hedef_yolu(text,text) from public, anon, authenticated;

-- Internal, atomic daily counter. Only fixed event names are accepted and
-- callers serialize on their share-link row before incrementing.
create or replace function public.paylasim_olay_arttir(p_link uuid,p_olay text,p_sinir integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_olay not in ('olusturuldu','kopyalandi','native','acildi') or p_sinir is null or p_sinir < 1 then return false; end if;
  insert into public.paylasim_olay_ozetleri(paylasim,gun,olay,adet)
    values(p_link,current_date,p_olay,1)
    on conflict(paylasim,gun,olay) do update
      set adet=paylasim_olay_ozetleri.adet+1
      where paylasim_olay_ozetleri.adet < p_sinir;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.paylasim_olay_arttir(uuid,text,integer) from public, anon, authenticated;

create or replace function public.paylasim_baglanti_olustur(p_tur text,p_id text,p_sure_gun integer default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); hedef text; yeni uuid; son timestamptz;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if p_sure_gun is null or p_sure_gun not in (1,7,30) then return jsonb_build_object('durum','sure'); end if;
  hedef:=public.paylasim_hedef_yolu(p_tur,p_id);
  if hedef is null then return jsonb_build_object('durum','public_degil'); end if;
  if p_tur='profil' then
    if not exists(select 1 from public.profiller p where p.id=uid and lower(p.kullanici_adi)=lower(btrim(p_id))) then return jsonb_build_object('durum','yetki'); end if;
  elsif p_tur='evren' then
    if not exists(select 1 from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru where y.slug=lower(btrim(p_id)) and b.gonderen=uid) then return jsonb_build_object('durum','yetki'); end if;
  elsif p_tur='okuma' then
    if p_id is null or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists(select 1 from public.okuma_yollari y where y.id=p_id::uuid and y.sahibi=uid and y.public_mu) then return jsonb_build_object('durum','yetki'); end if;
  else
    return jsonb_build_object('durum','tur');
  end if;
  -- Serialize per account before enforcing creation limits.
  perform 1 from auth.users where id=uid for update;
  delete from public.paylasim_baglantilari l where l.sahibi=uid
    and (l.bitis<now()-interval '90 days' or l.iptal<now()-interval '90 days');
  if (select count(*) from public.paylasim_baglantilari l where l.sahibi=uid and l.iptal is null and l.bitis>now())>=100
    or (select count(*) from public.paylasim_baglantilari l where l.sahibi=uid and l.olusturma>now()-interval '1 hour')>=20 then
    return jsonb_build_object('durum','limit');
  end if;
  son:=now()+make_interval(days=>p_sure_gun);
  insert into public.paylasim_baglantilari(sahibi,tur,icerik_id,bitis)
    values(uid,p_tur,case when p_tur='profil' then lower(btrim(p_id)) else btrim(p_id) end,son)
    returning id into yeni;
  perform public.paylasim_olay_arttir(yeni,'olusturuldu',10000);
  return jsonb_build_object('durum','tamam','id',yeni,'bitis',son,'yol',hedef);
end;
$$;
revoke all on function public.paylasim_baglanti_olustur(text,text,integer) from public, anon;
grant execute on function public.paylasim_baglanti_olustur(text,text,integer) to authenticated;

-- Public bearer-link resolution rechecks visibility every time. At most 2,000
-- opens per token/day are counted; content still resolves after the cap.
create or replace function public.paylasim_baglanti_ac(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_tur text; v_icerik_id text; v_bitis timestamptz; v_iptal timestamptz; hedef text; adet integer;
begin
  if p_token is null then return null; end if;
  select id,tur,icerik_id,bitis,iptal into v_id,v_tur,v_icerik_id,v_bitis,v_iptal
    from public.paylasim_baglantilari where id=p_token for update;
  if not found or v_iptal is not null or v_bitis<=now() then return null; end if;
  hedef:=public.paylasim_hedef_yolu(v_tur,v_icerik_id);
  if hedef is null then return null; end if;
  select o.adet into adet from public.paylasim_olay_ozetleri o
    where o.paylasim=v_id and o.gun=current_date and o.olay='acildi';
  if coalesce(adet,0)<2000 then perform public.paylasim_olay_arttir(v_id,'acildi',2000); end if;
  return jsonb_build_object('durum','tamam','tur',v_tur,'id',v_icerik_id,'yol',hedef);
end;
$$;
revoke all on function public.paylasim_baglanti_ac(uuid) from public, anon, authenticated;
grant execute on function public.paylasim_baglanti_ac(uuid) to anon, authenticated;

create or replace function public.paylasim_olay_kaydet(p_link uuid,p_olay text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); v_sahibi uuid; v_bitis timestamptz; v_iptal timestamptz;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if p_olay not in ('kopyalandi','native') then return jsonb_build_object('durum','olay'); end if;
  select sahibi,bitis,iptal into v_sahibi,v_bitis,v_iptal
    from public.paylasim_baglantilari where id=p_link for update;
  if not found or v_sahibi<>uid then return jsonb_build_object('durum','yetki'); end if;
  if v_iptal is not null or v_bitis<=now() then return jsonb_build_object('durum','kapali'); end if;
  if not public.paylasim_olay_arttir(p_link,p_olay,100) then return jsonb_build_object('durum','limit'); end if;
  return jsonb_build_object('durum','tamam');
end;
$$;
revoke all on function public.paylasim_olay_kaydet(uuid,text) from public, anon;
grant execute on function public.paylasim_olay_kaydet(uuid,text) to authenticated;

create or replace function public.paylasim_gecmisim() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); sonuc jsonb;
begin
  if uid is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'tur',q.tur,'icerik_id',q.icerik_id,'yol',public.paylasim_hedef_yolu(q.tur,q.icerik_id),
    'olusturma',q.olusturma,'bitis',q.bitis,'iptal',q.iptal,
    'acildi',coalesce((select sum(o.adet) from public.paylasim_olay_ozetleri o where o.paylasim=q.id and o.olay='acildi'),0),
    'kopyalandi',coalesce((select sum(o.adet) from public.paylasim_olay_ozetleri o where o.paylasim=q.id and o.olay='kopyalandi'),0),
    'native',coalesce((select sum(o.adet) from public.paylasim_olay_ozetleri o where o.paylasim=q.id and o.olay='native'),0)
  ) order by q.olusturma desc),'[]'::jsonb) into sonuc
  from (select l.id,l.tur,l.icerik_id,l.olusturma,l.bitis,l.iptal from public.paylasim_baglantilari l
    where l.sahibi=uid order by l.olusturma desc limit 100) q;
  return sonuc;
end;
$$;
revoke all on function public.paylasim_gecmisim() from public, anon;
grant execute on function public.paylasim_gecmisim() to authenticated;

create or replace function public.paylasim_baglanti_iptal(p_link uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  update public.paylasim_baglantilari set iptal=coalesce(iptal,now()) where id=p_link and sahibi=uid;
  if not found then return jsonb_build_object('durum','yok'); end if;
  return jsonb_build_object('durum','tamam');
end;
$$;
revoke all on function public.paylasim_baglanti_iptal(uuid) from public, anon;
grant execute on function public.paylasim_baglanti_iptal(uuid) to authenticated;

-- Current-installation marker. Canonical setup retains a single marker.
create or replace function public.kurulum_surumu() returns text
language sql stable security definer set search_path = '' as $$ select '6.3.10'::text $$;
revoke all on function public.kurulum_surumu() from public;
grant execute on function public.kurulum_surumu() to anon, authenticated;
notify pgrst, 'reload schema';
