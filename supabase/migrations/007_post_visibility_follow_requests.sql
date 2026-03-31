-- ============================================================
-- The Pages — Post Visibility Levels & Follow Requests
-- ============================================================

-- 1. Add post_visibility column to posts
-- Values: 'public' (everyone), 'followers' (followers + mutuals), 'mutuals' (mutuals only)
-- This replaces the binary is_public boolean for finer control
alter table public.posts
  add column if not exists post_visibility text default 'public'
  check (post_visibility in ('public', 'followers', 'mutuals'));

-- Backfill: map existing is_public to post_visibility
update public.posts set post_visibility = 'public' where is_public = true;
update public.posts set post_visibility = 'mutuals' where is_public = false;

-- 2. Add follow request status to follows table
-- For private profiles, follows start as 'pending' until accepted
alter table public.follows
  add column if not exists status text default 'accepted'
  check (status in ('pending', 'accepted'));

-- 3. Update posts RLS policy to support three visibility levels
drop policy if exists "Posts viewable by public or community" on public.posts;

create policy "Posts viewable by visibility level"
  on public.posts for select
  using (
    -- Own posts: always visible
    auth.uid() = user_id
    -- Public posts: everyone can see (if approved)
    or (post_visibility = 'public' and moderation_status = 'approved')
    -- Followers-level posts: visible to accepted followers + mutuals
    or (
      post_visibility = 'followers'
      and moderation_status = 'approved'
      and exists (
        select 1 from public.follows
        where follower_id = auth.uid()
          and following_id = posts.user_id
          and status = 'accepted'
      )
    )
    -- Mutuals-only posts: visible to mutual followers only
    or (
      post_visibility = 'mutuals'
      and moderation_status = 'approved'
      and exists (
        select 1 from public.follows f1
        join public.follows f2
          on f1.follower_id = f2.following_id
          and f1.following_id = f2.follower_id
        where f1.follower_id = auth.uid()
          and f1.following_id = posts.user_id
          and f1.status = 'accepted'
          and f2.status = 'accepted'
      )
    )
  );

-- 4. Update follows policies to allow status updates (accept/decline)
-- Allow the person being followed to update the follow status (accept request)
create policy "Users can accept follow requests"
  on public.follows for update
  using (auth.uid() = following_id)
  with check (auth.uid() = following_id);

-- 5. Index for faster follow-status lookups
create index if not exists follows_status_idx on public.follows (status);

-- ============================================================
-- DONE — Three-tier post visibility + follow request system
-- public: everyone sees it
-- followers: accepted followers + mutuals see it
-- mutuals: only mutual followers see it
-- Private profiles: follows start as 'pending' until accepted
-- ============================================================
