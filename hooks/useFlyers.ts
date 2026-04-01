import React, { useState, useEffect, useCallback, useContext, createContext, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Post, FeedItem, EventGroup } from '../types';

const MONTH_MAP: Record<string, number> = {
  JAN: 0, JANUARY: 0,
  FEB: 1, FEBRUARY: 1,
  MAR: 2, MARCH: 2,
  APR: 3, APRIL: 3,
  MAY: 4,
  JUN: 5, JUNE: 5,
  JUL: 6, JULY: 6,
  AUG: 7, AUGUST: 7,
  SEP: 8, SEPT: 8, SEPTEMBER: 8,
  OCT: 9, OCTOBER: 9,
  NOV: 10, NOVEMBER: 10,
  DEC: 11, DECEMBER: 11,
};

/**
 * Parse a date_text field like "MARCH 19", "SAT APR 5 • 7PM", "FEB 14, 2025"
 * into a Date object. Assumes current year if none specified.
 */
export function parseEventDate(dateText: string): Date | null {
  if (!dateText) return null;
  const upper = dateText.toUpperCase().replace(/[,•·|–—-]/g, ' ').trim();

  // Try to find month name and day number
  const match = upper.match(
    /\b(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T(?:EMBER)?)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\b\s*(\d{1,2})/
  );

  if (!match) return null;

  const month = MONTH_MAP[match[1]];
  const day = parseInt(match[2], 10);
  if (month === undefined || isNaN(day)) return null;

  // Check for a year
  const yearMatch = upper.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  return new Date(year, month, day);
}

/**
 * Sort posts chronologically: upcoming events first (soonest → furthest),
 * then past events after (most recent past first).
 * Posts without parseable dates go to the end.
 */
function sortByEventDate(posts: Post[]): Post[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return [...posts].sort((a, b) => {
    const dateA = parseEventDate(a.date_text || '');
    const dateB = parseEventDate(b.date_text || '');

    // Posts without parseable dates go to the end
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    const aIsUpcoming = dateA >= todayStart;
    const bIsUpcoming = dateB >= todayStart;

    // Upcoming events come before past events
    if (aIsUpcoming && !bIsUpcoming) return -1;
    if (!aIsUpcoming && bIsUpcoming) return 1;

    // Both upcoming: soonest first
    if (aIsUpcoming && bIsUpcoming) return dateA.getTime() - dateB.getTime();

    // Both past: most recent first
    return dateB.getTime() - dateA.getTime();
  });
}

/**
 * Check if an event date is in the past.
 */
