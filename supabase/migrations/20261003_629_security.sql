-- TentiforApp 6.2.9 — güvenlik ve migration sözleşmesi
-- PayTR entegrasyonu hukuk metinleri ve sağlayıcı kimlikleri gelene kadar kapalıdır.
create or replace function public.kurulum_surumu() returns text
language sql immutable set search_path = '' as $$ select '6.2.9'::text $$;

-- Public profil alanları için tablo yerine dar view sözleşmesi.
create or replace view public.public_profiller as
select id, kullanici_adi, gorunen_ad, gorsel, tentifor_adi, hakkinda, vitrin, olusturma, guncelleme
from public.profiller;
grant select on public.public_profiller to anon, authenticated;

-- Sunucu özeti kullanıcı tarafından yazılamaz; eski tablo policy'si kalsa bile trigger korur.
create or replace function public.profiller_sunucu_alanlarini_koru() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() = old.id and not public.tam_yonetici_mi() then
    new.ozet := old.ozet;
  end if;
  return new;
end;
$$;
drop trigger if exists profiller_sunucu_alanlari on public.profiller;
create trigger profiller_sunucu_alanlari before update on public.profiller
for each row execute function public.profiller_sunucu_alanlarini_koru();

-- Kanon değişikliği yalnızca kanon moderatör veya tam yönetici tarafından yapılabilir.
create or replace function public.moderator_kanon_dogrula(p_token text, p_kanon boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.moderator_oturumlari o
    join public.moderator_kodlari k on k.ozet = o.kod_ozet
    where o.token_ozet = public.mod_ozet(p_token, '#tok')
      and o.bitis > now() and k.aktif
      and (not coalesce(p_kanon, false) or k.duzey = 'kanon')
  );
$$;

-- Güvenlik regression için cevap anahtarı RPC çıktısına tekrar eklenmemeli.
notify pgrst, 'reload schema';
