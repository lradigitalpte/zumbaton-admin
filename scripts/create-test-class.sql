-- Create a test class available now and book it for a user
-- Copy and paste this into Supabase SQL Editor and run it
-- User ID: b3e50c65-d845-40d1-8e0d-d00c5ad2b928

DO $$
DECLARE
  v_user_id UUID := 'b3e50c65-d845-40d1-8e0d-d00c5ad2b928';
  v_class_id UUID;
  v_booking_id UUID;
  v_package_id UUID;
  v_class_time TIMESTAMPTZ;
BEGIN
  -- Set class time to 10 minutes from now (within check-in window)
  -- Check-in window: 30 minutes before class to 2 hours after class start
  v_class_time := NOW() + INTERVAL '10 minutes';

  -- 1. Ensure user has an active package with tokens
  SELECT id INTO v_package_id
  FROM user_packages
  WHERE user_id = v_user_id
    AND status = 'active'
    AND tokens_remaining > 0
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no package exists, create one
  IF v_package_id IS NULL THEN
    INSERT INTO user_packages (
      user_id,
      package_id,
      tokens_remaining,
      tokens_held,
      status,
      expires_at,
      purchased_at
    ) VALUES (
      v_user_id,
      NULL, -- Manual adjustment package
      10, -- 10 tokens
      0,
      'active',
      NOW() + INTERVAL '1 year', -- Expires in 1 year
      NOW()
    )
    RETURNING id INTO v_package_id;
    
    RAISE NOTICE 'Created test package with 10 tokens: %', v_package_id;
  ELSE
    RAISE NOTICE 'Using existing package: %', v_package_id;
  END IF;

  -- 2. Create a test class scheduled 10 minutes from now
  INSERT INTO classes (
    title,
    description,
    class_type,
    level,
    instructor_id,
    instructor_name,
    scheduled_at,
    duration_minutes,
    capacity,
    token_cost,
    location,
    status,
    allow_drop_in,
    drop_in_token_cost
  ) VALUES (
    'Test Zumba Class - QR Check-in',
    'Test class for QR code check-in functionality',
    'zumba',
    'all_levels',
    NULL,
    'Test Instructor',
    v_class_time,
    60, -- 60 minutes duration
    20, -- Capacity of 20
    1, -- 1 token cost
    'Main Studio',
    'scheduled',
    true, -- Allow drop-in
    1 -- Drop-in token cost
  )
  RETURNING id INTO v_class_id;

  RAISE NOTICE 'Created class: % - Scheduled at: %', v_class_id, v_class_time;

  -- 3. Create booking for the user
  INSERT INTO bookings (
    user_id,
    class_id,
    user_package_id,
    tokens_used,
    status,
    booked_at
  ) VALUES (
    v_user_id,
    v_class_id,
    v_package_id,
    1, -- 1 token used
    'confirmed',
    NOW()
  )
  RETURNING id INTO v_booking_id;

  RAISE NOTICE 'Created booking: %', v_booking_id;
  RAISE NOTICE '✅ Success! Class ID: %, Booking ID: %', v_class_id, v_booking_id;
  RAISE NOTICE 'Class scheduled at: % (check-in window is open)', v_class_time;

END $$;
