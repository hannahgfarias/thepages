import { supabase } from './supabase';
import type { ScanResult } from '../types';

const SUPABASE_URL = 'https://taygiieowkyuhvxmlyeg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRheWdpaWVvd2t5dWh2eG1seWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDMwNjQsImV4cCI6MjA4OTAxOTA2NH0.UOYz-kMqGOpYVEuSIqlKmMr2mtIwIeeN_j7Cqwc1-Sc';

/**
 * Call the scan-flyer edge function using raw fetch so we can see
 * the exact response status and body on failure.
 */
export async function scanFlyer(
  base64: string,
  mediaType: string
): Promise<ScanResult> {
  const url = `${SUPABASE_URL}/functions/v1/scan-flyer`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ imageBase64: base64, mediaType }),
    });
  } catch (networkError: any) {
    throw new Error(`Network error: ${networkError.message}`);
  }

  if (!response.ok) {
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '(could not read body)';
    }
    throw new Error(`HTTP ${response.status}: ${body}`);
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
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/moderate-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ imageBase64, mediaType, text }),
    });

    if (!response.ok) {
      // Moderation service unavailable — allow post through rather than silently blocking
      return { status: 'approved', confidence: 0 };
    }

    return response.json();
  } catch {
    // Moderation service unavailable — allow post through rather than silently blocking
    return { status: 'approved', confidence: 0 };
  }
}