export function isEventPast(dateText: string): boolean {
  const d = parseEventDate(dateText);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

/**
 * Fetches approved public posts from Supabase (real user data only).
 */
export function useFlyers(userId?: string) {
  const [flyers, setFlyers] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlyers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Only fetch events from the past 5 years
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      // RLS handles visibility filtering (public, followers, mutuals)
      // We only need to filter for approved moderation status
      // Try with event_group join first, fall back without it
      let data: any[] | null = null;
      let fetchError: any = null;

      const baseQuery = `
          *,
          profile:profiles!posts_user_id_fkey (
            id, handle, display_name, avatar_url, avatar_color, avatar_initials
          )`;

      const queryWithGroups = `${baseQuery},
          event_group:event_groups (
            id, canonical_name, venue_text, event_date, start_time, end_time, post_count
          )`;

      // Try with event_group join
      const result1 = await supabase
        .from('posts')
        .select(queryWithGroups)
        .eq('moderation_status', 'approved')
        .gte('created_at', fiveYearsAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (result1.error) {
        // Fall back without event_group join
        console.warn('Event group join failed, falling back:', result1.error.message);
        const result2 = await supabase
          .from('posts')
          .select(baseQuery)
          .eq('moderation_status', 'approved')
          .gte('created_at', fiveYearsAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(50);
        data = result2.data;
        fetchError = result2.error;
      } else {
        data = result1.data;
        fetchError = null;
      }

      if (fetchError) {
        console.warn('Supabase fetch error:', fetchError.message);
        setFlyers([]);
        setError(fetchError.message);
        return;
      }

      if (!data || data.length === 0) {
        setFlyers([]);
        return;
      }

      // Fetch saved post IDs for the current user
      let savedPostIds = new Set<string>();
      if (userId) {
        const { data: saves } = await supabase
          .from('saves')
          .select('post_id')
          .eq('user_id', userId);
        if (saves) {
          savedPostIds = new Set(saves.map((s: any) => s.post_id));
        }
      }

      // Map DB rows to Post type
      const mapped: Post[] = data.map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        subtitle: row.subtitle,
        description: row.description,
        location: row.location,
        date_text: row.date_text,
        event_url: row.event_url,
        image: null,
        image_url: row.image_url,
        og_image_url: row.og_image_url,
        bgColor: row.bg_color || '#1a1a2e',
        accent_color: row.accent_color || '#E63946',
        text_color: row.text_color || '#ffffff',
        pattern: row.pattern || 'dots',
        category: row.category,
        tags: row.tags || [],
        is_public: row.is_public,
        is_anonymous: row.is_anonymous,
        visibility: row.visibility || (row.is_public ? 'public' : 'mutuals'),
        moderation_status: row.moderation_status,
        report_count: row.report_count,
        save_count: row.save_count || 0,
        share_count: row.share_count || 0,
        created_at: row.created_at,
        link: row.event_url ? 'Get Tickets' : '',
        event_group_id: row.event_group_id || null,
        event_group: row.event_group || null,
        profile: row.profile,
        is_saved: savedPostIds.has(row.id),
        is_mine: userId ? row.user_id === userId : false,
      }));

      setFlyers(sortByEventDate(mapped));
    } catch (err) {
      console.warn('Network error fetching posts');
      setFlyers([]);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFlyers();
  }, [fetchFlyers]);

  // Real-time subscription: refetch when posts are inserted or updated
  useEffect(() => {
    const channel = supabase
      .channel('posts-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        fetchFlyers();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, () => {
        fetchFlyers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFlyers]);

  const toggleSave = useCallback(async (postId: string) => {
    // Read current saved state synchronously from latest flyers
    let wasSaved = false;

    // Optimistic update + capture previous state
    setFlyers((prev) => {
      const target = prev.find((f) => f.id === postId);
      wasSaved = target?.is_saved ?? false;
      return prev.map((f) => f.id === postId ? {
        ...f,
        is_saved: !f.is_saved,
        save_count: f.is_saved ? Math.max(f.save_count - 1, 0) : f.save_count + 1,
      } : f);
    });

    if (!userId) return; // Not logged in — just toggle locally

    // Allow the state update to flush before reading wasSaved
    await new Promise((r) => setTimeout(r, 0));

    try {
      if (wasSaved) {
        const { error } = await supabase.from('saves').delete().eq('user_id', userId).eq('post_id', postId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('saves').insert({ user_id: userId, post_id: postId });
        if (error) throw error;
      }
    } catch {
      // Rollback optimistic update on failure
      setFlyers((prev) =>
        prev.map((f) => (f.id === postId ? {
          ...f,
          is_saved: !f.is_saved,
          save_count: f.is_saved ? Math.max(f.save_count - 1, 0) : f.save_count + 1,
        } : f))
      );
    }
  }, [userId]);

  const recordShare = useCallback(async (postId: string, eventGroupId?: string | null) => {
    // Optimistic UI update
    setFlyers((prev) =>
      prev.map((f) => (f.id === postId ? { ...f, share_count: f.share_count + 1 } : f))
    );

    try {
      const { error } = await supabase.from('shares').insert({
        user_id: userId || null,
        post_id: postId,
        event_group_id: eventGroupId || null,
      });
      if (error) throw error;
    } catch {
      // Rollback on failure
      setFlyers((prev) =>
        prev.map((f) => (f.id === postId ? { ...f, share_count: Math.max(f.share_count - 1, 0) } : f))
      );
    }
  }, [userId]);

  // Derive grouped feed items from flat post list
  const feedItems: FeedItem[] = useMemo(() => {
    const groupMap = new Map<string, { group: EventGroup; posts: Post[] }>();
    const singles: Post[] = [];

    for (const post of flyers) {
      if (post.event_group_id && post.event_group && post.event_group.post_count > 1) {
        const existing = groupMap.get(post.event_group_id);
        if (existing) {
          existing.posts.push(post);
        } else {
          groupMap.set(post.event_group_id, {
            group: post.event_group,
            posts: [post],
          });
        }
      } else {
        singles.push(post);
      }
    }

    const items: FeedItem[] = [];

    // Sort carousel posts by engagement: (save_count + share_count) DESC, created_at ASC
    for (const { group, posts } of groupMap.values()) {
      posts.sort((a, b) => {
        const engA = (a.save_count || 0) + (a.share_count || 0);
        const engB = (b.save_count || 0) + (b.share_count || 0);
        if (engB !== engA) return engB - engA;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      items.push({ type: 'group', group, posts });
    }

    for (const post of singles) {
      items.push({ type: 'single', post });
    }

    // Sort all feed items by the earliest post date in each item
    items.sort((a, b) => {
      const dateA = a.type === 'single'
        ? parseEventDate(a.post.date_text || '')
        : parseEventDate(a.posts[0]?.date_text || '');
      const dateB = b.type === 'single'
        ? parseEventDate(b.post.date_text || '')
        : parseEventDate(b.posts[0]?.date_text || '');

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const aUp = dateA >= todayStart;
      const bUp = dateB >= todayStart;

      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      if (aUp && bUp) return dateA.getTime() - dateB.getTime();
      return dateB.getTime() - dateA.getTime();
    });

    return items;
  }, [flyers]);

  return { flyers, feedItems, loading, error, refetch: fetchFlyers, toggleSave, recordShare };
}

/* ─── Shared Flyers Context ─── */

interface FlyersContextValue {
  flyers: Post[];
  feedItems: FeedItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  toggleSave: (postId: string) => Promise<void>;
  recordShare: (postId: string, eventGroupId?: string | null) => Promise<void>;
}

const FlyersContext = createContext<FlyersContextValue | null>(null);

export function FlyersProvider({ userId, children }: { userId?: string; children: React.ReactNode }) {
  const hookResult = useFlyers(userId);
  const value = React.useMemo(() => hookResult, [hookResult.flyers, hookResult.feedItems, hookResult.loading, hookResult.error, hookResult.refetch, hookResult.toggleSave, hookResult.recordShare]);
  return React.createElement(FlyersContext.Provider, { value }, children);
}

/**
 * Use the shared flyers state from the provider.
 * Falls back to a standalone useFlyers if no provider exists (shouldn't happen).
 */
export function useSharedFlyers() {
  const ctx = useContext(FlyersContext);
  if (!ctx) throw new Error('useSharedFlyers must be used within FlyersProvider');
  return ctx;
}
