

# Pipeline Verification Report

## Word Count Enforcement — Verified ✓

Three layers of enforcement are in place:

1. **Post-stream truncation** (`WriterEngine.tsx` line 341-357): After streaming content from `section-generate` or `section-revise`, if word count exceeds `word_target * 1.01`, it truncates at sentence boundaries before saving.

2. **Humanise hard cap** (`humanise/index.ts` line 237-244): After all AI passes, a final hard `wordCeiling = Math.ceil(word_target * 1.01)` truncation runs at sentence boundaries. The `capAfterPass` function also runs after every individual AI pass to prevent drift.

3. **Post-humanise enforcement** (`WriterEngine.tsx` line 385-455): After humanisation, reads fresh content from DB and re-checks against `word_target * 1.01`. If still over, triggers a trim via `section-revise`.

The fix from the last edit (`content: finalContent` instead of `content: fullContent` on line 375) ensures the humanise function receives already-truncated content.

## Linear Flow — Verified ✓

- **Stages 3–9**: No `onBack` props passed. Components (`StageSelfCritique`, `StageRevise`, `StageEditProofread`, `StageFinalScan`, `StageSubmissionPrep`, `StageManualSubmission`) only have `onNext`.
- **`handleTrimToTarget`**: Does not call `setStage()` — stays on stage 6.
- **`handleApplyRevisions`**: Calls `setStage(5)` — forward only (Revise→Edit).
- **`handleAcceptAll` / `handleDenyAll`**: No `setStage()` calls — stays on stage 6, user manually advances via `onNext`.
- **Autopilot**: Moves forward sequentially (2→3→5→8).
- **Chat actions**: All `setStage()` calls go to appropriate stages, none go backward relative to the current stage.

## No Code Changes Needed

The pipeline is correctly configured. To verify in practice:
1. Create a new assessment with a brief
2. Write all sections — check word counts after each section completes (should be within 1% of target)
3. Advance through Critique → Revise → Edit → Slate → Scan → Submit
4. Confirm no stage auto-navigates backward at any point
5. In Writer Slate, use auto-trim and confirm it stays on stage 6

This is a manual testing task — the code enforcement is solid at all three levels.

