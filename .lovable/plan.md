

# Comprehensive Pipeline Fixes: Images, Citations, Export, Humanisation, UX

This plan addresses 12 distinct issues. Each is broken down individually.

## Issues & Fixes

### 1. Image Recommendations with Multiple Versions + User Selection

**Current**: One image auto-generated per section. No user choice.

**Fix**: Update `generate-images/index.ts` to generate 2 image variants per section using different prompts (e.g. "diagram" vs "chart"). Return both to the client. Update `StageWriteHumanise.tsx` to show a selection UI — per section, display 2 thumbnail options. User clicks to select which image to keep. Only selected images are saved to `assessment_images`.

**Files**: `supabase/functions/generate-images/index.ts`, `src/components/writer/StageWriteHumanise.tsx`, `src/pages/WriterEngine.tsx`

### 2. Images Embedded Inside Work with Proper Formatting

**Current**: Images appended at the end of each section in the docx.

**Fix**: In `export-docx/index.ts`, insert images inline within section content at the position where `Figure X:` references appear. Format caption as: `Figure 1: Description (Source, Date)`. If no inline reference exists, append after section content with proper caption formatting.

**Files**: `supabase/functions/export-docx/index.ts`

### 3. Pause Pipeline Until Images Are Added

**Current**: Writing advances to next section without waiting for images.

**Fix**: In `StageWriteHumanise.tsx`, after all sections are written, block the "Next" button until user either generates and selects images OR explicitly skips. Show a gate: "Add images before proceeding or skip →".

**Files**: `src/components/writer/StageWriteHumanise.tsx`

### 4. Submission Details Included in Document

**Current**: `StageSubmissionPrep` collects fullName, studentId, institution etc. but the `handleExport` call doesn't pass them to the edge function. The title page is hardcoded.

**Fix**: Pass `submission_details` from `StageSubmissionPrep` state to `handleExport` → `export-docx` edge function. In `export-docx`, add submission details to the title page (name, student ID, institution, module, supervisor, date, company). Store submission details in WriterEngine state and pass to export.

**Files**: `src/pages/WriterEngine.tsx`, `src/components/writer/StageSubmissionPrep.tsx`, `supabase/functions/export-docx/index.ts`

### 5. Table of Contents + Heading Hierarchy

