# The Pages — Product Requirements (v1.0)

## Mission
Make local events easy to discover and share — beautifully, safely, without friction.

## Core Loop
Upload flyer → AI reads it → fills details → posts to feed → community discovers → taps out to event

---

## MVP Features

### Feed
- Fullscreen scroll-snap (one poster per screen, TikTok-style)
- Floating wordmark, no header bar
- Save star top-right of each poster
- Private posts show 🔒 badge
- Category filter: All, Arts, Community, Wellness, Volunteer, Food
- Shuffle button

### Post Composer
Three ways to add:
1. Upload image from camera roll → AI scans → auto-fills fields
2. Paste any URL → fetches Open Graph image + metadata
3. Screenshot → same as upload

Fields: title*, subtitle*, description, location, date, event URL, category, color scheme, visibility (public/private)

### Search
- Full-text: title, location, tags, handle
- Category filter chips
- Results: color thumbnail + title + date + location + save button

### Saved
- Personal bookmarked flyers
- Persists across sessions

### Profile
- Handle, display name, bio, location, avatar
- Public / Private profile toggle
- Stats: posted, public, private, saved
- Grid of my posts (public tab + private tab)
- Inline edit mode
- Anonymous posting always available

---

## Navigation (bottom, 5 items)
`Search · Saved · ＋Post(red) · Shuffle · Profile`

---

## Safety Requirements (ALL ship with MVP)
- AI moderation on every upload before public post
- Report button on every public post
- 3 reports = auto-hide pending review
- PII detection on image uploads
- Anonymous posting available always
- External link warning modal
- Age gate on 18+ content
- Content policy accepted before first post
- Moderation audit log from day one
- DMCA takedown process active at launch

---

## Content & Posting Rules
- Public posts: visible in feed, indexed in search
- Private posts: poster only, never indexed
- All outbound links show "You're leaving The Pages" modal
- Uploaded images containing home addresses / personal phone numbers → flagged before post
- No direct messaging in MVP

---

## Moderation Flow
1. User submits post
2. Image + text → Claude Vision API
3. AI returns: approved / held / rejected + confidence + reason category
4. Approved → published
5. Held → pending, user notified "Under review"
6. Rejected → not published, user gets reason category only
7. Community reports → re-triggers AI, escalates at 3 reports
8. Admin dashboard: queue with AI recommendations, one-click actions

---

## Phase 2 (Post-Launch)
Verified badges, Eventbrite/Meetup API, push notifications, following/followers, city filtering

## Phase 3 (Growth)
Organizer accounts, sponsored posts, Android, web embeds
