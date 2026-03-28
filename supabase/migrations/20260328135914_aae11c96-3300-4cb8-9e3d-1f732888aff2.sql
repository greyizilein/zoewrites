
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

-- chat-uploads storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-uploads', 'chat-uploads', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload chat files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own chat files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
