# RoastRiot.meme

RoastRiot.meme is a full-stack meme platform where users can discover, upload, like, and search memes based on moods, reactions, and real-life situations.

It combines a React frontend with a Supabase backend and includes authentication, meme uploads, likes, PWA support, and AI-assisted semantic search.

## Live Demo

https://meme-site-lovat.vercel.app/

## Features

- Email/password and magic link authentication
- Password reset flow
- Meme uploads with title, image, category, mood, and keywords
- Like and unlike support with duplicate protection
- Meme comments with optimistic posting and delete permissions
- User profiles with points
- Keyword search and semantic search fallback
- Trending memes based on engagement
- Installable PWA experience

## Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Framer Motion
- Lucide React

### Backend

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Vercel serverless functions

### Database

- PostgreSQL
- pgvector
- Row Level Security (RLS)

## Database Structure

### `meme-table`

- `id`
- `title`
- `image_url`
- `category`
- `mood`
- `keywords`
- `user_id`
- `created_at`
- `embedding`

### `profiles`

- `id`
- `username`
- `points`

### `likes`

- `id`
- `user_id`
- `meme_id`
- `created_at`

Constraint:

- Unique (`user_id`, `meme_id`)

### `comments`

- `id`
- `user_id`
- `meme_id`
- `text`
- `created_at`

## Security

- Users can only modify their own data
- Likes are protected with RLS policies
- Profiles are safely managed

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/SHIVAMcode584/Meme-site.git
cd Meme-site
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add environment variables

Set these in your local `.env` file and in Vercel project settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL` (optional, default: `text-embedding-3-small`)

### 4. Run the database migrations

Apply:

`supabase/migrations/20260415_semantic_search.sql`

and

`supabase/migrations/20260415_comments_system.sql`

This enables `pgvector`, adds the `embedding` column, and creates the `match_memes(...)` RPC.
The comments migration creates the `comments` table, enables RLS, and adds comment policies.

### 5. Backfill meme embeddings

Run once, or use `--force` to regenerate all embeddings:

```bash
npm run embeddings:backfill
# npm run embeddings:backfill -- --force
```

### 6. Run the app

For the normal frontend:

```bash
npm run dev
```

For local testing with the API route:

```bash
vercel dev
```

## Semantic Search API

Endpoint:

`POST /api/semantic-search`

Payload example:

```json
{
  "query": "friend ignored me",
  "limit": 24,
  "category": "All"
}
```

If AI search fails, the endpoint automatically falls back to keyword filtering.

## Troubleshooting

If you see "AI search unavailable", usually one of these is missing:

1. `OPENAI_API_KEY` in Vercel environment variables.
2. `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables.
3. The SQL migration was not applied, so `match_memes` does not exist.
4. Embeddings have not been backfilled yet.
5. You are running only `vite dev`, which does not serve the `api/` functions.

For local testing, either:

- Use `vercel dev`, or
- Set `VITE_SEMANTIC_API_URL` to your deployed endpoint.
