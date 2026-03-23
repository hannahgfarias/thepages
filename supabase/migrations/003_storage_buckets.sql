-- ============================================================
-- The Pages — Storage Buckets for Flyer Images
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Create the flyers bucket (public read, auth write)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'flyers',
  'flyers',
  true,                                          -- public read (anyone can view flyers)
  10485760,                                       -- 10MB max per image
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Create the avatars bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,                                        -- 2MB max
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ──────────────────────────────────────────
-- STORAGE POLICIES — Flyers
-- ──────────────────────────────────────────

-- Anyone can view flyers (public bucket)
create policy "Public flyer read"
  on storage.objects for select
  using (bucket_id = 'flyers');

-- Authenticated users can upload to their own folder
create policy "Auth users upload flyers"
  on storage.objects for insert
  with check (
    bucket_id = 'flyers'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own flyers
create policy "Users delete own flyers"
  on storage.objects for delete
  using (
    bucket_id = 'flyers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ──────────────────────────────────────────
-- STORAGE POLICIES — Avatars
-- ──────────────────────────────────────────

create policy "Public avatar read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Auth users upload avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ──────────────────────────────────────────
-- AUTO-EXPIRE: Delete flyers older than 1 year
-- ──────────────────────────────────────────
-- This function cleans up expired flyer images and their posts.
-- Schedule it to run daily via Supabase Dashboard → Database → Extensions → pg_cron
--
-- To enable pg_cron, run in SQL editor:
--   create extension if not exists pg_cron;
--
-- Then schedule the cleanup job:
--   select cron.schedule(
--     'cleanup-expired-flyers',
--     '0 3 * * *',  -- runs daily at 3am UTC
--     $$
--       -- Mark posts older than 1 year as expired
--       update public.posts
--       set moderation_status = 'rejected',
--           moderation_reason = 'auto-expired after 1 year'
--       where created_at < now() - interval '1 year'
--         and moderation_status != 'rejected';
--
--       -- Delete storage objects for expired posts
--       delete from storage.objects
--       where bucket_id = 'flyers'
--         and created_at < now() - interval '1 year';
--     $$
--   );

-- For now, create a function that can be called manually or via cron:
create or replace function public.cleanup_expired_flyers()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  expired_count integer;
begin
  -- Count what we're about to expire
  select count(*) into expired_count
  from public.posts
  where created_at < now() - interval '1 year'
    and moderation_status != 'rejected';

  -- Mark expired posts
  update public.posts
  set moderation_status = 'rejected',
      moderation_reason = 'auto-expired after 1 year',
      updated_at = now()
  where created_at < now() - interval '1 year'
    and moderation_status != 'rejected';

  -- Delete expired flyer images from storage
  delete from storage.objects
  where bucket_id = 'flyers'
    and created_at < now() - interval '1 year';

  -- Log it
  raise notice 'Expired % flyer posts older than 1 year', expired_count;
end;
$$;

-- ──────────────────────────────────────────
-- DONE
-- ──────────────────────────────────────────
-- After running this migration:
-- 1. Enable pg_cron extension in Supabase Dashboard → Database → Extensions
-- 2. Schedule the daily cleanup:
--    select cron.schedule('cleanup-expired-flyers', '0 3 * * *', 'select public.cleanup_expired_flyers()');
--
-- Upload path convention:
--   flyers/{user_id}/{post_id}.jpg
--   avatars/{user_id}/avatar.jpg
--
-- Public URL pattern:
--   {SUPABASE_URL}/storage/v1/object/public/flyers/{user_id}/{post_id}.jpg
