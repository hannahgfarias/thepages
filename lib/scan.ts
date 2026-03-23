import { supabase } from './supabase';
import type { ScanResult } from '../types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

/**
 * Call the scan-flyer edge function to extract event details from an image.
 */
export async function scanFlyer(
  base64: string,
  mediaType: string
): Promise<ScanResult> {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/scan-flyer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify({ imageBase64: base64, mediaType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Scan failed');
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
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/moderate-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify({ imageBase64, mediaType, text }),
  });

  if (!response.ok) {
    // Default to held if moderation fails
    return { status: 'held', confidence: 0.5 };
  }

  return response.json();
}
