

## Goal

Make ZOE robust against the full range of file types users actually upload, and proactively close the rest of the holes I can see in the current attachment + chat pipeline before they bite.

## What I found by re-reading the current code

In `supabase/functions/zoe-chat/index.ts` the attachment loop currently only really understands:
- PDF (via `unpdf`)
- DOCX, XLSX, PPTX (via `JSZip` text extraction)
- Plain text / CSV / JSON / MD (decoded as UTF-8)
- Images (`image/*` → sent as `image_url`)

Everything else falls into a generic "unsupported" branch and gets dropped with a skip note. That means common things like:
- `.rtf`, `.odt`, `.pages`
- `.html`, `.xml`, `.yaml`, `.tsv`, `.log`, `.ini`, `.toml`, `.env`-style configs
- Source code files (`.ts`, `.tsx`, `.js`, `.py`, `.java`, `.go`, `.rs`, `.cpp`, `.cs`, `.rb`, `.php`, `.swift`, `.kt`, `.sql`, `.sh`, …)
- `.epub` (zip + xhtml inside)
- Audio (`.mp3`, `.wav`, `.m4a`) and video — currently silently skipped
- Scanned PDFs (unpdf returns empty)
- HEIC images from iPhone
- Files whose MIME type the browser reports as `application/octet-stream` (very common for code + config)

…all get rejected, even when the bytes are perfectly readable text or could be OCR'd.

I also spotted a few latent issues worth fixing in the same pass:
- File-type detection relies almost entirely on MIME, not extension — so `application/octet-stream` uploads lose all routing.
- The skip-note path for "unknown type" doesn't try a UTF-8 sniff before giving up.
- No HEIC handling at all (Safari/iOS users will hit this).
- Scanned PDFs return an empty string and produce a confusing "0 chars extracted" instead of a clear "this looks scanned — paste the key text or upload a text version" message.
- Audio/video are large and will blow the 8MB cap with no helpful guidance.
- The total text budget is shared across files but there's no per-file "fair share" — one huge DOCX can starve everything else.
- There's no de-duplication, so if a user re-attaches the same file twice it parses twice.
- Extension/MIME mismatch (e.g. a `.docx` actually being a PDF) currently breaks parsing silently.

## Plan

### 1. Broaden file-type recognition (`zoe-chat/index.ts`)

Add a single `classifyAttachment(name, mime, headBytes)` helper that returns one of:
`image | pdf | docx | xlsx | pptx | odt | rtf | epub | text | code | audio | video | unknown`

Detection priority:
1. Magic-byte sniff on the first ~16 bytes (PDF `%PDF`, ZIP `PK\x03\x04`, RTF `{\rtf`, OGG/MP3/WAV headers, JPEG/PNG/GIF/WEBP/HEIC signatures).
2. Extension fallback (covers `application/octet-stream` from the browser).
3. MIME as last resort.

This alone fixes the vast majority of "unsupported file" complaints because most code/config files are just UTF-8 text being mis-MIMEd.

### 2. Add real handlers for the new types

In the same file:

- **Plain text family** (`text`, `code`, `.html`, `.xml`, `.yaml`, `.tsv`, `.log`, `.ini`, `.toml`, `.sql`, `.sh`, source code): UTF-8 decode with BOM stripping + invalid-byte tolerance, capped at the per-file budget. Wrap in a labelled fence so the model knows the language (e.g. ```ts … ```).
- **RTF**: strip control words (`\\[a-z]+-?\d* ?`) and braces to recover plain text — no new dependency.
- **ODT**: same JSZip path as DOCX, but read `content.xml` and strip tags.
- **EPUB**: JSZip → concatenate `*.xhtml` / `*.html` inside, strip tags, cap.
- **HEIC**: detect and return a clear skip note ("HEIC isn't supported by the model — please convert to JPG or PNG").
- **Audio/Video**: detect, skip parsing, return a clear note ("Audio/video aren't supported in chat yet — upload a transcript or describe the contents").
- **Scanned PDFs** (unpdf returns < 40 chars of text): explicit note ("This PDF looks scanned — no selectable text. Paste the key passages or upload a text version.") instead of silently failing.
- **Extension/MIME mismatch**: if sniff disagrees with extension, trust the sniff and log it; never crash.

