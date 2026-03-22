

# Fix Word Count Leaks in Writing Pipeline

## Bug Found

**Line 364 in `WriterEngine.tsx`**: The humanise call passes `fullContent` (raw streamed content before truncation) instead of `finalContent` (already truncated to 1% ceiling). This means the humanise function receives over-limit content and can produce over-limit output, negating the post-stream truncation.

The humanise function does have its own hard cap (lines 186-201 in `humanise/index.ts`), but it uses `wordCeiling = Math.ceil(word_target * 1.01)` which should work — unless the word count correction pass (lines 168-183) runs an AI expansion that overshoots again after the hard cap check. Looking at the code flow: the hard cap runs AFTER the correction pass, so it should catch it. 

The real issue is the `fullContent` vs `finalContent` variable — sending untrimmed content to humanise gives the AI more material to work with, and the multi-pass humanise process (4-5 AI passes) can drift word count significantly between passes before the final hard cap catches it. With a much larger input, the AI is more likely to produce output that, even after sentence-boundary truncation, loses important content.

## Fix

**Single change in `WriterEngine.tsx` line 364**: Replace `fullContent` with `finalContent` so the humanise function receives already-truncated content.

| File | Change |
|------|--------|
| `src/pages/WriterEngine.tsx` | Line 364: change `content: fullContent` → `content: finalContent` |

This is a one-line fix. The rest of the enforcement chain (humanise hard cap + post-humanise DB check + section-revise trim) is already correct and will serve as safety nets.

