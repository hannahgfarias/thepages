/**
 * Platform-aware helpers for features that need different implementations on web vs native.
 * expo-location, expo-image-picker, and expo-file-system don't work on web.
 */
import { Platform } from 'react-native';

// ── Location ──────────────────────────────────────────────────────────────────

export async function detectCity(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return detectCityWeb();
  }
  return detectCityNative();
}

async function detectCityWeb(): Promise<string | null> {
  if (!navigator?.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Use free reverse geocoding API
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await res.json();
          resolve(data.city || data.locality || null);
        } catch {
          resolve(null);
        }
      },
      () => resolve(null), // Permission denied or error
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}

async function detectCityNative(): Promise<string | null> {
  const Location = require('expo-location');
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const [place] = await Location.reverseGeocodeAsync({
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
  });
  return place?.city || null;
}

// ── Image Picking ─────────────────────────────────────────────────────────────

export interface PickedImage {
  uri: string;
  base64: string;
}

export async function pickImageFromLibrary(options?: {
  aspect?: [number, number];
  quality?: number;
}): Promise<PickedImage | null> {
  if (Platform.OS === 'web') {
    return pickImageWeb(options);
  }
  return pickImageNative(options);
}

async function pickImageWeb(options?: {
  aspect?: [number, number];
  quality?: number;
}): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const uri = URL.createObjectURL(file);
        const base64 = await fileToBase64(file);
        resolve({ uri, base64 });
      } catch {
        resolve(null);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

async function pickImageNative(options?: {
  aspect?: [number, number];
  quality?: number;
}): Promise<PickedImage | null> {
  const ImagePicker = require('expo-image-picker');
  const FileSystem = require('expo-file-system');

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: options?.aspect || [1, 1],
    quality: options?.quality || 0.8,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const uri = result.assets[0].uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri, base64 };
}

export async function pickImageFromCamera(): Promise<PickedImage | null> {
  if (Platform.OS === 'web') {
    // Camera not supported on web, fall back to file picker
    return pickImageWeb();
  }
  const ImagePicker = require('expo-image-picker');
  const FileSystem = require('expo-file-system');

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 5],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const uri = result.assets[0].uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri, base64 };
}

// ── File to Base64 (web only) ─────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Read file as base64 (cross-platform) ──────────────────────────────────────

export async function readFileAsBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // On web, if it's a blob URL, fetch and convert
    const res = await fetch(uri);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const FileSystem = require('expo-file-system');
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
