-- Search analytics events table (cross-device/server-side)
create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  source text not null,
  has_suggestion_match boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_events_created_at on public.search_events (created_at desc);
create index if not exists idx_search_events_keyword on public.search_events (keyword);
create index if not exists idx_search_events_no_match on public.search_events (has_suggestion_match, created_at desc);

comment on table public.search_events is 'Search submission analytics events from global search component';
