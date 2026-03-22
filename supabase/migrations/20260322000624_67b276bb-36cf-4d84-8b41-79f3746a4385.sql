CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  tier TEXT NOT NULL DEFAULT 'free',
  words_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Assessment',
  type TEXT,
  brief_text TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  word_target INTEGER NOT NULL DEFAULT 0,
  word_current INTEGER NOT NULL DEFAULT 0,
  execution_plan JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assessments" ON public.assessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own assessments" ON public.assessments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assessments" ON public.assessments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assessments" ON public.assessments FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  word_target INTEGER NOT NULL DEFAULT 0,
  word_current INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  content TEXT DEFAULT '',
  framework TEXT,
  citations JSONB DEFAULT '[]'::jsonb,
  citation_count INTEGER DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sections" ON public.sections FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.assessments WHERE id = assessment_id AND user_id = auth.uid())
);
CREATE POLICY "Users can create own sections" ON public.sections FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.assessments WHERE id = assessment_id AND user_id = auth.uid())
);
CREATE POLICY "Users can update own sections" ON public.sections FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.assessments WHERE id = assessment_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete own sections" ON public.sections FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.assessments WHERE id = assessment_id AND user_id = auth.uid())
);

CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.assessment_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  image_type TEXT NOT NULL DEFAULT 'diagram',
  prompt TEXT,
  url TEXT,
  caption TEXT,
  figure_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.assessment_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own images" ON public.assessment_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sections s JOIN public.assessments a ON a.id = s.assessment_id WHERE s.id = section_id AND a.user_id = auth.uid())
);
CREATE POLICY "Users can create own images" ON public.assessment_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.sections s JOIN public.assessments a ON a.id = s.assessment_id WHERE s.id = section_id AND a.user_id = auth.uid())
);
CREATE POLICY "Users can delete own images" ON public.assessment_images FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.sections s JOIN public.assessments a ON a.id = s.assessment_id WHERE s.id = section_id AND a.user_id = auth.uid())
);

CREATE TABLE public.exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  format TEXT NOT NULL DEFAULT 'docx',
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exports" ON public.exports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.assessments WHERE id = assessment_id AND user_id = auth.uid())
);
CREATE POLICY "Users can create own exports" ON public.exports FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.assessments WHERE id = assessment_id AND user_id = auth.uid())
);

INSERT INTO storage.buckets (id, name, public) VALUES ('briefs', 'briefs', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', false);

CREATE POLICY "Users can upload briefs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'briefs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own briefs" ON storage.objects FOR SELECT USING (bucket_id = 'briefs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own export files" ON storage.objects FOR SELECT USING (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can create export files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);