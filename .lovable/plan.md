

## Got it — this becomes ZOE's "Architect" prompt

Your `Superior_Prompt.docx` is not the writing prompt — it's the **structuring prompt**. ZOE uses it to transform any brief into a meticulous, table-based execution blueprint *before* a single word of the actual work is written. This guarantees nothing is overlooked (separate tables vs merged tables, exact figure counts, per-section word splits, citation density, appendices, etc.).

## How this slots into the rebuild

Two-phase ZOE for any writing task:

```text
Brief in chat
   ↓
[Phase 1: ARCHITECT]  ← uses your Superior_Prompt verbatim
   ↓ produces ONE detailed execution table
   ↓
[Phase 2: WRITER]     ← writes section-by-section against that table
   ↓ pauses after each section, waits for "next"
   ↓
Final assembly + downloads (.docx / .pdf / .txt)
```

Phase 1 is where ZOE becomes ruthless about detail.

## What I'll build

### 1. Store the Architect Prompt in the library
Create `supabase/functions/_shared/zoe-prompts.ts` with `SUPERIOR_STRUCTURE_PROMPT` containing your full document text exactly as written. Single source of truth — easy to update later.

### 2. New tool: `architect_work`
ZOE auto-calls this when a user asks for any structured deliverable (essay, report, dissertation, case study, business plan, etc.).
- Input: the brief, any uploaded files, target word count, citation count, level
- Process: runs the Superior Prompt against a high-reasoning model (`gpt-5` or `gemini-2.5-pro` with `reasoning.effort: "high"`)
- Output: ONE markdown execution table — Role / Context / Execution Command paragraphs above, then the table from Introduction → Conclusion/Appendices, then the reference-list instruction below
- Self-critique loop: before returning, ZOE re-checks the table against the Superior Prompt's full checklist (separate tables not merged, exact figure counts, LO descriptions not codes, 1% word ceiling, intro/conclusion ~100 words, citation style, appendices steps). If anything is missing, it rewrites from scratch — up to 2 retries — until the table is A+.

### 3. New tool: `write_section`
After the table exists, ZOE writes one section at a time and pauses with: *"Section complete. Reply 'next' to continue, or give feedback."* Each section is written strictly against its row in the table.

### 4. UI in chat
- The execution table renders as a proper markdown table inside the AMOLED chat (already supported by react-markdown + GFM)
- A "Begin writing" button appears under the table
- Section outputs appear as separate assistant messages with their own download/copy actions
- On finish, an "Assemble & download" button stitches all sections + reference list into one `.docx` / `.pdf`

### 5. System prompt update
ZOE's main system prompt gets a new directive: *"For any deliverable longer than a chat reply, you MUST run `architect_work` first. Never write the work and the structure in the same response. Show the table, wait for approval, then write section by section."*

## Files

| File | Action |
|---|---|
| `supabase/functions/_shared/zoe-prompts.ts` | NEW — stores `SUPERIOR_STRUCTURE_PROMPT` verbatim |
| `supabase/functions/zoe-chat/index.ts` | Add `architect_work` + `write_section` tools; add self-critique retry loop; update system prompt |
| `src/components/chat/ZoeChat.tsx` | Render execution-table messages with "Begin writing" CTA; render section messages with per-section download |
| `src/lib/exportDocs.ts` | (already in rebuild plan) — add "assemble all sections" helper |

## Critical guarantees baked in

- **Separate tables stay separate** — the architect output explicitly enumerates each required table by name and purpose
- **Figure/table counts honoured exactly** — checklist verifies before returning
- **Word counts split per section** with the 1% ceiling and ~100-word intro/conclusion rule encoded
- **LOs written out in full**, not as "LO1/LO2"
- **Numerals for all figures, "%" for percentages** — encoded as a non-negotiable
- **Appendices get their own step-by-step rows** when relevant
- **Reference list excluded from word count**, listed below the table

This will be folded into the rebuild — Architect Phase becomes the foundation everything else writes against.

