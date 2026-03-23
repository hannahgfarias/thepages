-- ============================================================
-- The Pages — Dev Seed Data
-- Run AFTER 001_initial.sql
-- Creates sample posts for a non-empty feed during development
-- ============================================================

-- Seed user (dev only — delete before production)
-- In real app, auth.users is populated by Supabase Auth
-- For local dev, insert a profile directly:

insert into public.profiles (id, handle, display_name, bio, location, avatar_color, avatar_initials, is_public)
values
  ('00000000-0000-0000-0000-000000000001', '@seeduser', 'The Pages', 'Sample events for dev', 'San Francisco, CA', '#E63946', 'TP', true)
on conflict (id) do nothing;

-- ──────────────────────────────────────────
-- SAMPLE POSTS
-- ──────────────────────────────────────────
insert into public.posts (
  user_id, title, subtitle, description, location, date_text,
  event_url, bg_color, accent_color, text_color, category, pattern,
  tags, is_public, moderation_status
) values

-- 1. Arts
(
  '00000000-0000-0000-0000-000000000001',
  'NIGHT MARKET', 'underground arts collective',
  'Local artists, live music, handmade goods, and street food. All ages welcome.',
  'The Midway, SF', 'FRI APR 11 • 7PM–1AM',
  'https://eventbrite.com', '#10002b', '#c77dff', '#ffffff',
  'Arts', 'dots',
  array['#artmarket', '#sfarts', '#underground'], true, 'approved'
),

-- 2. Community
(
  '00000000-0000-0000-0000-000000000001',
  'NEIGHBORHOOD CLEANUP', 'mission district',
  'Join your neighbors to clean up Dolores Park and surrounding streets. Supplies provided.',
  'Dolores Park, SF', 'SAT APR 12 • 9AM–12PM',
  'https://meetup.com', '#d8f3dc', '#2d6a4f', '#111111',
  'Community', 'stripes',
  array['#volunteer', '#missiondistrict', '#cleanup'], true, 'approved'
),

-- 3. Food
(
  '00000000-0000-0000-0000-000000000001',
  'DUMPLING FEST', 'all-you-can-eat edition',
  'Over 20 vendors, dumpling competitions, and dumpling-making workshops. Rain or shine.',
  'Ferry Building, SF', 'SUN APR 13 • 11AM–6PM',
  'https://eventbrite.com', '#fff8f0', '#ff6b35', '#111111',
  'Food', 'circles',
  array['#dumplings', '#streetfood', '#ferrybuilding'], true, 'approved'
),

-- 4. Wellness
(
  '00000000-0000-0000-0000-000000000001',
  'SUNRISE YOGA', 'golden gate park',
  'Free community yoga session with certified instructors. All levels welcome. Bring your mat.',
  'Spreckels Lake, GG Park', 'SAT APR 12 • 7AM',
  null, '#003566', '#ffd166', '#ffffff',
  'Wellness', 'grid',
  array['#yoga', '#freeevent', '#ggpark', '#wellness'], true, 'approved'
),

-- 5. Arts
(
  '00000000-0000-0000-0000-000000000001',
  'FILM NIGHT', 'retro cinema club',
  'Blade Runner 2049 on 35mm. Pre-show DJ set at 8pm. Limited tickets.',
  'The Roxie Theater, SF', 'FRI APR 18 • 8:30PM',
  'https://roxie.com', '#0d1b2a', '#00b4d8', '#ffffff',
  'Arts', 'zigzag',
  array['#film', '#cinema', '#scifi', '#bladerunner'], true, 'approved'
),

-- 6. Community
(
  '00000000-0000-0000-0000-000000000001',
  'BLOCK PARTY', 'valencia street',
  'Annual Valencia Street block party. Live bands, local vendors, kids activities, food trucks.',
  'Valencia St @ 18th, SF', 'SUN APR 20 • 12PM–8PM',
  'https://meetup.com', '#ff6b6b', '#ffd93d', '#111111',
  'Community', 'stripes',
  array['#blockparty', '#valencia', '#mission', '#freevent'], true, 'approved'
),

-- 7. Volunteer
(
  '00000000-0000-0000-0000-000000000001',
  'FOOD BANK SHIFT', 'sf-marin food bank',
  'Help sort and pack food for families in need. Morning and afternoon shifts available. Sign up required.',
  'SF-Marin Food Bank, SF', 'SAT APR 19 • 9AM OR 1PM',
  'https://sfmfoodbank.org', '#1a0a00', '#fb8500', '#ffffff',
  'Volunteer', 'dots',
  array['#volunteer', '#foodbank', '#giveback', '#community'], true, 'approved'
),

-- 8. Wellness
(
  '00000000-0000-0000-0000-000000000001',
  'SOUND BATH', 'crystal bowls & cacao',
  'A 90-minute guided sound healing journey with crystal singing bowls and cacao ceremony.',
  'Nourish, Mission SF', 'WED APR 16 • 7PM',
  'https://eventbrite.com', '#1a1a2e', '#E63946', '#ffffff',
  'Wellness', 'circles',
  array['#soundbath', '#healing', '#cacao', '#meditation'], true, 'approved'
);

-- ──────────────────────────────────────────
-- Verify seed
-- ──────────────────────────────────────────
-- select title, category, moderation_status from posts order by created_at;
