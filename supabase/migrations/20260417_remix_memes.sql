alter table public."meme-table"
  add column if not exists original_meme_id bigint references public."meme-table" (id) on delete set null;

alter table public."meme-table"
  add column if not exists top_text text;

alter table public."meme-table"
  add column if not exists bottom_text text;

create index if not exists meme_table_original_meme_id_idx
  on public."meme-table" (original_meme_id);
