alter table public.profiles
  add column if not exists role text;

-- Existing accounts can stay as NULL/"user" by default.
-- Set your admin account manually in Supabase after applying this migration:
-- update public.profiles set role = 'admin' where id = '<your-auth-user-id>';
