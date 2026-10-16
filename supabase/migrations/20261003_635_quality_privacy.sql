-- TentiforApp 6.3.5 — arşivci analitiği ve veri dışa aktarma
create or replace function public.arsivci_istatistikleri(p_kullanici_adi text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); hedef uuid; kadi text;
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  if p_kullanici_adi is null then hedef:=uid; else select id into hedef from public.profiller where lower(kullanici_adi)=lower(btrim(p_kullanici_adi)); end if;
  if hedef is null or (hedef<>uid and not exists(select 1 from public.profiller where id=hedef and profil_arama_gorunur and profil_icerik_gorunur)) then return jsonb_build_object('durum','yok'); end if;
  select kullanici_adi into kadi from public.profiller where id=hedef;
  return jsonb_build_object('durum','tamam','kullanici_adi',kadi,'takipci',(select count(*) from public.takipler where takip_edilen=hedef),'takip',(select count(*) from public.takipler where takip_eden=hedef),'public_evren',(select count(*) from public.yayindaki_evrenler y join public.basvurular b on b.id=y.basvuru where b.gonderen=hedef),'ziyaret_30',(select coalesce(sum(sayi),0) from public.evren_sayaclari z join public.yayindaki_evrenler y on y.slug=z.evren join public.basvurular b on b.id=y.basvuru where b.gonderen=hedef and z.gun>(now() at time zone 'utc')::date-30),'raf',case when hedef=uid then (select count(*) from public.kisisel_raf where kullanici=uid) else 0 end,'taslak',(select count(*) from public.evren_taslaklari where sahibi=hedef));
end;
$$;
revoke all on function public.arsivci_istatistikleri(text) from public;
grant execute on function public.arsivci_istatistikleri(text) to authenticated;

create or replace function public.veri_disa_aktar() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then return jsonb_build_object('durum','giris'); end if;
  return jsonb_build_object('surum','6.3.7','olusturma',now(),'profil',(select jsonb_build_object('kullanici_adi',kullanici_adi,'gorunen_ad',gorunen_ad,'tentifor_adi',tentifor_adi,'hakkinda',hakkinda,'vitrin',vitrin,'profil_arama_gorunur',profil_arama_gorunur,'profil_icerik_gorunur',profil_icerik_gorunur) from public.profiller where id=uid),'raflar',coalesce((select jsonb_agg(to_jsonb(r) order by eklenme) from public.kisisel_raf r where kullanici=uid),'[]'::jsonb),'okuma_yollari',coalesce((select jsonb_agg(jsonb_build_object('id',y.id,'evren_id',y.evren_id,'baslik',y.baslik,'aciklama',y.aciklama,'public',y.public_mu,'adim',coalesce((select jsonb_agg(to_jsonb(a) order by a.sira) from public.okuma_yolu_adimlari a where a.yol=y.id),'[]'::jsonb)) from public.okuma_yollari y where sahibi=uid),'[]'::jsonb),'taslaklar',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'evren_id',t.evren_id,'baslik',t.baslik,'surum',t.surum,'durum',t.durum,'veri',t.veri) order by t.olusturma) from public.evren_taslaklari t where sahibi=uid),'[]'::jsonb));
end;
$$;
revoke all on function public.veri_disa_aktar() from public, anon;
grant execute on function public.veri_disa_aktar() to authenticated;
notify pgrst, 'reload schema';
