-- Hardening from the stress test.
-- 1. custom_alerts: only the preview account can create or change them (checked in the database, not just the browser), with a size check on params.
-- 2. A cap on active rows per person for custom_alerts and alert_watches, so one account cannot flood the daily job.
-- 3. api_usage + bump_usage: a durable per-day counter the server uses to cap AI and email routes (the in-memory limiter resets on every cold start).
-- Additive and safe to run twice.

drop policy if exists custom_alerts_owner on custom_alerts;
create policy custom_alerts_owner on custom_alerts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'email') = 'millwalahaider2005@gmail.com');

alter table custom_alerts drop constraint if exists custom_alerts_params_shape;
alter table custom_alerts add constraint custom_alerts_params_shape check (jsonb_typeof(params) = 'object' and pg_column_size(params) < 2000);

create or replace function public.cap_active_rows() returns trigger language plpgsql set search_path = public as $$
declare n int;
begin
  execute format('select count(*) from public.%I where user_id = $1 and active', tg_table_name) into n using new.user_id;
  if n >= tg_argv[0]::int then
    raise exception 'Too many active alerts (the limit is %).', tg_argv[0] using errcode = '54000';
  end if;
  return new;
end $$;

drop trigger if exists custom_alerts_cap on custom_alerts;
create trigger custom_alerts_cap before insert on custom_alerts for each row execute function public.cap_active_rows(40);
drop trigger if exists alert_watches_cap on alert_watches;
create trigger alert_watches_cap before insert on alert_watches for each row execute function public.cap_active_rows(40);

create table if not exists public.api_usage (
  key text primary key,
  day date not null default current_date,
  n int not null default 0
);
alter table public.api_usage enable row level security;
revoke all on table public.api_usage from anon, authenticated;
grant all on table public.api_usage to service_role;

create or replace function public.bump_usage(p_key text, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.api_usage (key, day, n) values (p_key, current_date, 1)
  on conflict (key) do update
    set n = case when public.api_usage.day = current_date then public.api_usage.n + 1 else 1 end, day = current_date
  returning n into c;
  return c <= p_limit;
end $$;
revoke all on function public.bump_usage(text, int) from public, anon, authenticated;
grant execute on function public.bump_usage(text, int) to service_role;
