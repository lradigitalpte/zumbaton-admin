-- =====================================================
-- MIGRATION: Add Rooms and Class Categories
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- ROOMS TABLE
-- Studios/rooms where classes are held
-- =====================================================
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  capacity INTEGER NOT NULL DEFAULT 20 CHECK (capacity > 0),
  location VARCHAR(200),
  room_type VARCHAR(30) DEFAULT 'studio' CHECK (room_type IN ('studio', 'outdoor', 'pool', 'gym', 'other')),
  amenities TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'inactive')),
  color VARCHAR(20) DEFAULT 'amber',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active rooms lookup
CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(is_active, sort_order) WHERE is_active = true;

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY "Anyone can view active rooms"
  ON rooms FOR SELECT
  USING (is_active = true OR is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can create rooms"
  ON rooms FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update rooms"
  ON rooms FOR UPDATE
  USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can delete rooms"
  ON rooms FOR DELETE
  USING (is_admin_or_above(auth.uid()));

-- =====================================================
-- CLASS_CATEGORIES TABLE
-- Categories for organizing classes
-- =====================================================
CREATE TABLE IF NOT EXISTS class_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(20) DEFAULT '#f59e0b', -- Amber for Zumba theme
  icon VARCHAR(50),
  parent_id UUID REFERENCES class_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active categories lookup
CREATE INDEX IF NOT EXISTS idx_categories_active ON class_categories(is_active, sort_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_parent ON class_categories(parent_id);

-- Enable RLS
ALTER TABLE class_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for class_categories
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

-- =====================================================
-- ALTER CLASSES TABLE
-- Add room_id and category_id, recurrence support
-- =====================================================

-- Add room reference
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

-- Add category reference  
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES class_categories(id) ON DELETE SET NULL;

-- Add recurrence support
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(20) DEFAULT 'single' 
  CHECK (recurrence_type IN ('single', 'recurring', 'course'));

ALTER TABLE classes
ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB DEFAULT NULL;
-- Pattern example: {"days": ["monday", "wednesday"], "endDate": "2024-03-01", "endType": "date"}
-- endType can be: "never", "date", "count"

ALTER TABLE classes
ADD COLUMN IF NOT EXISTS parent_class_id UUID REFERENCES classes(id) ON DELETE CASCADE;
-- For recurring classes, this points to the "template" class
-- Individual occurrences point to the parent

ALTER TABLE classes
ADD COLUMN IF NOT EXISTS occurrence_date DATE;
-- The specific date for this occurrence (for recurring classes)

-- Indexes
CREATE INDEX IF NOT EXISTS idx_classes_room ON classes(room_id);
CREATE INDEX IF NOT EXISTS idx_classes_category ON classes(category_id);
CREATE INDEX IF NOT EXISTS idx_classes_parent ON classes(parent_class_id);
CREATE INDEX IF NOT EXISTS idx_classes_recurrence ON classes(recurrence_type);

-- =====================================================
-- INSERT DEFAULT ROOMS
-- =====================================================
INSERT INTO rooms (name, description, capacity, location, room_type, amenities, status, color, sort_order) VALUES
('Studio A', 'Our main dance studio with professional sound system and full-wall mirrors.', 30, 'Ground Floor', 'studio', ARRAY['Mirrors', 'Sound System', 'Air Conditioning', 'Wooden Floor'], 'available', 'amber', 1),
('Studio B', 'Medium-sized studio perfect for smaller classes and workshops.', 20, 'Ground Floor', 'studio', ARRAY['Mirrors', 'Sound System', 'Air Conditioning', 'Mats Provided'], 'available', 'blue', 2),
('Studio C', 'Intimate studio space for private sessions and small groups.', 12, 'First Floor', 'studio', ARRAY['Mirrors', 'Sound System', 'Air Conditioning'], 'available', 'purple', 3),
('Outdoor Terrace', 'Open-air space for outdoor Zumba sessions with city views.', 40, 'Rooftop', 'outdoor', ARRAY['Sound System', 'Mats Provided', 'Water Fountain'], 'available', 'emerald', 4),
('Pool Area', 'Heated pool for Aqua Zumba classes.', 15, 'Basement', 'pool', ARRAY['Sound System', 'Lockers', 'Showers'], 'maintenance', 'cyan', 5)
ON CONFLICT DO NOTHING;

-- =====================================================
-- INSERT DEFAULT CATEGORIES
-- =====================================================
INSERT INTO class_categories (name, slug, description, color, icon, sort_order) VALUES
('Zumba', 'zumba', 'High-energy dance fitness classes', '#f59e0b', '💃', 1),
('Zumba Kids', 'zumba-kids', 'Fun dance classes for children', '#10b981', '🧒', 2),
('Zumba Gold', 'zumba-gold', 'Lower intensity Zumba for seniors', '#eab308', '🌟', 3),
('Aqua Zumba', 'aqua-zumba', 'Pool-based Zumba classes', '#3b82f6', '🏊', 4),
('Zumba Toning', 'zumba-toning', 'Zumba with toning sticks', '#ec4899', '💪', 5),
('STRONG Nation', 'strong-nation', 'High-intensity interval training', '#ef4444', '🔥', 6),
('HIIT', 'hiit', 'High Intensity Interval Training', '#8b5cf6', '⚡', 7),
('Dance Fitness', 'dance-fitness', 'General dance fitness classes', '#06b6d4', '🎵', 8)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON class_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- Rooms with current class count
CREATE OR REPLACE VIEW rooms_with_usage AS
SELECT 
  r.*,
  COUNT(c.id) FILTER (WHERE c.status = 'scheduled' AND c.scheduled_at > NOW()) as upcoming_classes
FROM rooms r
LEFT JOIN classes c ON r.id = c.room_id
GROUP BY r.id;

-- Categories with class count
CREATE OR REPLACE VIEW categories_with_usage AS
SELECT 
  cc.*,
  COUNT(c.id) as total_classes,
  COUNT(c.id) FILTER (WHERE c.status = 'scheduled' AND c.scheduled_at > NOW()) as upcoming_classes
FROM class_categories cc
LEFT JOIN classes c ON cc.id = c.category_id
GROUP BY cc.id;