**Current**: TOC uses `headingStyleRange: "1-3"` but sub-headings within sections (## and ###) are parsed correctly. The issue is that section titles are ALL `HeadingLevel.HEADING_1` — no H2/H3 hierarchy within content parsed from markdown.

**Fix**: The `parseContentLine` function already creates H1/H2/H3 from markdown `#/##/###`. The issue is the `h3Match` doesn't use `HeadingLevel.HEADING_3` — it creates a plain paragraph with bold text. Fix this to use `HeadingLevel.HEADING_3`. Also add a `Heading3` style to the document styles with `outlineLevel: 2`.

**Files**: `supabase/functions/export-docx/index.ts`

### 6. Harvard Citation: "and" not "&"

**Current**: `extractCitations` regex accepts both `and` and `&`. The AI generates `&` in citations.

**Fix**: Add a post-processing step in `section-generate/index.ts` system prompt to explicitly state "Harvard style uses 'and' not '&' for two authors". Also add a code-based post-processor on the client in `streamSection` that replaces `&` with `and` inside citation parentheses when Harvard style is selected.

**Files**: `supabase/functions/section-generate/index.ts`, `src/pages/WriterEngine.tsx`

### 7. Justified Text + More Font Options

**Current**: All paragraphs in docx use default left alignment. Only 3 font options in submission prep.

**Fix**: In `export-docx/index.ts`, set `alignment: AlignmentType.JUSTIFIED` on all body paragraphs. Accept a `font` and `fontSize` parameter from the client. Update `StageSubmissionPrep` to offer 10 font choices: Arial 11pt, Arial 12pt, Calibri 11pt, Calibri 12pt, Times New Roman 12pt, Georgia 12pt, Garamond 12pt, Cambria 12pt, Palatino 12pt, Verdana 11pt. Pass font choice to export. Also add heading size options (H1/H2/H3 sizes).

**Files**: `supabase/functions/export-docx/index.ts`, `src/components/writer/StageSubmissionPrep.tsx`, `src/pages/WriterEngine.tsx`

### 8. More Citations (12 per 1000 words) + Intro/Conclusion Word Count

**Current**: Citation density function returns `min: 3, recommended: 6` for default sections. Introduction/conclusion have no special word count handling.

**Fix**: Update `getCitationDensity` in `section-generate/index.ts` to target 12 citations per 1000 words as the baseline. Adjust all section types proportionally. For introduction/conclusion sections, cap word_target at 100-150 words if total assessment word count is provided (add logic in `handleConfirmPlan` or execution-table to set intro/conclusion targets to 150 words max unless user overrides).

**Files**: `supabase/functions/section-generate/index.ts`, `src/pages/WriterEngine.tsx`

### 9. Humaniser Not Working (98% AI)

**Current**: Humaniser runs 4-5 AI passes but output still reads as AI. The passes may be cancelling each other out. Also, humanisation runs during writing but `streamSection` only triggers it when `settings.humanisation === "High" || "Maximum"`.

**Fix**: 
- Add a final dedicated humanise stage that runs AFTER all edits/revisions are complete but BEFORE final scan (between Edit/Proofread and Writer Slate, or as a sub-step within Writer Slate)
- The humanise function's aggressive paraphrase pass needs stronger instructions
- Add a 6th pass specifically targeting AI detection patterns: sentence-initial position words, paragraph structure uniformity, transition word overuse
- Ensure humanise runs as the LAST transformation before word count trim in Writer Slate

**Files**: `supabase/functions/humanise/index.ts`, `src/pages/WriterEngine.tsx`

### 10. Progress Indicators: Coloured Dots Instead of Toasts

**Current**: Toast notifications appear and disappear. No persistent progress indicators.

**Fix**: Add a persistent progress banner at the top of the writer content area that shows:
- Coloured pulsing dots (terracotta when working, sage when done)
- Current activity text ("Writing Section 3 of 8...", "Humanising...", "Trimming...")
- This banner persists until the task completes
- Remove toast calls for in-progress states, keep only for completions/errors

**Files**: `src/pages/WriterEngine.tsx`, create `src/components/writer/ProgressBanner.tsx`

### 11. Live Document Preview Before Download

**Current**: No preview — user downloads blindly.

**Fix**: Add a document preview panel in `StageSubmissionPrep` that renders the formatted document content with selected font, justified text, heading hierarchy, and page-like styling. User can see how it looks before downloading. This is an HTML preview, not the actual docx, but mirrors the formatting.

**Files**: `src/components/writer/StageSubmissionPrep.tsx`

### 12. Reference Count Enforcement

**Current**: Reference list in `export-docx` is generated from extracted in-text citations only.

**Fix**: In `section-generate/index.ts`, update the citation density targets: default `recommended: 12` per 1000 words. In `export-docx/index.ts`, after extracting citations, check if count meets the 12-per-1000 threshold. If short, prompt the AI to generate additional citations to fill the gap.

**Files**: `supabase/functions/section-generate/index.ts`, `supabase/functions/export-docx/index.ts`

---

## Files to Change

| File | Changes |
|------|---------|
| `supabase/functions/generate-images/index.ts` | 2 variants per section, return both |
| `src/components/writer/StageWriteHumanise.tsx` | Image selection UI with thumbnails, gate before next |
| `src/pages/WriterEngine.tsx` | Pass submission details to export, Harvard citation post-processing, progress state, re-humanise step |
| `supabase/functions/export-docx/index.ts` | Accept submission_details + font params, justified text, H3 style, inline images, caption format |
| `src/components/writer/StageSubmissionPrep.tsx` | 10 fonts, pass details up, document preview panel |
| `supabase/functions/section-generate/index.ts` | Higher citation targets (12/1000), Harvard "and" rule, intro/conclusion word caps |
| `supabase/functions/humanise/index.ts` | Stronger anti-AI passes, additional detection-targeting pass |
| `src/components/writer/ProgressBanner.tsx` | New — persistent coloured dots progress indicator |

