# Setting up the Supabase database (one-time, ~5 minutes)

Supabase is a free online database with a friendly dashboard. Follow these steps,
then paste the two values from Step 4 back to Claude.

## 1. Create an account + project
1. Go to **https://supabase.com** and click **Start your project** / **Sign up**
   (signing in with GitHub or Google is easiest).
2. Click **New project**.
3. Fill in:
   - **Name:** `whenly` (anything is fine)
   - **Database Password:** click **Generate a password** and let the browser
     save it (you won't need to type it for this app, but keep it somewhere).
   - **Region:** pick the one closest to you.
4. Click **Create new project** and wait ~2 minutes while it sets up.

## 2. Create the tables
1. In the left sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open the file `supabase/schema.sql` in this project, copy ALL of it, paste it
   into the editor, and click **Run** (or press Ctrl/Cmd + Enter).
4. You should see "Success. No rows returned." That means the tables were created.

## 3. (Optional) Confirm it worked
- Click **Table Editor** in the sidebar — you should see two tables: `events`
  and `responses`.

## 4. Get your two connection values
1. Click the **gear / Project Settings** (bottom-left), then **API keys** (or
   **Data API**).
2. Copy these two values:
   - **Project URL** — looks like `https://abcdxyz.supabase.co`
   - **anon public** key — a long string starting with `eyâ€¦`
3. Paste both back to Claude. (The anon key is safe to share — it's meant for the
   browser, and the database rules control what it can do.)

That's it — Claude will drop them into `.env.local` and switch the app over to
the shared database.
