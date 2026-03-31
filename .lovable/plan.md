# Adapt Writer Engine UI + Fix Whole-Document Writing

## Scope

Two distinct problems:

### Problem 1: Writing outputs references per section

The `document-generate` edge function explicitly instructs the AI to produce `## References` after each section (line 260-271 of document-generate/index.ts). The `section-generate` function does the same. The client-side loop in WriterEngine.tsx (line 380-445) calls `section-generate` per section, each producing its own references block. 

**Fix**: Change both edge functions to instruct the AI to write all body content first, then ONE combined reference list at the end. Update the client-side `handleWriteDocument` to use `document-generate` (whole-document) instead of the section-by-section loop, and update `document-generate` prompts to produce a single reference list.

### Problem 2: Adopt new Writer Engine interface + updated pipeline rules

The uploaded files describe a 6-stage pipeline interface with extensive settings (source type mix, burstiness slider, tone chips, per-section personalisation, visual insert panel, revision center with voice input, diff viewer, and final submission). The current WriterEngine has a simpler 4-stage flow. The uploaded `ZOE_Pipeline_Rules.txt` and `ZOE_Rulebook_v1.html` contain updated quality rules that should replace the current system prompts.

---

## Implementation Plan

### Phase 1: Fix References (Priority — addresses your core complaint)


| File                                            | Change                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/document-generate/index.ts` | Remove per-section `## References` instruction. Replace with: "Write all sections continuously. After the final section, produce ONE `## References` block containing every source cited across the entire document, alphabetically. The reference list is excluded from the word count." |
| `supabase/functions/section-generate/index.ts`  | Same fix for single-section calls: "Do NOT include a References block. References are handled separately at the document level."                                                                                                                                                          |
| `src/pages/WriterEngine.tsx`                    | Switch `handleWriteDocument` to call `document-generate` (whole-document endpoint) instead of looping `section-generate`. Parse the single response to split content back into sections for DB storage. Keep section-generate available for individual rewrites.                          |
| `src/lib/wordCount.ts`                          | Already strips `## References` from word counts — no change needed.                                                                                                                                                                                                                       |


### Phase 2: Update Pipeline Rules in Edge Functions


