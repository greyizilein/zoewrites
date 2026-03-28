

# Complete Dashboard Redesign — App-Style Card Grid

## What this replaces

The entire `src/pages/Dashboard.tsx` will be rewritten from scratch. All existing KPI strips, word budget bars, recent activity lists, and assessment card grids are removed and replaced with a new layout inspired by the reference screenshot.

## New Dashboard Structure

The reference shows a mobile-first app dashboard with:
- A top bar with logo, member count/greeting, and profile avatar
- A large central gauge/donut chart as the hero metric
- Small stat cards arranged around the gauge
- Category action tiles below (compact, square-ish, icon-based)
- A "Get Report" CTA button
- A chart section at the bottom (bar chart with legend)
- Bottom tab bar for navigation

### Mapped to ZOE's data

```text
┌─────────────────────────────────┐
│  ZOE        Welcome, Name   👤 │  ← top bar
├─────────────────────────────────┤
│       Today's Progress          │
│                                 │
│      ┌──────────────┐           │
│      │   Donut/Arc  │  ● Done X│
│      │    571       │  ● Active │
│      │ Total Words  │  ● Draft  │
│      └──────────────┘           │
│                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │Words│ │Assess│ │Avg %│       │
│  │Left │ │ments│ │Done │       │
│  └─────┘ └─────┘ └─────┘       │
│                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │ New │ │Analyt│ │Sett-│       │
│  │Asses│ │ ics  │ │ings │       │
│  └─────┘ └─────┘ └─────┘       │
│                                 │
│   [  Get Report / Export  ]     │
│                                 │
│   Recent Assessments            │
│   ● Title 1        50%  2h ago │
│   ● Title 2        89%  1d ago │
│   ● Title 3       100%  3d ago │
│                                 │
│  ┌───────────────────────┐      │
│  │  Completion Trend     │      │
│  │  (mini bar chart)     │      │
│  └───────────────────────┘      │
│                                 │
│ 🏠  📝  📊  ⚙️  👤             │ ← bottom nav
└─────────────────────────────────┘
```

## Detailed plan

### File: `src/pages/Dashboard.tsx` — Full rewrite

**1. Top bar**
- Logo "ZOE" left, greeting + tier badge center-ish, profile avatar right
- Avatar opens dropdown with Analytics, Settings (link to /dashboard for now), Sign Out
- Sticky on scroll

**2. Hero gauge — donut/arc chart**
- Large SVG donut arc showing total words written vs total target across all assessments
- Center number: total words written
- Label: "Total Words"
- Right side: 3 small colored dots with counts for Complete, Active, Draft assessments
- Uses the terracotta/navy/grey brand colors from the reference

**3. Quick stats — 3 compact square tiles in a row**
- "Words Left" (∞ for unlimited), "Assessments" (count), "Avg. Done" (%)
- Each tile: icon, label, value — compact, equal size
- `grid-cols-3` with `gap-2`, fixed height ~72px
- Rounded corners, border, subtle shadow on tap

**4. Action tiles — 3 compact square tiles**
- "New Assessment" → links to /assessment/new
- "Analytics" → links to /analytics
- "Settings" → placeholder or link
- Each has an icon and label, same sizing as stats tiles
- Interactive hover/tap feedback

**5. CTA button**
- "New Assessment" full-width rounded button in terracotta
- Links to /assessment/new

**6. Recent Assessments — compact list card**
- Card with header "Recent Assessments"
- Up to 5 items: colored dot + title + % + time ago
- Each row is a link to /assessment/:id
- Swipe or tap to navigate
- Delete via long-press or three-dot menu

**7. Mini completion trend chart**
- Small card with a mini bar chart showing assessment completion % over recent days
- Uses recharts (already installed)
- Compact: ~120px tall

**8. Bottom navigation bar (mobile only)**
- Fixed bottom bar with 5 icons: Home, New, Analytics, Settings, Profile
- Home = /dashboard, New = /assessment/new, Analytics = /analytics
- Hidden on desktop (sidebar takes over)

**9. Desktop sidebar**
- Keep existing sidebar structure for md+ screens
- Same nav links as bottom bar

### Sizing rules for all tiles/cards
- Mobile: all stat/action tiles use the same class — `h-[72px]` with rounded-xl, border, centered content
- Grid: `grid-cols-3 gap-2` for both stat and action rows
- No tile stretches — all equal width within the grid
- Desktop: same visual system, slightly larger padding

### Dependencies
- `recharts` — already installed, used for the mini chart
- SVG donut — custom, no new dependency needed
- `framer-motion` — already used, keep for entrance animations

### What gets removed
- The old KPI strip with aspect-square sizing
- The old word budget progress bar section
- The old full-width recent activity panel
- The old assessment card grid with status badges and dropdown menus

### What stays
- All data fetching logic (assessments, profile)
- Delete handler
- Sign out handler
- Desktop sidebar nav
- Mobile header dropdown

## Files to change

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Complete rewrite — new app-style card grid dashboard with donut gauge, compact tiles, bottom nav, mini chart |

