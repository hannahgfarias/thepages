// supabase/functions/match-event/index.ts
// After a post is created, find or create an event group for it.
// Matches by normalized venue + date. If a group exists, link the post to it.
// Deploy: supabase functions deploy match-event

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normalize a venue string for fuzzy matching.
 * - lowercase
 * - remove common words ("the", "at", "in")
 * - remove punctuation
 * - collapse whitespace
 */
function normalizeVenue(venue: string): string {
  return venue
    .toLowerCase()
    .replace(/[''`]/g, '')           // smart quotes
    .replace(/[^\w\s]/g, ' ')        // remove punctuation
    .replace(/\b(the|at|in|on|of|and|&)\b/g, '') // remove articles/prepositions
    .replace(/\s+/g, ' ')            // collapse spaces
    .trim();
}

/**
 * Normalize an event name for matching.
 * Same approach as venue but keep a bit more context.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a normalized date key from a date_text string like "SAT APR 5 • 7PM".
 * We want just the date part (month + day) for matching, not the time.
 */
function normalizeDateKey(dateText: string): string {
  // Remove day-of-week prefixes and time suffixes
  const cleaned = dateText
    .toUpperCase()
    .replace(/\b(MON|TUE|WED|THU|FRI|SAT|SUN)\w*\b/g, '')
    .replace(/[•·\-–—|]/g, ' ')
    .replace(/\d{1,2}\s*(AM|PM)\s*(-|–|TO)\s*\d{1,2}\s*(AM|PM)/gi, '') // time ranges
    .replace(/\d{1,2}\s*(AM|PM)/gi, '')  // individual times
    .replace(/\s+/g, ' ')
    .trim();

  // Try to extract month + day
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthMatch = cleaned.match(new RegExp(`(${monthNames.join('|')})\\w*\\s+(\\d{1,2})`, 'i'));
  if (monthMatch) {
    const month = monthMatch[1].substring(0, 3).toUpperCase();
    const day = monthMatch[2];
    return `${month}${day}`;
  }

  // Fallback: just return the cleaned string
  return cleaned.replace(/\s/g, '').toLowerCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { postId } = await req.json();

    if (!postId) {
      return new Response(
        JSON.stringify({ error: 'postId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch the post
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .select('id, title, location, date_text, event_group_id')
      .eq('id', postId)
      .single();

    if (postErr || !post) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Already grouped
    if (post.event_group_id) {
      return new Response(
        JSON.stringify({ grouped: true, event_group_id: post.event_group_id, action: 'already_grouped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Need at least venue or date to match
    if (!post.location && !post.date_text) {
      return new Response(
        JSON.stringify({ grouped: false, reason: 'no_venue_or_date' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const venueNorm = post.location ? normalizeVenue(post.location) : null;
    const dateKey = post.date_text ? normalizeDateKey(post.date_text) : null;
    const nameNorm = normalizeName(post.title || '');

    // 2. Try to find an existing group that matches
    // Strategy: match on venue + date first, then fall back to name + date
    let matchedGroupId: string | null = null;

    if (venueNorm && dateKey) {
      // Primary match: same venue + same date
      const { data: venueMatch } = await supabase
        .from('event_groups')
        .select('id')
        .eq('venue_norm', venueNorm)
        .eq('event_date', dateKey)
        .limit(1)
        .maybeSingle();

      if (venueMatch) {
        matchedGroupId = venueMatch.id;
      }
    }

    if (!matchedGroupId && nameNorm && dateKey) {
      // Fallback: same name + same date
      const { data: nameMatch } = await supabase
        .from('event_groups')
        .select('id')
        .eq('canonical_name', nameNorm)
        .eq('event_date', dateKey)
        .limit(1)
        .maybeSingle();

      if (nameMatch) {
        matchedGroupId = nameMatch.id;
      }
    }

    if (matchedGroupId) {
      // 3a. Link post to existing group
      const { error: updateErr } = await supabase
        .from('posts')
        .update({ event_group_id: matchedGroupId })
        .eq('id', postId);

      if (updateErr) {
        throw new Error(`Failed to link post: ${updateErr.message}`);
      }

      return new Response(
        JSON.stringify({ grouped: true, event_group_id: matchedGroupId, action: 'joined_existing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3b. Create a new group and link this post
    const { data: newGroup, error: createErr } = await supabase
      .from('event_groups')
      .insert({
        canonical_name: nameNorm,
        venue_text: post.location || null,
        venue_norm: venueNorm,
        event_date: dateKey,
        start_time: null,
        end_time: null,
        post_count: 1,
      })
      .select('id')
      .single();

    if (createErr || !newGroup) {
      throw new Error(`Failed to create group: ${createErr?.message}`);
    }

    // Link the post
    const { error: linkErr } = await supabase
      .from('posts')
      .update({ event_group_id: newGroup.id })
      .eq('id', postId);

    if (linkErr) {
      throw new Error(`Failed to link post to new group: ${linkErr.message}`);
    }

    return new Response(
      JSON.stringify({ grouped: true, event_group_id: newGroup.id, action: 'created_new' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Match failed', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
