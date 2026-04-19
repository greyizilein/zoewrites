

## Diagnosis (verified from edge function logs)

The "Something went wrong" reply on the user's "Company to use is Apple" message is **not** a credit/model issue. The Lovable AI Gateway returned a hard 400:

```
AI gateway error: 400
"Invalid MIME type. Only image types are supported."
code: invalid_image_format
```

In `supabase/functions/zoe-chat/index.ts` (lines 569-600), PDFs and images are both packed into `image_url` parts. The gateway only accepts actual image MIME types there — it rejects `application/pdf`. So **any time a PDF is attached, ZOE crashes**. The user attached 3 PDFs + 2 DOCX, hence the failure. DOCX works because we already unzip+extract those to text.

There is no auto-fallback to catch this — the function returns a generic 500 to the client, which renders "Something went wrong — please try again." with no detail. There's also no model-credit fallback if a model returns 402.

## Fix plan

### 1. Server-side PDF text extraction (root cause)

In `supabase/functions/zoe-chat/index.ts`, replace the PDF branch in the attachment loop. Instead of base64-streaming PDFs as `image_url`:

- Use `unpdf` (`https://esm.sh/unpdf@0.12.1`) to extract text from the PDF buffer server-side.
- Inject the extracted text into `contextNote` (capped at ~15k chars per file, like DOCX).
- Keep the `image_url` path for **actual images only** (png/jpg/webp/gif).
- If extraction fails or returns empty (scanned/image-only PDF), fall back to sending the PDF as **inline base64 with the `file` part shape** that Gemini supports — and only when the resolved model is a Gemini model. For non-Gemini models, just tell the model "[PDF could not be parsed — likely scanned. Ask user to paste key text.]"

### 2. Surface the real error to the user (no more silent "Something went wrong")

- In the edge function, return the gateway's status code + a human-readable reason (`"Couldn't read PDF X — try uploading the .docx version"`, `"Rate-limited, retrying in a moment"`, etc.) in the JSON body.
- In `ZoeChat.tsx` `handleSend` catch block, render `error.message` from the JSON instead of a generic fallback.

### 3. Auto model-credit fallback (the user's explicit ask)

Add a `MODEL_FALLBACK_CHAIN` constant at the top of `zoe-chat/index.ts`:

```
openai/gpt-5.2  →  openai/gpt-5  →  google/gemini-2.5-pro  →  google/gemini-3-flash-preview
openai/gpt-5    →  google/gemini-2.5-pro  →  google/gemini-3-flash-preview
google/gemini-2.5-pro  →  google/gemini-2.5-flash  →  google/gemini-3-flash-preview
google/gemini-2.5-flash  →  google/gemini-3-flash-preview
```

Wrap the gateway `fetch` in a small loop:
- If `429` or `402`: log it, swap to the next model in the chain, retry once.
- On success, prepend a tiny system note `"(Switched to <model> due to capacity.)"` so behaviour stays transparent.
- Stop after the chain is exhausted; only then return an error to the client.

This gives the user's `unlimited` tier (currently routed to `gpt-5.2`) a graceful drop to `gpt-5` → Gemini Pro → Flash if any upstream provider is out of credits or rate-limited.

### 4. Client-side defence

In `ZoeChat.tsx`, before sending: if any pending upload's MIME is `application/pdf` AND the file is > 15 MB, show a soft warning chip ("Large PDFs may be slow — uploading anyway"). Tiny UX touch only; the real fix is server-side.

## Files touched

- `supabase/functions/zoe-chat/index.ts` — PDF text extraction via `unpdf`, model fallback chain, richer error responses.
- `src/components/chat/ZoeChat.tsx` — surface the real error message from the function in the failure bubble.

## Out of scope

- No DB migrations.
- No tier/billing changes.
- The architect → auto-write doctrine, theme system, sidebar — all untouched.
- I won't move `mode === "widget"` since it's not mounted.

## Verification after the fix

I'll re-run the same scenario in `/zoe`: paste "Company to use is Apple", attach the same PDFs + DOCX, and confirm:
1. The function logs no `invalid_image_format`.
2. ZOE responds with the silent-architect → auto-write flow.
3. If a model returns 402 mid-chain, the assistant continues on the fallback model with the small "(Switched to …)" note.

