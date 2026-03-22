

# Pipeline Fixes: Word Count, Linear Flow, Images, Upload Errors, Mobile Profile

## Issues Identified

1. **Humanise increases word count unchecked** — the humanise function has word count rules in prompts but no hard post-check. After humanise, word count enforcement runs but uses stale `sections` state (closure issue at line 357-358).
2. **Writer Slate trim calls `streamSection` which re-humanises** — `handleTrimToTarget` (line 573-584) calls `streamSection(s.id, true, feedback)` which triggers auto-humanise and word count enforcement loops, and can navigate backward.
3. **Writer Slate auto-advance goes to stage 4** — after accept/deny animation completes, `onNext` advances but `streamSection` inside trim may set stage elsewhere.
4. **Stage order: Edit & Proofread should be stage 5 (after Revise at stage 4)** — user wants Revise before Edit.
5. **No per-section custom trim input in Writer Slate** — user wants manual word-removal inputs per section.
6. **Final Scan goes backward** — scan reuses `handleQualityCheck` which doesn't force backward, but the onBack prop allows it.
7. **Mobile profile icon lacks settings/analytics link** — WriterSidebar bottom section has no clickable dropdown.
8. **Upload + Essay + GPT-5.2 error** — the `brief-parse` function sends `image_url` content to non-Gemini models. GPT-5.2/OpenAI models may not support the same multimodal format.
9. **Images: no proactive suggestion** — the pipeline doesn't ask users about image placement or suggest areas for figures.
10. **Self-critique word count shows 50% off** — this is because critique runs before humanise/trim has properly adjusted counts (stale state).

## Plan

### A. Fix Stage Order (Revise = 5, Edit = 6)

**`types.ts`**: Swap labels — `["Brief", "Plan", "Write", "Critique", "Revise", "Edit", "Slate", "Scan", "Submit", "Manual"]`

**`WriterEngine.tsx`**: Swap stage 4/5 rendering and handlers:
- Stage 4 → StageRevise (currently stage 5)
- Stage 5 → StageEditProofread (currently stage 4)
- Update all `setStage()` calls and `onBack`/`onNext` props accordingly
- Critique `onNext` feeds issues into revision and goes to stage 4 (Revise)
- Revise `onNext` goes to stage 5 (Edit)
- Edit `onNext` goes to stage 6 (Slate)

### B. Fix Humanise Word Count (Hard Cap)

**`humanise/index.ts`**: After all AI passes complete, add a hard word count check. If output exceeds `word_target * 1.01`, truncate at sentence boundaries to fit. This is a code-based post-process, not an AI pass — guarantees compliance.

```
// After final pass, hard-trim if over ceiling
if (finalWordCount > wordCeiling) {
  const sentences = processed.match(/[^.!?]+[.!?]+/g) || [processed];
  let trimmed = "";
  let wc = 0;
  for (const s of sentences) {
    const sWc = s.trim().split(/\s+/).filter(Boolean).length;
    if (wc + sWc > wordCeiling) break;
    trimmed += s;
    wc += sWc;
  }
  processed = trimmed.trim();
  finalWordCount = wc;
}
```

### C. Fix Word Count Enforcement Stale State

**`WriterEngine.tsx` line 356-411**: The enforcement block reads from the `sections` state closure, which is stale. Fix: read the content that was just written/humanised directly from the variables in scope (`fullContent` or the humanised content), not from `sections.find()`.

### D. Writer Slate: Trim-Only, No Humanise, No Backward Navigation

**`handleTrimToTarget`**: Replace the current implementation (which calls `streamSection` — triggering humanise) with a dedicated trim function that:
- Calls `section-revise` directly (not via `streamSection`)
- Never triggers humanise
- Never changes stage
- Only trims (never expands) — Writer Slate can only reduce words
- Distributes trim proportionally across sections based on their size

**`StageWriterSlate.tsx`**: 
- Add per-section input fields where user can specify how many words to remove
- "Auto-trim" uses these targets (or proportional if not specified)
- Remove `onBack` — Writer Slate cannot go backward
- After trim completes, auto-accept and advance to Final Scan
- If total words are within 5% above target after trim, auto-accept and move on

### E. No Stage Can Auto-Navigate Backward

