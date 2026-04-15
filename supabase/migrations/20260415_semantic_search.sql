-- Enable vector support
create extension if not exists vector;

-- Ensure searchable fields exist
alter table public."meme-table"
  add column if not exists description text;

alter table public."meme-table"
  add column if not exists embedding vector(1536);

-- Vector index for cosine similarity
create index if not exists meme_table_embedding_cosine_idx
  on public."meme-table"
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Semantic nearest-neighbor function
create or replace function public.match_memes(
  query_embedding vector(1536),
  match_count int default 10,
  match_threshold float default 0.2,
  filter_category text default null
)
returns table (
  id uuid,
  title text,
  slug text,
  image_url text,
  category text,
  mood text,
  keywords text,
  user_id uuid,
  created_at timestamptz,
  description text,
  similarity float,
  username text
)
language sql
stable
set search_path = public
as $$
  select
    m.id,
    m.title,
    m.slug,
    m.image_url,
    m.category::text,
    m.mood::text,
    m.keywords::text,
    m.user_id,
    m.created_at,
    m.description,
    1 - (m.embedding <=> query_embedding) as similarity,
    coalesce(p.username, 'User') as username
  from public."meme-table" as m
  left join public.profiles as p on p.id = m.user_id
  where m.embedding is not null
    and (
      filter_category is null
      or filter_category = 'All'
      or lower(m.category::text) = lower(filter_category)
    )
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_memes(vector, int, float, text) to anon, authenticated, service_role;
