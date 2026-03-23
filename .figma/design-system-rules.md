# The Pages — Figma-to-Code Design System Rules

> These rules guide how Figma designs are translated into production code for **The Pages**, a React Native (Expo) community event flyer app.

---

## 1. Token Definitions

### Colors

**File:** `constants/colors.ts`

```typescript
import { COLORS, isLightBg, getTextColor } from '../constants/colors';
```

| Token | Value | Usage |
|-------|-------|-------|
| `COLORS.red` | `#E63946` | Brand red — primary accent, post button, CTAs |
| `COLORS.dark` | `#0a0a0a` | App background, root container |
| `COLORS.navBg` | `#0e0e0e` | Bottom navigation bar background |
| `COLORS.border` | `#1a1a1a` | Borders, dividers, nav separators |
| `COLORS.textPrimary` | `#ffffff` | Primary text on dark backgrounds |
| `COLORS.textSecondary` | `#aaaaaa` | Secondary/muted text |
| `COLORS.textMuted` | `#444444` | Disabled/placeholder text |

#### Flyer Color Presets (8 combinations)

Each flyer uses one preset with a `bg` + `accent` pair:

| # | Background | Accent | Mood |
|---|-----------|--------|------|
| 0 | `#1a1a2e` | `#E63946` | Dark blue + red |
| 1 | `#d8f3dc` | `#2d6a4f` | Mint + forest |
| 2 | `#ff6b6b` | `#ffd93d` | Coral + yellow |
| 3 | `#003566` | `#ffd166` | Navy + gold |
| 4 | `#10002b` | `#c77dff` | Purple + violet |
| 5 | `#fff8f0` | `#ff6b35` | Cream + orange |
| 6 | `#0d1b2a` | `#00b4d8` | Dark teal + cyan |
| 7 | `#1a0a00` | `#fb8500` | Brown + burnt orange |

#### Text Color Logic

Light backgrounds (`#d8f3dc`, `#ff6b6b`, `#fff8f0`, `#f5f0e8`) use dark text `#1a1a1a`. All others use white `#ffffff`.

```typescript
// Always use these helpers — never hardcode text colors on flyers
const textColor = getTextColor(flyer.bg_color);   // '#1a1a1a' or '#ffffff'
const isLight = isLightBg(flyer.bg_color);         // boolean
```

### Typography

**File:** `constants/fonts.ts`

| Token | Font | Weight | Usage |
|-------|------|--------|-------|
| `FONTS.display` | Barlow Condensed | 900 Black | Flyer titles (72px) |
| `FONTS.displayBold` | Barlow Condensed | 700 Bold | Subtitles (21px) |
| `FONTS.body` | Barlow | 400 Regular | Body text, descriptions |
| `FONTS.bodyMedium` | Barlow | 500 Medium | Medium-weight body |
| `FONTS.bodySemiBold` | Barlow | 600 SemiBold | Emphasized body text |
| `FONTS.mono` | DM Sans | 400 Regular | Labels, badges, UI chrome |

**Font loading:** Fonts are loaded in `app/_layout.tsx` via `useFonts()` from expo-font. Always reference via the `FONTS` object, never hardcode font family strings.

### Spacing & Sizing Constants

These are not in a dedicated file — they live in component StyleSheets. When implementing from Figma, use these values:

| Element | Value |
|---------|-------|
| Bottom nav height | `62px` |
| Content horizontal padding | `28px` |
| Content top padding | `52px` |
| Content bottom padding | `28px` |
| Accent bar height | `6px` |
| Category badge padding | `13px H × 5px V` |
| Date badge padding | `13px H × 7px V` |
| Save button size | `42×42px` (border-radius 21) |
| Avatar size | `26×26px` (border-radius 13) |
| Footer gap | `7px` |
| Divider height | `1px` at `0.12` opacity |

---

## 2. Component Library

**Location:** `components/`

### Existing Components

| Component | File | Purpose |
|-----------|------|---------|
| `FlyerCard` | `components/FlyerCard.tsx` | Fullscreen event flyer card |
| `PatternBg` | `components/PatternBg.tsx` | SVG background patterns |

### Component Architecture

- **Functional components** with TypeScript interfaces for props
- **Named exports** (not default exports)
- Props interfaces defined above the component in the same file
- No HOCs or render props — plain React hooks

```typescript
// Pattern: how components are structured
interface FlyerCardProps {
  flyer: Post;
  onSave: (id: string) => void;
  isLast?: boolean;
  bottomInset?: number;
}

export function FlyerCard({ flyer, onSave, isLast, bottomInset = 0 }: FlyerCardProps) {
  // ...
}
```

### Background Patterns

5 SVG pattern types via `PatternBg`, rendered with `react-native-svg`:

| Pattern | Spacing | Opacity | Elements |
|---------|---------|---------|----------|
| `dots` | 20px | 0.18 | Small circles (r=1.5) |
| `stripes` | 22px | 0.08 | Diagonal lines |
| `grid` | 28px | 0.08 | Horizontal + vertical lines |
| `zigzag` | 24px | 0.08 | Angled lines |
| `circles` | 44px | 0.07 | Large circles (r=13.2) |

---

## 3. Frameworks & Libraries

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | React Native | 0.76.5 |
| **Framework** | Expo | ~52.0.0 |
| **Router** | Expo Router | ~4.0.0 |
| **Language** | TypeScript | strict mode |
| **Backend** | Supabase | ^2.99.1 |
| **SVG** | react-native-svg | ^15.8.0 |
| **Build** | Expo/Metro bundler | (via Expo) |

