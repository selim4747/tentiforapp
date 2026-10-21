-- 6.6.1 profile privacy hardening. Apply after the base profile/discovery setup.
alter table public.profiller enable row level security;
drop policy if exists "profiller herkese açık" on public.profiller;
drop policy if exists "kendi profilini okur" on public.profiller;
create policy "kendi profilini okur" on public.profiller
  for select using (auth.uid() = id);
create or replace view public.public_profiller as
select id, kullanici_adi, gorunen_ad, gorsel, tentifor_adi, hakkinda, vitrin,
       olusturma, guncelleme, profil_arama_gorunur, profil_icerik_gorunur, takip_listesi_gorunur
from public.profiller
where coalesce(profil_arama_gorunur, true);
grant select on public.public_profiller to anon, authenticated;
create or replace function public.kullanici_adi_uygun_mu(p_kullanici_adi text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when btrim(coalesce(p_kullanici_adi, '')) !~ '^[a-z0-9_]{3,20}$' then false
    else not exists (select 1 from public.profiller where kullanici_adi = lower(btrim(p_kullanici_adi))) end;
$$;
revoke all on function public.kullanici_adi_uygun_mu(text) from public;
grant execute on function public.kullanici_adi_uygun_mu(text) to anon, authenticated;
create or replace view public.arsivci_seviyeleri as
  with p as (
    select p.id, p.kullanici_adi, p.gorunen_ad, s.tamlik, s.gun, s.madalya, s.katman, s.okunan_kutu, s.oyun_xp
    from public.profiller p left join public.istatistikler s on s.id = p.id
    where p.kullanici_adi is not null
      and coalesce(p.profil_arama_gorunur, true)
      and coalesce(p.profil_icerik_gorunur, true)
      and not coalesce(s.engelli or s.askida or s.gizli, false)),
  x as (
    select p.*,
      coalesce(p.tamlik, 0) * 20 as x_tamlik,
      coalesce(p.gun, 0) * 5 as x_gun,
      coalesce(p.madalya, 0) * 30 as x_madalya,
      coalesce(p.katman, 0) * 40 as x_katman,
      coalesce(p.okunan_kutu, 0) * 10 as x_okuma,
      coalesce(p.oyun_xp, 0) as x_oyun,
      -- yarış: günde (UTC) yalnızca ilk 3 geçerli oyun XP verir; puansız (cevapsız) oyun sayılmaz
      10 * (select count(*) from (select row_number() over (partition by (y.zaman at time zone 'utc')::date order by y.zaman) as sira
              from public.yaris_skorlari y where y.kullanici = p.id and not y.supheli and y.puan > 0) q where q.sira <= 3) as x_yaris,
      15 * (select count(*) from public.kesifler k where k.kullanici = p.id) as x_kesif,
      25 * (select count(*) from public.kesifler k where k.kullanici = p.id
              and not exists (select 1 from public.kesifler k2 where k2.anahtar = k.anahtar and k2.zaman < k.zaman)) as x_ilk_kasif,
      25 * (select count(*) from public.gk_tahminler g where g.kullanici = p.id and g.cozuldu) as x_gk,
      5 * (select count(*) from public.teoriler t where t.kullanici = p.id and not t.gizli) as x_teori,
      3 * (select count(*) from public.teori_begenileri b join public.teoriler t on t.id = b.teori
             where t.kullanici = p.id and not t.gizli and b.kullanici <> p.id) as x_begeni,
      50 * (select count(*) from public.teoriler t where t.kullanici = p.id and t.isaret = 'kanon')
      + 20 * (select count(*) from public.teoriler t where t.kullanici = p.id and t.isaret = 'yakin') as x_isaret,
      5 * (select count(*) from public.yapim_oylari o where o.kullanici = p.id) as x_oy,
      20 * (select count(*) from public.hickirik_taniklari h where h.kullanici = p.id) as x_hickirik,
      100 * (select count(*) from public.av_cozumleri a where a.kullanici = p.id) as x_av,
      10 * (select count(*) from public.defter_cumleleri c where c.kullanici = p.id and not c.gizli)
      + 2 * (select count(*) from public.defter_oylari o join public.defter_cumleleri c on c.id = o.cumle where c.kullanici = p.id and not c.gizli) as x_defter,
      15 * (select count(*) from public.yazar_sorulari q where q.kullanici = p.id and q.cevap is not null) as x_soru,
      5 * (select count(*) from public.okur_bulmaca_cozumleri z where z.kullanici = p.id)
      + least(100, 2 * (select count(*) from public.okur_bulmaca_cozumleri z join public.okur_bulmacalari b on b.id = z.bulmaca where b.kullanici = p.id)) as x_okur_bulmaca,
      least(500, 50 * (select count(*) from public.davetler d join public.istatistikler s2 on s2.id = d.davetli where d.davet_eden = p.id and coalesce(s2.gun, 0) >= 3))
      + 30 * (select count(*) from public.davetler d join public.istatistikler s2 on s2.id = d.davetli where d.davetli = p.id and coalesce(s2.gun, 0) >= 3) as x_davet,
      10 * (select count(*) from (select y.sezon, row_number() over (partition by (y.zaman at time zone 'utc')::date order by y.zaman) as sira
              from public.yaris_skorlari y where y.kullanici = p.id and not y.supheli and y.puan > 0) q
            where q.sira <= 3 and q.sezon / 100 = public.tomye_ay(now()) / 100)
      + 25 * (select count(*) from public.gk_tahminler g where g.kullanici = p.id and g.cozuldu and public.tomye_ay(g.gun::timestamptz) / 100 = public.tomye_ay(now()) / 100)
      + 15 * (select count(*) from public.kesifler k where k.kullanici = p.id and public.tomye_ay(k.zaman) / 100 = public.tomye_ay(now()) / 100) as yil_xp
    from p),
  t as (
    select x.*, x_tamlik + x_gun + x_madalya + x_katman + x_yaris + x_kesif + x_ilk_kasif + x_gk + x_teori + x_begeni + x_isaret + x_oy + x_hickirik + x_av + x_defter + x_soru + x_okur_bulmaca + x_davet + x_okuma + x_oyun as xp
    from x)
  select kullanici_adi, gorunen_ad, xp, yil_xp,
    (floor(sqrt(xp / 60.0)) + 1)::int as seviye,
    floor((-3 + sqrt(25 + 0.8 * xp)) / 2)::int as basamak,
    jsonb_build_object('tamlik', x_tamlik, 'gun', x_gun, 'madalya', x_madalya, 'katman', x_katman, 'yaris', x_yaris,
      'kesif', x_kesif, 'ilk_kasif', x_ilk_kasif, 'gk', x_gk, 'teori', x_teori, 'begeni', x_begeni,
      'isaret', x_isaret, 'oy', x_oy, 'hickirik', x_hickirik, 'av', x_av,
      'defter', x_defter, 'soru', x_soru, 'okur_bulmaca', x_okur_bulmaca, 'davet', x_davet, 'okuma', x_okuma, 'oyun', x_oyun) as dokum
  from t;

create or replace function public.kurulum_surumu() returns text
language sql stable security definer set search_path = '' as $$ select '6.6.1'::text $$;
revoke all on function public.kurulum_surumu() from public;
grant execute on function public.kurulum_surumu() to anon, authenticated;
