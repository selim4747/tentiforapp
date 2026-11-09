# Supabase şema ve fonksiyon test raporu

**Proje:** `tentiforapp` (`wlgtjbrlquefnzavwein`)
**Kontrol tarihi:** 2026-11-09
**Canlı durum:** ACTIVE_HEALTHY

## Sonuç

P2/P3 migration’ları canlı projeye başarıyla uygulandı. Uygulama additive/nullable DDL ve security-definer RPC değişiklikleriyle sınırlı kaldı; kullanıcı verisi backfill edilmedi.

`public.kurulum_surumu()` artık `6.6.2` döndürüyor.

## Uygulanan migration’lar

- `p2_cross_module_entity_links`
- `p2_editor_uuid_roundtrip`
- `p2_canonical_entity_targets`
- `p3_engagement_cards_tasks`

## Doğrulananlar

| Kontrol | Sonuç |
|---|---|
| Proje | `wlgtjbrlquefnzavwein`, ACTIVE_HEALTHY |
| Kurulum sürümü | `6.6.2` |
| `evren_varliklari` | Mevcut, RLS açık |
| `evren_harita_dugumleri.varlik_id` | Nullable, RLS açık |
| `evren_zaman_olaylari.varlik_id` | Nullable, RLS açık |
| Entity registry satırı | 0; backfill yapılmadı |
| Mevcut map/timeline UUID bağlantısı | 0; backfill yapılmadı |
| P2/P3 RPC’leri | Mevcut ve security-definer |
| Yazma RPC’leri | Anon execute kapalı, authenticated execute açık |
| Public load/resolver RPC’leri | Yalnızca amaçlanan anon erişimi açık |
| Public resolver smoke testi | Bulunmayan/hedef dışı kayıt `null` döndürdü |
| P3 görev RPC anon davranışı | Kullanıcı bağlamı yokken veri döndürmedi |

## Güvenlik ve kapsam notları

- `evren_varliklari` doğrudan public/anon/authenticated tablo erişimine kapalıdır; yazma yalnızca yetkili RPC’ler üzerinden yapılır.
- Harita ve timeline `varlik_id` kolonları nullable bırakıldı; eski kayıtlar çalışmaya devam eder.
- Production verisinde otomatik UUID backfill çalıştırılmadı.
- Herhangi bir hediye, üyelik, bildirim veya kullanıcı içeriği değiştiren RPC çağrılmadı.
- Canlı testler salt-okunur sorgular ve şema/function privilege kontrolleriyle sınırlı kaldı.

## Önceki bulgular

Önceki canlı rapordaki genel danışman bulguları (policy kapsamı, security-definer view’lar, FK indexleri ve `auth.uid()` performans uyarıları) ayrı bir güvenlik/performance backlog’u olarak korunmalıdır; bu migration kapsamında geniş kapsamlı refactor yapılmamıştır.
