-- Add bio_links column to profiles for user-editable links (e.g. Instagram, website)
-- Stored as JSONB array: [{"label": "Instagram", "url": "https://instagram.com/user"}, ...]
alter table public.profiles
  add column if not exists bio_links jsonb default '[]'::jsonb;
