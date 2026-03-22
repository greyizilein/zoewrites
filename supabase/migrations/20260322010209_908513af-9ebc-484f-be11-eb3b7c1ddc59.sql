UPDATE public.profiles SET tier = 'unlimited' WHERE email = 'grey.izilein@gmail.com';

CREATE OR REPLACE FUNCTION public.set_unlimited_for_test_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email = 'grey.izilein@gmail.com' THEN
    NEW.tier := 'unlimited';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_unlimited_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_unlimited_for_test_user();