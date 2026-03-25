// supabase/functions/scan-flyer/index.ts
// Calls Claude Vision to extract event details from a flyer image
// The Anthropic API key lives here as a secret — never in the mobile app
// Deploy: supabase functions deploy scan-flyer
// Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const { imageBase64, mediaType } = await req.json();

    if (!imageBase64 || !mediaType) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 and mediaType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            {
              type: 'text',
              text: `You are reading a community event flyer. Extract the key details and return ONLY a valid JSON object with no markdown, no backticks, no explanation.

Return exactly this structure:
{
  "title": "THE MAIN EVENT NAME — use ALL CAPS as it appears on the flyer",
  "subtitle": "Short tagline, time, or secondary text",
  "description": "1-2 sentence description of the event",
  "location": "Venue name and/or address as shown",
  "date": "Abbreviated format like SAT APR 5 • 7PM or just the date if no time",
  "category": "Exactly one of: Party, Music, Community, Arts, Wellness, Food, Free, Theatre, Fitness, Nightlife, Volunteer, Sports, Tech, Film, Comedy, Markets, Workshop, Other",
  "tags": ["#relevant", "#hashtags", "#max5"]
}

Rules:
- Use empty string "" for any field not visible on the flyer
- category must be exactly one of the options listed
- tags should start with # and relate to the event type and location
- If the flyer shows MULTIPLE dates, times, or locations, include ALL of them in the respective fields. For example: "FRI MAR 27 • 7PM & SAT MAR 28 • 2PM" or "Downtown Gallery & Midtown Loft"
- Return ONLY the JSON object, nothing else`,
            },
          ],
        }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Anthropic error: ${data.error.message}`);
    }

    const rawText = data.content?.find((b: any) => b.type === 'text')?.text || '{}';

    let result;
    try {
      result = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    } catch {
      // Return empty scaffold if parse fails — user can fill manually
      result = {
        title: '',
        subtitle: '',
        description: '',
        location: '',
        date: '',
        category: 'Community',
        tags: [],
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Scan failed', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
