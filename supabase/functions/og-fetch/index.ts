// supabase/functions/og-fetch/index.ts
// Fetches Open Graph metadata from any public URL
// Deploy: supabase functions deploy og-fetch

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response(
        JSON.stringify({ error: 'Only HTTP/HTTPS URLs are supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ThePages/1.0 (link preview; +https://thepages.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Fetch failed: ${res.status}` }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await res.text();

    // Extract OG tag helper
    const getOG = (prop: string): string | null => {
      // Match both property="og:x" content="..." and content="..." property="og:x"
      const patterns = [
        new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'),
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m?.[1]) return m[1].trim();
      }
      return null;
    };

    // Fallback to <title> tag
    const getTitle = (): string | null => {
      const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return m?.[1]?.trim() || null;
    };

    // Fallback to meta description
    const getMetaDesc = (): string | null => {
      const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
      return m?.[1]?.trim() || null;
    };

    const result = {
      title: getOG('title') || getTitle(),
      description: getOG('description') || getMetaDesc(),
      image: getOG('image'),
      url: getOG('url') || url,
      site_name: getOG('site_name'),
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
