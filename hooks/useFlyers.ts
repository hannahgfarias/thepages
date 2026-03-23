import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { SEED_FLYERS } from '../constants/seedData';
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
function parseEventDate(dateText: string): Date | null {
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
 * Sort posts by event date: today/upcoming first, then future, then past at the bottom.
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

    const diffA = dateA.getTime() - todayStart.getTime();
    const diffB = dateB.getTime() - todayStart.getTime();

    // Both upcoming (>= today): sooner first
    if (diffA >= 0 && diffB >= 0) return diffA - diffB;
    // Both past (< today): more recent past first
    if (diffA < 0 && diffB < 0) return diffB - diffA;
    // One upcoming, one past: upcoming wins
    if (diffA >= 0) return -1;
    return 1;
  });
}

/**
 * Fetches approved public posts from Supabase.
 * Falls back to seed data if the table is empty or unreachable.
 */
export function useFlyers() {
  const [flyers, setFlyers] = useState<Post[]>(sortByEventDate(SEED_FLYERS));
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
        console.warn('Supabase fetch error, using seed data:', fetchError.message);
        setFlyers(sortByEventDate(SEED_FLYERS));
        setError(fetchError.message);
        return;
      }

      if (!data || data.length === 0) {
        // DB is empty — use seed data for now
        setFlyers(sortByEventDate(SEED_FLYERS));
        return;
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
        bgColor: row.bg_color,
        category: row.category,
        tags: row.tags || [],
        is_public: row.is_public,
        is_anonymous: row.is_anonymous,
        moderation_status: row.moderation_status,
        report_count: row.report_count,
        created_at: row.created_at,
        link: row.event_url ? 'Get Tickets' : '',
        profile: row.profile,
        is_saved: false,
        is_mine: false,
      }));

      setFlyers(sortByEventDate(mapped));
    } catch (err) {
      console.warn('Network error, using seed data');
      setFlyers(sortByEventDate(SEED_FLYERS));
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlyers();
  }, [fetchFlyers]);

  const toggleSave = useCallback(async (postId: string, userId?: string) => {
    // Optimistic UI update
    setFlyers((prev) =>
      prev.map((f) => (f.id === postId ? { ...f, is_saved: !f.is_saved } : f))
    );

    if (!userId) return; // Not logged in — just toggle locally

    const flyer = flyers.find((f) => f.id === postId);
    if (!flyer) return;

    if (flyer.is_saved) {
      // Unsave
      await supabase.from('saves').delete().match({ user_id: userId, post_id: postId });
    } else {
      // Save
      await supabase.from('saves').insert({ user_id: userId, post_id: postId });
    }
  }, [flyers]);

  return { flyers, loading, error, refetch: fetchFlyers, toggleSave };
}
