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
    // ── Fullscreen overlay ──
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
      backgroundColor: DS.alabaster, zIndex: '99999',
      display: 'flex', flexDirection: 'column',
    });

    // ── Header ──
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 20px', paddingTop: 'max(12px, env(safe-area-inset-top))',
      flexShrink: '0',
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
      background: 'none', border: 'none', fontSize: '20px', color: DS.inkMuted,
      cursor: 'pointer', padding: '8px', fontFamily: DS.fontBody,
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    // ── Crop container (fills available space) ──
    const containerWrapper = document.createElement('div');
    Object.assign(containerWrapper.style, {
      flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 16px', overflow: 'hidden',
    });

    // Calculate size to fill width, constrained by aspect ratio and available height
    const availW = window.innerWidth - 32;
    const availH = window.innerHeight - 220; // header + controls + buttons
    const cropW = Math.min(availW, availH * (aspect[0] / aspect[1]));
    const cropH = cropW * (aspect[1] / aspect[0]);

    const container = document.createElement('div');
    Object.assign(container.style, {
      width: `${cropW}px`, height: `${cropH}px`,
      overflow: 'hidden', position: 'relative', borderRadius: '4px',
      border: `1px solid ${DS.inkLight}`, backgroundColor: '#000',
    });

    // Corner marks
    const cSize = '24px', cWeight = '2.5px';
    [
      { top: '0', left: '0', borderTop: `${cWeight} solid #fff`, borderLeft: `${cWeight} solid #fff` },
      { top: '0', right: '0', borderTop: `${cWeight} solid #fff`, borderRight: `${cWeight} solid #fff` },
      { bottom: '0', left: '0', borderBottom: `${cWeight} solid #fff`, borderLeft: `${cWeight} solid #fff` },
      { bottom: '0', right: '0', borderBottom: `${cWeight} solid #fff`, borderRight: `${cWeight} solid #fff` },
    ].forEach((pos) => {
      const corner = document.createElement('div');
      Object.assign(corner.style, {
        position: 'absolute', width: cSize, height: cSize,
        pointerEvents: 'none', zIndex: '2', ...pos,
      });
      container.appendChild(corner);
    });

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    Object.assign(img.style, {
      position: 'absolute', cursor: 'grab', userSelect: 'none',
      touchAction: 'none', transformOrigin: '0 0',
    } as any);
    img.draggable = false;

    let imgX = 0, imgY = 0;
    let baseScale = 1, userZoom = 1;
    let dragStartX = 0, dragStartY = 0, dragging = false;
    // Pinch state
    let pinchStartDist = 0, pinchStartZoom = 1;

    const applyTransform = () => {
      const s = baseScale * userZoom;
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
      img.style.left = `${imgX}px`;
      img.style.top = `${imgY}px`;
    };

    img.onload = () => {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const cropAspect = cropW / cropH;
      // Cover the crop area
      baseScale = imgAspect > cropAspect
        ? cropH / img.naturalHeight
        : cropW / img.naturalWidth;
      userZoom = 1;
      const w = img.naturalWidth * baseScale;
      const h = img.naturalHeight * baseScale;
      imgX = (cropW - w) / 2;
      imgY = (cropH - h) / 2;
      applyTransform();
      // Set slider to match
      slider.value = '1';
    };

    // ── Drag (single pointer) ──
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragStartX = e.clientX - imgX;
      dragStartY = e.clientY - imgY;
      img.style.cursor = 'grabbing';
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      imgX = e.clientX - dragStartX;
      imgY = e.clientY - dragStartY;
      applyTransform();
    };
    const onPointerUp = () => {
      dragging = false;
      img.style.cursor = 'grab';
    };

    img.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // ── Pinch-to-zoom (touch) ──
    const getTouchDist = (t: TouchList) => {
      const dx = t[1].clientX - t[0].clientX;
      const dy = t[1].clientY - t[0].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        dragging = false;
        pinchStartDist = getTouchDist(e.touches);
        pinchStartZoom = userZoom;
      }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDist(e.touches);
        const newZoom = Math.max(0.5, Math.min(4, pinchStartZoom * (dist / pinchStartDist)));
        userZoom = newZoom;
        slider.value = String(newZoom);
        applyTransform();
      }
    }, { passive: false });

    // ── Mouse wheel zoom ──
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      userZoom = Math.max(0.5, Math.min(4, userZoom * delta));
      slider.value = String(userZoom);
      applyTransform();
    }, { passive: false });

    container.appendChild(img);
    containerWrapper.appendChild(container);
    overlay.appendChild(containerWrapper);

    // ── Controls: zoom slider + hint ──
    const controls = document.createElement('div');
    Object.assign(controls.style, {
      padding: '12px 32px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '8px', flexShrink: '0',
    });

    // Zoom slider
    const sliderRow = document.createElement('div');
    Object.assign(sliderRow.style, {
      display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '320px',
    });

    const zoomOut = document.createElement('span');
    zoomOut.textContent = '−';
    Object.assign(zoomOut.style, { color: DS.inkMuted, fontSize: '20px', cursor: 'pointer', fontFamily: DS.fontBody });

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0.5';
    slider.max = '4';
    slider.step = '0.05';
    slider.value = '1';
    Object.assign(slider.style, {
      flex: '1', accentColor: DS.custard, height: '4px',
    });
    slider.addEventListener('input', () => {
      userZoom = parseFloat(slider.value);
      applyTransform();
    });

    const zoomIn = document.createElement('span');
    zoomIn.textContent = '+';
    Object.assign(zoomIn.style, { color: DS.inkMuted, fontSize: '20px', cursor: 'pointer', fontFamily: DS.fontBody });

    zoomOut.onclick = () => { userZoom = Math.max(0.5, userZoom - 0.2); slider.value = String(userZoom); applyTransform(); };
    zoomIn.onclick = () => { userZoom = Math.min(4, userZoom + 0.2); slider.value = String(userZoom); applyTransform(); };

    sliderRow.appendChild(zoomOut);
    sliderRow.appendChild(slider);
    sliderRow.appendChild(zoomIn);
    controls.appendChild(sliderRow);

    const hint = document.createElement('div');
    hint.textContent = 'pinch or drag to adjust';
    Object.assign(hint.style, {
      color: DS.inkMuted, fontSize: '11px', fontFamily: DS.fontMono, letterSpacing: '1px',
    });
    controls.appendChild(hint);
    overlay.appendChild(controls);

    // ── Buttons ──
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, {
      display: 'flex', gap: '12px', padding: '0 24px',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))', flexShrink: '0',
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
      const s = baseScale * userZoom;
      const canvas = document.createElement('canvas');
      // Output at 2x for retina, capped at 2400px
      const outputScale = Math.min(2, 2400 / cropW);
      canvas.width = Math.round(cropW * outputScale);
      canvas.height = Math.round(cropH * outputScale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { cleanup(); resolve(null); return; }

      // Draw image at its current position, scaled to output
      const drawX = imgX * outputScale;
      const drawY = imgY * outputScale;
      const drawW = img.naturalWidth * s * outputScale;
      const drawH = img.naturalHeight * s * outputScale;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

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
