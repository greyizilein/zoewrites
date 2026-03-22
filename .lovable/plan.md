
# Fix Dashboard KPI Cards to Match Mobile Reference

## What’s wrong now

From the current `Dashboard.tsx` and your screenshots, the KPI cards are oversized because the mobile layout uses `aspect-square` with centered content. That makes each tile too tall, too empty, and visually unlike your reference. The current version also still feels like stretched blocks rather than tight, deliberate dashboard cards.

## Plan

### 1. Rebuild the KPI strip as fixed-size compact tiles on mobile
In `src/pages/Dashboard.tsx`:

- Remove the current mobile `aspect-square` approach
- Use a strict 2-column mobile grid with **equal fixed tile heights**
- Set every KPI tile to the **same exact mobile height** so none grow taller than the others
- Keep them fully interactive on both mobile and desktop

Implementation direction:
- Mobile: `grid-cols-2` with compact fixed-height cards
- Desktop: `sm:grid-cols-4` with the same visual style but slightly more breathing room
- Add `w-full` so each card fills its grid cell cleanly

### 2. Make the cards visually match the reference more closely
Still in `src/pages/Dashboard.tsx`:

- Replace the current “large empty center” layout with a tighter stack:
  - top: label
  - middle: value
  - bottom: short subtitle
- Reduce vertical whitespace
- Keep rounded corners, subtle border, and hover/tap feedback
- Make the card body feel denser and more intentional, not like a giant blank square

### 3. Enforce identical sizing for all four KPI cards
The key fix is consistency:

- All KPI cards should share one sizing class
- No card should resize based on content length
- Long values should stay compact via `formatCompact(...)`
- Text should be centered and clamped to avoid stretching the tile

### 4. Keep interaction on both mobile and desktop
For all KPI cards:

- Mobile: tap feedback
- Desktop: hover lift/shadow
- Optional next step after styling: make each KPI card clickable to filter/open related dashboard sections

### 5. Tighten surrounding spacing so the section looks balanced
Also in `src/pages/Dashboard.tsx`:

- Reduce the gap between the welcome block and KPI strip on mobile
- Slightly tighten grid gaps so the 2×2 card group reads as one compact unit
- Keep desktop spacing more open

## File to change

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Replace the current oversized KPI card styling with fixed-height, equal-size, compact interactive tiles for mobile and balanced cards for desktop |

## Expected result

On mobile:
- 4 KPI cards in a neat 2×2 layout
- all cards exactly the same size
- no giant square/blank cards
- no stretched rectangular blocks
- compact, polished, touch-friendly tiles closer to your screenshot reference

On desktop:
- same visual system
- interactive hover states
- balanced 4-card row without oversized empty space
