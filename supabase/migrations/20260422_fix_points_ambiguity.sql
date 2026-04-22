create or replace function public.increment_points(amount integer default 10)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles as p
  set points = coalesce(p.points, 0) + greatest(coalesce(amount, 0), 0)
  where p.id = auth.uid();

  if not found then
    raise exception 'Profile row not found for current user';
  end if;
end;
$$;

create or replace function public.award_points_on_meme_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_username text;
begin
  if new.user_id is null then
    return new;
  end if;

  fallback_username :=
    coalesce(
      (select p.username from public.profiles p where p.id = new.user_id),
      (select u.raw_user_meta_data->>'username' from auth.users u where u.id = new.user_id),
      'User'
    );

  insert into public.profiles as p (id, username, points)
  values (new.user_id, fallback_username, 10)
  on conflict (id) do update
    set points = coalesce(p.points, 0) + 10;

  return new;
end;
$$;

drop trigger if exists award_points_on_meme_insert on public."meme-table";
create trigger award_points_on_meme_insert
after insert on public."meme-table"
for each row
execute function public.award_points_on_meme_insert();

grant execute on function public.increment_points(integer) to authenticated, service_role;
grant execute on function public.award_points_on_meme_insert() to authenticated, service_role;
