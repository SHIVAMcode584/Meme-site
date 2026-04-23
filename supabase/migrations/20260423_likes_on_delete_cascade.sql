alter table public.likes
  drop constraint if exists likes_meme_id_fkey;

alter table public.likes
  add constraint likes_meme_id_fkey
  foreign key (meme_id)
  references public."meme-table" (id)
  on delete cascade;
