# The Pages — Claude Code Briefing

You are building **The Pages**, a community event flyer app. Think Instagram but only for event posters — fullscreen, scroll-snapped, beautifully designed flyers that link out to wherever the event lives.

Read this entire file before writing a single line of code.

---

## What This App Is

A visual discovery feed for local event flyers. The core loop:
1. Someone sees an event anywhere (Instagram, Partiful, a group chat)
2. They screenshot or upload the flyer to The Pages
3. Claude Vision reads the image and auto-fills all event details
4. It posts to the community feed
5. Others discover it, save it, tap through to the original event

The Pages is a **discovery layer**, not a ticketing or RSVP platform. It does not compete with Eventbrite or Partiful — it surfaces their events beautifully.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo (React Native) — iOS first |
| Web | React (prototype exists, see `/prototype`) |
| Backend / DB | Supabase (Postgres + Row Level Security) |
| Auth | Supabase Auth (email + anonymous mode) |
| File Storage | Supabase Storage |
| AI — Scan | Anthropic Claude claude-sonnet-4-20250514 Vision API |
| AI — Moderation | Anthropic Claude (image + text) |
| OG Fetching | Supabase Edge Function |
| Deployment | Expo EAS (mobile) + Vercel (web) |
| App Store | Apple via EAS + asc CLI |

---

## Project Structure to Create

```
the-pages/
├── CLAUDE.md                    ← this file (copy here)
├── PRD.md                       ← product requirements
├── apps/
│   ├── mobile/                  ← Expo React Native app
│   │   ├── app/                 ← Expo Router screens
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx    ← Feed screen
│   │   │   │   ├── search.tsx   ← Search screen
│   │   │   │   ├── saved.tsx    ← Saved screen
│   │   │   │   └── profile.tsx  ← Profile screen
│   │   │   ├── post/
│   │   │   │   └── compose.tsx  ← Post composer
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   │   ├── FlyerCard.tsx
│   │   │   ├── PostComposer.tsx
│   │   │   ├── ReportModal.tsx
│   │   │   ├── ExternalLinkWarning.tsx
│   │   │   └── PatternBg.tsx
│   │   ├── lib/
│   │   │   ├── supabase.ts      ← Supabase client
│   │   │   ├── claude.ts        ← Anthropic API calls
│   │   │   ├── moderation.ts    ← Moderation logic
│   │   │   └── og.ts            ← OG metadata fetcher
│   │   ├── hooks/
│   │   │   ├── useFlyers.ts
│   │   │   ├── useProfile.ts
│   │   │   └── useSaved.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── constants/
│   │       ├── colors.ts
│   │       └── categories.ts
│   └── web/                     ← React web app (existing prototype)
├── supabase/
│   ├── migrations/
│   │   └── 001_initial.sql      ← Full schema
│   ├── functions/
│   │   └── og-fetch/
│   │       └── index.ts         ← Edge function for OG metadata
│   └── seed.sql                 ← Sample data for dev
└── docs/
    ├── PRD.md
    ├── SAFETY.md
    └── DATA_MODEL.md
```

---

## Database Schema

