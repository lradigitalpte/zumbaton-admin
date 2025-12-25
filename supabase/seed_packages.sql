-- =====================================================
-- Seed: Insert Zumbaton Package Pricing
-- Date: 2025-01-08
-- Description: Creates all adult and kids packages with pricing
-- =====================================================

-- Fix any existing invalid data before inserting
UPDATE packages
SET package_type = CASE 
  WHEN package_type = 'adults' THEN 'adult'
  WHEN package_type = 'kids' THEN 'kid'
  WHEN package_type NOT IN ('adult', 'kid', 'all') OR package_type IS NULL THEN 'adult'
  ELSE package_type
END,
age_requirement = CASE
  WHEN age_requirement NOT IN ('all', '5-12', '13+') OR age_requirement IS NULL THEN 'all'
  ELSE age_requirement
END
WHERE package_type IS NULL 
   OR package_type NOT IN ('adult', 'kid', 'all')
   OR age_requirement IS NULL
   OR age_requirement NOT IN ('all', '5-12', '13+');

-- Clear existing packages (optional - comment out if you want to keep existing)
-- DELETE FROM packages;

-- Adults Packages
INSERT INTO packages (name, description, token_count, price_cents, currency, validity_days, class_types, is_active, package_type, age_requirement, created_at, updated_at)
VALUES
  -- 1 session - $30 (valid for 1 week)
  (
    '1 Session Pack',
    'Perfect for trying out our classes. Valid for 1 week.',
    1,
    3000, -- $30.00 in cents
    'SGD',
    7, -- 1 week
    ARRAY['all'],
    true,
    'adult',
    'all',
    NOW(),
    NOW()
  ),
  
  -- 4 sessions - $100 (1 month)
  (
    '4 Session Pack',
    'Great for regular dancers. Valid for 1 month.',
    4,
    10000, -- $100.00 in cents
    'SGD',
    30, -- 1 month
    ARRAY['all'],
    true,
    'adult',
    'all',
    NOW(),
    NOW()
  ),
  
  -- 8 sessions - $185 (2 months)
  (
    '8 Session Pack',
    'Best value for frequent dancers. Valid for 2 months.',
    8,
    18500, -- $185.00 in cents
    'SGD',
    60, -- 2 months
    ARRAY['all'],
    true,
    'adult',
    'all',
    NOW(),
    NOW()
  ),
  
  -- 10 sessions - $225 (2 months)
  (
    '10 Session Pack',
    'Popular choice for dedicated dancers. Valid for 2 months.',
    10,
    22500, -- $225.00 in cents
    'SGD',
    60, -- 2 months
    ARRAY['all'],
    true,
    'adult',
    'all',
    NOW(),
    NOW()
  ),
  
  -- 12 sessions - $265 (3 months)
  (
    '12 Session Pack',
    'Maximum value for committed dancers. Valid for 3 months.',
    12,
    26500, -- $265.00 in cents
    'SGD',
    90, -- 3 months
    ARRAY['all'],
    true,
    'adult',
    'all',
    NOW(),
    NOW()
  );

-- Kids Packages (5-12 years old)
INSERT INTO packages (name, description, token_count, price_cents, currency, validity_days, class_types, is_active, package_type, age_requirement, created_at, updated_at)
VALUES
  -- 1 session - $20 (valid for 1 week)
  (
    'Kids 1 Session Pack',
    'Perfect for kids to try out our classes. Must be accompanied by a parent/guardian. Valid for 1 week.',
    1,
    2000, -- $20.00 in cents
    'SGD',
    7, -- 1 week
    ARRAY['all'],
    true,
    'kid',
    '5-12',
    NOW(),
    NOW()
  ),
  
  -- 4 sessions - $80 (1 month)
  (
    'Kids 4 Session Pack',
    'Great for regular young dancers. Must be accompanied by a parent/guardian. Valid for 1 month.',
    4,
    8000, -- $80.00 in cents
    'SGD',
    30, -- 1 month
    ARRAY['all'],
    true,
    'kid',
    '5-12',
    NOW(),
    NOW()
  ),
  
  -- 8 sessions - $165 (2 months)
  (
    'Kids 8 Session Pack',
    'Best value for frequent young dancers. Must be accompanied by a parent/guardian. Valid for 2 months.',
    8,
    16500, -- $165.00 in cents
    'SGD',
    60, -- 2 months
    ARRAY['all'],
    true,
    'kid',
    '5-12',
    NOW(),
    NOW()
  );

-- Verify the packages were created
SELECT 
  id,
  name,
  package_type,
  token_count,
  price_cents / 100.0 as price_sgd,
  validity_days,
  age_requirement,
  is_active
FROM packages
ORDER BY package_type, token_count;

