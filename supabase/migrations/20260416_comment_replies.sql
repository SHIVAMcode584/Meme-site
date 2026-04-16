alter table public.comments
  add column if not exists parent_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_parent_id_fkey'
  ) then
    alter table public.comments
      add constraint comments_parent_id_fkey
      foreign key (parent_id)
      references public.comments (id)
      on delete cascade;
  end if;
end
$$;

create index if not exists comments_parent_id_idx
  on public.comments (parent_id);

create index if not exists comments_meme_parent_created_idx
  on public.comments (meme_id, parent_id, created_at desc);

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

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where pr.prpubid = (
      select oid from pg_publication where pubname = 'supabase_realtime'
    )
      and n.nspname = 'public'
      and c.relname = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end
$$;
