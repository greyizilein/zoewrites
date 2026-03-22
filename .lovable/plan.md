

## Grant Unlimited Access to grey.izilein@gmail.com

### Current State
- No profile exists yet (user hasn't signed up)
- A trigger `set_unlimited_for_test_user` already sets `tier = 'unlimited'` on insert, but does **not** set `word_limit`

### Plan

**1. Update the existing trigger** to also set `word_limit` to a very large number (1,000,000,000,000 — 1 trillion) and reset `words_used` to 0 when this email signs up.

**Migration SQL:**
```sql
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
```

**2. Ensure the trigger is attached** to the `profiles` table on INSERT (it should already be, but the trigger list showed none — we'll recreate it to be safe, firing BEFORE INSERT on `profiles`).

**3. If the user has already signed up** (profile exists but wasn't found due to email mismatch), we'll also run a data update via insert tool to set `tier = 'unlimited'`, `word_limit = 1000000000000`, `words_used = 0` on any existing profile with that email.

### Technical Details
- Word limit of 1 trillion (1,000,000,000,000) effectively means unlimited
- The trigger fires on profile creation so future sign-ups are covered automatically
- A one-time data update covers the case where the user already exists

