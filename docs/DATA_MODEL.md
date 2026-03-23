# The Pages — Data Model

## Tables Overview

```
auth.users (Supabase managed)
    └── profiles (1:1, auto-created on signup)
            └── posts (1:many)
            │       └── saves (many:many via saves table)
            │       └── reports (1:many)
            │       └── moderation_log (1:many)
            └── saves (1:many)
            └── reports (1:many, as reporter)
```

---

## Table: profiles

Extends `auth.users`. Auto-created by trigger on signup.

| Column | Type | Default | Notes |
|---|---|---|---|
| id | uuid | — | FK → auth.users.id, PK |
| handle | text | auto-generated | Unique, e.g. @user_abc12345 |
| display_name | text | null | Optional, from email prefix on creation |
| bio | text | null | |
| location | text | null | User-typed only, never GPS |
| avatar_url | text | null | Supabase Storage URL |
| avatar_color | text | #E63946 | Fallback color for initials avatar |
| avatar_initials | text | null | 1-2 chars for fallback avatar |
| is_public | boolean | true | Controls profile visibility |
| allow_anonymous_posts | boolean | true | Whether user's posts hide their identity |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

**RLS:**
- SELECT: public profiles viewable by all; private only by owner
- UPDATE: owner only

---

## Table: posts

| Column | Type | Default | Notes |
|---|---|---|---|
| id | uuid | uuid_generate_v4() | PK |
| user_id | uuid | — | FK → profiles.id |
| title | text | — | Required |
| subtitle | text | null | Short tagline |
| description | text | null | 1-2 sentences |
| location | text | null | Venue / address |
| date_text | text | null | Human-readable, e.g. "SAT APR 5 • 7PM" |
| event_url | text | null | External event link |
| image_url | text | null | Supabase Storage URL for uploaded image |
| og_image_url | text | null | Open Graph image URL from URL paste |
| bg_color | text | #1a1a2e | Hex background color |
| accent_color | text | #E63946 | Hex accent color |
| text_color | text | #ffffff | Hex text color (auto-set based on bg) |
| category | text | Community | One of: Arts, Community, Wellness, Volunteer, Food |
| pattern | text | dots | One of: stripes, dots, grid, zigzag, circles |
| tags | text[] | {} | Array of hashtag strings |
| is_public | boolean | true | Public = in feed; Private = poster only |
| is_anonymous | boolean | false | If true, profile not linked on public view |
| moderation_status | text | pending | approved / held / rejected |
| moderation_reason | text | null | Internal reason category |
| moderation_confidence | float | null | AI confidence score 0.0–1.0 |
| report_count | integer | 0 | Auto-incremented by trigger |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

**RLS:**
- SELECT: (is_public AND moderation_status = 'approved') OR owner
- INSERT: authenticated users, must be owner
- UPDATE: owner only
- DELETE: owner only

**Important:** Never show `held` or `rejected` posts in the public feed, even if `is_public = true`. Always filter on `moderation_status = 'approved'`.

---

## Table: saves

| Column | Type | Default | Notes |
|---|---|---|---|
| id | uuid | uuid_generate_v4() | PK |
| user_id | uuid | — | FK → profiles.id |
| post_id | uuid | — | FK → posts.id |
| created_at | timestamptz | now() | |

**Unique constraint:** (user_id, post_id) — one save per user per post

**RLS:**
- SELECT: owner only
- INSERT: owner only
- DELETE: owner only

---

## Table: reports

| Column | Type | Default | Notes |
|---|---|---|---|
| id | uuid | uuid_generate_v4() | PK |
| reporter_id | uuid | — | FK → profiles.id |
| post_id | uuid | — | FK → posts.id |
| reason | text | — | harmful / misleading / inappropriate / spam / pii / other |
| details | text | null | Optional user note |
| ai_recommendation | text | null | AI review result |
| ai_confidence | float | null | |
| status | text | pending | pending / reviewed / actioned / dismissed |
| created_at | timestamptz | now() | |

**Unique constraint:** (reporter_id, post_id) — one report per user per post

**RLS:**
- INSERT: authenticated users
- SELECT: reporter sees own reports only

---

## Table: moderation_log

Append-only audit trail. Never delete records.

