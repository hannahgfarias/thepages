import { supabase } from './supabase';
import type { ScanResult } from '../types';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://taygiieowkyuhvxmlyeg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRheWdpaWVvd2t5dWh2eG1seWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDMwNjQsImV4cCI6MjA4OTAxOTA2NH0.UOYz-kMqGOpYVEuSIqlKmMr2mtIwIeeN_j7Cqwc1-Sc';

/**
 * Call the scan-flyer edge function using raw fetch so we can see
 * the exact response status and body on failure.
 */
export async function scanFlyer(
  base64: string,
  mediaType: string,
  userLocation?: string
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
      body: JSON.stringify({ imageBase64: base64, mediaType, userLocation }),
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
      return { status: 'held', confidence: 0.5 };
    }

    return response.json();
  } catch {
    return { status: 'held', confidence: 0.5 };
  }
}

/**
 * Auto-group a post into an EventGroup by matching venue + date.
 * This is fire-and-forget — failures are silently ignored.
 */
export async function matchEvent(postId: string): Promise<void> {
  // Fetch the post's location and date
  const { data: post } = await supabase
    .from('posts')
    .select('location, date_text, title')
    .eq('id', postId)
    .single();

  if (!post?.location) return;

  // Look for existing posts at the same location with overlapping date
  const { data: matches } = await supabase
    .from('posts')
    .select('id, event_group_id')
    .eq('location', post.location)
    .eq('date_text', post.date_text)
    .neq('id', postId)
    .not('event_group_id', 'is', null)
    .limit(1);

  if (matches && matches.length > 0 && matches[0].event_group_id) {
    // Join existing event group
    await supabase
      .from('posts')
      .update({ event_group_id: matches[0].event_group_id })
      .eq('id', postId);
  }
  // If no match, leave ungrouped — a future post may create a group
}

/**
 * Get the user's current coordinates (lat/lon).
 * Returns null if permissions denied or unavailable.
 */
export async function getUserCoords(): Promise<{ lat: number; lon: number } | null> {
  try {
    if (Platform.OS === 'web') {
      if (!navigator?.geolocation) return null;
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 5000, enableHighAccuracy: false }
        );
      });
    }
    // Native
    const Location = require('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: loc.coords.latitude, lon: loc.coords.longitude };
  } catch {
    return null;
  }
}
