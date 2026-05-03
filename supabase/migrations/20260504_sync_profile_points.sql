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

drop trigger if exists award_points_on_meme_insert on public."meme-table";
drop trigger if exists sync_profile_points_on_meme_change on public."meme-table";

create trigger sync_profile_points_on_meme_change
after insert or delete or update of user_id on public."meme-table"
for each row
execute function public.sync_profile_points_on_meme_change();

grant execute on function public.sync_profile_points_for_user(uuid) to authenticated, service_role;
grant execute on function public.sync_profile_points_on_meme_change() to authenticated, service_role;

do $$
declare
  meme_owner record;
begin
  for meme_owner in
    select distinct user_id
    from public."meme-table"
    where user_id is not null
  loop
    perform public.sync_profile_points_for_user(meme_owner.user_id);
  end loop;
end;
$$;

update public.profiles as p
set points = 0
where not exists (
  select 1
  from public."meme-table" m
  where m.user_id = p.id
);
