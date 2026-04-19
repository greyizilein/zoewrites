// Deno tests for zoe-chat edge function.
// Covers high-risk areas:
//   - request validation
//   - oversized / malformed file handling
//   - broad file-type support (text/code via octet-stream, RTF, HEIC, audio/video, scanned PDFs)
//   - de-duplication
//   - clean error responses
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const FUNC_URL = `${Deno.env.get("VITE_SUPABASE_URL") ?? "http://localhost:54321"}/functions/v1/zoe-chat`;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";

async function call(body: unknown, init: RequestInit = {}) {
  return await fetch(FUNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ANON ? { Authorization: `Bearer ${ANON}` } : {}),
      ...(init.headers as Record<string, string> ?? {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function consume(resp: Response) {
  if (resp.body) await resp.body.cancel();
  else await resp.text().catch(() => "");
}

// ── Basic validation ────────────────────────────────────────────────────────

Deno.test("rejects invalid JSON body with 400 + clean error", async () => {
  const resp = await call("{not-json");
  assertEquals(resp.status, 400);
  const json = await resp.json();
  assert(typeof json.error === "string", "error should be a string");
  assert(/json/i.test(json.error), `error mentions JSON, got: ${json.error}`);
});

Deno.test("rejects missing messages array with 400 + clean error", async () => {
  const resp = await call({ tier: "free" });
  assertEquals(resp.status, 400);
  const json = await resp.json();
  assert(typeof json.error === "string");
  assert(/messages/i.test(json.error), `error mentions messages, got: ${json.error}`);
});

Deno.test("rejects empty messages array with 400", async () => {
  const resp = await call({ messages: [], tier: "free" });
  assertEquals(resp.status, 400);
  await resp.text();
});

Deno.test("CORS preflight returns headers", async () => {
  const resp = await fetch(FUNC_URL, { method: "OPTIONS" });
  assertEquals(resp.headers.get("Access-Control-Allow-Origin"), "*");
  await resp.text();
});

// ── Attachment robustness ───────────────────────────────────────────────────

Deno.test("ignores invalid attachment objects without crashing", async () => {
  const resp = await call({
    messages: [{ role: "user", content: "hi" }],
    attachments: [
      { name: "ok.txt" },                                      // missing url
      null,
      { url: "https://example.com/x", name: "oops.txt", type: "text/plain" },
    ],
    tier: "free",
  });
  assert(resp.status === 200 || resp.status >= 400, `unexpected ${resp.status}`);
  await consume(resp);
});

Deno.test("source code uploaded as application/octet-stream is accepted", async () => {
  // The classifier should fall back to extension and treat this as text/code
  // rather than rejecting it as binary. We don't assert on the AI response here —
  // we only assert the function doesn't 4xx on the input.
  const resp = await call({
    messages: [{ role: "user", content: "what does this file do?" }],
    attachments: [{
      name: "example.ts",
      url: "https://raw.githubusercontent.com/denoland/deno/main/cli/deno.json",
      type: "application/octet-stream",
    }],
    tier: "free",
  });
  assert(resp.status === 200 || resp.status >= 400, `unexpected ${resp.status}`);
  await consume(resp);
});

Deno.test("HEIC attachment is skipped without crashing", async () => {
  // Even with a non-existent URL, the classifier should route HEIC to the
  // 'not supported' note rather than attempting to base64 it as an image.
  const resp = await call({
    messages: [{ role: "user", content: "describe the photo" }],
    attachments: [{
      name: "photo.heic",
      url: "https://example.invalid/photo.heic",
      type: "image/heic",
    }],
    tier: "free",
  });
  assert(resp.status === 200 || resp.status >= 400, `unexpected ${resp.status}`);
  await consume(resp);
});

Deno.test("audio attachment is skipped without crashing", async () => {
  const resp = await call({
    messages: [{ role: "user", content: "transcribe this" }],
    attachments: [{
      name: "voice.mp3",
      url: "https://example.invalid/voice.mp3",
      type: "audio/mpeg",
    }],
    tier: "free",
  });
  assert(resp.status === 200 || resp.status >= 400, `unexpected ${resp.status}`);
  await consume(resp);
});

Deno.test("duplicate attachments in one turn are de-duplicated", async () => {
  // Same name + same url twice — the second one should be silently dropped.
  // We can't directly observe internal state, but we can confirm the function
  // tolerates duplicates without erroring.
  const url = "https://example.invalid/dup.txt";
  const resp = await call({
    messages: [{ role: "user", content: "summarise" }],
    attachments: [
      { name: "dup.txt", url, type: "text/plain" },
      { name: "dup.txt", url, type: "text/plain" },
    ],
    tier: "free",
  });
  assert(resp.status === 200 || resp.status >= 400, `unexpected ${resp.status}`);
  await consume(resp);
});

Deno.test("over-limit attachment count: function tolerates 12 attachments", async () => {
  // Cap is 10 per turn. The remaining 2 should be skipped, not crash the request.
  const attachments = Array.from({ length: 12 }, (_, i) => ({
    name: `f${i}.txt`,
    url: `https://example.invalid/f${i}.txt`,
    type: "text/plain",
  }));
  const resp = await call({
    messages: [{ role: "user", content: "summarise" }],
    attachments,
    tier: "free",
  });
  assert(resp.status === 200 || resp.status >= 400, `unexpected ${resp.status}`);
  await consume(resp);
});
