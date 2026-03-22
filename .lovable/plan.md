

# Add Average Completion % to Dashboard KPI Strip

## Current State

The KPI strip (lines 172-195) already shows:
- Words Left
- Assessments (with completed count as subtitle)
- Words Written
- Active count

This already covers "total assessments" and "completed count." The missing metric is **average completion percentage**.

## Plan

**`src/pages/Dashboard.tsx`**: 
- Add `avgCompletion` calculation: average of `(word_current / word_target * 100)` across all assessments
- Replace the "Words Written" KPI card with "Avg. Completion" showing the percentage
- Move "Words Written" to the subtitle of another card or keep as a 5th card on larger screens

Alternatively, keep all 4 existing cards and swap "Active" (which is redundant with the subtitle on "Assessments") for "Avg. Completion":

| Slot | Label | Value | Sub |
|------|-------|-------|-----|
| 1 | Words Left | wordsLeft | of wordLimit |
| 2 | Assessments | total | completedCount complete |
| 3 | Words Written | total | total |
| 4 | Avg. Completion | X% | across all |

Simply add the `avgCompletion` computation and replace the 4th KPI card ("Active") with "Avg. Completion" — since active count is already shown in the welcome text.

### File

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Compute `avgCompletion`, replace "Active" KPI with "Avg. Completion" percentage |