| File                                            | Change                                                                                                                                                                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/_shared/zoe-brain.ts`       | Update with rules from uploaded `ZOE_Pipeline_Rules.txt`: Five-Layer Justification Standard, paragraph self-check, banned phrase blacklist, synthesis standard, depth protocol, evidence hierarchy. These replace the current system prompt content. |
| `supabase/functions/document-generate/index.ts` | Incorporate updated writing rules, humanisation rules, and quality criteria from the uploaded files into the system prompt.                                                                                                                          |
| `supabase/functions/section-generate/index.ts`  | Same rule updates for single-section generation.                                                                                                                                                                                                     |
| `supabase/functions/edit-proofread/index.ts`    | Update editing rules to match new pipeline standards.                                                                                                                                                                                                |
| `supabase/functions/humanise/index.ts`          | Update humanisation prompt with the expanded rules from uploaded files (burstiness, AI fingerprint removal, transitions, vocabulary, paragraph logic, perplexity).                                                                                   |
| `supabase/functions/quality-pass/index.ts`      | Update critique criteria to match new Five-Layer Justification and C-07 checklist.                                                                                                                                                                   |


### Phase 3: Adapt Writer Engine UI

The uploaded HTML shows a 6-stage interface. The current app has a 4-stage flow (Brief → Write → Review → Export). The new flow from the uploaded design:

1. **Brief Intake** — assessment type chips, word count chips, citation style chips, level chips, brief input tabs (Type/Paste, Upload, URL, Manual), citation settings panel, writing settings (tone, humanisation, burstiness slider, source type mix sliders, seminal toggle)
2. **Execution Table** — section plan cards (expandable), role & context editor, per-section settings (word count, citations, frameworks, visuals, A+ criteria, writing notes), model selector, writing voice settings, options toggles
3. **Writing Engine** — section nav sidebar, main content area, personalise drawer, visual insert panel (chart/framework/table/image/analyse), recommendations panel, action bar (humanise, cite, expand, condense)
4. **Export** — current Stage 4 review/export remains similar
5. **Revisions** — paste/upload/voice/manual feedback, change list with accept/reject, diff viewer with highlighted changes
6. **Final Submission** — submission details form, doc preview, final checklist, grade badge

Changes to implement:


| File                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/writer/types.ts`                      | Add new assessment types from uploaded file (Business Report, Case Study, Reflective Account, Financial Analysis, Research Proposal, Lab Report, Systematic Review, Legal Problem, Discussion Post, Coding Assignment, EBP Assessment). Add tone options (Analytical, Critical, Evaluative, Discursive, Argumentative, Reflective). Add burstiness, source type mix percentages, auto-complete toggle, citation disclaimer toggle, and other settings from the interface. |
| `src/components/writer/StageBriefIntake.tsx`          | Redesign to match uploaded interface: chip-based selectors for type/word count/citation/level, 4-tab brief input (Type/Paste, Upload, URL, Manual), right-side citation settings panel with per-section count, source date range sliders, source type mix sliders, seminal/auto-balance/disclaimer toggles. Writing settings card with tone chips and burstiness slider. Mobile: stack panels vertically.                                                                 |
| `src/components/writer/StageExecutionTable.tsx`       | Add expandable section plan cards showing word count, citations, frameworks, visuals, A+ criteria, writing notes per section. Add overview bar. Right sidebar: model selector, writing voice settings, options toggles. Mobile: full-width stacked cards.                                                                                                                                                                                                                 |
| `src/components/writer/StageWrite.tsx`                | Complete rewrite to match uploaded Stage 3: section nav sidebar (left), main content area (centre) with personalise drawer and visual insert panel, recommendations panel (right). Progress bar, word count badges, action bar (humanise, cite tools). Mobile: hide sidebars, show content only with bottom action bar.                                                                                                                                                   |
| `src/components/writer/StageReview.tsx`               | Split into separate Edit/Proofread stage (pass buttons: Proofread, Citations, Humanise, Run All) with pass log sidebar, and Critique & Correct stage.                                                                                                                                                                                                                                                                                                                     |
| New: `src/components/writer/StageRevisionCenter.tsx`  | New revision center: 4 input tabs (Paste, Upload, Voice, Manual), change list with accept/reject, diff viewer with amber/blue highlighting. Voice input using Web Speech API.                                                                                                                                                                                                                                                                                             |
| New: `src/components/writer/StageFinalSubmission.tsx` | Submission details form (name, student ID, programme, institution, module), formatting options, document preview, final checklist with auto-checks, grade badge, download button.                                                                                                                                                                                                                                                                                         |
| `src/pages/WriterEngine.tsx`                          | Update stage count from 4 to 6. Wire new stages. Update navigation logic.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/components/writer/WriterSidebar.tsx`             | Update stage labels to match 6-stage flow.                                                                                                                                                                                                                                                                                                                                                                                                                                |


### Phase 4: Mobile Responsiveness

All new components must work on the user's 448px viewport:

- Brief Intake: stack settings below brief input, collapse right panel into accordion
- Execution Table: full-width cards, hide right sidebar behind toggle
- Writing: hide section nav and recommendations behind slide-out drawers
- Revision Center: stack panels vertically, change list below input
- Final Submission: single-column form

### Assessment Type Additions

From the uploaded interface, add these types not in the current `types.ts`:

- Business Report, Case Study, Reflective Account, Financial Analysis, Research Proposal, Lab Report, Systematic Review, Legal Problem (IRAC), Discussion Post, Coding Assignment, EBP Assessment, MBA Assignment, Policy Report, Consultancy Report

### Settings Additions

New settings from the uploaded interface to add to `WriterSettings`:

- `burstiness: number` (1-5 slider)
- `journalPct, bookPct, reportPct, confPct: number` (source type mix)
- `autoBalance: boolean` (auto citation balancing)
- `disclaimer: boolean` (citation disclaimer in docx)
- `autoComplete: boolean` (write all sections without pausing)
- `codeEngine: boolean`
- `aiPatternScore: boolean`
- `unlimitedImages: boolean`
- `versionHistory: boolean`

---

## Execution Order

1. Fix references (Phase 1) — immediate impact, addresses core complaint
2. Update pipeline rules (Phase 2) — improves quality
3. Adapt UI (Phase 3) — largest change, iterative
4. Mobile polish (Phase 4) — throughout Phase 3

This is a large set of changes. Shall I proceed with Phase 1 first (fixing references to appear only at the end), or tackle everything together?

All at once.