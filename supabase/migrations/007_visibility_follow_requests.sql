-- ============================================================
-- The Pages — Post Visibility Levels & Follow Requests
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ──────────────────────────────────────────
-- 1. Add visibility column to posts
--    'public'    → everyone in the feed
--    'followers' → accepted followers + mutuals
--    'mutuals'   → mutual follows only
-- ──────────────────────────────────────────

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'followers', 'mutuals'));

-- Migrate existing data
UPDATE public.posts SET visibility = 'public' WHERE is_public = true;
UPDATE public.posts SET visibility = 'mutuals' WHERE is_public = false;

-- ──────────────────────────────────────────
-- 2. Add status column to follows
--    'pending'  → request sent, awaiting acceptance
--    'accepted' → confirmed follow
-- ──────────────────────────────────────────

ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted'
  CHECK (status IN ('pending', 'accepted'));

-- ──────────────────────────────────────────
-- 3. Update RLS policy on posts for visibility levels
-- ──────────────────────────────────────────

-- Drop existing select policy
DROP POLICY IF EXISTS "Posts viewable by public or community" ON public.posts;
DROP POLICY IF EXISTS "Public approved posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Public approved posts viewable by all" ON public.posts;

CREATE POLICY "Posts viewable by visibility level"
  ON public.posts FOR SELECT
  USING (
    -- Owner always sees their own posts
    auth.uid() = user_id
    -- Public approved posts: everyone sees
    OR (visibility = 'public' AND moderation_status = 'approved')
    -- Followers-only posts: accepted followers can see
    OR (
      visibility = 'followers'
      AND moderation_status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = auth.uid()
          AND following_id = posts.user_id
          AND status = 'accepted'
      )
    )
    -- Mutuals-only posts: mutual accepted follows can see
    OR (
      visibility = 'mutuals'
      AND moderation_status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.follows f1
        JOIN public.follows f2
          ON f1.follower_id = f2.following_id
          AND f1.following_id = f2.follower_id
        WHERE f1.follower_id = auth.uid()
          AND f1.following_id = posts.user_id
          AND f1.status = 'accepted'
          AND f2.status = 'accepted'
      )
    )
  );

-- ──────────────────────────────────────────
-- 4. Update follows RLS — pending follows visible to both parties
-- ──────────────────────────────────────────

DROP POLICY IF EXISTS "Follows are viewable by authenticated users" ON public.follows;

CREATE POLICY "Follows viewable by involved users or accepted"
  ON public.follows FOR SELECT
  USING (
    -- Accepted follows: visible to all authenticated users (needed for community/mutual checks)
    (status = 'accepted' AND auth.role() = 'authenticated')
    -- Pending follows: only visible to the two users involved
    OR (status = 'pending' AND (auth.uid() = follower_id OR auth.uid() = following_id))
  );

-- ──────────────────────────────────────────
-- 5. Update are_community helper to check accepted status
-- ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.are_community(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows f1
    JOIN public.follows f2
      ON f1.follower_id = f2.following_id
      AND f1.following_id = f2.follower_id
    WHERE f1.follower_id = user_a
      AND f1.following_id = user_b
      AND f1.status = 'accepted'
      AND f2.status = 'accepted'
  );
$$;

-- ============================================================
-- DONE — 3-level post visibility + pending follow requests
-- ============================================================
