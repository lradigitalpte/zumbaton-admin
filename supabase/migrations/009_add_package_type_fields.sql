-- =====================================================
-- Migration: Add package_type and age_requirement to packages
-- Date: 2025-01-08
-- Description: Adds support for Adults and Kids packages
-- =====================================================

-- Add package_type column (allow NULL initially)
ALTER TABLE packages
ADD COLUMN IF NOT EXISTS package_type VARCHAR(50);

-- Add age_requirement column (allow NULL initially)
ALTER TABLE packages
ADD COLUMN IF NOT EXISTS age_requirement VARCHAR(50);

-- Update existing packages to valid default values BEFORE adding constraints
-- Fix any invalid values (e.g., 'adults' -> 'adult', 'kids' -> 'kid')
UPDATE packages
SET package_type = CASE 
  WHEN package_type IS NULL THEN 'adult'
  WHEN package_type = 'adults' THEN 'adult'
  WHEN package_type = 'kids' THEN 'kid'
  WHEN package_type NOT IN ('adult', 'kid', 'all') THEN 'adult'
  ELSE package_type
END,
age_requirement = CASE
  WHEN age_requirement IS NULL THEN 'all'
  WHEN age_requirement NOT IN ('all', '5-12', '13+') THEN 'all'
  ELSE age_requirement
END;

-- Now make columns NOT NULL
ALTER TABLE packages
ALTER COLUMN package_type SET DEFAULT 'adult',
ALTER COLUMN package_type SET NOT NULL;

ALTER TABLE packages
ALTER COLUMN age_requirement SET DEFAULT 'all',
ALTER COLUMN age_requirement SET NOT NULL;

-- Add check constraints for new columns
DO $$ 
BEGIN
  -- Drop old auto-generated constraints if they exist
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
  
  -- Drop our named constraints if they exist (for re-running migration)
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

-- Now add the constraints (data is already valid)
ALTER TABLE packages
ADD CONSTRAINT chk_package_type CHECK (package_type IN ('adult', 'kid', 'all'));

ALTER TABLE packages
ADD CONSTRAINT chk_age_requirement CHECK (age_requirement IN ('all', '5-12', '13+'));

-- Update default currency to SGD for Singapore
ALTER TABLE packages 
ALTER COLUMN currency SET DEFAULT 'SGD';

-- Add index for filtering by package type
CREATE INDEX IF NOT EXISTS idx_packages_type ON packages(package_type) WHERE is_active = true;

-- Add comment for documentation
COMMENT ON COLUMN packages.package_type IS 'Package type: adult, kid, or all';
COMMENT ON COLUMN packages.age_requirement IS 'Age requirement: all, 5-12, or 13+';

