import { supabase } from './supabase';
import type { ScanResult } from '../types';

/**
 * Call the scan-flyer edge function to extract event details from an image.
 * Uses supabase.functions.invoke() which handles auth headers automatically.
 */
export async function scanFlyer(
  base64: string,
  mediaType: string
): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke('scan-flyer', {
    body: { imageBase64: base64, mediaType },
  });

  if (error) {
    // Try to extract the actual error details from the response
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
  const { data, error } = await supabase.functions.invoke('moderate-content', {
    body: { imageBase64, mediaType, text },
  });

  if (error) {
    return { status: 'held', confidence: 0.5 };
  }

  return data;
}
