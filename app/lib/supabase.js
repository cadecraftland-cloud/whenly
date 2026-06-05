// ---------------------------------------------------------------------------
// supabase.js — creates the connection to our online database.
//
// The two values come from your Supabase project and are read from the
// .env.local file (see .env.local.example). The "anon" key is safe to ship to
// the browser: it's public by design, and what users are allowed to do is
// controlled by the Row Level Security policies we set up in schema.sql.
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey);
