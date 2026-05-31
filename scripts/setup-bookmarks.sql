-- Bookmarks table for user favorites
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_id text not null,
  scene_name text not null,
  city text,
  created_at timestamptz not null default now(),
  unique(user_id, scene_id)
);

create index if not exists idx_bookmarks_user_id on public.bookmarks (user_id);
create index if not exists idx_bookmarks_created_at on public.bookmarks (created_at desc);

comment on table public.bookmarks is 'User favorite scenes/places bookmarks';
