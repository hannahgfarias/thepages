-- ============================================================
-- The Pages — Initial Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────
-- PROFILES (extends auth.users 1:1)
-- ──────────────────────────────────────────
create table public.profiles (
  id                    uuid references auth.users(id) on delete cascade primary key,
  handle                text unique not null,
  display_name          text,
  bio                   text,
  location              text,
  avatar_url            text,
  avatar_color          text not null default '#E63946',
  avatar_initials       text,
  is_public             boolean not null default true,
  allow_anonymous_posts boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ──────────────────────────────────────────
-- POSTS
-- ──────────────────────────────────────────
create table public.posts (
  id                    uuid default uuid_generate_v4() primary key,
  user_id               uuid references public.profiles(id) on delete cascade not null,
  title                 text not null,
  subtitle              text,
  description           text,
  location              text,
  date_text             text,
  event_url             text,
  image_url             text,
  og_image_url          text,
  bg_color              text not null default '#1a1a2e',
  accent_color          text not null default '#E63946',
  text_color            text not null default '#ffffff',
  category              text not null default 'Community'
                          check (category in ('Party', 'Music', 'Community', 'Arts', 'Wellness', 'Food', 'Free', 'Theatre', 'Fitness', 'Nightlife', 'Volunteer', 'Sports', 'Tech', 'Film', 'Comedy', 'Markets', 'Workshop', 'Other')),
  pattern               text not null default 'dots'
                          check (pattern in ('stripes', 'dots', 'grid', 'zigzag', 'circles')),
  tags                  text[] not null default '{}',
  is_public             boolean not null default true,
  is_anonymous          boolean not null default false,
  moderation_status     text not null default 'pending'
                          check (moderation_status in ('pending', 'approved', 'held', 'rejected')),
  moderation_reason     text,
  moderation_confidence float,
  report_count          integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Index for feed query performance
create index posts_feed_idx on public.posts (is_public, moderation_status, created_at desc);
create index posts_user_idx on public.posts (user_id, created_at desc);
create index posts_category_idx on public.posts (category);

-- ──────────────────────────────────────────
-- SAVES
-- ──────────────────────────────────────────
create table public.saves (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  post_id    uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index saves_user_idx on public.saves (user_id, created_at desc);

-- ──────────────────────────────────────────
-- REPORTS
-- ──────────────────────────────────────────
create table public.reports (
  id                 uuid default uuid_generate_v4() primary key,
  reporter_id        uuid references public.profiles(id) on delete cascade not null,
  post_id            uuid references public.posts(id) on delete cascade not null,
  reason             text not null
                       check (reason in ('harmful', 'misleading', 'inappropriate', 'spam', 'pii', 'other')),
  details            text,
  ai_recommendation  text,
  ai_confidence      float,
  status             text not null default 'pending'
                       check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at         timestamptz not null default now(),
  unique (reporter_id, post_id)
);

-- ──────────────────────────────────────────
-- MODERATION LOG (append-only audit trail)
-- ──────────────────────────────────────────
create table public.moderation_log (
  id               uuid default uuid_generate_v4() primary key,
  post_id          uuid references public.posts(id) on delete cascade not null,
  action           text not null
                     check (action in ('approved', 'held', 'rejected', 'reinstated', 'banned')),
  actor            text not null, -- 'ai' or admin user id
  reason_category  text,
  ai_confidence    float,
  notes            text,
  created_at       timestamptz not null default now()
);

create index modlog_post_idx on public.moderation_log (post_id, created_at desc);

-- ──────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.posts          enable row level security;
alter table public.saves          enable row level security;
alter table public.reports        enable row level security;
alter table public.moderation_log enable row level security;

-- PROFILES
create policy "Public profiles viewable by all"
  on public.profiles for select
  using (is_public = true or auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- POSTS
create policy "Public approved posts viewable by all"
  on public.posts for select
  using (
    (is_public = true and moderation_status = 'approved')
    or auth.uid() = user_id
  );

create policy "Authenticated users can post"
  on public.posts for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

create policy "Users can update own posts"
  on public.posts for update
  using (auth.uid() = user_id);

create policy "Users can delete own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

-- SAVES
create policy "Users can view own saves"
  on public.saves for select
  using (auth.uid() = user_id);

create policy "Users can save posts"
  on public.saves for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave posts"
  on public.saves for delete
  using (auth.uid() = user_id);

-- REPORTS
create policy "Users can submit reports"
  on public.reports for insert
  with check (auth.role() = 'authenticated' and auth.uid() = reporter_id);

create policy "Users can view own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- MODERATION LOG (no user access — admin/service role only)
-- No policies = no access by default (RLS enabled but no permissive policies)

-- ──────────────────────────────────────────
-- TRIGGERS
-- ──────────────────────────────────────────

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  email_prefix text;
  initials     text;
begin
  email_prefix := split_part(coalesce(NEW.email, 'anon_user'), '@', 1);
  initials     := upper(substr(email_prefix, 1, 2));

  insert into public.profiles (id, handle, display_name, avatar_initials)
  values (
    NEW.id,
    '@' || regexp_replace(lower(email_prefix), '[^a-z0-9]', '_', 'g') || '_' || substr(NEW.id::text, 1, 4),
    email_prefix,
    initials
  )
  on conflict (id) do nothing;

  return NEW;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-hide posts at 3 unique reports
create or replace function public.check_report_threshold()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Increment report count
  update public.posts
  set report_count = report_count + 1,
      updated_at   = now()
  where id = NEW.post_id;

  -- Auto-hold if threshold reached
  update public.posts
  set moderation_status = 'held',
      updated_at        = now()
  where id = NEW.post_id
    and report_count >= 3
    and moderation_status = 'approved';

  return NEW;
end;
$$;

create trigger on_report_inserted
  after insert on public.reports
  for each row execute function public.check_report_threshold();

-- Update updated_at on posts change
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.update_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- ──────────────────────────────────────────
-- STORAGE BUCKETS
-- ──────────────────────────────────────────
-- Run separately in Supabase Storage UI, or via management API:
--
-- insert into storage.buckets (id, name, public)
-- values ('flyers', 'flyers', true),
--        ('avatars', 'avatars', true);
--
-- Then add these policies in Storage → Policies:
--
-- Allow public read:
--   (bucket_id = 'flyers' OR bucket_id = 'avatars')
--
-- Allow authenticated upload to own folder:
--   auth.uid()::text = (storage.foldername(name))[1]
--
-- Allow owner delete:
--   auth.uid()::text = (storage.foldername(name))[1]

-- ──────────────────────────────────────────
-- DONE
-- ──────────────────────────────────────────
-- Verify by running:
-- select table_name from information_schema.tables where table_schema = 'public';
