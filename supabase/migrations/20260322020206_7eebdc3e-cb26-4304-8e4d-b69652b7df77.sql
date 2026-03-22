ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS word_limit integer NOT NULL DEFAULT 500;

-- Backfill existing rows based on tier
UPDATE public.profiles SET word_limit = CASE 
  WHEN tier = 'free' THEN 500
  WHEN tier = 'hello' THEN 5000
  WHEN tier = 'regular' THEN 25000
  WHEN tier = 'professional' THEN 75000
  WHEN tier = 'unlimited' THEN 999999999
  ELSE 500
END WHERE word_limit = 500;