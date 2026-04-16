create extension if not exists pgcrypto;

-- IMPORTANT:
-- This repo currently references uuid meme IDs in Supabase migrations.
-- If your public."meme-table".id is bigint instead, change meme_id below to bigint.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meme_id uuid references public."meme-table" (id) on delete set null,
  reason text not null check (char_length(btrim(reason)) > 0),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'removed')),
  created_at timestamptz not null default now()
);

alter table public.reports
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists meme_id uuid,
  add column if not exists reason text,
  add column if not exists status text default 'pending',
  add column if not exists created_at timestamptz default now();

alter table public.reports
  alter column id set default gen_random_uuid(),
  alter column status set default 'pending',
  alter column created_at set default now();

create unique index if not exists reports_user_meme_unique_idx
  on public.reports (user_id, meme_id);

create index if not exists reports_status_created_at_idx
  on public.reports (status, created_at desc);

create index if not exists reports_meme_id_idx
  on public.reports (meme_id);

create index if not exists reports_user_id_idx
  on public.reports (user_id);

grant select, insert, update, delete on table public.reports to anon, authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(role::text, '')) = 'admin'
  );
$$;

alter table public.reports enable row level security;

drop policy if exists "Authenticated users can submit reports" on public.reports;
create policy "Authenticated users can submit reports"
  on public.reports
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and meme_id is not null
  );

drop policy if exists "Admins can view reports" on public.reports;
create policy "Admins can view reports"
  on public.reports
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update reports" on public.reports;
create policy "Admins can update reports"
  on public.reports
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete reports" on public.reports;
create policy "Admins can delete reports"
  on public.reports
  for delete
  to authenticated
  using (public.is_admin());
