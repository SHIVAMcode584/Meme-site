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

grant execute on function public.increment_points(integer) to authenticated, service_role;