| Column | Type | Default | Notes |
|---|---|---|---|
| id | uuid | uuid_generate_v4() | PK |
| post_id | uuid | — | FK → posts.id |
| action | text | — | approved / held / rejected / reinstated / banned |
| actor | text | — | 'ai' or admin user id |
| reason_category | text | null | |
| ai_confidence | float | null | |
| notes | text | null | Admin notes |
| created_at | timestamptz | now() | |

**RLS:**
- No user access (service role only for admin dashboard)

---

## DB Triggers

### on_auth_user_created
Fires after INSERT on auth.users.
Creates a profile with auto-generated handle and initials.

```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, handle, display_name, avatar_initials)
  values (
    NEW.id,
    '@user_' || substr(NEW.id::text, 1, 8),
    split_part(coalesce(NEW.email, 'anon'), '@', 1),
    upper(substr(split_part(coalesce(NEW.email, 'an'), '@', 1), 1, 2))
  );
  return NEW;
end;
$$ language plpgsql security definer;
```

### on_report_inserted
Fires after INSERT on reports.
Increments report_count and auto-hides at threshold of 3.

```sql
create or replace function public.check_report_threshold()
returns trigger as $$
begin
  update public.posts
  set report_count = report_count + 1
  where id = NEW.post_id;

  update public.posts
  set moderation_status = 'held'
  where id = NEW.post_id
    and report_count >= 2  -- now 3 total after increment above
    and moderation_status = 'approved';

  return NEW;
end;
$$ language plpgsql security definer;
```

---

## Common Queries

### Feed (public, approved posts)
```sql
select p.*, pr.handle, pr.display_name, pr.avatar_color, pr.avatar_initials,
  exists(select 1 from saves s where s.post_id = p.id and s.user_id = auth.uid()) as is_saved
from posts p
left join profiles pr on pr.id = p.user_id
where p.is_public = true
  and p.moderation_status = 'approved'
  and (p.is_anonymous = false or p.user_id = auth.uid())
order by p.created_at desc;
```

### My Posts
```sql
select * from posts
where user_id = auth.uid()
order by created_at desc;
```

### Search
```sql
select p.*, pr.handle, pr.avatar_color
from posts p
left join profiles pr on pr.id = p.user_id
where p.is_public = true
  and p.moderation_status = 'approved'
  and (
    p.title ilike '%' || :query || '%'
    or p.location ilike '%' || :query || '%'
    or :query = any(p.tags)
  )
  and (:category = 'All' or p.category = :category)
order by p.created_at desc
limit 50;
```

### Saved Posts
```sql
select p.*, pr.handle, pr.avatar_color,
  s.created_at as saved_at
from saves s
join posts p on p.id = s.post_id
left join profiles pr on pr.id = p.user_id
where s.user_id = auth.uid()
  and p.moderation_status = 'approved'
order by s.created_at desc;
```

### Toggle Save (upsert pattern)
```typescript
// Save
await supabase.from('saves').upsert({ user_id, post_id });

// Unsave
await supabase.from('saves').delete().match({ user_id, post_id });
```

### Publish Post (with moderation)
```typescript
// 1. Upload image to storage
const { data: file } = await supabase.storage
  .from('flyers')
  .upload(`${userId}/${Date.now()}.jpg`, imageBlob);

// 2. Moderate (via edge function)
const { data: mod } = await supabase.functions
  .invoke('moderate-content', { body: { imageUrl: file.path, text: title + description } });

// 3. Insert post with moderation result
await supabase.from('posts').insert({
  ...postData,
  image_url: file.path,
  moderation_status: mod.status,
  moderation_reason: mod.reason_category,
  moderation_confidence: mod.confidence,
});

// 4. Log to moderation_log
await supabase.from('moderation_log').insert({
  post_id: newPost.id,
  action: mod.status,
  actor: 'ai',
  reason_category: mod.reason_category,
  ai_confidence: mod.confidence,
});
```

---

## Storage Buckets

Create in Supabase Storage:

| Bucket | Public | Notes |
|---|---|---|
| `flyers` | Yes | Post images. Max 10MB per file |
| `avatars` | Yes | Profile pictures. Max 2MB per file |

**Storage policies:**
```sql
-- Anyone can read public bucket files
create policy "Public read"
  on storage.objects for select
  using (bucket_id in ('flyers', 'avatars'));

-- Authenticated users can upload to their own folder
create policy "Authenticated upload"
  on storage.objects for insert
  with check (auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete own files
create policy "Owner delete"
  on storage.objects for delete
  using (auth.uid()::text = (storage.foldername(name))[1]);
```
