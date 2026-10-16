-- TentiforApp 6.2.12 — audit and quality contracts
create table if not exists public.guvenlik_audit (
  id bigserial primary key,
  kullanici uuid references auth.users(id) on delete set null,
  olay text not null check (olay ~ '^[a-z0-9_.-]{1,80}$'),
  veri jsonb not null default '{}'::jsonb,
  zaman timestamptz not null default now()
);
create index if not exists guvenlik_audit_zaman_idx on public.guvenlik_audit (zaman desc);
alter table public.guvenlik_audit enable row level security;
revoke all on public.guvenlik_audit from public, anon, authenticated;
create or replace function public.guvenlik_audit_yaz(p_olay text, p_veri jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_olay is null or p_olay !~ '^[a-z0-9_.-]{1,80}$' then raise exception 'audit olayı geçersiz'; end if;
  insert into public.guvenlik_audit(kullanici, olay, veri) values (auth.uid(), p_olay, coalesce(p_veri, '{}'::jsonb));
end;
$$;
revoke all on function public.guvenlik_audit_yaz(text,jsonb) from public, anon, authenticated;
notify pgrst, 'reload schema';
