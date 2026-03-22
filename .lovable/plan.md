

# Fix Dashboard Mobile Layout — Compact KPI Cards

## Problem

From the screenshots, on mobile (448px viewport):
- KPI cards appear as tall vertical rectangles stacked in a single column instead of compact 2×2 grid
- The large number "2,000,000,000" forces cards to stretch
- Word budget bar and Recent Activity take too much vertical space
- Overall page requires excessive scrolling

## Plan

**`src/pages/Dashboard.tsx`**:

1. **KPI cards — compact horizontal layout on mobile**: Change each KPI card from vertical stack (label → value → sub) to a horizontal inline layout on mobile. Use `flex` with label+sub on left, value on right. Reduce padding to `p-2.5` on mobile. This makes each card ~50px tall instead of ~90px.

2. **Large number formatting**: Add compact number formatting — numbers over 999,999 show as "2B" or "2M" on mobile instead of "2,000,000,000".

3. **Word budget bar**: Reduce mobile padding to `p-2.5`, smaller text, thinner progress bar.

4. **Recent Activity**: On mobile, hide the word count columns (just show title + dot + time ago) to prevent horizontal overflow. Reduce padding.

5. **Assessment cards grid**: Keep as-is (already works at `sm:grid-cols-2`).

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Compact KPI card layout, short number formatting, tighter mobile spacing throughout |

