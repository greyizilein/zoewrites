CREATE OR REPLACE FUNCTION public.set_unlimited_for_test_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email = 'grey.izilein@gmail.com' THEN
    NEW.tier := 'unlimited';
    NEW.word_limit := 2000000000;
    NEW.words_used := 0;
  END IF;
  RETURN NEW;
END;
$$;