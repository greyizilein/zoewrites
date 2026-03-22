

# Fix Pipeline Flow: Auto-Feed Issues, Working Stages, Download Button

## Problems

1. **Self-Critique issues don't auto-feed into Revise** — critique report has issues but `revisionFeedback` is never populated from them. Stage 5 gets empty `initialFeedback`.
2. **Edit & Proofread** — the edge function returns one blob of `corrected_content`, but parsing splits on `## ` which may fail if the AI doesn't preserve exact headings. Need more robust matching.
3. **Writer Slate "Accept All"** — calls `handleAcceptAll` which just shows a toast. No visual confirmation of changes being applied, no processing animation, stays on the same page correctly but feels dead.
4. **Writer Slate navigates away** — the `onBack` goes to Revise (stage 5) but there's no bug here; user may be confused because Accept All has no visual feedback.
5. **Final Submission (Stage 8)** — download buttons only show after clicking "Prepare →" and waiting for checklist. The `Prepare →` button is in the StickyFooter's right slot, which is confusing. Download should be more accessible.

## Plan

### A. Auto-feed critique issues → Revise stage

**`WriterEngine.tsx`**: After `handleQualityCheck` runs (or when advancing from critique to edit to revise), compile the quality report issues into a feedback string and set `revisionFeedback`.

When `onNext` from Self-Critique (stage 3→4) fires, build revision feedback from `qualityReport`:
```
const issues = qualityReport?.report?.issues || [];
const feedback = issues.map(i => `[${i.severity}] ${i.description} → ${i.suggestion}`).join("\n");
setRevisionFeedback(feedback);
```

Also auto-apply: when user reaches Stage 5 with `initialFeedback` populated, auto-trigger `onApplyRevisions` immediately (with a loading state).

**`StageRevise.tsx`**: Add auto-apply behavior — if `initialFeedback` is provided and non-empty, automatically call `onApplyRevisions(initialFeedback)` on mount (once).

### B. Edit & Proofread robustness

The current `edit-proofread` edge function sends ALL content as one string and gets back one corrected blob. The section-splitting logic is fragile.

**Fix**: Change `handleEditProofread` to call the edge function **per section** instead of all at once. This gives clean per-section diffs without parsing.

### C. Writer Slate — visual feedback on Accept/Deny

**`StageWriterSlate.tsx`**: 
- When "Accept All" is clicked, show a brief processing animation (ChecklistAnimation with items like "Applying changes…", "Updating word counts…", "Confirming…")
- After animation, show a success banner and auto-advance to next stage after 1.5s
- When "Deny All" is clicked, show revert animation similarly

**`WriterEngine.tsx`**:
- `handleAcceptAll` should update assessment word count in DB and set a confirmed state
- `handleDenyAll` already reverts — just needs to work with the visual flow

### D. Final Submission — always show download

**`StageSubmissionPrep.tsx`**: 
- Show the download button immediately (not gated behind `done` state)
- Keep the "Prepare" checklist as optional/automatic
- Auto-run the preparation checklist on mount
- Show download buttons prominently at the top

### E. Files to Change

| File | Change |
|------|--------|
| `src/pages/WriterEngine.tsx` | Auto-populate `revisionFeedback` from critique issues; per-section edit calls; improve `handleAcceptAll` |
| `src/components/writer/StageRevise.tsx` | Auto-apply revisions on mount when `initialFeedback` is provided |
| `src/components/writer/StageWriterSlate.tsx` | Add processing animation on accept/deny, auto-advance after confirmation |
| `src/components/writer/StageSubmissionPrep.tsx` | Show download buttons immediately, auto-run prep checklist |
| `src/components/writer/StageEditProofread.tsx` | Minor — ensure diffs display correctly with per-section approach |
| `src/components/writer/StageSelfCritique.tsx` | Auto-advance to next stage after critique completes |

