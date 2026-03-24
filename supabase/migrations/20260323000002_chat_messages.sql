-- ── Chat messages persistence ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id      TEXT        NOT NULL,  -- assessment UUID or "dashboard"
  role         TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'action')),
  content      TEXT        NOT NULL DEFAULT '',
  action_type  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_user_chat
  ON chat_messages (user_id, chat_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat messages"
  ON chat_messages FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
