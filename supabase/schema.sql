-- ===========================================================================
-- Whenly database schema.
-- HOW TO USE: in your Supabase project, open "SQL Editor" -> "New query",
-- paste this whole file, and click "Run". It creates the two tables the app
-- needs and sets the access rules.
-- ===========================================================================

-- 1. events: one row per scheduling event that someone creates.
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dates jsonb not null,            -- e.g. ["2026-06-08","2026-06-09"]
  start_hour int not null,
  end_hour int not null,
  slot_minutes int not null default 60,
  created_at timestamptz not null default now()
);

-- 2. responses: one row per person's availability for a given event.
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  slots jsonb not null default '[]',   -- e.g. ["2026-06-08|600","2026-06-08|660"]
  created_at timestamptz not null default now(),
  unique (event_id, name)              -- one response per name per event (enables upsert)
);

-- 3. Row Level Security (RLS).
-- This app has no logins, so by design anyone who has an event's link may read
-- it and add their own availability. We turn on RLS and then add policies that
-- allow public read + insert/update, but NOT delete.
alter table events enable row level security;
alter table responses enable row level security;

create policy "events are publicly readable" on events
  for select using (true);
create policy "anyone can create an event" on events
  for insert with check (true);

create policy "responses are publicly readable" on responses
  for select using (true);
create policy "anyone can add a response" on responses
  for insert with check (true);
create policy "anyone can update a response" on responses
  for update using (true) with check (true);
