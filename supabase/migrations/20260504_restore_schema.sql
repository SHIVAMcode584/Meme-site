-- Restore script for a wiped Supabase database.
-- This recreates the schema the app expects.
-- It cannot recover deleted row data unless you have a backup or PITR enabled.

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  points integer not null default 0,
  role text,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_key
  on public.profiles (username);

create index if not exists profiles_points_idx
  on public.profiles (points desc);

create table if not exists public."meme-table" (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text,
  image_url text not null,
  category text,
  mood text,
  keywords text,
  description text,
  is_auto boolean not null default false,
  original_source text,
  original_meme_id uuid references public."meme-table" (id) on delete set null,
  top_text text,
  bottom_text text,
  embedding vector(1536),
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public."meme-table"
  add column if not exists description text;

alter table public."meme-table"
  add column if not exists embedding vector(1536);

alter table public."meme-table"
  add column if not exists slug text;

alter table public."meme-table"
  add column if not exists is_auto boolean not null default false;

alter table public."meme-table"
  add column if not exists original_source text;

alter table public."meme-table"
  add column if not exists original_meme_id uuid references public."meme-table" (id) on delete set null;

alter table public."meme-table"
  add column if not exists top_text text;

alter table public."meme-table"
  add column if not exists bottom_text text;

create unique index if not exists meme_table_slug_key
  on public."meme-table" (slug);

create unique index if not exists meme_table_image_url_key
  on public."meme-table" (image_url);

create index if not exists meme_table_created_at_idx
  on public."meme-table" (created_at desc);

create index if not exists meme_table_user_id_idx
  on public."meme-table" (user_id);

create index if not exists meme_table_original_meme_id_idx
  on public."meme-table" (original_meme_id);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meme_id uuid not null references public."meme-table" (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists likes_user_meme_unique_idx
  on public.likes (user_id, meme_id);

create index if not exists likes_meme_id_idx
  on public.likes (meme_id);

create index if not exists likes_user_id_idx
  on public.likes (user_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meme_id uuid not null references public."meme-table" (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  text text not null check (char_length(btrim(text)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists comments_meme_id_created_at_idx
  on public.comments (meme_id, created_at desc);

create index if not exists comments_user_id_idx
  on public.comments (user_id);

create index if not exists comments_parent_id_idx
  on public.comments (parent_id);

create index if not exists comments_meme_parent_created_idx
  on public.comments (meme_id, parent_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  meme_id uuid references public."meme-table" (id) on delete set null,
  type text not null check (type in ('like', 'comment', 'moderation', 'warning', 'meme')),
  message text not null check (char_length(btrim(message)) > 0),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

create index if not exists notifications_sender_idx
  on public.notifications (sender_id);

create index if not exists notifications_meme_idx
  on public.notifications (meme_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meme_id uuid references public."meme-table" (id) on delete set null,
  reason text not null check (char_length(btrim(reason)) > 0),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'removed')),
  created_at timestamptz not null default now()
);

create unique index if not exists reports_user_meme_unique_idx
  on public.reports (user_id, meme_id);

create index if not exists reports_status_created_at_idx
  on public.reports (status, created_at desc);

create index if not exists reports_meme_id_idx
  on public.reports (meme_id);

create index if not exists reports_user_id_idx
  on public.reports (user_id);

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

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(role::text, '')) = 'admin'
  );
$$;

create or replace function public.increment_points(amount integer default 10)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set points = coalesce(points, 0) + greatest(coalesce(amount, 0), 0)
  where id = auth.uid();

  if not found then
    raise exception 'Profile row not found for current user';
  end if;
end;
$$;

create or replace function public.sync_profile_points_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_username text;
  meme_count integer;
begin
  if p_user_id is null then
    return;
  end if;

  select count(*)::integer
  into meme_count
  from public."meme-table"
  where user_id = p_user_id;

  select coalesce(
    (select p.username from public.profiles p where p.id = p_user_id),
    (select u.raw_user_meta_data->>'username' from auth.users u where u.id = p_user_id),
    'User'
  )
  into fallback_username;

  insert into public.profiles as p (id, username, points)
  values (p_user_id, fallback_username, coalesce(meme_count, 0) * 10)
  on conflict (id) do update
    set points = excluded.points;
end;
$$;

create or replace function public.sync_profile_points_on_meme_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.sync_profile_points_for_user(new.user_id);
  elsif tg_op = 'DELETE' then
    perform public.sync_profile_points_for_user(old.user_id);
  else
    if old.user_id is distinct from new.user_id then
      perform public.sync_profile_points_for_user(old.user_id);
    end if;

    perform public.sync_profile_points_for_user(new.user_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.create_notification(
  _receiver_id uuid,
  _sender_id uuid,
  _meme_id uuid,
  _kind text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  meme_title text;
  notification_message text;
begin
  if _receiver_id is null or _sender_id is null or _meme_id is null then
    return;
  end if;

  if _receiver_id = _sender_id then
    return;
  end if;

  select coalesce(p.username, 'Someone') into sender_name
  from public.profiles p
  where p.id = _sender_id;

  select coalesce(m.title, 'your meme') into meme_title
  from public."meme-table" m
  where m.id = _meme_id;

  notification_message :=
    case _kind
      when 'like' then sender_name || ' liked your meme'
      when 'comment' then sender_name || ' commented on your meme'
      else sender_name || ' interacted with ' || meme_title
    end;

  insert into public.notifications (
    user_id,
    sender_id,
    meme_id,
    type,
    message,
    is_read
  ) values (
    _receiver_id,
    _sender_id,
    _meme_id,
    _kind,
    notification_message,
    false
  );
end;
$$;

create or replace function public.handle_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meme_owner_id uuid;
begin
  select m.user_id into meme_owner_id
  from public."meme-table" m
  where m.id = new.meme_id;

  perform public.create_notification(meme_owner_id, new.user_id, new.meme_id, 'like');

  return new;
end;
$$;

create or replace function public.handle_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meme_owner_id uuid;
begin
  select m.user_id into meme_owner_id
  from public."meme-table" m
  where m.id = new.meme_id;

  perform public.create_notification(meme_owner_id, new.user_id, new.meme_id, 'comment');

  return new;
end;
$$;

create or replace function public.notify_on_meme_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  if new.user_id is null then
    return new;
  end if;

  sender_name := coalesce(
    (select p.username from public.profiles p where p.id = new.user_id),
    'Someone'
  );

  insert into public.notifications (
    user_id,
    sender_id,
    meme_id,
    type,
    message,
    is_read
  )
  select
    p.id,
    new.user_id,
    new.id,
    'meme',
    sender_name || ' added a new meme: ' || coalesce(new.title, 'Meme'),
    false
  from public.profiles p
  where p.id is not null
    and p.id <> new.user_id;

  return new;
end;
$$;

create or replace function public.notify_meme_deleted_by_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid := auth.uid();
  reporter record;
begin
  if admin_id is null then
    return old;
  end if;

  if old.user_id is not null and old.user_id <> admin_id then
    insert into public.notifications (
      user_id,
      sender_id,
      meme_id,
      type,
      message,
      is_read
    ) values (
      old.user_id,
      admin_id,
      old.id,
      'moderation',
      'Your meme was removed by an admin after a report.',
      false
    );
  end if;

  for reporter in
    select distinct r.user_id
    from public.reports r
    where r.meme_id = old.id
      and r.user_id is not null
      and r.user_id <> old.user_id
  loop
    insert into public.notifications (
      user_id,
      sender_id,
      meme_id,
      type,
      message,
      is_read
    ) values (
      reporter.user_id,
      admin_id,
      old.id,
      'moderation',
      'The meme you reported was removed by an admin.',
      false
    );
  end loop;

  return old;
end;
$$;

create or replace function public.admin_delete_meme(_meme_id uuid)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete memes';
  end if;

  return query
    with related_reports as (
      select id
      from public.reports
      where meme_id = _meme_id
    ),
    mark_reports as (
      update public.reports
      set status = 'removed'
      where meme_id = _meme_id
      returning id
    ),
    delete_likes as (
      delete from public.likes
      where meme_id = _meme_id
      returning id
    ),
    delete_comments as (
      delete from public.comments
      where meme_id = _meme_id
      returning id
    ),
    delete_notifications as (
      delete from public.notifications
      where meme_id = _meme_id
      returning id
    ),
    delete_meme as (
      delete from public."meme-table"
      where id = _meme_id
      returning id
    )
    select id
    from related_reports;
end;
$$;

create or replace function public.match_memes(
  query_embedding vector(1536),
  match_count int default 10,
  match_threshold float default 0.2,
  filter_category text default null
)
returns table (
  id uuid,
  title text,
  slug text,
  image_url text,
  category text,
  mood text,
  keywords text,
  user_id uuid,
  created_at timestamptz,
  description text,
  similarity float,
  username text
)
language sql
stable
set search_path = public
as $$
  select
    m.id,
    m.title,
    m.slug,
    m.image_url,
    m.category::text,
    m.mood::text,
    m.keywords::text,
    m.user_id,
    m.created_at,
    m.description,
    1 - (m.embedding <=> query_embedding) as similarity,
    coalesce(p.username, 'User') as username
  from public."meme-table" as m
  left join public.profiles as p on p.id = m.user_id
  where m.embedding is not null
    and (
      filter_category is null
      or filter_category = 'All'
      or lower(m.category::text) = lower(filter_category)
    )
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant select, insert, update, delete on table public.profiles to anon, authenticated, service_role;
grant select, insert, update, delete on table public."meme-table" to anon, authenticated, service_role;
grant select, insert, delete on table public.likes to anon, authenticated, service_role;
grant select, insert, update, delete on table public.comments to anon, authenticated, service_role;
grant select, insert, update on table public.notifications to authenticated, service_role;
grant select, insert, update, delete on table public.reports to authenticated, service_role;
grant select, insert, update, delete on table public.saved_rizz to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public."meme-table" enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.saved_rizz enable row level security;

drop policy if exists "Anyone can read profiles" on public.profiles;
create policy "Anyone can read profiles"
  on public.profiles
  for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Anyone can read memes" on public."meme-table";
create policy "Anyone can read memes"
  on public."meme-table"
  for select
  using (true);

drop policy if exists "Authenticated users can add memes" on public."meme-table";
create policy "Authenticated users can add memes"
  on public."meme-table"
  for insert
  to authenticated
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can update their memes" on public."meme-table";
create policy "Users can update their memes"
  on public."meme-table"
  for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can delete their memes" on public."meme-table";
create policy "Users can delete their memes"
  on public."meme-table"
  for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Anyone can read likes" on public.likes;
create policy "Anyone can read likes"
  on public.likes
  for select
  using (true);

drop policy if exists "Authenticated users can like memes" on public.likes;
create policy "Authenticated users can like memes"
  on public.likes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can unlike memes" on public.likes;
create policy "Authenticated users can unlike memes"
  on public.likes
  for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

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
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can update their own comments" on public.comments;
create policy "Users can update their own comments"
  on public.comments
  for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can view their notifications" on public.notifications;
create policy "Users can view their notifications"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can mark their notifications read" on public.notifications;
create policy "Users can mark their notifications read"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can send notifications" on public.notifications;
create policy "Users can send notifications"
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid() = sender_id or public.is_admin());

drop policy if exists "Authenticated users can submit reports" on public.reports;
create policy "Authenticated users can submit reports"
  on public.reports
  for insert
  to authenticated
  with check (auth.uid() = user_id and meme_id is not null);

drop policy if exists "Admins can view reports" on public.reports;
create policy "Admins can view reports"
  on public.reports
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update reports" on public.reports;
create policy "Admins can update reports"
  on public.reports
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete reports" on public.reports;
create policy "Admins can delete reports"
  on public.reports
  for delete
  to authenticated
  using (public.is_admin());

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

drop trigger if exists award_points_on_meme_insert on public."meme-table";
drop trigger if exists sync_profile_points_on_meme_change on public."meme-table";
drop trigger if exists notify_on_like_insert on public.likes;
drop trigger if exists notify_on_comment_insert on public.comments;
drop trigger if exists notify_on_meme_insert on public."meme-table";
drop trigger if exists notify_on_meme_admin_delete on public."meme-table";

create trigger sync_profile_points_on_meme_change
after insert or delete or update of user_id on public."meme-table"
for each row
execute function public.sync_profile_points_on_meme_change();

create trigger notify_on_like_insert
after insert on public.likes
for each row
execute function public.handle_like_notification();

create trigger notify_on_comment_insert
after insert on public.comments
for each row
execute function public.handle_comment_notification();

create trigger notify_on_meme_insert
after insert on public."meme-table"
for each row
execute function public.notify_on_meme_insert();

create trigger notify_on_meme_admin_delete
before delete on public."meme-table"
for each row
execute function public.notify_meme_deleted_by_admin();

grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.increment_points(integer) to authenticated, service_role;
grant execute on function public.sync_profile_points_for_user(uuid) to authenticated, service_role;
grant execute on function public.sync_profile_points_on_meme_change() to authenticated, service_role;
grant execute on function public.admin_delete_meme(uuid) to authenticated;
grant execute on function public.match_memes(vector, int, float, text) to anon, authenticated, service_role;

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
      and c.relname = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

update public.profiles as p
set points = coalesce(meme_points.total_points, 0)
from (
  select user_id, count(*) * 10 as total_points
  from public."meme-table"
  where user_id is not null
  group by user_id
) as meme_points
where p.id = meme_points.user_id;

update public.profiles as p
set points = 0
where not exists (
  select 1
  from public."meme-table" m
  where m.user_id = p.id
);
