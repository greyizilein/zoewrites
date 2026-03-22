# Fix Dashboard KPI Cards — Final Cleanup

## What the MHT shows is wrong

The uploaded MHT reveals the dashboard rendering on a 448px mobile viewport. The issues:

1. **"2B" and "of 2B"** — The "Words Left" card shows "2B" because the unlimited tier has a 2-billion word limit. This is meaningless to the user. For unlimited tiers, this card should show "∞" or "Unlimited" instead of a giant formatted number.
2. **Word Budget bar shows "0 / 2B"** — Same problem. For unlimited tiers, hide the budget bar entirely or show "Unlimited" instead of a nonsensical progress bar stuck at 0%.
3. **Cards are correctly sized at `h-[88px]**` in a 2×2 grid — this matches the approved plan. The layout structure is actually working. The visual "nonsense" is the **data display**, not the card sizing.

## Plan

### `src/pages/Dashboard.tsx`

1. **Handle unlimited tier in KPI cards**: When `wordLimit >= 1_000_000_000` (effectively unlimited):
  - "Words Left" card → show "∞" as value, "unlimited" as subtitle
  - Hide or simplify the Word Budget progress bar — show "Unlimited Plan" with no progress bar
2. **Keep card sizing as-is** — `h-[88px] sm:h-[100px]` with the 2×2 grid is correct per the approved plan


| File                      | Change                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/pages/Dashboard.tsx` | Handle unlimited tier display in KPI cards and word budget bar — show "∞" / "Unlimited" instead of "2B" |
