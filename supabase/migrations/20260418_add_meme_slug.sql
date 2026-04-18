alter table public."meme-table"
  add column if not exists slug text;

update public."meme-table"
set slug = concat(
  coalesce(
    nullif(
      regexp_replace(lower(coalesce(title, 'meme')), '[^a-z0-9]+', '-', 'g'),
      ''
    ),
    'meme'
  ),
  '-',
  substr(replace(id::text, '-', ''), 1, 8)
)
where slug is null or slug = '';

create unique index if not exists meme_table_slug_key
  on public."meme-table" (slug);
