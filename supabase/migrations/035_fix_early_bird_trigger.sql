-- Fix early bird trigger to respect promotions settings
-- This migration updates the mark_early_bird_if_eligible() function
-- to check if early bird is enabled in system_settings before marking users

CREATE OR REPLACE FUNCTION mark_early_bird_if_eligible()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_users INTEGER;
  early_bird_enabled BOOLEAN := true;
  early_bird_limit INTEGER := 50;
  early_bird_months INTEGER := 2;
  promo_settings JSONB;
  expiry_date TIMESTAMPTZ;
BEGIN
  -- Check if early bird is enabled in system_settings
  BEGIN
    SELECT value INTO promo_settings
    FROM system_settings
    WHERE key = 'promotions'
    LIMIT 1;
    
    IF promo_settings IS NOT NULL THEN
      early_bird_enabled := COALESCE((promo_settings ->> 'early_bird_enabled')::boolean, true);
      early_bird_limit := COALESCE((promo_settings ->> 'early_bird_limit')::integer, 50);
      early_bird_months := COALESCE((promo_settings ->> 'early_bird_validity_months')::integer, 2);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If system_settings table doesn't exist or query fails, use defaults
    early_bird_enabled := true;
    early_bird_limit := 50;
    early_bird_months := 2;
  END;
  
  -- Only mark as early bird eligible if the feature is enabled
  IF early_bird_enabled THEN
    -- Count total users (including the one just created)
    SELECT COUNT(*) INTO total_users FROM user_profiles;
    
    -- If this is one of the first N users (where N is early_bird_limit), mark as eligible
    IF total_users <= early_bird_limit THEN
      -- Calculate expiry date based on settings
      expiry_date := NOW() + (early_bird_months || ' months')::INTERVAL;
      
      UPDATE user_profiles
      SET 
        early_bird_eligible = true,
        early_bird_granted_at = NOW(),
        early_bird_expires_at = expiry_date
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
