

# Pipeline Restructuring Plan

## Current State
6 stages: Brief → Plan → Write (with inline revise/humanise) → Self-Critique → Revision Center → Submission Prep

## New Pipeline (8 stages after Plan)

```text
0. Brief Intake          (unchanged)
1. Execution Plan        (unchanged)
2. Write & Humanise      (write all sections + auto-humanise, no inline revise)
3. Self-Critique         (quality pass, read-only report)
4. Edit & Proofread      (grammar/spelling/structure pass — new stage)
5. Revise                (user provides feedback → applies revisions → goes to stage 6)
6. Writer Slate          (full-document board view, accept/deny tracked changes, word count adjustment)
7. Final Scan            (last error check — brief compliance, banned phrases, formatting)
8. Final Submission      (fill details, export .docx)
9. Manual Submission     (re-upload exported work, paste corrections, Zoe implements)
```

Total: 10 stages (0–9), labels update in `types.ts`

## Key Changes

### A. New/Modified Stage Components

**Stage 2 — `StageWriteHumanise.tsx`** (refactored from current `StageWritingEngine.tsx`)
- Remove inline revise/regenerate buttons from completed sections
- Keep: Write All, Autopilot, section cards with progress
- Auto-humanise runs after each section write
- Progress bar with per-section status animation

**Stage 3 — `StageSelfCritique.tsx`** (simplified)
- Remove "Fix All Issues" button (that moves to Revise stage)
- Read-only quality report with checklist animation
- Footer: just forward arrow

**Stage 4 — `StageEditProofread.tsx`** (new)
- Runs grammar pipeline, spelling check, structure audit
- Checklist animation for: grammar, spelling, punctuation, sentence structure, paragraph flow
- Shows before/after diff summary

**Stage 5 — `StageRevise.tsx`** (refactored from current `StageRevisionCenter.tsx`)
- Upload feedback, paste comments, type corrections
- "Apply Revisions" → auto-advances to Writer Slate (stage 6)

**Stage 6 — `StageWriterSlate.tsx`** (new, core feature)
- Full document rendered as one continuous board (not section-by-section)
- Tracked changes highlighted (insertions in green, deletions in red strikethrough)
- Word count display with +/- from target, auto-trim/expand controls
- Accept All / Deny All / per-change accept/deny buttons
- This is where word count is cut or updated to meet exact requirement

**Stage 7 — `StageFinalScan.tsx`** (new)
- Automated final check: brief compliance, banned phrases, formatting, citation matching
- Checklist animation with pass/fail indicators
- No user input needed — just run and review

**Stage 8 — `StageSubmissionPrep.tsx`** (existing, minor update)
- Fill submission details, export .docx
- Remove "Prepare" checklist (moved to Final Scan)

**Stage 9 — `StageManualSubmission.tsx`** (new)
- Upload previously exported .docx back into the project
- Paste or type specific corrections
- Zoe applies them exactly as stated
- Re-export capability

### B. Navigation Simplification

**`StickyFooter.tsx` updates:**
- Mobile: replace text buttons with icon-only arrows (`ChevronLeft` / `ChevronRight`, 36px)
- Desktop: keep text labels but smaller
- Remove middle content slot — only back/forward
- Action buttons (Run Critique, Apply, etc.) move into stage body, not footer

**Topbar updates:**
- Remove stage pill navigation on mobile (keep sidebar only)
- Keep chevron arrows in topbar for quick nav

**Sidebar:**
- Update `stageLabels` array to match new 10-stage pipeline

### C. Progress/Loading Indicators

- Add `ChecklistAnimation` to every processing stage (Write, Critique, Edit, Scan)
- Add pulsing status bar in topbar showing current activity ("Writing Section 3 of 8...")
- Add skeleton loaders while waiting for API responses
- Each stage card shows completion percentage

### D. Zoe Chat → Auto-Navigate

In `executeChatAction` in `WriterEngine.tsx`:
- `write_all` / `write_section` → `setStage(2)`
- `run_critique` → `setStage(3)`
- `humanise_all` → `setStage(2)`
- `apply_revision` → `setStage(5)`
- `export_document` → `setStage(8)`
- Already partially done, extend to all new stages

### E. Image Generation Fix

Current issue: `generate-images` edge function only generates images when section content contains `Figure X:` references — most AI-written content won't have these.

Fix:
- Update `generate-images/index.ts` to generate images for ALL sections (or sections the user specifies) regardless of figure references
- Add a "Generate Images" button in the Write & Humanise stage
- When user prompts Zoe to add images, add `generate_images` as a tool call action
- Store generated image URLs and embed references into section content

### F. Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/writer/types.ts` | Update `stageLabels` to 10 stages |
| `src/components/writer/StageWriteHumanise.tsx` | Refactor from `StageWritingEngine.tsx` |
| `src/components/writer/StageEditProofread.tsx` | New |
| `src/components/writer/StageRevise.tsx` | Refactor from `StageRevisionCenter.tsx` |
| `src/components/writer/StageWriterSlate.tsx` | New |
| `src/components/writer/StageFinalScan.tsx` | New |
| `src/components/writer/StageManualSubmission.tsx` | New |
| `src/components/writer/StickyFooter.tsx` | Mobile arrow buttons |
| `src/components/writer/WriterSidebar.tsx` | Updated stage list |
| `src/pages/WriterEngine.tsx` | Rewire all stages, update chat actions |
| `src/components/writer/StageSubmissionPrep.tsx` | Simplify (remove checklist) |
| `src/components/writer/StageSelfCritique.tsx` | Remove fix-all button |
| `supabase/functions/generate-images/index.ts` | Remove figure-reference requirement |
| `supabase/functions/edit-proofread/index.ts` | New edge function for grammar pass |

### G. Database

No schema changes needed — existing `sections`, `assessments`, `assessment_images` tables suffice.

