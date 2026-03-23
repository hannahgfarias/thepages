-- ============================================================
-- The Pages — Phone Auth + User Preferences
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ──────────────────────────────────────────
-- ADD phone + preferences columns to profiles
-- ──────────────────────────────────────────
alter table public.profiles
  add column if not exists phone text unique,
  add column if not exists preferences jsonb not null default '{
    "event_types": [],
    "locations": [],
    "notifications": true,
    "distance_miles": 25
  }'::jsonb;

-- Index for phone lookup
create index if not exists profiles_phone_idx on public.profiles (phone);

-- ──────────────────────────────────────────
-- UPDATE profile trigger to handle phone signups
-- ──────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_phone   text;
  user_email   text;
  name_prefix  text;
  initials     text;
  user_handle  text;
begin
  user_phone := NEW.phone;
  user_email := NEW.email;

  -- Derive display name from phone or email
  if user_phone is not null and user_phone != '' then
    -- Phone signup: use last 4 digits as handle seed
    name_prefix := 'user_' || right(regexp_replace(user_phone, '[^0-9]', '', 'g'), 4);
    initials := '📱';
  elsif user_email is not null and user_email != '' then
    name_prefix := split_part(user_email, '@', 1);
    initials := upper(substr(name_prefix, 1, 2));
  else
    name_prefix := 'anon';
    initials := '??';
  end if;

  user_handle := '@' || regexp_replace(lower(name_prefix), '[^a-z0-9_]', '', 'g') || '_' || substr(NEW.id::text, 1, 4);

  insert into public.profiles (id, handle, display_name, avatar_initials, phone)
  values (
    NEW.id,
    user_handle,
    name_prefix,
    initials,
    user_phone
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, profiles.phone),
    updated_at = now();

  return NEW;
end;
$$;

-- ──────────────────────────────────────────
-- ALLOW unauthenticated users to read public posts (web browsing)
-- ──────────────────────────────────────────

-- Drop the old select policy and recreate with anon access
drop policy if exists "Public approved posts viewable by all" on public.posts;

create policy "Anyone can view public approved posts"
  on public.posts for select
  using (
    (is_public = true and moderation_status = 'approved')
    or auth.uid() = user_id
  );

-- Also allow anon to see public profiles
drop policy if exists "Public profiles viewable by all" on public.profiles;

create policy "Anyone can view public profiles"
  on public.profiles for select
  using (is_public = true or auth.uid() = id);

-- ──────────────────────────────────────────
-- DONE
-- ──────────────────────────────────────────
-- IMPORTANT: You must also enable Phone Auth in Supabase:
--   Dashboard → Authentication → Providers → Phone
--   Enable it and configure your SMS provider (Twilio recommended)
--
-- For development/testing, Supabase has a built-in OTP that
-- prints codes to the Auth logs (no SMS provider needed).
