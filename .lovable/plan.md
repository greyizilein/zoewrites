

# Fix Build Errors and Missing Writer Engine

## Problems Identified

1. **404 on `/assessment/*` routes** — `App.tsx` has no route for `/assessment/:id` or `/assessment/new`. The `WriterEngine.tsx` page and entire `src/components/writer/` directory are missing (deleted or never saved from previous edits). ZoeChat and useZoeHome navigate to `/assessment/*` which hits the 404 catch-all.

2. **Build error: `useWriterChat.ts` imports missing module** — `@/components/writer/types` doesn't exist, causing `TS2307`.

3. **Build error: `zoe-chat/index.ts` TS7053** — `zip.files[sf]` has implicit `any` type. The `JSZip.files` property needs explicit typing when accessed by string key.

4. **`ZoeFloatingChat.tsx` was never created** — The plan called for it but the file doesn't exist. Dashboard doesn't have the floating widget.

## Fix Plan

### Fix 1: Edge function type error (zoe-chat)
**File**: `supabase/functions/zoe-chat/index.ts` (lines 639-645)

Cast `zip.files` access to resolve the implicit `any`:
```typescript
const filesMap = zip.files as Record<string, any>;
// then use filesMap[sf].async("string")
```

### Fix 2: Create `src/components/writer/types.ts`
Recreate the types file with the `Section`, `WriterSettings`, and related types that `useWriterChat.ts` imports. Include the 6-stage labels and all assessment types/tones/settings from the approved plan.

### Fix 3: Create `src/pages/WriterEngine.tsx`
Recreate the Writer Engine page with the 6-stage pipeline (Brief → Plan → Write → Review → Revise → Export). This is the largest piece — it needs to:
- Accept an assessment ID from the URL (`/assessment/:id`)
- Handle `/assessment/new` for creating new assessments
- Load assessment data, sections, and settings from the database
- Render stage components (simplified inline initially since the `src/components/writer/` subdirectory components are all missing)
- Wire the `useWriterChat` hook for in-page chat

### Fix 4: Add `/assessment` routes to `App.tsx`
Add:
```tsx
<Route path="/assessment/new" element={<ProtectedRoute><WriterEngine /></ProtectedRoute>} />
<Route path="/assessment/:id" element={<ProtectedRoute><WriterEngine /></ProtectedRoute>} />
```

### Fix 5: Create `src/components/chat/ZoeFloatingChat.tsx`
Build the floating chat widget as planned (FAB + panel) and add it to `Dashboard.tsx`.

## Execution Order

1. Fix `zoe-chat/index.ts` type error (small, unblocks edge function deployment)
2. Create `src/components/writer/types.ts` (unblocks `useWriterChat.ts` import)
3. Create `src/pages/WriterEngine.tsx` (full 6-stage writer page)
4. Add routes to `App.tsx`
5. Create `ZoeFloatingChat.tsx` and wire into Dashboard

