

# Fix Accept/Deny Changes + Word Count Enforcement

## Problems Identified

1. **Edit & Proofread (Stage 4)**: Auto-applies corrections silently — no accept/deny UI. User can't review what changed.
2. **Writer Slate (Stage 6)**: Has Accept/Deny buttons but `handleAcceptAll` and `handleDenyAll` are no-ops (just show toasts). No actual tracked changes data or per-section accept/deny.
3. **Revise (Stage 5)**: Applies revisions directly with no review step — changes go straight into sections.
4. **Word count 1% constraint**: The `section-generate` and `section-revise` edge functions set `±1%` in prompts, but there's no enforcement after the AI returns. The humanise function can also change word counts. No post-processing trim/expand happens automatically.

## Plan

### A. Edit & Proofread — Add Accept/Deny per Section

**`StageEditProofread.tsx`**: After the edit pass runs, show a per-section diff view with:
- Original content (red strikethrough) vs corrected content (green)
- Per-section Accept / Deny buttons
- "Accept All" / "Deny All" at the top
- Only accepted changes get written to the sections table

**`WriterEngine.tsx`**: Change `handleEditProofread` to store both original and corrected content in state (new `editDiffs` state) instead of auto-applying. Add `handleAcceptEdits(sectionIds)` and `handleDenyEdits(sectionIds)` functions that apply or revert.

### B. Writer Slate — Real Tracked Changes

**`StageWriterSlate.tsx`**: 
- Add props for `previousSections` (snapshot before revisions) alongside current `sections`
- Compute per-section word diffs (added/removed words)
- Per-section Accept (keep current) / Deny (revert to previous) buttons
- "Accept All" applies all current content; "Deny All" reverts all to previous snapshots

**`WriterEngine.tsx`**: 
- Add `priorSections` state — snapshot sections before Stage 5 revisions
- Before `handleApplyRevisions` runs, save current sections to `priorSections`
- `handleAcceptAll` = keep current sections as-is (no-op on data, just confirm)
- `handleDenyAll` = restore `priorSections` content back to sections + DB

### C. Word Count Enforcement

**`WriterEngine.tsx`** — add `enforceWordCount` function:
- After any write/revise/humanise completes, check if section word count exceeds `word_target * 1.01`
- If over, call `section-revise` with trimming feedback automatically
- If under `word_target * 0.99`, call `section-revise` with expansion feedback
- Run this as a post-step in `streamSection` after humanisation

**Writer Slate auto-trim**: 
- When entering Stage 6, if `totalWords` differs from `totalTarget` by more than 1%, auto-show the trim/expand button prominently with a warning banner
- The existing `handleTrimToTarget` already works but needs to be smarter — distribute the trim/expand proportionally across sections based on their size

### D. Files to Change

| File | Change |
|------|--------|
| `src/components/writer/StageEditProofread.tsx` | Add accept/deny per-section diff UI |
| `src/components/writer/StageWriterSlate.tsx` | Add per-section accept/deny with previous content comparison |
| `src/pages/WriterEngine.tsx` | Add `editDiffs` + `priorSections` state, real accept/deny handlers, word count enforcement in `streamSection` |

### Technical Detail

**Edit diffs state shape:**
```typescript
interface EditDiff {
  sectionId: string;
  sectionTitle: string;
  original: string;
  corrected: string;
  accepted: boolean | null; // null = pending
}
```

**Word count enforcement** runs after each section write in `streamSection`:
```typescript
// After humanise step
const finalWc = content.split(/\s+/).filter(Boolean).length;
const floor = section.word_target;
const ceiling = Math.ceil(section.word_target * 1.01);
if (finalWc < floor || finalWc > ceiling) {
  // Auto-trim/expand via section-revise
}
```

