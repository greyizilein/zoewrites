

## Recap of what's still outstanding from the spec

From `ZOE_SPEC-2.docx`, only the Architect prompt has been wired so far. Still owed:

1. Full-screen `/zoe` page (PC + mobile) with AMOLED black-and-white theme — currently ZOE is still a sidebar/floating widget.
2. Autonomous orchestration — manual model picker still exists in `ZoeChat.tsx` (`MODEL_OPTIONS`). Spec says ZOE picks the model, not the user.
3. Clarification form (tickable) — currently ZOE just asks in prose.
4. Real exports — `.docx` + `.pdf`, not just `.txt`.
5. Auto-execute after clarification — once info is gathered, ZOE should start writing immediately.

Plus the two new requirements from this message:

6. **Hide the architect table from the user.** The blueprint is internal scaffolding only — ZOE runs it, self-audits it, and proceeds straight to writing. The user never sees a table or a "Begin writing" button.
7. **Use the most capable reasoning model for the architect prompt**, regardless of tier.

## What I'll change

### 1. Architect runs invisibly, writing starts automatically

- Remove the visible architect-table message and the "Begin writing" / "Refine blueprint" CTAs from `ZoeChat.tsx`.
- The `architect_work` tool now returns the table *into the assistant's tool-call result only* (kept in the model's context, not rendered).
- Replace the user-facing placeholder ("🧱 Architecting…") with a single soft status line: **"Planning your work…"** which gets replaced by the first streamed section.
- After the architect tool returns, ZOE immediately calls `write_section` for section 1 — no pause, no user input required to begin. Subsequent sections also auto-continue (no more "reply next") unless the user interrupts with feedback. The user just sees the work being written.
- The system prompt is updated: "PHASE 1 is silent. Never present the table to the user. Immediately proceed to write section 1, then 2, then 3, etc., until complete. Pause only if the user interrupts."

### 2. Architect always uses the strongest reasoning model

- In `zoe-architect/index.ts`, replace the tier-based picker with a fixed choice: **`openai/gpt-5.2`** (OpenAI's strongest reasoning model per the gateway list) with `reasoning.effort: "high"`. Fallback to `openai/gpt-5` if `gpt-5.2` returns a non-200, then `google/gemini-2.5-pro` as final fallback.
- All architect cost is borne by the platform regardless of user tier — matches the spec ("All AI costs are absorbed by the platform").

### 3. Full-screen `/zoe` page + AMOLED theme

- New file `src/pages/Zoe.tsx` that renders `<ZoeChat mode="page" />` full-screen with an AMOLED wrapper (`bg-black text-white`, `#0F0F0F` cards, `#1F1F1F` borders, white user bubbles inverted, single thin terracotta accent for active states).
- `ZoeChat.tsx` gains a `mode?: "widget" | "page"` prop. In `"page"` mode it fills the viewport, hides the FAB, hides the close button, applies the dark theme tokens.
- `App.tsx` adds `<Route path="/zoe" element={<ProtectedRoute><Zoe/></ProtectedRoute>} />`.
- `AuthContext` post-login redirect: paid tiers → `/zoe`, free → `/dashboard`.
- Landing/dashboard/auth pages remain untouched (theme is scoped to `/zoe` only).

### 4. Remove the manual model picker (autonomous orchestration)

- Delete the `MODEL_OPTIONS` UI from `ZoeChat.tsx`. Tier-based selection in `zoe-chat/index.ts` becomes the single source of truth.
- A small orchestrator pre-step (`gemini-2.5-flash-lite`) classifies each user turn (casual / drafting / full academic) and sets `reasoning.effort` (`none` / `low` / `high`) automatically.

### 5. Clarification form

- New tool `request_clarification` with schema `{ fields: [{ key, label, type: "text"|"select"|"checkbox"|"number", options?, required }] }`.
- `ZoeChat.tsx` renders a clean black/white inline form card. On submit, the answers are posted back as a structured user message and ZOE immediately proceeds (no extra user prompt needed).

### 6. Real exports — .docx + .pdf + .txt

- New `src/lib/exportDocs.ts` with `exportDocx`, `exportPdf`, `exportTxt`.
- Buttons under each long ZOE message: **Copy · Download .docx · Download .pdf · Download .txt**.
- After the final section completes, ZOE automatically offers an "Assemble & download full document" action that stitches all written sections (+ references) into one `.docx` / `.pdf`.
- Add `jspdf` to dependencies (`docx` is already present).

## Files

| File | Action |
|---|---|
| `src/pages/Zoe.tsx` | NEW — full-screen AMOLED ZOE page |
| `src/App.tsx` | Add `/zoe` route |
| `src/contexts/AuthContext.tsx` | Redirect paid tiers to `/zoe` after login |
| `src/components/chat/ZoeChat.tsx` | Add `mode="page"` + AMOLED tokens; remove model picker; remove architect-table render + CTAs; auto-continue writing; render `request_clarification` form; multi-format export buttons |
| `src/lib/exportDocs.ts` | NEW — `.docx` / `.pdf` / `.txt` helpers |
| `supabase/functions/zoe-architect/index.ts` | Use `gpt-5.2` (high reasoning) with fallback chain; output is for model context only |
| `supabase/functions/zoe-chat/index.ts` | Update system prompt: silent architect, auto-continue sections, no user pause; add `request_clarification` tool; orchestrator pre-classification; remove honouring `userChoice` model override |
| `package.json` | Add `jspdf` |

## Behavioural change

```text
Before                                   After
──────────────────────────────────       ──────────────────────────────────
User asks for an essay                   User asks for an essay
ZOE shows "Architecting…" placeholder    ZOE shows "Planning your work…"
ZOE prints the full execution table      Table runs invisibly with strongest
User clicks "Begin writing"              reasoning model + self-critique
ZOE writes section 1, waits for "next"   ZOE immediately writes section 1,
…and so on                               then 2, then 3 — straight through
Download = .txt only                     Copy · .docx · .pdf · .txt
Manual model picker                      Fully autonomous (tier-routed)
Beige sidebar widget                     Full-screen AMOLED at /zoe
ZOE asks clarifications in prose         ZOE renders a tickable form
```

