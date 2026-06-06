-- ===========================================================================
-- Whenly migration v2 — adds: descriptions, invitee lists, friendly URL slugs,
-- close/reopen, delete, and a locked-in final time.
-- HOW TO USE: Supabase -> SQL Editor -> New query -> paste this -> Run.
-- (Safe to run more than once.)
-- ===========================================================================

alter table events add column if not exists description text;
alter table events add column if not exists invitees jsonb not null default '[]';
alter table events add column if not exists slug text;
alter table events add column if not exists closed boolean not null default false;
alter table events add column if not exists final_slot text;

-- Friendly links must be unique. (Multiple NULLs are allowed, so old rows are fine.)
create unique index if not exists events_slug_key on events (slug);

-- Let the organizer update (close/lock) and delete events.
-- NOTE: this app has no logins, so technically anyone with the link + anon key
-- could do this; the app only shows these controls to the creator. Adding real
-- accounts later would let us enforce true ownership.
drop policy if exists "anyone can update an event" on events;
create policy "anyone can update an event" on events
  for update using (true) with check (true);

drop policy if exists "anyone can delete an event" on events;
create policy "anyone can delete an event" on events
  for delete using (true);
