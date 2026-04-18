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

  insert into public.profiles (id, username, points)
  values (new.user_id, fallback_username, 10)
  on conflict (id) do update
    set points = coalesce(points, 0) + 10;

  return new;
end;
$$;

drop trigger if exists award_points_on_meme_insert on public."meme-table";
create trigger award_points_on_meme_insert
after insert on public."meme-table"
for each row
execute function public.award_points_on_meme_insert();

grant execute on function public.award_points_on_meme_insert() to authenticated, service_role;

update public.profiles as p
set points = coalesce(meme_points.total_points, 0)
from (
  select user_id, count(*) * 10 as total_points
  from public."meme-table"
  where user_id is not null
  group by user_id
) as meme_points
where p.id = meme_points.user_id;
