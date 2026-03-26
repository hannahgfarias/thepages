import { supabase } from './supabase';
import type { ScanResult } from '../types';

/**
 * Call the scan-flyer edge function to extract event details from an image.
 * Refreshes the session first to ensure a valid JWT.
 */
export async function scanFlyer(
  base64: string,
  mediaType: string
): Promise<ScanResult> {
  // Force a session refresh to ensure the access token is valid
  const { data: { session }, error: authError } = await supabase.auth.refreshSession();

  if (authError || !session) {
    // If refresh fails, try getting the current session anyway
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      throw new Error('Not signed in — please sign in and try again');
    }
  }

  const { data, error } = await supabase.functions.invoke('scan-flyer', {
    body: { imageBase64: base64, mediaType },
  });

  if (error) {
    let details = error.message;
    try {
      if ((error as any).context) {
        const responseBody = await (error as any).context.json();
        details = responseBody?.error || responseBody?.detail || responseBody?.message || JSON.stringify(responseBody);
      }
    } catch {
      // couldn't parse response body
    }
    throw new Error(details);
  }

  return data;
}

/**
 * Call the moderate-content edge function before publishing.
 */
export async function moderateContent(
  imageBase64: string | null,
  mediaType: string | null,
  text: string
): Promise<{ status: string; confidence: number; reason_category?: string }> {
  // Force session refresh
  await supabase.auth.refreshSession();

  const { data, error } = await supabase.functions.invoke('moderate-content', {
    body: { imageBase64, mediaType, text },
  });

  if (error) {
    return { status: 'held', confidence: 0.5 };
  }

  return data;
}
