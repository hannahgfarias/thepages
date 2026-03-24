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
  // Step 1: Pick file
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => resolve(e.target?.files?.[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
  });

  if (!file) return null;

  // Step 2: Show crop modal
  const aspect = options?.aspect || [1, 1];
  const quality = options?.quality || 0.8;

  return showWebCropModal(file, aspect, quality);
}

/**
 * Show a fullscreen crop modal on web.
 * User drags to position the image within a fixed aspect-ratio frame, then confirms.
 */
// Design system tokens (mirrored from constants — can't import in vanilla JS context)
const DS = {
  alabaster: '#F0ECEC',
  custard: '#E9D25E',
  ink: '#02040F',
  coral: '#EB736C',
  teal: '#78B896',
  inkMuted: 'rgba(2,4,15,0.4)',
  inkLight: 'rgba(2,4,15,0.15)',
  fontDisplay: "'Quicksand', 'Helvetica Neue', sans-serif",
  fontBody: "'Work Sans', 'Helvetica Neue', sans-serif",
  fontMono: "'Space Mono', monospace",
};

function showWebCropModal(
  file: File,
  aspect: [number, number],
  quality: number
): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    // ── Overlay (alabaster bg, not dark) ──
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
      backgroundColor: DS.alabaster, zIndex: '99999',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    });

    // ── Header ──
    const header = document.createElement('div');
    Object.assign(header.style, {
      width: '100%', maxWidth: '400px', display: 'flex',
      justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px',
    });

    const title = document.createElement('div');
    title.textContent = 'CROP IMAGE';
    Object.assign(title.style, {
      color: DS.ink, fontSize: '14px', fontWeight: '700', fontFamily: DS.fontDisplay,
      letterSpacing: '3px',
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'none', border: 'none', fontSize: '18px', color: DS.inkMuted,
      cursor: 'pointer', padding: '4px 8px', fontFamily: DS.fontBody,
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    // ── Crop container ──
    const containerSize = Math.min(window.innerWidth - 48, 380);
    const cropHeight = containerSize * (aspect[1] / aspect[0]);
    const container = document.createElement('div');
    Object.assign(container.style, {
      width: `${containerSize}px`, height: `${cropHeight}px`,
      overflow: 'hidden', position: 'relative', borderRadius: '4px',
      border: `1px solid ${DS.inkLight}`, backgroundColor: '#fff',
      boxShadow: '0 2px 16px rgba(2,4,15,0.08)',
    });

    // ── Corner marks (crop guides) ──
    const cornerSize = '20px';
    const cornerWeight = '2px';
    const corners = [
      { top: '8px', left: '8px', borderTop: `${cornerWeight} solid ${DS.ink}`, borderLeft: `${cornerWeight} solid ${DS.ink}` },
      { top: '8px', right: '8px', borderTop: `${cornerWeight} solid ${DS.ink}`, borderRight: `${cornerWeight} solid ${DS.ink}` },
      { bottom: '8px', left: '8px', borderBottom: `${cornerWeight} solid ${DS.ink}`, borderLeft: `${cornerWeight} solid ${DS.ink}` },
      { bottom: '8px', right: '8px', borderBottom: `${cornerWeight} solid ${DS.ink}`, borderRight: `${cornerWeight} solid ${DS.ink}` },
    ];
    corners.forEach((pos) => {
      const corner = document.createElement('div');
      Object.assign(corner.style, {
        position: 'absolute', width: cornerSize, height: cornerSize,
        pointerEvents: 'none', zIndex: '2', ...pos,
      });
      container.appendChild(corner);
    });

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    Object.assign(img.style, {
      position: 'absolute', cursor: 'grab', userSelect: 'none',
      WebkitUserDrag: 'none', touchAction: 'none',
    } as any);

    let imgX = 0, imgY = 0, scale = 1;
    let dragStartX = 0, dragStartY = 0, dragging = false;

    img.onload = () => {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const cropAspect = containerSize / cropHeight;

      if (imgAspect > cropAspect) {
        scale = cropHeight / img.naturalHeight;
      } else {
        scale = containerSize / img.naturalWidth;
      }

      const scaledW = img.naturalWidth * scale;
      const scaledH = img.naturalHeight * scale;
      img.style.width = `${scaledW}px`;
      img.style.height = `${scaledH}px`;

      imgX = (containerSize - scaledW) / 2;
      imgY = (cropHeight - scaledH) / 2;
      img.style.left = `${imgX}px`;
      img.style.top = `${imgY}px`;
    };

    // ── Drag to reposition ──
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragStartX = e.clientX - imgX;
      dragStartY = e.clientY - imgY;
      img.style.cursor = 'grabbing';
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      imgX = e.clientX - dragStartX;
      imgY = e.clientY - dragStartY;
      img.style.left = `${imgX}px`;
      img.style.top = `${imgY}px`;
    };
    const onPointerUp = () => {
      dragging = false;
      img.style.cursor = 'grab';
    };

    img.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    container.appendChild(img);
    overlay.appendChild(container);

    // ── Hint ──
    const hint = document.createElement('div');
    hint.textContent = 'drag to reposition';
    Object.assign(hint.style, {
      color: DS.inkMuted, fontSize: '12px', marginTop: '14px',
      fontFamily: DS.fontMono, letterSpacing: '1px',
    });
    overlay.appendChild(hint);

    // ── Buttons ──
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, {
      display: 'flex', gap: '12px', marginTop: '24px', width: '100%', maxWidth: '400px',
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'cancel';
    Object.assign(cancelBtn.style, {
      flex: '1', padding: '14px 24px', borderRadius: '14px',
      border: `1px solid ${DS.inkLight}`, backgroundColor: 'transparent',
      color: DS.inkMuted, fontSize: '14px', cursor: 'pointer',
      fontFamily: DS.fontBody, letterSpacing: '0.5px',
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'USE PHOTO';
    Object.assign(confirmBtn.style, {
      flex: '2', padding: '14px 24px', borderRadius: '14px', border: 'none',
      backgroundColor: DS.custard, color: DS.ink, fontSize: '14px',
      fontWeight: '700', cursor: 'pointer', fontFamily: DS.fontDisplay,
      letterSpacing: '2px',
    });

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.removeChild(overlay);
    };

    closeBtn.onclick = () => { cleanup(); resolve(null); };
    cancelBtn.onclick = () => { cleanup(); resolve(null); };

    confirmBtn.onclick = () => {
      // Render crop to canvas
      const canvas = document.createElement('canvas');
      canvas.width = containerSize * 2;
      canvas.height = cropHeight * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) { cleanup(); resolve(null); return; }

      const sx = imgX * 2;
      const sy = imgY * 2;
      const sw = parseFloat(img.style.width) * 2;
      const sh = parseFloat(img.style.height) * 2;
      ctx.drawImage(img, sx, sy, sw, sh);

      canvas.toBlob((blob) => {
        cleanup();
        if (!blob) { resolve(null); return; }
        const uri = URL.createObjectURL(blob);
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ uri, base64 });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', quality);
    };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    overlay.appendChild(btnRow);

    document.body.appendChild(overlay);
  });
}

/**
 * Compress/resize an image file on web using canvas.
 * Returns a blob URL and base64 string, both as JPEG.
 */
async function compressImageWeb(
  file: File,
  opts: { maxWidth: number; maxHeight: number; quality: number }
): Promise<PickedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if larger than max dimensions
      if (width > opts.maxWidth || height > opts.maxHeight) {
        const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
          const uri = URL.createObjectURL(blob);
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            resolve({ uri, base64 });
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        opts.quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
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