**`WriterEngine.tsx`**: 
- Remove all backward `setStage()` calls from processing functions
- `handleApplyRevisions` advances to Edit (stage 5), never backward
- `handleTrimToTarget` stays on Slate (stage 6), never changes stage
- Final Scan just scans and shows results — no auto-fix, no backward navigation
- User can manually go back via sidebar/topbar but no stage auto-reverts

### F. Revise Auto-Advances to Writer Slate After Applying

When revisions finish applying, immediately switch to Writer Slate (stage 6) so user sees corrections being made live. The `handleApplyRevisions` already does `setStage(6)` — keep this but ensure it goes to stage 6 (Slate) not Edit.

Wait — with the new order, Revise is stage 4 and should advance to Edit (stage 5). But user says "immediately revise starts applying correction, interface should shift to writerslate." This means skip Edit and go straight to Slate.

**Resolution**: Revise → Writer Slate (skip Edit for auto-applied critique corrections). Edit & Proofread happens before Revise in the pipeline? No — user explicitly said Edit should be stage 6, Revise stage 5.

Re-reading user's request: "Edit and proofread should be stage 6, Revise should be stage 5." So the order is:
```
0-Brief, 1-Plan, 2-Write, 3-Critique, 4-Revise, 5-Edit, 6-Slate, 7-Scan, 8-Submit, 9-Manual
```

And "immediately revise starts applying correction, interface should shift to writerslate" — so Revise (4) applies corrections and jumps to Slate (6), skipping Edit (5)? Or goes to Edit (5) first?

User says: "Once auto trim is clicked in writerslate, it must begin trimming and never revert to stage 4 self critique or stage 3 writing." The key constraint is: never go backward. Revise can advance to Edit or Slate.

I'll keep it linear: Revise (4) → Edit (5) → Slate (6). But when revisions are auto-applied from critique, the UI shows progress. The actual correction text appears in Writer Slate.

### G. Fix Upload Error with Non-Gemini Models

**`brief-parse/index.ts`**: The function sends `image_url` content blocks to all models. OpenAI models on the Lovable gateway may not support `image_url` the same way. Fix: for file uploads, always use a Gemini model for the brief-parse step regardless of user's selected model (since brief parsing is a one-time extraction task). Fall back to `google/gemini-2.5-flash` for vision tasks.

### H. Mobile Profile Menu

**`WriterSidebar.tsx`**: Make the user section at the bottom clickable — add a dropdown/expandable panel with:
- Settings link
- Analytics link (`/analytics`)
- Sign out button

### I. Image Suggestions

**`StageWriteHumanise.tsx`**: After all sections are written, show an "Image Suggestions" panel that:
- Lists sections with recommended figure types (chart, diagram, table, etc.)
- User can check/uncheck which sections get images
- "Generate Selected Images" button triggers generation for chosen sections
- This replaces the current "Generate Images" button with a smarter UI

### J. Fix Self-Critique Word Count Display

The word count shown in critique (line 85) reads `totalWords` which comes from `sections.reduce()`. This should be accurate if sections state is up-to-date. The issue is likely that critique runs before word count enforcement finishes. Fix: ensure `totalWords` is recalculated from latest DB state before critique displays it.

### Files to Change

| File | Change |
|------|--------|
| `src/components/writer/types.ts` | Swap stage labels for positions 4 and 5 |
| `src/pages/WriterEngine.tsx` | Swap stage 4/5 rendering; fix stale state in word count enforcement; dedicated trim function; prevent backward auto-navigation; recalculate word counts before critique |
| `supabase/functions/humanise/index.ts` | Add hard word count cap (sentence-boundary trim) |
| `src/components/writer/StageWriterSlate.tsx` | Add per-section word-removal inputs; remove backward navigation; auto-accept when within 5% |
| `supabase/functions/brief-parse/index.ts` | Force Gemini model for vision/file tasks |
| `src/components/writer/WriterSidebar.tsx` | Add profile dropdown with Settings, Analytics, Sign Out |
| `src/components/writer/StageWriteHumanise.tsx` | Add image suggestion panel after writing completes |
| `src/components/writer/StageSelfCritique.tsx` | Update stage label number |
| `src/components/writer/StageEditProofread.tsx` | Update stage label number |
| `src/components/writer/StageRevise.tsx` | Update stage label number |
| `src/components/writer/StageFinalScan.tsx` | Remove backward navigation capability |

