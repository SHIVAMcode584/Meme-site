create extension if not exists pgcrypto;

drop trigger if exists notify_on_like_insert on public.likes;
drop trigger if exists notify_on_comment_insert on public.comments;

drop function if exists public.handle_like_notification();
drop function if exists public.handle_comment_notification();
drop function if exists public.create_notification(uuid, uuid, uuid, text);

drop table if exists public.notifications cascade;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  meme_id uuid references public."meme-table" (id) on delete set null,
  type text not null check (type in ('like', 'comment')),
  message text not null check (char_length(btrim(message)) > 0),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

create index notifications_sender_idx
  on public.notifications (sender_id);

create index notifications_meme_idx
  on public.notifications (meme_id);

grant select, update on table public.notifications to authenticated, service_role;

alter table public.notifications enable row level security;

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

create trigger notify_on_like_insert
after insert on public.likes
for each row
execute function public.handle_like_notification();

create trigger notify_on_comment_insert
after insert on public.comments
for each row
execute function public.handle_comment_notification();

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
