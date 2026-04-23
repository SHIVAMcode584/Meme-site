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

grant execute on function public.admin_delete_meme(uuid) to authenticated;
