

# Dashboard KPI Cards — Square Interactive Cards (Like Screenshot)

## Problem

KPI cards are flat horizontal rectangles on mobile. The user wants compact **square-ish cards** like the screenshot reference — with the label on top, value prominent in the center, and subtitle below. Each card should feel interactive (hover/tap effects).

## Plan

**`src/pages/Dashboard.tsx`** — KPI card layout:

1. **Card shape**: Change mobile layout from horizontal `flex items-center justify-between` to vertical centered layout. Use `aspect-square` on mobile to force square cards. Padding `p-3`. Content stacked vertically and centered.

2. **Structure per card**:
   - Top: small uppercase label (muted)
   - Center: large bold value (coloured)
   - Bottom: subtitle text (muted, small)

3. **Interactive feel**: Add `hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer hover:shadow-md hover:border-foreground/10` for tap/hover feedback on both mobile and desktop.

4. **Grid**: Keep `grid-cols-2 sm:grid-cols-4` with `gap-2 sm:gap-3` — 2x2 on mobile, 4 across on desktop.

5. **Desktop**: Same centered vertical layout but larger text, no aspect-square constraint.

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Restyle KPI cards to square, vertically centered, interactive with hover/tap effects |

