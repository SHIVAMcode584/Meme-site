alter table public."meme-table"
  add column if not exists is_auto boolean not null default false;

alter table public."meme-table"
  add column if not exists original_source text;

update public."meme-table"
set is_auto = coalesce(is_auto, false)
where is_auto is null;

delete from public."meme-table" a
using public."meme-table" b
where a.image_url = b.image_url
  and a.ctid < b.ctid;

create unique index if not exists meme_table_image_url_key
  on public."meme-table" (image_url);
