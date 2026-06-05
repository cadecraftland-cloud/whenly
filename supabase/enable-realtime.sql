-- OPTIONAL: makes results update *instantly* instead of every few seconds.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- (The app already auto-refreshes without this; this just makes it snappier.)

alter publication supabase_realtime add table responses;