### 3. Fairer extraction budget

- Compute a per-file share = `min(PER_FILE_TEXT_CAP, TOTAL_TEXT_BUDGET / max(1, fileCount))` so a single huge DOCX can't starve the others.
- Keep the existing global `TOTAL_TEXT_BUDGET` as a hard ceiling.
- When a file is truncated, append `… [truncated]` and a single skip note per file (not per chunk), so the user sees one clear summary line.

### 4. Light de-duplication

- Hash `(name + size)` per turn; if the same attachment appears twice in one message, parse once and reuse the extracted text. Stops accidental double-uploads from doubling the budget cost.

### 5. Better client-side guidance (`src/components/chat/ZoeChat.tsx`)

- Pre-classify on the client using extension + MIME and:
  - Soft-warn for HEIC ("Convert to JPG/PNG for best results — uploading anyway").
  - Soft-warn for audio/video ("Not supported yet — will be skipped").
  - Soft-warn for any single file > 8MB ("Large file — only the first portion will be read").
- Keep all warnings non-blocking; the user can still send.
- Render any per-file skip notes returned by the backend in a small "Some files were partially read" line under the assistant bubble (already wired — just make sure the new note shapes flow through unchanged).

### 6. Defensive hardening (no behaviour change when things go right)

While I'm in `zoe-chat/index.ts`:
- Wrap every individual file handler in its own try/catch so one bad file can never take down the whole turn.
- Treat any `signed url expired` / 403 from the storage fetch as a clean per-file skip, not a 500.
- Cap total attachments processed per turn at 10 (matches the documented chat upload limit) and skip the rest with a note.
- Make sure the existing model-fallback chain still triggers on 5xx — confirmed it does, no change needed.

### 7. Tests

Extend `supabase/functions/zoe-chat/index_test.ts` with focused cases:
- `.ts` source uploaded as `application/octet-stream` is treated as text and reaches the model.
- `.rtf` is decoded to plain text.
- HEIC is skipped with a readable note (not a crash).
- A scanned-style PDF (mocked: empty text result) returns the explicit "looks scanned" note.
- Two identical attachments in one turn are de-duplicated.
- 11 attachments in one turn → first 10 processed, 11th gets a clear skip note.

## Files touched

- `supabase/functions/zoe-chat/index.ts` — new classifier, new handlers (RTF/ODT/EPUB/text-family), per-file fair share, dedupe, scanned-PDF note, HEIC/audio/video notes, per-handler try/catch.
- `src/components/chat/ZoeChat.tsx` — extra pre-send warnings for HEIC / audio / video / >8MB.
- `supabase/functions/zoe-chat/index_test.ts` — new regression cases listed above.

## Out of scope

- No real audio transcription (would need Whisper / a new pipeline — happy to do it as a follow-up).
- No real OCR for scanned PDFs (same — would need Gemini vision routing or Tesseract; called it out as a separate suggestion).
- No DB schema changes.
- Theme system, sidebar, architect/auto-write doctrine — all untouched.

## Verification after implementation

1. Upload a `.ts` file with no MIME → ZOE quotes it back accurately.
2. Upload an `.rtf` file → text extracted, no skip note.
3. Upload a HEIC photo → soft warning client-side, clean skip note in reply.
4. Upload an `.mp3` → clear "audio not supported yet" note, rest of the turn still works.
5. Upload a scanned PDF → explicit "looks scanned" note instead of silent fail.
6. Upload the same DOCX twice → only one extraction in the logs.
7. Re-run the Apple multi-file scenario → still no CPU-time crash, still hits the silent-architect → auto-write flow.

