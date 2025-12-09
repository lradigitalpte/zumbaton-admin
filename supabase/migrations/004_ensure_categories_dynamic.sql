-- Migration: Ensure class_categories table supports dynamic category creation
-- This migration ensures the table structure is correct for dynamic category management

-- Ensure the table exists with all required columns
CREATE TABLE IF NOT EXISTS class_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(20) DEFAULT '#f59e0b',
  icon VARCHAR(50),
  parent_id UUID REFERENCES class_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_categories_active ON class_categories(is_active, sort_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_parent ON class_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON class_categories(slug);

-- Enable RLS if not already enabled
ALTER TABLE class_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view active categories" ON class_categories;
DROP POLICY IF EXISTS "Admins can create categories" ON class_categories;
DROP POLICY IF EXISTS "Admins can update categories" ON class_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON class_categories;

-- Create RLS Policies
CREATE POLICY "Anyone can view active categories"
  ON class_categories FOR SELECT
  USING (is_active = true OR is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can create categories"
  ON class_categories FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update categories"
  ON class_categories FOR UPDATE
  USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can delete categories"
  ON class_categories FOR DELETE
  USING (is_admin_or_above(auth.uid()));

-- Function to auto-generate slug from name
CREATE OR REPLACE FUNCTION generate_category_slug(category_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(regexp_replace(
    regexp_replace(category_name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_categories_updated_at ON class_categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON class_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

