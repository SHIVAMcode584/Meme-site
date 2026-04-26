alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like', 'comment', 'moderation', 'warning', 'meme'));

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

drop trigger if exists notify_on_meme_insert on public."meme-table";
create trigger notify_on_meme_insert
after insert on public."meme-table"
for each row
execute function public.notify_on_meme_insert();
