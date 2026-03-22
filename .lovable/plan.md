

# Fix Linear Flow, Writer Slate Layout, Word Count Enforcement

## Problems Found

1. **Self-Critique `onBack` goes to stage 2 (Write)** — line 1093: `onBack={() => setStage(2)}`
2. **Revise `onBack` goes to stage 3 (Critique)** — line 1109: `onBack={() => setStage(3)}`
3. **Revise calls `streamSection` internally** which triggers auto-humanise, word count loops — these can cause unexpected behavior
4. **Writer Slate is section-by-section accordion cards** — user wants one continuous document
5. **Edit & Proofread shows corrected preview but no diff highlighting** (no red/green)
6. **`section-generate` has no hard word count cap** — only prompt-based ±1%, no code-based enforcement like humanise has
7. **`section-revise` also has no hard cap** — same issue

## Plan

### A. Remove All Backward Navigation from Stages 3+

In `WriterEngine.tsx`, change `onBack` props for stages 3–9 to be no-ops or remove the left button entirely:

- **Stage 3 (Critique)**: Remove `onBack` — no going back to Write
- **Stage 4 (Revise)**: Remove `onBack` — no going back to Critique  
- **Stage 5 (Edit)**: Remove `onBack` — no going back to Revise
- **Stage 6 (Slate)**: Already has `onLeft={() => {}}` — keep
- **Stage 7 (Scan)**: Remove `onBack` — no going back to Slate
- **Stage 8 (Submit)**: Remove `onBack`
- **Stage 9 (Manual)**: Remove `onBack`

Each stage component's `StickyFooter` will be updated to not show a left button when `onBack` is undefined/not provided.

### B. Writer Slate — Single Full Document View

Replace the accordion card layout with a single continuous document:
- Render all sections' content as one scrollable document with section titles as headings
- Word count summary bar at top (unchanged)
- Accept All / Deny All buttons at top (unchanged)
- Per-section trim inputs shown inline above each section heading
- Highlighted changes: if `priorSections` exist, show word count deltas next to section titles
- No expand/collapse — everything visible at once

### C. Edit & Proofread — Diff Highlighting

When showing the corrected preview, add basic word-level diff highlighting:
- Split original and corrected into words
- Highlight added words in green, removed words in red strikethrough
- Show this in the preview panel for each section diff

### D. Hard Word Count Cap in `section-generate` and `section-revise`

Both edge functions currently stream responses. Add post-stream processing on the client side in `WriterEngine.tsx`:

After `streamSection` finishes reading the stream and before saving to DB, add sentence-boundary truncation if word count exceeds `section.word_target * 1.01`. This is the same logic used in `humanise/index.ts` but applied on the client after streaming completes.

This enforces the 1% cap for ALL models regardless of whether they follow the prompt instruction.

### E. Files to Change

| File | Change |
|------|--------|
| `src/pages/WriterEngine.tsx` | Remove backward `onBack` for stages 3–9; add post-stream word count truncation in `streamSection` |
| `src/components/writer/StageWriterSlate.tsx` | Replace accordion with single continuous document view |
| `src/components/writer/StageEditProofread.tsx` | Add word-level diff highlighting |
| `src/components/writer/StageSelfCritique.tsx` | Remove `onBack` prop usage (no left button) |
| `src/components/writer/StageRevise.tsx` | Remove `onBack` prop usage |
| `src/components/writer/StageFinalScan.tsx` | Remove `onBack` prop usage |
| `src/components/writer/StickyFooter.tsx` | Handle missing `onLeft`/`leftLabel` gracefully (already does) |

