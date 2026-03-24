-- ── Soft delete on assessments ──────────────────────────────────────────────
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ── Chat uploads tracker ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_uploads (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id  UUID        REFERENCES assessments(id) ON DELETE SET NULL,
  file_name      TEXT        NOT NULL,
  file_size      BIGINT      NOT NULL,
  file_type      TEXT        NOT NULL,
  storage_path   TEXT        NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat_uploads"
  ON chat_uploads FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Supabase Storage bucket (1 GB limit, private) ───────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-uploads', 'chat-uploads', false, 1073741824)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to manage objects inside their own subfolder
CREATE POLICY "Users manage own upload objects"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'chat-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'chat-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