Run this in Supabase SQL editor to set up the full schema:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USERS (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  handle text unique not null,
  display_name text,
  bio text,
  location text,
  avatar_url text,
  avatar_color text default '#E63946',
  avatar_initials text,
  is_public boolean default true,
  allow_anonymous_posts boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- POSTS
create table public.posts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  subtitle text,
  description text,
  location text,
  date_text text,
  event_url text,
  image_url text,
  og_image_url text,
  bg_color text default '#1a1a2e',
  accent_color text default '#E63946',
  text_color text default '#ffffff',
  category text default 'Community',
  pattern text default 'dots',
  tags text[] default '{}',
  is_public boolean default true,
  is_anonymous boolean default false,
  moderation_status text default 'pending' check (moderation_status in ('pending', 'approved', 'held', 'rejected')),
  moderation_reason text,
  moderation_confidence float,
  report_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SAVES
create table public.saves (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

-- REPORTS
create table public.reports (
  id uuid default uuid_generate_v4() primary key,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  reason text not null check (reason in ('harmful', 'misleading', 'inappropriate', 'spam', 'pii', 'other')),
  details text,
  ai_recommendation text,
  ai_confidence float,
  status text default 'pending' check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz default now(),
  unique(reporter_id, post_id)
);

-- MODERATION LOG
create table public.moderation_log (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  action text not null check (action in ('approved', 'held', 'rejected', 'reinstated', 'banned')),
  actor text not null, -- 'ai' or admin user id
  reason_category text,
  ai_confidence float,
  notes text,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.saves enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_log enable row level security;

-- PROFILES policies
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (is_public = true or auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- POSTS policies
create policy "Public approved posts are viewable by everyone"
  on public.posts for select
  using (
    (is_public = true and moderation_status = 'approved')
    or auth.uid() = user_id
  );

create policy "Authenticated users can insert posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own posts"
  on public.posts for update
  using (auth.uid() = user_id);

create policy "Users can delete own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

-- SAVES policies
create policy "Users can view own saves"
  on public.saves for select
  using (auth.uid() = user_id);

create policy "Users can insert saves"
  on public.saves for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own saves"
  on public.saves for delete
  using (auth.uid() = user_id);

-- REPORTS policies
create policy "Users can insert reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users can view own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- Auto-hide posts at 3 reports
create or replace function public.check_report_threshold()
returns trigger as $$
begin
  update public.posts
  set moderation_status = 'held'
  where id = NEW.post_id
    and report_count >= 2
    and moderation_status = 'approved';
  
  update public.posts
  set report_count = report_count + 1
  where id = NEW.post_id;
  
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_report_inserted
  after insert on public.reports
  for each row execute procedure public.check_report_threshold();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, handle, display_name, avatar_initials)
  values (
    NEW.id,
    '@user_' || substr(NEW.id::text, 1, 8),
    split_part(NEW.email, '@', 1),
    upper(substr(split_part(NEW.email, '@', 1), 1, 2))
  );
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## Core Types

```typescript
// types/index.ts

export type Category = 'Arts' | 'Community' | 'Wellness' | 'Volunteer' | 'Food';
export type Pattern = 'stripes' | 'dots' | 'grid' | 'zigzag' | 'circles';
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
  image_url: string | null;
  og_image_url: string | null;
  bg_color: string;
  accent_color: string;
  text_color: string;
  category: Category;
  pattern: Pattern;
  tags: string[];
  is_public: boolean;
  is_anonymous: boolean;
  moderation_status: ModerationStatus;
  report_count: number;
  created_at: string;
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

export interface ScanResult {
  title: string;
  subtitle: string;
  description: string;
  location: string;
  date: string;
  category: Category;
  tags: string[];
}
```

---

## Supabase Client Setup

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import 'react-native-get-random-values';

// Encrypted session storage for Expo (SecureStore has 2KB limit, use AES for larger values)
class LargeSecureStore {
  private async _encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string): Promise<string> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) throw new Error('No key found');
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this._decrypt(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

---

## Claude API — AI Scan

```typescript
// lib/claude.ts
import type { ScanResult, ModerationResult } from '../types';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude(body: object): Promise<any> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, ...body }),
  });
  return res.json();
}

// Scan a flyer image and extract event details
export async function scanFlyer(base64: string, mediaType: string): Promise<ScanResult> {
  const data = await callClaude({
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        {
          type: 'text',
          text: `Read this community event flyer and return ONLY a valid JSON object, no markdown, no backticks:
{
  "title": "MAIN EVENT NAME in ALL CAPS",
  "subtitle": "Short tagline or time",
  "description": "1-2 sentence description",
  "location": "Venue name and/or address",
  "date": "Abbreviated date like SAT APR 5 • 7PM",
  "category": "One of: Arts, Community, Wellness, Volunteer, Food",
  "tags": ["#tag1", "#tag2"]
}
Use empty string for any field not visible. Return JSON only.`
        }
      ]
    }]
  });

  const raw = data.content?.find((b: any) => b.type === 'text')?.text || '{}';
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return { title: '', subtitle: '', description: '', location: '', date: '', category: 'Community', tags: [] };
  }
}

// Moderate content before publishing
export async function moderateContent(
  imageBase64: string | null,
  mediaType: string | null,
  text: string
): Promise<ModerationResult> {
  const content: any[] = [];

  if (imageBase64 && mediaType) {
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } });
  }

  content.push({
    type: 'text',
    text: `You are a content moderator for a community event flyer app. Review this content and return ONLY a JSON object:
{
  "status": "approved" | "held" | "rejected",
  "confidence": 0.0-1.0,
  "reason_category": "none" | "violence" | "adult_content" | "hate_speech" | "pii" | "spam" | "dangerous" | "minors",
  "details": "Brief internal note"
}

Rules:
- APPROVED: Normal community event content
- HELD: Ambiguous, needs human review
- REJECTED: Clear violation (graphic violence, adult content, hate speech, content sexualizing minors)

Text to review: "${text}"

Return JSON only, no markdown.`
  });

  const data = await callClaude({ messages: [{ role: 'user', content }] });
  const raw = data.content?.find((b: any) => b.type === 'text')?.text || '{}';

  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return { status: 'held', confidence: 0.5, reason_category: 'none' };
  }
}

// Check text for PII before posting
export async function detectPII(text: string): Promise<boolean> {
  const data = await callClaude({
    messages: [{
      role: 'user',
      content: `Does this text contain personally identifiable information like a home address, personal phone number, SSN, or private email? Answer only YES or NO.\n\nText: "${text}"`
    }]
  });
  const answer = data.content?.[0]?.text?.trim().toUpperCase() || 'NO';
  return answer.startsWith('YES');
}
```

---

## Design System

```typescript
// constants/colors.ts
export const COLORS = {
  // Brand
  red: '#E63946',
  dark: '#0a0a0a',
  navBg: '#0e0e0e',
  border: '#1a1a1a',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#aaaaaa',
  textMuted: '#444444',

  // Flyer presets
  presets: [
    { bg: '#1a1a2e', accent: '#E63946' },
    { bg: '#d8f3dc', accent: '#2d6a4f' },
    { bg: '#ff6b6b', accent: '#ffd93d' },
    { bg: '#003566', accent: '#ffd166' },
    { bg: '#10002b', accent: '#c77dff' },
    { bg: '#fff8f0', accent: '#ff6b35' },
    { bg: '#0d1b2a', accent: '#00b4d8' },
    { bg: '#1a0a00', accent: '#fb8500' },
  ],

  // Light backgrounds (need dark text)
  lightBgs: ['#d8f3dc', '#ff6b6b', '#fff8f0', '#f5f0e8'],
};

export const FONTS = {
  display: 'BarlowCondensed_900Black',
  displayBold: 'BarlowCondensed_700Bold',
  body: 'Barlow_400Regular',
  mono: 'DMSans_400Regular', // fallback if DM Mono not available
};

// constants/categories.ts
export const CATEGORIES = ['All', 'Arts', 'Community', 'Wellness', 'Volunteer', 'Food'] as const;
export const PATTERNS = ['stripes', 'dots', 'grid', 'zigzag', 'circles'] as const;
```

---

## Environment Variables

Create `.env.local` in the mobile app root:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# Note: Anthropic API key is handled server-side via Supabase Edge Functions
# NEVER put your Anthropic API key in the mobile app bundle
```

**Important:** The Anthropic API key must be called from a Supabase Edge Function, not directly from the mobile app. This prevents key exposure in the app bundle.

---

## Supabase Edge Function — OG Fetch

```typescript
// supabase/functions/og-fetch/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { url } = await req.json();

  if (!url) return new Response(JSON.stringify({ error: 'No URL' }), { status: 400 });

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ThePages/1.0 (link preview bot)' }
    });
    const html = await res.text();

    const get = (prop: string) => {
      const match = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${prop}["']`, 'i'));
      return match?.[1] || null;
    };

    return new Response(JSON.stringify({
      title: get('title'),
      description: get('description'),
      image: get('image'),
      url: get('url') || url,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Fetch failed' }), { status: 500 });
  }
});
```

---

## Key UX Rules — Never Break These

1. **Feed is fullscreen scroll-snap** — one poster per screen, no headers eating space
2. **"The Pages" wordmark floats** over the feed — not in a nav bar
3. **Every post goes through AI moderation** before appearing publicly — no exceptions
4. **Save star is always top-right of each poster** — not in a separate actions bar
5. **Private posts show 🔒 badge** — never appear in public feed or search
6. **Report button on every public post** — tap ... or long-press
7. **External links always show a warning modal** — "You're leaving The Pages"
8. **No real name ever required** — handle only throughout the app
9. **Bottom nav: Search · Saved · ＋(red) · Shuffle · Profile** — in this order
10. **Post composer has 3 entry points**: image upload, URL paste, screenshot — AI fills the rest

---

## Safety Non-Negotiables

These ship with MVP or the app does not launch:

- [ ] AI moderation on every upload before public post
- [ ] Community report button on every public post
- [ ] 3 reports = auto-hide pending review
- [ ] PII detection on image upload
- [ ] Anonymous posting available always
- [ ] External link warning modal
- [ ] Age gate on 18+ tagged content
- [ ] DMCA takedown email active
- [ ] Content policy accepted before first post
- [ ] Moderation audit log from day one

---

## Existing Prototype

A working React web prototype exists at `/prototype/the-pages.jsx`. It demonstrates:
- Fullscreen scroll-snap feed
- PatternBg component (stripes, dots, grid, zigzag, circles)
- Post composer with AI scan flow
- Profile page with public/private toggle
- Search overlay with category filters
- Bottom navigation

Use this as visual and interaction reference. The Expo app should match this aesthetic exactly — same typography (Barlow Condensed + Barlow + DM Mono), same color system, same fullscreen poster layout.

---

## First Tasks for Claude Code

Start in this order:

1. `npx create-expo-app@latest the-pages --template blank-typescript`
2. Install dependencies (see package list below)
3. Set up Supabase project + run migration SQL
4. Configure Supabase Edge Function for OG fetch + AI calls
5. Build the Feed screen first — fullscreen scroll-snap with sample data
6. Wire up Supabase auth (anonymous sign-in for MVP)
7. Build post composer with image upload + AI scan
8. Add moderation to publish flow
9. Build profile, search, saved screens
10. Add reporting flow

---

## Dependencies to Install

```bash
npx expo install \
  @supabase/supabase-js \
  @react-native-async-storage/async-storage \
  expo-secure-store \
  expo-image-picker \
  expo-file-system \
  expo-linking \
  expo-router \
  react-native-safe-area-context \
  react-native-screens \
  aes-js \
  react-native-get-random-values

# Fonts
npx expo install \
  @expo-google-fonts/barlow-condensed \
  @expo-google-fonts/barlow \
  @expo-google-fonts/dm-sans \
  expo-font
```

---

## Questions Needing Answers Before Build

1. Supabase project URL + anon key (create at supabase.com)
2. Anthropic API key (console.anthropic.com) — store in Supabase secrets, not app
3. iOS app bundle ID (e.g. `com.hannahfarias.thepages`)
4. App Store team ID (from Apple Developer account — pending verification)
5. MVP: iOS only or iOS + web simultaneously?

---

*The Pages PRD v1.0 — March 2026 — Hannah Farias*
*Built with Claude Code + Expo + Supabase + Anthropic*
