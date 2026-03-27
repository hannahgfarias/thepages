import React, { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { supabase } from '../lib/supabase';
import type { Post } from '../types';

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
 * Sort posts by proximity to today — events closest to today appear first,
 * whether they just happened or are coming up soon.
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

    // Sort by absolute distance from today — closest events first
    const distA = Math.abs(dateA.getTime() - todayStart.getTime());
    const distB = Math.abs(dateB.getTime() - todayStart.getTime());
    return distA - distB;
  });
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

      const { data, error: fetchError } = await supabase
        .from('posts')
        .select(`
          *,
          profile:profiles!posts_user_id_fkey (
            id, handle, display_name, avatar_url, avatar_color, avatar_initials
          )
        `)
        .eq('is_public', true)
        .eq('moderation_status', 'approved')
        .gte('created_at', fiveYearsAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

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
        moderation_status: row.moderation_status,
        report_count: row.report_count,
        created_at: row.created_at,
        link: row.event_url ? 'Get Tickets' : '',
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

  const recordShare = useCallback(async (postId: string) => {
    // Optimistic UI update
    setFlyers((prev) =>
      prev.map((f) => (f.id === postId ? { ...f, share_count: f.share_count + 1 } : f))
    );

    try {
      const { error } = await supabase.from('shares').insert({
        user_id: userId || null,
        post_id: postId,
      });
      if (error) throw error;
    } catch {
      // Rollback on failure
      setFlyers((prev) =>
        prev.map((f) => (f.id === postId ? { ...f, share_count: Math.max(f.share_count - 1, 0) } : f))
      );
    }
  }, [userId]);

  return { flyers, loading, error, refetch: fetchFlyers, toggleSave, recordShare };
}

/* ─── Shared Flyers Context ─── */

interface FlyersContextValue {
  flyers: Post[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  toggleSave: (postId: string) => Promise<void>;
  recordShare: (postId: string) => Promise<void>;
}

const FlyersContext = createContext<FlyersContextValue | null>(null);

export function FlyersProvider({ userId, children }: { userId?: string; children: React.ReactNode }) {
  const hookResult = useFlyers(userId);
  const value = React.useMemo(() => hookResult, [hookResult.flyers, hookResult.loading, hookResult.error, hookResult.refetch, hookResult.toggleSave, hookResult.recordShare]);
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
