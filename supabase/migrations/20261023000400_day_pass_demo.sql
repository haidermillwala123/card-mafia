-- Day pass (Rs 99, 24 hours), demo checkout.
-- subscriptions is server-written only (billing rows come from the payment webhook). Until a payment provider is connected, this function is the
-- one way a signed-in person gets a Day pass: it writes the same row a paid pass would, for 24 hours, and moves no money.
-- When live payments open, drop this function and let the webhook write the row instead. has_pro() already reads the row either way.
-- Additive only: one new function. Nothing existing is touched.

create or replace function public.buy_day_pass_demo() returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ends timestamptz := now() + interval '24 hours';
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  insert into public.subscriptions (user_id, tier, status, current_period_end)
  values (uid, 'day', 'active', ends);
  return ends;
exception when unique_violation then
  -- the Day pass is once per account, and one active plan at a time
  raise exception 'day pass not available' using errcode = '23505';
end;
$$;

revoke all on function public.buy_day_pass_demo() from public, anon;
grant execute on function public.buy_day_pass_demo() to authenticated;
