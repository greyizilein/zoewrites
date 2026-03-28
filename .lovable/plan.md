

# Fix ZOE Dashboard Chat — All Issues

## Issues Found

### 1. Tool name mismatch: `run_critique` vs `quality_critique`
The edge function defines the tool as `run_critique`, but the client-side `executePipeline` handles `case "quality_critique"`. When the AI calls `run_critique`, the client hits the `default` case and logs "Unknown tool". Fix: rename client handler to `run_critique`.

### 2. `apply_revision` tool name mismatch
Edge function defines `apply_revision` but client handles `revise_section`. Fix: add `case "apply_revision"` alias.

### 3. `deleted_at` references — column doesn't exist
The `assessments` table has no `deleted_at` column (confirmed in types.ts), but `restore_assessment` and `view_trash` tools reference it. These will silently fail. Fix: remove `restore_assessment` and `view_trash` handlers (and the corresponding tool definitions in the edge function), since deletion is permanent.

### 4. `chat_messages` and `chat_uploads` tables don't exist
Both are used with `as any` casts, so they won't cause build errors, but all persistence (message history, file upload tracking) silently fails at runtime. Fix: create these tables via migration.

### 5. `chat-uploads` storage bucket may not exist
The migration file creates it, but we should verify. The bucket is referenced for file uploads.

### 6. Textarea not working
The textarea uses a raw `<textarea>` element. On mobile, the `touchAction: "manipulation"` style can interfere. The input area structure looks correct but the `disabled={loading}` during uploads could lock it. Also, the `onChange` handler is fine. The real issue may be that `WebkitUserSelect: "text"` needs to be combined with removing any parent touch event handlers. Fix: ensure textarea is fully interactive by removing potentially problematic inline styles.

### 7. File upload not working
File uploads try to write to `chat-uploads` bucket and `chat_uploads` table. If either doesn't exist, uploads silently fail and the toast shows "Upload failed". Fix: create the table and ensure bucket exists.

## Changes

| File | Change |
|------|--------|
| **Migration** | Create `chat_messages` and `chat_uploads` tables with RLS policies |
| `src/components/chat/ZoeDashboardChat.tsx` | Fix `run_critique` → rename handler; add `apply_revision` alias to `revise_section`; remove broken `restore_assessment`/`view_trash` handlers; fix textarea styles for mobile |
| `supabase/functions/zoe-chat/index.ts` | Remove `restore_assessment` and `view_trash` tool definitions; update system prompt to remove soft-delete references |

## Database Migration

```sql
-- chat_messages table for ZOE conversation persistence
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chat_id text NOT NULL DEFAULT 'dashboard',
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'action')),
  content text NOT NULL DEFAULT '',
  action_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat messages"
  ON public.chat_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_chat_messages_user_chat ON public.chat_messages (user_id, chat_id, created_at);

-- chat_uploads table for file upload tracking
CREATE TABLE IF NOT EXISTS public.chat_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_size bigint,
  file_type text,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat uploads"
  ON public.chat_uploads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## Client Fixes Summary

- `case "quality_critique"` → `case "run_critique"` 
- Add `case "apply_revision"` that maps to revise_section logic
- Remove `case "restore_assessment"` and `case "view_trash"` (dead code)
- Remove `touchAction: "manipulation"` and `WebkitUserSelect` from textarea styles (can block mobile input)
- Remove the `as any` casts on `chat_messages` and `chat_uploads` now that tables will exist (types will auto-update after migration)

