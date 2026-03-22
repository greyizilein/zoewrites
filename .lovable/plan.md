
Goal: stop the placeholder page loop and make the live URL reliably show the real app.

1) Confirmed root cause (already reproduced)
- `https://zoellc.lovable.app` currently serves the default placeholder (`/placeholder.svg`), while Preview serves the full app.
- This means Live has not received the latest frontend publish (or is pinned to an empty snapshot), not a WriterEngine runtime crash.

2) Immediate recovery steps that should work
- Open Publish dialog and click **Update** for this project (frontend deploy).
- Wait for deploy completion, then hard-refresh Live (`Ctrl/Cmd+Shift+R`).
- Re-check:
  - `/` shows “Write better essays…”
  - `/auth` loads auth page
  - `/assessment/new` loads app shell after login

3) If Live still shows placeholder after Update (safe fallback)
- Open project History, restore last known working version, then publish that version.
- Make one tiny frontend change (e.g., title/meta text) and publish again to force a new frontend artifact.
- Verify the domain is this project’s active published URL (`zoellc.lovable.app`) and not the old `zoewrites.lovable.app`.

4) Hardening changes to prevent repeats
- Add a visible build/version stamp in footer (e.g., commit/time hash) so Preview vs Live mismatch is obvious instantly.
- Add a pre-publish smoke checklist in repo:
  - Home renders
  - Auth route renders
  - Writer route renders
  - No console errors
- Add Playwright smoke test (desktop + mobile) for: login → upload multiple briefs → generate execution table → write one section.

5) Done criteria
- Live homepage content matches Preview content (not placeholder markdown).
- One full Writer flow succeeds on mobile viewport and desktop.
- Version stamp in Live matches latest publish.
