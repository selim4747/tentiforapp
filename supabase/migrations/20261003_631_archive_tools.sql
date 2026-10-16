-- TentiforApp 6.3.1 — kişisel raflar, okuma yolları ve evren ilişkileri
-- 6.3.0 kisisel_raf tablosunu listeleme/silme RPC'leriyle tamamlar.
create or replace function public.raf_listele() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('raf',raf,'adres',adres,'baslik',baslik,'eklenme',eklenme) order by eklenme desc), '[]'::jsonb)
  from public.kisisel_raf where kullanici=auth.uid();
$$;
revoke all on function public.raf_listele() from public, anon;
grant execute on function public.raf_listele() to authenticated;
create or replace function public.raf_sil(p_raf text,p_adres text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  delete from public.kisisel_raf where kullanici=auth.uid() and raf=p_raf and adres=p_adres;
  return found;
end;
$$;
revoke all on function public.raf_sil(text,text) from public, anon;
grant execute on function public.raf_sil(text,text) to authenticated;

create table if not exists public.okuma_yollari (
  id uuid primary key default gen_random_uuid(),
  sahibi uuid not null references auth.users(id) on delete cascade,
  baslik text not null check (char_length(btrim(baslik)) between 1 and 120),
  aciklama text not null default '' check (char_length(aciklama) <= 600),
  public_mu boolean not null default false,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
create index if not exists okuma_yollari_public_idx on public.okuma_yollari(public_mu,guncelleme desc);
alter table public.okuma_yollari enable row level security;
revoke all on public.okuma_yollari from anon, authenticated;
create table if not exists public.okuma_yolu_adimlari (
  id bigserial primary key,
  yol uuid not null references public.okuma_yollari(id) on delete cascade,
  sira int not null check (sira between 1 and 200),
  adres text not null check (char_length(adres) between 2 and 240 and adres ~ '^(#|/)'),
  baslik text not null default '' check (char_length(baslik) <= 160),
  tur text not null default 'icerik' check (tur in ('icerik','evren','hikaye','karakter','not')),
  spoiler text not null default 'yok' check (spoiler in ('yok','az','var')),
  unique(yol,sira)
);
create index if not exists okuma_yolu_adimlari_yol_idx on public.okuma_yolu_adimlari(yol,sira);
alter table public.okuma_yolu_adimlari enable row level security;
revoke all on public.okuma_yolu_adimlari from anon, authenticated;

create or replace function public.okuma_yolu_olustur(p_baslik text,p_aciklama text default '',p_public boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare yeni uuid; uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  if char_length(btrim(coalesce(p_baslik,''))) not between 1 and 120 then raise exception 'başlık geçersiz'; end if;
  if (select count(*) from public.okuma_yollari where sahibi=uid) >= 50 then raise exception 'en fazla 50 okuma yolu'; end if;
  insert into public.okuma_yollari(sahibi,baslik,aciklama,public_mu) values(uid,left(btrim(p_baslik),120),left(coalesce(p_aciklama,''),600),coalesce(p_public,false)) returning id into yeni;
  return yeni;
end;
$$;
revoke all on function public.okuma_yolu_olustur(text,text,boolean) from public, anon;
grant execute on function public.okuma_yolu_olustur(text,text,boolean) to authenticated;

create or replace function public.okuma_yolu_adim_ekle(p_yol uuid,p_adres text,p_baslik text,p_tur text default 'icerik',p_spoiler text default 'yok') returns bigint
language plpgsql security definer set search_path = '' as $$
declare yeni bigint; sira int; uid uuid:=auth.uid();
begin
  if uid is null or not exists(select 1 from public.okuma_yollari where id=p_yol and sahibi=uid) then raise exception 'okuma yolu yetkisi yok'; end if;
  if p_adres is null or p_adres !~ '^(#|/)' then raise exception 'adres geçersiz'; end if;
  select coalesce(max(sira),0)+1 into sira from public.okuma_yolu_adimlari where yol=p_yol;
  if sira > 200 then raise exception 'okuma yolu dolu'; end if;
  insert into public.okuma_yolu_adimlari(yol,sira,adres,baslik,tur,spoiler) values(p_yol,sira,left(p_adres,240),left(coalesce(p_baslik,''),160),coalesce(p_tur,'icerik'),coalesce(p_spoiler,'yok')) returning id into yeni;
  update public.okuma_yollari set guncelleme=now() where id=p_yol;
  return yeni;
end;
$$;
revoke all on function public.okuma_yolu_adim_ekle(uuid,text,text,text,text) from public, anon;
grant execute on function public.okuma_yolu_adim_ekle(uuid,text,text,text,text) to authenticated;

create or replace function public.okuma_yollari_listele(p_kullanici_adi text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare hedef uuid; uid uuid:=auth.uid();
begin
  if p_kullanici_adi is null and uid is null then return '[]'::jsonb; end if;
  if p_kullanici_adi is null then hedef:=uid; else select id into hedef from public.profiller where lower(kullanici_adi)=lower(btrim(p_kullanici_adi)) and coalesce(profil_arama_gorunur,true); end if;
  if hedef is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',y.id,'baslik',y.baslik,'aciklama',y.aciklama,'public',y.public_mu,'sahibi',p.kullanici_adi,'adim',coalesce((select count(*) from public.okuma_yolu_adimlari a where a.yol=y.id),0)) order by y.guncelleme desc) from public.okuma_yollari y join public.profiller p on p.id=y.sahibi where y.sahibi=hedef and (y.public_mu or hedef=uid)), '[]'::jsonb);
end;
$$;
revoke all on function public.okuma_yollari_listele(text) from public;
grant execute on function public.okuma_yollari_listele(text) to anon, authenticated;

create or replace function public.okuma_yolu_detay(p_yol uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare y public.okuma_yollari; p public.profiller; uid uuid:=auth.uid();
begin
  select * into y from public.okuma_yollari where id=p_yol;
  if y.id is null or (not y.public_mu and y.sahibi<>uid) then return null; end if;
  select * into p from public.profiller where id=y.sahibi;
  return jsonb_build_object('id',y.id,'baslik',y.baslik,'aciklama',y.aciklama,'public',y.public_mu,'sahibi',p.kullanici_adi,'adim',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'sira',a.sira,'adres',a.adres,'baslik',a.baslik,'tur',a.tur,'spoiler',a.spoiler) order by a.sira) from public.okuma_yolu_adimlari a where a.yol=y.id),'[]'::jsonb));
end;
$$;
revoke all on function public.okuma_yolu_detay(uuid) from public;
grant execute on function public.okuma_yolu_detay(uuid) to anon, authenticated;

-- Evren grafiği için sahip kontrollü, düşük hacimli bağlantı tabanı.
create table if not exists public.evren_baglantilari (
  id bigserial primary key,
  sahibi uuid not null references auth.users(id) on delete cascade,
  evren text not null check (char_length(evren) between 1 and 80),
  kaynak text not null check (char_length(kaynak) between 1 and 120),
  hedef text not null check (char_length(hedef) between 1 and 120),
  iliski text not null default 'bağlı' check (char_length(iliski) between 1 and 60),
  public_mu boolean not null default false,
  olusturma timestamptz not null default now(),
  unique(sahibi,evren,kaynak,hedef,iliski)
);
alter table public.evren_baglantilari enable row level security;
revoke all on public.evren_baglantilari from anon, authenticated;
create or replace function public.evren_baglantisi_ekle(p_evren text,p_kaynak text,p_hedef text,p_iliski text default 'bağlı',p_public boolean default false) returns bigint
language plpgsql security definer set search_path = '' as $$
declare yeni bigint; uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'giriş gerekli'; end if;
  if (select count(*) from public.evren_baglantilari where sahibi=uid) >= 1000 then raise exception 'grafik sınırı'; end if;
  insert into public.evren_baglantilari(sahibi,evren,kaynak,hedef,iliski,public_mu) values(uid,left(p_evren,80),left(p_kaynak,120),left(p_hedef,120),left(coalesce(p_iliski,'bağlı'),60),coalesce(p_public,false)) on conflict (sahibi,evren,kaynak,hedef,iliski) do update set public_mu=excluded.public_mu returning id into yeni;
  return yeni;
end;
$$;
revoke all on function public.evren_baglantisi_ekle(text,text,text,text,boolean) from public, anon;
grant execute on function public.evren_baglantisi_ekle(text,text,text,text,boolean) to authenticated;
create or replace function public.evren_grafigi(p_evren text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('kaynak',kaynak,'hedef',hedef,'iliski',iliski) order by kaynak,hedef), '[]'::jsonb)
  from public.evren_baglantilari where evren=p_evren and (public_mu or sahibi=auth.uid());
$$;
revoke all on function public.evren_grafigi(text) from public;
grant execute on function public.evren_grafigi(text) to anon, authenticated;
notify pgrst, 'reload schema';
