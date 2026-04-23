create extension if not exists pgcrypto;

create table if not exists public.saved_rizz (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  text_key text not null,
  category text,
  source text,
  created_at timestamptz not null default now()
);

create unique index if not exists saved_rizz_user_text_key_idx
  on public.saved_rizz (user_id, text_key);

create index if not exists saved_rizz_user_created_idx
  on public.saved_rizz (user_id, created_at desc);

alter table public.saved_rizz enable row level security;

drop policy if exists "Users can view their saved rizz" on public.saved_rizz;
create policy "Users can view their saved rizz"
  on public.saved_rizz
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can add their saved rizz" on public.saved_rizz;
create policy "Users can add their saved rizz"
  on public.saved_rizz
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their saved rizz" on public.saved_rizz;
create policy "Users can update their saved rizz"
  on public.saved_rizz
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their saved rizz" on public.saved_rizz;
create policy "Users can remove their saved rizz"
  on public.saved_rizz
  for delete
  to authenticated
  using (auth.uid() = user_id);
