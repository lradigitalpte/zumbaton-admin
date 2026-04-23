-- Add support for unlimited token packages
ALTER TABLE packages
ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_packages_is_unlimited ON packages(is_unlimited);
