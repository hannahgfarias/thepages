import type { ImageSourcePropType } from 'react-native';

export type Category = 'Party' | 'Music' | 'Community' | 'Arts' | 'Wellness' | 'Food' | 'Free' | 'Theatre' | 'Fitness' | 'Nightlife' | 'Volunteer' | 'Sports' | 'Tech' | 'Film' | 'Comedy' | 'Markets' | 'Workshop' | 'Other';
export type ModerationStatus = 'pending' | 'approved' | 'held' | 'rejected';
export type ReportReason = 'harmful' | 'misleading' | 'inappropriate' | 'spam' | 'pii' | 'other';
export type Visibility = 'public' | 'private';

export interface Profile {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  avatar_color: string;
  avatar_initials: string;
  is_public: boolean;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  location: string | null;
  date_text: string | null;
  event_url: string | null;
  // Image — local require() for seed, URL string for remote
  image: ImageSourcePropType | null;
  image_url: string | null;
  og_image_url: string | null;
  // Blur background dominant color
  bgColor: string;
  category: string; // e.g. "PARTY", "MUSIC", "FREE · FITNESS"
  tags: string[];
  is_public: boolean;
  is_anonymous: boolean;
  moderation_status: ModerationStatus;
  report_count: number;
  created_at: string;
  // CTA button text
  link: string;
  // Joined
  profile?: Profile;
  is_saved?: boolean;
  is_mine?: boolean;
}

export interface Save {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  post_id: string;
  reason: ReportReason;
  details?: string;
  status: string;
  created_at: string;
}

export interface ModerationResult {
  status: 'approved' | 'held' | 'rejected';
  confidence: number;
  reason_category?: string;
  details?: string;
}

export interface OGMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export interface ScanOccurrence {
  date: string;
  location: string;
}

export interface ScanResult {
  title: string;
  subtitle: string;
  description: string;
  location: string;
  date: string;
  category: Category;
  tags: string[];
  occurrences?: ScanOccurrence[];
}