**No CSS framework** — styling is done entirely via React Native `StyleSheet.create()`.

---

## 4. Asset Management

**Location:** `assets/`

| File | Purpose |
|------|---------|
| `icon.png` | App icon |
| `adaptive-icon.png` | Android adaptive icon |
| `splash-icon.png` | Splash screen icon |
| `favicon.png` | Web favicon |

- Assets referenced via Expo config in `app.config.ts`
- User-uploaded images stored in **Supabase Storage**
- No CDN or local image optimization pipeline
- No static image imports in components (flyer images come from Supabase)

---

## 5. Icon System

**Approach:** Unicode characters and emoji — no icon library.

| Icon | Character | Usage |
|------|-----------|-------|
| Search | `🔍` | Search tab |
| Star (saved) | `★` / `☆` | Save toggle |
| Plus (post) | `＋` | Post button |
| Shuffle | `↻` | Shuffle tab |
| Profile | `◉` | Profile tab |
| Location | `📍` | Location marker |
| Lock | `🔒` | Private badge |

**When adding new icons:** Continue using Unicode/emoji characters. Do not introduce an icon library unless the project explicitly migrates.

---

## 6. Styling Approach

### Methodology: React Native StyleSheet

All styles use `StyleSheet.create()` at the bottom of each component file. **No CSS, Tailwind, styled-components, or CSS modules.**

```typescript
// Standard pattern
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark,
  },
});
```

### Dynamic Styles

Dynamic values are applied via inline style arrays:

```typescript
<View style={[styles.card, { width, height: cardHeight, backgroundColor: flyer.bg_color }]}>
```

### Global Styles

- Root background: `#0a0a0a` (set in `app/_layout.tsx`)
- Status bar: `light` (white icons)
- Interface style: `dark` (set in `app.config.ts`)
- No global stylesheet — each component owns its styles

### Responsive Design

- `useWindowDimensions()` for screen-relative sizing
- `useSafeAreaInsets()` for notch/home indicator padding
- Card height = `screenHeight - 62 (nav) - bottomInset`
- No breakpoint system — mobile-first single-column layout

### Text Shadow Pattern (dark backgrounds only)

```typescript
textShadowColor: !isLight ? 'rgba(0,0,0,0.18)' : 'transparent',
textShadowOffset: !isLight ? { width: 3, height: 3 } : { width: 0, height: 0 },
textShadowRadius: 0,
```

### Opacity Scale

| Opacity | Usage |
|---------|-------|
| 0.07–0.08 | Background patterns |
| 0.12 | Dividers |
| 0.18 | Dot patterns |
| 0.22 | Scroll indicator |
| 0.38 | Tags |
| 0.45 | Poster handle |
| 0.6 | Location text |
| 0.72 | Description text |
| 0.85 | Avatar |
| 1.0 | Titles, primary UI |

---

## 7. Project Structure

```
the-pages/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout (fonts, splash)
│   ├── (tabs)/             # Tab navigation
│   │   ├── _layout.tsx     # Custom bottom tab bar
│   │   ├── index.tsx       # Feed (fullscreen flyers)
│   │   ├── search.tsx      # Search & filter
│   │   ├── saved.tsx       # Saved collection
│   │   ├── shuffle.tsx     # Random shuffle
│   │   └── profile.tsx     # User profile
│   └── post/
│       └── compose.tsx     # Flyer composer modal
├── components/             # Shared UI components
│   ├── FlyerCard.tsx       # Main flyer card
│   └── PatternBg.tsx       # SVG patterns
├── constants/              # Design tokens
│   ├── colors.ts           # Color palette + helpers
│   ├── fonts.ts            # Typography tokens
│   ├── categories.ts       # Category & pattern enums
│   └── seedData.ts         # Dev seed data
├── types/
│   └── index.ts            # TypeScript interfaces
├── lib/
│   └── supabase.ts         # Supabase client
├── hooks/                  # Custom React hooks
├── assets/                 # App icons & splash
└── docs/                   # PRD, data model, safety
```

### Patterns

- **Screens** go in `app/` following Expo Router file-based routing
- **Shared components** go in `components/`
- **Constants/tokens** go in `constants/`
- **Types** go in `types/index.ts`
- **Business logic** goes in `lib/`
- **Custom hooks** go in `hooks/`

---

## 8. Figma-to-Code Translation Rules

When converting a Figma design to code for this project:

1. **Use `StyleSheet.create()`** — never introduce CSS, Tailwind, or styled-components
2. **Reference tokens** — use `COLORS`, `FONTS` from constants, don't hardcode values
3. **Use `getTextColor(bg)`** — never manually pick text colors on flyer backgrounds
4. **Respect the 8 presets** — flyer colors must come from `COLORS.presets`, not arbitrary values
5. **Named exports** — `export function ComponentName` not `export default`
6. **TypeScript strict** — define prop interfaces, type all parameters
7. **Emoji icons** — don't import icon libraries; use Unicode characters
8. **Dimensions** — use `useWindowDimensions()` for responsive sizing, not fixed pixel widths
9. **Safe areas** — account for `useSafeAreaInsets()` on all full-screen content
10. **Flat hierarchy** — components are not nested in feature folders; all live in `components/`
11. **No gradients** — React Native doesn't support CSS gradients natively; use solid colors + opacity
12. **Font references** — always use `FONTS.display`, `FONTS.body`, etc. from `constants/fonts.ts`
