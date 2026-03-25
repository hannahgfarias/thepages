-- Expand the category check constraint to include all app categories.
-- This is safe to run on existing databases — it only widens the allowed values.

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_category_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_category_check
  CHECK (category IN (
    'Party', 'Music', 'Community', 'Arts', 'Wellness', 'Food', 'Free',
    'Theatre', 'Fitness', 'Nightlife', 'Volunteer', 'Sports', 'Tech',
    'Film', 'Comedy', 'Markets', 'Workshop', 'Other'
  ));
