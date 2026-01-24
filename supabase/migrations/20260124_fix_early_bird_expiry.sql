-- Update handle_new_user trigger to set early bird expiry
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
        role,
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
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
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
