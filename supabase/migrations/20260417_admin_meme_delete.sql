grant select, insert, update, delete on table public."meme-table" to anon, authenticated, service_role;

drop policy if exists "Admins can delete memes" on public."meme-table";
create policy "Admins can delete memes"
  on public."meme-table"
  for delete
  to authenticated
  using (public.is_admin());
