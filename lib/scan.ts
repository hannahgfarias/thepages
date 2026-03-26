import { supabase } from './supabase';
import type { ScanResult } from '../types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://taygiieowkyuhvxmlyeg.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_06MYb5KGpy5eIIV4tkQqgQ_jdgatC7R';

/**
 * Build headers for Supabase edge function calls.
 * Supabase requires both the `apikey` header and a valid `Authorization` bearer.
 * For anonymous users (no session), the anon key works as the bearer token.
 */
async function edgeFunctionHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
  };
}

/**
 * Call the scan-flyer edge function to extract event details from an image.
 */
export async function scanFlyer(
  base64: string,
  mediaType: string
): Promise<ScanResult> {
  const headers = await edgeFunctionHeaders();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/scan-flyer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imageBase64: base64, mediaType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Scan failed (${response.status})`);
  }

  return response.json();
}

/**
 * Call the moderate-content edge function before publishing.
 */
export async function moderateContent(
  imageBase64: string | null,
  mediaType: string | null,
  text: string
): Promise<{ status: string; confidence: number; reason_category?: string }> {
  const headers = await edgeFunctionHeaders();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/moderate-content`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imageBase64, mediaType, text }),
  });

  if (!response.ok) {
    // Default to held if moderation fails
    return { status: 'held', confidence: 0.5 };
  }

  return response.json();
}
