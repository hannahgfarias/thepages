// supabase/functions/moderate-content/index.ts
// Runs Claude moderation on every post before it goes public.
// This is a safety-critical function — it MUST be called before any post is published.
// Deploy: supabase functions deploy moderate-content
// Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

interface ModerationResult {
  status: 'approved' | 'held' | 'rejected';
  confidence: number;
  reason_category: string;
  details: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const { imageBase64, mediaType, text } = await req.json();

    // Build content array
    const content: any[] = [];

    if (imageBase64 && mediaType) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: imageBase64 },
      });
    }

    const textToReview = [text].filter(Boolean).join(' ').trim();

    content.push({
      type: 'text',
      text: `You are a content moderator for a community event discovery app. Your job is to review event flyer content and decide whether it is safe to publish publicly.

COMMUNITY STANDARDS:
- This is a family-friendly community app for local events
- Appropriate: arts events, community gatherings, food events, wellness activities, volunteer opportunities
- Inappropriate: graphic violence, sexual content, hate speech, dangerous/illegal activities, harassment, scams

MODERATION OUTCOMES:
- "approved": Safe community content, publish immediately
- "held": Ambiguous content, needs human review before publishing (when in doubt, hold)
- "rejected": Clear, serious violation — do not publish

REASON CATEGORIES (use the most specific):
- "none" (no issue)
- "violence" (graphic violence, gore, weapons)
- "adult_content" (sexual or explicit material)
- "hate_speech" (racism, slurs, discrimination)
- "dangerous" (illegal activities, safety risks)
- "pii" (personal home addresses, private phone numbers)
- "spam" (clearly fake or spam content)
- "minors" (any content inappropriate involving people under 18)
- "misleading" (obvious scam or dangerously false information)

Text to review: "${textToReview}"

Return ONLY a JSON object, no markdown, no explanation:
{
  "status": "approved" | "held" | "rejected",
  "confidence": 0.0-1.0,
  "reason_category": "none" | "violence" | "adult_content" | "hate_speech" | "dangerous" | "pii" | "spam" | "minors" | "misleading",
  "details": "Brief internal note for the moderation log (not shown to user)"
}`,
    });

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        messages: [{ role: 'user', content }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      // On API error, default to HELD (safe default — never auto-approve on error)
      console.error('Anthropic API error:', data.error);
      return new Response(
        JSON.stringify({
          status: 'held',
          confidence: 0,
          reason_category: 'none',
          details: 'Moderation API error — held for manual review',
        } as ModerationResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawText = data.content?.find((b: any) => b.type === 'text')?.text || '{}';

    let result: ModerationResult;
    try {
      result = JSON.parse(rawText.replace(/```json|```/g, '').trim());

      // Validate status field — default to held if invalid
      if (!['approved', 'held', 'rejected'].includes(result.status)) {
        result.status = 'held';
      }
    } catch {
      // Parse failure → hold for review (never fail open)
      result = {
        status: 'held',
        confidence: 0,
        reason_category: 'none',
        details: 'Parse error — held for manual review',
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    // Any unexpected error → hold (fail closed, never fail open)
    return new Response(
      JSON.stringify({
        status: 'held',
        confidence: 0,
        reason_category: 'none',
        details: `Server error: ${String(err)}`,
      } as ModerationResult),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
