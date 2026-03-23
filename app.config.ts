import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'The Pages',
  slug: 'the-pages',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#1a1a1a',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1a1a1a',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.hannahfarias.thepages',
    buildNumber: '1',
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        'The Pages needs access to your photo library to upload event flyers.',
      NSCameraUsageDescription:
        'The Pages needs camera access to photograph event flyers.',
      NSPhotoLibraryAddUsageDescription:
        'The Pages needs permission to save images.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1a1a1a',
    },
    package: 'com.hannahfarias.thepages',
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  scheme: 'thepages',
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: '', // ← fill in after `eas build:configure`
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission:
          'The Pages needs access to your photos to upload event flyers.',
        cameraPermission:
          'The Pages needs camera access to photograph event flyers.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
