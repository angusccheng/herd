-- Unique username registry. PRIMARY KEY on username enforces one owner per handle.
-- UNIQUE on user_id means each user can only hold one handle at a time.
CREATE TABLE IF NOT EXISTS public.usernames (
  username  TEXT PRIMARY KEY,
  user_id   UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.usernames ENABLE ROW LEVEL SECURITY;

-- Anyone can read (so the app can check whether a handle is available)
CREATE POLICY "usernames_read_all" ON public.usernames
  FOR SELECT USING (true);

-- Users can only insert/update/delete their own row
CREATE POLICY "usernames_own" ON public.usernames
  FOR ALL USING (auth.uid() = user_id);
