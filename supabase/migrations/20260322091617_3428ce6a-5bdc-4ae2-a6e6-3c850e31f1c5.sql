CREATE OR REPLACE FUNCTION public.set_unlimited_for_test_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email = 'grey.izilein@gmail.com' THEN
    NEW.tier := 'unlimited';
    NEW.word_limit := 1000000000000;
    NEW.words_used := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_unlimited_for_test_user ON public.profiles;
CREATE TRIGGER trg_set_unlimited_for_test_user
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_unlimited_for_test_user();