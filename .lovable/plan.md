
# Dashboard Mobile Refactor — True Square Tiles, No Stretching

## Root cause in current code

The KPI cards are still rectangular because the mobile grid is `grid-cols-2` across the full content width, while each card only has a fixed height (`h-[88px]`). At a 448px viewport, each card becomes much wider than it is tall, so they can never look like the compact reference.

Also, the dashboard still contains other full-width rectangular blocks (`Word Budget`, `Recent Activity`, assessment cards), so even after KPI tweaks the mobile screen still feels like stretched panels instead of a compact card dashboard.

## Plan

### 1. Rebuild the mobile KPI area as true fixed-size square tiles
In `src/pages/Dashboard.tsx`:

- Stop letting KPI cards stretch to the full grid cell width
- Wrap the KPI section in a centered mobile container with a fixed max width
- Make every KPI tile use the same locked dimensions on mobile (square or near-square), e.g. fixed width + fixed height, or `aspect-square` with a max width
- Keep 2 columns on mobile, 4 columns on desktop
- Use one shared tile class so all cards are identical

This fixes the actual bug instead of only shrinking text.

### 2. Match the screenshot style more closely
For each mobile tile:

- rounded corners
- denser vertical spacing
- centered label, value, subtitle
- no overflowing text
- compact number formatting everywhere
- stronger visual contrast and cleaner spacing so the tiles read like deliberate dashboard blocks, not stretched containers

### 3. Remove mobile stretching from the rest of the dashboard
Still in `src/pages/Dashboard.tsx`:

- Convert `Word Budget` into a compact summary tile/card on mobile instead of a long horizontal bar block
- Convert `Recent Activity` into a compact card with tighter rows and less horizontal metadata on mobile
- Reduce padding and margins around these sections so they feel like part of one compact dashboard system
- If needed, stack these under the KPI tiles as compact cards rather than full-width panels

### 4. Make mobile profile interaction actually do something useful
The profile avatar currently only opens a menu with a dead Settings item.

Plan:
- make the profile menu fully actionable on mobile
- either wire Settings to a real destination/modal or remove that dead action from mobile until it exists
- keep Analytics and Sign Out working

### 5. Preserve desktop quality
Desktop should keep the same content, but:
- maintain balanced 4-up KPI layout
- keep hover/tap interactions
- avoid oversized empty space
- keep Recent Activity readable without harming desktop density

## Files to change

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Replace stretch-based mobile layout with true fixed-size square KPI tiles and compact mobile dashboard cards; fix dead mobile profile action |

## Expected result

On mobile:
- KPI cards are truly square and identical in size
- no horizontal stretching
- no ugly long rectangles in the top dashboard area
- dashboard feels compact like the attached reference
- no scrolling caused by oversized cards

On desktop:
- same data remains available
- layout stays balanced and interactive
- no regression to the current dashboard flow
