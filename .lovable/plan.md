
## What I found

The current failure is not just “a random ZOE bug” — the live backend is hitting `CPU Time exceeded` in `zoe-chat`, which lines up with the current attachment flow doing too much work in one request:

- `zoe-chat` fetches every attachment itself, then:
  - parses PDFs with `unpdf`
  - unzips DOCX/XLSX/PPTX with `JSZip`
  - base64-encodes images
- all of that happens before the AI request starts, inside one edge-function run

That makes large multi-file prompts fragile. The screenshot showing `API error 546` also confirms the client is still surfacing raw status codes instead of a useful reason.

I also found a prompt/tool mismatch that can cause odd behaviour:
- the top-level doctrine says architect should stay hidden and auto-write immediately
- but the `architect_work` tool description still says to show the table and wait for “begin / next”

## Plan

### 1. Stabilise `zoe-chat` so it stops timing out
In `supabase/functions/zoe-chat/index.ts` I’ll:
- add strict per-file and total extraction caps before expensive parsing starts
- skip or downscope heavy files once the request budget is reached
- extract only the minimum useful text from PDFs/Office files instead of trying to process everything fully
- stop doing expensive work for files that are too large, corrupted, or not worth parsing
- return clear structured error messages when a file is skipped or partially processed

### 2. Harden model fallback and backend error handling
Still in `zoe-chat` I’ll:
- keep the credit/rate-limit fallback chain, but make failures deterministic
- treat provider 5xx / overload responses as fallback-worthy too
- ensure the final error returned to the client is always human-readable
- avoid raw provider payloads leaking into the UI

### 3. Fix the client error UX
In `src/components/chat/ZoeChat.tsx` I’ll:
- replace raw `API error 546` style failures with clear messages from the backend
- add a specific attachment warning area for oversized/heavy files
- prevent known-bad sends earlier where possible
- preserve the existing model-switch note when fallback succeeds

### 4. Remove behavioural contradictions in the AI instructions
In `supabase/functions/zoe-chat/index.ts` I’ll align the tool descriptions with the actual ZOE flow:
- `architect_work` must stay internal
- no “reply begin/next” instruction
- keep the hidden blueprint + immediate auto-write path consistent

### 5. Add defensive validation for future failures
I’ll add guards for:
- malformed request bodies
- missing/invalid `messages`
- invalid attachment objects
- empty AI streams / malformed SSE responses
- attachment fetch failures / expired signed URLs
- scanned PDFs with no extractable text

### 6. Add regression coverage
I’ll add focused edge-function tests for:
- PDF and DOCX attachment processing
- oversized file handling
- model fallback on 402/429/503
- clean error responses instead of generic failures
- architect path consistency

## Files to update

- `supabase/functions/zoe-chat/index.ts`
- `src/components/chat/ZoeChat.tsx`
- likely a new test file under `supabase/functions/zoe-chat/`

## Verification after implementation

I’ll verify by:
1. testing a normal chat prompt
2. testing the same Apple multi-file scenario
3. confirming no more CPU-time crash in logs
4. confirming the UI shows readable errors if a file is rejected
5. confirming fallback still works when a model/provider is unavailable
6. checking the hidden architect → auto-write flow still behaves correctly

## Expected outcome

After this pass, ZOE should:
- stop failing on common multi-file prompts
- fail gracefully when a file is too heavy or unreadable
- stop showing raw status-code errors in chat
- behave more consistently across future attachment/model issues
