create extension if not exists pgcrypto;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meme_id uuid not null references public."meme-table" (id) on delete cascade,
  text text not null check (char_length(btrim(text)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists comments_meme_id_created_at_idx
  on public.comments (meme_id, created_at desc);

create index if not exists comments_user_id_idx
  on public.comments (user_id);

grant select, insert, update, delete on table public.comments to anon, authenticated, service_role;

alter table public.comments enable row level security;

drop policy if exists "Anyone can read comments" on public.comments;
create policy "Anyone can read comments"
  on public.comments
  for select
  using (true);

drop policy if exists "Authenticated users can add their own comments" on public.comments;
create policy "Authenticated users can add their own comments"
  on public.comments
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments"
  on public.comments
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own comments" on public.comments;
create policy "Users can update their own comments"
  on public.comments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
