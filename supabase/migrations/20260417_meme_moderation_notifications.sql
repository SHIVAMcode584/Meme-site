alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like', 'comment', 'moderation'));

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

drop trigger if exists notify_on_meme_admin_delete on public."meme-table";
create trigger notify_on_meme_admin_delete
before delete on public."meme-table"
for each row
execute function public.notify_meme_deleted_by_admin();
