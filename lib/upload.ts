import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';

/**
 * Upload a local image to Supabase Storage and return the public URL.
 */
export async function uploadFlyer(
  localUri: string,
  userId: string
): Promise<{ url: string; base64: string; mediaType: string }> {
  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Determine media type from extension
  const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
  const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg';

  // Generate unique filename
  const fileName = `${userId}/${Date.now()}.${ext}`;

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from('flyers')
    .upload(fileName, decode(base64), {
      contentType: mediaType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('flyers')
    .getPublicUrl(fileName);

  return {
    url: urlData.publicUrl,
    base64,
    mediaType,
  };
}
