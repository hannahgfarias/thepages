-- ============================================================
-- 008: Event Groups — group duplicate posts for the same event
-- ============================================================

-- ──────────────────────────────────────────
-- EVENT_GROUPS table
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_groups (
  id             uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  canonical_name text NOT NULL,               -- normalized event name (lowercase, trimmed)
  venue_text     text,                        -- original venue string
  venue_norm     text,                        -- normalized venue for matching (lowercase, no punctuation)
  event_date     text,                        -- normalized date key for matching (e.g. "APR5")
  start_time     text,
  end_time       text,
  post_count     integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_groups_venue_date_idx
  ON public.event_groups (venue_norm, event_date);

CREATE INDEX event_groups_name_idx
  ON public.event_groups (canonical_name);

-- RLS
ALTER TABLE public.event_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event groups are viewable by everyone"
  ON public.event_groups FOR SELECT
  USING (true);

-- Only server (service_role) or edge functions insert/update groups
CREATE POLICY "Service role can manage event groups"
  ON public.event_groups FOR ALL
  USING (true)
  WITH CHECK (true);

-- ──────────────────────────────────────────
-- Add event_group_id foreign key to posts
-- ──────────────────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS event_group_id uuid REFERENCES public.event_groups(id) ON DELETE SET NULL;

CREATE INDEX posts_event_group_idx ON public.posts (event_group_id);

-- ──────────────────────────────────────────
-- Add event_group_id to shares (optional tracking)
-- ──────────────────────────────────────────
ALTER TABLE public.shares
  ADD COLUMN IF NOT EXISTS event_group_id uuid REFERENCES public.event_groups(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────
-- Function to update post_count on event_groups
-- when posts are linked/unlinked
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_event_group_post_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Decrement old group count
  IF TG_OP = 'UPDATE' AND OLD.event_group_id IS NOT NULL AND OLD.event_group_id IS DISTINCT FROM NEW.event_group_id THEN
    UPDATE public.event_groups
    SET post_count = GREATEST(post_count - 1, 0)
    WHERE id = OLD.event_group_id;
  END IF;

  -- Increment new group count
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.event_group_id IS NOT NULL THEN
    UPDATE public.event_groups
    SET post_count = (
      SELECT COUNT(*) FROM public.posts WHERE event_group_id = NEW.event_group_id
    )
    WHERE id = NEW.event_group_id;
  END IF;

  -- Handle delete
  IF TG_OP = 'DELETE' AND OLD.event_group_id IS NOT NULL THEN
    UPDATE public.event_groups
    SET post_count = GREATEST(post_count - 1, 0)
    WHERE id = OLD.event_group_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER on_post_group_change
  AFTER INSERT OR UPDATE OF event_group_id OR DELETE
  ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_event_group_post_count();
