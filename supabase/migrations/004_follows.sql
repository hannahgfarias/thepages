-- ============================================================
-- The Pages — Follows / Community System
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- FOLLOWS table
create table public.follows (
  id          uuid default uuid_generate_v4() primary key,
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at  timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id != following_id)
);

create index follows_follower_idx on public.follows (follower_id);
create index follows_following_idx on public.follows (following_id);

-- Row Level Security
alter table public.follows enable row level security;

-- Anyone can see follows (needed to check community/mutual status)
create policy "Follows are viewable by authenticated users"
  on public.follows for select
  using (auth.role() = 'authenticated');

-- Users can follow others
create policy "Users can follow"
  on public.follows for insert
  with check (auth.uid() = follower_id);

-- Users can unfollow
create policy "Users can unfollow"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- ──────────────────────────────────────────
-- Update POSTS policy for private posts
-- Private posts visible to: owner + mutual followers (community)
-- ──────────────────────────────────────────

-- Drop existing select policy and replace with one that handles private posts
drop policy if exists "Public approved posts viewable by all" on public.posts;

create policy "Posts viewable by public or community"
  on public.posts for select
  using (
    -- Public approved posts: everyone can see
    (is_public = true and moderation_status = 'approved')
    -- Own posts: always visible
    or auth.uid() = user_id
    -- Private posts: visible to mutual followers (community)
    or (
      is_public = false
      and moderation_status = 'approved'
      and exists (
        -- Check mutual follow: I follow them AND they follow me
        select 1 from public.follows f1
        join public.follows f2
          on f1.follower_id = f2.following_id
          and f1.following_id = f2.follower_id
        where f1.follower_id = auth.uid()
          and f1.following_id = posts.user_id
      )
    )
  );

-- ──────────────────────────────────────────
-- Helper function: check if two users are mutual followers
-- ──────────────────────────────────────────
create or replace function public.are_community(user_a uuid, user_b uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.follows f1
    join public.follows f2
      on f1.follower_id = f2.following_id
      and f1.following_id = f2.follower_id
    where f1.follower_id = user_a
      and f1.following_id = user_b
  );
$$;

-- ============================================================
-- DONE — Community = mutual follows
-- Private posts visible to: post owner + mutual followers
-- ============================================================
