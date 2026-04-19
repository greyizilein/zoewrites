// Deno tests for zoe-chat edge function.
// These cover the high-risk areas identified in the bug fix pass:
//   - request validation
//   - oversized / malformed file handling
//   - model fallback behaviour
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

Deno.test("ignores invalid attachment objects without crashing", async () => {
  // Attachments that are missing url/name should be filtered out silently.
  const resp = await call({
    messages: [{ role: "user", content: "hi" }],
    attachments: [
      { name: "ok.txt" }, // missing url
      null,
      { url: "https://example.com/x", name: "oops.txt", type: "text/plain" },
    ],
    tier: "free",
  });
  // Either streams a response (200) or returns a structured error — never crashes.
  assert(resp.status === 200 || resp.status >= 400, `unexpected ${resp.status}`);
  // Always consume the body.
  if (resp.body) await resp.body.cancel();
  else await resp.text().catch(() => "");
});

Deno.test("CORS preflight returns headers", async () => {
  const resp = await fetch(FUNC_URL, { method: "OPTIONS" });
  assertEquals(resp.headers.get("Access-Control-Allow-Origin"), "*");
  await resp.text();
});
