# The Pages — Safety Architecture

This document defines every safety, privacy, and moderation system. These are non-negotiable requirements, not nice-to-haves.

---

## Pre-Publish AI Moderation

Every post passes through `moderateContent()` in `lib/claude.ts` before publishing.

**Image checks:** graphic violence, adult content, hate symbols, content involving minors, PII in images
**Text checks:** hate speech, threatening language, spam patterns

**Outcomes:**
- `approved` → post published immediately
- `held` → post saved as pending, user sees "Under review", not published
- `rejected` → post not published, user gets reason category (no details that help circumvention)

**Never skip this step.** Even private posts should be moderated.

---

## Community Reporting

Every public post has a report option (long-press or ... menu).

**Report categories:**
- `harmful` — Harmful or dangerous content
- `misleading` — Scam or false event
- `inappropriate` — Adult or offensive content
- `spam` — Spam or duplicate
- `pii` — Personal information without consent
- `other`

**Report handling:**
- Reports are anonymous — poster never knows who reported
- 3 unique reports → post auto-hidden (moderation_status = 'held') via DB trigger
- AI re-reviews reported content with report reason as context
- Admin sees AI recommendation in dashboard
- Reporter notified when action taken (no details on outcome)
- Poster notified of removal with reason category only

---

## User Privacy

**Identity:**
- No real name required — ever
- Handle-only throughout the app
- Anonymous posting: post appears without profile linkage unless user opts in
- Email for account recovery only, never displayed

**Data:**
- No location beyond what user types
- No behavioral tracking
- No advertising data
- IP addresses never exposed to other users
- GDPR/CCPA: data exportable + deletable on request

**Sensitive communities:**
- LGBTQ+ events, political organizing, religious gatherings, health topics → anonymous by default
- Poster identity protected regardless of profile visibility

---

## PII Detection

Before publishing, run `detectPII()` on all text fields.
If triggered: show warning "This post may contain personal contact information. Remove it before posting?"
User must confirm or edit before proceeding.

For images: Claude Vision checks for visible phone numbers, home addresses, faces in non-public contexts.

---

## Under-18 Protection

- Age-appropriate filter on by default
- Events tagged 18+, alcohol, adult content → require age confirmation gate
- Zero tolerance for content involving minors in unsafe contexts → immediate removal + permanent flag
- App Store age rating: 12+

---

## External Link Safety

Every outbound link must show:
```
You're leaving The Pages
This link goes to [domain]. The Pages doesn't control external sites.
[Cancel]  [Continue]
```

No exceptions. This applies to event URLs in posts and any links in bios.

---

## Admin Moderation Dashboard (Web)

- Review queue: held + reported posts with AI recommendation + confidence score
- Actions: Approve / Remove / Escalate / Ban User
- Timestamped audit log (moderation_log table)
- User ban management: temporary and permanent
- Appeal inbox: users can contest removals via in-app form
- Weekly moderation summary

---

## Legal

- Content policy + community guidelines: shown at signup, explicit acceptance required
- DMCA takedown: dedicated email (legal@thepages.app) + in-app form, 48hr response SLA
- Terms of Service + Privacy Policy: required before first post
- Moderation log retained minimum 2 years
- DMCA Section 512 safe harbor requires active moderation — this architecture provides it

---

## What Never Ships Without

- [ ] `moderateContent()` called on every upload
- [ ] Report button on every public post
- [ ] DB trigger auto-hiding at 3 reports
- [ ] PII detection on text fields
- [ ] Anonymous posting option always available
- [ ] External link warning modal
- [ ] Age gate on 18+ content
- [ ] Content policy accepted before post
- [ ] moderation_log table active from day one
- [ ] DMCA email live at launch
