-- 4.7.3 EvrenGezer / EvrenYazar abonelikleri ve yönetici hediyesi
-- Supabase SQL Editor'de çalıştır.
create table if not exists public.abonelikler (
  id uuid primary key references auth.users on delete cascade,
  tip text not null default 'ucretsiz',
  bitis timestamptz,
  guncelleme timestamptz default timezone('utc'::text, now()) not null
);
alter table public.abonelikler enable row level security;
drop policy if exists "Kullanici kendi aboneligini gorur" on public.abonelikler;
create policy "Kullanici kendi aboneligini gorur" on public.abonelikler for select using (auth.uid() = id);

create or replace function public.abonelik_durumum()
returns json language plpgsql security definer as $$
declare r public.abonelikler%rowtype; aktif_tip text;
begin
  select * into r from public.abonelikler where id = auth.uid();
  if not found then return json_build_object('pro', false, 'tip', 'ucretsiz', 'bitis', null, 'limitler', json_build_object('evren', 1, 'gezgin', 0, 'hikaye', 0, 'gezegen', 0)); end if;
  aktif_tip := case when r.tip = 'pro' then 'evrengezer' else r.tip end;
  return json_build_object(
    'pro', aktif_tip in ('evrengezer','evrenyazar') and (r.bitis is null or r.bitis > now()),
    'tip', case when r.bitis is null or r.bitis > now() then aktif_tip else 'ucretsiz' end,
    'bitis', r.bitis,
    'limitler', case when aktif_tip = 'evrenyazar' then json_build_object('evren', null, 'gezgin', null, 'hikaye', null, 'gezegen', null) when aktif_tip = 'evrengezer' then json_build_object('evren', 5, 'gezgin', 12, 'hikaye', 42, 'gezegen', 5) else json_build_object('evren', 1, 'gezgin', 0, 'hikaye', 0, 'gezegen', 0) end
  );
end; $$;

create or replace function public.abonelik_hediye(p_kullanici_adi text, p_tip text, p_gun int)
returns json language plpgsql security definer as $$
declare hedef uuid; gun int; tip text; yonetici boolean;
begin
  if auth.uid() is null then return json_build_object('durum', 'giris'); end if;
  begin select coalesce(public.yonetici_mi(), false) into yonetici; exception when others then yonetici := false; end;
  if not yonetici then return json_build_object('durum', 'yetki'); end if;
  tip := lower(coalesce(p_tip, 'evrengezer'));
  if tip not in ('evrengezer','evrenyazar') then tip := 'evrengezer'; end if;
  gun := greatest(1, least(3650, coalesce(p_gun, 30)));
  select id into hedef from public.profiller where lower(kullanici_adi) = lower(trim(p_kullanici_adi)) limit 1;
  if hedef is null then return json_build_object('durum', 'yok'); end if;
  insert into public.abonelikler (id, tip, bitis, guncelleme) values (hedef, tip, now() + make_interval(days => gun), now())
  on conflict (id) do update set tip = excluded.tip, bitis = excluded.bitis, guncelleme = now();
  return json_build_object('durum', 'tamam', 'tip', tip, 'gun', gun, 'bitis', now() + make_interval(days => gun));
end; $$;
