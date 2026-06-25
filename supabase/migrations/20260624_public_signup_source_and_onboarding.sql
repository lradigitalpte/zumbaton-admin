-- Public self-serve member signup support.
--
-- 1) Adds user_profiles.signup_source to distinguish public (web self-signup)
--    accounts from admin-created ones (visibility only; no access gating).
-- 2) Updates handle_new_user() to persist phone + signup_source from the auth
--    metadata. Email signup attaches signup_source='public'; admin.createUser
--    attaches 'admin'. Google OAuth attaches nothing -> stays NULL and is marked
--    'public' when the user finishes onboarding (see web /api/onboarding).
-- 3) Backfills onboarding_completed = true for ALL existing users so the new
--    hard onboarding gate only ever applies to genuinely new signups.

-- 1) signup_source column ---------------------------------------------------
-- Nullable, no default: the value is set explicitly by each signup path
-- (admin.createUser -> 'admin', email signup -> 'public') or backfilled to
-- 'public' when an OAuth user finishes onboarding.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS signup_source VARCHAR(20);

-- All historical users were created by staff.
UPDATE public.user_profiles SET signup_source = 'admin' WHERE signup_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_signup_source
  ON public.user_profiles(signup_source);

COMMENT ON COLUMN public.user_profiles.signup_source IS
  'How the account was created: public (self-serve web signup) or admin (created by staff).';

-- 2) handle_new_user trigger: also persist phone + signup_source -------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert user profile with early bird eligibility
    INSERT INTO public.user_profiles (
        id,
        email,
        name,
        phone,
        role,
        signup_source,
        early_bird_eligible,
        early_bird_granted_at,
        early_bird_expires_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(
            NEW.raw_user_meta_data->>'name',
            split_part(COALESCE(NEW.email, 'unknown@example.com'), '@', 1)
        ),
        NEW.raw_user_meta_data->>'phone',
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        -- Only what the signup explicitly attaches: 'public' (email signup) or
        -- 'admin' (admin.createUser passes it). OAuth signups attach nothing, so
        -- this stays NULL and gets marked 'public' when they finish onboarding.
        NEW.raw_user_meta_data->>'signup_source',
        true,  -- All new users get early bird
        NOW(),
        NOW() + INTERVAL '60 days'  -- Expires in 60 days (2 months)
    )
    ON CONFLICT (id) DO NOTHING;

    -- Create notification preferences
    INSERT INTO public.user_notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Create user stats
    INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- 3) Backfill onboarding_completed for existing users -----------------------
-- Without this, the new hard gate would force every existing member through
-- onboarding on their next login.
UPDATE public.user_profiles
  SET onboarding_completed = true
  WHERE onboarding_completed IS DISTINCT FROM true;
