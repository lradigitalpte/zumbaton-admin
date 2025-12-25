-- =====================================================
-- Fix Package Constraints
-- Run this BEFORE running seed_packages.sql if you get constraint errors
-- =====================================================

-- First, drop existing constraints if they exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'packages_package_type_check'
  ) THEN
    ALTER TABLE packages DROP CONSTRAINT packages_package_type_check;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'packages_age_requirement_check'
  ) THEN
    ALTER TABLE packages DROP CONSTRAINT packages_age_requirement_check;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_package_type'
  ) THEN
    ALTER TABLE packages DROP CONSTRAINT chk_package_type;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_age_requirement'
  ) THEN
    ALTER TABLE packages DROP CONSTRAINT chk_age_requirement;
  END IF;
END $$;

-- Fix all existing data to have valid values
UPDATE packages
SET package_type = CASE 
  WHEN package_type IS NULL THEN 'adult'
  WHEN LOWER(package_type) = 'adults' THEN 'adult'
  WHEN LOWER(package_type) = 'kids' THEN 'kid'
  WHEN package_type NOT IN ('adult', 'kid', 'all') THEN 'adult'
  ELSE package_type
END,
age_requirement = CASE
  WHEN age_requirement IS NULL THEN 'all'
  WHEN age_requirement NOT IN ('all', '5-12', '13+') THEN 'all'
  ELSE age_requirement
END;

-- Ensure columns exist and are NOT NULL
ALTER TABLE packages
ADD COLUMN IF NOT EXISTS package_type VARCHAR(50) DEFAULT 'adult';

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS age_requirement VARCHAR(50) DEFAULT 'all';

-- Update any NULL values
UPDATE packages
SET package_type = 'adult' WHERE package_type IS NULL;

UPDATE packages
SET age_requirement = 'all' WHERE age_requirement IS NULL;

-- Make columns NOT NULL
ALTER TABLE packages
ALTER COLUMN package_type SET DEFAULT 'adult',
ALTER COLUMN package_type SET NOT NULL;

ALTER TABLE packages
ALTER COLUMN age_requirement SET DEFAULT 'all',
ALTER COLUMN age_requirement SET NOT NULL;

-- Now add the constraints
ALTER TABLE packages
ADD CONSTRAINT chk_package_type CHECK (package_type IN ('adult', 'kid', 'all'));

ALTER TABLE packages
ADD CONSTRAINT chk_age_requirement CHECK (age_requirement IN ('all', '5-12', '13+'));

-- Verify the fix
SELECT 
  id,
  name,
  package_type,
  age_requirement,
  CASE 
    WHEN package_type NOT IN ('adult', 'kid', 'all') THEN 'INVALID package_type'
    WHEN age_requirement NOT IN ('all', '5-12', '13+') THEN 'INVALID age_requirement'
    ELSE 'OK'
  END as status
FROM packages
WHERE package_type NOT IN ('adult', 'kid', 'all') 
   OR age_requirement NOT IN ('all', '5-12', '13+');

