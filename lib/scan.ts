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
  console.log('[SCAN] Calling scan-flyer edge function...');
  console.log('[SCAN] Supabase URL:', supabase.supabaseUrl);
  console.log('[SCAN] Image size:', Math.round(base64.length / 1024), 'KB');
  console.log('[SCAN] Media type:', mediaType);

  // Check auth state
  const { data: { session } } = await supabase.auth.getSession();
  console.log('[SCAN] Auth session exists:', !!session);
  console.log('[SCAN] User ID:', session?.user?.id || 'none (anonymous)');

  const { data, error } = await supabase.functions.invoke('scan-flyer', {
    body: { imageBase64: base64, mediaType },
  });

  console.log('[SCAN] Response data:', JSON.stringify(data)?.substring(0, 200));
  console.log('[SCAN] Response error:', error ? JSON.stringify({
    message: error.message,
    name: error.name,
    context: (error as any).context,
    status: (error as any).status,
  }) : 'none');

  if (error) {
    // Try to get more details from the error
    const details = (error as any).context?.body
      ? await (error as any).context.text().catch(() => 'Could not read body')
      : 'No context';
    console.log('[SCAN] Error details:', details);
    throw new Error(`Scan failed: ${error.message} | ${details}`);
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
    console.log('[MODERATE] Error:', error.message);
    // Default to held if moderation fails — fail closed, never fail open
    return { status: 'held', confidence: 0.5 };
  }

  return data;
}
