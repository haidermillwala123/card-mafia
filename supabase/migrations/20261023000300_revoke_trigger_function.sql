-- cap_active_rows is a trigger function: the database runs it, nobody should call it. Remove the default public execute right so it is not
-- listed as something the public API key could reach. Triggers keep working: the right is checked when a trigger is created, not each time it fires.
revoke execute on function public.cap_active_rows() from public, anon, authenticated;
