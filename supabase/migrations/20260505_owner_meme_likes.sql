create table if not exists public.owner_meme_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meme_key text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists owner_meme_likes_user_meme_unique_idx
  on public.owner_meme_likes (user_id, meme_key);

create index if not exists owner_meme_likes_meme_key_idx
  on public.owner_meme_likes (meme_key);

grant select, insert, delete on table public.owner_meme_likes to anon, authenticated, service_role;

alter table public.owner_meme_likes enable row level security;

drop policy if exists "Anyone can read owner meme likes" on public.owner_meme_likes;
create policy "Anyone can read owner meme likes"
  on public.owner_meme_likes
  for select
  using (true);

drop policy if exists "Authenticated users can like owner memes" on public.owner_meme_likes;
create policy "Authenticated users can like owner memes"
  on public.owner_meme_likes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can unlike owner memes" on public.owner_meme_likes;
create policy "Authenticated users can unlike owner memes"
  on public.owner_meme_likes
  for delete
  to authenticated
  using (auth.uid() = user_id);
